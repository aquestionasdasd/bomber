// Corrupt the measurement driver only in child memory, never game files.
const fs=require('node:fs'),cp=require('node:child_process');
const faults=[
 ['Renko lost actual refill', 'stat.restartRefills=(stat.restartRefills||0)+1;', 'stat.restartRefills=(stat.restartRefills||0)+0;'],
 ['Renko lost restored C stock', "stat['restartRestored'+key]=(stat['restartRestored'+key]||0)+restored;", "stat['restartRestored'+key]=(stat['restartRestored'+key]||0);"],
 ['Renko lost post-refill use', 'stat.restartLaterCasts=(stat.restartLaterCasts||0)+1;', 'stat.restartLaterCasts=(stat.restartLaterCasts||0)+0;'],
 ['Renko lost accepted push', 'owner.dartPushes=(owner.dartPushes||0)+1;', 'owner.dartPushes=(owner.dartPushes||0)+0;'],
 ['Renko lost actual travel', 'owner.dartPushDistance=(owner.dartPushDistance||0)+moved;', 'owner.dartPushDistance=(owner.dartPushDistance||0)+0;'],
 ['Renko credits non-firearm loss', 'if(options?.firearm&&actual>0&&push?.sourceId===killer.id', 'if(actual>0&&push?.sourceId===killer.id'],
 ["lost stitch sample time","owner.stitchSlowSeconds=(owner.stitchSlowSeconds||0)+rootStepDt;","owner.stitchSlowSeconds=(owner.stitchSlowSeconds||0)+0;"],
 ["lost actual tag detection","owner.tagDetections=(owner.tagDetections||0)+1;","owner.tagDetections=(owner.tagDetections||0)+0;"],
 ["lost seed sample time","owner.seedSlowSeconds=(owner.seedSlowSeconds||0)+rootStepDt;","owner.seedSlowSeconds=(owner.seedSlowSeconds||0)+0;"],
 ["lost accepted heal amount", "owner.mendHealing=(owner.mendHealing||0)+actual;", "owner.mendHealing=(owner.mendHealing||0)+0;"],
 ['lost personal tool progress','stat.toolSavedSeconds=(stat.toolSavedSeconds||0)+progress*(1-1/scale);','stat.toolSavedSeconds=(stat.toolSavedSeconds||0)+0;'],
 ['old incomplete tick','try{updatePlay(dt);}finally{rootStepDt=0;}','try{elapsed+=dt;for(const bot of bots)bot.kit.tick(elapsed);updateTeamAbilities();updateBots(dt);updateTraffic(dt);}finally{rootStepDt=0;}'],
 ['double simulation clock','try{updatePlay(dt);}finally{rootStepDt=0;}','try{elapsed+=dt;updatePlay(dt);}finally{rootStepDt=0;}'],
 ['lost hit attribution','stat.ramHits++;stat.ramDamage+=actual;','stat.ramHits+=0;stat.ramDamage+=0;'],
 ['lost actual solder damage','stat.solderDamage=(stat.solderDamage||0)+actual;','stat.solderDamage=(stat.solderDamage||0)+0;'],
 ['lost actual bottle damage','stat.bottleDamage=(stat.bottleDamage||0)+actual;','stat.bottleDamage=(stat.bottleDamage||0)+0;'],
 ['lost glint duration accounting',"owner.glintEnemyBlindSeconds=(owner.glintEnemyBlindSeconds||0)+effect.duration;","owner.glintEnemyBlindSeconds=(owner.glintEnemyBlindSeconds||0)+0;"],
 ['lost objective accounting',"if(e.type==='planted'){bench.plants++;","if(e.type==='planted'){bench.plants+=0;"],
 ['lost root sample time','owner.rootSlowSeconds=(owner.rootSlowSeconds||0)+rootStepDt;','owner.rootSlowSeconds=(owner.rootSlowSeconds||0)+0;'],
];
const source=fs.readFileSync('scripts/bot-balance.cjs','utf8');
for(const[label,from,to]of faults){
 if(process.argv.includes('--renko-only')&&!label.startsWith('Renko'))continue;
 if(!source.includes(from))throw Error('Fault anchor changed: '+label);
 const patch=`const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(file,...args){const value=read.call(this,file,...args);return typeof value==='string'&&String(file).replaceAll('\\\\','/').endsWith('/scripts/bot-balance.cjs')?value.replace(${JSON.stringify(from)},${JSON.stringify(to)}):value;};require('./tests-bot-balance.cjs');`;
 const run=cp.spawnSync(process.execPath,['-e',patch],{cwd:__dirname,encoding:'utf8',timeout:60000,windowsHide:true});
 if(run.status!==1||!String(run.stderr).includes('AssertionError'))throw Error('Fault not detected: '+label+' '+run.stderr);
 console.log('PASS: measurement in-memory fault detected / '+label);
}
