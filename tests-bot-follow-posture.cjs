const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{pathToFileURL}=require('node:url');
async function main({mutate=(file,s)=>s,measure=false,only=()=>true,initialYaw=0}={}){
 const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8'),urls=new Map();
 function moduleURL(file){
  if(!['bot-tactics.js','bot-team-planner.js'].includes(file))return pathToFileURL(path.join(__dirname,'public',file)).href;
  if(!urls.has(file)){
   let s=mutate(file,read('public/'+file));
   s=s.replace(/from '(.+?)'/g,(_,dep)=>'from '+JSON.stringify(moduleURL(dep.replace('./',''))));
   urls.set(file,'data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
  }return urls.get(file);
 }
 const template=read('tests-nope-decoy-game.cjs'),cut=template.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=template.slice(0,cut).replace('async function main() {','async function main(mutate,loadURL) {')
  .replace("const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);","const load = file => import(loadURL(file.replace('./','')));")
  .replace("source = fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8');","source = mutate('game.js',fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'));");
 const m=new Module(path.join(__dirname,'follow-posture-harness.cjs'),module);m.filename=path.join(__dirname,'follow-posture-harness.cjs');m.paths=module.paths;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);
 const {harness}=await m.exports(mutate,moduleURL),h=harness(),value=code=>{const result=h.run(code);return result===undefined?undefined:JSON.parse(JSON.stringify(result));};
 if(!measure){
  h.run(`var postureTactics=createBotTactics({sites:map.sites,navigation,collision:map.collision}),seenPose={id:'pose-target',team:'red',x:0,y:0,z:18,crouch:.6};postureTactics.observe('blue','witness',seenPose,10);seenPose.crouch=0;`);
  assert.equal(value("postureTactics.contacts('blue',10)[0].crouch"),.6,'copied observed crouch survives hidden posture changes');
  h.run(`var returnedPose=postureTactics.contacts('blue',10);returnedPose[0].crouch=1;`);
  assert.equal(value("postureTactics.contacts('blue',10)[0].crouch"),.6,'returned contact cannot change stored posture');
  assert.equal(value("postureTactics.contacts('red',10).length"),0);
  for(const[n,expected]of[[2,1],[-1,0],[NaN,0],[Infinity,0]]){h.sandbox.invalidCrouch=n;h.run("seenPose.crouch=invalidCrouch;postureTactics.observe('blue','witness',seenPose,10)");assert.equal(value("postureTactics.contacts('blue',10)[0].crouch||0"),expected,'bounded observed crouch');}
  assert.equal(value("postureTactics.contacts('blue',14.01).length"),0);
  const {createBotTeamPlanner}=await import(moduleURL('bot-team-planner.js')),p=createBotTeamPlanner(),contact={id:'target',x:0,y:0,z:18,crouch:.6,seenAt:10};
  const a={now:10,allies:[{id:'caster',team:'blue',x:-3,y:0,z:0,character:'nobi',alive:true,hp:100,ammo:12,ready:true,stock:{c:1}},{id:'follower',team:'blue',x:0,y:0,z:0,alive:true,hp:100,ammo:12,ready:true,stock:{}}],contacts:{blue:[contact],red:[]},spike:{status:'carried'},attackerTeam:'blue'};
  p.update(a);assert.equal(p.snapshot().plans[0].point.crouch,.6,'selected plan copies posture');const state=p.snapshot().plans[0];p.accepted(state.id,{id:'pose-field',type:state.action.type,sourceId:'caster',team:'blue',triggerAt:10.5,endsAt:16},10);contact.crouch=0;
  const effectState=()=>({alive:true,ready:false,endsAt:16});
  p.update({...a,now:10.1,contacts:{blue:[],red:[]},effectState});assert.equal(p.snapshot().plans[0].point.crouch,.6,'hidden posture cannot update saved plan');
  p.update({...a,now:10.2,effectState});assert.equal(p.snapshot().plans[0].point.crouch||0,0,'fresh legitimate standing sight replaces copied crouch');p.reset();assert.equal(p.snapshot().plans.length,0);
 }
 h.run(`var poseSamples=[],poseCasts=[],poseDamage={},normalPoseDamage=damageEntity,normalPoseActivate=activateAbility;
 damageEntity=function(target,amount,source,options){const before=target.hp+target.armor,result=normalPoseDamage(target,amount,source,options);if(target===player){const id=source?.id||source;poseDamage[id]=(poseDamage[id]||0)+Math.max(0,before-target.hp-target.armor);target.hp=100;target.armor=50;}return result;};
 activateAbility=function(actor,key,options){const result=normalPoseActivate(actor,key,options);if(result&&actor.id==='caster')poseCasts.push({at:elapsed,key,type:result.type});return result;};`);
 function setup(scenario){
  h.reset();h.clearWalls();h.run(`syncSmokes([]);match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='other';difficulty='hard';
   Object.assign(player,{team:'red',x:0,y:0,z:18,hp:100,armor:50,alive:true,crouch:0,vx:0,vz:0,vy:0});
   makeBot({x:-8,z:0},0,'blue',{id:'caster',team:'blue',secondary:'classic',armor:50});
   makeBot({x:0,z:0},1,'blue',{id:'near',team:'blue',secondary:'classic',armor:50});
   makeBot({x:8,z:0},2,'blue',{id:'far',team:'blue',secondary:'classic',armor:50});
   var caster=bots[0],near=bots[1],far=bots[2];caster.kit=new DuelistKit({character:'nobi'});caster.kit.smoke=1;caster.kit.updraft=0;caster.kit.dash=0;caster.kit.ultPoints=0;near.kit=null;far.kit=null;
   for(const b of bots){Object.assign(b,{crouch:0,aiWeapon:'classic',aiAmmo:12,aiReserve:36,aiReload:0,fire:0,think:0,target:null,reactionUntil:0,nextSkillAt:0});b.group.rotation.y=b===caster?0:${initialYaw};}
   updateBots.tactics=createBotTactics({sites:map.sites,navigation,collision:map.collision});var normalPoseUpdate=updateBots.tactics.update;
   updateBots.tactics.update=function(input){normalPoseUpdate(input);return{siteId:'A',defuserId:null,roles:new Map(bots.map(b=>[b.id,{goal:{x:b.x,y:0,z:24},watch:{x:0,z:18},role:'escort',siteId:'A'}]))};};
   var rng=3,poseNearCrouch=0;keys.clear();Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);poseSamples=[];poseCasts=[];poseDamage={};`);
  // The real low cover is behind the seven-metre follow stop: both walking
  // lanes stay valid, but the near ally's ray depends on the two postures.
  if(scenario!=='open-duck')h.wall({x:0,z:16,width:.8,depth:.25,height:1.43});
  if(['own-duck','both-duck','open-duck'].includes(scenario))h.run('poseNearCrouch=1;near.crouch=1');
  if(['enemy-duck','both-duck','open-duck'].includes(scenario))h.run("keys.add('ControlLeft');player.crouch=1");
 }
 // Hold a controlled input pose before each real frame. Ordinary bot animation
 // can reset it afterwards; record decision-time visibility separately.
 function step(seconds,hz){Object.assign(h.sandbox,{poseDuration:seconds,poseHz:hz});h.run(`for(let t=0;t<poseDuration-1e-8;t+=1/poseHz){near.crouch=poseNearCrouch;var yaws=bots.map(b=>b.group.rotation.y),poseVisibility=[near,far].map(b=>visibleBetween(b,player));updatePlay(Math.min(1/poseHz,poseDuration-t));var state=updateBots.tactics.skillState();poseSamples.push({at:elapsed,phase:state.plans[0]?.phase||null,follower:state.plans[0]?.follower||null,point:state.plans[0]?.point||null,effect:ordinarySkills.nobiVulnerability(player.id,elapsed,player,ordinaryReachable),near:{x:near.x,z:near.z,crouch:poseNearCrouch,target:near.target?.id||null,intent:near.pathIntent,visible:poseVisibility[0]},far:{x:far.x,z:far.z,crouch:far.crouch,target:far.target?.id||null,intent:far.pathIntent,visible:poseVisibility[1]},maxTurn:Math.max(...bots.map((b,i)=>Math.abs(b.group.rotation.y-yaws[i])))});}`);}
 const playerId=value('player.id'),controls=[];
 for(const hz of[20,60,144])for(const scenario of['own-duck','enemy-duck','both-duck','open-duck','standing','own-prepare','own-flight','own-exploit','enemy-prepare','enemy-flight','enemy-exploit']){
  if(!only(hz,scenario))continue;
  const late=scenario.includes('-prepare')||scenario.includes('-flight')||scenario.includes('-exploit');
  setup(late?'standing':scenario);step(1/hz,hz);
  const before=value('({visibility:poseSamples[0]?[poseSamples[0].near.visible,poseSamples[0].far.visible]:null,state:updateBots.tactics.skillState(),stock:caster.kit.smoke,lanes:[near,far].map(b=>{const d=Math.hypot(b.x-player.x,b.z-player.z),f=(d-7)/d;return navigation.clearSegment(b.x,b.z,b.x+(player.x-b.x)*f,b.z+(player.z-b.z)*f,b.y||0,b.y||0);})})');
  if(late){
   const phase=scenario.split('-')[1];for(let i=0;i<hz*3&&value('updateBots.tactics.skillState().plans[0]?.phase')!==phase;i++)step(1/hz,hz);
   assert.equal(value('updateBots.tactics.skillState().plans[0]?.phase'),phase,'reach actual phase before posture change');
   h.run(scenario.startsWith('own-')?'poseNearCrouch=1;near.crouch=1':"keys.add('ControlLeft');player.crouch=1");
  }
  step(late?1/hz:2.5,hz);
  const after=value('({state:updateBots.tactics.skillState(),stock:caster.kit.smoke,casts:poseCasts,damage:poseDamage,samples:poseSamples,plant:match.spike.plantProgress,defuse:match.spike.defuseProgress})');
  assert.ok(after.samples.every(s=>s.maxTurn<=Math.PI*.8/hz+1e-7),'normal aggregate turn budget');assert.equal(after.plant,0);assert.equal(after.defuse,0);
  const firstFollow=after.samples.find(s=>s.phase==='exploit'),effect=after.samples.find(s=>s.effect>1);
  if(!measure){
   assert.deepEqual(before.lanes,[true,true],'cover must preserve both walking lanes');
   const blocked=['own-duck','enemy-duck','both-duck'].includes(scenario);
   assert.deepEqual(before.visibility,blocked?[false,true]:[true,true]);
   assert.equal(before.state.plans[0]?.follower,blocked?'far':'near','posture selection '+scenario+' '+hz);
   if(late){assert.equal(after.state.plans.length,0,'posture loss releases '+scenario);assert.equal(after.state.history.at(-1)?.outcome,'interrupted');assert.ok(after.casts.length<=1);assert.equal(after.stock+after.casts.length,1);if(!scenario.endsWith('prepare')){assert.equal(after.casts.length,1);assert.equal(after.stock,0);}}
   else{assert.equal(after.casts.length,1);assert.equal(after.stock,0);assert.ok(effect,'real vulnerability');assert.ok(firstFollow,'actual follow');assert.ok(firstFollow.at+1e-8>=effect.at);const id=blocked?'far':'near';assert.ok(after.samples.filter(s=>s.phase==='exploit'&&s[id].visible&&s[id].target===playerId&&s[id].intent==='team-follow').length>0,'visible chosen ally really follows');}
  }
  controls.push({hz,scenario,selected:before.state.plans[0]?.follower||null,visibility:before.visibility,lanes:before.lanes,casts:after.casts,stock:after.stock,firstEffect:effect?.at??null,firstFollow:firstFollow?.at??null,teamFollowFrames:after.samples.filter(s=>s.phase==='exploit'&&s[s.follower].target===playerId&&s[s.follower].visible&&s[s.follower].intent==='team-follow').length,damage:after.damage,plant:after.plant,defuse:after.defuse,history:after.state.history,maxTurn:Math.max(...after.samples.map(s=>s.maxTurn))});
 }
 return{groups:1,controls,frame:'actual updatePlay once per frame',fixture:'three fixed escort allies, stationary target18m, low1.43m cover beyond follow stop; original Nobi C/real shots/armor with HP restored; seed3',limitations:['fixed posture controls and PRNG branching; no ordinary5v5 strength or personal objective gain proof','no browser/device/audio or GPU performance verification']};
}
module.exports=main;if(require.main===module)main().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
