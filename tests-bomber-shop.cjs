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



  const host=harness(),guest=harness();
  function setup(credits=800){
    for(const h of [host,guest]){h.reset();h.run("match.phase='buy';match.phaseTime=30;mode='shop';netActions=[];netApplied.clear();netInputs.clear();netParticipants.clear();netSequence=0;netLastSnapshot=0;netActionSequence=0;netHasSnapshot=false;netRound=0;");h.audioCalls.length=0;}
    host.sandbox.credits=credits;
    host.run("var record={id:'red-0',team:'red',secondary:'classic',primary:null,credits,kit:new DuelistKit({character:'nope'})};record.kit.smoke=0;record.kit.updraft=0;makeBot({x:0,z:-23},0,'red',record);var remote=bots[0];remote.id='red-0';remote.remoteId='guest';remote.netWeapon='classic';remote.netAmmo=12;remote.netReserve=36;remote.armor=0;roster=[record];onlinePlaying=true;online={host:true,session:{memberId:'host',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest','red-0');netClock=0;");
    guest.run("onlinePlaying=true;online={host:false,connectionId:'guest-1',room:{code:'TESTROOM'},session:{memberId:'guest',hostId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest','red-0');netClock=0;");
    snapshot();host.audioCalls.length=0;guest.audioCalls.length=0;
  }
  function snapshot(edit){host.run('netClock=0;tickOnline(.1)');const data=copy(host.run('captured'));if(edit)edit(data);guest.sandbox.transfer=data;guest.run("receiveNetPacket('host',transfer)");return data;}
  function submit(id,{deliver=true}={}){
    guest.sandbox.buyId=id;guest.run('buy(buyId);netClock=0;tickOnline(.1)');host.sandbox.transfer=copy(guest.run('captured'));
    host.run("receiveNetPacket('guest',transfer);updateRemoteActor(remote,.05)");return deliver?snapshot():null;
  }
  const buys=h=>h.audioCalls.filter(c=>c.type==='buy').length;

  const local=harness();
  const localSetup=()=>{local.reset();local.run("match.phase='buy';match.phaseTime=30;mode='shop';match.credits=800;player.kit.smoke=0;player.kit.updraft=0");local.audioCalls.length=0;};
  check('repeat left click refunds exactly one same-round skill; +1 keeps multi-charge purchasing',()=>{
    localSetup();assert.equal(local.run("clickSkillPurchase('c')"),true);assert.equal(local.run('player.kit.smoke'),1);assert.equal(local.run('match.credits'),700);
    assert.equal(local.run("buy('c')"),true);assert.equal(local.run('player.kit.smoke'),2);assert.equal(local.run('match.credits'),600);
    assert.equal(local.run("clickSkillPurchase('c')"),true);assert.equal(local.run('player.kit.smoke'),1);assert.equal(local.run('match.credits'),700);
    assert.equal(local.run("clickSkillPurchase('c')"),true);assert.equal(local.run('player.kit.smoke'),0);assert.equal(local.run('match.credits'),800);
    for(let i=0;i<20;i++){local.run("clickSkillPurchase('q');clickSkillPurchase('q')");}assert.equal(local.run('match.credits'),800);
  });
  check('carryover/current-round ledger, death/live/pause and round/character changes cannot mint money',()=>{
    localSetup();local.run('player.kit.smoke=1');assert.equal(local.run("clickSkillPurchase('c')"),false);assert.equal(local.run('match.credits'),800);
    local.run("buy('c');clickSkillPurchase('c')");assert.equal(local.run('player.kit.smoke'),1);assert.equal(local.run('match.credits'),800);assert.equal(local.run("clickSkillPurchase('c')"),false);
    for(const condition of ["match.phase='live'","player.alive=false","netHostPaused=true","match.round++","player.kit.character='cat'"]){localSetup();local.run("buy('q');"+condition);assert.equal(local.run("clickSkillPurchase('q')"),false,condition);assert.equal(local.run('match.credits'),700);}
  });
  check('guest sell waits for host authority, exact receipt, duplicate actions/snapshots cannot refund twice',()=>{
    setup();submit('c');assert.equal(guest.run('player.kit.smoke'),1);guest.run("clickSkillPurchase('c');clickSkillPurchase('c')");assert.equal(guest.run('netActions.length'),1);assert.equal(guest.run('player.kit.smoke'),1);assert.equal(guest.run('match.credits'),700);
    guest.run('netClock=0;tickOnline(.1)');host.sandbox.transfer=copy(guest.run('captured'));host.run("receiveNetPacket('guest',transfer);updateRemoteActor(remote,.05);receiveNetPacket('guest',transfer);updateRemoteActor(remote,.05)");const p=snapshot();assert.equal(host.run('record.credits'),800);assert.equal(guest.run('match.credits'),800);assert.equal(guest.run('player.kit.smoke'),0);assert.match(guest.elements.get('shop-status').textContent,/売却しました/);
    const n=buys(guest);guest.sandbox.transfer=p;guest.run("receiveNetPacket('host',transfer)");snapshot();assert.equal(buys(guest),n);assert.equal(host.run('record.credits'),800);
  });
  check('forged remote sell without current purchase, wrong skill/live/dead never refunds or succeeds',()=>{
    for(const mode of ['carry','empty','wrong','live','dead']){setup();if(mode==='carry')host.run('remote.kit.smoke=1');if(['wrong','live','dead'].includes(mode))submit('q');if(mode==='live')host.run("match.phase='live'");if(mode==='dead')host.run('remote.alive=false');const before=host.run('record.credits');const cue=buys(guest);submit('sell-c');assert.equal(host.run('record.credits'),before,mode);assert.equal(buys(guest),cue,mode);}
  });
  check('all15 skill cards retain sell access at full stock/zero funds; +1 respects stock/funds/death',()=>{
    const h=local;localSetup();for(const character of Object.keys(imported.CHARACTER_DEFS)){h.sandbox.character=character;h.run("player.kit.character=character;player.kit.smoke=getCharacterSkill(character,'c').max;player.kit.updraft=getCharacterSkill(character,'q').max;match.credits=0;updateShop()");for(const k of ['c','q']){assert.equal(h.elements.get('shop-skill-'+k).disabled,false,character+k);assert.equal(h.elements.get('shop-skill-'+k+'-add').disabled,true);assert.match(h.elements.get('shop-skill-'+k+'-count').textContent,/左クリック.*売却/);}}
    h.run('player.alive=false;updateShop()');assert.equal(h.elements.get('shop-skill-c').disabled,true);
  });
  check('plant cue reaches distant/occluded players centrally; tick louder spatial range and mute gates remain',()=>{
    localSetup();local.wall({z:-2});local.run("soundEnabled=true;volume=.4;sound('plant',{entity:{x:0,z:-200}});sound('spike',{entity:{x:0,z:-100}})");const a=local.audioCalls.at(-2),b=local.audioCalls.at(-1);assert.equal(a.type,'plant');assert.equal(a.options.distance,0);assert.equal(a.options.occluded,false);assert.equal(a.options.pan,0);assert.equal(a.options.volume,.4);assert.equal(b.options.distance,35);assert.equal(b.options.occluded,false);
    const n=local.audioCalls.length;local.run("soundEnabled=false;sound('plant');sound('spike');soundEnabled=true;volume=0;sound('plant');sound('spike')");assert.equal(local.audioCalls.length,n);
  });
  check('persistent planted site/countdown works for attack/defend; defuse/post/next round clear it',()=>{
    localSetup();local.run("match.phase='live';Object.assign(match.spike,{status:'planted',site:'B',timer:44.2});updateHUD()");assert.equal(local.elements.get('bomber-alert').hidden,false);assert.match(local.elements.get('bomber-alert-title').textContent,/Bサイト ボンバー設置/);assert.equal(local.elements.get('bomber-alert-time').textContent,'起爆まで 45秒');
    local.run("player.team='red';match.spike.timer=9.2;elapsed+=5;updateHUD()");assert.equal(local.elements.get('bomber-alert-time').textContent,'起爆まで 10秒');
    local.run("objectivePractice={kind:'defuse'};updateHUD()");assert.equal(local.elements.get('bomber-alert-time').textContent,'練習中 · 起爆なし');local.run('objectivePractice=null');
    for(const code of ["match.spike.status='defused'","match.spike.status='planted';match.phase='post'","match.phase='buy';match.round++"]){local.run(code+';updateHUD()');assert.equal(local.elements.get('bomber-alert').hidden,true,code);}
  });
  check('guest sees authoritative plant and persistent HUD once; fresh/repeated snapshot does not replay audio',()=>{
    setup();host.run("match.phase='live';Object.assign(match.spike,{status:'planted',site:'A',timer:38.1,x:0,z:70})");snapshot();guest.run('updateHUD()');assert.equal(guest.elements.get('bomber-alert').hidden,false);assert.match(guest.elements.get('bomber-alert-title').textContent,/Aサイト/);assert.equal(guest.audioCalls.filter(c=>c.type==='plant').length,1);snapshot();assert.equal(guest.audioCalls.filter(c=>c.type==='plant').length,1);
    guest.run('netHasSnapshot=false');snapshot();assert.equal(guest.audioCalls.filter(c=>c.type==='plant').length,1);host.run("match.spike.status='defused';match.phase='post'");snapshot();guest.run('updateHUD()');assert.equal(guest.elements.get('bomber-alert').hidden,true);
  });
  console.log(JSON.stringify({groups,wallMs:Math.round(performance.now()-started),cpuMs:Math.round((process.cpuUsage(cpuStarted).user+process.cpuUsage(cpuStarted).system)/1000)}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
