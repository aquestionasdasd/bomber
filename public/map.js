import { createCollisionIndex } from './collision.js';
import { SITE_AREAS } from './site-areas.js';
import { TACTICAL_BUILDINGS, TACTICAL_PROP_MOVES, createTacticalMetadata } from './tactical-layout.js';
import {createHirakataMap} from './hirakata-map.js';
import {addHashimotoSurvey} from './station-survey-details.js';

export const MAP_CATALOG=Object.freeze([{id:'hashimoto',name:'橋本駅'},{id:'hirakata',name:'枚方市駅'}]);
export function normalizeMapId(id){return id==='hirakata'?'hirakata':'hashimoto';}

// Hand-built two-site Hashimoto station arena. East +X, north -Z.
export function createMap(THREE, scene, id='hashimoto') {
  if(id==='hirakata')return createHirakataMap(THREE,scene);
  const world = new THREE.Group(); world.name = 'HASHIMOTO / North Exit Arena'; scene.add(world);
  const bounds = { minX: -82, maxX: 82, minZ: -82, maxZ: 82 };
  const colliders = [], railingColliders = [], surfaceColliders = [], mapShapes = [], ramps = [], batches = new Map();
  let batchTarget=batches;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1), cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 10), crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const bevelShape=new THREE.Shape();bevelShape.moveTo(-.46,-.46);bevelShape.lineTo(.46,-.46);bevelShape.lineTo(.46,.46);bevelShape.lineTo(-.46,.46);bevelShape.closePath();
  const bevelGeo=new THREE.ExtrudeGeometry(bevelShape,{depth:.92,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.04,bevelThickness:.04,curveSegments:1});bevelGeo.translate(0,0,-.46);
  const mtx = new THREE.Matrix4(), quat = new THREE.Quaternion(), pos = new THREE.Vector3(), size = new THREE.Vector3();
  const standard = (color, roughness = .78, metalness = .04) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const M = {
    stone: standard('#b7bdb6'), ivory: standard('#d6d8c8'), plaster: standard('#c0b8a5'), concrete: standard('#94a4a4'),
    chalk: standard('#e1e3d5'), slate: standard('#566a73'), dark: standard('#283f4d'), black: standard('#192d39'),
    metal: standard('#405965', .45, .42), edge: standard('#72888c', .48, .32), glass: standard('#345d70', .25, .36),
    glassLight: standard('#6c929f', .27, .3), glassShade: standard('#284957', .3, .26), teal: standard('#498d88'), green: standard('#3f8269'),
    coral: standard('#ed5968', .65), mutedCoral: standard('#bb6762'), yellow: standard('#e6c57d'), wood: standard('#9c8060'),
    terracotta: standard('#ab7767'), soil: standard('#4a5b4c'), leaf: standard('#5b7e62'), leafLight: standard('#81976c'), leafDark: standard('#416952'), trunk: standard('#7d6d56'),
    light: new THREE.MeshStandardMaterial({ color: '#fff1c7', emissive: '#ffe4a6', emissiveIntensity: .5, roughness: .6 }),
  };
  function transform(x,y,z,w,h,d,ry=0,rz=0){pos.set(x,y,z);size.set(w,h,d);quat.setFromEuler(new THREE.Euler(0,ry,rz));return mtx.compose(pos,quat,size).clone();}
  function box(x,y,z,w,h,d,mat,ry=0,rz=0,geometry=boxGeo){const key=mat.uuid+':'+geometry.uuid;if(!batchTarget.has(key))batchTarget.set(key,{mat,geometry,entries:[]});batchTarget.get(key).entries.push(transform(x,y,z,w,h,d,ry,rz));}
  function cylinder(x,y,z,r,h,mat){box(x,y,z,r,h,r,mat,0,0,cylinderGeo);}
  function polygon(x,z,w,d,ry=0){const c=Math.cos(ry),s=Math.sin(ry);return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>[x+a*c+b*s,z-a*s+b*c]);}
  function physical(x,y,z,w,h,d,o={}){const p=polygon(x,z,w,d,o.ry||0),c={minX:Math.min(...p.map(v=>v[0])),maxX:Math.max(...p.map(v=>v[0])),minZ:Math.min(...p.map(v=>v[1])),maxZ:Math.max(...p.map(v=>v[1])),height:y+h/2,base:Math.max(0,y-h/2),kind:o.kind||'cover'};if(o.ry)c.polygon=p;colliders.push(c);if(o.minimap!==false)mapShapes.push({polygon:p,color:o.color||'#536e78',kind:c.kind});return c;}
  function solid(x,y,z,w,h,d,mat,o={}){box(x,y,z,w,h,d,mat,o.ry||0);if(o.collide!==false)return physical(x,y,z,w,h,d,o);}
  function railCollider(x,y,z,w,h,d,ry=0){
    const p=polygon(x,z,w,d,ry),c={minX:Math.min(...p.map(v=>v[0])),maxX:Math.max(...p.map(v=>v[0])),minZ:Math.min(...p.map(v=>v[1])),maxZ:Math.max(...p.map(v=>v[1])),height:y+h/2,base:y-h/2,kind:'railing'};
    if(ry)c.polygon=p;
    // Keep the original arena solids in their existing order. Only the visible
    // upper handrail blocks walking; the space beneath it remains open.
    railingColliders.push(c);
  }
  function surface(id,x,z,w,d,base,top){
    // A real roof slab supports landing while its actual underside still leaves
    // the pedestrian route clear. Layered caps retain their visible overhangs.
    surfaceColliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,height:top,base,kind:'surface',surfaceId:id});
  }
  function plane(x,y,z,w,h,mat,rx=0,ry=0){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,0);mesh.receiveShadow=true;world.add(mesh);return mesh;}
  function canvasTexture(draw,w=1024,h=256){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d'),w,h);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;return tex;}
  function textMaterial(draw,w=1024,h=256){return new THREE.MeshBasicMaterial({map:canvasTexture(draw,w,h),transparent:true,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});}
  function label(text,sub,x,y,z,w,h,color='#e8ece0',bg='#29434e',ry=0){const mat=textMaterial((ctx,cw,ch)=>{ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 92px "Yu Gothic", "Meiryo", sans-serif';ctx.fillText(text,cw/2,sub?99:130);if(sub){ctx.font='500 33px "Segoe UI", sans-serif';ctx.fillText(sub,cw/2,195);}ctx.fillStyle='#89a29f';ctx.fillRect(18,ch-10,cw-36,3);});return plane(x,y,z,w,h,mat,0,ry);}
  const bannerMat=textMaterial((ctx,w,h)=>{ctx.fillStyle='#ed5968';ctx.fillRect(0,0,w,h);ctx.fillStyle='#273c4a';ctx.beginPath();ctx.moveTo(w*.16,h*.18);ctx.lineTo(w*.49,h*.52);ctx.lineTo(w*.49,h*.78);ctx.lineTo(w*.16,h*.47);ctx.fill();ctx.beginPath();ctx.moveTo(w*.83,h*.35);ctx.lineTo(w*.57,h*.62);ctx.lineTo(w*.57,h*.78);ctx.lineTo(w*.83,h*.55);ctx.fill();ctx.fillStyle='#f1dbc8';ctx.fillRect(w*.16,h*.91,w*.67,3);},256,768);
  function banner(x,y,z,w,h,ry=0){plane(x,y,z,w,h,bannerMat,0,ry);}
  const paving=canvasTexture((ctx,w,h)=>{ctx.fillStyle='#9aa7a5';ctx.fillRect(0,0,w,h);for(let row=0;row<8;row++)for(let col=0;col<8;col++){const v=156+((row*23+col*17)%17);ctx.fillStyle='rgb('+v+','+(v+8)+','+(v+6)+')';ctx.fillRect(col*64+1,row*64+1,62,62);ctx.fillStyle='rgba(239,243,226,.21)';ctx.fillRect(col*64+2,row*64+2,60,1);ctx.fillStyle='rgba(56,79,78,.1)';ctx.fillRect(col*64+2,row*64+61,60,1);}},512,512);
  paving.wrapS=paving.wrapT=THREE.RepeatWrapping;paving.repeat.set(18,18);
  const pavingMat=new THREE.MeshStandardMaterial({map:paving,roughness:.96,color:'#d0d4c7'});
  const asphaltTex=canvasTexture((ctx,w,h)=>{ctx.fillStyle='#53656b';ctx.fillRect(0,0,w,h);for(let i=0;i<1800;i++){const v=73+i%25;ctx.fillStyle='rgb('+v+','+(v+14)+','+(v+19)+')';ctx.fillRect((i*71)%w,(i*163)%h,1+i%2,1);}},256,256);
  asphaltTex.wrapS=asphaltTex.wrapT=THREE.RepeatWrapping;asphaltTex.repeat.set(12,12);const asphalt=new THREE.MeshStandardMaterial({map:asphaltTex,roughness:.99});
  const brickTex=canvasTexture((ctx,w,h)=>{ctx.fillStyle='#7a7569';ctx.fillRect(0,0,w,h);for(let r=0;r<12;r++)for(let c=-1;c<8;c++){const x=c*70+(r%2)*35,y=r*43,v=(r*13+c*11)%16;ctx.fillStyle='rgb('+(142+v)+','+(106+v)+','+(91+v)+')';ctx.fillRect(x+2,y+2,67,40);ctx.fillStyle='rgba(235,217,187,.13)';ctx.fillRect(x+3,y+3,65,1);}},512,512);
  brickTex.wrapS=brickTex.wrapT=THREE.RepeatWrapping;brickTex.repeat.set(5,3);const brick=new THREE.MeshStandardMaterial({map:brickTex,roughness:.94});
  // Material grain stays restrained; construction joints and real recesses carry the larger detail.
  function grainTexture(kind) {
    return canvasTexture((ctx,w,h)=>{
      ctx.fillStyle=kind==='wood'?'#e7dcc2':'#e2e4dc';ctx.fillRect(0,0,w,h);
      for(let i=0;i<3600;i++){
        const x=(i*73)%w,y=(i*151+Math.floor(i/7)*19)%h;
        if(kind==='wood'){ctx.fillStyle=i%3?'rgba(67,47,29,.16)':'rgba(238,222,187,.2)';ctx.fillRect(x,y,8+i%47,1);}
        else{ctx.fillStyle=i%3?'rgba(59,71,68,.065)':'rgba(255,255,241,.28)';ctx.fillRect(x,y,1+i%2,1+i%2);}
      }
      if(kind==='concrete')for(let i=0;i<15;i++){ctx.fillStyle='rgba(64,75,69,.035)';ctx.fillRect((i*91)%w,0,2+i%4,h);}
    },512,512);
  }
  const stoneGrain=grainTexture('stone'),concreteGrain=grainTexture('concrete'),woodGrain=grainTexture('wood');
  for(const t of [stoneGrain,concreteGrain,woodGrain]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);}
  woodGrain.repeat.set(2,1);
  M.stone.map=stoneGrain;M.ivory.map=stoneGrain;M.plaster.map=concreteGrain;M.concrete.map=concreteGrain;M.wood.map=woodGrain;
  M.stone.roughness=.91;M.concrete.roughness=.96;M.wood.roughness=.73;
  for(const m of [M.stone,M.ivory]){m.bumpMap=stoneGrain;m.bumpScale=.018;}
  for(const m of [M.plaster,M.concrete]){m.bumpMap=concreteGrain;m.bumpScale=.023;}
  M.wood.bumpMap=woodGrain;M.wood.bumpScale=.018;M.wood.roughnessMap=woodGrain;
  const reflectionFaces=Array.from({length:6},(_,face)=>{
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
    for(let y=0;y<128;y++){const t=face===2?y/420:face===3?.93:y/128;const v=Math.floor(218-t*65);ctx.fillStyle='rgb('+(v-28)+','+(v-8)+','+(v+1)+')';ctx.fillRect(0,y,128,1);}
    if(face!==2&&face!==3){ctx.fillStyle='#788a8a';ctx.fillRect(0,83,128,45);for(let i=0;i<7;i++){const x=i*21-5,h=10+(i*17+face*11)%28;ctx.fillStyle=i%2?'#6b8188':'#91a3a5';ctx.fillRect(x,83-h,17,h);ctx.fillStyle='#b0beb8';ctx.fillRect(x,83-h,17,2);}ctx.fillStyle='rgba(220,227,208,.24)';ctx.fillRect(0,91,128,2);}
    return c;
  });
  const reflectionEnv=new THREE.CubeTexture(reflectionFaces);reflectionEnv.colorSpace=THREE.SRGBColorSpace;reflectionEnv.needsUpdate=true;
  for(const m of [M.glass,M.glassLight,M.glassShade]){m.envMap=reflectionEnv;m.envMapIntensity=.42;}
  for(const m of [M.metal,M.edge]){m.envMap=reflectionEnv;m.envMapIntensity=.22;}
  const reflectionTex=canvasTexture((ctx,w,h)=>{
    for(let y=0;y<h;y++){const t=y/h,v=234-Math.floor(t*91);ctx.fillStyle='rgb('+(v-14)+','+(v+1)+','+(v+8)+')';ctx.fillRect(0,y,w,1);}
    ctx.fillStyle='rgba(234,247,243,.21)';ctx.beginPath();ctx.moveTo(0,30);ctx.lineTo(w,94);ctx.lineTo(w,135);ctx.lineTo(0,71);ctx.fill();
    ctx.fillStyle='rgba(20,43,54,.23)';ctx.fillRect(0,h*.79,w,h*.21);
  },256,256);
  M.glass.map=reflectionTex;M.glassLight.map=reflectionTex;M.glassShade.map=reflectionTex;
  M.glass.color.set('#6b8c9b');M.glassLight.color.set('#92abb2');M.glassShade.color.set('#466675');
  paving.repeat.set(30,30);
  // Packed surface channels: red is millimetre relief, green is dry roughness.
  // The joints stay rough rather than becoming shiny dark grooves.
  function groundSurface(tiled,repeat){
    const n=256,data=new Uint8Array(n*n*4);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const index=(y*n+x)*4,grain=((x*29+y*73+x*y*3)%19)-9;
      const edge=Math.min(x%32,y%32,31-x%32,31-y%32),joint=tiled&&edge<1;
      data[index]=joint?73:Math.max(0,Math.min(255,(tiled?208:151)+grain*(tiled?.48:1.8)-(tiled&&edge<2?14:0)));
      data[index+1]=joint?249:Math.max(0,Math.min(255,(tiled?231:235)+grain*.65));
      data[index+2]=0;data[index+3]=255;
    }
    const texture=new THREE.DataTexture(data,n,n);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeat,repeat);
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=8;texture.needsUpdate=true;return texture;
  }
  const pavingSurface=groundSurface(true,30),asphaltSurface=groundSurface(false,12);
  pavingMat.bumpMap=pavingSurface;pavingMat.bumpScale=.012;pavingMat.roughnessMap=pavingSurface;
  asphalt.bumpMap=asphaltSurface;asphalt.bumpScale=.006;asphalt.roughnessMap=asphaltSurface;
  const terrazzoTex=canvasTexture((ctx,w,h)=>{
    ctx.fillStyle='#aeb7ae';ctx.fillRect(0,0,w,h);
    for(let i=0;i<2600;i++){ctx.fillStyle=['#d1d4c4','#899b99','#b9bca9','#dfe0cc'][i%4];ctx.fillRect((i*97)%w,(i*191+Math.floor(i/11)*13)%h,1+i%3,1+i%2);}
    ctx.fillStyle='#798e8c';ctx.fillRect(0,0,w,2);ctx.fillRect(0,0,2,h);ctx.fillStyle='#cbd0be';ctx.fillRect(3,3,w-4,1);
  },512,512);
  terrazzoTex.wrapS=terrazzoTex.wrapT=THREE.RepeatWrapping;terrazzoTex.repeat.set(24,50);
  // Honed stone catches light at the aggregate while the narrow cement joints
  // stay dry. Red carries millimetre relief; green carries surface roughness.
  const terrazzoSurfaceData=new Uint8Array(256*256*4);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const i=(y*256+x)*4,grain=((x*29+y*73+x*y*3)%19)-9;
    terrazzoSurfaceData[i]=204+Math.round(grain*.15);terrazzoSurfaceData[i+1]=171+Math.round(grain*.35);terrazzoSurfaceData[i+2]=0;terrazzoSurfaceData[i+3]=255;
  }
  // Match the positions of the existing pale/dark aggregate in the color map.
  for(let i=0;i<2600;i++){
    const x=Math.floor(((i*97)%512)/2),y=Math.floor(((i*191+Math.floor(i/11)*13)%512)/2),width=Math.ceil((1+i%3)/2);
    for(let dx=0;dx<width&&x+dx<256;dx++){const at=(y*256+x+dx)*4;terrazzoSurfaceData[at]=205+i%4;terrazzoSurfaceData[at+1]=147+(i%4)*5;}
  }
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const edge=Math.min(x,y,255-x,255-y),i=(y*256+x)*4;
    if(edge===0){terrazzoSurfaceData[i]=82;terrazzoSurfaceData[i+1]=244;}
    else if(edge===1){terrazzoSurfaceData[i]=181;terrazzoSurfaceData[i+1]=211;}
    else if(edge===2){terrazzoSurfaceData[i]=198;terrazzoSurfaceData[i+1]=183;}
  }
  const terrazzoSurface=new THREE.DataTexture(terrazzoSurfaceData,256,256);terrazzoSurface.name='Concourse / honed terrazzo surface';
  terrazzoSurface.wrapS=terrazzoSurface.wrapT=THREE.RepeatWrapping;terrazzoSurface.repeat.copy(terrazzoTex.repeat);
  terrazzoSurface.magFilter=THREE.LinearFilter;terrazzoSurface.minFilter=THREE.LinearMipmapLinearFilter;terrazzoSurface.generateMipmaps=true;terrazzoSurface.anisotropy=8;terrazzoSurface.needsUpdate=true;
  const terrazzo=new THREE.MeshStandardMaterial({map:terrazzoTex,bumpMap:terrazzoSurface,bumpScale:.003,roughnessMap:terrazzoSurface,roughness:.9,envMap:reflectionEnv,envMapIntensity:.12});
  terrazzo.name='Concourse / honed terrazzo';
  const guideTex=canvasTexture((ctx,w,h)=>{
    ctx.fillStyle='#c4b16e';ctx.fillRect(0,0,w,h);ctx.fillStyle='#9c8b52';ctx.fillRect(0,0,3,h);ctx.fillRect(w-3,0,3,h);
    for(let x=19;x<w;x+=31){ctx.fillStyle='#927f4d';ctx.fillRect(x,10,8,h-20);ctx.fillStyle='#e4d08a';ctx.fillRect(x-2,8,6,h-20);}ctx.fillStyle='#9c8b52';ctx.fillRect(0,h-3,w,3);
  },256,256);
  guideTex.wrapS=guideTex.wrapT=THREE.RepeatWrapping;guideTex.repeat.set(1,50);const guideMat=new THREE.MeshStandardMaterial({map:guideTex,roughness:.88});
  plane(0,-.025,0,164,164,pavingMat,-Math.PI/2).userData.solid=true;
  plane(-58,-.012,24,26,95,asphalt,-Math.PI/2);plane(57,-.011,26,25,90,asphalt,-Math.PI/2);plane(0,-.01,65,58,23,asphalt,-Math.PI/2);
  // Local use and drainage marks sit flush with the existing ground. They add
  // neither collision nor bullet occlusion and leave most of the plaza clean.
  const groundDetailGeo=new THREE.PlaneGeometry(1,1);groundDetailGeo.rotateX(-Math.PI/2);
  const wearTex=canvasTexture((ctx,w,h)=>{
    ctx.clearRect(0,0,w,h);
    for(let i=0;i<21;i++){ctx.fillStyle='rgba(92,86,68,.009)';ctx.beginPath();ctx.ellipse(w*(.48+i*.001),h*.51,w*(.47-i*.015),h*(.43-i*.014),-.12,0,Math.PI*2);ctx.fill();}
    for(let i=0;i<93;i++){const x=w*(.17+((i*37)%97)/147),y=h*(.18+((i*61)%101)/158);ctx.fillStyle=i%3?'rgba(92,88,71,.024)':'rgba(217,218,193,.048)';ctx.fillRect(x,y,2+i%6,1+i%2);}
  },256,256);
  const runoffTex=canvasTexture((ctx,w,h)=>{
    ctx.clearRect(0,0,w,h);
    for(let i=0;i<19;i++){ctx.fillStyle='rgba(62,78,72,.011)';ctx.beginPath();ctx.ellipse(w*(.48-i*.001),h*(.39+i*.001),w*(.42-i*.017),h*(.52-i*.02),.1,0,Math.PI*2);ctx.fill();}
    for(let i=0;i<21;i++){ctx.fillStyle=i%3?'rgba(77,85,69,.025)':'rgba(112,113,86,.025)';const x=w*(.24+((i*19)%37)/73);ctx.fillRect(x,h*.14,1+i%2,h*(.23+((i*13)%29)/80));}
  },256,256);
  const grateTex=canvasTexture((ctx,w,h)=>{
    ctx.fillStyle='#8a9388';ctx.fillRect(0,0,w,h);ctx.fillStyle='#52645f';ctx.fillRect(5,5,w-10,h-10);ctx.fillStyle='#a8b2a0';ctx.fillRect(8,8,w-16,4);ctx.fillRect(8,8,4,h-16);
    ctx.fillStyle='#233c40';ctx.fillRect(23,23,w-46,h-46);
    for(let x=29;x<w-25;x+=20){ctx.fillStyle='#63776f';ctx.fillRect(x,23,8,h-46);ctx.fillStyle='#a6b2a0';ctx.fillRect(x,23,2,h-46);ctx.fillStyle='#3c534e';ctx.fillRect(x+6,23,2,h-46);}
    for(const y of[h*.33,h*.67]){ctx.fillStyle='#5d7169';ctx.fillRect(23,y,w-46,9);ctx.fillStyle='#9aa996';ctx.fillRect(23,y,w-46,2);}
    for(const x of[15,w-15])for(const y of[15,h-15]){ctx.fillStyle='#344d48';ctx.beginPath();ctx.arc(x,y,4.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a7b1a1';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-2,y+1);ctx.lineTo(x+2,y-1);ctx.stroke();}
  },512,256);
  const wearMat=new THREE.MeshStandardMaterial({map:wearTex,transparent:true,depthWrite:false,roughness:.97,polygonOffset:true,polygonOffsetFactor:-1});
  const runoffMat=new THREE.MeshStandardMaterial({map:runoffTex,transparent:true,depthWrite:false,roughness:.93,polygonOffset:true,polygonOffsetFactor:-1});
  const grateMat=new THREE.MeshStandardMaterial({map:grateTex,roughness:.74,metalness:.28,envMap:reflectionEnv,envMapIntensity:.15});
  const groundDetailMaterials=new Set([wearMat,runoffMat,grateMat]);
  for(const [x,z,w,d,ry]of[[-20.75,-25.6,9.2,5.2,.08],[-26,-17.7,4.5,7.5,-.22],[44.9,-12.2,4.4,3.1,.45],[-10.2,31,3.5,7.4,.04]])box(x,-.006,z,w,1,d,wearMat,ry,0,groundDetailGeo);
  for(const [x,z,ry]of[[-44.7,6.8,Math.PI/2],[-44.7,28.6,Math.PI/2],[-44.7,45,Math.PI/2],[44.7,9,-Math.PI/2],[44.7,29,-Math.PI/2],[44.7,44,-Math.PI/2],[-60,-26.7,0],[-9,-26.7,0]]){
    box(x,-.004,z,1.16,1,.57,grateMat,ry,0,groundDetailGeo);
    const dx=Math.sin(ry)*.68,dz=Math.cos(ry)*.68;box(x+dx,-.007,z+dz,1.05,1,1.8,runoffMat,ry,0,groundDetailGeo);
  }
  mapShapes.push({x:0,z:0,w:164,d:164,color:'#a4b3ae',kind:'floor'},{x:-58,z:24,w:26,d:95,color:'#4d626a',kind:'road'},{x:57,z:26,w:25,d:90,color:'#4d626a',kind:'road'});
  for(const x of [-72,-44,44,71])box(x,.035,25,.3,.07,91,M.ivory);
  for(const x of [-11,11])box(x,.015,31,.24,.028,62,M.chalk);
  for(const x of [-4.5,4.5])box(x,.02,-3,.3,.035,20,M.yellow);
  for(let z=54;z>=-16;z-=10)for(const x of [-58,57])box(x,.015,z,.16,.022,4,M.ivory);
  for(let i=0;i<9;i++)box(54+i*.7,.02,47,.38,.03,8.5,M.chalk);
  for(const x of [-13,13]){box(x,.013,24,.3,.025,66,M.dark);for(let z=-6;z<=56;z+=3)box(x,.032,z,.35,.025,.1,M.edge);}
  // Two masonry wings and an overhead lintel leave a fully usable concourse.
  physical(-43.5,6.2,-48,31,12.4,30,{kind:'building'});physical(-1,6.2,-48,25,12.4,30,{kind:'building'});
  // Glazed station-side rooms sit behind the same collision footprint as the original walls.
  box(-44.7,6.2,-48,28.6,12.4,30,M.stone);box(-29.2,6.2,-58,2.4,12.4,10,M.stone);box(-29.2,6.2,-35.5,2.4,12.4,5,M.stone);box(-29.2,8.1,-45.5,2.4,8.6,15,M.stone);
  box(.2,6.2,-48,22.6,12.4,30,M.stone);box(-12.3,6.2,-59.5,2.4,12.4,7,M.stone);box(-12.3,6.2,-36,2.4,12.4,6,M.stone);box(-12.3,8.1,-47.5,2.4,8.6,17,M.stone);
  physical(-20.75,8.8,-48,14.5,7.2,30,{kind:'overhead'});
  // A recessed glazed transom and deep jambs frame the entrance above the existing deck.
  box(-20.75,8.8,-48.55,14.5,7.2,28.9,M.stone);
  box(-20.75,6.94,-34.07,14.4,2.96,.12,M.dark);box(-20.75,6.94,-33.13,14.15,2.72,.09,M.glassLight);
  for(const x of[-26.05,-22.5,-18.95,-15.4]){box(x,6.94,-33.05,.115,2.92,.2,M.metal);box(x,6.94,-33.0,.04,2.7,.04,M.edge);}
  for(const x of[-28.35,-13.15]){box(x,8.2,-33.24,.55,8.4,.38,M.ivory);box(x,8.2,-33.02,.08,8.4,.06,M.edge);}
  box(-20.75,8.52,-33.23,15.25,.24,.4,M.ivory);box(-20.75,11.92,-33.3,20.7,.5,.55,M.ivory);
  box(-20.75,10.18,-33.08,20.25,3.0,.18,M.plaster);box(-20.75,10.18,-32.94,19.72,2.76,.14,M.ivory);
  box(-20,12.65,-48,81.5,.5,31,M.ivory);
  function stationWingStrip(y,z,w,h,d,mat){for(const [a,b]of[[-20-w/2,-29.6],[-11.9,-20+w/2]])box((a+b)/2,y,z,b-a,h,d,mat);}
  stationWingStrip(5.6,-30.6,79,.45,5.5,M.metal);stationWingStrip(5.87,-30.6,79.5,.1,5.8,M.ivory);stationWingStrip(5.32,-28.3,76,.1,.14,M.yellow);
  // A normal jump reaches this4.45m roof from the3.2m deck. Recess its front
  // edge to keep a full standing-height walking strip in front of the low slab.
  box(-20.75,4.225,-32,17.4,.28,2.1,M.metal);box(-20.75,4.405,-32,17.8,.09,2.2,M.ivory);box(-20.75,4.235,-30.89,17.15,.11,.1,M.green);
  box(-20.75,4.035,-32,16.7,.08,1.9,M.wood);for(let x=-28.5;x<-13;x+=.56)box(x,3.975,-32,.055,.065,1.9,M.dark);
  for(const x of[-27.65,-13.85])box(x,3.915,-32,.08,.07,1.8,M.light);
  for(const z of [-29.1,-31.7])stationWingStrip(5.28,z,74,.1,.12,M.light);
  for(let x=-57;x<=10;x+=5.4){box(x,8.5,-32.96,.065,7.7,.06,M.concrete);if(x<-33.2||x>-9){box(x,8.4,-32.85,3.6,2.3,.22,M.metal);box(x,8.4,-32.7,3.2,1.95,.1,M.glassShade);box(x,8.4,-32.61,.09,2.05,.08,M.edge);box(x,8.4,-32.6,3.2,.08,.05,M.edge);box(x,7.15,-32.58,3.85,.15,.5,M.ivory);}}
  for(const y of [2.7,6.2,10.6])box(-20,y,-32.94,78,.05,.08,M.concrete);
  for(const [x,w]of[[-43.5,31],[-1,25]]){
    box(x,.22,-32.965,w,.44,.13,M.slate);box(x,.47,-32.93,w,.06,.18,M.ivory);
    for(const y of[1.16,2.74])box(x,y,-32.965,w,.035,.08,M.concrete);
    for(let xx=x-w/2+2.7;xx<x+w/2-.5;xx+=2.7)box(xx,1.58,-32.968,.028,2.14,.07,M.concrete);
  }
  box(-43,15.8,-49,14.5,6.3,11.5,M.stone);box(-43,19.15,-49,15.2,.35,12,M.ivory);box(-43,21.9,-49,.22,5.4,.22,M.metal);box(-43,22.4,-49,4.8,.12,.12,M.metal);box(-43,21.3,-49,3.5,.1,.1,M.metal);
  for(const x of [-49.5,-36.5])for(const z of [-54,-44])box(x,20.05,z,.12,1.6,.12,M.metal);box(-43,20.8,-44,13,.12,.12,M.metal);box(-43,20.8,-54,13,.12,.12,M.metal);
  const stationSign=textMaterial((ctx,w,h)=>{ctx.fillStyle='#d7ddcc';ctx.fillRect(0,0,w,h);ctx.fillStyle='#2b8460';ctx.font='italic 900 150px Arial';ctx.fillText('JR',38,182);ctx.fillStyle='#2e4651';ctx.font='700 81px "Yu Gothic", sans-serif';ctx.fillText('橋 本 駅',285,117);ctx.font='600 40px "Segoe UI", sans-serif';ctx.fillText('Hashimoto Station',280,191);ctx.fillStyle='#438a68';ctx.fillRect(0,h-11,w,11);});
  plane(-20.75,10.18,-32.83,19.4,2.62,stationSign);label('北口','NORTH EXIT / JR · KEIO',-50,1.83,-32.8,8.6,1.6);label('A  コンコース','NORTH CONCOURSE',-20.5,4.12,-33.89,11.5,1.2,'#273f48','#e9cb7c');
  const jrWayfinding=label('↑  JR 横浜線 · 相模線','YOKOHAMA LINE / SAGAMI LINE',-20.5,3.7,-58,11,1.6,'#f0efda','#335c4c');
  jrWayfinding.name='JR concourse wayfinding / printed front';jrWayfinding.material.side=THREE.FrontSide;
  // Only this suspended board needs an unprinted rear: two-sided lettering
  // otherwise appears mirrored when defenders enter from the rear passage.
  const jrWayfindingBack=new THREE.Mesh(jrWayfinding.geometry,M.metal);
  jrWayfindingBack.name='JR concourse wayfinding / metal back';jrWayfindingBack.position.set(-20.5,3.7,-58.012);jrWayfindingBack.rotation.y=Math.PI;
  jrWayfindingBack.receiveShadow=true;jrWayfindingBack.userData.solid=false;jrWayfindingBack.raycast=()=>{};world.add(jrWayfindingBack);
  const portalWayfinding=textMaterial((ctx,w,h)=>{
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#6ca984';ctx.fillRect(0,15,18,h-30);ctx.textAlign='center';ctx.fillStyle='#e7ecde';ctx.font='700 62px "Yu Gothic",sans-serif';ctx.fillText('駅コンコース',w*.45,83);ctx.font='500 30px Arial';ctx.fillText('STATION CONCOURSE',w*.45,137);ctx.fillStyle='#94bd9c';ctx.font='700 103px Arial';ctx.fillText('↑',w*.88,131);ctx.fillRect(30,h-11,w-60,3);
  },1024,192);
  plane(-20.75,6.05,-32.89,13.55,1.45,portalWayfinding);
  plane(-20.75,.005,-48,14.3,30,terrazzo,-Math.PI/2).name='Concourse / terrazzo floor';
  const portalFloor=plane(-20.75,.008,-30.4,14.3,5.2,terrazzo,-Math.PI/2);portalFloor.name='Concourse / terrazzo threshold';
  // Continue the same ~60cm stone modules through the short entrance slab.
  // UVs change, never its positions or its established collision/ray surface.
  const portalUV=portalFloor.geometry.getAttribute('uv');for(let i=0;i<portalUV.count;i++)portalUV.setY(i,(portalUV.getY(i)-1)*5.2/30);portalUV.needsUpdate=true;
  plane(-20.75,.024,-43.6,.6,38,guideMat,-Math.PI/2);
  for(const z of [-37,-44,-51,-58]){for(const x of [-27.7,-13.8]){box(x,2.45,z,.22,4.9,.8,M.metal);box(x,2.2,z,.27,4.2,.5,M.glassShade);}box(-20.75,5.05,z,10.6,.09,.32,M.light);}
  // Acoustic ceiling cassettes, skirting and a regular tiled rhythm establish an indoor space.
  for(let z=-34.5;z>-62;z-=2.4){box(-20.75,5.13,z,13.6,.11,2.24,M.ivory);box(-20.75,5.055,z,11.6,.035,.06,M.edge);}
  for(const x of [-26.4,-15.1])box(x,5.01,-48,.18,.07,28.5,M.light);
  for(const x of [-27.86,-13.64]){box(x,.18,-48,.1,.36,30,M.slate);box(x,3.9,-48,.14,.15,30,M.ivory);}
  for(let z=-34;z>-63;z-=1.8){box(-26.9,.012,z,.6,.025,.035,M.slate);box(-14.6,.012,z,.6,.025,.035,M.slate);}
  const clearGlass=new THREE.MeshStandardMaterial({color:'#96bfc5',roughness:.16,metalness:.14,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
  clearGlass.envMap=reflectionEnv;clearGlass.envMapIntensity=.26;
  plane(-27.97,1.88,-45.5,14.8,3.7,clearGlass,0,Math.PI/2);plane(-13.53,1.88,-47.5,16.8,3.7,clearGlass,0,-Math.PI/2);
  for(const z of [-52.5,-49.5,-46.5,-43.5,-40]){
    box(-27.9,1.85,z,.13,3.7,.11,M.metal);box(-13.57,1.85,z,.13,3.7,.11,M.metal);
    box(-27.87,1.3,z,.06,.12,2.7,M.ivory);box(-13.59,1.3,z,.06,.12,2.7,M.ivory);
  }
  // The gate bank is enclosed on the track side, leaving the public through-route untouched.
  box(-11.24,1.9,-47.5,.1,3.8,17,M.dark);box(-30.31,1.9,-45.5,.1,3.8,15,M.plaster);
  for(const z of [-52.3,-49.6,-46.9,-44.2]){
    box(-12.38,.58,z,1.55,1.16,.49,M.edge);box(-12.38,1.18,z,1.62,.1,.55,M.black);
    box(-12.9,1.25,z,.28,.07,.31,M.teal);box(-12.55,.63,z+.59,.08,.56,.68,M.teal);
    box(-13.19,.8,z,.06,.23,.21,M.light);
  }
  for(const z of [-51.6,-48.6,-45.6,-42.6]){
    box(-29.27,.8,z,1.35,1.6,2.4,M.wood);box(-29.28,1.66,z,1.4,.13,2.5,M.ivory);
    for(let i=0;i<4;i++){box(-29.2,1.87+i*.13,z-.76+i*.44,.43,.13,.27,i%2?M.terracotta:M.yellow);}
    box(-29.34,2.85,z,.8,.14,2.5,M.light);
  }
  label('JR線 改札','TICKET GATES / IC CARD',-13.62,3.35,-47.5,13.8,.78,'#e5eddb','#376a52',-Math.PI/2);
  label('BAKERY / NEWDAYS','COFFEE · DAILY GOODS',-27.83,3.35,-45.5,12.7,.78,'#efe2c7','#79604d',Math.PI/2);
  const boardMat=textMaterial((ctx,w,h)=>{
    ctx.fillStyle='#233f46';ctx.fillRect(0,0,w,h);ctx.fillStyle='#438c62';ctx.fillRect(0,0,24,h);ctx.fillStyle='#edecce';ctx.font='700 65px "Yu Gothic",sans-serif';ctx.fillText('JR  横浜線・相模線',49,77);ctx.font='500 31px Arial';ctx.fillText('1–2   YOKOHAMA LINE     →',50,137);ctx.fillText('3     SAGAMI LINE        →',50,195);
  });
  plane(-20.75,4.03,-39.6,7.8,1.2,boardMat);box(-20.75,4.67,-39.6,8.1,.08,.14,M.metal);
  for(const x of [-23.7,-17.8])box(x,4.9,-39.6,.06,.55,.06,M.metal);
  const clockMat=textMaterial((ctx,w,h)=>{
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#405962';ctx.beginPath();ctx.arc(w/2,h/2,w*.47,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e6e7d4';ctx.beginPath();ctx.arc(w/2,h/2,w*.42,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#3b535c';ctx.lineWidth=5;
    for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(w/2+Math.sin(a)*w*.34,h/2-Math.cos(a)*h*.34);ctx.lineTo(w/2+Math.sin(a)*w*.38,h/2-Math.cos(a)*h*.38);ctx.stroke();}ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(w/2,h/2);ctx.lineTo(w*.67,h*.34);ctx.moveTo(w/2,h/2);ctx.lineTo(w*.27,h*.38);ctx.stroke();
  },256,256);
  plane(-24.7,4.12,-35.8,.95,.95,clockMat);
  // Flush ticket machines and a lit vending display give the plaza side a human scale.
  function machine(x,z,vending=false){
    solid(x,1.05,z,1.12,2.1,.68,vending?M.ivory:M.edge,{kind:'station-machine',minimap:false});
    box(x,1.18,z+.36,.92,1.58,.06,M.dark);box(x,1.47,z+.405,.75,.7,.04,M.glassLight);box(x,2.02,z+.38,.93,.12,.06,vending?M.coral:M.green);
    if(vending){for(let row=0;row<3;row++)for(let col=0;col<4;col++){box(x-.28+col*.18,1.79-row*.31,z+.45,.11,.21,.05,[M.teal,M.ivory,M.coral,M.yellow][(row+col)%4]);}box(x,.35,z+.42,.69,.18,.05,M.black);}
    else{box(x,1.48,z+.43,.64,.41,.025,M.teal);box(x,.9,z+.43,.61,.13,.03,M.black);box(x,.54,z+.44,.4,.1,.03,M.black);box(x+.35,1.07,z+.45,.1,.12,.03,M.yellow);}
  }
  machine(1,-32.48);machine(2.35,-32.48);machine(6.8,-32.45,true);machine(8.15,-32.45,true);
  label('きっぷ・ICチャージ','TICKETS / IC CARD',1.7,2.65,-32.15,3.8,.6,'#e8ead6','#3f6755');
  const areaGuide=textMaterial((ctx,w,h)=>{
    ctx.fillStyle='#e4e7d7';ctx.fillRect(0,0,w,h);ctx.fillStyle='#2f545b';ctx.fillRect(0,0,w,72);ctx.fillStyle='#e8ecd9';ctx.font='700 32px "Yu Gothic",sans-serif';ctx.fillText('北口周辺案内 / NORTH EXIT',28,48);
    ctx.fillStyle='#b8c9be';ctx.fillRect(30,100,w-60,h-130);ctx.strokeStyle='#f2f0dc';ctx.lineWidth=23;ctx.beginPath();ctx.moveTo(w*.15,h*.56);ctx.lineTo(w*.85,h*.56);ctx.moveTo(w*.46,h*.3);ctx.lineTo(w*.46,h*.88);ctx.stroke();
    ctx.fillStyle='#5e797e';ctx.fillRect(w*.2,h*.25,w*.55,h*.15);ctx.fillStyle='#477e72';ctx.fillRect(w*.7,h*.62,w*.17,h*.2);ctx.fillStyle='#a48e79';ctx.fillRect(w*.13,h*.63,w*.18,h*.18);
    ctx.fillStyle='#2d4e55';ctx.font='700 29px "Yu Gothic",sans-serif';ctx.fillText('橋本駅',w*.37,h*.35);ctx.font='600 23px Arial';ctx.fillText('BUS',w*.15,h*.75);ctx.fillText('mewe',w*.71,h*.74);ctx.fillStyle='#d36168';ctx.beginPath();ctx.arc(w*.46,h*.56,11,0,Math.PI*2);ctx.fill();ctx.font='600 20px "Yu Gothic",sans-serif';ctx.fillText('現在地',w*.5,h*.61);
  },768,512);
  box(-37.8,1.7,-32.91,6.5,2.6,.17,M.metal);plane(-37.8,1.7,-32.8,6.2,2.35,areaGuide);
  label('←  駅コンコース','STATION CONCOURSE',-8.8,1.78,-32.8,5.1,1.55,'#e3e8d8','#3d655c');
  box(0,10.7,-72,156,.65,5.6,M.concrete);box(0,11.5,-69.2,156,.9,.14,M.metal);
  for(let x=-73;x<=73;x+=17){box(x,5.3,-74,.9,10.6,1.1,M.stone);box(x,11.9,-69.2,.09,1.5,.09,M.edge);}
  for(const x of [22,42,62]){box(x,13.1,-73,18.5,3.1,2.8,M.ivory);box(x,13.45,-71.57,16.8,.95,.08,M.glassShade);box(x,12.65,-71.5,18.4,.28,.1,M.green);for(let dx=-7;dx<=7;dx+=3.5)box(x+dx,13.45,-71.48,.09,1.1,.06,M.metal);box(x,14.8,-73,15,.3,2.2,M.concrete);}
  function windowFront(x,y,z,w,h,mat=M.glass,ry=0){const c=Math.cos(ry),s=Math.sin(ry),at=(a,b,out)=>[x+a*c+out*s,y+b,z-a*s+out*c];let p=at(0,0,-.035);box(...p,w,h,.14,mat,ry);for(const a of [-w/2,w/2]){p=at(a,0,.08);box(...p,.12,h+.24,.27,M.metal,ry);}for(const b of [-h/2,h/2]){p=at(0,b,.08);box(...p,w+.24,.12,.27,M.metal,ry);}p=at(0,0,.1);box(...p,.08,h,.1,M.edge,ry);p=at(0,-h/2-.15,.14);box(...p,w+.42,.16,.58,M.stone,ry);p=at(-w*.24,h*.2,.05);box(...p,w*.45,.11,.025,M.glassLight,ry);}
  // Mewe has a layered charcoal curtain wall, projecting mullions and a recessed arcade.
  physical(62,10.4,-39,28,20.8,40,{kind:'building'});
  // The closed shops retain their collision footprint; actual interior recesses replace pasted-on glass.
  box(62,12.8,-39,28,16,40,M.dark);box(63.1,2.4,-40.1,25.8,4.8,37.8,M.dark);
  for(const [z,d]of[[-58,2],[-40.1,.45],[-22,1.6]])box(49.1,2.4,z,2.2,4.8,d,M.slate);
  for(const x of[49.1,56.8,64.5,74.7])box(x,2.4,-19.25,.3,4.8,.5,M.slate);
  box(49.1,.04,-39,2.2,.08,40,M.stone);box(62,.04,-20.1,28,.08,2.2,M.stone);
  box(49.1,4.74,-39,2.2,.1,39.7,M.ivory);box(62,4.74,-20.1,27.7,.1,2.2,M.ivory);
  box(50.12,2.2,-39,.1,4.4,37.5,M.wood);box(62,2.2,-21.14,25.7,4.4,.1,M.wood);
  plane(47.985,2.38,-39,39.7,4.52,clearGlass,0,-Math.PI/2);plane(62,2.38,-18.985,27.7,4.52,clearGlass);
  for(let z=-56.3;z<-20;z+=5.4){box(47.91,2.4,z,.15,4.8,.12,M.metal);box(47.86,1.1,z-.9,.06,.5,.08,M.ivory);box(47.87,1.32,z-.9,.08,.06,1.8,M.ivory);}
  for(const x of[49.1,52.8,56.8,60.5,64.5,69.3,74.7]){box(x,2.4,-18.91,.12,4.8,.15,M.metal);box(x+.8,1.1,-18.86,.08,.5,.06,M.ivory);}
  for(const y of[.22,4.76]){box(47.9,y,-39,.16,.15,40,M.metal);box(62,y,-18.9,28,.15,.16,M.metal);}
  box(49.2,4.54,-39,.16,.08,36,M.light);box(62,4.54,-20.1,25.5,.08,.16,M.light);
  for(const z of[-52.3,-45.2,-33.6,-26.3]){
    box(49.22,.66,z,1.17,1.32,2.9,M.wood);box(49.16,1.36,z,1.28,.14,3.04,M.ivory);
    for(let row=0;row<3;row++){box(50.01,1.55+row*.7,z,.26,.08,2.9,M.edge);for(let i=0;i<6;i++)box(49.94,1.77+row*.7,z-1.12+i*.43,.23,.37,.27,[M.teal,M.ivory,M.terracotta,M.yellow][(i+row)%4]);}
    box(48.61,.7,z-.95,.18,1.4,.18,M.metal);box(48.61,1.42,z-.95,.58,.08,.58,M.wood);
  }
  for(const x of[52.8,60.5,68.8]){
    box(x,.56,-20.12,4.6,1.12,.86,M.wood);box(x,1.18,-20.08,4.78,.13,1.01,M.stone);
    for(let i=0;i<5;i++){box(x-1.65+i*.82,1.39,-20.05,.34,.31,.32,i%2?M.ivory:M.terracotta);box(x-1.55+i*.8,2.55,-21.04,.64,1.05,.1,i%2?M.teal:M.slate);}
    box(x,3.9,-20.05,4.3,.12,.42,M.light);
  }
  box(62,21.15,-39,29,.55,41,M.metal);box(63.5,24.9,-43,23,7.1,30,M.glassShade);box(63.5,28.65,-43,24,.4,31,M.edge);box(64,29.7,-43,11,1.8,13,M.concrete);
  for(const y of [5.2,9.8,14.4,19]){box(47.82,y,-39,.4,.25,40,M.edge);box(62,y,-18.8,28,.25,.45,M.edge);if(y>5.2){for(let z=-55.5;z<=-23;z+=5.4)windowFront(47.79,y-2.1,z,4.9,3.65,Math.round(z)%2?M.glass:M.glassLight,-Math.PI/2);for(let x=50.8;x<=73.5;x+=5.5)windowFront(x,y-2.1,-18.74,4.9,3.65,Math.round(x)%2?M.glass:M.glassLight);}}
  for(const y of [23.1,26.8])for(let x=55;x<=72;x+=5.4)windowFront(x,y,-27.82,4.9,2.8,M.glass);
  for(const x of [49.1,56.8,64.5,74.7]){solid(x,1.45,-15.9,.72,2.9,.72,M.stone,{kind:'column',minimap:false});box(x,.18,-15.9,.98,.36,.98,M.concrete);}

  box(62,3.15,-16.6,28.6,.4,5.2,M.metal);box(62,3.4,-16.6,28.9,.1,5.4,M.teal);box(62,2.87,-14.1,26.8,.08,.15,M.light);
  const meweSign=textMaterial((ctx,w,h)=>{ctx.fillStyle='#eeeae1';ctx.fillRect(0,0,w,h);ctx.textBaseline='middle';ctx.font='700 140px Arial';ctx.textAlign='right';ctx.fillStyle='#a53449';ctx.fillText('me',w/2,106);ctx.textAlign='left';ctx.fillStyle='#493c85';ctx.fillText('we',w/2,106);ctx.textAlign='center';ctx.fillStyle='#344653';ctx.font='32px "Meiryo",sans-serif';ctx.fillText('ミウィ橋本 / SHOPPING & DINING',w/2,210);});
  plane(62,17.3,-18.31,21.8,4.6,meweSign).name='Survey / Mewe two-color wordmark';plane(47.51,16.9,-42,17.5,4.5,meweSign,0,-Math.PI/2);
  label('CAFE / 02','COFFEE · BAKERY',55.1,2.35,-18.25,6.5,.9,'#e7e8d2','#3f7770');label('DAILY GOODS','LIFE & STYLE',68.1,2.35,-18.25,6.5,.9,'#f1e4d7','#9b515a');banner(47.44,10.5,-49,3.6,7.8,-Math.PI/2);banner(71.5,11.5,-18.25,2.7,7.5);
  // Asymmetric retail islands establish three distinct fighting routes.
  solid(-30,3.3,25,26,6.6,34,brick,{kind:'building'});solid(-29,10.2,24,23.5,7.2,30,M.plaster,{kind:'building'});
  box(-29,14.1,24,24.5,.5,31,M.terracotta);box(-29,14.65,24,23.5,.6,30,M.metal);box(-30,6.65,25,27.2,.3,35.2,M.ivory);box(-30,3.6,42.55,27.4,.25,2.2,M.metal);box(-43.3,3.6,25,2.2,.25,34,M.metal);
  for(const x of [-38,-30,-22]){windowFront(x,2.1,42.06,6.3,3.2,M.glassShade);windowFront(x,10.2,39.04,4.8,3.4,M.glassLight);windowFront(x,10.2,8.94,4.8,3.4,M.glass,Math.PI);}
  for(const z of [12.2,20,28,36.6]){windowFront(-43.13,2.15,z,5.4,3.2,M.glassShade,-Math.PI/2);windowFront(-40.83,10.1,z,4.8,3.4,M.glass,-Math.PI/2);box(-43.2,1.5,z-3.4,.3,3,.34,M.ivory);}
  for(const x of [-39.6,-20.4])box(x,2.25,43,.35,4.5,.4,M.ivory);
  label('橋本横丁','LOCAL SHOPS / BUS STREET',-30,5.15,42.26,16.5,2.05,'#f2e7cd','#4e615c');label('珈琲 と パン','COFFEE & BREAD',-43.29,4.95,27,10.5,1.7,'#eaddbf','#775449',-Math.PI/2);
  for(const z of [15,35]){box(-44.25,2.8,z,2.7,.18,5.2,M.mutedCoral);box(-45.6,2.6,z,.12,.38,5.2,M.chalk);}
  box(-30,15.5,26,5,1.5,5,M.concrete);cylinder(-23,16.4,19,1.2,3.1,M.edge);box(-23,18.05,19,2.7,.18,2.7,M.metal);
  physical(30,3,25,26,6,34,{kind:'building'});
  // Public-lane storefronts have a real recess behind the original building collision plane.
  box(30.7,3,25,24.6,6,34,M.ivory);
  for(const [z,d]of[[10.5,5],[24,8],[38.5,7]])box(17.7,3,z,1.4,6,d,M.ivory);
  for(const z of [16.5,31.5]){box(17.7,4.8,z,1.4,2.4,7,M.ivory);box(18.31,1.8,z,.14,3.6,7,M.wood);box(17.73,.76,z,1.12,1.52,6.5,M.terracotta);box(17.72,1.55,z,1.18,.14,6.6,M.stone);box(17.75,3.1,z,.75,.13,6.3,M.light);plane(16.975,1.85,z,6.8,3.45,clearGlass,0,-Math.PI/2);for(const zz of[z-3.35,z,z+3.35])box(16.92,1.85,zz,.13,3.7,.11,M.metal);box(16.89,.14,z,.23,.28,7.1,M.slate);box(16.89,3.6,z,.24,.16,7.1,M.metal);for(let i=0;i<5;i++){box(17.58,1.8,z-2.4+i*1.15,.36,.34,.38,i%2?M.yellow:M.ivory);box(18.19,2.3,z-2.3+i*1.15,.08,.77,.65,i%2?M.dark:M.teal);}}
  solid(31,10,23.5,23,8,29,M.stone,{kind:'building'});
  box(30,6.25,25,27.2,.42,35.2,M.teal);box(31,14.35,23.5,24,.55,30,M.edge);box(31,14.9,23.5,22.8,.55,28.5,M.teal);box(43.5,3.5,25,2,.24,34,M.metal);
  for(const z of [12.8,21,29.2,37.2]){windowFront(43.08,2.1,z,6.2,3.3,M.glassShade,Math.PI/2);windowFront(42.55,10.2,z-1,5.6,3.8,M.glassLight,Math.PI/2);box(43.25,2.3,z-3.8,.38,4.6,.38,M.stone);}
  for(const x of [21.5,29.5,37.5]){windowFront(x,2.1,42.07,6,3.3,M.glassShade);windowFront(x,10.2,38.08,5.4,3.8,M.glass);}
  label('mewe ANNEX','DINING COURT / 1F',30,4.75,42.26,20,2.05,'#eff0dd','#3f736e');label('食堂 まちかど','LOCAL KITCHEN',43.28,4.85,26,12,1.7,'#eee6d1','#4b6d62',Math.PI/2);
  for(let z=12;z<40;z+=2.2)box(43.6,3.15,z,2.5,.18,1.1,Math.round(z)%2?M.chalk:M.teal);banner(39.5,10.25,38.3,2.4,6.5);
  // The central lane is a public frontage too: framed upstairs windows, joints and service details.
  for(const z of [12.8,20.6,28.4,36.2])windowFront(-17.17,10.2,z,4.9,3.4,M.glass,Math.PI/2);
  for(const z of [13.2,21.2,29.2,35.5])windowFront(19.4,10.1,z,4.7,3.8,M.glassLight,-Math.PI/2);
  for(const y of [7.1,12.8]){box(-17.2,y,24,.075,.065,29.7,M.concrete);box(19.43,y,23.5,.075,.065,28.6,M.concrete);}
  for(const z of [9.1,16.7,24.6,32.5,38.8]){box(-17.18,10.2,z,.055,6.6,.055,M.concrete);box(19.42,10.1,z,.055,7.5,.055,M.concrete);}
  for(const x of [-16.93,16.93]){const sign=x<0?1:-1;box(x,2.72,24,.16,1.58,2.65,M.metal);box(x+sign*.1,2.72,24,.09,1.38,2.43,M.dark);for(let y=2.12;y<3.4;y+=.19)box(x+sign*.16,y,24,.16,.07,2.36,M.edge);box(x,.22,25.62,.24,.24,.34,M.slate);box(x,2.9,39.2,.13,5.8,.13,M.edge);for(const y of[.6,2.2,4.1,5.5])box(x+sign*.055,y,39.2,.12,.1,.23,M.metal);}
  label('喫茶 / TAKEAWAY','COFFEE · BAKED DAILY',16.82,4.7,16.5,7.8,1.35,'#e8dfc7','#8b6b51',-Math.PI/2);
  label('まちかど食堂','LOCAL KITCHEN',16.82,4.7,31.5,7.8,1.35,'#e8e6cd','#47736c',-Math.PI/2);
  label('A  ←  北口','STATION / BUS TERMINAL',-16.83,3.8,12.2,5.1,1.2,'#e9ce88','#334f56',Math.PI/2);
  solid(29,2.4,-44,14,4.8,19,M.slate,{kind:'building'});box(29,5,-44,15,.4,20,M.metal);box(29,5.3,-44,14.4,.2,19.4,M.teal);
  for(const x of [25,29,33])windowFront(x,2.6,-34.42,3.3,2.5,M.glassShade);label('STAFF / DELIVERY','駅前サービス通路',29,4.1,-34.25,10,1.2);
  // Central information pavilion has deep glass panels and a thin folded canopy.
  solid(0,1.9,14,12,3.8,14,M.dark,{kind:'building'});for(const x of [-4,0,4])windowFront(x,2,21.12,3.45,3.15,M.glassShade);for(const z of [9.5,14,18.5])windowFront(-6.13,2,z,3.8,3.15,M.glass,-Math.PI/2);
  box(0,4.05,14,13.7,.5,15.7,M.metal);box(0,4.35,14,14.1,.15,16.1,M.teal);box(0,3.72,22,12.2,.08,.12,M.light);label('i HASHIMOTO','NORTH SQUARE / INFORMATION',0,3.1,21.34,10.4,1.1,'#d7e4d9','#2b4d56');banner(3.9,2,21.38,1.2,2.8);
  // Slabs have a base above eye level; flat routes continue underneath both decks.
  function deck(x,z,w,d,top=3.2){
    physical(x,top-.2,z,w,.4,d,{kind:'deck',minimap:false});box(x,top-.09,z,w,.18,d,M.concrete);box(x,top+.025,z,w+.15,.05,d+.15,M.ivory);
    for(const side of[-1,1]){box(x,top-.3,z+side*(d/2-.1),w,.2,.2,M.slate);box(x,top-.39,z+side*(d/2-.1),w,.025,.24,M.edge);}
    for(let xx=x-w/2+.65;xx<x+w/2-.3;xx+=3.4){box(xx,top-.28,z,.15,.24,d-.25,M.metal);box(xx,top-.39,z,.28,.025,d-.3,M.edge);}
    for(let xx=x-w/2+4;xx<x+w/2-1;xx+=12){if(z< -20&&xx> -28&&xx< -13)continue;physical(xx,(top-.4)/2,z+.6,.65,top-.4,.65,{kind:'column',minimap:false});box(xx,(top-.4)/2,z+.6,.65,top-.4,.65,M.stone,0,0,bevelGeo);box(xx,.15,z+.6,.9,.3,.9,M.concrete,0,0,bevelGeo);box(xx,top-.53,z+.6,.84,.2,.84,M.edge);box(xx,top-.41,z+.6,.75,.04,.75,M.black);}
  }
  const guardGlassGeo=new THREE.PlaneGeometry(1,1),guardGlass=new THREE.MeshStandardMaterial({color:'#a2c5cb',roughness:.22,metalness:.08,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide});
  function railing(x,y,z,length,ry=0){box(x,y+.48,z,length,.9,1,guardGlass,ry,0,guardGlassGeo);box(x,y+1.02,z,length+.12,.075,.075,M.metal,ry);railCollider(x,y+1.02,z,length+.12,.075,.075,ry);box(x,y+.035,z,length,.065,.09,M.edge,ry);for(let a=-length/2;a<=length/2+.01;a+=2.8){const xx=x+Math.cos(ry)*a,zz=z-Math.sin(ry)*a;box(xx,y+.5,zz,.075,1.07,.075,M.edge);for(const h of[.12,.82])box(xx,y+h,zz,.14,.09,.11,M.metal);}}
  const tactileTex=canvasTexture((ctx,w,h)=>{
    ctx.fillStyle='#c8b16c';ctx.fillRect(0,0,w,h);
    for(let y=14;y<h;y+=28)for(let x=14;x<w;x+=28){ctx.fillStyle='#8f8050';ctx.beginPath();ctx.arc(x+1,y+2,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e5d291';ctx.beginPath();ctx.arc(x-1,y-1,4.3,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#9c8b59';ctx.lineWidth=2;ctx.strokeRect(1,1,w-2,h-2);
  },256,256);
  tactileTex.wrapS=tactileTex.wrapT=THREE.RepeatWrapping;tactileTex.repeat.set(6,1);
  const tactileMat=new THREE.MeshStandardMaterial({map:tactileTex,roughness:.87});
  function stairs(x,nearZ,farZ,width,top=3.2){
    const count=20,length=nearZ-farZ,step=length/count;
    for(let i=0;i<count;i++){
      const h=top*(i+1)/count,z=nearZ-(i+.5)*step;
      box(x,h/2,z,width,h,step+.015,M.stone);box(x,h+.018,z+step/2-.055,width,.035,.1,M.ivory);
      for(const side of [-1,1]){box(x+side*(width/2-.1),h+.025,z,.14,.045,step,M.metal);box(x+side*(width/2+.04),h-.07,z,.07,.16,step,M.concrete);}
    }
    for(const side of [-1,1]){
      const slope=Math.atan2(top,length);
      for(const level of [.52,1]){
        const rail=new THREE.Mesh(new THREE.BoxGeometry(.085,.085,Math.hypot(length,top)),level===1?M.metal:M.edge);
        rail.position.set(x+side*(width/2+.1),top/2+level,(nearZ+farZ)/2);rail.rotation.x=slope;rail.castShadow=true;world.add(rail);
      }
      // Short bounds follow the actual sloping top bar rather than making a
      // floor-to-ceiling wall along the stair or the lower pedestrian route.
      const halfY=.0425*Math.cos(slope),halfZ=.0425*Math.sin(slope);
      for(let i=0;i<count;i++){
        const low=top*i/count+1-halfY,high=top*(i+1)/count+1+halfY;
        railCollider(x+side*(width/2+.1),(low+high)/2,nearZ-(i+.5)*step,.085,high-low,step+2*halfZ);
      }
      for(let i=0;i<=4;i++){const yy=i/4*top,zz=nearZ-i/4*length;box(x+side*(width/2+.1),yy+.5,zz,.1,1,.1,M.edge);box(x+side*(width/2+.1),yy+.06,zz,.26,.1,.26,M.metal);}
    }
    plane(x,.022,nearZ+.63,width-.35,.85,tactileMat,-Math.PI/2);plane(x,top+.065,farZ-.59,width-.35,.85,tactileMat,-Math.PI/2);
    ramps.push({minX:x-width/2,maxX:x+width/2,minZ:farZ,maxZ:nearZ,axis:'z',direction:-1,base:0,height:top});mapShapes.push({x,z:(nearZ+farZ)/2,w:width,d:length,color:'#8caaa4',kind:'stairs'});
  }
  deck(-28.5,-30.5,87,5);railing(-25,3.25,-27.88,78);stairs(-69.5,-10,-28,5);railing(-72.1,3.25,-30.5,5,Math.PI/2);
  // Thin soffit and restrained light lines make the real under-deck clearance legible.
  plane(-20.75,2.796,-30.5,14.1,4.8,M.ivory,Math.PI/2);box(-20.75,2.78,-28.09,14.1,.035,.06,M.light);
  for(const x of[-26.9,-14.6])box(x,2.78,-30.5,.055,.035,4.65,M.light);
  for(let x=-68;x<12;x+=4.5)box(x,3.0,-27.992,.04,.34,.02,M.concrete);
  plane(-20.75,.03,-32.1,13.7,.55,tactileMat,-Math.PI/2);
  deck(62,-11.5,28,7);railing(58.3,3.25,-7.86,20.5);stairs(72.5,14,-8,5);railing(76.1,3.25,-11.5,7,Math.PI/2);label('2F 連絡デッキ','PEDESTRIAN DECK',-69.5,2.2,-9.85,4.1,1.5);
  // Bus shelter and a fully modelled bus define the western route.
  box(-62.5,4.2,8,10.8,.35,34,M.metal);box(-62.5,4.43,8,11.2,.12,34.6,M.teal);box(-57.35,4.17,8,.13,.2,34,M.ivory);
  for(const z of [-7,3,13,23]){solid(-66,2,z,.42,4,.42,M.metal,{kind:'column',minimap:false});box(-62.5,3.95,z,8.5,.08,.2,M.light);}label('橋本駅北口 1 · 2','BUS TERMINAL / NORTH EXIT',-62.3,3.6,25.33,9,1.2,'#ecedda','#3e6964');
  const wheelGeo=new THREE.CylinderGeometry(1,1,1,12);wheelGeo.rotateZ(Math.PI/2);
  function bus(x,z){solid(x,1.45,z,3.15,2.9,11.8,M.ivory,{kind:'vehicle'});box(x,2.95,z-.3,3,.3,10.8,M.ivory);box(x,1.03,z,3.22,.38,11.9,M.teal);box(x,.55,z,3.22,.22,11.9,M.metal);for(const side of [-1,1]){box(x+side*1.6,2.12,z-.2,.06,1.1,9.8,M.glassShade);for(let dz=-4.7;dz<5;dz+=1.8)box(x+side*1.65,2.1,z+dz,.08,1.15,.1,M.edge);for(const dz of [-3.6,3.7]){box(x+side*1.6,.64,z+dz,.3,.64,.64,M.black,0,0,wheelGeo);box(x+side*1.78,.64,z+dz,.05,.3,.3,M.edge,0,0,wheelGeo);}}box(x,2.05,z+5.96,2.8,1.25,.09,M.glassShade);box(x,2.95,z+5.94,2.6,.34,.1,M.black);for(const dx of [-1.1,1.1]){box(x+dx,.85,z+5.99,.4,.24,.1,M.light);box(x+dx,.85,z-5.99,.35,.2,.1,M.coral);}box(x,1.2,z+6.04,1.1,.22,.08,M.dark);label('橋本駅','HASHIMOTO',x,2.95,z+6.03,2.2,.3,'#e8d89e','#233b43');}
  bus(-62.5,14.5);
  // Close cover has cap strips, inset panels and hardware rather than unadorned cubes.
  const assetStamp=textMaterial((ctx,w,h)=>{ctx.fillStyle='#415a64';ctx.fillRect(0,0,w,h);ctx.fillStyle='#c4d0c4';ctx.font='700 37px Arial';ctx.fillText('HASHIMOTO / TRANSIT',22,58);ctx.font='500 22px Arial';ctx.fillText('NORTH EXIT     HP–017',22,99);for(let x=w-138;x<w-24;x+=5){ctx.fillStyle='#d0d7c5';ctx.fillRect(x,22,2+(x%3),80);}},768,128),stampGeo=new THREE.PlaneGeometry(1,1);
  function crate(x,z,w=3.4,h=2,d=3,ry=0,mat=M.dark){
    physical(x,h/2,z,w,h,d,{ry,kind:'crate',color:'#647f88'});box(x,h/2,z,w,h,d,mat,ry,0,bevelGeo);
    const part=(dx,y,dz,a,b,c,m,geo=boxGeo)=>box(x+dx*Math.cos(ry)+dz*Math.sin(ry),y,z-dx*Math.sin(ry)+dz*Math.cos(ry),a,b,c,m,ry,0,geo);
    part(0,h+.025,0,w+.12,.12,d+.12,M.metal,bevelGeo);part(0,.15,0,w+.06,.26,d+.06,M.metal,bevelGeo);
    for(const dx of [-w/2+.12,w/2-.12])for(const dz of [-d/2-.025,d/2+.025]){part(dx,h/2,dz,.16,h-.24,.12,M.edge);for(const y of[.29,h-.24])part(dx,y,dz+Math.sign(dz)*.065,.06,.06,.035,M.black);}
    for(const side of [-1,1]){
      part(0,h*.62,side*(d/2+.045),w-.45,.1,.08,M.coral);part(0,h*.35,side*(d/2+.06),w*.45,.45,.08,M.slate,bevelGeo);part(w*.32,h*.32,side*(d/2+.11),.18,.23,.04,M.yellow);
      const dz=side*(d/2+.107);box(x+dz*Math.sin(ry),h*.35,z+dz*Math.cos(ry),w*.405,.23,1,assetStamp,ry+(side<0?Math.PI:0),0,stampGeo);
      part(side*(w/2+.022),h*.72,0,.04,.25,.74,M.black);part(side*(w/2+.06),h*.77,0,.085,.09,.57,M.edge);
    }
    part(0,h+.1,0,.6,.1,d*.55,M.teal,bevelGeo);
  }
  const branchGeo=new THREE.CylinderGeometry(.48,1,1,7),fineCrownGeo=new THREE.IcosahedronGeometry(1,1),leafCardGeo=new THREE.PlaneGeometry(1,1);
  const foliageSurface=canvasTexture((ctx,w,h)=>{
    ctx.fillStyle='#a3b58c';ctx.fillRect(0,0,w,h);
    for(let i=0;i<680;i++){ctx.fillStyle=['#8da77d','#c8d0a0','#aabd8a','#77946f','#b7c693'][i%5];ctx.beginPath();ctx.ellipse((i*73)%w,(i*137+Math.floor(i/17)*11)%h,4+i%5,2+i%3,i*.9,0,Math.PI*2);ctx.fill();}
  },256,256);
  for(const m of [M.leaf,M.leafLight,M.leafDark]){m.map=foliageSurface;m.bumpMap=foliageSurface;m.bumpScale=.0025;m.roughness=.96;}
  const leafTex=canvasTexture((ctx,w,h)=>{
    ctx.clearRect(0,0,w,h);ctx.strokeStyle='#668350';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w*.19,h*.9);ctx.lineTo(w*.79,h*.1);ctx.stroke();
    for(let i=0;i<8;i++){
      const x=w*(.28+i*.064),y=h*(.79-i*.086),side=i%2?1:-1,dx=side*(38+i%3*9),dy=-22;
      ctx.strokeStyle='#78925b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke();
      for(let j=1;j<=4;j++)for(const s of[-1,1]){const t=j/4,lx=x+dx*t+s*8,ly=y+dy*t+s*9;ctx.fillStyle=['#8da86f','#a2b97e','#668f5d','#789e67'][(i+j+(s+1)/2)%4];ctx.beginPath();ctx.ellipse(lx,ly,11+j%2*2,5.5,s*.7+side*.4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#aabb82';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(lx-6,ly+2);ctx.lineTo(lx+6,ly-2);ctx.stroke();}
    }
  },256,256);
  const leafCards=new THREE.MeshStandardMaterial({map:leafTex,alphaTest:.45,side:THREE.DoubleSide,roughness:.95,color:'#e4ead3'});
  function branch(ax,ay,az,bx,by,bz,r){
    const direction=new THREE.Vector3(bx-ax,by-ay,bz-az),length=direction.length();
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
    const key=M.trunk.uuid+':'+branchGeo.uuid;if(!batches.has(key))batches.set(key,{mat:M.trunk,geometry:branchGeo,entries:[]});
    batches.get(key).entries.push(new THREE.Matrix4().compose(new THREE.Vector3((ax+bx)/2,(ay+by)/2,(az+bz)/2),q,new THREE.Vector3(r,length,r)));
  }
  function sprig(x,y,z,s,angle,pitch=.38,roll=.24){
    const key=leafCards.uuid+':'+leafCardGeo.uuid;if(!batches.has(key))batches.set(key,{mat:leafCards,geometry:leafCardGeo,entries:[]});
    const card=(px,py,pz,w,h,yaw,tilt,lean)=>{pos.set(px,py,pz);size.set(w,h,1);quat.setFromEuler(new THREE.Euler(tilt,yaw,lean,'YXZ'));batches.get(key).entries.push(mtx.compose(pos,quat,size).clone());};
    card(x,y,z,s,s*.83,angle,pitch,roll);card(x,y+.09*s,z,s*.9,s*.76,angle+Math.PI/2,pitch*.68,-roll*1.24);
  }
  function tree(x,z,s=1,base=1.1){
    // Uneven branch heights and smaller inner clusters leave real skylight gaps.
    // Retain the original 29 cores / 58 cards rather than add transparent layers.
    const seed=Math.abs(Math.sin(x*12.9898+z*78.233)),turn=seed*Math.PI*2,leanX=Math.sin(turn)*.17*s,leanZ=Math.cos(turn)*.14*s;
    branch(x,base,z,x+leanX,base+3.45*s,z+leanZ,.24*s);
    const heights=[3.0,3.82,3.33,4.28,3.54,4.04,4.47],radii=[1.14,1.6,1.27,1.47,1.68,1.08,1.23];
    for(let i=0;i<7;i++){
      const a=i*2.399+turn,r=(radii[i]+Math.sin(i*4.3+turn)*.12)*s,tx=x+Math.cos(a)*r,tz=z+Math.sin(a)*r,ty=base+(heights[i]+(seed-.5)*.22)*s;
      branch(x+leanX*.6,base+(2.02+i*.14)*s,z+leanZ*.6,tx,ty-.12*s,tz,.09*s);
      for(let j=0;j<4;j++){
        const b=a+j*1.91+seed*.4,reach=(.36+(i+j)%3*.14)*s,cx=tx+Math.cos(b)*reach,cz=tz+Math.sin(b)*reach,cy=ty+[-.27,.06,.27,.44][j]*s;
        const wx=(.34+(i+j)%3*.055)*s,hy=(.25+j%2*.065)*s,dz=(.34+i%3*.045)*s;
        box(cx,cy,cz,wx,hy,dz,[M.leafDark,M.leaf,M.leafLight][(j+(i%2))%3],b,.12+seed*.2,fineCrownGeo);
        sprig(cx+Math.cos(b)*.19*s,cy+.16*s,cz+Math.sin(b)*.19*s,(1.02+(i*3+j)%5*.095)*s,b,.36+(i+j)%4*.19,-.38+j*.23);
      }
    }
    box(x+leanX,base+4.55*s,z+leanZ,.39*s,.32*s,.37*s,M.leafLight,turn,.2,fineCrownGeo);sprig(x+leanX,base+4.8*s,z+leanZ,1.14*s,turn+.8,.74,-.21);
  }
  function planter(x,z,w,d,hasTree=false,ry=0){
    physical(x,.62,z,w,1.24,d,{ry,kind:'planter',color:'#6d8d7e'});box(x,.62,z,w,1.24,d,M.slate,ry,0,bevelGeo);
    const part=(dx,y,dz,a,b,c,m,geo=boxGeo)=>box(x+dx*Math.cos(ry)+dz*Math.sin(ry),y,z-dx*Math.sin(ry)+dz*Math.cos(ry),a,b,c,m,ry,0,geo);
    part(0,1.25,0,w+.16,.18,d+.16,M.ivory,bevelGeo);part(0,1.37,0,w-.25,.08,d-.25,M.soil);
    for(const dx of [-w/2+.2,w/2-.2])for(const side of [-1,1])part(dx,.62,side*(d/2+.025),.1,1,.08,M.metal);
    for(let i=0;i<8;i++){
      const dx=(i-3.5)*w*.1,dz=(i%2?1:-1)*d*.19,px=x+dx*Math.cos(ry)+dz*Math.sin(ry),pz=z-dx*Math.sin(ry)+dz*Math.cos(ry);
      for(let j=0;j<2;j++)box(px+(j-.5)*.25,1.62+(i%3)*.065+j*.06,pz+(i%3-1)*.07,w*(.056+(i%2)*.009),.22+(i%3)*.025,d*(.115+j*.025),i%2?M.leaf:M.leafDark,i+j,.15,fineCrownGeo);
      sprig(px,1.87+(i%3)*.055,pz,.77+(i%3)*.075,i*1.9,.43+(i%4)*.17,-.32+(i%3)*.27);
    }
    if(hasTree)tree(x,z,.9,1.35);
  }
  function bench(x,z,ry=0){physical(x,.48,z,4,.96,1.05,{ry,kind:'bench',color:'#89927c'});const part=(dx,y,dz,a,b,c,m)=>box(x+dx*Math.cos(ry)+dz*Math.sin(ry),y,z-dx*Math.sin(ry)+dz*Math.cos(ry),a,b,c,m,ry);for(let i=0;i<5;i++)part(0,.67,-.4+i*.2,4,.12,.14,M.wood);for(let i=0;i<4;i++)part(0,1+i*.17,-.48,4,.12,.1,M.wood);for(const dx of [-1.6,1.6]){part(dx,.34,0,.15,.68,.92,M.metal);part(dx,.97,0,.12,.1,1.08,M.metal);}}
  function relocatedProp(id,draw){
    const move=TACTICAL_PROP_MOVES.find(value=>value.id===id),dx=move.to.x-move.from.x,dz=move.to.z-move.from.z;
    const starts=new Map([...batches].map(([key,batch])=>[key,batch.entries.length])),colliderStart=colliders.length,shapeStart=mapShapes.length;
    draw();
    for(const [key,batch]of batches){
      const start=starts.get(key)||0,count=batch.entries.length-start;if(!count)continue;
      const originalPositions=[];batch.legacyPositions||=new Map();
      for(let index=start;index<start+count;index++){
        const elements=batch.entries[index].elements,old=[elements[12],elements[13],elements[14]];
        originalPositions.push(old.map(Math.fround));batch.legacyPositions.set(index,old);
        elements[12]+=dx;elements[14]+=dz;
      }
      (batch.legacyPropMoves||=[]).push({id,start,count,dx,dz,originalPositions});
    }
    for(const collider of colliders.slice(colliderStart)){
      collider.minX+=dx;collider.maxX+=dx;collider.minZ+=dz;collider.maxZ+=dz;
      if(collider.polygon)collider.polygon=collider.polygon.map(([x,z])=>[x+dx,z+dz]);
    }
    for(const shape of mapShapes.slice(shapeStart))shape.polygon=shape.polygon.map(([x,z])=>[x+dx,z+dz]);
  }
  relocatedProp('a-entry-planter',()=>planter(-51,35,5,2.8,true));relocatedProp('a-link-planter',()=>planter(-49,-6,5,3,true));planter(-15.5,-13,5,3,true);relocatedProp('b-entry-planter',()=>planter(17,-2,4,6));planter(50,44.7,4.5,2.6,true);planter(63,-5.8,5.5,2.6,true);planter(-8.8,48,4.6,2.7);planter(15,53,4.4,2.8,true);planter(-41,-67.4,5.2,2.4,true);
  crate(-43,-15.5,4,2.2,3.1,.06);crate(-29.5,-25,3.7,1.7,3,-.06);crate(34,-4,3.6,2.2,3.4,.06);crate(47.5,3,3,1.5,2.6,-.08);relocatedProp('mid-entry-crate',()=>crate(-7.8,37,3.5,1.7,2.8,.04));crate(9.8,-19,3.4,1.8,3.2,-.03);crate(-57,49,4,1.8,3,.03);relocatedProp('b-delivery-crate',()=>crate(60,28,3.6,1.7,3,-.08));relocatedProp('bus-court-bench',()=>bench(-49,30.3));bench(57.5,-5.7);bench(-10.5,-9.7,Math.PI/2);
  crate(49,-64.5,5.5,2.5,4,.05,M.teal);crate(49,-64.5,4.3,4.6,3.4,.05,M.slate);
  // A real service building separates the station and Mewe approaches. The
  // western mid lane stays open; rotations use its south or under-deck ends.
  const divider=physical(4,3.3,-15.5,22,6.6,25,{kind:'service-building',color:'#596e75'});divider.layoutRole='central-divider';
  box(4,3.25,-15.5,22,6.5,25,M.concrete);box(4,.3,-15.5,22.1,.6,25.1,M.slate);
  box(4,6.58,-15.5,22.7,.26,25.7,M.metal);box(4,6.78,-15.5,23,.12,26,M.teal);box(4,6.9,-15.5,22.5,.12,25.5,M.ivory);
  for(const x of[-7.03,15.03]){
    for(const y of[.68,3.4,6.0])box(x,y,-15.5,.08,.045,24.7,M.slate);
    for(const z of[-26.2,-21.2,-16.2,-11.2,-6.2])box(x,3.3,z,.08,5.3,.045,M.slate);
    for(const z of[-23.6,-16.2,-8.8])windowFront(x+(x<0?-.02:.02),4.87,z,3.9,1.13,M.glassShade,x<0?-Math.PI/2:Math.PI/2);
  }
  for(const x of[-5.5,-1.7,2.1,5.9,9.7,13.5]){box(x,3.3,-2.968,.035,5.6,.075,M.slate);box(x,3.3,-28.03,.035,5.6,.075,M.slate);}
  box(4,3.83,-2.91,21.6,.12,.28,M.ivory);box(4,6.06,-2.91,21.6,.13,.26,M.ivory);
  box(5.6,1.93,-2.85,7.7,3.86,.18,M.dark);box(5.6,1.9,-2.735,7.23,3.57,.09,M.edge);
  for(let y=.24;y<3.6;y+=.21){box(5.6,y,-2.67,7.18,.055,.08,M.metal);box(5.6,y+.045,-2.663,7.1,.024,.025,M.concrete);}
  for(const x of[1.75,9.45])box(x,1.98,-2.61,.17,3.96,.29,M.metal);
  box(5.6,3.98,-2.6,8.1,.24,.48,M.metal);box(5.6,4.16,-2.66,8.4,.1,.57,M.teal);box(5.6,3.82,-2.55,7.5,.05,.1,M.light);
  box(-3.9,1.56,-2.88,1.62,3.12,.18,M.dark);box(-3.9,1.57,-2.76,1.4,2.94,.09,M.slate);box(-3.41,1.42,-2.68,.075,.34,.07,M.edge);
  for(const z of[-8.5,-23]){box(15.16,1.58,z,.2,2.1,3.2,M.dark);for(let y=.68;y<2.6;y+=.17)box(15.27,y,z,.17,.065,3.02,M.edge);}
  for(const x of[-5.9,13.9]){box(x,3.27,-2.67,.13,6.2,.13,M.edge);for(const y of[.6,2.4,4.2,5.9])box(x,y,-2.63,.25,.1,.16,M.metal);}
  box(7.3,7.33,-18.8,5.8,.82,7.2,M.slate);box(7.3,7.81,-18.8,6.2,.16,7.6,M.metal);
  for(let z=-21.9;z<-15.4;z+=.45)box(7.3,7.46,z,5.45,.12,.12,M.edge);
  for(const x of[-1.8,1.2]){cylinder(x,7.66,-23,.42,1.46,M.edge);cylinder(x,8.43,-23,.6,.16,M.metal);box(x,6.96,-23,1.2,.12,1.2,M.dark);}
  label('駅施設管理センター','STATION SERVICE / DELIVERY',4,5.05,-2.78,15.6,1.17,'#e0e5d5','#425c62');
  label('A ← 北口コンコース','BUS TERMINAL / STATION',-7.145,2.75,-10.1,6.4,1.35,'#e5cb88','#344f56',-Math.PI/2);
  label('B → ミウィ前広場','MEWE / SHOPPING & DINING',15.145,2.75,-10.1,6.4,1.35,'#b9d7c4','#344f56',Math.PI/2);
  // These head-height cases add distinct planting pockets without moving any
  // original plant destination or forcing all plants to the zone centre.
  crate(-35.6,-22.4,3.2,2.55,2.4,0,M.slate);colliders.at(-1).layoutRole='site-cover-A';
  crate(39,-8,4.8,2.5,3.8,0,M.teal);colliders.at(-1).layoutRole='site-cover-B';
  for(let x=-34;x<=-20;x+=7){box(x,.35,66,5.5,.7,1.2,M.stone);box(x,.73,66,5.8,.12,1.4,M.ivory);}
  function lamp(x,z,ry=0,flag=false){cylinder(x,3.6,z,.075,7.2,M.metal);cylinder(x,.2,z,.24,.4,M.metal);box(x,7.2,z,1.7,.16,.68,M.metal,ry);box(x,7.1,z,1.42,.07,.47,M.light,ry);if(flag){box(x+.72,4.9,z,1.18,3.5,.06,M.dark);banner(x+.72,4.9,z+.045,1.1,3.4);}}
  for(const [x,z,flag]of[[-73,47,true],[-48,3,false],[-10,56,true],[47,50,true],[69,22,false],[19,-22,true],[-61,-31,false],[-5,-64,false]])lamp(x,z,.2,flag);
  for(const [x,z]of[[-69,36],[-69,42],[47,57],[53,57],[59,57]]){cylinder(x,.65,z,.15,1.3,M.metal);cylinder(x,1.03,z,.17,.13,M.yellow);}
  for(const [x,z,ry]of[[-16.7,15,Math.PI/2],[16.7,35,-Math.PI/2],[-58.7,-42,-Math.PI/2]]){box(x,1.4,z,.5,2.5,1.4,M.edge,ry);for(let y=.5;y<2.5;y+=.18)box(x+.27,y,z,.08,.05,1.05,M.dark,ry);box(x,3.1,z+1.3,.13,5.6,.13,M.metal,ry);}
  // Visible city walls, railings and distant silhouettes enclose the competitive footprint.
  solid(0,1.4,80.8,163,2.8,1.4,M.slate,{kind:'boundary',minimap:false});solid(-80.8,2.2,0,1.4,4.4,163,brick,{kind:'boundary',minimap:false});solid(80.8,2.2,0,1.4,4.4,163,M.concrete,{kind:'boundary',minimap:false});solid(0,2.2,-80.8,163,4.4,1.4,M.concrete,{kind:'boundary',minimap:false});
  box(0,2.88,80.8,163,.16,1.55,M.ivory);for(let x=-75;x<79;x+=8){box(x,3.1,80.8,.12,.9,.12,M.metal);box(x,3.5,80.8,8,.1,.1,M.metal);}for(const z of[-65,-32,0,32,65])box(80,2.8,z,.15,1.2,8.5,M.glassShade);
  box(-94,14,-52,25,28,48,M.ivory);box(-94,28.35,-52,26,.6,49,M.metal);for(const y of[5,10,15,20,25])box(-81.3,y,-52,.1,1.8,45,M.glassShade);label('AEON','イオン橋本店',-81.15,21.6,-49,25,5.1,'#f0e7e2','#94496f',Math.PI/2);
  const skyline=[[-61,-100,22,34,20],[-27,-104,20,28,18],[6,-105,22,39,18],[47,-107,27,33,23],[93,-73,21,36,25],[101,-15,26,30,25],[102,38,24,21,29],[-103,31,24,25,27]];
  skyline.forEach(([x,z,w,h,d],index)=>{
    const type=index%3,low=h*.7,upperW=w*(type===1?.72:.84),upperD=d*.8;
    box(x,low/2,z,w,low,d,type===0?M.glassShade:type===1?M.ivory:M.plaster);
    box(x+w*.06,low+(h-low)/2,z-d*.06,upperW,h-low,upperD,type===0?M.glass:type===1?M.stone:M.terracotta);
    box(x,low+.2,z,w+.6,.4,d+.6,M.ivory);box(x+w*.06,h+.2,z-d*.06,upperW+.5,.4,upperD+.5,M.metal);
    box(x+w*.15,h+1.15,z-d*.12,w*.28,1.8,d*.35,M.slate);
    const columns=Math.max(3,Math.floor(w/4.5)),spacing=(w-2)/columns;
    for(let y=4;y<low-1;y+=3.8)for(let col=0;col<columns;col++){
      const xx=x-w/2+1+spacing*(col+.5),ww=spacing-.65;
      box(xx,y,z+d/2+.04,ww,2.1,.12,(col+index)%3?M.glassShade:M.glassLight);
      box(xx,y-1.12,z+d/2+.14,ww+.22,.14,type===1?1.65:.26,type===2?M.terracotta:M.ivory);
      if(type===1){box(xx,y-.65,z+d/2+.96,ww+.2,.66,.08,M.edge);box(xx-ww/2,y-.45,z+d/2+.55,.12,1.05,1.5,M.stone);}
      else box(xx+ww/2+.1,y,z+d/2+.13,.13,2.4,.18,M.edge);
    }
    for(let xx=-upperW/2+2;xx<upperW/2;xx+=4.3){
      box(x+w*.06+xx,low+(h-low)/2,z-d*.06+upperD/2+.06,2.7,h-low-2,.1,M.glassShade);
      box(x+w*.06+xx+1.5,low+(h-low)/2,z-d*.06+upperD/2+.15,.16,h-low,.22,M.edge);
    }
    if(type===0)for(let xx=-w/2+2;xx<w/2;xx+=4.3)box(x+xx,low/2,z+d/2+.16,.19,low,.2,M.edge);
    if(type===2){cylinder(x-w*.23,h+1.6,z,1.1,2.8,M.edge);box(x-w*.23,h+3.1,z,2.5,.2,2.5,M.metal);}
    box(x,h+2.8,z-d*.1,.11,5.4,.11,M.metal);
  });
  for(const [x,z]of[[-75,60],[-76,-1],[77,58],[77,-62],[-65,-76]])tree(x,z,1.25,0);
  const sites=[{id:'A',name:'A / 北口コンコース',x:-38,z:-23,radius:7},{id:'B',name:'B / ミウィ前広場',x:43,z:-7,radius:7}].map(site=>({...site,polygon:SITE_AREAS[site.id].polygon.map(point=>[...point]),plantPositions:SITE_AREAS[site.id].plantPositions.map(point=>({...point}))}));
  function siteMark(site,color){
    const xs=site.polygon.map(p=>p[0]),zs=site.polygon.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),width=maxX-minX,depth=maxZ-minZ;
    const tex=canvasTexture((ctx,w,h)=>{
      ctx.clearRect(0,0,w,h);const sx=w/width,sz=h/depth,px=x=>(x-minX)*sx,pz=z=>(z-minZ)*sz;
      // A narrow edge, heavier corner brackets and registration ticks read as
      // real pavement paint, leaving the paving material visible underneath.
      ctx.strokeStyle=color;ctx.globalAlpha=.8;ctx.lineWidth=.13*Math.min(sx,sz);ctx.strokeRect(ctx.lineWidth/2,ctx.lineWidth/2,w-ctx.lineWidth,h-ctx.lineWidth);
      for(const [x,z,dx,dz]of[[0,0,1,1],[w,0,-1,1],[w,h,-1,-1],[0,h,1,-1]]){
        ctx.lineWidth=.22*Math.min(sx,sz);ctx.beginPath();ctx.moveTo(x+dx*2.1*sx,z+dz*.12*sz);ctx.lineTo(x+dx*.12*sx,z+dz*.12*sz);ctx.lineTo(x+dx*.12*sx,z+dz*2.1*sz);ctx.stroke();
        ctx.lineWidth=.09*Math.min(sx,sz);for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(x+dx*(.35+i*.24)*sx,z+dz*.5*sz);ctx.lineTo(x+dx*(.68+i*.24)*sx,z+dz*.83*sz);ctx.stroke();}
      }
      ctx.lineWidth=.06*Math.min(sx,sz);for(let x=2.5;x<width-2;x+=2.5)for(const z of[0,depth]){const sign=z===0?1:-1;ctx.beginPath();ctx.moveTo(x*sx,z*sz);ctx.lineTo(x*sx,(z+sign*.35)*sz);ctx.stroke();}
      const centerX=px(site.x),centerZ=pz(site.z);ctx.fillStyle=color;ctx.globalAlpha=.65;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 ${Math.round(3.5*sz)}px "Segoe UI",sans-serif`;ctx.fillText(site.id,centerX,centerZ);
      ctx.font=`600 ${Math.round(.26*sz)}px "Segoe UI",sans-serif`;ctx.fillText(site.id==='A'?'NORTH CONCOURSE':'MEWE FORECOURT',centerX,centerZ+2.05*sz);
      ctx.textAlign='left';ctx.font=`600 ${Math.round(.22*sz)}px "Segoe UI",sans-serif`;ctx.fillText(`PLANT ZONE ${site.id} / ${Math.round(width)} × ${Math.round(depth)}`,1.1*sx,h-.65*sz);
      // Small chips interrupt the paint instead of adding an opaque dirt layer.
      ctx.globalCompositeOperation='destination-out';for(let i=0;i<115;i++){const x=(i*179)%w,z=(i*293+Math.floor(i/9)*31)%h;ctx.globalAlpha=.12+(i%4)*.06;ctx.fillRect(x,z,1+i%5,1+i%3);}ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    },1024,1024);
    const mat=new THREE.MeshStandardMaterial({map:tex,transparent:true,opacity:.93,depthWrite:false,roughness:.96,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const marking=plane((minX+maxX)/2,.018,(minZ+maxZ)/2,width,depth,mat,-Math.PI/2);marking.name=`${site.id} / painted planting perimeter`;marking.userData.solid=false;marking.raycast=()=>{};
  }
  siteMark(sites[0],'#ecd08e');siteMark(sites[1],'#b8d9c7');label('A ←','NORTH CONCOURSE',-11,2.6,-.1,3,2.1,'#edd08e');label('B →','MEWE FORECOURT',14.88,2.7,3.5,3,2.1,'#b7d8c9');label('北口広場','HASHIMOTO / NORTH SQUARE',0,2.7,79.98,20,3.1,'#dee7d7','#314e59',Math.PI);
  // Close only the unguarded shoulders at each stair landing. Their five-metre
  // openings stay clear, and these details reuse the existing rail batches.
  railing(-65.5,3.25,-27.88,3);
  railing(69.275,3.25,-7.86,1.45);
  railing(75.5,3.25,-7.86,1);
  // Two ankle-height rises join the 3.2m deck to the 3.45m Mewe canopy.
  // The pale stone threshold sits on the existing deck finish, not in its lane.
  box(62,3.2875,-13.72,28.9,.075,.7,M.ivory);
  const foliageTint=new THREE.Color();
  for(const {mat,geometry,entries,legacyPropMoves,legacyPositions}of batches.values()){
    const mesh=new THREE.InstancedMesh(geometry,mat,entries.length),foliageCore=mat===M.leaf||mat===M.leafLight||mat===M.leafDark;
    entries.forEach((entry,index)=>{
      mesh.setMatrixAt(index,entry);
      if(foliageCore){
        // A fixed world-space seed varies the leaf finishes without moving the
        // existing opaque cores or changing their bullet intersections.
        const e=entry.elements,old=legacyPositions?.get(index),phase=Math.sin((old?old[0]:e[12])*12.9898+(old?old[1]:e[13])*39.3467+(old?old[2]:e[14])*78.233)*43758.5453;
        const shade=.9+(phase-Math.floor(phase))*.18;foliageTint.setRGB(shade,shade,shade);mesh.setColorAt(index,foliageTint);
      }
    });
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.solid=true;if(legacyPropMoves)mesh.userData.legacyPropMoves=legacyPropMoves;if(mat===leafCards||groundDetailMaterials.has(mat)){mesh.userData.solid=false;mesh.raycast=()=>{};}if(groundDetailMaterials.has(mat))mesh.castShadow=false;world.add(mesh);
  }
  world.updateMatrixWorld(true);
  const teamSpawns={attack:[{x:0,z:65},{x:-3,z:67},{x:3,z:67},{x:-6,z:70},{x:6,z:70}],defend:[{x:0,z:-72},{x:-3,z:-74},{x:3,z:-74},{x:-6,z:-70},{x:6,z:-70}]};
  const {lanes,callouts,layout}=createTacticalMetadata();
  const landmarks=[{id:'north',name:'橋本駅 北口',x:-23,z:-11,yaw:0},{id:'south',name:'南側ゲート',x:0,z:64,yaw:0},{id:'mewe',name:'ミウィ前広場',x:43,z:-7,yaw:-.55},{id:'aeon',name:'イオン側通路',x:-65,z:-45},{id:'bus',name:'バスターミナル',x:-55,z:28},{id:'mid',name:'中央案内所',x:-9.5,z:4},{id:'deck',name:'連絡デッキ階段',x:72.5,z:17,yaw:0}];
  const zones=[{name:sites[0].name,x:-38,z:-23,radius:12},{name:sites[1].name,x:43,z:-7,radius:12},{name:'北口コンコース',x:-20.7,z:-47,radius:19},{name:'バス通り',x:-55,z:17,radius:29},{name:'ミウィ通り',x:55,z:28,radius:27},{name:'中央連絡路',x:-8,z:5,radius:26},{name:'南側ゲート',x:0,z:65,radius:23},{name:'駅裏サービス通路',x:0,z:-70,radius:24}];
  surface('mewe-canopy-metal',62,-16.6,28.6,5.2,2.95,3.35);
  surface('mewe-canopy-cap',62,-16.6,28.9,5.4,3.35,3.45);
  surface('mewe-deck-threshold',62,-13.72,28.9,.7,3.25,3.325);
  surface('bus-shelter-metal',-62.5,8,10.8,34,4.025,4.375);
  surface('bus-shelter-cap',-62.5,8,11.2,34.6,4.37,4.49);
  for(const [id,left,right]of[['west',-59.5,-29.6],['east',-11.9,19.5]])surface(`station-${id}-canopy-metal`,(left+right)/2,-30.6,right-left,5.5,5.375,5.825);
  for(const [id,left,right]of[['west',-59.75,-29.6],['east',-11.9,19.75]])surface(`station-${id}-canopy-cap`,(left+right)/2,-30.6,right-left,5.8,5.82,5.92);
  for(const x of[-34,-27,-20]){
    surface(`south-stone-${x}-body`,x,66,5.5,1.2,0,.7);
    surface(`south-stone-${x}-cap`,x,66,5.8,1.4,.67,.79);
  }
  surface('west-retail-front-canopy',-30,42.55,27.4,2.2,3.475,3.725);
  surface('west-retail-side-canopy',-43.3,25,2.2,34,3.475,3.725);
  for(const z of[15,35])surface(`west-retail-small-canopy-${z}`,-44.25,z,2.7,5.2,2.71,2.89);
  surface('east-retail-side-canopy',43.5,25,2,34,3.38,3.62);
  surface('information-roof-metal',0,14,13.7,15.7,3.8,4.3);
  surface('information-roof-cap',0,14,14.1,16.1,4.275,4.425);
  surface('staff-roof-metal',29,-44,15,20,4.8,5.2);
  surface('staff-roof-cap',29,-44,14.4,19.4,5.2,5.4);
  surface('divider-roof-metal',4,-15.5,22.7,25.7,6.45,6.71);
  surface('divider-roof-teal',4,-15.5,23,26,6.72,6.84);
  surface('divider-roof-cap',4,-15.5,22.5,25.5,6.84,6.96);
  surface('station-portal-soffit',-20.75,-32,16.7,1.9,3.995,4.075);
  surface('station-portal-metal',-20.75,-32,17.4,2.1,4.085,4.365);
  surface('station-portal-cap',-20.75,-32,17.8,2.2,4.36,4.45);
  colliders.push(...railingColliders,...surfaceColliders);
  // The new circulation is built from closed shopfronts and service rooms.
  // Separate batches make the preserved station, stair and roof assets auditable.
  const tacticalWorld=new THREE.Group();tacticalWorld.name='Tactical layout / additions';tacticalWorld.userData.tacticalLayout=true;world.add(tacticalWorld);
  const tacticalBatches=new Map();batchTarget=tacticalBatches;
  const wayfinding=textMaterial((ctx,w,h)=>{
    ctx.fillStyle='#304f56';ctx.fillRect(0,0,w,h);ctx.fillStyle='#e3e7d5';ctx.font='700 34px "Yu Gothic",sans-serif';ctx.textAlign='center';ctx.fillText('橋本駅前 / STATION WALK',w/2,50);
    ctx.fillStyle='#b6ccba';ctx.font='600 22px Arial';ctx.fillText('NORTH EXIT   /   SHOPS & BUS',w/2,92);
    ctx.fillStyle='#d6bd7b';ctx.fillRect(15,h-9,w-30,3);
  },512,128);
  const wayfindingGeo=new THREE.PlaneGeometry(1,1);
  function tacticalPhysical(id,x,y,z,w,h,d,overhead=false){
    const collider=physical(x,y,z,w,h,d,{kind:'tactical',color:overhead?'#819a9d':'#687f82'});collider.layoutId=id;
    const shape=mapShapes.at(-1);shape.layoutId=id;shape.base=collider.base;shape.height=collider.height;if(overhead)shape.kind='overhead';
    return collider;
  }
  function shopFacade(building,side){
    const {minX,maxX,minZ,maxZ,height:h,finish,id}=building,x=(minX+maxX)/2,z=(minZ+maxZ)/2,w=maxX-minX,d=maxZ-minZ;
    const ry=side===0?0:side===1?Math.PI:side===2?Math.PI/2:-Math.PI/2;
    const length=side<2?w:d,fx=side<2?x:side===2?maxX:minX,fz=side===0?maxZ:side===1?minZ:z;
    const c=Math.cos(ry),s=Math.sin(ry),part=(a,y,out,ww,hh,dd,mat)=>box(fx+a*c+out*s,y,fz-a*s+out*c,ww,hh,dd,mat,ry);
    const service=finish==='service',count=Math.max(1,Math.floor(length/7)),spacing=(length-1.1)/count;
    // Projecting stone jambs, a recessed dark reveal and separate glass plane
    // give the closed frontage depth at the scale seen while turning a corner.
    for(let i=0;i<count;i++){
      const a=-length/2+.55+spacing*(i+.5),pw=Math.min(4.35,spacing-.55),ph=service?1.6:2.2,py=service?2.35:1.65;
      part(a,py,.025,pw+.25,ph+.25,.08,M.dark);
      part(a,py,.1,pw,ph,.08,service?M.slate:finish==='waiting'?M.glassLight:M.glassShade);
      for(const dx of[-pw/2-.08,pw/2+.08])part(a+dx,py,.16,.14,ph+.4,.28,service?M.edge:M.ivory);
      for(const yy of[py-ph/2-.08,py+ph/2+.08])part(a,yy,.17,pw+.3,.14,.3,service?M.edge:M.ivory);
      if(service){for(let yy=py-ph/2+.1;yy<py+ph/2;yy+=.27)part(a,yy,.165,pw-.15,.065,.1,M.edge);}
      else{part(a,py,.17,.07,ph,.1,M.metal);part(a,py-ph/2-.18,.24,pw+.42,.12,.48,M.stone);}
      if(finish==='news')for(let j=0;j<5;j++)part(a-pw*.34+j*pw*.17,.78,.19,pw*.11,.42+.07*(j%3),.12,[M.ivory,M.yellow,M.teal,M.terracotta][j%4]);
    }
    for(const y of[.32,h-.48])part(0,y,.055,length-.18,.09,.12,M.concrete);
    for(let a=-length/2+3;a<length/2;a+=5.7)part(a,(h+.6)/2,.025,.035,h-.7,.05,M.slate);
    // Shop fascias run across the closed doors; they do not suggest a walkable
    // doorway where the architectural footprint is intentionally solid.
    part(0,h-.76,.13,length-.12,.31,.28,finish==='cafe'?M.wood:finish==='dining'?M.teal:M.metal);
    if((side===0||side===1)&&length>12){
      const signWidth=Math.min(length-2.2,8.6),out=.285;
      box(fx+out*s,h-.75,fz+out*c,signWidth,.64,1,wayfinding,ry,0,wayfindingGeo);
    }
    if((id==='a-cafe'&&side===1)||(id==='b-dining'&&side===1)||(id==='mid-newsstand'&&side===0)){
      const aw=length-.6,depth=.7,ay=h-1.12,offset=depth/2;
      part(0,ay,offset,aw,.16,depth,M.metal);part(0,ay+.1,offset,aw,.04,depth,finish==='cafe'?M.mutedCoral:finish==='news'?M.yellow:M.teal);
      part(0,ay-.13,depth-.025,aw,.2,.08,finish==='cafe'?M.mutedCoral:M.ivory);
      tacticalPhysical(id+'/awning',fx+offset*s,ay+.01,fz+offset*c,side<2?aw:depth,.22,side<2?depth:aw,true);
    }
  }
  for(const building of TACTICAL_BUILDINGS){
    const {id,minX,maxX,minZ,maxZ,height:h,finish}=building,x=(minX+maxX)/2,z=(minZ+maxZ)/2,w=maxX-minX,d=maxZ-minZ;
    const baseMaterial=finish==='cafe'?brick:finish==='dining'?M.ivory:finish==='news'?M.wood:finish==='waiting'?M.stone:M.concrete;
    tacticalPhysical(id,x,h/2,z,w,h,d);
    box(x,(h-.16)/2,z,w,h-.16,d,baseMaterial);
    box(x,.14,z,w,.28,d,M.slate);
    box(x,h-.13,z,w,.18,d,M.metal);box(x,h-.035,z,w,.07,d,finish==='cafe'?M.terracotta:finish==='news'?M.slate:M.teal);
    for(const xx of[minX+.12,maxX-.12])for(const zz of[minZ+.12,maxZ-.12])box(xx,(h-.3)/2,zz,.24,h-.3,.24,M.ivory);
    for(let side=0;side<4;side++)shopFacade(building,side);
  }
  batchTarget=batches;
  for(const {mat,geometry,entries}of tacticalBatches.values()){
    const mesh=new THREE.InstancedMesh(geometry,mat,entries.length);entries.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=mat!==wayfinding;mesh.receiveShadow=true;mesh.userData.solid=true;tacticalWorld.add(mesh);
  }
  // Observed facade/ceiling trim has its own group and batches so the original
  // walkable station and all existing mesh transforms remain independently auditable.
  const surveyWorld=new THREE.Group();surveyWorld.name='Station survey / facade details';surveyWorld.userData.stationSurvey=true;world.add(surveyWorld);
  const surveyBatches=new Map();batchTarget=surveyBatches;
  const surveyDetails=addHashimotoSurvey({box,label:(...args)=>{const p=label(...args);p.userData.solid=false;p.raycast=()=>{};surveyWorld.add(p);return p;},M});
  for(const{mat,geometry,entries}of surveyBatches.values()){const mesh=new THREE.InstancedMesh(geometry,mat,entries.length);entries.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.solid=false;mesh.raycast=()=>{};surveyWorld.add(mesh);}
  batchTarget=batches;
  // The overhead station slab is still physical above the concourse, but the
  // plan now shows its outline rather than painting the ground passage shut.
  for(let i=0;i<colliders.length;i++){
    const collider=colliders[i];
    if(collider.kind==='overhead'){
      const shape=mapShapes.find(value=>value.kind==='overhead'&&value.polygon&&value.polygon.every(([x,z])=>x>=collider.minX-1e-6&&x<=collider.maxX+1e-6&&z>=collider.minZ-1e-6&&z<=collider.maxZ+1e-6));
      if(shape){shape.kind='overhead';shape.base=collider.base;shape.height=collider.height;}
    }
  }
  world.updateMatrixWorld(true);
  const collision=createCollisionIndex(colliders);
  const rangeArea={spawn:{x:-20.75,z:-25.5,yaw:0},targets:[{x:-25.2,z:-38},{x:-20.75,z:-39},{x:-16.4,z:-40},{x:-23.7,z:-44.5},{x:-17.6,z:-45.5},{x:-25.2,z:-49.5},{x:-20.7,z:-50.5},{x:-16.4,z:-52.2}]};
  return {world,bounds,colliders,collision,mapShapes,surveyDetails,sites,teamSpawns,lanes,landmarks,zones,callouts,ramps,rangeArea,layout,spawn:{x:0,z:65,yaw:0},enemySpawns:teamSpawns.defend,spawnYaw:{attack:0,defend:1.93878},buyAreas:{attack:{x:0,z:65,radius:12},defend:{x:0,z:-72,radius:10}},combatBounds:bounds,menuCamera:{position:[-47,10,-4],target:[-31,6,-37]},origin:{lat:35.5949,lon:139.34497},stats:{mode:'arena',width:164,depth:164,area:26896,buildings:16+TACTICAL_BUILDINGS.length,sites:2,routes:3,collisionShapes:colliders.length,renderBatches:batches.size+tacticalBatches.size+surveyBatches.size}};
}
