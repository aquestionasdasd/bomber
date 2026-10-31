const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true,measure=false}={}){
 const gameSHA=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'public/game.js'))).digest('hex');
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const m=new Module(path.join(__dirname,'elite-aim-harness.cjs'),module);m.filename=path.join(__dirname,'elite-aim-harness.cjs');m.paths=module.paths;m.mutateGameSource=mutate;
 m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const{harness}=await m.exports(),h=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name)},copy=x=>JSON.parse(JSON.stringify(x));
 function setup({seed=1,x=0,z=20,yaw=0}={}){h.reset();h.clearWalls();Object.assign(h.sandbox,{seed,x,z,yaw});h.run(`
 difficulty='hard';match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='other';
 Object.assign(player,{team:'red',x,y:0,z,hp:100,armor:50,alive:true});
 makeBot({x:0,z:0},0,'blue',{id:'elite-shooter',team:'blue',primary:'vandal',secondary:'classic',armor:50});var worker=bots[0];worker.kit=null;
 Object.assign(worker,{aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:0,think:0,target:null,reactionUntil:0,nextSkillAt:999});worker.group.rotation.y=yaw;
 var goal={x:0,z:0},urgent=false,watch=null;
 updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,watch,role:'guard',siteId:'A',urgent}]])}}};
 var rng=seed>>>0;Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);`)}
 function step(dt=1/60){h.sandbox.dt=dt;h.run('updatePlay(dt)')}
 const state=()=>copy(h.run('({hp:player.hp,armor:player.armor,alive:player.alive,yaw:worker.group.rotation.y,ammo:worker.aiAmmo,shots:worker.shotSequence||0,target:worker.target?.id,elapsed,phase:match.phase,x:worker.x,z:worker.z})'));
 function duel(seed,moving=false){setup({seed});let firstShot=null;const start=h.run('elapsed');for(let i=0;i<600&&h.run('player.alive');i++){
   if(moving){h.sandbox.t=i/60;h.run('player.x=Math.sin(t*2)*3')}
   step();if(firstShot===null&&state().ammo<25)firstShot=h.run('elapsed')-start;
  }const s=state();return{seed,moving,firstShot,killSeconds:s.alive?null:s.elapsed-start,hp:s.hp,armor:s.armor,ammo:s.ammo}}
 if(measure){const duels=[];for(const moving of[false,true])for(let seed=1;seed<=12;seed++)duels.push(duel(seed,moving));
  setup({z:-20});h.run('goal={x:0,z:-30};urgent=true');step();const navigationYaw=state().yaw;
  return{gameSHA,frame:'actual updatePlay once per 1/60 second',fixture:'one Vandal BOT versus 100HP/50armor silent human target at20m; no skills; fixed role on flat saved-game fixture; strafe = sinusoid3m*2rad/s',navigationFirstFrameYaw:navigationYaw,duels};}
 test('elite only title has no difficulty control and stale values cannot downgrade combat',()=>{
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8'),/<select[^>]+id="difficulty"/);
  const rows=[];for(const level of['easy','normal','hard']){setup({seed:3});h.sandbox.level=level;h.run('difficulty=level');for(let i=0;i<60;i++)step();const s=state();rows.push([s.hp,s.armor,s.ammo,s.yaw])}assert.deepEqual(rows[0],rows[1]);assert.deepEqual(rows[1],rows[2]);
 });
 test('requested0.8x turn rate applies exactly to navigation and visible enemy aiming at20/60/144Hz',()=>{
  const rows=[];
  for(const hz of[20,60,144]){
   for(const combat of[false,true]){
    setup(combat?{x:15,z:15}:{z:-20});if(!combat)h.run('goal={x:0,z:-30};urgent=true');step(1/hz);
    const s=state(),delta=Math.abs(Math.atan2(Math.sin(s.yaw),Math.cos(s.yaw))),oldStep=Math.PI/hz;
    assert.ok(Math.abs(delta-oldStep*.8)<1e-8,`${hz}Hz ${combat?'combat':'navigation'}: ${delta} versus ${oldStep*.8}`);
    assert.equal(s.ammo,25,'An unaligned gun must not shoot while turning');rows.push({hz,combat,oldStepRadians:oldStep,actualStepRadians:delta,ratio:delta/oldStep});
   }
  }
  console.log('TURN0.8 MEASURE: '+JSON.stringify(rows));
 });
 test('navigation and repeated combat facing share a144degree-per-second budget at20/60/144Hz',()=>{
  for(const hz of[20,60,144]){setup({z:-20});h.run('goal={x:0,z:-30};urgent=true');let before=0;for(let i=0;i<hz;i++){step(1/hz);const after=state().yaw,delta=Math.abs(Math.atan2(Math.sin(after-before),Math.cos(after-before)));assert.ok(delta<=Math.PI*.8/hz+1e-8,`${hz}Hz step${i}: ${delta}`);before=after}
   setup({x:15,z:15});h.run('goal={x:0,z:-30};urgent=true');before=0;for(let i=0;i<hz/2;i++){step(1/hz);const after=state().yaw;assert.ok(Math.abs(after-before)<=Math.PI*.8/hz+1e-8);before=after}
  }
 });
 test('silent rear enemy supplies neither instant acquisition nor a gunshot',()=>{
  setup({z:-20});for(let i=0;i<90;i++)step();assert.equal(state().ammo,25);assert.equal(state().target,undefined);assert.equal(state().yaw,0);assert.equal(state().hp,100);
 });
 test('audible rear shot turns gradually to its fixed location before firing',()=>{
  setup({z:-20});h.run("botHearing.emit(player,'shot',elapsed)");let firstShot=null,start=state().elapsed,before=0;for(let i=0;i<120;i++){step();const s=state();assert.ok(Math.abs(s.yaw-before)<=Math.PI*.8/60+1e-8);before=s.yaw;if(s.ammo<25){firstShot=s.elapsed-start;break}}
  assert.ok(firstShot>=.8&&firstShot<2,`first rear shot after ${firstShot}`);
  setup({z:-20});h.run("botHearing.emit(player,'shot',elapsed);player.x=35;player.z=-35");for(let i=0;i<30;i++)step();assert.equal(state().ammo,25);assert.equal(h.run('worker.lastHeard.x'),0);assert.equal(h.run('worker.lastHeard.z'),-20);
 });
 test('stationary frontal target is eliminated promptly by actual rifle rays with normal armor',()=>{
  const times=[];for(let seed=1;seed<=8;seed++){const r=duel(seed);assert.ok(r.firstShot>=.1,'reaction is finite');assert.ok(r.killSeconds!==null&&r.killSeconds<2.5,JSON.stringify(r));times.push(r.killSeconds)}
  assert.ok(times.reduce((a,b)=>a+b,0)/times.length<1.5,JSON.stringify(times));
 });
 test('wall smoke and blindness withhold fire even after settling aim',()=>{
  for(const kind of['wall','smoke','blind']){setup();for(let i=0;i<18;i++)step();const ammo=state().ammo;
   if(kind==='wall')h.wall({z:10,width:30});else if(kind==='smoke')h.run('syncSmokes([{id:1,kind:"smoke",x:0,y:1.4,z:10,radius:3.6,expires:100}])');else h.run('var savedBlind=ordinarySkills.blindUntil;ordinarySkills.blindUntil=()=>100');
   for(let i=0;i<30;i++)step();assert.equal(state().ammo,ammo,kind);
   if(kind==='blind')h.run('ordinarySkills.blindUntil=savedBlind');
  }
 });
 test('moving target and reacquisition cannot inherit the settled stationary precision',()=>{
  setup();h.run('worker.fire=999');for(let i=0;i<20;i++)step();assert.ok(h.run('elapsed-worker.aimStillSince>=.14'));
  h.run('player.x+=.5');step();assert.ok(h.run('elapsed-worker.aimStillSince<.02'));
  h.wall({z:10,width:30});step();assert.equal(h.run('worker.aimSample'),null);h.clearWalls();for(let i=0;i<20&&!h.run('worker.target');i++)step();assert.ok(h.run('elapsed-worker.aimStillSince<.02'));
 });
 test('guest and remote human orientation are not subject to BOT turning logic',()=>{
  setup();h.run("worker.remoteId='friend';worker.netTarget={x:0,z:0,y:0,yaw:1};onlinePlaying=true;online={host:false,session:{memberId:'friend'}};netHasSnapshot=true;elapsed+=1/60;updateBots(1/60)");assert.ok(Math.abs(state().yaw-(1+Math.PI))<1e-8);assert.equal(state().ammo,25);
 });
 console.log(`PASS: ${groups} actual saved-game elite aim groups; no audio`);return groups;
}
module.exports=main;if(require.main===module)main({measure:process.argv.includes('--measure')}).then(result=>{if(process.argv.includes('--measure'))console.log(JSON.stringify(result))}).catch(e=>{console.error(e);process.exitCode=1});
