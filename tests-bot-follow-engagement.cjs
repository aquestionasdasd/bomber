const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{pathToFileURL}=require('node:url');
async function main({mutatePlanner=s=>s,measure=false,pure=true,only=()=>true}={}){
 const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
 const planner=mutatePlanner(read('public/bot-team-planner.js')).replace("'./abilities.js'",JSON.stringify(pathToFileURL(path.join(__dirname,'public/abilities.js')).href));
 const plannerURL='data:text/javascript;base64,'+Buffer.from(planner).toString('base64');
 const tactics=read('public/bot-tactics.js').replace("'./bot-team-planner.js'",JSON.stringify(plannerURL)).replace("'./navigation.js'",JSON.stringify(pathToFileURL(path.join(__dirname,'public/navigation.js')).href));
 const tacticsURL='data:text/javascript;base64,'+Buffer.from(tactics).toString('base64');
 const load=file=>file==='bot-team-planner.js'?plannerURL:file==='bot-tactics.js'?tacticsURL:pathToFileURL(path.join(__dirname,'public',file)).href;
 let groups=0;
 if(pure&&!measure){
  const {createBotTeamPlanner}=await import(plannerURL),actor=(id,x,engagedTargetId=null)=>({id,team:'blue',x,y:0,z:0,alive:true,hp:100,ammo:12,ready:true,character:id==='caster'?'urchin':'duelist',stock:{e:id==='caster'?1:0},role:'escort',engagedTargetId});
  for(const scenario of['far-ready','near-ready','both-ready','neither-ready','far-busy','far-other','far-unsafe']){
   const p=createBotTeamPlanner(),near=actor('near',3,['near-ready','both-ready'].includes(scenario)?'target':null),far=actor('far',8,['neither-ready','near-ready'].includes(scenario)?null:'target');
   if(scenario==='far-busy')far.busy=true;if(scenario==='far-other')far.engagedTargetId='different';
   const a={now:10,allies:[actor('caster',0,'target'),near,far],contacts:{blue:[{id:'target',team:'red',x:0,y:0,z:18,seenAt:10}],red:[]},spike:{status:'carried'},attackerTeam:'blue',canFollow:b=>scenario!=='far-unsafe'||b.id!=='far'};
   p.update(a);assert.equal(p.snapshot().plans[0]?.follower,scenario==='far-ready'?'far':'near','current target preference and distance/eligibility fallback '+scenario);
   const state=p.snapshot().plans[0];p.accepted(state.id,{id:'field',type:state.action.type,sourceId:'caster',team:'blue',triggerAt:10.5,endsAt:14},10.1);
   const orders=p.update({...a,now:10.6,effectState:()=>({alive:true,ready:true,endsAt:14})});assert.equal(orders.get(state.follower)?.kind,'follow','normal accepted effect sequence');
  }
  groups++;
 }
 const template=read('tests-nope-decoy-game.cjs'),cut=template.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=template.slice(0,cut).replace('async function main() {','async function main(loadURL) {').replace("const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);","const load = file => import(loadURL(file.replace('./','')));");
 const m=new Module(path.join(__dirname,'follow-engagement-harness.cjs'),module);m.filename=path.join(__dirname,'follow-engagement-harness.cjs');m.paths=module.paths;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);
 const {harness}=await m.exports(load),h=harness(),value=code=>{const v=h.run(code);return v===undefined?undefined:JSON.parse(JSON.stringify(v));};
 h.run(`var engagementSamples=[],engagementCasts=[],engagementDamage={},normalEngagementDamage=damageEntity,normalEngagementActivate=activateAbility;
 damageEntity=function(target,amount,source,options){const before=target.hp+target.armor,result=normalEngagementDamage(target,amount,source,options);if(target===player){const id=source?.id||source;engagementDamage[id]=(engagementDamage[id]||0)+Math.max(0,before-target.hp-target.armor);target.hp=100;target.armor=50;}return result;};
 activateAbility=function(actor,key,options){const result=normalEngagementActivate(actor,key,options);if(result&&actor.id==='caster')engagementCasts.push({at:elapsed,key,type:result.type});return result;};`);
 function setup(scenario){h.reset();h.clearWalls();h.run(`syncSmokes([]);match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='other';difficulty='hard';
 Object.assign(player,{team:'red',x:0,y:0,z:18,hp:100,armor:50,alive:true,crouch:0,vx:0,vz:0,vy:0});
 makeBot({x:0,z:0},0,'blue',{id:'caster',team:'blue',secondary:'classic',armor:50});makeBot({x:3,z:0},1,'blue',{id:'near',team:'blue',secondary:'classic',armor:50});makeBot({x:8,z:0},2,'blue',{id:'far',team:'blue',secondary:'classic',armor:50});
 var caster=bots[0],near=bots[1],far=bots[2];caster.kit=new DuelistKit({character:'urchin'});caster.kit.smoke=0;caster.kit.updraft=0;caster.kit.dash=1;caster.kit.ultPoints=0;near.kit=null;far.kit=null;
 for(const b of bots){Object.assign(b,{aiWeapon:'classic',aiAmmo:12,aiReserve:36,aiReload:0,fire:0,think:0,target:null,reactionUntil:0,nextSkillAt:0});b.group.rotation.y=Math.atan2(-b.x,18);}
 updateBots.tactics=createBotTactics({sites:map.sites,navigation,collision:map.collision});var normalEngagementUpdate=updateBots.tactics.update;
 updateBots.tactics.update=function(input){normalEngagementUpdate(input);return{siteId:'A',defuserId:null,roles:new Map(bots.map(b=>[b.id,{goal:{x:b.x,y:0,z:24},watch:{x:0,z:18},role:'escort',siteId:'A'}]))};};
 var rng=3;Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);engagementSamples=[];engagementCasts=[];engagementDamage={};`);
 if(['far-ready','neither-ready'].includes(scenario))h.run('near.group.rotation.y=Math.PI;');
 if(['near-ready','neither-ready'].includes(scenario))h.run('far.group.rotation.y=Math.PI;');}
 function step(seconds,hz){Object.assign(h.sandbox,{engagementDuration:seconds,engagementHz:hz});h.run(`for(let t=0;t<engagementDuration-1e-8;t+=1/engagementHz){var yaws=bots.map(b=>b.group.rotation.y);updatePlay(Math.min(1/engagementHz,engagementDuration-t));var state=updateBots.tactics.skillState();engagementSamples.push({at:elapsed,phase:state.plans[0]?.phase||null,follower:state.plans[0]?.follower||null,effect:ordinarySkills.nearsightUntil(player.id,elapsed)>elapsed,near:{x:near.x,z:near.z,moving:near.moving,target:near.target?.id||null,intent:near.pathIntent},far:{x:far.x,z:far.z,moving:far.moving,target:far.target?.id||null,intent:far.pathIntent},maxTurn:Math.max(...bots.map((b,i)=>Math.abs(b.group.rotation.y-yaws[i])))});}`);}
 const controls=[],playerId=value('player.id');
 for(const hz of[20,60,144])for(const scenario of['far-ready','near-ready','both-ready','neither-ready']){
  if(!only(hz,scenario))continue;setup(scenario);step(1/hz,hz);const before=value('({state:updateBots.tactics.skillState(),targets:[near.target?.id||null,far.target?.id||null]})');step(2.1,hz);
  const after=value('({state:updateBots.tactics.skillState(),casts:engagementCasts,stock:caster.kit.dash,damage:engagementDamage,samples:engagementSamples,plant:match.spike.plantProgress,defuse:match.spike.defuseProgress})');
  const chosen=before.state.plans[0]?.follower,firstEffect=after.samples.find(s=>s.effect),firstAdvance=after.samples.find(s=>s.phase==='exploit'&&s[s.follower]?.moving&&s[s.follower].target===playerId&&s[s.follower].intent==='team-follow');
  assert.ok(after.samples.every(s=>s.maxTurn<=Math.PI*.8/hz+1e-7));assert.equal(after.plant,0);assert.equal(after.defuse,0);
  if(!measure){assert.equal(chosen,scenario==='far-ready'?'far':'near','actual current target preference '+scenario+' '+hz);assert.deepEqual(before.targets,scenario==='far-ready'?[null,playerId]:scenario==='near-ready'?[playerId,null]:scenario==='both-ready'?[playerId,playerId]:[null,null]);assert.equal(after.casts.length,1);assert.equal(after.stock,0);assert.ok(firstEffect,'real wave effect');assert.ok(firstAdvance,'chosen follower actually advances');assert.ok(firstAdvance.at+1e-8>=firstEffect.at,'no early followup');const displacement=Math.hypot(after.samples.at(-1)[chosen].x-firstAdvance[chosen].x,after.samples.at(-1)[chosen].z-firstAdvance[chosen].z);assert.ok(displacement>0,'real chosen follower displacement');if(scenario==='neither-ready')assert.ok(firstAdvance.at>firstEffect.at,'unacquired followers retain normal perception and turn delay');else{assert.ok(displacement>1,'already engaged follower advances over one metre');assert.equal(firstAdvance.at,firstEffect.at,'already engaged follower advances on actual effect frame');}}
  controls.push({hz,scenario,selected:chosen,targets:before.targets,casts:after.casts,stock:after.stock,firstEffect:firstEffect?.at??null,firstAdvance:firstAdvance?.at??null,delay:firstAdvance&&firstEffect?firstAdvance.at-firstEffect.at:null,followDistance:firstAdvance?Math.hypot(after.samples.at(-1)[chosen].x-firstAdvance[chosen].x,after.samples.at(-1)[chosen].z-firstAdvance[chosen].z):0,teamFollowFrames:after.samples.filter(s=>s.phase==='exploit'&&s[s.follower]?.target===playerId&&s[s.follower].intent==='team-follow').length,damage:after.damage,plant:after.plant,defuse:after.defuse,maxTurn:Math.max(...after.samples.map(s=>s.maxTurn)),history:after.state.history});
 }
 groups++;return{groups,controls,frame:'actual updatePlay once per frame',fixture:'three fixed allied escort roles, stationary enemy18m, initial view directions and seed3, original Urchin E and real shots/armor with HP restored after hits',limitations:['fixed poses/roles/PRNG branching; no ordinary5v5 win-rate/damage/personal objective gain proof','only current legitimate allied engagement IDs, no hidden poses or reaction/turning bypass','no GPU/browser/device/audio or game-performance verification']};
}
module.exports=main;if(require.main===module)main().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
