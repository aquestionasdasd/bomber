// Trusted controller. Requests and model text are data, never shell/code inputs.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
import {files,repository} from './policy.mjs';import {sha256,validateProposal} from './gate.mjs';import {generate,review} from './model.mjs';import {readRun} from './read-run.mjs';
import {publicManifest} from './public-manifest.mjs';
import {preparationDiagnostics} from './diagnostics.mjs';
const root=resolve(import.meta.dirname,'../..'),privateRoot=resolve(root,'../.state'),jobs=join(privateRoot,'jobs');
const sharedRoot=resolve(root,'../../collab-bomber'),siteRoot=resolve(root,'../../hashimoto-protocol');
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const save=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n');
function cli(program,args,cwd=root){const r=spawnSync(program,args,{cwd,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:2*1024*1024});if(r.status!==0)throw Error('Trusted operation failed');return r.stdout;}
const git=(args,cwd=root)=>cli('git',args,cwd);
function clean(cwd){if(git(['status','--porcelain','--untracked-files=no'],cwd).trim())throw Error('Source checkout is not clean');}
function configuration(){const c=read(join(privateRoot,'pipeline-config.json'));if(c.version!==1||![c.controlCommit,c.sharedCommit,c.siteCommit].every(x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x))||git(['rev-parse','HEAD']).trim()!==c.controlCommit)throw Error('Trusted controller revision changed');return c;}
function baseline(base){return Object.fromEntries(Object.keys(files).map(path=>[path,git(['show',`${base}:${path}`])]));}
export function ticketFromRow(row){
  if(!row||row.status!=='queued'||row.guild_id!=='961288614959018014'||row.channel_id!=='1565148657840427018'||!['id','author_id'].every(k=>typeof row[k]==='string'&&/^[1-9][0-9]{16,19}$/.test(row[k]))||!['bug','ui','gameplay','feature'].includes(row.kind)||typeof row.description!=='string'||[...row.description].length<5||[...row.description].length>800||/[\p{Cc}\p{Cf}]/u.test(row.description.replace(/[\r\n\t]/g,''))||!Number.isSafeInteger(row.received_at)||Math.abs(Date.now()-row.received_at)>30*86400000)throw Error('Intake row rejected');
  const ticket={id:row.id,authorId:row.author_id,kind:row.kind,description:row.description,guildId:row.guild_id,channelId:row.channel_id};
  if(sha256(JSON.stringify(ticket))!==row.content_hash)throw Error('Intake hash mismatch');return ticket;
}
function load(id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Job id rejected');const directory=join(jobs,id),job=read(join(directory,'job.json'));if(job.id!==id)throw Error('Job state mismatch');return{directory,job};}
function current(c){clean(sharedRoot);clean(siteRoot);if(git(['rev-parse','HEAD'],sharedRoot).trim()!==c.sharedCommit||git(['rev-parse','HEAD'],siteRoot).trim()!==c.siteCommit)throw Error('Game base changed');for(const[role,cwd]of [['shared',sharedRoot],['site',siteRoot]])if(JSON.stringify(publicManifest(cwd))!==JSON.stringify(c.publicHashes?.[role]))throw Error('Pinned public bytes changed');const remote=git(['ls-remote','origin','refs/heads/codex/bus-round-retirement'],sharedRoot).trim().split(/\s/)[0];if(remote!==c.sharedCommit)throw Error('Shared remote changed');}
export async function assessPreparation(ticket,{baseCommit,loadSource,generatePlan=generate,reviewPlan=review,retain,persistDiagnostic}){
  const diagnostic=preparationDiagnostics(persistDiagnostic),onStage=stage=>diagnostic.enter(stage);
  try{
    onStage('baseline');const source=loadSource(),plan=await generatePlan(ticket,{baseCommit,baseline:source,onStage});
    if(plan.decision==='held')return{phase:'held',reason:plan.reason,diagnostic:diagnostic.finish('held','model_held',plan.reason)};
    const checked=await reviewPlan(ticket,plan.candidate,source,undefined,onStage);
    onStage('retaining_review');retain(plan.candidate,checked);
    return{phase:checked.approved?'reviewed':'held',reason:checked.approved?'eligible':'needs_review',diagnostic:diagnostic.finish(checked.approved?'reviewed':'held',checked.approved?'eligible':'review_declined')};
  }catch(error){return{phase:'held',reason:'needs_review',diagnostic:diagnostic.fail(error)};}
}
export async function prepare(row){
  const c=configuration(),ticket=ticketFromRow(row);mkdirSync(jobs,{recursive:true});
  const dedupe=join(jobs,'request-'+ticket.id+'.json');if(existsSync(dedupe))return read(dedupe);
  current(c);const id=randomUUID(),directory=join(jobs,id);mkdirSync(directory);
  const job={version:1,id,request:ticket,contentHash:row.content_hash,controlCommit:c.controlCommit,baseSharedCommit:c.sharedCommit,baseSiteCommit:c.siteCommit,dryRun:false,phase:'generating'};save(join(directory,'job.json'),job);save(dedupe,{jobId:id,phase:'generating'});
  const assessed=await assessPreparation(ticket,{baseCommit:c.sharedCommit,loadSource:()=>baseline(c.sharedCommit),persistDiagnostic:report=>save(join(directory,'diagnostics.json'),report),retain:(proposal,checked)=>{save(join(directory,'proposal.json'),proposal);save(join(directory,'review.json'),checked);}});
  Object.assign(job,assessed);save(join(directory,'job.json'),job);const result={jobId:id,...assessed};save(dedupe,result);return result;
}
export function dispatch(id){
  const c=configuration(),{directory,job}=load(id);if(job.phase==='dispatched')return{jobId:id,phase:job.phase,branch:job.branch,headCommit:job.headCommit};if(job.phase!=='reviewed'||job.controlCommit!==c.controlCommit)throw Error('Reviewed job required');current(c);
  const proposal=read(join(directory,'proposal.json')),checked=read(join(directory,'review.json'));validateProposal(proposal,baseline(c.sharedCommit));if(!checked.approved||checked.proposalSha256!==sha256(JSON.stringify(proposal)))throw Error('Semantic review mismatch');
  const worktree=join(directory,'worktree'),branch='codex/discord-probe-'+id;git(['worktree','add','--detach',worktree,c.controlCommit]);git(['switch','-c',branch],worktree);save(join(worktree,'automation-candidate.json'),proposal);
  git(['add','--','automation-candidate.json'],worktree);git(['-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m','Validate bounded candidate in disposable runner'],worktree);
  const headCommit=git(['rev-parse','HEAD'],worktree).trim();job.branch=branch;job.headCommit=headCommit;job.worktree=worktree;job.phase='prepared_for_push';save(join(directory,'job.json'),job);
  git(['push','-u','origin',branch],worktree);job.phase='dispatched';save(join(directory,'job.json'),job);return{jobId:id,phase:job.phase,branch,headCommit};
}
export function collect(id){
  configuration();const{directory,job}=load(id);if(!['dispatched','verified'].includes(job.phase))throw Error('Dispatched job required');
  const list=JSON.parse(cli('gh',['run','list','--repo',repository,'--branch',job.branch,'--limit','5','--json','databaseId,headSha,status,conclusion']));const matches=list.filter(r=>r.headSha===job.headCommit);if(matches.length!==1)throw Error('Unique exact run required');const run=matches[0];
  if(run.status!=='completed')return{jobId:id,phase:'waiting_remote'};
  if(run.conclusion!=='success'){job.phase='failed';job.reason='verification_failed';save(join(directory,'job.json'),job);return{jobId:id,phase:job.phase,reason:job.reason};}
  const evidence=readRun({runId:run.databaseId,headCommit:job.headCommit,branch:job.branch,mode:'candidate',controlCommit:job.controlCommit,proposal:read(join(directory,'proposal.json')),baseline:baseline(job.baseSharedCommit),root});
  save(join(directory,'evidence.json'),evidence);job.phase='verified';job.runId=run.databaseId;save(join(directory,'job.json'),job);return{jobId:id,phase:'verified',runId:job.runId};
}
export function stage(id){
  const c=configuration(),{directory,job}=load(id);if(job.dryRun!==false||job.phase!=='verified'||job.baseSharedCommit!==c.sharedCommit||job.baseSiteCommit!==c.siteCommit)throw Error('Real verified current job required');current(c);collect(id);
  const proposal=read(join(directory,'proposal.json'));validateProposal(proposal,baseline(c.sharedCommit));
  for(const path of Object.keys(files)){if(git(['show',`${c.siteCommit}:${path}`],siteRoot)!==git(['show',`${c.sharedCommit}:${path}`],sharedRoot))throw Error('Sites/shared source differs');}
  for(const change of proposal.changes){for(const cwd of [sharedRoot,siteRoot]){const target=resolve(cwd,change.path);if(!target.startsWith(cwd+sep))throw Error('Source destination rejected');if(!lstatSync(target).isFile()||lstatSync(target).isSymbolicLink())throw Error('Source type rejected');writeFileSync(target,change.after);}}
  job.phase='staged';save(join(directory,'job.json'),job);return{jobId:id,phase:job.phase,paths:proposal.changes.map(c=>c.path),next:'Official Sites open must have confirmed current base before stage; use guarded-build and independent release check before save/deploy.'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const[command,id]=process.argv.slice(2);let result;
  if(command==='prepare'){let input='';for await(const chunk of process.stdin){input+=chunk;if(Buffer.byteLength(input)>8192)throw Error('Row input oversized');}result=await prepare(JSON.parse(input));}
  else if(command==='dispatch')result=dispatch(id);else if(command==='collect')result=collect(id);else if(command==='stage')result=stage(id);else throw Error('Controller command rejected');
  console.log(JSON.stringify(result));
}
