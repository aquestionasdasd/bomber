import {sha256,validateProposal} from './gate.mjs';
import {repository,image,files,coreTests} from './policy.mjs';
export function treeDigest(entries){return sha256(entries.split('\0').filter(x=>x&&!x.endsWith('\tautomation-candidate.json')).sort().join('\0'));}
export function verifyEvidence({run,report,expected,proposal,baseline}){
  const no=()=>{throw Error('Independent release evidence rejected');};
  if(run?.repository?.full_name!==repository||run.id!==expected.runId||run.head_sha!==expected.headCommit||run.head_branch!==expected.branch||run.event!=='push'||run.path!=='.github/workflows/bd3do-isolated.yml'||run.status!=='completed'||run.conclusion!=='success'||run.run_attempt!==1)no();
  if(report?.version!==1||report.mode!==expected.mode||report.sourceCommit!==expected.headCommit||report.trustedTreeSha256!==expected.treeDigest||report.image!==image||report.passed!==true||report.publicationAuthorized!==false||report.probe?.probe!=='passed')no();
  const probe=['nonRoot','noCredentials','noHostMount','noDockerSocket','readOnlyProject','readOnlyRoot','noCapabilities','noNewPrivileges','networkBlocked'];
  if(probe.some(key=>report.probe[key]!==true)||!Array.isArray(report.tests))no();
  const tests=new Set(coreTests);
  let manifest=null;
  if(expected.mode==='candidate'){
    manifest=validateProposal(proposal,baseline);
    proposal.changes.forEach(c=>files[c.path].forEach(t=>tests.add(t)));
    if(JSON.stringify(report.candidate)!==JSON.stringify({...manifest,proposalSha256:sha256(JSON.stringify(proposal))}))no();
  }else if(expected.mode!=='selftest'||report.candidate!==null)no();
  if(report.tests.length!==tests.size||report.tests.some(t=>!tests.delete(t.file)||t.passed!==true)||tests.size)no();
  return {verified:true,mode:expected.mode,runId:run.id,headCommit:expected.headCommit,manifest,publicationAuthorized:false};
}
