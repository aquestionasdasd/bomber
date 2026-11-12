const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-mend-seeds.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const variants=[
  ['old distance window',s=>s.replace('dist>0&&dist<=CHARACTER_SKILLS.castDistance+MEND_SKILLS.seedsRadius','dist>5&&dist<17'),'near and full'],
  ['skip real landing predicate',s=>s.replace('seeds&&ordinarySkills.wouldSeed(pose,seeds,queries)','seeds'),'different floors'],
  ['ignore ineffective allied floor',s=>s.replace('event.team===bot.team&&ordinarySkills.wouldSeed(pose,event,queries)',"event.type==='mend-seeds'&&event.team===bot.team&&distance(event,known)<event.radius"),'only an effective'],
  ['hidden pose leak',s=>s.replace('const point={x:known.x,y:known.y??bot.y??0,z:known.z},landing=getSkillTarget(bot,\'mend-seeds\',point,aim);',"const hidden=actors.find(a=>a.id===known.id)||known,point={x:hidden.x,y:hidden.y??bot.y??0,z:hidden.z},landing=getSkillTarget(bot,'mend-seeds',point,aim);"),'fixed last'],
 ];
 for(const[name,edit,group]of variants){assert.ok(edit(source)!==source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)')}
})().catch(e=>{console.error(e);process.exitCode=1});
