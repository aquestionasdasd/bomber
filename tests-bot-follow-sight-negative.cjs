const assert=require('node:assert/strict'),run=require('./tests-bot-follow-sight.cjs');
(async()=>{
 for(const[name,mutate,message]of[
  ['skip copied-point visibility',s=>s.replace('if(!visibleBetween(ally,contact))return false;',''),'reachable selection near-blocked'],
  ['replace smoke-aware sight with geometry alone',s=>s.replace('if(!visibleBetween(ally,contact))return false;','if(!map.collision.rayClear(ally.x,1.5,ally.z,contact.x,1.5,contact.z))return false;'),'reachable selection near-blocked'],
  ['reject every follower',s=>s.replace('if(!visibleBetween(ally,contact))return false;','return false;'),'reachable selection near-blocked'],
 ]){
  let changed=false;await assert.rejects(()=>run({mutateGame:s=>{const t=mutate(s);changed=t!==s;assert.ok(changed,name);return t;}}),e=>e.code==='ERR_ASSERTION'&&e.message.includes(message));assert.ok(changed);console.log('PASS detects '+name+' (memory only)');
 }
 console.log('PASS: 3 actual smoke-sight faults detected');
})().catch(e=>{console.error(e);process.exitCode=1;});
