import {busPoint} from './bus-service.js';
import {BUS_CABIN_PANELS,BUS_DOOR_FRAME} from './bus-cabin.js';
export function createBoardableBusModels(T,parent,clock){
 const materials={white:new T.MeshStandardMaterial({color:'#eeeae0',roughness:.55}),red:new T.MeshStandardMaterial({color:'#b81735',roughness:.45}),glass:new T.MeshStandardMaterial({color:'#254658',roughness:.3,transparent:true,opacity:.24,depthWrite:false}),black:new T.MeshStandardMaterial({color:'#171c21'}),metal:new T.MeshStandardMaterial({color:'#8d989d',metalness:.6,roughness:.45}),light:new T.MeshBasicMaterial({color:'#ffebaf'}),seat:new T.MeshStandardMaterial({color:'#355b63'}),skin:new T.MeshStandardMaterial({color:'#dca77d'}),uniform:new T.MeshStandardMaterial({color:'#334c77'}),cap:new T.MeshStandardMaterial({color:'#f3eddc'})};
 const geometries=new Set(),models=new Map(),doors=new Map(),drivers=new Map(),dashboards=new Map(),boards=[];
 const box=new T.BoxGeometry(1,1,1),wheel=new T.CylinderGeometry(1,1,1,14),sphere=new T.SphereGeometry(1,12,8);[box,wheel,sphere].forEach(g=>geometries.add(g));
 function part(root,g,m,x,y,z,sx,sy,sz){const mesh=new T.Mesh(g,materials[m]);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.solid=true;if(m==='glass')mesh.userData.busGlass=true;root.add(mesh);return mesh;}
 function panel(root,x,y,z,w,h,rotation=0){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d'),tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const mat=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}),g=new T.PlaneGeometry(w,h);geometries.add(g);const mesh=new T.Mesh(g,mat);mesh.position.set(x,y,z);mesh.rotation.y=rotation;root.add(mesh);materials['label'+Object.keys(materials).length]=mat;return{ctx,tex,mesh,stamp:null};}
 function print(p,top,bottom){p.ctx.fillStyle='#102420';p.ctx.fillRect(0,0,512,128);p.ctx.fillStyle='#e7eadb';p.ctx.font='bold 31px "Meiryo",sans-serif';p.ctx.textAlign='center';p.ctx.fillText(top,256,43);p.ctx.fillStyle='#d7ff94';p.ctx.font='bold 47px "Meiryo",sans-serif';p.ctx.fillText(bottom,256,106);p.tex.needsUpdate=true;}
 function label(root,text,x,y,z,w,h,rotation=0){const p=panel(root,x,y,z,w,h,rotation);print(p,text,'');}
 for(const pose of clock.poses(0)){const root=new T.Group();root.name='しばくでバス / '+pose.id;parent.add(root);models.set(pose.id,root);
  // Hollow cabin; the visible door and driver are independent moving parts.
  for(const p of BUS_CABIN_PANELS)part(root,box,p.m,p.x,p.y,p.z,p.w,p.h,p.d);
  for(const sign of[-1,1])for(const z of[-3.1,3.3]){const w=part(root,wheel,'black',sign*1.24,.63,z,.56,.25,.56);w.rotation.z=Math.PI/2;const hub=part(root,wheel,'metal',sign*1.39,.63,z,.31,.03,.31);hub.rotation.z=Math.PI/2;}
  const leaves=[];for(const z of[3.9,-.8]){const d=new T.Group();d.position.set(-1.29,0,z);root.add(d);
   const frame=new T.InstancedMesh(box,materials.metal,BUS_DOOR_FRAME.length),matrix=new T.Matrix4(),rotation=new T.Quaternion();
   BUS_DOOR_FRAME.forEach((p,i)=>{matrix.compose(new T.Vector3(p.x,p.y,p.z),rotation,new T.Vector3(p.w,p.h,p.d));frame.setMatrixAt(i,matrix);});frame.instanceMatrix.needsUpdate=true;frame.castShadow=frame.receiveShadow=true;frame.userData.solid=true;d.add(frame);
   part(d,box,'glass',-.025,1.95,0,.03,1.35,.87);part(d,box,'red',-.035,1.08,0,.03,.35,.9);leaves.push(d);}doors.set(pose.id,leaves);
  const driver=new T.Group();root.add(driver);drivers.set(pose.id,driver);
  for(const [g,m,x,y,z,sx,sy,sz]of[[box,'uniform',.64,1.38,4.08,.5,.67,.36],[sphere,'skin',.64,1.96,4.1,.22,.25,.22],[box,'cap',.64,2.17,4.15,.48,.09,.5],[box,'uniform',.34,1.38,4.34,.16,.15,.5],[box,'uniform',.96,1.38,4.34,.16,.15,.5]]){const mesh=part(driver,g,m,x,y,z,sx,sy,sz);mesh.userData.busDriver=pose.id;mesh.userData.head=y>1.7;}
  const steering=part(root,wheel,'black',.64,1.43,4.62,.31,.035,.31);steering.rotation.x=.8;
  dashboards.set(pose.id,panel(root,.64,1.96,5.10,.8,.22,Math.PI));
  label(root,'枚方市駅  しばくでバス',0,2.92,5.36,2.22,.32);label(root,'SHIBAKUDE BUS',1.31,1.55,0,3.8,.38,Math.PI/2);label(root,'しばくでバス',-1.31,1.55,-2.8,2.2,.35,-Math.PI/2);
  const batches=new Map();for(const child of [...root.children]){if(!child.isMesh||child.geometry!==box&&child.geometry!==wheel)continue;child.updateMatrix();const key=child.geometry.uuid+child.material.uuid;if(!batches.has(key))batches.set(key,{g:child.geometry,m:child.material,matrices:[]});batches.get(key).matrices.push(child.matrix.clone());root.remove(child);}
  for(const b of batches.values()){const mesh=new T.InstancedMesh(b.g,b.m,b.matrices.length);b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.solid=true;if(b.m===materials.glass)mesh.userData.busGlass=true;root.add(mesh);}}
 for(const stop of clock.stops(0)){const at=busPoint(stop,-3.4,3.8),root=new T.Group();root.position.set(at.x,0,at.z);root.rotation.y=stop.yaw;parent.add(root);root.name='バス到着案内 / '+stop.id;
  part(root,box,'metal',0,1.25,0,.12,2.5,.12);part(root,box,'black',0,2.42,0,2.6,1,.16);const p=panel(root,0,2.42,.09,2.48,.88);boards.push({...p,root,id:stop.id});}
 function update(time){const poses=clock.poses(time),active=new Set(poses.map(p=>p.id));
  // Detach retired bodies: invisible children would still intercept raycasts.
  for(const[id,root]of models)if(!active.has(id))root.removeFromParent();
  for(const p of poses){const root=models.get(p.id);if(root.parent!==parent)parent.add(root);root.position.set(p.x,0,p.z);root.rotation.y=p.yaw;drivers.get(p.id).visible=p.driverHP>0;
   for(const d of doors.get(p.id))d.rotation.y=p.door?-1.45:0;
   const dash=dashboards.get(p.id),stamp=Math.ceil(p.fuel);if(dash.stamp!==stamp){dash.stamp=stamp;print(dash,'FUEL',p.owner?String(stamp).padStart(2,'0'):'—');}}
  for(const stop of clock.stops(time)){const b=boards.find(b=>b.id===stop.id),stamp=stop.door?'停車中':stop.eta===null?'回送':`${Math.ceil(stop.eta)} 秒`;if(b.stamp!==stamp){b.stamp=stamp;print(b,`${stop.id==='south'?'南口':'北口'}  バスのりば`,stamp);}}}
 return{update,models,boards,doors,drivers,dispose(){for(const o of models.values())o.removeFromParent();for(const b of boards)b.root.removeFromParent();geometries.forEach(g=>g.dispose());for(const m of Object.values(materials)){m.map?.dispose();m.dispose();}models.clear();}};
}
