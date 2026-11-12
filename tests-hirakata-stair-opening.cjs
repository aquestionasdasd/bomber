const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');

// The saved game runs in an audio/WebGL/timer-inert VM. Geometry raycasts use
// the shipped GLB, while movement and headroom use the shipped collision map.
async function main(){
 const fixture=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=fixture.indexOf('  const local = harness();');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'hirakata-stair-opening-fixture.cjs'),module);mod.filename=path.join(__dirname,'hirakata-stair-opening-fixture.cjs');mod.paths=Module._nodeModulePaths(__dirname);
 mod._compile(fixture.slice(0,cut)+'\nreturn {harness,copy};\n}\nmodule.exports=main;',mod.filename);
 const {harness,copy}=await mod.exports(),w=harness({realMap:true});w.reset();w.run("selectArena('hirakata');");
 const observations=[],failures=[];let groups=0;
 const check=(name,fn)=>{if(process.env.STAIR_GROUP&&!name.includes(process.env.STAIR_GROUP))return;try{fn();groups++;console.log('PASS '+name);}catch(e){failures.push({name,error:e.message});console.error('FAIL '+name+': '+e.message);}};
 const near=(value,wanted,message,tolerance=.025)=>assert.ok(Math.abs(value-wanted)<=tolerance,`${message}: ${value} vs ${wanted}`);
 function reset(){w.run(`onlinePlaying=false;online=null;clearCombatInput();clearBots();resetOrdinarySkills();elapsed=10;match.phase='live';match.phaseTime=100;match.roundTime=100;match.resetSpike();mode='play';
  Object.assign(player,{x:15,y:0,z:91,vy:0,vx:0,vz:0,yaw:0,pitch:0,crouch:0,alive:true,hp:100,armor:0,dashTimer:0,trafficLaunch:null,trcLadder:null});`);}
 function ray(x,z){Object.assign(w.sandbox,{probeX:x,probeZ:z});return copy(w.run(`(()=>{map.world.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(probeX,9,probeZ),new THREE.Vector3(0,-1,0),0,9);
  const hit=ray.intersectObject(map.world,true).find(h=>{if(!h.object.isMesh||!h.object.userData.solid)return false;for(let n=h.object;n;n=n.parent)if(!n.visible)return false;return true;});
  return hit?{y:hit.point.y,distance:hit.distance,module:hit.object.userData.hirakataModule,mesh:hit.object.name}:null;})()`));}
 function geometry(){
  // The authored 32 visual risers are .2 m high; movement uses the continuous
  // slope. At its centre the authored anti-slip stripe sits .014 + .025/2 m
  // above the tread. Keep those independent render/support heights explicit.
  // The east strip avoids the planter at x18,z80 (depth 5.5 m), and the
  // landing floor probe avoids the decorative terrace chair at x15,z72.
  const probes=[{id:'stair opening',x:15,z:78.25,y:4.7,renderY:4.8+.014+.025/2},{id:'west side strip',x:12,z:78.25,y:6.4},{id:'east side strip',x:18,z:75,y:6.4},{id:'top landing',x:15,z:73.5,y:6.4},{id:'main deck connection',x:8,z:72,y:6.4}];
  for(const p of probes){Object.assign(w.sandbox,{probe:p});const hit=ray(p.x,p.z),floor=w.run('getZoneFloor(probe.x,probe.z,9)');observations.push({kind:'surface',...p,floor,hit});assert.ok(hit,p.id+' has rendered support');near(hit.y,p.renderY??p.y,p.id+' rendered top');near(floor,p.y,p.id+' collision support');}
  assert.equal(w.run('canStand(15,78,.4,4.8,1.7)'),true,'standing body must fit through the opening');
  assert.equal(w.run('canStand(16.2,78,.34,4.8,1.7)'),false,'stair side railing remains solid');
  assert.equal(w.run('canStand(8,79.5,.34,11.4,1.7)'),false,'deck canopy head collision remains solid');
 }
 check('rendered stair opening, side strips and landing match independent collision support',geometry);
 check('CPU navigation connects the actual stair and main deck in both directions',()=>{
  reset();const result=copy(w.run(`(()=>{navigation.updateTraffic(0);const poses=[{x:15,z:91,y:0},{x:15,z:72,y:6.4},{x:8,z:72,y:6.4},{x:15,z:72,y:6.4},{x:15,z:91,y:0}],legs=[];
   for(let i=1;i<poses.length;i++){const a=poses[i-1],b=poses[i],direct=navigation.clearSegment(a.x,a.z,b.x,b.z,a.y,b.y),points=navigation.path(a.x,a.z,b.x,b.z,a.y,b.y);let previous=a;const supported=points.length>0&&points.every(p=>{const ok=navigation.clearSegment(previous.x,previous.z,p.x,p.z,previous.y,p.y);previous=p;return ok;});legs.push({from:a,to:b,direct,supported,points});}return legs;})()`));
  observations.push({kind:'navigation',legs:result});for(const leg of result){assert.equal(leg.direct,true,'stair/deck direct segment is supported');assert.equal(leg.supported,true,'every returned path segment is supported');const end=leg.points.at(-1);near(end.x,leg.to.x,'navigation x');near(end.z,leg.to.z,'navigation z');near(end.y,leg.to.y,'navigation height');}
 });
 for(const hz of[20,60,144])for(const who of['player','CPU'])check(who+' walks up, joins main deck and returns down at '+hz+'Hz',()=>{
  reset();Object.assign(w.sandbox,{hz,who});
  const result=copy(w.run(`(()=>{const actor=who==='player'?player:{...player,id:'opening-cpu',remoteId:null},radius=who==='player'?.34:.4,dt=1/hz;
   const targets=[{x:15,z:72,y:6.4},{x:8,z:72,y:6.4},{x:15,z:72,y:6.4},{x:15,z:91,y:0}],steps=[];let frames=0;
   for(const target of targets){let count=0;while(Math.hypot(target.x-actor.x,target.z-actor.z)>.00001&&count++<hz*9){const dx=target.x-actor.x,dz=target.z-actor.z,d=Math.hypot(dx,dz),step=Math.min(d,3*dt);moveEntity(actor,dx/d*step,dz/d*step,radius);updateActorVertical(actor,dt,radius);frames++;
    if(![actor.x,actor.y,actor.z,actor.vy].every(Number.isFinite)||!canStand(actor.x,actor.z,radius,actor.y,1.7))throw Error('invalid body '+JSON.stringify(actor));
    if(Math.abs(actor.vy)<1e-8&&Math.abs(actor.y)>.035&&!map.collision.query(actor.x,actor.z,radius).some(c=>!c.disabled&&map.collision.overlaps(c,actor.x,actor.z,radius)&&Math.abs(movementTop(c,actor.x,actor.z)-actor.y)<.035))throw Error('unsupported grounded body '+JSON.stringify({x:actor.x,y:actor.y,z:actor.z}));}
    steps.push({target,actual:{x:actor.x,y:actor.y,z:actor.z},frames:count});if(Math.hypot(target.x-actor.x,target.z-actor.z)>.025||Math.abs(target.y-actor.y)>.025)break;
   }return{who,hz,frames,steps};})()`));observations.push({kind:'movement',...result});assert.equal(result.steps.length,4,'all four legs complete');
  for(const s of result.steps){near(s.actual.x,s.target.x,'leg x');near(s.actual.z,s.target.z,'leg z');near(s.actual.y,s.target.y,'leg height');}
 });
 for(const hz of[20,60,144])check('real updatePlay keyboard route uses one update per frame at '+hz+'Hz',()=>{
  reset();w.sandbox.hz=hz;
  const result=copy(w.run(`(()=>{makeBot({x:70,z:145},0,'red',{id:'opening-enemy',team:'red',secondary:'classic'});bots[0].rangeTarget=true;const dt=1/hz,legs=[{key:'KeyW',axis:'z',value:72,sign:-1,y:6.4},{key:'KeyA',axis:'x',value:8,sign:-1,y:6.4},{key:'KeyD',axis:'x',value:15,sign:1,y:6.4},{key:'KeyS',axis:'z',value:91,sign:1,y:0}],steps=[];let frames=0;
   for(const leg of legs){clearCombatInput();keys.add(leg.key);keys.add('ShiftLeft');let count=0;
    while(leg.sign*(player[leg.axis]-leg.value)<0&&count++<hz*8){updatePlay(dt);frames++;if(![player.x,player.y,player.z,player.vy].every(Number.isFinite)||!canStand(player.x,player.z,.34,player.y,1.7))throw Error('invalid body during updatePlay');}
    clearCombatInput();for(let i=0;i<Math.ceil(hz*.3);i++){updatePlay(dt);frames++;}
    steps.push({leg,actual:{x:player.x,y:player.y,z:player.z},frames:count});if(Math.abs(player[leg.axis]-leg.value)>.45||Math.abs(player.y-leg.y)>.025)break;
   }return{hz,frames,steps};})()`));observations.push({kind:'updatePlay',...result});assert.equal(result.steps.length,4,'all four keyboard legs complete');
  for(const s of result.steps){near(s.actual[s.leg.axis],s.leg.value,'keyboard destination',.45);near(s.actual.y,s.leg.y,'keyboard height');}
 });
 check('opening preserves rail stopping, canopy head collision and the floor below the landing',()=>{
  reset();w.run(`Object.assign(player,{x:15,z:78,y:4.8,vy:0});for(let i=0;i<60;i++){moveEntity(player,.05,0);updateActorVertical(player,1/60);}var railPose={x:player.x,y:player.y,z:player.z};`);
  assert.ok(w.run('railPose.x')<16.1&&w.run('railPose.x')>15.2,'side rail stops horizontal movement');
  w.run(`Object.assign(player,{x:8,z:79.5,y:6.4,vy:15});var peak=player.y;for(let i=0;i<360;i++){updateActorVertical(player,1/120);peak=Math.max(peak,player.y);if(!canStand(player.x,player.z,.34,player.y,1.7))throw Error('head entered canopy');}`);
  assert.ok(w.run('peak')>10&&w.run('peak')<=12.475-1.7+.00001,'high impulse still hits real canopy underside');near(w.run('player.y'),6.4,'lands back on deck');
  w.run(`Object.assign(player,{x:15,z:72,y:0,vy:0});for(let i=0;i<120;i++)updateActorVertical(player,1/60);`);near(w.run('player.y'),0,'landing does not lift ground actor');
  observations.push({kind:'negative',rail:copy(w.run('railPose')),canopyPeak:w.run('peak'),underLanding:w.run('player.y')});
 });
 check('structural removal invalidates stair support and restoring it restores rendered and collision opening',()=>{
  reset();const group=w.run("map.destruction.groups.findIndex(g=>g.id==='South_pedestrian_deck')");assert.ok(group>=0,'deck belongs to destruction catalog');w.sandbox.deckGroup=group;
  w.run(`var mask=new Uint8Array(Math.ceil(map.destruction.groups.length/8));mask[deckGroup>>3]|=1<<(deckGroup&7);var maskText=[...mask].map(v=>v.toString(16).padStart(2,'0')).join('');if(!map.destruction.restore(maskText,elapsed))throw Error('destruction rejected valid mask');`);
  try{near(w.run('getZoneFloor(15,78,9)'),0,'destroyed stair support removed');const hit=ray(15,78);assert.ok(!hit||hit.y<.35,'destroyed stair mesh hidden');assert.equal(w.run("map.ramps.some(r=>r.id==='South_pedestrian_deck stair 7')"),false,'stair ramp removed');}
  finally{w.run('map.destruction.reset()');}
  geometry();assert.equal(w.run("map.ramps.some(r=>r.id==='South_pedestrian_deck stair 7')"),true,'stair ramp restored');
 });
 const hashes=Object.fromEntries(['game.js','hirakata-map.js','hirakata-complete-layout.js','assets/hirakata-complete-model.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'public',f))).digest('hex')]));
 const report={created:new Date().toISOString(),groups,failures,observations,hashes,audio:false,browser:false};
 if(process.env.STAIR_REPORT)fs.writeFileSync(process.env.STAIR_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({groups,failures,audio:false,browser:false}));assert.equal(failures.length,0,'south stair opening checks failed');
}
main().catch(e=>{console.error(e);process.exitCode=1});
