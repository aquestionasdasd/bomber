const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-veil-roots.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const variants=[
  ['old close-range exclusion',s=>s.replace('dist>=VEIL_SKILLS.rootsMinRange&&dist<=VEIL_SKILLS.rootsRange','dist>2&&dist<=VEIL_SKILLS.rootsRange'),'close and'],
  ['skip supported target forecast',s=>s.replace('roots&&ordinarySkills.wouldRoot(pose,roots,queries)&&','roots&&'),'visible airborne'],
  ['ignore ground path clipping',s=>s.replace('target=getRootsTarget(bot,point,aim);','target={x:point.x,y:bot.y,z:point.z};'),'eye-visible'],
  ['read hidden current coordinates',s=>s.replace('point={x:known.x,y:known.y??bot.y??0,z:known.z},target=getRootsTarget','point={x:player.x,y:player.y,z:player.z},target=getRootsTarget'),'fixed recent'],
  ['endpoint-only duplicate check',s=>s.replace("event.team===bot.team&&ordinarySkills.wouldRoot(pose,event,queries)","event.type==='veil-roots'&&event.team===bot.team&&distance(event,known)<3"),'overlapping'],
 ];
 for(const[name,edit,group]of variants){assert.ok(edit(source)!==source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)')}
})().catch(e=>{console.error(e);process.exitCode=1});
