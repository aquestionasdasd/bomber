import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyEvidence,treeDigest} from './evidence.mjs';
import {sha256,validateProposal} from './gate.mjs';
import {image,coreTests,files} from './policy.mjs';
const baseline=Object.fromEntries(Object.keys(files).map(p=>[p,readFileSync(new URL('../../'+p,import.meta.url),'utf8')]));
function fixture(){
 const path='public/range.js',before=baseline[path],proposal={version:1,baseCommit:'f'.repeat(40),changes:[{path,beforeSha256:sha256(before),after:before.replace('if(count<=0)return-1;','if(!Number.isFinite(count)||count<=0)return-1;')}]};
 const head='a'.repeat(40),digest='b'.repeat(64),run={id:7,repository:{full_name:'aquestionasdasd/bomber'},head_sha:head,head_branch:'codex/discord-probe-test',event:'push',path:'.github/workflows/bd3do-isolated.yml',status:'completed',conclusion:'success',run_attempt:1};
 const report={version:1,mode:'candidate',sourceCommit:head,trustedTreeSha256:digest,image,passed:true,publicationAuthorized:false,probe:Object.fromEntries(['nonRoot','noCredentials','noHostMount','noDockerSocket','readOnlyProject','readOnlyRoot','noCapabilities','noNewPrivileges','networkBlocked'].map(k=>[k,true])),tests:[...new Set([...coreTests,...files[path]])].map(file=>({file,passed:true})),candidate:{...validateProposal(proposal,baseline),proposalSha256:sha256(JSON.stringify(proposal))}};report.probe.probe='passed';
 return{run,report,proposal,baseline,expected:{runId:7,headCommit:head,treeDigest:digest,branch:run.head_branch,mode:'candidate'}};
}
test('independent verifier binds run, source tree, exact proposal and fixed checks',()=>assert.equal(verifyEvidence(fixture()).verified,true));
test('wrong repository/head/workflow/event/run/attempt/status are rejected',()=>{for(const edit of [x=>x.run.repository.full_name='other/repo',x=>x.run.head_sha='c'.repeat(40),x=>x.run.path='other.yml',x=>x.run.event='pull_request_target',x=>x.run.id=8,x=>x.run.run_attempt=2,x=>x.run.conclusion='failure',x=>x.run.head_branch='main']){const x=fixture();edit(x);assert.throws(()=>verifyEvidence(x));}});
test('missing isolation, stale source/proposal and missing/duplicated/failed checks are rejected',()=>{for(const edit of [x=>x.report.probe.networkBlocked=false,x=>delete x.report.probe.noHostMount,x=>x.report.trustedTreeSha256='c'.repeat(64),x=>x.report.candidate.proposalSha256='c'.repeat(64),x=>x.report.tests.pop(),x=>x.report.tests[0].passed=false,x=>x.report.tests[1]=x.report.tests[0],x=>x.proposal.changes[0].after+='\n',x=>x.report.publicationAuthorized=true]){const x=fixture();edit(x);assert.throws(()=>verifyEvidence(x));}});
test('tree digest binds every tracked mode/blob/path except the proposal data file',()=>{const a='100644 blob abc\tpublic/range.js\0';assert.equal(treeDigest(a),treeDigest(a+'100644 blob def\tautomation-candidate.json\0'));assert.notEqual(treeDigest(a),treeDigest(a.replace('abc','abd')));});
