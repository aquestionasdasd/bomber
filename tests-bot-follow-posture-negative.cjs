const assert=require('node:assert/strict'),run=require('./tests-bot-follow-posture.cjs');
(async()=>{
 const observed="...(Number.isFinite(enemy.crouch)&&enemy.crouch>0?{crouch:Math.min(1,enemy.crouch)}:{}),";
 const saved="...(Number.isFinite(p.crouch)&&p.crouch>0?{crouch:Math.min(1,p.crouch)}:{})";
 for(const[name,file,needle,replacement,scenario,message]of[
  ['omit own posture','game.js','crouch:b.crouch||0,','','own-duck','posture selection own-duck'],
  ['omit observed posture','bot-tactics.js',observed,'','enemy-duck','copied observed crouch'],
  ['drop posture in saved plan','bot-team-planner.js',','+saved,'','enemy-duck','selected plan copies posture'],
  ['treat every ally as crouched','game.js','crouch:b.crouch||0,','crouch:1,','standing','posture selection standing'],
 ]){
  let changed=false;
  // Already-acquired target preference can independently avoid low cover.
  // These two controls begin outside normal FOV so posture must still guard
  // selection before either ally acquires the enemy. Prove the clean control
  // first, then require the original assertion to catch the same fault.
  const options={only:(hz,s)=>hz===20&&s===scenario,initialYaw:file==='game.js'?Math.PI/2:0};
  await run(options);
  await assert.rejects(()=>run({...options,mutate:(f,s)=>{if(f!==file)return s;const t=s.replace(needle,replacement);assert.notEqual(t,s,name);changed=true;return t;}}),e=>e.code==='ERR_ASSERTION'&&e.message.includes(message),name);
  assert.ok(changed);console.log('PASS detects '+name+' (memory only)');
 }
 console.log('PASS: 4 posture faults detected without changing saved source');
})().catch(e=>{console.error(e);process.exitCode=1;});
