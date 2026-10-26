const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const faults=[
 ['guest speculative damage',"fireKnifeBurst(player,camera.position,direction,knifeCount,{visualOnly:isGuest()});","fireKnifeBurst(player,camera.position,direction,knifeCount,{visualOnly:false});"],
 ['only one knife spent',"if(ultimate&&!player.kit.consumeKnife(knifeCount))return;","if(ultimate&&!player.kit.consumeKnife())return;"],
 ['pending burst replays one',"player.kit.consumeKnife(action.burst===true?Math.min(DUELIST.knives,player.kit.knives):1);","player.kit.consumeKnife();"],
 ['knife rays ignore walls',"ray.intersectObjects([environment,botsGroup],true).find","ray.intersectObjects([botsGroup],true).find"],
];
const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
for(const[label,from,to]of faults){
 if(!source.includes(from))throw Error('Fault anchor changed '+label);
 const patch=String.raw`const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(file,...args){const value=read.call(this,file,...args);return typeof value==='string'&&String(file).endsWith(require('node:path').join('public','game.js'))?value.replace(/\r\n/g,'\n').replaceAll(${JSON.stringify(from)},${JSON.stringify(to)}):value;};require('./tests-duelist-burst-game.cjs');`;
 const run=cp.spawnSync(process.execPath,['-e',patch],{cwd:__dirname,encoding:'utf8',timeout:90000,windowsHide:true});
 if(run.status!==1||!String(run.stderr).includes('AssertionError'))throw Error('Fault not detected '+label+' '+run.stderr);
 console.log('PASS: Duelist burst in-memory fault detected / '+label);
}
