const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const faults=[
 ['guest speculative field',"if(!predict&&!ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round)){actor.kit.restore(before);return;}\n actor.skillThrowUntil", "if(!ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round)){actor.kit.restore(before);return;}\n actor.skillThrowUntil"],
 ['lost stock rollback',"if(!predict&&!ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round)){actor.kit.restore(before);return;}\n actor.skillThrowUntil", "if(!predict&&!ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round)){return;}\n actor.skillThrowUntil"],
 ['through wall damage',"ordinarySkills.nobiVulnerability(target.id,elapsed,target,ordinaryReachable)","ordinarySkills.nobiVulnerability(target.id,elapsed,target,()=>true)"],
 ['shoot during throw',"ordinaryFX.throwing(elapsed)||nobiSkillFX.throwing(elapsed)||mendSkillFX.throwing(elapsed)","ordinaryFX.throwing(elapsed)||mendSkillFX.throwing(elapsed)"],
];
const source=fs.readFileSync('public/game.js','utf8').replace(/\r\n/g,'\n');
for(const[label,from,to]of faults){
 if(!source.includes(from))throw Error('Fault anchor changed '+label);
 const patch=String.raw`const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(file,...args){const value=read.call(this,file,...args);return typeof value==='string'&&String(file).endsWith(require('node:path').join('public','game.js'))?value.replace(/\r\n/g,'\n').replaceAll(${JSON.stringify(from)},${JSON.stringify(to)}):value;};require('./tests-nobi-game.cjs');`;
 const run=cp.spawnSync(process.execPath,['-e',patch],{cwd:__dirname,encoding:'utf8',timeout:90000,windowsHide:true});
 if(run.status!==1||!String(run.stderr).includes('AssertionError'))throw Error('Fault not detected '+label+' '+run.stderr);
 console.log('PASS: Nobi throw in-memory fault detected / '+label);
}
