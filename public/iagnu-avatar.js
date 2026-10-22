// Hand-drawn serif outlines form the character itself; no font, image asset or
// tactical body is visible. The old rig remains the sole gameplay hit surface.
const caches=new WeakMap();

function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    const geometries=new Set(),materials=new Map(),templates=[],chunks=new Map(),transform=new THREE.Object3D();
    const finish=(id,color,roughness,metalness)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,vertexColors:true});m.name=`IAGNU finish / ${id}`;materials.set(id,m);return m;};
    finish('letter face','#d9dc7b',.32,.62);finish('letter bevel','#a69b4e',.39,.72);
    finish('polished gold','#cec878',.34,.64);finish('bronze joint','#776d3e',.48,.68);
    finish('team blue','#6bb7bd',.53,.2);finish('team red','#ce8278',.53,.2);
    function part(frame,material,geometry,p=[0,0,0],s=[1,1,1],r=[0,0,0],label='',semantic=''){
      transform.position.set(...p);transform.scale.set(...s);transform.rotation.set(r[0]||0,r[1]||0,r[2]||0);transform.updateMatrix();
      const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);geometry.dispose();
      const positions=g.getAttribute('position'),c=new Float32Array(positions.count*3);
      for(let i=0;i<positions.count;i++){
        const y=positions.getY(i),grain=Math.sin(positions.getX(i)*163+y*47)*Math.sin(y*137)*.013;
        const light=frame==='head'?(.94+THREE.MathUtils.clamp((y+.38)/.78,0,1)*.06+grain):.98;
        c[i*3]=light;c[i*3+1]=light;c[i*3+2]=light;
      }
      g.setAttribute('color',new THREE.BufferAttribute(c,3));
      const key=`${frame}|${material}|${semantic}`;if(!chunks.has(key))chunks.set(key,{frame,material,label,parts:[]});
      const chunk=chunks.get(key);if(label&&!chunk.label.includes(label))chunk.label+=(chunk.label?' / ':'')+label;chunk.parts.push(g);
    }
    const ball=(f,m,p,s,label='',segments=20)=>part(f,m,new THREE.SphereGeometry(1,segments,Math.max(8,Math.floor(segments*.7))),p,s,[0,0,0],label);
    function rod(f,m,a,b,r,label='',segments=12){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),g=new THREE.CylinderGeometry(r*.85,r,delta.length(),segments);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));part(f,m,g,start.add(end).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],label);}
    function panel(f,m,points,depth,p,label,bevel=.003){const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel*.6,bevelSegments:2,steps:1});g.translate(0,0,-depth/2);part(f,m,g,p,[1,1,1],[0,0,0],label);}
    // Each letter is an actual outline with the narrow stems, flared terminals
    // and unusually tall proportions in the reference. A's counter is a hole;
    // G and U open into free air instead of a dark texture or backing plate.
    const glyphs=[];
    {
      const s=new THREE.Shape();s.moveTo(-.045,0);s.lineTo(.045,0);s.lineTo(.045,.023);s.quadraticCurveTo(.014,.032,.013,.060);s.lineTo(.011,.715);s.quadraticCurveTo(.016,.741,.043,.752);s.lineTo(.043,.780);s.lineTo(-.043,.780);s.lineTo(-.043,.752);s.quadraticCurveTo(-.013,.739,-.011,.715);s.lineTo(-.013,.060);s.quadraticCurveTo(-.015,.031,-.045,.023);s.closePath();glyphs.push({letter:'I',shape:s,advance:.098});
    }
    {
      const s=new THREE.Shape();s.moveTo(-.092,0);s.lineTo(-.030,0);s.lineTo(-.030,.021);s.quadraticCurveTo(-.054,.029,-.051,.059);s.lineTo(-.033,.302);s.lineTo(.034,.302);s.lineTo(.062,.063);s.quadraticCurveTo(.066,.029,.042,.022);s.lineTo(.042,0);s.lineTo(.107,0);s.lineTo(.107,.023);s.quadraticCurveTo(.087,.035,.082,.076);s.lineTo(.009,.780);s.lineTo(-.015,.780);s.lineTo(-.073,.078);s.quadraticCurveTo(-.076,.034,-.092,.023);s.closePath();
      const hole=new THREE.Path();hole.moveTo(-.029,.343);hole.lineTo(-.003,.652);hole.lineTo(.029,.343);hole.closePath();s.holes.push(hole);glyphs.push({letter:'A',shape:s,advance:.207});
    }
    {
      const s=new THREE.Shape();s.moveTo(.073,.650);s.bezierCurveTo(.052,.803,-.006,.818,-.046,.748);s.bezierCurveTo(-.105,.644,-.111,.173,-.054,.044);s.bezierCurveTo(-.021,-.030,.043,-.022,.078,.044);s.lineTo(.078,.334);s.quadraticCurveTo(.078,.357,.092,.372);s.lineTo(.092,.402);s.lineTo(.017,.402);s.lineTo(.017,.376);s.quadraticCurveTo(.045,.367,.047,.342);s.lineTo(.047,.101);s.bezierCurveTo(.025,.028,-.008,.032,-.029,.081);s.bezierCurveTo(-.073,.185,-.067,.626,-.027,.712);s.bezierCurveTo(.004,.773,.036,.726,.049,.644);s.lineTo(.073,.650);s.closePath();glyphs.push({letter:'G',shape:s,advance:.190});
    }
    {
      const s=new THREE.Shape();s.moveTo(-.088,0);s.lineTo(-.023,0);s.lineTo(-.023,.024);s.quadraticCurveTo(-.049,.033,-.049,.067);s.lineTo(-.049,.658);s.lineTo(.051,0);s.lineTo(.074,0);s.lineTo(.074,.716);s.quadraticCurveTo(.078,.745,.093,.754);s.lineTo(.093,.780);s.lineTo(.030,.780);s.lineTo(.030,.754);s.quadraticCurveTo(.055,.743,.055,.716);s.lineTo(.055,.176);s.lineTo(-.036,.780);s.lineTo(-.089,.780);s.lineTo(-.089,.752);s.quadraticCurveTo(-.068,.743,-.068,.716);s.lineTo(-.068,.066);s.quadraticCurveTo(-.071,.032,-.088,.023);s.closePath();glyphs.push({letter:'N',shape:s,advance:.191});
    }
    {
      const s=new THREE.Shape();s.moveTo(-.091,.780);s.lineTo(-.024,.780);s.lineTo(-.024,.754);s.quadraticCurveTo(-.045,.741,-.045,.712);s.lineTo(-.045,.196);s.bezierCurveTo(-.045,.086,-.028,.037,.006,.037);s.bezierCurveTo(.041,.037,.053,.092,.053,.197);s.lineTo(.053,.712);s.quadraticCurveTo(.053,.738,.030,.754);s.lineTo(.030,.780);s.lineTo(.096,.780);s.lineTo(.096,.754);s.quadraticCurveTo(.075,.740,.075,.712);s.lineTo(.075,.195);s.bezierCurveTo(.075,.050,.052,-.013,.004,-.013);s.bezierCurveTo(-.052,-.013,-.075,.048,-.075,.195);s.lineTo(-.075,.712);s.quadraticCurveTo(-.075,.739,-.091,.754);s.closePath();glyphs.push({letter:'U',shape:s,advance:.198});
    }
    const gap=.012,fontScale=.84,total=glyphs.reduce((n,g)=>n+g.advance,0)+gap*(glyphs.length-1);
    let cursor=-total/2;
    for(const glyph of glyphs){
      const center=cursor+glyph.advance/2,geometry=new THREE.ExtrudeGeometry(glyph.shape,{depth:.042,bevelEnabled:true,bevelThickness:.003,bevelSize:.0027,bevelSegments:3,curveSegments:24,steps:1});
      geometry.translate(0,0,-.021);const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
      // Separate material batches retain per-letter caps for semantic geometry
      // checks, while every side/bevel shares one draw across the word.
      for(const materialIndex of [0,1]){
        const p=[],n=[],v=[];
        for(const group of geometry.groups)if(group.materialIndex===materialIndex)for(let i=group.start;i<group.start+group.count;i++){p.push(positions.getX(i),positions.getY(i),positions.getZ(i));n.push(normals.getX(i),normals.getY(i),normals.getZ(i));v.push(uv.getX(i),uv.getY(i));}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(v,2));
        part('head',materialIndex===0?'letter face':'letter bevel',g,[center*fontScale,-.38,.172],[fontScale,1,1],[0,0,0],materialIndex===0?`letter ${glyph.letter} / gold front and back`:'extruded letter sides / serif bevels',materialIndex===0?glyph.letter:'');
      }
      geometry.dispose();cursor+=glyph.advance+gap;
    }
    // Below the floating word, elegant bronze spines and calligraphic links
    // form a complete moving body; there is no opaque board behind the letters.
    for(const side of [-1,1]){
      rod('body','bronze joint',[side*.100,.805,-.015],[side*.118,1.216,.014],.022,'slender bronze spine');
      rod('body','polished gold',[side*.118,1.216,.014],[side*.232,1.301,.027],.017,'sweeping shoulder serif');
      ball('body','polished gold',[side*.151,.821,.0],[.062,.034,.059],'flared waist terminals',24);
    }
    panel('body','bronze joint',[[-.173,-.023],[.173,-.023],[.155,.023],[-.155,.023]],.072,[0,.855,-.003],'waist crossbar',.005);
    panel('body','team',[[-.135,-.012],[.135,-.012],[.135,.012],[-.135,.012]],.006,[0,.862,.037],'team waist band',.002);
    // Fine raised rings and joint collars add scale without multiplying meshes.
    for(const side of ['R','L']){
      part('arm'+side,'polished gold',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.53,1,.53],[0,0,0],'gold stroke upper arms');
      part('fore'+side,'polished gold',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.55,1,.55],[0,0,0],'gold stroke forearms');
      for(const y of [-2.55,2.55]){
        part('arm'+side,'bronze joint',new THREE.TorusGeometry(.59,.10,7,18),[0,y,0],[1,1,1],[Math.PI/2,0,0],'inset arm collars');
        part('fore'+side,'bronze joint',new THREE.TorusGeometry(.60,.10,7,18),[0,y,0],[1,1,1],[Math.PI/2,0,0],'inset wrist collars');
      }
      ball('hand'+side,'bronze joint',[0,0,.002],[.039,.032,.055],'bronze articulated palms',24);
      for(let i=0;i<4;i++){ball('hand'+side,'polished gold',[-.025+i*.017,-.017,.026],[.008,.014,.027],'gold grip fingers',16);ball('hand'+side,'polished gold',[-.025+i*.017,-.026,.042],[.0075,.010,.015],'gold grip fingertips',14);}
      ball('hand'+side,'polished gold',[.033,.002,.019],[.012,.021,.027],'gold thumb',18);
      part('thigh'+side,'polished gold',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.52,1,.52],[0,0,0],'gold stroke legs');
      part('shin'+side,'polished gold',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.56,1,.56],[0,0,0],'gold stroke shins');
      for(const y of [-2.65,2.65])part('shin'+side,'bronze joint',new THREE.TorusGeometry(.58,.11,7,18),[0,y,0],[1,1,1],[Math.PI/2,0,0],'inset ankle collars');
      panel('shoe'+side,'letter bevel',[[-.091,-.112],[.091,-.112],[.091,-.090],[.058,-.077],[.049,-.037],[-.049,-.037],[-.058,-.077],[-.091,-.090]],.255,[0,0,.036],'serif pedestal feet',.007);
      panel('shoe'+side,'polished gold',[[-.083,-.105],[.083,-.105],[.079,-.091],[-.079,-.091]],.244,[0,0,.038],'polished foot serif rims',.002);
    }
    for(const chunk of chunks.values()){
      const p=[],n=[],uv=[],c=[];for(const g of chunk.parts){const a=g.getAttribute('position'),b=g.getAttribute('normal'),d=g.getAttribute('uv'),e=g.getAttribute('color');for(let i=0;i<a.count;i++){p.push(a.getX(i),a.getY(i),a.getZ(i));n.push(b.getX(i),b.getY(i),b.getZ(i));uv.push(d?d.getX(i):0,d?d.getY(i):0);c.push(e.getX(i),e.getY(i),e.getZ(i));}g.dispose();}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);templates.push({frame:chunk.frame,material:chunk.material,geometry:g,label:chunk.label});
    }
    cache={references:0,geometries,materials,templates};caches.set(THREE,cache);
  }
  cache.references++;let released=false;return {cache,release(){if(released)return;released=true;if(--cache.references===0){for(const g of cache.geometries)g.dispose();for(const m of cache.materials.values())m.dispose();caches.delete(THREE);}}};
}

export function createIagnuAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group(),frames=new Map();group.name='IAGNU avatar';rig.add(group);
  const sources={body:upper,head,armR:rightArm.upperArm,armL:leftArm.upperArm,foreR:rightArm.forearm,foreL:leftArm.forearm,handR:rightArm.palm,handL:leftArm.palm,thighR:rightLeg.thigh,thighL:leftLeg.thigh,shinR:rightLeg.shin,shinL:leftLeg.shin,shoeR:rightLeg.boot,shoeL:leftLeg.boot};
  for(const template of cache.templates){if(!frames.has(template.frame)){const frame=new THREE.Group();frame.name=`IAGNU avatar frame / ${template.frame}`;frame.matrixAutoUpdate=false;group.add(frame);frames.set(template.frame,frame);}const material=cache.materials.get(template.material==='team'?(team==='blue'?'team blue':'team red'):template.material),mesh=new THREE.Mesh(template.geometry,material);mesh.name=`IAGNU avatar / ${template.label}`;mesh.userData.character='echo';mesh.userData.solid=false;mesh.raycast=()=>{};mesh.castShadow=true;mesh.receiveShadow=true;frames.get(template.frame).add(mesh);}
  let disposed=false;
  function update(){if(disposed)return;upper.updateMatrix();head.updateMatrix();for(const [name,frame]of frames){const source=sources[name];source.updateMatrix();if(name==='head')frame.matrix.multiplyMatrices(upper.matrix,source.matrix);else frame.matrix.copy(source.matrix);frame.matrixWorldNeedsUpdate=true;}}
  function setVisible(value){group.visible=Boolean(value);}
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();release();}
  update();return {group,roots:frames,update,setVisible,dispose};
}
