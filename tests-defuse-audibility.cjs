const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
async function main({mutateAudio=s=>s,only=()=>true,measure=false}={}){
 const source=fs.readFileSync(path.join(__dirname,'public/audio.js'),'utf8'),gameSource=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
 const base=fs.readFileSync(path.join(__dirname,'tests-audio.cjs'),'utf8'),cut=base.indexOf('async function main(){');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'defuse-audibility-audio.cjs'),module);mod.filename=path.join(__dirname,'defuse-audibility-audio.cjs');mod.paths=module.paths;mod._compile(base.slice(0,cut)+'\nmodule.exports={Context,decodedSample,settle};',mod.filename);
 const {Context,decodedSample,settle}=mod.exports,old=global.window;let groups=0;const check=(name,fn)=>{if(only(name)){fn();groups++;console.log('PASS: '+name)}},near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
 try{
  class Ready extends Context{decodeAudioData(bytes){return Promise.resolve(decodedSample(Buffer.from(bytes).toString()))}}
  global.window={AudioContext:Ready,fetch:async url=>({ok:true,arrayBuffer:async()=>Uint8Array.from(Buffer.from(path.basename(new URL(url).pathname))).buffer})};
  const url=pathToFileURL(path.join(__dirname,'public/audio.js')).href;
  const {createGameAudio,SAMPLE_CUES}=await import('data:text/javascript;base64,'+Buffer.from(mutateAudio(source).replaceAll('import.meta.url',JSON.stringify(url))).toString('base64'));
  const audio=createGameAudio();audio.init();await settle();const ctx=Context.current;
  function voice(type,options){const ns=ctx.nodes.length,ss=ctx.sources.length;audio.play(type,options);const nodes=ctx.nodes.slice(ns),sources=ctx.sources.slice(ss);assert.ok(sources.length);const result={gain:nodes[0].gain.value,pan:nodes.find(n=>n.kind==='panner').pan.value,frequency:sources[0].connections[0].frequency.value,starts:sources.map(s=>s.started),durations:sources.map(s=>s.duration),rates:sources.map(s=>s.playbackRate.value)};sources.forEach(s=>s.end());assert.ok(nodes.every(n=>n.disconnects===1));return result}
  if(measure){const rows=[];for(const distance of [0,10,20,30,40,50,65])for(const occluded of [false,true])rows.push({distance,occluded,...voice('defuse-start',{distance,occluded,volume:.45,pan:.6})});return {audioSHA:crypto.createHash('sha256').update(source).digest('hex'),rows}}
  check('defuse spatial: dedicated distance curve increases distant signal without raising self or nearby ceiling',()=>{
   let previous=Infinity;for(const distance of [0,1,10,20,30,40,50,65]){const v=voice('defuse-start',{distance,volume:.45});near(v.gain,.45/(1+distance*.025));assert.ok(v.gain<=previous&&v.gain<=.45);previous=v.gain;if(distance>=20)assert.ok(v.gain/(.45/(1+distance*.11))>=2)}
  });
  check('defuse wall: retain eighty percent and beep clarity, still quieter than open and panned at source',()=>{
   for(const distance of [3,10,30,50,65]){const open=voice('defuse-start',{distance,volume:.45,pan:-.6}),wall=voice('defuse-start',{distance,volume:.45,pan:.6,occluded:true});near(wall.gain/open.gain,.8);assert.equal(wall.frequency,3200);assert.equal(open.frequency,10000);assert.equal(open.pan,-.6);assert.equal(wall.pan,.6);assert.ok(wall.gain<open.gain)}
  });
  check('defuse recipe: original two beeps timing gain rate and asset bytes remain unmodified',()=>{
   assert.deepEqual(SAMPLE_CUES['defuse-start'].map(x=>[x.file,x.gain,x.length,x.delay,x.rate]),[['lab-beep1.ogg',.34,.09,0,1.35],['lab-beep1.ogg',.34,.09,.16,1.35]]);
   const v=voice('defuse-start',{distance:30,occluded:true});assert.deepEqual(v.starts,[4,4.16]);assert.deepEqual(v.durations,[.09*1.35,.09*1.35]);assert.deepEqual(v.rates,[1.35,1.35]);
   for(const type of ['step','land','defuse','plant','spike','reload'])for(const occluded of [false,true]){const x=voice(type,{distance:30,volume:.45,occluded});near(x.gain,.45/(1+30*.11)*(occluded?.4:1))}
   const gun=voice('enemy',{weapon:'vandal',distance:30,occluded:true,volume:.45});near(gun.gain,.45/(1+30*.035)*.7);assert.equal(gun.frequency,3200);
  });
  check('defuse silence: master zero suspended context and cold samples never queue delayed beeps',()=>{
   let count=ctx.sources.length;audio.play('defuse-start',{volume:0});ctx.state='suspended';audio.play('defuse-start');ctx.state='running';assert.equal(ctx.sources.length,count);
   const cold=createGameAudio();cold.init();const coldCtx=Context.current;cold.play('defuse-start');assert.equal(coldCtx.sources.length,0);
  });
  const vmBase=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),end=vmBase.indexOf('  const local = harness();');assert.ok(end>0);
  const prefix=vmBase.slice(0,end).replace('play() {}, unlock()',"play(type,options) {(document.audioLog??=[]).push({type,...options});}, unlock()");
  const vmMod=new Module(path.join(__dirname,'defuse-audibility-game.cjs'),module);vmMod.filename=path.join(__dirname,'defuse-audibility-game.cjs');vmMod.paths=module.paths;vmMod._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',vmMod.filename);
  const {harness}=await vmMod.exports(),host=harness(),guest=harness(),copy=x=>JSON.parse(JSON.stringify(x)),clear=h=>{h.sandbox.document.audioLog=[]},notes=h=>(h.sandbox.document.audioLog||[]).filter(n=>n.type==='defuse-start');
  function peer(h,isHost,side){h.sandbox.isHost=isHost;h.sandbox.side=side;h.run(`online={host:isHost,session:{memberId:isHost?'host':'friend',hostId:'host'},room:{code:'BEEP2345',hostId:'host',status:'playing',settings:{format:'standard'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send(packet){this.sent.push(packet)},close(){}};onlinePlaying=true;mode='menu';$('match-format').value='standard';$('starting-side').value=side;startGame();if(isHost){match.startLive();match.drainEvents()}netSequence=0;netLastSnapshot=0;netHasSnapshot=false;netRound=0;netClock=0;netInputs.clear();netApplied.clear();netActions=[];netActionSequence=0;netSeenCueSequence=0;netCues.length=0;elapsed=10;soundEnabled=true;volume=.45;for(const b of bots){b.rangeTarget=true;b.x=65;b.z=60;b.group.position.set(b.x,0,b.z)}`);h.clearWalls();clear(h)}
  function deliver(from,to,id){const packet=copy(from.run('online.sent.at(-1)'));assert.ok(packet);to.sandbox.incoming=packet;to.run(`receiveNetPacket('${id}',incoming)`);return packet}
  function peers(hostDefuses){const side=hostDefuses?'defend':'attack';peer(host,true,side);peer(guest,false,side);host.run(`var remote=bots.find(b=>b.remoteId==='friend');Object.assign(player,{x:${hostDefuses?0:30},y:0,z:1});Object.assign(remote,{x:${hostDefuses?30:0},y:0,z:1,vy:0,crouch:0});remote.group.position.set(remote.x,0,remote.z);Object.assign(match.spike,{status:'planted',carrier:null,site:'A',x:0,z:0,timer:45});tickOnline(.1)`);deliver(host,guest,'host');clear(host);clear(guest)}
  check('enemy host: real guest defuse is heard across wall from fixed bomber point exactly once',()=>{
   peers(false);host.wall({x:15,z:.5,width:.5,depth:5,height:3});guest.run('interactionHeld=true;updateInteraction(.1,true);tickOnline(.1)');assert.equal(notes(guest).length,0);deliver(guest,host,'friend');host.run('updateRemoteActor(remote,.1);handleMatchEvents();tickOnline(.1)');deliver(host,guest,'host');
   assert.equal(host.run('player.team===match.attackerTeam'),true);assert.equal(notes(host).length,1);const cue=notes(host)[0];near(cue.distance,Math.hypot(30,1));assert.equal(cue.occluded,true);assert.ok(Math.abs(cue.pan)>.9);const audible=voice(cue.type,cue);near(audible.gain,.45/(1+cue.distance*.025)*.8);assert.equal(audible.frequency,3200);
   host.run('for(let i=0;i<5;i++){updateRemoteActor(remote,.05);handleMatchEvents()}');assert.equal(notes(host).length,1);
  });
  check('enemy guest: real host defuse arrives through JSON with wall positioning and no replay',()=>{
   peers(true);guest.wall({x:15,z:.5,width:.5,depth:5,height:3});host.run('interactionHeld=true;updateInteraction(.1,true);handleMatchEvents();tickOnline(.1)');const packet=deliver(host,guest,'host');assert.equal(guest.run('player.team===match.attackerTeam'),true);assert.equal(notes(guest).length,1);const cue=notes(guest)[0];near(cue.distance,Math.hypot(30,1));assert.equal(cue.occluded,true);near(voice(cue.type,cue).gain,.45/(1+cue.distance*.025)*.8);
   guest.sandbox.receipt=packet;guest.run("receiveNetPacket('host',receipt);applyNetCues(receipt,false,player.id)");assert.equal(notes(guest).length,1);
  });
  check('enemy limits: retain65m cutoff mute and zero volume without revealing global defuse or delayed cue',()=>{
   peers(false);for(const [distance,count]of [[65,1],[65.01,0],[100,0]]){clear(host);host.sandbox.d=distance;host.run("player.x=d;player.z=0;soundDefuseStart({actorId:remote.id})");assert.equal(notes(host).length,count)}
   for(const gate of ['soundEnabled=false;volume=.45','soundEnabled=true;volume=0']){clear(host);host.run(`player.x=30;${gate};soundDefuseStart({actorId:remote.id});soundEnabled=true;volume=.45`);assert.equal(notes(host).length,0)}
   assert.equal(crypto.createHash('sha256').update(gameSource).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'public/game.js'))).digest('hex'));
  });
  console.log(`PASS: ${groups} defuse audibility graph/actual saved-game groups; no audio output`);
 }finally{if(old===undefined)delete global.window;else global.window=old}
}
module.exports=main;
if(require.main===module){if(process.argv.includes('--negative'))(async()=>{
 const cases=[['old distance curve','defuse spatial:',s=>s.replace('defuseStart?.025:.11','.11')],['old wall loss','defuse wall:',s=>s.replace('defuseStart?.80:.40','.40')],['old muffling','defuse wall:',s=>s.replace('(gunshot||defuseStart)?3200:1600','gunshot?3200:1600')]];
 for(const [name,label,mutate]of cases){let changed=false;await assert.rejects(main({mutateAudio:s=>{const m=mutate(s);assert.notEqual(m,s);changed=true;return m},only:n=>n.startsWith(label)}),e=>e.code==='ERR_ASSERTION',name);assert.ok(changed);console.log('PASS: detected '+name)}console.log('PASS: 3 memory-only defuse audibility faults');
})().catch(e=>{console.error(e);process.exitCode=1});else if(process.argv.includes('--measure'))main({measure:true}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1});else main().catch(e=>{console.error(e);process.exitCode=1})}
