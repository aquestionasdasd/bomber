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
  Object.assign(imported,await load('bus-traffic.js'),await load('bus-service.js'));
  let groups = 0;
  const check = (label, fn) => { if(process.env.BUS_PASSENGER_TEST&&!label.includes(process.env.BUS_PASSENGER_TEST))return;fn(); groups++; console.log(`PASS: ${label}`); };
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







 function fixture({yaw=0,seat=0,team='red',armor=0,real=false}={}){
  const h=harness({realMap:real});h.reset();
  h.run("map.id='hirakata';map.traffic?.reset();map.busModels?.dispose();environment.clear();map.colliders.length=0;map.collision=createCollisionIndex(map.colliders);map.traffic=createTrafficClock([{id:'south-1',points:[{x:40,z:40},{x:50,z:40},{x:50,z:50},{x:40,z:50}],offset:0},{id:'north-1',points:[{x:-40,z:-40},{x:-50,z:-40},{x:-50,z:-50},{x:-40,z:-50}],offset:0}]);map.busModels=createBusModels(THREE,environment,map.traffic);elapsed=10;makeBot({x:0,z:0},0,'red',{id:'red-0',team:'red',primary:'vandal',secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var rider=bots[0];rider.id='red-0';rider.record.id='red-0';Object.assign(rider.record,{k:0,d:0,name:'RIDER'});roster=[roster[0],rider.record];");
  h.sandbox.input={yaw,seat,team,armor};h.run("rider.team=input.team;rider.record.team=input.team;rider.armor=input.armor;var ids=[player.id,rider.id];var row=[0,0,input.seat===6?1:-1,input.seat===6?elapsed+25:0,0,0,input.yaw,0,input.seat===6?[1]:input.seat===0?[1]:[0,1]];if(input.seat>0&&input.seat<6){row[8]=[];for(var i=0;i<input.seat;i++)row[8].push('dummy'+i);row[8].push(1);}map.traffic.service.restore([row],ids,elapsed);");
  // For arbitrary passenger seats use distinct actual actors, never invalid IDs.
  if(seat>0&&seat<6){h.sandbox.seatCount=seat;h.run("var riders=[];for(var i=0;i<seatCount;i++){var id='fill-'+i;ids.push(id);riders.push(ids.length-1);}riders.push(1);map.traffic.service.restore([[0,0,-1,0,0,0,input.yaw,0,riders]],ids,elapsed)");}
  h.run("map.traffic.service.place(rider,elapsed);rider.group.position.set(rider.x,rider.y,rider.z);map.busModels.update(elapsed);environment.updateMatrixWorld(true);botsGroup.updateMatrixWorld(true);var bus=map.traffic.poses(elapsed)[0];player.team='blue';Object.assign(player,busPoint(bus,7,2.1),{y:0,hp:100,armor:0});roundDamage.begin(match.round,roster);Math.random=()=>.5;");
  return h;
 }
 function aim(h,target='rider',height=1.62){h.run(`var target=typeof ${target}==='object'?${target}:rider;var dx=target.x-player.x,dz=target.z-player.z;player.yaw=Math.atan2(-dx,-dz);player.pitch=Math.atan2((target.y||0)+${height}-(player.y+1.7),Math.hypot(dx,dz));renderedRecoil=0;lastShot=-10;shotSequence=0;player.recoil=0;reloading=0;`);}
 check('actual window rays hit all six passenger seats and captured driver seat at rotated poses',()=>{
  for(const yaw of[0,.83,-2.2])for(let seat=0;seat<=6;seat++){const h=fixture({yaw,seat});h.run("Object.assign(player,busPoint(bus,7,input.seat===6?4.15:2.1-Math.floor(input.seat/2)*1.55),{y:0});equip('vandal',true)");aim(h);h.run('shoot()');assert.ok(h.run('rider.hp<100'),`seat${seat} yaw${yaw}`);assert.ok(h.run('rider.alive===false'));assert.equal(h.run('totalKills'),1);assert.equal(h.run('roster[0].k'),1);}
 });
 check('metal body, window pillars, roof and real map wall still stop firearms',()=>{
  let h=fixture();h.run("equip('vandal',true)");aim(h,'rider',.55);h.run('shoot()');assert.equal(h.run('rider.hp'),100);
  h=fixture();h.run("Object.assign(player,busPoint(bus,7,2),{y:0});var pillar=busPoint(bus,1.29,2,2.05);var toward=new THREE.Vector3(pillar.x-player.x,pillar.y-1.7,pillar.z-player.z).normalize();var ray=new THREE.Raycaster(new THREE.Vector3(player.x,1.7,player.z),toward,0,20);var first=ray.intersectObjects([environment,botsGroup],true).find(busSurfaceVisible)");assert.ok(h.run('first&&!first.object.userData.bot&&!first.object.userData.busGlass'));
  h=fixture();h.wall({x:3,z:2.1,width:.25,depth:7,height:4});h.run("equip('vandal',true)");aim(h);h.run('shoot()');assert.equal(h.run('rider.hp'),100);assert.equal(h.run('visibleBetween(player,rider)'),false);
  h=fixture();h.run("Object.assign(player,{x:rider.x,z:rider.z,y:5});equip('vandal',true)");aim(h);h.run('shoot()');assert.equal(h.run('rider.hp'),100);
 });
 check('same-cabin and outside-through-opposite-window shots; allies take no bullet damage',()=>{
  for(const same of[true,false]){const h=fixture();h.run(`Object.assign(player,busPoint(bus,${same?-.48:-7},${same?4.1:2.1}),{y:${same?.46:0}});equip('classic',true)`);aim(h);h.run('shoot()');assert.ok(h.run('rider.hp<100'));}
  const h=fixture({team:'blue'});h.run("equip('vandal',true)");aim(h);h.run('shoot()');assert.equal(h.run('rider.hp'),100);assert.equal(h.run('totalKills'),0);
 });
 check('shotgun, automatic heavy weapon and sniper hit real cabin actors with armour and damage report',()=>{
  for(const gun of['pump','forge','scout','atlas']){const h=fixture({armor:50});h.sandbox.gun=gun;h.run('equip(gun,true)');aim(h);h.run('shoot()');assert.ok(h.run('rider.hp<100||rider.armor<50'),gun);h.run('roundDamage.finish(match.round)');assert.ok(h.run('roundDamage.report(player.id,roster,match.round+1).given>0'));}
 });
 check('BOT sight uses visible windows, respects metal and smoke; shot cannot cross lower metal',()=>{
  const h=fixture();assert.equal(h.run('visibleBetween(player,rider)'),true);h.run('var below={x:rider.x,y:-1,z:rider.z};');assert.equal(h.run('map.traffic.rayClear({x:7,y:1,z:2.1},{x:rider.x,y:1,z:rider.z},elapsed)'),false);
  h.run("var enemy=rider;smokes.push({x:3,y:0,z:2.1,radius:2,expires:elapsed+10})");assert.equal(h.run('visibleBetween(player,rider)'),false);h.run('smokes.length=0');assert.equal(h.run('visibleBetween(player,rider)'),true);
 });
 check('actual BOT acquires and shoots seated player through visible glass',()=>{
  const h=fixture();h.run("map.traffic.service.restore([[0,0,-1,0,0,0,0,0,[0]]],[player.id,rider.id],elapsed);map.traffic.service.place(player,elapsed);Object.assign(rider,{x:7,y:0,z:2.1,hp:1000,aiWeapon:'vandal',aiAmmo:25,aiReserve:75,fire:0,think:0,reactionUntil:0});rider.kit.smoke=rider.kit.updraft=rider.kit.dash=rider.kit.ultPoints=0;rider.group.position.set(rider.x,0,rider.z);rider.group.rotation.y=Math.atan2(player.x-rider.x,player.z-rider.z);Math.random=()=>0;for(var i=0;i<100&&player.alive;i++){elapsed+=.02;updateBots(.02)}");assert.ok(h.run('player.hp<100'));assert.ok(h.run('rider.aiAmmo<25'));
 });
 check('moving and turned bus keeps glass hittable, death ejects seat and frees driver ownership',()=>{
  const h=fixture({seat:6});h.run("map.traffic.reset();elapsed=0;while(elapsed<60&&!map.traffic.poses(elapsed).some(p=>p.id==='south-1'&&p.door))elapsed+=.02;bus=map.traffic.poses(elapsed)[0];Object.assign(rider,busPoint(bus,-1.8,3.8),{vy:0,y:0});map.traffic.service.interact(rider,elapsed);map.traffic.service.damageDriver(bus.id,rider.id,100,elapsed);map.traffic.service.interact(rider,elapsed);map.traffic.service.tick(.1,elapsed+.1,[player,rider],{controls:()=>({throttle:1,steer:1})});elapsed+=.1;map.traffic.service.place(rider,elapsed);rider.group.position.set(rider.x,rider.y,rider.z);map.busModels.update(elapsed);environment.updateMatrixWorld(true);bus=map.traffic.poses(elapsed)[0];Object.assign(player,busPoint(bus,7,4.15),{y:0});equip('vandal',true)");aim(h);h.run('shoot()');assert.equal(h.run('rider.alive'),false);h.run('updateTraffic(.05)');assert.equal(h.run('busSeat(rider)'),null);assert.equal(h.run('map.traffic.poses(elapsed)[0].owner'),null);h.run('spawnRound()');assert.equal(h.run('map.traffic.service.snapshot([player.id,rider.id]).length'),1);assert.equal(h.run('map.traffic.poses(elapsed).some(p=>p.id===bus.id)'),false);
 });
 check('remote fire host resolves window hit once; independent guest predicts no damage and restores death/seat',()=>{
  const host=fixture(),guest=harness({realMap:true});host.run("rider.remoteId='rider-member';var shooter=makeBot({x:7,z:2.1},1,'blue',{id:'blue-1',team:'blue',primary:'vandal',secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});shooter=bots[1];shooter.id='blue-1';shooter.record.id='blue-1';Object.assign(shooter.record,{k:0,d:0,name:'SHOOTER'});shooter.remoteId='shooter';shooter.netWeapon='vandal';shooter.netAmmo=25;shooter.netReserve=75;shooter.y=0;shooter.crouch=0;roster.push(shooter.record);onlinePlaying=true;online={host:true,room:{code:'BUSGUN01'},session:{memberId:'host',hostId:'host'},send:(p,o)=>{if(o.team==='red')captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('shooter','blue-1');netParticipants.set('rider-member','red-0');var dx=rider.x-shooter.x,dz=rider.z-shooter.z;var firePacket={type:'input',seq:1,round:match.round,input:{x:shooter.x,y:0,z:shooter.z,yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(rider.y+1.62-1.7,Math.hypot(dx,dz))},actions:[{seq:1,type:'fire',round:match.round,at:elapsed,yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(rider.y+1.62-1.7,Math.hypot(dx,dz))}]};receiveNetPacket('shooter',firePacket);updateRemoteActor(shooter,.05)");assert.equal(host.run('rider.alive'),false);assert.equal(host.run('shooter.netAmmo'),24);host.run("receiveNetPacket('shooter',firePacket);updateRemoteActor(shooter,.05)");assert.equal(host.run('shooter.netAmmo'),24);assert.equal(host.run('shooter.record.k'),1);
  host.run('updateTraffic(.05);netClock=0;tickOnline(.1)');guest.reset();guest.run("selectArena('hirakata');onlinePlaying=true;online={host:false,room:{code:'BUSGUN01'},session:{memberId:'rider-member',hostId:'host'},send:()=>{}};netParticipants.set('rider-member','red-0')");guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('player.alive'),false);assert.equal(guest.run('busSeat()'),null);
  const prediction=fixture();prediction.run("onlinePlaying=true;online={host:false,room:{code:'BUSGUN02'},session:{memberId:'guest',hostId:'host'},send:()=>{}};equip('vandal',true)");aim(prediction);prediction.run('shoot()');assert.equal(prediction.run('rider.hp'),100);assert.equal(prediction.run('totalKills'),0);
 });
 check('render budgets and actual four-bus timetable/windows remain bounded without wire fields',()=>{
  const h=harness({realMap:true});h.reset();h.run("selectArena('hirakata');map.busModels.update(elapsed);environment.updateMatrixWorld(true)");assert.equal(h.run('map.traffic.poses(elapsed).length'),4);assert.ok(h.run('(()=>{let n=0;map.world.traverse(o=>{if(o.isMesh)n++});return n<=280})()'));assert.ok(h.run('(()=>{let n=0;environment.traverse(o=>{if(o.userData.busGlass)n++});return n>=4})()'));
 });
 console.log(`PASS: ${groups} bus passenger firearms / actual meshes / independent JSON / cover / lifecycle groups; no audio`);
 console.log(`TOTAL ${Math.round(performance.now()-started)}ms wall / ${Math.round(process.cpuUsage(cpuStarted).user/1000)}ms CPU`);
}main().catch(e=>{console.error(e);process.exitCode=1;});
