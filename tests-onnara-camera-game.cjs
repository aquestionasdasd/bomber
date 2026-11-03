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
 function setup(){local.reset();local.clearWalls();local.run(`mode='play';match.phase='live';player.kit=new DuelistKit({character:'onnara'});player.kit.updraft=2;makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',primary:'spectre',secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.group.position.set(0,0,-10);`);}
 check('two hand launches, full vertical aim, 15second expiry and third attempt preserves stock',()=>{
  setup();assert.equal(local.run("getCharacterSkill('onnara','q').max"),2);
  assert.ok(local.run("activateAbility(player,'q',{aim:{yaw:0,pitch:0}})"));
  let e=copy(local.run('ordinarySkills.events(elapsed)[0]'));near(e.x,.24,'hand x');near(e.y,1.53,'hand y');near(e.z,-.6,'hand z');assert.equal(e.flight,15);assert.equal(e.endsAt-e.startedAt,15);assert.equal(e.fromZ,-12);
  assert.ok(local.run("activateAbility(player,'q',{aim:{yaw:0,pitch:1.5}})"));assert.equal(local.run('ordinarySkills.events(elapsed).length'),2);local.run('player.kit.updraft=1');assert.equal(local.run("activateAbility(player,'q',{aim:{yaw:0,pitch:0}})"),undefined);assert.equal(local.run('player.kit.updraft'),1);
  local.run('elapsed+=14.999;updateOrdinarySkills()');assert.equal(local.run('ordinarySkills.events(elapsed).length'),2);local.run('elapsed+=.001;updateOrdinarySkills()');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);
 });
 check('host reflects thin walls, floor and ceiling at20/60/144Hz without gravity or HP effects',()=>{
  for(const hz of[20,60,144]){setup();local.wall({z:-3,depth:.02});local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}});for(let i=0;i<${hz/2};i++){elapsed+=1/${hz};updateOrdinarySkills();}`);const e=copy(local.run('ordinarySkills.events(elapsed)[0]'));assert.ok(e.z>-.5,JSON.stringify(e));near(e.y,1.53,'no gravity',.001);assert.equal(e.fromZ,12);assert.equal(local.run('enemy.hp'),100);}
  setup();local.wall({x:0,z:0,width:8,depth:8,height:3});local.run('map.colliders[0].base=2.6;map.collision.invalidate()');local.run("activateAbility(player,'q',{aim:{yaw:0,pitch:1.45}});elapsed+=.06;updateOrdinarySkills()");assert.ok(local.run('ordinarySkills.events(elapsed)[0].fromY')<0);
  setup();local.run("activateAbility(player,'q',{aim:{yaw:0,pitch:-1.45}});elapsed+=.2;updateOrdinarySkills()");assert.ok(local.run('ordinarySkills.events(elapsed)[0].fromY')>0);assert.ok(local.run('ordinarySkills.events(elapsed)[0].y')>=.19);
 });
 check('main overlay only for camera-seen enemies; player wall, camera wall, smoke, FOV and friend gates',()=>{
  setup();local.run("activateAbility(player,'q',{aim:{yaw:0,pitch:0}});player.z=3");local.wall({z:1});local.run('updateOnnaraReveal()');assert.equal(local.run('visibleBetween(player,enemy)'),false);assert.ok(local.run('onnaraReveal.group.children.length')>0);
  assert.equal(local.run('onnaraReveal.group.children.every(o=>o.material.depthTest===false&&o.material.depthWrite===false)'),true);
  assert.equal(local.run('onnaraReveal.group.children[0].geometry===enemy.group.getObjectById(onnaraReveal.group.children[0].id)?.geometry'),false);
  for(const kind of['wall','smoke','back','friend','dead','pause','blind']){setup();local.run("activateAbility(player,'q',{aim:{yaw:0,pitch:0}})");if(kind==='wall')local.wall({z:-5});if(kind==='smoke')local.run("syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:-5,radius:3.6,expires:100}])");if(kind==='back')local.run('enemy.z=8');if(kind==='friend')local.run('enemy.team=player.team');if(kind==='dead')local.run('player.alive=false');if(kind==='pause')local.run("mode='pause'");if(kind==='blind')local.run("ordinarySkills.cast('nope-flash',ordinaryActorView(player),{x:0,y:0,z:-2},elapsed,match.round);elapsed+=.5;updateOrdinarySkills()");local.run('updateOnnaraReveal()');assert.equal(local.run('onnaraReveal.group.children.length'),0,kind);}
 });
 check('same held gem persists through flight, reset removes overlay and props, death/team ends camera',()=>{
  setup();local.run("activateAbility(player,'q',{aim:{yaw:0,pitch:0}});elapsed+=1;updateOrdinarySkills();renderOrdinarySkills();updateOnnaraReveal()");assert.equal(local.run('preparedSkillFX.group.userData.activeFlights'),1);assert.equal(local.run('onnaraSkillFX.group.children.length'),0);
  for(const code of['player.alive=false','player.team="red"']){setup();local.run("activateAbility(player,'q',{aim:{yaw:0,pitch:0}});"+code+';updateOrdinarySkills()');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);}
  setup();local.run("activateAbility(player,'q',{aim:{yaw:0,pitch:0}});updateOnnaraReveal();resetOrdinarySkills()");assert.equal(local.run('onnaraReveal.group.children.length'),0);assert.equal(local.run('preparedSkillFX.group.children.length'),0);
 });
 check('20event rollback and guest prediction have no world motion or reveal authority',()=>{
  setup();local.run("for(let i=0;i<20;i++)ordinarySkills.cast('cap-bank',{...ordinaryActorView(player),id:'f'+i},ordinaryActorView(player),elapsed,match.round)");const before=copy(local.run('player.kit.snapshot()'));assert.equal(local.run("activateAbility(player,'q',{aim:{yaw:0,pitch:0}})"),undefined);assert.deepEqual(copy(local.run('player.kit.snapshot()')),before);
  setup();local.run("activateAbility(player,'q',{predict:true,aim:{yaw:0,pitch:0}});elapsed+=.1;updateOnnaraReveal()");assert.equal(local.run('player.kit.updraft'),1);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('onnaraReveal.group.children.length'),0);
  setup();local.run("onlinePlaying=true;online={host:false};netActions=Array.from({length:64},(_,i)=>({seq:i+1}));confirmOnnaraSkill('q')");assert.equal(local.run('player.kit.updraft'),2);assert.equal(local.run('netActions.length'),64);
 });
 check('independent JSON restores two current poses without host-owned integration and rejects forged velocity/lifetime/extra/third atomically',()=>{
  setup();local.run("activateAbility(player,'q',{aim:{yaw:.5,pitch:.4}});activateAbility(player,'q',{aim:{yaw:Math.PI,pitch:.5}});elapsed+=.4;updateOrdinarySkills()");const state=copy(local.run('ordinarySkills.snapshot()')),g=imported.createCharacterSkills();assert.equal(state.events.length,2);assert.equal(Object.keys(state.events[0]).length,17);assert.ok(g.restore(state,10.4,local.run('match.round')));const snap=copy(g.snapshot());g.update([copy(local.run('ordinaryActorView(player)'))],10.5,local.run('match.round'),{cameraSweep:()=>{throw Error('guest must not integrate');}});assert.deepEqual(copy(g.snapshot()),snap);
  for(const change of[s=>s.events[0].fromX=999,s=>s.events[0].flight=14,s=>s.events[0].endsAt++,s=>s.events[0].extra=1,s=>s.events.push({...s.events[0],id:'skill-onnara-orb-999'})]){const bad=copy(state);change(bad);assert.equal(g.restore(bad,10.5,local.run('match.round')),false);assert.deepEqual(copy(g.snapshot()),snap);}
  assert.equal(g.restore(state,10.3,local.run('match.round')),false);local.run('resetOrdinarySkills()');
 });
 console.log(`PASS: ${groups} flying camera saved-game groups; no audio`);
}main().catch(e=>{console.error(e);process.exitCode=1;});
