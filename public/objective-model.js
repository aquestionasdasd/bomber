// One world-scale field device, shared by its folded and deployed states.
// All textures are deterministic typed arrays, so no DOM or asset fetch is needed.
export function createObjectiveModel(THREE) {
  const group=new THREE.Group();group.name='BOMBER / BD-01 field module';group.visible=false;
  const geometries=new Set(),materials=new Set(),textures=new Set();let disposed=false;
  const keepGeometry=g=>(geometries.add(g),g),keepMaterial=m=>(materials.add(m),m),keepTexture=t=>(textures.add(t),t);
  const boxGeometry=keepGeometry(new THREE.BoxGeometry(1,1,1));
  const cylinderGeometry=keepGeometry(new THREE.CylinderGeometry(1,1,1,12));
  const hexGeometry=keepGeometry(new THREE.CylinderGeometry(1,1,1,6));
  const face=new THREE.Shape();face.moveTo(-.44,-.5);face.lineTo(.44,-.5);face.lineTo(.5,-.44);face.lineTo(.5,.44);face.lineTo(.44,.5);face.lineTo(-.44,.5);face.lineTo(-.5,.44);face.lineTo(-.5,-.44);face.closePath();
  const chamferGeometry=keepGeometry(new THREE.ExtrudeGeometry(face,{depth:.9,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.035,bevelThickness:.035,curveSegments:1}));chamferGeometry.translate(0,0,-.45);
  function surface(){
    const n=64,data=new Uint8Array(n*n*4);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,grain=(x*13+y*37+x*y)%19;data[i]=145+grain;data[i+1]=194+grain*.9;data[i+2]=0;data[i+3]=255;}
    const t=keepTexture(new THREE.DataTexture(data,n,n));t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
  }
  const finish=surface();
  function standard(color,roughness,metalness,grain=true){const m=keepMaterial(new THREE.MeshStandardMaterial({color,roughness,metalness}));if(grain){m.roughnessMap=finish;m.bumpMap=finish;m.bumpScale=.00065;}return m;}
  const M={
    shell:standard('#334851',.7,.3),steel:standard('#6d838b',.47,.62),trim:standard('#a3b0af',.39,.72),
    rubber:standard('#1a2d34',.95,.02,false),paint:standard('#c0ba9b',.8,.08),
    core:keepMaterial(new THREE.MeshStandardMaterial({color:'#8ce9d2',emissive:'#3ac7b0',emissiveIntensity:.8,roughness:.28,metalness:.2})),
    indicator:keepMaterial(new THREE.MeshStandardMaterial({color:'#9dbbaa',emissive:'#5bd9bb',emissiveIntensity:.55,roughness:.5,metalness:.12})),
  };
  function part(parent,geometry,material,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0]){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.scale.set(...scale);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.solid=false;mesh.raycast=()=>{};parent.add(mesh);return mesh;
  }
  const box=(parent,p,s,m,r=[0,0,0])=>part(parent,boxGeometry,m,p,s,r);
  const bevel=(parent,p,s,m,r=[0,0,0])=>part(parent,chamferGeometry,m,p,s,r);
  const cylinder=(parent,p,s,m,r=[0,0,0])=>part(parent,cylinderGeometry,m,p,s,r);
  function mergeRigid(parent,name){
    const buckets=new Map();
    for(const mesh of [...parent.children]){if(!mesh.isMesh)continue;if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);buckets.get(mesh.material).push(mesh);}
    const output=[];
    for(const [material,meshes]of buckets){
      const positions=[],normals=[],uvs=[];
      for(const mesh of meshes){mesh.updateMatrix();const copy=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();copy.applyMatrix4(mesh.matrix);const p=copy.getAttribute('position'),n=copy.getAttribute('normal'),uv=copy.getAttribute('uv');
        for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);}copy.dispose();parent.remove(mesh);
      }
      const geometry=keepGeometry(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeBoundingSphere();
      const merged=part(parent,geometry,material);merged.name=`${name} / ${output.length+1}`;output.push(merged);
    }
    return output;
  }
  const body=new THREE.Group();body.name='Armored body and carrying handle';group.add(body);
  part(body,hexGeometry,M.rubber,[0,.105,0],[.211,.15,.211],[0,Math.PI/6,0]);
  part(body,hexGeometry,M.steel,[0,.18,0],[.245,.075,.245],[0,Math.PI/6,0]);
  part(body,hexGeometry,M.shell,[0,.535,0],[.245,.075,.245],[0,Math.PI/6,0]);
  part(body,hexGeometry,M.trim,[0,.577,0],[.224,.018,.224],[0,Math.PI/6,0]);
  part(body,hexGeometry,M.rubber,[0,.594,0],[.198,.022,.198],[0,Math.PI/6,0]);
  part(body,hexGeometry,M.steel,[0,.615,0],[.166,.025,.166],[0,Math.PI/6,0]);
  for(let i=0;i<6;i++){
    const angle=i*Math.PI/3,x=Math.sin(angle),z=Math.cos(angle);
    if(i!==0)bevel(body,[x*.215,.355,z*.215],[.192,.297,.047],i%2?M.shell:M.steel,[0,angle,0]);
    for(const y of[.225,.482])box(body,[x*.241,y,z*.241],[.174,.019,.02],M.trim,[0,angle,0]);
    for(const y of[.25,.456])cylinder(body,[x*.249,y,z*.249],[.009,.01,.009],M.rubber,[Math.PI/2,0,-angle]);
    if(i>0)for(let j=0;j<3;j++)box(body,[x*.242,.31+j*.031,z*.242],[.103,.01,.011],M.rubber,[0,angle,0]);
    const a=angle+Math.PI/6;box(body,[Math.sin(a)*.203,.356,Math.cos(a)*.203],[.018,.3,.025],M.rubber,[0,a,0]);
  }
  // Screen housing has a sunken bezel and a slightly upward-facing screen.
  bevel(body,[0,.354,.233],[.26,.3,.063],M.shell);
  bevel(body,[0,.461,.252],[.29,.177,.045],M.steel,[-.4,0,0]);
  bevel(body,[0,.462,.276],[.264,.15,.014],M.rubber,[-.4,0,0]);
  for(const x of[-.106,.106])cylinder(body,[x,.394,.279],[.008,.008,.008],M.trim,[Math.PI/2,0,0]);
  for(let i=0;i<3;i++)box(body,[-.069+i*.069,.292,.271],[.04,.019,.007],i===1?M.indicator:M.rubber);
  box(body,[0,.241,.269],[.168,.015,.009],M.paint);
  for(const x of[-.125,.125]){bevel(body,[x,.697,-.012],[.04,.17,.053],M.steel);box(body,[x,.628,-.012],[.067,.031,.077],M.rubber);}
  bevel(body,[0,.788,-.012],[.291,.044,.063],M.steel);bevel(body,[0,.789,-.012],[.171,.057,.07],M.rubber);
  for(let i=0;i<7;i++)box(body,[-.067+i*.022,.819,-.012],[.008,.003,.056],M.shell);
  // An inset service port and latch make the back read as a fabricated object.
  bevel(body,[0,.36,-.249],[.124,.155,.025],M.rubber);bevel(body,[0,.36,-.267],[.068,.106,.019],M.steel);
  cylinder(body,[0,.363,-.281],[.018,.01,.018],M.rubber,[Math.PI/2,0,0]);box(body,[0,.433,-.27],[.076,.017,.025],M.trim);
  for(const side of[-1,1])box(body,[side*.055,.273,-.253],[.018,.035,.013],M.paint);
  const coreParts=new THREE.Group();coreParts.name='Inset energy cartridge';group.add(coreParts);
  part(coreParts,hexGeometry,M.core,[0,.355,0],[.159,.3,.159],[0,Math.PI/6,0]);
  for(let i=0;i<6;i++){const a=(i+.5)*Math.PI/3;box(coreParts,[Math.sin(a)*.167,.353,Math.cos(a)*.167],[.02,.285,.026],M.core,[0,a,0]);}
  mergeRigid(body,'Body finish');mergeRigid(coreParts,'Protected core');

  // A single leg template is reused three times. Hinge motion and its flat foot
  // are separate, keeping the deployed device planted on the ground.
  const legTemplate=new THREE.Group();
  bevel(legTemplate,[0,.177,0],[.085,.325,.067],M.shell);
  for(const x of[-.046,.046]){box(legTemplate,[x,.182,0],[.016,.31,.072],M.steel);box(legTemplate,[x,.191,.039],[.012,.26,.012],M.trim);}
  cylinder(legTemplate,[0,0,0],[.047,.16,.047],M.steel,[0,0,Math.PI/2]);
  for(const x of[-.085,.085])cylinder(legTemplate,[x,0,0],[.022,.012,.022],M.trim,[0,0,Math.PI/2]);
  bevel(legTemplate,[0,.309,.005],[.114,.064,.084],M.steel);
  box(legTemplate,[0,.155,-.039],[.033,.176,.014],M.rubber);
  const legBatches=mergeRigid(legTemplate,'Folding leg').map(mesh=>{
    const batch=new THREE.InstancedMesh(mesh.geometry,mesh.material,3);batch.name=`Three hinged legs / ${mesh.name}`;batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.castShadow=true;batch.receiveShadow=true;batch.userData.solid=false;batch.raycast=()=>{};group.add(batch);return batch;
  });
  const footTemplate=new THREE.Group();bevel(footTemplate,[0,0,0],[.183,.032,.139],M.steel);bevel(footTemplate,[0,-.022,0],[.163,.018,.121],M.rubber);
  for(const x of[-.059,.059])box(footTemplate,[x,.019,0],[.015,.009,.107],M.trim);
  const footBatches=mergeRigid(footTemplate,'Ground shoe').map(mesh=>{
    const batch=new THREE.InstancedMesh(mesh.geometry,mesh.material,3);batch.name=`Three landing shoes / ${mesh.name}`;batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.castShadow=true;batch.receiveShadow=true;batch.userData.solid=false;batch.raycast=()=>{};group.add(batch);return batch;
  });
  const movingBatches=[...legBatches,...footBatches];
  for(const batch of movingBatches)batch.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.4,0),.9);
  // Compact bitmap glyphs avoid per-frame canvas creation and texture allocation.
  const glyphs={
    '0':['01110','11011','11011','11011','11011','11011','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],
    '2':['01110','11011','00011','00110','01100','11000','11111'],'3':['11110','00011','00011','01110','00011','00011','11110'],
    '4':['00010','00110','01110','11010','11111','00010','00010'],'5':['11111','11000','11000','11110','00011','11011','01110'],
    '6':['00110','01100','11000','11110','11011','11011','01110'],'7':['11111','00011','00110','00110','01100','01100','01100'],
    '8':['01110','11011','11011','01110','11011','11011','01110'],'9':['01110','11011','11011','01111','00011','00110','01100'],
    A:['01110','11011','11011','11111','11011','11011','11011'],B:['11110','11011','11011','11110','11011','11011','11110'],
    C:['01111','11000','11000','11000','11000','11000','01111'],D:['11110','11011','11011','11011','11011','11011','11110'],
    E:['11111','11000','11000','11110','11000','11000','11111'],F:['11111','11000','11000','11110','11000','11000','11000'],
    H:['11011','11011','11011','11111','11011','11011','11011'],I:['11111','00100','00100','00100','00100','00100','11111'],
    K:['11011','11010','11100','11000','11100','11010','11011'],L:['11000','11000','11000','11000','11000','11000','11111'],
    M:['11011','11111','11111','11011','11011','11011','11011'],N:['11011','11111','11111','11111','11011','11011','11011'],
    O:['01110','11011','11011','11011','11011','11011','01110'],P:['11110','11011','11011','11110','11000','11000','11000'],
    R:['11110','11011','11011','11110','11100','11010','11011'],S:['01111','11000','11000','01110','00011','00011','11110'],
    T:['11111','00100','00100','00100','00100','00100','00100'],U:['11011','11011','11011','11011','11011','11011','01110'],
    V:['11011','11011','11011','11011','11011','01110','00100'],W:['11011','11011','11011','11011','11111','11111','11011'],Y:['11011','11011','01110','00100','00100','00100','00100'],
    '/':['00001','00011','00110','01100','11000','10000','00000'],'-':['00000','00000','00000','11111','00000','00000','00000'],
    ':':['00000','00100','00100','00000','00100','00100','00000'],'.':['00000','00000','00000','00000','00000','00110','00110'],
  };
  function bitmap(width,height){
    const data=new Uint8Array(width*height*4);
    function rect(x,y,w,h,color){for(let yy=Math.max(0,Math.floor(y));yy<Math.min(height,Math.ceil(y+h));yy++)for(let xx=Math.max(0,Math.floor(x));xx<Math.min(width,Math.ceil(x+w));xx++){const p=((height-1-yy)*width+xx)*4;data[p]=color[0];data[p+1]=color[1];data[p+2]=color[2];data[p+3]=255;}}
    function text(value,x,y,scale,color){for(const char of value){const glyph=glyphs[char];if(glyph)for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(glyph[row][col]==='1')rect(x+col*scale,y+row*scale,scale,scale,color);x+=6*scale;}}
    const texture=keepTexture(new THREE.DataTexture(data,width,height));texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
    return {texture,rect,text,width,height};
  }
  const label=bitmap(256,64);label.rect(0,0,256,64,[29,49,56]);label.rect(0,0,5,64,[185,185,147]);label.text('BD / 01',17,8,3,[218,216,183]);label.text('FIELD MODULE',17,40,2,[134,162,159]);
  for(let i=0;i<28;i++)label.rect(191+(i%12)*4,8+Math.floor(i/12)*9,2,6,[150,173,160]);
  const labelMaterial=keepMaterial(new THREE.MeshStandardMaterial({map:label.texture,roughness:.85,metalness:.05}));
  const planeGeometry=keepGeometry(new THREE.PlaneGeometry(1,1));
  part(group,planeGeometry,labelMaterial,[0,.331,.2715],[.189,.047,1]).castShadow=false;
  const display=bitmap(256,128),screenMaterial=keepMaterial(new THREE.MeshStandardMaterial({map:display.texture,emissiveMap:display.texture,color:'#d8ebde',emissive:'#a2e1cb',emissiveIntensity:.65,roughness:.35,metalness:.08}));
  const screen=part(group,planeGeometry,screenMaterial,[0,.465,.285],[.237,.117,1],[-.4,0,0]);screen.name='Recessed countdown and disarm display';screen.castShadow=false;
  const ringMaterial=keepMaterial(new THREE.MeshBasicMaterial({color:'#7de2c5',transparent:true,opacity:.27,side:THREE.DoubleSide,depthWrite:false}));
  const groundRing=part(group,keepGeometry(new THREE.RingGeometry(.613,.632,48)),ringMaterial,[0,.012,0],[1,1,1],[-Math.PI/2,0,0]);groundRing.name='Subtle armed locator';groundRing.castShadow=false;groundRing.receiveShadow=false;
  const progressMaterial=keepMaterial(new THREE.MeshStandardMaterial({color:'#b7dfc4',emissive:'#5bd3ac',emissiveIntensity:.8,roughness:.4,metalness:.15}));
  const progress=new THREE.InstancedMesh(boxGeometry,progressMaterial,20);progress.name='Twenty countdown and disarm segments';progress.castShadow=false;progress.userData.solid=false;progress.raycast=()=>{};group.add(progress);
  const temp=new THREE.Object3D();
  for(let i=0;i<20;i++){const a=i/20*Math.PI*2;temp.position.set(Math.sin(a)*.208,.578,Math.cos(a)*.208);temp.rotation.set(0,a,0);temp.scale.set(.019,.012,.024);temp.updateMatrix();progress.setMatrixAt(i,temp.matrix);}
  progress.instanceMatrix.needsUpdate=true;progress.computeBoundingSphere();
  // Construction-only primitives can be released once the rigid meshes are baked.
  for(const geometry of[hexGeometry,cylinderGeometry,chamferGeometry]){geometry.dispose();geometries.delete(geometry);}
  let lastStatus='',transitionTime=0,fromDeployment=0,deployment=0,lastTime=0,lastDisplayKey='',displayRevision=0;
  function finite(value,fallback=0){return Number.isFinite(value)?value:fallback;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function drawDisplay(mode,seconds,value,checkpoint){
    const key=`${mode}/${seconds}/${Math.round(value*20)}/${checkpoint}`;if(key===lastDisplayKey)return;lastDisplayKey=key;
    const ink=mode==='DEFUSE'||mode==='HELD'?[137,219,235]:mode==='ARMED'&&seconds<=10?[249,176,115]:[156,221,190];
    display.rect(0,0,256,128,[13,33,39]);display.rect(8,7,240,1,[65,96,97]);display.text(mode==='DEFUSE'?'POWER OFF':mode,15,14,2,ink);display.text(seconds===null?'--':String(seconds).padStart(2,'0'),15,38,9,ink);
    display.text(mode==='SAFE'?'SAFE':mode==='PLANT'?'ARM':'SEC',146,65,2,[126,164,154]);
    display.rect(15,111,226,6,[45,69,71]);display.rect(15,111,Math.round(226*value),6,ink);
    if(checkpoint){display.rect(126,107,3,14,[237,199,121]);display.text('HOLD',178,16,2,[229,204,150]);}
    display.texture.needsUpdate=true;displayRevision++;
    group.userData.display={mode,seconds,progress:value,checkpoint,revision:displayRevision};
  }
  function update({time=0,status='dropped',timer=45,plantProgress=0,defuseProgress=0,checkpoint=0,practice=false}={}){
    if(disposed)return;time=finite(time,lastTime);timer=clamp(finite(timer,45),0,45);plantProgress=clamp(finite(plantProgress),0,4);defuseProgress=clamp(finite(defuseProgress),0,7);checkpoint=clamp(finite(checkpoint),0,7);
    group.visible=status==='dropped'||status==='planted'||practice&&status==='defused';
    if(status!==lastStatus||time<lastTime){fromDeployment=deployment;transitionTime=time;lastStatus=status;}
    const target=status==='planted'||practice&&status==='defused'?1:0,t=clamp((time-transitionTime)/.48,0,1),smooth=t*t*(3-2*t);deployment=fromDeployment+(target-fromDeployment)*smooth;lastTime=time;
    const angle=.09+(1.928-.09)*deployment,endY=.18+Math.cos(angle)*.38,endRadius=.185+Math.sin(angle)*.38;
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3;temp.position.set(Math.sin(a)*.185,.18,Math.cos(a)*.185);temp.rotation.set(angle,a,0,'YXZ');temp.scale.set(1,1,1);temp.updateMatrix();for(const batch of legBatches)batch.setMatrixAt(i,temp.matrix);
      temp.position.set(Math.sin(a)*endRadius,endY-.015*deployment,Math.cos(a)*endRadius);temp.rotation.set((1-deployment)*Math.PI/2,a,0,'YXZ');temp.updateMatrix();for(const batch of footBatches)batch.setMatrixAt(i,temp.matrix);
    }
    for(const batch of movingBatches)batch.instanceMatrix.needsUpdate=true;
    const armed=status==='planted',held=armed&&checkpoint>=3.5&&defuseProgress<=checkpoint+1e-8,disarming=armed&&defuseProgress>0&&!held;
    const mode=!armed?(status!=='defused'&&plantProgress>0?'PLANT':'SAFE'):disarming?'DEFUSE':held?'HELD':practice?'TRAIN':'ARMED';
    const fraction=disarming?defuseProgress/7:held?checkpoint/7:armed?timer/45:plantProgress/4;
    // The main digits consistently show detonation time during disarming too;
    // the segmented bar and HOLD badge communicate disarm progress separately.
    const seconds=mode==='SAFE'||practice?null:mode==='PLANT'?Math.ceil(4-plantProgress):Math.ceil(timer);
    drawDisplay(mode,seconds,fraction,armed&&checkpoint>=3.5);
    const pulse=.5+.5*Math.sin(time*(armed?(timer<10?15:7):2));
    M.core.emissiveIntensity=armed?.68+pulse*.72:.13+pulse*.08;
    const urgent=armed&&timer<10&&!disarming&&!held;
    M.indicator.color.set(urgent?'#e4b485':disarming?'#a4dbe6':'#9dbbaa');M.indicator.emissive.set(urgent?'#e7a15e':disarming?'#65c4db':'#5bd9bb');M.indicator.emissiveIntensity=armed?.45+pulse*.4:.12;
    progressMaterial.color.set(disarming||held?'#a9dfea':urgent?'#e2bd8e':'#b7dfc4');progressMaterial.emissive.set(disarming||held?'#65badb':urgent?'#d79253':'#5bd3ac');
    progress.count=armed?Math.max(1,Math.ceil(fraction*20)):0;groundRing.visible=armed;ringMaterial.opacity=armed?.15+pulse*.12:0;
    group.userData.deployment=deployment;group.userData.state=status;
  }
  function dispose(){
    if(disposed)return;disposed=true;group.visible=false;group.removeFromParent();
    for(const batch of movingBatches)batch.dispose();progress.dispose();
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();
    geometries.clear();materials.clear();textures.clear();group.clear();
  }
  update({time:0,status:'hidden'});
  return {group,update,dispose};
}
