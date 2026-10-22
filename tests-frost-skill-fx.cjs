const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
async function main(){
  const started=process.hrtime.bigint(),cpu=process.cpuUsage(),load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const[THREE,{createFrostSkillFX},{createCharacterSkills,skillProjectilePosition},{FROST_SKILLS}]=await Promise.all([load('vendor/three.module.js'),load('frost-skill-fx.js'),load('character-skills.js'),load('abilities.js')]);
  const owner={id:'caster',team:'blue',x:0,y:0,z:0,alive:true,hp:100,grounded:true,yaw:0};
  function events(y=0){const engine=createCharacterSkills(),actor={...owner,y};return[engine.cast('frost-stitch',actor,{x:0,y:y+.12,z:-8},0,1),engine.cast('frost-mist',actor,{x:0,y:y+1.4,z:-8},0,1),engine.cast('frost-unravel',actor,{x:0,y,z:0},0,1)];}
  const pool=(fx,token)=>{const mesh=fx.group.children.find(node=>node.name.includes(token));assert.ok(mesh,token);return mesh;};
  const meshes=root=>{const out=[];root.traverse(node=>{if(node.isMesh)out.push(node);});return out;};
  function resources(...roots){const out=new Set();for(const root of roots)for(const mesh of meshes(root)){out.add(mesh.geometry);for(const material of[].concat(mesh.material)){out.add(material);for(const item of Object.values(material))if(item?.isTexture)out.add(item);}}return out;}
  const watch=items=>{const counts=new Map();for(const item of items){counts.set(item,0);item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));}return counts;},counts=(items,n)=>{for(const[item,value]of items)assert.equal(value,n,item.name||item.type);};
  const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
  function pose(mesh,index=0){const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();mesh.getMatrixAt(index,matrix);matrix.decompose(p,q,s);return{matrix,p,q,s};}
  function finite(fx,camera){for(const root of[fx.group,camera]){root.updateMatrixWorld(true);root.traverse(node=>assert.ok(node.matrixWorld.elements.every(Number.isFinite),node.name));}for(const mesh of fx.group.children)for(let i=0;i<mesh.count*16;i++)assert.ok(Number.isFinite(mesh.instanceMatrix.array[i]));}
  const snapshot=fx=>fx.group.children.map(mesh=>({count:mesh.count,matrix:Array.from(mesh.instanceMatrix.array.slice(0,mesh.count*16)),color:Array.from(mesh.instanceColor.array.slice(0,mesh.count*3))}));
  let passed=0;function test(name,fn){fn();passed++;console.log(`PASS: ${name}`);}

  test('real C/Q engine projectiles keep the fixed raised-floor endpoints and shared .8 arc at20/60/144Hz',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createFrostSkillFX(THREE,camera),data=events(3.2),knot=pool(fx,'plaid clasps');assert.ok(data.every(Boolean));
    for(const event of data.slice(0,2))for(const hz of[20,60,144])for(const t of[0,.25,.5,.999]){const now=event.flight*t;fx.update([event],now);assert.equal(knot.count,1);const actual=pose(knot).p,expected=skillProjectilePosition(event,now);for(const key of['x','y','z'])close(actual[key],expected[key]);finite(fx,camera);}
    fx.update([data[0]],.55);close(pose(knot).p.y,3.32);close(pose(knot).p.z,-8);fx.dispose();
  });

  test('stitches show only supported thin inner/outer rings and cross ties, leaving all center/outer space empty',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createFrostSkillFX(THREE,camera),event=events(3.2)[0],ribbon=pool(fx,'supported inner'),groundHeight=()=>3.2,reachable=(origin,point)=>{close(Math.hypot(origin.x-event.x,origin.z-event.z),2.35);close(origin.y,3.2);close(point.y,3.2);return true;};
    fx.update([event],.549999,{groundHeight,reachable});assert.equal(ribbon.count,0);
    fx.update([event],.55,{groundHeight,reachable});assert.equal(ribbon.count,72);close(pose(ribbon).s.z,.009);
    fx.update([event],.8,{groundHeight,reachable});assert.equal(ribbon.count,72);close(pose(ribbon).s.z,.018);
    for(let i=0;i<ribbon.count;i++){const actual=pose(ribbon,i);close(actual.p.y,3.285);const points=ribbon.geometry.attributes.position;for(let j=0;j<points.count;j++){const p=new THREE.Vector3().fromBufferAttribute(points,j).applyMatrix4(actual.matrix),r=Math.hypot(p.x-event.x,p.z-event.z);assert.ok(r>=.9&&r<=3.8,`No ice in the safe center/outside: ${r}`);}}
    fx.update([event],8.8,{groundHeight,reachable});assert.equal(fx.group.visible,false);assert.equal(ribbon.count,0);fx.dispose();
  });

  test('ring support checks both ends/middle and short projected LOS; holes, upper floors, steps and bad callbacks fail closed',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createFrostSkillFX(THREE,camera),event=events()[0],ribbon=pool(fx,'supported inner'),yes=()=>true;
    for(const groundHeight of[undefined,()=>null,()=>NaN,()=>Infinity,()=>3.2,()=>.45001,()=>{throw Error('missing floor')}]){fx.update([event],1,{groundHeight,reachable:yes});assert.equal(ribbon.count,0);}
    for(const reachable of[undefined,()=>false,()=>1,()=>{throw Error('wall')}]){fx.update([event],1,{groundHeight:()=>0,reachable});assert.equal(ribbon.count,0);}
    fx.update([event],1,{groundHeight:()=>0,reachable:(_,point)=>point.x>=0});assert.ok(ribbon.count>0&&ribbon.count<72);for(let i=0;i<ribbon.count;i++)assert.ok(pose(ribbon,i).p.x>=0);
    fx.update([event],1,{groundHeight:(x,z)=>x>0?null:0,reachable:yes});assert.ok(ribbon.count>0&&ribbon.count<72);for(let i=0;i<ribbon.count;i++)assert.ok(pose(ribbon,i).p.x<=0);
    fx.update([event],1,{groundHeight:(x,z)=>x>.03?.44:x<-.03?-.44:0,reachable:yes});assert.ok(ribbon.count<72,'Segments crossing a .88m step cannot bridge it');
    fx.update([event],1,{groundHeight:(x,z)=>x*.1,reachable:yes});assert.ok(ribbon.count>0);for(let i=0;i<ribbon.count;i++){const p=pose(ribbon,i).p;close(p.y,p.x*.1+.085);}fx.dispose();
  });

  test('support cache is bounded/static, keyed by canonical geometry and both callbacks, and cleared on removal/reset',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createFrostSkillFX(THREE,camera),event=events()[0];let floorQueries=0,losQueries=0;const groundHeight=()=>{floorQueries++;return 0;},reachable=()=>{losQueries++;return true;};
    fx.update([event],1,{groundHeight,reachable});assert.equal(floorQueries,144);assert.equal(losQueries,108);for(let i=0;i<100;i++)fx.update([{...event}],1+i*.01,{groundHeight,reachable});assert.equal(floorQueries,144);assert.equal(losQueries,108);
    fx.update([{...event,x:.1}],2,{groundHeight,reachable});assert.equal(floorQueries,288);fx.update([event],2,{groundHeight,reachable:(...args)=>reachable(...args)});assert.equal(floorQueries,432);
    fx.update([event],2,{groundHeight:(...args)=>groundHeight(...args),reachable});assert.equal(floorQueries,576);fx.update([],2);fx.update([event],2,{groundHeight,reachable});assert.equal(floorQueries,720);fx.reset();fx.update([event],2,{groundHeight,reachable});assert.equal(floorQueries,864);
    let badQueries=0;const missing=()=>{badQueries++;return null;};fx.update([event],2,{groundHeight:missing,reachable});const n=badQueries;fx.update([event],2.1,{groundHeight:missing,reachable});assert.equal(badQueries,n,'A failed static support query is also cached');fx.dispose();
  });

  test('mist uses a single opaque fixed radius3.5 sphere from arrival through exact9s with no drift/extra faces',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createFrostSkillFX(THREE,camera),event=events(3.2)[1],mist=pool(fx,'fixed opaque');fx.update([event],.499999);assert.equal(mist.count,0);
    for(const now of[.5,1,3,9.499999]){fx.update([event],now);assert.equal(mist.count,1);const actual=pose(mist);close(actual.p.y,4.6);close(actual.p.z,-8);for(const size of actual.s.toArray())close(size,3.5);}
    assert.equal(mist.material.transparent,false);assert.equal(mist.material.opacity,1);assert.equal(mist.material.depthWrite,true);assert.equal(mist.material.side,THREE.DoubleSide);assert.equal(mist.geometry.index.count/3,1216);fx.update([event],9.5);assert.equal(mist.count,0);fx.dispose();
  });

  test('unravelling plaid stays on the current living grounded actor and cannot resume after air/death/removal/team changes',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createFrostSkillFX(THREE,camera),event=events()[2],source={...owner,x:5,y:3.2,z:7,yaw:Math.PI/2},original=JSON.stringify(source);fx.update([event],.5,{actors:[source]});const knot=pose(pool(fx,'plaid clasps'));close(knot.p.x,5);close(knot.p.y,3.32);close(knot.p.z,7);assert.equal(pool(fx,'supported inner').count,6);assert.equal(JSON.stringify(source),original);assert.equal(fx.throwing(.5),false);
    for(const actor of[null,{...source,grounded:false},{...source,alive:false},{...source,team:'red'}]){fx.reset();fx.update([event],.4,{actors:actor?[actor]:[]});assert.equal(fx.group.visible,false);fx.update([event],.5,{actors:[source]});assert.equal(fx.group.visible,false);}
    fx.reset();fx.update([event],4.999999,{actors:[source]});assert.equal(fx.group.visible,true);fx.update([event],5,{actors:[source]});assert.equal(fx.group.visible,false);fx.dispose();
  });

  test('engine source death preserves placed C/Q only, while reset clears the entire world/hand state',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createFrostSkillFX(THREE,camera),engine=createCharacterSkills();engine.cast('frost-stitch',owner,{x:0,y:.12,z:-8},0,1);engine.cast('frost-mist',owner,{x:0,y:1.4,z:-8},0,1);engine.cast('frost-unravel',owner,owner,0,1);engine.update([{...owner,alive:false,hp:0}],1,1);assert.deepEqual(engine.events(1).map(event=>event.type),['frost-stitch','frost-mist']);fx.update(engine.events(1),1,{actors:[],groundHeight:()=>0,reachable:()=>true});assert.equal(pool(fx,'fixed opaque').count,1);assert.equal(pool(fx,'supported inner').count,72);fx.playThrow('frost-mist',1);fx.update(engine.events(1),1.1,{showHand:true});assert.equal(camera.children[0].visible,true);fx.reset();assert.equal(fx.group.visible,false);assert.equal(camera.children[0].visible,false);assert.equal(fx.throwing(1.1),false);fx.dispose();
  });

  test('strict packets, duplicate suppression and20-event bounds retain finite reduced-motion nonhit resources',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createFrostSkillFX(THREE,camera),event=events()[0],bad=[null,[],{},Object.create(event),{...event,type:'__proto__'},{...event,id:'bad'},{...event,sourceId:'\0'},{...event,team:'green'},{...event,round:0},{...event,x:Infinity},{...event,y:1001},{...event,z:-16.001},{...event,flight:.5},{...event,triggerAt:1},{...event,endsAt:5},{...event,radius:3},{...event,innerRadius:.9}];fx.update(bad,1);assert.equal(fx.group.visible,false);
    const options={groundHeight:()=>0,reachable:()=>true,reducedMotion:true};fx.update([event,event],1,options);assert.equal(fx.group.userData.activeEvents,1);const first=snapshot(fx);fx.update([event],1,options);assert.deepEqual(snapshot(fx),first);
    fx.update(Array.from({length:200},(_,i)=>({...event,id:`skill-frost-stitch-${i+1}`})),1,options);assert.equal(fx.group.userData.activeEvents,20);assert.equal(pool(fx,'supported inner').count,1440);finite(fx,camera);
    for(const mesh of[...meshes(fx.group),...meshes(camera)]){assert.equal(mesh.userData.solid,false);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.material.depthTest,true);const hits=[];mesh.raycast(new THREE.Raycaster(),hits);assert.deepEqual(hits,[]);}assert.equal([...resources(fx.group,camera)].filter(item=>item.isTexture).length,0);
    for(const now of[NaN,Infinity,-1]){fx.update([event],now,{showHand:true});assert.equal(fx.group.visible,false);assert.equal(camera.children[0].visible,false);}fx.dispose();
  });

  test('C/Q only use .32s throw/.24s hand; E leaves weapon/camera transforms and controls untouched',()=>{
    const camera=new THREE.PerspectiveCamera(),fx=createFrostSkillFX(THREE,camera),hand=camera.children[0];fx.playThrow('frost-unravel',1);assert.equal(fx.throwing(1),false);
    for(const type of['frost-stitch','frost-mist']){fx.playThrow(type,2);assert.equal(fx.throwing(1.99),false);assert.equal(fx.throwing(2),true);assert.equal(fx.throwing(2.3199),true);assert.equal(fx.throwing(2.32),false);fx.update([],2.1,{showHand:true});assert.equal(hand.visible,true);finite(fx,camera);fx.update([],2.24,{showHand:true});assert.equal(hand.visible,false);fx.reset();}
    fx.cue('KeyQ',3);fx.update([],3.1,{showHand:false});assert.equal(hand.visible,false);fx.dispose();assert.equal(camera.children.length,0);
  });

  test('three fixed world batches and hand share six immutable leased resources and dispose exactly once',()=>{
    const camera=new THREE.PerspectiveCamera(),otherCamera=new THREE.PerspectiveCamera(),first=createFrostSkillFX(THREE,camera),second=createFrostSkillFX(THREE,otherCamera),all=resources(first.group,camera);assert.equal(all.size,6);assert.deepEqual(all,resources(second.group,otherCamera));assert.equal(first.group.children.length,3);assert.equal(meshes(camera).length,1);
    const shared=watch(all),instances=watch(first.group.children),data=events(),options={actors:[owner],groundHeight:()=>0,reachable:()=>true};for(let i=0;i<100;i++){first.update(data,1,options);assert.deepEqual(resources(first.group,camera),all);first.reset();counts(shared,0);}first.dispose();first.dispose();counts(shared,0);counts(instances,1);second.update(data,1,options);finite(second,otherCamera);second.dispose();second.dispose();counts(shared,1);
    const camera3=new THREE.PerspectiveCamera(),third=createFrostSkillFX(THREE,camera3);assert.ok(!all.has(pool(third,'plaid clasps').geometry));third.dispose();
  });
  const use=process.cpuUsage(cpu);console.log(`TOTAL: ${passed} FROST FX groups passed; wall ${Number(process.hrtime.bigint()-started)/1e6}ms; CPU ${(use.user+use.system)/1000}ms; 3 world/1 hand pools;0 textures; silent geometry only.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
