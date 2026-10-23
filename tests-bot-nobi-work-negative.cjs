const fs=require('node:fs'),cp=require('node:child_process');
const faults=[
 ['no work-time decision',"if(bot.kit?.character==='nobi'&&(interactPlant&&!committedPlant||interactDefuse&&!committedDefuse)","if(bot.kit?.character==='no-nobi'&&(interactPlant&&!committedPlant||interactDefuse&&!committedDefuse)"],
 ['early approach waste',"(interactPlant&&!committedPlant||interactDefuse&&!committedDefuse)","(match.spike.carrier===bot.id&&distance(bot,site)<8||interactDefuse&&!committedDefuse)"],
 ['retry flood',"&&elapsed>=(bot.nextNobiToolAt||0)",""],
 ['mid-work surprise cast',"(interactPlant&&!committedPlant||interactDefuse&&!committedDefuse)","(interactPlant||interactDefuse)"],
];
const source=fs.readFileSync('public/game.js','utf8');
for(const[label,from,to]of faults){
 if(!source.includes(from))throw Error('Fault anchor changed: '+label);
 const patch=`const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(file,...args){const value=read.call(this,file,...args);return typeof value==='string'&&String(file).endsWith(require('node:path').join('public','game.js'))?value.replace(${JSON.stringify(from)},${JSON.stringify(to)}):value;};require('./tests-bot-nobi-work.cjs');`;
 const run=cp.spawnSync(process.execPath,['-e',patch],{cwd:__dirname,encoding:'utf8',timeout:90000,windowsHide:true});
 if(run.status!==1||!String(run.stderr).includes('AssertionError'))throw Error('Fault not detected: '+label+' '+run.stderr);
 console.log('PASS: in-memory tool fault detected / '+label);
}
