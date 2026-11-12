const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{pathToFileURL}=require('node:url');
async function main({mutate=(file,s)=>s,measure=false,pure=true,only=()=>true}={}){
 const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8'),urls=new Map();
 function moduleURL(file){
  if(!['bot-tactics.js','bot-team-planner.js'].includes(file))return pathToFileURL(path.join(__dirname,'public',file)).href;
  if(!urls.has(file)){let s=mutate(file,read('public/'+file));s=s.replace(/from '(.+?)'/g,(_,dep)=>'from '+JSON.stringify(moduleURL(dep.replace('./',''))));urls.set(file,'data:text/javascript;base64,'+Buffer.from(s).toString('base64'));}return urls.get(file);
 }
 const template=read('tests-nope-decoy-game.cjs'),cut=template.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=template.slice(0,cut).replace('async function main() {','async function main(loadURL) {').replace("const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);","const load = file => import(loadURL(file.replace('./','')));");
 const m=new Module(path.join(__dirname,'follow-retirement-harness.cjs'),module);m.filename=path.join(__dirname,'follow-retirement-harness.cjs');m.paths=module.paths;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);
 const {harness}=await m.exports(moduleURL),h=harness(),value=code=>{const r=h.run(code);return r===undefined?undefined:JSON.parse(JSON.stringify(r));};
 let groups=0;
 if(!measure&&pure){
  const {createBotTeamPlanner}=await import(moduleURL('bot-team-planner.js'));
  const actor=(id,x=0)=>({id,team:'blue',x,y:0,z:0,alive:true,hp:100,ammo:12,ready:true,character:id==='caster'?'nobi':'duelist',stock:{c:id==='caster'?1:0},role:'escort'});
  for(const phase of['prepare','flight','exploit'])for(const retired of[true,false]){
   const p=createBotTeamPlanner(),a={now:10,allies:[actor('caster',-3),actor('follower')],contacts:{blue:[{id:'target',team:'red',x:0,y:0,z:18,seenAt:10}],red:[]},spike:{status:'carried'},attackerTeam:'blue'};
   p.update(a);const s=p.snapshot().plans[0],event={id:'field',type:s.action.type,sourceId:s.caster,team:'blue',triggerAt:10.5,endsAt:16},effectState=()=>({alive:true,ready:phase==='exploit',endsAt:16});
   if(phase!=='prepare')p.accepted(s.id,event,10.1);if(phase==='exploit')p.update({...a,now:10.6,effectState});
   const orders=p.update({...a,now:10.7,retiredTargetIds:retired?['target']:['other'],effectState});
   if(retired){assert.equal(orders.size,0,'confirmed target death retires '+phase);assert.equal(p.snapshot().history.at(-1).outcome,'target-retired');assert.equal(p.update({...a,now:10.8,effectState}).size,0,'existing cooldown');}
   else assert.ok(orders.size>0,'unrelated death retains '+phase);
   assert.equal(event.triggerAt,10.5);assert.equal(event.endsAt,16);
  }
  const p=createBotTeamPlanner(),a={now:10,allies:[actor('caster',-3),actor('follower')],contacts:{blue:[{id:'target',team:'red',x:0,y:0,z:18,seenAt:10}],red:[]},spike:{status:'carried'},attackerTeam:'blue',retiredTargetIds:['target']};
  assert.equal(p.update(a).size,0,'retired stale contact cannot start a plan');a.retiredTargetIds=[];a.now=10.3;a.contacts.blue[0].seenAt=10.3;assert.ok(p.update(a).size>0,'living target with fresh legitimate sight can be planned again');p.reset();assert.equal(p.snapshot().plans.length,0);
  groups++;
  // Use the real tactics wrapper and the existing roster-death input. A retired
  // actor's coordinates throw if read, to isolate public status from hidden pose.
  h.run(`var retirementTactics=createBotTactics({sites:map.sites,navigation,collision:map.collision}),retirementArgs={now:10,attackerTeam:'blue',defenderTeam:'red',spike:{status:'carried',carrier:'other'},remaining:90},retirementAllies=[{id:'caster',team:'blue',x:-3,y:0,z:0,alive:true,hp:100,ammo:12,ready:true,character:'nobi',stock:{c:1},role:'escort'},{id:'follower',team:'blue',x:0,y:0,z:0,alive:true,hp:100,ammo:12,ready:true,character:'duelist',stock:{},role:'escort'}],retirementEnemy={id:'target',team:'red',x:0,y:0,z:18,alive:true};retirementTactics.observe('blue','caster',retirementEnemy,10);retirementTactics.update({...retirementArgs,actors:[...retirementAllies,retirementEnemy]});retirementTactics.skillPlan({...retirementArgs,allies:retirementAllies});var retiredPlan=retirementTactics.skillState().plans[0];retirementTactics.skillAccepted(retiredPlan.id,{id:'field',type:retiredPlan.action.type,sourceId:'caster',team:'blue',triggerAt:10.5,endsAt:16},10.1);`);
  // Absence and lost sightings are not death. Keep the copied point finite.
  h.run(`retirementTactics.update({...retirementArgs,now:10.2,actors:retirementAllies});retirementTactics.skillPlan({...retirementArgs,now:10.2,allies:retirementAllies,effectState:()=>({alive:true,ready:false,endsAt:16})});`);
  assert.equal(value('retirementTactics.skillState().plans[0]?.phase'),'flight','missing actor is not a confirmed death');
  h.run(`var retiredActor={id:'target',team:'red',alive:false};for(const key of['x','y','z','crouch'])Object.defineProperty(retiredActor,key,{get(){throw Error('hidden retired pose');}});retirementTactics.update({...retirementArgs,now:10.3,actors:[...retirementAllies,retiredActor]});retirementTactics.skillPlan({...retirementArgs,now:10.3,allies:retirementAllies,effectState:()=>({alive:true,ready:true,endsAt:16})});`);
  assert.equal(value('retirementTactics.skillState().plans.length'),0,'tactics forwards confirmed death IDs');
  assert.equal(value("retirementTactics.contacts('blue',10.3)[0].z"),18,'ordinary cached intel remains a frozen point until its next purge');
  h.run(`retirementTactics.update({...retirementArgs,now:13.4,actors:[...retirementAllies,retirementEnemy]});retirementTactics.observe('blue','caster',retirementEnemy,13.4);retirementTactics.skillPlan({...retirementArgs,now:13.4,allies:retirementAllies});`);
  assert.equal(value('retirementTactics.skillState().plans[0]?.targetId'),'target','confirmed living roster clears retirement for fresh sightings after cooldown');
  h.run(`retirementTactics.reset(2);retirementTactics.observe('blue','caster',retirementEnemy,20);retirementTactics.update({...retirementArgs,now:20,actors:[...retirementAllies,retirementEnemy]});retirementTactics.skillPlan({...retirementArgs,now:20,allies:retirementAllies});`);
  assert.equal(value('retirementTactics.skillState().plans[0]?.targetId'),'target','new round clears retirement IDs');groups++;
 }
 h.run(`var retireSamples=[],retireCasts=[],retireDamage={},retireForced=false,normalRetireDamage=damageEntity,normalRetireActivate=activateAbility;
 damageEntity=function(target,amount,source,options){const before=target.hp+target.armor,result=normalRetireDamage(target,amount,source,options);if(target===player&&!retireForced){const id=source?.id||source;retireDamage[id]=(retireDamage[id]||0)+Math.max(0,before-target.hp-target.armor);if(target.alive){target.hp=100;target.armor=50;}}return result;};
 activateAbility=function(actor,key,options){const r=normalRetireActivate(actor,key,options);if(r&&actor.id==='caster')retireCasts.push({at:elapsed,key,type:r.type});return r;};`);
 function setup(){h.reset();h.clearWalls();h.run(`syncSmokes([]);match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='other';difficulty='hard';
 Object.assign(player,{team:'red',x:0,y:0,z:18,hp:100,armor:50,alive:true,crouch:0,vx:0,vz:0,vy:0});
 makeBot({x:-3,z:0},0,'blue',{id:'caster',team:'blue',secondary:'classic',armor:50});makeBot({x:0,z:0},1,'blue',{id:'follower',team:'blue',secondary:'classic',armor:50});makeBot({x:70,z:70},2,'red',{id:'guard',team:'red',secondary:'classic',armor:50});
 var caster=bots[0],follower=bots[1],guard=bots[2];caster.kit=new DuelistKit({character:'nobi'});caster.kit.smoke=1;caster.kit.updraft=0;caster.kit.dash=0;caster.kit.ultPoints=0;follower.kit=null;guard.kit=null;
 for(const b of bots){Object.assign(b,{aiWeapon:'classic',aiAmmo:12,aiReserve:36,aiReload:0,fire:0,think:0,target:null,reactionUntil:0,nextSkillAt:0});b.group.rotation.y=0;}
 updateBots.tactics=createBotTactics({sites:map.sites,navigation,collision:map.collision});var normalRetireUpdate=updateBots.tactics.update;updateBots.tactics.update=function(input){normalRetireUpdate(input);return{siteId:'A',defuserId:null,roles:new Map(bots.map(b=>[b.id,{goal:{x:b.x,y:0,z:24},watch:{x:0,z:18},role:'escort',siteId:'A'}]))};};
 var rng=3;Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);retireSamples=[];retireCasts=[];retireDamage={};retireForced=false;`);h.wall({x:70,z:65,width:20,depth:2,height:4});}
 function step(seconds,hz){Object.assign(h.sandbox,{retireSeconds:seconds,retireHz:hz});h.run(`for(let t=0;t<retireSeconds-1e-8;t+=1/retireHz){var yaws=bots.map(b=>b.group.rotation.y);updatePlay(Math.min(1/retireHz,retireSeconds-t));var state=updateBots.tactics.skillState();retireSamples.push({at:elapsed,phase:state.plans[0]?.phase||null,effect:ordinarySkills.nobiVulnerability(player.id,elapsed,player,ordinaryReachable),alive:player.alive,follower:{x:follower.x,z:follower.z,intent:follower.pathIntent,target:follower.target?.id||null},maxTurn:Math.max(...bots.map((b,i)=>Math.abs(b.group.rotation.y-yaws[i])))});}`);}
 const controls=[];
 for(const hz of[20,60,144])for(const phase of['prepare','flight','exploit'])for(const retired of[true,false]){
  if(!only(hz,phase,retired))continue;setup();step(1/hz,hz);for(let i=0;i<hz*3&&value('updateBots.tactics.skillState().plans[0]?.phase')!==phase;i++)step(1/hz,hz);
  assert.equal(value('updateBots.tactics.skillState().plans[0]?.phase'),phase,'reach actual phase '+phase);
  const before=value('({state:updateBots.tactics.skillState(),stock:caster.kit.smoke,casts:retireCasts,field:ordinarySkills.events(elapsed).filter(e=>e.sourceId===caster.id),alive:player.alive})');
  if(retired)h.run(`retireForced=true;damageEntity(player,1000,caster);retireForced=false;`);
  step(1/hz,hz);
  const after=value('({state:updateBots.tactics.skillState(),stock:caster.kit.smoke,casts:retireCasts,field:ordinarySkills.events(elapsed).filter(e=>e.sourceId===caster.id),alive:player.alive,damage:retireDamage,samples:retireSamples,phase:match.phase,plant:match.spike.plantProgress,defuse:match.spike.defuseProgress})');
  assert.equal(after.phase,'live','other enemy keeps the real round live');assert.equal(after.alive,!retired);assert.ok(after.samples.every(s=>s.maxTurn<=Math.PI*.8/hz+1e-7));assert.equal(after.plant,0);assert.equal(after.defuse,0);
  if(!measure){if(retired){assert.equal(after.state.plans.length,0,'actual death releases '+phase);assert.equal(after.state.history.at(-1)?.outcome,'target-retired');}else assert.equal(after.state.plans[0]?.phase,phase,'living target retains '+phase);assert.equal(after.casts.length,before.casts.length,'retirement never adds a cast');assert.equal(after.stock,before.stock,'retirement never refunds or spends stock');assert.deepEqual(after.field.map(e=>e.id),before.field.map(e=>e.id),'accepted fields remain');}
  controls.push({hz,phase,retired,before:{plans:before.state.plans,casts:before.casts,stock:before.stock},after:{plans:after.state.plans,history:after.state.history,casts:after.casts,stock:after.stock},damage:after.damage,plant:after.plant,defuse:after.defuse,maxTurn:Math.max(...after.samples.map(s=>s.maxTurn)),live:after.phase});
 }
 groups++;return{groups,controls,frame:'actual updatePlay once per frame',fixture:'two fixed allied escort roles, stationary enemy18m and distant surviving red guard; actual lethal damage at controlled phase, original Nobi C/real shots/armor with HP restored only for living non-forced hits; seed3',limitations:['controlled elimination timing, fixed roles and PRNG branching; no ordinary5v5 win-rate/damage/personal objective improvement proof','no hidden pose access, new perception, balance or revive changes','no browser/device/audio/GPU performance verification']};
}
module.exports=main;if(require.main===module)main().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
