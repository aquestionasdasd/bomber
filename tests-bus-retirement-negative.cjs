const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/bus-service.js'),'utf8');
 const variants=[['round persistence','s.retired||s.fuelUntil>0','false'],['pose removal','filter(p=>!states.get(p.id)?.retired)','filter(()=>true)'],['strict tombstone','if(retired&&(auto||owner!==-1||riders.length))','if(false)']];
 async function probe(text,kind){const {createBusService}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));const service=createBusService(()=>[{id:'bus',x:0,z:0,yaw:0,dx:0,dz:1,door:true,speed:0}]);
  if(kind==='strict tombstone'){assert.equal(service.restore([[0,0,-1,0,null,null,null,0,[0]]],['p'],0),false);return;}
  const a={id:'p',team:'blue',alive:true,x:-1.8,z:3.8,y:0,vy:0};assert.ok(service.interact(a,0));assert.ok(service.damageDriver('bus','p',100,0));assert.ok(service.interact(a,0));service.reset({preserveHijacked:true});assert.equal(service.poses(1).length,0);assert.deepEqual(service.snapshot(['p']),[[0,0,-1,0,null,null,null,0,[]]]);
 }
 for(const[kind,anchor,replacement]of variants){assert.ok(source.includes(anchor),kind+' mutation anchor');await probe(source,kind);await assert.rejects(()=>probe(source.replace(anchor,replacement),kind),{code:'ERR_ASSERTION'});console.log('PASS detects missing '+kind+' guard');}
})().catch(e=>{console.error(e);process.exitCode=1;});
