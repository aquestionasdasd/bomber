const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');

// Real saved game/map in an audio/WebGL/timer-inert VM. Controlled actors are
// initially placed near the objective; this is not a full match balance test.
async function main(){
 const fixture=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=fixture.indexOf('  const local = harness();');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'hirakata-east-b-fixture.cjs'),module);mod.filename=path.join(__dirname,'hirakata-east-b-fixture.cjs');mod.paths=Module._nodeModulePaths(__dirname);
 mod._compile(fixture.slice(0,cut)+'\nreturn {harness,copy};\n}\nmodule.exports=main;',mod.filename);
 const{harness,copy}=await mod.exports(),w=harness({realMap:true});w.reset();w.run("selectArena('hirakata');");
 const observations=[],failures=[];let groups=0;
 const check=(name,fn)=>{if(process.env.EAST_B_GROUP&&!name.includes(process.env.EAST_B_GROUP))return;try{fn();groups++;console.log('PASS '+name);}catch(e){failures.push({name,error:e.message});console.error('FAIL '+name+': '+e.message);}};
 const near=(actual,expected,label,tolerance=.025)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} vs ${expected}`);
 function reset(world=w,side='attack'){
  world.sandbox.startingSide=side;
  world.run(`online=null;onlinePlaying=false;clearCombatInput();clearBots();resetOrdinarySkills();elapsed=10;match=new MatchRules({startingSide});match.phase='live';mode='play';exploring=false;objectivePractice=null;netInputs.clear();netParticipants.clear();
   Object.assign(player,{id:'player',team:'blue',x:35,y:6.4,z:6,vy:0,vx:0,vz:0,yaw:0,pitch:0,crouch:0,alive:true,hp:100,armor:0,dashTimer:0,trafficLaunch:null,trcLadder:null,carMotion:null,carImpulseUntil:0});
   inventory={primary:null,secondary:'classic',active:'classic'};equip('classic',true);interactionHeld=false;Math.random=()=>.5;
   makeBot({x:70,z:145},0,'red',{id:'east-b-opponent',team:'red',secondary:'classic'});bots.at(-1).rangeTarget=true;`);
 }
 function planted(world=w){world.run("Object.assign(match.spike,{status:'planted',carrier:null,site:'B',x:35,y:6.4,z:6,timer:45,plantProgress:4,plantActor:null,defuseProgress:0,defuseActor:null,checkpoint:0});");}
 check('B is the pictured clear 2F East Gate plaza; paint, candidates and floor share its height',()=>{
  const result=copy(w.run(`(()=>{const site=map.sites.find(s=>s.id==='B'),blocked=[],missing=[],lines=[];let probes=0;
   for(let x=29;x<=41;x+=.5)for(let z=1;z<=11;z+=.5){probes++;if(!canStand(x,z,.42,6.4,1.7))blocked.push({x,z});if(Math.abs(getZoneFloor(x,z,6.45)-6.4)>.025)missing.push({x,z});}
   map.world.traverse(n=>{if(n.isLine&&n.geometry?.attributes.position){const a=n.geometry.attributes.position;if(a.count===5)lines.push(Array.from({length:5},(_,i)=>[a.getX(i),a.getY(i),a.getZ(i)]));}});
   return{site,probes,blocked,missing,lines,oldArea:isInsideSite(site,-8,-54),a:map.sites.find(s=>s.id==='A')};})()`));
  near(result.site.x,35,'B x');near(result.site.z,6,'B z');near(result.site.y,6.4,'B floor');assert.deepEqual(result.site.polygon,[[29,1],[41,1],[41,11],[29,11]]);assert.match(result.site.name,/東改札/);
  assert.equal(result.probes,525);assert.deepEqual(result.blocked,[]);assert.deepEqual(result.missing,[]);assert.equal(result.oldArea,false);near(result.a.x,-24,'A x unchanged');near(result.a.z,22,'A z unchanged');
  assert.ok(result.lines.some(points=>points.every(p=>Math.abs(p[1]-6.49)<1e-5)&&points.slice(0,4).every(([x,,z],i)=>x===result.site.polygon[i][0]&&z===result.site.polygon[i][1])),'B painted perimeter at upper floor');
  for(const p of result.site.plantPositions){near(p.y,6.4,'candidate y');w.sandbox.p=p;assert.equal(w.run("isInsideSite(map.sites.find(s=>s.id==='B'),p.x,p.z,{margin:.45})&&canStand(p.x,p.z,.45,p.y,1.7)"),true);}
  observations.push({kind:'map',...result});
 });
 for(const hz of[20,60,144])check('local player plants and defuses via one real updatePlay per frame at '+hz+'Hz',()=>{
  reset();w.sandbox.hz=hz;
  assert.equal(w.run("objectiveActionFor(player)?.kind"),'plant');w.run('interactionHeld=true;for(let i=0;i<hz*4;i++)updatePlay(1/hz);');
  assert.equal(w.run('match.spike.status'),'planted');assert.equal(w.run('match.spike.site'),'B');near(w.run('match.spike.y'),6.4,'planted bomber height');near(w.run('spikeModel.position.y'),6.4,'visible model height');
  const plantedState=copy(w.run('match.spike'));
  reset(w,'defend');planted();assert.equal(w.run('objectiveActionFor(player)?.kind'),'defuse');w.run('interactionHeld=true;for(let i=0;i<hz*7;i++)updatePlay(1/hz);');
  assert.equal(w.run('match.spike.status'),'defused');assert.equal(w.run('match.lastRound.reason'),'defuse');near(w.run('match.spike.y'),6.4,'defused bomber retained height');observations.push({kind:'local',hz,plantFrames:hz*4,defuseFrames:hz*7,planted:plantedState});
 });
 check('wrong floor, unsupported height, airborne and moving actor cannot perform B work',()=>{
  const cases=[{label:'below',y:0,vy:0},{label:'above',y:13.1,vy:0},{label:'airborne',y:6.6,vy:1},{label:'upward velocity on floor',y:6.4,vy:1}];
  for(const side of['attack','defend'])for(const pose of cases){reset(w,side);if(side==='defend')planted();Object.assign(w.sandbox,{pose});w.run('Object.assign(player,pose);interactionHeld=true;');assert.equal(w.run('objectiveActionFor(player)'),null,side+' '+pose.label);w.run('updateInteraction(.1,true)');assert.equal(w.run('match.spike.plantProgress'),side==='defend'?4:0);assert.equal(w.run('match.spike.defuseProgress'),0);}
  reset();w.run('interactionHeld=true;updateInteraction(.1,false)');assert.equal(w.run('match.spike.plantProgress'),0,'moving player cannot plant');
  reset();w.run('player.x=-8;player.z=-54;player.y=0;');assert.equal(w.run('objectiveActionFor(player)'),null,'old north plaza is no longer B');
  reset();w.run('player.x=-24;player.z=22;player.y=0;');assert.equal(w.run('objectiveActionFor(player)?.site.id'),'A','ground A still works');
 });
 check('ordinary CPU uses upper plant goal and completes real objective work',()=>{
  reset();w.run(`Object.assign(player,{x:70,y:0,z:140});makeBot({x:35,y:6.4,z:10},1,'blue',{id:'blue-1',team:'blue',secondary:'classic'});var cpu=bots.at(-1);Object.assign(cpu,{x:35,y:6.4,z:10,vy:0});cpu.kit.smoke=cpu.kit.updraft=cpu.kit.dash=cpu.kit.ultPoints=0;match.spike.carrier=cpu.id;var cpuFrames=0;var cpuGoals=[];
   for(let i=0;i<360&&match.spike.status!=='planted';i++){updatePlay(1/60);cpuFrames++;if(cpu.goal)cpuGoals.push({...cpu.goal});}`);
  assert.equal(w.run('match.spike.status'),'planted');assert.equal(w.run('match.spike.site'),'B');assert.equal(w.run('match.spike.plantActor'),'blue-1');near(w.run('match.spike.y'),6.4,'CPU plant height');assert.ok(w.run('cpuGoals.some(p=>Math.abs((p.y||0)-6.4)<.025)'),'real CPU retained upper goal');observations.push({kind:'cpu-plant',frames:w.run('cpuFrames'),spike:copy(w.run('match.spike'))});
 });
 check('ordinary CPU defuser role retains bomber height and completes real defuse',()=>{
  reset(w,'defend');planted();w.run(`Object.assign(player,{x:70,y:0,z:140});makeBot({x:35,y:6.4,z:7},1,'blue',{id:'blue-1',team:'blue',secondary:'classic'});var cpu=bots.at(-1);Object.assign(cpu,{x:35,y:6.4,z:7,vy:0});cpu.kit.smoke=cpu.kit.updraft=cpu.kit.dash=cpu.kit.ultPoints=0;match.spike.timer=9;var cpuFrames=0;var roleGoals=[];
   for(let i=0;i<480&&match.spike.status==='planted';i++){updatePlay(1/60);cpuFrames++;const plan=updateBots.tactics.update({actors:[player,...bots],attackerTeam:match.attackerTeam,defenderTeam:match.defenderTeam,spike:match.spike,now:elapsed,remaining:match.roundTime});const role=plan.roles.get(cpu.id);if(role?.role==='defuse')roleGoals.push({...role.goal});}`);
  assert.equal(w.run('match.spike.status'),'defused');assert.equal(w.run('match.spike.defuseActor'),'blue-1');assert.ok(w.run('roleGoals.length>0&&roleGoals.every(p=>Math.abs((p.y||0)-6.4)<.025)'),'every defuse goal keeps upper plane');observations.push({kind:'cpu-defuse',frames:w.run('cpuFrames'),spike:copy(w.run('match.spike'))});
 });
 check('host-authoritative remote work and independent guest JSON preserve upper bomber height',()=>{
  reset();w.run(`Object.assign(player,{x:70,y:0,z:140});makeBot({x:35,y:6.4,z:6},1,'blue',{id:'blue-1',team:'blue',secondary:'classic'});var remote=bots.at(-1);Object.assign(remote,{x:35,y:6.4,z:6,vy:0,remoteId:'guest',netWeapon:'classic',netAmmo:12,netReserve:36,netReload:0,lastNetShot:-10});roster=[roster[0],remote.record];netParticipants.set('guest','blue-1');match.spike.carrier=remote.id;
   netInputs.set('guest',{seq:1,round:match.round,connection:'east-b',received:elapsed,input:{x:35,z:6,y:6.4,yaw:0,pitch:0,interact:true},actions:[]});for(let i=0;i<240;i++){elapsed+=1/60;netInputs.get('guest').received=elapsed;updateRemoteActor(remote,1/60);}
   var captured;onlinePlaying=true;online={host:true,session:{memberId:'host',hostId:'host'},send:p=>captured=JSON.parse(JSON.stringify(p))};netClock=0;tickOnline(.1);`);
  assert.equal(w.run('match.spike.status'),'planted');near(w.run('match.spike.y'),6.4,'remote planted y');const packet=copy(w.run('captured'));assert.ok(Buffer.byteLength(JSON.stringify(packet))<65536);assert.equal(packet.trcDoors,undefined);
  const guest=harness({realMap:true});guest.reset();guest.run("selectArena('hirakata');");reset(guest);guest.sandbox.packet=packet;guest.run("onlinePlaying=true;online={host:false,room:{code:'HIRAKATA'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','blue-1');receiveNetPacket('host',packet);");
  assert.equal(guest.run('match.spike.status'),'planted');near(guest.run('match.spike.y'),6.4,'guest snapshot y');
  for(const y of[null,'6.4',-1,101]){guest.sandbox.bad={...copy(packet),time:99,rules:{...copy(packet.rules),spike:{...copy(packet.rules.spike),y}}};guest.run('applyNetSnapshot(bad)');assert.notEqual(guest.run('elapsed'),99,'malformed y rejected '+String(y));}
  // A lower actor cannot defuse the upper planted device, even at matching XZ.
  w.run("onlinePlaying=false;online=null;remote.team=match.defenderTeam;remote.y=0;remote.vy=0;updateRemoteActor(remote,1/60);");assert.equal(w.run('match.spike.defuseProgress'),0,'remote wrong-floor work rejected');
  w.run("remote.y=6.4;remote.vy=0;for(let i=0;i<420;i++){elapsed+=1/60;netInputs.get('guest').received=elapsed;updateRemoteActor(remote,1/60);}");assert.equal(w.run('match.spike.status'),'defused');
  observations.push({kind:'host-guest',packetBytes:Buffer.byteLength(JSON.stringify(packet)),spike:packet.rules.spike,transport:'in-process host input and JSON snapshot; no live network'});
 });
 check('objective practice relocates B player and planted device onto 2F',()=>{
  for(const kind of['plant','defuse']){reset();w.sandbox.practiceKind=kind;w.run("objectivePractice={kind:practiceKind,site:'A',completed:false};var practiceReset=resetObjectivePractice('B');");assert.equal(w.run('practiceReset'),true);near(w.run('player.y'),6.4,'practice player floor');assert.equal(w.run('actorGrounded(player)'),true);if(kind==='defuse'){assert.equal(w.run('match.spike.status'),'planted');near(w.run('match.spike.y'),6.4,'practice bomber y');}}
 });
 const hashes=Object.fromEntries(['game.js','rules.js','site-areas.js','bot-tactics.js','hirakata-map.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'public',f))).digest('hex')]));
 const report={created:new Date().toISOString(),groups,failures,observations,hashes,audio:false,browser:false,limits:['Controlled objective fixtures, not normal 5v5 win-rate or balance evidence','In-process network snapshot test, not actual direct/HTTP latency or browser experience']};
 if(process.env.EAST_B_REPORT)fs.writeFileSync(process.env.EAST_B_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({groups,failures,audio:false,browser:false}));assert.equal(failures.length,0,'East Gate B objective checks failed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
