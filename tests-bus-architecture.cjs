const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{execFileSync}=require('node:child_process');
(async()=>{
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href),T=await load('vendor/three.module.js');
 global.document={createElement:()=>({getContext:()=>new Proxy({measureText:t=>({width:String(t).length*8})},{get:(o,k)=>o[k]||(()=>{})})})};
 const {createMap}=await load('map.js'),{createNavigation}=await load('navigation.js'),map=createMap(T,new T.Group(),'hirakata'),d=map.destruction,nav=createNavigation(map);let n=0;
 const check=(label,fn)=>{d.reset();fn();n++;console.log('PASS '+label);},pose=g=>({x:(g.minX+g.maxX)/2,z:(g.minZ+g.maxZ)/2,yaw:0});
 const original={colliders:[...map.colliders],shapes:[...map.mapShapes],ramps:[...map.ramps],matrices:d.groups.flatMap(g=>g.parts.map(p=>[...p.matrix.elements]))};
 check('all walls, ceilings, district buildings and stairs have exactly one demolition owner',()=>{
  assert.ok(d.groups.length>82&&d.groups.length<=256);assert.ok(d.groups.slice(0,82).every(g=>!g.structural));assert.ok(d.groups.slice(82).every(g=>g.structural));
  const owners=d.groups.flatMap(g=>g.colliders);assert.equal(new Set(owners).size,map.colliders.length);assert.equal(owners.length,map.colliders.length);
  assert.ok(d.groups.every(g=>[g.minX,g.maxX,g.minZ,g.maxZ,g.height,g.base].every(Number.isFinite)));
  for(const id of['hirakata-concourse','hirakata-roof','A-south','B-south','district-tower'])assert.ok(owners.some(c=>c.surfaceId===id),id);
  assert.equal(d.groups.flatMap(g=>g.ramps||[]).length,4);
 });
 const old=JSON.parse(require('node:fs').readFileSync(path.join(__dirname,'tests-fixtures/hirakata-v104-structure.json'),'utf8'));
 check('pre-impact floors, stairs, starts and every old wall retain their original occupied volume',()=>{
  const volume=cs=>cs.reduce((sum,c)=>sum+(c.maxX-c.minX)*(c.maxZ-c.minZ)*(c.height-(c.base||0)),0);
  assert.ok(Math.abs(volume(old.colliders)-volume(map.colliders))<1e-6);
  for(const c of old.colliders){const pieces=map.colliders.filter(v=>v.height===c.height&&(v.base||0)===(c.base||0)&&v.kind===c.kind&&v.surfaceId===c.surfaceId&&v.minX>=c.minX-1e-7&&v.maxX<=c.maxX+1e-7&&v.minZ>=c.minZ-1e-7&&v.maxZ<=c.maxZ+1e-7);assert.ok(Math.abs(volume(pieces)-volume([c]))<1e-6,JSON.stringify(c));}
  assert.deepEqual(map.ramps,old.ramps);assert.deepEqual(map.teamSpawns,old.teamSpawns);assert.deepEqual(map.traffic.poses(12),old.busPoses);

 });
 check('local wall and ceiling collapse clears actual LOS, navigation, floor support and radar together',()=>{
  const p={x:8,z:9,yaw:0};assert.equal(map.collision.rayClear(8,1.5,0,8,1.5,12),false);assert.ok(map.collision.blocked(8,9,.34,0));
  const floor=map.colliders.find(c=>c.surfaceId==='hirakata-concourse'&&map.collision.overlaps(c,8,9));assert.ok(floor);
  const hit=d.breakAt(p,p,1);assert.ok(hit.some(i=>d.groups[i].structural));assert.equal(map.colliders.includes(floor),false);assert.equal(map.collision.rayClear(8,1.5,0,8,1.5,12),true);assert.equal(nav.isWalkable(8,9),true);
  assert.ok(map.collision.blocked(55,9,.34,0),'unhit neighboring retail stays solid');
  for(const i of hit){const g=d.groups[i];assert.ok(g.colliders.every(c=>!map.colliders.includes(c)));assert.ok(g.shapes.every(s=>!map.mapShapes.includes(s)));for(const part of g.parts){const m=new T.Matrix4();part.batch.mesh.getMatrixAt(part.index,m);assert.equal(m.determinant(),0);}}
  d.update(1.1);assert.ok(d.fx.children[0].count>0);assert.ok(d.fx.children[0].count<=768);
 });
 check('every architectural bay and stair can be destroyed; ground and arena boundaries remain',()=>{
  for(const g of d.groups)for(const b of g.bounds){const p=pose(b);d.breakAt(p,p,2);}
  assert.equal(map.colliders.length,0);assert.equal(map.ramps.length,0);assert.equal(map.mapShapes.filter(s=>Number.isFinite(s.height)).length,0);
  assert.ok(d.groups.every(g=>g.nodes.every(o=>!o.visible)));assert.ok(map.world.children.some(o=>o.visible&&o.geometry?.parameters.width===224));assert.deepEqual(map.combatBounds,{minX:-82,maxX:82,minZ:-82,maxZ:82});
  d.update(2.2);assert.ok(d.fx.children[0].count<=768);assert.ok(d.fx.children[1].count<=192);assert.ok(d.fx.children[2].count<=8);d.update(5);assert.ok(d.fx.children.every(o=>o.count===0));
 });
 check('shared wide signs stay hidden until every supporting bay is intact',()=>{
  const node=d.groups.flatMap(g=>g.nodes).find(o=>d.groups.filter(g=>g.nodes.includes(o)).length>1);assert.ok(node);
  const owners=d.groups.filter(g=>g.nodes.includes(node)),mask=new Uint8Array(Math.ceil(d.groups.length/8));mask[owners[0].index>>3]|=1<<(owners[0].index&7);const value=Buffer.from(mask).toString('hex');assert.ok(d.restore(value,3));assert.equal(node.visible,false);d.restore(value,4);assert.equal(node.visible,false);d.reset();assert.equal(node.visible,true);
 });
 check('extended mask and old82bit masks are strict, atomic and idempotent',()=>{
  for(const g of d.groups)d.breakAt(pose(g),pose(g),1);const value=d.snapshot();assert.ok(value.length<=64);d.reset();assert.ok(d.restore(value,2));assert.equal(d.snapshot(),value);
  const before=[...map.colliders];for(const invalid of['f'.repeat(66),'x'.repeat(value.length),'ff'.repeat(11),'0',{},null]){assert.equal(d.restore(invalid,3),false);assert.equal(d.snapshot(),value);assert.deepEqual(map.colliders,before);}
  d.reset();const legacy='01'+'00'.repeat(10);assert.ok(d.restore(legacy,2));assert.equal(d.groups[0].parts[0].batch.mesh.userData.busBrokenInstances.has(d.groups[0].parts[0].index),true);assert.ok(map.colliders.some(c=>c.surfaceId==='hirakata-roof'));
  d.restore(legacy,3,{effects:true});d.update(3);assert.ok(d.fx.children.every(o=>o.count===0));
 });
 check('round reset restores exact arrays, matrices, support, navigation and bounded geometry',()=>{
  for(const g of d.groups)d.breakAt(pose(g),pose(g),1);d.reset();assert.deepEqual(map.colliders,original.colliders);assert.deepEqual(map.mapShapes,original.shapes);assert.deepEqual(map.ramps,original.ramps);
  for(const g of d.groups)for(const p of g.parts){const m=new T.Matrix4();p.batch.mesh.getMatrixAt(p.index,m);for(let i=0;i<16;i++)assert.ok(Math.abs(m.elements[i]-p.matrix.elements[i])<1e-4);}
  assert.ok(map.collision.blocked(8,9,.34,0));assert.equal(d.snapshot(),'');let draws=0,instances=0,triangles=0;map.world.traverse(o=>{if(o.isMesh){draws++;const c=o.isInstancedMesh?o.count:1;instances+=c;triangles+=c*(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});assert.ok(draws<=280&&instances<13000&&triangles<180000);console.log(JSON.stringify({catalog:d.groups.length,maskBytes:Math.ceil(d.groups.length/8)*2,colliders:map.colliders.length,draws,instances,triangles}));
 });
 console.log('PASS '+n+' architecture groups; no audio');
})().catch(e=>{console.error(e);process.exitCode=1;});
