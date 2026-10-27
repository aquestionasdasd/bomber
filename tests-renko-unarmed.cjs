const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8');
const fault=process.argv.find(a=>a.startsWith('--fault='))?.slice(8);
const faults={local:["!player.alive||renkoUnarmed(player)||busDriving()||carMotionActive(player)||match?.phase!=='live'","!player.alive||busDriving()||carMotionActive(player)||match?.phase!=='live'","all weapons"],host:["action.type!=='fire'||renkoUnarmed(actor)||carMotionActive(actor)","action.type!=='fire'||carMotionActive(actor)","host refuses"],visual:["state=local?null:actor.netTarget,unarmed=!!renkoUnarmed(actor)","state=local?null:actor.netTarget,unarmed=false","first-person"]};
if(fault){const[a,b]=faults[fault]||[];if(!a)throw Error('Unknown fault');const read=fs.readFileSync;fs.readFileSync=function(file,...args){let s=read.call(this,file,...args);if(String(file).replaceAll('\\','/').endsWith('/public/game.js')&&typeof s==='string'){if(!s.includes(a))throw Error('Missing fault anchor');s=s.replace(a,b);}return s;};}
const boundary=fixture.indexOf(' const h=harness();');
const network=fixture.slice(fixture.indexOf(' function peers()'),fixture.indexOf(" check('independent host/guest flight"));
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("player.kit=new DuelistKit({character:'renko'});player.kit.smoke=2;player.kit.updraft=1;match.phase='live';makeBot({x:0,z:-12},0,'red',{id:'enemy',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.remoteId='passive';enemy.hp=100;enemy.armor=50;enemy.fire=999;enemy.reactionUntil=999");}
 function step(t,g=h){g.sandbox.duration=t;g.run('for(let i=0;i<duration-1e-8;i+=1/60)updatePlay(Math.min(1/60,duration-i))');}
 check('all weapons and knife refuse fire/reload/ADS/equip while flying, preserving ammo and inventory',()=>{
  for(const id of['classic','ghost','spectre','vandal','phantom','scout','atlas','forge','pump','drum','knife']){
   setup();h.sandbox.weaponId=id;h.run("inventory={primary:weaponId,secondary:'classic',active:weaponId};equip(weaponId,true);player.ammo=Math.max(0,player.ammo-1);aiming=true;reloading=.5;firing=true;useAbility('e');var beforeAmmo=player.ammo,beforeReserve=player.reserve,beforeShots=shots;shoot();reload();equip('ghost')");
   assert.equal(h.run('shots'),h.run('beforeShots'),id);assert.equal(h.run('player.ammo'),h.run('beforeAmmo'),id);assert.equal(h.run('player.reserve'),h.run('beforeReserve'));assert.equal(h.run('inventory.active'),id);assert.equal(h.run('reloading'),0);assert.equal(h.run('aiming'),false);assert.equal(h.run('firing'),false);
   for(const f of h.listeners.get('mousedown')||[])f({button:2,preventDefault(){}});assert.equal(h.run('aiming'),false);
  }
 });
 check('C remains instant during flight and actually pushes without damage; early release and4s restore fire',()=>{
  for(const expiry of[false,true]){setup();h.run("equip('classic',true);useAbility('e');useAbility('c')");assert.equal(h.run('player.kit.smoke'),1);step(.2);assert.equal(h.run('enemy.carMotion.phase'),4);assert.equal(h.run('enemy.hp+enemy.armor'),150);assert.ok(h.run('renkoFlight(player)'));
   if(expiry)step(3.9);else h.run('releaseRenkoJet()');h.run('var before=player.ammo;shoot()');assert.equal(h.run('player.ammo'),h.run('before')-1);assert.equal(h.run('inventory.active'),'classic');
  }
 });
 check('first-person keeps both hands visible but hides weapon/muzzle in local and teammate spectator; end draws same gun',()=>{
  setup();h.run("equip('vandal',true);useAbility('e');updateFirstPersonEquipment(.016)");assert.equal(h.run('gun.visible'),true);assert.equal(h.run("gun.getObjectByName('Equipment / vandal').visible"),false);assert.equal(h.run('flash.visible'),false);assert.equal(h.run('gun.userData.handCharacter'),'renko');
  h.run('releaseRenkoJet();updateFirstPersonEquipment(.016)');assert.equal(h.run("gun.getObjectByName('Equipment / vandal').visible"),true);
  setup();h.run("enemy.team='blue';enemy.kit=new DuelistKit({character:'renko'});enemy.netWeapon='atlas';activateAbility(enemy,'e');player.alive=false;player.hp=0;deathView.reset();spectatedBot=enemy;updateFirstPersonEquipment(.016)");assert.equal(h.run('gun.visible'),true);assert.equal(h.run("gun.getObjectByName('Equipment / atlas').visible"),false);h.run('elapsed+=4.1;updateFirstPersonEquipment(.016)');assert.equal(h.run("gun.getObjectByName('Equipment / atlas').visible"),true);
 });
 check('third-person hides equipment and muzzle while preserving52 hit references and restores cached weapon',()=>{
  const model=imported.createAgentModel(THREE,{bot:{id:'renko'},team:'blue',character:'renko'}),refs=[...model.meshes];
  assert.equal(refs.length,52);
  for(const id of['vandal','atlas','classic','knife']){model.update(.016,{alive:true,character:'renko',weapon:id,unarmed:true,firing:true,shotSequence:2});assert.equal(model.group.getObjectByName('Equipment / '+id).visible,false);assert.equal(model.muzzle.visible,false);assert.deepEqual(model.meshes.slice(0,refs.length),refs);model.update(.016,{alive:true,weapon:id,unarmed:false});assert.equal(model.group.getObjectByName('Equipment / '+id).visible,true);}
  model.dispose();
 });
`+network+String.raw`
 check('host refuses forged gun/knife fire, reload/equip/drop while jet; C accepted and end restores host fire',()=>{
  const p=peers();request(p,'e');p.host.run("var beforeAmmo=enemy.netAmmo,beforeLast=enemy.lastNetShot;applyRemoteAction(enemy,{type:'fire',yaw:0,pitch:0},elapsed);applyRemoteAction(enemy,{type:'reload'},elapsed);applyRemoteAction(enemy,{type:'equip',weapon:'knife'},elapsed);applyRemoteAction(enemy,{type:'drop'},elapsed)");assert.equal(p.host.run('enemy.netAmmo'),p.host.run('beforeAmmo'));assert.equal(p.host.run('enemy.lastNetShot'),p.host.run('beforeLast'));assert.equal(p.host.run('enemy.netWeapon'),'classic');assert.equal(p.host.run('enemy.netReload'),0);
  p.host.run("activateAbility(enemy,'c');var dart=ordinarySkills.events(elapsed).find(e=>e.type==='renko-dart'&&e.sourceId===enemy.id)");assert.ok(p.host.run('dart'));assert.equal(p.host.run('enemy.kit.smoke'),1);p.host.run("elapsed+=4.1;applyRemoteAction(enemy,{type:'fire',yaw:0,pitch:0},elapsed)");assert.equal(p.host.run('enemy.netAmmo'),p.host.run('beforeAmmo')-1);
 });
 check('guest C queues while E prediction pending, ACK/refusal restore presentation without new snapshot fields',()=>{
  const p=peers();request(p,'e');p.guest.run("confirmRenkoSkill('c');updateFirstPersonEquipment(.016)");assert.equal(p.guest.run('player.kit.smoke'),1);assert.equal(p.guest.run("netActions.filter(a=>a.type==='ability'&&a.key==='c').length"),1);assert.equal(p.guest.run('player.renkoPending.key'),'e');assert.equal(p.guest.run("gun.getObjectByName('Equipment / classic').visible"),false);
  p.host.sandbox.request={type:'input',seq:2,connection:'renko',round:p.host.run('match.round'),input:{yaw:0,pitch:.4,jet:true},actions:copy(p.guest.run('netActions'))};p.host.run("receiveNetPacket('guest',request);elapsed+=.05;updateRemoteActor(enemy,.05);netClock=0;tickOnline(.1)");assert.equal(p.host.run('enemy.kit.smoke'),1);assert.ok(p.host.run("ordinarySkills.events(elapsed).find(e=>e.type==='renko-dart'&&e.sourceId===enemy.id)"));ack(p);p.guest.run('updateFirstPersonEquipment(.016)');assert.equal(p.guest.run("gun.getObjectByName('Equipment / classic').visible"),false);assert.equal(p.guest.run('player.kit.smoke'),1);p.guest.run('releaseRenkoJet();updateFirstPersonEquipment(.016)');assert.equal(p.guest.run("gun.getObjectByName('Equipment / classic').visible"),true);
  const q=peers();q.host.run("for(let i=0;i<20;i++)ordinarySkills.cast('onnara-chain',{...ordinaryActorView(player),id:'s'+i},ordinaryActorView(player),elapsed,match.round)");request(q,'e');q.guest.run('updateFirstPersonEquipment(.016)');assert.equal(q.guest.run("gun.getObjectByName('Equipment / classic').visible"),false);ack(q);q.guest.run('updateFirstPersonEquipment(.016)');assert.equal(q.guest.run("gun.getObjectByName('Equipment / classic').visible"),true);assert.equal(q.guest.run('player.kit.dash'),1);
  assert.equal(p.host.run("Object.hasOwn(captureNetActor(enemy),'unarmed')"),false);
 });
 console.log('PASS: '+groups+' actual Renko unarmed/visual/independent JSON groups; audio inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const compiled=new Module(__filename,module);compiled.filename=__filename;compiled.paths=module.paths;
compiled._compile(fixture.slice(0,boundary).replace('fn(); groups++;',`if(${JSON.stringify(faults[fault]?.[2]||'')}&&!label.startsWith(${JSON.stringify(faults[fault]?.[2]||'')}))return;fn(); groups++;`)+suite,__filename);
