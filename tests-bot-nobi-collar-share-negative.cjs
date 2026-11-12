const assert=require('node:assert/strict'),run=require('./tests-bot-nobi-collar-share.cjs');
(async()=>{
 const faults=[
  ['ignore shared collar',s=>s.replace('if(!shared)cast=activateAbility', 'if(true)cast=activateAbility'),'pending and active'],
  ['ignore additional reachable recipient',s=>s.replace('recipients.every(actor=>collars.some','recipients.some(actor=>collars.some'),'additional reachable'],
  ['ignore remaining flight and retry window',s=>s.replace('event.endsAt>=elapsed+1+NOBI_SKILLS.throwFlight','event.endsAt>=elapsed'),'coverage near expiry'],
  ['ignore actual shared field reach',s=>s.replace('collars.some(event=>ordinarySkills.wouldNobi(actor,event,queries))','collars.some(event=>true)'),'no collar hostile'],
 ];
 for(const[name,edit,group]of faults){const mutate=s=>{const changed=edit(s);assert.notEqual(changed,s,name);return changed;};await assert.rejects(()=>run({mutate,only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1});
