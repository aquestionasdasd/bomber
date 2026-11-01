const assert=require('node:assert/strict'),run=require('./tests-bot-team-planner.cjs');
(async()=>{
 const faults=[
  ['ignore newly observed target movement',s=>s.replace('if(latest)state.point=position(latest);',''),'new allied sightings'],
  ['skip real effect confirmation',s=>s.replace('if(actual.ready){','if(true){'),'setup, authoritative'],
  ['ignore urgent objective',s=>s.replace('&&!a.urgent',''),'death, urgent'],
  ['ignore unsafe setup query',s=>s.replace('follow&&canSetup(caster,action,contact)','follow'),'death, urgent'],
  ['leak stale contact into setup',s=>s.replace('now-c.seenAt<=BOT_TEAM_RULES.intelAge','true'),'no unseen'],
  ['ignore loss after followup starts',s=>s.replace("if(state.phase==='exploit'){","if(false){"),'active followup'],
 ];
 for(const[name,mutate,prefix]of faults){let changed=false;await assert.rejects(()=>run({mutate:s=>{const t=mutate(s);changed=t!==s;assert.ok(changed,name);return t;},only:n=>n.startsWith(prefix)}),{code:'ERR_ASSERTION'});assert.ok(changed);console.log('PASS detects '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1});
