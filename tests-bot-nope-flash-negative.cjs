const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-nope-flash.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const variants=[
  ['ignore caster next firing view',s=>s.replace('if(ordinarySkills.wouldBlind({...ordinaryActorView(bot),yaw:aim.yaw,pitch:aim.pitch},event,options))return null;',''),'open direct'],
  ['old below-eyes burst',s=>s.replace('ratio=(dist-1.5)/dist','ratio=1'),'overhead cover'],
  ['old distance-only friendly veto',s=>s.replace('ordinarySkills.wouldBlind(ordinaryActorView(ally),event,options)','Math.hypot(ally.x-event.x,ally.z-event.z)<event.radius'),'actual friendly'],
  ['ignore enemy exposure',s=>s.replace('if(!ordinarySkills.wouldBlind(ordinaryActorView(enemy),event,options))return null;',''),'enemy facing'],
 ];
 for(const[name,edit,group]of variants){
  const mutate=s=>{s=s.replace(/\r\n/g,'\n');const start=s.indexOf('function nopeBotFlashPoint('),end=s.indexOf('function catBotFetchAim(',start);assert.ok(start>0&&end>start);const block=s.slice(start,end),changed=edit(block);assert.notEqual(changed,block,name);return s.slice(0,start)+changed+s.slice(end);};
  assert.notEqual(mutate(source),source,name);await assert.rejects(()=>run({mutate,only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
