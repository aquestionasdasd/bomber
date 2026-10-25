const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 let prefix=base.slice(0,cut).replace('play() {}, unlock()',"play(type,options) {(document.audioLog??=[]).push({type,...options});}, unlock()");assert.notEqual(prefix,base.slice(0,cut));
 prefix=prefix.replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const mod=new Module(path.join(__dirname,'combat-audio-harness.cjs'),module);mod.filename=path.join(__dirname,'combat-audio-harness.cjs');mod.paths=module.paths;mod.mutateGameSource=mutate;mod._compile(prefix+'\n return {harness};\n}\nmodule.exports=main;',mod.filename);
 const {harness}=await mod.exports(),local=harness(),host=harness(),guest=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name);},copy=v=>JSON.parse(JSON.stringify(v));
 const notes=p=>(p.sandbox.document.audioLog||[]).filter(n=>n.type==='gun-hit'||/^kill-[1-5]$/.test(n.type));
 const clear=p=>{p.sandbox.document.audioLog=[];};
 function setup(p){p.reset();clear(p);p.run(`soundEnabled=true;volume=1;makeBot({x:0,z:-5},0,'red',{id:'red-0',team:'red',name:'TARGET',primary:'vandal',secondary:'classic'});var victim=bots[0];victim.rangeTarget=true;victim.kit=new DuelistKit({character:'frost'});victim.group.position.set(0,0,-5);player.pitch=-.10;`);}
 test('actual torso hit and final bullet use distinct close confirmation, one sound and no legacy double',()=>{
  setup(local);local.run('shoot()');assert.ok(local.run('victim.hp<100&&victim.alive'));assert.deepEqual(notes(local).map(n=>n.type),['gun-hit']);assert.equal(notes(local)[0].distance,0);assert.equal(notes(local)[0].pan,0);
  clear(local);local.run('victim.hp=1;elapsed+=1;lastShot=-10;shoot()');assert.equal(local.run('victim.alive'),false);assert.deepEqual(notes(local).map(n=>n.type),['kill-1']);assert.equal(local.sandbox.document.audioLog.filter(n=>['hit','kill'].includes(n.type)).length,0);
 });
 test('all10 guns including multi-pellet pump confirm at most once per victim per cartridge',()=>{
  for(const id of ['classic','ghost','spectre','phantom','vandal','pump','drum','scout','atlas','forge']){setup(local);local.sandbox.gunId=id;local.run(`victim.hp=1000;equip(gunId,true);shoot()`);assert.ok(local.run('victim.hp<1000'),id);assert.deepEqual(notes(local).map(n=>n.type),['gun-hit'],id);}
 });
 test('armor loss confirms; guarded lethal is a hit; zero, team, dead, melee and skill paths cannot invent gun confirmation',()=>{
  setup(local);local.run('victim.armor=50;damageEntity(victim,10,player,{firearm:true})');assert.deepEqual(notes(local).map(n=>n.type),['gun-hit']);assert.ok(local.run('victim.armor<50'));
  clear(local);local.run(`damageEntity(victim,0,player,{firearm:true});damageEntity(player,20,player,{firearm:true});damageEntity(victim,1,player,{skill:'nope'});damageEntity(victim,1,player);victim.alive=false;damageEntity(victim,20,player,{firearm:true})`);assert.equal(notes(local).length,0);
  setup(local);local.run(`victim.hp=50;ordinarySkills.cast('duck-egg',{id:victim.id,team:victim.team,x:0,y:0,z:-5,hp:1,alive:true},{x:0,y:0,z:-5},elapsed,match.round);damageEntity(victim,100,player,{firearm:true})`);assert.equal(local.run('victim.hp'),1);assert.deepEqual(notes(local).map(n=>n.type),['gun-hit']);
 });
 test('actual wall, decoy and empty-space shots have no flesh/kill confirmation',()=>{
  setup(local);local.wall();local.run('shoot()');assert.equal(notes(local).length,0);
  setup(local);local.run('clearBots()');local.seed('red');local.run('shoot()');assert.equal(notes(local).length,0);
  setup(local);local.run('clearBots();shoot()');assert.equal(notes(local).length,0);
 });
 function peer(p,isHost){p.sandbox.isHost=isHost;p.run(`online={host:isHost,session:{memberId:isHost?'host':'friend',hostId:'host'},room:{code:'AUDIO234',hostId:'host',status:'playing',settings:{format:'standard'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send(packet,{team}={}){if(team===undefined||team==='red')this.sent.push(packet);},close(){}};onlinePlaying=true;mode='menu';$('match-format').value='standard';$('starting-side').value='attack';startGame();if(isHost){match.startLive();match.drainEvents();}netSequence=0;netLastSnapshot=0;netHasSnapshot=false;netRound=0;netClock=0;netInputs.clear();netApplied.clear();netActions=[];netActionSequence=0;netSeenCueSequence=0;netCues.length=0;elapsed=10;soundEnabled=true;volume=1;for(const b of bots){b.rangeTarget=true;b.x=65;b.z=60;b.group.position.set(b.x,0,b.z);}`);clear(p);}
 function deliver(from,to,id){const packet=copy(from.run('online.sent.at(-1)'));assert.ok(packet);to.sandbox.packet=packet;to.run(`receiveNetPacket('${id}',packet)`);return packet;}
 function peers(gun='classic'){
  peer(host,true);peer(guest,false);host.sandbox.gunId=gun;
  host.run(`player.x=60;player.z=65;var remote=bots.find(b=>b.remoteId==='friend');Object.assign(remote,{x:0,y:0,z:0,netYaw:0,crouch:0,netWeapon:gunId,netAmmo:WEAPONS[gunId].mag,lastNetShot:-10});remote.group.position.set(0,0,0);remote.record.primary=WEAPONS[gunId].slot==='primary'?gunId:null;remote.record.secondary='classic';var victim=bots.find(b=>b.team==='blue');Object.assign(victim,{x:0,y:0,z:-5,hp:1000,armor:0});victim.group.position.set(0,0,-5);tickOnline(.1)`);deliver(host,guest,'host');clear(host);clear(guest);
 }
 test('independent actual guest shot is silent until host accepts; replayed input and snapshots never repeat confirmation',()=>{
  for(const gun of ['classic','pump']){peers(gun);guest.run(`player.yaw=0;player.pitch=-.1;lastShot=-10;renderedRecoil=0;player.recoil=0;shoot();tickOnline(.1)`);assert.equal(notes(guest).length,0,gun+' prediction');const input=deliver(guest,host,'friend');host.run('updateRemoteActor(remote,.05)');assert.ok(host.run('victim.hp<1000'));assert.equal(notes(host).length,0,'Other shooter must not hear the guest receipt');host.sandbox.replay=input;host.run(`receiveNetPacket('friend',replay);updateRemoteActor(remote,.05);tickOnline(.1)`);const accepted=deliver(host,guest,'host');assert.deepEqual(notes(guest).map(n=>n.type),['gun-hit']);guest.sandbox.again=accepted;guest.run(`receiveNetPacket('host',again);applyNetCues(again,false,player.id)`);assert.equal(notes(guest).length,1);}
 });
 test('guest kill receipt remains audible at round end and only its shooter hears it',()=>{
  peers();host.run(`victim.hp=1;damageEntity(victim,100,remote,{firearm:true});match.phase='post';match.phaseTime=5;tickOnline(.1)`);const last=deliver(host,guest,'host');assert.deepEqual(notes(guest).map(n=>n.type),['kill-1']);assert.equal(last.cues.filter(c=>c.type==='kill-1').length,1);clear(guest);guest.run(`netSeenCueSequence=0;applyNetCues(packet,false,'other-actor')`);assert.equal(notes(guest).length,0);
 });
 test('fresh, stale, future, old-round and invalid receipts are consumed silently; mute/volume0 cannot replay after enabling',()=>{
  peers();host.run('damageEntity(victim,10,remote,{firearm:true});tickOnline(.1)');const good=copy(host.run('online.sent.at(-1)'));assert.ok(good.cues.some(c=>c.type==='gun-hit'));
  const cases=[p=>p.time+=2,p=>p.time-=1,p=>p.rules.round++,p=>p.rules.phase='buy',p=>p.cues[0].weapon='knife',p=>p.cues[0].weapon='__proto__',p=>p.cues[0].time=NaN,p=>p.cues[0].y=Infinity];
  for(const change of cases){clear(guest);const bad=copy(good);change(bad);guest.sandbox.receipt=bad;guest.run('netSeenCueSequence=0;applyNetCues(receipt,false,player.id)');assert.equal(notes(guest).length,0);}
  for(const gate of ['soundEnabled=false;volume=1','soundEnabled=true;volume=0']){clear(guest);guest.sandbox.receipt=good;guest.run(`netSeenCueSequence=0;${gate};applyNetCues(receipt,false,player.id);soundEnabled=true;volume=1;applyNetCues(receipt,false,player.id)`);assert.equal(notes(guest).length,0);}
  clear(guest);guest.sandbox.receipt=good;guest.run('netSeenCueSequence=0;applyNetCues(receipt,true,player.id);applyNetCues(receipt,false,player.id)');assert.equal(notes(guest).length,0);
 });
 test('round/menu cleanup and 64-cue bounded buffer preserve authoritative state',()=>{
  peers();host.run('for(let i=0;i<100;i++)damageEntity(victim,.01,remote,{firearm:true})');assert.equal(host.run('netCues.length'),64);host.run('elapsed+=2');assert.equal(host.run('serializeNetCues().length'),0);host.run('backMenu()');assert.equal(host.run('netCues.length'),0);
 });
 console.log(`PASS: ${groups} actual saved-game combat confirmation groups; AudioContext never instantiated`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
