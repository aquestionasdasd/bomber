const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');if(cut<0)throw Error('Saved game fixture missing');
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("onlinePlaying=false;online=null;netActions=[];netParticipants.clear();player.kit=new DuelistKit({character:'urchin'});player.kit.updraft=1;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',primary:'spectre',secondary:'classic',credits:800});var enemy=bots[0];enemy.remoteId='passive';enemy.netWeapon='spectre';enemy.netAmmo=17;enemy.netReserve=53;enemy.netStores={classic:{ammo:7,reserve:22}};enemy.hp=100;enemy.armor=50;enemy.fire=999;enemy.reactionUntil=999;enemy.group.position.set(0,0,-10);enemy.group.updateMatrixWorld(true);soundEnabled=true;audioEvents.length=0;");}
 function mouse(button){for(const fn of h.listeners.get('game:mousedown')||[])fn({button,preventDefault(){}});}
 function step(seconds,hz=60,g=h){g.sandbox.seconds=seconds;g.sandbox.hz=hz;g.run('for(let t=0;t<seconds-1e-8;t+=1/hz)updatePlay(Math.min(1/hz,seconds-t))');}
 const event=(g=h)=>g.run("ordinarySkills.events(elapsed).find(e=>e.type==='urchin-disarm')");
 function cast(g=h,pitch=-.08){g.sandbox.throwPitch=pitch;assert.ok(g.run("activateAbility(player,'q',{aim:{yaw:0,pitch:throwPitch}})"));return event(g);}
 check('one blue held thorn; right/equip cancel free; shoot blocked; empty-air click consumes',()=>{
  setup();h.run("useAbility('q');renderOrdinarySkills();shoot()");assert.equal(h.run('duckAim'),'q');assert.equal(h.run('preparedSkillFX.hand.visible'),true);assert.equal(h.run('disarmFX.hand.visible'),false);assert.equal(h.run('shotSequence'),0);mouse(2);assert.equal(h.run('duckAim'),null);assert.equal(h.run('player.kit.updraft'),1);h.run("useAbility('q');equip('knife',true)");assert.equal(h.run('duckAim'),null);h.run("enemy.x=8;enemy.group.position.x=8;useAbility('q')");mouse(0);assert.equal(h.run('player.kit.updraft'),0);assert.equal(event().targetId,undefined);step(3);assert.equal(h.run('droppedWeapons.length'),0);
 });
 check('20/60/144Hz actual contact, no .45 lock timer, exactly one17/53 primary transfer, zero damage',()=>{
  for(const hz of[20,60,144]){setup();const e=cast();assert.ok(e.flight>.7);assert.equal(e.targetId,undefined);step(.5,hz);assert.equal(h.run('droppedWeapons.length'),0);step(.5,hz);assert.equal(h.run('droppedWeapons.length'),1);assert.equal(h.run('enemy.record.primary'),null);assert.equal(h.run('enemy.netWeapon'),'classic');assert.deepEqual(copy(h.run('[enemy.netAmmo,enemy.netReserve,enemy.hp,enemy.armor]')),[7,22,100,50]);assert.deepEqual(copy(h.run('serializeDrops().map(d=>[d.weapon,d.ammo,d.reserve])')),[['spectre',17,53]]);assert.equal(event().disarm[0],1);assert.ok(event().flight>.7&&event().flight<1);step(.1,hz);assert.equal(h.run('droppedWeapons.length'),1);}
 });
 check('walls and first friendly body stop; smoke permits physical contact; fixed aim allows sidestep',()=>{
  for(const hz of[20,60,144]){setup();h.wall({z:-5,height:4,width:20});cast();step(2,hz);assert.equal(h.run('droppedWeapons.length'),0);assert.equal(h.run('player.kit.updraft'),0);
   setup();h.run("syncSmokes([{id:1,x:0,y:1.3,z:-5,expires:30,kind:'smoke',radius:3.6}])");cast();step(1,hz);assert.equal(h.run('droppedWeapons.length'),1);
   setup();h.run("makeBot({x:0,z:-5},1,'blue',{id:'friend',team:'blue',primary:'vandal',secondary:'classic'});bots[1].remoteId='passive2';bots[1].netWeapon='vandal';bots[1].netAmmo=20;bots[1].netReserve=40;");cast();step(1.1,hz);assert.equal(h.run('droppedWeapons.length'),0);
   setup();cast();step(.2,hz);h.run('enemy.x=3;enemy.group.position.x=3');step(1,hz);assert.equal(h.run('droppedWeapons.length'),0);}
 });
 check('relative sweep catches between-frame crossing; nearest body only',()=>{
  setup();h.run('enemy.x=-2;enemy.z=-7.5;enemy.group.position.set(-2,0,-7.5)');cast();step(.6);h.run('enemy.x=2;enemy.group.position.x=2');step(.1,20);assert.equal(h.run('droppedWeapons.length'),1);
  setup();h.run("makeBot({x:0,z:-7},1,'red',{id:'near',team:'red',primary:'vandal',secondary:'classic'});var near=bots[1];near.remoteId='passive2';near.netWeapon='vandal';near.netAmmo=9;near.netReserve=31;");cast();step(1);assert.equal(h.run('near.record.primary'),null);assert.equal(h.run('enemy.record.primary'),'spectre');assert.equal(h.run('droppedWeapons.length'),1);
 });
 check('contact uses inventory primary despite equip; all primary categories; no primary/forbidden harmless',()=>{
  for(const id of['classic','knife']){setup();cast();h.sandbox.nextId=id;h.run("applyRemoteAction(enemy,{type:'equip',weapon:nextId},elapsed)");step(1);assert.deepEqual(copy(h.run('[serializeDrops()[0].ammo,serializeDrops()[0].reserve]')),[17,53]);assert.equal(h.run('enemy.netWeapon'),'classic');}
  setup();h.run('enemy.record.secondary=null');cast();step(1);assert.equal(h.run('enemy.netWeapon'),'knife');
  for(const change of['enemy.record.primary=null','enemy.weaponDropForbidden=true','enemy.kit.knivesActive=true;enemy.kit.knives=5']){setup();h.run(change);cast();step(1);assert.equal(h.run('droppedWeapons.length'),0,change);assert.equal(h.run('player.kit.updraft'),0);}
  for(const id of Object.keys(imported.WEAPONS).filter(id=>imported.WEAPONS[id].slot==='primary')){setup();h.sandbox.weaponId=id;h.run('enemy.record.primary=weaponId;enemy.netWeapon=weaponId');cast();step(1);assert.equal(h.run('serializeDrops()[0].weapon'),id);}
 });
 check('ordinary collision-safe toss; either team F pickup; concurrent pickup once with ammo preserved',()=>{
  for(const team of['blue','red']){setup();cast();step(1.4);h.sandbox.team=team;h.run("player.team=team;player.x=droppedWeapons[0].x;player.z=droppedWeapons[0].z;var id=droppedWeapons[0].id;var first=pickupDroppedWeapon(player,id);var second=pickupDroppedWeapon(enemy,id)");assert.equal(h.run('first'),true);assert.equal(h.run('second'),false);assert.equal(h.run('inventory.primary'),'spectre');assert.equal(h.run('player.ammo'),17);assert.equal(h.run('player.reserve'),53);assert.equal(h.run('droppedWeapons.length'),0);}
  setup();h.wall({z:-10.5,height:1});cast();step(1);assert.ok(h.run('serializeDrops()[0].z')>-10.4);step(2);assert.equal(h.run('droppedWeapons.length'),1);
 });
 check('32m horizontal cap and near-vertical throws; floor miss expires without tracking',()=>{
  for(const pitch of[-1.55,0,.65,1.55]){setup();h.run('enemy.x=8');const e=cast(h,pitch);assert.ok(Math.hypot(e.x-e.fromX,e.z-e.fromZ)<=32);assert.ok(e.flight>0&&e.flight<=8);assert.equal(e.targetId,undefined);step(e.flight+1.3);assert.equal(h.run('droppedWeapons.length'),0);assert.equal(event(),undefined);}
 });
 check('20event rollback,32drop refusal,64action rollback and strict no forged early success',()=>{
  setup();h.run("for(let i=0;i<20;i++)ordinarySkills.cast('urchin-lance',ordinaryActorView(player),{x:0,y:1.7,z:-40},elapsed,match.round)");assert.equal(h.run("activateAbility(player,'q',{aim:{yaw:0,pitch:-.08}})"),undefined);assert.equal(h.run('player.kit.updraft'),1);
  setup();h.run("for(let i=0;i<32;i++)dropItem('spectre',enemy)");cast();step(1);assert.equal(h.run('droppedWeapons.length'),32);assert.equal(h.run('enemy.record.primary'),'spectre');
  setup();h.run("onlinePlaying=true;online={host:false,session:{memberId:'guest',hostId:'host'},send:()=>{}};netActions=Array.from({length:64},(_,i)=>({seq:i+1,type:'reload',round:match.round}));useAbility('q');confirmUrchinSkill('q')");assert.equal(h.run('player.kit.updraft'),1);
  setup();cast();const state=copy(h.run('ordinarySkills.snapshot()')),now=h.run('elapsed'),round=h.run('match.round');assert.equal(imported.createCharacterSkills().restore(state,now,round),true);for(const mutate of[e=>e.targetId='enemy',e=>e.weaponId='spectre',e=>e.disarm=[1,0],e=>{e.targetId='enemy';e.weaponId='spectre';e.disarm=[1,1]},e=>e.disarm=[2,0],e=>e.disarm=[0,0,0]]){const bad=copy(state);mutate(bad.events[0]);assert.equal(imported.createCharacterSkills().restore(bad,now,round),false);}
 });
 check('duplicate remote throw and independent guest JSON carry a single authoritative drop',()=>{
  const host=harness(),guest=harness();setup(host);setup(guest);host.run("enemy.kit=new DuelistKit({character:'urchin'});enemy.remoteId='guest';enemy.kit.updraft=1;inventory.primary='vandal';equip('vandal',true);player.ammo=13;player.reserve=47;onlinePlaying=true;online={host:true,room:{code:'ABCDEFGH'},session:{memberId:'host'},send:p=>{captured=p}};netParticipants.set('guest','enemy');var captured;var packet={type:'input',seq:1,connection:'q',round:match.round,input:{x:0,y:0,z:-10,yaw:Math.PI,pitch:-.08},actions:[{type:'ability',seq:1,round:match.round,key:'q',yaw:Math.PI,pitch:-.08}]};receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016)");assert.equal(host.run('enemy.kit.updraft'),0);step(1,60,host);host.run('tickOnline(.1)');assert.equal(host.run('inventory.primary'),null);assert.equal(host.run('serializeDrops()[0].ammo'),13);
  guest.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','enemy')");guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer);receiveNetPacket('host',transfer)");assert.equal(guest.run('droppedWeapons.length'),1);assert.equal(guest.run('serializeDrops()[0].reserve'),47);assert.equal(guest.run('disarmLocks.size'),0);host.run("receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);updateOrdinarySkills()");assert.equal(host.run('droppedWeapons.length'),1);
 });
 check('guest prediction, success cue once, death and round/reset clean without extra drop',()=>{
  setup();h.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};confirmUrchinSkill('q')");assert.equal(h.run('player.kit.updraft'),0);assert.equal(h.run('enemy.record.primary'),'spectre');assert.equal(h.run('droppedWeapons.length'),0);
  setup();cast();step(1);assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-disarm-hit').length"),1);h.run('updateOrdinarySkills()');assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-disarm-hit').length"),1);h.run("match.phase='post';updateOrdinarySkills();renderOrdinarySkills()");assert.equal(h.run('disarmFX.group.children.length'),0);assert.equal(h.run('preparedSkillFX.group.children.length'),0);
  setup();cast();h.run('damageEntity(enemy,1000,player)');step(1);assert.equal(h.run('droppedWeapons.length'),1);h.run('resetOrdinarySkills();renderOrdinarySkills()');assert.equal(event(),undefined);
 });
 console.log('PASS '+groups+' thrown Q saved-game groups; one updatePlay/frame20/60/144Hz, audio inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const prefix=fixture.slice(0,cut).replace('addEventListener() {}, setAttribute',"addEventListener(type,fn) {const k=this.id+':'+type;if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(fn);}, setAttribute");
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(prefix+suite,__filename);
