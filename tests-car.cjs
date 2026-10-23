const assert=require('node:assert/strict');
async function main(){
 const {DuelistKit,CHARACTER_DEFS,getCharacterSkill,CAR_SKILLS}=await import('./public/abilities.js');
 const {createCharacterSkills}=await import('./public/character-skills.js');
 const {carMovementSpread,carSmokeIntersection,carAimVector}=await import('./public/car-targeting.js');
 const THREE=await import('./public/vendor/three.module.js'),{createAgentModel}=await import('./public/agent-model.js'),{createCarSkillFX}=await import('./public/car-skill-fx.js');
 const a={id:'car',team:'blue',x:0,y:0,z:0,hp:100,alive:true,grounded:true},copy=x=>JSON.parse(JSON.stringify(x));let groups=0;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);};
 test('tenth car costs, finite stock,18s CD,7pt and JSON restore preserve the current15-character roster',()=>{
  assert.equal(CHARACTER_DEFS.car.label,'トミカ');assert.equal(Object.keys(CHARACTER_DEFS).length,15);assert.equal(CAR_SKILLS.bumperDistance,3);
  const kit=new DuelistKit({character:'car'});let spend=0;for(const k of['c','c','q'])assert.equal(kit.buy(k,n=>(spend+=n,true)),true);assert.equal(spend,300);assert.equal(kit.buy('q',()=>true),false);
  for(const k of['c','q','e'])assert.equal(kit.activate(k,1).type,getCharacterSkill('car',k).type);assert.equal(kit.activate('e',18.99),null);assert.ok(kit.activate('e',19));kit.ultPoints=7;assert.equal(kit.activate('x',20).type,'car-pit');assert.equal(kit.ultPoints,0);assert.equal(kit.knivesActive,false);const restored=new DuelistKit();assert.ok(restored.restore(copy(kit.snapshot())));assert.deepEqual(restored.snapshot(),kit.snapshot());
 });
 test('strict four event shapes, endpoint range, target identity, personal duplication and atomic invalid snapshot',()=>{
  const h=createCharacterSkills();for(const type of['car-bumper','car-wash','car-gyro','car-pit'])assert.ok(h.cast(type,a,{...a,...(type==='car-bumper'?{targetId:'enemy'}:{})},1,1));assert.equal(h.cast('car-gyro',a,a,1,1),null);assert.equal(h.cast('car-bumper',a,{x:0,y:0,z:-39,targetId:'enemy'},1,1),null);
  const state=copy(h.snapshot()),g=createCharacterSkills();assert.ok(g.restore(state,1,1));for(const mutate of[s=>s.events[0].targetId='car',s=>s.events[1].power=100,s=>s.events[2].endsAt=100,s=>s.events[3].x=3,s=>s.events[0].targetId='']){const bad=copy(state);mutate(bad);assert.equal(g.restore(bad,1,1),false);assert.deepEqual(g.snapshot(),state);}
 });
 test('only authoritative wash removes one ordinary smoke, never other skills or restored guest data',()=>{
  const h=createCharacterSkills(),fog=h.cast('mend-pollen',{...a,id:'mend'},a,1,1),other=h.cast('mend-seeds',{...a,id:'mend'},a,1,1),wash=h.cast('car-wash',a,a,1,1),g=createCharacterSkills();assert.ok(g.restore(copy(h.snapshot()),1,1));assert.equal(g.disperseSmoke(wash.id,fog.id,1,1),false);assert.equal(h.disperseSmoke(wash.id,other.id,1,1),false);assert.equal(h.disperseSmoke(wash.id,fog.id,1,1),true);assert.equal(h.disperseSmoke(wash.id,other.id,1,1),false);assert.ok(h.events(1).some(e=>e.id===other.id));
 });
 test('gyro removes grounded movement spread only, not airborne penalty, expiry or death/team/round cleanup',()=>{
  for(const gyro of[true,false])assert.equal(carMovementSpread({airborne:true,moving:true,gyro}),.15);assert.equal(carMovementSpread({airborne:false,moving:true,gyro:true}),0);assert.equal(carMovementSpread({airborne:false,moving:true,gyro:false}),.09);assert.equal(carMovementSpread({airborne:false,moving:false,gyro:false}),0);
  const h=createCharacterSkills();h.cast('car-gyro',a,a,1,1);assert.equal(h.carGyro(a.id,4.99),true);assert.equal(h.carGyro(a.id,5),false);h.reset();h.cast('car-gyro',a,a,1,1);h.update([{...a,team:'red'}],2,1);assert.equal(h.carGyro(a.id,2),false);h.reset();h.cast('car-gyro',a,a,1,1);h.update([],2,2);assert.equal(h.events(2).length,0);
 });
 test('smoke aim discriminates behind/off-axis/inside fields and nonfinite aim',()=>{
  const d=carAimVector(0,0),o={x:0,y:1,z:0};assert.deepEqual(d,{x:-0,y:0,z:-1});assert.equal(carSmokeIntersection(o,d,{x:0,y:1,z:-10,radius:3}),7);assert.equal(carSmokeIntersection(o,d,{x:0,y:1,z:10,radius:3}),null);assert.equal(carSmokeIntersection(o,d,{x:4,y:1,z:-10,radius:3}),null);assert.equal(carSmokeIntersection(o,d,{x:0,y:1,z:0,radius:3}),0);assert.equal(carAimVector(NaN,0),null);
 });
 test('car model roof/window/wing/four tyres remain within shared combat rig and52 hit surfaces; FX bounded/disposed',()=>{
  const m=createAgentModel(THREE,{bot:{id:'car'},character:'car',team:'red'});m.update(.016,{character:'car',alive:true,weapon:'vandal',moving:true,time:1});m.group.updateMatrixWorld(true);const names=[];m.group.traverse(o=>{if(o.isMesh&&o.name.startsWith('Car /'))names.push(o.name);});for(const word of['white chassis','black roof','cockpit windshield','rear wing','headlight','silver rim'])assert.ok(names.some(n=>n.includes(word)),word);assert.equal(names.filter(n=>n.endsWith('tyre')).length,4);m.group.traverse(o=>{if(o.isMesh&&o.name==='Car / front wheel silver rim')assert.equal(o.scale.y,1,'wheel rim depth stays native instead of copying limb extension');if(o.isMesh&&o.name==='Car / silver rear suspension')assert.equal(o.scale.y,6,'limb spans the shared segment instead of floating');});assert.equal(m.meshes.length,52);const bounds=new THREE.Box3().setFromObject(m.group);assert.ok(bounds.max.y<2.2);assert.ok(bounds.max.x-bounds.min.x<2.5);
  const fx=createCarSkillFX(THREE),h=createCharacterSkills();h.cast('car-bumper',a,{x:0,y:0,z:-3,targetId:'enemy'},1,1);h.cast('car-gyro',a,a,1,1);fx.update(h.events(1),1,{actors:[a],preview:{x:0,y:0,z:-3}});assert.equal(fx.group.children.length,3);fx.update([],10);assert.equal(fx.group.children.length,1);fx.dispose();m.dispose();
 });
 console.log(`PASS: ${groups} car contracts/authority/JSON/aim/model/FX groups; silent`);
}main().catch(e=>{console.error(e);process.exitCode=1;});
