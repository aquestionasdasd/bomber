const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true,baseline=false}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const m=new Module(path.join(__dirname,'echo-glint-bot-harness.cjs'),module);m.filename=path.join(__dirname,'echo-glint-bot-harness.cjs');m.paths=module.paths;m.mutateGameSource=mutate;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const{harness}=await m.exports(),h=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name)};
 function setup(distance=14){h.reset();h.clearWalls();h.sandbox.dist=distance;h.run(`difficulty='hard';match.phase='live';match.spike.status='carried';match.spike.carrier='other';
 Object.assign(player,{team:'red',x:0,y:0,z:-dist,hp:100,armor:0,alive:true,yaw:Math.PI,pitch:0});
 makeBot({x:0,z:0},0,'blue',{id:'echo-worker',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'echo'})});
 var worker=bots[0];worker.kit.smoke=0;worker.kit.updraft=1;worker.kit.dash=0;worker.kit.ultPoints=0;
 Object.assign(worker,{aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:999,think:1,target:player,reactionUntil:0,nextSkillAt:0});worker.group.rotation.y=Math.PI;
 var goal={x:0,z:0};updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,role:'guard',siteId:'A',urgent:false}]])}}};Math.random=()=>.5;`)}
 const step=(dt=.1)=>{h.sandbox.dt=dt;h.run('elapsed+=dt;worker.kit.tick(elapsed);updateOrdinarySkills();updateBots(dt)')};
 const event=()=>h.run("ordinarySkills.events(elapsed).find(e=>e.type==='echo-glint')");
 const burst=()=>h.run('elapsed+=.51;updateOrdinarySkills()');
 function ally(yaw=0){h.sandbox.allyYaw=yaw;h.run("makeBot({x:3,z:-12},1,'blue',{id:'friend',team:'blue',secondary:'classic',kit:new DuelistKit({character:'nope'})});var friend=bots[1];friend.remoteId='passive';friend.yaw=allyYaw;friend.pitch=0;friend.fire=999;")}
 const state=()=>JSON.parse(h.run("JSON.stringify({cast:!!ordinarySkills.events(elapsed).find(e=>e.type==='echo-glint'),stock:worker.kit.updraft,selfBlind:ordinarySkills.blindUntil(worker.id,elapsed)>elapsed,enemyBlind:ordinarySkills.blindUntil(player.id,elapsed)>elapsed})"));
 if(baseline){const rows=[];for(const d of[9,14,20]){setup(d);step();const before=state();burst();rows.push({distance:d,atCast:before,afterBurst:state()})}return rows}
 test('close self flash conserves Q even when current facing will turn toward the enemy',()=>{
  for(const yaw of[0,Math.PI]){setup(9);h.sandbox.heading=yaw;h.run('worker.group.rotation.y=heading');step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.updraft'),1)}
 });
 test('a front offset burst blinds the visible enemy and leaves the caster clear',()=>{
  setup(14);step();assert.ok(event());assert.ok(Math.abs(event().z+12.5)<1e-8);burst();assert.ok(state().enemyBlind);assert.equal(state().selfBlind,false);assert.equal(h.run('worker.kit.updraft'),0);
 });
 test('facing and wall protected friends do not veto a safe flash while exposed friends do',()=>{
  setup();ally(-Math.PI/2);step();assert.ok(event());burst();assert.equal(h.run('ordinarySkills.blindUntil(friend.id,elapsed)>elapsed'),false);
  setup();ally(Math.PI/2);step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.updraft'),1);
  setup();ally(Math.PI/2);h.wall({x:1.5,z:-12,width:.25,depth:3,height:3});step();assert.ok(event());burst();assert.equal(h.run('ordinarySkills.blindUntil(friend.id,elapsed)>elapsed'),false);
 });
 test('long throws use actual clipped range and reject looking-away unreachable and stale enemies',()=>{
  setup(25);step();assert.ok(event());assert.ok(Math.abs(event().z+20)<1e-5);burst();assert.ok(state().enemyBlind);assert.equal(state().selfBlind,false);
  setup();h.run('player.yaw=0');step();assert.equal(event(),undefined);
  setup();h.wall({z:-7,width:30,height:3});h.run('worker.target=null;worker.lastSeen={id:player.id,team:player.team,x:0,z:-14,seenAt:elapsed}');step();assert.equal(event(),undefined);
  setup();h.run('worker.target=null;worker.lastSeen={id:player.id,team:player.team,x:0,z:-14,seenAt:elapsed};player.x=30;player.z=30');step();assert.equal(event(),undefined);
 });
 test('blind smoke host pause guest remote and dead actors do not spend Q',()=>{
  for(const code of["netHostPaused=true","onlinePlaying=true;online={host:false,session:{memberId:'friend'}}","worker.remoteId='friend'","worker.alive=false","match.phase='buy'","match.phase='post'","syncSmokes([{id:1,kind:'smoke',x:0,y:1.4,z:-7,radius:3.6,expires:100}])"]){setup();h.run(code);step();assert.equal(event(),undefined,code)}
  setup();h.run("ordinarySkills.cast('nope-flash',ordinaryActorView(player),{x:0,y:1.6,z:-2},elapsed-.6,match.round);updateOrdinarySkills()");assert.ok(h.run('ordinarySkills.blindUntil(worker.id,elapsed)>elapsed'));step();assert.equal(event(),undefined);
 });
 test('full queue rolls back Q and preserves bounded retry and enemy state',()=>{
  setup();h.run("for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:1,y:.12,z:player.z+1},elapsed,match.round)");assert.equal(h.run('ordinarySkills.events(elapsed).length'),20);step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.updraft'),1);assert.equal(h.run('player.hp'),100);assert.ok(h.run('worker.nextSkillAt>=elapsed+.49'));
 });
 test('twenty sixty and one-forty-four Hz keep two-second blindness and source cleanup',()=>{
  for(const hz of[20,60,144]){setup();for(let i=0;i<Math.ceil(.65*hz);i++)step(1/hz);assert.equal(state().selfBlind,false);assert.ok(state().enemyBlind,String(hz));assert.equal(h.run('worker.kit.updraft'),0);h.run('elapsed+=2.1;updateOrdinarySkills()');assert.equal(state().enemyBlind,false);h.run('resetOrdinarySkills();backMenu()');assert.equal(h.run('ordinarySkills.events(elapsed).length'),0)}
 });
 test('forecast is read-only and restored visual events never gain hit ownership',()=>{
  setup();const before=h.run('JSON.stringify(ordinarySkills.snapshot())');assert.equal(h.run("ordinarySkills.wouldBlind(ordinaryActorView(player),{type:'echo-glint',x:0,y:1.6,z:-12.5,radius:10},{reachable:ordinaryReachable})"),true);assert.equal(h.run('JSON.stringify(ordinarySkills.snapshot())'),before);
  h.run("ordinarySkills.cast('echo-glint',ordinaryActorView(worker),{x:0,y:1.6,z:-12.5},elapsed,match.round);var saved=ordinarySkills.snapshot();ordinarySkills.reset();ordinarySkills.restore(saved,elapsed,match.round)");burst();assert.equal(state().enemyBlind,false);
 });
 console.log(`PASS: ${groups} actual saved-game ECHO Q burst and exposure groups; no audio`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
