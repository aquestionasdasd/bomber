const assert=require('node:assert/strict');
async function main(){
 const {RangeSession}=await import('./public/range.js');
 for(const hz of [20,60,144]){
  const r=new RangeSession({waiting:true});for(let i=0;i<hz*30;i++){r.tick(1/hz);r.recordShot();r.recordHit({head:true,eliminated:true});}
  assert.equal(r.remaining,60);assert.equal(r.shots+r.hits+r.score,0);assert.equal(r.start(),true);assert.equal(r.start(),false);
  r.recordShot();r.recordHit({head:true,eliminated:true});r.recordShot();r.recordHit({eliminated:true});
  assert.equal(r.score,250);assert.equal(r.summary().headRate,50);
  r.tick(NaN);r.tick(-1);assert.equal(r.remaining,60);
  for(let i=0;i<hz*60;i++)r.tick(1/hz);assert.ok(r.complete);assert.equal(r.start(),false);
  r.recordShot();r.recordHit({head:true,eliminated:true});assert.equal(r.score,250);assert.equal(r.shots,2);
 }
 const r=new RangeSession();r.tick(1);assert.equal(r.remaining,59);assert.equal(r.nextTarget(0),-1);const a=r.nextTarget(3,()=>0);assert.notEqual(r.nextTarget(3,()=>0),a);
 console.log('PASS 4 range session groups: wait/start/score/expiry 20/60/144Hz and default API compatibility');
}main().catch(e=>{console.error(e);process.exitCode=1;});
