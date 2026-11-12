// Actual Hirakata geometry, collision, routes and destruction in silent Node.
// This is not a browser/FPS, match balance, or plant/defuse runtime test.
const assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url');

const EXPECTED_COVER=[
 {id:'A_cover_west',x:-31,z:20.7,w:1.5,d:3.2,h:2.05,style:'cabinet'},
 {id:'A_cover_east',x:-17,z:20.3,w:1.5,d:3.2,h:2.05,style:'cabinet'},
 {id:'A_cover_south_west',x:-27.2,z:25.6,w:3.2,d:1,h:1.4,style:'planter'},
 {id:'A_cover_south_east',x:-20.6,z:25.6,w:2.6,d:1,h:1.4,style:'planter'},
];
// Existing 35 full-model module bits, before the A cover addition. Reordering
// these would reinterpret a saved/remote demolition mask as another building.
const EXISTING_GROUP_IDS=[
 'Station_ground_passage','Station_upper_floor','Station_ground_Ceiling','Station_central_stairs',
 'Station_central_hall','Station_central_gates','Station_east_hall','Station_commercial_corridor',
 'Station_outdoor_link','Station_central_Ceiling','Station_east_Ceiling','Station_commercial_Ceiling',
 'Station_south_facade','Station_north_facade','Station_upper_Roof','Station_platform_Roof',
 'South_station_stair','Sunplaza_3','Sunplaza_1','TSITE_glass_boxes','South_pedestrian_deck',
 'TSITE_terrace','Curved_park_bridge','Park','Rotary_furniture','Vehicles','South_streets_and_shops',
 'Park_details','South_context_roofs','North_ground_and_rotary','North_upper_deck',
 'North_rotary_canopies','Hirakata_Woven','Hirakata_Mall_and_Station_Hill','North_shopping_street',
];

async function main(){
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 const[T,{createHirakataMap},{createNavigation},{HIRAKATA_A_COVER},{busHitsBox}]=await Promise.all([
  load('vendor/three.module.js'),load('hirakata-map.js'),load('navigation.js'),load('hirakata-site-cover.js'),load('bus-destruction.js'),
 ]);
 const ctx=new Proxy({measureText:t=>({width:String(t).length*8})},{get:(o,k)=>o[k]||(()=>{})});
 global.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 const map=createHirakataMap(T,new T.Group()),nav=createNavigation(map);
 map.world.updateMatrixWorld(true);nav.updateTraffic(0);
 const groups=map.destruction.groups,byId=new Map(groups.map(g=>[g.id,g]));
 const original={colliders:[...map.colliders],shapes:[...map.mapShapes],ramps:[...map.ramps]};
 const A=map.sites.find(s=>s.id==='A'),B=map.sites.find(s=>s.id==='B');
 let checks=0,routeCount=0,busSamples=0;const routeLengths=[];
 const check=(label,fn)=>{fn();checks++;console.log('PASS '+label);};
 const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-6,label+': '+a+' != '+b);
 const same=(actual,expected,label)=>{assert.equal(actual.length,expected.length,label+' count');for(let i=0;i<actual.length;i++)assert.equal(actual[i],expected[i],label+' identity '+i);};
 const maskFor=indices=>{const bytes=Buffer.alloc(5);for(const i of indices)bytes[i>>3]|=1<<(i&7);return bytes.toString('hex');};
 function ray(spec,height,axis=spec.style==='cabinet'?'x':'z'){
  return axis==='x'?[[spec.x-spec.w/2-1,height,spec.z],[spec.x+spec.w/2+1,height,spec.z]]:
   [[spec.x,height,spec.z-spec.d/2-1],[spec.x,height,spec.z+spec.d/2+1]];
 }
 function hits(pair,nodes){
  const start=new T.Vector3(...pair[0]),delta=new T.Vector3(...pair[1]).sub(start);
  return new T.Raycaster(start,delta.clone().normalize(),0,delta.length()).intersectObjects(nodes,false)
   .filter(h=>!h.object.userData.busDebrisHidden&&!h.object.userData.bomberHidden);
 }
 const rayClear=pair=>map.collision.rayClear(...pair[0],...pair[1]);
 function route(from,to,label){
  const points=nav.path(from.x,from.z,to.x,to.z,0,0);assert.ok(points.length,label+' route missing');
  let previous={...from,y:0},length=0;
  for(const p of points){assert.ok(nav.clearSegment(previous.x,previous.z,p.x,p.z,previous.y,p.y),label+' blocked edge');length+=Math.hypot(previous.x-p.x,previous.z-p.z);previous=p;}
  assert.ok(Math.hypot(previous.x-to.x,previous.z-to.z,previous.y)<.05,label+' endpoint');
  routeCount++;routeLengths.push({label,metres:Math.round(length*100)/100});
 }
 check('four bounded A props preserve A/B sites, all six planting points and the main entrance',()=>{
  assert.deepEqual(HIRAKATA_A_COVER,EXPECTED_COVER);
  assert.deepEqual({x:A.x,z:A.z,y:A.y||0,polygon:A.polygon,plants:A.plantPositions},
   {x:-24,z:22,y:0,polygon:[[-29,18],[-19,18],[-19,26],[-29,26]],plants:[{x:-24,z:22},{x:-26,z:23},{x:-22,z:21}]});
  assert.deepEqual({x:B.x,z:B.z,y:B.y,polygon:B.polygon,plants:B.plantPositions},
   {x:35,z:6,y:6.4,polygon:[[29,1],[41,1],[41,11],[29,11]],plants:[{id:'B-center',x:35,z:6,y:6.4},{id:'B-west',x:32,z:7,y:6.4},{id:'B-east',x:38,z:5,y:6.4}]});
  for(const site of[A,B])for(const p of site.plantPositions){
   assert.ok(nav.isWalkable(p.x,p.z,p.y||0),'plant walkable '+site.id+' '+JSON.stringify(p));
   assert.equal(map.collision.blocked(p.x,p.z,.45,p.y||0),false,'plant body clearance '+site.id+' '+JSON.stringify(p));
  }
  assert.ok(nav.clearSegment(-24,16,-24,29,0,0),'south opening to station entrance');
  assert.ok(nav.clearSegment(-24,-14,-24,16,0,0),'north/south public passage');
  close((EXPECTED_COVER[3].x-EXPECTED_COVER[3].w/2)-(EXPECTED_COVER[2].x+EXPECTED_COVER[2].w/2),3.7,'south centre opening');
 });
 check('every A planting point remains reachable from north, south, east and west with safe route edges',()=>{
  const entries=[['north',{x:-24,z:16}],['south',{x:-24,z:29}],['west',{x:-34,z:21}],['east',{x:-12,z:21}]];
  for(const[label,from]of entries)for(const[i,to]of A.plantPositions.entries()){
   route(from,to,label+' to A'+i);route(to,from,'A'+i+' to '+label);
  }
 });
 check('opaque visual bodies equal their collision footprint, height and radar polygon',()=>{
  for(const spec of EXPECTED_COVER){
   const g=byId.get(spec.id);assert.ok(g,spec.id);assert.equal(g.colliders.length,1);assert.equal(g.shapes.length,1);assert.equal(g.ramps.length,0);
   const c=g.colliders[0];assert.equal(c.id,spec.id);assert.equal(c.kind,'building');
   close(c.minX,spec.x-spec.w/2,spec.id+' minX');close(c.maxX,spec.x+spec.w/2,spec.id+' maxX');
   close(c.minZ,spec.z-spec.d/2,spec.id+' minZ');close(c.maxZ,spec.z+spec.d/2,spec.id+' maxZ');
   close(c.base,0,spec.id+' base');close(c.height,spec.h,spec.id+' height');
   assert.deepEqual(g.shapes[0].polygon,[[c.minX,c.minZ],[c.maxX,c.minZ],[c.maxX,c.maxZ],[c.minX,c.maxZ]]);
   close(g.shapes[0].base,0,spec.id+' radar base');close(g.shapes[0].height,spec.h,spec.id+' radar height');
   const body=g.nodes.find(n=>n.name===spec.id+' / body');assert.ok(body,spec.id+' body missing');
   const box=new T.Box3().setFromObject(body);
   for(const[field,value]of[['x',c.minX],['y',0],['z',c.minZ]])close(box.min[field],value,spec.id+' mesh minimum '+field);
   for(const[field,value]of[['x',c.maxX],['y',spec.h],['z',c.maxZ]])close(box.max[field],value,spec.id+' mesh maximum '+field);
   assert.equal(map.collision.blocked(spec.x,spec.z,.42,0),true,spec.id+' physical body');
  }
 });
 check('cabinets stop standing fire, planters stop low fire and rays above each cover remain open',()=>{
  for(const spec of EXPECTED_COVER){
   const nodes=byId.get(spec.id).nodes;
   for(const axis of['x','z']){
    const blocked=ray(spec,spec.style==='cabinet'?1.65:1.1,axis);
    assert.equal(rayClear(blocked),false,spec.id+' '+axis+' collision ray');assert.ok(hits(blocked,nodes).length,spec.id+' '+axis+' visible ray');
    const overhead=ray(spec,spec.h+.1,axis);
    assert.equal(rayClear(overhead),true,spec.id+' '+axis+' overhead collision');assert.equal(hits(overhead,nodes).length,0,spec.id+' '+axis+' overhead geometry');
    if(spec.style==='planter'){const standing=ray(spec,1.65,axis);assert.equal(rayClear(standing),true,spec.id+' standing ray passes over low planter');assert.equal(hits(standing,nodes).length,0);}
   }
  }
 });
 check('all four scheduled buses clear the new props with 20cm full-body margin for 90 seconds',()=>{
  const coverColliders=EXPECTED_COVER.map(s=>byId.get(s.id).colliders[0]);
  for(let i=0;i<=3600;i++)for(const pose of map.traffic.poses(i*.025)){
   busSamples++;for(const c of coverColliders)assert.equal(busHitsBox(pose,c,.2),false,pose.id+' touches '+c.id+' at '+i*.025);
  }
  assert.equal(busSamples,14404);
 });
 check('original 35 demolition bits retain their meaning and four props append within the same 10 hex characters',()=>{
  assert.equal(groups.length,39);assert.deepEqual(groups.slice(0,35).map(g=>g.id),EXISTING_GROUP_IDS);
  groups.forEach((g,i)=>assert.equal(g.index,i));assert.deepEqual(groups.slice(35).map(g=>g.id),EXPECTED_COVER.map(s=>s.id));
  assert.equal(map.destruction.restore('0000000100',1),true,'existing Rotary_furniture bit');
  assert.equal(map.destruction.snapshot(),'0000000100');
  for(const g of groups)for(const node of g.nodes)assert.equal(node.visible,g.index!==24,g.id+' old bit isolation');
  for(const spec of EXPECTED_COVER)assert.ok(map.colliders.includes(byId.get(spec.id).colliders[0]),spec.id+' retained by old mask');
  map.destruction.reset();same(map.colliders,original.colliders,'old mask reset collision');same(map.mapShapes,original.shapes,'old mask reset radar');
 });
 check('each cover independently disappears from visible rays, collision and radar and restores in place',()=>{
  for(const spec of EXPECTED_COVER){
   const g=byId.get(spec.id),mask=maskFor([g.index]),pair=ray(spec,spec.style==='cabinet'?1.65:1.1);
   assert.equal(mask.length,10);assert.equal(map.destruction.restore(mask,2),true);assert.equal(map.destruction.snapshot(),mask);
   same(map.colliders,original.colliders.filter(c=>!g.colliders.includes(c)),spec.id+' removed collision');
   same(map.mapShapes,original.shapes.filter(s=>!g.shapes.includes(s)),spec.id+' removed radar');same(map.ramps,original.ramps,spec.id+' retains stairs');
   assert.equal(map.collision.blocked(spec.x,spec.z,.42,0),false,spec.id+' opened movement');
   assert.equal(rayClear(pair),true,spec.id+' opened collision ray');assert.equal(hits(pair,g.nodes).length,0,spec.id+' opened visible ray');
   for(const other of groups)for(const n of other.nodes){assert.equal(n.visible,other!==g,other.id+' independent visible');assert.equal(!!n.userData.busDebrisHidden,other===g,other.id+' game ray filter');}
   map.destruction.reset();same(map.colliders,original.colliders,spec.id+' reset collision');same(map.mapShapes,original.shapes,spec.id+' reset radar');
   assert.equal(map.destruction.snapshot(),'');assert.equal(rayClear(pair),false);assert.ok(hits(pair,g.nodes).length);
  }
 });
 check('all four cover bits reset together without removing existing architecture, floors or planting areas',()=>{
  const added=groups.slice(35),mask=maskFor(added.map(g=>g.index));assert.equal(mask,'0000000078');
  assert.equal(map.destruction.restore(mask,3),true);assert.equal(map.destruction.snapshot(),mask);
  const removedColliders=new Set(added.flatMap(g=>g.colliders)),removedShapes=new Set(added.flatMap(g=>g.shapes));
  same(map.colliders,original.colliders.filter(c=>!removedColliders.has(c)),'four removed colliders');
  same(map.mapShapes,original.shapes.filter(s=>!removedShapes.has(s)),'four removed shapes');same(map.ramps,original.ramps,'stairs preserved');
  for(const g of groups)for(const n of g.nodes)assert.equal(n.visible,g.index<35,g.id+' four-bit isolation');
  for(const p of A.plantPositions)assert.ok(nav.isWalkable(p.x,p.z,0));
  map.destruction.reset();same(map.colliders,original.colliders,'final collision');same(map.mapShapes,original.shapes,'final radar');same(map.ramps,original.ramps,'final stairs');
  for(const g of groups)for(const n of g.nodes){assert.equal(n.visible,true);assert.ok(!n.userData.busDebrisHidden);}
 });
 console.log(JSON.stringify({checks,coverProps:EXPECTED_COVER.length,routeCount,routeLengths,busSamples,damageGroups:groups.length,maskCharacters:10,scope:'Node real Three geometry/collision/navigation/destruction only; no browser, audio, match balance or runtime plant/defuse claims',audioPlayed:false}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
