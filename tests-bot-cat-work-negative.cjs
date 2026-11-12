const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-cat-work.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
 const start=source.indexOf("    if(bot.kit?.character==='cat'&&(interactPlant"),end=source.indexOf('    bot.planting=!!interactPlant;',start);assert.ok(start>=0&&end>start);
 const block=source.slice(start,end);
 const variants=[
  ['missing pre-work clock',()=>'', 'real tactical defuser'],
  ['generic skill timer blocks urgent clock',b=>b.replace('bot.nextCatClockAt||0','bot.nextSkillAt||0'),'real tactical defuser'],
  ['new cast during ongoing task',b=>b.replace('interactPlant&&!committedPlant||interactDefuse&&!committedDefuse','interactPlant||interactDefuse'),'ongoing work'],
  ['unbounded rejected retries',b=>b.replace('elapsed+(clock?1:.5)','elapsed+(clock?1:0)'),'existing clock'],
 ];
 for(const[name,edit,group]of variants){const replacement=edit(block);assert.notEqual(replacement,block,name);await assert.rejects(()=>run({mutate:s=>s.replace(block,replacement),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1;});
