const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');

(async()=>{
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 const [{createHirakataNavigation},{createCollisionIndex,rampHeight}]=await Promise.all([load('hirakata-navigation.js'),load('collision.js')]);
 // Keep the shipped support sampler as an independent differential control:
 // disable only the new shortcut in memory, without changing collision rules.
 let source=fs.readFileSync(path.join(__dirname,'public/hirakata-navigation.js'),'utf8');
 const shortcut='if(ay===by&&ay>0&&solid.query';
 assert.equal(source.split(shortcut).length,2,'one upper slab shortcut must be present');
 source=source.replace(shortcut,'if(false&&ay===by&&ay>0&&solid.query');
 source=source.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_m,_q,spec)=>'from '+JSON.stringify(pathToFileURL(path.join(__dirname,'public',spec)).href));
 const {createHirakataNavigation:createSampled}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const slab=(minX=-20,maxX=20,minZ=-4,maxZ=4,height=6.4)=>({minX,maxX,minZ,maxZ,base:height-.35,height,kind:'surface'});
 function fixture(factory,{colliders=[slab()],ramps=[],poses=[]}={}){
  const geometry=structuredClone({colliders,ramps}),solid=createCollisionIndex(geometry.colliders),trafficPoses=structuredClone(poses);let walkCalls=0;
  const map={id:'hirakata',bounds:{minX:-30,maxX:30,minZ:-20,maxZ:20},world:{userData:{}},...geometry,collision:solid,traffic:{poses:()=>trafficPoses},
   walkHeights(x,z){walkCalls++;const ys=[0];for(const c of solid.query(x,z,0))if(!c.disabled&&['surface','stairs'].includes(c.kind)&&solid.overlaps(c,x,z,0)){const y=c.movementRamp?rampHeight(c.movementRamp,x,z):c.height;if(!ys.includes(y))ys.push(y);}return ys;}};
  const nav=factory(map);nav.updateTraffic(0);return{map,nav,poses:trafficPoses,get walkCalls(){return walkCalls;}};
 }
 const pair=options=>[fixture(createHirakataNavigation,options),fixture(createSampled,options)];
 const segment=(f,a=[-18,0,18,0,6.4,6.4])=>f.nav.clearSegment(...a);
 function same(fixtures,args,wanted,label){const result=fixtures.map(f=>segment(f,args));assert.equal(result[0],result[1],label+' matches support sampler');assert.equal(result[0],wanted,label);}
 let groups=0;const check=(name,fn)=>{fn();groups++;console.log('PASS '+name);};
 check('long supported upper slab uses endpoint support queries, preserving sampled result',()=>{
  const both=pair();same(both,undefined,true,'clear elevated deck');
  assert.ok(both[1].walkCalls>=250,'control must really sample the 36 m route');
  assert.equal(both[0].walkCalls,2,'single convex slab needs only two endpoint support queries');
  const before=both[0].walkCalls;assert.equal(segment(both[0]),true);assert.equal(both[0].walkCalls,before,'cached trace remains reusable');
  same(both,[-17,-3,17,3,6.4,6.4],true,'diagonal deck route');
 });
 check('thin railing and upper-floor radius keep continuous solid stopping',()=>{
  const rail={minX:.031,maxX:.039,minZ:-4,maxZ:4,base:6.4,height:7.5,kind:'railing'};
  same(pair({colliders:[slab(),rail]}),undefined,false,'8 mm rail between free endpoints');
  for(const gap of[.78,.9]){
   const colliders=[slab(),{minX:-4,maxX:-gap/2,minZ:-.01,maxZ:.01,base:6.4,height:8},{minX:gap/2,maxX:4,minZ:-.01,maxZ:.01,base:6.4,height:8}];
   same(pair({colliders}),[0,-3,0,3,6.4,6.4],gap===.9,'upper gate '+gap+' m');
  }
 });
 check('separate slabs and concave or holed floors never invent support',()=>{
  same(pair({colliders:[slab(-20,-1),slab(1,20)]}),undefined,false,'two-metre unsupported gap');
  const polygon=[[-20,-4],[20,-4],[20,4],[1,4],[1,-1],[-1,-1],[-1,4],[-20,4]];
  same(pair({colliders:[{...slab(),polygon}]}),undefined,false,'concave notch within bounding rectangle');
  const outer=[[-20,-4],[20,-4],[20,4],[-20,4]],hole=[[-1,-2],[1,-2],[1,2],[-1,2]];
  same(pair({colliders:[{...slab(),polygon:outer,holes:[hole]}]}),undefined,false,'polygon hole');
  const joined=pair({colliders:[slab(-20,0),slab(0,20)]});same(joined,undefined,true,'touching separate slabs');
  assert.ok(joined[0].walkCalls>250,'multi-slab segment must retain the support trace');
  const rectanglePolygon=pair({colliders:[{...slab(),polygon:outer}]});same(rectanglePolygon,undefined,true,'rectangular polygon still uses fallback');
  assert.ok(rectanglePolygon[0].walkCalls>250,'polygon shortcut is deliberately excluded');
 });
 check('head clearance is measured from the actual upper floor',()=>{
  for(const base of[7.95,8.2]){
   const canopy={minX:-1,maxX:1,minZ:-4,maxZ:4,base,height:base+.2,kind:'roof'};
   same(pair({colliders:[slab(),canopy]}),undefined,base===8.2,'canopy underside '+base);
  }
  const both=pair();same(both,[-18,0,18,0,6.42,6.42],true,'near-floor tolerance remains sampled');
  assert.ok(both[0].walkCalls>250,'nearby but unequal slab height cannot certify exact-height support');
 });
 check('disabled, replaced and globally collapsed structures invalidate cached support',()=>{
  const both=pair();same(both,undefined,true,'initial support');
  for(const f of both){f.map.colliders[0].disabled=true;f.map.collision.invalidate();}
  same(both,undefined,false,'disabled support');
  for(const f of both){f.map.colliders[0].disabled=false;f.map.collision.invalidate();}
  same(both,undefined,true,'restored support');
  for(const f of both){f.map.colliders.splice(0,1,slab(-20,-1),slab(1,20));f.map.collision.invalidate();}
  same(both,undefined,false,'replacement introduces a gap');
  for(const f of both){f.map.colliders.splice(0,2,slab());f.map.collision.invalidate();}
  same(both,undefined,true,'replacement restores support');
  for(const f of both)f.map.world.userData.bomberCollapsed=true;
  same(both,undefined,false,'global collapse');
  for(const f of both)f.map.world.userData.bomberCollapsed=false;
  same(both,undefined,true,'global restore');
 });
 check('real ramps and different-height transitions retain supported tracing',()=>{
  const ramp={minX:-10,maxX:4,minZ:-2,maxZ:2,axis:'x',base:0,height:6.4,direction:1};
  const both=pair({colliders:[slab(4,20),{...ramp,kind:'stairs',movementRamp:ramp}],ramps:[ramp]});
  same(both,[-12,0,18,0,0,6.4],true,'ground to ramp to upper floor');
  same(both,[18,0,-12,0,6.4,0],true,'upper floor to ramp to ground');
  same(both,[18,0,18,0,0,6.4],false,'same XZ cannot change storeys');
  const isolated=pair({colliders:[slab(4,20)]});same(isolated,[-12,0,18,0,0,6.4],false,'missing ramp cannot be skipped');
 });
 check('moving buses use continuous collision at each profile floor height',()=>{
  for(const height of[2.5,6.4]){
   const both=pair({colliders:[slab(-20,20,-4,4,height)]}),args=[-18,0,18,0,height,height];
   same(both,args,true,'empty traffic at '+height);
   for(const f of both){f.poses.push({id:'bus',x:0,z:0,yaw:Math.PI/2,speed:0});f.nav.updateTraffic(.3);assert.equal(f.nav.isWalkable(-18,0,height),true);assert.equal(f.nav.isWalkable(18,0,height),true);}
   same(both,args,height===6.4,'bus between free endpoints at '+height);
   for(const f of both){f.poses[0].z=12;f.nav.updateTraffic(.6);}
   same(both,args,true,'bus moved clear at '+height);
  }
 });
 console.log('PASS '+groups+' upper slab support/collision groups; deterministic call counts, no wall-clock threshold, browser or audio');
})().catch(error=>{console.error(error);process.exitCode=1;});
