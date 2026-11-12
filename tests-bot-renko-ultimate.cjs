const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{createHash}=require('node:crypto');
async function main({mutate=s=>s,only=()=>true,baseline=false}={}){
 const source=fs.readFileSync(path.join(__dirname,'tests-bot-renko-dart.cjs'),'utf8'),cut=source.indexOf(' if(baseline){');assert.ok(cut>0);
 const m=new Module(path.join(__dirname,'renko-bot-x-harness.cjs'),module);m.filename=path.join(__dirname,'renko-bot-x-harness.cjs');m.paths=module.paths;
 const body=`
 h.run('const botXActivate=activateAbility,botXDamage=damageEntity');
 function combat(){setup();h.run(\`worker.kit.ultPoints=7;worker.kit.smoke=0;worker.kit.updraft=0;worker.kit.dash=0;worker.kit.nextSignatureAt=99;worker.fire=0;player.hp=1;player.armor=0;
 makeBot({x:60,z:60},1,'red',{id:'range-survivor',team:'red',primary:'vandal',kit:new DuelistKit({character:'duelist'})});bots[1].remoteId='inert-survivor';
 var xCalls=0,xCasts=0,order=[];activateAbility=function(a,k,o){const e=botXActivate(a,k,o);if(a===worker&&k==='x'){xCalls++;if(e){xCasts++;order.push('x');}}return e;};
 damageEntity=function(t,n,k,o){const before=t.alive,r=botXDamage(t,n,k,o);if(k===worker&&before&&!t.alive)order.push('kill');return r;};\`);}
 const result=()=>copy(h.run('({xCalls,xCasts,order,active:worker.kit.renkoActive,stock:[worker.kit.smoke,worker.kit.updraft,worker.kit.dash],cooldown:worker.kit.nextSignatureAt,points:worker.kit.ultPoints,ammo:worker.aiAmmo,enemyAlive:player.alive,phase:match.phase})'));
 if(baseline){combat();step(.6);return{executedSourceSHA,diskSourceSHA:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'public/game.js'))).digest('hex'),frame:'actual updatePlay once per frame; inert DOM/audio',result:result()};}
 test('BOT starts X before a real lethal gunshot and restores CQE without extra ammo at20/60/144Hz',()=>{
  for(const hz of[20,60,144]){combat();step(.6,hz);const r=result();assert.equal(r.xCasts,1);assert.deepEqual(r.order,['x','kill']);assert.equal(r.active,true);assert.deepEqual(r.stock,[2,1,1]);assert.equal(r.cooldown,0);assert.equal(r.points,1);assert.equal(r.ammo,24);assert.equal(r.enemyAlive,false);assert.equal(r.phase,'live');}
 });
 test('activation never refills until actual kill and C cooldown does not block X',()=>{
  combat();h.run('player.hp=100;worker.fire=999;worker.nextSkillAt=99');step(.4);assert.equal(result().xCasts,1);assert.deepEqual(result().stock,[0,0,0]);assert.equal(result().cooldown,99);assert.equal(result().ammo,25);
  h.run('worker.kit.ultPoints=7');step(.6);assert.equal(result().xCalls,1);assert.equal(result().points,7);
 });
 test('no target through wall smoke blind rear or stale memory and finite reaction and body turn',()=>{
  for(const code of["player.z=12","syncSmokes([{id:1,kind:'smoke',x:0,y:1.4,z:-6,radius:3.6,expires:100}])","ordinarySkills.blindUntil=()=>100","worker.target=null;worker.lastSeen={id:player.id,x:0,z:-12,seenAt:elapsed};player.x=40;player.z=40"]){combat();h.run(code);step(.4);assert.equal(result().xCalls,0,code);}
  combat();h.wall({z:-6,width:30});step(.4);assert.equal(result().xCalls,0);
  combat();h.run('worker.think=999;worker.target=player;worker.reactionUntil=elapsed+.8');step(.6);assert.equal(result().xCalls,0);step(.3);assert.equal(result().xCasts,1);
  combat();h.run('player.x=10;player.z=-10;worker.think=999;worker.target=player;worker.reactionUntil=0');const yaw=h.run('worker.group.rotation.y');step(1/60);assert.equal(result().xCalls,0);assert.ok(Math.abs(h.run('worker.group.rotation.y')-yaw)<=Math.PI*.8/60+1e-8);step(.5);assert.equal(result().xCasts,1);
 });
 test('empty gun reload work remote guest phases death and pause preserve seven points',()=>{
  for(const code of["worker.aiAmmo=0","worker.aiReload=3","beginServiceReload(worker,{id:'fixture-service',weaponId:'vandal',endsAt:elapsed+1})","worker.remoteId='friend'","onlinePlaying=true;online={host:false,session:{memberId:'friend'}}","worker.alive=false;worker.hp=0","match.phase='buy'","match.phase='post'"]){combat();h.run(code);step(.4);assert.equal(result().xCalls,0,code);assert.equal(result().points,7,code);}
  combat();h.run('netHostPaused=true');step(.4);assert.equal(result().xCasts,0);assert.equal(result().points,7);
  combat();h.run("match.spike.status='planted';Object.assign(match.spike,{x:0,z:0,site:'A'});worker.team=match.defenderTeam;player.team=match.attackerTeam;updateBots.tactics.update=()=>({siteId:'A',defuserId:worker.id,roles:new Map([[worker.id,{goal:{x:0,z:0},role:'defuse',siteId:'A',urgent:true}]])})");step(.4);assert.ok(h.run('worker.defusing'));assert.equal(result().xCalls,0);
 });
 test('seal rejection backs off then recovers and round reset clears local retry state',()=>{
  combat();h.run("ordinarySkills.cast('duck-seal',ordinaryActorView(player),{...ordinaryActorView(worker),targetId:worker.id},elapsed,match.round);worker.fire=999");step(.4);assert.equal(result().xCasts,0);assert.equal(result().points,7);assert.equal(result().xCalls,1);h.run('ordinarySkills.reset()');step(.1);assert.equal(result().xCalls,1);step(.4);assert.equal(result().xCasts,1);
  h.run('worker.nextRenkoUltAt=99;resetOrdinarySkills()');assert.equal(h.run('worker.nextRenkoUltAt'),0);assert.equal(result().active,false);
 });
 test('full ordinary queue permits X and unspent C still uses the real projectile independently',()=>{
  combat();h.run("worker.fire=999;for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',{...ordinaryActorView(player),id:'s'+i},{x:1,y:.12,z:-11},elapsed,match.round)");assert.equal(h.run('ordinarySkills.events(elapsed).length'),20);step(.4);assert.equal(result().xCasts,1);assert.equal(h.run('ordinarySkills.events(elapsed).length'),20);
  combat();h.run('worker.fire=999;worker.kit.smoke=2');step(.4);assert.equal(result().xCasts,1);assert.equal(h.run('worker.kit.smoke'),1);assert.ok(h.run('player.carMotion?.phase===4'));
 });
 console.log('PASS: '+groups+' actual saved-game Renko BOT X groups; audio inert');return groups;
}
module.exports=main;`;
 m._compile(source.slice(0,cut)+body,m.filename);return m.exports({mutate,only,baseline});
}
module.exports=main;if(require.main===module)main({baseline:process.argv.includes('--baseline')}).then(x=>{if(process.argv.includes('--baseline'))console.log(JSON.stringify(x))}).catch(e=>{console.error(e);process.exitCode=1});
