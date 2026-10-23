// Corrupt the measurement driver only in child memory, never game files.
const fs=require('node:fs'),cp=require('node:child_process');
const faults=[
 ['lost personal tool progress','stat.toolSavedSeconds=(stat.toolSavedSeconds||0)+progress*(1-1/scale);','stat.toolSavedSeconds=(stat.toolSavedSeconds||0)+0;'],
 ['old incomplete tick','function advanceMeasuredRound(dt){updatePlay(dt);}','function advanceMeasuredRound(dt){elapsed+=dt;for(const bot of bots)bot.kit.tick(elapsed);updateTeamAbilities();updateBots(dt);updateTraffic(dt);}'],
 ['double simulation clock','function advanceMeasuredRound(dt){updatePlay(dt);}','function advanceMeasuredRound(dt){elapsed+=dt;updatePlay(dt);}'],
 ['lost hit attribution','stat.ramHits++;stat.ramDamage+=actual;','stat.ramHits+=0;stat.ramDamage+=0;'],
 ['lost objective accounting',"if(e.type==='planted'){bench.plants++;","if(e.type==='planted'){bench.plants+=0;"],
];
const source=fs.readFileSync('scripts/bot-balance.cjs','utf8');
for(const[label,from,to]of faults){
 if(!source.includes(from))throw Error('Fault anchor changed: '+label);
 const patch=`const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(file,...args){const value=read.call(this,file,...args);return typeof value==='string'&&String(file).replaceAll('\\\\','/').endsWith('/scripts/bot-balance.cjs')?value.replace(${JSON.stringify(from)},${JSON.stringify(to)}):value;};require('./tests-bot-balance.cjs');`;
 const run=cp.spawnSync(process.execPath,['-e',patch],{cwd:__dirname,encoding:'utf8',timeout:60000,windowsHide:true});
 if(run.status!==1||!String(run.stderr).includes('AssertionError'))throw Error('Fault not detected: '+label+' '+run.stderr);
 console.log('PASS: measurement in-memory fault detected / '+label);
}
