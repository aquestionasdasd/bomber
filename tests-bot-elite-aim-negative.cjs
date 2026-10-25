const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-elite-aim.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const variants=[
  ['instant navigation turn',s=>s.replace('if(!bot.target)face(bot,{x:bot.x+dx,z:bot.z+dz});','bot.group.rotation.y=Math.atan2(dx,dz);'),'navigation and repeated'],
  ['unbounded gun turn',s=>s.replace('const limit=Math.min(speed*dt,bot.turnBudget),step=clamp(delta,-limit,limit);','const limit=100,step=delta;'),'audible rear'],
  ['old weak gun aim',s=>s.replace('cfg.aim*(settled?1:.76)*Math.max(.6,1-enemyDistance/160)','cfg.aim*.54*Math.max(.48,1-enemyDistance/65)'),'stationary frontal'],
  ['stale stationary precision',s=>s.replace('if(!aligned||targetSpeed>.65)bot.aimStillSince=elapsed;','if(!aligned||!sample)bot.aimStillSince=elapsed;'),'moving target and reacquisition'],
 ];
 for(const[name,edit,group]of variants){assert.notEqual(edit(source),source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),undefined,name);console.log('DETECTED: '+name)}
 console.log(`PASS: ${variants.length} elite aim in-memory faults; disk source unchanged`);
})().catch(e=>{console.error(e);process.exitCode=1});
