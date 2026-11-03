const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-mouse-continuity.cjs');
(async()=>{
 const s=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 for(const [name,anchor,replacement,group]of [
  ['stationary-axis evidence',"previous[field]||Math.min(1,previous[otherField]||0)","previous[field]||0",'first vertical'],
  ['quantization evidence','matches>=1&&Math.abs(delta-relative)<4&&Math.abs(relative)<=500','false','fractional or coalesced'],
  ['idle evidence','next.relativeMatchesX=previous.relativeMatchesX;\n    next.relativeMatchesY=previous.relativeMatchesY;','next.relativeMatchesX=0;next.relativeMatchesY=0;','idle coordinate']
 ]){assert.ok(s.includes(anchor),name+' anchor');await assert.rejects(()=>run({mutate:s=>s.replace(/\r\n/g,'\n').replace(anchor,replacement),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects missing '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1});
