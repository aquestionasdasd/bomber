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
      addEventListener(type,listener) { (this.listeners||=new Map()).set(type,listener); }, setAttribute(name, value) { this.attributes[name] = value; }, setPointerCapture() {},
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




  const { createDeathView }=await load('death-view.js');
  check('death view is bounded, immutable, monotonic and duplicate-safe',()=>{
    const d=createDeathView();assert.equal(d.begin([1,2,3],[.1,.2,0]),true);
    const view=d.view();view.position[0]=999;assert.equal(d.view().position[0],1);
    d.tick(.8);assert.equal(d.begin([8,8,8],[0,0,0]),false);d.tick(-100);d.tick(NaN);assert.equal(d.holding,true);
    d.tick(.4);assert.equal(d.holding,false);assert.equal(d.view(),null);assert.equal(d.begin([8,8,8],[0,0,0]),false);
    d.reset();assert.equal(d.begin([8,8,8],[0,0,0]),true);d.reset();assert.equal(d.begin([Infinity,1,1],[0,0,0]),false);
  });
  const host=harness(),guest=harness();
  function solo(){host.reset();host.run(`makeBot({x:25,z:20},1,'blue',roster.find(r=>r.id==='blue-1'));makeBot({x:-45,z:-55},0,'red',roster.find(r=>r.id==='red-0'));camera.position.set(0,1.7,0);camera.rotation.set(.2,.3,0);mode='play';`);}
  const step=(h,seconds)=>{for(let t=0;t<seconds-1e-7;t+=.05)h.run('updatePlay(.05);syncDeathUI()');};
  check('host death keeps the last camera and corpse rules before teammate spectating',()=>{
    solo();host.run("inventory.primary='vandal';match.spike.status='carried';match.spike.carrier='player';damageEntity(player,200,bots[1]);");
    assert.equal(host.run('player.alive'),false);assert.equal(host.run('deathView.holding'),true);assert.equal(host.run("$('death-card').hidden"),false);
    assert.equal(host.run('spectatedBot'),null);assert.equal(host.run('gun.visible'),false);assert.equal(host.run('roster[0].d'),1);
    assert.equal(host.run('match.spike.status'),'dropped');assert.equal(host.run('serializeDrops().length'),1);
    step(host,1.1);near(host.run('camera.position.x'),0,'held cameraX');near(host.run('camera.rotation.y'),.3,'held yaw');assert.equal(host.run('spectatedBot'),null);
    step(host,.15);assert.equal(host.run('deathView.holding'),false);assert.equal(host.run('spectatedBot.team'),'blue');assert.equal(host.run("$('death-card').hidden"),true);assert.equal(host.run("$('spectator-hint').hidden"),false);
  });
  check('dead input cannot skip the hold or fire; normal spectate cycling resumes',()=>{
    solo();host.run('damageEntity(player,200,null);keys.add("KeyW");firing=true;');
    const click=host.elements.get('game').listeners.get('mousedown');click({button:0});assert.equal(host.run('spectateIndex'),0);
    const ammo=host.run('player.ammo');host.run('shoot()');assert.equal(host.run('player.ammo'),ammo);
    step(host,1.25);click({button:0});assert.equal(host.run('spectateIndex'),1);
  });
  check('online pause freezes local presentation; death without a killer keeps no secret target',()=>{
    solo();host.run("damageEntity(player,200,null);mode='pause';");step(host,2);assert.equal(host.run('deathView.holding'),true);assert.equal(host.run("$('death-card').hidden"),true);
    host.run("mode='play'");step(host,1.25);assert.equal(host.run('deathView.holding'),false);
  });
  function setup(){
    for(const h of [host,guest]){h.reset();h.run("match.phase='live';match.phaseTime=80;mode='play';netActions=[];netApplied.clear();netInputs.clear();netParticipants.clear();netSequence=0;netLastSnapshot=0;netHasSnapshot=false;netRound=0;");}
    host.run("var record={id:'red-0',team:'red',name:'GUEST',secondary:'classic',primary:null,credits:800,d:0,k:0,kit:new DuelistKit({character:'nope'})};makeBot({x:0,z:-23},0,'red',record);var remote=bots[0];remote.remoteId='guest';remote.netWeapon='classic';remote.netAmmo=12;remote.netReserve=36;roster=[roster[0],record];onlinePlaying=true;online={host:true,session:{memberId:'host',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest','red-0');netClock=0;");
    guest.run("onlinePlaying=true;online={host:false,connectionId:'guest-1',room:{code:'TESTROOM'},session:{memberId:'guest',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest','red-0');netClock=0;");snapshot();guest.run('camera.position.set(3,2,-20);camera.rotation.set(.15,.5,0)');
  }
  function snapshot(edit){host.run('netClock=0;tickOnline(.1)');const p=copy(host.run('captured'));if(edit)edit(p);guest.sandbox.transfer=p;guest.run("receiveNetPacket('host',transfer)");return p;}
  check('guest death starts once; repeated packets and host clock corrections cannot prolong it',()=>{
    setup();host.run('damageEntity(remote,200,player)');const packet=snapshot();assert.equal(guest.run('deathView.holding'),true);assert.equal(guest.run("$('death-card').hidden"),false);
    step(guest,.8);snapshot(p=>p.time-=3);snapshot();step(guest,.3);near(guest.run('camera.position.x'),3,'guest camera frozen');near(guest.run('camera.rotation.y'),.5,'guest yaw frozen');
    step(guest,.15);assert.equal(guest.run('deathView.holding'),false);snapshot();assert.equal(guest.run('deathView.holding'),false);assert.equal(packet.actors.some(a=>'deathView' in a||'deathHold' in a),false);
  });
  check('fresh dead reconnect does not replay a death, resurrection and next round clear it',()=>{
    setup();host.run('damageEntity(remote,200,player)');guest.run('netHasSnapshot=false');snapshot();assert.equal(guest.run('deathView.holding'),false);
    setup();host.run('damageEntity(remote,200,player)');snapshot();host.run('remote.alive=true;remote.hp=100');snapshot();assert.equal(guest.run('deathView.holding'),false);assert.equal(guest.run("$('death-card').hidden"),true);
    host.run('damageEntity(remote,200,player)');snapshot();assert.equal(guest.run('deathView.holding'),true);host.run('match.round++');snapshot();assert.equal(guest.run('deathView.holding'),false);
  });
  check('round reset, menu and match result remove death UI; no extra audio emitted',()=>{
    for(const reset of ['spawnRound(true)','backMenu()',"finish(false)"]){solo();const count=host.audioCalls.length;host.run('damageEntity(player,200,null)');assert.equal(host.audioCalls.length,count);host.run(reset);assert.equal(host.run('deathView.holding'),false);assert.equal(host.run("$('death-card').hidden"),true);}
  });
  console.log(`PASS ${groups} death presentation groups;actual saved-game host/guest JSON and inert audio`);
  console.log(`TOTAL ${Math.round(performance.now()-started)}ms wall / ${Math.round(process.cpuUsage(cpuStarted).user/1000)}ms CPU`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});

