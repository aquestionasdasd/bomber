const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-nobi-fields.cjs');
(async()=>{
 const variants=[
  ['ignore real field reach',s=>s.replace('ordinarySkills.wouldNobi(pose,{type,team:bot.team,...point,radius:NOBI_SKILLS.areaRadius},queries)','true'),'far targets'],
  ['skip active-effect deduplication',s=>s.replace('stock>0&&active===1','stock>0').replace('&&!ordinarySkills.events(elapsed).some(event=>event.type===type&&event.team===bot.team&&ordinarySkills.wouldNobi(pose,event,queries))',''),'already active'],
  ['project Q with shorter C range',s=>s.replace('getSkillTarget(bot,type,','getSkillTarget(bot,\'nobi-bell\','),'ineffective C'],
  ['reverse useful C priority',s=>s.replace('for(const[key,type,stock,active]of options)','for(const[key,type,stock,active]of options.reverse())'),'ineffective C'],
 ];
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
 for(const[name,edit,group]of variants){const mutate=s=>{const start=s.indexOf("if(bot.kit?.character==='nobi'"),end=s.indexOf("if(bot.kit?.character==='car'",start);assert.ok(start>0&&end>start);const block=s.slice(start,end),changed=edit(block);assert.notEqual(changed,block,name);return s.slice(0,start)+changed+s.slice(end);};
  assert.notEqual(mutate(source),source);await assert.rejects(()=>run({mutate,only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
