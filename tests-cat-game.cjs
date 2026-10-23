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
  function setup(){local.reset();local.clearWalls();local.run(`player.kit=new DuelistKit({character:'cat'});player.kit.smoke=2;player.kit.updraft=1;player.kit.ultPoints=7;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.aiWeapon='classic';enemy.aiAmmo=12;enemy.aiReserve=36;enemy.aiReload=0;enemy.fire=999;enemy.reactionUntil=999;`);}
  check('C saves actual grounded position, returns once without rewinding HP/ammo/yaw or second charge',()=>{setup();assert.equal(local.run(`activateAbility(player,'c')?.type`),'cat-bookmark');local.run(`player.x=8;player.hp=40;player.ammo=3;player.yaw=1;updateOrdinarySkills()`);assert.equal(local.run(`activateAbility(player,'c')?.type`),'cat-return');assert.equal(local.run('player.x'),0);assert.equal(local.run('player.hp'),40);assert.equal(local.run('player.ammo'),3);assert.equal(local.run('player.yaw'),1);assert.equal(local.run('player.kit.smoke'),1);assert.equal(local.run('ordinarySkills.catBookmark(player.id,elapsed)'),null);});
  check('C blocked return/range/air/expiry refuse and keep active bookmark or stock',()=>{setup();local.run(`activateAbility(player,'c');player.x=8`);local.wall({z:0});assert.equal(local.run(`activateAbility(player,'c')`),undefined);assert.ok(local.run('ordinarySkills.catBookmark(player.id,elapsed)'));assert.equal(local.run('player.x'),8);local.clearWalls();local.run('player.x=25');assert.equal(local.run(`activateAbility(player,'c')`),undefined);local.run('elapsed=20;player.x=8;player.y=2;player.vy=1');assert.equal(local.run(`activateAbility(player,'c')`),undefined);assert.equal(local.run('player.kit.smoke'),1);});
  check('Q actual BOT magazine loses five once and applies normal damage, reserve unchanged, equip/cancel spends nothing',()=>{setup();local.run(`useAbility('q')`);assert.equal(local.run('duckAim'),'q');assert.equal(local.run('player.kit.updraft'),1);local.run(`useAbility('q')`);assert.equal(local.run('duckAim'),null);assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:-.04}})?.type`),'cat-pluck');assert.equal(local.run('enemy.aiAmmo'),7);assert.equal(local.run('enemy.aiReserve'),36);assert.equal(local.run('enemy.hp'),40);assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:-.04}})`),undefined);assert.equal(local.run('enemy.aiAmmo'),7);});
  check('Q wall/smoke/empty/reload/out of aim reject before spending; remote ammo uses host net field',()=>{setup();local.wall({z:-5});assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}})`),undefined);local.clearWalls();local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.4,z:-5,radius:3.6,expires:100}])`);assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}})`),undefined);local.run(`syncSmokes([]);enemy.aiAmmo=0`);assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}})`),undefined);local.run('enemy.aiAmmo=12;enemy.aiReload=1');assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}})`),undefined);assert.equal(local.run('player.kit.updraft'),1);local.run(`enemy.aiReload=0;enemy.remoteId='remote';enemy.netWeapon='classic';enemy.netAmmo=3;enemy.netReserve=20;enemy.netReload=0`);assert.ok(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:-.04}})`));assert.equal(local.run('enemy.netAmmo'),0);assert.equal(local.run('enemy.netReserve'),20);});
  check('E retrieves existing dropped gun conserving both magazines/reserves and dropping previous weapon',()=>{setup();local.run(`inventory.primary='vandal';equip('vandal',true);player.ammo=8;player.reserve=40;addDrop({id:101,weapon:'phantom',x:0,z:-10,yaw:0,ammo:11,reserve:23})`);assert.equal(local.run(`activateAbility(player,'e',{aim:{yaw:0,pitch:Math.atan2(-1.5,10)}})?.type`),'cat-fetch');assert.equal(local.run('inventory.active'),'phantom');assert.equal(local.run('player.ammo'),11);assert.equal(local.run('player.reserve'),23);const drops=copy(local.run('serializeDrops()'));assert.equal(drops.length,1);assert.equal(drops[0].weapon,'vandal');assert.equal(drops[0].ammo,8);assert.equal(drops[0].reserve,40);assert.equal(drops[0].x,0);});
  check('E cannot steal through wall/smoke or invent a drop; BOT acquires into real ai gun',()=>{setup();local.run(`addDrop({id:101,weapon:'phantom',x:0,z:-10,yaw:0,ammo:11,reserve:23})`);local.wall({z:-5});assert.equal(local.run(`activateAbility(player,'e',{aim:{yaw:0,pitch:-.15}})`),undefined);local.clearWalls();local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.4,z:-5,radius:3.6,expires:100}])`);assert.equal(local.run(`activateAbility(player,'e',{aim:{yaw:0,pitch:-.15}})`),undefined);assert.equal(local.run('player.kit.dash'),1);local.run(`syncSmokes([]);enemy.kit=new DuelistKit({character:'cat'});enemy.z=0`);assert.ok(local.run(`activateAbility(enemy,'e',{aim:{yaw:0,pitch:-.15}})`));assert.equal(local.run('enemy.aiWeapon'),'phantom');assert.equal(local.run('enemy.aiAmmo'),11);assert.equal(local.run('enemy.aiReserve'),23);assert.equal(local.run('droppedWeapons.length'),0);});
  check('X freezes only countdown for eight seconds and clears on source death; elimination still resolves',()=>{setup();assert.equal(local.run(`activateAbility(player,'x')?.type`),'cat-clock');assert.equal(local.run('player.kit.ultPoints'),0);local.run(`var t=match.roundTime;match.tick(1,{clockPaused:ordinarySkills.clockFrozen(elapsed),blueAlive:1,redAlive:1});`);assert.equal(local.run('match.roundTime'),local.run('t'));local.run('elapsed+=8;match.tick(1,{clockPaused:ordinarySkills.clockFrozen(elapsed),blueAlive:1,redAlive:1})');assert.equal(local.run('match.roundTime'),local.run('t-1'));setup();local.run(`activateAbility(player,'x');match.tick(.1,{clockPaused:true,blueAlive:1,redAlive:0})`);assert.equal(local.run('match.phase'),'post');setup();local.run(`activateAbility(player,'x');player.alive=false;player.hp=0;updateOrdinarySkills()`);assert.equal(local.run('ordinarySkills.clockFrozen(elapsed)'),false);});
  check('host rejection at 20 events rolls stock/ULT back and keeps old effects; cleanup on next round',()=>{setup();local.run(`for(let i=0;i<20;i++)ordinarySkills.cast('cat-pluck',{...ordinaryActorView(player),id:'p'+i},{x:0,y:1.3,z:-10,targetId:'enemy'},elapsed,match.round);var before=player.kit.snapshot();activateAbility(player,'x')`);assert.deepEqual(copy(local.run('player.kit.snapshot()')),copy(local.run('before')));assert.equal(local.run('ordinarySkills.events(elapsed).length'),20);local.run('ordinarySkills.update([],elapsed,match.round+1)');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);});
  check('independent JSON guest has visuals/clock but cannot consume host bookmark; prediction cannot move/change ammo/inventory',()=>{setup();const guest=harness();guest.reset();local.run(`activateAbility(player,'c');activateAbility(player,'x')`);guest.sandbox.transfer=copy(local.run('ordinarySkills.snapshot()'));assert.equal(guest.run('ordinarySkills.restore(transfer,elapsed,match.round)'),true);assert.equal(guest.run('ordinarySkills.clockFrozen(elapsed)'),true);assert.equal(guest.run(`ordinarySkills.returnToCatBookmark(transfer.events[0].id,ordinaryActorView(player),elapsed,match.round)`),null);for(const key of ['c','q','x']){setup();assert.ok(local.run(`activateAbility(player,'${key}',{predict:true,aim:{yaw:0,pitch:-.04}})`));assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('enemy.aiAmmo'),12);assert.equal(local.run('player.x'),0);}setup();local.run(`addDrop({id:101,weapon:'phantom',x:0,z:-10,yaw:0,ammo:11,reserve:23})`);assert.ok(local.run(`activateAbility(player,'e',{predict:true,aim:{yaw:0,pitch:-.15}})`));assert.equal(local.run('inventory.active'),'classic');assert.equal(local.run('droppedWeapons.length'),1);});

  check('guest Q uses authoritative displayed enemy weapon/ammo, not stale local BOT magazines',()=>{setup();local.run(`onlinePlaying=true;online={host:false,session:{memberId:'guest'}};enemy.netTarget={weapon:'classic',ammo:9,reloading:0,serviceReload:null};enemy.aiAmmo=0`);assert.equal(local.run(`activateAbility(player,'q',{predict:true,aim:{yaw:0,pitch:-.04}})?.type`),'cat-pluck');assert.equal(local.run('enemy.netTarget.ammo'),9);assert.equal(local.run('enemy.aiAmmo'),0);local.run(`player.kit.updraft=1;enemy.netTarget.ammo=0`);assert.equal(local.run(`activateAbility(player,'q',{predict:true,aim:{yaw:0,pitch:-.04}})`),undefined);});
  check('host deduplicates repeated remote input/action packets before plucking local magazine',()=>{setup();local.run(`enemy.kit=new DuelistKit({character:'cat'});enemy.kit.updraft=1;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);var p={type:'input',seq:1,connection:'cat-test',round:match.round,input:{x:0,y:0,z:-10,yaw:Math.PI,pitch:0},actions:[{type:'ability',seq:1,round:match.round,key:'q',yaw:Math.PI,pitch:-.04}]};receiveNetPacket('guest',p);updateRemoteActor(enemy,.016);receiveNetPacket('guest',p);updateRemoteActor(enemy,.016)`);assert.equal(local.run('player.ammo'),7);assert.equal(local.run('netApplied.get("guest")'),1);assert.equal(local.run(`ordinarySkills.events(elapsed).filter(e=>e.type==='cat-pluck').length`),1);});

  check('actual independent host/guest snapshots force approved return once and ignore repeated network sequence',()=>{const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.kit=new DuelistKit({character:'cat'});player.kit.smoke=2;onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p;}};var captured;match.phase='live';activateAbility(player,'c');tickOnline(.1)`);guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','player')`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer);player.x=8;netPositionCorrectionX=3`);host.run(`player.x=8;elapsed+=.1;activateAbility(player,'c');tickOnline(.1)`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer)`);assert.equal(guest.run('player.x'),0);assert.equal(guest.run('netPositionCorrectionX'),0);assert.equal(guest.run('catReturnSeen.size'),1);guest.run(`player.x=2;receiveNetPacket('host',transfer)`);assert.equal(guest.run('player.x'),2);});

  check('map character trial supplies real loaded practice targets and one finite dropped gun',()=>{setup();local.run(`exploring=true;map.rangeArea={spawn:{x:0,z:2,yaw:0},targets:[{x:-3,z:-10},{x:0,z:-12},{x:3,z:-10}]};startCharacterTrial()`);assert.equal(local.run('bots.length'),3);assert.equal(local.run('bots.every(b=>b.aiWeapon===\"classic\"&&b.aiAmmo===12&&b.rangeTarget)'),true);assert.equal(local.run('droppedWeapons.length'),1);assert.ok(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:-.03}})`));assert.equal(local.run('bots[1].aiAmmo'),7);});
  console.log(`PASS: ${groups} actual-game cat groups; AudioContext never created`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
