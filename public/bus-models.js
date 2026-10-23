import {busPoint} from './bus-service.js';
export function createBoardableBusModels(T,parent,clock){
 const materials={white:new T.MeshStandardMaterial({color:'#eeeae0',roughness:.55}),red:new T.MeshStandardMaterial({color:'#b81735',roughness:.45}),glass:new T.MeshStandardMaterial({color:'#254658',roughness:.3,transparent:true,opacity:.24,depthWrite:false}),black:new T.MeshStandardMaterial({color:'#171c21'}),metal:new T.MeshStandardMaterial({color:'#8d989d',metalness:.6,roughness:.45}),light:new T.MeshBasicMaterial({color:'#ffebaf'}),seat:new T.MeshStandardMaterial({color:'#355b63'}),skin:new T.MeshStandardMaterial({color:'#dca77d'}),uniform:new T.MeshStandardMaterial({color:'#334c77'}),cap:new T.MeshStandardMaterial({color:'#f3eddc'})};
 const geometries=new Set(),models=new Map(),doors=new Map(),drivers=new Map(),dashboards=new Map(),boards=[];
 const box=new T.BoxGeometry(1,1,1),wheel=new T.CylinderGeometry(1,1,1,14),sphere=new T.SphereGeometry(1,12,8);[box,wheel,sphere].forEach(g=>geometries.add(g));
 function part(root,g,m,x,y,z,sx,sy,sz){const mesh=new T.Mesh(g,materials[m]);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.solid=true;root.add(mesh);return mesh;}
 function panel(root,x,y,z,w,h,rotation=0){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d'),tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const mat=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}),g=new T.PlaneGeometry(w,h);geometries.add(g);const mesh=new T.Mesh(g,mat);mesh.position.set(x,y,z);mesh.rotation.y=rotation;root.add(mesh);materials['label'+Object.keys(materials).length]=mat;return{ctx,tex,mesh,stamp:null};}
 function print(p,top,bottom){p.ctx.fillStyle='#102420';p.ctx.fillRect(0,0,512,128);p.ctx.fillStyle='#e7eadb';p.ctx.font='bold 31px "Meiryo",sans-serif';p.ctx.textAlign='center';p.ctx.fillText(top,256,43);p.ctx.fillStyle='#d7ff94';p.ctx.font='bold 47px "Meiryo",sans-serif';p.ctx.fillText(bottom,256,106);p.tex.needsUpdate=true;}
 function label(root,text,x,y,z,w,h,rotation=0){const p=panel(root,x,y,z,w,h,rotation);print(p,text,'');}
 for(const pose of clock.poses(0)){const root=new T.Group();root.name='京阪バス / '+pose.id;parent.add(root);models.set(pose.id,root);
  // Hollow cabin; the visible door and driver are independent moving parts.
  part(root,box,'metal',0,.39,0,2.5,.18,10.6);part(root,box,'white',0,3.08,0,2.5,.24,10.6);
  part(root,box,'white',0,3.29,-1.6,1.5,.25,3);part(root,box,'glass',0,2.25,5.32,2.22,1.22,.035);part(root,box,'glass',0,2.25,-5.32,2.2,1.05,.035);
  part(root,box,'white',0,1.02,5.26,2.5,1.15,.1);part(root,box,'white',0,1.02,-5.26,2.5,1.15,.1);
  for(const sign of[-1,1]){for(let z=-4.95;z<5.2;z+=.46){if(sign===-1&&[3.9,-.8].some(d=>Math.abs(d-z)<.68))continue;
    part(root,box,'white',sign*1.25,1,z,.09,1.15,.46);part(root,box,'red',sign*1.3,1.08,z,.06,.34,.46);part(root,box,'glass',sign*1.265,2.18,z,.035,1.15,.46);}
   for(let z=-4.9;z<5.1;z+=1.38){if(sign===-1&&[3.9,-.8].some(d=>Math.abs(d-z)<.5))continue;part(root,box,'white',sign*1.29,2.2,z,.06,1.5,.065);}
   part(root,box,'red',sign*1.27,2.98,0,.08,.19,10.57);
   for(const z of[-3.1,3.3]){const w=part(root,wheel,'black',sign*1.24,.63,z,.56,.25,.56);w.rotation.z=Math.PI/2;const hub=part(root,wheel,'metal',sign*1.39,.63,z,.31,.03,.31);hub.rotation.z=Math.PI/2;}
   part(root,box,'light',sign*.87,.82,5.35,.44,.23,.04);part(root,box,'red',sign*.92,.88,-5.35,.28,.35,.04);part(root,box,'black',sign*1.4,2.4,4.6,.18,.42,.16);
   for(const z of[-3.8,-2.1,.1]){part(root,box,'seat',sign*.75,.88,z,.62,.18,.62);part(root,box,'seat',sign*.75,1.25,z-.32,.62,.72,.13);}}
  const leaves=[];for(const z of[3.9,-.8]){const d=new T.Group();d.position.set(-1.29,0,z);root.add(d);part(d,box,'metal',0,1.56,0,.04,2.22,1.05);part(d,box,'glass',-.025,1.95,0,.03,1.35,.87);part(d,box,'red',-.035,1.08,0,.03,.35,.9);leaves.push(d);}doors.set(pose.id,leaves);
  part(root,box,'black',.64,.9,4.07,.72,.19,.8);part(root,box,'black',.64,1.26,3.7,.72,.77,.18);part(root,box,'black',0,1.25,4.95,2.25,.28,.45);
  const driver=new T.Group();root.add(driver);drivers.set(pose.id,driver);
  for(const [g,m,x,y,z,sx,sy,sz]of[[box,'uniform',.64,1.38,4.08,.5,.67,.36],[sphere,'skin',.64,1.96,4.1,.22,.25,.22],[box,'cap',.64,2.17,4.15,.48,.09,.5],[box,'uniform',.34,1.38,4.34,.16,.15,.5],[box,'uniform',.96,1.38,4.34,.16,.15,.5]]){const mesh=part(driver,g,m,x,y,z,sx,sy,sz);mesh.userData.busDriver=pose.id;mesh.userData.head=y>1.7;}
  const steering=part(root,wheel,'black',.64,1.43,4.62,.31,.035,.31);steering.rotation.x=.8;
  dashboards.set(pose.id,panel(root,.64,1.96,5.10,.8,.22,Math.PI));
  label(root,'枚方市駅  京阪バス',0,2.92,5.36,2.22,.32);label(root,'KEIHAN BUS',1.31,1.55,0,3.8,.38,Math.PI/2);label(root,'京阪バス',-1.31,1.55,-2.8,2.2,.35,-Math.PI/2);
  const batches=new Map();for(const child of [...root.children]){if(!child.isMesh||child.geometry!==box&&child.geometry!==wheel)continue;child.updateMatrix();const key=child.geometry.uuid+child.material.uuid;if(!batches.has(key))batches.set(key,{g:child.geometry,m:child.material,matrices:[]});batches.get(key).matrices.push(child.matrix.clone());root.remove(child);}
  for(const b of batches.values()){const mesh=new T.InstancedMesh(b.g,b.m,b.matrices.length);b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.solid=true;root.add(mesh);}}
 for(const stop of clock.stops(0)){const at=busPoint(stop,-3.4,3.8),root=new T.Group();root.position.set(at.x,0,at.z);root.rotation.y=stop.yaw;parent.add(root);root.name='バス到着案内 / '+stop.id;
  part(root,box,'metal',0,1.25,0,.12,2.5,.12);part(root,box,'black',0,2.42,0,2.6,1,.16);const p=panel(root,0,2.42,.09,2.48,.88);boards.push({...p,root,id:stop.id});}
 function update(time){for(const p of clock.poses(time)){const root=models.get(p.id);root.position.set(p.x,0,p.z);root.rotation.y=p.yaw;drivers.get(p.id).visible=p.driverHP>0;
   for(const d of doors.get(p.id))d.rotation.y=p.door?-1.45:0;
   const dash=dashboards.get(p.id),stamp=Math.ceil(p.fuel);if(dash.stamp!==stamp){dash.stamp=stamp;print(dash,'FUEL',p.owner?String(stamp).padStart(2,'0'):'—');}}
  for(const stop of clock.stops(time)){const b=boards.find(b=>b.id===stop.id),stamp=stop.door?'停車中':stop.eta===null?'回送':`${Math.ceil(stop.eta)} 秒`;if(b.stamp!==stamp){b.stamp=stamp;print(b,`${stop.id==='south'?'南口':'北口'}  バスのりば`,stamp);}}}
 return{update,models,boards,doors,drivers,dispose(){for(const o of models.values())o.removeFromParent();for(const b of boards)b.root.removeFromParent();geometries.forEach(g=>g.dispose());for(const m of Object.values(materials)){m.map?.dispose();m.dispose();}models.clear();}};
}
