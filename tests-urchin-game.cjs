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
 function setup(){local.reset();local.clearWalls();local.run(`netApplied.clear();netInputs.clear();clearDrops();effectsGroup.clear();effects.length=0;player.kit=new DuelistKit({character:'urchin'});player.kit.smoke=2;player.kit.updraft=1;player.kit.ultPoints=7;match.phase='live';match.credits=800;makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',primary:'spectre',secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.aiWeapon='spectre';enemy.aiAmmo=18;enemy.aiReserve=40;enemy.aiReload=0;enemy.fire=999;enemy.reactionUntil=999;enemy.group.position.set(0,0,-10);`);}
 const aim='{aim:{yaw:0,pitch:-.04}}';
 check('C equip/cancel/confirm and ongoing reload cancel; loaded ammunition/skills/cadence retained',()=>{setup();local.run(`useAbility('c')`);assert.equal(local.run('duckAim'),'c');local.run(`useAbility('c')`);assert.equal(local.run('duckAim'),null);local.run('enemy.aiReload=1');assert.ok(local.run(`activateAbility(player,'c',${aim})`));assert.equal(local.run('enemy.aiReload'),0);assert.equal(local.run('ordinarySkills.urchinJammed(enemy.id,elapsed)'),true);assert.equal(local.run('enemy.aiAmmo'),18);assert.equal(local.run('ordinarySkills.sealUntil(enemy.id,elapsed)'),0);local.run(`enemy.kit=new DuelistKit({character:'urchin'});enemy.kit.smoke=2;reloading=1;activateAbility(enemy,'c',{aim:{yaw:Math.PI,pitch:-.04}});player.ammo=1;mode='play';reload()`);assert.equal(local.run('reloading'),0);assert.equal(local.run('canServiceReload(player)'),false);local.run('elapsed+=8.01;reload()');assert.ok(local.run('reloading')>0);});
 check('C/Q target FOV, distance, wall, smoke, blindness and friend reject without spend',()=>{for(const key of['c','q'])for(const kind of['wall','smoke','blind','friend','far','aim']){setup();if(kind==='wall')local.wall({z:-5});if(kind==='smoke')local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:-5,radius:3.6,expires:100}])`);if(kind==='blind')local.run(`ordinarySkills.cast('nope-flash',{...ordinaryActorView(enemy),x:0,z:0},{x:0,y:1.7,z:-2},elapsed,match.round);elapsed+=NOPE_SKILLS.flashFlight+.01;updateOrdinarySkills()`);if(kind==='friend')local.run('enemy.team=player.team');if(kind==='far')local.run('enemy.z=-45');const before=copy(local.run('player.kit.snapshot()'));assert.equal(local.run(`activateAbility(player,'${key}',{aim:{yaw:${kind==='aim'?1:0},pitch:-.04}})`),undefined,`${key} ${kind}`);assert.deepEqual(copy(local.run('player.kit.snapshot()')),before);}});
 check('Q exact paid primary ownership and finite dropped ammo; repick preserves ammo, no duplication',()=>{setup();assert.ok(local.run(`activateAbility(player,'q',${aim})`));assert.equal(local.run('enemy.record.primary'),null);assert.equal(local.run('enemy.aiWeapon'),'classic');assert.deepEqual(copy(local.run('serializeDrops().map(d=>[d.weapon,d.ammo,d.reserve])')),[['spectre',18,40]]);local.run(`enemy.kit=new DuelistKit({character:'cat'});enemy.kit.nextSignatureAt=0;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;pickupDroppedWeapon(enemy,droppedWeapons[0].id)`);assert.equal(local.run('enemy.netAmmo'),18);assert.equal(local.run('enemy.netReserve'),40);assert.equal(local.run('droppedWeapons.length'),0);});
 check('Q rejects classic, secondary, bomber, missing ownership and full32 drops without deleting old drops',()=>{for(const kind of['classic','ghost','spike','ownership','full']){setup();if(['classic','ghost','spike'].includes(kind))local.run(`enemy.aiWeapon='${kind}'`);if(kind==='ownership')local.run('enemy.record.primary=null');if(kind==='full')local.run(`for(let i=0;i<32;i++)addDrop({id:++dropSequence,weapon:'spectre',x:2,z:2,yaw:0,ammo:1,reserve:2})`);assert.equal(local.run(`activateAbility(player,'q',${aim})`),undefined,kind);assert.equal(local.run('player.kit.updraft'),1);assert.equal(local.run('droppedWeapons.length'),kind==='full'?32:0);}});
 check('E finite loaded ammo to capped economic value, cooldown and invalid casts',()=>{setup();local.run(`activateAbility(player,'e')`);assert.equal(local.run('player.ammo'),7);assert.equal(local.run('player.reserve'),36);assert.equal(local.run('match.credits'),900);assert.equal(local.run('player.kit.nextSignatureAt'),28);for(const kind of['cap','empty','reload','knife']){setup();if(kind==='cap')local.run('match.credits=8990');if(kind==='empty')local.run('player.ammo=0');if(kind==='reload')local.run('reloading=1');if(kind==='knife')local.run(`inventory.active='knife'`);assert.equal(local.run(`activateAbility(player,'e')`),undefined,kind);}setup();local.run('match.credits=8970;activateAbility(player,"e")');assert.equal(local.run('match.credits'),8990);assert.equal(local.run('player.ammo'),11);});
 check('20event cap rollback all4 before ammo/credits/drop/reload mutation',()=>{for(const key of['c','q','e','x']){setup();local.run(`enemy.aiReload=1;for(let i=0;i<20;i++)ordinarySkills.cast('cap-bank',{...ordinaryActorView(player),id:'p'+i},ordinaryActorView(player),elapsed,match.round)`);const before=copy(local.run('player.kit.snapshot()'));assert.equal(local.run(`activateAbility(player,'${key}',${aim})`),undefined,key);assert.deepEqual(copy(local.run('player.kit.snapshot()')),before);assert.equal(local.run('match.credits'),800);assert.equal(local.run('player.ammo'),12);assert.equal(local.run('enemy.aiReload'),1);assert.equal(local.run('droppedWeapons.length'),0);}});
 check('guest only stock/cooldown prediction, no reload/drop/ammo/credit/effect authority',()=>{for(const key of['c','q','e','x']){setup();local.run('enemy.aiReload=1');assert.ok(local.run(`activateAbility(player,'${key}',{predict:true,aim:{yaw:0,pitch:-.04}})`),key);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('player.ammo'),12);assert.equal(local.run('match.credits'),800);assert.equal(local.run('enemy.aiReload'),1);assert.equal(local.run('enemy.record.primary'),'spectre');}});
 check('X two distinct oblique rays, firearm-only, wall/shield/decoy blockers, expiry',()=>{setup();local.run(`activateAbility(player,'x');enemy.z=-5;enemy.x=Math.tan(URCHIN_SKILLS.tridentAngle)*5;enemy.group.position.set(enemy.x,0,enemy.z);var origin=new THREE.Vector3(0,1.2,0),incoming=new THREE.Vector3(0,0,-1);`);const rays=copy(local.run('urchinTridentShot(player,origin,incoming,WEAPONS.vandal)'));assert.equal(rays.length,2);assert.ok(local.run('enemy.hp')<100);assert.equal(local.run('player.ammo'),12);assert.deepEqual(copy(local.run('urchinTridentShot(player,origin,incoming,WEAPONS.knife)')),[]);local.run('elapsed+=9.01');assert.deepEqual(copy(local.run('urchinTridentShot(player,origin,incoming,WEAPONS.vandal)')),[]);
 for(const kind of['wall','shield','decoy','guest']){setup();local.run(`activateAbility(player,'x');enemy.x=Math.tan(URCHIN_SKILLS.tridentAngle)*10;enemy.group.position.set(enemy.x,0,enemy.z);var origin=new THREE.Vector3(0,1.2,0),incoming=new THREE.Vector3(0,0,-1)`);if(kind==='wall')local.wall({z:-5});if(kind==='shield')local.run(`ordinarySkills.cast('duck-shield',{id:'shield',team:'red',x:0,y:0,z:-5,hp:100,alive:true},{x:0,y:0,z:-5,yaw:0},elapsed,match.round)`);if(kind==='decoy')local.run(`ordinarySkills.cast('nope-decoy',{id:'caster',team:'red',x:0,y:0,z:-5,hp:100,alive:true},{x:0,y:0,z:-5},elapsed,match.round)`);if(kind==='guest')local.run(`onlinePlaying=true;online={host:false,session:{memberId:'guest',hostId:'host'}}`);local.run('urchinTridentShot(player,origin,incoming,WEAPONS.vandal)');assert.equal(local.run('enemy.hp'),100,kind);}});
 check('actual local/remote triggers spend exactly1 round, keep cadence, create2 side rays',()=>{setup();local.run(`activateAbility(player,'x');mode='play';player.yaw=1.4;lastShot=-10;shoot(elapsed);var afterShots=effects.filter(e=>e.object.isLine).length`);assert.equal(local.run('player.ammo'),11);assert.equal(local.run('afterShots'),3);local.run('shoot(elapsed)');assert.equal(local.run('player.ammo'),11);
 setup();local.run(`enemy.remoteId='guest';enemy.kit=new DuelistKit({character:'urchin'});enemy.kit.ultPoints=7;enemy.netWeapon='spectre';enemy.netAmmo=18;enemy.netReserve=40;enemy.netReload=0;activateAbility(enemy,'x');applyRemoteAction(enemy,{type:'fire',yaw:1,pitch:0},elapsed)`);assert.equal(local.run('enemy.netAmmo'),17);assert.equal(local.run('effects.filter(e=>e.object.isLine).length'),3);});
 check('host remote E duplicate seq cannot mint extra credits/ammo; C jam blocks R and service',()=>{setup();local.run(`enemy.kit=new DuelistKit({character:'urchin'});enemy.remoteId='guest';enemy.netWeapon='spectre';enemy.netAmmo=18;enemy.netReserve=40;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);var packet={type:'input',seq:1,connection:'urchin',round:match.round,input:{x:0,y:0,z:-10,yaw:Math.PI,pitch:0},actions:[{type:'ability',seq:1,round:match.round,key:'e'}]};receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}});applyRemoteAction(enemy,{type:'reload'},elapsed)`);assert.equal(local.run('enemy.netAmmo'),13);assert.equal(local.run('enemy.record.credits'),900);assert.equal(local.run('enemy.netReload'),0);});
 check('independent JSON host guest transfer correct jam/trident, finite money/drop and stale snapshot no replay',()=>{const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.kit=new DuelistKit({character:'urchin'});player.kit.smoke=2;match.phase='live';makeBot({x:0,z:-10},1,'red',{id:'red-1',team:'red',primary:'spectre',secondary:'classic',credits:800,kit:new DuelistKit({character:'urchin'})});var remote=bots[0];remote.remoteId='guest';remote.netAmmo=18;remote.netReserve=40;remote.netWeapon='spectre';remote.kit.ultPoints=7;onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p}};netParticipants.set('guest','red-1');var captured;activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}});activateAbility(remote,'e');activateAbility(remote,'x');tickOnline(.1)`);guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-1')`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer)`);assert.equal(guest.run('ordinarySkills.urchinJammed(player.id,elapsed)'),true);assert.equal(guest.run('ordinarySkills.urchinTrident(player.id,elapsed)'),true);assert.equal(guest.run('player.ammo'),13);assert.equal(guest.run('match.credits'),900);
 host.run('elapsed+=.3;resetOrdinarySkills();tickOnline(.1)');guest.sandbox.fresh=copy(host.run('captured'));guest.run('receiveNetPacket("host",fresh);receiveNetPacket("host",transfer)');assert.equal(guest.run('ordinarySkills.urchinTrident(player.id,elapsed)'),false);assert.equal(guest.run('ordinarySkills.urchinJammed(player.id,elapsed)'),false);});
 check('death/nextR/exit reset all state, floor/support unchanged',()=>{setup();local.run(`activateAbility(player,'x');ordinarySkills.resetActor(player.id)`);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);setup();local.run(`activateAbility(player,'c',${aim});enemy.alive=false;enemy.hp=0;updateOrdinarySkills()`);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);setup();local.run(`activateAbility(player,'x');resetOrdinarySkills()`);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('urchinSkillFX.group.children.length'),0);});

 check('reload lock interrupts EMBER service and rejects new service before stock/cooldown spend',()=>{setup();local.run(`enemy.kit=new DuelistKit({character:'ember'});enemy.aiAmmo=1;activateAbility(enemy,'e');var serviceWasActive=!!enemy.serviceReload;activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}})`);assert.equal(local.run('serviceWasActive'),true);assert.equal(local.run('enemy.serviceReload'),null);assert.equal(local.run('enemy.aiAmmo'),1);local.run('enemy.kit.nextSignatureAt=0;enemy.kit.dash=1');assert.equal(local.run(`activateAbility(enemy,'e')`),undefined);assert.equal(local.run('enemy.kit.dash'),1);});
 check('targeted Q host authority synchronizes lost primary and finite world drop to independent guest',()=>{const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.kit=new DuelistKit({character:'urchin'});player.kit.updraft=1;match.phase='live';makeBot({x:0,z:-10},1,'red',{id:'red-1',team:'red',primary:'spectre',secondary:'classic',credits:800,kit:new DuelistKit({character:'urchin'})});var remote=bots[0];remote.remoteId='guest';remote.netAmmo=18;remote.netReserve=40;remote.netWeapon='spectre';onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p}};netParticipants.set('guest','red-1');var captured;activateAbility(player,'q',{aim:{yaw:0,pitch:-.04}});tickOnline(.1)`);guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-1')`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer)`);assert.equal(guest.run('inventory.primary'),null);assert.equal(guest.run('inventory.active'),'classic');assert.deepEqual(copy(guest.run('serializeDrops().map(d=>[d.weapon,d.ammo,d.reserve])')),[['spectre',18,40]]);guest.run(`equip('spectre')`); // A spoofed equip still needs host ownership, verified below.
 host.run(`applyRemoteAction(remote,{type:'equip',weapon:'spectre'},elapsed)`);assert.equal(host.run('remote.netWeapon'),'classic');});
 check('actual BOT trident and zero-ammo jam preserve aim policy and visual updates',()=>{setup();local.run(`enemy.kit=new DuelistKit({character:'urchin'});enemy.kit.ultPoints=7;activateAbility(enemy,'x');var rays=urchinTridentShot(enemy,new THREE.Vector3(enemy.x,1.2,enemy.z),new THREE.Vector3(0,0,1),WEAPONS.spectre)`);assert.equal(local.run('rays.length'),2);local.run(`enemy.aiAmmo=0;enemy.fire=0;enemy.reactionUntil=0;enemy.group.rotation.y=0;ordinarySkills.cast('urchin-jam',ordinaryActorView(player),{...ordinaryActorView(enemy),targetId:enemy.id},elapsed,match.round);var visualTicks=0;enemy.visual.update=()=>{visualTicks++};updateBots(.05)`);assert.equal(local.run('enemy.aiReload'),0);assert.ok(local.run('visualTicks')>0);});
 console.log(`PASS: ${groups} urchin saved-game authority/collision/JSON/cleanup groups; no audio`);
 console.log(`TOTAL ${Math.round(performance.now()-started)}ms wall / ${Math.round(process.cpuUsage(cpuStarted).user/1000)}ms CPU`);
}main().catch(e=>{console.error(e);process.exitCode=1;});
