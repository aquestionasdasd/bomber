const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{execFileSync}=require('node:child_process');
async function main({baseline=false,measure=false,only=()=>true,mutate=s=>s}={}){
 const root=__dirname,read=p=>fs.readFileSync(path.join(root,p),'utf8'),base='f913d9d8141d5d9886df6e275d0fb36a230e27cd';
 const old=p=>execFileSync('git',['show',base+':'+p],{cwd:root,encoding:'utf8'});
 const {pathToFileURL}=require('node:url'),load=p=>import(pathToFileURL(path.join(root,'public',p)).href);
 let overrides={};if(baseline){
  const rules=await import('data:text/javascript;base64,'+Buffer.from(old('public/rules.js')).toString('base64'));
  const ballistics=await import('data:text/javascript;base64,'+Buffer.from(old('public/weapon-ballistics.js').replace("import { WEAPONS } from './rules.js';",'const WEAPONS='+JSON.stringify(rules.WEAPONS)+';')).toString('base64'));overrides={...rules,...ballistics};
 }
 const template=read('tests-nope-decoy-game.cjs'),cut=template.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=template.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.gameSource").replace("Object.assign(imported, await load('abilities.js'));","Object.assign(imported, await load('abilities.js'),module.overrides);");
 const m=new Module(path.join(root,'shotgun-harness.cjs'),module);m.filename=path.join(root,'shotgun-harness.cjs');m.paths=module.paths;m.gameSource=mutate(baseline?old('public/game.js'):read('public/game.js'));m.overrides=overrides;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);
 const {harness}=await m.exports(),h=harness();let groups=0;const copy=o=>JSON.parse(JSON.stringify(o));
 h.run('var actualShotgunFire=fireArsenal,shotgunTriggers=0;fireArsenal=function(actor,...args){if(actor.id==="sg-cpu")shotgunTriggers++;return actualShotgunFire(actor,...args)}');
 function setup({id='pump',distance=8,seed=1,character=null}={}){
  h.reset();h.clearWalls();Object.assign(h.sandbox,{gunId:id,range:distance,seed,character});h.run(`
   match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='other';difficulty='hard';
   Object.assign(player,{team:'red',x:0,y:0,z:range,hp:100,armor:50,alive:true,vx:0,vz:0});
   makeBot({x:0,z:0},0,'blue',{id:'sg-cpu',team:'blue',primary:gunId,secondary:'classic',armor:50,k:0,d:0,a:0,credits:800});var worker=bots[0];worker.kit=character?new DuelistKit({character}):null;
   Object.assign(worker,{aiWeapon:gunId,aiAmmo:WEAPONS[gunId].mag,aiReserve:WEAPONS[gunId].reserve,aiReload:0,fire:0,think:0,target:null,reactionUntil:0,nextSkillAt:999});worker.group.rotation.y=0;
   var goal={x:0,y:0,z:0},watch={x:0,y:0,z:20},urgent=false,roleName='guard';updateBots.shotguns=null;updateBots.shotgunNavigation=null;
   updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,watch,role:roleName,siteId:'A',urgent}]])}}};
   shotgunTriggers=0;var rng=seed>>>0;Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);`);
 }
 const step=(dt=1/60)=>{h.sandbox.dt=dt;h.run('updatePlay(dt)');};
 const state=()=>copy(h.run('({hp:player.hp,armor:player.armor,alive:player.alive,x:worker.x,z:worker.z,y:worker.y,ammo:worker.aiAmmo,shots:shotgunTriggers,lastShotSequence:worker.shotSequence||0,yaw:worker.group.rotation.y,elapsed,mode:worker.shotgunMode,dash:worker.dashTimer||0,stock:worker.kit?.dash,phase:match.phase})'));
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name);};
 const {WEAPONS}=await load('rules.js'),{weaponDescription,shotPattern,weaponDamage}=await load('weapon-ballistics.js');
 function shotRows(){const rows=[];for(const id of ['pump','drum'])for(const range of [5,8,10,12,15,20,30])for(const moving of [false,true]){
  setup({id,distance:range});let damage=0,kills=0;for(let seq=1;seq<=12;seq++){
   Object.assign(h.sandbox,{seq,moving});h.run(`match.phase='live';Object.assign(player,{x:0,z:0,team:'blue',yaw:0,pitch:-.025,vx:moving?4:0});Object.assign(worker,{x:0,z:-range,team:'red',hp:100,armor:50,alive:true});worker.group.visible=true;worker.group.position.set(0,0,-range);inventory={primary:gunId,secondary:'classic',active:gunId};equip(gunId,true);aiming=false;shotSequence=seq-1;lastShot=-10;shoot();`);
   const s=copy(h.run('({hp:worker.hp,armor:worker.armor,alive:worker.alive,ammo:player.ammo})'));assert.equal(s.ammo,(baseline?overrides.WEAPONS:WEAPONS)[id].mag-1);damage+=150-s.hp-s.armor;kills+=!s.alive;
  }rows.push({id,distance:range,moving,patterns:12,meanEffectiveDamage:damage/12,oneShellKills:kills});
 }return rows;}
 if(measure){const shots=shotRows(),duels=[];for(const id of ['pump','drum'])for(const range of [8,19,30])for(const hz of [20,60,144]){
  setup({id,distance:range,seed:7,character:'duelist'});let firstShot=null,frames=0;const start=state().elapsed;for(let i=0;i<hz*3&&state().alive;i++){step(1/hz);frames++;if(firstShot===null&&state().shots)firstShot=state().elapsed-start;}const s=state();duels.push({id,distance:range,hz,frames,firstShotSeconds:firstShot,killSeconds:s.alive?null:s.elapsed-start,...s});
 }return{baseline,source:baseline?base:require('node:crypto').createHash('sha256').update(read('public/game.js')).digest('hex'),method:'Actual saved-game pellet rays;12 hipfire patterns per range/movement at100HP+50armor. CPU:one actual updatePlay per frame, seeded single duel,3seconds max. Not5v5 win-rate evidence; policy/random branches differ.',shots,duels};}
 test('near shotgun damage rises, spread tightens, moving penalty is smaller; rifle and airborne rules retain their role',()=>{
  assert.equal(WEAPONS.pump.body,22);assert.equal(WEAPONS.drum.body,17);assert.equal(WEAPONS.pump.interval,.8);assert.equal(WEAPONS.drum.interval,.28);
  assert.match(weaponDescription('pump'),/10m超は60%、20m超は16%/);assert.match(weaponDescription('drum'),/9m超は60%、18m超は16%/);
  assert.equal(shotPattern('pump').length,12);assert.equal(shotPattern('drum').length,10);assert.equal(weaponDamage('vandal','body',30),40);
  const radius=p=>Math.max(...p.map(o=>Math.hypot(o.x,o.y)));assert.ok(radius(shotPattern('pump',{airborne:true}))>radius(shotPattern('pump',{moving:true}))*2);
 });
 test('close real pellets eliminate heavy armor; far real pellets stay weak; one cartridge and one kill award',()=>{
  const rows=shotRows();for(const id of ['pump','drum']){assert.equal(rows.find(r=>r.id===id&&r.distance===5&&!r.moving).oneShellKills,12);assert.ok(rows.find(r=>r.id===id&&r.distance===30&&!r.moving).meanEffectiveDamage<30);}
  assert.ok(rows.find(r=>r.id==='pump'&&r.distance===8&&!r.moving).oneShellKills>=10);
 });
 test('CPU conserves shells at30m and current frontal close target gets actual torso pellets at20/60/144Hz',()=>{
  for(const hz of [20,60,144])for(const id of ['pump','drum']){
   setup({id,distance:30});for(let i=0;i<hz;i++)step(1/hz);assert.equal(state().shots,0);assert.equal(state().ammo,WEAPONS[id].mag);
   setup({id,distance:5,seed:2});for(let i=0;i<hz*2&&state().alive;i++)step(1/hz);assert.equal(state().alive,false);assert.ok(state().shots<=2);assert.equal(h.run('worker.record.k'),1);
  }
 });
 test('duelist arms then dashes along valid ground, closes12m, waits for recovery and shoots; no instant aim or wall crossing',()=>{
  for(const hz of [20,60,144]){
   setup({distance:19,character:'duelist',seed:3});let before=0,dashed=false,spentBeforeShot=false,first=null;for(let i=0;i<hz*3&&state().alive;i++){step(1/hz);const s=state();assert.ok(Math.abs(s.yaw-before)<=Math.PI*.8/hz+1e-7);before=s.yaw;dashed||=s.z>8;spentBeforeShot||=s.z>8&&!s.shots&&s.stock===0;if(s.shots&&!first)first=s;assert.ok(s.z<=12.05);}assert.ok(dashed&&spentBeforeShot);assert.ok(first&&first.z>11.9);assert.equal(state().stock,state().alive?0:1,'existing one-kill dash refill');
   setup({distance:19,character:'duelist'});h.wall({z:6,width:5});for(let i=0;i<hz;i++)step(1/hz);assert.equal(state().stock,1);assert.ok(state().z<5.5);assert.equal(state().shots,0);
  }
 });
 test('CPU selects a real corner near its guard goal, rather than a solid or remote floor',()=>{
  setup({distance:20});h.run('worker.x=-2;worker.z=1;worker.group.position.set(-2,0,1);goal={x:0,y:0,z:3}');h.wall({x:1,z:4,width:3});for(let i=0;i<30;i++)step();assert.equal(state().mode,'corner');assert.ok(state().z>1);assert.equal(state().shots,0);
 });
 test('smoke hold uses active public sphere, never grants smoke vision; expired smoke is not selected',()=>{
  setup({distance:20});h.run("goal={x:2,z:3};syncSmokes([{id:1,x:2,y:1.7,z:3,radius:3.6,kind:'smoke',expires:elapsed+8}])");for(let i=0;i<60;i++)step();assert.equal(state().mode,'smoke');assert.equal(state().shots,0);assert.equal(h.run('worker.target'),null);assert.ok(Math.hypot(state().x-2,state().z-3)<3);
  h.run('syncSmokes([]);updateBots.shotguns.reset()');step();assert.notEqual(state().mode,'smoke');
 });
 test('healthy shotgun carriers use their existing entry smoke, and reload a low magazine while no enemy is visible',()=>{
  for(const character of ['duelist','frost']){setup({distance:16,character});h.run('worker.nextSkillAt=0;worker.kit.smoke=1;worker.kit.updraft=1');for(let i=0;i<30;i++)step();assert.equal(h.run(character==='duelist'?'worker.kit.smoke':'worker.kit.updraft'),0,character);assert.equal(h.run('worker.hp'),100);}
  setup({distance:30});h.wall({z:6,width:5});h.run('worker.aiAmmo=1');step();assert.ok(h.run('worker.aiReload>0'));for(let i=0;i<240;i++)step();assert.equal(state().ammo,WEAPONS.pump.mag);assert.equal(state().shots,0);
 });
 test('urgent objectives, flash, hidden targets and guest simulation keep priority and authority',()=>{
  setup({distance:30});h.run("urgent=true;roleName='defuse';goal={x:0,z:10}");for(let i=0;i<20;i++)step();assert.ok(state().z>.5);assert.equal(state().mode,null);
  setup({distance:8});h.run('var realBlind=ordinarySkills.blindUntil;ordinarySkills.blindUntil=()=>100');for(let i=0;i<30;i++)step();assert.equal(state().shots,0);assert.equal(h.run('worker.target'),null);h.run('ordinarySkills.blindUntil=realBlind');
  // Wall/smoke checks use the actual saved game's target acquisition below.
  setup({distance:8});h.wall({z:3});for(let i=0;i<30;i++)step();assert.equal(state().shots,0);assert.equal(h.run('worker.target'),null);
  setup({distance:8});h.run("onlinePlaying=true;online={host:false,session:{memberId:'guest'},room:{code:'TEST'},send(){}};netHasSnapshot=true");for(let i=0;i<30;i++)step();assert.equal(state().shots,0);assert.equal(state().hp,100);
 });
 test('planner copies contacts, rejects stale/future knowledge, blocked ground and another floor',()=>{
  const nav={nearest:(x,z)=>({x,y:0,z}),clearSegment:()=>true,isWalkable:()=>true},collision={rayClear:()=>true};
  const factory=h.sandbox.createShotgunTactics,planner=factory({navigation:nav,collision}),known={x:0,z:20,seenAt:10},smokes=[{x:0,y:1.45,z:2,radius:3.6,expires:20}],args={bot:{id:'pure',x:0,y:0,z:0},known,smokes,now:10,round:1};
  const plan=planner.choose(args);assert.equal(plan.mode,'smoke');known.x=50;assert.equal(plan.watch.x,0,'frozen copy, not live hidden reference');assert.equal(planner.choose({...args,now:14}),null);assert.equal(planner.choose({...args,now:9}),null);
  planner.reset();nav.clearSegment=()=>false;assert.equal(planner.choose(args),null);nav.clearSegment=()=>true;nav.nearest=(x,z)=>({x,y:4,z});assert.equal(planner.choose({...args,now:11}),null);assert.equal(planner.choose({...args,role:{urgent:true}}),null);
 });
 console.log(`PASS: ${groups} shotgun actual-game groups; audio/render timers mocked; no playback`);return groups;
}
module.exports=main;if(require.main===module)main({baseline:process.argv.includes('--baseline'),measure:process.argv.includes('--measure')}).then(r=>{if(process.argv.includes('--measure'))console.log(JSON.stringify(r))}).catch(e=>{console.error(e);process.exitCode=1});
