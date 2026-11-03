import {createCollisionIndex,rampHeight} from './collision.js';
import {createBusDestruction} from './bus-destruction.js';
import {createTrafficClock,createBusModels,ovalRoute} from './bus-traffic.js';
import {createHirakataModel} from './hirakata-complete-render.js';
import {HIRAKATA_MODEL_LAYOUT as source} from './hirakata-complete-layout.js';
import {HIRAKATA_A_COVER,createHirakataSiteCover} from './hirakata-site-cover.js';

// The approved reference model and its walking geometry share one coordinate
// transform: Blender (x,y,z) -> game (x,z,-y). Metres are visual estimates.
const rect=(x,z,w,d)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
export function createHirakataMap(T,scene){
 const rendered=createHirakataModel(T),world=rendered.world;scene.add(world);
 const bounds={minX:-98,maxX:98,minZ:-123,maxZ:183},colliders=[],mapShapes=[],ramps=[],ownership=new Map();
 const groups=rendered.groups,groupNames=[...groups.keys()].sort((a,b)=>b.length-a.length);
 function owner(id){
  const named=groupNames.find(n=>id.startsWith(n));if(named)return named;
  if(/^station-2f/.test(id))return 'Station_upper_floor';
  if(/^station-main|station-stair/.test(id))return 'Station_central_stairs';
  if(/^station-west|station-east-shop|painted-pillar/.test(id))return 'Station_ground_passage';
  if(/^central-gate|central-ticket/.test(id))return 'Station_central_gates';
  if(/^central-wood|central-retail/.test(id))return 'Station_central_hall';
  if(/^east-/.test(id))return 'Station_east_hall';
  if(/^commercial-north/.test(id))return 'Station_commercial_corridor';
  if(/^commercial-link|central-link/.test(id))return 'Station_outdoor_link';
  if(/^south-window|south-ground-pillar/.test(id))return 'Station_south_facade';
  if(/^north-window|station-end/.test(id))return 'Station_north_facade';
  if(/^curved-bridge/.test(id))return 'Curved_park_bridge';
  if(/^north_(bridge|deck|short|east|entry|threshold|link|stair|mall)/.test(id))return 'North_upper_deck';
  if(/^woven/.test(id))return 'Hirakata_Woven';
  if(/^hirakata_mall|tower/.test(id))return 'Hirakata_Mall_and_Station_Hill';
  if(/^north_low/.test(id))return 'North_shopping_street';
  if(/^north_stop|north_canopy|north_bus_fence/.test(id))return 'North_rotary_canopies';
  if(/^north_/.test(id))return 'North_ground_and_rotary';
  if(/^TSITE/.test(id))return 'TSITE_glass_boxes';
  if(/^park hut/.test(id))return 'Park';
  if(/^bench/.test(id))return 'Park';
  return 'South_streets_and_shops';
 }
 function add(c,name=owner(c.id)){
  if(![c.minX,c.maxX,c.minZ,c.maxZ,c.base,c.height].every(Number.isFinite)||c.height<=c.base)throw Error('Invalid model collider '+c.id);
  c.kind??='building';c.surfaceId=c.id;colliders.push(c);
  const shape={polygon:c.polygon||rect((c.minX+c.maxX)/2,(c.minZ+c.maxZ)/2,c.maxX-c.minX,c.maxZ-c.minZ),kind:c.kind==='surface'||c.kind==='roof'?'overhead':c.kind,color:c.kind==='surface'?'#9ba6a4':c.kind==='railing'?'#9ba9aa':'#647e86',base:c.base,height:c.height};
  mapShapes.push(shape);if(!ownership.has(name))ownership.set(name,{colliders:[],shapes:[],ramps:[]});ownership.get(name).colliders.push(c);ownership.get(name).shapes.push(shape);return c;
 }
 function box(id,x,z,w,d,base,height,kind='building',name){return add({id,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,base,height,kind},name);}
 const unique=(values,fields)=>{const seen=new Set();return values.filter(v=>{const key=fields.map(k=>JSON.stringify(v[k])).join('|');if(seen.has(key))return false;seen.add(key);return true;});};
 // Existing parked display buses are replaced by the four real boardable buses.
 for(const b of unique(source.boxes,['x','y','w','d','z0','z1'])){
  if(/^parked bus|^north_bus_[-\d]/.test(b.id)||b.id==='TSITE building')continue;
  box(b.id,b.x,-b.y,b.w,b.d,b.z0,b.id.startsWith('park hut')?3.4:b.z1,/pillar|column|pier/.test(b.id)?'column':/fence|bridge_(north|south)/.test(b.id)?'railing':'building');
 }
 for(const s of unique(source.surfaces,['x','y','w','d','z']))if(s.z>.05)box(s.id,s.x,-s.y,s.w,s.d,s.z-(s.id.startsWith('station-2f')?.35:.36),s.z,'surface');
 for(const p of source.polygons){const polygon=p.points.map(([x,y])=>[x,-y]);add({id:p.id,polygon,minX:Math.min(...polygon.map(p=>p[0])),maxX:Math.max(...polygon.map(p=>p[0])),minZ:Math.min(...polygon.map(p=>p[1])),maxZ:Math.max(...polygon.map(p=>p[1])),base:p.z-.3,height:p.z,kind:'surface'});}
 const actualRamps=unique(source.ramps,['x','y0','y1','w','z0','z1']);
 for(const s of actualRamps){
  const za=-s.y0,zb=-s.y1,r={id:s.id,minX:s.x-s.w/2,maxX:s.x+s.w/2,minZ:Math.min(za,zb),maxZ:Math.max(za,zb),axis:'z',direction:(s.z1-s.z0)/(zb-za)>0?1:-1,base:Math.min(s.z0,s.z1),height:Math.abs(s.z1-s.z0)};ramps.push(r);
  const n=Math.max(1,Math.ceil(Math.abs(zb-za)/.45)),name=owner(s.id);
  if(!ownership.has(name))ownership.set(name,{colliders:[],shapes:[],ramps:[]});ownership.get(name).ramps.push(r);
  for(let i=0;i<n;i++){const a=za+(zb-za)*i/n,b=za+(zb-za)*(i+1)/n,top=Math.max(rampHeight(r,s.x,a),rampHeight(r,s.x,b));if(top<=r.base+.001)continue;const c=box(s.id+' tread '+i,s.x,(a+b)/2,s.w,Math.abs(b-a),r.base,top,'stairs',name);c.movementRamp=r;}
 }
 // Rail footprints are oriented polygons, not large axis-aligned invisible walls.
 function segment(id,a,b,z0,z1,r,name){const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(!length)return;const nx=-dz/length*r,nz=dx/length*r,polygon=[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]];add({id,polygon,minX:Math.min(a[0],b[0])-r,maxX:Math.max(a[0],b[0])+r,minZ:Math.min(a[1],b[1])-r,maxZ:Math.max(a[1],b[1])+r,base:z0,height:z1,kind:'railing'},name);}
 for(const s of source.segments){
  const a=[s.a[0],-s.a[1]],b=[s.b[0],-s.b[1]],name=owner(s.id);
  if(s.id.includes('stair rail')){
   const r=ramps.find(r=>Math.abs(r.minZ-Math.min(a[1],b[1]))<.01&&Math.abs(r.maxZ-Math.max(a[1],b[1]))<.01&&(Math.abs(a[0]-r.minX)<.01||Math.abs(a[0]-r.maxX)<.01));
   if(r){const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.5);for(let i=0;i<n;i++){const p=[a[0],a[1]+(b[1]-a[1])*i/n],q=[b[0],a[1]+(b[1]-a[1])*(i+1)/n],h0=rampHeight(r,p[0],p[1]),h1=rampHeight(r,q[0],q[1]);segment(s.id+' '+i,p,q,Math.min(h0,h1),Math.max(h0,h1)+1.1,s.r,name);}continue;}
  }
  segment(s.id,a,b,s.z0,s.z1,s.r,name);
 }
 // Authored ceilings and roof slabs, absent from the eye-height study's walker.
 for(const [x,z,w,d]of[[-48,0,22,29],[-34,12.75,6,3.5],[-34,-11.25,6,6.5],[11,0,84,29]])box('ground-ceiling '+x+' '+z,x,z,w,d,5.64,5.8,'roof','Station_ground_Ceiling');
 for(const[id,x,z,w,d,lo,hi,name]of[
  ['central-ceiling',-17,0,47,29,10.63,10.85,'Station_central_Ceiling'],['east-ceiling',36.5,0,32,29,10.29,10.49,'Station_east_Ceiling'],['shop-ceiling',10,9.3,26,6.4,9.88,10.08,'Station_commercial_Ceiling'],
  ['station-base-roof',-3,0,112,29,12.8,13.1,'Station_upper_Roof'],['station-top-roof',-3,0,113,30,20.47,20.83,'Station_upper_Roof'],
  ['station-upper-south',-3,14.7,112.6,.45,13.05,20.45,'Station_upper_Roof'],['station-upper-north',-3,-14.7,112.6,.45,13.05,20.45,'Station_upper_Roof'],
  ['station-upper-west',-59.3,0,.5,29.6,13.05,20.45,'Station_upper_Roof'],['station-upper-east',53.3,0,.5,29.6,13.05,20.45,'Station_upper_Roof'],
  ['south-deck-canopy',11.7,79.5,18,9,12.475,12.825,'South_pedestrian_deck'],
  ['mall-tower',63,-87,26,25,29,75,'Hirakata_Mall_and_Station_Hill'],['mall-roof-cap',61,-72,35.6,66.6,28.675,29.325,'Hirakata_Mall_and_Station_Hill']])box(id,x,z,w,d,lo,hi,'roof',name);
 // Tight roof strips follow the gables instead of sealing their empty corners.
 for(const[x,z,w,d,h]of[[-21,119,10,7,2.2],[-11,145,5.2,4.7,1.7]]){const n=Math.ceil(d/.1);for(let i=0;i<n;i++){const a=-d/2+i*d/n,b=a+d/n,near=a<=0&&b>=0?0:Math.min(Math.abs(a),Math.abs(b));box('park gable '+x+' '+i,x,z+(a+b)/2,w,d/n,3.4,3.4+h*(1-near/(d/2)),'roof','Park');}}
 for(const x of[-54,-42,-30,-18,-6,6,18,30,42,50])box('south-awning '+x,x,17,11.8,7,5.725,5.975,'roof','Station_south_facade');
 for(const x of[-53,-35,-17]){box('rotary shelter '+x,x,23,15,3.6,3.6,3.8,'roof','Rotary_furniture');for(const dx of[-6,6])box('rotary shelter post '+x+' '+dx,x+dx,23,.12,.18,0,3.7,'column','Rotary_furniture');}
 for(const x of[-43,-37,-31]){box('taxi body '+x,x,48,4.4,1.9,.175,1.325,'vehicle','Vehicles');box('taxi cabin '+x,x,48,2.3,1.65,1.15,1.95,'vehicle','Vehicles');}
 for(const z of[29,47,89])box('south deck support '+z,8,z,.64,.64,0,6.15,'column','South_pedestrian_deck');
 for(const[x,z]of[[8,102],[22,114],[3,120]])box('curved bridge support '+x+' '+z,x,z,.68,.68,0,6.15,'column','Curved_park_bridge');
 for(const x of[3.5,20])for(const z of[76,83])box('south canopy support '+x+' '+z,x,z,.48,.65,6.4,12.6,'column','South_pedestrian_deck');
 for(const z of[-12,-8,-2,2,8,12])box('rail bed '+z,-3,z,109,2,13.1,13.3,'surface','Station_platform_Roof');
 for(const z of[-10,0,10]){box('platform '+z,-3,z,108,1.8,13.225,13.975,'surface','Station_platform_Roof');for(const x of[-52,-40,-28,-16,-4,8,20,32,44])box('platform post '+x+' '+z,x,z,.22,.22,14,19.6,'column','Station_platform_Roof');}
 // Preserve the actual T-SITE setbacks instead of a full-height bounding box.
 for(const[x,y,z,w,d,h]of[[40,-68,17,24,24,34],[40,-68,2.9,34,30,5.8],[40,-68,8.2,35,31,4.8],[30,-66,13.4,15,28,5.2],[48,-69,13.4,18,34,5.2],[27,-69,18.8,14,32,5.2],[44,-67,18.8,18,28,5.2],[33,-66,24.2,21,27,5.2],[51,-70,24.2,11,34,5.2],[25,-68,29.6,13,30,5.2],[41,-65,29.6,18,25,5.2],[34,-66,35,20,25,5.2]])box('tsite-block '+x+' '+z,x,-y,w,d,z-h/2,z+h/2,'building','TSITE_glass_boxes');
 // Append groups so every existing destruction bit keeps its original meaning.
 const siteCover=createHirakataSiteCover(T);
 for(const spec of HIRAKATA_A_COVER){const root=siteCover.groups.get(spec.id);world.add(root);groups.set(spec.id,root);box(spec.id,spec.x,spec.z,spec.w,spec.d,0,spec.h,'building',spec.id);}
 const collision=createCollisionIndex(colliders,12);
 const damageGroups=[];
 for(const[name,root]of groups){const nodes=[];root.traverse(n=>{if(n.isMesh&&!n.userData.preserveGround)nodes.push(n)});const own=ownership.get(name);if(!nodes.length||!own?.colliders.length)continue;damageGroups.push({id:name,parts:[],nodes,colliders:own.colliders,shapes:own.shapes,ramps:own.ramps,bounds:own.colliders,structural:true});}
 const routes=[{id:'south-1',points:ovalRoute(-25,42,28,13),offset:0},{id:'south-2',points:ovalRoute(-25,42,28,13),offset:90},{id:'north-1',points:ovalRoute(-8,-57,31,14),offset:25},{id:'north-2',points:ovalRoute(-8,-57,31,14),offset:112}];
 const traffic=createTrafficClock(routes,{bounds}),busModels=createBusModels(T,world,traffic);busModels.update(0);
 const sites=[{id:'A',name:'A / 南口自由通路前',x:-24,z:22,radius:5,polygon:rect(-24,22,10,8),plantPositions:[{x:-24,z:22},{x:-26,z:23},{x:-22,z:21}]},{id:'B',name:'B / 2階東改札前',x:35,z:6,y:6.4,radius:6,polygon:rect(35,6,12,10),plantPositions:[{id:'B-center',x:35,z:6,y:6.4},{id:'B-west',x:32,z:7,y:6.4},{id:'B-east',x:38,z:5,y:6.4}]}];
 for(const site of sites){const points=site.polygon.map(([x,z])=>new T.Vector3(x,(site.y||0)+.09,z));points.push(points[0]);const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:site.id==='A'?'#49d7c5':'#ecc355'}));line.raycast=()=>{};world.add(line);mapShapes.push({kind:'site',polygon:site.polygon,base:site.y||0,height:(site.y||0)+.09,color:site.id==='A'?'#4ca69d':'#cbb56b'});}
 const destruction=createBusDestruction(T,world,colliders,mapShapes,damageGroups,collision,ramps);
 const teamSpawns={attack:Array.from({length:5},(_,i)=>({x:-20+i*5,y:0,z:173})),defend:Array.from({length:5},(_,i)=>({x:i*5,y:0,z:-112}))};
 const regions=[['south','南口ロータリー',-60,15,22,63,0,4],['north','北口ロータリー',-48,31,-79,-30,0,4],['passage','南北自由通路',-30,-18,-15,15,0,5.6],['central','中央改札',-47,7,-14,14,6,11],['east','東改札',21,52,-14,14,6,11],['park','岡東中央公園',-31,27,122,170,0,5],['tsite','T-SITE・南デッキ',4,58,50,101,5.8,11],['north-deck','北口デッキ',-37,43,-44,-17,3.5,10]];
 const callouts=regions.map(([id,name,a,b,c,d,minY,maxY])=>({id,name,polygon:rect((a+b)/2,(c+d)/2,b-a,d-c),minY,maxY,label:{x:(a+b)/2,z:(c+d)/2}}));
 const landmarks=[['south','南口',-24,20,0,0],['central','中央改札',-24,10,6.4,0],['east','東改札',35,10,6.4,0],['passage','南北自由通路',-24,10,0,0],['link','屋外連絡通路',-10,17,7.1,1.57],['north','北口広場',-22,-31,0,0],['north-deck','北口デッキ',-22,-23,7.2,-1],['tsite','T-SITE・南デッキ',8,45,6.4,Math.PI],['park','公園・曲線橋',-2,147,0,0]].map(([id,name,x,z,y,yaw])=>({id,name,x,z,y,yaw}));
 const points=a=>a.map(([x,z,y=0])=>({x,z,y}));
 const lanes=[{id:'bus',name:'西側街路',points:points([[-20,173],[-44,126],[-74,110],[-74,30],[-65,-19],[-24,-23],[35,6,6.4]])},{id:'mid',name:'南北自由通路',points:points([[0,173],[0,120],[0,64],[-24,26],[-24,-23],[35,6,6.4]])},{id:'mewe',name:'東側街路',points:points([[0,173],[81,130],[84,31],[84,-20],[34,-24],[35,6,6.4]])}];
 function walkHeights(x,z){const heights=[0];for(const c of collision.query(x,z,0)){if(c.disabled||!['surface','stairs'].includes(c.kind)||!collision.overlaps(c,x,z,0))continue;const h=c.movementRamp?rampHeight(c.movementRamp,x,z):c.height;if(!heights.some(v=>Math.abs(v-h)<.005))heights.push(h);}return heights;}
 // Route hints only order searches; the navigator still checks support, rails,
 // headroom and traffic on every segment, including after structural damage.
 const navigationStairHints=[
  {minX:4,maxX:23,minZ:16,maxZ:123,minY:6,maxY:7,rampId:'Curved_park_bridge stair 8',via:points([[8.5,99.5,6.4],[10.5,103.5,6.4],[14.5,104.5,6.4],[21.5,109.5,6.4],[22.5,114.5,6.4],[19.5,118.5,6.4],[1.5,119.5,6.4],[-2,121,6.4]])},
  {minX:0,maxX:53,minZ:-14.5,maxZ:14.5,minY:6,maxY:7,rampId:'Station_central_stairs stair 0',via:points([[-.5,-6.5,6.4],[-31.5,-8.5,6.4]])}
 ];
 return {id:'hirakata',name:'枚方市駅',shortName:'HIRAKATASHI',world,bounds,combatBounds:{...bounds},minY:0,maxActorY:100,layeredNavigation:true,walkHeights,navigationStairHints,colliders,collision,ramps,mapShapes,destruction,traffic,busModels,sites,teamSpawns,spawn:{...teamSpawns.attack[2],yaw:0},enemySpawns:teamSpawns.defend,spawnYaw:{attack:0,defend:Math.PI},
  buyAreas:{attack:{minX:-98,maxX:98,minZ:150,maxZ:183},defend:{minX:-98,maxX:98,minZ:-123,maxZ:-106}},lanes,callouts,zones:callouts.map(c=>({name:c.name,x:c.label.x,z:c.label.z,radius:18})),landmarks,
  menuCamera:{position:[-145,105,195],target:[0,13,35]},rangeArea:{spawn:{x:-24,z:14,y:0,yaw:0},targets:[{x:-24,z:-5},{x:-24,z:-10},{x:-26,z:-13},{x:-22,z:-13}]},routeCopy:'南口A / 2階東改札前B / 自由通路・デッキ',
  origin:{lat:34.815,lon:135.649},visualReady:Promise.resolve(),renderLighting:{hemisphere:.75,sun:2.6},modelRevision:'hirakata-complete-20261103',sourceModel:rendered.provenance,stats:{mode:'arena',width:196,depth:306,area:59976,combatWidth:196,combatDepth:306,sites:2,routes:3,collisionShapes:colliders.length,renderBatches:rendered.meshCount+siteCover.meshCount,trafficBuses:4},layout:{version:7,siteEntries:{A:{x:-24,z:22},B:{x:35,z:6,y:6.4}}}};
}
