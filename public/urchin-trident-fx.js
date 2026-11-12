import{URCHIN_TRIDENT as X}from'./urchin-trident.js';
// Fixed-size, visual-only pools. No raycasts, actor outlines or map markers.
export function createTridentFX(T){
 const group=new T.Group();group.name='三叉潮 / water shots';const box=new T.BoxGeometry(1,1,1),orb=new T.SphereGeometry(1,8,5),pose=new T.Object3D(),axis=new T.Vector3(0,0,1);
 const water=new T.MeshBasicMaterial({color:'#80e9ff',transparent:true,opacity:.65,depthTest:true,depthWrite:false}),foam=new T.MeshBasicMaterial({color:'#d4fbff',transparent:true,opacity:.8,depthTest:true,depthWrite:false});
 const lines=new T.InstancedMesh(box,water,X.maxTraces),drops=new T.InstancedMesh(orb,foam,X.maxSplashes);lines.count=drops.count=0;lines.frustumCulled=drops.frustumCulled=false;group.add(lines,drops);
 const traces=[],splashes=[],weapons=new Map();let last=-Infinity;
 function inert(o){o.raycast=()=>{};o.userData.solid=false;}group.traverse(inert);
 function shot(from,to,now,{side=false,hit=false,marked=false}={}){if(traces.length>=X.maxTraces)traces.shift();traces.push({from:from.clone(),to:to.clone(),at:now,side});if(hit){if(splashes.length>=X.maxSplashes/4)splashes.shift();splashes.push({p:to.clone(),at:now,marked});}}
 function update(items,now,{visible=()=>false,reducedMotion=false}={}){
  if(now<last)reset();last=now;const seen=new Set();
  for(const item of items.slice(0,X.maxWeapons)){const {id,muzzle,focus,startedAt,reload,local,point}=item;if(!muzzle)continue;seen.add(id);let w=weapons.get(id);
   if(!w){const root=new T.Group(),glow=new T.Mesh(new T.SphereGeometry(.07,8,5),water);glow.scale.set(1,.5,2.5);root.add(glow);for(let i=0;i<3;i++){const m=new T.Mesh(new T.ConeGeometry(.018,.14,5),foam);m.rotation.x=Math.PI/2;m.position.set((i-1)*.065,0,-.06);root.add(m);}root.traverse(inert);w={root};weapons.set(id,w);}if(w.root.parent!==muzzle)muzzle.add(w.root);
   w.root.visible=local||visible(point);w.root.position.set(0,0,-.08);const age=now-startedAt,scale=age<X.activation?1+.6*(1-age/X.activation):1;
   w.root.scale.setScalar(scale);for(let i=1;i<4;i++)w.root.children[i].visible=!focus||i===2;
   w.root.children[0].scale.x=focus?.65:1;w.root.rotation.z=reducedMotion?0:Math.sin(now*2)*.08;
   if(item.cosmetic&&item.flash&&w.sequence!==undefined&&w.sequence!==item.sequence){const aim=new T.Vector3(-Math.sin(item.yaw),0,-Math.cos(item.yaw));for(const angle of focus?[0]:[0,-X.angle,X.angle])shot(point,point.clone().addScaledVector(aim.clone().applyAxisAngle(new T.Vector3(0,1,0),angle),1.6),now,{side:angle!==0});}w.sequence=item.sequence;
   if(reload&&w.root.visible&&now-(w.reloadAt??-Infinity)>.18){w.reloadAt=now;if(splashes.length<X.maxSplashes/4)splashes.push({p:point.clone(),at:now,marked:false});}
  }
  for(const[id,w]of weapons)if(!seen.has(id)){w.root.removeFromParent();for(const child of w.root.children)if(child.geometry!==orb&&child.geometry!==box)child.geometry.dispose();weapons.delete(id);}
  for(let i=traces.length-1;i>=0;i--)if(now-traces[i].at>=X.traceLife)traces.splice(i,1);
  let n=0;for(const t of traces){const d=t.to.clone().sub(t.from),distance=d.length();if(!distance)continue;d.multiplyScalar(1/distance);const age=Math.max(0,(now-t.at)/X.traceLife),length=Math.min(3,distance),p=t.from.clone().addScaledVector(d,Math.min(distance-length/2,length/2+age*Math.max(0,distance-length)));
   if(!visible(p))continue;pose.position.copy(p);pose.quaternion.setFromUnitVectors(axis,d);pose.scale.set(t.side?.014:.024,t.side?.014:.024,length);pose.updateMatrix();lines.setMatrixAt(n++,pose.matrix);
  }lines.count=n;lines.instanceMatrix.needsUpdate=true;
  for(let i=splashes.length-1;i>=0;i--)if(now-splashes[i].at>=X.splashLife)splashes.splice(i,1);
  n=0;for(const s of splashes){if(!visible(s.p))continue;const age=Math.max(0,now-s.at);for(let i=0;i<4&&n<X.maxSplashes;i++){const a=i*2.4;pose.position.copy(s.p).add(new T.Vector3(Math.cos(a)*age*1.5,age*(1+i*.2),Math.sin(a)*age*1.5));pose.quaternion.identity();pose.scale.setScalar((s.marked?.045:.025)*(1-age/X.splashLife));if(s.marked)pose.scale.y*=2;pose.updateMatrix();drops.setMatrixAt(n++,pose.matrix);}}drops.count=n;drops.instanceMatrix.needsUpdate=true;
 }
 function reset(){traces.length=splashes.length=0;lines.count=drops.count=0;for(const w of weapons.values()){w.root.removeFromParent();for(const c of w.root.children)c.geometry.dispose();}weapons.clear();last=-Infinity;}
 return{group,shot,update,reset,stats:()=>({traces:traces.length,splashes:splashes.length,weapons:weapons.size,drawCalls:2})};
}
