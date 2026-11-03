// CC0 scanned district surfaces: geometry/resource contracts in real
// Three, without a renderer, browser, audio playback or external assets.
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const hashBytes=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function geometryFingerprint(meshes){
 const hash=createHash('sha256');
 for(const mesh of meshes){
  hash.update(JSON.stringify([mesh.name,mesh.userData.hirakataModule,mesh.userData.preserveGround,mesh.matrixWorld.elements]));
  for(const attribute of [mesh.geometry.attributes.position,mesh.geometry.attributes.normal,mesh.geometry.index]){
   hash.update(JSON.stringify(attribute&&[attribute.array.constructor.name,attribute.itemSize,attribute.count]));
   if(attribute)hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
  }
 }
 return hash.digest('hex');
}
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-5,`${label}: ${actual} != ${expected}`);

async function main(){
 const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
 const T=await load('vendor/three.module.js');
 const {OAK_FINISH}=await load('assets/hirakata-oak-finish.js');
 const {DISTRICT_FINISH}=await load('assets/hirakata-district-finish.js');
 const {createHirakataSurfaceFinish}=await load('hirakata-surface-finish.js');
 const {createHirakataModel,decodeHirakataModel}=await load('hirakata-complete-render.js');
 let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
 const finish=createHirakataSurfaceFinish(T);
 check('21 shared surface maps and one bounded contact atlas keep the exact allocation budget and sampling',()=>{
  assert.equal(finish.textures.length,22);assert.equal(new Set(finish.textures).size,22);
  assert.equal(finish.stats.textureBytes,15466496);assert.equal(finish.stats.textureBytes,12*512*512*4+9*256*256*4+512*256*4);
  for(const texture of finish.textures){
   assert.equal(texture.anisotropy,4);assert.equal(texture.flipY,false);
   if(texture.name.endsWith('contact AO')){
    assert.equal(texture.image.width,512);assert.equal(texture.image.height,256);assert.equal(texture.image.data.length,512*256*4);
    assert.equal(texture.channel,1);assert.equal(texture.colorSpace,T.NoColorSpace);assert.equal(texture.wrapS,T.ClampToEdgeWrapping);assert.equal(texture.wrapT,T.ClampToEdgeWrapping);
    assert.equal(texture.generateMipmaps,false);assert.equal(texture.minFilter,T.LinearFilter);assert.equal(texture.magFilter,T.LinearFilter);
    assert.deepEqual([...texture.image.data.subarray(0,4)],[255,255,255,255]);continue;
   }
   const isOak=texture.name.includes('CC0 Oak Veneer 01'),isScanned=texture.name.includes('CC0'),size=isScanned?512:256;
   assert.ok(texture.isDataTexture);assert.equal(texture.image.width,size);assert.equal(texture.image.height,size);
   assert.equal(texture.image.data.length,size*size*4);assert.equal(texture.wrapS,T.RepeatWrapping);assert.equal(texture.wrapT,T.RepeatWrapping);
   assert.equal(texture.minFilter,T.LinearMipmapLinearFilter);assert.equal(texture.magFilter,T.LinearFilter);assert.equal(texture.generateMipmaps,true);
   assert.equal(texture.colorSpace,texture.name.endsWith('albedo')?T.SRGBColorSpace:T.NoColorSpace);
   const bytes=texture.image.data;let min=255,max=0;
   for(let i=0;i<bytes.length;i+=4){
    min=Math.min(min,bytes[i]);max=Math.max(max,bytes[i]);assert.equal(bytes[i+3],255);
    // Check valid tangent-space unit vectors; material normalScale controls
    // the visible strength independently from the source normal map.
    if(texture.name.endsWith('normal')){const n=[0,1,2].map(k=>bytes[i+k]/255*2-1);assert.ok(Math.abs(Math.hypot(...n)-1)<.015);assert.ok(n[2]>0);}
   }
   assert.ok(max>min,texture.name+' must contain real surface variation');
   // Photographed oak includes naturally darker grain (prepared min177).
   // The former procedural-only min200 is not a cleanliness requirement.
   // Concrete/stone/asphalt are independently hash-checked below: their
   // photographed contrast need not satisfy the old procedural luminance.
   if(texture.name==='Hirakata original foliage albedo')assert.ok(min>=188&&max<=232,'leaf clusters keep the bounded canopy modulation range');
   else if(texture.name.endsWith('albedo')&&(!isScanned||isOak))assert.ok(min>(isOak?170:200),texture.name+' restrained luminance range');
  }
  const other=createHirakataSurfaceFinish(T);
  assert.deepEqual(other.textures.map(t=>hashBytes(t.image.data)),finish.textures.map(t=>hashBytes(t.image.data)));
  other.dispose();
 });
 check('district scans match independent prepared hashes, licenses and physical crop scale',()=>{
  const expected={
   concrete:{width:2.4,asset:'Granular Concrete',url:'granular_concrete',author:'Dario Barresi (processing); Michael Jenkins (photography)',albedo:'30a87745f6664768dcd37dd1a409a56b4d6b9e62d55dd0ad26233724ae8073fe',roughness:'dfe8268391b38bf9d81a3e43c10fd93ae319b44c0df65ebbcc9b4fae0f697739',normal:'5679cd375c5358853d18c04227218af34855edc01c7b6155936362fcbb71525b'},
   paving:{width:.359375,asset:'Granite Tile (joint-free stone interior)',url:'granite_tile',author:'Charlotte Baglioni',albedo:'d6e79195a327d989dc0201775d801ff815c80f440ca0ab813f82fc1709699884',roughness:'b63a883c162956014798e914c4fa76cb7c3bd3feb9a3cd8ebd6b33d73db83eb6',normal:'2d7ce9db040f17b1482d0e93fd255fce7d5757ba2fe15b60a70cea032964196b'},
   asphalt:{width:2.1,asset:'Clean Asphalt',url:'clean_asphalt',author:'Dimitrios Savva',albedo:'81b0701d059cbafa110794aa7a9a830d09896605c5793d644b6fbbb7d24dde61',roughness:'d3a01baf596f5ab4a5045e2e2515aa72c167e3c4c56cde064c61f10310236f43',normal:'dc7bda092f827574e162abe4073b2194f00b623edbd6862d5b1772538f7e1538'},
  };
  for(const [family,record]of Object.entries(expected)){
   const asset=DISTRICT_FINISH[family];assert.equal(asset.width,512);assert.equal(asset.height,512);assert.equal(asset.provenance.asset,record.asset);assert.equal(asset.provenance.author,record.author);assert.equal(asset.provenance.provider,'Poly Haven');assert.equal(asset.provenance.url,'https://polyhaven.com/a/'+record.url);assert.equal(asset.provenance.license,'CC0-1.0');assert.equal(asset.provenance.licenseUrl,'https://polyhaven.com/license');assert.equal(asset.provenance.sourceWidthMeters,record.width);
   for(const kind of ['albedo','roughness','normal']){const bytes=Buffer.from(asset[kind],'base64'),texture=finish.textures.find(t=>t.name==='Hirakata CC0 '+family+' '+kind);assert.ok(texture);assert.equal(bytes.length,1048576);assert.equal(hashBytes(bytes),record[kind]);assert.equal(asset.provenance.mapSha256[kind],record[kind]);assert.equal(hashBytes(texture.image.data),record[kind]);}
  }
  assert.deepEqual(DISTRICT_FINISH.paving.provenance.cropPixels,[80,80,720,720]);assert.equal(DISTRICT_FINISH.paving.provenance.sourceWidthMeters,2.3*640/4096);assert.equal(DISTRICT_FINISH.paving.provenance.periodicBoundaryBandPixels,24);
 });
 check('bundled licensed oak maps match independently recorded prepared bytes and provenance',()=>{
  const expected={albedo:'e61fe63fc4d460ccd9b1042c7f7b039695929e2c7d96c0f9e7ff6ae838b8bea6',roughness:'f8d80f97f5dcfc5856da3cb66601035a5d63006d125e7e1099590a1666770533',normal:'a85f2a503f7986f4a519c6e35c6de44570608fe8cf990bfd6f6cf73d9faf234a'};
  assert.equal(OAK_FINISH.width,512);assert.equal(OAK_FINISH.height,512);
  assert.equal(OAK_FINISH.provenance.asset,'Oak Veneer 01');assert.equal(OAK_FINISH.provenance.provider,'Poly Haven');assert.equal(OAK_FINISH.provenance.author,'Jenelle van Heerden');
  assert.equal(OAK_FINISH.provenance.license,'CC0-1.0');assert.equal(OAK_FINISH.provenance.url,'https://polyhaven.com/a/oak_veneer_01');assert.equal(OAK_FINISH.provenance.licenseUrl,'https://polyhaven.com/license');assert.equal(OAK_FINISH.provenance.sourceWidthMeters,1.8);
  assert.deepEqual(OAK_FINISH.provenance.mapSha256,expected);
  for(const [kind,hash]of Object.entries(expected)){
   const bundled=Buffer.from(OAK_FINISH[kind],'base64');assert.equal(bundled.length,512*512*4);assert.equal(hashBytes(bundled),hash,kind+' bundled bytes');
   const texture=finish.textures.find(t=>t.name==='Hirakata CC0 Oak Veneer 01 '+kind);assert.ok(texture);assert.equal(hashBytes(texture.image.data),hash,kind+' actual uploaded samples');
  }
 });
 const source=new T.MeshStandardMaterial({name:'woodlight',color:'#9b7958',roughness:.68});
 const parent=new T.Group();parent.position.set(10,5,20);parent.rotation.y=Math.PI/2;parent.scale.set(2,1,1);
 const upright=new T.Mesh(new T.PlaneGeometry(.64,4),source);upright.userData.hirakataModule='Station_central_hall';parent.add(upright);parent.updateMatrixWorld(true);
 const floor=new T.Mesh(new T.PlaneGeometry(.64,4),source);floor.userData.hirakataModule='Station_central_hall';floor.rotation.x=-Math.PI/2;floor.position.set(2,6.4,9);floor.updateMatrixWorld(true);
 check('wood UVs follow world metres on rotated scaled columns and horizontal floors without changing geometry',()=>{
  const before=geometryFingerprint([upright,floor]);
  assert.equal(finish.apply(upright),true);assert.equal(finish.apply(floor),true);
  assert.equal(geometryFingerprint([upright,floor]),before);
  for(const mesh of [upright,floor]){
   const pos=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;assert.equal(uv.count,pos.count);assert.equal(uv.itemSize,2);
   for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i);
    if(mesh===upright){close(uv.getX(i),(20-2*x)/1.8,'rotated column U');close(uv.getY(i),(5+y)/1.8,'upright column V');}
    else{close(uv.getX(i),(2+x)/1.8,'floor U');close(uv.getY(i),(9-y)/1.8,'floor V');}
   }
  }
  assert.notEqual(upright.material,floor.material,'floor AO has an independent clone from the upright surface');assert.notEqual(upright.material,source);
  close(upright.material.normalScale.x,.5,'oak normalScale X');close(upright.material.normalScale.y,.5,'oak normalScale Y');
  const anotherFloor=new T.Mesh(floor.geometry.clone(),source);anotherFloor.userData.hirakataModule='Station_central_hall';anotherFloor.position.copy(floor.position);anotherFloor.rotation.copy(floor.rotation);
  finish.apply(anotherFloor);assert.equal(anotherFloor.material,floor.material,'same original/profile/AO variant shares one clone');anotherFloor.geometry.dispose();
  assert.equal(source.map,null);assert.equal(source.normalMap,null);assert.equal(source.roughnessMap,null);
  const uv=upright.geometry.attributes.uv,stats=JSON.stringify(finish.stats);
  assert.equal(finish.apply(upright),false);assert.equal(upright.geometry.attributes.uv,uv);assert.equal(JSON.stringify(finish.stats),stats);
 });
 check('contact shading samples the actual floor near its own pillar and leaves open/high faces neutral',()=>{
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([-26.25,6.44,-5,-20,6.44,0,-27,8,-5],3));
  geometry.setAttribute('normal',new T.Float32BufferAttribute([0,1,0,0,1,0,1,0,0],3));
  const mesh=new T.Mesh(geometry,source);mesh.userData.hirakataModule='Station_central_hall';assert.equal(finish.apply(mesh),true);
  const atlas=mesh.material.aoMap,uv=geometry.attributes.uv1;assert.ok(atlas);assert.equal(uv.count,3);assert.ok(uv.array.every(Number.isFinite));
  const sample=i=>{const x=Math.max(0,Math.min(atlas.image.width-1,Math.floor(uv.getX(i)*atlas.image.width))),y=Math.max(0,Math.min(atlas.image.height-1,Math.floor(uv.getY(i)*atlas.image.height)));return atlas.image.data[(y*atlas.image.width+x)*4];};
  assert.ok(sample(0)<220,'contact beside the actual pillar is shaded');assert.equal(sample(1),255,'open hall floor stays clean');assert.equal(sample(2),255,'upright high face samples white fallback');
  close(uv.getX(2),.5/512,'neutral U');close(uv.getY(2),.5/256,'neutral V');
  // A central ticket gate is destroyed independently from this wood floor;
  // it must not leave a baked shadow on the surviving hall after removal.
  const gateU=(4+.5+(-19+49)/52*247)/512,gateV=(4+.5+(-5.8+15)/30*247)/256;
  assert.equal(atlas.image.data[(Math.floor(gateV*256)*512+Math.floor(gateU*512))*4],255,'separate gate module casts no permanent floor contact');
  assert.ok(finish.stats.contactAoOccluders.Station_central_hall.every(id=>/^(central-wood-pillar-|central-retail-counter-)/.test(id)));
  assert.ok(finish.stats.contactAoOccluders.Station_east_hall.every(id=>/^(east-dark-pillar-|east-gate-|east-ticket-|east-info-kiosk)/.test(id)));
  geometry.dispose();
 });
 check('vehicles, authored text, road paint, tactile markings and the printed landscape remain untouched',()=>{
  for(const [module,name,preserveGround=false,meshName=''] of [['Vehicles','steel'],['North_stationary_buses','white'],['Station_central_hall','white',false,'East Gate lettering'],['Ground_and_roads','white',true],['Ground_and_roads','black',true],['Ground_and_roads','ivory',true],['Station_ground_passage','leaf'],['Station_central_hall','yellow'],['Station_central_Ceiling','light']]){
   const geometry=new T.PlaneGeometry(2,2),material=new T.MeshStandardMaterial({name}),mesh=new T.Mesh(geometry,material);
   mesh.userData={hirakataModule:module,preserveGround};mesh.name=meshName;const uv=geometry.attributes.uv;
   assert.equal(finish.apply(mesh),false,module+'/'+name);assert.equal(mesh.material,material);assert.equal(geometry.attributes.uv,uv);material.dispose();geometry.dispose();
  }
 });
 check('district materials use physical scan scale, preserve geometry/color and cover the intended modules',()=>{
  for(const [module,name,family,width,normal,roughness,metalness]of [
   ['TSITE_terrace','woodlight','wood',1.8,.5,.65,0],['South_streets_and_shops','panel','concrete',2.4,.26,.88,0],['South_pedestrian_deck','paving','paving',.359375,.20,.78,0],['Ground_and_roads','road','asphalt',2.1,.38,.96,0],['Park','leaf','foliage',.8,.32,.94,0],['Park','soil','concrete',.6,.42,1,0],['TSITE_glass_boxes','green_glass','steel',2.5,.009,.19,.42],
  ]){
   const geometry=new T.PlaneGeometry(2,2),material=new T.MeshStandardMaterial({name,color:'#678491'}),mesh=new T.Mesh(geometry,material);mesh.userData.hirakataModule=module;mesh.name=module+' / '+name;mesh.position.set(3,2,5);mesh.rotation.x=-Math.PI/2;mesh.updateMatrixWorld(true);const before=geometryFingerprint([mesh]);
   assert.equal(finish.apply(mesh),true);assert.equal(geometryFingerprint([mesh]),before);assert.deepEqual(mesh.material.color,material.color);assert.equal(mesh.material.userData.hirakataSurfaceFinish,family);close(mesh.material.roughness,roughness,'roughness');close(mesh.material.metalness,metalness,'metalness');close(mesh.material.normalScale.x,normal,'normal strength');
   const position=geometry.attributes.position,uv=geometry.attributes.uv;for(let i=0;i<position.count;i++){close(uv.getX(i),(3+position.getX(i))/width,'world U');close(uv.getY(i),(5-position.getY(i))/width,'world V');}
   if(name==='green_glass')close(mesh.material.envMapIntensity,1.35,'glass reflection');material.dispose();geometry.dispose();
  }
 });
 check('finish owns only its clones/textures and releases them exactly once',()=>{
  const resources=[...finish.materials,...finish.textures],counts=new Map(resources.map(r=>[r,0]));let sourceDisposed=0;
  source.addEventListener('dispose',()=>sourceDisposed++);for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));
  finish.dispose();finish.dispose();for(const value of counts.values())assert.equal(value,1);assert.equal(sourceDisposed,0);assert.equal(finish.stats.disposed,true);
  const retiredGeometry=new T.PlaneGeometry(1,1);assert.equal(finish.apply(new T.Mesh(retiredGeometry,source)),false);retiredGeometry.dispose();
 });
 source.dispose();upright.geometry.dispose();floor.geometry.dispose();
 check('partial texture construction failure disposes all textures already allocated',()=>{
  for(const failAt of [4,10,22]){
   const allocated=[];let attempts=0;
   class FaultTexture extends T.DataTexture{
    constructor(...args){if(++attempts===failAt)throw Error('injected texture allocation fault');super(...args);const entry={texture:this,disposed:0};allocated.push(entry);this.addEventListener('dispose',()=>entry.disposed++);}
   }
   assert.throws(()=>createHirakataSurfaceFinish({...T,DataTexture:FaultTexture}),/injected texture allocation fault/);
   assert.equal(allocated.length,failAt-1);for(const entry of allocated)assert.equal(entry.disposed,1);
  }
 });
 const {createHirakataSiteCover,HIRAKATA_A_COVER}=await load('hirakata-site-cover.js');
 check('A cover shares the district maps while retaining its 16 meshes, collision dimensions and disposal ownership',()=>{
  const coverFinish=createHirakataSurfaceFinish(T),allocated=[],originals=new Set();
  class TrackedBoxGeometry extends T.BoxGeometry{constructor(...args){super(...args);allocated.push(this);}}
  const baseline=createHirakataSiteCover(T),cover=createHirakataSiteCover({...T,BoxGeometry:TrackedBoxGeometry},{apply(mesh){if(mesh.isMesh)originals.add(mesh.material);return coverFinish.apply(mesh);}});
  const collect=c=>{const meshes=[];for(const root of c.groups.values()){root.updateMatrixWorld(true);root.traverse(n=>{if(n.isMesh)meshes.push(n);});}return meshes;},plain=collect(baseline),actual=collect(cover);
  assert.equal(cover.meshCount,16);assert.equal(actual.length,16);assert.equal(allocated.length,17);assert.equal(originals.size,6);assert.equal(new Set(actual.map(m=>m.geometry)).size,16);assert.equal(geometryFingerprint(actual),geometryFingerprint(plain));
  assert.equal(coverFinish.stats.meshCount,12);assert.equal(coverFinish.textures.length,22);assert.equal(coverFinish.stats.textureBytes,15466496);assert.equal(coverFinish.stats.materialCount,5);
  for(const mesh of actual){const uv=mesh.geometry.attributes.uv;assert.equal(uv.count,mesh.geometry.attributes.position.count);assert.ok(uv.array.every(Number.isFinite));if(!mesh.name.includes('band'))assert.ok(coverFinish.textures.includes(mesh.material.map));}
  for(const spec of HIRAKATA_A_COVER){const body=cover.groups.get(spec.id).children.find(n=>n.name===spec.id+' / body');const bounds=new T.Box3().setFromObject(body);close(bounds.min.x,spec.x-spec.w/2,'cover min X');close(bounds.max.x,spec.x+spec.w/2,'cover max X');close(bounds.min.z,spec.z-spec.d/2,'cover min Z');close(bounds.max.z,spec.z+spec.d/2,'cover max Z');close(bounds.min.y,0,'cover ground contact');close(bounds.max.y,spec.h,'cover collider top');}
  const owned=[...allocated,...originals],shared=[...coverFinish.textures,...coverFinish.materials],counts=new Map([...owned,...shared].map(r=>[r,0]));for(const r of counts.keys())r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));
  cover.dispose();cover.dispose();for(const r of owned)assert.equal(counts.get(r),1);for(const r of shared)assert.equal(counts.get(r),0,'cover does not dispose shared district resources');
  coverFinish.dispose();coverFinish.dispose();for(const value of counts.values())assert.equal(value,1);baseline.dispose();
 });
 check('partial A cover finish failure releases its own resources without disposing the shared finish',()=>{
  const tracked=[],record=resource=>{const entry={resource,disposed:0};tracked.push(entry);resource.addEventListener('dispose',()=>entry.disposed++);};
  class TrackedBox extends T.BoxGeometry{constructor(...args){super(...args);record(this);}}
  class TrackedMaterial extends T.MeshStandardMaterial{constructor(...args){super(...args);record(this);}}
  const coverT={...T,BoxGeometry:TrackedBox,MeshStandardMaterial:TrackedMaterial},coverFinish=createHirakataSurfaceFinish(coverT),textureCounts=new Map(coverFinish.textures.map(t=>[t,0]));for(const t of textureCounts.keys())t.addEventListener('dispose',()=>textureCounts.set(t,textureCounts.get(t)+1));
  let attempts=0;assert.throws(()=>createHirakataSiteCover(coverT,{apply(mesh){if(mesh.isMesh&&++attempts===7)throw Error('injected partial cover finish fault');return coverFinish.apply(mesh);}}),/injected partial cover finish fault/);assert.equal(attempts,7);
  assert.equal(tracked.filter(e=>e.resource.isBufferGeometry).length,11,'failure occurs part-way through the second cover');
  const clones=new Set(coverFinish.materials);assert.equal(clones.size,2);assert.equal(tracked.filter(e=>e.resource.isMaterial&&!clones.has(e.resource)).length,6);
  for(const e of tracked)assert.equal(e.disposed,clones.has(e.resource)?0:1,'failed cover retains shared clones and disposes every owned allocation');for(const count of textureCounts.values())assert.equal(count,0);
  coverFinish.dispose();for(const e of tracked)assert.equal(e.disposed,1);for(const count of textureCounts.values())assert.equal(count,1);
 });
 const began=performance.now(),model=createHirakataModel(T),createdMs=performance.now()-began;
 check('integrated model retains the independently audited bevel geometry and supported GLB provenance',()=>{
  assert.equal(model.meshCount,472);assert.equal(model.triangleCount,285300);
  // Audited against the pre-bevel source by tests-hirakata-district-geometry:
  // protected meshes are exact; changed surfaces stay within approved boxes.
  // Keep every normal/index/position/transform/ground flag/order fixed here.
  assert.equal(geometryFingerprint(model.meshes),'707bb5dadc01a6f203add6554de551196e29042c10f5e7366aab27d7ca70ba04');
  assert.equal(model.provenance.sha256,'3769f66622423958d10e58f22bc2ad9aa2aecd9284e07a57170c28cd11d0b800');
  assert.ok(model.surfaceFinish);assert.equal(model.surfaceFinish.textures.length,22);assert.equal(model.surfaceFinish.stats.meshCount,296);assert.equal(model.surfaceFinish.stats.materialCount,31);assert.equal(model.surfaceFinish.stats.uvVertices,383162);assert.equal(model.surfaceFinish.stats.textureBytes,15466496);
  const finished=model.meshes.filter(m=>m.material.userData.hirakataSurfaceFinish);assert.equal(finished.length,model.surfaceFinish.stats.meshCount);
  for(const mesh of finished){const uv=mesh.geometry.attributes.uv;assert.equal(uv.count,mesh.geometry.attributes.position.count);assert.equal(uv.itemSize,2);assert.ok(uv.array.every(Number.isFinite));assert.ok(mesh.material.map&&mesh.material.normalMap&&mesh.material.roughnessMap);if(mesh.material.aoMap){const contact=mesh.geometry.attributes.uv1;assert.equal(contact.count,uv.count);assert.ok(contact.array.every(Number.isFinite));}}
  for(const mesh of model.meshes.filter(m=>m.userData.hirakataModule==='Vehicles'||m.name==='Station_ground_passage / leaf'||!m.name.startsWith(m.userData.hirakataModule+' / ')))assert.equal(mesh.material.userData.hirakataSurfaceFinish,undefined,mesh.name);
  for(const module of ['Park','TSITE_terrace','South_streets_and_shops','North_shopping_street','Ground_and_roads'])assert.ok(finished.some(m=>m.userData.hirakataModule===module),module+' reached by the district pass');
 });
 check('model teardown releases integrated original and finished resources exactly once',()=>{
  const resources=new Set([...model.meshes.map(m=>m.geometry),...model.materials,...model.surfaceFinish.materials,...model.surfaceFinish.textures,model.environment,...model.environment.image]);
  const counts=new Map([...resources].map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));
  model.dispose();model.dispose();for(const [resource,count] of counts)assert.equal(count,1,resource.name||resource.type);
 });
 check('decoder failure during finish application cleans previously allocated resources',()=>{
  const tracked=[];function record(resource){const entry={resource,disposed:0};tracked.push(entry);resource.addEventListener('dispose',()=>entry.disposed++);}
  class TrackedTexture extends T.DataTexture{constructor(...args){super(...args);record(this);}}
  class TrackedGeometry extends T.BufferGeometry{constructor(...args){super(...args);record(this);}}
  class FaultMaterial extends T.MeshStandardMaterial{
   constructor(...args){super(...args);record(this);}
   clone(){if(this.name==='woodlight')throw Error('injected material clone fault');return super.clone();}
  }
  const data=require('node:fs').readFileSync(path.join(__dirname,'public','assets','hirakata-complete-model.js'),'utf8');
  const encoded=data.match(/HIRAKATA_MODEL_BASE64\s*=\s*['"]([^'"]+)['"]/);assert.ok(encoded,'embedded source declaration');
  const raw=Buffer.from(encoded[1],'base64'),array=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
  assert.throws(()=>decodeHirakataModel({...T,DataTexture:TrackedTexture,BufferGeometry:TrackedGeometry,MeshStandardMaterial:FaultMaterial},array),/injected material clone fault/);
  assert.ok(tracked.filter(t=>t.resource.isDataTexture).length>=28,'environment and all district finish textures reached');
  for(const entry of tracked)assert.equal(entry.disposed,1,entry.resource.name||entry.resource.type);
 });
 const ctx=new Proxy({measureText:text=>({width:String(text).length*8})},{get:(o,k)=>o[k]||(()=>{})});
 global.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 const {createHirakataMap}=await load('hirakata-map.js'),{createBuildingCollapse}=await load('building-collapse.js');
 check('full map cover construction failure detaches the rendered world and releases all prior resources',()=>{
  const tracked=[],record=resource=>{const entry={resource,disposed:0};tracked.push(entry);resource.addEventListener('dispose',()=>entry.disposed++);};let faults=0;
  class TrackedGeometry extends T.BufferGeometry{constructor(...args){super(...args);record(this);}}
  class TrackedBox extends T.BoxGeometry{constructor(...args){super(...args);record(this);}}
  class TrackedTexture extends T.DataTexture{constructor(...args){super(...args);record(this);}}
  class TrackedCube extends T.CubeTexture{constructor(...args){super(...args);record(this);}}
  class FaultMaterial extends T.MeshStandardMaterial{
   constructor(...args){super(...args);this.coverFailureProbe=args[0]?.name==='steel'&&args[0]?.color==='#4d6468';record(this);}
   clone(){if(this.coverFailureProbe){faults++;throw Error('injected A cover clone fault');}return super.clone();}
  }
  const scene=new T.Group();assert.throws(()=>createHirakataMap({...T,BufferGeometry:TrackedGeometry,BoxGeometry:TrackedBox,DataTexture:TrackedTexture,CubeTexture:TrackedCube,MeshStandardMaterial:FaultMaterial},scene),/injected A cover clone fault/);
  assert.equal(faults,1,'the fault occurs in cover material application, after the main model succeeds');assert.equal(scene.children.length,0,'failed world is detached');
  assert.equal(tracked.filter(e=>e.resource.isDataTexture).length,28);assert.equal(tracked.filter(e=>e.resource.isCubeTexture).length,1);assert.ok(tracked.filter(e=>e.resource.isMaterial).length>=69);assert.ok(tracked.filter(e=>e.resource.isBufferGeometry).length>472);
  for(const e of tracked)assert.equal(e.disposed,1,e.resource.name||e.resource.type);
 });
 const map=createHirakataMap(T,new T.Group()),finished=[];map.world.traverse(n=>{if(n.isMesh&&n.material?.userData?.hirakataSurfaceFinish)finished.push(n);});
 check('destruction and whole-map collapse restore the same finished materials, UVs and texture objects',()=>{
  assert.ok(finished.length>10);const saved=finished.map(mesh=>({mesh,material:mesh.material,uv:mesh.geometry.attributes.uv,map:mesh.material.map,normal:mesh.material.normalMap,rough:mesh.material.roughnessMap}));
  for(const [module,ids] of Object.entries(model.surfaceFinish.stats.contactAoOccluders)){
   const owner=map.destruction.groups.find(g=>g.id===module);assert.ok(owner);
   for(const id of ids)assert.ok(owner.colliders.some(c=>c.id===id),id+' contact belongs to the same destruction module as its floor');
  }
  const group=map.destruction.groups.find(g=>g.id==='Station_central_hall');assert.ok(group);
  const bytes=Buffer.alloc(Math.ceil(map.destruction.groups.length/8));bytes[group.index>>3]|=1<<(group.index&7);const mask=bytes.toString('hex');
  assert.equal(map.destruction.restore(mask,1),true);for(const node of group.nodes)assert.equal(node.visible,false);
  map.destruction.reset();for(const node of group.nodes)assert.equal(node.visible,true);
  const collapse=createBuildingCollapse(T,map);assert.equal(collapse.start({x:35,z:6,time:1,seed:47}),true);for(const node of group.nodes)assert.equal(node.visible,false);collapse.reset();
  for(const s of saved){assert.equal(s.mesh.material,s.material);assert.equal(s.mesh.geometry.attributes.uv,s.uv);assert.equal(s.material.map,s.map);assert.equal(s.material.normalMap,s.normal);assert.equal(s.material.roughnessMap,s.rough);assert.equal(s.mesh.visible,true);}
  collapse.dispose();
 });
 check('ceiling fixture lighting follows independent ceiling destruction and collapse restoration',()=>{
  const lights=[];map.world.traverse(n=>{if(n.isPointLight)lights.push(n);});assert.equal(lights.length,4);
  const visible=node=>{for(let p=node;p;p=p.parent)if(!p.visible)return false;return true;};
  for(const light of lights){assert.equal(light.castShadow,false);assert.ok(light.parent.isMesh,'fixture inherits destructible mesh visibility');assert.ok(/Station_(central|east)_Ceiling/.test(light.parent.userData.hirakataModule));assert.equal(visible(light),true);}
  const group=map.destruction.groups.find(g=>g.id==='Station_central_Ceiling'),bytes=Buffer.alloc(Math.ceil(map.destruction.groups.length/8));bytes[group.index>>3]|=1<<(group.index&7);
  const mask=bytes.toString('hex');map.destruction.restore(mask,1);
  for(const light of lights)assert.equal(visible(light),light.parent.userData.hirakataModule!=='Station_central_Ceiling');
  const collapse=createBuildingCollapse(T,map);collapse.start({x:35,z:6,time:2,seed:41});for(const light of lights)assert.equal(visible(light),false);
  collapse.reset();assert.equal(map.destruction.snapshot(),mask);
  for(const light of lights)assert.equal(visible(light),light.parent.userData.hirakataModule!=='Station_central_Ceiling');
  map.destruction.reset();for(const light of lights)assert.equal(visible(light),true);collapse.dispose();
 });
 console.log(JSON.stringify({checks,meshCount:model.meshCount,triangles:model.triangleCount,finish:model.surfaceFinish.stats,createMs:Math.round(createdMs),scope:'Real Three in Node; geometry/resource/destruction tests. No GPU, browser, audio or frame-time claim.'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
