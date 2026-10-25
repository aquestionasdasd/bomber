const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main(){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const m=new Module(path.join(__dirname,'post-plant-harness.cjs'),module);m.filename=path.join(__dirname,'post-plant-harness.cjs');m.paths=module.paths;
 m._compile(base.slice(0,cut)+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const{harness}=await m.exports();let groups=0;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name)},copy=x=>JSON.parse(JSON.stringify(x));
 function setup(format='standard'){
  const h=harness();h.reset();h.sandbox.format=format;h.run(`mode='menu';$('match-format').value=format;startGame();if(match.phase==='buy')match.startLive();match.events=[];mode='play';
   var site=map.sites[0];Object.assign(player,{x:site.x,z:site.z,y:0,vy:0,vx:0,vz:0,alive:true});
   Object.assign(match.spike,{status:'carried',carrier:player.id,plantProgress:0,plantActor:null});`);return h;
 }
 function arm(h,primary='vandal',secondary='ghost'){
  Object.assign(h.sandbox,{primary,secondary});h.run(`inventory={primary,secondary,active:secondary||'knife'};ammoStore={};equip(secondary||'knife',true);if(primary)ammoStore[primary]={ammo:2,reserve:7};if(secondary){player.ammo=3;player.reserve=9;ammoStore[secondary]={ammo:3,reserve:9};}equip('spike');interactionHeld=true;`);
 }
 function work(h,dt){h.sandbox.dt=dt;h.run('updateInteraction(dt,true);if(objectivePractice)updateObjectivePractice(dt);else handleMatchEvents()');}
 test('all owned primary guns outrank sidearms after actual four-second plant; stored ammo and raised model survive',()=>{
  const h=setup(),primaries=copy(h.run("Object.keys(WEAPONS).filter(id=>WEAPONS[id].slot==='primary')"));assert.ok(primaries.includes('vandal')&&primaries.includes('phantom'));
  for(const id of primaries){h.run(`Object.assign(match.spike,{status:'carried',carrier:player.id,plantProgress:0,plantActor:null});match.events=[];`);arm(h,id);work(h,3.99);assert.equal(h.run('inventory.active'),'spike');work(h,.01);
   assert.equal(h.run('match.spike.status'),'planted',id);assert.equal(h.run('inventory.active'),id);assert.equal(h.run('player.ammo'),2,id);assert.equal(h.run('player.reserve'),7,id);assert.equal(h.run('interactionHeld'),false);
   h.run('updateFirstPersonEquipment(.1)');assert.equal(h.run('gun.visible'),true,id);
  }
 });
 test('without a primary every owned sidearm is selected; no owned firearm falls back to knife',()=>{
  const h=setup(),sidearms=copy(h.run("Object.keys(WEAPONS).filter(id=>WEAPONS[id].slot==='secondary')"));assert.ok(sidearms.length>0);
  for(const id of [...sidearms,null]){h.run(`Object.assign(match.spike,{status:'carried',carrier:player.id,plantProgress:0,plantActor:null});match.events=[];`);arm(h,null,id);work(h,4);assert.equal(h.run('inventory.active'),id||'knife');if(id){assert.equal(h.run('player.ammo'),3);assert.equal(h.run('player.reserve'),9);}}
 });
 test('cancelled work and another planter never switch the local weapon; a dead planter is not rearmed',()=>{
  const h=setup();arm(h);work(h,2);h.run('interactionHeld=false;updateInteraction(.1,true);handleMatchEvents()');assert.equal(h.run('inventory.active'),'spike');assert.equal(h.run('match.spike.status'),'carried');assert.equal(h.run('match.spike.plantProgress'),0);
  h.run(`equip('knife');var ally=bots.find(b=>b.team===player.team);match.spike.carrier=ally.id;match.interactPlant(4,{actorId:ally.id,team:ally.team,site:site.id,x:site.x,z:site.z});handleMatchEvents()`);assert.equal(h.run('inventory.active'),'knife');
  arm(h);h.run(`Object.assign(match.spike,{status:'carried',carrier:player.id,plantProgress:0,plantActor:null});match.interactPlant(4,{actorId:player.id,team:player.team,site:site.id,x:site.x,z:site.z});player.alive=false;handleMatchEvents()`);assert.equal(h.run('inventory.active'),'spike');
 });
 test('actual plant practice also returns to the primary; repeated event handling does not undo later manual selection',()=>{
  const h=setup('plant');arm(h);work(h,4);assert.equal(h.run('objectivePractice.completed'),true);assert.equal(h.run('inventory.active'),'vandal');h.run("equip('ghost');updateObjectivePractice(.1);handleMatchEvents()");assert.equal(h.run('inventory.active'),'ghost');
 });
 function peers(primary){
  const host=setup(),guest=setup();for(const[h,isHost]of[[host,true],[guest,false]]){h.sandbox.isHost=isHost;h.run(`online={host:isHost,session:{memberId:isHost?'host':'friend',hostId:'host'},room:{code:'PLANT234',hostId:'host',status:'playing',settings:{format:'standard'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send(p){this.sent.push(p)},close(){}};onlinePlaying=true;mode='menu';$('starting-side').value='defend';$('match-format').value='standard';startGame();netSequence=0;netLastSnapshot=0;netHasSnapshot=false;netRound=0;netClock=0;netInputs.clear();netApplied.clear();netActions=[];netActionSequence=0;elapsed=10;if(isHost){match.startLive();match.events=[]}`);}
  host.sandbox.primary=primary;host.run(`var remote=bots.find(b=>b.remoteId==='friend'),site=map.sites[0];Object.assign(remote,{x:site.x,z:site.z,y:0,vy:0,netWeapon:'ghost',netAmmo:3,netReserve:9,netReload:0});Object.assign(remote.record,{primary,secondary:'ghost'});remote.netStores={};if(primary)remote.netStores[primary]={ammo:2,reserve:7};Object.assign(match.spike,{status:'carried',carrier:remote.id,plantProgress:0,plantActor:null});applyRemoteAction(remote,{type:'equip',weapon:'spike'});`);
  return{host,guest,send(){host.run('netLastSnapshot=-100;tickOnline(.1)');const packet=copy(host.run('online.sent.at(-1)'));guest.sandbox.incoming=packet;guest.run("receiveNetPacket('host',incoming)");return packet;}};
 }
 test('independent JSON host/guest waits for completion ACK, restores primary or pistol ammo, and releases held4',()=>{
  for(const primary of['vandal',null]){
   const{host,guest,send}=peers(primary);send();guest.run('interactionHeld=true;updateInteraction(4,true)');assert.equal(guest.run('inventory.active'),'spike');assert.equal(guest.run('match.spike.status'),'carried');
   host.run(`for(let i=0;i<40;i++){elapsed+=.1;netInputs.set('friend',{input:{x:remote.x,z:remote.z,y:0,yaw:0,pitch:0,interact:true},round:match.round,seq:i+1,received:elapsed,actions:[]});updateRemoteActor(remote,.1);handleMatchEvents();}`);
   assert.equal(host.run('match.spike.status'),'planted');assert.equal(host.run('remote.netWeapon'),primary||'ghost');assert.equal(host.run('remote.planting'),false);const packet=send();assert.equal(guest.run('inventory.active'),primary||'ghost');assert.equal(guest.run('player.ammo'),primary?2:3);assert.equal(guest.run('player.reserve'),primary?7:9);assert.equal(guest.run('interactionHeld'),false);guest.run('updateFirstPersonEquipment(.1)');assert.equal(guest.run('gun.visible'),true);
   guest.sandbox.incoming=copy(packet);guest.run("receiveNetPacket('host',incoming)");assert.equal(guest.run('inventory.active'),primary||'ghost');assert.equal(guest.run('netActions.length'),0,'automatic guest equip requires no new action');
   host.run("applyRemoteAction(remote,{type:'equip',weapon:'ghost'});handleMatchEvents()");send();assert.equal(guest.run('inventory.active'),'ghost','later manual choice is preserved');
  }
 });
 test('local plant grants unchanged reward once and can fire the raised primary immediately',()=>{
  const h=setup();arm(h);const credits=h.run('match.credits'),points=h.run('player.kit.ultPoints');work(h,4);assert.equal(h.run('match.credits'),Math.min(9000,credits+300));assert.equal(h.run('player.kit.ultPoints'),Math.min(7,points+1));h.run('handleMatchEvents()');assert.equal(h.run('player.kit.ultPoints'),Math.min(7,points+1));h.run('shoot()');assert.equal(h.run('player.ammo'),1);assert.equal(h.run('inventory.active'),'vandal');
 });
 console.log(`PASS: ${groups} actual saved-game post-plant equip groups; audio inert`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
