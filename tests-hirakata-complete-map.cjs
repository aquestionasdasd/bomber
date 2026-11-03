// Saved map geometry, collision and destruction in Node. No renderer, playback,
// navigation/site/spawn claims, browser or network is involved.
const assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url');

async function main(){
 const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href),T=await load('vendor/three.module.js');
 const ctx=new Proxy({measureText:text=>({width:String(text).length*8})},{get:(o,k)=>o[k]||(()=>{})});
 global.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 const{createHirakataMap}=await load('hirakata-map.js'),{createBuildingCollapse}=await load('building-collapse.js');
 const scene=new T.Group(),map=createHirakataMap(T,scene);map.world.updateMatrixWorld(true);
 const allMeshes=[],ground=[];map.world.traverse(node=>{if(node.isMesh&&node.userData.hirakataModule){allMeshes.push(node);if(node.userData.preserveGround)ground.push(node);}});
 const groups=map.destruction.groups,byName=new Map(groups.map(g=>[g.id,g])),original={colliders:[...map.colliders],shapes:[...map.mapShapes],ramps:[...map.ramps]},owners=new Map();
 for(const g of groups)for(const collider of g.colliders){if(!owners.has(collider))owners.set(collider,[]);owners.get(collider).push(g);}
 let count=0;const check=(label,fn)=>{fn();count++;console.log('PASS '+label);};
 const same=(actual,expected,label)=>{assert.equal(actual.length,expected.length,label+' count');for(let i=0;i<actual.length;i++)assert.equal(actual[i],expected[i],label+' identity '+i);};
 const maskFor=group=>{const bytes=Buffer.alloc(Math.ceil(groups.length/8));bytes[group.index>>3]|=1<<(group.index&7);return bytes.toString('hex');};
 const visibleHit=hit=>!hit.object.userData.bomberHidden&&!hit.object.userData.busDebrisHidden;
 function rays(a,b,nodes=allMeshes){const start=new T.Vector3(...a),delta=new T.Vector3(...b).sub(start),ray=new T.Raycaster(start,delta.clone().normalize(),0,delta.length());return ray.intersectObjects(nodes,false).filter(visibleHit);}
 const colliderRay=(a,b)=>map.collision.rayClear(...a,...b);
 check('all collision/shape/ramp ownership refers to one real render module',()=>{
  assert.ok(groups.length>20&&groups.length<=256);assert.ok(original.colliders.length>1000);
  for(const collider of original.colliders)assert.equal(owners.get(collider)?.length,1,'collider '+collider.id);
  const nodeOwners=new Map();for(const g of groups){assert.ok(g.nodes.length,g.id);assert.ok(map.world.getObjectByName(g.id),g.id);for(const node of g.nodes){assert.equal(node.userData.hirakataModule,g.id);assert.equal(node.userData.preserveGround,false);assert.ok(!nodeOwners.has(node),'mesh shared across damage groups');nodeOwners.set(node,g);}}
  for(const node of allMeshes)if(!node.userData.preserveGround)assert.ok(nodeOwners.has(node),'unowned architecture '+node.name);
  for(const ramp of original.ramps)assert.equal(groups.filter(g=>g.ramps.includes(ramp)).length,1,'ramp '+ramp.id);
  for(const shape of original.shapes.filter(s=>s.kind!=='site'))assert.equal(groups.filter(g=>g.shapes.includes(shape)).length,1,'shape ownership');
  assert.ok(ground.length>50);
 });
 check('each substantial collider has nearby geometry in its own destruction module',()=>{
  for(const g of groups)for(const c of g.colliders){
   if(c.kind==='stairs'||c.kind==='railing')continue;
   const x=(c.minX+c.maxX)/2,y=(c.base+c.height)/2,z=(c.minZ+c.maxZ)/2;
   const pairs=[[[c.minX-.4,y,z],[c.maxX+.4,y,z]],[[x,c.base-.4,z],[x,c.height+.4,z]],[[x,y,c.minZ-.4],[x,y,c.maxZ+.4]]];
   assert.ok(pairs.some(([a,b])=>rays(a,b,g.nodes).some(({point:p})=>p.x>=c.minX-.31&&p.x<=c.maxX+.31&&p.z>=c.minZ-.31&&p.z<=c.maxZ+.31&&p.y>=c.base-.31&&p.y<=c.height+.31)),c.id+' has no local geometry in '+g.id);
  }
  for(const c of original.colliders.filter(c=>c.id.startsWith('central-ticket')))assert.equal(owners.get(c)[0].id,'Station_central_gates',c.id);
  for(const c of original.colliders.filter(c=>c.id.startsWith('station-end')))assert.equal(owners.get(c)[0].id,'Station_north_facade',c.id);
 });
 check('public entrances and staircase void remain open; solid pillar/ceilings agree with raycast',()=>{
  for(const[a,b]of[[[8,8,13],[8,8,16]],[[-22,8,-13],[-22,8,-17]],[[35,8,-13],[35,8,-17]],[[-34,5.3,0],[-34,6.5,0]],[[54,20,68],[56,20,68]]]){assert.equal(colliderRay(a,b),true,'open collision '+a);assert.equal(rays(a,b).length,0,'open visual '+a);}
  for(const[a,b]of[[[-29,8.2,-5],[-25,8.2,-5]],[[-17,10,0],[-17,11,0]],[[36.5,10,0],[36.5,11,0]],[[10,9.5,9.3],[10,10.5,9.3]],[[0,12.5,0],[0,13.4,0]]]){assert.equal(colliderRay(a,b),false,'solid collision '+a);assert.ok(rays(a,b).length,'solid visual '+a);}
 });
 check('park pitched-roof empty corners stay clear and the mall roof cap stays solid',()=>{
  for(const[a,b]of[[[-26,4.5,121.8],[-16,4.5,121.8]],[[-14,4.5,146.8],[-8,4.5,146.8]]]){assert.equal(rays(a,b).length,0,'pitched roof visual gap');assert.equal(colliderRay(a,b),true,'pitched roof collision gap '+a);}
  const a=[45,29.1,-72],b=[45,29.5,-72];assert.ok(rays(a,b).length,'mall cap visual');assert.equal(colliderRay(a,b),false,'mall cap collision');
 });
 check('south deck and curved bridge support columns have matching physical surfaces',()=>{
  for(const[a,b]of[[[7,2,29],[9,2,29]],[[21,2,114],[23,2,114]],[[3,8,76],[4,8,76]]]){assert.ok(rays(a,b).length,'column visual '+a);assert.equal(colliderRay(a,b),false,'column collision '+a);}
 });
 check('park benches belong to their actual Park geometry, not the later metadata module',()=>{
  const benches=original.colliders.filter(c=>c.id.startsWith('bench'));assert.equal(benches.length,4);
  for(const c of benches){const x=(c.minX+c.maxX)/2,z=(c.minZ+c.maxZ)/2;assert.equal(owners.get(c)[0].id,'Park');const hits=rays([x,1.1,z-1],[x,1.1,z+1]);assert.ok(hits.some(hit=>hit.object.userData.hirakataModule==='Park'));}
 });
 check('each bus destruction mask removes its visible meshes, collision, radar and floor support together',()=>{
  for(const g of groups){
   const mask=maskFor(g);assert.equal(map.destruction.restore(mask,1),true,g.id);
   same(map.colliders,original.colliders.filter(c=>!g.colliders.includes(c)),g.id+' colliders');same(map.mapShapes,original.shapes.filter(s=>!g.shapes.includes(s)),g.id+' shapes');same(map.ramps,original.ramps.filter(r=>!g.ramps.includes(r)),g.id+' ramps');
   for(const node of g.nodes){assert.equal(node.visible,false,g.id);assert.equal(node.userData.busDebrisHidden,true,g.id);}
   for(const other of groups)if(other!==g)for(const node of other.nodes)assert.equal(node.visible,true,'unrelated '+other.id);
   for(const mesh of ground){assert.equal(mesh.visible,true,'ground '+mesh.name);assert.ok(!mesh.userData.busDebrisHidden);}
   assert.equal(map.destruction.snapshot(),mask);map.destruction.reset();same(map.colliders,original.colliders,'restore colliders');same(map.mapShapes,original.shapes,'restore shapes');same(map.ramps,original.ramps,'restore ramps');
  }
 });
 check('removed architecture no longer blocks actual game-filtered rays, and reset restores it',()=>{
  const g=byName.get('Station_central_Ceiling'),a=[-17,10,0],b=[-17,11,0];assert.ok(rays(a,b,g.nodes).length);map.destruction.restore(maskFor(g),2);
  assert.equal(rays(a,b,g.nodes).length,0);assert.equal(colliderRay(a,b),true);map.destruction.reset();assert.ok(rays(a,b,g.nodes).length);assert.equal(colliderRay(a,b),false);
 });
 check('bomber collapse keeps ground and live buses, then restores the independent prior bus damage',()=>{
  const collapse=createBuildingCollapse(T,map),g=byName.get('Station_central_Ceiling'),mask=maskFor(g);map.destruction.restore(mask,2);
  assert.equal(collapse.start({x:-24,z:22,time:3,seed:113}),true);assert.equal(map.colliders.length,0);assert.equal(map.mapShapes.length,0);assert.equal(map.ramps.length,0);
  for(const mesh of allMeshes){if(mesh.userData.preserveGround){assert.equal(mesh.visible,true);assert.ok(!mesh.userData.bomberHidden);}else{assert.equal(mesh.visible,false);assert.equal(mesh.userData.bomberHidden,true);}}
  assert.equal(map.busModels.models.size,4);for(const bus of map.busModels.models.values()){assert.equal(bus.parent,map.world);assert.equal(bus.visible,true);bus.traverse(node=>assert.ok(!node.userData.bomberHidden));}
  collapse.reset();assert.equal(map.destruction.snapshot(),mask);same(map.colliders,original.colliders.filter(c=>!g.colliders.includes(c)),'collapse reset collision');same(map.mapShapes,original.shapes.filter(s=>!g.shapes.includes(s)),'collapse reset shapes');
  for(const node of g.nodes){assert.equal(node.visible,false);assert.ok(node.userData.busDebrisHidden);assert.ok(!node.userData.bomberHidden);}
  map.destruction.reset();same(map.colliders,original.colliders,'final collision');same(map.mapShapes,original.shapes,'final radar');same(map.ramps,original.ramps,'final ramps');collapse.dispose();
 });
 console.log(JSON.stringify({checks:count,colliders:original.colliders.length,damageGroups:groups.length,groundMeshes:ground.length,modelMeshes:allMeshes.length,scope:'Node real Three / collision / destruction; no browser, audio, nav, sites or spawn validation'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
