import {createCollisionIndex} from './collision.js';
import {createTrcTraversal} from './trc-traversal.js';
import {TRC_FLOOR,TRC_DECKS,TRC_STAIRS,TRC_LADDERS,TRC_DUCTS,TRC_DOORS,TRC_COVERS,TRC_SCREENS,trcPoint as P,trcRect as R,contains,rectPolygon,stairHeight,trcDeckCut,trcDuctAt} from './trc-layout.js';

// A joined architectural shell, with authored surface profiles and batched
// fixtures. Collision is built from the same floor/wall outlines as the art.
export function createTrcMap(T,scene){
 const world=new T.Group();world.name='TRC / independent sound market';scene.add(world);
 const bounds={minX:-36,maxX:36,minZ:-30,maxZ:30},colliders=[],mapShapes=[],batches=new Map();
 const materials={},textures=[];
 const material=(key,color,roughness=.8,metalness=0)=>materials[key]=new T.MeshStandardMaterial({color,roughness,metalness});
 material('wall','#d7d2c5');material('dado','#888c86');material('trim','#ece6d8',.55,.35);
 material('steel','#3b4b53',.45,.65);material('aluminium','#9bacae',.38,.72);material('dark','#1d2b33');
 material('orange','#bc6142');material('blue','#347782');material('cream','#cbbfa2');material('wood','#b49c78');
 material('floor','#aaaca4',.92);material('rubber','#303d43',.95);material('cloth','#c8beb1',.96);
 material('light','#e6f2ed',.32);materials.light.emissive=new T.Color('#bfdedc');materials.light.emissiveIntensity=1.7;
 material('warmLight','#ffdb96',.35);materials.warmLight.emissive=new T.Color('#ffc779');materials.warmLight.emissiveIntensity=1.5;
 function texture(draw,w=512,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;textures.push(t);return t;}
 const concrete=texture((c,w,h)=>{c.fillStyle='#d5d4ce';c.fillRect(0,0,w,h);for(let i=0;i<8000;i++){c.fillStyle=i%3?'rgba(51,61,58,.035)':'rgba(255,255,255,.16)';c.fillRect(i*73%w,(i*131+Math.floor(i/17)*13)%h,1+i%3,1);}c.strokeStyle='rgba(51,61,58,.18)';c.lineWidth=1;c.strokeRect(.5,.5,w-1,h-1);});
 concrete.wrapS=concrete.wrapT=T.RepeatWrapping;concrete.repeat.set(1/6,1/6);materials.floor.map=concrete;
 const panel=texture((c,w,h)=>{c.fillStyle='#dddcd5';c.fillRect(0,0,w,h);c.fillStyle='#8f9793';c.fillRect(0,0,2,h);c.fillRect(0,0,w,2);for(let i=0;i<2000;i++){c.fillStyle='rgba(42,49,45,.035)';c.fillRect(i*47%w,i*101%h,2,1);}});
 panel.wrapS=panel.wrapT=T.RepeatWrapping;panel.repeat.set(.42,.3);materials.wall.map=panel;
 const metalTex=texture((c,w,h)=>{c.fillStyle='#bcc5c5';c.fillRect(0,0,w,h);for(let i=0;i<64;i++){c.strokeStyle=i%2?'#a4afaf':'#e0e6e4';c.beginPath();c.moveTo(i*8,0);c.lineTo(i*8,h);c.stroke();}},256,256);
 metalTex.wrapS=metalTex.wrapT=T.RepeatWrapping;materials.aluminium.map=metalTex;
 const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,12),sphere=new T.SphereGeometry(1,12,8);
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),position=new T.Vector3(),scale=new T.Vector3();
 function meshData(geo,key,matrix=null){
  const g=geo.index?geo.toNonIndexed():geo.clone();if(matrix)g.applyMatrix4(matrix);
  const bucket=batches.get(key)||{position:[],normal:[],uv:[]};batches.set(key,bucket);
  for(const name of ['position','normal','uv']){const a=g.getAttribute(name);if(a)for(const v of a.array)bucket[name].push(v);else for(let i=0;i<g.getAttribute('position').count*(name==='uv'?2:3);i++)bucket[name].push(0);}
  g.dispose();
 }
 function part(x,y,z,w,h,d,key,ry=0,geo=box,rz=0){matrix.compose(position.set(x,y,z),rotation.setFromEuler(new T.Euler(0,ry,rz)),scale.set(w,h,d));meshData(geo,key,matrix);}
 function quad(a,b,c,d,key,uv=null){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3));const u=uv||[[0,0],[Math.hypot(a[0]-b[0],a[2]-b[2]),0],[Math.hypot(a[0]-b[0],a[2]-b[2]),Math.hypot(b[1]-c[1],b[2]-c[2])],[0,Math.hypot(b[1]-c[1],b[2]-c[2])]];g.setAttribute('uv',new T.Float32BufferAttribute([...u[0],...u[1],...u[2],...u[0],...u[2],...u[3]],2));g.computeVertexNormals();meshData(g,key);g.dispose();}
 function physical(r,base,height,kind='cover',more={}){const c={...r,base,height,kind,...more};colliders.push(c);return c;}
 function solid(r,base,height,key,kind='cover'){part((r.minX+r.maxX)/2,(height+base)/2,(r.minZ+r.maxZ)/2,r.maxX-r.minX,height-base,r.maxZ-r.minZ,key);return physical(r,base,height,kind);}
 // Partition a rectilinear union at its exact vertices, then join adjacent cells
 // for collision. Only exposed edges become walls; internal seams have no faces.
 function union(rects,cuts=[],complement=false){
  const xs=[...new Set([bounds.minX,bounds.maxX,...rects.flatMap(r=>[r.minX,r.maxX]),...cuts.flatMap(r=>[r.minX,r.maxX])])].sort((a,b)=>a-b);
  const zs=[...new Set([bounds.minZ,bounds.maxZ,...rects.flatMap(r=>[r.minZ,r.maxZ]),...cuts.flatMap(r=>[r.minZ,r.maxZ])])].sort((a,b)=>a-b);
  const set=new Set(),cells=[],edges=[],rectangles=[];
  for(let iz=0;iz<zs.length-1;iz++)for(let ix=0;ix<xs.length-1;ix++){const x=(xs[ix]+xs[ix+1])/2,z=(zs[iz]+zs[iz+1])/2;let yes=rects.some(r=>contains(r,x,z))&&!cuts.some(r=>contains(r,x,z));if(complement)yes=!yes;if(yes){set.add(ix+','+iz);cells.push({minX:xs[ix],maxX:xs[ix+1],minZ:zs[iz],maxZ:zs[iz+1],ix,iz});}}
  for(const r of cells){const {minX:x,maxX:X,minZ:z,maxZ:Z,ix,iz}=r;if(!set.has((ix-1)+','+iz))edges.push([x,z,x,Z]);if(!set.has((ix+1)+','+iz))edges.push([X,Z,X,z]);if(!set.has(ix+','+(iz-1)))edges.push([X,z,x,z]);if(!set.has(ix+','+(iz+1)))edges.push([x,Z,X,Z]);}
  for(let iz=0;iz<zs.length-1;iz++){let start=null;for(let ix=0;ix<xs.length;ix++){const on=set.has(ix+','+iz);if(on&&start===null)start=ix;if(!on&&start!==null){const r={minX:xs[start],maxX:xs[ix],minZ:zs[iz],maxZ:zs[iz+1]},old=rectangles.find(v=>v.minX===r.minX&&v.maxX===r.maxX&&v.maxZ===r.minZ);if(old)old.maxZ=r.maxZ;else rectangles.push(r);start=null;}}}
  return {cells,edges,rectangles};
 }
 function walls(edges,lo,hi,key){for(const [x,z,X,Z]of edges)quad([x,lo,z],[X,lo,Z],[X,hi,Z],[x,hi,z],key);}
 function slab(rects,cuts,lo,hi,key,id){const u=union(rects,cuts);for(const r of u.cells){const {minX:x,maxX:X,minZ:z,maxZ:Z}=r;quad([x,hi,z],[x,hi,Z],[X,hi,Z],[X,hi,z],key);quad([x,lo,z],[X,lo,z],[X,lo,Z],[x,lo,Z],key);}walls(u.edges,lo,hi,key);for(const r of u.rectangles)physical(r,lo,hi,'surface',{surfaceId:id});return u;}
 // One continuous hall floor and envelope, rather than separate room boxes.
 quad([-36,0,-30],[-36,0,30],[36,0,30],[36,0,-30],'floor',[[0,0],[0,60],[72,60],[72,0]]);
 const shell=union(TRC_FLOOR,[],true);walls(shell.edges,0,1.15,'dado');walls(shell.edges,1.15,1.21,'steel');walls(shell.edges,1.21,9.6,'wall');
 for(const r of shell.rectangles){physical(r,0,9.6,'building');mapShapes.push({polygon:rectPolygon(r),color:'#536069',kind:'building'});}
 // Exterior cap and ceiling prevent all flight skills from leaving the hall.
 for(const r of [R(0,0,72,.3),R(0,59.7,72,.3),R(0,0,.3,60),R(71.7,0,.3,60)])solid(r,0,10,'wall','building');
 slab([bounds],[],9.6,9.85,'dark','ceiling');
 function rail(x,z,w,d,y){solid({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2},y,y+.78,'steel','railing');part(x,y+.84,z,w,.09,d+.06,'aluminium');}
 for(const height of [1.2,3.2,3.6]){
  const decks=TRC_DECKS.filter(r=>r.y===height),cuts=[...TRC_STAIRS.filter(r=>r.height===height),...TRC_LADDERS.filter(l=>l.height===height).map(l=>l.hole)];
  const u=slab(decks,cuts,height-.22,height,'steel','deck-'+height);
  for(const r of decks)mapShapes.push({polygon:rectPolygon(r),color:'#a6c7bf',kind:'overhead'});
  // Continuous fascia at the gallery edge, interrupted at stairs and ladders.
  if(height>2)for(const [x,z,X,Z]of u.edges){const len=Math.hypot(X-x,Z-z);if(len<.6)continue;const mid={x:(x+X)/2,z:(z+Z)/2};if(TRC_STAIRS.some(r=>r.height===height&&contains(r,mid.x,mid.z,.3))||TRC_LADDERS.some(l=>l.height===height&&contains(l.hole,mid.x,mid.z,.2)))continue;rail(mid.x,mid.z,Math.max(.1,Math.abs(X-x)),Math.max(.1,Math.abs(Z-z)),height);}
 }
 // Gallery rails are vaultable (0.87m); a normal jump drops into each site.
 for(const r of TRC_STAIRS){
  const count=r.steps,w=r.maxX-r.minX,d=r.maxZ-r.minZ;
  for(let i=0;i<count;i++){
   const f=(i+.5)/count,rect=r.axis==='x'?{minX:r.minX+w*i/count,maxX:r.minX+w*(i+1)/count,minZ:r.minZ,maxZ:r.maxZ}:{minX:r.minX,maxX:r.maxX,minZ:r.minZ+d*i/count,maxZ:r.minZ+d*(i+1)/count};
   const h=r.height*(r.direction<0?count-i:i+1)/count;
   solid(rect,0,h,'steel','stairs');
   // Anti-slip noses, each fitted to its actual stair tread.
   const x=(rect.minX+rect.maxX)/2,z=(rect.minZ+rect.maxZ)/2;
   part(x,h+.003,z,rect.maxX-rect.minX,.006,Math.min(.06,rect.maxZ-rect.minZ),'aluminium');
  }
  mapShapes.push({polygon:rectPolygon(r),color:'#8a9c9c',kind:'stairs'});
 }
 // Hollow ducts and open ladder shafts: two connected levels, no teleport.
 for(const duct of TRC_DUCTS){
  const u=union(duct.rects);
  slab(duct.rects,[],duct.height,duct.height+.13,'aluminium',duct.id+'-roof');
  const opening=([x,z,X,Z])=>duct.id==='U1'?Math.abs(z-Z)<.01&&(Math.abs(z-5.9)<.02||Math.abs(z+4.1)<.02):Math.abs(x-X)<.01&&(Math.abs(x-29)<.02||Math.abs(x-30.9)<.02);
  for(const e of u.edges){if(opening(e))continue;const[x,z,X,Z]=e,r={minX:Math.min(x,X)-.065,maxX:Math.max(x,X)+.065,minZ:Math.min(z,Z)-.065,maxZ:Math.max(z,Z)+.065};solid(r,0,duct.height+.13,'aluminium','duct-wall');}
  for(const r of duct.rects){part((r.minX+r.maxX)/2,.004,(r.minZ+r.maxZ)/2,r.maxX-r.minX,.008,r.maxZ-r.minZ,'aluminium');mapShapes.push({polygon:rectPolygon(r),color:'#669b8f',kind:'overhead'});}
 }
 // The A service shaft is separated from the site by a wall below the catwalk.
 for(const r of [R(30,20,.18,7),R(33.82,20,.18,6),R(30,20,4,.18)])solid(r,0,3.0,'steel','shaft-wall');
 for(const l of TRC_LADDERS){
  for(const dz of [-.5,.5])part(l.x+.55,l.height/2,l.z+dz,.045,l.height+1,.045,'orange',0,cylinder);
  for(let y=.2;y<l.height+.4;y+=.28)part(l.x+.55,y,l.z,.052,.95,.052,'aluminium',Math.PI/2,cylinder,Math.PI/2);
  part(l.x+.68,l.height/2,l.z,.08,l.height,1.5,'steel');
 }
 // Doors have a solid lintel, readable controls and an independently animated
 // ribbed shutter. Opening raises it into the housing; destroyed leaves vanish.
 const doorMeshes=new Map();
 for(const d of TRC_DOORS){
  const g=new T.Group();g.name=d.id+' / '+d.label;g.position.set(d.x,d.y,d.z);g.rotation.y=d.axis==='z'?Math.PI/2:0;world.add(g);
  const tex=texture((c,w,h)=>{c.fillStyle='#52686b';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=22){c.fillStyle='#8b9d9b';c.fillRect(0,y,w,2);c.fillStyle='#31494d';c.fillRect(0,y+19,w,3);}c.fillStyle='#dfaf67';c.fillRect(0,h-24,w,24);},256,512);
  const mat=new T.MeshStandardMaterial({map:tex,roughness:.58,metalness:.45});const leaf=new T.Mesh(new T.BoxGeometry(d.width,2.9,.13),mat);leaf.position.y=1.45;leaf.castShadow=true;leaf.userData.trcDoor=d.id;g.add(leaf);doorMeshes.set(d.id,{group:g,leaf,amount:0});
  const r=d.axis==='x'?{minX:d.x-d.width/2,maxX:d.x+d.width/2,minZ:d.z-.15,maxZ:d.z+.15}:{minX:d.x-.15,maxX:d.x+.15,minZ:d.z-d.width/2,maxZ:d.z+d.width/2};
  physical(r,d.y,d.y+2.9,'door',{doorId:d.id});solid(r,d.y+2.9,d.y+3.65,'steel','lintel');
  for(const dir of [-1,1]){const x=d.x+(d.axis==='x'?dir*(d.width/2+.1):0),z=d.z+(d.axis==='z'?dir*(d.width/2+.1):0);part(x,d.y+1.48,z,d.axis==='x'?.2:.44,2.96,d.axis==='x'?.44:.2,'aluminium');}
  mapShapes.push({polygon:rectPolygon(r),color:'#d9a16e',kind:'door'});
 }
 // Rounded, framed equipment cases and corrugated transport containers.
 function bevelGeometry(w,h,d,r=.055){const s=new T.Shape();s.moveTo(-w/2+r,-h/2+r);s.lineTo(w/2-r,-h/2+r);s.lineTo(w/2-r,h/2-r);s.lineTo(-w/2+r,h/2-r);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSegments:2,bevelSize:r,bevelThickness:r,steps:1,curveSegments:1});g.translate(0,0,-d/2+r);return g;}
 function rounded(x,y,z,w,h,d,key,r=.055){const g=bevelGeometry(w,h,d,r);part(x,y,z,1,1,1,key,0,g);g.dispose();}
 for(const [i,r]of TRC_COVERS.entries()){
  const x=(r.minX+r.maxX)/2,z=(r.minZ+r.maxZ)/2,w=r.maxX-r.minX,d=r.maxZ-r.minZ,h=r.height,key=x<0?'cream':'blue';
  rounded(x,h/2,z,w-.08,h-.04,d-(r.type==='container'?.16:.08),r.type==='rack'?'dark':key);physical(r,0,h,'cover');mapShapes.push({polygon:rectPolygon(r),color:'#7c8c8d',kind:'cover'});
  if(r.type==='container'){
   // Folded sheet profile. Recesses lie within the physical outer envelope.
   for(const side of [-1,1]){
    const n=Math.ceil((w-.2)/.3)*4;
    for(let i=0;i<n;i++){const a=x-w/2+.1+(w-.2)*i/n,b=x-w/2+.1+(w-.2)*(i+1)/n,za=z+side*(d/2-([0,1,1,0][i%4]?.012:.065)),zb=z+side*(d/2-([0,1,1,0][(i+1)%4]?.012:.065));
      if(side>0)quad([a,.16,za],[b,.16,zb],[b,h-.16,zb],[a,h-.16,za],key);
      else quad([b,.16,zb],[a,.16,za],[a,h-.16,za],[b,h-.16,zb],key);
    }
    part(x,h-.09,z+side*(d/2-.04),w-.1,.13,.08,'steel');part(x,.1,z+side*(d/2-.04),w-.1,.13,.08,'steel');
   }
   for(const side of [-1,1])for(const dz of [-d/2+.06,d/2-.06])part(x+side*(w/2-.07),h/2,z+dz,.12,h,.12,'steel');
   for(const dx of [-w*.23,w*.23]){part(x+dx,h/2,z+d/2+.012,.04,h-.3,.04,'aluminium',0,cylinder);part(x+dx,.95,z+d/2+.04,.22,.05,.035,'steel');}
  }else{
   for(const y of [.08,h-.08])for(const side of [-1,1]){part(x,y,z+side*(d/2-.025),w,.065,.045,'aluminium');part(x+side*(w/2-.025),y,z,.045,.065,d,'aluminium');}
   for(const dx of [-w/2+.05,w/2-.05])for(const dz of [-d/2+.05,d/2-.05])part(x+dx,h/2,z+dz,.065,h,.065,'aluminium');
   for(const side of [-1,1]){part(x,h*.53,z+side*d/2,.35,.13,.03,'dark');part(x,h*.53+.04,z+side*(d/2+.01),.24,.025,.025,'aluminium');}
   if(r.type==='rack')for(let y=.3;y<h-.2;y+=.28){part(x,y,z+d/2+.012,w-.2,.21,.024,'steel');for(let j=0;j<9;j++)part(x-w*.38+j*w*.085,y,z+d/2+.028,.045,.045,.03,j%3?'aluminium':'light',0,sphere);}
  }
 }
 for(const [i,r]of TRC_SCREENS.entries()){
  const h=i>7?2.7:2.25;solid(r,0,h,i%2?'blue':'cream','partition');
  part((r.minX+r.maxX)/2,h+.025,(r.minZ+r.maxZ)/2,r.maxX-r.minX+.03,.05,r.maxZ-r.minZ+.03,'aluminium');
 }
 // Structural columns support the galleries; open space beneath is usable Hell.
 for(const [x,z,h]of [[17,13,3.2],[25,13,3.2],[29,25,3.2],[51,13,3.6],[60,13,3.6],[67,18,3.6]]){
  const p=P(x,z),r={minX:p.x-.18,maxX:p.x+.18,minZ:p.z-.18,maxZ:p.z+.18};solid(r,0,h,'steel','column');
 }
 function sign(text,sub,x,y,z,w,h,bg='#223e47',fg='#f0e6d5',ry=0){
  const tex=texture((c,cw,ch)=>{c.fillStyle=bg;c.fillRect(0,0,cw,ch);c.fillStyle=fg;c.textAlign='left';c.textBaseline='middle';c.font='600 74px "Yu Gothic",sans-serif';c.fillText(text,36,sub?ch*.38:ch/2,cw-72);if(sub){c.font='500 27px "Segoe UI",sans-serif';c.fillText(sub,38,ch*.78,cw-76);}c.fillRect(0,0,12,ch);},1024,256);
  const m=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});const o=new T.Mesh(new T.PlaneGeometry(w,h),m);o.position.set(x,y,z);o.rotation.y=ry;world.add(o);return o;
 }
 function banner(text,sub,x,z,key){const p=P(x,z);part(p.x,6,p.z,7,.08,.2,'steel');sign(text,sub,p.x,5.25,p.z,6.8,1.4,key);for(const dx of [-2.8,2.8])part(p.x+dx,7.7,p.z,.018,3.4,.018,'aluminium');}
 banner('A  展示ホール','EXHIBITION / INDEPENDENT LABELS',19,15,'#92523a');
 banner('B  試聴ステージ','LISTENING / SOUND DECK',56,15,'#235c68');
 banner('MID  中央連絡','A SHORT ←  /  BACKSTAGE →',36,36,'#4c5854');
 banner('音の集まる場所','INDEPENDENT SOUND MARKET  /  TRC INSPIRED',36,53,'#284753');
 for(const d of TRC_DOORS)sign(d.id+'  '+d.label,'F  OPEN / CLOSE  ·  SHOOT TO BREAK',d.x,d.y+3.25,d.z+.23,d.width,.55,'#283c43','#f1d6a3',d.axis==='z'?Math.PI/2:0);
 for(const l of TRC_LADDERS)sign(l.id+'  ↑','HEAVEN / SOUND DECK',l.x+.72,1.7,l.z,1.2,.5,'#aa5f3e','#fff0d9',-Math.PI/2);
 for(const d of TRC_DUCTS)sign(d.id+'  メンテナンス','CTRL: CROUCH  /  SHIFT: SILENT',d.entry.x,1.73,d.entry.z,1.85,.48,'#345451');
 // CD art is original typography/geometric artwork in a shared atlas.
 const album=texture((c,w,h)=>{const colors=['#b75c42','#276578','#77866b','#d3b77c','#425d80','#a96c70','#515854','#568e8e'];for(let n=0;n<16;n++){const x=n%4*128,y=Math.floor(n/4)*128;c.fillStyle=colors[n%8];c.fillRect(x,y,128,128);c.strokeStyle='#e4d9b8';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.arc(x+64,y+55,12+i*7,(n%4)*.5,Math.PI*1.5);c.stroke();}c.fillStyle='#f4e7c9';c.font='500 12px sans-serif';c.fillText(['AFTERIMAGE','PORT / 01','夜と音','LOOP NOTES'][n%4],x+8,y+112);}});
 materials.album=new T.MeshStandardMaterial({map:album,roughness:.7});
 function table(x,z,ry=0){const p=P(x,z),group=new T.Matrix4().makeRotationY(ry);group.setPosition(p.x,0,p.z);
  const local=(a,b,c,w,h,d,key)=>{const m=new T.Matrix4().compose(new T.Vector3(a,b,c),new T.Quaternion(),new T.Vector3(w,h,d));meshData(box,key,group.clone().multiply(m));};
  local(0,.77,0,2.4,.08,.85,'wood');for(const dx of [-1,1])for(const dz of [-.3,.3])local(dx,.38,dz,.045,.76,.045,'steel');
  // Draped fabric surface, gently folded down the front of each sales table.
  const verts=[],uv=[];for(let i=0;i<18;i++){const x0=-1.22+i*2.44/18,x1=x0+2.44/18,y0=.12+Math.sin(i*1.7)*.018,y1=.12+Math.sin((i+1)*1.7)*.018;verts.push(x0,.82,.46,x1,.82,.46,x1,y1,.48,x0,.82,.46,x1,y1,.48,x0,y0,.48);uv.push(0,1,1,1,1,0,0,1,1,0,0,0);}const cloth=new T.BufferGeometry();cloth.setAttribute('position',new T.Float32BufferAttribute(verts,3));cloth.setAttribute('uv',new T.Float32BufferAttribute(uv,2));cloth.computeVertexNormals();meshData(cloth,'cloth',group);cloth.dispose();local(0,.817,0,2.43,.014,.9,'cloth');
  for(let i=0;i<6;i++){const g=new T.BoxGeometry(.24,.027,.24),a=g.attributes.uv;for(let j=0;j<a.count;j++)a.setXY(j,(a.getX(j)+(i%4))/4,(a.getY(j)+Math.floor(i/4))/4);const m=new T.Matrix4().makeTranslation(-.88+i*.35,.847,0);meshData(g,'album',group.clone().multiply(m));g.dispose();}
  const w=Math.abs(Math.cos(ry))*2.44+Math.abs(Math.sin(ry))*.92,d=Math.abs(Math.sin(ry))*2.44+Math.abs(Math.cos(ry))*.92;
  physical({minX:p.x-w/2,maxX:p.x+w/2,minZ:p.z-d/2,maxZ:p.z+d/2},0,.85,'table');
 }
 for(const [x,z,ry]of [[22,49,0],[26,49,0],[44,49,0],[48,49,0],[19,14,0],[23,14,0],[11,29,Math.PI/2],[45,16,Math.PI/2],[46,20,Math.PI/2],[57,28,0]])table(x,z,ry);
 // Stage equipment has shaped cones and frames, rather than featureless cubes.
 const speakerCone=new T.LatheGeometry([new T.Vector2(.035,.07),new T.Vector2(.09,.045),new T.Vector2(.24,-.035),new T.Vector2(.28,0),new T.Vector2(.3,.015)],24);
 for(const x of [46.7,52.3]){const p=P(x,23.7);rounded(p.x,2.05,p.z,.72,1.7,.62,'dark');physical({minX:p.x-.36,maxX:p.x+.36,minZ:p.z-.31,maxZ:p.z+.31},1.2,2.9,'speaker');
  for(const y of [1.7,2.38]){const m=new T.Matrix4().makeRotationX(Math.PI/2);m.setPosition(p.x,y,p.z+.32);meshData(speakerCone,'steel',m);part(p.x,y,p.z+.39,.07,.07,.07,'dark',0,sphere);}
 }
 speakerCone.dispose();
 const mic=P(49.7,24.3);part(mic.x,1.22,mic.z,.28,.035,.28,'steel',0,cylinder);part(mic.x,1.9,mic.z,.018,1.35,.018,'aluminium',0,cylinder);part(mic.x,2.59,mic.z,.045,.12,.045,'dark',0,cylinder);
 // Acoustic wall panels, framed posters and consistent skirting carry the detail.
 for(const [x,z,ry,text]of [[11,16,Math.PI/2,'音の余白'],[29.8,18,-Math.PI/2,'NEW RELEASES'],[44.2,18,Math.PI/2,'LISTEN HERE'],[67.8,27,-Math.PI/2,'SOUND MARKET']]){const p=P(x,z);sign(text,'ORIGINAL MUSIC / CIRCLE EXHIBITION',p.x,2.7,p.z,2.6,1.9,'#6f8174','#f2e5c7',ry);}
 // Ceiling ribs and suspended lights share one material batch per finish.
 for(let x=-30;x<=30;x+=12){part(x,8.85,0,.25,1.1,59.4,'steel');part(x,9.37,0,.56,.09,59.4,'aluminium');part(x,8.33,0,.56,.09,59.4,'steel');}
 for(let z=-24;z<=24;z+=8)part(0,9.15,z,71.4,.25,.22,'steel');
 for(let x=-24;x<=24;x+=12)for(let z=-20;z<=24;z+=10){if(!TRC_FLOOR.some(r=>contains(r,x,z)))continue;part(x,7.85,z,3,.15,.62,'steel');part(x,7.75,z,2.8,.035,.46,'light');for(const dx of [-1.2,1.2])part(x+dx,8.7,z,.015,1.7,.015,'aluminium');}
 world.add(new T.AmbientLight('#dce9e7',1.05));
 for(const [x,z,color]of [[-16,-9,'#ffdbaf'],[21,-9,'#c3e3ec'],[0,5,'#e6eedc'],[0,23,'#d3e5ee']]){const light=new T.PointLight(color,65,23,2);light.position.set(x,6.5,z);world.add(light);}
 const siteSpec=[{id:'A',name:'A / 展示ホール',r:[23.5,18,4,4],points:[[25,20],[26.5,19],[24.4,21]]},{id:'B',name:'B / 試聴ステージ前',r:[57.5,25,4,3],points:[[59,26.5],[60.4,26],[58.3,27]]}];
 const sites=siteSpec.map(s=>{const r=R(...s.r),p=P(s.r[0]+s.r[2]/2,s.r[1]+s.r[3]/2);for(const [x,z,X,Z]of union([r]).edges){const dx=X-x,dz=Z-z;part((x+X)/2,.009,(z+Z)/2,Math.max(.08,Math.abs(dx)),.018,Math.max(.08,Math.abs(dz)),s.id==='A'?'orange':'blue');}return {id:s.id,name:s.name,...p,radius:3,polygon:rectPolygon(r),plantPositions:s.points.map(([x,z],i)=>({id:s.id+'-'+['open','cover','deep'][i],style:['open','cover','deep'][i],...P(x,z)}))};});
 for(const s of sites)sign(s.id,'PLANT ZONE',s.x,.025,s.z,1.6,1.6,s.id==='A'?'#a65d40':'#286b77').rotation.x=-Math.PI/2;
 for(const [key,b]of batches){const g=new T.BufferGeometry();for(const name of ['position','normal','uv'])g.setAttribute(name,new T.Float32BufferAttribute(b[name],name==='uv'?2:3));g.computeBoundingSphere();const m=new T.Mesh(g,materials[key]);m.name='TRC / '+key;m.castShadow=true;m.receiveShadow=true;world.add(m);}
 const teamSpawns={attack:[P(36,55),P(33,55),P(39,55),P(30,55),P(42,55)],defend:[P(36,5),P(33,5),P(39,5),P(34.8,8),P(38,8)]};
 const regions=[['a','A 展示ホール',[10,12,20,18]],['b','B 試聴ホール',[44,12,24,18]],['mid','MID 中央連絡',[27,27,18,10]],['long','A ロング',[4,20,8,28]],['short','A ショート',[14,30,6,16]],['back','B 舞台裏',[48,30,6,12]],['b-main','B メイン',[58,28,10,20]],['attack','来場者エントランス',[24,51,24,7]],['defend','搬入サービス廊下',[12,2,49,11]]];
 const callouts=regions.map(([id,name,r])=>({id,name,polygon:rectPolygon(R(...r)),maxY:2.7,label:{...P(r[0]+r[2]/2,r[1]+r[3]/2),text:name.split(' ')[0]}}));
 for(const d of TRC_DECKS)if(d.y>2)callouts.unshift({id:d.id,name:({'a-heaven':'A ヘブン','a-catwalk':'A キャットウォーク','a-shaft':'A ダクト上','bridge':'上層連絡橋','mid-tower':'MID タワー','b-deck':'B 音響デッキ','b-tower':'B タワー'})[d.id],polygon:rectPolygon(d),minY:d.y-.2,maxY:8});
 const landmarks=[{id:'a',name:'A 展示ホール',...P(26,20),yaw:.6},{id:'b',name:'B 試聴ホール',...P(60,27),yaw:.4},{id:'mid',name:'MID 中央連絡',...P(38,35),yaw:0},{id:'heaven',name:'A ヘブン',...P(22,16,3.2),yaw:Math.PI},{id:'tower',name:'B タワー',...P(64,23,3.6),yaw:Math.PI},{id:'mid-tower',name:'MID タワー',...P(39,23,3.2),yaw:Math.PI},{id:'duct-a',name:'U1 ダクト入口',...P(34.9,37.5),yaw:0},{id:'duct-b',name:'U2 ダクト入口',...P(64,33),yaw:-Math.PI/2},{id:'stage',name:'B 試聴ステージ',...P(49,25,1.2),yaw:-Math.PI/2}];
 const map={id:'trc',name:'TRC 同人音楽即売会',shortName:'SOUND MARKET',indoor:true,world,bounds,combatBounds:bounds,colliders,collision:createCollisionIndex(colliders,8),mapShapes,ramps:TRC_STAIRS,sites,teamSpawns,callouts,zones:[],landmarks,
  spawn:{...teamSpawns.attack[0],yaw:0},enemySpawns:teamSpawns.defend,spawnYaw:{attack:0,defend:Math.PI},buyAreas:{attack:{...P(36,54),radius:7},defend:{...P(36,6),radius:5.5}},
  lanes:[{id:'long',name:'A ロング',points:[[36,49],[8,49],[8,26],[25,20]].map(p=>P(...p))},{id:'mid',name:'MID / A ショート',points:[[36,49],[36,35],[28,29],[26,20]].map(p=>P(...p))},{id:'b-main',name:'B メイン',points:[[36,49],[64,49],[66,38],[62,29],[60,27]].map(p=>P(...p))}],
  menuCamera:{position:[-22,2.3,0],target:[-12,2.6,-12]},rangeArea:{spawn:{...P(36,49),yaw:0},targets:[P(33,43),P(37,43),P(38,35.5),P(39,37)]},
  stats:{mode:'arena',width:72,depth:60,area:4320,sites:2,routes:3,buildings:1,collisionShapes:colliders.length,renderBatches:batches.size},
  ductAt:trcDuctAt,walkHeights(x,z){
   const out=[];if(TRC_FLOOR.some(r=>contains(r,x,z)))out.push(0);
   if(TRC_STAIRS.some(r=>contains(r,x,z,.4))){let h=0;for(const c of map.collision.query(x,z,.4))if(c.kind==='stairs'&&map.collision.overlaps(c,x,z,.4))h=Math.max(h,c.height);out.push(h);}
   for(const d of TRC_DECKS)if(contains(d,x,z)&&!trcDeckCut(x,z,d.y))out.push(d.y);
   return [...new Set(out)];
  }
 };
 map.traversal=createTrcTraversal(map,{doorMeshes});world.updateMatrixWorld(true);return map;
}
