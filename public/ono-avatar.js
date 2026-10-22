// A dressed doll-like visible skin. Gameplay continues to use the unmodified
// tactical rig and hit proxies; cosmetic hair, face and clothing never raycast.
const caches=new WeakMap();

function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    const geometries=new Set(),materials=new Map(),textures=new Set(),templates=[],chunks=new Map(),transform=new THREE.Object3D();
    const finish=(id,color,roughness=.85)=>{const m=new THREE.MeshStandardMaterial({color,roughness});m.name=`Ono finish / ${id}`;materials.set(id,m);return m;};
    finish('skin','#f2cfbc',.86);finish('hair','#b6a2cc',.53);finish('hair sheen','#d7c5e5',.54);
    finish('white cloth','#f5f2ed',.94);finish('plaid','#ffffff',.9);finish('shoe','#343745',.75);finish('sole','#262d34',.94);
    finish('team blue','#69aeb8',.74);finish('team red','#c47d75',.74);
    const texture=(name,size,paint)=>{const data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++)paint(data,(y*size+x)*4,x,y,size);const t=new THREE.DataTexture(data,size,size);t.name=`Ono surface / ${name}`;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;textures.add(t);return t;};
    const twill=texture('fine white cotton',128,(d,i,x,y)=>{const v=234+((x*17+y*31+x*y*3)%11)-5+((x%4<2)!==(y%4<2)?2:-2);d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;});twill.wrapS=twill.wrapT=THREE.RepeatWrapping;twill.repeat.set(3,3);materials.get('white cloth').bumpMap=twill;materials.get('white cloth').bumpScale=.0004;
    const plaid=texture('navy red green fine white tartan',256,(d,i,x,y)=>{
      const u=x%64,v=y%64,c=[25,35,51];
      const stripe=(q,at,w)=>Math.min(Math.abs(q-at),64-Math.abs(q-at))<=w;
      for(const q of [u,v]){
        if(stripe(q,16,5)){c[0]+=31;c[1]-=5;c[2]-=4;}
        if(stripe(q,16,1)){c[0]+=47;c[1]+=5;c[2]+=6;}
        if(stripe(q,43,3)){c[0]-=3;c[1]+=31;c[2]+=4;}
        if(stripe(q,48,0)){c[0]+=67;c[1]+=78;c[2]+=70;}
        if(stripe(q,28,0)){c[0]+=86;c[1]+=86;c[2]+=78;}
      }
      const weave=((x+y)%2?1:-1)*2;d[i]=Math.max(0,c[0]+weave);d[i+1]=Math.max(0,c[1]+weave);d[i+2]=Math.max(0,c[2]+weave);d[i+3]=255;
    });plaid.colorSpace=THREE.SRGBColorSpace;plaid.wrapS=plaid.wrapT=THREE.RepeatWrapping;materials.get('plaid').map=plaid;
    const face=texture('blue eyes and doll expression',512,(d,i,px,py,n)=>{
      const x=(px/(n-1)-.5)*.25,y=(py/(n-1)-.5)*.235;let color=[0,0,0],alpha=0;
      const ink=(c,a=1)=>{color=c;alpha=a;};
      for(const side of [-1,1]){
        const cx=side*.057,dx=(x-cx)/.046,ey=y-.014,a=Math.sqrt(Math.max(0,1-dx*dx)),top=.033*a+.002*side*dx,bottom=-.025*a;
        if(Math.abs(dx)<1&&ey<top&&ey>bottom){
          ink([252,247,238]);const r=Math.hypot((x-cx)/.025,(ey-.001)/.031),angle=Math.atan2(ey-.001,x-cx);
          if(r<1){const fiber=(Math.sin(angle*31+r*13)*.5+.5)*17;ink(r>.88?[27,58,91]:[40+fiber,108+fiber+(1-r)*40,164+fiber+(1-r)*39]);}
          if(Math.pow((x-cx)/.009,2)+Math.pow((ey-.006)/.022,2)<1)ink([22,35,55]);
          if(Math.hypot((x-cx+.009)/.008,(ey-.016)/.009)<1)ink([255,255,250]);
          if(Math.hypot((x-cx-.008)/.004,(ey+.012)/.004)<1)ink([203,240,252]);
        }
        if(Math.abs(dx)<1&&Math.abs(ey-top)<.0041)ink([60,49,73]);
        const outer=side*(x-cx);if(outer>.032&&outer<.052&&Math.abs(ey-(.023+(outer-.032)*.45))<.0025)ink([60,49,73]);
        if(Math.abs(dx)<.92&&Math.abs(ey-bottom)<.0016)ink([127,99,126],.6);
        const brow=(x-cx)/.037;if(Math.abs(brow)<1&&Math.abs(y-(.067+.003*Math.cos(brow*2)))<.0018)ink([146,120,164],.8);
        const blush=Math.exp(-Math.pow((x-side*.080)/.025,2)-Math.pow((y+.040)/.014,2));if(alpha===0&&blush>.04)ink([231,153,153],blush*.3);
      }
      if(Math.abs(x)<.018&&Math.abs(y-(-.073+.004*Math.pow(x/.018,2)))<.0016)ink([174,115,119],.8);
      if(Math.abs(x)<.012&&Math.abs(y+.078)<.0014)ink([236,176,173],.6);
      d[i]=color[0];d[i+1]=color[1];d[i+2]=color[2];d[i+3]=Math.round(alpha*255);
    });face.colorSpace=THREE.SRGBColorSpace;const faceMaterial=new THREE.MeshStandardMaterial({map:face,transparent:true,depthWrite:false,roughness:.9,polygonOffset:true,polygonOffsetFactor:-1});faceMaterial.name='Ono finish / face painting';materials.set('face',faceMaterial);
    function part(frame,material,geometry,p=[0,0,0],s=[1,1,1],r=[0,0,0],label=''){
      transform.position.set(...p);transform.scale.set(...s);transform.rotation.set(r[0]||0,r[1]||0,r[2]||0);transform.updateMatrix();const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);geometry.dispose();const key=`${frame}|${material}`;if(!chunks.has(key))chunks.set(key,{frame,material,label,parts:[]});const chunk=chunks.get(key);if(label&&!chunk.label.includes(label))chunk.label+=(chunk.label?' / ':'')+label;chunk.parts.push(g);
    }
    const ball=(f,m,p,s,label='',seg=24,r=[0,0,0])=>part(f,m,new THREE.SphereGeometry(1,seg,Math.max(8,Math.floor(seg*.65))),p,s,r,label);
    function rod(f,m,a,b,r,label=''){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),g=new THREE.CylinderGeometry(r,r,delta.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));part(f,m,g,start.add(end).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],label);}
    function shell(f,m,rings,segments=48,pleats=0,label=''){
      const p=[],uv=[],idx=[];for(let j=0;j<rings.length;j++)for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2,[y,rx,rz]=rings[j],fold=1+pleats*Math.cos(a*16)*(1-j/(rings.length*1.8));p.push(Math.sin(a)*rx*fold,y,Math.cos(a)*rz*fold);uv.push(k/segments*(m==='plaid'?2:1),j/(rings.length-1));}for(let j=0;j<rings.length-1;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;idx.push(a,a+1,b,a+1,b+1,b);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();part(f,m,g,[0,0,0],[1,1,1],[0,0,0],label);
    }
    function strand(material,points,widths,depth,label){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),p=[],uv=[],idx=[],steps=20,sides=7;for(let j=0;j<=steps;j++){const t=j/steps,c=curve.getPoint(t),q=t*(widths.length-1),i=Math.min(widths.length-2,Math.floor(q)),w=THREE.MathUtils.lerp(widths[i],widths[i+1],q-i);for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2;p.push(c.x+Math.cos(a)*w,c.y,c.z+Math.sin(a)*depth*(.3+.7*Math.sin(Math.PI*t)));uv.push(k/sides,t);}}for(let j=0;j<steps;j++)for(let k=0;k<sides;k++){const a=j*(sides+1)+k,b=a+sides+1;idx.push(a,a+1,b,a+1,b+1,b);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();part('head',material,g,[0,0,0],[1,1,1],[0,0,0],label);}
    // Rounded doll cheeks and a short, broad chin keep the expression soft.
    const headGeometry=new THREE.SphereGeometry(1,36,28),hp=headGeometry.getAttribute('position');
    for(let i=0;i<hp.count;i++){const y=hp.getY(i),taper=y<-.35?1+(y+.35)*.08:1,chin=y<-.30?-.0528+(y+.30)*.145:y*.176;hp.setXYZ(i,hp.getX(i)*.139*taper,chin,hp.getZ(i)*.127);}headGeometry.computeVertexNormals();part('head','skin',headGeometry,[0,-.008,.012],[1,1,1],[0,0,0],'rounded doll face');
    ball('head','skin',[0,-.033,.141],[.009,.014,.010],'tiny nose',24);for(const side of [-1,1])ball('head','skin',[side*.132,-.026,.004],[.021,.035,.024],'ears',24);
    const faceGeometry=new THREE.PlaneGeometry(.25,.235,26,24),fp=faceGeometry.getAttribute('position');for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i),taper=y<-.044?1+(y/.176+.25)*.24:1;fp.setZ(i,.012+.127*Math.sqrt(Math.max(.02,1-Math.pow(x/(.139*taper),2)-Math.pow((y+.008)/.176,2)))+.001);}faceGeometry.computeVertexNormals();part('head','face',faceGeometry,[0,0,0],[1,1,1],[0,0,0],'blue eyes / lashes / doll expression');
    part('head','hair',new THREE.SphereGeometry(1,32,22,Math.PI,Math.PI,0,Math.PI),[0,.012,-.004],[.149,.193,.143],[0,0,0],'lavender hair crown');
    // The rear shell alone leaves the forehead-side crown open. Close the
    // upper front hemisphere above the brows; the parted locks meet its edge.
    part('head','hair',new THREE.SphereGeometry(1,32,12,0,Math.PI,0,Math.PI*.39),[0,.012,-.004],[.149,.193,.143],[0,0,0],'closed lavender top shell');
    const crownRoot=(x,z)=>[x,.012+.193*Math.sqrt(Math.max(0,1-Math.pow(x/.149,2)-Math.pow((z+.004)/.143,2)))-.008,z];
    for(let i=0;i<15;i++){
      const a=(i/14-.5)*Math.PI,x=Math.sin(a)*.133,z=-Math.cos(a)*.121,wave=Math.sin(i*1.7)*.016;
      strand(i%4===0?'hair sheen':'hair',[crownRoot(x*.88,z*.88),[x*1.15,-.12,z-.02],[x*1.40+wave,-.38,z-.028],[x*1.56-wave,-.64,z+.003],[x*1.64+wave,-.88+(i%3)*.035,z+.045]],[.003,.034,.035,.030,.0015],.018,'long lavender hair');
    }
    for(const side of [-1,1]){
      strand('hair',[crownRoot(side*.118,.020),[side*.160,-.04,.076],[side*.179,-.26,.094],[side*.203,-.49,.116],[side*.224,-.73,.157]],[.003,.029,.027,.026,.001],.017,'outward face framing hair');
      strand('hair sheen',[crownRoot(side*.120,.023),[side*.178,-.14,.089],[side*.195,-.39,.107],[side*.217,-.65,.144]],[.001,.004,.004,.0006],.002,'lavender hair sheen');
    }
    const bangs=[[-.117,-.128,-.149,-.034],[-.081,-.088,-.113,.032],[-.031,-.051,-.081,.057],[.026,.040,.052,.061],[.074,.094,.118,.034],[.119,.139,.156,-.032]];
    bangs.forEach(([x,m,end,y],i)=>strand(i%3===1?'hair sheen':'hair',[crownRoot(x*.85,.025),[x*.95,.145-Math.abs(x)*.33,.103],[m,.086+(i%2)*.006,.145],[end,y,.144]],[.003,.030,.024,.0006],.008,'parted lavender fringe'));
    // The covered uniform is reconstructed upright: short puff sleeves, a
    // modest collar, a tartan butterfly bow and a full knee-length skirt.
    shell('body','skin',[[1.32,.132,.094],[1.37,.083,.069],[1.48,.065,.061]],32,0,'neck');
    shell('body','white cloth',[[.88,.148,.107],[1.00,.151,.113],[1.14,.181,.132],[1.26,.202,.137],[1.33,.184,.114],[1.365,.111,.078]],48,.009,'white short sleeve blouse');
    for(const side of [-1,1]){
      const shape=new THREE.Shape();shape.moveTo(side*.008,.054);shape.lineTo(side*.062,.087);shape.quadraticCurveTo(side*.108,.065,side*.111,.021);shape.lineTo(side*.055,-.023);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:.007,bevelEnabled:true,bevelSize:.0015,bevelThickness:.001,bevelSegments:2,steps:1});part('body','white cloth',g,[0,1.310,.121],[1,1,1],[0,0,0],'rounded blouse collar');
    }
    for(const y of [.99,1.09,1.19])ball('body','white cloth',[0,y,.139],[.0045,.0045,.0025],'small blouse buttons',14);
    // Each bow lobe has convex depth and its own UVs, sharing the skirt's
    // navy/red/green/white weave instead of becoming a dark flat rectangle.
    for(const side of [-1,1]){
      const shape=new THREE.Shape();shape.moveTo(side*.012,.007);shape.quadraticCurveTo(side*.054,.047,side*.110,.038);shape.quadraticCurveTo(side*.089,-.006,side*.105,-.031);shape.quadraticCurveTo(side*.055,-.047,side*.012,-.012);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:3,curveSegments:16,steps:1}),uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*2,uv.getY(i)*2);part('body','plaid',g,[0,1.315,.151],[1,1,1],[0,side*.10,side*.05],'plaid bow ribbon');
      rod('body','plaid',[side*.021,1.303,.165],[side*.061,1.252,.156],.009,'bow ribbon tails');
    }
    ball('body','plaid',[0,1.313,.174],[.018,.024,.013],'bow central knot',24);
    shell('body','plaid',[[.45,.317,.289],[.47,.321,.292],[.60,.293,.263],[.75,.229,.198],[.86,.174,.134],[.92,.149,.107]],96,.044,'knee-length plaid pleated skirt');
    shell('body','plaid',[[.893,.154,.113],[.922,.152,.110],[.939,.151,.110]],64,0,'plaid skirt waistband');
    shell('body','team',[[.925,.154,.114],[.940,.153,.113]],48,0,'team waist ribbon');
    for(let i=0;i<48;i++){const a=i/48*Math.PI*2;rod('body','white cloth',[Math.sin(a)*.317,.466,Math.cos(a)*.289],[Math.sin(a)*.316,.474,Math.cos(a)*.288],.0007,'fine skirt hem stitching');}
    for(const side of ['R','L']){
      part('arm'+side,'skin',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.65,1,.65],[0,0,0],'bare upper arms');
      part('arm'+side,'white cloth',new THREE.CapsuleGeometry(1,2,4,18),[0,-.85,0],[.94,1,.94],[0,0,0],'short puff sleeves');
      shell('arm'+side,'white cloth',[[.62,.93,.93],[.82,1.0,1.0],[1.01,.93,.93]],24,.035,'gathered sleeve edge');
      part('fore'+side,'skin',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.69,1,.69],[0,0,0],'bare forearms');
      ball('hand'+side,'skin',[0,0,0],[.037,.034,.054],'bare hands',24);
      for(let i=0;i<4;i++){ball('hand'+side,'skin',[-.026+i*.017,-.017,.027],[.008,.014,.026],'fingers',14);ball('hand'+side,'skin',[-.026+i*.017,-.025,.043],[.0075,.010,.016],'fingertips',12);}ball('hand'+side,'skin',[.031,.001,.018],[.012,.021,.025],'thumb',18);
      part('thigh'+side,'skin',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.60,1,.60],[0,0,0],'legs');part('shin'+side,'skin',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.58,1,.58],[0,0,0],'calves');
      part('shin'+side,'white cloth',new THREE.CapsuleGeometry(1,1,4,16),[0,1.80,0],[.62,1,.62],[0,0,0],'white socks');ball('shoe'+side,'white cloth',[0,-.013,-.005],[.048,.064,.051],'sock ankles',24);
      ball('shoe'+side,'shoe',[0,-.088,.035],[.065,.036,.126],'dark flat shoes',28);ball('shoe'+side,'sole',[0,-.111,.037],[.066,.012,.127],'dark shoe soles',24);rod('shoe'+side,'shoe',[-.045,-.048,.046],[.045,-.048,.046],.004,'flat shoe strap');
    }
    for(const chunk of chunks.values()){
      const p=[],n=[],uv=[];for(const g of chunk.parts){const a=g.getAttribute('position'),b=g.getAttribute('normal'),c=g.getAttribute('uv');for(let i=0;i<a.count;i++){p.push(a.getX(i),a.getY(i),a.getZ(i));n.push(b.getX(i),b.getY(i),b.getZ(i));uv.push(c?c.getX(i):0,c?c.getY(i):0);}g.dispose();}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      if(chunk.frame==='body'&&(chunk.material==='plaid'||chunk.material==='white cloth')){
        const posed=g.clone(),positions=posed.getAttribute('position');for(let i=0;i<positions.count;i++){const y=positions.getY(i),z=positions.getZ(i);if(y>=.45&&y<.88){const t=THREE.MathUtils.clamp((.88-y)/.43,0,1),fold=t*t*(3-2*t),front=THREE.MathUtils.smoothstep(z,-.04,.12);positions.setZ(i,z+.11*fold*front);}}posed.computeVertexNormals();g.morphAttributes.position=[positions.clone()];g.morphAttributes.normal=[posed.getAttribute('normal').clone()];posed.dispose();
      }
      g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);templates.push({frame:chunk.frame,material:chunk.material,geometry:g,label:chunk.label});
    }
    cache={references:0,geometries,materials,textures,templates};caches.set(THREE,cache);
  }
  cache.references++;let released=false;return {cache,release(){if(released)return;released=true;if(--cache.references===0){for(const g of cache.geometries)g.dispose();for(const m of cache.materials.values())m.dispose();for(const t of cache.textures)t.dispose();caches.delete(THREE);}}};
}

export function createOnoAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group(),frames=new Map();group.name='Ono avatar / 尾野';rig.add(group);
  const sources={body:upper,head,armR:rightArm.upperArm,armL:leftArm.upperArm,foreR:rightArm.forearm,foreL:leftArm.forearm,handR:rightArm.palm,handL:leftArm.palm,thighR:rightLeg.thigh,thighL:leftLeg.thigh,shinR:rightLeg.shin,shinL:leftLeg.shin,shoeR:rightLeg.boot,shoeL:leftLeg.boot};
  for(const template of cache.templates){if(!frames.has(template.frame)){const frame=new THREE.Group();frame.name=`Ono avatar frame / ${template.frame}`;frame.matrixAutoUpdate=false;group.add(frame);frames.set(template.frame,frame);}const material=cache.materials.get(template.material==='team'?(team==='blue'?'team blue':'team red'):template.material),mesh=new THREE.Mesh(template.geometry,material);mesh.name=`Ono avatar / ${template.label}`;mesh.userData.character='frost';mesh.userData.solid=false;mesh.raycast=()=>{};mesh.castShadow=template.material!=='face';mesh.receiveShadow=true;frames.get(template.frame).add(mesh);}
  let disposed=false;
  function update(interaction=0){if(disposed)return;upper.updateMatrix();head.updateMatrix();for(const [name,frame]of frames){const source=sources[name];source.updateMatrix();if(name==='head')frame.matrix.multiplyMatrices(upper.matrix,source.matrix);else frame.matrix.copy(source.matrix);frame.matrixWorldNeedsUpdate=true;for(const mesh of frame.children)if(mesh.morphTargetInfluences)mesh.morphTargetInfluences[0]=THREE.MathUtils.clamp(interaction,0,1);}}
  function setVisible(value){group.visible=Boolean(value);}
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();release();}
  update();return {group,roots:frames,update,setVisible,dispose};
}
