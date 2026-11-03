// Reference-inspired white plush craftsman; independent model on the shared rig.
export function createCatAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
 const group=new THREE.Group();group.name='猫の画像 / white plush';rig.add(group);
 const geometries=new Set(),materials=new Map(),frames=[];
 for(const[name,color,roughness]of [['white','#f4f0e8',.94],['shade','#d9d4d4',.92],['skin','#efdfd5',.9],['eye','#3977cf',.35],['black','#292426',.85],['gold','#d3b455',.5],['team',team==='blue'?'#55bfc7':'#dc7478',.7]])materials.set(name,new THREE.MeshStandardMaterial({color,roughness}));
 function frame(source){const f=new THREE.Group();f.userData.agentHead=source===head;f.matrixAutoUpdate=false;group.add(f);frames.push([f,source]);return f;}
 function ellipsoid(parent,name,p,s,finish,segments=20){const geometry=new THREE.SphereGeometry(1,segments,12);geometries.add(geometry);const mesh=new THREE.Mesh(geometry,materials.get(finish));mesh.name='Cat / '+name;mesh.position.set(...p);mesh.scale.set(...s);mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};mesh.userData.solid=false;mesh.userData.character='cat';parent.add(mesh);return mesh;}
 const body=frame(upper),face=frame(head);
 ellipsoid(body,'plush overalls',[0,1.02,-.01],[.275,.36,.21],'white');
 ellipsoid(body,'bib',[0,1.17,.16],[.18,.19,.055],'shade');
 for(const side of[-1,1]){ellipsoid(body,'gold button',[side*.13,1.25,.213],[.036,.036,.018],'gold',12);ellipsoid(body,'overall strap',[side*.15,1.34,.125],[.041,.15,.032],'white');}
 ellipsoid(body,'team seam',[0,1.02,.208],[.14,.018,.014],'team');
 ellipsoid(face,'round head',[0,.005,0],[.188,.19,.17],'skin',28);
 ellipsoid(face,'cap crown',[0,.155,-.01],[.205,.14,.187],'white',28);
 ellipsoid(face,'broad cap brim',[0,.09,.165],[.214,.037,.13],'shade',28);
 for(const side of[-1,1]){
  ellipsoid(face,'ear',[side*.185,-.01,.005],[.068,.085,.06],'skin');
  ellipsoid(face,'eye white',[side*.065,.005,.148],[.052,.074,.027],'white');
  ellipsoid(face,'blue iris',[side*.061,.008,.174],[.028,.047,.013],'eye');
  ellipsoid(face,'pupil',[side*.059,.008,.184],[.012,.032,.008],'black',12);
  ellipsoid(face,'eye shine',[side*.056,.025,.19],[.008,.012,.006],'white',12);
  for(let i=0;i<3;i++)ellipsoid(face,'black curled moustache',[side*(.034+i*.033),-.095+i*.009,.163],[.049,.027,.026],'black',14).rotation.z=side*(.16+i*.22);
 }
 ellipsoid(face,'round plush nose',[0,-.052,.192],[.078,.065,.072],'skin');
 // A simple original stitched chevron on the cap, not a printed logo texture.
 for(const side of[-1,1])ellipsoid(face,'cap stitch',[side*.024,.207,.167],[.013,.044,.007],'black',12).rotation.z=side*.65;
 for(const[arm,leg]of[[rightArm,rightLeg],[leftArm,leftLeg]]){
  ellipsoid(frame(arm.upperArm),'white sleeve',[0,0,0],[1.25,3,1.25],'white');
  ellipsoid(frame(arm.forearm),'soft cuff',[0,0,0],[1.15,3,1.15],'shade');
  ellipsoid(frame(arm.palm),'white glove',[0,0,.015],[.075,.05,.095],'white');
  ellipsoid(frame(leg.thigh),'overall leg',[0,0,0],[1.15,3,1.15],'white');
  ellipsoid(frame(leg.shin),'trouser cuff',[0,0,0],[1.02,3,1.02],'shade');
  ellipsoid(frame(leg.boot),'plush shoe',[0,-.055,.04],[.095,.066,.16],'white');
 }
 let disposed=false;function update(){if(disposed)return;for(const[f,s]of frames){s.updateMatrix();if(s===head){upper.updateMatrix();f.matrix.multiplyMatrices(upper.matrix,s.matrix);}else f.matrix.copy(s.matrix);f.matrixWorldNeedsUpdate=true;}}
 update();return{group,update,setVisible(v){group.visible=!!v;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();}};
}
