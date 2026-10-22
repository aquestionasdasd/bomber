// Deterministic environmental traffic. The host alone calls impacts(); rendering
// uses the same clock on guests. No audio and no actor/room references here.
export const BUS_SPEC=Object.freeze({speed:11.2,width:2.5,length:10.6,height:3.25,damage:100,cooldown:1.25,launchSeconds:.8});
export function ovalRoute(cx,cz,rx,rz,count=80){return Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count;return{x:cx+Math.cos(a)*rx,z:cz+Math.sin(a)*rz};});}
export const HIRAKATA_BUS_ROUTES=Object.freeze([
 {id:'south-1',points:ovalRoute(0,49,49,17),offset:0},
 {id:'south-2',points:ovalRoute(0,49,49,17),offset:125},
 {id:'north-1',points:ovalRoute(29,-49,30,14),offset:30},
 {id:'north-2',points:ovalRoute(29,-49,30,14),offset:118},
]);
export function createTrafficClock(routes=HIRAKATA_BUS_ROUTES){
 const tracks=routes.map(r=>{const segments=r.points.map((p,i)=>{const q=r.points[(i+1)%r.points.length];return{p,q,length:Math.hypot(q.x-p.x,q.z-p.z)};});return{...r,segments,length:segments.reduce((s,v)=>s+v.length,0)};});
 function poses(time){return tracks.map(r=>{let d=((Math.max(0,time)*BUS_SPEC.speed+r.offset)%r.length+r.length)%r.length;for(let i=0;i<r.segments.length;i++){const s=r.segments[i];if(d<=s.length){const f=d/s.length,prev=r.segments[(i+r.segments.length-1)%r.segments.length],next=r.segments[(i+1)%r.segments.length],sx=(s.q.x-s.p.x)/s.length,sz=(s.q.z-s.p.z)/s.length;let dx=sx+(prev.q.x-prev.p.x)/prev.length*(1-f)+(next.q.x-next.p.x)/next.length*f,dz=sz+(prev.q.z-prev.p.z)/prev.length*(1-f)+(next.q.z-next.p.z)/next.length*f;const length=Math.hypot(dx,dz);dx/=length;dz/=length;return{id:r.id,x:s.p.x+(s.q.x-s.p.x)*f,z:s.p.z+(s.q.z-s.p.z)*f,yaw:Math.atan2(dx,dz),dx,dz};}d-=s.length;}return null;}).filter(Boolean);}
 const cooldown=new Map(),previous=new Map();let last=null,sequence=0;
 function reset(time=null){cooldown.clear();previous.clear();last=time;sequence=0;}
 function impacts(actors,time,{enabled=true}={}){
  if(!Number.isFinite(time)||time<0)return[];
  if(last!==null&&time<last){reset(time);return[];}
  const start=last===null?time:Math.max(last,time-.25),dt=time-start,result=[];
  for(const[id,end]of cooldown)if(end<=time)cooldown.delete(id);
  if(enabled){const count=Math.max(1,Math.ceil(dt/.025));
   for(const actor of actors){if(!actor?.alive||cooldown.has(actor.id))continue;const old=previous.get(actor.id),prev=old?.alive?old:actor;
    for(let i=0;i<=count;i++){const f=i/count,t=start+dt*f,x=prev.x+(actor.x-prev.x)*f,z=prev.z+(actor.z-prev.z)*f,y=(prev.y||0)+((actor.y||0)-(prev.y||0))*f;if(y>=BUS_SPEC.height||y+1.7<=0)continue;
     const bus=poses(t).find(p=>{const dx=x-p.x,dz=z-p.z,side=dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw),along=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw);return Math.abs(side)<=BUS_SPEC.width/2+.34&&Math.abs(along)<=BUS_SPEC.length/2+.34;});
     if(bus){const side=(x-bus.x)*Math.cos(bus.yaw)-(z-bus.z)*Math.sin(bus.yaw),sign=side<0?-1:1;result.push({actorId:actor.id,busId:bus.id,sequence:++sequence,damage:BUS_SPEC.damage,vx:bus.dx*13+Math.cos(bus.yaw)*sign*5,vz:bus.dz*13-Math.sin(bus.yaw)*sign*5,vy:5.6,endsAt:time+BUS_SPEC.launchSeconds});cooldown.set(actor.id,time+BUS_SPEC.cooldown);break;}
    }
   }
  }
  previous.clear();for(const a of actors)previous.set(a.id,{x:a.x,y:a.y||0,z:a.z,alive:a.alive});last=time;return result;
 }
 function dangerous(x,z,time,horizon=.65){for(let t=0;t<=horizon;t+=.13)for(const p of poses(time+t)){const dx=x-p.x,dz=z-p.z;if(Math.abs(dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw))<2.05&&Math.abs(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))<6.4)return true;}return false;}
 function rayClear(a,b,time){for(const p of poses(time)){const local=v=>{const x=v.x-p.x,z=v.z-p.z;return[x*Math.cos(p.yaw)-z*Math.sin(p.yaw),v.y||0,x*Math.sin(p.yaw)+z*Math.cos(p.yaw)];},start=local(a),end=local(b);let low=0,high=1;for(let i=0;i<3;i++){const min=[-1.25,0,-5.3][i],max=[1.25,3.25,5.3][i],delta=end[i]-start[i];if(Math.abs(delta)<1e-9){if(start[i]<min||start[i]>max){low=2;break;}}else{const u=(min-start[i])/delta,v=(max-start[i])/delta;low=Math.max(low,Math.min(u,v));high=Math.min(high,Math.max(u,v));if(low>high)break;}}if(low<=high)return false;}return true;}
 return{poses,impacts,reset,dangerous,rayClear};
}

export function createBusModels(T,parent,clock){
 const materials={white:new T.MeshStandardMaterial({color:'#eeeae0',roughness:.55}),red:new T.MeshStandardMaterial({color:'#b81735',roughness:.45}),glass:new T.MeshStandardMaterial({color:'#142b38',metalness:.25,roughness:.26}),black:new T.MeshStandardMaterial({color:'#171c21'}),metal:new T.MeshStandardMaterial({color:'#8d989d',metalness:.6,roughness:.45}),light:new T.MeshBasicMaterial({color:'#ffebaf'})};
 const geometries=new Set(),models=new Map();
 function part(root,g,m,x,y,z,sx,sy,sz){geometries.add(g);const mesh=new T.Mesh(g,materials[m]);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.solid=true;root.add(mesh);return mesh;}
 const box=new T.BoxGeometry(1,1,1),wheel=new T.CylinderGeometry(1,1,1,14);geometries.add(box);geometries.add(wheel);
 function label(root,text,x,y,z,w,h,rotation=0){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#121d21';ctx.fillRect(0,0,512,96);ctx.fillStyle='#f0d270';ctx.font='bold 47px "Meiryo",sans-serif';ctx.textAlign='center';ctx.fillText(text,256,65);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const mat=new T.MeshBasicMaterial({map:tex});const g=new T.PlaneGeometry(w,h);geometries.add(g);const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.rotation.y=rotation;m.userData.solid=true;root.add(m);materials['label'+models.size+text+rotation]=mat;}
 for(const pose of clock.poses(0)){const root=new T.Group();root.name='京阪バス / '+pose.id;parent.add(root);models.set(pose.id,root);
  part(root,box,'white',0,1.69,0,2.5,2.75,10.6);part(root,box,'red',0,2.98,0,2.52,.21,10.57);part(root,box,'red',0,1.07,0,2.54,.36,10.64);part(root,box,'metal',0,.48,0,2.53,.2,10.62);
  part(root,box,'white',0,3.13,-1.6,1.5,.28,3);part(root,box,'glass',0,2.25,5.32,2.22,1.22,.035);part(root,box,'glass',0,2.25,-5.32,2.2,1.05,.035);
  for(const sign of[-1,1]){part(root,box,'glass',sign*1.265,2.18,-.15,.035,1.15,9.65);for(let z=-4.5;z<5;z+=1.38)part(root,box,'white',sign*1.29,2.2,z,.055,1.2,.065);for(const z of[-3.1,3.3]){const w=part(root,wheel,'black',sign*1.24,.63,z,.56,.25,.56);w.rotation.z=Math.PI/2;const hub=part(root,wheel,'metal',sign*1.39,.63,z,.31,.03,.31);hub.rotation.z=Math.PI/2;}part(root,box,'light',sign*.87,.82,5.35,.44,.23,.04);part(root,box,'red',sign*.92,.88,-5.35,.28,.35,.04);part(root,box,'black',sign*1.4,2.4,4.6,.18,.42,.16);}
  for(const z of[3.9,-.8]){part(root,box,'metal',-1.29,1.6,z,.03,2.2,1.04);part(root,box,'glass',-1.31,1.95,z,.035,1.37,.87);part(root,box,'red',-1.32,1.08,z,.035,.35,.9);}
  label(root,'枚方市駅  京阪バス',0,2.91,5.36,2.22,.32);label(root,'KEIHAN BUS',1.3,1.55,0,3.8,.38,Math.PI/2);label(root,'京阪バス',-1.3,1.55,-2.8,2.2,.35,-Math.PI/2);
  // Repeated body panels share a draw call per material, even while moving.
  const groups=new Map();for(const child of [...root.children]){if(!child.isMesh||child.geometry!==box&&child.geometry!==wheel)continue;child.updateMatrix();const key=child.geometry.uuid+child.material.uuid;if(!groups.has(key))groups.set(key,{g:child.geometry,m:child.material,matrices:[]});groups.get(key).matrices.push(child.matrix.clone());root.remove(child);}
  for(const item of groups.values()){const mesh=new T.InstancedMesh(item.g,item.m,item.matrices.length);item.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.solid=true;root.add(mesh);}
 }
 function update(time){for(const p of clock.poses(time)){const root=models.get(p.id);root.position.set(p.x,0,p.z);root.rotation.y=p.yaw;}}
 return{update,models,dispose(){for(const o of models.values())o.removeFromParent();geometries.forEach(g=>g.dispose());for(const m of Object.values(materials)){m.map?.dispose();m.dispose();}models.clear();}};
}
