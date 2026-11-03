const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const path=require('node:path');
const{pathToFileURL}=require('node:url');

async function main(){
 const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
 const T=await load('vendor/three.module.js'),{createHirakataModel,decodeHirakataModel}=await load('hirakata-complete-render.js'),data=await load('assets/hirakata-complete-model.js');
 const raw=Buffer.from(data.HIRAKATA_MODEL_BASE64,'base64'),array=()=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
 let checks=0;const check=(label,fn)=>{fn();checks++;console.log('PASS '+label);};
 check('embedded bytes retain reviewed source hash, with no embedded video/image/font file',()=>{
  assert.equal(raw.length,data.HIRAKATA_MODEL_PROVENANCE.bytes);
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),data.HIRAKATA_MODEL_PROVENANCE.sha256);
  assert.equal(data.HIRAKATA_MODEL_PROVENANCE.sha256,'f14ad708413e6ec880c3327fd720adf0742608097145153ec35e37ad7a68534e');
  assert.equal(data.HIRAKATA_MODEL_PROVENANCE.referencesEmbedded,false);
 });
 const began=performance.now(),model=createHirakataModel(T),createdMs=performance.now()-began;
 check('factory returns complete real Three geometry synchronously and stable named roots',()=>{
  assert.ok(model.world.isGroup);assert.equal(model.then,undefined);assert.equal(model.groups.size,36);
  for(const name of['Station_central_hall','Station_east_hall','Station_upper_Roof','South_pedestrian_deck','Park','Hirakata_Woven'])assert.ok(model.groups.get(name)?.isGroup,name);
  assert.equal(model.sourceTriangleCount,263764);assert.equal(model.meshCount,472);
  assert.equal(model.sourceTriangleCount-model.triangleCount,model.removedTriangleCount);
  assert.equal(model.removedTriangleCount,1344);assert.equal(model.northRemovedTriangleCount,896);
  const actual=[];model.world.traverse(node=>{if(node.isMesh)actual.push(node);});assert.equal(actual.length,model.meshCount);
  for(const mesh of actual){assert.ok(mesh.geometry.boundingBox);assert.ok(mesh.geometry.boundingSphere);assert.ok(mesh.userData.hirakataModule);assert.ok(Number.isFinite(mesh.geometry.boundingSphere.radius));}
 });
 check('four north static buses and two south static buses are detached; all three taxis remain',()=>{
  assert.equal(model.groups.has('North_stationary_buses'),false);assert.equal(model.world.getObjectByName('North_stationary_buses'),undefined);
  const vehicles=model.groups.get('Vehicles'),bounds=new T.Box3().setFromObject(vehicles);
  assert.ok(bounds.min.x>=-45.3&&bounds.max.x<=-28.7);assert.ok(bounds.min.z>=47&&bounds.max.z<=49);assert.ok(bounds.max.y>2);
  for(const x of[-43,-37,-31]){const ray=new T.Raycaster(new T.Vector3(x,5,48),new T.Vector3(0,-1,0));assert.ok(ray.intersectObject(vehicles,true).length,'taxi '+x);}
  for(const[x,z]of[[-42,28],[-14,56]]){const ray=new T.Raycaster(new T.Vector3(x,5,z),new T.Vector3(0,-1,0));assert.equal(ray.intersectObject(vehicles,true).length,0,'removed bus '+x);}
 });
 check('ground triangles retain separate geometry and tight bounds for collapse',()=>{
  let ground=0,upper=0;const point=new T.Vector3();
  for(const mesh of model.meshes){const a=mesh.geometry.attributes.position;if(mesh.userData.preserveGround){ground++;for(let i=0;i<a.count;i++)assert.ok(point.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld).y<=.350001);}else{upper++;const box=new T.Box3().setFromObject(mesh);assert.ok(box.max.y>.35);}}
  assert.ok(ground>10);assert.ok(upper>200);
  assert.ok(model.groupMeshes.get('Ground_and_roads').every(mesh=>mesh.userData.preserveGround));
  for(const name of['North_ground_and_rotary','Park']){const list=model.groupMeshes.get(name);assert.ok(list.some(mesh=>mesh.userData.preserveGround),name);assert.ok(list.some(mesh=>!mesh.userData.preserveGround),name);}
 });
 check('original PBR materials and reflection cube retained with restrained fill and owned fixture lights',()=>{
  assert.equal(model.materials.length,32);assert.ok(model.environment.isCubeTexture);assert.equal(model.environment.image.length,6);
  for(const face of model.environment.image){assert.ok(face.isDataTexture);assert.equal(face.image.data.length,64*64*4);}
  for(const material of model.materials){assert.equal(material.envMap,model.environment);assert.equal(material.envMapIntensity,.65);}
  const fill=model.world.children.filter(node=>node.isLight);assert.equal(fill.length,1);assert.ok(fill[0].isAmbientLight);assert.equal(fill[0].intensity,.18);
  const fixtures=[];model.world.traverse(node=>{if(node.isPointLight)fixtures.push(node);});assert.equal(fixtures.length,4);
  for(const light of fixtures){assert.equal(light.castShadow,false);assert.equal(light.intensity,18);assert.equal(light.distance,23);assert.ok(light.parent.isMesh);assert.match(light.parent.userData.hirakataModule,/^Station_(central|east)_Ceiling$/);}
  assert.ok(Math.abs(model.materials.find(m=>m.name==='light').emissiveIntensity-1.164)<1e-6);
 });
 function alteredDoc(change){
  const n=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+n).toString('utf8'));change(doc);
  const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),bin=raw.subarray(28+n),result=Buffer.alloc(28+padded.length+bin.length);
  result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(padded.length,12);result.writeUInt32LE(0x4e4f534a,16);padded.copy(result,20);result.writeUInt32LE(bin.length,20+padded.length);result.writeUInt32LE(0x004e4942,24+padded.length);bin.copy(result,28+padded.length);return result.buffer.slice(result.byteOffset,result.byteOffset+result.length);
 }
 check('malformed, truncated, unsupported and out-of-bounds GLB data fail closed',()=>{
  assert.throws(()=>decodeHirakataModel(T,new ArrayBuffer(12)),/invalid byte length/);
  const bad=array();new DataView(bad).setUint32(0,0,true);assert.throws(()=>decodeHirakataModel(T,bad),/invalid header/);
  assert.throws(()=>decodeHirakataModel(T,array().slice(0,raw.length-4)),/invalid header/);
  assert.throws(()=>decodeHirakataModel(T,alteredDoc(doc=>{doc.textures=[{}];})),/unsupported external/);
  assert.throws(()=>decodeHirakataModel(T,alteredDoc(doc=>{doc.accessors[0].count=1000000000;})),/accessor outside/);
  assert.throws(()=>decodeHirakataModel(T,alteredDoc(doc=>{doc.bufferViews[0].byteStride=32;})),/invalid buffer view/);
  assert.throws(()=>decodeHirakataModel(T,alteredDoc(doc=>{doc.nodes[0].translation=[0,1];})),/invalid translation/);
 });
 check('teardown detaches model and disposes resources once without global scene mutation',()=>{
  const scene=new T.Scene();scene.add(model.world);let disposedGeometry=0,disposedMaterial=0,disposedCube=0;
  const geometrySet=new Set(model.meshes.map(mesh=>mesh.geometry));for(const geometry of geometrySet)geometry.addEventListener('dispose',()=>disposedGeometry++);
  for(const material of model.materials)material.addEventListener('dispose',()=>disposedMaterial++);model.environment.addEventListener('dispose',()=>disposedCube++);
  model.dispose();model.dispose();assert.equal(scene.children.length,0);assert.equal(disposedGeometry,geometrySet.size);assert.equal(disposedMaterial,32);assert.equal(disposedCube,1);
 });
 console.log(JSON.stringify({checks,meshCount:model.meshCount,triangles:model.triangleCount,removedStaticBusTriangles:model.removedTriangleCount,northStaticBusTriangles:model.northRemovedTriangleCount,createMs:Math.round(createdMs),scope:'Node real Three geometry; no WebGL/browser/audio'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
