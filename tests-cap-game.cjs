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
 function setup(){local.reset();local.clearWalls();local.run(`netApplied.clear();netInputs.clear();player.kit=new DuelistKit({character:'cap'});player.kit.smoke=2;player.kit.updraft=1;player.kit.ultPoints=7;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic',armor:0,kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.aiWeapon='classic';enemy.aiAmmo=12;enemy.aiReserve=36;enemy.aiReload=0;enemy.fire=999;enemy.reactionUntil=999;`);}
 const aim='{aim:{yaw:0,pitch:-.04}}';
 check('C equip/cancel/left confirm and current ADS cancellation without ammo/fire rate/HP change',()=>{setup();local.run(`useAbility('c')`);assert.equal(local.run('duckAim'),'c');local.run(`useAbility('c')`);assert.equal(local.run('duckAim'),null);assert.ok(local.run(`activateAbility(player,'c',${aim})`));assert.equal(local.run('ordinarySkills.capLocked(enemy.id,elapsed)'),true);assert.equal(local.run('enemy.aiAmmo'),12);assert.equal(local.run('enemy.hp'),100);local.run(`enemy.kit=new DuelistKit({character:'cap'});enemy.kit.smoke=2;aiming=true;activateAbility(enemy,'c',{aim:{yaw:Math.PI,pitch:-.04}})`);assert.equal(local.run('aiming'),false);});
 check('C wall/smoke/blind/friend/out of40m preserve resources',()=>{for(const kind of['wall','smoke','blind','friend','far']){setup();if(kind==='wall')local.wall({z:-5});if(kind==='smoke')local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:-5,radius:3.6,expires:100}])`);if(kind==='blind')local.run(`ordinarySkills.cast('nope-flash',{...ordinaryActorView(enemy),x:0,z:0},{x:0,y:1.7,z:-2},elapsed,match.round);elapsed+=NOPE_SKILLS.flashFlight+.01;updateOrdinarySkills()`);if(kind==='friend')local.run('enemy.team=player.team');if(kind==='far')local.run('enemy.z=-45');assert.equal(local.run(`activateAbility(player,'c',${aim})`),undefined,kind);assert.equal(local.run('player.kit.smoke'),2);}});
 check('Q self clears current targeted impairments; no health/armor/ammo grant or future immunity',()=>{setup();local.run(`ordinarySkills.cast('nobi-tag',ordinaryActorView(enemy),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round);ordinarySkills.cast('cap-lock',ordinaryActorView(enemy),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round);player.hp=44;player.armor=12;activateAbility(player,'q',${aim})`);assert.equal(local.run('ordinarySkills.capLocked(player.id,elapsed)'),false);assert.equal(local.run('ordinarySkills.nobiVulnerability(player.id,elapsed)'),1);assert.equal(local.run('player.hp'),44);assert.equal(local.run('player.armor'),12);assert.equal(local.run('player.kit.updraft'),0);local.run(`ordinarySkills.cast('cap-lock',ordinaryActorView(enemy),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round)`);assert.equal(local.run('ordinarySkills.capLocked(player.id,elapsed)'),true);});
 check('Q visible ally targeted separately; wall/no impairment rejects and no stock loss',()=>{setup();assert.equal(local.run(`activateAbility(player,'q',${aim})`),undefined);assert.equal(local.run('player.kit.updraft'),1);local.run(`makeBot({x:0,z:-5},1,'blue',{id:'ally',team:'blue',kit:new DuelistKit()});var ally=bots.at(-1);ordinarySkills.cast('duck-seal',ordinaryActorView(enemy),{...ordinaryActorView(ally),targetId:ally.id},elapsed,match.round)`);assert.ok(local.run(`activateAbility(player,'q',${aim})`));assert.equal(local.run('ordinarySkills.sealUntil(ally.id,elapsed)'),0);});
 check('X real local firearm preserves loaded bullet/reserve and cadence; expiry resumes spend',()=>{setup();local.run(`mode='play';player.yaw=1.4;inventory.active='vandal';player.ammo=1;player.reserve=23;activateAbility(player,'x');lastShot=-10;shoot(elapsed)`);assert.equal(local.run('player.ammo'),1);assert.equal(local.run('player.reserve'),23);assert.equal(local.run('shots'),1);local.run('shoot(elapsed)');assert.equal(local.run('shots'),1);local.run('elapsed+=9.01;shoot(elapsed)');assert.equal(local.run('player.ammo'),0);assert.equal(local.run('player.kit.ultPoints'),0);});
 check('X empty gun remains empty and requires finite ordinary reload; no created ammo',()=>{setup();local.run(`mode='play';inventory.active='vandal';player.ammo=0;player.reserve=11;activateAbility(player,'x');lastShot=-10;shoot(elapsed)`);assert.equal(local.run('player.ammo'),0);assert.equal(local.run('player.reserve'),11);assert.ok(local.run('reloading')>0);});
 check('E actual reflected surface ray hits hostile once with75percent damage; second wall blocks',()=>{setup();local.run(`enemy.x=0;enemy.z=5;enemy.group.position.set(0,0,5);enemy.group.updateMatrixWorld(true);activateAbility(player,'e')`);const surface=local.wall({z:-5});local.sandbox.surface=surface;local.run(`environment.updateMatrixWorld(true);var origin=new THREE.Vector3(0,1.2,0),incoming=new THREE.Vector3(0,0,-1),rr=new THREE.Raycaster(origin,incoming,0,90),hit=rr.intersectObject(surface)[0];var bounced=capBounceShot(player,origin,incoming,hit,WEAPONS.vandal)`);assert.equal(local.run('bounced.targetId'),'enemy');near(local.run('enemy.hp'),70,'reflected body40*.75');setup();local.run(`enemy.x=0;enemy.z=5;enemy.group.position.set(0,0,5);activateAbility(player,'e')`);const first=local.wall({z:-5});local.wall({z:2});local.sandbox.surface=first;local.run(`environment.updateMatrixWorld(true);var origin=new THREE.Vector3(0,1.2,0),incoming=new THREE.Vector3(0,0,-1),rr=new THREE.Raycaster(origin,incoming,0,90);capBounceShot(player,origin,incoming,rr.intersectObject(surface)[0],WEAPONS.vandal)`);assert.equal(local.run('enemy.hp'),100);});
 check('E no guest damage, no knife, no floor bounce, no inactive bonus; no auto-target',()=>{setup();local.run(`activateAbility(player,'e')`);const surface=local.wall({z:-5});local.sandbox.surface=surface;local.run(`var origin=new THREE.Vector3(0,1.2,0),incoming=new THREE.Vector3(0,0,-1);environment.updateMatrixWorld(true);var hit=new THREE.Raycaster(origin,incoming,0,90).intersectObject(surface)[0]`);assert.equal(local.run('capBounceShot(player,origin,incoming,hit,WEAPONS.knife)'),null);local.run(`ordinarySkills.reset()`);assert.equal(local.run('capBounceShot(player,origin,incoming,hit,WEAPONS.vandal)'),null);});
 check('20-event cap rolls back C/Q/E/X before any cleansing or bullet authority',()=>{for(const key of['c','e','x']){setup();local.run(`for(let i=0;i<20;i++)ordinarySkills.cast('cap-bank',{...ordinaryActorView(player),id:'p'+i},ordinaryActorView(player),elapsed,match.round)`);const before=copy(local.run('player.kit.snapshot()'));assert.equal(local.run(`activateAbility(player,'${key}',${aim})`),undefined);assert.deepEqual(copy(local.run('player.kit.snapshot()')),before);}});
 check('guest resources predict only, no cleansing/ammo mutation',()=>{setup();local.run(`ordinarySkills.cast('cap-lock',ordinaryActorView(enemy),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round)`);assert.ok(local.run(`activateAbility(player,'q',{predict:true,aim:{yaw:0,pitch:-.04}})`));assert.equal(local.run('ordinarySkills.capLocked(player.id,elapsed)'),true);assert.equal(local.run('player.kit.updraft'),0);local.run(`activateAbility(player,'x',{predict:true})`);assert.equal(local.run('ordinarySkills.capMagazine(player.id,elapsed)'),false);});
 check('host remote X command deduplicates point spend and bullets; round cleanup removes all effects',()=>{setup();local.run(`enemy.kit=new DuelistKit({character:'cap'});enemy.kit.ultPoints=7;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=2;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);var packet={type:'input',seq:1,connection:'cap-ammo',round:match.round,input:{x:0,y:0,z:-10,yaw:Math.PI,pitch:0},actions:[{type:'ability',seq:1,round:match.round,key:'x'}]};receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);applyRemoteAction(enemy,{type:'fire',seq:2,round:match.round,yaw:1,pitch:0},elapsed)`);assert.equal(local.run('enemy.kit.ultPoints'),0);assert.equal(local.run('enemy.netAmmo'),2);assert.equal(local.run('ordinarySkills.events(elapsed).filter(e=>e.type==="cap-magazine").length'),1);local.run('ordinarySkills.update([],elapsed,match.round+1)');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);});

 check('E actual second-leg shield/decoy/floor blockers, guest has no damage authority',()=>{for(const mode of ['shield','decoy','guest']){setup();local.run(`enemy.z=5;enemy.group.position.set(0,0,5);activateAbility(player,'e')`);const surface=local.wall({z:-5});local.sandbox.surface=surface;
 if(mode==='shield')local.run(`ordinarySkills.cast('duck-shield',{id:'shield',team:'red',x:0,y:0,z:2,hp:100,alive:true},{x:0,y:0,z:2,yaw:0},elapsed,match.round)`);
 if(mode==='decoy')local.run(`ordinarySkills.cast('nope-decoy',{id:'caster',team:'red',x:0,y:0,z:2,hp:100,alive:true},{x:0,y:0,z:2},elapsed,match.round)`);
 if(mode==='guest')local.run(`onlinePlaying=true;online={host:false,session:{memberId:'guest',hostId:'host'}}`);
 local.run(`environment.updateMatrixWorld(true);var origin=new THREE.Vector3(0,1.2,0),incoming=new THREE.Vector3(0,0,-1);capBounceShot(player,origin,incoming,new THREE.Raycaster(origin,incoming,0,90).intersectObject(surface)[0],WEAPONS.vandal)`);assert.equal(local.run('enemy.hp'),100,mode);}
 setup();local.run(`activateAbility(player,'e');var floor=new THREE.Mesh(new THREE.BoxGeometry(10,.2,10),new THREE.MeshBasicMaterial());environment.add(floor);environment.updateMatrixWorld(true);var origin=new THREE.Vector3(0,2,0),incoming=new THREE.Vector3(0,-1,0),hit=new THREE.Raycaster(origin,incoming,0,90).intersectObject(floor)[0]`);assert.equal(local.run('capBounceShot(player,origin,incoming,hit,WEAPONS.vandal)'),null);
 });
 check('independent host/guest JSON accepts lock/bank/magazine, rejection ACK restores stock, cleanup cannot replay old snapshot',()=>{const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.x=0;player.z=0;player.kit=new DuelistKit({character:'cap'});player.kit.smoke=2;match.phase='live';makeBot({x:0,z:-10},1,'red',{id:'red-1',team:'red',secondary:'classic',kit:new DuelistKit({character:'cap'})});var remote=bots[0];remote.remoteId='guest';remote.netAmmo=2;remote.netReserve=36;remote.netWeapon='classic';remote.kit.ultPoints=7;onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p}};netParticipants.set('guest','red-1');var captured;activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}});activateAbility(remote,'e');activateAbility(remote,'x');tickOnline(.1)`);guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-1')`);
 guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer);aiming=true;updateOrdinarySkills()`);assert.equal(guest.run('ordinarySkills.capLocked(player.id,elapsed)'),true);assert.equal(guest.run('aiming'),false);assert.equal(guest.run('ordinarySkills.capMagazine(player.id,elapsed)'),true);assert.equal(guest.run('ordinarySkills.capBank(player.id,elapsed)'),true);assert.equal(guest.run('player.ammo'),2);
 guest.run(`player.kit.smoke=0;netActions=[{seq:8,type:'ability',key:'c'}]`);host.run(`netApplied.set('guest',8);tickOnline(.1)`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer)`);assert.equal(guest.run('player.kit.smoke'),host.run('remote.kit.smoke'));assert.equal(guest.run('netActions.length'),0);
 const old=copy(host.run('captured'));host.run(`ordinarySkills.reset();elapsed+=10;tickOnline(.1)`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer)`);guest.sandbox.transfer=old;guest.run(`receiveNetPacket('host',transfer)`);assert.equal(guest.run('ordinarySkills.capMagazine(player.id,elapsed)'),false);assert.equal(guest.run('ordinarySkills.capLocked(player.id,elapsed)'),false);
 });
 check('BOT locks visible firearm threats, uses bank/X and cleanses self; wall hides target',()=>{setup();local.run(`enemy.kit=new DuelistKit({character:'cap'});enemy.kit.smoke=2;enemy.kit.ultPoints=7;enemy.nextSkillAt=0;enemy.yaw=Math.PI;enemy.group.rotation.y=0;inventory.active='vandal';updateBots(.01)`);assert.equal(local.run('ordinarySkills.capLocked(player.id,elapsed)'),true);assert.equal(local.run('ordinarySkills.capBank(enemy.id,elapsed)'),true);assert.equal(local.run('ordinarySkills.capMagazine(enemy.id,elapsed)'),true);
 setup();local.wall({z:-5});local.run(`enemy.kit=new DuelistKit({character:'cap'});enemy.kit.smoke=2;enemy.nextSkillAt=0;enemy.yaw=Math.PI;enemy.group.rotation.y=0;inventory.active='vandal';updateBots(.01)`);assert.equal(local.run('ordinarySkills.capLocked(player.id,elapsed)'),false);assert.equal(local.run('enemy.kit.smoke'),2);
 setup();local.run(`enemy.kit=new DuelistKit({character:'cap'});enemy.kit.updraft=1;enemy.nextSkillAt=0;ordinarySkills.cast('nobi-brake',ordinaryActorView(player),{...ordinaryActorView(enemy),targetId:enemy.id},elapsed,match.round);updateBots(.01)`);assert.equal(local.run('ordinarySkills.nobiInterval(enemy.id,elapsed)'),1);
 });

 check('Q clears an existing real flash and full event pool rejects cleanse without side effects',()=>{setup();local.run(`ordinarySkills.cast('nope-flash',{...ordinaryActorView(enemy),x:0,z:0},{x:0,y:1.7,z:-2},elapsed,match.round);elapsed+=NOPE_SKILLS.flashFlight+.01;updateOrdinarySkills()`);assert.ok(local.run('ordinarySkills.blindUntil(player.id,elapsed)')>local.run('elapsed'));assert.ok(local.run(`activateAbility(player,'q',${aim})`));assert.equal(local.run('ordinarySkills.blindUntil(player.id,elapsed)'),0);
 setup();local.run(`ordinarySkills.cast('cap-lock',ordinaryActorView(enemy),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round);for(let i=0;i<19;i++)ordinarySkills.cast('cap-bank',{...ordinaryActorView(player),id:'p'+i},ordinaryActorView(player),elapsed,match.round)`);assert.equal(local.run(`activateAbility(player,'q',${aim})`),undefined);assert.equal(local.run('player.kit.updraft'),1);assert.equal(local.run('ordinarySkills.capLocked(player.id,elapsed)'),true);
 });
 check('real host remote firearm reflects once; first-leg shield prevents reflection',()=>{for(const shield of[false,true]){setup();local.run(`player.z=5;enemy.z=0;enemy.group.position.set(0,0,0);enemy.kit=new DuelistKit({character:'cap'});enemy.netWeapon='vandal';enemy.netAmmo=25;enemy.netReserve=75;enemy.netReload=0;enemy.remoteId='guest';activateAbility(enemy,'e');onlinePlaying=true;online={host:true,session:{memberId:'host'}}`);local.wall({z:-5});if(shield)local.run(`ordinarySkills.cast('duck-shield',{id:'blocker',team:'blue',x:0,y:0,z:-2,hp:100,alive:true},{x:0,y:0,z:-2,yaw:0},elapsed,match.round)`);local.run(`environment.updateMatrixWorld(true);applyRemoteAction(enemy,{type:'fire',seq:1,yaw:0,pitch:0})`);if(shield)assert.equal(local.run('player.hp'),100);else assert.ok(local.run('player.hp')<100);assert.equal(local.run('enemy.netAmmo'),24);}
 });

 check('lens distortion changes only accepted firearm rays; all ten firearm paths use one cone',()=>{
  for(const id of ['classic','ghost','spectre','vandal','phantom','pump','drum','scout','atlas','forge']){
   setup();local.sandbox.weaponId=id;local.run(`inventory.active=weaponId;player.ammo=WEAPONS[weaponId].mag;player.reserve=90;player.yaw=0;player.pitch=0;shotSequence=0;Math.random=()=>.5;var traceRays=[];var originalTracer=tracer;tracer=(from,to)=>traceRays.push(to.clone().sub(from).normalize().toArray());shoot(elapsed);tracer=originalTracer;var clearRays=traceRays.map(a=>a.slice());`);
   const clear=copy(local.run('clearRays'));
   setup();local.sandbox.weaponId=id;local.run(`inventory.active=weaponId;player.ammo=WEAPONS[weaponId].mag;player.reserve=90;player.yaw=0;player.pitch=0;shotSequence=0;Math.random=()=>.5;ordinarySkills.cast('cap-lock',ordinaryActorView(enemy),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round);var traceRays=[];var originalTracer=tracer;tracer=(from,to)=>traceRays.push(to.clone().sub(from).normalize().toArray());shoot(elapsed);tracer=originalTracer;`);
   const locked=copy(local.run('traceRays'));assert.ok(locked.length>0,id);assert.notDeepEqual(locked,clear,id);assert.equal(local.run('player.ammo'),local.run('WEAPONS[weaponId].mag-1'),id);assert.equal(local.run('player.reserve'),90,id);
  }
 });
 check('host remote raw aim receives exactly one distortion; duplicate fire and knives do not add it',()=>{
  setup();local.run(`enemy.remoteId='g';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;enemy.lastNetShot=-10;enemy.shotSequence=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};ordinarySkills.cast('cap-lock',ordinaryActorView(player),{...ordinaryActorView(enemy),targetId:enemy.id},elapsed,match.round);var traces=[];var priorTracer=tracer;tracer=(from,to)=>traces.push(to.clone().sub(from).normalize().toArray());applyRemoteAction(enemy,{type:'fire',yaw:Math.PI,pitch:0},elapsed);applyRemoteAction(enemy,{type:'fire',yaw:Math.PI,pitch:0},elapsed);tracer=priorTracer;var expected=capDistortAim(enemy,new THREE.Vector3(0,0,1)).toArray();`);
  assert.equal(local.run('traces.length'),1);assert.equal(local.run('enemy.netAmmo'),11);const a=copy(local.run('traces[0]')),b=copy(local.run('expected'));for(let i=0;i<3;i++)near(a[i],b[i],'host distortion '+i,1e-6);
  setup();local.run(`inventory.active='knife';player.kit.knivesActive=true;player.kit.knives=5;player.yaw=0;player.pitch=0;ordinarySkills.cast('cap-lock',ordinaryActorView(enemy),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round);shoot(elapsed)`);near(local.run('raycaster.ray.direction.x'),0,'ULT knife is unchanged');
 });
 check('BOT casts lens break on a visible non-ADS BOT and hidden/expired effects cannot grant awareness',()=>{
  setup();local.run(`player.alive=false;player.hp=0;enemy.kit=new DuelistKit({character:'cap'});enemy.kit.smoke=2;enemy.nextSkillAt=0;enemy.group.rotation.y=0;makeBot({x:0,z:0},1,'blue',{id:'ally-target',team:'blue',secondary:'classic',kit:new DuelistKit({character:'nope'})});var targetBot=bots.at(-1);targetBot.aiWeapon='classic';targetBot.fire=999;updateBots(.01);`);
  assert.equal(local.run('ordinarySkills.capLocked(targetBot.id,elapsed)'),true);assert.equal(local.run('enemy.kit.smoke'),1);
  local.run('elapsed+=CAP_SKILLS.lockDuration+.01;updateOrdinarySkills()');assert.equal(local.run('ordinarySkills.capLocked(targetBot.id,elapsed)'),false);
 });
 console.log(`PASS: ${groups} actual-game cap groups; audio/rendering inert`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
