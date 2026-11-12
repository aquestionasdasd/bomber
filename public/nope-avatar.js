import { createNopeBottleModel } from './nope-props.js';
import { createWeaponModel } from './agent-model.js';

const caches=new WeakMap();
function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    const geometries=new Set(),materials=new Map(),templates=[],chunks=new Map(),transform=new THREE.Object3D();
    for(const [id,color,roughness,metalness]of [['pink','#fa159f',.57,.02],['ink','#10151a',.65,0],['tongue','#fb68b7',.62,0],['cloth','#252c38',.92,0],['rubber','#141c28',.95,0],['team blue','#65b8c2',.75,.05],['team red','#d98078',.75,.05]]){const m=new THREE.MeshStandardMaterial({color,roughness,metalness,vertexColors:true});m.name=`NOPE avatar finish / ${id}`;materials.set(id,m);}
    function part(frame,material,geometry,p=[0,0,0],s=[1,1,1],r=[0,0,0],label='',light=1){
      transform.position.set(...p);transform.scale.set(...s);transform.rotation.set(...r);transform.updateMatrix();const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);geometry.dispose();
      const colors=new Float32Array(g.getAttribute('position').count*3);colors.fill(light);g.setAttribute('color',new THREE.BufferAttribute(colors,3));
      const key=`${frame}|${material}`;if(!chunks.has(key))chunks.set(key,{frame,material,parts:[],label});const chunk=chunks.get(key);if(label&&!chunk.label.includes(label))chunk.label+=(chunk.label?' / ':'')+label;chunk.parts.push(g);
    }
    const ball=(frame,material,p,s,label,w=28,h=18,light=1)=>part(frame,material,new THREE.SphereGeometry(1,w,h),p,s,[0,0,0],label,light);
    function curve(frame,material,points,radius,label,segments=28){const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));part(frame,material,new THREE.TubeGeometry(path,segments,radius,8,false),[0,0,0],[1,1,1],[0,0,0],label);}
    function shell(frame,material,rings,label){part(frame,material,new THREE.LatheGeometry(rings.map(([y,r])=>new THREE.Vector2(r,y)),36),[0,0,0],[1,1,.78],[0,0,0],label);}
    const front=(x,y)=>-.025+.19*Math.sqrt(Math.max(.02,1-(x/.317)**2-((y-.02)/.31)**2));
    ball('head','pink',[0,.02,-.025],[.317,.31,.19],'rounded pink face cushion',48,32);
    // Ink strokes are curved solids laid on the cushion, not a flat face card.
    for(const side of [-1,1])for(const diagonal of [-1,1]){const points=[];for(let i=0;i<=6;i++){const t=i/6,x=side*.104+(t-.5)*.078,y=.096+(t-.5)*.078*diagonal;points.push([x,y,front(x,y)+.008]);}curve('head','ink',points,.012,'crossed X eyes',18);}
    const smile=[];for(let i=0;i<=28;i++){const t=i/28,x=-.208+.416*t,y=-.034-Math.sin(t*Math.PI)*.100;smile.push([x,y,front(x,y)+.010]);}curve('head','ink',smile,.016,'wide curved smile',40);
    const tongue=new THREE.Shape();tongue.moveTo(-.047,-.133);tongue.lineTo(-.053,-.216);tongue.bezierCurveTo(-.054,-.266,.047,-.266,.054,-.216);tongue.lineTo(.062,-.133);tongue.closePath();
    const tongueGeometry=new THREE.ExtrudeGeometry(tongue,{depth:.026,bevelEnabled:true,bevelSegments:3,bevelSize:.004,bevelThickness:.004,steps:1,curveSegments:20});part('head','ink',tongueGeometry,[0,0,.216],[1,1,1],[0,0,0],'protruding tongue silhouette');
    curve('head','tongue',[[.007,-.164,.248],[.004,-.205,.251],[0,-.229,.250]],.005,'pink tongue crease',18);
    for(const [x,y,r,stretch]of [[-.224,-.16,.026,1.5],[-.155,-.245,.021,1.4],[.183,-.222,.024,1.65],[.259,-.118,.017,1.4]])ball('head','pink',[x,y,front(x,y)-.006],[r,r*stretch,.026],'molded paint drips',20,12);
    // A small embossed rear seam makes the unprinted side a finished object.
    const seam=[];for(let i=0;i<=30;i++){const a=Math.PI*.12+i/30*Math.PI*1.76;seam.push([Math.sin(a)*.292,.02+Math.cos(a)*.286,-.100]);}curve('head','pink',seam,.002,'rear cushion seam',48);
    shell('body','cloth',[[.72,0],[.755,.148],[.85,.181],[1.05,.201],[1.20,.211],[1.31,.177],[1.38,.098],[1.405,.073],[1.42,0]],'charcoal utility suit');
    shell('body','pink',[[1.35,.110],[1.373,.109],[1.391,.089],[1.402,.075]],'pink soft collar');
    shell('body','team',[[.877,.190],[.900,.194],[.922,.197]],'team waist band');
    for(const side of [-1,1]){
      curve('body','pink',[[side*.140,1.29,.110],[side*.170,1.13,.118],[side*.152,.988,.112]],.003,'stitched curved torso seams',18);
      ball('body','cloth',[side*.206,.984,-.025],[.046,.073,.067],'side utility pockets',20,12,.86);
      part('body','team',new THREE.BoxGeometry(.062,.029,.012),[side*.137,1.284,.126],[1,1,1],[0,0,side*-.13],'visible shoulder team tabs');
    }
    // Simple raised, narrow lettering belongs to the clothing rather than a
    // bright billboard. Individual strokes merge into the existing pink batch.
    const glyphs={N:[[0,0,0,1],[0,1,.6,0],[.6,0,.6,1]],O:[[0,0,0,1],[0,1,.6,1],[.6,1,.6,0],[.6,0,0,0]],P:[[0,0,0,1],[0,1,.6,1],[.6,1,.6,.5],[.6,.5,0,.5]],E:[[0,0,0,1],[0,1,.6,1],[0,.5,.5,.5],[0,0,.6,0]]};
    for(let k=0;k<4;k++)for(const [ax,ay,bx,by]of glyphs['NOPE'[k]])curve('body','pink',[[(-1.5+k)*.041+(ax-.3)*.043,1.19+ay*.043,.157],[(-1.5+k)*.041+(bx-.3)*.043,1.19+by*.043,.157]],.0022,'raised NOPE chest wordmark',1);
    for(const side of ['R','L']){
      part('arm'+side,'cloth',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.94,1,.94],[0,0,0],'soft suit upper arms');
      part('fore'+side,'cloth',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.94,1,.94],[0,0,0],'soft suit forearms');
      ball('hand'+side,'pink',[0,-.001,.006],[.047,.042,.064],'pink gripping mittens',24,16);
      ball('hand'+side,'pink',[.039,-.002,.020],[.020,.025,.031],'gripping thumbs',20,12);
      for(let i=0;i<3;i++)curve('hand'+side,'ink',[[-.023+i*.018,-.030,.050],[-.023+i*.018,-.036,.030]],.0011,'mitten finger seams',1);
      part('thigh'+side,'cloth',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.91,1,.91],[0,0,0],'utility suit thighs');
      part('shin'+side,'cloth',new THREE.CapsuleGeometry(1,4,4,16),[0,0,0],[.90,1,.90],[0,0,0],'utility suit calves');
      ball('shoe'+side,'rubber',[0,-.057,.045],[.083,.075,.145],'rounded charcoal shoes',28,16);
      ball('shoe'+side,'pink',[0,-.111,.046],[.082,.015,.143],'pink shoe sole edging',24,12);
    }
    for(const chunk of chunks.values()){const p=[],n=[],uv=[],c=[];for(const g of chunk.parts){const a=g.getAttribute('position'),b=g.getAttribute('normal'),d=g.getAttribute('uv'),e=g.getAttribute('color');for(let i=0;i<a.count;i++){p.push(a.getX(i),a.getY(i),a.getZ(i));n.push(b.getX(i),b.getY(i),b.getZ(i));uv.push(d?d.getX(i):0,d?d.getY(i):0);c.push(e.getX(i),e.getY(i),e.getZ(i));}g.dispose();}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.add(geometry);templates.push({frame:chunk.frame,material:chunk.material,geometry,label:chunk.label});
    }
    cache={references:0,geometries,materials,templates};caches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return {cache,release(){if(released)return;released=true;if(--cache.references===0){for(const g of cache.geometries)g.dispose();for(const m of cache.materials.values())m.dispose();caches.delete(THREE);}}};
}

export function createNopeAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group(),frames=new Map();group.name='NOPE avatar / painted smile mascot';rig.add(group);
  const sources={body:upper,head,armR:rightArm.upperArm,armL:leftArm.upperArm,foreR:rightArm.forearm,foreL:leftArm.forearm,handR:rightArm.palm,handL:leftArm.palm,thighR:rightLeg.thigh,thighL:leftLeg.thigh,shinR:rightLeg.shin,shinL:leftLeg.shin,shoeR:rightLeg.boot,shoeL:leftLeg.boot};
  for(const template of cache.templates){if(!frames.has(template.frame)){const frame=new THREE.Group();frame.name=`NOPE avatar frame / ${template.frame}`;frame.matrixAutoUpdate=false;group.add(frame);frames.set(template.frame,frame);}const material=cache.materials.get(template.material==='team'?(team==='blue'?'team blue':'team red'):template.material),mesh=new THREE.Mesh(template.geometry,material);mesh.name=`NOPE avatar / ${template.label}`;mesh.userData.character='nope';mesh.userData.solid=false;mesh.raycast=()=>{};mesh.castShadow=true;mesh.receiveShadow=true;frames.get(template.frame).add(mesh);}
  const bottle=createNopeBottleModel(THREE);bottle.group.position.set(.241,.918,-.095);bottle.group.rotation.z=-.13;bottle.group.scale.setScalar(.78);bottle.group.traverse(object=>{if(object.isMesh){object.userData.character='nope';object.name=`NOPE avatar / belt ${object.name}`;}});frames.get('body').add(bottle.group);
  let disposed=false;
  function update(){if(disposed)return;upper.updateMatrix();head.updateMatrix();for(const [name,frame]of frames){const source=sources[name];source.updateMatrix();if(name==='head')frame.matrix.multiplyMatrices(upper.matrix,source.matrix);else frame.matrix.copy(source.matrix);frame.matrixWorldNeedsUpdate=true;}}
  function setVisible(value){group.visible=Boolean(value);}
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();bottle.dispose();release();}
  update();return {group,roots:frames,update,setVisible,dispose};
}

// The decoy and flying face borrow the very same curved expression as the
// character. Its local origin is the head centre, with the printed side at +Z.
export function createNopeFaceModel(THREE){
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group();group.name='NOPE face / shared decoy expression';
  for(const template of cache.templates){if(template.frame!=='head')continue;const mesh=new THREE.Mesh(template.geometry,cache.materials.get(template.material));mesh.name=`NOPE face / ${template.label}`;mesh.userData.character='nope';mesh.userData.solid=false;mesh.raycast=()=>{};mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  let disposed=false;return {group,dispose(){if(disposed)return;disposed=true;group.removeFromParent();release();}};
}

// Armed decoys borrow live finishes. Two pooled leg groups animate a walk
// without fifty rigs; source geometry and the live character are untouched.
const decoyCaches=new WeakMap();
export function acquireNopeDecoyAsset(THREE){
  let cache=decoyCaches.get(THREE);
  if(!cache){
    const source=acquireAssets(THREE),frames=new Map(),chunks=new Map(),geometries=new Set();
    const transform=new THREE.Object3D(),axis=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
    function frame(name,x,y,z,rx=0,ry=0,rz=0){
      transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(1,1,1);transform.updateMatrix();frames.set(name,transform.matrix.clone());
    }
    function segment(name,a,b,radius){
      direction.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const length=direction.length();
      transform.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
      transform.quaternion.setFromUnitVectors(axis,direction.normalize());transform.scale.set(radius,length/6,radius);transform.updateMatrix();frames.set(name,transform.matrix.clone());
    }
    frame('body',0,0,0);frame('head',0,1.62,0);
    for(const [side,sign]of [['R',-1],['L',1]]){
      segment('arm'+side,[sign*.263,1.325,.004],[sign*.30,1.12,.18],.083);
      segment('fore'+side,[sign*.30,1.12,.18],[sign*.10,1.24,sign<0?.30:.59],.065);
      frame('hand'+side,sign*.10,1.24,sign<0?.30:.59,Math.PI/2,0,0);
      segment('thigh'+side,[sign*.118,.800,0],[sign*.130,.475,.018],.101);
      segment('shin'+side,[sign*.130,.475,.018],[sign*.127,.132,0],.079);
      frame('shoe'+side,sign*.127,.132,0);
    }
    for(const template of source.cache.templates){
      const geometry=template.geometry.clone();geometry.applyMatrix4(frames.get(template.frame));
      const motion=/^(thigh|shin|shoe)/.test(template.frame)?'leg'+template.frame.slice(-1):'body',key=template.material+'|'+motion;
      if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(geometry);
    }
    // Bake the same Vandal silhouette used by live actors into one pooled
    // batch. Its steel/receiver/stock colors survive without90 weapon rigs.
    const weapon=createWeaponModel(THREE,{id:'vandal',detailed:false}),rifle=[];
    weapon.group.position.set(-.10,1.354,.40);weapon.group.rotation.y=Math.PI;weapon.parent.updateMatrixWorld(true);
    weapon.group.traverse(mesh=>{if(!mesh.isMesh)return;
      const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(mesh.matrixWorld);
      const count=g.attributes.position.count,colors=new Float32Array(count*3),color=mesh.material.color;
      for(let i=0;i<count;i++)colors.set([color.r,color.g,color.b],i*3);
      g.setAttribute('color',new THREE.BufferAttribute(colors,3));rifle.push(g);
    });weapon.dispose();chunks.set('rifle|body',rifle);
    const rifleMaterial=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.5,metalness:.28});rifleMaterial.name='NOPE decoy / shared Vandal';
    const parts=[],bounds=new THREE.Box3();
    for(const [key,items]of chunks){
      const [finish,motion]=key.split('|');
      const geometry=new THREE.BufferGeometry(),count=items.reduce((sum,item)=>sum+item.attributes.position.count,0);
      for(const [name,size]of [['position',3],['normal',3],['uv',2],['color',3]]){
        const values=new Float32Array(count*size);let offset=0;
        for(const item of items){values.set(item.attributes[name].array,offset);offset+=item.attributes[name].array.length;}
        geometry.setAttribute(name,new THREE.BufferAttribute(values,size));
      }
      geometry.name=`NOPE decoy static geometry / ${finish}`;geometry.computeBoundingBox();geometry.computeBoundingSphere();
      bounds.union(geometry.boundingBox);geometries.add(geometry);for(const item of items)item.dispose();
      if(finish==='team')for(const team of ['blue','red'])parts.push(Object.freeze({finish,motion,team,geometry,material:source.cache.materials.get(`team ${team}`)}));
      else parts.push(Object.freeze({finish,motion,team:null,geometry,material:finish==='rifle'?rifleMaterial:source.cache.materials.get(finish)}));
    }
    cache={references:0,source,parts:Object.freeze(parts),geometries,bounds,rifleMaterial};decoyCaches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return {parts:cache.parts,bounds:cache.bounds,dispose(){
    if(released)return;released=true;
    if(--cache.references===0){for(const geometry of cache.geometries)geometry.dispose();cache.rifleMaterial.dispose();cache.source.release();decoyCaches.delete(THREE);}
  }};
}
