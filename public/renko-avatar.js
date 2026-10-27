// Owner's right-hand reference: yellow bob, cat ears, spiral eyes and a blue
// padded jacket. Appearance only; no ability or playable character definition.
const caches = new WeakMap();

function acquireAssets(T) {
  let cache = caches.get(T);
  if (!cache) {
    const materials = new Map(), geometries = new Set(), textures = new Set(), chunks = new Map(), templates = [];
    const transform = new T.Object3D();
    for (const [id, color, roughness, metalness = 0] of [
      ['skin','#f5d5be',.87], ['hair','#eee34b',.64], ['hair light','#fff17c',.61], ['hair shade','#c9b93d',.76],
      ['jacket','#769ac7',.91], ['jacket light','#90b0d7',.92], ['seam','#536f98',.9], ['lining','#4d6584',.96],
      ['trousers','#536881',.94], ['boot','#354656',.85], ['sole','#223441',.95],
      ['metal','#aab8c2',.38,.65], ['rubber','#485565',.82], ['lens','#e3db65',.28,.12],
      ['ink','#414650',.88], ['team blue','#58b9ca',.7], ['team red','#dc7d80',.7],
    ]) {
      const material = new T.MeshStandardMaterial({ color, roughness, metalness });
      material.name = `Renko finish / ${id}`; materials.set(id, material);
    }
    function texture(name, size, paint) {
      const data = new Uint8Array(size * size * 4);
      for (let y=0; y<size; y++) for (let x=0; x<size; x++) paint(data, (y*size+x)*4, x, y, size);
      const value = new T.DataTexture(data,size,size); value.name = `Renko surface / ${name}`;
      value.colorSpace=T.SRGBColorSpace; value.magFilter=T.LinearFilter; value.minFilter=T.LinearMipmapLinearFilter;
      value.generateMipmaps=true; value.anisotropy=4; value.needsUpdate=true; textures.add(value); return value;
    }
    const face = texture('yellow spiral eyes',512,(d,i,px,py,n)=>{
      const x=(px/(n-1)-.5)*.29, y=(py/(n-1)-.5)*.25;
      let color=[0,0,0], alpha=0;
      const ink=(c,a=1)=>{color=c;alpha=a;};
      for (const side of [-1,1]) {
        const cx=side*.065, dx=(x-cx)/.049, ey=y-.009, arc=Math.sqrt(Math.max(0,1-dx*dx));
        const top=.035*arc+.002*side*dx, bottom=-.027*arc;
        if (Math.abs(dx)<1 && ey<top && ey>bottom) {
          ink([255,250,239]); const ix=(x-cx)/.029, iy=(ey-.002)/.031, r=Math.hypot(ix,iy), a=Math.atan2(iy,ix);
          if (r<1) {
            ink(r>.91?[100,95,29]:[247,227,60]);
            const spiral=((r*3.1-a/(Math.PI*2))%1+1)%1;
            if (r<.84 && (spiral<.065 || spiral>.935 || r<.055)) ink([83,79,36]);
          }
        }
        if (Math.abs(dx)<1 && Math.abs(ey-top)<.0042) ink([52,56,67]);
        const outer=side*(x-cx);
        if (outer>.036 && outer<.055 && Math.abs(ey-(.024+(outer-.036)*.47))<.0028) ink([52,56,67]);
        if (Math.abs(dx)<.92 && Math.abs(ey-bottom)<.0013) ink([128,94,88],.65);
        if (Math.abs((x-cx)/.041)<1 && Math.abs(y-(.070+.004*Math.cos((x-cx)*30)))<.002) ink([144,123,52]);
        const blush=Math.exp(-Math.pow((x-side*.090)/.023,2)-Math.pow((y+.040)/.015,2));
        if (!alpha && blush>.04) ink([238,144,134],blush*.24);
      }
      if (Math.abs(x)<.030 && Math.abs(y-(-.074+.008*Math.pow(x/.030,2)))<.0017) ink([130,91,85],.9);
      if (Math.hypot(x/.0025,(y+.026)/.003)<1) ink([174,122,105],.6);
      d[i]=color[0]; d[i+1]=color[1]; d[i+2]=color[2]; d[i+3]=Math.round(alpha*255);
    });
    const faceMaterial=new T.MeshStandardMaterial({map:face,transparent:true,depthWrite:false,roughness:.9,polygonOffset:true,polygonOffsetFactor:-1});
    faceMaterial.name='Renko finish / face'; materials.set('face',faceMaterial);
    const badge=texture('round yellow cat patch',128,(d,i,px,py,n)=>{
      const x=(px/(n-1)-.5)*2, y=(py/(n-1)-.5)*2,r=Math.hypot(x,y);
      let c=[240,216,54],a=r<.97?255:0;
      const line=Math.abs(r-.87)<.026 || Math.abs(r-.72)<.015;
      const cat=Math.abs(Math.hypot(x/.47,(y+.01)/.45)-1)<.045 && y<.29 ||
        y>.20&&y<.63&&(Math.abs(x-(-.46+(y-.2)*.28))<.024||Math.abs(x-(.46-(y-.2)*.28))<.024)||
        Math.hypot((Math.abs(x)-.17)/.038,(y-.02)/.066)<1 || Math.abs(x)<.05&&Math.abs(y+.13)<.023;
      if(line||cat)c=[103,101,48];d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=a;
    });
    const patchMaterial=new T.MeshStandardMaterial({map:badge,transparent:true,depthWrite:false,roughness:.95});
    patchMaterial.name='Renko finish / cat patch';materials.set('patch',patchMaterial);
    function part(frame, material, geometry, p=[0,0,0], s=[1,1,1], r=[0,0,0], label='') {
      transform.position.set(...p);transform.scale.set(...s);transform.rotation.set(...r);transform.updateMatrix();
      const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);geometry.dispose();
      const key=frame+'|'+material;if(!chunks.has(key))chunks.set(key,{frame,material,parts:[],labels:new Set()});
      const chunk=chunks.get(key);chunk.parts.push(g);if(label)chunk.labels.add(label);
    }
    const ball=(f,m,p,s,label='',seg=24)=>part(f,m,new T.SphereGeometry(1,seg,Math.max(10,Math.floor(seg*.66))),p,s,[0,0,0],label);
    function rod(f,m,a,b,r,label='') {
      const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
      const g=new T.CylinderGeometry(r,r,delta.length(),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
      part(f,m,g,start.add(end).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],label);
    }
    function roundedShape(w,h,r) {
      const q=new T.Shape(),x=-w/2,y=-h/2;q.moveTo(x+r,y);q.lineTo(x+w-r,y);q.quadraticCurveTo(x+w,y,x+w,y+r);
      q.lineTo(x+w,y+h-r);q.quadraticCurveTo(x+w,y+h,x+w-r,y+h);q.lineTo(x+r,y+h);q.quadraticCurveTo(x,y+h,x,y+h-r);
      q.lineTo(x,y+r);q.quadraticCurveTo(x,y,x+r,y);return q;
    }
    function panel(f,m,p,w,h,depth,radius,label,rotation=[0,0,0]) {
      part(f,m,new T.ExtrudeGeometry(roundedShape(w,h,radius),{depth,bevelEnabled:true,bevelSize:.003,bevelThickness:.002,bevelSegments:2,curveSegments:8,steps:1}),p,[1,1,1],rotation,label);
    }
    function shell(f,m,rings,label) {
      const positions=[],uv=[],indices=[],segments=48;
      for(let j=0;j<rings.length;j++)for(let k=0;k<=segments;k++){
        const a=k/segments*Math.PI*2,[y,rx,rz]=rings[j];positions.push(Math.sin(a)*rx,y,Math.cos(a)*rz);uv.push(k/segments,j/(rings.length-1));
      }
      for(let j=0;j<rings.length-1;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();part(f,m,g,[0,0,0],[1,1,1],[0,0,0],label);
    }
    ball('head','skin',[0,-.014,.016],[.153,.179,.134],'soft rounded face',36);
    ball('head','skin',[0,-.035,.150],[.008,.012,.008],'small nose');
    const fg=new T.PlaneGeometry(.29,.25,36,32),fp=fg.getAttribute('position');
    for(let i=0;i<fp.count;i++) {const x=fp.getX(i),y=fp.getY(i);fp.setZ(i,.016+.134*Math.sqrt(Math.max(.025,1-(x/.153)**2-((y+.014)/.179)**2))+.0015);}
    fg.computeVertexNormals();part('head','face',fg,[0,0,0],[1,1,1],[0,0,0],'yellow spiral eyes and smile');
    part('head','hair',new T.SphereGeometry(1,40,22,Math.PI,Math.PI,0,Math.PI),[0,.004,-.006],[.184,.205,.164],[0,0,0],'yellow bob rear shell');
    part('head','hair',new T.SphereGeometry(1,40,14,0,Math.PI,0,Math.PI*.40),[0,.004,-.006],[.184,.205,.164],[0,0,0],'closed yellow crown');
    // Short tapered locks leave the face open and give the bob a cut edge.
    for(const side of [-1,1])for(let i=0;i<5;i++) {
      const x=side*(.147+i*.006), z=.080-i*.047;
      ball('head',i%3===1?'hair light':'hair',[x,-.052,z],[.035,.155,.038],'chin length bob locks');
      rod('head','hair shade',[x+side*.025,.035,z+.006],[x+side*.020,-.170,z+.012],.0013,'fine bob strand lines');
    }
    for(let i=0;i<9;i++) {
      const x=(i-4)*.032, bottom=.057+Math.abs(i-4)*.002;
      panel('head',i%4===1?'hair light':'hair',[x,(.155+bottom)/2,.125+(.020*(1-Math.abs(i-4)/5))],.035,.155-bottom,.008,.008,'straight yellow fringe',[.10,0,(i-4)*-.018]);
      rod('head','hair shade',[x+.014,.135,.155],[x+.014,bottom+.006,.153],.0008,'fringe separators');
    }
    for(const side of [-1,1]) {
      const shape=new T.Shape();shape.moveTo(side*.106,.160);shape.quadraticCurveTo(side*.167,.267,side*.274,.275);shape.quadraticCurveTo(side*.286,.161,side*.202,.099);shape.closePath();
      part('head','hair',new T.ExtrudeGeometry(shape,{depth:.056,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,bevelSegments:3,steps:1}),[0,0,-.033],[1,1,1],[0,0,0],'yellow cat ears');
      const inner=new T.Shape();inner.moveTo(side*.159,.173);inner.lineTo(side*.250,.249);inner.lineTo(side*.225,.146);inner.closePath();
      part('head','hair shade',new T.ShapeGeometry(inner),[0,0,.034],[1,1,1],[0,0,0],'inset cat ear');
      for(let i=0;i<3;i++)rod('head','hair light',[side*(.179+i*.017),.170,.037],[side*(.190+i*.019),.213+i*.004,.037],.002,'ear fur marks');
      for(let i=0;i<2;i++)part('head','metal',new T.TorusGeometry(.014,.0033,8,20),[side*(.261-i*.012),.208-i*.038,.028],[1,1,1],[0,side*.55,0],'silver ear piercings');
    }
    // Forehead goggles: separate rubber seal, metal frame, yellow inset lens.
    for(const side of [-1,1]) {
      const x=side*.092, y=.153;
      panel('head','rubber',[x,y,.138],.168,.106,.013,.035,'goggle rubber seal',[0,side*-.13,side*.10]);
      panel('head','metal',[x,y+.002,.155],.153,.094,.009,.030,'silver goggle frame',[0,side*-.13,side*.10]);
      panel('head','rubber',[x,y+.002,.166],.131,.075,.003,.025,'dark lens rim',[0,side*-.13,side*.10]);
      panel('head','lens',[x,y+.002,.171],.118,.063,.002,.022,'yellow goggle lens',[0,side*-.13,side*.10]);
      rod('head','jacket light',[x-.036,y+.017,.177],[x-.018,y+.028,.177],.0024,'lens reflection');
      panel('head','rubber',[side*.174,.137,.050],.036,.045,.016,.005,'goggle strap buckle');
    }
    panel('head','metal',[0,.158,.159],.029,.039,.011,.007,'goggle bridge');
    part('head','rubber',new T.TorusGeometry(.169,.013,8,48),[0,.125,-.004],[1,1,.89],[Math.PI/2,0,0],'goggle head strap');
    shell('body','skin',[[1.34,.066,.059],[1.49,.062,.056]],'neck');
    shell('body','jacket',[[.73,.224,.173],[.77,.246,.187],[.96,.264,.195],[1.17,.275,.201],[1.31,.260,.185],[1.37,.210,.142],[1.39,.123,.096]],'oversized padded blue jacket');
    shell('body','seam',[[.735,.225,.174],[.755,.237,.181]],'jacket hem piping');
    shell('body','lining',[[1.34,.139,.116],[1.49,.135,.110]],'dark high collar lining');
    for(const side of [-1,1]) {
      panel('body','jacket light',[side*.079,1.405,.111],.150,.171,.025,.022,'raised padded collar',[0,side*-.12,side*-.055]);
      rod('body','seam',[side*.008,1.480,.144],[side*.013,.774,.195],.0035,'front zip seam');
      panel('body','seam',[side*.145,1.085,.169],.167,.207,.004,.010,'pocket stitched edge');
      panel('body','jacket',[side*.145,1.086,.177],.159,.199,.012,.008,'large front pocket');
      panel('body','seam',[side*.145,1.160,.191],.169,.055,.006,.007,'pocket flap piping');
      panel('body','jacket light',[side*.145,1.165,.196],.163,.052,.008,.006,'front pocket flap');
      ball('body','metal',[side*.145,1.150,.208],[.005,.005,.002],'pocket snap',12);
      rod('body','seam',[side*.246,1.280,.116],[side*.228,.800,.110],.002,'outer jacket seam');
    }
    part('body','patch',new T.PlaneGeometry(.105,.105),[.143,.999,.195],[1,1,1],[0,0,-.08],'yellow circular cat badge');
    panel('body','metal',[.006,1.277,.211],.013,.027,.004,.003,'zipper pull');
    // The reference stops at the waist: matching trousers and practical boots
    // are a neutral completion, rather than a claim about unseen clothing.
    for(const side of ['R','L']) {
      part('arm'+side,'jacket',new T.CapsuleGeometry(1,3.3,5,20),[0,0,0],[1.17,1,1.17],[0,0,0],'puffy jacket sleeves');
      part('fore'+side,'jacket',new T.CapsuleGeometry(1,3.9,5,20),[0,0,0],[1.22,1,1.22],[0,0,0],'large padded forearms');
      shell('fore'+side,'seam',[[1.95,1.02,1.02],[2.08,1.03,1.03]],'cuff seam');
      ball('hand'+side,'skin',[0,-.003,.006],[.042,.038,.060],'bare hands');
      for(let i=0;i<4;i++)ball('hand'+side,'skin',[-.025+i*.016,-.025,.030],[.008,.013,.025],'fingers',12);
      ball('hand'+side,'skin',[.033,0,.019],[.013,.021,.026],'thumb',16);
      part('thigh'+side,'trousers',new T.CapsuleGeometry(1,4.25,4,18),[0,0,0],[.93,1,.93],[0,0,0],'blue tapered trousers');
      part('shin'+side,'trousers',new T.CapsuleGeometry(1,4.25,4,18),[0,0,0],[.94,1,.94],[0,0,0],'trouser legs');
      ball('shoe'+side,'boot',[0,-.053,.032],[.076,.073,.135],'dark blue boots');
      ball('shoe'+side,'sole',[0,-.111,.033],[.077,.018,.137],'boot soles');
      for(let i=0;i<3;i++)rod('shoe'+side,'jacket light',[-.031,-.008+i*.021,.116-i*.010],[.031,-.008+i*.021,.116-i*.010],.003,'boot laces');
    }
    panel('body','team',[0,.786,.181],.077,.012,.004,.003,'small team hem tab');
    for(const chunk of chunks.values()) {
      const positions=[],normals=[],uv=[];
      for(const g of chunk.parts) {const p=g.getAttribute('position'),n=g.getAttribute('normal'),u=g.getAttribute('uv');
        for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));uv.push(u?u.getX(i):0,u?u.getY(i):0);}g.dispose();}
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.add(geometry);
      templates.push({frame:chunk.frame,material:chunk.material,geometry,label:[...chunk.labels].join(' / ')});
    }
    cache={references:0,materials,geometries,textures,templates};caches.set(T,cache);
  }
  cache.references++;let released=false;
  return {cache,release(){if(released)return;released=true;if(--cache.references===0){for(const g of cache.geometries)g.dispose();for(const m of cache.materials.values())m.dispose();for(const t of cache.textures)t.dispose();caches.delete(T);}}};
}

export function createRenkoAvatar(T,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}) {
  const {cache,release}=acquireAssets(T),group=new T.Group(),frames=new Map();group.name='Renko avatar / 蓮子';rig.add(group);
  const sources={body:upper,head,armR:rightArm.upperArm,armL:leftArm.upperArm,foreR:rightArm.forearm,foreL:leftArm.forearm,handR:rightArm.palm,handL:leftArm.palm,thighR:rightLeg.thigh,thighL:leftLeg.thigh,shinR:rightLeg.shin,shinL:leftLeg.shin,shoeR:rightLeg.boot,shoeL:leftLeg.boot};
  for(const template of cache.templates) {
    if(!frames.has(template.frame)){const frame=new T.Group();frame.name=`Renko avatar frame / ${template.frame}`;frame.userData.agentHead=template.frame==='head';frame.matrixAutoUpdate=false;group.add(frame);frames.set(template.frame,frame);}
    const material=cache.materials.get(template.material==='team'?(team==='blue'?'team blue':'team red'):template.material);
    const mesh=new T.Mesh(template.geometry,material);mesh.name=`Renko avatar / ${template.label}`;mesh.userData.character='renko';mesh.userData.solid=false;mesh.raycast=()=>{};mesh.castShadow=!['face','patch'].includes(template.material);mesh.receiveShadow=true;frames.get(template.frame).add(mesh);
  }
  let disposed=false;
  function update(){if(disposed)return;upper.updateMatrix();head.updateMatrix();for(const[name,frame]of frames){const source=sources[name];source.updateMatrix();if(name==='head')frame.matrix.multiplyMatrices(upper.matrix,source.matrix);else frame.matrix.copy(source.matrix);frame.matrixWorldNeedsUpdate=true;}}
  update();return{group,roots:frames,update,setVisible(value){group.visible=Boolean(value);},dispose(){if(disposed)return;disposed=true;group.removeFromParent();release();}};
}
