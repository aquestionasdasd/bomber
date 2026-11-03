const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 const [{createNavigation},{createCollisionIndex,rampHeight},{createTrafficClock,ovalRoute}]=await Promise.all([load('navigation.js'),load('collision.js'),load('bus-traffic.js')]);
 // Force an interrupted search without changing the shipped exploration budget.
 const memoryModule=async(file,transform)=>{
  let source=transform(fs.readFileSync(path.join(__dirname,'public',file),'utf8'));
  source=source.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_match,_quote,spec)=>'from '+JSON.stringify(pathToFileURL(path.join(__dirname,'public',spec)).href));
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 };
 const [{createHirakataNavigation:budgetNavigation},{createGridNavigation}]=await Promise.all([
  memoryModule('hirakata-navigation.js',source=>{
   const budget='const budget={left:2048};';assert.equal(source.split(budget).length,2,'test injection must match one path-call budget');
   return source.replace(budget,'const budget={left:globalThis.__hirakataTestBudget??2048};');
  }),
  memoryModule('navigation.js',source=>source+'\nexport {createGridNavigation};')
 ]);
 let n=0;const check=(name,fn)=>{fn();console.log('PASS '+name);n++;};
 function fixture({ramp=true,traffic=null}={}){
  const ramps=ramp?[{minX:-10,maxX:4,minZ:-2,maxZ:2,axis:'x',base:0,height:6,direction:1}]:[];
  const colliders=[{minX:4,maxX:12,minZ:-3,maxZ:3,base:5.7,height:6}];
  if(ramp)colliders.push({...ramps[0],movementRamp:ramps[0]});
  const map={id:'hirakata',layeredNavigation:true,bounds:{minX:-15,maxX:15,minZ:-10,maxZ:10},colliders,ramps,traffic,
   walkHeights(x,z){const values=[0];if(x>=4&&x<=12&&Math.abs(z)<=3)values.push(6);for(const r of ramps)if(x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ)values.push(rampHeight(r,x,z));return values;}};
  map.collision=createCollisionIndex(colliders);return{map,nav:createNavigation(map)};
 }
 function validate(nav,from,points){assert.ok(points.length,'route missing');for(const p of points){assert.ok(nav.clearSegment(from.x,from.z,p.x,p.z,from.y,p.y),'unsupported route edge '+JSON.stringify({from,p}));from=p;}return from;}
 check('lazy graph and true ramp connect ground to upper floor in both directions',()=>{
  const{nav}=fixture();assert.equal(nav.layered,true);assert.equal(nav.nodeCount,0);
  const a={x:-12,z:0,y:0},b={x:10,z:0,y:6};
  assert.deepEqual(validate(nav,a,nav.path(a.x,a.z,b.x,b.z,a.y,b.y)),b);
  assert.deepEqual(validate(nav,b,nav.path(b.x,b.z,a.x,a.z,b.y,a.y)),a);
 });
 check('same XZ is not a lift; upper-to-lower route actually reaches the staircase',()=>{
  const{nav}=fixture();assert.equal(nav.clearSegment(10,0,10,0,0,6),false);
  const route=nav.path(10,0,10,0,6,0);validate(nav,{x:10,z:0,y:6},route);
  assert.ok(route.some(p=>p.x<-9),'route must reach stair foot');
 });
 check('isolated upper deck is unreachable without a ramp, and unsupported ledges reject',()=>{
  const{nav}=fixture({ramp:false});assert.equal(nav.path(-12,0,10,0,0,6).length,0);
  assert.equal(nav.clearSegment(10,0,13,0,6,6),false);assert.equal(nav.isWalkable(14.8,0,0),false);
 });
 check('static collision invalidates paths; thin rails and fresh closed walls cannot be skipped',()=>{
  const{nav,map}=fixture({ramp:false});validate(nav,{x:-12,z:5,y:0},nav.path(-12,5,12,5));
  map.colliders.push({minX:-.02,maxX:.02,minZ:-10,maxZ:10,base:0,height:20});map.collision.invalidate();
  assert.equal(nav.clearSegment(-12,5,12,5,0,0),false);assert.equal(nav.path(-12,5,12,5).length,0);
  map.colliders.pop();map.collision.invalidate();validate(nav,{x:-12,z:5,y:0},nav.path(-12,5,12,5));
  const layered=fixture(),ramp=layered.map.ramps[0],tread=layered.map.colliders[1];
  validate(layered.nav,{x:-12,z:0,y:0},layered.nav.path(-12,0,10,0,0,6));
  layered.map.ramps.splice(0);layered.map.colliders.splice(1);layered.map.collision.invalidate();
  assert.equal(layered.nav.path(-12,0,10,0,0,6).length,0,'destroyed stair cannot retain its cached route');
  layered.map.ramps.push(ramp);layered.map.colliders.push(tread);layered.map.collision.invalidate();
  validate(layered.nav,{x:-12,z:0,y:0},layered.nav.path(-12,0,10,0,0,6));
  const retry=budgetNavigation(fixture().map,createGridNavigation);
  try{
   globalThis.__hirakataTestBudget=1;
   assert.equal(retry.path(10,0,10,0,6,0).length,0,'one-node shared budget must interrupt the stair search');
   delete globalThis.__hirakataTestBudget;
   validate(retry,{x:10,z:0,y:6},retry.path(10,0,10,0,6,0));
  }finally{delete globalThis.__hirakataTestBudget;}
 });
 check('bus overlay blocks ground and clears after movement while upper deck remains usable',()=>{
  const poses=[{id:'bus',x:8,z:0,yaw:0,speed:0}],{nav}=fixture({traffic:{poses:()=>poses}});nav.updateTraffic(0);
  assert.equal(nav.isWalkable(8,0,0),false);assert.equal(nav.isWalkable(8,0,6),true);
  assert.ok(nav.clearSegment(5,0,11,0,6,6));assert.equal(nav.trafficStep(5,0,8,0,0),false);assert.equal(nav.trafficStep(5,0,8,0,6),true);assert.equal(nav.trafficEscape(8,0,6),null);
  poses[0]={...poses[0],x:-12,z:8};nav.updateTraffic(.3);assert.equal(nav.isWalkable(8,0,0),true);assert.ok(nav.clearSegment(5,0,11,0,0,0));
 });
 check('radius stays .42: .78m gates reject; a real .9m outer opening remains usable',()=>{
  for(const gap of[.78,.9]){const{map,nav}=fixture({ramp:false});map.colliders.push({minX:-2,maxX:-gap/2,minZ:-1,maxZ:1,height:3},{minX:gap/2,maxX:2,minZ:-1,maxZ:1,height:3});map.collision.invalidate();assert.equal(nav.clearSegment(0,-4,0,4),gap===.9);}
 });
 check('extended vehicle bounds preserve default rejects and atomic out-of-map rollback',()=>{
  const routes=[{id:'south-1',points:ovalRoute(0,140,15,10),offset:0},{id:'north-1',points:ovalRoute(0,-90,15,10),offset:0}];
  const bounds={minX:-98,maxX:98,minZ:-123,maxZ:183},t=createTrafficClock(routes,{bounds}),legacy=createTrafficClock(routes);
  const row=[0,0,-1,0,15,140,0,0,[]];assert.equal(t.service.restore([row],[],0),true);assert.equal(legacy.service.restore([row],[],0),false);
  const saved=t.service.snapshot([]);for(const bad of[[99,140],[0,184],[0,-124],[NaN,0]]){const value=[...row];value[4]=bad[0];value[5]=bad[1];assert.equal(t.service.restore([value],[],0),false);assert.deepEqual(t.service.snapshot([]),saved);}
  assert.equal(t.poses(0).length,2);assert.throws(()=>createTrafficClock(routes,{bounds:{minX:0,maxX:0,minZ:0,maxZ:1}}),RangeError);
 });
 console.log('PASS '+n+' Hirakata layered-navigation and vehicle-bound groups; silent numerical fixtures, not live browser gameplay');
})().catch(error=>{console.error(error);process.exitCode=1;});
