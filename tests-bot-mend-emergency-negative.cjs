const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-mend-emergency.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
 const variants=[
  ['old shared wait',s=>s.replace("if(elapsed>=(bot.nextMendHealAt||0)){","if(elapsed>=(bot.nextMendHealAt||0)&&elapsed>=(bot.nextSkillAt||0)){"),'C and Q shared'],
  ['unbounded refusal retry',s=>s.replace('if(elapsed>=(bot.nextMendHealAt||0)){','if(true){'),'full20event'],
  ['C after successful E in same frame',s=>s.replace('if(!cast&&ordinaryReady&&known){','if(ordinaryReady&&known){'),'urgent E keeps'],
  ['stale retry after reset',s=>s.replace('actor.nextMendHealAt=0;',''),'round menu cleanup'],
 ];
 for(const[name,edit,group]of variants){assert.notEqual(edit(source),source,name);await assert.rejects(()=>run({mutate:edit,only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1});
