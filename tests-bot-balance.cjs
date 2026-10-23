const Module=require('node:module');
const path=require('node:path');
const {body,fixturePrefix}=require('./scripts/bot-balance.cjs');
const marker=body.indexOf(' for(const mapId of config.maps)');
if(marker<0)throw Error('Measured runner boundary changed');
// Exercise the actual shared measurement step and instrumentation in a flat
// controlled scene. Full rounds separately retain the real selected maps.
const prefix=body.slice(0,marker).replace('harness({realMap:true})','harness()');
const suite=String.raw`
 function setup(){h.reset();h.clearWalls();h.run([
   "match.phase='live';player.kit=new DuelistKit({character:'car'});player.kit.smoke=2;",
   "makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});",
   "var enemy=bots[0];enemy.remoteId='passive';enemy.hp=100;enemy.armor=0;enemy.fire=999;enemy.reactionUntil=999;",
   "bench={focalId:'player',disabled:'',actors:{player:{casts:{},damage:0,kills:0,ramHits:0,ramDamage:0,ramTravel:0,launchedTravel:0},enemy:{casts:{},damage:0,kills:0,ramHits:0,ramDamage:0,ramTravel:0,launchedTravel:0}},plants:0,defuses:0,carMotionFrames:0};observeMeasuredMatch();"
 ].join('\n'));}
 const tick=(n,dt=1/120)=>{h.sandbox.n=n;h.sandbox.dt=dt;h.run('for(let i=0;i<n;i++)advanceMeasuredRound(dt)');};
 const cast=()=>h.run("activateAbility(player,'c',{aim:{yaw:0,pitch:-.04}})");
 check('measurement step invokes actual frame clock/kit/forced movement once, not a partial simulation',()=>{
   setup();h.run('var tickCount=0;const realTick=player.kit.tick.bind(player.kit);player.kit.tick=function(now){tickCount++;return realTick(now)}');
   tick(12);near(h.run('elapsed'),10.1,'one clock');assert.equal(h.run('tickCount'),12);assert.equal(h.run('bench.carMotionFrames'),12);
 });
 check('measured C includes source travel, real contact75 and continuous24m victim arc',()=>{
   setup();cast();tick(24);assert.equal(h.run('enemy.hp'),100);assert.ok(h.run('player.z')<-4);
   tick(24);assert.equal(h.run('enemy.hp'),25);assert.ok(h.run('enemy.y')>0);
   tick(132);near(h.run('enemy.z'),-34,'actual24m',.03);
   assert.equal(h.run('bench.actors.player.ramHits'),1);assert.equal(h.run('bench.actors.player.ramDamage'),75);assert.equal(h.run('bench.actors.player.damage'),75);
   assert.ok(h.run('bench.actors.player.ramTravel')>8);near(h.run('bench.actors.enemy.launchedTravel'),24,'measured launch24m',.03);
 });
 check('focal C ablation preserves stock and reports no cast/hit/forced travel',()=>{
   setup();h.run("bench.disabled='c'");cast();tick(120);
   assert.equal(h.run('player.kit.smoke'),2);assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('bench.actors.player.ramHits'),0);assert.equal(h.run('bench.actors.player.ramTravel'),0);
 });
 check('wall stops real frame charge and cannot be counted as damage or successful hit',()=>{
   setup();cast();h.wall({z:-4,width:20});tick(180);
   assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('bench.actors.player.ramHits'),0);assert.ok(h.run('player.z')>-4);
 });
 check('damage accounting records armor plus HP once and final contact kill attribution',()=>{
   setup();h.run('enemy.armor=50;enemy.hp=30');cast();tick(180);
   assert.equal(h.run('enemy.alive'),true);assert.equal(h.run('bench.actors.player.kills'),0);assert.equal(h.run('bench.actors.player.ramHits'),1);near(h.run('bench.actors.player.damage'),75,'effective armor+hp damage');
   setup();h.run('enemy.hp=60');cast();tick(180);assert.equal(h.run('enemy.alive'),false);assert.equal(h.run('bench.actors.player.kills'),1);near(h.run('bench.actors.player.damage'),60,'overkill excluded');
 });
 check('frame driver advances and resolves objective clock rather than leaving a stuck live round',()=>{
   setup();h.run('match.roundTime=.05');tick(1,.1);assert.equal(h.run('match.phase'),'post');assert.equal(h.run('match.lastRound.reason'),'timeout');
 });
 check('actual frame event drain counts plant and defuse once despite the game consuming notifications',()=>{
   setup();h.run("match.spike.status='carried';match.spike.carrier='player';match.interactPlant(4,{actorId:'player',team:match.attackerTeam,site:'A',x:0,z:0,stationary:true})");tick(1);
   assert.equal(h.run('bench.plants'),1);
   h.run("match.interactDefuse(7,{actorId:'enemy',team:match.defenderTeam,near:true,stationary:true})");tick(1);assert.equal(h.run('bench.defuses'),1);
   h.run('match.drainEvents();match.drainEvents()');assert.equal(h.run('bench.plants'),1);assert.equal(h.run('bench.defuses'),1);
 });
 console.log('PASS: '+groups+' measurement pipeline/clock/contact/ablation/collision/accounting/objective groups; audio inert');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const runner=new Module(path.join(__dirname,'bot-balance-test-harness.cjs'),module);
runner.filename=path.join(__dirname,'bot-balance-test-harness.cjs');runner.paths=Module._nodeModulePaths(__dirname);
runner._compile(fixturePrefix+prefix+suite,runner.filename);
