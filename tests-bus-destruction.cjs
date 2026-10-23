const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f))),T=await load('vendor/three.module.js');
 const ctx=new Proxy({measureText:t=>({width:t.length*8})},{get:(o,k)=>o[k]||(()=>{})});global.document={createElement:()=>({getContext:()=>ctx})};
 const {createMap}=await load('map.js'),{busHitsBox}=await load('bus-destruction.js'),{createNavigation}=await load('navigation.js');
 const map=createMap(T,new T.Group(),'hirakata'),d=map.destruction,nav=createNavigation(map),colliders=[...map.colliders],shapes=[...map.mapShapes];let n=0;
 const check=(name,fn)=>{d.reset();fn();n++;console.log('PASS '+name);},pose=g=>({x:(g.minX+g.maxX)/2,z:(g.minZ+g.maxZ)/2,yaw:0});
 const matrices=()=>d.groups.flatMap(g=>g.parts.map(p=>{const m=new T.Matrix4();p.batch.mesh.getMatrixAt(p.index,m);return [...m.elements];}));const original=matrices();
 check('bounded catalog captures complete columns, stops, cover, taxis and furniture',()=>{assert.ok(d.groups.length>60&&d.groups.length<=256);for(const prefix of['mid-column','facade-column','deck-column','stop','planter','taxi','lamp','district-furniture'])assert.ok(d.groups.some(g=>g.id.startsWith(prefix)),prefix);assert.equal(map.colliders.length,797);assert.equal(d.snapshot(),'');assert.ok(d.fx.children.every(o=>o.count===0));});
 check('pillar smash removes physical collision, all signs and mesh instances; radar stays aligned',()=>{
  const g=d.groups.find(g=>g.id==='mid-column-13'),p=pose(g);assert.ok(map.collision.blocked(p.x,p.z,.1,0));assert.ok(d.breakAt(p,p,2).includes(g.index));assert.equal(map.collision.blocked(p.x,p.z,.1,0),false);
  for(const c of g.colliders)assert.equal(map.colliders.includes(c),false);for(const c of g.shapes)assert.equal(map.mapShapes.includes(c),false);assert.ok(g.nodes.length>=4);assert.ok(g.nodes.every(o=>!o.visible));for(const part of g.parts){const m=new T.Matrix4();part.batch.mesh.getMatrixAt(part.index,m);assert.equal(m.determinant(),0);}
  assert.ok(nav.isWalkable(p.x,p.z));d.update(2.01);assert.ok(d.fx.children[0].count>0);assert.ok(d.fx.children[1].count>0);assert.ok(d.fx.children[2].count>0);
 });
 check('all furniture parts restore exactly, including shelter roof/taxi wheels and collider order',()=>{
  for(const g of d.groups)d.breakAt(pose(g),pose(g),3);assert.ok(map.colliders.length<colliders.length);assert.ok(map.mapShapes.length<shapes.length);d.update(3.1);assert.ok(d.fx.children[0].count<=768);assert.ok(d.fx.children[1].count<=192);assert.ok(d.fx.children[2].count<=8);
  d.reset();assert.deepEqual(map.colliders,colliders);assert.deepEqual(map.mapShapes,shapes);assert.deepEqual(matrices(),original);assert.ok(d.groups.every(g=>g.nodes.every(o=>o.visible)));assert.equal(d.snapshot(),'');
 });
 check('strict compact mask round trips and rejects corrupt bits atomically',()=>{
  const g=d.groups[0];d.breakAt(pose(g),pose(g),1);const mask=d.snapshot(),saved=[...map.colliders];assert.ok(mask.length<=64&&mask.length%2===0);d.reset();assert.ok(d.restore(mask,3));assert.equal(d.snapshot(),mask);
  const badLast=mask.slice(0,-2)+'ff';for(const bad of[{},null,0,'0','a'.repeat(66),mask.toUpperCase().replace(/[0-9]/,'G'),...(d.groups.length%8?[badLast]:[])]){assert.equal(d.restore(bad,4),false);assert.equal(d.snapshot(),mask);assert.deepEqual(map.colliders,saved);}
 });
 check('same count mask changes invalidate navigation; duplicate and fresh snapshots do not replay blasts',()=>{
  const a=d.groups.find(g=>g.id==='mid-column-13'),b=d.groups.find(g=>g.id==='mid-column--13');d.breakAt(pose(a),pose(a),1);const maskA=d.snapshot();d.reset();d.breakAt(pose(b),pose(b),1);const maskB=d.snapshot();assert.ok(d.restore(maskA,2));assert.equal(nav.isWalkable(-20,13),true);assert.equal(nav.isWalkable(-20,-13),false);assert.ok(d.restore(maskB,3));assert.equal(nav.isWalkable(-20,-13),true);assert.equal(nav.isWalkable(-20,13),false);
  d.reset();d.restore(maskA,4);d.update(4);assert.ok(d.fx.children.every(o=>o.count===0));d.restore(maskB,5,{effects:true});d.update(5.01);const count=d.fx.children[0].count;assert.ok(count>0);d.restore(maskB,5.02,{effects:true});d.update(5.03);assert.equal(d.fx.children[0].count,count);d.update(8);assert.ok(d.fx.children.every(o=>o.count===0));
 });
 check('cached ray bounds are invalidated when hiding and restoring instance groups',()=>{
  const g=d.groups.find(g=>g.id==='mid-column-13');for(const p of g.parts)p.batch.mesh.computeBoundingSphere();d.breakAt(pose(g),pose(g),1);for(const p of g.parts){assert.equal(p.batch.mesh.boundingSphere,null);p.batch.mesh.computeBoundingSphere();}d.reset();for(const p of g.parts)assert.equal(p.batch.mesh.boundingSphere,null);
 });
 check('rotated full body catches thin pillars between old point probes, never upper floors',()=>{
  const p={x:0,z:0,yaw:Math.PI/4};assert.ok(busHitsBox(p,{minX:1.1,maxX:1.2,minZ:1.1,maxZ:1.2,base:0,height:3}));assert.equal(busHitsBox(p,{minX:-1,maxX:1,minZ:-1,maxZ:1,base:4.76,height:5.02}),false);assert.equal(busHitsBox(p,{minX:15,maxX:16,minZ:15,maxZ:16,height:3}),false);
 });
 console.log('PASS '+n+' demolition groups; '+d.groups.length+' props / '+d.snapshot().length+' current mask bytes; no audio');
})().catch(e=>{console.error(e);process.exitCode=1;});
