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
 function setup(){local.reset();local.run("$('map-select').value='hirakata';mode='menu';startGame();startRound();clearBots();elapsed=10;Object.assign(player,{hp:100,armor:0,alive:true,y:0,vy:0,vx:0,vz:0});player.kit=new DuelistKit({character:'nope'});map.traffic.reset();");}
 check('saved game switches actual collision/navigation/raycast worlds and maps survive return/restart',()=>{setup();assert.equal(local.run('map.id'),'hirakata');assert.equal(local.run('environment.children.length'),1);assert.ok(local.run('navigation.isWalkable(-23,0)'));local.run("mode='menu';$('map-select').value='hashimoto';startGame()");assert.equal(local.run("map.id||'hashimoto'"),'hashimoto');assert.equal(local.run('environment.children.length'),1);assert.equal(local.run('map.traffic'),undefined);setup();assert.equal(local.run('arenaCache.size'),2);});
 check('100 real damage uses death/drop flow, swept hit launches and cannot damage twice',()=>{setup();local.run("var bus=map.traffic.poses(elapsed).find(p=>p.speed>.5);player.x=bus.x;player.z=bus.z;match.spike={...match.spike,status:'carried',carrierId:player.id};updateTraffic(.05)");assert.equal(local.run('player.hp'),0);assert.equal(local.run('player.alive'),false);assert.ok(local.run('player.trafficLaunch.vy>5'));assert.ok(local.run('player.y>0'));assert.ok(local.run('match.spike.status')!=='carried');const id=local.run('player.trafficLaunch.seq');local.run('elapsed+=.05;updateTraffic(.05)');assert.equal(local.run('player.trafficLaunch.seq'),id);assert.ok(local.run('player.y>0'));});
 check('armor uses existing damage formula, vertical bus immunity, buy immunity and boundary-safe landing',()=>{setup();local.run("var bus=map.traffic.poses(elapsed).find(p=>p.speed>.5);Object.assign(player,{x:bus.x,z:bus.z,y:5.02});updateTraffic(.05)");assert.equal(local.run('player.hp'),100);local.run("player.y=0;match.phase='buy';elapsed+=.05;updateTraffic(.05)");assert.equal(local.run('player.hp'),100);local.run("match.phase='live';player.armor=50;map.traffic.reset();bus=map.traffic.poses(elapsed).find(p=>p.speed>.5);player.x=bus.x;player.z=bus.z;updateTraffic(.05)");assert.ok(local.run('player.hp>0&&player.hp<100'));local.run('for(var t=0;t<60;t++){elapsed+=.05;updateActorVertical(player,.05);updateTraffic(.05)}');assert.ok(local.run('player.x>=-82&&player.x<=82&&player.z>=-82&&player.z<=82'));assert.equal(local.run('player.y'),0);});
 check('bus hides actors from BOT sight and leaves clear upper sight; safe wait is map-local',()=>{setup();local.run("var bus=map.traffic.poses(elapsed).find(p=>p.speed>.5);var a={x:bus.x+Math.cos(bus.yaw)*5,y:0,z:bus.z-Math.sin(bus.yaw)*5};var b={x:bus.x-Math.cos(bus.yaw)*5,y:0,z:bus.z+Math.sin(bus.yaw)*5}");assert.equal(local.run('map.traffic.rayClear({...a,y:1.4},{...b,y:1.4},elapsed)'),false);assert.equal(local.run('map.traffic.rayClear({...a,y:5},{...b,y:5},elapsed)'),true);assert.ok(local.run('map.traffic.dangerous(bus.x,bus.z,elapsed)'));});
 check('2F practice travel lands on supported actual floor and can walk through stair door',()=>{setup();assert.ok(local.run("relocate(map.landmarks.find(p=>p.id==='upper'))"));near(local.run('player.y'),5.02,'upper travel');local.run('for(var i=0;i<50;i++)updateActorVertical(player,.05)');near(local.run('player.y'),5.02,'floor support');local.run("Object.assign(player,{x:-58,y:5.02,z:20,vy:0});moveEntity(player,0,-3)");assert.ok(local.run('player.z<19'));});
 check('all four staircases ascend by real treads, descend and remain blocked to ground-only BOT paths',()=>{setup();local.run('for(var r of map.ramps){var x=(r.minX+r.maxX)/2,up=r.direction===1,from=up?r.minZ-.3:r.maxZ+.3;Object.assign(player,{x,z:from,y:0,vy:0});for(var i=0;i<330;i++){moveEntity(player,0,up?.05:-.05);updateActorVertical(player,.01);}if(Math.abs(player.y-5.02)>.05)throw Error("stair ascent "+player.y);for(var i=0;i<350;i++){moveEntity(player,0,up?-.05:.05);updateActorVertical(player,.01);}for(var i=0;i<60;i++)updateActorVertical(player,.01);if(player.y>.05)throw Error("stair descent "+player.y);if(navigation.isWalkable(x,(r.minZ+r.maxZ)/2))throw Error("BOT walks through stair mass");}');});
 check('independent hostguest JSON uses host-selected map; HP once, launch ACK and old/wrong map rejection',()=>{
  const host=local,guest=harness({realMap:true});setup();host.run("makeBot({x:0,z:-60},0,'red',{id:'red-0',team:'red',primary:null,secondary:'classic',armor:50,credits:800,kit:new DuelistKit({character:'nope'})});var remote=bots[0];remote.id='red-0';remote.remoteId='guest';remote.netWeapon='classic';remote.netAmmo=12;remote.netReserve=36;remote.hp=100;remote.armor=50;var bus=map.traffic.poses(elapsed).find(p=>p.speed>.5);remote.x=bus.x;remote.z=bus.z;updateTraffic(.05);onlinePlaying=true;online={host:true,session:{memberId:'host',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netClock=0;netApplied.clear();tickOnline(.1)");
  guest.reset();guest.run("selectArena('hirakata');onlinePlaying=true;online={host:false,room:{code:'TESTMAP1'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-0')");guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('player.hp'),host.run('remote.hp'));assert.ok(guest.run('player.trafficLaunch'));near(guest.run('player.y'),host.run('remote.y'),'ACK height');guest.run('receiveNetPacket(\'host\',transfer)');assert.equal(guest.run('player.hp'),host.run('remote.hp'));
  guest.sandbox.wrong={...copy(host.run('captured')),mapId:'hashimoto',seq:999,time:1000};const before=guest.run('elapsed');guest.run('receiveNetPacket(\'host\',wrong)');assert.equal(guest.run('elapsed'),before);
  host.run('elapsed+=.1;netClock=0;tickOnline(.1)');guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer)");near(guest.run('elapsed'),host.run('elapsed'),'wrong-map high sequence cannot poison next valid packet');
  host.run("netInputs.set('guest',{seq:1,round:match.round,connection:'legacy',received:elapsed,receivedAt:Date.now(),input:{x:remote.x,z:remote.z,y:100,yaw:0,pitch:0},actions:[]});updateRemoteActor(remote,.05)");assert.ok(host.run('remote.y<5'));host.run("Object.assign(remote,{x:81,z:60,y:0,vy:0});syncDrops([{id:900,weapon:'forge',x:81,z:60,yaw:0,ammo:51,reserve:92},{id:901,weapon:'atlas',x:105,z:37,yaw:0,ammo:2,reserve:4}]);elapsed+=.1;netClock=0;tickOnline(.1)");guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer)");near(guest.run('player.x'),81,'unchanged combat pose');assert.equal(guest.run('droppedWeapons.length'),1);assert.equal(guest.run('droppedWeapons[0].x'),81);assert.equal(guest.run('droppedWeapons[0].reserve'),92);
 });
 check('expanded streets support walking, drops and strict out-of-map rejection in exploration only',()=>{setup();local.run("exploring=true;navigation=createNavigation({...map,bounds:activeArenaBounds()});updateMapLabels();Object.assign(player,{x:-84,z:37,y:0,vy:0});for(var i=0;i<22;i++){moveEntity(player,-1,0);updateActorVertical(player,.05)}");near(local.run('player.x'),-106,'new street movement');near(local.run('player.y'),0,'expanded paving support');local.run("syncDrops([{id:1001,weapon:'forge',x:-105,z:37,yaw:0,ammo:51,reserve:92},{id:1002,weapon:'atlas',x:113,z:37,yaw:0,ammo:2,reserve:3}])");assert.equal(local.run('droppedWeapons.length'),1);assert.equal(local.run('droppedWeapons[0].x'),-105);assert.equal(local.run('droppedWeapons[0].reserve'),92);local.run('for(var i=0;i<20;i++)moveEntity(player,-.5,0)');assert.ok(local.run('player.x>=map.bounds.minX+.34'));near(local.run('player.y'),0,'boundary support');assert.ok(local.elements.get('map-area-name').textContent.includes('224m'));local.run("backMenu();$('match-format').value='standard';startGame();match.startLive();clearBots();Object.assign(player,{x:81,z:60,y:0});for(var i=0;i<20;i++)moveEntity(player,1,0)");assert.ok(local.run('player.x<=81.66'));assert.equal(local.run('navigation.isWalkable(84,60)'),false);assert.equal(local.run('canStand(84,60)'),false);assert.ok(local.elements.get('map-area-name').textContent.includes('164m'));local.run("var remote={x:81,z:60,y:0,alive:true,remoteId:'guest',team:'red',dashTimer:0,dashVec:null};moveEntity(remote,5,0)");assert.ok(local.run('remote.x<=81.660001'));});
 check('round/menu clears launches and traffic history',()=>{setup();local.run("player.trafficLaunch={seq:1,endsAt:elapsed+.8,vx:13,vz:0,vy:5.6};spawnRound()");assert.equal(local.run('player.trafficLaunch'),null);local.run('backMenu()');assert.equal(local.run('map.traffic.impacts([],0).length'),0);});
 console.log('PASS '+groups+' HIRAKATA actual-game groups; no audio');
 console.log('TOTAL '+Math.round(performance.now()-started)+'ms wall / '+Math.round(process.cpuUsage(cpuStarted).user/1000)+'ms CPU');
}main().catch(e=>{console.error(e);process.exitCode=1;});
