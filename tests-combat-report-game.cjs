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
 const prepare=()=>{local.reset();local.run(`makeBot({x:0,z:-10},0,'red',roster.find(r=>r.id==='red-0'));var enemy=bots[0];enemy.kit=new DuelistKit({character:'cap'});`)};
 const endBuy=`match.endRound('blue','elimination');handleMatchEvents();match.nextRound();handleMatchEvents();`;
 const report=h=>copy(h.run('roundDamage.report(player.id,roster,match.round)'));
 check('actual HP+armour loss, capped overkill and dead/post damage; next-buy opponent table',()=>{
  prepare();assert.equal(report(local),null);local.run(`enemy.armor=50;damageEntity(enemy,60,player,{firearm:true});damageEntity(enemy,1000,player,{skill:'cat'});damageEntity(enemy,20,player);${endBuy}`);
  const value=report(local);near(value.given,150,'armour + HP actual');near(value.received,0,'received');assert.equal(value.rows.length,1);assert.equal(value.rows[0].name,local.run("roster.find(r=>r.id==='red-0').name"));assert.equal(local.elements.get('combat-report').hidden,false);assert.equal(local.elements.get('combat-report-given').textContent,'150');assert.equal(local.elements.get('combat-report-body').children.length,1);
  local.run('damageEntity(bots[0],100,player);updateHUD()');near(report(local).given,150,'buy rejects damage');
 });
 check('firearms, abilities, friendly bus and neutral environment received once; normal team fire ignored',()=>{
  prepare();local.run(`makeBot({x:3,z:0},1,'blue',roster.find(r=>r.id==='blue-1'));var ally=bots[1];player.armor=50;damageEntity(player,40,enemy,{firearm:true});damageEntity(player,20,ally);damageEntity(player,20,ally,{vehicle:true});damageEntity(player,30,null,{vehicle:true});${endBuy}`);
  const value=report(local);near(value.received,90,'accepted loss');assert.equal(value.rows.length,3);assert.ok(value.rows.some(r=>r.friendly&&r.received===20));assert.ok(value.rows.some(r=>r.id===null&&r.received===30));
 });
 check('JAPAN return recursively records actual losses in both directions without doubling original hit',()=>{
  prepare();local.run(`player.kit=new DuelistKit({character:'japan'});activateAbility(player,'e');enemy.hp=1000;damageEntity(player,40,enemy,{firearm:true});${endBuy}`);
  const value=report(local);near(value.received,40,'original');near(value.given,260,'returned actual');
 });
 check('round lifecycle keeps previous round through respawn, hides LIVE, replaces with zero and resets new match/menu',()=>{
  prepare();local.run(`damageEntity(enemy,26,player);${endBuy}`);near(report(local).given,26,'previous');local.run('startRound();updateHUD()');assert.equal(local.elements.get('combat-report').hidden,true);local.run(endBuy);near(report(local).given,0,'zero next round');assert.equal(report(local).round,2);assert.equal(local.elements.get('combat-report-body').children[0].children[0].textContent,'このラウンドのダメージはありません');local.run('backMenu()');assert.equal(local.elements.get('combat-report').hidden,true);local.run('startGame()');assert.equal(report(local),null);
 });
 const host=harness(),guest=harness();
 function connect(){host.reset();guest.reset();host.run(`makeBot({x:0,z:-10},0,'red',roster.find(r=>r.id==='red-0'));var remote=bots[0];remote.remoteId='guest';remote.netWeapon='classic';remote.netAmmo=12;remote.netReserve=36;damageEntity(remote,26,player);damageEntity(player,40,remote);onlinePlaying=true;online={host:true,room:{code:'ABCDEFGH'},session:{memberId:'host'},send:(p,o)=>{if(o.team==='red')captured=p}};netParticipants.set('guest','red-0');var captured;${endBuy}tickOnline(.1)`);guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-0')`);guest.sandbox.transfer=copy(host.run('captured'));guest.run(`receiveNetPacket('host',transfer)`);}
 check('real host/guest independent JSON shows guest own outgoing/incoming and fresh same-round rejoin',()=>{
  connect();const value=report(guest);near(value.given,40,'guest outgoing');near(value.received,26,'guest incoming');assert.equal(guest.elements.get('combat-report-given').textContent,'40');assert.equal(guest.elements.get('combat-report-received').textContent,'26');guest.run('netHasSnapshot=false;netLastSnapshot=0;receiveNetPacket("host",transfer)');assert.deepEqual(report(guest),value);guest.run('damageEntity(bots[0],999,player)');assert.deepEqual(report(guest),value);
 });
 check('duplicate/older snapshots do not restore old report or round; live payload excludes report',()=>{
  const previous=report(guest);guest.run('receiveNetPacket("host",transfer)');assert.deepEqual(report(guest),previous);host.run('startRound();elapsed+=.2;tickOnline(.1)');const live=copy(host.run('captured'));assert.equal(live.damageReport,undefined);guest.sandbox.live=live;guest.run('receiveNetPacket("host",live);receiveNetPacket("host",transfer)');assert.equal(guest.run('match.phase'),'live');assert.equal(guest.elements.get('combat-report').hidden,true);
 });
 check('malformed report is rejected before guest HP/round mutations; legacy buy without report clears previous',()=>{
  connect();const valid=copy(host.run('captured')),before=report(guest);
  const badValues=[[2,[]],[0,[]],[1,[[0,5,10],[0,5,10]]],[1,[[0,5,NaN]]],[1,[[0,5,1.5]]],[1,[[0,5,0]]],[1,[[10,5,10]]],[1,[[0,10,10]]],[1,[[0,5,100000001]]],[1,[[0,5,1,2]]],[1,Array.from({length:101},()=>[0,5,1])],[1,[[0,1,10]]],{round:1,rows:[]}];
  for(const damageReport of badValues){guest.sandbox.bad={...copy(valid),damageReport,actors:valid.actors.map(a=>({...a,hp:777}))};guest.run('applyNetSnapshot(bad)');assert.equal(guest.run('player.hp'),100);assert.deepEqual(report(guest),before);}
  guest.sandbox.bad={...copy(valid),rules:{...valid.rules,phase:'live'},damageReport:valid.damageReport};guest.run('applyNetSnapshot(bad)');assert.equal(guest.run('match.phase'),'buy');const legacy=copy(valid);delete legacy.damageReport;guest.sandbox.legacy=legacy;guest.run('applyNetSnapshot(legacy);updateHUD()');assert.equal(report(guest),null);assert.equal(guest.elements.get('combat-report').hidden,true);
 });
 check('max10 seats team-filtered matrix remains bounded; finite fractional accumulation and snapshot isolation',()=>{
  const tracker=imported.createRoundDamageTracker(),people=Array.from({length:10},(_,i)=>({id:'seat'+i,team:i<5?'blue':'red',name:'<script>相手'+i}));tracker.begin(1,people);
  for(let to=0;to<10;to++)for(let from=-1;from<10;from++)tracker.record(1,people[to].id,people[from]?.id,1.25);
  tracker.record(1,'seat0','seat5',Infinity);tracker.record(1,'unknown','seat5',100);tracker.finish(1);const packet=tracker.snapshot('blue',2);assert.equal(packet[1].length,80);assert.ok(packet[1].every(([from,to])=>to<5||from>=0&&from<5));assert.ok(JSON.stringify(packet).length<1300);const other=imported.createRoundDamageTracker();assert.ok(other.restore(copy(packet),people,2,'blue'));near(other.report('seat0',people,2).received,14.3,'11 individually rounded decimal cells',.001);packet[1][0][2]=100;assert.notDeepEqual(other.snapshot('blue',2),packet);
 });
 console.log(`PASS: ${groups} actual-game previous-round damage / independent JSON / lifecycle / bounded report groups; no audio`);
 console.log(`TOTAL ${Math.round(performance.now()-started)}ms wall / ${Math.round(process.cpuUsage(cpuStarted).user/1000)}ms CPU`);
}main().catch(e=>{console.error(e);process.exitCode=1;});
