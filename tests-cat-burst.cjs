const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-cat-game.cjs'),'utf8'),boundary=fixture.indexOf('  const local=harness();');
if(boundary<0)throw Error('Saved-game harness boundary changed');
const suite=`
  const local=harness();
  function setup(){local.reset();local.clearWalls();local.run("player.kit=new DuelistKit({character:'cat'});player.kit.updraft=1;player.kit.ultPoints=0;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];Object.assign(enemy,{hp:100,armor:0,aiWeapon:'classic',aiAmmo:12,aiReserve:36,aiReload:0,fire:999,reactionUntil:999});");}
  const cast="activateAbility(player,'q',{aim:{yaw:0,pitch:-.04}})";
  check('all10 guns rupture at most5 actual loaded rounds for60 raw, reserve and other gun unchanged',()=>{
    setup();const guns=local.run("Object.keys(WEAPONS).filter(id=>WEAPONS[id].mag>0)");assert.equal(guns.length,10);
    for(const id of guns){setup();local.sandbox.w=id;local.run('enemy.aiWeapon=w;enemy.aiAmmo=WEAPONS[w].mag;var originalAmmo=enemy.aiAmmo');assert.ok(local.run(cast),id);assert.equal(local.run('enemy.aiAmmo'),local.run('originalAmmo')-5);assert.equal(local.run('enemy.hp'),40);assert.equal(local.run('enemy.aiReserve'),36);assert.equal(local.run('player.ammo'),12);}
  });
  check('damage uses actual removed1 or3 rounds and normal armor, no forced full60',()=>{
    for(const [ammo,hp,armor]of [[1,88,0],[3,64,0],[5,80,10]]){setup();local.run('enemy.aiAmmo='+ammo+';enemy.armor='+(armor?50:0));assert.ok(local.run(cast));assert.equal(local.run('enemy.aiAmmo'),0);assert.equal(local.run('enemy.hp'),hp);assert.equal(local.run('enemy.armor'),armor);}
  });
  check('empty/invalid ammo, reload, service, knife, friendly, flash, wall, smoke and distance reject without damage or cost',()=>{
    for(const code of ['enemy.aiAmmo=0','enemy.aiAmmo=NaN','enemy.aiAmmo=Infinity','enemy.aiAmmo=1.5','enemy.aiAmmo=13','enemy.aiReload=1',"enemy.serviceReload={weapon:'classic',start:10,end:10.8}","enemy.aiWeapon='knife'","enemy.team=player.team",'enemy.z=-31']){setup();local.run(code);assert.equal(local.run(cast),undefined,code);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('player.kit.updraft'),1);}
    setup();local.wall({z:-5,width:8,height:6});assert.equal(local.run(cast),undefined);assert.equal(local.run('enemy.hp'),100);
    setup();local.run("smokes.push({x:0,y:1,z:-5,radius:2,end:100,mesh:new THREE.Mesh(new THREE.SphereGeometry(2),new THREE.MeshBasicMaterial())})");assert.equal(local.run(cast),undefined);assert.equal(local.run('player.kit.updraft'),1);
    setup();local.run("ordinarySkills.cast('nope-flash',{id:'flash',team:'red',x:0,y:0,z:-9,hp:100,alive:true},{x:0,y:1.7,z:-3},elapsed,match.round);elapsed+=NOPE_SKILLS.flashFlight+.01;updateOrdinarySkills()");assert.equal(local.run(cast),undefined);assert.equal(local.run('enemy.hp'),100);
  });
  check('full20 event refusal rolls stock back, preserves ammo/HP and existing events',()=>{
    setup();local.run("for(let i=0;i<20;i++)ordinarySkills.cast('cat-pluck',{...ordinaryActorView(player),id:'fill'+i},{x:0,y:1.3,z:-10,targetId:'enemy'},elapsed,match.round)");assert.equal(local.run(cast),undefined);assert.equal(local.run('player.kit.updraft'),1);assert.equal(local.run('enemy.aiAmmo'),12);assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('ordinarySkills.events(elapsed).length'),20);
  });
  check('lethal rupture awards one normal kill and point; duplicate/corpse cannot repeat damage or reward',()=>{
    setup();local.run('enemy.hp=40');assert.ok(local.run(cast));assert.equal(local.run('enemy.alive'),false);assert.equal(local.run('player.kit.ultPoints'),1);const k=local.run('roster[0].k'),credits=local.run('match.credits');assert.equal(k,1);local.run('player.kit.updraft=1');assert.equal(local.run(cast),undefined);assert.equal(local.run('roster[0].k'),k);assert.equal(local.run('match.credits'),credits);assert.equal(local.run('player.kit.ultPoints'),1);
  });
  check('guest prediction changes only stock; event restore never reapplies damage; remote host action deduplicates',()=>{
    setup();local.run("onlinePlaying=true;online={host:false,session:{memberId:'guest'}};enemy.netTarget={weapon:'classic',ammo:12,reloading:0,serviceReload:null}");assert.ok(local.run("activateAbility(player,'q',{predict:true,aim:{yaw:0,pitch:-.04}})"));assert.equal(local.run('enemy.hp'),100);assert.equal(local.run('enemy.aiAmmo'),12);assert.equal(local.run('player.kit.updraft'),0);assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);
    setup();local.run(cast);const guest=harness();guest.reset();guest.sandbox.transfer=copy(local.run('ordinarySkills.snapshot()'));assert.equal(guest.run('ordinarySkills.restore(transfer,elapsed,match.round)'),true);assert.equal(guest.run('player.hp'),100);assert.equal(guest.run('ordinarySkills.restore(transfer,elapsed,match.round)'),true);assert.equal(guest.run('player.hp'),100);
    setup();local.run("enemy.kit=new DuelistKit({character:'cat'});enemy.kit.updraft=1;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;player.armor=0;onlinePlaying=true;online={host:true,session:{memberId:'host'}};netParticipants.set('guest',enemy.id);var p={type:'input',seq:1,connection:'burst-test',round:match.round,input:{x:0,y:0,z:-10,yaw:Math.PI,pitch:0},actions:[{type:'ability',seq:1,round:match.round,key:'q',yaw:Math.PI,pitch:-.04}]};receiveNetPacket('guest',p);updateRemoteActor(enemy,.016);receiveNetPacket('guest',p);updateRemoteActor(enemy,.016)");assert.equal(local.run('player.hp'),40);assert.equal(local.run('player.ammo'),7);assert.equal(local.run('netApplied.get("guest")'),1);
  });
  check('death/new round clear event without delayed damage and CAT C/E/X contracts remain untouched',()=>{
    setup();local.run(cast);local.run('player.alive=false;player.hp=0;updateOrdinarySkills()');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('enemy.hp'),40);setup();local.run(cast);local.run('ordinarySkills.update([],elapsed,match.round+1)');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);assert.equal(local.run('enemy.hp'),40);
  });
  console.log('PASS: '+groups+' actual-game CAT burst damage/rejection/authority/cleanup groups; audio inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const runner=new Module(path.join(__dirname,'cat-burst-harness.cjs'),module);runner.filename=path.join(__dirname,'cat-burst-harness.cjs');runner.paths=Module._nodeModulePaths(__dirname);runner._compile(fixture.slice(0,boundary)+suite,runner.filename);
