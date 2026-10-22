const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function main(){
  const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [THREE,{createObjectiveModel},{MatchRules}]=await Promise.all([load('vendor/three.module.js'),load('objective-model.js'),load('rules.js')]);
  const started=performance.now(),device=createObjectiveModel(THREE),buildMs=performance.now()-started;
  assert.ok(device.group.isGroup);assert.equal(device.group.visible,false);
  const scene=new THREE.Scene();scene.add(device.group);
  const geometrySet=new Set(),materialSet=new Set(),textureSet=new Set(),instanceMeshes=[];let meshes=0,instances=0,triangles=0;
  device.group.traverse(object=>{
    if(!object.isMesh)return;meshes++;geometrySet.add(object.geometry);
    assert.equal(object.userData.solid,false,'The objective is cosmetic and cannot create a collision or bullet shield');
    const hits=[];object.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0);
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      materialSet.add(material);for(const value of Object.values(material))if(value?.isTexture)textureSet.add(value);
    }
    const count=object.isInstancedMesh?object.instanceMatrix.count:1;instances+=object.isInstancedMesh?count:0;
    if(object.isInstancedMesh)instanceMeshes.push(object);
    triangles+=(object.geometry.index?object.geometry.index.count:object.geometry.attributes.position.count)/3*count;
    const positions=object.geometry.getAttribute('position');for(const value of positions.array)assert.ok(Number.isFinite(value));
  });
  assert.ok(meshes<=22,`The device must stay within 22 draw calls, found ${meshes}`);
  assert.ok(triangles<6500,`Fabrication detail must fit a modest triangle budget, found ${triangles}`);
  assert.ok(textureSet.size<=3,'Finishes and displays must share a small fixed set of textures');
  assert.ok(geometrySet.size<meshes,'At least one geometry must be shared');
  const resources=[...geometrySet,...materialSet,...textureSet],disposeCounts=new Map(resources.map(resource=>[resource,0]));
  for(const resource of resources)resource.addEventListener('dispose',()=>disposeCounts.set(resource,disposeCounts.get(resource)+1));
  const instanceDisposeCounts=new Map(instanceMeshes.map(mesh=>[mesh,0]));
  for(const mesh of instanceMeshes)mesh.addEventListener('dispose',()=>instanceDisposeCounts.set(mesh,instanceDisposeCounts.get(mesh)+1));
  const screen=device.group.getObjectByName('Recessed countdown and disarm display');
  assert.ok(screen&&screen.material.map.isDataTexture,'The display works without document/canvas');
  const displayTexture=screen.material.map;

  function visibleBounds(){
    device.group.updateMatrixWorld(true);const bounds=new THREE.Box3(),matrix=new THREE.Matrix4(),instance=new THREE.Matrix4();
    device.group.traverseVisible(object=>{
      if(!object.isMesh)return;object.geometry.computeBoundingBox();
      if(object.isInstancedMesh){for(let i=0;i<object.count;i++){object.getMatrixAt(i,instance);matrix.multiplyMatrices(object.matrixWorld,instance);bounds.union(object.geometry.boundingBox.clone().applyMatrix4(matrix));}}
      else bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
    });
    return bounds;
  }
  function poseFinite(){
    device.group.updateMatrixWorld(true);device.group.traverse(object=>{
      for(const value of object.matrixWorld.elements)assert.ok(Number.isFinite(value),'State updates cannot produce invalid transforms');
      if(object.isInstancedMesh)for(const value of object.instanceMatrix.array)assert.ok(Number.isFinite(value));
    });
  }
  device.update({time:0,status:'dropped'});
  assert.equal(device.group.visible,true);assert.equal(device.group.userData.deployment,0);assert.equal(device.group.userData.display.mode,'SAFE');
  const foldedBounds=visibleBounds(),foldedSize=foldedBounds.getSize(new THREE.Vector3());
  assert.ok(foldedSize.x<.8&&foldedSize.z<.8,'Folded legs must fit a compact carried case silhouette');
  assert.ok(foldedSize.y>.6&&foldedSize.y<.9,'The device stays at a believable world scale');
  const initialVersion=displayTexture.version;
  for(let i=1;i<50;i++)device.update({time:i*.01,status:'dropped'});
  assert.equal(displayTexture.version,initialVersion,'A quiet safe display must not upload every frame');

  device.update({time:1,status:'planted',timer:45});
  device.update({time:1.24,status:'planted',timer:45});
  assert.ok(device.group.userData.deployment>.2&&device.group.userData.deployment<.8,'Hinges must animate rather than switch models');
  device.update({time:1.5,status:'planted',timer:45});
  assert.equal(device.group.userData.deployment,1);
  const plantedBounds=visibleBounds(),plantedSize=plantedBounds.getSize(new THREE.Vector3());
  assert.ok(plantedSize.x>1&&plantedSize.x<1.4&&plantedSize.z<1.4,'Deployed legs stay inside the small objective footprint');
  assert.ok(plantedBounds.min.y>=-.001&&plantedBounds.min.y<=.005,'Deployed rubber shoes must meet the floor without sinking or visibly hovering');
  assert.ok(plantedBounds.max.y<.9);
  const plantedVersion=displayTexture.version;
  for(let i=0;i<30;i++)device.update({time:1.51+i*.01,status:'planted',timer:44.8});
  assert.equal(displayTexture.version,plantedVersion,'The countdown uploads only when its displayed second changes');
  device.update({time:2,status:'planted',timer:43.9});
  assert.equal(device.group.userData.display.seconds,44);assert.equal(displayTexture.version,plantedVersion+1);
  device.update({time:2.1,status:'planted',timer:40,defuseProgress:1.75});
  assert.equal(device.group.userData.display.mode,'DEFUSE');assert.equal(device.group.userData.display.progress,.25);
  assert.equal(device.group.userData.display.seconds,40,'Main digits remain the detonation timer during a defuse');
  device.update({time:2.2,status:'planted',timer:39,defuseProgress:3.5,checkpoint:3.5});
  assert.equal(device.group.userData.display.mode,'HELD');assert.equal(device.group.userData.display.checkpoint,true);assert.equal(device.group.userData.display.progress,.5);
  device.update({time:2.3,status:'planted',timer:38,defuseProgress:4,checkpoint:3.5});
  assert.equal(device.group.userData.display.mode,'DEFUSE');assert.equal(device.group.userData.display.checkpoint,true);
  device.update({time:3,status:'dropped',plantProgress:2});
  assert.equal(device.group.userData.display.mode,'PLANT');assert.equal(device.group.userData.display.seconds,2);
  device.update({time:3.6,status:'dropped'});assert.equal(device.group.userData.deployment,0);
  for(const status of['carried','hidden','defused','detonated']){device.update({time:4,status});assert.equal(device.group.visible,false);}

  device.update({time:4.1,status:'planted',timer:45,practice:true});
  device.update({time:4.6,status:'planted',timer:45,practice:true});
  assert.equal(device.group.visible,true);assert.equal(device.group.userData.deployment,1);
  assert.equal(device.group.userData.display.mode,'TRAIN');
  assert.equal(device.group.userData.display.seconds,null,'Practice must not display a detonation countdown');
  const practiceVersion=displayTexture.version;
  device.update({time:4.61,status:'planted',timer:45,practice:true});
  assert.equal(displayTexture.version,practiceVersion,'A quiet training display must reuse its texture without uploading each frame');
  device.update({time:4.62,status:'planted',timer:11,defuseProgress:1.75,practice:true});
  assert.equal(device.group.userData.display.mode,'DEFUSE');
  assert.equal(device.group.userData.display.seconds,null,'Disarming practice must keep the main countdown digits blank');
  assert.equal(device.group.userData.display.progress,.25);assert.equal(device.group.userData.display.checkpoint,false);
  device.update({time:4.63,status:'planted',timer:10,defuseProgress:3.5,checkpoint:3.5,practice:true});
  assert.equal(device.group.userData.display.mode,'HELD');assert.equal(device.group.userData.display.seconds,null);
  assert.equal(device.group.userData.display.progress,.5);assert.equal(device.group.userData.display.checkpoint,true);
  device.update({time:4.64,status:'planted',timer:9,defuseProgress:4,checkpoint:3.5,practice:true});
  assert.equal(device.group.userData.display.mode,'DEFUSE');assert.equal(device.group.userData.display.seconds,null);
  assert.equal(device.group.userData.display.progress,4/7,'Continuing from the practice checkpoint must retain disarm progress');
  assert.equal(device.group.userData.display.checkpoint,true);
  device.update({time:4.65,status:'defused',defuseProgress:7,checkpoint:3.5,practice:true});
  assert.equal(device.group.visible,true,'A completed practice device must remain available for inspection');
  assert.equal(device.group.userData.display.mode,'SAFE');assert.equal(device.group.userData.display.seconds,null);
  assert.equal(device.group.userData.deployment,1,'A safely defused practice device must keep its landing legs deployed');
  poseFinite();
  device.update({time:4.66,status:'defused',practice:false});
  assert.equal(device.group.visible,false,'The practice option must not change the normal match defused visibility');

  device.group.position.set(12,.5,-7);device.group.rotation.set(.1,.6,.2);device.group.scale.setScalar(1.2);
  const externalTransform={position:device.group.position.clone(),rotation:device.group.rotation.clone(),scale:device.group.scale.clone()};
  device.update({time:5,status:'planted'});device.update({time:6,status:'planted'});
  assert.ok(device.group.position.equals(externalTransform.position));assert.ok(device.group.rotation.equals(externalTransform.rotation));assert.ok(device.group.scale.equals(externalTransform.scale));
  for(const input of[
    {time:NaN,timer:Infinity,plantProgress:NaN,defuseProgress:-100,checkpoint:Infinity},
    {time:-5,timer:-100,plantProgress:100,defuseProgress:100,checkpoint:100},
  ]){device.update({status:'planted',...input});poseFinite();assert.ok(device.group.userData.display.progress>=0&&device.group.userData.display.progress<=1);}
  const completedMatch=new MatchRules({startingSide:'attack'});assert.equal(completedMatch.startLive(),true);
  assert.equal(completedMatch.interactPlant(4,{actorId:'player',team:completedMatch.attackerTeam,site:'A',x:-38,z:-23}),true);
  assert.equal(completedMatch.spike.status,'planted');assert.equal(completedMatch.spike.plantProgress,4);
  device.update({...completedMatch.spike,time:7,practice:true});device.update({...completedMatch.spike,time:7.5,practice:true});
  assert.equal(device.group.userData.display.mode,'TRAIN');assert.equal(device.group.userData.display.seconds,null);
  assert.equal(completedMatch.interactDefuse(7,{actorId:'red-0',team:completedMatch.defenderTeam}),true);
  assert.equal(completedMatch.spike.status,'defused');assert.equal(completedMatch.spike.defuseProgress,7);
  assert.equal(completedMatch.spike.plantProgress,4,'The real match deliberately retains completed plant progress after defusing');
  device.update({...completedMatch.spike,time:8,practice:true});device.update({...completedMatch.spike,time:8.5,practice:true});
  assert.equal(device.group.visible,true);
  assert.equal(device.group.userData.display.mode,'SAFE','A fully defused real spike must not display PLANT because its old plant progress remains');
  assert.equal(device.group.userData.display.seconds,null);assert.equal(device.group.userData.deployment,1);poseFinite();
  device.update({...completedMatch.spike,time:8.6,practice:false});
  assert.equal(device.group.visible,false,'A normally defused real spike must remain hidden outside practice');
  const resourceReferences=resources.map(resource=>resource.uuid).sort();
  for(let i=0;i<1000;i++)device.update({time:10+i/60,status:'planted',timer:30-i/60,defuseProgress:i%400/60});
  const currentResources=new Set();device.group.traverse(object=>{if(!object.isMesh)return;currentResources.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material]){currentResources.add(material);for(const value of Object.values(material))if(value?.isTexture)currentResources.add(value);}});
  assert.deepEqual([...currentResources].map(resource=>resource.uuid).sort(),resourceReferences,'Animation must reuse GPU resources');
  device.dispose();assert.equal(device.group.parent,null);assert.equal(device.group.visible,false);assert.equal(device.group.children.length,0);
  for(const [resource,count]of disposeCounts)assert.equal(count,1,`${resource.type||'resource'} must be disposed exactly once`);
  for(const count of instanceDisposeCounts.values())assert.equal(count,1,'Instanced mesh buffers must receive their own disposal event');
  device.dispose();device.update({time:100,status:'planted'});assert.equal(device.group.visible,false);
  for(const count of disposeCounts.values())assert.equal(count,1,'Repeated teardown cannot dispose a shared resource twice');
  for(const count of instanceDisposeCounts.values())assert.equal(count,1);

  const second=createObjectiveModel(THREE);
  second.update({status:'defused',time:0,practice:true});second.update({status:'defused',time:1,practice:true});
  assert.equal(second.group.visible,true);assert.equal(second.group.userData.display.mode,'SAFE');
  assert.equal(second.group.userData.display.seconds,null);
  assert.equal(second.group.userData.deployment,1,'The defused practice state must target fully deployed legs even when entered from the folded state');
  second.update({status:'defused',time:1.1});assert.equal(second.group.visible,false,'Omitting practice must restore the default match visibility');
  second.update({status:'planted',time:2});second.update({status:'planted',time:3});
  assert.equal(second.group.userData.deployment,1);assert.equal(second.group.visible,true,'A second independent model survives the first model being disposed');
  second.dispose();
  console.log(`PASS: objective states, folding animation, clock/defuse/checkpoint and untimed practice displays, stable GPU resources, transform ownership and complete idempotent disposal`);
  console.log(JSON.stringify({buildMs:Number(buildMs.toFixed(2)),drawCalls:meshes,instances,triangles,uniqueGeometries:geometrySet.size,uniqueMaterials:materialSet.size,uniqueTextures:textureSet.size,foldedSize:foldedSize.toArray().map(v=>Number(v.toFixed(3))),plantedSize:plantedSize.toArray().map(v=>Number(v.toFixed(3))),plantedMinY:Number(plantedBounds.min.y.toFixed(4))}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
