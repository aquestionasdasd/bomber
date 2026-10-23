// The supplied reference is a flat mint swatch; silhouette and facial features are original.
export function createUrchinAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
 const group=new THREE.Group();group.name='青ウニ / mint radial spines';rig.add(group);
 const geometry=new Set(),materials=new Map(),frames=[];
 for(const[n,c]of[['mint','#a9f1e4'],['spine','#70cabe'],['tip','#e0fff6'],['dark','#194b52'],['white','#f2fffa'],['team',team==='blue'?'#229fb2':'#c95969']])materials.set(n,new THREE.MeshStandardMaterial({color:c,roughness:.7}));
 function frame(s){const f=new THREE.Group();f.matrixAutoUpdate=false;group.add(f);frames.push([f,s]);return f;}
 function part(p,name,g,x,scale,m){geometry.add(g);const mesh=new THREE.Mesh(g,materials.get(m));mesh.name='青ウニ / '+name;mesh.position.set(...x);mesh.scale.set(...scale);mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};p.add(mesh);return mesh;}
 const ball=(p,n,x,s,m)=>part(p,n,new THREE.SphereGeometry(1,18,12),x,s,m);
 const face=frame(head),body=frame(upper);
 ball(face,'mint round head',[0,0,0],[.25,.25,.23],'mint');
 // Fibonacci sampling distributes the short spines without an expensive dense mesh.
 for(let i=0;i<38;i++){const y=1-2*(i+.5)/38,a=i*2.3999632297,r=Math.sqrt(1-y*y),v=new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);if(v.z>.6&&Math.abs(v.y)<.55)continue;
  const o=part(face,'radial spine',new THREE.ConeGeometry(.035,.18,5),v.clone().multiplyScalar(.29).toArray(),[1,1,1],i%3?'spine':'tip');o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v);}
 for(const sign of[-1,1]){ball(face,'black eye',[sign*.078,.025,.215],[.035,.043,.017],'dark');ball(face,'eye shine',[sign*.079-.008,.04,.231],[.009,.012,.004],'white');}
 const mouth=part(face,'small smile',new THREE.TorusGeometry(.045,.008,5,14,Math.PI),[0,-.07,.219],[1,.6,1],'dark');mouth.rotation.z=Math.PI;
 ball(body,'armoured mint shell',[0,1.08,0],[.25,.3,.18],'spine');ball(body,'pearl belly',[0,1.05,.145],[.17,.21,.06],'mint');
 part(body,'team pearl',new THREE.OctahedronGeometry(.035),[0,1.28,.18],[1,1,1],'team');
 for(const[arm,leg]of[[rightArm,rightLeg],[leftArm,leftLeg]]){ball(frame(arm.upperArm),'mint upper arm',[0,0,0],[1.08,3,1.08],'mint');ball(frame(arm.forearm),'spine sleeve',[0,0,0],[1.1,3,1.1],'spine');ball(frame(arm.palm),'mitten',[0,0,0],[.07,.045,.075],'mint');ball(frame(leg.thigh),'short leg',[0,0,0],[1,3,1],'dark');ball(frame(leg.shin),'mint shin',[0,0,0],[1.05,3,1.05],'mint');ball(frame(leg.boot),'round foot',[0,-.05,.045],[.1,.065,.15],'spine');}
 let disposed=false;function update(){if(disposed)return;for(const[f,s]of frames){s.updateMatrix();if(s===head){upper.updateMatrix();f.matrix.multiplyMatrices(upper.matrix,s.matrix);}else f.matrix.copy(s.matrix);f.matrixWorldNeedsUpdate=true;}}update();return{group,update,setVisible(v){group.visible=!!v;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
