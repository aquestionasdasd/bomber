const assert=require('node:assert/strict'),run=require('./tests-bot-follow-retirement.cjs');
(async()=>{
 for(const[name,file,needle,replacement,message]of[
  ['omit roster retirement input','bot-tactics.js','...input,retiredTargetIds,contacts:','...input,contacts:','tactics forwards confirmed death IDs'],
  ['ignore active target retirement','bot-team-planner.js',"    if(retiredTargetIds.includes(state.targetId)){finish(team,state,now,'target-retired');continue;}",'','actual death releases flight'],
  ['schedule a stale retired contact','bot-team-planner.js','!retiredTargetIds.includes(c.id)&&','','retired stale contact cannot start a plan'],
  ['retain a retirement after revival','bot-tactics.js','retiredTargetIds=actors.filter(a=>!a.alive).map(a=>a.id);','retiredTargetIds=[...new Set([...retiredTargetIds,...actors.filter(a=>!a.alive).map(a=>a.id)])];','confirmed living roster clears retirement'],
 ]){
  const active=name==='ignore active target retirement';
  let changed=false;await assert.rejects(()=>run({pure:!active,only:(hz,phase,retired)=>active&&hz===20&&phase==='flight'&&retired,mutate:(f,s)=>{if(f!==file)return s;const t=s.replace(needle,replacement);assert.notEqual(t,s,name);changed=true;return t;}}),e=>e.code==='ERR_ASSERTION'&&e.message.includes(message),name);assert.ok(changed);console.log('PASS detects '+name+' (memory only)');
 }
 console.log('PASS: 4 retirement faults detected without changing saved source');
})().catch(e=>{console.error(e);process.exitCode=1;});
