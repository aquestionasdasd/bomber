import {HIRAKATA_MODEL_BASE64, HIRAKATA_MODEL_PROVENANCE} from './assets/hirakata-complete-model.js';
import {createHirakataSurfaceFinish} from './hirakata-surface-finish.js';

// This self-exported GLB has no textures, animations, skins, sparse accessors or
// compression. Keep the decoder bounded to that documented, tested asset format.
const MAX_BYTES=32*1024*1024, MAX_NODES=2048, MAX_MESHES=1024;
const SOUTH_BUS_REGIONS=Object.freeze([
 {minX:-47.6,maxX:-36.4,minZ:26.2,maxZ:29.8},
 {minX:-19.6,maxX:-8.4,minZ:54.2,maxZ:57.8},
]);
let savedBinary;
function modelBinary(){
 if(!savedBinary){
  const decoded=atob(HIRAKATA_MODEL_BASE64),bytes=new Uint8Array(decoded.length);
  for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
  savedBinary=bytes.buffer;
 }
 return savedBinary;
}
function invariant(condition,message){if(!condition)throw Error('Hirakata GLB: '+message);}
function integer(value){return Number.isSafeInteger(value)&&value>=0;}
function finiteArray(value,length){return Array.isArray(value)&&value.length===length&&value.every(Number.isFinite);}

function readGlb(buffer){
 invariant(buffer instanceof ArrayBuffer&&buffer.byteLength>=28&&buffer.byteLength<=MAX_BYTES,'invalid byte length');
 const view=new DataView(buffer),length=buffer.byteLength;
 invariant(view.getUint32(0,true)===0x46546c67&&view.getUint32(4,true)===2&&view.getUint32(8,true)===length,'invalid header');
 const jsonLength=view.getUint32(12,true),jsonEnd=20+jsonLength;
 invariant(view.getUint32(16,true)===0x4e4f534a&&jsonLength%4===0&&jsonEnd+8<=length,'invalid JSON chunk');
 const doc=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonLength))),binStart=jsonEnd+8,binLength=view.getUint32(jsonEnd,true);
 invariant(view.getUint32(jsonEnd+4,true)===0x004e4942&&binLength%4===0&&binStart+binLength===length,'invalid binary chunk');
 invariant(doc.asset?.version==='2.0'&&Array.isArray(doc.buffers)&&doc.buffers.length===1&&!doc.buffers[0].uri,'unsupported buffer');
 invariant(integer(doc.buffers[0].byteLength)&&doc.buffers[0].byteLength<=binLength&&binLength-doc.buffers[0].byteLength<=3,'invalid buffer length');
 invariant(Array.isArray(doc.nodes)&&doc.nodes.length<=MAX_NODES&&Array.isArray(doc.meshes)&&doc.meshes.length<=MAX_MESHES,'invalid scene size');
 invariant(Array.isArray(doc.accessors)&&Array.isArray(doc.bufferViews)&&Array.isArray(doc.materials),'missing tables');
 invariant(!doc.textures?.length&&!doc.images?.length&&!doc.animations?.length&&!doc.skins?.length,'unsupported external or animated content');
 invariant((doc.extensionsUsed||[]).every(name=>name==='KHR_materials_emissive_strength'),'unsupported extension');
 for(const v of doc.bufferViews)invariant(v.buffer===0&&integer(v.byteOffset||0)&&integer(v.byteLength)&&(v.byteOffset||0)+v.byteLength<=doc.buffers[0].byteLength&&!v.byteStride,'invalid buffer view');
 return{doc,buffer,binStart};
}

function daylightCube(T){
 // Original procedural gradient, matching the study viewer without a DOM,
 // another renderer or external images. Three r160 generates PMREM on demand.
 const colors={sky:[140,168,194],ground:[168,170,162],middle:[233,236,231],upper:[180,202,221],lower:[199,216,229],base:[170,169,154]};
 const size=64,faces=[];
 for(let face=0;face<6;face++){
  const top=face===3?colors.ground:colors.sky,mid=face===2?colors.upper:colors.middle,end=face===2?colors.lower:colors.base,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++){
   const t=(y+.5)/size,a=t<.55?top:mid,b=t<.55?mid:end,f=t<.55?t/.55:(t-.55)/.45;
   for(let x=0;x<size;x++){const p=(y*size+x)*4;for(let c=0;c<3;c++)data[p+c]=Math.round(a[c]+(b[c]-a[c])*f);data[p+3]=255;}
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat,T.UnsignedByteType);texture.colorSpace=T.SRGBColorSpace;faces.push(texture);
 }
 const cube=new T.CubeTexture(faces);cube.name='Hirakata original daylight reflection';cube.colorSpace=T.SRGBColorSpace;cube.needsUpdate=true;
 return{cube,faces};
}

function compactGeometry(T,geometry,indices){
 const remap=new Map(),sourceVertices=[],remapped=indices.map(id=>{if(!remap.has(id)){remap.set(id,remap.size);sourceVertices.push(id);}return remap.get(id);});
 const replacement=new T.BufferGeometry();
 for(const[name,attribute]of Object.entries(geometry.attributes)){
  const values=new attribute.array.constructor(sourceVertices.length*attribute.itemSize);
  for(let i=0;i<sourceVertices.length;i++)for(let k=0;k<attribute.itemSize;k++)values[i*attribute.itemSize+k]=attribute.array[sourceVertices[i]*attribute.itemSize+k];
  replacement.setAttribute(name,new T.BufferAttribute(values,attribute.itemSize,attribute.normalized));
 }
 replacement.setIndex(remapped);return replacement;
}

function removeSouthBuses(T,mesh){
 const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index,kept=[],point=new T.Vector3();let removed=0;
 const count=index?index.count:position.count;
 for(let i=0;i<count;i+=3){
  const vertices=[0,1,2].map(k=>index?index.getX(i+k):i+k);
  const regions=vertices.map(id=>{point.fromBufferAttribute(position,id).applyMatrix4(mesh.matrixWorld);return SOUTH_BUS_REGIONS.findIndex(r=>point.x>=r.minX&&point.x<=r.maxX&&point.z>=r.minZ&&point.z<=r.maxZ&&point.y>=-.1&&point.y<=3.6);});
  if(regions.every(region=>region>=0&&region===regions[0])){removed++;continue;}
  invariant(regions.every(region=>region===-1),'a vehicle triangle crosses the static bus boundary');
  kept.push(...vertices);
 }
 if(!removed)return 0;
 if(!kept.length){mesh.removeFromParent();geometry.dispose();return removed;}
 // Compact retained taxi vertices too: obsolete bus vertices must not enlarge
 // bounds used for frustum culling and building-collapse/destruction snapshots.
 mesh.geometry=compactGeometry(T,geometry,kept);geometry.dispose();return removed;
}

function separateGround(T,mesh,geometries){
 const original=mesh.geometry,position=original.attributes.position,index=original.index,ground=[],upper=[],point=new T.Vector3(),count=index?index.count:position.count;
 for(let i=0;i<count;i+=3){
  const vertices=[0,1,2].map(k=>index?index.getX(i+k):i+k);
  const preserve=vertices.every(id=>point.fromBufferAttribute(position,id).applyMatrix4(mesh.matrixWorld).y<=.35);
  (preserve?ground:upper).push(...vertices);
 }
 if(!ground.length){mesh.userData.preserveGround=false;return;}
 if(!upper.length){mesh.userData.preserveGround=true;mesh.castShadow=false;return;}
 mesh.geometry=compactGeometry(T,original,upper);geometries.add(mesh.geometry);mesh.userData.preserveGround=false;
 const floor=new T.Mesh(compactGeometry(T,original,ground),mesh.material);geometries.add(floor.geometry);floor.name=mesh.name+' / ground';floor.position.copy(mesh.position);floor.quaternion.copy(mesh.quaternion);floor.scale.copy(mesh.scale);floor.receiveShadow=true;floor.castShadow=false;floor.userData={...mesh.userData,preserveGround:true};mesh.parent.add(floor);
 geometries.delete(original);original.dispose();
}

// Exported separately so malformed bytes can be tested without a browser or GPU.
export function decodeHirakataModel(T,buffer){
 const{doc,binStart}=readGlb(buffer),geometries=new Set(),materials=[],nodes=[],groups=new Map(),groupMeshes=new Map();
 const world=new T.Group();world.name='Hirakata complete video-reference model';world.userData.hirakataModel=HIRAKATA_MODEL_PROVENANCE.id;
 let environment,surfaceFinish;
 try{
  const attributeCache=new Map(),ctors={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  function accessor(id){
   invariant(integer(id)&&id<doc.accessors.length,'invalid accessor index');if(attributeCache.has(id))return attributeCache.get(id);
   const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],Ctor=ctors[a.componentType],size=sizes[a.type];
   invariant(v&&Ctor&&size&&!a.sparse&&integer(a.count)&&integer(a.byteOffset||0),'unsupported accessor');
   const offset=binStart+(v.byteOffset||0)+(a.byteOffset||0),bytes=a.count*size*Ctor.BYTES_PER_ELEMENT;
   invariant(offset%Ctor.BYTES_PER_ELEMENT===0&&(a.byteOffset||0)+bytes<=v.byteLength,'accessor outside buffer view');
   const array=new Ctor(buffer,offset,a.count*size);invariant(!(array instanceof Float32Array)||array.every(Number.isFinite),'nonfinite vertex');
   const attribute=new T.BufferAttribute(array,size,!!a.normalized);attributeCache.set(id,attribute);return attribute;
  }
  environment=daylightCube(T);
  for(const m of doc.materials){
   const p=m.pbrMetallicRoughness||{},c=p.baseColorFactor||[1,1,1,1],emissive=m.emissiveFactor||[0,0,0],strength=m.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1;
   invariant(finiteArray(c,4)&&finiteArray(emissive,3)&&Number.isFinite(strength),'invalid material');
   materials.push(new T.MeshStandardMaterial({name:m.name||'',color:new T.Color(c[0],c[1],c[2]),opacity:c[3],transparent:m.alphaMode==='BLEND',alphaTest:m.alphaMode==='MASK'?(m.alphaCutoff??.5):0,metalness:p.metallicFactor??1,roughness:p.roughnessFactor??1,side:m.doubleSided?T.DoubleSide:T.FrontSide,emissive:new T.Color(...emissive),emissiveIntensity:strength,envMap:environment.cube,envMapIntensity:.30}));
  }
  for(const n of doc.nodes){
   const node=new T.Group();node.name=n.name||'';
   if(n.matrix){invariant(finiteArray(n.matrix,16),'invalid node matrix');node.applyMatrix4(new T.Matrix4().fromArray(n.matrix));}
   else{if(n.translation){invariant(finiteArray(n.translation,3),'invalid translation');node.position.fromArray(n.translation);}if(n.rotation){invariant(finiteArray(n.rotation,4),'invalid rotation');node.quaternion.fromArray(n.rotation);}if(n.scale){invariant(finiteArray(n.scale,3),'invalid scale');node.scale.fromArray(n.scale);}}
   nodes.push(node);
  }
  const parents=new Set();
  for(let i=0;i<doc.nodes.length;i++)for(const child of doc.nodes[i].children||[]){invariant(integer(child)&&child<nodes.length&&child!==i&&!parents.has(child),'invalid or shared child');parents.add(child);nodes[i].add(nodes[child]);}
  const scene=doc.scenes?.[doc.scene??0];invariant(scene&&Array.isArray(scene.nodes),'missing scene');
  const visited=new Set(),excluded=new Set();
  function collect(id,rootName,omit=false){
   invariant(integer(id)&&id<nodes.length&&!visited.has(id),'cyclic or repeated scene node');visited.add(id);
   if(omit)excluded.add(id);else nodes[id].userData.hirakataModule=rootName;
   for(const child of doc.nodes[id].children||[])collect(child,rootName,omit);
  }
  for(const id of scene.nodes){
   invariant(integer(id)&&id<nodes.length&&!parents.has(id),'invalid root');const name=nodes[id].name;
   invariant(!groups.has(name),'duplicate root name');collect(id,name,name==='North_stationary_buses');
   if(name!=='North_stationary_buses'){groups.set(name,nodes[id]);world.add(nodes[id]);}
  }
  let sourceTriangleCount=0,removedTriangleCount=0,northRemovedTriangleCount=0;
  for(let i=0;i<doc.nodes.length;i++){
   const n=doc.nodes[i];if(n.mesh===undefined)continue;
   invariant(integer(n.mesh)&&doc.meshes[n.mesh]&&Array.isArray(doc.meshes[n.mesh].primitives),'invalid mesh');
   for(const p of doc.meshes[n.mesh].primitives){
    invariant((p.mode??4)===4&&!p.extensions&&!p.targets,'unsupported primitive');
    const pos=accessor(p.attributes?.POSITION),index=p.indices!==undefined?accessor(p.indices):null,count=index?index.count:pos.count;
    invariant(pos.itemSize===3&&pos.array instanceof Float32Array&&count%3===0,'invalid triangle positions');
    if(index)invariant(index.itemSize===1&&!(index.array instanceof Float32Array)&&index.array.every(value=>value<pos.count),'invalid triangle index');
    sourceTriangleCount+=count/3;if(excluded.has(i)){northRemovedTriangleCount+=count/3;continue;}if(!visited.has(i))continue;
    invariant(integer(p.material)&&materials[p.material],'missing material');
    const geometry=new T.BufferGeometry();geometries.add(geometry);
    for(const [key,id]of Object.entries(p.attributes)){const name={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color'}[key];invariant(name,'unsupported attribute');const a=accessor(id);invariant(a.count===pos.count,'attribute length mismatch');geometry.setAttribute(name,a);}
    if(index)geometry.setIndex(index);if(!geometry.attributes.normal)geometry.computeVertexNormals();
    const mesh=new T.Mesh(geometry,materials[p.material]);mesh.name=n.name||'Hirakata mesh';mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.solid=true;mesh.userData.hirakataModule=nodes[i].userData.hirakataModule;nodes[i].add(mesh);
   }
  }
  world.updateMatrixWorld(true);
  const vehicles=groups.get('Vehicles');if(vehicles)for(const child of [...vehicles.children])for(const mesh of [...child.children])if(mesh.isMesh){const old=mesh.geometry;removedTriangleCount+=removeSouthBuses(T,mesh);if(mesh.geometry!==old||!mesh.parent)geometries.delete(old);if(mesh.parent)geometries.add(mesh.geometry);}
  const originals=[];world.traverse(mesh=>{if(mesh.isMesh)originals.push(mesh);});for(const mesh of originals)separateGround(T,mesh,geometries);
  world.updateMatrixWorld(true);
  surfaceFinish=createHirakataSurfaceFinish(T);world.traverse(mesh=>surfaceFinish.apply(mesh));
  const meshes=[];let triangleCount=0;
  for(const[name,group]of groups){const list=[];group.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();geometries.add(mesh.geometry);list.push(mesh);meshes.push(mesh);triangleCount+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;});groupMeshes.set(name,list);}
  removedTriangleCount+=northRemovedTriangleCount;
  invariant(sourceTriangleCount-triangleCount===removedTriangleCount,'unexpected triangle loss');
  // Restrained sky/reflection fill leaves the existing sun shadows readable;
  // fixture lights retain clean, legible concourses without new render passes.
  const ambient=new T.AmbientLight('#e3dfd3',.06);ambient.name='Hirakata interior fill';world.add(ambient);
  // Small unshadowed fixture lights belong to their destructible ceiling.
  // No new shadow maps, timers or per-frame material updates are required.
  for(const [name,xs,y]of [['Station_central_Ceiling',[-29,-10],9.85],['Station_east_Ceiling',[28,44],9.55]]){
   const ceiling=groupMeshes.get(name)?.find(mesh=>!mesh.userData.preserveGround);if(!ceiling)continue;
   for(const x of xs){const light=new T.PointLight('#fff2dc',18,23,2);light.name='Hirakata concourse fixture';light.position.set(x,y,0);ceiling.worldToLocal(light.position);ceiling.add(light);}
  }
  let disposed=false;
  function dispose(){if(disposed)return;disposed=true;world.removeFromParent();surfaceFinish.dispose();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();environment.cube.dispose();for(const face of environment.faces)face.dispose();}
  return{world,groups,groupMeshes,meshes,meshCount:meshes.length,triangleCount,sourceTriangleCount,removedTriangleCount,northRemovedTriangleCount,materials,environment:environment.cube,surfaceFinish,provenance:HIRAKATA_MODEL_PROVENANCE,dispose};
 }catch(error){world.removeFromParent();surfaceFinish?.dispose();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();if(environment){environment.cube.dispose();for(const face of environment.faces)face.dispose();}throw error;}
}

export function createHirakataModel(T){return decodeHirakataModel(T,modelBinary());}
