// One original NOPE drawing is borrowed by station paint and every bottle.
// Browser drawing paths intentionally match the original station artwork.
const artworkCaches = new WeakMap(), bottleCaches = new WeakMap();

function drawArtwork(context) {
  const c = context;
  c.fillStyle = '#fa159f'; c.beginPath(); c.arc(256, 205, 153, 0, Math.PI * 2); c.fill();
  for (const [x,y,l,w] of [[128,287,45,20],[176,317,38,15],[336,292,57,17],[383,272,37,11]]) { c.fillRect(x,y,w,l); c.beginPath(); c.arc(x+w/2,y+l,w/2,0,Math.PI*2); c.fill(); }
  c.strokeStyle = '#10151a'; c.lineWidth = 20; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const x of [198,314]) { c.beginPath(); c.moveTo(x-22,157); c.lineTo(x+22,201); c.moveTo(x+22,157); c.lineTo(x-22,201); c.stroke(); }
  c.beginPath(); c.moveTo(153,227); c.bezierCurveTo(180,290,331,291,360,223); c.stroke();
  c.fillStyle = '#10151a'; c.beginPath(); c.moveTo(232,270); c.lineTo(224,318); c.bezierCurveTo(225,355,279,357,284,318); c.lineTo(293,270); c.closePath(); c.fill();
  c.strokeStyle = '#fa159f'; c.lineWidth = 9; c.beginPath(); c.moveTo(260,285); c.lineTo(254,323); c.stroke();
  c.fillStyle = '#fa159f'; c.font = '900 102px Arial, sans-serif'; c.textAlign = 'center'; c.fillText('NOPE',256,450);
}

// Tests and server-side previews have no canvas. A deterministic raster fallback
// carries the same face vocabulary without adding a DOM or font dependency.
function rasterArtwork(THREE) {
  const size=512,data=new Uint8Array(size*size*4),segments=[];
  const stroke=(ax,ay,bx,by,width,color)=>segments.push({ax,ay,bx,by,width,color});
  for(const x of [198,314]) {stroke(x-22,157,x+22,201,20,'ink');stroke(x+22,157,x-22,201,20,'ink');}
  let previous=[153,227];
  for(let i=1;i<=48;i++){const t=i/48,u=1-t,p=[u*u*u*153+3*u*u*t*180+3*u*t*t*331+t*t*t*360,u*u*u*227+3*u*u*t*290+3*u*t*t*291+t*t*t*223];stroke(...previous,...p,20,'ink');previous=p;}
  stroke(260,285,254,323,9,'pink');
  const letters={N:['10001','11001','10101','10011','10001'],O:['01110','10001','10001','10001','01110'],P:['11110','10001','11110','10000','10000'],E:['11111','10000','11110','10000','11111']};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let color=Math.hypot(x-256,y-205)<=153?'pink':null;
    for(const [a,b,l,w]of [[128,287,45,20],[176,317,38,15],[336,292,57,17],[383,272,37,11]])if(x>=a&&x<=a+w&&y>=b&&y<=b+l||Math.hypot(x-a-w/2,y-b-l)<=w/2)color='pink';
    if(y>=270&&y<=346&&x>=224&&(x<=293)&&((y<318)||(Math.pow((x-254)/30,2)+Math.pow((y-318)/28,2)<=1)))color='ink';
    for(const s of segments){const dx=s.bx-s.ax,dy=s.by-s.ay,t=Math.max(0,Math.min(1,((x-s.ax)*dx+(y-s.ay)*dy)/(dx*dx+dy*dy)));if(Math.hypot(x-s.ax-t*dx,y-s.ay-t*dy)<=s.width/2)color=s.color;}
    const column=Math.floor((x-101)/13),row=Math.floor((y-380)/14);
    if(row>=0&&row<5&&column>=0&&column<23){const letter=Math.floor(column/6),local=column%6;if(letter<4&&local<5&&letters['NOPE'[letter]][row][local]==='1')color='pink';}
    if(color){const index=(y*size+x)*4;data[index]=color==='pink'?250:16;data[index+1]=color==='pink'?21:21;data[index+2]=color==='pink'?159:26;data[index+3]=255;}
  }
  return new THREE.DataTexture(data,size,size);
}

export function acquireNopeArtwork(THREE) {
  let cache=artworkCaches.get(THREE);
  if(!cache){
    let texture;
    if(globalThis.document?.createElement){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const context=canvas.getContext?.('2d');if(context){drawArtwork(context);texture=new THREE.CanvasTexture(canvas);}}
    if(!texture)texture=rasterArtwork(THREE);
    texture.name='NOPE artwork / shared original face';texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1,1);texture.needsUpdate=true;
    cache={texture,references:0};artworkCaches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return {texture:cache.texture,release(){if(released)return;released=true;if(--cache.references===0){cache.texture.dispose();artworkCaches.delete(THREE);}}};
}

function acquireBottle(THREE){
  let cache=bottleCaches.get(THREE);
  if(!cache){
    const artwork=acquireNopeArtwork(THREE),geometries=new Set(),materials=new Set(),templates=[],transform=new THREE.Object3D(),chunks=new Map();
    const shell=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.19,metalness:0,transparent:true,depthWrite:false});shell.name='NOPE bottle finish / smoked PET and dark cola';
    const hardware=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.51,metalness:.08});hardware.name='NOPE bottle finish / black cap and label band';
    const label=new THREE.MeshStandardMaterial({color:'#ffffff',map:artwork.texture,roughness:.82,metalness:0,transparent:true,alphaTest:.025,depthWrite:true});label.name='NOPE bottle finish / original face label';
    for(const material of [shell,hardware,label])materials.add(material);
    function add(key,geometry,p=[0,0,0],r=[0,0,0],color='#ffffff',alpha=1){
      transform.position.set(...p);transform.rotation.set(...r);transform.scale.set(1,1,1);transform.updateMatrix();
      const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);geometry.dispose();
      const rgb=new THREE.Color(color),colors=new Float32Array(g.getAttribute('position').count*4);for(let i=0;i<colors.length;i+=4){colors[i]=rgb.r;colors[i+1]=rgb.g;colors[i+2]=rgb.b;colors[i+3]=alpha;}g.setAttribute('color',new THREE.BufferAttribute(colors,4));
      if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(g);
    }
    const profile=[[.0,.0],[.030,0],[.039,.006],[.043,.018],[.0415,.030],[.043,.036],[.043,.178],[.041,.193],[.030,.214],[.018,.226],[.017,.252],[.0,.252]];
    add('shell',new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),28),[0,0,0],[0,0,0],'#817973',.28);
    // A separate closed liquid surface shares the same batch. Its fill ends
    // below the transparent shoulder, so the bottle reads as cola-filled PET.
    const liquid=[[0,.010],[.032,.010],[.0385,.020],[.0385,.172],[.034,.188],[0,.188]];
    add('shell',new THREE.LatheGeometry(liquid.map(([r,y])=>new THREE.Vector2(r,y)),28),[0,0,0],[0,0,0],'#36180c',1);
    add('hardware',new THREE.CylinderGeometry(.0434,.0434,.124,24,1,true),[0,.129,0],[0,0,0],'#11131a');
    add('hardware',new THREE.CylinderGeometry(.022,.022,.025,20),[0,.2625,0],[0,0,0],'#30313f');
    add('hardware',new THREE.CylinderGeometry(.0223,.0223,.005,20),[0,.248,0],[0,0,0],'#b8bfc3');
    add('hardware',new THREE.TorusGeometry(.0185,.0025,6,24),[0,.277,0],[Math.PI/2,0,0],'#f549ac');
    for(let i=0;i<12;i++){const angle=i*Math.PI/6;add('hardware',new THREE.BoxGeometry(.0035,.017,.003),[Math.sin(angle)*.022,.263,Math.cos(angle)*.022],[0,angle,0],'#525160');}
    const labelGeometry=new THREE.CylinderGeometry(.0438,.0438,.112,28,1,true,-Math.PI*.37,Math.PI*.74);
    add('label',labelGeometry,[0,.129,0]);
    for(const [key,parts]of chunks){const p=[],n=[],uv=[],c=[];for(const g of parts){const a=g.getAttribute('position'),b=g.getAttribute('normal'),d=g.getAttribute('uv'),e=g.getAttribute('color');for(let i=0;i<a.count;i++){p.push(a.getX(i),a.getY(i),a.getZ(i));n.push(b.getX(i),b.getY(i),b.getZ(i));uv.push(d?d.getX(i):0,d?d.getY(i):0);c.push(e.getX(i),e.getY(i),e.getZ(i),e.getW(i));}g.dispose();}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(c,4));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.add(geometry);templates.push({geometry,material:key==='shell'?shell:key==='hardware'?hardware:label,name:key});
    }
    cache={references:0,geometries,materials,templates,artwork};bottleCaches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return {cache,release(){if(released)return;released=true;if(--cache.references===0){for(const g of cache.geometries)g.dispose();for(const m of cache.materials)m.dispose();cache.artwork.release();bottleCaches.delete(THREE);}}};
}

// Local +Y points toward the cap and +Z toward the label. The caller owns the
// flight, visibility and world/camera transform; no gameplay or hit surface lives here.
export function createNopeBottleModel(THREE){
  const {cache,release}=acquireBottle(THREE),group=new THREE.Group();group.name='NOPE bottle / cola PET grenade';
  for(const template of cache.templates){const mesh=new THREE.Mesh(template.geometry,template.material);mesh.name=`NOPE bottle / ${template.name}`;mesh.userData.solid=false;mesh.raycast=()=>{};mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  let disposed=false;
  return {group,grip:[0,.105,0],height:.2795,dispose(){if(disposed)return;disposed=true;group.removeFromParent();release();}};
}
