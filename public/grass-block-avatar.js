// Original pixel-painted sod and dirt, wrapped around an actual solid cube.
// The existing tactical rig remains the only combat/hit surface.
const caches=new WeakMap();

function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    const geometries=new Set(),materials=new Map(),textures=new Set(),templates=[],chunks=new Map(),transform=new THREE.Object3D();
    const hash=(x,y,s=0)=>{let n=Math.imul(x+137,374761393)^Math.imul(y+83,668265263)^Math.imul(s+1,1274126177);n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;};
    const tile=32,width=tile*3,height=tile*2,data=new Uint8Array(width*height*4);
    for(let face=0;face<6;face++)for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
      const coarse=hash(Math.floor(x/2),Math.floor(y/2),face),fine=hash(x,y,face+11),shade=(coarse%27)-13+(fine%5)-2;
      const depth=31-y,fringe=4+(hash(Math.floor(x/2),0,face+31)%5),green=face===2||(face!==3&&depth<fringe);
      let r,g,b;
      if(green){
        const cluster=hash(Math.floor(x/4),Math.floor(y/4),face+7)%17-8;
        r=79+shade+cluster;g=111+shade+cluster;b=43+Math.floor(shade*.65)+Math.floor(cluster*.5);
        if(face!==2&&depth>1){r-=6;g-=10;b-=3;}
      }else{
        r=126+shade;g=90+Math.floor(shade*.8);b=61+Math.floor(shade*.65);
        const pebble=hash(Math.floor(x/2),Math.floor(y/2),face+71);
        if(pebble%13===0){const stone=104+pebble%30;r=stone;g=stone-1;b=stone-9;}
        else if(pebble%7===0){r-=19;g-=16;b-=12;}
        else if(pebble%11===0){r+=21;g+=17;b+=12;}
        if(face!==3&&depth<fringe+2){r-=14;g-=11;b-=8;}
      }
      const i=(((Math.floor(face/3)*tile+y)*width)+(face%3)*tile+x)*4;
      data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;
    }
    const atlas=new THREE.DataTexture(data,width,height);atlas.name='Grass block surface / original sod and pebbled dirt atlas';atlas.colorSpace=THREE.SRGBColorSpace;
    atlas.magFilter=THREE.NearestFilter;atlas.minFilter=THREE.NearestMipmapNearestFilter;atlas.generateMipmaps=true;atlas.anisotropy=1;atlas.needsUpdate=true;textures.add(atlas);
    const earth=new THREE.MeshStandardMaterial({color:'#ffffff',map:atlas,roughness:1,metalness:0,vertexColors:true});earth.name='Grass block finish / pixel sod and earth';materials.set('earth',earth);
    for(const [id,color]of [['team blue','#66b4be'],['team red','#d18176']]){const m=new THREE.MeshStandardMaterial({color,roughness:.82,metalness:0,vertexColors:true});m.name=`Grass block finish / ${id}`;materials.set(id,m);}
    function part(frame,material,geometry,p=[0,0,0],s=[1,1,1],r=[0,0,0],label=''){
      transform.position.set(...p);transform.scale.set(...s);transform.rotation.set(...r);transform.updateMatrix();
      const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);geometry.dispose();
      const key=`${frame}|${material}`;if(!chunks.has(key))chunks.set(key,{frame,material,label,parts:[]});const chunk=chunks.get(key);if(label&&!chunk.label.includes(label))chunk.label+=(chunk.label?' / ':'')+label;chunk.parts.push(g);
    }
    function box(frame,p,size,label,faceTile=null,light=1,material='earth'){
      const g=new THREE.BoxGeometry(...size),uv=g.getAttribute('uv'),normal=g.getAttribute('normal'),colors=new Float32Array(uv.count*3);
      const bone=frame.startsWith('arm')?[.083,.30/6,.083]:frame.startsWith('fore')?[.065,.33/6,.065]:frame.startsWith('thigh')?[.101,.35/6,.101]:frame.startsWith('shin')?[.079,.32/6,.079]:[1,1,1];
      const world=size.map((value,index)=>value*bone[index]),seed=[...frame+label].reduce((n,char)=>Math.imul(n^char.charCodeAt(0),16777619)>>>0,2166136261);
      // BoxGeometry's six faces are +X,-X,+Y,-Y,+Z,-Z. Each gets a
      // separately painted 32px tile, inset by half a texel to protect seams.
      for(let i=0;i<uv.count;i++){
        const face=Math.floor(i/4),paint=faceTile===null?face:faceTile,u=uv.getX(i),v=uv.getY(i);
        // A hand or a sod lip samples a small piece of earth, never an entire
        // block's worth of pixels. IK segment dimensions are converted from
        // their unit-bone geometry once, with no per-frame UV rewrites.
        const w=face<2?world[2]:world[0],h=face===2||face===3?world[2]:world[1];
        const spanU=faceTile===null?tile-1:Math.min(tile-4,Math.max(.75,w*30)),spanV=faceTile===null?tile-1:Math.min(tile-4,Math.max(.75,h*30));
        const startU=faceTile===null?.5:1.5+hash(face,seed,211)%Math.max(1,Math.floor(tile-spanU-3)),startV=faceTile===null?.5:1.5+hash(face,seed,223)%Math.max(1,Math.floor(tile-spanV-3));
        uv.setXY(i,((paint%3)*tile+startU+u*spanU)/width,(Math.floor(paint/3)*tile+startV+v*spanV)/height);
        const directional=normal.getY(i)>.5?1:normal.getY(i)<-.5?.76:normal.getX(i)<-.5?.90:normal.getZ(i)<-.5?.94:.98;
        colors[i*3]=colors[i*3+1]=colors[i*3+2]=light*directional;
      }
      g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.clearGroups();part(frame,material,g,p,[1,1,1],[0,0,0],label);
    }
    // One metre of uninterrupted sod and soil forms the character itself.
    // Its front stays behind the existing grip points, leaving both hands and
    // most of the held rifle in clear air, even in the interaction pose.
    box('body',[0,1.32,-.31],[1.04,1.08,1.02],'grass top / grass fringe / pebbled dirt cube');
    // A few millimetres of real sod overhang cast a fine natural edge; their
    // stepped lower ends follow the pixel grass instead of adding a border.
    for(let side=0;side<4;side++)for(let i=0;i<8;i++){
      const along=-.455+i*.13,h=.035+(hash(i,side,101)%4)*.012;
      if(side<2)box('body',[along,1.86-h/2,side===0?.202:-.822],[.10,h,.012],'grass fringe sod overhang',2,.96);
      else box('body',[side===2?.522:-.522,1.86-h/2,-.765+i*.13],[.012,h,.10],'grass fringe sod overhang',2,.96);
    }
    // A small cloth team band is an identifier, never a face or a frame.
    box('body',[.336,.888,.204],[.24,.027,.010],'team waist band',3,1,'team');
    for(const side of ['R','L']){
      box('arm'+side,[0,0,0],[1.4,5.8,1.4],'short angular dirt upper arms',3,.94);
      box('fore'+side,[0,0,0],[1.45,5.75,1.45],'short angular dirt forearms',3,1);
      box('hand'+side,[0,0,.003],[.092,.070,.108],'block grip hands',3,1);
      for(let i=0;i<3;i++)box('hand'+side,[-.029+i*.029,-.025,.056],[.025,.035,.040],'stepped grip fingers',3,.96);
      box('hand'+side,[.045,-.001,.018],[.025,.048,.057],'block thumbs',3,.98);
      box('thigh'+side,[0,0,0],[1.5,5.9,1.5],'short angular dirt legs',3,.96);
      box('shin'+side,[0,0,0],[1.55,5.9,1.55],'short angular dirt shins',3,.96);
      box('shoe'+side,[0,-.077,.043],[.18,.078,.25],'square dirt feet',3,1);
      box('shoe'+side,[0,-.113,.044],[.182,.014,.252],'compacted earth soles',3,.72);
    }
    for(const chunk of chunks.values()){
      const p=[],n=[],uv=[],c=[];for(const g of chunk.parts){const a=g.getAttribute('position'),b=g.getAttribute('normal'),d=g.getAttribute('uv'),e=g.getAttribute('color');for(let i=0;i<a.count;i++){p.push(a.getX(i),a.getY(i),a.getZ(i));n.push(b.getX(i),b.getY(i),b.getZ(i));uv.push(d.getX(i),d.getY(i));c.push(e.getX(i),e.getY(i),e.getZ(i));}g.dispose();}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);templates.push({frame:chunk.frame,material:chunk.material,geometry:g,label:chunk.label});
    }
    cache={references:0,geometries,materials,textures,templates};caches.set(THREE,cache);
  }
  cache.references++;let released=false;return {cache,release(){if(released)return;released=true;if(--cache.references===0){for(const g of cache.geometries)g.dispose();for(const m of cache.materials.values())m.dispose();for(const t of cache.textures)t.dispose();caches.delete(THREE);}}};
}

export function createGrassBlockAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group(),frames=new Map();group.name='Grass block avatar / 草ブロック';rig.add(group);
  const sources={body:upper,armR:rightArm.upperArm,armL:leftArm.upperArm,foreR:rightArm.forearm,foreL:leftArm.forearm,handR:rightArm.palm,handL:leftArm.palm,thighR:rightLeg.thigh,thighL:leftLeg.thigh,shinR:rightLeg.shin,shinL:leftLeg.shin,shoeR:rightLeg.boot,shoeL:leftLeg.boot};
  for(const template of cache.templates){if(!frames.has(template.frame)){const frame=new THREE.Group();frame.name=`Grass block avatar frame / ${template.frame}`;frame.matrixAutoUpdate=false;group.add(frame);frames.set(template.frame,frame);}const material=cache.materials.get(template.material==='team'?(team==='blue'?'team blue':'team red'):template.material),mesh=new THREE.Mesh(template.geometry,material);mesh.name=`Grass block avatar / ${template.label}`;mesh.userData.character='veil';mesh.userData.solid=false;mesh.raycast=()=>{};mesh.castShadow=true;mesh.receiveShadow=true;frames.get(template.frame).add(mesh);}
  let disposed=false;
  function update(){if(disposed)return;for(const [name,frame]of frames){const source=sources[name];source.updateMatrix();frame.matrix.copy(source.matrix);frame.matrixWorldNeedsUpdate=true;}}
  function setVisible(value){group.visible=Boolean(value);}
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();release();}
  update();return {group,roots:frames,update,setVisible,dispose};
}
