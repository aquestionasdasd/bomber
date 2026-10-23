const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-onnara-game.cjs'),'utf8'),boundary=fixture.indexOf(' const local=harness();');
if(boundary<0)throw Error('Saved-game harness boundary changed');
const suite=String.raw`
 const local=harness();
 function setup(kind='plant'){
  local.reset();local.clearWalls();local.sandbox.kind=kind;
  local.run("difficulty='hard';match.phase='live';match.roundTime=100;Object.assign(player,{team:'red',x:65,y:0,z:65,hp:100,alive:true});makeBot({x:-28,z:-25},0,'blue',{id:'worker',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'nobi'})});var worker=bots[0];worker.kit.smoke=0;worker.kit.updraft=0;worker.kit.ultPoints=0;Object.assign(worker,{aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:999,think:1,target:null,nextSkillAt:999});var urgent=false;var role='plant';var defuserId=null;var goal={x:worker.x,z:worker.z};if(kind==='defuse'){worker.team=match.defenderTeam;worker.record.team=worker.team;player.team=match.attackerTeam;match.spike.status='planted';match.spike.carrier=null;match.spike.x=worker.x;match.spike.z=worker.z;match.spike.timer=45;role='defuse';defuserId=worker.id;}else{worker.team=match.attackerTeam;worker.record.team=worker.team;player.team=match.defenderTeam;match.spike.status='carried';match.spike.carrier=worker.id;}updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return {siteId:'A',defuserId,roles:new Map([[worker.id,{goal,role,siteId:'A',urgent}]])}}};Math.random=()=>.2;");
 }
 function step(dt=.1){local.sandbox.stepDT=dt;local.run('elapsed+=stepDT;worker.kit.tick(elapsed);updateOrdinarySkills();updateBots(stepDT)');}
 const tools=()=>local.run("ordinarySkills.events(elapsed).filter(e=>e.type==='nobi-tool'&&e.sourceId===worker.id).length");
 check('first actual plant arms E despite generic timer and applies1.5x from first frame',()=>{
  setup();step();assert.equal(tools(),1);assert.equal(local.run('worker.kit.dash'),0);near(local.run('match.spike.plantProgress'),.15,'first plant');assert.ok(local.run('worker.planting'));
  for(let i=0;i<26;i++)step();assert.equal(local.run('match.spike.status'),'planted');assert.equal(tools(),1);
  setup();local.run('worker.kit.dash=0');for(let i=0;i<27;i++)step();assert.equal(local.run('match.spike.status'),'carried');near(local.run('match.spike.plantProgress'),2.7,'ordinary work unchanged');
 });
 check('assigned first off work uses E and finishes in4.7s instead of7',()=>{
  setup('defuse');step();near(local.run('match.spike.defuseProgress'),.15,'first off');assert.equal(tools(),1);
  for(let i=0;i<45;i++)step();assert.equal(local.run('match.spike.status'),'planted');step();assert.equal(local.run('match.spike.status'),'defused');
  setup('defuse');local.run('worker.kit.dash=0');for(let i=0;i<47;i++)step();assert.equal(local.run('match.spike.status'),'planted');near(local.run('match.spike.defuseProgress'),4.7,'normal off');
 });
 check('approach, other carrier, other defuser and guard roles do not waste tool',()=>{
  for(const code of ["worker.x+=6;goal.x=worker.x", "match.spike.carrier='other'", "worker.x+=6;role='guard';goal.x=worker.x"]){setup();local.run(code);step();assert.equal(tools(),0,code);assert.equal(local.run('worker.kit.dash'),1);}
  setup('defuse');local.run("defuserId='other'");step();assert.equal(tools(),0);
  setup('defuse');local.run("match.spike.defuseActor='other';match.spike.defuseProgress=1");step();assert.equal(tools(),0);near(local.run('match.spike.defuseProgress'),1,'other exclusive work');
 });
 check('close visible threat and airborne bodies do not start work or spend E',()=>{
  setup();local.run('Object.assign(player,{x:worker.x,z:worker.z-6});worker.target=player;worker.group.rotation.y=Math.PI');step();assert.equal(tools(),0);assert.equal(local.run('worker.planting'),false);
  setup();local.run('worker.y=2;worker.vy=2');step();assert.equal(tools(),0);
 });
 check('ongoing work does not secretly arm mid-task; existing active E is not duplicated',()=>{
  setup();local.run('worker.kit.dash=0');step();local.run('worker.kit.dash=1');for(let i=0;i<7;i++)step();assert.equal(tools(),0);near(local.run('match.spike.plantProgress'),.8,'no mid-work cast');
  setup();step();local.run('worker.kit.dash=1');step();assert.equal(tools(),1);assert.equal(local.run('worker.kit.dash'),1);
 });
 check('20event failure preserves stock and work, bounds retries, then succeeds once space opens',()=>{
  setup();local.run("for(let i=0;i<20;i++)ordinarySkills.cast('duelist-comet',{id:'other-'+i,team:worker.team,x:0,y:0,z:0,hp:100,alive:true},{x:0,y:2,z:-10},elapsed,match.round);var attempts=0;var realActivate=activateAbility;activateAbility=function(actor,key,opts){if(actor===worker&&key==='e')attempts++;return realActivate(actor,key,opts);}");step();assert.equal(local.run('worker.kit.dash'),1);assert.equal(local.run('attempts'),1);near(local.run('match.spike.plantProgress'),.1,'failed E keeps work');
  local.run('match.cancelPlant(worker.id)');step();assert.equal(local.run('attempts'),1);local.run('ordinarySkills.reset();match.cancelPlant(worker.id);elapsed+=.6');step();assert.equal(local.run('attempts'),2);assert.equal(tools(),1);
 });
 check('death/round/menu reset clears work effect and retry state; remote actors are not BOT-cast',()=>{
  setup();step();local.run('worker.alive=false;worker.hp=0;updateOrdinarySkills()');assert.equal(tools(),0);
  setup();local.run("worker.nextNobiToolAt=999;resetOrdinarySkills()");assert.equal(local.run('worker.nextNobiToolAt'),0);
  setup();local.run("worker.remoteId='guest'");step();assert.equal(tools(),0);assert.equal(local.run('worker.kit.dash'),1);
 });
 check('real deadline can be won by E, without changing bomb clock or multi-owner rule',()=>{
  setup('defuse');local.run('match.spike.timer=5');for(let i=0;i<47;i++){step();local.run('if(match.phase===\'live\')match.tick(.1,{playerAlive:false,attackers:1,defenders:1})');}assert.equal(local.run('match.spike.status'),'defused');assert.equal(local.run('match.lastRound.reason'),'defuse');
  setup('defuse');local.run('worker.kit.dash=0;match.spike.timer=5');for(let i=0;i<50;i++){step();local.run('if(match.phase===\'live\')match.tick(.1,{playerAlive:false,attackers:1,defenders:1})');}assert.notEqual(local.run('match.spike.status'),'defused');
 });
 console.log('PASS '+groups+' actual BOT work timing groups; silent');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const runner=new Module(path.join(__dirname,'bot-nobi-work-harness.cjs'),module);runner.filename=path.join(__dirname,'bot-nobi-work-harness.cjs');runner.paths=Module._nodeModulePaths(__dirname);runner._compile(fixture.slice(0,boundary)+suite,runner.filename);
