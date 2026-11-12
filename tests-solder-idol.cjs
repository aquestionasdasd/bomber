const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

// Captured from the public procedural avatar before the authorized Idol change
// (source helper baseline fe9253). Colors are deliberately outside the grip contract.
const PRESERVED = Object.freeze({
  handR: '052b68b92da17b81dbae567130ff61efedbafb5adaa6b6356aa30fc5afe00319',
  handL: '052b68b92da17b81dbae567130ff61efedbafb5adaa6b6356aa30fc5afe00319',
  band: 'c791870b85ad3fe0077fc6d2114d65de8322ccd982f0f589fdf587bf44d622ec',
  legacy: '47da1ac867c2c3063cb1f148c9473eb49e8ea75274c5983e56718fb2151ac778',
});
const SOURCE_SHA = '3e97172a521008b4a3080fd2b4e8caa368dc9a09647f02a317a18e4f218606a5';
const GENERATED_FRAMES = ['body','head','armR','armL','foreR','foreL','thighR','thighL','shinR','shinL','shoeR','shoeL'].sort();
const sha = data => createHash('sha256').update(data).digest('hex');
const bytesOf = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
function geometryContractHash(geometry) {
  const hash = createHash('sha256'); hash.update(geometry.type);
  for (const name of ['position','normal','uv']) {
    const a = geometry.getAttribute(name); if (!a) continue;
    hash.update(name); hash.update(bytesOf(a.array));
  }
  if (geometry.index) { hash.update('index'); hash.update(bytesOf(geometry.index.array)); }
  return hash.digest('hex');
}
function legacyHash(model) {
  const hash = createHash('sha256');
  for (const mesh of model.meshes) {
    hash.update(geometryContractHash(mesh.geometry));
    hash.update(JSON.stringify([!!mesh.userData.head, !!mesh.userData.bot]));
  }
  return hash.digest('hex');
}
function visible(object) {
  for (let parent=object; parent; parent=parent.parent) if (!parent.visible) return false;
  return true;
}
function avatarMeshes(model) {
  const result=[];
  model.group.traverse(object => {
    if (object.isMesh && object.userData.character==='ember' && object.name.startsWith('Solder avatar / ')) result.push(object);
  });
  return result;
}
const generatedMeshes = model => avatarMeshes(model).filter(mesh => mesh.geometry.userData.idolFrame);
function resources(meshes) {
  const geometries=new Set(), materials=new Set(), textures=new Set();
  for (const mesh of meshes) {
    geometries.add(mesh.geometry);
    for (const material of [].concat(mesh.material)) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  }
  return {geometries, materials, textures};
}
function checkPreserved(model,legacyMeshes=model.meshes) {
  const meshes=avatarMeshes(model);
  for (const frame of ['handR','handL']) {
    const hands=meshes.filter(mesh=>mesh.parent.name.endsWith('/ '+frame));
    assert.equal(hands.length,1,frame+' remains one original grip mesh');
    assert.equal(geometryContractHash(hands[0].geometry),PRESERVED[frame],frame+' position/normal/UV/index are unchanged');
  }
  const band=meshes.filter(mesh=>mesh.name.includes('team chest band'));
  assert.equal(band.length,1); assert.equal(geometryContractHash(band[0].geometry),PRESERVED.band);
  // Warming additional weapons appends their existing hit meshes to kit.meshes.
  // The original default-weapon/body set must keep the same 52 references/bytes.
  assert.equal(legacyMeshes.length,52);assert.deepEqual(model.meshes.slice(0,52),legacyMeshes);
  assert.equal(legacyHash({meshes:legacyMeshes}),PRESERVED.legacy);
}

async function main() {
  const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [THREE,{createAgentModel},{SOLDER_IDOL_META:meta,SOLDER_IDOL_DATA:data}]=await Promise.all([
    load('vendor/three.module.js'),load('agent-model.js'),load('solder-idol-asset.js'),
  ]);
  assert.equal(meta.version,1); assert.equal(meta.source_sha256,SOURCE_SHA,'The asset comes from the accepted complete Euler50 generation');
  const payload=Uint8Array.from(Buffer.from(data,'base64'));
  assert.equal(payload.byteLength,meta.bytes); assert.equal(sha(payload),meta.binary_sha256);
  assert.equal(meta.parts.length,12); assert.deepEqual(meta.parts.map(part=>part.frame).sort(),GENERATED_FRAMES);
  function array(entry,key) {
    const Type=entry.type==='f'?Float32Array:entry.type==='H'?Uint16Array:entry.type==='I'?Uint32Array:null;
    assert.ok(Type,key+' has a supported binary element type');
    assert.ok(Number.isSafeInteger(entry.offset)&&entry.offset>=0&&entry.offset%Type.BYTES_PER_ELEMENT===0);
    assert.ok(Number.isSafeInteger(entry.count)&&entry.count>0);
    assert.ok(entry.offset+entry.count*Type.BYTES_PER_ELEMENT<=payload.byteLength,key+' stays inside the decoded payload');
    if (key!=='index') assert.equal(entry.type,'f'); else assert.ok(entry.type==='H'||entry.type==='I');
    return new Type(payload.buffer,entry.offset,entry.count);
  }
  function checkTopology(attributes,frame){
    // Color/normal seams duplicate vertices. Weld only exactly equal positions,
    // then check surface orientation independently of authored shading normals.
    const welded=new Map(),vertexIds=[],edges=new Map();let signedVolume=0;
    for(let i=0;i<attributes.position.length;i+=3){
      const key=Array.from(attributes.position.subarray(i,i+3)).join(',');
      if(!welded.has(key))welded.set(key,welded.size);vertexIds.push(welded.get(key));
    }
    for(let i=0;i<attributes.index.length;i+=3){
      const indices=Array.from(attributes.index.subarray(i,i+3)),ids=indices.map(index=>vertexIds[index]);
      assert.equal(new Set(ids).size,3,frame+' has no collapsed triangles');
      const [a,b,c]=indices.map(index=>attributes.position.subarray(index*3,index*3+3));
      signedVolume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
      for(let k=0;k<3;k++){
        const a=ids[k],b=ids[(k+1)%3],key=a<b?a+','+b:b+','+a,edge=edges.get(key)||{count:0,direction:0};
        edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);
      }
    }
    assert.ok(signedVolume>1e-8,frame+' has outward triangle winding, not an inside-out closed shell');
    for(const edge of edges.values()){
      assert.ok(edge.count>=2,frame+' has no open boundary edges after exact seam welding');
      assert.equal(edge.direction,0,frame+' shared edges have balanced opposite winding');
    }
    // Balanced cap junctions can have four incident faces. Report them rather
    // than calling a closed rendering surface a strictly two-manifold mesh.
    return {frame,signedVolume,nonManifoldEdges:[...edges.values()].filter(edge=>edge.count!==2).length};
  }
  const decoded=new Map(),topology=[]; let triangleCount=0;
  for (const part of meta.parts) {
    assert.ok(Number.isSafeInteger(part.vertices)&&part.vertices>0);
    assert.ok(Number.isSafeInteger(part.triangles)&&part.triangles>0);
    const attributes=Object.fromEntries(['position','normal','color','index'].map(key=>[key,array(part[key],key)]));
    for (const key of ['position','normal','color']) {
      assert.equal(attributes[key].length,part.vertices*3,part.frame+' '+key+' count');
      for (const value of attributes[key]) assert.ok(Number.isFinite(value),part.frame+' finite '+key);
    }
    assert.equal(attributes.index.length,part.triangles*3);
    for (const index of attributes.index) assert.ok(index<part.vertices,part.frame+' index belongs to this part');
    for (const value of attributes.color) assert.ok(value>=0&&value<=1,part.frame+' linear vertex colors stay in [0,1]');
    for (let i=0;i<attributes.normal.length;i+=3) {
      const length=Math.hypot(attributes.normal[i],attributes.normal[i+1],attributes.normal[i+2]);
      assert.ok(Math.abs(length-1)<.015,part.frame+' has normalized, nonzero shading normals');
    }
    topology.push(checkTopology(attributes,part.frame));
    decoded.set(part.frame,attributes); triangleCount+=part.triangles;
  }
  // Negative control for the v2 export defect: intact but inverted shells must
  // fail the same check, even though their normals/finite arrays look valid.
  for(const frame of ['armL','thighR']){
    const attributes=decoded.get(frame),inverted=attributes.index.slice();
    for(let i=0;i<inverted.length;i+=3)[inverted[i+1],inverted[i+2]]=[inverted[i+2],inverted[i+1]];
    assert.throws(()=>checkTopology({...attributes,index:inverted},frame),/outward triangle winding/);
  }
  assert.equal(triangleCount,meta.triangles);
  assert.ok(triangleCount>=10000&&triangleCount<=25000,'The complete generated body stays near the planned 20k triangle budget');
  console.log('PASS: accepted generation provenance, complete twelve-part binary, finite attributes, outward closed winding, indices, normals and bounded triangles');

  const blue=createAgentModel(THREE,{bot:{id:'idol-blue'},team:'blue',character:'ember'});
  const red=createAgentModel(THREE,{bot:{id:'idol-red'},team:'red',character:'ember'});
  const originalBlueHitMeshes=[...blue.meshes];
  const reference=createAgentModel(THREE,{bot:{id:'original-rig'},team:'blue',character:'nope'});
  const blueParts=generatedMeshes(blue), redParts=generatedMeshes(red);
  assert.equal(blueParts.length,12); assert.equal(redParts.length,12);
  assert.deepEqual(blueParts.map(mesh=>mesh.geometry.userData.idolFrame).sort(),GENERATED_FRAMES);
  for (const mesh of blueParts) {
    const frame=mesh.geometry.userData.idolFrame, attributes=decoded.get(frame);
    assert.ok(mesh.material.isMeshStandardMaterial,'Every generated body part supports the existing enemy-rim shader');
    assert.equal(mesh.material.vertexColors,true); assert.equal(mesh.material.transparent,false);
    assert.equal(mesh.material.opacity,1); assert.equal(mesh.material.depthTest,true); assert.equal(mesh.material.depthWrite,true);
    assert.equal(mesh.userData.bot.id,'idol-blue'); assert.equal(mesh.userData.solid,false);
    assert.equal(mesh.userData.head,frame==='head'); assert.equal(mesh.userData.hitZone,frame==='head'?'head':'body');
    assert.equal(blue.meshes.includes(mesh),false,'Generated visible hit surfaces do not replace the 52 original references');
    for (const key of ['position','normal','color']) assert.deepEqual(bytesOf(mesh.geometry.getAttribute(key).array),bytesOf(attributes[key]),frame+' uses the delivered '+key+' data');
    assert.deepEqual(bytesOf(mesh.geometry.index.array),bytesOf(attributes.index));
    assert.equal(mesh.geometry,redParts.find(other=>other.geometry.userData.idolFrame===frame).geometry,'Both teams share generated geometry');
  }
  checkPreserved(blue); checkPreserved(red);
  const band=model=>avatarMeshes(model).find(mesh=>mesh.name.includes('team chest band'));
  assert.notEqual(band(blue).material.color.getHex(),band(red).material.color.getHex());
  let draws=0,totalTriangles=0;
  blue.group.traverseVisible(mesh=>{if(mesh.isMesh){draws++;totalTriangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;}});
  assert.ok(draws<=64&&totalTriangles<=50000,'The full held-weapon avatar retains the established multiplayer budget');
  console.log('PASS: exact delivered geometry, original hands/team band/52 hit meshes, team identity and total render budget');

  const originalBlue=new Map(blueParts.map(mesh=>[mesh,mesh.material]));
  const originalRed=new Map(redParts.map(mesh=>[mesh,mesh.material]));
  const raycasts=new Map(redParts.map(mesh=>[mesh,mesh.raycast]));
  red.update(0,{enemyRim:true});
  for (const mesh of redParts) {
    assert.notEqual(mesh.material,originalRed.get(mesh));
    assert.ok(mesh.material.customProgramCacheKey().endsWith('|enemy-rim-v2'),mesh.geometry.userData.idolFrame+' receives the actual enemy shader');
    assert.equal(mesh.raycast,raycasts.get(mesh));
  }
  for (const mesh of blueParts) assert.equal(mesh.material,originalBlue.get(mesh),'An allied borrower is not recolored');
  red.update(0,{enemyRim:false});
  for (const mesh of redParts) assert.equal(mesh.material,originalRed.get(mesh));
  console.log('PASS: all twelve generated parts receive the enemy rim, allies and raycasts remain unchanged');

  blue.group.updateMatrixWorld(true);
  const head=blueParts.find(mesh=>mesh.geometry.userData.idolFrame==='head');
  const headBox=new THREE.Box3().setFromObject(head), center=headBox.getCenter(new THREE.Vector3()), size=headBox.getSize(new THREE.Vector3());
  assert.ok(size.x>.15&&size.y>.20&&size.z>.12,'The accepted head is a complete 3D volume, not a surviving fragment');
  const headCoverage=[];
  for (const axis of ['x','z']) for (const sign of [-1,1]) {
    let hits=0;
    const lateral=axis==='x'?'z':'x';
    for (const x of [-.30,-.15,0,.15,.30]) for (const y of [-.30,-.15,0,.15,.30]) {
      const target=center.clone();target[lateral]+=size[lateral]*x;target.y+=size.y*y;
      const origin=target.clone();origin[axis]+=sign*2;
      const ray=new THREE.Raycaster(origin,target.clone().sub(origin).normalize(),0,4), found=[];
      head.raycast(ray,found);
      if(found.length){hits++;assert.ok(found.every(hit=>hit.object.userData.hitZone==='head'&&hit.object.userData.bot.id==='idol-blue'));}
    }
    assert.ok(hits>=12,axis+sign+' sees a filled central head region from the generated surface');headCoverage.push(hits);
  }
  for (const [height,zone] of [[1.65,'head'],[1.17,'body']]) {
    const hit=new THREE.Raycaster(new THREE.Vector3(0,height,5),new THREE.Vector3(0,0,-1),0,10).intersectObject(blue.group,true)[0];
    assert.ok(hit);assert.equal(hit.hitZone==='head'||hit.object.userData.head===true,zone==='head','Established head/body shot remains correctly classified');
  }
  for (const frame of ['foreR','foreL']) {
    const mesh=blueParts.find(part=>part.geometry.userData.idolFrame===frame), box=new THREE.Box3().setFromObject(mesh), c=box.getCenter(new THREE.Vector3()), s=box.getSize(new THREE.Vector3());
    let hits=0;
    for(const x of [-.25,0,.25])for(const y of [-.25,0,.25]) {
      const origin=new THREE.Vector3(c.x+s.x*x,c.y+s.y*y,c.z+2), found=[];
      mesh.raycast(new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1),0,4),found);
      for(const hit of found){assert.equal(hit.object.userData.hitZone,'body');hits++;}
    }
    assert.ok(hits>0,frame+' is present and hittable as body');
  }
  for(const mesh of blue.meshes.filter(mesh=>mesh.userData.head))assert.equal(new THREE.Raycaster(new THREE.Vector3(0,1.65,5),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length,0,'Hidden original helmets cannot award headshots');
  console.log('PASS: four-sided generated head coverage, both forearms, actual head/body rays and disabled original helmets');

  const weapons=['vandal','phantom','spectre','classic','ghost','knife'];
  for(const model of [blue,reference])for(const weapon of weapons)model.update(0,{weapon,alive:true});
  const modelResources=model=>{const meshes=[];model.group.traverse(object=>{if(object.isMesh)meshes.push(object);});return resources(meshes);};
  const beforeResources=modelResources(blue), matrices=(a,b,label)=>{
    for(let i=0;i<16;i++)assert.ok(Math.abs(a.elements[i]-b.elements[i])<1e-10,label);
  };
  let elapsed=0,sequence=0,poseFrames=0;
  const poses=[{}, {moving:true}, {firing:true}, {crouch:1}, {sliding:true,moving:true}, {planting:true}, {defusing:true}, {alive:false}, {alive:true}];
  for(const weapon of weapons)for(const pose of poses)for(let frame=0;frame<12;frame++) {
    elapsed+=1/60;if(frame===0&&pose.firing)sequence++;
    const state={weapon,alive:true,moving:false,firing:false,crouch:0,sliding:false,planting:false,defusing:false,time:elapsed,shotSequence:sequence,...pose};
    blue.update(1/60,state);reference.update(1/60,state);blue.group.updateMatrixWorld(true);reference.group.updateMatrixWorld(true);
    for(let i=0;i<blue.meshes.length;i++)matrices(blue.meshes[i].matrixWorld,reference.meshes[i].matrixWorld,'Original combat/weapon pose unchanged');
    matrices(head.parent.matrixWorld,blue.head.matrixWorld,'Generated head follows original head animation');
    for(const side of ['R','L']) {
      const palm=blue['arm'+side].children.find(object=>object.isGroup), boot=blue['leg'+side].children.find(object=>object.isGroup);
      const hand=avatarMeshes(blue).find(mesh=>mesh.parent.name.endsWith('/ hand'+side));
      const shoe=blueParts.find(mesh=>mesh.geometry.userData.idolFrame==='shoe'+side);
      matrices(hand.parent.matrixWorld,palm.matrixWorld,'Preserved hand follows its original weapon grip');
      matrices(shoe.parent.matrixWorld,boot.matrixWorld,'Generated shoe follows its original foot attachment');
    }
    blue.group.traverseVisible(object=>{for(const value of object.matrixWorld.elements)assert.ok(Number.isFinite(value));});
    for(const mesh of blueParts)assert.ok(mesh.matrixWorld.determinant()>0,'Animated attachments preserve outward winding without a mirrored transform');
    assert.equal(blue.muzzle.visible,reference.muzzle.visible);poseFrames++;
  }
  const afterResources=modelResources(blue);
  for(const key of ['geometries','materials','textures'])assert.deepEqual(afterResources[key],beforeResources[key],'Animation reuses '+key);
  checkPreserved(blue,originalBlueHitMeshes);reference.dispose();
  for(let i=0;i<20;i++) {
    blue.update(0,{character:'nope',alive:true});
    for(const mesh of blueParts){assert.equal(visible(mesh),false);const hits=[];mesh.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0);}
    blue.update(0,{character:'ember',alive:true});
    assert.deepEqual(generatedMeshes(blue),blueParts);assert.ok(blueParts.every(visible));
  }
  console.log('PASS: six weapons, standing/walking/firing/crouch/slide/work/death/revival, unchanged grips and allocation-free appearance updates');

  const shared=resources([...avatarMeshes(blue),...avatarMeshes(red)]), counts=new Map();
  for(const object of [...shared.geometries,...shared.materials,...shared.textures]){counts.set(object,0);object.addEventListener('dispose',()=>counts.set(object,counts.get(object)+1));}
  blue.dispose();blue.dispose();for(const count of counts.values())assert.equal(count,0,'Another worker still owns the shared assets');
  red.dispose();red.dispose();for(const count of counts.values())assert.equal(count,1,'Final worker disposes each shared resource once');
  const fresh=createAgentModel(THREE,{bot:{id:'idol-fresh'},team:'blue',character:'ember'}), freshParts=generatedMeshes(fresh);
  for(const mesh of freshParts){assert.equal(shared.geometries.has(mesh.geometry),false);for(const key of ['position','normal','color'])assert.deepEqual(bytesOf(mesh.geometry.getAttribute(key).array),bytesOf(decoded.get(mesh.geometry.userData.idolFrame)[key]));}
  checkPreserved(fresh);fresh.dispose();fresh.dispose();
  console.log('PASS: shared cache ownership, repeated disposal and deterministic reconstruction without resurrecting GPU resources');
  console.log(JSON.stringify({generatedParts:12,generatedTriangles:triangleCount,totalTriangles,draws,headCoverage,poseFrames,topology,audioPlayback:false}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
