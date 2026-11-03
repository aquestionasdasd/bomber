const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-renko-retake.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const variants=[
  ['missing public retake decision',s=>s.replace(/    \/\/ A planted bomber is public information\.[\s\S]*?    bot.planting=!!interactPlant;/,'    bot.planting=!!interactPlant;'),'assigned Renko'],
  ['Q movement stays at ordinary speed',s=>s.replace("bot.kit?.character==='renko'&&renkoEvent(bot,'renko-drive')?RENKO_SKILLS.runSpeed:",''),'assigned Renko'],
  ['threat does not release unarmed drive',s=>s.replace('const safeDrive=retake&&!enemy&&!decoyTarget','const safeDrive=retake&&!decoyTarget'),'visible threat'],
  ['unbounded event refusal retries',s=>s.replace('bot.nextRenkoDriveAt=elapsed+(drive?2.5:.5)','bot.nextRenkoDriveAt=elapsed'),'full20event'],
 ];
 for(const [name,edit,group]of variants){assert.notEqual(edit(source),source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1});
