const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-onnara-game.cjs'),'utf8');
const boundary=fixture.indexOf(' const local=harness();');
if(boundary<0)throw Error('Saved-game harness boundary changed');
function runTests(){
 function setup(){local.reset();local.clearWalls();local.run("match.phase='live';mode='play';exploring=true;player.kit=new DuelistKit({character:'frost'});keys.clear();netActions=[];netApplied.clear();netInputs.clear();netParticipants.clear();netSequence=0;netHasSnapshot=false;netRound=0;netClock=0;var heard=[];gameAudio.play=(name)=>heard.push(name);");}
 const e=()=>local.run("activateAbility(player,'e')");
 function step(n=1){local.run('for(let i=0;i<'+n+';i++){updatePlay(.05);updateOrdinarySkills();renderOrdinarySkills()}');}
 check('entry curve lasts .9 seconds while five-second slow resistance and18-second recharge remain',()=>{
  setup();assert.ok(e());near(local.run('frostSlideSpeed(player)'),12,'initial');local.run('elapsed+=.45');near(local.run('frostSlideSpeed(player)'),9.5,'midpoint');local.run('elapsed+=.45');near(local.run('frostSlideSpeed(player)'),0,'end');
  near(local.run('ordinarySkills.mitigateSlow(ordinaryActorView(player),.45,elapsed)'),.9175,'retained mitigation');near(local.run('player.kit.nextSignatureAt'),28,'cooldown');near(local.run('actorSpeedScale(player)'),1,'normal scale unchanged');
 });
 check('actual input moves substantially farther in low stance and publishes meaningful HUD and grounded trails',()=>{
  setup();local.run("keys.add('KeyW')");step(18);const normal=-local.run('player.z');
  setup();assert.ok(e());local.run("keys.add('KeyW')");step(8);assert.ok(local.run('player.crouch')>.95);assert.ok(local.run("$('status-effects').textContent.includes('リボンスライド')"));
  const fx=local.run("frostSkillFX.group.children.find(m=>m.name.includes('supported inner')).count");assert.ok(fx>6,local.run('JSON.stringify({fx:'+fx+',time:elapsed,moving:player.moving,ground:ordinaryGroundHeight(player.x,player.z,player.y),e:ordinarySkills.events(elapsed)})'));step(10);const sliding=-local.run('player.z');assert.ok(sliding>normal*1.2,JSON.stringify({normal,sliding}));assert.ok(sliding<10,'bounded travel');
  local.run('elapsed+=1;updatePlay(.1)');assert.ok(local.run('player.crouch')<.1,'standing restored');
 });
 check('no input means no forced travel; released input brakes, and no speed/aim/weapon bonus leaks after entry',()=>{
  setup();e();step(5);near(local.run('Math.hypot(player.x,player.z)'),0,'stationary');
  local.run("keys.add('KeyW')");step(4);const at=local.run('player.z');local.run('keys.clear()');step(6);assert.ok(at-local.run('player.z')<1,'brakes promptly');near(local.run('player.vz'),0,'stopped');
  local.run('elapsed+=1');near(local.run('frostSlideSpeed(player)'),0,'expired');near(local.run('nobiShotInterval(weapon(),player)'),local.run('weapon().interval'),'no firing bonus');
 });
 check('wall collision rejects high-speed tunnelling and actual jump still uses the protected6.552 impulse',()=>{
  setup();local.wall({z:-2,width:20,depth:.5});e();local.run("keys.add('KeyW')");step(20);assert.ok(local.run('player.z')>-1.5,'wall blocks slide');
  setup();e();local.run('player.vy=6.552');step(1);near(local.run('frostSlideSpeed(player)'),0,'air ends entry');assert.ok(local.run('player.vy')<6.552&&local.run('player.vy')>5.7,'normal gravity');
  step(35);near(local.run('player.y'),0,'lands');near(local.run('frostSlideSpeed(player)'),0,'landing cannot restart');
 });
 check('death, team change, round change and menu reset clean the same event instead of restarting the entry',()=>{
  for(const code of ['player.alive=false;player.hp=0',"player.team='red'",'player.y=2;player.vy=1']){setup();e();local.run(code);near(local.run('frostSlideSpeed(player)'),0,code);local.run("player.alive=true;player.hp=100;player.team='blue';player.y=0;player.vy=0");near(local.run('frostSlideSpeed(player)'),0,'never revived');}
  setup();e();local.run('ordinarySkills.update([],elapsed,match.round+1)');near(local.run('frostSlideSpeed(player)'),0,'next round');setup();e();local.run('resetOrdinarySkills()');near(local.run('frostSlideSpeed(player)'),0,'menu cleanup');
 });
 check('real station stair support is retained during a grounded entry and leaving its floor ends the event',()=>{
  const real=harness({realMap:true});real.reset();real.run("match.phase='live';mode='play';exploring=true;player.kit=new DuelistKit({character:'frost'});var stair=map.ramps[0];player.x=(stair.minX+stair.maxX)/2;player.z=stair.maxZ-.35;player.y=rampFloor(player.x,player.z);player.vy=0;player.yaw=0;var startZ=player.z;var startY=player.y;activateAbility(player,'e');keys.add('KeyW');for(let i=0;i<12;i++){updatePlay(.025);updateOrdinarySkills()}");
  assert.ok(real.run('player.z<startZ-1'),'advances on real stair');assert.ok(real.run('player.y>startY+.1'),real.run('JSON.stringify({stair,x:player.x,z:player.z,y:player.y,startY,startZ})'));near(real.run('player.y'),real.run('rampFloor(player.x,player.z)'),'exact stair support');assert.ok(real.run('actorGrounded(player)'));assert.ok(real.run('frostSlideSpeed(player)>0'));
  real.run('player.y+=1;player.vy=1');near(real.run('frostSlideSpeed(player)'),0,'actual stair departure');
 });
 check('strict JSON carries the existing event only and delayed restore uses remaining entry age',()=>{
  setup();e();const packet=copy(local.run('ordinarySkills.snapshot()'));assert.equal(packet.events.length,1);assert.deepEqual(Object.keys(packet.events[0]).sort(),['id','type','team','sourceId','round','fromX','fromY','fromZ','x','y','z','startedAt','flight','triggerAt','endsAt','radius'].sort());
  local.sandbox.packet=packet;local.run('var remoteEngine=createCharacterSkills();remoteEngine.restore(packet,10.6,match.round)');near(local.run('remoteEngine.frostSlideSpeed(ordinaryActorView(player),10.6)'),12-5*.6/.9,'delayed curve');
  local.run('remoteEngine.restore(packet,11.1,match.round)');near(local.run('remoteEngine.frostSlideSpeed(ordinaryActorView(player),11.1)'),0,'not replayed');
 });
 check('twenty events reject E, roll inventory back, and never erase another ability',()=>{
  setup();local.run("for(let i=0;i<20;i++)ordinarySkills.cast('car-gyro',{id:'fill-'+i,team:'red',x:10,y:0,z:10,hp:100,alive:true},{x:10,y:0,z:10},elapsed,match.round)");const before=copy(local.run('player.kit.snapshot()'));assert.equal(e(),undefined);assert.deepEqual(copy(local.run('player.kit.snapshot()')),before);assert.equal(local.run('ordinarySkills.events(elapsed).length'),20);
 });
 check('BOT uses a reachable entry without seeing an enemy and keeps it when stationary, blind, airborne or route-blocked',()=>{
  function bot(){setup();local.run("player.alive=false;makeBot({x:0,z:10},0,'blue',{id:'doll',team:'blue',primary:'vandal',secondary:'classic',kit:new DuelistKit({character:'frost'})});var doll=bots[0];doll.kit.smoke=0;doll.kit.updraft=0;doll.kit.ultPoints=0;Object.assign(doll,{nextSkillAt:0,aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0});var goal={x:0,z:-10};updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{roles:new Map([[doll.id,{goal,role:'rotate',urgent:false}]])}}}");}
  bot();local.run('updateBots(.1)');assert.equal(local.run('doll.kit.dash'),0);local.run('elapsed+=.1;updateBots(.1)');assert.ok(local.run('doll.crouch')>.9);assert.equal(local.run('doll.target'),null,'no magic target');
  for(const code of ['goal={x:0,z:10}','navigation.path=()=>[]','doll.y=2;doll.vy=1','doll.aiReload=1',"doll.group.rotation.y=Math.PI;ordinarySkills.cast('nope-flash',{id:'flash',team:'red',x:0,y:0,z:8,hp:100,alive:true},{x:0,y:1.7,z:8},elapsed,match.round);elapsed+=NOPE_SKILLS.flashFlight+.01;updateOrdinarySkills()"]){bot();local.run(code+';updateBots(.1)');assert.equal(local.run('doll.kit.dash'),1,code);}
 });
 check('quiet input and low posture cannot hide entry footsteps from actual hearing',()=>{
  setup();e();local.run("keys.add('KeyW');keys.add('ShiftLeft')");step(10);assert.ok(local.run("heard.includes('step')"),'audible step cue');assert.ok(local.run('player.moving'));
  assert.ok(local.run("botHearing.listen({team:'red',x:player.x,z:player.z+2,y:0},elapsed)"),'actual fixed-position hearing pulse');
 });
 check('visible rig lowers only during entry and resets for expiry, death and victory dance',()=>{
  setup();local.run("var model=createAgentModel(THREE,{character:'frost'});var rig=model.group.children[0];");
  local.run("model.update(.05,{character:'frost',alive:true,moving:true,sliding:true})");near(local.run('rig.scale.y'),.65,'low silhouette');
  for(const state of ['{alive:true,sliding:false}','{alive:false,sliding:true}','{alive:true,sliding:true,dancing:true}']){local.run('model.update(.05,'+state+')');near(local.run('rig.scale.y'),1,'reset');}local.run('model.dispose()');
 });
 check('independent host/guest ACK gates speed, accepts the bounded curve, and quiet cannot hide remote entry',()=>{
  const host=harness(),guest=harness();host.reset();guest.reset();host.clearWalls();guest.clearWalls();
  for(const h of [host,guest])h.run('netActions=[];netApplied.clear();netInputs.clear();netParticipants.clear();netSequence=0;netLastSnapshot=0;netActionSequence=0;netHasSnapshot=false;netRound=0;netClock=0');
  host.run("match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'remote-doll',team:'red',primary:'vandal',secondary:'classic',kit:new DuelistKit({character:'frost'})});var doll=bots[0];Object.assign(doll,{remoteId:'guest',netWeapon:'vandal',netAmmo:25,netReserve:75,netReload:0});netParticipants.set('guest',doll.id);onlinePlaying=true;var captured;online={host:true,session:{memberId:'host'},send:p=>{captured=p;}};tickOnline(.1)");
  guest.run("onlinePlaying=true;var outgoing;online={host:false,room:{code:'TESTROOM'},session:{memberId:'guest',hostId:'host'},send:p=>{outgoing=p;}};netParticipants.set('guest','remote-doll')");
  const sync=()=>{guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer)");};sync();guest.run("useAbility('e');tickOnline(.1)");near(guest.run('frostSlideSpeed(player)'),0,'unacknowledged');
  host.sandbox.transfer=copy(guest.run('outgoing'));host.run("receiveNetPacket('guest',transfer);elapsed+=.01;updateRemoteActor(doll,.01);receiveNetPacket('guest',transfer);elapsed+=.01;updateRemoteActor(doll,.01);tickOnline(.1)");sync();assert.equal(host.run("ordinarySkills.events(elapsed).filter(e=>e.type==='frost-unravel').length"),1);assert.ok(guest.run('frostSlideSpeed(player)')>11);
  host.run("var heard=[];gameAudio.play=name=>heard.push(name);var firstZ=doll.z;var ni=netInputs.get('guest');ni.input={...ni.input,x:0,z:-60,y:0,quiet:true,crouch:1};for(let i=0;i<5;i++){elapsed+=.08;ni.received=elapsed;ni.seq++;updateRemoteActor(doll,.08)}");const travel=host.run('firstZ-doll.z');assert.ok(travel>3&&travel<5,'host bounded travel '+travel);assert.ok(host.run("heard.includes('step')"));
  guest.run('player.y=.5;player.vy=1');near(guest.run('frostSlideSpeed(player)'),0,'guest air stop');guest.run('actorSpeedScale(player);player.y=0;player.vy=0');
  host.run('tickOnline(.1)');sync();near(guest.run('frostSlideSpeed(player)'),0,'late same-event ACK cannot revive entry');assert.ok(guest.run('stoppedFrostEvents.size')>0,'stop history retained');
  guest.run('netHasSnapshot=false');host.run('tickOnline(.1)');sync();near(guest.run('frostSlideSpeed(player)'),0,'fresh same-round reconnect cannot revive entry');
  host.run('elapsed+=1;tickOnline(.1)');sync();near(guest.run('frostSlideSpeed(player)'),0,'expired ACK');
 });
}
const suite=' const local=harness();\n'+runTests.toString()+'\n runTests();\n console.log("PASS: "+groups+" actual-game slide/physics/policy/JSON/authority/model groups; silent; "+Math.round(performance.now()-started)+"ms wall / "+Math.round((process.cpuUsage(cpuStarted).user+process.cpuUsage(cpuStarted).system)/1000)+"ms CPU");\n}\nmain().catch(error=>{console.error(error);process.exitCode=1;});';
const runner=new Module(path.join(__dirname,'frost-slide-harness.cjs'),module);runner.filename=path.join(__dirname,'frost-slide-harness.cjs');runner.paths=Module._nodeModulePaths(__dirname);runner._compile(fixture.slice(0,boundary)+suite,runner.filename);
