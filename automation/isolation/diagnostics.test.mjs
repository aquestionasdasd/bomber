import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessPreparation} from './local.mjs';
import {generate,review} from './model.mjs';
const secret='PRIVATE_SENTINEL token=do-not-retain https://invalid.example/private';
const request={kind:'bug',description:'射撃練習の的数が非有限なら的を選択しないでください',id:secret,authorId:secret};
const baseCommit='f'.repeat(40),baseline={'public/range.js':readFileSync(new URL('../../public/range.js',import.meta.url),'utf8')};
const selection={sources:[{path:'public/range.js',needles:[]}]};
const plan={decision:'change',reason:'eligible',changes:[{path:'public/range.js',search:'if(count<=0)return-1;',replace:'if(!Number.isFinite(count)||count<=0)return-1;'}]};
const response=content=>new Response(JSON.stringify({done:true,message:{role:'assistant',content:JSON.stringify(content)}}));
async function run({transport,reviewTransport=async()=>response({approved:true,matchesRequest:true,preservesBehavior:true,noResourceAbuse:true}),loadSource=()=>baseline,generatePlan}={}){
 const records=[],retained=[];let calls=0,reviewCalls=0;
 const result=await assessPreparation(request,{baseCommit,loadSource,persistDiagnostic:r=>records.push(r),retain:(proposal,checked)=>retained.push({proposal,checked}),generatePlan:generatePlan??((ticket,options)=>generate(ticket,options,async(...args)=>{calls++;assert.equal(records.at(-1).status,'running');return transport?transport(calls,...args):calls===1?response(selection):response(plan);})),reviewPlan:(ticket,candidate,source,unused,onStage)=>review(ticket,candidate,source,async(...args)=>{reviewCalls++;return reviewTransport(...args);},onStage)});
 for(const record of records){const encoded=JSON.stringify(record);assert.equal(encoded.includes(secret),false);assert.ok(encoded.length<4096);assert.ok(record.elapsedMs>=0);assert.equal(Object.hasOwn(record,'message'),false);assert.equal(Object.hasOwn(record,'stack'),false);}
 return{result,records,retained,calls,reviewCalls};
}
test('source selection timeout is held with a private stage and no exception/request text',async()=>{
 const r=await run({transport:()=>{throw new DOMException(secret,'TimeoutError');}});
 assert.equal(r.result.phase,'held');assert.deepEqual(r.result.diagnostic,{stage:'source_selection',code:'inference_timeout'});assert.equal(r.calls,1);assert.equal(r.reviewCalls,0);assert.equal(r.retained.length,0);assert.equal(r.records.at(-1).status,'held');
});
test('generation HTTP, JSON, unfinished and oversized replies have distinct bounded codes',async()=>{
 const faults=[
  [()=>new Response(secret,{status:503}),'inference_http_error',503],
  [()=>new Response(secret),'inference_invalid_json'],
  [()=>new Response(JSON.stringify({done:true,message:{role:'assistant',content:secret}})),'inference_invalid_json'],
  [()=>new Response(JSON.stringify({done:false,message:{role:'assistant',content:'{}'}})),'inference_invalid_response'],
  [()=>new Response('x'.repeat(131073)),'inference_response_oversized']
 ];
 for(const [fault,code,httpStatus] of faults){const r=await run({transport:n=>n===1?response(selection):fault()});assert.equal(r.result.phase,'held');assert.deepEqual(r.result.diagnostic,{stage:'candidate_generation',code,...(httpStatus?{httpStatus}:{})});assert.equal(r.calls,2);assert.equal(r.reviewCalls,0);assert.equal(r.retained.length,0);}
});
test('connection refusal and aborted review remain held without model retries',async()=>{
 const unavailable=await run({transport:()=>{throw new TypeError(secret);}});assert.equal(unavailable.result.diagnostic.code,'inference_unavailable');assert.equal(unavailable.calls,1);
 const aborted=await run({reviewTransport:()=>{throw new DOMException(secret,'AbortError');}});assert.deepEqual(aborted.result.diagnostic,{stage:'semantic_review',code:'inference_aborted'});assert.equal(aborted.reviewCalls,1);assert.equal(aborted.retained.length,0);
});
test('unshown patches and capability changes never reach semantic review or execution',async()=>{
 for(const [edit,code,stage] of [[{search:'absent anchor',replace:secret},'patch_rejected','candidate_generation'],[{replace:'process.exit(0);'},'candidate_rejected','candidate_validation']]){
  const changed={...plan,changes:[{...plan.changes[0],...edit}]};const r=await run({transport:n=>response(n===1?selection:changed)});assert.deepEqual(r.result.diagnostic,{stage,code});assert.equal(r.result.phase,'held');assert.equal(r.reviewCalls,0);assert.equal(r.retained.length,0);
 }
});
test('model holds and request guards retain their original fixed held reasons',async()=>{
 const empty=await run({transport:()=>response({sources:[]})});assert.equal(empty.result.phase,'held');assert.equal(empty.result.reason,'needs_review');assert.equal(empty.result.diagnostic.stage,'source_selection');assert.equal(empty.result.diagnostic.code,'model_held');assert.equal(empty.calls,1);
 const guarded=await run({generatePlan:(ticket,options)=>generate({...ticket,description:'参照 https://invalid.example/private'},options,()=>{throw Error('must not fetch');})});assert.equal(guarded.result.phase,'held');assert.equal(guarded.result.diagnostic.stage,'request_guard');assert.equal(guarded.retained.length,0);
});
test('declined versus malformed review are recorded separately and cannot approve a job',async()=>{
 const declined=await run({reviewTransport:()=>response({approved:false,matchesRequest:true,preservesBehavior:true,noResourceAbuse:true})});assert.equal(declined.result.phase,'held');assert.equal(declined.result.diagnostic.code,'review_declined');assert.equal(declined.retained.length,1);assert.equal(declined.retained[0].checked.approved,false);
 const malformed=await run({reviewTransport:()=>response({approved:true})});assert.deepEqual(malformed.result.diagnostic,{stage:'semantic_review',code:'review_rejected'});assert.equal(malformed.result.phase,'held');assert.equal(malformed.retained.length,0);
});
test('successful assessment records progress and retains the same validated candidate exactly once',async()=>{
 const r=await run();assert.equal(r.result.phase,'reviewed');assert.equal(r.result.reason,'eligible');assert.equal(r.result.diagnostic.code,'eligible');assert.equal(r.retained.length,1);assert.equal(r.retained[0].checked.approved,true);assert.equal(r.records.at(-1).status,'reviewed');assert.deepEqual(r.records.at(-1).events.map(e=>e.stage),['baseline','request_guard','source_selection','source_context','candidate_generation','candidate_validation','review_context','semantic_review','retaining_review']);
});
test('baseline and unknown failures expose neither hostile thrown values nor a stack',async()=>{
 const baselineFailure=await run({loadSource:()=>{throw Error(secret);}});assert.deepEqual(baselineFailure.result.diagnostic,{stage:'baseline',code:'baseline_unavailable'});assert.equal(baselineFailure.calls,0);
 const unknown=await run({generatePlan:async(ticket,{onStage})=>{onStage('candidate_generation');throw {message:secret,stack:secret,body:secret};}});assert.deepEqual(unknown.result.diagnostic,{stage:'candidate_generation',code:'unexpected_failure'});assert.equal(unknown.result.phase,'held');assert.equal(unknown.retained.length,0);
});
