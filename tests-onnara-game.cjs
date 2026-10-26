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
 function setup(){local.reset();local.clearWalls();local.run(`netApplied.clear();netInputs.clear();clearDrops();effectsGroup.clear();effects.length=0;syncSmokes([]);player.kit=new DuelistKit({character:'onnara'});player.kit.smoke=2;player.kit.updraft=1;player.kit.ultPoints=7;match.phase='live';match.credits=800;makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',primary:'spectre',secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.aiWeapon='spectre';enemy.aiAmmo=18;enemy.aiReserve=40;enemy.aiReload=0;enemy.fire=999;enemy.reactionUntil=999;enemy.group.position.set(0,0,-10);`);}
 const aim='{aim:{yaw:0,pitch:-.04}}';
 check('C immediately jumps without target or tax; normal firing leaves enemy HP and coin unchanged',()=>{setup();local.run("useAbility('c')");assert.equal(local.run('duckAim'),null);assert.equal(local.run('player.vy'),12);assert.equal(local.run('player.kit.smoke'),1);assert.equal(local.run('ordinarySkills.onnaraTax(enemy.id,elapsed)'),null);local.run("enemy.remoteId='guest';enemy.netWeapon='spectre';enemy.netAmmo=18;enemy.netReserve=40;enemy.netReload=0;applyRemoteAction(enemy,{type:'fire',yaw:1,pitch:0},elapsed)");assert.equal(local.run('enemy.record.credits'),800);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('enemy.netAmmo'),17);});
 check('C is self movement independent of enemy visibility, aim, wall, smoke, team or range',()=>{for(const kind of['wall','smoke','friend','far','aim']){setup();if(kind==='wall')local.wall({z:-5});if(kind==='smoke')local.run("syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:-5,radius:3.6,expires:100}])");if(kind==='friend')local.run('enemy.team=player.team');if(kind==='far')local.run('enemy.z=-45');assert.ok(local.run("activateAbility(player,'c')"),kind);assert.equal(local.run('player.vy'),12);assert.equal(local.run('player.kit.smoke'),1);}});
 check('Q actual floor/yaw camera placement beyond local skill radius, no actor damage or remote aim mutation',()=>{setup();assert.ok(local.run(`activateAbility(player,'q',{aim:{yaw:.5,pitch:-.1}})`));assert.ok(local.run(`ordinarySkills.onnaraEvent('onnara-orb',player.id,elapsed).z`)<-10);assert.equal(local.run('player.pitch'),0);assert.equal(local.run('player.yaw'),0);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('player.kit.updraft'),0);});
 check('E rejects grounded, holds airborne Y13seconds at20/60/144Hz, then resumes gravity',()=>{for(const hz of[20,60,144]){setup();assert.equal(local.run(`activateAbility(player,'e')`),undefined);local.run(`player.y=1.1;player.vy=2;activateAbility(player,'e');for(let i=0;i<${hz};i++){elapsed+=1/${hz};updateActorVertical(player,1/${hz});}`);near(local.run('player.y'),1.1,'height');near(local.run('player.vy'),0,'velocity');local.run(`elapsed+=11.99;updateActorVertical(player,.01)`);near(local.run('player.y'),1.1,'held at12.99seconds');local.run(`elapsed+=.02;updateActorVertical(player,.05)`);assert.ok(local.run('player.y')<1.1);}
 setup();local.run(`player.y=1.1;player.vy=2;activateAbility(player,'e');var old=ordinarySkills.snapshot()`);local.wall({x:0,z:0,width:2,depth:2,height:1.2});local.run(`applyStarHold(player);ordinarySkills.restore(old,elapsed,match.round)`);assert.equal(local.run('applyStarHold(player)'),false);});
 check('20event rejection rolls back all4 stock/CD/7pt; guest predicts jump impulse only, no event/HP/coin authority',()=>{for(const key of['c','q','e','x']){setup();if(key==='e')local.run('player.y=1.1;player.vy=2');local.run(`for(let i=0;i<20;i++)ordinarySkills.cast('cap-bank',{...ordinaryActorView(player),id:'p'+i},ordinaryActorView(player),elapsed,match.round)`);const before=copy(local.run('player.kit.snapshot()'));assert.equal(local.run(`activateAbility(player,'${key}',${aim})`),undefined,key);assert.deepEqual(copy(local.run('player.kit.snapshot()')),before);
 setup();if(key==='e')local.run('player.y=1.1;player.vy=2');assert.ok(local.run(`activateAbility(player,'${key}',{predict:true,aim:{yaw:0,pitch:-.04}})`),key);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('match.credits'),800);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('player.vy'),key==='e'?2:key==='c'?12:0);}});
 check('X actual HP+armor damage chains70percent once to nearest visible enemy; no skill/reflection/secondary chains',()=>{for(const kind of['normal','skill','subray','wall','smoke','far']){setup();local.run(`activateAbility(player,'x');makeBot({x:3,z:-10},1,'red',{id:'second',team:'red',primary:'spectre',secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var second=bots[1];second.hp=100;second.alive=true;`);if(kind==='wall')local.wall({x:1.5,z:-10,width:.3,depth:4});if(kind==='smoke')local.run(`syncSmokes([{id:1,kind:'smoke',x:1.5,y:1.6,z:-10,radius:3.6,expires:100}])`);if(kind==='far')local.run('second.x=13');local.run(`damageEntity(enemy,20,player,{firearm:${kind!=='skill'},chain:${kind!=='subray'}})`);near(local.run('enemy.hp'),80,'primary');near(local.run('second.hp'),kind==='normal'?86:100,kind);if(kind==='normal')assert.ok(local.run(`ordinarySkills.onnaraEvent('onnara-chain',player.id,elapsed).link`));}});

 check('actual primary bullet activates chain and transfers only actual damage, remote hover ignores proposed Y while active',()=>{setup();local.run(`makeBot({x:3,z:-10},1,'red',{id:'second',team:'red',primary:'spectre',secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var second=bots[1];second.hp=100;second.alive=true;second.group.position.set(3,0,-10);activateAbility(player,'x');player.yaw=0;player.pitch=-.04;mode='play';shoot(elapsed)`);assert.ok(local.run('enemy.hp')<100);assert.ok(local.run('second.hp')<100);assert.equal(local.run('player.ammo'),11);
 setup();local.run(`enemy.kit=new DuelistKit({character:'onnara'});enemy.remoteId='guest';enemy.y=1.2;enemy.vy=2;activateAbility(enemy,'e');netInputs.set('guest',{seq:1,connection:'hover',round:match.round,received:elapsed,actions:[],input:{x:0,y:5,z:-10,yaw:0,pitch:0}});updateRemoteActor(enemy,.05)`);near(local.run('enemy.y'),1.2,'host hold clamps guest pose');near(local.run('enemy.vy'),0,'host hover vy');});
 check('local taxed shooting spends once; simultaneous trident subrays do not multiply tax',()=>{setup();local.run(`ordinarySkills.cast('onnara-tax',ordinaryActorView(enemy),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round);player.kit=new DuelistKit({character:'urchin'});player.kit.ultPoints=7;activateAbility(player,'x');player.yaw=1;mode='play';shoot(elapsed);shoot(elapsed)`);assert.equal(local.run('match.credits'),770);assert.equal(local.run('player.ammo'),11);assert.equal(local.run('effects.filter(e=>e.object.isLine).length'),3);});
 check('independent hostguest JSON carries camera, hover, tax budget and chain cue; stale packet cannot replay cleared effects',()=>{const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.kit=new DuelistKit({character:'onnara'});player.kit.smoke=2;match.phase='live';makeBot({x:0,z:-10},1,'red',{id:'red-1',team:'red',primary:'spectre',secondary:'classic',credits:800,kit:new DuelistKit({character:'onnara'})});var remote=bots[0];remote.remoteId='guest';remote.netAmmo=18;remote.netReserve=40;remote.netWeapon='spectre';remote.netReload=0;remote.kit.ultPoints=7;remote.kit.updraft=1;remote.y=1;remote.vy=2;onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p}};netParticipants.set('guest','red-1');var captured;ordinarySkills.cast('onnara-tax',ordinaryActorView(player),{...ordinaryActorView(remote),targetId:remote.id},elapsed,match.round);activateAbility(remote,'e');activateAbility(remote,'q',{aim:{yaw:1,pitch:-.1}});activateAbility(remote,'x');crownShot(remote);ordinarySkills.recordConstellation(remote.id,{x:0,y:1,z:0},{x:1,y:1,z:0},elapsed);tickOnline(.1)`);guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-1')`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer)`);assert.equal(guest.run('match.credits'),770);assert.equal(guest.run('player.hp'),96);guest.run('crownShot(player);receiveNetPacket("host",transfer)');assert.equal(guest.run('player.hp'),96);assert.equal(guest.run('ordinarySkills.onnaraTax(player.id,elapsed).power'),270);assert.ok(guest.run(`ordinarySkills.onnaraEvent('onnara-orb',player.id,elapsed)`));assert.ok(guest.run(`ordinarySkills.onnaraEvent('onnara-chain',player.id,elapsed).link`));assert.equal(guest.run('applyStarHold(player)'),true);near(guest.run('player.y'),1,'ACK height');
 host.run('elapsed+=.3;resetOrdinarySkills();tickOnline(.1)');guest.sandbox.fresh=copy(host.run('captured'));guest.run(`receiveNetPacket('host',fresh);receiveNetPacket('host',transfer)`);assert.equal(guest.run('ordinarySkills.events(elapsed).length'),0);});
 check('actual BOT uses seen jump/Q and grouped-enemy X, never marks through wall; cleanup clears FX and hover',()=>{setup();local.run(`enemy.hp=40;enemy.kit=new DuelistKit({character:'onnara'});enemy.kit.smoke=2;enemy.kit.updraft=1;enemy.kit.ultPoints=7;enemy.group.rotation.y=0;enemy.target=player;enemy.nextSkillAt=0;enemy.fire=999;enemy.reactionUntil=0;updateBots(.05)`);assert.ok(local.run("ordinarySkills.onnaraEvent('onnara-jump',enemy.id,elapsed)"));assert.equal(local.run('ordinarySkills.onnaraTax(player.id,elapsed)'),null);assert.ok(local.run(`ordinarySkills.onnaraEvent('onnara-orb',enemy.id,elapsed)`));local.run('player.alive=false;player.hp=0;updateOrdinarySkills();resetOrdinarySkills()');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('onnaraSkillFX.group.children.length'),0);});
 check('empty-wallet remote firing pays HP once per accepted trigger, not rate-denied, empty-magazine or knife actions',()=>{
  setup();local.run(`ordinarySkills.cast('onnara-tax',ordinaryActorView(player),{...ordinaryActorView(enemy),targetId:enemy.id},elapsed,match.round);enemy.remoteId='guest';enemy.netWeapon='spectre';enemy.netAmmo=18;enemy.netReserve=40;enemy.netReload=0;enemy.record.credits=0;enemy.armor=50;for(let i=0;i<10;i++){elapsed+=.2;applyRemoteAction(enemy,{type:'fire',yaw:1,pitch:0},elapsed);applyRemoteAction(enemy,{type:'fire',yaw:1,pitch:0},elapsed);}`);assert.equal(local.run('enemy.hp'),60);assert.equal(local.run('enemy.armor'),50);assert.equal(local.run('enemy.netAmmo'),8);assert.equal(local.run('enemy.record.credits'),0);assert.equal(local.run('ordinarySkills.onnaraTax(enemy.id,elapsed).power'),0);
  setup();local.run(`ordinarySkills.cast('onnara-tax',ordinaryActorView(player),{...ordinaryActorView(enemy),targetId:enemy.id},elapsed,match.round);enemy.remoteId='guest';enemy.netWeapon='spectre';enemy.netAmmo=0;enemy.netReserve=0;enemy.netReload=0;applyRemoteAction(enemy,{type:'fire',yaw:1,pitch:0},elapsed)`);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('ordinarySkills.onnaraTax(enemy.id,elapsed).power'),300);
 });
 check('BOT orb uses the same rotating FOV, LOS and smoke as the player view and stores a fixed contact only',()=>{
  for(const kind of['front','quarter','back','wall','smoke']){
   setup();local.run(`enemy.kit=new DuelistKit({character:'onnara'});enemy.group.rotation.y=Math.PI;enemy.nextSkillAt=999;enemy.target=null;ordinarySkills.cast('onnara-orb',ordinaryActorView(enemy),{x:0,y:0,z:5,yaw:0},elapsed,match.round);`);
   if(kind==='quarter')local.run('elapsed+=2');if(kind==='back')local.run('elapsed+=4');if(kind==='wall')local.wall({z:2.5});if(kind==='smoke')local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:2.5,radius:3.6,expires:100}])`);
   local.run('updateBots(.001)');assert.equal(!!local.run('enemy.lastHeard'),kind==='front',kind);
   if(kind==='front'){const point=copy(local.run('enemy.lastHeard'));assert.ok(!('targetId' in point));local.run('player.x=8;player.z=0');assert.deepEqual(copy(local.run('enemy.lastHeard')),point);}
  }
 });
 console.log(`PASS: ${groups} ONNARA saved-game authority/collision/JSON/cleanup groups; no audio`);
 console.log(`TOTAL ${Math.round(performance.now()-started)}ms wall / ${Math.round(process.cpuUsage(cpuStarted).user/1000)}ms CPU`);
}main().catch(e=>{console.error(e);process.exitCode=1;});
