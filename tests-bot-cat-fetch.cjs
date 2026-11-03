const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true,baseline=false}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const m=new Module(path.join(__dirname,'cat-fetch-bot-harness.cjs'),module);m.filename=path.join(__dirname,'cat-fetch-bot-harness.cjs');m.paths=module.paths;m.mutateGameSource=mutate;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const{harness}=await m.exports(),h=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name)};
 function setup(weapon='classic',ammo=null,reserve=null){h.reset();h.clearWalls();h.sandbox.initialWeapon=weapon;h.sandbox.initialAmmo=ammo;h.sandbox.initialReserve=reserve;h.run(`difficulty='hard';match.phase='live';match.spike.status='carried';match.spike.carrier='other';
 Object.assign(player,{team:'red',x:40,y:0,z:40,hp:100,armor:0,alive:true});
 makeBot({x:0,z:0},0,'blue',{id:'cat-worker',team:'blue',primary:WEAPONS[initialWeapon].slot==='primary'?initialWeapon:null,secondary:WEAPONS[initialWeapon].slot==='secondary'?initialWeapon:'classic',armor:50,kit:new DuelistKit({character:'cat'})});
 var worker=bots[0];worker.kit.smoke=0;worker.kit.updraft=0;worker.kit.dash=1;worker.kit.ultPoints=0;
 Object.assign(worker,{aiWeapon:initialWeapon,aiAmmo:initialAmmo??WEAPONS[initialWeapon].mag,aiReserve:initialReserve??WEAPONS[initialWeapon].reserve,aiReload:0,fire:999,think:1,target:null,reactionUntil:0,nextSkillAt:0});
 var goal={x:0,z:0};updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,role:'guard',siteId:'A',urgent:false}]])}}};Math.random=()=>.5;`)}
 const step=(dt=.1)=>{h.sandbox.dt=dt;h.run('elapsed+=dt;worker.kit.tick(elapsed);updateOrdinarySkills();updateBots(dt)')};
 function drop(id,weapon,x,z,ammo=null,reserve=null){h.sandbox.dropData={id,weapon,x,z,yaw:0,ammo:ammo??h.run(`WEAPONS['${weapon}'].mag`),reserve:reserve??h.run(`WEAPONS['${weapon}'].reserve`)};h.run('addDrop(dropData)')}
 const copy=x=>JSON.parse(JSON.stringify(x));
 const state=()=>copy(h.run('({weapon:worker.aiWeapon,ammo:worker.aiAmmo,reserve:worker.aiReserve,stock:worker.kit.dash,events:ordinarySkills.events(elapsed).filter(e=>e.type===\'cat-fetch\').length,drops:serializeDrops()})'));
 if(baseline){const rows=[];setup('vandal');drop(101,'ghost',0,-8);step();rows.push({case:'loaded rifle versus cheaper sidearm',...state()});setup();drop(101,'vandal',0,-8);h.wall({z:-4,width:2});drop(102,'phantom',8,0);step();rows.push({case:'occluded first drop then visible upgrade',...state()});setup();drop(101,'vandal',0,-8,0,75);step();rows.push({case:'empty dropped rifle',...state()});return rows}
 test('loaded rifle never downgrades to weaker primary or switches to sidearm',()=>{
  for(const weapon of['ghost','spectre','pump','phantom']){setup('vandal');drop(101,weapon,0,-8);step();assert.equal(state().weapon,'vandal',weapon);assert.equal(state().stock,1);assert.equal(state().events,0)}
 });
 test('occluded first drop does not starve another actually visible upgrade',()=>{
  setup();drop(101,'vandal',0,-8);h.wall({z:-4,width:2});drop(102,'phantom',8,0);step();assert.equal(state().weapon,'phantom');assert.equal(state().ammo,30);assert.equal(state().stock,0);assert.ok(state().drops.some(d=>d.id===101));
 });
 test('best usable gun and exact first aim intercept agree independent of insertion order',()=>{
  for(const reverse of[false,true]){setup();const data=[[101,'spectre',0,-5],[102,'vandal',0,-10],[103,'phantom',8,0]];for(const d of reverse?data.reverse():data)drop(...d);step();assert.equal(state().weapon,'phantom');assert.equal(state().events,1)}
  setup();drop(101,'spectre',0,-5);drop(102,'vandal',0,-10);step();assert.equal(state().weapon,'spectre');
  setup('vandal');drop(101,'ghost',0,-5);drop(102,'atlas',0,-10);step();assert.equal(state().weapon,'vandal');assert.equal(state().stock,1);
 });
 test('empty drops conserve E and same-gun magazine improvement conserves actual ammunition',()=>{
  setup();drop(101,'vandal',0,-8,0,75);step();assert.equal(state().weapon,'classic');assert.equal(state().stock,1);
  setup('vandal',4,40);drop(101,'vandal',0,-8,11,23);step();assert.equal(state().stock,1); // Lower total ammunition is not an upgrade.
  setup('vandal',4,20);drop(101,'vandal',0,-8,11,23);step();assert.equal(state().weapon,'vandal');assert.equal(state().ammo,11);assert.equal(state().reserve,23);assert.equal(state().drops.length,1);assert.equal(state().drops[0].ammo,4);assert.equal(state().drops[0].reserve,20);
 });
 test('true range crouched aim smoke flash and wall obey the human fetch target rules',()=>{
  setup();h.run('worker.crouch=1');drop(101,'vandal',0,-18);step();assert.equal(state().weapon,'vandal');
  setup();h.run('worker.y=5');drop(101,'vandal',0,-17.5);step();assert.equal(state().stock,1);
  for(const kind of['wall','smoke','flash']){setup();drop(101,'vandal',0,-8);if(kind==='wall')h.wall({z:-4,width:20});else h.run(kind==='smoke'?"syncSmokes([{id:1,kind:'smoke',x:0,y:1.4,z:-4,radius:3.6,expires:100}])":"player.x=0;player.z=-4;ordinarySkills.cast('nope-flash',ordinaryActorView(player),{x:0,y:1.6,z:-2},elapsed-.6,match.round);worker.group.rotation.y=Math.PI;updateOrdinarySkills();player.x=40;player.z=40");step();assert.equal(state().stock,1,kind)}
 });
 test('full event queue preserves weapon drops cooldown stock and bounded retry',()=>{
  setup();drop(101,'vandal',0,-8);h.run("for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:player.x+1,y:.12,z:player.z+1},elapsed,match.round)");assert.equal(h.run('ordinarySkills.events(elapsed).length'),20);step();assert.equal(state().stock,1);assert.equal(state().weapon,'classic');assert.equal(state().drops.length,1);assert.ok(h.run('worker.nextSkillAt>=elapsed+.49'));assert.equal(h.run('worker.kit.nextSignatureAt'),0);
 });
 test('host-only idle policy respects enemy reload and round lifecycle',()=>{
  for(const code of["onlinePlaying=true;online={host:false,session:{memberId:'friend'}}","worker.remoteId='friend'","worker.alive=false","match.phase='buy'","match.phase='post'","netHostPaused=true","worker.aiReload=1"]){setup();drop(101,'vandal',0,-8);h.run(code);step();assert.equal(state().stock,1,code)}
  setup();drop(101,'vandal',0,-8);h.run('worker.serviceReload={weaponId:worker.aiWeapon,endsAt:elapsed+1,round:match.round}');assert.equal(h.run('catBotFetchAim(worker)'),null);
  setup();drop(101,'vandal',0,-8);h.run('player.x=0;player.z=-12;worker.target=player');step();assert.equal(state().stock,1);
  setup();drop(101,'vandal',0,-8);step();h.run('resetOrdinarySkills();backMenu()');assert.equal(h.run('ordinarySkills.events(elapsed).length'),0);
 });
 test('human can still choose an intentional sidearm swap with conserved magazines',()=>{
  setup('vandal');h.run("Object.assign(player,{x:0,z:0,team:'blue'});player.kit=new DuelistKit({character:'cat'});inventory.primary='vandal';equip('vandal',true)");drop(101,'ghost',0,-8,7,19);assert.ok(h.run("activateAbility(player,'e',{aim:{yaw:0,pitch:Math.atan2(-1.5,8)}})"));assert.equal(h.run('inventory.active'),'ghost');assert.equal(h.run('player.ammo'),7);assert.equal(h.run('player.reserve'),19);
 });
 test('twenty sixty and one-forty-four Hz spend once and keep eighteen second cooldown',()=>{for(const hz of[20,60,144]){setup();drop(101,'vandal',0,-8);step(1/hz);assert.equal(state().events,1);for(let i=1;i<Math.ceil(.8*hz);i++)step(1/hz);assert.equal(state().weapon,'vandal');assert.equal(state().stock,0);assert.ok(h.run('worker.kit.nextSignatureAt>elapsed+17'));}});
 console.log(`PASS: ${groups} actual saved-game CAT E selection groups; no audio`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
