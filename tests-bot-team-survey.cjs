const assert=require('node:assert/strict');
const {loadHarness,install,normalize,cli}=require('./scripts/bot-team-survey.cjs');
async function main({mutate=s=>s}={}){
 const {harness}=await loadHarness(),h=install(harness(),mutate);let groups=0;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);};
 const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,actual+' != '+expected);
 function setup(){h.run('survey=null');h.reset();h.clearWalls();h.run(`match.phase='live';match.roundTime=100;player.alive=false;player.hp=0;player.team='survey-observer';
  for(const[id,team,x]of[['attacker','blue',-3],['victim','red',3],['friend','blue',-6]])makeBot({x,z:-5},bots.length,team,{id,team,name:id,primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'nope'})});
  var attacker=bots[0],victim=bots[1],friend=bots[2];for(const b of bots)b.remoteId='passive';beginSurvey(bots);
  updateBots.tactics=createBotTactics({sites:map.sites,navigation,collision:map.collision});measureObjectives();`);}
 test('bounded options and explicit private report destination',()=>{
  assert.equal(normalize().hz,60);assert.deepEqual(normalize().maps,['hashimoto','hirakata','trc']);assert.equal(normalize().compare,true);
  for(const o of[{hz:10},{hz:NaN},{seeds:0},{seeds:11},{start:-1},{compare:'false'},{seconds:Infinity},{seconds:181},{maps:['secret']},{maps:['trc','trc']},{sides:[]}])assert.throws(()=>normalize(o));
  assert.throws(()=>cli([]));assert.throws(()=>cli(['--out=report.json','--compare=no']));assert.throws(()=>cli(['--out=report.json','--eval=anything']));assert.equal(cli(['--out=report.json','--hz=144']).options.hz,144);
 });
 test('one complete actual frame and no hidden nonparticipant resurrection',()=>{
  setup();h.run('var beforeElapsed=elapsed;surveyFrame(.05)');assert.ok(Math.abs(h.run('elapsed-beforeElapsed')-.05)<1e-8);assert.equal(h.run('survey.frames'),1);assert.equal(h.run('surveyCarFrames'),1);
  h.run('var realCarDriver=updateCarMotions;updateCarMotions=function(dt){realCarDriver(dt);realCarDriver(dt)}');assert.throws(()=>h.run('surveyFrame(.05)'),/pipeline/);h.run('updateCarMotions=realCarDriver');
  assert.throws(()=>h.run('surveyFrame(0)'),/Invalid/);assert.throws(()=>h.run('surveyStep=1;surveyFrame(.05)'),/recursive/);h.run('surveyStep=0;player.alive=true');assert.throws(()=>h.run('surveyFrame(.05)'),/Nonparticipant/);
 });
 test('actual HP and armor loss only; no requested overkill or dead repeat credit',()=>{
  setup();h.run('damageEntity(victim,400,attacker,{firearm:true});damageEntity(victim,400,attacker,{firearm:true})');
  assert.equal(h.run('survey.actors.attacker.damage'),150);assert.equal(h.run('survey.actors.attacker.gunDamage'),150);assert.equal(h.run('survey.actors.attacker.kills'),1);assert.equal(h.run('survey.followGunDamage'),0);
  h.run('damageEntity(friend,40,attacker,{firearm:true})');assert.equal(h.run('survey.actors.attacker.damage'),150,'friendly damage cannot inflate enemy damage');
 });
 test('same follower and same target plus confirmed effect are required for follow gun credit',()=>{
  setup();h.run(`survey.plans[1]={ready:true,followGunDamage:0};updateBots.tactics.skillState=()=>({plans:[{id:1,phase:'exploit',until:elapsed+1,follower:'attacker',targetId:'victim'}]});
   damageEntity(victim,20,friend,{firearm:true});damageEntity(victim,20,attacker,{});damageEntity(victim,20,attacker,{firearm:true});`);
  near(h.run('survey.followGunDamage'),20);near(h.run('survey.plans[1].followGunDamage'),20);
  h.run('survey.plans[1].ready=false;damageEntity(victim,20,attacker,{firearm:true})');near(h.run('survey.followGunDamage'),20);
  h.run(`survey.plans[1].ready=true;updateBots.tactics.skillState=()=>({plans:[{id:1,phase:'exploit',until:elapsed+1,follower:'attacker',targetId:'other'}]});damageEntity(victim,20,attacker,{firearm:true})`);near(h.run('survey.followGunDamage'),20);
  h.run(`updateBots.tactics.skillState=()=>({plans:[{id:1,phase:'flight',until:elapsed+1,follower:'attacker',targetId:'victim'}]});damageEntity(victim,20,attacker,{firearm:true})`);near(h.run('survey.followGunDamage'),20);
 });
 test('movement bookkeeping excludes wait strafing and unrelated objective travel',()=>{
  setup();
  // Synthetic bookkeeping unit only: reports below never use this replacement.
  // It deliberately moves a real actor with collision while varying intent.
  h.run(`var realSurveyPlay=updatePlay,travelMode='wait';survey.plans[1]={ready:true,followTravel:0};
   updatePlay=function(dt){elapsed+=dt;updateCarMotions(dt);survey.currentOrders=[['attacker',{kind:travelMode==='wait'?'wait':'follow',planId:1}]];const move=()=>{moveEntity(attacker,.2,0);return true;};if(travelMode==='wait'||travelMode==='follow')surveyFollowAdvance(attacker,move);else move();};
   surveyFrame(.05);travelMode='urgent';surveyFrame(.05);travelMode='strafe';surveyFrame(.05);`);
  assert.equal(h.run('survey.followTravel'),0);near(h.run('survey.followOrderSeconds'),.1);
  h.run(`travelMode='follow';surveyFrame(.05);survey.plans[1].ready=false;surveyFrame(.05);updatePlay=realSurveyPlay`);near(h.run('survey.followTravel'),.2);near(h.run('survey.plans[1].followTravel'),.2);
 });
 test('real skill calls count once across nested robot and Japan entry points; refusal counts zero',()=>{
  setup();h.run(`attacker.kit=new DuelistKit({character:'ember'});attacker.kit.smoke=2;var robotCast=activateAbility(attacker,'c',{zonePoint:{x:-3,y:0,z:-9},aim:{yaw:0,pitch:0},robotMode:0})`);
  assert.ok(h.run('robotCast'));assert.equal(h.run('survey.actors.attacker.casts.c'),1);assert.equal(h.run('attacker.kit.smoke'),1);
  h.run(`attacker.kit=new DuelistKit({character:'japan'});attacker.kit.smoke=1;var japanCast=activateAbility(attacker,'c',{aim:{yaw:0,pitch:0}});activateAbility(attacker,'c',{aim:{yaw:0,pitch:0}})`);
  assert.ok(h.run('japanCast'));assert.equal(h.run('survey.actors.attacker.casts.c'),2);
 });
 test('real objective progress and completion belong to the actor that performed work',()=>{
  setup();h.run(`match.spike.status='carried';match.spike.carrier='attacker';for(let i=0;i<4;i++)match.interactPlant(1,{actorId:'attacker',team:match.attackerTeam,site:'A',x:map.sites[0].x,z:map.sites[0].z});match.drainEvents();match.drainEvents();`);
  assert.equal(h.run('survey.plants'),1);assert.equal(h.run('survey.actors.attacker.plants'),1);assert.equal(h.run('survey.actors.friend.plants'),0);assert.equal(h.run('survey.actors.attacker.plantProgress'),4);
  h.run(`match.interactDefuse(1,{actorId:'victim',team:match.defenderTeam});match.interactDefuse(1,{actorId:'friend',team:match.defenderTeam});for(let i=0;i<6;i++)match.interactDefuse(1,{actorId:'victim',team:match.defenderTeam});match.drainEvents();match.drainEvents();`);
  assert.equal(h.run('survey.defuses'),1);assert.equal(h.run('survey.actors.victim.defuses'),1);assert.equal(h.run('survey.actors.victim.defuseProgress'),7);assert.equal(h.run('survey.actors.friend.defuses'),0);assert.equal(h.run('survey.actors.friend.defuseProgress'),0);
 });
 test('acceptance and effect confirmation are distinct and disabled comparison creates no plans',()=>{
  setup();h.run(`measureTactics(false);var input={now:elapsed,spike:{status:'carried'},attackerTeam:'blue',allies:[{id:'setter',team:'blue',character:'nobi',alive:true,hp:100,x:0,y:0,z:0,ammo:25,ready:true,stock:{c:1},role:'escort'},{id:'entry',team:'blue',character:'duelist',alive:true,hp:100,x:3,y:0,z:0,ammo:25,ready:true,stock:{},role:'escort'}],contacts:{blue:[{id:'target',team:'red',x:0,y:0,z:18,seenAt:elapsed}],red:[]},canSetup:()=>true,effectState:()=>({alive:true,ready:false,endsAt:elapsed+5})};
   updateBots.tactics.observe('blue','setter',input.contacts.blue[0],elapsed);updateBots.tactics.skillPlan(input);var state=updateBots.tactics.skillState().plans[0];updateBots.tactics.skillAccepted(state.id,{id:'event',sourceId:'setter',team:'blue',type:'nobi-bell',triggerAt:elapsed+.5,endsAt:elapsed+5},elapsed);
   input.now+=.5;input.contacts.blue[0].seenAt=input.now;updateBots.tactics.skillPlan(input);`);
  assert.equal(h.run('survey.accepted'),1);assert.equal(h.run('survey.effectReady'),0);assert.equal(h.run('survey.plans[1].accepted'),true);
  h.run(`input.effectState=()=>({alive:true,ready:true,endsAt:elapsed+5});updateBots.tactics.skillPlan(input);updateBots.tactics.skillPlan(input)`);
  assert.equal(h.run('survey.effectReady'),1);assert.equal(h.run('survey.plans[1].ready'),true);assert.equal(h.run('survey.followGunDamage'),0);assert.equal(h.run('survey.followTravel'),0);
  setup();h.run('measureTactics(true)');assert.equal(h.run('updateBots.tactics.skillPlan'),undefined);assert.equal(h.run('Object.keys(survey.plans).length'),0);
 });
 console.log('Team survey instrumentation PASS: '+groups+' groups; audio output0');return groups;
}
module.exports={main};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
