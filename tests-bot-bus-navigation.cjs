const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-onnara-game.cjs'),'utf8'),boundary=fixture.indexOf(' const local=harness();');
if(boundary<0)throw Error('Saved-game harness boundary changed');
const suite=String.raw`
 const {createTrafficClock}=await load('bus-traffic.js');
 const local=harness();local.sandbox.createTrafficClock=createTrafficClock;
 function setup({x=-8,z=0,goalX=8,goalZ=0,yaw=0}={}){
  local.reset();local.clearWalls();local.sandbox.config={x,z,goalX,goalZ,yaw};local.run("map.traffic=createTrafficClock();map.traffic.service.restore([[0,0,-1,0,0,0,config.yaw,0,[]]],[],elapsed);navigation=createNavigation(map);difficulty='hard';match.phase='live';match.spike.status='carried';match.spike.carrier='other';Object.assign(player,{x:60,z:60,hp:0,alive:false});makeBot({x:config.x,z:config.z},0,'blue',{id:'walker',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'nope'})});var walker=bots[0];walker.kit.smoke=0;walker.kit.updraft=0;walker.kit.dash=0;walker.kit.ultPoints=0;walker.target=null;walker.fire=999;walker.nextSkillAt=999;walker.think=999;var objective={x:config.goalX,z:config.goalZ};updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',roles:new Map([[walker.id,{goal:objective,siteId:'A',role:'advance'}]])}}};Math.random=()=>.2;var trail=[];");
 }
 function walk(seconds=12,hz=20){local.sandbox.steps=Math.ceil(seconds*hz);local.sandbox.dtValue=1/hz;local.run('for(let i=0;i<steps;i++){elapsed+=dtValue;updateBots(dtValue);trail.push({x:walker.x,z:walker.z})}');}
 check('actual BOT walks around a permanently stopped bus rather than waiting at its flank',()=>{
  setup();walk();const remaining=local.run('Math.hypot(walker.x-objective.x,walker.z-objective.z)');assert.ok(remaining<.5,'BOT stuck '+JSON.stringify(copy(local.run('({x:walker.x,z:walker.z,remaining:Math.hypot(walker.x-objective.x,walker.z-objective.z)})'))));assert.ok(local.run('trail.some(p=>Math.abs(p.z)>6.4)'),'no end detour');
 });
 check('rotated bus and a pair of stopped buses remain solid while BOTs detour',()=>{
  for(const yaw of[Math.PI/2,.73]){setup({yaw});walk(14);assert.ok(local.run('Math.hypot(walker.x-objective.x,walker.z-objective.z)<.5'));}
  setup();local.run('map.traffic.service.restore([[0,0,-1,0,0,-5.7,0,0,[]],[1,0,-1,0,0,5.7,0,0,[]]],[],elapsed)');walk(18);assert.ok(local.run('Math.hypot(walker.x-objective.x,walker.z-objective.z)<.5'));assert.ok(local.run('trail.some(p=>Math.abs(p.z)>12)'));
 });
 check('BOT already within a stopped bus safety margin walks out continuously, then resumes its task at 20/60/144Hz',()=>{
  for(const hz of[20,60,144]){setup({x:-1.9});walk(10,hz);assert.ok(local.run('Math.hypot(walker.x-objective.x,walker.z-objective.z)<.5'),'escape '+hz);const trail=copy(local.run('trail'));let last={x:-1.9,z:0};for(const p of trail){assert.ok(Math.hypot(p.x-last.x,p.z-last.z)<4.628751/hz,'teleport '+hz);last=p;}assert.ok(trail.slice(0,4).every(p=>p.x<-1.9),'walked deeper into bus');}
  setup({x:-1.9});local.run("Object.assign(player,{team:'red',hp:100,alive:true,x:-15,z:0});walker.target=player;walker.group.rotation.y=-Math.PI/2;walker.reactionUntil=999");walk(.5);assert.ok(local.run('walker.x<-2.07'),'combat stance prevented escape');
 });
 check('an approaching moving bus makes the actual BOT detour or wait, then resume with normal damage rules',()=>{
  setup();local.run("var busStart=elapsed;var movingPose=()=>{const z=Math.min(25,-18+(elapsed-busStart)*10);const accepted=map.traffic.service.restore([[0,0,-1,busStart+25,0,z,0,z<25?10:0,[]]],[],elapsed);if(!accepted)throw Error('Moving bus fixture rejected');};for(let i=0;i<220;i++){elapsed+=.05;movingPose();updateBots(.05);updateTraffic(.05);trail.push({x:walker.x,z:walker.z});}");
  assert.equal(local.run('walker.alive'),true);assert.equal(local.run('walker.hp'),100);assert.ok(local.run('Math.hypot(walker.x-objective.x,walker.z-objective.z)<.5'));
 });
 check('no room to pass: wait without entering bus, then continue after it clears',()=>{
  setup();local.wall({x:0,z:-8,width:164,depth:3});local.wall({x:0,z:8,width:164,depth:3});walk(3);assert.ok(local.run('walker.x<-2'));local.run('map.traffic.service.restore([[0,0,-1,0,35,25,0,0,[]]],[],elapsed)');walk(6);assert.ok(local.run('Math.hypot(walker.x-objective.x,walker.z-objective.z)<.5'),JSON.stringify(copy(local.run('({x:walker.x,z:walker.z,goal:walker.goal,path:walker.path,poses:map.traffic.poses(elapsed)})'))));
 });
 check('bus escape never overrides a seated, remote, launched or airborne BOT',()=>{
  for(const kind of['remote','launch','air']){setup({x:-1.9});if(kind==='remote')local.run("walker.remoteId='peer';walker.netInput={}");if(kind==='launch')local.run('walker.trafficLaunch={endsAt:elapsed+5}');if(kind==='air')local.run('walker.y=4;walker.vy=0');walk(.05);if(kind!=='air')near(local.run('walker.x'),-1.9,kind);else assert.ok(local.run('walker.y>3'));}
  setup({x:-1.9});local.run("map.traffic.service.restore([[0,0,-1,0,0,0,0,0,[0]]],['walker'],elapsed)");walk(.05);near(local.run('walker.x'),-1.9,'seated');
 });
 const real=harness({realMap:true});real.sandbox.createTrafficClock=createTrafficClock;
 check('actual Hirakata stop: BOT passes around a stopped bus on real station collision',()=>{
  real.reset();real.run("$('map-select').value='hirakata';mode='menu';startGame();startRound();clearBots();elapsed=10;match.phase='live';var at=map.traffic.stops(elapsed)[0];map.traffic.service.restore([[0,0,-1,0,at.x,at.z,at.yaw,0,[]]],[],elapsed);navigation=createNavigation(map);Object.assign(player,{x:60,z:60,hp:0,alive:false});var left=busPoint(at,-4,0),right=busPoint(at,4,0);makeBot(left,0,'blue',{id:'station-walker',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'nope'})});var walker=bots[0];walker.kit.smoke=0;walker.kit.updraft=0;walker.kit.dash=0;walker.fire=999;walker.think=999;walker.nextSkillAt=999;var objective=right;match.spike.status='carried';match.spike.carrier='other';updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',roles:new Map([[walker.id,{goal:objective,siteId:'A',role:'advance'}]])}}};Math.random=()=>.2;for(let i=0;i<400;i++){elapsed+=.05;updateBots(.05);} ");
  assert.ok(real.run('Math.hypot(walker.x-objective.x,walker.z-objective.z)<.6'),JSON.stringify(copy(real.run('({x:walker.x,z:walker.z,objective,left,at})'))));
 });
 console.log('PASS: '+groups+' actual-game BOT/bus navigation groups; audio inert');
 console.log('TOTAL '+Math.round(performance.now()-started)+'ms wall / '+Math.round(process.cpuUsage(cpuStarted).user/1000)+'ms CPU');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
let prefix=fixture.slice(0,boundary);
if(process.env.BUS_NAV_FAULT){
 const faults={update:["if(!isGuest())navigation.updateTraffic?.(elapsed);",''],escape:["const trafficEscape=actorGrounded(bot)?navigation.trafficEscape?.(bot.x,bot.z):null;",'const trafficEscape=null;'],teleport:["bot.moving=advance(bot,trafficEscape,'bus-escape');","bot.x=trafficEscape.x;bot.z=trafficEscape.z;bot.moving=true;"]};
 const fault=faults[process.env.BUS_NAV_FAULT];if(!fault)throw Error('Unknown fault');
 const product=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');if(!product.includes(fault[0]))throw Error('Mutation anchor missing');
 prefix=prefix.replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8').replace("+JSON.stringify(fault[0])+','+JSON.stringify(fault[1])+")");
}
const compiled=new Module(path.join(__dirname,'bot-bus-navigation-harness.cjs'),module);compiled.filename=path.join(__dirname,'bot-bus-navigation-harness.cjs');compiled.paths=module.paths;compiled._compile(prefix+suite,compiled.filename);
