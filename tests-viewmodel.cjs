const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {createHash} = require('node:crypto');

async function main() {
  const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);
  const [THREE, {createViewmodel}] = await Promise.all([load('vendor/three.module.js'), load('viewmodel.js')]);
  const camera = new THREE.PerspectiveCamera(76, 16 / 9, .05, 500);
  const view = createViewmodel(THREE, camera);
  view.group.visible = true;
  const boundaries = [0, .18, .19, .41, .42, .56, .75, .78, .81, .835, .90, .91, 1];
  const epsilon = 1e-6, duration = 2.5, measurements = [];
  const geometries = new Set(), materials = new Set(), textures = new Set();
  view.group.traverse(object => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  const firearmFinishes = [...materials].filter(material => material.name.startsWith('First-person metal / '));
  assert.equal(firearmFinishes.length, 29, 'Ten firearms retain independent visible metal finishes (pump uses two)');
  const machinedSurfaces = new Set();
  for (const material of firearmFinishes) {
    assert.equal(material.map, material.roughnessMap); assert.equal(material.bumpMap, material.roughnessMap, 'Near-view grain must reuse the existing owned metal texture');
    assert.equal(material.map.image.width, 64); assert.equal(material.map.image.height, 64);
    assert.equal(material.map.colorSpace, THREE.LinearSRGBColorSpace); assert.equal(material.bumpScale, .00016);
    assert.equal(material.depthTest, true); assert.equal(material.depthWrite, true); assert.equal(material.transparent, true);
    machinedSurfaces.add(material.map);
  }
  assert.equal(machinedSurfaces.size, 10, 'The cached firearms must not acquire extra texture objects');
  assert.equal(new Set([...machinedSurfaces].map(texture => texture.image.data)).size, 1, 'All five existing metal textures share one16KiB CPU image');
  const metalPixels = [...machinedSurfaces][0].image.data;
  assert.equal(metalPixels.byteLength, 16384);
  const metalValues = new Set();
  for (let offset = 0; offset < metalPixels.length; offset += 4) {
    const value = metalPixels[offset]; metalValues.add(value);
    assert.ok(value >= 224 && value <= 255, 'Machining grain must remain restrained rather than making large dark scratches');
    assert.equal(metalPixels[offset + 1], value); assert.equal(metalPixels[offset + 2], value); assert.equal(metalPixels[offset + 3], 255);
  }
  assert.ok(metalValues.size >= 15, 'The close-up metal must contain actual fine finish variation');
  for (const id of ['vandal', 'phantom', 'spectre', 'classic', 'ghost']) {
    const finishes = new Set(); view.group.getObjectByName(`Equipment / ${id}`).traverse(object => { if (object.isMesh) finishes.add(object.material); });
    const receiver = [...finishes].find(material => material.name === 'First-person metal / receiver');
    const edge = [...finishes].find(material => material.name === 'First-person metal / edge');
    const steel = [...finishes].find(material => material.name === 'First-person metal / steel');
    assert.ok(receiver.roughness > edge.roughness && edge.roughness > steel.roughness, `${id} coated body, machined edge and exposed steel need distinct reflection widths`);
    assert.ok(receiver.metalness < edge.metalness && edge.metalness < steel.metalness);
    assert.equal(receiver.map, edge.map); assert.equal(edge.map, steel.map);
  }
  const sphere = new THREE.SphereGeometry(1, 12, 8), finger = new THREE.CapsuleGeometry(1, 3, 4, 10);
  // batchHand writes the palm, four pairs of finger bones, then the thumb.
  // Read the rendered index-finger triangles, rather than copying its pose formula.
  const palmCount = sphere.index.count, boneCount = finger.index.count;
  const fingerStart = palmCount + 6 * boneCount, fingerCount = 2 * boneCount;
  sphere.dispose(); finger.dispose();
  function inspectTriggerFinger(id, hand, weapon) {
    const glove = hand.children.find(object => object.isMesh && object.material.color?.getHexString() === '8a806c');
    assert.equal(glove.geometry.attributes.position.count, palmCount + 9 * boneCount, 'The rigid glove layout must match the inspected rendered triangles');
    const sidearm = id === 'classic' || id === 'ghost';
    // These are the existing solid guard/trigger dimensions authored in buildWeapon.
    const lower = sidearm ? [[-.021, -.0975, -.0425], [.021, -.0905, .0365]] : [[-.0225, -.1085, -.0265], [.0225, -.1015, .0585]];
    const front = sidearm ? [[-.0205, -.0925, -.0475], [.0205, -.0455, -.0405]] : [[-.0225, -.106, -.0315], [.0225, -.050, -.0245]];
    const trigger = sidearm ? [[-.0045, -.083, .0105], [.0045, -.053, .0175]] : [[-.004, -.085, .028], [.004, -.055, .036]];
    const boxes = [lower, front, trigger].map(([min, max]) => new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)));
    const inverse = weapon.matrixWorld.clone().invert(), triangle = new THREE.Triangle();
    const position = glove.geometry.attributes.position; let nearestTrigger = Infinity, intersections = 0;
    for (let index = fingerStart; index < fingerStart + fingerCount; index += 3) {
      for (let vertex = 0; vertex < 3; vertex++) {
        const point = [triangle.a, triangle.b, triangle.c][vertex];
        point.fromBufferAttribute(position, index + vertex).applyMatrix4(glove.matrixWorld).applyMatrix4(inverse);
        nearestTrigger = Math.min(nearestTrigger, boxes[2].distanceToPoint(point));
      }
      for (const box of boxes) if (box.intersectsTriangle(triangle)) intersections++;
    }
    assert.equal(intersections, 0, `${id} rendered index finger must not penetrate its metal trigger or guard; found ${intersections} intersecting triangles`);
    assert.ok(nearestTrigger < .018, `${id} index finger must reach its trigger instead of floating outside the guard`);
    return nearestTrigger * 1000;
  }
  const expectedTriangles = {vandal:13720, phantom:13740, spectre:13740, classic:11724, ghost:11844};

  for (const id of ['vandal', 'phantom', 'spectre', 'classic', 'ghost']) {
    view.setWeapon(id);
    const model = view.group.getObjectByName(`Viewmodel / ${id}`);
    const weapon = model.getObjectByName(`Equipment / ${id}`);
    // Each arm has four flexible meshes followed by its rigid glove group.
    const rightHand = model.children[1].children.find(object => object.isGroup);
    const leftHand = model.children[2].children.find(object => object.isGroup);
    const magazine = weapon.children[0];
    assert.ok(rightHand && leftHand && magazine.isGroup);
    view.update(0, {time: 1}); camera.updateMatrixWorld(true);
    const triggerGapMm = inspectTriggerFinger(id, rightHand, weapon);
    let visibleMeshes = 0, triangles = 0;
    model.traverseVisible(object => {if (object.isMesh) {visibleMeshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;}});
    assert.equal(visibleMeshes, 26, `${id} must preserve its original draw budget`);
    assert.equal(triangles, expectedTriangles[id], `${id} must preserve its original triangle budget`);
    const sample = (progress, dt = 0, time = 1, inspect = false) => {
      view.update(dt, {time, reloadDuration: duration, reloading: (1 - progress) * duration});
      camera.updateMatrixWorld(true);
      const state = {
        right: rightHand.getWorldPosition(new THREE.Vector3()),
        left: leftHand.getWorldPosition(new THREE.Vector3()),
        magazine: magazine.getWorldPosition(new THREE.Vector3()),
        rightRotation: rightHand.quaternion.clone(), leftRotation: leftHand.quaternion.clone(),
        magazineRotation: magazine.quaternion.clone(), magazineY: magazine.position.y, visible: magazine.visible,
      };
      for (const object of [view.group, rightHand, leftHand, magazine]) {
        for (const number of object.matrixWorld.elements) assert.ok(Number.isFinite(number), `${id} reload cannot produce a non-finite pose`);
      }
      if (inspect) inspectTriggerFinger(id, rightHand, weapon);
      return state;
    };

    let largestBoundaryHand = 0, largestBoundaryMagazine = 0;
    for (const boundary of boundaries) {
      const before = sample(Math.max(0, boundary - epsilon), 0, 1, true);
      const after = sample(Math.min(1, boundary + epsilon), 0, 1, true);
      const handDelta = Math.max(before.left.distanceTo(after.left), before.right.distanceTo(after.right));
      const magazineDelta = before.magazine.distanceTo(after.magazine);
      largestBoundaryHand = Math.max(largestBoundaryHand, handDelta);
      largestBoundaryMagazine = Math.max(largestBoundaryMagazine, magazineDelta);
      assert.ok(handDelta < .001, `${id} hands jump${(handDelta * 1000).toFixed(2)}mm at reload progress${boundary}`);
      assert.ok(magazineDelta < .001, `${id} magazine jumps${(magazineDelta * 1000).toFixed(2)}mm at reload progress${boundary}`);
      assert.ok(before.leftRotation.angleTo(after.leftRotation) < .001, `${id} left glove rotation jumps at${boundary}`);
      assert.ok(before.rightRotation.angleTo(after.rightRotation) < .001, `${id} right glove rotation jumps at${boundary}`);
      assert.ok(before.magazineRotation.angleTo(after.magazineRotation) < .001, `${id} magazine rotation jumps at${boundary}`);
    }

    let previous = sample(0), largestStepHand = 0, largestStepMagazine = 0, minimumY = 0;
    for (let index = 1; index <= 1000; index++) {
      const progress = index / 1000, current = sample(progress);
      const handStep = Math.max(previous.left.distanceTo(current.left), previous.right.distanceTo(current.right));
      const magazineStep = previous.magazine.distanceTo(current.magazine);
      largestStepHand = Math.max(largestStepHand, handStep);
      largestStepMagazine = Math.max(largestStepMagazine, magazineStep);
      minimumY = Math.min(minimumY, current.magazineY);
      assert.ok(handStep < .012, `${id} hands jump within the reload at${progress}`);
      assert.ok(magazineStep < .004, `${id} magazine jumps within the reload at${progress}`);
      assert.ok(current.magazineY >= -.280001 && current.magazineY <= .000001, 'The existing visible28cm pull depth stays unchanged');
      assert.equal(current.visible, !(progress > .41 && progress < .56), 'The magazine handoff stays hidden only during its existing exchange interval');
      previous = current;
    }
    assert.ok(Math.abs(minimumY + .28) < 1e-8, 'The magazine reaches its full original visible pull depth');
    assert.equal(previous.magazineY, 0); assert.equal(previous.visible, true);
    const start = sample(0), end = sample(1);
    assert.ok(start.left.distanceTo(end.left) < 1e-9 && start.right.distanceTo(end.right) < 1e-9, 'The reload ends with both hands back on their grips');
    assert.ok(start.magazine.distanceTo(end.magazine) < 1e-9, 'The magazine ends fully seated');

    // Exercise the normal game timing path too, not just poses with zero elapsed dt.
    let timedPrevious = sample(0), largestTimedStep = 0;
    for (let frame = 1; frame <= 150; frame++) {
      const current = sample(frame / 150, 1 / 60, 1 + frame / 60, frame % 10 === 0);
      largestTimedStep = Math.max(largestTimedStep, timedPrevious.left.distanceTo(current.left), timedPrevious.magazine.distanceTo(current.magazine));
      timedPrevious = current;
    }
    assert.ok(largestTimedStep < .055, `${id} reload has an abrupt frame at60fps`);
    for (const pose of [{aiming:true}, {moving:1, crouching:1}, {kick:.08}, {interacting:true}]) {
      for (let frame = 0; frame < 30; frame++) view.update(1 / 60, {time:4 + frame / 60, ...pose});
      camera.updateMatrixWorld(true); inspectTriggerFinger(id, rightHand, weapon);
    }
    measurements.push({id, visibleMeshes, triangles, triggerGapMm: +triggerGapMm.toFixed(3), boundaryHandMm: +(largestBoundaryHand * 1000).toFixed(4),
      boundaryMagazineMm: +(largestBoundaryMagazine * 1000).toFixed(4),
      stepHandMm: +(largestStepHand * 1000).toFixed(3), stepMagazineMm: +(largestStepMagazine * 1000).toFixed(3),
      timedStepMm: +(largestTimedStep * 1000).toFixed(3)});
  }
  view.setWeapon('knife'); view.update(0, {time: 1});
  const knife = view.group.getObjectByName('Viewmodel / knife');
  const knifeHand = knife.children[1].children.find(object => object.isGroup);
  const knifeGlove = knifeHand.children.find(object => object.isMesh && object.material.color?.getHexString() === '8a806c');
  assert.equal(createHash('sha256').update(Buffer.from(knifeGlove.geometry.attributes.position.array.buffer)).digest('hex'),
    'b1d9de643856c2f91caf49fe578787b9a0d82abb290b7fc943ee4f01ec21f9c3', 'The knife grip must remain unchanged');
  assert.deepEqual([geometries.size, materials.size, textures.size], [146, 79, 16], 'Ten firearms plus knife use a bounded expanded cache; repeat switching must not grow resources');
  const currentResources = new Set();
  view.group.traverse(object => {
    if (!object.isMesh) return;
    currentResources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      currentResources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) currentResources.add(value);
    }
  });
  assert.deepEqual([...currentResources].map(resource => resource.uuid).sort(),
    [...geometries, ...materials, ...textures].map(resource => resource.uuid).sort(), 'Reload animation cannot allocate new GPU resources');
  const disposalCounts = new Map([...currentResources].map(resource => [resource, 0]));
  for (const resource of disposalCounts.keys()) resource.addEventListener('dispose', () => disposalCounts.set(resource, disposalCounts.get(resource) + 1));
  view.dispose(); view.dispose();
  for (const [resource, count] of disposalCounts) assert.equal(count, 1, `${resource.type || 'Texture'} must release exactly once, including the reused metal surface`);
  console.log('PASS: five rendered trigger fingers, all reload phase boundaries,1000-step motion curves,60fps playback, seated magazines, final hand grips, unchanged knife grip and GPU resources');
  console.log('PASS: restrained shared machining finish, distinct receiver/edge/steel response, zero added textures/draws/triangles and exact-once GPU resource disposal');
  console.log(JSON.stringify(measurements));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
