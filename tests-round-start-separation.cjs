const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');

// Actual maps / saved game / independent JSON host-guest. No audio or browser.
async function main(){
 const started=performance.now(),file=fs.readFileSync(path.join(__dirname,'tests-round-preparation-game.cjs'),'utf8');
 const cut=file.indexOf(' const h=harness();');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'round-start-fixture.cjs'),module);
 mod.filename=path.join(__dirname,'round-start-fixture.cjs');mod.paths=Module._nodeModulePaths(__dirname);
 mod._compile(file.slice(0,cut)+'\nreturn {harness,copy};\n}\nmodule.exports=main;',mod.filename);
 const {harness,copy}=await mod.exports();const h=harness({realMap:true}),g=harness({realMap:true});
 h.reset();g.reset();let groups=0,states=0,snapshots=0;const measured=[];
 const check=(name,fn)=>{if(process.env.ROUND_START_GROUP&&!name.includes(process.env.ROUND_START_GROUP))return;fn();groups++;console.log('PASS: '+name);};
 function setup(id,side='attack',round=1,format='standard'){
  Object.assign(h.sandbox,{id,side,round,format});
  h.run(`onlinePlaying=false;selectArena(id);exploring=false;match=new MatchRules({startingSide:side,format});match.round=round;spawnRound(true);mode='play';elapsed=10;`);
 }
 function gap(a,d){return Number.isFinite(a.minZ)?a.minZ-d.maxZ:Math.hypot(a.x-d.x,a.z-d.z)-a.radius-d.radius;}
 check('every map starts with separated preparation areas and unseen enemy spawn poses',()=>{
  for(const id of ['hashimoto','hirakata','trc']){
   setup(id);const areas=copy(h.run('map.buyAreas')),spawns=copy(h.run('map.teamSpawns'));
   const distance=Math.min(...spawns.attack.flatMap(a=>spawns.defend.map(d=>Math.hypot(a.x-d.x,a.z-d.z))));
   assert.ok(gap(areas.attack,areas.defend)>=85,id+' preparation gap '+gap(areas.attack,areas.defend));
   assert.ok(distance>=118,id+' spawn distance');
   assert.equal(h.run('map.teamSpawns.attack.some(a=>map.teamSpawns.defend.some(d=>map.collision.rayClear(a.x,1.45,a.z,d.x,1.45,d.z)))'),false,id+' spawn LOS');
   for(const side of ['attack','defend']){h.sandbox.which=side;assert.ok(h.run('map.teamSpawns[which].every(p=>canStand(p.x,p.z,.4,0)&&buyAreaContains(map.buyAreas[which],p.x,p.z,.4))'),id+' supported spawn');}
   measured.push({map:id,preparationGap:gap(areas.attack,areas.defend),minimumSpawnDistance:distance});
  }
 });
 check('station barriers keep full three-lane width, but exclude old forward positions and opening long shot',()=>{
  for(const id of ['hashimoto','hirakata']){
   setup(id);
   for(const x of [-65,0,65]){h.sandbox.x=x;assert.ok(h.run('buyAreaContains(map.buyAreas.attack,x,50,.4)&&buyAreaContains(map.buyAreas.defend,x,-50,.4)'));assert.equal(h.run('buyAreaContains(map.buyAreas.attack,x,20,.4)||buyAreaContains(map.buyAreas.defend,x,-5,.4)'),false);}
   assert.equal(h.run('map.collision.rayClear(65,1.45,map.buyAreas.attack.minZ+.4,65,1.45,map.buyAreas.defend.maxZ-.4)'),false);
   assert.equal(h.run('buyBarrier.geometry.getAttribute("position").count'),24);
   assert.equal(h.run('buyBarrier.position.y'),0);
  }
 });
 check('10 slots, both starting sides, next rounds, halftime and overtime reset inside the correct area',()=>{
  for(const id of ['hashimoto','hirakata','trc'])for(const side of ['attack','defend'])for(const format of ['standard','swift']){
   const half=format==='swift'?4:12;
   for(const round of [1,2,half+1,half*2+1,half*2+2]){
    setup(id,side,round,format);states++;
    assert.equal(h.run('[player,...bots].length'),10);
    assert.equal(h.run('[player,...bots].filter(a=>a.team===match.attackerTeam).length'),5);
    assert.ok(h.run('[player,...bots].every(a=>buyAreaContains(map.buyAreas[a.team===match.attackerTeam?"attack":"defend"],a.x,a.z,.4))'));
    h.run('var starting=bots.map(b=>[b.x,b.z]);updateBots(.05)');assert.deepEqual(copy(h.run('bots.map(b=>[b.x,b.z])')),copy(h.run('starting')));
    // Simulate a preceding round ending near the other team's spawn.
    h.run('player.x=map.teamSpawns[ownSide()==="attack"?"defend":"attack"][0].x;player.z=map.teamSpawns[ownSide()==="attack"?"defend":"attack"][0].z;spawnRound()');
    assert.ok(h.run('buyAreaContains(map.buyAreas[ownSide()],player.x,player.z,.4)'));
   }
  }
 });
 check('host and guest agree on all player spawn slots and barrier sides after initial/next/side-switch snapshots',()=>{
  for(const id of ['hashimoto','hirakata','trc'])for(const side of ['attack','defend']){
   for(const round of [1,2,13,25,26]){
    setup(id,side,round);
    h.run(`var sent=[];onlinePlaying=true;online={host:true,session:{memberId:'host'},send:(p,{team})=>sent.push({team,p:JSON.parse(JSON.stringify(p))})};netClock=0;tickOnline(.1);`);
    const packets=copy(h.run('sent'));
    for(const p of packets)assert.ok(Buffer.byteLength(JSON.stringify(p.p))<=65536);
    for(const p of packets)for(const actor of p.p.actors.filter(a=>a.team===p.team&&a.id!=='player')){
     Object.assign(g.sandbox,{id,packet:p.p,actorId:actor.id});
     g.run(`selectArena(id);onlinePlaying=true;online={host:false,session:{memberId:'guest',hostId:'host'},room:{settings:{mapId:id}}};netParticipants.set('guest',actorId);netHasSnapshot=false;netActions=[];applyNetSnapshot(packet);`);snapshots++;
     assert.equal(g.run('player.id'),actor.id);assert.equal(g.run('player.team'),actor.team);
     assert.equal(g.run('player.x'),actor.x);assert.equal(g.run('player.z'),actor.z);
     assert.equal(g.run('ownSide()'),h.run(`'${actor.team}'===match.attackerTeam?'attack':'defend'`));
     assert.ok(g.run('buyAreaContains(map.buyAreas[ownSide()],player.x,player.z,.34)'));
    }
   }
  }
 });
 check('local and remote buy movement cannot cross the recessed boundary at20/60/144Hz; live movement resumes',()=>{
  for(const id of ['hashimoto','hirakata','trc'])for(const side of ['attack','defend'])for(const hz of [20,60,144]){
   setup(id,side);Object.assign(h.sandbox,{hz});
   // An open, collision-free probe retains the actual map's preparation geometry.
   h.run(`map.colliders=[];map.collision=createCollisionIndex([]);map.ramps=[];map.traffic=null;map.traversal=null;
    var area=map.buyAreas[ownSide()],sign=ownSide()==='attack'?-1:1;
    player.x=area.x;player.z=Number.isFinite(area.minZ)?(sign<0?area.minZ+.34:area.maxZ-.34):area.z+sign*(area.radius-.34);
    var before=player.z;for(var i=0;i<hz;i++)moveEntity(player,0,sign*8.05/hz);
    var remote=bots.find(b=>b.team===player.team);remote.remoteId='guest';remote.x=player.x;remote.z=before;remote.y=0;
    netInputs.set('guest',{seq:1,connection:'spawn',round:match.round,received:elapsed,input:{x:remote.x,z:before+sign*10,y:0},actions:[]});
    for(var i=0;i<hz;i++)updateRemoteActor(remote,1/hz);`);
   assert.ok(Math.abs(h.run('player.z-before'))<1e-6);assert.ok(Math.abs(h.run('remote.z-before'))<1e-6);
   h.run('match.startLive();moveEntity(player,0,sign);');assert.ok(Math.abs(h.run('player.z-before'))>.9);
  }
 });
 check('no firing, damage or abilities during preparation, and no invulnerability after round start',()=>{
  setup('hashimoto');h.run(`clearBots();makeBot({x:player.x,z:player.z-3},0,'red',{id:'red-0',team:'red',secondary:'classic'});var enemy=bots[0];enemy.rangeTarget=true;
   var health=enemy.hp,ammo=player.ammo,kitBefore=JSON.stringify(player.kit.snapshot());damageEntity(enemy,200,player);shoot();activateAbility(player,'c');`);
  assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('enemy.alive'),true);
  assert.equal(h.run('player.ammo'),h.run('ammo'));assert.equal(h.run('JSON.stringify(player.kit.snapshot())'),h.run('kitBefore'));
  h.run('match.startLive();damageEntity(enemy,40,player)');assert.equal(h.run('enemy.hp'),60);
 });
 console.log('PASS: '+groups+' round-start separation groups; '+states+' round states / '+snapshots+' independent JSON self snapshots; silent; '+Math.round(performance.now()-started)+'ms');
 if(process.env.ROUND_START_REPORT)fs.writeFileSync(process.env.ROUND_START_REPORT,JSON.stringify({groups,roundStates:states,jsonSelfSnapshots:snapshots,measured},null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
