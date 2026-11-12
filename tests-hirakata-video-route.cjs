const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
// Real saved game movement, collision, support, demolition and immutable traffic.
// This does not claim a measured reconstruction or a real-device playtest.
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'tests-round-preparation-game.cjs'),'utf8'),cut=source.indexOf(' const h=harness();');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'video-route-fixture.cjs'),module);mod.filename=path.join(__dirname,'video-route-fixture.cjs');mod.paths=Module._nodeModulePaths(__dirname);mod._compile(source.slice(0,cut)+'\nreturn {harness,copy};\n}\nmodule.exports=main;',mod.filename);
 const {harness,copy}=await mod.exports(),h=harness({realMap:true});h.reset();h.run("selectArena('hirakata');clearBots();resetOrdinarySkills();mode='play';match.phase='live';exploring=true;elapsed=10;keys.clear();");
 let groups=0,frames=0;const check=(name,fn)=>{fn();groups++;console.log('PASS '+name);};
 const near=(a,b,info)=>assert.ok(Math.abs(a-b)<.025,info+' '+a+' != '+b);
 check('observed loop has distinct long stair, short upper step, supported bridge and park descent',()=>{
  const r=copy(h.run('map.ramps'));assert.equal(r.length,6);
  assert.deepEqual(r.slice(4),[{minX:-74.9,maxX:-71.1,minZ:-32,maxZ:-26,base:5.02,height:1.08,direction:-1,axis:'z'},{minX:-97.9,maxX:-94.1,minZ:-56,maxZ:-38,base:0,height:6.1,direction:1,axis:'z'}]);
  assert.deepEqual(copy(h.run('map.videoReference.levels')),[0,5.02,6.1]);assert.equal(h.run('map.videoReference.measured'),false);
  assert.equal(h.run('canStand(-25,9,.34,5.02)'),true);assert.equal(h.run('canStand(-25,9,.34,7.5)'),false,'the lowered visible soffit really blocks head clearance');
 });
 // Explicit turns avoid walking through retail, gate machines or protective
 // railings. End-to-end support is checked at every real game movement frame.
 const pathPoints=[[-58,46,0],[-58,24,5.02],[-58,9,5.02],[-64,9,5.02],[-25,9,5.02],[-58,9,5.02],[-58,-24,5.02],[-73,-24,5.02],[-73,-33,6.1],[-73,-36,6.1],[-96,-36,6.1],[-96,-59,0]];
 check('complete stair/gallery/gate/deck/park route walks both ways at 20/60/144Hz without jump or teleport',()=>{
  for(const hz of[20,60,144])for(const reverse of[false,true]){
   const points=reverse?[...pathPoints].reverse():pathPoints;
   h.sandbox.start=points[0];h.run('Object.assign(player,{x:start[0],z:start[1],y:start[2],vy:0,vx:0,vz:0,alive:true,hp:100,carMotion:null,trafficLaunch:null});');
   for(const [x,z,y]of points.slice(1)){
    Object.assign(h.sandbox,{targetX:x,targetZ:z,hz});const result=copy(h.run(`(()=>{let n=0,maxError=0;while(Math.hypot(player.x-targetX,player.z-targetZ)>1e-6&&n<5000){const dx=targetX-player.x,dz=targetZ-player.z,d=Math.hypot(dx,dz),step=Math.min(6/hz,d);moveEntity(player,dx/d*step,dz/d*step);updateActorVertical(player,1/hz);n++;if(!canStand(player.x,player.z,.34,player.y))throw Error('penetration');}return{x:player.x,z:player.z,y:player.y,n,vy:player.vy};})()`));
    near(result.x,x,'walk x '+JSON.stringify([hz,reverse,x,z,result]));near(result.z,z,'walk z');near(result.y,y,'supported height');near(result.vy,0,'grounded');frames+=result.n;
   }
  }
 });
 check('park uses practice boundary; competitive match boundary and ground macro routes remain intact',()=>{
  assert.equal(h.run('canStand(-96,-59,.34,0)'),true);h.run('exploring=false');assert.equal(h.run('canStand(-96,-59,.34,0)'),false);h.run('exploring=true');
  assert.deepEqual(copy(h.run('map.combatBounds')),{minX:-82,maxX:82,minZ:-82,maxZ:82});
  for(const x of[-69,-23,-17,40]){h.sandbox.routeX=x;assert.ok(h.run('navigation.path(routeX,21,routeX,-21).length')>0);}
 });
 check('new stair and park props collapse and exactly restore with the same host/guest mask contract',()=>{
  const before=copy(h.run('({ramps:map.ramps,colliders:map.colliders})'));
  h.run("var g=map.destruction.groups.find(g=>g.id==='structure-stair-5'),p={x:-96,z:-46,yaw:0};map.destruction.breakAt(p,p,1)");
  assert.equal(h.run('map.ramps.includes(g.ramps[0])'),false);assert.equal(h.run("map.colliders.some(c=>c.surfaceId==='video-park-stairs')"),false);
  const mask=h.run('map.destruction.snapshot()');assert.ok(mask.length<=64);h.run('map.destruction.reset()');assert.deepEqual(copy(h.run('({ramps:map.ramps,colliders:map.colliders})')),before);
  h.sandbox.mask=mask;assert.equal(h.run('map.destruction.restore(mask,2)'),true);assert.equal(h.run('map.ramps.includes(g.ramps[0])'),false);h.run('map.destruction.reset()');
 });
 console.log(JSON.stringify({groups,realMovementFrames:frames,routeTraversals:6,levels:[0,5.02,6.1],audioOutput:0,measured:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
