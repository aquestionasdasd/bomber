const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
async function main(){
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 const [T,{planNopeWalk,nopeWalkPose},{createNopeDecoys},{createCharacterSkills},{createNopeDecoyFX},{createStationTakeover}]=await Promise.all(['vendor/three.module.js','nope-walk.js','nope-decoys.js','character-skills.js','nope-decoy-fx.js','station-takeover.js'].map(load));
 const owner={id:'source',team:'blue',x:0,y:0,z:0,hp:100,alive:true},json=v=>JSON.parse(JSON.stringify(v));let count=0;
 const check=(name,fn)=>{fn();count++;console.log('PASS: '+name);};
 check('path planning stops before walls/full-height edges and reconstructs continuously at20/60/144Hz',()=>{
   const p=planNopeWalk({x:0,y:0,z:0},0,(x,y,z)=>Math.abs(x)<1&&Math.abs(z)<7);assert.ok(p.walkLength>=6.6&&p.walkLength<=7);
   const base={x:0,y:0,z:0,startedAt:5,...p};
   for(const hz of [20,60,144])for(let n=0;n<hz*12;n++){const t=5+n/hz,e=nopeWalkPose(base,t);assert.ok(Math.hypot(e.x,e.z)<=p.walkLength+1e-8);assert.ok(Math.abs(Math.hypot(e.x,e.z)-Math.min(p.walkLength,n/hz*3))<1e-8);}
   assert.equal(nopeWalkPose(base,100).walking,false);assert.equal(planNopeWalk({x:0,y:0,z:0},Math.PI,()=>false).walkLength,0);
 });
 check('new moving wave wire stays immutable, bounded, strict, backward compatible and guest-passive',()=>{
   const points=Array.from({length:30},(_,i)=>({x:i*2,y:0,z:-10,yaw:0,walkLength:36})),host=createNopeDecoys();assert.ok(host.start(owner,points,1,1));
   const wire=json(host.snapshot()),guest=createNopeDecoys();assert.ok(guest.restore(wire,3,1));assert.deepEqual(guest.events(3),host.events(3));assert.equal(guest.consume(guest.events(3)[0].id,'red',3,1),null);
   const removed=host.consume(host.events(3)[0].id,'red',3,1);assert.equal(removed.z,-4);assert.ok(guest.restore(json(host.snapshot()),3,1));assert.ok(guest.restore(wire,3,1));assert.equal(guest.events(3).length,29);
   for(const value of [-1,3601,NaN,'100']){const bad=json(wire);bad.points[0][4]=value;assert.equal(createNopeDecoys().restore(bad,3,1),false);}
   const changed=json(wire);changed.points[0][4]=200;assert.equal(guest.restore(changed,4,1),false);
   assert.ok(Buffer.byteLength(JSON.stringify(wire))<2200);const legacy=json(wire);legacy.points.forEach(p=>p.pop());assert.ok(createNopeDecoys().restore(legacy,3,1));
 });
 check('ordinary movement metadata validates atomically, survives JSON and20-event refusal',()=>{
   const host=createCharacterSkills(),target={x:0,y:0,z:-3,yaw:0,walkLength:36};
   for(const value of [-1,36.01,Infinity,'3'])assert.equal(host.cast('nope-decoy',owner,{...target,walkLength:value},1,1),null);
   const event=host.cast('nope-decoy',owner,target,1,1);assert.ok(event);const wire=json(host.snapshot());
   const guest=createCharacterSkills();assert.ok(guest.restore(wire,2,1));assert.deepEqual(guest.events(2),wire.events);assert.equal(guest.consumeDecoy(event.id,'red',2,1),null);
   const bad=json(wire);bad.events[0].walkLength=99;assert.equal(guest.restore(bad,2,1),false);assert.deepEqual(guest.events(2),wire.events);
   for(let i=1;i<20;i++)assert.ok(host.cast('nope-decoy',owner,target,1,1));assert.equal(host.cast('nope-decoy',owner,target,1,1),null);assert.equal(host.events(1).length,20);
   const removed=host.consumeDecoy(event.id,'red',2,1);assert.equal(removed.z,0);assert.equal(removed.x,0);
 });
 check('armed pooled body has muzzle/magazine and opposing walking leg transforms without moving the face/torso',()=>{
   const fx=createNopeDecoyFX(T),e={id:'a',type:'nope-decoy',team:'blue',sourceId:'s',round:1,x:2,y:0,z:3,yaw:0,startedAt:0,endsAt:12,walkPhase:1,walking:true};
   fx.update([e],1);const matrix=m=>{const a=new T.Matrix4();m.getMatrixAt(0,a);return a;},body=fx.group.children.find(m=>m.name==='NOPE decoy / ink'),left=fx.group.children.find(m=>m.name==='NOPE decoy / cloth legL'),right=fx.group.children.find(m=>m.name==='NOPE decoy / cloth legR');
   assert.ok(body.geometry.boundingBox.max.z>.99,'rifle barrel projects ahead');assert.notDeepEqual(matrix(left).elements,matrix(right).elements);
   const stable=matrix(body).elements.slice();fx.update([{...e,walkPhase:1.4}],1.2);assert.deepEqual(matrix(body).elements,stable);assert.notDeepEqual(matrix(left).elements,matrix(right).elements);fx.dispose();
 });
 check('Hirakata uses its own artwork and both real facades/roof/passage, restores Hashimoto without resource churn',()=>{
   const effect=createStationTakeover(T),paint=effect.group.children[0],original=paint.material.map,oldCount=paint.count,oldMatrix=paint.instanceMatrix.array.slice(0,oldCount*16);
   effect.start({id:'x',mapId:'hirakata',startedAt:1,endsAt:13});effect.update(2);assert.ok(effect.group.visible);const texture=paint.material.map;assert.notEqual(texture,original);assert.ok(texture.name.includes('HIRAKATASHI'));assert.equal(paint.count,32);
   let north=0,south=0,roof=0,indoor=0;for(let i=0;i<paint.count;i++){const m=new T.Matrix4();paint.getMatrixAt(i,m);const p=new T.Vector3().setFromMatrixPosition(m);if(p.y>14){p.z<0?north++:south++;assert.ok(Math.abs(Math.abs(p.z)-19.5)<1e-5);}else if(p.y>13)roof++;else if(p.y<4)indoor++;}
   assert.equal(north,3);assert.equal(south,3);assert.equal(roof,10);assert.equal(indoor,4);
   effect.start({id:'y',mapId:'hashimoto',startedAt:2,endsAt:14});assert.equal(paint.material.map,original);assert.equal(paint.count,oldCount);assert.deepEqual(paint.instanceMatrix.array.slice(0,oldCount*16),oldMatrix);
   effect.start({id:'z',mapId:'hirakata',startedAt:2,endsAt:14});assert.equal(paint.material.map,texture);let freed=0;texture.addEventListener('dispose',()=>freed++);effect.dispose();effect.dispose();assert.equal(freed,1);
 });
 console.log(`NOPE UPGRADE: ${count} groups`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
