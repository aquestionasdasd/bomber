const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
async function main(){
 const {createBusHornScheduler,BUS_HORN_INTERVAL}=await import(pathToFileURL(path.join(__dirname,'public/bus-horn.js')).href);
 let groups=0;const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name)};
 const bus=(id='bus-0',owner='driver')=>({id,owner,x:0,z:0,speed:0,fuel:0});
 test('twenty sixty and one-forty-four Hz produce one initial horn then one every1.5 seconds',()=>{
  assert.equal(BUS_HORN_INTERVAL,1.5);
  for(const hz of[20,60,144]){const times=[];let now=0;const s=createBusHornScheduler(()=>times.push(now));
   for(let i=0;i<=6*hz;i++){now=i/hz;s.update(now,[bus()]);}
   assert.equal(times.length,5);times.forEach((t,i)=>assert.ok(Math.abs(t-i*1.5)<1/hz+1e-7));}
 });
 test('four spatial sources remain independent with no duplicate row or catch-up burst',()=>{
  const calls=[],s=createBusHornScheduler(p=>calls.push({...p})),poses=Array.from({length:4},(_,i)=>({...bus('bus-'+i),x:i*10,z:-i}));
  s.update(0,poses);s.update(.1,[...poses,poses[0]]);assert.equal(calls.length,4);
  s.update(100,poses);assert.equal(calls.length,8);s.update(100,poses);assert.equal(calls.length,8);
  assert.deepEqual(calls.map(p=>p.x),[0,10,20,30,0,10,20,30]);
 });
 test('ordinary driver, rider only and dead neutral driver do not honk; active owner honks even stopped or out of fuel',()=>{
  const calls=[],s=createBusHornScheduler(p=>calls.push(p));
  s.update(0,[bus('bus-0',null)]);s.update(2,[{...bus('bus-0',null),driverHP:0,riders:['passenger']}]);assert.equal(calls.length,0);
  s.update(3,[bus()]);s.update(4.5,[bus()]);assert.equal(calls.length,2);
  s.update(5,[bus('bus-0',null)]);s.update(6,[]);assert.equal(calls.length,2);s.update(7,[bus('bus-0','new-driver')]);assert.equal(calls.length,3);
 });
 test('round menu hidden pause missing map and clock reset discard old clocks without accumulated replay',()=>{
  const calls=[],s=createBusHornScheduler(p=>calls.push(p));s.update(5,[bus()]);
  s.update(6,[bus()],false);s.update(100,[bus()],false);assert.equal(calls.length,1);
  s.update(101,[bus()]);assert.equal(calls.length,2);s.reset();s.update(101.1,[bus()]);assert.equal(calls.length,3);
  s.update(0,[bus()]);assert.equal(calls.length,3);s.reset();s.update(0,[bus()]);assert.equal(calls.length,4);s.update(NaN,[bus()]);s.update(10,[]);assert.equal(calls.length,4);
 });
 test('backward snapshot corrections preserve the deadline instead of replaying the initial horn',()=>{
  const calls=[],s=createBusHornScheduler(p=>calls.push(p));s.update(0,[bus()]);
  for(let i=1;i<15;i++){s.update(i/10+.08,[bus()]);s.update(i/10,[bus()]);}
  assert.equal(calls.length,1);s.update(1.5,[bus()]);assert.equal(calls.length,2);
 });
 test('source poses are read-only and invalid rows cannot emit a horn',()=>{
  const calls=[],s=createBusHornScheduler(p=>calls.push(p)),p=Object.freeze(bus());
  s.update(0,[null,{...p,x:NaN},{...p,z:Infinity},{...p,id:8}]);assert.equal(calls.length,0);
  s.update(1,Object.freeze([p]));assert.equal(calls.length,1);assert.equal(p.fuel,0);
 });
 console.log('PASS '+groups+' bus horn timing groups; no audio playback');
}main().catch(e=>{console.error(e);process.exitCode=1});
