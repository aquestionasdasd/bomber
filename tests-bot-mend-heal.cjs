const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true,baseline=false}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const m=new Module(path.join(__dirname,'mend-heal-bot-harness.cjs'),module);m.filename=path.join(__dirname,'mend-heal-bot-harness.cjs');m.paths=module.paths;m.mutateGameSource=mutate;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const{harness}=await m.exports(),h=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name)};
 function setup(distance=3){h.reset();h.clearWalls();h.sandbox.dist=distance;h.run(`difficulty='hard';match.phase='live';match.spike.status='carried';match.spike.carrier='other';
 Object.assign(player,{team:'red',x:0,y:0,z:-dist,hp:100,armor:0,alive:true,vy:0});
 makeBot({x:0,z:0},0,'blue',{id:'mend-worker',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'mend'})});
 var worker=bots[0];worker.kit.smoke=0;worker.kit.updraft=0;worker.kit.dash=1;worker.kit.ultPoints=0;
 Object.assign(worker,{hp:40,aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:999,think:1,target:player,reactionUntil:0,nextSkillAt:0});worker.group.rotation.y=Math.PI;
 var goal={x:0,z:0};updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,role:'guard',siteId:'A',urgent:false}]])}}};Math.random=()=>.5;`)}
 const step=(dt=.1)=>{h.sandbox.dt=dt;h.run('elapsed+=dt;worker.kit.tick(elapsed);updateOrdinarySkills();updateBots(dt)')};
 const event=()=>h.run("ordinarySkills.events(elapsed).find(e=>e.type==='mend-heal'&&e.sourceId===worker.id)");
 const ally=(hp=40,x=5)=>{h.sandbox.allyHP=hp;h.sandbox.allyX=x;h.run("makeBot({x:allyX,z:0},1,'blue',{id:'friend',team:'blue',secondary:'classic',kit:new DuelistKit({character:'nope'})});var friend=bots[1];friend.hp=allyHP;friend.remoteId='passive'")};
 const result=()=>({cast:!!event(),hp:h.run('worker.hp'),stock:h.run('worker.kit.dash'),points:h.run('worker.kit.ultPoints'),target:event()?.targetId||null});
 if(baseline){const rows=[];for(const d of[3,8,9]){setup(d);step();rows.push({case:'self-enemy-'+d,...result()})}setup();h.run('worker.hp=100');ally();step();rows.push({case:'ally-enemy-3',allyHP:h.run('friend.hp'),...result()});setup();h.run('worker.kit.ultPoints=7');step();rows.push({case:'E-before-X',...result()});return rows}
 test('close visible enemies no longer prevent instant self healing; E keeps sixty HP and eighteen second cooldown',()=>{
  for(const d of[1,3,6,8,9]){setup(d);step();assert.ok(event(),String(d));assert.equal(h.run('worker.hp'),100);assert.equal(h.run('worker.armor'),50);assert.equal(h.run('worker.kit.dash'),0);assert.ok(h.run('worker.kit.nextSignatureAt>=elapsed+17.99'))}
 });
 test('lowest visible injured ally receives only the missing HP and target choice is unchanged',()=>{
  setup();h.run('worker.hp=90');ally(60,17.9);step();assert.equal(event()?.targetId,'friend');assert.equal(h.run('friend.hp'),100);assert.equal(h.run('worker.hp'),90);
  setup();h.run('worker.hp=70');step();assert.equal(h.run('worker.hp'),100);
  setup();h.run('worker.hp=71');step();assert.equal(event(),undefined);assert.equal(h.run('worker.kit.dash'),1);
 });
 test('wall blocked out of range dead and enemy targets cannot spend E',()=>{
  for(const code of["friend.x=18.1","friend.alive=false","friend.team='red'","friend.hp=100"]){setup();h.run('worker.hp=100');ally();h.run(code);step();assert.equal(event(),undefined,code);assert.equal(h.run('worker.kit.dash'),1)}
  setup();h.run('worker.hp=100');ally();h.wall({x:2.5,z:0,width:1,depth:6,height:4});step();assert.equal(event(),undefined);assert.equal(h.run('friend.hp'),40);
 });
 test('ordinary healing is preferred before a seven point recovery wave at close range',()=>{
  setup();h.run('worker.kit.ultPoints=7');step();assert.ok(event());assert.equal(h.run('worker.hp'),100);assert.equal(h.run('worker.kit.ultPoints'),7);
 });
 test('full twenty event queue rolls back inventory and cooldown and uses bounded retry',()=>{
  setup();h.run("for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:player.x+1,y:.12,z:player.z+1},elapsed,match.round)");const before=h.run('JSON.stringify(worker.kit.snapshot())');step();assert.equal(event(),undefined);assert.equal(h.run('worker.hp'),40);assert.equal(h.run('JSON.stringify(worker.kit.snapshot())'),before);assert.ok(h.run('worker.nextSkillAt>=elapsed+.49'));
 });
 test('guest remote dead non-live and blind actors remain unable to use BOT healing',()=>{
  for(const code of["netHostPaused=true","onlinePlaying=true;online={host:false,session:{memberId:'friend'}}","worker.remoteId='friend'","worker.alive=false","match.phase='buy'","match.phase='post'"]){setup();h.run(code);step();assert.equal(event(),undefined,code)}
  setup();h.run("ordinarySkills.cast('nope-flash',ordinaryActorView(player),{x:0,y:1.6,z:-2},elapsed-.6,match.round);updateOrdinarySkills()");assert.ok(h.run('ordinarySkills.blindUntil(worker.id,elapsed)>elapsed'));step();assert.equal(event(),undefined);
 });
 test('existing shared skill wait and work priority are preserved',()=>{
  setup();h.run('worker.nextSkillAt=elapsed+2');step();assert.equal(event(),undefined);
  setup();h.run("match.spike.status='planted';match.spike.x=0;match.spike.z=0;match.spike.site='A';worker.team=match.defenderTeam;player.team=match.attackerTeam;updateBots.tactics.update=()=>({siteId:'A',defuserId:worker.id,roles:new Map([[worker.id,{goal:{x:0,z:0},role:'defuse',siteId:'A',urgent:true}]])})");step();assert.ok(h.run('worker.defusing'));assert.equal(event(),undefined);assert.equal(h.run('worker.hp'),40);
 });
 test('twenty sixty and one-forty-four Hz heal only once and round menu cleanup remains intact',()=>{
  for(const hz of[20,60,144]){setup();for(let i=0;i<Math.ceil(.5*hz);i++)step(1/hz);assert.equal(h.run('worker.hp'),100);assert.equal(h.run('worker.kit.dash'),0);h.run('worker.hp=40;worker.nextSkillAt=0');step(1/hz);assert.equal(h.run('worker.hp'),40);h.run('resetOrdinarySkills();backMenu()');assert.equal(event(),undefined)}
 });
 console.log(`PASS: ${groups} actual saved-game MEND E opportunity groups; no audio`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
