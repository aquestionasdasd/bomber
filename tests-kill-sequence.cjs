const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 let prefix=base.slice(0,cut).replace('play() {}, unlock()',"play(type,options) {(document.audioLog??=[]).push({type,...options});}, unlock()");
 prefix=prefix.replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const mod=new Module(path.join(__dirname,'kill-sequence-harness.cjs'),module);mod.filename=path.join(__dirname,'kill-sequence-harness.cjs');mod.paths=module.paths;mod.mutateGameSource=mutate;
 mod._compile(prefix+'\n return {harness};\n}\nmodule.exports=main;',mod.filename);
 const {harness}=await mod.exports(),local=harness(),host=harness(),guest=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name);},copy=v=>JSON.parse(JSON.stringify(v));
 const notes=p=>(p.sandbox.document.audioLog||[]).filter(n=>/^kill-[1-5]$/.test(n.type));
 const clear=p=>{p.sandbox.document.audioLog=[];};
 function setup(p){p.reset();clear(p);p.run(`soundEnabled=true;volume=1;for(let i=0;i<5;i++){makeBot({x:i*3,z:-5},i,'red',{id:'red-'+i,team:'red',name:'TARGET',primary:'vandal',secondary:'classic'});bots[i].kit=new DuelistKit({character:'frost'});}var victim=bots[0];`);}
 test('five distinct actual enemy deaths advance firearm, knife and skill confirmations exactly once, centered',()=>{
  setup(local);local.run(`damageEntity(victim,1,player,{firearm:true});for(let i=0;i<5;i++)damageEntity(bots[i],1000,player,i%2?{skill:'nope'}:{firearm:true});damageEntity(victim,1000,player,{firearm:true})`);
  assert.deepEqual(notes(local).map(n=>n.type),['kill-1','kill-2','kill-3','kill-4','kill-5']);
  assert.ok(notes(local).every(n=>n.distance===0&&n.pan===0&&!n.occluded));
  assert.equal(local.run('totalKills'),5);assert.equal(local.run('killSoundCounts.get(player.id)'),5);
  assert.equal(local.sandbox.document.audioLog.filter(n=>['kill','gun-kill'].includes(n.type)).length,0);
 });
 test('zero, nonlethal, friendly vehicle, decoy and driver deaths cannot advance personal kill order',()=>{
  setup(local);local.run(`damageEntity(victim,0,player,{firearm:true});damageEntity(victim,1,player,{skill:'nope'});makeBot({x:4,z:-5},5,'blue',{id:'ally',team:'blue',primary:'vandal',secondary:'classic'});damageEntity(bots[5],200,player,{vehicle:true});`);
  assert.equal(notes(local).length,0);assert.equal(local.run('killSoundCounts.size'),0);
  local.seed('red');local.run(`player.pitch=-.1;shoot()`);assert.equal(notes(local).length,0);
  // Actual bus driver shot path is separate from damageEntity and must stay so.
  const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
  const start=source.indexOf('function shootBusDriver('),end=source.indexOf('\nfunction ',start+1);assert.ok(start>=0);
  assert.doesNotMatch(source.slice(start,end),/killFeedback|firearmFeedback|combatFeedback/);
  local.run('damageEntity(victim,1000,player,{firearm:true})');assert.deepEqual(notes(local).map(n=>n.type),['kill-1']);
 });
 test('per actor and round reset, new match/menu, mute consumed, revived kills clamp at fifth',()=>{
  setup(local);local.run(`soundEnabled=false;damageEntity(bots[0],1000,player,{firearm:true});soundEnabled=true;damageEntity(bots[1],1000,player,{skill:'nope'})`);
  assert.deepEqual(notes(local).map(n=>n.type),['kill-2']);
  clear(local);local.run(`match.round++;for(let i=2;i<5;i++)damageEntity(bots[i],1000,player,{firearm:true});for(let i=0;i<3;i++){victim.alive=true;victim.hp=1;damageEntity(victim,10,player,{firearm:true});}`);
  assert.deepEqual(notes(local).map(n=>n.type),['kill-1','kill-2','kill-3','kill-4','kill-5','kill-5']);
  local.run('backMenu()');assert.equal(local.run('killSoundCounts.size'),0);
  setup(local);local.run('damageEntity(victim,1000,player,{firearm:true})');assert.deepEqual(notes(local).map(n=>n.type),['kill-1']);
 });
 test('teammate kills have an independent ordinal and never advance or play the local sequence',()=>{
  setup(local);local.run(`makeBot({x:4,z:0},5,'blue',{id:'ally',team:'blue',primary:'vandal',secondary:'classic'});damageEntity(bots[0],1000,player,{firearm:true});damageEntity(bots[1],1000,bots[5],{firearm:true});damageEntity(bots[2],1000,player,{firearm:true})`);
  assert.deepEqual(notes(local).map(n=>n.type),['kill-1','kill-2']);assert.equal(local.run("killSoundCounts.get('ally')"),1);
 });
 function peer(p,isHost){p.sandbox.isHost=isHost;p.run(`online={host:isHost,session:{memberId:isHost?'host':'friend',hostId:'host'},room:{code:'KILL2345',hostId:'host',status:'playing',settings:{format:'standard'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send(packet,{team}={}){if(team===undefined||team==='red')this.sent.push(packet);},close(){}};onlinePlaying=true;mode='menu';$('match-format').value='standard';$('starting-side').value='attack';startGame();if(isHost){match.startLive();match.drainEvents();}netSequence=0;netLastSnapshot=0;netHasSnapshot=false;netRound=0;netClock=0;netInputs.clear();netApplied.clear();netActions=[];netActionSequence=0;netSeenCueSequence=0;netCues.length=0;elapsed=10;soundEnabled=true;volume=1;for(const b of bots){b.rangeTarget=true;b.x=65;b.z=60;b.group.position.set(b.x,0,b.z);}`);clear(p);}
 function deliver(){const packet=copy(host.run('online.sent.at(-1)'));assert.ok(packet);guest.sandbox.packet=packet;guest.run(`receiveNetPacket('host',packet)`);return packet;}
 function peers(){peer(host,true);peer(guest,false);host.run(`var remote=bots.find(b=>b.remoteId==='friend'),victim=bots.find(b=>b.team==='blue');remote.netWeapon='classic';tickOnline(.1)`);deliver();clear(host);clear(guest);}
 test('independent host to guest JSON carries ranked kills without a new field, final post and duplicate safe',()=>{
  peers();guest.run('damageEntity(bots[0],1000,player,{firearm:true})');assert.equal(notes(guest).length,0);
  for(let i=1;i<=5;i++){
   host.sandbox.index=i;host.run(`victim.alive=true;victim.hp=1;damageEntity(victim,1000,remote,index%2?{firearm:true}:{skill:'nope'});if(index===5){match.phase='post';match.phaseTime=5;}tickOnline(.1)`);
   const packet=deliver();assert.equal(notes(guest).at(-1).type,'kill-'+i);const cue=packet.cues.find(c=>c.type==='kill-'+i);assert.ok(cue);
   assert.deepEqual(Object.keys(cue).sort(),['seq','round','type','weapon','id','x','y','z','time'].sort());
   guest.run(`applyNetCues(packet,false,player.id)`);assert.equal(notes(guest).length,i);
  }
  assert.equal(notes(host).length,0);assert.equal(host.run('killSoundCounts.get(remote.id)'),5);
 });
 test('rank validation, stale/future/fresh/wrong recipient/old round/mute consume silently',()=>{
  peers();host.run(`victim.hp=1;damageEntity(victim,1000,remote,{firearm:true});tickOnline(.1)`);const good=copy(host.run('online.sent.at(-1)'));
  const cases=[p=>p.cues[0].type='kill-0',p=>p.cues[0].type='kill-6',p=>p.cues[0].type='kill-01',p=>p.cues[0].type='gun-kill',p=>p.cues[0].weapon='__proto__',p=>p.cues[0].id='other',p=>p.cues[0].round++,p=>p.time+=2,p=>p.time-=1,p=>p.cues[0].y=null,p=>p.cues[0].time=null,p=>p.rules.phase='buy'];
  for(const change of cases){clear(guest);const bad=copy(good);change(bad);guest.sandbox.receipt=bad;guest.run('netSeenCueSequence=0;applyNetCues(receipt,false,player.id)');assert.equal(guest.sandbox.document.audioLog.length,0);}
  guest.sandbox.receipt=good;
  for(const gate of ['soundEnabled=false;volume=1','soundEnabled=true;volume=0']){clear(guest);guest.run(`netSeenCueSequence=0;${gate};applyNetCues(receipt,false,player.id);soundEnabled=true;volume=1;applyNetCues(receipt,false,player.id)`);assert.equal(notes(guest).length,0);}
  clear(guest);guest.run('netSeenCueSequence=0;applyNetCues(receipt,true,player.id);applyNetCues(receipt,false,player.id)');assert.equal(notes(guest).length,0);
 });
 test('training starts at first sound and sixth plus reuse fifth; range results retain separate legacy cue',()=>{
  setup(local);local.run(`rangeSession=new RangeSession({waiting:true});exploring=true;clearBots();startRangeDrill();for(let i=0;i<6;i++){var target=bots[0];target.alive=true;target.hp=1;damageEntity(target,1000,player,{firearm:true});}`);
  assert.deepEqual(notes(local).map(n=>n.type),['kill-1','kill-2','kill-3','kill-4','kill-5','kill-5']);
 });
 console.log(`PASS: ${groups} saved-game kill sequence groups; no AudioContext/playback`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
