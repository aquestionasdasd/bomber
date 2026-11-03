import {HIRAKATA_MODEL_LAYOUT} from './hirakata-complete-layout.js';
import {OAK_FINISH} from './assets/hirakata-oak-finish.js';
import {DISTRICT_FINISH} from './assets/hirakata-district-finish.js';

// Shared CC0 material scans and deterministic fine finishes across the district.
// This adds material detail only: no new geometry, layout, colliders or animation.
const SIZE=256,OAK_SIZE=512,OAK_BYTES=OAK_SIZE*OAK_SIZE*4;
const PROFILES=Object.freeze({
 wood:Object.freeze({family:'wood',width:1.8,length:1.8,normal:.5}),
 stone:Object.freeze({family:'mineral',width:1.6,length:1.6,normal:.14}),
 plaster:Object.freeze({family:'mineral',width:1.15,length:1.15,normal:.10}),
 steel:Object.freeze({family:'steel',width:.42,length:1.8,normal:.10}),
 concrete:Object.freeze({family:'concrete',width:2.4,length:2.4,normal:.26,roughness:.88,metalness:0}),
 paving:Object.freeze({family:'paving',width:.359375,length:.359375,normal:.20,roughness:.78,metalness:0}),
 asphalt:Object.freeze({family:'asphalt',width:2.1,length:2.1,normal:.38,roughness:.96,metalness:0}),
 painted:Object.freeze({family:'steel',width:.8,length:.8,normal:.045,roughness:.6,metalness:.18}),
 glass:Object.freeze({family:'steel',width:2.5,length:2.5,normal:.009,roughness:.19,metalness:.42,glass:true}),
 foliage:Object.freeze({family:'foliage',width:.8,length:.8,normal:.32,roughness:.94,metalness:0}),
 soil:Object.freeze({family:'concrete',width:.6,length:.6,normal:.42,roughness:1,metalness:0}),
});
const AO_WIDTH=512,AO_HEIGHT=256,AO_NEUTRAL=Object.freeze([.5/AO_WIDTH,.5/AO_HEIGHT]);
const AO_REGIONS=Object.freeze({
 Station_central_hall:Object.freeze({xmin:-49,xmax:3,zmin:-15,zmax:15,px:4,py:4,width:248,height:248,prefixes:['central-wood-pillar-','central-retail-counter-']}),
 Station_east_hall:Object.freeze({xmin:19.5,xmax:53.5,zmin:-15,zmax:15,px:260,py:4,width:248,height:248,prefixes:['east-dark-pillar-','east-gate-','east-ticket-','east-info-kiosk']}),
});

function profileFor(module,name){
 if(!module||module==='Vehicles'||module==='North_stationary_buses')return null;
 // This green surface is a landscape printed on columns, not live planting.
 if(module==='Station_ground_passage'&&name==='leaf')return null;
 if(module==='Station_central_hall'){
  if(name==='wood'||name==='woodlight'||name==='tan')return PROFILES.wood;
  if(name==='steel'||name==='silver')return PROFILES.steel;
 }
 if(module==='Station_east_hall'){
  // The generator uses tile2 and occasional tan for its gray wooden planks.
  if(name==='tile2'||name==='tan')return PROFILES.wood;
  if(name==='panel')return PROFILES.stone;
  if(name==='steel'||name==='silver')return PROFILES.steel;
 }
 if(module==='Station_central_gates'&&(name==='steel'||name==='silver'))return PROFILES.steel;
 if(module==='Station_upper_floor'&&name==='tile')return PROFILES.stone;
 if((module==='Station_central_Ceiling'||module==='Station_east_Ceiling')&&(name==='ivory'||name==='panel'))return PROFILES.plaster;
 // Authored letter meshes and road/tactile paint are protected by apply().
 // The original geometry already defines seams: the stone scan has no grout.
 if(name==='wood'||name==='woodlight')return PROFILES.wood;
 if(name==='road')return PROFILES.asphalt;
 if(['paving','tile','tile2','tile3','brick'].includes(name))return PROFILES.paving;
 if(['panel','sand','brown','tan'].includes(name))return PROFILES.concrete;
 if(name==='ivory')return PROFILES.plaster;
 if(name==='white'||name==='black')return PROFILES.painted;
 if(name==='steel'||name==='silver')return PROFILES.steel;
 if(['window','green_glass','glass_light','glass_dark'].includes(name))return PROFILES.glass;
 if(['leaf','leaflight','leafdark'].includes(name))return PROFILES.foliage;
 if(name==='soil')return PROFILES.soil;
 return null;
}

function hash(x,y,seed){
 let n=Math.imul(x,374761393)^Math.imul(y,668265263)^seed;
 n=Math.imul(n^(n>>>13),1274126177);
 return((n^(n>>>16))>>>0)/4294967295;
}
function wrap(value,period){return((value%period)+period)%period;}
function smooth(value){return value*value*(3-2*value);}
function mix(a,b,t){return a+(b-a)*t;}
function noise(u,v,nx,ny,seed){
 const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);
 const a=hash(wrap(ix,nx),wrap(iy,ny),seed),b=hash(wrap(ix+1,nx),wrap(iy,ny),seed);
 const c=hash(wrap(ix,nx),wrap(iy+1,ny),seed),d=hash(wrap(ix+1,nx),wrap(iy+1,ny),seed);
 return mix(mix(a,b,fx),mix(c,d,fx),fy);
}
function byte(value){return Math.max(0,Math.min(255,Math.round(value)));}

function surfaceTexture(T,textures,data,kind,label,width,height){
 const texture=new T.DataTexture(data,width,height,T.RGBAFormat,T.UnsignedByteType);
 textures.push(texture);texture.name='Hirakata '+label+' '+kind;
 texture.colorSpace=kind==='albedo'?T.SRGBColorSpace:T.NoColorSpace;
 texture.wrapS=texture.wrapT=T.RepeatWrapping;
 texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;
 texture.anisotropy=4;texture.flipY=false;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}

function makeOak(T,textures){
 if(OAK_FINISH.width!==OAK_SIZE||OAK_FINISH.height!==OAK_SIZE)throw Error('Hirakata oak: invalid dimensions');
 function texture(kind){
  const encoded=OAK_FINISH[kind];
  if(typeof encoded!=='string'||encoded.length!==4*Math.ceil(OAK_BYTES/3))throw Error('Hirakata oak: invalid encoded size');
  const decoded=atob(encoded);
  if(decoded.length!==OAK_BYTES)throw Error('Hirakata oak: invalid decoded size');
  const data=new Uint8Array(OAK_BYTES);for(let i=0;i<data.length;i++)data[i]=decoded.charCodeAt(i);
  // Prepared luminance albedo retains the authored wood/gray-plank tint. Source
  // rows already face OpenGL's UV origin; no second flip or normal inversion.
  return surfaceTexture(T,textures,data,kind,'CC0 Oak Veneer 01',OAK_SIZE,OAK_SIZE);
 }
 return{map:texture('albedo'),roughnessMap:texture('roughness'),normalMap:texture('normal')};
}

function makePhotographedFamily(T,textures,name){
 const source=DISTRICT_FINISH[name],size=512,bytes=size*size*4;
 if(!source||source.width!==size||source.height!==size)throw Error('Hirakata district: invalid material size');
 const result={};
 for(const[kind,slot]of [['albedo','map'],['roughness','roughnessMap'],['normal','normalMap']]){
  const encoded=source[kind];if(typeof encoded!=='string'||encoded.length!==4*Math.ceil(bytes/3))throw Error('Hirakata district: invalid encoded size');
  const decoded=atob(encoded);if(decoded.length!==bytes)throw Error('Hirakata district: invalid decoded size');
  const data=new Uint8Array(bytes);for(let i=0;i<bytes;i++)data[i]=decoded.charCodeAt(i);
  result[slot]=surfaceTexture(T,textures,data,kind,'CC0 '+name,size,size);
 }
 return result;
}

function makeFamily(T,family,textures){
 const height=new Float32Array(SIZE*SIZE),albedo=new Uint8Array(SIZE*SIZE*4),roughness=new Uint8Array(SIZE*SIZE*4),normal=new Uint8Array(SIZE*SIZE*4);
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const u=(x+.5)/SIZE,v=(y+.5)/SIZE,i=y*SIZE+x,p=i*4;
  const fine=noise(u,v,128,128,721),broad=noise(u,v,8,8,918);
  let value,rough,h;
  if(family==='mineral'){
   const grain=noise(u,v,64,64,215),pores=Math.max(0,.35-fine);
   value=246+7*(broad-.5)+7*(grain-.5)-10*pores;
   rough=.94+.08*(grain-.5)-.03*(broad-.5);
   h=.50+.10*(grain-.5)+.08*(fine-.5)-.07*pores;
  }else if(family==='foliage'){
   // Fine leaf-cluster variation on the retained canopy silhouettes. No alpha
   // cards, extra draw calls or animation; this does not replace tree geometry.
   const clusters=noise(u,v,12,12,413),veins=noise(u,v,64,32,377);
   value=210+32*(clusters-.5)+12*(fine-.5);
   rough=.94+.06*(veins-.5);h=.5+.24*(clusters-.5)+.08*(veins-.5);
  }else{
   const brush=noise(u,v,128,4,653),wear=noise(u,v,16,32,113);
   value=245+7*(brush-.5)+4*(wear-.5);
   rough=.88+.12*(brush-.5)+.05*(wear-.5);
   h=.50+.09*(brush-.5)+.025*(fine-.5);
  }
  height[i]=h;
  albedo[p]=albedo[p+1]=albedo[p+2]=byte(value);albedo[p+3]=255;
  roughness[p]=roughness[p+1]=roughness[p+2]=byte(rough*255);roughness[p+3]=255;
 }
 // Wrapped neighbours keep the normal map continuous at every repeat edge.
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const p=(y*SIZE+x)*4;
  const dx=(height[y*SIZE+(x+1)%SIZE]-height[y*SIZE+(x+SIZE-1)%SIZE])*2;
  const dy=(height[((y+1)%SIZE)*SIZE+x]-height[((y+SIZE-1)%SIZE)*SIZE+x])*2;
  const inverse=1/Math.hypot(dx,dy,1);
  normal[p]=byte((.5-dx*inverse*.5)*255);normal[p+1]=byte((.5-dy*inverse*.5)*255);
  normal[p+2]=byte((.5+inverse*.5)*255);normal[p+3]=255;
 }
 function texture(data,kind){
  return surfaceTexture(T,textures,data,kind,'original '+family,SIZE,SIZE);
 }
 return{map:texture(albedo,'albedo'),roughnessMap:texture(roughness,'roughness'),normalMap:texture(normal,'normal')};
}

function makeContactAo(T,textures){
 const data=new Uint8Array(AO_WIDTH*AO_HEIGHT*4);data.fill(255);
 const occluders={};
 for(const[module,region]of Object.entries(AO_REGIONS)){
  // Layout stores Blender (x,y horizontal,z up); the game uses (x,z=-y,y=z).
  // Only objects removed with THIS floor's destruction module cast its AO.
  const boxes=HIRAKATA_MODEL_LAYOUT.boxes.filter(box=>region.prefixes.some(prefix=>box.id.startsWith(prefix))&&box.z0<=6.5&&box.z1>6.6);
  occluders[module]=boxes.map(box=>box.id);
  for(let y=0;y<region.height;y++)for(let x=0;x<region.width;x++){
   const wx=mix(region.xmin,region.xmax,x/(region.width-1)),wz=mix(region.zmin,region.zmax,y/(region.height-1));
   let darkness=0;
   for(const box of boxes){
    const dx=Math.max(0,Math.abs(wx-box.x)-box.w/2),dz=Math.max(0,Math.abs(wz+box.y)-box.d/2),distance=Math.hypot(dx,dz);
    if(distance>=.8)continue;
    const falloff=smooth(Math.max(0,(distance-.15)/.65));
    darkness=Math.max(darkness,.35*(1-falloff));
   }
   const p=((region.py+y)*AO_WIDTH+region.px+x)*4,value=byte((1-darkness)*255);
   data[p]=data[p+1]=data[p+2]=value;
  }
 }
 const texture=new T.DataTexture(data,AO_WIDTH,AO_HEIGHT,T.RGBAFormat,T.UnsignedByteType);
 textures.push(texture);
 texture.name='Hirakata own-module floor contact AO';texture.channel=1;texture.colorSpace=T.NoColorSpace;
 texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;texture.minFilter=texture.magFilter=T.LinearFilter;
 // No mipmaps: every non-floor face samples the reserved neutral white texel,
 // and filtering must never blend it with an unrelated floor shadow region.
 texture.anisotropy=4;texture.flipY=false;texture.generateMipmaps=false;texture.needsUpdate=true;
 return{texture,occluders};
}

function projectedUv(T,mesh,profile,region){
 const position=mesh.geometry.getAttribute('position'),normal=mesh.geometry.getAttribute('normal');
 if(!position||!normal||position.count!==normal.count)return null;
 const values=new Float32Array(position.count*2),point=new T.Vector3(),direction=new T.Vector3();
 const contact=region?new Float32Array(position.count*2):null;let floorVertices=0;
 mesh.updateWorldMatrix(true,false);
 const normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
  direction.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();
  const nx=Math.abs(direction.x),ny=Math.abs(direction.y),nz=Math.abs(direction.z);
  // Existing GLB UVs are primitive-local and cannot give metre-sized grain.
  // Horizontal plank faces run along world Z; upright columns run along Y.
  let u,v;
  if(ny>=nx&&ny>=nz){u=point.x;v=point.z;}
  else if(nx>=nz){u=point.z;v=point.y;}
  else{u=point.x;v=point.y;}
  values[i*2]=u/profile.width;values[i*2+1]=v/profile.length;
  if(!Number.isFinite(values[i*2])||!Number.isFinite(values[i*2+1]))throw Error('Hirakata finish: nonfinite projected UV');
  if(contact){
   contact[i*2]=AO_NEUTRAL[0];contact[i*2+1]=AO_NEUTRAL[1];
   if(direction.y>.95&&point.y>=6.3999&&point.y<=6.5001&&point.x>=region.xmin&&point.x<=region.xmax&&point.z>=region.zmin&&point.z<=region.zmax){
    contact[i*2]=(region.px+.5+(point.x-region.xmin)/(region.xmax-region.xmin)*(region.width-1))/AO_WIDTH;
    contact[i*2+1]=(region.py+.5+(point.z-region.zmin)/(region.zmax-region.zmin)*(region.height-1))/AO_HEIGHT;
    floorVertices++;
   }
  }
 }
 return{uv:new T.BufferAttribute(values,2),uv1:floorVertices?new T.BufferAttribute(contact,2):null,floorVertices};
}

/** Apply once after model transforms/ground splitting. Owns only its clones and
 * textures, never source materials or geometries. dispose() is idempotent. */
export function createHirakataSurfaceFinish(T){
 const textures=[],materials=[],cache=new Map(),applied=new WeakSet();
 const stats={textureCount:0,textureSizes:{wood:[OAK_SIZE,OAK_SIZE],mineral:[SIZE,SIZE],steel:[SIZE,SIZE],foliage:[SIZE,SIZE],concrete:[512,512],paving:[512,512],asphalt:[512,512],contactAo:[AO_WIDTH,AO_HEIGHT]},textureBytes:0,materialCount:0,meshCount:0,uvVertices:0,contactAoMeshes:0,contactAoVertices:0,contactAoOccluders:{},families:{wood:0,mineral:0,steel:0,foliage:0,concrete:0,paving:0,asphalt:0},modules:{},disposed:false};
 let families,contactAo,disposed=false;
 try{
  families={wood:makeOak(T,textures),mineral:makeFamily(T,'mineral',textures),steel:makeFamily(T,'steel',textures),foliage:makeFamily(T,'foliage',textures)};
  for(const name of ['concrete','paving','asphalt'])families[name]=makePhotographedFamily(T,textures,name);
  contactAo=makeContactAo(T,textures);stats.contactAoOccluders=contactAo.occluders;
  stats.textureCount=textures.length;stats.textureBytes=textures.reduce((sum,t)=>sum+t.image.data.byteLength,0);
 }catch(error){for(const texture of textures)texture.dispose();throw error;}
 function apply(mesh){
  if(disposed||!mesh?.isMesh||applied.has(mesh)||Array.isArray(mesh.material)||!mesh.material?.isMeshStandardMaterial)return false;
  const module=mesh.userData?.hirakataModule,source=mesh.material;
  // Letters are independent meshes named by their text, never group/material.
  // Thin painted ground/road markings retain their original untextured color.
  if(mesh.name&&!mesh.name.startsWith(module+' / '))return false;
  if(['yellow','light','red','blue','pink','turquoise','warm'].includes(source.name))return false;
  if(mesh.userData.preserveGround&&['white','ivory','black'].includes(source.name))return false;
  const profile=profileFor(module,source.name);
  if(!profile)return false;
  const projected=projectedUv(T,mesh,profile,AO_REGIONS[mesh.userData?.hirakataModule]);if(!projected)return false;
  let profiles=cache.get(source);if(!profiles){profiles=new Map();cache.set(source,profiles);}
  const key=JSON.stringify([profile,!!projected.uv1]);
  let material=profiles.get(key);
  if(!material){
   material=source.clone();Object.assign(material,families[profile.family]);
   material.normalScale.set(profile.normal,profile.normal);
   if(profile.family==='wood'){material.roughness=.65;material.metalness=0;}
   if(profile.family==='steel'){material.roughness=.40;material.metalness=.8;}
   if(profile.roughness!==undefined)material.roughness=profile.roughness;
   if(profile.metalness!==undefined)material.metalness=profile.metalness;
   if(profile.glass)material.envMapIntensity=.70;
   if(projected.uv1){material.aoMap=contactAo.texture;material.aoMapIntensity=1;}
   material.userData={...material.userData,hirakataSurfaceFinish:profile.family};
   profiles.set(key,material);materials.push(material);stats.materialCount=materials.length;
  }
  mesh.geometry.setAttribute('uv',projected.uv);
  if(projected.uv1){mesh.geometry.setAttribute('uv1',projected.uv1);stats.contactAoMeshes++;stats.contactAoVertices+=projected.floorVertices;}
  mesh.material=material;applied.add(mesh);
  stats.meshCount++;stats.uvVertices+=projected.uv.count;stats.families[profile.family]++;stats.modules[module]=(stats.modules[module]||0)+1;return true;
 }
 function dispose(){
  if(disposed)return;disposed=true;stats.disposed=true;
  for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();cache.clear();
 }
 return{apply,textures,materials,dispose,stats};
}
