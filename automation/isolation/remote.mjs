// No model output, request prose or candidate code is executed in this host process.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync,lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {image,coreTests,files,limits,testTimeouts} from './policy.mjs';
import {sha256,validateProposal,validateEnvelope} from './gate.mjs';
import {treeDigest} from './evidence.mjs';
const root=resolve(import.meta.dirname,'../..');
const run=(program,args,options={})=>spawnSync(program,args,{encoding:'utf8',maxBuffer:1024*1024,timeout:limits.testSeconds*1000,windowsHide:true,...options});
function git(args){const r=run('git',['-C',root,...args]);if(r.status!==0)throw Error('Git source preparation failed');return r.stdout;}
export function executeRemote(mode='selftest'){
  if(process.platform!=='linux'||process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='aquestionasdasd/bomber'||!['selftest','candidate'].includes(mode))throw Error('Remote-only execution policy rejected');
  const work=mkdtempSync(join(tmpdir(),'bd3do-isolation-')),project=join(work,'project');mkdirSync(project);
  const report={version:1,mode,sourceCommit:git(['rev-parse','HEAD']).trim(),trustedTreeSha256:treeDigest(git(['ls-tree','-rz','HEAD'])),image,probe:null,tests:[],candidate:null,publicationAuthorized:false};
  try{
    const listing=git(['ls-tree','-rz','--name-only','HEAD']).split('\0').filter(p=>p==='package.json'||p.startsWith('public/')||/^tests[^/]*\.cjs$/.test(p));
    for(const path of listing){const local=resolve(root,path);if(!lstatSync(local).isFile()||lstatSync(local).isSymbolicLink())throw Error('Source type rejected');const out=join(project,path);mkdirSync(resolve(out,'..'),{recursive:true});writeFileSync(out,readFileSync(local));}
    const probe=readFileSync(new URL('./probe.mjs',import.meta.url),'utf8');writeFileSync(join(project,'bd3do-probe.mjs'),probe);
    const args=['run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','10000:10000','--pids-limit','64','--memory','768m','--memory-swap','768m','--cpus','1','--ulimit','nofile=256:256','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--mount',`type=bind,source=${project},target=/project,readonly`,'--workdir','/project',image,'node','--max-old-space-size=384'];
    const dockerNode=file=>{const name='bd3do-'+randomUUID();try{return run('docker',[...args.slice(0,2),'--name',name,...args.slice(2),file],{timeout:(testTimeouts[file]??limits.testSeconds)*1000});}finally{run('docker',['rm','-f',name],{timeout:10000});}};
    // Pull only this digest, before entering the code execution boundary.
    const pull=run('docker',['pull',image],{timeout:120000});if(pull.status!==0)throw Error('Pinned image unavailable');
    const checked=dockerNode('bd3do-probe.mjs');if(checked.status!==0)throw Error('Isolation probe failed');report.probe=JSON.parse(checked.stdout.trim());if(report.probe.probe!=='passed')throw Error('Isolation probe readback failed');
    const tests=new Set(mode==='selftest'?[...coreTests,...Object.values(files).flat()]:coreTests);
    if(mode==='candidate'){
      const raw=readFileSync(join(root,'automation-candidate.json'),'utf8');if(Buffer.byteLength(raw)>limits.proposalBytes)throw Error('Proposal oversized');const proposal=JSON.parse(raw);validateEnvelope(proposal);
      const baseline={};for(const path of Object.keys(files))baseline[path]=git(['show',`${proposal.baseCommit}:${path}`]);
      const manifest=validateProposal(proposal,baseline);
      // Host reads and parses candidate text only. Its execution stays in Docker.
      for(const change of proposal.changes){if(readFileSync(join(project,change.path),'utf8')!==baseline[change.path])throw Error('Candidate base differs from exported source');writeFileSync(join(project,change.path),change.after);files[change.path].forEach(test=>tests.add(test));}
      report.candidate={...manifest,proposalSha256:sha256(JSON.stringify(proposal))};
    }
    for(const file of tests){if(!/^tests[a-z0-9-]*\.cjs$/.test(file)||!listing.includes(file))throw Error('Test recipe rejected');const started=Date.now(),r=dockerNode(file);const ok=r.status===0&&r.signal===null&&/PASS/.test(r.stdout);const failureKind=ok?null:r.error?.code==='ETIMEDOUT'?'timeout':/AssertionError/.test(r.stderr)?'assertion':/not defined|Cannot find|missing|ENOENT/.test(r.stderr)?'fixture_dependency':'test_failed';report.tests.push({file,passed:ok,elapsedMs:Date.now()-started,exitCode:r.status,signal:r.signal,failureKind});if(!ok)throw Error('Fixed test failed');}
    report.passed=true;
  }catch{report.passed=false;}
  finally{writeFileSync(join(root,'isolation-report.json'),JSON.stringify(report,null,2)+'\n');rmSync(work,{recursive:true,force:true});}
  return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const report=executeRemote(process.argv[2]??'selftest');console.log(JSON.stringify({isolationPassed:report.passed,mode:report.mode,testCount:report.tests.length,publicationAuthorized:false}));if(!report.passed)process.exitCode=1;}
