const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main(){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace('play() {}, unlock()',"play(type,options) {(document.audioLog??=[]).push({type,...options});}, unlock()");assert.notEqual(prefix,base.slice(0,cut));
 const mod=new Module(path.join(__dirname,'enemy-shot-harness.cjs'),module);mod.filename=path.join(__dirname,'enemy-shot-harness.cjs');mod.paths=module.paths;mod._compile(prefix+'\n return {harness};\n}\nmodule.exports=main;',mod.filename);
 const {harness}=await mod.exports(),local=harness(),host=harness(),guest=harness();let groups=0;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name)},copy=v=>JSON.parse(JSON.stringify(v));
 const clear=p=>{p.sandbox.document.audioLog=[]},notes=p=>(p.sandbox.document.audioLog||[]).filter(n=>n.type==='shot'||n.type==='enemy');
 function setup(){local.reset();local.clearWalls();local.run('soundEnabled=true;volume=1');clear(local)}
 test('actual game forwards all10 distant firearms to100m, retains old knife and movement limit',()=>{
  setup();for(const gun of ['classic','ghost','spectre','phantom','vandal','pump','drum','scout','atlas','forge'])for(const distance of [30,66,80,99]){clear(local);Object.assign(local.sandbox,{gunId:gun,audioDistance:distance});local.run("sound('enemy',{weapon:gunId,entity:{id:'shooter',team:'red',alive:true,x:0,y:0,z:-audioDistance}})");assert.equal(notes(local).length,1,gun+' '+distance);assert.equal(notes(local)[0].distance,distance)}
  for(const type of ['shot','enemy','step']){setup();local.sandbox.kind=type;local.run("sound(kind,{weapon:kind==='step'?'vandal':'knife',entity:{id:'knife',team:'red',alive:true,x:0,y:0,z:-66}})");assert.equal(local.sandbox.document.audioLog.length,0)}
  setup();local.run("sound('enemy',{weapon:'vandal',entity:{id:'far',team:'red',alive:true,x:0,y:0,z:-100.01}})");assert.equal(notes(local).length,0);
 });
 test('actual collision ray preserves wall muffling and left/right direction',()=>{
  setup();local.run("sound('enemy',{weapon:'vandal',entity:{id:'right',team:'red',alive:true,x:30,y:0,z:-30}})");const right=notes(local)[0];assert.equal(right.occluded,false);assert.ok(right.pan>0);
  clear(local);local.wall({z:-10,width:100});local.run("sound('enemy',{weapon:'vandal',entity:{id:'left',team:'red',alive:true,x:-30,y:0,z:-30}})");const left=notes(local)[0];assert.equal(left.occluded,true);assert.ok(left.pan<0);assert.equal(left.distance,right.distance);
 });
 test('actual BOT cartridge creates one enemy gunshot; self level stays at weapon volume',()=>{
  setup();local.run(`difficulty='hard';match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='other';Object.assign(player,{team:'red',x:0,y:0,z:30,hp:10000,armor:50,alive:true});makeBot({x:0,z:0},0,'blue',{id:'shooter',team:'blue',primary:'vandal',secondary:'classic',armor:50});var worker=bots[0];worker.kit=null;Object.assign(worker,{aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:0,think:0,target:null,reactionUntil:0,nextSkillAt:999});worker.group.rotation.y=0;updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal:{x:0,z:0},watch:null,role:'guard',siteId:'A',urgent:false}]])}}};Math.random=()=>.5;for(let i=0;i<60;i++)updatePlay(1/60);`);
  assert.ok(notes(local).length>0);assert.equal(notes(local).length,local.run('25-worker.aiAmmo'));assert.ok(notes(local).every(n=>n.type==='enemy'&&n.weapon==='vandal'));
  setup();local.run("equip('vandal',true);shoot()");assert.equal(notes(local)[0].distance,0);assert.equal(notes(local)[0].volume,1);
 });
 function peer(p,isHost){p.sandbox.isHost=isHost;p.run(`online={host:isHost,session:{memberId:isHost?'host':'friend',hostId:'host'},room:{code:'SHOTS234',hostId:'host',status:'playing',settings:{format:'standard'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send(packet,{team}={}){if(team===undefined||team==='red')this.sent.push(packet)},close(){}};onlinePlaying=true;mode='menu';$('match-format').value='standard';$('starting-side').value='attack';startGame();if(isHost){match.startLive();match.drainEvents()}netSequence=0;netLastSnapshot=0;netHasSnapshot=false;netRound=0;netClock=0;netInputs.clear();netApplied.clear();netActions=[];netActionSequence=0;netSeenCueSequence=0;netCues.length=0;elapsed=10;soundEnabled=true;volume=1;for(const b of bots){b.rangeTarget=true;b.x=65;b.z=60;b.group.position.set(b.x,0,b.z)}`);clear(p)}
 function deliver(from,to,id){const packet=copy(from.run('online.sent.at(-1)'));assert.ok(packet);to.sandbox.packet=packet;to.run(`receiveNetPacket('${id}',packet)`);return packet}
 function peers(){peer(host,true);peer(guest,false);host.run(`player.x=0;player.z=0;var remote=bots.find(b=>b.remoteId==='friend');Object.assign(remote,{x:0,y:0,z:-80,hp:1000,netYaw:0,netWeapon:'vandal',netAmmo:25,lastNetShot:-10});remote.group.position.set(0,0,-80);tickOnline(.1)`);deliver(host,guest,'host');clear(host);clear(guest)}
 test('independent host shot reaches guest80m away exactly once through real JSON snapshots',()=>{
  peers();host.run("equip('vandal',true);player.pitch=0;shoot();tickOnline(.1)");const packet=deliver(host,guest,'host');assert.equal(notes(guest).length,1);assert.equal(notes(guest)[0].distance,80);guest.sandbox.again=packet;guest.run("receiveNetPacket('host',again);applyNetCues(again,false,player.id)");assert.equal(notes(guest).length,1);assert.equal(notes(host)[0].distance,0);
 });
 test('mute, zero volume, fresh baseline and stale snapshots consume cues without later playback',()=>{
  peers();host.run("equip('vandal',true);shoot();tickOnline(.1)");const good=copy(host.run('online.sent.at(-1)'));assert.ok(good.cues.some(c=>c.type==='shot'));
  for(const gate of ['soundEnabled=false;volume=1','soundEnabled=true;volume=0']){clear(guest);guest.sandbox.receipt=good;guest.run(`netSeenCueSequence=0;${gate};applyNetCues(receipt,false,player.id);soundEnabled=true;volume=1;applyNetCues(receipt,false,player.id)`);assert.equal(notes(guest).length,0)}
  clear(guest);guest.sandbox.receipt=good;guest.run('netSeenCueSequence=0;applyNetCues(receipt,true,player.id);applyNetCues(receipt,false,player.id)');assert.equal(notes(guest).length,0);
  clear(guest);const stale=copy(good);stale.time+=2;guest.sandbox.receipt=stale;guest.run('netSeenCueSequence=0;applyNetCues(receipt,false,player.id)');assert.equal(notes(guest).length,0);
 });
 console.log(`PASS: ${groups} actual saved-game enemy gunshot groups; no audio output`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
