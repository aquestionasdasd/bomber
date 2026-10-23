const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-duck-game.cjs'),'utf8'),boundary=fixture.indexOf('  const local=harness();');
if(boundary<0)throw Error('Harness boundary changed');
const suite=`
 const local=harness();
 function setup(){local.reset();local.clearWalls();local.run("match.phase='live';soundEnabled=true;volume=.45;var audioCalls=[];gameAudio.play=(type,options)=>audioCalls.push({type,options});");}
 check('grounded jump emits exactly one soft cue; repeated airborne press is silent',()=>{
  setup();local.run('jump();jump();jump()');assert.equal(local.run('player.vy'),6.552);assert.deepEqual(copy(local.run('audioCalls.map(c=>c.type)')),['jump']);
  local.run('player.vy=0;jump()');assert.equal(local.run('audioCalls.length'),2);
 });
 check('pause/death/interaction/host pause block motion and sound; mute blocks sound only',()=>{
  for(const guard of ["mode='pause'","player.alive=false","interactionHeld=true","netHostPaused=true"]){setup();local.run(guard+';jump()');assert.equal(local.run('player.vy'),0);assert.equal(local.run('audioCalls.length'),0);}
  setup();local.run('soundEnabled=false;jump()');assert.equal(local.run('player.vy'),6.552);assert.equal(local.run('audioCalls.length'),0);
 });
 check('reload retains mechanical cue independently of jump',()=>{setup();local.run('player.ammo=0;player.reserve=20;reload()');assert.deepEqual(copy(local.run('audioCalls.map(c=>c.type)')),['reload']);});
 check('pad cue occurs once per launch, including reuse after landing',()=>{
  setup();local.run("player.kit=new DuelistKit({character:'duck'});ordinarySkills.cast('duck-pad',ordinaryActorView(player),{x:0,y:0,z:0},elapsed,match.round);elapsed+=.25;tickDuckPads();tickDuckPads()");
  assert.equal(local.run('player.vy'),11);assert.deepEqual(copy(local.run('audioCalls.map(c=>c.type)')),['duck-launch']);
  local.run('elapsed+=.1;player.vy=0;player.y=0;tickDuckPads()');assert.equal(local.run('audioCalls.length'),2);
 });
 check('flap cooldown rejects repeat sounds and uses dedicated cue',()=>{
  setup();local.run("player.kit=new DuelistKit({character:'duck'});ordinarySkills.cast('duck-hush',ordinaryActorView(player),{x:0,y:0,z:0},elapsed,match.round);jump();jump()");
  assert.deepEqual(copy(local.run('audioCalls.map(c=>c.type)')),['duck-flap']);
 });
 console.log('PASS: '+groups+' actual game audio groups; no audio device instantiated');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(fixture.slice(0,boundary)+suite,__filename);
