const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

async function main() {
  const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);
  const [THREE, {createDroppedEquipment}] = await Promise.all([load('vendor/three.module.js'), load('dropped-equipment.js')]);
  const disposals = new Map(), originals = [], created = new Set(), engine = {...THREE};
  for (const [name, Type] of Object.entries(THREE)) {
    if (typeof Type !== 'function' || !Type.prototype) continue;
    if (![THREE.BufferGeometry, THREE.Material, THREE.Texture].some(Base => Type === Base || Type.prototype instanceof Base)) continue;
    engine[name] = class extends Type { constructor(...args) { super(...args); created.add(this); } };
  }
  for (const type of [THREE.BufferGeometry, THREE.Material, THREE.Texture]) {
    const original = type.prototype.dispose; originals.push([type, original]);
    type.prototype.dispose = function() { disposals.set(this, (disposals.get(this) || 0) + 1); return original.call(this); };
  }
  const resources = group => {
    const result = new Set();
    group.traverse(object => {
      if (object.geometry) result.add(object.geometry);
      if (object.material) {
        result.add(object.material);
        for (const value of Object.values(object.material)) if (value?.isTexture) result.add(value);
      }
    });
    return result;
  };
  const records = [];
  try {
    for (const weapon of ['classic','ghost','spectre','vandal','phantom']) {
      const first = createDroppedEquipment(engine, {weapon}), second = createDroppedEquipment(engine, {weapon,yaw:Math.PI / 3});
      const draws = first.group.children.length;
      assert.notEqual(first.group, second.group);
      assert.equal(first.group.rotation.y, 0); assert.equal(second.group.rotation.y, Math.PI / 3);
      assert.equal(first.group.position.y, 0); assert.equal(first.group.userData.weapon, weapon);
      assert.equal(first.group.children.length, second.group.children.length);
      assert.ok(first.group.children.length <= 10, 'One gun plus floor marker must remain at most ten draws');
      first.group.children.forEach((surface, index) => {
        assert.equal(surface.geometry, second.group.children[index].geometry, 'Same weapon instances share geometry');
        assert.equal(surface.material, second.group.children[index].material, 'Same weapon instances share materials');
        assert.ok(!surface.isLight, 'Pickup markers must not add scene lights');
        assert.deepEqual(surface.userData, {}, 'Cosmetic equipment must not acquire agent hit tags');
        for (const attribute of Object.values(surface.geometry.attributes)) {
          assert.ok([...attribute.array].every(Number.isFinite), 'Baked surfaces retain finite positions, normals and UVs');
        }
      });
      const weaponBounds = new THREE.Box3();
      first.group.updateMatrixWorld(true);
      first.group.children.filter(object => object.name.startsWith('Ground weapon')).forEach(object => weaponBounds.expandByObject(object));
      const size = weaponBounds.getSize(new THREE.Vector3());
      assert.ok(Math.abs(weaponBounds.min.y - .018) < 1e-6, 'Gun must rest above ground');
      assert.ok(size.y < .13 && size.y > .06, 'Weapon must lie on its side');
      assert.ok(size.z > .35 && size.z < 1.1, 'Realistic world length is preserved');
      assert.ok(Math.abs((weaponBounds.min.x + weaponBounds.max.x) / 2) < 1e-6);
      assert.ok(Math.abs((weaponBounds.min.z + weaponBounds.max.z) / 2) < 1e-6);
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0,-1,0));
      assert.equal(ray.intersectObject(first.group, true).length, 0, 'Drops must not block shooting rays');
      const shared = resources(first.group), before = new Map(disposals);
      const scene = new THREE.Scene(); scene.add(first.group, second.group);
      first.dispose(); first.dispose();
      assert.equal(first.group.parent, null); assert.equal(first.group.children.length, 0);
      for (const resource of shared) assert.equal(disposals.get(resource) || 0, before.get(resource) || 0, 'An active sibling retains its GPU resources');
      second.dispose(); second.dispose();
      for (const resource of shared) assert.equal(disposals.get(resource), 1, 'Last owner releases shared resources exactly once');
      assert.equal(scene.children.length, 0);
      const recreated = createDroppedEquipment(engine, {weapon});
      assert.ok(!shared.has(recreated.group.children[0].geometry), 'A released cache entry rebuilds fresh resources');
      recreated.dispose();
      records.push({weapon,draws,length:size.z,width:size.x,thickness:size.y});
    }
    const bad = createDroppedEquipment(engine, {weapon:'unknown',yaw:NaN});
    assert.equal(bad.group.userData.weapon,'classic'); assert.equal(bad.group.rotation.y,0); bad.dispose();
    for (const resource of created) assert.equal(disposals.get(resource), 1, 'Every created geometry, material and texture is released');
    assert.ok([...disposals.values()].every(count => count === 1), 'Every observed temporary and owned resource is disposed exactly once');
    console.log('PASS: five world weapon silhouettes; material batching; ground pose; per-instance yaw; shared resources; safe raycasts; idempotent cleanup.');
    console.log(records.map(row => `${row.weapon}: ${row.draws} draws; ${(row.length * 100).toFixed(1)}cm × ${(row.width * 100).toFixed(1)}cm × ${(row.thickness * 100).toFixed(1)}cm`).join('\n'));
    console.log(`PASS: ${disposals.size} geometry/material/texture disposals, each exactly once.`);
  } finally {
    for (const [type, original] of originals) type.prototype.dispose = original;
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
