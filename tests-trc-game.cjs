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


  const local=harness({realMap:true});
  function setup(){local.reset();local.run("selectArena('trc');map.traversal.reset();match.startLive();clearBots();player.trcLadder=null;player.crouch=0;player.vy=0;player.x=0;player.z=25;player.y=0;elapsed=10;");}
  check('all spawns and plant positions connect; every gallery, both ladders and stage are supported',()=>{setup();local.run(`for(const p of Object.values(map.teamSpawns).flat())for(const s of map.sites)for(const t of s.plantPositions){if(!navigation.isWalkable(p.x,p.z))throw Error('spawn');if(!navigation.path(p.x,p.z,t.x,t.z).length)throw Error('plant route');}for(const p of map.landmarks.filter(p=>p.y)){if(!navigation.path(0,25,p.x,p.z,0,p.y).length)throw Error('upper route '+p.id);Object.assign(player,p,{vy:0});for(let i=0;i<60;i++)updateActorVertical(player,.016);if(Math.abs(player.y-p.y)>.01)throw Error('unsupported '+p.id);}`);});
  check('all five stairways ascend and descend with real movement at 30/60/144Hz',()=>{setup();local.run(`map.traversal.restore(map.traversal.snapshot().map(([id,hp])=>[id,hp,true]));for(const hz of [30,60,144])for(const r of map.ramps){const cx=(r.minX+r.maxX)/2,cz=(r.minZ+r.maxZ)/2,axis=r.axis,sign=r.direction,min=axis==='x'?r.minX:r.minZ,max=axis==='x'?r.maxX:r.maxZ;Object.assign(player,{x:cx,z:cz,y:0,vy:0,crouch:0});player[axis]=sign>0?min-.65:max+.65;const length=max-min+1.3;for(let t=0;t<length/2;t+=1/hz){moveEntity(player,axis==='x'?sign*2/hz:0,axis==='z'?sign*2/hz:0);updateActorVertical(player,1/hz);}if(Math.abs(player.y-r.height)>.03)throw Error('ascent '+r.id+' '+hz+' '+JSON.stringify({x:player.x,y:player.y,z:player.z}));for(let t=0;t<length/2;t+=1/hz){moveEntity(player,axis==='x'?-sign*2/hz:0,axis==='z'?-sign*2/hz:0);updateActorVertical(player,1/hz);}for(let t=0;t<60;t++)updateActorVertical(player,1/60);if(player.y>.05)throw Error('descent '+r.id);}`);});
  check('both hatches climb continuously, exit onto their gallery, descend and reject distant requests',()=>{setup();local.run(`for(const l of map.traversal.ladders){Object.assign(player,{x:l.x,y:0,z:l.z,vy:0,crouch:0});if(!map.traversal.interact(player,{kind:'ladder',id:l.id},elapsed))throw Error('attach '+l.id);let y=0;for(let i=0;i<200;i++){map.traversal.climb(player,1,.016);if(player.y-y>.024)throw Error('teleport');y=player.y;if(!player.trcLadder)break;}if(player.trcLadder||Math.abs(player.y-l.height)>.01)throw Error('exit '+l.id+' '+player.y);if(!actorGrounded(player))throw Error('exit support');if(!map.traversal.interact(player,{kind:'ladder',id:l.id},elapsed))throw Error('descent attach');for(let i=0;i<200;i++)map.traversal.climb(player,-1,.016);if(player.y!==0||player.trcLadder)throw Error('descent');Object.assign(player,{x:0,y:0,z:25});if(map.traversal.interact(player,{kind:'ladder',id:l.id},elapsed))throw Error('remote attach');}`);});
  check('crouch-only duct entrance blocks standing, permits movement and forces low clearance',()=>{setup();local.run(`Object.assign(player,{x:-1.1,z:6.5,y:0,crouch:0});for(let i=0;i<80;i++){moveEntity(player,0,-.05);updateActorVertical(player,.016);}if(player.z<6.1)throw Error('standing entered');player.crouch=1;for(let i=0;i<150;i++){moveEntity(player,0,-.05);updateActorVertical(player,.016);}if(player.z>-.5)throw Error('crouch stuck '+player.z);if(canStand(player.x,0,.34,0,1.7))throw Error('standing clearance');`);});
  check('F operates doors for either team, blocks closing on players, shots break and round reset restores',()=>{setup();local.run(`for(const d of map.traversal.doors){Object.assign(player,{x:d.x+(d.axis==='z'?1:0),z:d.z+(d.axis==='x'?1:0),y:d.y,crouch:0});elapsed+=1;const n=map.traversal.nearby(player);if(n?.id!==d.id)throw Error('door prompt '+d.id);if(map.traversal.interact(player,n,elapsed,[player])!=='door-open')throw Error('open');if(!d.collider.disabled)throw Error('open collision');player.x=d.x;player.z=d.z;elapsed++;if(map.traversal.interact(player,n,elapsed,[player]))throw Error('crush');player.x+=d.axis==='z'?1:0;player.z+=d.axis==='x'?1:0;elapsed++;map.traversal.interact(player,n,elapsed,[player]);for(let i=0;i<5;i++)map.traversal.damage(d.id,40);if(d.hp!==0||!d.open||!d.collider.disabled)throw Error('break');}spawnRound();if(map.traversal.doors.some(d=>d.open||d.hp!==180||d.collider.disabled))throw Error('round reset');`);});
  check('metal footsteps reach hearing while muted, Shift/hush suppress and doors remain audible',()=>{setup();local.run(`Object.assign(player,{x:-1.1,z:0,y:0,crouch:1});soundEnabled=false;volume=0;botHearing.reset();for(let i=0;i<30;i++)trcMotionSound(player,.016,{x:-1.1,y:0,z:.03},false);if(!botHearing.listen({team:'red',x:-3,y:0,z:0},elapsed))throw Error('silent simulation');botHearing.reset();for(let i=0;i<30;i++)trcMotionSound(player,.016,{x:-1.1,y:0,z:.03},true);if(botHearing.listen({team:'red',x:-3,y:0,z:0},elapsed))throw Error('Shift audible');sound('door-open',{entity:player});if(!botHearing.listen({team:'red',x:-3,y:0,z:0},elapsed))throw Error('door silent');`);});
  check('host-owned doors survive JSON sync/rejoin, reject malformed state and old packets',()=>{
    setup();local.run(`makeBot({x:15,z:1},0,'red',{id:'red-0',team:'red',primary:null,secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var remote=bots[0];remote.id='red-0';remote.remoteId='guest';remote.netWeapon='classic';remote.netAmmo=12;remote.netReserve=36;onlinePlaying=true;online={host:true,session:{memberId:'host',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};map.traversal.damage('D1',200);netClock=0;tickOnline(.1);`);
    const guest=harness({realMap:true});guest.reset();guest.run(`selectArena('trc');onlinePlaying=true;online={host:false,room:{code:'TRCTEST1'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-0');`);
    guest.sandbox.packet=copy(local.run('captured'));guest.run("receiveNetPacket('host',packet)");assert.equal(guest.run('map.traversal.doors[0].hp'),0);assert.ok(Buffer.byteLength(JSON.stringify(guest.sandbox.packet))<65536);
    guest.sandbox.bad={...copy(guest.sandbox.packet),trcDoors:[['D1',-1,true]],time:999};guest.run('applyNetSnapshot(bad)');assert.notEqual(guest.run('elapsed'),999);
    guest.run("receiveNetPacket('host',packet)");assert.equal(guest.run('map.traversal.doors[0].hp'),0);
    local.run(`Object.assign(remote,{x:0,z:25,y:0});applyRemoteAction(remote,{type:'trc-interact',kind:'door',id:'D2'});`);assert.equal(local.run('map.traversal.doors[1].open'),false);
  });
  check('real BOT update follows both duct routes and climbs to the site high ground',()=>{
    for(const route of ['attackA','attackB']){setup();local.sandbox.routeName=route;local.run(`
      makeBot({x:0,z:25},3,'blue',{id:'blue-3',name:'climber',team:'blue',primary:'vandal',secondary:'classic',armor:0,credits:0,kit:new DuelistKit({character:'nope'})});
      var climber=bots[0];climber.trcRoute={key:routeName,round:match.round,index:0};
      for(var i=0;i<1500;i++){elapsed+=.05;updateBots(.05);}
      var end=map.traversal.routes[routeName].at(-1);
      if(Math.hypot(climber.x-end.x,climber.z-end.z,climber.y-end.y)>1.5)throw Error(routeName+' '+JSON.stringify({x:climber.x,y:climber.y,z:climber.z,route:climber.trcRoute,path:climber.path,ladder:climber.trcLadder}));
    `);}
  });
  check('host consumes door actions once, real remote gunfire breaks shutters, ladder input cannot teleport',()=>{
    setup();local.run(`makeBot({x:15,z:1},0,'red',{id:'red-0',team:'red',primary:null,secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var remote=bots[0];Object.assign(remote,{id:'red-0',remoteId:'guest',netWeapon:'classic',netAmmo:12,netReserve:36,netReload:0,lastNetShot:-10});
      netInputs.set('guest',{seq:1,round:match.round,connection:'test',received:elapsed,input:{x:15,z:1,y:0,yaw:0,pitch:0},actions:[{seq:1,round:match.round,type:'trc-interact',kind:'door',id:'D2'}]});
      updateRemoteActor(remote,.05);updateRemoteActor(remote,.05);if(!map.traversal.doors[1].open||netApplied.get('guest')!==1)throw Error('duplicate door');
      map.traversal.reset();environment.updateMatrixWorld(true);for(let i=0;i<8;i++){elapsed+=.5;applyRemoteAction(remote,{type:'fire',yaw:0,pitch:0},elapsed);}if(map.traversal.doors[1].hp!==0||remote.netAmmo!==4)throw Error('actual gun damage '+JSON.stringify(map.traversal.snapshot()));
      const l=map.traversal.ladders[1];Object.assign(remote,{x:l.x,y:0,z:l.z,vy:0,crouch:1});applyRemoteAction(remote,{type:'trc-interact',kind:'ladder',id:l.id});if(!remote.trcLadder)throw Error('host attach');
      for(let i=0;i<100&&remote.trcLadder;i++){elapsed+=.05;const old=remote.y;netInputs.set('guest',{seq:i+2,round:match.round,received:elapsed,connection:'test',input:{x:999,z:999,y:99,yaw:0,pitch:0,climb:1},actions:[]});updateRemoteActor(remote,.05);if(remote.y-old>.073)throw Error('vertical speed');}if(remote.trcLadder||Math.abs(remote.y-l.height)>.01)throw Error('host exit');
      damageEntity(remote,10000,player);if(remote.trcLadder)throw Error('dead ladder');backMenu();if(map.traversal.doors.some(d=>d.open||d.hp!==180))throw Error('menu cleanup');
    `);
  });
  check('site entries have two physical firing angles; ground hiding pockets are reachable',()=>{
    setup();local.run(`for(const [a,b]of [[[16,16.8,4.65],[12,25,1.45]],[[28,28.5,1.45],[12,25,1.45]],[[64,25.5,5.05],[62,29,1.45]],[[49,25,2.65],[62,29,1.45]]])if(!map.collision.rayClear(a[0]-36,a[2],a[1]-30,b[0]-36,b[2],b[1]-30))throw Error('blocked crossfire');
      for(const [x,z]of [[24,16],[26.5,24.5],[53,14.5],[67,23]])if(!navigation.isWalkable(x-36,z-30)||!navigation.path(0,25,x-36,z-30).length)throw Error('hide inaccessible');
    `);
  });
  check('a full ten-actor round runs the real movement, tactics, weapons and objective loop',()=>{
    setup();local.run(`online=null;onlinePlaying=false;mode='menu';$('map-select').value='trc';$('match-format').value='standard';startGame();startRound();if(bots.length!==9)throw Error('roster');for(let i=0;i<900;i++){updatePlay(.05);for(const a of [player,...bots])if(![a.x,a.y,a.z,a.hp].every(Number.isFinite)||a.y<-.01||a.y>9.6)throw Error('invalid actor');}if(!match||!['live','post','buy','match'].includes(match.phase))throw Error('round stopped');`);
  });
  console.log('PASS '+groups+' TRC game groups (audio mocked)');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
