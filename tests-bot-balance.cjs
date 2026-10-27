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
 check('measured C includes source travel, real contact100 and continuous24m victim arc',()=>{
   setup();h.run('enemy.armor=50');cast();tick(24);assert.equal(h.run('enemy.hp'),100);assert.ok(h.run('player.z')<-4);
   tick(24);assert.equal(h.run('enemy.hp'),50);assert.ok(h.run('enemy.y')>0);
   tick(132);near(h.run('enemy.z'),-34,'actual24m',.03);
   assert.equal(h.run('bench.actors.player.ramHits'),1);assert.equal(h.run('bench.actors.player.ramDamage'),100);assert.equal(h.run('bench.actors.player.damage'),100);
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
   setup();h.run('enemy.armor=50;enemy.hp=60');cast();tick(180);
   assert.equal(h.run('enemy.alive'),true);assert.equal(h.run('bench.actors.player.kills'),0);assert.equal(h.run('bench.actors.player.ramHits'),1);near(h.run('bench.actors.player.damage'),100,'effective armor+hp damage');
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
   setup();h.run("player.kit=new DuelistKit({character:'nobi'});activateAbility(player,'e',{zonePoint:{x:0,y:0,z:0}});elapsed+=.7;updateOrdinarySkills();match.spike.status='carried';match.spike.carrier='player';match.interactPlant(1.5,{actorId:'player',team:match.attackerTeam,site:'A',x:0,z:0,stationary:true})");
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
   setup();h.run("player.kit=new DuelistKit({character:'ember'});player.kit.smoke=2;enemy.z=-16;enemy.armor=50;enemy.hp=60;bench.actors.player.character='ember';activateAbility(player,'c',{zonePoint:{x:0,z:-16},aim:{yaw:0,pitch:0}})");
   tick(84);near(h.run('bench.actors.player.solderDamage'),75,'real C armor+HP loss');assert.equal(h.run('bench.actors.player.solderHits'),1);assert.equal(h.run('bench.actors.player.solderKills||0'),0);
   h.run("damageEntity(enemy,1000,player,{skill:'ember'})");near(h.run('bench.actors.player.solderDamage'),75,'non-ordinary damage excluded');assert.equal(h.run('bench.actors.player.solderHits'),1);
   setup();h.run("player.kit=new DuelistKit({character:'ember'});player.kit.smoke=2;enemy.z=-16;enemy.hp=10;bench.actors.player.character='ember';activateAbility(player,'c',{zonePoint:{x:0,z:-16},aim:{yaw:0,pitch:0}})");tick(84);near(h.run('bench.actors.player.solderDamage'),10,'overkill excluded');assert.equal(h.run('bench.actors.player.solderKills'),1);
   setup();h.run("player.kit=new DuelistKit({character:'ember'});bench.disabled='c';activateAbility(player,'c',{zonePoint:{x:0,z:-16},aim:{yaw:0,pitch:0}})");tick(84);assert.equal(h.run('bench.actors.player.solderHits'),undefined);
 });
 check('NOPE C records actual loss once, excluding overkill non-bottle damage and ablation',()=>{
   setup();h.run("player.kit=new DuelistKit({character:'nope'});player.kit.smoke=2;bench.actors.player.character='nope';enemy.z=-24;enemy.hp=100;enemy.armor=50;activateAbility(player,'c',{zonePoint:{x:0,z:-24},aim:{yaw:0,pitch:0}})");tick(144);
   near(h.run('bench.actors.player.bottleDamage'),90,'actual HP+armor');assert.equal(h.run('bench.actors.player.bottleHits'),1);tick(36);assert.equal(h.run('bench.actors.player.bottleHits'),1);
   h.run("damageEntity(enemy,1000,player,{skill:'nope'})");near(h.run('bench.actors.player.bottleDamage'),90,'outside ordinary frame excluded');
   setup();h.run("player.kit=new DuelistKit({character:'nope'});player.kit.smoke=2;bench.actors.player.character='nope';enemy.z=-24;enemy.hp=10;activateAbility(player,'c',{zonePoint:{x:0,z:-24},aim:{yaw:0,pitch:0}})");tick(144);near(h.run('bench.actors.player.bottleDamage'),10,'overkill excluded');assert.equal(h.run('bench.actors.player.bottleKills'),1);
   setup();h.run("player.kit=new DuelistKit({character:'nope'});bench.disabled='c';activateAbility(player,'c',{zonePoint:{x:0,z:-24},aim:{yaw:0,pitch:0}})");tick(144);assert.equal(h.run('bench.actors.player.bottleHits'),undefined);
 });
 check('ECHO Q counts actual enemy ally and self blind applications without predicted casts',()=>{
   setup();h.run("player.kit=new DuelistKit({character:'echo'});player.kit.updraft=1;bench.actors.player.character='echo';bench.actors.player.team=player.team;bench.actors.enemy.team=enemy.team;enemy.z=-14;enemy.yaw=Math.PI;enemy.pitch=0;activateAbility(player,'q',{zonePoint:{x:0,z:-12.5},aim:{yaw:0,pitch:0}})");tick(84);
   assert.equal(h.run('bench.actors.player.glintEnemyBlinds'),1);near(h.run('bench.actors.player.glintEnemyBlindSeconds'),2,'real duration');assert.equal(h.run('bench.actors.player.glintSelfBlinds||0'),0);tick(24);assert.equal(h.run('bench.actors.player.glintEnemyBlinds'),1);
   setup();h.run("player.kit=new DuelistKit({character:'echo'});player.kit.updraft=1;bench.actors.player.character='echo';bench.actors.player.team=player.team;bench.actors.enemy.team=enemy.team;enemy.z=-9;enemy.yaw=Math.PI;enemy.pitch=0;makeBot({x:3,z:-8},1,player.team,{id:'friend',team:player.team,secondary:'classic',kit:new DuelistKit({character:'nope'})});var friend=bots[1];friend.remoteId='passive';friend.yaw=Math.PI/2;bench.actors.friend={character:'nope',team:player.team,casts:{}};activateAbility(player,'q',{zonePoint:{x:0,z:-8},aim:{yaw:0,pitch:0}})");tick(84);
   assert.equal(h.run('bench.actors.player.glintSelfBlinds'),1);assert.equal(h.run('bench.actors.player.glintFriendlyBlinds'),1);assert.equal(h.run('bench.actors.player.glintEnemyBlinds'),1);
   setup();h.run("player.kit=new DuelistKit({character:'echo'});player.kit.updraft=1;bench.actors.player.character='echo';bench.actors.player.team=player.team;bench.actors.enemy.team=enemy.team;enemy.z=-14;enemy.yaw=Math.PI;bench.disabled='q';activateAbility(player,'q',{zonePoint:{x:0,z:-12.5},aim:{yaw:0,pitch:0}})");tick(84);assert.equal(h.run('bench.actors.player.glintEnemyBlinds'),undefined);
 });
 check('VEIL Q measures actual grounded speed queries once per source target frame, with no cast-only or airborne credit',()=>{
   setup();h.run("player.kit=new DuelistKit({character:'veil'});player.kit.updraft=1;enemy.z=-8;activateAbility(player,'q',{zonePoint:{x:0,y:0,z:-8},aim:{yaw:0,pitch:0}});var realMeasuredPlay=updatePlay;updatePlay=function(dt){realMeasuredPlay(dt);for(let i=0;i<3;i++)ordinarySkills.speedScale(ordinaryActorView(enemy),elapsed,{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})}");
   tick(24);assert.equal(h.run('bench.actors.player.rootSlowSamples||0'),0);tick(24);assert.ok(h.run('bench.actors.player.rootSlowSamples')>0);assert.ok(h.run('bench.actors.player.rootSlowSamples')<=24);near(h.run('bench.actors.player.rootSlowSeconds'),h.run('bench.actors.player.rootSlowSamples')/120,'deduplicated seconds');
   h.run('var previousRootSamples=bench.actors.player.rootSlowSamples;enemy.y=2;enemy.vy=1');tick(12);assert.equal(h.run('bench.actors.player.rootSlowSamples'),h.run('previousRootSamples'));
   setup();h.run("player.kit=new DuelistKit({character:'veil'});player.kit.updraft=1;bench.disabled='q';enemy.z=-8;activateAbility(player,'q',{zonePoint:{x:0,y:0,z:-8},aim:{yaw:0,pitch:0}})");tick(60);assert.equal(h.run('bench.actors.player.rootSlowSamples'),undefined);
 });
 check('MEND E credits only accepted HP to its source and separates self ally and capped healing from X',()=>{
   setup();h.run("player.kit=new DuelistKit({character:'mend'});player.kit.dash=1;player.hp=70;activateAbility(player,'e')");assert.equal(h.run('player.hp'),100);assert.equal(h.run('bench.actors.player.mendHeals'),1);assert.equal(h.run('bench.actors.player.mendHealing'),30);assert.equal(h.run('bench.actors.player.mendSelfHealing'),30);tick(12);assert.equal(h.run('bench.actors.player.mendHealing'),30);
   setup();h.run("player.kit=new DuelistKit({character:'mend'});player.kit.dash=1;enemy.team=player.team;enemy.hp=40;activateAbility(player,'e')");assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('bench.actors.player.mendAllyHealing'),60);assert.equal(h.run('bench.actors.player.mendSelfHealing||0'),0);
   setup();h.run("player.kit=new DuelistKit({character:'mend'});player.kit.ultPoints=7;player.hp=40;activateAbility(player,'x')");assert.equal(h.run('player.hp'),100);assert.equal(h.run('bench.actors.player.mendHealing'),undefined);
   for(const code of["bench.disabled='e'","onlinePlaying=true;online={host:false,session:{memberId:'friend'}}","for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:1,y:.12,z:1},elapsed,match.round)"]){setup();h.sandbox.code=code;h.run("player.kit=new DuelistKit({character:'mend'});player.kit.dash=1;player.hp=40;eval(code);activateAbility(player,'e')");assert.equal(h.run('player.hp'),40);assert.equal(h.run('bench.actors.player.mendHealing'),undefined)}
 });
 check('MEND C measures active real speed queries once per source target frame without credit above floor or outside radius',()=>{
   setup();h.run("player.kit=new DuelistKit({character:'mend'});player.kit.smoke=2;enemy.z=-8;activateAbility(player,'c',{zonePoint:{x:0,y:0,z:-8},aim:{yaw:0,pitch:0}});const seedMeasuredPlay=updatePlay;updatePlay=function(dt){seedMeasuredPlay(dt);for(let i=0;i<3;i++)ordinarySkills.speedScale(ordinaryActorView(enemy),elapsed,{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})}");
   tick(60);assert.equal(h.run('bench.actors.player.seedSlowSamples||0'),0);tick(48);assert.ok(h.run('bench.actors.player.seedSlowSamples')>0);assert.ok(h.run('bench.actors.player.seedSlowSamples')<=48);near(h.run('bench.actors.player.seedSlowSeconds'),h.run('bench.actors.player.seedSlowSamples')/120,'seed deduplicated seconds');
   h.run('var previousSeedSamples=bench.actors.player.seedSlowSamples;enemy.y=5');tick(12);assert.equal(h.run('bench.actors.player.seedSlowSamples'),h.run('previousSeedSamples'));
   setup();h.run("player.kit=new DuelistKit({character:'mend'});player.kit.smoke=2;bench.disabled='c';enemy.z=-8;activateAbility(player,'c',{zonePoint:{x:0,y:0,z:-8},aim:{yaw:0,pitch:0}})");tick(120);assert.equal(h.run('bench.actors.player.seedSlowSamples'),undefined);
 });
 check('ECHO C credits actual one-shot fixed detections without cast-only restored or ablated credit',()=>{
   setup();h.run("player.kit=new DuelistKit({character:'echo'});player.kit.smoke=2;bench.actors.player.character='echo';enemy.z=-8;activateAbility(player,'c',{zonePoint:{x:0,y:0,z:-8},aim:{yaw:0,pitch:0}})");tick(96);assert.equal(h.run('bench.actors.player.tagDetections||0'),0);tick(48);assert.equal(h.run('bench.actors.player.tagDetections'),1);assert.equal(h.run('bench.actors.player.tagPoints[0].z'),-8);h.run('enemy.x=10');tick(48);assert.equal(h.run('bench.actors.player.tagDetections'),1);assert.equal(h.run('bench.actors.player.tagPoints[0].x'),0);
   for(const code of["bench.disabled='c'","enemy.y=5"]){setup();h.sandbox.code=code;h.run("player.kit=new DuelistKit({character:'echo'});player.kit.smoke=2;bench.actors.player.character='echo';enemy.z=-8;eval(code);activateAbility(player,'c',{zonePoint:{x:0,y:0,z:-8},aim:{yaw:0,pitch:0}})");tick(168);assert.equal(h.run('bench.actors.player.tagDetections'),undefined)}
   setup();h.run("player.kit=new DuelistKit({character:'echo'});player.kit.smoke=2;bench.actors.player.character='echo';enemy.z=-8;activateAbility(player,'c',{zonePoint:{x:0,y:0,z:-8},aim:{yaw:0,pitch:0}});var tagSaved=JSON.parse(JSON.stringify(ordinarySkills.snapshot()));ordinarySkills.reset();ordinarySkills.restore(tagSaved,elapsed,match.round)");tick(168);assert.equal(h.run('bench.actors.player.tagDetections'),undefined);
 });

 check('FROST C measures active annulus speed queries once per source target frame without safe-centre or air credit',()=>{
   setup();h.run("player.kit=new DuelistKit({character:'frost'});player.kit.smoke=2;enemy.z=-8;activateAbility(player,'c',{zonePoint:{x:2,y:0,z:-8},aim:{yaw:0,pitch:0}});const stitchMeasuredPlay=updatePlay;updatePlay=function(dt){stitchMeasuredPlay(dt);for(let i=0;i<3;i++)ordinarySkills.speedScale(ordinaryActorView(enemy),elapsed,{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})}");
   tick(72);assert.equal(h.run('bench.actors.player.stitchSlowSamples||0'),0);tick(48);assert.ok(h.run('bench.actors.player.stitchSlowSamples')>0);assert.ok(h.run('bench.actors.player.stitchSlowSamples')<=48);near(h.run('bench.actors.player.stitchSlowSeconds'),h.run('bench.actors.player.stitchSlowSamples')/120,'stitch deduplicated seconds');
   h.run('var previousStitchSamples=bench.actors.player.stitchSlowSamples;enemy.x=2');tick(12);assert.equal(h.run('bench.actors.player.stitchSlowSamples'),h.run('previousStitchSamples'));
   for(const code of["bench.disabled='c'","enemy.y=5"]){setup();h.sandbox.code=code;h.run("player.kit=new DuelistKit({character:'frost'});player.kit.smoke=2;enemy.z=-8;eval(code);activateAbility(player,'c',{zonePoint:{x:2,y:0,z:-8},aim:{yaw:0,pitch:0}})");tick(168);assert.equal(h.run('bench.actors.player.stitchSlowSamples'),undefined)}
 });
 check('Renko counts only accepted push starts actual displacement and own firearm loss within two seconds',()=>{
   setup();h.run("player.kit=new DuelistKit({character:'renko'});player.kit.smoke=2;enemy.z=-12;activateAbility(player,'c',{aim:{yaw:0,pitch:Math.atan2(-.7,12)}})");
   tick(12);assert.equal(h.run('bench.actors.player.dartPushes'),undefined);tick(18);assert.equal(h.run('bench.actors.player.dartPushes'),1);assert.equal(h.run('bench.actors.player.damage'),0);tick(150);near(h.run('bench.actors.player.dartPushDistance'),24,'actual horizontal distance',.03);
   h.run('damageEntity(enemy,20,player,{firearm:true})');near(h.run('bench.actors.player.dartFollowupDamage'),20,'own firearm actual loss');h.run('damageEntity(enemy,10,player,{skill:"nope"})');near(h.run('bench.actors.player.dartFollowupDamage'),20,'skill excluded');tick(120);h.run('damageEntity(enemy,10,player,{firearm:true})');near(h.run('bench.actors.player.dartFollowupDamage'),20,'expired window excluded');
   for(const code of["bench.disabled='c'","enemy.x=5"]){setup();h.sandbox.code=code;h.run("player.kit=new DuelistKit({character:'renko'});player.kit.smoke=2;if(code.startsWith('bench'))eval(code);activateAbility(player,'c',{aim:{yaw:0,pitch:-.05}});if(code.startsWith('enemy'))eval(code)");tick(120);assert.equal(h.run('bench.actors.player.dartPushes'),undefined)}
 });
 console.log('PASS: '+groups+' measurement pipeline/clock/contact/ablation/collision/accounting/objective groups; audio inert');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const runner=new Module(path.join(__dirname,'bot-balance-test-harness.cjs'),module);
runner.filename=path.join(__dirname,'bot-balance-test-harness.cjs');runner.paths=Module._nodeModulePaths(__dirname);
runner._compile(fixturePrefix+prefix+suite,runner.filename);
