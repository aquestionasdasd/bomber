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
    const audioCalls=[],elements = new Map(), listeners = new Map();
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
      createGameAudio: () => ({ init() {}, play(type,options) { audioCalls.push({type,options}); }, unlock() {}, resume() {}, setVolume() {}, dispose() {} }),
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
    return { sandbox, run, seed, wall, clearWalls, reset, elements, audioCalls };
  }



  const host=harness(),guest=harness();
  function setup(credits=800){
    for(const h of [host,guest]){h.reset();h.run("match.phase='buy';match.phaseTime=30;mode='shop';netActions=[];netApplied.clear();netInputs.clear();netParticipants.clear();netSequence=0;netLastSnapshot=0;netActionSequence=0;netHasSnapshot=false;netRound=0;");h.audioCalls.length=0;}
    host.sandbox.credits=credits;
    host.run("var record={id:'red-0',team:'red',secondary:'classic',primary:null,credits,kit:new DuelistKit({character:'nope'})};record.kit.smoke=0;record.kit.updraft=0;makeBot({x:0,z:-23},0,'red',record);var remote=bots[0];remote.id='red-0';remote.remoteId='guest';remote.netWeapon='classic';remote.netAmmo=12;remote.netReserve=36;remote.armor=0;roster=[record];onlinePlaying=true;online={host:true,session:{memberId:'host',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest','red-0');netClock=0;");
    guest.run("onlinePlaying=true;online={host:false,connectionId:'guest-1',room:{code:'TESTROOM'},session:{memberId:'guest',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest','red-0');netClock=0;");
    snapshot();host.audioCalls.length=0;guest.audioCalls.length=0;
  }
  function snapshot(edit){host.run('netClock=0;tickOnline(.1)');const data=copy(host.run('captured'));if(edit)edit(data);guest.sandbox.transfer=data;guest.run("receiveNetPacket('host',transfer)");return data;}
  function submit(id,{deliver=true}={}){
    guest.sandbox.buyId=id;guest.run('buy(buyId);netClock=0;tickOnline(.1)');host.sandbox.transfer=copy(guest.run('captured'));
    host.run("receiveNetPacket('guest',transfer);updateRemoteActor(remote,.05)");return deliver?snapshot():null;
  }
  const buys=h=>h.audioCalls.filter(c=>c.type==='buy').length;
  check('host confirms gun, skill aliases and shield; guest waits for success ACK',()=>{
    for(const id of ['ghost','light','c','smoke','q','updraft']){setup(3000);guest.sandbox.buyId=id;guest.run('buy(buyId)');assert.equal(buys(guest),0);assert.equal(guest.run('match.credits'),3000);
      guest.run('netClock=0;tickOnline(.1)');host.sandbox.transfer=copy(guest.run('captured'));host.run("receiveNetPacket('guest',transfer);updateRemoteActor(remote,.05)");assert.equal(buys(host),0);
      snapshot();assert.equal(buys(guest),1,id);assert.ok(guest.run('match.credits')<3000);assert.ok(guest.elements.get('shop-status').textContent.includes('購入しました'));}
  });
  check('insufficient, owned, full, invalid, melee and outside buy cannot emit success',()=>{
    for(const id of ['ghost','heavy','c','q']){setup(0);submit(id);assert.equal(buys(guest),0,id);assert.equal(guest.run('match.credits'),0);assert.equal(host.run('remote.netPurchaseAck'),undefined);}
    for(const id of ['classic','knife','unknown']){setup();submit(id);assert.equal(buys(guest),0,id);}
    setup();host.run('remote.kit.smoke=2');submit('c');assert.equal(buys(guest),0);
    setup();host.run("match.phase='live'");submit('ghost');assert.equal(buys(guest),0);
    setup();host.run('remote.alive=false');submit('ghost');assert.equal(buys(guest),0);
  });
  check('owned shield rejection matches local purchase; no downgrade/refund or false ACK',()=>{
    for(const id of ['light','heavy']){setup(3000);submit('heavy');assert.equal(guest.run('match.credits'),2000);assert.equal(guest.run('player.armor'),50);submit(id);assert.equal(buys(guest),1);assert.equal(guest.run('player.armor'),50);assert.equal(guest.run('match.credits'),2000);}
  });
  check('duplicate or out-of-order snapshots and repeated actions stay exactly once',()=>{
    setup();const p=submit('ghost');assert.equal(buys(guest),1);guest.sandbox.transfer=p;guest.run("receiveNetPacket('host',transfer);receiveNetPacket('host',transfer)");snapshot();assert.equal(buys(guest),1);assert.equal(host.run('record.credits'),300);
    host.run("receiveNetPacket('guest',transfer)");snapshot();assert.equal(buys(guest),1);
  });
  check('host receipt must match local pending seq, round and item and be cumulatively ACKed',()=>{
    for(const mutate of [r=>r[0]++,r=>r[1]++,r=>r[2]='heavy',r=>r.push(0),r=>r[0]='1']){setup();submit('ghost',{deliver:false});snapshot(p=>mutate(p.actors.find(a=>a.id==='red-0').purchaseAck));assert.equal(buys(guest),0);}
    setup();submit('ghost',{deliver:false});snapshot(p=>{p.acks.guest=0;});assert.equal(buys(guest),0);snapshot();assert.equal(buys(guest),1);
    setup();guest.run("buy('ghost')");snapshot(p=>p.acks.guest=1);assert.equal(buys(guest),0,'processed ACK alone is not purchase success');
  });
  check('fresh rejoin, next round, live/death transition, no pending and legacy hosts stay silent',()=>{
    for(const change of [()=>guest.run('netHasSnapshot=false'),()=>host.run('match.round++'),()=>host.run("match.phase='live'"),()=>host.run('remote.alive=false'),()=>guest.run('netActions=[]')]){setup();submit('ghost',{deliver:false});change();snapshot();assert.equal(buys(guest),0);}
    setup();submit('ghost',{deliver:false});snapshot(p=>delete p.actors.find(a=>a.id==='red-0').purchaseAck);assert.equal(buys(guest),0);
  });
  check('fast successful purchases coalesce once, later rejection does not erase last success',()=>{
    setup(3000);submit('c',{deliver:false});submit('q',{deliver:false});snapshot();assert.equal(buys(guest),1);assert.equal(guest.run('match.credits'),2800);snapshot();assert.equal(buys(guest),1);
    setup(600);submit('ghost',{deliver:false});submit('heavy',{deliver:false});snapshot();assert.equal(buys(guest),1);assert.equal(guest.run('match.credits'),100);
  });
  check('purchase receipts exist only in buy snapshots and do not inflate live state',()=>{
    setup();const buy=submit('ghost');assert.deepEqual(buy.actors.find(a=>a.id==='red-0').purchaseAck,[host.run("netApplied.get('guest')"),host.run('match.round'),'ghost']);
    host.run("match.phase='live'");const live=snapshot();assert.equal(live.actors.some(a=>a.purchaseAck),false);
  });
  check('existing SOUND OFF and master zero gates suppress acknowledged purchase cues',()=>{
    for(const gate of ['soundEnabled=false','volume=0']){setup();guest.run(gate);submit('ghost');assert.equal(buys(guest),0);guest.run('soundEnabled=true;volume=.45');snapshot();assert.equal(buys(guest),0,'muted ACK is not replayed later');}
  });
  console.log(`PASS ${groups} guest purchase ACK actual-game JSON VM groups; audio calls mocked, never played`);
  console.log(`TOTAL ${Math.round(performance.now()-started)}ms wall / ${Math.round(process.cpuUsage(cpuStarted).user/1000)}ms CPU`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
