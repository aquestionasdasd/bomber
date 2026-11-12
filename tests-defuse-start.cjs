const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 let prefix=base.slice(0,cut).replace('play() {}, unlock()',"play(type,options) {(document.audioLog??=[]).push({type,...options});}, unlock()");
 prefix=prefix.replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const mod=new Module(path.join(__dirname,'defuse-start-harness.cjs'),module);mod.filename=path.join(__dirname,'defuse-start-harness.cjs');mod.paths=module.paths;mod.mutateGameSource=mutate;mod._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',mod.filename);
 const{harness}=await mod.exports(),local=harness(),host=harness(),guest=harness(),{SAMPLE_CUES}=await import('./public/audio.js');let groups=0;
 const test=(name,fn)=>{if(only(name)){fn();groups++;console.log('PASS: '+name)}},copy=x=>JSON.parse(JSON.stringify(x));
 const clear=h=>{h.sandbox.document.audioLog=[]},notes=h=>(h.sandbox.document.audioLog||[]).filter(n=>n.type==='defuse-start'),completed=h=>(h.sandbox.document.audioLog||[]).filter(n=>n.type==='defuse');
 function setup(h=local){h.reset();h.clearWalls();h.run(`match=new MatchRules({startingSide:'defend'});match.startLive();match.drainEvents();Object.assign(match.spike,{status:'planted',carrier:null,site:'A',x:0,z:0,timer:45});Object.assign(player,{team:match.defenderTeam,x:0,y:0,z:1,vy:0,vx:0,vz:0});mode='play';exploring=false;objectivePractice=null;soundEnabled=true;volume=1;interactionHeld=false;`);clear(h)}
 const work=(h=local,dt=.1)=>{h.sandbox.workDT=dt;h.run('interactionHeld=true;updateInteraction(workDT,true);handleMatchEvents()')};
 test('two short recorded beeps have a clear gap, quarter-second duration and headroom',()=>{
  const recipe=SAMPLE_CUES['defuse-start'];assert.equal(recipe.length,2);assert.ok(recipe.every(r=>r.file==='lab-beep1.ogg'&&r.length===.09&&r.rate===1.35));assert.deepEqual(recipe.map(r=>r.delay),[0,.16]);assert.ok(recipe[0].length<recipe[1].delay);assert.equal(recipe[1].delay+recipe[1].length,.25);assert.ok(recipe.reduce((n,r)=>n+r.gain*.85,0)<.65);
 });
 test('accepted local start is one positioned double-beep cue, held frames stay silent, restart and completion remain separate',()=>{
  setup();for(let i=0;i<10;i++)work();assert.equal(notes(local).length,1);assert.ok(Math.abs(local.run('match.spike.defuseProgress')-1)<1e-9);assert.equal(notes(local)[0].distance,1);assert.equal(completed(local).length,0);
  local.run('interactionHeld=false;updateInteraction(.1,true);handleMatchEvents()');work(local,3.5);assert.equal(notes(local).length,2);assert.equal(local.run('match.spike.checkpoint'),3.5);
  local.run('interactionHeld=false;updateInteraction(.1,true)');work(local,.1);assert.equal(notes(local).length,3);work(local,3.4);assert.equal(completed(local).length,1);assert.equal(notes(local).length,3);assert.equal(local.run('match.spike.status'),'defused');local.run('handleMatchEvents()');assert.equal(completed(local).length,1);
 });
 test('ineligible, distant, airborne, moving and waiting second actor cannot create a start',()=>{
  for(const code of ["player.team=match.attackerTeam","player.z=5","player.y=1","match.phase='buy'","match.spike.status='dropped'","match.spike.defuseActor='other'","player.alive=false"]){setup();local.run(code);work();assert.equal(notes(local).length,0,code)}
  setup();local.run('interactionHeld=true;updateInteraction(.1,false);handleMatchEvents()');assert.equal(notes(local).length,0);
  setup();local.run(`match.interactDefuse(.1,{actorId:'other',team:match.defenderTeam});handleMatchEvents()`);assert.equal(notes(local).length,1);work();assert.equal(notes(local).length,1);assert.equal(local.run('match.spike.defuseActor'),'other');
 });
 test('objective practice consumes the same accepted transition without round completion or repeated start audio',()=>{
  setup();local.run("exploring=true;objectivePractice={kind:'defuse',site:'A',completed:false,elapsed:0,duration:0};interactionHeld=true;updateInteraction(.1,true);updateObjectivePractice(.1)");assert.equal(notes(local).length,1);
  local.run('for(let i=0;i<10;i++){updateInteraction(.1,true);updateObjectivePractice(.1)}');assert.equal(notes(local).length,1);assert.equal(completed(local).length,0);
  local.run('updateInteraction(5.9,true);updateObjectivePractice(5.9)');assert.equal(completed(local).length,1);assert.equal(local.run('objectivePractice.completed'),true);
 });
 test('actual BOT role and full updatePlay emit one start at20/60/144Hz and retain seven-second defuse',()=>{
  for(const hz of [20,60,144]){setup();local.run(`player.team=match.attackerTeam;player.x=65;player.z=65;roster=[];var site=map.sites[0],point=getSitePlantPosition(site,site.x,site.z,{collision:map.collision});Object.assign(match.spike,{x:point.x,z:point.z,site:site.id});player.x=point.x+20;player.z=point.z+20;var record={id:'beep-worker',name:'mend',team:match.defenderTeam,k:0,d:0,a:0,primary:'vandal',secondary:'classic',armor:0,kit:new DuelistKit({character:'mend'})};record.kit.smoke=0;record.kit.updraft=0;record.kit.dash=0;record.kit.ultPoints=0;roster=[record];makeBot(point,0,record.team,record);var worker=bots[0];worker.fire=999;worker.think=999;worker.target=null;worker.nextSkillAt=999;Math.random=()=>.2;`);local.sandbox.stepDT=1/hz;
   for(let i=0;i<Math.ceil(7.1*hz)&&local.run("match.phase==='live'");i++)local.run('updatePlay(stepDT)');assert.equal(notes(local).length,1,String(hz));assert.equal(completed(local).length,1);assert.equal(local.run('match.lastRound.reason'),'defuse');assert.equal(local.run('match.spike.defuseActor'),'beep-worker');
  }
 });
 function peer(h,isHost){h.sandbox.isHost=isHost;h.run(`online={host:isHost,session:{memberId:isHost?'host':'friend',hostId:'host'},room:{code:'BEEP2345',hostId:'host',status:'playing',settings:{format:'standard'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send(packet,{team}={}){if(team===undefined||team==='red')this.sent.push(packet)},close(){}};onlinePlaying=true;mode='menu';$('match-format').value='standard';$('starting-side').value='attack';startGame();if(isHost){match.startLive();match.drainEvents()}netSequence=0;netLastSnapshot=0;netHasSnapshot=false;netRound=0;netClock=0;netInputs.clear();netApplied.clear();netActions=[];netActionSequence=0;netSeenCueSequence=0;netCues.length=0;elapsed=10;soundEnabled=true;volume=1;for(const b of bots){b.rangeTarget=true;b.x=65;b.z=60;b.group.position.set(b.x,0,b.z)}`);clear(h)}
 function deliver(from,to,id){const packet=copy(from.run('online.sent.at(-1)'));assert.ok(packet);to.sandbox.incoming=packet;to.run(`receiveNetPacket('${id}',incoming)`);return packet}
 function peers(){peer(host,true);peer(guest,false);host.run(`player.x=20;player.z=25;var remote=bots.find(b=>b.remoteId==='friend');Object.assign(remote,{x:0,y:0,z:1,vy:0,crouch:0});remote.group.position.set(0,0,1);Object.assign(match.spike,{status:'planted',carrier:null,site:'A',x:0,z:0,timer:45});tickOnline(.1)`);deliver(host,guest,'host');clear(host);clear(guest)}
 function accept(){guest.run('interactionHeld=true;updateInteraction(.1,true);tickOnline(.1)');assert.equal(notes(guest).length,0,'no predicted beep');deliver(guest,host,'friend');host.run('updateRemoteActor(remote,.1);handleMatchEvents();tickOnline(.1)');return deliver(host,guest,'host')}
 test('independent JSON host acceptance reaches the initiating guest and other listeners exactly once',()=>{
  peers();const packet=accept();assert.equal(notes(host).length,1);assert.equal(notes(guest).length,1);assert.equal(packet.cues.filter(c=>c.type==='defuse-start').length,1);assert.equal(packet.cues.find(c=>c.type==='defuse-start').id,host.run('remote.id'));
  guest.sandbox.receipt=copy(packet);guest.run("receiveNetPacket('host',receipt);applyNetCues(receipt,false,player.id)");assert.equal(notes(guest).length,1);
  for(let i=0;i<5;i++)host.run('updateRemoteActor(remote,.05);handleMatchEvents()');assert.equal(notes(host).length,1);clear(guest);guest.run("netSeenCueSequence=0;applyNetCues(receipt,false,'other-listener')");assert.equal(notes(guest).length,1);
 });
 test('fresh, stale, future, wrong-round and malformed cues are consumed silently; post accepts a final recent start',()=>{
  peers();const packet=accept();for(const mutate of [p=>p.time+=2,p=>p.time-=1,p=>p.rules.round++,p=>p.rules.phase='buy',p=>p.cues[0].time=NaN,p=>p.cues[0].y=Infinity,p=>p.cues[0].x=NaN,p=>p.cues[0].z=1001]){const bad=copy(packet);mutate(bad);guest.sandbox.receipt=bad;clear(guest);guest.run('netSeenCueSequence=0;applyNetCues(receipt,false,player.id)');assert.equal(notes(guest).length,0)}
  clear(guest);guest.sandbox.receipt=packet;guest.run('netSeenCueSequence=0;applyNetCues(receipt,true,player.id);applyNetCues(receipt,false,player.id)');assert.equal(notes(guest).length,0);
  clear(guest);guest.sandbox.receipt=copy(packet);guest.run("netSeenCueSequence=0;receipt.rules.phase='post';applyNetCues(receipt,false,player.id)");assert.equal(notes(guest).length,1);
 });
 test('mute and zero-volume do not replay after enabling; host still shares confirmed cues while muted',()=>{
  for(const gate of ['soundEnabled=false;volume=1','soundEnabled=true;volume=0']){peers();host.run(gate);const packet=accept();assert.equal(notes(host).length,0);assert.equal(notes(guest).length,1);clear(guest);guest.sandbox.receipt=packet;guest.run(`netSeenCueSequence=0;${gate};applyNetCues(receipt,false,player.id);soundEnabled=true;volume=1;applyNetCues(receipt,false,player.id)`);assert.equal(notes(guest).length,0)}
 });
 test('existing64cue bound, expiry and menu cleanup apply without snapshot fields',()=>{
  peers();host.run(`for(let i=0;i<80;i++){match.cancelDefuse(remote.id);match.interactDefuse(.001,{actorId:remote.id,team:remote.team});handleMatchEvents()}`);assert.equal(host.run('netCues.length'),64);const cue=copy(host.run('netCues.at(-1)'));assert.deepEqual(Object.keys(cue).sort(),['id','round','seq','time','type','weapon','x','y','z']);host.run('elapsed+=2');assert.equal(host.run('serializeNetCues().length'),0);host.run('backMenu()');assert.equal(host.run('netCues.length'),0);
 });
 console.log(`PASS: ${groups} actual saved-game defuse-start groups; AudioContext inert`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
