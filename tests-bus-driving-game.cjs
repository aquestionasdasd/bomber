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
 function setup(){local.reset();local.run("$('map-select').value='hirakata';mode='menu';startGame();startRound();clearBots();elapsed=0;while(elapsed<40&&!map.traffic.poses(elapsed).some(p=>p.door))elapsed+=.02;var bus=map.traffic.poses(elapsed).find(p=>p.door);Object.assign(player,busPoint(bus,-1.8,3.8),{hp:100,armor:0,alive:true,vy:0,vx:0,vz:0});map.busModels.update(elapsed);environment.updateMatrixWorld(true);");}
 function board(){local.run('busInteract()');assert.ok(local.run('busSeat()'));}
 function killDriver(){local.run("map.traffic.service.damageDriver(bus.id,player.id,100,elapsed);map.busModels.update(elapsed);environment.updateMatrixWorld(true)");}
 check('actual stop board has2 displays, hinged open doors and shootable full driver',()=>{setup();assert.equal(local.run('map.busModels.boards.length'),2);assert.ok(local.run('map.busModels.doors.get(bus.id)[0].rotation.y< -1'));board();assert.equal(local.run('busDriving()'),false);assert.ok(local.run('player.y>.4'));});
 check('actual firearm ray kills neutral driver from cabin; no player kill award',()=>{setup();board();local.run("equip('vandal',true);var target=busPoint(bus,.64,4.1,1.96),dx=target.x-player.x,dz=target.z-player.z;player.yaw=Math.atan2(-dx,-dz);player.pitch=Math.atan2(target.y-(player.y+1.7),Math.hypot(dx,dz));reloading=0;shoot()");assert.equal(local.run('map.traffic.poses(elapsed).find(p=>p.id===bus.id).driverHP'),0);assert.equal(local.run('totalKills'),0);assert.ok(local.run('player.ammo<25'));local.run('busInteract()');assert.ok(local.run('busDriving()'));local.run('renderOrdinarySkills()');assert.equal(local.run('gun.visible'),false);});
 check('actual driving moves continuously, blocks gun/skills/jump, stops fuel, exits safely',()=>{setup();board();killDriver();local.run("busInteract();keys.add('KeyW');var startBus=map.traffic.poses(elapsed).find(p=>p.id===bus.id);var beforeAmmo=player.ammo,beforeKit=JSON.stringify(player.kit.snapshot());shoot();jump();activateAbility(player,'e');for(var i=0;i<20;i++){elapsed+=.05;updateTraffic(.05)}");assert.equal(local.run('player.ammo'),local.run('beforeAmmo'));assert.equal(local.run('player.vy'),0);assert.equal(local.run('JSON.stringify(player.kit.snapshot())'),local.run('beforeKit'));assert.ok(local.run('Math.hypot(player.x-startBus.x,player.z-startBus.z)>1'));local.run('elapsed+=26;updateTraffic(.05)');assert.equal(local.run('map.traffic.poses(elapsed).find(p=>p.id===bus.id).fuel'),0);assert.equal(local.run('map.traffic.poses(elapsed).find(p=>p.id===bus.id).speed'),0);local.run('busInteract()');assert.equal(local.run('busSeat()'),null);assert.equal(local.run('player.y'),0);assert.ok(local.run('canStand(player.x,player.z,.34,0)'));});
 check('vehicle friendly damage is explicit; ordinary friendly fire stays disabled and no friendly kill reward',()=>{setup();local.run("makeBot({x:0,z:60},0,'blue',{id:'blue-1',team:'blue',primary:null,secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var ally=bots[0];damageEntity(ally,100,player)");assert.equal(local.run('ally.hp'),100);local.run('damageEntity(ally,100,player,{vehicle:true})');assert.equal(local.run('ally.alive'),false);assert.equal(local.run('totalKills'),0);assert.equal(local.run('roster[0].k'),0);});
 check('full vehicle footprint stops at buildings and arena edges',()=>{setup();assert.equal(local.run('busCanDrive({x:81,z:60,yaw:0},{x:80,z:60,yaw:0})'),false);assert.equal(local.run('busCanDrive({x:0,z:10,yaw:0},{x:0,z:11,yaw:0})'),false);assert.ok(local.run('busCanDrive(bus,bus)'));});
 check('round/menu removes occupied seats and restores timetable/driver',()=>{setup();board();killDriver();local.run('busInteract();spawnRound()');assert.equal(local.run('busSeat()'),null);assert.equal(local.run('map.traffic.service.snapshot([player.id]).length'),0);setup();board();local.run('backMenu()');assert.equal(local.run('busSeat()'),null);});

 check('real remote action and fresh JSON guest: board, shoot, claim, duplicate ACK and forged poses',()=>{
  const host=local,guest=harness({realMap:true});setup();
  host.run("var at=busPoint(bus,-1.8,3.8);makeBot(at,0,'red',{id:'red-0',team:'red',primary:'vandal',secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var remote=bots[0];remote.id='red-0';remote.remoteId='guest';remote.netWeapon='vandal';remote.netAmmo=25;remote.netReserve=75;remote.hp=100;remote.y=0;remote.vy=0;remote.record.id='red-0';roster=[roster[0],remote.record];onlinePlaying=true;online={host:true,room:{code:'BUSROOM1'},session:{memberId:'host',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest','red-0');player.x=-60;player.z=70;function action(seq,type,extra={}){receiveNetPacket('guest',{type:'input',seq,round:match.round,input:{x:remote.x,y:remote.y,z:remote.z,yaw:0,pitch:0},actions:[{seq,type,round:match.round,at:elapsed,...extra}]});updateRemoteActor(remote,.05)};action(1,'bus');");
  assert.ok(host.run('busSeat(remote)'));assert.equal(host.run('busDriving(remote)'),false);
  host.run("environment.updateMatrixWorld(true);var target=busPoint(bus,.64,4.1,1.96),dx=target.x-remote.x,dz=target.z-remote.z;action(2,'fire',{yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(target.y-(remote.y+1.7),Math.hypot(dx,dz))});action(3,'bus');netClock=0;tickOnline(.1)");
  assert.ok(host.run('busDriving(remote)'));assert.equal(host.run('remote.netAmmo'),24);
  guest.reset();guest.run("selectArena('hirakata');onlinePlaying=true;online={host:false,room:{code:'BUSROOM1'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-0')");guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer)");
  assert.ok(guest.run('busDriving()'));near(guest.run('player.x'),host.run('remote.x'),'seated X',.002);near(guest.run('player.y'),host.run('remote.y'),'seated feet',.002);
  const until=host.run("map.traffic.service.snapshot([player.id,remote.id])[0][3]");host.run("action(3,'bus')");assert.equal(host.run("map.traffic.service.snapshot([player.id,remote.id])[0][3]"),until);
  host.run("receiveNetPacket('guest',{type:'input',seq:4,round:match.round,input:{x:999,y:11,z:999,bus:{throttle:999,steer:0,fuel:999,owner:'player'}},actions:[]});updateRemoteActor(remote,.05);elapsed+=.05;updateTraffic(.05);netClock=0;tickOnline(.1)");
  assert.ok(host.run('Math.abs(remote.x)<82&&remote.y<1&&Math.abs(remote.z)<82'));assert.equal(host.run("map.traffic.service.snapshot([player.id,remote.id])[0][3]"),until);
  guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer)");assert.ok(guest.run('busDriving()'));assert.equal(guest.run('player.ammo'),24);
  const guestTime=guest.run('elapsed');guest.sandbox.bad=copy(host.run('captured'));guest.sandbox.bad.seq+=1;guest.sandbox.bad.busTransit[0][3]+=100;guest.run("receiveNetPacket('host',bad)");assert.equal(guest.run('elapsed'),guestTime);assert.ok(guest.run('busDriving()'));
  host.run("elapsed+=26;updateTraffic(.05);netClock=0;tickOnline(.1)");guest.sandbox.transfer=copy(host.run('captured'));guest.sandbox.transfer.seq+=2;guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('map.traffic.poses(elapsed).find(p=>p.owner===player.id).fuel'),0);
  host.run('spawnRound();netClock=0;tickOnline(.1)');guest.sandbox.transfer=copy(host.run('captured'));guest.sandbox.transfer.seq+=3;guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('busSeat()'),null);
 });
 check('actual moving bus strikes both teams once, neutralizes friendly reward and drops bomber',()=>{setup();board();killDriver();local.run("busInteract();makeBot({x:0,z:60},0,'blue',{id:'blue-1',team:'blue',primary:null,secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});makeBot({x:0,z:60},1,'red',{id:'red-0',team:'red',primary:null,secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});for(var b of bots){b.hp=100;b.armor=0;b.alive=true;Object.assign(b,{x:bus.x,z:bus.z,y:0,vy:0});}match.spike={...match.spike,status:'carried',carrier:bots[0].id};keys.add('KeyW');elapsed+=.1;updateTraffic(.1)");assert.equal(local.run('bots.every(b=>!b.alive)'),true);assert.equal(local.run('totalKills'),1);assert.equal(local.run('match.spike.status'),'dropped');assert.equal(local.run('bots.every(b=>!!b.trafficLaunch)'),true);});
 console.log('PASS '+groups+' actual bus game groups; no audio');
 console.log('TOTAL '+Math.round(performance.now()-started)+'ms wall / '+Math.round(process.cpuUsage(cpuStarted).user/1000)+'ms CPU');
}main().catch(e=>{console.error(e);process.exitCode=1;});
