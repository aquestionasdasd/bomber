const assert=require('node:assert/strict'),main=require('./tests-bot-variety.cjs');
(async()=>{
 for(const [label,only,from,to]of[
  ['fixed per-match seed',n=>n.startsWith('saved-game new matches'),'updateBots.matchSeed=Math.floor(Math.random()*4294967296);','updateBots.matchSeed=0;'],
  ['carrier ignores mapped approach',n=>n.startsWith('real carrier movement'),'bot.plantPositionId=point.id;if(!role?.approach)goal=point;','bot.plantPositionId=point.id;goal=point;']
 ]){let stopped=false;try{await main({only,mutate:s=>{assert.ok(s.includes(from));return s.replace(from,to);}});}catch(e){assert.equal(e.code,'ERR_ASSERTION',e.stack);stopped=true;}assert.ok(stopped,label+' must be rejected');console.log('PASS: memory-only '+label+' fault rejected');}
})().catch(e=>{console.error(e);process.exitCode=1});
