const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
async function main(){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'kill-banner-harness.cjs'),module);mod.filename=path.join(__dirname,'kill-banner-harness.cjs');mod.paths=module.paths;
 mod._compile(base.slice(0,cut)+'\n return {harness};\n}\nmodule.exports=main;',mod.filename);
 const {harness}=await mod.exports(),local=harness(),host=harness(),guest=harness();let groups=0;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);},copy=v=>JSON.parse(JSON.stringify(v)),el=p=>p.sandbox.document.getElementById('kill-banner');
 const render=p=>p.run("killBanner.render(elapsed,{active:!document.hidden&&!netHostPaused&&mode==='play'&&['live','post'].includes(match?.phase),currentRound:match?.round,reducedMotion:reducedMotion.matches})");
 function setup(p){p.reset();p.run(`for(let i=0;i<5;i++)makeBot({x:i*3,z:-5},i,'red',{id:'red-'+i,team:'red',name:'TARGET',primary:'vandal',secondary:'classic'});var victim=bots[0];soundEnabled=false;volume=0;`);}
 test('actual local kills display while muted; nonlethal and duplicate deaths do not restart; next kill pulses again',()=>{
  setup(local);local.run('damageEntity(victim,1,player,{firearm:true})');render(local);assert.equal(el(local).hidden,true);
  local.run('damageEntity(victim,1000,player,{firearm:true});elapsed+=.13');render(local);assert.equal(el(local).hidden,false);assert.ok(el(local).style.transform.includes('scale(1.1800)'));
  local.run('elapsed+=.5;damageEntity(victim,1000,player,{firearm:true})');render(local);assert.ok(el(local).style.transform.includes('scale(1.0000)'));
  local.run("damageEntity(bots[1],1000,player,{skill:'nope'});elapsed+=.13");render(local);assert.ok(el(local).style.transform.includes('scale(1.1800)'));assert.equal(local.run('totalKills'),2);
 });
 test('teammate, nonlethal, driver and actual decoy paths cannot display a personal kill banner',()=>{
  setup(local);local.run("makeBot({x:4,z:-5},5,'blue',{id:'ally',team:'blue',primary:'vandal',secondary:'classic'});damageEntity(victim,1000,bots[5],{firearm:true});damageEntity(bots[1],0,player,{firearm:true});damageEntity(bots[5],200,player,{vehicle:true})");render(local);assert.equal(el(local).hidden,true);
  local.seed('red');local.run('player.pitch=-.1;shoot()');render(local);assert.equal(el(local).hidden,true);
  const s=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8'),a=s.indexOf('function shootBusDriver('),b=s.indexOf('\nfunction ',a+1);assert.doesNotMatch(s.slice(a,b),/killBanner|killFeedback|firearmFeedback|combatFeedback/);
 });
 function peer(p,isHost){p.sandbox.isHost=isHost;p.run(`online={host:isHost,session:{memberId:isHost?'host':'friend',hostId:'host'},room:{code:'KILL2345',hostId:'host',status:'playing',settings:{format:'standard'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send(packet,{team}={}){if(team===undefined||team==='red')this.sent.push(packet);},close(){}};onlinePlaying=true;mode='menu';$('match-format').value='standard';$('starting-side').value='attack';startGame();if(isHost){match.startLive();match.drainEvents();}netSequence=0;netLastSnapshot=0;netHasSnapshot=false;netRound=0;netClock=0;netInputs.clear();netApplied.clear();netActions=[];netActionSequence=0;netSeenCueSequence=0;netCues.length=0;elapsed=10;soundEnabled=false;volume=0;for(const b of bots){b.rangeTarget=true;b.x=65;b.z=60;b.group.position.set(b.x,0,b.z);}`);}
 function deliver(){const packet=copy(host.run('online.sent.at(-1)'));guest.sandbox.packet=packet;guest.run("receiveNetPacket('host',packet)");return packet;}
 function peers(){peer(host,true);peer(guest,false);host.run("var remote=bots.find(b=>b.remoteId==='friend'),victim=bots.find(b=>b.team==='blue');remote.netWeapon='classic';tickOnline(.1)");deliver();}
 test('independent guest prediction stays hidden; real host kill in final post displays once without new wire fields',()=>{
  peers();guest.run('damageEntity(bots[0],1000,player,{firearm:true})');render(guest);assert.equal(el(guest).hidden,true);
  host.run("victim.hp=1;damageEntity(victim,1000,remote,{firearm:true});match.phase='post';match.phaseTime=5;tickOnline(.1)");const packet=deliver();guest.run('elapsed+=.13');render(guest);assert.equal(el(guest).hidden,false);assert.ok(el(guest).style.transform.includes('scale(1.1800)'));render(host);assert.equal(el(host).hidden,true);
  const cue=packet.cues.find(c=>c.type==='kill-1');assert.deepEqual(Object.keys(cue).sort(),['seq','round','type','weapon','id','x','y','z','time'].sort());
  guest.run('elapsed+=.4;applyNetCues(packet,false,player.id)');render(guest);assert.ok(el(guest).style.transform.includes('scale(1.0000)'));
 });
 test('fresh, stale, future, malformed, wrong recipient and old round receipts cannot display later',()=>{
  peers();host.run('victim.hp=1;damageEntity(victim,1000,remote,{firearm:true});tickOnline(.1)');const good=copy(host.run('online.sent.at(-1)'));
  const cases=[p=>p.cues[0].type='kill-0',p=>p.cues[0].type='kill-6',p=>p.cues[0].weapon='__proto__',p=>p.cues[0].id='other',p=>p.cues[0].round++,p=>p.time+=2,p=>p.time-=1,p=>p.cues[0].y=null,p=>p.cues[0].time=null,p=>p.rules.phase='buy'];
  for(const change of cases){const bad=copy(good);change(bad);guest.sandbox.receipt=bad;guest.run('killBanner.reset();netSeenCueSequence=0;applyNetCues(receipt,false,player.id)');render(guest);assert.equal(el(guest).hidden,true);}
  guest.sandbox.receipt=good;guest.run('killBanner.reset();netSeenCueSequence=0;applyNetCues(receipt,true,player.id);applyNetCues(receipt,false,player.id)');render(guest);assert.equal(el(guest).hidden,true);
 });
 test('pause, document hidden, next round and menu clear the banner; actual frame renders it',()=>{
  setup(local);local.run('damageEntity(victim,1000,player,{firearm:true});frame(previous+130)');assert.equal(el(local).hidden,false);
  local.run('pauseGame()');assert.equal(el(local).hidden,true);local.run("mode='play'");render(local);assert.equal(el(local).hidden,true);
  for(const transition of ["match.round++","document.hidden=true","backMenu()"]){setup(local);local.run('damageEntity(victim,1000,player,{firearm:true});elapsed+=.13');render(local);assert.equal(el(local).hidden,false);local.run(transition);render(local);assert.equal(el(local).hidden,true);local.sandbox.document.hidden=false;}
 });
 test('20/60/144Hz expiration, consecutive pulse and reduced motion; original supplied transparent PNG byte exact',()=>{
  for(const hz of [20,60,144]){local.run('killBanner.reset();killBanner.note(10,1)');for(let n=0;n<Math.ceil(1.6*hz);n++){local.sandbox.at=10+n/hz;local.run('killBanner.render(at,{currentRound:1})');assert.equal(el(local).hidden,false);}local.run('killBanner.render(11.601,{currentRound:1})');assert.equal(el(local).hidden,true);}
  local.run('killBanner.note(20,1);killBanner.render(20.13,{currentRound:1,reducedMotion:true})');assert.equal(el(local).style.transform,'translate(-50%,0.00px) scale(1.0000)');local.run('killBanner.note(20.2,1);killBanner.render(20.33,{currentRound:1})');assert.equal(el(local).hidden,false);
  const png=fs.readFileSync(path.join(__dirname,'public/images/kill-banner.png'));assert.equal(crypto.createHash('sha256').update(png).digest('hex'),'116db44128965befbbe9c3254d6f3e8a2809f5715ebf3834e711dea590075f5e');assert.equal(png[25],6);
  const html=fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8');assert.match(html,/id="kill-banner"[^>]*hidden[^>]*aria-hidden="true"/);assert.match(html,/rel="preload" as="image" href="images\/kill-banner.png"/);
 });
 console.log(`PASS: ${groups} actual savedgame kill banner groups; audio inert`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
