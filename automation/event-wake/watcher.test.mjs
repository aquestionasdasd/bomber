import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, verify} from 'node:crypto';
import {readSignal, validateSignal, pollOnce, message, thread, endpoint, queueFixed} from './watcher.mjs';
const pair = generateKeyPairSync('ed25519');
const response = (pending, fingerprint = pending ? 'a'.repeat(64) : null, extra = {}) => async (url, options) => {
  assert.equal(url,endpoint);assert.equal(options.redirect,'manual');
  const {nonce}=JSON.parse(options.body);
  const signed=Buffer.from(`BD3DO_WAKE_V1\n${endpoint}\n${options.headers['X-BD3DO-Timestamp']}\n${options.body}`);
  assert.equal(verify(null,signed,pair.publicKey,Buffer.from(options.headers['X-BD3DO-Signature'],'hex')),true);
  return Response.json({version:1,nonce,pending,fingerprint,...extra});
};
test('100 empty polls invoke no AI; a new fingerprint wakes exactly once, including after restart',async()=>{
  let calls=0,state={version:1};const save=()=>{};
  const queue=async text=>{calls++;assert.equal(text,message);assert.ok(!text.includes('PRIVATE'));return 'test-id';};
  for(let i=0;i<100;i++) assert.equal(await pollOnce({state,save,queue,privateKey:pair.privateKey,fetchImpl:response(false)}),'empty');
  assert.equal(calls,0);
  assert.equal(await pollOnce({state,save,queue,privateKey:pair.privateKey,fetchImpl:response(true)}),'dispatched');
  state=JSON.parse(JSON.stringify(state));
  for(let i=0;i<3;i++)assert.equal(await pollOnce({state,save,queue,privateKey:pair.privateKey,fetchImpl:response(true)}),'duplicate');
  assert.equal(calls,1);
  await pollOnce({state,save,queue,privateKey:pair.privateKey,fetchImpl:response(true,'b'.repeat(64))});assert.equal(calls,2);
});
test('busy real job blocks new wake; handoff failure persists uncertainty and cannot auto-retry',async()=>{
  const state={version:1};let calls=0;const save=()=>{};
  const queue=async()=>{calls++;throw Error('uncertain');};
  assert.equal(await pollOnce({state,save,queue,privateKey:pair.privateKey,fetchImpl:response(true),busy:true}),'busy');assert.equal(calls,0);
  await assert.rejects(pollOnce({state,save,queue,privateKey:pair.privateKey,fetchImpl:response(true)}));
  assert.equal(state.handoffUncertain,true);
  assert.equal(await pollOnce({state,save,queue,privateKey:pair.privateKey,fetchImpl:response(true,'b'.repeat(64))}),'held');assert.equal(calls,1);
});
test('private prose/commands, mismatched nonce, redirects, huge or malformed responses never trigger AI',async()=>{
  let calls=0; const queue=async()=>{calls++;};
  const implementations=[response(true,'a'.repeat(64),{description:'PRIVATE; $(command)'}),response(true,'a'.repeat(64),{nonce:'wrong'}),
    async()=>new Response(null,{status:302,headers:{Location:'https://evil.invalid'}}),async()=>new Response('x'.repeat(2049),{headers:{'content-type':'application/json'}}),
    async()=>{throw Error('network');}];
  for(const fetchImpl of implementations)await assert.rejects(pollOnce({state:{},save:()=>{},queue,privateKey:pair.privateKey,fetchImpl}));
  assert.equal(calls,0);
  assert.throws(()=>validateSignal({version:1,nonce:'x',pending:false,fingerprint:'a'.repeat(64)},'x'));
  assert.throws(()=>queueFixed('unused','unused','untrusted message'));
  assert.equal(thread,'01a1549c-5f71-7273-8e49-487e806e42b0');
});
