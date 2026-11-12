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
    const audioEvents=[];
    const sandbox = { audioEvents, ...imported, THREE: { ...THREE, WebGLRenderer: Renderer },
      createMap: realMap ? actualCreateMap : fixtureMap, document,
      // Never instantiate AudioContext or fetch/decode/play any recording.
      createGameAudio: () => ({ init() {}, play(type,options) {audioEvents.push({type,options});}, unlock() {}, resume() {}, setVolume() {}, dispose() {} }),
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



  const host=harness(),guest=harness();
  function party(h,isHost){h.reset();h.run(`netInputs.clear();var closes=0,returns=0;var partyRoom={code:'PARTY222',hostId:'host',status:'playing',settings:{format:'swift',mapId:'hashimoto',matchEpoch:0},members:[{id:'host',name:'HOST',team:'blue',ready:true,connected:true},{id:'guest',name:'FRIEND',team:'red',ready:true,connected:true}]};
    online={host:${isHost},session:{memberId:'${isHost?'host':'guest'}',hostId:'host'},room:partyRoom,close(){closes++;},send(p){captured=JSON.parse(JSON.stringify(p));},async rematch(){returns++;updateRoom({...partyRoom,status:'lobby',settings:{...partyRoom.settings,matchEpoch:(partyRoom.settings.matchEpoch||0)+1},members:partyRoom.members.map(m=>({...m,ready:m.id==='host'}))});}};
    onlinePlaying=true;mode='menu';startGame();${isHost?'':"player.id='red-0';player.team='red';"}match.phase='match';match.winner='blue';match.score.blue=5;totalKills=3;finish(${isHost});`);}
  check('result keeps the party connected and offers host-only return with explicit leave',()=>{
    party(host,true);assert.equal(host.run('closes'),0);assert.equal(host.run('onlinePlaying'),true);assert.equal(host.elements.get('play-again-label').textContent,'みんなで待機室へ');assert.equal(host.elements.get('play-again').disabled,false);assert.equal(host.elements.get('back-menu-label').textContent,'部屋を退出する');
    party(guest,false);assert.equal(guest.elements.get('play-again').disabled,true);assert.equal(guest.run('closes'),0);assert.match(guest.elements.get('party-result-note').textContent,/ホスト/);
  });
  host.run("netInputs.set('guest',{input:{matchFinished:true}})");await host.run('playAgain()');
  check('host returns entire party to lobby without leave, preserving same client and member IDs',()=>{
    assert.equal(host.run('returns'),1);assert.equal(host.run('closes'),0);assert.equal(host.run('online.room.code'),'PARTY222');assert.equal(host.run('online.room.members[1].id'),'guest');assert.equal(host.run('onlinePlaying'),false);assert.equal(host.run('mode'),'menu');assert.equal(host.elements.get('online-overlay').hidden,false);assert.equal(host.elements.get('online-lobby').hidden,false);assert.equal(host.run('netInputs.size'),0);
  });
  guest.sandbox.lobby=copy(host.run('online.room'));guest.run('updateRoom(lobby)');
  check('independent guest follows lobby JSON without disconnection and can ready again',()=>{
    assert.equal(guest.run('closes'),0);assert.equal(guest.run('online.session.memberId'),'guest');assert.equal(guest.run('online.room.members[1].team'),'red');assert.equal(guest.run('onlinePlaying'),false);assert.equal(guest.elements.get('online-ready').disabled,false);assert.equal(guest.elements.get('online-lobby').hidden,false);
  });
  for(const h of [host,guest]){h.run("netActions.push({seq:99,type:'fire'});partyRoom={...online.room,status:'playing',members:online.room.members.map(m=>({...m,ready:true}))};updateRoom(partyRoom)");}
  check('second match starts with fresh score, economy, kills, actions and same human roster',()=>{
    for(const h of [host,guest]){assert.equal(h.run('closes'),0);assert.equal(h.run('onlinePlaying'),true);assert.equal(h.run('match.round'),1);assert.equal(h.run('match.score.blue'),0);assert.equal(h.run('totalKills'),0);assert.equal(h.run('netActions.length'),0);assert.equal(h.run('roster.length'),10);assert.equal(h.run('netParticipants.get("guest")'),'red-0');assert.equal(h.run('roster.find(r=>r.memberId==="guest").name'),'FRIEND');}
    assert.equal(host.run('match.credits'),800);assert.equal(guest.run('netHasSnapshot'),false);host.run('tickOnline(.1)');guest.sandbox.next=copy(host.run('captured'));guest.run('receiveNetPacket("host",next)');assert.equal(guest.run('netHasSnapshot'),true);assert.equal(guest.run('match.credits'),800);
  });
  check('guest reports finished only after applying actual final host snapshot',()=>{
    host.run("match.phase='match';match.winner='red';match.score.red=5;tickOnline(.1)");guest.sandbox.final=copy(host.run('captured'));guest.run('receiveNetPacket("host",final);tickOnline(.1)');assert.equal(guest.run('mode'),'result');assert.equal(guest.run('captured.input.matchFinished'),true);assert.equal(guest.run('match.winner'),'red');
  });
  party(host,true);host.run("netInputs.set('guest',{input:{matchFinished:true}});online.rematch=async()=>{throw Error('offline')}");await host.run('playAgain()');
  check('failed return retains result, membership and retry button',()=>{assert.equal(host.run('closes'),0);assert.equal(host.run('mode'),'result');assert.equal(host.run('onlinePlaying'),true);assert.equal(host.elements.get('play-again').disabled,false);assert.equal(host.elements.get('party-result-note').textContent,'offline');});
  party(host,true);const timers=[];host.sandbox.setTimeout=fn=>{timers.push(fn);return timers.length;};host.run('var actualDate=Date;var fakeNow=0;Date={now:()=>fakeNow}');
  const waiting=host.run('playAgain()');await host.run('playAgain()');
  check('return waits for actual guest result receipt and ignores duplicate clicks',()=>{assert.equal(host.run('returns'),0);assert.equal(host.run('closes'),0);assert.equal(host.elements.get('play-again').disabled,true);assert.equal(timers.length,1);});
  host.run('fakeNow=8001');timers.shift()();await waiting;
  check('bounded result wait times out with intact party and a retry button',()=>{assert.equal(host.run('returns'),0);assert.equal(host.run('closes'),0);assert.equal(host.run('mode'),'result');assert.equal(host.elements.get('play-again').disabled,false);assert.match(host.elements.get('party-result-note').textContent,/結果の受信待ち/);});
  host.run("netInputs.set('guest',{input:{matchFinished:true}})");await host.run('playAgain()');
  check('receipt after timeout allows a successful retry without reconnecting',()=>{assert.equal(host.run('returns'),1);assert.equal(host.run('closes'),0);assert.equal(host.run('mode'),'menu');});
  host.run('Date=actualDate');party(host,true);timers.length=0;host.run('actualDate=Date;fakeNow=0;Date={now:()=>fakeNow}');const cancelled=host.run('playAgain()');host.run('backMenu()');timers.shift()();await cancelled;
  check('explicit leave cancels pending return and cannot resurrect the party',()=>{assert.equal(host.run('returns'),0);assert.equal(host.run('closes'),1);assert.equal(host.run('online'),null);assert.equal(host.run('mode'),'menu');});
  host.run('Date=actualDate');party(host,true);
  host.run('backMenu()');check('explicit leave still closes room rather than silently keeping it',()=>{assert.equal(host.run('closes'),1);assert.equal(host.run('online'),null);assert.equal(host.run('onlinePlaying'),false);});
  host.run('playAgain()');check('solo replay still starts a fresh match',()=>{assert.equal(host.run('mode'),'play');assert.equal(host.run('match.round'),1);assert.equal(host.run('totalKills'),0);});
  console.log(`PASS: ${groups} actual saved-game party lifecycle groups; silent separate host/guest worlds`);
}
let completed=false;process.once('beforeExit',()=>{if(!completed){console.error('Incomplete party lifecycle run');process.exitCode=1;}});
main().then(()=>{completed=true;},error=>{completed=true;console.error(error);process.exitCode=1;});
