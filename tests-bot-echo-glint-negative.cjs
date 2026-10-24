const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-echo-glint.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const variants=[
  ['ignore caster next firing view',s=>s.replace('if(ordinarySkills.wouldBlind({...ordinaryActorView(bot),yaw:aim.yaw,pitch:aim.pitch},event,options))return null;',''),'close self'],
  ['old below-eyes burst',s=>s.replace('ratio=(dist-1.5)/dist','ratio=1'),'a front offset'],
  ['old distance-only friendly veto',s=>s.replace('ordinarySkills.wouldBlind(ordinaryActorView(ally),event,options)','Math.hypot(ally.x-event.x,ally.z-event.z)<event.radius'),'facing and wall'],
  ['ignore enemy exposure',s=>s.replace('if(!ordinarySkills.wouldBlind(ordinaryActorView(enemy),event,options))return null;',''),'long throws'],
 ];
 for(const[name,edit,group]of variants){assert.ok(edit(source)!==source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)')}
})().catch(e=>{console.error(e);process.exitCode=1});
