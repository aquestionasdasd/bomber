const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const source=fs.readFileSync('public/bus-service.js','utf8');
 const variants=[['fuel','time>=s.fuelUntil||!enabled','!enabled'],['collision','if(!canDrive(p,old))','if(false)'],['strict fuel','fuel>time+25.001','false']];
 async function probe(text,kind){const {createBusService}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));const service=createBusService(()=>[{id:'north-0',x:0,z:0,yaw:0,dx:0,dz:1,door:true,speed:0}]),a={id:'p',team:'blue',alive:true,x:-1.8,z:3.8,y:0,vy:0};service.interact(a,0);service.damageDriver('north-0','p',100,0);service.interact(a,0);
  if(kind==='strict fuel'){const row=service.snapshot(['p']);row[0][3]=100;assert.equal(service.restore(row,['p'],0),false);}
  else{service.tick(.1,kind==='fuel'?26:.1,[a],{controls:()=>({throttle:1}),canDrive:()=>kind!=='collision'});assert.equal(service.poses(26)[0].speed,0);assert.equal(service.poses(26)[0].z,0);}
 }
 for(const [kind,anchor,replacement] of variants){assert.ok(source.includes(anchor),kind+' mutation anchor');await probe(source,kind);await assert.rejects(()=>probe(source.replace(anchor,replacement),kind),{code:'ERR_ASSERTION'});console.log('PASS detects missing '+kind+' guard');}
})().catch(e=>{console.error(e);process.exitCode=1;});
