// The summer avatar is a separate visible skin. The tactical rig remains the
// authoritative hit proxy, including its unchanged head and weapon attachments.
const caches = new WeakMap();

function acquireAssets(THREE) {
  let cache = caches.get(THREE);
  if (!cache) {
    const materials = new Map(), geometries = new Set(), textures = new Set(), templates = [];
    const finish = (id, color, roughness = .8, metalness = 0) => {
      const m = new THREE.MeshStandardMaterial({color,roughness,metalness});
      m.name = `Sunflower finish / ${id}`;materials.set(id,m);return m;
    };
    finish('skin','#f2c5b0',.83);finish('hair','#191720',.4,.02);finish('hairLight','#35303d',.47,.02);
    finish('cloth','#f4f0df',.92);finish('lace','#fff9e8',.86);finish('straw','#e2c78b',.9);
    finish('ribbon','#64504d',.83);finish('gold','#d6ac4c',.38,.5);finish('petal','#f4bf45',.75);
    finish('seed','#79513a',.92);finish('leaf','#71895a',.9);finish('shoe','#d5c5b3',.85);
    finish('teamBlue','#529aa4',.7);finish('teamRed','#b76e6a',.7);
    const texture = (name,size,paint) => {
      const data=new Uint8Array(size*size*4);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++)paint(data,(y*size+x)*4,x,y,size);
      const t=new THREE.DataTexture(data,size,size);t.name=`Sunflower surface / ${name}`;
      t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;
      t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;textures.add(t);return t;
    };
    const cloth=texture('linen',128,(d,i,x,y)=>{const g=((x*31+y*47+x*y*3)%13)-6,v=236+g*.35+((x%4<2)!==(y%4<2)?2:-2);d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;});
    cloth.wrapS=cloth.wrapT=THREE.RepeatWrapping;cloth.repeat.set(3,3);
    materials.get('cloth').bumpMap=cloth;materials.get('cloth').bumpScale=.00045;
    const straw=texture('woven straw',256,(d,i,x,y)=>{
      const strand=(Math.sin(x*Math.PI/4)+Math.sin(y*Math.PI/5))*.5;
      const v=225+strand*9+(((Math.floor(x/8)+Math.floor(y/10))%2)?4:-4);
      d[i]=v;d[i+1]=v;d[i+2]=v;d[i+3]=255;
    });
    straw.wrapS=straw.wrapT=THREE.RepeatWrapping;straw.repeat.set(4,3);
    materials.get('straw').map=straw;materials.get('straw').bumpMap=straw;materials.get('straw').bumpScale=.0008;
    // Analytic face painting is deliberately asymmetric and local: warm irises,
    // upper lashes, tiny catchlights and a soft closed smile, without a flat card.
    const face=texture('golden eyes and expression',512,(d,i,px,py,n)=>{
      const x=(px/(n-1)-.5)*.25,y=(py/(n-1)-.5)*.235;
      let c=[0,0,0],a=0;
      const ink=(color,alpha=1)=>{c=color;a=alpha;};
      for(const side of[-1,1]){
        const cx=side*.056,dx=(x-cx)/.045,ey=y-.014;
        const almond=Math.sqrt(Math.max(0,1-dx*dx)),top=.027*almond+.003*side*dx,bottom=-.019*almond;
        if(Math.abs(dx)<1&&ey<top&&ey>bottom){
          ink([253,242,226]);
          const r=Math.hypot((x-cx)/.0215,(ey-.001)/.025),angle=Math.atan2(ey-.001,x-cx);
          if(r<1){const fiber=(Math.sin(angle*27+r*11)*.5+.5)*15;ink(r>.88?[85,53,32]:[184+fiber+(1-r)*35,119+fiber+(1-r)*46,39+fiber*.3]);}
          if(Math.pow((x-cx)/.007,2)+Math.pow((ey-.003)/.019,2)<1)ink([43,30,31]);
          if(Math.hypot((x-cx+.007)/.006,(ey-.012)/.007)<1)ink([255,254,233]);
          if(Math.hypot((x-cx-.007)/.0029,(ey+.009)/.0034)<1)ink([255,217,112]);
        }
        if(Math.abs(dx)<1.05&&Math.abs(ey-top)<.0035&&Math.abs(dx)<1)ink([48,32,37]);
        const outer=side*(x-cx);
        if(outer>.035&&outer<.051&&Math.abs(ey-(.012+(outer-.035)*.52))<.0022)ink([48,32,37]);
        const bx=(x-cx)/.038;
        if(Math.abs(bx)<1&&Math.abs(y-(.061+.005*Math.cos(bx*1.7)-side*bx*.004))<.0022)ink([66,43,43],.9);
        const blush=Math.exp(-Math.pow((x-side*.079)/.025,2)-Math.pow((y+.035)/.014,2));
        if(a===0&&blush>.04)ink([227,133,128],blush*.24);
      }
      if(Math.abs(x)<.022&&Math.abs(y-(-.071+.007*Math.pow(x/.022,2)))<.0018)ink([155,91,89],.92);
      if(Math.abs(x)<.011&&Math.abs(y+.076)<.0012)ink([236,158,149],.65);
      d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=Math.round(a*255);
    });
    const faceMat=new THREE.MeshStandardMaterial({map:face,transparent:true,depthWrite:false,roughness:.88,polygonOffset:true,polygonOffsetFactor:-1});
    faceMat.name='Sunflower finish / face painting';materials.set('face',faceMat);
    const chunks=new Map(),object=new THREE.Object3D();
    function part(frame,material,geometry,p=[0,0,0],s=[1,1,1],r=[0,0,0],label=''){
      object.position.set(...p);object.scale.set(...s);object.rotation.set(r[0]||0,r[1]||0,r[2]||0);object.updateMatrix();
      const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(object.matrix);geometry.dispose();
      const key=frame+'|'+material;if(!chunks.has(key))chunks.set(key,{frame,material,label,parts:[]});
      const chunk=chunks.get(key);if(label&&!chunk.label.includes(label))chunk.label+=(chunk.label?' / ':'')+label;chunk.parts.push(g);
    }
    const sphere=(f,m,p,s,label='',r=[0,0,0],seg=20)=>part(f,m,new THREE.SphereGeometry(1,seg,Math.max(4,Math.floor(seg*.65))),p,s,r,label);
    const rod=(f,m,a,b,r,label='')=>{
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
      const g=new THREE.CylinderGeometry(r,r,delta.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
      part(f,m,g,start.add(end).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],label);
    };
    function lathe(frame,material,rings,segments=48,pleats=0,label=''){
      const p=[],uv=[],indices=[];
      for(let j=0;j<rings.length;j++){const [y,rx,rz]=rings[j];for(let k=0;k<=segments;k++){
        const a=k/segments*Math.PI*2,fold=1+pleats*Math.cos(a*12)*(1-j/(rings.length*1.8));
        p.push(Math.sin(a)*rx*fold,y,Math.cos(a)*rz*fold);uv.push(k/segments,j/(rings.length-1));
      }}
      for(let j=0;j<rings.length-1;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();part(frame,material,g,[0,0,0],[1,1,1],[0,0,0],label);
    }
    function strand(frame,material,points,widths,depth=.009,label=''){
      const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),p=[],uv=[],idx=[],steps=16,sides=6;
      for(let j=0;j<=steps;j++){const t=j/steps,c=curve.getPoint(t),v=t*(widths.length-1),q=Math.min(widths.length-2,Math.floor(v)),w=THREE.MathUtils.lerp(widths[q],widths[q+1],v-q);
        for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2;p.push(c.x+Math.cos(a)*w,c.y,c.z+Math.sin(a)*depth*(.35+.65*Math.sin(Math.PI*t)));uv.push(k/sides,t);}}
      for(let j=0;j<steps;j++)for(let k=0;k<sides;k++){const a=j*(sides+1)+k,b=a+sides+1;idx.push(a,a+1,b,a+1,b+1,b);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();part(frame,material,g,[0,0,0],[1,1,1],[0,0,0],label);
    }
    // Soft cheek planes and a tapered lower jaw are part of the 3D face, not the old helmet.
    const headGeo=new THREE.SphereGeometry(1,32,24),hp=headGeo.getAttribute('position');
    for(let i=0;i<hp.count;i++){
      const y=hp.getY(i),taper=y<-.4?1+(y+.4)*.08:1,chin=y<-.3?-.0528+(y+.3)*.145:y*.176;
      hp.setXYZ(i,hp.getX(i)*.137*taper,chin,hp.getZ(i)*.126);
    }
    headGeo.computeVertexNormals();part('head','skin',headGeo,[0,-.008,.013],[1,1,1],[0,0,0],'face');
    sphere('head','skin',[0,-.031,.139],[.010,.017,.012],'small nose');
    for(const side of[-1,1])sphere('head','skin',[side*.13,-.028,.008],[.023,.039,.024],'ears');
    const faceGeo=new THREE.PlaneGeometry(.25,.235,24,22),fp=faceGeo.getAttribute('position');
    for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i),taper=y<-.044?1+(y/.176+.25)*.24:1;fp.setZ(i,.013+.126*Math.sqrt(Math.max(.02,1-Math.pow(x/(.137*taper),2)-Math.pow((y+.008)/.176,2)))+.001);}
    faceGeo.computeVertexNormals();part('head','face',faceGeo,[0,0,0],[1,1,1],[0,0,0],'gold eyes / eyelashes / smile');
    // A rear shell closes the parting while independent long locks provide real gaps.
    part('head','hair',new THREE.SphereGeometry(1,28,18,Math.PI,Math.PI,0,Math.PI),[0,.012,-.003],[.148,.191,.142],[0,0,0],'black hair crown');
    for(let i=0;i<13;i++){
      const a=(i/12-.5)*Math.PI,x=Math.sin(a)*.132,z=-Math.cos(a)*.12;
      strand('head',i%4===0?'hairLight':'hair',[[x,.105,z],[x*1.17,-.12,z-.02],[x*1.35,-.34,z-.017],[x*1.4+Math.sin(i*2)*.025,-.59+(i%3)*.035,z+.017]],[.031,.037,.031,.002],.016,'long black hair');
    }
    for(const side of[-1,1]){
      strand('head','hair',[[side*.128,.12,.076],[side*.157,-.055,.07],[side*.173,-.24,.075],[side*.177,-.47,.12],[side*.215,-.61,.13]],[.028,.028,.025,.020,.001],.017,'face-framing locks');
      strand('head','hairLight',[[side*.145,.08,.08],[side*.176,-.10,.076],[side*.181,-.3,.09],[side*.202,-.5,.122]],[.004,.005,.004,.0005],.002,'hair sheen');
    }
    const bangs=[[-.113,-.115,-.140,-.045],[-.073,-.083,-.107,.028],[-.025,-.043,-.071,.053],[.022,.035,.045,.055],[.066,.089,.110,.027],[.111,.137,.150,-.040]];
    bangs.forEach(([a,b,c,y],i)=>strand('head',i%3===1?'hairLight':'hair',[[a,.135,.075],[a*.94,.112,.124],[b,.079+(i%2)*.007,.145],[c,y,.143]],[.026,.032,.025,.0005],.009,'parted fringe'));
    // Wavy, thick brim and a rounded woven crown, with a contrasting grosgrain ribbon.
    const brimP=[],brimUV=[],brimI=[],brimSegments=80,brimRings=5;
    for(let j=0;j<=brimRings;j++)for(let k=0;k<=brimSegments;k++){
      const a=k/brimSegments*Math.PI*2,t=j/brimRings,rx=.122+t*.207,rz=.119+t*.169;
      brimP.push(Math.sin(a)*rx,.154-t*.037+Math.cos(a*3+.5)*.012*t+Math.sin(a)*.017*t,Math.cos(a)*rz);
      brimUV.push(k/brimSegments,t);
    }
    for(let j=0;j<brimRings;j++)for(let k=0;k<brimSegments;k++){const a=j*(brimSegments+1)+k,b=a+brimSegments+1;brimI.push(a,b,a+1,a+1,b,b+1);}
    materials.get('straw').side=THREE.DoubleSide;
    const brim=new THREE.BufferGeometry();brim.setAttribute('position',new THREE.Float32BufferAttribute(brimP,3));brim.setAttribute('uv',new THREE.Float32BufferAttribute(brimUV,2));brim.setIndex(brimI);brim.computeVertexNormals();part('head','straw',brim,[0,0,0],[1,1,1],[0,0,0],'woven straw hat brim');
    lathe('head','straw',[[.15,.132,.126],[.18,.134,.126],[.222,.131,.123],[.258,.123,.115],[.285,.106,.100],[.305,.081,.076],[.318,.052,.049],[.324,.025,.023],[.326,0,0]],80,0,'hat crown');
    lathe('head','ribbon',[[.158,.135,.13],[.19,.136,.13],[.198,.134,.129]],48,0,'brown hat ribbon');
    for(let i=0;i<72;i++){const a=i/72*Math.PI*2,b=(i+1)/72*Math.PI*2;rod('head','lace',[Math.sin(a)*.33,.119+Math.cos(a*3+.5)*.012+Math.sin(a)*.017,Math.cos(a)*.29],[Math.sin(b)*.33,.119+Math.cos(b*3+.5)*.012+Math.sin(b)*.017,Math.cos(b)*.29],.002,'bound brim edge');}
    // Three rows of hand-shaped petals and textured seeds make the pin readable close up.
    const flower=new THREE.Vector3(-.213,.192,.142);
    for(let layer=0;layer<2;layer++)for(let i=0;i<13;i++){
      const a=(i/13+layer/26)*Math.PI*2,r=.046+layer*.006;
      sphere('head','petal',[flower.x+Math.sin(a)*r,flower.y+Math.cos(a)*r,flower.z+layer*.004],[.012,.035-layer*.005,.006],'sunflower petals',[0,0,-a],10);
    }
    sphere('head','seed',flower.toArray(),[.031,.031,.012],'sunflower pin centre',[],16);
    for(let i=0;i<45;i++){const a=i*2.399,r=.026*Math.sqrt(i/45);sphere('head','gold',[flower.x+Math.sin(a)*r,flower.y+Math.cos(a)*r,flower.z+.011],[.0019,.0022,.0015],'sunflower seeds',[],6);}
    sphere('head','leaf',[-.248,.144,.137],[.018,.044,.004],'sunflower leaves',[0,0,-.6],12);
    // Exposed neck and clavicle sit above a modest scalloped square neckline.
    lathe('body','skin',[[1.32,.15,.10],[1.36,.11,.078],[1.40,.074,.069],[1.50,.068,.065]],32,0,'neck / shoulders');
    lathe('body','cloth',[[.88,.145,.102],[.97,.143,.107],[1.105,.176,.124],[1.235,.205,.139],[1.32,.196,.118],[1.335,.177,.108]],48,.012,'white fitted bodice');
    lathe('body','lace',[[1.313,.198,.12],[1.335,.179,.110],[1.343,.173,.107]],48,.01,'embroidered neckline');
    lathe('body','team',[[.925,.15,.109],[.95,.149,.11],[.973,.148,.111]],48,0,'team waist ribbon');
    lathe('body','cloth',[[.49,.285,.26],[.51,.287,.263],[.64,.251,.225],[.79,.194,.166],[.91,.145,.105]],64,.045,'knee-length pleated dress');
    lathe('body','lace',[[.49,.29,.265],[.508,.291,.266],[.527,.284,.258]],64,.025,'dress hem embroidery');
    // Fine vertical stitches and tiny eyelets sit only at the hem, not across the fabric.
    for(let i=0;i<40;i++){const a=i/40*Math.PI*2;rod('body','lace',[Math.sin(a)*.286,.525,Math.cos(a)*.26],[Math.sin(a)*.277,.547,Math.cos(a)*.251],.0014,'hem stitches');}
    for(const side of[-1,1]){
      const pts=[[side*.053,1.431,.041],[side*.064,1.382,.079],[side*.046,1.333,.116],[0,1.298,.137]];
      for(let i=1;i<pts.length;i++)rod('body','gold',pts[i-1],pts[i],.0012,'necklace chain');
      sphere('body','gold',[side*.011,1.289,.143],[.011,.009,.0025],'butterfly necklace',[0,0,side*.35],12);
      sphere('body','gold',[side*.007,1.276,.144],[.007,.006,.0025],'butterfly lower wings',[0,0,-side*.3],10);
    }
    rod('body','gold',[0,1.272,.145],[0,1.299,.145],.0016,'butterfly pendant');
    // Each joint borrows the existing IK transform; only its visible shape changes.
    for(const side of['R','L']){
      part('arm'+side,'cloth',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.84,1,.84],[0,0,0],'puffed white sleeves');
      part('fore'+side,'skin',new THREE.CapsuleGeometry(1,4,4,14),[0,0,0],[.67,1,.67],[0,0,0],'bare forearms');
      sphere('hand'+side,'skin',[0,0,0],[.038,.035,.055],'bare hands');
      for(let i=0;i<4;i++){sphere('hand'+side,'skin',[-.027+i*.017,-.018,.027],[.0085,.014,.026],'fingers',[],10);sphere('hand'+side,'skin',[-.027+i*.017,-.026,.043],[.008,.011,.017],'curled fingertips',[],10);}
      sphere('hand'+side,'skin',[.032,0,.018],[.012,.021,.026],'thumb',[],12);
      part('thigh'+side,'skin',new THREE.CapsuleGeometry(1,4,4,14),[0,0,0],[.61,1,.61],[0,0,0],'legs');
      part('shin'+side,'skin',new THREE.CapsuleGeometry(1,4,4,14),[0,0,0],[.59,1,.59],[0,0,0],'calves');
      sphere('shoe'+side,'skin',[0,-.016,-.006],[.047,.063,.05],'ankles');
      sphere('shoe'+side,'shoe',[0,-.088,.036],[.064,.036,.126],'flat shoes');
      sphere('shoe'+side,'lace',[0,-.11,.037],[.065,.012,.127],'thin flat soles');
      rod('shoe'+side,'ribbon',[-.046,-.052,.048],[.046,-.052,.048],.003,'flat shoe strap');
    }
    for(const chunk of chunks.values()){
      const p=[],n=[],uv=[];
      for(const g of chunk.parts){const a=g.getAttribute('position'),b=g.getAttribute('normal'),c=g.getAttribute('uv');for(let i=0;i<a.count;i++){p.push(a.getX(i),a.getY(i),a.getZ(i));n.push(b.getX(i),b.getY(i),b.getZ(i));uv.push(c?c.getX(i):0,c?c.getY(i):0);}g.dispose();}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      // A seated knee needs cloth volume in front of the shin. Shared morph
      // targets keep the weave/hem continuous while each avatar owns its weight.
      if(chunk.frame==='body'&&(chunk.material==='cloth'||chunk.material==='lace')){
        const posed=g.clone(),positions=posed.getAttribute('position');
        for(let i=0;i<positions.count;i++){
          const y=positions.getY(i),z=positions.getZ(i);
          if(y>=.49&&y<.88){
            const t=THREE.MathUtils.clamp((.88-y)/.39,0,1),fold=t*t*(3-2*t);
            const front=THREE.MathUtils.smoothstep(z,-.04,.12);
            positions.setZ(i,z+.10*fold*front);
          }
        }
        posed.computeVertexNormals();
        g.morphAttributes.position=[positions.clone()];g.morphAttributes.normal=[posed.getAttribute('normal').clone()];
        posed.dispose();
      }
      g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);
      templates.push({frame:chunk.frame,material:chunk.material,geometry:g,label:chunk.label});
    }
    cache={references:0,materials,geometries,textures,templates};caches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return {cache,release(){if(released)return;released=true;if(--cache.references===0){for(const g of cache.geometries)g.dispose();for(const m of cache.materials.values())m.dispose();for(const t of cache.textures)t.dispose();caches.delete(THREE);}}};
}

export function createSunflowerAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}) {
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group(),frames=new Map();group.name='Sunflower avatar / 丱凵してね';rig.add(group);
  const sources={body:upper,head,armR:rightArm.upperArm,armL:leftArm.upperArm,foreR:rightArm.forearm,foreL:leftArm.forearm,
    handR:rightArm.palm,handL:leftArm.palm,thighL:leftLeg.thigh,thighR:rightLeg.thigh,shinL:leftLeg.shin,shinR:rightLeg.shin,shoeL:leftLeg.boot,shoeR:rightLeg.boot};
  for(const template of cache.templates){
    if(!frames.has(template.frame)){const f=new THREE.Group();f.name=`Sunflower frame / ${template.frame}`;f.matrixAutoUpdate=false;group.add(f);frames.set(template.frame,f);}
    const material=cache.materials.get(template.material==='team'?(team==='blue'?'teamBlue':'teamRed'):template.material),mesh=new THREE.Mesh(template.geometry,material);
    mesh.name=`Sunflower / ${template.label}`;mesh.userData.character='mend';mesh.userData.solid=false;mesh.raycast=()=>{};mesh.castShadow=template.material!=='face';mesh.receiveShadow=true;frames.get(template.frame).add(mesh);
  }
  let disposed=false;
  function update(interaction=0){if(disposed)return;upper.updateMatrix();head.updateMatrix();for(const [name,frame]of frames){const source=sources[name];source.updateMatrix();if(name==='head')frame.matrix.multiplyMatrices(upper.matrix,source.matrix);else frame.matrix.copy(source.matrix);frame.matrixWorldNeedsUpdate=true;for(const mesh of frame.children)if(mesh.morphTargetInfluences)mesh.morphTargetInfluences[0]=THREE.MathUtils.clamp(interaction,0,1);}}
  function setVisible(value){group.visible=Boolean(value);}
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();release();}
  update();return {group,roots:frames,update,setVisible,dispose};
}
