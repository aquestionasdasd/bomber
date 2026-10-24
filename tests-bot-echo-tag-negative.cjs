const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-echo-tag.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const variants=[
  ['old tag distance window',s=>s.replace('dist>0&&dist<=IAGNU_SKILLS.tagRange+IAGNU_SKILLS.tagRadius','dist>4&&dist<=IAGNU_SKILLS.tagRange'),'near and full'],
  ['skip actual tag landing',s=>s.replace('tag&&ordinarySkills.wouldTag(pose,tag,queries)','tag'),'other floors'],
  ['ignore ineffective allied tag floor',s=>s.replace('event.team===bot.team&&ordinarySkills.wouldTag(pose,event,queries)',"event.type==='echo-tag'&&event.team===bot.team&&distance(event,watch)<4"),'only an effective'],
  ['hidden tag target pose leak',s=>s.replace("const point={x:watch.x,y:watch.y??bot.y??0,z:watch.z},landing=getSkillTarget(bot,'echo-tag',point,aim);","const hidden=actors.find(a=>a.id===watch.id)||watch,point={x:hidden.x,y:hidden.y??bot.y??0,z:hidden.z},landing=getSkillTarget(bot,'echo-tag',point,aim);"),'fixed sight'],
 ];
 for(const[name,edit,group]of variants){assert.ok(edit(source)!==source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)')}
})().catch(e=>{console.error(e);process.exitCode=1});
