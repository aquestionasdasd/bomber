const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-urchin-game.cjs'),'utf8'),boundary=fixture.indexOf(' const local=harness();');if(boundary<0)throw Error('Harness boundary changed');
const suite=`
 const local=harness();
 function setup(){local.reset();local.clearWalls();local.run("netApplied.clear();netInputs.clear();player.kit=new DuelistKit({character:'urchin'});player.kit.smoke=2;player.kit.ultPoints=0;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',primary:'vandal',secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];Object.assign(enemy,{hp:100,armor:0,aiWeapon:'vandal',aiAmmo:0,aiReserve:0,aiReload:0,fire:999,reactionUntil:999});");}
 const cast="activateAbility(player,'c',{aim:{yaw:0,pitch:-.01}})";
 check('fixed line warns .65 seconds, then80 raw once despite empty/knife/reload; no suppression',()=>{
  for(const state of ['enemy.aiAmmo=0',"enemy.aiWeapon='knife'",'enemy.aiReload=2']){setup();local.run(state);assert.ok(local.run(cast));assert.equal(local.run('enemy.hp'),100);local.run('elapsed+=.64;updateOrdinarySkills()');assert.equal(local.run('enemy.hp'),100);local.run('elapsed+=.01;updateOrdinarySkills()');assert.equal(local.run('enemy.hp'),20);assert.equal(local.run('ordinarySkills.urchinJammed(enemy.id,elapsed)'),false);local.run('elapsed+=.1;updateOrdinarySkills();updateOrdinarySkills()');assert.equal(local.run('enemy.hp'),20);}
 });
 check('normal armor; multiple enemies once, no friendly/self, vertical separation',()=>{
  setup();local.run("enemy.armor=50;makeBot({x:0,z:-15},1,'red',{id:'second',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var second=bots[1];second.armor=0;makeBot({x:0,z:-8},2,'blue',{id:'friend',team:'blue',secondary:'classic',kit:new DuelistKit({character:'nope'})});var friend=bots[2];makeBot({x:0,y:4,z:-6},3,'red',{id:'high',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var high=bots[3];high.y=4;");assert.ok(local.run(cast));local.run('elapsed+=.65;updateOrdinarySkills()');assert.equal(local.run('enemy.hp'),70);assert.equal(local.run('enemy.armor'),0);assert.equal(local.run('second.hp'),20);assert.equal(local.run('friend.hp'),100);assert.equal(local.run('high.hp'),100);assert.equal(local.run('player.hp'),100);
 });
 check('fixed lane does not track aim or enemies; sideways dodge succeeds and entrants can be hit',()=>{
  setup();assert.ok(local.run(cast));const lane=copy(local.run('ordinarySkills.events(elapsed)[0]'));local.run('enemy.x=2;player.yaw=1;elapsed+=.65;updateOrdinarySkills()');assert.equal(local.run('enemy.hp'),100);assert.deepEqual(copy(local.run('ordinarySkills.events(elapsed)[0]')),lane);
  setup();local.run('enemy.x=2');assert.ok(local.run(cast));local.run('enemy.x=0;elapsed+=.65;updateOrdinarySkills()');assert.equal(local.run('enemy.hp'),20);
 });
 check('wall clips endpoint and rechecks reach at hit; smoke is not an enemy tracker',()=>{
  setup();local.wall({z:-5,width:8,height:6});assert.ok(local.run(cast));assert.ok(local.run('ordinarySkills.events(elapsed)[0].z')>-5);local.run('elapsed+=.65;updateOrdinarySkills()');assert.equal(local.run('enemy.hp'),100);
  setup();assert.ok(local.run(cast));local.wall({z:-5,width:8,height:6});local.run('elapsed+=.65;updateOrdinarySkills()');assert.equal(local.run('enemy.hp'),100);
  setup();local.run("smokes.push({x:0,y:1,z:-5,radius:2,end:100,mesh:new THREE.Mesh(new THREE.SphereGeometry(2),new THREE.MeshBasicMaterial())})");assert.ok(local.run(cast));local.run('elapsed+=.65;updateOrdinarySkills()');assert.equal(local.run('enemy.hp'),20);
 });
 check('invalid aim, blindness, tiny wall,20full reject/rollback with existing events intact',()=>{
  setup();assert.equal(local.run("activateAbility(player,'c',{aim:{yaw:NaN,pitch:0}})"),undefined);assert.equal(local.run('player.kit.smoke'),2);
  setup();local.wall({z:-.4});assert.equal(local.run(cast),undefined);assert.equal(local.run('player.kit.smoke'),2);
  setup();local.run("for(let i=0;i<20;i++)ordinarySkills.cast('cap-bank',{...ordinaryActorView(player),id:'fill'+i},ordinaryActorView(player),elapsed,match.round)");assert.equal(local.run(cast),undefined);assert.equal(local.run('player.kit.smoke'),2);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('ordinarySkills.events(elapsed).length'),20);
 });
 check('source death/team/nextR cancels; targets can die without prematurely deleting fixed lane',()=>{
  for(const change of ['player.alive=false;player.hp=0',"player.team='red'",'match.round++;resetOrdinarySkills()']){setup();assert.ok(local.run(cast));local.run(change+';elapsed+=.65;updateOrdinarySkills()');assert.equal(local.run("ordinarySkills.events(elapsed).filter(e=>e.type==='urchin-lance').length"),0,change);assert.equal(local.run('enemy.hp'),100);}
  setup();assert.ok(local.run(cast));local.run('enemy.alive=false;enemy.hp=0;updateOrdinarySkills()');assert.equal(local.run("ordinarySkills.events(elapsed).filter(e=>e.type==='urchin-lance').length"),1);
 });
 check('guest stock prediction has no effects/damage; independent JSON restores only visual authority',()=>{
  setup();assert.ok(local.run("activateAbility(player,'c',{predict:true,aim:{yaw:0,pitch:-.01}})"));assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('player.kit.smoke'),1);local.run('elapsed+=.65;updateOrdinarySkills()');assert.equal(local.run('enemy.hp'),100);
  setup();assert.ok(local.run(cast));const snapshot=copy(local.run('ordinarySkills.snapshot()')),guest=imported.createCharacterSkills();assert.equal(guest.restore(snapshot,10,local.run('match.round')),true);const actors=copy(local.run('[player,enemy].map(a=>({id:a.id,team:a.team,x:a.x,y:a.y,z:a.z,crouch:a.crouch||0,hp:a.hp,alive:a.alive}))'));assert.deepEqual(guest.update(actors,10.65,local.run('match.round'),{reachable:()=>true}),[]);const bad=copy(snapshot);bad.events[0].targetId='enemy';assert.equal(guest.restore(bad,10.65,local.run('match.round')),false);
 });
 check('host remote duplicate action creates one lane; guest never predicts damage and stale packet cannot reshoot',()=>{
  setup();local.run("enemy.kit=new DuelistKit({character:'urchin'});enemy.kit.smoke=2;enemy.remoteId='guest';enemy.netWeapon='vandal';enemy.netAmmo=25;enemy.netReserve=75;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);var packet={type:'input',seq:1,connection:'lance',round:match.round,input:{x:0,y:0,z:-10,yaw:Math.PI,pitch:0},actions:[{type:'ability',seq:1,round:match.round,key:'c',yaw:Math.PI,pitch:-.01}]};receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016)");assert.equal(local.run('enemy.kit.smoke'),1);assert.equal(local.run("ordinarySkills.events(elapsed).filter(e=>e.type==='urchin-lance').length"),1);assert.equal(local.run('player.hp'),100);local.run('elapsed+=.65;updateOrdinarySkills()');assert.equal(local.run('player.hp'),20);local.run("receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);updateOrdinarySkills()");assert.equal(local.run('player.hp'),20);
 });
 check('one lethal hit gives one kill/point, no repeated corpse reward',()=>{
  setup();local.run('enemy.hp=50');assert.ok(local.run(cast));local.run('elapsed+=.65;updateOrdinarySkills()');assert.equal(local.run('enemy.alive'),false);assert.equal(local.run('player.kit.ultPoints'),1);const credits=local.run('match.credits');local.run('elapsed+=.1;updateOrdinarySkills()');assert.equal(local.run('player.kit.ultPoints'),1);assert.equal(local.run('match.credits'),credits);
 });
 check('fixed warning edges/burst9spines bounded FX resources/dedup/cleanup independent of actor motion',()=>{
  setup();assert.ok(local.run(cast));const fx=imported.createUrchinSkillFX(THREE),events=copy(local.run('ordinarySkills.events(elapsed)'));fx.update(events,10,{actors:[]});assert.equal(fx.group.children.length,1);const root=fx.group.children[0];assert.equal(root.children.length,12);assert.equal(root.children[0].visible,true);assert.equal(root.children[2].visible,false);const pos=root.position.clone();fx.update(events,10.65,{actors:[{id:'player',alive:true,x:99,z:99}]});assert.equal(root.children[2].visible,true);assert.ok(root.position.equals(pos));assert.equal(fx.group.children.length,1);fx.update([],11);assert.equal(fx.group.children.length,0);fx.dispose();
 });
 console.log('PASS: '+groups+' actual-game fixed-lance/JSON/FX/authority groups; audio inert');
 console.log('TOTAL '+Math.round(performance.now()-started)+'ms wall / '+Math.round(process.cpuUsage(cpuStarted).user/1000)+'ms CPU');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const compiled=new Module(path.join(__dirname,'urchin-lance-harness.cjs'),module);compiled.filename=path.join(__dirname,'urchin-lance-harness.cjs');compiled.paths=module.paths;compiled._compile(fixture.slice(0,boundary)+suite,compiled.filename);
