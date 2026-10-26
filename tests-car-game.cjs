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


  const local=harness();
  function setup(){local.reset();local.clearWalls();local.run(`player.kit=new DuelistKit({character:'car'});player.kit.smoke=2;player.kit.updraft=1;player.kit.ultPoints=7;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.aiWeapon='classic';enemy.aiAmmo=12;enemy.aiReserve=36;enemy.aiReload=0;enemy.fire=999;enemy.reactionUntil=999;`);}
  const advance=(h,seconds)=>{h.sandbox.seconds=seconds;h.run(`for(let t=0;t<seconds-1e-8;t+=1/120){elapsed+=1/120;updateCarMotions(1/120)}`);};
  check('C equips/cancels free; actual body travels before contact,100 raw damage and continuous24m arc',()=>{setup();local.run(`enemy.armor=50;useAbility('c');useAbility('c')`);assert.equal(local.run('duckAim'),null);assert.equal(local.run('player.kit.smoke'),2);assert.equal(local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}})?.type`),'car-bumper');assert.equal(local.run('player.z'),0);assert.equal(local.run('enemy.z'),-10);assert.equal(local.run('enemy.hp'),100);advance(local,.2);assert.ok(local.run('player.z')<-4);assert.equal(local.run('enemy.hp'),100);advance(local,.2);assert.equal(local.run('enemy.hp'),50);assert.ok(local.run('enemy.z')<-10&&local.run('enemy.z')>-14);assert.ok(local.run('enemy.y')>0);advance(local,.4);assert.ok(local.run('enemy.z')<-19&&local.run('enemy.z')>-25);assert.ok(local.run('enemy.y')>0);advance(local,.7);near(local.run('enemy.z'),-34,'8x launch',.02);assert.equal(local.run('player.kit.smoke'),1);assert.equal(local.run('enemy.hp'),50);});
  check('ram collides with new walls; launch stops at walls; airborne/occluded targets refuse',()=>{setup();local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}})`);local.wall({z:-5});advance(local,1);assert.ok(local.run('player.z')>-5);assert.equal(local.run('enemy.hp'),100);setup();local.wall({z:-15,height:6});local.run(`enemy.armor=50;activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}})`);advance(local,1.5);assert.ok(local.run('enemy.z')>-15);assert.equal(local.run('enemy.hp'),50);setup();local.run(`enemy.y=2;enemy.vy=1`);assert.equal(local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:0}})`),undefined);setup();local.wall({z:-5});assert.equal(local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:0}})`),undefined);assert.equal(local.run('player.kit.smoke'),2);});
  check('Q removes only the nearest intersected enemy/ally smoke, including dome; no cast into empty space',()=>{setup();local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:-10,radius:3.6,expires:100},{id:2,kind:'veil',x:0,y:1.6,z:-20,radius:9,expires:100}])`);assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}})?.type`),'car-wash');assert.equal(local.run('smokes.length'),1);assert.equal(local.run('smokes[0].id'),2);local.run('player.kit.updraft=1');assert.ok(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}})`));assert.equal(local.run('smokes.length'),0);local.run('player.kit.updraft=1');assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}})`),undefined);assert.equal(local.run('player.kit.updraft'),1);});
  check('Q removes real ordinary fog and no seeds, rejects wall/40m range and blindness without consuming',()=>{setup();local.run(`ordinarySkills.cast('mend-pollen',{...ordinaryActorView(enemy),id:'mend'},{x:0,y:1.7,z:-10},elapsed,match.round);ordinarySkills.cast('mend-seeds',ordinaryActorView(enemy),{x:0,y:.12,z:-10},elapsed,match.round);elapsed+=1`);assert.ok(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}})`));assert.equal(local.run(`ordinarySkills.events(elapsed).some(e=>e.type==='mend-pollen')`),false);assert.equal(local.run(`ordinarySkills.events(elapsed).some(e=>e.type==='mend-seeds')`),true);
    setup();local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:-10,radius:3.6,expires:100}])`);local.wall({z:-5});assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}})`),undefined);local.clearWalls();local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:-45,radius:3.6,expires:100}])`);assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:0,pitch:0}})`),undefined);assert.equal(local.run('player.kit.updraft'),1);});
  check('E actual grounded moving shot drops movement spread; recoil/base/sustained and airborne remain',()=>{setup();local.run(`player.vx=3;Math.random=()=>1;shoot();var withoutGyro=raycaster.ray.direction.x`);const without=local.run('withoutGyro');setup();local.run(`player.vx=3;Math.random=()=>1;activateAbility(player,'e');shoot();var withGyro=raycaster.ray.direction.x`);assert.ok(Math.abs(local.run('withGyro'))<Math.abs(without));assert.ok(local.run('player.recoil')>0);assert.equal(local.run('ordinarySkills.carGyro(player.id,elapsed)'),true);local.run('elapsed+=4');assert.equal(local.run('ordinarySkills.carGyro(player.id,elapsed)'),false);});
  check('X refills only living visible depleted allied normal kits, preserving health/ammo/credits/ULT and ongoing effects',()=>{setup();local.run(`makeBot({x:4,z:0},1,'blue',{id:'ally',team:'blue',secondary:'classic',kit:new DuelistKit({character:'duelist'})});var ally=bots.find(b=>b.id==='ally');ally.kit.smoke=0;ally.kit.updraft=0;ally.kit.dash=0;ally.kit.ultPoints=4;ally.hp=42;enemy.kit.smoke=0;player.kit.smoke=0;player.kit.updraft=0;player.kit.dash=0;player.kit.nextSignatureAt=90;var hp=player.hp,ammo=player.ammo,money=match.credits;`);assert.equal(local.run(`activateAbility(player,'x')?.type`),'car-pit');assert.equal(local.run('ally.kit.smoke'),2);assert.equal(local.run('ally.kit.updraft'),2);assert.equal(local.run('ally.kit.dash'),1);assert.equal(local.run('ally.kit.ultPoints'),4);assert.equal(local.run('ally.hp'),42);assert.equal(local.run('enemy.kit.smoke'),0);assert.equal(local.run('player.kit.ultPoints'),0);assert.equal(local.run('player.kit.nextSignatureAt'),0);assert.equal(local.run('player.hp'),local.run('hp'));assert.equal(local.run('player.ammo'),local.run('ammo'));assert.equal(local.run('match.credits'),local.run('money'));assert.equal(local.run(`activateAbility(player,'x')`),undefined);});
  check('X no deficient kits refuses7pt; distant/dead/wall allies receive nothing',()=>{setup();local.run(`player.kit.smoke=2;player.kit.updraft=1;player.kit.dash=1`);assert.equal(local.run(`activateAbility(player,'x')`),undefined);assert.equal(local.run('player.kit.ultPoints'),7);local.run(`makeBot({x:0,z:-10},1,'blue',{id:'ally',team:'blue',secondary:'classic',kit:new DuelistKit({character:'nope'})});var ally=bots.find(b=>b.id==='ally');ally.kit.smoke=0;ally.kit.updraft=0;`);local.wall({z:-5});assert.equal(local.run(`activateAbility(player,'x')`),undefined);local.clearWalls();local.run('ally.z=-25');assert.equal(local.run(`activateAbility(player,'x')`),undefined);local.run('ally.z=-10;ally.alive=false;ally.hp=0');assert.equal(local.run(`activateAbility(player,'x')`),undefined);assert.equal(local.run('player.kit.ultPoints'),7);});
  check('guest prediction changes only own spent stock; no push/fog clear/gyro benefit/ally refill without host event',()=>{for(const key of['c','q','e','x']){setup();if(key==='q')local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:-10,radius:3.6,expires:100}])`);if(key==='x')local.run('player.kit.smoke=0');assert.ok(local.run(`activateAbility(player,'${key}',{predict:true,aim:{yaw:0,pitch:-.04}})`));assert.equal(local.run('enemy.z'),-10);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('ordinarySkills.carGyro(player.id,elapsed)'),false);if(key==='q')assert.equal(local.run('smokes.length'),1);if(key==='x')assert.equal(local.run('player.kit.smoke'),0);}});
  check('20-event refusal rolls back resources and does not remove fog, move actors or refill allies',()=>{setup();local.run(`for(let i=0;i<20;i++)ordinarySkills.cast('car-bumper',{...ordinaryActorView(player),id:'p'+i},{x:0,y:0,z:-10,targetId:'enemy'},elapsed,match.round);var before=player.kit.snapshot();activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}})`);assert.deepEqual(copy(local.run('player.kit.snapshot()')),copy(local.run('before')));assert.equal(local.run('enemy.z'),-10);local.run(`player.kit.smoke=0;activateAbility(player,'x')`);assert.equal(local.run('player.kit.smoke'),0);assert.equal(local.run('player.kit.ultPoints'),7);assert.equal(local.run('ordinarySkills.events(elapsed).length'),20);});
  check('host deduplicates remote bumper actions and preserves displaced local pose once',()=>{setup();local.run(`player.armor=50;enemy.kit=new DuelistKit({character:'car'});enemy.kit.smoke=2;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);var p={type:'input',seq:1,connection:'car-test',round:match.round,input:{x:0,y:0,z:-10,yaw:Math.PI,pitch:0},actions:[{type:'ability',seq:1,round:match.round,key:'c',yaw:Math.PI,pitch:-.04}]};receiveNetPacket('guest',p);updateRemoteActor(enemy,.016);receiveNetPacket('guest',p);updateRemoteActor(enemy,.016)`);assert.equal(local.run('player.z'),0);advance(local,.5);assert.ok(local.run('player.z')>0);assert.equal(local.run('player.hp'),50);assert.equal(local.run(`ordinarySkills.events(elapsed).filter(e=>e.type==='car-bumper').length`),1);assert.equal(local.run('enemy.kit.smoke'),1);});
  check('independent JSON host/guest accepts motion only after host hit; duplicate cannot teleport or re-damage',()=>{const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.armor=50;makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'car'})});var caster=bots[0];caster.kit.smoke=2;onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p;}};var captured;match.phase='live';tickOnline(.1)`);guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','player')`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer)`);host.run(`activateAbility(caster,'c',{aim:{yaw:Math.PI,pitch:-.04}})`);advance(host,.4);host.run(`tickOnline(.1)`);const packet=copy(host.run('captured'));assert.ok(packet.actors.find(a=>a.id==='player').carMove);guest.sandbox.transfer=packet;const before=guest.run('player.z');guest.run(`receiveNetPacket('host',transfer)`);assert.ok(Math.abs(guest.run('player.z')-before)<=.6);assert.equal(guest.run('player.hp'),50);assert.equal(guest.run('player.carMotion.phase'),2);advance(guest,.1);assert.ok(guest.run('player.z')>before+2);const after=guest.run('player.z');guest.run(`receiveNetPacket('host',transfer)`);assert.equal(guest.run('player.z'),after);assert.equal(guest.run('player.hp'),50);
    guest.run(`netHasSnapshot=false`);guest.sandbox.transfer=copy(packet);guest.run(`transfer.seq++;receiveNetPacket('host',transfer)`);near(guest.run('player.z'),host.run('player.z'),'fresh uses current host pose');assert.equal(guest.run('player.carMotion.phase'),2);
  });
  check('side stepping avoids impact; charge cannot fire/jump/recast and cast uses one event',()=>{setup();local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}});enemy.x=3;var ammo=player.ammo;shoot();jump()`);assert.equal(local.run('player.ammo'),local.run('ammo'));assert.equal(local.run('player.vy'),0);assert.equal(local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}})`),undefined);advance(local,1.5);assert.equal(local.run('enemy.hp'),100);assert.ok(local.run('player.z')<-9.9);assert.equal(local.run('ordinarySkills.events(elapsed).length'),1);});
  check('source death stops charge; launch survives source death and preserves corpse travel; round clears',()=>{setup();local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}});player.alive=false`);advance(local,.6);assert.equal(local.run('enemy.hp'),100);setup();local.run(`enemy.hp=50;enemy.armor=50;activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}})`);advance(local,.4);assert.equal(local.run('enemy.alive'),false);local.run(`player.alive=false;match.phase='post';resetOrdinarySkills()`);advance(local,1.1);near(local.run('enemy.z'),-34,'corpse launch',.02);local.run(`match.round++;resetOrdinarySkills()`);assert.equal(local.run('enemy.carMotion'),null);});
  check('actual updatePlay loop advances body/camera then host remote victim, stale input cannot undo launch',()=>{setup();local.run(`enemy.remoteId='victim';enemy.armor=50;activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}});for(let i=0;i<180;i++)updatePlay(1/120)`);assert.equal(local.run('enemy.hp'),50);near(local.run('enemy.z'),-34,'actual loop24m',.03);assert.ok(local.run('player.z')<-8);near(local.run('camera.position.z'),local.run('player.z'),'camera follows ram',.03);});
  check('launch keeps100 raw armor damage, forced actions cancel planted interactions, no friendly fire',()=>{setup();local.run(`enemy.armor=50;enemy.planting=true;enemy.serviceReload={remaining:.7};activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}})`);advance(local,.4);near(local.run('enemy.hp+enemy.armor'),50,'combined damage');assert.equal(local.run('enemy.serviceReload'),null);assert.equal(local.run('enemy.planting'),false);});
  check('team change/exit stop forced motion and new front enemy intercepts body instead of targeting through it',()=>{setup();local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}});player.team='red'`);advance(local,.5);assert.equal(local.run('player.carMotion'),null);assert.equal(local.run('enemy.hp'),100);setup();local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}});makeBot({x:0,z:-5},1,'red',{id:'interceptor',team:'red',armor:0,secondary:'classic',kit:new DuelistKit({character:'nope'})});var interceptor=bots.find(b=>b.id==='interceptor')`);advance(local,.5);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('interceptor.hp'),0);local.run(`backMenu()`);assert.equal(local.run('player.carMotion'),null);assert.equal(local.run('interceptor.carMotion'),null);});
  check('strict six-field movement markers reject malformed/expired/too fast/nonfinite and long launch',()=>{setup();for(const value of[null,[],['skill-car-bumper-1',2,11,24,0,6,1],['skill-car-bumper-1',2,12,24,0,6],['skill-car-bumper-1',2,10,24,0,6],['skill-car-bumper-1',3,11,24,0,6],['skill-car-bumper-1',2,11,100,0,6],['skill-car-bumper-1',2,11,24,0,NaN],['wrong',2,11,24,0,6]]){local.sandbox.marker=value;assert.equal(local.run('carMotionMarker(marker,elapsed)'),null);}local.sandbox.marker=['skill-car-bumper-1',2,11,24,0,6];assert.ok(local.run('carMotionMarker(marker,elapsed)'));});
  check('death/round/menu resets personal gyro and effect resources; friendly bumper never selected',()=>{setup();local.run(`enemy.team=player.team`);assert.equal(local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}})`),undefined);local.run(`activateAbility(player,'e');player.alive=false;player.hp=0;updateOrdinarySkills()`);assert.equal(local.run('ordinarySkills.carGyro(player.id,elapsed)'),false);setup();local.run(`activateAbility(player,'e');ordinarySkills.update([],elapsed,match.round+1)`);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);});
  check('ram sound uses user cue only on confirmed contact, never cast or miss',()=>{setup();local.run(`soundEnabled=true;volume=.5;audioEvents.length=0;activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}})`);assert.equal(local.run("audioEvents.filter(e=>e.type==='vehicle-hit').length"),0);advance(local,.4);assert.equal(local.run("audioEvents.filter(e=>e.type==='vehicle-hit').length"),1);advance(local,1);assert.equal(local.run("audioEvents.filter(e=>e.type==='vehicle-hit').length"),1);setup();local.run(`soundEnabled=true;audioEvents.length=0;activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}});enemy.x=3`);advance(local,1.5);assert.equal(local.run("audioEvents.filter(e=>e.type==='vehicle-hit').length"),0);});
  console.log(`PASS: ${groups} actual-game car groups; AudioContext never created`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
