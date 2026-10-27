const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
// Reuse the silent, independent saved-game worlds, never a running browser.
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8');
const prefix=fixture.slice(0,fixture.indexOf(" check('C arms/cancels"));
const network=fixture.slice(fixture.indexOf(' function peers()'),fixture.indexOf(" check('independent host/guest flight"));
const probe=`
 check('kit X costs7, no activation refill, repeated kills restore exact CQE/cooldown, strict optional restore',()=>{
  const k=new imported.DuelistKit({character:'renko'});k.smoke=0;k.updraft=0;k.dash=0;k.nextSignatureAt=90;
  k.ultPoints=6;assert.equal(k.activate('x',10),null);k.ultPoints=7;assert.equal(k.activate('x',10).type,'renko-restart');assert.equal(k.ultPoints,0);assert.equal(k.smoke,0);assert.equal(k.dash,0);
  assert.equal(k.awardKill(),true);assert.deepEqual([k.smoke,k.updraft,k.dash,k.nextSignatureAt,k.ultPoints],[2,1,1,0,1]);
  k.smoke=0;k.updraft=0;k.dash=0;k.nextSignatureAt=99;k.awardKill();assert.deepEqual([k.smoke,k.updraft,k.dash,k.nextSignatureAt,k.ultPoints],[2,1,1,0,2]);
  k.ultPoints=7;assert.equal(k.activate('x',11),null);assert.equal(k.ultPoints,7);
  const state=copy(k.snapshot()),restored=new imported.DuelistKit();restored.restore(state);assert.equal(restored.renkoActive,true);
  for(const bad of[1,'true',{},null]){restored.restore({...state,renkoActive:bad});assert.equal(restored.renkoActive,false);}
  restored.restore({...state,character:'duelist'});assert.equal(restored.renkoActive,false);k.resetRound();assert.equal(k.renkoActive,false);assert.equal('renkoActive' in k.snapshot(),false);
 });
 check('actual firearm kill refills only after lethal loss, duplicate corpse gives no refill, gun/HP/armor unchanged',()=>{
  setup();h.run("player.kit.ultPoints=7;useAbility('x');player.kit.smoke=0;player.kit.updraft=0;player.kit.dash=0;player.kit.nextSignatureAt=99;damageEntity(enemy,1,player,{firearm:true})");assert.equal(h.run('player.kit.smoke'),0);
  h.run("enemy.hp=1;enemy.armor=0;player.hp=47;player.armor=23;shoot()");assert.equal(h.run('enemy.alive'),false);assert.deepEqual(copy(h.run('[player.kit.smoke,player.kit.updraft,player.kit.dash,player.kit.nextSignatureAt,player.hp,player.armor,player.ammo]')),[2,1,1,0,47,23,11]);
  h.run("player.kit.smoke=0;damageEntity(enemy,999,player,{firearm:true})");assert.equal(h.run('player.kit.smoke'),0);assert.equal(h.run('totalKills'),1);assert.equal(h.run('player.kit.ultPoints'),1);
 });
 check('without X, friendly damage and nonlethal hits cannot replenish; multiple confirmed enemy kills can',()=>{
  setup();h.run("player.kit.smoke=0;player.kit.updraft=0;player.kit.dash=0;damageEntity(enemy,999,player)");assert.equal(h.run('player.kit.smoke'),0);
  setup();h.run("player.kit.ultPoints=7;useAbility('x');player.kit.smoke=0;enemy.team=player.team;damageEntity(enemy,999,player)");assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('player.kit.smoke'),0);
  for(let i=0;i<3;i++){h.run("enemy.team='red';enemy.alive=true;enemy.hp=100;enemy.armor=50;player.kit.smoke=0;player.kit.updraft=0;player.kit.dash=0;player.kit.nextSignatureAt=99;damageEntity(enemy,999,player)");assert.deepEqual(copy(h.run('[player.kit.smoke,player.kit.updraft,player.kit.dash,player.kit.nextSignatureAt]')),[2,1,1,0]);}
 });
 check('X is independent of event20 but obeys death/work/seal/paused/phase and outgoing64 without spending',()=>{
  setup();h.run("for(let i=0;i<20;i++)ordinarySkills.cast('onnara-chain',{...ordinaryActorView(player),id:'s'+i},ordinaryActorView(player),elapsed,match.round);player.kit.ultPoints=7;useAbility('x')");assert.equal(h.run('player.kit.renkoActive'),true);assert.equal(h.run('ordinarySkills.events(elapsed).length'),20);
  for(const block of["player.alive=false;player.hp=0","player.planting=true","player.defusing=true","match.phase='buy'","netHostPaused=true","ordinarySkills.cast('duck-seal',ordinaryActorView(enemy),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round)"]){setup();h.run('player.kit.ultPoints=7');h.run(block);h.run("activateAbility(player,'x')");assert.equal(h.run('player.kit.ultPoints'),7,block);assert.equal(h.run('player.kit.renkoActive'),false,block);}
  const p=peers();p.guest.run("player.kit.ultPoints=7;netActions=Array.from({length:64},(_,i)=>({seq:i+1,type:'reload',round:match.round}));useAbility('x')");assert.equal(p.guest.run('player.kit.ultPoints'),7);assert.equal(p.guest.run('player.kit.renkoActive'),false);
 });
 check('death including delayed kill, team change, next round, menu and new round clear active X',()=>{
  for(const stop of["damageEntity(player,999,enemy)","player.alive=false;player.hp=0;updateOrdinarySkills()","player.team='red';updateOrdinarySkills()","match.round++;updateOrdinarySkills()","backMenu()","match.round++;match.phase='buy';spawnRound(false)"]){setup();h.run("player.kit.ultPoints=7;useAbility('x')");h.run(stop);assert.equal(h.run('player.kit.renkoActive'),false,stop);}
  setup();h.run("player.kit.ultPoints=7;useAbility('x');damageEntity(player,999,enemy);player.kit.smoke=0;damageEntity(enemy,999,player)");assert.equal(h.run('player.kit.smoke'),0);
 });
 check('independent host/guest X activation ACK/refusal/duplicate, client kill cannot refill, host kill restores kit',()=>{
  const p=peers();p.host.run('enemy.kit.ultPoints=7');p.guest.run('player.kit.ultPoints=7');request(p,'x');assert.equal(p.guest.run('player.kit.renkoActive'),true);assert.equal(p.host.run('enemy.kit.renkoActive'),true);ack(p);assert.equal(p.guest.run('player.kit.ultPoints'),0);
  p.guest.run('player.kit.smoke=0;damageEntity(bots[0],999,player)');assert.equal(p.guest.run('player.kit.smoke'),0);
  p.host.run("enemy.kit.smoke=0;enemy.kit.updraft=0;enemy.kit.dash=0;enemy.kit.nextSignatureAt=99;damageEntity(player,999,enemy,{firearm:true});netClock=0;tickOnline(.1)");ack(p);assert.deepEqual(copy(p.guest.run('[player.kit.smoke,player.kit.updraft,player.kit.dash,player.kit.nextSignatureAt,player.kit.ultPoints]')),[2,1,1,0,1]);
  p.guest.run('player.kit.smoke=0');ack(p);assert.equal(p.guest.run('player.kit.smoke'),0);assert.equal(p.guest.run('player.kit.ultPoints'),1);assert.equal(p.guest.run('player.kit.renkoActive'),true);
  const q=peers();q.guest.run('player.kit.ultPoints=7');request(q,'x');assert.equal(q.guest.run('player.kit.renkoActive'),true);ack(q);assert.equal(q.guest.run('player.kit.renkoActive'),false);assert.equal(q.guest.run('player.kit.ultPoints'),0);
 });
 check('fresh same-round snapshot restores active X, host death clears it and old round cannot reactivate',()=>{
  const p=peers();p.host.run("enemy.kit.ultPoints=7;activateAbility(enemy,'x');netClock=0;tickOnline(.1)");p.guest.run('netRound=-1');ack(p);assert.equal(p.guest.run('player.kit.renkoActive'),true);assert.equal(p.guest.run('renkoUltimateActive(player)'),true);
  p.host.run("damageEntity(enemy,999,player);netClock=0;tickOnline(.1)");ack(p);assert.equal(p.guest.run('player.kit.renkoActive'),false);
  p.host.run("online.room={code:'ABCDEFGH'};match.round++;match.phase='buy';spawnRound(false);netClock=0;tickOnline(.1)");ack(p);assert.equal(p.guest.run('player.kit.renkoActive'),false);
 });
 check('refill preserves current Q/E end times; HUD and descriptions expose X and refill status',()=>{
  setup();h.run("player.kit.ultPoints=7;useAbility('x');activateAbility(player,'q');activateAbility(player,'e');var jetEnd=renkoFlight(player).endsAt,driveEnd=renkoEvent(player,'renko-drive').endsAt;player.kit.smoke=0;damageEntity(enemy,999,player);updateHUD()");assert.equal(h.run('renkoFlight(player).endsAt'),h.run('jetEnd'));assert.equal(h.run("renkoEvent(player,'renko-drive').endsAt"),h.run('driveEnd'));assert.equal(h.elements.get('ability-x-count').textContent,'発動中');assert.match(h.elements.get('status-effects').textContent,/敵撃破でC・Q・E全回復/);assert.match(h.sandbox.getCharacterUltimate('renko').description,/死亡で終了/);
  h.run('elapsed+=4.1;updateOrdinarySkills()');assert.ok(h.run("activateAbility(player,'e')"));
 });
 console.log('PASS: '+groups+' Renko X groups; actual savedgame/independent JSON, audio inert');
}
module.exports=main;`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(prefix+network+probe,__filename);
m.exports().catch(e=>{console.error(e);process.exitCode=1;});
