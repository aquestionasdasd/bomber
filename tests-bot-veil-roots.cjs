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
 const step=(dt=.1)=>{h.sandbox.dt=dt;h.run('elapsed+=dt;worker.kit.tick(elapsed);updateOrdinarySkills();updateBots(dt)')};
 const event=()=>h.run("ordinarySkills.events(elapsed).find(e=>e.type==='veil-root-seed'&&e.sourceId===worker.id)");
 const slow=()=>h.run('ordinarySkills.speedScale(ordinaryActorView(player),elapsed,{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})');
 const result=()=>({cast:!!event(),stock:h.run('worker.kit.updraft'),scale:slow()});
 if(baseline){const rows=[];for(const d of[1,8]){setup(d);step();h.run('elapsed+=.86;updateOrdinarySkills()');rows.push({case:'flat-'+d,...result()})}setup();h.run('player.y=3;player.vy=1');step();h.run('elapsed+=.86;updateOrdinarySkills()');rows.push({case:'airborne',...result()});setup();h.wall({z:-4,width:20,height:1});step();h.run('elapsed+=.86;updateOrdinarySkills()');rows.push({case:'low-wall',...result()});return rows}
 test('close and full twenty metre grounded opportunities produce the real forty-five percent movement scale',()=>{
  for(const d of[.5,1,2,8,10,20]){setup(d);step();assert.ok(event(),String(d));assert.equal(h.run('worker.kit.updraft'),0);assert.equal(slow(),1);h.run('elapsed+=.86;updateOrdinarySkills()');assert.equal(slow(),.45,String(d))}
  setup(20.01);step();assert.equal(event(),undefined);
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
  setup();h.run("ordinarySkills.cast('veil-roots',{...ordinaryActorView(worker),id:'friend',x:-3,z:-8},{x:3,y:0,z:-8},elapsed-.3,match.round)");step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.updraft'),1);
 });
 test('full queue preserves stock and bounded retry while guest remote dead busy and blind remain inactive',()=>{
  setup();h.run("for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:player.x+1,y:.12,z:player.z+1},elapsed,match.round)");step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.updraft'),1);assert.ok(h.run('worker.nextSkillAt>=elapsed+.49'));
  for(const code of["netHostPaused=true","onlinePlaying=true;online={host:false,session:{memberId:'friend'}}","worker.remoteId='friend'","worker.alive=false","match.phase='buy'","match.phase='post'","worker.y=2;worker.vy=1"]){setup();h.run(code);step();assert.equal(event(),undefined,code)}
  setup();h.run("ordinarySkills.cast('nope-flash',ordinaryActorView(player),{x:0,y:1.6,z:-2},elapsed-.6,match.round);updateOrdinarySkills()");assert.ok(h.run('ordinarySkills.blindUntil(worker.id,elapsed)>elapsed'));step();assert.equal(event(),undefined);
 });
 test('twenty sixty and one-forty-four Hz keep arming lifetime airborne counter and round cleanup',()=>{
  for(const hz of[20,60,144]){setup();for(let i=0;i<Math.ceil(1*hz);i++)step(1/hz);assert.equal(slow(),.45,String(hz));h.run('player.y=.6;player.vy=1');assert.equal(slow(),1);h.run('player.y=0;player.vy=0');assert.equal(slow(),.45);h.run('elapsed+=8.1;updateOrdinarySkills()');assert.equal(slow(),1);h.run('resetOrdinarySkills();backMenu()');assert.equal(event(),undefined)}
 });
 test('floor forecast is read-only and matches actual restored field movement without hit authority',()=>{
  setup();const snapshot=h.run('JSON.stringify(ordinarySkills.snapshot())');assert.equal(h.run("ordinarySkills.wouldRoot(ordinaryActorView(player),{type:'veil-roots',team:worker.team,fromX:0,fromY:0,fromZ:0,x:0,y:0,z:-8,radius:1.6},{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})"),true);assert.equal(h.run('JSON.stringify(ordinarySkills.snapshot())'),snapshot);
  step();h.run('var saved=JSON.parse(JSON.stringify(ordinarySkills.snapshot()));ordinarySkills.reset();ordinarySkills.restore(saved,elapsed,match.round);elapsed+=.86');assert.equal(slow(),.45);assert.equal(h.run('ordinarySkills.wouldRoot(ordinaryActorView(player),{type:"veil-roots",team:"blue",fromX:0,fromY:0,fromZ:0,x:0,y:0,z:0,radius:1.6},{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})'),false);
 });
 console.log(`PASS: ${groups} actual saved-game VEIL Q thrown-band opportunity groups; no audio`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
