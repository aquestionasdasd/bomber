const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-onnara-game.cjs'),'utf8'),boundary=fixture.indexOf(' const local=harness();');
if(boundary<0)throw Error('Saved game harness boundary missing');
const suite=String.raw`
 const local=harness();
 function setup(h=local){h.reset();h.clearWalls();h.run("clearCombatInput();match.phase='live';mode='play';exploring=false;makeBot({x:0,z:-4},0,'blue',{id:'ally',name:'観戦の味方',team:'blue',primary:'vandal',secondary:'classic',kit:new DuelistKit({character:'cat'})});var ally=bots[0];ally.aiWeapon='vandal';ally.aiAmmo=17;ally.aiReserve=40;ally.rangeTarget=true;makeBot({x:60,z:60},1,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});bots[1].rangeTarget=true;player.alive=false;player.hp=0;deathView.reset();spectateIndex=0");}
 function step(h=local){h.run('updatePlay(.016);renderWithDetonation(.016)');}
 const active=h=>h.run("gun.children.find(c=>c.visible&&c.name.startsWith('Viewmodel / '))?.name");
 check('dead player sees living teammate hands and equipped gun after the final FX render',()=>{setup();step();assert.equal(local.run('spectatedBot.id'),'ally');assert.equal(local.run('gun.visible'),true);assert.equal(active(local),'Viewmodel / vandal');assert.equal(local.run('gun.userData.handCharacter'),'cat');assert.equal(local.run('ally.group.visible'),false);assert.equal(local.run('inventory.active'),'classic');assert.equal(local.run('player.ammo'),12);});
 check('all15 teammate palettes and10 guns/knife follow the watched actor, never the dead inventory',()=>{
  setup();step();for(const id of Object.keys(imported.CHARACTER_DEFS)){local.sandbox.characterId=id;local.run('ally.kit=new DuelistKit({character:characterId});updateFirstPersonEquipment(.016)');assert.equal(local.run('gun.userData.handCharacter'),id);}
  for(const id of ['classic','ghost','spectre','vandal','phantom','pump','drum','scout','atlas','forge','knife']){local.sandbox.weaponId=id;local.run('ally.aiWeapon=weaponId;updateFirstPersonEquipment(.016);renderWithDetonation(.016)');assert.equal(active(local),'Viewmodel / '+id);assert.equal(local.run('gun.visible'),true);}
  assert.equal(local.run('inventory.active'),'classic');assert.equal(local.run('player.ammo'),12);
 });
 check('teammate reload, work and firing animate existing hands without changing combat RNG or dead player state',()=>{
  setup();step();local.run("ally.aiReload=WEAPONS.vandal.reload*.65;updateFirstPersonEquipment(.016)");assert.ok(local.run("gun.getObjectByName('Equipment / vandal').children[0].position.y")<-.1);
  local.run("ally.aiReload=0;ally.planting=true;updateFirstPersonEquipment(.016)");assert.equal(local.run('flash.visible'),false);
  local.run("ally.planting=false;ally.flash=.07;ally.shotSequence=1;var draws=0;Math.random=()=>{draws++;return .5};updateFirstPersonEquipment(.016)");assert.equal(local.run('flash.visible'),true);assert.equal(local.run('draws'),0,'watcher brass cannot change host combat random sequence');assert.equal(local.run('reloading'),0);assert.equal(local.run('player.ammo'),12);
 });
 check('switching same-weapon teammates clears stale casings/reload and restores own equipment on respawn',()=>{
  setup();step();local.run("ally.flash=.07;ally.shotSequence=1;updateFirstPersonEquipment(.016);makeBot({x:3,z:-4},2,'blue',{id:'other',name:'次の味方',team:'blue',primary:'vandal',secondary:'classic',kit:new DuelistKit({character:'duck'})});var other=bots[2];other.aiWeapon='vandal';other.rangeTarget=true;var hiddenBefore=gun.children.filter(c=>c.isMesh&&c.visible).length;spectateIndex=1");step();assert.equal(local.run('spectatedBot.id'),'other');assert.equal(local.run('ally.group.visible'),true);assert.equal(local.run('gun.userData.handCharacter'),'duck');assert.equal(local.run('gun.children.filter(c=>c.isMesh&&c.visible).length'),0,'prior brass cleared even with identical weapon');
  local.run("player.alive=true;player.hp=100;player.kit=new DuelistKit({character:'nope'});updatePlay(.016);renderWithDetonation(.016)");assert.equal(active(local),'Viewmodel / classic');assert.equal(local.run('gun.userData.handCharacter'),'nope');assert.equal(local.run('gun.visible'),true);assert.equal(local.run('other.group.visible'),true);assert.equal(local.run('spectatedBot'),null);
 });
 check('death hold, no living ally, enemy-only, driver, spike and menu never reveal invalid equipment',()=>{
  setup();local.run("deathView.begin([0,1.7,0],[0,0,0])");step();assert.equal(local.run('gun.visible'),false);assert.equal(local.run('spectatedBot'),null);
  local.run('deathView.reset()');step();assert.equal(local.run('gun.visible'),true);local.run('ally.alive=false');step();assert.equal(local.run('gun.visible'),false);
  setup();local.run("ally.team='red'");step();assert.equal(local.run('gun.visible'),false);
  setup();step();local.run("ally.aiWeapon='spike';updateFirstPersonEquipment(.016)");assert.equal(local.run('gun.visible'),false);
  local.run("ally.aiWeapon='vandal';map.traffic={service:{seat:id=>id==='ally'?{driving:true}:null}};updateFirstPersonEquipment(.016)");assert.equal(local.run('gun.visible'),false);local.run("map.traffic.service.seat=()=>({driving:false});updateFirstPersonEquipment(.016)");assert.equal(local.run('gun.visible'),true);local.run("delete map.traffic;mode='menu';renderWithDetonation(.016)");assert.equal(local.run('gun.visible'),false);
 });
 check('dead ADS never hides a teammate gun; own SCOUT/ATLAS scope guard survives final FX and pause',()=>{
  setup();local.run("inventory.primary='atlas';inventory.active='atlas';aiming=true");step();assert.equal(local.run('gun.visible'),true);assert.equal(active(local),'Viewmodel / vandal');
  for(const id of ['scout','atlas']){local.sandbox.weaponId=id;local.run('player.alive=true;player.hp=100;inventory.primary=weaponId;inventory.active=weaponId;aiming=true;updatePlay(.016);renderWithDetonation(.016)');assert.equal(local.run('gun.visible'),false);local.run("mode='pause';renderWithDetonation(.016)");assert.equal(local.run('gun.visible'),false);local.run("aiming=false;mode='play';renderWithDetonation(.016)");assert.equal(local.run('gun.visible'),true);}
 });
 check('independent host/guest JSON uses approved teammate equipment and reload, including paused snapshots',()=>{
  const host=harness(),guest=harness();setup(host);guest.reset();host.run("roster.splice(1,roster.length-1,ally.record,bots[1].record);ally.remoteId='teammate';ally.netWeapon='pump';ally.netAmmo=3;ally.netReserve=20;ally.netReload=WEAPONS.pump.reload*.65;onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>captured=p};var captured;tickOnline(.1)");guest.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','player')");guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer);deathView.reset()");step(guest);assert.equal(guest.run('spectatedBot.id'),'ally');assert.equal(active(guest),'Viewmodel / pump');assert.equal(guest.run('gun.userData.handCharacter'),'cat');assert.ok(guest.run("gun.getObjectByName('Equipment / pump').children[0].position.y")<-.1);
  host.run("ally.netWeapon='ghost';ally.netReload=0;ally.kit=new DuelistKit({character:'onnara'});elapsed+=.2;mode='pause';tickOnline(.2)");guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer);renderWithDetonation(.016)");assert.equal(active(guest),'Viewmodel / ghost');assert.equal(guest.run('gun.userData.handCharacter'),'onnara');assert.equal(guest.run('gun.visible'),true);assert.equal(guest.run('inventory.active'),'classic');
 });
 console.log('PASS '+groups+' actual spectator equipment groups; audio inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const compiled=new Module(path.join(__dirname,'spectator-equipment-harness.cjs'),module);compiled.filename=path.join(__dirname,'spectator-equipment-harness.cjs');compiled.paths=module.paths;compiled._compile(fixture.slice(0,boundary)+suite,compiled.filename);
