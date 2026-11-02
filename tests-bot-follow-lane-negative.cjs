const assert=require('node:assert/strict'),run=require('./tests-bot-follow-lane.cjs');
(async()=>{
 const faults=[
  ['skip initial lane filtering',s=>s.replace('&&canFollow(a,contact)',''),'reachable alternative'],
  ['reject only after picking the nearest',s=>s.replace('&&canFollow(a,contact)','').replace('if(follow&&canSetup','if(follow&&canFollow(follow,contact)&&canSetup'),'reachable alternative'],
  ['skip active lane revalidation',s=>s.replace("if(!canFollow(follow,state.point)){finish(team,state,now,'interrupted');continue;}",''),'a newly blocked'],
  ['ignore all blocked lanes',s=>s.replace('canFollow=()=>true','canFollow:ignored=()=>true').replace('  if(now<lastTime)','  const canFollow=()=>true;\n  if(now<lastTime)'),'clear nearest'],
  ['retain caller-owned target position',s=>s.replace('point:position(contact)','point:contact'),'lane checks see'],
  ['ignore urgent objectives',s=>s.replace('&&!a.urgent',''),'reachable alternatives still'],
 ];
 for(const[name,mutate,prefix]of faults){let changed=false;await assert.rejects(()=>run({mutate:s=>{const t=mutate(s);changed=t!==s;assert.ok(changed,name);return t;},only:n=>n.startsWith(prefix)}),e=>e.code==='ERR_ASSERTION');assert.ok(changed);console.log('PASS detects '+name+' (memory only)');}
 for(const[name,mutate]of[
  ['actual movement lane adapter bypass',s=>s.replace('return navigation.clearSegment(ally.x,ally.z,x,z,ally.y||0,ally.y||0);','return true;')],
  ['actual movement lane adapter rejects everything',s=>s.replace('return navigation.clearSegment(ally.x,ally.z,x,z,ally.y||0,ally.y||0);','return false;')],
 ]){let changed=false;await assert.rejects(()=>run({only:n=>n==='actual',mutateGame:s=>{const t=mutate(s);changed=t!==s;assert.ok(changed,name);return t;}}),e=>e.code==='ERR_ASSERTION'&&e.message.includes('reachable selection'));assert.ok(changed);console.log('PASS detects '+name+' (memory only)');}
 console.log('PASS: 8 lane guard faults detected');
})().catch(e=>{console.error(e);process.exitCode=1;});
