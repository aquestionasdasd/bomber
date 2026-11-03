const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');

// Saved game, real movement/collision/host input and JSON snapshots. The shared
// VM fixture disables WebGL, browser timers and audio; no browser or network.
async function main(){
 let fixture=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8');
 const cut=fixture.indexOf('  const local = harness();');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'hirakata-complete-fixture.cjs'),module);
 mod.filename=path.join(__dirname,'hirakata-complete-fixture.cjs');mod.paths=Module._nodeModulePaths(__dirname);
 mod._compile(fixture.slice(0,cut)+'\nreturn {harness,copy};\n}\nmodule.exports=main;',mod.filename);
 const {harness,copy}=await mod.exports(),local=harness(),host=harness(),guest=harness();
 let groups=0;const failures=[];
 const check=(name,fn)=>{if(process.env.HIRAKATA_GAME_GROUP&&!name.includes(process.env.HIRAKATA_GAME_GROUP))return;try{fn();groups++;console.log('PASS '+name);}catch(error){failures.push({name,error:error.message});console.error('FAIL '+name+': '+error.message);}};
 const near=(value,wanted,message,tolerance=.025)=>assert.ok(Math.abs(value-wanted)<=tolerance,`${message}: ${value} vs ${wanted}`);
 function setup(w,{layered=true,trc=false,roof=3.2}={}){
  w.run("map.id='hashimoto';map.layeredNavigation=false;map.traversal=undefined");
  w.reset();Object.assign(w.sandbox,{layeredFixture:layered,trcFixture:trc,roofFixture:roof});
  w.run(`
   map.id=trcFixture?'trc':layeredFixture?'hirakata':'hashimoto';
   map.layeredNavigation=layeredFixture;map.maxActorY=100;map.minY=trcFixture?-3.2:0;
   map.bounds=map.combatBounds={minX:-98,maxX:98,minZ:-123,maxZ:183};
   map.floorBaseAt=()=>0;map.world=new THREE.Group();map.traversal=undefined;
   map.colliders.length=0;map.ramps=[];
   var stair={id:'fixture-stair',minX:-2,maxX:2,minZ:0,maxZ:8,axis:'z',direction:1,base:0,height:roofFixture};
   for(let i=0;i<40;i++)map.colliders.push({minX:-2,maxX:2,minZ:i*.2,maxZ:(i+1)*.2,base:0,height:roofFixture*(i+1)/40,kind:'stairs',movementRamp:stair});
   map.ramps.push(stair);
   map.colliders.push({minX:-3,maxX:3,minZ:8,maxZ:15,base:roofFixture-.2,height:roofFixture,kind:'surface'});
   map.collision=createCollisionIndex(map.colliders);
   navigation={isWalkable:(x,z,y=0)=>canStand(x,z,.42,y)&&Math.abs(getZoneFloor(x,z,y+.05)-y)<.05,
    nearest:(x,z,y=0)=>canStand(x,z,.42,y)?{x,z,y}:null,
    path:(ax,az,bx,bz,ay=0,by=0)=>[{x:bx,z:bz,y:by}],clearSegment:()=>true};
   match.phase='live';mode='play';clearBots();clearCombatInput();elapsed=10;
   Object.assign(player,{x:0,z:-1,y:0,vy:0,crouch:0,alive:true,hp:100});
  `);
 }
 function remote(w,{x=0,z=-1,y=0}={}){
  Object.assign(w.sandbox,{remotePose:{x,z,y}});
  w.run(`makeBot(remotePose,1,'blue',{id:'blue-1',team:'blue',secondary:'classic',kit:new DuelistKit({character:'nope'}),credits:800});
   var remote=bots.at(-1);Object.assign(remote,{remoteId:'guest',netWeapon:'classic',netAmmo:12,netReserve:36,netReload:0,lastNetShot:-10});
   roster=[roster[0],remote.record];netParticipants.set('guest','blue-1');`);
 }
 check('new capability lets player and ordinary CPU climb/descend at 20/60/144Hz without TRC doors',()=>{
  for(const hz of [20,60,144])for(const who of ['player','cpu']){
   setup(local);Object.assign(local.sandbox,{hz,who});
   local.run(`var walker=who==='player'?player:{...player,id:'cpu',remoteId:null};
    for(let i=0;i<hz*4;i++){moveEntity(walker,0,3/hz,who==='cpu'?.4:.34);updateActorVertical(walker,1/hz,who==='cpu'?.4:.34);}`);
   near(local.run('walker.z'),11,who+' reaches top at '+hz);near(local.run('walker.y'),3.2,who+' top height');
   local.run(`for(let i=0;i<hz*4;i++){moveEntity(walker,0,-3/hz,who==='cpu'?.4:.34);updateActorVertical(walker,1/hz,who==='cpu'?.4:.34);}`);
   near(local.run('walker.z'),-1,who+' returns to bottom');near(local.run('walker.y'),0,who+' bottom height');
   local.run(`Object.assign(walker,{x:0,z:6,y:2.4,vy:0});moveEntity(walker,0,-.1,who==='cpu'?.4:.34);`);
   near(local.run('walker.y'),2.36,who+' remains in contact while descending before gravity',1e-6);
   assert.equal(local.run('map.traversal'),undefined);
  }
 });
 check('legacy flat-map CPU branch and ground drops remain unchanged',()=>{
  setup(local,{layered:false});
  local.run(`var walker={...player,id:'cpu',x:0,z:6,y:2.4,vy:0,remoteId:null};moveEntity(walker,0,-.1,.4);`);
  near(local.run('walker.y'),2.4,'legacy CPU retains its prior discrete gravity behavior',1e-6);
  local.run(`Object.assign(player,{x:0,z:10,y:3.2});dropItem('vandal',player);`);
  assert.equal(local.run('serializeDrops()[0].y'),undefined);
 });
 check('same-XZ ground passage stays below deck; stepping off upper deck falls and lands',()=>{
  setup(local);local.run(`Object.assign(player,{x:0,z:9,y:0,vy:0});for(let i=0;i<60;i++){moveEntity(player,0,.06);updateActorVertical(player,1/60);}`);
  near(local.run('player.y'),0,'ground stays under deck');
  local.run(`Object.assign(player,{x:0,z:14.8,y:3.2,vy:0});for(let i=0;i<15;i++){moveEntity(player,0,.06);updateActorVertical(player,1/60);}`);
  assert.ok(local.run('player.y')>2.7&&local.run('player.y')<3.2,'starts a gradual fall');
  local.run('for(let i=0;i<120;i++)updateActorVertical(player,1/60)');near(local.run('player.y'),0,'lands on ground');
 });
 check('manual and lethal bomber/weapon drops stay on the actual upper floor',()=>{
  setup(local);local.run(`Object.assign(player,{x:0,z:11,y:3.2,yaw:Math.PI,vy:0});var point=safeDropPoint();
   Object.assign(match.spike,{status:'carried',carrier:player.id});match.dropSpike(player.id,point.x,point.z,point.y||0);dropItem('vandal',player);`);
  near(local.run('point.y'),3.2,'manual bomber floor');near(local.run('match.spike.y'),3.2,'manual bomber y');near(local.run('serializeDrops()[0].y'),3.2,'weapon floor');
  setup(local);local.run(`Object.assign(player,{x:0,z:11,y:3.2,vy:0});inventory.primary='vandal';Object.assign(match.spike,{status:'carried',carrier:player.id});damageEntity(player,1000,null);`);
  near(local.run('match.spike.y'),3.2,'lethal bomber floor');near(local.run('serializeDrops()[0].y'),3.2,'lethal weapon floor');
 });
 check('layered dropped-weapon JSON keeps height and rejects invalid heights instead of grounding them',()=>{
  setup(local);local.run(`Object.assign(player,{x:0,z:11,y:3.2});dropItem('vandal',player);var packet=JSON.parse(JSON.stringify(serializeDrops()));clearDrops();syncDrops(packet);`);
  near(local.run('droppedWeapons[0]?.y'),3.2,'restored drop height');
  for(const y of [null,'3.2',-1,101,NaN,Infinity]){local.sandbox.invalidY=y;local.run('syncDrops([{...packet[0],y:invalidY}])');assert.equal(local.run('droppedWeapons.length'),0,'reject '+String(y));}
  setup(local,{layered:false,trc:true});local.run(`syncDrops([{id:1,weapon:'vandal',x:0,z:11,y:20,yaw:0,ammo:10,reserve:20}])`);
  near(local.run('droppedWeapons[0].y'),12,'legacy TRC clamp retained');
 });
 check('host rejects a forged upper-floor teleport and repeated airborne inputs do not relaunch',()=>{
  setup(host);remote(host,{x:8,z:0,y:0});
  host.run(`netInputs.set('guest',{seq:1,round:match.round,connection:'floor-check',received:elapsed,input:{x:remote.x,z:remote.z,y:6.4,yaw:0,pitch:0},actions:[]});updateRemoteActor(remote,.05);`);
  assert.ok(host.run('remote.y')>0&&host.run('remote.y')<.4,'host starts bounded jump, not requested teleport');
  host.run(`for(let i=0;i<80;i++){elapsed+=.05;netInputs.get('guest').received=elapsed;updateRemoteActor(remote,.05);}`);
  near(host.run('remote.y'),0,'host lands despite repeated airborne claim');near(host.run('remote.vy'),0,'host vertical velocity settled');
  host.run(`Object.assign(remote,{x:8,z:0,y:3,vy:0});elapsed+=1;for(let i=0;i<40;i++)updateRemoteActor(remote,.05);`);
  near(host.run('remote.y'),0,'stale network input still falls and lands');
 });
 check('a legitimate high-roof host pose is preserved only by explicit map maxActorY',()=>{
  setup(host,{roof:12});remote(host,{x:0,z:11,y:12});
  host.run(`netInputs.set('guest',{seq:1,round:match.round,connection:'roof-check',received:elapsed,input:{x:0,z:11,y:12,yaw:0,pitch:0},actions:[]});updateRemoteActor(remote,.05);`);
  near(host.run('remote.y'),12,'new roof host pose');
  setup(host,{layered:false,roof:12});remote(host,{x:0,z:11,y:12});
  host.run(`netInputs.set('guest',{seq:1,round:match.round,connection:'roof-check',received:elapsed,input:{x:0,z:11,y:12,yaw:0,pitch:0},actions:[]});updateRemoteActor(remote,.05);`);
  assert.ok(host.run('remote.y')<=11,'legacy input remains capped at 11');
 });
 check('expanded bus-break cues remain bounded by the new arena, with old-map limits retained',()=>{
  setup(local);local.run(`var packet={rules:{round:match.round,phase:'live'},time:elapsed};var cue={type:'bus-break',seq:1,round:match.round,x:0,y:1,z:150,time:elapsed};`);
  assert.equal(local.run('validBusBreakCue(cue,packet)'),true);
  local.run('cue.z=184');assert.equal(local.run('validBusBreakCue(cue,packet)'),false);
  local.run('cue.z=150;map.layeredNavigation=false;map.id="hashimoto"');assert.equal(local.run('validBusBreakCue(cue,packet)'),false);
 });
 check('independent host/guest JSON preserves upper drops without adding TRC fields; malformed Spike heights reject',()=>{
  setup(host);remote(host,{x:0,z:11,y:3.2});
  host.run(`dropItem('vandal',remote);Object.assign(match.spike,{status:'dropped',carrier:null,x:0,z:11,y:3.2});var captured;
   onlinePlaying=true;online={host:true,session:{memberId:'host',hostId:'host'},send:p=>captured=JSON.parse(JSON.stringify(p))};netClock=0;tickOnline(.1);`);
  const packet=copy(host.run('captured'));assert.equal(packet.trcDoors,undefined);assert.ok(Buffer.byteLength(JSON.stringify(packet))<65536);
  setup(guest);guest.run(`onlinePlaying=true;online={host:false,room:{code:'HIRAKATA'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','blue-1');`);
  guest.sandbox.packet=packet;guest.run("receiveNetPacket('host',packet)");
  near(guest.run('match.spike.y'),3.2,'guest bomber height');near(guest.run('droppedWeapons[0]?.y'),3.2,'guest weapon height');
  for(const y of [null,'3.2',-1,101]){guest.sandbox.bad={...copy(packet),time:99,rules:{...copy(packet.rules),spike:{...copy(packet.rules.spike),y}}};guest.run('applyNetSnapshot(bad)');assert.notEqual(guest.run('elapsed'),99,'reject invalid spike '+String(y));}
 });
 if(process.argv.includes('--actual')){
  const actual=harness({realMap:true});actual.reset();actual.run("selectArena('hirakata');match.phase='live';clearBots();mode='play';");
  check('actual Hirakata advertises layered physics and provides supported site floors and ground spawns',()=>{
   assert.equal(actual.run('map.layeredNavigation'),true);assert.equal(actual.run('map.traversal'),undefined);
   actual.run(`for(const p of Object.values(map.teamSpawns).flat()){if(!canStand(p.x,p.z,.4,0)||Math.abs(getZoneFloor(p.x,p.z,.05))>.01)throw Error('invalid spawn '+JSON.stringify(p));}for(const s of map.sites)for(const p of s.plantPositions){if(!canStand(p.x,p.z,.45,p.y||0)||Math.abs(getZoneFloor(p.x,p.z,(p.y||0)+.05)-(p.y||0))>.01)throw Error('invalid plant '+JSON.stringify(p));}`);
  });
  check('actual station main stairs carry ordinary CPU up and down',()=>{
   actual.run(`var walker={...player,id:'stairs-cpu',x:-34,z:12,y:0,vy:0,remoteId:null,crouch:0};for(let i=0;i<420;i++){moveEntity(walker,0,-3/60,.4);updateActorVertical(walker,1/60,.4);}`);
   near(actual.run('walker.z'),-9,'actual CPU stair destination');near(actual.run('walker.y'),6.4,'actual CPU stair top');
   actual.run(`for(let i=0;i<420;i++){moveEntity(walker,0,3/60,.4);updateActorVertical(walker,1/60,.4);}`);
   near(actual.run('walker.z'),12,'actual CPU stair return');near(actual.run('walker.y'),0,'actual CPU stair ground');
  });
  check('actual player traverses station stairs through one updatePlay call per frame',()=>{
   actual.run(`clearBots();makeBot({x:70,z:145},0,'red',{id:'test-enemy',team:'red',secondary:'classic'});bots[0].rangeTarget=true;
    clearCombatInput();Object.assign(player,{x:-34,z:12,y:0,vy:0,vx:0,vz:0,yaw:0,alive:true,hp:100});
    var frameCount=0;for(let frame=0;frame<240;frame++){if(player.z>-8)keys.add('KeyW');else keys.delete('KeyW');updatePlay(1/60);frameCount++;}`);
   assert.equal(actual.run('frameCount'),240);assert.ok(actual.run('player.z')<-7.7,'real key movement reaches concourse');near(actual.run('player.y'),6.4,'real updatePlay stair height');
   actual.run(`clearCombatInput();for(let frame=0;frame<240;frame++){if(player.z<12)keys.add('KeyS');else keys.delete('KeyS');updatePlay(1/60);frameCount++;}clearCombatInput();`);
   assert.equal(actual.run('frameCount'),480);assert.ok(actual.run('player.z')>11.7,'real key movement returns downstairs');near(actual.run('player.y'),0,'real updatePlay ground height');
  });
  check('actual 5v5 stays finite and its real host snapshots remain within 64 KiB',()=>{
   actual.run(`onlinePlaying=false;online=null;startGame();startRound();match.phase='live';mode='play';clearCombatInput();var frameCount=0;
    for(let frame=0;frame<180;frame++){updatePlay(1/60);frameCount++;for(const a of [player,...bots]){if(![a.x,a.y,a.z,a.vy].every(Number.isFinite))throw Error('nonfinite actor '+a.id);const b=activeArenaBounds();if(a.x<b.minX||a.x>b.maxX||a.z<b.minZ||a.z>b.maxZ)throw Error('out-of-bounds actor '+a.id);}}
    var wirePackets=[];onlinePlaying=true;online={host:true,session:{memberId:'host',hostId:'host'},send:p=>wirePackets.push(JSON.parse(JSON.stringify(p)))};netClock=0;tickOnline(.1);`);
   assert.equal(actual.run('frameCount'),180);assert.equal(actual.run('bots.length'),9);
   const packets=copy(actual.run('wirePackets'));assert.ok(packets.length>=2,'both team snapshots emitted');
   for(const packet of packets){assert.equal(packet.mapId,'hirakata');assert.equal(packet.actors.length,10);assert.equal(packet.trcDoors,undefined);assert.ok(Buffer.byteLength(JSON.stringify(packet))<=65536,'64 KiB wire cap');}
   console.log('ACTUAL '+JSON.stringify({frames:180,actors:10,packetBytes:packets.map(p=>Buffer.byteLength(JSON.stringify(p))),poses:copy(actual.run('[player,...bots].map(a=>({id:a.id,x:a.x,y:a.y,z:a.z}))'))}));
  });
 }
 if(process.argv.includes('--network')){
  // Reuse the established delay/coalescing transport fixture, without changing
  // its exact guest-vs-solo, authoritative ACK, or no-height-rewind assertions.
  const syncSource=fs.readFileSync(path.join(__dirname,'tests-trc-reconciliation.cjs'),'utf8');
  const syncCut=syncSource.indexOf('  const measured = [];');assert.ok(syncCut>0);
  const syncMod=new Module(path.join(__dirname,'hirakata-network-fixture.cjs'),module);
  syncMod.filename=path.join(__dirname,'hirakata-network-fixture.cjs');syncMod.paths=Module._nodeModulePaths(__dirname);
  syncMod._compile(syncSource.slice(0,syncCut)+'\nreturn {simulate};\n}\nmodule.exports=main;',syncMod.filename);
  const {simulate}=await syncMod.exports();
  for(const relay of [false,true])check('actual staircase delayed '+(relay?'coalesced HTTP':'direct')+' matches standalone without height rewinds',()=>{
   const result=simulate({arena:'hirakata',start:{x:-34,y:0,z:12},hz:60,delay:.1,relay,seconds:8.3,keys:['KeyW'],control:"keys.add('ShiftLeft');if(testTime>7.5)keys.clear()"});
   near(result.guest.y,6.4,'guest reaches real concourse');near(result.host.y,6.4,'host reaches real concourse');assert.ok(result.guest.z<-8,'client traversed full stair');
   console.log('NETWORK '+JSON.stringify(result));
  });
 }
 console.log(JSON.stringify({groups,failures,actual:process.argv.includes('--actual'),network:process.argv.includes('--network'),audio:false,browser:false}));
 assert.equal(failures.length,0,'Saved-game integration checks failed');
}
main().catch(error=>{console.error(error);process.exitCode=1});
