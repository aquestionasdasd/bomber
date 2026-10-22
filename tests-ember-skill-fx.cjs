const assert=require('node:assert/strict');
const path=require('node:path');
const{pathToFileURL}=require('node:url');

async function main(){
  const started=process.hrtime.bigint(),cpu=process.cpuUsage(),load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const[THREE,{createEmberSkillFX},{createCharacterSkills,skillProjectilePosition},{EMBER_SKILLS}]=await Promise.all([load('vendor/three.module.js'),load('ember-skill-fx.js'),load('character-skills.js'),load('abilities.js')]);
  const owner={id:'caster',team:'blue',x:0,y:0,z:0,hp:100,alive:true,grounded:true,yaw:0,crouch:0,weaponId:'vandal'};
  function events(y=0){const engine=createCharacterSkills(),actor={...owner,y};return[engine.cast('ember-solder',actor,{x:0,y:y+.12,z:-18},0,1),engine.cast('ember-shade',actor,{x:0,y,z:0},0,1),engine.cast('ember-service',actor,{x:0,y,z:0,weaponId:actor.weaponId},0,1)];}
  const pool=(fx,token)=>{const mesh=fx.group.children.find(node=>node.name.includes(token));assert.ok(mesh,token);return mesh;};
  const meshes=root=>{const out=[];root.traverse(node=>{if(node.isMesh)out.push(node);});return out;};
  function resources(...roots){const out=new Set();for(const root of roots)for(const mesh of meshes(root)){out.add(mesh.geometry);for(const material of[].concat(mesh.material)){out.add(material);for(const value of Object.values(material))if(value?.isTexture)out.add(value);}}return out;}
  const watch=items=>{const counts=new Map();for(const item of items){counts.set(item,0);item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));}return counts;};
  const counts=(items,n)=>{for(const[item,value]of items)assert.equal(value,n,`${item.name||item.type}: disposed ${value}`);};
  const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
  function pose(mesh,index=0){const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();mesh.getMatrixAt(index,matrix);matrix.decompose(p,q,s);return{p,q,s};}
  function finite(fx,camera){for(const root of[fx.group,camera]){root.updateMatrixWorld(true);root.traverse(node=>assert.ok(node.matrixWorld.elements.every(Number.isFinite),node.name));}for(const mesh of[...fx.group.children,...meshes(camera)])for(let i=0;i<mesh.count*16;i++)assert.ok(Number.isFinite(mesh.instanceMatrix.array[i]));}
  const snapshot=fx=>fx.group.children.map(mesh=>({count:mesh.count,matrix:Array.from(mesh.instanceMatrix.array.slice(0,mesh.count*16)),color:Array.from(mesh.instanceColor.array.slice(0,mesh.count*3))}));
  let passed=0;const test=(name,fn)=>{fn();passed++;console.log(`PASS: ${name}`);};

  test('actual engine cast uses the same raised-floor eye-to-ground .8 arc and fixed landing point',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createEmberSkillFX(THREE,camera),event=events(3.2)[0],drop=pool(fx,'metal droplets');assert.ok(event);close(event.fromY,4.9);
    for(const now of[0,.1125,.225,.449999]){fx.update([event],now);assert.equal(drop.count,1);const expected=skillProjectilePosition(event,now),actual=pose(drop);for(const key of['x','y','z'])close(actual.p[key],expected[key]);}
    fx.update([event],.45);const landed=pose(drop);close(landed.p.y,3.32);close(landed.p.z,-18);assert.equal(pool(fx,'warning rings').count,24);assert.equal(pool(fx,'copper fragments').count,0);finite(fx,camera);fx.dispose();
  });

  test('warning appears only at landing and the one .65s burst ends at1s without smoke or repeated pulses',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createEmberSkillFX(THREE,camera),event=events(3.2)[0],line=pool(fx,'warning rings'),drop=pool(fx,'metal droplets'),chips=pool(fx,'copper fragments');
    fx.update([event],.449999);assert.equal(line.count,0);
    for(const now of[.45,.60,.649999]){fx.update([event],now);assert.equal(line.count,24);assert.equal(chips.count,0);for(let i=0;i<line.count;i++){const actual=pose(line,i);close(actual.p.y,3.285);close(Math.hypot(actual.p.x,actual.p.z+18),3.2);}}
    for(const now of[.65,.8,.9999]){fx.update([event],now);assert.equal(drop.count,0);assert.equal(chips.count,12);assert.equal(line.count,24);finite(fx,camera);}
    fx.update([event],1);assert.equal(fx.group.visible,false);assert.equal(chips.count,0);assert.equal(line.material.depthWrite,false);assert.ok(!meshes(fx.group).some(mesh=>mesh.material.transparent===false&&mesh.geometry.type==='SphereGeometry'));fx.dispose();
  });

  test('shade and service follow living current positions/crouch/yaw without changing any actor/model or weapon transform',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createEmberSkillFX(THREE,camera),data=events(),source={...owner,x:9,y:3.2,z:4,yaw:Math.PI/2,crouch:.5};
    const original=JSON.stringify(source),cameraPose=camera.matrix.clone(),weapon=new THREE.Object3D();weapon.position.set(.3,-.2,-.7);camera.add(weapon);const weaponPose=weapon.position.clone();
    fx.update([data[1]],.2,{actors:[source]});let line=pool(fx,'warning rings');assert.equal(line.count,2);close(pose(line).p.x,8.795);close(pose(line).p.y,3.2+1.62-.275);close(Math.abs(pose(line).p.z-4),.057);
    const bot={...source};delete bot.yaw;bot.group=new THREE.Group();bot.group.rotation.y=Math.PI*1.5;
    fx.update([data[1]],.2,{actors:[bot]});close(pose(line).p.x,8.795);
    bot.remoteId='remote';bot.netYaw=Math.PI;fx.update([data[1]],.2,{actors:[bot]});close(pose(line).p.z,4.205);
    fx.update([data[2]],.7,{actors:[source]});assert.equal(line.count,3);for(let i=0;i<line.count;i++){close(pose(line,i).p.x,8.78);close(pose(line,i).p.y,3.2+1.08-.15);}
    source.x=11;fx.update([data[2]],.75,{actors:[source]});close(pose(line).p.x,10.78);source.x=9;assert.equal(JSON.stringify(source),original);assert.ok(weapon.position.equals(weaponPose));assert.ok(camera.matrix.equals(cameraPose));fx.update([data[2]],.8,{actors:[source]});assert.equal(line.count,0,'The faster service cue ends exactly at.8s');fx.dispose();
  });

  test('own first person shade is a brief peripheral check and service is a small nonthrowing cue',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createEmberSkillFX(THREE,camera),data=events(),hand=camera.children[0],personal=hand.children.find(mesh=>mesh.name.includes('first person'));
    fx.update([data[1]],.15,{actors:[owner],viewer:owner,showHand:true});assert.equal(fx.group.visible,false);assert.equal(personal.count,2);assert.equal(hand.visible,true);
    for(let i=0;i<personal.count;i++){const actual=pose(personal,i);assert.ok(Math.abs(actual.p.x)>=.22&&actual.s.x<=.051);assert.ok(personal.geometry.attributes.emberOpacity.array[i]<=.16);}
    fx.update([data[1]],.31,{actors:[owner],viewer:owner,showHand:true});assert.equal(personal.count,0);assert.equal(hand.visible,false);
    fx.update([data[2]],.7,{actors:[owner],viewer:owner,showHand:true});assert.equal(personal.count,3);assert.equal(fx.throwing(.7),false);
    fx.update([data[2]],.75,{actors:[owner],viewer:owner,showHand:false});assert.equal(hand.visible,false);assert.equal(pool(fx,'warning rings').count,3);fx.dispose();
  });

  test('personal effects disappear on source removal/death/team change/weapon switch while placed solder persists',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createEmberSkillFX(THREE,camera),data=events();
    for(const index of[1,2])for(const source of[null,{...owner,alive:false},{...owner,team:'red'},...(index===2?[{...owner,weaponId:'classic'}]:[])]){
      fx.reset();fx.update([data[index]],.2,{actors:source?[source]:[]});assert.equal(fx.group.visible,false);fx.update([data[index]],.3,{actors:[owner]});assert.equal(fx.group.visible,false,'Stale events cannot resurrect a cancelled personal cue');
    }
    const engine=createCharacterSkills();engine.cast('ember-solder',owner,{x:0,y:.12,z:-3},0,1);engine.cast('ember-shade',owner,owner,0,1);engine.cast('ember-service',owner,owner,0,1);engine.update([{...owner,alive:false,hp:0}],.2,1);
    assert.deepEqual(engine.events(.2).map(event=>event.type),['ember-solder']);fx.reset();fx.update(engine.events(.2),.7,{actors:[]});assert.equal(pool(fx,'copper fragments').count,12);
    fx.update([],.71,{actors:[owner]});assert.equal(fx.group.visible,false);fx.dispose();
  });

  test('C only has .32s throw/.24s hand, and Q/E never hide or lock the weapon',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createEmberSkillFX(THREE,camera),hand=camera.children[0];
    for(const type of['ember-shade','ember-service','bad']){fx.playThrow(type,1);assert.equal(fx.throwing(1),false);fx.update([],1,{showHand:true});assert.equal(hand.visible,false);}
    fx.cue('KeyC',2);assert.equal(fx.throwing(1.99),false);assert.equal(fx.throwing(2),true);assert.equal(fx.throwing(2.3199),true);assert.equal(fx.throwing(2.32),false);
    fx.update([],2.1,{showHand:true});assert.equal(hand.visible,true);finite(fx,camera);fx.update([],2.24,{showHand:true});assert.equal(hand.visible,false);fx.reset();assert.equal(fx.throwing(2.1),false);fx.dispose();assert.equal(camera.children.length,0);
  });

  test('strict finite canonical packets, exact boundaries, duplicate IDs and20-event capacity',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createEmberSkillFX(THREE,camera),event=events()[0],personal=events()[2],invalid=[null,[],{},Object.create(event),{...event,type:'__proto__'},{...event,id:'bad'},{...event,sourceId:'\0'},{...event,team:'green'},{...event,round:0},{...event,y:Infinity},{...event,x:1001},{...event,z:-18.001},{...event,flight:.5},{...event,radius:3},{...event,triggerAt:.7},{...event,endsAt:1.1},{...event,weaponId:'vandal'},{...event,extra:true},{...personal,weaponId:'knife'},{...personal,x:1}];
    fx.update(invalid,.7,{actors:[owner]});assert.equal(fx.group.visible,false);fx.update([event,event],.7);assert.equal(fx.group.userData.activeEvents,1);assert.equal(pool(fx,'copper fragments').count,12);
    fx.update(Array.from({length:200},(_,index)=>({...event,id:`skill-ember-solder-${index+1}`})),.7);assert.equal(fx.group.userData.activeEvents,20);assert.equal(pool(fx,'copper fragments').count,240);assert.equal(pool(fx,'warning rings').count,480);finite(fx,camera);
    for(const now of[NaN,Infinity,-1]){fx.update([event],now,{showHand:true});assert.equal(fx.group.visible,false);assert.equal(camera.children[0].visible,false);}fx.dispose();
  });

  test('reduced motion stays deterministic, normal-depth nonhit geometry and owner-private opacity support compile',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createEmberSkillFX(THREE,camera),data=events();fx.update(data,.72,{actors:[owner],reducedMotion:true});const first=snapshot(fx);fx.update(data,.72,{actors:[owner],reducedMotion:true});assert.deepEqual(snapshot(fx),first);
    for(const mesh of[...meshes(fx.group),...meshes(camera)]){assert.equal(mesh.userData.solid,false);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.material.depthTest,true);const hits=[];mesh.raycast(new THREE.Raycaster(),hits);assert.deepEqual(hits,[]);}
    const line=pool(fx,'warning rings'),shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};line.material.onBeforeCompile(shader);assert.match(shader.vertexShader,/attribute float emberOpacity/);assert.match(shader.fragmentShader,/diffuseColor.a \*= vEmberOpacity/);assert.ok(line.geometry.attributes.emberOpacity.isInstancedBufferAttribute);
    assert.equal([...resources(fx.group,camera)].filter(resource=>resource.isTexture).length,0);assert.equal(fx.group.children.length,3);assert.equal(meshes(camera).length,2);fx.dispose();
  });

  test('fixed resources borrow safely, reset without allocation and release every private/shared resource exactly once',()=>{
    const camera=new THREE.PerspectiveCamera(),otherCamera=new THREE.PerspectiveCamera(),first=createEmberSkillFX(THREE,camera),second=createEmberSkillFX(THREE,otherCamera),all=resources(first.group,camera),other=resources(second.group,otherCamera),shared=new Set([...all].filter(item=>other.has(item))),own=new Set([...all].filter(item=>!other.has(item)));
    assert.equal(all.size,7);assert.equal(shared.size,5);assert.equal(own.size,2);const sharedDisposal=watch(shared),privateDisposal=watch(own),instances=watch([...meshes(first.group),...meshes(camera)]),data=events();
    assert.notEqual(pool(first,'warning rings').geometry.attributes.emberOpacity,pool(second,'warning rings').geometry.attributes.emberOpacity);
    for(let i=0;i<100;i++){first.update(data,.7,{actors:[owner],viewer:owner,showHand:true});assert.deepEqual(resources(first.group,camera),all);first.reset();counts(sharedDisposal,0);counts(privateDisposal,0);}
    first.dispose();first.dispose();counts(sharedDisposal,0);counts(privateDisposal,1);counts(instances,1);second.update(data,.7,{actors:[owner]});finite(second,otherCamera);second.dispose();second.dispose();counts(sharedDisposal,1);assert.equal(camera.children.length,0);
    first.playThrow('ember-solder',1);first.update(data,.7);assert.equal(first.group.visible,false);const rebuiltCamera=new THREE.PerspectiveCamera(),rebuilt=createEmberSkillFX(THREE,rebuiltCamera);assert.ok(!shared.has(pool(rebuilt,'metal droplets').geometry));rebuilt.dispose();
  });
  const use=process.cpuUsage(cpu);console.log(`TOTAL: ${passed} EMBER FX groups passed; wall ${Number(process.hrtime.bigint()-started)/1e6}ms; CPU ${(use.user+use.system)/1000}ms; 3 world + 2 hand pools; texture0; silent Node geometry only.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
