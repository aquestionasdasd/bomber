const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {MOVES,normalizedLegacyColliders,legacyInstanceTranslations}=require('./tests-tactical-legacy.cjs');

async function main(){
  const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [THREE,{createMap}]=await Promise.all([load('vendor/three.module.js'),load('map.js')]);
  const context=new Proxy({measureText:t=>({width:String(t).length*8})},{get:(target,key)=>target[key]||(()=>{})});
  global.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
  const map=createMap(THREE,new THREE.Scene()),hash=createHash('sha256'),geometries=new Set(),materials=new Set(),textures=new Set();
  // Normalize only the three previously approved landing rails/Mewe sill and
  // six explicitly audited prop translations and the34 lowered/recessed portal
  // roof parts; new architecture has its own group. Every other old vertex,
  // instance and physical support retains its old hash.
  const railParts=new Map(),partKey=(color,indices,array)=>`${color}:${indices}:${Buffer.from(array.buffer,array.byteOffset,array.byteLength).toString('hex')}`;
  function railPart(color,x,y,z,w,h,d,glass=false){
    const matrix=new Float32Array(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(w,h,d)).elements);
    const key=partKey(new THREE.Color(color).getHex(),glass?6:36,matrix);assert.equal(railParts.has(key),false);
    railParts.set(key,{seen:0,triangles:glass?2:12});
  }
  for(const [x,y,z,length]of[[-65.5,3.25,-27.88,3],[69.275,3.25,-7.86,1.45],[75.5,3.25,-7.86,1]]){
    railPart('#a2c5cb',x,y+.48,z,length,.9,1,true);
    railPart('#405965',x,y+1.02,z,length+.12,.075,.075);
    railPart('#72888c',x,y+.035,z,length,.065,.09);
    for(let a=-length/2;a<=length/2+.01;a+=2.8){
      railPart('#72888c',x+a,y+.5,z,.075,1.07,.075);
      for(const h of[.12,.82])railPart('#405965',x+a,y+h,z,.14,.09,.11);
    }
  }
  railPart('#d6d8c8',62,3.2875,-13.72,28.9,.075,.7);
  assert.equal(railParts.size,22);
  const portalParts=new Map();
  const boxMatrix=([x,y,z,w,h,d])=>new Float32Array(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(w,h,d)).elements);
  function portalPart(name,color,current,previous,roughness=.78,metalness=.04){
    const key=partKey(new THREE.Color(color).getHex(),36,boxMatrix(current));
    assert.equal(portalParts.has(key),false,`${name} has one exact expected transform`);
    portalParts.set(key,{name,previous:boxMatrix(previous),roughness,metalness,seen:0});
  }
  portalPart('metal roof','#405965',[-20.75,4.225,-32,17.4,.28,2.1],[-20.75,7.5,-32,17.4,.28,4.5],.45,.42);
  portalPart('ivory cap','#d6d8c8',[-20.75,4.405,-32,17.8,.09,2.2],[-20.75,7.68,-32,17.8,.09,4.8]);
  portalPart('green front strip','#3f8269',[-20.75,4.235,-30.89,17.15,.11,.1],[-20.75,7.51,-29.71,17.15,.11,.1]);
  portalPart('wood soffit','#9c8060',[-20.75,4.035,-32,16.7,.08,1.9],[-20.75,7.31,-32,16.7,.08,4.1],.73);
  for(let x=-28.5;x<-13;x+=.56)portalPart(`soffit slat${x}`,'#283f4d',[x,3.975,-32,.055,.065,1.9],[x,7.25,-32,.055,.065,4.1]);
  for(const x of[-27.65,-13.85])portalPart(`soffit light${x}`,'#fff1c7',[x,3.915,-32,.08,.07,1.8],[x,7.19,-32,.08,.07,4],.6,0);
  assert.equal(portalParts.size,34,'Only the34 declared portal roof instances are normalized');
  const moveIds=new Set();
  let meshes=0,instances=0,triangles=0,addedInstances=0,addedTriangles=0;map.world.updateMatrixWorld(true);
  map.world.traverse(object=>{
    for(let parent=object;parent;parent=parent.parent)if(parent.userData.tacticalLayout)return;
    if(!object.isMesh)return;meshes++;geometries.add(object.geometry);
    const count=object.isInstancedMesh?object.count:1;instances+=object.isInstancedMesh?count:0;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*count;
    for(const name of ['position','normal']){const a=object.geometry.attributes[name];hash.update(name);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
    if(object.geometry.index)hash.update(Buffer.from(object.geometry.index.array.buffer));
    hash.update(JSON.stringify([object.matrixWorld.elements,object.userData.solid,object.castShadow,object.receiveShadow]));
    if(object.isInstancedMesh){
      const original=[],removed=[],translations=legacyInstanceTranslations(object,moveIds);
      for(let i=0;i<object.count;i++){
        const matrix=object.instanceMatrix.array.subarray(i*16,(i+1)*16),key=partKey(object.material.color.getHex(),object.geometry.index?.count??0,matrix),part=railParts.get(key),portal=portalParts.get(key);
        if(part){part.seen++;removed.push(i);addedInstances++;addedTriangles+=part.triangles;}else{
          if(portal){
            portal.seen++;
            assert.equal(translations.has(i),false,'Portal normalization must not overlap an approved prop translation');
            assert.equal(object.material.isMeshStandardMaterial,true,`${portal.name} keeps its original standard material`);
            assert.equal(object.material.roughness,portal.roughness);assert.equal(object.material.metalness,portal.metalness);
            assert.equal(object.material.transparent,false);assert.equal(object.material.opacity,1);assert.equal(object.material.depthWrite,true);
            if(portal.name.startsWith('soffit light')){assert.equal(object.material.emissive.getHex(),new THREE.Color('#ffe4a6').getHex());assert.equal(object.material.emissiveIntensity,.5);}
          }
          const normalized=Array.from(portal?portal.previous:matrix),translation=translations.get(i);if(translation)normalized.splice(12,3,...translation);
          original.push(...normalized);
        }
      }
      assert.deepEqual(removed,Array.from({length:removed.length},(_,i)=>original.length/16+i),'Landing rail and connection sill instances append to existing batches without changing any earlier instance');
      hash.update(Buffer.from(new Float32Array(original).buffer));
    }
    for(const material of [].concat(object.material)){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}
  });
  for(const part of railParts.values())assert.equal(part.seen,1,'Every permitted rail/sill component must occur exactly once with its specified material and transform');
  for(const part of portalParts.values())assert.equal(part.seen,1,`${part.name} must occur exactly once at its declared new transform and material`);
  assert.deepEqual([...moveIds].sort(),MOVES.map(move=>move.id).sort(),'Every approved prop translation is represented by exact old instance positions');
  assert.equal(addedInstances,22);assert.equal(addedTriangles,234);
  assert.equal(hash.digest('hex'),'ba3375d2ffcf8a98bc660804b74e772c86e1e7247a59918d1308f3844b27ac4d','After validating six prop translations and34 exact portal changes, and excluding separately tested new architecture/verified rail additions, every old world vertex, normal, index, remaining transform and solid/shadow flag stays identical');
  const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const legacyColliders=normalizedLegacyColliders(map.colliders),originalColliders=legacyColliders.slice(0,62),railColliders=map.colliders.filter(c=>c.kind==='railing'),surfaceColliders=map.colliders.filter(c=>c.kind==='surface');
  assert.equal(originalColliders.length,62);assert.equal(digest(originalColliders),'2f1540d46ea80f52346b34fd07452fccbc8bb8551daa207c2d342db937a056be','Every pre-existing collision shape remains byte-for-byte identical');
  assert.equal(railColliders.length,87);assert.equal(digest(railColliders),'e3778031958951695436040ea1e6a826febdb4303f08cdea9f2ff1b478cead12','All87 approved handrail collision shapes retain their exact values and order');
  assert.equal(surfaceColliders.length,30);assert.equal(new Set(surfaceColliders.map(c=>c.surfaceId)).size,30);assert.ok(surfaceColliders.every(c=>typeof c.surfaceId==='string'&&c.surfaceId.length>0));
  assert.equal(map.colliders.length,192);assert.equal(map.stats.collisionShapes,192);
  assert.deepEqual(map.colliders.slice(62,149),railColliders);assert.deepEqual(map.colliders.slice(149,179),surfaceColliders,'All30 roof/seat/sill supports retain their original slots before the new architecture');
  const portalIds=['station-portal-soffit','station-portal-metal','station-portal-cap'];
  assert.equal(digest(surfaceColliders.filter(c=>!portalIds.includes(c.surfaceId))),'e9672d96ec8436de15bf4b731541e56905674176572810dcf2133477eeb3e2d8','The27 other roof/seat/sill supports retain every exact value and their order');
  const support=(surfaceId,w,d,base,height)=>({minX:-20.75-w/2,maxX:-20.75+w/2,minZ:-32-d/2,maxZ:-32+d/2,height,base,kind:'surface',surfaceId});
  assert.deepEqual(surfaceColliders.slice(-3),[
    support(portalIds[0],16.7,1.9,3.995,4.075),support(portalIds[1],17.4,2.1,4.085,4.365),support(portalIds[2],17.8,2.2,4.36,4.45),
  ],'Only the three portal supports lower and recess to their exact matching rendered slabs');
  const metadata=Object.fromEntries(['bounds','sites','teamSpawns','landmarks','ramps','rangeArea','spawn','enemySpawns','spawnYaw','buyAreas','combatBounds','menuCamera','origin'].map(key=>[key,map[key]]));
  assert.equal(digest(metadata),'226e3d4f421dbf3b3da968d4759de7d6d63e66f721ada225a2b2ffc702d07505','Sites, all team/preview/practice spawns, buy areas, range, stairs/ramps and arena bounds retain the pre-redesign values');
  assert.deepEqual({meshes,instances,triangles,geometries:geometries.size,materials:materials.size,textures:textures.size},{meshes:118,instances:5151,triangles:91028,geometries:82,materials:77,textures:58});
  let bytes=0;for(const texture of textures)for(const image of Array.isArray(texture.image)?texture.image:[texture.image])bytes+=image.data?.byteLength??image.width*image.height*4;
  assert.equal(bytes,55574528+262144,'Only one small 256² RGBA surface image is added');

  const floor=map.world.getObjectByName('Concourse / terrazzo floor'),threshold=map.world.getObjectByName('Concourse / terrazzo threshold');
  assert.ok(floor&&threshold);assert.equal(floor.material,threshold.material,'Both slabs keep the same material and texture');
  const material=floor.material,surface=material.bumpMap;
  assert.equal(material.name,'Concourse / honed terrazzo');assert.equal(material.roughnessMap,surface);assert.equal(material.bumpScale,.003);
  assert.ok(material.envMap.isCubeTexture);assert.equal(material.envMapIntensity,.12);assert.equal(material.metalness,0);
  assert.equal(surface.name,'Concourse / honed terrazzo surface');assert.equal(surface.isDataTexture,true);assert.equal(surface.image.width,256);assert.equal(surface.image.height,256);
  assert.equal(surface.colorSpace,THREE.NoColorSpace,'Packed physical channels must not receive an sRGB color transform');
  assert.equal(surface.wrapS,THREE.RepeatWrapping);assert.equal(surface.wrapT,THREE.RepeatWrapping);assert.equal(surface.generateMipmaps,true);assert.equal(surface.anisotropy,8);
  assert.deepEqual(surface.repeat.toArray(),material.map.repeat.toArray());
  const data=surface.image.data,at=(x,y,channel)=>data[(y*256+x)*4+channel];let reliefMin=255,reliefMax=0,roughMin=255,roughMax=0;
  for(let i=0;i<data.length;i+=4){reliefMin=Math.min(reliefMin,data[i]);reliefMax=Math.max(reliefMax,data[i]);roughMin=Math.min(roughMin,data[i+1]);roughMax=Math.max(roughMax,data[i+1]);assert.equal(data[i+3],255);}
  assert.ok(at(0,120,0)<at(1,120,0)&&at(1,120,0)<at(2,120,0)&&at(2,120,0)<at(3,120,0),'The joint has a narrow bevel rather than a sharp deep trench');
  assert.ok(at(0,120,1)>at(3,120,1),'Cement joints remain rougher than the honed stone');
  const reliefMeters=(reliefMax-reliefMin)/255*material.bumpScale;
  assert.ok(reliefMeters>.001&&reliefMeters<.002,'Relief remains a restrained 1–2mm surface finish');
  assert.ok(roughMin*material.roughness/255>=.5&&roughMax*material.roughness/255<.9,'The material has a soft polish without a mirror-like floor');
  for(const slab of [floor,threshold]){
    const reference=new THREE.PlaneGeometry(14.3,slab===floor?30:5.2);
    assert.deepEqual(slab.geometry.getAttribute('position').array,reference.getAttribute('position').array);reference.dispose();
    const uv=slab.geometry.getAttribute('uv'),vs=Array.from({length:uv.count},(_,i)=>uv.getY(i)),height=slab===floor?30:5.2;
    const pitch=height/((Math.max(...vs)-Math.min(...vs))*surface.repeat.y);
    assert.ok(Math.abs(pitch-.6)<1e-7,'The entrance and long concourse both use the same 60cm stone modules');
  }
  const endUV=floor.geometry.getAttribute('uv'),entryUV=threshold.geometry.getAttribute('uv');
  assert.equal(endUV.getY(2),0);assert.equal(entryUV.getY(0),0,'The joint phase meets at the shared slab edge');
  const hits=new THREE.Raycaster(new THREE.Vector3(-20.75,1.7,-40),new THREE.Vector3(0,-1,0)).intersectObject(floor);
  assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-.005)<1e-8,'The floor remains at its original optical ray height');
  const second=createMap(THREE,new THREE.Scene()),again=second.world.getObjectByName('Concourse / terrazzo floor').material.bumpMap;
  assert.deepEqual(again.image.data,data,'Surface detail is deterministic across reloads');
  let disposals=0;surface.addEventListener('dispose',()=>disposals++);surface.dispose();assert.equal(disposals,1);
  console.log(`PASS concourse finish: ${meshes} legacy draws / ${instances} instances / ${triangles} triangles; exact old-world hash after six approved prop moves and34 individually verified portal changes;62 normalized original colliders +87 identical rails +27 identical support slabs +3 exact lowered portal supports; protected spawn/site/stair/range metadata and old resources unchanged; shared256² texture, relief ${(reliefMeters*1000).toFixed(2)}mm and both slabs0.60m tile pitch retained`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
