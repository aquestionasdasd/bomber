const assert=require('node:assert/strict');
(async()=>{
 const T=await import('./public/vendor/three.module.js'),{createCharacterSkills,skillProjectilePosition}=await import('./public/character-skills.js'),{PREPARED_SKILL_PROPS,preparedSkillType,createPreparedSkillFX}=await import('./public/prepared-skill-fx.js'),{createNobiSkillFX}=await import('./public/nobi-skill-fx.js');
 let groups=0;const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);},near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' != '+b),owner={id:'owner',team:'blue',alive:true,hp:100,x:0,y:0,z:0};
 const event=type=>{const h=createCharacterSkills(),target=type==='urchin-gloom'?{x:0,y:1.7,z:-36}:{x:0,y:0,z:-10,yaw:0};const e=h.cast(type,owner,target,10,1);assert.ok(e,type);return e;};
 const meshes=g=>{const a=[];g.traverse(o=>{if(o.isMesh)a.push(o);});return a;};
 const finite=g=>{g.updateMatrixWorld(true);g.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),o.name));};
 test('nine aimed throws/placements map to distinct colors; direct target skills and Renko instant dart stay unchanged',()=>{
  assert.equal(Object.keys(PREPARED_SKILL_PROPS).length,9);assert.equal(new Set(Object.values(PREPARED_SKILL_PROPS).map(p=>p.color)).size,9);
  for(const [c,keys]of Object.entries({nobi:['c','q','e','x'],onnara:['q'],urchin:['e'],duck:['c','q'],japan:['c']}))for(const k of keys)assert.ok(preparedSkillType(c,k),c+k);
  for(const [c,k]of[['car','c'],['cat','e'],['cap','q'],['renko','c'],['nope','c']])assert.equal(preparedSkillType(c,k),null);
 });
 test('held item has real hand/fingers and consistent factory model/color; no random, hitbox or extra light',()=>{
  const camera=new T.PerspectiveCamera(76,1.6,.05,500),fx=createPreparedSkillFX(T,camera),old=Math.random;Math.random=()=>{throw Error('presentation consumed combat random')};
  try{for(const type of Object.keys(PREPARED_SKILL_PROPS)){fx.update([],10,{active:true,armedType:type,character:'nobi',round:1});assert.ok(fx.hand.visible);const p=fx.hand.getObjectByName('Skill prop / '+type);assert.ok(p);assert.equal(p.userData.color,PREPARED_SKILL_PROPS[type].color);assert.equal(meshes(fx.hand).filter(o=>!o.name.startsWith('Skill prop')).length>=6,true);finite(fx.hand);for(const o of meshes(fx.hand)){assert.equal(o.userData.solid,false);const hits=[];o.raycast(new T.Raycaster(),hits);assert.equal(hits.length,0);assert.equal(o.material.depthTest,true);}fx.hand.traverse(o=>assert.ok(!o.isLight));}}
  finally{Math.random=old;fx.dispose();}assert.equal(camera.children.length,0);
 });
 test('each confirmed item follows immutable event pose; Nobi uses the same silhouette in flight and after landing',()=>{
  for(const type of Object.keys(PREPARED_SKILL_PROPS)){const camera=new T.PerspectiveCamera(),fx=createPreparedSkillFX(T,camera),e=event(type),before=JSON.stringify(e),start=type==='urchin-gloom'?e.triggerAt:e.startedAt,now=start+(e.flight||.24)/2;
   fx.update([e],now,{round:1});assert.equal(fx.group.children.length,1,type);const o=fx.group.children[0];assert.equal(o.userData.shape,PREPARED_SKILL_PROPS[type].shape);assert.equal(o.userData.color,PREPARED_SKILL_PROPS[type].color);if(e.flight){const p=skillProjectilePosition(e,now);near(o.position.x,p.x);near(o.position.y,p.y);near(o.position.z,p.z);}finite(fx.group);assert.equal(JSON.stringify(e),before);
   if(type.startsWith('nobi-')){const n=createNobiSkillFX(T);n.update([e],now,{externalProps:true});assert.equal(n.group.children[0].children[0].visible,false,'one projectile');n.update([e],e.triggerAt+.1,{externalProps:true});const p=n.group.children[0].children[0];assert.equal(p.visible,true);assert.equal(p.children[0].userData.shape,o.userData.shape);assert.equal(p.children[0].userData.color,o.userData.color);n.dispose();}fx.dispose();
  }
 });
 test('local release starts at the held item then joins approved arc; mid-flight join never replays from hand',()=>{
  const camera=new T.PerspectiveCamera(),fx=createPreparedSkillFX(T,camera),e=event('nobi-bell');fx.update([],10,{active:true,armedType:e.type,round:1});const at=fx.hand.getWorldPosition(new T.Vector3());fx.release(e.type,10,'owner',1);fx.update([e],10,{round:1});near(fx.group.children[0].position.x,at.x);near(fx.group.children[0].position.y,at.y);near(fx.group.children[0].position.z,at.z);assert.equal(fx.hand.visible,false);assert.ok(fx.throwing(10.1));assert.equal(fx.throwing(10.25),false);
  fx.update([e],10.3,{round:1});const p=skillProjectilePosition(e,10.3);near(fx.group.children[0].position.z,p.z);fx.dispose();const join=createPreparedSkillFX(T,camera);join.update([e],10.3,{round:1});near(join.group.children[0].position.z,p.z);join.dispose();
 });
 test('cancel/pause/death/round/menu visibility and reset leave no held item or stale flight',()=>{
  const c=new T.PerspectiveCamera(),fx=createPreparedSkillFX(T,c),e=event('nobi-bell');fx.update([e],10.2,{active:true,armedType:e.type,round:1});assert.ok(fx.hand.visible);fx.update([e],10.2,{active:false,armedType:e.type,round:2});assert.equal(fx.hand.visible,false);assert.equal(fx.group.children.length,0);fx.update([],10.2,{active:true,armedType:null,round:1});assert.equal(fx.hand.visible,false);fx.reset();assert.equal(fx.throwing(10),false);fx.dispose();fx.dispose();assert.equal(c.children.length,0);
 });
 test('duplicates, old round, inherited/malformed/nonfinite rows and event cap cannot poison transforms',()=>{
  const c=new T.PerspectiveCamera(),fx=createPreparedSkillFX(T,c),e=event('nobi-bell');for(const bad of[{...e,radius:NaN},{...e,x:Infinity},{...e,flight:999},{...e,round:2},{...e,startedAt:-1},Object.create(e)]){fx.update([bad],10.2,{round:1});assert.equal(fx.group.children.length,0);finite(fx.group);}fx.update([e,e],10.2,{round:1});assert.equal(fx.group.children.length,1);fx.update(Array.from({length:100},(_,i)=>({...e,id:'skill-nobi-bell-'+(i+1)})),10.2,{round:1});assert.equal(fx.group.children.length,20);fx.update([e],10.7,{round:1});assert.equal(fx.group.children.length,0);fx.dispose();
 });
 test('normal depth/visibility and shared assets remain valid after another consumer disposes',()=>{
  const camera=new T.PerspectiveCamera(),fx=createPreparedSkillFX(T,camera),n=createNobiSkillFX(T),e=event('nobi-bell');fx.update([e],10.2,{round:1,visible:()=>false});assert.equal(fx.group.children[0].visible,false);const resources=new Set();for(const o of meshes(fx.group)){resources.add(o.geometry);resources.add(o.material);}const counts=new Map();for(const r of resources){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}fx.dispose();for(const v of counts.values())assert.equal(v,0);n.update([e],10.2);finite(n.group);n.dispose();for(const v of counts.values())assert.equal(v,1);
 });
 test('expired and reset wave instances release their own GPU buffers once; cached hand buffers release on dispose',()=>{
  const fx=createPreparedSkillFX(T,new T.PerspectiveCamera()),e=event('urchin-gloom');fx.update([e],e.triggerAt+.1,{round:1,active:true,armedType:e.type});const a=meshes(fx.group).find(o=>o.isInstancedMesh),b=meshes(fx.hand).find(o=>o.isInstancedMesh);let x=0,y=0;a.addEventListener('dispose',()=>x++);b.addEventListener('dispose',()=>y++);fx.update([],e.endsAt,{round:1});assert.equal(x,1);assert.equal(y,0);fx.dispose();fx.dispose();assert.equal(x,1);assert.equal(y,1);
 });
 console.log('PASS: '+groups+' prepared skill prop presentation groups; silent');
})().catch(e=>{console.error(e);process.exitCode=1;});
