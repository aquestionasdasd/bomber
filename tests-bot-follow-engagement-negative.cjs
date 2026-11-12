const assert=require('node:assert/strict'),main=require('./tests-bot-follow-engagement.cjs');
async function run(){
 const priority='Number(b.engagedTargetId===contact.id)-Number(a.engagedTargetId===contact.id)||';
 const faults=[
  {name:'remove current engagement preference',old:priority,replacement:'',pure:false,only:(hz,s)=>hz===20&&s==='far-ready',error:/actual current target preference far-ready/},
  {name:'prefer a follower without the current target',old:priority,replacement:'Number(a.engagedTargetId===contact.id)-Number(b.engagedTargetId===contact.id)||',pure:true,only:()=>false,error:/current target preference.*far-ready/},
  {name:'lose nearest-first fallback for equal engagement',old:priority+'distance(a,contact)-distance(b,contact)||',replacement:priority,pure:true,only:()=>false,error:/current target preference.*both-ready/}
 ];
 for(const f of faults){await assert.rejects(()=>main({mutatePlanner:s=>{assert.ok(s.includes(f.old));return s.replace(f.old,f.replacement);},pure:f.pure,only:f.only}),f.error,f.name);console.log('PASS: memory-only fault caught: '+f.name);}
 console.log('PASS: 3 follower preference faults caught without changing saved product or prior tests');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
