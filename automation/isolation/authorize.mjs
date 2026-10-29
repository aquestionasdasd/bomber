// Independent privileged stage. Never consumes model instructions or executes a candidate.
import {spawnSync} from 'node:child_process';import {readFileSync,writeFileSync,lstatSync} from 'node:fs';import {resolve,join,sep} from 'node:path';import {fileURLToPath} from 'node:url';
import {files} from './policy.mjs';import {sha256,validateProposal} from './gate.mjs';import {readRun} from './read-run.mjs';import {validateRelease} from './release.mjs';
const root=resolve(import.meta.dirname,'../..'),state=resolve(root,'../.state'),sharedRoot=resolve(root,'../../collab-bomber'),siteRoot=resolve(root,'../../hashimoto-protocol');
const projectId='appgprj_6ad62c7885748191b7a47af3a3ac679b',game='https://hashimoto-protocol-north-exit.ohuraharah.chatgpt.site';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
function cli(program,args,cwd=root,input){const r=spawnSync(program,args,{cwd,input,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:2*1024*1024});if(r.status!==0)throw Error('Release verification operation failed');return r.stdout;}
const git=(args,cwd)=>cli('git',args,cwd);
function getJob(id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Job id rejected');const directory=join(state,'jobs',id),job=read(join(directory,'job.json'));if(job.id!==id||job.dryRun!==false||!['staged','authorized','published'].includes(job.phase))throw Error('Real staged job required');return{directory,job};}
function source(cwd,base,proposal){
  if(git(['status','--porcelain','--untracked-files=no'],cwd).trim())throw Error('Uncommitted source changes');const commit=git(['rev-parse','HEAD'],cwd).trim(),paths=git(['diff','--name-only',base,commit,'--'],cwd).trim().split('\n').filter(Boolean),wanted=proposal.changes.map(c=>c.path);
  const beforeHashes={},afterHashes={};for(const path of wanted){beforeHashes[path]=sha256(git(['show',`${base}:${path}`],cwd));afterHashes[path]=sha256(git(['show',`${commit}:${path}`],cwd));if(sha256(readFileSync(join(cwd,path)))!==afterHashes[path])throw Error('Working and committed candidate bytes differ');}
  return{baseCommit:base,commit,changedPaths:paths,extraTrackedChanges:paths.some(p=>!wanted.includes(p)),beforeHashes,afterHashes,otherPublicUnchanged:paths.filter(p=>p.startsWith('public/')).every(p=>wanted.includes(p))};
}
export function authorize(id){
  const{directory,job}=getJob(id),config=read(join(state,'pipeline-config.json'));
  if(config.controlCommit!==job.controlCommit||git(['rev-parse','HEAD'],root).trim()!==config.controlCommit||git(['status','--porcelain','--untracked-files=no'],root).trim())throw Error('Trusted controller changed');
  const proposal=read(join(directory,'proposal.json')),review=read(join(directory,'review.json')),baseline=Object.fromEntries(Object.keys(files).map(p=>[p,git(['show',`${job.baseSharedCommit}:${p}`],sharedRoot)]));validateProposal(proposal,baseline);
  const evidence=readRun({runId:job.runId,headCommit:job.headCommit,branch:job.branch,mode:'candidate',controlCommit:job.controlCommit,proposal,baseline,root});
  const shared=source(sharedRoot,job.baseSharedCommit,proposal),site=source(siteRoot,job.baseSiteCommit,proposal);
  shared.remoteVerified=git(['ls-remote','origin','refs/heads/codex/bus-round-retirement'],sharedRoot).trim().split(/\s/)[0]===shared.commit;
  const opened=read(join(directory,'site-open.json')),prepared=read(join(directory,'site-package.json'));
  if(opened.project_id!==projectId||opened.commit_sha!==job.baseSiteCommit||resolve(opened.checkout_path)!==siteRoot||prepared.project_id!==projectId||prepared.commit_sha!==site.commit||resolve(prepared.checkout_path)!==siteRoot)throw Error('Official Sites preparation mismatch');
  const archive=resolve(prepared.archive);if(!archive.startsWith(resolve(siteRoot,'..')+sep)||!archive.endsWith('.tar.gz')||!lstatSync(archive).isFile()||lstatSync(archive).isSymbolicLink())throw Error('Owned archive required');
  const listing=git(['ls-tree','-rz','--name-only',site.commit,'--','public'],siteRoot).split('\0').filter(Boolean).sort(),hashes={};for(const p of listing){const file=join(siteRoot,p);if(!lstatSync(file).isFile()||lstatSync(file).isSymbolicLink())throw Error('Public asset type rejected');hashes[p]=sha256(readFileSync(file));}
  const build=read(join(directory,'build-proof.json'));if(build.jobId!==id||build.guarded!==true||build.buildSucceeded!==true||JSON.stringify(build.publicHashes)!==JSON.stringify(hashes))throw Error('Guarded build proof mismatch');
  const checked=JSON.parse(cli('python',[fileURLToPath(new URL('./archive-check.py',import.meta.url)),archive],root,JSON.stringify(hashes)));
  Object.assign(site,{officialHelperVerified:true,archiveVerified:checked.archivePublicExact===true,archiveSourceCommit:prepared.commit_sha,projectId,archive});
  const permit=validateRelease({proposal,baseline,review,evidence,shared,site,currentSharedBase:config.sharedCommit,currentSiteBase:config.siteCommit,dryRun:job.dryRun});
  writeFileSync(join(directory,'release-permit.json'),JSON.stringify({...permit,jobId:id,publicHashes:hashes},null,2)+'\n');job.phase='authorized';writeFileSync(join(directory,'job.json'),JSON.stringify(job,null,2)+'\n');return permit;
}
export async function finish(id){
  const permit=authorize(id),{directory,job}=getJob(id),native=read(join(directory,'native-success.json'));
  if(native.project_id!==projectId||native.status!=='succeeded'||native.commit_sha!==permit.sourceCommit||native.url?.replace(/\/$/,'')!==game||!/^appgdep_[a-f0-9]{32}$/.test(native.deployment_id)||typeof native.saved_version_id!=='string'||!native.saved_version_id.startsWith(projectId+'~'))throw Error('Native successful deployment proof required');
  for(const change of permit.manifest.changes){const response=await fetch(game+'/'+change.path.slice(7),{redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store'});if(response.status!==200)throw Error('Published asset unavailable');const reader=response.body.getReader(),parts=[];let size=0;try{while(true){const r=await reader.read();if(r.done)break;if((size+=r.value.length)>16384){await reader.cancel();throw Error('Published module oversized');}parts.push(r.value);}}finally{reader.releaseLock();}if(sha256(Buffer.concat(parts))!==change.afterSha256)throw Error('Published candidate bytes mismatch');}
  const receipt={version:1,id:job.request.id,contentHash:job.contentHash,status:'published',reason:'published',sourceCommit:permit.sourceCommit,sharedCommit:permit.sharedCommit,deploymentId:native.deployment_id};
  writeFileSync(join(directory,'verified-receipt.json'),JSON.stringify(receipt,null,2)+'\n');job.phase='published';writeFileSync(join(directory,'job.json'),JSON.stringify(job,null,2)+'\n');return receipt;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const[command,id]=process.argv.slice(2);if(command==='authorize')console.log(JSON.stringify(authorize(id)));else if(command==='finish')console.log(JSON.stringify(await finish(id)));else throw Error('Release command rejected');}
