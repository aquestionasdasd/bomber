const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main(){
 let base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8');
 const stub='localStorage: { getItem: () => null, setItem() {} }';assert.ok(base.includes(stub));
 base=base.replace(stub,"localStorage: (()=>{const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}})()");
 const cut=base.indexOf('  const local = harness();'),m=new Module(path.join(__dirname,'career-harness.cjs'),module);m.filename=path.join(__dirname,'career-harness.cjs');m.paths=module.paths;
 m._compile(base.slice(0,cut)+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const{harness}=await m.exports();let groups=0;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name)},copy=x=>JSON.parse(JSON.stringify(x)),balance=h=>h.run('careerCoins.balance');
 const setup=(format='standard')=>{const h=harness();h.reset();h.sandbox.format=format;h.run(`mode='menu';$('match-format').value=format;startGame();match.startLive();match.events=[];`);return h};
 test('actual lethal enemy damage earns10 once, partial and ally damage grant nothing; purchase credits remain separate',()=>{
  const h=setup();h.run(`var victim=bots.find(b=>b.team==='red'),ally=bots.find(b=>b.team==='blue');damageEntity(victim,1,player);damageEntity(ally,500,player);`);assert.equal(balance(h),0);
  const credits=h.run('match.credits');h.run('damageEntity(victim,500,player);damageEntity(victim,500,player)');assert.equal(balance(h),10);assert.equal(h.run('match.credits'),credits+200);
  assert.equal(h.elements.get('career-coin-balance').textContent,'10');assert.equal(h.elements.get('career-wallet').attributes['aria-label'],'所持金 10 489coin');
  h.run('match.nextRound();handleMatchEvents()');assert.equal(balance(h),10);
 });
 test('actual match victory pays100 to dead or surviving local players once; round victory and match loss pay no win bonus',()=>{
  for(const format of['standard','swift'])for(const won of[false,true])for(const alive of[false,true]){
   const h=setup(format);h.sandbox.won=won;h.sandbox.alive=alive;h.run(`player.alive=alive;match.score={blue:0,red:0};match.endRound('blue','elimination');handleMatchEvents()`);assert.equal(balance(h),0);
   h.run(`match.nextRound();handleMatchEvents();match.startLive();match.events=[];player.alive=alive;var goal=format==='swift'?4:12;match.score=won?{blue:goal,red:0}:{blue:0,red:goal};match.endRound(won?'blue':'red','elimination');handleMatchEvents();match.nextRound();handleMatchEvents();handleMatchEvents();finish(won)`);
   assert.equal(balance(h),won?100:0,`${format}/${won}/${alive}`);h.run('backMenu()');assert.equal(balance(h),won?100:0);
  }
 });
 test('all four practice modes give no rewards despite actual damage and forced match finish',()=>{
  for(const format of['range','explore','plant','defuse']){
   const h=setup(format);h.run(`makeBot({x:0,z:-8,y:0},0,'red',{id:'practice-enemy',name:'PRACTICE',k:0,d:0,a:0,credits:0,secondary:'classic'});damageEntity(bots.at(-1),500,player);match.phase='match';match.winner='blue';finish(true)`);assert.equal(balance(h),0,format);
  }
 });
 test('new games retain balance but reset award receipts, menu exit cannot award again',()=>{
  const h=setup();h.run(`damageEntity(bots.find(b=>b.team==='red'),500,player);backMenu();startGame();match.startLive();match.events=[];damageEntity(bots.find(b=>b.team==='red'),500,player)`);assert.equal(balance(h),20);
  h.run('backMenu();careerCoins.progress({kills:99,finished:true,won:true})');assert.equal(balance(h),20);
 });
 function peers(){
  const host=setup('swift'),guest=setup('swift');
  for(const[h,isHost]of[[host,true],[guest,false]]){h.sandbox.isHost=isHost;h.run(`online={host:isHost,session:{memberId:isHost?'host':'friend',hostId:'host'},room:{code:'META2345',hostId:'host',status:'playing',settings:{format:'swift'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},sent:[],send(p){this.sent.push(p)},close(){}};onlinePlaying=true;mode='menu';$('match-format').value='swift';startGame();netSequence=0;netLastSnapshot=0;netHasSnapshot=false;netRound=0;netClock=0;netInputs.clear();netApplied.clear();netActions=[];netActionSequence=0;elapsed=10;if(isHost){match.startLive();match.events=[]}`)}
  return{host,guest,send(){host.run('tickOnline(.1)');const packet=copy(host.run('online.sent.at(-1)'));guest.sandbox.incoming=packet;guest.run("receiveNetPacket('host',incoming)");return packet}};
 }
 test('independent host/guest JSON confirms guest kills and win once; predicted damage and duplicate/stale/nonhost packets grant nothing',()=>{
  const{host,guest,send}=peers();send();guest.run(`damageEntity(bots[0],500,player)`);assert.equal(balance(guest),0);
  host.run(`var remote=bots.find(b=>b.remoteId==='friend');damageEntity(bots.find(b=>b.team==='blue'),500,remote)`);send();assert.equal(balance(guest),10);assert.equal(balance(host),0);
  guest.run("receiveNetPacket('host',incoming);receiveNetPacket('intruder',{...incoming,seq:999})");assert.equal(balance(guest),10);
  host.run(`match.score={blue:0,red:4};match.endRound('red','elimination');handleMatchEvents();match.nextRound();handleMatchEvents()`);send();assert.equal(balance(guest),110);assert.equal(balance(host),0);
  guest.run("receiveNetPacket('host',incoming);finish(true)");assert.equal(balance(guest),110);
 });
 test('first snapshot baselines historical kills; completed match arrival grants no retrospective reward',()=>{
  for(const complete of[false,true]){const{host,guest,send}=peers();host.sandbox.complete=complete;host.run(`roster.find(r=>r.memberId==='friend').k=8;if(complete){match.score={blue:0,red:5};match.winner='red';match.phase='match'}`);send();assert.equal(balance(guest),0);
   host.run(`roster.find(r=>r.memberId==='friend').k=9`);send();assert.equal(balance(guest),complete?0:10);
  }
 });
 console.log(`PASS: ${groups} actual saved-game career coin groups; silent independent JSON`);return groups;
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
