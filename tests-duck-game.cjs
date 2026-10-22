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
  function setup(){local.reset();local.run(`player.kit=new DuelistKit({character:'duck'});player.kit.smoke=2;player.kit.updraft=1;player.kit.ultPoints=7;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.fire=999;enemy.reactionUntil=999;`);}
  check('seal aims at actual visible enemy; wall/smoke/no-target refuse without charge',()=>{setup();assert.equal(local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:0}})?.type`),'duck-seal');assert.equal(local.run(`activateAbility(enemy,'e')`),undefined);assert.equal(local.run('enemy.kit.dash'),1);local.run('resetOrdinarySkills()');local.wall({z:-5});assert.equal(local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:0}})`),undefined);assert.equal(local.run('player.kit.smoke'),1);local.clearWalls();local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.4,z:-5,radius:3.6,expires:100}])`);assert.equal(local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:0}})`),undefined);assert.equal(local.run('player.kit.smoke'),1);local.run('syncSmokes([])');});
  check('two-stage aim cancels without spending; confirmation spends; death/pause clears',()=>{setup();local.run(`useAbility('c')`);assert.equal(local.run('duckAim'),'c');assert.equal(local.run('player.kit.smoke'),2);local.run(`useAbility('c')`);assert.equal(local.run('duckAim'),null);local.run(`useAbility('c');confirmDuckSkill('c')`);assert.equal(local.run('player.kit.smoke'),1);local.run('clearCombatInput()');assert.equal(local.run('duckAim'),null);});
  check('shield stops actual local shots; removing shield lets subsequent shot pass',()=>{setup();local.run(`ordinarySkills.cast('duck-shield',ordinaryActorView(player),{x:0,y:0,z:-5,yaw:0},elapsed,match.round);updateOrdinarySkills();shoot()`);assert.equal(local.run('enemy.hp'),100);assert.ok(local.run(`ordinarySkills.events(elapsed).find(e=>e.type==='duck-shield').power<180`));local.run(`resetOrdinarySkills();elapsed+=1;shoot()`);assert.ok(local.run('enemy.hp<100'));});
  check('host applies remote shots to shield before local player',()=>{setup();local.run(`Object.assign(enemy,{netWeapon:'classic',netAmmo:12,netReserve:36,netReload:0,lastNetShot:-10,record:{primary:null,secondary:'classic'}});ordinarySkills.cast('duck-shield',ordinaryActorView(player),{x:0,y:0,z:-5,yaw:0},elapsed,match.round);updateOrdinarySkills();applyRemoteAction(enemy,{type:'fire',yaw:Math.PI,pitch:0})`);assert.equal(local.run('player.hp'),100);assert.ok(local.run(`ordinarySkills.events(elapsed).find(e=>e.type==='duck-shield').power<180`));local.run(`resetOrdinarySkills();elapsed+=1;applyRemoteAction(enemy,{type:'fire',yaw:Math.PI,pitch:0})`);assert.ok(local.run('player.hp<100'));});
  check('hush removes actual BOT sound pulses for step/land, never gunshots, restores after expiry',()=>{setup();local.run(`activateAbility(player,'e');sound('step');sound('land')`);assert.equal(local.run('botHearing.listen(enemy,elapsed)'),null);local.run(`sound('shot')`);assert.ok(local.run('botHearing.listen(enemy,elapsed)'));local.run(`elapsed+=6;sound('step')`);assert.ok(local.run('botHearing.listen(enemy,elapsed)'));});
  check('X host only: two fatal hits preserve HP1, third kills and drops bomber normally',()=>{setup();local.run(`activateAbility(player,'x');updateOrdinarySkills();damageEntity(player,200,enemy)`);assert.equal(local.run('player.hp'),1);assert.equal(local.run('player.alive'),true);local.run(`damageEntity(player,200,enemy)`);assert.equal(local.run('player.hp'),1);local.run(`damageEntity(player,200,enemy)`);assert.equal(local.run('player.alive'),false);});
  check('independent JSON guest restores host effect; full queue rollback and reset cleanup',()=>{setup();const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.kit=new DuelistKit({character:'duck'});player.kit.updraft=1;match.phase='live';activateAbility(player,'q',{aim:{yaw:0,pitch:-.4}})`);const state=copy(host.run('ordinarySkills.snapshot()'));assert.equal(state.events[0].type,'duck-shield');guest.sandbox.transfer=copy(state);assert.equal(guest.run('ordinarySkills.restore(transfer,elapsed,match.round)'),true);assert.equal(guest.run(`ordinarySkills.interceptShield({x:0,y:1,z:0},{x:0,y:0,z:-1},20,40,elapsed,match.round)?.power`),180);local.run(`for(let i=0;i<20;i++)ordinarySkills.cast('duck-seal',{...ordinaryActorView(player),id:'d'+i},{x:0,y:1.3,z:-10,targetId:'enemy'},elapsed,match.round);var before=player.kit.snapshot();activateAbility(player,'q',{aim:{yaw:0,pitch:-.4}})`);assert.deepEqual(copy(local.run('player.kit.snapshot()')),copy(local.run('before')));local.run('resetOrdinarySkills()');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);});
  check('flat floor horizontal Q remains inside the exact 3D range and survives real support validation',()=>{setup();assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}})?.type`),'duck-shield');assert.equal(local.run('player.kit.updraft'),0);});
  check('guest prediction spends stocks only, never creates seal/shield/hush/egg or lethal protection',()=>{for(const key of ['c','q','e','x']){setup();assert.ok(local.run(`activateAbility(player,'${key}',{predict:true,aim:{yaw:0,pitch:-.05}})`));assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run(`ordinarySkills.guardLethal(player.id,elapsed,match.round)`),false);assert.equal(local.run(`ordinarySkills.quiet(player.id,elapsed)`),false);}});
  console.log(`PASS: ${groups} actual-game duck groups; AudioContext never created`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
