const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { normalizedLegacyColliders } = require('./tests-tactical-legacy.cjs');

async function main() {
  const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);
  const [THREE, { createZoneFX }, { createMap }] = await Promise.all([load('vendor/three.module.js'), load('zone-fx.js'), load('map.js')]);
  const fx = createZoneFX(THREE), scene = new THREE.Scene(); scene.add(fx.group);
  assert.equal(fx.group.visible, false); assert.equal(fx.group.children.length, 7);
  const geometries = new Set(), materials = new Set(), textures = new Set(), buffers = [], resources = new Map();
  const watch = resource => { resources.set(resource, 0); resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1)); };
  let poolSize = 0, poolBytes = 0;
  for (const mesh of fx.group.children) {
    assert.ok(mesh.isInstancedMesh); geometries.add(mesh.geometry); materials.add(mesh.material); watch(mesh);
    poolSize += mesh.instanceMatrix.count;
    const opacity = mesh.geometry.getAttribute('fxOpacity'); buffers.push(mesh.instanceMatrix.array, opacity.array);
    poolBytes += mesh.instanceMatrix.array.byteLength + opacity.array.byteLength;
    assert.equal(mesh.count, 0); assert.equal(mesh.castShadow, false); assert.equal(mesh.receiveShadow, false);
    assert.equal(mesh.userData.solid, false); assert.equal(mesh.material.transparent, true);
    assert.equal(mesh.material.depthWrite, false); assert.equal(mesh.material.depthTest, true);
    assert.equal(mesh.material.forceSinglePass, true); assert.equal(mesh.material.side, THREE.DoubleSide);
    const hits = []; mesh.raycast(new THREE.Raycaster(), hits); assert.equal(hits.length, 0, 'A ground cue never blocks bullets or targeting');
    for (const value of Object.values(mesh.material)) if (value?.isTexture) textures.add(value);
    const shader = { vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
    mesh.material.onBeforeCompile(shader);
    assert.ok(shader.vertexShader.includes('vFxOpacity=fxOpacity;')); assert.ok(shader.fragmentShader.includes('diffuseColor.a *= vFxOpacity;'));
  }
  assert.equal(geometries.size, 7); assert.equal(materials.size, 7); assert.equal(textures.size, 0);
  assert.equal(poolSize, 742); assert.equal(poolBytes, 50456);
  for (const resource of [...geometries, ...materials]) watch(resource);
  const emberFloor = fx.group.getObjectByName('Zone cue / EMBER warning floor');
  const emberRings = fx.group.getObjectByName('Zone cue / EMBER boundary and shockwave');
  const emberMarks = fx.group.getObjectByName('Zone cue / EMBER hazard marks');
  const emberFlares = fx.group.getObjectByName('Zone cue / EMBER pulse heat flares');
  const frostFloor = fx.group.getObjectByName('Zone cue / FROST frozen floor');
  const frostRings = fx.group.getObjectByName('Zone cue / FROST perimeter');
  const frostCrystals = fx.group.getObjectByName('Zone cue / FROST snow crystals');
  const make = (id, type, startedAt = 10) => ({ id: `zone-${type}-${id}`, type, team: 'red', sourceId: 'red-0', x: 4, y: 2, z: 9,
    startedAt, endsAt: startedAt + (type === 'ember' ? 4.8 : 10), radius: type === 'ember' ? 6 : 7, round: 1 });
  const ember = make(1, 'ember'), frost = make(2, 'frost');
  const snapshot = () => fx.group.children.map(mesh => ({ count: mesh.count, visible: mesh.visible,
    matrix: Array.from(mesh.instanceMatrix.array.subarray(0, mesh.count * 16)), alpha: Array.from(mesh.geometry.getAttribute('fxOpacity').array.subarray(0, mesh.count)) }));
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  const radius = (mesh, index = 0) => { mesh.getMatrixAt(index, matrix); matrix.decompose(position, quaternion, scale); return scale.x; };
  fx.update([ember], 9.999); assert.equal(fx.group.visible, false);
  fx.update([ember], 10); assert.equal(emberFloor.count, 1); assert.equal(emberRings.count, 2); assert.equal(emberMarks.count, 12);
  assert.equal(emberFlares.count, 0, 'The1.2-second warning never generates premature heat');
  assert.equal(radius(emberFloor), 6); assert.equal(radius(emberRings), 6);
  assert.ok(emberFloor.material.opacity < .2, 'Warnings fill the floor without obscuring the scene');
  fx.update([ember], 10.6); const warningRadius = radius(emberRings, 1); assert.ok(warningRadius > 3 && warningRadius < 4);
  for (const pulse of [1.2, 2.4, 3.6]) {
    fx.update([ember], 10 + pulse + .01); const first = radius(emberRings, 1);
    fx.update([ember], 10 + pulse + .2); const second = radius(emberRings, 1);
    assert.equal(emberFlares.count, 12, `Pulse at ${pulse}s has12 peripheral heat ribbons`);
    assert.ok(emberFlares.geometry.getAttribute('fxOpacity').array[0] > .5);
    assert.ok(first < second && second < 6, `Pulse at ${pulse}s starts a fresh expanding ground ring`);
    assert.equal(radius(emberRings), 6, 'The outer danger boundary never changes');
    fx.update([ember], 10 + pulse + .56); assert.equal(emberRings.count, 1, 'Each shockwave ends without extending the zone lifetime');
    assert.equal(emberFlares.count, 0, 'A heat flare lasts less than half a second');
  }
  fx.update([ember], 14.799); assert.equal(fx.group.visible, true);
  fx.update([ember], 14.8); assert.equal(fx.group.visible, false, 'EMBER expires after exactly4.8 seconds');
  fx.update([frost], 10); assert.equal(frostFloor.count, 1); assert.equal(frostRings.count, 2); assert.equal(frostCrystals.count, 7);
  assert.equal(radius(frostFloor), 7); assert.equal(radius(frostRings), 7);
  const initial = frostFloor.geometry.getAttribute('fxOpacity').array[0];
  fx.update([frost], 10.8); assert.ok(frostFloor.geometry.getAttribute('fxOpacity').array[0] > initial * 3, 'Warmup becomes a distinct active frozen field');
  assert.ok(frostCrystals.geometry.getAttribute('fxOpacity').array[0] > 0);
  fx.update([frost], 19.999); assert.equal(fx.group.visible, true);
  fx.update([frost], 20); assert.equal(fx.group.visible, false, 'FROST ends at10 seconds, including its warmup');
  const frostHash = crypto.createHash('sha256');
  for (const mesh of [frostFloor, frostRings, frostCrystals]) {
    for (const [name, attribute] of Object.entries(mesh.geometry.attributes).filter(([name]) => name !== 'fxOpacity')) {
      frostHash.update(name); frostHash.update(Buffer.from(attribute.array.buffer));
    }
    if (mesh.geometry.index) frostHash.update(Buffer.from(mesh.geometry.index.array.buffer));
  }
  for (const time of [10, 10.2, 10.8, 12.65, 19.6, 19.999]) {
    fx.update([frost], time);
    for (const mesh of [frostFloor, frostRings, frostCrystals]) {
      const matrices = mesh.instanceMatrix.array.slice(0, mesh.count * 16);
      // Remove only the global visual lift; preserve every relative plane height.
      for (let i = 0; i < mesh.count; i++) matrices[i * 16 + 13] = Math.round((matrices[i * 16 + 13] - frost.y - .095) * 1e6) / 1e6;
      frostHash.update(mesh.name); frostHash.update(Buffer.from(matrices.buffer));
      frostHash.update(Buffer.from(mesh.geometry.getAttribute('fxOpacity').array.buffer, 0, mesh.count * 4));
      frostHash.update(String(mesh.material.opacity)); frostHash.update(String(mesh.material.color.getHex()));
    }
  }
  assert.equal(frostHash.digest('hex'), '7977ed4fc66f5b41e3afdf61e3ecac2f1c20392a51cdac8587723932c450de9f', 'FROST geometry, color, opacity and transforms retain the previous hash after normalizing only visual lift');
  fx.update([ember, frost], 12.65); const expected = snapshot();
  fx.update([frost, ember, frost, ember], 12.65); assert.deepEqual(snapshot(), expected, 'Reordered duplicate snapshots preserve every render buffer');
  fx.update([], 100); fx.update([frost, ember], 12.65); assert.deepEqual(snapshot(), expected, 'Appearance uses absolute timestamps rather than animation history');
  const second = createZoneFX(THREE); second.update([frost, ember], 12.65);
  const joined = second.group.children.map(mesh => ({ count: mesh.count, visible: mesh.visible,
    matrix: Array.from(mesh.instanceMatrix.array.subarray(0, mesh.count * 16)), alpha: Array.from(mesh.geometry.getAttribute('fxOpacity').array.subarray(0, mesh.count)) }));
  assert.deepEqual(joined, expected, 'Mid-event join renders the same warning/pulse/ice'); second.dispose();
  const many = Array.from({ length: 26 }, (_, i) => make(i + 1, i % 2 ? 'ember' : 'frost'));
  fx.update(many, 10.5); assert.equal(fx.group.userData.activeEvents, 20); const capped = snapshot();
  fx.update([...many].reverse(), 10.5); assert.deepEqual(snapshot(), capped, 'The20-event cap does not depend on network order');
  let maxTriangles = 0, maxDraws = 0;
  for (const events of [many, Array.from({ length: 20 }, (_, i) => make(i + 1, 'ember')), Array.from({ length: 20 }, (_, i) => make(i + 1, 'frost'))]) {
    fx.update(events, 12.65); let triangles = 0, draws = 0;
    for (const mesh of fx.group.children) {
      assert.ok(mesh.count <= mesh.instanceMatrix.count);
      if (mesh.visible) { draws++; triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * mesh.count; }
    }
    maxTriangles = Math.max(maxTriangles, triangles); maxDraws = Math.max(maxDraws, draws);
  }
  assert.equal(maxDraws, 7); assert.equal(maxTriangles, 15200);
  fx.update([ember, frost], 10.2, { reducedMotion: true }); const reduced = snapshot();
  fx.update([ember, frost], 10.7, { reducedMotion: true });
  assert.deepEqual(snapshot().map(item => item.matrix), reduced.map(item => item.matrix), 'Reduced-motion warmup has no expanding or rotating geometry');
  for (const pulse of [1.2, 2.4, 3.6]) {
    fx.update([ember], 10 + pulse + .2, { reducedMotion: true });
    assert.equal(emberFlares.count, 0, 'Reduced motion disables vertical heat movement rather than flashing a fixed wall');
  }
  const flareShader = { vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  emberFlares.material.onBeforeCompile(flareShader);
  assert.ok(flareShader.vertexShader.includes('vFxFeather=fxFeather;'));
  assert.ok(flareShader.fragmentShader.includes('diffuseColor.a *= vFxFeather;'));
  assert.notEqual(emberFlares.material.customProgramCacheKey(), emberFloor.material.customProgramCacheKey(), 'The feathered shader cannot reuse a ground shader program');
  const feather = emberFlares.geometry.getAttribute('fxFeather');
  assert.ok(Array.from(feather.array).some(alpha => alpha > .8));
  for (let i = 0; i < feather.count; i++) if (i % 3 !== 1) assert.equal(feather.getX(i), 0, 'Both horizontal ribbon edges taper to transparent');
  assert.ok(emberFlares.material.opacity <= .34, 'Heat is translucent without a bright full-screen flash or light');
  for (let t = 0; t < .48; t += .02) {
    fx.update([ember], 11.2 + t);
    for (let index = 0; index < emberFlares.count; index++) {
      emberFlares.getMatrixAt(index, matrix);
      const vertex = new THREE.Vector3(), positions = emberFlares.geometry.attributes.position;
      for (let n = 0; n < positions.count; n++) {
        vertex.fromBufferAttribute(positions, n).applyMatrix4(matrix);
        assert.ok(vertex.y >= ember.y + .094 && vertex.y < ember.y + 4.21, 'Flares retain their height envelope above the lifted visual ground');
        const distance = Math.hypot(vertex.x - ember.x, vertex.z - ember.z);
        assert.ok(distance > 1.8 && distance < 5, 'Heat leaves the central sightline open and stays within the6m damage area');
      }
    }
  }
  fx.update([ember, frost], 12.6);
  for (const mesh of fx.group.children) for (let index = 0; index < mesh.count; index++) {
    if (mesh === emberFlares) continue;
    mesh.getMatrixAt(index, matrix); matrix.decompose(position, quaternion, scale);
    assert.ok(position.y >= 2.094 && position.y <= 2.108, 'Every warning, crystal and fleck retains its visual ground layer');
    assert.ok(scale.x <= 7 && scale.y <= 7);
    const alpha = mesh.geometry.getAttribute('fxOpacity').array[index]; assert.ok(alpha >= 0 && alpha <= 1);
    const vertex = new THREE.Vector3(), positions = mesh.geometry.attributes.position;
    for (let n = 0; n < positions.count; n++) { vertex.fromBufferAttribute(positions, n).applyMatrix4(matrix); assert.ok(Math.abs(vertex.y - position.y) < 1e-6, 'Ground geometry has no vertical wall or cloud'); }
  }
  const preview = { type: 'ember', x: -4, y: .2, z: 22, radius: 6 };
  fx.update([], 100, { preview }); assert.equal(fx.group.visible, true); assert.equal(fx.group.userData.activeEvents, 0);
  assert.equal(emberRings.count, 1); assert.equal(emberFlares.count, 0); assert.equal(emberFloor.count, 0);
  assert.equal(radius(emberRings), 6); assert.ok(Math.abs(position.y - .3) < 1e-6);
  assert.ok(Math.abs(emberRings.geometry.getAttribute('fxOpacity').array[0] - .8) < 1e-6);
  for (const type of ['ember', 'frost']) {
    const events = Array.from({ length: 20 }, (_, i) => make(i, type));
    fx.update(events, 12.65, { preview: { ...preview, type, radius: type === 'ember' ? 6 : 7 } });
    assert.equal((type === 'ember' ? emberRings : frostRings).count, 41, 'Preview has its own reserved slot after20 simultaneous active fields');
    assert.equal(fx.group.userData.activeEvents, 20, 'A preview is never an active gameplay event');
  }
  for (const invalidPreview of [null, {}, { ...preview, type: 'unknown' }, { ...preview, radius: 7 }, { ...preview, y: NaN }, { ...preview, x: 1001 }]) {
    fx.update([], 100, { preview: invalidPreview }); assert.equal(fx.group.visible, false, 'Malformed previews cannot leave a stale target circle');
  }
  fx.update([], 100, { preview }); fx.update([], 100); assert.equal(fx.group.visible, false, 'Releasing the cast key clears the preview immediately');
  const context2d = new Proxy({ measureText: text => ({ width: String(text).length * 8 }) }, { get: (target, key) => target[key] || (() => {}) });
  const previousDocument = global.document;
  global.document = { createElement: () => ({ getContext: () => context2d }) };
  const mapScene = new THREE.Scene(), arena = createMap(THREE, mapScene); mapScene.updateMatrixWorld(true);
  global.document = previousDocument;
  const gameSource = fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8');
  const gameFunction = (name, following) => {
    const begin = gameSource.indexOf(`function ${name}(`), end = gameSource.indexOf(`function ${following}(`, begin);
    assert.ok(begin >= 0 && end > begin, `The real ${name} implementation must be available for support-height checks`);
    return gameSource.slice(begin, end);
  };
  const getZoneFloor = new Function('map', 'clamp', `${gameFunction('rampFloor', 'moveEntity')}\n${gameFunction('getZoneFloor', 'getZoneTarget')}\nreturn getZoneFloor;`)(arena, (n, low, high) => Math.max(low, Math.min(high, n)));
  const down = new THREE.Raycaster(), floorChecks = [];
  for (const sample of [
    { name: 'eastern deck', x: 62, y: 3.2, z: -11.5 },
    { name: 'western deck', x: -50, y: 3.2, z: -30.5 },
    { name: 'ground asphalt', x: 0, y: 0, z: 65 },
    // Approved mid-entry-crate move (-7.8,37) -> (-10,54), preserving the same local +1m cap sample.
    { name: 'low crate cap away from its raised handle', x: -9, y: 1.7, z: 54 },
    { name: 'Mewe canopy', x: 62, y: 3.45, z: -17, underCeiling: 2.7, underFloor: 0 },
    { name: 'bus shelter roof', x: -58, y: 4.49, z: 0, underCeiling: 2.7, underFloor: 0 },
    { name: 'information pavilion canopy overhang', x: 6.8, y: 4.425, z: 14, underCeiling: 3, underFloor: 0 },
    { name: 'southern stone seat', x: -34, y: .79, z: 66, underCeiling: .5, underFloor: 0 },
    { name: 'station wing canopy', x: -35, y: 5.92, z: -30, underCeiling: 4.8, underFloor: 3.2 },
    { name: 'service hut roof', x: 29, y: 5.4, z: -44 },
    { name: 'central service building roof', x: 0, y: 6.96, z: -15 },
    { name: 'Mewe deck connection sill', x: 62, y: 3.325, z: -13.72, underCeiling: 2.5, underFloor: 0 },
    { name: 'station portal canopy', x: -20.75, y: 4.45, z: -32 },
    { name: 'eastern retail canopy', x: 43.5, y: 3.62, z: 25 },
    { name: 'western retail awning outer shoulder', x: -45, y: 2.89, z: 15 },
  ]) {
    assert.ok(Math.abs(getZoneFloor(sample.x, sample.z, sample.y + 1.6) - sample.y) < 1e-8, `${sample.name} targeting uses the actual supported surface height`);
    if (sample.underCeiling !== undefined) assert.ok(Math.abs(getZoneFloor(sample.x, sample.z, sample.underCeiling) - sample.underFloor) < 1e-8, `${sample.name} does not become an invisible floor for players below its support slab`);
    down.set(new THREE.Vector3(sample.x, sample.y + .4, sample.z), new THREE.Vector3(0, -1, 0));
    const surface = down.intersectObject(mapScene, true).find(hit => hit.point.y <= sample.y + .2 && hit.point.y >= sample.y - .1);
    assert.ok(surface, `${sample.name} has a real rendered support surface`);
    for (const type of ['ember', 'frost']) {
      const event = { ...make(90, type), x: sample.x, y: sample.y, z: sample.z }, unchanged = JSON.stringify(event);
      fx.update([event], 12);
      const floor = type === 'ember' ? emberFloor : frostFloor;
      floor.getMatrixAt(0, matrix);
      assert.ok(matrix.elements[13] > surface.point.y + .005, `${type} fill must clear the actual ${sample.name} finish rather than disappear beneath it`);
      assert.ok(matrix.elements[13] - sample.y < .1, 'Visual clearance stays below10cm rather than lifting the authoritative field');
      fx.update([], 12, { preview: { type, x: sample.x, y: sample.y, z: sample.z, radius: type === 'ember' ? 6 : 7 } });
      (type === 'ember' ? emberRings : frostRings).getMatrixAt(0, matrix);
      assert.ok(matrix.elements[13] > surface.point.y + .005, 'The preview also clears the same real floor');
      assert.equal(JSON.stringify(event), unchanged, 'The rendering module never mutates logical effect heights');
    }
    floorChecks.push(`${sample.name}:${surface.point.y.toFixed(3)}m`);
  }
  assert.ok(Math.abs(getZoneFloor(-44.25, 15, 3) - 2.89) < 1e-8, 'A ceiling below the overlapping upper canopy resolves the small awning');
  assert.ok(Math.abs(getZoneFloor(-44.25, 15, 4.49) - 3.725) < 1e-8, 'An overlapping upper canopy is selected only when it is below the targeting ceiling');
  const legacyColliders = normalizedLegacyColliders(arena.colliders);
  const originalArenaColliders = legacyColliders.filter(collider => !['railing', 'surface'].includes(collider.kind));
  const arenaRailColliders = legacyColliders.filter(collider => collider.kind === 'railing');
  const arenaSurfaceColliders = legacyColliders.filter(collider => collider.kind === 'surface');
  assert.equal(originalArenaColliders.length, 62, 'Visibility checks retain all62 original arena collision shapes');
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(originalArenaColliders)).digest('hex'), '2f1540d46ea80f52346b34fd07452fccbc8bb8551daa207c2d342db937a056be', 'The existing floor and cover collisions remain identical despite added handrail protection');
  assert.equal(arenaRailColliders.length, 87, 'The real map adds upper handrail collision without replacing its original geometry');
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(arenaRailColliders)).digest('hex'), 'e3778031958951695436040ea1e6a826febdb4303f08cdea9f2ff1b478cead12', 'The approved handrail collisions remain unchanged when roof support is added');
  assert.equal(arenaSurfaceColliders.length, 30, 'Visible roofs, seats and the connecting sill gain independent support slabs');
  assert.equal(arena.colliders.length, 192, 'Ten new buildings and three awning supports append after the179 verified old shapes');
  const invalid = [null, {}, { ...ember, type: 'unknown' }, { ...ember, id: '' }, { ...ember, x: Infinity }, { ...ember, x: 1001 }, { ...ember, y: NaN }, { ...ember, radius: 99 }, { ...ember, endsAt: 11 }, { ...ember, startedAt: -1 }];
  fx.update(invalid, 11); assert.equal(fx.group.visible, false); fx.update([ember], NaN); assert.equal(fx.group.visible, false);
  for (let i = 0; i < 500; i++) fx.update(i % 4 ? [ember, frost] : [], 10 + (i % 480) / 100, { reducedMotion: i % 3 === 0 });
  let index = 0;
  for (const mesh of fx.group.children) { assert.equal(mesh.instanceMatrix.array, buffers[index++]); assert.equal(mesh.geometry.getAttribute('fxOpacity').array, buffers[index++]); }
  for (const count of resources.values()) assert.equal(count, 0, 'Updates do not dispose still-owned pooled resources');
  fx.group.position.set(2, 3, 4); fx.reset(); fx.reset(); assert.equal(fx.group.visible, false); assert.deepEqual(fx.group.position.toArray(), [2, 3, 4]);
  fx.update([ember, frost], 12.5); assert.equal(fx.group.visible, true); fx.dispose(); fx.dispose();
  assert.equal(scene.children.length, 0); assert.equal(fx.group.visible, false);
  for (const count of resources.values()) assert.equal(count, 1, 'Instance buffers, geometry and materials are released exactly once');
  fx.update([ember], 11); assert.equal(fx.group.visible, false); assert.ok(fx.group.children.every(mesh => mesh.count === 0));
  console.log(`PASS real floor clearance: ${floorChecks.join(' / ')}; logical event heights unchanged; normalized FROST geometry/color hash retained`);
  console.log(`PASS zone FX: ${maxDraws} fixed draws / ${maxTriangles.toLocaleString('en-US')} max event triangles (+192 preview) / ${poolSize} pooled instances / ${poolBytes.toLocaleString('en-US')} instance bytes / 7 geometries / 7 materials / 0 textures; warning,3 feathered EMBER flares,unchanged FROST,preview,expiry,join,duplicates,reduced-motion,500 updates,disposal clean`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
