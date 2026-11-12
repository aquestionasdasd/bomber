const assert=require('node:assert/strict'),run=require('./tests-defuse-start.cjs');
async function main(){
 const cases=[
  {name:'missing accepted start dispatch',label:'accepted local start',anchor:"if(event.type==='defuse-start')soundDefuseStart(event);",replacement:''},
  {name:'practice drains start without playing',label:'objective practice',anchor:"for(const event of events)if(event.type==='defuse-start')soundDefuseStart(event);",replacement:''},
  {name:'initiating guest loses host confirmation',label:'independent JSON',anchor:"if(cue.type==='defuse-start'){if(['live','post']",replacement:"if(cue.type==='defuse-start'){if(cue.id!==ownId&&['live','post']"}
 ];
 for(const c of cases){let changed=false;await assert.rejects(run({mutate:s=>{assert.ok(s.includes(c.anchor),c.name+' anchor');changed=true;return s.replace(c.anchor,c.replacement)},only:n=>n.startsWith(c.label)}),e=>e.code==='ERR_ASSERTION',c.name);assert.ok(changed);console.log('PASS: detected '+c.name)}
 console.log('PASS: 3 in-memory defuse-start faults; saved sources untouched');
}
main().catch(e=>{console.error(e);process.exitCode=1});
