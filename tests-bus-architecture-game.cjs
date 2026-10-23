const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

// Execute the saved game in separate host/guest JavaScript worlds. Rendering,
// timers and audio are inert; map collision, shots, actors and net code are real.
async function main() {
  const started = performance.now(), cpuStarted = process.cpuUsage();
  const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);
  const THREE = await load('vendor/three.module.js');
  const imported = {}, source = fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8');
  for (const declaration of source.matchAll(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/gm)) {
    const module = await load(declaration[2]);
    for (const binding of declaration[1].split(',')) {
      const [name, alias] = binding.trim().split(/\s+as\s+/); imported[alias || name] = module[name];
    }
  }
  Object.assign(imported, await load('abilities.js'));
  const { createCollisionIndex } = await load('collision.js');
  const actualCreateMap = imported.createMap;
  let groups = 0;
  const check = (label, fn) => { fn(); groups++; console.log(`PASS: ${label}`); };
  const near = (a, b, label, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${label}: ${a} != ${b}`);
  const copy = value => JSON.parse(JSON.stringify(value));

  function harness({ realMap = false } = {}) {
    const elements = new Map(), listeners = new Map();
    const context2d = new Proxy({ measureText: text => ({ width: String(text).length * 8 }),
      createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) },
    { get: (target, key) => target[key] || (() => {}) });
    const element = id => ({ id, hidden: false, textContent: '', width: 240, height: 240, children: [],
      value: id === 'difficulty' ? 'normal' : '', attributes: {}, dataset: {},
      style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, setAttribute(name, value) { this.attributes[name] = value; }, setPointerCapture() {},
      requestPointerLock() {}, getContext: () => context2d,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      replaceChildren(...nodes) { this.children = nodes; for (const node of nodes) node.parentNode = this; },
      append(node) { this.children.push(node); node.parentNode = this; },
      prepend(node) { this.children.unshift(node); node.parentNode = this; },
      get lastElementChild() { return this.children.at(-1); },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); },
    });
    const document = { hidden: false, pointerLockElement: null, createElement: element,
      getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); },
      addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); },
      querySelectorAll: () => [], exitPointerLock() { this.pointerLockElement = null; } };
    global.document = document;
    function fixtureMap() {
      const colliders = [];
      return { colliders, collision: createCollisionIndex(colliders),
        bounds: { minX: -82, maxX: 82, minZ: -82, maxZ: 82 }, spawn: { x: 0, z: 26 },
        spawnYaw: { attack: 0, defend: Math.PI },
        teamSpawns: { attack: [{ x: 0, z: 26 }, { x: -2, z: 28 }, { x: 2, z: 28 }, { x: -4, z: 30 }, { x: 4, z: 30 }],
          defend: [{ x: -9, z: -16 }, { x: -3, z: -23 }, { x: 0, z: -29 }, { x: 3, z: -23 }, { x: 9, z: -16 }] },
        buyAreas: { attack: { x: 0, z: 26, radius: 9 }, defend: { x: 0, z: -23, radius: 18 } },
        sites: [{ id: 'A', x: -28, z: -25, radius: 5 }, { id: 'B', x: 35, z: -20, radius: 5 }],
        zones: [], mapShapes: [], ramps: [], landmarks: [] };
    }
    class Renderer {
      constructor() { this.shadowMap = {}; this.info = { render: { calls: 0 } }; this.capabilities = { getMaxAnisotropy: () => 8 }; }
      setPixelRatio() {} setSize() {} render() {} getContext() { return {}; }
    }
    const sandbox = { ...imported, THREE: { ...THREE, WebGLRenderer: Renderer },
      createMap: realMap ? actualCreateMap : fixtureMap, document,
      // Never instantiate AudioContext or fetch/decode/play any recording.
      createGameAudio: () => ({ init() {}, play() {}, unlock() {}, resume() {}, setVolume() {}, dispose() {} }),
      window: { addEventListener() {} }, navigator: { maxTouchPoints: 0 }, matchMedia: () => ({ matches: false }),
      localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => 0 },
      devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900,
      setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame() {},
      HTMLInputElement: class {}, HTMLSelectElement: class {}, HTMLTextAreaElement: class {}, console };
    vm.createContext(sandbox);
    vm.runInContext(source.replace(/^import .*;\r?\n/gm, ''), sandbox, { filename: 'saved-game.js' });
    const run = code => vm.runInContext(code, sandbox);
    function reset() {
      run(`online=null;onlinePlaying=false;mode='menu';$('agent-select').value='nope';$('match-format').value='standard';
        startGame();startRound();clearBots();resetOrdinarySkills();elapsed=10;
        Object.assign(player,{x:0,y:0,z:0,vy:0,yaw:0,pitch:0,hp:100,armor:0,alive:true,crouch:0,vx:0,vz:0,recoil:0});
        inventory={primary:null,secondary:'classic',active:'classic'};equip('classic',true);
        player.kit=new DuelistKit({character:'nope'});lastShot=-10;shotSequence=0;renderedRecoil=0;
        Math.random=()=>.5;reloading=0;interactionHeld=false;netHostPaused=false;`);
    }
    function seed(team = 'red', x = 0, z = -5, y = 0) {
      sandbox.seed = { team, x, y, z };
      return run(`ordinarySkills.cast('nope-decoy',{id:'caster-'+seed.team,team:seed.team,x:seed.x,y:seed.y,z:seed.z,hp:100,alive:true},seed,elapsed,match.round)`);
    }
    function wall({ x = 0, z = -2, width = 5, depth = .25, height = 3 } = {}) {
      sandbox.wallSpec = { x, z, width, depth, height };
      return run(`(()=>{const {x,z,width,depth,height}=wallSpec;
        const c={minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2,height};map.colliders.push(c);
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),new THREE.MeshBasicMaterial());
        mesh.position.set(x,height/2,z);mesh.userData.solid=true;environment.add(mesh);environment.updateMatrixWorld(true);return mesh;})()`);
    }
    const clearWalls = () => run('environment.clear();map.colliders.length=0;map.collision=createCollisionIndex(map.colliders)');
    sandbox.createCollisionIndex = createCollisionIndex;
    return { sandbox, run, seed, wall, clearWalls, reset, elements };
  }








 const host=harness({realMap:true});
 function setup(){host.reset();host.run("selectArena('hirakata');resetTraffic();elapsed=10;match.phase='live';var p={x:8,z:9,yaw:0};");}
 check('only a moving host-owned bus can breach a station wall and its ceiling',()=>{
  setup();assert.equal(host.run('busCanDrive(p,p)'),false);assert.equal(host.run('busCanDrive(p,p,{owner:player.id,speed:.4})'),false);assert.equal(host.run('map.destruction.snapshot()'),'');
  assert.equal(host.run('busCanDrive(p,p,{owner:player.id,speed:4})'),true);assert.equal(host.run('map.collision.blocked(8,9,.34,0)'),false);assert.equal(host.run('getZoneFloor(8,9,5.1)'),0);
  setup();host.run('onlinePlaying=true;online={host:false}');assert.equal(host.run('busCanDrive(p,p,{owner:player.id,speed:4})'),false);assert.equal(host.run('map.destruction.snapshot()'),'');
 });
 check('upper-floor player and BOT fall continuously after the supporting ceiling collapses at20/60/144Hz',()=>{
  for(const hz of[20,60,144]){setup();host.sandbox.hz=hz;host.run("Object.assign(player,{x:8,z:9,y:5.02,vy:0});var actor={x:10,z:9,y:5.02,vy:0,crouch:0,alive:true,hp:100,team:'red',id:'falling'};var yBefore=player.y;busCanDrive(p,p,{owner:player.id,speed:8});var y0=player.y;updateActorVertical(player,1/hz);var y1=player.y;for(var i=0;i<hz*2;i++){updateActorVertical(player,1/hz);updateActorVertical(actor,1/hz)}");assert.equal(host.run('y0'),5.02);assert.ok(host.run('y1<y0&&y1>4.95'));assert.equal(host.run('player.y'),0);assert.equal(host.run('actor.y'),0);}
 });
 check('destroyed staircase loses its analytic ramp support and restores on next round',()=>{
  setup();host.run("var r=map.ramps[0],x=(r.minX+r.maxX)/2,z=(r.minZ+r.maxZ)/2;var y=rampFloor(x,z);var at={x,z,yaw:0};busCanDrive(at,at,{owner:player.id,speed:5})");assert.ok(host.run('y>2'));assert.equal(host.run('rampFloor(x,z)'),null);host.run('spawnRound()');assert.ok(host.run('rampFloor(x,z)>2'));assert.equal(host.run('map.destruction.snapshot()'),'');
 });
 check('swept driving clears solid retail into the indoor route without teleporting at20/60/144Hz',()=>{
  for(const hz of[20,60,144]){setup();host.sandbox.hz=hz;host.run("var z=27,maxStep=0;for(var i=0;i<hz*3;i++){var next={x:8,z:z-12/hz,yaw:Math.PI};if(busCanDrive(next,{x:8,z,yaw:Math.PI},{owner:player.id,speed:12})){maxStep=Math.max(maxStep,Math.abs(next.z-z));z=next.z}};");assert.ok(host.run('z<-8'));assert.ok(host.run('maxStep<=12/hz+1e-7'));}
  setup();assert.equal(host.run('busCanDrive({x:81,z:60,yaw:0},p,{owner:player.id,speed:17})'),false);assert.equal(host.run('map.destruction.snapshot()'),'');
 });
 check('actual firearm rays no longer hit collapsed wall/roof meshes while adjacent bays stay solid',()=>{
  setup();host.run("environment.updateMatrixWorld(true);var ray=new THREE.Raycaster(new THREE.Vector3(8,1.7,1),new THREE.Vector3(0,0,1),0,13);var before=ray.intersectObject(environment,true).filter(busSurfaceVisible).length;busCanDrive(p,p,{owner:player.id,speed:5});environment.updateMatrixWorld(true);var after=ray.intersectObject(environment,true).filter(busSurfaceVisible).length");assert.ok(host.run('before>0'));assert.equal(host.run('after'),0);assert.equal(host.run('map.collision.rayClear(55,1.7,0,55,1.7,12)'),false);assert.equal(host.run('map.collision.blocked(55,9,.34,0)'),true);
 });
 check('full structural destruction survives independent host/guest JSON, rejects corruption and restores next round',()=>{
  setup();const guest=harness({realMap:true});host.run("makeBot({x:0,z:60},0,'red',{id:'red-0',team:'red',primary:null,secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var remote=bots[0];remote.id='red-0';remote.remoteId='guest';roster=[roster[0],remote.record];onlinePlaying=true;online={host:true,room:{code:'BUSROOM1'},session:{memberId:'host',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest','red-0');for(var g of map.destruction.groups)for(var b of g.bounds){var at={x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2,yaw:0};map.destruction.breakAt(at,at,elapsed)}netClock=0;tickOnline(.1)");
  guest.reset();guest.run("selectArena('hirakata');onlinePlaying=true;online={host:false,room:{code:'BUSROOM1'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-0')");guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('map.destruction.snapshot()'),host.run('map.destruction.snapshot()'));assert.equal(guest.run('map.colliders.length'),0);assert.equal(guest.run('map.ramps.length'),0);assert.ok(guest.run('map.destruction.fx.children.every(o=>o.count===0)'));assert.ok(Buffer.byteLength(JSON.stringify(host.run('captured')))<65536);
  guest.sandbox.bad=copy(host.run('captured'));guest.sandbox.bad.seq++;guest.sandbox.bad.time++;guest.sandbox.bad.busDamage='f'.repeat(66);const time=guest.run('elapsed');guest.run("receiveNetPacket('host',bad)");assert.equal(guest.run('elapsed'),time);guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('map.colliders.length'),0);
  host.run('spawnRound();netClock=0;tickOnline(.1)');guest.sandbox.transfer=copy(host.run('captured'));guest.sandbox.transfer.seq+=3;guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('map.destruction.snapshot()'),'');assert.equal(guest.run('map.colliders.length'),797);assert.equal(guest.run('map.ramps.length'),4);
 });
 console.log('PASS '+groups+' actual architectural bus demolition groups; silent');
}main().catch(e=>{console.error(e);process.exitCode=1;});
