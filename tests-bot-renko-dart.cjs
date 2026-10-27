const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true,baseline=false}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=base.indexOf(' const h=harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const m=new Module(path.join(__dirname,'renko-bot-harness.cjs'),module);m.filename=path.join(__dirname,'renko-bot-harness.cjs');m.paths=module.paths;let executedSourceSHA;m.mutateGameSource=s=>{const actual=mutate(s);executedSourceSHA=require('node:crypto').createHash('sha256').update(actual).digest('hex');return actual;};m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const{harness}=await m.exports(),h=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name)},copy=x=>JSON.parse(JSON.stringify(x));
 h.run('const actualBlind=ordinarySkills.blindUntil,actualVertical=updateActorVertical');
 function setup(d=12){h.run('ordinarySkills.blindUntil=actualBlind;updateActorVertical=actualVertical');h.reset();h.clearWalls();h.sandbox.d=d;h.run(`difficulty='hard';match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='other';
 Object.assign(player,{team:'red',x:0,y:0,z:-d,hp:100,armor:50,alive:true,vy:0});
 makeBot({x:0,z:0},0,'blue',{id:'renko-bot',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'renko'})});var worker=bots[0];
 Object.assign(worker,{aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:999,think:0,target:null,reactionUntil:0,nextSkillAt:0});worker.kit.smoke=2;worker.kit.updraft=1;worker.kit.dash=1;worker.group.rotation.y=Math.PI;
 var goal={x:0,z:0},urgent=false;updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,role:'guard',siteId:'A',urgent}]])}}};Math.random=()=>.5;`)}
 function step(seconds=.1,hz=60){h.sandbox.seconds=seconds;h.sandbox.hz=hz;h.run('for(let t=0;t<seconds-1e-8;t+=1/hz)updatePlay(Math.min(1/hz,seconds-t))');}
 const darts=()=>h.run("ordinarySkills.events(elapsed).filter(e=>e.type==='renko-dart'&&e.sourceId===worker.id)");
 const state=()=>copy(h.run('({stock:worker.kit.smoke,hp:player.hp,armor:player.armor,z:player.z,phase:player.carMotion?.phase,kills:totalKills,credits:match.credits,yaw:worker.group.rotation.y})'));
 if(baseline){setup();step(1.5);return{executedSourceSHA,diskSourceSHA:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'public/game.js'))).digest('hex'),frame:'actual updatePlay once per frame',state:state(),darts:darts().length};}
 test('aligned visible C actually pushes without HP armor kill or credits at20/60/144Hz',()=>{
  for(const hz of[20,60,144]){setup();const before=state();step(.4,hz);assert.equal(state().stock,1);assert.equal(state().phase,4);assert.ok(state().z<-12);step(1.1,hz);const after=state();assert.ok(after.z<-34);assert.equal(after.hp,before.hp);assert.equal(after.armor,before.armor);assert.equal(after.kills,before.kills);assert.equal(after.credits,before.credits);assert.equal(h.run('carStunUntil(player)'),0);assert.equal(after.stock,1);}
 });
 test('close and distant visible body poses use real fixed projectile and dodge remains possible',()=>{
  for(const d of[3,24,39]){setup(d);step(.8);assert.equal(state().stock,1,String(d));assert.ok(state().z<-d,String(d));}
  setup(42);step(.8);assert.equal(state().stock,2);
  setup();step(.16);assert.equal(state().stock,1);h.run('player.x=5');step(.6);assert.equal(state().z,-12);assert.equal(state().phase,undefined);
  setup();h.run('player.y=3;player.vy=0;updateActorVertical=()=>{}');step(.4);assert.equal(state().stock,1);assert.equal(state().phase,4);
 });
 test('unseen rear hidden smoke blind and fixed lastSeen never supply C targeting',()=>{
  for(const code of["worker.group.rotation.y=0","player.z=12","worker.target=null;worker.lastSeen={id:player.id,x:0,z:-12,seenAt:elapsed};player.x=40;player.z=40","syncSmokes([{id:1,kind:'smoke',x:0,y:1.4,z:-6,radius:3.6,expires:100}])","ordinarySkills.blindUntil=()=>100"]){setup();h.run(code);step(.5);assert.equal(state().stock,2,code)}
  setup();h.wall({z:-6,width:30});step(.5);assert.equal(state().stock,2);
  setup();step(.1);h.wall({z:-6,width:30});step(.5);assert.equal(state().stock,2,'occluded during reaction');
 });
 test('body turns at144deg per second before launch and honors reaction delay',()=>{
  setup();h.run('player.x=10;player.z=-10;worker.think=999;worker.target=player;worker.reactionUntil=0');const old=state().yaw;step(1/60);assert.equal(state().stock,2);assert.ok(Math.abs(state().yaw-old)<=Math.PI*.8/60+1e-8);step(.5);assert.equal(state().stock,1,JSON.stringify(h.run('({yaw:worker.group.rotation.y,target:worker.target?.id,retry:worker.nextSkillAt,now:elapsed,reaction:worker.reactionUntil,aim:carAim(worker,{yaw:Math.atan2(worker.x-player.x,worker.z-player.z),pitch:-.05})})')));
  setup();h.run('worker.think=999;worker.target=player;worker.reactionUntil=elapsed+.8');step(.6);assert.equal(state().stock,2);step(.3);assert.equal(state().stock,1);
 });
 test('full event queue retains stock and bounded retry before eventual real cast',()=>{
  setup();h.run("for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',{...ordinaryActorView(player),id:'s'+i},{x:1,y:.12,z:-11},elapsed,match.round)");assert.equal(h.run('ordinarySkills.events(elapsed).length'),20);step(.2);assert.equal(state().stock,2);assert.equal(darts().length,0);const retry=h.run('worker.nextSkillAt');assert.ok(retry>h.run('elapsed'));h.run('ordinarySkills.reset()');step(.2);assert.equal(state().stock,2);step(.4);assert.equal(state().stock,1);
 });
 test('work reload remote guest phase death and active target launch refuse safely',()=>{
  for(const code of["beginServiceReload(worker,{id:'fixture-service',weaponId:'vandal',endsAt:elapsed+1})","worker.aiReload=3","worker.remoteId='friend'","onlinePlaying=true;online={host:false,session:{memberId:'friend'}}","worker.alive=false;worker.hp=0","match.phase='buy'","match.phase='post'","netHostPaused=true","worker.nextSkillAt=100","beginCarMotion(player,{id:'existing',phase:4,endsAt:elapsed+1,vx:0,vz:-24})"]){setup();h.run(code);step(.4);assert.equal(state().stock,2,code)}
  setup();h.run("match.spike.status='planted';Object.assign(match.spike,{x:0,z:0,site:'A'});worker.team=match.defenderTeam;player.team=match.attackerTeam;updateBots.tactics.update=()=>({siteId:'A',defuserId:worker.id,roles:new Map([[worker.id,{goal:{x:0,z:0},role:'defuse',siteId:'A',urgent:true}]])})");step(.4);assert.ok(h.run('worker.defusing'));assert.equal(state().stock,2);
 });
 test('no available C preserves Q E and unavailable X while ordinary gun engagement continues',()=>{
  setup();h.run('worker.kit.smoke=0;worker.kit.ultPoints=6;worker.fire=0');step(.5);assert.equal(h.run('worker.kit.updraft'),1);assert.equal(h.run('worker.kit.dash'),1);assert.equal(h.run('worker.kit.ultPoints'),6);assert.equal(h.run('worker.kit.renkoActive'),false);assert.ok(h.run('worker.aiAmmo')<25);assert.equal(darts().length,0);
 });
 console.log(`PASS: ${groups} actual saved-game Renko BOT C groups; no audio`);return groups;
}
module.exports=main;if(require.main===module)main({baseline:process.argv.includes('--baseline')}).then(x=>{if(process.argv.includes('--baseline'))console.log(JSON.stringify(x))}).catch(e=>{console.error(e);process.exitCode=1});
