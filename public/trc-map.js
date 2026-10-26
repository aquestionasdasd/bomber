import {createCollisionIndex} from './collision.js';
import {createTrcTraversal} from './trc-traversal.js';
import {createTrcSurfaces} from './trc-surfaces.js';
import {TRC_BOUNDS,TRC_ROOMS,TRC_GROUND_ROOMS,TRC_UPPER_ROOMS,TRC_BASEMENT_ROOMS,TRC_DROPS,TRC_OUTDOORS,TRC_PORTALS,TRC_WALLS,TRC_SITES,TRC_FLOOR,TRC_DECKS,TRC_STAIRS,TRC_LADDERS,TRC_DUCTS,TRC_DOORS,TRC_COVERS,TRC_SCREENS,trcPoint as P,trcRect as R,contains,rectPolygon,stairHeight,trcDeckCut,trcDuctAt} from './trc-layout.js';

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
 const surfaces=createTrcSurfaces(rawQuad);
 function part(x,y,z,w,h,d,key,ry=0,geo=box,rz=0){
  if(geo===box&&ry===0&&rz===0){const a=x-w/2,b=x+w/2,c=y-h/2,e=y+h/2,f=z-d/2,g=z+d/2;
   quad([a,c,f],[a,c,g],[a,e,g],[a,e,f],key);quad([b,c,g],[b,c,f],[b,e,f],[b,e,g],key);
   quad([a,e,f],[a,e,g],[b,e,g],[b,e,f],key);quad([a,c,g],[a,c,f],[b,c,f],[b,c,g],key);
   quad([b,c,f],[a,c,f],[a,e,f],[b,e,f],key);quad([a,c,g],[b,c,g],[b,e,g],[a,e,g],key);return;
  }
  matrix.compose(position.set(x,y,z),rotation.setFromEuler(new T.Euler(0,ry,rz)),scale.set(w,h,d));meshData(geo,key,matrix);
 }
 function quad(a,b,c,d,key,uv=null){surfaces.add(a,b,c,d,key,uv);}
 function rawQuad(a,b,c,d,key,uv=null){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3));const u=uv||[[0,0],[Math.hypot(a[0]-b[0],a[2]-b[2]),0],[Math.hypot(a[0]-b[0],a[2]-b[2]),Math.hypot(b[1]-c[1],b[2]-c[2])],[0,Math.hypot(b[1]-c[1],b[2]-c[2])]];g.setAttribute('uv',new T.Float32BufferAttribute([...u[0],...u[1],...u[2],...u[0],...u[2],...u[3]],2));g.computeVertexNormals();meshData(g,key);g.dispose();}
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
 // A continuous ground slab has real openings for the basement stairs.
 const basementStairs=TRC_STAIRS.filter(r=>r.base<0),hatches=TRC_LADDERS.map(l=>l.hole);
 slab([bounds],basementStairs,-.24,0,'paving','ground');
 slab(TRC_BASEMENT_ROOMS,[],-3.44,-3.2,'rubber','basement-floor');
 const voids=union(TRC_FLOOR,[],true);
 for(const r of voids.rectangles){solid(r,0,3.2,'dado','service-block');part((r.minX+r.maxX)/2,3.19,(r.minZ+r.maxZ)/2,r.maxX-r.minX,.02,r.maxZ-r.minZ,'plant');mapShapes.push({polygon:rectPolygon(r),color:'#56696a',kind:'building'});}
 // Every height band uses the union of real room air volumes. Shared wall ends
 // overlap by 16 cm, including corners, lintels, roof changes and floor joints.
 const structuralSeams=[];
 function shell(rects,lo,hi,portals=TRC_PORTALS,interior=false){
  if(!rects.length||hi-lo<.001)return;
  for(const e of union(rects).edges){
   const [x,z,X,Z]=e,horizontal=Math.abs(z-Z)<.001,a0=horizontal?Math.min(x,X):Math.min(z,Z),a1=horizontal?Math.max(x,X):Math.max(z,Z);
   const at=t=>({x:horizontal?t:x,z:horizontal?z:t});
   const holes=portals.filter(p=>p.base<=lo+.001&&p.top>=hi-.001&&(horizontal?z>=p.minZ&&z<=p.maxZ&&p.maxX>a0&&p.minX<a1:x>=p.minX&&x<=p.maxX&&p.maxZ>a0&&p.minZ<a1));
   const breaks=[...new Set([a0,a1,...holes.flatMap(p=>horizontal?[Math.max(a0,p.minX),Math.min(a1,p.maxX)]:[Math.max(a0,p.minZ),Math.min(a1,p.maxZ)])])].sort((a,b)=>a-b);
   for(let i=0;i<breaks.length-1;i++){
    const a=at(breaks[i]),b=at(breaks[i+1]),m=at((breaks[i]+breaks[i+1])/2);
    if(holes.some(p=>contains(p,m.x,m.z)))continue;
    // Interior upper walls close the heaven and gallery inside the tall halls.
    if(interior&&!TRC_GROUND_ROOMS.some(r=>r.ceiling>lo&&contains(r,m.x,m.z,.18)))continue;
    const r={minX:Math.min(a.x,b.x)-.16,maxX:Math.max(a.x,b.x)+.16,minZ:Math.min(a.z,b.z)-.16,maxZ:Math.max(a.z,b.z)+.16};
    solid(r,lo,hi,lo<0?'steel':'wall',interior?'upper-wall':'building');
    structuralSeams.push({a,b,base:lo,height:hi,axis:horizontal?'x':'z'});
    if(lo===0){part(m.x,.55,m.z,r.maxX-r.minX,1.1,r.maxZ-r.minZ,'dado');part(m.x,1.14,m.z,r.maxX-r.minX,.06,r.maxZ-r.minZ,'aluminium');}
   }
  }
 }
 const levels=[...new Set([...TRC_ROOMS.flatMap(r=>[r.base,r.ceiling]),...TRC_PORTALS.flatMap(p=>[p.base,p.top])])].sort((a,b)=>a-b);
 for(let i=0;i<levels.length-1;i++){const lo=levels[i],hi=levels[i+1],mid=(lo+hi)/2;shell(TRC_ROOMS.filter(r=>r.base<mid&&r.ceiling>mid),lo,hi);if(lo>=3.2&&hi<=6.8)shell(TRC_UPPER_ROOMS,lo,hi,TRC_PORTALS,true);}
 // Lower ceilings stop at rooms which continue upwards. Roofs of enclosed
 // upper rooms are explicit even where a tall exhibition hall surrounds them.
 for(const top of [...new Set(TRC_ROOMS.map(r=>r.ceiling))]){
  const roof=TRC_ROOMS.filter(r=>r.ceiling===top),above=TRC_ROOMS.filter(r=>r.base<=top&&r.ceiling>top);
  slab(roof,[...above,...(top===1.36?hatches:[])],top,top+.24,top<0?'steel':'wall','ceiling-'+top);
 }
 slab(TRC_UPPER_ROOMS,[],6.8,7.04,'wall','upper-ceiling');
 for(const room of TRC_GROUND_ROOMS){
  for(const r of union([room],basementStairs).cells){const {minX:x,maxX:X,minZ:z,maxZ:Z}=r;quad([x,0,z],[x,0,Z],[X,0,Z],[X,0,z],room.finish,[[x,z],[x,Z],[X,Z],[X,z]]);}
 }
 for(const r of TRC_WALLS){solid(r,r.base,r.height,'wall','partition');mapShapes.push({polygon:rectPolygon(r),color:'#687877',kind:r.base?'overhead':'building'});}
 for(const r of [R(0,0,110,.3),R(0,139.7,110,.3),R(0,0,.3,140),R(109.7,0,.3,140)])solid(r,0,3.2,'dado','boundary');
 for(const height of [1.2,3.2]){
  const decks=TRC_DECKS.filter(r=>r.y===height),cuts=[...TRC_STAIRS.filter(r=>Math.abs(r.base+r.height-height)<.01),...TRC_LADDERS.filter(l=>l.height===height).map(l=>l.hole)];
  slab(decks,cuts,height-.24,height,'steel','deck-'+height);
  for(const r of decks)mapShapes.push({polygon:rectPolygon(r),color:'#a6c7bf',kind:'overhead'});
 }
 for(const r of TRC_STAIRS){
  const count=r.steps,w=r.maxX-r.minX,d=r.maxZ-r.minZ;
  for(let i=0;i<count;i++){
   const rect=r.axis==='x'?{minX:r.minX+w*i/count,maxX:r.minX+w*(i+1)/count,minZ:r.minZ,maxZ:r.maxZ}:{minX:r.minX,maxX:r.maxX,minZ:r.minZ+d*i/count,maxZ:r.minZ+d*(i+1)/count};
   const h=r.base+r.height*(r.direction<0?count-i:i+1)/count;
   solid(rect,r.base-.24,h,'steel','stairs');
   const z=rect.minZ,Z=Math.min(rect.maxZ,z+.06);quad([rect.minX,h,z],[rect.minX,h,Z],[rect.maxX,h,Z],[rect.maxX,h,z],'aluminium');
  }
  mapShapes.push({polygon:rectPolygon(r),color:'#8a9c9c',kind:'stairs'});
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
  const x=(r.minX+r.maxX)/2,z=(r.minZ+r.maxZ)/2,w=r.maxX-r.minX,d=r.maxZ-r.minZ,base=r.base||0,h=r.height-base,key=x<0?'cream':'blue';
  const coverPart=(x,y,z,...args)=>part(x,y+base,z,...args),coverQuad=(a,b,c,d,...args)=>quad([a[0],a[1]+base,a[2]],[b[0],b[1]+base,b[2]],[c[0],c[1]+base,c[2]],[d[0],d[1]+base,d[2]],...args);
  solid(r,base,base+h,r.type==='rack'?'dark':key,'cover');mapShapes.push({polygon:rectPolygon(r),color:'#7c8c8d',kind:'cover'});
  if(r.type==='container'){
   // Folded sheet profile. Recesses lie within the physical outer envelope.
   for(const side of [-1,1]){
    const n=Math.ceil((w-.2)/.3)*4;
    for(let i=0;i<n;i++){const a=x-w/2+.1+(w-.2)*i/n,b=x-w/2+.1+(w-.2)*(i+1)/n,za=z+side*(d/2+([0,1,1,0][i%4]?.012:.065)),zb=z+side*(d/2+([0,1,1,0][(i+1)%4]?.012:.065));
      if(side>0)coverQuad([a,.16,za],[b,.16,zb],[b,h-.16,zb],[a,h-.16,za],key);
      else coverQuad([b,.16,zb],[a,.16,za],[a,h-.16,za],[b,h-.16,zb],key);
    }
    coverPart(x,h-.09,z+side*(d/2-.04),w-.1,.13,.08,'steel');coverPart(x,.1,z+side*(d/2-.04),w-.1,.13,.08,'steel');
   }
   for(const side of [-1,1])for(const dz of [-d/2+.06,d/2-.06])coverPart(x+side*(w/2-.07),h/2,z+dz,.12,h,.12,'steel');
   for(const dx of [-w*.23,w*.23]){coverPart(x+dx,h/2,z+d/2+.012,.04,h-.3,.04,'aluminium',0,cylinder);coverPart(x+dx,.95,z+d/2+.04,.22,.05,.035,'steel');}
  }else{
   for(const y of [.08,h-.08])for(const side of [-1,1]){coverPart(x,y,z+side*(d/2-.025),w,.065,.045,'aluminium');coverPart(x+side*(w/2-.025),y,z,.045,.065,d,'aluminium');}
   for(const dx of [-w/2+.05,w/2-.05])for(const dz of [-d/2+.05,d/2-.05])coverPart(x+dx,h/2,z+dz,.065,h,.065,'aluminium');
   for(const side of [-1,1]){coverPart(x,h*.53,z+side*d/2,.35,.13,.03,'dark');coverPart(x,h*.53+.04,z+side*(d/2+.01),.24,.025,.025,'aluminium');}
   if(r.type==='rack')for(let y=.3;y<h-.2;y+=.28){coverPart(x,y,z+d/2+.012,w-.2,.21,.024,'steel');for(let j=0;j<9;j++)coverPart(x-w*.38+j*w*.085,y,z+d/2+.028,.045,.045,.03,j%3?'aluminium':'light',0,sphere);}
  }
 }
 for(const [i,r]of TRC_SCREENS.entries()){
  const h=i>7?2.7:2.25;solid(r,0,h,i%2?'blue':'cream','partition');
  part((r.minX+r.maxX)/2,h+.025,(r.minZ+r.maxZ)/2,r.maxX-r.minX+.03,.05,r.maxZ-r.minZ+.03,'aluminium');
 }
 // Structural columns support the galleries; open space beneath is usable Hell.
 for(const [x,z,h]of [[11,41,3.2],[11,50,3.2]]){
  const p=P(x,z),r={minX:p.x-.18,maxX:p.x+.18,minZ:p.z-.18,maxZ:p.z+.18};solid(r,0,h,'steel','column');
 }
 function sign(text,sub,x,y,z,w,h,bg='#223e47',fg='#f0e6d5',ry=0){
  const tex=texture((c,cw,ch)=>{c.fillStyle=bg;c.fillRect(0,0,cw,ch);c.fillStyle=fg;c.textAlign='left';c.textBaseline='middle';c.font='600 74px "Yu Gothic",sans-serif';c.fillText(text,36,sub?ch*.38:ch/2,cw-72);if(sub){c.font='500 27px "Segoe UI",sans-serif';c.fillText(sub,38,ch*.78,cw-76);}c.fillRect(0,0,12,ch);},1024,256);
  const m=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});const o=new T.Mesh(new T.PlaneGeometry(w,h),m);o.position.set(x,y,z);o.rotation.y=ry;world.add(o);return o;
 }
 function banner(text,sub,x,z,key,y=5.25){const p=P(x,z);part(p.x,y+.75,p.z,7,.08,.2,'steel');const front=sign(text,sub,p.x,y,p.z,6.8,1.4,key);front.material.side=T.FrontSide;const back=front.clone();back.rotation.y=Math.PI;back.position.z-=.02;world.add(back);}
 banner('A  展示ホール','INDEPENDENT LABELS / HALL A',26,34,'#92523a',6.5);
 banner('B  試聴ホール','LISTENING / LIVE SESSION',88,36,'#235c68',5.4);
 banner('MID  中央連絡','A HALL ←  /  HALL B →',54,79,'#4c5854',3.1);
 banner('音の集まる場所','INDEPENDENT SOUND MARKET',55,103,'#284753',4.7);
 banner('TRC  SOUND MARKET','同人音楽即売会 / MAIN ENTRANCE',55,112.3,'#284753',5.1);
 // The entrance reads as a recessed glazed facade with a broad canopy.
 const front=P(55.5,112);part(front.x,3.75,front.z+1.4,25.5,.22,3.6,'steel');
 for(const x of [45,48,64,66]){const p=P(x,112.2);part(p.x,1.8,p.z,2.8,3.1,.06,'glass');for(const dx of [-1.45,1.45])part(p.x+dx,1.8,p.z+.05,.06,3.2,.07,'aluminium');}
 for(let x=43.5;x<68;x+=1.5){const p=P(x,112.2);part(p.x,5.15,p.z,.045,2.3,.12,'aluminium');}
 for(const x of [46,50,60,65]){const p=P(x,113);part(p.x,3.62,p.z,3,.035,.2,'light');}
 const fenceSign=P(49,119.04);sign('SOUND MARKET','A HALL ←  /  ENTRANCE ↑  /  LOADING →',fenceSign.x,1.9,fenceSign.z,9,1.2,'#34594f');
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
 for(const [x,z,ry]of [[44.4,100,Math.PI/2],[44.4,104,Math.PI/2],[44.4,108,Math.PI/2],[64,94,0],[9.3,34,Math.PI/2],[27,31,0],[31,31,0],[39.5,36,Math.PI/2],[39.5,40,Math.PI/2],[73,34,Math.PI/2],[102.5,44,Math.PI/2],[102.5,47,Math.PI/2]])table(x,z,ry);
 // Stage equipment has shaped cones and frames, rather than featureless cubes.
 const speakerCone=new T.LatheGeometry([new T.Vector2(.035,.07),new T.Vector2(.09,.045),new T.Vector2(.24,-.035),new T.Vector2(.28,0),new T.Vector2(.3,.015)],24);
 for(const x of [86,99]){const p=P(x,33.5);rounded(p.x,2.05,p.z,.72,1.7,.62,'dark');physical({minX:p.x-.36,maxX:p.x+.36,minZ:p.z-.31,maxZ:p.z+.31},1.2,2.9,'speaker');
  for(const y of [1.7,2.38]){const m=new T.Matrix4().makeRotationX(Math.PI/2);m.setPosition(p.x,y,p.z+.32);meshData(speakerCone,'steel',m);part(p.x,y,p.z+.39,.07,.07,.07,'dark',0,sphere);}
 }
 speakerCone.dispose();
 const mic=P(94,33.8);part(mic.x,1.22,mic.z,.28,.035,.28,'steel',0,cylinder);part(mic.x,1.9,mic.z,.018,1.35,.018,'aluminium',0,cylinder);part(mic.x,2.59,mic.z,.045,.12,.045,'dark',0,cylinder);
 // Acoustic wall panels, framed posters and consistent skirting carry the detail.
 for(const [x,z,ry,text]of [[8.2,37,Math.PI/2,'音の余白'],[40.8,42,-Math.PI/2,'NEW RELEASES'],[71.2,38,Math.PI/2,'LISTEN HERE'],[103.8,42,-Math.PI/2,'SOUND MARKET']]){const p=P(x,z);sign(text,'ORIGINAL MUSIC / CIRCLE EXHIBITION',p.x,2.7,p.z,2.6,1.9,'#6f8174','#f2e5c7',ry);}
 // Structural ribs terminate at each room, with a distinct light rhythm.
 for(const room of TRC_ROOMS){
  if(room.id==='duct'||room.id==='shaft'||room.ceiling<0)continue;
  const w=room.maxX-room.minX,d=room.maxZ-room.minZ,y=room.ceiling;
  for(let z=room.minZ+2;z<room.maxZ-1;z+=6){part((room.minX+room.maxX)/2,y-.28,z,w,.35,.18,'steel');
   for(let x=room.minX+3;x<room.maxX-1;x+=8){part(x,y-.5,z,2.7,.12,.48,'steel');part(x,y-.57,z,2.5,.025,.36,room.id==='b'?'warmLight':'light');}}
 }
 world.add(new T.AmbientLight('#dce9e7',.9));
 for(const [x,z,y,color]of [[26,43,6,'#ffdbaf'],[88,46,5.5,'#c3e3ec'],[55,104,4.7,'#f5dfb9'],[54,81,4,'#d5e9e4'],[56,55,5.8,'#d5e9e4'],[94,60,-.8,'#c3e3ec'],[84,38,-.8,'#f5dfb9']]){const p=P(x,z),light=new T.PointLight(color,80,32,2);light.position.set(p.x,y,p.z);world.add(light);}
 const siteSpec=TRC_SITES;
 for(const spec of siteSpec){const r=R(...spec.r),{minX:x,maxX:X,minZ:z,maxZ:Z}=r;quad([x,0,z],[x,0,Z],[X,0,Z],[X,0,z],spec.id==='A'?'siteA':'siteB',[[x,z],[x,Z],[X,Z],[X,z]]);}
 const sites=siteSpec.map(s=>{const r=R(...s.r),p=P(...s.center);for(const [x,z,X,Z]of union([r]).edges){const dx=X-x,dz=Z-z;const u=(x+X)/2,v=(z+Z)/2,w=Math.max(.08,Math.abs(dx))/2,d=Math.max(.08,Math.abs(dz))/2;quad([u-w,0,v-d],[u-w,0,v+d],[u+w,0,v+d],[u+w,0,v-d],s.id==='A'?'orange':'blue');}return {id:s.id,name:s.name,...p,radius:Math.min(s.r[2],s.r[3])/2,polygon:rectPolygon(r),plantPositions:s.points.map(([x,z],i)=>({id:s.id+'-'+['open','cover','deep','entry'][i],style:['open','cover','deep','entry'][i],...P(x,z)}))};});
 for(const s of sites)sign(s.id,'PLANT ZONE',s.x,.025,s.z,3,3,s.id==='A'?'#a65d40':'#286b77').rotation.x=-Math.PI/2;
 const surfaceAudit=surfaces.flush();
 for(const [key,b]of batches){const g=new T.BufferGeometry();for(const name of ['position','normal','uv'])g.setAttribute(name,new T.Float32BufferAttribute(b[name],name==='uv'?2:3));g.computeBoundingSphere();const m=new T.Mesh(g,materials[b.material]);m.name='TRC / '+key;m.castShadow=true;m.receiveShadow=true;world.add(m);}
 const teamSpawns={attack:[P(55,129),P(52,129),P(58,129),P(49,129),P(61,129)],defend:[P(55,8),P(52,8),P(58,8),P(49,8),P(61,8)]};
 const callouts=[...TRC_GROUND_ROOMS.filter(r=>!['shaft','duct'].includes(r.id)),...TRC_OUTDOORS].map(r=>({id:r.id,name:r.name,polygon:rectPolygon(r),minY:-.1,maxY:2.7,label:{x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2,text:r.name.split(' ')[0]}}));
 for(const d of TRC_DECKS)callouts.unshift({id:d.id,name:d.name,polygon:rectPolygon(d),minY:d.y-.2,maxY:d.y+2.9});
 for(const r of TRC_BASEMENT_ROOMS)callouts.unshift({id:r.id,name:r.name,polygon:rectPolygon(r),minY:-3.5,maxY:-.1});
 const landmarks=[
  {id:'a',name:'A 展示ホール',...P(26,52),yaw:0},{id:'b',name:'B ライブホール',...P(88,53),yaw:0},
  {id:'mid',name:'下MID',...P(54,81),yaw:0},{id:'upper-mid',name:'上MID',...P(56,55,3.2),yaw:Math.PI},
  {id:'heaven',name:'A 側面ヘブン',...P(14,45,3.2),yaw:-Math.PI/2},{id:'prep',name:'A 制御室',...P(9,54,3.2),yaw:Math.PI},
  {id:'duct-a',name:'A ダクト入口',...P(9,66),yaw:0},{id:'stage',name:'B 試聴ステージ',...P(88,34,1.2),yaw:Math.PI},
  {id:'basement',name:'B 地下搬入路',...P(94,63,-3.2),yaw:0},{id:'backstage',name:'B 舞台裏',...P(84,28),yaw:Math.PI},
  {id:'plaza',name:'屋外前庭',...P(55,127),yaw:0},{id:'yard',name:'搬入ヤード',...P(90,94),yaw:0},
  {id:'foyer',name:'A 前室',...P(21,82),yaw:0},{id:'ct-mid',name:'CT 前室',...P(52,28),yaw:Math.PI}
 ];
 const collapseFloors=basementStairs.map(r=>{const g=new T.PlaneGeometry(r.maxX-r.minX,r.maxZ-r.minZ),m=new T.Mesh(g,materials.paving);m.rotation.x=-Math.PI/2;m.position.set((r.minX+r.maxX)/2,0,(r.minZ+r.maxZ)/2);m.visible=false;m.name='TRC / collapse ground infill';world.add(m);return m;});
 const map={id:'trc',name:'TRC 同人音楽即売会',shortName:'SOUND MARKET',indoor:false,world,bounds,combatBounds:bounds,colliders,collision:createCollisionIndex(colliders,8),mapShapes,ramps:[...TRC_STAIRS],sites,teamSpawns,callouts,zones:[],landmarks,minY:-3.2,drops:TRC_DROPS,structuralSeams,surfaceAudit,
  spawn:{...teamSpawns.attack[0],yaw:0},enemySpawns:teamSpawns.defend,spawnYaw:{attack:0,defend:Math.PI},buyAreas:{attack:{...P(55,129),radius:8},defend:{...P(55,8),radius:7}},
  lanes:[{id:'long',name:'A ロング',points:[[55,129],[31,125],[14,115],[14,94],[16,89],[21,82],[23,68],[26,54],[26,43]].map(p=>P(...p))},{id:'mid',name:'正面入口 / MID',points:[[55,129],[63,122],[63,115],[55,110],[57,101],[55,91],[54,81]].map(p=>P(...p))},{id:'b-main',name:'搬入 / B メイン',points:[[55,129],[77,123],[91,111],[90,107],[91,96],[91,75],[91,69],[83,67],[83,59],[88,46]].map(p=>P(...p))}],
  menuCamera:{position:[8,2.4,52],target:[0,3,40]},rangeArea:{spawn:{...P(55,129),yaw:0},targets:[P(35,124),P(65,124),P(71,126),P(33,126)]},
  stats:{mode:'arena',width:110,depth:140,area:15400,sites:2,routes:3,buildings:1,collisionShapes:colliders.length,renderBatches:batches.size},
  syncCollapseFloors(){for(const m of collapseFloors)m.visible=!!world.userData.bomberCollapsed;},
  floorBaseAt(x,z){return !world.userData.bomberCollapsed&&TRC_BASEMENT_ROOMS.some(r=>contains(r,x,z))?-3.2:0;},
  ductAt(x,z,y){return !world.userData.bomberCollapsed&&trcDuctAt(x,z,y);},walkHeights(x,z){
   if(world.userData.bomberCollapsed)return [0];
   const out=[];if(TRC_FLOOR.some(r=>contains(r,x,z))&&!basementStairs.some(r=>contains(r,x,z)))out.push(0);
   if(TRC_BASEMENT_ROOMS.some(r=>contains(r,x,z)))out.push(-3.2);
   if(TRC_STAIRS.some(r=>contains(r,x,z,.4))){let h=-Infinity;for(const c of map.collision.query(x,z,.4))if(c.kind==='stairs'&&map.collision.overlaps(c,x,z,.4))h=Math.max(h,c.height);if(Number.isFinite(h))out.push(h);}
   for(const d of TRC_DECKS)if(contains(d,x,z)&&!trcDeckCut(x,z,d.y))out.push(d.y);
   return [...new Set(out)];
  }
 };
 map.traversal=createTrcTraversal(map,{doorMeshes});world.updateMatrixWorld(true);return map;
}
