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
  const setup=()=>{local.reset();local.run(`makeBot({x:0,z:0},0,'red',{id:'cpu',team:'red',secondary:'classic'});var cpu=bots[0];cpu.kit=null;cpu.group.rotation.y=0;cpu.reactionUntil=999;cpu.fire=999;cpu.think=0;Object.assign(player,{x:0,z:-3});`);};
  check('silent nearby rear target is never a sighting',()=>{setup();local.run('soundEnabled=false;volume=0;updateBots(.01)');assert.equal(local.run('cpu.target'),null);assert.ok(local.run('cpu.lastSeen==null'));assert.ok(local.run('cpu.lastHeard==null'));});
  check('distant visible target, wall occlusion and smoke occlusion',()=>{setup();local.run('player.z=100;updateBots(.01)');assert.equal(local.run('cpu.target===player'),true);local.wall({z:50,width:20});local.run('cpu.think=0;updateBots(.01)');assert.equal(local.run('cpu.target'),null);local.clearWalls();local.run('syncSmokes([{id:1,kind:"smoke",x:0,y:1.4,z:50,radius:3.6,expires:100}]);cpu.think=0;updateBots(.01)');assert.equal(local.run('visibleBetween(cpu,player)'),false);assert.equal(local.run('cpu.target'),null);});
  check('blind CPU never sees a close front target',()=>{setup();local.run(`player.z=3;ordinarySkills.blindUntil=()=>100;updateBots(.01)`);assert.equal(local.run('cpu.target'),null);local.run('ordinarySkills.blindUntil=()=>0');});
  check('muted footsteps create only a frozen audible point, no target or shared sighting',()=>{setup();local.run(`soundEnabled=false;volume=0;player.z=-8;sound('step');player.z=-30;updateBots(.01)`);assert.equal(local.run('cpu.lastHeard.z'),-8);assert.equal(local.run('cpu.target'),null);assert.ok(local.run('cpu.lastSeen==null'));assert.equal(local.run(`updateBots.tactics.contacts('red',elapsed).length`),0);local.run('player.z=-40');assert.equal(local.run('cpu.lastHeard.z'),-8);local.run('elapsed+=2;updateBots(.01)');assert.notEqual(local.run('cpu.pathIntent'),'heard');});
  check('out-of-range and wall-muffled footsteps cannot reveal the source',()=>{setup();local.run(`player.z=-20;sound('step');updateBots(.01)`);assert.ok(local.run('cpu.lastHeard==null'));setup();local.wall({z:-6,width:10});local.run(`player.z=-12;sound('step');updateBots(.01)`);assert.ok(local.run('cpu.lastHeard==null'));local.run(`player.z=-8;sound('step');updateBots(.01)`);assert.equal(local.run('cpu.lastHeard.z'),-8);assert.equal(local.run('cpu.target'),null);local.clearWalls();});
  check('gun hearing beyond footsteps does not permit hidden shooting and expires',()=>{setup();local.run(`player.z=-50;sound('shot');updateBots(.01)`);assert.equal(local.run('cpu.lastHeard.z'),-50);assert.equal(local.run('cpu.target'),null);local.run('elapsed+=.7');assert.equal(local.run('botHearing.listen(cpu,elapsed)'),null);local.run('resetOrdinarySkills()');assert.equal(local.run('botHearing.listen(cpu,elapsed)'),null);});
  check('sound data is copied, team-filtered, bounded, time-valid and resettable',()=>{const h=imported.createBotHearing(),observer={x:0,y:0,z:0,team:'red'},actor={x:0,y:0,z:5,team:'blue',alive:true};h.emit(actor,'step',1);actor.z=100;const point=h.listen(observer,1);assert.equal(point.z,5);point.z=999;assert.equal(h.listen(observer,1).z,5);assert.equal(h.listen({...observer,team:'blue'},1),null);assert.equal(h.listen(observer,1.7),null);for(let i=0;i<65;i++)h.emit({...actor,z:i===0?5:100},'step',2);assert.equal(h.listen(observer,2),null);h.emit({...actor,z:5},'shot',3);assert.equal(h.listen(observer,2),null);h.reset();assert.equal(h.listen(observer,3),null);});
  check('remote quiet input is speed-capped, silent and remote sprint emits actual accepted steps',()=>{setup();local.run(`makeBot({x:0,z:-8},1,'blue',{id:'remote',team:'blue',secondary:'classic'});var remote=bots[1];remote.remoteId='peer';remote.kit=null;netInputs.set('peer',{input:{x:10,y:0,z:-8,yaw:0,pitch:0,crouch:0,quiet:true},received:elapsed,round:match.round,seq:1,connection:'c',actions:[]});updateRemoteActor(remote,.1)`);near(local.run('remote.x'),.322,'quiet host cap');assert.equal(local.run('botHearing.listen(cpu,elapsed)'),null);local.run(`for(let i=0;i<4;i++){elapsed+=.1;const d=netInputs.get('peer');d.input={...d.input,quiet:false,x:remote.x+.6};d.received=elapsed;d.seq++;updateRemoteActor(remote,.1);}`);assert.ok(local.run('botHearing.listen(cpu,elapsed)'));});
  console.log(`PASS: ${groups} actual-game/host perception groups; no AudioContext or recordings played`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
