const assert=require('node:assert/strict'),main=require('./tests-solo-swift.cjs');
(async()=>{
 const faults=[['ally refill',s=>s.replace("else if(soloSwift)roster=roster.filter(r=>r.id==='player'||r.team==='red');",''),n=>n.startsWith('solo roster')],['missing win multiplier',s=>s.replace('guest:isGuest(),soloSwift','guest:isGuest(),soloSwift:false'),n=>n.startsWith('five actual elimination')]];
 for(const[name,mutate,only]of faults){let rejected=false;try{await main({mutate,only});}catch(e){assert.equal(e.code,'ERR_ASSERTION',e.stack);rejected=true;}assert.equal(rejected,true,name);console.log('PASS: memory-only fault rejected: '+name);}
 console.log('2 solo Swift faults rejected; no product mutation');
})().catch(e=>{console.error(e);process.exitCode=1});
