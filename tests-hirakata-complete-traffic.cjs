const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href),T=await load('vendor/three.module.js'),{createHirakataMap}=await load('hirakata-map.js'),{busHitsBox}=await load('bus-destruction.js'),{busPoint}=await load('bus-service.js');
 global.document={createElement:()=>({getContext:()=>new Proxy({measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})})})};
 const map=createHirakataMap(T,new T.Scene());let samples=0,boardings=0;
 for(let i=0;i<3000;i++){const time=i*.03;for(const pose of map.traffic.poses(time)){
  samples++;
  for(const c of map.collision.query(pose.x,pose.z,6))assert.equal(busHitsBox(pose,c),false,pose.id+' intersects '+c.id+' at '+time);
  for(const x of[-1.3,1.3])for(const z of[-5.35,5.35]){const p=busPoint(pose,x,z),b=map.bounds;assert.ok(p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ);}
 }}
 console.log('PASS actual full-body traffic clears buildings, stair legs, fences, taxis and arena edges across 90 seconds');
 for(const id of['south-1','south-2','north-1','north-2']){
  map.traffic.reset();let pose,time;
  for(let i=0;i<3000;i++){time=i*.03;map.traffic.service.tick(.03,time,[]);pose=map.traffic.poses(time).find(p=>p.id===id);if(pose.door)break;}
  assert.ok(pose.door);const at=busPoint(pose,-1.8,3.8),actor={id:'test',team:'blue',alive:true,x:at.x,z:at.z,y:0,vy:0};
  assert.equal(map.collision.blocked(actor.x,actor.z,.34,0),false,'boarding access '+id);
  assert.equal(map.traffic.service.candidate(actor,time)?.busId,id);assert.equal(map.traffic.service.interact(actor,time),true);
  assert.equal(map.traffic.service.exit(actor,time,p=>!map.collision.blocked(p.x,p.z,.34,0)),true);assert.equal(map.collision.blocked(actor.x,actor.z,.34,0),false);boardings++;
 }
 console.log('PASS each of four buses has an unobstructed real stop, boarding point and safe exit');
 console.log(JSON.stringify({samples,boardings,scope:'actual model collision; numeric simulation; no audio/browser'}));
})().catch(e=>{console.error(e);process.exitCode=1});
