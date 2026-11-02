// Trusted CLI: download only the bounded report from the fixed repository/run.
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {repository} from './policy.mjs';import {verifyEvidence,treeDigest} from './evidence.mjs';
function cli(program,args,cwd){const r=spawnSync(program,args,{cwd,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:1024*1024});if(r.status!==0)throw Error('Evidence retrieval failed');return r.stdout;}
export function readRun({runId,headCommit,branch,mode,controlCommit,proposal,baseline,root}){
  if(!Number.isSafeInteger(runId)||runId<1||!/^[a-f0-9]{40}$/.test(headCommit)||!/^[a-f0-9]{40}$/.test(controlCommit)||!/^codex\/discord-(?:isolated-runner|probe-[a-z0-9-]{1,64})$/.test(branch))throw Error('Evidence arguments rejected');
  const raw=JSON.parse(cli('gh',['api',`repos/${repository}/actions/runs/${runId}`],root));
  const run={id:raw.id,repository:{full_name:raw.repository?.full_name},head_sha:raw.head_sha,head_branch:raw.head_branch,event:raw.event,path:raw.path,status:raw.status,conclusion:raw.conclusion,run_attempt:raw.run_attempt};
  if(run.head_sha!==headCommit||run.repository.full_name!==repository||run.status!=='completed'||run.conclusion!=='success')throw Error('Successful exact run required');
  const paths=cli('git',['diff','--name-only',controlCommit,headCommit,'--'],root).trim().split('\n').filter(Boolean);
  if(mode==='candidate'&&(paths.length!==1||paths[0]!=='automation-candidate.json')||mode==='selftest'&&headCommit!==controlCommit)throw Error('Trusted control changed');
  const digest=treeDigest(cli('git',['ls-tree','-rz',controlCommit],root));
  const artifacts=JSON.parse(cli('gh',['api',`repos/${repository}/actions/runs/${runId}/artifacts`],root)).artifacts;
  if(!Array.isArray(artifacts)||artifacts.length!==1||artifacts[0].name!=='bd3do-isolation-report'||artifacts[0].expired||artifacts[0].size_in_bytes>32768)throw Error('Report artifact rejected');
  const directory=mkdtempSync(join(tmpdir(),'bd3do-report-'));
  try{
    cli('gh',['run','download',String(runId),'--repo',repository,'--name','bd3do-isolation-report','--dir',directory],root);
    const text=readFileSync(join(directory,'isolation-report.json'),'utf8');if(Buffer.byteLength(text)>32768)throw Error('Report oversized');const report=JSON.parse(text);
    const verification=verifyEvidence({run,report,expected:{runId,headCommit,treeDigest:digest,branch,mode},proposal,baseline});
    return{verification,run,report};
  }finally{rmSync(directory,{recursive:true,force:true});}
}
