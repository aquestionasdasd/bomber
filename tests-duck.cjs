const assert=require('node:assert/strict');
async function main(){
 const {DuelistKit,CHARACTER_DEFS,getCharacterSkill}=await import('./public/abilities.js');
 const {createCharacterSkills}=await import('./public/character-skills.js');
 const THREE=await import('./public/vendor/three.module.js');
 const {createAgentModel}=await import('./public/agent-model.js');
 const {createDuckSkillFX}=await import('./public/duck-skill-fx.js');
 let groups=0;const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);};
 const actor={id:'duck',team:'blue',x:0,y:0,z:0,alive:true,hp:100,grounded:true};
 const enemy={id:'enemy',team:'red',x:0,y:0,z:-10,alive:true,hp:100};
 test('eighth identity, distinct four effects, bounded purchases and CD',()=>{
  assert.equal(CHARACTER_DEFS.duck.label,'🦆');const kit=new DuelistKit({character:'duck'});let spent=0;
  for(const k of ['c','c','q'])assert.ok(kit.buy(k,n=>(spent+=n,true)));assert.equal(spent,300);assert.equal(kit.buy('q',()=>true),false);
  assert.equal(kit.activate('c',1).type,'duck-seal');assert.equal(kit.activate('q',1).type,'duck-shield');assert.equal(kit.activate('e',1).type,'duck-hush');assert.equal(kit.activate('e',20.99),null);assert.equal(kit.activate('e',21).type,'duck-hush');kit.ultPoints=7;assert.equal(kit.activate('x',21).type,'duck-egg');assert.equal(kit.ultPoints,0);assert.equal(kit.knivesActive,false);
  const copy=new DuelistKit();assert.ok(copy.restore(JSON.parse(JSON.stringify(kit.snapshot()))));assert.deepEqual(copy.snapshot(),kit.snapshot());
  for(const k of ['c','q','e'])assert.ok(getCharacterSkill('duck',k).type.startsWith('duck-'));
 });
 test('seal is target-specific, expires, JSON strict and source/target death cleaned',()=>{
  const host=createCharacterSkills();assert.ok(host.cast('duck-seal',actor,{x:0,y:1.3,z:-10,targetId:'enemy'},1,1));assert.equal(host.sealUntil('enemy',1),5);assert.equal(host.sealUntil('duck',1),0);
  const guest=createCharacterSkills(),state=JSON.parse(JSON.stringify(host.snapshot()));assert.ok(guest.restore(state,1,1));assert.equal(guest.sealUntil('enemy',1),5);
  const invalid=JSON.parse(JSON.stringify(state));invalid.events[0].targetId=actor.id;assert.equal(guest.restore(invalid,1,1),false);invalid.events[0].targetId='enemy';invalid.events[0].fakePower=99;assert.equal(guest.restore(invalid,1,1),false);
  host.update([actor,{...enemy,alive:false,hp:0}],2,1);assert.equal(host.sealUntil('enemy',2),0);assert.equal(guest.sealUntil('enemy',5),0);
 });
 test('shield blocks nearest plane from either side, clips bounds and consumes finite HP only on owner',()=>{
  const host=createCharacterSkills();assert.ok(host.cast('duck-shield',actor,{x:0,y:0,z:-5,yaw:0},1,1));
  host.update([actor,enemy],1,1);
  const guest=createCharacterSkills();assert.ok(guest.restore(JSON.parse(JSON.stringify(host.snapshot())),1,1));
  const origin={x:0,y:1.2,z:0},aim={x:0,y:0,z:-1};assert.equal(host.interceptShield(origin,aim,4,40,1,1),null);assert.equal(host.interceptShield({...origin,x:2},aim,10,40,1,1),null);
  assert.equal(host.interceptShield({...origin,y:2.5},aim,10,40,1,1),null);assert.equal(host.interceptShield(origin,aim,10,40,1,1).power,140);
  for(let i=0;i<3;i++)assert.equal(guest.interceptShield(origin,aim,10,40,1,1).power,180);
  assert.equal(host.interceptShield({x:0,y:1.2,z:-10},{x:0,y:0,z:1},10,140,1,1).power,0);assert.equal(host.interceptShield(origin,aim,10,40,1,1),null);
 });
 test('personal hush and two lethal guards expire, cannot be consumed by restored guest, die permanently',()=>{
  const host=createCharacterSkills();assert.ok(host.cast('duck-hush',actor,actor,1,1));assert.ok(host.cast('duck-egg',actor,actor,1,1));assert.equal(host.quiet('duck',1),true);
  host.update([actor,enemy],1,1);
  const guest=createCharacterSkills();assert.ok(guest.restore(JSON.parse(JSON.stringify(host.snapshot())),1,1));assert.equal(guest.guardLethal('duck',1,1),false);assert.equal(host.guardLethal('duck',1,1),true);assert.equal(host.guardLethal('duck',1,1),true);assert.equal(host.guardLethal('duck',1,1),false);
  host.update([{...actor,hp:0,alive:false}],2,1);assert.equal(host.quiet('duck',2),false);assert.equal(guest.quiet('duck',6),false);assert.equal(guest.guardLethal('duck',9,1),false);
 });
 test('20 event cap preserves prior events; strict power/yaw/range/time; round and reset clear',()=>{
  const host=createCharacterSkills();for(let i=0;i<20;i++)assert.ok(host.cast('duck-seal',{...actor,id:'d'+i},{...enemy,y:1.3,targetId:enemy.id},1,1));const before=host.snapshot();assert.equal(host.cast('duck-seal',actor,{...enemy,y:1.3,targetId:enemy.id},1,1),null);assert.deepEqual(host.snapshot(),before);
  host.reset();assert.equal(host.cast('duck-shield',actor,{x:0,y:0,z:-40,yaw:0},1,1),null);host.cast('duck-shield',actor,{x:0,y:0,z:-5,yaw:0},1,1);const state=host.snapshot(),guest=createCharacterSkills();for(const field of ['power','yaw']){const copy=JSON.parse(JSON.stringify(state));copy.events[0][field]=999;assert.equal(guest.restore(copy,1,1),false);}
  assert.ok(guest.restore(state,1,1));assert.equal(guest.restore(state,.9,1),false);host.update([actor],2,2);assert.equal(host.events(2).length,0);host.reset();assert.equal(host.events(0).length,0);
 });
 test('full duck animated model and FX have finite bounds, distinct reference features and disposal',()=>{
  const bot={id:'duck'},model=createAgentModel(THREE,{bot,character:'duck',team:'blue'});model.update(.016,{alive:true,character:'duck',time:1,weapon:'vandal',moving:true});model.group.updateMatrixWorld(true);
  const visible=[];model.group.traverse(o=>{if(o.isMesh&&o.name.startsWith('Duck /')){assert.equal(o.userData.character,'duck');visible.push(o.name);}});for(const word of ['bill','head','eye','collar','chest','webbed'])assert.ok(visible.some(n=>n.includes(word)),word);
  const bounds=new THREE.Box3().setFromObject(model.group);assert.ok(Number.isFinite(bounds.max.y));assert.ok(bounds.max.y<2.1);assert.ok(bounds.max.x-bounds.min.x<2.5);
  const fx=createDuckSkillFX(THREE),skills=createCharacterSkills();skills.cast('duck-shield',actor,{x:0,y:0,z:-5,yaw:0},1,1);skills.cast('duck-egg',actor,actor,1,1);fx.update(skills.events(1),1,{actors:[actor],preview:{x:1,y:0,z:0,type:'q'}});assert.ok(fx.group.children.length>=3);fx.reset();assert.equal(fx.group.children.length,1);fx.dispose();model.dispose();
 });
 console.log(`PASS: ${groups} duck kit/authority/JSON/model/FX groups; silent`);
}main().catch(e=>{console.error(e);process.exitCode=1;});
