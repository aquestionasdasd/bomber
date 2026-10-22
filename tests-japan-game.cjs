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
 function setup(){local.reset();local.clearWalls();local.run(`netApplied.clear();netInputs.clear();player.kit=new DuelistKit({character:'japan'});player.kit.smoke=2;player.kit.updraft=1;player.kit.ultPoints=7;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic',armor:50,kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.aiWeapon='classic';enemy.aiAmmo=12;enemy.aiReserve=36;enemy.aiReload=0;enemy.fire=999;enemy.reactionUntil=999;`);}
 const aim='{aim:{yaw:0,pitch:-.04}}';
 check('C/Q equip left-confirm/right-cancel contract, missed target never consumes',()=>{setup();for(const key of['c','q']){local.run(`useAbility('${key}')`);assert.equal(local.run('duckAim'),key);local.run(`useAbility('${key}')`);assert.equal(local.run('duckAim'),null);}assert.equal(local.run(`activateAbility(player,'q',{aim:{yaw:1,pitch:0}})`),undefined);assert.equal(local.run('player.kit.updraft'),1);});
 check('Q transfers only actual armor, cap50, no HP/ammo change; full/empty reject',()=>{setup();local.run('player.armor=20');assert.equal(local.run(`activateAbility(player,'q',${aim}).type`),'japan-levy');assert.equal(local.run('player.armor'),50);assert.equal(local.run('enemy.armor'),20);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('enemy.aiAmmo'),12);local.run('player.kit.updraft=1');assert.equal(local.run(`activateAbility(player,'q',${aim})`),undefined);assert.equal(local.run('player.kit.updraft'),1);local.run('player.armor=0;enemy.armor=0');assert.equal(local.run(`activateAbility(player,'q',${aim})`),undefined);});
 check('Q wall/smoke/blind/friendly/distance rejection preserves inventory',()=>{for(const kind of['wall','smoke','blind','friend','far']){setup();if(kind==='wall')local.wall({z:-5});if(kind==='smoke')local.run(`syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:-5,radius:3.6,expires:100}])`);if(kind==='blind')local.run(`ordinarySkills.cast('nope-flash',{...ordinaryActorView(enemy),x:0,z:0},{x:0,y:1.7,z:-2},elapsed,match.round);elapsed+=NOPE_SKILLS.flashFlight+.01;updateOrdinarySkills()`);if(kind==='friend')local.run('enemy.team=player.team');if(kind==='far')local.run('enemy.z=-45');assert.equal(local.run(`activateAbility(player,'q',${aim})`),undefined,kind);assert.equal(local.run('player.kit.updraft'),1);}});
 check('C actual floor placement and host crossing damage, arm delay/one hit and round cleanup',()=>{setup();assert.equal(local.run(`activateAbility(player,'c',{aim:{yaw:0,pitch:-.17}})?.type`),'japan-border');local.run(`var boundary=ordinarySkills.events(elapsed).find(e=>e.type==='japan-border');enemy.z=boundary.z-1;updateOrdinarySkills();elapsed+=1.01;updateOrdinarySkills();enemy.z=boundary.z+1;updateOrdinarySkills()`);assert.equal(local.run('enemy.hp'),50);assert.equal(local.run('enemy.armor'),0);assert.equal(local.run('player.kit.smoke'),1);local.run('ordinarySkills.update([],elapsed,match.round+1)');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);});
 check('E returns actual firearm health+armor loss and never chains, knife/zone excluded',()=>{setup();local.run(`activateAbility(player,'e');damageEntity(player,30,enemy,{firearm:true})`);near(local.run('player.hp'),70,'original');near(local.run('enemy.hp'),93.5,'reflected armor absorbed');near(local.run('enemy.armor'),37,'enemy armor');assert.equal(local.run('player.kit.nextSignatureAt'),30);setup();local.run(`activateAbility(player,'e');enemy.armor=0;damageEntity(player,30,enemy)`);assert.equal(local.run('enemy.hp'),100);setup();local.run(`activateAbility(player,'e');enemy.kit=new DuelistKit({character:'japan'});activateAbility(enemy,'e');enemy.armor=0;damageEntity(player,30,enemy,{firearm:true})`);near(local.run('player.hp'),70,'no recursive reflection');near(local.run('enemy.hp'),80.5,'single return');});
 check('real local firearm shot and host remote firearm both trigger return, knife does not',()=>{setup();local.run(`enemy.kit=new DuelistKit({character:'japan'});activateAbility(enemy,'e');enemy.armor=0;enemy.visual.update(0,{alive:true,character:'japan',weapon:'classic'});enemy.group.position.set(enemy.x,enemy.y,enemy.z);scene.updateMatrixWorld(true);player.pitch=Math.atan2(1.1-1.7,10);shoot()`);assert.ok(local.run('player.hp')<100);assert.ok(local.run('enemy.hp')<100);setup();local.run(`activateAbility(player,'e');enemy.armor=0;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);applyRemoteAction(enemy,{type:'fire',seq:1,yaw:Math.PI,pitch:0})`);assert.ok(local.run('enemy.hp')<100);assert.equal(local.run('enemy.netAmmo'),11);});
 check('X revives all dead allies only, safe spawn/classic/empty kit, no bomber/stats changes',()=>{setup();local.run(`for(let i=1;i<=4;i++){var rec=roster.find(r=>r.id==='blue-'+i)||{id:'blue-'+i,team:'blue',secondary:'ghost',primary:'vandal',kit:new DuelistKit({character:i===1?'japan':'mend'})};makeBot({x:20+i,z:20},i,'blue',rec);var ally=bots.at(-1);ally.alive=false;ally.hp=0;ally.armor=50;ally.kit.smoke=2;ally.kit.updraft=1;ally.kit.ultPoints=4;ally.group.visible=false;}var oldSpike=JSON.stringify(match.spike),deaths=roster.map(r=>r.d);`);assert.ok(local.run(`activateAbility(player,'x')`));assert.equal(local.run('bots.filter(b=>b.team===player.team&&b.alive).length'),4);assert.equal(local.run('player.kit.ultPoints'),0);assert.equal(local.run('JSON.stringify(match.spike)'),local.run('oldSpike'));assert.deepEqual(copy(local.run('roster.map(r=>r.d)')),copy(local.run('deaths')));for(const expr of['b.hp===100','b.armor===0','b.record.primary===null','b.record.secondary==="classic"','b.kit.smoke===0','b.kit.updraft===0','b.kit.dash===0','b.kit.ultPoints===4','b.group.visible','canStand(b.x,b.z,.34,b.y)'])assert.ok(local.run(`bots.filter(b=>b.team===player.team).every(b=>${expr})`),expr);assert.equal(local.run('enemy.hp'),100);});
 check('X rejects no dead ally/post phase/7pt shortage/cap without mutation, guest predicts stock only',()=>{setup();assert.equal(local.run(`activateAbility(player,'x')`),undefined);assert.equal(local.run('player.kit.ultPoints'),7);local.run(`makeBot({x:2,z:3},1,'blue',{id:'blue-1',team:'blue',kit:new DuelistKit({character:'duck'})});var ally=bots.at(-1);ally.alive=false;ally.hp=0;player.kit.ultPoints=6`);assert.equal(local.run(`activateAbility(player,'x')`),undefined);local.run(`player.kit.ultPoints=7;match.phase='post'`);assert.equal(local.run(`activateAbility(player,'x')`),undefined);local.run(`match.phase='live';for(let i=0;i<20;i++)ordinarySkills.cast('japan-return',{...ordinaryActorView(player),id:'p'+i},ordinaryActorView(player),elapsed,match.round)`);assert.equal(local.run(`activateAbility(player,'x')`),undefined);assert.equal(local.run('ally.alive'),false);assert.equal(local.run('player.kit.ultPoints'),7);local.run('ordinarySkills.reset()');assert.ok(local.run(`activateAbility(player,'x',{predict:true})`));assert.equal(local.run('ally.alive'),false);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);});
 check('X resurrection strips stale personal effects and stale remote actions before actor becomes live',()=>{setup();local.run(`enemy.team='blue';enemy.kit=new DuelistKit({character:'japan'});enemy.kit.ultPoints=3;activateAbility(enemy,'e');enemy.alive=false;enemy.hp=0;enemy.remoteId='guest';netInputs.set('guest',{seq:10,round:match.round,connection:'revive',received:elapsed,input:{x:70,y:0,z:70},actions:[{seq:10,type:'fire',round:match.round}]});activateAbility(player,'x')`);assert.equal(local.run('ordinarySkills.japanReturn(enemy.id,elapsed)'),0);assert.equal(local.run('netInputs.get("guest").actions.length'),0);assert.equal(local.run('netApplied.get("guest")'),10);assert.equal(local.run('enemy.alive'),true);const x=local.run('enemy.x');local.run('updateRemoteActor(enemy,.1)');near(local.run('enemy.x'),x,'stale movement ignored');});
 check('independent host/guest JSON revival snaps once, clears old prediction and restores visible model',()=>{const host=harness(),guest=harness();host.reset();guest.reset();host.run(`player.kit=new DuelistKit({character:'japan'});player.kit.ultPoints=7;match.phase='live';makeBot({x:20,z:20},1,'blue',{id:'blue-1',team:'blue',secondary:'classic',kit:new DuelistKit({character:'duck'})});var ally=bots[0];ally.remoteId='guest';ally.hp=0;ally.alive=false;onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p}};netParticipants.set('guest','blue-1');var captured;tickOnline(.1)`);guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','blue-1')`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer)`);assert.equal(guest.run('player.alive'),false);guest.run(`netPositionHistory.set(12,{x:70,z:70,correctionX:0,correctionZ:0});player.x=70;player.z=70;`);host.run(`activateAbility(player,'x');tickOnline(.1)`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer);receiveNetPacket('host',transfer)`);assert.equal(guest.run('player.alive'),true);near(guest.run('player.x'),host.run('ally.x'),'spawn x');near(guest.run('player.z'),host.run('ally.z'),'spawn z');assert.equal(guest.run('netPositionHistory.size'),0);assert.equal(guest.run('player.ammo'),12);assert.equal(guest.run('gun.visible'),true);});
 check('host remote Q packet deduplicates armor transfer and cost; E HUD actual host status',()=>{setup();local.run(`enemy.kit=new DuelistKit({character:'japan'});enemy.kit.updraft=1;enemy.armor=0;player.armor=50;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);var packet={type:'input',seq:1,connection:'japan-target',round:match.round,input:{x:0,y:0,z:-10,yaw:Math.PI,pitch:-.04},actions:[{type:'ability',seq:1,round:match.round,key:'q',yaw:Math.PI,pitch:-.04}]};receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016)`);assert.equal(local.run('enemy.armor'),50);assert.equal(local.run('player.armor'),0);assert.equal(local.run('enemy.kit.updraft'),0);setup();local.run(`activateAbility(player,'e');updateHUD()`);assert.match(local.elements.get('status-effects').textContent,/弾丸返送/);});
 check('BOT uses X for dead ally without invented enemy perception; hidden enemy does not cause Q',()=>{setup();local.run(`enemy.kit=new DuelistKit({character:'japan'});enemy.kit.ultPoints=7;makeBot({x:9,z:-20},1,'red',{id:'red-1',team:'red',kit:new DuelistKit({character:'mend'})});var dead=bots.at(-1);dead.alive=false;dead.hp=0;enemy.nextSkillAt=0;enemy.yaw=Math.PI;enemy.group.rotation.y=0;updateBots(.01)`);assert.equal(local.run('dead.alive'),true);setup();local.wall({z:-5});local.run(`enemy.kit=new DuelistKit({character:'japan'});enemy.kit.updraft=1;enemy.armor=0;player.armor=50;enemy.nextSkillAt=0;enemy.yaw=Math.PI;enemy.group.rotation.y=0;updateBots(.01)`);assert.equal(local.run('player.armor'),50);assert.equal(local.run('enemy.kit.updraft'),1);});
 check('X real station map chooses four distinct supported safe start positions for both teams',()=>{const real=harness({realMap:true});for(const team of['blue','red']){real.reset();real.sandbox.testTeam=team;real.run(`player.team=testTeam;player.kit=new DuelistKit({character:'japan'});player.kit.ultPoints=7;match.phase='live';for(let i=0;i<4;i++){makeBot({x:20+i,z:20},i,testTeam,{id:testTeam+'-'+i,team:testTeam,secondary:'classic',kit:new DuelistKit({character:'mend'})});bots.at(-1).hp=0;bots.at(-1).alive=false;}activateAbility(player,'x')`);assert.equal(real.run('bots.filter(b=>b.alive).length'),4);assert.equal(real.run('bots.every(b=>canStand(b.x,b.z,.34,b.y))'),true);assert.equal(real.run('bots.every((b,i)=>bots.every((c,j)=>i===j||Math.hypot(c.x-b.x,c.z-b.z)>=.8))'),true);}});
 console.log(`PASS: ${groups} actual-game japan groups; audio/rendering inert`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
