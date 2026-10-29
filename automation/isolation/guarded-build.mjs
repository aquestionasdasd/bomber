// Fixed official Sites build; all Node subprocesses retain the candidate blocker.
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync} from 'node:fs';import {resolve,join} from 'node:path';import {sha256} from './gate.mjs';
const guard=new URL('./build-guard.mjs',import.meta.url).href;
const helper='C:/Users/user1/.codex/plugins/cache/openai-curated-remote/sites/1.1.2/scripts/build-site.mjs';
const id=process.argv[2],state=resolve(import.meta.dirname,'../../../.state');let proofPath,before;
function manifest(){const r=spawnSync('git',['ls-tree','-rz','--name-only','HEAD','--','public'],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error('Build source listing failed');return Object.fromEntries(r.stdout.split('\0').filter(Boolean).sort().map(p=>[p,sha256(readFileSync(resolve(process.cwd(),p)))]));}
if(id!==undefined){if(!/^[a-f0-9-]{36}$/.test(id)||resolve(process.cwd())!==resolve(import.meta.dirname,'../../../../hashimoto-protocol'))throw Error('Build job rejected');const job=JSON.parse(readFileSync(join(state,'jobs',id,'job.json'),'utf8'));if(job.id!==id||job.phase!=='staged'||job.dryRun!==false)throw Error('Staged real job required');proofPath=join(state,'jobs',id,'build-proof.json');before=manifest();}
const run=spawnSync(process.execPath,[helper],{cwd:process.cwd(),env:{...process.env,NODE_OPTIONS:`--import=${guard}`},stdio:'inherit',windowsHide:true,timeout:300000});
if(run.status!==0)process.exitCode=1;
else if(proofPath){const after=manifest();if(JSON.stringify(after)!==JSON.stringify(before))throw Error('Build changed source assets');writeFileSync(proofPath,JSON.stringify({version:1,jobId:id,guarded:true,buildSucceeded:true,publicHashes:after})+'\n');}
