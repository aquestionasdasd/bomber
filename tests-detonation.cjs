const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function main(){
  const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [THREE,{createStationDetonation}]=await Promise.all([load('vendor/three.module.js'),load('detonation.js')]);
  const effect=createStationDetonation(THREE),scene=new THREE.Scene();scene.add(effect.group);
  const geometries=new Set(),materials=new Set(),textures=new Set(),instanceMeshes=[];let drawCalls=0,triangles=0,maxInstances=0,points=0;
  effect.group.traverse(object=>{
    if(!object.isMesh&&!object.isPoints)return;drawCalls++;geometries.add(object.geometry);materials.add(object.material);
    assert.equal(object.userData.solid,false);assert.equal(object.castShadow,false);
    const hits=[];object.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0,'A cinematic cannot block bullets');
    for(const value of Object.values(object.material))if(value?.isTexture)textures.add(value);
    for(const uniform of Object.values(object.material.uniforms||{}))if(uniform.value?.isTexture)textures.add(uniform.value);
    if(object.isPoints)points+=object.geometry.attributes.position.count;
    else {const count=object.isInstancedMesh?object.instanceMatrix.count:1;maxInstances+=object.isInstancedMesh?count:0;triangles+=(object.geometry.index?object.geometry.index.count:object.geometry.attributes.position.count)/3*count;}
    if(object.isInstancedMesh)instanceMeshes.push(object);
  });
  assert.ok(drawCalls<=8,`Station destruction must fit eight draw calls, found ${drawCalls}`);
  assert.equal(maxInstances,112);assert.equal(points,144);assert.ok(triangles<1500);assert.equal(textures.size,2);
  const resources=[...geometries,...materials,...textures,...instanceMeshes],disposeCounts=new Map(resources.map(resource=>[resource,0]));
  for(const resource of resources)resource.addEventListener('dispose',()=>disposeCounts.set(resource,disposeCounts.get(resource)+1));
  const fires=effect.group.getObjectByName('Thirty-two fireball and facade flame lobes');
  const smoke=effect.group.getObjectByName('Thirty-two rising soot clouds');
  const debris=effect.group.getObjectByName('Forty-eight station facade and roof fragments');
  const sparks=effect.group.getObjectByName('One hundred forty-four incandescent embers');
  assert.equal(effect.group.visible,false);assert.deepEqual(effect.update(0),{active:false,flash:0,shake:0});
  const event={x:43,z:-7,time:100,seed:47};
  effect.start(event);assert.equal(effect.group.visible,false,'A late event cannot render its first frame before update uses the real clock');
  let result=effect.update(100);assert.equal(result.active,true);assert.ok(result.flash>.5&&result.flash<1);assert.equal(result.shake,0);
  for(const time of[100.12,100.3,100.8,101.4,104.5])assert.equal(effect.update(time).flash,0,'Only the initial120ms may flash');
  result=effect.update(100.6);assert.ok(result.shake>0&&result.shake<1);
  effect.update(101);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  let largestFire=0,minFront=Infinity,maxFront=-Infinity;
  for(let i=0;i<fires.count;i++){
    fires.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
    if(fires.geometry.attributes.aOpacity.getX(i)<.01)continue;
    largestFire=Math.max(largestFire,scale.x);if(position.z<-25){minFront=Math.min(minFront,position.x);maxFront=Math.max(maxFront,position.x);}
  }
  assert.ok(largestFire>=50&&largestFire<=56.01,'The station fireball must reach roughly56m in diameter');
  assert.ok(maxFront-minFront>=70,'The chain must engulf the station facade, not only the planted site');
  effect.update(104);let smokeTop=0;
  for(let i=0;i<smoke.count;i++){smoke.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);if(smoke.geometry.attributes.aOpacity.getX(i)>.01)smokeTop=Math.max(smokeTop,position.y+scale.y/2);}
  assert.ok(smokeTop>=60,'The late smoke column must visibly tower above the station');
  assert.ok(smoke.material.transparent&&smoke.material.depthWrite===false);

  function snapshot(time,options){
    const result=effect.update(time,options),state=[];
    effect.group.traverse(object=>{
      if(!object.isMesh&&!object.isPoints)return;
      state.push({name:object.name,visible:object.visible,count:object.count,position:object.position.toArray(),scale:object.scale.toArray(),opacity:object.material.opacity,
        matrix:object.isInstancedMesh?Array.from(object.instanceMatrix.array):null,
        attributes:Object.fromEntries(Object.entries(object.geometry.attributes).filter(([name])=>name==='aOpacity'||name==='aAngle'||name==='aTint'||object.isPoints&&name==='position').map(([name,attribute])=>[name,Array.from(attribute.array)]))});
    });
    return {result,state};
  }
  const direct=snapshot(101.4);
  effect.start(event);for(let i=0;i<=42;i++)effect.update(100+i/30);assert.deepEqual(snapshot(101.4),direct,'30fps must match the same absolute-time frame');
  effect.start(event);for(let i=0;i<=84;i++)effect.update(100+i/60);assert.deepEqual(snapshot(101.4),direct,'60fps must match the same absolute-time frame');
  effect.update(105);assert.deepEqual(snapshot(101.4),direct,'Revisiting a time cannot depend on previous update order');
  effect.start(event);assert.deepEqual(snapshot(101.4),direct,'Restarting the same seeded event produces the same positions and colors');
  effect.start({...event,seed:48});assert.notDeepEqual(snapshot(101.4),direct,'Different host seeds may vary the cinematic');
  effect.start(event);const quiet=snapshot(101.4,{reducedMotion:true});assert.deepEqual(quiet.result,{active:true,flash:0,shake:0});
  assert.equal(debris.count,0);assert.equal(debris.visible,false);assert.equal(sparks.geometry.drawRange.count,0);
  effect.group.traverse(object=>{if(object.name.includes('pressure front'))assert.equal(object.visible,false);});
  assert.deepEqual(snapshot(101.4),direct,'Reduced motion cannot alter a subsequent normal frame');

  effect.start(event);assert.deepEqual(effect.update(120),{active:false,flash:0,shake:0});assert.equal(effect.group.visible,false);assert.equal(fires.count,0);assert.equal(smoke.count,0);assert.equal(debris.count,0);
  effect.start(event);assert.deepEqual(effect.update(99),{active:false,flash:0,shake:0},'An event cannot play before its timestamp');
  effect.update(101);effect.reset();assert.equal(effect.group.visible,false);assert.deepEqual(effect.update(101),{active:false,flash:0,shake:0});assert.equal(effect.group.userData.event,undefined);
  for(let round=0;round<30;round++){
    effect.start({...event,seed:round,time:round*10});
    for(let frame=0;frame<180;frame++){const sample=effect.update(round*10+frame/30);assert.ok(Number.isFinite(sample.flash)&&Number.isFinite(sample.shake));}
    effect.reset();
  }
  effect.start({x:NaN,z:Infinity,time:NaN,seed:Infinity});effect.update(1);
  effect.group.traverse(object=>{
    if(object.isInstancedMesh)for(const value of object.instanceMatrix.array)assert.ok(Number.isFinite(value));
    if(object.isPoints)for(const value of object.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
  });
  const current=new Set();effect.group.traverse(object=>{if(!object.isMesh&&!object.isPoints)return;current.add(object.geometry);current.add(object.material);if(object.isInstancedMesh)current.add(object);for(const uniform of Object.values(object.material.uniforms||{}))if(uniform.value?.isTexture)current.add(uniform.value);});
  assert.deepEqual([...current].map(resource=>resource.uuid).sort(),resources.map(resource=>resource.uuid).sort(),'Repeated rounds cannot allocate more GPU resources');
  effect.dispose();assert.equal(effect.group.parent,null);assert.equal(effect.group.visible,false);assert.equal(effect.group.children.length,0);
  for(const count of disposeCounts.values())assert.equal(count,1,'Every owned geometry/material/texture/instance buffer must be disposed exactly once');
  effect.dispose();effect.start(event);assert.deepEqual(effect.update(101),{active:false,flash:0,shake:0});
  for(const count of disposeCounts.values())assert.equal(count,1);
  console.log('PASS: station-wide blast scale, tall black smoke, bounded resources, absolute-time/seed determinism, late event handling, reduced motion, round reset and complete disposal');
  console.log(JSON.stringify({drawCalls,maxInstances,points,triangles,geometries:geometries.size,materials:materials.size,textures:textures.size,largestFire:Number(largestFire.toFixed(1)),stationChainWidth:Number((maxFront-minFront).toFixed(1)),smokeTop:Number(smokeTop.toFixed(1))}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
