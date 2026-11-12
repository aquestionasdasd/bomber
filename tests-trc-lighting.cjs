const assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
(async()=>{
 const T=await import('./public/vendor/three.module.js'),{createTrcMap}=await import('./public/trc-map.js');
 const {createTrcLighting}=await import('./public/trc-lighting.js'),{TRC_BAKE}=await import('./public/trc-bake.js');
 const context=new Proxy({measureText:()=>({width:80})},{get:(o,k)=>o[k]||(()=>{})});
 global.document={createElement:()=>({getContext:()=>context})};global.Image=class{};
 const requested=[];class TextureLoader{async loadAsync(url){requested.push(url);return new T.Texture();}}
 class CubeTextureLoader{async loadAsync(urls){requested.push(...urls);return new T.CubeTexture();}}
 const map=createTrcMap({...T,TextureLoader,CubeTextureLoader},new T.Group()),s=map.lightingStudy;
 assert.equal(s.compatible,true,'saved bake matches geometry, materials and light configuration');assert.equal(await s.promise,true);assert.equal(s.ready,true);assert.equal(s.error,null);
 assert.equal(requested.length,32);const digest=createHash('sha256');
 for(const url of requested){const b=fs.readFileSync(new URL(url));assert.equal(b.subarray(1,4).toString(),'PNG');assert.ok(b.length>64);const edge=url.includes('/lighting.')?4096:url.includes('/ao.')?4096:128;assert.equal(b.readUInt32BE(16),edge);assert.equal(b.readUInt32BE(20),edge);digest.update(b);}
 assert.equal(digest.digest('hex').slice(0,16),TRC_BAKE.assetHash,'cache key matches shipped textures');
 assert.equal(s.groups.length,43);assert.equal(s.config.probes.length,5);assert.ok(s.lights.length>100);
 const occupied=new Uint8Array(s.size*s.size);let pixels=0;
 for(const c of s.atlas){assert.ok(c.x>=4&&c.y>=4&&c.x+c.w+4<=s.size&&c.y+c.h+4<=s.size);for(let y=c.y-3;y<c.y+c.h+3;y++){const row=occupied.subarray(y*s.size+c.x-3,y*s.size+c.x+c.w+3);assert.ok(!row.some(Boolean),'UV charts and their padding cannot overlap');row.fill(1);pixels+=row.length;}}
 for(const g of s.groups){if(/steel|aluminium|trim|glass|album/.test(g.name)){assert.ok(g.mesh.material.isMeshStandardMaterial);assert.equal(g.mesh.material.roughness,g.base.roughness);assert.equal(g.mesh.material.envMapIntensity,.18);assert.ok(g.mesh.material.envMap);assert.ok(!g.mesh.material.lightMap,'thin bevels retain dynamic normals');}else{assert.ok(g.mesh.material.isMeshBasicMaterial);assert.equal(g.mesh.material.lightMap.channel,1);assert.equal(g.mesh.material.aoMap.channel,1);assert.equal(g.mesh.material.lightMap.generateMipmaps,false);for(const v of g.mesh.geometry.attributes.uv1.array)assert.ok(v>0&&v<1);}
  assert.ok(!g.mesh.material.normalMap);assert.ok(!g.mesh.material.bumpMap);assert.ok(!g.mesh.material.roughnessMap&&!g.base.roughnessMap);
 }
 // Actual visible floors/ceilings throughout the stage, including the old pilot seam.
 for(const [x,y,z,dy]of [[0,.5,63,-1],[-29,.5,-18,-1],[33,.5,-17,-1],[1,3.7,-15,-1],[-41,3.7,-25,-1],[49,-2.7,-7,-1],[-25,5.392,18,1],[-44.91,5.392,18,1],[9.91,5.392,18,1],[0,.5,-62,-1]]){
  const ray=new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(0,dy,0),0,1),hits=ray.intersectObject(map.world,true);assert.ok(hits.length,'visible support at '+[x,y,z]);assert.ok(s.groups.some(g=>g.mesh===hits[0].object),'full-stage material at '+[x,y,z]);
 }
 // Low fixtures sit below the real ceiling while preserving crouch/standing clearance.
 for(const lamp of s.lights.filter(l=>l.position[1]<1.3)){
  const [x,y,z]=lamp.position,ceiling=y+.11;assert.ok(ceiling-(y<0?-3.2:0)>(y<0?2.7:1.3));
  for(const offset of [-lamp.width/2,0,lamp.width/2]){const ray=new T.Raycaster(new T.Vector3(x+offset,y+.095,z),new T.Vector3(0,1,0),0,.04);assert.ok(ray.intersectObject(map.world,true).length,'fixture attached at '+lamp.position);}
 }
 s.setEnabled(false);for(const g of s.groups)assert.equal(g.mesh.material,g.base);
 s.setEnabled(true);for(const g of s.groups)assert.notEqual(g.mesh.material,g.base);
 map.world.userData.bomberCollapsed=true;map.syncCollapseFloors();for(const g of s.groups)assert.equal(g.mesh.material,g.base,'destroyed walls cannot leave baked shadows');
 map.world.userData.bomberCollapsed=false;map.syncCollapseFloors();for(const g of s.groups)assert.notEqual(g.mesh.material,g.base);
 console.log(`PASS: 32 real assets / ${s.charts} nonoverlapping padded UV charts / full-stage floors / 5 probes / toggle / collapse`);
 // Reflection partitioning must preserve every original triangle and normal.
 const world=new T.Group();for(const [name,x,y,z,w,h,d]of [['wall',0,3,0,110,6,140],['steel',0,2,0,110,1,140],['steel',49,-2,-7,4,.1,60]]){const geo=new T.BoxGeometry(w,h,d).toNonIndexed();geo.translate(x,y,z);const m=new T.Mesh(geo,new T.MeshStandardMaterial());m.name='TRC / '+name;world.add(m);}
 const triangles=()=>world.children.flatMap(m=>{const p=m.geometry.attributes.position.array,n=m.geometry.attributes.normal.array,out=[];for(let i=0;i<p.length;i+=9)out.push(Array.from(p.slice(i,i+9)).concat(Array.from(n.slice(i,i+9))).join(','));return out;}).sort();
 const before=triangles(),small=createTrcLighting(T,world);assert.deepEqual(triangles(),before);assert.equal(small.compatible,false);assert.equal(await small.promise,false);
 assert.equal(new Set(small.groups.filter(g=>!g.data).map(g=>g.probe)).size,4);
 console.log('PASS: full triangle/normal preservation across reflection boundaries; stale geometry rejected');
 class FailedLoader{async loadAsync(){throw Error('test missing texture');}}
 const bad=createTrcMap({...T,TextureLoader:FailedLoader,CubeTextureLoader},new T.Group()).lightingStudy;
 assert.equal(await bad.promise,false);assert.equal(bad.ready,false);assert.match(bad.error,/missing texture/);for(const g of bad.groups)assert.equal(g.mesh.material,g.base);
 console.log('PASS: failed load retains original materials');
})().catch(e=>{console.error(e);process.exitCode=1});
