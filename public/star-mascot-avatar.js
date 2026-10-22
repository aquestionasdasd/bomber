// A visible mascot skin over the unchanged tactical hit rig. All assets are
// shared by owners; limbs borrow the same IK matrices as the tactical model.
const caches = new WeakMap();

function acquireAssets(THREE) {
  let cache=caches.get(THREE);
  if(!cache){
    const geometries=new Set(),materials=new Map(),textures=new Set(),templates=[],chunks=new Map(),transform=new THREE.Object3D();
    const finish=(name,color,roughness=.8)=>{
      const material=new THREE.MeshStandardMaterial({color,roughness,vertexColors:true});
      material.name=`Star mascot finish / ${name}`;materials.set(name,material);return material;
    };
    finish('cream','#fff1b7',.86);finish('brown','#625035',.94);finish('innerEar','#81613a',.92);
    finish('orange','#eb6926',.56);finish('orangeRim','#f49a45',.65);finish('white','#fffef1',.35);
    finish('nose','#a78d4b',.85);finish('sole','#493d2d',.92);
    finish('teamBlue','#5caab1',.72);finish('teamRed','#c47772',.72);
    const eyes=new THREE.MeshPhysicalMaterial({color:'#09090c',roughness:.2,metalness:0,clearcoat:.65,clearcoatRoughness:.2,vertexColors:true});
    eyes.name='Star mascot finish / polished black';materials.set('black',eyes);
    const size=128,data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=(y*size+x)*4,v=232+((x*17+y*31+x*y*7)%17)-8+Math.sin(x*2.3+y*.6)*2;
      data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
    }
    const nap=new THREE.DataTexture(data,size,size);nap.name='Star mascot surface / fine felt';nap.wrapS=nap.wrapT=THREE.RepeatWrapping;
    nap.repeat.set(3,3);nap.magFilter=THREE.LinearFilter;nap.minFilter=THREE.LinearMipmapLinearFilter;nap.generateMipmaps=true;nap.anisotropy=8;nap.needsUpdate=true;textures.add(nap);
    for(const id of ['cream','brown','innerEar']){materials.get(id).bumpMap=nap;materials.get(id).bumpScale=id==='brown'?.00045:.00025;}
    function part(frame,material,geometry,p=[0,0,0],s=[1,1,1],r=[0,0,0],label='',semantic=''){
      transform.position.set(...p);transform.scale.set(...s);transform.rotation.set(r[0]||0,r[1]||0,r[2]||0);transform.updateMatrix();
      const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);geometry.dispose();
      if(!g.hasAttribute('color')){const colors=new Float32Array(g.getAttribute('position').count*3);colors.fill(1);g.setAttribute('color',new THREE.BufferAttribute(colors,3));}
      // Facial features stay separate semantic batches for actual eye/star ray
      // checks; the rest merge by joint and finish, not one draw per decoration.
      const key=`${frame}|${material}|${semantic}`;
      if(!chunks.has(key))chunks.set(key,{frame,material,label,parts:[]});
      const chunk=chunks.get(key);if(label&&!chunk.label.includes(label))chunk.label+=(chunk.label?' / ':'')+label;chunk.parts.push(g);
    }
    const ball=(f,m,p,s,label='',segments=24,semantic='')=>part(f,m,new THREE.SphereGeometry(1,segments,Math.max(8,Math.floor(segments*.7))),p,s,[0,0,0],label,semantic);
    function rod(frame,material,a,b,r,label=''){
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start),geometry=new THREE.CylinderGeometry(r*.72,r,direction.length(),10);
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
      part(frame,material,geometry,start.add(end).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],label);
    }
    function shell(frame,material,rings,segments=48,label=''){
      const p=[],uv=[],index=[];
      for(let j=0;j<rings.length;j++)for(let k=0;k<=segments;k++){
        const a=k/segments*Math.PI*2,[y,rx,rz,cx=0,cz=0]=rings[j];p.push(cx+Math.sin(a)*rx,y,cz+Math.cos(a)*rz);uv.push(k/segments,j/(rings.length-1));
      }
      for(let j=0;j<rings.length-1;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;index.push(a,a+1,b,a+1,b+1,b);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();part(frame,material,g,[0,0,0],[1,1,1],[0,0,0],label);
    }
    // The face has broad cheeks and a soft, almost rectangular forehead. Warm
    // vertex color sits only at the lower cheek, leaving the cream ears pale.
    const face=new THREE.SphereGeometry(1,48,36),fp=face.getAttribute('position'),colors=[];
    for(let i=0;i<fp.count;i++){
      const x=fp.getX(i),y=fp.getY(i),z=fp.getZ(i),lower=y<-.35?1+(y+.35)*.11:1;
      fp.setXYZ(i,x*.252*lower,y*.304-.018,z*.186+.018);
      const warmth=Math.max(0,-y-.05)*Math.max(0,z)*.14;
      colors.push(1,1-warmth*.55,1-warmth);
    }
    face.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));face.computeVertexNormals();part('head','cream',face,[0,0,0],[1,1,1],[0,0,0],'cream mascot face','face');
    // Rounded, tall ears lean gently away from the face. Inset brown panels
    // leave a real cream rim visible around every edge, including the rear.
    for(const side of [-1,1]){
      shell('head','cream',[[.205,.039,.039,side*.157,-.002],[.27,.048,.041,side*.165,-.009],[.65,.058,.035,side*.195,-.015],[.79,.053,.029,side*.205,-.018],[.817,.033,.021,side*.206,-.018],[.824,0,0,side*.206,-.018]].map(([y,...rest])=>[.205+(y-.205)*.62,...rest]),32,'upright ears');
      const shape=new THREE.Shape();shape.moveTo(-.020,.005);shape.quadraticCurveTo(-.036,.012,-.038,.055);shape.lineTo(-.047,.440);shape.quadraticCurveTo(-.046,.475,-.022,.481);shape.quadraticCurveTo(.010,.491,.042,.477);shape.quadraticCurveTo(.050,.465,.045,.433);shape.lineTo(.027,.040);shape.quadraticCurveTo(.022,.009,-.020,.005);
      const ear=new THREE.ShapeGeometry(shape,12),ep=ear.getAttribute('position');
      for(let i=0;i<ep.count;i++){const y=ep.getY(i);ep.setXYZ(i,side*(.166+y*.079)+ep.getX(i),.205+(.285+y-.205)*.62,.038-y*.030);}
      ear.computeVertexNormals();part('head','innerEar',ear,[0,0,0],[1,1,1],[0,0,0],'brown inner ears');
    }
    // Jet-black convex ovals and dimensional four-point stars retain the exact
    // graphic face of the reference while reading correctly from three angles.
    for(const side of [-1,1]){
      const eyeX=side*.122,eyeY=.009,eyeZ=.176;
      ball('head','black',[eyeX,eyeY,eyeZ],[.078,.119,.034],`black oval eye ${side<0?'left':'right'}`,36,`eye${side}`);
      function star(x,y,rx,ry,label){
        const p=[],uv=[],indices=[],outline=[];
        for(let k=0;k<8;k++){const a=k/8*Math.PI*2,r=k%2===0?1:.34;outline.push([Math.sin(a)*rx*r,Math.cos(a)*ry*r]);}
        p.push(x,y,eyeZ+.035);uv.push(.5,.5);
        for(const [dx,dy]of outline){const sx=x+dx,sy=y+dy,rad=Math.pow((sx-eyeX)/.078,2)+Math.pow((sy-eyeY)/.119,2);p.push(sx,sy,eyeZ+.034*Math.sqrt(Math.max(.1,1-rad))+.0015);uv.push(.5+dx/(rx*2),.5+dy/(ry*2));}
        for(let k=0;k<8;k++)indices.push(0,1+(k+1)%8,1+k);
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();part('head','white',g,[0,0,0],[1,1,1],[0,0,0],label,`stars${side}`);
      }
      star(eyeX-side*.006,eyeY+.027,.023,.034,`white star highlights ${side<0?'left':'right'} / large`);
      star(eyeX+side*.023,eyeY-.055,.015,.024,`white star highlights ${side<0?'left':'right'} / small`);
      for(let i=0;i<3;i++){
        const y=.019+i*.049,x=eyeX+side*(.068-i*.009);
        rod('head','black',[x,y,.178],[x+side*(.038-i*.006),y+.015+i*.014,.177],.0075,'outer eyelashes');
        ball('head','black',[x+side*(.037-i*.006),y+.015+i*.014,.177],[.006,.007,.007],'rounded eyelash tips',10);
      }
    }
    // A tiny loop nose and two separated orange lip cushions, with raised rims.
    rod('head','nose',[-.011,-.045,.206],[-.017,-.066,.204],.0038,'tiny loop nose');
    rod('head','nose',[-.017,-.066,.204],[0,-.074,.209],.0038,'tiny loop nose');
    rod('head','nose',[0,-.074,.209],[.017,-.066,.204],.0038,'tiny loop nose');
    rod('head','nose',[.017,-.066,.204],[.010,-.045,.206],.0038,'tiny loop nose');
    ball('head','orange', [0,-.215,.171],[.088,.038,.038],'orange upper lip',32);
    ball('head','orange', [0,-.292,.193],[.086,.041,.042],'orange lower lip',32);
    ball('head','orangeRim',[0,-.207,.204],[.066,.014,.007],'soft upper lip rim',24);
    ball('head','orangeRim',[0,-.284,.231],[.065,.012,.007],'soft lower lip rim',24);
    // A compact cocoa-brown suit supplies the unseen lower half of the image.
    // Its smooth pear silhouette leaves the original hands and gun grips free.
    shell('body','brown',[[.73,0,0],[.765,.157,.128],[.84,.194,.150],[1.00,.213,.156],[1.17,.225,.151],[1.30,.196,.129],[1.36,.135,.101],[1.39,.085,.073],[1.405,0,0]],48,'dark brown torso');
    shell('body','team',[[.884,.201,.156],[.906,.204,.158],[.929,.206,.158]],48,'team ribbon');
    for(const side of ['R','L']){
      part('arm'+side,'brown',new THREE.CapsuleGeometry(1,4,5,18),[0,0,0],[.91,1,.91],[0,0,0],'rounded brown upper arms');
      part('fore'+side,'brown',new THREE.CapsuleGeometry(1,4,5,18),[0,0,0],[.94,1,.94],[0,0,0],'soft brown sleeves');
      ball('hand'+side,'cream',[0,-.004,.005],[.049,.043,.066],'cream mitten hands',24);
      ball('hand'+side,'cream',[.039,-.004,.022],[.021,.026,.031],'rounded thumb',18);
      // Three shallow seams, rather than separate finger blocks, keep a plush paw.
      for(let i=0;i<3;i++)rod('hand'+side,'nose',[-.024+i*.018,-.031,.049],[-.024+i*.018,-.036,.034],.0012,'mitten seams');
      part('thigh'+side,'brown',new THREE.CapsuleGeometry(1,4,5,18),[0,0,0],[.88,1,.88],[0,0,0],'rounded brown legs');
      part('shin'+side,'brown',new THREE.CapsuleGeometry(1,4,5,18),[0,0,0],[.88,1,.88],[0,0,0],'brown calves');
      ball('shoe'+side,'cream',[0,-.052,.044],[.080,.074,.143],'rounded mascot feet',28);
      ball('shoe'+side,'sole',[0,-.109,.042],[.079,.016,.140],'soft brown foot soles',24);
    }
    for(const chunk of chunks.values()){
      const p=[],n=[],uv=[],colors=[];
      for(const g of chunk.parts){const a=g.getAttribute('position'),b=g.getAttribute('normal'),c=g.getAttribute('uv'),d=g.getAttribute('color');for(let i=0;i<a.count;i++){p.push(a.getX(i),a.getY(i),a.getZ(i));n.push(b.getX(i),b.getY(i),b.getZ(i));uv.push(c?c.getX(i):0,c?c.getY(i):0);colors.push(d.getX(i),d.getY(i),d.getZ(i));}g.dispose();}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);
      templates.push({frame:chunk.frame,material:chunk.material,geometry:g,label:chunk.label});
    }
    cache={references:0,geometries,materials,textures,templates};caches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return {cache,release(){if(released)return;released=true;if(--cache.references===0){for(const g of cache.geometries)g.dispose();for(const m of cache.materials.values())m.dispose();for(const t of cache.textures)t.dispose();caches.delete(THREE);}}};
}

export function createStarMascotAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group(),frames=new Map();group.name='Star mascot avatar / ちぬつてのとのへめほ';rig.add(group);
  const sources={body:upper,head,armR:rightArm.upperArm,armL:leftArm.upperArm,foreR:rightArm.forearm,foreL:leftArm.forearm,handR:rightArm.palm,handL:leftArm.palm,
    thighR:rightLeg.thigh,thighL:leftLeg.thigh,shinR:rightLeg.shin,shinL:leftLeg.shin,shoeR:rightLeg.boot,shoeL:leftLeg.boot};
  for(const template of cache.templates){
    if(!frames.has(template.frame)){const frame=new THREE.Group();frame.name=`Star mascot frame / ${template.frame}`;frame.matrixAutoUpdate=false;group.add(frame);frames.set(template.frame,frame);}
    const material=cache.materials.get(template.material==='team'?(team==='blue'?'teamBlue':'teamRed'):template.material),mesh=new THREE.Mesh(template.geometry,material);
    mesh.name=`Star mascot / ${template.label}`;mesh.userData.character='duelist';mesh.userData.solid=false;mesh.raycast=()=>{};mesh.castShadow=true;mesh.receiveShadow=true;frames.get(template.frame).add(mesh);
  }
  let disposed=false;
  function update(){if(disposed)return;upper.updateMatrix();head.updateMatrix();for(const [name,frame]of frames){const source=sources[name];source.updateMatrix();if(name==='head')frame.matrix.multiplyMatrices(upper.matrix,source.matrix);else frame.matrix.copy(source.matrix);frame.matrixWorldNeedsUpdate=true;}}
  function setVisible(value){group.visible=Boolean(value);}
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();release();}
  update();return {group,roots:frames,update,setVisible,dispose};
}
