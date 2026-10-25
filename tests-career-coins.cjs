const assert=require('node:assert/strict');
async function main(){
 const {createCareerCoins,CAREER_COIN_KEY}=await import('./public/career-coins.js');
 const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};let id=0,groups=0;
 const make=options=>createCareerCoins({storage:()=>storage,makeId:()=>`run-${++id}`,...options});
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name)};
 test('persistent separate wallet grants10 per kill,100 per match victory once',()=>{
  const w=make();assert.equal(w.balance,0);w.begin({eligible:true});w.progress({kills:2});assert.equal(w.balance,20);
  w.progress({kills:2});w.progress({kills:1});assert.equal(w.balance,20);
  w.progress({kills:3,won:true,finished:true});w.progress({kills:3,won:true,finished:true});assert.equal(w.balance,130);
  assert.equal(make().balance,130);w.stop();w.progress({kills:20,won:true,finished:true});assert.equal(w.balance,130);
 });
 test('practice excluded, loss keeps earned kills, fresh games remain independent',()=>{
  const w=make();w.begin();w.progress({kills:90,won:true,finished:true});assert.equal(w.balance,130);
  w.begin({eligible:true});w.progress({kills:1,finished:true});assert.equal(w.balance,140);
  w.begin({eligible:true});w.progress({kills:1,finished:true,won:true});assert.equal(w.balance,250);
 });
 test('guest baseline excludes prejoin kills and ended arrivals; later confirmed deltas and victory count',()=>{
  const w=make();w.begin({eligible:true,guest:true});w.progress({kills:8});assert.equal(w.balance,250);
  w.progress({kills:9});w.progress({kills:7});w.progress({kills:9});assert.equal(w.balance,260);
  w.progress({kills:10,won:true,finished:true});assert.equal(w.balance,370);
  w.begin({eligible:true,guest:true});w.progress({kills:20,won:true,finished:true});w.progress({kills:20,won:true,finished:true});assert.equal(w.balance,370);
 });
 test('sequential tabs merge saved balance, bounded receipts and refresh preserve new earnings',()=>{
  const a=make(),b=make();a.begin({eligible:true});b.begin({eligible:true});a.progress({kills:1});b.progress({kills:1});a.refresh();assert.equal(a.balance,390);
  for(let i=0;i<80;i++){a.begin({eligible:true});a.progress({kills:1})}
  assert.equal(JSON.parse(storage.getItem(CAREER_COIN_KEY)).runs.length,64);assert.equal(a.balance,1190);
  b.refresh();b.progress({kills:1});assert.equal(b.balance,1190);b.progress({kills:2});assert.equal(b.balance,1200);
 });
 test('invalid scores and malformed saves rejected; safe cap and no currency wrap',()=>{
  const w=make();w.begin({eligible:true});for(const kills of[-1,NaN,Infinity,1.5,100001,'2'])w.progress({kills,won:true,finished:true});assert.equal(w.balance,1200);
  for(const raw of['bad','null','{"version":1,"balance":-1,"runs":[]}','{"version":1,"balance":1e100,"runs":[]}']){
   const broken=createCareerCoins({storage:()=>({getItem:()=>raw,setItem(){}})});assert.equal(broken.balance,0);
  }
  const cap=createCareerCoins({storage:()=>({getItem:()=>'{"version":1,"balance":999999998,"runs":[]}',setItem(){}})});cap.begin({eligible:true});cap.progress({kills:1});assert.equal(cap.balance,999999999);
 });
 test('unavailable storage retains current page earnings and reports unsaved state without throwing',()=>{
  let status,blocked=true;const memory=new Map();const w=createCareerCoins({storage:()=>({getItem:k=>{if(blocked)throw Error('blocked');return memory.get(k)||null},setItem:(k,v)=>{if(blocked)throw Error('quota');memory.set(k,v)}}),onChange:s=>status=s});
  w.begin({eligible:true});w.progress({kills:1});w.progress({kills:2});w.refresh();assert.equal(w.balance,20);assert.equal(status.saved,false);
  blocked=false;w.progress({kills:2});assert.equal(status.saved,true);assert.equal(JSON.parse(memory.get(CAREER_COIN_KEY)).balance,20);
 });
 test('unchanged confirmed snapshots perform no synchronous storage reads or writes',()=>{
  let reads=0,writes=0,raw=null;const w=createCareerCoins({storage:()=>({getItem(){reads++;return raw},setItem(k,v){writes++;raw=v}})});
  w.begin({eligible:true});w.progress({kills:1});const before=[reads,writes];for(let i=0;i<200;i++)w.progress({kills:1});assert.deepEqual([reads,writes],before);
 });
 console.log(`PASS: ${groups} career coin groups; no audio`);return groups;
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
