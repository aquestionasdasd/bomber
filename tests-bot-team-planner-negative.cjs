const assert=require('node:assert/strict'),run=require('./tests-bot-team-planner.cjs');
(async()=>{
 const faults=[
  ['freeze uncast aim at old observation',s=>s.replace('if(latest)state.point=position(latest);',"if(latest&&state.phase!=='prepare')state.point=position(latest);"),'fresh preparation'],
  ['ignore newly observed target movement',s=>s.replace('if(latest)state.point=position(latest);',''),'new allied sightings'],
  ['skip real effect confirmation',s=>s.replace('if(actual.ready){','if(true){'),'setup, authoritative'],
  ['ignore urgent objective',s=>s.replace('&&!a.urgent',''),'death, urgent'],
  ['ignore unsafe setup query',s=>s.replace('follow&&canSetup(caster,action,contact)','follow'),'death, urgent'],
  ['leak stale contact into setup',s=>s.replace('now-c.seenAt<=BOT_TEAM_RULES.intelAge','true'),'no unseen'],
  ['ignore loss after followup starts',s=>s.replace("if(state.phase==='exploit'){","if(false){"),'active followup'],
 ];
 for(const[name,mutate,prefix]of faults){let changed=false;await assert.rejects(()=>run({mutate:s=>{const t=mutate(s);changed=t!==s;assert.ok(changed,name);return t;},only:n=>n.startsWith(prefix)}),{code:'ERR_ASSERTION'});assert.ok(changed);console.log('PASS detects '+name+' (memory only)');}
 const gameFaults=[
  ['accept a passed wave without a hit',s=>s.replace("if(event.type==='urchin-gloom')return ordinarySkills.snapshot().blinds.some", "if(event.type==='urchin-gloom')return true||ordinarySkills.snapshot().blinds.some")],
  ['use another wave hit as confirmation',s=>s.replace('b.eventId===event.id&&','').replace('b.sourceId===event.sourceId&&','')],
  ['read hidden gloom status without a witness',s=>s.replace('if(!witness)return false;','')],
 ];
 for(const[name,mutate]of gameFaults){let changed=false;await assert.rejects(()=>run({mutateGame:s=>{const t=mutate(s);changed=t!==s;assert.ok(changed,name);return t;},only:n=>n==='actual',gloom:true}),e=>e.code==='ERR_ASSERTION'&&e.message.includes('actual matching visible wave hit is required'));assert.ok(changed);console.log('PASS detects '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1});
