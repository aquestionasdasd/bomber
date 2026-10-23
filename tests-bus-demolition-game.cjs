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







 const local=harness({realMap:true});
 function setup(){local.reset();local.run("selectArena('hirakata');resetTraffic();elapsed=10;match.phase='live';var g=map.destruction.groups.find(g=>g.id==='mid-column-13'),p={x:-20,z:13,yaw:0};");}
 check('actual full body removes a pillar only for a moving host-owned bus; no guest prediction',()=>{
  setup();assert.equal(local.run('busCanDrive(p,p)'),false);assert.equal(local.run("busCanDrive(p,p,{owner:player.id,speed:.4})"),false);assert.equal(local.run('map.destruction.snapshot()'),'');
  assert.equal(local.run("busCanDrive(p,p,{owner:player.id,speed:4})"),true);assert.equal(local.run('map.collision.blocked(-20,13,.1,0)'),false);assert.ok(local.run('map.destruction.snapshot()'));assert.ok(local.run('g.nodes.every(o=>!o.visible)'));
  local.run("resetTraffic();onlinePlaying=true;online={host:false}");assert.equal(local.run("busCanDrive(p,p,{owner:player.id,speed:4})"),false);assert.equal(local.run('map.destruction.snapshot()'),'');
 });
 check('station body can break; arena bounds block before destruction and lifecycle restores all bays',()=>{
  setup();assert.equal(local.run("busCanDrive({x:0,z:10,yaw:0},p,{owner:player.id,speed:17})"),true);assert.ok(local.run('map.destruction.snapshot()'));local.run('resetTraffic()');assert.equal(local.run("busCanDrive({x:81,z:60,yaw:0},p,{owner:player.id,speed:17})"),false);
  for(const action of['spawnRound()','backMenu()',"selectArena('hashimoto');selectArena('hirakata')"]){setup();local.run("busCanDrive(p,p,{owner:player.id,speed:4});"+action);assert.equal(local.run('map.destruction.snapshot()'),'');assert.equal(local.run('map.colliders.length'),797);}
 });
 check('actual bus collision sweep opens a continuous path through a pillar at20/60/144Hz',()=>{
  for(const hz of[20,60,144]){setup();local.sandbox.hz=hz;local.run("var z=25;for(var i=0;i<hz*2;i++){var next={x:-20,z:z-12/hz,yaw:Math.PI};if(busCanDrive(next,{x:-20,z,yaw:Math.PI},{owner:player.id,speed:12}))z=next.z;}");assert.ok(local.run('z<8'));assert.equal(local.run('map.collision.blocked(-20,13,.1,0)'),false);}
 });
 check('hidden demolished signs/instances cannot keep blocking real firearm rays',()=>{
  setup();local.run("environment.updateMatrixWorld(true);var ray=new THREE.Raycaster(new THREE.Vector3(-20,1.9,16),new THREE.Vector3(0,0,-1),0,4);var before=ray.intersectObjects(g.nodes,true).length;busCanDrive(p,p,{owner:player.id,speed:4});environment.updateMatrixWorld(true);var demolitionHits=ray.intersectObjects(g.nodes,true).filter(busSurfaceVisible)");assert.ok(local.run('before>0'));assert.equal(local.run('demolitionHits.length'),0);
 });
 check('host compact damage mask survives full JSON; fresh reconnect no blast, later changes play once',()=>{
  setup();const guest=harness({realMap:true});local.run("makeBot({x:0,z:60},0,'red',{id:'red-0',team:'red',primary:null,secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var remote=bots[0];remote.id='red-0';remote.remoteId='guest';roster=[roster[0],remote.record];onlinePlaying=true;online={host:true,room:{code:'BUSROOM1'},session:{memberId:'host',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest','red-0');busCanDrive(p,p,{owner:player.id,speed:4});netClock=0;tickOnline(.1)");
  guest.reset();guest.run("selectArena('hirakata');onlinePlaying=true;online={host:false,room:{code:'BUSROOM1'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-0')");guest.sandbox.transfer=copy(local.run('captured'));guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('map.destruction.snapshot()'),local.run('map.destruction.snapshot()'));assert.equal(guest.run('map.colliders.length'),local.run('map.colliders.length'));assert.ok(guest.run('map.destruction.fx.children.every(o=>o.count===0)'));
  const oldTime=guest.run('elapsed'),oldMask=guest.run('map.destruction.snapshot()');guest.sandbox.bad=copy(local.run('captured'));guest.sandbox.bad.seq++;guest.sandbox.bad.time++;guest.sandbox.bad.busDamage='oops';guest.run("receiveNetPacket('host',bad)");assert.equal(guest.run('elapsed'),oldTime);assert.equal(guest.run('map.destruction.snapshot()'),oldMask);
  local.run("elapsed+=.1;var h=map.destruction.groups.find(g=>g.id==='mid-column--13');var at={x:-20,z:-13,yaw:0};map.destruction.breakAt(at,at,elapsed);netClock=0;tickOnline(.1)");guest.sandbox.transfer=copy(local.run('captured'));guest.sandbox.transfer.seq+=2;guest.run("receiveNetPacket('host',transfer)");assert.ok(guest.run('map.destruction.fx.children[0].count>0'));const count=guest.run('map.destruction.fx.children[0].count');guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('map.destruction.fx.children[0].count'),count);
  local.run('spawnRound();netClock=0;tickOnline(.1)');guest.sandbox.transfer=copy(local.run('captured'));guest.sandbox.transfer.seq+=3;guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('map.destruction.snapshot()'),'');assert.equal(guest.run('map.colliders.length'),797);assert.ok(guest.run('map.destruction.fx.children.every(o=>o.count===0)'));
 });
 console.log('PASS '+groups+' actual demolition groups; silent');
}main().catch(e=>{console.error(e);process.exitCode=1;});
