const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-trc-game.cjs'),'utf8'),boundary=fixture.indexOf('  const local=harness({realMap:true});');
if(boundary<0)throw Error('Harness boundary changed');
const suite=`
 const local=harness({realMap:true});local.reset();
 local.run("mode='menu';$('map-select').value='trc';startGame();startRound();clearBots();match.phase='live';elapsed=10;player.alive=true;");
 function setupGuest(){local.run("onlinePlaying=true;online={host:false,session:{memberId:'self'},connectionId:'conn'};netActions=[];netActionSequence=0;var l=map.traversal.ladders[0];Object.assign(player,{x:l.x,y:0,z:l.z,vy:0,vx:0,vz:0,trcLadder:null});");}
 check('full64-action queue rejects ladder attachment without prediction or movement',()=>{
  setupGuest();local.run("netActions=Array.from({length:64},(_,i)=>({type:'skill',seq:i+1}));netActionSequence=64");const before=copy(local.run('({x:player.x,y:player.y,z:player.z})'));
  assert.equal(local.run('trcInteract()'),false);assert.equal(local.run('player.trcLadder'),null);assert.deepEqual(copy(local.run('({x:player.x,y:player.y,z:player.z})')),before);assert.equal(local.run('netActions.length'),64);
 });
 check('available queue sends one attach action; rejected detach retains predicted attachment',()=>{
  setupGuest();assert.equal(local.run('trcInteract()'),true);assert.equal(local.run('netActions.length'),1);assert.equal(local.run('netActions[0].type'),'trc-interact');assert.equal(local.run('player.trcLadder'),'L1');
  local.run("while(netActions.length<64)netActions.push({seq:++netActionSequence,type:'skill'})");assert.equal(local.run('trcInteract()'),false);assert.equal(local.run('player.trcLadder'),'L1');
 });
 check('TRC cues and prior bus-break/driver user cue coexist; map switches retain ground/bus systems',()=>{
  assert.equal(local.run("actionCueTypes.has('bus-break')&&actionCueTypes.has('door-open')&&actionCueTypes.has('duct-step')&&actionCueTypes.has('vehicle-hit')"),true);
  local.run("onlinePlaying=false;online=null;mode='menu';$('map-select').value='hirakata';startGame();startRound();busBreakAudioAt.set('bus',elapsed);resetTraffic()");assert.equal(local.run('busBreakAudioAt.size'),0);assert.equal(local.run('!!map.traffic&&!!map.destruction'),true);assert.equal(local.run("match.spike.status==='dropped'"),true);
  local.run("mode='menu';$('map-select').value='hashimoto';startGame();startRound()");assert.equal(local.run("map.id||'hashimoto'"),'hashimoto' );assert.equal(local.run('!!map.traversal'),false);
 });
 console.log('PASS '+groups+' merge integration groups; real savedgame; no audio device');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(fixture.slice(0,boundary)+suite,__filename);

