const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// Actual saved game and skill engine; no rendering, audio or network IO.
const fixture = fs.readFileSync(path.join(__dirname, 'tests-onnara-game.cjs'), 'utf8');
const boundary = fixture.indexOf(' const local=harness();');
if (boundary < 0) throw Error('Saved-game harness boundary changed');
const suite = `
 const guns=['classic','ghost','spectre','vandal','phantom','pump','drum','scout','atlas','forge'];
 const local=harness();
 function setup(id='scout',ammo=1,reserve=1){
   local.reset();local.clearWalls();local.sandbox.loadout={id,ammo,reserve};
   local.run(\`match.phase='live';player.kit=new DuelistKit({character:'ember'});
     inventory[WEAPONS[loadout.id].slot]=loadout.id;equip(loadout.id,true);
     player.ammo=loadout.ammo;player.reserve=loadout.reserve;\`);
 }
 check('all ten firearms cast and strictly JSON-restore the same bounded service event',()=>{
   assert.deepEqual(Object.entries(imported.WEAPONS).filter(([,s])=>['primary','secondary'].includes(s.slot)&&s.mag>0).map(([id])=>id).sort(),[...guns].sort());
   for(const id of guns){
     const engine=imported.createCharacterSkills(),owner={id:'worker',team:'blue',x:0,y:0,z:0,hp:100,alive:true,weaponId:id};
     const event=engine.cast('ember-service',owner,{x:0,y:0,z:0,weaponId:id},10,1);assert.ok(event,id);
     near(event.endsAt,10.8,id);const remote=imported.createCharacterSkills();
     remote.restore(copy(engine.snapshot()),10.1,1);assert.equal(remote.events(10.1)[0]?.weaponId,id);
     assert.deepEqual(remote.update([owner],10.2,1,{reachable:()=>true}),[],'restoring never owns ammunition');
   }
 });
 check('unknown/prototype/melee/bomber and mismatched weapon events still fail closed',()=>{
   const engine=imported.createCharacterSkills(),owner={id:'worker',team:'blue',x:0,y:0,z:0,hp:100,alive:true,weaponId:'scout'};
   engine.cast('ember-service',owner,{x:0,y:0,z:0,weaponId:'scout'},10,1);const valid=copy(engine.snapshot());
   for(const id of ['knife','spike','constructor','__proto__','toString','SCOUT','',null,{},'future-gun']){
     assert.equal(imported.createCharacterSkills().cast('ember-service',{...owner,weaponId:id},{x:0,y:0,z:0,weaponId:id},10,1),null,String(id));
     const bad=copy(valid);bad.events[0].weaponId=id;const remote=imported.createCharacterSkills();remote.restore(bad,10.1,1);assert.equal(remote.events(10.1).length,0,String(id));
   }
   assert.equal(imported.createCharacterSkills().cast('ember-service',owner,{x:0,y:0,z:0,weaponId:'forge'},10,1),null);
 });
 check('actual local E loads every firearm in .8 seconds from finite reserve and keeps 18 second cooldown',()=>{
   for(const id of guns){
     setup(id);assert.ok(local.run("activateAbility(player,'e')"),id);
     assert.equal(local.run('player.serviceReload.weaponId'),id);near(local.run('reloading'),.8,id);
     local.run('tickServiceReload(player,.79)');assert.equal(local.run('player.ammo'),1,id);
     local.run('tickServiceReload(player,.01)');assert.equal(local.run('player.ammo'),2,id);assert.equal(local.run('player.reserve'),0,id);
     assert.equal(local.run('player.serviceReload'),null,id);near(local.run('player.kit.nextSignatureAt'),28,id);
     assert.equal(local.run("activateAbility(player,'e')"),undefined,id);
   }
 });
 check('new firearm full magazine/zero reserve/normal reload/interaction reject without spending stock',()=>{
   for(const id of guns.slice(5))for(const condition of ['full','dry','reload','interact']){
     setup(id);local.sandbox.condition=condition;
     local.run("if(condition==='full')player.ammo=WEAPONS[inventory.active].mag;if(condition==='dry')player.reserve=0;if(condition==='reload')reloading=.5;if(condition==='interact')interactionHeld=true;var previousKit=JSON.stringify(player.kit.snapshot())");
     assert.equal(local.run("activateAbility(player,'e')"),undefined,id+condition);
     assert.equal(local.run('JSON.stringify(player.kit.snapshot())'),local.run('previousKit'));assert.equal(local.run('player.serviceReload??null'),null);
   }
 });
 check('new firearm service cancels on switch/death/plant/defuse/post/next-round and never grants reserve',()=>{
   for(const id of guns.slice(5))for(const change of ["equip('classic')","player.alive=false;player.hp=0","player.planting=true","player.defusing=true","match.phase='post'","startRound()"]){
     setup(id);local.run("activateAbility(player,'e')");local.run(change);local.run('tickServiceReload(player,1)');
     assert.equal(local.run('player.serviceReload??null'),null,id+change);
     if(!change.includes('startRound')&&!change.includes('equip')){assert.equal(local.run('player.ammo'),1);assert.equal(local.run('player.reserve'),1);}
   }
 });
 check('20 event capacity refuses new-firearm E and rolls back cooldown without deleting prior effects',()=>{
   setup('forge');local.run("for(let i=0;i<20;i++)ordinarySkills.cast('echo-tag',player,{x:0,y:.12,z:-5},elapsed,match.round);var before=JSON.stringify(player.kit.snapshot());activateAbility(player,'e')");
   assert.equal(local.run('ordinarySkills.events(elapsed).length'),20);assert.equal(local.run('JSON.stringify(player.kit.snapshot())'),local.run('before'));assert.equal(local.run('player.serviceReload??null'),null);
 });
 check('actual BOT policy reaches service with each new gun and finite partial reserve',()=>{
   for(const id of guns.slice(5)){
     setup(id);local.sandbox.id=id;
     local.run(\`player.alive=false;player.hp=0;makeBot({x:0,z:10},0,'blue',{id:'service-bot',team:'blue',primary:id,secondary:'classic',kit:new DuelistKit({character:'ember'})});var worker=bots[0];
       Object.assign(worker,{aiWeapon:id,aiAmmo:1,aiReserve:1,aiReload:0,nextSkillAt:0,think:1});worker.kit.smoke=0;worker.kit.updraft=0;worker.kit.ultPoints=0;
       updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return {siteId:'A',roles:new Map([[worker.id,{goal:{x:0,z:10},siteId:'A',role:'hold',urgent:false}]])}}};updateBots(.1);\`);
     assert.equal(local.run('worker.serviceReload?.weaponId'),id);local.run('tickServiceReload(worker,.8)');assert.equal(local.run('worker.aiAmmo'),2,id);assert.equal(local.run('worker.aiReserve'),0,id);
   }
 });
 check('independent host/guest JSON: new firearms approve once, delayed ACK cannot manufacture ammo, host completion wins',()=>{
   const host=harness(),guest=harness();
   for(const id of guns.slice(5)){
     host.reset();guest.reset();host.sandbox.id=id;
     for(const h of [host,guest])h.run('netActions=[];netApplied.clear();netInputs.clear();netParticipants.clear();netSequence=0;netLastSnapshot=0;netActionSequence=0;netHasSnapshot=false;netRound=0;netClock=0');
     host.run(\`match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'remote-worker',team:'red',primary:id,secondary:'classic',kit:new DuelistKit({character:'ember'})});var worker=bots[0];
       Object.assign(worker,{remoteId:'guest',netWeapon:id,netAmmo:1,netReserve:1,netReload:0});netParticipants.set('guest',worker.id);
       onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p;}};var captured;tickOnline(.1);\`);
     guest.run("onlinePlaying=true;online={host:false,room:{code:'TESTROOM'},session:{memberId:'guest',hostId:'host'},send:p=>{outgoing=p;}};var outgoing;netParticipants.set('guest','remote-worker')");
     const sync=()=>{guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer)");};sync();assert.equal(guest.run('inventory.active'),id,'initial authoritative weapon');
     guest.run("useAbility('e');tickOnline(.1)");assert.equal(guest.run('player.ammo'),1,id);assert.equal(guest.run('player.reserve'),1,id);
     host.sandbox.transfer=copy(guest.run('outgoing'));
     host.run("receiveNetPacket('guest',transfer);elapsed+=.01;updateRemoteActor(worker,.01);receiveNetPacket('guest',transfer);elapsed+=.01;updateRemoteActor(worker,.01);tickOnline(.1)");sync();
     assert.equal(host.run("ordinarySkills.events(elapsed).filter(e=>e.type==='ember-service').length"),1,id);
     assert.equal(guest.run('player.serviceReload?.weaponId'),id);guest.run('tickServiceReload(player,2)');assert.equal(guest.run('player.ammo'),1,id);assert.equal(guest.run('player.reserve'),1,id);
     host.run('tickServiceReload(worker,1);elapsed+=1;tickOnline(.1)');sync();assert.equal(guest.run('player.ammo'),2,id);assert.equal(guest.run('player.reserve'),0,id);assert.equal(guest.run('player.serviceReload'),null,id);
   }
 });
 console.log('PASS: '+groups+' actual-game EMBER firearm/finite ammo/policy/strict JSON/authority groups; audio inert; '+Math.round(performance.now()-started)+'ms wall / '+Math.round((process.cpuUsage(cpuStarted).user+process.cpuUsage(cpuStarted).system)/1000)+'ms CPU');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
`;
const runner = new Module(path.join(__dirname, 'ember-firearms-harness.cjs'), module);
runner.filename = path.join(__dirname, 'ember-firearms-harness.cjs');
runner.paths = Module._nodeModulePaths(__dirname);
runner._compile(fixture.slice(0, boundary) + suite, runner.filename);
