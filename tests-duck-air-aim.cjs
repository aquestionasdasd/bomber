const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-onnara-game.cjs'),'utf8'),boundary=fixture.indexOf(' const local=harness();');
if(boundary<0)throw Error('Saved-game harness boundary changed');
const fault=process.argv.find(s=>s.startsWith('--fault='))?.split('=')[1];
if(fault){const read=fs.readFileSync;fs.readFileSync=function(p,...args){let s=read.call(this,p,...args);if(String(p).replaceAll('\\','/').endsWith('/public/game.js')&&typeof s==='string'){
 const changes={local:['steadyAir=duckAirAim(player)','steadyAir=false'],arsenal:['steadyAir:duckAirAim(actor)','steadyAir:false'],landing:['actor.y=support;actor.vy=0;actor.duckPadUntil=0','actor.y=support;actor.vy=0']};
 const [a,b]=changes[fault]||[];if(!a||!s.includes(a))throw Error('Fault anchor missing');s=s.replace(a,b);}return s;};}
const suite=String.raw`
 const local=harness();
 function setup(id='vandal',h=local){h.reset();h.clearWalls();h.sandbox.gunId=id;h.run("player.kit=new DuelistKit({character:'duck'});match.phase='live';inventory={primary:gunId,secondary:'classic',active:gunId};equip(gunId,true);var shotRays=[];tracer=(from,to)=>shotRays.push({from:from.clone(),to:to.clone()});Math.random=()=>.99;shotSequence=9;renderedRecoil=.025;");}
 function flight(h=local){assert.ok(h.run("activateAbility(player,'e')"));h.run('player.y=2;player.vy=3;player.vx=6;player.vz=2');}
 function aimError(h=local){return h.run('(()=>{const r=shotRays[0],expected=new THREE.Vector3();camera.getWorldDirection(expected);return r.to.clone().sub(camera.position).normalize().distanceTo(expected)})()');}
 check('all eight single-projectile guns follow visible aim during actual E, including moving sustained fire',()=>{
  for(const id of ['classic','ghost','spectre','vandal','phantom','scout','atlas','forge']){setup(id);flight();const before=local.run('player.ammo');local.run('shoot()');assert.equal(local.run('shotRays.length'),1,id);near(aimError(),0,id+' aim',1e-10);assert.equal(local.run('player.ammo'),before-1,id+' cartridge');}
 });
 check('shotguns keep their stationary pellet cone while skill flight removes extra movement/air enlargement',()=>{
  for(const id of ['pump','drum']){setup(id);flight();local.run('shoot()');const rays=local.run('shotRays');const w=imported.WEAPONS[id],expected=imported.shotPattern(id,{ads:false,sequence:10});assert.equal(rays.length,w.pellets);assert.ok(rays.some(r=>r.to.clone().sub(r.from).normalize().distanceTo(rays[0].to.clone().sub(rays[0].from).normalize())>.001));
   const radii=rays.map(r=>{const d=r.to.clone().sub(r.from).normalize(),f=rays[0].to.clone().sub(rays[0].from).normalize();return Math.tan(Math.acos(Math.min(1,d.dot(f))))});for(let i=0;i<radii.length;i++)near(radii[i],Math.hypot(expected[i].x,expected[i].y),id+' cone '+i,1e-6);}
 });
 check('normal jumps, expired E, and grounded E retain ordinary spread',()=>{
  for(const id of ['vandal','atlas'])for(const kind of ['normal','expired','ground']){setup(id);if(kind!=='normal')flight();local.run(kind==='ground'?'player.y=0;player.vy=0':kind==='expired'?'elapsed=20;player.y=2;player.vy=3':'player.y=2;player.vy=3');assert.equal(local.run('duckAirAim(player)'),false,kind);local.run('shoot()');assert.ok(aimError()>.005,id+' '+kind);}
 });
 check('real C launch grants every rider accurate aim; landing ends it before an ordinary jump',()=>{
  setup();assert.ok(local.run("ordinarySkills.cast('duck-pad',ordinaryActorView(player),{x:0,y:0,z:0},elapsed,match.round)"));local.run('elapsed+=.25;tickDuckPads();updateActorVertical(player,.05)');assert.equal(local.run('duckAirAim(player)'),true);local.run('shoot()');near(aimError(),0,'pad shot',1e-10);
  local.run('player.x=5;for(let i=0;i<240&&!actorGrounded(player);i++)updateActorVertical(player,1/120)');assert.equal(local.run('player.duckPadUntil'),0);local.run('jump()');assert.equal(local.run('duckAirAim(player)'),false,'later normal jump');
  for(const team of ['blue','red']){setup();local.sandbox.riderTeam=team;local.run("ordinarySkills.cast('duck-pad',ordinaryActorView(player),{x:0,y:0,z:0},elapsed,match.round);makeBot({x:1,z:0},0,riderTeam,{id:'rider',team:riderTeam,secondary:'classic',kit:new DuelistKit({character:'nope'})});elapsed+=.25;tickDuckPads();updateActorVertical(bots[0],.05)");assert.equal(local.run('duckAirAim(bots[0])'),true,team);}
 });
 check('expiry/round/team/death and removal revoke pad/flight accuracy without changing shot packets',()=>{
  for(const code of ['elapsed=20','match.phase="post"','player.alive=false','player.team="red"','match.round++;resetOrdinarySkills()']){setup();flight();local.run(code);assert.equal(local.run('duckAirAim(player)'),false,code);}
  for(const code of ['elapsed=15','match.round++','player.team="red"','player.alive=false']){setup();local.run('player.y=2;player.vy=3;player.duckPadUntil=14;player.duckPadRound=match.round;player.duckPadTeam=player.team');assert.equal(local.run('duckAirAim(player)'),true);local.run(code);assert.equal(local.run('duckAirAim(player)'),false,code);}
 });
 check('independent guest prediction alone cannot grant accuracy; approved JSON matches host and never mutates enemy HP',()=>{
  const host=harness(),guest=harness();setup('atlas',host);setup('atlas',guest);guest.run("onlinePlaying=true;online={host:false,session:{memberId:'me'},room:{code:'TEST'}};activateAbility(player,'e',{predict:true});player.y=2;player.vy=3");assert.equal(guest.run('duckAirAim(player)'),false);
  flight(host);const snap=copy(host.run('ordinarySkills.snapshot()'));guest.sandbox.transfer=snap;assert.equal(guest.run('ordinarySkills.restore(transfer,elapsed,match.round)'),true);assert.equal(guest.run('duckAirAim(player)'),true);guest.run("makeBot({x:0,z:-30},0,'red',{id:'victim',team:'red',secondary:'classic'});bots[0].y=player.y;bots[0].group.position.y=player.y;shoot()");near(aimError(guest),0,'approved guest aim',1e-10);assert.equal(guest.run('bots[0].hp'),100);assert.equal(guest.run("netActions.filter(a=>a.type==='fire').length"),1);assert.equal(guest.run("Object.hasOwn(netActions.find(a=>a.type==='fire'),'steadyAir')"),false);
 });
 check('remote host computes approved E/pad aim for arsenal and does not trust a client precision flag',()=>{
  for(const kind of ['flight','pad','forged']){setup('atlas');local.run("makeBot({x:0,z:-30},0,'red',{id:'remote',team:'red',primary:'atlas',secondary:'classic',kit:new DuelistKit({character:'duck'})});var actor=bots[0];Object.assign(actor,{remoteId:'guest',netWeapon:'atlas',netAmmo:5,netReserve:10,netReload:0,lastNetShot:-10,shotSequence:9,remoteMoving:true,y:2,vy:3});Object.assign(player,{x:30,y:0});");if(kind==='flight')assert.ok(local.run("ordinarySkills.cast('duck-hush',ordinaryActorView(actor),ordinaryActorView(actor),elapsed,match.round)"));if(kind==='pad')local.run('actor.duckPadUntil=elapsed+4;actor.duckPadRound=match.round;actor.duckPadTeam=actor.team');local.run("applyRemoteAction(actor,{type:'fire',yaw:0,pitch:0,ads:true,steadyAir:true},elapsed)");assert.equal(local.run('actor.netAmmo'),4);const error=local.run('shotRays[0].to.clone().sub(shotRays[0].from).normalize().distanceTo(new THREE.Vector3(0,0,-1))');if(kind==='forged')assert.ok(error>.01);else near(error,0,kind+' host aim',1e-10);}
 });
 check('real arsenal BOT path shares approved precision without changing ordinary standing patterns',()=>{
  setup('forge');local.run("makeBot({x:0,z:-20},0,'blue',{id:'gunner',team:'blue',primary:'forge',secondary:'classic',kit:new DuelistKit({character:'duck'})});var bot=bots[0];bot.aiWeapon='forge';bot.moving=true;bot.y=2;bot.vy=3;bot.shotSequence=20;ordinarySkills.cast('duck-hush',ordinaryActorView(bot),ordinaryActorView(bot),elapsed,match.round);fireArsenal(bot,new THREE.Vector3(0,3.7,-20),new THREE.Vector3(0,0,-1),WEAPONS.forge,false)");near(local.run('shotRays[0].to.clone().sub(shotRays[0].from).normalize().distanceTo(new THREE.Vector3(0,0,-1))'),0,'bot precision',1e-10);
  for(const id of ['scout','atlas','forge','pump','drum']){const a=imported.shotPattern(id,{sequence:8}),b=imported.shotPattern(id,{sequence:8,steadyAir:false});assert.deepEqual(a,b);}
 });
 check('accurate actual hits still obey armor, cover, one-cartridge consumption and firing cadence',()=>{
  for(const id of ['vandal','atlas','forge'])for(const cover of [false,true]){setup(id);flight();local.run("renderedRecoil=0;player.pitch=Math.atan2(-.5,30);makeBot({x:0,z:-30},0,'red',{id:'victim',team:'red',secondary:'classic',armor:50});var enemy=bots[0];enemy.y=2;enemy.group.position.y=2;");if(cover)local.wall({z:-10,height:8});const ammo=local.run('player.ammo');local.run('shoot()');const expected=imported.applyArmorDamage(100,50,cover?0:imported.WEAPONS[id].body);near(local.run('enemy.hp'),expected.hp,id+' HP');near(local.run('enemy.armor'),expected.armor,id+' armor');assert.equal(local.run('player.ammo'),ammo-1);local.run('shoot()');assert.equal(local.run('player.ammo'),ammo-1,'same-frame cadence');}
 });
 console.log('PASS: '+groups+' actual-game air aim / weapon / physics / independent JSON authority groups; audio inert');
 console.log('TOTAL '+Math.round(performance.now()-started)+'ms wall / '+Math.round(process.cpuUsage(cpuStarted).user/1000)+'ms CPU');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const compiled=new Module(path.join(__dirname,'duck-air-aim-harness.cjs'),module);compiled.filename=path.join(__dirname,'duck-air-aim-harness.cjs');compiled.paths=module.paths;compiled._compile(fixture.slice(0,boundary)+suite,compiled.filename);
