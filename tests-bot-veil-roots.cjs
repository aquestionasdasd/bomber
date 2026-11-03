const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true,baseline=false}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const m=new Module(path.join(__dirname,'veil-roots-bot-harness.cjs'),module);m.filename=path.join(__dirname,'veil-roots-bot-harness.cjs');m.paths=module.paths;m.mutateGameSource=mutate;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const{harness}=await m.exports(),h=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name)};
 function setup(distance=8){h.reset();h.clearWalls();h.sandbox.dist=distance;h.run(`difficulty='hard';match.phase='live';match.spike.status='carried';match.spike.carrier='other';
 Object.assign(player,{team:'red',x:0,y:0,z:-dist,hp:100,armor:0,alive:true,vy:0});
 makeBot({x:0,z:0},0,'blue',{id:'veil-worker',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'veil'})});
 var worker=bots[0];worker.kit.smoke=0;worker.kit.updraft=1;worker.kit.dash=0;worker.kit.ultPoints=0;
 Object.assign(worker,{aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:999,think:1,target:player,reactionUntil:0,nextSkillAt:0});worker.group.rotation.y=Math.PI;
 var goal={x:0,z:0};updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,role:'guard',siteId:'A',urgent:false}]])}}};Math.random=()=>.5;`)}
 // Advance physics, contacts, status, CPU and expiry once per saved-game frame.
 const step=(dt=1/60)=>{h.sandbox.dt=dt;h.run('updatePlay(dt)')};
 const event=()=>h.run("ordinarySkills.events(elapsed).find(e=>e.type==='veil-sensor'&&e.sourceId===worker.id)");
 const slow=()=>h.run('ordinarySkills.speedScale(ordinaryActorView(player),elapsed,{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})');
 const result=()=>({cast:!!event(),stock:h.run('worker.kit.updraft'),scale:slow()});
 const tracks=()=>h.run("ordinarySkills.rootTracks(worker.team,elapsed).filter(r=>r.targetId===player.id)");
 const jump=()=>h.run('ordinarySkills.rootJumpScale(ordinaryActorView(player),elapsed,{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})');
 function advanceTo(at,hz=60,before=false){assert.ok(Number.isFinite(at)&&at>=h.run('elapsed')-1e-9,'finite forward event time');assert.ok(at-h.run('elapsed')<20,'bounded fixture observation');let frames=0;const next=()=>{assert.ok(++frames<=Math.ceil(20*hz)+1,'bounded frame count');const previous=h.run('elapsed');step(1/hz);assert.ok(Math.abs(h.run('elapsed')-previous-1/hz)<1e-8,'one actual game frame per step');};while(h.run('elapsed')+1/hz<at-1e-9)next();if(!before&&h.run('elapsed')<at)next();}
 const settle=(hz=60,e=event())=>{assert.ok(e,'accepted sensor event exists');assert.ok(Math.abs(e.triggerAt-e.startedAt-e.flight)<1e-7,'sensor activates at actual landing');assert.ok(Math.abs(e.endsAt-e.triggerAt-8.5)<1e-7,'original seven-second field plus1.5-second residue');advanceTo(e.triggerAt,hz);return e;};
 if(baseline){const rows=[],observe=label=>{step();const atCast=result(),e=event();if(e)settle();rows.push({...label,atCast,event:e?{id:e.id,x:e.x,y:e.y,z:e.z,startedAt:e.startedAt,flight:e.flight,triggerAt:e.triggerAt,liveUntil:e.triggerAt+7,endsAt:e.endsAt}:null,observedAt:h.run('elapsed'),after:result(),jumpScale:jump(),tracks:tracks().map(r=>({active:r.active,x:r.x,y:r.y,z:r.z}))})};for(const d of[.5,1,8,20,20.01]){setup(d);observe({distance:d})}setup();h.run('player.y=3;player.vy=1');observe({case:'airborne'});setup();h.run('player.y=1;player.vy=0');observe({case:'different-floor'});setup();h.wall({z:-4,width:20,height:1});observe({case:'low-wall'});return rows}
 test('close and full twenty metre grounded opportunities produce the real sixty percent movement scale',()=>{
  for(const d of[.5,1,2,8,10,20]){setup(d);step();assert.ok(event(),String(d));assert.equal(h.run('worker.kit.updraft'),0);assert.equal(slow(),1);settle();assert.equal(slow(),.6,String(d));assert.equal(jump(),.5);assert.equal(h.run('player.hp'),100)}
  setup(20.01);step();assert.equal(event(),undefined);assert.equal(result().stock,1);
 });
 test('visible airborne or different-floor targets conserve Q',()=>{
  for(const code of['player.y=3;player.vy=1','player.y=1;player.vy=0']){setup();h.run(code);step();assert.equal(event(),undefined,code);assert.equal(h.run('worker.kit.updraft'),1)}
 });
 test('fixed recent memory behind tall cover cannot bypass the actual throw clip',()=>{
  setup();h.wall({z:-4,width:20,height:3});h.run('worker.lastSeen={id:player.id,team:player.team,x:0,y:0,z:-8,seenAt:elapsed}');step();assert.equal(h.run('worker.target'),null);assert.equal(event(),undefined);assert.equal(h.run('worker.kit.updraft'),1);
 });
 test('fixed recent sight memory never follows the hidden current pose and stale memory is ignored',()=>{
  setup();h.run('worker.target=null;worker.lastSeen={id:player.id,team:player.team,x:0,y:0,z:-8,seenAt:elapsed};player.x=30;player.z=30;player.y=3');step();assert.ok(event());assert.equal(event().x,0);assert.equal(event().z,-8);
  setup();h.run('worker.target=null;worker.lastSeen={id:player.id,team:player.team,x:0,z:-8,seenAt:elapsed-1.51};player.z=30');step();assert.equal(event(),undefined);
  setup();h.run('worker.target=null;worker.lastSeen=null;player.z=30');step();assert.equal(event(),undefined);
 });
 test('overlapping root bands are checked at the actual target floor instead of endpoint distance',()=>{
  setup();h.run("ordinarySkills.cast('veil-roots',{...ordinaryActorView(worker),id:'friend',x:-3,z:-8},{x:3,y:0,z:-8},elapsed,match.round)");step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.updraft'),1);
 });
 test('expired sensor residue does not reserve a future cast',()=>{
  setup();step();const e=event();assert.ok(e);settle(60,e);advanceTo(e.triggerAt+7);assert.equal(slow(),1);assert.ok(event(),'inactive residue still exists');assert.equal(tracks()[0].active,false);h.run('worker.kit.updraft=1;worker.nextSkillAt=0');step();const sensors=h.run("ordinarySkills.events(elapsed).filter(e=>e.type==='veil-sensor')");assert.equal(sensors.length,2);assert.equal(h.run('worker.kit.updraft'),0);assert.equal(sensors.filter(r=>r.id===e.id).length,1);assert.ok(sensors.some(r=>r.id!==e.id&&r.startedAt>=e.triggerAt+7),'new event accepted while old residue remains');
 });
 test('full queue preserves stock and bounded retry while guest remote dead busy and blind remain inactive',()=>{
  setup();h.run("for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:player.x+1,y:.12,z:player.z+1},elapsed,match.round)");step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.updraft'),1);assert.ok(h.run('worker.nextSkillAt>=elapsed+.49'));
  for(const code of["netHostPaused=true","onlinePlaying=true;online={host:false,session:{memberId:'friend'}}","worker.remoteId='friend'","worker.alive=false","match.phase='buy'","match.phase='post'","worker.y=2;worker.vy=1"]){setup();h.run(code);step();assert.equal(event(),undefined,code)}
  setup();h.run("worker.nextSkillAt=999;var guardPoint=getSkillTarget(player,'nope-flash',{x:0,y:1.6,z:-2});var guardFlash=ordinarySkills.cast('nope-flash',ordinaryActorView(player),guardPoint,elapsed,match.round)");assert.ok(h.run('guardFlash'),'real NOPE fuse-compatible throw');advanceTo(h.run('guardFlash.triggerAt'));assert.ok(h.run('ordinarySkills.blindUntil(worker.id,elapsed)>elapsed'));h.run('worker.nextSkillAt=0');step();assert.equal(event(),undefined);assert.equal(result().stock,1);
 });
 test('twenty sixty and one-forty-four Hz keep landing lifetime attached jump and round cleanup',()=>{
  for(const hz of[20,60,144]){setup();step(1/hz);const e=event();assert.ok(e);advanceTo(e.triggerAt,hz,true);assert.equal(slow(),1,'no slow before real landing');assert.equal(tracks().length,0);settle(hz,e);assert.equal(slow(),.6,String(hz));assert.equal(jump(),.5);assert.equal(tracks()[0].active,true);h.run('player.y=.6;player.vy=1');assert.equal(slow(),.6);step(1/hz);assert.equal(slow(),.6,'sampled contact remains attached during a short jump');h.run('player.y=0;player.vy=0');assert.equal(slow(),.6);advanceTo(e.triggerAt+7,hz,true);assert.equal(slow(),.6,'full original seven-second effect');assert.equal(result().stock,0);advanceTo(e.triggerAt+7,hz);assert.equal(slow(),1,'residue applies no slow');assert.equal(jump(),1);assert.ok(event());assert.equal(tracks()[0].active,false);const last=tracks()[0];h.run('player.x=30');advanceTo(e.endsAt,hz,true);assert.equal(slow(),1);assert.equal(tracks()[0].active,false);assert.equal(tracks()[0].x,last.x,'residue stays at last contact rather than hidden current pose');advanceTo(e.endsAt,hz);assert.equal(event(),undefined);assert.equal(tracks().length,0);assert.ok(h.run('elapsed')<e.endsAt+1/hz+1e-8);h.run('resetOrdinarySkills();backMenu()');assert.equal(event(),undefined)}
 });
 test('floor forecast is read-only and matches actual restored field movement without hit authority',()=>{
  setup();const snapshot=h.run('JSON.stringify(ordinarySkills.snapshot())');assert.equal(h.run("ordinarySkills.wouldRoot(ordinaryActorView(player),{type:'veil-roots',team:worker.team,fromX:0,fromY:0,fromZ:0,x:0,y:0,z:-8,radius:1.6},{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})"),true);assert.equal(h.run('JSON.stringify(ordinarySkills.snapshot())'),snapshot);
  step();h.run('var saved=JSON.parse(JSON.stringify(ordinarySkills.snapshot()));ordinarySkills.reset();ordinarySkills.restore(saved,elapsed,match.round)');assert.equal(slow(),1);settle();assert.equal(slow(),.6);assert.equal(tracks().length,0,'restored field cannot create authoritative contact samples');assert.equal(h.run('player.hp'),100);assert.equal(h.run('ordinarySkills.wouldRoot(ordinaryActorView(player),{type:"veil-roots",team:"blue",fromX:0,fromY:0,fromZ:0,x:0,y:0,z:0,radius:1.6},{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})'),false);
 });
 console.log(`PASS: ${groups} actual saved-game VEIL Q sensor opportunity groups; no audio`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
