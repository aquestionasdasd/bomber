import {createCollisionIndex,rampHeight} from './collision.js';
import {WOMB_PLAN,WOMB_CORES,WOMB_LEVELS,WOMB_STOREY,WOMB_STAIRS,WOMB_BOUNDS,wombPoint as P,wombRect as R,wombPolygon as polygon,wombRegion,contains,wombFloorIndex} from './womb-layout.js';

// Independent four-storey club. All dimensions are the approved game proposal,
// not an architectural survey of the real venue. The same solids drive the
// renderer, bullets, walking and the floor-specific tactical plan.
export function createWombMap(T,scene){
 const world=new T.Group();world.name='WOMB / four-floor club';scene.add(world);
 const colliders=[],mapShapes=[],batches=new Map(),materials={},surfaces=[],textures=[];
 const palette={wall:'#96949a',dado:'#343946',floor:'#737781',ceiling:'#242a34',metal:'#202a39',trim:'#bac2cf',wood:'#745e53',seat:'#4f4260',A:'#cd8d58',B:'#4dabb7',purple:'#9a78c7',light:'#dbe7fa'};
 for(const [key,color]of Object.entries(palette))materials[key]=new T.MeshStandardMaterial({color,roughness:key==='metal'?.46:.82,metalness:key==='metal'?.45:0,vertexColors:true});
 for(const key of ['A','B','purple','light']){materials[key].emissive=new T.Color(palette[key]);materials[key].emissiveIntensity=key==='light'?1.4:.35;}
 const paint=new T.MeshBasicMaterial({color:'#e1be8a',transparent:true,opacity:.72,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const addVertex=(bucket,p,n,color)=>{bucket.position.push(...p);bucket.normal.push(...n);bucket.color.push(color,color,color);};
 function quad(a,b,c,d,key,shade=1){
  const batchKey=key+(Math.max(a[1],b[1],c[1],d[1])<=.01?' / ground':'');
  const bucket=batches.get(batchKey)||{position:[],normal:[],color:[],material:key};batches.set(batchKey,bucket);
  const normal=new T.Vector3().subVectors(new T.Vector3(...b),new T.Vector3(...a)).cross(new T.Vector3().subVectors(new T.Vector3(...c),new T.Vector3(...a))).normalize();
  const n=normal.toArray(),axis=.86+Math.max(0,n[1])*.14-Math.abs(n[0])*.08;
  for(const p of [a,b,c,a,c,d]){const local=((p[1]%WOMB_STOREY)+WOMB_STOREY)%WOMB_STOREY;
   const contact=key==='wall'||key==='dado'?.68+.32*Math.min(1,local/.8):1;
   addVertex(bucket,p,n,shade*axis*contact);
  }
 }
 function faces(r,lo,hi,key,{sides=true}={}){const{minX:x,maxX:X,minZ:z,maxZ:Z}=r;
  quad([x,hi,z],[x,hi,Z],[X,hi,Z],[X,hi,z],key);
  quad([x,lo,Z],[x,lo,z],[X,lo,z],[X,lo,Z],key);
  if(sides){quad([x,lo,z],[x,lo,Z],[x,hi,Z],[x,hi,z],key);
  quad([X,lo,Z],[X,lo,z],[X,hi,z],[X,hi,Z],key);}
  quad([X,lo,z],[x,lo,z],[x,hi,z],[X,hi,z],key);
  quad([x,lo,Z],[X,lo,Z],[X,hi,Z],[x,hi,Z],key);
 }
 function physical(r,base,height,kind,extra={}){const c={...r,base,height,kind,...extra};colliders.push(c);return c;}
 function solid(r,base,height,key,kind='cover',extra={}){faces(r,base,height,key);return physical(r,base,height,kind,extra);}
 function slab(rects,cuts,top,id){
  const region=wombRegion(rects,cuts);
  for(const r of region.rectangles){const{minX:x,maxX:X,minZ:z,maxZ:Z}=r;
   quad([x,top,z],[x,top,Z],[X,top,Z],[X,top,z],'floor');
   quad([x,top-.24,Z],[x,top-.24,z],[X,top-.24,z],[X,top-.24,Z],'floor');
   physical(r,top-.24,top,'surface',{surfaceId:id});
  }
  // Never draw the internal edges of partitioned slabs, or skirts already
  // covered by the lower storey's wall (notably around the tall atrium).
  for(const [x,z,X,Z]of region.edges){const mx=(x+X)/2,mz=(z+Z)/2;
   if(colliders.some(c=>c.kind==='building'&&c.base<=top-.24+1e-6&&c.height>=top-1e-6&&contains(c,mx,mz)))continue;
   quad([x,top-.24,z],[X,top-.24,Z],[X,top,Z],[x,top,z],'floor');
  }
  return region.rectangles;
 }
 const shaftHoles=WOMB_CORES.map(([x,z,w])=>R([x,z,w,5]));
 const atrium=R([10,14,14,15]);
 for(let f=0;f<4;f++){
  const d=WOMB_PLAN[f],y=WOMB_LEVELS[f],floorCuts=[...(f?shaftHoles:[]),...(f>=2?[atrium]:[])];
  const floors=slab([WOMB_BOUNDS],floorCuts,y,`floor-${f+1}`);surfaces.push(...floors.map(r=>({...r,y})));
  if(f>=2){
   mapShapes.push({polygon:polygon(atrium),color:'#080e14',kind:'void',floor:f+1});
   for(const points of [[[atrium.minX,atrium.minZ],[atrium.maxX,atrium.maxZ]],[[atrium.maxX,atrium.minZ],[atrium.minX,atrium.maxZ]]])mapShapes.push({points,color:'#263944',width:.09,floor:f+1});
   if(f===2)mapShapes.push({polygon:polygon(R([10,19.6,2.4,4.4])),color:'#314655',floor:3});
  }
  // The 3F booth is the only usable projection into the atrium.
  if(f===2)surfaces.push(...slab([R([10,19.6,2.4,4.4])],[],y,'balcony').map(r=>({...r,y})));
  const air=[...d.rooms.map(R),...WOMB_CORES.map(R),...(f>=2?[atrium]:[])];
  const walls=wombRegion(air,d.cuts.map(R),true);
  for(const r of walls.rectangles){physical(r,y,y+WOMB_STOREY,'building',{floor:f+1});mapShapes.push({polygon:polygon(r),color:'#53616e',kind:'building',floor:f+1});}
  // A baffle inside the atrium has no next-storey slab to close its top.
  // Cap only those exposed parts, so upper floors do not see a hollow wall
  // and the ordinary slab tops never receive a duplicate coplanar surface.
  if(f<3){const holes=[...shaftHoles,...(f>=1?[atrium]:[])],caps=[];
   for(const wall of walls.rectangles)for(const hole of holes){const r={minX:Math.max(wall.minX,hole.minX),maxX:Math.min(wall.maxX,hole.maxX),minZ:Math.max(wall.minZ,hole.minZ),maxZ:Math.min(wall.maxZ,hole.maxZ)};if(r.maxX-r.minX>1e-6&&r.maxZ-r.minZ>1e-6)caps.push(r);}
   for(const r of wombRegion(caps,f===1?[R([10,19.6,2.4,4.4])]:[]).rectangles){const top=y+WOMB_STOREY;quad([r.minX,top,r.minZ],[r.minX,top,r.maxZ],[r.maxX,top,r.maxZ],[r.maxX,top,r.minZ],'wall');}
  }
  // One continuous exposed shell per height band, without box end seams.
  for(const [x,z,X,Z]of walls.edges){
   quad([x,y,z],[X,y,Z],[X,y+1.02,Z],[x,y+1.02,z],'dado');
   quad([x,y+1.02,z],[X,y+1.02,Z],[X,y+3.36,Z],[x,y+3.36,z],'wall');
   quad([x,y+3.36,z],[X,y+3.36,Z],[X,y+3.6,Z],[x,y+3.6,z],'ceiling');
   // Offset toward the room to avoid coplanar faces; no collision lip.
   const nx=-Math.sign(Z-z),nz=Math.sign(X-x),shift=.008;
   quad([x+nx*shift,y+2.88,z+nz*shift],[X+nx*shift,y+2.88,Z+nz*shift],[X+nx*shift,y+2.94,Z+nz*shift],[x+nx*shift,y+2.94,z+nz*shift],f===1?'A':f===3?'B':'purple');
  }
  // Furniture stays within the approved outlines; tall baffles are already shell.
  for(const fixture of d.fixtures){if(d.cuts.some(r=>r.slice(0,4).every((v,i)=>Math.abs(v-fixture[i])<1e-6)))continue;
   const r=R(fixture);solid(r,y,y+1.05,'seat','furniture',{floor:f+1});mapShapes.push({polygon:polygon(r),color:'#86909c',floor:f+1});
  }
 }
 slab([WOMB_BOUNDS],[],14.4,'roof');

 // Two stacked U stairs, twelve flights. Upper flights are thin inclined
 // stair decks, so their undersides do not fill the lower flight's headroom.
 for(const r of WOMB_STAIRS){
  const count=10,depth=(r.maxZ-r.minZ)/count;
  for(let i=0;i<count;i++){
   const top=r.base+r.height*(i+1)/count,z=r.direction===-1?r.maxZ-(i+1)*depth:r.minZ+i*depth;
   const tread={minX:r.minX,maxX:r.maxX,minZ:z,maxZ:z+depth};
   const bottom=r.from===1?-.24:top-.18;
   // Both sides meet the shaft wall/spine exactly: leave their exposed faces
   // to the continuous shell, avoiding coplanar flicker along every tread.
   faces(tread,bottom,top,'floor',{sides:false});physical(tread,bottom,top,'stair',{movementRamp:r,stairId:r.id});
   // Flush tread marking: no collision lip and no coplanar painted face.
   const lip=r.direction===-1?z+depth-.035:z;
   quad([r.minX+.06,top+.006,lip],[r.minX+.06,top+.006,lip+.025],[r.maxX-.06,top+.006,lip+.025],[r.maxX-.06,top+.006,lip],'trim',.75);
  }
 }
 for(const [core,[x,z,w]]of WOMB_CORES.entries()){
  solid(R([x+1.95,z+1.6,.5,3.4]),0,14.16,'dado','stair-spine');
  for(let f=0;f<3;f++){const y=WOMB_LEVELS[f]+1.8,r=R([x,z,w,1.6]);solid(r,y-.24,y,'floor','surface',{surfaceId:`s${core+1}-mid-${f+1}`});surfaces.push({...r,y});}
  // At the terminal floor the unused upward lane ends in a visible guard.
  solid(R([x,28.88,1.95,.12]),10.8,11.9,'metal','guard');
  for(let f=0;f<4;f++)mapShapes.push({polygon:polygon(R([x,z,w,8])),color:'#758793',floor:f+1,stair:`S${core+1}`});
 }
 // A narrow, deep balcony opening. Its sill, cheeks and lintel are real solids.
 const balconyY=WOMB_LEVELS[2];
 for(const r of [R([10,19.4,2.64,.2]),R([10,24,2.64,.2])])solid(r,balconyY,10.8,'dado','balcony-side');
 for(const r of [R([12.4,19.6,.24,1.2]),R([12.4,22.8,.24,1.2])])solid(r,balconyY,10.8,'dado','balcony-cheek');
 solid(R([12.4,20.8,.24,2]),balconyY,balconyY+1.05,'metal','balcony-sill');
 solid(R([12.4,20.8,.24,2]),balconyY+2.05,10.8,'dado','balcony-lintel');

 function sign(text,sub,x,y,z,width=2.6,height=.7,rotation=0,color='#c4d8e4'){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;
  const c=canvas.getContext('2d');c.fillStyle='#18212d';c.fillRect(0,0,768,192);c.fillStyle=color;c.font='500 66px sans-serif';c.textAlign='center';c.fillText(text,384,88);c.fillStyle='#abbac8';c.font='30px sans-serif';c.fillText(sub,384,151);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.push(texture);
  const material=new T.MeshBasicMaterial({map:texture}),mesh=new T.Mesh(new T.PlaneGeometry(width,height),material);mesh.position.set(x,y,z);mesh.rotation.y=rotation;mesh.name='WOMB sign / '+text;mesh.userData.solid=false;mesh.raycast=()=>{};world.add(mesh);
 }
 for(let f=0;f<4;f++)for(const [i,[x,z]]of WOMB_CORES.entries()){
  const p=P(x+.975,z+.015);sign(`${f+1}F / S${i+1}`,f===3?'DOWN  3F':`${f===0?'ENTRY':f===1?'A  MAIN': 'LOUNGE'} / UP ${f+2}F`,p.x,WOMB_LEVELS[f]+2.65,p.z,1.8,.5,0,i?'#8bdce4':'#f1bf89');
 }
 {const p=P(17,36.32);sign('WOMB','A / S1  <     >  B / S2',p.x,1.85,p.z,3.4,.85);}
 for(const [f,title,x,z]of [[1,'MAIN FLOOR / A',17,16.42],[3,'SUB FLOOR / B',17,4.42]]){
  const p=P(x,z);sign(title,'WOMB / WALKABLE STUDY',p.x,WOMB_LEVELS[f]+2.2,p.z,4.8,.9,0,f===1?'#f1bf89':'#8bdce4');
 }
 // Readable club motifs: a suspended mirror ball, DJ desks and acoustic panels.
 const ball=new T.Mesh(new T.IcosahedronGeometry(.9,2),new T.MeshStandardMaterial({color:'#b9c6dc',roughness:.22,metalness:.8,flatShading:true}));ball.position.set(0,12.2,-.7);ball.name='WOMB / mirror ball';ball.userData.solid=false;ball.raycast=()=>{};world.add(ball);
 solid(R([16.97,20.27,.06,.06]),13.1,14.4,'metal','fixture');
 for(const [f,z]of [[1,16.4],[3,4.4]]){
  const y=WOMB_LEVELS[f],r=R([14,z-.5,6,.5]);solid(r,y,y+1.05,'metal','dj-counter');
  for(const x of [14.8,18.2]){const p=P(x,z-.18);const g=new T.Mesh(new T.BoxGeometry(1.15,.09,.28),materials.metal);g.position.set(p.x,y+1.1,p.z);g.name='WOMB / mixing desk';world.add(g);}
 }
 world.add(new T.AmbientLight('#c4d3e5',.9));
 for(const [x,y,z,color,intensity]of [[0,6.6,1,'#ffd6aa',18],[0,12.8,-13,'#9cd8f4',16],[-9,2.7,5,'#cfb1ed',12],[10,9.8,-1,'#a8c6fa',12]]){const l=new T.PointLight(color,intensity,15,2);l.position.set(x,y,z);world.add(l);}

 const sites=[1,3].map(f=>{const d=WOMB_PLAN[f],r=R(d.site),y=WOMB_LEVELS[f],id=d.site[4],x=(r.minX+r.maxX)/2,z=(r.minZ+r.maxZ)/2;
  for(const [a,b,c,e]of wombRegion([r]).edges){const dx=Math.abs(c-a),dz=Math.abs(e-b),line=new T.Mesh(new T.PlaneGeometry(Math.max(.075,dx),Math.max(.075,dz)),paint);line.rotation.x=-Math.PI/2;line.position.set((a+c)/2,y+.009,(b+e)/2);line.userData.solid=false;line.raycast=()=>{};world.add(line);}
  const points=[[x,z],[x-2,z+1.5],[x+2,z-1.5]].map(([x,z],i)=>({id:`${id}-${['open','cover','deep'][i]}`,style:['open','cover','deep'][i],x,z,y}));
  return {id,name:`${f+1}F / ${id} ${id==='A'?'メインフロア':'サブフロア'}`,x,z,y,radius:3,polygon:polygon(r),plantPositions:points,floor:f+1};
 });
 for(const [key,b]of batches){const g=new T.BufferGeometry();for(const name of ['position','normal','color'])g.setAttribute(name,new T.Float32BufferAttribute(b[name],3));g.computeBoundingSphere();const mesh=new T.Mesh(g,materials[b.material]);mesh.name='WOMB / '+key;mesh.userData.solid=true;mesh.receiveShadow=true;world.add(mesh);}
 const teamSpawns={attack:[17,13,15,19,21].map(x=>P(x,39.5)),defend:[17,13,15,19,21].map(x=>P(x,39,7.2))};
 const landmarks=[{id:'entry',name:'1F エントランス',...teamSpawns.attack[0],yaw:0},
  {id:'bar',name:'1F バー回遊路',...P(11.8,23),yaw:-Math.PI/2},
  {id:'a',name:'2F Aメインフロア',...P(17.8,23,3.6),yaw:0},
  {id:'balcony',name:'3F Aバルコニー',...P(11.9,21.8,7.2),yaw:-Math.PI/2},
  {id:'ct',name:'3F CTスタッフ側',...teamSpawns.defend[0],yaw:0},
  {id:'b',name:'4F Bサブフロア',...P(17,9.8,10.8),yaw:0}];
 for(let f=0;f<4;f++)for(const [i,[x,z]]of WOMB_CORES.entries())landmarks.push({id:`s${i+1}-${f+1}`,name:`${f+1}F S${i+1} ${i?'スタッフ':'来客'}階段`,...P(x+(f===3?3.425:.975),z+6.5,WOMB_LEVELS[f]),yaw:0});
 const callouts=[];
 for(const [f,d]of WOMB_PLAN.entries())for(const [name,x,z]of d.labels){if(['A裏','B主','A主','B裏','S1へ','S2へ','入口','設置ゾーン','2Fへの限定射線','周囲は壁で遮断','2Fへの射線なし'].includes(name))continue;
  const p=P(x,z),r=R([x-2,z-1.3,4,2.6]);callouts.push({id:`${f+1}-${callouts.length}`,name:`${f+1}F ${name}`,polygon:polygon(r),minY:WOMB_LEVELS[f]-.18,maxY:WOMB_LEVELS[f]+3.3,floor:f+1,label:{...p,text:name}});
 }
 for(let f=0;f<4;f++)for(const [i,[x,z,w,d]]of WOMB_CORES.entries())callouts.unshift({id:`s${i+1}-${f+1}`,name:`${f+1}F S${i+1} ${i?'スタッフ':'来客'}階段`,polygon:polygon(R([x,z,w,d])),minY:WOMB_LEVELS[f]-.18,maxY:WOMB_LEVELS[f]+3.4,floor:f+1,label:{...P(x+2.2,z+6.7),text:`S${i+1} ${f<3?'↑'+(f+2):''}${f>0?' ↓'+f:''}`}});
 const map={id:'womb',name:'WOMB / 4フロアクラブ',shortName:'WOMB',indoor:true,layeredNavigation:true,world,bounds:{...WOMB_BOUNDS},combatBounds:{...WOMB_BOUNDS},colliders,collision:createCollisionIndex(colliders,4),mapShapes,ramps:WOMB_STAIRS.map(r=>({...r})),sites,teamSpawns,callouts,landmarks,zones:[],floors:WOMB_LEVELS.map((y,i)=>({id:i+1,y,name:`${i+1}F / ${['入口・バー','Aメイン','ラウンジ・CT','Bサブ'][i]}`})),floorIndex:wombFloorIndex,
  spawn:{...teamSpawns.attack[0],yaw:0},practiceSpawn:{...teamSpawns.attack[0],yaw:0},enemySpawns:teamSpawns.defend,spawnYaw:{attack:0,defend:0},
  buyAreas:{attack:{...P(17,39),...R([11.5,37.7,11,3]),minY:0,radius:5},defend:{...P(17,39,7.2),...R([11.5,37.7,11,3]),minY:7.2,radius:5}},
  lanes:[{id:'a-main',name:'S1 / A主',points:WOMB_PLAN[0].routes[0].p.map(p=>P(...p))},{id:'b-main',name:'S2 / B主',points:WOMB_PLAN[0].routes[1].p.map(p=>P(...p))}],
  routeCopy:'1F攻撃 → S1・S2 → A 2F / B 4F · 守備は3Fから上下へ',minY:0,maxActorY:16,
  menuCamera:{position:[0,5.4,5.2],target:[0,6.3,-4]},renderLighting:{hemisphere:.3,sun:.18},
  rangeArea:{spawn:{...P(17,39.5),yaw:0},targets:[P(12,35),P(22,35),P(11.5,32),P(22.5,32)]},
  stats:{mode:'arena',width:34,depth:42,area:1428,floors:4,sites:2,routes:2,buildings:1,collisionShapes:colliders.length,renderBatches:batches.size},
  ductAt(){return false;},floorBaseAt(){return 0;},walkHeights(x,z){
   if(world.userData.bomberCollapsed)return [0];
   const heights=surfaces.filter(r=>contains(r,x,z)).map(r=>r.y);
   for(const r of map.ramps)if(contains(r,x,z)){const y=rampHeight(r,x,z);heights.push(y);for(const c of map.collision.query(x,z,.4))if(!c.disabled&&!c.movementRamp&&c.height>y&&c.height<=y+.22&&map.collision.overlaps(c,x,z,.4))heights.push(c.height);}
   return [...new Set(heights)];
  }
 };
 world.updateMatrixWorld(true);return map;
}
