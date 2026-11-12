const assert=require('node:assert/strict'),main=require('./tests-bot-defuse-tactics.cjs');
(async()=>{let faults=0;
 for(const [name,from,to,group]of[
  ['ignore fake release decision','retake?retake.allow:enemyDistance','retake?true:enemyDistance','actual full frame'],
  ['remove bomb-side scanning','bot.retakeWatch||{x:bot.x+dx,z:bot.z+dz}','{x:bot.x+dx,z:bot.z+dz}','scan acquires'],
  ['leave canceled defuse owned','if(!bot.defusing)match.cancelDefuse(bot.id);','if(false)match.cancelDefuse(bot.id);','actual full frame']
 ]){let touched=false,rejected=false;try{await main({only:n=>n.startsWith(group),mutate:s=>{assert.ok(s.includes(from),name+' mutation anchor');touched=true;return s.replace(from,to)}})}catch(e){assert.ok(e instanceof assert.AssertionError,name+': '+e.stack);rejected=true;}assert.ok(touched&&rejected,name+' must be detected');faults++;console.log('PASS: rejected memory fault '+name);}
 console.log(`PASS: ${faults} CPU retake memory faults; no files or gates changed`);
})().catch(e=>{console.error(e);process.exitCode=1});
