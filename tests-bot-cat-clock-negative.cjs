const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-cat-clock.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
 const variants=[['old wrong-side use','catBotClockUseful(bot)',"(match.spike.status==='planted'||match.roundTime<20)",'attack holds'],['defender early waste','spike.timer<=12','spike.timer<=45','early windows'],['hardcoded team','actor.team===match.attackerTeam',"actor.team==='blue'",'dynamic sides']];
 for(const [name,anchor,replacement,group]of variants){assert.ok(source.includes(anchor),name);await assert.rejects(()=>run({mutate:s=>s.replaceAll(anchor,replacement),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1;});
