const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f))),{createTrafficClock}=await load('bus-traffic.js'),{busPoint,busOverlaps,createBusService}=await load('bus-service.js');let n=0;
 function check(name,fn){fn();n++;console.log('PASS '+name);}
 const clone=x=>JSON.parse(JSON.stringify(x));
 check('both rotaries queue behind a stopped occupied bus, no overlap or passenger hit at20/60/144Hz',()=>{
  for(const hz of[20,60,144])for(const prefix of['south','north']){
   const t=createTrafficClock();let time=0,actor,leader,queued=false;
   for(let i=1;i<=hz*65;i++){
    time=i/hz;t.service.tick(1/hz,time,actor?[actor]:[]);
    const poses=t.poses(time);
    if(!actor){const p=poses.find(p=>p.id.startsWith(prefix)&&p.door);if(p){actor={id:'p',team:'blue',alive:true,vy:0,...busPoint(p,-1.8,3.8)};assert.ok(t.service.interact(actor,time));assert.ok(t.service.damageDriver(p.id,'p',100,time));leader=p.id;}}
    for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)assert.equal(busOverlaps(poses[a],poses[b],0),false,JSON.stringify({hz,prefix,time,a:poses[a],b:poses[b]}));
    if(actor){assert.equal(t.impacts([actor],time).length,0);assert.ok(t.service.seat('p'));const follow=poses.find(p=>p.id.startsWith(prefix)&&p.id!==leader);if(time>20&&follow.speed===0)queued=true;}
   }
   assert.ok(queued,prefix+' follower never stopped');
   const rows=clone(t.service.snapshot(['p'])),g=createTrafficClock();assert.ok(rows.some(r=>r.length===10));assert.ok(g.service.restore(rows,['p'],time));
   for(const p of t.poses(time)){const q=g.poses(time).find(v=>v.id===p.id);assert.ok(Math.hypot(p.x-q.x,p.z-q.z)<.002);assert.equal(p.door,q.door);assert.equal(p.speed,q.speed);}
   const delayed=rows.find(r=>r.length===10);delayed[8]=[1];const passengerIds=['p','q'];assert.ok(g.service.restore(rows,passengerIds,time));const id=g.poses(time)[delayed[0]].id;assert.ok(g.service.damageDriver(id,'q',40,time));const wounded=clone(g.service.snapshot(passengerIds)),peer=createTrafficClock();assert.ok(peer.service.restore(wounded,passengerIds,time));assert.equal(peer.poses(time).find(v=>v.id===id).driverHP,60);assert.ok(g.service.damageDriver(id,'q',60,time));assert.ok(peer.service.restore(clone(g.service.snapshot(passengerIds)),passengerIds,time));assert.equal(peer.poses(time).find(v=>v.id===id).driverHP,0);

  }
 });
 check('a delayed schedule resumes continuously when a driven leader clears the lane',()=>{
  const schedule=time=>[{id:'a',x:0,z:20+time*2,yaw:0,dx:0,dz:1,speed:2,door:false,eta:0},{id:'b',x:0,z:time*2,yaw:0,dx:0,dz:1,speed:2,door:false,eta:0}];
  const s=createBusService(schedule),ids=['p'];assert.ok(s.restore([[0,0,0,25,0,20,0,0,[0]]],ids,0));const a={id:'p',team:'blue',alive:true};
  // Restore does not trust a team; a normal authority tick seeds rider teams via boarding.
  // This test moves the obstacle by fresh valid host states, then resumes the route.
  for(let i=1;i<=60;i++)s.tick(.1,i*.1,[],{canExit:()=>false});
  let before=s.poses(6).find(p=>p.id==='b');assert.equal(before.speed,0);
  const rows=clone(s.snapshot(ids));rows[0][4]=20;assert.ok(s.restore(rows,ids,6));
  let moved=0;
  for(let i=1;i<=40;i++){const time=6+i*.1;s.tick(.1,time,[]);const p=s.poses(time).find(p=>p.id==='b');assert.ok(Math.hypot(p.x-before.x,p.z-before.z)<=.201);moved+=Math.hypot(p.x-before.x,p.z-before.z);before=p;}
  assert.ok(moved>3);
 });
 check('route-clock JSON rejects forged poses/owner/HP/future clocks atomically',()=>{
  const t=createTrafficClock();for(let i=1;i<=1200;i++)t.service.tick(.05,i*.05,[]);
  const rows=clone(t.service.snapshot([])),index=rows.findIndex(r=>r.length===10);assert.ok(index>=0);const g=createTrafficClock();assert.ok(g.service.restore(rows,[],60));const saved=clone(g.service.snapshot([]));
  for(const mutate of[r=>r[index][9]=61,r=>r[index][9]=-1,r=>r[index][4]+=1,r=>r[index][1]=0,r=>r[index][7]=-1,r=>r[index].push(0)]){const bad=clone(rows);mutate(bad);assert.equal(g.service.restore(bad,[],60),false);assert.deepEqual(g.service.snapshot([]),saved);}
 });
 check('a player driven bus cannot reverse through another body; fuel still expires at25s',()=>{
  const t=createTrafficClock();let time=0,p;while(!(p=t.poses(time).find(p=>p.door)))time+=.02;
  const a={id:'p',team:'blue',alive:true,vy:0,...busPoint(p,-1.8,3.8)};t.service.interact(a,time);t.service.damageDriver(p.id,'p',100,time);t.service.interact(a,time);const until=time+25;
  let prior=t.poses(time).find(v=>v.id===p.id),travel=0;
  for(let i=1;i<=540;i++){const now=time+i*.05;t.service.tick(.05,now,[a],{controls:()=>({throttle:i<250?-1:1})});const poses=t.poses(now),v=poses.find(v=>v.id===p.id);assert.ok(Math.hypot(v.x-prior.x,v.z-prior.z)<=.851);travel+=Math.hypot(v.x-prior.x,v.z-prior.z);for(const q of poses)if(q.id!==v.id)assert.equal(busOverlaps(v,q,0),false);if(now>=until)assert.equal(v.speed,0);prior=v;}
  assert.ok(travel>1);
 });
 console.log('PASS '+n+' queue groups; silent');
})().catch(e=>{console.error(e);process.exitCode=1;});
