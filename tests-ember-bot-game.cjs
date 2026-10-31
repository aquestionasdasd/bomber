const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{execFileSync}=require('node:child_process');
// Fixed published pre-policy source, in either repository's history. Both
// execute the complete saved game, once per frame; audio/rendering are inert.
let baselineSource;for(const sha of ['494c62d01c07c38d25938d78b370aa867997907c','7c1dba6ed5ff57edd68e475832800293bbead7d5']){try{baselineSource=execFileSync('git',['show',sha+':public/game.js'],{cwd:__dirname,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});break;}catch{}}
if(!baselineSource)throw Error('Missing fixed published Ember baseline');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');if(cut<0)throw Error('Missing complete-game harness');
const suite=String.raw`
 const test=(name,fn)=>{if(!process.env.BD3DO_EMBER_GROUPS||process.env.BD3DO_EMBER_GROUPS.split(',').some(s=>name.startsWith(s)))check(name,fn)};
 const report={controls:[],audioOutput:0,updatePlayCallsPerFrame:1};
 function setup({legacy=false,dist=12,hp=100,key='e',holding=false,gun=true}={}){
  const g=harness({legacy});g.reset();g.clearWalls();Object.assign(g.sandbox,{distanceToEnemy:dist,botHP:hp,skillKey:key,holding,gun});
  g.run("match.phase='live';Object.assign(player,{x:0,z:-distanceToEnemy,hp:1000,armor:50,team:'blue'});makeBot({x:0,z:0},0,'red',{id:'ember-bot',team:'red',secondary:'classic',kit:new DuelistKit({character:'ember'})});var bot=bots[0];Object.assign(bot,{hp:botHP,yaw:0,fire:gun?0:999,aiWeapon:'classic',aiAmmo:12,aiReserve:24});bot.group.rotation.y=Math.PI;bot.kit.smoke=skillKey==='c'?2:0;bot.kit.updraft=skillKey==='q'?1:0;bot.kit.dash=skillKey==='e'?1:0;bot.kit.ultPoints=skillKey==='x'?7:0;var captures=[],damage=[],slowSamples=0,frames=0;var rawActivate=activateRobotAbility;activateRobotAbility=function(a,k,o){var effect=rawActivate(a,k,o);if(effect)captures.push({at:elapsed,key:k,mode:o?.robotMode??0,command:!!o?.robotCommand,point:o?.zonePoint});return effect};var rawDamage=damageEntity;damageEntity=function(a,n,s,o){var hp=a.hp,armor=a.armor;var v=rawDamage(a,n,s,o);if(s?.id===bot.id&&a===player)damage.push({at:elapsed,hp:hp-a.hp,armor:armor-a.armor,skill:o?.skill||'gun'});return v};if(holding){Object.assign(bot,{x:map.sites[0].x,z:map.sites[0].z});Object.assign(player,{x:bot.x,z:bot.z-distanceToEnemy});}");return g;
 }
 function step(g,seconds,hz=60){Object.assign(g.sandbox,{seconds,hz});g.run('for(let t=0;t<seconds-1e-8;t+=1/hz){updatePlay(Math.min(1/hz,seconds-t));frames++;if(robotArmy.speedScale(player,elapsed)<1)slowSamples++}');}
 function result(g){return copy(g.run('({casts:captures,damage,slowSamples,frames,hp:player.hp,stock:{c:bot.kit.smoke,q:bot.kit.updraft,e:bot.kit.dash,x:bot.kit.ultPoints},groups:robotArmy.groups().map(g=>({key:g.key,mode:g.mode,command:g.commandUsed,point:g.point})),units:robotArmy.units().length,botKills:bot.kills||0})'));}
 test('actual before/after E laser, Q ranged fire, C capture at 20/60/144Hz',()=>{
  for(const hz of [20,60,144])for(const [key,dist]of [['e',12],['q',26],['c',18]]){
   const pair=[];for(const legacy of [true,false]){const g=setup({legacy,key,dist});step(g,6,hz);pair.push(result(g));}
   const [before,after]=pair;assert.ok(after.casts.some(c=>c.key===key&&!c.command));
   if(key==='e'){assert.ok(after.casts.some(c=>c.command));const sum=r=>r.damage.filter(d=>d.skill==='ember').reduce((s,d)=>s+d.hp+d.armor,0);assert.ok(sum(after)>sum(before)+20,'actual laser/contact effect improves');}
   if(key==='q'){assert.equal(after.groups[0].mode,1);assert.equal(before.groups[0].mode,0);assert.ok(after.damage.some(d=>d.skill==='ember'&&d.hp>0));assert.equal(before.damage.filter(d=>d.skill==='ember').length,0);}
   if(key==='c'){assert.equal(after.groups[0].mode,1);assert.equal(before.groups[0].mode,0);assert.ok(after.slowSamples>0);assert.equal(before.slowSamples,0);assert.equal(after.casts.filter(c=>!c.command).length,1,'retain second C while first group works');assert.equal(after.stock.c,1);}
   report.controls.push({key,dist,hz,before,after});
  }
 });
 test('situational close E / weak Q / site-hold X modes use actual BOT perception',()=>{
  for(const hz of [20,60,144])for(const spec of [{key:'e',dist:6,mode:1},{key:'q',dist:14,hp:40,mode:0},{key:'x',dist:12,holding:true,mode:1}]){
   const g=setup(spec);step(g,1.2,hz);const r=result(g);assert.equal(r.groups[0]?.mode,spec.mode,JSON.stringify(spec));assert.equal(r.casts.filter(c=>!c.command).length,1);report.controls.push({kind:'situational',hz,spec,result:r});
  }
 });
 test('retain laser order beyond robot range, behind wall, and with too little lifetime',()=>{
  for(const reason of ['range','wall','expiry']){const g=setup({dist:12});g.sandbox.reason=reason;
   g.run("bot.kit.dash=0;bot.reactionUntil=0;var squad=robotArmy.deploy(bot,'e',0,{x:0,y:0,z:0},elapsed,match.round,robotWorld());var boss=robotArmy.units().find(u=>u.type==='supervisor');if(reason==='range')Object.assign(player,{z:-25});if(reason==='expiry'){squad.endsAt=elapsed+1;for(const u of robotArmy.units())u.endsAt=elapsed+1;}");
   if(reason==='wall')g.wall({x:0,z:-6,width:8,height:3});step(g,.65);assert.equal(g.run('squad.commandUsed'),false,reason);assert.equal(result(g).casts.length,0,reason);
  }
  const g=setup({dist:12});g.run("bot.kit.dash=0;bot.reactionUntil=0;var squad=robotArmy.deploy(bot,'e',0,{x:0,y:0,z:-6},elapsed,match.round,robotWorld())");step(g,.65);assert.equal(g.run('squad.commandUsed'),true,'reachable one-use order');step(g,1);assert.equal(result(g).casts.filter(c=>c.command).length,1);
 });
 test('no hidden current-position tracking, flash/seal/death/buy/guest use or instant turns',()=>{
  for(const reason of ['wall','smoke','flash','seal','dead','buy','guest','reaction']){const g=setup({key:'x'});g.sandbox.reason=reason;
   if(reason==='wall')g.wall({z:-6,width:8,height:3});
   g.run("if(reason==='smoke')syncSmokes([{id:1,kind:'smoke',x:0,y:1.4,z:-6,radius:3.6,expires:100}]);if(reason==='flash')ordinarySkills.cast('nope-flash',ordinaryActorView(player),{x:0,y:1.6,z:-2},elapsed-1,match.round);updateOrdinarySkills();if(reason==='seal')ordinarySkills.cast('duck-seal',ordinaryActorView(player),{x:0,y:0,z:0,targetId:bot.id},elapsed,match.round);if(reason==='dead')bot.alive=false;if(reason==='buy')match.phase='buy';if(reason==='guest'){onlinePlaying=true;online={host:false,peerId:'guest'};}if(reason==='reaction'){bot.target=player;bot.think=10;bot.reactionUntil=elapsed+5;}");step(g,.6);assert.equal(result(g).casts.length,0,reason);
  }
  const g=setup();g.run('bot.group.rotation.y=0;bot.lastSeen={id:player.id,x:player.x,z:player.z,seenAt:elapsed-2}');step(g,.1);assert.equal(result(g).casts.length,0);assert.ok(g.run('Math.abs(bot.group.rotation.y)')<=Math.PI*.8*.1+1e-6,'combined 144 degrees/s');
  const lost=setup();lost.wall({z:-6,width:8,height:3});lost.run('bot.lastSeen={id:player.id,x:0,z:-12,seenAt:elapsed-.2};player.x=40;player.z=40');step(lost,1.2);assert.equal(result(lost).casts.length,0,'blocked frozen memory is not a new enemy coordinate');
 });
 test('production emergency uses real collected materials, caps and one command',()=>{
  const g=setup({dist:12,key:'x'});g.run("bot.kit.ultPoints=0;bot.reactionUntil=0;var prod=robotArmy.deploy(bot,'x',1,{x:0,y:0,z:-4},elapsed,match.round,robotWorld());var victim=robotArmy.units().find(u=>u.type==='turret');var old=robotArmy.deploy(bot,'c',0,{x:1,y:0,z:-4,flight:.01},elapsed,match.round,robotWorld());");step(g,.1);g.run("for(const u of robotArmy.units().filter(u=>u.gid===old.id))robotArmy.hit(u.id,999,'blue',elapsed,robotWorld());robotArmy.hit(victim.id,999,'blue',elapsed,robotWorld());");step(g,2);assert.ok(g.run('prod.commandUsed'));assert.ok(g.run('prod.total')>6);assert.ok(g.run('prod.total')<=18);assert.equal(result(g).casts.filter(c=>c.command&&c.key==='x').length,1);
 });
 test('BOT objective interaction still takes priority and round reset clears army',()=>{
  for(const legacy of [true,false]){const work=setup({legacy,holding:true,key:'x'});work.run("Object.assign(match.spike,{status:'planted',x:bot.x,z:bot.z,y:0,timer:45});match.attackerTeam='blue';match.defenderTeam='red';var completed=null;var rawDefuse=match.interactDefuse.bind(match);match.interactDefuse=function(dt,o){var done=rawDefuse(dt,o);if(done)completed={at:elapsed,actorId:o.actorId};return done}");step(work,7.2);assert.equal(result(work).casts.length,0);assert.equal(work.run('match.spike.status'),'defused');assert.equal(work.run('completed.actorId'),'ember-bot');near(work.run('completed.at'),17,'ordinary seven-second owner defuse',1/60+1e-7);report.controls.push({kind:'objective',legacy,defuse:copy(work.run('completed')),casts:result(work).casts.length});}
  const g=setup();
  g.run("robotArmy.deploy(bot,'e',0,{x:bot.x+4,y:0,z:bot.z},elapsed,match.round,robotWorld());match.phase='post';updateOrdinarySkills();startRound()");assert.equal(g.run('robotArmy.units().length'),0);
 });
 test('actual map contact lanes on both sides of stations and TRC',()=>{
  for(const arena of ['hashimoto','hirakata','trc'])for(const side of ['attack','defend']){
   const g=harness({realMap:true});g.reset();Object.assign(g.sandbox,{arena,side});g.run("selectArena(arena);clearBots();resetOrdinarySkills();match.phase='live';var found=null;for(const s of map.teamSpawns[side]){var a=navigation.nearest(s.x,s.z,s.y||0);if(!a)continue;for(const [dx,dz]of [[0,-14],[0,14],[14,0],[-14,0]]){var b=navigation.nearest(a.x+dx,a.z+dz,a.y||0);if(!b||Math.hypot(b.x-a.x,b.z-a.z)<9||Math.abs((b.y||0)-(a.y||0))>1)continue;if(map.collision.rayClear(a.x,(a.y||0)+1.5,a.z,b.x,(b.y||0)+1.5,b.z)){found={a,b};break}}if(found)break}if(!found)throw Error('No screened actual-map contact');Object.assign(player,{team:'blue',...found.b,y:found.b.y||0,hp:1000,armor:50});makeBot(found.a,0,'red',{id:'map-ember',team:'red',secondary:'classic',kit:new DuelistKit({character:'ember'})});var bot=bots[0];bot.group.rotation.y=Math.atan2(player.x-bot.x,player.z-bot.z);bot.kit.smoke=2;bot.kit.updraft=1;bot.kit.dash=1;bot.kit.ultPoints=7;var captures=[],damage=[],frames=0,slowSamples=0;var rawActivate=activateRobotAbility;activateRobotAbility=function(a,k,o){var e=rawActivate(a,k,o);if(e)captures.push({at:elapsed,key:k,mode:o?.robotMode??0,command:!!o?.robotCommand});return e};");
   step(g,6,20);const r=result(g);assert.ok(r.casts.some(c=>!c.command),arena+side);assert.equal(g.run('robotArmy.units().every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.z))'),true);report.controls.push({kind:'actual-map-contact',arena,side,result:r});
  }
 });
 if(process.env.BD3DO_EMBER_REPORT)fs.writeFileSync(process.env.BD3DO_EMBER_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log('PASS: '+groups+' Ember BOT actual saved-game groups; '+report.controls.length+' controls; audio inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
let prefix=fixture.slice(0,cut).replace('function harness({ realMap = false } = {})','function harness({ realMap = false, legacy = false } = {})').replace("vm.runInContext(source.replace","vm.runInContext((legacy?baselineSource:source).replace");
prefix="const baselineSource="+JSON.stringify(baselineSource)+";\n"+prefix;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(prefix+suite,__filename);
