// The workshop character is a visible skin only. The original tactical rig
// supplies every weapon grip, animation joint and authoritative hit surface.
const caches=new WeakMap();

function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    const geometries=new Set(),materials=new Map(),textures=new Set(),templates=[],chunks=new Map(),transform=new THREE.Object3D();
    const finish=(id,roughness=.8,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color:'#ffffff',roughness,metalness,vertexColors:true});m.name=`Solder avatar finish / ${id}`;materials.set(id,m);return m;};
    finish('skin',.84);finish('fabric',.94);finish('hair',.47);finish('dark',.78);finish('metal',.38,.55);finish('board',.79);finish('copper',.4,.35);finish('shoe',.81);finish('eye',.58);finish('lips',.84);
    const lens=new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.3,metalness:0,transparent:false,opacity:1,depthWrite:true,clearcoat:.45,clearcoatRoughness:.2,side:THREE.DoubleSide});lens.name='Solder avatar finish / opaque white lens';materials.set('lens',lens);
    const teamBlue=new THREE.MeshStandardMaterial({color:'#62adb8',roughness:.75}),teamRed=new THREE.MeshStandardMaterial({color:'#c77870',roughness:.75});teamBlue.name='Solder avatar finish / team blue';teamRed.name='Solder avatar finish / team red';materials.set('teamBlue',teamBlue);materials.set('teamRed',teamRed);
    const size=128,data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,v=232+((x*13+y*41+x*y*5)%11)-5+((x%4<2)!==(y%4<2)?2:-2);data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
    const twill=new THREE.DataTexture(data,size,size);twill.name='Solder avatar surface / fine workwear twill';twill.wrapS=twill.wrapT=THREE.RepeatWrapping;twill.repeat.set(4,4);twill.magFilter=THREE.LinearFilter;twill.minFilter=THREE.LinearMipmapLinearFilter;twill.generateMipmaps=true;twill.anisotropy=8;twill.needsUpdate=true;textures.add(twill);materials.get('fabric').bumpMap=twill;materials.get('fabric').bumpScale=.00042;
    function part(frame,material,geometry,color='#ffffff',p=[0,0,0],s=[1,1,1],r=[0,0,0],label='',semantic=''){
      transform.position.set(...p);transform.scale.set(...s);transform.rotation.set(r[0]||0,r[1]||0,r[2]||0);transform.updateMatrix();
      const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);geometry.dispose();
      const base=new THREE.Color(color),c=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<c.length;i+=3){c[i]=base.r;c[i+1]=base.g;c[i+2]=base.b;}g.setAttribute('color',new THREE.BufferAttribute(c,3));
      const key=`${frame}|${material}|${semantic}`;if(!chunks.has(key))chunks.set(key,{frame,material,label,parts:[]});const chunk=chunks.get(key);if(label&&!chunk.label.includes(label))chunk.label+=(chunk.label?' / ':'')+label;chunk.parts.push(g);
    }
    const ball=(f,m,p,s,c,label='',seg=24)=>part(f,m,new THREE.SphereGeometry(1,seg,Math.max(8,Math.floor(seg*.7))),c,p,s,[0,0,0],label);
    function rod(f,m,a,b,r,c,label='',segments=10){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),g=new THREE.CylinderGeometry(r,r,delta.length(),segments);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));part(f,m,g,c,start.add(end).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],label);}
    function panel(f,m,points,depth,color,p,label,bevel=.003){const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel*.5,bevelSegments:2,steps:1,curveSegments:12});g.translate(0,0,-depth/2);part(f,m,g,color,p,[1,1,1],[0,0,0],label);}
    function patch(f,m,points,color,label){const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new THREE.ShapeGeometry(shape,16);const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setZ(i,.158+(1-Math.min(1,Math.abs(pos.getX(i))/.16))*.012);g.computeVertexNormals();part(f,m,g,color,[0,0,0],[1,1,1],[0,0,0],label);}
    function shell(f,m,rings,color,label,segments=40){const p=[],uv=[],idx=[];for(let j=0;j<rings.length;j++)for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2,[y,rx,rz,z=0]=rings[j];p.push(Math.sin(a)*rx,y,Math.cos(a)*rz+z);uv.push(k/segments,j/(rings.length-1));}for(let j=0;j<rings.length-1;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;idx.push(a,a+1,b,a+1,b+1,b);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();part(f,m,g,color,[0,0,0],[1,1,1],[0,0,0],label);}
    const skin='#d8ad69',skinShadow='#b58b51',blue='#8faac5',blueLight='#abc1d1',blueShade='#718ca9',pants='#3e4448';
    // A broad forehead, grounded jaw and separate nose/ears give the face real
    // volume beneath the opaque white safety shield instead of a helmet shell.
    const face=new THREE.SphereGeometry(1,40,30),fp=face.getAttribute('position');
    for(let i=0;i<fp.count;i++){const y=fp.getY(i),jaw=y<-.30?1+(y+.30)*.18:1;fp.setXYZ(i,fp.getX(i)*.137*jaw,y*.181-.012,fp.getZ(i)*.126+.003);}face.computeVertexNormals();part('head','skin',face,skin,[0,0,0],[1,1,1],[0,0,0],'tanned face');
    for(const side of [-1,1]){ball('head','skin',[side*.132,-.034,-.004],[.025,.043,.029],skin,'ears',24);ball('head','skin',[side*.145,-.034,.015],[.009,.025,.010],skinShadow,'ear folds',20);}
    ball('head','skin',[0,-.039,.127],[.020,.042,.026],skin,'nose bridge',28);ball('head','skin',[0,-.068,.148],[.023,.016,.018],skin,'nose tip',24);
    for(const side of [-1,1])ball('head','lips',[side*.014,-.075,.149],[.007,.0038,.0035],'#9b784e','nostrils',16);
    rod('head','lips',[-.034,-.111,.108],[0,-.107,.123],.0025,'#8c6945','quiet mouth');rod('head','lips',[0,-.107,.123],[.032,-.112,.109],.0025,'#8c6945','quiet mouth');ball('head','skin',[0,-.145,.074],[.049,.020,.022],skin,'rounded chin',24);
    for(const side of [-1,1]){
      ball('head','eye',[side*.054,.017,.118],[.031,.011,.012],'#eee5cc','eyes / eyebrows',24);
      ball('head','dark',[side*.053,.017,.130],[.007,.009,.0035],'#302f28','eyes / eyebrows',20);
      rod('head','dark',[side*.027,.055,.123],[side*.082,.054,.104],.0045,'#343229','eyes / eyebrows');
      rod('head','skin',[side*.028,.032,.128],[side*.080,.030,.112],.0026,skinShadow,'upper eyelids');
    }
    // Short, swept-back hair with an intentional forehead line and subtle
    // coarse locks. The rear cap continues down behind both goggle straps.
    const hp=[],huv=[],hi=[],rows=12,segments=48;
    for(let j=0;j<=rows;j++)for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2,t=j/rows,front=Math.max(0,Math.cos(a)),bottom=.014+front*.082,r=Math.sin(t*Math.PI/2);hp.push(Math.sin(a)*.142*r,bottom+(.199-bottom)*Math.cos(t*Math.PI/2),Math.cos(a)*.130*r-.009);huv.push(k/segments,t);}
    for(let j=0;j<rows;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;hi.push(a,b,a+1,a+1,b,b+1);}const hair=new THREE.BufferGeometry();hair.setAttribute('position',new THREE.Float32BufferAttribute(hp,3));hair.setAttribute('uv',new THREE.Float32BufferAttribute(huv,2));hair.setIndex(hi);hair.computeVertexNormals();part('head','hair',hair,'#272a28',[0,0,0],[1,1,1],[0,0,0],'short black hair');
    for(let i=-4;i<=4;i++){
      const x=i*.023,points=[];
      for(let j=0;j<=24;j++){
        const z=.085-j/24*.166,rx=x/.142,rz=(z+.009)/.130,q=Math.min(1,Math.hypot(rx,rz));
        const front=q?Math.max(0,rz/q):0,bottom=.014+front*.082;
        points.push(new THREE.Vector3(x,bottom+(.199-bottom)*Math.sqrt(Math.max(0,1-q*q))-.0018,z));
      }
      const curve=new THREE.CatmullRomCurve3(points);
      part('head','hair',new THREE.TubeGeometry(curve,32,.0020,5,false),i%2?'#333732':'#2e322d',[0,0,0],[1,1,1],[0,0,0],'swept hair locks');
    }
    // The shield is broad, with a raised bridge cutout, padded perimeter,
    // elastic temples, screws and faint local reflections on the lens.
    const outline=[[-.147,.062],[-.135,.078],[-.075,.079],[.075,.079],[.145,.066],[.151,.042],[.128,-.028],[.111,-.049],[.075,-.059],[.036,-.052],[.017,-.028],[.012,-.010],[-.004,-.010],[-.016,-.030],[-.035,-.050],[-.078,-.056],[-.111,-.043],[-.132,-.018]];
    patch('head','lens',outline,'#ffffff','opaque white safety goggles');
    for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],az=.158+(1-Math.min(1,Math.abs(a[0])/.16))*.012,bz=.158+(1-Math.min(1,Math.abs(b[0])/.16))*.012;rod('head','metal',[a[0],a[1],az],[b[0],b[1],bz],.0054,'#ffffff','goggle frame',12);}
    for(const side of [-1,1]){
      rod('head','dark',[side*.143,.047,.144],[side*.154,.047,-.035],.009,'#ffffff','goggle elastic strap');rod('head','dark',[side*.154,.047,-.035],[side*.120,.044,-.104],.009,'#ffffff','goggle elastic strap');
      ball('head','metal',[side*.145,.047,.147],[.010,.014,.006],'#ffffff','goggle hinge screws',18);ball('head','dark',[side*.145,.048,.154],[.003,.006,.001],'#ffffff','goggle screw slots',12);
      rod('head','eye',[side*.078,.056,.169],[side*.114,.043,.164],.0013,'#ffffff','lens local reflection');
    }
    shell('body','skin',[[1.345,.097,.083],[1.445,.066,.064],[1.49,.063,.062]],skin,'neck');
    shell('body','fabric',[[.79,.155,.128],[.85,.176,.139],[1.04,.194,.148],[1.20,.211,.149],[1.31,.220,.129],[1.36,.177,.109],[1.398,.101,.079]],blue,'blue button work shirt');
    shell('body','fabric',[[.755,.168,.13],[.805,.177,.139],[.858,.176,.137]],pants,'dark work trousers / waistband');
    // The open collar, placket, double-sewn pockets and small real buttons are
    // layered above the shirt surface, rather than painted onto a flat torso.
    for(const side of [-1,1]){
      panel('body','fabric',[[side*.006,.063],[side*.065,.096],[side*.113,.046],[side*.066,-.021]].map(([x,y])=>[x,y]),.010,blueLight,[0,1.307,.105],'shirt collar',.002);
      rod('body','fabric',[side*.041,1.338,.132],[side*.078,1.292,.145],.0018,blueShade,'collar stitching');
    }
    panel('body','fabric',[[-.017,-.199],[.017,-.199],[.017,.199],[-.017,.199]],.009,blueLight,[0,1.085,.150],'button placket',.002);
    for(const y of [.918,1.020,1.122,1.224,1.316]){ball('body','dark',[0,y,.160],[.008,.008,.004],'#45525e','shirt buttons',18);rod('body','eye',[-.002,y,.164],[.002,y,.164],.0008,'#aebec7','button thread');}
    panel('body','fabric',[[-.050,-.060],[.045,-.060],[.054,-.040],[.054,.060],[-.054,.060]],.012,blueShade,[-.109,1.168,.151],'chest pocket',.002);
    rod('body','fabric',[-.161,1.218,.165],[-.055,1.218,.165],.0022,blueLight,'pocket rolled seam');
    for(const side of [-1,1])rod('body','fabric',[side*.173,.879,.09],[side*.203,1.247,.079],.0016,blueLight,'shirt side seams');
    // A small circuit board remains legible as work equipment, even while both
    // hands hold the gun. Traces, pads and a chip sit on actual green laminate.
    panel('body','board',[[-.036,-.041],[.036,-.041],[.036,.058],[-.036,.058]],.005,'#326c53',[-.107,1.239,.157],'green circuit board',.001);
    panel('body','dark',[[-.011,-.015],[.011,-.015],[.011,.015],[-.011,.015]],.004,'#404b45',[-.107,1.246,.163],'circuit board controller',.001);
    for(let i=0;i<4;i++){
      const x=-.132+i*.016;rod('body','copper',[x,1.277,.164],[x,1.265,.164],.0010,'#b6bf84','copper traces');rod('body','copper',[x,1.265,.164],[-.107,1.252+i*.002,.164],.0010,'#b6bf84','copper traces');
      ball('body','copper',[x,1.284,.164],[.003,.003,.0014],'#c6c5a2','circuit contact pads',12);
    }
    shell('body','dark',[[.854,.182,.144],[.881,.183,.145]],'#4c4a3c','work belt');
    panel('body','metal',[[-.029,-.015],[.029,-.015],[.029,.015],[-.029,.015]],.010,'#8a9190',[0,.868,.151],'belt buckle',.003);
    // Soldering iron is safely holstered at the hip: a ribbed grip, collar,
    // steel shaft and copper tip, all independent of the game's gun/hand IK.
    const ix=.207,iz=-.025;
    panel('body','dark',[[-.029,-.110],[.029,-.110],[.034,.072],[-.031,.072]],.065,'#48483c',[ix,.930,iz],'belt heat guard holster',.004);
    rod('body','dark',[ix,.916,iz+.009],[ix,1.087,iz+.009],.018,'#4b5454','belt soldering iron grip');
    for(let i=0;i<7;i++)part('body','dark',new THREE.TorusGeometry(.0185,.0021,6,20),'#62685e',[ix,.949+i*.016,iz+.009],[1,1,1],[Math.PI/2,0,0],'iron grip ribs');
    rod('body','metal',[ix,.902,iz+.009],[ix,.927,iz+.009],.019,'#a9b0a9','soldering iron collar');rod('body','metal',[ix,.818,iz+.009],[ix,.903,iz+.009],.006,'#aab1b0','soldering iron shaft');rod('body','copper',[ix,.799,iz+.009],[ix,.818,iz+.009],.0032,'#bc966b','copper soldering tip');
    const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(ix,1.088,iz+.009),new THREE.Vector3(.260,1.108,-.012),new THREE.Vector3(.269,.944,-.041),new THREE.Vector3(.207,.903,-.040)]);part('body','dark',new THREE.TubeGeometry(cable,24,.003,7,false),'#343d3b',[0,0,0],[1,1,1],[0,0,0],'looped iron cable');
    shell('body','team',[[1.248,.216,.151],[1.266,.217,.149]],'#ffffff','team chest band');
    for(const side of ['R','L']){
      part('arm'+side,'fabric',new THREE.CapsuleGeometry(1,4,5,18),blue,[0,0,0],[.97,1,.97],[0,0,0],'rolled blue sleeves');
      // A folded cuff belongs to the lower end of the upper-arm segment.
      shell('arm'+side,'fabric',[[2.33,.98,.98],[2.63,1.01,1.01],[2.91,.91,.91]],blueLight,'rolled sleeve cuff',24);
      part('fore'+side,'skin',new THREE.CapsuleGeometry(1,4,5,18),skin,[0,0,0],[.82,1,.82],[0,0,0],'bare forearms');
      ball('hand'+side,'skin',[0,0,.002],[.041,.038,.059],skin,'bare working hands',24);
      for(let i=0;i<4;i++){ball('hand'+side,'skin',[-.027+i*.018,-.018,.028],[.009,.015,.028],skin,'fingers',16);ball('hand'+side,'skin',[-.027+i*.018,-.026,.045],[.008,.011,.017],skin,'fingertips',14);}
      ball('hand'+side,'skin',[.035,.002,.017],[.015,.024,.029],skin,'thumb',20);
      part('thigh'+side,'fabric',new THREE.CapsuleGeometry(1,4,5,18),pants,[0,0,0],[.91,1,.91],[0,0,0],'dark trouser legs');
      part('shin'+side,'fabric',new THREE.CapsuleGeometry(1,4,5,18),pants,[0,0,0],[.92,1,.92],[0,0,0],'trouser cuffs');
      ball('shoe'+side,'shoe',[0,-.058,.034],[.080,.073,.138],'#514a3b','work shoes',28);
      ball('shoe'+side,'shoe',[0,-.106,.034],[.081,.018,.139],'#333b37','rubber soles',24);
      for(let i=0;i<3;i++)rod('shoe'+side,'shoe',[-.040,-.002+i*.015,.077-i*.008],[.040,-.002+i*.015,.077-i*.008],.0023,'#9d9581','work shoe laces');
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
