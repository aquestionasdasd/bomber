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
    const elements = new Map(), listeners = new Map(), windowListeners = new Map();
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
    const audioEvents=[];
    const sandbox = { audioEvents, ...imported, THREE: { ...THREE, WebGLRenderer: Renderer },
      createMap: realMap ? actualCreateMap : fixtureMap, document,
      // Never instantiate AudioContext or fetch/decode/play any recording.
      createGameAudio: () => ({ init() {}, play(type,options) {audioEvents.push({type,options});}, unlock() {}, resume() {}, setVolume() {}, dispose() {} }),
      window: { addEventListener(type,fn) {if(!windowListeners.has(type))windowListeners.set(type,[]);windowListeners.get(type).push(fn);} }, navigator: { maxTouchPoints: 0 }, matchMedia: () => ({ matches: false }),
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
    return { sandbox, run, seed, wall, clearWalls, reset, elements, listeners, windowListeners };
  }



 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("player.kit=new DuelistKit({character:'renko'});player.kit.smoke=2;player.kit.updraft=1;match.phase='live';makeBot({x:0,z:-12},0,'red',{id:'enemy',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.remoteId='passive';enemy.hp=100;enemy.armor=50;enemy.fire=999;enemy.reactionUntil=999");}
 function step(seconds,hz=60,g=h){g.sandbox.seconds=seconds;g.sandbox.hz=hz;g.run('for(let t=0;t<seconds-1e-8;t+=1/hz)updatePlay(Math.min(1/hz,seconds-t))');}
 check('C quick cast immediately consumes once, then real moving dart knocks back for zero damage or rewards',()=>{
  setup();h.run("useAbility('c')");assert.equal(h.run('duckAim'),null);assert.equal(h.run('player.kit.smoke'),1);assert.equal(h.run('enemy.carMotion'),undefined);step(.1);assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('enemy.carMotion'),undefined);step(.1);assert.equal(h.run('enemy.carMotion.phase'),4);assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('enemy.armor'),50);assert.equal(h.run('totalKills'),0);assert.equal(h.run('match.credits'),800);assert.ok(h.run('enemy.z')<-12);step(1.2);assert.equal(h.run('enemy.carMotion'),null);assert.ok(h.run('enemy.z')<-30);assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('carStunUntil(enemy)'),0);
 });
 check('C projectile is avoidable, stops at walls, can fire at hidden/no-target and hits nearest enemy once',()=>{
  setup();h.run("activateAbility(player,'c');enemy.x=3");step(.8);assert.equal(h.run('enemy.carMotion'),undefined);
  setup();h.wall({z:-6,width:8});h.run("activateAbility(player,'c')");assert.equal(h.run('player.kit.smoke'),1);step(.4);assert.equal(h.run('enemy.carMotion'),undefined);
  setup();h.run("activateAbility(player,'c');map.colliders.push({minX:-3,maxX:3,minZ:-6.1,maxZ:-5.9,base:0,height:3});map.collision=createCollisionIndex(map.colliders)");step(.4);assert.equal(h.run('enemy.carMotion'),undefined);
  setup();h.run("makeBot({x:0,z:-6},1,'red',{id:'near',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});bots[1].remoteId='passive';activateAbility(player,'c')");step(.3);assert.equal(h.run('bots[1].carMotion.phase'),4);assert.equal(h.run('enemy.carMotion'),undefined);
 });
 check('Q is fast running, V initiates momentum slide with limited turn, jump cancels slide; 20/60/144Hz',()=>{
  for(const hz of[20,60,144]){setup();h.run("enemy.x=60;keys.add('KeyW');useAbility('q')");step(.5,hz);near(h.run('player.z'),-7.2,'14.4m/s',.02);h.run("keys.add('KeyV')");step(.2,hz);assert.ok(h.run('renkoSliding(player)'));assert.ok(h.run('player.crouch')>.8);const z=h.run('player.z');h.run('player.yaw=Math.PI/2');step(.1,hz);assert.ok(h.run('player.z')<z-1);assert.ok(Math.abs(h.run('player.vx'))<4);h.run('jump()');step(.05,hz);assert.equal(h.run('renkoSliding(player)'),false);assert.ok(h.run('player.y')>0);}
 });
 check('E held camera-directed flight exceeds4s, release restores gravity, walls/ceilings stop flight',()=>{
  for(const hz of[20,60,144]){setup();h.run("enemy.x=60;player.pitch=.4;useAbility('e')");step(.5,hz);near(h.run('player.z'),-8*Math.cos(.4),'16m/s heading',.02);near(h.run('player.y'),8*Math.sin(.4),'pitch ascent',.02);h.run('player.yaw=Math.PI/2;player.pitch=-.2');const y=h.run('player.y');step(.2,hz);assert.ok(h.run('player.x')<-3);assert.ok(h.run('player.y')<y);h.run('player.yaw=0;player.pitch=0');step(4,hz);assert.ok(h.run('renkoFlight(player)'));h.run('releaseRenkoJet()');step(.05,hz);assert.equal(h.run('renkoFlight(player)'),null);assert.ok(h.run('player.vy')<0||h.run('player.y')===0);}
  setup();h.run("map.colliders.push({minX:-30,maxX:30,minZ:-30,maxZ:30,base:3,height:3.3});map.collision=createCollisionIndex(map.colliders);player.pitch=1;useAbility('e')");step(.8);assert.ok(h.run('player.y')<=1.30001);assert.ok(h.run('player.y')>1.2);
 });
 check('CQE event20/work/death/seal refuse without consuming or moving; X activates',()=>{
  for(const block of["player.planting=true","player.defusing=true","player.alive=false;player.hp=0","match.phase='buy'","netHostPaused=true","ordinarySkills.cast('duck-seal',ordinaryActorView(enemy),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round)","for(let i=0;i<20;i++)ordinarySkills.cast('onnara-chain',{...ordinaryActorView(player),id:'s'+i},ordinaryActorView(player),elapsed,match.round)"]){setup();h.run(block);const before=copy(h.run('player.kit.snapshot()'));h.run("activateAbility(player,'e');activateAbility(player,'q');activateAbility(player,'c')");assert.deepEqual(copy(h.run('player.kit.snapshot()')),before,block);assert.equal(h.run('player.y'),0);}
  setup();h.run("player.kit.ultPoints=7;useAbility('x')");assert.equal(h.run('player.kit.ultPoints'),0);assert.equal(h.run('player.kit.renkoActive'),true);assert.equal(h.run('player.kit.knivesActive'),false);
 });
 check('strict16field snapshots restore render only; malformed/cross-round/duplicate are rejected',()=>{
  setup();h.run("activateAbility(player,'c');var e=ordinarySkills.events(elapsed)[0]");const event=copy(h.run('e')),state={events:[event],blinds:[],markers:[]};assert.equal(Object.keys(event).length,16);const sk=h.sandbox.createCharacterSkills();assert.ok(sk.restore(state,event.startedAt,event.round));assert.equal(sk.update([{id:'enemy',team:'red',x:0,y:0,z:-12,hp:100,alive:true}],event.startedAt+.3,event.round,{projectileClear:()=>true}).length,0);
  for(const change of[e=>e.damage=0,e=>e.radius=2,e=>e.flight=.1,e=>e.x=999,e=>e.endsAt+=1]){const bad=copy(state);change(bad.events[0]);assert.equal(h.sandbox.createCharacterSkills().restore(bad,event.startedAt,event.round),false);}
 });
 function peers(){const host=harness(),guest=harness();setup(host);guest.reset();host.run("enemy.kit=new DuelistKit({character:'renko'});enemy.kit.smoke=2;enemy.kit.updraft=1;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest',enemy.id);var captured;netClock=0;tickOnline(.1)");guest.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send(){}};netParticipants.set('guest','enemy')");guest.sandbox.packet=copy(host.run('captured'));guest.run("receiveNetPacket('host',packet)");return{host,guest};}
 function request(p,key){p.guest.sandbox.key=key;p.guest.run('player.pitch=.4;confirmRenkoSkill(key)');p.host.sandbox.request={type:'input',seq:1,connection:'renko',round:p.host.run('match.round'),input:{x:0,y:0,z:-12,yaw:0,pitch:.4,jet:key==='e'},actions:copy(p.guest.run('netActions'))};p.host.run("receiveNetPacket('guest',request);updateRemoteActor(enemy,.05);elapsed+=.05;updateRemoteActor(enemy,.05);netClock=0;tickOnline(.1)");}
 function ack(p){p.guest.sandbox.packet=copy(p.host.run('captured'));p.guest.run("receiveNetPacket('host',packet)");}
 check('independent host/guest flight prediction, ACK/duplicate no extra duration, refusal restores stock and motion',()=>{
  const p=peers();request(p,'e');assert.ok(p.guest.run('player.renkoPending'));assert.equal(p.host.run('enemy.kit.dash'),0);assert.ok(p.host.run('enemy.y')>0);ack(p);assert.equal(p.guest.run('player.renkoPending'),null);const end=p.guest.run('renkoFlight(player).endsAt');ack(p);assert.equal(p.guest.run('renkoFlight(player).endsAt'),end);
  const q=peers();q.host.run("for(let i=0;i<20;i++)ordinarySkills.cast('onnara-chain',{...ordinaryActorView(player),id:'s'+i},ordinaryActorView(player),elapsed,match.round)");request(q,'e');q.guest.run('updateActorVertical(player,.1)');assert.ok(q.guest.run('player.y')>0);ack(q);assert.equal(q.guest.run('player.kit.dash'),1);assert.equal(q.guest.run('player.y'),0);assert.equal(q.guest.run('player.renkoPending'),null);
  const f=peers();f.guest.run("netActions=Array.from({length:64},(_,i)=>({seq:i+1,type:'reload',round:match.round}));useAbility('e')");assert.equal(f.guest.run('player.kit.dash'),1);assert.equal(f.guest.run('player.renkoPending'),null);
 });
 check('host remote flight clamps spoofed altitude and speed, no skill means no flight; 3 maps',()=>{
  for(const id of['hashimoto','hirakata','trc']){const g=harness({realMap:true});setup(g);g.sandbox.mapId=id;g.run("selectArena(mapId);Object.assign(enemy,map.teamSpawns.attack[0],{y:0});enemy.kit=new DuelistKit({character:'renko'});enemy.remoteId='guest';onlinePlaying=true;online={host:true,session:{memberId:'host'}};activateAbility(enemy,'e');netInputs.set('guest',{seq:1,connection:'jet',round:match.round,received:elapsed,actions:[],input:{x:enemy.x+999,y:999,z:enemy.z,yaw:0,pitch:0,jet:true}});var originalX=enemy.x;for(let i=0;i<30;i++){elapsed+=1/60;netInputs.get('guest').received=elapsed;updateRemoteActor(enemy,1/60)}");assert.ok(g.run('enemy.y')<=4.001);assert.ok(g.run('enemy.x-originalX')<=8.001);}
 });
 check('push uses existing6tuple, wall stops motion, guest cannot start hit and no residual5s stun',()=>{
  setup();h.run("activateAbility(player,'c')");step(.2);h.run('var state=captureNetActor(enemy)');const state=copy(h.run('state'));assert.equal(state.carMove.length,6);assert.equal(state.carMove[1],4);h.sandbox.marker=state.carMove;assert.ok(h.run('carMotionMarker(marker,elapsed)'));h.run("marker[1]=2");assert.equal(h.run('carMotionMarker(marker,elapsed)'),null);h.wall({z:-18,width:8});step(1.1);assert.equal(h.run('enemy.carMotion'),null);assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('carStunUntil(enemy)'),0);
 });
 check('death/team/round/menu clears drive/jet/prediction and models use16th playable identity',()=>{
  for(const stop of["player.alive=false;player.hp=0;updateOrdinarySkills()","player.team='red';updateOrdinarySkills()","match.round++;resetOrdinarySkills()","backMenu()"]){setup();h.run("activateAbility(player,'e')");h.run(stop);assert.equal(h.run('renkoFlight(player)'),null);assert.equal(h.run("ordinarySkills.events(elapsed).some(e=>e.sourceId===player.id&&e.type.startsWith('renko-'))"),false);}
  assert.equal(Object.keys(h.sandbox.CHARACTER_DEFS).length,16);assert.equal(h.sandbox.normalizeCharacter('renko'),'renko');
 });
 check('Q-to-E combo clears slide on local and host remote; flight wall and expiry retain collision/gravity',()=>{
  setup();h.run("enemy.x=60;keys.add('KeyW');useAbility('q')");step(.5);h.run("keys.add('KeyV')");step(.1);assert.ok(h.run('renkoSliding(player)'));h.run("keys.delete('KeyV');useAbility('e')");step(.1);assert.equal(h.run('renkoSliding(player)'),false);h.wall({z:-12,width:8,height:8});step(.5);assert.ok(h.run('player.z')>-11.7);
  const p=peers();p.host.run("activateAbility(enemy,'q');enemy.vx=12;enemy.renkoDrive={id:renkoEvent(enemy,'renko-drive').id,crouched:true,slideAt:elapsed,x:1,z:0};activateAbility(enemy,'e');netInputs.set('guest',{seq:2,connection:'combo',round:match.round,received:elapsed,actions:[],input:{x:enemy.x,y:1,z:enemy.z-2,crouch:0,yaw:0,pitch:0,jet:true}});var x=enemy.x;updateRemoteActor(enemy,.05)");near(p.host.run('enemy.x'),p.host.run('x'),'no stale slide');assert.equal(p.host.run('enemy.renkoDrive'),null);p.host.run("elapsed+=4.1;enemy.y=3;enemy.vy=0;netInputs.get('guest').received=elapsed;netInputs.get('guest').input.y=999;updateRemoteActor(enemy,.05)");assert.ok(p.host.run('enemy.y')<3,'expired jet returns host gravity');
 });
 check('host-confirmed dart push reaches independent guest without HP/armor or guest collision authority',()=>{
  const p=peers();p.host.run("player.kit=new DuelistKit({character:'renko'});player.kit.smoke=2;player.yaw=0;player.pitch=0;activateAbility(player,'c');elapsed+=.2;updateOrdinarySkills();netClock=0;tickOnline(.1)");assert.equal(p.host.run('enemy.carMotion.phase'),4);ack(p);assert.equal(p.guest.run('player.carMotion.phase'),4);const hp=p.guest.run('player.hp'),armor=p.guest.run('player.armor');p.guest.run("updateCarMotions(.1);updateOrdinarySkills()");assert.equal(p.guest.run('player.hp'),hp);assert.equal(p.guest.run('player.armor'),armor);assert.equal(p.guest.run('carStunUntil(player)'),0);
 });
 console.log('PASS: '+groups+' actual savedgame Renko groups; audio mocked only');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
