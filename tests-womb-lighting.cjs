const assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
(async()=>{
 const T=await import('./public/vendor/three.module.js'),{createWombMap}=await import('./public/womb-map.js'),{WOMB_BAKE}=await import('./public/womb-bake.js'),{createWombLighting}=await import('./public/womb-lighting.js');
 const context=new Proxy({measureText:()=>({width:80})},{get:(o,k)=>o[k]||(()=>{})});global.document={createElement:()=>({getContext:()=>context})};global.Image=class{};
 const requested=[];class TextureLoader{async loadAsync(url){requested.push(url);return new T.Texture();}}
 const map=createWombMap({...T,TextureLoader},new T.Group()),s=map.lightingStudy;
 assert.equal(s.compatible,true);assert.equal(await s.promise,true);assert.equal(s.ready,true);assert.equal(s.error,null);
 const digest=createHash('sha256');assert.equal(requested.length,2);
 for(const url of requested){const b=fs.readFileSync(new URL(url));assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),2048);assert.equal(b.readUInt32BE(20),2048);digest.update(b);}
 assert.equal(digest.digest('hex').slice(0,16),WOMB_BAKE.assetHash);assert.equal(WOMB_BAKE.samples,256);assert.equal(WOMB_BAKE.bounces,6);assert.equal(WOMB_BAKE.scope,'WOMB complete stage');
 const occupied=new Uint8Array(s.size*s.size);
 for(const c of s.atlas){assert.ok(c.x>=4&&c.y>=4&&c.x+c.w+4<=s.size&&c.y+c.h+4<=s.size);for(let y=c.y-3;y<c.y+c.h+3;y++){const row=occupied.subarray(y*s.size+c.x-3,y*s.size+c.x+c.w+3);assert.ok(!row.some(Boolean),'padded charts overlap');row.fill(1);}}
 for(const g of s.groups){const m=g.mesh.material;assert.ok(m.isMeshBasicMaterial);assert.equal(m.vertexColors,false,'do not multiply the old artificial AO into the new bake');assert.equal(m.lightMap.channel,1);assert.equal(m.aoMap.channel,1);assert.equal(m.lightMap.generateMipmaps,false);assert.ok(!m.normalMap&&!m.bumpMap&&!m.roughnessMap);for(const n of g.mesh.geometry.attributes.uv1.array)assert.ok(n>0&&n<1);}
 // Every floor and both stair shafts have real mounted area fixtures.
 for(const y of [0,3.6,7.2,10.8])assert.ok(s.lights.some(l=>l.position[1]>y+2&&l.position[1]<y+3.4));
 for(const x of [-12.8,12.8])assert.ok(s.lights.filter(l=>Math.abs(l.position[0]-x)<.1).length>=6);
 for(const l of s.lights){const r=new T.Raycaster(new T.Vector3(...l.position),new T.Vector3(0,1,0),0,.08);assert.ok(r.intersectObject(map.world,true).some(h=>h.object.userData.solid),'fixture has a real ceiling: '+l.position);}
 // The long east atrium edge crosses a doorway: its two wall portions must
 // not also carry the slab's coplanar skirt. Only the opening needs that skirt.
 const at=z=>{const r=new T.Raycaster(new T.Vector3(6.5,7.08,z),new T.Vector3(1,0,0),0,1);return r.intersectObject(map.world,true).filter(h=>h.object.userData.solid);};
 for(const z of [-5,3,6])assert.equal(new Set(at(z).map(h=>h.object)).size,1,'no duplicate atrium skirt at '+z);
 assert.ok(at(0).some(h=>h.object.name==='WOMB / floor'),'doorway still has its visible slab edge');
 s.setEnabled(false);for(const g of s.groups)assert.equal(g.mesh.material,g.base);s.setEnabled(true);for(const g of s.groups)assert.equal(g.mesh.material,g.study);
 map.world.userData.bomberCollapsed=true;map.syncCollapseFloors();for(const g of s.groups)assert.equal(g.mesh.material,g.base);map.world.userData.bomberCollapsed=false;map.syncCollapseFloors();for(const g of s.groups)assert.equal(g.mesh.material,g.study);
 console.log(`PASS: WOMB 2 real atlases / ${s.charts} padded charts / all four floors and stairs / no atrium skirt overlap / toggle and collapse`);
 class FailedLoader{async loadAsync(){throw Error('missing test asset');}}
 const bad=createWombMap({...T,TextureLoader:FailedLoader},new T.Group()).lightingStudy;assert.equal(await bad.promise,false);assert.match(bad.error,/missing test asset/);for(const g of bad.groups)assert.equal(g.mesh.material,g.base);
 map.world.children.find(m=>m.userData.wombBake).geometry.translate(.01,0,0);const stale=createWombLighting(T,map);assert.equal(stale.compatible,false);assert.equal(await stale.promise,false);
 console.log('PASS: missing asset and altered geometry retain usable fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
