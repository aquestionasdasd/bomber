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
  function setup(id='pump',z=-4){local.reset();local.clearWalls();local.sandbox.gunId=id;local.sandbox.enemyZ=z;
    local.run(`inventory.primary=gunId;equip(gunId,true);makeBot({x:0,z:enemyZ},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.fire=999;enemy.reactionUntil=999;enemy.armor=50;player.pitch=-.025;aiming=true;`);
  }
  check('all five firearms consume exactly one cartridge, respect cooldown/reload, and hit real geometry',()=>{
    for(const id of ['pump','drum','scout','atlas','forge']){setup(id);const before=local.run('player.ammo');local.run('shoot()');assert.equal(local.run('player.ammo'),before-1,id);assert.ok(local.run('enemy.hp<100||enemy.armor<50'),id);local.run('shoot()');assert.equal(local.run('player.ammo'),before-1);local.run('elapsed+=2;reload();shoot()');assert.equal(local.run('player.ammo'),before-1);}
  });
  check('shotgun walls shield all pellets; no damage or kill credit through solid cover',()=>{setup();local.wall({z:-2});local.run('shoot()');assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('enemy.armor'),50);assert.equal(local.run('totalKills'),0);});
  check('a shell invokes optical wall-bounce at most once rather than twelve skill procs',()=>{setup();local.wall({z:-2});local.run(`var originalBounce=capBounceShot;var bounceCount=0;capBounceShot=(...args)=>{bounceCount++;return originalBounce(...args)};shoot();capBounceShot=originalBounce`);assert.equal(local.run('bounceCount'),1);});
  check('pump one-shell near kill pays one kill award, but at 30m cannot kill a full heavy target',()=>{setup();local.run('shoot()');assert.equal(local.run('enemy.alive'),false);assert.equal(local.run('totalKills'),1);assert.equal(local.run('match.roundKills'),1);setup('pump',-30);local.run('shoot()');assert.equal(local.run('enemy.alive'),true);});
  check('guest predicts ammo and visual pellets only; no local enemy health mutation',()=>{setup();local.run(`onlinePlaying=true;online={host:false,session:{memberId:'guest'},room:{code:'TEST'}};shoot()`);assert.equal(local.run('player.ammo'),4);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('enemy.armor'),50);assert.equal(local.run(`netActions.filter(a=>a.type==='fire').length`),1);});
  check('remote shell is host-authoritative, duplicate packet cannot fire twice, client damage ignored',()=>{setup();local.run(`enemy.remoteId='guest';enemy.netWeapon='pump';enemy.netAmmo=5;enemy.netReserve=20;enemy.netReload=0;enemy.lastNetShot=-10;enemy.shotSequence=0;player.armor=50;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);var packet={type:'input',seq:1,connection:'arsenal',round:match.round,input:{x:0,y:0,z:-4,yaw:Math.PI,pitch:-.025},actions:[{type:'fire',seq:1,at:10,round:match.round,yaw:Math.PI,pitch:-.025,ads:true,damage:9999,pellets:999}]};receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016)`);assert.equal(local.run('enemy.netAmmo'),4);assert.equal(local.run('netApplied.get("guest")'),1);assert.ok(local.run('player.hp<100'));});
  check('new gun buy/replace/refund and carried stock cannot mint credits',()=>{setup();local.run(`match.phase='buy';match.credits=5000;inventory.primary=null;roundPurchases={};buy('forge')`);assert.equal(local.run('match.credits'),1800);assert.equal(local.run('player.ammo'),60);local.run(`buy('atlas')`);assert.equal(local.run('match.credits'),300);assert.equal(local.run('player.ammo'),5);assert.equal(local.run(`buy('atlas')`),false);assert.equal(local.run('match.credits'),300);});
  check('remote heavy sniper lower-leg hit uses 120 damage, never the 150 body kill',()=>{setup('atlas');local.run(`enemy.remoteId='guest';enemy.netWeapon='atlas';enemy.netAmmo=5;enemy.netReserve=10;enemy.netReload=0;enemy.lastNetShot=-10;player.armor=50;applyRemoteAction(enemy,{type:'fire',yaw:Math.PI,pitch:Math.atan2(-1.2,4),ads:true},elapsed)`);assert.equal(local.run('player.alive'),true);assert.equal(local.run('player.hp'),30);assert.equal(local.run('player.armor'),0);});
  check('practice B opens real free arsenal and equips any new gun while live',()=>{setup();local.run(`exploring=true;match.credits=0;openShop()`);assert.equal(local.run('mode'),'shop');assert.equal(local.run(`buy('atlas')`),true);assert.equal(local.run('player.ammo'),5);assert.equal(local.run('match.credits'),0);});
  check('scope clears on release/reload and restored gun stays visible; remote burst recovery matches local',()=>{
    setup('atlas');local.run('aiming=true;updatePlay(.1)');assert.equal(local.elements.get('sniper-scope').hidden,false);assert.equal(local.run('gun.visible'),false);assert.ok(local.run('camera.fov<76'));
    local.run('aiming=false;updatePlay(.1)');assert.equal(local.elements.get('sniper-scope').hidden,true);assert.equal(local.run('gun.visible'),true);
    local.run(`enemy.remoteId='guest';enemy.netWeapon='forge';enemy.netAmmo=60;enemy.netReserve=120;enemy.netReload=0;enemy.lastNetShot=9;enemy.shotSequence=30;applyRemoteAction(enemy,{type:'fire',yaw:0,pitch:0,ads:true},elapsed)`);assert.equal(local.run('enemy.shotSequence'),1);assert.equal(local.run('enemy.netAmmo'),59);
  });
  check('world/drop/viewmodel models accept all new guns and expose finite muzzle geometry',()=>{for(const id of ['pump','drum','scout','atlas','forge']){setup(id);local.run(`dropItem(gunId,player)`);assert.equal(local.run('droppedWeapons.at(-1).weapon'),id);local.run(`enemy.model?.setWeapon?.(gunId)`);}});
  const {WEAPONS,applyArmorDamage}=await load('rules.js'),{shotPattern,weaponDamage,weaponDescription}=await load('weapon-ballistics.js');
  const balance=[];
  for(const [id,w]of Object.entries(WEAPONS).filter(([,w])=>w.slot!=='melee'))for(const distance of[5,15,30,60]){
    let shots=0,total=0;for(let seq=1;seq<=120;seq++){const pattern=shotPattern(id,{ads:true,sequence:seq});let damage=0;
      for(const p of pattern){if(Math.abs(p.x*distance)<.28&&Math.abs(p.y*distance)<.50)damage+=weaponDamage(id,'body',distance);}total+=damage;shots++;}
    const expected=total/shots;balance.push({id,distance,price:w.price,bodyDamage:Math.round(expected*10)/10,heavyBodyShots:expected?Math.ceil(150/expected):null,heavyIdealTTK:expected?+(Math.max(0,Math.ceil(150/expected)-1)*w.interval).toFixed(2):null});
  }
  check('price/power roles: pump close burst falls off; scout needs head; atlas slow expensive body kill; forge sustained reload cost',()=>{
    assert.equal(weaponDamage('atlas','body',60),150);assert.equal(applyArmorDamage(100,50,150).hp,0);assert.ok(weaponDamage('scout','body',60)<150);assert.ok(weaponDamage('scout','head',60)>=150);
    assert.ok(WEAPONS.atlas.price>WEAPONS.vandal.price&&WEAPONS.atlas.interval>WEAPONS.vandal.interval*10);assert.ok(WEAPONS.forge.mag>WEAPONS.vandal.mag*2&&WEAPONS.forge.reload>WEAPONS.vandal.reload);
    assert.ok(balance.find(x=>x.id==='pump'&&x.distance===5).bodyDamage>150);assert.ok(balance.find(x=>x.id==='pump'&&x.distance===30).bodyDamage<30);
    for(const id of['pump','drum','scout','atlas','forge']){assert.ok(weaponDescription(id).includes('予備'));assert.ok(shotPattern(id,{airborne:true}).length<=12);}
  });
  fs.writeFileSync(path.join(__dirname,'../cycle59-balance.json'),JSON.stringify({method:'120 deterministic chest-centred patterns per weapon/distance, stationary ADS; 100HP+50armor; misses counted. Initial balance, not human win-rate evidence.',balance},null,2));
  console.log(`PASS: ${groups} actual-game arsenal groups; silent mocks only`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
