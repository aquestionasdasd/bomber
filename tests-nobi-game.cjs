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




 const local=harness();
 function setup(){local.reset();local.clearWalls();local.run(`player.kit=new DuelistKit({character:'nobi'});player.kit.smoke=2;player.kit.updraft=1;player.kit.ultPoints=7;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.aiWeapon='classic';enemy.aiAmmo=12;enemy.aiReserve=36;enemy.aiReload=0;enemy.fire=999;enemy.reactionUntil=999;`);}
 const options="{zonePoint:{x:0,y:0,z:-10}}";
 function land(){local.run('elapsed+=.601;updateOrdinarySkills()');}
 check('all CQEX equip/reselect cancel without stock; thrown empty floor accepted with .6s arm',()=>{
  setup();for(const key of['c','q','e','x']){local.run(`useAbility('${key}')`);assert.equal(local.run('duckAim'),key);local.run(`useAbility('${key}')`);assert.equal(local.run('duckAim'),null);}
  assert.equal(local.run('player.kit.ultPoints'),7);assert.ok(local.run(`activateAbility(player,'c',${options})`));assert.equal(local.run('nobiBulletDamage(player,enemy,26,78,true)'),26);land();near(local.run('nobiBulletDamage(player,enemy,26,78,true)'),35.1,'landed');assert.equal(local.run('enemy.hp'),100);
  setup();local.run('enemy.x=60');assert.ok(local.run(`activateAbility(player,'q',${options})`));assert.equal(local.run('player.kit.updraft'),0);
 });
 check('fixed20m area affects multiple enemies only while inside, no tracking; smoke and walls block',()=>{
  setup();local.run(`activateAbility(player,'c',${options})`);land();const z=local.run('ordinarySkills.events(elapsed)[0].z');
  local.sandbox.centerZ=z;local.run('enemy.x=20;enemy.z=centerZ');near(local.run('nobiBulletDamage(player,enemy,26,78,true)'),35.1,'20m boundary');local.run('enemy.x=20.01');near(local.run('nobiBulletDamage(player,enemy,26,78,true)'),26,'outside');local.run('enemy.x=0;enemy.z=centerZ');local.wall({z:z+2});local.run('enemy.z=centerZ+4');near(local.run('nobiBulletDamage(player,enemy,26,78,true)'),26,'wall');
  local.clearWalls();local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:centerZ+2,radius:3.6,expires:100}])`);near(local.run('nobiBulletDamage(player,enemy,26,78,true)'),26,'smoke');local.run('syncSmokes([]);enemy.team=player.team');near(local.run('nobiBulletDamage(player,enemy,26,78,true)'),26,'friend');
 });
 check('C plus allied X converts bullet body once before vulnerability, normal knife and misses',()=>{
  setup();local.run(`activateAbility(player,'c',${options});activateAbility(player,'x',{zonePoint:{x:0,y:0,z:0}})`);land();near(local.run('nobiBulletDamage(player,enemy,26,78,true)'),105.3,'combo');near(local.run('nobiBulletDamage(player,enemy,78,78,true)'),105.3,'head unchanged');near(local.run('nobiBulletDamage(player,enemy,26,78,false)'),26,'knife');local.run('player.x=30');near(local.run('nobiBulletDamage(player,enemy,26,78,true)'),35.1,'out of collar');
 });
 check('actual body shot uses collar and armor; covered shot cannot damage',()=>{
  setup();local.run('player.pitch=-.055;enemy.hp=200;botsGroup.updateMatrixWorld(true);shoot();var baseline=200-enemy.hp');const base=local.run('baseline');assert.ok(base>0);
  setup();local.run(`player.pitch=-.055;enemy.hp=200;activateAbility(player,'x',{zonePoint:{x:0,y:0,z:0}})`);land();local.run('botsGroup.updateMatrixWorld(true);shoot()');assert.ok(local.run('200-enemy.hp')>base);
  setup();local.run(`activateAbility(player,'x',{zonePoint:{x:0,y:0,z:0}})`);land();local.wall({z:-5});local.run('botsGroup.updateMatrixWorld(true);shoot()');assert.equal(local.run('enemy.hp'),100);
 });
 check('Q slows actual local and host remote firearms but leaves knives and friendly shooter normal',()=>{
  setup();local.run(`ordinarySkills.cast('nobi-whisker',ordinaryActorView(enemy),{x:0,y:.12,z:0},elapsed,match.round)`);land();near(local.run('nobiShotInterval(WEAPONS.classic,player)'),local.run('WEAPONS.classic.interval*1.6'),'interval');near(local.run('nobiShotInterval(WEAPONS.knife,player)'),local.run('WEAPONS.knife.interval'),'knife');local.run('shoot();elapsed+=WEAPONS.classic.interval*1.2;shoot()');assert.equal(local.run('player.ammo'),11);local.run('elapsed+=WEAPONS.classic.interval*.5;shoot()');assert.equal(local.run('player.ammo'),10);
  setup();local.run(`enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;activateAbility(player,'q',${options})`);land();local.run(`onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);applyRemoteAction(enemy,{type:'fire',seq:1,yaw:Math.PI,pitch:0});elapsed+=WEAPONS.classic.interval*1.2;applyRemoteAction(enemy,{type:'fire',seq:2,yaw:Math.PI,pitch:0})`);assert.equal(local.run('enemy.netAmmo'),11);
 });
 check('E accelerates actual plant after landing, scope exits return to normal,18CD retained',()=>{
  setup();local.run(`player.x=map.sites[0].x;player.z=map.sites[0].z;match.spike.status='carried';match.spike.carrier=player.id;inventory.active='spike';activateAbility(player,'e',{zonePoint:{x:player.x,y:0,z:player.z}});interactionHeld=true;updateInteraction(.1,true)`);near(local.run('match.spike.plantProgress'),.1,'in flight');land();local.run('updateInteraction(1,true)');near(local.run('match.spike.plantProgress'),1.6,'landed work');assert.equal(local.run('ordinarySkills.clockFrozen(elapsed)'),false);assert.equal(local.run('player.kit.nextSignatureAt'),28);
 });
 check('prediction for all4 spends stock only; full20 rejection restores stock and X points',()=>{
  for(const key of['c','q','e','x']){setup();assert.ok(local.run(`activateAbility(player,'${key}',{predict:true,zonePoint:{x:0,y:0,z:-10}})`));assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('nobiBulletDamage(player,enemy,26,78,true)'),26);}
  setup();local.run(`for(let i=0;i<20;i++)ordinarySkills.cast('nobi-tool',{...ordinaryActorView(player),id:'p'+i},ordinaryActorView(player),elapsed,match.round);var before=player.kit.snapshot()`);for(const key of['c','q','e','x'])assert.equal(local.run(`activateAbility(player,'${key}',${options})`),undefined);assert.deepEqual(copy(local.run('player.kit.snapshot()')),copy(local.run('before')));
 });
 check('JSON strict16 fields, immutable fixed center and local death/team/newR cleanup',()=>{
  setup();for(const key of['c','q','e','x'])assert.ok(local.run(`activateAbility(player,'${key}',${options})`));const rows=copy(local.run('ordinarySkills.snapshot()'));assert.equal(rows.events.length,4);assert.ok(rows.events.every(e=>Object.keys(e).length===16&&e.radius===20&&e.flight===.6&&!e.targetId));land();local.run('player.x=40');assert.ok(local.run('ordinarySkills.events(elapsed).every(e=>e.x===0)'));local.run('player.alive=false;player.hp=0;updateOrdinarySkills()');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);setup();local.run(`activateAbility(player,'e',${options});player.team='red';updateOrdinarySkills()`);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);local.run('ordinarySkills.update([],elapsed,match.round+1)');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);
 });
 check('independent host guest snapshots deduplicate; restored area uses guest own pose, no speculative HP',()=>{
  const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.kit=new DuelistKit({character:'nobi'});player.kit.smoke=2;player.kit.ultPoints=7;match.phase='live';activateAbility(player,'e',{zonePoint:{x:0,y:0,z:0}});activateAbility(player,'x',{zonePoint:{x:0,y:0,z:0}});elapsed+=.7;onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p}};var captured;tickOnline(.1)`);guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','player')`);guest.sandbox.transfer=copy(host.run('captured'));guest.run('receiveNetPacket(\'host\',transfer);receiveNetPacket(\'host\',transfer)');near(guest.run('ordinarySkills.nobiWork(player.id,elapsed,player,ordinaryReachable)'),1.5,'guest tool');assert.equal(guest.run('ordinarySkills.events(elapsed).length'),2);guest.run('player.x=25');near(guest.run('ordinarySkills.nobiWork(player.id,elapsed,player,ordinaryReachable)'),1,'guest moved out');
 });
 check('ally remote worker receives E field and X bullet conversion; opposite team cannot benefit',()=>{
  setup();local.run(`enemy.team=player.team;enemy.kit=new DuelistKit({character:'nope'});activateAbility(player,'e',${options});activateAbility(player,'x',${options})`);land();near(local.run('ordinarySkills.nobiWork(enemy.id,elapsed,enemy,ordinaryReachable)'),1.5,'ally');assert.ok(local.run('ordinarySkills.nobiLegend(enemy.id,elapsed,enemy,ordinaryReachable)'));local.run("enemy.team='red'");near(local.run('ordinarySkills.nobiWork(enemy.id,elapsed,enemy,ordinaryReachable)'),1,'enemy');
 });
 check('host remote ability request recomputes landing and duplicate action consumes once',()=>{
  setup();local.run(`enemy.kit=new DuelistKit({character:'nobi'});enemy.kit.smoke=2;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);var packet={type:'input',seq:1,connection:'nobi-area',round:match.round,input:{x:0,y:0,z:-10,yaw:Math.PI,pitch:-.04},actions:[{type:'ability',seq:1,round:match.round,key:'c',yaw:Math.PI,pitch:-.04}]};receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016)`);assert.equal(local.run('enemy.kit.smoke'),1);assert.equal(local.run("ordinarySkills.events(elapsed).filter(e=>e.type==='nobi-bell').length"),1);assert.equal(local.run('nobiBulletDamage(enemy,player,26,78,true)'),26);land();assert.equal(local.run('ordinarySkills.events(elapsed).length'),1);
 });
 check('actual BOT throws only at visible opponent; wall-hidden target never cast',()=>{
  setup();local.run(`enemy.kit=new DuelistKit({character:'nobi'});enemy.kit.smoke=2;enemy.nextSkillAt=0;enemy.yaw=Math.PI;enemy.group.rotation.y=0;enemy.think=0;updateBots(.01)`);assert.ok(local.run("ordinarySkills.events(elapsed).some(e=>e.type==='nobi-bell')"));
  setup();local.wall({z:-5});local.run(`enemy.kit=new DuelistKit({character:'nobi'});enemy.kit.smoke=2;enemy.kit.ultPoints=7;enemy.nextSkillAt=0;enemy.yaw=Math.PI;enemy.group.rotation.y=0;enemy.think=0;updateBots(.01)`);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);
 });
 check('real HUD shows active area statuses and clears outside; render positions follow thrown arc',()=>{
  setup();local.run(`activateAbility(player,'e',{zonePoint:{x:0,y:0,z:0}});activateAbility(player,'x',{zonePoint:{x:0,y:0,z:0}})`);land();local.run('updateHUD()');assert.match(local.elements.get('status-effects').textContent,/ポケット工具/);assert.match(local.elements.get('status-effects').textContent,/逆転えり/);local.run('player.x=30;updateHUD()');assert.doesNotMatch(local.elements.get('status-effects').textContent,/ポケット工具/);
 });

 check('throw pose blocks local/host remote firing .32s and releases without extra ammo loss',()=>{
  setup();local.run(`activateAbility(player,'c',${options});shoot()`);assert.equal(local.run('player.ammo'),12);local.run('elapsed+=.321;shoot()');assert.equal(local.run('player.ammo'),11);
  setup();local.run(`enemy.kit=new DuelistKit({character:'nobi'});enemy.kit.smoke=2;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};activateAbility(enemy,'c',{zonePoint:{x:0,y:0,z:0}});applyRemoteAction(enemy,{type:'fire',seq:1,yaw:Math.PI,pitch:0})`);assert.equal(local.run('enemy.netAmmo'),12);local.run('elapsed+=.321;applyRemoteAction(enemy,{type:\'fire\',seq:2,yaw:Math.PI,pitch:0})');assert.equal(local.run('enemy.netAmmo'),11);
 });
 check('all4 throws keep their cast distances, collision-clipped arc and floor landing',()=>{
  for(const [key,range]of[['c',35],['q',40],['e',35],['x',35]]){setup();assert.ok(local.run(`activateAbility(player,'${key}',{zonePoint:{x:100,y:0,z:0}})`));const row=copy(local.run('ordinarySkills.events(elapsed)[0]'));assert.ok(Math.hypot(row.x,row.z)<=range+1e-7);assert.ok(Math.hypot(row.x,row.z)>range-1);near(row.y,.12,'floor');}
  setup();local.wall({x:5,z:0,width:.3,depth:15,height:4});assert.ok(local.run(`activateAbility(player,'c',{zonePoint:{x:30,y:0,z:0}})`));assert.ok(local.run('ordinarySkills.events(elapsed)[0].x')<4.85);
 });
 check('host owned allied guest uses actual E off progress after landing, one worker and death cancellation',()=>{
  setup();local.run(`enemy.team=match.defenderTeam;player.team=match.defenderTeam;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;enemy.x=0;enemy.z=0;match.spike.status='planted';match.spike.carrier=null;match.spike.x=0;match.spike.z=0;match.spike.timer=45;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);activateAbility(player,'e',{zonePoint:{x:0,y:0,z:0}})`);land();local.run(`netInputs.set('guest',{seq:1,connection:'nobi-work',round:match.round,input:{x:0,y:0,z:0,interact:true},actions:[],received:elapsed});updateRemoteActor(enemy,1)`);near(local.run('match.spike.defuseProgress'),1.5,'ally guest work');local.run(`match.interactDefuse(1,{actorId:'other',team:match.defenderTeam})`);near(local.run('match.spike.defuseProgress'),1.5,'one owner');assert.equal(local.run('match.spike.timer'),45);local.run('player.alive=false;player.hp=0;updateOrdinarySkills()');near(local.run('ordinarySkills.nobiWork(enemy.id,elapsed,enemy,ordinaryReachable)'),1,'source death');
 });
 console.log(`PASS: ${groups} actual-game nobi throw groups; audio/rendering inert`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
