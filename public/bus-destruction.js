// Furniture and structural bays share their rendering, collision, radar and support.
// Debris is bounded, cosmetic and never changes actors or random combat rolls.
export function busHitsBox(p,c,pad=0){
 if(c.height<=.15||(c.base||0)>=3.3)return false;
 const x=(c.minX+c.maxX)/2,z=(c.minZ+c.maxZ)/2,rx=(c.maxX-c.minX)/2,rz=(c.maxZ-c.minZ)/2;
 const side=[Math.cos(p.yaw),-Math.sin(p.yaw)],forward=[Math.sin(p.yaw),Math.cos(p.yaw)],dx=x-p.x,dz=z-p.z;
 return [[1,0],[0,1],side,forward].every(([a,b])=>Math.abs(dx*a+dz*b)<=rx*Math.abs(a)+rz*Math.abs(b)+(1.3+pad)*Math.abs(a*side[0]+b*side[1])+(5.35+pad)*Math.abs(a*forward[0]+b*forward[1]));
}
// Clip the actual obstacle footprint against the oriented bus body. The
// intersection stays at the contact, even when one structural bay spans16m.
export function busImpactPoint(p,old,bounds){
 const candidates=[];
 for(const pose of[p,old]){
  if(!pose||![pose.x,pose.z,pose.yaw].every(Number.isFinite))continue;
  const cs=Math.cos(pose.yaw),sn=Math.sin(pose.yaw);
  for(const c of bounds){
   let poly=(c.polygon||[[c.minX,c.minZ],[c.maxX,c.minZ],[c.maxX,c.maxZ],[c.minX,c.maxZ]]).map(([x,z])=>[(x-pose.x)*cs-(z-pose.z)*sn,(x-pose.x)*sn+(z-pose.z)*cs]);
   for(const[axis,sign,limit]of[[0,1,1.3],[0,-1,1.3],[1,1,5.35],[1,-1,5.35]]){
    const out=[];for(let i=0;i<poly.length;i++){
     const a=poly[i],b=poly[(i+1)%poly.length],da=limit-sign*a[axis],db=limit-sign*b[axis],ina=da>=-1e-8,inb=db>=-1e-8;
     if(ina)out.push(a);if(ina!==inb){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    }poly=out;if(!poly.length)break;
   }
   if(!poly.length)continue;
   const u=poly.reduce((s,v)=>s+v[0],0)/poly.length,v=poly.reduce((s,v)=>s+v[1],0)/poly.length;
   candidates.push({x:pose.x+u*cs+v*sn,z:pose.z-u*sn+v*cs,y:Math.max((c.base||0)+.03,Math.min(c.height-.03,1.35)),distance:u*u+v*v});
  }
  if(candidates.length)break;
 }
 if(!candidates.length)return null;
 candidates.sort((a,b)=>a.distance-b.distance);const{x,y,z}=candidates[0];return{x,y,z};
}
export function createBusDestruction(T,world,colliders,mapShapes,groups,collision,ramps=[]){
 if(groups.length>256)throw Error('Bus demolition budget exceeded');
 const originalColliders=[...colliders],originalShapes=[...mapShapes],originalRamps=[...ramps],broken=new Set(),width=Math.ceil(groups.length/8)*2;
 const group=new T.Group();group.name='Bus impact debris';world.add(group);
 const chunkGeo=new T.BoxGeometry(1,1,1),dustGeo=new T.IcosahedronGeometry(1,0),ringGeo=new T.TorusGeometry(1,.065,5,24);
 const chunkMat=new T.MeshStandardMaterial({color:'#b6a797',roughness:.9}),dustMat=new T.MeshBasicMaterial({color:'#d8c7a9',transparent:true,opacity:.24,depthWrite:false}),ringMat=new T.MeshBasicMaterial({color:'#ffcc79',transparent:true,opacity:.6,depthWrite:false});
 const chunks=new T.InstancedMesh(chunkGeo,chunkMat,768),dust=new T.InstancedMesh(dustGeo,dustMat,192),rings=new T.InstancedMesh(ringGeo,ringMat,8);
 for(const mesh of[chunks,dust,rings]){mesh.frustumCulled=false;mesh.visible=false;mesh.count=0;mesh.raycast=()=>{};group.add(mesh);}
 const particles=[],blasts=[],matrix=new T.Matrix4(),pos=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion(),zero=new T.Matrix4().makeScale(0,0,0);let serial=0,latestImpacts=[];
 const list=groups.map((g,index)=>{let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,height=0,base=Infinity;
  for(const c of g.bounds){minX=Math.min(minX,c.minX);maxX=Math.max(maxX,c.maxX);minZ=Math.min(minZ,c.minZ);maxZ=Math.max(maxZ,c.maxZ);height=Math.max(height,c.height);base=Math.min(base,c.base||0);}
  return{...g,index,minX,maxX,minZ,maxZ,height,base};});
 const damageable=new Set(list.flatMap(g=>g.colliders)),nodeOwners=new Map();
 for(const g of list)for(const node of g.nodes){if(!nodeOwners.has(node))nodeOwners.set(node,[]);nodeOwners.get(node).push(g.index);}
 function visible(g,on){on=on&&!world.userData.bomberCollapsed;for(const p of g.parts){p.batch.mesh.setMatrixAt(p.index,on?p.matrix:zero);p.batch.mesh.instanceMatrix.needsUpdate=true;p.batch.mesh.boundingSphere=null;p.batch.mesh.boundingBox=null;const hidden=p.batch.mesh.userData.busBrokenInstances??=new Set();if(on)hidden.delete(p.index);else hidden.add(p.index);}}
 function rebuild(){const removed=new Set(),shapes=new Set(),removedRamps=new Set();for(const i of broken){for(const c of list[i].colliders)removed.add(c);for(const c of list[i].shapes)shapes.add(c);for(const ramp of list[i].ramps||[])removedRamps.add(ramp);}colliders.splice(0,colliders.length,...originalColliders.filter(c=>!world.userData.bomberCollapsed&&!removed.has(c)));mapShapes.splice(0,mapShapes.length,...originalShapes.filter(c=>!world.userData.bomberCollapsed&&!shapes.has(c)));ramps.splice(0,ramps.length,...originalRamps.filter(r=>!world.userData.bomberCollapsed&&!removedRamps.has(r)));for(const [node,owners]of nodeOwners){const on=!world.userData.bomberCollapsed&&owners.every(i=>!broken.has(i));node.visible=on;node.userData.busDebrisHidden=!on;}collision.invalidate();}
 function explode(g,time,impact){const c=g.bounds[0],x=impact?.x??(c.minX+c.maxX)/2,z=impact?.z??(c.minZ+c.maxZ)/2,y=impact?.y??Math.max((c.base||0)+.03,Math.min(c.height-.03,1.35)),seed=++serial;
  for(let i=0;i<96;i++){const a=(i*.61803398875+seed*.17)*Math.PI*2,f=.3+(i%11)/11;particles.push({at:time,x,y,z,vx:Math.cos(a)*(3+7*f),vz:Math.sin(a)*(3+7*f),vy:3+(i%9)*.7,size:(i%6===0?.42:.10)+(i%5)*.045,seed:i+seed});}
  while(particles.length>768)particles.shift();blasts.push({at:time,x,y,z,seed});while(blasts.length>8)blasts.shift();
 }
 function breakAt(p,old,time){const hit=[];latestImpacts=[];for(const g of list){
  if(broken.has(g.index))continue;
  // Driving under a roof or through a wall brings that local bay down. Ground
  // terrain and arena limits are outside the catalog and cannot be removed.
  const broad=g.structural?{...g,base:0,height:3.3}:g;
  if(!busHitsBox(p,broad)&&!busHitsBox(old,broad))continue;
  const touches=!g.structural||g.bounds.some(b=>busHitsBox(p,{...b,base:0,height:3.3})||busHitsBox(old,{...b,base:0,height:3.3}));
  if(touches){const impact=busImpactPoint(p,old,g.bounds)||busImpactPoint(p,old,g.bounds.map(c=>({...c,polygon:null})));broken.add(g.index);visible(g,false);explode(g,time,impact);if(impact)latestImpacts.push({...impact,index:g.index});hit.push(g.index);}
 }if(hit.length)rebuild();return hit;}
 function snapshot(){if(!broken.size)return '';const bytes=new Uint8Array(width/2);for(const i of broken)bytes[i>>3]|=1<<(i&7);return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');}
 function valid(mask){if(mask==='')return true;if(typeof mask!=='string'||![width,22].includes(mask.length)||!new RegExp('^[0-9a-f]{'+mask.length+'}$').test(mask))return false;const count=mask.length===22&&width!==22?82:list.length;for(let i=count;i<mask.length*4;i++)if(parseInt(mask.slice((i>>3)*2,(i>>3)*2+2),16)&1<<(i&7))return false;return true;}
 function restore(mask,time,{effects=false,impacts=[],contacts=[]}={}){if(!valid(mask))return false;const next=new Set();for(let i=0;i<list.length;i++)if(mask&&parseInt(mask.slice((i>>3)*2,(i>>3)*2+2),16)&1<<(i&7))next.add(i);
  let changed=false;for(const g of list)if(broken.has(g.index)!==next.has(g.index)){visible(g,!next.has(g.index));if(effects&&next.has(g.index)){const contact=[...contacts].reverse().find(p=>g.bounds.some(c=>p.x>=c.minX-.03&&p.x<=c.maxX+.03&&p.z>=c.minZ-.03&&p.z<=c.maxZ+.03&&p.y>=(c.base||0)-.03&&p.y<=c.height+.03)),points=contact?[]:impacts.map(p=>busImpactPoint(p,p,g.bounds)).filter(Boolean);explode(g,time,contact||points[0]);}changed=true;}broken.clear();for(const i of next)broken.add(i);if(changed)rebuild();return true;}
 function update(time){let n=0;for(const p of particles){const t=time-p.at;if(t<0||t>2.6)continue;pos.set(p.x+p.vx*t,Math.max(.08,p.y+p.vy*t-7.5*t*t),p.z+p.vz*t);rotation.setFromEuler(new T.Euler(t*4+p.seed,t*3,t*2));const size=p.size*Math.min(1,(2.6-t)*2);scale.set(size,size*(.45+(p.seed%3)*.25),size*(.6+(p.seed%4)*.2));chunks.setMatrixAt(n++,matrix.compose(pos,rotation,scale));}chunks.count=n;chunks.visible=n>0;chunks.instanceMatrix.needsUpdate=true;
  n=0;let q=0;for(const b of blasts){const t=time-b.at;if(t<0||t>2.2)continue;for(let i=0;i<24;i++){const a=i*Math.PI/12+b.seed;pos.set(b.x+Math.cos(a)*t*(1.8+i%3),b.y+t*(.7+i%5*.15),b.z+Math.sin(a)*t*(1.8+i%3));rotation.identity();scale.setScalar((.3+t*1.1)*(1-t/2.2));dust.setMatrixAt(n++,matrix.compose(pos,rotation,scale));}if(t<.65){pos.set(b.x,b.y,b.z);rotation.setFromEuler(new T.Euler(Math.PI/2,0,0));scale.setScalar((.5+t*8)*(1-t/.65));rings.setMatrixAt(q++,matrix.compose(pos,rotation,scale));}}
  dust.count=n;dust.visible=n>0;dust.instanceMatrix.needsUpdate=true;rings.count=q;rings.visible=q>0;rings.instanceMatrix.needsUpdate=true;
 }
 function reset(){restore('',0);particles.length=0;blasts.length=0;latestImpacts=[];serial=0;update(0);}
 return{groups:list,damageable,impactPoints:()=>latestImpacts.map(p=>({...p})),reconcile(){for(const g of list)visible(g,!broken.has(g.index));rebuild();},breakAt,snapshot,valid,restore,update,reset,fx:group,dispose(){reset();group.removeFromParent();for(const g of[chunkGeo,dustGeo,ringGeo])g.dispose();for(const m of[chunkMat,dustMat,ringMat])m.dispose();}};
}
