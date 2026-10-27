const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-renko-ultimate.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const variants=[
  ['missing X decision',s=>s.replace(/      \/\/ Arm the round-long refill[\s\S]*?      \/\/ Renko uses the same finite body turn/,'      // Renko uses the same finite body turn'),'BOT starts'],
  ['skip X body alignment',s=>s.replace('!renkoUltimateActive(bot)&&aligned&&elapsed','!renkoUltimateActive(bot)&&elapsed'),'no target'],
  ['spend X with empty gun',s=>s.replace('bot.aiAmmo>0&&spec.mag>0&&!bot.serviceReload','spec.mag>0&&!bot.serviceReload'),'empty gun'],
  ['unbounded refused X retry',s=>s.replace('bot.nextRenkoUltAt=elapsed+(restart?1:.5)','bot.nextRenkoUltAt=elapsed'),'seal rejection'],
 ];
 for(const[name,edit,group]of variants){assert.notEqual(edit(source),source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)')}
})().catch(e=>{console.error(e);process.exitCode=1});
