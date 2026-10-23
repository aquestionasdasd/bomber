// Removable furniture shares its original render instances, collision and radar.
// Debris is bounded, cosmetic and never changes actors or random combat rolls.
export function busHitsBox(p,c,pad=0){
 if(c.height<=.15||(c.base||0)>=3.3)return false;
 const x=(c.minX+c.maxX)/2,z=(c.minZ+c.maxZ)/2,rx=(c.maxX-c.minX)/2,rz=(c.maxZ-c.minZ)/2;
 const side=[Math.cos(p.yaw),-Math.sin(p.yaw)],forward=[Math.sin(p.yaw),Math.cos(p.yaw)],dx=x-p.x,dz=z-p.z;
 return [[1,0],[0,1],side,forward].every(([a,b])=>Math.abs(dx*a+dz*b)<=rx*Math.abs(a)+rz*Math.abs(b)+(1.3+pad)*Math.abs(a*side[0]+b*side[1])+(5.35+pad)*Math.abs(a*forward[0]+b*forward[1]));
}
export function createBusDestruction(T,world,colliders,mapShapes,groups,collision){
 if(groups.length>128)throw Error('Bus furniture budget exceeded');
 const originalColliders=[...colliders],originalShapes=[...mapShapes],broken=new Set(),width=Math.ceil(groups.length/8)*2;
 const group=new T.Group();group.name='Bus impact debris';world.add(group);
 const chunkGeo=new T.BoxGeometry(1,1,1),dustGeo=new T.IcosahedronGeometry(1,0),ringGeo=new T.TorusGeometry(1,.065,5,24);
 const chunkMat=new T.MeshStandardMaterial({color:'#b6a797',roughness:.9}),dustMat=new T.MeshBasicMaterial({color:'#d8c7a9',transparent:true,opacity:.24,depthWrite:false}),ringMat=new T.MeshBasicMaterial({color:'#ffcc79',transparent:true,opacity:.6,depthWrite:false});
 const chunks=new T.InstancedMesh(chunkGeo,chunkMat,96),dust=new T.InstancedMesh(dustGeo,dustMat,48),rings=new T.InstancedMesh(ringGeo,ringMat,8);
 for(const mesh of[chunks,dust,rings]){mesh.frustumCulled=false;mesh.visible=false;mesh.count=0;mesh.raycast=()=>{};group.add(mesh);}
 const particles=[],blasts=[],matrix=new T.Matrix4(),pos=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion(),zero=new T.Matrix4().makeScale(0,0,0);let serial=0;
 const list=groups.map((g,index)=>{let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,height=0,base=Infinity;
  for(const c of g.bounds){minX=Math.min(minX,c.minX);maxX=Math.max(maxX,c.maxX);minZ=Math.min(minZ,c.minZ);maxZ=Math.max(maxZ,c.maxZ);height=Math.max(height,c.height);base=Math.min(base,c.base||0);}
  return{...g,index,minX,maxX,minZ,maxZ,height,base};});
 const damageable=new Set(list.flatMap(g=>g.colliders));
 function visible(g,on){for(const p of g.parts){p.batch.mesh.setMatrixAt(p.index,on?p.matrix:zero);p.batch.mesh.instanceMatrix.needsUpdate=true;p.batch.mesh.boundingSphere=null;p.batch.mesh.boundingBox=null;const hidden=p.batch.mesh.userData.busBrokenInstances??=new Set();if(on)hidden.delete(p.index);else hidden.add(p.index);}for(const o of g.nodes){o.visible=on;o.userData.busDebrisHidden=!on;}}
 function rebuild(){const removed=new Set(),shapes=new Set();for(const i of broken){for(const c of list[i].colliders)removed.add(c);for(const c of list[i].shapes)shapes.add(c);}colliders.splice(0,colliders.length,...originalColliders.filter(c=>!removed.has(c)));mapShapes.splice(0,mapShapes.length,...originalShapes.filter(c=>!shapes.has(c)));collision.invalidate();}
 function explode(g,time){const x=(g.minX+g.maxX)/2,z=(g.minZ+g.maxZ)/2,y=Math.min(1.8,(g.base+g.height)/2),seed=++serial;
  for(let i=0;i<18;i++){const a=(i*.61803398875+seed*.17)*Math.PI*2,f=.5+(i%5)/5;particles.push({at:time,x,y,z,vx:Math.cos(a)*(3+5*f),vz:Math.sin(a)*(3+5*f),vy:3+(i%6),size:.12+(i%4)*.09,seed:i+seed});}
  while(particles.length>96)particles.shift();blasts.push({at:time,x,y,z,seed});while(blasts.length>8)blasts.shift();
 }
 function breakAt(p,old,time){const hit=[];for(const g of list)if(!broken.has(g.index)&&(busHitsBox(p,g)||busHitsBox(old,g))){broken.add(g.index);visible(g,false);explode(g,time);hit.push(g.index);}if(hit.length)rebuild();return hit;}
 function snapshot(){if(!broken.size)return '';const bytes=new Uint8Array(width/2);for(const i of broken)bytes[i>>3]|=1<<(i&7);return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');}
 function valid(mask){if(mask==='')return true;if(typeof mask!=='string'||mask.length!==width||!new RegExp('^[0-9a-f]{'+width+'}$').test(mask))return false;for(let i=list.length;i<width*4;i++)if(parseInt(mask.slice((i>>3)*2,(i>>3)*2+2),16)&1<<(i&7))return false;return true;}
 function restore(mask,time,{effects=false}={}){if(!valid(mask))return false;const next=new Set();for(let i=0;i<list.length;i++)if(mask&&parseInt(mask.slice((i>>3)*2,(i>>3)*2+2),16)&1<<(i&7))next.add(i);
  let changed=false;for(const g of list)if(broken.has(g.index)!==next.has(g.index)){visible(g,!next.has(g.index));if(effects&&next.has(g.index))explode(g,time);changed=true;}broken.clear();for(const i of next)broken.add(i);if(changed)rebuild();return true;}
 function update(time){let n=0;for(const p of particles){const t=time-p.at;if(t<0||t>1.7)continue;pos.set(p.x+p.vx*t,Math.max(.08,p.y+p.vy*t-7.5*t*t),p.z+p.vz*t);rotation.setFromEuler(new T.Euler(t*4+p.seed,t*3,t*2));scale.setScalar(p.size*Math.min(1,(1.7-t)*2));chunks.setMatrixAt(n++,matrix.compose(pos,rotation,scale));}chunks.count=n;chunks.visible=n>0;chunks.instanceMatrix.needsUpdate=true;
  n=0;let q=0;for(const b of blasts){const t=time-b.at;if(t<0||t>1.6)continue;for(let i=0;i<6;i++){const a=i*Math.PI/3+b.seed;pos.set(b.x+Math.cos(a)*t*2,b.y+t*(1+i*.12),b.z+Math.sin(a)*t*2);rotation.identity();scale.setScalar((.4+t*1.8)*(1-t/1.6));dust.setMatrixAt(n++,matrix.compose(pos,rotation,scale));}if(t<.65){pos.set(b.x,.18,b.z);rotation.setFromEuler(new T.Euler(Math.PI/2,0,0));scale.setScalar((.5+t*8)*(1-t/.65));rings.setMatrixAt(q++,matrix.compose(pos,rotation,scale));}}
  dust.count=n;dust.visible=n>0;dust.instanceMatrix.needsUpdate=true;rings.count=q;rings.visible=q>0;rings.instanceMatrix.needsUpdate=true;
 }
 function reset(){restore('',0);particles.length=0;blasts.length=0;serial=0;update(0);}
 return{groups:list,damageable,breakAt,snapshot,valid,restore,update,reset,fx:group,dispose(){reset();group.removeFromParent();for(const g of[chunkGeo,dustGeo,ringGeo])g.dispose();for(const m of[chunkMat,dustMat,ringMat])m.dispose();}};
}
