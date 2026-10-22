const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

async function main() {
  const testStarted = performance.now(), cpuStarted = process.cpuUsage();
  const THREE = await import(pathToFileURL(path.join(__dirname, 'public/vendor/three.module.js')).href);
  const { createMap } = await import(pathToFileURL(path.join(__dirname, 'public/map.js')).href);
  const { createCollisionIndex } = await import(pathToFileURL(path.join(__dirname, 'public/collision.js')).href);
  const { createNavigation } = await import(pathToFileURL(path.join(__dirname, 'public/navigation.js')).href);
  const gameSource = fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8');
  const context2d = new Proxy({ measureText: text => ({ width: String(text).length * 8 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }, { get(target, key) { return target[key] || (() => {}); } });
  const elements = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const buyCards = ['classic', 'ghost', 'spectre', 'vandal', 'phantom', 'light', 'heavy'].map(id => {
    const card = makeElement(`buy-${id}`); card.dataset = { buy: id }; return card;
  });
  const document = {
    hidden: false, pointerLockElement: null,
    createElement: tag => makeElement(tag),
    getElementById: id => {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    querySelectorAll: selector => selector === '[data-buy]' ? buyCards : [],
    exitPointerLock() { this.pointerLockElement = null; },
  };
  function makeElement(id) {
    const e = {
      id, hidden: false, textContent: '', width: 240, height: 240, children: [], value: id === 'difficulty' ? 'normal' : '',
      listeners: new Map(),
      style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(listener);
      }, getContext: () => context2d,
      attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, setPointerCapture() {}, requestPointerLock() { document.pointerLockElement = e; },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      replaceChildren(...nodes) { for (const child of this.children) child.parentNode = null; this.children = nodes; for (const child of nodes) child.parentNode = this; },
      append(node) { this.children.push(node); node.parentNode = this; }, prepend(node) { this.children.unshift(node); node.parentNode = this; },
      get lastElementChild() { return this.children.at(-1); },
      remove() { if (!this.parentNode) return; const siblings = this.parentNode.children, index = siblings.indexOf(this); if (index >= 0) siblings.splice(index, 1); this.parentNode = null; },
    };
    return e;
  }
  global.document = document;
  const imported = {};
  for (const declaration of gameSource.matchAll(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/gm)) {
    const module = await import(pathToFileURL(path.resolve(__dirname, 'public', declaration[2])).href);
    for (const binding of declaration[1].split(',')) {
      const [source, alias] = binding.trim().split(/\s+as\s+/);
      imported[alias || source] = module[source];
    }
  }
  Object.assign(imported,await import(pathToFileURL(path.join(__dirname,'public/abilities.js')).href));
  const {DUELIST,DUELIST_SKILLS,NOPE_SKILLS,MEND_SKILLS,IAGNU_SKILLS,VEIL_SKILLS,EMBER_SKILLS,FROST_SKILLS}=imported;
  const mapScene = new THREE.Group(), mapBuildStarted = performance.now();
  const map = createMap(THREE, mapScene), mapBuildMs = performance.now() - mapBuildStarted;
  const arenaWidth = map.bounds.maxX - map.bounds.minX, arenaDepth = map.bounds.maxZ - map.bounds.minZ;
  assert.ok(arenaWidth >= 140 && arenaWidth <= 180, `The compact arena width must remain near150–170m, got ${arenaWidth}m`);
  assert.ok(arenaDepth >= 140 && arenaDepth <= 180, `The compact arena depth must remain near150–170m, got ${arenaDepth}m`);
  assert.deepEqual(map.sites.map(site => site.id).sort(), ['A', 'B'], 'The arena must have exactlytwo spike sites');
  assert.equal(map.lanes?.length, 3, 'The arena must expose its three intended playable lanes');
  assert.ok(map.landmarks?.length >= 3, 'Practice mode must provide local arena arrival points');
  map.collision ||= createCollisionIndex(map.colliders);
  const standable = (x, z, radius = .4) => x >= map.bounds.minX + radius && x <= map.bounds.maxX - radius && z >= map.bounds.minZ + radius && z <= map.bounds.maxZ - radius && !map.collision.blocked(x, z, radius, 0);
  assert.ok(map.colliders.length >= 20, 'Map must include combat cover and building collision.');
  const spawnEntries = [['player', map.spawn], ...Object.entries(map.teamSpawns || {}).flatMap(([side, points]) => points.map((point, i) => [`${side} spawn ${i + 1}`, point]))];
  for (const [label, spawn] of spawnEntries) {
    assert.ok(Number.isFinite(spawn.x) && Number.isFinite(spawn.z), `${label} has finite coordinates`);
    assert.ok(standable(spawn.x, spawn.z), `${label} cannot start inside a wall, planter, or cover`);
  }
  for (const side of ['attack', 'defend']) {
    const positions = map.teamSpawns[side], area = map.buyAreas[side];
    assert.equal(positions.length, 5, `${side} must have five spawn positions`);
    assert.equal(new Set(positions.map(p => `${p.x.toFixed(3)},${p.z.toFixed(3)}`)).size, 5, `${side} teammates must have separate spawn positions`);
    assert.ok(Number.isFinite(map.spawnYaw[side]), `${side} must define its initial view direction`);
    for (const p of positions) assert.ok(Math.hypot(p.x - area.x, p.z - area.z) < area.radius - .4, `${side} spawns must fit inside the purchase area`);
  }
  // Check the real playable geometry; the controlled fixture below covers game mechanics separately.
  const navBoot = performance.now(), arenaNavigation = createNavigation(map), navBootMs = performance.now() - navBoot;
  assert.ok(navBootMs < 1000, `Arena navigation must initialize promptly, took ${navBootMs.toFixed(0)}ms`);
  function checkRoute(from, to, label) {
    assert.ok(arenaNavigation.isWalkable(from.x,from.z)&&arenaNavigation.isWalkable(to.x,to.z),`${label} actual endpoints must be clear without nearest() concealing a blocked doorway`);
    const route = arenaNavigation.path(from.x, from.z, to.x, to.z);
    assert.ok(route.length, `${label} must have a usable route`);
    let previous = from, distance = 0;
    for (const point of route) {
      assert.ok(arenaNavigation.isWalkable(point.x, point.z), `${label} waypoints must clear cover and buildings`);
      assert.ok(arenaNavigation.clearSegment(previous.x, previous.z, point.x, point.z), `${label} must not cut through a building or cover`);
      distance += Math.hypot(point.x - previous.x, point.z - previous.z);
      previous = point;
    }
    const destination = arenaNavigation.nearest(to.x, to.z);
    assert.ok(Math.hypot(previous.x - destination.x, previous.z - destination.z) < .01, `${label} must reach its destination`);
    return { route, distance, seconds: distance / (5.4*1.15) };
  }
  const routeChecksStarted = performance.now();
  for (const [label, spawn] of spawnEntries) for (const site of map.sites) {
    const result = checkRoute(spawn, site, `${label} → site ${site.id}`);
    assert.ok(result.distance <= 220, `${label} → ${site.id} must not require a city-length approach (${result.distance.toFixed(1)}m)`);
  }
  const timing = [];
  for (const side of ['attack', 'defend']) for (const site of map.sites) {
    const result = checkRoute(map.teamSpawns[side][0], site, `${side} timing → ${site.id}`);
    timing.push(`${side}→${site.id} ${result.distance.toFixed(0)}m/${result.seconds.toFixed(1)}s`);
  }
  assert.ok(Math.hypot(map.sites[0].x - map.sites[1].x, map.sites[0].z - map.sites[1].z) >= 40, 'The two spike sites must occupy distinct parts of the arena');
  for (const [from, to] of [[map.sites[0], map.sites[1]], [map.sites[1], map.sites[0]]]) {
    const result = checkRoute(from, to, `Site ${from.id} → ${to.id} rotation`);
    assert.ok(result.distance <= 180, `Site rotation must remain practical inside a45-second planted-spike round (${result.distance.toFixed(1)}m)`);
    timing.push(`${from.id}→${to.id} ${result.distance.toFixed(0)}m/${result.seconds.toFixed(1)}s`);
  }
  const laneMiddles = [];
  for (const lane of map.lanes) {
    assert.ok(lane.points?.length >= 3, `${lane.name || lane.id} must define entry, middle, and exit points`);
    const points = lane.points.map(point => Array.isArray(point) ? { x: point[0], z: point[1] } : point);
    laneMiddles.push(points[Math.floor(points.length / 2)]);
    let distance = 0;
    for (const point of points) assert.ok(standable(point.x, point.z), `${lane.name || lane.id} intended path must stay open`);
    for (let i = 1; i < points.length; i++) {
      const result = checkRoute(points[i - 1], points[i], `${lane.name || lane.id} segment ${i}`);
      const direct = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
      assert.ok(result.distance <= Math.max(15, direct * 1.8), `${lane.name || lane.id} must remain a local route instead of detouring through another lane`);
      distance += result.distance;
    }
    timing.push(`${lane.name || lane.id} ${distance.toFixed(0)}m/${(distance / (5.4*1.15)).toFixed(1)}s`);
  }
  for (let i = 0; i < laneMiddles.length; i++) for (let j = i + 1; j < laneMiddles.length; j++) assert.ok(Math.hypot(laneMiddles[i].x - laneMiddles[j].x, laneMiddles[i].z - laneMiddles[j].z) >= 20, 'The three lanes must occupy distinct corridors');
  for (const landmark of map.landmarks || []) {
    const destination = arenaNavigation.nearest(landmark.travelX ?? landmark.x, landmark.travelZ ?? landmark.z);
    assert.ok(destination && standable(destination.x, destination.z), `${landmark.name} arrival must be safe`);
    checkRoute(map.spawn, destination, `${landmark.name} practice route`);
  }
  assert.ok(map.rangeArea?.targets?.length >= 4, 'The shooting range must provide several real arena target positions');
  assert.ok(standable(map.rangeArea.spawn.x, map.rangeArea.spawn.z), 'The range player must start clear of the station geometry');
  for (const point of map.rangeArea.targets) {
    assert.ok(standable(point.x, point.z), 'Range targets must stand outside solid map geometry');
    assert.equal(map.collision.rayClear(map.rangeArea.spawn.x, 1.7, map.rangeArea.spawn.z, point.x, 1.62, point.z), true, 'Every range target must be visible from the starting firing line');
  }
  const routeChecksMs = performance.now() - routeChecksStarted;
  const {TACTICAL_BUILDINGS}=await import(pathToFileURL(path.join(__dirname,'public/tactical-layout.js')).href);
  const tacticalLayout=require('./tests-tactical-layout.cjs').inspectTacticalLayout(map,arenaNavigation,THREE,TACTICAL_BUILDINGS);
  console.log(`PASS: winding corridor topology ${JSON.stringify(tacticalLayout)}`);
  let meshCount = 0, instanceCount = 0;
  mapScene.traverse(object => { if (object.isMesh) meshCount++; if (object.isInstancedMesh) instanceCount += object.count; });
  console.log(`PASS: ${spawnEntries.length} arena spawns, both sites, site rotations, three lanes, and ${map.landmarks.length} practice routes`);
  console.log(`ARENA: ${arenaWidth}×${arenaDepth}m, ${meshCount} meshes, ${instanceCount} instances; build ${mapBuildMs.toFixed(1)}ms, navigation boot ${navBootMs.toFixed(1)}ms, route checks ${routeChecksMs.toFixed(1)}ms`);
  console.log(`WALKING AT(5.4*1.15)m/s: ${timing.join('; ')}`);

  const geometryColliders = [{ minX: -10, maxX: 10, minZ: -10, maxZ: 10, height: 6,
    polygon: [[-10, 0], [0, -10], [10, 0], [0, 10]], holes: [[[-2, -2], [2, -2], [2, 2], [-2, 2]]] }];
  const geometryIndex = createCollisionIndex(geometryColliders);
  assert.equal(geometryIndex.blocked(9, 9), false, 'An empty corner inside a rotated footprint AABB must remain passable');
  assert.equal(geometryIndex.blocked(5, 0), true, 'The real polygon interior must block movement');
  assert.equal(geometryIndex.blocked(0, 0), false, 'A courtyard hole must remain passable');
  assert.equal(geometryIndex.blocked(1.8, 0), true, 'The actor radius must collide with a courtyard wall');
  assert.equal(geometryIndex.segmentClear(8, 8, 12, 8), true);
  assert.equal(geometryIndex.segmentClear(-12, 0, 12, 0), false, 'Long segments must not cross polygon walls');
  assert.equal(geometryIndex.segmentClear(-1, 0, 1, 0), true, 'Segments wholly inside a courtyard must remain clear');
  geometryColliders.push({ minX: 19, maxX: 21, minZ: -4, maxZ: 4, height: 8, base: 4 });
  assert.equal(geometryIndex.blocked(20, 0), false, 'An elevated bridge must allow a ground-level passage');
  assert.equal(geometryIndex.blocked(20, 0, .34, 3), true, 'The actor head must collide with the underside when high enough');
  assert.equal(geometryIndex.segmentClear(18, 0, 22, 0), true);
  geometryColliders.pop(); geometryColliders.push({ minX: 29, maxX: 31, minZ: -4, maxZ: 4, height: 2 });
  assert.equal(geometryIndex.blocked(30, 0), true, 'Replacing the appended collider must refresh the spatial index');
  assert.equal(geometryIndex.blocked(20, 0), false);
  assert.equal(geometryIndex.blocked(30, 0, .34, 2), false, 'A collider top must support walking rather than block it');
  const thinWall = [{ minX: 0, maxX: .04, minZ: -8, maxZ: 8, height: 3 }];
  const wallNav = createNavigation({ colliders: thinWall, bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 } });
  const wallRoute = wallNav.path(-6, 0, 6, 0);
  assert.ok(wallRoute.length > 1, 'Routing must detour around a sub-cell-width wall');
  let wallPrevious = { x: -6, z: 0 };
  for (const point of wallRoute) { assert.ok(wallNav.clearSegment(wallPrevious.x, wallPrevious.z, point.x, point.z)); wallPrevious = point; }
  const corridorNav = createNavigation({ colliders: [{ minX: -8, maxX: -.9, minZ: -10, maxZ: 10, height: 3 }, { minX: .9, maxX: 8, minZ: -10, maxZ: 10, height: 3 }], bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 } });
  assert.ok(corridorNav.path(0, -9, 0, 9).length, 'A narrow footway must not disappear in navigation');
  const fallbackNav = createNavigation({ colliders: [{ minX: -10, maxX: 10, minZ: -200, maxZ: -1, height: 3 }, { minX: -10, maxX: 10, minZ: 1, maxZ: 200, height: 3 }], bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 } });
  const narrowRoute = fallbackNav.path(-60, 20, 60, -20);
  assert.ok(narrowRoute.length, 'Long trips must fall back to one-metre routing when only a 2m footway connects the regions');
  let narrowPrevious = { x: -60, z: 20 };
  for (const point of narrowRoute) { assert.ok(fallbackNav.clearSegment(narrowPrevious.x, narrowPrevious.z, point.x, point.z)); narrowPrevious = point; }
  console.log('PASS: exact rotated footprints, courtyards, overhead passages, spatial-index refresh, thin walls, and narrow footways');

  // Walking occupies a volume; sight occupies a single three-dimensional segment.
  const sightIndex = createCollisionIndex([
    { minX: -1, maxX: 1, minZ: -1, maxZ: 1, base: 2.8, height: 3.2 },
    { minX: 4, maxX: 5, minZ: -1, maxZ: 1, height: 1.2 },
  ]);
  assert.equal(sightIndex.rayClear(-2, 1.62, 0, 2, 1.62, 0), true, 'Eyes below a pedestrian deck must see through its ground passage');
  assert.equal(sightIndex.rayClear(-2, 3, 0, 2, 3, 0), false, 'A ray through the actual deck slab must be blocked');
  assert.equal(sightIndex.rayClear(0, 4.82, 0, 3, 1.62, 0), true, 'A descending sight line must use its interpolated height rather than the lower endpoint height');
  assert.equal(sightIndex.rayClear(3, 1.62, 0, 6, 1.62, 0), true, 'Standing eyes must see over low cover');
  assert.equal(sightIndex.rayClear(3, 1.1, 0, 6, 1.1, 0), false, 'The same low cover must block a lower ray');
  assert.equal(sightIndex.rayClear(NaN, 1, 0, 1, 1, 0), false, 'Invalid sight coordinates must fail closed');
  console.log('PASS: deck underpasses, slab obstruction, low-cover sight, and height-aware sight lines');

  // Gameplay is exercised in a controlled scene so environment edits cannot invalidate weapon/input tests.
  function createFixtureMap(T, scene) {
    const colliders = [], addCover = (x, z, w, d, height) => {
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height });
      const mesh = new T.Mesh(new T.BoxGeometry(w, height, d), new T.MeshBasicMaterial());
      mesh.position.set(x, height / 2, z); mesh.userData.solid = true; scene.add(mesh);
    };
    addCover(-15.4, 16.9, 4, .95, 1.06); addCover(8, 13, 3, 3, 2);
    scene.updateMatrixWorld(true);
    return { colliders, collision: createCollisionIndex(colliders), bounds: { minX: -42, maxX: 42, minZ: -42, maxZ: 42 },
      spawn: { x: 0, z: 26, yaw: 0 }, spawnYaw: { attack: 0, defend: Math.PI },
      teamSpawns: { attack: [{ x: 0, z: 26 }, { x: -2, z: 28 }, { x: 2, z: 28 }, { x: -4, z: 30 }, { x: 4, z: 30 }],
        defend: [{ x: -9, z: -16 }, { x: -3, z: -23 }, { x: 0, z: -29 }, { x: 3, z: -23 }, { x: 9, z: -16 }] },
      buyAreas: { attack: { x: 0, z: 26, radius: 7 }, defend: { x: 0, z: -23, radius: 15 } },
      sites: [{ id: 'A', x: 0, z: -18, radius: 5 }, { id: 'B', x: 17, z: 12, radius: 4.5 }], zones: [], mapShapes: [], ramps: [],
      landmarks: [{ id: 'north', name: '北口テスト地点', x: 0, z: 26 }, { id: 'south', name: '南口テスト地点', x: -10, z: -10 }],
      rangeArea: { spawn: { x: 0, z: 2, yaw: 0 }, targets: [{ x: -3, z: -10 }, { x: 0, z: -12 }, { x: 3, z: -10 }] },
    };
  }

  class Renderer {
    constructor() { this.shadowMap = {}; this.info = { render: { calls: 0 } }; this.capabilities = { getMaxAnisotropy: () => 8 }; }
    setPixelRatio() {} setSize() {} render() {} getContext() { return {}; }
  }
  const localValues = new Map(), localWrites = [];
  // Model one recipient's transport inbox. A host frame now contains separate
  // team-private packets; delivering both would bypass the real RoomClient filter.
  function capturePeerPacket(packet, { team } = {}) {
    const recipient = this.room.members.find(member => member.id === 'friend');
    // Departure fixtures intentionally inspect the former guest's final cleanup
    // state. Retain its last team here; real departed recipients are excluded by
    // RoomClient and the authenticated relay tests, independently of this inbox.
    if (recipient) this.testRecipientTeam = recipient.team;
    if (team === undefined || team === this.testRecipientTeam) this.sent.push(packet);
  }
  const sandbox = {
    ...imported,
    capturePeerPacket,
    THREE: { ...THREE, WebGLRenderer: Renderer }, createMap: createFixtureMap, document,
    window: { addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(listener);
    } }, navigator: { maxTouchPoints: 0 },
    matchMedia: () => ({ matches: false }), localStorage: { getItem: key => localValues.get(key) ?? null, setItem(key, value) { localValues.set(key, String(value)); localWrites.push({ key, value: String(value) }); } },
    devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900, performance: { now: () => 0 },
    setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame() {},
    HTMLInputElement: class {}, HTMLSelectElement: class {}, HTMLTextAreaElement: class {}, console,
  };
  vm.createContext(sandbox);
  const runnable = gameSource.replace(/^import .*;\r?\n/gm, '');
  vm.runInContext(runnable, sandbox, { filename: 'game.js' });
  const run = code => vm.runInContext(code, sandbox);
  const arena = run('map');
  const dispatchDocument = (type, event) => {
    assert.ok(documentListeners.has(type), `Game must register ${type} input`);
    for (const listener of documentListeners.get(type)) listener(event);
  };
  const dispatchElement = (element, type, event = {}) => {
    assert.ok(element.listeners.has(type), `#${element.id} must register ${type} input`);
    for (const listener of element.listeners.get(type)) listener(event);
  };
  const dispatchWindow = (type, event = {}) => {
    assert.ok(windowListeners.has(type), `Game must register window ${type} input`);
    for (const listener of windowListeners.get(type)) listener(event);
  };
  const assertNear = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
  run('startGame()');
  assert.equal(run('mode'), 'play'); assert.equal(run('bots.length'), 9);
  assert.equal(run('aliveCount("blue")'), 5); assert.equal(run('aliveCount("red")'), 5);
  assert.equal(run('player.ammo'), 12); assert.equal(run('player.hp'), 100);
  assert.equal(run('match.phase'), 'buy'); assert.equal(run('inventory.active'), 'classic');
  run('openShop()');
  assert.equal(document.getElementById('start-round').hidden, false, 'Solo buying must retain its manual round-start control');
  run('resumeGame()');
  run('shoot()');
  assert.equal(run('player.ammo'), 12, 'Buy phase must block firing');
  // The in-app browser cannot always lock the pointer: an ordinary mouse move must still aim.
  run('locked=false;document.pointerLockElement=null;player.yaw=0;player.pitch=0');
  dispatchDocument('pointerlockchange', {});
  const canvas = document.getElementById('game');
  const mouseMove = (clientX, clientY, movementX = 0, movementY = 0, timeStamp) => dispatchDocument('mousemove', { target: canvas, buttons: 0, clientX, clientY, movementX, movementY, timeStamp });
  assert.equal(run('sensitivity'), .35, 'The default sensitivity must be reduced from the original 1.0');
  mouseMove(400, 300, 9000, -9000);
  assert.equal(run('player.yaw'), 0, 'The first unlocked event must seed a position instead of turning');
  assert.equal(run('player.pitch'), 0, 'Entering the canvas must not jump the vertical aim');
  mouseMove(430, 280, 9000, 9000);
  assert.ok(run('player.yaw') < 0, 'Unlocked mouse movement must turn horizontally without dragging');
  assert.ok(run('player.pitch') > 0, 'Unlocked mouse movement must aim vertically without dragging');
  assertNear(run('player.yaw'), -30 * .002 * .35, 'Unlocked aiming must use client-coordinate deltas rather than anomalous movementX');
  assertNear(run('player.pitch'), 20 * .002 * .35, 'Unlocked aiming must use client-coordinate deltas rather than anomalous movementY');
  assert.equal(run('firing'), false, 'Aiming without buttons must not shoot');
  const initialAim = [run('player.yaw'), run('player.pitch')];
  mouseMove(NaN, Infinity, NaN, Infinity);
  assert.deepEqual([run('player.yaw'), run('player.pitch')], initialAim, 'Nonfinite unlocked coordinates must not corrupt the camera');
  dispatchElement(canvas, 'mouseleave');
  mouseMove(20, 20, -10000, -10000);
  assert.deepEqual([run('player.yaw'), run('player.pitch')], initialAim, 'Re-entering the canvas must establish a new baseline');
  mouseMove(30, 15);
  assertNear(run('player.yaw'), initialAim[0] - 10 * .002 * .35, 'Normal unlocked movement resumes after re-entry');
  const beforeWarp = [run('player.yaw'), run('player.pitch')];
  mouseMove(2030, 2015);
  assert.deepEqual([run('player.yaw'), run('player.pitch')], beforeWarp, 'A large coordinate warp must not snap the camera');
  mouseMove(2031, 2016);
  assert.ok(Number.isFinite(run('player.pitch')), 'Aiming must recover after a rejected unlocked warp');
  run('document.pointerLockElement=canvas');
  dispatchDocument('pointerlockchange', {});
  const beforeLock = [run('player.yaw'), run('player.pitch')];
  mouseMove(0, 0, 10000, -10000);
  assert.deepEqual([run('player.yaw'), run('player.pitch')], beforeLock, 'The first event after pointer lock must be ignored');
  mouseMove(0, 0, 10, -5);
  assertNear(run('player.yaw'), beforeLock[0] - 10 * .002 * .35, 'Locked aiming must use relative horizontal movement');
  assertNear(run('player.pitch'), beforeLock[1] + 5 * .002 * .35, 'Locked aiming must use relative vertical movement');
  const validLockedAim = [run('player.yaw'), run('player.pitch')];
  for (const [dx, dy] of [[NaN, 10], [10, Infinity], [10000, 0], [0, -10000]]) mouseMove(0, 0, dx, dy);
  assert.deepEqual([run('player.yaw'), run('player.pitch')], validLockedAim, 'Nonfinite or warped relative deltas must leave both aim axes unchanged');
  run('document.pointerLockElement=null'); dispatchDocument('pointerlockchange', {});
  assert.equal(run('mode'), 'pause', 'Losing an active pointer lock must pause the match');
  run('resumeGame();locked=false;document.pointerLockElement=null');
  mouseMove(700, 500, 10000, 10000);
  assert.deepEqual([run('player.yaw'), run('player.pitch')], validLockedAim, 'Returning from an overlay must ignore the stale first position');
  mouseMove(710, 495);
  const beforeBlur = [run('player.yaw'), run('player.pitch')];
  dispatchWindow('blur'); assert.equal(run('mode'), 'pause');
  run('resumeGame();locked=false;document.pointerLockElement=null');
  mouseMove(100, 100, -10000, -10000);
  assert.deepEqual([run('player.yaw'), run('player.pitch')], beforeBlur, 'Returning to the window must not apply a stale mouse position');

  // Viewport recentering is not a fast flick. Filter only the contradictory
  // coordinate jump after relative deltas have proved reliable, retaining gain.
  const mouseAim = () => [run('player.yaw'), run('player.pitch')];
  const resetMouseProbe = () => run('locked=false;document.pointerLockElement=null;player.yaw=0;player.pitch=0;resetMouseLook()');
  for (const transition of ['resize', 'fullscreenchange']) {
    resetMouseProbe(); mouseMove(100, 100, 0, 0, 100); mouseMove(120, 110, 20, 10, 116);
    const previousAim = mouseAim();
    if (transition === 'resize') { sandbox.innerWidth = 1280; sandbox.innerHeight = 800; dispatchWindow('resize', {}); }
    else dispatchDocument('fullscreenchange', {});
    mouseMove(500, 400, 380, 290, 132);
    assert.deepEqual(mouseAim(), previousAim, `The first unlocked sample after ${transition} must seed without turning`);
    mouseMove(510, 390, 10, -10, 148);
    assertNear(run('player.yaw'), previousAim[0] - 10 * .002 * .35, `Horizontal aiming must resume after ${transition}`);
    assertNear(run('player.pitch'), previousAim[1] + 10 * .002 * .35, `Vertical aiming must resume after ${transition}`);
  }
  sandbox.innerWidth = 1440; sandbox.innerHeight = 900; dispatchWindow('resize', {});
  resetMouseProbe(); mouseMove(100, 100, 0, 0, 100); mouseMove(110, 105, 10, 5, 116);
  const beforeMouseGap = mouseAim();
  mouseMove(510, 405, 400, 300, 400);
  assert.deepEqual(mouseAim(), beforeMouseGap, 'An unlocked event after more than250ms of silence must reseed its coordinates');
  mouseMove(520, 395, 10, -10, 416);
  assertNear(run('player.yaw'), beforeMouseGap[0] - 10 * .002 * .35, 'Horizontal aiming resumes on the next timely sample');
  assertNear(run('player.pitch'), beforeMouseGap[1] + 10 * .002 * .35, 'Vertical aiming resumes on the next timely sample');
  for (const [cached, actual] of [[true, false], [false, true]]) {
    resetMouseProbe(); run(`locked=${cached};document.pointerLockElement=${actual ? 'canvas' : 'null'}`);
    mouseMove(100, 100, 0, 0, 600); const beforeMismatch = mouseAim();
    mouseMove(500, 400, 400, 300, 616);
    assert.deepEqual(mouseAim(), beforeMismatch, 'Neither coordinate stream may turn the view while actual and cached lock states disagree');
  }
  resetMouseProbe(); mouseMove(100, 100, 0, 0, 1000);
  mouseMove(110, 105, 10, 5, 1016); mouseMove(120, 110, 10, 5, 1032);
  const beforeModerateWarp = mouseAim();
  mouseMove(520, 510, 2, 1, 1048);
  assert.deepEqual(mouseAim(), beforeModerateWarp, 'A400px coordinate jump with a small trusted relative move must not turn either axis');
  mouseMove(530, 500, 10, -10, 1064);
  assertNear(run('player.yaw'), beforeModerateWarp[0] - 10 * .002 * .35, 'The rejected warp must update the horizontal anchor for immediate recovery');
  assertNear(run('player.pitch'), beforeModerateWarp[1] + 10 * .002 * .35, 'The rejected warp must update the vertical anchor for immediate recovery');
  resetMouseProbe(); mouseMove(100, 550, 0, 0, 2000);
  mouseMove(110, 545, 10, -5, 2016); mouseMove(120, 540, 10, -5, 2032);
  const beforeFastFlick = mouseAim();
  mouseMove(520, 340, 400, -200, 2048); mouseMove(920, 140, 400, -200, 2064);
  assertNear(run('player.yaw'), beforeFastFlick[0] - 800 * .002 * .35, 'Continuous fast unlocked flicks must keep their complete original horizontal gain');
  assertNear(run('player.pitch'), beforeFastFlick[1] + 400 * .002 * .35, 'Continuous fast unlocked flicks must keep their complete original vertical gain');
  resetMouseProbe(); mouseMove(100, 100, 9000, -9000, 2200);
  mouseMove(110, 105, 9000, 9000, 2216); mouseMove(120, 110, 9000, 9000, 2232);
  const beforeBrokenRelative = mouseAim(); mouseMove(520, 310, 9000, 9000, 2248);
  assertNear(run('player.yaw'), beforeBrokenRelative[0] - 400 * .002 * .35, 'A browser with consistently broken relative deltas must retain client-coordinate horizontal aiming');
  assertNear(run('player.pitch'), beforeBrokenRelative[1] - 200 * .002 * .35, 'A browser with consistently broken relative deltas must retain client-coordinate vertical aiming');

  // A contradictory warp can be smaller than64px or confined to one axis.
  // Discard only that axis. Its identified return uses trusted physical motion
  // so a real flick combined with viewport correction cannot be swallowed.
  resetMouseProbe();mouseMove(400,300,0,0,4000);mouseMove(401,301,1,1,4008);mouseMove(402,302,1,1,4016);
  const beforeSmallMouseWarp=mouseAim();
  mouseMove(403,342,1,1,4024);
  assertNear(run('player.yaw'),beforeSmallMouseWarp[0]-.002*.35,'A40px vertical warp must retain the simultaneous valid horizontal pixel');
  assertNear(run('player.pitch'),beforeSmallMouseWarp[1],'A trusted40px contradictory vertical warp must not jump the view');
  mouseMove(404,303,1,1,4032);
  assertNear(run('player.yaw'),beforeSmallMouseWarp[0]-2*.002*.35,'The reverse warp must retain its healthy horizontal axis too');
  assertNear(run('player.pitch'),beforeSmallMouseWarp[1]-.002*.35,'Returning from a transient40px warp preserves its real1px motion without an opposite jump');
  mouseMove(405,304,1,1,4040);
  assertNear(run('player.pitch'),beforeSmallMouseWarp[1]-2*.002*.35,'A normal vertical pixel resumes immediately after the warp pair');

  resetMouseProbe();mouseMove(400,300,0,0,4050);mouseMove(401,301,1,1,4058);mouseMove(402,302,1,1,4066);
  const beforeBoundaryMouseWarp=mouseAim();mouseMove(403,306,1,1,4074);
  assertNear(run('player.pitch'),beforeBoundaryMouseWarp[1],'A contradictory vertical jump exactly at4px must not move the view');
  mouseMove(404,303,1,1,4082);
  assertNear(run('player.pitch'),beforeBoundaryMouseWarp[1]-.002*.35,'The sub4px return from a rejected4px warp preserves only its real1px motion');
  mouseMove(405,304,1,1,4090);
  assertNear(run('player.pitch'),beforeBoundaryMouseWarp[1]-2*.002*.35,'The first genuine pixel after a boundary warp pair remains immediate');

  resetMouseProbe();mouseMove(400,300,0,0,4500);mouseMove(401,301,1,1,4508);mouseMove(402,302,1,1,4516);
  const beforeDelayedBoundaryWarp=mouseAim();mouseMove(403,306,1,1,4524);
  assertNear(run('player.pitch'),beforeDelayedBoundaryWarp[1],'The4px outbound warp must not change the vertical baseline');
  mouseMove(404,307,1,1,4532);
  assertNear(run('player.pitch'),beforeDelayedBoundaryWarp[1]-.002*.35,'A normal1px move between the outbound and return warps applies immediately');
  mouseMove(405,306,1,-1,4540);
  assertNear(run('player.pitch'),beforeDelayedBoundaryWarp[1],'A genuine1px reversal is not confused with a pending coordinate correction');
  mouseMove(406,303,1,1,4548);
  assertNear(run('player.pitch'),beforeDelayedBoundaryWarp[1]-.002*.35,'The delayed3px correction retains only its real1px motion after normal movement and a true reversal');
  mouseMove(407,304,1,1,4556);
  assertNear(run('player.pitch'),beforeDelayedBoundaryWarp[1]-2*.002*.35,'Normal aiming stays immediate after the delayed boundary warp clears');

  resetMouseProbe();mouseMove(400,300,0,0,4700);mouseMove(401,301,1,1,4708);mouseMove(402,302,1,1,4716);
  const beforeReturnFlick=mouseAim();mouseMove(403,306,1,0,4724);mouseMove(404,406,1,104,4732);
  assertNear(run('player.pitch'),beforeReturnFlick[1]-104*.002*.35,'A real104px flick combined with a4px coordinate correction must retain all physical movement');
  assertNear(run('player.yaw'),beforeReturnFlick[0]-2*.002*.35,'A return correction and fast vertical flick cannot change horizontal gain');
  mouseMove(405,407,1,1,4740);
  assertNear(run('player.pitch'),beforeReturnFlick[1]-105*.002*.35,'Ordinary aiming continues immediately after the combined return and fast flick');

  resetMouseProbe();mouseMove(400,300,0,0,4600);mouseMove(401,301,1,1,4608);mouseMove(402,302,1,1,4616);mouseMove(403,306,1,1,4624);
  const beforeBrokenRelativeReset=mouseAim();mouseMove(404,307,9000,9000,4632);
  assertNear(run('player.pitch'),beforeBrokenRelativeReset[1]-.002*.35,'Broken relative deltas retain client aiming even while a warp return is pending');
  mouseMove(405,308,1,1,4640);mouseMove(406,309,1,1,4648);const beforeIndependentSmallMove=mouseAim();mouseMove(407,306,1,1,4656);
  assertNear(run('player.pitch'),beforeIndependentSmallMove[1]+3*.002*.35,'Broken relative input clears the old warp offset instead of discarding an unrelated later sub4px move');

  resetMouseProbe();mouseMove(400,300,0,0,4100);mouseMove(401,301,1,1,4108);mouseMove(402,302,1,1,4116);
  const beforeDuplicateMouseWarp=mouseAim();mouseMove(402,302,0,0,4124);mouseMove(502,402,1,1,4132);
  assert.deepEqual(mouseAim(),beforeDuplicateMouseWarp,'A zero-coordinate duplicate must not erase trust and admit the following100px warp');
  mouseMove(503,403,1,1,4140);
  assertNear(run('player.yaw'),beforeDuplicateMouseWarp[0]-.002*.35,'A rejected post-duplicate warp must immediately establish the correct horizontal anchor');
  assertNear(run('player.pitch'),beforeDuplicateMouseWarp[1]-.002*.35,'A rejected post-duplicate warp must immediately establish the correct vertical anchor');

  resetMouseProbe();mouseMove(400,300,0,0,4200);mouseMove(400.5,300.5,1,1,4208);mouseMove(401,301,1,1,4216);
  const beforeFractionalMouseWarp=mouseAim();
  assertNear(beforeFractionalMouseWarp[0],-1*.002*.35,'Half-pixel client coordinates retain their actual horizontal gain');
  assertNear(beforeFractionalMouseWarp[1],-1*.002*.35,'Rounded relative values must not double half-pixel vertical gain');
  mouseMove(401.5,341,1,1,4224);mouseMove(402,301.5,1,1,4232);
  assertNear(run('player.yaw'),beforeFractionalMouseWarp[0]-1*.002*.35,'Half-pixel horizontal motion stays responsive through a vertical warp pair');
  assertNear(run('player.pitch'),beforeFractionalMouseWarp[1],'Half-pixel agreement must establish enough trust to filter a40px vertical warp and its return');
  mouseMove(402.5,302,1,1,4240);
  assertNear(run('player.pitch'),beforeFractionalMouseWarp[1]-.5*.002*.35,'Fractional vertical aiming resumes with its unchanged half-pixel gain');

  resetMouseProbe();mouseMove(400,300,0,0,4300);mouseMove(401,301,1,1,4308);mouseMove(402,302,1,1,4316);
  const beforeMixedMouseWarp=mouseAim();mouseMove(482,402,80,1,4324);
  assertNear(run('player.yaw'),beforeMixedMouseWarp[0]-80*.002*.35,'A normal80px horizontal move cannot be lost because the vertical axis warped');
  assertNear(run('player.pitch'),beforeMixedMouseWarp[1],'A healthy horizontal delta must not mask a simultaneous100px vertical warp');
  mouseMove(562,303,80,1,4332);
  assertNear(run('player.yaw'),beforeMixedMouseWarp[0]-160*.002*.35,'Continuous normal horizontal movement remains immediate through the reverse vertical warp');
  assertNear(run('player.pitch'),beforeMixedMouseWarp[1]-.002*.35,'A reverse vertical warp contributes only its real1px motion independently of horizontal speed');
  mouseMove(563,304,1,1,4340);
  assertNear(run('player.pitch'),beforeMixedMouseWarp[1]-2*.002*.35,'Mixed-axis warp recovery must not add input lag');

  resetMouseProbe();mouseMove(500,500,0,0,4400);
  for(const [index,delta]of [1,1,-1,-1,1,-1].entries()){
    const before=mouseAim(),position=[501,502,501,500,501,500][index];mouseMove(position,position,delta,delta,4408+index*8);
    assertNear(run('player.yaw'),before[0]-delta*.002*.35,'Every slow horizontal pixel and genuine direction reversal applies in its own event');
    assertNear(run('player.pitch'),before[1]-delta*.002*.35,'Every slow vertical pixel and genuine direction reversal applies in its own event');
  }
  const beforeRealBoundaryMove=mouseAim();mouseMove(504,504,4,4,4464);mouseMove(500,500,-4,-4,4472);
  assert.deepEqual(mouseAim(),beforeRealBoundaryMove,'Matching real4px motion and its real reversal retain their full original gain');
  run('document.pointerLockElement=canvas'); dispatchDocument('pointerlockchange', {});
  mouseMove(0, 0, 0, 0, 3000); const beforeLockedFlick = mouseAim();
  mouseMove(0, 0, 400, -200, 3016);
  assertNear(run('player.yaw'), beforeLockedFlick[0] - 400 * .002 * .35, 'A locked fast flick must retain its full horizontal gain');
  assertNear(run('player.pitch'), beforeLockedFlick[1] + 200 * .002 * .35, 'A locked fast flick must retain its full vertical gain');
  run('document.pointerLockElement=null'); dispatchDocument('pointerlockchange', {}); run('resumeGame()');
  run('pauseGame()');
  const focusedSlider = new sandbox.HTMLInputElement();
  dispatchDocument('keydown', { target: focusedSlider, code: 'Escape', repeat: true });
  assert.equal(run('mode'), 'pause', 'A repeated Escape must not toggle the pause state');
  dispatchDocument('keydown', { target: focusedSlider, code: 'Escape', repeat: false });
  assert.equal(run('mode'), 'play', 'Escape must resume after changing a focused sensitivity slider');
  dispatchDocument('keydown', { target: focusedSlider, code: 'Escape', repeat: true });
  assert.equal(run('mode'), 'play', 'Holding Escape after resuming must not reopen pause');
  for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    run('player.yaw=.2;player.pitch=.1');
    dispatchDocument('keydown', { target: canvas, code, repeat: false, preventDefault() {} });
    run('updatePlay(.02)');
    assert.equal(run('player.yaw'), .2, `${code} must not turn the view`);
    assert.equal(run('player.pitch'), .1, `${code} must not aim the view`);
    dispatchDocument('keyup', { target: canvas, code });
  }
  console.log('PASS: reduced sensitivity, unlocked/locked mouse aiming, warp filtering, pointer re-entry, focus/overlay transitions, and no arrow-key aiming');

  // Delivered shortcuts can be cancelled; browser-reserved events that never reach the page cannot be simulated here.
  const shortcutFormat = document.getElementById('match-format').value;
  document.getElementById('match-format').value = 'explore';
  run('startGame();player.x=0;player.z=26;player.y=0;player.yaw=0;player.vx=0;player.vz=0;player.crouch=0');
  const shortcutKey = (code, options = {}) => {
    let prevented = 0;
    dispatchDocument('keydown', { target: canvas, code, repeat: false, ctrlKey: false, metaKey: false, altKey: false, cancelable: true, preventDefault() { prevented++; }, ...options });
    return prevented;
  };
  const shortcutUp = code => dispatchDocument('keyup', { target: canvas, code });
  shortcutKey('KeyV'); shortcutKey('KeyW');
  run('for(let i=0;i<6;i++)updatePlay(.05)');
  assert.ok(run('player.crouch') > .95, 'Holding V while walking must lower the actual player eye');
  assertNear(run('Math.hypot(player.vx,player.vz)'), 1.8, 'V plus W must move at crouch speed');
  assertNear(run('player.z'), 26 - 1.8 * .3, 'V plus W must walk forward without a browser modifier key');
  shortcutUp('KeyV'); run('for(let i=0;i<6;i++)updatePlay(.05)');
  assert.ok(run('player.crouch') < .01, 'Releasing V must restore the standing pose');
  assertNear(run('Math.hypot(player.vx,player.vz)'), (5.4*1.15), 'Releasing V while W stays held must restore normal rifle/sidearm speed');
  for(const [active,walk,expected] of [['classic',true,2.8*1.15],['knife',false,6.3*1.15]]){
    sandbox.practiceSpeedWeapon=active;sandbox.practiceWalk=walk;
    run('var savedSpeedWeapon=inventory.active;inventory.active=practiceSpeedWeapon;Object.assign(player,{x:0,z:26,vx:0,vz:0,y:0,vy:0,yaw:0});keys.clear();keys.add("KeyW");if(practiceWalk)keys.add("ShiftLeft");for(let i=0;i<30;i++)updatePlay(1/60)');
    assertNear(run('Math.hypot(player.vx,player.vz)'),expected,'Walk and knife run use the same requested1.15 multiplier');
    run('inventory.active=savedSpeedWeapon;keys.clear();keys.add("KeyW")');
  }

  shortcutUp('KeyW');
  for (const transition of ['pause', 'blur']) {
    shortcutKey('KeyV'); shortcutKey('KeyW');
    if (transition === 'pause') run('pauseGame()'); else dispatchWindow('blur');
    assert.equal(run('keys.has("KeyV")||keys.has("KeyW")'), false, `${transition} must release held V and movement`);
    run('resumeGame();for(let i=0;i<6;i++)updatePlay(.05)');
    assert.ok(run('player.crouch') < .01, `${transition} must not leave crouch active after resuming`);
  }
  for (const control of ['ControlLeft', 'ControlRight']) {
    run('clearCombatInput();player.vx=0;player.vz=0;player.crouch=0');
    shortcutKey(control, { ctrlKey: true });
    assert.ok(shortcutKey('KeyW', { ctrlKey: true }) > 0, 'A delivered Ctrl+W must cancel its browser default');
    run('updatePlay(.05)');
    assert.ok(run('player.crouch') > .5, `${control} must retain compatible held crouching`);
    assertNear(run('player.vz'), -1.8, 'A delivered Ctrl+W must retain crouched forward movement');
    shortcutUp('KeyW'); shortcutUp(control);
  }
  for (const overlay of ['play', 'pause', 'shop', 'map', 'score']) {
    run(`clearCombatInput();mode=${JSON.stringify(overlay)};reloading=0;player.ammo=2;player.reserve=24`);
    for (const repeat of [false, true]) {
      assert.ok(shortcutKey('KeyW', { ctrlKey: true, repeat }) > 0, `${overlay} must cancel delivered Ctrl+W, including auto-repeat`);
      assert.ok(shortcutKey('KeyR', { ctrlKey: true, repeat }) > 0, `${overlay} must cancel delivered Ctrl+R, including auto-repeat`);
      assert.ok(shortcutKey('KeyW', { metaKey: true, repeat }) > 0, `${overlay} must cancel delivered Meta+W, including auto-repeat`);
    }
    assert.equal(run('keys.has("KeyW")'), overlay === 'play', 'Ctrl game combinations must only move during active play');
    assert.equal(run('reloading>0'), overlay === 'play', 'Delivered Ctrl+R must retain reload only during active play');
  }
  run('clearCombatInput();mode="play";reloading=0;player.vx=0;player.vz=0');
  for (const [code, options] of [['KeyW', { metaKey: true }], ['KeyR', { metaKey: true }], ['AltLeft', { altKey: true }], ['KeyW', { altKey: true }]]) shortcutKey(code, options);
  assert.equal(run('keys.size'), 0, 'Meta shortcuts and Alt combinations must not arm movement or modifier keys');
  assert.equal(run('reloading'), 0, 'Meta+R must not reload the game weapon');
  const editableTargets = [Object.assign(new sandbox.HTMLInputElement(), { tagName: 'INPUT' }), Object.assign(new sandbox.HTMLSelectElement(), { tagName: 'SELECT' }), Object.assign(new sandbox.HTMLTextAreaElement(), { tagName: 'TEXTAREA' }), { tagName: 'DIV', isContentEditable: true }, { tagName: 'SPAN', closest: () => ({ isContentEditable: true }) }];
  for (const target of editableTargets) {
    for (const modifier of ['ctrlKey', 'metaKey']) for (const code of ['KeyV', 'KeyC', 'KeyA']) {
      assert.equal(shortcutKey(code, { target, [modifier]: true }), 0, 'Editable controls must retain native paste, copy, and selection');
    }
    assert.equal(run('keys.size'), 0, 'Typing shortcuts into an editable control must not activate game input');
  }
  run('backMenu();clearCombatInput()');
  for (const modifier of ['ctrlKey', 'metaKey']) for (const code of ['KeyV', 'KeyC', 'KeyA', 'KeyW', 'KeyR']) {
    assert.equal(shortcutKey(code, { [modifier]: true }), 0, 'Menu and lobby must retain native browser and clipboard shortcuts');
  }
  assert.equal(run('keys.size'), 0, 'Menu shortcuts must not become held game keys');
  document.getElementById('match-format').value = shortcutFormat;
  run('startGame()');
  console.log('PASS: held V crouch, Ctrl compatibility, delivered shortcut cancellation, repeat/overlay guards, and editable/menu clipboard access');

  run('startGame();inventory.primary="vandal";equip("knife");updateHUD()');
  dispatchElement(document.getElementById('mobile-weapon'), 'click');
  assert.equal(run('inventory.active'), 'vandal', 'Touch weapon switching must return from a knife or ultimate to the owned rifle');
  dispatchElement(document.getElementById('mobile-ads'), 'click');
  assert.equal(run('aiming'), true);
  assert.equal(document.getElementById('mobile-ads').attributes['aria-pressed'], 'true');
  dispatchElement(document.getElementById('mobile-weapon'), 'click');
  assert.equal(run('inventory.active'), 'classic'); assert.equal(run('aiming'), false, 'Changing weapon must release touch ADS');
  dispatchElement(document.getElementById('mobile-ads'), 'click');
  assert.equal(run('aiming'), false, 'A sidearm must not enter rifle ADS');
  dispatchElement(document.getElementById('mobile-weapon'), 'click');
  assert.equal(run('inventory.active'), 'knife');
  dispatchElement(document.getElementById('mobile-crouch'), 'click');
  run('updatePlay(.05)');
  assert.ok(run('player.crouch') > .5, 'Touch crouch must lower the actual player eye and movement state');
  assert.equal(document.getElementById('mobile-crouch').attributes['aria-pressed'], 'true');
  run('pauseGame();updateHUD()');
  assert.equal(run('keys.has("TouchCrouch")'), false);
  assert.equal(document.getElementById('mobile-crouch').attributes['aria-pressed'], 'false');
  dispatchElement(document.getElementById('mobile-weapon'), 'click');
  assert.equal(run('inventory.active'), 'knife', 'Touch equipment must not change through a paused overlay');
  run('resumeGame();touchLook={id:29,x:10,y:10}');
  dispatchElement(canvas, 'pointercancel', { pointerId:29 });
  assert.equal(run('touchLook'), null, 'An interrupted touch pointer must release camera tracking');
  run('startGame();startRound();player.alive=false;interactionHeld=false');
  dispatchElement(document.getElementById('mobile-interact'), 'pointerdown', { pointerId:71, preventDefault() {} });
  assert.equal(run('interactionHeld'), false, 'A dead player must not arm the mobile interaction button');
  run('spawnRound(false)'); assert.equal(run('interactionHeld'), false, 'Respawning must not inherit a dead mobile F press');
  run('touchMove={x:.6,y:-.4};touchLook={id:77,x:200,y:180};movePointer=76;keys.add("TouchCrouch");aiming=true;firing=true;interactionHeld=true;pauseGame();resumeGame()');
  assert.equal(run('interactionHeld||firing||aiming||keys.has("TouchCrouch")||touchLook!==null||movePointer!==null||touchMove.x!==0||touchMove.y!==0'), false, 'Resuming must not revive old touch pointers or held combat input');
  run('startGame();startRound();clearBots();map.sites[0].polygon=[[-7,-21],[7,-21],[7,-15],[-7,-15]];player.x=6;player.z=-18;interactionHeld=true;updateInteraction(.5,true)');
  assert.equal(run('match.spike.plantProgress'), .5, 'Local planting must use the painted polygon even outside the old radius');
  assert.equal(document.getElementById('mobile-interact-label').textContent, '設置');
  assert.equal(document.getElementById('mobile-interact-hint').textContent, '3.5秒');
  run('player.x=0;player.z=-22;updateInteraction(.1,true)');
  assert.equal(run('match.spike.plantProgress'), 0, 'Being inside the old circle cannot authorize planting outside the painted polygon');
  run('startGame();startRound();map.sites[0].polygon=[[-7,-21],[7,-21],[7,-15],[-7,-15]];const polygonGuest=bots.find(b=>b.id==="blue-1");polygonGuest.remoteId="polygon-guest";polygonGuest.x=6;polygonGuest.z=-18;match.spike.carrier=polygonGuest.id;netInputs.set(polygonGuest.remoteId,{seq:1,round:match.round,input:{x:6,z:-18,y:0,interact:true},actions:[],received:elapsed});updateRemoteActor(polygonGuest,.5)');
  assert.equal(run('match.spike.plantProgress'), .5, 'Host validation must accept a remote planter inside the polygon');
  run('polygonGuest.x=0;polygonGuest.z=-22;netInputs.get(polygonGuest.remoteId).input={x:0,z:-22,y:0,interact:true};updateRemoteActor(polygonGuest,.1)');
  assert.equal(run('match.spike.plantProgress'), 0, 'Host validation must reject the old circle outside the polygon');
  run('delete map.sites[0].polygon;netInputs.clear();startGame()');
  console.log('PASS: touch weapon/ADS/crouch, interrupted view pointers, interaction countdown and matching local/remote polygon plant validation');

  run('startGame()');
  dispatchElement(canvas, 'mousedown', { button: 0 });
  dispatchDocument('mouseup', { button: 0 });
  run('updatePlay(.02)');
  assert.equal(run('player.ammo'), 12, 'A complete click during the purchase phase must not fire');
  run('startRound();bots.forEach(bot=>bot.fire=999)');
  dispatchElement(canvas, 'mousedown', { button: 0 });
  dispatchDocument('mouseup', { button: 0 });
  assert.equal(run('player.ammo'), 11, 'A live click that ends before the next animation frame must immediately fire one Classic shot');
  run('updatePlay(.02)');
  assert.equal(run('player.ammo'), 11, 'The next animation frame must not duplicate a short click');
  run('startGame();startRound();bots.forEach(bot=>bot.fire=999)');
  dispatchElement(canvas, 'mousedown', { button: 0 });
  run('for(let frame=0;frame<20;frame++)updatePlay(.05)');
  assert.equal(run('player.ammo'), 11, 'Holding a semiautomatic Classic must produce exactly one shot');
  dispatchDocument('mouseup', { button: 0 });
  dispatchElement(canvas, 'mousedown', { button: 0 });
  dispatchDocument('mouseup', { button: 0 });
  assert.equal(run('player.ammo'), 10, 'Releasing and clicking again must produce the next semiautomatic shot');
  run('startGame();startRound();bots.forEach(bot=>bot.fire=999);equip("vandal")');
  dispatchElement(canvas, 'mousedown', { button: 0 });
  assert.equal(run('player.ammo'), 24, 'An automatic rifle must also fire immediately on mouse down');
  run('updatePlay(.05);updatePlay(.05)');
  assert.equal(run('player.ammo'), 24, 'Holding fire must respect the rifle interval before a second shot');
  run('updatePlay(.05)');
  assert.equal(run('player.ammo'), 23, 'An automatic rifle must continue firing once its interval expires');
  dispatchDocument('mouseup', { button: 0 });
  run('for(let frame=0;frame<10;frame++)updatePlay(.05)');
  assert.equal(run('player.ammo'), 23, 'Releasing the trigger must stop automatic fire');
  run('startGame()');
  console.log('PASS: same-frame clicks, semiautomatic hold/reclick, automatic cadence/release, and buy-phase firing prevention');

  run('var timingUpdateBots=updateBots;updateBots=()=>{}');
  const frameRateResults = [];
  for (const fps of [10, 15, 30, 60]) {
    run('startGame();startRound();previous=0');
    for (let frame = 1; frame <= fps * 10; frame++) run(`frame(${frame * 1000 / fps})`);
    assert.ok(Math.abs(run('elapsed') - 10) < .02, `${fps}fps must preserve ten real seconds of simulation time`);
    assert.ok(Math.abs(run('match.roundTime') - 90) < .02, `${fps}fps must not extend the round deadline`);
    run('startGame();startRound();equip("vandal");previous=0');
    dispatchElement(canvas, 'mousedown', { button: 0 });
    for (let frame = 1; frame <= fps * 2; frame++) run(`frame(${frame * 1000 / fps})`);
    const count = run('shots');
    assert.equal(count, 20, `Vandal must fire twenty rounds including its initial shot over two real seconds at ${fps}fps`);
    assert.equal(run('player.ammo'), 5);
    dispatchDocument('mouseup', { button: 0 });
    run('updatePlay(1)');
    dispatchElement(canvas, 'mousedown', { button: 0 });
    assert.equal(run('shots'), count + 1, 'Reclicking after a pause must fire one new round rather than catch up stale trigger time');
    run('updatePlay(.05)');
    assert.equal(run('shots'), count + 1, 'A new trigger hold must start its own cadence');
    dispatchDocument('mouseup', { button: 0 });
    run('updatePlay(.25);equip("phantom")');
    const beforeSwapClick = run('shots');
    dispatchElement(canvas, 'mousedown', { button: 0 });
    run('updatePlay(.05)');
    assert.equal(run('shots'), beforeSwapClick + 1, 'Changing rifles must not retain a backlog of unfired automatic shots');
    dispatchDocument('mouseup', { button: 0 });
    frameRateResults.push(`${fps}fps: ${count} rounds`);
  }
  run('updateBots=timingUpdateBots;startGame()');
  console.log(`PASS: real-time round clocks and frame-independent automatic fire (${frameRateResults.join('; ')})`);

  for (const overlay of ['map', 'shop', 'score']) for (const lostFocus of ['blur', 'visibilitychange']) {
    run(`startGame();${overlay === 'map' ? 'pauseGame(true)' : overlay === 'shop' ? 'openShop()' : 'showScoreboard()'}`);
    assert.equal(run('mode'), overlay);
    run('keys.add("KeyW");firing=true;aiming=true;interactionHeld=true;touchMove={x:1,y:1};touchLook={id:9,x:10,y:10};movePointer=9');
    const before = [run('match.phaseTime'), run('match.roundTime')];
    if (lostFocus === 'blur') dispatchWindow('blur');
    else { document.hidden = true; dispatchDocument('visibilitychange', {}); }
    assert.equal(run('mode'), 'pause', `${overlay} must pause when the window loses focus through ${lostFocus}`);
    assert.equal(document.getElementById('pause-menu').hidden, false);
    for (const id of ['map-overlay', 'shop-overlay', 'scoreboard']) assert.equal(document.getElementById(id).hidden, true, `${overlay} focus loss must dismiss #${id}`);
    assert.equal(run('keys.size'), 0);
    for (const expression of ['firing', 'aiming', 'interactionHeld']) assert.equal(run(expression), false, `${expression} must reset on ${lostFocus}`);
    assert.equal(run('touchMove.x===0&&touchMove.y===0&&touchLook===null&&movePointer===null'), true, 'Touch pointers and movement must reset when focus is lost');
    run('frame(performance.now()+1000)');
    assert.deepEqual([run('match.phaseTime'), run('match.roundTime')], before, 'A paused overlay must not continue the purchase or live timer');
    document.hidden = false;
  }
  run('resumeGame();startGame();startRound();clearBots();map.colliders.push({minX:-1,maxX:1,minZ:-1,maxZ:1,height:3.2,base:2.8})');
  assert.equal(run('visibleBetween({x:-2,z:0},{x:2,z:0})'), true, 'Bot perception must see an opponent through a pedestrian-deck passage');
  assert.equal(run('visibleBetween({x:0,y:3.2,z:0},{x:3,y:0,z:0})'), true, 'Bot perception from a deck must retain the true sight-line height');
  run('map.colliders.pop();startGame()');
  console.log('PASS: losing focus from every overlay pauses timers and clears desktop/touch input; bot sight permits deck passages');

  run('startGame();startRound();bots.forEach(b=>b.fire=999);player.x=0;player.z=25;player.vx=0;player.vz=0;player.y=0;player.vy=0;player.crouch=0;player.recoil=0;keys.add("KeyW")');
  for (let i = 0; i < 12; i++) {
    if (i === 5) run('keys.add("ShiftLeft")');
    if (i === 9) run('keys.clear()');
    run('updatePlay(.02)');
    assertNear(run('camera.position.y'), run('1.7-player.crouch*.55+player.y'), 'Grounded walking, speed changes, and stopping must keep the eye height steady');
    assert.equal(run('player.y'), 0, 'Walking on the clear spawn floor must not move the player vertically');
  }
  run('keys.clear()');
  console.log('PASS: walking and stopping preserve a steady grounded camera height');

  run('var originalUpdateBots=updateBots;updateBots=()=>{}');
  const bench = arena.colliders.find(c => Math.abs(c.height - 1.06) < .00001 && c.minX < -15.4 && c.maxX > -15.4 && c.minZ < 16.9 && c.maxZ > 16.9);
  assert.ok(bench, 'The controlled bench fixture must remain part of the collision map');
  for (const hz of [20, 30, 60, 120, 144]) {
    run('startGame();startRound();player.x=-15.4;player.z=17.95;player.y=0;player.vy=5.6;player.vx=0;player.vz=-(5.4*1.15);player.yaw=0;keys.add("KeyW")');
    let peak = 0;
    for (let frame = 0; frame < Math.ceil(hz * 1.1); frame++) {
      run(`updatePlay(${1 / hz})`);
      peak = Math.max(peak, run('player.y'));
      assert.ok(run('player.y') < bench.height, `At ${hz} Hz the jump must not snap up onto the taller bench`);
      assert.ok(run('player.z') >= bench.maxZ + .34 - .00001, `At ${hz} Hz the player must not enter the bench below its top`);
    }
    assert.ok(Math.abs(peak - 1.0453333333) < .005, `At ${hz} Hz the jump apex must remain consistent, got ${peak}`);
    assert.equal(run('player.y'), 0, `At ${hz} Hz a blocked jump must land back on the ground`);
    assert.equal(run('player.vy'), 0);
    for (const character of ['duelist','nope','mend','echo','veil','ember','frost']) {
      run(`startGame();startRound();player.kit.character='${character}';player.x=0;player.z=26;player.y=0;player.vy=0;player.vx=0;player.vz=0;keys.clear();jump()`);
      assertNear(run('player.vy'), 7.28 * .9, `${character} ordinary jump must launch with90percent of the previous force`);
      let openPeak = 0;
      for (let frame = 0; frame < Math.ceil(hz * 1.1); frame++) { run(`updatePlay(${1 / hz})`); openPeak = Math.max(openPeak, run('player.y')); }
      assert.ok(Math.abs(openPeak - 1.4309568) < .005, `${character} open-ground jump apex must be consistent at ${hz} Hz`);
      assert.equal(run('player.y'), 0); assert.equal(run('player.vy'), 0);
    }
  }
  run('startGame();startRound();map.colliders.push({minX:-1,maxX:1,minZ:25,maxZ:27,height:1});player.x=0;player.z=26;player.y=1;player.vy=0;player.vx=0;player.vz=0;keys.clear()');
  for (let frame = 0; frame < 240; frame++) {
    run('updatePlay(1/120)');
    assert.equal(run('player.y'), 1, 'Standing on a real cover top must not jitter or sink');
    assert.equal(run('player.vy'), 0);
  }
  run('moveEntity(player,2,0);updatePlay(.05)');
  assert.ok(run('player.y') < 1 && run('player.vy') < 0, 'Leaving a cover edge must start a fall instead of hovering');
  for (let frame = 0; frame < 60; frame++) run('updatePlay(1/120)');
  assert.equal(run('player.y'), 0, 'Stepping off cover must return the player to the ground');
  run('map.colliders.pop();map.colliders.push({minX:-1,maxX:1,minZ:25,maxZ:27,height:.1});player.x=0;player.z=26;player.y=.099;player.vy=-.1;updatePlay(.05)');
  assert.ok(run('player.y') < .099, 'A player below a low ledge top must fall instead of hovering or snapping upward');
  run('map.colliders.pop();keys.clear()');
  console.log('PASS: all7 ordinary jumps at90percent of prior launch across20–144Hz, legacy short-hop bench collision, stable cover tops, edge falls and no low-ledge hover');

  run('startGame();startRound();keys.clear();map.ramps=[{minX:-2,maxX:2,minZ:2,maxZ:22,axis:"z",direction:1,base:0,height:4}];map.colliders.push({minX:-2,maxX:2,minZ:22,maxZ:27,height:4,base:3.6});player.x=0;player.z=2;player.y=0;player.vy=0;player.vx=0;player.vz=0');
  for (let step = 0; step < 206; step++) {
    const previousHeight = run('player.y');
    run('moveEntity(player,0,.1);updatePlay(1/120)');
    assert.ok(run('player.y') >= previousHeight - 1e-9, 'Grounded ramp ascent must not drop below the ramp');
    assert.ok(run('player.y') - previousHeight <= .22 + 1e-9, 'Ramp ascent must not produce a large vertical snap');
    assert.equal(run('player.vy'), 0, 'Grounded ascent must preserve floor contact');
    if (run('player.z') < 21.6) assertNear(run('player.y'), run('rampFloor(player.x,player.z)'), 'Feet must follow the ramp surface while ascending');
  }
  assertNear(run('player.z'), 22.6, 'A ramp must connect to the elevated platform');
  assert.equal(run('player.y'), 4);
  for (let step = 0; step < 206; step++) {
    const previousHeight = run('player.y');
    run('moveEntity(player,0,-.1);updatePlay(1/120)');
    assert.ok(run('player.y') <= previousHeight + 1e-9, 'Grounded ramp descent must not bounce upward');
    assert.ok(previousHeight - run('player.y') <= .22 + 1e-9, 'Ramp descent must not skip down the slope');
  }
  assertNear(run('player.y'), 0, 'Descending the ramp must reach ground level');
  run('player.x=0;player.z=12;player.y=2;player.vy=0;jump()');
  let rampJumpPeak = 2;
  for (let frame = 0; frame < 132; frame++) { run('updatePlay(1/120)'); rampJumpPeak = Math.max(rampJumpPeak, run('player.y')); }
  assert.ok(Math.abs(rampJumpPeak - 3.4309568) < .005, 'A ramp jump must retain the adjusted normal ballistic rise');
  assertNear(run('player.y'), 2, 'A ramp jump must land back on the ramp');
  assert.equal(run('player.vy'), 0);
  run('player.x=0;player.z=25;player.y=0;player.vy=0;moveEntity(player,1,0);updatePlay(.05)');
  assertNear(run('player.x'), 1, 'The passage beneath an elevated deck must remain walkable');
  assert.equal(run('player.y'), 0, 'Walking beneath a deck must not teleport onto its top');
  run('jump()'); let underDeckPeak = 0;
  for (let frame = 0; frame < 132; frame++) { run('updatePlay(1/120)'); underDeckPeak = Math.max(underDeckPeak, run('player.y')); }
  assert.ok(Math.abs(underDeckPeak - 1.4309568) < .005, 'A jump below a sufficiently high deck must preserve normal gravity');
  assert.equal(run('player.y'), 0, 'A jump below the deck must land on the ground');
  run('map.colliders.pop();map.ramps=[];map.colliders.push({minX:-1,maxX:1,minZ:28,maxZ:30,height:.16});player.x=0;player.z=27;player.y=0;player.vy=0;moveEntity(player,0,1.5);updatePlay(1/120)');
  assertNear(run('player.z'), 28.5, 'An ankle-height curb must not block ordinary walking');
  assertNear(run('player.y'), .16, 'A small curb must support an automatic step');
  run('map.colliders.pop();player.y=0;player.vy=0;keys.clear()');
  console.log('PASS: grounded ramp ascent/descent, ramp jumps, under-deck passage and jumps, and small-curb steps');

  run('startGame();startRound();player.pitch=0;player.yaw=0;player.crouch=0;updatePlay(1/120);shoot();updatePlay(1/120)');
  assert.ok(run('camera.rotation.x') > 0, 'A shot must still produce visible recoil feedback');
  assert.ok(run('camera.rotation.x') < run('player.recoil'), 'The camera must ease into shot recoil instead of taking the full pitch step');
  assert.equal(run('player.pitch'), 0, 'Rendered recoil must not alter the mouse aim state');
  for (let frame = 0; frame < 240; frame++) run('updatePlay(1/120)');
  assert.ok(Math.abs(run('camera.rotation.x')) < .00001, 'The camera must return smoothly to the original aim after recoil decays');
  run('shoot();startGame();updatePlay(1/120)');
  assert.equal(run('camera.rotation.x'), 0, 'A fresh round must not inherit rendered recoil');
  run('updateBots=originalUpdateBots');
  console.log('PASS: smoothed recoil preserves mouse aim and resets between matches');

  run('startGame();moveEntity(player,0,-12)');
  assert.ok(run('Math.hypot(player.x-map.buyAreas.attack.x,player.z-map.buyAreas.attack.z)') < arena.buyAreas.attack.radius - .34, 'Attacking buy barrier must keep the player inside spawn');
  document.getElementById('starting-side').value = 'defend';
  run('startGame();moveEntity(player,0,12)');
  assert.ok(run('Math.hypot(player.x-map.buyAreas.defend.x,player.z-map.buyAreas.defend.z)') < arena.buyAreas.defend.radius - .34, 'Defending buy barrier must keep the player inside spawn');
  document.getElementById('starting-side').value = 'attack';
  run('startGame();startRound()');
  // Exercise the real movement routine against a deliberately thin cover collider.
  run("map.colliders.push({minX:1,maxX:1.05,minZ:25,maxZ:27,height:2});moveEntity(player,5,0)");
  assert.ok(run('player.x') < .67, 'Dash must not tunnel through thin cover');
  run('map.colliders.pop();player.x=map.spawn.x;player.ammo=7;player.reserve=3;bots.forEach(b=>b.fire=999);reload();for(let i=0;i<36;i++)updatePlay(.05)');
  assert.equal(run('player.ammo'), 10, 'Reload respects the Classic magazine and available reserve ammunition');
  assert.equal(run('player.reserve'), 0);
  run('elapsed=37;lastShot=36.95;startGame();startRound();shoot()');
  assert.equal(run('player.ammo'), 11, 'Restart must reset the shooting cooldown so the first live shot works immediately');
  console.log('PASS: thin-cover collision, magazine-aware reload, and restart shooting');

  run('startGame();match.credits=6000;buy("vandal")');
  assert.equal(run('match.credits'), 3100);
  assert.equal(run('buy("phantom")'), true); assert.equal(run('match.credits'), 3100, 'A held unused rifle must retain its same-phase exchange refund');
  assert.equal(run('buy("spectre")'), true); assert.equal(run('match.credits'), 4400, 'A cheaper held-rifle exchange must refund only the price difference');
  assert.equal(run('buy("vandal")'), true); assert.equal(run('match.credits'), 3100);
  dispatchDocument('keydown', { target: canvas, code: 'KeyG', repeat: false, preventDefault() {} });
  assert.equal(run('inventory.primary'), null); assert.equal(run('roundPurchases.primary'), undefined, 'G must invalidate the dropped rifle refund');
  assert.equal(run('droppedWeapons.length'), 1);
  assert.equal(run('buy("vandal")'), true); assert.equal(run('match.credits'), 200, 'A rifle left on the ground must not fund its own replacement');
  dispatchDocument('keydown', { target: canvas, code: 'KeyG', repeat: false, preventDefault() {} });
  assert.equal(run('buy("vandal")'), false, 'Repeated drop/rebuy must stop when real credits run out');
  assert.equal(run('match.credits'), 200); assert.equal(run('inventory.primary'), null); assert.equal(run('droppedWeapons.length'), 2);
  console.log('PASS: local buy-phase rifle drops require full-price repurchase while ordinary held-weapon exchange refunds remain');

  run('startGame()');
  assert.equal(run('buy("ghost")'), true); assert.equal(run('match.credits'), 300);
  assert.equal(run('inventory.active'), 'ghost'); assert.equal(run('player.ammo'), 15);
  assert.equal(run('buy("light")'), false, 'A different slot cannot use a Ghost refund');
  assert.equal(run('buy("classic")'), true); assert.equal(run('match.credits'), 800, 'Same-phase weapon replacement refunds the previous purchase');
  assert.equal(run('buy("light")'), true); assert.equal(run('player.armor'), 25);
  run('match.addCredits(3000)'); assert.equal(run('buy("vandal")'), true);
  assert.equal(run('player.ammo'), 25); assert.equal(run('inventory.primary'), 'vandal');
  run('startRound()'); assert.equal(run('buy("phantom")'), false, 'Weapons cannot be bought during a live round');
  run('player.ammo=3;player.reserve=4;match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()');
  assert.equal(run('match.round'), 2); assert.equal(run('match.phase'), 'buy');
  assert.equal(run('inventory.primary'), 'vandal', 'A survivor retains the purchased primary');
  assert.equal(run('player.ammo'), 25, 'A surviving Vandal must refill its magazine for the next round');
  assert.equal(run('player.reserve'), 75, 'A surviving Vandal must refill reserve ammunition for the next round');
  assert.equal(run('player.armor'), 25, 'A survivor retains remaining armor');
  assert.equal(run('player.hp'), 100); assert.equal(run('bots.length'), 9);
  run('startRound();damageEntity(player,1000,bots.find(b=>b.team==="red"));updatePlay(.02)');
  assert.equal(run('player.alive'), false); assert.equal(run('gun.visible'), false);
  assert.equal(run('mode'), 'play', 'Player death must spectate surviving allies instead of ending the match');
  assert.equal(run('match.phase'), 'live');
  assert.ok(run('spectatedBot?.alive&&spectatedBot.team==="blue"'), 'Death must select a living allied spectator target');
  assert.equal(run('spectatedBot.group.visible'), false, 'The watched ally model must not obstruct a camera inside its own head');
  const firstWatchedId = run('spectatedBot.id');
  dispatchElement(canvas, 'mousedown', { button: 0 });
  run('updatePlay(.02)');
  assert.notEqual(run('spectatedBot.id'), firstWatchedId, 'Clicking while dead must change the watched ally');
  assert.equal(run(`bots.find(bot=>bot.id===${JSON.stringify(firstWatchedId)}).group.visible`), true, 'Changing spectator target must restore the previous ally model');
  assert.equal(run('spectatedBot.group.visible'), false, 'The new spectator target must also avoid hiding the view');
  run('match.endRound("red","elimination",{playerAlive:false});handleMatchEvents();match.nextRound();handleMatchEvents()');
  assert.equal(run('player.alive'), true); assert.equal(run('inventory.primary'), null);
  assert.equal(run('inventory.secondary'), 'classic'); assert.equal(run('player.armor'), 0);
  assert.equal(run('spectatedBot'), null, 'A fresh round must clear the previous spectator reference');
  assert.equal(run('bots.every(bot=>bot.group.visible)'), true, 'The fresh round must not inherit hidden spectator models');
  console.log('PASS: purchases, refunds, survivor carryover, elimination spectator, and next-round respawn');

  document.getElementById('match-format').value = 'swift';
  run('startGame();startRound();var redBankBefore=roster.find(r=>r.team==="red").credits;var blueBankBefore=roster.find(r=>r.id==="blue-1").credits;match.endRound("blue","elimination");handleMatchEvents()');
  assert.equal(run('roster.find(r=>r.team==="red").credits-redBankBefore'), 2400, 'Losing Swift bots receive the 2400 second-round grant');
  assert.equal(run('roster.find(r=>r.id==="blue-1").credits-blueBankBefore'), 3000, 'Only the pistol-winning Swift team receives the additional 600');
  document.getElementById('match-format').value = 'standard';
  console.log('PASS: Swift pistol bonus is awarded to the winning team only');

  const keyDown = code => dispatchDocument('keydown', { target: canvas, code, repeat: false, preventDefault() {} });
  const keyUp = code => dispatchDocument('keyup', { target: canvas, code });
  function assertAmmoHUD(get, name, ammo, reserve, warning = null) {
    assert.equal(get('weapon-name').textContent, name);
    assert.equal(String(get('ammo').textContent), String(ammo));
    assert.equal(String(get('reserve').textContent), String(reserve));
    assert.equal(get('reload-state').hidden, warning === null);
    if (warning !== null) assert.match(get('reload-state').textContent, warning);
  }
  const localHUD = id => document.getElementById(id);
  run('startGame();startRound();clearBots();inventory.primary="vandal"');
  keyDown('Digit4'); run('updateHUD()'); assertAmmoHUD(localHUD, 'BOMBER', '—', '—');
  keyDown('Digit3'); run('updateHUD()'); assertAmmoHUD(localHUD, 'TACTICAL KNIFE', '—', '—');
  keyDown('Digit1'); run('updateHUD()'); assertAmmoHUD(localHUD, 'VANDAL', 25, 75);
  run('player.ammo=0;player.reserve=0;updateHUD()');
  assertAmmoHUD(localHUD, 'VANDAL', 0, 0, /弾薬切れ.*持ち替え/);
  keyDown('KeyR'); assert.equal(run('reloading'), 0, 'An empty reserve must not promise a possible reload'); keyUp('KeyR');
  run('player.reserve=11;updateHUD()'); assertAmmoHUD(localHUD, 'VANDAL', 0, 11, /R\s+リロード/);
  keyDown('KeyR'); run('updateHUD()'); assertAmmoHUD(localHUD, 'VANDAL', 0, 11, /RELOADING/); keyUp('KeyR');
  keyDown('Digit4'); run('updateHUD()'); assertAmmoHUD(localHUD, 'BOMBER', '—', '—');
  keyDown('Digit3'); run('updateHUD()'); assertAmmoHUD(localHUD, 'TACTICAL KNIFE', '—', '—');
  run('player.kit.ultPoints=7'); keyDown('KeyX'); keyUp('KeyX');
  assertAmmoHUD(localHUD, 'BLADE STORM', 5, '∞');
  run('shoot()'); assertAmmoHUD(localHUD, 'BLADE STORM', 4, '∞');
  keyDown('Digit1'); run('updateHUD()'); assertAmmoHUD(localHUD, 'VANDAL', 0, 11, /R\s+リロード/);
  keyDown('Digit3'); run('updateHUD()'); assertAmmoHUD(localHUD, 'BLADE STORM', 4, '∞');
  console.log('PASS: real equipment keys distinguish spike, melee, rifle ammunition, empty reserves, reload and ultimate knife counts');

  run('startGame()'); keyDown('KeyB');
  assert.equal(run('mode'), 'shop', 'B opens the shop during the buy phase');
  keyDown('KeyB'); assert.equal(run('mode'), 'play');
  keyDown('Tab'); assert.equal(run('mode'), 'score');
  assert.equal(document.getElementById('scoreboard-body').children.length, 10, 'The scoreboard includes both five-player teams');
  keyUp('Tab'); assert.equal(run('mode'), 'play');
  run('startRound()'); keyDown('KeyB'); assert.equal(run('mode'), 'play', 'B cannot open purchases in a live round');
  keyDown('Digit4'); assert.equal(run('inventory.active'), 'spike');
  keyDown('KeyG'); keyUp('KeyG');
  assert.equal(run('match.spike.status'), 'dropped'); assert.equal(run('inventory.active'), 'classic');
  run('player.x=match.spike.x;player.z=match.spike.z;updateInteraction(.01,true)');
  assert.equal(run('match.spike.carrier'), 'player', 'Approaching a dropped spike recovers it for an attacker');
  run('player.x=0;player.z=-18'); keyDown('KeyF'); run('updateInteraction(2,true)');
  assert.equal(run('match.spike.plantProgress'), 2);
  keyUp('KeyF'); run('updateInteraction(.01,true)'); assert.equal(run('match.spike.plantProgress'), 0, 'Releasing F cancels the incomplete plant');
  keyDown('KeyF'); run('updateInteraction(4,true);handleMatchEvents()'); keyUp('KeyF');
  assert.equal(run('match.spike.status'), 'planted'); assert.equal(run('match.spike.site'), 'A');
  assert.equal(run('match.credits'), 1100, 'A real player plant awards the team economy bonus');
  document.getElementById('starting-side').value = 'defend';
  run('startGame();startRound();match.interactPlant(4,{actorId:"red-0",team:"red",site:"A",x:0,z:-18});handleMatchEvents();player.x=0;player.z=-18');
  keyDown('KeyF'); run('updateInteraction(3.5,true)'); keyUp('KeyF'); run('updateInteraction(.01,true)');
  assert.equal(run('match.spike.checkpoint'), 3.5);
  assert.equal(run('match.spike.defuseProgress'), 3.5);
  assert.equal(document.getElementById('mobile-interact-hint').textContent, '残り3.5秒長押し', 'An ordinary half-defuse must advertise only the remaining saved-checkpoint time');
  run('pauseGame()'); assert.equal(run('interactionHeld'), false); run('resumeGame()');
  keyDown('KeyF'); run('updateInteraction(3.5,true);handleMatchEvents()'); keyUp('KeyF');
  assert.equal(run('match.spike.status'), 'defused'); assert.equal(run('match.score.blue'), 1);
  document.getElementById('starting-side').value = 'attack';
  console.log('PASS: shop/scoreboard inputs, spike equip/drop/recovery, F plant cancellation, and resumed checkpoint defuse');

  run('startGame();startRound();clearBots();map.colliders.push({minX:-3,maxX:3,minZ:22,maxZ:25.5,height:4});player.x=0;player.z=26;player.yaw=0;equip("spike")');
  keyDown('KeyG'); keyUp('KeyG');
  assert.equal(run('match.spike.status'), 'dropped');
  assert.equal(run('map.collision.blocked(match.spike.x,match.spike.z,.1,0)'), false, 'Dropping into a thick wall must use a safe position instead of embedding the spike');
  assert.equal(run('map.collision.segmentClear(player.x,player.z,match.spike.x,match.spike.z,.1,0)'), true, 'A dropped spike must stay on the accessible side of a wall');
  assert.ok(run('Math.hypot(player.x-match.spike.x,player.z-match.spike.z)') <= 1.8, 'A blocked drop must remain recoverable from the safe side');
  run('updateInteraction(.01,true)');
  assert.equal(run('match.spike.carrier'), 'player', 'A safe fallback drop must be recoverable through the ordinary interaction path');
  run('map.colliders.pop();startGame();startRound();clearBots();player.x=0;player.z=map.bounds.minZ+.5;player.yaw=0;equip("spike")');
  keyDown('KeyG'); keyUp('KeyG');
  assert.equal(run('match.spike.status'), 'dropped');
  assert.equal(run('canStand(match.spike.x,match.spike.z,.1,0)'), true, 'Dropping toward the arena boundary must keep the spike inside reachable space');
  assert.ok(run('Math.hypot(player.x-match.spike.x,player.z-match.spike.z)') <= 1.8, 'An out-of-bounds drop must fall back to a recoverable position');
  run('startGame()');
  console.log('PASS: wall-facing and boundary-facing spike drops remain accessible and recoverable');

  run('startGame();startRound();clearBots();makeBot({x:0,z:-18},0);equip("vandal");player.x=0;player.z=-9;player.yaw=0;player.pitch=Math.atan2(1.62-1.7,9);botsGroup.updateMatrixWorld(true);Math.random=()=>.5;shoot()');
  assert.equal(run('bots[0].alive'), false, 'An unobstructed Vandal headshot must neutralize the enemy');
  assert.equal(run('totalKills'), 1);
  assert.equal(run('match.credits'), 1000, 'Player kills must award credits through the real combat path');
  run('startGame();startRound();clearBots();makeBot({x:0,z:-18},0);equip("vandal");player.x=0;player.z=-9;player.yaw=0;player.pitch=Math.atan2(1.05-1.7,9);botsGroup.updateMatrixWorld(true);shoot()');
  assert.equal(run('bots[0].hp'), 60, 'A Vandal body shot deals 40 damage without armor');
  run('elapsed+=.2;shoot();elapsed+=.2;shoot()');
  assert.equal(run('bots[0].alive'), false, 'Three Vandal body shots must neutralize an unarmored enemy');
  run('startGame();startRound();clearBots();makeBot({x:8,z:9},0);equip("vandal");player.x=8;player.z=18;player.yaw=0;player.pitch=Math.atan2(1.62-1.7,9);botsGroup.updateMatrixWorld(true);shoot()');
  assert.equal(run('bots[0].hp'), 100, 'Solid cover must block shots to the enemy behind it');
  run('makeBot({x:0,z:0},1,"blue");damageEntity(bots[1],160,player)');
  assert.equal(run('bots[1].hp'), 100, 'Friendly fire must not damage allies');
  console.log('PASS: weapon-specific head/body damage, kill economy, bullet cover, and friendly-fire protection');

  run('startGame();startRound();clearBots();map.colliders.push({minX:-1,maxX:1,minZ:1,maxZ:2,height:1.4});player.x=0;player.z=0;player.y=0;makeBot({x:0,z:4},0,"red");bots[0].fire=0;var beforeCoverRandom=Math.random;Math.random=()=>.2');
  assert.equal(run('visibleBetween(bots[0],player)'), true, 'The target head remains visible above low cover');
  assert.equal(run('map.collision.rayClear(0,1.2,4,0,1.15,0)'), false, 'The chosen bot body-shot trajectory must actually hit the low cover');
  run('bots[0].target=player;bots[0].think=1;bots[0].reactionUntil=-1;bots[0].group.rotation.y=Math.PI;updateBots(.05)');
  assert.equal(run('bots[0].aiAmmo'), 11, 'The bot must attempt the blocked shot rather than silently disabling combat');
  assert.equal(run('player.hp'), 100, 'Seeing an enemy head must not allow body damage through a low wall');
  run('map.colliders.pop();bots[0].fire=0;updateBots(.05)');
  assert.equal(run('player.hp'), 74, 'Removing the cover must let the same deterministic body shot deal Classic damage');
  run('Math.random=beforeCoverRandom;startGame()');
  console.log('PASS: bot perception and bullet obstruction are independent; low cover blocks body damage');

  // Smoke obscuration follows the rendered viewpoint, including a dead player's spectator camera.
  run(`startGame();startRound();clearCombatInput();
    bots.forEach((bot,i)=>{bot.remoteId='fog-idle-'+i;bot.x=-30+i*3;bot.z=30;bot.y=0;});
    var fogAlly=bots.find(bot=>bot.team==='blue'),fogOther=bots.filter(bot=>bot.team==='blue')[1];
    fogAlly.x=20;fogAlly.z=0;fogOther.x=-20;fogOther.z=0;
    player.x=0;player.z=26;player.y=0;player.vy=0;player.hp=0;player.alive=false;spectateIndex=0;
    syncSmokes([{id:91001,x:0,y:1.7,z:26,expires:elapsed+4.5}]);updatePlay(.05)`);
  assert.ok(run('camera.position.distanceTo(smokes[0].mesh.position)') > 30, 'The spectator camera must actually be far from the smoke around the dead body');
  assert.equal(run('scene.fog.far'), 380, 'A smoked dead body must not blind the distant ally being watched');
  run('syncSmokes([{id:91002,x:fogAlly.x,y:1.65,z:fogAlly.z,expires:elapsed+4.5}]);updatePlay(.05)');
  assertNear(run('camera.position.distanceTo(smokes[0].mesh.position)'), 0, 'The watched ally must actually be inside the smoke');
  assert.equal(run('scene.fog.near'), .1); assert.equal(run('scene.fog.far'), 2.5, 'Watching an ally inside smoke must have the same interior obscuration as playing there');
  run('spectateIndex=1;updatePlay(.05)');
  assert.equal(run('scene.fog.far'), 380, 'Switching to an unsmoked ally must immediately clear the interior fog');
  run('player.alive=true;player.hp=100;syncSmokes([{id:91003,x:player.x,y:1.7,z:player.z,expires:elapsed+4.5}]);updatePlay(.05)');
  assertNear(run('camera.position.distanceTo(smokes[0].mesh.position)'), 0, 'A living player must use their actual camera location');
  assert.equal(run('scene.fog.far'), 2.5);
  run('player.x=smokes[0].x+3.58;updatePlay(.05)');
  assert.equal(run('scene.fog.far'), 2.5, 'A camera 3.58m from the center must remain inside the actual 3.6m smoke radius');
  run('player.x=smokes[0].x+3.61;updatePlay(.05)');
  assert.equal(run('scene.fog.far'), 380, 'A camera 3.61m from the center must be outside the same smoke radius');
  run('player.x=smokes[0].x;updatePlay(.05)');
  run('elapsed+=4.5;updatePlay(.05)');
  assert.equal(run('smokes.length'), 0); assert.equal(run('scene.fog.near'), 145); assert.equal(run('scene.fog.far'), 380, 'Expired smoke must restore ordinary sight');
  run('syncSmokes([{id:91004,x:player.x,y:1.7,z:player.z,expires:elapsed+4.5}]);updatePlay(.05)');
  assert.equal(run('scene.fog.far'), 2.5);
  run('match.phase="post";match.nextRound();handleMatchEvents();updatePlay(.05)');
  assert.equal(run('smokes.length'), 0); assert.equal(run('scene.fog.far'), 380, 'The new round must remove both smoke and its interior fog');
  run('startGame()');
  console.log('PASS: smoke interior fog follows living/spectated cameras rather than dead bodies, and clears on spectator switch, expiry and next round');

  run('interactionHeld=true'); document.getElementById('interaction').hidden = false;
  dispatchElement(document.getElementById('explore-start'), 'click');
  assert.equal(document.getElementById('match-format').value, 'explore');
  assert.equal(run('exploring'), true); assert.equal(run('bots.length'), 0);
  assert.equal(run('match.phase'), 'live'); assert.equal(run('inventory.active'), 'vandal');
  assert.equal(run('player.kit.updraft'), imported.getCharacterSkill(run('player.kit.character'),'q').max, 'Practice starts with the selected character Q capacity, including both mascot lifts');
  assert.equal(run('interactionHeld'), false, 'A new session must clear a previously held interaction key');
  assert.equal(document.getElementById('interaction').hidden, true, 'A new practice session must hide an old plant/defuse panel');
  run('for(let frame=0;frame<4000;frame++)updatePlay(.05)');
  assert.equal(run('mode'), 'play', 'Practice must stay playable beyond a normal round deadline');
  assert.equal(run('match.phase'), 'live'); assert.equal(run('match.round'), 1);
  assert.equal(run('match.score.blue+match.score.red'), 0, 'A practice session must not award elimination rounds');
  assert.equal(document.getElementById('timer').textContent, '∞');
  keyDown('KeyB'); assert.equal(run('mode'), 'shop', 'B opens the complete free practice arsenal');
  keyUp('KeyB');run("buy('atlas')");assert.equal(run('inventory.active'),'atlas');assert.equal(run('player.ammo'),5);
  run("buy('vandal')");keyDown('KeyB');keyUp('KeyB');
  assert.equal(run('inventory.active'), 'vandal'); assert.equal(run('player.ammo'), 25);
  run('player.reserve=0;updatePlay(.05)'); assert.equal(run('player.reserve'), 75, 'Practice must replenish reserve ammunition');
  run('pauseGame(true)');
  const travelButton = document.getElementById('landmark-travel').children.find(button => button.textContent === '南口テスト地点');
  const skillRefillButton=document.getElementById('landmark-travel').children.find(button=>button.textContent==='スキル・ULT補充');
  assert.ok(skillRefillButton&&!skillRefillButton.disabled);
  run('player.kit.smoke=0;player.kit.updraft=0');dispatchElement(skillRefillButton,'click');
  assert.equal(run('player.kit.smoke'),imported.getCharacterSkill(run('player.kit.character'),'c').max);assert.equal(run('player.kit.updraft'),imported.getCharacterSkill(run('player.kit.character'),'q').max,'Practice refill must restore both upgraded mascot lifts');
  // Resource refill belongs only to free map exploration; keep active two-step E.
  for(const character of Object.keys(imported.CHARACTER_DEFS)){
    sandbox.practiceCharacter=character;
    run('player.kit=new DuelistKit({character:practiceCharacter});refillMapPracticeSkills();player.kit.activate("c",elapsed);player.kit.activate("q",elapsed);player.kit.dash=0;player.kit.nextSignatureAt=elapsed+100;player.kit.ultPoints=0;refillMapPracticeSkills()');
    assert.equal(run('player.kit.smoke'),imported.getCharacterSkill(character,'c').max);
    assert.equal(run('player.kit.updraft'),imported.getCharacterSkill(character,'q').max);
    assert.equal(run('player.kit.dash'),1);assert.equal(run('player.kit.ultPoints'),7);
  }
  run('player.kit=new DuelistKit();refillMapPracticeSkills();player.kit.activate("e",elapsed);var practiceArm=player.kit.armExpiresAt;refillMapPracticeSkills()');
  assert.equal(run('player.kit.armExpiresAt'),run('practiceArm'));assert.equal(run('player.kit.dash'),0,'Refill must preserve a prepared second E instead of resetting it');
  run('player.kit.activate("x",elapsed);player.kit.knives=0;updatePlay(.01)');
  assert.equal(run('player.kit.knivesActive'),true);assert.equal(run('player.kit.knives'),5,'Unlimited practice knives must refill before tick can disarm the ultimate');
  for(const guard of ['onlinePlaying=true','rangeSession={}','objectivePractice={}','exploring=false','player.alive=false']){
    run('onlinePlaying=false;rangeSession=null;objectivePractice=null;exploring=true;player.alive=true;player.kit.smoke=0;player.kit.updraft=0;player.kit.ultPoints=0;'+guard+';refillMapPracticeSkills()');
    assert.equal(run('player.kit.smoke+player.kit.updraft+player.kit.ultPoints'),0,'Practice refill must not leak through '+guard);
  }
  run('onlinePlaying=false;rangeSession=null;objectivePractice=null;exploring=true;player.alive=true;player.kit=new DuelistKit();refillMapPracticeSkills();pauseGame(true)');
  console.log('PASS: all7 map-practice infinite CQEX, prepared E/active knives preserved; match/range/objective/online/death guards');
  assert.ok(travelButton && !travelButton.disabled, 'Practice must enable local travel buttons');
  dispatchElement(travelButton, 'click');
  assert.equal(run('mode'), 'play'); assert.equal(run('player.x'), -10); assert.equal(run('player.z'), -10);
  assert.equal(run('map.collision.blocked(player.x,player.z,.42,0)'), false, 'Landmark travel must arrive clear of collision');
  document.getElementById('match-format').value = 'standard'; run('startGame()');
  assert.equal(run('exploring'), false); assert.equal(run('bots.length'), 9);
  assert.ok(document.getElementById('landmark-travel').children.every(button => button.disabled), 'Match play must disable teleport buttons');
  console.log('PASS: practice beyond 200 seconds, no elimination loop, safe local travel, rifle switching, and ammunition refill');

  localValues.set('hashimoto-range-best', '200');
  run('var beforeRangeRandom=Math.random;Math.random=()=>.1');
  dispatchElement(document.getElementById('range-start'), 'click');
  assert.equal(document.getElementById('match-format').value, 'range');
  assert.equal(run('rangeSession.remaining'), 60);
  assert.equal(run('roster.length'), 1, 'A shooting drill must not create a match roster');
  assert.equal(run('bots.length'), 1);
  assert.equal(run('bots[0].rangeTarget'), true);
  assert.equal(run('inventory.active'), 'vandal');
  assert.ok(document.getElementById('landmark-travel').children.every(button => button.disabled), 'A timed drill must disable practice teleport shortcuts');
  keyDown('KeyB'); keyUp('KeyB');assert.equal(run('mode'),'shop');run("buy('phantom')");assert.equal(run('inventory.active'),'phantom');
  run("buy('vandal')");keyDown('KeyB'); keyUp('KeyB'); assert.equal(run('inventory.active'), 'vandal');
  const firstRangeTarget = run('bots[0]');
  const aimRangeShot = height => run(`player.yaw=Math.atan2(player.x-bots[0].x,player.z-bots[0].z);player.pitch=Math.atan2(${height}-(1.7-player.crouch*.55+player.y),Math.hypot(bots[0].x-player.x,bots[0].z-player.z));player.recoil=0;renderedRecoil=0;shotSequence=0;elapsed+=.2;Math.random=()=>.5;shoot()`);
  // No manual matrix update: a click immediately after target creation must hit its real position.
  aimRangeShot(1.62);
  assert.equal(run('bots[0].alive'), false, 'A newly created target must be hittable before the next renderer frame');
  assert.equal(run('rangeSession.score'), 150, 'Eliminating a target with a headshot awards 150 points');
  assert.equal(run('rangeSession.headKills'), 1);
  aimRangeShot(1.62); aimRangeShot(1.62);
  assert.equal(run('rangeSession.score'), 150, 'Repeated shots into a dead target must not score twice');
  assert.equal(run('rangeSession.hits'), 1, 'A dead target must not contribute extra hit or head-rate statistics');
  run('updatePlay(.1)');
  assert.equal(run('bots[0]'), firstRangeTarget, 'The next target must respect the short death delay');
  run('updatePlay(.09)');
  assert.notEqual(run('bots[0]'), firstRangeTarget, 'A fresh target must appear after the death delay');
  assert.equal(run('bots.length'), 1, 'Target replacement must never accumulate additional bots');
  assert.equal(run('bots[0].alive'), true);
  const targetOrigin = [run('bots[0].x'), run('bots[0].z')];
  run('bots[0].fire=0;updatePlay(2)');
  assert.equal(run('player.hp'), 100, 'Range targets must never shoot the player');
  assert.deepEqual([run('bots[0].x'), run('bots[0].z')], targetOrigin, 'Range targets must stay at their selected firing-lane position');
  assert.equal(run('bots[0].muzzle.visible'), false);
  aimRangeShot(1.05); assert.equal(run('bots[0].hp'), 60);
  aimRangeShot(1.05); assert.equal(run('bots[0].hp'), 20);
  assert.equal(run('rangeSession.score'), 150, 'Body hits award no kill points before elimination');
  aimRangeShot(1.05);
  assert.equal(run('rangeSession.score'), 250, 'A body-shot elimination adds 100 points');
  assert.equal(run('rangeSession.kills'), 2);
  assert.equal(run('rangeSession.summary().accuracy'), 67);
  assert.equal(run('rangeSession.summary().headRate'), 25);
  run('pauseGame();previous=0');
  const pausedRangeTime = run('rangeSession.remaining');
  run('frame(1000)');
  assert.equal(run('rangeSession.remaining'), pausedRangeTime, 'Pausing a drill must freeze its sixty-second clock');
  run('resumeGame();previous=0');
  for (let frame = 1; frame <= 602 && run('mode') === 'play'; frame++) run(`frame(${frame * 100})`);
  assert.equal(run('rangeSession.time'), 60);
  assert.equal(run('mode'), 'result'); assert.equal(run('bots.length'), 0);
  assert.equal(document.getElementById('result-title').textContent, 'DRILL COMPLETE');
  assert.equal(document.getElementById('range-result').hidden, false);
  assert.equal(Number(document.getElementById('range-score').textContent), 250);
  assert.equal(document.getElementById('range-head-rate').textContent, '25%');
  assert.equal(document.getElementById('range-best-note').textContent, 'NEW PERSONAL BEST');
  assert.equal(localValues.get('hashimoto-range-best'), '250', 'A better drill score must persist as the personal best');
  const rangeBestWrites = localWrites.filter(write => write.key === 'hashimoto-range-best').length;
  dispatchElement(document.getElementById('play-again'), 'click');
  assert.equal(run('rangeSession.score'), 0); assert.equal(run('rangeSession.shots'), 0);
  assert.equal(run('rangeSession.remaining'), 60); assert.equal(run('bots.length'), 1);
  assert.equal(document.getElementById('range-result').hidden, true, 'Retrying must hide the previous drill result');
  run('previous=0');
  for (let frame = 1; frame <= 602 && run('mode') === 'play'; frame++) run(`frame(${frame * 100})`);
  assert.equal(run('mode'), 'result');
  assert.equal(localValues.get('hashimoto-range-best'), '250', 'A lower retry score must preserve the personal best');
  assert.equal(localWrites.filter(write => write.key === 'hashimoto-range-best').length, rangeBestWrites);
  document.getElementById('match-format').value = 'standard';
  dispatchElement(document.getElementById('play-again'), 'click');
  assert.equal(run('rangeSession'), null); assert.equal(run('exploring'), false);
  assert.equal(run('bots.length'), 9); assert.equal(run('roster.length'), 10);
  assert.equal(run('match.phase'), 'buy');
  assert.equal(document.getElementById('range-result').hidden, true);
  run('Math.random=beforeRangeRandom');
  console.log('PASS: timed range entry, immediate target hits, head/body scoring, dead-target protection, peaceful targets, pause/retry, best-score persistence, and match return');

  // Exercise the real F input and MatchRules interactions, rather than replacing
  // the objective with a separate practice timer or a second rule implementation.
  const objectiveFrames = frames => run(`for(let objectiveFrame=0;objectiveFrame<${frames};objectiveFrame++)updatePlay(.05)`);
  for (const kind of ['plant', 'defuse']) {
    document.getElementById('match-format').value = kind;
    document.getElementById('starting-side').value = kind === 'plant' ? 'defend' : 'attack';
    run('startGame()');
    assert.equal(run('objectivePractice.kind'), kind);
    assert.equal(run('match.side'), kind === 'plant' ? 'attack' : 'defend', 'Objective practice must choose the required side despite the menu side setting');
    assert.equal(run('exploring'), true); assert.equal(run('roster.length'), 1); assert.equal(run('bots.length'), 0);
    assert.equal(run('rangeSession'), null); assert.equal(run('match.phase'), 'live');
    assert.equal(document.getElementById('timer').textContent, '∞');
    assert.equal(document.getElementById('landmark-travel').children.length, 2, 'Objective practice must expose only the two site retry buttons');
    for (const siteId of ['A', 'B']) {
      assert.equal(run(`resetObjectivePractice('${siteId}')`), true);
      assert.equal(run('objectivePractice.site'), siteId);
      assert.equal(document.getElementById('mobile-interact').disabled, false, 'Retrying a site must re-enable its mobile F control');
      assert.notEqual(document.getElementById('mobile-interact-hint').textContent, 'Mで再挑戦', 'Retrying must clear the previous completion hint');
      assert.equal(run('map.collision.blocked(player.x,player.z,.34,0)'), false, 'An objective retry must place the player outside map solids');
      assert.equal(run('match.spike.status'), kind === 'plant' ? 'carried' : 'planted');
      assert.equal(run('match.spike.site'), kind === 'plant' ? null : siteId);
      if (kind === 'plant') assert.equal(run('map.sites.some(s=>s.id===objectivePractice.site&&isInsideSite(s,player.x,player.z))'), true);
      else {
        assert.ok(run('Math.hypot(player.x-match.spike.x,player.z-match.spike.z)') < 2.3, 'Defuse practice must start within real interaction distance');
        assert.equal(run('spikeModel.visible'), true, 'The planted practice spike must be available for close inspection');
      }
      objectiveFrames(2400);
      assert.equal(run('mode'), 'play'); assert.equal(run('match.phase'), 'live'); assert.equal(run('match.round'), 1);
      assert.equal(run('objectivePractice.completed'), false);
      assert.equal(run('match.score.blue+match.score.red'), 0, 'A solo objective session must not end as an enemy elimination');
      assert.equal(run('match.roundTime'), 100, 'The ordinary round deadline must remain disabled in objective practice');
      if (kind === 'defuse') assert.equal(run('match.spike.timer'), 45, 'A practice spike must not count down or detonate while inspecting it');

      keyDown('KeyF'); objectiveFrames(40);
      assertNear(run(kind === 'plant' ? 'match.spike.plantProgress' : 'match.spike.defuseProgress'), 2, 'Real F input must advance the shared interaction rules');
      assert.equal(document.getElementById('interaction').hidden, false);
      keyUp('KeyF'); run('updatePlay(.05)');
      assert.equal(run(kind === 'plant' ? 'match.spike.plantProgress' : 'match.spike.defuseProgress'), 0, 'Releasing F before a checkpoint must cancel incomplete progress');

      if (kind === 'plant') {
        keyDown('KeyF'); objectiveFrames(20); keyDown('KeyW'); objectiveFrames(1);
        assert.equal(run('match.spike.plantProgress'), 0, 'Walking must cancel a practice plant through the real stationary check');
        keyUp('KeyW'); keyUp('KeyF');
        run(`resetObjectivePractice('${siteId}')`);
        keyDown('KeyF'); objectiveFrames(79);
        assert.equal(run('objectivePractice.completed'), false, 'A plant cannot complete before four held seconds');
        assert.equal(run('match.spike.status'), 'carried'); objectiveFrames(1);
      } else {
        keyDown('KeyF'); objectiveFrames(70); keyUp('KeyF'); run('updatePlay(.05)');
        assert.equal(run('match.spike.checkpoint'), 3.5); assert.equal(run('match.spike.defuseProgress'), 3.5, 'Exactly half a defuse must survive releasing F');
        assert.match(document.getElementById('interaction-title').textContent, /半分まで保存済み/);
        assert.equal(document.getElementById('mobile-interact-hint').textContent, '残り3.5秒長押し', 'A saved practice half-defuse must not ask for another full seven seconds');
        keyDown('KeyF'); objectiveFrames(69);
        assert.equal(run('objectivePractice.completed'), false, 'A resumed defuse cannot finish before seven total held seconds');
        assert.equal(run('match.spike.status'), 'planted'); objectiveFrames(1);
      }
      assert.equal(run('objectivePractice.completed'), true);
      assert.equal(run('match.spike.status'), kind === 'plant' ? 'planted' : 'defused');
      assert.equal(run('match.spike.site'), siteId); assert.equal(run('mode'), 'play', 'Practice success must keep the player in the world for inspection');
      assert.equal(run('match.phase'), kind === 'plant' ? 'live' : 'post');
      assert.equal(run('interactionHeld||firing'), false, 'Completing an objective must release held combat inputs');
      assert.equal(document.getElementById('interaction').hidden, true);
      assert.equal(document.getElementById('mobile-interact').disabled, true, 'The completed practice F button must be disabled');
      assert.equal(document.getElementById('mobile-interact-label').textContent, '完了');
      assert.equal(document.getElementById('mobile-interact-hint').textContent, 'Mで再挑戦', 'Success must replace the old zero-second countdown with a retry instruction');
      keyDown('KeyF'); assert.equal(run('interactionHeld'), false, 'A completed practice must ignore another keyboard F press'); keyUp('KeyF');
      dispatchElement(document.getElementById('mobile-interact'), 'pointerdown', { pointerId:92, preventDefault() {} });
      assert.equal(run('interactionHeld'), false, 'A completed practice must ignore a mobile F event even if delivered to its disabled control');
      dispatchElement(document.getElementById('mobile-interact'), 'pointercancel', { pointerId:92 });
      assert.equal(run('spikeModel.visible'), true, 'The objective model must remain inspectable after plant or defuse success');
      const completedDuration = run('objectivePractice.duration'), completedScore = run('match.score.blue+match.score.red');
      assert.ok(Number.isFinite(completedDuration) && completedDuration >= (kind === 'plant' ? 4 : 7) - 1e-8);
      keyDown('KeyF'); objectiveFrames(1200); keyUp('KeyF');
      assert.equal(run('objectivePractice.duration'), completedDuration, 'Successful practice must record its duration only once');
      assert.equal(run('match.score.blue+match.score.red'), completedScore, 'Holding F after success must not award another round');
      assert.equal(run('match.round'), 1); assert.equal(run('mode'), 'play'); assert.equal(run('spikeModel.visible'), true);
      assert.equal(run('detonationState'), null, 'Completed practice must never create a timed explosion');
    }

    run('resetObjectivePractice("A")'); keyDown('KeyF'); objectiveFrames(20);
    const practiceProgress = kind === 'plant' ? 'match.spike.plantProgress' : 'match.spike.defuseProgress';
    const beforePracticePause = run('objectivePractice.elapsed'), beforePracticeProgress = run(practiceProgress);
    run('pauseGame();previous=0;frame(1000)');
    assert.equal(run('objectivePractice.elapsed'), beforePracticePause); assert.equal(run(practiceProgress), beforePracticeProgress, 'A paused frame must not advance practice interaction progress');
    assert.equal(run('interactionHeld'), false); run('resumeGame();updatePlay(.05)');
    assert.equal(run(practiceProgress), 0, 'Resuming must not silently resume an old sub-checkpoint F hold');
    keyDown('KeyF'); objectiveFrames(70);
    keyDown('KeyM'); keyUp('KeyM');
    assert.equal(run('mode'), 'map');
    const objectiveRetryButton = document.getElementById('landmark-travel').children.find(button => button.textContent === 'Bでやり直す');
    assert.ok(objectiveRetryButton && !objectiveRetryButton.disabled);
    dispatchElement(objectiveRetryButton, 'click');
    assert.equal(run('mode'), 'play'); assert.equal(run('objectivePractice.site'), 'B'); assert.equal(run('objectivePractice.kind'), kind);
    assert.equal(run('objectivePractice.completed'), false); assert.equal(run('objectivePractice.elapsed'), 0); assert.equal(run('objectivePractice.duration'), 0);
    assert.equal(run(`${practiceProgress}+match.spike.checkpoint`), 0, 'A site retry must clear partial progress and a saved half-defuse');
    assert.equal(run('interactionHeld||firing||aiming||keys.size>0'), false, 'A retry must clear the old held interaction and menu inputs');
    run('player.kit.smoke=2;player.kit.ultPoints=7'); keyDown('KeyC'); keyUp('KeyC'); keyDown('KeyX'); keyUp('KeyX'); keyDown('KeyG'); keyUp('KeyG');
    assert.equal(run('player.kit.smoke'), 2); assert.equal(run('player.kit.ultPoints'), 7);
    assert.equal(run('inventory.primary'), 'vandal'); assert.equal(run('droppedWeapons.length'), 0, 'Objective practice must not lose its training equipment through G');
    run('backMenu()'); assert.equal(run('objectivePractice'), null); assert.equal(run('spikeModel.visible'), false);
  }
  for (const format of ['standard', 'swift', 'range', 'explore']) {
    document.getElementById('match-format').value = 'plant'; run('startGame()');
    document.getElementById('match-format').value = format; run('startGame()');
    assert.equal(run('objectivePractice'), null, `${format} must discard an old objective session`);
    assert.equal(run('roster.length'), ['range', 'explore'].includes(format) ? 1 : 10);
    assert.equal(run('bots.length'), format === 'range' ? 1 : format === 'explore' ? 0 : 9);
    assert.equal(run('match.phase'), ['range', 'explore'].includes(format) ? 'live' : 'buy');
    if (format === 'range') assert.equal(run('rangeSession.remaining'), 60);
    if (format === 'explore') {
      run('player.x=0;player.z=-18'); keyDown('KeyF'); objectiveFrames(100); keyUp('KeyF');
      assert.equal(run('match.spike.status'), 'carried', 'Ordinary map exploration must not inherit objective practice interactions');
    }
  }
  document.getElementById('starting-side').value = 'attack'; document.getElementById('match-format').value = 'standard'; run('startGame()');
  console.log('PASS: A/B plant and defuse practice, true F timing/cancellation/checkpoint, unlimited inspection, one-time completion, pause/site retry cleanup, and mode isolation');

  // Exercise the actual host/guest functions with a 5 Hz relay: several shots
  // share one delivery, but their scheduled cadence and action IDs must survive.
  run(`online={host:true,session:{memberId:'host'},room:{code:'TESTROOM',hostId:'host',status:'playing',settings:{format:'swift'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send:capturePeerPacket,close(){}};
    onlinePlaying=true;netHasSnapshot=false;netHostPaused=false;netInputs.clear();netApplied.clear();netSequence=0;mode='menu';startGame();match.startLive();
    player.x=30;player.z=30;bots.forEach(b=>b.fire=999);
    const remote=bots.find(b=>b.id==='red-0');remote.x=0;remote.z=-10;remote.y=0;remote.netWeapon='vandal';remote.netAmmo=25;remote.netReserve=75;remote.record.primary='vandal';remote.lastNetShot=-10;
    let packetNumber=0,nextAction=1;const emitted=[];
    for(let frame=0;frame<=40;frame++){
      elapsed=frame*.05;
      if(frame%4===0){
        while((nextAction-1)*WEAPONS.vandal.interval<2&&((nextAction-1)*WEAPONS.vandal.interval)<=elapsed+1e-8){emitted.push({seq:nextAction,round:1,at:(nextAction-1)*WEAPONS.vandal.interval,type:'fire',yaw:0,pitch:0});nextAction++;}
        receiveNetPacket('friend',{type:'input',seq:++packetNumber,round:1,input:{x:0,z:-10,y:0,yaw:0,pitch:0},actions:emitted.filter(a=>a.seq>(netApplied.get('friend')||0))});
      }
      updateRemoteActor(remote,.05);
    }`);
  assert.equal(run('remote.netAmmo'), 5, 'A two-second Vandal burst must retain all 20 shots through a 5 Hz HTTP relay');
  assert.equal(run('netApplied.get("friend")'), 20);
  run(`receiveNetPacket('friend',{type:'input',seq:++packetNumber,round:1,input:{x:0,z:-10,y:0},actions:emitted});elapsed+=.05;updateRemoteActor(remote,.05);`);
  assert.equal(run('remote.netAmmo'), 5, 'RTC/HTTP duplicate action delivery must not fire twice');
  run(`match.round=2;match.phase='buy';remote.record.primary=null;remote.record.credits=6000;remote.record.netPurchases={};remote.netWeapon='classic';
    applyRemoteAction(remote,{type:'buy',id:'vandal'});applyRemoteAction(remote,{type:'buy',id:'phantom'});`);
  assert.equal(run('remote.record.credits'), 3100, 'Remote held unused rifles must keep their exchange refund');
  run('applyRemoteAction(remote,{type:"buy",id:"spectre"})');
  assert.equal(run('remote.record.credits'), 4400, 'Remote cheaper-rifle exchange must refund the legitimate difference');
  run('applyRemoteAction(remote,{type:"buy",id:"vandal"});applyRemoteAction(remote,{type:"drop"})');
  assert.equal(run('remote.record.primary'), null); assert.equal(run('remote.record.netPurchases.primary'), undefined);
  assert.equal(run('droppedWeapons.length'), 1);
  run('applyRemoteAction(remote,{type:"buy",id:"vandal"})');
  assert.equal(run('remote.record.credits'), 200, 'Remote replacement of a dropped rifle must spend another full price');
  run('applyRemoteAction(remote,{type:"drop"});applyRemoteAction(remote,{type:"buy",id:"vandal"})');
  assert.equal(run('remote.record.credits'), 200); assert.equal(run('remote.record.primary'), null); assert.equal(run('droppedWeapons.length'), 2);
  assert.equal(run('match.phase'), 'buy'); run('clearDrops();remote.record.netPurchases={}');
  console.log('PASS: remote buy-phase rifle drops cannot manufacture free rifles, with normal held-weapon refunds preserved');
  run(`match.round=2;match.phase='buy';remote.record.primary=null;remote.record.credits=3500;remote.record.netPurchases={};remote.netAmmo=3;
    receiveNetPacket('friend',{type:'input',seq:++packetNumber,round:2,input:{x:remote.x,z:remote.z,y:0},actions:[
      {seq:21,round:1,at:elapsed,type:'fire',yaw:0,pitch:0},
      {seq:22,round:2,at:elapsed,type:'buy',id:'spectre'},
      {seq:23,round:2,at:elapsed,type:'buy',id:'vandal'}]});
    updateRemoteActor(remote,.05);`);
  assert.equal(run('netApplied.get("friend")'), 23, 'Old-round actions must advance ACK so current-round purchases cannot deadlock');
  assert.equal(run('remote.record.primary'), 'vandal'); assert.equal(run('remote.record.credits'), 600, 'Remote weapon exchange must include the current-round refund');
  assert.equal(run('remote.netAmmo'), 25);
  run(`match.phase='live';remote.kit.resetRound({reset:true});remote.x=0;remote.z=-10;remote.y=0;
    applyRemoteAction(remote,{type:'ability',key:'e'});elapsed+=1.01;
    netInputs.set('friend',{seq:++packetNumber,round:2,input:{x:0,z:-10,y:0,yaw:0,pitch:0},actions:[],received:elapsed});
    applyRemoteAction(remote,{type:'ability',key:'e',dashX:1,dashZ:0});
    for(let frame=0;frame<4;frame++){elapsed+=.05;updateRemoteActor(remote,.05);}`);
  assert.ok(Math.abs(run('remote.x') - 12) < 1e-6, 'A remote lateral dash must travel its full12m through a5Hz relay');
  assert.equal(run('remote.z'), -10, 'The host must honor the guest lateral dash direction');
  assert.equal(run('remote.dashTimer'), 0);
  run('elapsed+=.05;updateRemoteActor(remote,.05)');
  assert.ok(Math.abs(run('remote.x') - 12) < 1e-6, 'A pre-dash input packet must not pull the host actor backwards after its dash');
  run(`remote.kit.updraft=1;applyRemoteAction(remote,{type:'ability',key:'q'});var activatedRemoteLiftVy=remote.vy;
    netInputs.get('friend').seq=++packetNumber;netInputs.get('friend').input={x:remote.x,z:remote.z,y:8,yaw:0,pitch:0};
    netInputs.get('friend').received=elapsed;updateRemoteActor(remote,.05);`);
  assert.equal(run('activatedRemoteLiftVy'), 7.8, 'The host must activate the remote lift exactly once before subsequent authoritative position samples');
  assert.equal(run('remote.y'), 8, 'Remote updraft positions must not be truncated by the old jump-height cap');
  run('remote.x=0;remote.z=-10;remote.y=0;remote.vy=0');
  run(`match.phase='live';remote.kit.ultPoints=7;activateAbility(remote,'x');applyRemoteAction(remote,{type:'fire',yaw:0,pitch:0},elapsed+1);`);
  assert.equal(run('remote.kit.knives'), 4, 'An authoritative remote knife shot must spend one ultimate knife');
  run(`netInputs.get('friend').receivedAt=Date.now();updateRoom({...online.room,members:online.room.members.map(m=>({...m,connected:m.id!=='friend'}))});`);
  assert.equal(run('remote.remoteId'), 'friend', 'A delayed room heartbeat must not replace an actively sending RTC player with a BOT');
  run(`netInputs.get('friend').receivedAt=Date.now()-21000;updateRoom(online.room);`);
  assert.equal(run('remote.remoteId'), null, 'A disconnected guest must release the same actor for temporary BOT control');
  assert.equal(run('remote.record.memberId'), 'friend', 'BOT substitution must preserve the guest membership');
  assert.equal(run('remote.record.netFallback'), true);
  assert.equal(run('netParticipants.get("friend")'), 'red-0');
  run(`updateRoom({...online.room,members:online.room.members.map(m=>({...m,connected:true}))});
    receiveNetPacket('friend',{type:'input',connection:'reloaded-tab',seq:1,round:2,input:{x:0,z:-10,y:0},actions:[]});`);
  assert.equal(run('remote.remoteId'), 'friend', 'A reconnected guest must reclaim its existing entity');
  assert.equal(run('remote.record.netFallback'), false);
  assert.equal(run('netInputs.get("friend").seq'), 1, 'Reloaded input sequence1 must not be rejected behind the previous tab sequence');
  run(`receiveNetPacket('friend',{type:'input',seq:999,round:2,input:{x:35,z:35,y:0},actions:[]});`);
  assert.equal(run('netInputs.get("friend").seq'), 1, 'An old connection packet must not replace a resumed connection');
  run(`const beforeMutedCue=netCues.length;soundEnabled=false;sound('updraft',{entity:remote});soundEnabled=true;`);
  assert.equal(run('netCues.length'), run('beforeMutedCue+1'), 'Host mute must not suppress the cue sent to other players');
  run(`remote.kit.smoke=2;remote.kit.updraft=1;tickOnline(.1);
    const hostSnapshot=online.sent[online.sent.length-1];hostSnapshot.rules.round=3;hostSnapshot.rules.phase='live';hostSnapshot.rules.roundTime=80;hostSnapshot.acks.friend=23;
    online.host=false;online.session.memberId='friend';online.session.hostId='host';netRound=2;netHasSnapshot=true;netLastSnapshot=0;
    netActions=[{seq:24,round:2,type:'fire',at:elapsed},{seq:25,round:3,type:'equip',weapon:'classic',at:elapsed}];
    receiveNetPacket('host',{...hostSnapshot,seq:100});`);
  assert.equal(run('player.team'), 'red'); assert.equal(run('player.id'), 'red-0');
  assert.equal(run('netActions.map(a=>a.seq).join(",")'), '24,25', 'A new round snapshot must keep unacknowledged old actions for sequence continuity');
  assert.equal(run('player.kit.smoke'), 2); assert.equal(run('player.kit.updraft'), 1);
  assert.equal(run('aliveCount("blue")'), 5); assert.equal(run('aliveCount("red")'), 5);
  const guestClock = run('match.roundTime'), guestHealth = run('player.hp');
  run('mode="play";updatePlay(.2)');
  assert.equal(run('match.roundTime'), guestClock, 'A guest must not advance the host-owned round clock');
  run(`receiveNetPacket('host',{...hostSnapshot,seq:99,actors:hostSnapshot.actors.map(a=>({...a,hp:0}))});`);
  assert.equal(run('player.hp'), guestHealth, 'A delayed snapshot must not overwrite newer health');
  run(`netActions=[];netActionSequence=0;hostSnapshot.acks.friend=230;hostSnapshot.time=elapsed;
    receiveNetPacket('host',{...hostSnapshot,seq:1000});queueNetAction('equip',{weapon:'classic'});`);
  assert.equal(run('netActions[0].seq'), 231, 'A resumed guest must continue action numbering after the host ACK');
  run('netLastSnapshot=100;netActions=[]');
  run(`const previousAudioPlay=gameAudio.play,heardCues=[];gameAudio.play=(type,options)=>heardCues.push({type,options});
    player.x=0;player.z=-10;netSeenCueSequence=0;online.host=false;
    const cuePacket={time:elapsed,rules:{round:3},cues:[{seq:1,round:3,type:'shot',weapon:'vandal',id:'player',x:2,z:-10,time:elapsed}]};
    applyNetCues(cuePacket,true,'red-0');`);
  assert.equal(run('heardCues.length'), 0, 'A first snapshot must not replay past remote sounds');
  run(`cuePacket.cues=[{...cuePacket.cues[0],seq:2,id:'red-0'},{...cuePacket.cues[0],seq:3,type:'smoke'}];applyNetCues(cuePacket,false,'red-0');applyNetCues(cuePacket,false,'red-0');`);
  assert.equal(run('heardCues.length'), 1, 'Remote cues must play once while the owner cue stays excluded');
  assert.equal(run('heardCues[0].type'), 'smoke');
  run(`cuePacket.rules.round=4;cuePacket.cues=[{...cuePacket.cues[0],seq:4,id:'player',round:4}];applyNetCues(cuePacket,true,'red-0');gameAudio.play=previousAudioPlay;`);
  assert.equal(run('heardCues.length'), 1, 'A new round snapshot must suppress old cue replay');
  run(`const predictionBase=new DuelistKit().snapshot();predictionBase.ultPoints=7;
    const predictionSelf=hostSnapshot.actors.find(a=>a.id==='red-0');predictionSelf.kit=predictionBase;predictionSelf.weapon='vandal';predictionSelf.x=0;predictionSelf.z=-10;predictionSelf.y=0;
    hostSnapshot.time=elapsed;hostSnapshot.acks.friend=23;
    netActions=[{seq:24,round:3,type:'ability',key:'e',at:elapsed}];
    receiveNetPacket('host',{...hostSnapshot,seq:101});`);
  assert.ok(run('player.kit.armReadyAt!==null'), 'An old host snapshot must not erase an unacknowledged E arm');
  assert.equal(run('player.kit.dash'), 0);
  run(`const armedPrediction=player.kit.snapshot();predictionSelf.kit=armedPrediction;hostSnapshot.acks.friend=24;hostSnapshot.time=elapsed+1.1;
    netActions=[{seq:25,round:3,type:'ability',key:'e',at:hostSnapshot.time}];
    player.x=12;player.z=-10;player.dashTimer=0;player.netPredictDashUntil=hostSnapshot.time+.6;
    predictionSelf.dashTimer=.18;predictionSelf.dashVec={x:1,z:0};
    receiveNetPacket('host',{...hostSnapshot,seq:102});`);
  assert.equal(run('player.x'), 12, 'A delayed pre-dash position must not pull a predicted dash back');
  assert.equal(run('player.kit.armReadyAt'), null, 'Unacknowledged second E must retain the consumed arm');
  assert.equal(run('player.dashTimer'), 0, 'Restoring a delayed snapshot must not replay completed dash movement');
  run(`predictionSelf.kit=player.kit.snapshot();hostSnapshot.acks.friend=25;hostSnapshot.time+=.1;
    receiveNetPacket('host',{...hostSnapshot,seq:103});`);
  assert.equal(run('player.x'), 12, 'ACK of a completed dash must not immediately undo local prediction');
  assert.equal(run('player.dashTimer'), 0);
  run(`hostSnapshot.time+=1;receiveNetPacket('host',{...hostSnapshot,seq:104});`);
  assert.equal(run('player.x'), 0, 'After the prediction window the authoritative position must reconcile');
  run(`predictionSelf.kit=predictionBase;predictionSelf.weapon='vandal';hostSnapshot.acks.friend=25;
    netActions=[{seq:26,round:3,type:'ability',key:'x',at:elapsed},{seq:27,round:3,type:'fire',ultimate:true,at:elapsed}];
    receiveNetPacket('host',{...hostSnapshot,seq:105});`);
  assert.equal(run('player.kit.knives'), 4, 'Pending X and its ultimate shot must be replayed as state only');
  assert.equal(run('inventory.active'), 'knife', 'An unacknowledged X must keep the predicted knife viewmodel');
  run(`player.vy=7.8;player.dashTimer=.18;hostSnapshot.rules.round=4;hostSnapshot.acks.friend=27;
    receiveNetPacket('host',{...hostSnapshot,seq:106});`);
  assert.equal(run('player.vy'), 0, 'A new-round spawn must not retain the previous updraft velocity');
  assert.equal(run('player.dashTimer'), 0, 'A new-round spawn must clear a previous dash');
  run(`const guardedOnline=online,guardedMatch=match,onlineCloseCalls=[];online.host=true;online.session.memberId='host';
    online.close=notify=>onlineCloseCalls.push(notify);mode='pause';match.score.blue=3;match.score.red=2;updateHUD();`);
  assert.equal(document.getElementById('restart').hidden, true, 'Online pause must hide the offline restart control');
  assert.match(document.getElementById('pause-note').textContent, /試合は進みます/, 'Online pause must explain that the match continues');
  dispatchElement(document.getElementById('restart'), 'click');
  assert.equal(run('match===guardedMatch'), true, 'A stale restart click must not construct a new host match');
  assert.equal(run('match.round'), 4); assert.equal(run('match.score.blue'), 3); assert.equal(run('match.score.red'), 2);
  assert.equal(run('online'), null); assert.equal(run('onlinePlaying'), false); assert.equal(run('mode'), 'menu');
  assert.equal(run('onlineCloseCalls.join(",")'), 'true', 'A stale restart click must leave the online room instead of resetting it');
  assert.equal(run('netSeenCueSequence'), 0, 'Leaving a room must reset cue de-duplication before joining another host');
  run(`online=guardedOnline;onlinePlaying=true;mode='play';setVisible('online-entry',false);setVisible('online-lobby',true);
    updateRoom({...guardedOnline.room,status:'closed'});`);
  assert.equal(run('online'), null); assert.equal(run('onlinePlaying'), false); assert.equal(run('mode'), 'menu');
  assert.equal(run('onlineCloseCalls.join(",")'), 'true,false', 'Host closure must close the client without sending a second leave');
  assert.equal(document.getElementById('online-overlay').hidden, false, 'Host closure must show the room entry dialog');
  assert.equal(document.getElementById('online-entry').hidden, false, 'Host closure must restore create/join controls');
  assert.equal(document.getElementById('online-lobby').hidden, true, 'Host closure must hide the stale member list and start controls');
  assert.match(document.getElementById('online-error').textContent, /新しい部屋/);
  run('startGame()');
  assert.equal(document.getElementById('restart').hidden, false, 'Restart must become available again in an offline match');
  run(`backMenu();const savedSessionReader=RoomClient.savedSession,savedSessionResume=RoomClient.resumeSession,savedRoomOpen=RoomClient.open;
    let finishRestore,entryAttempts=0;RoomClient.savedSession=()=>({code:'TESTROOM'});
    RoomClient.resumeSession=()=>new Promise(resolve=>finishRestore=resolve);RoomClient.open=async()=>{entryAttempts++;throw Error('unexpected create');};`);
  const pendingRestore = run('restoreRoomSession()');
  assert.equal(document.getElementById('online-create').disabled, true); assert.equal(document.getElementById('online-join').disabled, true);
  await run('enterRoom(false)'); await run('enterRoom(true)');
  assert.equal(run('entryAttempts'), 0, 'Create/join must not race an in-flight saved-session recovery');
  run('finishRestore({status:"closed"})'); await pendingRestore;
  assert.equal(document.getElementById('online-create').disabled, false); assert.equal(document.getElementById('online-join').disabled, false);
  run('RoomClient.savedSession=savedSessionReader;RoomClient.resumeSession=savedSessionResume;RoomClient.open=savedRoomOpen;startGame()');
  console.log('PASS: online relay cadence, duplicate fire, round ACK continuity, refund purchases, remote Q/E/knives, red guest identity, pending ability prediction, dash reconciliation, round resets and host-owned clocks');
  console.log('PASS: online pause hides restart, stale restart leaves without resetting host score, and closed rooms restore create/join entry');
  console.log('PASS: temporary BOT handover/reclaim, resumed packet/action numbering, old-connection rejection and remote audio cue ownership/de-duplication');
  console.log('PASS: saved-session recovery disables entry controls and blocks create/join races until its result');

  // Keep an independent guest world and cross a real JSON boundary for the objective lifecycle.
  // Sharing the host's objects would conceal missing snapshot fields and stale round state.
  const cycleElements = new Map(), cycleDocument = { ...document, addEventListener() {}, querySelectorAll: () => [], getElementById(id) {
    if (!cycleElements.has(id)) cycleElements.set(id, makeElement(id));
    return cycleElements.get(id);
  } };
  const cycleContext = { ...sandbox, document: cycleDocument, window: { addEventListener() {} } };
  vm.createContext(cycleContext); vm.runInContext(runnable, cycleContext, { filename: 'game-online-objectives.js' });
  const cycleRun = code => vm.runInContext(code, cycleContext);
  const movementSetup = host => `online={host:${host},session:{memberId:'${host ? 'host' : 'friend'}',hostId:'host'},room:{code:'MOVEMENT',hostId:'host',status:'playing',settings:{format:'standard'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send:capturePeerPacket,close(){}};
    onlinePlaying=true;mode='menu';Object.assign(map.spawnYaw,${JSON.stringify(map.spawnYaw)});$('match-format').value='standard';$('starting-side').value='attack';startGame();match.startLive();netSequence=0;netLastSnapshot=0;netRound=0;netHasSnapshot=false;netClock=0;netInputs.clear();netApplied.clear();netActions=[];netActionSequence=0;`;
  const positionSnapshot = () => {
    run('tickOnline(.1)'); cycleContext.positionPacket = JSON.parse(JSON.stringify(run('online.sent.at(-1)')));
    cycleRun('receiveNetPacket("host",positionPacket)');
    return cycleContext.positionPacket;
  };
  run(`onlinePlaying=false;online=null;$('match-format').value='explore';startGame();player.x=-20;player.z=24;player.yaw=0;keys.add('KeyW');for(let f=0;f<240;f++)updatePlay(1/60)`);
  const soloMovementDistance = 24 - run('player.z'), movementMeasurements = [];
  for (const [delayFrames, relay] of [[0, false], [4, false], [12, false], [4, true]]) {
    run(movementSetup(true)); cycleRun(movementSetup(false));
    run(`var movementActor=bots.find(bot=>bot.id==='red-0');movementActor.x=-20;movementActor.z=24;movementActor.y=0;movementActor.netWeapon='vandal';movementActor.record.primary='vandal';movementActor.netAmmo=25;movementActor.netReserve=75;bots.forEach(bot=>bot.fire=999)`);
    positionSnapshot();
    assertNear(cycleRun('player.yaw'), run('map.spawnYaw.defend'), 'A fresh defending guest must face the defensive spawn direction before sending any input');
    cycleRun('player.yaw=0;keys.add("KeyW")');
    const hostQueue = [], guestQueue = []; let hostSent = 1, guestSent = 0, hostPending, guestPending, backwardCorrections = 0;
    for (let frame = 1; frame <= 240; frame++) {
      for (const entry of guestQueue.filter(entry => entry.frame === frame)) { sandbox.positionInput = entry.packet; run('receiveNetPacket("friend",positionInput)'); }
      run('elapsed+=1/60;updateRemoteActor(movementActor,1/60);tickOnline(1/60)');
      const hostPackets = run('online.sent');
      for (; hostSent < hostPackets.length; hostSent++) hostPending = JSON.parse(JSON.stringify(hostPackets[hostSent]));
      if (hostPending && (!relay || frame % 12 === 0)) { hostQueue.push({ frame: frame + delayFrames, packet: hostPending }); hostPending = null; }
      for (const entry of hostQueue.filter(entry => entry.frame === frame)) {
        cycleContext.positionPacket = entry.packet; const previousZ = cycleRun('player.z'), previousYaw = cycleRun('player.yaw'), previousPitch = cycleRun('player.pitch');
        cycleRun('receiveNetPacket("host",positionPacket)');
        if (cycleRun('player.z') > previousZ + .001) backwardCorrections++;
        assertNear(cycleRun('player.yaw'), previousYaw, 'Ordinary position acknowledgement must preserve mouse yaw');
        assertNear(cycleRun('player.pitch'), previousPitch, 'Ordinary position acknowledgement must preserve mouse pitch');
      }
      cycleRun('updatePlay(1/60);tickOnline(1/60)');
      const guestPackets = cycleRun('online.sent');
      for (; guestSent < guestPackets.length; guestSent++) guestPending = JSON.parse(JSON.stringify(guestPackets[guestSent]));
      if (guestPending && (!relay || frame % 12 === 0)) { guestQueue.push({ frame: frame + Math.max(1, delayFrames), packet: guestPending }); guestPending = null; }
    }
    const distance = 24 - cycleRun('player.z');
    assertNear(distance, soloMovementDistance, 'Normal delayed snapshots must not reduce movement speed through feedback corrections');
    assert.equal(backwardCorrections, 0, 'A normally predicted guest must not be pulled backward every snapshot');
    assert.ok(cycleRun('netPositionAck') > 0, 'This test must actually consume host position acknowledgements');
    assert.ok(cycleRun('netPositionHistory.size') <= 128);
    movementMeasurements.push(`${relay ? '5Hz relay' : '15Hz direct'} RTT ${Math.round(delayFrames / 60 * 2000)}ms: ${distance.toFixed(3)}m`);
  }
  run(movementSetup(true)); cycleRun(movementSetup(false));
  run(`var movementActor=bots.find(bot=>bot.id==='red-0');movementActor.x=0;movementActor.z=0;movementActor.y=0`); positionSnapshot();
  cycleRun('player.x=2;tickOnline(.1);player.x=3;tickOnline(.1);player.x=3.5');
  const positionInputIds = cycleRun('online.sent.map(packet=>packet.seq)');
  run(`movementActor.x=1.5;movementActor.netPositionAck={seq:${positionInputIds[0]},connection:'legacy',round:match.round,x:1.5,z:0}`); positionSnapshot();
  assertNear(cycleRun('player.x'), 3, 'A correction must retain movement since its acknowledged input');
  run(`movementActor.x=2.5;movementActor.netPositionAck={seq:${positionInputIds[1]},connection:'legacy',round:match.round,x:2.5,z:0}`); positionSnapshot(); positionSnapshot();
  assertNear(cycleRun('player.x'), 3, 'Later in-flight inputs and repeated acknowledgements must not apply the same correction twice');
  assert.equal(cycleRun('netPositionHistory.size'), 0);
  cycleRun('tickOnline(.1);player.netPredictDashUntil=elapsed+.6');
  const dashPositionInput = cycleRun('online.sent.at(-1).seq');
  run(`movementActor.x=2.5;movementActor.netPositionAck={seq:${dashPositionInput},connection:'legacy',round:match.round,x:2.5,z:0}`); positionSnapshot();
  assertNear(cycleRun('player.x'), 3, 'An input correction must not restart or interrupt a locally predicted dash');
  run('elapsed+=1'); positionSnapshot(); assertNear(cycleRun('player.x'), 2.5, 'A deferred authoritative correction must be available after dash prediction ends');
  cycleRun('tickOnline(.1)'); assert.ok(cycleRun('netPositionHistory.size') > 0);
  run('match.round=12;match.phase="post";match.nextRound();handleMatchEvents()'); positionSnapshot();
  assert.equal(cycleRun('netPositionHistory.size'), 0); assert.equal(cycleRun('netPositionAck'), 0);
  assertNear(cycleRun('player.yaw'), run('map.spawnYaw.attack'), 'A fresh guest must face the new attacking spawn direction after the side swap');
  assert.equal(cycleRun('netPositionCorrectionX+netPositionCorrectionZ'), 0, 'A new round must discard prior-round correction offsets');

  run(movementSetup(true)); cycleRun(movementSetup(false));
  run('movementActor=bots.find(bot=>bot.id==="red-0");movementActor.x=-20;movementActor.z=12;movementActor.y=0;map.colliders.push({minX:-22,maxX:-18,minZ:10,maxZ:11,height:4})'); positionSnapshot();
  cycleRun('player.z=10.5;tickOnline(.1)'); sandbox.positionInput = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
  run('receiveNetPacket("friend",positionInput);for(let f=0;f<20;f++){elapsed+=1/60;updateRemoteActor(movementActor,1/60)}');
  assert.equal(run('map.collision.blocked(movementActor.x,movementActor.z,.34,0)'), false, 'The authoritative actor must stop before a wall');
  positionSnapshot(); assertNear(cycleRun('player.z'), run('movementActor.z'), 'A collision-rejected prediction must return to the authoritative side of the wall');
  run('map.colliders.pop();movementActor.x=0;movementActor.z=0'); cycleRun('player.x=10;player.z=0;tickOnline(.1)');
  sandbox.positionInput = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
  run('receiveNetPacket("friend",positionInput);elapsed+=1/60;updateRemoteActor(movementActor,1/60)');
  assert.ok(run('movementActor.x') <= 7 * 1.15 / 60 + 1e-9, 'Input reconciliation must retain the host movement-speed limit');
  positionSnapshot(); assertNear(cycleRun('player.x'), run('movementActor.x'), 'A large invalid position jump must snap to host authority');
  cycleRun('for(let f=0;f<150;f++)tickOnline(.1)'); assert.equal(cycleRun('netPositionHistory.size'), 128, 'Unacknowledged position history must stay bounded during communication loss');
  console.log(`PASS: acknowledged input reconciliation, collision/speed authority, pending movement, duplicate corrections, dash deferral, round reset and spawn view; ${movementMeasurements.join('; ')}`);

  run(movementSetup(true)); cycleRun(movementSetup(false));
  run('match.phase="buy";match.phaseTime=45'); positionSnapshot();
  for (const afterSwap of [false, true]) {
    if (afterSwap) { run('match.round=12;match.phase="post";match.nextRound();handleMatchEvents()'); positionSnapshot(); }
    const guestSide = afterSwap ? 'attack' : 'defend', hostSide = afterSwap ? 'defend' : 'attack';
    assertNear(cycleRun('player.yaw'), map.spawnYaw[guestSide], 'Guest first-snapshot orientation must use the real map metadata before and after the side swap');
    assertNear(run('player.yaw'), map.spawnYaw[hostSide], 'Host first-snapshot orientation must use the real map metadata before and after the side swap');
    for (const [worldRun, side] of [[run, hostSide], [cycleRun, guestSide]]) {
      worldRun('var ownBuyArea=map.buyAreas[ownSide()];player.x=ownBuyArea.x;player.z=ownBuyArea.z;player.yaw=0;keys.add("KeyD");for(let f=0;f<60;f++)updatePlay(1/60)');
      assert.ok(worldRun('player.x-ownBuyArea.x') > 4, `The ${side} player must be able to move during its own purchase phase`);
      worldRun('for(let f=0;f<240;f++)updatePlay(1/60);keys.clear()');
      assert.ok(worldRun('Math.hypot(player.x-ownBuyArea.x,player.z-ownBuyArea.z)') < worldRun('ownBuyArea.radius-.34'), `The ${side} player must stay inside its own purchase boundary`);
      assert.ok(worldRun('Math.hypot(player.x-ownBuyArea.x,player.z-ownBuyArea.z)') > worldRun('ownBuyArea.radius-1'), 'The barrier test must actually reach the boundary');
      assert.equal(worldRun('match.phase'), 'buy');
    }
  }
  console.log('PASS: blue host and red guest can move within their own buy areas, stay bounded, and swap area/view direction next half');

  // Stair climbing must cross the real slab edge through independent guest prediction
  // and host collision, rather than teleporting a fixture actor onto an upper floor.
  {
    const terrainKeys = ['colliders', 'collision', 'ramps', 'bounds'];
    const hostTerrain = Object.fromEntries(terrainKeys.map(key => [key, arena[key]]));
    const guestMap = cycleRun('map'), guestTerrain = Object.fromEntries(terrainKeys.map(key => [key, guestMap[key]]));
    sandbox.stairTerrain = cycleContext.stairTerrain = Object.fromEntries(terrainKeys.map(key => [key, map[key]]));
    const stairCases = [{ name: 'western station stair', x: -69.5, bottomZ: -7, deckZ: -30.5, nearZ: -10, farZ: -28, inward: 'KeyD', outward: 'KeyA' },
      { name: 'eastern Mewe stair', x: 72.5, bottomZ: 17, deckZ: -11.5, nearZ: 14, farZ: -8, inward: 'KeyA', outward: 'KeyD' }];
    const stairResults = [];
    try {
      run('Object.assign(map,stairTerrain)'); cycleRun('Object.assign(map,stairTerrain)');
      const resetLocalStair = (x, z, y = 0) => run(`onlinePlaying=false;online=null;$('match-format').value='explore';startGame();clearBots();clearCombatInput();inventory.active='classic';Object.assign(player,{x:${x},z:${z},y:${y},vy:0,vx:0,vz:0,yaw:0,dashTimer:0})`);
      const walkLocalStair = (held, frames, inspect) => {
        run(`keys.clear();${held.map(key => `keys.add(${JSON.stringify(key)});`).join('')}`);
        for (let frame = 0; frame < frames; frame++) { run('updatePlay(1/60)'); inspect?.(frame); }
      };
      const assertOnStair = label => {
        const state = JSON.parse(run('JSON.stringify({x:player.x,z:player.z,y:player.y,vy:player.vy,floor:rampFloor(player.x,player.z)})'));
        assert.ok(state.floor !== null && Math.abs(state.y - state.floor) < 1e-7 && state.vy === 0,
          `${label} must remain on the staircase instead of passing its visible handrail and falling inside it: ${JSON.stringify(state)}`);
      };
      // Reported route: ordinary diagonal walking could cross the western handrail.
      resetLocalStair(-69.5, -7);
      walkLocalStair(['KeyW'], 120);
      walkLocalStair(['KeyW', 'KeyA'], 90, () => assertOnStair('Western W2s→WA1.5s'));
      for (const stair of stairCases) for (const side of ['KeyA', 'KeyD']) for (const ascending of [true, false]) {
        const z = ascending ? stair.nearZ - 4 : stair.farZ + 4;
        resetLocalStair(stair.x, z, 3.2 * (stair.nearZ - z) / (stair.nearZ - stair.farZ));
        walkLocalStair([ascending ? 'KeyW' : 'KeyS', side], 90,
          () => assertOnStair(`${stair.name}/${side}/${ascending ? 'up' : 'down'}`));
      }
      for (const guard of [{ name: 'western deck', x: -69.5, z: -30.5, key: 'KeyA', axis: 'x', edge: -72, direction: -1 },
        { name: 'eastern deck', x: 74, z: -11.5, key: 'KeyD', axis: 'x', edge: 76, direction: 1 },
        { name: 'western stair shoulder', x: -65.5, z: -30.5, key: 'KeyS', axis: 'z', edge: -28, direction: 1 },
        { name: 'eastern inner stair shoulder', x: 69.275, z: -11.5, key: 'KeyS', axis: 'z', edge: -8, direction: 1 },
        { name: 'eastern outer stair shoulder', x: 75.5, z: -11.5, key: 'KeyS', axis: 'z', edge: -8, direction: 1 }]) {
        resetLocalStair(guard.x, guard.z, 3.2);
        walkLocalStair([guard.key], 90, () => assertNear(run('player.y'), 3.2, `${guard.name} visible side guard must stop walking falls`));
        assert.ok(guard.direction < 0 ? run(`player.${guard.axis}`) >= guard.edge : run(`player.${guard.axis}`) <= guard.edge);
      }
      for (const stair of stairCases) {
        const jumpZ = stair.farZ + 2, jumpY = 3.2 * (stair.nearZ - jumpZ) / (stair.nearZ - stair.farZ);
        resetLocalStair(stair.x, jumpZ, jumpY); run('jump()');
        let peak = jumpY;
        walkLocalStair(['KeyW'], 60, () => { peak = Math.max(peak, run('player.y')); });
        assert.ok(Math.abs(peak - jumpY - 1.4309568) < .005, `${stair.name} top-step jump must retain its adjusted ordinary ballistic rise`);
        assertNear(run('player.y'), 3.2, `${stair.name} jump must land on the connected deck instead of falling below its slab`);
        assertNear(run('player.vy'), 0, 'A landed jump must restore grounded movement');
      }
      for (const hz of [20, 60, 144]) for (const movement of ['under-deck Q', 'open Q', 'under-deck jump']) {
        const belowDeck = movement !== 'open Q';
        resetLocalStair(belowDeck ? -50 : 0, belowDeck ? -30.5 : 26);
        if (movement.endsWith('Q')) {
          run('player.kit.updraft=1;activateAbility(player,"q")');
          assertNear(run('player.kit.updraft'), 0, 'The ceiling case must exercise a real consumed Q activation');
        } else run('jump()');
        let peak = 0;
        for (let frame = 0; frame < Math.ceil(hz * 1.5); frame++) { run(`updatePlay(${1 / hz})`); peak = Math.max(peak, run('player.y')); }
        if (movement === 'under-deck Q') assert.ok(peak > 1 && peak <= 1.1 + 1e-9,
          `${hz}Hz Q must stop its1.7m body below the actual2.8m underside, got feet peak ${peak}`);
        else assert.ok(Math.abs(peak - (movement === 'open Q' ? 2.028 : 1.1)) < .006,
          `${hz}Hz ${movement} must retain its ballistic height or stop below the actual deck ceiling, got ${peak}`);
        assertNear(run('player.y'), 0, `${movement} must return to the ground after the rise`);
        assertNear(run('player.vy'), 0, 'Landing must clear vertical velocity');
      }
      for (const hz of [20, 60, 144]) {
        resetLocalStair(68, -11.5, 3.2); run('keys.add("KeyW")');
        let reachedThreshold = false;
        for (let frame = 0; frame < Math.ceil(hz * 1.5); frame++) {
          const beforeY = run('player.y'); run(`updatePlay(${1 / hz})`);
          const y = run('player.y'); reachedThreshold ||= y > 3.2 && y < 3.45;
          assert.ok(y >= 3.2 && y <= 3.45 + 1e-9 && y >= beforeY - 1e-9 && y - beforeY <= .22 + 1e-9,
            `${hz}Hz walking from the Mewe deck to its visible canopy must remain supported through ankle-height rises, got ${y}`);
          assertNear(run('player.vy'), 0, 'The Mewe canopy connection must require neither jumping nor falling');
        }
        assert.equal(reachedThreshold, true, 'The Mewe crossing must use the visible intermediate threshold');
        assert.ok(run('player.z') < -16, 'The walking test must cross the old unsupported north deck edge');
        assertNear(run('player.y'), 3.45, 'The continuous visible canopy must finish at its actual3.45m top');
        run('keys.clear();keys.add("KeyS")');
        for (let frame = 0; frame < Math.ceil(hz * 1.5); frame++) {
          run(`updatePlay(${1 / hz})`);
          assert.ok(run('player.y') >= 3.2 && run('player.y') <= 3.45 + 1e-9, 'Returning from the canopy must retain a connected supporting floor');
        }
        assertNear(run('player.y'), 3.2, `${hz}Hz return walking must finish on the original deck`);
        assertNear(run('player.vy'), 0, 'The return to the deck must finish grounded');
      }
      for (const hz of [20, 60, 144]) {
        // The pictured sign sits above this central entrance roof, not the
        // unchanged5.92m wing canopies. Jump from its recessed front walkway.
        resetLocalStair(-20.75, -28.7, 3.2); run('jump();keys.add("KeyW")');
        for (let frame = 0; frame < Math.ceil(hz * .6); frame++) run(`updatePlay(${1 / hz})`);
        run('keys.clear()');
        for (let frame = 0; frame < hz; frame++) run(`updatePlay(${1 / hz})`);
        assert.ok(run('player.z') < -31.24, `${hz}Hz normal jump crosses the front edge with a full body radius`);
        assertNear(run('player.y'), 4.45, `${hz}Hz normal jump lands on the lowered sign canopy`);
        assertNear(run('player.vy'), 0, 'Canopy landing is stable');
        run('keys.add("KeyS")');
        for (let frame = 0; frame < Math.ceil(hz * .5); frame++) run(`updatePlay(${1 / hz})`);
        run('keys.clear()');
        for (let frame = 0; frame < hz; frame++) run(`updatePlay(${1 / hz})`);
        assertNear(run('player.y'), 3.2, `${hz}Hz leaving the canopy lands back on the real deck`);
        resetLocalStair(-31, -29, 3.2); run('keys.add("KeyD")');
        for (let frame = 0; frame < Math.ceil(hz * 4.1); frame++) run(`updatePlay(${1 / hz})`);
        run('keys.clear()');
        assert.ok(run('player.x') > -11, 'The front walking strip still joins both station wings');
        assertNear(run('player.y'), 3.2, 'Standing-height deck travel stays clear of the lowered roof');
        resetLocalStair(-20.75, -26.5, 0); run('keys.add("KeyW")');
        for (let frame = 0; frame < Math.ceil(hz * 2); frame++) run(`updatePlay(${1 / hz})`);
        run('keys.clear()');
        assert.ok(run('player.z') < -35, 'The original ground-level concourse entry stays open');
        assertNear(run('player.y'), 0, 'Walking below the canopy never snaps onto the roof');
      }
      console.log('PASS: lowered JR sign canopy normal-jump landing/return at20/60/144Hz, full deck walking strip and ground concourse underpass');
      const landingSurfaces = [
        { name: 'Mewe canopy', x: 68, z: -17, top: 3.45, rates: [20, 60, 144] },
        { name: 'bus shelter roof', x: -58, z: 0, top: 4.49, rates: [20, 60, 144] },
        { name: 'station western canopy', x: -45, z: -30.5, top: 5.92, rates: [20, 60, 144] },
        { name: 'station eastern canopy', x: 4, z: -30.5, top: 5.92 },
        { name: 'southern stone bench', x: -27, z: 66, top: .79, rates: [20, 60, 144] },
        { name: 'western retail front canopy', x: -30, z: 43, top: 3.725, rates: [20, 60, 144] },
        { name: 'western retail side canopy', x: -44, z: 25, top: 3.725 },
        { name: 'western small canopy15', x: -45.1, z: 15, top: 2.89 },
        { name: 'western small canopy35', x: -45.1, z: 35, top: 2.89 },
        { name: 'eastern retail side canopy', x: 43.5, z: 25, top: 3.62 },
        { name: 'information pavilion roof', x: 6.5, z: 14, top: 4.425 },
        { name: 'staff building roof', x: 29, z: -44, top: 5.4 },
        { name: 'central divider roof', x: 0, z: -15, top: 6.96 },
        { name: 'station portal roof', x: -20.75, z: -32, top: 4.45 },
      ];
      for (const surface of landingSurfaces) for (const hz of surface.rates || [60]) {
        resetLocalStair(surface.x, surface.z, surface.top + .75); run('player.vy=-.1');
        run(`for(let frame=0;frame<${Math.ceil(hz * 1.5)};frame++)updatePlay(${1 / hz})`);
        assertNear(run('player.y'), surface.top, `${surface.name}/${hz}Hz must stop a descending actor at the visible top instead of passing through it`);
        assertNear(run('player.vy'), 0, `${surface.name} landing must remain stable after impact`);
      }
      // Isolate the physics from the rail: a brief edge exit must not permit an
      // airborne actor to re-enter below the ramp surface and become immobilised.
      const railCollision = arena.collision, railColliders = arena.colliders;
      try {
        arena.colliders = []; arena.collision = createCollisionIndex(arena.colliders);
        resetLocalStair(-71.98, -20, 3.2 * 10 / 18);
        walkLocalStair(['KeyA'], 2);
        const noBurial = () => assert.equal(run('rampFloor(player.x,player.z)!==null&&player.y<rampFloor(player.x,player.z)-.00001'), false,
          'A descending actor must be blocked outside a higher ramp, not enter its solid interior');
        walkLocalStair(['KeyD'], 12, noBurial); walkLocalStair([], 48, noBurial);
        assertNear(run('player.y'), 0, 'An actor who leaves an unguarded stair must land on the outside ground');
        const groundZ = run('player.z'); walkLocalStair(['KeyS'], 12);
        assert.ok(run('player.z') > groundZ + .5, 'The actor must retain a walking escape instead of being trapped beneath a high tread');
      } finally { arena.colliders = railColliders; arena.collision = railCollision; }
      for (const underpass of [{ x: -74, z: -31, key: 'KeyD', end: -70.5 }, { x: 78, z: -13, key: 'KeyA', end: 74.5 }]) {
        resetLocalStair(underpass.x, underpass.z);
        walkLocalStair([underpass.key], 45);
        assertNear(run('player.y'), 0, 'Elevated side rails must retain the ground passage beneath the deck');
        assert.ok(underpass.key === 'KeyD' ? run('player.x') > underpass.end : run('player.x') < underpass.end);
      }
      assert.equal(map.collision.rayClear(-70, 4.9, -30.5, -74, 4.9, -30.5), true, 'Standing deck eyes must retain the sight line above the western upper bar');
      assert.equal(map.collision.rayClear(74, 4.9, -11.5, 78, 4.9, -11.5), true, 'Standing deck eyes must retain the sight line above the eastern upper bar');
      console.log('PASS: reported diagonal stair fall, both side rails ascending/descending, deck guards, airborne ramp re-entry, underpasses, ceiling-limited Q, Mewe walkable canopy connection and14 visible landing surfaces');
      for (const entry of [{ name: 'east', x: 75.5, z: 3, edge: 75 }, { name: 'west', x: -66.5, z: -19, edge: -67 }]) {
        for (const remote of [false, true]) {
          if (remote) {
            run(movementSetup(true));
            run(`movementActor=bots.find(bot=>bot.id==='red-0');Object.assign(movementActor,{x:${entry.x},z:${entry.z},y:0,dashTimer:0});
              for(let frame=0;frame<20;frame++){elapsed+=1/60;receiveNetPacket('friend',{type:'input',seq:frame+1,round:match.round,input:{x:${entry.x}-.8,z:${entry.z},y:0,yaw:0,pitch:0},actions:[]});updateRemoteActor(movementActor,1/60)}`);
          } else {
            run(`onlinePlaying=false;online=null;$('match-format').value='explore';startGame();clearBots();Object.assign(player,{x:${entry.x},z:${entry.z},y:0,vy:0,vx:0,vz:0,yaw:0});keys.add('KeyA');for(let frame=0;frame<20;frame++)updatePlay(1/60);keys.clear()`);
          }
          const entity = remote ? 'movementActor' : 'player';
          assert.ok(run(`${entity}.x`) >= entry.edge, `${remote ? 'Remote' : 'Local'} ${entry.name} side entry must stop outside a1.6m-high staircase, got ${run(`${entity}.x`)}`);
          assertNear(run(`${entity}.y`), 0, 'The side approach must neither enter the visible steps at ground height nor teleport upstairs');
        }
      }
      for (const hz of [20, 60]) for (const stair of stairCases) {
        run(movementSetup(true)); cycleRun(movementSetup(false));
        run(`movementActor=bots.find(bot=>bot.id==='red-0');Object.assign(movementActor,{x:${stair.x},z:${stair.bottomZ},y:0,netYaw:0});`);
        positionSnapshot(); cycleRun('player.yaw=0;clearCombatInput();inventory.active="classic"');
        let hostRead = run('online.sent.length'), guestRead = cycleRun('online.sent.length');
        let maxGuestY = 0, maxHostY = 0, allowStairJump = false;
        function stairFrame() {
          cycleRun(`updatePlay(${1 / hz});tickOnline(${1 / hz})`);
          const inputs = cycleRun('online.sent');
          for (; guestRead < inputs.length; guestRead++) {
            sandbox.stairInput = JSON.parse(JSON.stringify(inputs[guestRead])); run('receiveNetPacket("friend",stairInput)');
          }
          run(`elapsed+=${1 / hz};updateRemoteActor(movementActor,${1 / hz});tickOnline(${1 / hz})`);
          const snapshots = run('online.sent');
          for (; hostRead < snapshots.length; hostRead++) {
            cycleContext.stairSnapshot = JSON.parse(JSON.stringify(snapshots[hostRead])); cycleRun('receiveNetPacket("host",stairSnapshot)');
          }
          maxGuestY = Math.max(maxGuestY, cycleRun('player.y'));
          maxHostY = Math.max(maxHostY, run('movementActor.y||0'));
          if (!allowStairJump) assert.ok(cycleRun('player.vy<=1e-8'), `${stair.name} ordinary walking must not inject a jump`);
        }
        function stairWalk(keys, seconds) {
          cycleRun(`keys.clear();${keys.map(key => `keys.add(${JSON.stringify(key)});`).join('')}`);
          for (let frame = 0; frame < Math.ceil(seconds * hz); frame++) stairFrame();
        }
        cycleRun('keys.add("KeyW")');
        let ascentFrames = 0;
        while (cycleRun('player.z') > stair.deckZ && ascentFrames++ < hz * 8) stairFrame();
        stairWalk([], .4);
        const ascentState = JSON.parse(run('JSON.stringify({x:movementActor.x,y:movementActor.y,z:movementActor.z})'));
        assert.ok(ascentState.z <= stair.deckZ + .2, `${stair.name} ${hz}Hz guest must cross the actual deck entrance; host stopped at ${JSON.stringify(ascentState)}`);
        assertNear(cycleRun('player.y'), 3.2, `${stair.name} guest must reach the real3.2m deck from the ground`);
        assertNear(run('movementActor.y'), 3.2, `${stair.name} host must accept the guest on the same deck`);
        assert.ok(maxGuestY <= 3.2 + 1e-8 && maxHostY <= 3.2 + 1e-8, 'A stair climb must not inject a jump or extra height');
        const deckStartX = cycleRun('player.x');
        stairWalk([stair.inward], .5); stairWalk([], .25);
        assert.ok(Math.abs(deckStartX - cycleRun('player.x')) > 2, `${stair.name} guest must be able to walk sideways across the deck`);
        assertNear(cycleRun('player.y'), 3.2, 'Deck sidestepping must preserve the guest upper floor');
        assertNear(run('movementActor.y'), 3.2, 'Deck sidestepping must preserve the authoritative upper floor');
        stairWalk([stair.outward], .5); stairWalk([], .25);
        assert.ok(Math.abs(cycleRun('player.x') - stair.x) < .15, 'The return sidestep must line up with the real stair width');
        cycleRun('keys.add("KeyS")');
        let descentFrames = 0;
        while (cycleRun('player.z') < stair.nearZ + 1.5 && descentFrames++ < hz * 8) stairFrame();
        stairWalk([], .4);
        assert.ok(run('movementActor.z') >= stair.nearZ + 1.3, `${stair.name} host must allow walking back down to the ground`);
        assertNear(cycleRun('player.y'), 0, `${stair.name} guest descent must finish on the ground`);
        assertNear(run('movementActor.y'), 0, `${stair.name} host descent must finish on the ground`);
        assert.ok(cycleRun('netPositionAck') > 0, 'The climb must really reconcile host acknowledgements');
        assert.ok(Math.hypot(run('movementActor.x') - cycleRun('player.x'), run('movementActor.z') - cycleRun('player.z')) < .05, 'Both peers must converge after stopping on each floor');
        if (hz === 60) {
          cycleRun('keys.clear();keys.add("KeyW")');
          let guardAscentFrames = 0;
          while (cycleRun('player.z') > stair.deckZ && guardAscentFrames++ < hz * 8) stairFrame();
          stairWalk([], .4);
          assertNear(cycleRun('player.y'), 3.2, 'The guest must reach the deck again before exercising its side guard');
          stairWalk([stair.outward], 1.5); stairWalk([], .4);
          assertNear(cycleRun('player.y'), 3.2, 'A guest pressing against the real deck side guard must stay upstairs');
          assertNear(run('movementActor.y'), 3.2, 'The authoritative host must retain the same upper floor at the side guard');
          assert.ok(Math.hypot(run('movementActor.x') - cycleRun('player.x'), run('movementActor.z') - cycleRun('player.z')) < .05, 'Guard collision and position acknowledgements must converge on both peers');
          if (stair.name.startsWith('western')) {
            run('Object.assign(movementActor,{x:-50,z:-30.5,y:0,netPositionAck:null});movementActor.kit.updraft=1;netInputs.clear()');
            cycleRun('netHasSnapshot=false;clearCombatInput()'); positionSnapshot();
            cycleRun('useAbility("q")'); allowStairJump = true; maxGuestY = 0; maxHostY = 0;
            stairWalk([], 1.5);
            assert.ok(maxGuestY > 1 && maxGuestY <= 1.1 + 1e-9, 'A real guest Q must stop below the deck ceiling before sending its position');
            assert.ok(maxHostY > 1 && maxHostY <= 1.1 + 1e-9, 'JSON input and snapshots must retain the same ceiling-limited height on the host');
            assertNear(cycleRun('player.y'), 0, 'The guest must land after touching the underside');
            assertNear(run('movementActor.y'), 0, 'The authoritative actor must finish on the same ground');
            assertNear(run('movementActor.kit.updraft'), 0, 'The host must accept and consume the actual guest ability action');
          }
        }
        stairResults.push(`${stair.name}/${hz}Hz ${(ascentFrames / hz).toFixed(2)}s up`);
      }
      run(movementSetup(true)); cycleRun(movementSetup(false));
      run('movementActor=bots.find(bot=>bot.id==="red-0");Object.assign(movementActor,{x:-20.75,z:-28.7,y:3.2,netYaw:0});netInputs.clear()');
      positionSnapshot(); cycleRun('clearCombatInput();inventory.active="classic";player.yaw=0;player.vy=0;jump();keys.add("KeyW")');
      let canopyGuestRead = cycleRun('online.sent.length'), canopyHostRead = run('online.sent.length');
      for (let frame = 0; frame < 100; frame++) {
        if (frame === 36) cycleRun('keys.clear()');
        cycleRun('updatePlay(1/60);tickOnline(1/60)');
        const inputs = cycleRun('online.sent');
        for (; canopyGuestRead < inputs.length; canopyGuestRead++) { sandbox.canopyInput=JSON.parse(JSON.stringify(inputs[canopyGuestRead]));run('receiveNetPacket("friend",canopyInput)'); }
        run('elapsed+=1/60;updateRemoteActor(movementActor,1/60);tickOnline(1/60)');
        const snapshots = run('online.sent');
        for (; canopyHostRead < snapshots.length; canopyHostRead++) { cycleContext.canopySnapshot=JSON.parse(JSON.stringify(snapshots[canopyHostRead]));cycleRun('receiveNetPacket("host",canopySnapshot)'); }
      }
      assertNear(cycleRun('player.y'),4.45,'Independent JSON guest lands on the lowered sign canopy');
      assertNear(run('movementActor.y'),4.45,'Host accepts the same real canopy support');
      assert.ok(cycleRun('netPositionAck')>0,'Canopy landing really crosses input and authoritative snapshot acknowledgements');
      console.log('PASS: independent JSON guest-to-host normal jump onto the lowered station sign canopy');
    } finally {
      Object.assign(arena, hostTerrain); Object.assign(guestMap, guestTerrain);
      delete sandbox.stairTerrain; delete cycleContext.stairTerrain;
    }
    console.log(`PASS: real western/eastern stairs0↔3.2m, guest→host JSON collision/ACK and upper-deck sidesteps; ${stairResults.join('; ')}`);
  }

  // Objective eligibility must agree for the local host and an input-driven guest.
  // Real displacement matters here: dash deliberately zeroes the ordinary velocity fields.
  run(`online={host:true,session:{memberId:'host',hostId:'host'},room:{code:'OBJECTIVE-CONDITIONS',hostId:'host',status:'playing',settings:{format:'standard'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send:capturePeerPacket,close(){}};
    onlinePlaying=true;mode='menu';$('match-format').value='standard';$('starting-side').value='attack';startGame();
    var conditionActor=bots.find(bot=>bot.id==='red-0'),conditionSequence=0;
    function conditionSetup(remote,kind){
      match=new MatchRules({startingSide:(remote===(kind==='plant'))?'defend':'attack'});match.startLive();match.events=[];
      clearCombatInput();netInputs.clear();netApplied.clear();mode='play';exploring=false;objectivePractice=null;rangeSession=null;
      player.alive=true;player.hp=100;player.team='blue';player.x=0;player.z=-18;player.y=0;player.vy=0;player.vx=0;player.vz=0;player.yaw=0;player.crouch=0;player.dashTimer=0;player.dashVec={x:1,z:0};inventory.active='classic';
      bots.forEach((bot,i)=>{bot.alive=true;bot.hp=100;bot.remoteId='condition-idle-'+i;bot.x=-35+i*3;bot.z=35;bot.y=0;bot.dashTimer=0;bot.planting=false;bot.defusing=false;bot.target=null;});
      conditionActor.remoteId='friend';conditionActor.y=0;conditionActor.dashVec={x:1,z:0};conditionActor.netDashInputSequence=-1;
      if(remote){conditionActor.x=0;conditionActor.z=-18;player.x=30;player.z=30;}
      if(kind==='defuse')match.interactPlant(4,{actorId:remote?'player':'red-0',team:match.attackerTeam,site:'A',x:0,z:-18});
    }
    function conditionTick(remote,frames,{speed=0,height=0,held=true}={}){
      interactionHeld=held;touchMove={x:speed/(5.4*1.15),y:0};
      for(let frame=0;frame<frames;frame++){
        if(remote){elapsed+=.05;receiveNetPacket('friend',{type:'input',seq:++conditionSequence,round:match.round,input:{x:conditionActor.x+speed*.05,z:conditionActor.z,y:height,yaw:0,pitch:0,interact:held},actions:[]});updateRemoteActor(conditionActor,.05);}
        else updatePlay(.05);
      }
    }`);
  for (const remote of [false, true]) {
    const owner = remote ? 'Remote guest' : 'Local host';
    run(`conditionSetup(${remote},'plant');conditionTick(${remote},79)`);
    assert.equal(run('match.spike.status'), 'carried', `${owner} plant must take the real four seconds`);
    run(`conditionTick(${remote},1)`); assert.equal(run('match.spike.status'), 'planted');
    run(`conditionSetup(${remote},'defuse');conditionTick(${remote},30);conditionTick(${remote},1,{held:false})`);
    assert.equal(run('match.spike.defuseProgress'), 0, `${owner} release before halfway must cancel the incomplete defuse`);
    run(`conditionTick(${remote},70);conditionTick(${remote},1,{held:false})`);
    assert.equal(run('match.spike.checkpoint'), 3.5); assert.equal(run('match.spike.defuseProgress'), 3.5);
    run(`conditionTick(${remote},69)`); assert.equal(run('match.spike.status'), 'planted');
    run(`conditionTick(${remote},1)`); assert.equal(run('match.spike.status'), 'defused', `${owner} must resume the saved half and complete the remaining 3.5 seconds`);

    for (const kind of ['plant', 'defuse']) {
      run(`conditionSetup(${remote},'${kind}');conditionTick(${remote},80,{speed:.3})`);
      assertNear(run(remote ? 'conditionActor.x' : 'player.x'), 1.2, 'The slow-creep test must actually move 1.2m');
      assert.equal(run(`match.spike.${kind==='plant'?'plantProgress':'defuseProgress'}`), 0, `${owner} must not ${kind} while creeping at 0.3m/s`);
      run(`conditionSetup(${remote},'${kind}');conditionTick(${remote},1,{speed:.24})`);
      assertNear(run(`match.spike.${kind==='plant'?'plantProgress':'defuseProgress'}`), .05, `${owner} must use the same permitted sub-0.25m/s tolerance`);
      for (const height of [.26, 1.0453333333]) {
        run(`conditionSetup(${remote},'${kind}');${remote?'':`player.y=${height};player.vy=${height<1?5.6:0};`}conditionTick(${remote},1,{height:${height}})`);
        assert.equal(run(`match.spike.${kind==='plant'?'plantProgress':'defuseProgress'}`), 0, `${owner} must not ${kind} in the rising jump or at its apex`);
      }
      run(`conditionSetup(${remote},'${kind}');map.colliders.push({minX:-1,maxX:1,minZ:-19,maxZ:-17,height:1.7});player.y=${remote?0:1.7};conditionTick(${remote},80,{height:1.7})`);
      assert.equal(run(`match.spike.${kind==='plant'?'plantProgress':'defuseProgress'}`), 0, `${owner} must not ${kind} on a 1.7m crate when the objective has no vertical coordinate`);
      if (!remote) assertNear(run('player.y'), 1.7, 'The high-cover test must remain physically supported on the crate');
      run('map.colliders.pop()');
    }
    run(`conditionSetup(${remote},'plant');map.sites[0].radius=20;${remote?'conditionActor':'player'}.x=-10;${remote?'conditionActor':'player'}.dashTimer=.18`);
    for (let frame = 0; frame < 4; frame++) {
      run(`conditionTick(${remote},1)`);
      assert.equal(run('match.spike.plantProgress'), 0, `${owner} dash must interrupt planting, including its last partial frame`);
    }
    assertNear(run(remote ? 'conditionActor.x' : 'player.x'), 2, 'The dash test must actually travel its full 12m inside the enlarged site');
    run(`conditionTick(${remote},80)`); assert.equal(run('match.spike.status'), 'planted', `${owner} can plant after the dash ends and four stationary seconds pass`);
    run('map.sites[0].radius=5');
  }
  console.log('PASS: local/remote ground-only 4s plant and 7s/3.5s defuse, matching 0.25m/s tolerance, slow-creep/jump/apex/crate rejection and actual dash displacement');

  run(`online={host:true,session:{memberId:'host',hostId:'host'},room:{code:'CYCLE',hostId:'host',status:'playing',settings:{format:'standard'},members:[
      {id:'host',name:'HOST',team:'blue',connected:true},{id:'cover',name:'COVER',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send:capturePeerPacket,close(){}};
    onlinePlaying=true;netHasSnapshot=false;netHostPaused=false;netInputs.clear();netApplied.clear();netSequence=0;mode='menu';
    $('match-format').value='standard';$('starting-side').value='defend';startGame();startRound();player.x=30;player.z=30;
    const cycleAttack=bots.find(bot=>bot.id==='red-0'),cycleDefense=bots.find(bot=>bot.id==='blue-1');
    bots.forEach(bot=>bot.fire=999);cycleAttack.x=0;cycleAttack.z=-18;cycleAttack.y=0;cycleAttack.hp=83;cycleAttack.armor=50;
    cycleAttack.record.primary='vandal';cycleAttack.netWeapon='vandal';cycleAttack.netAmmo=7;cycleAttack.netReserve=19;
    cycleDefense.x=18;cycleDefense.z=18;cycleDefense.y=0;cycleDefense.hp=41;cycleDefense.armor=17;
    cycleDefense.record.primary='phantom';cycleDefense.netWeapon='phantom';cycleDefense.netAmmo=3;cycleDefense.netReserve=11;
    cycleDefense.kit.smoke=2;cycleDefense.kit.updraft=1;cycleDefense.kit.ultPoints=4;
    let cyclePacketNumber=0;
    function cycleHold(actor,memberId,interact,frames){for(let frame=0;frame<frames;frame++){
      elapsed+=.05;receiveNetPacket(memberId,{type:'input',seq:++cyclePacketNumber,round:match.round,input:{x:actor.x,z:actor.z,y:actor.y,yaw:0,pitch:0,interact},actions:[]});
      updateRemoteActor(actor,.05);match.tick(.05,{blueAlive:aliveCount('blue'),redAlive:aliveCount('red'),playerAlive:player.alive});handleMatchEvents();
    }}
    function cycleAction(actor,memberId,action){const seq=(netApplied.get(memberId)||0)+1;elapsed+=.05;
      receiveNetPacket(memberId,{type:'input',seq:++cyclePacketNumber,round:match.round,input:{x:actor.x,z:actor.z,y:actor.y,yaw:0,pitch:0},actions:[{...action,seq,round:match.round,at:elapsed}]});
      updateRemoteActor(actor,.05);return seq;
    }`);
  const cycleRoom = JSON.parse(JSON.stringify(run('online.room')));
  cycleContext.cycleRoom = cycleRoom;
  cycleRun(`online={host:false,session:{memberId:'friend',hostId:'host'},room:cycleRoom,sent:[],send:capturePeerPacket,close(){}};
    onlinePlaying=true;mode='menu';$('match-format').value='standard';$('starting-side').value='defend';startGame();netHasSnapshot=false;netLastSnapshot=0;netRound=0;`);
  assert.equal(cycleRun('gun.visible'), false, 'A joining guest must not show a temporary host rifle before its first snapshot');
  assert.equal(cycleElements.get('hud').hidden, true, 'A joining guest must not show the wrong team or equipment while waiting');
  assert.equal(cycleElements.get('loading').hidden, false, 'Joining must explain that authoritative game state is loading');
  cycleRun('applyNetSnapshot({time:0,rules:{round:1},roster:[],actors:[]})');
  assert.equal(cycleRun('netHasSnapshot'), false); assert.equal(cycleElements.get('loading').hidden, false, 'An incomplete snapshot must not reveal a temporary guest world');
  const cycleSnapshot = () => {
    run('tickOnline(.1)');
    const packet = JSON.parse(JSON.stringify(run('online.sent.at(-1)')));
    cycleContext.objectivePacket = packet; cycleRun('receiveNetPacket("host",objectivePacket)');
    return packet;
  };
  const roundOneIds = JSON.parse(run('JSON.stringify(roster.map(record=>record.id))'));
  run('cycleAttack.netReload=1.5;cycleHold(cycleAttack,"friend",true,40)'); cycleSnapshot();
  assert.equal(cycleElements.get('loading').hidden, true); assert.equal(cycleElements.get('hud').hidden, false);
  assert.equal(cycleRun('gun.visible'), true, 'The first valid snapshot must reveal the actual guest viewmodel');
  assertNear(run('match.spike.plantProgress'), 2, 'Remote planting must progress on the host');
  assertNear(cycleRun('match.spike.plantProgress'), 2, 'The guest must receive partial planting progress');
  assert.equal(cycleRun('player.id'), 'red-0'); assert.equal(cycleRun('player.hp'), 83); assert.equal(cycleRun('player.armor'), 50);
  assert.equal(cycleRun('player.ammo'), 7); assert.equal(cycleRun('player.reserve'), 19);
  assert.equal(run('cycleAttack.netReload'), 0, 'A remote planter must cancel its reload instead of finishing it alongside planting');
  cycleRun('reloading=1.5;firing=true;interactionHeld=true;updateInteraction(.05,true)');
  assert.equal(cycleRun('reloading'), 0, 'Guest planting feedback must cancel reload immediately, before the next host ACK');
  assert.equal(cycleRun('firing'), false);
  cycleSnapshot();
  assert.equal(cycleRun('interactionHeld'), true, 'Ordinary alive/live snapshots must preserve a continuing F hold');
  cycleRun('interactionHeld=false');
  run('cycleHold(cycleAttack,"friend",false,1)'); cycleSnapshot();
  assert.equal(cycleRun('match.spike.plantProgress'), 0, 'Releasing remote F must cancel an incomplete plant');
  assert.equal(cycleRun('match.spike.plantActor'), null);
  run('cycleHold(cycleAttack,"friend",true,80)'); cycleSnapshot();
  assert.equal(run('match.spike.status'), 'planted'); assert.equal(cycleRun('match.spike.status'), 'planted');
  assert.equal(cycleRun('match.spike.site'), 'A'); assert.equal(cycleRun('match.spike.carrier'), null);
  cycleRun('mode="play";updatePlay(.05)');
  assert.equal(cycleRun('spikeModel.visible'), true, 'A guest must render the planted objective from authoritative state');
  assertNear(cycleRun('spikeModel.position.z'), -18, 'The guest objective model must use the actual planted coordinates');
  run('cycleDefense.x=0;cycleDefense.z=-18;cycleDefense.netReload=1.5;cycleHold(cycleDefense,"cover",true,40)'); cycleSnapshot();
  assertNear(cycleRun('match.spike.defuseProgress'), 2, 'Partial remote defuse must synchronize');
  assert.equal(run('cycleDefense.netReload'), 0); assert.equal(run('cycleDefense.netAmmo'), 3); assert.equal(run('cycleDefense.netReserve'), 11, 'Remote defusing must not complete a simultaneous Phantom reload');
  run('cycleHold(cycleDefense,"cover",false,1)'); cycleSnapshot();
  assert.equal(cycleRun('match.spike.defuseProgress'), 0, 'A cancelled first half must return to zero');
  run('cycleHold(cycleDefense,"cover",true,70);cycleHold(cycleDefense,"cover",false,1)'); cycleSnapshot();
  assertNear(cycleRun('match.spike.defuseProgress'), 3.5, 'Releasing after half must preserve precisely one checkpoint');
  assert.equal(cycleRun('match.spike.checkpoint'), 3.5); assert.equal(cycleRun('match.spike.defuseActor'), null);

  cycleRun('interactionHeld=true;firing=true;aiming=true;keys.add("TouchCrouch");touchMove={x:1,y:0};touchLook={id:79,x:10,y:10};movePointer=78');
  run(`damageEntity(cycleAttack,500,cycleDefense);damageEntity(cycleAttack,500,cycleDefense);
    const raisedObserver=bots.find(bot=>bot.id==='red-1');raisedObserver.y=3.2;raisedObserver.group.position.y=3.2;`);
  cycleSnapshot();
  assert.equal(cycleRun('player.alive'), false); assert.equal(cycleRun('player.hp'), 0);
  assert.equal(cycleRun('interactionHeld||firing||aiming||keys.has("TouchCrouch")||touchLook!==null||movePointer!==null||touchMove.x!==0||touchMove.y!==0'), false, 'A guest death snapshot must release old desktop and mobile combat input');
  assert.equal(cycleRun('gun.visible'), false, 'A dead guest must lose its first-person weapon');
  assert.equal(cycleElements.get('spectator-hint').hidden, false);
  assert.equal(cycleRun('roster.find(record=>record.id===player.id).d'), 1, 'Repeated death damage must not count a second death');
  assert.equal(cycleRun('droppedWeapons.length'), 1, 'A remote death must create one synchronized weapon drop');
  assert.equal(cycleRun('droppedWeapons[0].weapon'), 'vandal'); assert.equal(cycleRun('droppedWeapons[0].ammo'), 7); assert.equal(cycleRun('droppedWeapons[0].reserve'), 19);
  assert.equal(cycleRun('match.spike.status'), 'planted', 'Killing every individual attacker must not remove an already planted spike');
  for (let frame = 0; frame < 25; frame++) cycleRun('updatePlay(.05)');
  assert.equal(cycleRun('spectatedBot.id'), 'red-1', 'A dead guest must spectate an alive teammate from its own team');
  assert.equal(cycleRun('spectatedBot.group.visible'), false, 'The spectated body must stay hidden from its own camera');
  assert.ok(Math.abs(cycleRun('camera.position.y-spectatedBot.y-1.65')) < 1e-5, 'Spectating a raised teammate must use the synchronized vertical position');
  for (const listener of cycleElements.get('game').listeners.get('mousedown')) listener({ button: 0 });
  cycleRun('updatePlay(.05)');
  assert.equal(cycleRun('spectatedBot.id'), 'red-2', 'A dead guest click must switch to the next alive teammate');
  assert.equal(cycleRun('bots.find(bot=>bot.id==="red-1").group.visible'), true, 'Switching spectators must restore the previous visible teammate');

  cycleRun('interactionHeld=true;firing=true;reloading=1;setVisible("interaction",true)');
  run('cycleHold(cycleDefense,"cover",true,70)'); const cyclePostPacket = cycleSnapshot();
  assert.equal(run('match.spike.status'), 'defused'); assert.equal(cycleRun('match.spike.status'), 'defused');
  assert.equal(run('detonationState'), null, 'A completed defuse must never start the station explosion');
  assert.equal(cycleRun('detonationState'), null, 'A defused snapshot must never start an explosion on the guest');
  assert.equal(cycleRun('match.phase'), 'post'); assert.equal(cycleRun('match.score.blue'), 1); assert.equal(cycleRun('match.score.red'), 0);
  assert.equal(cycleElements.get('round-banner').hidden, false, 'A guest must see the authoritative post-round result');
  assert.equal(cycleElements.get('round-banner').textContent, '閉米\nボンバーの電源オフ', 'A red guest must see its own loss when blue defuses');
  assert.equal(cycleRun('interactionHeld||firing||reloading>0'), false, 'An authoritative post-round transition must release the guest trigger, F hold and reload');
  assert.equal(cycleElements.get('interaction').hidden, true, 'A completed round must immediately hide the guest interaction panel');
  const frozenPostTime = cycleRun('match.phaseTime'); cycleRun('updatePlay(.5)');
  assert.equal(cycleRun('match.phaseTime'), frozenPostTime, 'A spectating guest must not advance the host post-round timer');
  cycleRun('interactionHeld=true;firing=true;keys.add("TouchCrouch")');
  run('match.tick(5.1,{blueAlive:aliveCount("blue"),redAlive:aliveCount("red"),playerAlive:true});handleMatchEvents()'); cycleSnapshot();
  assert.equal(cycleRun('match.round'), 2); assert.equal(cycleRun('match.phase'), 'buy'); assert.equal(cycleRun('player.alive'), true);
  assert.equal(cycleElements.get('round-banner').hidden, true, 'The next round must hide the previous guest result banner');
  assert.equal(cycleRun('interactionHeld||firing||keys.has("TouchCrouch")'), false, 'A fresh guest round must not inherit previous-round held input');
  assert.equal(cycleRun('player.hp'), 100); assert.equal(cycleRun('player.armor'), 0);
  assert.equal(cycleRun('inventory.primary'), null); assert.equal(cycleRun('inventory.active'), 'classic');
  assert.equal(cycleRun('player.ammo'), 12); assert.equal(cycleRun('player.reserve'), 36);
  assert.equal(cycleRun('spectatedBot'), null); assert.equal(cycleElements.get('spectator-hint').hidden, true);
  assert.equal(cycleRun('gun.visible'), true, 'A fresh round must restore the respawned guest viewmodel');
  assert.equal(cycleRun('bots.find(bot=>bot.id==="blue-1").netTarget.hp'), 100);
  assert.equal(cycleRun('bots.find(bot=>bot.id==="blue-1").netTarget.armor'), 17, 'Surviving armor must carry over');
  assert.equal(cycleRun('bots.find(bot=>bot.id==="blue-1").netTarget.primary'), 'phantom');
  assert.equal(cycleRun('bots.find(bot=>bot.id==="blue-1").netTarget.ammo'), 30, 'Survivor magazines must refill for the next round');
  assert.equal(cycleRun('bots.find(bot=>bot.id==="blue-1").netTarget.reserve'), 90);
  assert.equal(cycleRun('bots.find(bot=>bot.id==="blue-1").netTarget.kit.smoke'), 2);
  assert.equal(cycleRun('bots.length'), 9); assert.equal(cycleRun('aliveCount("blue")'), 5); assert.equal(cycleRun('aliveCount("red")'), 5);
  assert.equal(cycleRun('droppedWeapons.length'), 0, 'A new round must clear the previous round equipment on every peer');
  assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(roster.map(record=>record.id))')), roundOneIds, 'Round changes must preserve roster identity and ordering');
  cycleContext.oldObjectivePacket = cyclePostPacket; cycleRun('receiveNetPacket("host",oldObjectivePacket)');
  assert.equal(cycleRun('match.round'), 2); assert.equal(cycleRun('player.alive'), true, 'A delayed death/post snapshot must not undo the next round spawn');
  console.log('PASS: independent JSON guest world receives partial/cancelled plant, full plant, cancel/half/resumed defuse, death, elevated teammate spectating and next-round equipment/health/identity');

  run(`const cycleRespawn=bots.find(bot=>bot.id==='red-0');cycleRespawn.record.credits=6000;
    cycleAction(cycleRespawn,'friend',{type:'buy',id:'vandal'});cycleAction(cycleRespawn,'friend',{type:'buy',id:'ghost'});
    cycleAction(cycleRespawn,'friend',{type:'equip',weapon:'vandal'});cycleRespawn.netAmmo=4;cycleRespawn.netReserve=17;startRound();
    const cycleDropAction=cycleAction(cycleRespawn,'friend',{type:'drop'});`);
  cycleSnapshot();
  assert.equal(cycleRun('inventory.primary'), null); assert.equal(cycleRun('inventory.active'), 'ghost');
  assert.equal(cycleRun('droppedWeapons.length'), 1); assert.equal(cycleRun('droppedWeapons[0].ammo'), 4); assert.equal(cycleRun('droppedWeapons[0].reserve'), 17);
  assert.equal(run('match.spike.carrier'), 'red-0', 'Dropping a selected rifle must not drop a carried but unselected spike');
  run(`receiveNetPacket('friend',{type:'input',seq:++cyclePacketNumber,round:match.round,input:{x:cycleRespawn.x,z:cycleRespawn.z,y:0},actions:[{seq:cycleDropAction,round:match.round,at:elapsed,type:'drop'}]});updateRemoteActor(cycleRespawn,.05)`);
  assert.equal(run('droppedWeapons.length'), 1, 'Duplicate rifle-drop action delivery must not create another object');
  run('cycleRespawn.netAmmo=4;cycleRespawn.netReserve=12'); cycleSnapshot();
  cycleRun('interactionHeld=false;updateInteraction(.05,true)');
  assert.equal(cycleElements.get('interaction').hidden, false, 'A nearby dropped weapon must expose its pickup prompt');
  assert.match(cycleElements.get('interaction-title').textContent, /VANDAL.*4 \/ 17/, 'The pickup prompt must identify the ground rifle and its actual ammunition');
  assert.equal(cycleElements.get('mobile-interact-label').textContent, '拾う');
  assert.equal(cycleElements.get('mobile-interact-hint').textContent, 'タップ');
  const relayCycleActions = () => {
    cycleRun(`netSequence=${run('cyclePacketNumber')};tickOnline(.1)`);
    const packet = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
    sandbox.cycleGuestInput = packet; run('receiveNetPacket("friend",cycleGuestInput);cyclePacketNumber=cycleGuestInput.seq;updateRemoteActor(cycleRespawn,.05)');
    return packet;
  };
  cycleRun('interactionHeld=true;updateInteraction(.05,true);updateInteraction(.05,true)');
  assert.equal(cycleRun('interactionHeld'), false, 'Guest pickup must consume the F press to prevent exchange loops');
  assert.equal(cycleRun('netActions.length'), 1); assert.equal(cycleRun('netActions[0].type'), 'pickup');
  relayCycleActions(); cycleSnapshot();
  assert.equal(cycleRun('inventory.primary'), 'vandal'); assert.equal(cycleRun('inventory.active'), 'vandal');
  assert.equal(cycleRun('player.ammo'), 4); assert.equal(cycleRun('player.reserve'), 17, 'Picking up a dropped rifle must preserve ammunition instead of refilling it');
  assert.equal(cycleRun('droppedWeapons.length'), 0);
  run('cycleAction(cycleRespawn,"friend",{type:"equip",weapon:"ghost"})'); cycleSnapshot();
  assert.equal(cycleRun('player.ammo'), 4); assert.equal(cycleRun('player.reserve'), 12, 'Remote pickup must save the just-fired secondary magazine before equipping the ground rifle');
  run('cycleAction(cycleRespawn,"friend",{type:"equip",weapon:"vandal"})'); cycleSnapshot();
  assert.equal(cycleRun('player.ammo'), 4); assert.equal(cycleRun('player.reserve'), 17);

  run(`dropItem('phantom',{...bots.find(bot=>bot.id==='blue-1'),x:cycleRespawn.x,z:cycleRespawn.z,netWeapon:'phantom',netAmmo:2,netReserve:9});`);
  cycleSnapshot();
  cycleRun('interactionHeld=true;updateInteraction(.05,true)'); const repeatedPickup = relayCycleActions(); cycleSnapshot();
  assert.equal(cycleRun('inventory.primary'), 'phantom'); assert.equal(cycleRun('player.ammo'), 2); assert.equal(cycleRun('player.reserve'), 9);
  assert.equal(cycleRun('droppedWeapons.length'), 1); assert.equal(cycleRun('droppedWeapons[0].weapon'), 'vandal');
  assert.equal(cycleRun('droppedWeapons[0].ammo'), 4); assert.equal(cycleRun('droppedWeapons[0].reserve'), 17, 'An exchange must retain the old rifle ammunition on the ground');
  sandbox.repeatedPickup = repeatedPickup;
  run(`repeatedPickup.seq=++cyclePacketNumber;receiveNetPacket('friend',repeatedPickup);for(let frame=0;frame<5;frame++){elapsed+=.05;updateRemoteActor(cycleRespawn,.05)}`);
  cycleSnapshot();
  assert.equal(cycleRun('inventory.primary'), 'phantom', 'A repeated pickup ACK must not exchange the rifle back again');
  assert.equal(cycleRun('droppedWeapons.length'), 1);
  run(`damageEntity(cycleRespawn,500,bots.find(bot=>bot.id==='blue-1'));`); cycleSnapshot();
  assert.equal(cycleRun('player.alive'), false); assert.equal(cycleRun('match.spike.status'), 'dropped'); assert.equal(cycleRun('match.spike.carrier'), null);
  assert.equal(cycleRun('droppedWeapons.length'), 2, 'Carrier death must synchronize both the spike state and carried rifle drop');
  assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(droppedWeapons.map(drop=>[drop.weapon,drop.ammo,drop.reserve]).sort())')), [['phantom',2,9],['vandal',4,17]]);

  // Exercise a real host detonation through JSON, rather than sharing an event object
  // or deriving a new event from each transport snapshot number.
  const installBlastProbe = `
    const originalStationStart=stationDetonation.start,originalStationUpdate=stationDetonation.update,originalBlastSound=sound;
    const blastStarts=[],blastUpdates=[],blastSounds=[];
    stationDetonation.start=(data)=>{blastStarts.push({...data});return originalStationStart(data)};
    stationDetonation.update=(time,options)=>{const value=originalStationUpdate(time,options);blastUpdates.push({time,...value});return value};
    sound=(type,options)=>{if(type==='explosion')blastSounds.push({time:elapsed});return originalBlastSound(type,options)};
  `;
  run(installBlastProbe); cycleRun(installBlastProbe);
  run(`match.spike.status='planted';match.spike.site='A';match.spike.x=0;match.spike.z=-18;match.spike.timer=.01;
    elapsed+=.05;match.tick(.05,{blueAlive:aliveCount('blue'),redAlive:aliveCount('red'),playerAlive:player.alive});handleMatchEvents();handleMatchEvents();`);
  assert.equal(run('match.spike.status'), 'detonated');
  assert.equal(run('blastStarts.length'), 1, 'Draining an already handled host event must not start a second explosion');
  assert.equal(run('blastSounds.length'), 1, 'A real local detonation must play its explosion sound once');
  const blastPacket = cycleSnapshot();
  assert.equal(cycleElements.get('round-banner').hidden, false);
  assert.equal(cycleElements.get('round-banner').textContent, '開米\nボンバー起爆', 'A red guest must see its own win when red detonates the spike');
  assert.ok(blastPacket.detonation?.id, 'The host snapshot must include a persistent semantic detonation identity');
  assert.equal(blastPacket.detonation.round, blastPacket.rules.round);
  assert.ok(Number.isFinite(blastPacket.detonation.startedAt));
  assert.equal(blastPacket.detonation.x, 0); assert.equal(blastPacket.detonation.z, -18);
  assert.equal(cycleRun('blastStarts.length'), 1, 'The guest must start the authoritative explosion on its first event snapshot');
  assert.equal(cycleRun('detonationState.id'), blastPacket.detonation.id);
  const initialGuestBlastSounds = cycleRun('blastSounds.length');
  run('elapsed+=.25'); cycleSnapshot(); cycleSnapshot();
  cycleContext.repeatedBlastPacket = blastPacket;
  cycleRun('receiveNetPacket("host",repeatedBlastPacket)');
  assert.equal(cycleRun('blastStarts.length'), 1, 'New transport snapshots and old duplicate packets for one round must not restart the blast');
  assert.equal(cycleRun('blastSounds.length'), initialGuestBlastSounds, 'Repeating one detonation must not replay its sound');

  // A reloaded guest has no local event history, so the timestamp must recover
  // the current animation age instead of flashing the beginning of the blast.
  cycleRun('resetDetonation();netHasSnapshot=false');
  run('elapsed=detonationState.startedAt+1.2'); const resumedBlastPacket = cycleSnapshot();
  cycleRun('renderWithDetonation(0)');
  assert.equal(cycleRun('blastStarts.length'), 2);
  assertNear(cycleRun('blastStarts.at(-1).time'), resumedBlastPacket.detonation.startedAt, 'A fresh guest must start from the host event timestamp');
  assertNear(cycleRun('blastUpdates.at(-1).time-blastStarts.at(-1).time'), 1.2, 'Reconnection must resume at the current explosion age');
  assert.equal(cycleRun('blastSounds.length'), initialGuestBlastSounds, 'Joining the middle of an explosion must not replay its initial sound');
  cycleRun('resetDetonation();netHasSnapshot=false');
  run('elapsed=detonationState.startedAt+20'); cycleSnapshot(); cycleRun('renderWithDetonation(0)');
  assert.equal(cycleRun('stationDetonation.group.visible'), false, 'An expired event in a fresh guest snapshot must remain invisible');
  assert.equal(cycleRun('blastUpdates.at(-1).active'), false);
  assert.equal(cycleRun('blastUpdates.at(-1).flash'), 0); assert.equal(cycleRun('blastUpdates.at(-1).shake'), 0);
  assert.equal(cycleRun('blastSounds.length'), initialGuestBlastSounds, 'Expired events must remain silent on reconnect');

  run('match.tick(5.1,{blueAlive:aliveCount("blue"),redAlive:aliveCount("red"),playerAlive:player.alive});handleMatchEvents()'); cycleSnapshot();
  assert.equal(run('detonationState'), null); assert.equal(cycleRun('detonationState'), null, 'The next round must clear the detonation on both peers');
  assert.equal(cycleElements.get('round-banner').hidden, true, 'A winning guest banner must also disappear at the next round');
  assert.equal(run('stationDetonation.group.visible'), false); assert.equal(cycleRun('stationDetonation.group.visible'), false);
  // Even a newly sequenced stale event must not leak into a new round or a defuse.
  cycleRun(`applyNetDetonation({time:elapsed,rules:{round:match.round,spike:{status:'detonated'}},detonation:repeatedBlastPacket.detonation})`);
  assert.equal(cycleRun('detonationState'), null, 'A stale event identity from another round must be rejected');
  cycleRun(`applyNetDetonation({time:elapsed,rules:{round:match.round,spike:{status:'defused'}},detonation:{...repeatedBlastPacket.detonation,round:match.round}})`);
  assert.equal(cycleRun('detonationState'), null, 'A defused objective must reject an explosion record');
  console.log('PASS: host detonation snapshots, semantic event de-duplication, timestamped guest rejoin, expired-event silence, defuse rejection and next-round cleanup');

  run(`leaveOnline();startGame();startRound();clearBots();inventory.secondary='ghost';equip('ghost',true);player.ammo=4;player.reserve=12;
    const localPickupDrop=addDrop({id:++dropSequence,weapon:'vandal',x:player.x,z:player.z,yaw:0,ammo:8,reserve:21});
    pickupDroppedWeapon(player,localPickupDrop.id);`);
  assert.equal(run('inventory.active'), 'vandal'); assert.equal(run('player.ammo'), 8); assert.equal(run('player.reserve'), 21);
  run('equip("ghost")');
  assert.equal(run('player.ammo'), 4); assert.equal(run('player.reserve'), 12, 'Local pickup must preserve the just-fired secondary magazine too');
  run('startGame()');
  console.log('PASS: authoritative remote rifle drop/pickup/exchange, one F action, duplicate ACK safety, exact ground ammunition and carrier death drops');

  // Rendering may shake a view, but never feeds that offset back into movement,
  // the next rendered frame, or the aiming values used by shoot().
  run(`startRound();clearBots();player.x=0;player.z=26;player.y=0;player.yaw=.4;player.pitch=.15;player.vy=0;
    camera.position.set(0,1.7,26);camera.rotation.set(player.pitch,player.yaw,0);
    startDetonation({id:'camera-fixture',round:match.round,startedAt:elapsed,x:0,z:-18,seed:17},{audible:false});elapsed+=.12;
    const blastCameraBase=JSON.stringify({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),exposure:renderer.toneMappingExposure});
    const blastPlayerBase=JSON.stringify({x:player.x,z:player.z,y:player.y,yaw:player.yaw,pitch:player.pitch,vy:player.vy});
    const originalBlastRender=renderer.render,blastRenderedViews=[];
    renderer.render=()=>blastRenderedViews.push({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),exposure:renderer.toneMappingExposure});
    for(let frame=0;frame<12;frame++)renderWithDetonation(.05);`);
  assert.equal(run('JSON.stringify({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),exposure:renderer.toneMappingExposure})'), run('blastCameraBase'), 'Every rendered blast frame must restore the exact base camera and exposure');
  assert.equal(run('JSON.stringify({x:player.x,z:player.z,y:player.y,yaw:player.yaw,pitch:player.pitch,vy:player.vy})'), run('blastPlayerBase'), 'Explosion shaking must never mutate the player position, vertical physics or aim');
  assert.equal(run('blastRenderedViews.length'), 12);
  assert.deepEqual(JSON.parse(run('JSON.stringify(blastRenderedViews[0])')), JSON.parse(run('JSON.stringify(blastRenderedViews.at(-1))')), 'Repeated draws at the same visual age must not accumulate camera shake');
  run(`renderer.render=()=>{throw Error('intentional render interruption')};let blastRenderThrew=false;try{renderWithDetonation(.05)}catch(error){blastRenderThrew=error.message==='intentional render interruption'}renderer.render=originalBlastRender;`);
  assert.equal(run('blastRenderThrew'), true);
  assert.equal(run('JSON.stringify({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),exposure:renderer.toneMappingExposure})'), run('blastCameraBase'), 'The camera and exposure must restore even if rendering throws');
  run('backMenu()'); assert.equal(run('detonationState'), null); assert.equal(run('stationDetonation.group.visible'), false, 'Returning to the menu must remove the entire effect');

  run(`startGame();startRound();clearBots();match.score[match.attackerTeam]=12;match.score[match.defenderTeam]=0;
    match.spike.status='planted';match.spike.site='A';match.spike.x=0;match.spike.z=-18;match.spike.timer=.01;
    elapsed+=.05;match.tick(.05,{blueAlive:1,redAlive:1,playerAlive:true});handleMatchEvents();
    elapsed+=5;match.tick(5,{blueAlive:1,redAlive:1,playerAlive:true});handleMatchEvents();renderWithDetonation(0);
    const finalRoundTime=elapsed,finalBlastClock=detonationClock;for(let frame=0;frame<3;frame++)renderWithDetonation(.25);`);
  assert.equal(run('mode'), 'result'); assert.equal(run('elapsed'), run('finalRoundTime'), 'The completed match clock remains frozen');
  assertNear(run('detonationClock-finalBlastClock'), .75, 'A match-winning explosion must continue animating behind the result screen');
  run('netHostPaused=true;const pausedBlastClock=detonationClock;renderWithDetonation(.25)');
  assert.equal(run('detonationClock'), run('pausedBlastClock'), 'An explicit host pause must freeze the result explosion too');
  run('netHostPaused=false;startGame();finish(true)');
  assert.equal(document.getElementById('result-title').textContent, '開米', 'A final victory must show the requested result title');
  assert.equal(document.getElementById('result').hidden, false);
  run('startGame();finish(false)');
  assert.equal(document.getElementById('result-title').textContent, '閉米', 'A final defeat must show the requested result title');
  assert.equal(document.getElementById('result').hidden, false);
  run('startGame()');
  assert.equal(run('detonationState'), null, 'Starting a new match must not retain a completed match explosion');
  console.log('PASS: non-accumulating render-only camera shake, unchanged aim/physics, render-error restoration, menu/new-match reset and final-round visual clock');
  console.log('PASS: red guest win/loss banners follow the authoritative winning team, hide next round, and final results show 開米/閉米');

  // Character choice and the NOPE ultimate cross the same action/ACK/snapshot
  // boundary as firing. Prediction may spend points, but only the host paints.
  run('backMenu()');
  const mainAgent = document.getElementById('agent-select'); mainAgent.value = 'nope';
  dispatchElement(mainAgent, 'change', { target: mainAgent });
  assert.equal(document.getElementById('online-agent').value, 'nope', 'Main and online character selectors must stay synchronized');
  run('startGame()'); assert.equal(run('player.kit.character'), 'nope', 'A new offline match must use the selected character');
  run('backMenu()'); mainAgent.value = 'duelist'; dispatchElement(mainAgent, 'change', { target: mainAgent });
  const guestAgent = cycleDocument.getElementById('online-agent'); guestAgent.value = 'nope';
  dispatchElement(guestAgent, 'change', { target: guestAgent });
  assert.equal(cycleDocument.getElementById('agent-select').value, 'nope');
  sandbox.nopeRoom = cycleRoom;
  run(`online={host:true,session:{memberId:'host',hostId:'host'},room:nopeRoom,sent:[],send:capturePeerPacket,close(){}};
    onlinePlaying=true;mode='menu';netInputs.clear();netApplied.clear();netSequence=0;netHasSnapshot=false;netHostPaused=false;startGame();
    const nopeRemote=bots.find(bot=>bot.id==='red-0');bots.forEach(bot=>bot.fire=999);
    const originalTakeoverStart=stationTakeover.start,takeoverStarts=[];
    stationTakeover.start=(value)=>{takeoverStarts.push({...value});return originalTakeoverStart(value)};`);
  cycleRun(`online={host:false,session:{memberId:'friend',hostId:'host'},room:cycleRoom,sent:[],send:capturePeerPacket,close(){}};
    onlinePlaying=true;mode='menu';netActions=[];netActionSequence=0;netSequence=0;netLastSnapshot=0;netRound=0;netHasSnapshot=false;startGame();
    const originalTakeoverStart=stationTakeover.start,takeoverStarts=[];
    stationTakeover.start=(value)=>{takeoverStarts.push({...value});return originalTakeoverStart(value)};`);
  cycleSnapshot();
  assert.equal(cycleRun('netActions.length'), 1); assert.equal(cycleRun('netActions[0].type'), 'character');
  assert.equal(cycleRun('netActions[0].character'), 'nope', 'The first authoritative buy snapshot must send the guest character selection');
  const relayNopeActions = () => {
    cycleRun('tickOnline(.1)');
    const packet = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
    sandbox.nopeInputPacket = packet; run('receiveNetPacket("friend",nopeInputPacket);updateRemoteActor(nopeRemote,.05)');
    return packet;
  };
  relayNopeActions(); cycleSnapshot();
  assert.equal(run('nopeRemote.kit.character'), 'nope'); assert.equal(cycleRun('player.kit.character'), 'nope');
  assert.equal(cycleRun('netActions.length'), 0, 'Host acknowledgement must retire the character request');
  run('netHostPaused=true'); cycleSnapshot(); cycleRun('previous=0;frame(100)');
  assert.match(cycleElements.get('online-session-status').textContent, /ホストが戻るまで.*一時停止/, 'A paused host snapshot must update the guest notice even while gameplay frames stop');
  run('netHostPaused=false'); cycleSnapshot();
  assert.equal(cycleElements.get('online-session-status').textContent, `ONLINE · ${cycleRoom.code}`, 'The resumed snapshot must remove the host-pause notice');
  cycleRun('queueNetAction("character",{character:"unrecognized-agent"})'); relayNopeActions(); cycleSnapshot();
  assert.equal(run('nopeRemote.kit.character'), 'nope', 'Host character selection must reject values outside its whitelist');
  cycleRun('openShop()'); assert.equal(cycleRun('mode'), 'shop');
  assert.equal(cycleElements.get('start-round').hidden, true, 'An online guest shop must hide the solo-only round-start control');
  run(`nopeRemote.record.credits=3500;applyRemoteAction(nopeRemote,{type:'buy',id:'vandal'});startRound();
    nopeRemote.kit.ultPoints=6;applyRemoteAction(nopeRemote,{type:'ability',key:'x'});`);
  assert.equal(run('takeoverState'), null); assert.equal(run('nopeRemote.kit.ultPoints'), 6, 'NOPE must require all seven ultimate points');
  cycleSnapshot();
  assert.equal(cycleRun('mode'), 'play', 'The authoritative buy-to-live transition must close the guest shop');
  assert.equal(cycleElements.get('shop-overlay').hidden, true, 'A guest must regain the unobstructed game view when buying ends');
  cycleRun('queueNetAction("character",{character:"duelist"})'); relayNopeActions(); cycleSnapshot();
  assert.equal(run('nopeRemote.kit.character'), 'nope', 'A live-round action must not change the remote character');
  run('nopeRemote.kit.ultPoints=7'); cycleSnapshot(); cycleRun('useAbility("x")');
  assert.equal(cycleRun('player.kit.ultPoints'), 0, 'Guest prediction must spend the seven points once');
  assert.equal(cycleRun('takeoverState'), null, 'Guest prediction must wait for the host before changing the shared station');
  assert.equal(cycleRun('inventory.active'), 'vandal'); assert.equal(cycleRun('player.kit.knivesActive'), false);
  cycleSnapshot();
  assert.equal(cycleRun('player.kit.ultPoints'), 0, 'An unacknowledged NOPE activation must survive rollback from an older seven-point snapshot');
  assert.equal(cycleRun('takeoverState'), null);
  const nopeAbilityInput = relayNopeActions(); const nopePacket = cycleSnapshot();
  assert.ok(nopePacket.takeover?.id); assert.equal(nopePacket.takeover.round, 1);
  assertNear(nopePacket.takeover.endsAt - nopePacket.takeover.startedAt, 12, 'The authoritative NOPE duration must be twelve seconds');
  assert.equal(run('nopeRemote.kit.ultPoints'), 0); assert.equal(cycleRun('player.kit.ultPoints'), 0);
  assert.equal(run('nopeRemote.netWeapon'), 'vandal'); assert.equal(cycleRun('inventory.active'), 'vandal', 'NOPE must keep the equipped rifle instead of switching to knives');
  assert.equal(run('nopeRemote.kit.knives'), 0); assert.equal(cycleRun('player.kit.knivesActive'), false);
  assert.equal(run('takeoverStarts.length'), 1); assert.equal(cycleRun('takeoverStarts.length'), 1);
  assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(takeoverState)')), nopePacket.takeover, 'Both peers must use the same semantic paint identity and timestamps');
  sandbox.duplicateNopeInput = { ...nopeAbilityInput, seq: nopeAbilityInput.seq + 1 };
  run('receiveNetPacket("friend",duplicateNopeInput);updateRemoteActor(nopeRemote,.05)');
  run('elapsed+=.3'); cycleSnapshot(); cycleSnapshot();
  run('renderWithDetonation(0)'); cycleRun('renderWithDetonation(0)');
  assert.equal(run('takeoverStarts.length'), 1); assert.equal(cycleRun('takeoverStarts.length'), 1, 'Repeated input and state delivery must not restart the NOPE paint');
  assert.equal(run('stationTakeover.group.visible'), true); assert.equal(cycleRun('stationTakeover.group.visible'), true);
  assert.equal(run('stationTakeover.group.children.filter(object=>object.isMesh).length'), 1, 'Station paint must stay in one batched draw object');
  assert.equal(run('stationTakeover.group.children[0].isInstancedMesh'), true);
  assert.deepEqual(Array.from(cycleRun('stationTakeover.group.children[0].instanceMatrix.array')), Array.from(run('stationTakeover.group.children[0].instanceMatrix.array')), 'Host and guest must paint the same station surfaces');

  cycleRun('resetTakeover();netHasSnapshot=false'); run('elapsed=takeoverState.startedAt+3'); cycleSnapshot(); cycleRun('renderWithDetonation(0)');
  assert.equal(cycleRun('takeoverStarts.length'), 2); assert.equal(cycleRun('stationTakeover.group.visible'), true);
  assertNear(cycleRun('takeoverClock-takeoverState.startedAt'), 3, 'A fresh guest must resume the current paint age');
  run('elapsed=takeoverState.endsAt-.01'); cycleSnapshot(); cycleRun('renderWithDetonation(0)');
  assert.equal(cycleRun('stationTakeover.group.visible'), true, 'The paint must remain present until its authoritative deadline');
  run('elapsed=takeoverState.endsAt+.01'); cycleSnapshot(); run('renderWithDetonation(0)'); cycleRun('renderWithDetonation(0)');
  assert.equal(run('stationTakeover.group.visible'), false); assert.equal(cycleRun('stationTakeover.group.visible'), false, 'The station must clear its paint after twelve seconds on both peers');
  cycleRun('resetTakeover()');
  cycleContext.takeoverValidationBase = nopePacket.takeover;
  const invalidTakeovers = [
    { round: 2 }, { startedAt: -1 }, { startedAt: Infinity }, { endsAt: NaN },
    { endsAt: nopePacket.takeover.startedAt }, { endsAt: nopePacket.takeover.startedAt + 13 },
    { startedAt: cycleRun('elapsed') + 1, endsAt: cycleRun('elapsed') + 13 }, { id: '' },
  ];
  for (const invalid of invalidTakeovers) {
    cycleContext.invalidTakeover = { ...nopePacket.takeover, ...invalid };
    cycleRun('applyNetTakeover({takeover:invalidTakeover})');
    assert.equal(cycleRun('takeoverState'), null, 'Invalid paint timing, identities and round changes must fail closed');
  }
  run('match.endRound("blue","elimination");handleMatchEvents()');
  assert.match(document.getElementById('round-banner').textContent, /^開米/);
  run('match.nextRound();handleMatchEvents()'); cycleSnapshot();
  assert.equal(run('takeoverState'), null); assert.equal(cycleRun('takeoverState'), null, 'The next round must clear the shared NOPE effect');
  assert.equal(run('stationTakeover.group.visible'), false); assert.equal(cycleRun('stationTakeover.group.visible'), false);
  run('const nopeNextRound=bots.find(bot=>bot.id==="red-0");applyRemoteAction(nopeNextRound,{type:"character",character:"duelist"})');
  assert.equal(run('nopeNextRound.kit.character'), 'nope', 'A later buy phase must preserve the first-round character');
  run('startTakeover({id:"menu-cleanup",round:match.round,startedAt:elapsed,endsAt:elapsed+12});leaveOnline()');
  assert.equal(run('mode'), 'menu'); assert.equal(run('takeoverState'), null); assert.equal(run('stationTakeover.group.visible'), false);
  cycleRun('leaveOnline()'); guestAgent.value = 'duelist'; dispatchElement(guestAgent, 'change', { target: guestAgent });
  run('startGame()');
  console.log('PASS: NOPE character selectors, host-approved first-round choice, seven-point prediction/ACK, rifle retention, shared paint identity/de-duplication, rejoin age, twelve-second expiry and round/menu cleanup');
  console.log('PASS: guest live-shop transition, immediate host-pause notice, plant/defuse reload cancellation and death/post/new-round input cleanup without breaking live F holds');

  // Audio33 keeps semantic effect sounds separate from transport action cues.
  // The output is intercepted before WebAudio, so these regressions stay silent.
  {
    const audio33Install = `var audio33OriginalPlay=gameAudio.play,audio33Heard=[];
      gameAudio.play=(type,options)=>audio33Heard.push({type,options});soundEnabled=true;volume=.45;`;
    run(audio33Install); cycleRun(audio33Install);
    try {
      run(movementSetup(true)); cycleRun(movementSetup(false)); positionSnapshot();
      run(`player.kit=new DuelistKit({character:'nope'});player.kit.ultPoints=7;
        audio33Heard.length=0;netCues.length=0;activateAbility(player,'x');`);
      cycleRun('audio33Heard.length=0'); positionSnapshot(); positionSnapshot();
      assert.deepEqual(JSON.parse(run('JSON.stringify(audio33Heard.map(c=>c.type))')), ['takeover'], 'NOPE X must play one semantic sound on the host');
      assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(audio33Heard.map(c=>c.type))')), ['takeover'], 'NOPE X must not play both an action cue and its semantic snapshot sound');
      assert.equal(run('netCues.length'), 0, 'The takeover semantic sound must remain local instead of creating a second transport cue');
      run('elapsed+=.1'); cycleRun('audio33Heard.length=0;netHasSnapshot=false'); positionSnapshot();
      assert.equal(cycleRun('audio33Heard.length'), 0, 'Rejoining an ongoing takeover must not replay its old attack');

      // Both actual round-end events and final results need distinct cues. A red
      // guest hears its own outcome, and repeated post-round snapshots stay quiet.
      for (const winner of ['blue', 'red']) {
        run(movementSetup(true)); cycleRun(movementSetup(false)); positionSnapshot();
        run(`audio33Heard.length=0;match.endRound('${winner}','elimination');handleMatchEvents();handleMatchEvents()`);
        cycleRun('audio33Heard.length=0'); positionSnapshot(); positionSnapshot();
        assert.deepEqual(JSON.parse(run('JSON.stringify(audio33Heard.map(c=>c.type))')), [winner === 'blue' ? 'round-win' : 'round-loss']);
        assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(audio33Heard.map(c=>c.type))')), [winner === 'red' ? 'round-win' : 'round-loss'], 'Guest round audio must be relative to its red team and play once');
        run(`audio33Heard.length=0;match.winner='${winner}';match.phase='match';finish(${winner === 'blue'})`);
        cycleRun('audio33Heard.length=0'); positionSnapshot(); positionSnapshot();
        assert.deepEqual(JSON.parse(run('JSON.stringify(audio33Heard.map(c=>c.type))')), [winner === 'blue' ? 'match-win' : 'match-loss']);
        assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(audio33Heard.map(c=>c.type))')), [winner === 'red' ? 'match-win' : 'match-loss'], 'Guest final results must not reuse hit/kill or round jingles');
      }

      run(movementSetup(true)); cycleRun(movementSetup(false)); positionSnapshot();
      run(`audio33Heard.length=0;match.score.blue=12;match.score.red=0;match.endRound('blue','elimination');handleMatchEvents()`);
      cycleRun('audio33Heard.length=0'); positionSnapshot();
      assert.equal(run('audio33Heard.length'), 0, 'The deciding round must leave room for the final match jingle');
      assert.equal(cycleRun('audio33Heard.length'), 0, 'The guest must also suppress a redundant final-round jingle');
      run('match.nextRound();handleMatchEvents()'); positionSnapshot(); positionSnapshot();
      assert.deepEqual(JSON.parse(run('JSON.stringify(audio33Heard.map(c=>c.type))')), ['match-win']);
      assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(audio33Heard.map(c=>c.type))')), ['match-loss']);

      run(movementSetup(true)); cycleRun(movementSetup(false)); positionSnapshot();
      run(`audio33Heard.length=0;match.interactPlant(4,{actorId:'player',team:'blue',site:'A',x:0,z:-18});handleMatchEvents()`);
      cycleRun('audio33Heard.length=0'); positionSnapshot(); positionSnapshot();
      assert.equal(run('match.spike.status'), 'planted');
      assert.deepEqual(JSON.parse(run('JSON.stringify(audio33Heard.filter(c=>c.type===\'plant\'||c.type===\'defuse\').map(c=>c.type))')), ['plant']);
      assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(audio33Heard.filter(c=>c.type===\'plant\'||c.type===\'defuse\').map(c=>c.type))')), ['plant'], 'The guest must hear a newly planted objective exactly once');
      cycleRun('audio33Heard.length=0;netHasSnapshot=false'); positionSnapshot();
      assert.equal(cycleRun('audio33Heard.length'), 0, 'A fresh guest must not replay an already planted objective');
      run(`audio33Heard.length=0;match.interactDefuse(7,{actorId:'red-0',team:'red'});handleMatchEvents()`);
      positionSnapshot(); positionSnapshot();
      assert.equal(run('match.spike.status'), 'defused');
      assert.deepEqual(JSON.parse(run('JSON.stringify(audio33Heard.filter(c=>c.type===\'plant\'||c.type===\'defuse\').map(c=>c.type))')), ['defuse']);
      assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(audio33Heard.filter(c=>c.type===\'plant\'||c.type===\'defuse\').map(c=>c.type))')), ['defuse'], 'The guest must hear a newly defused objective exactly once');
      cycleRun('audio33Heard.length=0;netHasSnapshot=false'); positionSnapshot();
      assert.equal(cycleRun('audio33Heard.length'), 0, 'Fresh post-round snapshots must replay neither completion sounds nor old round jingles');

      run(movementSetup(true)); cycleRun(movementSetup(false)); positionSnapshot();
      run('audio33Heard.length=0;netCues.length=0;netCueSequence=0');
      const audio33Types = ['heal', 'recon', 'veil', 'ember-warning'];
      for (const [character, type] of [['mend', 'heal'], ['echo', 'recon'], ['veil', 'veil'], ['ember', 'ember-warning']]) {
        run(`resetTeamAbilities();player.kit=new DuelistKit({character:'${character}'});player.kit.ultPoints=7;
          player.hp=40;activateAbility(player,'x',{zonePoint:{x:0,y:0,z:16}});`);
        assert.equal(run('audio33Heard.at(-1).type'), type, 'An actual ultimate activation must emit its own audio identity');
        assert.equal(run('netCues.at(-1).type'), type, 'The host must serialize that same new action cue');
      }
      const audio33Queue = JSON.parse(run('JSON.stringify(netCues)'));
      assert.deepEqual(audio33Queue.map(cue => cue.type), audio33Types);
      assert.deepEqual(audio33Queue.map(cue => cue.seq), [1, 2, 3, 4]);
      cycleRun('audio33Heard.length=0;netSeenCueSequence=0');
      cycleContext.audio33Packet = { time: run('elapsed'), rules: { round: run('match.round') }, cues: audio33Queue };
      cycleRun(`applyNetCues(audio33Packet,true,'red-0');applyNetCues(audio33Packet,false,'red-0')`);
      assert.equal(cycleRun('audio33Heard.length'), 0, 'A fresh snapshot consumes sequence IDs without replaying old ultimate sounds');
      run(`soundEnabled=false;for(const type of ['heal','recon','veil','ember-warning'])sound(type);soundEnabled=true`);
      cycleContext.audio33Packet.cues = JSON.parse(run('JSON.stringify(netCues.slice(-4))'));
      cycleRun(`applyNetCues(audio33Packet,false,'red-0');applyNetCues(audio33Packet,false,'red-0')`);
      assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(audio33Heard.map(c=>c.type))')), audio33Types, 'Each new host cue must arrive once even when the host is muted and the packet repeats');
      let audio33Seq = 8;
      const rejectAudio33 = (patch, fresh = false) => {
        cycleContext.audio33Packet.cues = audio33Types.map(type => ({ ...audio33Queue[0], type, seq: ++audio33Seq, ...patch }));
        cycleRun(`applyNetCues(audio33Packet,${fresh},'red-0')`);
        assert.equal(cycleRun('audio33Heard.length'), 4, 'Owner, wrong-round, stale, future and fresh cues must retain the existing exclusion rules');
      };
      rejectAudio33({ id: 'red-0' });
      rejectAudio33({ round: run('match.round') + 1 });
      rejectAudio33({ time: run('elapsed') - 1.001 });
      rejectAudio33({ time: run('elapsed') + .001 });
      rejectAudio33({}, true);
      rejectAudio33({ type: 'unrecognized-sound' });
      cycleContext.audio33Packet.cues = audio33Types.map(type => ({ ...audio33Queue[0], type, seq: ++audio33Seq }));
      cycleRun(`applyNetCues(audio33Packet,false,'red-0');applyNetCues(audio33Packet,false,'red-0')`);
      assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(audio33Heard.map(c=>c.type))')), [...audio33Types, ...audio33Types], 'Excluded sequences must not deadlock later legitimate action sounds');
      console.log('PASS: silent audio33 NOPE semantic-only de-duplication, guest-relative round/match jingles, objective edges without rejoin replay and four ultimate cue identities with mute/seq/owner/fresh/round/age exclusions');
    } finally {
      run('gameAudio.play=audio33OriginalPlay;if(online)leaveOnline();startGame()');
      cycleRun('gameAudio.play=audio33OriginalPlay;if(online)leaveOnline()');
    }
  }

  // NOPE ordinary skills cross actual input, host geometry and an independent
  // guest JSON boundary; restored presentation never owns damage or blindness.
  {
    run(`function ordinarySetup(){
      if(online)leaveOnline();onlinePlaying=false;mode='menu';$('agent-select').value='nope';$('match-format').value='standard';$('starting-side').value='attack';
      startGame();startRound();elapsed=10;resetOrdinarySkills();Object.assign(player,{x:0,z:20,y:0,yaw:0,pitch:0,vy:0,hp:100,armor:0,crouch:0});
      player.kit.smoke=2;player.kit.updraft=1;player.kit.dash=1;player.kit.nextSignatureAt=0;
      bots.forEach((bot,index)=>{Object.assign(bot,{x:35,z:30+index,y:0,hp:100,armor:0,alive:true,rangeTarget:true,fire:999,target:null});});
    }ordinarySetup();
    var ordinaryEnemy=bots.find(bot=>bot.id==='red-0'),ordinaryCovered=bots.find(bot=>bot.id==='red-1'),ordinaryAlly=bots.find(bot=>bot.id==='blue-1');
    Object.assign(ordinaryEnemy,{x:0,z:12});Object.assign(ordinaryCovered,{x:3,z:12});Object.assign(ordinaryAlly,{x:-1,z:12});
    var bottleEffect=activateAbility(player,'c',{zonePoint:{x:0,y:0,z:12},aim:{yaw:0,pitch:0}});
    var bottleEvent=ordinarySkills.events(elapsed)[0];
    map.colliders.push({minX:1,maxX:2,minZ:11.5,maxZ:12.5,height:4});`);
    assert.equal(run('bottleEffect.type'), 'nope-bottle'); assert.equal(run('player.kit.smoke'), 1);
    assert.equal(run('ordinarySkills.events(elapsed).length'), 1); assert.equal(run('smokes.length'), 0, 'NOPE C must create a bottle rather than the legacy smoke');
    assertNear(run('bottleEvent.x'), 0); assertNear(run('bottleEvent.z'), 12);
    run('elapsed=bottleEvent.triggerAt-.001;updateOrdinarySkills()'); assert.equal(run('ordinaryEnemy.hp'), 100, 'A bottle may not explode before its actual fuse');
    run('elapsed=bottleEvent.triggerAt;updateOrdinarySkills()');
    assertNear(run('ordinaryEnemy.hp'), 100-NOPE_SKILLS.bottleDamage, 'The host damage path must apply the full centre bottle hit');
    assert.equal(run('ordinaryCovered.hp'), 100, 'Actual map cover must block bottle damage');
    assert.equal(run('ordinaryAlly.hp'), 100, 'NOPE bottle must not damage its team');
    assert.equal(run('player.hp'), 100, 'NOPE bottle must not damage its caster');
    run('updateOrdinarySkills();elapsed+=.1;updateOrdinarySkills()'); assertNear(run('ordinaryEnemy.hp'), 100-NOPE_SKILLS.bottleDamage, 'A fuse may sample damage only once');
    run('map.colliders.pop();ordinarySetup();');
    run(`ordinaryEnemy=bots.find(bot=>bot.id==='red-0');ordinaryCovered=bots.find(bot=>bot.id==='red-1');ordinaryAlly=bots.find(bot=>bot.id==='blue-1');
      var ordinaryAway=bots.find(bot=>bot.id==='red-2');
      Object.assign(ordinaryEnemy,{x:0,z:20,yaw:0,target:player,think:10,fire:0,reactionUntil:0,rangeTarget:false});ordinaryEnemy.group.rotation.y=Math.PI;
      Object.assign(ordinaryCovered,{x:-3,z:20,yaw:0});Object.assign(ordinaryAlly,{x:1,z:20,yaw:0});Object.assign(ordinaryAway,{x:2,z:20,yaw:Math.PI});
      activateAbility(player,'q',{zonePoint:{x:0,y:0,z:15},aim:{yaw:0,pitch:0}});
      map.colliders.push({minX:-2.5,maxX:-1.5,minZ:17,maxZ:20.5,height:4});
      elapsed=10.449;updateOrdinarySkills();`);
    assert.equal(run('player.kit.updraft'), 0); assert.equal(run('player.vy'), 0, 'NOPE Q must not borrow the old upward impulse');
    assert.equal(run('ordinarySkills.blindUntil(player.id,elapsed)'), 0, 'A flash must wait for its .45s projectile arrival');
    run('elapsed=10.45;updateOrdinarySkills();renderOrdinarySkills();updateHUD()');
    for (const actor of ['player', 'ordinaryEnemy', 'ordinaryAlly']) assertNear(run(`ordinarySkills.blindUntil(${actor}.id,elapsed)`), 10+NOPE_SKILLS.flashFlight+NOPE_SKILLS.flashDuration, 'Facing caster, enemy and teammate must receive the same flash duration');
    assert.equal(run('ordinarySkills.blindUntil(ordinaryCovered.id,elapsed)'), 0, 'Actual wall cover must block the face flash');
    assert.equal(run('ordinarySkills.blindUntil(ordinaryAway.id,elapsed)'), 0, 'Looking away must avoid the face flash');
    assert.equal(run('ordinaryEnemy.target'), null, 'A newly blinded BOT must immediately lose its cached real target');
    assert.equal(document.getElementById('skill-blind-overlay').hidden, false); assert.match(document.getElementById('status-effects').textContent, /FLASH/);
    run('var flashHealth=player.hp;updateBots(.05)');
    assert.equal(run('ordinaryEnemy.target'), null, 'A blind BOT must not reacquire even a visible close enemy'); assert.equal(run('player.hp'), run('flashHealth'));
    run('elapsed=10+NOPE_SKILLS.flashFlight+NOPE_SKILLS.flashDuration;updateOrdinarySkills();renderOrdinarySkills();map.colliders.pop()');
    assert.equal(run('ordinarySkills.blindUntil(player.id,elapsed)'), 0); assert.equal(document.getElementById('skill-blind-overlay').hidden, true);

    run(`ordinarySetup();var decoyOrigin=JSON.stringify({x:player.x,y:player.y,z:player.z,vy:player.vy,dashTimer:player.dashTimer});
      activateAbility(player,'e',{aim:{yaw:0,pitch:0}});var firstDecoy=ordinarySkills.events(elapsed)[0];`);
    assert.equal(run('firstDecoy.type'), 'nope-decoy'); assertNear(run('firstDecoy.endsAt-firstDecoy.startedAt'), NOPE_SKILLS.decoyDuration);
    assert.ok(run('Math.hypot(firstDecoy.x-player.x,firstDecoy.z-player.z)') <= 6 + 1e-8);
    assert.equal(run('JSON.stringify({x:player.x,y:player.y,z:player.z,vy:player.vy,dashTimer:player.dashTimer})'), run('decoyOrigin'), 'NOPE E must place a face without moving or launching the caster');
    assert.equal(run('player.kit.armReadyAt'), null); assert.equal(run('player.kit.nextSignatureAt'), 10+NOPE_SKILLS.signatureCooldown);
    run("var secondDecoy=ordinarySkills.cast('nope-decoy',player,{x:2,y:0,z:15},elapsed,match.round)");
    run(`Object.assign(player,{x:35,z:-35});bots.filter(bot=>bot.team==='blue').forEach(bot=>{bot.x=-35;bot.z=-35});
      ordinaryEnemy=bots.find(bot=>bot.id==='red-0');Object.assign(ordinaryEnemy,{x:0,z:10,rangeTarget:false,target:null,lastSeen:null,fire:999});ordinaryEnemy.group.rotation.y=0;
      elapsed=10.1;updateBots(.05);`);
    assert.equal(run('ordinaryEnemy.decoySeen.has(firstDecoy.id)'), true);
    assertNear(run('ordinaryEnemy.decoySeen.get(firstDecoy.id)'), 11.6); assert.ok(run('Math.hypot(ordinaryEnemy.goal.x-firstDecoy.x,ordinaryEnemy.goal.z-firstDecoy.z)') < .5, 'A visible nearby decoy must be an actual finite investigation goal');
    run('elapsed=11.7;updateBots(.05)');
    assertNear(run('ordinaryEnemy.decoySeen.get(firstDecoy.id)'), 11.6, 'Continued visibility must not renew the same decoy investigation forever');
    assert.ok(run('Math.hypot(ordinaryEnemy.goal.x-firstDecoy.x,ordinaryEnemy.goal.z-firstDecoy.z)') > .5, 'After1.5s the objective goal must supersede a still-live decoy');
    assertNear(run('ordinaryEnemy.decoySeen.get(secondDecoy.id)'), 13.2, 'A second visible face may receive its own single investigation window');
    run('elapsed=13.3;updateBots(.05)');
    assertNear(run('ordinaryEnemy.decoySeen.get(firstDecoy.id)'), 11.6, 'Alternating visible decoys may not re-arm the first expired window');
    assertNear(run('ordinaryEnemy.decoySeen.get(secondDecoy.id)'), 13.2, 'Alternating visible decoys may not re-arm the second expired window');
    assert.ok(run('Math.hypot(ordinaryEnemy.goal.x-firstDecoy.x,ordinaryEnemy.goal.z-firstDecoy.z)>.5&&Math.hypot(ordinaryEnemy.goal.x-secondDecoy.x,ordinaryEnemy.goal.z-secondDecoy.z)>.5'), 'After both finite windows a still-live pair must release the BOT back to its objective');
    run('Object.assign(player,{x:0,z:20});elapsed=10+NOPE_SKILLS.signatureCooldown-.001;player.kit.tick(elapsed);activateAbility(player,"e")'); assert.equal(run('player.kit.dash'), 0); assert.equal(run('ordinarySkills.events(elapsed).length'), 0);
    run('elapsed=10+NOPE_SKILLS.signatureCooldown;player.kit.tick(elapsed);activateAbility(player,"e")'); assert.equal(run('player.kit.nextSignatureAt'), 10+2*NOPE_SKILLS.signatureCooldown); assert.equal(run('ordinarySkills.events(elapsed).length'), 1);
    run('backMenu()'); assert.equal(run('ordinarySkills.snapshot().events.length'), 0); assert.equal(run('ordinaryFX.group.visible'), false);
    console.log('PASS: NOPE C buffed fuse/damage/team/cover, Q facing/LOS/self/ally/BOT blindness, stationary E/cooldown and bounded decoy investigation');

    cycleRun('if(online)leaveOnline()'); run(movementSetup(true)); cycleRun(movementSetup(false)); cycleRun('netActionSequence=0');
    run(`elapsed=10;var ordinaryRemote=bots.find(bot=>bot.id==='red-0');ordinaryRemote.kit=new DuelistKit({character:'nope'});
      ordinaryRemote.kit.smoke=2;ordinaryRemote.kit.updraft=1;
      Object.assign(ordinaryRemote,{x:0,z:20,y:0,netWeapon:'vandal',netAmmo:25,netReserve:75});ordinaryRemote.record.primary='vandal';
      player.x=-30;player.z=30;bots.forEach(bot=>{bot.rangeTarget=true});`);
    positionSnapshot();
    cycleRun(`player.yaw=0;player.pitch=-.2;var pressedBottlePoint=getSkillTarget(player,'nope-bottle',null,{yaw:0,pitch:-.2});useAbility('c');player.yaw=Math.PI/2;player.pitch=-.7;`);
    assert.equal(cycleRun('player.kit.smoke'), 1); assert.equal(cycleRun('ordinarySkills.snapshot().events.length'), 0, 'Guest C prediction must consume stock without owning a bottle event');
    positionSnapshot();
    assert.equal(cycleRun('player.kit.smoke'), 1, 'An ACK-before-cast snapshot must retain an outstanding predicted C spend');
    const relayOrdinary = () => {
      cycleRun('tickOnline(.1)'); const packet = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
      sandbox.ordinaryInput = packet; run('receiveNetPacket("friend",ordinaryInput);updateRemoteActor(ordinaryRemote,.05)'); return packet;
    };
    const bottleInput = relayOrdinary();
    const authoritativeBottle = JSON.parse(run('JSON.stringify(ordinarySkills.events(elapsed)[0])'));
    const pressedBottle = JSON.parse(cycleRun('JSON.stringify(pressedBottlePoint)'));
    assert.equal(authoritativeBottle.type, 'nope-bottle'); assert.equal(run('ordinaryRemote.kit.smoke'), 1);
    assertNear(authoritativeBottle.x, pressedBottle.x, 'A remote bottle must retain the press-time yaw'); assertNear(authoritativeBottle.z, pressedBottle.z, 'A remote bottle must retain the press-time downward aim');
    assertNear(bottleInput.input.yaw, Math.PI / 2, 'The actual input packet must contain the later changed view');
    sandbox.duplicateOrdinaryInput = { ...bottleInput, seq: bottleInput.seq + 1 };
    run('receiveNetPacket("friend",duplicateOrdinaryInput);updateRemoteActor(ordinaryRemote,.05)');
    cycleRun(`netSequence=${bottleInput.seq + 1}`);
    assert.equal(run('ordinarySkills.events(elapsed).length'), 1); assert.equal(run('ordinaryRemote.kit.smoke'), 1, 'Duplicate action IDs may not spend C twice');
    positionSnapshot(); assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(ordinarySkills.snapshot())')), JSON.parse(run('JSON.stringify(ordinarySkills.snapshot())')));
    sandbox.authoritativeBottle = authoritativeBottle;
    run('player.x=authoritativeBottle.x;player.z=authoritativeBottle.z;player.y=0;player.hp=100;player.armor=0'); positionSnapshot();
    cycleRun('elapsed=10+NOPE_SKILLS.bottleFuse;updateOrdinarySkills()'); assert.equal(cycleRun('bots.find(bot=>bot.id==="player").hp'), 100, 'A guest may not apply restored due bottle damage');
    run('elapsed=10+NOPE_SKILLS.bottleFuse;updateOrdinarySkills()'); positionSnapshot(); assertNear(run('player.hp'), 100-NOPE_SKILLS.bottleDamage); assertNear(cycleRun('bots.find(bot=>bot.id==="player").hp'), 100-NOPE_SKILLS.bottleDamage);

    run('resetOrdinarySkills();elapsed=20;player.x=0;player.z=20;player.yaw=0;player.hp=100;ordinaryRemote.kit.updraft=1'); positionSnapshot();
    cycleRun('player.yaw=0;player.pitch=-.2;useAbility("q")'); assert.equal(cycleRun('player.kit.updraft'), 0); assert.equal(cycleRun('player.vy'), 0);
    assert.equal(cycleRun('ordinarySkills.snapshot().events.length'), 0); relayOrdinary();
    run('elapsed=20.45;updateOrdinarySkills()'); positionSnapshot(); cycleRun('renderOrdinarySkills();updateHUD()');
    const remoteFlashEnd=20+NOPE_SKILLS.flashFlight+NOPE_SKILLS.flashDuration;
    assertNear(run('ordinarySkills.blindUntil(ordinaryRemote.id,elapsed)'), remoteFlashEnd, 'The host must evaluate the remote player facing from its received view');
    assertNear(cycleRun('ordinarySkills.blindUntil(player.id,elapsed)'), remoteFlashEnd); assert.equal(cycleElements.get('skill-blind-overlay').hidden, false);
    positionSnapshot(); assertNear(cycleRun('ordinarySkills.blindUntil(player.id,elapsed)'), remoteFlashEnd, 'Repeated snapshots must not restart a blind duration');
    run('elapsed=21'); cycleRun('netHasSnapshot=false'); positionSnapshot(); cycleRun('renderOrdinarySkills()');
    assertNear(cycleRun('ordinarySkills.blindUntil(player.id,elapsed)'), remoteFlashEnd, 'A fresh guest must retain the original host flash deadline');
    run('elapsed=20+NOPE_SKILLS.flashFlight+NOPE_SKILLS.flashDuration;updateOrdinarySkills()'); positionSnapshot(); cycleRun('renderOrdinarySkills()'); assert.equal(cycleElements.get('skill-blind-overlay').hidden, true);

    run('elapsed=24;ordinaryRemote.kit.dash=1;ordinaryRemote.kit.nextSignatureAt=0'); positionSnapshot();
    cycleRun('var guestDecoyPosition=JSON.stringify({x:player.x,y:player.y,z:player.z});useAbility("e")');
    assert.equal(cycleRun('JSON.stringify({x:player.x,y:player.y,z:player.z})'), cycleRun('guestDecoyPosition')); assert.equal(cycleRun('ordinarySkills.events(elapsed).length'), 0);
    const decoyInput = relayOrdinary(); positionSnapshot(); assert.equal(run('ordinarySkills.events(elapsed)[0].type'), 'nope-decoy'); assert.equal(cycleRun('player.kit.nextSignatureAt'), 24+NOPE_SKILLS.signatureCooldown);
    sandbox.duplicateOrdinaryInput = { ...decoyInput, seq: decoyInput.seq + 1 }; run('receiveNetPacket("friend",duplicateOrdinaryInput);updateRemoteActor(ordinaryRemote,.05)');
    cycleRun(`netSequence=${decoyInput.seq + 1}`);
    assert.equal(run('ordinarySkills.events(elapsed).length'), 1); assert.equal(run('ordinaryRemote.kit.nextSignatureAt'), 24+NOPE_SKILLS.signatureCooldown);
    run('match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()'); positionSnapshot(); cycleRun('renderOrdinarySkills()');
    for (const evaluate of [run, cycleRun]) { assert.equal(evaluate('ordinarySkills.snapshot().events.length'), 0); assert.equal(evaluate('ordinarySkills.snapshot().blinds.length'), 0); assert.equal(evaluate('ordinaryFX.group.visible'), false); }
    assert.equal(cycleElements.get('skill-blind-overlay').hidden, true);
    cycleRun('leaveOnline()'); run('leaveOnline()');
    for (const [select, dispatch] of [[document.getElementById('agent-select'), dispatchElement], [cycleDocument.getElementById('agent-select'), dispatchElement]]) { select.value='duelist'; dispatch(select,'change',{target:select}); }
    run('startGame()');
    console.log('PASS: independent NOPE C/Q/E prediction, captured aim, host-only damage/blind state, ACK/duplicates, fresh flash expiry, stationary E and next-round/menu cleanup');
  }

  // MEND ordinary skills use real targeting/input and the same independent
  // JSON peer boundary as the other characters, without guest-owned healing.
  {
    run(`function mendOrdinarySetup(){
      if(online)leaveOnline();onlinePlaying=false;mode='menu';$('agent-select').value='mend';$('match-format').value='standard';$('starting-side').value='attack';startGame();startRound();
      clearCombatInput();elapsed=10;resetOrdinarySkills();Object.assign(player,{x:0,z:20,y:0,yaw:0,pitch:0,vy:0,vx:0,vz:0,hp:100,armor:0,crouch:0});
      player.kit.smoke=2;player.kit.updraft=1;player.kit.dash=1;player.kit.nextSignatureAt=0;
      bots.forEach((bot,index)=>{Object.assign(bot,{x:35,z:30+index,y:0,hp:100,armor:0,alive:true,rangeTarget:true,fire:999,target:null});});
    }mendOrdinarySetup();
    var mendEnemy=bots.find(bot=>bot.id==='red-0'),mendCovered=bots.find(bot=>bot.id==='red-1'),mendHigh=bots.find(bot=>bot.id==='red-2'),mendAlly=bots.find(bot=>bot.id==='blue-1');
    Object.assign(mendEnemy,{x:0,z:12});Object.assign(mendCovered,{x:3,z:12});Object.assign(mendHigh,{x:-1,z:12,y:2.501});Object.assign(mendAlly,{x:1,z:12});
    var seedEffect=activateAbility(player,'c',{zonePoint:{x:0,y:0,z:12},aim:{yaw:0,pitch:0}}),seedEvent=ordinarySkills.events(elapsed)[0];
    map.colliders.push({minX:1,maxX:2,minZ:11.5,maxZ:12.5,height:4});`);
    assert.equal(run('seedEffect.type'), 'mend-seeds'); assert.equal(run('player.kit.smoke'), 1); assertNear(run('seedEvent.x'), 0); assertNear(run('seedEvent.z'), 12);
    assertNear(run('seedEvent.y'), MEND_SKILLS.seedsGroundOffset); assertNear(run('seedEvent.triggerAt'), 10+MEND_SKILLS.seedsFlight); assertNear(run('seedEvent.endsAt'), 10+MEND_SKILLS.seedsFlight+MEND_SKILLS.seedsDuration);
    run('elapsed=10.649'); assert.equal(run('actorSpeedScale(mendEnemy)'), 1, 'Flying seeds may not slow an enemy before landing');
    run('elapsed=10.65;updateOrdinarySkills()'); assertNear(run('actorSpeedScale(mendEnemy)'), MEND_SKILLS.seedsSpeedScale);
    for (const actor of ['mendCovered', 'mendHigh', 'mendAlly', 'player']) assert.equal(run(`actorSpeedScale(${actor})`), 1, 'Walls, separate floor heights and the caster team must stay unaffected');
    run('mendHigh.y=2.5'); assertNear(run('actorSpeedScale(mendHigh)'), MEND_SKILLS.seedsSpeedScale, 'The exact2.5m feet-height limit must remain included');
    run('elapsed=10+MEND_SKILLS.seedsFlight+MEND_SKILLS.seedsDuration;updateOrdinarySkills();map.colliders.pop()'); assert.equal(run('actorSpeedScale(mendEnemy)'), 1, 'Seeds must end exactly at their field expiry');
    run(`mendOrdinarySetup();mendEnemy=bots.find(bot=>bot.id==='red-0');Object.assign(mendEnemy,{x:0,z:12});
      ordinarySkills.cast('mend-seeds',mendEnemy,{x:0,y:.12,z:20},elapsed,match.round);elapsed=10.65;equip('vandal',true);player.vz=-(5.4*1.15);keys.add('KeyW');updatePlay(.1);keys.clear();`);
    assertNear(run('20-player.z'), (5.4*1.15)*.1*MEND_SKILLS.seedsSpeedScale, 'The actual player movement path must apply the seeds slow to(5.4*1.15)m/s, including velocity capping');

    run(`mendOrdinarySetup();mendEnemy=bots.find(bot=>bot.id==='red-0');Object.assign(mendEnemy,{x:0,z:10,target:player,think:10,fire:0,reactionUntil:0,rangeTarget:false});mendEnemy.group.rotation.y=0;
      var pollenEffect=activateAbility(player,'q',{zonePoint:{x:0,y:0,z:15},aim:{yaw:0,pitch:0}}),pollenEvent=ordinarySkills.events(elapsed)[0];elapsed=10.549;updateOrdinarySkills();`);
    assert.equal(run('pollenEffect.type'), 'mend-pollen'); assert.equal(run('player.kit.updraft'), 0); assertNear(run('pollenEvent.y'), 1.7);
    assert.equal(run('activePollenFields().length'), 0); assert.equal(run('smokeBlocks(player,mendEnemy)'), false);
    run('elapsed=10.55;updateOrdinarySkills()'); assert.equal(run('activePollenFields().length'), 1);
    assert.equal(run('smokeBlocks(player,mendEnemy)&&smokeBlocks(mendEnemy,player)'), true, 'Landed pollen must obscure both viewing directions');
    assert.equal(run('mendEnemy.target'), null, 'Landing pollen must invalidate an existing BOT target in the same frame');
    run('var pollenHealth=player.hp;updateBots(.05)'); assert.equal(run('mendEnemy.target'), null); assert.equal(run('player.hp'), run('pollenHealth'));
    assert.equal(run('smokes.length'), 0, 'MEND Q must remain an ordinary event rather than a duplicate legacy smoke');
    run('elapsed=10+MEND_SKILLS.pollenFlight+MEND_SKILLS.pollenDuration;updateOrdinarySkills()'); assert.equal(run('activePollenFields().length'), 0); assert.equal(run('smokeBlocks(player,mendEnemy)'), false);

    run(`mendOrdinarySetup();player.hp=60;var mendOne=bots.find(bot=>bot.id==='blue-1'),mendTwo=bots.find(bot=>bot.id==='blue-2');
      Object.assign(mendOne,{x:2,z:20,hp:30,armor:50});Object.assign(mendTwo,{x:-2,z:20,hp:30,armor:25});
      Object.assign(bots.find(bot=>bot.id==='blue-3'),{x:1,z:20,hp:1,alive:false});Object.assign(bots.find(bot=>bot.id==='blue-4'),{x:0,z:20+MEND_SKILLS.healRange+1,hp:1});
      Object.assign(bots.find(bot=>bot.id==='red-0'),{x:1,z:20,hp:1});var mendEquipment=JSON.stringify({weapon:inventory.active,ammo:player.ammo,reserve:player.reserve});
      var healEffect=activateAbility(player,'e'),healEvent=ordinarySkills.events(elapsed)[0];`);
    assert.equal(run('healEffect.type'), 'mend-heal'); assert.equal(run('healEvent.targetId'), 'blue-1', 'Equal HP must use the deterministic ID tie break');
    assert.equal(run('mendOne.hp'), Math.min(100,30+MEND_SKILLS.healAmount)); assert.equal(run('mendTwo.hp'), 30); assert.equal(run('player.hp'), 60); assert.equal(run('mendOne.armor'), 50);
    assert.equal(run('player.kit.dash'), 0); assert.equal(run('player.kit.nextSignatureAt'), 10+MEND_SKILLS.signatureCooldown); assert.equal(run('player.kit.armReadyAt'), null);
    assert.equal(run('JSON.stringify({weapon:inventory.active,ammo:player.ammo,reserve:player.reserve})'), run('mendEquipment'));
    run('updateOrdinarySkills();elapsed=10.2;updateOrdinarySkills()'); assert.equal(run('mendOne.hp'), Math.min(100,30+MEND_SKILLS.healAmount), 'A live heal event must never repeat its healing');
    run('bots.filter(bot=>bot.team===player.team).forEach(bot=>{bot.hp=100});player.hp=90;player.kit.dash=1;player.kit.nextSignatureAt=0;activateAbility(player,"e")'); assert.equal(run('player.hp'), 100, 'Self healing must cap at100HP');
    run(`mendOrdinarySetup();Object.assign(bots.find(bot=>bot.id==='blue-1'),{x:3,z:20,hp:1});Object.assign(bots.find(bot=>bot.id==='blue-2'),{x:0,z:20+MEND_SKILLS.healRange+.001,hp:1});
      Object.assign(bots.find(bot=>bot.id==='blue-3'),{x:1,z:20,hp:1,alive:false});map.colliders.push({minX:1,maxX:2,minZ:19.5,maxZ:20.5,height:4});var rejectedHeal=activateAbility(player,'e');`);
    assert.equal(run('rejectedHeal'), undefined); assert.equal(run('player.kit.dash'), 1); assert.equal(run('player.kit.nextSignatureAt'), 0); assert.equal(run('ordinarySkills.events(elapsed).length'), 0);
    run('map.colliders.pop();Object.assign(bots.find(bot=>bot.id==="blue-1"),{x:0,z:20-MEND_SKILLS.healRange});activateAbility(player,"e")'); assert.equal(run('bots.find(bot=>bot.id==="blue-1").hp'), 1+MEND_SKILLS.healAmount, 'An injured ally exactly at heal range must be eligible');
    run('elapsed=10+MEND_SKILLS.signatureCooldown-.001;player.kit.tick(elapsed)'); assert.equal(run('player.kit.dash'), 0); run('elapsed=10+MEND_SKILLS.signatureCooldown;player.kit.tick(elapsed)'); assert.equal(run('player.kit.dash'), 1);
    run('backMenu()'); assert.equal(run('ordinarySkills.events(elapsed).length'), 0); assert.equal(run('mendSkillFX.group.visible'), false);
    console.log('PASS: MEND strengthened seeds/flight/wall/height/expiry/movement, pollen two-way LOS/BOT target loss, and single lowest-HP/self heal/LOS/range/no-spend/cooldown');

    cycleRun('if(online)leaveOnline()'); run(movementSetup(true)); cycleRun(movementSetup(false));
    run(`elapsed=10;var remoteMend=bots.find(bot=>bot.id==='red-0'),remotePatient=bots.find(bot=>bot.id==='red-1');remoteMend.kit=new DuelistKit({character:'mend'});
      Object.assign(remoteMend,{x:0,z:20,y:0,hp:50,netWeapon:'vandal',netAmmo:25,netReserve:75});remoteMend.record.primary='vandal';
      bots.forEach(bot=>{bot.rangeTarget=true;if(bot!==remoteMend){bot.x=35;bot.z=35;bot.hp=100;}});Object.assign(remotePatient,{x:2,z:20,y:0,hp:25});player.x=-30;player.z=30;`);
    positionSnapshot(); cycleRun('useAbility("e")'); assert.equal(cycleRun('player.kit.dash'), 0); assert.equal(cycleRun('player.hp'), 50); assert.equal(cycleRun('bots.find(bot=>bot.id==="red-1").hp'), 25);
    assert.equal(cycleRun('ordinarySkills.events(elapsed).length'), 0, 'Predicted MEND E must not create a healing authority event');
    positionSnapshot(); assert.equal(cycleRun('player.kit.dash'), 0, 'An unacknowledged heal spend must survive an older host kit snapshot');
    const relayMend = () => { cycleRun('tickOnline(.1)');const input=JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));sandbox.mendInput=input;run('receiveNetPacket("friend",mendInput);updateRemoteActor(remoteMend,.05)');return input; };
    const healInput=relayMend(); assert.equal(run('remotePatient.hp'), 25+MEND_SKILLS.healAmount); assert.equal(run('remoteMend.hp'), 50);
    sandbox.duplicateMendInput={...healInput,seq:healInput.seq+1};run('receiveNetPacket("friend",duplicateMendInput);updateRemoteActor(remoteMend,.05)');cycleRun(`netSequence=${healInput.seq+1}`);
    assert.equal(run('remotePatient.hp'), 25+MEND_SKILLS.healAmount, 'The same healing action ID may not apply twice');positionSnapshot();
    assert.equal(cycleRun('bots.find(bot=>bot.id==="red-1").hp'), 25+MEND_SKILLS.healAmount);assert.equal(cycleRun('player.kit.nextSignatureAt'), 10+MEND_SKILLS.signatureCooldown);
    run('elapsed=10.2');cycleRun('netHasSnapshot=false');positionSnapshot();cycleRun('updateOrdinarySkills();renderOrdinarySkills()');
    assert.equal(cycleRun('bots.find(bot=>bot.id==="red-1").hp'), 25+MEND_SKILLS.healAmount, 'Late join may restore a heal visual without repeating its HP application');
    run('elapsed=11;remoteMend.kit.dash=1;remoteMend.kit.nextSignatureAt=0');positionSnapshot();
    run('bots.filter(bot=>bot.team==="red").forEach(bot=>{bot.hp=100})');cycleRun('updateAbilityFeedback();useAbility("e");updateAbilityFeedback()');assert.equal(cycleRun('player.kit.dash'), 0);
    relayMend();positionSnapshot();cycleRun('updateAbilityFeedback()');assert.equal(run('remoteMend.kit.dash'), 1);assert.equal(cycleRun('player.kit.dash'), 1, 'The host no-injury rejection must undo a stale guest prediction');assert.equal(cycleRun('player.kit.nextSignatureAt'), 0);
    assert.doesNotMatch(cycleRun('$("message").children.map(node=>node.textContent).join(" ")'), /再使用可能|秒経過/, 'A real guest heal rejection ACK must not announce an elapsed recharge');

    run('elapsed=20;remoteMend.kit.smoke=2;remoteMend.kit.updraft=1');positionSnapshot();
    cycleRun('player.yaw=0;player.pitch=-.2;var pressedSeeds=getSkillTarget(player,"mend-seeds",null,{yaw:0,pitch:-.2});useAbility("c");player.yaw=1;player.pitch=-.7');
    assert.equal(cycleRun('player.kit.smoke'), 1);assert.equal(cycleRun('ordinarySkills.events(elapsed).length'), 0);relayMend();positionSnapshot();
    assertNear(run('ordinarySkills.events(elapsed)[0].x'), cycleRun('pressedSeeds.x'));assertNear(run('ordinarySkills.events(elapsed)[0].z'), cycleRun('pressedSeeds.z'));
    run('var remoteSeeds=ordinarySkills.events(elapsed)[0];player.x=remoteSeeds.x;player.z=remoteSeeds.z;elapsed=20.65;updateOrdinarySkills()');positionSnapshot();cycleRun('updateBots(.3)');
    assertNear(run('actorSpeedScale(player)'), MEND_SKILLS.seedsSpeedScale);assertNear(cycleRun('actorSpeedScale(bots.find(bot=>bot.id==="player"))'), MEND_SKILLS.seedsSpeedScale);assert.equal(cycleRun('actorSpeedScale(player)'), 1, 'A restored seeds field must leave its own caster team at full speed');
    run('elapsed=21');positionSnapshot();cycleRun('player.yaw=0;player.pitch=-.2;useAbility("q")');assert.equal(cycleRun('player.kit.updraft'), 0);assert.equal(cycleRun('activePollenFields().length'), 0);relayMend();
    run('elapsed=21.55;updateOrdinarySkills()');positionSnapshot();assert.equal(run('activePollenFields().length'), 1);assert.equal(cycleRun('activePollenFields().length'), 1);
    assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(ordinarySkills.snapshot())')),JSON.parse(run('JSON.stringify(ordinarySkills.snapshot())')));
    run('elapsed=22');cycleRun('netHasSnapshot=false');positionSnapshot();assertNear(cycleRun('activePollenFields()[0].endsAt'), 21+MEND_SKILLS.pollenFlight+MEND_SKILLS.pollenDuration, 'Fresh restore must retain the original pollen expiry');
    run('match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()');positionSnapshot();cycleRun('renderOrdinarySkills()');
    for(const evaluate of [run,cycleRun]){assert.equal(evaluate('ordinarySkills.snapshot().events.length'),0);assert.equal(evaluate('activePollenFields().length'),0);assert.equal(evaluate('mendSkillFX.group.visible'),false);}
    cycleRun('leaveOnline()');run('leaveOnline()');for(const select of [document.getElementById('agent-select'),cycleDocument.getElementById('agent-select')]){select.value='duelist';dispatchElement(select,'change',{target:select});}run('startGame()');
    console.log('PASS: independent MEND charges/old-ACK prediction, host-only healing/duplicates/rejoin/rejected stale heal, captured seeds aim, shared slow/pollen expiry and next-round cleanup');
  }

  // IAGNU's ordinary kit crosses the real targeting/input and independent JSON
  // boundaries. Private detections are frozen contacts, never live actor tracks.
  {
    run(`function iagnuOrdinarySetup(){
      if(online)leaveOnline();onlinePlaying=false;mode='menu';$('agent-select').value='echo';$('match-format').value='standard';$('starting-side').value='attack';startGame();startRound();
      clearCombatInput();elapsed=10;resetOrdinarySkills();Object.assign(player,{x:0,z:20,y:0,yaw:0,pitch:0,vy:0,vx:0,vz:0,hp:100,armor:0,crouch:0,dashTimer:0,skillThrowUntil:0});
      player.kit.smoke=2;player.kit.updraft=1;player.kit.dash=1;player.kit.nextSignatureAt=0;
      bots.forEach((bot,index)=>Object.assign(bot,{x:35,z:30+index,y:0,hp:100,armor:0,alive:true,rangeTarget:true,fire:999,target:null}));
    }iagnuOrdinarySetup();
    var tagEnemy=bots.find(bot=>bot.id==='red-0'),tagCovered=bots.find(bot=>bot.id==='red-1'),tagHigh=bots.find(bot=>bot.id==='red-2'),tagAlly=bots.find(bot=>bot.id==='blue-1');
    Object.assign(tagEnemy,{x:0,z:25});Object.assign(tagCovered,{x:3,z:12});Object.assign(tagHigh,{x:-1,z:12,y:2.501});Object.assign(tagAlly,{x:.5,z:12});
    var tagEffect=activateAbility(player,'c',{zonePoint:{x:0,y:0,z:12},aim:{yaw:0,pitch:0}}),tagEvent=ordinarySkills.events(elapsed)[0];
    map.colliders.push({minX:1,maxX:2,minZ:11.5,maxZ:12.5,height:4});`);
    assert.equal(run('tagEffect.type'), 'echo-tag'); assert.equal(run('player.kit.smoke'), 1); assertNear(run('tagEvent.y'), .12);
    assertNear(run('tagEvent.triggerAt'), 10+IAGNU_SKILLS.tagFlight+IAGNU_SKILLS.tagArmDelay); assertNear(run('tagEvent.endsAt'), 10+IAGNU_SKILLS.tagFlight+IAGNU_SKILLS.tagArmDelay+IAGNU_SKILLS.tagDuration, 'The watch begins after flight and arming');
    for(const time of [10.55,11.049,11.05]){run(`elapsed=${time};updateOrdinarySkills()`);assert.equal(run('ordinarySkills.markers("blue",elapsed).length'),0,'Flying/unarmed tags, allies, walls and another floor must not invent a detection');}
    run('elapsed=11.1;tagEnemy.x=.5;tagEnemy.z=12;updateOrdinarySkills();var frozenTag=ordinarySkills.markers("blue",elapsed)[0]');
    assert.equal(run('ordinarySkills.events(elapsed).length'),0,'A detection consumes its placed tag');
    assert.deepEqual(JSON.parse(run('JSON.stringify([frozenTag.x,frozenTag.z,frozenTag.detectedAt,frozenTag.endsAt])')),[.5,12,11.1,11.1+IAGNU_SKILLS.tagRevealDuration]);
    assert.equal(run('Object.hasOwn(frozenTag,"targetId")'),false); assert.equal(run('ordinarySkills.markers("red",elapsed).length'),0);
    run('tagEnemy.x=20;tagEnemy.z=-20;elapsed=11.2;updateOrdinarySkills()'); assertNear(run('ordinarySkills.markers("blue",elapsed)[0].x'),.5,'Moving actors must not drag a recorded marker');
    assert.equal(run('tagEnemy.hp'),100);run('elapsed=11.1+IAGNU_SKILLS.tagRevealDuration;updateOrdinarySkills();map.colliders.pop()');assert.equal(run('ordinarySkills.markers("blue",elapsed).length'),0);
    run('iagnuOrdinarySetup();var maxTagPoint=getSkillTarget(player,"echo-tag",{x:0,z:-30});activateAbility(player,"c",{zonePoint:{x:0,z:-30}})');
    assert.ok(run('Math.hypot(maxTagPoint.x-player.x,maxTagPoint.z-player.z)')<=IAGNU_SKILLS.tagRange+1e-8,'Actual targeting must clamp tags to the configured range');
    assert.equal(run('ordinarySkills.events(elapsed)[0].type'),'echo-tag');

    run(`iagnuOrdinarySetup();var glintEnemy=bots.find(bot=>bot.id==='red-0'),glintAway=bots.find(bot=>bot.id==='red-1'),glintCovered=bots.find(bot=>bot.id==='red-2'),glintAlly=bots.find(bot=>bot.id==='blue-1');
      Object.assign(glintEnemy,{x:0,z:10,rangeTarget:false,target:player,think:10,fire:999});glintEnemy.group.rotation.y=2*Math.PI;
      Object.assign(glintAway,{x:1,z:10,yaw:0});Object.assign(glintCovered,{x:3,z:15,yaw:Math.PI/2});Object.assign(glintAlly,{x:-1,z:10,yaw:Math.PI});
      var glintEffect=activateAbility(player,'q',{zonePoint:{x:0,z:15},aim:{yaw:0,pitch:0}}),glintEvent=ordinarySkills.events(elapsed)[0];
      map.colliders.push({minX:1,maxX:2,minZ:14.5,maxZ:15.5,height:4});elapsed=10.499;updateOrdinarySkills();`);
    assert.equal(run('glintEffect.type'),'echo-glint');assert.equal(run('player.vy'),0,'IAGNU Q is a flash, never an inherited updraft');assertNear(run('glintEvent.y'),1.6);
    assert.equal(run('ordinarySkills.blindUntil(player.id,elapsed)'),0);run('elapsed=10.5;updateOrdinarySkills()');
    for(const actor of ['player','glintEnemy','glintAlly'])assertNear(run(`ordinarySkills.blindUntil(${actor}.id,elapsed)`),10+IAGNU_SKILLS.glintFlight+IAGNU_SKILLS.glintDuration,'Facing viewers of either team can be blinded');
    for(const actor of ['glintAway','glintCovered'])assert.equal(run(`ordinarySkills.blindUntil(${actor}.id,elapsed)`),0,'Looking away and real cover must block a flash');
    assert.equal(run('glintEnemy.target'),null,'A flashed BOT must lose its current firing target in the same host update');
    run('updateOrdinarySkills();elapsed=10+IAGNU_SKILLS.glintFlight+IAGNU_SKILLS.glintDuration;updateOrdinarySkills();map.colliders.pop()');assert.equal(run('ordinarySkills.blindUntil(player.id,elapsed)'),0);

    run(`iagnuOrdinarySetup();equip('vandal',true);player.ammo=4;player.reserve=30;reloading=1.2;firing=true;
      var kerningEquipment=JSON.stringify({weapon:inventory.active,ammo:player.ammo,reserve:player.reserve}),kerningEffect=activateAbility(player,'e');`);
    assert.equal(run('kerningEffect.type'),'echo-kerning');assert.equal(run('player.kit.dash'),0);assert.equal(run('player.kit.nextSignatureAt'),10+IAGNU_SKILLS.signatureCooldown);
    assert.equal(run('firing'),true);assert.equal(run('reloading'),1.2);assert.equal(run('player.skillThrowUntil||0'),0,'A self movement buff has no throw lock');
    assert.equal(run('JSON.stringify({weapon:inventory.active,ammo:player.ammo,reserve:player.reserve})'),run('kerningEquipment'));assert.equal(run('player.dashTimer'),0);
    assertNear(run('actorSpeedScale(player)'),IAGNU_SKILLS.kerningSpeedScale);assert.equal(run('actorSpeedScale(bots.find(bot=>bot.id==="blue-1"))'),1);
    run('reloading=0;firing=false;player.vz=-(5.4*1.15)*IAGNU_SKILLS.kerningSpeedScale;keys.add("KeyW");updatePlay(.1);keys.clear()');assertNear(run('20-player.z'),(5.4*1.15)*.1*IAGNU_SKILLS.kerningSpeedScale,'Real walking must use the configured speed without a dash');
    run('var kerningEnemy=bots.find(bot=>bot.id==="red-0");kerningEnemy.x=0;kerningEnemy.z=12;zoneAbilities.cast("frost",kerningEnemy,{x:player.x,y:0,z:player.z},elapsed,match.round);elapsed+=.8');
    assertNear(run('actorSpeedScale(player)'),.55*IAGNU_SKILLS.kerningSpeedScale,'The buff multiplies an existing enemy slow instead of replacing it');
    run('elapsed=10+IAGNU_SKILLS.kerningDuration;updateOrdinarySkills()');assertNear(run('actorSpeedScale(player)'),.55,'The buff expires at its deadline even while a slow remains');
    run('iagnuOrdinarySetup();activateAbility(player,"e");player.alive=false;updateOrdinarySkills();player.alive=true;updateOrdinarySkills()');assert.equal(run('actorSpeedScale(player)'),1,'Death must permanently remove a personal buff');
    run('iagnuOrdinarySetup();for(let i=0;i<20;i++)ordinarySkills.cast("echo-tag",player,{x:0,y:.12,z:12},elapsed,match.round);var capStock=player.kit.snapshot();activateAbility(player,"q")');
    assert.equal(run('ordinarySkills.events(elapsed).length'),20);assert.equal(run('player.kit.updraft'),run('capStock.updraft'),'A full bounded field store must reject/rollback a cast rather than spend or evict');
    run(`function iagnuBotSetup(key){
      iagnuOrdinarySetup();var bot=bots.find(item=>item.id==='red-0');Object.assign(bot,{x:0,z:8,y:0,rangeTarget:false,target:key==='e'?null:player,think:10,reactionUntil:0,fire:999,nextSkillAt:0});
      bot.group.rotation.y=2*Math.PI;bot.kit=new DuelistKit({character:'echo'});bot.kit.smoke=key==='c'?1:0;bot.kit.updraft=key==='q'?1:0;bot.kit.dash=key==='e'?1:0;
      if(key==='e'){player.x=35;player.z=35;}return bot;
    }`);
    for(const [key,type] of [['c','echo-tag'],['q','echo-glint'],['e','echo-kerning']]){
      run(`var echoBot=iagnuBotSetup('${key}');updateBots(.05)`);
      assert.equal(run(`ordinarySkills.events(elapsed).some(event=>event.type==='${type}'&&event.sourceId===echoBot.id)`),true,`Actual BOT decisions must use the distinct ${key.toUpperCase()} skill`);
      assert.equal(run('echoBot.dashTimer||0'),0,'A tactical echo cast must not inherit a physical dash');
    }
    run('var echoBot=iagnuBotSetup("e");echoBot.kit.dash=0;updateBots(.05);var echoBaseStep=Math.hypot(echoBot.x,echoBot.z-8);echoBot=iagnuBotSetup("e");updateBots(.05);var echoBoostStep=Math.hypot(echoBot.x,echoBot.z-8)');
    assert.ok(run('echoBaseStep')>0);assertNear(run('echoBoostStep/echoBaseStep'),IAGNU_SKILLS.kerningSpeedScale,'The actual BOT navigation advance must use the same speed multiplier');
    console.log('PASS: IAGNU actual tag targeting/flight/arm/LOS/height/frozen contact, facing glint and BOT target loss, buffed walking×slow/no-dash/reload preservation/death/cap rollback');

    cycleRun('if(online)leaveOnline()');run(movementSetup(true));cycleRun(movementSetup(false));
    run(`elapsed=10;var remoteEcho=bots.find(bot=>bot.id==='red-0');remoteEcho.kit=new DuelistKit({character:'echo'});remoteEcho.kit.smoke=2;remoteEcho.kit.updraft=1;
      Object.assign(remoteEcho,{x:0,z:20,y:0,hp:100,netWeapon:'vandal',netAmmo:25,netReserve:75});remoteEcho.record.primary='vandal';
      bots.forEach(bot=>{bot.rangeTarget=true;if(bot!==remoteEcho){bot.x=35;bot.z=35;}});Object.assign(player,{x:-30,z:30,y:0,hp:100});`);
    positionSnapshot();cycleRun('useAbility("e")');assert.equal(cycleRun('player.kit.dash'),0);assert.equal(cycleRun('actorSpeedScale(player)'),1,'Unacknowledged guest stock prediction may not create a speed advantage');
    positionSnapshot();assert.equal(cycleRun('player.kit.dash'),0);assert.equal(cycleRun('ordinarySkills.events(elapsed).length'),0);
    const relayEcho=()=>{cycleRun('tickOnline(.1)');const packet=JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));sandbox.echoInput=packet;run('receiveNetPacket("friend",echoInput);updateRemoteActor(remoteEcho,.05)');return packet;};
    const kerningInput=relayEcho();assertNear(run('actorSpeedScale(remoteEcho)'),IAGNU_SKILLS.kerningSpeedScale);positionSnapshot();assertNear(cycleRun('actorSpeedScale(player)'),IAGNU_SKILLS.kerningSpeedScale);
    sandbox.echoDuplicate={...kerningInput,seq:kerningInput.seq+1};run('receiveNetPacket("friend",echoDuplicate);updateRemoteActor(remoteEcho,.05)');cycleRun(`netSequence=${kerningInput.seq+1}`);
    assert.equal(run('ordinarySkills.events(elapsed).length'),1);assertNear(run('remoteEcho.kit.nextSignatureAt'),10+IAGNU_SKILLS.signatureCooldown);
    // The host accepts boosted movement but still caps an impossible remote jump.
    run('netInputs.set("friend",{seq:101,connection:"echo-cap",round:match.round,received:elapsed,input:{x:10,z:20,y:0,yaw:0,pitch:0},actions:[]});updateRemoteActor(remoteEcho,.1)');
    assertNear(run('remoteEcho.x'),.7*1.15*IAGNU_SKILLS.kerningSpeedScale,'Host movement authority must apply the configured multiplier to its existing7m/s normal cap');
    run('netInputs.clear();remoteEcho.x=0;remoteEcho.z=20;elapsed=10.4');cycleRun('netHasSnapshot=false');positionSnapshot();assertNear(cycleRun('actorSpeedScale(player)'),IAGNU_SKILLS.kerningSpeedScale,'A rejoin restores the original live buff, without recasting it');
    run('elapsed=10+IAGNU_SKILLS.kerningDuration;updateOrdinarySkills()');positionSnapshot();assert.equal(cycleRun('actorSpeedScale(player)'),1);

    run('elapsed=20;remoteEcho.kit.smoke=2;remoteEcho.kit.updraft=1');positionSnapshot();
    cycleRun('player.yaw=0;player.pitch=-.2;var pressedTag=getSkillTarget(player,"echo-tag",null,{yaw:0,pitch:-.2});useAbility("c");player.yaw=1;player.pitch=-.7');
    assert.equal(cycleRun('player.kit.smoke'),1);assert.equal(cycleRun('ordinarySkills.events(elapsed).length'),0);
    relayEcho();assertNear(run('ordinarySkills.events(elapsed)[0].x'),cycleRun('pressedTag.x'));assertNear(run('ordinarySkills.events(elapsed)[0].z'),cycleRun('pressedTag.z'));
    run('var authoritativeTag=ordinarySkills.events(elapsed)[0];player.x=authoritativeTag.x;player.z=authoritativeTag.z;player.y=0;elapsed=21.049;updateOrdinarySkills()');
    positionSnapshot();assert.equal(cycleRun('ordinarySkills.markers("red",elapsed).length'),0);
    run('elapsed=21.05;updateOrdinarySkills()');
    // Capture both actual host packets rather than the one-recipient mock.
    run('var echoSendOriginal=online.send;online.teamPackets=[];online.send=function(packet,options){this.teamPackets.push({packet,team:options.team});echoSendOriginal.call(this,packet,options)}');
    const detectionPacket=positionSnapshot();assert.equal(detectionPacket.ordinarySkills.markers.length,1);assert.equal(detectionPacket.ordinarySkills.markers[0].team,'red');
    assert.equal(run('online.teamPackets.find(entry=>entry.team==="blue").packet.ordinarySkills.markers.length'),0,'The opposing transport packet must not contain a private tag position');
    assert.equal(run('online.teamPackets[0].packet.seq===online.teamPackets[1].packet.seq'),true);
    run('online.send=echoSendOriginal;player.x=30;player.z=30;elapsed=21.1');positionSnapshot();
    assertNear(cycleRun('ordinarySkills.markers("red",elapsed)[0].x'),detectionPacket.ordinarySkills.markers[0].x,'Subsequent snapshots must retain the sampled position rather than track a moved target');
    cycleRun('netHasSnapshot=false');positionSnapshot();assertNear(cycleRun('ordinarySkills.markers("red",elapsed)[0].endsAt'),21.05+IAGNU_SKILLS.tagRevealDuration);
    cycleRun('updateOrdinarySkills();updateOrdinarySkills()');assert.equal(cycleRun('ordinarySkills.snapshot().events.length'),0,'A fresh guest may display a marker but must never re-arm the consumed field');
    run('elapsed=21.05+IAGNU_SKILLS.tagRevealDuration;updateOrdinarySkills()');positionSnapshot();assert.equal(cycleRun('ordinarySkills.markers("red",elapsed).length'),0);
    run('elapsed=25;remoteEcho.x=0;remoteEcho.z=20;player.x=0;player.z=10;player.yaw=Math.PI');positionSnapshot();
    cycleRun('player.yaw=0;player.pitch=-.35;var pressedGlint=getSkillTarget(player,"echo-glint",null,{yaw:0,pitch:-.35});useAbility("q");player.yaw=1');relayEcho();
    assertNear(run('ordinarySkills.events(elapsed)[0].x'),cycleRun('pressedGlint.x'));assert.equal(cycleRun('player.vy'),0);
    run('elapsed=25.5;updateOrdinarySkills()');positionSnapshot();assert.ok(cycleRun('ordinarySkills.blindUntil(player.id,elapsed)')>25.5);
    const blindEnd=cycleRun('ordinarySkills.blindUntil(player.id,elapsed)');positionSnapshot();assert.equal(cycleRun('ordinarySkills.blindUntil(player.id,elapsed)'),blindEnd,'A repeated host snapshot cannot restart a glint');
    run('match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()');positionSnapshot();
    for(const evaluate of [run,cycleRun]){assert.equal(evaluate('ordinarySkills.events(elapsed).length'),0);assert.equal(evaluate('ordinarySkills.snapshot().markers.length'),0);assert.equal(evaluate('ordinarySkills.blindUntil(player.id,elapsed)'),0);}
    cycleRun('leaveOnline()');run('leaveOnline()');for(const select of [document.getElementById('agent-select'),cycleDocument.getElementById('agent-select')]){select.value='duelist';dispatchElement(select,'change',{target:select});}run('startGame()');
    assert.equal(run('iagnuSkillFX.group.visible'),false);
    console.log('PASS: independent IAGNU guest stock-only prediction, host speed cap/ACK/duplicate/rejoin, captured C/Q aim, team-private frozen tag packets, glint expiry and next-round/menu cleanup');
  }

  // Grass control skills use actual supported feet, rather than assuming that
  // only y=0 is grounded. All effects below cross the real game adapters.
  {
    run(`function grassOrdinarySetup(){
      if(online)leaveOnline();onlinePlaying=false;mode='menu';$('agent-select').value='veil';$('match-format').value='standard';$('starting-side').value='attack';startGame();startRound();
      clearCombatInput();elapsed=10;resetOrdinarySkills();Object.assign(player,{x:0,z:20,y:0,yaw:0,pitch:0,vy:0,vx:0,vz:0,hp:100,armor:0,crouch:0,dashTimer:0,skillThrowUntil:0});
      player.kit.smoke=2;player.kit.updraft=1;player.kit.dash=1;player.kit.nextSignatureAt=0;
      bots.forEach((bot,index)=>Object.assign(bot,{x:35,z:30+index,y:0,vy:0,hp:100,armor:0,alive:true,rangeTarget:true,fire:999,target:null}));
    }grassOrdinarySetup();
    var dustEffect=activateAbility(player,'c',{zonePoint:{x:10,y:5,z:10}}),dustEvent=ordinarySkills.events(elapsed)[0];`);
    assert.equal(run('dustEffect.type'),'veil-dust');assert.equal(run('player.kit.smoke'),1);
    assert.deepEqual(JSON.parse(run('JSON.stringify([dustEvent.x,dustEvent.y,dustEvent.z,dustEvent.fromY,dustEvent.radius,dustEvent.flight])')),[0,VEIL_SKILLS.dustCenterOffset,20,0,VEIL_SKILLS.dustRadius,0]);
    assertNear(run('dustEvent.triggerAt'),10.2);assertNear(run('dustEvent.endsAt'),10+VEIL_SKILLS.dustArmDelay+VEIL_SKILLS.dustDuration);
    run('var dustShooter=bots.find(bot=>bot.id==="red-0");Object.assign(dustShooter,{x:-4,z:20,target:player});elapsed=10.199;updateOrdinarySkills()');assert.equal(run('visibleBetween({x:-4,y:0,z:20},{x:4,y:0,z:20})'),true,'Self dust must not obscure before its .2s arm');assert.equal(run('dustShooter.target===player'),true);
    run('elapsed=10.2;updateOrdinarySkills()');assert.equal(run('visibleBetween({x:-4,y:0,z:20},{x:4,y:0,z:20})'),false,'Active dust must obscure the actual player/BOT sight query');assert.equal(run('dustShooter.target'),null,'Arming dust must cancel a cached BOT target in that same update');
    assert.equal(run('smokeBlocks({x:-4,y:-.2,z:20+VEIL_SKILLS.dustRadius-.01,team:"blue"},{x:4,y:-.2,z:20+VEIL_SKILLS.dustRadius-.01,team:"blue"})'),true);assert.equal(run('smokeBlocks({x:-4,y:-.2,z:20+VEIL_SKILLS.dustRadius+.01,team:"red"},{x:4,y:-.2,z:20+VEIL_SKILLS.dustRadius+.01,team:"blue"})'),false,'Dust must use its ownconfigured dust boundary for both teams');
    run('updatePlay(.01)');assert.equal(run('scene.fog.far'),2.5,'The caster must see opaque fog inside the same dust sphere');
    run('player.x=4;updatePlay(.01)');assert.equal(run('scene.fog.far'),380);assertNear(run('ordinarySkills.events(elapsed)[0].x'),0,'A placed dust centre must not follow its moving owner');
    run('var dustWatched=bots.find(bot=>bot.team===player.team);dustWatched.x=0;dustWatched.z=20;player.alive=false;spectateIndex=0;updatePlay(.01)');
    assert.equal(run('scene.fog.far'),2.5,'Spectator fog must use the watched camera inside dust, not the corpse outside');
    run('dustWatched.x=6;player.x=0;updatePlay(.01)');assert.equal(run('scene.fog.far'),380,'A corpse inside dust must not obscure a watched teammate outside');
    assert.equal(run('ordinarySkills.events(elapsed).length'),1,'Owner death must not delete fixed dust');
    run('elapsed=10+VEIL_SKILLS.dustArmDelay+VEIL_SKILLS.dustDuration;updateOrdinarySkills()');assert.equal(run('ordinarySkills.events(elapsed).length'),0);

    run('grassOrdinarySetup();var rootsEffect=activateAbility(player,"q",{zonePoint:{x:0,y:0,z:20-VEIL_SKILLS.rootsRange}}),rootsEvent=ordinarySkills.events(elapsed)[0];var rootsEnemy=bots.find(bot=>bot.id==="red-0"),rootsAlly=bots.find(bot=>bot.id==="blue-1");Object.assign(rootsEnemy,{x:1.19,z:16});Object.assign(rootsAlly,{x:0,z:16});');
    assert.equal(run('rootsEffect.type'),'veil-roots');assert.equal(run('player.vy'),0,'Roots replace Q updraft');assertNear(run('Math.hypot(rootsEvent.x-rootsEvent.fromX,rootsEvent.z-rootsEvent.fromZ)'),VEIL_SKILLS.rootsRange);
    assertNear(run('rootsEvent.radius'),VEIL_SKILLS.rootsWidth/2);assertNear(run('rootsEvent.fromY'),0);assertNear(run('rootsEvent.triggerAt'),10.25);assertNear(run('rootsEvent.endsAt'),10+VEIL_SKILLS.rootsArmDelay+VEIL_SKILLS.rootsDuration);
    run('elapsed=10.249;updateOrdinarySkills()');assert.equal(run('actorSpeedScale(rootsEnemy)'),1);
    run('elapsed=10.25;updateOrdinarySkills()');assertNear(run('actorSpeedScale(rootsEnemy)'),VEIL_SKILLS.rootsSpeedScale);assert.equal(run('actorSpeedScale(rootsAlly)'),1,'Roots must not slow allies');
    run('rootsEnemy.x=VEIL_SKILLS.rootsWidth/2+.001');assert.equal(run('actorSpeedScale(rootsEnemy)'),1,'The band must not become a circular field');
    run('rootsEnemy.x=0;rootsEnemy.z=20-VEIL_SKILLS.rootsRange-VEIL_SKILLS.rootsWidth/2-.01');assert.equal(run('actorSpeedScale(rootsEnemy)'),1,'The finite band must not extend indefinitely past its endpoint');
    run('rootsEnemy.x=1;rootsEnemy.z=16;map.colliders.push({minX:.4,maxX:.6,minZ:15,maxZ:17,height:3})');assert.equal(run('actorSpeedScale(rootsEnemy)'),1,'The nearest strip point must not slow an enemy through a real wall');run('map.colliders.pop()');
    run('map.colliders.push({minX:.7,maxX:VEIL_SKILLS.turfSpeedScale,minZ:15.7,maxZ:16.3,height:.45});rootsEnemy.y=.45');assertNear(run('actorSpeedScale(rootsEnemy)'),VEIL_SKILLS.rootsSpeedScale,'A supported target at the .45m height boundary remains reachable');
    run('map.colliders.at(-1).height=.451;rootsEnemy.y=.451');assert.equal(run('actorSpeedScale(rootsEnemy)'),1,'A supported target above the allowed surface height must not be caught');run('map.colliders.pop()');
    run('rootsEnemy.x=0;rootsEnemy.y=.5;rootsEnemy.vy=0');assert.equal(run('actorSpeedScale(rootsEnemy)'),1,'An unsupported airborne apex is not grounded even with zero vertical velocity');
    run('rootsEnemy.y=0');assertNear(run('actorSpeedScale(rootsEnemy)'),VEIL_SKILLS.rootsSpeedScale,'An actor without an active buff must retain the roots slow');
    run('player.alive=false;elapsed=10.3;updateOrdinarySkills()');assertNear(run('actorSpeedScale(rootsEnemy)'),VEIL_SKILLS.rootsSpeedScale,'Fixed roots survive caster death');
    run('elapsed=10+VEIL_SKILLS.rootsArmDelay+VEIL_SKILLS.rootsDuration;updateOrdinarySkills()');assert.equal(run('actorSpeedScale(rootsEnemy)'),1);

    run('grassOrdinarySetup();map.colliders.push({minX:-2,maxX:2,minZ:16,maxZ:21,base:2.8,height:3.2});player.y=3.2;var upperRoots=activateAbility(player,"q",{zonePoint:{x:0,y:3.2,z:13}});var upperEnemy=bots.find(bot=>bot.id==="red-0");Object.assign(upperEnemy,{x:0,z:18,y:3.2,vy:0});elapsed=10.25;updateOrdinarySkills()');
    assert.equal(run('upperRoots.type'),'veil-roots');assertNear(run('actorSpeedScale(upperEnemy)'),VEIL_SKILLS.rootsSpeedScale,'A supported elevated deck must accept a ground cast and slow its own floor');
    assert.ok(run('ordinarySkills.events(elapsed)[0].z')>=16,'The continuous roots adapter must stop at the supported deck edge');
    run('upperEnemy.y=0');assert.equal(run('actorSpeedScale(upperEnemy)'),1,'A deck strip must not affect the underpass');
    run('resetOrdinarySkills();activateAbility(player,"e")');assertNear(run('actorSpeedScale(player)'),VEIL_SKILLS.turfSpeedScale,'A supported3.2m deck is valid ground for turf');
    run('player.x=4');assert.equal(run('actorSpeedScale(player)'),1,'Walking off an elevated deck must end turf even before the first gravity sample');
    run('player.x=0');assert.equal(run('actorSpeedScale(player)'),1,'Returning sideways to a supported floor cannot revive the activation');
    run('map.colliders.pop()');

    run('grassOrdinarySetup();map.ramps.push({minX:-1,maxX:1,minZ:16,maxZ:20,axis:"z",direction:-1,base:0,height:1});player.z=18;player.y=.5;activateAbility(player,"e");player.vz=-(5.4*1.15)*VEIL_SKILLS.turfSpeedScale;keys.add("KeyW");updatePlay(.1);keys.clear()');
    assertNear(run('actorSpeedScale(player)'),VEIL_SKILLS.turfSpeedScale,'Continuous supported ramp ascent must not be mistaken for leaving the ground');assert.ok(run('player.y')>.5);run('map.ramps.pop()');
    run('grassOrdinarySetup();var grassSlowCaster=bots.find(bot=>bot.id==="red-0");Object.assign(grassSlowCaster,{x:0,z:22,y:0,vy:0});ordinarySkills.cast("veil-roots",ordinaryActorView(grassSlowCaster),{x:0,y:0,z:15},elapsed,match.round);activateAbility(player,"e");elapsed+=.25;updateOrdinarySkills()');assertNear(run('actorSpeedScale(player)'),VEIL_SKILLS.rootsSpeedScale*VEIL_SKILLS.turfSpeedScale,'Grass slow and turf multiply without additive or stacking bonuses');

    for(const key of ['c','q','e']){
      run(`grassOrdinarySetup();player.y=1;player.vy=0;var airborneStock=JSON.stringify(player.kit.snapshot());var airborneCast=activateAbility(player,'${key}',{zonePoint:{x:0,y:0,z:13}})`);
      assert.equal(run('airborneCast'),undefined,'All three ground skills must reject an unsupported actor before consuming stock');assert.equal(run('JSON.stringify(player.kit.snapshot())'),run('airborneStock'));
    }
    for(const hz of [20,60,144]){
      run(`grassOrdinarySetup();var turfEffect=activateAbility(player,'e');player.vz=-(5.4*1.15)*VEIL_SKILLS.turfSpeedScale;keys.add('KeyW');for(let i=0;i<${hz/2};i++)updatePlay(${1/hz});keys.clear()`);
      assert.equal(run('turfEffect.type'),'veil-turf');assertNear(run('20-player.z'),(5.4*1.15)*VEIL_SKILLS.turfSpeedScale*.5,`${hz}Hz ordinary walking must retainconfigured turf speed gain`);assert.equal(run('player.dashTimer'),0);assertNear(run('player.kit.nextSignatureAt'),10+VEIL_SKILLS.signatureCooldown);
      run('jump();updatePlay(.01)');assert.equal(run('actorSpeedScale(player)'),1,'Jumping must end the buff immediately');
      run(`for(let i=0;i<${hz};i++)updatePlay(${1/hz});player.y=0;player.vy=0;updateOrdinarySkills()`);assert.equal(run('actorSpeedScale(player)'),1,'Landing must not resurrect the same turf activation');
    }
    run('grassOrdinarySetup();activateAbility(player,"e");player.alive=false;updateOrdinarySkills();player.alive=true;updateOrdinarySkills()');assert.equal(run('actorSpeedScale(player)'),1);
    for(const key of ['c','q','e']){
      run(`grassOrdinarySetup();for(let i=0;i<20;i++)ordinarySkills.cast('echo-tag',player,{x:0,y:.12,z:13},elapsed,match.round);var grassCapStock=JSON.stringify(player.kit.snapshot());activateAbility(player,'${key}',{zonePoint:{x:0,y:0,z:13}})`);
      assert.equal(run('ordinarySkills.events(elapsed).length'),20);assert.equal(run('JSON.stringify(player.kit.snapshot())'),run('grassCapStock'),'A full field store must preserve every charge/CD');
    }
    console.log('PASS: grass actual fixed self dust/arming/LOS/own and spectator fog, finite grounded roots/wall/underpass/death,configured turf speed20/60/144Hz turf/jump permanent end and C/Q/E ground/cap rejection');

    cycleRun('if(online)leaveOnline()');run(movementSetup(true));cycleRun(movementSetup(false));
    run(`elapsed=10;var remoteGrass=bots.find(bot=>bot.id==='red-0');remoteGrass.kit=new DuelistKit({character:'veil'});remoteGrass.kit.smoke=2;remoteGrass.kit.updraft=1;Object.assign(remoteGrass,{x:0,z:20,y:0,vy:0,hp:100});bots.forEach(bot=>{bot.rangeTarget=true;if(bot!==remoteGrass){bot.x=35;bot.z=35;}});Object.assign(player,{x:-30,z:30,y:0,hp:100});`);
    positionSnapshot();cycleRun('useAbility("e")');assert.equal(cycleRun('player.kit.dash'),0);assert.equal(cycleRun('actorSpeedScale(player)'),1,'Guest turf must not grant predicted movement before host approval');
    const relayGrass=()=>{cycleRun('tickOnline(.1)');sandbox.grassInput=JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));run('receiveNetPacket("friend",grassInput);updateRemoteActor(remoteGrass,.05)');return sandbox.grassInput;};
    const turfInput=relayGrass();assertNear(run('actorSpeedScale(remoteGrass)'),VEIL_SKILLS.turfSpeedScale);positionSnapshot();assertNear(cycleRun('actorSpeedScale(player)'),VEIL_SKILLS.turfSpeedScale);
    sandbox.grassDuplicate={...turfInput,seq:turfInput.seq+1};run('receiveNetPacket("friend",grassDuplicate);updateRemoteActor(remoteGrass,.05)');cycleRun(`netSequence=${turfInput.seq+1}`);assert.equal(run('ordinarySkills.events(elapsed).length'),1);assertNear(run('remoteGrass.kit.nextSignatureAt'),10+VEIL_SKILLS.signatureCooldown);
    run('netInputs.set("friend",{seq:101,connection:"grass-cap",round:match.round,received:elapsed,input:{x:10,z:20,y:0,yaw:0,pitch:0},actions:[]});updateRemoteActor(remoteGrass,.1)');assertNear(run('remoteGrass.x'),.7*1.15*VEIL_SKILLS.turfSpeedScale,'Host normal movement cap must applyconfigured turf speed without dash authority');
    run('remoteGrass.x=0;netInputs.clear();elapsed=10.4');cycleRun('netHasSnapshot=false');positionSnapshot();assertNear(cycleRun('actorSpeedScale(player)'),VEIL_SKILLS.turfSpeedScale,'A fresh guest must retain the original buff age');
    cycleRun('player.y=1;player.vy=0;actorSpeedScale(player);player.y=0;player.vy=0');assert.equal(cycleRun('actorSpeedScale(player)'),1,'Local departure may not resume its already-ended restored effect on landing');
    positionSnapshot();assert.equal(cycleRun('actorSpeedScale(player)'),1,'An older still-active host event must not resurrect a locally ended turf after landing');
    run('netInputs.set("friend",{seq:102,connection:"grass-air",round:match.round,received:elapsed,input:{x:10,z:20,y:1,yaw:0,pitch:0},actions:[]});updateRemoteActor(remoteGrass,.1)');assertNear(run('remoteGrass.x'),.7*1.15,'The same input that becomes airborne must already use the normal host speed cap');
    run('remoteGrass.y=0;updateOrdinarySkills()');positionSnapshot();assert.equal(cycleRun('actorSpeedScale(player)'),1,'The host must synchronize permanent departure cleanup');
    run('elapsed=20;remoteGrass.kit.smoke=2;remoteGrass.kit.updraft=1');positionSnapshot();cycleRun('useAbility("c");player.x=4;player.yaw=1');assert.equal(cycleRun('ordinarySkills.events(elapsed).length'),0);relayGrass();
    assertNear(run('ordinarySkills.events(elapsed)[0].x'),run('remoteGrass.x'),'Authoritative self dust uses the accepted caster position, not a remote aim target');
    run('elapsed=20.3;updateOrdinarySkills()');positionSnapshot();cycleRun('netHasSnapshot=false');positionSnapshot();assertNear(cycleRun('ordinarySkills.events(elapsed)[0].endsAt'),20+VEIL_SKILLS.dustArmDelay+VEIL_SKILLS.dustDuration);
    run('elapsed=24;remoteGrass.x=0;remoteGrass.z=20;remoteGrass.y=0');positionSnapshot();cycleRun('player.yaw=0;player.pitch=0;useAbility("q");player.yaw=1');relayGrass();assertNear(run('ordinarySkills.events(elapsed).find(event=>event.type==="veil-roots").x-ordinarySkills.events(elapsed).find(event=>event.type==="veil-roots").fromX'),0,'Roots must use the captured press-time direction from the accepted host position');
    run('elapsed=24.25;updateOrdinarySkills()');positionSnapshot();assert.equal(cycleRun('ordinarySkills.events(elapsed).find(event=>event.type==="veil-roots").type'),'veil-roots');
    // A received stair pose must be coherent in X/Z/Y. Mixing yesterday's X/Z
    // with the new height would incorrectly consume an otherwise grounded buff.
    const grassTerrainKeys=['colliders','collision','ramps','bounds'],grassMaps=[run('map'),cycleRun('map')];
    const grassTerrain=grassMaps.map(world=>Object.fromEntries(grassTerrainKeys.map(key=>[key,world[key]])));
    for(const world of grassMaps)for(const key of grassTerrainKeys)world[key]=map[key];
    try{
      run('elapsed=30;resetOrdinarySkills();remoteGrass.kit.dash=1;remoteGrass.kit.nextSignatureAt=0;Object.assign(remoteGrass,{x:-69.5,z:-20,y:rampFloor(-69.5,-20),vy:0});delete remoteGrass.netPositionAck;netInputs.clear()');cycleRun('netHasSnapshot=false');positionSnapshot();cycleRun('useAbility("e")');relayGrass();assertNear(run('actorSpeedScale(remoteGrass)'),VEIL_SKILLS.turfSpeedScale);
      for(const z of [-20.7,-21.4,-20.7,-20]){
        cycleRun(`player.x=-69.5;player.z=${z};player.y=rampFloor(player.x,player.z);player.vy=0`);relayGrass();
        assert.equal(run('actorGrounded(remoteGrass)'),true,'The accepted remote stair position must remain on actual support');assertNear(run('actorSpeedScale(remoteGrass)'),VEIL_SKILLS.turfSpeedScale,'A supported ascent/descent must not cancel turf because the packet height belongs to its new X/Z');positionSnapshot();assertNear(cycleRun('actorSpeedScale(player)'),VEIL_SKILLS.turfSpeedScale,`A guest's predicted X/Z and restored feet must stay coherent on the stair: ${cycleRun('JSON.stringify({x:player.x,z:player.z,y:player.y,floor:rampFloor(player.x,player.z),grounded:actorGrounded(player),stopped:[...stoppedTurfEvents]})')}`);
      }
    }finally{for(let index=0;index<grassMaps.length;index++)Object.assign(grassMaps[index],grassTerrain[index]);}
    run('match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()');positionSnapshot();for(const evaluate of [run,cycleRun])assert.equal(evaluate('ordinarySkills.events(elapsed).length'),0);
    cycleRun('leaveOnline()');run('leaveOnline()');for(const select of [document.getElementById('agent-select'),cycleDocument.getElementById('agent-select')]){select.value='duelist';dispatchElement(select,'change',{target:select});}run('startGame()');
    console.log('PASS: independent grass guest stock-only prediction, host ground authority/configured turf speed cap/ACK/rejoin, permanent air cleanup, self dust/press-time roots and round/menu reset');
  }

  // EMBER services one captured weapon. Predicted progress must never become a
  // second ammunition authority, and glare protection modifies only new hits.
  {
    run(`function emberOrdinarySetup(){
      if(online)leaveOnline();onlinePlaying=false;mode='menu';$('agent-select').value='ember';$('match-format').value='standard';$('starting-side').value='attack';startGame();startRound();
      clearCombatInput();elapsed=10;resetOrdinarySkills();Object.assign(player,{x:0,z:20,y:0,yaw:0,pitch:0,vy:0,vx:0,vz:0,hp:100,armor:0,crouch:0,dashTimer:0,skillThrowUntil:0});
      player.kit.smoke=2;player.kit.updraft=1;player.kit.dash=1;player.kit.nextSignatureAt=0;inventory.primary='vandal';equip('vandal',true);player.ammo=4;player.reserve=5;
      bots.forEach((bot,index)=>Object.assign(bot,{x:35,z:30+index,y:0,vy:0,hp:100,armor:0,alive:true,rangeTarget:true,fire:999,target:null,skillThrowUntil:0}));
    }function emberAdvance(seconds,hz=60){let left=seconds;while(left>1e-9){const dt=Math.min(left,1/hz);updatePlay(dt);left-=dt;}}
    emberOrdinarySetup();var solderEnemy=bots.find(bot=>bot.id==='red-0'),solderWall=bots.find(bot=>bot.id==='red-1'),solderEdge=bots.find(bot=>bot.id==='red-2'),solderAlly=bots.find(bot=>bot.id==='blue-1');
    Object.assign(solderEnemy,{x:0,z:12});Object.assign(solderWall,{x:1.8,z:12});Object.assign(solderEdge,{x:-1.1,z:12});Object.assign(solderAlly,{x:-.5,z:12});
    var solderCast=activateAbility(player,'c',{zonePoint:{x:0,y:0,z:12},aim:{yaw:0,pitch:0}}),solderEvent=ordinarySkills.events(elapsed)[0];
    map.colliders.push({minX:.5,maxX:.8,minZ:11,maxZ:13,height:4});`);
    assert.equal(run('solderCast.type'),'ember-solder');assert.equal(run('player.kit.smoke'),1);assertNear(run('solderEvent.flight'),.45);assertNear(run('solderEvent.triggerAt'),10.65);assertNear(run('solderEvent.radius'),EMBER_SKILLS.solderRadius);
    run('elapsed=10.649;updateOrdinarySkills()');assert.equal(run('solderEnemy.hp'),100,'A solder bead must retain its flight and short warning');
    run('elapsed=10.65;updateOrdinarySkills()');assertNear(run('solderEnemy.hp'),100-EMBER_SKILLS.solderDamage,'The single centre hit must flow through host damageEntity');assertNear(run('solderEdge.hp'),100-EMBER_SKILLS.solderDamage*(1-1.1/EMBER_SKILLS.solderRadius),'Solder damage must fall linearly over its2.2m radius');assert.equal(run('solderWall.hp'),100,'Real cover must block the small blast');assert.equal(run('solderAlly.hp'),100);assert.equal(run('player.hp'),100);
    run('updateOrdinarySkills();elapsed=10.8;updateOrdinarySkills();map.colliders.pop()');assertNear(run('solderEnemy.hp'),100-EMBER_SKILLS.solderDamage,'Repeated updates cannot repeat the single hit');
    run('emberOrdinarySetup();solderEnemy=bots.find(bot=>bot.id==="red-0");Object.assign(solderEnemy,{x:0,z:12,armor:50});activateAbility(player,"c",{zonePoint:{x:0,y:0,z:12}});elapsed=10.65;updateOrdinarySkills()');const solderArmor=imported.applyArmorDamage(100,50,EMBER_SKILLS.solderDamage);assertNear(run('solderEnemy.hp'),solderArmor.hp);assertNear(run('solderEnemy.armor'),solderArmor.armor,'The bead must retain shared armor damage rules');
    run('emberOrdinarySetup();solderEnemy=bots.find(bot=>bot.id==="red-0");Object.assign(solderEnemy,{x:0,z:12,hp:10});activateAbility(player,"c",{zonePoint:{x:0,y:0,z:12}});player.alive=false;elapsed=10.65;updateOrdinarySkills()');
    assert.equal(run('solderEnemy.alive'),false,'A launched bead remains after its source dies');assert.equal(run('totalKills'),1);assert.equal(run('player.kit.ultPoints'),1,'The delayed credited kill must retain the existing point rule');

    for(const [flashType,flight,base]of [['nope-flash',NOPE_SKILLS.flashFlight,NOPE_SKILLS.flashDuration],['echo-glint',IAGNU_SKILLS.glintFlight,IAGNU_SKILLS.glintDuration]]){
      run(`emberOrdinarySetup();var shadeCast=activateAbility(player,'q'),shadeEvent=ordinarySkills.events(elapsed)[0];var shadeSource=bots.find(bot=>bot.id==='red-0');Object.assign(shadeSource,{x:0,z:12});ordinarySkills.cast('${flashType}',ordinaryActorView(shadeSource),{x:0,y:1.6,z:15},elapsed,match.round);elapsed+=${flight};updateOrdinarySkills();`);
      assert.equal(run('shadeCast.type'),'ember-shade');assert.equal(run('player.vy'),0,'The new glasses must not inherit Q updraft');assertNear(run('ordinarySkills.blindUntil(player.id,elapsed)-elapsed'),base*EMBER_SKILLS.shadeFlashScale,'Shade must multiply a new valid flash duration exactly once');
      assert.equal(run('ordinarySkills.snapshot().blinds.find(blind=>blind.targetId===player.id).resisted'),true);
      run('var shadeBlindEnd=ordinarySkills.blindUntil(player.id,elapsed);updateOrdinarySkills()');assertNear(run('ordinarySkills.blindUntil(player.id,elapsed)'),run('shadeBlindEnd'),'Repeated frames must not compound protection');
      const state=JSON.parse(run('JSON.stringify(ordinarySkills.snapshot())'));const replica=imported.createCharacterSkills();assert.equal(replica.restore(state,run('elapsed'),run('match.round')),true,'The reduced duration must survive the strict JSON format');
      const corrupt=JSON.parse(JSON.stringify(state));corrupt.blinds.find(blind=>blind.targetId===run('player.id')).endsAt+=.1;assert.equal(replica.restore(corrupt,run('elapsed'),run('match.round')),false,'A resisted flag must not accept an arbitrary client duration');
    }
    run('emberOrdinarySetup();shadeSource=bots.find(bot=>bot.id==="red-0");Object.assign(shadeSource,{x:0,z:12});ordinarySkills.cast("nope-flash",ordinaryActorView(shadeSource),{x:0,y:1.6,z:15},elapsed,match.round);elapsed=10.45;updateOrdinarySkills();var alreadyBlind=ordinarySkills.blindUntil(player.id,elapsed);activateAbility(player,"q");updateOrdinarySkills()');assertNear(run('ordinarySkills.blindUntil(player.id,elapsed)'),run('alreadyBlind'),'Putting glasses on after a flash must not clear or shorten it');

    for(const id of ['classic','ghost','spectre','vandal','phantom']){
      run(`emberOrdinarySetup();inventory[WEAPONS['${id}'].slot]='${id}';equip('${id}',true);player.ammo=2;player.reserve=3;var serviceEffect=activateAbility(player,'e');`);
      assert.equal(run('serviceEffect.type'),'ember-service');assert.equal(run('player.serviceReload.weaponId'),id);assertNear(run('reloading'),EMBER_SKILLS.serviceDuration);assertNear(run('player.kit.nextSignatureAt'),10+EMBER_SKILLS.signatureCooldown);
      run('emberAdvance(EMBER_SKILLS.serviceDuration-.001)');assert.equal(run('player.ammo'),2,'Service may not fill early');assert.equal(run('player.reserve'),3);
      run('emberAdvance(.002)');assert.equal(run('player.ammo'),5,'Only the available reserve may enter the captured magazine');assert.equal(run('player.reserve'),0);assert.equal(run('player.serviceReload'),null);
      run('emberAdvance(.2)');assert.equal(run('player.ammo+player.reserve'),5,'Completion must conserve total ammunition and occur once');
    }
    for(const hz of [20,144]){run(`emberOrdinarySetup();activateAbility(player,'e');emberAdvance(EMBER_SKILLS.serviceDuration-.001,${hz})`);assert.equal(run('player.ammo'),4);run(`emberAdvance(.002,${hz})`);assert.equal(run('player.ammo'),9);assert.equal(run('player.reserve'),0);}
    for(const setup of ['player.ammo=weapon().mag','player.reserve=0','equip("knife")','equip("spike")','reload()','interactionHeld=true']){
      run(`emberOrdinarySetup();${setup};var rejectedServiceKit=JSON.stringify(player.kit.snapshot());var rejectedService=activateAbility(player,'e')`);
      assert.equal(run('rejectedService'),undefined,`An ineligible service must reject without spending: ${setup}`);assert.equal(run('JSON.stringify(player.kit.snapshot())'),run('rejectedServiceKit'));assert.equal(run('ordinarySkills.events(elapsed).length'),0);
    }
    run('emberOrdinarySetup();activateAbility(player,"e");var serviceStock=JSON.stringify(player.kit.snapshot()),serviceShots=shots;shoot();reload();activateAbility(player,"c",{zonePoint:{x:0,y:0,z:12}})');
    assert.equal(run('shots'),run('serviceShots'));assert.equal(run('JSON.stringify(player.kit.snapshot())'),run('serviceStock'),'Maintenance must suppress a throw/repeated reload without consuming C');assertNear(run('reloading'),EMBER_SKILLS.serviceDuration);
    for(const cancel of ['equip("classic")','damageEntity(player,200,bots.find(bot=>bot.team!==player.team))','player.x=0;player.z=-18;interactionHeld=true;updateInteraction(.01,true)','match.endRound("blue","elimination");handleMatchEvents()']){
      run(`emberOrdinarySetup();activateAbility(player,'e');emberAdvance(.2);${cancel};var cancelledAmmo=player.ammo,cancelledReserve=player.reserve;emberAdvance(1.5)`);
      assert.equal(run('player.ammo'),run('cancelledAmmo'),'A cancelled service must not load the new or old slot later');assert.equal(run('player.reserve'),run('cancelledReserve'));assert.equal(run('player.serviceReload'),null);assertNear(run('player.kit.nextSignatureAt'),10+EMBER_SKILLS.signatureCooldown,'Interrupting a successful service must not refund its cooldown');
    }
    run('emberOrdinarySetup();activateAbility(player,"e");var servicePickup=addDrop({id:++dropSequence,weapon:"phantom",x:player.x,z:player.z,yaw:0,ammo:2,reserve:3});pickupDroppedWeapon(player,servicePickup.id);emberAdvance(1.5)');assert.equal(run('player.serviceReload'),null);assert.equal(run('player.ammo'),2);assert.equal(run('player.reserve'),3,'Picking up a different gun must cancel maintenance without filling either slot');
    run('emberOrdinarySetup();activateAbility(player,"e")');keyDown('KeyG');keyUp('KeyG');run('emberAdvance(1.5)');assert.equal(run('player.serviceReload'),null);assert.equal(run('droppedWeapons[0].ammo'),4);assert.equal(run('droppedWeapons[0].reserve'),5,'A dropped serviced rifle must retain its original magazine and reserve');
    for(const key of ['c','q','e']){run(`emberOrdinarySetup();for(let i=0;i<20;i++)ordinarySkills.cast('echo-tag',player,{x:0,y:.12,z:13},elapsed,match.round);var emberCapKit=JSON.stringify(player.kit.snapshot());activateAbility(player,'${key}',{zonePoint:{x:0,y:0,z:12}})`);assert.equal(run('JSON.stringify(player.kit.snapshot())'),run('emberCapKit'));assert.equal(run('ordinarySkills.events(elapsed).length'),20);assert.equal(run('player.serviceReload'),null,'A rejected bounded event must not start a hidden service');}
    run('emberOrdinarySetup();equip("ghost",true);player.ammo=2;player.reserve=3;reload()');assertNear(run('reloading'),run('WEAPONS.ghost.reload'),'Ordinary R must retain its original weapon timing');run('equip("vandal",true)');assert.equal(run('reloading'),0);
    run('var emberAutoPurchase={kit:new DuelistKit({character:"ember"}),primary:"vandal",secondary:"ghost",armor:50,credits:1000,team:"red"};autoBuyBot(emberAutoPurchase)');assert.equal(run('emberAutoPurchase.kit.smoke'),2);assert.equal(run('emberAutoPurchase.kit.updraft'),1);assert.equal(run('emberAutoPurchase.credits'),1000-2*imported.getCharacterSkill('ember','c').price-imported.getCharacterSkill('ember','q').price,'Real autoBuyBot must purchase EMBER solder and glasses without changing its pre-equipped gun or armor');
    console.log('PASS: EMBER actual one-hit solder/cover/falloff/death credit, exact new-flash-only shade, five-gun reserve-conserving maintenance service/cancellation/ground-independent timing and atomic rejections');

    cycleRun('if(online)leaveOnline()');run(movementSetup(true));cycleRun(movementSetup(false));
    run(`elapsed=10;var remoteEmber=bots.find(bot=>bot.id==='red-0');remoteEmber.kit=new DuelistKit({character:'ember'});remoteEmber.kit.smoke=2;remoteEmber.kit.updraft=1;remoteEmber.record.primary='vandal';Object.assign(remoteEmber,{x:0,z:20,y:0,vy:0,hp:100,netWeapon:'vandal',netAmmo:4,netReserve:5,netReload:0});bots.forEach(bot=>{bot.rangeTarget=true;if(bot!==remoteEmber){bot.x=35;bot.z=35;}});Object.assign(player,{x:-30,z:30,y:0,hp:100});`);
    const relayEmber=()=>{cycleRun('tickOnline(.1)');sandbox.emberInput=JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));run('receiveNetPacket("friend",emberInput);updateRemoteActor(remoteEmber,.05)');return sandbox.emberInput;};
    positionSnapshot();cycleRun('useAbility("e")');assert.equal(cycleRun('player.kit.dash'),0);assert.equal(cycleRun('ordinarySkills.events(elapsed).length'),0,'A guest may not create an authoritative maintenance event');
    cycleRun('for(let i=0;i<40;i++)updatePlay(.05)');assert.equal(cycleRun('player.ammo'),4,'A guest waiting longer than1.4s for approval must not mint ammunition');assert.equal(cycleRun('player.reserve'),5);
    const serviceInput=relayEmber();assert.equal(run('remoteEmber.serviceReload.weaponId'),'vandal');assertNear(run('remoteEmber.netReload'),EMBER_SKILLS.serviceDuration);const approvedServicePacket=positionSnapshot();assertNear(cycleRun('reloading'),EMBER_SKILLS.serviceDuration);assert.equal(cycleRun('player.serviceReload.weaponId'),'vandal','A rendering clock ahead of the host must not turn a service marker into an ordinary reload');
    for(const corrupt of [marker=>marker.weaponId='classic',marker=>marker.eventId='not-a-service',marker=>marker.endsAt+=1,marker=>marker.extra=true]){
      const malformed=JSON.parse(JSON.stringify(approvedServicePacket));corrupt(malformed.actors.find(actor=>actor.id===cycleRun('player.id')).serviceReload);cycleContext.emberMalformed=malformed;cycleRun('applyNetSnapshot(emberMalformed)');assert.equal(cycleRun('player.serviceReload'),null);assert.equal(cycleRun('reloading'),0,'An invalid service marker must fail closed instead of becoming a normal reload');cycleContext.emberApproved=JSON.parse(JSON.stringify(approvedServicePacket));cycleRun('applyNetSnapshot(emberApproved)');
    }
    cycleRun('for(let i=0;i<30;i++)updatePlay(.05)');assert.equal(cycleRun('player.ammo'),4,'Even an approved service waits for authoritative ammunition when local progress reaches zero');assert.equal(cycleRun('player.reserve'),5);positionSnapshot();assert.equal(cycleRun('player.serviceReload.weaponId'),'vandal','A repeated host service state must retain its kind after local visual expiry');
    sandbox.emberDuplicate={...serviceInput,seq:serviceInput.seq+1};run('elapsed+=.05;receiveNetPacket("friend",emberDuplicate);updateRemoteActor(remoteEmber,.05)');cycleRun(`netSequence=${serviceInput.seq+1}`);assert.equal(run('ordinarySkills.events(elapsed).filter(event=>event.type==="ember-service").length'),1);assertNear(run('remoteEmber.kit.nextSignatureAt'),10+EMBER_SKILLS.signatureCooldown);
    run('for(let i=0;i<10;i++){elapsed+=.05;updateRemoteActor(remoteEmber,.05)}');cycleRun('netHasSnapshot=false');positionSnapshot();assert.ok(cycleRun('reloading')>0&&cycleRun('reloading')<1,'A fresh guest must restore current progress, not restart1.4s');assert.equal(cycleRun('player.ammo'),4);
    run('for(let i=0;i<20;i++){elapsed+=.05;updateRemoteActor(remoteEmber,.05);updateOrdinarySkills()}');positionSnapshot();assert.equal(run('remoteEmber.netAmmo'),9);assert.equal(run('remoteEmber.netReserve'),0);assert.equal(cycleRun('player.ammo'),9);assert.equal(cycleRun('player.reserve'),0);assert.equal(cycleRun('player.serviceReload'),null);
    run('elapsed=20;resetOrdinarySkills();cancelServiceReload(remoteEmber);remoteEmber.kit.dash=1;remoteEmber.kit.nextSignatureAt=0;remoteEmber.netAmmo=4;remoteEmber.netReserve=5;netInputs.clear()');positionSnapshot();cycleRun('useAbility("e");equip("classic")');relayEmber();assert.equal(run('remoteEmber.netWeapon'),'classic');assert.equal(run('remoteEmber.serviceReload'),null);assertNear(run('remoteEmber.kit.nextSignatureAt'),20+EMBER_SKILLS.signatureCooldown);run('elapsed+=2;updateRemoteActor(remoteEmber,.05)');assert.equal(run('remoteEmber.netStores.vandal.ammo'),4,'E followed by an equip in one JSON action batch cannot finish into its stored old magazine');
    run('elapsed=25;resetOrdinarySkills();remoteEmber.kit.dash=1;remoteEmber.kit.nextSignatureAt=0;Object.assign(remoteEmber,{netWeapon:"vandal",netAmmo:4,netReserve:5,netReload:0});netInputs.clear()');positionSnapshot();cycleRun('useAbility("e")');relayEmber();positionSnapshot();cycleRun('equip("classic")');positionSnapshot();assert.equal(cycleRun('player.serviceReload'),null,'An old active host service cannot revive a locally cancelled event');assert.equal(cycleRun('reloading'),0);relayEmber();run('remoteEmber.netAmmo=2;remoteEmber.netReserve=3;applyRemoteAction(remoteEmber,{type:"reload"})');positionSnapshot();assert.equal(cycleRun('player.serviceReload'),null);assertNear(cycleRun('reloading'),run('WEAPONS.classic.reload'),'A tombstone for one service event must not erase a later normal R on another weapon');run('for(let i=0;i<40;i++){elapsed+=.05;updateRemoteActor(remoteEmber,.05)}');positionSnapshot();assert.equal(cycleRun('player.ammo'),5);assert.equal(cycleRun('player.reserve'),0);
    run('elapsed=30;remoteEmber.kit.dash=1;remoteEmber.kit.nextSignatureAt=0;remoteEmber.netWeapon="vandal";remoteEmber.netAmmo=4;remoteEmber.netReserve=5');positionSnapshot();cycleRun('useAbility("e")');run('remoteEmber.netAmmo=25');relayEmber();positionSnapshot();assert.equal(cycleRun('player.kit.dash'),1,'Host rejection after a stale guest press must restore the charge');assert.equal(cycleRun('player.kit.nextSignatureAt'),0);assert.equal(cycleRun('player.serviceReload'),null);
    run('elapsed=40;remoteEmber.kit.smoke=2;remoteEmber.kit.updraft=1;remoteEmber.netAmmo=4;remoteEmber.netReserve=5');positionSnapshot();cycleRun('player.yaw=0;player.pitch=-.2;useAbility("c");player.yaw=1');relayEmber();assert.equal(run('ordinarySkills.events(elapsed).at(-1).type'),'ember-solder');assertNear(run('ordinarySkills.events(elapsed).at(-1).x-ordinarySkills.events(elapsed).at(-1).fromX'),0,'Solder must retain its captured cast aim');assert.equal(cycleRun('ordinarySkills.events(elapsed).length'),0);positionSnapshot();assert.equal(cycleRun('ordinarySkills.events(elapsed).at(-1).type'),'ember-solder');
    run('match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()');positionSnapshot();for(const evaluate of [run,cycleRun]){assert.equal(evaluate('ordinarySkills.events(elapsed).length'),0);assert.equal(evaluate('player.serviceReload??null'),null);}
    cycleRun('leaveOnline()');run('leaveOnline()');for(const select of [document.getElementById('agent-select'),cycleDocument.getElementById('agent-select')]){select.value='duelist';dispatchElement(select,'change',{target:select});}run('startGame()');
    console.log('PASS: independent EMBER stock-only service prediction/no guest reload authority, host maintenance reserve transfer/ACK/rejoin/captured aim, ordered switch cancellation/stale rejection and round/menu cleanup');
  }

  // FROST controls only a supported annulus and mitigates an existing slow.
  // Exercise real floor/LOS adapters and gameplay movement before serializing it.
  {
    run(`function frostOrdinarySetup(){
      if(online)leaveOnline();onlinePlaying=false;mode='menu';$('agent-select').value='frost';$('match-format').value='standard';$('starting-side').value='attack';startGame();startRound();
      clearCombatInput();elapsed=10;resetOrdinarySkills();resetZoneAbilities();Object.assign(player,{x:0,z:20,y:0,yaw:0,pitch:0,vy:0,vx:0,vz:0,hp:100,armor:0,crouch:0,dashTimer:0,skillThrowUntil:0});
      player.kit.smoke=2;player.kit.updraft=1;player.kit.dash=1;player.kit.nextSignatureAt=0;inventory.primary='vandal';equip('vandal',true);
      bots.forEach((bot,index)=>Object.assign(bot,{x:35,z:30+index,y:0,vy:0,hp:100,armor:0,alive:true,rangeTarget:true,fire:999,target:null,skillThrowUntil:0}));
    }function frostAdvance(seconds){let left=seconds;while(left>1e-9){const dt=Math.min(left,.05);updatePlay(dt);left-=dt;}}
    frostOrdinarySetup();var stitchCast=activateAbility(player,'c',{zonePoint:{x:0,y:0,z:12}}),stitchEvent=ordinarySkills.events(elapsed)[0];
    var stitchEnemy=bots.find(bot=>bot.id==='red-0'),stitchAlly=bots.find(bot=>bot.id==='blue-1');Object.assign(stitchEnemy,{x:2,z:12});Object.assign(stitchAlly,{x:2,z:12});`);
    assert.equal(run('stitchCast.type'),'frost-stitch');assertNear(run('stitchEvent.y'),.12);assertNear(run('stitchEvent.flight'),.55);assertNear(run('stitchEvent.triggerAt'),10.8);assertNear(run('stitchEvent.endsAt'),10+FROST_SKILLS.stitchFlight+FROST_SKILLS.stitchArmDelay+FROST_SKILLS.stitchDuration);assertNear(run('stitchEvent.radius'),FROST_SKILLS.stitchRadius);assert.equal(run('player.kit.smoke'),1);
    run('elapsed=10.799;updateOrdinarySkills()');assert.equal(run('actorSpeedScale(stitchEnemy)'),1,'Stitch must retain its flight and arming warning');
    run('elapsed=10.8;updateOrdinarySkills()');assertNear(run('actorSpeedScale(stitchEnemy)'),FROST_SKILLS.stitchSpeedScale);assert.equal(run('actorSpeedScale(stitchAlly)'),1);assert.equal(run('stitchEnemy.hp'),100,'The ring has no hidden damage');
    for(const [x,expected]of [[0,1],[FROST_SKILLS.stitchInnerRadius-.001,1],[FROST_SKILLS.stitchInnerRadius,FROST_SKILLS.stitchSpeedScale],[FROST_SKILLS.stitchRadius,FROST_SKILLS.stitchSpeedScale],[FROST_SKILLS.stitchRadius+.001,1]]){run(`stitchEnemy.x=${x}`);assertNear(run('actorSpeedScale(stitchEnemy)'),expected,`The actual annulus boundary at radius${x} must preserve its safe centre and exterior`);}
    run('stitchEnemy.x=3;map.colliders.push({minX:2.6,maxX:2.7,minZ:11,maxZ:13,height:3})');assert.equal(run('actorSpeedScale(stitchEnemy)'),1,'A wall between the projected ring floor and victim must block stitch');run('map.colliders.pop()');
    run('stitchEnemy.x=2;map.colliders.push({minX:1.5,maxX:2.5,minZ:11.5,maxZ:12.5,height:3.2,base:2.8});stitchEnemy.y=3.2');assert.equal(run('actorGrounded(stitchEnemy)'),true);assert.equal(run('actorSpeedScale(stitchEnemy)'),1,'A supported upper floor must not share a ground ring');run('map.colliders.pop();stitchEnemy.y=.5;stitchEnemy.vy=0');assert.equal(run('actorSpeedScale(stitchEnemy)'),1,'An unsupported jump apex is not a valid ground victim');run('stitchEnemy.y=0');
    run('var stitchFloorOriginal=ordinaryGroundHeight;ordinaryGroundHeight=()=>null');assert.equal(run('actorSpeedScale(stitchEnemy)'),1,'Missing support information must fail closed');run('ordinaryGroundHeight=stitchFloorOriginal');
    run('player.alive=false;updateOrdinarySkills()');assertNear(run('actorSpeedScale(stitchEnemy)'),FROST_SKILLS.stitchSpeedScale,'A placed ring persists after its caster dies');run('elapsed=10+FROST_SKILLS.stitchFlight+FROST_SKILLS.stitchArmDelay+FROST_SKILLS.stitchDuration;updateOrdinarySkills()');assert.equal(run('actorSpeedScale(stitchEnemy)'),1,'The ring ends exactly four seconds after arming');

    run('frostOrdinarySetup();var mistCast=activateAbility(player,"q",{zonePoint:{x:0,y:0,z:12}}),mistEvent=ordinarySkills.events(elapsed)[0];var mistShooter=bots.find(bot=>bot.id==="red-0");Object.assign(mistShooter,{x:-4,z:12,target:player});player.x=4;player.z=12');
    assert.equal(run('mistCast.type'),'frost-mist');assertNear(run('mistEvent.y'),1.4);assertNear(run('mistEvent.radius'),FROST_SKILLS.mistRadius);assertNear(run('mistEvent.triggerAt'),10.5);assertNear(run('mistEvent.endsAt'),10+FROST_SKILLS.mistFlight+FROST_SKILLS.mistDuration);assert.equal(run('player.vy'),0,'Doll mist replaces Q updraft');
    run('elapsed=10.499;updateOrdinarySkills()');assert.equal(run('visibleBetween({x:-4,y:0,z:12},{x:4,y:0,z:12})'),true);run('elapsed=10.5;updateOrdinarySkills()');assert.equal(run('visibleBetween({x:-4,y:0,z:12},{x:4,y:0,z:12})'),false,'The actual shared smoke query must become opaque at arrival');assert.equal(run('mistShooter.target'),null,'A landed mist must invalidate cached BOT aim');
    for(const team of ['blue','red'])assert.equal(run(`smokeBlocks({x:-4,y:-.05,z:12+FROST_SKILLS.mistRadius-.01,team:'${team}'},{x:4,y:-.05,z:12+FROST_SKILLS.mistRadius-.01,team:'${team}'})`),true,'Both teams must share the2.4m smoke boundary');
    assert.equal(run('smokeBlocks({x:-4,y:-.05,z:12+FROST_SKILLS.mistRadius+.01},{x:4,y:-.05,z:12+FROST_SKILLS.mistRadius+.01})'),false);
    run('player.x=0;player.z=12;updatePlay(.01)');assert.equal(run('scene.fog.far'),2.5,'The owner also sees opaque fog inside doll mist');run('player.x=4;updatePlay(.01)');assert.equal(run('scene.fog.far'),380);run('player.alive=false;elapsed=10+FROST_SKILLS.mistFlight+FROST_SKILLS.mistDuration;updateOrdinarySkills()');assert.equal(run('ordinarySkills.events(elapsed).length'),0);

    run(`function frostSlowSetup(){frostOrdinarySetup();var frostSlowOwner=bots.find(bot=>bot.id==='red-0');Object.assign(frostSlowOwner,{x:0,z:22,y:0});
      ordinarySkills.cast('mend-seeds',ordinaryActorView(frostSlowOwner),{x:0,y:.12,z:20},elapsed,match.round);
      ordinarySkills.cast('veil-roots',ordinaryActorView(frostSlowOwner),{x:0,y:0,z:15},elapsed,match.round);
      zoneAbilities.cast('frost',frostSlowOwner,{x:0,y:0,z:20},elapsed,match.round);elapsed=10.8;updateOrdinarySkills();}
      frostSlowSetup();var unravelCast=activateAbility(player,'e');`);
    assertNear(run('ordinarySkills.speedScale(ordinaryActorView(player),elapsed,{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})'),VEIL_SKILLS.rootsSpeedScale,'Real enemy seeds and roots must contribute a live ordinary slow, not just the ultimate fixture');assertNear(run('zoneAbilities.speedMultiplier(player,elapsed)'),.55);
    assert.equal(run('unravelCast.type'),'frost-unravel');assertNear(run('player.kit.nextSignatureAt'),10.8+FROST_SKILLS.signatureCooldown);assertNear(run('actorSpeedScale(player)'),(1-(1-Math.min(.55,MEND_SKILLS.seedsSpeedScale,VEIL_SKILLS.rootsSpeedScale))*FROST_SKILLS.unravelSlowFraction),'Combined55/65/75% slows must first take their minimum, then receive one mitigation');
    run('updateOrdinarySkills();updateOrdinarySkills()');assertNear(run('actorSpeedScale(player)'),(1-(1-Math.min(.55,MEND_SKILLS.seedsSpeedScale,VEIL_SKILLS.rootsSpeedScale))*FROST_SKILLS.unravelSlowFraction),'Repeated frames must not compound mitigation into88.75%');assert.equal(run('ordinarySkills.movementScale(ordinaryActorView(player),elapsed)'),1,'Ribbon may not turn into an independent speed buff');
    run('elapsed=10.8+FROST_SKILLS.unravelDuration-.001;updateOrdinarySkills()');assertNear(run('actorSpeedScale(player)'),(1-(1-Math.min(.55,MEND_SKILLS.seedsSpeedScale,VEIL_SKILLS.rootsSpeedScale))*FROST_SKILLS.unravelSlowFraction));run('elapsed=10.8+FROST_SKILLS.unravelDuration;updateOrdinarySkills()');assertNear(run('actorSpeedScale(player)'),Math.min(.55,MEND_SKILLS.seedsSpeedScale,VEIL_SKILLS.rootsSpeedScale),'Mitigation must end exactly two seconds after casting even while slow fields remain');run('frostSlowSetup();activateAbility(player,"e")');
    run('player.vz=-(5.4*1.15)*actorSpeedScale(player);keys.add("KeyW");frostAdvance(.4);keys.clear()');assertNear(20-run('player.z'),(5.4*1.15)*.4*(1-(1-Math.min(.55,MEND_SKILLS.seedsSpeedScale,VEIL_SKILLS.rootsSpeedScale))*FROST_SKILLS.unravelSlowFraction),'Steady normal walking must use the single mitigated speed rather than a dash or double mitigation');
    run('player.y=.5;player.vy=0;actorSpeedScale(player);player.y=0;player.vy=0');assertNear(run('actorSpeedScale(player)'),Math.min(.55,MEND_SKILLS.seedsSpeedScale,VEIL_SKILLS.rootsSpeedScale),'Leaving support must end mitigation immediately and permanently');run('updateOrdinarySkills()');assertNear(run('actorSpeedScale(player)'),Math.min(.55,MEND_SKILLS.seedsSpeedScale,VEIL_SKILLS.rootsSpeedScale));
    run('frostOrdinarySetup();activateAbility(player,"e")');assert.equal(run('actorSpeedScale(player)'),1,'An unaffected runner must stay at100%, never130%');assert.equal(run('player.dashTimer'),0);assert.equal(run('player.vy'),0);
    for(const key of ['c','q','e']){run(`frostOrdinarySetup();for(let i=0;i<20;i++)ordinarySkills.cast('echo-tag',ordinaryActorView(player),{x:0,y:.12,z:13},elapsed,match.round);var frostCapKit=JSON.stringify(player.kit.snapshot());activateAbility(player,'${key}',{zonePoint:{x:0,y:0,z:12}})`);assert.equal(run('JSON.stringify(player.kit.snapshot())'),run('frostCapKit'),'The20-field bound must roll back C/Q stock and E cooldown atomically');assert.equal(run('ordinarySkills.events(elapsed).length'),20);}
    run('frostOrdinarySetup();map.colliders.push({minX:-3,maxX:3,minZ:10,maxZ:14,height:3.2,base:2.8});Object.assign(player,{x:0,z:13,y:3.2});var deckStitch=activateAbility(player,"c",{zonePoint:{x:0,y:3.2,z:11}});stitchEnemy=bots.find(bot=>bot.id==="red-0");Object.assign(stitchEnemy,{x:2,z:11,y:3.2});elapsed=10.8;updateOrdinarySkills()');
    assert.equal(run('deckStitch.type'),'frost-stitch');assertNear(run('ordinarySkills.events(elapsed)[0].y'),3.32,'A cast from an actual supported deck must retain that floor instead of snapping to ground');assertNear(run('actorSpeedScale(stitchEnemy)'),FROST_SKILLS.stitchSpeedScale);run('stitchEnemy.y=0');assert.equal(run('actorSpeedScale(stitchEnemy)'),1,'A deck ring must preserve the underpass');run('map.colliders.pop();backMenu();$("agent-select").value="duelist";startGame()');
    console.log('PASS: FROST actual supported ring centre/band/exterior, ground/upperfloor/LOS, shared mist/owner fog, single minimum-slow mitigation, real walking/air termination and atomic20-field rollback');

    // Independent guest prediction and host authority cross actual JSON packets.
    cycleRun('if(online)leaveOnline()');run(movementSetup(true));cycleRun(movementSetup(false));
    run(`elapsed=10;resetOrdinarySkills();resetZoneAbilities();var remoteFrost=bots.find(bot=>bot.id==='red-0');remoteFrost.kit=new DuelistKit({character:'frost'});remoteFrost.kit.smoke=2;remoteFrost.kit.updraft=1;Object.assign(remoteFrost,{x:0,z:20,y:0,vy:0,hp:100,netReload:0});Object.assign(player,{x:0,z:22,y:0,hp:100});bots.forEach(bot=>{bot.rangeTarget=true;if(bot!==remoteFrost){bot.x=35;bot.z=35;}});ordinarySkills.cast('mend-seeds',ordinaryActorView(player),{x:0,y:.12,z:20},elapsed,match.round);zoneAbilities.cast('frost',player,{x:0,y:0,z:20},elapsed,match.round);elapsed=10.8;updateOrdinarySkills();player.x=-30;player.z=30;`);
    positionSnapshot();assertNear(cycleRun('actorSpeedScale(player)'),Math.min(.55,MEND_SKILLS.seedsSpeedScale));cycleRun('useAbility("e")');assert.equal(cycleRun('player.kit.dash'),0);assertNear(cycleRun('actorSpeedScale(player)'),Math.min(.55,MEND_SKILLS.seedsSpeedScale),'Unacknowledged guest stock may not predict slow resistance');
    const relayFrost=()=>{cycleRun('tickOnline(.1)');sandbox.frostInput=JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));run('receiveNetPacket("friend",frostInput);updateRemoteActor(remoteFrost,.05)');return sandbox.frostInput;};
    const frostEInput=relayFrost();assertNear(run('actorSpeedScale(remoteFrost)'),(1-(1-Math.min(.55,MEND_SKILLS.seedsSpeedScale))*FROST_SKILLS.unravelSlowFraction));const frostApproved=positionSnapshot();assertNear(cycleRun('actorSpeedScale(player)'),(1-(1-Math.min(.55,MEND_SKILLS.seedsSpeedScale))*FROST_SKILLS.unravelSlowFraction));assert.equal(cycleRun('netActions.length'),0);
    sandbox.frostRepeated={...frostEInput,seq:frostEInput.seq+1};run('receiveNetPacket("friend",frostRepeated);updateRemoteActor(remoteFrost,.05)');cycleRun(`netSequence=${frostEInput.seq+1}`);assert.equal(run('ordinarySkills.events(elapsed).filter(event=>event.type==="frost-unravel").length'),1);assertNear(run('remoteFrost.kit.nextSignatureAt'),10.8+FROST_SKILLS.signatureCooldown);
    run('netInputs.set("friend",{seq:101,connection:"frost-cap",round:match.round,received:elapsed,input:{x:10,z:20,y:0,yaw:0,pitch:0},actions:[]});updateRemoteActor(remoteFrost,.1)');assertNear(run('remoteFrost.x'),7*1.15*(1-(1-Math.min(.55,MEND_SKILLS.seedsSpeedScale))*FROST_SKILLS.unravelSlowFraction)*.1,'The actual host movement cap must apply one mitigation, not predictive guest speed');run('remoteFrost.x=0;netInputs.clear();elapsed=11');cycleRun('netHasSnapshot=false');positionSnapshot();assertNear(cycleRun('actorSpeedScale(player)'),(1-(1-Math.min(.55,MEND_SKILLS.seedsSpeedScale))*FROST_SKILLS.unravelSlowFraction),'A fresh guest restores the original remaining mitigation without recasting');
    cycleRun('player.y=.5;player.vy=0;actorSpeedScale(player);player.y=0;player.vy=0');assertNear(cycleRun('actorSpeedScale(player)'),Math.min(.55,MEND_SKILLS.seedsSpeedScale));positionSnapshot();assertNear(cycleRun('actorSpeedScale(player)'),Math.min(.55,MEND_SKILLS.seedsSpeedScale),'A stale host event may not revive locally ended ribbon after landing');
    cycleRun('netHasSnapshot=false');positionSnapshot();assertNear(cycleRun('actorSpeedScale(player)'),Math.min(.55,MEND_SKILLS.seedsSpeedScale),'A same-round fresh rejoin must not forget a locally ended ribbon ID');
    run('netInputs.set("friend",{seq:102,connection:"frost-air",round:match.round,received:elapsed,input:{x:10,z:20,y:.5,yaw:0,pitch:0},actions:[]});updateRemoteActor(remoteFrost,.1)');assert.equal(run('ordinarySkills.events(elapsed).some(event=>event.type==="frost-unravel")'),false,'The first authoritative airborne input must permanently end resistance');run('remoteFrost.x=0;remoteFrost.y=0;netInputs.clear();updateOrdinarySkills()');positionSnapshot();assertNear(cycleRun('actorSpeedScale(player)'),Math.min(.55,MEND_SKILLS.seedsSpeedScale));
    run('elapsed=20;resetOrdinarySkills();resetZoneAbilities();remoteFrost.x=0;remoteFrost.z=20;remoteFrost.y=0;remoteFrost.vy=0;remoteFrost.kit.smoke=2;remoteFrost.kit.updraft=1;netInputs.clear()');positionSnapshot();cycleRun('player.yaw=0;player.pitch=-.3;var pressedStitch=getSkillTarget(player,"frost-stitch",null,{yaw:0,pitch:-.3});useAbility("c");player.yaw=1');assert.equal(cycleRun('ordinarySkills.events(elapsed).length'),0);relayFrost();assertNear(run('ordinarySkills.events(elapsed)[0].x'),cycleRun('pressedStitch.x'));assertNear(run('ordinarySkills.events(elapsed)[0].z'),cycleRun('pressedStitch.z'),'JSON C must preserve press-time aim after the guest turns');
    run('elapsed=20.8;updateOrdinarySkills()');const frostRingPacket=positionSnapshot();assert.equal(frostRingPacket.ordinarySkills.events[0].type,'frost-stitch');const ringReplica=imported.createCharacterSkills();assert.equal(ringReplica.restore(frostRingPacket.ordinarySkills,frostRingPacket.time,frostRingPacket.rules.round),true);const invalidRing=JSON.parse(JSON.stringify(frostRingPacket.ordinarySkills));invalidRing.events[0].innerRadius=0;assert.equal(ringReplica.restore(invalidRing,frostRingPacket.time,frostRingPacket.rules.round),false,'JSON may not override the canonical safe-centre radius');
    run('elapsed=22');positionSnapshot();cycleRun('player.yaw=0;player.pitch=-.3;useAbility("q")');relayFrost();run('elapsed=22.5;updateOrdinarySkills()');positionSnapshot();assert.equal(cycleRun('activeOrdinarySmokeFields().filter(event=>event.type==="frost-mist").length'),1,'An approved Q must join the same guest smoke query');const mistPosition=JSON.parse(run('JSON.stringify(ordinarySkills.events(elapsed).find(event=>event.type==="frost-mist"))'));cycleRun(`player.x=${mistPosition.x};player.z=${mistPosition.z};player.y=0;player.vy=0;updatePlay(.01)`);assert.equal(cycleRun('scene.fog.far'),2.5);
    run('match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()');positionSnapshot();for(const evaluate of [run,cycleRun]){assert.equal(evaluate('ordinarySkills.events(elapsed).length'),0);assert.equal(evaluate('stoppedFrostEvents.size'),0,'New rounds must clear old ribbon tombstones');}cycleRun('leaveOnline()');run('leaveOnline();$("agent-select").value="duelist";startGame()');assert.equal(run('frostSkillFX.group.visible'),false);
    console.log('PASS: independent FROST JSON stock-only prediction, single mitigation/host cap, duplicate ACK, fresh/air/stale-event termination, captured C aim/strict shape, shared Q fog and next-round/menu cleanup');
  }

  // The mascot's airborne comet and lift use the bounded authoritative event
  // stream; the existing two-stage dash and knife ultimate remain distinct.
  {
    run(`function duelistOrdinarySetup(){
      if(online)leaveOnline();onlinePlaying=false;mode='menu';$('agent-select').value='duelist';$('match-format').value='standard';$('starting-side').value='attack';startGame();startRound();
      clearCombatInput();elapsed=10;resetOrdinarySkills();resetZoneAbilities();syncSmokes([]);Object.assign(player,{x:0,z:20,y:0,yaw:0,pitch:0,vy:0,vx:0,vz:0,hp:100,armor:0,crouch:0,dashTimer:0,skillThrowUntil:0});
      player.kit.smoke=2;player.kit.updraft=1;player.kit.dash=1;player.kit.nextSignatureAt=0;inventory.primary='vandal';equip('vandal',true);
      bots.forEach((bot,index)=>Object.assign(bot,{x:35,z:30+index,y:0,vy:0,hp:100,alive:true,rangeTarget:true,fire:999,target:null,skillThrowUntil:0}));
    }
    duelistOrdinarySetup();Object.assign(player,{y:3,crouch:1,pitch:.4});var cometCast=activateAbility(player,'c'),cometEvent=ordinarySkills.events(elapsed)[0];`);
    assert.equal(run('cometCast.type'),'duelist-comet');assert.equal(run('player.kit.smoke'),1);assert.equal(run('smokes.length'),0,'The new C must not create a second legacy smoke');
    assertNear(run('cometEvent.fromY'),4.15,'The actual crouched airborne eye is the linear projectile origin');
    assertNear(run('Math.hypot(cometEvent.x-cometEvent.fromX,cometEvent.y-cometEvent.fromY,cometEvent.z-cometEvent.fromZ)'),DUELIST_SKILLS.cometRange,'The range bound is full3D, not horizontal distance plus an unbounded rise');
    assertNear(run('cometEvent.z'),20-DUELIST_SKILLS.cometRange*Math.cos(.4));assertNear(run('cometEvent.y'),4.15+DUELIST_SKILLS.cometRange*Math.sin(.4));assertNear(run('cometEvent.flight'),DUELIST_SKILLS.cometFlight);assertNear(run('cometEvent.triggerAt'),10+DUELIST_SKILLS.cometFlight);assertNear(run('cometEvent.endsAt'),10+DUELIST_SKILLS.cometFlight+DUELIST_SKILLS.cometDuration);assertNear(run('cometEvent.radius'),DUELIST_SKILLS.cometRadius);
    const airborneComet=JSON.parse(run('JSON.stringify(cometEvent)'));
    const midpoint=imported.skillProjectilePosition(airborneComet,10+DUELIST_SKILLS.cometFlight/2);
    for(const axis of ['x','y','z'])assertNear(midpoint[axis],(airborneComet['from'+axis.toUpperCase()]+airborneComet[axis])/2,'The shared projectile must travel linearly without the ground grenade arc');
    run('elapsed=10+DUELIST_SKILLS.cometFlight-.001;updateOrdinarySkills()');assert.equal(run('activeOrdinarySmokeFields().length'),0,'The warning projectile is transparent until arrival');
    run('elapsed=10+DUELIST_SKILLS.cometFlight;updateOrdinarySkills();var cometWatcher=bots.find(bot=>bot.id==="red-0");Object.assign(cometWatcher,{x:cometEvent.x-4,y:cometEvent.y-1.45,z:cometEvent.z,target:player});player.x=cometEvent.x+4;player.z=cometEvent.z;player.y=cometEvent.y-1.45;updateOrdinarySkills()');
    assert.equal(run('activeOrdinarySmokeFields().length'),1);
    for(const team of ['blue','red'])assert.equal(run(`visibleBetween({x:cometEvent.x-4,y:cometEvent.y-1.45,z:cometEvent.z,team:'${team}'},{x:cometEvent.x+4,y:cometEvent.y-1.45,z:cometEvent.z,team:'${team}'})`),false,'The same opaque airborne sphere must obscure either team');
    assert.equal(run('cometWatcher.target'),null,'Arrival must invalidate previously cached BOT aim');
    for(const [offset,blocked]of [[DUELIST_SKILLS.cometRadius-.001,true],[DUELIST_SKILLS.cometRadius+.001,false]])assert.equal(run(`smokeBlocks({x:cometEvent.x-4,y:cometEvent.y-1.45,z:cometEvent.z+${offset}},{x:cometEvent.x+4,y:cometEvent.y-1.45,z:cometEvent.z+${offset}})`),blocked);
    run('Object.assign(player,{x:cometEvent.x,y:cometEvent.y-1.7,z:cometEvent.z,vy:0,crouch:0});updatePlay(.01)');assert.equal(run('scene.fog.far'),2.5,'The caster camera is also opaque inside its comet');run('player.x=cometEvent.x+DUELIST_SKILLS.cometRadius+.2;updatePlay(.01)');assert.equal(run('scene.fog.far'),380);
    run('player.alive=false;updateOrdinarySkills()');assert.equal(run('ordinarySkills.events(elapsed).length'),1,'Fixed smoke must survive caster death');run('elapsed=cometEvent.endsAt;updateOrdinarySkills()');assert.equal(run('ordinarySkills.events(elapsed).length'),0,'The smoke endsconfigured duration after arrival');

    run('duelistOrdinarySetup();map.colliders.push({minX:-2,maxX:2,minZ:12,maxZ:13,height:5});var wallComet=activateAbility(player,"c"),wallEndpoint=ordinarySkills.events(elapsed)[0]');
    assert.equal(run('wallComet.type'),'duelist-comet');assert.ok(run('wallEndpoint.z')>=13.199999,'The host must retain the0.2m margin before a newly blocking wall');assert.equal(run('map.collision.rayClear(wallEndpoint.fromX,wallEndpoint.fromY,wallEndpoint.fromZ,wallEndpoint.x,wallEndpoint.y,wallEndpoint.z)'),true);run('map.colliders.pop()');
    run('duelistOrdinarySetup();map.colliders.push({minX:-3,maxX:3,minZ:-10,maxZ:30,base:3,height:3.2});player.pitch=.6;activateAbility(player,"c");var ceilingComet=ordinarySkills.events(elapsed)[0]');
    assert.ok(run('ceilingComet.y')<2.95,'A ceiling must clip the full upward ray rather than allowing an endpoint beyond its slab');assert.equal(run('map.collision.rayClear(ceilingComet.fromX,ceilingComet.fromY,ceilingComet.fromZ,ceilingComet.x,ceilingComet.y,ceilingComet.z)'),true);run('map.colliders.pop()');
    for(const [feet,pitch]of [[0,-.3],[3,-.6]]){
      run(`duelistOrdinarySetup();player.y=${feet};player.pitch=${pitch};activateAbility(player,'c');var downComet=ordinarySkills.events(elapsed)[0]`);
      assert.ok(run('downComet.y')>=0,'A downward comet must stop before the actual ground plane, which has no wall collider');
      assert.ok(run('downComet.y')<run('downComet.fromY'),'This case must really exercise a downward ray');
      assert.ok(run('Math.hypot(downComet.x-downComet.fromX,downComet.y-downComet.fromY,downComet.z-downComet.fromZ)')<=DUELIST_SKILLS.cometRange+1e-8);
    }

    run('duelistOrdinarySetup();player.y=1;player.vy=-2;var liftCast=activateAbility(player,"q"),liftEvent=ordinarySkills.events(elapsed)[0]');assert.equal(run('liftCast.type'),'duelist-lift');assert.equal(run('player.kit.updraft'),0);assertNear(run('player.vy'),7.8);assertNear(run('liftEvent.y'),1);assertNear(run('liftEvent.endsAt-liftEvent.startedAt'),.45);assert.equal(run('liftEvent.radius'),0);
    run('player.vy=-2;elapsed=10.1;updateOrdinarySkills();updateOrdinarySkills()');assertNear(run('player.vy'),-2,'Rendering/updating an accepted lift must never assign its impulse again');
    for(const key of ['c','q']){run(`duelistOrdinarySetup();player.vy=-1.25;for(let i=0;i<20;i++)ordinarySkills.cast('echo-tag',ordinaryActorView(player),{x:0,y:.12,z:13},elapsed,match.round);var duelistCapKit=JSON.stringify(player.kit.snapshot());activateAbility(player,'${key}')`);assert.equal(run('JSON.stringify(player.kit.snapshot())'),run('duelistCapKit'),'A full20-event store must restore the exact charge state');assertNear(run('player.vy'),-1.25,'Rejected Q cannot apply an impulse before the event is accepted');assert.equal(run('ordinarySkills.events(elapsed).length'),20);}
    run('duelistOrdinarySetup();activateAbility(player,"e");elapsed=10+DUELIST.dashArmDelay-.001;var earlyMascotDash=activateAbility(player,"e")');assert.equal(run('earlyMascotDash'),undefined);assert.equal(run('player.dashTimer'),0);run('elapsed=10+DUELIST.dashArmDelay;var readyMascotDash=activateAbility(player,"e");updatePlay(.18)');assert.equal(run('readyMascotDash.type'),'dash');assertNear(run('20-player.z'),12);assert.equal(run('player.kit.dash'),0);run('player.kit.awardKill();player.kit.awardKill()');assert.equal(run('player.kit.dash'),1);
    run('duelistOrdinarySetup();activateAbility(player,"e");elapsed=10+DUELIST.dashWindow;var expiredMascotDash=activateAbility(player,"e")');assert.equal(run('expiredMascotDash'),undefined,'The dash window still expires exactly atconfigured window');
    run('duelistOrdinarySetup();player.kit.ultPoints=7;activateAbility(player,"x")');assert.equal(run('player.kit.knivesActive'),true);assert.equal(run('player.kit.knives'),5);assert.equal(run('inventory.active'),'knife');run('backMenu()');
    for(const hz of [20,60,144]){
      run(`duelistOrdinarySetup();clearBots();Object.assign(player,{x:0,z:20,y:0});makeBot({x:0,z:10},0,'red',{id:'mascot-real-lift',team:'red',name:'LIFTER',secondary:'classic'});var mascotLifter=bots[0],mascotSpawnGrounded=actorGrounded(mascotLifter);Object.assign(mascotLifter,{hp:50,rangeTarget:false,target:player,think:1,reactionUntil:999,fire:999});mascotLifter.group.rotation.y=0;mascotLifter.kit=new DuelistKit({character:'duelist'});mascotLifter.kit.smoke=0;mascotLifter.kit.updraft=1;var mascotLiftApex=0,mascotLiftPoseError=0;for(let frame=0;frame<Math.ceil(1.5*${hz});frame++){updatePlay(1/${hz});mascotLiftApex=Math.max(mascotLiftApex,mascotLifter.y);mascotLiftPoseError=Math.max(mascotLiftPoseError,Math.abs(mascotLifter.group.position.y-mascotLifter.y));}`);
      assert.equal(run('mascotSpawnGrounded'),true,'The real makeBot constructor must supply finite grounded y/vy without a test repairing them');assertNear(run('mascotLiftPoseError'),0,'The rendered NPC group must follow its physical lift on every frame');
      assert.equal(run('mascotLifter.kit.updraft'),0,'The actual NPC policy must consume one accepted lift');assert.ok(run('mascotLiftApex')>1.9&&run('mascotLiftApex')<2.04,`A real BOT must visibly rise and obey the existing gravity at${hz}Hz`);
      assertNear(run('mascotLifter.y'),0,'An actual lifted BOT must land, not remain at y0 with a permanently positive vy');assertNear(run('mascotLifter.vy'),0);assertNear(run('mascotLifter.group.position.y'),0);assert.equal(run('actorGrounded(mascotLifter)'),true,'Landing must restore later grounded interactions');
    }
    run(`duelistOrdinarySetup();clearBots();makeBot({x:0,z:10},0,'red',{id:'mascot-roof-lift',team:'red',name:'ROOF LIFTER',secondary:'classic'});var roofLifter=bots[0];Object.assign(roofLifter,{hp:50,target:player,think:1,reactionUntil:999,fire:999});roofLifter.group.rotation.y=0;roofLifter.kit=new DuelistKit({character:'duelist'});roofLifter.kit.smoke=0;roofLifter.kit.updraft=1;map.colliders.push({minX:-3,maxX:3,minZ:7,maxZ:13,base:3.4,height:3.6});var roofLiftApex=0;for(let frame=0;frame<100;frame++){updatePlay(1/60);roofLiftApex=Math.max(roofLiftApex,roofLifter.y);}`);
    assert.equal(run('roofLifter.kit.updraft'),0);assert.ok(run('roofLiftApex')>1&&run('roofLiftApex')<=1.700001,'Accepted BOT lift must share the player head-ceiling crossing clamp, not phase through the slab');assertNear(run('roofLifter.y'),0);assertNear(run('roofLifter.vy'),0);run('map.colliders.pop()');
    const airborneMapFields=Object.fromEntries(['colliders','collision','ramps','bounds'].map(key=>[key,arena[key]]));
    for(const key of Object.keys(airborneMapFields))arena[key]=map[key];
    try{
      run(`clearBots();makeBot({x:-50,z:-27.4,y:1.5},0,'red',{id:'airborne-deck-edge',team:'red',name:'AIRBORNE EDGE',secondary:'classic'});var airborneDeckBot=bots[0];airborneDeckBot.vy=3;var airborneEdgeClear=!map.collision.blocked(airborneDeckBot.x,airborneDeckBot.z,.4,airborneDeckBot.y),airborneSlabBlocked=map.collision.blocked(-50,-28.2,.4,1.5);moveEntity(airborneDeckBot,0,-.8,.4);`);
      assert.equal(run('airborneEdgeClear'),true,'The actual west-deck repro must begin clear of its slab');assert.equal(run('airborneSlabBlocked'),true,'The attempted destination really intersects the slab at the flying NPC body height');
      assert.equal(run('map.collision.blocked(airborneDeckBot.x,airborneDeckBot.z,.4,airborneDeckBot.y)'),false,'An airborne nonremote BOT must use its real feet height during horizontal movement');assert.ok(run('airborneDeckBot.z')>-28.2,'The lifted BOT must stop before entering the west station deck');assertNear(run('airborneDeckBot.y'),1.5,'Horizontal rejection cannot snap an airborne NPC onto the deck');
    }finally{for(const[key,value]of Object.entries(airborneMapFields))arena[key]=value;}
    run('backMenu()');
    console.log('PASS: mascot real airborne/crouched full3D linear comet, wall/ceiling clip, buffed shared LOS/fog duration, accepted-only single lift,20-event rollback and unchanged dash/knives');

    cycleRun('if(online)leaveOnline()');run(movementSetup(true));cycleRun(movementSetup(false));
    run(`elapsed=10;resetOrdinarySkills();var remoteMascot=bots.find(bot=>bot.id==='red-0');remoteMascot.kit=new DuelistKit({character:'duelist'});remoteMascot.kit.smoke=2;remoteMascot.kit.updraft=1;Object.assign(remoteMascot,{x:0,z:20,y:3,vy:0,crouch:1,hp:100,netReload:0});Object.assign(player,{x:-30,z:30,y:0,hp:100});bots.forEach(bot=>{bot.rangeTarget=true;if(bot!==remoteMascot){bot.x=35;bot.z=35;}});`);
    positionSnapshot();cycleRun('player.crouch=1;player.yaw=0;player.pitch=.25;var pressedComet=getSkillTarget(player,"duelist-comet",null,{yaw:0,pitch:.25});useAbility("c");player.yaw=1.2;player.pitch=-.3');assert.equal(cycleRun('ordinarySkills.events(elapsed).length'),0,'An unacknowledged guest C spends stock without creating a host field');assert.equal(cycleRun('player.kit.smoke'),1);
    const relayMascot=()=>{cycleRun('tickOnline(.1)');sandbox.mascotInput=JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));run('receiveNetPacket("friend",mascotInput);updateRemoteActor(remoteMascot,.05)');return sandbox.mascotInput;};
    const mascotCInput=relayMascot();assertNear(run('ordinarySkills.events(elapsed)[0].x'),cycleRun('pressedComet.x'));assertNear(run('ordinarySkills.events(elapsed)[0].y'),cycleRun('pressedComet.y'));assertNear(run('ordinarySkills.events(elapsed)[0].z'),cycleRun('pressedComet.z'),'The host must preserve press-time upward C aim despite a later input view');positionSnapshot();assert.equal(cycleRun('netActions.length'),0);
    sandbox.mascotRepeated={...mascotCInput,seq:mascotCInput.seq+1};run('receiveNetPacket("friend",mascotRepeated);updateRemoteActor(remoteMascot,.05)');cycleRun(`netSequence=${mascotCInput.seq+1}`);assert.equal(run('ordinarySkills.events(elapsed).length'),1);assert.equal(run('remoteMascot.kit.smoke'),1,'Repeated action IDs may not cast/spend twice');
    run('elapsed=10.6;updateOrdinarySkills()');const cometPacket=positionSnapshot();assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(ordinarySkills.snapshot())')),cometPacket.ordinarySkills);cycleRun('netHasSnapshot=false');positionSnapshot();assertNear(cycleRun('ordinarySkills.events(elapsed)[0].endsAt'),10+DUELIST_SKILLS.cometFlight+DUELIST_SKILLS.cometDuration,'Fresh snapshots retain the original projectile age/deadline');
    const cometReplica=imported.createCharacterSkills();assert.equal(cometReplica.restore(cometPacket.ordinarySkills,cometPacket.time,cometPacket.rules.round),true);const malformedComet=JSON.parse(JSON.stringify(cometPacket.ordinarySkills));malformedComet.events[0].radius=9;assert.equal(cometReplica.restore(malformedComet,cometPacket.time,cometPacket.rules.round),false,'JSON cannot enlarge the canonical sphere');
    const remoteComet=JSON.parse(run('JSON.stringify(ordinarySkills.events(elapsed)[0])'));cycleRun(`Object.assign(player,{x:${remoteComet.x},y:${remoteComet.y}-1.7,z:${remoteComet.z},vy:0,crouch:0});updatePlay(.01)`);assert.equal(cycleRun('scene.fog.far'),2.5,'A fresh guest shares the host airborne fog');
    run('elapsed=20;resetOrdinarySkills();netInputs.clear();Object.assign(remoteMascot,{x:0,z:20,y:1,vy:-1,crouch:0,skillThrowUntil:0});remoteMascot.kit.updraft=1');cycleRun('netHasSnapshot=false');positionSnapshot();cycleRun('useAbility("q")');assertNear(cycleRun('player.vy'),7.8,'The existing immediate upward prediction is retained');assert.equal(cycleRun('ordinarySkills.events(elapsed).length'),0,'Prediction owns no authoritative lift event');const mascotQInput=relayMascot();assertNear(run('remoteMascot.vy'),7.8);assert.equal(run('remoteMascot.kit.updraft'),0);assert.equal(run('ordinarySkills.events(elapsed).filter(event=>event.type==="duelist-lift").length'),1);
    cycleRun('player.vy=2.25');positionSnapshot();assertNear(cycleRun('player.vy'),2.25,'A normal ACK may not replay the predicted upward impulse');positionSnapshot();assertNear(cycleRun('player.vy'),2.25);
    run('remoteMascot.vy=-.75');sandbox.mascotRepeated={...mascotQInput,seq:mascotQInput.seq+1};run('receiveNetPacket("friend",mascotRepeated);updateRemoteActor(remoteMascot,.05)');cycleRun(`netSequence=${mascotQInput.seq+1}`);assertNear(run('remoteMascot.vy'),0,'A repeated action must use the unchanged position sample, never apply a second7.8 impulse');assert.equal(run('ordinarySkills.events(elapsed).filter(event=>event.type==="duelist-lift").length'),1);
    cycleRun('player.y=0;player.vy=0');relayMascot();assertNear(run('remoteMascot.y'),0);assertNear(run('remoteMascot.vy'),0);assert.equal(run('actorGrounded(remoteMascot)'),true,'A real grounded JSON input must clear the old Q impulse so later interactions are not permanently airborne');
    cycleRun('netHasSnapshot=false');positionSnapshot();cycleRun('player.vy=1.5;updateOrdinarySkills();updateOrdinarySkills()');assertNear(cycleRun('player.vy'),1.5,'A late lift visual must never become a new impulse on rejoin');
    run('elapsed=30;resetOrdinarySkills();remoteMascot.kit.updraft=1;remoteMascot.vy=-1;remoteMascot.y=1;remoteMascot.skillThrowUntil=0;for(let i=0;i<20;i++)ordinarySkills.cast("echo-tag",ordinaryActorView(player),{x:-30,y:.12,z:25},elapsed,match.round);netInputs.clear()');cycleRun('netHasSnapshot=false');positionSnapshot();cycleRun('useAbility("q")');assertNear(cycleRun('player.vy'),7.8);relayMascot();positionSnapshot();assert.equal(run('remoteMascot.kit.updraft'),1);assert.equal(cycleRun('player.kit.updraft'),1,'The host rejection must refund predicted stock on ACK');assertNear(run('remoteMascot.vy'),0,'A rejected host Q must retain sampled vertical movement, never add its impulse');assert.equal(cycleRun('netActions.length'),0);
    run('match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()');positionSnapshot();for(const evaluate of [run,cycleRun]){assert.equal(evaluate('ordinarySkills.events(elapsed).length'),0);assert.equal(evaluate('player.vy'),0);}cycleRun('leaveOnline()');run('leaveOnline();$("agent-select").value="duelist";startGame()');
    console.log('PASS: independent mascot JSON airborne press-time comet, stock-only smoke prediction, ACK/duplicate/fresh age, shared fog, single predicted/host lift and20-cap rejection/next-round cleanup');
  }

  // Readiness feedback distinguishes rejected prediction/round grants from a
  // completed signature cooldown, while keeping WIND recharge kill-based.
  {
    const feedbackInstrumentation=`var feedbackSoundOriginal=sound,feedbackMessageOriginal=showMessage,feedbackReadySounds=[],feedbackReadyMessages=[];
      sound=function(type,options){if(type==='dash-ready')feedbackReadySounds.push({type,time:elapsed});return feedbackSoundOriginal(type,options)};
      showMessage=function(title,description,seconds){if(title.includes('再使用可能'))feedbackReadyMessages.push({title,description,time:elapsed});return feedbackMessageOriginal(title,description,seconds)};
      function feedbackSetup(character){if(online)leaveOnline();onlinePlaying=false;mode='menu';$('agent-select').value=character;$('match-format').value='standard';startGame();startRound();
        elapsed=10;clearCombatInput();Object.assign(player,{x:0,z:20,y:0,vy:0,yaw:0,pitch:-.2,hp:40,alive:true,dashTimer:0});player.kit=new DuelistKit({character});inventory.primary='vandal';equip('vandal',true);player.ammo=4;player.reserve=5;
        if(character==='onnara'){player.y=1;player.vy=2;}
        if(character==='cat')addDrop({id:++dropSequence,weapon:'ghost',x:player.x,z:player.z-6,yaw:0,ammo:9,reserve:12});
        Object.assign(dashFeedback,{round:null,state:null,expires:0,charge:null,signatureAt:0});feedbackReadySounds.length=0;feedbackReadyMessages.length=0;updateAbilityFeedback();
      }`;
    run(feedbackInstrumentation);cycleRun(feedbackInstrumentation);
    try {
      for (const [character, duration] of Object.keys(imported.CHARACTER_DEFS).filter(id=>id!=='duelist').map(id=>[id,imported.signatureCooldown(id)])) {
        sandbox.feedbackCharacter=character;run('feedbackSetup(feedbackCharacter);var beforeRejectedSignature=player.kit.snapshot();activateAbility(player,"e",{predict:true,aim:{yaw:0,pitch:-.2}});updateAbilityFeedback()');
        assert.equal(run('player.kit.dash'), 0);assert.equal(run('dashFeedback.signatureAt'), 10+duration);
        run('elapsed=10.2;player.kit.restore(beforeRejectedSignature);updateAbilityFeedback();updateAbilityFeedback()');
        assert.equal(run('player.kit.dash'), 1);assert.equal(run('feedbackReadySounds.length'), 0, `${character} rejected prediction may not play a recharge cue`);
        assert.equal(run('feedbackReadyMessages.length'), 0, `${character} rejected prediction may not claim its cooldown elapsed`);
        assert.equal(run('totalKills'),0);assert.equal(run('player.kit.dashKills'),0,'Timed signatures must be verified without any kill recharge');
        run('elapsed=20;activateAbility(player,"e",{predict:true,aim:{yaw:0,pitch:-.2}});updateAbilityFeedback();var realSignatureDeadline=player.kit.nextSignatureAt;elapsed=realSignatureDeadline-.001;player.kit.tick(elapsed);updateAbilityFeedback()');
        assert.equal(run('feedbackReadySounds.length'), 0);assert.equal(run('feedbackReadyMessages.length'), 0);assert.equal(run('player.kit.dash'), 0);
        run('elapsed=realSignatureDeadline;player.kit.tick(elapsed);updateAbilityFeedback();updateAbilityFeedback();elapsed+=1;updateAbilityFeedback()');
        assert.equal(run('player.kit.dash'), 1);assert.equal(run('feedbackReadySounds.length'), 1, `${character} true cooldown expiry must play exactly one cue`);
        assert.equal(run('feedbackReadyMessages.length'), 1);assert.match(run('feedbackReadyMessages[0].description'),new RegExp(`${duration}秒経過`));
        assert.equal(run('feedbackReadyMessages[0].title'),run('getCharacterSkill(player.kit.character,"e").name+" / 再使用可能"'));
        assert.ok(run('feedbackReadyMessages[0].description.includes(getCharacterSkill(player.kit.character,"e").name)'),`${character} cooldown toast must describe its current E`);
        assert.doesNotMatch(run('feedbackReadyMessages[0].description'),/キル|撃破/,`${character} zero-kill cooldown may not claim a kill requirement`);
        assert.equal(run('feedbackReadySounds[0].time'),20+duration);assert.equal(run('feedbackReadyMessages[0].time'),20+duration);
        run('feedbackReadySounds.length=0;feedbackReadyMessages.length=0;activateAbility(player,"e",{predict:true,aim:{yaw:0,pitch:-.2}});updateAbilityFeedback();match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents();startRound();updateAbilityFeedback()');
        assert.equal(run('player.kit.dash'),1);assert.equal(run('feedbackReadySounds.length'),0,`${character} round-start charge grant must stay silent`);assert.equal(run('feedbackReadyMessages.length'),0);
      }
      run('feedbackSetup("duelist");activateAbility(player,"e");updateAbilityFeedback();elapsed=10+DUELIST.dashArmDelay;activateAbility(player,"e");updateAbilityFeedback()');
      assert.equal(run('player.kit.dash'),0);assert.equal(run('feedbackReadySounds.length'),0);assert.equal(run('feedbackReadyMessages.length'),0);
      run('for(let i=0;i<DUELIST.signatureKills;i++)player.kit.awardKill();updateAbilityFeedback();updateAbilityFeedback()');
      assert.equal(run('player.kit.dash'),1);assert.equal(run('feedbackReadySounds.length'),1);assert.equal(run('feedbackReadyMessages.length'),1);assert.match(run('feedbackReadyMessages[0].description'),new RegExp(`${DUELIST.signatureKills}キル達成`));
      run('feedbackSetup("frost");activateAbility(player,"e");updateAbilityFeedback();player.kit.awardKill();player.kit.awardKill();updateAbilityFeedback()');
      assert.equal(run('player.kit.dash'),0,'The timed ribbon may not inherit WIND kill recharge');assert.equal(run('feedbackReadySounds.length'),0);assert.equal(run('feedbackReadyMessages.length'),0);

      // Cross real input, ACK and fresh-snapshot boundaries: a rejected E is a
      // returned charge, not a completed timer, even though stock changes0→1.
      for(const character of ['nope','mend','echo','veil','ember','frost']){
        cycleRun('if(online)leaveOnline()');run(movementSetup(true));cycleRun(movementSetup(false));sandbox.feedbackCharacter=character;
        run(`elapsed=10;resetOrdinarySkills();var feedbackRemote=bots.find(bot=>bot.id==='red-0');feedbackRemote.kit=new DuelistKit({character:feedbackCharacter});feedbackRemote.record.primary='vandal';Object.assign(feedbackRemote,{x:0,z:20,y:0,vy:0,hp:40,netWeapon:'vandal',netAmmo:4,netReserve:5,netReload:0});Object.assign(player,{x:-30,z:30,y:0});for(let i=0;i<20;i++)ordinarySkills.cast('echo-tag',ordinaryActorView(player),{x:-30,y:.12,z:25},elapsed,match.round);`);
        cycleRun('Object.assign(dashFeedback,{round:null,state:null,expires:0,charge:null,signatureAt:0});feedbackReadySounds.length=0;feedbackReadyMessages.length=0');positionSnapshot();cycleRun('updateAbilityFeedback();updateAbilityFeedback()');
        assert.equal(cycleRun('feedbackReadySounds.length'),0,`${character} initial ready snapshot must establish a silent baseline`);assert.equal(cycleRun('feedbackReadyMessages.length'),0);
        for(const fresh of [false,true]){
          cycleRun('useAbility("e");updateAbilityFeedback()');assert.equal(cycleRun('player.kit.dash'),0,`${character} fixture must make a real pending E prediction`);
          cycleRun('tickOnline(.1)');sandbox.feedbackInput=JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));run('receiveNetPacket("friend",feedbackInput);updateRemoteActor(feedbackRemote,.05)');
          if(fresh)cycleRun('netHasSnapshot=false');positionSnapshot();cycleRun('updateAbilityFeedback();updateAbilityFeedback()');
          assert.equal(run('feedbackRemote.kit.dash'),1);assert.equal(cycleRun('player.kit.dash'),1);assert.equal(cycleRun('player.kit.nextSignatureAt'),0);assert.equal(cycleRun('netActions.length'),0,'The rejection must be acknowledged, not left as an untested pending action');
          assert.equal(cycleRun('feedbackReadySounds.length'),0,`${character} ${fresh?'fresh':'normal'} rejection ACK may not announce readiness`);assert.equal(cycleRun('feedbackReadyMessages.length'),0);
        }
        // Guest rendering can reach a deadline before a newer-sequence host
        // packet rolls the same timer back. Re-crossing it is not a new grant.
        run('elapsed=44.9;feedbackRemote.kit.dash=0;feedbackRemote.kit.nextSignatureAt=45');positionSnapshot();cycleRun('updateAbilityFeedback();elapsed=45;player.kit.tick(elapsed);updateAbilityFeedback()');
        assert.equal(cycleRun('feedbackReadySounds.length'),1);assert.equal(cycleRun('feedbackReadyMessages.length'),1);
        positionSnapshot();assert.equal(cycleRun('player.kit.dash'),0,'A newer host snapshot must really rewind the predicted charge for this test');cycleRun('updateAbilityFeedback();elapsed=45;player.kit.tick(elapsed);updateAbilityFeedback();updateAbilityFeedback()');
        assert.equal(cycleRun('feedbackReadySounds.length'),1,`${character} the same round/character/deadline may not replay its cue after host clock correction`);assert.equal(cycleRun('feedbackReadyMessages.length'),1);
        run('elapsed=45;feedbackRemote.kit.tick(elapsed)');positionSnapshot();cycleRun('updateAbilityFeedback()');assert.equal(cycleRun('feedbackReadySounds.length'),1,'Authoritative confirmation of that same charge must remain silent');

        // Rejoining an already-completed cooldown establishes a new visual
        // baseline; a later genuinely new cooldown must still announce once.
        run('elapsed=79.9;feedbackRemote.kit.dash=0;feedbackRemote.kit.nextSignatureAt=80');positionSnapshot();cycleRun('updateAbilityFeedback();feedbackReadySounds.length=0;feedbackReadyMessages.length=0;netHasSnapshot=false');
        run('elapsed=100;feedbackRemote.kit.tick(elapsed)');positionSnapshot();cycleRun('updateAbilityFeedback();updateAbilityFeedback()');
        assert.equal(cycleRun('player.kit.dash'),1);assert.equal(cycleRun('feedbackReadySounds.length'),0,`${character} a fresh same-round ready snapshot may not replay a historical expiry`);assert.equal(cycleRun('feedbackReadyMessages.length'),0);
        run('elapsed=139.9;feedbackRemote.kit.dash=0;feedbackRemote.kit.nextSignatureAt=140');positionSnapshot();cycleRun('updateAbilityFeedback();elapsed=140;player.kit.tick(elapsed);updateAbilityFeedback();updateAbilityFeedback()');
        assert.equal(cycleRun('feedbackReadySounds.length'),1,`${character} fresh recovery may not permanently mute a new deadline`);assert.equal(cycleRun('feedbackReadyMessages.length'),1);
      }
      cycleRun('leaveOnline()');run('leaveOnline()');
      for(let matchIndex=0;matchIndex<2;matchIndex++){
        run('feedbackSetup("ember");activateAbility(player,"e",{predict:true});updateAbilityFeedback();elapsed=45;player.kit.tick(elapsed);updateAbilityFeedback();updateAbilityFeedback()');
        assert.equal(run('feedbackReadySounds.length'),1,'A distinct new match must not inherit a prior match identical round/character/deadline key');assert.equal(run('feedbackReadyMessages.length'),1);
      }
    } finally { run('sound=feedbackSoundOriginal;showMessage=feedbackMessageOriginal');cycleRun('sound=feedbackSoundOriginal;showMessage=feedbackMessageOriginal'); }
    run('backMenu();$("agent-select").value="duelist";startGame()');
    console.log('PASS: six timed signatures announce their exact configured cooldown once with current E names and zero kills; seven-character recharge semantics, JSON ACK/fresh rejection and round grants preserve silent baselines');
  }

  // Seven-character choices and team ultimates must cross real game input and
  // independent host/guest JSON state, rather than sharing actors or effects.
  {
    const characterHTML = fs.readFileSync(path.join(__dirname, 'public/play.html'), 'utf8');
    const characterIds = ['duelist', 'nope', 'mend', 'echo', 'veil', 'ember', 'frost', 'duck', 'cat', 'car', 'nobi', 'japan', 'cap', 'urchin', 'onnara'];
    for (const id of ['agent-select', 'online-agent']) {
      const options = characterHTML.match(new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)</select>`))?.[1];
      assert.ok(options, `${id} must remain present`);
      assert.deepEqual(Array.from(options.matchAll(/<option value="([^"]+)"/g), value => value[1]), characterIds);
    }
    run('backMenu()');
    for (const character of characterIds) {
      const selector = document.getElementById(character === 'echo' ? 'online-agent' : 'agent-select');
      selector.value = character; dispatchElement(selector, 'change', { target: selector });
      assert.equal(document.getElementById('agent-select').value, character);
      assert.equal(document.getElementById('online-agent').value, character);
      assert.equal(JSON.parse(localValues.get('hashimoto-settings')).character, character, 'Character choice must persist with the other settings');
      run("$('match-format').value='standard';startGame()");
      assert.equal(run('player.kit.character'), character, 'A new match must use the selected character');
      const metadata = run(`CHARACTER_DEFS[${JSON.stringify(character)}]`);
      assert.equal(document.getElementById('agent-description').textContent, `${metadata.role} · ${metadata.description}`);
      assert.equal(document.getElementById('ability-x-name').textContent, metadata.ultShortName);
      assert.equal(document.getElementById('mobile-ult-name').textContent, metadata.ultShortName);
      assert.equal(document.getElementById('mobile-ult').attributes['aria-label'], `X ${metadata.ultName}`);
      run('backMenu()');
    }

    mainAgent.value = 'mend'; dispatchElement(mainAgent, 'change', { target: mainAgent });
    run(`startGame();startRound();player.x=0;player.z=0;player.y=0;player.crouch=0;player.hp=40;player.armor=37;
      inventory.primary='vandal';equip('vandal',true);player.kit.ultPoints=7;
      bots.forEach((bot,index)=>{bot.x=35;bot.z=20+index;bot.y=0;bot.hp=100;bot.armor=25;bot.fire=999;});
      Object.assign(bots.find(bot=>bot.id==='blue-1'),{x:3,z:0,hp:10});
      Object.assign(bots.find(bot=>bot.id==='blue-2'),{x:-3,z:0,hp:80});
      Object.assign(bots.find(bot=>bot.id==='blue-3'),{x:0,z:3,hp:0,alive:false});
      Object.assign(bots.find(bot=>bot.id==='blue-4'),{x:19,z:0,hp:10});
      Object.assign(bots.find(bot=>bot.id==='red-0'),{x:0,z:-3,hp:10});useAbility('x');`);
    assert.equal(run('player.hp'), 100); assert.equal(run('player.armor'), 37);
    assert.equal(run("bots.find(bot=>bot.id==='blue-1').hp"), 85, 'MEND must add at most75HP, rather than setting every ally to full health');
    assert.equal(run("bots.find(bot=>bot.id==='blue-2').hp"), 100, 'MEND must cap health at100');
    assert.equal(run("bots.find(bot=>bot.id==='blue-3').alive"), false); assert.equal(run("bots.find(bot=>bot.id==='blue-3').hp"), 0);
    assert.equal(run("bots.find(bot=>bot.id==='blue-4').hp"), 10, 'MEND must not reach beyond18m');
    assert.equal(run("bots.find(bot=>bot.id==='red-0').hp"), 10, 'MEND must never heal an opponent');
    assert.equal(run('bots.every(bot=>bot.armor===25)'), true, 'Healing must not replenish armor');
    assert.equal(run('player.kit.ultPoints'), 0); assert.equal(run('inventory.active'), 'vandal');
    assert.equal(run('player.kit.knivesActive'), false); assert.equal(run('player.kit.knives'), 0);
    assert.equal(run('teamAbilities.snapshot().events.length'), 1);
    for (const obstruction of ['wall', 'smoke', 'range', 'dead', 'enemy', 'full']) {
      run(`resetTeamAbilities();syncSmokes([]);player.hp=100;player.kit.ultPoints=7;
        bots.forEach(bot=>{bot.hp=100;bot.alive=true;bot.x=35;bot.z=25;});
        Object.assign(bots.find(bot=>bot.id==='blue-1'),{x:6,z:0,hp:20});`);
      if (obstruction === 'wall') run('map.colliders.push({minX:2,maxX:4,minZ:-1,maxZ:1,height:4})');
      if (obstruction === 'smoke') run('syncSmokes([{id:91001,x:3,y:1.45,z:0,expires:100}])');
      if (obstruction === 'range') run("bots.find(bot=>bot.id==='blue-1').x=18.01");
      if (obstruction === 'dead') run("Object.assign(bots.find(bot=>bot.id==='blue-1'),{alive:false,hp:0})");
      if (obstruction === 'enemy') run("bots.find(bot=>bot.id==='blue-1').hp=100;Object.assign(bots.find(bot=>bot.id==='red-0'),{x:6,z:0,hp:20})");
      if (obstruction === 'full') run("bots.find(bot=>bot.id==='blue-1').hp=100");
      run("useAbility('x')");
      assert.equal(run('player.kit.ultPoints'), 7, `${obstruction}: no reachable injured living ally must preserve all seven points`);
      assert.equal(run('teamAbilities.snapshot().events.length'), 0, `${obstruction}: rejected healing must not create a visual event`);
      if (obstruction === 'wall') run('map.colliders.pop()');
      if (obstruction === 'smoke') run('syncSmokes([])');
    }
    run("player.hp=40;player.kit.ultPoints=6;useAbility('x')");
    assert.equal(run('player.hp'), 40); assert.equal(run('player.kit.ultPoints'), 6);
    run("player.kit.ultPoints=7;equip('knife',true);useAbility('x')");
    assert.equal(run('player.hp'), 100); assert.equal(run('inventory.active'), 'knife');
    assert.equal(run('player.kit.knivesActive'), false); assert.equal(run('player.kit.knives'), 0, 'MEND must preserve a normal knife without granting WIND knives');
    run('backMenu()'); assert.equal(run('teamAbilities.snapshot().events.length'), 0);

    for (const character of characterIds) {
      mainAgent.value = character; dispatchElement(mainAgent, 'change', { target: mainAgent });
      run("$('match-format').value='explore';startGame();pauseGame(true)");
      const trialButton = document.getElementById('landmark-travel').children.find(button => button.textContent === 'キャラ能力を試す');
      assert.ok(trialButton); assert.equal(trialButton.disabled, false); dispatchElement(trialButton, 'click', {});
      assert.equal(run('mode'), 'play'); assert.equal(run('player.kit.ultPoints'), 7);
      assert.equal(run('bots.length'), character === 'mend' ? 2 : 3);
      assert.equal(run(`bots.every(bot=>bot.rangeTarget&&bot.team${character === 'mend' ? '===' : '!=='}player.team)`), true);
      const trialPositions = run('JSON.stringify(bots.map(bot=>[bot.x,bot.z]))');
      run('updateBots(.25)'); assert.equal(run('JSON.stringify(bots.map(bot=>[bot.x,bot.z]))'), trialPositions, 'Skill-trial targets must remain peaceful and stationary');
      if (character === 'mend') {
        assert.equal(run('player.hp'), 40); assert.deepEqual(JSON.parse(run('JSON.stringify(bots.map(bot=>bot.hp))')), [35, 60]);
        run("useAbility('x')"); assert.equal(run('player.hp'), 100); assert.equal(run('bots.every(bot=>bot.hp===100)'), true);
        run('startCharacterTrial()'); assert.equal(run('bots.length'), 2); assert.equal(run('player.hp'), 40); assert.equal(run('player.kit.ultPoints'), 7);
      }
      run('backMenu()'); assert.equal(run('bots.length'), 0); assert.equal(run('teamAbilities.snapshot().events.length'), 0);
    }
    for (const format of ['standard', 'range', 'plant', 'defuse']) {
      run(`$('match-format').value=${JSON.stringify(format)};startGame()`);
      const originalTargets = run('JSON.stringify(bots.map(bot=>bot.id))'), originalHP = run('player.hp'), originalPoints = run('player.kit.ultPoints');
      assert.equal(run('startCharacterTrial()'), false, `${format} must not accept map-only skill trials`);
      assert.equal(run('JSON.stringify(bots.map(bot=>bot.id))'), originalTargets); assert.equal(run('player.hp'), originalHP); assert.equal(run('player.kit.ultPoints'), originalPoints);
      run('backMenu()');
    }

    const guestCharacterHUD = id => cycleElements.get(id);
    const relayCharacterInput = () => {
      cycleRun('tickOnline(.1)');
      const packet = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
      sandbox.teamCharacterInput = packet;
      run('{const actor=bots.find(bot=>bot.id==="red-0");receiveNetPacket("friend",teamCharacterInput);updateRemoteActor(actor,.05)}');
      return packet;
    };
    const markers = (execute, team) => JSON.parse(execute(`JSON.stringify(teamAbilities.markers(${JSON.stringify(team)},elapsed))`));
    for (const character of ['mend', 'echo']) {
      guestAgent.value = character; dispatchElement(guestAgent, 'change', { target: guestAgent });
      run(movementSetup(true)); cycleRun(movementSetup(false)); cycleRun('netActionSequence=0');
      assert.equal(run('(()=>{const before=exploring;exploring=true;const allowed=startCharacterTrial();exploring=before;return allowed})()'), false, 'Online matches must reject skill trials even if exploration state is stale');
      run(`match.phase='buy';bots.forEach((bot,index)=>{bot.x=35;bot.z=20+index;bot.y=0;bot.hp=100;bot.armor=25;bot.fire=999;});
        {const actor=bots.find(bot=>bot.id==='red-0');actor.x=0;actor.z=0;actor.y=0;actor.kit.ultPoints=7;
        actor.netWeapon='vandal';actor.record.primary='vandal';actor.netAmmo=25;actor.netReserve=75;}
        player.x=6;player.z=0;player.hp=100;`);
      positionSnapshot();
      assert.equal(cycleRun('netActions.length'), 1); assert.equal(cycleRun('netActions[0].type'), 'character');
      assert.equal(cycleRun('netActions[0].character'), character);
      relayCharacterInput(); positionSnapshot();
      assert.equal(run("bots.find(bot=>bot.id==='red-0').kit.character"), character, 'The host must approve the new character during the first buy phase');
      assert.equal(cycleRun('player.kit.character'), character); assert.equal(cycleRun('netActions.length'), 0);
      const metadata = run(`CHARACTER_DEFS[${JSON.stringify(character)}]`);
      assert.equal(guestCharacterHUD('ability-x-name').textContent, metadata.ultShortName);
      assert.equal(guestCharacterHUD('mobile-ult-name').textContent, metadata.ultShortName);
      assert.equal(guestCharacterHUD('mobile-ult').attributes['aria-label'], `X ${metadata.ultName}`);
      if (character === 'mend') run(`bots.find(bot=>bot.id==='red-0').hp=40;Object.assign(bots.find(bot=>bot.id==='red-1'),{x:3,z:0,hp:20})`);
      else run(`Object.assign(bots.find(bot=>bot.id==='blue-1'),{x:25,z:0});Object.assign(bots.find(bot=>bot.id==='blue-2'),{x:31,z:0});
        Object.assign(bots.find(bot=>bot.id==='blue-3'),{x:3,z:0,hp:0,alive:false});map.colliders.push({minX:2,maxX:4,minZ:-1,maxZ:1,height:4});`);
      run('match.startLive();match.drainEvents()'); positionSnapshot();
      cycleRun("useAbility('x')");
      assert.equal(cycleRun('player.kit.ultPoints'), 0); assert.equal(cycleRun('inventory.active'), 'vandal');
      assert.equal(cycleRun('player.kit.knivesActive'), false); assert.equal(cycleRun('player.kit.knives'), 0);
      assert.equal(cycleRun('teamAbilities.snapshot().events.length'), 0, 'Guest prediction must wait for an authoritative shared event');
      if (character === 'mend') assert.equal(cycleRun('player.hp'), 40, 'A guest must never predict healing its own health');
      positionSnapshot();
      assert.equal(cycleRun('player.kit.ultPoints'), 0, 'A pre-ACK snapshot must retain the pending seven-point prediction');
      if (character === 'mend') assert.equal(cycleRun('player.hp'), 40);
      const abilityInput = relayCharacterInput(), effectPacket = positionSnapshot();
      assert.equal(run("bots.find(bot=>bot.id==='red-0').kit.ultPoints"), 0); assert.equal(cycleRun('player.kit.ultPoints'), 0);
      assert.equal(cycleRun('netActions.length'), 0); assert.equal(run("bots.find(bot=>bot.id==='red-0').netWeapon"), 'vandal');
      assert.equal(effectPacket.teamAbilities.events.length, 1);
      assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(teamAbilities.snapshot())')), effectPacket.teamAbilities, 'Independent peers must share the same semantic event and ping state');
      sandbox.duplicateTeamCharacterInput = { ...abilityInput, seq: abilityInput.seq + 1 };
      if (character === 'mend') {
        assert.equal(run("bots.find(bot=>bot.id==='red-0').hp"), 100); assert.equal(cycleRun('player.hp'), 100);
        assert.equal(run("bots.find(bot=>bot.id==='red-1').hp"), 95); assert.equal(cycleRun("bots.find(bot=>bot.id==='red-1').hp"), 95);
        assert.equal(cycleRun('player.armor'), 25);
        run("bots.find(bot=>bot.id==='red-0').hp=55");
      }
      run('{const actor=bots.find(bot=>bot.id==="red-0");receiveNetPacket("friend",duplicateTeamCharacterInput);updateRemoteActor(actor,.05)}');
      cycleRun(`netSequence=Math.max(netSequence,${abilityInput.seq + 1})`);
      run('elapsed+=.3;updateTeamAbilities()'); positionSnapshot(); positionSnapshot();
      assert.equal(run('teamAbilities.snapshot().events.length'), 1, 'Duplicate input must not cast a second team ultimate');
      if (character === 'mend') {
        assert.equal(run("bots.find(bot=>bot.id==='red-0').hp"), 55); assert.equal(cycleRun('player.hp'), 55, 'Repeated snapshots must not replay a healing event');
        cycleRun('netHasSnapshot=false'); positionSnapshot();
        assert.equal(cycleRun('player.hp'), 55, 'A fresh/rejoining guest must restore current health without reapplying healing');
        assert.equal(cycleRun('teamAbilities.snapshot().events.length'), 1);
        run("bots.filter(bot=>bot.team==='red').forEach(bot=>bot.hp=100);bots.find(bot=>bot.id==='red-0').kit.ultPoints=7"); positionSnapshot();
        cycleRun("player.hp=40;useAbility('x')"); assert.equal(cycleRun('player.kit.ultPoints'), 0);
        relayCharacterInput(); positionSnapshot();
        assert.equal(run("bots.find(bot=>bot.id==='red-0').kit.ultPoints"), 7);
        assert.equal(cycleRun('player.kit.ultPoints'), 7, 'A host-rejected no-target MEND must refund the guest prediction on ACK');
        assert.equal(cycleRun('player.hp'), 100); assert.equal(cycleRun('netActions.length'), 0);
      } else {
        const origin = effectPacket.teamAbilities.events[0], pulseCounts = [effectPacket.teamAbilities.pings[0].pulse];
        assert.equal(origin.x, 0); assert.equal(origin.z, 0); assert.equal(origin.radius, 30);
        assert.deepEqual(markers(run, 'red').map(ping => ping.targetId).sort(), ['blue-1', 'player']);
        assert.equal(markers(run, 'blue').length, 0); assert.equal(markers(cycleRun, 'blue').length, 0, 'Enemy teams must not receive another team\'s minimap markers');
        run("bots.find(bot=>bot.id==='red-0').x=10;player.x=31;bots.find(bot=>bot.id==='blue-1').x=20;bots.find(bot=>bot.id==='blue-2').x=29;elapsed=.5;updateTeamAbilities()"); positionSnapshot();
        assert.equal(markers(cycleRun, 'red').find(ping => ping.targetId === 'player').x, 6, 'A revealed point must stay at its detection position while the target moves');
        run('elapsed=1.25;updateTeamAbilities()'); positionSnapshot(); assert.equal(markers(cycleRun, 'red').length, 0, 'A detection marker must expire after1.25s');
        run('elapsed=2;updateTeamAbilities()'); const secondPulse = positionSnapshot(); pulseCounts.push(secondPulse.teamAbilities.pings[0].pulse);
        assert.deepEqual(markers(cycleRun, 'red').map(ping => ping.targetId).sort(), ['blue-1', 'blue-2'], 'Later scans must use the fixed cast center, not a moving caster');
        assert.equal(markers(cycleRun, 'red').find(ping => ping.targetId === 'blue-1').x, 20);
        cycleRun('netHasSnapshot=false'); positionSnapshot();
        assert.equal(cycleRun('teamAbilities.events(elapsed)[0].startedAt'), origin.startedAt, 'Late join must retain the original scan age');
        cycleRun('updateTeamAbilities()'); assert.equal(cycleRun('teamAbilities.snapshot().pings.length'), 2, 'Restored effects must not own extra scan sampling');
        run('elapsed=3.25;updateTeamAbilities()'); positionSnapshot(); assert.equal(markers(cycleRun, 'red').length, 0);
        run("bots.find(bot=>bot.id==='blue-1').x=21;elapsed=4;updateTeamAbilities()"); const thirdPulse = positionSnapshot(); pulseCounts.push(thirdPulse.teamAbilities.pings[0].pulse);
        assert.deepEqual(pulseCounts, [0, 1, 2], 'ECHO must sample exactly the0/2/4-second pulses');
        assert.equal(markers(cycleRun, 'red').find(ping => ping.targetId === 'blue-1').x, 21);
        run('elapsed=5.25;updateTeamAbilities()'); positionSnapshot(); assert.equal(markers(cycleRun, 'red').length, 0);
        run('elapsed=6;updateTeamAbilities()'); positionSnapshot();
        assert.equal(run('teamAbilities.events(elapsed).length'), 0); assert.equal(cycleRun('teamAbilities.events(elapsed).length'), 0);
        assert.equal(cycleRun('teamAbilities.snapshot().pings.length'), 0); run('map.colliders.pop()');
        run("bots.find(bot=>bot.id==='red-0').kit.ultPoints=7;activateAbility(bots.find(bot=>bot.id==='red-0'),'x')"); positionSnapshot();
      }
      run('match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()'); positionSnapshot();
      assert.equal(run('teamAbilities.snapshot().events.length'), 0); assert.equal(cycleRun('teamAbilities.snapshot().events.length'), 0);
      assert.equal(markers(run, 'red').length, 0); assert.equal(markers(cycleRun, 'red').length, 0, 'Round changes must clear all team effect markers');
      run('match.startLive();teamAbilities.castRecon(player,elapsed,match.round);updateTeamAbilities()'); positionSnapshot();
      assert.equal(cycleRun('teamAbilities.snapshot().events.length'), 1);
      cycleRun('leaveOnline()'); run('leaveOnline()');
      assert.equal(run('teamAbilities.snapshot().events.length'), 0); assert.equal(cycleRun('teamAbilities.snapshot().events.length'), 0);
      assert.equal(markers(run, 'blue').length, 0); assert.equal(markers(cycleRun, 'blue').length, 0, 'Returning to menu must clear active scans on both peers');
    }
    {
      mainAgent.value = 'echo'; dispatchElement(mainAgent, 'change', { target: mainAgent });
      run("$('match-format').value='range';startGame();updatePlay(59)");
      keyDown('KeyX'); keyUp('KeyX');
      assert.equal(run('teamAbilities.snapshot().events.length'), 1, 'ECHO must have an active six-second scan immediately before the drill deadline');
      assert.equal(run('characterFX.group.visible'), true); assert.equal(run('characterFX.group.userData.activeEvents'), 1);
      run('updatePlay(1)');
      assert.equal(run('rangeSession.time'), 60); assert.equal(run('mode'), 'result');
      assert.equal(run('teamAbilities.snapshot().events.length'), 0, 'Drill completion must clear semantic abilities before its gameplay clock freezes');
      assert.equal(run('teamAbilities.snapshot().pings.length'), 0); assert.equal(run('characterFX.group.visible'), false);
      assert.equal(run('characterFX.group.userData.activeEvents'), 0);
      const resultClock = run('elapsed'); run('renderWithDetonation(10)');
      assert.equal(run('elapsed'), resultClock, 'The result screen must retain its stopped gameplay clock');
      assert.equal(run('teamAbilities.events(elapsed).length'), 0); assert.equal(run('characterFX.group.visible'), false, 'Rendering ten more seconds of results must not resurrect the scan');
      assert.equal(run('characterFX.group.children.every(mesh=>!mesh.visible)'), true);
      run("backMenu();$('match-format').value='standard'");
    }
    mainAgent.value = 'duelist'; dispatchElement(mainAgent, 'change', { target: mainAgent });
    guestAgent.value = 'duelist'; dispatchElement(guestAgent, 'change', { target: guestAgent });
    run('startGame()');
    console.log('PASS: exactly seven-character selector/settings/new-match/HUD identity, MEND75HP limits/LOS/smoke/no-target/points, retained rifle/knife and isolated peaceful skill trials');
    console.log('PASS: independent MEND/ECHO guest prediction/ACK/rejection/duplicates/rejoin, fixed three-pulse minimap observations, team filtering, expiry and round/menu cleanup');
    console.log('PASS: last-second ECHO scan and minimap/ground FX clear on drill completion and stay cleared throughout the frozen-clock result screen');
  }

  // VEIL uses the same smoke lifecycle and authority as C, with a distinct radius.
  // Exercise actual input, camera/LOS functions and independent JSON peers.
  {
    const chooseVeil = (element, character) => { element.value = character; dispatchElement(element, 'change', { target: element }); };
    const mainVeilSelector = document.getElementById('agent-select');
    chooseVeil(mainVeilSelector, 'veil');
    run("backMenu();$('match-format').value='standard';startGame();startRound();clearBots();makeBot({x:35,z:35},0,'red',{id:'veil-sentinel',team:'red',name:'SENTINEL',secondary:'classic'});bots[0].rangeTarget=true;player.x=0;player.z=0;player.y=0;player.vy=0;player.crouch=0;player.kit.ultPoints=7;inventory.primary='vandal';equip('vandal',true);player.ammo=3;player.reserve=11");
    keyDown('KeyX'); keyUp('KeyX');
    assert.equal(run('player.kit.character'), 'veil'); assert.equal(run('player.kit.ultPoints'), 0);
    assert.equal(run('player.kit.knivesActive'), false); assert.equal(run('inventory.active'), 'vandal');
    assert.equal(run('player.ammo'), 3); assert.equal(run('player.reserve'), 11);
    assert.equal(run('smokes.length'), 1);
    const localVeil = JSON.parse(run('JSON.stringify(serializeSmokes()[0])'));
    assert.equal(localVeil.kind, 'veil'); assert.equal(localVeil.radius, 9);
    assert.equal(localVeil.x, 0); assert.equal(localVeil.z, 0); assertNear(localVeil.y, 1.7, 'VEIL must center on the caster\'s eye height');
    assertNear(localVeil.expires - run('elapsed'), 12, 'VEIL must retain its twelve-second duration');
    run('smokes[0].mesh.geometry.computeBoundingSphere()');
    assert.ok(Math.abs(run('smokes[0].mesh.geometry.boundingSphere.radius*smokes[0].mesh.scale.x') - 9) < 1e-5, 'The rendered dome must have the same9m radius as LOS within Float32 geometry precision');
    for (const [a, b] of [
      [{ x: -12, y: .25, z: 0, team: 'blue' }, { x: 12, y: .25, z: 0, team: 'red' }],
      [{ x: 0, y: .25, z: 0, team: 'red' }, { x: 12, y: .25, z: 0, team: 'red' }],
      [{ x: 0, y: .25, z: 0, team: 'blue' }, { x: 1, y: .25, z: 0, team: 'blue' }],
    ]) {
      assert.equal(run(`smokeBlocks(${JSON.stringify(a)},${JSON.stringify(b)})`), true, 'The dome must obscure through and interior sight for either team');
      assert.equal(run(`visibleBetween(${JSON.stringify(a)},${JSON.stringify(b)})`), false);
    }
    assert.equal(run('smokeBlocks({x:-12,y:.25,z:9.01},{x:12,y:.25,z:9.01})'), false, 'A line entirely outside9m must remain unobscured');
    run('player.x=20;updatePlay(.05)');
    assert.equal(run('smokes[0].x'), 0, 'The cast dome must not follow its caster'); assert.equal(run('scene.fog.far'), 380);
    run('player.x=8.99;updatePlay(.05)'); assert.equal(run('scene.fog.far'), 2.5, 'The camera must be obscured inside VEIL, beyond ordinary C radius');
    run('player.x=9.01;updatePlay(.05)'); assert.equal(run('scene.fog.far'), 380, 'The camera must clear at the actual dome boundary');
    run(`syncSmokes([...serializeSmokes(),{id:99001,kind:'smoke',radius:3.6,x:24,y:1.7,z:0,expires:100}]);updateSmokeAppearance(elapsed)`);
    assert.deepEqual(JSON.parse(run('JSON.stringify(serializeSmokes().map(s=>[s.kind,s.radius]))')), [['veil', 9], ['smoke', 3.6]], 'Ordinary C and VEIL must coexist without changing each other\'s radius');
    run('player.x=0;elapsed=11.9;updatePlay(.05)'); assert.equal(run('scene.fog.far'), 2.5);
    run('elapsed=12;updatePlay(.05)');
    assert.equal(run("smokes.some(s=>s.kind==='veil')"), false); assert.equal(run('scene.fog.far'), 380);
    assert.equal(run('smokes.length'), 1, 'VEIL expiry must not remove an unrelated C smoke');
    run("syncSmokes([]);player.kit.ultPoints=7;useAbility('x');match.endRound('blue','elimination');handleMatchEvents();match.nextRound();handleMatchEvents()");
    assert.equal(run('smokes.length'), 0, 'A new round must clear the dome');
    run("match.startLive();player.kit.ultPoints=7;useAbility('x');backMenu()");
    assert.equal(run('smokes.length'), 0, 'Returning to menu must clear the dome');

    for (const scenario of ['approach', 'retake-cover', 'already-covered', 'defusing']) {
      run(`$('starting-side').value='defend';startGame();startRound();player.x=-30;player.z=25;
        bots.forEach(bot=>{bot.rangeTarget=true;bot.x=35;bot.z=35;bot.kit.ultPoints=0;});
        var veilNPC=bots.find(bot=>bot.id===${JSON.stringify(scenario === 'retake-cover' || scenario === 'defusing' ? 'blue-1' : 'red-0')});
        veilNPC.rangeTarget=false;veilNPC.kit=new DuelistKit({character:'veil'});veilNPC.kit.ultPoints=7;veilNPC.x=0;veilNPC.z=-8;veilNPC.target=null;veilNPC.fire=999;`);
      if (scenario === 'retake-cover' || scenario === 'defusing') {
        run("match.interactPlant(4,{actorId:'red-0',team:'red',site:'A',x:0,z:-18});match.drainEvents()");
        if (scenario === 'defusing') run('veilNPC.z=-17');
        else run("Object.assign(bots.find(bot=>bot.id==='blue-2'),{rangeTarget:false,x:0,z:-17,target:null,fire:999})");
      }
      if (scenario === 'already-covered') run("syncSmokes([{id:99002,x:0,y:1.7,z:-8,expires:100,kind:'veil',radius:9}])");
      run('var veilNPCOrigin={x:veilNPC.x,z:veilNPC.z};updateBots(.05)');
      if (scenario === 'approach' || scenario === 'retake-cover') {
        assert.equal(run('veilNPC.kit.ultPoints'), 0, `${scenario}: NPC must deploy VEIL for an approach or covering a retake`);
        assert.equal(run("smokes.filter(s=>s.kind==='veil').length"), 1);
        assertNear(run('smokes[0].x'), run('veilNPCOrigin.x'), 'NPC cast center must use its position at activation');
        assertNear(run('smokes[0].z'), run('veilNPCOrigin.z'), 'NPC cast center must remain fixed while it moves');
      } else {
        assert.equal(run('veilNPC.kit.ultPoints'), 7, `${scenario}: an interacting or already-covered NPC must retain its ultimate`);
        assert.equal(run('smokes.length'), scenario === 'already-covered' ? 1 : 0);
        if (scenario === 'defusing') assert.equal(run('veilNPC.defusing'), true, 'VEIL must not interrupt an actual defuse');
      }
      run('backMenu()');
    }

    for (const ability of ['c', 'x']) {
      run(`startGame();startRound();player.x=0;player.z=10;player.y=0;player.hp=100;player.armor=0;
        bots.forEach(bot=>{bot.rangeTarget=true;bot.x=35;bot.z=35;bot.kit.ultPoints=0;});
        var veilCaster=bots.find(bot=>bot.id==='red-0'),lateShooter=bots.find(bot=>bot.id==='red-1');
        Object.assign(veilCaster,{rangeTarget:false,remoteId:'smoke-caster',x:0,z:${ability === 'c' ? -16 : 0},y:0,netWeapon:'classic',netAmmo:12,netReserve:36});
        veilCaster.kit=new DuelistKit({character:${JSON.stringify(ability==='c'?'duelist':'veil')}});veilCaster.kit.smoke=1;veilCaster.kit.ultPoints=7;
        Object.assign(lateShooter,{rangeTarget:false,x:0,z:-10,y:0,target:player,think:1,reactionUntil:0,fire:${ability === 'c' ? 999 : 0},aiWeapon:'classic',aiAmmo:12,aiReload:0});
        lateShooter.record.primary=null;lateShooter.record.secondary='classic';lateShooter.group.rotation.y=0;
        netInputs.clear();netApplied.clear();netInputs.set('smoke-caster',{seq:1,round:match.round,connection:'smoke-order',received:elapsed,receivedAt:Date.now(),
          input:{x:veilCaster.x,z:veilCaster.z,y:0,yaw:${ability === 'c' ? Math.PI : 0},pitch:0},
          actions:[{seq:1,round:match.round,type:'ability',key:${JSON.stringify(ability)},at:elapsed}]});
        var sameFrameRandom=Math.random;`);
      assert.equal(run('visibleBetween(lateShooter,player)'), true, 'The cached BOT target must be visible before the remote cast');
      try { run('Math.random=()=>0;updateBots(.05)'); }
      finally { run('Math.random=sameFrameRandom'); }
      if(ability==='c'){
        assert.equal(run('ordinarySkills.events(elapsed).filter(event=>event.type==="duelist-comet").length'),1);
        assert.equal(run('visibleBetween(lateShooter,player)'),true,'The new C retains its transparent0.30-second flight warning');
        run('elapsed+=.3;lateShooter.fire=0;updateOrdinarySkills();Math.random=()=>0');
        try { run('updateBots(.05)'); } finally { run('Math.random=sameFrameRandom'); }
      }else assert.equal(run('smokes.length'), 1);
      assert.equal(run('visibleBetween(lateShooter,player)'), false, `${ability}: an arrived C or immediate X must block the later BOT\'s sight in this frame`);
      assert.equal(run('lateShooter.shotSequence||0'), 0, `${ability}: a stale target must not allow one guaranteed shot through the newly created smoke`);
      assert.equal(run('player.hp'), 100, `${ability}: applying the remote cast before the BOT turn must protect the target immediately`);
      run('backMenu()');
    }

    chooseVeil(guestAgent, 'veil');
    run(movementSetup(true)); cycleRun(movementSetup(false)); cycleRun('netActionSequence=0');
    run(`match.phase='buy';player.x=-20;player.z=0;
      {const actor=bots.find(bot=>bot.id==='red-0');actor.x=0;actor.z=0;actor.y=0;actor.kit.ultPoints=7;actor.record.primary='vandal';actor.netWeapon='vandal';actor.netAmmo=3;actor.netReserve=11;}`);
    const relayVeilInput = () => {
      cycleRun('tickOnline(.1)'); const packet = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
      sandbox.veilInputPacket = packet;
      run('receiveNetPacket("friend",veilInputPacket);updateRemoteActor(bots.find(bot=>bot.id==="red-0"),.05)');
      return packet;
    };
    positionSnapshot();
    assert.equal(cycleRun('netActions[0].character'), 'veil'); relayVeilInput(); positionSnapshot();
    assert.equal(run("bots.find(bot=>bot.id==='red-0').kit.character"), 'veil', 'The host must accept the fifth character during the first buy phase');
    assert.equal(cycleRun('player.kit.character'), 'veil');
    run('match.startLive();match.drainEvents()'); positionSnapshot();
    cycleRun("useAbility('x')");
    assert.equal(cycleRun('player.kit.ultPoints'), 0); assert.equal(cycleRun('smokes.length'), 0, 'Guest prediction must consume points without creating an authoritative dome');
    positionSnapshot(); assert.equal(cycleRun('player.kit.ultPoints'), 0, 'A pending VEIL must survive a pre-ACK snapshot');
    const castInput = relayVeilInput(), castSnapshot = positionSnapshot();
    assert.equal(cycleRun('netActions.length'), 0); assert.equal(cycleRun('inventory.active'), 'vandal');
    assert.equal(cycleRun('player.ammo'), 3); assert.equal(cycleRun('player.reserve'), 11);
    assert.equal(run('smokes.length'), 1); assert.equal(cycleRun('smokes.length'), 1);
    const remoteVeil = castSnapshot.smokes[0];
    assert.equal(remoteVeil.kind, 'veil'); assert.equal(remoteVeil.radius, 9); assertNear(remoteVeil.expires - castSnapshot.time, 12, 'Online VEIL must use host age');
    assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(serializeSmokes())')), castSnapshot.smokes);
    cycleRun('var firstVeilMesh=smokes[0].mesh');
    sandbox.veilDuplicateInput = { ...castInput, seq: castInput.seq + 1 };
    run('receiveNetPacket("friend",veilDuplicateInput);updateRemoteActor(bots.find(bot=>bot.id==="red-0"),.05)'); positionSnapshot(); positionSnapshot();
    assert.equal(run('smokes.length'), 1); assert.equal(cycleRun('smokes.length'), 1);
    assert.equal(cycleRun('smokes[0].mesh===firstVeilMesh'), true, 'Repeated snapshots must retain the same dome instead of restarting it');
    assert.equal(cycleRun('smokes[0].expires'), remoteVeil.expires);
    run('elapsed=4'); cycleRun('netHasSnapshot=false'); positionSnapshot();
    assert.equal(cycleRun('smokes[0].expires'), remoteVeil.expires, 'Rejoin must preserve the original expiry rather than awarding twelve new seconds');
    cycleRun('updatePlay(.05)'); assert.equal(cycleRun('scene.fog.far'), 2.5, 'A rejoining caster must receive the same inside-dome obscuration');
    run(`elapsed=${remoteVeil.expires};updatePlay(.01)`); positionSnapshot(); cycleRun('updatePlay(.01)');
    assert.equal(run('smokes.length'), 0); assert.equal(cycleRun('smokes.length'), 0); assert.equal(cycleRun('scene.fog.far'), 380);
    run("bots.find(bot=>bot.id==='red-0').kit.ultPoints=7;activateAbility(bots.find(bot=>bot.id==='red-0'),'x')"); positionSnapshot();
    run('match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()'); positionSnapshot();
    assert.equal(run('smokes.length'), 0); assert.equal(cycleRun('smokes.length'), 0, 'Both peers must remove VEIL on the next round');
    run("match.startLive();bots.find(bot=>bot.id==='red-0').kit.ultPoints=7;activateAbility(bots.find(bot=>bot.id==='red-0'),'x')"); positionSnapshot();
    cycleRun('leaveOnline()'); run('leaveOnline()');
    assert.equal(run('smokes.length'), 0); assert.equal(cycleRun('smokes.length'), 0, 'Leaving an online room must remove its dome on both peers');
    chooseVeil(mainVeilSelector, 'duelist'); chooseVeil(guestAgent, 'duelist'); run('startGame()');
    console.log('PASS: VEIL7pt rifle retention, fixed9m dome, both-team interior/through LOS, matching camera boundary, C coexistence, twelve-second expiry, tactical NPCs and local cleanup');
    console.log('PASS: remote C/VEIL clears cached BOT targets before a later same-frame turn, preventing smoke-through shots and damage');
    console.log('PASS: fifth-character approval, guest prediction/ACK, host-only VEIL creation, JSON kind/radius/age, duplicate/rejoin and online round/menu cleanup');
  }

  // Resolve real arena surfaces before spending an area ultimate on a deck.
  {
    const fixtureFields = Object.fromEntries(['colliders', 'collision', 'ramps', 'bounds'].map(key => [key, arena[key]]));
    const actualDecks = [
      { name: 'east Mewe deck', x: 72, z: -11.5, targetX: 52 },
      { name: 'west station deck', x: -40, z: -30.5, targetX: -60 },
    ];
    run('backMenu();startGame();startRound();bots.forEach(bot=>{bot.rangeTarget=true;bot.kit.ultPoints=0})');
    for (const key of Object.keys(fixtureFields)) arena[key] = map[key];
    try {
      for (const deck of actualDecks) for (const character of ['ember', 'frost']) {
        run(`resetZoneAbilities();player.kit=new DuelistKit({character:${JSON.stringify(character)}});player.kit.ultPoints=7;
          Object.assign(player,{x:${deck.x},y:3.2,z:${deck.z},yaw:Math.PI/2,pitch:0,alive:true,hp:100,vy:0});
          var realDeckPreview=getZonePreview();`);
        assertNear(run('realDeckPreview.x'), deck.targetX + 1e-6, `${character} preview reaches20m along the ${deck.name}`);
        assertNear(run('realDeckPreview.y'), 3.2, `${character} preview stays on the ${deck.name} surface`);
        assertNear(run('realDeckPreview.z'), deck.z, 'Preview follows the real deck lane');
        run("useAbility('x');var realDeckCast=zoneAbilities.events(elapsed)[0]");
        assert.equal(run('player.kit.ultPoints'), 0); assert.equal(run('realDeckCast.type'), character);
        assertNear(run('realDeckCast.x'), deck.targetX + 1e-6, `${character} cast follows its deck preview instead of falling back to the caster`);
        assertNear(run('realDeckCast.y'), 3.2, `${character} event retains the actual deck height`);
        assertNear(run('Math.hypot(realDeckCast.x-player.x,realDeckCast.z-player.z)'), 20 - 1e-6, 'A visible deck target does not collapse into a zero-distance cast');
      }
      assertNear(run('getZoneFloor(62,-11.5,1.6)'), 0, 'A ground actor still targets the underpass beneath the eastern deck');
      assertNear(run('getZoneFloor(62,-11.5,4.8)'), 3.2, 'A deck actor can target the same slab top');
      assertNear(run('getZoneFloor(-50,-30.5,1.6)'), 0, 'A ground actor keeps the station deck underpass');
      assertNear(run('getZoneFloor(-50,-30.5,4.8)'), 3.2, 'The long station deck is a valid upper surface');
      assertNear(run('getZoneFloor(4,-15.5,1.6)'), 0, 'A tall service-building roof is not mistaken for a reachable floor');
      assertNear(run('getZoneFloor(72.5,0,3.64)'), 3.2 * 14 / 22, 'A ramp retains its continuous walking height');
      run('Object.assign(player,{x:72.5,y:3.2*14/22,z:0,yaw:0,pitch:-.15});var rampDeckTarget=getZoneTarget(player,{x:72.5,y:0,z:-5})');
      assertNear(run('rampDeckTarget.y'), 3.2 * 19 / 22, 'A target farther up the real staircase uses its own slope height');
      run('Object.assign(player,{x:0,y:0,z:28,yaw:0,pitch:0});var realWallTarget=getZoneTarget(player,{x:0,y:0,z:-15})');
      assert.ok(run('realWallTarget.z') >= 21.12, 'Real information-building walls still stop a ground cast in front');
      assertNear(run('realWallTarget.y'), 0, 'Wall rejection does not lift the field to a roof');
      run('Object.assign(player,{x:62,y:0,z:-11.5,yaw:Math.PI/2,pitch:0});var underDeckTarget=getZoneTarget(player,{x:52,y:0,z:-11.5})');
      assertNear(run('underDeckTarget.x'), 52, 'Ground-level casting remains possible below the overhead deck');
      assertNear(run('underDeckTarget.y'), 0, 'Underpass targeting never jumps to the deck above the caster');
      const courtyardSlab = { minX: -2, maxX: 2, minZ: 57, maxZ: 61, height: 1.2, base: 1,
        polygon: [[-2,57],[2,57],[2,61],[-2,61]], holes: [[[-1,58],[1,58],[1,60],[-1,60]]] };
      arena.colliders.push(courtyardSlab);
      try {
        assertNear(run('getZoneFloor(1.5,59,1.6)'), 1.2, 'A real overlap identifies an elevated support surface');
        assertNear(run('getZoneFloor(0,59,1.6)'), 0, 'A footprint hole cannot become an invisible upper floor');
      } finally { arena.colliders.pop(); }
    } finally {
      Object.assign(arena, fixtureFields); run('resetZoneAbilities();backMenu()');
    }
    console.log('PASS: both real decks EMBER/FROST cast+preview at3.2m,20m reach,ground underpasses,ramp heights,wall/roof exclusion,and footprint holes');
  }

  // Ground ultimates retain host damage authority while both peers share slow fields.
  {
    const mainZoneSelector = document.getElementById('agent-select');
    const selectZone = (element, character) => { element.value = character; dispatchElement(element, 'change', { target: element }); };
    const isolateZoneActors = `bots.forEach(bot=>{bot.rangeTarget=true;bot.x=35;bot.z=35;bot.y=0;bot.kit.ultPoints=0;});`;
    for (const character of ['ember', 'frost']) {
      selectZone(mainZoneSelector, character);
      run(`backMenu();$('match-format').value='standard';$('starting-side').value='attack';startGame();startRound();${isolateZoneActors}
        player.x=0;player.z=20;player.y=0;player.vy=0;player.yaw=0;player.pitch=-.3;player.kit.ultPoints=7;
        inventory.primary='vandal';equip('vandal',true);player.ammo=3;player.reserve=11;`);
      keyDown('KeyX'); keyUp('KeyX');
      assert.equal(run('player.kit.ultPoints'), 0); assert.equal(run('player.kit.knivesActive'), false);
      assert.equal(run('inventory.active'), 'vandal'); assert.equal(run('player.ammo'), 3); assert.equal(run('player.reserve'), 11);
      const effect = JSON.parse(run('JSON.stringify(zoneAbilities.events(elapsed)[0])'));
      assert.equal(effect.type, character); assert.equal(effect.sourceId, 'player'); assert.equal(effect.team, 'blue');
      assert.equal(effect.radius, character === 'ember' ? 6 : 7);
      assertNear(effect.endsAt - effect.startedAt, character === 'ember' ? 4.8 : 10, 'Ground effects must keep their configured lifespan');
      assert.ok(Math.hypot(effect.x, effect.z - 20) <= 20 && effect.z < 18, 'A real downward X aim must place the field in front, within20m');
      assert.equal(effect.y, 0, 'A ground ultimate must not inherit eye height');
      run('map.colliders.push({minX:-1,maxX:1,minZ:12,maxZ:13,height:4});var obstructedZonePoint=getZoneTarget(player,{x:0,y:0,z:0});map.colliders.pop()');
      assert.ok(run('obstructedZonePoint.z') >= 13.12, 'A field aimed behind a tall wall must stop in front with its targeting clearance');
      assert.ok(run('Math.hypot(obstructedZonePoint.x-player.x,obstructedZonePoint.z-player.z)') <= 20);
      run('var rangedZonePoint=getZoneTarget(player,{x:0,y:0,z:-100})');
      assert.ok(run('Math.hypot(rangedZonePoint.x-player.x,rangedZonePoint.z-player.z)') <= 20, 'Ground targeting must clamp far input to20m');
      run('updateTeamAbilities()'); assert.equal(run('zoneFX.group.visible'), true);
      if (character === 'ember') {
        sandbox.zoneImpactPoint = effect;
        run(`var zoneVictim=bots.find(bot=>bot.id==='red-0');Object.assign(zoneVictim,{x:zoneImpactPoint.x,z:zoneImpactPoint.z,hp:100,armor:50});
          var zoneAlly=bots.find(bot=>bot.id==='blue-1');Object.assign(zoneAlly,{x:zoneImpactPoint.x,z:zoneImpactPoint.z,hp:100,armor:25});
          var zoneDead=bots.find(bot=>bot.id==='red-1');Object.assign(zoneDead,{x:zoneImpactPoint.x,z:zoneImpactPoint.z,hp:0,alive:false});`);
        for (const [offset, hp, armor] of [[1.2, 90, 30], [2.4, 80, 10], [3.6, 60, 0]]) {
          run(`elapsed=${effect.startedAt + offset};updateTeamAbilities();updateTeamAbilities()`);
          assertNear(run('zoneVictim.hp'), hp, 'EMBER pulses must use the real armor damage function exactly once');
          assertNear(run('zoneVictim.armor'), armor, 'Armor must absorb the correct share of each30-damage pulse');
        }
        assert.equal(run('zoneAlly.hp'), 100); assert.equal(run('zoneAlly.armor'), 25); assert.equal(run('zoneDead.alive'), false);
        run("player.kit.ultPoints=7;useAbility('x');zoneVictim.hp=20;zoneVictim.armor=0;var zoneKillCredits=match.credits;var zoneKillCount=totalKills;elapsed+=1.2;updateTeamAbilities()");
        assert.equal(run('zoneVictim.alive'), false); assert.equal(run('totalKills-zoneKillCount'), 1);
        assert.equal(run('match.credits-zoneKillCredits'), 200, 'A host-owned zone elimination must award ordinary kill credit');
      }
      run(`player.x=0;player.z=0;player.y=0;player.pitch=0;var zoneBoundaryFailures=[];
        for(let heading=0;heading<720;heading++){
          resetZoneAbilities();player.yaw=heading*Math.PI/360;player.kit.ultPoints=7;activateAbility(player,'x');
          const events=zoneAbilities.events(elapsed),event=events[0];
          if(player.kit.ultPoints!==0||events.length!==1||!event||Math.hypot(event.x-player.x,event.z-player.z)>20)zoneBoundaryFailures.push(heading);
        }`);
      assert.deepEqual(JSON.parse(run('JSON.stringify(zoneBoundaryFailures)')), [], `${character} horizontal aiming must create a real field across all720 half-degree headings, without losing seven points at the20m floating-point boundary`);
      run('backMenu()'); assert.deepEqual(JSON.parse(run('JSON.stringify(zoneAbilities.snapshot())')), { events: [] });
      assert.equal(run('zoneFX.group.visible'), false);
    }

    // Use a steady walking speed so acceleration cannot conceal the exact0.55 factor.
    const walking = [];
    for (const slow of [false, true]) {
      run(`startGame();startRound();${isolateZoneActors}player.x=-20;player.z=20;player.y=0;player.vy=0;player.yaw=0;player.pitch=0;player.vx=0;
        inventory.active='classic';player.vz=-(5.4*1.15)*${slow ? .55 : 1};
        ${slow ? "Object.assign(bots.find(bot=>bot.id==='red-0'),{x:-20,z:17});zoneAbilities.cast('frost',bots.find(bot=>bot.id==='red-0'),{x:-20,y:0,z:17},0,match.round);" : ''}
        elapsed=1;keys.add('KeyW');for(let frame=0;frame<60;frame++)updatePlay(1/60);keys.clear();`);
      walking.push(20 - run('player.z'));
    }
    assertNear(walking[0], (5.4*1.15), 'The control must walk at normal firearm speed');
    assertNear(walking[1], (5.4*1.15) * .55, 'FROST must scale actual local walking, rather than only its HUD');

    const remoteSteps = [], npcSteps = [];
    for (const slow of [false, true]) {
      run(`startGame();startRound();${isolateZoneActors}elapsed=1;
        var slowRemote=bots.find(bot=>bot.id==='red-0');Object.assign(slowRemote,{x:-20,z:20,y:0,remoteId:'slow-guest',netWeapon:'classic',netAmmo:12,netReserve:36});
        ${slow ? "zoneAbilities.cast('frost',{id:'slow-source',team:'blue',x:-20,y:0,z:17,hp:100,alive:true},{x:-20,y:0,z:17},1,match.round);elapsed=2;" : ''}
        netInputs.clear();netInputs.set('slow-guest',{seq:1,connection:'slow',round:match.round,received:elapsed,receivedAt:Date.now(),input:{x:-20,z:10,y:0,yaw:0,pitch:0},actions:[]});
        updateRemoteActor(slowRemote,.1);`);
      remoteSteps.push(20 - run('slowRemote.z'));
      run(`backMenu();$('starting-side').value='defend';startGame();startRound();${isolateZoneActors}
        player.x=-30;player.z=20;elapsed=1;var slowNPC=bots.find(bot=>bot.id==='red-0');
        Object.assign(slowNPC,{x:0,z:26,y:0,rangeTarget:false,target:null,think:1,fire:999});
        ${slow ? "zoneAbilities.cast('frost',{id:'slow-source',team:'blue',x:0,y:0,z:26,hp:100,alive:true},{x:0,y:0,z:26},1,match.round);elapsed=2;" : ''}
        updateBots(.1);`);
      npcSteps.push(run('Math.hypot(slowNPC.x,slowNPC.z-26)'));
    }
    assertNear(remoteSteps[0], .7 * 1.15, 'The remote control must reach the ordinary7m/s authority cap');
    assertNear(remoteSteps[1], .7 * 1.15 * .55, 'Host authority must apply FROST to remote walking as well');
    assert.ok(npcSteps[0] > .2, 'The test BOT must actually advance toward its site');
    assertNear(npcSteps[1], npcSteps[0] * .55, 'A tactical BOT must use the same walking reduction');

    run(`resetZoneAbilities();player.x=-20;player.z=20;player.y=0;player.vy=0;player.vx=0;player.vz=0;elapsed=3;
      zoneAbilities.cast('frost',{id:'frost-enemy',team:'red',x:-20,y:0,z:17,hp:100,alive:true},{x:-20,y:0,z:17},2,match.round);
      player.dashTimer=.18;player.dashVec={x:0,z:-1};updatePlay(.18)`);
    assertNear(run('20-player.z'), 12, 'FROST must not shorten the signature dash');
    run('player.x=-20;player.z=20;player.y=0;player.vy=5.6;player.vx=0;player.vz=0;updatePlay(.1)');
    assertNear(run('player.y'), .485, 'FROST must not change jump gravity or vertical velocity');
    run('backMenu()');

    for (const character of ['ember', 'frost']) {
      selectZone(guestAgent, character);
      run(movementSetup(true)); cycleRun(movementSetup(false)); cycleRun('netActionSequence=0');
      run(`match.phase='buy';${isolateZoneActors}player.x=-20;player.z=10;
        {const actor=bots.find(bot=>bot.id==='red-0');actor.x=0;actor.z=20;actor.y=0;actor.kit.ultPoints=7;actor.record.primary='vandal';actor.netWeapon='vandal';actor.netAmmo=3;actor.netReserve=11;}`);
      const relayZoneInput = () => {
        cycleRun('tickOnline(.1)'); const packet = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
        sandbox.zoneInputPacket = packet; run('receiveNetPacket("friend",zoneInputPacket);updateRemoteActor(bots.find(bot=>bot.id==="red-0"),.05)');
        return packet;
      };
      positionSnapshot(); relayZoneInput(); positionSnapshot();
      assert.equal(run("bots.find(bot=>bot.id==='red-0').kit.character"), character);
      run('match.startLive();match.drainEvents()'); positionSnapshot();
      cycleRun("player.yaw=0;player.pitch=-.3;useAbility('x')");
      assert.equal(cycleRun('player.kit.ultPoints'), 0); assert.equal(cycleRun('zoneAbilities.snapshot().events.length'), 0, 'Guest X must not create a speculative damage or slow field');
      positionSnapshot(); assert.equal(cycleRun('player.kit.ultPoints'), 0);
      const castInput = relayZoneInput(), castPacket = positionSnapshot();
      assert.equal(cycleRun('netActions.length'), 0); assert.equal(cycleRun('player.kit.knivesActive'), false);
      assert.equal(cycleRun('inventory.active'), 'vandal'); assert.equal(cycleRun('player.ammo'), 3);
      assert.equal(castPacket.zoneAbilities.events.length, 1); const field = castPacket.zoneAbilities.events[0];
      assert.equal(field.type, character); assert.equal(field.sourceId, 'red-0');
      assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(zoneAbilities.snapshot())')), castPacket.zoneAbilities);
      sandbox.zoneDuplicateInput = { ...castInput, seq: castInput.seq + 1 };
      run('receiveNetPacket("friend",zoneDuplicateInput);updateRemoteActor(bots.find(bot=>bot.id==="red-0"),.05)'); positionSnapshot();
      assert.equal(run('zoneAbilities.snapshot().events.length'), 1, 'Retransmitted actions must not produce a second ground ultimate');
      sandbox.hostZonePoint = field;
      run('player.x=hostZonePoint.x;player.z=hostZonePoint.z;player.y=0;player.hp=100;player.armor=0'); positionSnapshot();
      if (character === 'ember') {
        cycleRun('elapsed+=1.2;updateTeamAbilities()');
        assert.equal(cycleRun("bots.find(bot=>bot.id==='player').hp"), 100, 'A guest observing a due EMBER pulse must not apply damage autonomously');
        run(`elapsed=${field.startedAt + 1.2};updateTeamAbilities()`); positionSnapshot();
        assert.equal(run('player.hp'), 70); assert.equal(cycleRun("bots.find(bot=>bot.id==='player').hp"), 70, 'The guest must receive host-resolved health through the snapshot');
      } else {
        run(`elapsed=${field.startedAt + 1};updateTeamAbilities()`); positionSnapshot();
        assert.equal(run('actorSpeedScale(player)'), .55);
        cycleRun('updateBots(.25)'); // Let the displayed remote actor adopt its newly received location.
        assert.equal(cycleRun("actorSpeedScale(bots.find(bot=>bot.id==='player'))"), .55, 'A restored enemy field must preserve its movement effect on the other peer');
        assert.equal(cycleRun('actorSpeedScale(player)'), 1, 'The casting guest must not slow itself or its team');
      }
      run(`elapsed=${field.startedAt + 2}`); cycleRun('netHasSnapshot=false'); positionSnapshot();
      assert.equal(cycleRun('zoneAbilities.events(elapsed)[0].startedAt'), field.startedAt, 'Rejoin must retain the original zone age');
      run('match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()'); positionSnapshot();
      assert.equal(run('zoneAbilities.snapshot().events.length'), 0); assert.equal(cycleRun('zoneAbilities.snapshot().events.length'), 0);
      run(`match.startLive();{const actor=bots.find(bot=>bot.id==='red-0');actor.kit.ultPoints=7;activateAbility(actor,'x')}`); positionSnapshot();
      cycleRun('leaveOnline()'); run('leaveOnline()');
      assert.equal(run('zoneAbilities.snapshot().events.length'), 0); assert.equal(cycleRun('zoneAbilities.snapshot().events.length'), 0);
      assert.equal(run('zoneFX.group.visible'), false); assert.equal(cycleRun('zoneFX.group.visible'), false);
    }
    selectZone(mainZoneSelector, 'duelist'); selectZone(guestAgent, 'duelist'); run('startGame()');
    console.log('PASS: EMBER/FROST real X aim across720 headings each, seven-point rifle retention, host armor/death/kill credit, exact walking slow and unaltered dash/jump');
    console.log('PASS: independent ground-ultimate choice/guest prediction/host cast/JSON age, no guest pulse damage, team slow filtering and round/menu cleanup');
  }

  // A guest's ability must retain the aim at the actual press, across a later input packet.
  {
    const prepareRemoteAim = character => {
      run('if(online)leaveOnline()'); cycleRun('if(online)leaveOnline()');
      run(movementSetup(true)); cycleRun(movementSetup(false)); cycleRun('netActionSequence=0');
      run(`player.x=-30;player.z=20;bots.forEach(bot=>{bot.rangeTarget=true});
        {const actor=bots.find(bot=>bot.id==='red-0');actor.x=0;actor.z=20;actor.y=0;actor.kit.character='${character}';actor.kit.ultPoints=7;actor.kit.smoke=2;}`);
      positionSnapshot();
    };
    const relayAimedAbility = () => {
      cycleRun('tickOnline(.1)'); const packet = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
      sandbox.aimedAbilityPacket = packet;
      run('receiveNetPacket("friend",aimedAbilityPacket);updateRemoteActor(bots.find(bot=>bot.id==="red-0"),.05)');
      return packet;
    };
    for (const character of ['ember', 'frost']) {
      prepareRemoteAim(character);
      cycleRun("player.yaw=0;player.pitch=0;var pressedZoneTarget=getZoneTarget(player);useAbility('x');player.yaw=Math.PI/2;player.pitch=-.45");
      const requestedPoint = JSON.parse(cycleRun('JSON.stringify(pressedZoneTarget)'));
      const castPacket = relayAimedAbility();
      assertNear(castPacket.input.yaw, Math.PI / 2, 'The transport must really contain a later, changed viewpoint');
      const field = JSON.parse(run('JSON.stringify(zoneAbilities.events(elapsed)[0])'));
      assert.equal(field.type, character); assert.equal(field.sourceId, 'red-0');
      assertNear(field.x, requestedPoint.x, `${character} must preserve its pressed horizontal aim`);
      assertNear(field.z, requestedPoint.z, `${character} must not retarget from the later movement input`);
      assert.equal(run("bots.find(bot=>bot.id==='red-0').kit.ultPoints"), 0);
      positionSnapshot();
      assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(zoneAbilities.events(elapsed)[0])')), field, 'Both peers must display the same pressed target');
      sandbox.duplicateAimAction = { ...castPacket, seq: castPacket.seq + 1 };
      run(`bots.find(bot=>bot.id==='red-0').kit.ultPoints=7;receiveNetPacket('friend',duplicateAimAction);updateRemoteActor(bots.find(bot=>bot.id==='red-0'),.05)`);
      assert.equal(run('zoneAbilities.events(elapsed).length'), 1); assert.equal(run("bots.find(bot=>bot.id==='red-0').kit.ultPoints"), 7, 'A repeated pressed-aim action must not cast or spend twice');
    }
    prepareRemoteAim('duelist');
    cycleRun("player.yaw=0;player.pitch=.2;useAbility('c');player.yaw=Math.PI/2;player.pitch=-.7");
    relayAimedAbility();
    const aimedCloud = JSON.parse(run('JSON.stringify(ordinarySkills.events(elapsed)[0])'));
    assert.equal(aimedCloud.type,'duelist-comet');
    assertNear(aimedCloud.x, 0, 'Mascot C must retain its pressed yaw, rather than the next packet viewpoint');
    assertNear(aimedCloud.z, 20 - DUELIST_SKILLS.cometRange * Math.cos(.2), 'Mascot C must retain its pressed pitch in its full3D range projection');
    assertNear(aimedCloud.y, 1.7 + DUELIST_SKILLS.cometRange * Math.sin(.2), 'Mascot C must retain its pressed upward aim');
    assert.equal(run("bots.find(bot=>bot.id==='red-0').kit.smoke"), 1);
    positionSnapshot(); assert.deepEqual(JSON.parse(cycleRun('JSON.stringify(ordinarySkills.events(elapsed)[0])')), aimedCloud);

    // Pressed aim remains an intention; host geometry still decides where it can land.
    prepareRemoteAim('ember');
    cycleRun("player.yaw=0;player.pitch=0;useAbility('x');player.yaw=Math.PI/2");
    run('map.colliders.push({minX:-1,maxX:1,minZ:12,maxZ:13,height:4})'); relayAimedAbility();
    assert.ok(run('zoneAbilities.events(elapsed)[0].z') >= 13.12, 'Host ray obstruction must stop a captured aim in front of a newly blocking wall');
    assertNear(run('zoneAbilities.events(elapsed)[0].x'), 0, 'Obstruction validation must still use the pressed direction');
    run('map.colliders.pop();leaveOnline()'); cycleRun('leaveOnline()'); run('startGame()');
    console.log('PASS: guest C/EMBER/FROST retain pressed yaw/pitch across later input/JSON, duplicate actions spend once, and host obstruction remains authoritative');
  }

  // Pulse audio follows event indices, without replaying an old impact on rejoin.
  {
    run(`backMenu();$('match-format').value='standard';startGame();startRound();
      bots.forEach(bot=>{bot.rangeTarget=true;bot.x=35;bot.z=35});player.x=-20;player.z=20;player.y=0;
      var zoneAudioOriginal=gameAudio.play,zoneAudioHeard=[];gameAudio.play=(type)=>zoneAudioHeard.push(type);soundEnabled=true;volume=.45;
      elapsed=10;zoneAbilities.cast('ember',player,{x:-20,y:0,z:20},elapsed,match.round);updateTeamAbilities()`);
    assert.equal(run('zoneAudioHeard.filter(type=>type==="ember-impact").length'), 0, 'EMBER warmup must remain silent');
    for (const [time, count] of [[11.21, 1], [11.22, 1], [12.41, 2], [13.61, 3]]) {
      run(`elapsed=${time};updateTeamAbilities();updateTeamAbilities()`);
      assert.equal(run('zoneAudioHeard.filter(type=>type==="ember-impact").length'), count, 'Each due impact index must sound once, regardless of repeated updates');
    }
    run('elapsed=14.81;updateTeamAbilities()');
    assert.equal(run('zonePulseAudio.size'), 0, 'Expired fields must release their audio indices');
    run(`elapsed=15;zoneAbilities.cast('ember',player,{x:-20,y:0,z:20},elapsed,match.round);elapsed=16.6;updateTeamAbilities()`);
    assert.equal(run('zoneAudioHeard.filter(type=>type==="ember-impact").length'), 3, 'A missed impact must not burst after its short playback window');
    run('resetZoneAbilities()'); assert.equal(run('zonePulseAudio.size'), 0);
    run('gameAudio.play=zoneAudioOriginal;backMenu()');

    run(movementSetup(true)); cycleRun(movementSetup(false));
    run(`player.x=0;player.z=20;player.y=0;{const actor=bots.find(bot=>bot.id==='red-0');actor.x=0;actor.z=24;actor.y=0;}
      elapsed=10;zoneAbilities.cast('ember',player,{x:0,y:0,z:20},elapsed,match.round);elapsed=11.25`);
    cycleRun(`var guestZoneAudioOriginal=gameAudio.play,guestZoneAudioHeard=[];gameAudio.play=(type)=>guestZoneAudioHeard.push(type);soundEnabled=true;volume=.45`);
    positionSnapshot(); cycleRun('updateTeamAbilities()');
    assert.equal(cycleRun('guestZoneAudioHeard.filter(type=>type==="ember-impact").length'), 0, 'The first guest snapshot after an impact must seed its index without replaying the past');
    positionSnapshot(); cycleRun('updateTeamAbilities()');
    assert.equal(cycleRun('guestZoneAudioHeard.filter(type=>type==="ember-impact").length'), 0, 'Repeated fresh-state data must not restart an old pulse');
    run('elapsed=12.41'); positionSnapshot(); cycleRun('updateTeamAbilities();updateTeamAbilities()');
    assert.equal(cycleRun('guestZoneAudioHeard.filter(type=>type==="ember-impact").length'), 1, 'A connected guest must still hear the next newly due impact');
    run('elapsed=14.81'); positionSnapshot(); cycleRun('updateTeamAbilities()');
    assert.equal(cycleRun('zonePulseAudio.size'), 0);
    run(`elapsed=15;zoneAbilities.cast('ember',player,{x:0,y:0,z:20},elapsed,match.round)`); positionSnapshot(); cycleRun('updateTeamAbilities()');
    assert.equal(cycleRun('zonePulseAudio.size'), 1);
    run('match.endRound("blue","elimination");handleMatchEvents();match.nextRound();handleMatchEvents()'); positionSnapshot();
    assert.equal(run('zonePulseAudio.size'), 0); assert.equal(cycleRun('zonePulseAudio.size'), 0, 'A new round must clear pulse-audio state on both peers');
    cycleRun('gameAudio.play=guestZoneAudioOriginal;leaveOnline()'); run('leaveOnline();startGame()');
    console.log('PASS: EMBER impact index audio once, skipped-window silence, guest initial-age suppression, future pulses, expiry and next-round cleanup');
  }

  // A host's background pause freezes guest inputs, not just its simulation loop.
  {
    run(movementSetup(false)); cycleRun(movementSetup(true));
    cycleRun(`var pausedInputActor=bots.find(bot=>bot.id==='red-0');
      pausedInputActor.x=-20;pausedInputActor.z=20;pausedInputActor.y=0;
      pausedInputActor.record.primary='vandal';pausedInputActor.netWeapon='vandal';pausedInputActor.netAmmo=8;pausedInputActor.netReserve=40;
      pausedInputActor.kit=new DuelistKit({character:'ember'});pausedInputActor.kit.ultPoints=7;pausedInputActor.kit.smoke=2;pausedInputActor.kit.updraft=1;
      bots.forEach(bot=>bot.fire=999);netHostPaused=false;`);
    const pausedInputSnapshot = () => {
      cycleRun('tickOnline(.1)'); sandbox.pausedInputPacket = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
      run('receiveNetPacket("host",pausedInputPacket)');
    };
    pausedInputSnapshot();
    assert.equal(run('netHostPaused'), false); assert.equal(run('player.kit.character'), 'ember');
    assert.ok(run('getZonePreview()'), 'A ready guest must see the normal ground-ultimate preview before host pause');
    run(`keys.add('KeyW');keys.add('TouchCrouch');firing=true;aiming=true;interactionHeld=true;
      touchMove={x:1,y:-1};touchLook={id:905,x:40,y:40};movePointer=906;`);
    cycleRun('netHostPaused=true'); pausedInputSnapshot();
    assert.equal(run('netHostPaused'), true);
    const pausedControls = () => JSON.parse(run('JSON.stringify({keys:[...keys],firing,aiming,interactionHeld,touchMove,touchLook,movePointer})'));
    const neutralControls = { keys: [], firing: false, aiming: false, interactionHeld: false, touchMove: { x: 0, y: 0 }, touchLook: null, movePointer: null };
    assert.deepEqual(pausedControls(), neutralControls, 'The first paused snapshot must release all keyboard, mouse, and touch holds');
    const pausedResources = () => run('JSON.stringify({kit:player.kit.snapshot(),ammo:player.ammo,reserve:player.reserve,active:inventory.active,primary:inventory.primary,reloading,vy:player.vy,dashTimer:player.dashTimer,shots,shotSequence,drops:droppedWeapons.length})');
    const beforePausedInputs = pausedResources();
    const pausePointer = { pointerId: 907, pointerType: 'touch', clientX: 82, clientY: 12, preventDefault() {} };
    for (const code of ['KeyW', 'KeyR', 'KeyC', 'KeyQ', 'KeyE', 'KeyX', 'KeyF', 'Space', 'Digit2', 'Digit3', 'Digit4', 'KeyG', 'ControlLeft']) keyDown(code);
    dispatchElement(canvas, 'mousedown', { button: 0 }); dispatchElement(canvas, 'mousedown', { button: 2 });
    for (const id of ['mobile-fire', 'mobile-interact', 'mobile-jump', 'mobile-reload', 'mobile-smoke', 'mobile-dash', 'mobile-scan', 'mobile-ult', 'move-pad']) dispatchElement(document.getElementById(id), 'pointerdown', pausePointer);
    dispatchElement(canvas, 'pointerdown', pausePointer);
    for (const id of ['mobile-weapon', 'mobile-ads', 'mobile-crouch']) dispatchElement(document.getElementById(id), 'click');
    run(`shoot();reload();equip('knife');jump();useAbility('c');useAbility('q');useAbility('e');useAbility('x');
      queueNetAction('fire');queueNetAction('reload');queueNetAction('equip',{weapon:'knife'});queueNetAction('drop');queueNetAction('ability',{key:'x'});`);
    assert.equal(pausedResources(), beforePausedInputs, 'Paused guest input must not spend bullets, charges, seven ultimate points, or change equipment and jump state');
    assert.deepEqual(pausedControls(), neutralControls, 'Input pressed during host pause must not remain held for the first resumed frame');
    assert.equal(run('netActions.length'), 0, 'Paused combat actions must never enter the retransmission queue');
    assert.equal(run('getZonePreview()'), null, 'A paused ready EMBER must not advertise an actionable target ring');
    run("player.kit.character='frost'"); assert.equal(run('getZonePreview()'), null, 'A paused ready FROST must also hide its preview');
    run("player.kit.character='ember';tickOnline(.1)");
    const pausedInput = JSON.parse(JSON.stringify(run('online.sent.at(-1)')));
    assert.equal(pausedInput.type, 'input'); assert.equal(pausedInput.input.interact, false);
    assert.deepEqual(pausedInput.actions, [], 'The live connection may send neutral state while paused, without deferred combat actions');
    cycleRun('netHostPaused=false'); pausedInputSnapshot();
    assert.equal(run('netHostPaused'), false); assert.deepEqual(pausedControls(), neutralControls);
    assert.ok(run('getZonePreview()'), 'The target ring must return when an authoritative resume snapshot arrives');
    keyDown('KeyX'); keyUp('KeyX');
    assert.equal(run('player.kit.ultPoints'), 0); assert.equal(run('netActions.filter(action=>action.type==="ability"&&action.key==="x").length'), 1);
    dispatchElement(document.getElementById('mobile-fire'), 'pointerdown', pausePointer);
    dispatchElement(document.getElementById('mobile-fire'), 'pointercancel', pausePointer);
    assert.equal(run('player.ammo'), 7, 'The first fresh touch shot must work normally after resume');
    keyDown('KeyR'); keyUp('KeyR'); assert.ok(run('reloading') > 0);
    keyDown('Digit3'); keyUp('Digit3'); assert.equal(run('inventory.active'), 'knife');
    keyDown('Space'); keyUp('Space'); assert.equal(run('player.vy'), 6.552);
    dispatchElement(document.getElementById('mobile-interact'), 'pointerdown', pausePointer); assert.equal(run('interactionHeld'), true);
    dispatchElement(document.getElementById('mobile-interact'), 'pointercancel', pausePointer); assert.equal(run('interactionHeld'), false);
    run('leaveOnline()'); cycleRun('leaveOnline()');
    // Joining during a paused first buy phase must defer, rather than lose, its character request.
    document.getElementById('agent-select').value='frost';
    run(movementSetup(false).replace('match.startLive();', ''));
    cycleRun(movementSetup(true).replace('match.startLive();', ''));
    cycleRun('netHostPaused=true'); pausedInputSnapshot();
    assert.equal(run('match.phase'), 'buy'); assert.equal(run('netActions.length'), 0);
    run("buy('vandal');buy('smoke')");
    assert.equal(run('netActions.length'), 0, 'Paused purchase clicks must not queue equipment for later');
    cycleRun('netHostPaused=false'); pausedInputSnapshot();
    assert.equal(run('netActions.filter(action=>action.type==="character"&&action.character==="frost").length'), 1, 'The chosen character must be requested once when the paused first-buy snapshot resumes');
    run('leaveOnline()'); cycleRun('leaveOnline()'); document.getElementById('agent-select').value='duelist'; run('startGame()');
    console.log('PASS: authoritative host pause clears existing guest holds, rejects keyboard/mouse/touch combat and resource spending, hides both target rings, and resumes fresh input');
  }

  // Two real human inputs share one defuse owner, including JSON observers and
  // release paths that turn a departed human seat back into an ordinary BOT.
  {
    const sharedDefuseSetup = host => movementSetup(host)
      .replace("{id:'friend',name:'FRIEND',team:'red',connected:true}", "{id:'friend',name:'FRIEND',team:'blue',connected:true},{id:'opponent',name:'OPPONENT',team:'red',connected:true}")
      .replace("$('starting-side').value='attack'", "$('starting-side').value='defend'");
    const setupSharedDefuse = (withBot = false) => {
      run('if(online)leaveOnline()'); cycleRun('if(online)leaveOnline()');
      run(sharedDefuseSetup(true)); cycleRun(sharedDefuseSetup(false)); cycleRun('netActionSequence=0');
      run(`clearCombatInput();player.x=-.7;player.z=-18;player.y=0;player.vy=0;player.hp=100;
        bots.forEach((bot,index)=>{bot.remoteId='shared-defuse-idle-'+index;bot.x=-35+index*3;bot.z=30;bot.y=0;bot.fire=999;bot.kit.ultPoints=0;});
        {const actor=bots.find(bot=>bot.id==='blue-1');actor.remoteId='friend';actor.x=.7;actor.z=-18;actor.y=0;}
        match.interactPlant(4,{actorId:'red-0',team:'red',site:'A',x:0,z:-18});handleMatchEvents();`);
      if (withBot) run("Object.assign(bots.find(bot=>bot.id==='blue-2'),{remoteId:null,x:0,z:-19.3,target:null})");
      positionSnapshot();
      assert.equal(cycleRun('player.id'), 'blue-1'); assert.equal(cycleRun('player.team'), 'blue');
      assert.equal(run('match.defenderTeam'), 'blue'); assert.equal(run('match.spike.status'), 'planted');
    };
    const guestDefuseHold = held => dispatchElement(cycleElements.get('mobile-interact'), held ? 'pointerdown' : 'pointercancel', { pointerId: 730, preventDefault() {} });
    const sharedDefuseFrames = (count, { host, guest, network = true, botGuard = false } = {}) => {
      if (host !== undefined) (host ? keyDown : keyUp)('KeyF');
      if (guest !== undefined) guestDefuseHold(guest);
      let packet;
      for (let frame = 0; frame < count; frame++) {
        if (network) {
          cycleRun('updatePlay(.05);tickOnline(.1)');
          sandbox.sharedDefuseInput = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
          run('receiveNetPacket("friend",sharedDefuseInput)');
        }
        run('updatePlay(.05)'); packet = positionSnapshot(); cycleRun('updateInteraction(0,true)');
        assert.equal(cycleRun('match.spike.defuseActor'), run('match.spike.defuseActor'), 'JSON guest snapshots must preserve the single authoritative defuse owner');
        assertNear(cycleRun('match.spike.defuseProgress'), run('match.spike.defuseProgress'), 'JSON peers must agree on one shared progress clock');
        if (botGuard && run('match.phase') === 'live') assert.equal(run("bots.find(bot=>bot.id==='blue-2').defusing"), false, 'A nearby BOT must cover an active human owner rather than join their defuse');
      }
      return packet;
    };
    setupSharedDefuse(true);
    sharedDefuseFrames(70, { host: true, guest: true, botGuard: true });
    assert.equal(run('match.spike.defuseActor'), 'player'); assertNear(run('match.spike.defuseProgress'), 3.5, 'Two held F inputs must contribute only3.5seconds in3.5seconds');
    assert.equal(run('match.spike.status'), 'planted');
    assert.match(cycleElements.get('interaction-title').textContent, /味方が電源オフ中/); assert.equal(cycleElements.get('mobile-interact-hint').textContent, '味方が電源オフ中');
    sharedDefuseFrames(69, { botGuard: true }); assert.equal(run('match.spike.status'), 'planted'); assertNear(run('match.spike.defuseProgress'), 6.95, 'Two players and a nearby BOT must not accelerate the seven-second defuse');
    const sharedDone = sharedDefuseFrames(1, { botGuard: true });
    assert.equal(sharedDone.rules.spike.status, 'defused'); assert.equal(run('match.phase'), 'post'); assert.equal(cycleRun('match.phase'), 'post');
    assert.equal(run('match.score.blue'), 1); assert.equal(cycleRun('match.score.blue'), 1); assert.equal(cycleElements.get('interaction').hidden, true);

    setupSharedDefuse();
    sharedDefuseFrames(1, { host: false, guest: true });
    sharedDefuseFrames(69, { host: true });
    assert.equal(run('match.spike.defuseActor'), 'blue-1'); assertNear(run('match.spike.defuseProgress'), 3.5, 'A guest who starts first must retain ownership when the host also holds F');
    assert.match(document.getElementById('interaction-title').textContent, /味方が電源オフ中/); assert.equal(document.getElementById('mobile-interact-hint').textContent, '味方が電源オフ中');
    sharedDefuseFrames(69); assert.equal(run('match.spike.status'), 'planted');
    sharedDefuseFrames(1); assert.equal(run('match.spike.status'), 'defused'); assert.equal(cycleRun('match.spike.status'), 'defused');

    setupSharedDefuse();
    sharedDefuseFrames(70, { host: false, guest: true });
    assert.equal(run('match.spike.checkpoint'), 3.5);
    sharedDefuseFrames(1, { host: false, guest: false });
    assert.equal(run('match.spike.defuseActor'), null); assert.equal(run('match.spike.defuseProgress'), 3.5);
    sharedDefuseFrames(69, { host: true });
    assert.equal(run('match.spike.status'), 'planted'); assertNear(run('match.spike.defuseProgress'), 6.95, 'The host replacement must still hold the remaining3.5seconds');
    sharedDefuseFrames(1); assert.equal(run('match.spike.status'), 'defused'); assert.equal(cycleRun('match.spike.status'), 'defused');

    for (const release of ['death', 'departure', 'fallback', 'missing-data', 'stale-input']) {
      setupSharedDefuse(); sharedDefuseFrames(70, { host: false, guest: true });
      if (release === 'death') run("damageEntity(bots.find(bot=>bot.id==='blue-1'),500,bots.find(bot=>bot.id==='red-0'))");
      if (release === 'departure') run("updateRoom({...online.room,members:online.room.members.filter(member=>member.id!=='friend')})");
      if (release === 'fallback') run("netInputs.get('friend').receivedAt=Date.now()-20001;updateRoom({...online.room,members:online.room.members.map(member=>({...member,connected:member.id!=='friend'}))})");
      if (release === 'missing-data') run("netInputs.delete('friend');updatePlay(.05)");
      if (release === 'stale-input') run('elapsed+=.81;updatePlay(.05)');
      assert.equal(run('match.spike.defuseActor'), null, `${release}: an unavailable remote owner must immediately release the lock`);
      assert.equal(run('match.spike.defuseProgress'), 3.5, `${release}: owner loss must retain the half-defuse checkpoint`);
      if (release === 'death') assert.equal(run("bots.find(bot=>bot.id==='blue-1').alive"), false);
      if (release === 'departure') assert.equal(run('netParticipants.has("friend")'), false);
      if (release === 'fallback') assert.equal(run("bots.find(bot=>bot.id==='blue-1').record.netFallback"), true);
      positionSnapshot(); assert.equal(cycleRun('match.spike.defuseActor'), null); assert.equal(cycleRun('match.spike.checkpoint'), 3.5);
      sharedDefuseFrames(69, { host: true, guest: false, network: false }); assert.equal(run('match.spike.status'), 'planted');
      sharedDefuseFrames(1, { network: false }); assert.equal(run('match.spike.status'), 'defused', `${release}: another defender must complete after the saved3.5seconds`);
    }
    setupSharedDefuse(); sharedDefuseFrames(70, { host: true, guest: false });
    run("damageEntity(player,500,bots.find(bot=>bot.id==='red-0'))");
    assert.equal(run('match.spike.defuseActor'), null); assert.equal(run('match.spike.checkpoint'), 3.5);
    sharedDefuseFrames(69, { host: false, guest: true }); assert.equal(run('match.spike.status'), 'planted');
    sharedDefuseFrames(1); assert.equal(run('match.spike.status'), 'defused', 'A guest must be able to take over from a dead host without losing the saved checkpoint');

    for (const kind of ['defuse', 'plant']) {
      setupSharedDefuse(); sharedDefuseFrames(1, { host: false, guest: true });
      run("netInputs.get('friend').receivedAt=Date.now()-20001;updateRoom({...online.room,members:online.room.members.map(member=>({...member,connected:member.id!=='friend'}))})");
      assert.equal(run("bots.find(bot=>bot.id==='blue-1').remoteId"), null);
      if (kind === 'defuse') run("match.interactDefuse(.4,{actorId:'blue-1',team:'blue'})");
      else run("match.startingSide='attack';match.resetSpike();match.spike.carrier='blue-1';match.interactPlant(.4,{actorId:'blue-1',team:'blue',site:'A',x:.7,z:-18})");
      const ownerField = kind === 'plant' ? 'plantActor' : 'defuseActor', progressField = kind === 'plant' ? 'plantProgress' : 'defuseProgress';
      for (let poll = 0; poll < 12; poll++) run('updateRoom(online.room)');
      assert.equal(run(`match.spike.${ownerField}`), 'blue-1', `Repeated fallback polls must not cancel the replacement BOT's new ${kind}`);
      assertNear(run(`match.spike.${progressField}`), .4, `Repeated fallback polls must retain the BOT's new ${kind} progress`);
      assert.equal(run("bots.find(bot=>bot.id==='blue-1').record.netFallback"), true);
    }
    cycleRun('leaveOnline()'); run('leaveOnline();startGame()');
    console.log('PASS: same-team desktop/touch simultaneous F has one owner and exact7s progress, guest-first ownership, half-checkpoint handover, JSON waiting HUD/result, BOT cover, death/leave/fallback/missing-data release and non-cancelling repeated BOT fallback polls');
  }

  run(movementSetup(true)); cycleRun(movementSetup(false));
  cycleRun('netActionSequence=0');
  run(`var hudRemote=bots.find(bot=>bot.id==='red-0');match.startingSide='defend';match.spike.carrier=hudRemote.id;
    hudRemote.record.primary='vandal';hudRemote.netWeapon='vandal';hudRemote.netAmmo=9;hudRemote.netReserve=17;hudRemote.kit.character='duelist';bots.forEach(bot=>bot.fire=999);`);
  positionSnapshot();
  const guestHUD = id => cycleElements.get(id);
  const relayHUDEquipment = () => {
    cycleRun('tickOnline(.1)'); sandbox.hudEquipmentInput = JSON.parse(JSON.stringify(cycleRun('online.sent.at(-1)')));
    run('receiveNetPacket("friend",hudEquipmentInput);updateRemoteActor(hudRemote,.05)'); positionSnapshot();
  };
  const equipGuestHUD = id => { cycleRun(`equip(${JSON.stringify(id)})`); relayHUDEquipment(); };
  equipGuestHUD('spike'); assertAmmoHUD(guestHUD, 'BOMBER', '—', '—');
  equipGuestHUD('knife'); assertAmmoHUD(guestHUD, 'TACTICAL KNIFE', '—', '—');
  equipGuestHUD('vandal'); assertAmmoHUD(guestHUD, 'VANDAL', 9, 17);
  run('hudRemote.netAmmo=0;hudRemote.netReserve=0'); positionSnapshot();
  assertAmmoHUD(guestHUD, 'VANDAL', 0, 0, /弾薬切れ.*持ち替え/);
  run('hudRemote.netReserve=11'); positionSnapshot(); assertAmmoHUD(guestHUD, 'VANDAL', 0, 11, /R\s+リロード/);
  cycleRun('reload()'); relayHUDEquipment(); assertAmmoHUD(guestHUD, 'VANDAL', 0, 11, /RELOADING/);
  equipGuestHUD('spike'); assertAmmoHUD(guestHUD, 'BOMBER', '—', '—');
  equipGuestHUD('knife'); assertAmmoHUD(guestHUD, 'TACTICAL KNIFE', '—', '—');
  run('hudRemote.kit.ultPoints=7'); positionSnapshot(); cycleRun('useAbility("x")'); relayHUDEquipment();
  assertAmmoHUD(guestHUD, 'BLADE STORM', 5, '∞');
  cycleRun('shoot()'); relayHUDEquipment(); assertAmmoHUD(guestHUD, 'BLADE STORM', 4, '∞');
  equipGuestHUD('vandal'); assertAmmoHUD(guestHUD, 'VANDAL', 0, 11, /R\s+リロード/);
  equipGuestHUD('knife'); assertAmmoHUD(guestHUD, 'BLADE STORM', 4, '∞');
  cycleRun('leaveOnline()'); run('leaveOnline();startGame()');
  console.log('PASS: guest equipment actions and JSON snapshots preserve ammo warnings and spike/melee/ultimate count distinctions');

  // Desktop and touch instructions must describe the same remaining interaction.
  const assertInteractionTime = (get, action, seconds, mobile) => {
    assert.ok(get('interaction-title').textContent.includes(`BOMBER ${action} 残り${seconds.toFixed(1)}秒`), get('interaction-title').textContent);
    assert.equal(get('mobile-interact-hint').textContent, mobile);
  };
  for (const practice of [false, true]) for (const kind of ['plant', 'defuse']) {
    document.getElementById('match-format').value = practice ? kind : 'standard';
    document.getElementById('starting-side').value = kind === 'plant' ? 'attack' : 'defend';
    run('startGame();clearBots()');
    if (!practice) run(`startRound();player.x=0;player.z=-18;${kind === 'defuse' ? 'match.interactPlant(4,{actorId:"red-0",team:"red",site:"A",x:0,z:-18});' : ''}`);
    const action = kind === 'plant' ? '設置' : '電源オフ', duration = kind === 'plant' ? 4 : 7;
    run('updateInteraction(0,true)'); assertInteractionTime(localHUD, action, duration, `${duration}秒長押し`);
    keyDown('KeyF'); run('updateInteraction(2,true)'); assertInteractionTime(localHUD, action, duration - 2, `${(duration - 2).toFixed(1)}秒`);
    keyUp('KeyF'); run('updateInteraction(0,true)'); assertInteractionTime(localHUD, action, duration, `${duration}秒長押し`);
    if (kind === 'defuse') {
      keyDown('KeyF'); run('updateInteraction(3.5,true)'); keyUp('KeyF'); run('updateInteraction(0,true)');
      assertInteractionTime(localHUD, action, 3.5, '残り3.5秒長押し');
      assert.match(localHUD('interaction-title').textContent, /半分まで保存済み/);
      assert.equal(localHUD('interaction-progress').style.width, '50%', 'The saved checkpoint must retain its full-seven-second progress scale');
      keyDown('KeyF'); run('updateInteraction(1.5,true)'); assertInteractionTime(localHUD, action, 2, '2.0秒');
      keyUp('KeyF'); run('updateInteraction(0,true)'); assertInteractionTime(localHUD, action, 3.5, '残り3.5秒長押し');
    }
    const savedProgress = run(kind === 'plant' ? 'match.spike.plantProgress' : 'match.spike.defuseProgress');
    for (const [height, velocity] of [[1.7, 0], [.3, 2], [1, 0]]) {
      run(`player.y=${height};player.vy=${velocity};interactionHeld=true;updateInteraction(.2,true)`);
      assert.match(localHUD('interaction-title').textContent, /地面に降りて/);
      assert.equal(localHUD('mobile-interact-hint').textContent, '地面に降りて');
      assert.equal(run(kind === 'plant' ? 'match.spike.plantProgress' : 'match.spike.defuseProgress'), savedProgress, 'Ground guidance must not alter interaction eligibility or saved progress');
    }
    run('player.y=0;player.vy=0;updateInteraction(.2,false)');
    assert.match(localHUD('interaction-title').textContent, /静止して/); assert.equal(localHUD('mobile-interact-hint').textContent, '止まって');
    run('updateInteraction(.5,true)'); assertInteractionTime(localHUD, action, duration - savedProgress - .5, `${(duration - savedProgress - .5).toFixed(1)}秒`);
    keyUp('KeyF');
  }
  for (const kind of ['plant', 'defuse']) {
    run(movementSetup(true)); cycleRun(movementSetup(false)); cycleRun('netActionSequence=0');
    run(`var hudObjectiveActor=bots.find(bot=>bot.id==='red-0');hudObjectiveActor.x=0;hudObjectiveActor.z=-18;hudObjectiveActor.y=0;
      match.startingSide='${kind === 'plant' ? 'defend' : 'attack'}';match.spike.carrier=${kind === 'plant' ? 'hudObjectiveActor.id' : '"player"'};
      ${kind === 'defuse' ? 'match.interactPlant(4,{actorId:"player",team:"blue",site:"A",x:0,z:-18});' : ''}`);
    positionSnapshot(); cycleRun('interactionHeld=true;updateInteraction(.7,true)');
    const action = kind === 'plant' ? '設置' : '電源オフ', duration = kind === 'plant' ? 4 : 7;
    assertInteractionTime(guestHUD, action, duration, `${duration.toFixed(1)}秒`);
    run(kind === 'plant' ? 'match.interactPlant(2,{actorId:hudObjectiveActor.id,team:"red",site:"A",x:0,z:-18})' : 'match.interactDefuse(3.5,{actorId:hudObjectiveActor.id,team:"red"})');
    positionSnapshot(); cycleRun('updateInteraction(0,true)');
    assertInteractionTime(guestHUD, action, kind === 'plant' ? 2 : 3.5, kind === 'plant' ? '2.0秒' : '3.5秒');
    cycleRun('updateInteraction(.7,true)');
    assertInteractionTime(guestHUD, action, kind === 'plant' ? 2 : 3.5, kind === 'plant' ? '2.0秒' : '3.5秒');
    assert.equal(cycleRun(kind === 'plant' ? 'match.spike.plantProgress' : 'match.spike.defuseProgress'), kind === 'plant' ? 2 : 3.5, 'Waiting for a guest ACK must not invent interaction progress');
    cycleRun('interactionHeld=false;updateInteraction(0,true)');
    assertInteractionTime(guestHUD, action, kind === 'plant' ? 4 : 3.5, kind === 'plant' ? '4秒長押し' : '残り3.5秒長押し');
    if (kind === 'defuse') {
      run('match.interactDefuse(1.5,{actorId:hudObjectiveActor.id,team:"red"})'); positionSnapshot();
      cycleRun('interactionHeld=true;updateInteraction(0,true)'); assertInteractionTime(guestHUD, action, 2, '2.0秒');
    }
    cycleRun('player.y=1.7;player.vy=0;interactionHeld=true;updateInteraction(.2,true)');
    assert.match(guestHUD('interaction-title').textContent, /地面に降りて/); assert.equal(guestHUD('mobile-interact-hint').textContent, '地面に降りて');
    cycleRun('leaveOnline()'); run('leaveOnline()');
  }
  document.getElementById('match-format').value = 'standard'; document.getElementById('starting-side').value = 'attack'; run('startGame()');
  console.log('PASS: matching desktop/touch plant and checkpoint remaining time, ground/movement guidance and snapshot-only guest countdowns');

  // Reproduce a real arena convoy: wait for escorts, lose the carrier, then recover and plant.
  // Opponents are absent so combat cannot disguise pathfinding or persistent body overlap.
  const botElements = new Map();
  const botDocument = { ...document, addEventListener() {}, querySelectorAll: () => [], getElementById(id) {
    if (!botElements.has(id)) botElements.set(id, makeElement(id));
    return botElements.get(id);
  } };
  const botContext = { ...sandbox, createMap, document: botDocument, window: { addEventListener() {} } };
  vm.createContext(botContext);
  vm.runInContext(runnable, botContext, { filename: 'game-bot-routing.js' });
  const botRun = code => vm.runInContext(code, botContext);
  botRun('var routeSeed=29;Math.random=()=>((routeSeed=(routeSeed*1664525+1013904223)>>>0)/4294967296);startGame();startRound();bots.filter(b=>b.team==="red").forEach(b=>b.alive=false)');
  const carrierOrigin = [botRun('player.x'), botRun('player.z')];
  botRun('for(let frame=0;frame<600;frame++){elapsed+=.05;updateBots(.05)}');
  assert.deepEqual([botRun('player.x'), botRun('player.z')], carrierOrigin, 'Crowd separation must never push a stationary player');
  botRun('player.alive=false;match.dropSpike("player",player.x,player.z)');
  const convoy = JSON.parse(botRun(`(()=>{
    const streaks={};let minimumDistance=Infinity,maximumOverlap=0,plantedAfter=null;
    for(let frame=0;frame<900;frame++){
      elapsed+=.05;updateBots(.05);
      if(plantedAfter===null&&match.spike.status==='planted')plantedAfter=(frame+1)*.05;
      const allies=bots.filter(bot=>bot.alive&&bot.team==='blue');
      for(let i=0;i<allies.length;i++)for(let j=i+1;j<allies.length;j++){
        const key=allies[i].id+'/'+allies[j].id,distance=Math.hypot(allies[i].x-allies[j].x,allies[i].z-allies[j].z);
        minimumDistance=Math.min(minimumDistance,distance);
        streaks[key]=distance<.55?(streaks[key]||0)+.05:0;
        maximumOverlap=Math.max(maximumOverlap,streaks[key]);
      }
    }
    return JSON.stringify({minimumDistance,maximumOverlap,plantedAfter,status:match.spike.status});
  })()`));
  assert.equal(convoy.status, 'planted', 'Surviving bots must recover a dead carrier\'s spike and finish planting');
  assert.ok(convoy.plantedAfter > 4 && convoy.plantedAfter < 40, `Carrier recovery and the arena approach must stay practical, took ${convoy.plantedAfter}s`);
  assert.ok(convoy.minimumDistance >= .65, `Escort bodies must remain separated instead of merging (${convoy.minimumDistance.toFixed(3)}m)`);
  assert.ok(convoy.maximumOverlap <= .25, `Convoy escorts must not remain merged for ${convoy.maximumOverlap.toFixed(2)} seconds`);
  console.log(`PASS: real-arena carrier recovery and bot planting in ${convoy.plantedAfter.toFixed(2)}s; minimum escort spacing ${convoy.minimumDistance.toFixed(2)}m`);

  botRun(`online={host:true,session:{memberId:'host'},room:{code:'TESTROOM',hostId:'host',status:'playing',settings:{format:'swift'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},send(){},close(){}};
    onlinePlaying=true;mode='menu';startGame();const fallbackRecord=roster.find(r=>r.id==='red-0');fallbackRecord.kit.smoke=2;fallbackRecord.kit.updraft=1;fallbackRecord.kit.ultPoints=3;
    updateRoom({...online.room,members:online.room.members.map(m=>({...m,connected:m.id!=='friend'}))});
    fallbackRecord.credits=5000;match.round=2;spawnRound(false);const fallbackActor=bots.find(b=>b.id==='red-0');`);
  assert.equal(botRun('fallbackActor.remoteId'), null, 'A temporary BOT must stay active across a new round');
  assert.equal(botRun('fallbackRecord.memberId'), 'friend');
  assert.equal(botRun('fallbackActor.kit===fallbackRecord.kit'), true);
  assert.equal(botRun('fallbackActor.kit.smoke'), 2); assert.equal(botRun('fallbackActor.kit.updraft'),botRun('getCharacterSkill(fallbackActor.kit.character,"q").max'),'An adequately funded fallback BOT preserves its unused Q and purchases any newly available second charge'); assert.equal(botRun('fallbackActor.kit.ultPoints'), 3);
  assert.ok(botRun('fallbackRecord.primary'), 'A temporary BOT must buy equipment while retaining its human membership');
  const fallbackOrigin = [botRun('fallbackActor.x'), botRun('fallbackActor.z')];
  botRun(`match.startLive();for(let frame=0;frame<40;frame++){elapsed+=.05;updateBots(.05)}`);
  assert.ok(Math.hypot(botRun('fallbackActor.x') - fallbackOrigin[0], botRun('fallbackActor.z') - fallbackOrigin[1]) > 1, 'A disconnected guest seat must really run AI, not remain an idle remote actor');
  botRun(`updateRoom({...online.room,members:online.room.members.map(m=>({...m,connected:true}))});`);
  assert.equal(botRun('fallbackActor.remoteId'), 'friend'); assert.equal(botRun('bots.length'), 9, 'Returning control must not insert a duplicate character');
  console.log('PASS: disconnected seats retain membership, kit and BOT purchases across rounds, run AI and reclaim the same character');

  // Load real game code in fresh contexts so saved settings cannot inherit values from this match.
  function settingsProbe(saved) {
    const probeElements = new Map(), savedWrites = [];
    const probeDocument = { ...document, addEventListener() {}, querySelectorAll: () => [], getElementById(id) {
      if (!probeElements.has(id)) probeElements.set(id, makeElement(id));
      return probeElements.get(id);
    } };
    const probeContext = { ...sandbox, document: probeDocument, window: { addEventListener() {} }, localStorage: {
      getItem: () => saved === undefined ? null : JSON.stringify(saved),
      setItem: (key, value) => savedWrites.push({ key, value: JSON.parse(value) }),
    } };
    vm.createContext(probeContext);
    vm.runInContext(runnable, probeContext, { filename: 'game-settings.js' });
    return { read: expression => vm.runInContext(expression, probeContext), elements: probeElements, savedWrites };
  }
  assert.equal(settingsProbe().read('sensitivity'), .35, 'Fresh settings must use the reduced sensitivity');
  const legacy = settingsProbe({ sensitivity: 1, volume: .6 });
  assert.equal(legacy.read('sensitivity'), .35, 'Previously saved sensitivity 1.0 must migrate to the reduced scale');
  assert.equal(legacy.read('volume'), .6, 'Sensitivity migration must preserve the saved volume');
  assertNear(settingsProbe({ sensitivity: .8 }).read('sensitivity'), .28, 'Legacy custom sensitivity must migrate proportionally');
  assert.equal(settingsProbe({ sensitivity: .8, lookVersion: 2 }).read('sensitivity'), .8, 'New-scale settings must not migrate again');
  assert.equal(settingsProbe({ sensitivity: .001, lookVersion: 2 }).read('sensitivity'), .05, 'Saved sensitivity must respect the new lower bound');
  assert.equal(settingsProbe({ sensitivity: 99, lookVersion: 2 }).read('sensitivity'), 1.5, 'Saved sensitivity must respect the new upper bound');
  assert.equal(settingsProbe({ sensitivity: 'invalid', lookVersion: 2 }).read('sensitivity'), .35, 'Corrupt saved sensitivity must not poison the camera');
  dispatchElement(legacy.elements.get('sensitivity'), 'input', { target: { value: '.6' } });
  const savedLook = legacy.savedWrites.at(-1);
  assert.equal(savedLook.key, 'hashimoto-settings');
  assert.equal(savedLook.value.sensitivity, .6);
  assert.equal(savedLook.value.lookVersion, 2, 'Changed sensitivity must persist its scale version to prevent double migration');
  assert.equal(savedLook.value.volume, .6);
  console.log('PASS: sensitivity defaults, legacy migration, bounds, invalid settings, and versioned persistence');

  const htmlPath = ['public/play.html', 'public/index.html', 'public/game.html'].map(p => path.join(__dirname, p)).find(p => fs.existsSync(p));
  assert.ok(fs.existsSync(htmlPath), 'Game entry page must exist');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const sensitivityInput = html.match(/<input\b[^>]*\bid=["']sensitivity["'][^>]*>/)?.[0];
  assert.ok(sensitivityInput, 'Pause settings must expose the sensitivity control');
  for (const [attribute, expected] of [['min', '.05'], ['max', '1.5'], ['step', '.01'], ['value', '.35']]) {
    const value = sensitivityInput.match(new RegExp(`\\b${attribute}=["']([^"']+)["']`))?.[1];
    assert.equal(Number(value), Number(expected), `Sensitivity slider ${attribute} must match the new scale`);
  }
  const htmlIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  assert.equal(new Set(htmlIds).size, htmlIds.length, 'HTML element IDs must be unique');
  const gameIds = [...gameSource.matchAll(/\$\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
  for (const id of new Set(gameIds)) assert.ok(htmlIds.includes(id), `Game UI requires #${id}`);
  for (const id of elements.keys()) assert.ok(htmlIds.includes(id), `A rendered game state requires #${id}`);
  for (const reference of html.matchAll(/(?:src|href)=["']([^"'#]+)["']/g)) {
    if (/^(https?:|data:)/.test(reference[1])) continue;
    assert.ok(fs.existsSync(path.resolve(__dirname, 'public', reference[1].replace(/^\/+/, ''))), `Missing local asset ${reference[1]}`);
  }
  console.log('PASS: HTML/game controls and local asset references');
  const cpu = process.cpuUsage(cpuStarted);
  console.log(`TOTAL: ${(performance.now() - testStarted).toFixed(0)}ms wall, ${((cpu.user + cpu.system) / 1000).toFixed(0)}ms CPU`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
