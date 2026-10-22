const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function main(){
  const started=process.hrtime.bigint(),load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [THREE,{createIagnuSkillFX},{createCharacterSkills,skillProjectilePosition},{IAGNU_SKILLS}]=await Promise.all([load('vendor/three.module.js'),load('iagnu-skill-fx.js'),load('character-skills.js'),load('abilities.js')]);
  const owner={id:'caster',team:'blue',x:0,y:0,z:0,hp:100,alive:true,yaw:0};
  function events(){const engine=createCharacterSkills();return [engine.cast('echo-tag',owner,{x:6,y:.12,z:-8},0,1),engine.cast('echo-glint',owner,{x:4,y:1.6,z:-8},0,1),engine.cast('echo-kerning',owner,{x:0,y:0,z:0},0,1)];}
  const pool=(fx,token)=>{const mesh=fx.group.children.find(node=>node.name.includes(token));assert.ok(mesh,token);return mesh;};
  const meshes=root=>{const result=[];root.traverse(node=>{if(node.isMesh)result.push(node);});return result;};
  function resources(...roots){const result=new Set();for(const root of roots)for(const mesh of meshes(root)){result.add(mesh.geometry);for(const material of [].concat(mesh.material)){result.add(material);for(const value of Object.values(material))if(value?.isTexture)result.add(value);}}return result;}
  const watch=items=>{const counts=new Map();for(const item of items){counts.set(item,0);item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));}return counts;};
  const counts=(items,n)=>{for(const [item,value]of items)assert.equal(value,n,`${item.name||item.type}: disposal ${value}`);};
  const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
  function pose(mesh,index=0){const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();mesh.getMatrixAt(index,matrix);matrix.decompose(p,q,s);return {p,q,s};}
  function finite(fx,camera){fx.group.updateMatrixWorld(true);camera.updateMatrixWorld(true);for(const root of [fx.group,camera])root.traverse(node=>assert.ok(node.matrixWorld.elements.every(Number.isFinite),node.name));for(const mesh of fx.group.children)for(let i=0;i<mesh.count*16;i++)assert.ok(Number.isFinite(mesh.instanceMatrix.array[i]));}
  const snapshot=fx=>fx.group.children.map(mesh=>({count:mesh.count,matrix:Array.from(mesh.instanceMatrix.array.slice(0,mesh.count*16)),color:Array.from(mesh.instanceColor.array.slice(0,mesh.count*3)),opacity:mesh.geometry.attributes.iagnuOpacity?Array.from(mesh.geometry.attributes.iagnuOpacity.array.slice(0,mesh.count)):null}));
  let passed=0;const test=(name,fn)=>{fn();passed++;console.log(`PASS: ${name}`);};

  test('real I/A casts follow the canonical flight and C lands before its independent arm time',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createIagnuSkillFX(THREE,camera),data=events();assert.ok(data.every(Boolean));
    for(const now of [0,.1,.25,.499]){
      fx.update(data,now,{actors:[owner]});
      for(const [mesh,event]of [[pool(fx,'serif I'),data[0]],[pool(fx,'serif A'),data[1]]]){assert.equal(mesh.count,1);const actual=pose(mesh).p,expected=skillProjectilePosition(event,now);close(actual.x,expected.x);close(actual.y,expected.y);close(actual.z,expected.z);}
    }
    close(skillProjectilePosition(data[0],.275).y,(1.7+.12)/2+.8);
    fx.update([data[0]],.55);close(pose(pool(fx,'serif I')).p.y,.12);assert.equal(pool(fx,'ground baselines').count,24);
    const inactive=pool(fx,'ground baselines').geometry.attributes.iagnuOpacity.array[0];
    fx.update([data[0]],1.05);assert.ok(pool(fx,'ground baselines').geometry.attributes.iagnuOpacity.array[0]>inactive,'Arming changes the grounded cue rather than extending flight');
    close(pose(pool(fx,'ground baselines')).p.y,.085);close(pose(pool(fx,'serif I')).p.x,6);
    fx.update([data[0]],data[0].endsAt);assert.equal(fx.group.visible,false);assert.ok(fx.group.children.every(mesh=>mesh.count===0));fx.dispose();
  });

  test('tag detection removes the actual world letter, Q has only a small .4s reflected tail',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createIagnuSkillFX(THREE,camera),data=events(),engine=createCharacterSkills();
    const tag=engine.cast('echo-tag',owner,{x:2,y:.12,z:0},0,1),enemy={...owner,id:'enemy',team:'red',x:2};
    fx.update([tag],1.05);assert.equal(pool(fx,'serif I').count,1);
    const detected=engine.update([owner,enemy],1.05,1,{reachable:()=>true});assert.equal(detected.filter(effect=>effect.type==='detect').length,1);
    fx.update(engine.events(1.05),1.05);assert.equal(pool(fx,'serif I').count,0);assert.equal(fx.group.visible,false);
    fx.update([data[1]],.5);assert.equal(pool(fx,'serif A').count,1);assert.equal(pool(fx,'ground baselines').count,8);close(pose(pool(fx,'serif A')).p.y,1.6);
    fx.update([data[1]],.899);finite(fx,camera);fx.update([data[1]],.9);assert.equal(fx.group.visible,false);fx.dispose();
  });

  test('kerning follows only its living same-team source feet and never moves camera or actors',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createIagnuSkillFX(THREE,camera),event=events()[2],source={...owner,x:8,y:3.25,z:-4,yaw:.7};
    const original=JSON.stringify(source),cameraPose=JSON.stringify([camera.position.toArray(),camera.rotation.toArray()]);
    fx.update([event],1,{viewer:source,actors:[source]});const first=pose(pool(fx,'ground baselines')).p.clone();assert.equal(pool(fx,'ground baselines').count,6);close(first.y,3.335);
    const moved={...source,x:10,z:2};fx.update([event],1.1,{actors:[moved]});const next=pose(pool(fx,'ground baselines')).p;close(next.x-first.x,2);close(next.z-first.z,6);
    assert.equal(JSON.stringify(source),original);assert.equal(JSON.stringify([camera.position.toArray(),camera.rotation.toArray()]),cameraPose);
    for(const actors of [[],[{...source,alive:false}],[{...source,team:'red'}],[{...source,x:NaN}]]){fx.update([event],1,{actors});assert.equal(fx.group.visible,false);}
    fx.update([event],3.999999,{actors:[source]});assert.equal(fx.group.visible,true,'The strengthened movement cue lasts beyond the old2.5s');
    fx.update([event],4,{actors:[source]});assert.equal(fx.group.visible,false);fx.dispose();
  });

  test('all geometry is depth-tested, shadowless and nonhit; A has a real open counter',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createIagnuSkillFX(THREE,camera);fx.update(events(),.6,{actors:[owner],showHand:true});
    assert.equal(fx.group.children.length,3);for(const mesh of meshes(fx.group).concat(meshes(camera))){assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.userData.solid,false);assert.equal(mesh.material.depthTest,true);const hits=[];mesh.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0);}
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),a=new THREE.Mesh(pool(fx,'serif A').geometry,material);a.updateMatrixWorld();
    const ray=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObject(a);
    assert.equal(ray(0,.20).length,0,'The A counter is actually cut out');assert.ok(ray(-.13,.03).length>0,'Gold serif leg remains solid');material.dispose();
    assert.equal([...resources(fx.group,camera)].filter(item=>item.isTexture).length,0);fx.dispose();
  });

  test('strict bounded events, duplicates, malformed/future/expired data and reduced motion are deterministic',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createIagnuSkillFX(THREE,camera),event=events()[0];
    const bad=[null,[],{},Object.create(event),{...event,id:'bad'},{...event,id:'skill-echo-tag-0'},{...event,type:'__proto__'},{...event,team:'green'},{...event,sourceId:'\0'},{...event,x:Infinity},{...event,y:1001},{...event,round:1.1},{...event,flight:.56},{...event,triggerAt:1},{...event,endsAt:40},{...event,startedAt:2}];
    fx.update(bad,1);assert.equal(fx.group.visible,false);
    fx.update([event,event],1.1,{reducedMotion:true});assert.equal(fx.group.userData.activeEvents,1);const first=snapshot(fx);fx.update([event],1.1,{reducedMotion:true});assert.deepEqual(snapshot(fx),first);
    const many=Array.from({length:200},(_,i)=>({...event,id:`skill-echo-tag-${i+1}`}));fx.update(many,1.1);assert.equal(fx.group.userData.activeEvents,20);assert.equal(pool(fx,'serif I').count,20);assert.equal(pool(fx,'ground baselines').count,480);finite(fx,camera);
    for(const time of [NaN,Infinity,-1]){fx.update(many,time);assert.equal(fx.group.visible,false);}fx.dispose();
  });

  test('C/Q hand cues have exact throw boundaries while E never hides or locks the weapon',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createIagnuSkillFX(THREE,camera),hand=camera.children[0];
    fx.playThrow('echo-kerning',1);assert.equal(fx.throwing(1),false);fx.update([],1,{showHand:true});assert.equal(hand.visible,false);
    for(const type of ['echo-tag','echo-glint']){fx.playThrow(type,2);assert.equal(fx.throwing(1.99),false);assert.equal(fx.throwing(2),true);assert.equal(fx.throwing(2.3199),true);assert.equal(fx.throwing(2.32),false);fx.update([],2.1,{showHand:true});assert.equal(hand.visible,true);finite(fx,camera);fx.update([],2.24,{showHand:true});assert.equal(hand.visible,false);fx.reset();assert.equal(fx.throwing(2.1),false);}
    fx.cue('KeyQ',3);fx.update([],3.1,{showHand:false});assert.equal(hand.visible,false);fx.reset();assert.equal(fx.group.visible,false);fx.dispose();assert.equal(camera.children.length,0);fx.playThrow('echo-tag',4);fx.update(events(),4);assert.equal(fx.group.visible,false);
  });

  test('shared immutable gold meshes outlive borrowers; fixed buffers and all owner resources release exactly once',()=>{
    const camera=new THREE.PerspectiveCamera(),otherCamera=new THREE.PerspectiveCamera(),first=createIagnuSkillFX(THREE,camera),second=createIagnuSkillFX(THREE,otherCamera);
    const all=resources(first.group,camera),other=resources(second.group,otherCamera),shared=new Set([...all].filter(item=>other.has(item))),privateItems=new Set([...all].filter(item=>!other.has(item)));
    assert.equal(shared.size,4);assert.equal(privateItems.size,1);const sharedDisposal=watch(shared),privateDisposal=watch(privateItems),instanceDisposal=watch(first.group.children);
    const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};pool(first,'ground baselines').material.onBeforeCompile(shader);assert.ok(shader.vertexShader.includes('attribute float iagnuOpacity'));assert.ok(shader.fragmentShader.includes('diffuseColor.a *= vIagnuOpacity'));
    for(let i=0;i<150;i++){first.update(events(),1.1,{actors:[owner]});assert.deepEqual(resources(first.group,camera),all);first.reset();counts(sharedDisposal,0);counts(privateDisposal,0);}
    first.dispose();first.dispose();counts(instanceDisposal,1);counts(privateDisposal,1);counts(sharedDisposal,0);second.update(events(),1.1,{actors:[owner]});finite(second,otherCamera);second.dispose();second.dispose();counts(sharedDisposal,1);
    const rebuiltCamera=new THREE.PerspectiveCamera(),rebuilt=createIagnuSkillFX(THREE,rebuiltCamera);assert.ok(!shared.has(pool(rebuilt,'serif I').geometry));rebuilt.dispose();
  });
  const camera=new THREE.PerspectiveCamera(),fx=createIagnuSkillFX(THREE,camera),stats={worldDraws:fx.group.children.length,maxHandDraws:1,textures:0,trianglesPerGeometry:fx.group.children.map(mesh=>(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3),capacities:fx.group.children.map(mesh=>mesh.instanceMatrix.count)};fx.dispose();
  console.log(`IAGNU skill FX tests passed: ${passed} groups; ${Number(process.hrtime.bigint()-started)/1e6}ms.`);console.log(JSON.stringify(stats));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
