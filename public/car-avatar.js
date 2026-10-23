// Original procedural miniature-car combat rig inspired by the supplied photo.
export function createCarAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
 const group=new THREE.Group();group.name='トミカ / white sports car';rig.add(group);
 const gs=new Set(),ms=new Map(),frames=[],wheels=[];
 for(const[n,color,roughness,metalness]of [['paint','#f2f1e8',.27,.3],['roof','#171d21',.24,.35],['glass','#243d46',.17,.5],['rubber','#202325',.95,0],['rim','#c6ced1',.3,.85],['lamp','#f2f1c9',.18,.2],['tail','#ba363e',.3,.25],['team',team==='blue'?'#3ca6b9':'#d16d71',.4,.4]])ms.set(n,new THREE.MeshStandardMaterial({color,roughness,metalness}));
 function frame(source){const f=new THREE.Group();f.matrixAutoUpdate=false;group.add(f);frames.push([f,source]);return f;}
 function add(parent,name,geometry,p,s,finish){gs.add(geometry);const m=new THREE.Mesh(geometry,ms.get(finish));m.name='Car / '+name;m.position.set(...p);m.scale.set(...s);m.castShadow=true;m.receiveShadow=true;m.raycast=()=>{};m.userData.solid=false;m.userData.character='car';parent.add(m);return m;}
 const box=(p,n,pos,s,mat)=>add(p,n,new THREE.BoxGeometry(1,1,1),pos,s,mat);
 function wheel(parent,name,p,r=.14){const a=new THREE.Group();a.position.set(...p);parent.add(a);add(a,name+' tyre',new THREE.CylinderGeometry(r,r,.085,24),[0,0,0],[1,1,1],'rubber').rotation.z=Math.PI/2;const rim=add(a,name+' silver rim',new THREE.CylinderGeometry(r*.72,r*.72,.092,20),[0,0,0],[1,1,1],'rim');rim.rotation.z=Math.PI/2;const hub=add(a,name+' black hub',new THREE.CylinderGeometry(r*.5,r*.5,.096,16),[0,0,0],[1,1,1],'roof');hub.rotation.z=Math.PI/2;wheels.push(a);}
 const body=frame(upper),face=frame(head);
 box(body,'white chassis',[0,1.08,.05],[.66,.22,.96],'paint');
 const hood=box(body,'low sloping hood',[0,1.21,.34],[.61,.08,.43],'paint');hood.rotation.x=-.1;
 box(body,'front bumper',[0,1.01,.555],[.68,.12,.085],'paint');box(body,'front black grille',[0,1.015,.602],[.45,.046,.012],'roof');
 for(const side of[-1,1]){box(body,'recessed headlight',[side*.222,1.24,.472],[.139,.032,.12],'roof').rotation.x=-.12;box(body,'warm lamp',[side*.222,1.258,.492],[.102,.016,.067],'lamp');box(body,'side skirt',[side*.338,1.005,.015],[.025,.065,.81],'paint');box(body,'door seam',[side*.338,1.12,-.08],[.006,.11,.34],'roof');box(body,'side intake',[side*.344,1.15,-.22],[.011,.105,.067],'roof');box(body,'wing support',[side*.24,1.29,-.43],[.026,.27,.028],'roof');wheel(body,'front wheel',[side*.346,1.025,.30]);}
 box(body,'rear wing',[0,1.437,-.44],[.78,.043,.135],'paint');box(body,'rear wing black insert',[0,1.464,-.44],[.66,.012,.09],'roof');box(body,'rear tail strip',[0,1.13,-.444],[.55,.033,.012],'tail');
 box(body,'cockpit neck',[0,1.37,0],[.18,.29,.18],'rim');
 box(body,'rear linkage pelvis',[0,.88,0],[.35,.22,.24],'roof');
 box(body,'team sill',[0,1.004,.608],[.17,.018,.007],'team');
 box(face,'cockpit windshield',[0,-.035,.025],[.36,.26,.30],'glass').rotation.x=-.18;
 box(face,'black roof',[0,.121,-.015],[.41,.035,.29],'roof');
 for(const side of[-1,1]){box(face,'white A pillar',[side*.197,-.035,.09],[.021,.28,.025],'paint').rotation.x=-.18;box(face,'wing mirror',[side*.238,-.056,.038],[.067,.045,.07],'paint');box(face,'side mirror glass',[side*.24,-.055,.077],[.045,.024,.005],'rim');}
 for(const[arm,leg,side]of[[rightArm,rightLeg,-1],[leftArm,leftLeg,1]]){
  box(frame(arm.upperArm),'suspension arm',[0,0,0],[1.1,6,1.1],'paint');box(frame(arm.forearm),'mechanical forearm',[0,0,0],[1,6,1],'rim');box(frame(arm.palm),'steering glove',[0,0,0],[.11,.065,.14],'roof');
  box(frame(leg.thigh),'white rear linkage',[0,0,0],[1.1,6,1.1],'paint');box(frame(leg.shin),'silver rear suspension',[0,0,0],[.75,6,.75],'rim');const foot=frame(leg.boot);wheel(foot,'rear wheel',[side*.035,-.005,.04],.13);box(foot,'rear wheel fender',[0,.058,.035],[.18,.06,.27],'paint');
 }
 let disposed=false;function update(dt=0,state={}){if(disposed)return;for(const[f,s]of frames){s.updateMatrix();if(s===head){upper.updateMatrix();f.matrix.multiplyMatrices(upper.matrix,s.matrix);}else f.matrix.copy(s.matrix);f.matrixWorldNeedsUpdate=true;}if(state.moving)for(const w of wheels)w.rotation.x-=Math.min(.1,Math.max(0,dt))*8;}
 update();return{group,update,setVisible(v){group.visible=!!v;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of gs)g.dispose();for(const m of ms.values())m.dispose();}};
}
