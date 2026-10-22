const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

// Rasterize the small subset of Canvas2D used by the real cloud generator.
// This makes the sphere's texture seam testable without a browser or GPU.
function canvasFactory(){
  let count=0;
  const rgba=value=>{const hex=value.slice(1);return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16),hex.length===8?parseInt(hex.slice(6,8),16)/255:1];};
  function createElement(tag){
    assert.equal(tag,'canvas');count++;
    const surface={width:0,height:0,pixels:null};
    const context={
      fillStyle:'#000000',
      createRadialGradient(x0,y0,r0,x,y,radius){
        assert.equal(x0,x);assert.equal(y0,y);assert.equal(r0,0);
        return {x,y,radius,stops:[],addColorStop(at,color){this.stops.push([at,rgba(color)]);}};
      },
      fillRect(x,y,width,height){
        surface.pixels||=new Uint8ClampedArray(surface.width*surface.height*4);
        const style=this.fillStyle;
        for(let py=Math.max(0,Math.floor(y));py<Math.min(surface.height,Math.ceil(y+height));py++)for(let px=Math.max(0,Math.floor(x));px<Math.min(surface.width,Math.ceil(x+width));px++){
          let color;
          if(typeof style==='string')color=rgba(style);
          else{
            const t=Math.min(1,Math.hypot(px+.5-style.x,py+.5-style.y)/style.radius),lo=style.stops[0][1],hi=style.stops[1][1];
            color=lo.map((v,i)=>v+(hi[i]-v)*t);
          }
          const offset=(py*surface.width+px)*4,alpha=color[3],oldAlpha=surface.pixels[offset+3]/255,outAlpha=alpha+oldAlpha*(1-alpha);
          for(let c=0;c<3;c++)surface.pixels[offset+c]=outAlpha?(color[c]*alpha+surface.pixels[offset+c]*oldAlpha*(1-alpha))/outAlpha:0;
          surface.pixels[offset+3]=outAlpha*255;
        }
      }
    };
    surface.getContext=kind=>{assert.equal(kind,'2d');return context;};
    return surface;
  }
  return {document:{createElement},get count(){return count;}};
}

async function main(){
  const THREE=await import(pathToFileURL(path.join(__dirname,'public/vendor/three.module.js')).href);
  const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
  const start=source.indexOf('function serializeSmokes()'),end=source.indexOf('function smokeBlocks(',start);
  assert.ok(start>=0&&end>start,'Execute the actual smoke creation and appearance functions');
  const factory=canvasFactory(),scene=new THREE.Scene(),smokes=[];
  const api=new Function('THREE','scene','document','smokes','clamp',source.slice(start,end)+';return {syncSmokes,serializeSmokes,cloudTexture,updateSmokeAppearance};')(THREE,scene,factory.document,smokes,(n,min,max)=>Math.max(min,Math.min(max,n)));
  const make=(id,expires=4.5)=>({id,x:(id%100)*8,y:1.7,z:0,expires});
  const disposeCount=new Map(),watch=resource=>{if(!disposeCount.has(resource)){disposeCount.set(resource,0);resource.addEventListener('dispose',()=>disposeCount.set(resource,disposeCount.get(resource)+1));}return resource;};
  assert.equal(factory.count,0,'Do not build images before the first smoke');
  api.syncSmokes(Array.from({length:25},(_,i)=>make(i)));
  assert.equal(smokes.length,20);assert.equal(scene.children.length,20);
  const geometry=watch(smokes[0].mesh.geometry),texture=watch(smokes[0].mesh.material.map),materials=smokes.map(s=>watch(s.mesh.material));
  assert.equal(new Set(smokes.map(s=>s.mesh.geometry)).size,1,'All live smoke shells share one geometry');
  assert.equal(new Set(smokes.map(s=>s.mesh.material.map)).size,1);assert.equal(factory.count,1);
  assert.equal(geometry.index.count/3,1656);
  const reference=new THREE.SphereGeometry(3.6,36,24);
  for(const key of Object.keys(reference.attributes))assert.deepEqual(geometry.attributes[key].array,reference.attributes[key].array,'Keep the existing sphere topology and vertex positions');
  assert.deepEqual(geometry.index.array,reference.index.array);reference.dispose();
  for(const s of smokes){
    const material=s.mesh.material;
    assert.equal(material.color.getHexString(),'c9dce7');assert.equal(material.roughness,1);assert.equal(material.metalness,0);
    assert.equal(material.transparent,true);assert.equal(material.opacity,.98);assert.equal(material.side,THREE.DoubleSide);
    assert.equal(material.depthWrite,true);assert.equal(material.forceSinglePass,false);
    assert.equal(s.mesh.castShadow,false);assert.equal(s.mesh.receiveShadow,false);
  }
  assert.equal(texture.image.width,256);assert.equal(texture.image.height,128);assert.equal(texture.wrapS,THREE.RepeatWrapping);
  assert.equal(texture.colorSpace,THREE.SRGBColorSpace);
  let seamMax=0,seamTotal=0,interiorMax=0;
  for(let y=0;y<128;y++)for(let c=0;c<3;c++){
    const pixels=texture.image.pixels,difference=Math.abs(pixels[(y*256)*4+c]-pixels[(y*256+255)*4+c]);
    seamMax=Math.max(seamMax,difference);seamTotal+=difference;
    for(let x=1;x<256;x++)interiorMax=Math.max(interiorMax,Math.abs(pixels[(y*256+x)*4+c]-pixels[(y*256+x-1)*4+c]));
  }
  assert.ok(seamMax<=interiorMax&&seamMax<=5,`Longitude join must be as smooth as the rest of the texture (seam ${seamMax}, interior ${interiorMax})`);
  for(let i=3;i<texture.image.pixels.length;i+=4)assert.equal(texture.image.pixels[i],255,'Keep the opaque cloud image; transparency belongs to the existing material fade');

  for(let frame=0;frame<=450;frame++){
    const time=frame*.01;api.updateSmokeAppearance(time);
    for(const s of smokes){
      assert.deepEqual(s.mesh.scale.toArray(),[1,1,1],'The visible shell must match the fixed 3.6m smoke boundary at every time');
      assert.equal(s.mesh.rotation.y,time*.13);
      assert.ok(Math.abs(s.mesh.material.opacity-.98*Math.max(0,Math.min(1,(s.expires-time)/.4)))<1e-12,'Keep the original final .4 second fade');
    }
  }
  api.updateSmokeAppearance(1.75);scene.updateMatrixWorld(true);
  const shell=smokes[0].mesh;
  for(const [name,origin,expected] of [['outside',new THREE.Vector3(0,1.7,7),2],['inside',new THREE.Vector3(0,1.7,0),1]]){
    const hits=new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1)).intersectObject(shell);
    assert.equal(hits.length,expected,`${name}: preserve the closed shell and visible interior side`);
  }
  const sameMesh=smokes[0].mesh;api.syncSmokes(api.serializeSmokes());
  assert.equal(smokes[0].mesh,sameMesh);assert.equal(factory.count,1);assert.equal(disposeCount.get(geometry),0);

  // The large dome shares a smoother shell among VEIL instances. Ordinary C
  // keeps its original topology; both reuse the one cached cloud image.
  const veil={id:999,x:0,y:1.7,z:0,expires:20,kind:'veil',radius:9};
  api.syncSmokes([...api.serializeSmokes().slice(0,19),veil]);
  const dome=smokes.find(s=>s.kind==='veil'),domeMaterial=watch(dome.mesh.material),domeGeometry=watch(dome.mesh.geometry);
  assert.notEqual(domeGeometry,geometry);assert.equal(domeGeometry.index.count/3,4992);assert.equal(dome.mesh.material.map,texture);assert.equal(factory.count,1);
  assert.equal(dome.mesh.material.color.getHexString(),'77718f');assert.deepEqual(dome.mesh.scale.toArray(),[2.5,2.5,2.5]);
  for(const time of [8,12,19.6,19.8,20]){api.updateSmokeAppearance(time);assert.deepEqual(dome.mesh.scale.toArray(),[2.5,2.5,2.5]);}
  api.updateSmokeAppearance(8);scene.updateMatrixWorld(true);
  const outside=new THREE.Raycaster(new THREE.Vector3(0,1.7,12),new THREE.Vector3(0,0,-1)).intersectObject(dome.mesh);
  assert.ok(Math.abs(outside[0].distance-3)<.02,'The smooth shell matches the 9m boundary within 2cm');
  const restored=api.serializeSmokes().find(s=>s.id===999);assert.deepEqual(restored,veil);
  const ordinary=api.serializeSmokes().find(s=>s.kind==='smoke');
  api.syncSmokes([ordinary,restored,restored,{...veil,id:1000,radius:999},{...veil,id:1001,kind:'hostile'},{...veil,id:1002,x:Infinity},{...veil,id:1003,x:1001}]);
  assert.equal(smokes.length,2,'Duplicate IDs and invalid sizes, kinds and coordinates cannot grow or resize a dome');
  assert.equal(smokes.find(s=>s.id===999).mesh,dome.mesh,'Snapshot replay retains the same live shell');
  api.syncSmokes(Array.from({length:20},(_,i)=>make(i)));
  assert.equal(disposeCount.get(domeMaterial),1);assert.equal(disposeCount.get(domeGeometry),1);

  // Replacing every cloud in a single authoritative snapshot must not dispose
  // the geometry that the newly added clouds are about to use.
  api.syncSmokes(Array.from({length:20},(_,i)=>make(i+100,20)));
  assert.equal(smokes[0].mesh.geometry,geometry);assert.equal(disposeCount.get(geometry),0);
  for(const material of materials)assert.equal(disposeCount.get(material),1);
  const replacementMaterials=smokes.map(s=>watch(s.mesh.material));
  api.syncSmokes(api.serializeSmokes().slice(1));
  assert.equal(disposeCount.get(replacementMaterials[0]),1);assert.equal(disposeCount.get(geometry),0);
  api.syncSmokes([]);api.syncSmokes([]);
  assert.equal(scene.children.length,0);assert.equal(disposeCount.get(geometry),1);
  for(const material of replacementMaterials)assert.equal(disposeCount.get(material),1);
  assert.equal(disposeCount.get(texture),0,'The one session texture remains cached and reusable');

  // Absolute-time snapshot restoration has the same pose and opacity even
  // without the preceding animation frames; a completed smoke stays removed.
  api.syncSmokes([make(31,100.4)]);const revivedGeometry=watch(smokes[0].mesh.geometry),revivedMaterial=watch(smokes[0].mesh.material);
  assert.notEqual(revivedGeometry,geometry);assert.equal(smokes[0].mesh.material.map,texture);
  api.updateSmokeAppearance(100.2);const pose=smokes[0].mesh.matrix.clone();smokes[0].mesh.updateMatrix();pose.copy(smokes[0].mesh.matrix);
  const opacity=smokes[0].mesh.material.opacity;
  api.updateSmokeAppearance(-10);api.updateSmokeAppearance(100.2);smokes[0].mesh.updateMatrix();
  assert.deepEqual(smokes[0].mesh.matrix.elements,pose.elements);assert.equal(smokes[0].mesh.material.opacity,opacity);
  api.syncSmokes(api.serializeSmokes().filter(s=>s.expires>101));api.updateSmokeAppearance(101);
  assert.equal(smokes.length,0);assert.equal(disposeCount.get(revivedGeometry),1);assert.equal(disposeCount.get(revivedMaterial),1);
  for(let round=0;round<100;round++){
    api.syncSmokes([make(round*2+200,200),make(round*2+201,200)]);
    const g=watch(smokes[0].mesh.geometry),m=smokes.map(s=>watch(s.mesh.material));
    assert.equal(smokes[1].mesh.geometry,g);assert.equal(smokes[0].mesh.material.map,texture);assert.equal(disposeCount.get(g),0);
    api.syncSmokes([]);api.syncSmokes([]);
    assert.equal(disposeCount.get(g),1);for(const material of m)assert.equal(disposeCount.get(material),1);
  }
  assert.equal(factory.count,1);assert.equal(disposeCount.get(texture),0);assert.equal(scene.children.length,0);
  const secondFactory=canvasFactory(),secondSmokes=[];
  const second=new Function('THREE','scene','document','smokes','clamp',source.slice(start,end)+';return {cloudTexture};')(THREE,new THREE.Scene(),secondFactory.document,secondSmokes,(n,min,max)=>Math.max(min,Math.min(max,n)));
  assert.deepEqual(second.cloudTexture().image.pixels,texture.image.pixels,'The texture remains deterministic across sessions');
  second.cloudTexture().dispose();texture.dispose();
  console.log(`PASS smoke model: 20 shells / 40 passes / 66,240 rendered triangles; live geometry 20→1; shared texture 1 × 256×128; seam max ${seamMax}/255 (mean ${(seamTotal/(128*3)).toFixed(3)}); fixed radius 3.6m across 451 frames; 100 spawn/dispose cycles clean`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
