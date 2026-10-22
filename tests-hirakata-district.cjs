const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
async function main(){
 const started=performance.now(),load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 const T=await load('vendor/three.module.js');global.document={createElement:()=>({getContext:()=>new Proxy({measureText:t=>({width:String(t).length*8})},{get:(o,k)=>o[k]||(()=>{})})})};
 const {createMap}=await load('map.js'),{createNavigation}=await load('navigation.js');
 const map=createMap(T,new T.Group(),'hirakata'),nav=createNavigation(map);let groups=0,routes=0;
 const check=(name,fn)=>{fn();groups++;console.log('PASS '+name);};
 check('224m playable paving / 20 new distinct street blocks / full collision and minimap footprints',()=>{
  assert.deepEqual(map.bounds,{minX:-112,maxX:112,minZ:-112,maxZ:112});assert.equal(map.stats.area,50176);assert.deepEqual(map.combatBounds,{minX:-82,maxX:82,minZ:-82,maxZ:82});assert.equal(map.stats.buildings,31);assert.equal(map.districtBuildings.length,20);
  for(const b of map.districtBuildings){const c=map.colliders.find(c=>c.surfaceId==='district-'+b.id);assert.ok(c);assert.equal(c.minX,b.x-b.w/2);assert.equal(c.height,b.h);assert.ok(map.collision.blocked(b.x,b.z,.34,0));assert.ok(map.mapShapes.some(s=>s.height===b.h&&s.polygon[0][0]===c.minX&&s.polygon[0][1]===c.minZ));}
  assert.ok(map.world.children.some(o=>o.geometry?.type==='PlaneGeometry'&&o.geometry.parameters.width===224&&o.geometry.parameters.height===224));
 });
 check('all new practice landmarks and four perimeter-street junctions connect to both sites',()=>{
  const points=[...map.landmarks.filter(p=>p.id.startsWith('district-')),...[[-84,-84],[84,-84],[84,84],[-84,84],[-84,-39],[84,51]].map(([x,z])=>({x,z}))];
  for(const p of points){assert.ok(nav.isWalkable(p.x,p.z),JSON.stringify(p));for(const s of map.sites){const r=nav.path(p.x,p.z,s.x,s.z);assert.ok(r.length,JSON.stringify([p,s]));let from=p;for(const to of r){assert.ok(nav.clearSegment(from.x,from.z,to.x,to.z),'safe path segment');from=to;}assert.ok(Math.hypot(from.x-s.x,from.z-s.z)<.01);routes++;}}
 });
 check('new shopfronts join multiple street branches instead of isolated inaccessible scenery',()=>{
  for(const b of map.districtBuildings){const side=Math.abs(b.x)>85&&Math.abs(b.z)<90;const p=side?{x:b.x-Math.sign(b.x)*(b.w/2+2),z:b.z}:{x:b.x,z:b.z-Math.sign(b.z)*(b.d/2+2)};assert.ok(nav.isWalkable(p.x,p.z),'front '+b.id);for(const corner of[[-84,-84],[84,84]]){assert.ok(nav.path(p.x,p.z,...corner).length,'branch '+b.id);routes++;}}
 });
 check('old station, slabs, stairs, sites, starts, bus routes and every old collision are unchanged',()=>{
  // Captured from source21b772 before expansion; portable to the sanitized collaboration repository.
  const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
  assert.equal(hash(map.colliders.slice(0,454)),'f3f53b29343b3f176c086b221d6bb623203c9ff8af91afed17af2aa9a6997458');
  assert.equal(hash(map.sites),'67871e92790ee8250ce2341fcbda60839cf3157231c60198c37380d8d739527c');
  assert.equal(hash(map.ramps),'95921650c86f0eba516d4d7a23d54ce1f4beec1cd0020de651d253a6bc70da02');
  assert.equal(hash(map.teamSpawns),'aac89d78c0f51c7b3a70aec4d7a4daedb25879aa3b054ce630a91a20ac2a7cb4');
  assert.equal(hash(map.traffic.poses(12)),'f755bfdae189d50b38b032caa13c953d92a1a2abc65ce1c42781f1b1d0afd3ce');
 });
 check('old Hashimoto dimensions stay164m; new buildings block actual eye-level sight',()=>{const h=createMap(T,new T.Group(),'hashimoto');assert.equal(h.bounds.maxX-h.bounds.minX,164);for(const b of map.districtBuildings)assert.equal(map.collision.rayClear(b.x-b.w,1.6,b.z,b.x+b.w,1.6,b.z),false);});
 let meshes=0,instances=0,triangles=0;map.world.traverse(o=>{if(o.isMesh){meshes++;const n=o.isInstancedMesh?o.count:1;instances+=n;triangles+=n*(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
 check('shared district instancing keeps render count and geometry bounded',()=>{assert.ok(meshes<180);assert.ok(instances<13000);assert.ok(triangles<180000);});
 const report={groups,routes,dimensions:[224,224],newBuildings:20,colliders:map.colliders.length,meshes,instances,triangles,wallMs:Math.round(performance.now()-started)};
 fs.writeFileSync(path.join(__dirname,'../cycle60-district-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}main().catch(e=>{console.error(e);process.exitCode=1;});
