const assert=require('node:assert/strict'),suite=require('./tests-mouse-raw-input.cjs');
async function main(){
 const faults=[
  ['adjusted-only request',"canvas.requestPointerLock({unadjustedMovement:true})","canvas.requestPointerLock()",'desktop requests'],
  ['retry denied permission',"raw&&error?.name==='NotSupportedError'","raw",'permission denial'],
  ['late fallback after pause',"request===pointerLockRequest&&mode==='play'&&player.alive&&!netHostPaused","true",'pause, menu'],
 ];
 let groups=0;
 for(const [name,anchor,replacement,target]of faults){let applied=false,caught=false;const log=console.log;console.log=()=>{};try{await suite({only:n=>n.startsWith(target),mutate:source=>{assert.ok(source.includes(anchor),'fault anchor: '+name);applied=true;return source.replace(anchor,replacement)}})}catch(error){assert.ok(applied,'injection must run');assert.equal(error.code,'ERR_ASSERTION');caught=true}finally{console.log=log}assert.ok(caught,'fault must be detected: '+name);groups++;console.log('PASS: detects '+name)}
 console.log(`PASS: ${groups} raw input memory faults; product source unchanged`);return groups;
}
module.exports=main;if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});
