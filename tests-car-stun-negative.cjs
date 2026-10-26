const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-car-stun.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
 const faults=[
  ['damage','damageEntity(victim,CAR_SKILLS.bumperDamage,actor', 'damageEntity(victim,75,actor','100 raw'],
  ['five seconds','const endsAt=m.endsAt+CAR_SKILLS.bumperStunTime-CAR_SKILLS.bumperLaunchTime;', 'const endsAt=m.endsAt;','20/60/144Hz'],
  ['strict stun velocity','||vx!==0||vz!==0||Math.abs(vy)>32', '||Math.abs(vy)>32','strict six-field']
 ];
 for(const[name,anchor,replacement,group]of faults){assert.ok(source.includes(anchor),name+' anchor');await assert.rejects(()=>run({mutate:s=>s.replace(anchor,replacement),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects missing '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1;});
