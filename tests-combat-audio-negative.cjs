const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-combat-audio.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
 const faults=[['final elimination',"['live','post'].includes(packet.rules.phase)","['live'].includes(packet.rules.phase)",'guest kill receipt'],['fresh replay','if(fresh||cue.round!==packet.rules.round','if(cue.round!==packet.rules.round','fresh, stale'],['zero damage',"if(firearm&&killer&&entity.team!==killer.team&&Math.max(0,healthBefore-entity.hp)+Math.max(0,armorBefore-entity.armor)>0)","if(firearm&&killer&&entity.team!==killer.team)",'armor loss']];
 for(const [name,anchor,replacement,group]of faults){assert.ok(source.includes(anchor),name+' anchor');await assert.rejects(()=>run({mutate:s=>s.replace(anchor,replacement),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects missing '+name+' guard (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1;});
