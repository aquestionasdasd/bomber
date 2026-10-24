const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-frost-stitch.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const variants=[
  ['old stitch distance window',s=>s.replace('dist>0&&dist<=FROST_SKILLS.stitchRange+FROST_SKILLS.stitchRadius','dist>3&&dist<=12'),'near full'],
  ['skip actual stitch landing',s=>s.replace('stitch&&ordinarySkills.wouldStitch(pose,stitch,queries)','stitch'),'other floors'],
  ['ignore allied annulus safe centre',s=>s.replace('event.team===bot.team&&ordinarySkills.wouldStitch(pose,event,queries)',"event.type==='frost-stitch'&&event.team===bot.team&&distance(event,ring)<3"),'only an effective'],
  ['hidden stitch target pose leak',s=>s.replace('const ring={x:watch.x+Math.cos(aim.yaw)*2,y:watch.y??bot.y??0,z:watch.z-Math.sin(aim.yaw)*2};','const hidden=actors.find(a=>a.id===watch.id)||watch,ring={x:hidden.x+Math.cos(aim.yaw)*2,y:hidden.y??bot.y??0,z:hidden.z-Math.sin(aim.yaw)*2};'),'fixed sight'],
 ];
 for(const[name,edit,group]of variants){assert.ok(edit(source)!==source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)')}
})().catch(e=>{console.error(e);process.exitCode=1});
