// Offline measurement only. No product module, network, renderer or audio device
// is replaced by a simplified combat model. The existing saved-game VM owns AI,
// perception, movement, shots, damage, abilities and the complete frame driver.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sha=value=>createHash('sha256').update(value).digest('hex');
async function loadHarness(){
 const template=fs.readFileSync(path.join(root,'tests-nope-decoy-game.cjs'),'utf8'),cut=template.indexOf('  const local = harness();');
 assert.ok(cut>0,'Review the saved-game fixture boundary before measuring');
 const gameRead="fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')",advance="bot.moving=advance(bot,point,'team-follow');";
 assert.equal(fs.readFileSync(path.join(root,'public/game.js'),'utf8').split(advance).length,2,'Review the exact pursuit observer before measuring');
 const prefix=template.slice(0,cut).replace(gameRead,gameRead+'.replace('+JSON.stringify(advance)+','+JSON.stringify("bot.moving=surveyFollowAdvance(bot,()=>advance(bot,point,'team-follow'));")+')');
 assert.notEqual(prefix,template.slice(0,cut),'Pursuit observer was not installed');
 const m=new Module(path.join(root,'team-survey-harness.cjs'),module);m.filename=path.join(root,'team-survey-harness.cjs');m.paths=Module._nodeModulePaths(root);
 m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);
 return m.exports();
}
const instrumentation=`
 var survey=null,surveyStep=0,surveyDepth=0,surveyCarFrames=0;
 function beginSurvey(actors){survey={actors:Object.fromEntries(actors.map(a=>[a.id,{character:a.kit?.character,team:a.team,casts:{},commands:0,damage:0,friendlyDamage:0,gunDamage:0,kills:0,plants:0,defuses:0,plantProgress:0,defuseProgress:0}])),plans:{},accepted:0,effectReady:0,followOrderSeconds:0,followTravel:0,followGunDamage:0,plants:0,defuses:0,frames:0};surveyCarFrames=0;return survey;}
 const surveyDamage=damageEntity;
 damageEntity=function(target,amount,killer,options){
  const before=target.hp+(target.armor||0),alive=target.alive,plans=updateBots.tactics?.skillState?.().plans||[],result=surveyDamage(target,amount,killer,options);
  if(survey&&alive&&killer){const a=survey.actors[killer.id],loss=Math.max(0,before-target.hp-(target.armor||0));
   if(a&&loss>0){if(target.team===killer.team)a.friendlyDamage+=loss;else{a.damage+=loss;if(!target.alive)a.kills++;
    if(options?.firearm){a.gunDamage+=loss;for(const p of plans)if(p.phase==='exploit'&&elapsed<p.until&&p.follower===killer.id&&p.targetId===target.id){const record=survey.plans[p.id];if(record?.ready){survey.followGunDamage+=loss;record.followGunDamage+=loss;}}}
   }}
  }return result;
 };
 const surveyWrapCast=fn=>function(actor,key,options){surveyDepth++;let result;try{result=fn(actor,key,options);}finally{surveyDepth--;}
  const a=survey?.actors[actor?.id];if(a&&result&&surveyDepth===0){if(options?.robotCommand)a.commands++;else a.casts[key]=(a.casts[key]||0)+1;}return result;
 };
 activateAbility=surveyWrapCast(activateAbility);activateJapanAbility=surveyWrapCast(activateJapanAbility);activateRobotAbility=surveyWrapCast(activateRobotAbility);
 const surveyCarMotion=updateCarMotions;updateCarMotions=function(dt){if(survey&&surveyStep)surveyCarFrames++;return surveyCarMotion(dt);};
 function measureTactics(disabled){
  const t=updateBots.tactics,actual=t.skillPlan,accept=t.skillAccepted;
  t.skillAccepted=function(...args){const result=accept(...args);if(survey&&result){survey.accepted++;const p=survey.plans[args[0]];if(p){p.accepted=true;p.eventId=args[1].id;}}return result;};
  t.skillPlan=disabled?undefined:function(input){
   const effect=input.effectState,original={...input,effectState:state=>{const result=effect(state),record=survey?.plans[state.id];
    if(result?.alive&&result.ready&&record&&!record.ready){record.ready=true;record.readyAt=elapsed;survey.effectReady++;}return result;
   }},orders=actual(original);
   for(const p of t.skillState().plans)survey.plans[p.id]||={id:p.id,type:p.action.type,objective:p.objective,at:elapsed,caster:p.caster,follower:p.follower,targetId:p.targetId,ready:false,accepted:false,followTravel:0,followGunDamage:0};
   survey.currentOrders=[...orders];return orders;
  };
 }
 function measureObjectives(){
  const drain=match.drainEvents.bind(match);match.drainEvents=function(){const events=drain();if(survey)for(const e of events){if(e.type==='planted'||e.type==='defused'){const key=e.type==='planted'?'plants':'defuses';survey[key]++;const a=survey.actors[e.actorId];if(a)a[key]++;}}return events;};
  for(const[method,key,field]of[['interactPlant','plantProgress','plantProgress'],['interactDefuse','defuseProgress','defuseProgress']]){
   const work=match[method].bind(match);match[method]=function(dt,options){const before=this.spike[field],result=work(dt,options),a=survey?.actors[options.actorId];if(a)a[key]+=Math.max(0,this.spike[field]-before);return result;};
  }
 }
 function surveyFollowAdvance(bot,advance){
  const before={x:bot.x,y:bot.y||0,z:bot.z},result=advance(),order=survey?.currentOrders.find(([id])=>id===bot.id)?.[1],record=survey?.plans[order?.planId];
  if(surveyStep&&result&&order?.kind==='follow'&&record?.ready){const travel=Math.hypot(bot.x-before.x,(bot.y||0)-before.y,bot.z-before.z);survey.followTravel+=travel;record.followTravel+=travel;}return result;
 }
 function surveyFrame(dt){
  if(!Number.isFinite(dt)||dt<=0||surveyStep)throw Error('Invalid or recursive survey frame');
  const start=elapsed,cars=surveyCarFrames;survey.currentOrders=[];surveyStep=dt;
  try{updatePlay(dt);}finally{surveyStep=0;}
  if(Math.abs(elapsed-start-dt)>1e-7||surveyCarFrames-cars!==1)throw Error('Incomplete or duplicate real frame pipeline');survey.frames++;
  if(player.alive||['blue','red'].includes(player.team)||['blue','red'].some(team=>aliveCount(team)>5))throw Error('Nonparticipant entered the measured 5v5');
  for(const[id,order]of survey.currentOrders)if(order.kind==='follow'){
   survey.followOrderSeconds+=dt;
  }
 }
`;
function install(h,mutate=s=>s){h.run(mutate(instrumentation));return h;}
function normalize(options={}){
 const c={maps:options.maps||['hashimoto','hirakata','trc'],seeds:options.seeds??1,start:options.start??1,hz:options.hz??60,sides:options.sides||['attack','defend'],compare:options.compare??true,seconds:options.seconds??150};
 assert.ok(Array.isArray(c.maps)&&c.maps.length>0&&new Set(c.maps).size===c.maps.length&&c.maps.every(m=>['hashimoto','hirakata','trc'].includes(m)));
 assert.ok(Array.isArray(c.sides)&&c.sides.length>0&&new Set(c.sides).size===c.sides.length&&c.sides.every(s=>['attack','defend'].includes(s)));
 assert.ok(Number.isInteger(c.seeds)&&c.seeds>=1&&c.seeds<=10);assert.ok(Number.isInteger(c.start)&&c.start>=1&&c.start<=10000);
 assert.ok([20,60,144].includes(c.hz));assert.equal(typeof c.compare,'boolean');assert.ok(Number.isFinite(c.seconds)&&c.seconds>=1&&c.seconds<=180);return c;
}
async function runSurvey(options={},onRow=()=>{}){
 const config=normalize(options),started=performance.now(),{harness}=await loadHarness(),h=install(harness({realMap:true})),rows=[];
 for(const mapId of config.maps)for(const side of config.sides)for(let seed=config.start;seed<config.start+config.seeds;seed++)for(const disabled of config.compare?[false,true]:[false]){
  h.sandbox.surveyCase={mapId,side,seed,disabled,hz:config.hz,seconds:config.seconds};
  h.run(`{
   survey=null;let rng=surveyCase.seed*7817+37;Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
   online=null;onlinePlaying=false;mode='menu';$('map-select').value=surveyCase.mapId;$('match-format').value='standard';$('starting-side').value=surveyCase.side;$('difficulty').value='hard';startGame();clearBots();resetOrdinarySkills();resetZoneAbilities();elapsed=0;
   // The harness retains a local camera actor. Keep this nonparticipant dead on
   // a neutral team so revive skills cannot silently turn the trial into 6v5.
   player.alive=false;player.hp=0;player.team='survey-observer';roster=[];
   // Map construction may consume visual PRNG samples only on the first case.
   // Reset after it so each pair starts with identical actual bot timers too.
   rng=surveyCase.seed*7817+37;updateBots.matchSeed=surveyCase.seed;
   const seats=Array.from({length:10},(_,i)=>({id:'seat-'+i})),draft=draftBotCharacters(seats,Object.keys(CHARACTER_DEFS),{seed:surveyCase.seed}),selection=seats.map(s=>draft.get(s.id));
   for(const team of ['blue','red'])for(let i=0;i<5;i++){
    const character=selection[(team==='blue'?0:5)+i],record={id:team+'-'+i,team,name:team+'-'+i,k:0,d:0,a:0,credits:3000,primary:'vandal',secondary:'classic',armor:50,survived:false,kit:new DuelistKit({character})};
    record.kit.smoke=getCharacterSkill(character,'c').max;record.kit.updraft=getCharacterSkill(character,'q').max;record.kit.ultPoints=7;roster.push(record);makeBot(map.teamSpawns[team===match.attackerTeam?'attack':'defend'][i],i,team,record);
   }
   beginSurvey(bots);survey.initialPoses=bots.map(b=>({id:b.id,x:b.x,y:b.y||0,z:b.z,character:b.kit.character,ammo:b.aiAmmo,weapon:b.aiWeapon,fire:b.fire,think:b.think,strafe:b.strafe,pathTime:b.pathTime,reactionUntil:b.reactionUntil}));
   updateBots.tactics=createBotTactics({sites:map.sites,navigation,collision:map.collision,lanes:map.lanes,attackSpawn:map.teamSpawns.attack[0],defendSpawn:map.teamSpawns.defend[0],seed:surveyCase.seed});
   measureTactics(surveyCase.disabled);measureObjectives();match.spike.carrier=match.attackerTeam+'-0';match.startLive();match.drainEvents();
   for(let frame=0;frame<Math.ceil(surveyCase.seconds*surveyCase.hz)&&match.phase==='live';frame++)surveyFrame(1/surveyCase.hz);
   survey.history=updateBots.tactics.skillState().history;survey.result={phase:match.phase,winner:match.lastRound?.team||null,reason:match.lastRound?.reason||'unfinished',seconds:elapsed,alive:{blue:aliveCount('blue'),red:aliveCount('red')}};
   delete survey.currentOrders;
  }`);
  const row={mapId,side,seed,disabled,...JSON.parse(h.run('JSON.stringify(survey)'))};rows.push(row);onRow(row);
 }
 const report={kind:'Silent real-map 10-CPU single-round diagnostic; Hard; fixed Vandal/armor50/full C/Q stock/7ult; actual updatePlay once per frame',config,harnessSha256:sha(fs.readFileSync(__filename)),sourceHashes:Object.fromEntries(['game.js','bot-tactics.js','bot-team-planner.js','abilities.js','character-skills.js','rules.js'].map(f=>[f,sha(fs.readFileSync(path.join(root,'public',f)))])),rows,wallMs:Math.round(performance.now()-started),limitations:['Fixed equipment and initial skill stock are not ordinary match economy or human play.','Small seeded paired samples and PRNG branch divergence do not prove win-rate or damage improvement.','A follow order, actual follow travel, same-target gun damage, and personal objective progress/completion are separate metrics. No causal credit for team wins or a teammate defuse.','A ready plan means the existing authoritative effect query confirmed its target; not every ordinary cast is counted as a successful effect.','Single rounds do not measure multi-round opening habits or cross-match learning.','Rendering, real devices, audio and multiplayer transport are not exercised.']};
 if(config.compare)for(let i=0;i<rows.length;i+=2){assert.deepEqual(rows[i].initialPoses,rows[i+1].initialPoses);assert.equal(rows[i].disabled,false);assert.equal(rows[i+1].disabled,true);assert.equal(Object.keys(rows[i+1].plans).length,0);}
 return report;
}
function cli(args){const o={};let out;for(const arg of args){const m=/^--([a-z]+)=(.+)$/.exec(arg);assert.ok(m,'Use --name=value');const[,key,value]=m;if(key==='out')out=value;else if(['maps','sides'].includes(key))o[key]=value.split(',');else if(['seeds','start','hz','seconds'].includes(key))o[key]=Number(value);else if(key==='compare'){assert.ok(['true','false'].includes(value));o.compare=value==='true';}else throw Error('Unknown survey option');}assert.ok(out,'Provide --out=<private report path>');return {options:normalize(o),out};}
module.exports={loadHarness,install,normalize,runSurvey,cli};
if(require.main===module)(async()=>{const {options,out}=cli(process.argv.slice(2)),report=await runSurvey(options,row=>console.log(JSON.stringify({map:row.mapId,side:row.side,seed:row.seed,disabled:row.disabled,plans:Object.keys(row.plans).length,accepted:row.accepted,ready:row.effectReady,followTravel:row.followTravel,followGunDamage:row.followGunDamage,result:row.result})));fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log('Report written: '+out);})().catch(e=>{console.error(e);process.exitCode=1;});
