// Regression checks for the round/combat hitch fixes. No audio, no rendering.
// --negative proves each check detects the fault it guards against (memory only).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const negative=process.argv.includes('--negative');
async function main(){
 const T=await import('./public/vendor/three.module.js'),{createCollisionIndex,movementTop}=await import('./public/collision.js');
 const {createAgentModel}=await import('./public/agent-model.js'),{createViewmodel}=await import('./public/viewmodel.js');
 let passed=0,failed=0;
 function check(name,fn){let threw=null;try{fn();}catch(e){threw=e;}
  if(negative?!threw:threw){failed++;console.error('FAIL '+name+(threw?'\n'+threw.stack:' (fault not detected)'));}else{passed++;console.log('PASS '+(negative?'detects ':'')+name);}}
 let seed=20261117;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

 // 1. Allocation-free collision paths must answer exactly like a brute-force scan.
 check('collision fast paths equal a brute-force reference',()=>{
  const colliders=[];
  for(let i=0;i<260;i++){const x=(rnd()-.5)*60,z=(rnd()-.5)*70,w=.2+rnd()*9,d=.2+rnd()*9,base=[0,0,3.6,7.2][i%4],c={minX:x,maxX:x+w,minZ:z,maxZ:z+d,base,height:base+.3+rnd()*3.4};
   if(i%9===0)c.polygon=[[x,z],[x+w,z],[x+w*.5,z+d]];
   if(i%11===0)c.movementRamp={axis:i%2?'x':'z',minX:x,maxX:x+w,minZ:z,maxZ:z+d,base,height:1.8,direction:i%3?1:-1};
   if(i%13===0)c.disabled=true;colliders.push(c);}
  colliders.push(colliders[5]);
  for(const cell of [20,8]){
   const index=createCollisionIndex(colliders,cell),EPS=1e-5;
   const aabb=(c,x,z,r)=>x+r>=c.minX&&x-r<=c.maxX&&z+r>=c.minZ&&z-r<=c.maxZ;
   for(let i=0;i<12000;i++){
    const snap=rnd()<.1,x=snap?Math.round((rnd()-.5)*8)*cell:(rnd()-.5)*76,z=snap?Math.round((rnd()-.5)*8)*cell:(rnd()-.5)*86,r=[0,.34,.4,1.3,7,26][i%6],feet=[0,.02,3.6,7.2,rnd()*12][i%5],height=[1.7,1.15,.4][i%3];
    const got=index.query(x,z,r),want=new Set(colliders.filter(c=>aabb(c,x,z,r)));
    assert.equal(new Set(got).size,got.length,'query returned a duplicate');assert.equal(got.length,want.size);for(const c of got)assert.ok(want.has(c));
    let blocked=[...want].some(c=>!c.disabled&&movementTop(c,x,z)>feet+EPS&&(c.base||0)<feet+height-EPS&&index.overlaps(c,x,z,r));
    if(negative&&i===7)blocked=!blocked;
    assert.equal(index.blocked(x,z,r,feet,height),blocked,JSON.stringify({cell,x,z,r,feet,height}));
   }
   for(const bad of [NaN,Infinity,undefined]){assert.equal(index.blocked(bad,0),true);assert.equal(index.blocked(0,0,.3,bad),true);assert.deepEqual(index.query(0,bad,1),[]);assert.equal(index.rayClear(0,bad,0,1,1,1),false);}
   assert.equal(index.blocked(0,0,-1),true);assert.equal(index.blocked(0,0,.3,0,0),true);assert.equal(index.rayClear(0,0,0,1,1,1,-1),false);
  }
  // A vertical ray above a low box is clear; the same ray through it is not.
  const one=createCollisionIndex([{minX:-1,maxX:1,minZ:-1,maxZ:1,base:0,height:2}],8);
  assert.equal(one.rayClear(-5,3,0,5,3,0),true);assert.equal(one.rayClear(-5,1,0,5,1,0),false);assert.equal(one.rayClear(0,5,0,0,2.5,0),true);assert.equal(one.rayClear(0,5,0,0,1,0),false);
  const far=createCollisionIndex([{minX:1e6,maxX:1e6+5,minZ:-1e6,maxZ:-1e6+5,height:3}],8);assert.equal(far.blocked(1e6+1,-1e6+1),true);assert.equal(far.query(1e6+1,-1e6+1,1).length,1);
 });

 // 2. Cached plate templates must hand every model its own identical geometry.
 const signature=model=>{const rows=[];model.group.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;rows.push([o.name,...['position','normal','uv'].map(k=>{const a=g.getAttribute(k);if(!a)return'-';let h=0;for(const v of a.array)h=(Math.imul(h,31)+Math.round(v*1e6))|0;return a.count+':'+h;})].join('|'));});return rows.join('\n');};
 check('agent plates are identical when rebuilt from cached templates',()=>{
  for(const character of ['duelist','renko','ember','veil','japan'])for(const team of ['red','blue']){
   const a=createAgentModel(T,{bot:{id:'a'},team,variant:1,character}),first=signature(a);
   const b=createAgentModel(T,{bot:{id:'b'},team,variant:1,character});
   const shared=new Set();a.group.traverse(o=>{if(o.isMesh&&o.geometry.type==='BufferGeometry'&&o.name.startsWith('Rigid equipment'))shared.add(o.geometry);});
   b.group.traverse(o=>{if(o.isMesh)assert.ok(!shared.has(o.geometry)||negative,'merged equipment geometry must stay per model');});
   assert.equal(signature(b),first,character+'/'+team);
   a.dispose();b.dispose();
   // Disposing every user must not poison the next build.
   const c=createAgentModel(T,{bot:{id:'c'},team,variant:1,character});
   if(negative)c.group.traverse(o=>{if(o.isMesh&&o.name.startsWith('Rigid equipment')){o.geometry.getAttribute('position').array[0]+=.01;}});
   assert.equal(signature(c),first,character+'/'+team+' after dispose');c.dispose();
  }
 });

 // 3. A hidden weapon rig skips matrix work, and is exact again once shown.
 check('hidden first-person rigs skip matrix updates and refresh when equipped',()=>{
  const camera=new T.PerspectiveCamera(),view=createViewmodel(T,camera);if(!view.group.parent)camera.add(view.group);camera.position.set(3,2,1);camera.rotation.set(.2,.7,0);
  const roots=view.group.children.filter(c=>c.name.startsWith('Viewmodel / '));assert.ok(roots.length>=11,'weapon rigs');
  const world=root=>{const out=[];root.traverse(o=>out.push(...o.matrixWorld.elements));return out;};
  const reference=root=>{const out=[];root.traverse(o=>{o.updateMatrix();const m=new T.Matrix4();let chain=[];for(let p=o;p;p=p.parent)chain.unshift(p);for(const p of chain){p.updateMatrix();m.multiply(p.matrix);}out.push(...m.elements);});return out;};
  const close=(a,b,label)=>{assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<1e-9,label+' element '+i);};
  for(const id of ['vandal','knife','classic','pump','vandal']){
   view.setWeapon(id,true);view.group.visible=true;view.update(.016,{time:1.2,moving:1});camera.updateMatrixWorld(true);
   const shown=roots.filter(r=>r.visible);assert.equal(shown.length,1,id);assert.equal(shown[0].name,'Viewmodel / '+id);
   close(world(shown[0]),reference(shown[0]),id);
   const hidden=roots.find(r=>!r.visible),before=world(hidden);
   camera.position.x+=5;view.update(.016,{time:1.3,moving:1});camera.updateMatrixWorld(true);
   const after=world(hidden);
   if(negative)after[12]+=1;
   assert.deepEqual(after,before,'a hidden rig must not be recomputed');
   close(world(shown[0]),reference(shown[0]),id+' after camera move');
  }
  view.dispose();
 });

 // 4. In the real game a round respawn keeps avatar assets alive (same
 //    geometry objects), while leaving the match really releases them.
 const fixture=fs.readFileSync(path.join(__dirname,'tests-round-preparation-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'round-performance-fixture.cjs'),module);mod.filename=path.join(__dirname,'round-performance-fixture.cjs');mod.paths=Module._nodeModulePaths(__dirname);
 mod._compile(fixture.slice(0,cut)+'\nreturn {harness,copy};\n}\nmodule.exports=main;',mod.filename);
 const {harness,copy}=await mod.exports(),h=harness();h.reset();h.run('startGame()');
 const probe=`(()=>{const out={};for(const bot of bots){const ids=[];bot.group.traverse(o=>{if(o.isMesh&&/avatar/i.test(o.name))ids.push(o.geometry.uuid+'/'+[].concat(o.material)[0].uuid);});out[bot.id+':'+bot.kit.character]=ids.sort().join(',');}return out;})()`;
 check('round respawn reuses avatar geometry and materials; leaving releases them',()=>{
  const first=copy(h.run(probe)),ids=Object.keys(first);assert.ok(ids.length>=5,'bots present');assert.ok(ids.some(id=>first[id].length),'avatar meshes present');
  const oldGroups=h.run('bots.map(b=>b.group)'),disposed=h.run(`(()=>{const list=[];for(const bot of bots){const original=bot.visual.dispose;bot.visual.dispose=()=>{list.push(bot.id);original();};}return list;})()`);
  h.run(negative?'clearBots();spawnRound(false);':'spawnRound(false);');
  const second=copy(h.run(probe));assert.deepEqual(Object.keys(second),ids);
  for(const id of ids)if(first[id].length)assert.equal(second[id],first[id],id+' rebuilt its shared avatar assets');
  assert.equal(disposed.length,ids.length,'every outgoing model is disposed exactly once');
  for(const group of oldGroups)assert.equal(group.parent,null,'outgoing model left in the scene');
  assert.equal(h.run('botsGroup.children.length'),h.run('bots.length'));
  assert.deepEqual(copy(h.run('clearBots()')),[]);assert.equal(h.run('bots.length'),0);assert.equal(h.run('botsGroup.children.length'),0);
 });
 // 5. Multi-pellet shots cull whole models by bounds; the hit list must be
 //    the one the unculled ray produces (objects, order and distances).
 check('culled pellet rays return the same hits as full rays',()=>{
  h.run('spawnRound(false);for(const [i,bot] of bots.entries()){bot.x=-8+i*2;bot.z=6+(i%3)*2;bot.group.position.set(bot.x,bot.y||0,bot.z);}botsGroup.updateMatrixWorld(true);');
  h.sandbox.cullNegative=negative;
  const result=copy(h.run(`(()=>{const bounds=shotModelBounds();if(cullNegative)for(const b of bounds)if(b)b.makeEmpty();let seed=4242,diff=0,botHits=0,skipped=0;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   for(let i=0;i<1500;i++){const t=bots[i%bots.length],o=new THREE.Vector3((r()-.5)*30,.4+r()*2,(r()-.5)*30),d=i%4?new THREE.Vector3(t.x-o.x+(r()-.5),(t.y||0)+r()*1.9-o.y,t.z-o.z+(r()-.5)):new THREE.Vector3(r()-.5,(r()-.5)*.4,r()-.5);if(d.lengthSq()<1e-4)continue;d.normalize();
    const ray=new THREE.Raycaster(o,d,0,120),full=ray.intersectObjects([environment,botsGroup],true),culled=shotIntersections(ray,bounds);botHits+=full.filter(x=>x.object.userData.bot).length;
    skipped+=bounds.filter(b=>b&&!ray.ray.intersectsBox(b)).length;
    if(full.length!==culled.length){diff++;continue;}for(let k=0;k<full.length;k++)if(full[k].object!==culled[k].object||full[k].distance!==culled[k].distance||full[k].faceIndex!==culled[k].faceIndex){diff++;break;}}
   return {diff,botHits,skipped,models:bounds.length};})()`));
  assert.ok(result.models>=5&&result.botHits>200&&result.skipped>1000,'the fixture must exercise real hits and real culling: '+JSON.stringify(result));
  assert.equal(result.diff,0,JSON.stringify(result));
 });

 // 6. Practice labels are written once with their final text, not rewritten
 //    with the match text and then the practice text on every HUD update.
 check('practice HUD applies only final label text',()=>{
  h.sandbox.hudNegative=negative;
  const result=copy(h.run(`(()=>{exploring=true;const ids=['timer','round-label','side-label','phase-label'],writes={},values={};
   for(const id of ids){const node=$(id);let value=node.textContent;writes[id]=0;Object.defineProperty(node,'textContent',{configurable:true,get:()=>value,set:v=>{writes[id]++;value=v;}});}
   updateHUD();const first={...writes};for(let i=0;i<5;i++){updateHUD();if(hudNegative)$('timer').textContent='0:00';}
   for(const id of ids){values[id]=$(id).textContent;const value=values[id];Object.defineProperty($(id),'textContent',{configurable:true,writable:true,value});}
   exploring=false;return {first,writes,values};})()`));
  assert.equal(result.values.timer,'∞');assert.equal(result.values['side-label'],'マップ練習');
  for(const id of Object.keys(result.writes)){assert.ok(result.first[id]<=1,id+' written '+result.first[id]+' times in one update');assert.equal(result.writes[id],result.first[id],id+' rewritten although unchanged');}
 });
 console.log(JSON.stringify({mode:negative?'negative':'positive',passed,failed,audioOutput:0}));
 process.exit(failed?1:0);
}
main().catch(error=>{console.error(error);process.exit(1);});
