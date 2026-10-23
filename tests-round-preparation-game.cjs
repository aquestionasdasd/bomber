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
  const imported = {};let source = fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8');
  if(process.env.PREPARATION_FAULT){
    const mutations={
      floor:["if(!isGuest())placeStartingBomber();","/* fault: initial owner kept */"],
      local:["const objectiveWork=mode==='play'&&interactionHeld?objectiveActionFor(player):null;","const objectiveWork=null;"],
      remote:["if(objectiveWork){dx=0;dz=0;actor.vx=0;actor.vz=0;}","/* fault: accept forged move */"],
      barrier:["const permitted=(x,z)=>buyAreaContains(area,x,z,r);","const permitted=()=>true;"]
    },pair=mutations[process.env.PREPARATION_FAULT];
    if(!pair||!source.includes(pair[0]))throw Error('Mutation anchor missing');source=source.replace(...pair);
  }
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
    return { sandbox, run, seed, wall, clearWalls, reset, elements, listeners };
  }










 const h=harness();
 function setup(side='attack'){
  h.reset();h.sandbox.side=side;
  h.run("match=new MatchRules({startingSide:side});match.startLive();match.drainEvents();Object.assign(player,{x:0,z:0,y:0,vy:0,vx:0,vz:0,team:'blue',dashTimer:0,trafficLaunch:null,carImpulseUntil:0});map.sites[0]={id:'A',x:0,z:0,radius:5};keys.clear();interactionHeld=false;makeBot({x:70,z:70},0,'red',{id:'red-0',team:'red',primary:null,secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});bots[0].rangeTarget=true;");
 }
 function key(code,up=false){for(const fn of h.listeners.get(up?'keyup':'keydown')||[])fn({code,repeat:false,preventDefault(){},target:{}});}
 function remote(side='attack'){
  setup(side);h.run("var remote=bots[0];remote.rangeTarget=false;remote.remoteId='guest';remote.x=0;remote.z=0;remote.y=0;remote.vy=0;remote.kit=new DuelistKit({character:'nope'});remote.team=match.attackerTeam;remote.record.team=remote.team;netInputs.set('guest',{seq:1,connection:'test',round:match.round,received:elapsed,input:{x:2,z:2,y:1,interact:true},actions:[]});Object.assign(match.spike,{status:'carried',carrier:remote.id});");
 }
 check('both real maps spawn one uncarried floor bomber, clear of starting actors; nextR/side switch repeat',()=>{
  const real=harness({realMap:true});real.reset();
  for(const id of['hashimoto','hirakata'])for(const side of['attack','defend']){
   real.sandbox.id=id;real.sandbox.side=side;real.run("selectArena(id);navigation=createNavigation({...map,bounds:activeArenaBounds()});match=new MatchRules({startingSide:side});spawnRound(true);var s=match.spike;");
   assert.equal(real.run('s.status'),'dropped');assert.equal(real.run('s.carrier'),null);assert.ok(real.run('canStand(s.x,s.z,.34,0)'));assert.ok(real.run('Math.min(...map.teamSpawns.attack.map(p=>Math.hypot(p.x-s.x,p.z-s.z)))>1.8'));
   real.run("match.round=13;match.resetSpike();spawnRound();");assert.equal(real.run('match.spike.status'),'dropped');assert.equal(real.run('match.spike.carrier'),null);
  }
 });
 check('buy-phase floor pickup is attacker-only/grounded and live pickup remains; no repeated pickup',()=>{
  setup();h.run("match.phase='buy';match.dropSpike('player',0,0);player.y=1;updateInteraction(.05,true)");assert.equal(h.run('match.spike.status'),'dropped');h.run("player.y=0;player.team=match.defenderTeam;updateInteraction(.05,true)");assert.equal(h.run('match.spike.status'),'dropped');h.run("player.team=match.attackerTeam;updateInteraction(.05,true)");assert.equal(h.run('match.spike.carrier'),'player');h.run("var count=match.events.filter(e=>e.type==='pickup').length;updateInteraction(.05,true)");assert.equal(h.run("match.events.filter(e=>e.type==='pickup').length"),h.run('count'));
  h.run("match.dropSpike('player',0,0);match.phase='live';updateInteraction(.05,true)");assert.equal(h.run('match.spike.carrier'),'player');
 });
 check('guest cannot predict pickup ownership; host accepts a nearby buy-phase pickup and ignores airborne input',()=>{
  setup();h.run("match.phase='buy';match.dropSpike('player',0,0);onlinePlaying=true;online={host:false};updateInteraction(.05,true)");assert.equal(h.run('match.spike.status'),'dropped');
  remote();h.run("match.phase='buy';match.dropSpike(remote.id,0,0);netInputs.get('guest').input={x:0,z:0,y:1};updateRemoteActor(remote,.05)");assert.equal(h.run('match.spike.status'),'dropped');h.run("remote.y=0;remote.vy=0;netInputs.get('guest').input={x:0,z:0,y:0};updateRemoteActor(remote,.05)");assert.equal(h.run('match.spike.carrier'),h.run('remote.id'));
 });
 check('expanded real-map barriers reach all three fronts; visible edges and authoritative local/remote bounds agree',()=>{
  const real=harness({realMap:true});real.reset();for(const id of['hashimoto','hirakata']){
   real.sandbox.id=id;real.run("selectArena(id);match.phase='buy';exploring=false;syncBuyBarrier();var a=map.buyAreas.attack,d=map.buyAreas.defend;");
   for(const x of[-65,0,65]){real.sandbox.x=x;assert.ok(real.run('buyAreaContains(a,x,20,.34)'));assert.ok(real.run('buyAreaContains(d,x,-5,.34)'));assert.equal(real.run('buyAreaContains(a,x,0,.34)'),false);assert.equal(real.run('buyAreaContains(d,x,0,.34)'),false);}
   assert.equal(real.run('buyBarrier.geometry.getAttribute("position").count'),24);assert.equal(real.run('buyBarrier.position.y'),0);assert.ok(real.run('map.teamSpawns.attack.every(p=>buyAreaContains(a,p.x,p.z,.34))&&map.teamSpawns.defend.every(p=>buyAreaContains(d,p.x,p.z,.34))'));
  }
  setup();h.run("map.buyAreas.attack={minX:-82,maxX:82,minZ:18,maxZ:82};match.phase='buy';player.z=18.34;moveEntity(player,0,-2)");assert.ok(h.run('player.z>=18.34-1e-8'));h.run("match.phase='live';moveEntity(player,0,-2)");assert.ok(h.run('player.z<18'));
  remote();h.run("map.buyAreas.attack={minX:-82,maxX:82,minZ:18,maxZ:82};match.phase='buy';remote.z=18.34;netInputs.get('guest').input={x:0,z:0,y:0};updateRemoteActor(remote,.05)");assert.ok(h.run('remote.z>=18.34-1e-8'));
 });
 check('hold4 stops movement/inertia immediately at20/60/144Hz; F never plants; releasing4 resumes movement and cancels',()=>{
  for(const hz of[20,60,144]){
   setup();key('KeyF');h.run('updatePlay(.05)');assert.equal(h.run('match.spike.plantProgress'),0);key('KeyF',true);h.run('player.vx=5;player.vz=-5');key('KeyW');key('Digit4');h.sandbox.hz=hz;h.run('for(var i=0;i<hz/2;i++)updatePlay(1/hz)');assert.equal(h.run('player.x'),0);assert.equal(h.run('player.z'),0);assert.equal(h.run('player.vx'),0);assert.equal(h.run('player.vz'),0);assert.ok(h.run('match.spike.plantProgress>.49'));assert.equal(h.run('inventory.active'),'spike');
   key('Digit4',true);h.run('updatePlay(.05)');assert.ok(h.run('player.z<0'));assert.equal(h.run('match.spike.plantProgress'),0);
  }
 });
 check('holding4 plus movement completes plant in four seconds without moving; no shooting or reload during work',()=>{
  setup();key('KeyW');key('Digit4');h.run('for(var i=0;i<79;i++)updatePlay(.05)');assert.equal(h.run('match.spike.status'),'carried');assert.equal(h.run('player.z'),0);h.run('updatePlay(.05)');assert.equal(h.run('match.spike.status'),'planted');assert.equal(h.run('match.spike.site'),'A');
 });
 check('defusing4 locks movement, retains3.5second checkpoint, completes at7; other active defuser cannot be stolen',()=>{
  setup('defend');h.run("match.interactPlant(4,{actorId:'red-0',team:match.attackerTeam,site:'A',x:0,z:0});");key('KeyD');key('Digit4');h.run('for(var i=0;i<71;i++)updatePlay(.05)');assert.equal(h.run('player.x'),0);assert.equal(h.run('match.spike.checkpoint'),3.5);key('Digit4',true);h.run('updatePlay(.05)');assert.ok(h.run('player.x>0'));assert.equal(h.run('match.spike.defuseProgress'),3.5);key('KeyD',true);key('Digit4');h.run('for(var i=0;i<70;i++)updatePlay(.05)');assert.equal(h.run('match.spike.status'),'defused');
  setup('defend');h.run("Object.assign(match.spike,{status:'planted',x:0,z:0,defuseActor:'other',defuseProgress:1});interactionHeld=true;keys.add('KeyD');updatePlay(.05)");assert.ok(h.run('player.x>0'));assert.equal(h.run('match.spike.defuseActor'),'other');
 });
 check('invalid4/no carrier/airborne/dash/outside site does not freeze normal movement or allow planting',()=>{
  for(const state of["player.x=15","match.spike.carrier='other'","player.y=1;player.vy=1","player.dashTimer=.18;player.dashVec={x:1,z:0}"]){setup();h.run(state);h.run("var x=player.x,z=player.z;interactionHeld=true;keys.add('KeyW');updatePlay(.05)");assert.ok(h.run('Math.hypot(player.x-x,player.z-z)>0'));assert.equal(h.run('match.spike.plantProgress'),0);}
 });
 check('host ignores forged remote movement/elevation while4 planting and sends bounded position ACK; release/stale/death cancels',()=>{
  remote();h.run('updateRemoteActor(remote,.05)');assert.equal(h.run('remote.x'),0);assert.equal(h.run('remote.z'),0);assert.equal(h.run('remote.y'),0);assert.equal(h.run('remote.netPositionAck.seq'),1);assert.equal(h.run('match.spike.plantActor'),h.run('remote.id'));assert.ok(h.run('match.spike.plantProgress>0'));
  h.run("netInputs.get('guest').input.interact=false;updateRemoteActor(remote,.05)");assert.ok(h.run('remote.x>0'));assert.equal(h.run('match.spike.plantProgress'),0);
  remote();h.run("updateRemoteActor(remote,.05);netInputs.get('guest').received=elapsed-1;updateRemoteActor(remote,.05)");assert.equal(h.run('match.spike.plantProgress'),0);
  remote();h.run("updateRemoteActor(remote,.05);remote.alive=false;updateRemoteActor(remote,.05)");assert.equal(h.run('match.spike.plantProgress'),0);
 });
 check('host remote defuse locks forged movement/elevation; ordinary inputs outside objective remain movable',()=>{
  remote('defend');h.run("remote.team=match.defenderTeam;Object.assign(match.spike,{status:'planted',carrier:null,x:0,z:0});updateRemoteActor(remote,.05)");assert.equal(h.run('remote.x'),0);assert.equal(h.run('remote.z'),0);assert.equal(h.run('remote.y'),0);assert.equal(h.run('match.spike.defuseActor'),h.run('remote.id'));
  remote();h.run("remote.x=15;netInputs.get('guest').input={x:16,z:0,y:0,interact:true};updateRemoteActor(remote,.05)");assert.ok(h.run('remote.x>15'));assert.equal(h.run('match.spike.plantProgress'),0);
 });
 check('practice mode keeps explicit carrier/defender fixture and updated4 instructions; complete/reset clears held movement lock',()=>{
  setup();h.run("objectivePractice={kind:'plant',site:'A',completed:false};resetObjectivePractice('A')");assert.equal(h.run('match.spike.carrier'),'player');key('Digit4');h.run('for(var i=0;i<81;i++)updatePlay(.05)');assert.ok(h.run('objectivePractice.completed'));assert.equal(h.run('interactionHeld'),false);h.run("resetObjectivePractice('A')");assert.equal(h.run('match.spike.status'),'carried');assert.equal(h.run('interactionHeld'),false);
  const html=fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8');assert.ok(html.includes('4 長押し'));assert.ok(!html.includes('F長押し'));assert.ok(!html.includes('Fを4秒'));
 });
 console.log('PASS '+groups+' round preparation/objective actual-game groups; silent; '+Math.round(performance.now()-started)+'mswall');
}main().catch(e=>{console.error(e);process.exitCode=1;});
