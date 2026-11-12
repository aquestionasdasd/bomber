const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-kill-sequence.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
 const faults=[
  ['round reset','||killSoundRound!==match.round','','per actor and round'],
  ['ordinal increment','(killSoundCounts.get(source.id)||0)+1','(killSoundCounts.get(source.id)||0)+2','five distinct'],
  ['receipt deduplication','cue.seq<=previous||','','independent host'],
  ['rank validation','/^kill-[1-5]$/','/^kill-[1-9]$/','rank validation']
 ];
 for(const [name,anchor,replacement,group]of faults){assert.ok(source.includes(anchor),name+' anchor');await assert.rejects(()=>run({mutate:s=>s.replace(anchor,replacement),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects missing '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1;});
