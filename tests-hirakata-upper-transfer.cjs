const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const memoryModule=async(file,transform)=>{
  let source=transform(fs.readFileSync(path.join(__dirname,'public',file),'utf8'));
  source=source.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_m,_q,spec)=>'from '+JSON.stringify(pathToFileURL(path.join(__dirname,'public',spec)).href));
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 };
 const [{createGridNavigation},{createHirakataNavigation},{createCollisionIndex,rampHeight}]=await Promise.all([
  memoryModule('navigation.js',s=>s+'\nexport {createGridNavigation};'),
  memoryModule('hirakata-navigation.js',s=>{
   const marker='return {path,nearest,isWalkable,clearSegment,layered:true,';assert.equal(s.split(marker).length,2);
   return s.replace(marker,`const probe={paths:[],searches:[],depth:0};
    const originalPath=path;path=function(...args){const row={args,depth:probe.depth++};probe.paths.push(row);try{const result=originalPath(...args);row.length=result.length;return result;}finally{probe.depth--;}};
    const originalSearch=search;search=function(start,finish,upperOnly,budget){const row={start:{...start},finish:{...finish},upperOnly:!!upperOnly,budgetBefore:budget.left};probe.searches.push(row);const result=originalSearch(start,finish,upperOnly,budget);row.budgetAfter=budget.left;row.length=result?.length??null;return result;};
    return {probe,path,nearest,isWalkable,clearSegment,layered:true,`);
  }),
  import(pathToFileURL(path.join(__dirname,'public/collision.js')).href)
 ]);
 const slab=(minX,maxX)=>({minX,maxX,minZ:-6,maxZ:6,base:6.05,height:6.4,kind:'surface'});
 const hint=(minX,maxX,rampId,x)=>({minX,maxX,minZ:-6,maxZ:6,minY:6,maxY:7,rampId,via:[{x,z:6,y:6.4}]});
 const from={x:-8,z:0,y:6.4},to={x:8,z:0,y:6.4};
 function fixture({connected=false,obstacle=false,sameHint=false,blockedTransfer=false}={}){
  const ramps=[-8,8].map((x,i)=>({id:'stair-'+i,minX:x-1,maxX:x+1,minZ:6,maxZ:22,axis:'z',direction:-1,base:0,height:6.4}));
  const colliders=[...(connected?[slab(-12,12)]:[slab(-12,-4),slab(4,12)]),...ramps.map(r=>({...r,kind:'stairs',movementRamp:r}))];
  if(obstacle)colliders.push({minX:-1,maxX:1,minZ:-1,maxZ:1,base:6.4,height:8.4,kind:'cover'});
  if(blockedTransfer)for(const r of ramps)colliders.push({minX:r.minX-.5,maxX:r.maxX+.5,minZ:10,maxZ:11,base:0,height:8.5,kind:'closed-stair'});
  const poses=[],collision=createCollisionIndex(colliders),map={id:'hirakata',bounds:{minX:-20,maxX:20,minZ:-15,maxZ:30},world:{userData:{}},colliders,ramps,collision,traffic:{poses:()=>poses},
   navigationStairHints:[hint(-12,-4,'stair-0',-8),hint(4,12,sameHint?'stair-0':'stair-1',sameHint?-8:8)],
   walkHeights(x,z){const ys=[0];for(const c of collision.query(x,z,0))if(!c.disabled&&['surface','stairs'].includes(c.kind)&&collision.overlaps(c,x,z,0)){const y=c.movementRamp?rampHeight(c.movementRamp,x,z):c.height;if(!ys.includes(y))ys.push(y);}return ys;}};
  const nav=createHirakataNavigation(map,createGridNavigation);nav.updateTraffic(0);return{map,nav,poses};
 }
 function route(f,a=from,b=to){return f.nav.path(a.x,a.z,b.x,b.z,a.y,b.y);}
 function validate(f,points,a=from,b=to){
  assert.ok(points.length,'route must exist');let previous=a;
  for(const p of points){assert.ok(f.nav.isWalkable(p.x,p.z,p.y),'waypoint must have actual support');assert.ok(f.nav.clearSegment(previous.x,previous.z,p.x,p.z,previous.y,p.y),'complete route edge must stay supported and clear');previous=p;}
  assert.ok(Math.hypot(previous.x-b.x,previous.z-b.z,previous.y-b.y)<.01,'exact supported destination');
 }
 function finite(f){
  assert.ok(f.nav.probe.paths.every(p=>p.depth<=1),'transfer recursion cannot re-enter itself');
  assert.ok(f.nav.probe.paths.filter(p=>p.depth===1).every(p=>(Math.abs(p.args[4])<.001)!==(Math.abs(p.args[5])<.001)),'recursive legs each have exactly one ground endpoint');
  assert.ok(f.nav.probe.searches.every(s=>s.budgetBefore<=2048&&s.budgetAfter>=-1),'each path keeps the existing finite node budget');
 }
 let groups=0;const check=(name,fn)=>{fn();groups++;console.log('PASS '+name);};
 check('distinct upper districts use validated down/ground/up legs before a mixed search',()=>{
  const f=fixture(),points=route(f);validate(f,points);
  assert.ok(points.some(p=>p.y===0),'transfer really descends to ground');
  assert.equal(f.nav.probe.paths.filter(p=>p.depth===1).length,2,'exactly two transfer legs');
  assert.ok(f.nav.probe.searches.every(s=>s.upperOnly),'successful authored transfer avoids the discarded mixed search');finite(f);
  points.splice(0);validate(f,route(f));finite(f);
 });
 check('direct upper connection still wins before different authored stair hints',()=>{
  const f=fixture({connected:true}),points=route(f);validate(f,points);
  assert.deepEqual(points,[to]);assert.equal(f.nav.probe.paths.length,1);assert.equal(f.nav.probe.searches.length,0);
 });
 check('same-hint upper detours keep the mixed upper route without a transfer',()=>{
  const f=fixture({connected:true,obstacle:true,sameHint:true}),points=route(f);validate(f,points);
  assert.ok(points.every(p=>p.y===6.4),'upper obstacle detour stays upstairs');
  assert.equal(f.nav.probe.paths.length,1);assert.ok(f.nav.probe.searches.some(s=>!s.upperOnly));finite(f);
 });
 check('failed authored transfer falls through to a viable mixed upper detour',()=>{
  const f=fixture({connected:true,obstacle:true,blockedTransfer:true}),points=route(f);validate(f,points);
  assert.ok(f.nav.probe.paths.some(p=>p.depth===1&&p.length===0),'a real supported transfer attempt must fail');
  assert.ok(f.nav.probe.searches.some(s=>!s.upperOnly&&s.length>0),'original mixed search still finds the alternate route');
  assert.ok(points.every(p=>p.y===6.4),'fallback uses existing upper connection');finite(f);
 });
 check('stair removal, restoration and global collapse invalidate retained upper transfers',()=>{
  const f=fixture();validate(f,route(f));const ramp=f.map.ramps[1],tread=f.map.colliders.find(c=>c.movementRamp===ramp);
  ramp.disabled=true;tread.disabled=true;f.map.collision.invalidate();assert.equal(route(f).length,0,'removed destination stair cannot reuse transfer');
  ramp.disabled=false;tread.disabled=false;f.map.collision.invalidate();validate(f,route(f));
  f.map.world.userData.bomberCollapsed=true;assert.equal(f.nav.isWalkable(from.x,from.z,from.y),false);assert.equal(f.nav.clearSegment(-8,0,-8,5,6.4,6.4),false,'collapsed upper support cannot retain trace');
  const collapsed=route(f);assert.ok(collapsed.every(p=>p.y===0),'nearest surviving floor cannot retain cached upper points');
  f.map.world.userData.bomberCollapsed=false;validate(f,route(f));finite(f);
 });
 check('traffic revision revalidates the transfer ground leg without blocking the upper floor',()=>{
  const f=fixture();validate(f,route(f));
  f.poses.push({id:'transfer-bus',x:0,z:22.5,yaw:Math.PI/2,speed:0});f.nav.updateTraffic(.3);
  assert.equal(f.nav.clearSegment(-8,22.5,8,22.5,0,0),false,'bus obstructs the straight ground crossing');
  validate(f,route(f));assert.equal(f.nav.isWalkable(from.x,from.z,from.y),true);
  f.poses.length=0;f.nav.updateTraffic(.6);validate(f,route(f));finite(f);
 });
 console.log('PASS '+groups+' upper transfer groups; routes may differ from prior mixed-search-first choices, no wall-clock threshold, browser or audio');
})().catch(error=>{console.error(error);process.exitCode=1;});
