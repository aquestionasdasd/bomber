// Original procedural mallard, using the existing animated/hit rig unchanged.
export function createDuckAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
  const group=new THREE.Group();group.name='Duck avatar / 🦆';rig.add(group);
  const geometries=new Set(),materials=new Map(),frames=[];
  const finish=(name,color,roughness=.72)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness:0});m.name=`Duck finish / ${name}`;materials.set(name,m);return m;};
  finish('green','#377326');finish('deep green','#245b27');finish('bill','#f8d25d',.48);finish('eye','#232b31',.25);finish('white','#f7f5e8');finish('brown','#9a684d');finish('wing','#705642');finish('feather','#b79b79');finish('web','#e8a43b');finish('team',team==='blue'?'#56c9c3':'#d67776');
  function frame(source){const f=new THREE.Group();f.userData.agentHead=source===head;f.matrixAutoUpdate=false;group.add(f);frames.push([f,source]);return f;}
  function ellipsoid(parent,name,p,s,material,segments=20){const g=new THREE.SphereGeometry(1,segments,12);geometries.add(g);const m=new THREE.Mesh(g,materials.get(material));m.name=`Duck / ${name}`;m.position.set(...p);m.scale.set(...s);m.userData.character='duck';m.userData.solid=false;m.raycast=()=>{};m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const body=frame(upper),face=frame(head);
  ellipsoid(body,'rounded chest',[0,1.03,-.015],[.275,.38,.22],'brown');
  ellipsoid(body,'cream belly',[0,.99,.162],[.22,.30,.085],'white');
  ellipsoid(body,'green neck',[0,1.36,.018],[.129,.24,.128],'green');
  ellipsoid(body,'white collar',[0,1.265,.02],[.145,.045,.14],'white');
  ellipsoid(body,'team chest band',[0,1.15,.223],[.18,.025,.016],'team');
  ellipsoid(body,'tail',[0,.85,-.24],[.18,.105,.22],'deep green');
  ellipsoid(face,'mallard green head',[0,.01,.015],[.185,.205,.19],'green',28);
  ellipsoid(face,'broad upper bill',[0,-.075,.23],[.173,.052,.225],'bill',28);
  ellipsoid(face,'lower bill',[0,-.113,.23],[.155,.021,.20],'bill');
  for(const side of[-1,1]){
    ellipsoid(face,'round black eye',[side*.145,.053,.113],[.047,.055,.027],'eye');
    ellipsoid(face,'eye glint',[side*.15,.071,.134],[.010,.012,.006],'white',12);
    ellipsoid(face,'nostril',[side*.053,-.036,.32],[.014,.006,.024],'wing',12);
  }
  for(const [arm,leg,side]of [[rightArm,rightLeg,-1],[leftArm,leftLeg,1]]){
    // Joint-local long axes are the same as the tactical IK rig.
    const wing=frame(arm.upperArm),fore=frame(arm.forearm),hand=frame(arm.palm),thigh=frame(leg.thigh),shin=frame(leg.shin),foot=frame(leg.boot);
    ellipsoid(wing,'folded wing',[0,0,0],[1.25,3,1.45],'wing');
    ellipsoid(fore,'wing fore feathers',[0,0,0],[1.1,3,1.2],'brown');
    for(let i=0;i<3;i++)ellipsoid(hand,'wing finger',[(-.027+i*.027),-.01,.033],[.018,.035,.07],'feather',12);
    ellipsoid(thigh,'feathered leg',[0,0,0],[1.05,3,1.05],'brown');
    ellipsoid(shin,'orange leg',[0,0,0],[.58,3,.58],'web');
    ellipsoid(foot,'wide webbed foot',[0,-.075,.06],[.11,.038,.175],'web');
    for(let i=-1;i<=1;i++)ellipsoid(foot,'web toes',[i*.055,-.071,.175],[.037,.026,.072],'web',12);
  }
  let disposed=false;
  function update(){if(disposed)return;for(const[f,s]of frames){s.updateMatrix();if(s===head){upper.updateMatrix();f.matrix.multiplyMatrices(upper.matrix,s.matrix);}else f.matrix.copy(s.matrix);f.matrixWorldNeedsUpdate=true;}}
  update();return{group,update,setVisible(value){group.visible=!!value;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();}};
}
