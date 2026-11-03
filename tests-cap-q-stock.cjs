const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');
if(cut<0)throw Error('Missing saved-game harness');
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("player.kit=new DuelistKit({character:'cap'});match.phase='buy';match.phaseTime=30;mode='shop';match.credits=100");}
 check('actual shop buys two Q at50 each, full/poor/dead/live reject, and refunds preserve price',()=>{
  setup();assert.equal(h.run("clickSkillPurchase('q')"),true);assert.equal(h.run('match.credits'),50);assert.equal(h.run('player.kit.updraft'),1);
  assert.equal(h.run("clickSkillPurchase('q')"),true);assert.equal(h.run('match.credits'),0);assert.equal(h.run('player.kit.updraft'),2);
  h.run('match.credits=800');assert.equal(h.run("clickSkillPurchase('q')"),false);assert.equal(h.run('match.credits'),800);
  assert.equal(h.run("clickSkillPurchase('q',true)"),true);assert.equal(h.run('match.credits'),850);assert.equal(h.run('player.kit.updraft'),1);
  assert.equal(h.run("clickSkillPurchase('q',true)"),true);assert.equal(h.run('match.credits'),900);assert.equal(h.run("clickSkillPurchase('q',true)"),false);
  h.run('match.credits=49');assert.equal(h.run("clickSkillPurchase('q')"),false);assert.equal(h.run('match.credits'),49);
  h.run('match.credits=100;player.alive=false');assert.equal(h.run("clickSkillPurchase('q')"),false);h.run("player.alive=true;match.phase='live'");assert.equal(h.run("clickSkillPurchase('q')"),false);
 });
 check('HUD, selection and shop show shared2 stock and50 price, with one purchase from49 rejected',()=>{
  setup();h.run("skillUI.updateSelection('cap');updateShop();updateHUD()");
  assert.match(h.elements.get('shop-skill-q-count').textContent,/0\/2/);assert.equal(h.elements.get('shop-skill-q-price').textContent,'SC 50');
  assert.equal(h.elements.get('ability-q-count').textContent,'0/2');
  h.run("clickSkillPurchase('q');clickSkillPurchase('q');updateHUD()");assert.equal(h.elements.get('ability-q-count').textContent,'2/2');assert.equal(h.elements.get('shop-skill-q').dataset.state,'所持数 MAX');
  assert.match(h.elements.get('character-skill-q-meta').textContent,/最大2回.*50/);
 });
 check('both A/B casts share two charges, preparation and switching do not spend, empty third creates no event',()=>{
  setup();h.run("clickSkillPurchase('q');clickSkillPurchase('q');match.phase='live';mode='play';player.pitch=-.9;useAbility('q');capGrenadeMode='damage'");assert.equal(h.run('player.kit.updraft'),2);
  h.run("useAbility('q')");assert.equal(h.run('player.kit.updraft'),2);
  h.run("capGrenadeMode='heal';confirmCapSkill('q')");assert.equal(h.run('player.kit.updraft'),1);
  h.run("capGrenadeMode='damage';confirmCapSkill('q')");assert.equal(h.run('player.kit.updraft'),0);
  assert.deepEqual(copy(h.run('ordinarySkills.events(elapsed).map(e=>e.type)')),['cap-cluster-heal','cap-cluster-damage']);
  h.run("confirmCapSkill('q')");assert.equal(h.run('ordinarySkills.events(elapsed).length'),2);
 });
 check('snapshot stock0/1/2 roundtrips, clamps overflow, carries unused purchases and reset clears',()=>{
  for(const n of[0,1,2]){const kit=new imported.DuelistKit({character:'cap'});kit.updraft=n;const restored=new imported.DuelistKit({character:'cap'});restored.restore(copy(kit.snapshot()));assert.equal(restored.updraft,n);restored.resetRound();assert.equal(restored.updraft,n);restored.resetRound({reset:true});assert.equal(restored.updraft,0);}
  const kit=new imported.DuelistKit({character:'cap'});kit.restore({...kit.snapshot(),updraft:999});assert.equal(kit.updraft,2);
 });
 function peers(){const host=harness(),guest=harness();setup(host);setup(guest);
  host.run("match.phase='live';mode='play';makeBot({x:0,z:-2.5},0,'red',{id:'enemy',team:'red',secondary:'classic'});var enemy=bots[0];enemy.kit=new DuelistKit({character:'cap'});enemy.kit.updraft=2;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,room:{code:'ABCDEFGH'},session:{memberId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest',enemy.id);var captured;netClock=0;tickOnline(.1)");
  guest.run("match.phase='live';mode='play';onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send(){}};netParticipants.set('guest','enemy')");
  const p={host,guest};ack(p);return p;
 }
 function ack(p){p.guest.sandbox.packet=copy(p.host.run('captured'));p.guest.run("receiveNetPacket('host',packet)");}
 function request(p,seq,mode){p.guest.sandbox.choice=mode;p.guest.run("player.pitch=-.9;capGrenadeMode=choice;confirmCapSkill('q')");p.host.sandbox.request={type:'input',seq,connection:'cap',round:p.host.run('match.round'),input:{x:0,y:0,z:-2.5,yaw:0,pitch:-.9},actions:copy(p.guest.run('netActions'))};p.host.run("receiveNetPacket('guest',request);updateRemoteActor(enemy,.05);elapsed+=.05;updateRemoteActor(enemy,.05);netClock=0;tickOnline(.1)");}
 check('independent host/guest consumes2→1→0 for A/B, duplicate request does not spend twice',()=>{
  const p=peers();assert.equal(p.guest.run('player.kit.updraft'),2);request(p,1,'heal');ack(p);assert.equal(p.guest.run('player.kit.updraft'),1);assert.equal(p.host.run('enemy.kit.updraft'),1);
  p.host.run("receiveNetPacket('guest',request);updateRemoteActor(enemy,.05)");assert.equal(p.host.run('ordinarySkills.events(elapsed).length'),1);
  request(p,2,'damage');ack(p);assert.equal(p.guest.run('player.kit.updraft'),0);assert.equal(p.host.run('enemy.kit.updraft'),0);assert.equal(p.host.run('ordinarySkills.events(elapsed).length'),2);
 });
 check('20event refusal rolls guest2→1 prediction back to2 and keeps host stock2',()=>{
  const p=peers();p.host.run("for(let i=0;i<20;i++)ordinarySkills.cast('cap-lens',ordinaryActorView(player),{x:0,y:.12,z:0,flight:1},elapsed,match.round)");request(p,1,'damage');assert.equal(p.guest.run('player.kit.updraft'),1);ack(p);assert.equal(p.guest.run('player.kit.updraft'),2);assert.equal(p.host.run('enemy.kit.updraft'),2);
 });
 console.log('PASS: '+groups+' Cap Q stock/price groups; audio/rendering inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(fixture.slice(0,cut)+suite,__filename);
