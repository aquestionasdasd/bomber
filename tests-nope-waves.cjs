const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');
const suite=String.raw`
 const {createNopeDecoys}=await load('nope-decoys.js'),{createStationTakeover}=await load('station-takeover.js'),{createNopeDecoyFX}=await load('nope-decoy-fx.js');
 const points=()=>Array.from({length:30},(_,i)=>({x:i,y:0,z:0,yaw:0,walkLength:75}));
 const owner={id:'caster',team:'blue',alive:true,hp:100,x:0,y:0,z:0};
 const json=v=>JSON.parse(JSON.stringify(v));
 check('30 bodies at0,5,10 seconds; individual12-second life at20/60/144Hz, no fourth wave',()=>{
   for(const hz of[20,60,144]){const engine=createNopeDecoys();assert.ok(engine.start(owner,points(),10,1));const born=new Set();
     for(let frame=0;frame<=22*hz;frame++){const t=frame/hz,events=engine.events(10+t),count=(t<12?30:0)+(t>=5&&t<17?30:0)+(t>=10&&t<22?30:0);assert.equal(events.length,count,'count '+hz+'/'+t);for(const e of events)born.add(e.id);}
     assert.equal(born.size,90);assert.equal(engine.snapshot(),null);assert.deepEqual(engine.events(10),[]);
   }
 });
 check('enemy-only per-cohort shots, future and expired IDs reject; repeated JSON cannot revive any of90 bodies',()=>{
   const host=createNopeDecoys(),guest=createNopeDecoys();host.start(owner,points(),10,1);const old=json(host.snapshot());assert.equal(host.consume(old.id+'-31','red',10,1),null);assert.equal(host.consume(old.id+'-1','blue',10,1),null);
   for(const t of[10,15,20]){const events=host.events(t);for(const e of events){assert.ok(host.consume(e.id,'red',t,1));assert.equal(host.consume(e.id,'red',t,1),null);}const snap=json(host.snapshot());assert.ok(guest.restore(snap,t,1));assert.ok(guest.restore(old,t,1));assert.equal(guest.events(t).length,0);assert.equal(guest.consume(old.id+'-1','red',t,1),null);}
   assert.deepEqual(host.snapshot().shotMask,[0x3fffffff,0x3fffffff,0x3fffffff]);assert.equal(host.consume(old.id+'-1','red',22,1),null);
   for(const masks of[[0,0],[0,0,0,0],[-1,0,0],[2**30,0,0],[0,'1',0],0]){assert.equal(guest.restore({...old,shotMask:masks},21,1),false);}
   host.reset();assert.equal(host.events(20).length,0);assert.ok(guest.restore(null,21,1));assert.ok(guest.restore(old,21,1));assert.equal(guest.events(21).length,0);assert.equal(guest.restore(old,21,2),false);
 });
 function setup(h){h.reset();h.clearWalls();h.run("mode='play';match.phase='live';makeBot({x:70,z:70},0,'red',{id:'passive',team:'red',secondary:'classic'});bots[0].remoteId='passive';player.x=0;player.z=0;player.yaw=0;nopeDecoyTownCandidates=null;");}
 function step(h,seconds,hz){h.sandbox.seconds=seconds;h.sandbox.hz=hz;h.run('for(let t=0;t<seconds-1e-8;t+=1/hz)updatePlay(Math.min(1/hz,seconds-t))');}
 check('viewer-relative colors in actual E/X render, opposing local team and dead-player spectator',()=>{
   const h=harness();setup(h);h.run("player.team='blue';player.kit.ultPoints=7;activateAbility(player,'x');activateAbility(player,'e')");assert.ok(h.seed('red',6,-5));
   const colors=()=>json(h.run("(()=>{renderOrdinarySkills();return Object.fromEntries(nopeDecoyFX.group.children.filter(m=>/team (red|blue)$/.test(m.name)).map(m=>[m.name.split(' ').at(-1),m.count]));})()"));
   const original=json(h.run('allNopeDecoys()'));assert.equal(original.length,32);
   assert.deepEqual(colors(),{blue:31,red:1});
   h.run("player.team='red'");assert.deepEqual(colors(),{blue:1,red:31});
   h.run("player.alive=false;bots[0].team='blue';spectatedBot=bots[0]");assert.deepEqual(colors(),{blue:31,red:1});
   h.run("bots[0].team='red'");assert.deepEqual(colors(),{blue:1,red:31});
   assert.deepEqual(json(h.run('allNopeDecoys()')),original,'Presentation never changes logical ownership or movement');
   h.run('resetOrdinarySkills();resetTakeover()');assert.deepEqual(colors(),{blue:0,red:0});
 });
 check('actual saved game full frames produce90 plus E, one7pt spend, no ordinary-event growth or elapsed/pause timer replay',()=>{
   for(const hz of[20,60,144]){const h=harness();setup(h);h.run("player.kit.ultPoints=7;activateAbility(player,'x');activateAbility(player,'e')");assert.equal(h.run('allNopeDecoys().length'),31);assert.equal(h.run('takeoverState.endsAt-takeoverState.startedAt'),22);assert.equal(h.run('player.kit.ultPoints'),0);step(h,10.1,hz);assert.equal(h.run('allNopeDecoys().length'),91);assert.equal(h.run('ordinarySkills.events(elapsed).length'),1);h.run('resetOrdinarySkills();resetTakeover()');assert.equal(h.run('allNopeDecoys().length'),0);step(h,6,hz);assert.equal(h.run('allNopeDecoys().length'),0);}
 });
 check('E and all X cohorts travel6.21m in one second matching actual rifle input after acceleration, walls stop routes',()=>{
   for(const hz of[20,60,144]){const h=harness();setup(h);h.run("activateAbility(player,'e');player.kit.ultPoints=7;activateAbility(player,'x');keys.add('KeyW');player.vz=-6.21");const start=h.run('player.z'),e=h.run('allNopeDecoys()[0]');step(h,1,hz);near(h.run('Math.abs(player.z-'+start+')'),6.21,'actual W',.001);const moved=h.run('allNopeDecoys()[0]');near(Math.hypot(e.x-moved.x,e.z-moved.z),6.21,'E speed',.001);}
   const engine=createNopeDecoys();engine.start(owner,points(),10,1);for(const t of[11,16,21]){const e=engine.events(t).find(e=>e.startedAt===t-1);near(e.z,6.21,'cohort speed');}
   const h=harness();setup(h);h.wall({z:-5,width:10});const p=h.run('decoyWalkPath({x:0,y:0,z:0},Math.PI)');assert.ok(p.walkLength<5);h.sandbox.p=p;h.run('ordinarySkills.cast("nope-decoy",ordinaryActorView(player),{x:0,y:0,z:0,...p},elapsed,match.round);elapsed+=2');assert.ok(h.run('allNopeDecoys()[0].z')>-5);
 });
 check('independent JSON rejoin between waves restores absolute ages and all3 masks without guest start/shot authority',()=>{
   const host=harness(),guest=harness();setup(host);setup(guest);host.run("player.kit.ultPoints=7;activateAbility(player,'x');elapsed+=10.25;var e=allNopeDecoys()[65];hitNopeDecoy(e,bots[0])");const packet=json(host.run('({wave:nopeDecoys.snapshot(),time:elapsed,round:match.round,events:allNopeDecoys()})'));guest.sandbox.packet=packet;assert.ok(guest.run('elapsed=packet.time;nopeDecoys.restore(packet.wave,elapsed,packet.round)'));assert.deepEqual(json(guest.run('allNopeDecoys()')),packet.events);assert.equal(packet.events.length,89);assert.equal(guest.run('nopeDecoys.consume(allNopeDecoys()[0].id,"red",elapsed,match.round)'),null);guest.run('elapsed=packet.time+6.8');assert.equal(guest.run('allNopeDecoys().length'),29);
 });
 check('pooled110-body rendering includes the same recognizable Vandal geometry with live colors and clear stock/barrel/magazine',()=>{
   const fx=createNopeDecoyFX(THREE),events=Array.from({length:110},(_,i)=>({id:'body-'+i,type:'nope-decoy',sourceId:'caster',round:1,team:'blue',x:i,y:0,z:0,yaw:0,startedAt:10,endsAt:22}));fx.update(events,11);assert.equal(fx.group.userData.activeEvents,110);const rifle=fx.group.children.find(m=>m.name==='NOPE decoy / rifle');assert.ok(rifle);assert.equal(rifle.count,110);assert.ok(rifle.geometry.attributes.position.count>500);assert.ok(new Set(rifle.geometry.attributes.color.array).size>5);assert.equal(rifle.material.transparent,false);assert.equal(rifle.material.depthWrite,true);assert.equal(fx.group.children.length,13);fx.group.updateMatrixWorld(true);const hits=[];THREE.InstancedMesh.prototype.raycast.call(rifle,new THREE.Raycaster(new THREE.Vector3(-.1,1.35,2),new THREE.Vector3(0,0,-1)),hits);assert.ok(hits.length);assert.equal(new THREE.Raycaster(new THREE.Vector3(-.1,1.35,2),new THREE.Vector3(0,0,-1)).intersectObject(fx.group,true).length,0);fx.dispose();
 });
 check('actual TRC indoor walls at ground, upper and basement support every logo corner; one draw and original collision preserved',()=>{
   harness();const scene=new THREE.Scene(),map=imported.createMap(THREE,scene,'trc'),before=JSON.stringify(map.colliders),fx=createStationTakeover(THREE);fx.start({mapId:'trc',world:map.world,startedAt:10,endsAt:32});assert.ok(fx.update(11));assert.equal(fx.group.userData.map,'trc');const paint=fx.group.children[0];assert.ok(paint.count>=25&&paint.count<=192,'actual indoor count '+paint.count);const matrix=new THREE.Matrix4(),center=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion(),normal=new THREE.Vector3();let upper=0,basement=0;
   for(let i=0;i<paint.count;i++){paint.getMatrixAt(i,matrix);matrix.decompose(center,q,scale);normal.set(0,0,1).transformDirection(matrix);normal.set(Math.round(normal.x),0,Math.round(normal.z));if(center.y>3.5)upper++;if(center.y<0)basement++;assert.ok(Math.abs(normal.y)<.01);for(const [x,y]of[[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5],[0,0]]){const p=new THREE.Vector3(x,y,0).applyMatrix4(matrix).addScaledVector(normal,.08),hit=new THREE.Raycaster(p,normal.clone().negate(),0,.12).intersectObject(map.world,true).filter(h=>h.object.visible&&h.object.material?.transparent!==true)[0];assert.ok(hit,'wall behind '+i);near(hit.distance,.095,'flush '+i,.009);}}
   assert.ok(upper>0&&basement>0,'multiple actual floors');assert.equal(JSON.stringify(map.colliders),before);const buffer=paint.instanceMatrix.version;for(let i=0;i<100;i++)fx.update(11+i/100);assert.equal(paint.instanceMatrix.version,buffer);fx.reset();assert.equal(fx.group.visible,false);fx.dispose();map.dispose?.();
 });
 check('actual Hashimoto, Hirakata and TRC X casts choose30 real supported routes and retain90 bodies at the third wave',()=>{
   for(const id of['hashimoto','hirakata','trc']){const h=harness({realMap:true});h.sandbox.mapId=id;h.run("$('map-select').value=mapId");h.reset();h.run("mode='play';match.phase='live';Object.assign(player,map.teamSpawns.attack[0]);player.y=0;player.kit.ultPoints=7;activateAbility(player,'x')");assert.equal(h.run('allNopeDecoys().length'),30,id);const points=h.run('nopeDecoys.snapshot().points');for(const p of points)assert.ok(h.run('canStand('+p[0]/100+','+p[2]/100+',.34,'+p[1]/100+',1.95)'),id+' supported');h.run('elapsed+=10.1');assert.equal(h.run('allNopeDecoys().length'),90,id+' third wave');if(id==='trc')assert.equal(h.run('stationTakeover.group.userData.map'),'trc');}
 });
 console.log('NOPE waves passed:'+groups+' groups; inert audio.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const prefix=fixture.slice(0,cut).replace('const check = (label, fn) => { fn();','const check = (label, fn) => { if('+JSON.stringify(only||'')+'&&!label.includes('+JSON.stringify(only||'')+'))return;fn();');
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(prefix+suite,__filename);
