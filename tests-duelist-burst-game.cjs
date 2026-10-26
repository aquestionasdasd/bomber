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
      addEventListener(type,fn) { listeners.set(id+':'+type,fn); }, setAttribute(name, value) { this.attributes[name] = value; }, setPointerCapture() {},
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
    return { sandbox, run, seed, wall, clearWalls, reset, elements, listeners };
  }





 const local=harness();
 function setup({hp=1000,armor=0,z=-4}={}){
  local.reset();local.clearWalls();local.sandbox.testConfig={hp,armor,z};
  local.run(`player.kit=new DuelistKit({character:'duelist'});player.kit.ultPoints=7;match.phase='live';activateAbility(player,'x');
   player.pitch=Math.atan2(-.6,-testConfig.z);makeBot({x:0,z:testConfig.z},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});
   var enemy=bots[0];Object.assign(enemy,{hp:testConfig.hp,armor:testConfig.armor,fire:999,reactionUntil:999});effects.length=0;effectsGroup.clear();`);
 }
 const lines=h=>h.run('effects.filter(e=>e.object.isLine).length');
 function remoteSetup(){
  setup();local.run(`enemy.kit=new DuelistKit({character:'duelist'});enemy.kit.ultPoints=7;activateAbility(enemy,'x');enemy.remoteId='guest';enemy.netWeapon='knife';enemy.netAmmo=0;enemy.netReserve=0;enemy.netReload=0;enemy.lastNetShot=-10;player.hp=1000;player.armor=0;
   onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);`);
 }
 const remoteBurst="{type:'fire',seq:1,round:match.round,at:elapsed,yaw:Math.PI,pitch:Math.atan2(-.6,4),ultimate:true,burst:true,damage:9999,count:999}";
 check('atomic bounded kit spend and last-burst kill refill retain round cleanup',()=>{
  const {DuelistKit}=imported,kit=new DuelistKit();kit.ultPoints=7;kit.activate('x',0);
  for(const n of[0,-1,6,1.5,NaN,Infinity,'5',null]){assert.equal(kit.consumeKnife(n),false);assert.equal(kit.knives,5);}
  assert.equal(kit.consumeKnife(5),true);assert.equal(kit.knives,0);kit.awardKill();assert.equal(kit.knives,5);assert.equal(kit.ultPoints,1);kit.consumeKnife(5);kit.tick(1);assert.equal(kit.knivesActive,false);kit.awardKill();assert.equal(kit.knives,0);kit.resetRound();assert.equal(kit.knives,0);
 });
 check('left still spends one, right spends remaining5 with five fixed scatter rays and250body raw',()=>{
  setup();local.run('shoot(elapsed,true)');assert.equal(local.run('player.kit.knives'),0);assert.equal(lines(local),5);assert.equal(local.run('enemy.hp'),750);assert.equal(local.run('shots'),1);
  const ends=copy(local.run('effects.filter(e=>e.object.isLine).map(e=>Array.from(e.object.geometry.attributes.position.array).slice(3))'));assert.equal(new Set(ends.map(JSON.stringify)).size,5);
  setup();local.run('shoot()');assert.equal(local.run('player.kit.knives'),4);assert.equal(lines(local),1);assert.equal(local.run('enemy.hp'),950);local.run('elapsed+=.231;shoot(elapsed,true)');assert.equal(local.run('player.kit.knives'),0);assert.equal(lines(local),5);assert.equal(local.run('enemy.hp'),750);
 });
 check('actual right mouse input sends one burst, clears held fire and does not enter ADS',()=>{
  setup();local.run('firing=true;aiming=true');let prevented=false;local.listeners.get('game:mousedown')?.({button:2,preventDefault(){prevented=true;}});
  // The actual canvas ID is resolved from the initialized saved game.
  if(!prevented){const canvasId=local.run('canvas.id');local.listeners.get(canvasId+':mousedown')({button:2,preventDefault(){prevented=true;}});}
  assert.equal(prevented,true);assert.equal(lines(local),5);assert.equal(local.run('player.kit.knives'),0);assert.equal(local.run('firing'),false);assert.equal(local.run('aiming'),false);
 });
 check('partial stock uses2 once, empty stock refuses, cadence blocks and no ammunition is spent',()=>{
  setup();local.run('player.kit.knives=2;var ammoBefore=player.ammo;shoot(elapsed,true);shoot(elapsed,true)');assert.equal(lines(local),2);assert.equal(local.run('enemy.hp'),900);assert.equal(local.run('player.kit.knives'),0);assert.equal(local.run('player.ammo===ammoBefore'),true);
  setup();local.run('shoot();shoot(elapsed,true)');assert.equal(lines(local),1);assert.equal(local.run('player.kit.knives'),4);local.run('elapsed+=.23;shoot(elapsed,true)');assert.equal(lines(local),5);
 });
 check('50armor and lethal multi-hit award one kill200coins and refill exactly5',()=>{
  setup({hp:1000,armor:50});local.run('shoot(elapsed,true)');assert.equal(local.run('enemy.armor'),0);assert.equal(local.run('enemy.hp'),800);
  setup({hp:100,armor:50});local.run('var creditsBefore=match.credits;shoot(elapsed,true)');assert.equal(local.run('enemy.alive'),false);assert.equal(local.run('totalKills'),1);assert.equal(local.run('match.credits-creditsBefore'),200);assert.equal(local.run('player.kit.knives'),5);assert.equal(local.run('player.kit.ultPoints'),1);assert.equal(lines(local),5);
 });
 check('solid wall blocks every knife, allies cannot take damage and five misses exhaust ult',()=>{
  setup();local.wall({z:-2});local.run('shoot(elapsed,true)');assert.equal(local.run('enemy.hp'),1000);assert.equal(lines(local),5);assert.equal(local.run('player.kit.knives'),0);local.run('player.kit.tick(elapsed)');assert.equal(local.run('player.kit.knivesActive'),false);
  setup();local.run('enemy.team=player.team;shoot(elapsed,true)');assert.equal(local.run('enemy.hp'),1000);assert.equal(local.run('totalKills'),0);
 });
 check('scatter can hit separate visible opponents, preserving each actor once per burst',()=>{
  setup({z:-15});local.run(`for(const [id,x]of[['left',-.675],['right',.675]]){makeBot({x,z:-15},0,'red',{id,team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});bots.at(-1).hp=1000;}shoot(elapsed,true)`);
  assert.equal(local.run('bots.filter(b=>b.hp<1000).length'),3);assert.equal(lines(local),5);assert.equal(local.run('player.kit.knives'),0);
 });
 check('dead, paused, buy, reload, work, stun and throw guards preserve all5',()=>{
  for(const code of["player.alive=false","netHostPaused=true","match.phase='buy'","reloading=1","interactionHeld=true","player.carMotion={id:1,phase:3,round:match.round,team:player.team,endsAt:elapsed+5}","duelistSkillFX.playThrow('duelist-comet',elapsed)"]){setup();local.run(code+';shoot(elapsed,true)');assert.equal(local.run('player.kit.knives'),5,code);assert.equal(lines(local),0,code);}
  setup();local.run(`inventory.primary='vandal';equip('vandal',true);var ammoBefore=player.ammo;shoot(elapsed,true)`);assert.equal(local.run('player.ammo===ammoBefore'),true);assert.equal(local.run('player.kit.knives'),5);
 });
 check('guest predicts only5stock and five visual rays, one action, no HP/armor/credits',()=>{
  setup();local.run(`onlinePlaying=true;online={host:false,session:{memberId:'guest'},room:{code:'TEST'}};var creditsBefore=match.credits,damageAttempts=0,actualDamage=damageEntity;damageEntity=(...args)=>{damageAttempts++;return actualDamage(...args)};shoot(elapsed,true)`);assert.equal(local.run('damageAttempts'),0);assert.equal(local.run('enemy.hp'),1000);assert.equal(local.run('player.kit.knives'),0);assert.equal(local.run('match.credits'),local.run('creditsBefore'));assert.equal(lines(local),5);assert.equal(local.run('netActions.length'),1);assert.equal(local.run('netActions[0].burst'),true);assert.equal(local.run('netActions[0].ultimate'),true);
  setup();local.run(`onlinePlaying=true;online={host:false,session:{memberId:'guest'},room:{code:'TEST'}};netActions=Array.from({length:64},(_,i)=>({seq:i+1}));shoot(elapsed,true)`);assert.equal(local.run('player.kit.knives'),5);assert.equal(lines(local),0);assert.equal(local.run('netActions.length'),64);
 });
 check('host uses bounded own stock and50raw, client count/damage ignored; duplicate and oldR ignored',()=>{
  remoteSetup();local.run(`var action=${remoteBurst};var packet={type:'input',seq:1,connection:'blade',round:match.round,input:{x:0,y:0,z:-4,yaw:Math.PI,pitch:Math.atan2(-.6,4)},actions:[action]};receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016)`);
  assert.equal(local.run('enemy.kit.knives'),0);assert.equal(local.run('player.hp'),650,'upper scatter ray intersects the actual visible head:150+4x50');assert.equal(lines(local),5);assert.equal(local.run("netApplied.get('guest')"),1);
  remoteSetup();local.run(`var action=${remoteBurst};action.round=match.round-1;receiveNetPacket('guest',{type:'input',seq:1,round:match.round,input:{x:0,y:0,z:-4},actions:[action]});updateRemoteActor(enemy,.016)`);assert.equal(local.run('enemy.kit.knives'),5);assert.equal(lines(local),0);
 });
 check('host rejects fake burst from guns/normal knife and invalid burst flags or aim',()=>{
  for(const code of["enemy.netWeapon='classic'","enemy.kit.knivesActive=false","action.burst=5","action.burst='true'","action.yaw=NaN"]){remoteSetup();local.run(`var action=${remoteBurst};${code};applyRemoteAction(enemy,action)`);assert.equal(lines(local),0,code);assert.equal(local.run('player.hp'),1000,code);assert.equal(local.run('enemy.kit.knives'),5,code);}
 });
 check('host remote cadence and partial2 stock match local; no fake early second burst',()=>{
  remoteSetup();local.run(`enemy.kit.knives=2;applyRemoteAction(enemy,${remoteBurst});applyRemoteAction(enemy,${remoteBurst})`);assert.equal(local.run('player.hp'),900);assert.equal(lines(local),2);assert.equal(local.run('enemy.kit.knives'),0);
  remoteSetup();local.run(`enemy.lastNetShot=elapsed;applyRemoteAction(enemy,${remoteBurst})`);assert.equal(local.run('enemy.kit.knives'),5);assert.equal(lines(local),0);
 });
 check('independent JSON snapshot replays pending burst once and confirmed ACK restores host refill',()=>{
  const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.kit=new DuelistKit({character:'duelist'});player.kit.ultPoints=7;match.phase='live';activateAbility(player,'x');onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p}};var captured;tickOnline(.1)`);
  guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','player')`);
  function transfer(){guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer)");}
  transfer();assert.equal(guest.run('player.kit.knives'),5);guest.run('shoot(elapsed,true)');assert.equal(guest.run('player.kit.knives'),0);assert.equal(guest.run('netActions.length'),1);
  host.run('tickOnline(.1)');transfer();assert.equal(guest.run('player.kit.knives'),0,'unacked burst replays full stock');assert.equal(guest.run('netActions.length'),1);guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('player.kit.knives'),0);
  host.run(`player.kit.consumeKnife(5);player.kit.awardKill();netApplied.set('guest',1);tickOnline(.1)`);transfer();assert.equal(guest.run('player.kit.knives'),5);assert.equal(guest.run('netActions.length'),0);
 });
 check('independent ACK rejection restores stock, death/nextR cannot replay old burst',()=>{
  const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.kit=new DuelistKit({character:'duelist'});player.kit.ultPoints=7;match.phase='live';activateAbility(player,'x');onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p}};var captured;tickOnline(.1)`);
  guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','player')`);
  const transfer=()=>{guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer)");};transfer();guest.run('shoot(elapsed,true)');host.run("netApplied.set('guest',1);tickOnline(.1)");transfer();assert.equal(guest.run('player.kit.knives'),5);assert.equal(guest.run('netActions.length'),0);
  guest.run(`elapsed+=.24;shoot(elapsed,true)`);host.run(`player.alive=false;player.hp=0;player.kit.resetRound();match.round++;netApplied.set('guest',2);tickOnline(.1)`);transfer();assert.equal(guest.run('player.kit.knives'),0);assert.equal(guest.run('player.alive'),false);assert.equal(guest.run('netActions.length'),0);
 });
 check('one remaining knife retains actual head150 and leg42 zones on host',()=>{
  for(const [pitch,damage]of [[0,150],[Math.atan2(-1.2,4),42]]){remoteSetup();local.sandbox.zonePitch=pitch;local.run(`enemy.kit.knives=1;var action=${remoteBurst};action.pitch=zonePitch;applyRemoteAction(enemy,action)`);assert.equal(local.run('player.hp'),1000-damage);assert.equal(local.run('enemy.kit.knives'),0);assert.equal(lines(local),1);}
 });
 check('20/60/144Hz burst input does not repeat from held right button; stock cleanup on round',()=>{
  for(const hz of[20,60,144]){setup();local.run(`player.y=3;player.vy=0;player.pitch=0;shoot(elapsed,true);for(let f=0;f<${hz};f++){elapsed+=1/${hz};player.kit.tick(elapsed);}`);assert.equal(lines(local),5);assert.equal(local.run('player.kit.knives'),0);assert.equal(local.run('shots'),1);local.run('startRound()');assert.equal(local.run('player.kit.knives'),0);assert.equal(local.run('player.kit.knivesActive'),false);}
 });
 console.log(`PASS: ${groups} actual-game five-knife burst groups; rendering/audio inert`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
