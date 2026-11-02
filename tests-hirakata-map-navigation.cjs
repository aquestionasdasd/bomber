const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 const [T,{createHirakataMap},{createNavigation}]=await Promise.all([load('vendor/three.module.js'),load('hirakata-map.js'),load('navigation.js')]);
 const ctx=new Proxy({measureText:t=>({width:t.length*8})},{get:(o,k)=>o[k]||(()=>{})});global.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 const map=createHirakataMap(T,new T.Group()),nav=createNavigation(map),timings=[],tracking=[];let count=0;
 nav.updateTraffic(0);
 function route(from,to,label){
  const at=performance.now(),points=nav.path(from.x,from.z,to.x,to.z,from.y||0,to.y||0);timings.push({label,ms:Math.round((performance.now()-at)*10)/10});
  assert.ok(points.length,label+' route missing');let previous={...from,y:from.y||0};
  for(const p of points){assert.ok(nav.clearSegment(previous.x,previous.z,p.x,p.z,previous.y,p.y),label+' unsafe edge');previous=p;}
  assert.ok(Math.hypot(previous.x-to.x,previous.z-to.z,previous.y-(to.y||0))<.05,label+' wrong endpoint');count++;
  return points;
 }
 assert.deepEqual(map.bounds,{minX:-98,maxX:98,minZ:-123,maxZ:183});
 for(const site of map.sites)for(const p of site.plantPositions)assert.ok(nav.isWalkable(p.x,p.z,0),'plant '+site.id+' '+JSON.stringify(p));
 for(const[team,spawns]of Object.entries(map.teamSpawns))for(const [i,p]of spawns.entries()){
  assert.ok(nav.isWalkable(p.x,p.z,0),'spawn '+team+i);for(const site of map.sites)route(p,site,'spawn '+team+i+' to '+site.id);
 }
 const uppers=[{x:-24,z:10,y:6.4},{x:35,z:10,y:6.4},{x:-22,z:-23,y:7.2},{x:39,z:-41,y:7.2},{x:8,z:45,y:6.4},{x:-2,z:121,y:6.4}];
 for(const [i,p]of uppers.entries()){
  assert.ok(nav.isWalkable(p.x,p.z,p.y),'upper '+i);
  const ground={x:p.x,z:p.z,y:0};if(nav.isWalkable(ground.x,ground.z,0))assert.equal(nav.clearSegment(ground.x,ground.z,p.x,p.z,0,p.y),false,'same-XZ wall climb');
  route(map.sites[0],p,'A to upper '+i);route(p,map.sites[1],'upper '+i+' to B');
 }
 for(let i=0;i<8;i++){
  nav.updateTraffic(i*.3);const before=timings.length;
  route({x:-24,z:22-i*.4,y:0},{x:-22,z:-23,y:7.2},'moving pursuit '+i);tracking.push(timings[before].ms);
 }
 console.log('PASS '+count+' actual-model routes: ten ground spawns to both ground sites, six upper areas in both directions, and changing traffic pursuits');
 console.log(JSON.stringify({colliders:map.colliders.length,ramps:map.ramps.length,nodes:nav.nodeCount,groundMs:timings.slice(0,20).map(p=>p.ms),upperMs:timings.slice(20,32).map(p=>p.ms),pursuitMs:tracking,limitations:'Node numerical paths only; runtime updatePlay and live browser validation are separate',audioPlayed:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
