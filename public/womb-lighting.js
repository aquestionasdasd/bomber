import {createStaticLighting} from './static-lighting.js';
import {WOMB_BAKE} from './womb-bake.js';
import {WOMB_LIGHTING_CONFIG as config} from './womb-lighting-config.js';
import {WOMB_PLAN,WOMB_CORES,WOMB_LEVELS,wombPoint as P,wombRect as R,contains} from './womb-layout.js';

export function createWombLighting(T,map){
 const {world,colliders}=map,lights=[],lampPositions=[];
 const lamp=(x,y,z,w,d)=>{const a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],c=[x+w/2,y,z+d/2],e=[x-w/2,y,z+d/2];lampPositions.push(...a,...b,...c,...a,...c,...e);};
 world.updateMatrixWorld(true);
 const ray=new T.Raycaster(),up=new T.Vector3(0,1,0),candidates=[];
 // Sample room centre lines, then deduplicate nearby fixtures. Real ceiling
 // intersections set the mounting height, including the tall central atrium.
 for(let f=0;f<4;f++)for(const [x,z,w,d]of WOMB_PLAN[f].rooms){
  const nx=Math.max(1,Math.ceil(w/4.5)),nz=Math.max(1,Math.ceil(d/4.5));
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)candidates.push([x+w*(i+.5)/nx,z+d*(j+.5)/nz,WOMB_LEVELS[f]]);
 }
 for(let f=0;f<4;f++)for(const [x,z,w]of WOMB_CORES)candidates.push([x+w/2,z+6.5,WOMB_LEVELS[f]]);
 for(const [x,z,y]of candidates){
  const p=P(x,z,y),insideCore=WOMB_CORES.some(r=>contains(R(r),p.x,p.z));
  if(insideCore&&z<29)continue;
  if(colliders.some(c=>!c.movementRamp&&c.base<=y+1.7&&c.height>y+.25&&contains(c,p.x,p.z)))continue;
  ray.set(new T.Vector3(p.x,y+.3,p.z),up);ray.far=15;
  const hit=ray.intersectObject(world,true).find(h=>h.object.userData.solid&&h.distance>2.2);
  if(!hit)continue;
  const mount=hit.point.y-.045;
  if(lights.some(l=>Math.abs(l.position[1]-mount)<.6&&Math.hypot(l.position[0]-p.x,l.position[2]-p.z)<3.25))continue;
  const tall=mount-y>5,f=Math.round(y/3.6),width=tall?2.6:1.15,depth=tall?.5:.24;
  const color=tall?[1,.78,.56]:f===3?[.7,.88,1]:f===1?[1,.87,.72]:[.87,.83,1];
  lights.push({position:[p.x,mount-.012,p.z],width,depth,energy:tall?900:85,color});
  lamp(p.x,mount,p.z,width,depth);
 }
 // A second level of light inside the stair shafts makes the half-landings
 // readable. Fixtures sit below the following landing, out of actor headroom.
 for(let f=0;f<3;f++)for(const [x,z,w]of WOMB_CORES){const p=P(x+w/2,z+.8),floor=WOMB_LEVELS[f]+1.8;
  ray.set(new T.Vector3(p.x,floor+.3,p.z),up);ray.far=15;
  const hit=ray.intersectObject(world,true).find(h=>h.object.userData.solid);if(!hit)continue;
  const y=hit.point.y-.045;
  lights.push({position:[p.x,y-.012,p.z],width:1.6,depth:.24,energy:y-floor>4?180:75,color:[.85,.87,1]});
  lamp(p.x,y,p.z,1.6,.24);
 }
 // The 110 bake lights cost zero runtime lights; their visible panels share
 // one draw call instead of creating a separate mesh for every fixture.
 const lampGeometry=new T.BufferGeometry();lampGeometry.setAttribute('position',new T.Float32BufferAttribute(lampPositions,3));lampGeometry.computeBoundingSphere();
 const lampMesh=new T.Mesh(lampGeometry,new T.MeshBasicMaterial({color:'#e8e4df'}));lampMesh.name='WOMB fixtures';lampMesh.raycast=()=>{};world.add(lampMesh);
 // Include every static occluder/emitter, even when it is not a bake receiver.
 // A geometry or emissive-material change must never silently reuse stale light.
 world.updateMatrixWorld(true);let signatureExtra='';
 for(const m of world.children)if(m.isMesh&&m.name.startsWith('WOMB / '))signatureExtra+=JSON.stringify([m.name,Array.from(m.geometry.attributes.position.array),m.matrixWorld.elements,m.material.color?.toArray(),m.material.emissive?.toArray(),m.material.emissiveIntensity]);
 const study=createStaticLighting(T,world,lights,{config,bake:WOMB_BAKE,prefix:'WOMB / ',root:new URL('./lightmaps/womb/',import.meta.url),metalName:()=>false,probeAt:()=>null,tint:false,accept:m=>m.userData.wombBake===true,signatureExtra});
 study.label='WOMB';return study;
}
