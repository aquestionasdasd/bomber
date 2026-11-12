// Supplied のび reference, rebuilt on the shared combat rig without image assets.
export function createNobiAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
 const group=new THREE.Group();group.name='のび / yellow pocket shirt';rig.add(group);const gs=new Set(),ms=new Map(),frames=[];
 for(const[n,color,roughness]of [['white','#eeeedd',.85],['yellow','#e8be35',.84],['blue','#263d66',.9],['skin','#dc9b67',.93],['black','#263532',.9],['red','#b32c21',.35],['cyan','#6daba4',.77],['green','#438466',.85],['gold','#d7a532',.45],['team',team==='blue'?'#3cbbc0':'#cf6e6b',.6]])ms.set(n,new THREE.MeshStandardMaterial({color,roughness}));
 function frame(s){const f=new THREE.Group();f.userData.agentHead=s===head;f.matrixAutoUpdate=false;group.add(f);frames.push([f,s]);return f;}
 function part(parent,name,geometry,p,s,mat){gs.add(geometry);const o=new THREE.Mesh(geometry,ms.get(mat));o.name='Nobi / '+name;o.position.set(...p);o.scale.set(...s);o.castShadow=true;o.receiveShadow=true;o.raycast=()=>{};o.userData.character='nobi';parent.add(o);return o;}
 const ball=(p,n,x,s,m)=>part(p,n,new THREE.SphereGeometry(1,24,16),x,s,m),box=(p,n,x,s,m)=>part(p,n,new THREE.BoxGeometry(1,1,1),x,s,m);
 function line(p,n,a,b,r=.007,mat='black'){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),o=part(p,n,new THREE.CylinderGeometry(r,r,av.distanceTo(bv),6),av.clone().add(bv).multiplyScalar(.5).toArray(),[1,1,1],mat);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());}
 const body=frame(upper),face=frame(head);
 ball(body,'yellow shirt',[0,1.11,.01],[.246,.29,.18],'yellow');ball(body,'navy shorts',[0,.81,0],[.22,.16,.16],'blue');
 for(const side of[-1,1]){const collar=box(body,'white pointed collar',[side*.08,1.35,.145],[.14,.12,.025],'white');collar.rotation.z=side*.46;}
 box(body,'pocket',[.095,1.12,.186],[.1,.085,.012],'yellow');line(body,'pocket seam',[.045,1.15,.196],[.145,1.15,.196],.004);ball(body,'belt bell',[0,1.36,.17],[.026,.027,.018],'gold');box(body,'team hem',[0,.963,.172],[.13,.017,.014],'team');
 ball(face,'round white face',[0,.01,.015],[.298,.30,.205],'white');ball(face,'red nose',[0,.047,.215],[.033,.034,.027],'red');ball(face,'nose glint',[-.009,.057,.239],[.009,.01,.006],'white');
 line(face,'vertical mouth',[0,.012,.223],[0,-.105,.206],.006);
 for(const side of[-1,1])for(let i=-1;i<=1;i++)line(face,'whisker',[side*.095,-.015+i*.052,.212],[side*.252,-.015+i*.09,.162],.006);
 for(const[arm,leg]of[[rightArm,rightLeg],[leftArm,leftLeg]]){
  ball(frame(arm.upperArm),'yellow short sleeve',[0,-1.25,0],[1.1,1.75,1.1],'yellow');ball(frame(arm.upperArm),'bare upper arm',[0,.9,0],[.85,2.15,.85],'skin');ball(frame(arm.forearm),'bare forearm',[0,0,0],[.95,3,.95],'skin');ball(frame(arm.palm),'hand',[0,0,.008],[.065,.045,.08],'skin');
  ball(frame(leg.thigh),'shorts leg',[0,-1.25,0],[1.1,1.75,1.1],'blue');ball(frame(leg.thigh),'bare thigh',[0,.9,0],[.83,2.15,.83],'skin');ball(frame(leg.shin),'long white sock',[0,.4,0],[1.02,3,1.02],'white');ball(frame(leg.shin),'green sock band',[0,-1.45,0],[1.03,.45,1.03],'green');ball(frame(leg.boot),'cyan shoe',[0,-.05,.05],[.10,.06,.17],'cyan');
 }
 let disposed=false;function update(){if(disposed)return;for(const[f,s]of frames){s.updateMatrix();if(s===head){upper.updateMatrix();f.matrix.multiplyMatrices(upper.matrix,s.matrix);}else f.matrix.copy(s.matrix);f.matrixWorldNeedsUpdate=true;}}update();return{group,update,setVisible(v){group.visible=!!v;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}};
}
