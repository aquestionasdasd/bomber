const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');if(cut<0)throw Error('Saved game harness missing');
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("player.kit=new DuelistKit({character:'veil'});player.kit.updraft=1;match.phase='live';player.pitch=-.4;makeBot({x:2,z:0},0,'red',{id:'enemy',team:'red',secondary:'classic'});var enemy=bots[0];enemy.remoteId='passive';enemy.hp=100;enemy.armor=0;enemy.reactionUntil=999;enemy.fire=999;");}
 function mouse(g,button){for(const fn of g.listeners.get('game:mousedown')||[])fn({button,preventDefault(){}});}
 const event=(g=h)=>g.run("ordinarySkills.events(elapsed).find(e=>e.type==='veil-sensor')");
 const slow=(g=h)=>g.run('actorSpeedScale(enemy)');
 function field(g=h,source='player'){g.run("var sensor=ordinarySkills.cast('veil-sensor',ordinaryActorView("+source+"),{x:0,y:.12,z:0,flight:1},elapsed,match.round);elapsed=sensor.triggerAt;updateOrdinarySkills()");}
 function step(seconds,hz=60,g=h){g.sandbox.seconds=seconds;g.sandbox.hz=hz;g.run('for(let t=0;t<seconds-1e-8;t+=1/hz){updatePlay(Math.min(1/hz,seconds-t));renderOrdinarySkills()}');}
 check('Q prepares visible green prop; left throws once, right/repeat cancel, live gentle trajectory and airborne throw',()=>{
  setup();h.run("useAbility('q');renderOrdinarySkills()");assert.equal(h.run('duckAim'),'q');assert.equal(event(),undefined);assert.ok(h.run('preparedSkillFX.hand.visible'));mouse(h,2);assert.equal(h.run('player.kit.updraft'),1);assert.equal(h.run('duckAim'),null);
  h.run("useAbility('q')");mouse(h,0);assert.ok(event());assert.equal(h.run('player.kit.updraft'),0);assert.equal(event().radius,5);assert.ok(event().flight>.3);near(event().triggerAt,event().startedAt+event().flight,'landing clock');near(event().endsAt-event().triggerAt,8.5,'field plus residual');
  setup();h.run("player.y=3;player.vy=1;useAbility('q')");mouse(h,0);assert.ok(event());
 });
 check('actual full frames20/60/144Hz retain multiple contacts,40% slow,7second field and no HP damage',()=>{
  for(const hz of[20,60,144]){setup();h.run("makeBot({x:-2,z:0},1,'red',{id:'enemy2',team:'red',secondary:'classic'});bots[1].remoteId='passive'");field();assert.equal(slow(),.6);assert.equal(h.run("ordinarySkills.rootTracks('blue',elapsed).length"),2);step(6.99,hz);assert.equal(slow(),.6);assert.equal(h.run('enemy.hp'),100);h.run('elapsed=sensor.triggerAt+7;updateOrdinarySkills()');assert.equal(slow(),1);assert.equal(h.run("ordinarySkills.rootTracks('blue',elapsed)[0].active"),false);h.run('elapsed=sensor.triggerAt+8.5;updateOrdinarySkills()');assert.equal(event(),undefined);}
 });
 check('real steady input displacement at20/60/144Hz is60% while inside the sensor',()=>{
  for(const hz of[20,60,144]){setup();h.run("keys.clear();keys.add('KeyW')");step(.3,hz);let start=h.run('player.z');step(.3,hz);const normal=Math.abs(h.run('player.z')-start);setup();field(h,'enemy');h.run("keys.clear();keys.add('KeyW')");step(.3,hz);start=h.run('player.z');step(.3,hz);near(Math.abs(h.run('player.z')-start)/normal,.6,'real steady movement '+hz,.005);}
 });
 check('normal jump impulse gives50% height and remains slowed in flight; guns and C skill remain usable',()=>{
  setup();field();h.run('beginNormalJump(enemy)');near(h.run('enemy.vy**2/30'),6.552**2/60,'half ballistic jump height');h.run('enemy.y=.6;enemy.vy=1;elapsed+=.1;updateOrdinarySkills()');assert.equal(slow(),.6);
  setup();field(h,'enemy'); // Red sensor affects the blue local player.
  h.run('elapsed+=.3;var beforeAmmo=player.ammo;shoot()');assert.equal(h.run('player.ammo'),h.run('beforeAmmo')-1);h.run("player.kit.smoke=3;activateAbility(player,'c',{zonePoint:{x:1,y:0,z:1}})");assert.ok(h.run("ordinarySkills.events(elapsed).some(e=>e.type==='veil-dust')"));
 });
 check('real walls and other floors block sensing; smoke hides roots but not ground sensing',()=>{
  setup();h.wall({x:1,z:0,width:.25,depth:8,height:3});field();assert.equal(slow(),1);assert.equal(h.run("ordinarySkills.rootTracks('blue',elapsed).length"),0);h.clearWalls();h.run('elapsed+=.1;updateOrdinarySkills()');assert.equal(slow(),.6);
  setup();h.run('enemy.y=3;enemy.vy=0');field();assert.equal(slow(),1);
  setup();h.run("ordinarySkills.cast('veil-dust',ordinaryActorView(player),{x:1,y:1.25,z:0},elapsed,match.round)");field();assert.equal(slow(),.6);assert.equal(h.run('ordinaryReachable({...sensor,y:0},ordinaryActorView(enemy))'),true);assert.equal(h.run('visibleBetween(player,{x:2,y:.09,z:0})'),false);
 });
 check('opaque pooled roots obey visibility and supported ground; no outline or minimap detection marker',()=>{
  setup();field();h.run('elapsed+=.3;updateOrdinarySkills();rootSensorFX.update(ordinarySkills.events(elapsed),ordinarySkills.rootTracks(player.team,elapsed),elapsed,{groundHeight:ordinaryGroundHeight,reachable:ordinaryReachable,visible:()=>true});var rootCount=rootSensorFX.group.children[0].count');assert.ok(h.run('rootCount')>32);assert.ok(h.run('rootCount')<=2048);assert.equal(h.run('rootSensorFX.group.children[0].material.transparent'),false);assert.ok(h.run('rootSensorFX.group.children[0].material.depthTest&&rootSensorFX.group.children[0].material.depthWrite'));assert.equal(h.run('ordinarySkills.markers(player.team,elapsed).length'),0);
  h.run('rootSensorFX.update(ordinarySkills.events(elapsed),ordinarySkills.rootTracks(player.team,elapsed),elapsed,{groundHeight:ordinaryGroundHeight,reachable:ordinaryReachable,visible:()=>false})');assert.equal(h.run('rootSensorFX.group.children[0].count'),0);
  h.wall({x:1,z:0,width:.25,depth:8,height:1});assert.equal(h.run('visibleBetween(player,{x:2,y:0,z:0})'),true);assert.equal(h.run('rootPointVisible(player,{x:2,y:0,z:0})'),false,'root LOS must end on the ground, below a low wall');
  h.run('resetOrdinarySkills()');assert.equal(h.run('rootSensorFX.group.visible'),false);assert.equal(h.run('rootEntryAudio.size'),0);
 });
 check('entry sound reaches a distant teammate once; never enemy, positionless mock only',()=>{
  setup();h.run("soundEnabled=true;volume=.5;audioEvents.length=0;var sensor=ordinarySkills.cast('veil-sensor',ordinaryActorView(player),{x:0,y:.12,z:0,flight:1},elapsed,match.round);player.x=100;elapsed=sensor.triggerAt;updateOrdinarySkills()");const sounds=copy(h.run("audioEvents.filter(e=>e.type==='grass-roots')"));assert.equal(sounds.length,1);assert.equal(sounds[0].options.distance,0);assert.equal(sounds[0].options.pan,0);h.run('elapsed+=.05;updateOrdinarySkills()');assert.equal(h.run("audioEvents.filter(e=>e.type==='grass-roots').length"),1);
  setup();h.run('soundEnabled=true;volume=.5;audioEvents.length=0');field(h,'enemy');assert.equal(h.run("audioEvents.filter(e=>e.type==='grass-roots').length"),0);
 });
 check('independent host/guest input, stock prediction, bounded JSON roots, duplicate and rejection ACK',()=>{
  function peers(){const host=harness(),guest=harness();setup(host);setup(guest);host.run("enemy.kit=new DuelistKit({character:'veil'});enemy.kit.updraft=1;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,room:{code:'ABCDEFGH'},session:{memberId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest',enemy.id);var captured;netClock=0;tickOnline(.1)");guest.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send(){}};netParticipants.set('guest','enemy')");guest.sandbox.packet=copy(host.run('captured'));guest.run("receiveNetPacket('host',packet)");return{host,guest};}
  function relay(p){p.guest.run("player.pitch=-.4;useAbility('q')");mouse(p.guest,0);assert.equal(event(p.guest),undefined);assert.equal(p.guest.run('player.kit.updraft'),0);p.host.sandbox.request={type:'input',seq:1,connection:'sensor',round:p.host.run('match.round'),input:{x:2,y:0,z:0,yaw:0,pitch:-.4},actions:copy(p.guest.run('netActions'))};p.host.run("receiveNetPacket('guest',request);updateRemoteActor(enemy,.05);elapsed+=.05;updateRemoteActor(enemy,.05);netClock=0;tickOnline(.1)");p.guest.sandbox.packet=copy(p.host.run('captured'));p.guest.run("receiveNetPacket('host',packet)");}
  const p=peers();relay(p);assert.ok(event(p.host));assert.deepEqual(copy(event(p.guest)),copy(event(p.host)));p.guest.run("receiveNetPacket('host',packet)");assert.equal(p.guest.run('player.kit.updraft'),0);p.host.run("receiveNetPacket('guest',request);updateRemoteActor(enemy,.05)");assert.equal(p.host.run("ordinarySkills.events(elapsed).filter(e=>e.type==='veil-sensor').length"),1);
  const q=peers();q.host.run("for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:1,y:.12,z:1,flight:1},elapsed,match.round)");relay(q);assert.equal(event(q.host),undefined);assert.equal(q.guest.run('player.kit.updraft'),1);
  setup();field();const state=copy(h.run('ordinarySkills.snapshot()')),g=harness();setup(g);g.sandbox.state=state;g.run('elapsed=11;ordinarySkills.restore(state,elapsed,match.round)');assert.equal(g.run("ordinarySkills.rootTracks('blue',elapsed).length"),1);
 });
 console.log('PASS: '+groups+' root sensor saved-game groups; mocked audio only');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const prefix=fixture.slice(0,cut).replace('addEventListener() {}, setAttribute',"addEventListener(type,fn) {const k=this.id+':'+type;if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(fn);}, setAttribute");
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(prefix+suite,__filename);
