const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-victory-camera.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
 const faults=[
  ['last watched subject','watchedId:lastSpectatedId','watchedId:bots[0]?.id','dead player pulls'],
  ['first-person isolation',['scopeActive||victoryCamera.active','if(victoryCamera.active)return null;'],['scopeActive',''],'living player has'],
  ['round presentation cleanup','victoryCamera.reset();lastSpectatedId=null;','lastSpectatedId=null;','next round, menu'],
  ['camera wall clearance','clearDistance:victoryCameraClearance','clearDistance:(_origin,_direction,distance)=>distance','real indexed wall']
 ];
 for(const [name,anchor,replacement,group]of faults){for(const a of [anchor].flat())assert.ok(source.includes(a),name+' anchor');await assert.rejects(()=>run({mutate:s=>[anchor].flat().reduce((text,a,i)=>text.replaceAll(a,[replacement].flat()[i]),s),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects missing '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1;});
