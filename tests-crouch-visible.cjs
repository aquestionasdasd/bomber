const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
async function main(){
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 const[THREE,{createAgentModel}]=await Promise.all([load('vendor/three.module.js'),load('agent-model.js')]);
 const characters=['duelist','nope','mend','echo','veil','ember','frost','duck','cat','car','nobi','japan','cap','urchin','onnara'];
 let renderedPieces=0;
 for(const character of characters){
  const model=createAgentModel(THREE,{character,bot:{id:'visible-crouch-'+character}});
  const pose=state=>{model.update(0,{character,alive:true,weapon:'vandal',enemyRim:false,...state});model.group.updateMatrixWorld(true);};
  const center=mesh=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);};
  pose({crouch:0});const hitFaces=[...model.meshes],pieces=[];
  model.group.traverseVisible(mesh=>{if(mesh.isMesh&&mesh.parent.matrixAutoUpdate===false){const p=center(mesh);if(p.y>.9)pieces.push({mesh,p,matrix:mesh.matrixWorld.clone()});}});
  assert.ok(pieces.length>=1,character+' actual visible upper-body pieces');renderedPieces+=pieces.length;
  for(const crouch of[.25,.5,1]){pose({crouch});for(const{mesh,p}of pieces){const q=center(mesh);assert.ok(Math.abs(q.y-(p.y-crouch*.55))<1e-6,character+' '+mesh.name+' follows body: '+q.y+' vs '+(p.y-crouch*.55));assert.ok(Math.abs(q.x-p.x)<1e-6&&Math.abs(q.z-p.z)<1e-6,character+' no sideways jump');}}
  assert.deepEqual(model.meshes,hitFaces,character+' hit faces unchanged');assert.equal(hitFaces.length,52);
  // Restoration is measured on rendered geometry, not just the invisible hit rig.
  pose({crouch:0});for(const{mesh,matrix}of pieces)assert.deepEqual(mesh.matrixWorld.elements,matrix.elements,character+' standing restored exactly');
  const matrices=state=>{pose(state);return pieces.map(({mesh})=>mesh.matrixWorld.elements.slice());};
  for(const state of[{sliding:true},{dancing:true,danceTime:1.1},{alive:false}])assert.deepEqual(matrices({...state,crouch:1}),matrices({...state,crouch:0}),character+' special pose avoids double crouch');
  model.dispose();
 }
 console.log('PASS: all15 actual visible avatars / '+renderedPieces+' upper-body pieces follow crouch; standing/slide/dance/death;52 hit faces unchanged');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
