const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function main(){
  const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [THREE,{createMendSkillFX},{createCharacterSkills,skillProjectilePosition},{MEND_SKILLS}]=await Promise.all([load('vendor/three.module.js'),load('mend-skill-fx.js'),load('character-skills.js'),load('abilities.js')]);
  const owner={id:'caster',team:'blue',x:0,y:0,z:0,hp:100,alive:true};
  function events(){const engine=createCharacterSkills();return [engine.cast('mend-seeds',owner,{x:6,y:.12,z:-8},0,1),engine.cast('mend-pollen',owner,{x:4,y:1.7,z:-8},0,1),engine.cast('mend-heal',owner,{x:2,y:0,z:0,targetId:'friend'},0,1)];}
  const pool=(fx,token)=>{const mesh=fx.group.children.find(node=>node.name.includes(token));assert.ok(mesh,token);return mesh;};
  const meshes=root=>{const all=[];root.traverse(object=>{if(object.isMesh)all.push(object);});return all;};
  function resources(...roots){const result=new Set();for(const root of roots)for(const mesh of meshes(root)){result.add(mesh.geometry);for(const material of [].concat(mesh.material)){result.add(material);for(const value of Object.values(material))if(value?.isTexture)result.add(value);}}return result;}
  const watch=items=>{const counts=new Map();for(const item of items){counts.set(item,0);item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));}return counts;};
  const counts=(items,n)=>{for(const [item,value]of items)assert.equal(value,n,`${item.name||item.type} disposal ${value}`);};
  const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
  function pose(mesh,index=0){const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();mesh.getMatrixAt(index,matrix);matrix.decompose(p,q,s);return {matrix,p,q,s};}
  function finite(fx,camera){fx.group.updateMatrixWorld(true);camera.updateMatrixWorld(true);for(const root of [fx.group,camera])root.traverse(object=>assert.ok(object.matrixWorld.elements.every(Number.isFinite),object.name));for(const mesh of fx.group.children)for(let i=0;i<mesh.count*16;i++)assert.ok(Number.isFinite(mesh.instanceMatrix.array[i]));}
  const snapshot=fx=>fx.group.children.map(mesh=>({name:mesh.name,count:mesh.count,matrix:Array.from(mesh.instanceMatrix.array.slice(0,mesh.count*16)),color:Array.from(mesh.instanceColor.array.slice(0,mesh.count*3)),opacity:mesh.geometry.attributes.mendOpacity?Array.from(mesh.geometry.attributes.mendOpacity.array.slice(0,mesh.count)):null}));
  let passed=0;const test=(name,fn)=>{fn();passed++;console.log(`PASS: ${name}`);};

  test('actual seed/pollen projectiles follow the shared canonical curve and offsets exactly',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createMendSkillFX(THREE,camera),data=events(),projectiles=pool(fx,'seed clusters');assert.ok(data.every(Boolean));
    for(const now of [0,.1,.275,.325,.549]){
      fx.update(data,now);assert.equal(projectiles.count,2);
      for(let i=0;i<2;i++){const actual=pose(projectiles,i).p,expected=skillProjectilePosition(data[i],now);close(actual.x,expected.x);close(actual.y,expected.y);close(actual.z,expected.z);}
    }
    close(skillProjectilePosition(data[0],.325).y,(1.7+.12)/2+1.4);close(skillProjectilePosition(data[1],.275).y,1.7+.8);
    fx.update(data,.55);assert.equal(projectiles.count,1);assert.equal(pool(fx,'opaque warm pollen').count,1);
    fx.update(data,.65);assert.equal(projectiles.count,0);assert.equal(pool(fx,'ground growth').count,12);
    const border=pose(pool(fx,'seed borders'));close(border.p.y,.095);close(border.s.x,4.5);
    fx.update(data,Math.max(...data.map(event=>event.endsAt)));assert.equal(fx.group.visible,false);assert.equal(fx.group.userData.activeEvents,0);assert.ok(fx.group.children.every(mesh=>mesh.count===0&&!mesh.visible));fx.dispose();
  });

  test('pollen is a fixed opaque two-sided depth-tested4.2m sphere for9s and every decoration is nonhit',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createMendSkillFX(THREE,camera),data=events(),cloud=pool(fx,'opaque warm pollen');
    for(const now of [.55,1,4,9.549999]){fx.update(data,now);assert.equal(cloud.count,1);const p=pose(cloud);close(p.p.y,1.7);close(p.s.x,4.2);close(p.s.y,MEND_SKILLS.pollenRadius);close(p.s.z,MEND_SKILLS.pollenRadius);}
    fx.update(data,9.55);assert.equal(cloud.count,0,'Pollen expires at its exact strengthened boundary');
    assert.equal(cloud.material.side,THREE.DoubleSide);assert.equal(cloud.material.transparent,false);assert.ok(cloud.material.opacity>=.98);assert.equal(cloud.material.depthWrite,true);assert.equal(cloud.material.depthTest,true);
    fx.update(data,1);fx.group.updateMatrixWorld(true);
    for(const origin of [[4,1.7,1],[4,1.7,-8]]){const ray=new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(0,0,-1)),hits=[];THREE.InstancedMesh.prototype.raycast.call(cloud,ray,hits);assert.ok(hits.length,'Both outside and inside the actual cloud see its enclosing surface');}
    for(const root of [fx.group,camera])for(const mesh of meshes(root)){assert.equal(mesh.userData.solid,false);assert.equal(mesh.castShadow,false);const hits=[];mesh.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0);assert.equal(mesh.material.depthTest,true);}
    const colors=cloud.geometry.attributes.color;assert.ok(colors.count>500);assert.ok(new Set(Array.from(colors.array).map(value=>value.toFixed(3))).size>20,'Pollen has restrained volume-color variation rather than a plain unlit ball');
    fx.dispose();
  });

  test('malformed/inherited/out-of-date events are ignored without nonfinite poses or fake support',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createMendSkillFX(THREE,camera),good=events()[0],heal=events()[2];
    const bad=[null,0,[],{},Object.create(good),{type:'constructor'},{...good,type:'mend-heal'},{...good,id:'skill-mend-pollen-1'},{...good,sourceId:''},{...good,round:0},{...good,team:'green'},{...good,flight:.4},{...good,radius:Infinity},{...good,fromY:undefined},{...good,y:NaN},{...good,x:1001},{...good,triggerAt:0},{...good,endsAt:40},{...good,startedAt:-1},{...heal,targetId:undefined}];
    for(const event of bad){assert.doesNotThrow(()=>fx.update([event],.2));assert.equal(fx.group.userData.activeEvents,0);finite(fx,camera);}
    for(const now of [NaN,Infinity,-1,'1']){fx.update(events(),.2);fx.update(events(),now);assert.equal(fx.group.visible,false);finite(fx,camera);}
    fx.update([good],-.01);assert.equal(fx.group.visible,false);fx.update([good],good.endsAt);assert.equal(fx.group.visible,false);fx.update(null,.2);assert.equal(fx.group.visible,false);fx.dispose();
  });

  test('twenty-event pools deduplicate, cap input and release removed visual instances immediately',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createMendSkillFX(THREE,camera),engine=createCharacterSkills(),many=[];
    for(let i=0;i<30;i++)many.push(engine.cast('mend-seeds',owner,{x:4,y:.12,z:-6},0,1));
    fx.update([many[0],many[0],...many],1);assert.equal(fx.group.userData.activeEvents,20);assert.equal(pool(fx,'ground growth').count,240);assert.equal(pool(fx,'seed borders').count,20);
    assert.equal(fx.group.children.length,5);assert.ok(fx.group.children.every(mesh=>mesh.count<=mesh.instanceMatrix.count));
    fx.update([many[0]],1);assert.equal(fx.group.userData.activeEvents,1);assert.equal(pool(fx,'ground growth').count,12);fx.update([],1);assert.equal(fx.group.userData.activeEvents,0);assert.ok(fx.group.children.every(mesh=>mesh.count===0));
    const seeds=pool(fx,'seed clusters').geometry,bloom=pool(fx,'ground growth').geometry;assert.ok(seeds.attributes.position.count>600&&bloom.attributes.position.count>1000,'Striped seeds, curved petals, leaves and flower centres are actual3D shapes');
    fx.dispose();
  });

  test('absolute times reconstruct identical particles/flowers and reduced motion retains cloud bounds',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createMendSkillFX(THREE,camera),data=events();fx.update(data,1);const assets=resources(fx.group,camera),disposed=watch(assets),expected=snapshot(fx);
    for(let i=0;i<500;i++)fx.update(data,1+i/1000);fx.update(data,1);assert.deepEqual(snapshot(fx),expected);assert.deepEqual(resources(fx.group,camera),assets);counts(disposed,0);
    const secondCamera=new THREE.PerspectiveCamera(),late=createMendSkillFX(THREE,secondCamera);late.update(JSON.parse(JSON.stringify(data)),1);assert.deepEqual(snapshot(late),expected,'A late join reconstructs the same pose without replaying the throw');
    fx.update(data,1,{reducedMotion:true});const c1=pose(pool(fx,'opaque warm pollen')).matrix.toArray(),particles=snapshot(fx).at(-1).matrix;
    fx.update(data,3,{reducedMotion:true});assert.deepEqual(pose(pool(fx,'opaque warm pollen')).matrix.toArray(),c1);assert.deepEqual(snapshot(fx).at(-1).matrix,particles,'Reduced motion freezes pollen drift and tumbling');
    late.dispose();counts(disposed,0);fx.dispose();counts(disposed,1);
  });

  test('healing follows the target endpoint for only.8sec, gently fades, and hand cues clean up',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createMendSkillFX(THREE,camera),heal=events()[2],rings=pool(fx,'seed borders'),particles=pool(fx,'petal and pollen');
    fx.update([heal],.4);assert.equal(fx.group.userData.activeEvents,1);assert.equal(rings.count,3);assert.equal(particles.count,8);for(let i=0;i<3;i++){const p=pose(rings,i).p;close(p.x,heal.x);close(p.z,heal.z);}
    const opacity=rings.geometry.attributes.mendOpacity.array[0];assert.ok(opacity>.6&&opacity<=.65);fx.update([heal],.799);assert.ok(rings.geometry.attributes.mendOpacity.array[0]<.01);fx.update([heal],.8);assert.equal(rings.count,0);
    for(const invalid of [NaN,Infinity,-1])fx.cue('c',invalid);assert.equal(fx.throwing(0),false);fx.cue('x',0);assert.equal(fx.throwing(0),false);
    fx.cue('KeyC',2);assert.equal(fx.throwing(2),true);const hand=camera.getObjectByName('MEND / botanical hand cue');fx.update([],2.1,{showHand:true});assert.equal(hand.visible,true);assert.equal(hand.children.length,1);const first=hand.children[0];
    assert.equal(first.geometry,pool(fx,'seed clusters').geometry);
    fx.playThrow('mend-pollen',3);fx.update([],3.1,{showHand:true,reducedMotion:true});assert.equal(hand.children[0],first);assert.equal(first.geometry,pool(fx,'ground growth').geometry,'Q presents the shared sunflower instead of a seed cluster');close(hand.position.y,-.30);fx.update([],3.1,{showHand:false});assert.equal(hand.visible,false);
    fx.update([],3.24,{showHand:true});assert.equal(hand.visible,false);assert.equal(fx.throwing(3.24),true);fx.reset();assert.equal(fx.throwing(3.24),false);assert.equal(hand.visible,false);
    fx.cue('e',4);fx.update([],4.1,{showHand:true});assert.equal(first.geometry,pool(fx,'ground growth').geometry,'E presents the same small3D flower without allocating');assert.equal(fx.throwing(4),true);assert.equal(fx.throwing(4.319),true);assert.equal(fx.throwing(4.32),false);fx.update([],4.24,{showHand:true});assert.equal(hand.visible,false);
    fx.dispose();fx.dispose();assert.equal(camera.children.length,0);fx.cue('q',5);fx.update(events(),5,{showHand:true});assert.equal(fx.group.visible,false);
  });

  test('shared meshes/materials outlive borrowers, per-owner opacity buffers do not leak and final disposal occurs once',()=>{
    const camera=new THREE.PerspectiveCamera(),otherCamera=new THREE.PerspectiveCamera(),first=createMendSkillFX(THREE,camera),second=createMendSkillFX(THREE,otherCamera),data=events();
    for(const name of ['seed clusters','ground growth','opaque warm pollen']){assert.equal(pool(first,name).geometry,pool(second,name).geometry);assert.equal(pool(first,name).material,pool(second,name).material);}
    for(const name of ['seed borders','petal and pollen']){assert.notEqual(pool(first,name).geometry,pool(second,name).geometry);assert.equal(pool(first,name).material,pool(second,name).material);}
    const all=resources(first.group,camera),other=resources(second.group,otherCamera),shared=new Set([...all].filter(item=>other.has(item))),privateResources=new Set([...all].filter(item=>!other.has(item)));
    assert.equal(shared.size,6,'Three immutable geometries and three materials are shared');assert.equal(privateResources.size,2,'Only ring and particle opacity geometry is owner-local');
    assert.equal([...all].filter(item=>item.isTexture).length,0);const sharedDisposal=watch(shared),privateDisposal=watch(privateResources),instanceDisposal=watch(first.group.children);
    const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};pool(first,'seed borders').material.onBeforeCompile(shader);assert.ok(shader.vertexShader.includes('attribute float mendOpacity'));assert.ok(shader.fragmentShader.includes('diffuseColor.a *= vMendOpacity'));
    for(let i=0;i<100;i++){first.update(data,1);first.reset();assert.equal(first.group.visible,false);assert.equal(first.group.children.length,5);counts(sharedDisposal,0);counts(privateDisposal,0);}
    first.dispose();first.dispose();counts(privateDisposal,1);counts(instanceDisposal,1);counts(sharedDisposal,0);second.update(data,1);finite(second,otherCamera);second.dispose();second.dispose();counts(sharedDisposal,1);
    const rebuiltCamera=new THREE.PerspectiveCamera(),rebuilt=createMendSkillFX(THREE,rebuiltCamera);assert.ok(!shared.has(pool(rebuilt,'seed clusters').geometry));rebuilt.dispose();
  });
  const camera=new THREE.PerspectiveCamera(),fx=createMendSkillFX(THREE,camera);fx.update(events(),1);
  const stats={worldBatches:fx.group.children.length,maxHandDraws:1,baseTriangles:Object.fromEntries(fx.group.children.map(mesh=>[mesh.name,(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3])),capacity:Object.fromEntries(fx.group.children.map(mesh=>[mesh.name,mesh.instanceMatrix.count])),textures:[...resources(fx.group,camera)].filter(resource=>resource.isTexture).length};fx.dispose();
  console.log(`MEND skill FX tests passed: ${passed} groups.`);console.log(JSON.stringify(stats));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
