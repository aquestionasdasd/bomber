const assert=require('node:assert/strict');
async function main(){
 const {DuelistKit,CHARACTER_DEFS,getCharacterSkill,NOBI_SKILLS}=await import('./public/abilities.js');
 const {createCharacterSkills}=await import('./public/character-skills.js');
 const THREE=await import('./public/vendor/three.module.js'),{createAgentModel}=await import('./public/agent-model.js'),{createNobiSkillFX}=await import('./public/nobi-skill-fx.js');
 const a={id:'nobi',team:'blue',x:0,y:0,z:0,hp:100,alive:true},b={...a,id:'enemy',team:'red',z:-10},copy=x=>JSON.parse(JSON.stringify(x));let groups=0;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);};
 test('eleventh stable identity, finite purchase,18s E and7pt independent X',()=>{
  assert.equal(Object.keys(CHARACTER_DEFS).length,12);assert.equal(CHARACTER_DEFS.nobi.label,'のび');const k=new DuelistKit({character:'nobi'});let cost=0;
  for(const key of['c','c','q'])assert.ok(k.buy(key,n=>(cost+=n,true)));assert.equal(cost,300);assert.equal(k.buy('q',()=>true),false);
  for(const key of['c','q','e'])assert.equal(k.activate(key,1).type,getCharacterSkill('nobi',key).type);assert.equal(k.activate('e',18.99),null);assert.ok(k.activate('e',19));assert.equal(k.activate('x',20),null);k.ultPoints=7;assert.equal(k.activate('x',20).type,'nobi-legend');assert.equal(k.ultPoints,0);assert.equal(k.knivesActive,false);const restored=new DuelistKit();assert.ok(restored.restore(copy(k.snapshot())));assert.deepEqual(restored.snapshot(),k.snapshot());
 });
 test('four strict JSON events, finite range and no self target/extra fields/timing forgery',()=>{
  const h=createCharacterSkills();for(const type of['nobi-tag','nobi-brake','nobi-tool','nobi-legend'])assert.ok(h.cast(type,a,type==='nobi-tag'||type==='nobi-brake'?{...b,targetId:b.id}:a,1,1));const state=copy(h.snapshot()),g=createCharacterSkills();assert.ok(g.restore(state,1,1));
  for(const mutate of[s=>s.events[0].targetId=a.id,s=>s.events[1].power=1,s=>s.events[2].endsAt=99,s=>s.events[3].x=1,s=>s.events[0].targetId='']){const bad=copy(state);mutate(bad);assert.equal(g.restore(bad,1,1),false);assert.deepEqual(g.snapshot(),state);}
  assert.equal(h.cast('nobi-tag',a,{...b,z:-36,targetId:b.id},1,1),null);assert.equal(h.cast('nobi-brake',a,{...b,z:-41,targetId:b.id},1,1),null);assert.equal(h.cast('nobi-tag',a,{...b,targetId:a.id},1,1),null);
 });
 test('target modifiers do not stack or affect source; personal expiry exact and guest JSON same',()=>{
  const h=createCharacterSkills();for(let i=0;i<2;i++)h.cast('nobi-tag',{...a,id:'n'+i},{...b,targetId:b.id},1,1);h.cast('nobi-brake',a,{...b,targetId:b.id},1,1);h.cast('nobi-tool',a,a,1,1);h.cast('nobi-legend',a,a,1,1);
  assert.equal(h.nobiVulnerability(b.id,2),1.35);assert.equal(h.nobiVulnerability(a.id,2),1);assert.equal(h.nobiInterval(b.id,2),1.6);assert.equal(h.nobiWork(a.id,2),1.5);assert.ok(h.nobiLegend(a.id,2));const g=createCharacterSkills();assert.ok(g.restore(copy(h.snapshot()),2,1));assert.equal(g.nobiWork(a.id,2),1.5);assert.equal(g.nobiInterval(b.id,6),1);assert.equal(g.nobiWork(a.id,7),1);assert.equal(g.nobiLegend(a.id,9),false);
 });
 test('source/target death and team change clear effects; round and20-event cap are bounded',()=>{
  for(const changed of[{...a,alive:false},{...a,team:'red'}]){const h=createCharacterSkills();h.cast('nobi-tag',a,{...b,targetId:b.id},1,1);h.cast('nobi-tool',a,a,1,1);h.update([changed,b],2,1);assert.equal(h.events(2).length,0);}
  const h=createCharacterSkills();h.cast('nobi-brake',a,{...b,targetId:b.id},1,1);h.update([a,{...b,team:'blue'}],2,1);assert.equal(h.nobiInterval(b.id,2),1);for(let i=0;i<20;i++)assert.ok(h.cast('nobi-tool',{...a,id:'p'+i},a,2,1));assert.equal(h.cast('nobi-legend',a,a,2,1),null);assert.equal(h.events(2).length,20);h.update([],3,2);assert.equal(h.events(3).length,0);
 });
 test('reference face/clothing/shoes use shared52 combat surfaces and dispose without leaking',()=>{
  const m=createAgentModel(THREE,{bot:{id:'nobi'},character:'nobi',team:'red'});m.update(.016,{character:'nobi',alive:true,weapon:'vandal',moving:true,time:1});m.group.updateMatrixWorld(true);const names=[];m.group.traverse(o=>{if(o.isMesh&&o.name.startsWith('Nobi /'))names.push(o.name);});
  for(const word of['face','nose','whisker','yellow','navy','sock','cyan'])assert.ok(names.some(n=>n.toLowerCase().includes(word)),word);assert.equal(m.meshes.length,52);const bounds=new THREE.Box3().setFromObject(m.group);assert.ok(bounds.max.y<2.2);assert.ok(bounds.max.x-bounds.min.x<2.5);m.dispose();
 });
 test('visible actors only drive bounded bell/whisker/work/collar FX and cleanup',()=>{
  const h=createCharacterSkills(),fx=createNobiSkillFX(THREE);for(const type of['nobi-tag','nobi-brake','nobi-tool','nobi-legend'])h.cast(type,a,type==='nobi-tag'||type==='nobi-brake'?{...b,targetId:b.id}:a,1,1);
  fx.update(h.events(1),1,{actors:[a]});assert.equal(fx.group.children.length,2);fx.update(h.events(1),1,{actors:[a,b]});assert.equal(fx.group.children.length,4);fx.update([],10);assert.equal(fx.group.children.length,0);fx.dispose();assert.equal(NOBI_SKILLS.toolScale,1.5);
 });
 console.log(`PASS: ${groups} nobi contract/JSON/model/FX groups; no AudioContext`);
}main().catch(e=>{console.error(e);process.exitCode=1;});
