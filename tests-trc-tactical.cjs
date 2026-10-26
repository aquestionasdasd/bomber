const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
// Real saved game, mesh raycasts and collision. Audio/timers/WebGL are inert.
async function main(){
 const source=fs.readFileSync(path.join(__dirname,'tests-trc-game.cjs'),'utf8'),cut=source.indexOf('  const local=harness');assert.ok(cut>0);
 const fixture=new Module(path.join(__dirname,'trc-tactical-fixture.cjs'),module);fixture.filename=path.join(__dirname,'trc-tactical-fixture.cjs');fixture.paths=Module._nodeModulePaths(__dirname);
 fixture._compile(source.slice(0,cut)+'\nreturn {harness,copy,load};\n}\nmodule.exports=main;',fixture.filename);
 const {harness,copy,load}=await fixture.exports(),h=harness({realMap:true}),layout=await load('trc-layout.js');
 h.sandbox.tp=layout.trcPoint;let groups=0;
 const check=(label,fn)=>{fn();groups++;console.log('PASS: '+label)};
 h.reset();h.run("selectArena('trc');clearBots();match.startLive();mode='play';elapsed=10;map.traversal.restore(map.traversal.snapshot().map(([id,hp])=>[id,hp,true]));environment.updateMatrixWorld(true);");
 check('standing and crouched tactical sightlines agree between meshes and perception',()=>{
  h.run(`var sightChecks=[
   ['A heaven window',[14,45,3.2],[26,43,0],true],
   ['A control wall',[9,54,3.2],[26,43,0],false],
   ['A forecourt',[21,82,0],[26,43,0],false],
   ['B yard',[91,96,0],[88,46,0],false],
   ['upper MID return',[56,55,3.2],[54,81,0],false],
   ['basement ceiling',[94,63,-3.2],[94,63,0],false],
   ['basement return',[92,61,-3.2],[92,55,-3.2],false],
   ['basement lane',[95.5,61,-3.2],[95.5,55,-3.2],true]
  ];var raysTested=0;
  for(const [name,a,b,wanted]of sightChecks)for(const eye of [.95,1.45]){
   const p=tp(...a),q=tp(...b);p.y+=eye;q.y+=eye;
   const clear=map.collision.rayClear(p.x,p.y,p.z,q.x,q.y,q.z);
   if(clear!==wanted)throw Error(name+' collision '+eye+' '+clear);
   const origin=new THREE.Vector3(p.x,p.y,p.z),end=new THREE.Vector3(q.x,q.y,q.z),delta=end.clone().sub(origin);
   const hit=new THREE.Raycaster(origin,delta.clone().normalize(),0,delta.length()).intersectObject(environment,true).find(busSurfaceVisible);
   if(!hit!==wanted)throw Error(name+' visible shot '+eye+' '+hit?.object.name);raysTested++;
  }`);
 });
 check('wall joints and height bands have no pinhole ray openings',()=>{
  h.run(`var seamRays=0,meshSeams=0;
   for(const s of map.structuralSeams){
    const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,length=Math.hypot(dx,dz);if(length<.02)continue;
    for(const f of [.001,.5,.999])for(const y of [s.base+.002,(s.base+s.height)/2,s.height-.002]){
     const x=s.a.x+dx*f,z=s.a.z+dz*f,nx=s.axis==='z'?.6:0,nz=s.axis==='x'?.6:0;
     if(map.collision.rayClear(x-nx,y,z-nz,x+nx,y,z+nz))throw Error('seam pinhole '+JSON.stringify(s));seamRays++;
     if(f!==.5||y!==(s.base+s.height)/2||meshSeams>=180||!map.collision.rayClear(x-nx,y,z-nz,x-nx,y,z-nz)||!map.collision.rayClear(x+nx,y,z+nz,x+nx,y,z+nz))continue;
     for(const sign of [-1,1]){const start=new THREE.Vector3(x-sign*nx,y,z-sign*nz),direction=new THREE.Vector3(sign*nx,0,sign*nz).normalize();
      const hit=new THREE.Raycaster(start,direction,0,1.2).intersectObject(environment,true).find(busSurfaceVisible);if(!hit)throw Error('visible wall seam '+JSON.stringify(s));}
     meshSeams++;
    }
   }
   if(seamRays<10000||meshSeams<80)throw Error('insufficient seam coverage');`);
 });
 check('basement, upper MID and heaven retain support; lower and upper floors block shots',()=>{
  h.run(`for(const id of ['basement','upper-mid','heaven','prep','stage']){const p=map.landmarks.find(v=>v.id===id);Object.assign(player,p,{alive:true,vy:0,crouch:0});for(let i=0;i<240;i++)updateActorVertical(player,1/120);if(Math.abs(player.y-p.y)>.01||!actorGrounded(player))throw Error('floor '+id);}
   const p=tp(94,63,-3.2);Object.assign(player,p,{vy:6.552});for(let i=0;i<180;i++){updateActorVertical(player,1/120);if(player.y+actorBodyHeight(player)>-.24+.001)throw Error('through basement ceiling');}if(Math.abs(player.y+3.2)>.01)throw Error('negative landing');`);
 });
 check('one-way heaven drop uses real movement and never grants a reverse climbing edge',()=>{
  h.run(`const d=map.drops[0];Object.assign(player,d.from,{vy:0,crouch:0});for(let i=0;i<100;i++){moveEntity(player,.04,0);updateActorVertical(player,1/60);}if(player.y!==0||player.x<=d.to.x)throw Error('drop failed');
   const route=navigation.path(d.from.x,d.from.z,d.to.x,d.to.z,d.from.y,d.to.y);if(!route.some(p=>p.drop===d.id))throw Error('missing drop link');
   const back=navigation.path(d.to.x,d.to.z,d.from.x,d.from.z,d.to.y,d.from.y);if(!back.length||back.some(p=>p.drop))throw Error('reverse climb');`);
 });
 check('dropped bomber and equipment stay on their floor and cannot be collected through it',()=>{
  h.run(`{const p=tp(94,63,-3.2);Object.assign(player,p,{vy:0,alive:true});Object.assign(match.spike,{status:'carried',carrier:player.id});const safe=safeDropPoint();if(safe.y!==-3.2)throw Error('drop lifted');match.dropSpike(player.id,safe.x,safe.z,safe.y);
   if(match.pickupSpike(player.id,match.attackerTeam,safe.x,safe.z,0))throw Error('pickup through floor');if(!match.pickupSpike(player.id,match.attackerTeam,safe.x,safe.z,-3.2))throw Error('basement pickup');
   inventory.primary='vandal';inventory.active='vandal';dropItem('vandal',player);const drop=droppedWeapons.at(-1);if(drop.y!==-3.2||drop.mesh.position.y!==-3.2)throw Error('weapon lifted');const packet=JSON.parse(JSON.stringify(serializeDrops()));clearDrops();syncDrops(packet);if(droppedWeapons[0].y!==-3.2)throw Error('lost weapon floor');player.y=0;if(pickupDroppedWeapon(player,droppedWeapons[0].id))throw Error('weapon through floor');}`);
 });
 check('actual VANDAL fire reaches the A window target and stops at the control-room wall',()=>{
  h.run(`for(const [a,blocked]of [[[14,45,3.2],false],[[9,54,3.2],true]]){
   clearBots();const q=tp(26,43);makeBot(q,0,'red',{id:'red-0',team:'red',primary:null,secondary:'classic',armor:0,credits:0,kit:new DuelistKit({character:'nope'})});const target=bots[0];target.hp=100;target.armor=0;Object.assign(player,tp(...a),{hp:100,alive:true,vy:0,crouch:0,vx:0,vz:0});
   inventory={primary:'vandal',secondary:'classic',active:'vandal'};equip('vandal',true);interactionHeld=false;reloading=0;lastShot=-100;shotSequence=0;mode='play';onlinePlaying=false;
   player.yaw=Math.atan2(player.x-q.x,player.z-q.z);player.pitch=Math.atan2(1.2-player.y-1.7,Math.hypot(player.x-q.x,player.z-q.z));renderedRecoil=0;environment.updateMatrixWorld(true);Math.random=()=>.5;shoot(elapsed);
   if(blocked?target.hp!==100:target.hp>=100)throw Error('real bullet '+blocked+' '+target.hp);
  }`);
 });
 check('practice travel, ranged equipment retrieval and thrown targets respect the basement',()=>{
  h.run(`{const p=map.landmarks.find(v=>v.id==='basement');if(!relocate(p)||player.y!==-3.2)throw Error('practice travel floor');
   const d={...tp(94,61,-3.2)};player.yaw=0;player.pitch=Math.atan2(-1.5,2);if(!catDropVisible(player,d))throw Error('basement retrieval sightline');player.y=0;if(catDropVisible(player,d))throw Error('retrieval through ceiling');player.y=-3.2;
   const target=getCometTarget(player,null,{yaw:0,pitch:-.2});if(!target||target.y>=0||target.y<-3.01)throw Error('basement throw target');
   const above={...p,y:0},tactics=createBotTactics({sites:map.sites,navigation,collision:map.collision});if(tactics.routeDistance(above,p,elapsed)<10)throw Error('route measured through floor');
  }`);
 });
 const {createTrcSurfaces}=await load('trc-surfaces.js');
 check('overlapping architectural faces become one material per surface without depth sorting',()=>{
  const output=[],surfaces=createTrcSurfaces((...args)=>output.push(args));
  const floor=(x,z,w,d,key)=>surfaces.add([x,0,z],[x,0,z+d],[x+w,0,z+d],[x+w,0,z],key);
  floor(0,0,10,10,'floor');floor(0,0,10,10,'floor');floor(2,2,6,6,'site');floor(4,4,2,2,'line');
  const audit=surfaces.flush();assert.equal(audit.removedArea,140);
  let area=0;for(let i=0;i<output.length;i++){const a=output[i],x=a.slice(0,4).map(p=>p[0]),z=a.slice(0,4).map(p=>p[2]);
   const r={x:Math.min(...x),X:Math.max(...x),z:Math.min(...z),Z:Math.max(...z)};area+=(r.X-r.x)*(r.Z-r.z);
   for(let j=0;j<i;j++){const b=output[j],xs=b.slice(0,4).map(p=>p[0]),zs=b.slice(0,4).map(p=>p[2]);assert.ok(Math.min(r.X,Math.max(...xs))-Math.max(r.x,Math.min(...xs))<=0||Math.min(r.Z,Math.max(...zs))-Math.max(r.z,Math.min(...zs))<=0,'overlapping final faces');}
  }assert.equal(area,100);assert.ok(output.some(v=>v[4]==='line'));assert.ok(h.run('map.surfaceAudit.removedArea>100'));
 });
 console.log(JSON.stringify({groups,...copy(h.run('({raysTested,seamRays,meshSeams,surfaces:map.surfaceAudit})')),audioPlayed:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
