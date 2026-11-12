const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');

// Real saved game/maps in independent audio/WebGL/timer-inert VM worlds.
// These controlled spawn checks do not measure match balance or frame time.
async function main(){
 const fixture=fs.readFileSync(path.join(__dirname,'tests-round-preparation-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'hirakata-deck-spawn-fixture.cjs'),module);mod.filename=path.join(__dirname,'hirakata-deck-spawn-fixture.cjs');mod.paths=Module._nodeModulePaths(__dirname);
 mod._compile(fixture.slice(0,cut)+'\nreturn {harness,copy};\n}\nmodule.exports=main;',mod.filename);
 const{harness,copy}=await mod.exports(),w=harness({realMap:true}),guest=harness({realMap:true});w.reset();guest.reset();
 const failures=[],observations=[];let groups=0;
 const near=(a,b,label,tolerance=.025)=>assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} vs ${b}`);
 const check=(name,fn)=>{if(process.env.DECK_SPAWN_GROUP&&!name.includes(process.env.DECK_SPAWN_GROUP))return;try{fn();groups++;console.log('PASS '+name);}catch(e){failures.push({name,error:e.stack});console.error('FAIL '+name+': '+e.stack);}};
 function setup(id='hirakata',side='attack',format='standard'){
  Object.assign(w.sandbox,{requestedMap:id,requestedSide:side,requestedFormat:format});
  w.run(`online=null;onlinePlaying=false;mode='menu';$('map-select').value=requestedMap;$('match-format').value=requestedFormat;$('starting-side').value=requestedSide;$('agent-select').value='nope';startGame();elapsed=10;Math.random=()=>.5;`);
 }
 function actors(){return copy(w.run('[player,...bots].map(a=>({id:a.id,team:a.team,x:a.x,y:a.y,z:a.z,alive:a.alive}))'));}
 function supportedSpawns(){
  const states=actors(),attacking=w.run('match.attackerTeam');assert.equal(states.length,10);
  for(const actor of states){w.sandbox.actorPose=actor;near(actor.y,actor.team===attacking?6.4:0,'correct spawn floor '+actor.id);assert.equal(w.run('canStand(actorPose.x,actorPose.z,.4,actorPose.y,1.7)'),true,'clear standing body '+actor.id);near(w.run('getZoneFloor(actorPose.x,actorPose.z,actorPose.y+.05)'),actor.y,'supported actor '+actor.id);assert.equal(w.run('buyAreaContains(map.buyAreas[actorPose.team===match.attackerTeam?"attack":"defend"],actorPose.x,actorPose.z,.4)'),true,'inside matching buy area '+actor.id);}
  for(let i=0;i<states.length;i++)for(let j=i+1;j<states.length;j++)assert.ok(Math.hypot(states[i].x-states[j].x,states[i].y-states[j].y,states[i].z-states[j].z)>.8,'nonoverlapping actors');
  return states;
 }
 check('five attack slots and practice entry share the pictured supported T-SITE deck',()=>{
  setup();const result=copy(w.run(`({points:map.teamSpawns.attack,spawn:map.spawn,practice:map.practiceSpawn,defend:map.teamSpawns.defend,yaw:map.spawnYaw.attack,area:map.buyAreas.attack})`));
  assert.deepEqual(result.points,[{x:8,y:6.4,z:76},{x:6.5,y:6.4,z:78},{x:9.5,y:6.4,z:78},{x:6.5,y:6.4,z:80},{x:9.5,y:6.4,z:80}]);
  assert.deepEqual(result.spawn,{...result.points[0],yaw:0});assert.deepEqual(result.practice,result.spawn);assert.equal(result.yaw,0,'station-facing initial view');
  assert.deepEqual(result.defend,Array.from({length:5},(_,i)=>({x:i*5,y:0,z:-112})),'north defense stays unchanged');
  assert.deepEqual(result.area,{minX:5,maxX:11,minZ:72,maxZ:89,minY:6.4});supportedSpawns();
  const routes=copy(w.run(`map.teamSpawns.attack.map(p=>({from:p,walkable:navigation.isWalkable(p.x,p.z,p.y),clear:navigation.clearSegment(p.x,p.z,8,73,p.y,6.4),path:navigation.path(p.x,p.z,8,73,p.y,6.4)}))`));
  for(const route of routes){assert.equal(route.walkable,true);assert.equal(route.clear,true,'deck spine reachable from every slot');assert.ok(route.path.length>0);const end=route.path.at(-1);near(end.x,8,'spine x');near(end.z,73,'spine z');near(end.y,6.4,'spine y');}
  observations.push({kind:'map',...result,routes});
 });
 check('initial, next, halftime and overtime rounds restore every slot on its team floor',()=>{
  const rounds=[1,2,13,26],states=[];
  for(const side of['attack','defend']){setup('hirakata',side);for(const round of rounds){w.sandbox.nextRound=round;w.run(`match.round=nextRound;match.resetSpike();Object.assign(player,{x:80,y:13,z:5,vy:3});spawnRound();`);const all=supportedSpawns();const spike=copy(w.run('match.spike'));assert.equal(spike.status,'dropped');assert.equal(spike.carrier,null);near(spike.y,6.4,'bomber shares attack floor');states.push({startingSide:side,round,side:w.run('match.side'),actors:all,spike});}}
  observations.push({kind:'rounds',states});
 });
 check('host remote roster and independent guest snapshots retain all nine spawn heights',()=>{
  const snapshots=[];
  for(const round of[1,13]){setup();w.sandbox.nextRound=round;w.run(`for(const r of roster)if(r.id!=='player')r.memberId='member-'+r.id;match.round=nextRound;match.resetSpike();spawnRound(true);var sent=[];onlinePlaying=true;online={host:true,session:{memberId:'host'},send:(p,{team})=>sent.push({team,p:JSON.parse(JSON.stringify(p))})};netClock=0;tickOnline(.1);`);supportedSpawns();
   assert.equal(w.run('bots.filter(b=>b.remoteId).length'),9,'all peers are real remote roster slots');
   const packets=copy(w.run('sent'));let count=0;
   for(const wrapper of packets){assert.ok(Buffer.byteLength(JSON.stringify(wrapper.p))<=65536,'packet bound preserved');for(const actor of wrapper.p.actors.filter(a=>a.team===wrapper.team&&a.id!=='player')){
    Object.assign(guest.sandbox,{packet:wrapper.p,actorId:actor.id});guest.run(`onlinePlaying=false;selectArena('hirakata');onlinePlaying=true;online={host:false,session:{memberId:'guest',hostId:'host'},room:{settings:{mapId:'hirakata'}}};netParticipants.set('guest',actorId);netHasSnapshot=false;netActions=[];applyNetSnapshot(packet);`);
    assert.equal(guest.run('player.id'),actor.id);near(guest.run('player.x'),actor.x,'guest x');near(guest.run('player.z'),actor.z,'guest z');near(guest.run('player.y'),actor.y,'guest y');near(guest.run('match.spike.y'),6.4,'guest dropped bomber');near(guest.run('buyBarrier.position.y'),actor.y,'guest barrier floor');assert.equal(guest.run('actorGrounded(player)'),true,'guest floor support');count++;
   }}assert.equal(count,9);snapshots.push({round,count,packetBytes:packets.map(p=>Buffer.byteLength(JSON.stringify(p.p)))});
  }
  observations.push({kind:'host-guest',snapshots,transport:'independent VM JSON; not a live network check'});
 });
 check('upper bomber is reachable in buy phase and preparation boundary is drawn at the deck',()=>{
  setup();const spike=copy(w.run('match.spike'));near(spike.y,6.4,'starting bomber height');assert.ok(w.run('Math.min(...map.teamSpawns.attack.map(p=>Math.hypot(p.x-match.spike.x,p.z-match.spike.z)))>1.8'),'bomber starts unowned beyond pickup distance');
  near(w.run('getZoneFloor(match.spike.x,match.spike.z,match.spike.y+.05)'),6.4,'bomber floor');assert.equal(w.run('canStand(match.spike.x,match.spike.z,.34,6.4)'),true);
  near(w.run('buyBarrier.position.y'),6.4,'barrier base');assert.equal(w.run('buyBarrier.geometry.getAttribute("position").count'),24);
  near(w.run('Math.min(...Array.from(buyBarrier.geometry.getAttribute("position").array).filter((v,i)=>i%3===1))+buyBarrier.position.y'),6.4,'visible barrier bottom');
  w.run('Object.assign(player,{x:match.spike.x,z:match.spike.z+1,y:0,vy:0});updateInteraction(.05,true);');assert.equal(w.run('match.spike.status'),'dropped','cannot pick up through lower floor');
  w.run('player.y=6.4;updateInteraction(.05,true)');assert.equal(w.run('match.spike.carrier'),'player','reachable on deck within buy area');
  for(const hz of[20,60,144]){setup();w.sandbox.hz=hz;w.run(`for(let i=0;i<hz;i++){moveEntity(player,0,-8/hz);updateActorVertical(player,1/hz);}var held={x:player.x,y:player.y,z:player.z};`);near(w.run('player.y'),6.4,'buy movement keeps upper support');assert.equal(w.run('buyAreaContains(map.buyAreas.attack,player.x,player.z,.34)'),true,'buy boundary held');assert.ok(w.run('player.z')>=72.34-1e-8);w.run('match.startLive();moveEntity(player,0,-1);updateActorVertical(player,1/hz);');assert.ok(w.run('player.z<held.z-.9'),'live movement leaves purchase area');near(w.run('player.y'),6.4,'live deck support');}
  observations.push({kind:'bomber-and-buy',spike,hz:[20,60,144]});
 });
 check('map practice starts on deck while objective and range practice keep their distinct entry',()=>{
  setup('hirakata','attack','explore');near(w.run('player.x'),8,'explore x');near(w.run('player.z'),76,'explore z');near(w.run('player.y'),6.4,'explore y');near(w.run('player.yaw'),0,'explore yaw');assert.equal(w.run('actorGrounded(player)'),true);
  for(const format of['plant','defuse']){setup('hirakata','attack',format);assert.equal(w.run('objectivePractice.site'),'A');near(w.run('player.y'),0,'A practice remains ground');assert.equal(w.run('isInsideSite(map.sites.find(s=>s.id==="A"),player.x,player.z)'),true,'objective practice remains at A');}
  setup('hirakata','attack','range');near(w.run('player.y'),0,'range floor');near(w.run('player.x'),w.run('map.rangeArea.spawn.x'),'range x');near(w.run('player.z'),w.run('map.rangeArea.spawn.z'),'range z');
 });
 check('Japan revival uses elevated spawn support and falls back safely after that floor is destroyed',()=>{
  for(const destroyed of[false,true]){setup();w.sandbox.destroyDeck=destroyed;w.run(`match.startLive();player.kit=new DuelistKit({character:'japan'});player.kit.ultPoints=7;for(const b of bots.filter(a=>a.team===player.team)){b.alive=false;b.hp=0;}
   if(destroyDeck){var i=map.destruction.groups.findIndex(g=>g.id==='South_pedestrian_deck');if(i<0)throw Error('deck group missing');var mask=new Uint8Array(Math.ceil(map.destruction.groups.length/8));mask[i>>3]|=1<<(i&7);map.destruction.restore([...mask].map(v=>v.toString(16).padStart(2,'0')).join(''),elapsed);}
   var revival=activateAbility(player,'x');var revived=bots.filter(a=>a.team===player.team);`);
   assert.ok(w.run('revival'),'ability executed');assert.equal(w.run('revived.length'),4);assert.equal(w.run('revived.every(a=>a.alive&&a.hp===10&&canStand(a.x,a.z,.34,a.y)&&Math.abs(getZoneFloor(a.x,a.z,a.y+.05)-a.y)<.025)'),true,'all revived actors safe');
   assert.equal(w.run('revived.every((a,i)=>revived.every((b,j)=>i===j||Math.hypot(a.x-b.x,a.z-b.z)>=.8))'),true,'revive slots distinct');for(const actor of copy(w.run('revived.map(a=>({x:a.x,y:a.y,z:a.z}))')))near(actor.y,destroyed?0:6.4,'revive floor follows existing support');
   observations.push({kind:'revive',destroyed,actors:copy(w.run('revived.map(a=>({x:a.x,y:a.y,z:a.z,hp:a.hp}))'))});w.run('map.destruction.reset()');
  }
 });
 check('ground starts, bomber schema and barriers of Hashimoto and TRC remain at ground level',()=>{
  const maps=[];for(const id of['hashimoto','trc'])for(const side of['attack','defend']){setup(id,side);assert.equal(w.run('[player,...bots].every(a=>a.y===0)'),true,id+' all actor floors');assert.equal(w.run('match.spike.status'),'dropped');assert.equal(w.run('Object.hasOwn(match.spike,"y")'),false,'ground bomber does not add a wire height');assert.equal(w.run('buyBarrier.position.y'),0);assert.equal(w.run('canStand(match.spike.x,match.spike.z,.34,0)'),true);maps.push({id,side,player:copy(w.run('({x:player.x,y:player.y,z:player.z})')),spike:copy(w.run('match.spike'))});}
  observations.push({kind:'ground-compatibility',maps});
 });
 const hashes=Object.fromEntries(['game.js','hirakata-map.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'public',f))).digest('hex')]));
 const report={created:new Date().toISOString(),groups,failures,observations,hashes,audio:false,browser:false,limits:['Controlled spawn/round/support checks, not normal match balance or frame-time evidence','Independent in-process JSON worlds, not actual direct/HTTP latency']};
 if(process.env.DECK_SPAWN_REPORT)fs.writeFileSync(process.env.DECK_SPAWN_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({groups,failures,audio:false,browser:false}));assert.equal(failures.length,0,'T-SITE deck spawn checks failed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
