const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(`${__dirname}/public/online.js`,'utf8');
const settle=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function harness(code=source){
 let now=100000,serial=0;const timers=new Map(),calls=[],errors=[],storage=new Map();
 const schedule=(fn,ms)=>{const id={id:++serial,unref(){}};timers.set(id,{at:now+ms,fn});return id;};
 const clear=id=>timers.delete(id),ctx={Date:{now:()=>now},setTimeout:schedule,clearTimeout:clear,AbortController,
  sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  fetch:async()=>{throw Error('offline');},crypto:{randomUUID:()=>`connection-${serial}`}};
 vm.createContext(ctx);vm.runInContext(code.replace('export class RoomClient','class RoomClient')+'\nglobalThis.Client=RoomClient;',ctx);
 function client(){return Object.assign(Object.create(ctx.Client.prototype),{session:{code:'TESTROOM',memberId:'host',hostId:'host',token:'a'.repeat(64)},connectionId:'first',
  host:true,closed:false,room:{status:'playing',members:[{id:'host',team:'blue',connected:true},{id:'ally',team:'blue',connected:true},{id:'enemy',team:'red',connected:true}]},
  peers:new Map(),pendingState:null,pendingTeamStates:new Map(),lastRelay:now,relayBusy:false,pollTimer:null,onRoom(){},onError:e=>errors.push(e),
  api:async(action,message)=>{calls.push({action,at:now,message:JSON.parse(JSON.stringify(message))});}});}
 async function advance(ms){const end=now+ms;let count=0;
  while(true){await settle();const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;
   assert.ok(++count<200,'No timer spin/catch-up loop');now=next[1].at;timers.delete(next[0]);next[1].fn();}
  now=end;await settle();
 }
 return{ctx,client,calls,errors,timers,storage,advance,schedule,now:()=>now,jump:ms=>{now+=ms;},async due(){for(const[id,t]of[...timers])if(t.at<=now){timers.delete(id);t.fn();}await settle();}};
}
const packet=(seq=101,paused=true,secret='BLUE')=>({type:'snapshot',seq,paused,time:10,markers:[{x:1,z:2,secret}]});
let groups=0;
async function check(name,fn){await fn();groups++;console.log(`PASS: ${name}`);}
async function timerDelivery(code=source){
 const h=harness(code),c=h.client(),seen={};c.api=async(_,m)=>{h.calls.push({at:h.now(),message:JSON.parse(JSON.stringify(m))});seen[m.to]=(seen[m.to]||0)+1;if(m.to==='team:red'&&seen[m.to]===1)throw Error('lost reply');};
 c.send(packet(101,true,'BLUE'),{team:'blue'});c.send(packet(101,true,'RED'),{team:'red'});assert.equal(c.pendingTeamStates.size,2);assert.equal(h.timers.size,1);
 await h.advance(399);assert.equal(h.calls.length,2);await h.advance(1);assert.equal(h.calls.length,3);
 assert.equal(h.calls[2].message.to,'team:red');assert.equal(h.calls[2].message.data.markers[0].secret,'RED');assert.equal(h.calls[2].message.data.seq,101);
 assert.equal(JSON.stringify(h.calls[1].message),JSON.stringify(h.calls[2].message),'Retry preserves exact original sequence/time/private payload');
 assert.equal(h.calls[2].at-h.calls[0].at,200);assert.equal(c.pendingTeamStates.size,0);assert.equal(h.timers.size,0);c.close(false);
}
async function newerPending(code=source){
 const h=harness(code),c=h.client(),rejects=[];c.api=(_,m)=>{h.calls.push(m);return new Promise((_,reject)=>rejects.push(reject));};
 c.send(packet(),{team:'blue'});await h.advance(200);c.send(packet(102),{team:'blue'});c.send(packet(103),{team:'blue'});
 rejects.shift()(Error('old failure'));await settle();assert.equal(c.pendingTeamStates.get('blue').seq,103);await h.advance(200);
 assert.equal(h.calls[1].data.seq,103);c.close(false);rejects.forEach(r=>r(Error('closed')));await settle();assert.equal(h.timers.size,0);
}
async function directResume(code=source){
 const h=harness(code),c=h.client();let reject;c.api=(_,m)=>{h.calls.push(m);return new Promise((_,r)=>reject=r);};
 c.send(packet(),{team:'blue'});await h.advance(200);const direct=[];
 c.peers.set('ally',{pc:{close(){}},channel:{readyState:'open',bufferedAmount:0,send:p=>direct.push(JSON.parse(p))}});
 c.send(packet(102,false),{team:'blue'});reject(Error('old failure'));await settle();await h.advance(1000);
 assert.equal(direct[0].seq,102);assert.equal(h.calls.length,1,'Direct-only newer state invalidates older failed HTTP');assert.equal(c.pendingTeamStates.size,0);c.close(false);
}
(async()=>{
 await check('timer alone delivers final two private paused states; partial failure retries only failed team',()=>timerDelivery());
 await check('failed older in-flight response cannot overwrite a newer pending state',()=>newerPending());
 await check('direct-only reconnect advances freshness before old HTTP failure completes',()=>directResume());
 await check('permanent outage is bounded to initial +2 attempts; repeated same seq cannot renew budget',async()=>{
  const h=harness(),c=h.client();c.api=async(_,m)=>{h.calls.push({at:h.now(),message:m});throw Error('offline');};
  c.send(packet(),{team:'blue'});await h.advance(30000);assert.equal(h.calls.length,3);assert.equal(h.timers.size,0);
  c.send(packet(),{team:'blue'});await h.advance(30000);assert.equal(h.calls.length,3);
  c.send(packet(102),{team:'blue'});await h.advance(1000);assert.equal(h.calls.length,6);c.close(false);assert.equal(h.timers.size,0);
 });
 await check('resume cancels old paused retries while preserving new unpaused state',async()=>{
  const h=harness(),c=h.client();let reject;c.api=(_,m)=>{h.calls.push(m);return new Promise((_,r)=>reject=r);};
  c.send(packet(),{team:'blue'});await h.advance(200);c.cancelPausedRelay();c.send(packet(102,false),{team:'blue'});reject(Error('old'));
  await settle();c.api=async(_,m)=>h.calls.push(m);await h.advance(200);assert.equal(h.calls.length,2);assert.equal(h.calls[1].data.paused,false);c.close(false);assert.equal(h.timers.size,0);
 });
 await check('leave/closed room/credential/connection changes make late callbacks inert',async()=>{
  for(const change of[c=>c.close(false),c=>c.acceptRoom({...c.room,status:'closed'}),c=>{c.session.token='b'.repeat(64);},c=>{c.connectionId='new';},c=>{c.session.code='NEWROOM2';}]){
   const h=harness(),c=h.client();let reject;c.api=(_,m)=>{h.calls.push(m);return new Promise((_,r)=>reject=r);};
   c.send(packet(),{team:'blue'});await h.advance(200);change(c);reject(Error('late'));await settle();await h.advance(1000);
   assert.equal(h.calls.length,1);assert.equal(h.errors.length,0);assert.equal(h.timers.size,0);c.close(false);
  }
 });
 await check('4xx refusals do not retry;429 waits at least1 second; ordinary input/state stay single attempt',async()=>{
  for(const status of[400,401,403,404,410,413]){const h=harness(),c=h.client();c.api=async()=>{h.calls.push(h.now());throw Object.assign(Error('refused'),{status});};c.send(packet(),{team:'blue'});await h.advance(30000);assert.equal(h.calls.length,1);assert.equal(h.timers.size,0);c.close(false);}
  const h=harness(),c=h.client();c.api=async()=>{h.calls.push(h.now());throw Object.assign(Error('rate'),{status:429});};c.send(packet(),{team:'red'});await h.advance(30000);assert.equal(h.calls.length,3);assert.ok(h.calls.slice(1).every((t,i)=>t-h.calls[i]>=1000));c.close(false);
  for(const host of[true,false]){const h=harness(),c=h.client();c.host=host;c.api=async(_,m)=>{h.calls.push(m);throw Error('offline');};c.send(host?packet(1,false):{type:'input',seq:1});await h.advance(10000);assert.equal(h.calls.length,1);assert.equal(h.calls[0].to,host?'all':'host');c.close(false);}
 });
 await check('headers-only/hanging body hits8s request deadline and25s total budget',async()=>{
  const h=harness(),c=h.client();c.api=h.ctx.Client.prototype.api;let count=0;const starts=[];
  h.ctx.fetch=async(_url,options)=>{starts.push(h.now());h.calls.push(options);const index=++count;
   if(index===2)return{ok:false,status:429,json:()=>new Promise(resolve=>h.schedule(()=>resolve({message:'rate'}),7990))};
   return{ok:true,status:201,json:()=>new Promise(()=>{})};
  };
  c.send(packet(),{team:'blue'});await h.advance(25200);assert.equal(count,3);assert.equal(h.timers.size,0);assert.equal(c.relayBusy,false);
  assert.ok(h.calls[0].signal.aborted&&h.calls[2].signal.aborted);assert.ok(h.now()-100000<=25200);assert.equal(c.pendingTeamStates.size,0);c.close(false);
 });
 await check('late stale authentication refusal cannot close a new session',async()=>{
  const h=harness(),c=h.client();c.api=h.ctx.Client.prototype.api;let respond;h.ctx.fetch=()=>new Promise(r=>respond=r);
  c.send(packet(),{team:'blue'});await h.advance(200);c.session.token='b'.repeat(64);c.connectionId='new';
  respond({ok:false,status:403,json:async()=>({error:'unauthorized'})});await settle();assert.equal(c.closed,false);assert.equal(c.room.status,'playing');assert.equal(h.errors.length,0);c.close(false);
 });
 await check('frozen timers do not burst catch-up batches or revive expired snapshots',async()=>{
  const h=harness(),c=h.client();c.send(packet(),{team:'blue'});c.send(packet(101,true,'RED'),{team:'red'});
  h.jump(30000);await h.due();assert.equal(h.calls.length,0);assert.equal(h.timers.size,0);assert.equal(c.pendingTeamStates.size,0);c.close(false);
 });
 await check('saved game visibility handler cancels paused relay before sending resumed snapshot',async()=>{
  const game=fs.readFileSync(`${__dirname}/public/game.js`,'utf8'),line=game.split('\n').find(l=>l.startsWith("document.addEventListener('visibilitychange'"));
  const h=harness(),c=h.client(),context={document:{hidden:false,addEventListener:(_,f)=>context.handler=f},onlinePlaying:true,online:c,netHostPaused:true,suspendSession(){},resetMouseLook(){},updateHUD(){},tickOnline(){assert.equal(c.pendingTeamStates.size,0);c.send(packet(102,false),{team:'blue'});}};
  c.send(packet(),{team:'blue'});vm.createContext(context);vm.runInContext(line,context);context.handler();await h.advance(200);assert.equal(h.calls[0].message.data.paused,false);c.close(false);
 });
 await check('four in-memory faults are caught by delivery/freshness/autonomous-wake cases',async()=>{
  const mutants=[
   [source.replace('this.queueRelay(state);}else state.done=true;','/* lost failed packet */}else state.done=true;'),timerDelivery],
   [source.replace('this.relayLatest?.get(state.slot)===state&&',''),newerPending],
   [source.replace('this.relayLatest.set(slot,state);',"if(![...this.peers.values()].some(p=>p.channel?.readyState==='open'&&p.channel.bufferedAmount<128000))this.relayLatest.set(slot,state);"),directResume],
  ];
  for(const[code,test]of mutants){assert.notEqual(code,source);await assert.rejects(()=>test(code));}
  // Timer-only final delivery also detects a missing scheduler; this mutation
  // preserves explicit send/flush behavior while removing the autonomous wake.
  const noWake=source.replace('this.relayTimer=setTimeout(()=>{this.relayTimer=null;this.flushRelay();},','this.relayTimer=setTimeout(()=>{this.relayTimer=null;},');assert.notEqual(noWake,source);await assert.rejects(()=>timerDelivery(noWake));
 });
 console.log(`Relay retry tests passed: ${groups} groups (fake clock, controlled HTTP, saved visibility handler; no browser/audio).`);
})().catch(e=>{console.error(e);process.exitCode=1;});
