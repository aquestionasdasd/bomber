// Trusted release gate: exact source bytes, not a model's claim, authorize save.
import {validateProposal,sha256} from './gate.mjs';
export function validateRelease({proposal,baseline,review,evidence,shared,site,currentSharedBase,currentSiteBase,dryRun}){
  const no=()=>{throw Error('Release gate rejected');};
  if(dryRun!==false||!review?.approved||review.proposalSha256!==sha256(JSON.stringify(proposal))||Object.keys(review.checks??{}).sort().join(',')!=='approved,matchesRequest,noResourceAbuse,preservesBehavior'||Object.values(review.checks).some(v=>v!==true)||evidence?.verification?.verified!==true||evidence.verification.mode!=='candidate')no();
  const manifest=validateProposal(proposal,baseline);
  if(JSON.stringify(evidence.verification.manifest)!==JSON.stringify(manifest)||evidence.report?.candidate?.proposalSha256!==review.proposalSha256)no();
  if(currentSharedBase!==proposal.baseCommit||shared.baseCommit!==currentSharedBase||site.baseCommit!==currentSiteBase||!/^[a-f0-9]{40}$/.test(currentSiteBase)||!/^[a-f0-9]{40}$/.test(shared.commit)||!/^[a-f0-9]{40}$/.test(site.commit)||!shared.remoteVerified||!site.officialHelperVerified)no();
  const wanted=proposal.changes.map(c=>c.path).sort();
  for(const source of [shared,site]){
    if(JSON.stringify(source.changedPaths?.slice().sort())!==JSON.stringify(wanted)||source.extraTrackedChanges!==false)no();
    for(const change of manifest.changes){if(source.beforeHashes?.[change.path]!==change.beforeSha256||source.afterHashes?.[change.path]!==change.afterSha256)no();}
    if(source.otherPublicUnchanged!==true)no();
  }
  if(site.archiveVerified!==true||site.archiveSourceCommit!==site.commit||site.projectId!=='appgprj_6ad62c7885748191b7a47af3a3ac679b'||typeof site.archive!=='string'||!site.archive.endsWith('.tar.gz'))no();
  return{readyToSave:true,projectId:site.projectId,sourceCommit:site.commit,sharedCommit:shared.commit,archive:site.archive,proposalSha256:review.proposalSha256,manifest};
}
