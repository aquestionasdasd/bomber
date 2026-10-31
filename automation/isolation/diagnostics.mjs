// Private fixed-schema diagnostics. Never retain exception text, stack or model output.
const stages=new Set(['baseline','request_guard','source_selection','source_context','candidate_generation','candidate_validation','review_context','semantic_review','retaining_review']);
const codes=new Set(['in_progress','eligible','model_held','request_guard','review_declined','inference_timeout','inference_aborted','inference_unavailable','inference_http_error','inference_response_oversized','inference_invalid_json','inference_invalid_response','selection_rejected','source_context_unavailable','plan_rejected','patch_rejected','candidate_rejected','review_rejected','review_context_oversized','baseline_unavailable','private_storage_failed','unexpected_failure']);
const reasons=new Set(['unsupported','protected_spec','needs_review','no_change']);
const messages=new Map([
 ['Selection schema rejected','selection_rejected'],['Source selection rejected','selection_rejected'],
 ['Source unavailable','source_context_unavailable'],['No bounded source context','source_context_unavailable'],
 ['Plan schema rejected','plan_rejected'],['Plan decision rejected','plan_rejected'],
 ['Patch schema rejected','patch_rejected'],['Patch must match exactly once','patch_rejected'],
 ['Proposal policy rejected','candidate_rejected'],['Game source boundary rejected','candidate_rejected'],
 ['Review schema rejected','review_rejected'],['Review context oversized','review_context_oversized']
]);
export class ProcessingFailure extends Error {
 constructor(code,httpStatus){
  if(!codes.has(code)||httpStatus!==undefined&&(!Number.isInteger(httpStatus)||httpStatus<100||httpStatus>599))throw Error('Diagnostic code rejected');
  super(code);this.code=code;if(httpStatus!==undefined)this.httpStatus=httpStatus;
 }
}
export function classifyFailure(error,stage){
 let code=stage==='baseline'?'baseline_unavailable':stage==='retaining_review'?'private_storage_failed':'unexpected_failure',httpStatus;
 try{
  if(error instanceof ProcessingFailure&&codes.has(error.code)){code=error.code;if(Number.isInteger(error.httpStatus)&&error.httpStatus>=100&&error.httpStatus<=599)httpStatus=error.httpStatus;}
  else if(messages.has(error?.message))code=messages.get(error.message);
 }catch{/* Unknown thrown values remain a fixed category. */}
 return{code,...(httpStatus===undefined?{}:{httpStatus})};
}
export function preparationDiagnostics(persist,clock=Date.now){
 const started=clock();let stage='baseline',finished=false;
 const report={version:1,startedAtUtc:new Date(started).toISOString(),updatedAtUtc:new Date(started).toISOString(),status:'running',stage,code:'in_progress',elapsedMs:0,events:[]};
 function elapsed(){return Math.max(0,Math.min(86400000,Math.round(clock()-started)));}
 function save(){report.updatedAtUtc=new Date(clock()).toISOString();report.elapsedMs=elapsed();persist(JSON.parse(JSON.stringify(report)));}
 function enter(next){if(finished||!stages.has(next)||report.events.length>=12)throw Error('Diagnostic stage rejected');stage=next;report.stage=next;report.events.push({stage:next,elapsedMs:elapsed()});save();}
 function finish(status,code,reason){
  if(finished||!['held','reviewed'].includes(status)||!['eligible','model_held','request_guard','review_declined'].includes(code)||reason!==undefined&&!reasons.has(reason))throw Error('Diagnostic outcome rejected');
  finished=true;Object.assign(report,{status,code});if(reason!==undefined)report.reason=reason;save();return{stage,code};
 }
 function fail(error){
  if(finished)throw Error('Diagnostic outcome already fixed');
  finished=true;const failure=classifyFailure(error,stage);Object.assign(report,{status:'held',...failure});save();return{stage,...failure};
 }
 return{enter,finish,fail};
}
