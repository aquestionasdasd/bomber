const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
async function main(){const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href),{DuelistKit,CHARACTER_DEFS}=await load('abilities.js'),{createCharacterSkills}=await load('character-skills.js'),THREE=await load('vendor/three.module.js'),{createAgentModel}=await load('agent-model.js'),{createCapSkillFX}=await load('cap-skill-fx.js');
 const {capShotOffset}=await load('cap-optics.js');
 const owner={id:'owner',team:'blue',x:0,y:0,z:0,hp:100,alive:true},enemy={...owner,id:'enemy',team:'red',z:-5};let groups=0;const test=(n,fn)=>{fn();groups++;console.log('PASS: '+n);};
 test('13th exact identity,2C1Q caps/22CD/7pt',()=>{assert.equal(Object.keys(CHARACTER_DEFS).length,16);assert.equal(CHARACTER_DEFS.cap.label,'キャップは？');const k=new DuelistKit({character:'cap'});for(const key of['c','c','q'])assert.equal(k.buy(key,()=>true),true);assert.equal(k.buy('q',()=>true),false);assert.equal(k.activate('e',1).type,'cap-bank');assert.equal(k.activate('e',22.99),null);assert.ok(k.activate('e',23));k.ultPoints=7;assert.equal(k.activate('x',1).type,'cap-magazine');});
 test('all4 strict JSON exact targets/times/fields; cap-clean permits self only within24m',()=>{const h=createCharacterSkills();for(const t of['cap-lock','cap-clean','cap-bank','cap-magazine'])assert.ok(h.cast(t,owner,t==='cap-lock'?{...enemy,targetId:enemy.id}:t==='cap-clean'?{...owner,targetId:owner.id}:owner,1,1));const state=JSON.parse(JSON.stringify(h.snapshot())),g=createCharacterSkills();assert.ok(g.restore(state,1,1));for(const change of[s=>s.events[0].targetId=owner.id,s=>s.events[1].power=10,s=>s.events[2].endsAt=999,s=>s.events[0].z=-100]){const bad=JSON.parse(JSON.stringify(state));change(bad);assert.equal(g.restore(bad,1,1),false);assert.deepEqual(g.snapshot(),state);}});
 test('cleanse removes current hostility, not own buffs or future attacks; no health mutation',()=>{const h=createCharacterSkills();for(const type of['cap-lock','duck-seal','nobi-tag','nobi-brake'])assert.ok(h.cast(type,enemy,{...owner,targetId:owner.id},1,1));h.cast('cap-bank',owner,owner,1,1);assert.equal(h.hasImpairment(owner.id,owner.team,1),true);assert.equal(h.cleanse(owner.id,owner.team,1),4);assert.equal(h.hasImpairment(owner.id,owner.team,1),false);assert.equal(h.capBank(owner.id,1),true);assert.equal(owner.hp,100);assert.ok(h.cast('cap-lock',enemy,{...owner,targetId:owner.id},1,1));assert.equal(h.capLocked(owner.id,1),true);});
 test('owner death/team/expiry/round cleanup and20cap',()=>{const h=createCharacterSkills();h.cast('cap-magazine',owner,owner,1,1);h.update([{...owner,alive:false,hp:0}],1.1,1);assert.equal(h.capMagazine(owner.id,1.1),false);h.reset();for(let i=0;i<20;i++)assert.ok(h.cast('cap-bank',{...owner,id:'p'+i},owner,1,1));assert.equal(h.cast('cap-lock',owner,{...enemy,targetId:enemy.id},1,1),null);h.update([],1,2);assert.equal(h.events(1).length,0);});
 test('reference red hair/round glasses/navy hoodie; existing52 hits and owned FX disposal',()=>{const model=createAgentModel(THREE,{bot:{id:'cap'},team:'blue',character:'cap'});const names=[];model.group.traverse(o=>names.push(o.name));for(const text of['swept red hair','round glasses','navy hoodie','smile teeth'])assert.ok(names.some(n=>n.includes(text)),text);assert.equal(model.meshes.length,52);const fx=createCapSkillFX(THREE),h=createCharacterSkills();h.cast('cap-bank',owner,owner,1,1);fx.update(h.events(1),1,{actors:[owner]});assert.equal(fx.group.children.length,1);fx.update([],2);assert.equal(fx.group.children.length,0);fx.dispose();model.dispose();});



 test('bounded deterministic accepted-shot cone and shared four-draw lens fractures',()=>{
  for(const seq of[1,2,3,1000,1048577,NaN]){const a=capShotOffset(seq,true);assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));assert.ok(Math.abs(Math.hypot(a.x,a.y)-.035)<1e-9);assert.deepEqual(a,capShotOffset(seq,true));assert.deepEqual(capShotOffset(seq,false),{x:0,y:0});}
  const fx=createCapSkillFX(THREE),h=createCharacterSkills();for(let i=0;i<20;i++)h.cast('cap-lock',{...owner,id:'c'+i},{...enemy,targetId:enemy.id},1,1);
  const events=h.events(1);fx.update(events,1.1,{actors:[enemy]});let calls=0;const geometries=new Set(),materials=new Set();fx.group.traverse(o=>{if(o.isMesh){calls++;geometries.add(o.geometry);materials.add(o.material);assert.equal(o.material.depthTest,true);}});assert.equal(calls,80);assert.equal(geometries.size,2);const count=fx.group.children.length;
  fx.update(events,1.2,{actors:[enemy],reducedMotion:true});assert.equal(fx.group.children.length,count);for(const root of fx.group.children){assert.equal(root.rotation.y,0);assert.equal(root.scale.x,1);}
  fx.update(events,1.3,{actors:[enemy],hiddenActorId:enemy.id});assert.equal(fx.group.children.length,0);fx.update(events,1.4,{actors:[enemy]});assert.equal(fx.group.children.length,count);
  let disposals=0;for(const g of geometries)g.addEventListener('dispose',()=>disposals++);fx.dispose();fx.dispose();assert.equal(disposals,2);fx.update(events,2,{actors:[enemy]});assert.equal(fx.group.children.length,0);
 });
 const {traceCapBankPreview,createCapBankPreviewFX}=await load('cap-bank-preview.js');
 test('reflection preview follows rotated/instanced wall normals, follows up to three reflections and refuses floors',()=>{
  for(const instanced of[false,true]){
   const world=new THREE.Group(),geometry=new THREE.BoxGeometry(15,4,.2),material=new THREE.MeshBasicMaterial();
   const wall=instanced?new THREE.InstancedMesh(geometry,material,1):new THREE.Mesh(geometry,material);
   const pose=new THREE.Object3D();pose.position.set(0,2,-5);pose.rotation.y=Math.PI/4;
   if(instanced){pose.updateMatrix();wall.setMatrixAt(0,pose.matrix);}else{wall.position.copy(pose.position);wall.rotation.copy(pose.rotation);}
   world.add(wall);const stop=new THREE.Mesh(new THREE.BoxGeometry(.2,4,30),material);stop.position.set(8,2,0);world.add(stop);
   const path=traceCapBankPreview(THREE,world,new THREE.Vector3(0,1.7,0),new THREE.Vector3(0,0,-1));assert.ok(path);
   assert.ok(Math.abs(path.segments[0].end.x-7.9)<1e-6,'first reflected leg ends at second wall');assert.ok(path.end.distanceTo(path.start)<90);
   assert.ok(Math.abs(path.segments[0].end.z-path.start.z)<.03,'45 degree wall turns horizontally with the shared .025m surface bias');
   assert.equal(traceCapBankPreview(THREE,world,new THREE.Vector3(0,6,0),new THREE.Vector3(0,-1,0)),null,'horizontal surfaces never bounce');
   geometry.dispose();stop.geometry.dispose();material.dispose();
  }
 });
 test('one bounded depth-tested dotted draw, stable resources, reset and idempotent disposal',()=>{
  const fx=createCapBankPreviewFX(THREE),dash=fx.group.children[0];assert.equal(fx.group.visible,false);assert.equal(dash.material.depthTest,true);assert.equal(dash.material.depthWrite,false);
  const geometry=dash.geometry,material=dash.material;let disposed=0;geometry.addEventListener('dispose',()=>disposed++);material.addEventListener('dispose',()=>disposed++);
  for(let i=0;i<100;i++)fx.update({start:new THREE.Vector3(),end:new THREE.Vector3(0,0,89)});
  assert.equal(dash.count,119);assert.equal(dash.geometry,geometry);assert.equal(dash.material,material);assert.equal(fx.group.children.length,1);
  const matrix=new THREE.Matrix4();dash.getMatrixAt(1,matrix);assert.ok(matrix.elements[14]>.75,'real gaps between dashes');
  fx.reset();assert.equal(fx.group.visible,false);assert.equal(dash.count,0);fx.dispose();fx.dispose();assert.equal(disposed,2);fx.update({});assert.equal(fx.group.visible,false);
 });
 console.log(`PASS: ${groups} cap contract/JSON/model/cleanup groups; no audio`);
}main().catch(e=>{console.error(e);process.exitCode=1;});
