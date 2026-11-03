const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const m=new Module(path.join(__dirname,'ember-solder-bot-harness.cjs'),module);m.filename=path.join(__dirname,'ember-solder-bot-harness.cjs');m.paths=module.paths;m.mutateGameSource=mutate;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const{harness}=await m.exports(),h=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name)};
 function setup(distance=16){h.reset();h.clearWalls();h.sandbox.dist=distance;h.run(`difficulty='hard';match.phase='live';match.spike.status='carried';match.spike.carrier='other';
 Object.assign(player,{team:'red',x:0,y:0,z:-dist,hp:100,armor:0,alive:true});
 makeBot({x:0,z:0},0,'blue',{id:'ember-worker',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'ember'})});
 var worker=bots[0];worker.kit.smoke=2;worker.kit.updraft=0;worker.kit.dash=0;worker.kit.ultPoints=0;
 Object.assign(worker,{aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:999,think:1,target:player,reactionUntil:0,nextSkillAt:0});worker.group.rotation.y=Math.PI;
 var goal={x:0,z:0};updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,role:'guard',siteId:'A',urgent:false}]])}}};Math.random=()=>.5;`)}
 const step=(dt=.1)=>{h.sandbox.dt=dt;h.run('elapsed+=dt;worker.kit.tick(elapsed);updateOrdinarySkills();updateBots(dt)')};
 const event=()=>h.run("ordinarySkills.events(elapsed).find(e=>e.type==='ember-solder')");
 test('full eighteen metre opportunity and close fights use C without changing human range or damage',()=>{
  for(const distance of[1.5,14.1,16,18]){setup(distance);step();assert.ok(event(),String(distance));assert.equal(h.run('worker.kit.smoke'),1);assert.ok(Math.abs(event().z+distance)<1e-8)}
  setup(18.01);step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.smoke'),2);
  setup(16);step();h.run('elapsed+=.65;updateOrdinarySkills()');assert.equal(h.run('player.hp'),25);assert.equal(h.run('worker.hp'),100);
 });
 test('clipped wall and wrong landing floor conserve C instead of throwing harmlessly',()=>{
  setup(16);h.run('worker.target=null;worker.lastSeen={id:player.id,team:player.team,x:0,z:-16,seenAt:elapsed}');h.wall({z:-8,width:30,height:3});step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.smoke'),2);
  setup(16);h.run('player.y=4');step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.smoke'),2);
 });
 test('a valid lob onto low cover is kept when its real burst can reach the visible enemy',()=>{
  setup(10);h.wall({z:-9.5,width:10,height:1});step();assert.equal(h.run('worker.target'),h.run('player'));assert.ok(event());assert.equal(h.run('worker.kit.smoke'),1);h.run('elapsed+=.65;updateOrdinarySkills()');assert.ok(h.run('player.hp')<100);
 });
 test('sight loss uses only fixed recent memory and never follows hidden current position',()=>{
  setup(16);h.run('worker.target=null;worker.lastSeen={id:player.id,team:player.team,x:0,z:-16,seenAt:elapsed};player.x=30;player.z=30');step();assert.ok(event());assert.equal(event().x,0);assert.equal(event().z,-16);
  setup(16);h.run('worker.target=null;worker.lastSeen={id:player.id,team:player.team,x:0,z:-16,seenAt:elapsed-1.01};player.z=30');step();assert.equal(event(),undefined);
  setup(16);h.run('worker.target=null;worker.lastSeen=null;player.z=30');step();assert.equal(event(),undefined);
 });
 test('blind smoke and host pause do not turn into through-cover current-position casts',()=>{
  setup(16);h.run("ordinarySkills.cast('nope-flash',ordinaryActorView(player),{x:0,y:1.6,z:-2},elapsed-.6,match.round)");h.run('worker.group.rotation.y=Math.PI;updateOrdinarySkills()');assert.ok(h.run('ordinarySkills.blindUntil(worker.id,elapsed)>elapsed'));step();assert.equal(event(),undefined);
  setup(16);h.run("ordinarySkills.cast('frost-mist',ordinaryActorView(player),{x:0,y:1.4,z:-8},elapsed-.6,match.round)");step();assert.equal(event(),undefined);
  setup(16);h.run('netHostPaused=true');step();assert.equal(event(),undefined);
 });
 test('full event queue rolls back stock and preserves bounded existing retry',()=>{
  setup(16);h.run("for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:player.x+1,y:.12,z:player.z+1},elapsed,match.round)");assert.equal(h.run('ordinarySkills.events(elapsed).length'),20);step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.smoke'),2);assert.ok(h.run('worker.nextSkillAt>=elapsed+.39'));assert.equal(h.run('ordinarySkills.events(elapsed).length'),20);
 });
 test('guest remote dead busy and next round never autonomously spend C',()=>{
  for(const code of["onlinePlaying=true;online={host:false,session:{memberId:'friend'}}","worker.remoteId='friend'","worker.alive=false","match.phase='buy'","match.phase='post'"]){setup(16);h.run(code);step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.smoke'),2)}
  setup(16);h.run('worker.serviceReload={weaponId:worker.aiWeapon,endsAt:elapsed+1,round:match.round};worker.nextSkillAt=elapsed+1');step();assert.equal(event(),undefined);
  setup(16);step();h.run('resetOrdinarySkills();backMenu()');assert.equal(event(),undefined);
 });
 test('twenty sixty and one-forty-four Hz agree on actual stationary burst and stock',()=>{
  for(const hz of[20,60,144]){setup(16);for(let i=0;i<Math.ceil(.8*hz);i++)step(1/hz);assert.equal(h.run('player.hp'),25,String(hz));assert.equal(h.run('worker.kit.smoke'),1)}
 });
 console.log(`PASS: ${groups} actual saved-game EMBER C opportunity and reachable landing groups; no audio`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
