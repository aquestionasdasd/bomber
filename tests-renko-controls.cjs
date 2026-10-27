const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8');
const fault=process.argv.find(a=>a.startsWith('--fault='))?.split('=')[1];
const cases={precision:["||renkoSteadyAim(actor)","","Q/E/X single"],release:["function releaseRenkoJet(){player.renkoJetHeld=false;if(!isGuest())ordinarySkills.holdRenkoJet(player.id,elapsed,false);}","function releaseRenkoJet(){}","held E automatically"],heading:["dx=-Math.sin(actor.netYaw)*horizontal*dt;dz=-Math.cos(actor.netYaw)*horizontal*dt;","dx=0;dz=0;","independent guest steering"],radius:["b.x,b.y,b.z,r)","b.x,b.y,b.z,0)","instant C fires"]};
if(fault){const [a,b]=cases[fault]||[];if(!a)throw Error('Unknown fault');const read=fs.readFileSync;fs.readFileSync=function(file,...args){let text=read.call(this,file,...args);if(String(file).replaceAll('\\','/').endsWith('/public/game.js')&&typeof text==='string'){if(!text.includes(a))throw Error('Fault anchor missing');text=text.replace(a,b);}return text;};}
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const boundary=fixture.indexOf(' const h=harness();');
const network=fixture.slice(fixture.indexOf(' function peers()'),fixture.indexOf(" check('independent host/guest flight"));
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("player.kit=new DuelistKit({character:'renko'});player.kit.smoke=2;player.kit.updraft=1;match.phase='live';makeBot({x:0,z:-12},0,'red',{id:'enemy',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.remoteId='passive';enemy.hp=100;enemy.armor=50;enemy.fire=999;enemy.reactionUntil=999");}
 function step(t,g=h,hz=60){g.sandbox.duration=t;g.sandbox.hz=hz;g.run('for(let i=0;i<duration-1e-8;i+=1/hz)updatePlay(Math.min(1/hz,duration-i))');}
 check('instant C fires into empty space while blind and shooting; enlarged sphere catches offset enemies but respects edge/walls',()=>{
  setup();h.run("enemy.x=60;firing=true;useAbility('c')");assert.equal(h.run('player.kit.smoke'),1);assert.equal(h.run('firing'),true);assert.equal(h.run('duckAim'),null);
  for(const [x,hit]of[[1.6,true],[1.9,false]]){setup();h.sandbox.offset=x;h.run("enemy.x=offset;useAbility('c')");step(.3);assert.equal(h.run('!!enemy.carMotion'),hit);assert.equal(h.run('enemy.hp+enemy.armor'),150);}
  for(const hz of[20,60,144]){setup();h.wall({z:-14,width:8});h.run("var pushCount=0;var actualBegin=beginCarMotion;beginCarMotion=(a,m)=>{pushCount++;return actualBegin(a,m)};useAbility('c')");step(.25,h,hz);assert.equal(h.run('pushCount'),1,'enemy before wall at '+hz);h.run('beginCarMotion=actualBegin');}
  setup();h.wall({x:1.2,z:-6,width:.1,depth:.5});h.run("useAbility('c')");step(.4);assert.equal(h.run('enemy.carMotion'),undefined,'wide projectile touches off-centre wall');
  setup();h.run("ordinarySkills.cast('nope-flash',ordinaryActorView(enemy),{x:0,y:1.7,z:-2},elapsed,match.round);elapsed+=.5;updateOrdinarySkills();useAbility('c')");assert.equal(h.run('player.kit.smoke'),1,'manual empty-space fire has no sighting requirement');
 });
 check('10x visual radius matches event and wall collision; restored dart cannot acquire host hit authority',()=>{
  const {createRenkoSkillFX}=imported,fx=createRenkoSkillFX(THREE);const ball=fx.group.children[0].children[1].children[0];near(ball.geometry.parameters.radius,.13*10,'radius');fx.dispose();
  setup();h.run("useAbility('c');var snapshot=ordinarySkills.snapshot()");assert.equal(h.run('snapshot.events[0].radius'),1.3);const clone=imported.createCharacterSkills();assert.ok(clone.restore(copy(h.run('snapshot')),10,1));assert.equal(clone.update([{id:'enemy',team:'red',x:0,y:0,z:-12,hp:100,alive:true}],10.3,1,{projectileClear:()=>true}).length,0);
 });
 check('Q/E/X single guns follow visible aim; shotguns retain their ordinary cone; cadence/ammo preserved',()=>{
  for(const key of['q','e','x'])for(const id of['classic','ghost','spectre','vandal','phantom','scout','atlas','forge','pump','drum']){
   setup();h.sandbox.gunId=id;h.sandbox.skill=key;h.run("enemy.x=60;player.kit.ultPoints=7;inventory={primary:gunId,secondary:'classic',active:gunId};equip(gunId,true);activateAbility(player,skill);player.y=2;player.vy=3;player.vx=9;player.vz=3;Math.random=()=>.99;shotSequence=9;renderedRecoil=.025;var shotRays=[];tracer=(from,to)=>shotRays.push({from:from.clone(),to:to.clone()});shoot()");
   const spec=imported.WEAPONS[id];assert.equal(h.run('player.ammo'),spec.mag-1,id+key);const rays=h.run('shotRays');assert.equal(rays.length,spec.pellets||1);const aimError=h.run('(()=>{const d=new THREE.Vector3();camera.getWorldDirection(d);return shotRays[0].to.clone().sub(camera.position).normalize().distanceTo(d)})()');near(aimError,0,key+id+' aim',1e-9);
   if(spec.pellets){const pattern=imported.shotPattern(id,{sequence:10});for(let i=0;i<rays.length;i++){const a=rays[i].to.clone().sub(rays[i].from).normalize(),b=rays[0].to.clone().sub(rays[0].from).normalize();near(Math.tan(Math.acos(Math.min(1,a.dot(b)))),Math.hypot(pattern[i].x,pattern[i].y),id+' pellet',1e-6);}}
   h.run('shoot()');assert.equal(h.run('player.ammo'),spec.mag-1,'same-frame cooldown');
  }
 });
 check('ordinary aim returns after release/expiry/death/team/round; C by itself does not grant a lasting precision buff',()=>{
  for(const code of["useAbility('e');releaseRenkoJet()","useAbility('q');elapsed+=6.1","player.kit.ultPoints=7;useAbility('x');player.alive=false","useAbility('q');player.team='red'","useAbility('q');match.round++","useAbility('c')"]){setup();h.run(code);assert.equal(h.run('renkoSteadyAim(player)'),false,code);}
 });
 check('held E automatically follows all four camera directions and pitch; release/blur/pause terminate; no WASD needed',()=>{
  for(const hz of[20,60,144])for(const yaw of[0,Math.PI/2,Math.PI,-Math.PI/2]){setup();h.sandbox.yaw=yaw;h.run("enemy.x=60;player.yaw=yaw;player.pitch=.3;useAbility('e')");step(.2,h,hz);near(h.run('player.x'),-Math.sin(yaw)*Math.cos(.3)*3.2,'x',.001);near(h.run('player.z'),-Math.cos(yaw)*Math.cos(.3)*3.2,'z',.001);near(h.run('player.y'),Math.sin(.3)*3.2,'up',.001);}
  setup();h.run("enemy.x=60;player.pitch=.2;useAbility('e')");step(4.5);assert.ok(h.run('renkoFlight(player)'),'still held within5');const snapshot=copy(h.run('ordinarySkills.snapshot()'));assert.ok(imported.createCharacterSkills().restore(snapshot,h.run('elapsed'),h.run('match.round')),'fixed strict5second event restores');
  for(const stop of['key','clear','pause','blur']){setup();h.run("player.pitch=.4;useAbility('e')");step(.1);if(stop==='key')for(const f of h.listeners.get('keyup'))f({code:'KeyE'});else if(stop==='blur')for(const f of h.windowListeners.get('blur'))f();else h.run(stop==='clear'?'clearCombatInput()':'pauseGame()');assert.equal(h.run('renkoFlight(player)'),null,stop);assert.equal(h.run("ordinarySkills.events(elapsed).some(e=>e.type==='renko-jet')"),false,stop);}
 });
`+network+String.raw`
 check('independent guest steering is host-computed from yaw/pitch; release wins over stale ACK and timeout stops lease',()=>{
  const p=peers();request(p,'e');ack(p);p.host.run("netInputs.get('guest').input={x:999,y:999,z:999,yaw:Math.PI/2,pitch:.5,jet:true};var oldX=enemy.x,oldZ=enemy.z,oldY=enemy.y;updateRemoteActor(enemy,.05)");near(p.host.run('enemy.x-oldX'),-Math.cos(.5)*.8,'host heading',.001);near(p.host.run('enemy.z-oldZ'),0,'no spoof strafe',.001);near(p.host.run('enemy.y-oldY'),Math.sin(.5)*.8,'host pitch',.001);
  p.guest.run('releaseRenkoJet()');ack(p);assert.equal(p.guest.run('renkoFlight(player)'),null,'stale accepted snapshot cannot resume released E');
  p.host.run("netInputs.get('guest').input.jet=false;updateRemoteActor(enemy,.05)");assert.equal(p.host.run("ordinarySkills.renkoEvent('renko-jet',enemy.id,elapsed)"),null);
  const q=peers();request(q,'e');q.host.run("elapsed+=.81;syncRenkoJets()");assert.equal(q.host.run("ordinarySkills.renkoEvent('renko-jet',enemy.id,elapsed)"),null,'lost release/disconnected input');
 });
 check('invalid hold types are rejected, no event/no stock cannot fly, repeated held input never spends/refills',()=>{
  const p=peers();p.host.sandbox.bad={type:'input',seq:9,round:p.host.run('match.round'),input:{jet:'true'},actions:[]};p.host.run("receiveNetPacket('guest',bad)");assert.equal(p.host.run("netInputs.has('guest')"),false);
  p.host.sandbox.bad.input={jet:true,yaw:0,pitch:null};p.host.run("receiveNetPacket('guest',bad)");assert.equal(p.host.run("netInputs.has('guest')"),false,'invalid steering');
  request(p,'e');p.host.run("var stock=enemy.kit.dash;for(let i=0;i<160;i++){elapsed+=.05;netInputs.get('guest').received=elapsed;syncRenkoJets();updateRemoteActor(enemy,.05)}");assert.equal(p.host.run('enemy.kit.dash'),0);assert.equal(p.host.run("ordinarySkills.renkoEvent('renko-jet',enemy.id,elapsed)"),null);
  p.host.run("ordinarySkills.reset(match.round);netInputs.get('guest').input.y=999;var oldY=enemy.y;updateRemoteActor(enemy,.05)");assert.equal(p.host.run('renkoFlight(enemy)'),null);
 });
 check('held E ends at five seconds without renewal in local prediction and independent host authority',()=>{
  for(const hz of[20,60,144]){setup();h.run("enemy.x=60;player.y=4;player.pitch=0;useAbility('e');var jetStart=renkoFlight(player).startedAt,jetEnd=renkoFlight(player).endsAt");near(h.run('jetEnd-jetStart'),5,'fixed5seconds');step(4.9,h,hz);assert.ok(h.run('renkoFlight(player)'));near(h.run('renkoFlight(player).endsAt'),h.run('jetEnd'),'holding cannot extend end');step(.2,h,hz);assert.equal(h.run('renkoFlight(player)'),null);assert.ok(h.run('player.vy')<0);assert.equal(h.run('player.kit.dash'),0);}
  const p=peers();request(p,'e');ack(p);p.guest.run('var predictedEnd=renkoFlight(player).endsAt');step(5.2,p.guest);assert.equal(p.guest.run('renkoFlight(player)'),null,'guest expiry before a new ACK');
  p.host.run("var originalEnd=renkoFlight(enemy).endsAt;for(let i=0;i<110;i++){elapsed+=.05;netInputs.get('guest').received=elapsed;syncRenkoJets();updateRemoteActor(enemy,.05)};netClock=0;tickOnline(.1)");assert.equal(p.host.run('renkoFlight(enemy)'),null);ack(p);assert.equal(p.guest.run('renkoFlight(player)'),null,'late ACK cannot extend expired event');assert.equal(p.host.run('enemy.kit.dash'),0);
 });
 console.log('PASS: '+groups+' Renko manual controls/accuracy/independent JSON groups; audio inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const compiled=new Module(__filename,module);compiled.filename=__filename;compiled.paths=module.paths;compiled._compile(fixture.slice(0,boundary).replace('fn(); groups++;',`if(${JSON.stringify(cases[fault]?.[2]||only||'')}&&!label.startsWith(${JSON.stringify(cases[fault]?.[2]||only||'')}))return;fn(); groups++;`)+suite,__filename);
