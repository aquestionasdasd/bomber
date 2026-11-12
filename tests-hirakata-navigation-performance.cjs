const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 let source=fs.readFileSync(path.join(__dirname,'public/navigation.js'),'utf8')+'\nexport {createGridNavigation};';
 source=source.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_m,_q,spec)=>'from '+JSON.stringify(pathToFileURL(path.join(__dirname,'public',spec)).href));
 const [{createGridNavigation},{createHirakataNavigation},{createCollisionIndex}]=await Promise.all([import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),load('hirakata-navigation.js'),load('collision.js')]);
 function fixture(closed=false){
  const poses=[],colliders=closed?[{minX:-20,maxX:20,minZ:2,maxZ:8,height:3},{minX:-20,maxX:20,minZ:-8,maxZ:-2,height:3}]:[];
  const solid=createCollisionIndex(colliders),map={id:'hirakata',bounds:{minX:-20,maxX:20,minZ:-8,maxZ:8},colliders,collision:solid,ramps:[],walkHeights:()=>[0],traffic:{poses:()=>poses}};
  let walkCalls=0,groundCalls=0;map.walkHeights=()=>{walkCalls++;return[0];};const grids=[];
  const nav=createHirakataNavigation(map,m=>{grids.push(m.collision);const grid=createGridNavigation(m);return{...grid,path(...args){groundCalls++;return grid.path(...args);}};});
  nav.updateTraffic(0);return{nav,map,poses,grids,get walkCalls(){return walkCalls;},get groundCalls(){return groundCalls;}};
 }
 function validate(nav,from,points){assert.ok(points.length,'route missing');for(const p of points){assert.ok(nav.clearSegment(from.x,from.z,p.x,p.z,from.y||0,p.y||0),'blocked route edge');from=p;}assert.equal(from.x,15);assert.equal(from.z,0);}
 {
  const f=fixture(),from={x:-15,z:0,y:0},consumed=f.nav.path(-15,0,15,0);validate(f.nav,from,consumed);
  consumed[0].x=999;consumed.splice(0);
  validate(f.nav,from,f.nav.path(-15,0,15,0));
  assert.equal(f.grids.length,1);assert.equal(f.grids[0],f.map.collision,'static grid must not depend on bus revision');
  assert.ok(f.walkCalls<10,'flat continuous-clear route should not sample every .13 m');
  const calls=f.groundCalls;
  for(let i=1;i<=12;i++){f.poses.splice(0,f.poses.length,{id:'far',x:-12+i*.2,z:7,yaw:Math.PI/2,speed:0});f.nav.updateTraffic(i*.3);const a={x:-15+i*.05,z:0,y:0};validate(f.nav,a,f.nav.path(a.x,a.z,15,0));}
  const advanced={x:8,z:0,y:0},suffix=f.nav.path(8,0,15,0);validate(f.nav,advanced,suffix);assert.ok(suffix.every(p=>p.x>=8),'a reused route must not send a progressed actor back to its old start');
  assert.equal(f.groundCalls,calls,'nearby ground pursuits must reuse validated finished routes across unrelated bus motion');
  f.poses.splice(0,1,{id:'blocking',x:0,z:0,yaw:Math.PI/2,speed:0});f.nav.updateTraffic(4);
  assert.equal(f.nav.clearSegment(-15,0,15,0),false,'a bus between free endpoints must block the complete segment');
  const detour=f.nav.path(-15,0,15,0);validate(f.nav,from,detour);assert.ok(detour.some(p=>Math.abs(p.z)>2),'open ground must route around bus');assert.equal(f.grids.length,2,'traffic detour grid is created only after real obstruction');
  f.poses.length=0;f.nav.updateTraffic(4.3);validate(f.nav,from,f.nav.path(-15,0,15,0));assert.equal(f.nav.clearSegment(-15,0,15,0),true);
  f.map.colliders.push({minX:-.02,maxX:.02,minZ:-8,maxZ:8,height:3});f.map.collision.invalidate();assert.equal(f.nav.path(-15,0,15,0).length,0,'new thin wall must invalidate finished ground route');
  f.map.colliders.pop();f.map.collision.invalidate();validate(f.nav,from,f.nav.path(-15,0,15,0));
 }
 console.log('PASS flat fast path, continuous bus footprint, static cache lifetime, ground pursuit reuse, bus detour and structure invalidation');
 {
  const f=fixture(true),from={x:-15,z:0,y:0};validate(f.nav,from,f.nav.path(-15,0,15,0));
  f.poses.push({id:'blocking',x:0,z:0,yaw:Math.PI/2,speed:0});f.nav.updateTraffic(.3);
  assert.equal(f.nav.path(-15,0,15,0).length,0,'full corridor obstruction must reject, not cross the bus');
  f.poses.length=0;f.nav.updateTraffic(.6);validate(f.nav,from,f.nav.path(-15,0,15,0));
 }
 console.log('PASS bus blocks narrow corridor and route recovers when bus leaves');
 {
  const f=fixture();f.map.colliders.push({minX:-1,maxX:1,minZ:-3,maxZ:3,height:3});f.map.collision.invalidate();
  const route=f.nav.path(-15,0,15,0);assert.ok(route.length>=3,'corner fixture needs two visible bends');validate(f.nav,{x:-15,z:0,y:0},route);
  const p=route[0],q=route[1],at={x:p.x+(q.x-p.x)*.75,z:p.z+(q.z-p.z)*.75,y:0},calls=f.groundCalls;
  const suffix=f.nav.path(at.x,at.z,15,0);validate(f.nav,at,suffix);
  assert.equal(f.groundCalls,calls,'progress beyond a corner should reuse the suffix without grid exploration');
  assert.ok(!suffix.some(v=>Math.hypot(v.x-p.x,v.z-p.z)<.01),'consumed corner must not reappear in the suffix');
 }
 console.log('PASS route suffix follows progress beyond corners without returning consumed waypoints');
 console.log('PASS 3 deterministic performance/collision groups; no wall-clock pass threshold, browser or audio');
})().catch(error=>{console.error(error);process.exitCode=1;});
