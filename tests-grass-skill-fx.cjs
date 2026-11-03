const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function main(){
  const started=process.hrtime.bigint(),load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [THREE,{createGrassSkillFX},{createCharacterSkills},{VEIL_SKILLS}]=await Promise.all([load('vendor/three.module.js'),load('grass-skill-fx.js'),load('character-skills.js'),load('abilities.js')]);
  const owner={id:'caster',team:'blue',x:0,y:0,z:0,hp:100,alive:true,grounded:true,yaw:0};
  function events(y=0,endY=y){const engine=createCharacterSkills(),actor={...owner,y};return [engine.cast('veil-dust',actor,{x:0,y:y+1.25,z:0},0,1),engine.cast('veil-roots',actor,{x:0,y:endY,z:-7},0,1),engine.cast('veil-turf',actor,{x:0,y,z:0},0,1)];}
  const pool=(fx,token)=>{const mesh=fx.group.children.find(node=>node.name.includes(token));assert.ok(mesh,token);return mesh;};
  const meshes=root=>{const result=[];root.traverse(node=>{if(node.isMesh)result.push(node);});return result;};
  function resources(...roots){const result=new Set();for(const root of roots)for(const mesh of meshes(root)){result.add(mesh.geometry);for(const material of [].concat(mesh.material)){result.add(material);for(const value of Object.values(material))if(value?.isTexture)result.add(value);}}return result;}
  const watch=items=>{const counts=new Map();for(const item of items){counts.set(item,0);item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));}return counts;};
  const counts=(items,n)=>{for(const [item,value]of items)assert.equal(value,n,`${item.name||item.type}: disposal ${value}`);};
  const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
  function pose(mesh,index=0){const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();mesh.getMatrixAt(index,matrix);matrix.decompose(p,q,s);return {matrix,p,q,s};}
  function finite(fx,camera){fx.group.updateMatrixWorld(true);camera.updateMatrixWorld(true);for(const root of [fx.group,camera])root.traverse(node=>assert.ok(node.matrixWorld.elements.every(Number.isFinite),node.name));for(const mesh of fx.group.children)for(let i=0;i<mesh.count*16;i++)assert.ok(Number.isFinite(mesh.instanceMatrix.array[i]));}
  const snapshot=fx=>fx.group.children.map(mesh=>({count:mesh.count,matrix:Array.from(mesh.instanceMatrix.array.slice(0,mesh.count*16)),color:Array.from(mesh.instanceColor.array.slice(0,mesh.count*3))}));
  let passed=0;const test=(name,fn)=>{fn();passed++;console.log(`PASS: ${name}`);};

  test('real cast dust is a fixed opaque radius3.5 sphere from .2 through13.2s, including raised floors',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createGrassSkillFX(THREE,camera),data=events(3.2);assert.ok(data.every(Boolean));const dust=pool(fx,'fixed opaque');
    fx.update([data[0]],.199);assert.equal(fx.group.visible,false);
    for(const now of [.2,.3,1,7.2,13.199999]){fx.update([data[0]],now);assert.equal(dust.count,1);const actual=pose(dust);close(actual.p.x,0);close(actual.p.y,4.45);close(actual.p.z,0);assert.deepEqual(actual.s.toArray(),[3.5,3.5,3.5]);}
    assert.equal(dust.material.transparent,false);assert.equal(dust.material.opacity,1);assert.equal(dust.material.depthWrite,true);assert.equal(dust.material.side,THREE.DoubleSide);
    fx.update([data[0]],13.2);assert.equal(dust.count,0);assert.equal(fx.group.visible,false);fx.dispose();
  });

  test('roots follow callback floor at+.085 with no visual support creation and exact arm/expiry',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createGrassSkillFX(THREE,camera),event=events(3.2)[1],root=pool(fx,'branching roots'),queries=[];
    const groundHeight=(x,z,referenceY)=>{queries.push({x,z,referenceY});return 3.2;};
    fx.update([event],.249,{groundHeight,reducedMotion:true});assert.equal(fx.group.visible,false);assert.equal(queries.length,0);
    fx.update([event],.25,{groundHeight,reducedMotion:true});assert.equal(root.count,140);assert.ok(queries.length>=14*5*3);
    for(let i=0;i<root.count;i++){const actual=pose(root,i);close(actual.p.y,3.285);assert.ok(Math.abs(actual.p.x)<=1.6);assert.ok(actual.p.z<=0&&actual.p.z>=-7);}
    assert.ok(Array.from({length:root.count},(_,i)=>Math.abs(pose(root,i).p.x)).some(x=>x>1.25),'Branch centers extend beyond the old1.2m half-width with the strengthened3.2m band');
    assert.ok(queries.every(point=>Math.abs(point.referenceY-3.2)<1e-9));assert.ok(root.count<=root.instanceMatrix.count);finite(fx,camera);
    fx.update([event],8.25,{groundHeight});assert.equal(root.count,0);assert.equal(fx.group.visible,false);fx.dispose();
  });

  test('root branches reject missing, thrown, nonfinite, unsupported and vertically mismatched terrain',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createGrassSkillFX(THREE,camera),event=events()[1],root=pool(fx,'branching roots');
    for(const groundHeight of [undefined,()=>null,()=>{throw Error('no support')},()=>NaN,()=>Infinity,()=>3.2,()=>.45001]){fx.update([event],1,{groundHeight});assert.equal(root.count,0);assert.equal(fx.group.visible,false);}
    const gap=(x,z)=>z>-4&&z<-3?null:0;fx.update([event],1,{groundHeight:gap});assert.ok(root.count>0&&root.count<140);
    for(let i=0;i<root.count;i++){const actual=pose(root,i);assert.ok(actual.p.z<=-4||actual.p.z>=-3,'No root fills the missing floor');}
    const slopeEvent=events(0,.42)[1],slope=(x,z)=>-z*.06;fx.update([slopeEvent],1,{groundHeight:slope});assert.ok(root.count>0);
    for(let i=0;i<root.count;i++){const actual=pose(root,i);close(actual.p.y,slope(actual.p.x,actual.p.z)+.085);}
    fx.dispose();
  });

  test('static root support queries are cached by event geometry/callback and discarded on removal/reset',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createGrassSkillFX(THREE,camera),event=events()[1];let queries=0;
    const groundHeight=()=>{queries++;return 0;};fx.update([event],1,{groundHeight});const firstQueries=queries;assert.ok(firstQueries>=210);
    const first=snapshot(fx);for(let frame=0;frame<120;frame++)fx.update([{...event}],1+frame/120,{groundHeight});assert.equal(queries,firstQueries,'Repeated JSON snapshots of the same static band do not query terrain each frame');assert.deepEqual(snapshot(fx),first);
    fx.update([{...event,fromX:1,x:1}],2,{groundHeight});assert.ok(queries>firstQueries,'Changed coordinates under the same ID invalidate cached support');const movedQueries=queries;
    fx.update([{...event,fromX:1,x:1}],2.1,{groundHeight:()=>{queries++;return null;}});assert.ok(queries>movedQueries);assert.equal(fx.group.visible,false,'A different floor provider cannot borrow the old support');
    fx.update([],2.2,{groundHeight});const before=queries;fx.update([event],2.3,{groundHeight});assert.ok(queries>before,'An event removed from the packet drops its surface cache');
    fx.reset();const resetQueries=queries;fx.update([event],2.4,{groundHeight});assert.ok(queries>resetQueries);
    const twenty=Array.from({length:20},(_,index)=>({...event,z:-10,id:`skill-veil-roots-${index+1}`}));fx.reset();queries=0;fx.update(twenty,1,{groundHeight});const maxQueries=queries;assert.equal(pool(fx,'branching roots').instanceMatrix.count,4000);assert.equal(pool(fx,'branching roots').count,4000,'Every one of20 maximum10m bands has200root instances without truncating later events');assert.ok(maxQueries<=6400);
    fx.update(twenty,2,{groundHeight});assert.equal(queries,maxQueries,'Twenty maximum-length bands also reuse their static support');finite(fx,camera);fx.dispose();
  });

  test('turf follows the living grounded source, airborne/dead/missing source cannot resume a stale event',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createGrassSkillFX(THREE,camera),event=events()[2],source={...owner,x:4,y:3.2,z:-2,yaw:.7},flecks=pool(fx,'soil grains');
    const original=JSON.stringify(source),cameraPose=JSON.stringify([camera.position.toArray(),camera.rotation.toArray()]);
    fx.update([event],.2,{actors:[source],groundHeight:()=>3.2});assert.equal(flecks.count,12);const first=pose(flecks).p.clone();close(first.y,3.305);
    fx.update([event],.3,{actors:[{...source,x:8,z:1}],groundHeight:()=>3.2});const next=pose(flecks).p;close(next.x-first.x,4);close(next.z-first.z,3);
    assert.equal(JSON.stringify(source),original);assert.equal(JSON.stringify([camera.position.toArray(),camera.rotation.toArray()]),cameraPose);
    for(const actor of [{...source,grounded:false},{...source,alive:false},null]){fx.reset();fx.update([event],.2,{actors:actor?[actor]:[],groundHeight:()=>3.2});assert.equal(fx.group.visible,false);fx.update([event],.3,{actors:[source],groundHeight:()=>3.2});assert.equal(fx.group.visible,false,'A stale snapshot cannot revive ended turf');}
    fx.reset();fx.update([event],2.999999,{actors:[source],groundHeight:()=>3.2});assert.equal(fx.group.visible,true);fx.update([event],3,{actors:[source],groundHeight:()=>3.2});assert.equal(fx.group.visible,false);fx.dispose();
  });

  test('authoritative source removal retains placed dust/roots and permanently removes turf',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createGrassSkillFX(THREE,camera),engine=createCharacterSkills();
    const data=[engine.cast('veil-dust',owner,{x:0,y:1.25,z:0},0,1),engine.cast('veil-roots',owner,{x:0,y:0,z:-7},0,1),engine.cast('veil-turf',owner,{x:0,y:0,z:0},0,1)];
    engine.update([{...owner,alive:false,hp:0}],.4,1);const remaining=engine.events(.4);assert.deepEqual(remaining.map(event=>event.type),['veil-dust','veil-roots']);
    fx.update(remaining,.4,{actors:[],groundHeight:()=>0});assert.equal(pool(fx,'fixed opaque').count,1);assert.ok(pool(fx,'branching roots').count>0);
    engine.update([owner],.5,1);assert.equal(engine.events(.5).some(event=>event.type==='veil-turf'),false);fx.reset();assert.equal(fx.group.visible,false);fx.dispose();
  });

  test('strict bounded packets, duplicate IDs and reduced motion preserve finite fixed resources and nonhit geometry',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createGrassSkillFX(THREE,camera),event=events()[0],invalid=[null,[],{},Object.create(event),{...event,type:'__proto__'},{...event,id:'bad'},{...event,sourceId:'\0'},{...event,team:'green'},{...event,round:0},{...event,y:Infinity},{...event,x:1001},{...event,fromY:1001},{...event,flight:.1},{...event,radius:3},{...event,triggerAt:.3},{...event,endsAt:5}];
    fx.update(invalid,1);assert.equal(fx.group.visible,false);fx.update([event,event],1,{reducedMotion:true});assert.equal(fx.group.userData.activeEvents,1);const first=snapshot(fx);fx.update([event],1,{reducedMotion:true});assert.deepEqual(snapshot(fx),first);
    fx.update(Array.from({length:200},(_,index)=>({...event,id:`skill-veil-dust-${index+1}`})),1);assert.equal(fx.group.userData.activeEvents,20);assert.equal(pool(fx,'fixed opaque').count,20);assert.equal(pool(fx,'soil grains').count,480);finite(fx,camera);
    for(const mesh of [...meshes(fx.group),...meshes(camera)]){assert.equal(mesh.userData.solid,false);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.material.depthTest,true);const hits=[];mesh.raycast(new THREE.Raycaster(),hits);assert.deepEqual(hits,[]);}
    assert.equal([...resources(fx.group,camera)].filter(resource=>resource.isTexture).length,0);
    for(const now of [NaN,Infinity,-1]){fx.update([event],now);assert.equal(fx.group.visible,false);}fx.dispose();
  });

  test('C/Q hand timing stays bounded and E never creates throw lock or hides the weapon',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createGrassSkillFX(THREE,camera),hand=camera.children[0];
    fx.playThrow('veil-turf',1);assert.equal(fx.throwing(1),false);fx.update([],1,{showHand:true});assert.equal(hand.visible,false);
    for(const type of ['veil-dust','veil-roots']){fx.playThrow(type,2);assert.equal(fx.throwing(1.99),false);assert.equal(fx.throwing(2),true);assert.equal(fx.throwing(2.3199),true);assert.equal(fx.throwing(2.32),false);fx.update([],2.1,{showHand:true});assert.equal(hand.visible,true);finite(fx,camera);fx.update([],2.24,{showHand:true});assert.equal(hand.visible,false);fx.reset();assert.equal(fx.throwing(2.1),false);}
    fx.cue('KeyQ',3);fx.update([],3.1,{showHand:false});assert.equal(hand.visible,false);fx.dispose();assert.equal(camera.children.length,0);fx.playThrow('veil-dust',4);fx.update(events(),4);assert.equal(fx.group.visible,false);
  });

  test('all three batches and hand share immutable resources, borrow safely and dispose exactly once',()=>{
    const camera=new THREE.PerspectiveCamera(),otherCamera=new THREE.PerspectiveCamera(),first=createGrassSkillFX(THREE,camera),second=createGrassSkillFX(THREE,otherCamera),all=resources(first.group,camera),other=resources(second.group,otherCamera);
    assert.equal(all.size,6);assert.deepEqual(all,other);const sharedDisposal=watch(all),instanceDisposal=watch([...first.group.children,...meshes(camera)]);
    for(let i=0;i<100;i++){first.update(events(),.6,{actors:[owner],groundHeight:()=>0});assert.deepEqual(resources(first.group,camera),all);first.reset();counts(sharedDisposal,0);}
    first.dispose();first.dispose();counts(sharedDisposal,0);counts(instanceDisposal,1);second.update(events(),.6,{actors:[owner],groundHeight:()=>0});finite(second,otherCamera);second.dispose();second.dispose();counts(sharedDisposal,1);
    const rebuiltCamera=new THREE.PerspectiveCamera(),rebuilt=createGrassSkillFX(THREE,rebuiltCamera);assert.ok(!all.has(pool(rebuilt,'fixed opaque').geometry));rebuilt.dispose();
  });
  const camera=new THREE.PerspectiveCamera(),fx=createGrassSkillFX(THREE,camera),stats={worldDraws:fx.group.children.length,maxHandDraws:1,textures:0,trianglesPerGeometry:fx.group.children.map(mesh=>(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3),capacities:fx.group.children.map(mesh=>mesh.instanceMatrix.count),constants:VEIL_SKILLS};fx.dispose();
  console.log(`Grass skill FX tests passed: ${passed} groups; ${Number(process.hrtime.bigint()-started)/1e6}ms.`);console.log(JSON.stringify(stats));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
