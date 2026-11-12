const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);let prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const m=new Module(path.join(__dirname,'cat-clock-harness.cjs'),module);m.filename=path.join(__dirname,'cat-clock-harness.cjs');m.paths=module.paths;m.mutateGameSource=mutate;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const {harness}=await m.exports(),h=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name);};
 function setup({side='attack',status='dropped',roundTime=10,timer=10,round=1,team='blue'}={}){
  h.reset();h.clearWalls();h.sandbox.cfg={side,status,roundTime,timer,round,team};h.run(`difficulty='hard';match.startingSide=cfg.side;match.round=cfg.round;match.phase='live';match.roundTime=cfg.roundTime;Object.assign(match.spike,{status:cfg.status,carrier:cfg.status==='carried'?'other':null,x:-28,z:-25,timer:cfg.timer});Object.assign(player,{team:cfg.team==='blue'?'red':'blue',x:65,z:65,hp:100,alive:true});makeBot({x:0,z:0},0,cfg.team,{id:'clock-cat',team:cfg.team,primary:'vandal',secondary:'classic',kit:new DuelistKit({character:'cat'})});var worker=bots[0];worker.kit.smoke=0;worker.kit.updraft=0;worker.kit.dash=0;worker.kit.ultPoints=7;Object.assign(worker,{aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:999,think:1,target:null,nextSkillAt:0});var goal={x:0,z:0};updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return {siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,role:'guard',siteId:'A',urgent:false}]])}}};Math.random=()=>.2;`);
 }
 const step=(dt=.1)=>{h.sandbox.dt=dt;h.run('elapsed+=dt;worker.kit.tick(elapsed);updateOrdinarySkills();updateBots(dt)');};
 const casts=()=>h.run("ordinarySkills.events(elapsed).filter(e=>e.type==='cat-clock').length");
 test('attack holds X after plant and defense holds X before plant, never extending opponent objective',()=>{
  for(const cfg of [{side:'attack',status:'planted',timer:1},{side:'defend',status:'dropped',roundTime:1},{side:'defend',status:'carried',roundTime:10}]){setup(cfg);step();assert.equal(casts(),0);assert.equal(h.run('worker.kit.ultPoints'),7);h.run('match.tick(1,{blueAlive:1,redAlive:1,clockPaused:ordinarySkills.clockFrozen(elapsed)})');assert.equal(h.run('match.phase'),cfg.timer===1||cfg.roundTime===1?'post':'live');}
 });
 test('attack uses X for late carried or dropped bomber and retains real8second freeze',()=>{
  for(const status of ['carried','dropped']){setup({status,roundTime:4});step();assert.equal(casts(),1);assert.equal(h.run('worker.kit.ultPoints'),0);h.run('var frozenAt=elapsed;match.tick(3,{blueAlive:1,redAlive:1,clockPaused:ordinarySkills.clockFrozen(elapsed)})');assert.equal(h.run('match.roundTime'),4);h.run('elapsed=frozenAt+7.99');assert.equal(h.run('ordinarySkills.clockFrozen(elapsed)'),true);h.run('elapsed=frozenAt+8.001;updateOrdinarySkills();match.tick(1,{blueAlive:1,redAlive:1,clockPaused:ordinarySkills.clockFrozen(elapsed)})');assert.equal(h.run('match.roundTime'),3);}
 });
 test('defender near deadline preserves bomber timer and permits successful7second power-off',()=>{
  setup({side:'defend',status:'planted',timer:4});step();assert.equal(casts(),1);h.run(`Object.assign(match.spike,{defuseActor:null,defuseProgress:0});for(let i=0;i<70;i++){elapsed+=.1;updateOrdinarySkills();match.interactDefuse(.1,{actorId:worker.id,team:worker.team,near:true,stationary:true});match.tick(.1,{blueAlive:1,redAlive:1,clockPaused:ordinarySkills.clockFrozen(elapsed)});}`);assert.equal(h.run('match.spike.status'),'defused');assert.equal(h.run('match.lastRound.team'),h.run('worker.team'));
  setup({side:'defend',status:'planted',timer:4});h.run('worker.kit.ultPoints=0');step();h.run(`for(let i=0;i<45&&match.phase==='live';i++){elapsed+=.1;match.interactDefuse(.1,{actorId:worker.id,team:worker.team,near:true,stationary:true});match.tick(.1,{blueAlive:1,redAlive:1,clockPaused:false});}`);assert.equal(h.run('match.spike.status'),'detonated');
 });
 test('early windows, resolved objective, invalid team, dead actor and non-live phase conserve points',()=>{
  for(const cfg of [{roundTime:20},{roundTime:80},{roundTime:0},{status:'defused'},{status:'detonated'},{side:'defend',status:'planted',timer:12.01},{side:'defend',status:'planted',timer:0}]){setup(cfg);step();assert.equal(casts(),0,JSON.stringify(cfg));assert.equal(h.run('worker.kit.ultPoints'),7);}
  for(const code of ["worker.team='invalid'","worker.alive=false","match.phase='buy'","match.phase='post'"]){setup();h.run(code);assert.equal(h.run('catBotClockUseful(worker)'),false);}
 });
 test('dynamic sides cover both teams, halftime and overtime rather than hardcoded BLUE',()=>{
  for(const round of [1,13,25,26])for(const side of ['attack','defend'])for(const team of ['blue','red']){setup({side,round,team});const attacking=h.run('worker.team===match.attackerTeam');h.run(`match.spike.status=${attacking?"'dropped'":"'planted'"};match.spike.timer=12`);step();assert.equal(casts(),1,[round,side,team].join('/'));}
 });
 test('bounded retry, insufficient points, existing clock and full20event rollback do not spam stock',()=>{
  setup();h.run('worker.kit.ultPoints=6');step();assert.equal(casts(),0);
  setup();h.run("ordinarySkills.cast('cat-clock',ordinaryActorView(player),{x:player.x,y:0,z:player.z},elapsed,match.round)");step();assert.equal(casts(),1);assert.equal(h.run('worker.kit.ultPoints'),7);
  setup();h.run("for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:65,y:0,z:45},elapsed,match.round)");step();assert.equal(h.run('worker.kit.ultPoints'),7);assert.ok(h.run('worker.nextSkillAt>elapsed'));assert.equal(h.run('ordinarySkills.events(elapsed).length'),20);
 });
 test('host-only decision and round/menu cleanup leave no frozen clock',()=>{
  setup();h.run("onlinePlaying=true;online={host:false,session:{memberId:'friend'}}");step();assert.equal(casts(),0);assert.equal(h.run('worker.kit.ultPoints'),7);
  setup();step();assert.equal(casts(),1);h.run('resetOrdinarySkills()');assert.equal(casts(),0);assert.equal(h.run('ordinarySkills.clockFrozen(elapsed)'),false);h.run('backMenu()');assert.equal(casts(),0);
 });
 console.log(`PASS: ${groups} actual saved-game CAT objective clock decision groups; no playback`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
