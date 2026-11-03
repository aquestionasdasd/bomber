const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true,baseline=false}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const m=new Module(path.join(__dirname,'echo-tag-bot-harness.cjs'),module);m.filename=path.join(__dirname,'echo-tag-bot-harness.cjs');m.paths=module.paths;m.mutateGameSource=mutate;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const{harness}=await m.exports(),h=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name)};
 function setup(distance=8){h.reset();h.clearWalls();h.sandbox.dist=distance;h.run(`difficulty='hard';match.phase='live';match.spike.status='carried';match.spike.carrier='other';
 Object.assign(player,{team:'red',x:0,y:0,z:-dist,hp:100,armor:0,alive:true,vy:0});
 makeBot({x:0,z:0},0,'blue',{id:'echo-worker',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'echo'})});
 var worker=bots[0];worker.kit.smoke=2;worker.kit.updraft=0;worker.kit.dash=0;worker.kit.ultPoints=0;
 Object.assign(worker,{hp:100,aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:999,think:1,target:player,reactionUntil:0,nextSkillAt:0});worker.group.rotation.y=Math.PI;
 var goal={x:0,z:0};updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,role:'guard',siteId:'A',urgent:false}]])}}};Math.random=()=>.5;`)}
 const step=(dt=.1)=>{h.sandbox.dt=dt;h.run('elapsed+=dt;worker.kit.tick(elapsed);updateOrdinarySkills();updateBots(dt)')};
 const event=()=>h.run("ordinarySkills.events(elapsed).find(e=>e.type==='echo-tag'&&e.sourceId===worker.id)");
 const markers=()=>JSON.parse(h.run("JSON.stringify(ordinarySkills.markers(worker.team,elapsed))"));
 const state=()=>({cast:!!event(),stock:h.run('worker.kit.smoke'),markers:markers()});
 const settle=()=>h.run('elapsed+=1.1;updateOrdinarySkills()');
 if(baseline){const rows=[];for(const d of[1,8,18,20]){setup(d);step();const atCast=state();settle();rows.push({distance:d,atCast,after:state()})}setup(8);h.run('player.y=5');step();const atCast=state();settle();rows.push({case:'other-floor',atCast,after:state()});return rows}
 test('near and full range tags actually detect without changing the eighteen metre throw',()=>{
  for(const d of[1,4,8,18,20]){setup(d);step();assert.ok(event(),String(d));assert.equal(state().stock,1);assert.equal(markers().length,0);assert.ok(Math.abs(event().z)<=18+1e-6);settle();assert.equal(markers().length,1,String(d));assert.equal(markers()[0].z,-d);assert.equal(h.run('player.hp'),100)}
  setup(23);step();assert.equal(event(),undefined);assert.equal(state().stock,2);
 });
 test('other floors and wall clipped destinations conserve C while low cover remains useful',()=>{
  setup();h.run('player.y=5');step();assert.equal(event(),undefined);assert.equal(state().stock,2);
  setup();h.wall({z:-4,width:20,height:4});h.run('worker.target=null;worker.lastSeen={id:player.id,x:0,y:0,z:-8,seenAt:elapsed}');step();assert.equal(event(),undefined);
  setup();h.wall({z:-4,width:20,height:1});step();assert.ok(event());settle();assert.equal(markers().length,1);
 });
 test('fixed sight memory and empty watch placements never inspect hidden enemy poses',()=>{
  setup();h.run('worker.target=null;worker.lastSeen={id:player.id,x:0,y:0,z:-8,seenAt:elapsed};player.x=30;player.y=5;player.z=30');step();assert.ok(event());assert.equal(event().x,0);assert.equal(event().z,-8);settle();assert.equal(markers().length,0);
  setup();h.run('worker.target=null;worker.lastSeen=null;player.z=30;goal={x:0,z:-8}');step();assert.ok(event());assert.equal(event().z,-8);settle();assert.equal(markers().length,0);h.run('player.x=0;player.y=0;player.z=-8;updateOrdinarySkills()');assert.equal(markers().length,1);
  setup();h.run('worker.target=null;worker.lastSeen={id:player.id,x:0,z:-8,seenAt:elapsed-1.51};player.z=30');step();assert.equal(event(),undefined);
 });
 test('only an effective allied tag prevents duplicates including pending arm and other floors',()=>{
  setup();h.run("ordinarySkills.cast('echo-tag',{...ordinaryActorView(worker),id:'friend'},{x:0,y:.12,z:-8},elapsed,match.round)");step();assert.equal(event(),undefined);
  setup();h.run("ordinarySkills.cast('echo-tag',{...ordinaryActorView(worker),id:'friend',y:5},{x:0,y:5.12,z:-8},elapsed,match.round)");step();assert.ok(event());settle();assert.equal(markers().length,1);
 });
 test('full queue host guest blind and work preserve kit and bounded rejection retry',()=>{
  setup();h.run("for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:1,y:.12,z:player.z+1},elapsed,match.round)");const kit=h.run('JSON.stringify(worker.kit.snapshot())');step();assert.equal(event(),undefined);assert.equal(h.run('JSON.stringify(worker.kit.snapshot())'),kit);assert.ok(h.run('worker.nextSkillAt>=elapsed+.49'));
  for(const code of["netHostPaused=true","onlinePlaying=true;online={host:false,session:{memberId:'friend'}}","worker.remoteId='friend'","worker.alive=false","match.phase='buy'","match.phase='post'","worker.nextSkillAt=elapsed+1"]){setup();h.run(code);step();assert.equal(event(),undefined,code)}
  setup();h.run("ordinarySkills.cast('nope-flash',ordinaryActorView(player),{x:0,y:1.6,z:-2},elapsed-.6,match.round);updateOrdinarySkills()");assert.ok(h.run('ordinarySkills.blindUntil(worker.id,elapsed)>elapsed'));step();assert.equal(event(),undefined);
  setup();h.run("match.spike.status='planted';match.spike.x=0;match.spike.z=0;match.spike.site='A';worker.team=match.defenderTeam;player.team=match.attackerTeam;updateBots.tactics.update=()=>({siteId:'A',defuserId:worker.id,roles:new Map([[worker.id,{goal:{x:0,z:0},role:'defuse',siteId:'A',urgent:true}]])})");step();assert.ok(h.run('worker.defusing'));assert.equal(event(),undefined);
 });
 test('twenty sixty and one-forty-four Hz preserve arm lifetime fixed marker expiry and round cleanup',()=>{
  for(const hz of[20,60,144]){setup();for(let i=0;i<Math.ceil(1.3*hz);i++)step(1/hz);assert.equal(markers().length,1,String(hz));assert.equal(state().stock,1);h.run('player.x=20;player.z=20');assert.equal(markers()[0].x,0);assert.equal(markers()[0].z,-8);h.run('elapsed+=2.6;updateOrdinarySkills()');assert.equal(markers().length,0);h.run('resetOrdinarySkills();backMenu()');assert.equal(event(),undefined)}
 });
 test('read only tag forecast matches actual detection predicate and restored tags keep no local authority',()=>{
  setup();const snapshot=h.run('JSON.stringify(ordinarySkills.snapshot())');assert.equal(h.run("ordinarySkills.wouldTag(ordinaryActorView(player),{type:'echo-tag',team:worker.team,x:0,y:.12,z:-8,radius:4.5},{reachable:ordinaryReachable})"),true);assert.equal(h.run('JSON.stringify(ordinarySkills.snapshot())'),snapshot);
  for(const change of["team:'blue'","alive:false","y:5"]){assert.equal(h.run("ordinarySkills.wouldTag({...ordinaryActorView(player),"+change+"},{type:'echo-tag',team:worker.team,x:0,y:.12,z:-8,radius:4.5},{reachable:ordinaryReachable})"),false)}
  step();h.run('var saved=JSON.parse(JSON.stringify(ordinarySkills.snapshot()));ordinarySkills.reset();ordinarySkills.restore(saved,elapsed,match.round)');settle();assert.equal(markers().length,0);
 });
 test('empty armed tags keep their twelve second tail and detect after the source dies without following the target',()=>{
  setup();h.run('worker.target=null;player.z=30;goal={x:0,z:-8}');step();assert.ok(event());const ends=event().endsAt;assert.ok(Math.abs(event().endsAt-event().triggerAt-12)<1e-7);h.run('worker.alive=false;ordinarySkills.resetActor(worker.id);elapsed+=2;updateOrdinarySkills()');assert.ok(event());assert.equal(markers().length,0);h.run('player.z=-8;updateOrdinarySkills()');assert.equal(markers().length,1);assert.equal(markers()[0].z,-8);
  setup();h.run('worker.target=null;player.z=30;goal={x:0,z:-8}');step();h.sandbox.tagEnd=event().endsAt;h.run('elapsed=tagEnd+1e-6;updateOrdinarySkills();player.z=-8;updateOrdinarySkills()');assert.equal(event(),undefined);assert.equal(markers().length,0);assert.ok(ends>0);
 });
 console.log(`PASS: ${groups} actual saved-game ECHO C placement groups; no audio`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
