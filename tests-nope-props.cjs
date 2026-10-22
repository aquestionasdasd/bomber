const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function main(){
  const load=name=>import(pathToFileURL(path.join(__dirname,'public',name)).href);
  const [THREE,{createNopeBottleModel},{createNopeFaceModel},{createAgentModel},{createStationTakeover}]=await Promise.all([load('vendor/three.module.js'),load('nope-props.js'),load('nope-avatar.js'),load('agent-model.js'),load('station-takeover.js')]);
  const visible=root=>{const result=[];root.traverseVisible(object=>{if(object.isMesh)result.push(object);});return result;};
  const resources=root=>{const g=new Set(),m=new Set(),t=new Set();root.traverse(object=>{if(!object.isMesh)return;g.add(object.geometry);for(const material of [].concat(object.material)){m.add(material);for(const v of Object.values(material))if(v?.isTexture)t.add(v);}});return [...g,...m,...t];};
  const observe=items=>{const counts=new Map();for(const item of items){if(counts.has(item))continue;counts.set(item,0);item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));}return counts;};
  const count=(map,n)=>{for(const value of map.values())assert.equal(value,n);};
  const rawRay=(root,origin,direction)=>{root.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction),0,5),hits=[];for(const mesh of visible(root))THREE.Mesh.prototype.raycast.call(mesh,ray,hits);return hits.sort((a,b)=>a.distance-b.distance);};

  const first=createNopeBottleModel(THREE),second=createNopeBottleModel(THREE),face=createNopeFaceModel(THREE),otherFace=createNopeFaceModel(THREE);
  assert.equal(visible(first.group).length,3);assert.equal(visible(face.group).length,3);
  const bottleMeshes=visible(first.group),faceMeshes=visible(face.group);
  for(let i=0;i<3;i++){assert.equal(bottleMeshes[i].geometry,visible(second.group)[i].geometry);assert.equal(bottleMeshes[i].material,visible(second.group)[i].material);assert.equal(faceMeshes[i].geometry,visible(otherFace.group)[i].geometry);assert.equal(faceMeshes[i].material,visible(otherFace.group)[i].material);}
  const bottleStats={draw:3,triangles:bottleMeshes.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0)};
  assert.ok(bottleStats.triangles<=1700,'The PET shell, liquid and label remain a small fixed three-draw prop');
  assert.deepEqual(first.grip,[0,.105,0]);assert.ok(Math.abs(first.height-.2795)<1e-8);
  const box=new THREE.Box3().setFromObject(first.group),size=box.getSize(new THREE.Vector3());assert.ok(size.x>=.08&&size.x<=.10&&size.y>=.27&&size.y<=.29);
  assert.ok(rawRay(first.group,[0,.13,1],[0,0,-1]).length,'The bottle has an actual rounded shell and front label');
  assert.ok(rawRay(first.group,[0,.27,1],[0,0,-1])[0].object.name.includes('hardware'),'Its neck carries a solid sealed cap');
  const label=bottleMeshes.find(m=>m.name.endsWith('label')),art=label.material.map;
  const shell=bottleMeshes.find(m=>m.name.endsWith('shell')),hardware=bottleMeshes.find(m=>m.name.endsWith('hardware'));
  assert.equal(shell.material.transparent,true);assert.equal(shell.material.depthWrite,false);assert.equal(shell.material.vertexColors,true);
  const rgba=shell.geometry.attributes.color,positions=shell.geometry.attributes.position;assert.equal(rgba.itemSize,4);
  let liquidVertices=0,clearShoulderVertices=0;
  for(let i=0;i<rgba.count;i++){
    if(rgba.getW(i)>.99&&rgba.getX(i)>rgba.getY(i)*1.8&&positions.getY(i)<.191)liquidVertices++;
    if(positions.getY(i)>.20&&rgba.getW(i)>.1&&rgba.getW(i)<.5)clearShoulderVertices++;
  }
  assert.ok(liquidVertices>200&&clearShoulderVertices>100,'Dark amber liquid ends below the visibly transparent PET shoulder');
  const bandColors=hardware.geometry.attributes.color,bandPositions=hardware.geometry.attributes.position;let blackBand=0;
  for(let i=0;i<bandColors.count;i++)if(bandPositions.getY(i)>.06&&bandPositions.getY(i)<.193&&Math.max(bandColors.getX(i),bandColors.getY(i),bandColors.getZ(i))<.02)blackBand++;
  assert.ok(blackBand>=100,'A modeled dark label band wraps behind the unchanged NOPE artwork');
  assert.equal(art.image.width,512);assert.equal(art.image.height,512);assert.equal(art.colorSpace,THREE.SRGBColorSpace);
  assert.equal(label.material.depthTest,true);assert.equal(label.material.depthWrite,true);assert.ok(label.material.alphaTest>0);
  if(art.image.data){let pink=0,ink=0,transparent=0;for(let i=0;i<art.image.data.length;i+=4){if(art.image.data[i+3]===0)transparent++;else if(art.image.data[i]>200)pink++;else ink++;}assert.ok(pink>40000&&ink>4000&&transparent>80000,'The original generated label contains pink face, dark expression and clear surrounding pixels');}
  for(const root of [first.group,face.group]){for(const mesh of visible(root)){assert.equal(mesh.userData.solid,false);const hits=[];mesh.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0);for(const value of mesh.geometry.attributes.normal.array)assert.ok(Number.isFinite(value));}}
  assert.ok(rawRay(face.group,[-.104,.096,1],[0,0,-1])[0].object.name.includes('crossed X eyes'));
  assert.ok(rawRay(face.group,[.104,.096,1],[0,0,-1])[0].object.name.includes('crossed X eyes'));
  assert.ok(rawRay(face.group,[0,-.134,1],[0,0,-1])[0].object.name.includes('wide curved smile'));
  assert.ok(rawRay(face.group,[.025,-.205,1],[0,0,-1])[0].object.name.includes('protruding tongue'));

  const agent=createAgentModel(THREE,{bot:{id:'NOPE'},character:'nope',team:'blue'}),reference=createAgentModel(THREE,{bot:{id:'reference'},character:'duelist',team:'blue'});
  assert.equal(agent.meshes.length,52);assert.equal(reference.meshes.length,52);
  for(const weapon of ['classic','ghost','spectre','vandal','phantom','knife'])for(const pose of [{},{moving:true},{firing:true},{planting:true},{defusing:true},{alive:false},{alive:true}]){
    const state={alive:true,weapon,time:2,...pose};for(let i=0;i<16;i++){agent.update(1/60,{...state,character:'nope'});reference.update(1/60,{...state,character:'duelist'});}
    agent.group.updateMatrixWorld(true);reference.group.updateMatrixWorld(true);
    assert.equal(agent.meshes.length,reference.meshes.length);
    for(let i=0;i<52;i++){const a=agent.meshes[i],b=reference.meshes[i];assert.equal(a.userData.head,b.userData.head);assert.deepEqual(Array.from(a.geometry.attributes.position.array),Array.from(b.geometry.attributes.position.array));assert.deepEqual(a.matrixWorld.elements,b.matrixWorld.elements,'The original weapon/head/body hit rig is independent of NOPE appearance');}
  }
  agent.update(1/60,{alive:true,weapon:'vandal',character:'nope',time:0});
  const avatarMeshes=visible(agent.group).filter(m=>m.userData.character==='nope');
  assert.ok(avatarMeshes.length>=20);assert.ok(avatarMeshes.some(m=>m.name.includes('team waist band')));
  for(const mesh of faceMeshes)assert.ok(avatarMeshes.some(a=>a.geometry===mesh.geometry),'The decoy uses the character face geometry itself');
  const bodyWatch=observe(avatarMeshes.map(m=>m.geometry)),faceWatch=observe(resources(face.group)),bottleWatch=observe(resources(first.group));
  const stableFace=visible(face.group).map(m=>m.geometry),stableBottle=visible(first.group).map(m=>m.geometry);
  const cachedHitCount=agent.meshes.length;
  for(let i=0;i<300;i++){agent.update(0,{character:i%2?'nope':'duelist',enemyRim:i%3===0});assert.equal(agent.meshes.length,cachedHitCount,'Role and rim changes do not add combat meshes after the fixed weapon cache is populated');}
  agent.update(0,{character:'nope',enemyRim:false});
  assert.deepEqual(visible(face.group).map(m=>m.geometry),stableFace);assert.deepEqual(visible(first.group).map(m=>m.geometry),stableBottle);
  count(bodyWatch,0);count(faceWatch,0);count(bottleWatch,0);
  const station=createStationTakeover(THREE);assert.equal(station.group.children[0].material.map,art,'Station decals, held/thrown bottles and belt bottles share one artwork lease');
  const artworkWatch=observe([art]);station.dispose();station.dispose();count(artworkWatch,0);
  first.dispose();first.dispose();count(bottleWatch,0);
  agent.dispose();agent.dispose();count(bottleWatch,0);count(faceWatch,0);
  face.dispose();face.dispose();count(faceWatch,0);
  otherFace.dispose();otherFace.dispose();count(faceWatch,1);
  // The final independent bottle outlives the character and the station.
  second.dispose();second.dispose();count(bottleWatch,1);count(artworkWatch,1);
  for(const [geometry,n]of bodyWatch)if(!faceWatch.has(geometry)&&!bottleWatch.has(geometry))assert.equal(n,1);
  reference.dispose();
  const fresh=createNopeBottleModel(THREE);assert.notEqual(visible(fresh.group)[0].geometry,bottleMeshes[0].geometry,'The last released cache can be reconstructed');fresh.dispose();
  console.log('PASS: NOPE curved face/bottle geometry, shared artwork/decoy resources, 52 exact hit proxies and six-weapon poses, 300 switches, nonhit props and final-owner disposal');
  console.log(JSON.stringify({bottle:bottleStats,face:{draw:faceMeshes.length,triangles:faceMeshes.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0)},artworkBytes:512*512*4}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
