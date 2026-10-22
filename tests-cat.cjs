const assert=require('node:assert/strict');
async function main(){
 const {DuelistKit,CHARACTER_DEFS,getCharacterSkill,CAT_SKILLS}=await import('./public/abilities.js');
 const {createCharacterSkills}=await import('./public/character-skills.js');
 const {MatchRules}=await import('./public/rules.js');
 const THREE=await import('./public/vendor/three.module.js');
 const {createAgentModel}=await import('./public/agent-model.js');
 const {createCatSkillFX}=await import('./public/cat-skill-fx.js');
 const actor={id:'cat',team:'blue',x:0,y:0,z:0,hp:100,alive:true,grounded:true};
 const clone=x=>JSON.parse(JSON.stringify(x));let groups=0;
 const test=(label,fn)=>{fn();groups++;console.log('PASS: '+label);};
 test('ninth identity has four distinct contracts and finite costs/CD, preserves JSON and old eight identities',()=>{
  assert.equal(CHARACTER_DEFS.cat.label,'猫の画像');assert.equal(Object.keys(CHARACTER_DEFS).length,14);
  const kit=new DuelistKit({character:'cat'});let spent=0;for(const key of ['c','c','q'])assert.equal(kit.buy(key,n=>(spent+=n,true)),true);assert.equal(spent,300);assert.equal(kit.buy('q',()=>true),false);
  for(const key of ['c','q','e'])assert.equal(kit.activate(key,1).type,getCharacterSkill('cat',key).type);
  assert.equal(kit.activate('e',18.99),null);assert.equal(kit.activate('e',19).type,'cat-fetch');kit.ultPoints=7;assert.equal(kit.activate('x',19).type,'cat-clock');assert.equal(kit.knivesActive,false);assert.equal(kit.ultPoints,0);
  const other=new DuelistKit();assert.ok(other.restore(clone(kit.snapshot())));assert.deepEqual(other.snapshot(),kit.snapshot());assert.equal(CAT_SKILLS.clockDuration,8);
 });
 test('bookmark transaction survives full event queue; guest cannot return and malformed JSON rejects atomically',()=>{
  const host=createCharacterSkills(),first=host.cast('cat-bookmark',actor,actor,1,1);assert.ok(first);for(let i=0;i<19;i++)assert.ok(host.cast('cat-pluck',{...actor,id:'p'+i},{x:0,y:0,z:-2,targetId:'enemy'},1,1));
  const state=clone(host.snapshot()),guest=createCharacterSkills();assert.ok(guest.restore(state,1,1));assert.equal(guest.returnToCatBookmark(first.id,actor,1,1),null);
  assert.equal(host.returnToCatBookmark(first.id,{...actor,x:25},1,1),null);assert.ok(host.catBookmark(actor.id,1));
  assert.ok(host.returnToCatBookmark(first.id,{...actor,x:8},1,1));assert.equal(host.catBookmark(actor.id,1),null);assert.equal(host.events(1).length,20);
  for(const mutate of [s=>s.events[1].targetId=s.events[1].sourceId,s=>s.events[0].power=20,s=>s.events[0].endsAt=99,s=>s.events[0].x=30,s=>{const e=clone(s.events[0]);e.id='skill-cat-bookmark-99';s.events[19]=e;}]){const bad=clone(state);mutate(bad);assert.equal(guest.restore(bad,1,1),false);assert.deepEqual(guest.snapshot(),state);}
 });
 test('clock overlap is union, expires by host time, death/team/new-round clears, restore grants no mutation ownership',()=>{
  const host=createCharacterSkills();host.cast('cat-clock',actor,actor,1,1);host.cast('cat-clock',{...actor,id:'other'},actor,2,1);assert.equal(host.clockFrozen(9.5),true);assert.equal(host.clockFrozen(10),false);
  host.reset();host.cast('cat-clock',actor,actor,1,1);host.update([{...actor,team:'red'}],2,1);assert.equal(host.clockFrozen(2),false);host.reset();host.cast('cat-bookmark',actor,actor,1,1);host.update([],2,1);assert.equal(host.catBookmark(actor.id,2),null);host.reset();host.cast('cat-clock',actor,actor,1,1);host.update([actor],2,2);assert.equal(host.events(2).length,0);
 });
 test('frozen clock preserves timer while plant/defuse channels and elimination remain live',()=>{
  const m=new MatchRules();m.startLive();const before=m.roundTime;m.tick(5,{clockPaused:true});assert.equal(m.roundTime,before);
  m.interactPlant(4,{actorId:m.spike.carrier,team:m.attackerTeam,site:'A',x:0,z:-17});assert.equal(m.spike.status,'planted');const timer=m.spike.timer;m.tick(3,{clockPaused:true});assert.equal(m.spike.timer,timer);
  m.interactDefuse(7,{actorId:'defender',team:m.defenderTeam});assert.equal(m.phase,'post');assert.equal(m.spike.status,'defused');
  const elim=new MatchRules();elim.startLive();elim.tick(.1,{clockPaused:true,blueAlive:0,redAlive:5});assert.equal(elim.phase,'post');
 });
 test('white plush cap/blue eyes/black moustache/full body retain 52 hit meshes and bounded animated rig/FX cleanup',()=>{
  const model=createAgentModel(THREE,{bot:{id:'cat'},character:'cat',team:'red'});model.update(.016,{character:'cat',alive:true,weapon:'vandal',moving:true,time:1});model.group.updateMatrixWorld(true);
  const names=[];model.group.traverse(o=>{if(o.isMesh&&o.name.startsWith('Cat /'))names.push(o.name);});for(const word of ['cap','blue iris','moustache','glove','shoe','gold button'])assert.ok(names.some(n=>n.includes(word)),word);
  const bounds=new THREE.Box3().setFromObject(model.group);assert.ok(Number.isFinite(bounds.max.y));assert.ok(bounds.max.y<2.1);assert.ok(bounds.max.x-bounds.min.x<2.5);assert.equal(model.meshes.length,52);
  const fx=createCatSkillFX(THREE),skills=createCharacterSkills();skills.cast('cat-bookmark',actor,actor,1,1);skills.cast('cat-clock',actor,actor,1,1);fx.update(skills.events(1),1,{actors:[actor],preview:{x:1,y:0,z:-2,type:'e'}});assert.equal(fx.group.children.length,3);fx.update([],12);assert.equal(fx.group.children.length,1);fx.dispose();model.dispose();
 });
 console.log(`PASS: ${groups} cat contracts/JSON/timer/model/FX groups; silent`);
}main().catch(e=>{console.error(e);process.exitCode=1;});
