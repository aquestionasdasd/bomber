const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function main(){
  const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [THREE,{createCharacterFX}]=await Promise.all([load('vendor/three.module.js'),load('character-fx.js')]);
  const fx=createCharacterFX(THREE),scene=new THREE.Scene();scene.add(fx.group);
  assert.equal(fx.group.visible,false);assert.equal(fx.group.children.length,3);
  const geometry=new Set(),materials=new Set(),textures=new Set(),buffers=[];
  const watch=new Map();
  const observe=resource=>{watch.set(resource,0);resource.addEventListener('dispose',()=>watch.set(resource,watch.get(resource)+1));};
  for(const mesh of fx.group.children){
    assert.ok(mesh.isInstancedMesh);geometry.add(mesh.geometry);materials.add(mesh.material);buffers.push(mesh.instanceMatrix.array,mesh.geometry.getAttribute('fxOpacity').array);
    assert.equal(mesh.count,0);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.userData.solid,false);
    assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.forceSinglePass,true);
    assert.equal(mesh.material.side,THREE.DoubleSide);assert.equal(mesh.material.transparent,true);
    const hits=[];mesh.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0,'Ground cues cannot shield a hit or affect targeting');
    for(const value of Object.values(mesh.material))if(value?.isTexture)textures.add(value);
    const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};mesh.material.onBeforeCompile(shader);
    assert.ok(shader.vertexShader.includes('vFxOpacity=fxOpacity;'));assert.ok(shader.fragmentShader.includes('diffuseColor.a *= vFxOpacity;'),'Absolute-time fade reaches the actual basic material shader');
    observe(mesh);
  }
  assert.equal(geometry.size,3);assert.equal(materials.size,3);assert.equal(textures.size,0);
  for(const item of [...geometry,...materials])observe(item);
  const mend=fx.group.getObjectByName('Character cue / MEND recovery rings'),recon=fx.group.getObjectByName('Character cue / ECHO scan rings'),motes=fx.group.getObjectByName('Character cue / MEND recovery flecks');
  const make=(id,type,startedAt=10)=>({id,type,team:'blue',x:4,y:0,z:9,startedAt,endsAt:startedAt+(type==='mend'?1.5:6),radius:type==='mend'?18:300});
  const snapshot=()=>fx.group.children.map(mesh=>({count:mesh.count,visible:mesh.visible,matrix:Array.from(mesh.instanceMatrix.array.subarray(0,mesh.count*16)),opacity:Array.from(mesh.geometry.getAttribute('fxOpacity').array.subarray(0,mesh.count))}));
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),quaternion=new THREE.Quaternion();
  const radiusOf=(mesh,index=0)=>{mesh.getMatrixAt(index,matrix);matrix.decompose(position,quaternion,scale);return scale.x;};
  const counts=()=>[mend.count,recon.count,motes.count];
  const recovery=make('recovery','mend'),scan=make('scan','recon');
  fx.update([recovery],9.999);assert.equal(fx.group.visible,false);
  fx.update([recovery],10);assert.deepEqual(counts(),[2,0,8]);assert.ok(mend.geometry.getAttribute('fxOpacity').array[0]>0);
  fx.update([recovery],10.75);assert.deepEqual(counts(),[2,0,8]);assert.ok(radiusOf(mend)>10&&radiusOf(mend)<18);
  fx.update([recovery],11.499);assert.equal(fx.group.visible,true);fx.update([recovery],11.5);assert.equal(fx.group.visible,false,'MEND expires after exactly 1.5 seconds');
  for(const time of [10,12,14]){
    fx.update([scan],time);assert.deepEqual(counts(),[0,1,0]);assert.ok(Math.abs(radiusOf(recon)-.35)<1e-6,`A new scan begins at ${time-10} seconds`);
    fx.update([scan],time+1);assert.ok(Math.abs(radiusOf(recon)-150.175)<1e-4,'Each pulse travels out over its own 2 second interval');
    fx.update([scan],time+1.999);assert.ok(radiusOf(recon)<300&&radiusOf(recon)>299.8);
  }
  fx.update([scan],16);assert.equal(fx.group.visible,false);fx.update([scan],30);assert.equal(fx.group.visible,false,'Late rejoin cannot restart completed effects');
  fx.update([recovery,scan],10.6);const expected=snapshot();
  fx.update([scan,recovery,scan,recovery],10.6);assert.deepEqual(snapshot(),expected,'Duplicate and reordered snapshots produce exactly the same render buffers');
  fx.update([scan,recovery],11.3);fx.update([],100);fx.update([scan,recovery],10.6);assert.deepEqual(snapshot(),expected,'Appearance depends on absolute time, not update history');
  const second=createCharacterFX(THREE);second.update([scan,recovery],10.6);
  const secondSnapshot=second.group.children.map(mesh=>({count:mesh.count,visible:mesh.visible,matrix:Array.from(mesh.instanceMatrix.array.subarray(0,mesh.count*16)),opacity:Array.from(mesh.geometry.getAttribute('fxOpacity').array.subarray(0,mesh.count))}));
  assert.deepEqual(secondSnapshot,expected,'A new client joining midway gets the same pose');second.dispose();

  const many=Array.from({length:25},(_,id)=>make(id,id%2?'mend':'recon'));
  fx.update(many,10.5);assert.equal(fx.group.userData.activeEvents,20);const selected=snapshot();fx.update([...many].reverse(),10.5);assert.deepEqual(snapshot(),selected,'The fixed event cap is independent of snapshot order');
  let maximumTriangles=0,maximumDraws=0;
  for(const events of [Array.from({length:20},(_,id)=>make(id,'mend')),Array.from({length:20},(_,id)=>make(id,'recon')),many]){
    fx.update(events,10.5);let triangles=0,draws=0;
    for(const mesh of fx.group.children){assert.ok(mesh.count<=mesh.instanceMatrix.count);if(mesh.visible){draws++;triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*mesh.count;}}
    maximumTriangles=Math.max(maximumTriangles,triangles);maximumDraws=Math.max(maximumDraws,draws);
  }
  assert.equal(maximumDraws,3);assert.equal(maximumTriangles,5440);
  fx.update([scan,recovery],10.8,{reducedMotion:true});assert.deepEqual(counts(),[2,1,0],'Reduced motion omits moving flecks');
  assert.equal(radiusOf(recon),300);const stillRadius=radiusOf(mend);fx.update([scan,recovery],11,{reducedMotion:true});assert.equal(radiusOf(mend),stillRadius,'Reduced-motion healing cues do not expand');
  assert.ok(stillRadius<=2.6);
  fx.update([scan,recovery],10.8);fx.group.updateMatrixWorld(true);
  for(const mesh of fx.group.children)for(let index=0;index<mesh.count;index++){
    mesh.getMatrixAt(index,matrix);matrix.decompose(position,quaternion,scale);
    assert.ok(position.y>=.035&&position.y<.051,'Every cue and fleck stays on the ground rather than crossing the eye line');
    assert.ok(scale.x<=300&&scale.y<=300);
    const alpha=mesh.geometry.getAttribute('fxOpacity').array[index];assert.ok(alpha>=0&&alpha<=1);
  }
  const invalid=[null,{},make('bad','unknown'),{...scan,x:NaN},{...scan,endsAt:9},{...scan,radius:-1},{...scan,id:''},{...scan,y:Infinity}];
  fx.update(invalid,11);assert.equal(fx.group.visible,false);fx.update([scan],NaN);assert.equal(fx.group.visible,false);
  for(let i=0;i<500;i++)fx.update(i%4===0?[]:[scan,recovery],10+(i%140)/100,{reducedMotion:i%3===0});
  let index=0;for(const mesh of fx.group.children){assert.equal(mesh.instanceMatrix.array,buffers[index++]);assert.equal(mesh.geometry.getAttribute('fxOpacity').array,buffers[index++]);}
  assert.equal(fx.group.children.length,3,'Updates never create additional meshes');for(const count of watch.values())assert.equal(count,0,'No still-owned shared resource is disposed during updates');
  fx.group.position.set(2,3,4);fx.reset();fx.reset();assert.equal(fx.group.visible,false);assert.deepEqual(counts(),[0,0,0]);assert.deepEqual(fx.group.position.toArray(),[2,3,4],'Reset does not move a caller-owned root');
  fx.update([scan],12.5);assert.equal(fx.group.visible,true);fx.dispose();fx.dispose();assert.equal(scene.children.length,0);assert.equal(fx.group.visible,false);
  for(const count of watch.values())assert.equal(count,1,'Instance buffers, geometry and materials are released exactly once');
  fx.update([scan],11);assert.equal(fx.group.visible,false);assert.deepEqual(counts(),[0,0,0]);
  console.log(`PASS character FX: 3 fixed draws / ${maximumTriangles.toLocaleString('en-US')} maximum triangles / 220 pooled instances / 3 geometries / 3 materials / 0 textures; absolute-time MEND1.5s and ECHO0/2/4s, duplicate/rejoin/reset/reduced-motion/500 updates/disposal clean`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
