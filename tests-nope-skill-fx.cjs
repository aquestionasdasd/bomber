const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function main(){
  const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [THREE,{createNopeSkillFX},{createCharacterSkills,skillProjectilePosition},{createNopeBottleModel},{createNopeFaceModel}]=await Promise.all([
    load('vendor/three.module.js'),load('nope-skill-fx.js'),load('character-skills.js'),load('nope-props.js'),load('nope-avatar.js'),
  ]);
  const owner={id:'caster',team:'blue',x:0,y:0,z:0,hp:100,alive:true};
  const point={x:0,y:0,z:-5};
  const json=value=>JSON.parse(JSON.stringify(value));
  const meshes=root=>{const result=[];root.traverse(object=>{if(object.isMesh)result.push(object);});return result;};
  const assets=root=>{
    const result=new Set();for(const mesh of meshes(root)){result.add(mesh.geometry);for(const material of [].concat(mesh.material)){result.add(material);for(const value of Object.values(material))if(value?.isTexture)result.add(value);}}return result;
  };
  const watch=resources=>{const counts=new Map();for(const resource of resources){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}return counts;};
  const count=(counts,expected)=>{for(const [resource,value] of counts)assert.equal(value,expected,`${resource.name||resource.type} disposed ${value} times`);};
  const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
  const finite=root=>{root.updateMatrixWorld(true);root.traverse(object=>assert.ok(object.matrixWorld.elements.every(Number.isFinite),object.name));};
  const events=()=>{const engine=createCharacterSkills();return ['nope-bottle','nope-flash','nope-decoy'].map(type=>engine.cast(type,owner,point,0,1));};
  let passed=0;const test=(name,fn)=>{fn();passed++;console.log(`PASS: ${name}`);};

  test('all three fixed event types render along authoritative curves and never intercept shots',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createNopeSkillFX(THREE,camera),data=events();
    fx.update(data,.2,{viewer:{x:5,z:5}});assert.equal(fx.group.visible,true);assert.equal(fx.group.userData.activeEvents,3);assert.equal(fx.group.children.length,3);
    for(let i=0;i<3;i++){
      const actual=fx.group.children[i].position,expected=skillProjectilePosition(data[i],.2);near(actual.x,expected.x);near(actual.y,expected.y);near(actual.z,expected.z);
    }
    for(const mesh of meshes(fx.group)){
      assert.equal(mesh.userData.solid,false);const hits=[];mesh.raycast(new THREE.Raycaster(),hits);assert.deepEqual(hits,[]);
      assert.equal(mesh.material.depthTest,true,'The normal world depth hides effects behind opaque geometry');
    }
    finite(fx.group);fx.update(data,1.2);assert.equal(fx.group.userData.activeEvents,2);
    const bottle=fx.group.children.find(child=>child.name.endsWith('nope-bottle'));assert.equal(bottle.children[0].visible,false);assert.equal(bottle.children[1].visible,true);
    assert.ok(bottle.children[1].scale.x>0&&bottle.children[1].scale.x<=8);
    fx.update([data[0]],data[0].endsAt-1e-6);assert.ok(bottle.children[1].scale.x>7.99,'The burst reaches the strengthened8m radius');
    fx.update(data,Math.max(...data.map(event=>event.endsAt)));assert.equal(fx.group.children.length,0);assert.equal(fx.group.visible,false);fx.dispose();fx.dispose();assert.equal(camera.children.length,0);
  });

  test('malformed, missing, inherited and nonfinite event fields are ignored instead of throwing or poisoning matrices',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createNopeSkillFX(THREE,camera),good=events()[0];
    const invalid=[null,0,{},[],{type:'constructor'}, {...good,fromX:undefined},{...good,flight:0},{...good,radius:Infinity},{...good,triggerAt:0},{...good,endsAt:100},
      {...good,id:'x'.repeat(10000)},{...good,id:'skill-nope-flash-1'},{...good,x:1001},{...good,y:NaN},{...good,fromY:'1.7'},{...good,startedAt:-1}];
    for(const value of invalid){assert.doesNotThrow(()=>fx.update([value],.2));assert.equal(fx.group.userData.activeEvents,0);finite(fx.group);}
    for(const now of [NaN,Infinity,-1,'0']){fx.update([good],.2);assert.doesNotThrow(()=>fx.update([good],now));assert.equal(fx.group.visible,false);finite(fx.group);}
    fx.update(events(),.2,{viewer:{x:NaN,z:Infinity}});finite(fx.group);fx.update(null,.2);assert.equal(fx.group.userData.activeEvents,0);
    fx.dispose();
  });

  test('event reconciliation deduplicates IDs, caps at twenty and removes expired or replaced visuals immediately',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createNopeSkillFX(THREE,camera),engine=createCharacterSkills(),many=[];
    for(let n=0;n<30;n++)many.push(engine.cast('nope-decoy',owner,point,0,1));
    fx.update([many[0],many[0],...many],1);assert.equal(fx.group.userData.activeEvents,20);assert.equal(fx.group.children.length,20);
    const first=fx.group.children[0];fx.update([many[0],many[0]],1);assert.equal(fx.group.children.length,1);assert.equal(fx.group.children[0],first);
    fx.update([{...many[0],type:'nope-bottle'}],1);assert.equal(fx.group.children.length,0,'A reused ID cannot silently swap face and bottle types');
    fx.update(many,many[0].endsAt);assert.equal(fx.group.children.length,0,'A late rejoin beyond the absolute expiry cannot restart visuals');
    fx.update(many,-1);assert.equal(fx.group.visible,false);fx.dispose();
  });

  test('repeated frames reuse resources and absolute-time motion reconstructs without new uploads',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createNopeSkillFX(THREE,camera),data=events();fx.update(data,.2,{viewer:owner});
    const initial=assets(fx.group),disposed=watch(initial),children=fx.group.children.slice(),versions=new Map([...initial].filter(resource=>resource.isTexture).map(resource=>[resource,resource.version]));
    const pose=()=>fx.group.children.map(child=>{child.updateMatrix();child.children[0].updateMatrix();return [...child.matrix.elements,...child.children[0].matrix.elements];});
    const expected=pose();
    for(let n=0;n<500;n++)fx.update(data,.2+n/5000,{viewer:owner});
    fx.update(data,.2,{viewer:owner});assert.deepEqual(pose(),expected);assert.deepEqual(fx.group.children,children);assert.deepEqual(assets(fx.group),initial);count(disposed,0);
    for(const [texture,version]of versions)assert.equal(texture.version,version);
    fx.update(data,.2,{viewer:owner,reducedMotion:true});const decoy=fx.group.children.find(child=>child.name.endsWith('nope-decoy'));assert.equal(decoy.children[0].position.y,1.4);
    fx.update(data,.8,{viewer:owner,reducedMotion:true});assert.equal(decoy.children[0].position.y,1.4);finite(fx.group);fx.dispose();
  });

  test('local throw feedback obeys its short interval, can hide in menus and retains only one reusable hand prop',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createNopeSkillFX(THREE,camera),hand=camera.getObjectByName('NOPE / throwing hand cue');
    for(const bad of [NaN,Infinity,-1])fx.playThrow('nope-bottle',bad);assert.equal(fx.throwing(0),false);
    fx.playThrow('nope-decoy',0);assert.equal(hand.children.length,0);
    fx.playThrow('nope-bottle',1);assert.equal(fx.throwing(.999),false);assert.equal(fx.throwing(1),true);assert.equal(fx.throwing(1.32),false);
    fx.update([],1.1,{showHand:true});assert.equal(hand.visible,true);assert.equal(hand.children.length,1);finite(camera);
    fx.update([],1.1,{showHand:false});assert.equal(hand.visible,false);
    const first=hand.children[0];fx.playThrow('nope-bottle',2);assert.equal(hand.children[0],first);
    fx.playThrow('nope-flash',3);assert.equal(hand.children.length,1);assert.notEqual(hand.children[0],first);
    fx.update([],3.24,{showHand:true});assert.equal(hand.visible,false);assert.equal(fx.throwing(3.24),true,'The gun remains hidden until the hand animation has cleared');
    fx.reset();assert.equal(fx.throwing(3.24),false);assert.equal(hand.visible,false);assert.equal(fx.group.userData.activeEvents,0);
    fx.dispose();fx.dispose();assert.equal(camera.children.length,0);fx.playThrow('nope-bottle',4);fx.update(events(),4);assert.equal(fx.group.visible,false);
  });

  test('world reset and disposal release only their leases; the last prop owner releases shared assets once',()=>{
    const outsideBottle=createNopeBottleModel(THREE),outsideFace=createNopeFaceModel(THREE),shared=watch(new Set([...assets(outsideBottle.group),...assets(outsideFace.group)]));
    const camera=new THREE.PerspectiveCamera(),fx=createNopeSkillFX(THREE,camera);fx.playThrow('nope-flash',0);fx.update(events(),.2,{showHand:true});
    const rings=fx.group.children.map(child=>child.children[1]),privateResources=new Set(rings.flatMap(mesh=>[mesh.geometry,mesh.material])),privateDisposal=watch(privateResources);
    assert.equal(privateResources.size,2,'All twenty events can share one small ring geometry/material');
    for(let n=0;n<100;n++){fx.update(events(),.2);fx.reset();assert.equal(fx.group.children.length,0);assert.equal(fx.group.userData.activeEvents,0);count(shared,0);count(privateDisposal,0);}
    fx.dispose();fx.dispose();count(privateDisposal,1);count(shared,0);assert.equal(camera.children.length,0);
    outsideBottle.dispose();outsideBottle.dispose();outsideFace.dispose();outsideFace.dispose();count(shared,1);
  });
  console.log(`NOPE skill FX tests passed: ${passed} groups.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
