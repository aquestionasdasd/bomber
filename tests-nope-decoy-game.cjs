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

  const local = harness(); local.reset();
  check('analytic head, torso and legs; genuine misses; enemy-only nearest ray limit', () => {
    assert.ok(local.seed());
    for (const height of [1.7, 1, .4]) {
      local.sandbox.rayHeight = height;
      assert.ok(local.run("raycastNopeDecoy(new THREE.Vector3(0,rayHeight,0),new THREE.Vector3(0,0,-1),20,'blue')"), `Body at ${height}m must be hittable`);
    }
    assert.equal(local.run("raycastNopeDecoy(new THREE.Vector3(.5,1.7,0),new THREE.Vector3(0,0,-1),20,'blue')"), null, 'Empty space beside the body must not be a full-width invisible billboard');
    assert.equal(local.run("raycastNopeDecoy(new THREE.Vector3(0,-.1,0),new THREE.Vector3(0,0,-1),20,'blue')"), null);
    assert.equal(local.run("raycastNopeDecoy(new THREE.Vector3(0,1.7,0),new THREE.Vector3(0,0,-1),20,'red')"), null, 'An ally cannot break their own team decoy');
    assert.equal(local.run("raycastNopeDecoy(new THREE.Vector3(0,1.7,0),new THREE.Vector3(0,0,-1),4,'blue')"), null, 'A nearer wall/actor limit must exclude a farther decoy');
    assert.ok(local.seed('red', 0, -3));
    near(local.run("raycastNopeDecoy(new THREE.Vector3(0,1.7,0),new THREE.Vector3(0,0,-1),20,'blue').event.z"), -3, 'Choose the nearest body');
  });

  check('actual local shot consumes one body, flashes its facing enemy, never grants a kill or duplicate pop', () => {
    local.reset(); local.seed(); local.run('shoot()');
    assert.equal(local.run('player.ammo'), 11); assert.equal(local.run('allNopeDecoys().length'), 0);
    assert.equal(local.run('nopePops.length'), 1); assert.ok(local.run('ordinarySkills.blindUntil(player.id,elapsed)>elapsed'));
    assert.equal(local.run('player.hp'), 100); assert.equal(local.run('totalKills'), 0);
    assert.equal(local.run('hitNopeDecoy({id:nopePops[0][0],team:"red"},player)'), false);
    assert.equal(local.run('nopePops.length'), 1);
  });

  check('real shot respects environment and closer living actors; friendly and melee hits cannot consume', () => {
    local.reset(); local.seed(); local.wall(); local.run('shoot()');
    assert.equal(local.run('allNopeDecoys().length'), 1, 'A rendered/collision wall must stop the actual player shot first');
    assert.equal(local.run('nopePops.length'), 0); local.clearWalls();
    local.run(`lastShot=-10;makeBot({x:0,z:-2.5},0,'blue',{id:'blue-1',team:'blue',name:'ALLY',secondary:'classic'});shoot()`);
    assert.equal(local.run('allNopeDecoys().length'), 1, 'A closer living body must stop the ray before a farther decoy');
    local.run('clearBots()'); local.reset(); local.seed('blue'); local.run('shoot()');
    assert.equal(local.run('allNopeDecoys().length'), 1); assert.equal(local.run('nopePops.length'), 0);
    local.reset(); local.seed('red', 0, -1); local.run("equip('knife',true);shoot()");
    assert.equal(local.run('allNopeDecoys().length'), 1, 'The request specifies an enemy shooting the decoy, not melee taps');
  });

  check('flash has team, facing and real LOS constraints; killing the fake does not clear unrelated HP', () => {
    local.reset(); local.seed();
    local.run(`makeBot({x:2,z:0},0,'blue',{id:'blue-1',team:'blue',name:'LOOK',secondary:'classic'});
      makeBot({x:-2,z:0},1,'blue',{id:'blue-2',team:'blue',name:'AWAY',secondary:'classic'});
      makeBot({x:4,z:0},2,'red',{id:'red-0',team:'red',name:'OWNER TEAM',secondary:'classic'});
      bots[0].yaw=Math.atan2(2,5);bots[0].group.rotation.y=bots[0].yaw+Math.PI;
      bots[1].yaw=Math.PI;bots[1].group.rotation.y=0;
      bots[2].yaw=Math.atan2(4,5);bots[2].group.rotation.y=bots[2].yaw+Math.PI;`);
    local.run('shoot()');
    assert.ok(local.run('ordinarySkills.blindUntil("blue-1",elapsed)>elapsed'));
    assert.equal(local.run('ordinarySkills.blindUntil("blue-2",elapsed)'), 0);
    assert.equal(local.run('ordinarySkills.blindUntil("red-0",elapsed)'), 0);
    assert.equal(local.run('bots.every(bot=>bot.hp===100)'), true);
    local.reset(); local.seed(); local.wall();
    local.run('hitNopeDecoy(allNopeDecoys()[0],player)');
    assert.equal(local.run('ordinarySkills.blindUntil(player.id,elapsed)'), 0, 'Even an authoritative consumed fake cannot flash through a solid wall');
    local.clearWalls();
  });

  check('actual BOT reacts then shoots once with ammo/cooldown; no real target or wall omniscience', () => {
    local.reset(); local.run(`player.x=45;player.z=45;
      makeBot({x:0,z:0},0,'red',{id:'red-0',team:'red',name:'SHOOTER',secondary:'classic'});
      bots[0].group.rotation.y=Math.PI;bots[0].kit=new DuelistKit({character:'frost'});
      bots[0].kit.smoke=0;bots[0].kit.updraft=0;bots[0].kit.dash=0;bots[0].kit.ultPoints=0;
      bots[0].think=0;bots[0].fire=0;bots[0].reactionUntil=0;`);
    local.seed('blue'); local.run('updateBots(.05)');
    assert.equal(local.run('allNopeDecoys().length'), 1); assert.equal(local.run('bots[0].shotSequence||0'), 0, 'A visible fake needs reaction time');
    local.run('elapsed+=.5;updateBots(.05)');
    assert.equal(local.run('allNopeDecoys().length'), 0); assert.equal(local.run('bots[0].shotSequence'), 1);
    assert.equal(local.run('bots[0].aiAmmo'), 11); assert.equal(local.run('bots[0].target'), null);
    assert.ok(local.run('ordinarySkills.blindUntil(bots[0].id,elapsed)>elapsed'));
    local.run('elapsed+=.05;updateBots(.05)');
    assert.equal(local.run('bots[0].shotSequence'), 1); assert.equal(local.run('nopePops.length'), 1);
    local.reset(); local.run(`player.x=45;player.z=45;
      makeBot({x:0,z:0},0,'red',{id:'red-0',team:'red',name:'HIDDEN',secondary:'classic'});
      bots[0].group.rotation.y=Math.PI;bots[0].kit.smoke=0;bots[0].kit.updraft=0;bots[0].kit.dash=0;bots[0].think=0;bots[0].fire=0;`);
    local.seed('blue'); local.wall(); local.run('updateBots(.05);elapsed+=.7;updateBots(.05)');
    assert.equal(local.run('allNopeDecoys().length'), 1); assert.equal(local.run('bots[0].shotSequence||0'), 0, 'BOTs cannot acquire a decoy through a wall');
    local.clearWalls();
  });

  function preparePeer(peer, host) {
    peer.sandbox.isHost = host;
    peer.run(`online={host:isHost,session:{memberId:isHost?'host':'friend',hostId:'host'},
      room:{code:'DECOY234',hostId:'host',status:'playing',settings:{format:'standard'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},
      sent:[],send(packet,{team}={}){if(team===undefined||team==='red')this.sent.push(packet);},close(){}};
      onlinePlaying=true;mode='menu';$('match-format').value='standard';$('starting-side').value='attack';startGame();
      if(isHost){match.startLive();match.drainEvents();}
      netSequence=0;netLastSnapshot=0;netHasSnapshot=false;netRound=0;netClock=0;netInputs.clear();netApplied.clear();netActions=[];netActionSequence=0;elapsed=10;
      for(const bot of bots)bot.rangeTarget=true;`);
  }
  const host = harness(), guest = harness();
  const deliver = (sender, receiver, from) => {
    const packet = copy(sender.run('online.sent.at(-1)')); assert.ok(packet, 'A peer must produce a packet');
    receiver.sandbox.incoming = packet; receiver.run(`receiveNetPacket('${from}',incoming)`); return packet;
  };
  check('independent JSON guest shots are host-authoritative; ACK/replay never duplicates consumption or flash', () => {
    preparePeer(host, true); preparePeer(guest, false);
    host.run(`Object.assign(player,{x:35,z:35,y:0});var remote=bots.find(bot=>bot.remoteId==='friend');
      Object.assign(remote,{x:0,y:0,z:0,netYaw:0,crouch:0});remote.group.position.set(0,0,0);remote.netWeapon='classic';remote.netAmmo=12;remote.lastNetShot=-10;`);
    host.seed('blue'); host.run('tickOnline(.1)'); deliver(host, guest, 'host');
    guest.run('player.yaw=0;player.pitch=0;lastShot=-10;renderedRecoil=0;player.recoil=0;shoot();tickOnline(.1)');
    assert.equal(guest.run('allNopeDecoys().length'), 1, 'A predicted guest ray cannot consume an event');
    assert.equal(guest.run('ordinarySkills.blindUntil(player.id,elapsed)'), 0, 'A guest cannot invent a flash before host acceptance');
    const input = deliver(guest, host, 'friend'); host.run('updateRemoteActor(remote,.05)');
    assert.equal(host.run('allNopeDecoys().length'), 0); assert.equal(host.run('nopePops.length'), 1);
    assert.equal(host.run('remote.netAmmo'), 11); assert.ok(host.run('ordinarySkills.blindUntil(remote.id,elapsed)>elapsed'));
    host.sandbox.incoming = input; host.run("receiveNetPacket('friend',incoming);updateRemoteActor(remote,.05)");
    assert.equal(host.run('nopePops.length'), 1); assert.equal(host.run('remote.netAmmo'), 11);
    host.run('tickOnline(.1)'); const accepted = deliver(host, guest, 'host');
    assert.equal(guest.run('allNopeDecoys().length'), 0); assert.ok(guest.run('ordinarySkills.blindUntil(player.id,elapsed)>elapsed'));
    assert.equal(guest.run('netActions.length'), 0); assert.equal(accepted.nopePops.length, 1);
    const seen = guest.run('nopeSeenPopSequence');
    guest.sandbox.incoming = copy(accepted); guest.run("receiveNetPacket('host',incoming)");
    assert.equal(guest.run('nopeSeenPopSequence'), seen);
  });

  const actual = harness({ realMap: true }); actual.reset();
  check('real town ultimate supplies thirty supported dispersed bodies; one hit removes one; age/round/menu cleanup', () => {
    actual.run(`player.x=0;player.z=65;player.kit.ultPoints=7;var chosen=chooseNopeDecoyPoints(player);activateAbility(player,'x')`);
    const chosen = copy(actual.run('chosen'));
    assert.equal(chosen.length, 30); assert.equal(new Set(chosen.map(p => `${p.x},${p.y},${p.z}`)).size, 30);
    assert.equal(actual.run('allNopeDecoys().length'), 30); assert.equal(actual.run('player.kit.ultPoints'), 0);
    assert.equal(actual.run('bots.length'), 0, 'Decoys never enter the combat roster or alive count');
    for (const point of chosen) {
      actual.sandbox.testPoint = point;
      assert.equal(actual.run('navigation.isWalkable(testPoint.x,testPoint.z)&&canStand(testPoint.x,testPoint.z,.5,testPoint.y)'), true, 'Each placed body must use a real supported open street floor');
      near(point.y, 0, 'Town placement remains on the supported ground floor');
    }
    const maxSeparation = Math.max(...chosen.flatMap(a => chosen.map(b => Math.hypot(a.x - b.x, a.z - b.z))));
    assert.ok(maxSeparation > 90, 'Thirty copies must disperse through the town, not pile at the caster');
    actual.run(`makeBot({x:0,z:60},0,'red',{id:'red-0',team:'red',name:'SHOOTER',secondary:'classic'});
      var firstFake=allNopeDecoys()[0];hitNopeDecoy(firstFake,bots[0])`);
    assert.equal(actual.run('allNopeDecoys().length'), 29);
    assert.equal(actual.run('hitNopeDecoy(firstFake,bots[0])'), false); assert.equal(actual.run('allNopeDecoys().length'), 29);
    actual.run('elapsed=takeoverState.endsAt;updateOrdinarySkills()');
    assert.equal(actual.run('allNopeDecoys().length'), 0);
    actual.run('elapsed+=1;player.kit.ultPoints=7;activateAbility(player,"x");match.round++;resetTeamAbilities()');
    assert.equal(actual.run('allNopeDecoys().length'), 0);
    actual.run('backMenu()'); assert.equal(actual.run('nopeDecoys.snapshot()'), null); assert.equal(actual.run('nopePops.length'), 0);
  });

  check('compact ultimate and pop snapshots restore at the right age without guest ownership or reanimation', () => {
    preparePeer(host, true); preparePeer(guest, false);
    host.run(`player.kit.character='nope';player.kit.ultPoints=7;activateAbility(player,'x');tickOnline(.1)`);
    let packet = deliver(host, guest, 'host');
    assert.equal(packet.nopeDecoys.points.length, 30); assert.equal(guest.run('allNopeDecoys().length'), 30);
    assert.equal(guest.run('hitNopeDecoy(allNopeDecoys()[0],player)'), false);
    host.run('var shotFake=allNopeDecoys()[0];hitNopeDecoy(shotFake,bots.find(bot=>bot.team==="red"));tickOnline(.1)');
    packet = deliver(host, guest, 'host'); assert.equal(guest.run('allNopeDecoys().length'), 29);
    // A new packet sequence with the same wave must still respect its shot mask.
    guest.sandbox.incoming = copy({ ...packet, seq: packet.seq + 1 }); guest.run("receiveNetPacket('host',incoming)");
    assert.equal(guest.run('allNopeDecoys().length'), 29);
    guest.sandbox.incoming = copy({ ...packet, seq: packet.seq + 2, time: packet.nopeDecoys.endsAt + 1 });
    guest.run("netHasSnapshot=false;receiveNetPacket('host',incoming)");
    assert.equal(guest.run('allNopeDecoys().length'), 0, 'A late rejoin must not restart the twelve-second wave');
  });

  // Reuse the established conservative store-filling fixture, but execute its
  // saved serializer with the additional legal wave/pop fields in this process.
  // This never starts the HTTP test database or performs a request.
  const httpSource = fs.readFileSync(path.join(__dirname, 'tests-online.cjs'), 'utf8');
  const capacityStart = httpSource.indexOf('      const now = 1000.1234567890123');
  const capacityEnd = httpSource.indexOf('      assert.equal((await send(host, \'team:red\'', capacityStart);
  assert.ok(capacityStart >= 0 && capacityEnd > capacityStart, 'The bounded transport fixture must remain available');
  let capacityBody = httpSource.slice(capacityStart, capacityEnd);
  capacityBody = capacityBody.replace('vm.createContext(sandbox);', `
    const wave=createNopeDecoys();
    const points=Array.from({length:30},(_,i)=>({x:-999.99+i*.01,y:-999.99,z:999.99-i*.01,yaw:3.1415}));
    assert.equal(wave.start(player,points,now,1),true);
    const state=wave.snapshot();state.id='nope-wave-1-999999999999999';assert.equal(wave.restore(state,now,1),true);
    sandbox.nopeDecoys=wave;sandbox.serializeNopePops=()=>Array.from({length:8},(_,i)=>[Number.MAX_SAFE_INTEGER-i,-999.1234567890123,-999.1234567890123,-999.1234567890123,now]);
    vm.createContext(sandbox);`);
  const deps = { ...imported, ...(await load('nope-decoys.js')), assert, fs, path, vm, __dirname, host: { code: 'DECOY234' } };
  const capacityRun = new Function('deps', `const {${Object.keys(deps).join(',')}}=deps;${capacityBody}\nreturn {bytes,snapshot};`);
  const capacity = capacityRun(deps);
  check('all bounded legacy fields plus thirty compact bodies and eight pops fit the 64KiB wire limit', () => {
    assert.equal(capacity.snapshot.nopeDecoys.points.length, 30); assert.equal(capacity.snapshot.nopePops.length, 8);
    assert.ok(capacity.bytes <= 65536, `Maximum conservative snapshot is ${capacity.bytes}B`);
  });
  const cpu = process.cpuUsage(cpuStarted);
  console.log(`NOPE DECOY GAME: ${groups} groups; conservative snapshot ${capacity.bytes}/65536B; silent Node VM, no browser/network/audio`);
  console.log(`TOTAL ${Math.round(performance.now() - started)}ms wall / ${Math.round((cpu.user + cpu.system) / 1000)}ms CPU`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
