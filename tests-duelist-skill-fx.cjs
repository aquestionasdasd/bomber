const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
async function main(){
  const started=process.hrtime.bigint(),cpu=process.cpuUsage(),url=file=>pathToFileURL(path.join(__dirname,'public',file)).href,load=file=>import(url(file));
  const[THREE,{createDuelistSkillFX},{createCharacterSkills,skillProjectilePosition},{DUELIST_SKILLS}]=await Promise.all([load('vendor/three.module.js'),load('duelist-skill-fx.js'),load('character-skills.js'),load('abilities.js')]);
  const owner={id:'caster',team:'blue',x:0,y:0,z:0,alive:true,hp:100,grounded:true,crouch:0};
  function events(y=0){const engine=createCharacterSkills(),actor={...owner,y};return[engine.cast('duelist-comet',actor,{x:2,y:y+5,z:-10},0,1),engine.cast('duelist-lift',actor,{x:0,y,z:0},0,1)];}
  const pool=(fx,token)=>{const mesh=fx.group.children.find(node=>node.name.includes(token));assert.ok(mesh,token);return mesh;};
  const meshes=root=>{const out=[];root.traverse(node=>{if(node.isMesh)out.push(node);});return out;};
  function resources(...roots){const out=new Set();for(const root of roots)for(const mesh of meshes(root)){out.add(mesh.geometry);for(const material of[].concat(mesh.material)){out.add(material);for(const item of Object.values(material))if(item?.isTexture)out.add(item);}}return out;}
  const watch=items=>{const counts=new Map();for(const item of items){counts.set(item,0);item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));}return counts;},counts=(items,n)=>{for(const[item,value]of items)assert.equal(value,n,item.name||item.type);};
  const close=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-6,message||`${a} != ${b}`);
  function pose(mesh,index=0){const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();mesh.getMatrixAt(index,matrix);matrix.decompose(p,q,s);return{matrix,p,q,s};}
  function finite(fx,camera){for(const root of[fx.group,camera]){root.updateMatrixWorld(true);root.traverse(node=>assert.ok(node.matrixWorld.elements.every(Number.isFinite),node.name));}for(const mesh of fx.group.children)for(let i=0;i<mesh.count*16;i++)assert.ok(Number.isFinite(mesh.instanceMatrix.array[i]));}
  const snapshot=fx=>fx.group.children.map(mesh=>({count:mesh.count,matrix:Array.from(mesh.instanceMatrix.array.slice(0,mesh.count*16)),color:Array.from(mesh.instanceColor.array.slice(0,mesh.count*3))}));
  let passed=0;async function test(name,fn){await fn();passed++;console.log(`PASS: ${name}`);}

  function checkLinear(factory){
    const camera=new THREE.PerspectiveCamera(),fx=factory(THREE,camera),engine=createCharacterSkills(),actor={...owner,y:3.2,crouch:1},event=engine.cast('duelist-comet',actor,{x:0,y:10.35,z:-8},0,1);
    try{assert.ok(event);close(event.fromY,4.35);fx.update([event],.125);const p=pose(pool(fx,'small stars')).p;
      close(p.y,(event.fromY+event.y)/2,'comet is linear between the actual crouched eye and airborne target');close(p.z,-4);
    }finally{fx.dispose();}
  }
  function checkSphere(factory){
    const camera=new THREE.PerspectiveCamera(),fx=factory(THREE,camera),event=events(3.2)[0];
    try{fx.update([event],.25);const sphere=pool(fx,'fixed opaque'),actual=pose(sphere);
      assert.equal(sphere.count,1);for(const key of['x','y','z']){close(actual.p[key],event[key]);close(actual.s[key],2.8,'opaque sphere uses authoritative radius');}
    }finally{fx.dispose();}
  }
  function checkNonthrow(factory){const camera=new THREE.PerspectiveCamera(),fx=factory(THREE,camera);try{fx.playThrow('duelist-lift',1);assert.equal(fx.throwing(1),false,'Q never throws or locks a reloading weapon');}finally{fx.dispose();}}

  await test('real C is a straight airborne projectile from the crouched eye, never a floor/arc projection',()=>{
    checkLinear(createDuelistSkillFX);
    const camera=new THREE.PerspectiveCamera(),fx=createDuelistSkillFX(THREE,camera),stars=pool(fx,'small stars');
    for(const vector of[{x:0,y:14,z:0},{x:0,y:-1,z:-8},{x:7,y:4,z:-9}])for(const hz of[20,60,144]){
      const engine=createCharacterSkills(),actor={...owner,y:3.2},event=engine.cast('duelist-comet',actor,{x:vector.x,y:actor.y+1.7+vector.y,z:vector.z},0,1);assert.ok(event);
      for(let frame=0;frame<Math.ceil(.25*hz);frame++){const now=frame/hz;if(now>=.25)continue;fx.update([event],now);assert.equal(stars.count,1);const actual=pose(stars).p,expected=skillProjectilePosition(event,now),t=now/.25;for(const key of['x','y','z']){close(actual[key],expected[key]);close(actual[key],event[`from${key.toUpperCase()}`]+(event[key]-event[`from${key.toUpperCase()}`])*t);}finite(fx,camera);}
    }fx.dispose();
  });

  await test('airborne smoke appears at .25 with fixed2.8m radius, opaque inside/outside, and ends at5.25',()=>{
    checkSphere(createDuelistSkillFX);
    const camera=new THREE.PerspectiveCamera(),fx=createDuelistSkillFX(THREE,camera),event=events(3.2)[0],sphere=pool(fx,'fixed opaque');fx.update([event],.249999);assert.equal(sphere.count,0);
    for(const now of[.25,.26,1.3,5.249999]){fx.update([event],now,{actors:[{...owner,alive:false}],reducedMotion:now>1});assert.equal(sphere.count,1);const actual=pose(sphere);for(const key of['x','y','z']){close(actual.p[key],event[key]);close(actual.s[key],event.radius);}assert.equal(pool(fx,'small stars').count,0);}
    assert.equal(sphere.material.transparent,false);assert.equal(sphere.material.opacity,1);assert.equal(sphere.material.side,THREE.DoubleSide);assert.equal(sphere.material.depthWrite,true);assert.equal(sphere.material.depthTest,true);
    fx.update([event],5.25);assert.equal(sphere.count,0);assert.equal(fx.group.visible,false);fx.dispose();
  });

  await test('short comet trail remains behind the straight projectile and is removed by reduced motion',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createDuelistSkillFX(THREE,camera),event=events()[0],trail=pool(fx,'short comet'),star=pool(fx,'small stars');fx.update([event],.15);assert.equal(trail.count,3);
    const start=new THREE.Vector3(event.fromX,event.fromY,event.fromZ),axis=new THREE.Vector3(event.x,event.y,event.z).sub(start).normalize(),point=pose(star).p;
    for(let i=0;i<trail.count;i++){const actual=pose(trail,i),delta=actual.p.clone().sub(start),projection=delta.dot(axis);assert.ok(projection>0&&projection<point.clone().sub(start).dot(axis));close(delta.clone().addScaledVector(axis,-projection).length(),0);assert.ok(actual.s.x<=.15&&actual.s.y<=.017001);}
    fx.update([event],0);assert.equal(trail.count,0);fx.update([event],.15,{reducedMotion:true});assert.equal(trail.count,0);assert.equal(star.count,1);fx.dispose();
  });

  await test('Q is a fixed feet star with upward particles; actors, airborne use and death never move its anchor',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createDuelistSkillFX(THREE,camera),engine=createCharacterSkills(),actor={...owner,y:3.2,grounded:false},event=engine.cast('duelist-lift',actor,{x:0,y:3.2,z:0},0,1);assert.ok(event);const original=JSON.stringify(actor),stars=pool(fx,'small stars'),trail=pool(fx,'short comet');
    for(const now of[0,.10,.25,.449999]){fx.update([event],now,{viewer:{...actor,x:20,y:7,z:-10,alive:false},actors:[]});assert.equal(stars.count,9);const anchor=pose(stars).p;close(anchor.x,0);close(anchor.y,3.285);close(anchor.z,0);for(let i=1;i<stars.count;i++){const particle=pose(stars,i).p;assert.ok(particle.y>3.2);assert.ok(Math.hypot(particle.x,particle.z)<=.266);}assert.equal(trail.count,8);}
    assert.equal(JSON.stringify(actor),original);fx.update([event],.45);assert.equal(fx.group.visible,false);assert.equal(stars.count,0);fx.dispose();
  });

  await test('C-only .32s throw/.24s hand leaves Q, camera and weapon transforms untouched',()=>{
    checkNonthrow(createDuelistSkillFX);
    const camera=new THREE.PerspectiveCamera(),weapon=new THREE.Object3D();camera.add(weapon);weapon.position.set(.3,-.2,-.5);weapon.rotation.set(.1,.2,.3);const oldP=weapon.position.clone(),oldQ=weapon.quaternion.clone(),fx=createDuelistSkillFX(THREE,camera),hand=camera.children.find(child=>child.name.includes('small star hand'));
    fx.playThrow('duelist-comet',2);assert.equal(fx.throwing(1.99),false);assert.equal(fx.throwing(2),true);assert.equal(fx.throwing(2.319999),true);assert.equal(fx.throwing(2.32),false);
    fx.update([],2.1,{showHand:true});assert.equal(hand.visible,true);fx.playThrow('duelist-lift',2.1);assert.equal(fx.throwing(2.33),false);fx.update([],2.24,{showHand:true});assert.equal(hand.visible,false);
    fx.cue('KeyQ',3);assert.equal(fx.throwing(3),false);fx.cue('KeyC',3);assert.equal(fx.throwing(3.1),true);fx.update([],3.1,{showHand:false});assert.equal(hand.visible,false);
    assert.deepEqual(weapon.position,oldP);assert.deepEqual(weapon.quaternion.toArray(),oldQ.toArray());assert.deepEqual(camera.position,new THREE.Vector3());fx.reset();assert.equal(fx.throwing(3.1),false);fx.dispose();assert.deepEqual(camera.children,[weapon]);
  });

  await test('strict canonical common16 packets reject inherited, malformed, future, expired and out-of-3D-range events',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createDuelistSkillFX(THREE,camera),event=events()[0],bad=[null,[],{},Object.create(event),{...event,type:'__proto__'},{...event,id:'bad'},{...event,sourceId:'\0'},{...event,team:'green'},{...event,round:0},{...event,x:Infinity},{...event,y:1001},{...event,fromZ:NaN},{...event,flight:.5},{...event,triggerAt:1},{...event,endsAt:5},{...event,radius:3},{...event,extra:1},{...event,x:0,y:event.fromY+18.01,z:0}];
    fx.update(bad,1);assert.equal(fx.group.visible,false);fx.update([event],-.1);assert.equal(fx.group.visible,false);fx.update([event],event.endsAt);assert.equal(fx.group.visible,false);
    const q=events()[1];fx.update([{...q,y:.00001}],.1);assert.equal(fx.group.visible,false);for(const now of[NaN,Infinity,-1]){fx.update([event],now,{showHand:true});assert.equal(fx.group.visible,false);assert.equal(camera.children[0].visible,false);}fx.dispose();
  });

  await test('20-event pools suppress duplicates and keep finite deterministic reduced-motion data without textures/hits/shadows',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createDuelistSkillFX(THREE,camera),event=events()[1],data=Array.from({length:200},(_,i)=>({...event,id:`skill-duelist-lift-${i+1}`}));fx.update([event,event],.1);assert.equal(fx.group.userData.activeEvents,1);
    fx.update(data,.1);assert.equal(fx.group.userData.activeEvents,20);assert.equal(pool(fx,'small stars').count,180);assert.equal(pool(fx,'short comet').count,160);finite(fx,camera);
    fx.update(data,.1,{reducedMotion:true});const first=snapshot(fx);assert.equal(pool(fx,'short comet').count,0);fx.update(data,.1,{reducedMotion:true});assert.deepEqual(snapshot(fx),first);
    for(const mesh of[...meshes(fx.group),...meshes(camera)]){assert.equal(mesh.userData.solid,false);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.material.depthTest,true);const hits=[];mesh.raycast(new THREE.Raycaster(),hits);assert.deepEqual(hits,[]);}assert.equal([...resources(fx.group,camera)].filter(item=>item.isTexture).length,0);fx.dispose();
  });

  await test('empty snapshot, reset, new-round replacement and repeated dispose leave no old sphere, hand or event',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createDuelistSkillFX(THREE,camera),event=events()[0];fx.playThrow('duelist-comet',0);fx.update([event],.1,{showHand:true});assert.equal(camera.children[0].visible,true);fx.update([],1);assert.equal(fx.group.visible,false);assert.equal(fx.group.userData.activeEvents,0);
    fx.update([event],1);assert.equal(fx.group.visible,true);fx.reset();assert.equal(fx.group.visible,false);assert.equal(fx.group.userData.activeEvents,0);assert.equal(camera.children[0].visible,false);
    fx.update([{...event,round:2,startedAt:5,triggerAt:5.25,endsAt:10.25}],5.5);assert.equal(fx.group.userData.activeEvents,1);fx.update([],5.6);assert.equal(fx.group.visible,false);fx.dispose();fx.dispose();fx.update([event],1);fx.playThrow('duelist-comet',1);assert.equal(fx.group.visible,false);assert.equal(fx.throwing(1),false);assert.equal(camera.children.length,0);
  });

  await test('three fixed batches and hand share six immutable leases; last owner alone disposes each resource once',()=>{
    const camera=new THREE.PerspectiveCamera(),camera2=new THREE.PerspectiveCamera(),first=createDuelistSkillFX(THREE,camera),second=createDuelistSkillFX(THREE,camera2),all=resources(first.group,camera);assert.equal(all.size,6);assert.deepEqual(all,resources(second.group,camera2));assert.equal(first.group.children.length,3);assert.equal(meshes(camera).length,1);
    const shared=watch(all),instances=watch(first.group.children),data=events();for(let i=0;i<100;i++){first.update(data,i%2?.1:1,{showHand:true});assert.deepEqual(resources(first.group,camera),all);first.reset();counts(shared,0);}first.dispose();first.dispose();counts(shared,0);counts(instances,1);second.update(data,.1);finite(second,camera2);second.dispose();counts(shared,1);
    const camera3=new THREE.PerspectiveCamera(),third=createDuelistSkillFX(THREE,camera3);assert.ok(!all.has(pool(third,'small stars').geometry));third.dispose();
  });

  await test('in-memory negative controls detect copied projectile arc, wrong smoke radius and Q throw-lock regressions',async()=>{
    const file=path.join(__dirname,'public/duelist-skill-fx.js'),original=fs.readFileSync(file,'utf8'),hash=crypto.createHash('sha256').update(original).digest('hex');
    const absolute=source=>source.replaceAll("'./abilities.js'",JSON.stringify(url('abilities.js'))).replaceAll("'./character-skills.js'",JSON.stringify(url('character-skills.js')));
    const mutations=[
      {name:'copied arc',anchor:'const point=skillProjectilePosition(event,now);',replacement:'const point=skillProjectilePosition(event,now);if(point)point.y+=4*clamp(age/event.flight)*(1-clamp(age/event.flight))*.8;',verify:checkLinear,message:/comet is linear/},
      {name:'wrong radius',anchor:'else write(smokes,event.x,event.y,event.z,event.radius,event.radius,event.radius);',replacement:'else write(smokes,event.x,event.y,event.z,event.radius*.5,event.radius,event.radius);',verify:checkSphere,message:/authoritative radius/},
      {name:'Q throw lock',anchor:"type==='duelist-comet'&&Number.isFinite(now)",replacement:"['duelist-comet','duelist-lift'].includes(type)&&Number.isFinite(now)",verify:checkNonthrow,message:/Q never throws/},
    ];
    for(const mutation of mutations){assert.equal(original.split(mutation.anchor).length,2,mutation.name);const source=absolute(original.replace(mutation.anchor,mutation.replacement)),module=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);assert.throws(()=>mutation.verify(module.createDuelistSkillFX),mutation.message,mutation.name);}
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,'Negative controls never change product files');
  });
  const use=process.cpuUsage(cpu);console.log(`TOTAL: ${passed} Duelist FX groups passed; wall ${Number(process.hrtime.bigint()-started)/1e6}ms; CPU ${(use.user+use.system)/1000}ms;3 world/1 hand batches;0 textures;3 memory-only negative controls;silent geometry only.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
