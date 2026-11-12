const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-mend-heal.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const variants=[
  ['old eight metre exclusion',s=>s.replace("injured.hp<=70&&bot.kit.dash>0)cast=activateAbility(bot,'e')","injured.hp<=70&&bot.kit.dash>0&&enemyDistance>8)cast=activateAbility(bot,'e')"),'close visible'],
  ['ignore injury threshold',s=>s.replace('injured.hp<=70&&bot.kit.dash>0','injured.hp<100&&bot.kit.dash>0'),'lowest visible'],
  ['ignore ally sight line',s=>s.replace('selectMendTarget(bot,actors,mendReachable)','selectMendTarget(bot,actors,()=>true)').replace('selectMendTarget(actor,[player,...bots],mendReachable)','selectMendTarget(actor,[player,...bots],()=>true)'),'wall blocked'],
 ];
 for(const[name,edit,group]of variants){assert.ok(edit(source)!==source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)')}
})().catch(e=>{console.error(e);process.exitCode=1});
