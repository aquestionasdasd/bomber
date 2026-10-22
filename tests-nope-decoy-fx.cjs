const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');

async function main(){
  const load=name=>import(pathToFileURL(path.join(__dirname,'public',name)).href);
  const [THREE,{createNopeDecoyFX},{acquireNopeDecoyAsset,createNopeFaceModel},{createAgentModel}]=await Promise.all([
    load('vendor/three.module.js'),load('nope-decoy-fx.js'),load('nope-avatar.js'),load('agent-model.js')]);
  const start=process.hrtime.bigint(),cpu=process.cpuUsage();let passed=0;
  const test=async(name,fn)=>{await fn();passed++;console.log(`PASS: ${name}`);};
  const event=(id=1,extra={})=>({id:`decoy-${id}`,type:'nope-decoy',team:'red',sourceId:'caster',round:1,x:0,y:0,z:0,startedAt:0,endsAt:12,...extra});
  const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
  const meshes=fx=>fx.group.children;
  const pose=(mesh,index=0)=>{const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();mesh.getMatrixAt(index,matrix);matrix.decompose(position,quaternion,scale);return{matrix,position,quaternion,scale};};
  const resources=fx=>new Set(meshes(fx).flatMap(mesh=>[mesh.geometry,mesh.material]));
  const watch=items=>{const counts=new Map();for(const item of items)if(!counts.has(item)){counts.set(item,0);item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));}return counts;};
  const disposed=(counts,expected)=>{for(const [item,n]of counts)assert.equal(n,expected,`${item.name||item.type} disposal`);};
  const rawRay=(fx,x,y,z=2)=>{fx.group.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,0,-1)),hits=[];for(const mesh of meshes(fx))if(mesh.count)THREE.InstancedMesh.prototype.raycast.call(mesh,ray,hits);return hits.sort((a,b)=>a.distance-b.distance);};
  const assertCap=fx=>{fx.update(Array.from({length:60},(_,i)=>event(i+1,{team:i%2?'blue':'red'})),1);assert.equal(fx.group.userData.activeEvents,50);assert.equal(meshes(fx).find(mesh=>mesh.name==='NOPE decoy / cloth').count,50);};
  const assertFeet=fx=>{fx.update([event()],1);const mesh=meshes(fx).find(mesh=>mesh.name==='NOPE decoy / rubber'),world=mesh.geometry.boundingBox.clone().applyMatrix4(pose(mesh).matrix);close(world.min.y,0);};
  const assertNonhit=fx=>{fx.update([event()],1);fx.group.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(0,1.62,2),new THREE.Vector3(0,0,-1));assert.equal(ray.intersectObject(fx.group,true).length,0);};

  await test('the real curved NOPE expression and rounded body form a planted1.95m full mascot in seven batches',()=>{
    const fx=createNopeDecoyFX(THREE),asset=acquireNopeDecoyAsset(THREE),face=createNopeFaceModel(THREE);fx.update([event()],1);
    assert.equal(meshes(fx).length,7);assert.equal(new Set(meshes(fx).map(mesh=>mesh.geometry)).size,6);
    close(asset.bounds.min.y,0);close(asset.bounds.max.y,1.95,1e-5);
    const size=asset.bounds.getSize(new THREE.Vector3());assert.ok(size.x>.58&&size.x<.8);assert.ok(size.z>.30&&size.z<.50);
    for(const [x,y,label]of [[0,1.65,'head'],[0,1.08,'torso'],[-.3,1.10,'left arm'],[.3,1.10,'right arm'],[-.127,.31,'left leg'],[.127,.31,'right leg'],[-.127,.06,'left shoe'],[.127,.06,'right shoe']])assert.ok(rawRay(fx,x,y).length,label);
    assert.equal(rawRay(fx,0,.30).length,0,'Two distinct legs retain the open space between them');
    for(const part of face.group.children){
      const batch=meshes(fx).find(mesh=>mesh.material===part.material);assert.ok(batch,'Face borrows exactly the live character finish');
      const positions=batch.geometry.attributes.position,points=new Set();for(let i=0;i<positions.count;i++)points.add(`${positions.getX(i)},${positions.getY(i)},${positions.getZ(i)}`);
      const input=part.geometry.attributes.position;for(let i=0;i<input.count;i++)assert.ok(points.has(`${input.getX(i)},${Math.fround(input.getY(i)+1.62)},${input.getZ(i)}`),'Every expression vertex survives the fixed-pose merge');
    }
    for(const item of resources(fx))for(const value of Object.values(item))assert.ok(!value?.isTexture,'No new bitmap or texture dependency');
    assertFeet(fx);face.dispose();asset.dispose();fx.dispose();
  });

  await test('thirtyX plus twenty ordinary detached decoys have a strict50 cap and constant seven draws',()=>{
    const fx=createNopeDecoyFX(THREE);assertCap(fx);assert.equal(meshes(fx).filter(mesh=>mesh.visible).length,7);
    assert.equal(meshes(fx).find(mesh=>mesh.name.endsWith('team red')).count,25);assert.equal(meshes(fx).find(mesh=>mesh.name.endsWith('team blue')).count,25);
    for(const mesh of meshes(fx)){assert.equal(mesh.instanceMatrix.count,50);assert.ok(mesh.count<=50);}
    fx.update([event(),event(),event(2)],1);assert.equal(fx.group.userData.activeEvents,2);assert.equal(meshes(fx).find(mesh=>mesh.name==='NOPE decoy / cloth').count,2);
    fx.update([event(3,{startedAt:2,endsAt:3})],1.999);assert.equal(fx.group.visible,false);
    fx.update([event(3,{startedAt:2,endsAt:3})],2);assert.equal(fx.group.userData.activeEvents,1);
    fx.update([event(3,{startedAt:2,endsAt:3})],3);assert.equal(fx.group.visible,false);assert.ok(meshes(fx).every(mesh=>mesh.count===0&&!mesh.visible));
    fx.update([...Array(200).fill(null),event()],1);assert.equal(fx.group.visible,false,'Scanning itself is bounded for malformed packets');fx.dispose();
  });

  await test('malformed/inherited/nonfinite records and invalid clocks never draw or poison matrices',()=>{
    const fx=createNopeDecoyFX(THREE),good=event();
    const bad=[null,0,[],{},Object.create(good),{...good,type:'constructor'},{...good,id:''},{...good,id:'bad\n'},{...good,sourceId:''},{...good,team:'green'},{...good,round:0},{...good,round:1.5},{...good,x:Infinity},{...good,y:NaN},{...good,z:1001},{...good,startedAt:-1},{...good,endsAt:0},{...good,endsAt:NaN},{...good,yaw:Infinity},{...good,yaw:null}];
    for(const value of bad){assert.doesNotThrow(()=>fx.update([value],1));assert.equal(fx.group.visible,false);assert.equal(fx.group.userData.activeEvents,0);}
    for(const clock of [NaN,Infinity,-1,'1']){fx.update([good],1);fx.update([good],clock);assert.equal(fx.group.visible,false);}
    for(const value of [null,{},'events']){fx.update(value,1);assert.equal(fx.group.visible,false);}
    fx.update([event(2,{x:-1000,y:11,z:1000,yaw:-Math.PI})],1);for(const mesh of meshes(fx))for(let i=0;i<mesh.count*16;i++)assert.ok(Number.isFinite(mesh.instanceMatrix.array[i]));fx.dispose();
  });

  await test('fixed yaw wins over viewer-facing fallback and neither time nor reduced motion floats the feet',()=>{
    const fx=createNopeDecoyFX(THREE),cloth=meshes(fx).find(mesh=>mesh.name==='NOPE decoy / cloth');
    const explicit=event(1,{x:3,y:3.2,z:-4,yaw:Math.PI/2}),automatic=event(2,{x:-2,y:0,z:1});
    fx.update([explicit,automatic],1,{viewer:{x:8,z:1}});const first=pose(cloth),second=pose(cloth,1);
    assert.deepEqual(first.position.toArray(),[3,Math.fround(3.2),-4]);close(new THREE.Vector3(0,0,1).applyQuaternion(first.quaternion).x,1);
    close(new THREE.Vector3(0,0,1).applyQuaternion(second.quaternion).x,1);assert.deepEqual(first.scale.toArray(),[1,1,1]);
    const stable=Array.from(cloth.instanceMatrix.array);fx.update([explicit,automatic],5,{viewer:{x:8,z:1},reducedMotion:true});assert.deepEqual(Array.from(cloth.instanceMatrix.array),stable);
    fx.update([event(1,{yaw:0})],1,{viewer:{x:10,z:0}});close(new THREE.Vector3(0,0,1).applyQuaternion(pose(cloth).quaternion).z,1);
    fx.update([event()],1,{viewer:{x:NaN,z:Infinity}});close(pose(cloth).quaternion.w,1);fx.dispose();
  });

  await test('visuals are normally depth tested, shadow-free, nonblocking and never add ray hits',()=>{
    const fx=createNopeDecoyFX(THREE);assertNonhit(fx);assert.ok(rawRay(fx,0,1.62).length,'The no-hit assertion is not explained by empty geometry');
    for(const mesh of meshes(fx)){assert.equal(mesh.userData.solid,false);assert.equal(mesh.userData.decoy,true);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.frustumCulled,false);assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.depthWrite,true);assert.equal(mesh.material.transparent,false);}
    fx.dispose();
  });

  await test('repeated updates/resets reuse instance buffers, geometry and all THREE temporaries without model allocation',()=>{
    const allocations=new Map(),instrumented={...THREE};
    for(const name of ['Object3D','Group','Mesh','InstancedMesh','BufferGeometry','BufferAttribute','Matrix4','Vector3','Quaternion','MeshStandardMaterial'])instrumented[name]=new Proxy(THREE[name],{construct(target,args,newTarget){allocations.set(name,(allocations.get(name)||0)+1);return Reflect.construct(target,args,newTarget);}});
    const fx=createNopeDecoyFX(instrumented),data=Array.from({length:50},(_,i)=>event(i+1)),before=new Map(allocations),assets=resources(fx),released=watch(assets),buffers=meshes(fx).map(mesh=>mesh.instanceMatrix.array.buffer);
    for(let i=0;i<500;i++){fx.update(data,1+i/1000,{reducedMotion:i%2===0});if(i%7===0)fx.reset();}
    assert.deepEqual(allocations,before);assert.deepEqual(resources(fx),assets);meshes(fx).forEach((mesh,i)=>assert.equal(mesh.instanceMatrix.array.buffer,buffers[i]));disposed(released,0);
    fx.reset();assert.equal(fx.group.visible,false);assert.equal(meshes(fx).length,7);fx.dispose();disposed(released,1);
  });

  await test('shared merged assets survive otherFX/main-face borrowers and release exactly once for the final owner',()=>{
    const face=createNopeFaceModel(THREE),first=createNopeDecoyFX(THREE),second=createNopeDecoyFX(THREE),assets=resources(first),allGeometries=new Set(meshes(first).map(mesh=>mesh.geometry)),allMaterials=new Set(meshes(first).map(mesh=>mesh.material));
    meshes(first).forEach((mesh,i)=>{assert.equal(mesh.geometry,meshes(second)[i].geometry);assert.equal(mesh.material,meshes(second)[i].material);assert.notEqual(mesh.instanceMatrix,meshes(second)[i].instanceMatrix);});
    const geoDisposal=watch(allGeometries),matDisposal=watch(allMaterials),instances=watch(meshes(first));first.dispose();first.dispose();disposed(instances,1);disposed(geoDisposal,0);disposed(matDisposal,0);
    second.update([event()],1);assertFeet(second);second.dispose();disposed(geoDisposal,1);disposed(matDisposal,0);face.dispose();disposed(matDisposal,1);
    const rebuilt=createNopeDecoyFX(THREE);assert.ok([...resources(rebuilt)].every(resource=>!assets.has(resource)));rebuilt.dispose();
    first.update([event()],1);assert.equal(first.group.visible,false);first.reset();assert.equal(first.group.visible,false);
  });

  await test('liveNOPE main-avatar appearance and all52 combat meshes are unchanged by pooled decoy lifetime',()=>{
    const agent=createAgentModel(THREE,{bot:{id:'main'},team:'blue',character:'nope'});agent.update(0,{alive:true,character:'nope',weapon:'vandal',time:0});agent.group.updateMatrixWorld(true);
    assert.equal(agent.meshes.length,52);const original=agent.meshes.map(mesh=>({mesh,head:mesh.userData.head,hash:crypto.createHash('sha256').update(Buffer.from(mesh.geometry.attributes.position.array.buffer)).digest('hex'),matrix:mesh.matrixWorld.toArray()}));
    const fx=createNopeDecoyFX(THREE);for(let i=0;i<20;i++){assertCap(fx);fx.reset();}fx.dispose();agent.group.updateMatrixWorld(true);
    original.forEach((before,i)=>{const mesh=agent.meshes[i];assert.equal(mesh,before.mesh);assert.equal(mesh.userData.head,before.head);assert.equal(crypto.createHash('sha256').update(Buffer.from(mesh.geometry.attributes.position.array.buffer)).digest('hex'),before.hash);assert.deepEqual(mesh.matrixWorld.toArray(),before.matrix);});
    assert.ok(agent.group.getObjectByName('NOPE avatar / painted smile mascot').visible);agent.dispose();
  });

  await test('negative controls detect a30cap, floating face-height placement and accidentally enabled mesh raycasts',async()=>{
    const file=path.join(__dirname,'public','nope-decoy-fx.js'),source=fs.readFileSync(file,'utf8'),assetURL=pathToFileURL(path.join(__dirname,'public','nope-avatar.js')).href;
    const mutations=[['MAX_DECOYS=50','MAX_DECOYS=30',assertCap],['transform.position.set(event.x,event.y,event.z)','transform.position.set(event.x,event.y+1.4,event.z)',assertFeet],['mesh.raycast=()=>{};','',assertNonhit]];
    for(const [from,to,check]of mutations){assert.ok(source.includes(from));const code=source.replace(from,to).replace("'./nope-avatar.js'",JSON.stringify(assetURL));const module=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`),fx=module.createNopeDecoyFX(THREE);try{assert.throws(()=>check(fx),assert.AssertionError,`Mutation ${from} must be rejected`);}finally{fx.dispose();}}
  });

  const fx=createNopeDecoyFX(THREE);assertCap(fx);const triangles=meshes(fx).reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*mesh.count,0);
  const stats={draws:meshes(fx).filter(mesh=>mesh.visible).length,capacity:50,geometries:new Set(meshes(fx).map(mesh=>mesh.geometry)).size,textures:0,trianglesAt50:triangles,instanceBufferBytes:meshes(fx).reduce((sum,mesh)=>sum+mesh.instanceMatrix.array.byteLength,0)};fx.dispose();
  const used=process.cpuUsage(cpu);console.log(`NOPE full-body decoy FX tests passed: ${passed} groups.`);console.log(JSON.stringify({stats,wallMs:Number(process.hrtime.bigint()-start)/1e6,cpuMs:(used.user+used.system)/1000}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
