const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8');
const prefix=fixture.slice(0,fixture.indexOf(" check('C quick cast"));
const network=fixture.slice(fixture.indexOf(' function peers()'),fixture.indexOf(" check('independent host/guest flight"));
const probe=String.raw`
 check('kit spends immediately, no timer refill, exactly2 post-use kills, no full-stock banking',()=>{
  const k=new imported.DuelistKit({character:'renko'});assert.equal(imported.signatureCooldown('renko'),0);
  for(let i=0;i<4;i++)k.awardKill();assert.equal(k.dashKills,0);
  for(let cycle=0;cycle<3;cycle++){
   assert.equal(k.activate('e',10+cycle).type,'renko-jet');assert.deepEqual([k.dash,k.dashKills,k.nextSignatureAt],[0,0,0]);
   for(const now of[28,999,1e9]){k.tick(now);assert.equal(k.dash,0);assert.equal(k.activate('e',now),null);}
   k.awardKill();assert.deepEqual([k.dash,k.dashKills],[0,1]);k.tick(1e9);assert.equal(k.dash,0);
   assert.equal(imported.getSkillState(k,'e',1e9).progress,.5);
   k.awardKill();assert.deepEqual([k.dash,k.dashKills],[1,0]);assert.equal(imported.getSkillState(k,'e').ready,true);
  }
 });
 check('JSON restore keeps1of2, sanitizes counters and rejects legacy timer/forged dash arm',()=>{
  const k=new imported.DuelistKit({character:'renko'});k.activate('e',10);k.awardKill();const saved=copy(k.snapshot());
  const q=new imported.DuelistKit();q.restore({...saved,nextSignatureAt:28,armReadyAt:10,armExpiresAt:20});
  assert.deepEqual([q.dash,q.dashKills,q.nextSignatureAt,q.armReadyAt,q.armExpiresAt],[0,1,0,null,null]);q.tick(99);assert.equal(q.dash,0);q.awardKill();assert.equal(q.dash,1);
  for(const bad of[-1,NaN,Infinity,'1',{},null]){q.restore({...saved,dashKills:bad});assert.equal(q.dashKills,0);}
  q.restore({...saved,dashKills:99});assert.equal(q.dashKills,1);q.restore({...saved,dash:1});assert.equal(q.dashKills,0);
  q.restore({...saved,character:'mend'});assert.equal(q.dashKills,0);assert.equal(imported.signatureCooldown('mend'),18);
  const d=new imported.DuelistKit();d.activate('e',10);d.activate('e',11);d.awardKill();assert.equal(d.dash,1,'other kill-based signature remains1kill');
 });
 check('savedgame actual firearm kills only: nonlethal/team/corpse/other killer do not count; HUD0/2→1/2→READY',()=>{
  setup();h.run("useAbility('e');releaseRenkoJet();updateHUD();updateAbilityFeedback()");assert.equal(h.elements.get('ability-e-count').textContent,'0/2キル');
  h.run("damageEntity(enemy,1,player,{firearm:true});enemy.team=player.team;damageEntity(enemy,999,player)");assert.equal(h.run('player.kit.dashKills'),0);
  h.run("enemy.team='red';enemy.hp=1;enemy.armor=0;shoot();updateHUD();updateAbilityFeedback()");assert.deepEqual(copy(h.run('[player.kit.dash,player.kit.dashKills]')),[0,1]);assert.equal(h.elements.get('ability-e-count').textContent,'1/2キル');
  h.run("damageEntity(enemy,999,player);elapsed+=999;player.kit.tick(elapsed)");assert.equal(h.run('player.kit.dash'),0);assert.equal(h.run('player.kit.dashKills'),1);
  h.run("makeBot({x:20,z:-20},1,'red',{id:'other',team:'red',credits:800,kit:new DuelistKit({character:'nope'})});damageEntity(bots[1],999,enemy)");assert.equal(h.run('player.kit.dashKills'),1);
  h.run("enemy.alive=true;enemy.hp=1;enemy.armor=0;player.fire=0;shoot();updateHUD();updateAbilityFeedback()");assert.deepEqual(copy(h.run('[player.kit.dash,player.kit.dashKills,totalKills]')),[1,0,2]);assert.equal(h.elements.get('ability-e-count').textContent,'READY');
  assert.deepEqual(h.elements.get('message').children.map(n=>n.textContent),['ジェットパック / 再使用可能','Eで再使用できます']);
 });
 check('BOT confirmed kills share the same two-kill kit rule; round reset clears partial progress',()=>{
  setup();h.run("enemy.kit=new DuelistKit({character:'renko'});activateAbility(enemy,'e');damageEntity(player,999,enemy)");assert.deepEqual(copy(h.run('[enemy.kit.dash,enemy.kit.dashKills]')),[0,1]);
  h.run("makeBot({x:20,z:20},1,'blue',{id:'second',team:'blue',credits:800,kit:new DuelistKit({character:'nope'})});damageEntity(bots[1],999,enemy)");assert.deepEqual(copy(h.run('[enemy.kit.dash,enemy.kit.dashKills]')),[1,0]);
  setup();h.run("activateAbility(player,'e');damageEntity(enemy,999,player);match.round++;match.phase='buy';spawnRound(false)");assert.deepEqual(copy(h.run('[player.kit.dash,player.kit.dashKills,player.kit.nextSignatureAt]')),[1,0,0]);
 });
 check('X still refills CQE on1kill, resets partial progress and never extends active1second flight',()=>{
  setup();h.run("activateAbility(player,'e');damageEntity(enemy,999,player);player.kit.ultPoints=7;useAbility('x');var end=renkoFlight(player).endsAt;player.kit.smoke=0;player.kit.updraft=0;enemy.alive=true;enemy.hp=100;damageEntity(enemy,999,player)");
  assert.deepEqual(copy(h.run('[player.kit.smoke,player.kit.updraft,player.kit.dash,player.kit.dashKills,player.kit.nextSignatureAt]')),[2,1,1,0,0]);assert.equal(h.run('renkoFlight(player).endsAt'),h.run('end'));near(h.run('end-elapsed'),1,'unchanged fixed flight');
  h.run("player.kit.renkoActive=false;releaseRenkoJet();activateAbility(player,'e');enemy.alive=true;enemy.hp=100;damageEntity(enemy,999,player)");assert.deepEqual(copy(h.run('[player.kit.dash,player.kit.dashKills]')),[0,1]);
 });
 check('independent JSON host/guest preserves partial kill count; client damage and duplicates grant none',()=>{
  const p=peers();request(p,'e');ack(p);p.host.run("damageEntity(player,999,enemy);netClock=0;tickOnline(.1)");ack(p);assert.deepEqual(copy(p.guest.run('[player.kit.dash,player.kit.dashKills]')),[0,1]);
  p.guest.run("damageEntity(bots[0],999,player);player.kit.tick(1e9)");ack(p);assert.deepEqual(copy(p.guest.run('[player.kit.dash,player.kit.dashKills]')),[0,1]);
  p.host.run("makeBot({x:30,z:30},1,'blue',{id:'second',team:'blue',credits:800,kit:new DuelistKit({character:'nope'})});damageEntity(bots[1],999,enemy);netClock=0;tickOnline(.1)");ack(p);assert.deepEqual(copy(p.guest.run('[player.kit.dash,player.kit.dashKills,player.kit.nextSignatureAt]')),[1,0,0]);ack(p);assert.equal(p.guest.run('player.kit.dash'),1);
 });
 check('accepted/rejected E actions clear or restore exact progress without new wire fields',()=>{
  const p=peers();const fields=Object.keys(copy(p.guest.run('player.kit.snapshot()'))).sort();request(p,'e');ack(p);assert.deepEqual(Object.keys(copy(p.guest.run('player.kit.snapshot()'))).sort(),fields);
  p.host.run('enemy.kit.dash=0;enemy.kit.dashKills=1;netClock=0;tickOnline(.1)');ack(p);p.guest.run("confirmRenkoSkill('e')");assert.equal(p.guest.run('player.kit.dashKills'),1);assert.equal(p.guest.run('netActions.length'),0);
  const q=peers();q.host.run("for(let i=0;i<20;i++)ordinarySkills.cast('onnara-chain',{...ordinaryActorView(player),id:'s'+i},ordinaryActorView(player),elapsed,match.round)");request(q,'e');ack(q);assert.deepEqual(copy(q.guest.run('[player.kit.dash,player.kit.dashKills]')),[1,0]);
 });
 // Fault injection stays in memory and uses the same behavioral contract.
 const code=fs.readFileSync(path.join(__dirname,'public/abilities.js'),'utf8');
 const faults=[
  ['onekill','signatureCooldown:0,signatureKills:2','signatureCooldown:0,signatureKills:1'],
  ['timer',"if (signatureCooldown(this.character) && this.dash === 0", "if ((signatureCooldown(this.character) || this.character === 'renko') && this.dash === 0"],
  ['restore','integer(value.dashKills, Math.max(0, signatureKillsRequired(this.character) - 1))','0'],
  ['Xcounter','this.dash=1;this.dashKills=0;this.nextSignatureAt=0;return true;','this.dash=1;this.nextSignatureAt=0;return true;']
 ];
 for(const [name,from,to]of faults){assert.ok(code.includes(from));const modified=code.replace(from,to).replace(/from '(\.\/[^']+)'/g,(_,rel)=>"from '"+require('node:url').pathToFileURL(path.join(__dirname,'public',rel)).href+"'");const m=await import('data:text/javascript;base64,'+Buffer.from(modified).toString('base64'));
  assert.throws(()=>{const k=new m.DuelistKit({character:'renko'});k.activate('e',10);k.awardKill();assert.deepEqual([k.dash,k.dashKills],[0,1]);
   if(name==='timer'){k.nextSignatureAt=28;k.tick(99);assert.equal(k.dash,0);}
   if(name==='restore'){const q=new m.DuelistKit();q.restore(copy(k.snapshot()));assert.equal(q.dashKills,1);}
   if(name==='Xcounter'){k.dashKills=0;k.ultPoints=7;k.activate('x',10);k.awardKill();assert.equal(k.dashKills,0);}
  },{code:'ERR_ASSERTION'},name);console.log('PASS detects memory-only '+name+' fault');
 }
 console.log('PASS: '+groups+' two-kill jet groups /4 memory faults; actual savedgame/JSON, audio inert');
}
module.exports=main;`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(prefix+network+probe,__filename);
m.exports().catch(e=>{console.error(e);process.exitCode=1;});
