const assert=require('node:assert/strict'),main=require('./tests-bot-sniper.cjs');
(async()=>{
 const faults=[['unscoped real bullet cone',s=>s.replaceAll('spec.scope?bot.sniperAds:','spec.scope?false:')],['resume long-range contact advance',s=>s.replace("(!spec.scope||spike.carrier===bot.id||['plant','recover','defuse'].includes(role?.role))","(true||spike.carrier===bot.id||['plant','recover','defuse'].includes(role?.role))")]];
 for(const[name,mutate]of faults){let rejected=false;try{await main({mutate,only:n=>n.startsWith('SCOUT')});}catch(e){assert.equal(e.code,'ERR_ASSERTION',e.stack);rejected=true;}assert.equal(rejected,true,name);console.log('PASS: memory-only fault rejected: '+name);}
 console.log('2 CPU sniper memory faults rejected; no product mutation');
})().catch(e=>{console.error(e);process.exitCode=1});
