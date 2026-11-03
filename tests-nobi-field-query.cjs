const assert=require('node:assert/strict');
async function main(){
 const {createCharacterSkills}=await import('./public/character-skills.js');
 const h=createCharacterSkills(),source={id:'source',team:'blue',x:0,y:0,z:0,hp:100,alive:true},enemy={...source,id:'enemy',team:'red',x:10},friend={...source,id:'friend',x:10},types=['nobi-bell','nobi-whisker','nobi-toolbox','nobi-collar'],point={x:10,y:.12,z:0},yes=()=>true;let groups=0;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);};
 test('forecast and armed effects share all4 team subsets without mutating events',()=>{
  for(const type of types){h.reset();const event={type,team:'blue',...point,radius:20},before=h.snapshot();
   for(const actor of[source,friend,enemy])assert.equal(h.wouldNobi(actor,event,{reachable:yes}),['nobi-bell','nobi-whisker'].includes(type)?actor.team==='red':actor.team==='blue');
   assert.deepEqual(h.snapshot(),before);assert.ok(h.cast(type,source,point,1,1));
   for(const actor of[source,friend,enemy]){const query=type==='nobi-bell'?'nobiVulnerability':type==='nobi-whisker'?'nobiInterval':type==='nobi-toolbox'?'nobiWork':'nobiLegend';assert.equal(Boolean(type==='nobi-collar'?h[query](actor.id,2,actor,yes):h[query](actor.id,2,actor,yes)>1),h.wouldNobi(actor,event,{reachable:yes}));}
  }
 });
 test('real20m sphere includes horizontal and vertical boundary with floor offset',()=>{
  const event={type:'nobi-bell',team:'blue',...point,radius:20};
  for(const pose of[{x:30},{x:10,y:20},{x:10,z:20}])assert.equal(h.wouldNobi({...enemy,...pose},event,{reachable:yes}),true);
  for(const pose of[{x:30.01},{x:10,y:20.01},{x:10,z:20.01},{x:25,y:15}])assert.equal(h.wouldNobi({...enemy,...pose},event,{reachable:yes}),false);
 });
 test('walls smoke missing or throwing LOS and dead actors fail closed',()=>{
  const event={type:'nobi-bell',team:'blue',...point,radius:20};
  assert.equal(h.wouldNobi(enemy,event),false);for(const reachable of[()=>false,()=>{throw Error('blocked')}])assert.equal(h.wouldNobi(enemy,event,{reachable}),false);
  assert.equal(h.wouldNobi({...enemy,alive:false,hp:0},event,{reachable:yes}),false);assert.equal(h.wouldNobi(enemy,{...event,type:'nope-glint'},{reachable:yes}),false);
 });
 console.log(`PASS: ${groups} shared Nobi field forecast groups; silent`);return groups;
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
