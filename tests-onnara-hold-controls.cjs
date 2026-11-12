const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-car-game.cjs'),'utf8'),cut=fixture.indexOf('  const local=harness();');
if(cut<0)throw Error('Saved-game fixture missing');
const fault=process.argv.find(s=>s.startsWith('--fault='))?.split('=')[1];
if(fault){const read=fs.readFileSync;fs.readFileSync=function(p,...args){let s=read.call(this,p,...args);if(String(p).replaceAll('\\','/').endsWith('/public/game.js')&&typeof s==='string'){
 const changes={jump:["if(jumpOnnaraHold(player,event.id,sequence,{predict:isGuest()}))","if(false)"],stop:["if(typeof action.onnaraStop==='string')stopOnnaraHold(actor,action.onnaraStop)","if(false)stopOnnaraHold(actor,action.onnaraStop)"],authority:["(map.traversal||starJump||grassAuthority||['renko','onnara'].includes(actor.kit?.character))&&!flight","(map.traversal||starJump||grassAuthority||actor.kit?.character==='renko')&&!flight"]};
 const [a,b]=changes[fault]||[];if(!a||!s.includes(a))throw Error('Fault anchor missing');s=s.replace(a,b);}return s;};}
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("elapsed=1;player.kit=new DuelistKit({character:'onnara'});player.y=2;player.vy=0;match.phase='live';match.timer=200;makeBot({x:0,z:-30},0,'red',{id:'enemy',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.remoteId='passive';enemy.fire=999;enemy.reactionUntil=999;useAbility('e');var originalHold=ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed);var peak=player.y");}
 function step(seconds,hz=60,g=h){g.sandbox.seconds=seconds;g.sandbox.hz=hz;g.run('for(let t=0;t<seconds-1e-8;t+=1/hz){updatePlay(Math.min(1/hz,seconds-t));peak=Math.max(peak,player.y)}');}
 check('Space hops from star hold at normal impulse and reholds apex at20/60/144Hz; stock/CD/deadline fixed',()=>{
  for(const hz of[20,60,144]){setup();const kit=copy(h.run('player.kit.snapshot()')),end=h.run('originalHold.endsAt');h.run('jump()');near(h.run('player.vy'),6.552,'normal impulse');h.run('jump()');near(h.run('player.vy'),6.552,'no midair boost');assert.equal(h.run('onnaraAirAim(player)'),false);step(.6,hz);near(h.run('player.y'),2+6.552**2/30,'apex',.00001);assert.equal(h.run('player.vy'),0);assert.equal(h.run('onnaraAirAim(player)'),true);assert.deepEqual(copy(h.run('player.kit.snapshot()')),kit);assert.equal(h.run("ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed).endsAt"),end);h.run('jump()');step(.6,hz);near(h.run('player.y'),2+2*6.552**2/30,'second apex',.00001);h.run('elapsed=originalHold.endsAt-.01');step(.1,hz);assert.ok(h.run('player.y')<2+2*6.552**2/30);}
 });
 check('E toggles off while still or hopping; no inventory refund and late explicit stop never casts again',()=>{
  for(const moving of[false,true]){setup();if(moving){h.run('jump()');step(.15);}const kit=copy(h.run('player.kit.snapshot()'));h.run("useAbility('e')");assert.equal(h.run("ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed)"),null);assert.deepEqual(copy(h.run('player.kit.snapshot()')),kit);const y=h.run('player.y');step(1);assert.ok(h.run('player.y')<y);h.run("player.kit.dash=1;applyRemoteAction(player,{type:'ability',key:'e',onnaraStop:originalHold.id,seq:99})");assert.equal(h.run('player.kit.dash'),1);assert.equal(h.run("ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed)"),null);}
 });
 check('actual ceiling clips hop then holds below ceiling; expiry during ascent does not rehold',()=>{
  setup();h.run("map.colliders.push({minX:-2,maxX:2,minZ:-2,maxZ:2,base:4.3,height:4.6});map.collision=createCollisionIndex(map.colliders);jump()");step(.6);near(h.run('player.y'),2.6,'ceiling clips',.00001);assert.equal(h.run('player.vy'),0);assert.equal(h.run('onnaraAirAim(player)'),true);
  setup();h.run('elapsed=originalHold.endsAt-.05;jump()');step(1);assert.equal(h.run("ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed)"),null);assert.ok(h.run('player.y')<2);assert.ok(h.run('player.vy')<0);
 });
 check('dead, work, pause, foreign event and full outgoing queue cannot hop or consume E',()=>{
  for(const block of["player.alive=false","player.planting=true","player.defusing=true","player.serviceReload={}","netHostPaused=true","mode='pause'"]){setup();h.run(block);h.run('jump()');assert.equal(h.run('player.vy'),0,block);}
  setup();assert.equal(h.run("jumpOnnaraHold(player,'wrong',1)"),false);h.run("onlinePlaying=true;online={host:false,session:{memberId:'guest'}};netActions=Array.from({length:64},(_,i)=>({seq:i+1,type:'reload',round:match.round}));jump();useAbility('e')");assert.equal(h.run('player.vy'),0);assert.ok(h.run("ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed)"));
 });
 check('strict hover hop marker is bounded and host owned; restoral cannot mutate anchor or extend deadline',()=>{
  setup();h.run('jump()');step(.6);const e=copy(h.run("ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed)")),skills=h.sandbox.createCharacterSkills();assert.equal(Object.keys(e).length,17);assert.equal(e.endsAt,h.run('originalHold.endsAt'));assert.ok(skills.restore({events:[e],blinds:[],markers:[]},h.run('elapsed'),e.round));
  assert.equal(skills.moveOnnaraHold(e.id,{id:e.sourceId,alive:true,team:e.team,y:99},h.run('elapsed')),false);
  for(const mutate of[x=>x.hop=[1,NaN,2],x=>x.hop=[0,1,2],x=>x.hop=[1,99,2],x=>x.hop=[1,1,2000],x=>x.endsAt+=1,x=>x.fromY+=1]){const bad=copy(e);mutate(bad);assert.equal(skills.restore({events:[bad],blinds:[],markers:[]},h.run('elapsed'),e.round),false);}
 });
 function peers(){const host=harness(),guest=harness();setup(host);guest.reset();host.run("ordinarySkills.reset();starHold.reset();player.y=0;enemy.kit=new DuelistKit({character:'onnara'});enemy.y=2;enemy.vy=0;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;activateAbility(enemy,'e');onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest',enemy.id);var captured;netClock=0;tickOnline(.1)");guest.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send(){}};netParticipants.set('guest','enemy');var peak=0");guest.sandbox.packet=copy(host.run('captured'));guest.run("receiveNetPacket('host',packet);applyStarHold(player)");return{host,guest};}
 function send(p,seq=1,extra={}){p.host.sandbox.request={type:'input',seq,connection:'hold',round:p.host.run('match.round'),input:{x:0,y:999,z:-30,yaw:0,pitch:0,...extra},actions:copy(p.guest.run('netActions'))};p.host.run("receiveNetPacket('guest',request);updateRemoteActor(enemy,.05);elapsed+=.05;updateRemoteActor(enemy,.05);netClock=0;tickOnline(.1)");}
 function ack(p){p.guest.sandbox.packet=copy(p.host.run('captured'));p.guest.run("receiveNetPacket('host',packet)");}
 check('independent JSON host/guest hop approval and duplicate ACK preserve one impulse and fixed resources',()=>{
  const p=peers();p.guest.run('jump()');near(p.guest.run('player.vy'),6.552,'predicted');send(p);assert.ok(p.host.run('enemy.y')<2.4);assert.ok(p.host.run('enemy.y')>2);assert.ok(p.host.run('enemy.vy')>5);step(.2,60,p.guest);const vy=p.guest.run('player.vy');ack(p);near(p.guest.run('player.vy'),vy,'ACK retains newer motion');ack(p);near(p.guest.run('player.vy'),vy,'duplicate no boost');assert.equal(p.guest.run('player.onnaraHopPending'),null);assert.equal(p.host.run('enemy.kit.dash'),0);assert.equal(p.guest.run('player.kit.dash'),0);
  p.host.run("for(let i=0;i<40;i++){elapsed+=1/60;netInputs.get('guest').received=elapsed;updateRemoteActor(enemy,1/60)};netClock=0;tickOnline(.1)");step(.6,60,p.guest);ack(p);p.guest.run('applyStarHold(player)');near(p.guest.run('player.y'),p.host.run('enemy.y'),'host apex');near(p.host.run('enemy.y'),2+6.552**2/30,'bounded forged999 height',.00001);
 });
 check('explicit remote E stop, delayed snapshots and duplicate actions cannot resurrect the same hold',()=>{
  const p=peers();p.guest.run("useAbility('e')");assert.equal(p.guest.run('onnaraAirAim(player)'),false);const saved=copy(p.host.run('captured'));send(p);assert.equal(p.host.run("ordinarySkills.onnaraEvent('onnara-hover',enemy.id,elapsed)"),null);ack(p);assert.equal(p.guest.run("ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed)"),null);p.guest.sandbox.packet=saved;p.guest.run("receiveNetPacket('host',packet);applyStarHold(player)");assert.equal(p.guest.run('onnaraAirAim(player)'),false);send(p,2);assert.equal(p.host.run('enemy.kit.dash'),0);
 });
 check('host refusal rolls back a predicted hop and expired/stale ID cannot affect a later activation',()=>{
  const p=peers();p.guest.run('jump()');p.host.run("starHold.stop(ordinarySkills.onnaraEvent('onnara-hover',enemy.id,elapsed))");send(p);ack(p);assert.equal(p.guest.run('player.vy'),0);assert.equal(p.guest.run('player.onnaraHopPending'),null);
  setup();h.run("useAbility('e');player.kit.dash=1;player.y=3;activateAbility(player,'e');var newer=ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed);applyRemoteAction(player,{type:'ability',key:'e',onnaraStop:originalHold.id,seq:9});applyRemoteAction(player,{type:'ability',key:'e',onnaraHop:originalHold.id,seq:10})");assert.equal(h.run("ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed).id"),h.run('newer.id'));assert.equal(h.run('player.vy'),0);
 });
 check('a second E before the initial activation ACK cancels that cast once; failed activation cannot become a later cast',()=>{
  const p=peers();p.host.run("ordinarySkills.reset();starHold.reset();enemy.y=2;enemy.vy=0;enemy.kit.dash=1;netClock=0;tickOnline(.1)");ack(p);p.guest.run("player.y=2;player.vy=0;useAbility('e');useAbility('e');useAbility('e')");assert.equal(p.guest.run('netActions.length'),2);send(p);ack(p);assert.equal(p.host.run("ordinarySkills.onnaraEvent('onnara-hover',enemy.id,elapsed)"),null);assert.equal(p.host.run('enemy.kit.dash'),0);assert.equal(p.guest.run('player.kit.dash'),0);assert.equal(p.guest.run('player.onnaraHoldCastPending'),null);
 });
 check('input timeout keeps physical ascent and expiry fall; death/team/round/menu clean local predictions',()=>{
  const p=peers();p.guest.run('jump()');send(p);p.host.run("elapsed+=1;updateRemoteActor(enemy,.5)");near(p.host.run('enemy.y'),2+6.552**2/30,'timeout apex',.00001);p.host.run("elapsed=15;updateRemoteActor(enemy,.3)");assert.ok(p.host.run('enemy.vy')<0);
  for(const cleanup of["player.alive=false;player.hp=0;updateOrdinarySkills()","player.team='red';updateOrdinarySkills()","match.round++;resetOrdinarySkills()","backMenu()"]){setup();h.run('jump()');h.run(cleanup);assert.equal(h.run("ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed)"),null);}
 });
 console.log('PASS: '+groups+' actual savedgame ONNARA hold control groups; no audio playback');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
`;
const instance=new Module(__filename,module);instance.filename=__filename;instance.paths=module.paths;instance._compile(fixture.slice(0,cut)+suite,__filename);
