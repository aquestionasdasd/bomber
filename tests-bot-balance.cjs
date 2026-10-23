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
   assert.equal(h.run('bench.plants'),1);assert.equal(h.run('bench.actors.player.plants'),1);
   h.run("match.interactDefuse(7,{actorId:'enemy',team:match.defenderTeam,near:true,stationary:true})");tick(1);assert.equal(h.run('bench.defuses'),1);assert.equal(h.run('bench.actors.enemy.defuses'),1);
   h.run('match.drainEvents();match.drainEvents()');assert.equal(h.run('bench.plants'),1);assert.equal(h.run('bench.defuses'),1);
 });
 check('personal tool work counts actual accepted progress, not rejected work or duplicate events',()=>{
   setup();h.run("player.kit=new DuelistKit({character:'nobi'});activateAbility(player,'e');match.spike.status='carried';match.spike.carrier='player';match.interactPlant(1.5,{actorId:'player',team:match.attackerTeam,site:'A',x:0,z:0,stationary:true})");
   near(h.run('bench.actors.player.workProgress'),1.5,'accepted work');near(h.run('bench.actors.player.toolWorkProgress'),1.5,'boosted progress');near(h.run('bench.actors.player.toolSavedSeconds'),.5,'normal-work equivalent');
   h.run("match.interactPlant(3,{actorId:'enemy',team:match.defenderTeam,site:'A',x:0,z:0,stationary:true})");assert.equal(h.run('bench.actors.enemy.workProgress||0'),0);
   h.run("match.interactPlant(10,{actorId:'player',team:match.attackerTeam,site:'A',x:0,z:0,stationary:true});match.interactPlant(10,{actorId:'player',team:match.attackerTeam,site:'A',x:0,z:0,stationary:true});match.drainEvents();match.drainEvents()");
   near(h.run('bench.actors.player.workProgress'),4,'clamped objective progress');near(h.run('bench.actors.player.toolSavedSeconds'),4/3,'no overcount');assert.equal(h.run('bench.actors.player.plants'),1);
 });
 check('clock cast context records only actual accepted CAT X and respects focal ablation',()=>{
   setup();h.run("player.kit=new DuelistKit({character:'cat'});player.kit.ultPoints=7;match.spike.status='dropped';match.roundTime=4");
   assert.ok(h.run("activateAbility(player,'x')"));
   assert.equal(h.run('bench.actors.player.casts.x'),1);
   const context=JSON.parse(h.run('JSON.stringify(bench.actors.player.clockCasts)'));
   assert.equal(context.length,1);assert.equal(context[0].at,h.run('elapsed'));
   assert.equal(context[0].team,h.run('player.team'));assert.equal(context[0].attackerTeam,h.run('match.attackerTeam'));
   assert.equal(context[0].status,'dropped');assert.equal(context[0].roundTime,4);assert.equal(context[0].bomberTime,h.run('match.spike.timer'));
   h.run("activateAbility(player,'x')");assert.equal(h.run('bench.actors.player.clockCasts.length'),1);
   setup();h.run("player.kit=new DuelistKit({character:'cat'});player.kit.ultPoints=7;bench.disabled='x'");
   assert.equal(h.run("activateAbility(player,'x')"),undefined);
   assert.equal(h.run('bench.actors.player.clockCasts'),undefined);assert.equal(h.run('player.kit.ultPoints'),7);
 });
 check('EMBER C counts actual armor and HP loss once, separating ultimate and requested overkill',()=>{
   setup();h.run("player.kit=new DuelistKit({character:'ember'});player.kit.smoke=2;enemy.z=-16;enemy.armor=50;enemy.hp=30;bench.actors.player.character='ember';activateAbility(player,'c',{zonePoint:{x:0,z:-16},aim:{yaw:0,pitch:0}})");
   tick(84);near(h.run('bench.actors.player.solderDamage'),75,'real C armor+HP loss');assert.equal(h.run('bench.actors.player.solderHits'),1);assert.equal(h.run('bench.actors.player.solderKills||0'),0);
   h.run("damageEntity(enemy,1000,player,{skill:'ember'})");near(h.run('bench.actors.player.solderDamage'),75,'non-ordinary damage excluded');assert.equal(h.run('bench.actors.player.solderHits'),1);
   setup();h.run("player.kit=new DuelistKit({character:'ember'});player.kit.smoke=2;enemy.z=-16;enemy.hp=10;bench.actors.player.character='ember';activateAbility(player,'c',{zonePoint:{x:0,z:-16},aim:{yaw:0,pitch:0}})");tick(84);near(h.run('bench.actors.player.solderDamage'),10,'overkill excluded');assert.equal(h.run('bench.actors.player.solderKills'),1);
   setup();h.run("player.kit=new DuelistKit({character:'ember'});bench.disabled='c';activateAbility(player,'c',{zonePoint:{x:0,z:-16},aim:{yaw:0,pitch:0}})");tick(84);assert.equal(h.run('bench.actors.player.solderHits'),undefined);
 });
 console.log('PASS: '+groups+' measurement pipeline/clock/contact/ablation/collision/accounting/objective groups; audio inert');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const runner=new Module(path.join(__dirname,'bot-balance-test-harness.cjs'),module);
runner.filename=path.join(__dirname,'bot-balance-test-harness.cjs');runner.paths=Module._nodeModulePaths(__dirname);
runner._compile(fixturePrefix+prefix+suite,runner.filename);
