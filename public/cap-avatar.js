// Reference-inspired original mesh: swept red hair, round frames and navy hoodie.
export function createCapAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
 const group=new THREE.Group();group.name='キャップは？ / red hair and navy hoodie';rig.add(group);const gs=new Set(),ms=new Map(),frames=[];
 for(const[n,color,roughness]of[['navy','#101d3c',.95],['hood','#1c2d53',.95],['skin','#f1b27a',.9],['hair','#c53c11',.7],['highlight','#ed6a1e',.65],['frame','#8d491f',.4],['black','#252021',.8],['white','#fff0d8',.8],['pants','#252b40',.95],['team',team==='blue'?'#43b6ba':'#c86169',.7]])ms.set(n,new THREE.MeshStandardMaterial({color,roughness}));
 function frame(s){const f=new THREE.Group();f.matrixAutoUpdate=false;group.add(f);frames.push([f,s]);return f;}
 function part(p,n,g,x,s,m){gs.add(g);const o=new THREE.Mesh(g,ms.get(m));o.name='Cap / '+n;o.position.set(...x);o.scale.set(...s);o.castShadow=true;o.receiveShadow=true;o.raycast=()=>{};o.userData.character='cap';p.add(o);return o;}
 const ball=(p,n,x,s,m)=>part(p,n,new THREE.SphereGeometry(1,24,16),x,s,m),box=(p,n,x,s,m)=>part(p,n,new THREE.BoxGeometry(1,1,1),x,s,m);
 function line(p,n,a,b,rad=.008,m='frame'){const v=new THREE.Vector3(...a),w=new THREE.Vector3(...b),o=part(p,n,new THREE.CylinderGeometry(rad,rad,v.distanceTo(w),8),v.clone().add(w).multiplyScalar(.5).toArray(),[1,1,1],m);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),w.sub(v).normalize());return o;}
 const body=frame(upper),face=frame(head);
 ball(body,'navy hoodie',[0,1.08,0],[.25,.30,.19],'navy');ball(body,'folded hood',[0,1.35,-.06],[.26,.11,.17],'hood');
 box(body,'kangaroo pocket',[0,.98,.185],[.29,.1,.025],'hood');box(body,'ribbed hem',[0,.83,.01],[.36,.06,.28],'hood');box(body,'team cuff',[.13,1.05,.207],[.04,.08,.012],'team');
 for(const side of[-1,1])line(body,'hood string',[side*.065,1.31,.18],[side*.07,1.16,.2],.006,'white');
 ball(face,'smiling face',[0,0,.016],[.218,.265,.19],'skin');ball(face,'back hair',[0,.105,-.04],[.229,.20,.18],'hair');
 for(let i=0;i<7;i++){const lock=ball(face,'swept red hair',[-.145+i*.047,.214+Math.sin(i*.45)*.036,.055],[.088,.06,.142],i%3?'hair':'highlight');lock.rotation.z=-.28;}
 for(const side of[-1,1]){ball(face,'ear',[side*.218,-.006,0],[.039,.061,.03],'skin');ball(face,'eye',[side*.085,.024,.193],[.015,.019,.009],'black');
  part(face,'round glasses',new THREE.TorusGeometry(.083,.007,8,32),[side*.095,.025,.203],[1,.91,1],'frame');line(face,'temple',[side*.18,.04,.19],[side*.222,.055,.0]);line(face,'brow',[side*.045,.105,.18],[side*.146,.11,.163],.009,'hair');}
 line(face,'glasses bridge',[-.018,.028,.209],[.018,.028,.209],.008);ball(face,'nose',[0,-.023,.209],[.033,.042,.031],'skin');
 ball(face,'open smile',[0,-.118,.177],[.096,.065,.017],'black');box(face,'smile teeth',[0,-.088,.194],[.145,.025,.01],'white');ball(face,'smile lip',[0,-.159,.164],[.063,.012,.012],'skin');
 for(const[arm,leg]of[[rightArm,rightLeg],[leftArm,leftLeg]]){ball(frame(arm.upperArm),'hoodie sleeve',[0,0,0],[1.16,3,1.16],'navy');ball(frame(arm.forearm),'hoodie forearm',[0,0,0],[1.14,3,1.14],'navy');ball(frame(arm.palm),'hand',[0,0,0],[.066,.045,.078],'skin');ball(frame(leg.thigh),'trouser upper',[0,0,0],[1.08,3,1.08],'pants');ball(frame(leg.shin),'trouser lower',[0,0,0],[1.06,3,1.06],'pants');ball(frame(leg.boot),'sneaker',[0,-.05,.05],[.1,.065,.17],'white');}
 let disposed=false;function update(){if(disposed)return;for(const[f,s]of frames){s.updateMatrix();if(s===head){upper.updateMatrix();f.matrix.multiplyMatrices(upper.matrix,s.matrix);}else f.matrix.copy(s.matrix);f.matrixWorldNeedsUpdate=true;}}update();return{group,update,setVisible(v){group.visible=!!v;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}};
}
