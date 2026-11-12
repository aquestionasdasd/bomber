// Local Idol generation, Blender retopology and existing rigid gameplay animation.
// Generated heads are visible hit surfaces; weapon grips and original body proxies stay in agent-model.js.
import {SOLDER_IDOL_META,SOLDER_IDOL_DATA} from './solder-idol-asset.js';
const caches=new WeakMap();

function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    const geometries=new Set(),materials=new Map(),textures=new Set(),templates=[],chunks=new Map(),transform=new THREE.Object3D();
    const finish=(id,roughness=.8)=>{const m=new THREE.MeshStandardMaterial({color:'#ffffff',roughness,metalness:0,vertexColors:true});m.name=`Solder avatar finish / ${id}`;materials.set(id,m);return m;};
    finish('skin',.84);finish('idol',.86);finish('detail',.55);
    const lens=new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.3,metalness:0,transparent:false,opacity:1,depthWrite:true,clearcoat:.45,clearcoatRoughness:.2,side:THREE.DoubleSide});lens.name='Solder avatar finish / opaque white lens';materials.set('lens',lens);
    const teamBlue=new THREE.MeshStandardMaterial({color:'#62adb8',roughness:.75}),teamRed=new THREE.MeshStandardMaterial({color:'#c77870',roughness:.75});teamBlue.name='Solder avatar finish / team blue';teamRed.name='Solder avatar finish / team red';materials.set('teamBlue',teamBlue);materials.set('teamRed',teamRed);
    const bytes=Uint8Array.from(atob(SOLDER_IDOL_DATA),c=>c.charCodeAt(0));
    if(SOLDER_IDOL_META.version!==1||bytes.byteLength!==SOLDER_IDOL_META.bytes)throw new Error('Invalid solder avatar asset');
    const array=(entry)=>{
      const Type=entry.type==='f'?Float32Array:entry.type==='H'?Uint16Array:entry.type==='I'?Uint32Array:null;
      if(!Type||entry.offset%Type.BYTES_PER_ELEMENT||entry.count<0||entry.offset<0||entry.offset+entry.count*Type.BYTES_PER_ELEMENT>bytes.byteLength)throw new Error('Invalid solder avatar attribute');
      return new Type(bytes.buffer,entry.offset,entry.count);
    };
    for(const part of SOLDER_IDOL_META.parts){
      const g=new THREE.BufferGeometry();
      for(const key of ['position','normal','color'])g.setAttribute(key,new THREE.BufferAttribute(array(part[key]),3));
      g.setIndex(new THREE.BufferAttribute(array(part.index),1));g.computeBoundingBox();g.computeBoundingSphere();g.userData.idolFrame=part.frame;
      geometries.add(g);templates.push({frame:part.frame,material:'idol',geometry:g,label:part.label});
    }
    function part(frame,material,geometry,color='#ffffff',p=[0,0,0],s=[1,1,1],r=[0,0,0],label='',semantic=''){
      transform.position.set(...p);transform.scale.set(...s);transform.rotation.set(r[0]||0,r[1]||0,r[2]||0);transform.updateMatrix();
      const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);geometry.dispose();
      if(detailTransform){g.applyMatrix4(detailTransform);const positions=g.getAttribute('position');for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);positions.setZ(i,z+(frame==='head'?-.035*Math.pow(Math.abs(x)/.108,2):.006-.26*(y-1.305)));}g.computeVertexNormals();}
      const base=new THREE.Color(color),c=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<c.length;i+=3){c[i]=base.r;c[i+1]=base.g;c[i+2]=base.b;}g.setAttribute('color',new THREE.BufferAttribute(c,3));
      const key=`${frame}|${material}|${semantic}`;if(!chunks.has(key))chunks.set(key,{frame,material,label,parts:[]});const chunk=chunks.get(key);if(label&&!chunk.label.includes(label))chunk.label+=(chunk.label?' / ':'')+label;chunk.parts.push(g);
    }
    const ball=(f,m,p,s,c,label='',seg=24)=>part(f,m,new THREE.SphereGeometry(1,seg,Math.max(8,Math.floor(seg*.7))),c,p,s,[0,0,0],label);
    function rod(f,m,a,b,r,c,label='',segments=10){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),g=new THREE.CylinderGeometry(r,r,delta.length(),segments);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));part(f,m,g,c,start.add(end).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],label);}
    function panel(f,m,points,depth,color,p,label,bevel=.003){const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel*.5,bevelSegments:2,steps:1,curveSegments:12});g.translate(0,0,-depth/2);part(f,m,g,color,p,[1,1,1],[0,0,0],label);}
    function patch(f,m,points,color,label){const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new THREE.ShapeGeometry(shape,16);const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setZ(i,.158+(1-Math.min(1,Math.abs(pos.getX(i))/.16))*.012);g.computeVertexNormals();part(f,m,g,color,[0,0,0],[1,1,1],[0,0,0],label);}
    function shell(f,m,rings,color,label,segments=40){const p=[],uv=[],idx=[];for(let j=0;j<rings.length;j++)for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2,[y,rx,rz,z=0]=rings[j];p.push(Math.sin(a)*rx,y,Math.cos(a)*rz+z);uv.push(k/segments,j/(rings.length-1));}for(let j=0;j<rings.length-1;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;idx.push(a,a+1,b,a+1,b+1,b);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();part(f,m,g,color,[0,0,0],[1,1,1],[0,0,0],label);}
    // Preserve crisp safety equipment on the generated head/chest. These
    // one-time transforms fit the authored details to measured mesh landmarks.
    let detailTransform=new THREE.Matrix4().makeScale(.70,.75,.85).setPosition(0,.027,.008);
    const outline=[[-.147,.062],[-.135,.078],[-.075,.079],[.075,.079],[.145,.066],[.151,.042],[.128,-.028],[.111,-.049],[.075,-.059],[.036,-.052],[.017,-.028],[.012,-.010],[-.004,-.010],[-.016,-.030],[-.035,-.050],[-.078,-.056],[-.111,-.043],[-.132,-.018]];
    patch('head','lens',outline,'#ffffff','opaque white safety goggles');
    for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],az=.158+(1-Math.min(1,Math.abs(a[0])/.16))*.012,bz=.158+(1-Math.min(1,Math.abs(b[0])/.16))*.012;rod('head','detail',[a[0],a[1],az],[b[0],b[1],bz],.0054,'#ffffff','goggle frame',12);}
    for(const side of [-1,1]){
      rod('head','detail',[side*.143,.047,.144],[side*.154,.047,-.035],.009,'#ffffff','goggle elastic strap');rod('head','detail',[side*.154,.047,-.035],[side*.120,.044,-.104],.009,'#ffffff','goggle elastic strap');
      ball('head','detail',[side*.145,.047,.147],[.010,.014,.006],'#ffffff','goggle hinge screws',18);ball('head','detail',[side*.145,.048,.154],[.003,.006,.001],'#ffffff','goggle screw slots',12);
      rod('head','detail',[side*.078,.056,.169],[side*.114,.043,.164],.0013,'#ffffff','lens local reflection');
    }
    detailTransform=new THREE.Matrix4().makeScale(.86,.86,1).setPosition(.212, .240, -.048);
    panel('body','detail',[[-.036,-.041],[.036,-.041],[.036,.058],[-.036,.058]],.005,'#326c53',[-.107,1.239,.157],'green circuit board',.001);
    panel('body','detail',[[-.011,-.015],[.011,-.015],[.011,.015],[-.011,.015]],.004,'#404b45',[-.107,1.246,.163],'circuit board controller',.001);
    for(let i=0;i<4;i++){
      const x=-.132+i*.016;rod('body','detail',[x,1.277,.164],[x,1.265,.164],.0010,'#b6bf84','copper traces');rod('body','detail',[x,1.265,.164],[-.107,1.252+i*.002,.164],.0010,'#b6bf84','copper traces');
      ball('body','detail',[x,1.284,.164],[.003,.003,.0014],'#c6c5a2','circuit contact pads',12);
    }
    detailTransform=null;
    const skin='#b88b62';
    shell('body','team',[[1.248,.216,.151],[1.266,.217,.149]],'#ffffff','team chest band');
    for(const side of ['R','L']){
      ball('hand'+side,'skin',[0,0,.002],[.041,.038,.059],skin,'bare working hands',24);
      for(let i=0;i<4;i++){ball('hand'+side,'skin',[-.027+i*.018,-.018,.028],[.009,.015,.028],skin,'fingers',16);ball('hand'+side,'skin',[-.027+i*.018,-.026,.045],[.008,.011,.017],skin,'fingertips',14);}
      ball('hand'+side,'skin',[.035,.002,.017],[.015,.024,.029],skin,'thumb',20);
    }
    for(const chunk of chunks.values()){
      const p=[],n=[],uv=[],colors=[];for(const g of chunk.parts){const a=g.getAttribute('position'),b=g.getAttribute('normal'),c=g.getAttribute('uv'),d=g.getAttribute('color');for(let i=0;i<a.count;i++){p.push(a.getX(i),a.getY(i),a.getZ(i));n.push(b.getX(i),b.getY(i),b.getZ(i));uv.push(c?c.getX(i):0,c?c.getY(i):0);colors.push(d.getX(i),d.getY(i),d.getZ(i));}g.dispose();}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);templates.push({frame:chunk.frame,material:chunk.material,geometry:g,label:chunk.label});
    }
    cache={references:0,geometries,materials,textures,templates};caches.set(THREE,cache);
  }
  cache.references++;let released=false;return {cache,release(){if(released)return;released=true;if(--cache.references===0){for(const g of cache.geometries)g.dispose();for(const m of cache.materials.values())m.dispose();for(const t of cache.textures)t.dispose();caches.delete(THREE);}}};
}

export function createSolderAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group(),frames=new Map();group.name='Solder avatar / はんだごて握り太郎';rig.add(group);
  const sources={body:upper,head,armR:rightArm.upperArm,armL:leftArm.upperArm,foreR:rightArm.forearm,foreL:leftArm.forearm,handR:rightArm.palm,handL:leftArm.palm,thighR:rightLeg.thigh,thighL:leftLeg.thigh,shinR:rightLeg.shin,shinL:leftLeg.shin,shoeR:rightLeg.boot,shoeL:leftLeg.boot};
  for(const template of cache.templates){if(!frames.has(template.frame)){const frame=new THREE.Group();frame.name=`Solder avatar frame / ${template.frame}`;frame.matrixAutoUpdate=false;group.add(frame);frames.set(template.frame,frame);}const material=cache.materials.get(template.material==='team'?(team==='blue'?'teamBlue':'teamRed'):template.material),mesh=new THREE.Mesh(template.geometry,material);mesh.name=`Solder avatar / ${template.label}`;mesh.userData.character='ember';mesh.userData.solid=false;mesh.raycast=()=>{};mesh.castShadow=template.material!=='lens';mesh.receiveShadow=true;frames.get(template.frame).add(mesh);}
  let disposed=false;
  function update(){if(disposed)return;upper.updateMatrix();head.updateMatrix();for(const [name,frame]of frames){const source=sources[name];source.updateMatrix();if(name==='head')frame.matrix.multiplyMatrices(upper.matrix,source.matrix);else frame.matrix.copy(source.matrix);frame.matrixWorldNeedsUpdate=true;}}
  function setVisible(value){group.visible=Boolean(value);}
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();release();}
  update();return {group,roots:frames,update,setVisible,dispose};
}
