const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{execFileSync}=require('node:child_process');
async function main({mutate=s=>s,only=()=>true,measure=false,baseline=false}={}){
 const root=__dirname,base='4157d3080e4314a80db476d11648ae11faf82f31',read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const source=mutate(baseline?execFileSync('git',['show',base+':public/game.js'],{cwd:root,encoding:'utf8'}):read('public/game.js'));
 const template=read('tests-nope-decoy-game.cjs'),cut=template.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=template.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.gameSource");
 const m=new Module(path.join(root,'sniper-harness.cjs'),module);m.filename=path.join(root,'sniper-harness.cjs');m.paths=module.paths;m.gameSource=source;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);
 const {harness}=await m.exports(),h=harness();let groups=0;const copy=o=>JSON.parse(JSON.stringify(o)),test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name);};
 h.run(`var sniperShots=[],actualSniperFire=fireArsenal,savedScopeBlind=ordinarySkills.blindUntil,savedScopeSight=ordinarySkills.sightRange,savedScopeLock=ordinarySkills.capLocked;
 fireArsenal=function(actor,from,aim,spec,ads,...rest){const before=player.hp,result=actualSniperFire(actor,from,aim,spec,ads,...rest);if(actor.id==='scope-cpu')sniperShots.push({weapon:actor.aiWeapon,ads,moving:actor.moving,at:elapsed,since:actor.sniperAdsSince??null,ammo:actor.aiAmmo,damage:before-player.hp,pattern:shotPattern(actor.aiWeapon,{ads,moving:actor.moving,airborne:!actorGrounded(actor),sequence:actor.shotSequence})});return result;};`);
 function setup({weapon='scout',range=28,seed=1}={}){h.reset();h.clearWalls();Object.assign(h.sandbox,{testSniperWeapon:weapon,range,seed});h.run(`
  ordinarySkills.blindUntil=savedScopeBlind;ordinarySkills.sightRange=savedScopeSight;ordinarySkills.capLocked=savedScopeLock;
  match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='other';difficulty='hard';
  Object.assign(player,{team:'red',x:0,y:0,z:range,hp:10000,armor:0,alive:true,vx:0,vz:0,vy:0});
  makeBot({x:0,z:0},0,'blue',{id:'scope-cpu',team:'blue',primary:testSniperWeapon,secondary:'classic',armor:50});var worker=bots[0];worker.kit=null;
  Object.assign(worker,{aiWeapon:testSniperWeapon,aiAmmo:WEAPONS[testSniperWeapon].mag,aiReserve:WEAPONS[testSniperWeapon].reserve,aiReload:0,fire:0,think:0,target:null,reactionUntil:0,nextSkillAt:999});worker.group.rotation.y=0;
  var goal={x:0,y:0,z:0},watch={x:0,y:0,z:28},urgent=false,roleName='guard';
  updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,watch,role:roleName,siteId:'A',urgent}]])}}};
  sniperShots=[];var rng=seed>>>0;Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);`);}
 const step=(seconds,hz=60)=>{h.sandbox.duration=seconds;h.sandbox.hz=hz;h.run('for(let t=0;t<duration-1e-8;t+=1/hz)updatePlay(Math.min(1/hz,duration-t))');};
 const state=()=>copy(h.run('({x:worker.x,z:worker.z,y:worker.y,yaw:worker.group.rotation.y,ads:worker.sniperAds??false,since:worker.sniperAdsSince??null,ammo:worker.aiAmmo,reload:worker.aiReload,target:worker.target?.id??null,elapsed,hp:player.hp,shots:sniperShots,phase:match.phase})'));
 if(measure){const controls=[];for(const weapon of['scout','atlas'])for(const hz of[20,60,144]){setup({weapon});h.run('goal={x:0,y:0,z:24}');step(2.6,hz);controls.push({weapon,hz,...state()});}return{baseline,sourceSHA:require('node:crypto').createHash('sha256').update(source).digest('hex'),frame:'actual updatePlay once/frame',fixture:'single scoped CPU, fixed visible silent target 28m, guard goal24m, no skills; real firearm raycasts',controls,limitations:['controlled fixture, not ordinary 5v5 win rate','rendering and audio inert; no browser, devices or listening']};}
 test('SCOUT and ATLAS stop, acquire ADS and use the real scoped bullet cone at20/60/144Hz',()=>{
  for(const weapon of['scout','atlas'])for(const hz of[20,60,144]){setup({weapon});h.run('goal={x:0,y:0,z:24}');step(2.6,hz);const s=state();assert.ok(s.shots.length>=2,JSON.stringify(s));assert.ok(Math.hypot(s.x,s.z)<.01,'visible long contact must hold position');assert.equal(s.ads,true);for(const shot of s.shots){assert.equal(shot.ads,true);assert.equal(shot.moving,false);assert.ok(shot.at-shot.since>=.2-1e-8);assert.ok(Math.hypot(shot.pattern[0].x,shot.pattern[0].y)<.001);}assert.ok(s.hp<10000,'real damage');for(let i=1;i<s.shots.length;i++)assert.ok(s.shots[i].at-s.shots[i-1].at>=(weapon==='scout'?1.1:1.6)-1e-8,'normal bolt interval');}
 });
 test('stationary public watch lines scope before contact and do not fire at a hidden actor',()=>{
  setup();h.run('player.z=-28');step(.5);let s=state();assert.equal(s.ads,true);assert.equal(s.target,null);assert.equal(s.shots.length,0);const since=s.since;
  h.run('player.x=22;player.z=-28');step(.1);s=state();assert.equal(s.since,since);assert.equal(s.yaw,0,'hidden current coordinates never steer hold');
  h.run('player.x=0;player.z=28;worker.think=0');step(.05);assert.equal(state().shots.length,0,'existing reaction wait');step(.5);assert.equal(state().shots[0].ads,true);
 });
 test('finite144degree body turn precedes scope acquisition without snap aim',()=>{
  for(const hz of[20,60,144]){setup();h.run('worker.group.rotation.y=.8;worker.fire=999');const old=state().yaw;step(1/hz,hz);const s=state();assert.ok(Math.abs(s.yaw-old)<=Math.PI*.8/hz+1e-8);assert.equal(s.ads,false);assert.equal(s.since,null);step(.6,hz);assert.equal(state().ads,true);}
 });
 test('urgent movement and carrier travel take priority; scoped guns never hipfire while advancing',()=>{
  for(const carrier of[false,true]){setup();h.sandbox.carrier=carrier;h.run("goal={x:0,y:0,z:24};urgent=!carrier;if(carrier){match.spike.carrier=worker.id;roleName='plant'}");step(.5);const s=state();assert.ok(Math.hypot(s.x,s.z)>1,'objective travel continues '+JSON.stringify({carrier,...s}));assert.equal(s.ads,false);assert.equal(s.shots.length,0);}
  setup();h.run('player.z=-28;goal={x:0,y:0,z:24}');step(.5);assert.ok(state().z>1,'no contact must not freeze spawn');assert.equal(state().ads,false);
 });
 test('wall, smoke, blindness, nearsight and scope lock preserve perception and suppress shots',()=>{
  for(const kind of['wall','smoke','blind','near','lock']){setup();if(kind==='wall')h.wall({z:14,width:30});if(kind==='smoke')h.run("syncSmokes([{id:1,x:0,y:1.5,z:14,expires:elapsed+5}])");if(kind==='blind')h.run('ordinarySkills.blindUntil=()=>100');if(kind==='near')h.run('ordinarySkills.sightRange=()=>8');if(kind==='lock')h.run('ordinarySkills.capLocked=()=>true');step(.7);assert.equal(state().shots.length,0,kind);if(kind==='blind'||kind==='lock')assert.equal(state().ads,false);}
 });
 test('movement, reload, flight and skill use clear ADS and require reacquisition',()=>{
  for(const kind of['move','reload','air','skill']){setup();h.run('worker.fire=999');step(.4);assert.equal(state().ads,true);h.sandbox.kind=kind;h.run("if(kind==='move'){goal={x:0,y:0,z:24};urgent=true;}if(kind==='reload')worker.aiReload=1;if(kind==='air'){worker.y=3;worker.vy=1;}if(kind==='skill')worker.skillThrowUntil=elapsed+1");step(1/60);assert.equal(state().ads,false,kind);assert.equal(state().since,null,kind);h.run('urgent=false;goal={x:worker.x,y:0,z:worker.z};worker.aiReload=0;worker.y=0;worker.vy=0;worker.skillThrowUntil=0');step(1/60);assert.equal(state().ads,true);assert.ok(state().elapsed-state().since<.02);}
 });
 test('empty magazines reload normally and scope returns without duplicating ammo',()=>{
  for(const weapon of['scout','atlas']){setup({weapon});h.run('worker.aiAmmo=0');step(.6);assert.ok(state().reload>0);assert.equal(state().ads,false);assert.equal(state().shots.length,0);step(4.4);assert.ok(state().shots.length>0);assert.ok(state().shots.every(s=>s.ads));assert.ok(state().ammo<5);}
 });
 test('death, nonlive, remote authority and weapon changes clear scope state',()=>{
  for(const kind of['death','round','remote','weapon']){setup();h.run('worker.fire=999');step(.4);assert.equal(state().ads,true);h.sandbox.kind=kind;h.run("if(kind==='death')worker.alive=false;if(kind==='round')match.phase='buy';if(kind==='remote')worker.remoteId='remote-player';if(kind==='weapon')worker.record.primary='vandal'");step(1/60);assert.equal(state().ads,false,kind);assert.equal(state().since,null,kind);}
 });
 test('visible robot targets use scoped real raycasts too',()=>{
  setup();h.run(`Math.random=()=>.3;player.x=60;player.z=-60;player.kit=new DuelistKit({character:'ember'});var squad=robotArmy.deploy(player,'x',0,{x:0,y:0,z:12,flight:.01},elapsed,match.round,robotWorld());robotArmy.update(elapsed+.02,match.round,[player,worker],robotWorld());var unit=robotArmy.units().find(u=>u.type==='bomb');for(const u of robotArmy.units())if(u!==unit)u.endsAt=elapsed+.001;Object.assign(unit,{x:0,y:0,z:12,thinkAt:999,fireAt:999,endsAt:elapsed+20,target:null,memory:null});`);step(1.1);const s=state();assert.ok(s.shots.length>0);assert.ok(s.shots.every(s=>s.ads&&!s.moving));assert.equal(h.run('robotArmy.units().some(u=>u.id===unit.id)'),false,'actual robot destroyed '+h.run('JSON.stringify({hp:unit.hp,shots:sniperShots,target:worker.robotTarget?.id,unit:unit.id})'));
 });
 test('ordinary rifle firing and movement remain available',()=>{
  setup({weapon:'vandal'});h.run('goal={x:0,y:0,z:24}');step(.6);const s=state();assert.ok(s.z>1);assert.ok(h.run('(worker.shotSequence||0)>0'));assert.equal(s.ads,false);assert.ok(s.ammo<25);
 });
 test('a visible decoy receives scoped fire without changing actual enemy intelligence',()=>{
  setup();h.run('player.x=60;player.z=-60;Math.random=()=>.3');h.seed('red',0,12);step(.9);const s=state();assert.equal(s.target,null);assert.ok(s.shots.length>0);assert.ok(s.shots.every(s=>s.ads&&!s.moving));assert.equal(h.run('allNopeDecoys().length'),0);assert.equal(h.run('worker.lastSeen'),null);
 });
 console.log(groups+' CPU sniper groups passed');return{groups};
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
