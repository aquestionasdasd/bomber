// Hirakata CPU routing from the T-SITE deck spawn, and the grid/traffic caches
// behind it. Real saved game and map in the timer/audio/WebGL-inert VM harness;
// deterministic route shapes and call counts, no wall-clock thresholds.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{pathToFileURL}=require('node:url');

async function main(){
 const fixture=fs.readFileSync(path.join(__dirname,'tests-round-preparation-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'hirakata-deck-routes-fixture.cjs'),module);mod.filename=path.join(__dirname,'hirakata-deck-routes-fixture.cjs');mod.paths=Module._nodeModulePaths(__dirname);
 mod._compile(fixture.slice(0,cut)+'\nreturn {harness,copy};\n}\nmodule.exports=main;',mod.filename);
 const{harness,copy}=await mod.exports();
 let groups=0;const check=async(name,fn)=>{await fn();groups++;console.log('PASS '+name);};
 const world=()=>{const w=harness({realMap:true});w.reset();w.run(`online=null;onlinePlaying=false;mode='menu';$('map-select').value='hirakata';$('starting-side').value='attack';startGame();`);return w;};
 const length=(from,points)=>{let total=0,p=from;for(const q of points){total+=Math.hypot(q.x-p.x,(q.y||0)-(p.y||0),q.z-p.z);p=q;}return total;};
 function routes(w){
  return copy(w.run(`(()=>{const goals=map.sites.flatMap(s=>s.plantPositions.map(p=>({site:s.id,x:p.x,z:p.z,y:p.y??s.y??0})));
   return map.teamSpawns.attack.flatMap(a=>goals.map(g=>({from:a,goal:g,points:navigation.path(a.x,a.z,g.x,g.z,a.y,g.y)})));})()`));
 }
 const w=world();
 await check('every attack slot reaches every plant spot down the adjacent deck stair, never via the far park bridge',()=>{
  for(const r of routes(w)){
   assert.ok(r.points.length,'route exists '+JSON.stringify(r.goal));
   const end=r.points.at(-1);assert.ok(Math.hypot(end.x-r.goal.x,end.z-r.goal.z,(end.y||0)-r.goal.y)<.05,'exact plant spot');
   assert.ok(r.points.every(p=>p.z<95),'no detour south past the stair foot: '+JSON.stringify(r.points.map(p=>[p.x,p.y,p.z])));
   const metres=length(r.from,r.points);
   assert.ok(r.goal.site==='A'?metres<130:metres<235,`${r.goal.site} route length ${metres.toFixed(1)}`);
   // The first descent uses South_pedestrian_deck stair 7 (x13.8..16.2, z74..90).
   const descent=r.points.findIndex(p=>(p.y||0)<.05);assert.ok(descent>0);
   const foot=r.points[descent];assert.ok(foot.x>11&&foot.x<18&&foot.z>86&&foot.z<93,'ground reached at stair 7 foot '+JSON.stringify(foot));
  }
 });
 await check('upper-to-upper requests across the deck gap transfer through the street instead of exhausting the mixed search',()=>{
  const r=copy(w.run(`(()=>{const out=[];for(const [a,b] of [[[-20,6.4,0],[8,6.4,76]],[[8,6.4,30],[35,6.4,6]],[[0,6.4,20],[35,6.4,6]]])out.push({a,b,points:navigation.path(a[0],a[2],b[0],b[2],a[1],b[1])});return out;})()`));
  for(const {a,b,points} of r){
   assert.ok(points.length,'route found '+JSON.stringify([a,b]));const end=points.at(-1);
   assert.ok(Math.hypot(end.x-b[0],end.z-b[2],(end.y||0)-b[1])<.05);
   let prev={x:a[0],y:a[1],z:a[2]};for(const p of points){w.sandbox.S=[prev.x,prev.z,p.x,p.z,prev.y||0,p.y||0];assert.equal(w.run('navigation.clearSegment(...S)'),true,'validated edge');prev=p;}
  }
 });
 await check('a body standing on a stair foot still gets a ground route (no 64-ring connector scan, no mixed fallback)',()=>{
  const r=copy(w.run(`navigation.path(14,90.4,6.1,84.5,0,0)`));
  assert.ok(r.length>=1);const end=r.at(-1);assert.ok(Math.hypot(end.x-6.1,end.z-84.5)<.01);assert.ok(r.every(p=>(p.y||0)===0),'stays on ground');
 });
 await check('negative: restoring the old whole-deck park-bridge hint reproduces the southern detour (memory only)',()=>{
  const bad=world();bad.run(`map.navigationStairHints.forEach(h=>{if(h.rampId==='South_pedestrian_deck stair 7'){h.rampId='Curved_park_bridge stair 8';h.via=[{x:8.5,z:99.5,y:6.4},{x:10.5,z:103.5,y:6.4},{x:14.5,z:104.5,y:6.4},{x:21.5,z:109.5,y:6.4},{x:22.5,z:114.5,y:6.4},{x:19.5,z:118.5,y:6.4},{x:1.5,z:119.5,y:6.4},{x:-2,z:121,y:6.4}];}})`);
  assert.ok(routes(bad).some(r=>r.points.some(p=>p.z>=95)),'old hint must fail the detour check');
 });

 const load=f=>pathToFileURL(path.join(__dirname,'public',f)).href;
 let source=fs.readFileSync(path.join(__dirname,'public/navigation.js'),'utf8')+'\nexport {createGridNavigation};';
 source=source.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_m,_q,spec)=>'from '+JSON.stringify(load(spec)));
 const [{createGridNavigation},{createCollisionIndex}]=await Promise.all([import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),import(load('collision.js'))]);
 await check('flat maps reject an unvalidated stair-foot connector, with a memory-only missing-guard negative control',async()=>{
  function fixture(createGrid,layeredNavigation){
   const ramp={minX:-.5,maxX:.5,minZ:0,maxZ:4,axis:'z',direction:1,base:0,height:1};
   const colliders=[{...ramp,movementRamp:ramp}],collision=createCollisionIndex(colliders);
   return createGrid({bounds:{minX:-4,maxX:4,minZ:-4,maxZ:6},colliders,collision,ramps:[ramp],layeredNavigation});
  }
  const rejects=nav=>{
   assert.equal(nav.isWalkable(0,0),true,'fixture body can stand at the ramp foot');
   assert.equal(nav.clearSegment(0,0,3,-3),false,'the grid has no strict connector out of the tread');
   assert.deepEqual(nav.path(0,0,3,-3),[],'flat maps must not return an unvalidated connector');
   assert.deepEqual(nav.path(3,0,3,-3),[{x:3,z:-3}],'ordinary flat route remains usable');
  };
  for(const flag of [undefined,false,'true'])rejects(fixture(createGridNavigation,flag));
  const guard='if (start < 0 && map.layeredNavigation === true)';
  assert.equal(source.split(guard).length,2,'negative control removes exactly one capability guard');
  const damaged=source.replace(guard,'if (start < 0)');
  const mutant=await import('data:text/javascript;base64,'+Buffer.from(damaged).toString('base64'));
  const bad=fixture(mutant.createGridNavigation,undefined),points=bad.path(0,0,3,-3);
  assert.ok(points.length,'guard removal reproduces the unsafe route');
  assert.equal(bad.clearSegment(0,0,points[0].x,points[0].z),false,'first segment is the rejected tread connector');
  assert.throws(()=>rejects(bad),/flat maps must not return an unvalidated connector/);
 });
 function grid(extra={}){
  const colliders=[{minX:-2,maxX:2,minZ:-10,maxZ:6,height:3},{minX:6,maxX:7,minZ:-4,maxZ:12,height:3}];let calls=0;
  const real=createCollisionIndex(colliders),collision={...real,blocked:(...a)=>real.blocked(...a),segmentClear:(...a)=>{calls++;return real.segmentClear(...a);},get revision(){return real.revision;}};
  const map={bounds:{minX:-15,maxX:15,minZ:-15,maxZ:15},collision,...extra};
  return {nav:createGridNavigation(map),map,get calls(){return calls;}};
 }
 await check('repeated destinations use an exact distance field within smoothing tolerance of fresh A*',()=>{
  const a=grid({navigationFields:true}),b=grid();
  const starts=[[-10,-12],[-12,0],[-9,11],[12,-12],[10,10],[-5,13]];
  for(const [x,z] of starts){
   const p1=a.nav.path(x,z,10,0);a.nav.path(x+.3,z,10,0);const p2=a.nav.path(x,z,10,0);
   const fresh=b.nav.path(x,z,10,0);b.nav.warm();
   assert.ok(p2.length&&fresh.length);
   const L=(pts)=>length({x,z,y:0},pts);
   // Both are exact shortest grid routes; only equal-cost tie-breaks (and so
   // the greedy corner smoothing) may differ slightly.
   assert.ok(L(p2)<=L(fresh)*1.05+1e-6,`field ${L(p2)} vs A* ${L(fresh)}`);
   assert.ok(L(p1)<=L(fresh)*1.05+1e-6,'earlier request also within tolerance');
  }
 });
 await check('warm resolves each undirected edge once and later routes add no swept tests',()=>{
  const g=grid();g.nav.warm();const after=g.calls;
  for(let i=0;i<8;i++)g.nav.path(-12+i,-12,12,12-i);
  const extra=g.calls-after;
  // Only the final smoothing probes remain; no per-cell edge discovery.
  const h=grid();for(let i=0;i<8;i++)h.nav.path(-12+i,-12,12,12-i);
  assert.ok(extra<h.calls/3,`warm grid ${extra} swept tests vs cold ${h.calls}`);
 });
 await check('bus overlay grid shares static edges and only re-checks the bus when traffic moves',()=>{
  const base=grid();base.nav.warm();
  let rev=0,bus=null;const overlay={blocked:(x,z,r)=>!!bus&&Math.abs(x-bus.x)<bus.w+r&&Math.abs(z-bus.z)<bus.d+r,segmentClear:(ax,az,bx,bz,r)=>{if(!bus)return true;for(let t=0;t<=1;t+=.05){const x=ax+(bx-ax)*t,z=az+(bz-az)*t;if(Math.abs(x-bus.x)<bus.w+r&&Math.abs(z-bus.z)<bus.d+r)return false;}return true;},get revision(){return rev;}};
  const det=createGridNavigation({...base.map,navigationOverlay:overlay,sharedGrid:base.nav.shared});
  const before=base.calls;
  assert.ok(det.path(-12,8,12,8).length);
  bus={x:0,z:8,w:3,d:1.65};rev++;
  const around=det.path(-12,8,12,8);assert.ok(around.length&&around.some(p=>Math.abs(p.z-8)>2),'routes around the bus');
  bus={x:0,z:9,w:3,d:1.65};rev++;assert.ok(det.path(-12,8,12,8).length);
  const shared=base.calls-before;
  // Former behaviour: a separate grid over static+bus collision, rebuilt on each bus revision.
  const old=grid();let oldRev=0;bus=null;
  const combined=()=>({blocked:(x,z,r,f)=>old.map.collision.blocked(x,z,r,f)||overlay.blocked(x,z,r,f),segmentClear:(...a)=>old.map.collision.segmentClear(...a)&&overlay.segmentClear(...a),get revision(){return oldRev;}});
  const legacy=createGridNavigation({...old.map,collision:combined()});
  legacy.path(-12,8,12,8);bus={x:0,z:8,w:3,d:1.65};oldRev++;legacy.path(-12,8,12,8);bus={x:0,z:9,w:3,d:1.65};oldRev++;legacy.path(-12,8,12,8);
  assert.ok(shared*3<old.calls,`shared static grid ${shared} swept tests vs rebuilt detour grid ${old.calls}`);
  assert.equal(det.clearSegment(-12,9,12,9),false,'overlay still blocks a straight segment through the bus');
 });
 await check('buy-phase prewarm only fills navigation caches on layered maps',()=>{
  const game=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8'),body=game.slice(game.indexOf('function prewarmBotRoutes(){'),game.indexOf('function updateBots(dt){'));
  assert.ok(body.length>100);assert.ok(/navigation\.path\(/.test(body));
  for(const banned of ['bot.','player.','match.phase=','.x=','.z=','sound(','online.'])assert.ok(!body.includes(banned),'no '+banned);
  assert.ok(game.includes("if(!isGuest()&&match?.phase==='buy'&&map.layeredNavigation)prewarmBotRoutes();"));
  const v=world();v.run(`clearCombatInput();var before=JSON.stringify([player,...bots].map(a=>[a.x,a.y,a.z]));for(let i=0;i<300;i++)updatePlay(1/60);`);
  assert.equal(v.run('match.phase'),'buy');assert.equal(v.run('prewarmBotRoutes.state.queue.length'),0,'queue consumed during buy');
  assert.equal(v.run('JSON.stringify(bots.map(a=>[a.x,a.y,a.z]))'),v.run('JSON.stringify(JSON.parse(before).slice(1))'),'CPU bodies unchanged by prewarm');
 });
 console.log(JSON.stringify({groups,audio:false,browser:false,scope:'real Hirakata map VM + grid fixtures; deterministic shapes/counts, no wall-clock thresholds'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
