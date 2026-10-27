const assert=require('node:assert/strict'),run=require('./tests-bot-nobi-pending.cjs');
(async()=>{
 const faults=[
  ['ignore fields before arming',s=>s.replace('event=>event.type===type&&event.team===bot.team&&ordinarySkills.wouldNobi(pose,event,queries)','event=>elapsed>=event.triggerAt&&event.type===type&&event.team===bot.team&&ordinarySkills.wouldNobi(pose,event,queries)'),'same-frame'],
  ['reserve enemy outside real pending field',s=>s.replace('ordinarySkills.wouldNobi(pose,event,queries)','true'),'unrelated pending'],
  ['reserve different complementary skill',s=>s.replace('event.type===type&&event.team===bot.team','event.team===bot.team'),'different C'],
 ];
 for(const[name,edit,group]of faults){const mutate=s=>{const changed=edit(s);assert.notEqual(changed,s,name);return changed;};await assert.rejects(()=>run({mutate,only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1});
