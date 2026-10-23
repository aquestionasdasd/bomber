// Architectural bays collapse from the ground to the roof. Split shared boxes
// at 16m seams so clearing one bay never leaves an invisible full-length slab.
const CELL=16, EPS=1e-7;
const box=(x,z,w,d,base,height)=>({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,base,height});
function tiles(b){
 const out=[];
 for(let iz=Math.floor((b.minZ+EPS)/CELL);iz<=Math.floor((b.maxZ-EPS)/CELL);iz++)
  for(let ix=Math.floor((b.minX+EPS)/CELL);ix<=Math.floor((b.maxX-EPS)/CELL);ix++){
   const minX=Math.max(b.minX,ix*CELL),maxX=Math.min(b.maxX,(ix+1)*CELL),minZ=Math.max(b.minZ,iz*CELL),maxZ=Math.min(b.maxZ,(iz+1)*CELL);
   if(maxX-minX>EPS&&maxZ-minZ>EPS)out.push({...b,minX,maxX,minZ,maxZ,key:ix+':'+iz});
  }
 return out;
}
export function addBusArchitecture(T,world,batches,colliders,mapShapes,ramps,furniture){
 const groups=new Map(),ownedParts=new Map(),ownedNodes=new Set(furniture.flatMap(g=>g.nodes)),ownedColliders=new Set(furniture.flatMap(g=>g.colliders)),ownedShapes=new Set(furniture.flatMap(g=>g.shapes));
 for(const g of furniture)for(const p of g.parts){if(!ownedParts.has(p.batch))ownedParts.set(p.batch,new Set());ownedParts.get(p.batch).add(p.index);}
 const get=id=>{if(!groups.has(id))groups.set(id,{id,structural:true,parts:[],nodes:[],colliders:[],shapes:[],bounds:[],ramps:[]});return groups.get(id);};
 const stairGroups=ramps.map((r,i)=>{const g=get('structure-stair-'+i);g.ramps.push(r);return{r,g};});
 const stairFor=b=>stairGroups.find(({r})=>{
  const x=(b.minX+b.maxX)/2,z=(b.minZ+b.maxZ)/2;
  return x>=r.minX-.25&&x<=r.maxX+.25&&z>r.minZ+EPS&&z<r.maxZ-EPS&&b.height<=6.3;
 })?.g;
 const pick=b=>get('structure-bay-'+b.key);
 const matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();
 for(const b of batches.values())for(const [index,value]of [...b.entries].entries()){
  if(ownedParts.get(b)?.has(index))continue;
  value.decompose(position,rotation,scale);
  const bounds=box(position.x,position.z,Math.abs(scale.x),Math.abs(scale.z),position.y-Math.abs(scale.y)/2,position.y+Math.abs(scale.y)/2);
  if(bounds.height<=.3)continue; // paving, lane paint and the base terrain remain.
  const stair=stairFor(bounds);
  if(stair){stair.parts.push({batch:b,index,matrix:value});stair.bounds.push(bounds);continue;}
  // Above-ground station/district boxes are axis aligned; road markings and
  // the already-owned furniture use their original rotated geometry.
  if(Math.abs(rotation.y)>EPS||Math.abs(rotation.x)>EPS||Math.abs(rotation.z)>EPS)throw Error('Unexpected rotated architectural box');
  let first=true;
  for(const tile of tiles(bounds)){
   position.set((tile.minX+tile.maxX)/2,(bounds.base+bounds.height)/2,(tile.minZ+tile.maxZ)/2);scale.set(tile.maxX-tile.minX,bounds.height-bounds.base,tile.maxZ-tile.minZ);
   const m=matrix.compose(position,rotation,scale).clone(),i=first?index:b.entries.length;
   if(first)b.entries[index]=m;else b.entries.push(m);first=false;
   const g=pick(tile);g.parts.push({batch:b,index:i,matrix:m});g.bounds.push(tile);
  }
 }
 const originalColliders=[...colliders];colliders.length=0;
 for(const c of originalColliders){
  if(ownedColliders.has(c)){colliders.push(c);continue;}
  const stair=stairFor(c);
  if(stair){colliders.push(c);stair.colliders.push(c);stair.bounds.push(c);continue;}
  for(const tile of tiles(c)){const piece={...c,minX:tile.minX,maxX:tile.maxX,minZ:tile.minZ,maxZ:tile.maxZ};colliders.push(piece);const g=pick(tile);g.colliders.push(piece);g.bounds.push(tile);}
 }
 const originalShapes=[...mapShapes];mapShapes.length=0;
 for(const s of originalShapes){
  if(ownedShapes.has(s)||!Number.isFinite(s.height)){mapShapes.push(s);continue;}
  const xs=s.polygon.map(p=>p[0]),zs=s.polygon.map(p=>p[1]),bounds={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),base:s.base||0,height:s.height},stair=stairFor(bounds);
  if(stair){mapShapes.push(s);stair.shapes.push(s);continue;}
  for(const t of tiles(bounds)){const piece={...s,polygon:[[t.minX,t.minZ],[t.maxX,t.minZ],[t.maxX,t.maxZ],[t.minX,t.maxZ]]};mapShapes.push(piece);pick(t).shapes.push(piece);}
 }
 // Elevated floor planes need the same seams and original UV coordinates.
 // Text signs are hidden as a whole if any of their supporting bays collapses.
 for(const node of [...world.children]){
  if(ownedNodes.has(node)||!node.isMesh||!node.geometry.isBufferGeometry||node.position.y<=.3)continue;
  node.updateMatrixWorld(true);const bounds3=new T.Box3().setFromObject(node),bounds={minX:bounds3.min.x,maxX:bounds3.max.x,minZ:bounds3.min.z,maxZ:bounds3.max.z,base:bounds3.min.y,height:bounds3.max.y};
  if(Math.abs(node.rotation.x+Math.PI/2)<EPS&&node.geometry.type==='PlaneGeometry'){
   const originalGeometry=node.geometry,mat=node.material,w=bounds.maxX-bounds.minX,d=bounds.maxZ-bounds.minZ;world.remove(node);
   for(const t of tiles(bounds)){
    const geometry=new T.PlaneGeometry(t.maxX-t.minX,t.maxZ-t.minZ),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(t.minX-bounds.minX+uv.getX(i)*(t.maxX-t.minX))/w,(bounds.maxZ-t.maxZ+uv.getY(i)*(t.maxZ-t.minZ))/d);
    const mesh=new T.Mesh(geometry,mat);mesh.rotation.copy(node.rotation);mesh.position.set((t.minX+t.maxX)/2,node.position.y,(t.minZ+t.maxZ)/2);mesh.receiveShadow=node.receiveShadow;world.add(mesh);const g=pick(t);g.nodes.push(mesh);g.bounds.push(t);
   }
   originalGeometry.dispose();
  }else{
   // Zero-width vertical planes still belong to their actual supporting cell.
   bounds.minX-=.002;bounds.maxX+=.002;bounds.minZ-=.002;bounds.maxZ+=.002;
   for(const t of tiles(bounds)){const g=pick(t);g.nodes.push(node);g.bounds.push(t);}
  }
 }
 for(const light of world.children.filter(o=>o.isLight&&o.position.y>.3))get('structure-bay-'+Math.floor(light.position.x/CELL)+':'+Math.floor(light.position.z/CELL)).nodes.push(light);
 return [...furniture,...groups.values()];
}
