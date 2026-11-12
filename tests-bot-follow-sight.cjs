const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{pathToFileURL}=require('node:url');
async function main({mutateGame=s=>s,measure=false}={}){
 let groups=0;
 const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
 const template=read('tests-nope-decoy-game.cjs'),cut=template.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=template.slice(0,cut).replace('async function main() {','async function main(mutateGame=s=>s) {').replace("source = fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8');","source = mutateGame(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'));");
 const m=new Module(path.join(__dirname,'follow-lane-harness.cjs'),module);m.filename=path.join(__dirname,'follow-lane-harness.cjs');m.paths=module.paths;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);
 const {harness}=await m.exports(mutateGame),h=harness(),value=code=>JSON.parse(JSON.stringify(h.run(code)));
 h.run(`var laneSamples=[],laneCasts=[],laneDamage={},originalLaneDamage=damageEntity,originalLaneActivate=activateAbility;
  damageEntity=function(target,amount,source,options){const before=target.hp+target.armor,result=originalLaneDamage(target,amount,source,options);if(target===player){const id=source?.id||source;laneDamage[id]=(laneDamage[id]||0)+Math.max(0,before-target.hp-target.armor);target.hp=100;target.armor=50;}return result;};
  activateAbility=function(actor,key,options){const result=originalLaneActivate(actor,key,options);if(result&&actor.id==='caster')laneCasts.push({at:elapsed,key,type:result.type});return result;};`);
 function setup(scenario){
  h.reset();h.clearWalls();h.run(`syncSmokes([]);match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='other';difficulty='hard';
   Object.assign(player,{team:'red',x:0,y:0,z:18,hp:100,armor:50,alive:true,vx:0,vz:0,vy:0});
   makeBot({x:-8,z:0},0,'blue',{id:'caster',team:'blue',secondary:'classic',armor:50});
   makeBot({x:0,z:0},1,'blue',{id:'near',team:'blue',secondary:'classic',armor:50});
   makeBot({x:8,z:0},2,'blue',{id:'far',team:'blue',secondary:'classic',armor:50});
   var caster=bots[0],near=bots[1],far=bots[2];caster.kit=new DuelistKit({character:'nobi'});caster.kit.smoke=1;caster.kit.updraft=0;caster.kit.dash=0;caster.kit.ultPoints=0;near.kit=null;far.kit=null;
   for(const b of bots){Object.assign(b,{aiWeapon:'classic',aiAmmo:12,aiReserve:36,aiReload:0,fire:0,think:0,target:null,reactionUntil:0,nextSkillAt:0});b.group.rotation.y=0;}
   updateBots.tactics=createBotTactics({sites:map.sites,navigation,collision:map.collision});var originalLaneUpdate=updateBots.tactics.update;
   updateBots.tactics.update=function(input){originalLaneUpdate(input);return{siteId:'A',defuserId:null,roles:new Map(bots.map(b=>[b.id,{goal:{x:b.x,y:0,z:24},watch:{x:0,z:18},role:'escort',siteId:'A'}]))};};
   var rng=3;Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);laneSamples=[];laneCasts=[];laneDamage={};`);
  // A real existing smoke blocks eye sight while leaving walking lanes clear.
  if(scenario!=='clear')h.run(`syncSmokes([...serializeSmokes(),{id:++smokeSequence,x:0,y:1.7,z:3,radius:3.6,expires:elapsed+8}]);`);
  if(scenario==='all-blocked')h.run(`syncSmokes([...serializeSmokes(),{id:++smokeSequence,x:6.67,y:1.7,z:3,radius:3.6,expires:elapsed+8}]);`);
 }
 function step(seconds,hz){Object.assign(h.sandbox,{laneDuration:seconds,laneHz:hz});h.run(`for(let t=0;t<laneDuration-1e-8;t+=1/laneHz){var yaws=bots.map(b=>b.group.rotation.y);updatePlay(Math.min(1/laneHz,laneDuration-t));var state=updateBots.tactics.skillState();laneSamples.push({at:elapsed,phase:state.plans[0]?.phase||null,follower:state.plans[0]?.follower||null,effect:ordinarySkills.nobiVulnerability(player.id,elapsed,player,ordinaryReachable),near:{x:near.x,z:near.z,target:near.target?.id||null,intent:near.pathIntent,visible:visibleBetween(near,player)},far:{x:far.x,z:far.z,target:far.target?.id||null,intent:far.pathIntent,visible:visibleBetween(far,player)},maxTurn:Math.max(...bots.map((b,i)=>Math.abs(b.group.rotation.y-yaws[i])))});}`);}
 const playerId=value('player.id'),controls=[];
 for(const hz of[20,60,144])for(const scenario of['near-blocked','clear','all-blocked','smoke-appears','smoke-in-flight','smoke-in-exploit']){
  const late=scenario.startsWith('smoke-');
  setup(late?'clear':scenario);step(1/hz,hz);
  const before=value('({visibility:[near,far].map(b=>visibleBetween(b,player)),state:updateBots.tactics.skillState(),stock:caster.kit.smoke,targets:bots.map(b=>b.target?.id||null),lanes:[near,far].map(b=>{const d=Math.hypot(b.x-player.x,b.z-player.z),f=(d-7)/d;return navigation.clearSegment(b.x,b.z,b.x+(player.x-b.x)*f,b.z+(player.z-b.z)*f,b.y||0,b.y||0);})})');
  if(late){
   const phase=scenario==='smoke-in-flight'?'flight':scenario==='smoke-in-exploit'?'exploit':'prepare';
   for(let i=0;i<hz*3&&value('updateBots.tactics.skillState().plans[0]?.phase')!==phase;i++)step(1/hz,hz);
   assert.equal(value('updateBots.tactics.skillState().plans[0]?.phase'),phase,'reach actual phase before smoke');
   h.run(`syncSmokes([...serializeSmokes(),{id:++smokeSequence,x:near.x,y:1.7,z:near.z+3,radius:3.6,expires:elapsed+8}]);`);
  }
  step(late?1/hz:2.5,hz);
  const after=value('({state:updateBots.tactics.skillState(),stock:caster.kit.smoke,casts:laneCasts,damage:laneDamage,samples:laneSamples,plant:match.spike.plantProgress,defuse:match.spike.defuseProgress})');
  assert.ok(after.samples.every(s=>s.maxTurn<=Math.PI*.8/hz+1e-7),'normal aggregate turn budget');assert.equal(after.plant,0);assert.equal(after.defuse,0);
  const firstFollow=after.samples.find(s=>s.phase==='exploit'),effect=after.samples.find(s=>s.effect>1);
  if(!measure){
   assert.deepEqual(before.lanes,[true,true],'smoke must not block walking');
   assert.deepEqual(before.visibility,scenario==='near-blocked'?[false,true]:scenario==='all-blocked'?[false,false]:[true,true]);
   assert.equal(before.state.plans[0]?.follower,scenario==='near-blocked'?'far':scenario==='all-blocked'?undefined:'near','reachable selection '+scenario+' '+hz);
   if(scenario==='near-blocked'||scenario==='clear'){
    assert.equal(after.casts.length,1);assert.equal(after.stock,0);assert.ok(effect,'real vulnerability applied');assert.ok(firstFollow,'actual followup');assert.ok(firstFollow.at+1e-8>=effect.at,'no follow before real effect');
    const id=scenario==='near-blocked'?'far':'near';assert.ok(after.samples.at(-1)[id].z-firstFollow[id].z>2,'chosen ally actually advances');
   }else if(late){
    assert.equal(after.state.plans.length,0);assert.equal(after.state.history.at(-1)?.outcome,'interrupted');
    // Releasing preparation can restore one ordinary real cast; accepting a
    // field never refunds it or creates an extra use after sight is lost.
    assert.ok(after.casts.length<=1);assert.equal(after.stock+after.casts.length,1);
    if(scenario!=='smoke-appears'){assert.equal(after.casts.length,1);assert.equal(after.stock,0);}
   }else assert.equal(firstFollow,undefined,'all blocked reserves nobody');
  }
  controls.push({hz,scenario,selected:before.state.plans[0]?.follower||null,lanes:before.lanes,visibility:before.visibility,casts:after.casts,stock:after.stock,firstEffect:effect?.at??null,firstFollow:firstFollow?.at??null,followDistance:firstFollow?Math.hypot(after.samples.at(-1)[firstFollow.follower].x-firstFollow[firstFollow.follower].x,after.samples.at(-1)[firstFollow.follower].z-firstFollow[firstFollow.follower].z):0,teamFollowFrames:after.samples.filter(s=>s.phase==='exploit'&&s[s.follower].target===playerId&&s[s.follower].visible&&s[s.follower].intent==='team-follow').length,damage:after.damage,plant:after.plant,defuse:after.defuse,history:after.state.history,maxTurn:Math.max(...after.samples.map(s=>s.maxTurn))});
 }
 groups++;console.log('PASS: actual smoke-aware follower selection and interrupted preparation at20/60/144Hz');
 return{groups,controls,frame:'actual updatePlay once per frame',fixture:'three allied fixed escort roles, stationary target18m, real smoke blocks eye sight but preserves walking; real shots/armor and HP restored after hits',limitations:['controlled layout and PRNG branching; no ordinary5v5 win-rate or personal objective improvement proof','direct existing movement lane only; no new route search','no browser/device/audio confirmation']};
}
module.exports=main;if(require.main===module)main().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
