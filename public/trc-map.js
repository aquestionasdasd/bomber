import {createCollisionIndex} from './collision.js';
import {createTrcTraversal} from './trc-traversal.js';
import {TRC_BOUNDS,TRC_ROOMS,TRC_OUTDOORS,TRC_PORTALS,TRC_WALLS,TRC_SITES,TRC_FLOOR,TRC_DECKS,TRC_STAIRS,TRC_LADDERS,TRC_DUCTS,TRC_DOORS,TRC_COVERS,TRC_SCREENS,trcPoint as P,trcRect as R,contains,rectPolygon,stairHeight,trcDeckCut,trcDuctAt} from './trc-layout.js';

// A joined architectural shell, with authored surface profiles and batched
// fixtures. Collision is built from the same floor/wall outlines as the art.
export function createTrcMap(T,scene){
 const world=new T.Group();world.name='TRC / independent sound market';scene.add(world);
 const bounds={...TRC_BOUNDS},colliders=[],mapShapes=[],batches=new Map();
 const materials={},textures=[];
 const material=(key,color,roughness=.8,metalness=0)=>materials[key]=new T.MeshStandardMaterial({color,roughness,metalness});
 material('wall','#d7d2c5');material('dado','#888c86');material('trim','#ece6d8',.55,.35);
 material('steel','#3b4b53',.45,.65);material('aluminium','#9bacae',.38,.72);material('dark','#1d2b33');
 material('orange','#bc6142');material('blue','#347782');material('cream','#cbbfa2');material('wood','#b49c78');
 material('tile','#d4cbb8',.7);material('paving','#8b969c',.95);material('glass','#346077',.26,.35);material('plant','#587461');material('floor','#aaaca4',.92);material('rubber','#303d43',.95);material('cloth','#c8beb1',.96);
 material('siteA','#c3b69c',.9);material('siteB','#91a6a0',.88);
 material('light','#e6f2ed',.32);materials.light.emissive=new T.Color('#bfdedc');materials.light.emissiveIntensity=1.7;
 material('warmLight','#ffdb96',.35);materials.warmLight.emissive=new T.Color('#ffc779');materials.warmLight.emissiveIntensity=1.5;
 function texture(draw,w=512,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;textures.push(t);return t;}
 const concrete=texture((c,w,h)=>{c.fillStyle='#d5d4ce';c.fillRect(0,0,w,h);for(let i=0;i<8000;i++){c.fillStyle=i%3?'rgba(51,61,58,.035)':'rgba(255,255,255,.16)';c.fillRect(i*73%w,(i*131+Math.floor(i/17)*13)%h,1+i%3,1);}c.strokeStyle='rgba(51,61,58,.18)';c.lineWidth=1;c.strokeRect(.5,.5,w-1,h-1);});
 concrete.wrapS=concrete.wrapT=T.RepeatWrapping;concrete.repeat.set(1/6,1/6);materials.floor.map=concrete;materials.tile.map=concrete;materials.paving.map=concrete;
 materials.siteA.map=materials.siteB.map=concrete;
 const panel=texture((c,w,h)=>{c.fillStyle='#dddcd5';c.fillRect(0,0,w,h);c.fillStyle='#8f9793';c.fillRect(0,0,2,h);c.fillRect(0,0,w,2);for(let i=0;i<2000;i++){c.fillStyle='rgba(42,49,45,.035)';c.fillRect(i*47%w,i*101%h,2,1);}});
 panel.wrapS=panel.wrapT=T.RepeatWrapping;panel.repeat.set(.42,.3);materials.wall.map=panel;
 const metalTex=texture((c,w,h)=>{c.fillStyle='#bcc5c5';c.fillRect(0,0,w,h);for(let i=0;i<64;i++){c.strokeStyle=i%2?'#a4afaf':'#e0e6e4';c.beginPath();c.moveTo(i*8,0);c.lineTo(i*8,h);c.stroke();}},256,256);
 metalTex.wrapS=metalTex.wrapT=T.RepeatWrapping;materials.aluminium.map=metalTex;
 const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,12),sphere=new T.SphereGeometry(1,12,8);
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),position=new T.Vector3(),scale=new T.Vector3();
 function meshData(geo,key,matrix=null){
  const g=geo.index?geo.toNonIndexed():geo.clone();if(matrix)g.applyMatrix4(matrix);
  // Keep ground surfaces separate from tall objects using the same material,
  // so architectural collapse cannot also remove the paving or planting floor.
  g.computeBoundingBox();const batchKey=key+(g.boundingBox.max.y<=.35?' / ground':'');
  const bucket=batches.get(batchKey)||{position:[],normal:[],uv:[],material:key};batches.set(batchKey,bucket);
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
 // Outdoor paving is open to the sky. Individual rooms have their own roofs,
 // materials and ceiling heights; there is no global enclosing hall ceiling.
 quad([bounds.minX,0,bounds.minZ],[bounds.minX,0,bounds.maxZ],[bounds.maxX,0,bounds.maxZ],[bounds.maxX,0,bounds.minZ],'paving',[[0,0],[0,140],[110,140],[110,0]]);
 // Non-playable landscaped/service blocks close gaps between the actual rooms.
 const voids=union(TRC_FLOOR,[],true);
 for(const r of voids.rectangles){solid(r,0,3.2,'dado','service-block');part((r.minX+r.maxX)/2,3.21,(r.minZ+r.maxZ)/2,r.maxX-r.minX,.02,r.maxZ-r.minZ,'plant');mapShapes.push({polygon:rectPolygon(r),color:'#56696a',kind:'building'});}
 const envelope=union(TRC_ROOMS);
 for(const e of envelope.edges){
  const [x,z,X,Z]=e,horizontal=Math.abs(z-Z)<.001,lo=horizontal?Math.min(x,X):Math.min(z,Z),hi=horizontal?Math.max(x,X):Math.max(z,Z);
  const at=t=>({x:horizontal?t:x,z:horizontal?z:t});
  const portals=TRC_PORTALS.filter(p=>horizontal?z>=p.minZ&&z<=p.maxZ&&p.maxX>lo&&p.minX<hi:x>=p.minX&&x<=p.maxX&&p.maxZ>lo&&p.minZ<hi);
  const breaks=[...new Set([lo,hi,...portals.flatMap(p=>horizontal?[Math.max(lo,p.minX),Math.min(hi,p.maxX)]:[Math.max(lo,p.minZ),Math.min(hi,p.maxZ)])])].sort((a,b)=>a-b);
  for(let i=0;i<breaks.length-1;i++){
   const a=at(breaks[i]),b=at(breaks[i+1]),m=at((breaks[i]+breaks[i+1])/2),height=Math.max(...TRC_ROOMS.filter(r=>contains(r,m.x,m.z,.02)).map(r=>r.ceiling));
   const r={minX:Math.min(a.x,b.x)-.16,maxX:Math.max(a.x,b.x)+.16,minZ:Math.min(a.z,b.z)-.16,maxZ:Math.max(a.z,b.z)+.16};
   const opening=portals.find(p=>contains(p,m.x,m.z));
   if(opening){if(opening.base>0)solid(r,0,opening.base,'wall','building');if(height>opening.top)solid(r,opening.top,height,'wall','building');}
   else {solid(r,0,height,'wall','building');part(m.x,.55,m.z,r.maxX-r.minX+.015,1.1,r.maxZ-r.minZ+.015,'dado');part(m.x,1.14,m.z,r.maxX-r.minX+.02,.06,r.maxZ-r.minZ+.02,'aluminium');}
  }
 }
 for(const room of TRC_ROOMS){
  const {minX:x,maxX:X,minZ:z,maxZ:Z}=room;
  quad([x,.006,z],[x,.006,Z],[X,.006,Z],[X,.006,z],room.finish,[[x,z],[x,Z],[X,Z],[X,z]]);
  slab([room],[],room.ceiling,room.ceiling+.28,'wall','ceiling-'+room.id);
  // Close the riser above a neighbouring lower roof; it must not leave a
  // floating ceiling or allow sky/shots through the room's upper envelope.
  for(const [horizontal,fixed,lo,hi,out]of [[true,z,x,X,-1],[true,Z,x,X,1],[false,x,z,Z,-1],[false,X,z,Z,1]]){
   const breaks=[...new Set([lo,hi,...TRC_ROOMS.flatMap(r=>horizontal?[r.minX,r.maxX]:[r.minZ,r.maxZ]).filter(t=>t>lo&&t<hi)])].sort((a,b)=>a-b);
   for(let i=0;i<breaks.length-1;i++){
    const t=(breaks[i]+breaks[i+1])/2,px=horizontal?t:fixed+out*.02,pz=horizontal?fixed+out*.02:t;
    const adjacent=TRC_ROOMS.filter(r=>contains(r,px,pz)),other=adjacent.length?Math.max(...adjacent.map(r=>r.ceiling)):Infinity;
    if(other>=room.ceiling)continue;
    const r=horizontal?{minX:breaks[i],maxX:breaks[i+1],minZ:fixed-.16,maxZ:fixed+.16}:{minX:fixed-.16,maxX:fixed+.16,minZ:breaks[i],maxZ:breaks[i+1]};
    solid(r,other,room.ceiling,'wall','roof-riser');
   }
  }
 }
 for(const r of TRC_WALLS){solid(r,r.base,r.height,'wall','partition');mapShapes.push({polygon:rectPolygon(r),color:'#687877',kind:r.base?'overhead':'building'});}
 // Low, visible perimeter walls rather than a roof over the exterior.
 for(const r of [R(0,0,110,.3),R(0,103.7,110,.3),R(0,0,.3,104),R(109.7,0,.3,104)])solid(r,0,3.2,'dado','boundary');
 for(const height of [1.2,3.2]){
  const decks=TRC_DECKS.filter(r=>r.y===height),cuts=[...TRC_STAIRS.filter(r=>r.height===height),...TRC_LADDERS.filter(l=>l.height===height).map(l=>l.hole)];
  const u=slab(decks,cuts,height-.22,height,'steel','deck-'+height);
  for(const r of decks)mapShapes.push({polygon:rectPolygon(r),color:'#a6c7bf',kind:'overhead'});
 }
 // Traversable stair treads share exact geometry with collision and support.
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
  const opening=([x,z,X,Z])=>duct.openings.some(r=>contains(r,(x+X)/2,(z+Z)/2));
  for(const e of u.edges){if(opening(e))continue;const[x,z,X,Z]=e,r={minX:Math.min(x,X)-.065,maxX:Math.max(x,X)+.065,minZ:Math.min(z,Z)-.065,maxZ:Math.max(z,Z)+.065};solid(r,0,duct.height+.13,'aluminium','duct-wall');}
  for(const r of duct.rects){part((r.minX+r.maxX)/2,.004,(r.minZ+r.maxZ)/2,r.maxX-r.minX,.008,r.maxZ-r.minZ,'aluminium');mapShapes.push({polygon:rectPolygon(r),color:'#669b8f',kind:'overhead'});}
 }
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
 for(const [x,z,h]of [[15,22,3.2],[35,22,3.2],[6,26,3.2]]){
  const p=P(x,z),r={minX:p.x-.18,maxX:p.x+.18,minZ:p.z-.18,maxZ:p.z+.18};solid(r,0,h,'steel','column');
 }
 function sign(text,sub,x,y,z,w,h,bg='#223e47',fg='#f0e6d5',ry=0){
  const tex=texture((c,cw,ch)=>{c.fillStyle=bg;c.fillRect(0,0,cw,ch);c.fillStyle=fg;c.textAlign='left';c.textBaseline='middle';c.font='600 74px "Yu Gothic",sans-serif';c.fillText(text,36,sub?ch*.38:ch/2,cw-72);if(sub){c.font='500 27px "Segoe UI",sans-serif';c.fillText(sub,38,ch*.78,cw-76);}c.fillRect(0,0,12,ch);},1024,256);
  const m=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});const o=new T.Mesh(new T.PlaneGeometry(w,h),m);o.position.set(x,y,z);o.rotation.y=ry;world.add(o);return o;
 }
 function banner(text,sub,x,z,key,y=5.25){const p=P(x,z);part(p.x,y+.75,p.z,7,.08,.2,'steel');const front=sign(text,sub,p.x,y,p.z,6.8,1.4,key);front.material.side=T.FrontSide;const back=front.clone();back.rotation.y=Math.PI;back.position.z-=.02;world.add(back);}
 banner('A  展示ホール','INDEPENDENT LABELS / HALL A',27,28,'#92523a',6.5);
 banner('B  試聴ホール','LISTENING / LIVE SESSION',84,26,'#235c68',5.4);
 banner('MID  中央連絡','A HALL ←  /  HALL B →',50,52,'#4c5854',3.1);
 banner('音の集まる場所','INDEPENDENT SOUND MARKET',53,70,'#284753',4.7);
 banner('TRC  SOUND MARKET','同人音楽即売会 / MAIN ENTRANCE',53,77.3,'#284753',5.1);
 // The entrance reads as a recessed glazed facade with a broad canopy.
 const front=P(53.5,77);part(front.x,3.75,front.z+1.4,29.5,.22,3.6,'steel');
 for(const x of [41,44.5,59,62.5,66]){const p=P(x,77.2);part(p.x,1.8,p.z,2.8,3.1,.06,'glass');for(const dx of [-1.45,1.45])part(p.x+dx,1.8,p.z+.05,.06,3.2,.07,'aluminium');}
 for(let x=39.5;x<68;x+=1.5){const p=P(x,77.2);part(p.x,5.15,p.z,.045,2.3,.12,'aluminium');}
 for(const x of [42,47,58,63]){const p=P(x,78);part(p.x,3.62,p.z,3,.035,.2,'light');}
 const fenceSign=P(50,81.34);sign('SOUND MARKET','A HALL ←  /  ENTRANCE ↑  /  LOADING →',fenceSign.x,1.9,fenceSign.z,9,1.2,'#34594f');
 for(const d of TRC_DOORS)sign(d.id+'  '+d.label,'F  OPEN / CLOSE  ·  SHOOT TO BREAK',d.x,d.y+3.25,d.z+.23,d.width,.55,'#283c43','#f1d6a3',d.axis==='z'?Math.PI/2:0);
 for(const l of TRC_LADDERS)sign(l.id+'  ↑','UPSTAIRS / A HEAVEN',l.x+.72,1.7,l.z,1.2,.5,'#aa5f3e','#fff0d9',-Math.PI/2);
 for(const d of TRC_DUCTS)sign(d.id+'  メンテナンス','V: CROUCH  /  SHIFT: SILENT',d.entry.x,1.73,d.entry.z,1.85,.48,'#345451');
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
 for(const [x,z,ry]of [[41,68,Math.PI/2],[41,71,Math.PI/2],[41,74,Math.PI/2],[60,66,0],[64,66,0],[16,28,0],[20,28,0],[24,28,0],[38.5,32,Math.PI/2],[38.5,35,Math.PI/2],[70.5,27,0],[74.5,27,0],[97.5,42,Math.PI/2],[97.5,38,Math.PI/2]])table(x,z,ry);
 // Stage equipment has shaped cones and frames, rather than featureless cubes.
 const speakerCone=new T.LatheGeometry([new T.Vector2(.035,.07),new T.Vector2(.09,.045),new T.Vector2(.24,-.035),new T.Vector2(.28,0),new T.Vector2(.3,.015)],24);
 for(const x of [73,91]){const p=P(x,22.5);rounded(p.x,2.05,p.z,.72,1.7,.62,'dark');physical({minX:p.x-.36,maxX:p.x+.36,minZ:p.z-.31,maxZ:p.z+.31},1.2,2.9,'speaker');
  for(const y of [1.7,2.38]){const m=new T.Matrix4().makeRotationX(Math.PI/2);m.setPosition(p.x,y,p.z+.32);meshData(speakerCone,'steel',m);part(p.x,y,p.z+.39,.07,.07,.07,'dark',0,sphere);}
 }
 speakerCone.dispose();
 const mic=P(84,23.5);part(mic.x,1.22,mic.z,.28,.035,.28,'steel',0,cylinder);part(mic.x,1.9,mic.z,.018,1.35,.018,'aluminium',0,cylinder);part(mic.x,2.59,mic.z,.045,.12,.045,'dark',0,cylinder);
 // Acoustic wall panels, framed posters and consistent skirting carry the detail.
 for(const [x,z,ry,text]of [[13.2,37,Math.PI/2,'音の余白'],[39.8,41,-Math.PI/2,'NEW RELEASES'],[68.2,29,Math.PI/2,'LISTEN HERE'],[98.8,35,-Math.PI/2,'SOUND MARKET']]){const p=P(x,z);sign(text,'ORIGINAL MUSIC / CIRCLE EXHIBITION',p.x,2.7,p.z,2.6,1.9,'#6f8174','#f2e5c7',ry);}
 // Structural ribs terminate at each room, with a distinct light rhythm.
 for(const room of TRC_ROOMS){
  if(['chase','prep-link','a-link','b-link','cross'].includes(room.id))continue;
  const w=room.maxX-room.minX,d=room.maxZ-room.minZ,y=room.ceiling;
  for(let z=room.minZ+2;z<room.maxZ-1;z+=6){part((room.minX+room.maxX)/2,y-.28,z,w,.35,.18,'steel');
   for(let x=room.minX+3;x<room.maxX-1;x+=8){part(x,y-.5,z,2.7,.12,.48,'steel');part(x,y-.57,z,2.5,.025,.36,room.id==='b'?'warmLight':'light');}}
 }
 world.add(new T.AmbientLight('#dce9e7',.9));
 for(const [x,z,y,color]of [[27,34,6,'#ffdbaf'],[84,35,5.5,'#c3e3ec'],[53,70,4.7,'#f5dfb9'],[50,53,3.4,'#d5e9e4']]){const p=P(x,z),light=new T.PointLight(color,80,32,2);light.position.set(p.x,y,p.z);world.add(light);}
 const siteSpec=TRC_SITES;
 for(const spec of siteSpec){const r=R(...spec.r),{minX:x,maxX:X,minZ:z,maxZ:Z}=r;quad([x,.012,z],[x,.012,Z],[X,.012,Z],[X,.012,z],spec.id==='A'?'siteA':'siteB',[[x,z],[x,Z],[X,Z],[X,z]]);}
 const sites=siteSpec.map(s=>{const r=R(...s.r),p=P(...s.center);for(const [x,z,X,Z]of union([r]).edges){const dx=X-x,dz=Z-z;part((x+X)/2,.009,(z+Z)/2,Math.max(.08,Math.abs(dx)),.018,Math.max(.08,Math.abs(dz)),s.id==='A'?'orange':'blue');}return {id:s.id,name:s.name,...p,radius:Math.min(s.r[2],s.r[3])/2,polygon:rectPolygon(r),plantPositions:s.points.map(([x,z],i)=>({id:s.id+'-'+['open','cover','deep','entry'][i],style:['open','cover','deep','entry'][i],...P(x,z)}))};});
 for(const s of sites)sign(s.id,'PLANT ZONE',s.x,.025,s.z,3,3,s.id==='A'?'#a65d40':'#286b77').rotation.x=-Math.PI/2;
 for(const [key,b]of batches){const g=new T.BufferGeometry();for(const name of ['position','normal','uv'])g.setAttribute(name,new T.Float32BufferAttribute(b[name],name==='uv'?2:3));g.computeBoundingSphere();const m=new T.Mesh(g,materials[b.material]);m.name='TRC / '+key;m.castShadow=true;m.receiveShadow=true;world.add(m);}
 const teamSpawns={attack:[P(52,91),P(49,91),P(55,91),P(46,91),P(58,91)],defend:[P(52,9),P(49,9),P(55,9),P(46,9),P(58,9)]};
 const callouts=[...TRC_ROOMS.filter(r=>!['chase','prep-link','prep'].includes(r.id)),...TRC_OUTDOORS].map(r=>({id:r.id,name:r.name,polygon:rectPolygon(r),maxY:2.7,label:{x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2,text:r.name.split(' ')[0]}}));
 for(const d of TRC_DECKS)callouts.unshift({id:d.id,name:({'a-heaven':'A ヘブン','a-prep':'上階準備室','a-prep-link':'準備室連絡','b-stage':'B 試聴ステージ'})[d.id],polygon:rectPolygon(d),minY:d.y-.2,maxY:8});
 const landmarks=[{id:'a',name:'A 展示ホール',...P(27,43),yaw:0},{id:'b',name:'B 試聴ホール',...P(84,43),yaw:0},{id:'mid',name:'MID 中央連絡',...P(50,53),yaw:0},{id:'heaven',name:'A ヘブン',...P(25,24,3.2),yaw:Math.PI},{id:'prep',name:'上階準備室',...P(7,28,3.2),yaw:Math.PI},{id:'duct-a',name:'ダクト入口',...P(5.2,49),yaw:0},{id:'stage',name:'B 試聴ステージ',...P(84,24,1.2),yaw:Math.PI},{id:'plaza',name:'屋外前庭',...P(52,89),yaw:0},{id:'yard',name:'搬入ヤード',...P(90,74),yaw:0}];
 const map={id:'trc',name:'TRC 同人音楽即売会',shortName:'SOUND MARKET',indoor:false,world,bounds,combatBounds:bounds,colliders,collision:createCollisionIndex(colliders,8),mapShapes,ramps:[...TRC_STAIRS],sites,teamSpawns,callouts,zones:[],landmarks,
  spawn:{...teamSpawns.attack[0],yaw:0},enemySpawns:teamSpawns.defend,spawnYaw:{attack:0,defend:Math.PI},buyAreas:{attack:{...P(52,91),radius:8},defend:{...P(52,9),radius:7}},
  lanes:[{id:'long',name:'A ロング',points:[[52,91],[28,91],[28,81],[13,81],[13,68],[21,68],[21,59],[27,59],[27,43]].map(p=>P(...p))},{id:'mid',name:'正面入口 / MID',points:[[52,91],[40,91],[40,79],[52,79],[52,70],[61,70],[61,60],[50,60],[50,44]].map(p=>P(...p))},{id:'b-main',name:'搬入 / B メイン',points:[[52,91],[87,91],[87,79],[94,79],[94,70],[84,70],[84,59],[96,59],[96,48],[89,48],[89,43]].map(p=>P(...p))}],
  menuCamera:{position:[-7,2.4,43],target:[-2,3,28]},rangeArea:{spawn:{...P(52,91),yaw:0},targets:[P(38,87),P(64,87),P(69,89),P(36,89)]},
  stats:{mode:'arena',width:110,depth:140,area:15400,sites:2,routes:3,buildings:1,collisionShapes:colliders.length,renderBatches:batches.size},
  ductAt(x,z,y){return !world.userData.bomberCollapsed&&trcDuctAt(x,z,y);},walkHeights(x,z){
   if(world.userData.bomberCollapsed)return [0];
   const out=[];if(TRC_FLOOR.some(r=>contains(r,x,z)))out.push(0);
   if(TRC_STAIRS.some(r=>contains(r,x,z,.4))){let h=0;for(const c of map.collision.query(x,z,.4))if(c.kind==='stairs'&&map.collision.overlaps(c,x,z,.4))h=Math.max(h,c.height);out.push(h);}
   for(const d of TRC_DECKS)if(contains(d,x,z)&&!trcDeckCut(x,z,d.y))out.push(d.y);
   return [...new Set(out)];
  }
 };
 map.traversal=createTrcTraversal(map,{doorMeshes});world.updateMatrixWorld(true);return map;
}
