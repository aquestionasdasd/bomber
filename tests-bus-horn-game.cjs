const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-bus-driving-game.cjs'),'utf8'),boundary=fixture.indexOf(' const local=harness({realMap:true});');
if(boundary<0)throw Error('Saved game harness boundary missing');
const suite=String.raw`
 const local=harness({realMap:true});
 function setup(h=local){h.reset();h.run("$('map-select').value='hirakata';mode='menu';startGame();startRound();clearBots();match.phase='live';elapsed=0;while(elapsed<40&&!map.traffic.poses(elapsed).some(p=>p.door))elapsed+=.02;var bus=map.traffic.poses(elapsed).find(p=>p.door);Object.assign(player,busPoint(bus,-1.8,3.8),{hp:100,armor:0,alive:true,vy:0,vx:0,vz:0});soundEnabled=true;volume=.5;audioEvents.length=0;");}
 function claim(h=local){assert.ok(h.run('busInteract()'));assert.ok(h.run('map.traffic.service.damageDriver(bus.id,player.id,100,elapsed)'));assert.ok(h.run('busInteract()'));assert.ok(h.run('busDriving()'));}
 function step(h=local,dt=0){h.sandbox.hornDt=dt;h.run('elapsed+=hornDt;updateTraffic(hornDt)');}
 const count=(h=local)=>h.run("audioEvents.filter(e=>e.type==='bus-horn').length");
 check('actual boarding and driver kill stay silent; claiming starts repeated stationary horn through fuel exhaustion',()=>{
  setup();step();assert.equal(count(),0);local.run('busInteract()');step();assert.equal(count(),0);
  local.run('map.traffic.service.damageDriver(bus.id,player.id,100,elapsed)');step();assert.equal(count(),0);local.run('busInteract()');step();assert.equal(count(),1);
  step(local,1.49);assert.equal(count(),1);step(local,.01);assert.equal(count(),2);step(local,26);assert.equal(local.run('map.traffic.poses(elapsed).find(p=>p.id===bus.id).fuel'),0);assert.equal(count(),3);
  step(local,1.5);assert.equal(count(),4);assert.ok(local.run('busDriving()'));
 });
 check('actual exit death and team changes stop repetitions; round and menu cleanup remove old sounds',()=>{
  for(const code of['busInteract()','player.alive=false',"player.team='red'","match.phase='post'",'backMenu()']){
   setup();claim();step();assert.equal(count(),1);local.run(code);step(local,1.5);assert.equal(count(),1,code);step(local,2);assert.equal(count(),1,code);
  }
  setup();claim();step();local.run("match.phase='post';match.winner=null;match.nextRound();handleMatchEvents()");step(local,2);assert.equal(count(),1);assert.equal(local.run('map.traffic.poses(elapsed).some(p=>p.id===bus.id)'),false);
 });
 check('mute volume zero and hidden/paused frames cannot play or build an audio backlog',()=>{
  setup();claim();local.run('soundEnabled=false');step();assert.equal(count(),0);local.run('soundEnabled=true');step(local,.1);assert.equal(count(),0);step(local,1.4);assert.equal(count(),1);
  local.run('volume=0');step(local,1.5);local.run('volume=.5');step(local,.1);assert.equal(count(),1);step(local,1.4);assert.equal(count(),2);
  local.run('document.hidden=true');step(local,5);assert.equal(count(),2);local.run('document.hidden=false;netHostPaused=true');step(local,5);assert.equal(count(),2);local.run('netHostPaused=false');step();assert.equal(count(),3);
 });
 check('real positional sound follows the bus and uses existing pan distance occlusion with no network cue',()=>{
  setup();claim();local.run("var p=map.traffic.poses(elapsed).find(p=>p.id===bus.id);sound('bus-horn',{entity:{id:'test-bus',x:player.x+10,y:0,z:player.z},localOnly:true});");
  assert.equal(count(),1);assert.equal(local.run('audioEvents.at(-1).options.distance'),10);
  local.run("onlinePlaying=true;online={host:true};netCues.length=0;busHorns.reset()");step();assert.equal(count(),2);assert.equal(local.run("netCues.some(c=>c.type==='bus-horn')"),false);
  local.run("sound('bus-horn',{entity:{id:'distant-bus',x:player.x+80,y:0,z:player.z},localOnly:true})");assert.equal(count(),2);
 });
 check('independent host guest JSON starts only from confirmed ownership and duplicate snapshots do not duplicate horn',()=>{
  setup();local.run("makeBot({x:bus.x+12,z:bus.z},0,'red',{id:'red-0',team:'red',primary:'vandal',secondary:'classic',armor:0,credits:800,kit:new DuelistKit({character:'nope'})});var remote=bots[0];remote.remoteId='guest';roster=[roster[0],remote.record];onlinePlaying=true;online={host:true,room:{code:'BUSHORN1'},session:{memberId:'host',hostId:'host'},send:(p,o)=>{if(o.team==='red')captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest','red-0');netClock=0;tickOnline(.1)");
  const guest=harness({realMap:true});guest.reset();guest.run("selectArena('hirakata');onlinePlaying=true;online={host:false,room:{code:'BUSHORN1'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-0');soundEnabled=true;volume=.5;audioEvents.length=0");
  const send=()=>{local.run('netClock=0;tickOnline(.1)');guest.sandbox.transfer=copy(local.run('captured'));guest.run("receiveNetPacket('host',transfer)");};
  send();step(guest);assert.equal(count(guest),0);guest.run("queueNetAction('bus')");step(guest);assert.equal(count(guest),0);
  claim();send();step(guest);assert.equal(count(guest),1);guest.run("receiveNetPacket('host',JSON.parse(JSON.stringify(transfer)))");step(guest);assert.equal(count(guest),1);
  assert.equal(guest.run("netCues.some(c=>c.type==='bus-horn')"),false);assert.ok(guest.run('audioEvents.at(-1).options.distance')>5);
  step(local,1.5);send();step(guest);assert.equal(count(guest),2);
  // The guest interpolates ahead, then a newer snapshot corrects elapsed back.
  // This must not restart an initial horn on every incoming packet.
  for(let i=0;i<6;i++){step(guest,.2);step(local,.1);send();step(guest);}
  assert.equal(count(guest),2);
  local.run('busInteract()');send();step(guest,2);assert.equal(count(guest),2);
 });
 console.log('PASS '+groups+' actual savedgame bus horn groups; audio mocked, no playback');
 console.log('TOTAL '+Math.round(performance.now()-started)+'ms wall / '+Math.round(process.cpuUsage(cpuStarted).user/1000)+'ms CPU');
}main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const test=new Module(__filename,module);test.filename=__filename;test.paths=module.paths;test._compile(fixture.slice(0,boundary)+suite,__filename);
