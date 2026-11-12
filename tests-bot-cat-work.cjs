const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
async function main({mutate=s=>s,only=()=>true,measureOnly=false,out=null}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const moduleHarness=new Module(path.join(__dirname,'cat-work-harness.cjs'),module);moduleHarness.filename=path.join(__dirname,'cat-work-harness.cjs');moduleHarness.paths=module.paths;moduleHarness.mutateGameSource=mutate;moduleHarness._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',moduleHarness.filename);
 const {harness}=await moduleHarness.exports(),flat=harness(),real=harness({realMap:true});let groups=0;
 for(const h of [flat,real])h.run('var catWorkOriginalActivate=activateAbility');
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name);};
 function setup(h=flat,{kind='defuse',timer=4,roundTime=3,points=7,mapId='hashimoto',side='attack',siteId='A',genericAt=999}={}){
  h.sandbox.cfg={kind,timer,roundTime,points,mapId,side,siteId,genericAt};
  h.run(`online=null;onlinePlaying=false;mode='menu';$('map-select').value=cfg.mapId;$('starting-side').value=cfg.side;$('match-format').value='standard';$('difficulty').value='hard';startGame();clearBots();resetOrdinarySkills();resetZoneAbilities();elapsed=0;
   player.alive=true;player.hp=100;player.x=map.teamSpawns.attack[0].x;player.z=map.teamSpawns.attack[0].z;player.y=0;player.vy=0;player.vx=player.vz=0;firing=false;interactionHeld=false;roster=[];
   var site=map.sites.find(s=>s.id===cfg.siteId),point=getSitePlantPosition(site,site.x,site.z,{collision:map.collision});if(!point)throw Error('No actual plant floor');
   var team=cfg.kind==='defuse'?match.defenderTeam:match.attackerTeam;player.team=team==='blue'?'red':'blue';
   var record={id:'clock-worker',name:'cat',team,k:0,d:0,a:0,primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'cat'})};record.kit.smoke=0;record.kit.updraft=0;record.kit.dash=0;record.kit.ultPoints=cfg.points;roster=[record];makeBot(point,0,team,record);var worker=bots[0];worker.fire=999;worker.nextSkillAt=cfg.genericAt;worker.think=999;worker.target=null;worker.aiWeapon='vandal';worker.aiAmmo=25;worker.aiReserve=75;worker.aiReload=0;
   match.phase='live';match.roundTime=cfg.roundTime;Object.assign(match.spike,{status:cfg.kind==='defuse'?'planted':'carried',carrier:cfg.kind==='defuse'?null:worker.id,x:point.x,z:point.z,site:site.id,timer:cfg.timer,defuseActor:null,defuseProgress:0,plantActor:null,plantProgress:0});
   if(Math.hypot(player.x-worker.x,player.z-worker.z)<50){player.x=map.teamSpawns.defend[0].x;player.z=map.teamSpawns.defend[0].z;}
   var acceptedClocks=0,clockAttempts=0,workFrames=0,firstRole=null;activateAbility=function(actor,key,options){if(actor===worker&&key==='x')clockAttempts++;const result=catWorkOriginalActivate(actor,key,options);if(actor===worker&&key==='x'&&result)acceptedClocks++;return result;};
   var actualWork=match[cfg.kind==='defuse'?'interactDefuse':'interactPlant'].bind(match);match[cfg.kind==='defuse'?'interactDefuse':'interactPlant']=function(dt,options){if(options.actorId===worker.id)workFrames++;return actualWork(dt,options);};
   var actualTactics=updateBots.tactics.update.bind(updateBots.tactics);updateBots.tactics.update=function(...args){const plan=actualTactics(...args);if(firstRole===null)firstRole=plan.roles.get(worker.id)?.role||null;return plan;};Math.random=()=>.2;
  `);
 }
 const step=(h=flat,dt=.1)=>{h.sandbox.stepDT=dt;h.run('updatePlay(stepDT)');};
 const result=h=>JSON.parse(h.run("JSON.stringify({clocks:acceptedClocks,attempts:clockAttempts,role:firstRole,workFrames,points:worker.kit.ultPoints,status:match.spike.status,progress:cfg.kind==='defuse'?match.spike.defuseProgress:match.spike.plantProgress,winner:match.lastRound?.team,reason:match.lastRound?.reason,team:worker.team,hp:worker.hp,alive:worker.alive,seconds:elapsed})"));
 function finish(h=flat,seconds=10,dt=.1){for(let i=0;i<Math.ceil(seconds/dt)&&h.run("match.phase==='live'");i++)step(h,dt);return result(h);}
 if(measureOnly){
  const rows=[],start=performance.now();
  for(const mapId of ['hashimoto','hirakata'])for(const siteId of ['A','B'])for(const side of ['attack','defend'])for(const points of [7,0]){setup(real,{mapId,siteId,side,points,genericAt:0});rows.push({mapId,siteId,side,initialPoints:points,genericSkillAt:0,...finish(real)});}
  const disk=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
  const report={kind:'controlled actual-map objective BOT scenarios; real tactics/navigation/updatePlay, no manual work or cast; opponent stationary and CQE unavailable, not general win-rate evidence',sourceSha256:hash(mutate(disk)),diskSourceSha256:hash(disk),memoryVariant:mutate(disk)!==disk,harnessSha256:hash(fs.readFileSync(__filename)),rows,wallMs:Math.round(performance.now()-start)};
  fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({out,rounds:rows.length,withX:rows.filter(r=>r.points!==0||r.clocks>0).length,clocks:rows.reduce((n,r)=>n+r.clocks,0),defuses:rows.filter(r=>r.status==='defused').length,wallMs:report.wallMs}));return report;
 }
 test('real tactical defuser arms X before first work despite generic skill cooldown and wins deadline',()=>{
  setup();step();assert.equal(flat.run('firstRole'),'defuse');assert.equal(flat.run('acceptedClocks'),1);assert.equal(flat.run('match.spike.defuseActor'),'clock-worker');assert.ok(flat.run('match.spike.defuseProgress')>0);assert.equal(flat.run('worker.kit.ultPoints'),0);const final=finish();assert.equal(final.status,'defused');assert.equal(final.winner,final.team);
  setup(flat,{points:0});const none=finish();assert.equal(none.clocks,0);assert.equal(none.status,'detonated');
 });
 test('actual carrier freezes late round before planting and normal long clocks conserve X',()=>{
  setup(flat,{kind:'plant',roundTime:2});step();assert.equal(flat.run('firstRole'),'plant');assert.equal(flat.run('acceptedClocks'),1);assert.ok(flat.run('match.spike.plantProgress')>0);for(let i=0;i<45&&flat.run("match.spike.status==='carried'");i++)step();assert.equal(flat.run('match.spike.status'),'planted');
  for(const cfg of [{timer:20},{kind:'plant',roundTime:30}]){setup(flat,cfg);step();assert.equal(flat.run('acceptedClocks'),0);assert.equal(flat.run('worker.kit.ultPoints'),7);}
 });
 test('ongoing work never starts a new cast or cancels progress for newly earned points',()=>{
  setup(flat,{points:0,timer:11});step();flat.run('worker.kit.ultPoints=7');for(let i=0;i<5;i++)step();assert.equal(flat.run('acceptedClocks'),0);assert.ok(flat.run('match.spike.defuseProgress')>.5);assert.equal(flat.run('worker.kit.ultPoints'),7);
 });
 test('other assigned worker, occupied defuse, airborne actor and wrong objective keep points',()=>{
  setup();flat.run("var other={id:'other-defender',team:worker.team,primary:'vandal',secondary:'classic',kit:new DuelistKit({character:'nope'})};makeBot({x:worker.x,z:worker.z},1,worker.team,other);bots[1].fire=999;worker.x+=4;worker.nextSkillAt=999");step();assert.equal(flat.run('acceptedClocks'),0);assert.equal(flat.run('worker.defusing'),false);assert.equal(flat.run('match.spike.defuseActor'),'other-defender');
  setup();flat.run("match.spike.defuseActor='other';match.spike.defuseProgress=1");step();assert.equal(flat.run('acceptedClocks'),0);assert.equal(flat.run('match.spike.defuseActor'),'other');
  setup();flat.run('worker.y=2;worker.vy=2');step();assert.equal(flat.run('acceptedClocks'),0);
  setup();flat.run('worker.team=match.attackerTeam;worker.record.team=worker.team');step();assert.equal(flat.run('acceptedClocks'),0);
 });
 test('existing clock, insufficient points and full20event rejection preserve ordinary work and bound retries',()=>{
  setup(flat,{points:6});step();assert.equal(flat.run('acceptedClocks'),0);assert.equal(flat.run('worker.kit.ultPoints'),6);assert.ok(flat.run('match.spike.defuseProgress')>0);
  setup();flat.run("ordinarySkills.cast('cat-clock',ordinaryActorView(player),{x:player.x,y:0,z:player.z},elapsed,match.round)");step();assert.equal(flat.run('acceptedClocks'),0);assert.equal(flat.run('worker.kit.ultPoints'),7);
  setup();flat.run("for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:player.x,y:0,z:player.z-20},elapsed,match.round)");step();assert.equal(flat.run('clockAttempts'),1);assert.equal(flat.run('acceptedClocks'),0);assert.equal(flat.run('worker.kit.ultPoints'),7);assert.ok(flat.run('match.spike.defuseProgress')>0);
  flat.run("match.cancelDefuse(worker.id)");step();assert.equal(flat.run('clockAttempts'),1);
  flat.run('ordinarySkills.reset();match.cancelDefuse(worker.id)');for(let i=0;i<6;i++)step();flat.run('match.cancelDefuse(worker.id)');step();assert.equal(flat.run('acceptedClocks'),1);
 });
 test('actual work uses the unchanged8second clock and deadlines at20/60/144Hz',()=>{
  for(const hz of [20,60,144]){setup();const final=finish(flat,8,1/hz);assert.equal(final.clocks,1);assert.equal(final.status,'defused');assert.ok(final.seconds>=7-1e-7&&final.seconds<7.1,[hz,final.seconds]);}
 });
 test('residual service state clears for work, retry resets and remote guest cannot cast',()=>{
  setup();flat.run("worker.serviceReload={eventId:'old',weaponId:'vandal',endsAt:100}");step();assert.equal(flat.run('worker.serviceReload'),null);assert.equal(flat.run('acceptedClocks'),1);
  setup();step();flat.run('worker.nextCatClockAt=999;resetOrdinarySkills()');assert.equal(flat.run('worker.nextCatClockAt'),0);
  for(const code of ["worker.remoteId='guest'","onlinePlaying=true;online={host:false,session:{memberId:'friend'}}"]){setup();flat.run(code);step();assert.equal(flat.run('acceptedClocks'),0);assert.equal(flat.run('worker.kit.ultPoints'),7);}
 });
 test('both real maps and A/B floors assign and finish the genuine defuse role for either team',()=>{
  for(const mapId of ['hashimoto','hirakata'])for(const siteId of ['A','B'])for(const side of ['attack','defend']){setup(real,{mapId,siteId,side});const final=finish(real);assert.equal(final.role,'defuse');assert.equal(final.clocks,1,JSON.stringify({mapId,siteId,side,final}));assert.equal(final.status,'defused');assert.equal(final.winner,final.team);}
 });
 console.log(`PASS: ${groups} actual tactical CAT work/clock groups; no playback`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
