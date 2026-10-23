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
    const audioCalls=[];const sandbox = { audioCalls, ...imported, THREE: { ...THREE, WebGLRenderer: Renderer },
      createMap: realMap ? actualCreateMap : fixtureMap, document,
      // Never instantiate AudioContext or fetch/decode/play any recording.
      createGameAudio: () => ({ init() {}, play(...args) {audioCalls.push(args)}, unlock() {}, resume() {}, setVolume() {}, dispose() {} }),
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








 const local=harness({realMap:true});
 function setup(h=local){h.reset();h.run("selectArena('hirakata');resetTraffic();elapsed=10;match.phase='live';soundEnabled=true;volume=.45;audioCalls.length=0;netCues.length=0;netSeenCueSequence=0;onlinePlaying=true;online={host:true};Object.assign(player,{x:-20,z:20,y:0});var p={x:-20,z:13,yaw:0};");}
 check('only actual moving host demolition emits one cue at contact, never the bay center',()=>{
  setup();local.run("busCanDrive(p,p,{owner:player.id,speed:4,busId:'north-1'})");assert.equal(local.run("audioCalls.filter(a=>a[0]==='bus-break').length"),1);assert.equal(local.run("netCues.filter(c=>c.type==='bus-break').length"),1);
  const cue=copy(local.run("netCues.find(c=>c.type==='bus-break')")),point=copy(local.run('map.destruction.impactPoints()[0]'));near(cue.x,point.x,'contactX');near(cue.y,point.y,'contactY');near(cue.z,point.z,'contactZ');near(local.run("audioCalls.find(a=>a[0]==='bus-break')[1].distance"),Math.hypot(cue.x+20,cue.z-20),'actual sound distance');assert.ok(local.run('map.destruction.fx.children.length===3'));
 });
 check('repeated sweep/substeps are silent; perbus750ms bound and reset do not replay delayed audio',()=>{
  setup();local.run("busCanDrive(p,p,{owner:player.id,speed:4,busId:'a'});for(var i=0;i<20;i++)busCanDrive(p,p,{owner:player.id,speed:4,busId:'a'});map.destruction.reset();elapsed+=.1;busCanDrive(p,p,{owner:player.id,speed:4,busId:'a'});");assert.equal(local.run('audioCalls.length'),1);
  local.run("map.destruction.reset();elapsed+=.66;busCanDrive(p,p,{owner:player.id,speed:4,busId:'a'})");assert.equal(local.run('audioCalls.length'),2);local.run("resetTraffic();busCanDrive(p,p,{owner:player.id,speed:4,busId:'a'})");assert.equal(local.run('audioCalls.length'),3);
 });
 check('unowned, slow, empty road and guest prediction produce no new sound or geometry damage',()=>{
  for(const code of["busCanDrive(p,p)","busCanDrive(p,p,{owner:player.id,speed:.49})","busCanDrive({x:4,z:65,yaw:0},{x:4,z:65,yaw:0},{owner:player.id,speed:8})","online.host=false;busCanDrive(p,p,{owner:player.id,speed:8})"]){setup();local.run(code);assert.equal(local.run('audioCalls.length'),0);assert.equal(local.run('netCues.length'),0);assert.equal(local.run('map.destruction.snapshot()'),'');}
 });
 check('host muted demolition still shares one receipt, consumes it without later playback',()=>{
  setup();local.run("soundEnabled=false;busCanDrive(p,p,{owner:player.id,speed:4})");assert.equal(local.run('audioCalls.length'),0);assert.equal(local.run('netCues.length'),1);local.run('soundEnabled=true;map.destruction.update(elapsed+.1)');assert.equal(local.run('audioCalls.length'),0);
 });
 check('independent hostguestJSON shares contact debris and audio once; fresh joins remain silent',()=>{
  setup();const guest=harness({realMap:true});local.run("makeBot({x:0,z:60},0,'red',{id:'red-0',team:'red',primary:null,secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var remote=bots[0];remote.id='red-0';remote.remoteId='guest';roster=[roster[0],remote.record];online={host:true,room:{code:'BUSROOM1'},session:{memberId:'host',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest','red-0');netClock=0;tickOnline(.1)");
  guest.reset();guest.run("selectArena('hirakata');soundEnabled=true;volume=.45;audioCalls.length=0;onlinePlaying=true;online={host:false,room:{code:'BUSROOM1'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-0')");guest.sandbox.transfer=copy(local.run('captured'));guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('audioCalls.length'),0);
  local.run("elapsed+=.1;busCanDrive(p,p,{owner:player.id,speed:6,busId:'south-0'});netClock=0;tickOnline(.1)");const packet=copy(local.run('captured'));assert.ok(Buffer.byteLength(JSON.stringify(packet))<65536);guest.sandbox.transfer=packet;guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run('map.destruction.snapshot()'),local.run('map.destruction.snapshot()'));assert.equal(guest.run("audioCalls.filter(a=>a[0]==='bus-break').length"),1);assert.ok(guest.run('map.destruction.fx.children[0].count>=96'));
  const cue=packet.cues.find(c=>c.type==='bus-break'),pos=guest.run('(()=>{const m=new THREE.Matrix4();map.destruction.fx.children[0].getMatrixAt(0,m);return new THREE.Vector3().setFromMatrixPosition(m)})()');near(pos.x,cue.x,'guest contactX',.03);near(pos.z,cue.z,'guest contactZ',.03);
  guest.run("receiveNetPacket('host',transfer)");assert.equal(guest.run("audioCalls.filter(a=>a[0]==='bus-break').length"),1);
  guest.run('map.destruction.reset();netSeenCueSequence=0;audioCalls.length=0;netHasSnapshot=false');guest.sandbox.transfer=packet;guest.run("applyNetSnapshot(transfer)");assert.equal(guest.run('audioCalls.length'),0);assert.ok(guest.run('map.destruction.fx.children.every(o=>o.count===0)'));
  guest.sandbox.transfer={...packet,seq:packet.seq+100,cues:{bad:'shape'}};guest.run("receiveNetPacket('host',transfer)");
 });
 check('wrong round, stale, future, nonfinite, bounds, muted, duplicate and fresh receipts never make delayed sound',()=>{
  setup();local.run("online={host:false};var packet={time:10,rules:{round:match.round,phase:'live'},cues:[]};var receipt={seq:1,round:match.round,type:'bus-break',x:-20,y:1.35,z:13,time:10}");
  for(const change of["time:9","time:10.1","y:NaN","x:83","y:31","round:99"]){local.run('netSeenCueSequence=0;packet.cues=[{...receipt,'+change+'}];applyNetCues(packet,false,player.id)');assert.equal(local.run('audioCalls.length'),0);}
  for(const gate of['soundEnabled=false','volume=0']){local.run(`netSeenCueSequence=0;soundEnabled=true;volume=.45;${gate};packet.cues=[receipt];applyNetCues(packet,false,player.id);soundEnabled=true;volume=.45;applyNetCues(packet,false,player.id)`);assert.equal(local.run('audioCalls.length'),0);}
  local.run('netSeenCueSequence=0;packet.cues=[receipt];applyNetCues(packet,true,player.id);applyNetCues(packet,false,player.id)');assert.equal(local.run('audioCalls.length'),0);
  local.run('netSeenCueSequence=0;applyNetCues(packet,false,player.id);applyNetCues(packet,false,player.id)');assert.equal(local.run('audioCalls.length'),1);
 });
 console.log('PASS '+groups+' actual bus impact groups; no sound output; '+Math.round(performance.now()-started)+'ms');
}main().catch(e=>{console.error(e);process.exitCode=1;});
