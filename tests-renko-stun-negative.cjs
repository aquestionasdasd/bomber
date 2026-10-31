const assert=require('node:assert/strict'),run=require('./tests-renko-stun.cjs');
const faults=[
 ['missing impact stun',"carMotionActive(actor)&&m.phase!==1?","carMotionActive(actor)&&![1,4].includes(m.phase)?",'one-second stun'],
 ['wall cancels stun',"if([2,4].includes(m.phase)&&actor.alive","if(m.phase===2&&actor.alive",'wall ends'],
 ['missing guest marker',"value[1]===3&&/^skill-renko-dart-","false&&/^skill-renko-dart-",'strict six-field']
];
(async()=>{for(const[name,a,b,label]of faults){let changed=false;await assert.rejects(run({mutate:s=>{assert.ok(s.includes(a),'Memory fault anchor exists');changed=true;return s.replace(a,b)},only:s=>s.startsWith(label)}),e=>e?.name==='AssertionError',name);assert.equal(changed,true);console.log('PASS memory-only fault: '+name)}})().catch(e=>{console.error(e);process.exitCode=1});
