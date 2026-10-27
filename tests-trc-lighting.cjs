const assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
(async()=>{
 const T=await import('./public/vendor/three.module.js'),{createTrcMap}=await import('./public/trc-map.js');
 const context=new Proxy({measureText:()=>({width:80})},{get:(o,k)=>o[k]||(()=>{})});
 global.document={createElement:()=>({getContext:()=>context})};global.Image=class{};
 const requested=[];class TextureLoader{async loadAsync(url){requested.push(url);return new T.Texture();}}
 class CubeTextureLoader{async loadAsync(urls){requested.push(...urls);return new T.CubeTexture();}}
 const map=createTrcMap({...T,TextureLoader,CubeTextureLoader},new T.Group()),s=map.lightingStudy;
 assert.equal(s.compatible,true,'saved bake matches the exact UV/geometry signature');assert.equal(await s.promise,true);assert.equal(s.ready,true);assert.equal(s.error,null);
 assert.equal(requested.length,8);
 for(const url of requested){const buffer=fs.readFileSync(new URL(url));assert.equal(buffer.subarray(1,4).toString(),'PNG');assert.ok(buffer.length>1000);}
 const {TRC_A_BAKE}=await import('./public/trc-a-bake.js'),digest=createHash('sha256');for(const url of requested)digest.update(fs.readFileSync(new URL(url)));assert.equal(digest.digest('hex').slice(0,16),TRC_A_BAKE.assetHash,'cache key matches shipped textures');
 assert.ok(s.groups.length>5);assert.ok(s.charts>500);
 // A plane exactly on the pilot boundary must keep its outside vertices too.
 for(const x of [-44.91,-17.5,9.91]){const ray=new T.Raycaster(new T.Vector3(x,5.392,18),new T.Vector3(0,1,0),0,.03);assert.ok(ray.intersectObject(map.world,true).length,'ceiling retained across pilot edge');}
 for(const g of s.groups){if(/steel|aluminium|trim/.test(g.name)){assert.ok(g.mesh.material.isMeshStandardMaterial);assert.equal(g.mesh.material.roughness,g.base.roughness);assert.equal(g.mesh.material.envMapIntensity,.18);}else{assert.ok(g.mesh.material.isMeshBasicMaterial);assert.equal(g.mesh.material.lightMap.channel,1);assert.equal(g.mesh.material.aoMap.channel,1);}
  assert.ok(!g.mesh.material.normalMap);assert.ok(!g.mesh.material.bumpMap);
  for(const v of g.mesh.geometry.attributes.uv1.array)assert.ok(v>0&&v<1,'padded atlas chart');
  const box=new T.Box3().setFromBufferAttribute(g.mesh.geometry.attributes.position);assert.ok(box.min.x>=-45.001&&box.max.x<=-18.999&&box.min.z>=-7.501&&box.max.z<=42.001);
 }
 s.setEnabled(false);for(const g of s.groups)assert.equal(g.mesh.material,g.base);
 s.setEnabled(true);for(const g of s.groups)assert.notEqual(g.mesh.material,g.base);
 map.world.userData.bomberCollapsed=true;map.syncCollapseFloors();for(const g of s.groups)assert.equal(g.mesh.material,g.base,'destroyed walls cannot leave baked shadows');
 map.world.userData.bomberCollapsed=false;map.syncCollapseFloors();for(const g of s.groups)assert.notEqual(g.mesh.material,g.base);
 console.log(`PASS: real baked assets / ${s.charts} padded charts / pilot bounds / UV / toggle / collapse restoration`);
 class FailedLoader{async loadAsync(){throw Error('test missing texture');}}
 const bad=createTrcMap({...T,TextureLoader:FailedLoader,CubeTextureLoader},new T.Group()).lightingStudy;
 assert.equal(await bad.promise,false);assert.equal(bad.ready,false);assert.match(bad.error,/missing texture/);for(const g of bad.groups)assert.equal(g.mesh.material,g.base);
 console.log('PASS: failed texture load keeps the original materials and reports failure');
})().catch(e=>{console.error(e);process.exitCode=1});
