const assert=require('node:assert/strict'),fs=require('node:fs'),main=require('./tests-bot-nobi-tool-share.cjs');
const faults=[
 ['duplicate toolbox spend','sharedTool?null:activateAbility','false?null:activateAbility','active and pending'],
 ['short field suppresses useful tool','event.endsAt-Math.max(elapsed,event.triggerAt)>=workTime&&','','short remaining'],
 ['blocked field suppresses useful tool','&&ordinarySkills.wouldNobi(pose,event,{reachable:ordinaryReachable})','','real wall and smoke']
];
(async()=>{const source=fs.readFileSync('public/game.js','utf8');for(const[label,from,to,test]of faults){assert.equal(source.split(from).length-1,1,label+' anchor');await assert.rejects(main({mutate:s=>s.replace(from,to),only:n=>n.startsWith(test)}),{name:'AssertionError'},label);console.log('PASS: in-memory toolbox fault detected / '+label);}})().catch(e=>{console.error(e);process.exitCode=1});
