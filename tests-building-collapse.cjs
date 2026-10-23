const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href),T=await load('vendor/three.module.js');
 global.document={createElement:()=>({getContext:()=>new Proxy({measureText:t=>({width:String(t).length*8})},{get:(o,k)=>o[k]||(()=>{})})})};
 const {createMap}=await load('map.js'),{createBuildingCollapse}=await load('building-collapse.js'),{createStationDetonation}=await load('detonation.js');let n=0;
 const check=(label,fn)=>{fn();n++;console.log('PASS '+label);};
 const snapshot=m=>({colliders:[...m.colliders],shapes:[...m.mapShapes],ramps:[...m.ramps],matrices:[]});
 for(const id of['hashimoto','hirakata']){
  const m=createMap(T,new T.Group(),id),before=snapshot(m),fx=createBuildingCollapse(T,m),matrix=new T.Matrix4();
  m.world.traverse(o=>{if(o.isInstancedMesh)before.matrices.push([o,new Float32Array(o.instanceMatrix.array)]);});
  check(id+': original buildings intact until detonation; roads retained, actual walls/roofs/support/radar removed',()=>{
   assert.deepEqual(m.colliders,before.colliders);assert.ok(fx.count>1000);assert.equal(fx.active,false);assert.equal(fx.group.visible,false);
   fx.start({x:10,z:12,time:20,seed:23});assert.equal(fx.active,true);assert.equal(m.colliders.length,0);assert.equal(m.mapShapes.length,0);assert.equal(m.ramps.length,0);
   assert.equal(m.collision.blocked(8,9,.34,0),false);assert.equal(m.collision.rayClear(0,2,0,40,2,40),true);
   assert.ok(m.world.children.some(o=>o.geometry&&o.visible&&o.geometry.parameters.width>=164),'ground remains visible');
   let hidden=0;for(const [o]of before.matrices)for(const i of o.userData.bomberBrokenInstances||[]){o.getMatrixAt(i,matrix);assert.equal(matrix.determinant(),0);hidden++;}assert.ok(hidden>1000);
   if(m.busModels)assert.ok([...m.busModels.models.values()].every(o=>o.visible&&o.children.some(c=>c.visible)),'buses remain independent');
  });
  check(id+':640 shattering pieces+96 dust maximum; finite deterministic absolute time, no combat randomness',()=>{
   const random=Math.random;Math.random=()=>{throw Error('combat randomness consumed');};try{
    const snap=t=>{fx.update(t);return fx.group.children.map(o=>[o.count,...o.instanceMatrix.array]);};
    const direct=snap(21.4);assert.equal(fx.group.children[0].count,640);assert.equal(fx.group.children[1].count,96);
    assert.ok(direct.flat(2).every(Number.isFinite));fx.start({x:10,z:12,time:20,seed:23});for(let i=0;i<84;i++)fx.update(20+i/60);assert.deepEqual(snap(21.4),direct);
    fx.update(21.4,{reducedMotion:true});assert.equal(fx.group.children[0].count,0);assert.equal(m.colliders.length,0);
    fx.update(26);assert.equal(fx.group.visible,false);assert.ok(fx.group.children.every(o=>o.count===0));assert.equal(m.colliders.length,0,'buildings stay gone after smoke clears');
   }finally{Math.random=random;}
  });
  check(id+': repeat/reset restores every original shape/matrix, bounded resources and full disposal',()=>{
   const resources=fx.group.children.flatMap(o=>[o,o.geometry,o.material]),counts=new Map(resources.map(o=>[o,0]));for(const o of resources)o.addEventListener('dispose',()=>counts.set(o,counts.get(o)+1));
   for(let i=0;i<8;i++){fx.reset();assert.deepEqual(m.colliders,before.colliders);assert.deepEqual(m.mapShapes,before.shapes);assert.deepEqual(m.ramps,before.ramps);for(const[o,a]of before.matrices)assert.deepEqual(o.instanceMatrix.array,a);fx.start({time:i*10,seed:i});fx.update(i*10+1);}
   fx.dispose();assert.equal(fx.active,false);assert.equal(fx.group.children.length,0);assert.ok([...counts.values()].every(v=>v===1));fx.dispose();assert.ok([...counts.values()].every(v=>v===1));assert.equal(fx.start({}),false);
  });
 }
 check('Hirakata bus damage cannot resurrect collapsed buildings and survives a same-round demo reset',()=>{
  const m=createMap(T,new T.Group(),'hirakata'),fx=createBuildingCollapse(T,m),d=m.destruction,p={x:8,z:9,yaw:0};d.breakAt(p,p,10);const mask=d.snapshot(),partial=m.colliders.length;assert.ok(mask&&partial<797);
  fx.start({time:11});d.restore('',12);d.restore(mask,12);assert.equal(m.colliders.length,0);for(const g of d.groups)for(const p of g.parts){const a=new T.Matrix4();p.batch.mesh.getMatrixAt(p.index,a);if(p.batch.mesh.userData.bomberBrokenInstances?.has(p.index))assert.equal(a.determinant(),0);}
  fx.reset();assert.equal(d.snapshot(),mask);assert.equal(m.colliders.length,partial);assert.equal(m.collision.blocked(8,9,.34,0),false);assert.equal(m.collision.blocked(55,9,.34,0),true);
  fx.start({time:15});d.reset();fx.reset();assert.equal(m.colliders.length,797);assert.equal(m.ramps.length,4);assert.equal(d.snapshot(),'');
 });
 check('blast fire follows Hirakata rather than the old Hashimoto facade',()=>{
  const fx=createStationDetonation(T);fx.start({x:8,z:9,time:1,seed:1,station:{x:0,z:0,width:134}});assert.equal(fx.group.userData.event.station.z,0);fx.update(2);const fire=fx.group.children[0],a=new T.Matrix4(),p=new T.Vector3();let max=-Infinity,min=Infinity;
  for(let i=8;i<24;i++){fire.getMatrixAt(i,a);p.setFromMatrixPosition(a);max=Math.max(max,p.x);min=Math.min(min,p.x);assert.ok(Math.abs(p.z)<8);}assert.ok(max-min>120);fx.dispose();
 });
 console.log('PASS '+n+' building collapse groups; silent');
})().catch(e=>{console.error(e);process.exitCode=1;});
