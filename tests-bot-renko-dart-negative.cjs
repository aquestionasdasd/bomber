const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-renko-dart.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const variants=[
  ['missing C decision',s=>s.replace(/      \/\/ Renko uses the same finite body turn[\s\S]*?      \/\/ Only consecutive visible samples/,'      // Only consecutive visible samples'),'aligned visible'],
  ['skip body alignment',s=>s.replace("bot.kit?.character==='renko'&&aligned&&elapsed>=bot.reactionUntil","bot.kit?.character==='renko'&&elapsed>=bot.reactionUntil"),'body turns'],
  ['ignore reaction delay',s=>s.replace("bot.kit?.character==='renko'&&aligned&&elapsed>=bot.reactionUntil","bot.kit?.character==='renko'&&aligned"),'body turns'],
  ['unbounded refused retry',s=>s.replace('bot.nextSkillAt=elapsed+(cast?2:.5);\n      }\n      // Only consecutive','bot.nextSkillAt=elapsed;\n      }\n      // Only consecutive'),'full event'],
 ];
 for(const[name,edit,group]of variants){assert.notEqual(edit(source),source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)')}
})().catch(e=>{console.error(e);process.exitCode=1});
