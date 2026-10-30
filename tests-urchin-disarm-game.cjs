const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');if(cut<0)throw Error('Saved game fixture missing');
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("player.kit=new DuelistKit({character:'urchin'});player.kit.updraft=1;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',primary:'spectre',secondary:'classic',credits:800});var enemy=bots[0];enemy.remoteId='passive';enemy.netWeapon='spectre';enemy.netAmmo=17;enemy.netReserve=53;enemy.netStores={classic:{ammo:7,reserve:22}};enemy.hp=100;enemy.armor=50;enemy.fire=999;enemy.reactionUntil=999;enemy.group.position.set(0,0,-10);enemy.group.updateMatrixWorld(true);soundEnabled=true;audioEvents.length=0;");}
 function mouse(button,g=h){for(const fn of g.listeners.get('game:mousedown')||[])fn({button,preventDefault(){}});}
 function step(seconds,hz=60,g=h){g.sandbox.seconds=seconds;g.sandbox.hz=hz;g.run('for(let t=0;t<seconds-1e-8;t+=1/hz)updatePlay(Math.min(1/hz,seconds-t))');}
 const event=()=>h.run("ordinarySkills.events(elapsed).find(e=>e.type==='urchin-disarm')");
 function cast(g=h){const e=g.run("activateAbility(player,'q',{aim:{yaw:0,pitch:-.04}})");assert.ok(e,'real Q confirms');return e;}
 check('Q key holding/blue hand/reticle; right/equip cancel; invalid click keeps stock and no bullets',()=>{
  setup();h.run("useAbility('q');renderOrdinarySkills()");assert.equal(h.run('duckAim'),'q');assert.equal(h.run('disarmFX.hand.visible'),true);h.run('shoot()');assert.equal(h.run('shotSequence'),0);mouse(2);assert.equal(h.run('duckAim'),null);assert.equal(h.run('player.kit.updraft'),1);h.run("useAbility('q');equip('knife',true)");assert.equal(h.run('duckAim'),null);
  h.run("enemy.netWeapon='classic';useAbility('q')");mouse(0);assert.equal(h.run('player.kit.updraft'),1);assert.equal(event(),undefined);assert.equal(h.run('duckAim'),'q');h.run("enemy.netWeapon='spectre'");mouse(0);assert.equal(h.run('player.kit.updraft'),0);assert.ok(event());assert.equal(h.run('enemy.record.primary'),'spectre');assert.equal(h.run('droppedWeapons.length'),0);
 });
 check('20/60/144Hz shared .45 clock then exactly one primary/ammo transfer and no damage/stun',()=>{
  for(const hz of[20,60,144]){setup();cast();step(.44,hz);assert.equal(h.run('droppedWeapons.length'),0);step(.01,hz);assert.equal(h.run('droppedWeapons.length'),1);assert.equal(h.run('enemy.record.primary'),null);assert.equal(h.run('enemy.netWeapon'),'classic');assert.equal(h.run('enemy.netAmmo'),7);assert.equal(h.run('enemy.netReserve'),22);assert.deepEqual(copy(h.run('serializeDrops().map(d=>[d.weapon,d.ammo,d.reserve])')),[['spectre',17,53]]);assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('enemy.armor'),50);step(.1,hz);assert.equal(h.run('droppedWeapons.length'),1);assert.equal(h.run('player.kit.updraft'),0);}
 });
 check('32m limit, enemy/alive/primary categories, smoke/walls/nearer body exclusions are non-consuming',()=>{
  for(const change of["enemy.z=-32.01;enemy.group.position.z=enemy.z","enemy.team='blue'","enemy.alive=false","enemy.record.primary=null","enemy.netWeapon='classic'","enemy.netWeapon='knife'","enemy.netWeapon='spike'","enemy.kit.knivesActive=true","enemy.weaponDropForbidden=true"]){setup();h.run(change+';enemy.group.updateMatrixWorld(true)');assert.equal(h.run("activateAbility(player,'q',{aim:{yaw:0,pitch:-.04}})"),undefined,change);assert.equal(h.run('player.kit.updraft'),1);}
  setup();h.wall({z:-5});assert.equal(h.run("activateAbility(player,'q',{aim:{yaw:0,pitch:-.04}})"),undefined);assert.equal(h.run('player.kit.updraft'),1);
  setup();h.run("syncSmokes([{id:1,x:0,y:1.3,z:-5,expires:30,kind:'smoke',radius:3.6}])");assert.equal(h.run("activateAbility(player,'q',{aim:{yaw:0,pitch:-.04}})"),undefined);assert.equal(h.run('player.kit.updraft'),1);
  for(const id of Object.keys(imported.WEAPONS).filter(id=>imported.WEAPONS[id].slot==='primary')){setup();h.sandbox.weaponId=id;h.run('enemy.record.primary=weaponId;enemy.netWeapon=weaponId');cast();step(.45);assert.equal(h.run('serializeDrops()[0].weapon'),id);}
  setup();h.run('enemy.z=-32;enemy.group.position.z=-32;enemy.group.updateMatrixWorld(true)');assert.ok(h.run("activateAbility(player,'q',{aim:{yaw:0,pitch:-.0125}})"));
 });
 check('continuous wall/smoke .10 interrupts; brief .05 flicker recovers; consumed on failure',()=>{
  for(const hz of[20,60,144]){setup();cast();step(.1,hz);h.wall({z:-5});step(.16,hz);assert.equal(event().disarm[0],2);h.clearWalls();step(.4,hz);assert.equal(h.run('droppedWeapons.length'),0);assert.equal(h.run('player.kit.updraft'),0);
   setup();cast();step(.1,hz);h.wall({z:-5});step(.05,hz);h.clearWalls();step(.31,hz);assert.equal(h.run('droppedWeapons.length'),1);}
  setup();cast();h.run("syncSmokes([{id:1,x:0,y:1.3,z:-5,expires:30,kind:'smoke',radius:3.6}])");step(.2);assert.equal(event().disarm[0],2);
 });
 check('deadline range/death/team fail; equip alone cannot evade locked primary and ammo',()=>{
  for(const change of['enemy.z=-33','enemy.alive=false;enemy.hp=0',"enemy.team='blue'"]){setup();cast();h.run(change);step(.46);assert.equal(h.run('droppedWeapons.length'),0);assert.equal(h.run('enemy.record.primary'),'spectre');}
  for(const id of['classic','knife']){setup();cast();h.sandbox.nextId=id;h.run("applyRemoteAction(enemy,{type:'equip',weapon:nextId},elapsed)");step(.46);assert.equal(h.run('serializeDrops()[0].ammo'),17);assert.equal(h.run('serializeDrops()[0].reserve'),53);assert.equal(h.run('enemy.netWeapon'),'classic');}
  setup();h.run('enemy.record.secondary=null');cast();step(.46);assert.equal(h.run('enemy.netWeapon'),'knife');
 });
 check('normal handoff/reacquisition of same kind invalidates lock; death collision cannot duplicate',()=>{
  setup();cast();h.run("var old=dropItem('spectre',enemy);enemy.record.primary=null;enemy.netWeapon='classic'");step(.31);h.run('enemy.x=old.x;enemy.z=old.z;pickupDroppedWeapon(enemy,old.id)');assert.equal(h.run('enemy.record.primary'),'spectre');step(.15);assert.equal(h.run('enemy.record.primary'),'spectre');assert.equal(h.run('droppedWeapons.length'),0);assert.equal(event().disarm[0],2);
  setup();cast();h.run('damageEntity(enemy,1000,player)');step(.46);assert.equal(h.run('droppedWeapons.length'),1);
 });
 check('ordinary floor toss settles, clips walls/edge; Q drops not auto-picked or expired',()=>{
  setup();cast();step(.45);const drop=copy(h.run('serializeDrops()[0]'));assert.ok(Math.hypot(drop.x,drop.z+10)<=.751);assert.ok(drop.motion);assert.equal(h.run('pickupDroppedWeapon(enemy,droppedWeapons[0].id)'),false);step(.4);h.run('enemy.x=droppedWeapons[0].x;enemy.z=droppedWeapons[0].z');assert.equal(h.run('pickupDroppedWeapon(enemy,droppedWeapons[0].id)'),true);assert.equal(h.run('enemy.netAmmo'),17);assert.equal(h.run('enemy.netReserve'),53);
  setup();h.wall({z:-10.5,height:1});cast();step(.45);assert.ok(h.run('serializeDrops()[0].z')>-10.4);step(2);assert.equal(h.run('droppedWeapons.length'),1);
 });
 check('either team pickup uses ordinary inventory constraints; concurrent attempts only one wins',()=>{
  for(const team of['blue','red']){setup();cast();step(.9);h.sandbox.team=team;h.run("player.team=team;player.x=droppedWeapons[0].x;player.z=droppedWeapons[0].z;var id=droppedWeapons[0].id;var first=pickupDroppedWeapon(player,id);var second=pickupDroppedWeapon(enemy,id)");assert.equal(h.run('first'),true);assert.equal(h.run('second'),false);assert.equal(h.run('inventory.primary'),'spectre');assert.equal(h.run('player.ammo'),17);assert.equal(h.run('player.reserve'),53);assert.equal(h.run('droppedWeapons.length'),0);}
 });
 check('actual remote duplicate action, separate guest JSON and delayed/fresh snapshots never mutate ownership twice',()=>{
  const host=harness(),guest=harness();setup(host);setup(guest);host.run("enemy.kit=new DuelistKit({character:'urchin'});enemy.remoteId='guest';enemy.kit.updraft=1;inventory.primary='vandal';equip('vandal',true);player.ammo=13;player.reserve=47;onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p}};netParticipants.set('guest','enemy');var captured;var packet={type:'input',seq:1,connection:'q',round:match.round,input:{x:0,y:0,z:-10,yaw:Math.PI,pitch:-.04},actions:[{type:'ability',seq:1,round:match.round,key:'q',yaw:Math.PI,pitch:-.04}]};receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016)");assert.equal(host.run('enemy.kit.updraft'),0);host.run('elapsed+=.45;updateOrdinarySkills();tickOnline(.1)');assert.equal(host.run('inventory.primary'),null);assert.equal(host.run('serializeDrops()[0].ammo'),13);
  guest.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','enemy')");guest.sandbox.transfer=copy(host.run('captured'));guest.run("receiveNetPacket('host',transfer);receiveNetPacket('host',transfer)");assert.equal(guest.run('droppedWeapons.length'),1);assert.equal(guest.run('serializeDrops()[0].reserve'),47);assert.equal(guest.run('disarmLocks.size'),0);host.run("receiveNetPacket('guest',packet);updateRemoteActor(enemy,.016);updateOrdinarySkills()");assert.equal(host.run('droppedWeapons.length'),1);
 });
 check('20event/32drop/full action capacity cannot spend; strict optional Q fields reject forgery',()=>{
  setup();h.run("for(let i=0;i<20;i++)ordinarySkills.cast('urchin-lance',ordinaryActorView(player),{x:0,y:1.7,z:-40},elapsed,match.round)");assert.equal(h.run("activateAbility(player,'q',{aim:{yaw:0,pitch:-.04}})"),undefined);assert.equal(h.run('player.kit.updraft'),1);
  setup();h.run("for(let i=0;i<32;i++)dropItem('spectre',enemy)");assert.equal(h.run("activateAbility(player,'q',{aim:{yaw:0,pitch:-.04}})"),undefined);assert.equal(h.run('player.kit.updraft'),1);
  setup();cast();const state=copy(h.run('ordinarySkills.snapshot()')),now=h.run('elapsed'),round=h.run('match.round');assert.equal(imported.createCharacterSkills().restore(state,now,round),true);for(const mutate of[e=>e.weaponId='classic',e=>e.disarm=[1,0],e=>e.disarm=[3,1],e=>e.disarm=[1,1],e=>e.disarm=[0,0,0]]){const bad=copy(state);mutate(bad.events[0]);assert.equal(imported.createCharacterSkills().restore(bad,now,round),false);}
 });
 check('warning/success/failure sound records, no tide mark, resets/round end clear all Q presentation and locks',()=>{
  setup();cast();step(.32);assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-disarm-warning').length"),1);step(.14);assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-disarm-hit').length"),1);assert.equal(h.run('disarmLocks.tidePull()'),null);h.run('updateOrdinarySkills()');assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-disarm-hit').length"),1);h.run("match.phase='post';updateOrdinarySkills();renderOrdinarySkills()");assert.equal(h.run('disarmLocks.size'),0);assert.equal(h.run('disarmFX.group.children.length'),0);assert.equal(h.run('disarmFX.hand.visible'),false);
 });
 check('airborne gun falls to real floor; full arc respects overhead solid and world edge',()=>{
  setup();h.run('enemy.y=4;var plan=urchinDropPoint(enemy)');assert.equal(h.run('plan.y'),0);assert.equal(h.run('validDropMotion(plan.motion,plan,elapsed)'),true);assert.ok(h.run('dropFlightDuration(plan)')>.7);assert.ok(Math.abs(h.run('dropFlight(plan,elapsed+5).y'))<1e-7);
  h.run('map.colliders.push({minX:-2,maxX:2,minZ:-12,maxZ:-8,base:4.5,height:5});map.collision=createCollisionIndex(map.colliders);plan=urchinDropPoint(enemy)');assert.ok(h.run('plan'));assert.equal(h.run('plan.motion[4]'),0);assert.ok(h.run('dropFlight(plan,elapsed+.1).y')<=4.2);
  setup();h.run('enemy.z=-81.8;var edge=urchinDropPoint(enemy)');assert.ok(h.run('edge'));assert.ok(h.run('edge.z')>=-81.94);
 });
 check('guest prediction/full queue rollback and local victim .1s interrupt feedback stay authoritative',()=>{
  setup();h.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};confirmUrchinSkill('q')");assert.equal(h.run('player.kit.updraft'),0);assert.equal(h.run('enemy.record.primary'),'spectre');assert.equal(h.run('disarmLocks.size'),0);assert.equal(h.run('droppedWeapons.length'),0);assert.equal(h.run("netActions.filter(a=>a.type==='ability').length"),1);
  setup();h.run("onlinePlaying=true;online={host:false,session:{memberId:'guest',hostId:'host'},send:()=>{}};netActions=Array.from({length:64},(_,i)=>({seq:i+1,type:'reload',round:match.round}));useAbility('q');confirmUrchinSkill('q')");assert.equal(h.run('player.kit.updraft'),1);
  setup();cast();h.wall({z:-5});step(.2);assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-disarm-fail').length"),1);step(.2);assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-disarm-fail').length"),1);
 });
 console.log('PASS: '+groups+' Urchin Q actual saved-game groups; real frame20/60/144Hz, mock audio only');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const prefix=fixture.slice(0,cut).replace('addEventListener() {}, setAttribute',"addEventListener(type,fn) {const k=this.id+':'+type;if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(fn);}, setAttribute");
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(prefix+suite,__filename);
