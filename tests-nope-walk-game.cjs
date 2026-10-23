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


  const local=harness();local.reset();
  check('real bottle aim reaches40m while original flash/other zone targeting remains20m',()=>{
    const t=local.run("getSkillTarget(player,'nope-bottle',{x:0,z:-70})");near(Math.hypot(t.x,t.z),40,'bottle range');
    near(local.run("Math.hypot(getSkillTarget(player,'nope-flash',{x:0,z:-70}).x,getSkillTarget(player,'nope-flash',{x:0,z:-70}).z)"),20-1e-6,'flash throw stays20');
    local.wall({z:-15});const blocked=local.run("getSkillTarget(player,'nope-bottle',{x:0,z:-70})");assert.ok(blocked.z>-15,'real throw arc cannot cross a solid wall');local.clearWalls();
  });
  check('cast E walks continuously with matching hit and flash coordinates, immutable raw wire',()=>{
    local.reset();const base=local.run("activateAbility(player,'e',{zonePoint:{x:0,z:-5}});ordinarySkills.events(elapsed)[0]");assert.ok(base.walkLength>6);
    local.run('elapsed+=1');const current=local.run('allNopeDecoys()[0]');near(Math.hypot(current.x-base.x,current.z-base.z),3,'one second3m');
    assert.equal(local.run('ordinarySkills.events(elapsed)[0].z'),base.z);
    local.run("player.team='red'");const ray=local.run('raycastNopeDecoy(new THREE.Vector3(player.x,1.5,player.z),new THREE.Vector3(allNopeDecoys()[0].x-player.x,0,allNopeDecoys()[0].z-player.z).normalize(),50,player.team)');assert.ok(ray);
    assert.equal(local.run('hitNopeDecoy(allNopeDecoys()[0],player)'),true);near(local.run('nopePops[0][3]'),current.z,'pop follows body');assert.equal(local.run('allNopeDecoys().length'),0);
  });
  check('independent JSON rejoin derives moving E/X location without guest ownership or replay resurrection',()=>{
    local.reset();local.run("activateAbility(player,'e',{zonePoint:{x:0,z:-5}});player.kit.ultPoints=7;activateAbility(player,'x');elapsed+=1.3");
    const data=copy(local.run('({ordinary:ordinarySkills.snapshot(),wave:nopeDecoys.snapshot(),events:allNopeDecoys(),time:elapsed,round:match.round})'));
    assert.equal(data.wave.points.length,30);assert.ok(data.wave.points.every(p=>p.length===5));const guest=harness();guest.reset();guest.sandbox.transfer=data;
    assert.equal(guest.run('elapsed=transfer.time;ordinarySkills.restore(transfer.ordinary,elapsed,transfer.round)&&nopeDecoys.restore(transfer.wave,elapsed,transfer.round)'),true);
    assert.deepEqual(copy(guest.run('allNopeDecoys()')),data.events);
    assert.equal(guest.run("ordinarySkills.consumeDecoy(transfer.events[0].id,'red',elapsed,transfer.round)"),null);assert.equal(guest.run("nopeDecoys.consume(transfer.events[1].id,'red',elapsed,transfer.round)"),null);
    local.run('elapsed+=20');assert.equal(local.run('allNopeDecoys().length'),0);
  });
  check('host planning sweeps full-height floors and stops each route at walls/edges in both actual stations',()=>{
    const actual=harness({realMap:true});actual.reset();
    for(const id of ['hashimoto','hirakata']){
      actual.sandbox.mapChoice=id;actual.run("mode='menu';$('map-select').value=mapChoice;startGame();startRound();clearBots();elapsed=10");
      const result=actual.run(`(()=>{const points=chooseNopeDecoyPoints(player);let moving=0;for(const p of points){if(p.walkLength>0)moving++;for(let d=0;d<=p.walkLength;d+=.1){const x=p.x+Math.sin(p.yaw)*d,z=p.z+Math.cos(p.yaw)*d;if(!canStand(x,z,.34,p.y,1.96)||Math.abs(getZoneFloor(x,z,p.y+1.7)-p.y)>.1)throw Error('bad path '+JSON.stringify(p));}}return{count:points.length,moving,id:map.id||'hashimoto'};})()`);
      assert.equal(result.count,30);assert.equal(result.moving,30);assert.equal(result.id,id);
    }
  });
  console.log(`NOPE WALK REAL GAME: ${groups} groups; silent independent saved-game VM`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
