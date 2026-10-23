const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-onnara-game.cjs'),'utf8'),boundary=fixture.indexOf(' const local=harness();');
if(boundary<0)throw Error('Saved-game harness boundary changed');
const suite=`
 const local=harness();
 function setup(){local.reset();local.clearWalls();local.run("difficulty='hard';match.phase='live';match.spike.status='carried';match.spike.carrier='other';Object.assign(player,{team:'red',x:60,y:0,z:60,hp:0,alive:false});makeBot({x:0,z:10},0,'blue',{id:'duck-test',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'duck'})});var duck=bots[0];duck.kit.smoke=0;duck.kit.updraft=0;duck.kit.ultPoints=0;duck.aiWeapon='vandal';duck.aiAmmo=25;duck.aiReserve=75;duck.aiReload=0;duck.fire=99;duck.think=1;duck.target=null;duck.nextSkillAt=999;duck.group.rotation.y=0;var objective={x:0,z:-5};updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return {siteId:'A',roles:new Map([[duck.id,{goal:objective,siteId:'A',role:'advance',urgent:false}]])}}};Math.random=()=>.2;");}
 check('actual grounded travel starts E despite generic C/Q timer, without target or extra movement',()=>{
  setup();local.run('updateBots(.1)');assert.equal(local.run('duck.kit.dash'),0);assert.ok(local.run('duck.moving&&duck.z<10'));assert.equal(local.run('ordinarySkills.quiet(duck.id,elapsed)'),true);assert.ok(local.run('duckFlight(duck)'));const z=local.run('duck.z');setup();local.run('duck.kit.dash=0;updateBots(.1)');near(local.run('duck.z'),z,'identical travel');assert.equal(local.run('duck.target'),null);
 });
 check('stale moving, blocked route, stopped goal and reload do not waste E',()=>{
  for(const code of ['navigation.nearest=()=>null;duck.moving=true','objective={x:duck.x,z:duck.z};duck.moving=true','duck.aiReload=2','objective={x:0,z:-40}']){setup();local.run(code+';updateBots(.1)');assert.equal(local.run('duck.kit.dash'),1,code);}
 });
 check('airborne, blind, sealed and no stock do not acquire hush',()=>{
  for(const code of ['duck.y=2;duck.vy=1',"ordinarySkills.cast('nope-flash',{id:'flash',team:'red',x:0,y:0,z:9,hp:100,alive:true},{x:0,y:1.7,z:12},elapsed,match.round);elapsed+=NOPE_SKILLS.flashFlight+.01;updateOrdinarySkills()", "ordinarySkills.cast('duck-seal',{id:'seal',team:'red',x:0,y:0,z:0,hp:100,alive:true},{x:0,y:1.3,z:10,targetId:duck.id},elapsed,match.round)",'duck.kit.dash=0']){setup();local.run(code+';updateBots(.1)');assert.equal(local.run('duckFlight(duck)'),null,code);}
 });
 check('visible combat does not silently activate travel E; no enemy is invented behind a wall',()=>{
  setup();local.run('Object.assign(player,{x:0,z:0,hp:100,alive:true});duck.target=player;duck.group.rotation.y=Math.PI;updateBots(.1)');assert.equal(local.run('duck.kit.dash'),1);
  setup();local.wall({z:0,width:50,height:6});local.run('Object.assign(player,{x:0,z:-8,hp:100,alive:true});duck.target=null;duck.group.rotation.y=0;updateBots(.1)');assert.equal(local.run('duck.target'),null);assert.equal(local.run('duck.lastSeen'),null);
 });
 check('quiet travel never emits a far-from-player footstep pulse; expiry restores frozen audible position',()=>{
  setup();local.run('duck.stepClock=.42;updateBots(.1);var observer={team:"red",x:duck.x+2,y:0,z:duck.z};var silent=botHearing.listen(observer,elapsed)');assert.equal(local.run('silent'),null);
  local.run('sound("enemy",{weapon:"vandal",entity:duck});var gunPulse=botHearing.listen(observer,elapsed)');assert.ok(local.run('gunPulse'));local.run('botHearing.reset()');
  local.run('elapsed+=5.01;duck.stepClock=.42;updateBots(.1);var pulse=botHearing.listen(observer,elapsed)');assert.ok(local.run('pulse'));near(local.run('pulse.x'),local.run('duck.x'),'fixed x');const z=local.run('pulse.z');local.run('duck.z-=5');near(local.run('pulse.z'),z,'never follows');
 });
 check('full20 event pool rolls stock back and rejects retrial for half a second',()=>{
  setup();local.run("for(let i=0;i<20;i++)ordinarySkills.cast('duck-hush',{id:'filler-'+i,team:'red',x:0,y:0,z:0,hp:100,alive:true},{x:0,y:0,z:0},elapsed,match.round);updateBots(.1)");assert.equal(local.run('duck.kit.dash'),1);near(local.run('duck.nextHushAt'),10.5,'bounded retry');local.run('resetOrdinarySkills();elapsed+=.2;updateBots(.1)');assert.equal(local.run('duck.kit.dash'),1);local.run('elapsed+=.31;updateBots(.1)');assert.equal(local.run('duck.kit.dash'),0);
 });
 check('once active no duplicate; quiet5 flight10 cooldown20 and death/round cleanup remain',()=>{
  setup();local.run('updateBots(.1);elapsed+=.3;updateBots(.1)');assert.equal(local.run("ordinarySkills.events(elapsed).filter(e=>e.type==='duck-hush').length"),1);local.run('elapsed=15.01');assert.equal(local.run('ordinarySkills.quiet(duck.id,elapsed)'),false);assert.ok(local.run('duckFlight(duck)'));local.run('elapsed=20');assert.equal(local.run('duckFlight(duck)'),null);local.run('elapsed=30;duck.kit.tick(elapsed)');assert.equal(local.run('duck.kit.dash'),1);
  setup();local.run('updateBots(.1);duck.hp=0;duck.alive=false;updateOrdinarySkills()');assert.equal(local.run('duckFlight(duck)'),null);setup();local.run('updateBots(.1);ordinarySkills.update([],elapsed,match.round+1)');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);
 });
 check('plant/defuse and guest worlds never choose travel E',()=>{
  setup();local.run("onlinePlaying=true;online={host:false,session:{memberId:'guest'}};updateBots(.1)");assert.equal(local.run('duck.kit.dash'),1);
  setup();local.run("duck.x=map.sites[0].x;duck.z=map.sites[0].z;match.spike.carrier=duck.id;updateBots(.1)");assert.equal(local.run('duck.planting'),true);assert.equal(local.run('duck.kit.dash'),1);
  setup();local.run("match.spike.status='planted';match.spike.x=duck.x;match.spike.z=duck.z;match.defenderTeam=duck.team;updateBots.tactics.update=()=>({siteId:'A',defuserId:duck.id,roles:new Map([[duck.id,{goal:{x:duck.x,z:duck.z},siteId:'A',role:'defuse',urgent:true}]])});updateBots(.1)");assert.equal(local.run('duck.kit.dash'),1);
 });
 console.log('PASS: '+groups+' actual-game hush policy/hearing/cleanup/authority groups; no audio');
}main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const runner=new Module(path.join(__dirname,'bot-hush-harness.cjs'),module);runner.filename=path.join(__dirname,'bot-hush-harness.cjs');runner.paths=Module._nodeModulePaths(__dirname);runner._compile(fixture.slice(0,boundary)+suite,runner.filename);
