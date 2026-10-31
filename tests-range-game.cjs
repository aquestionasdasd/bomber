const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-bus-driving-game.cjs'),'utf8'),boundary=fixture.indexOf(' const local=harness({realMap:true});');
if(boundary<0)throw Error('Saved game harness boundary missing');
const suite=String.raw`
 const h=harness({realMap:true});
 function setup(map='hashimoto',character='nope'){
  h.sandbox.mapId=map;h.sandbox.agentId=character;
  h.run("online=null;onlinePlaying=false;mode='menu';$('map-select').value=mapId;$('agent-select').value=agentId;$('match-format').value='range';startGame();Math.random=()=>.5;lastShot=-10;renderedRecoil=0;player.recoil=0;soundEnabled=false");
 }
 function signShot(id='vandal'){
  h.sandbox.gunId=id;
  h.run("equip(gunId,true);var sign=new THREE.Vector3();rangeControl.face.getWorldPosition(sign);player.yaw=Math.atan2(player.x-sign.x,player.z-sign.z);player.pitch=Math.atan2(sign.y-(1.7-player.crouch*.55+player.y),Math.hypot(sign.x-player.x,sign.z-player.z));renderedRecoil=0;player.recoil=0;shotSequence=0;elapsed+=1;shoot()");
 }
 const guns=Object.keys(imported.WEAPONS).filter(id=>imported.WEAPONS[id].mag>0);
 check('range waits indefinitely with no target or statistics until an actual bullet hits START on all three real maps/all ten guns',()=>{
  for(const map of ['hashimoto','hirakata','trc'])for(const id of guns){
   setup(map);assert.equal(h.run('bots.length'),0);assert.equal(h.run('rangeSession.started'),false);
   h.run('updatePlay(5);rangeSession.recordShot();rangeSession.recordHit({head:true,eliminated:true})');
   assert.equal(h.run('rangeSession.remaining'),60);assert.equal(h.run('rangeSession.score+rangeSession.shots+rangeSession.hits'),0);
   signShot(id);assert.equal(h.run('rangeSession.started'),true,map+'/'+id);assert.equal(h.run('bots.length'),1);
   assert.equal(h.run('bots[0].hp'),100,'start pellets must not hit newly spawned target');assert.equal(h.run('rangeSession.shots'),0);
   assert.equal(h.run('rangeControl.group.parent'),null);assert.equal(h.run('startRangeDrill()'),false);
  }
 });
 check('misses and knife swings cannot start; a real solid surface in front of the sign blocks activation',()=>{
  setup();h.run('player.yaw+=Math.PI;elapsed+=1;shoot()');assert.equal(h.run('rangeSession.started'),false);
  signShot('knife');assert.equal(h.run('rangeSession.started'),false);
  h.wall({x:h.run('player.x'),z:h.run('player.z')-1.5,width:4,depth:.2});signShot();assert.equal(h.run('rangeSession.started'),false);
  h.run('backMenu()');
 });
 check('finite clip/reserve values replenish for all ten guns without reload or cadence bypass and HUD shows infinity',()=>{
  // Fresh game world: the blocking wall in the previous case is deliberately persistent.
  for(const id of guns){setup('hirakata');signShot(id);h.run('player.yaw+=Math.PI;player.pitch=0');
   const mag=imported.WEAPONS[id].mag;
   for(let i=0;i<mag*2+2;i++)h.run('elapsed+=1;renderedRecoil=0;shoot()');
   assert.equal(h.run('player.ammo'),mag,id);assert.equal(h.run('player.reserve'),imported.WEAPONS[id].reserve,id);
   assert.equal(h.run("$('ammo').textContent"),'∞');assert.equal(h.run("$('reserve').textContent"),'∞');
   h.run('player.ammo=0;player.reserve=0;reload()');assert.equal(h.run('reloading'),0);assert.equal(h.run('player.ammo'),mag);
   const shots=h.run('rangeSession.shots');h.run('shoot()');assert.equal(h.run('rangeSession.shots'),shots,'cadence preserved');
  }
 });
 check('all fifteen kits replenish CQEX before and during the drill while prepared E and active knives retain their state',()=>{
  for(const id of Object.keys(imported.CHARACTER_DEFS)){
   setup('trc',id);h.run('player.kit.smoke=0;player.kit.updraft=0;player.kit.dash=0;player.kit.nextSignatureAt=elapsed+99;player.kit.ultPoints=0;refillMapPracticeSkills()');
   assert.equal(h.run('player.kit.smoke'),imported.getCharacterSkill(id,'c').max,id);
   assert.equal(h.run('player.kit.updraft'),imported.getCharacterSkill(id,'q').max,id);
   assert.equal(h.run('player.kit.dash'),1,id);assert.equal(h.run('player.kit.ultPoints'),7,id);
   signShot();h.run('player.kit.smoke=0;player.kit.updraft=0;player.kit.dash=0;player.kit.nextSignatureAt=elapsed+99;player.kit.ultPoints=0;updatePlay(.01)');
   assert.equal(h.run('player.kit.smoke'),imported.getCharacterSkill(id,'c').max,id);assert.equal(h.run('player.kit.dash'),1,id);assert.equal(h.run('player.kit.ultPoints'),7,id);
  }
  setup('trc','duelist');h.run('player.kit.activate("e",elapsed);var arm=player.kit.armExpiresAt;refillMapPracticeSkills()');assert.equal(h.run('player.kit.armExpiresAt'),h.run('arm'));assert.equal(h.run('player.kit.dash'),0);
  h.run('player.kit.activate("x",elapsed);player.kit.knives=0;updatePlay(.01)');assert.equal(h.run('player.kit.knivesActive'),true);assert.equal(h.run('player.kit.knives'),5);
 });
 check('actual casts exceed stock and recharge limits in waiting and live drills without bypassing the twenty-event ceiling',()=>{
  setup('trc','nope');
  const ids=new Set();for(let i=0;i<5;i++){h.run("player.yaw=0;player.pitch=-.2;useAbility('c')");assert.equal(h.run('player.kit.smoke'),2);for(const e of h.run('ordinarySkills.snapshot().events'))ids.add(e.id);h.run('updatePlay(1.7)');}
  assert.equal(h.run('rangeSession.started'),false);assert.equal(h.run('rangeSession.time'),0);
  // Count successful event IDs, not just replenished inventory.
  assert.equal(ids.size,5);
  setup('trc','echo');signShot();
  for(let i=0;i<22;i++){h.run("useAbility('x')");assert.equal(h.run('player.kit.ultPoints'),7);}
  assert.equal(h.run('teamAbilities.snapshot().events.length'),20,'original bounded event queue remains enforced');
  h.run('updatePlay(7)');assert.equal(h.run('teamAbilities.snapshot().events.length'),0);h.run("useAbility('x')");assert.equal(h.run('teamAbilities.snapshot().events.length'),1);
  h.run("backMenu();$('match-format').value='standard';startGame();match.phase='live';equip('vandal',true);lastShot=-10;elapsed+=1;shoot()");assert.equal(h.run('player.ammo'),imported.WEAPONS.vandal.mag-1,'normal live ammo remains finite');
 });
 check('unlimited resources never leak into normal matches objective practice online or dead actors',()=>{
  for(const guard of ['rangeSession=null','exploring=false','onlinePlaying=true','player.alive=false']){
   setup('trc');h.sandbox.guard=guard;h.run(guard+';player.ammo=0;player.reserve=0;refillRangeAmmo()');assert.equal(h.run('player.ammo+player.reserve'),0,guard);
  }
  for(const guard of ['rangeSession=null;exploring=false','objectivePractice={}','onlinePlaying=true','player.alive=false']){
   setup('trc');h.run(guard+';player.kit.smoke=0;player.kit.updraft=0;player.kit.dash=0;player.kit.ultPoints=0;refillMapPracticeSkills()');assert.equal(h.run('player.kit.smoke+player.kit.updraft+player.kit.dash+player.kit.ultPoints'),0,guard);
  }
 });
 check('actual head/body kills respawn one target with score and end at sixty seconds; retry/menu remove or restore the sign',()=>{
  setup('trc');signShot();
  function targetShot(height){h.sandbox.height=height;h.run('player.yaw=Math.atan2(player.x-bots[0].x,player.z-bots[0].z);player.pitch=Math.atan2(bots[0].y+height-(1.7-player.crouch*.55+player.y),Math.hypot(bots[0].x-player.x,bots[0].z-player.z));elapsed+=.3;shotSequence=0;renderedRecoil=0;player.recoil=0;shoot()');}
  targetShot(1.62);assert.equal(h.run('rangeSession.score'),150);assert.equal(h.run('bots[0].alive'),false);
  h.run('updatePlay(.2)');assert.equal(h.run('bots.length'),1);assert.equal(h.run('bots[0].alive'),true);
  for(let i=0;i<4&&h.run('bots[0].alive');i++)targetShot(1.05);
  assert.equal(h.run('rangeSession.score'),250);h.run('updatePlay(60)');assert.equal(h.run('mode'),'result');assert.equal(h.run('bots.length'),0);assert.equal(h.run('rangeControl.group.parent'),null);
  h.run('startGame()');assert.equal(h.run('rangeSession.started'),false);assert.equal(h.run('rangeSession.remaining'),60);assert.equal(h.run('bots.length'),0);assert.equal(h.run('rangeControl.group.parent===environment'),true);
  h.run('backMenu()');assert.equal(h.run('rangeSession'),null);assert.equal(h.run('rangeControl.group.parent'),null);
  h.run("$('match-format').value='standard';startGame()");assert.equal(h.run('rangeControl.group.parent'),null);assert.equal(h.run('bots.length'),9);
 });
 check('20 60 and 144Hz full game frames preserve waiting then exactly sixty seconds without extra targets',()=>{
  for(const hz of [20,60,144]){setup('trc');for(let i=0;i<hz;i++)h.run('updatePlay(1/'+hz+')');assert.equal(h.run('rangeSession.time'),0);signShot();for(let i=0;i<hz*60&&h.run("mode==='play'");i++)h.run('updatePlay(1/'+hz+')');near(h.run('rangeSession.time'),60,'60 second clock');assert.equal(h.run('mode'),'result');assert.equal(h.run('bots.length'),0);}
 });
 console.log('PASS '+groups+' actual savedgame range groups; real bullet rays, three maps, ten guns, fifteen kits; no playback');
 console.log('TOTAL '+Math.round(performance.now()-started)+'ms wall / '+Math.round(process.cpuUsage(cpuStarted).user/1000)+'ms CPU');
}main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const prefix=fixture.slice(0,boundary).replace("const check = (label, fn) => { fn();","const check = (label, fn) => { if(process.env.RANGE_GROUP&&!label.includes(process.env.RANGE_GROUP))return; fn();");
const test=new Module(__filename,module);test.filename=__filename;test.paths=module.paths;test._compile(prefix+suite,__filename);
