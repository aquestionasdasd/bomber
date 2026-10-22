const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

async function main() {
  const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);
  const [THREE, {createStationTakeover}, {createMap}] = await Promise.all([
    load('vendor/three.module.js'), load('station-takeover.js'), load('map.js'),
  ]);
  let canvasCount = 0;
  const context = new Proxy({measureText: text => ({width: String(text).length * 8})}, {
    get: (target, key) => target[key] || (() => {}),
  });
  global.document = {createElement() { canvasCount++; return {getContext: () => context}; }};

  const effect = createStationTakeover(THREE);
  assert.equal(canvasCount, 1, 'All station paint shares one generated texture');
  const renderables = [];
  effect.group.traverse(object => { if (object.isMesh || object.isPoints) renderables.push(object); });
  assert.equal(renderables.length, 1, 'The whole takeover adds one draw call');
  const paint = renderables[0];
  assert.ok(paint.isInstancedMesh);
  assert.ok(paint.count >= 32 && paint.count <= 40, 'A fixed station-sized decal budget cannot grow per event');
  const {geometry, material} = paint, texture = material.map;
  const triangles = geometry.index.count / 3 * paint.count;
  assert.ok(triangles <= 80);
  assert.equal(material.emissiveMap, texture, 'Color and emission share the same texture');
  assert.equal(texture.image.width, 512); assert.equal(texture.image.height, 512);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(material.transparent, true); assert.equal(material.depthWrite, false);
  assert.equal(material.depthTest, true, 'Station geometry must still occlude paint at the correct world depth');
  const drawCalls = material.transparent && material.side === THREE.DoubleSide && !material.forceSinglePass ? 2 : 1;
  assert.equal(drawCalls, 1, 'Double-sided transparent planes must explicitly avoid the renderer\'s two-pass path');
  assert.equal(paint.castShadow, false); assert.equal(paint.userData.solid, false);
  const hits = [];
  paint.raycast(new THREE.Raycaster(), hits);
  assert.deepEqual(hits, [], 'Station paint cannot intercept a bullet or a visibility ray');

  const resources = [geometry, material, texture, paint];
  const disposals = new Map(resources.map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1));
  const matrixBuffer = paint.instanceMatrix.array;
  const matrixValues = Array.from(matrixBuffer);
  const textureVersion = texture.version, matrixVersion = paint.instanceMatrix.version;
  const initialObjects = effect.group.children.slice();
  const originalPosition = effect.group.position.toArray();
  assert.ok(matrixValues.every(Number.isFinite));
  assert.ok(Number.isFinite(paint.boundingSphere.radius) && paint.boundingSphere.radius > 30);

  function frame(time) {
    const visible = effect.update(time);
    assert.equal(visible, effect.group.visible);
    assert.ok(Number.isFinite(material.opacity) && material.opacity >= 0 && material.opacity <= 1);
    return {visible, opacity: material.opacity};
  }
  function close(actual, expected, message) { assert.ok(Math.abs(actual - expected) < 1e-10, message); }
  assert.deepEqual(frame(0), {visible: false, opacity: 0});
  const event = {id: 'round-4-nope', round: 4, startedAt: 100, endsAt: 112};
  const callerData = {...event};
  effect.start(callerData); callerData.startedAt = 0; callerData.endsAt = 1;
  assert.deepEqual(frame(99.999), {visible: false, opacity: 0}, 'A future event cannot paint the station early');
  assert.deepEqual(frame(100), {visible: true, opacity: 0});
  close(frame(100.11).opacity, .5, 'The appearance fades over220ms without a flash');
  assert.deepEqual(frame(100.25), {visible: true, opacity: 1});
  assert.deepEqual(frame(106), {visible: true, opacity: 1});
  close(frame(111.65).opacity, .5, 'The final700ms fade follows the shared end timestamp');
  assert.deepEqual(frame(112), {visible: false, opacity: 0});
  assert.deepEqual(frame(132), {visible: false, opacity: 0}, 'An expired reconnect cannot replay the effect');
  const direct = frame(100.11);
  effect.start(event);
  for (let index = 0; index < 180; index++) frame(100 + index / 30);
  assert.deepEqual(frame(100.11), direct, 'A frame depends only on absolute time, not update order or rate');
  frame(120);
  assert.deepEqual(frame(100.11), direct, 'A clock rewind deterministically reconstructs the same fade');

  const late = createStationTakeover(THREE);
  const latePaint = late.group.children[0];
  late.start({...event});
  assert.equal(late.update(106), true);
  assert.equal(latePaint.material.opacity, 1, 'Mid-event joins begin at the current state rather than replaying the opening fade');
  assert.deepEqual(Array.from(latePaint.instanceMatrix.array), matrixValues, 'Peers use identical world-space placements');
  assert.equal(late.update(132), false);
  assert.equal(latePaint.material.opacity, 0);
  late.dispose();
  const generatedCanvases = canvasCount;
  for (let round = 0; round < 100; round++) {
    effect.start({...event, id: `round-${round}`, startedAt: round * 20, endsAt: round * 20 + 12});
    for (let index = 0; index <= 120; index++) frame(round * 20 + index / 10);
    effect.reset();
    assert.deepEqual(frame(round * 20 + 1), {visible: false, opacity: 0});
  }
  assert.equal(canvasCount, generatedCanvases, 'Updates and resets cannot allocate textures or canvases');
  assert.deepEqual(effect.group.children, initialObjects);
  assert.equal(paint.geometry, geometry); assert.equal(paint.material, material);
  assert.equal(material.map, texture); assert.equal(material.emissiveMap, texture);
  assert.equal(paint.instanceMatrix.array, matrixBuffer);
  assert.equal(texture.version, textureVersion, 'Static paint cannot trigger a texture upload every frame');
  assert.equal(paint.instanceMatrix.version, matrixVersion, 'Static paint cannot upload instance transforms every frame');
  assert.deepEqual(Array.from(matrixBuffer), matrixValues, 'The fixed logo placements never accumulate transforms');
  assert.deepEqual(effect.group.position.toArray(), originalPosition);
  for (const count of disposals.values()) assert.equal(count, 0, 'Round reset hides reusable resources without disposing them');

  // Inspect real station geometry rather than assuming a collision box is the visible wall.
  // Opaque portions at both sides of the large upper-front logos must stay on the facade.
  const map = createMap(THREE, new THREE.Scene());
  const colliderState = JSON.stringify(map.colliders);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), normal = new THREE.Vector3();
  const scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
  let inspectedSurfaces = 0, roofs = 0, canopies = 0, interior = 0;
  for (let index = 0; index < paint.count; index++) {
    paint.getMatrixAt(index, matrix); matrix.decompose(position, rotation, scale);
    normal.set(0, 0, 1).transformDirection(matrix);
    const isHorizontal = normal.y > .99;
    const isInterior = Math.abs(normal.x) > .99;
    const isUpperFront = normal.z > .99 && position.y > 6;
    if (!isHorizontal && !isInterior && !isUpperFront) continue; // Lower logos may naturally sit behind ticket machines.
    if (isHorizontal) { if (position.y > 12) roofs++; else canopies++; }
    if (isInterior) interior++;
    const samples = isUpperFront && scale.x > 5 ? [-.28, 0, .28] : [0];
    for (const offset of samples) {
      const point = position.clone().add(new THREE.Vector3(offset * scale.x, isUpperFront && scale.x > 5 ? .1 * scale.y : 0, 0));
      const reach = isHorizontal ? 12 : 2;
      const ray = new THREE.Raycaster(point.clone().addScaledVector(normal, reach), normal.clone().negate(), 0, reach + 1);
      const surface = ray.intersectObject(map.world, true)[0];
      assert.ok(surface, `Station logo${index} has no building behind its opaque center/edge at${point.toArray()}`);
      assert.ok(surface.distance >= reach - .025,
        `Station logo${index} is buried${(reach - surface.distance).toFixed(3)}m inside the visible station surface`);
      assert.ok(surface.distance <= reach + .8, 'A facade logo must remain close to an actual station surface');
      if (surface.object.material.transparent && !surface.object.material.depthWrite) {
        assert.ok(paint.renderOrder > surface.object.renderOrder,
          'One paint instance batch must draw after transparent station signs, which cannot occlude nearer paint by sorting as a whole');
      }
      inspectedSurfaces++;
    }
  }
  assert.equal(canopies, 6); assert.ok(roofs >= 10); assert.equal(interior, 6);
  const probeOrigin = new THREE.Vector3(-46, 8.4, -20);
  const bulletRay = new THREE.Raycaster(probeOrigin, new THREE.Vector3(0, 0, -1));
  const scene = new THREE.Scene(); scene.add(map.world);
  const beforePaint = bulletRay.intersectObject(scene, true).map(hit => hit.distance);
  scene.add(effect.group); effect.start(event); effect.update(106); scene.updateMatrixWorld(true);
  assert.deepEqual(bulletRay.intersectObject(scene, true).map(hit => hit.distance), beforePaint,
    'Adding an active takeover leaves the actual station bullet intersections unchanged');
  assert.equal(JSON.stringify(map.colliders), colliderState, 'Painting cannot alter the map collision or routes');

  effect.dispose();
  assert.equal(effect.group.visible, false); assert.equal(effect.group.children.length, 0);
  for (const count of disposals.values()) assert.equal(count, 1, 'The geometry, material, texture and instance buffer each receive one disposal');
  effect.dispose(); effect.start(event);
  assert.deepEqual(frame(106), {visible: false, opacity: 0});
  for (const count of disposals.values()) assert.equal(count, 1, 'Repeated disposal is safe and cannot revive the retired effect');
  console.log('PASS: bounded station paint, absolute-time fades, mid-event/expired joins,100 resets, no ray/collision interference, real facade/roof placement and complete idempotent disposal');
  console.log(JSON.stringify({drawCalls, instances: paint.count, triangles, geometries: 1, materials: 1, textures: 1, inspectedSurfaces, roofs, canopies, interior}));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
