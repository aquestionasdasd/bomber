const assert=require('node:assert/strict'),{main}=require('./tests-bot-team-survey.cjs');
async function negative(){
 const faults=[
  ['requested damage is not actual damage',s=>s.replace('loss=Math.max(0,before-target.hp-(target.armor||0))','loss=amount')],
  ['dead repeat cannot count through both guards',s=>s.replace('if(survey&&alive&&killer)','if(survey&&killer)').replace('if(a&&loss>0)','if(a)')],
  ['another shooter is not the follower',s=>s.replace("&&p.follower===killer.id",'')],
  ['another target is not the planned target',s=>s.replace("&&p.targetId===target.id",'')],
  ['unconfirmed effect cannot earn credit',s=>s.replace('if(record?.ready){','if(record){')],
  ['flight is not exploit',s=>s.replace("p.phase==='exploit'","true")],
  ['waiting movement is not pursuit',s=>s.replace("&&order?.kind==='follow'",'')],
  ['nested cast must not duplicate',s=>s.replace('&&surveyDepth===0','')],
  ['teammate progress must not be attributed to all actors',s=>s.replace('if(a)a[key]+=Math.max(0,this.spike[field]-before);','for(const row of Object.values(survey.actors))row[key]+=Math.max(0,this.spike[field]-before);')],
  ['pipeline requires the real motion update',s=>s.replace("surveyCarFrames-cars!==1","false")],
 ];
 let killed=0;const original=console.log;console.log=()=>{};
 try{for(const[name,mutate]of faults){let changed=false,failed=false;try{await main({mutate:s=>{const next=mutate(s);changed=next!==s;return next;}});}catch(e){if(e.code==='ERR_ASSERTION')failed=true;else throw e;}assert.ok(changed,name+' did not mutate');assert.ok(failed,name+' escaped');killed++;original('KILLED: '+name);}}finally{console.log=original;}
 original('Team survey negative PASS: '+killed+' memory-only measurement faults');
}
if(require.main===module)negative().catch(e=>{console.error(e);process.exitCode=1;});module.exports={negative};
