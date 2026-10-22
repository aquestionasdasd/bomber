// Code-native interpretation of the user's gold-haired, star-crowned knight.
export function createOnnaraAvatar(T,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
 const group=new T.Group();group.name='おんなら / golden star knight';rig.add(group);
 const geometries=new Set(),materials=new Map(),frames=[];
 for(const[n,c]of[['skin','#ffdbba'],['hair','#f8ba26'],['gold','#ffe073'],['red','#a62125'],['dark','#462d32'],['white','#fff7eb'],['blue','#3869bf'],['team',team==='blue'?'#169cb7':'#d64c5c']])materials.set(n,new T.MeshStandardMaterial({color:c,metalness:['red','gold'].includes(n)?.6:.05,roughness:.42}));
 function frame(source){const f=new T.Group();f.matrixAutoUpdate=false;group.add(f);frames.push([f,source]);return f;}
 function part(parent,name,g,p,s,m){geometries.add(g);const o=new T.Mesh(g,materials.get(m));o.name='おんなら / '+name;o.position.set(...p);o.scale.set(...s);o.raycast=()=>{};o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 const ball=(p,n,x,s,m)=>part(p,n,new T.SphereGeometry(1,16,12),x,s,m);
 const box=(p,n,x,s,m)=>part(p,n,new T.BoxGeometry(1,1,1),x,s,m);
 function star(p,n,x,size){const shape=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?size*.43:size;const q=[Math.cos(a)*r,Math.sin(a)*r];if(i)shape.lineTo(...q);else shape.moveTo(...q);}shape.closePath();return part(p,n,new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false}),x,[1,1,1],'gold');}
 const face=frame(head),body=frame(upper);
 ball(face,'golden hair back',[0,.01,-.065],[.25,.29,.23],'hair');
 ball(face,'face',[0,-.025,.055],[.202,.224,.178],'skin');
 for(const sign of[-1,1]){
  ball(face,'flowing gold lock',[sign*.23,-.25,-.09],[.09,.43,.1],'hair');
  const lock=ball(face,'front golden bang',[sign*.095,.16,.17],[.09,.15,.055],'hair');lock.rotation.z=sign*-.36;
  ball(face,'eye white',[sign*.082,.006,.217],[.047,.057,.015],'white');
  ball(face,'blue iris',[sign*.081,.002,.232],[.026,.038,.009],'blue');
  ball(face,'eye sparkle',[sign*.081-.009,.018,.241],[.009,.014,.003],'white');
  const brow=box(face,'brow',[sign*.08,.078,.221],[.075,.012,.009],'dark');brow.rotation.z=sign*-.1;
 }
 ball(face,'smile',[0,-.102,.223],[.035,.02,.006],'red');
 part(face,'crown circlet',new T.TorusGeometry(.22,.025,6,20),[0,.225,0],[1,1,1],'gold').rotation.x=Math.PI/2;
 star(face,'five-point star crown',[0,.29,.19],.13);
 for(const sign of[-1,1])part(face,'crown prong',new T.ConeGeometry(.045,.13,4),[sign*.16,.3,.05],[1,1,1],'gold').rotation.z=sign*-.4;
 ball(body,'red breastplate',[0,1.13,.01],[.24,.25,.18],'red');
 star(body,'gold chest star',[0,1.25,.18],.1);
 box(body,'gold waist',[0,.95,0],[.37,.055,.29],'gold');
 part(body,'red armored skirt',new T.CylinderGeometry(.17,.27,.29,8),[0,.8,0],[1,1,.72],'red');
 for(const sign of[-1,1]){const trim=box(body,'skirt gold trim',[sign*.18,.8,.09],[.035,.25,.05],'gold');trim.rotation.z=sign*.2;}
 ball(body,'team jewel',[0,1.05,.19],[.035,.04,.015],'team');
 for(const[arm,leg]of[[rightArm,rightLeg],[leftArm,leftLeg]]){
  ball(frame(arm.upperArm),'gold pauldrons',[0,0,0],[1.25,3.3,1.25],'gold');
  ball(frame(arm.forearm),'red gauntlet',[0,0,0],[1.12,3.15,1.12],'red');
  ball(frame(arm.palm),'gold glove',[0,0,0],[.07,.047,.08],'gold');
  ball(frame(leg.thigh),'dark leg',[0,0,0],[.91,3,.91],'dark');
  ball(frame(leg.shin),'red greave',[0,0,0],[1.02,3.1,1.02],'red');
  ball(frame(leg.boot),'gold boot',[0,-.05,.05],[.095,.065,.15],'gold');
 }
 let disposed=false;function update(){if(disposed)return;for(const[f,s]of frames){s.updateMatrix();f.matrix.copy(s.matrix);f.matrixWorldNeedsUpdate=true;}}update();
 return{group,update,setVisible(v){group.visible=!!v;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
