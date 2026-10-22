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
 function setup(){local.reset();local.clearWalls();local.run(`player.kit=new DuelistKit({character:'nobi'});player.kit.smoke=2;player.kit.updraft=1;player.kit.ultPoints=7;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.aiWeapon='classic';enemy.aiAmmo=12;enemy.aiReserve=36;enemy.aiReload=0;enemy.fire=999;enemy.reactionUntil=999;`);}
 const aim="{aim:{yaw:0,pitch:-.04}}";
 check('C/Q equip then cancel freely and require actually aimed enemy',()=>{setup();for(const key of['c','q']){local.run(`useAbility('${key}')`);assert.equal(local.run('duckAim'),key);local.run(`useAbility('${key}')`);assert.equal(local.run('duckAim'),null);}assert.equal(local.run(`activateAbility(player,'c',{aim:{yaw:1,pitch:0}})`),undefined);assert.equal(local.run('player.kit.smoke'),2);assert.equal(local.run(`activateAbility(player,'c',${aim})?.type`),'nobi-tag');assert.equal(local.run('ordinarySkills.nobiVulnerability(enemy.id,elapsed)'),1.35);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('player.kit.smoke'),1);});
 check('wall/smoke/blind/friendly/range reject without charge; elevated visible targets allowed',()=>{for(const obstruction of['wall','smoke','blind','friendly','range']){setup();if(obstruction==='wall')local.wall({z:-5});if(obstruction==='smoke')local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:-5,radius:3.6,expires:100}])`);if(obstruction==='blind')local.run(`ordinarySkills.cast('nope-flash',{...ordinaryActorView(enemy),x:0,z:0},{x:0,y:1.7,z:-2},elapsed,match.round);elapsed+=NOPE_SKILLS.flashFlight+.01;updateOrdinarySkills()`);if(obstruction==='friendly')local.run('enemy.team=player.team');if(obstruction==='range')local.run('enemy.z=-45');assert.equal(local.run(`activateAbility(player,'c',${aim})`),undefined,obstruction);assert.equal(local.run('player.kit.smoke'),2,obstruction);}setup();local.run('enemy.y=2');assert.ok(local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:Math.atan2(1.6,10)}})`));});
 check('firearm weakness and body conversion leave knife/ability damage, misses and head damage unchanged',()=>{setup();local.run(`activateAbility(player,'c',${aim})`);near(local.run('nobiBulletDamage(player,enemy,26,78,true)'),35.1,'tag');assert.equal(local.run('nobiBulletDamage(player,enemy,26,78,false)'),26);assert.ok(local.run(`activateAbility(player,'x')`));near(local.run('nobiBulletDamage(player,enemy,26,78,true)'),105.3,'combined');near(local.run('nobiBulletDamage(player,enemy,78,78,true)'),105.3,'head');assert.equal(local.run('nobiBulletDamage(player,enemy,26,78,false)'),26);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('player.kit.ultPoints'),0);});
 check('actual local landed body shot applies legend before armor, and shooting a wall cannot damage',()=>{setup();local.run(`player.pitch=-.055;enemy.hp=200;botsGroup.updateMatrixWorld(true);shoot();var baseDamage=200-enemy.hp`);assert.ok(local.run('baseDamage')>0);const base=local.run('baseDamage');setup();local.run(`player.pitch=-.055;enemy.hp=200;activateAbility(player,'x');botsGroup.updateMatrixWorld(true);shoot()`);assert.ok(local.run('200-enemy.hp')>base);setup();local.wall({z:-5});local.run(`activateAbility(player,'x');botsGroup.updateMatrixWorld(true);shoot()`);assert.equal(local.run('enemy.hp'),100);});
 check('Q enforces local and authoritative guest minimum firearm intervals but does not slow knife',()=>{setup();local.run(`ordinarySkills.cast('nobi-brake',ordinaryActorView(enemy),{x:0,y:0,z:0,targetId:player.id},elapsed,match.round)`);near(local.run('nobiShotInterval(WEAPONS.classic,player)'),local.run('WEAPONS.classic.interval*1.6'),'interval');near(local.run('nobiShotInterval(WEAPONS.knife,player)'),local.run('WEAPONS.knife.interval'),'knife');local.run(`shoot();elapsed+=WEAPONS.classic.interval*1.2;shoot()`);assert.equal(local.run('player.ammo'),11);local.run(`elapsed+=WEAPONS.classic.interval*.5;shoot()`);assert.equal(local.run('player.ammo'),10);
 setup();local.run(`enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;activateAbility(player,'q',${aim});onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);applyRemoteAction(enemy,{type:'fire',seq:1,yaw:Math.PI,pitch:0});elapsed+=WEAPONS.classic.interval*1.2;applyRemoteAction(enemy,{type:'fire',seq:2,yaw:Math.PI,pitch:0})`);assert.equal(local.run('enemy.netAmmo'),11);local.run(`elapsed+=WEAPONS.classic.interval*.5;applyRemoteAction(enemy,{type:'fire',seq:3,yaw:Math.PI,pitch:0})`);assert.equal(local.run('enemy.netAmmo'),10);});
 check('E speeds actual local planting only, retains owner/site/static checks and does not freeze clocks',()=>{setup();local.run(`player.x=map.sites[0].x;player.z=map.sites[0].z;match.spike.status='carried';match.spike.carrier=player.id;inventory.active='spike';interactionHeld=true;var clock=match.roundTime;interactionHeld=false;activateAbility(player,'e');interactionHeld=true;`);local.run('updateInteraction(1,true)');near(local.run('match.spike.plantProgress'),1.5,'work');assert.equal(local.run('match.spike.status'),'carried');assert.equal(local.run('ordinarySkills.clockFrozen(elapsed)'),false);local.run('updateInteraction(1,true);updateInteraction(.67,true)');assert.equal(local.run('match.spike.status'),'planted');assert.equal(local.run('player.kit.nextSignatureAt'),28);});
 check('guest prediction spends resources only; no effects or damage benefits until authoritative JSON',()=>{for(const key of['c','q','e','x']){setup();assert.ok(local.run(`activateAbility(player,'${key}',{predict:true,aim:{yaw:0,pitch:-.04}})`));assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('ordinarySkills.nobiWork(player.id,elapsed)'),1);assert.equal(local.run('ordinarySkills.nobiLegend(player.id,elapsed)'),false);assert.equal(local.run('ordinarySkills.nobiInterval(enemy.id,elapsed)'),1);assert.equal(local.run('enemy.hp'),100);}});
 check('full20 event refusal rolls back stock and ULT, duplicate personal cast refused',()=>{setup();local.run(`for(let i=0;i<20;i++)ordinarySkills.cast('nobi-tool',{...ordinaryActorView(player),id:'p'+i},ordinaryActorView(player),elapsed,match.round);var before=player.kit.snapshot()`);for(const key of['c','q','e','x'])assert.equal(local.run(`activateAbility(player,'${key}',${aim})`),undefined);assert.deepEqual(copy(local.run('player.kit.snapshot()')),copy(local.run('before')));assert.equal(local.run('ordinarySkills.events(elapsed).length'),20);setup();assert.ok(local.run(`activateAbility(player,'e')`));assert.equal(local.run(`activateAbility(player,'e')`),undefined);});
 check('independent host/guest JSON accepts authoritative effects exactly once, death/team/newR clear',()=>{const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.kit=new DuelistKit({character:'nobi'});player.kit.smoke=2;player.kit.ultPoints=7;match.phase='live';activateAbility(player,'e');activateAbility(player,'x');onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p}};var captured;tickOnline(.1)`);guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','player')`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer);receiveNetPacket('host',transfer)`);assert.equal(guest.run('ordinarySkills.nobiWork(player.id,elapsed)'),1.5);assert.equal(guest.run('ordinarySkills.events(elapsed).filter(e=>e.type.startsWith("nobi-")).length'),2);host.run('player.alive=false;player.hp=0;updateOrdinarySkills()');assert.equal(host.run('ordinarySkills.nobiWork(player.id,elapsed)'),1);host.run('ordinarySkills.update([],elapsed,match.round+1)');assert.equal(host.run('ordinarySkills.events(elapsed).length'),0);});
 check('real HUD statuses surface debuffs and all4 descriptions without undefined state',()=>{setup();local.run(`activateAbility(player,'e');activateAbility(player,'x');updateHUD()`);assert.match(local.elements.get('status-effects').textContent,/ポケット工具/);assert.match(local.elements.get('status-effects').textContent,/逆転えり/);assert.equal(local.elements.get('status-effects').hidden,false);});

 check('host-owned guest E accelerates actual off work, one-owner lock, movement and death cancellation',()=>{setup();local.run(`enemy.kit=new DuelistKit({character:'nobi'});enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;enemy.x=0;enemy.z=0;match.spike.status='planted';match.spike.carrier=null;match.spike.x=0;match.spike.z=0;match.spike.timer=45;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);activateAbility(enemy,'e');netInputs.set('guest',{seq:1,connection:'nobi-work',round:match.round,input:{x:0,y:0,z:0,interact:true},actions:[],received:elapsed});updateRemoteActor(enemy,1)`);near(local.run('match.spike.defuseProgress'),1.5,'guest work');local.run(`match.interactDefuse(1,{actorId:'other',team:match.defenderTeam})`);near(local.run('match.spike.defuseProgress'),1.5,'single owner');assert.equal(local.run('match.spike.timer'),45);local.run(`enemy.alive=false;updateOrdinarySkills()`);assert.equal(local.run('ordinarySkills.nobiWork(enemy.id,elapsed)'),1);});
 check('BOT policy uses visible targets and C/Q without hidden-location casts; E stays tactical',()=>{setup();local.run(`enemy.kit=new DuelistKit({character:'nobi'});enemy.kit.smoke=2;enemy.kit.updraft=1;enemy.nextSkillAt=0;enemy.yaw=Math.PI;enemy.group.rotation.y=0;enemy.think=0;updateBots(.01)`);assert.ok(local.run(`ordinarySkills.events(elapsed).some(e=>e.type==='nobi-tag'&&e.targetId===player.id)`));local.run('elapsed+=1.1;updateBots(.01)');assert.ok(local.run(`ordinarySkills.events(elapsed).some(e=>e.type==='nobi-brake'&&e.targetId===player.id)`));setup();local.wall({z:-5});local.run(`enemy.kit=new DuelistKit({character:'nobi'});enemy.kit.smoke=2;enemy.kit.updraft=1;enemy.kit.ultPoints=7;enemy.nextSkillAt=0;enemy.yaw=Math.PI;enemy.group.rotation.y=0;enemy.think=0;updateBots(.01)`);assert.equal(local.run(`ordinarySkills.events(elapsed).filter(e=>e.sourceId===enemy.id).length`),0);});

 check('BOT carrier arms tool while approaching before F; remote targeted casts deduplicate',()=>{setup();local.run(`player.x=70;player.z=70;enemy.team=match.attackerTeam;enemy.kit=new DuelistKit({character:'nobi'});enemy.x=map.sites[0].x+3;enemy.z=map.sites[0].z;match.spike.status='carried';match.spike.carrier=enemy.id;targetSite='A';enemy.nextSkillAt=0;updateBots(.01)`);assert.equal(local.run('ordinarySkills.nobiWork(enemy.id,elapsed)'),1.5);
 setup();local.run(`enemy.kit=new DuelistKit({character:'nobi'});enemy.kit.smoke=2;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);var packet={type:'input',seq:1,connection:'nobi-target',round:match.round,input:{x:0,y:0,z:-10,yaw:Math.PI,pitch:-.04},actions:[{type:'ability',seq:1,round:match.round,key:'c',yaw:Math.PI,pitch:-.04}]};receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016)`);assert.equal(local.run('ordinarySkills.nobiVulnerability(player.id,elapsed)'),1.35);assert.equal(local.run('enemy.kit.smoke'),1);assert.equal(local.run(`ordinarySkills.events(elapsed).filter(e=>e.type==='nobi-tag').length`),1);
 });
 console.log(`PASS: ${groups} actual-game nobi groups; audio/rendering inert`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
