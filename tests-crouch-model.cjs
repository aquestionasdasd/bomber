const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
async function main(){
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 const [THREE,{createAgentModel}]=await Promise.all([load('vendor/three.module.js'),load('agent-model.js')]);
 const characters=['duelist','nope','mend','echo','veil','ember','frost','duck','cat','car','nobi','japan','cap','urchin','onnara'];
 for(const character of characters){
  const model=createAgentModel(THREE,{bot:{id:'posture-'+character},character});
  const pose=state=>{model.update(0,{character,alive:true,weapon:'vandal',...state});model.group.updateMatrixWorld(true);return model.head.getWorldPosition(new THREE.Vector3()).y;};
  const standing=pose({crouch:0}),meshes=[...model.meshes];assert.equal(meshes.length,52,character+' hit faces');
  for(const crouch of [.25,.5,1]){
   const y=pose({crouch});assert.ok(Math.abs(y-(standing-crouch*.55))<1e-6,character+' head follows posture');
   const ray=new THREE.Raycaster(new THREE.Vector3(0,y,3),new THREE.Vector3(0,0,-1));
   assert.ok(ray.intersectObjects(model.meshes).some(h=>h.object.userData.head),character+' real lowered head ray');
  }
  const high=new THREE.Raycaster(new THREE.Vector3(0,standing,3),new THREE.Vector3(0,0,-1));
  assert.equal(high.intersectObjects(model.meshes).filter(h=>h.object.userData.head).length,0,character+' old head misses');
  assert.deepEqual(model.meshes,meshes,character+' no new/deleted hit meshes');
  const slide=pose({crouch:0,sliding:true});assert.equal(pose({crouch:1,sliding:true}),slide,character+' slide never double lowers');
  assert.equal(pose({crouch:1,dancing:true,danceTime:0}),pose({crouch:0,dancing:true,danceTime:0}),character+' dance overrides crouch');
  assert.equal(pose({crouch:1,alive:false}),pose({crouch:0,alive:false}),character+' death clears live crouch');
  assert.equal(pose({crouch:0}),standing,character+' next round restores standing');model.dispose();
 }
 console.log('PASS: all15 characters lower visible skeleton and52 hit faces; slide/dance/death/standing restoration');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
