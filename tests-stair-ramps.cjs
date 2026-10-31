const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {pathToFileURL}=require('node:url');
// Saved game + actual three maps. No browser, audio, timers or sockets.
async function main(){
 const started=performance.now(),file=fs.readFileSync(path.join(__dirname,'tests-round-preparation-game.cjs'),'utf8'),cut=file.indexOf(' const h=harness();');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'stairs-fixture.cjs'),module);mod.filename=path.join(__dirname,'stairs-fixture.cjs');mod.paths=Module._nodeModulePaths(__dirname);
 mod._compile(file.slice(0,cut)+'\nreturn {harness,copy};\n}\nmodule.exports=main;',mod.filename);
 const {harness,copy}=await mod.exports(),h=harness({realMap:true});h.reset();
 let groups=0,traversals=0,frames=0;const check=(name,fn)=>{if(process.env.STAIRS_GROUP&&!name.includes(process.env.STAIRS_GROUP))return;fn();groups++;console.log('PASS: '+name);};
 const near=(a,b,label,eps=1e-6)=>assert.ok(Math.abs(a-b)<=eps,`${label}: ${a} vs ${b}`);
 function arena(id){h.sandbox.id=id;h.run(`selectArena(id);match.phase='live';mode='play';clearBots();resetOrdinarySkills();exploring=false;elapsed=10;keys.clear();makeBot(map.teamSpawns.defend[0],0,'red',{id:'dummy',team:'red',secondary:'classic'});bots[0].rangeTarget=true;`);}
 function pose(index=0,f=.5,character='renko'){
  Object.assign(h.sandbox,{index,f,character});h.run(`resetOrdinarySkills();keys.clear();clearCombatInput();match.phase='live';var r=map.ramps[index],sign=r.direction<0?-1:1;
   Object.assign(player,{x:(r.minX+r.maxX)/2,z:r.minZ+(r.maxZ-r.minZ)*(sign<0?1-f:f),y:(r.base||0)+r.height*f,vy:0,vx:0,vz:0,crouch:0,alive:true,hp:100,carMotion:null,carImpulseUntil:0,dashTimer:0,trafficLaunch:null,yaw:sign<0?0:Math.PI,pitch:0});
   player.kit=new DuelistKit({character});player.kit.smoke=2;player.kit.updraft=1;`);
 }
 check('14 real stairs: continuous support and 20/60/144Hz up/down movement at walk/slide/jet/dash speeds',()=>{
  for(const id of ['hashimoto','hirakata','trc']){
   arena(id);const ramps=copy(h.run('map.ramps'));
   for(let index=0;index<ramps.length;index++)for(const hz of [20,60,144])for(const speed of [7,16,19.2,12/.18])for(const direction of [-1,1]){
    pose(index,direction>0?.2:.8);Object.assign(h.sandbox,{hz,speed,travelSign:direction});
    const result=copy(h.run(`(()=>{const start=player.z,distance=(r.maxZ-r.minZ)*.6;let left=distance;
     while(left>1e-8){const d=Math.min(left,speed/hz);moveEntity(player,0,sign*travelSign*d);updateActorVertical(player,d/speed);left-=d;}
     return {requested:distance,moved:Math.abs(player.z-start),y:player.y,wanted:(r.base||0)+r.height*(travelSign>0?.8:.2),clear:canStand(player.x,player.z,.34,player.y),ladder:player.trcLadder,phase:match.phase,x:player.x,z:player.z,sign,dir:travelSign,vy:player.vy};})()`));
    near(result.moved,result.requested,`${id}/${index}/${hz}/${speed}/${direction} distance ${JSON.stringify(result)}`);near(result.y,result.wanted,id+' continuous floor');assert.ok(result.clear,id+' supported collision');traversals++;
   }
  }
 });
 check('airborne contact follows a rising ramp; airborne clearance, low entrance and landing stay physical',()=>{
  for(const id of ['hashimoto','hirakata','trc']){
   arena(id);for(let index=0;index<h.run('map.ramps.length');index++){
    pose(index);h.run('player.vy=.01;var before=player.z;moveEntity(player,0,sign*.16)');near(h.run('Math.abs(player.z-before)'),.16,id+' launch contact');
    pose(index);h.run('player.y+=.6;player.vy=2;var beforeY=player.y;moveEntity(player,0,sign*.16)');near(h.run('player.y'),h.run('beforeY'),id+' jump not snapped');
    pose(index);h.run('player.y+=.6;player.vy=-1;for(var i=0;i<120;i++)updateActorVertical(player,1/120)');near(h.run('player.y'),h.run('(r.base||0)+r.height*.5'),id+' smooth landing');
    pose(index,0);h.run('player.z-=sign*.01;player.vy=.01;var before=player.z;moveEntity(player,0,sign*.08)');near(h.run('Math.abs(player.z-before)'),.08,id+'/'+index+' low entry');
   }
  }
 });
 check('all14 stair ends connect to real landings in both directions, including airborne skill contact',()=>{
  for(const id of ['hashimoto','hirakata','trc']){
   arena(id);for(let index=0;index<h.run('map.ramps.length');index++)for(const travelSign of [-1,1]){
    pose(index,travelSign>0?.05:.95);h.sandbox.travelSign=travelSign;
     const result=copy(h.run(`(()=>{const start=player.z,distance=(r.maxZ-r.minZ)*.96;let left=distance;player.vy=travelSign>0?.01:0;
     while(left>1e-8){const d=Math.min(left,.08);moveEntity(player,0,sign*travelSign*d);updateActorVertical(player,.005);left-=d;}
     return {distance,moved:Math.abs(player.z-start),clear:canStand(player.x,player.z,.34,player.y)};})()`));
    near(result.moved,result.distance,id+'/'+index+'/'+travelSign+' landing join');assert.ok(result.clear);traversals++;
   }
  }
 });
 check('actual full frames: Renko Q, Q slide, E horizontal/downward and duelist dash cross stair treads',()=>{
  for(const id of ['hashimoto','hirakata','trc']){
   arena(id);
   for(const hz of [20,60,144])for(const skill of ['q','slide','e','down','dash']){
    pose(0,.35,skill==='dash'?'duelist':'renko');Object.assign(h.sandbox,{hz,skill});
    h.run(`keys.add('KeyW');if(skill==='q'||skill==='slide'){useAbility('q');if(skill==='slide'){player.vz=sign*14.4;keys.add('KeyV');}}
     else if(skill==='e'||skill==='down'){player.pitch=skill==='down'?-.15:0;useAbility('e');}
     else{useAbility('e');elapsed+=.26;useAbility('e');}
     var startZ=player.z,startY=player.y;var total=skill==='dash'?.06:.15;var steps=Math.ceil(total*hz);for(var i=0;i<steps;i++)updatePlay(total/steps);`);
    assert.ok(h.run('Math.abs(player.z-startZ)')>(skill==='dash'?3:.5),id+hz+skill+' made progress '+JSON.stringify(copy(h.run('({character:player.kit.character,x:player.x,y:player.y,z:player.z,startZ,startY,skill,events:ordinarySkills.events(elapsed),mode,phase:match.phase,steps})'))));assert.ok(h.run('player.y>startY'),id+hz+skill+' ascended');assert.ok(h.run('canStand(player.x,player.z,.34,player.y,actorBodyHeight(player))'),id+hz+skill+' clear');frames+=h.run('steps');
   }
  }
 });
 check('host remote accepts the same slope at20/60/144Hz without repeated jump or penetration',()=>{
  for(const id of ['hashimoto','hirakata','trc']){
   arena(id);
   for(const hz of [20,60,144]){
    pose();h.sandbox.hz=hz;h.run(`clearBots();makeBot({x:player.x,z:player.z,y:player.y},0,'red',{id:'remote',team:'red',secondary:'classic'});
     var a=bots[0];a.remoteId='guest';a.y=player.y;a.vy=0;a.kit=new DuelistKit({character:'renko'});var start=a.z;
     for(var i=0;i<Math.ceil(hz*.3);i++){elapsed+=1/hz;const z=a.z+sign*6/hz,y=rampFloor(a.x,z,a.y);
      netInputs.set('guest',{seq:i+1,connection:'stairs',round:match.round,received:elapsed,input:{x:a.x,z,y,crouch:0},actions:[]});updateRemoteActor(a,1/hz);}`);
    assert.ok(h.run('Math.abs(a.z-start)')>1.7,id+' remote progress');near(h.run('a.y'),h.run('rampFloor(a.x,a.z,a.y)'),id+' remote height');assert.equal(h.run('a.vy'),0,id+' no jump');
   }
  }
 });
 check('TRC basement ramp landing remains a short verified AI route in both directions',()=>{
  arena('trc');
  for(const reverse of [false,true]){h.sandbox.reverse=reverse;const route=copy(h.run(`(()=>{let a={x:19.5,z:-38,y:-3.2},b={x:19.5,z:-48,y:0};if(reverse)[a,b]=[b,a];const path=navigation.path(a.x,a.z,b.x,b.z,a.y,b.y);let length=0,clear=true;for(const p of path){length+=Math.hypot(p.x-a.x,p.z-a.z,p.y-a.y);clear&&=navigation.clearSegment(a.x,a.z,p.x,p.z,a.y,p.y);a=p;}return {length,clear,count:path.length};})()`));assert.ok(route.count>0&&route.length<15&&route.clear,JSON.stringify(route));}
 });
 check('walls, stair sides, undersides, ceiling, lower floor and removed stairs remain blocked or absent',()=>{
  arena('trc');pose();
  h.run(`var mid=player.z;map.colliders.push({minX:player.x-2,maxX:player.x+2,minZ:mid-.5,maxZ:mid-.4,base:-4,height:8});map.collision.invalidate();var before=player.z;moveEntity(player,0,-3);`);
  assert.ok(h.run('Math.abs(player.z-before)')<.3,'dash wall blocks');
  arena('trc');pose();h.run(`player.x=r.minX-.6;player.y=(r.base||0);var before=player.x;moveEntity(player,.9,0)`);assert.ok(h.run('player.x-before')<.3,'high side cannot climb');
  arena('trc');pose();h.run(`map.colliders.push({minX:player.x-2,maxX:player.x+2,minZ:player.z-2,maxZ:player.z+2,base:player.y+1.8,height:player.y+2});map.collision.invalidate();var before=player.y;player.vy=8;for(var i=0;i<12;i++)updateActorVertical(player,1/120);`);assert.ok(h.run('player.y-before')<=.10001,'ceiling');
  h.run(`map.colliders=[];map.collision=createCollisionIndex([]);map.ramps=[{minX:-3,maxX:3,minZ:-3,maxZ:3,axis:'z',direction:1,base:3,height:2}];Object.assign(player,{x:0,z:0,y:0,vy:0});moveEntity(player,0,1)`);near(h.run('player.z'),1,'separate lower floor');near(h.run('player.y'),0,'no upper snap');
  arena('trc');pose();h.run(`map.colliders.length=0;map.ramps.length=0;map.collision.invalidate();player.y=0;player.vy=0;moveEntity(player,0,-1)`);assert.equal(h.run('rampFloor(player.x,player.z)'),null,'no ghost ramp');
 });
 check('movement top changes do not alter tread ray geometry, solid underside or disabled collision',()=>{
  const {createCollisionIndex,rampHeight}=awaitedCollision;
  const ramp={minX:0,maxX:4,minZ:0,maxZ:10,axis:'z',direction:1,base:0,height:2},c={minX:0,maxX:4,minZ:4,maxZ:5,base:-.24,height:1,movementRamp:ramp},idx=createCollisionIndex([c]);
  const y=rampHeight(ramp,2,4.2);assert.equal(idx.blocked(2,4.2,.34,y),false);assert.equal(idx.blocked(2,4.2,.34,y-.1),true);
  assert.equal(idx.rayClear(2,.9,3.9,2,.9,5.1),false,'visible tread still blocks rays');assert.equal(idx.blocked(2,4.2,.34,-1,1.7),true,'underside solid');
  c.disabled=true;assert.equal(idx.blocked(2,4.2,.34,0),false);assert.equal(idx.rayClear(2,.9,3.9,2,.9,5.1),true);
 });
 console.log(JSON.stringify({groups,traversals,actualFrames:frames,elapsedMs:Math.round(performance.now()-started),audioOutput:0}));
}
let awaitedCollision;import(pathToFileURL(path.join(__dirname,'public/collision.js')).href).then(m=>{awaitedCollision=m;return main();}).catch(e=>{console.error(e);process.exitCode=1;});
