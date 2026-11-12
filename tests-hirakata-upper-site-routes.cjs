const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 const[T,{createHirakataMap},{createNavigation}]=await Promise.all([load('vendor/three.module.js'),load('hirakata-map.js'),load('navigation.js')]);
 const ctx=new Proxy({measureText:t=>({width:t.length*8})},{get:(o,k)=>o[k]||(()=>{})});global.document={createElement:()=>({getContext:()=>ctx})};
 const map=createHirakataMap(T,new T.Group()),nav=createNavigation(map),a={x:8,z:45,y:6.4},b=map.sites[1],observations=[];
 nav.updateTraffic(0);
 function route(from,to,label,required=true){
  const t=performance.now(),points=nav.path(from.x,from.z,to.x,to.z,from.y,to.y);observations.push({label,ms:+(performance.now()-t).toFixed(2),points:points.length});
  if(required)assert.ok(points.length,label+' reachable');
  let p=from;for(const q of points){assert.ok(nav.clearSegment(p.x,p.z,q.x,q.z,p.y,q.y),label+' supported edge');p=q;}
  if(points.length)assert.ok(Math.hypot(p.x-to.x,p.z-to.z,p.y-to.y)<.01,label+' correct floor endpoint');return points;
 }
 const forward=route(a,b,'T-SITE to B');assert.ok(forward.some(p=>p.y===0),'separate districts use real ground transfer');
 route(b,a,'B to T-SITE');
 const group=map.destruction.groups.find(g=>g.id==='Station_central_stairs');assert.ok(group);
 const mask=Buffer.alloc(Math.ceil(map.destruction.groups.length/8));mask[group.index>>3]|=1<<(group.index&7);map.destruction.restore(mask.toString('hex'),1);
 assert.ok(!map.ramps.some(r=>r.id==='Station_central_stairs stair 0'),'removed destination stair is absent');
 route(a,b,'after target stair destruction',false);
 map.destruction.reset();route(a,b,'after structural reset');
 console.log(JSON.stringify({groups:3,observations,scope:'Numerical upper transfer, reverse, destruction invalidation/reset; CPU continuous travel and normal match balance not measured.',audio:false}));
})().catch(e=>{console.error(e);process.exitCode=1});
