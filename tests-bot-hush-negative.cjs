// Behavior assertions detect faults applied only in child memory.
const fs=require('node:fs'),cp=require('node:child_process');
const faults=[
 ['old unusable decision',"if(bot.kit?.character==='duck'&&!enemy&&!decoyTarget", "if(bot.kit?.character==='never-duck'&&!enemy&&!decoyTarget"],
 ['stale movement accepted','&&distance(bot,goal)<=18&&bot.moving&&actorGrounded(bot)','&&distance(bot,goal)<=18&&actorGrounded(bot)'],
 ['airborne travel accepted','&&distance(bot,goal)<=18&&bot.moving&&actorGrounded(bot)','&&distance(bot,goal)<=18&&bot.moving'],
 ['spawn travel wasted','&&distance(bot,goal)<=18',''],
 ['silent far footsteps leaked',"if(!ordinarySkills.quiet(bot.id,elapsed)){if(distance(bot,player)<19)","if(true){if(distance(bot,player)<19)"],
];
const source=fs.readFileSync('public/game.js','utf8');
for(const[label,from,to]of faults){
 if(!source.includes(from))throw Error('Fault anchor changed: '+label);
 const patch=`const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(file,...args){const value=read.call(this,file,...args);return typeof value==='string'&&String(file).endsWith(require('node:path').join('public','game.js'))?value.replace(${JSON.stringify(from)},${JSON.stringify(to)}):value;};require('./tests-bot-hush.cjs');`;
 const run=cp.spawnSync(process.execPath,['-e',patch],{cwd:__dirname,encoding:'utf8',timeout:60000,windowsHide:true});
 if(run.status!==1||!String(run.stderr).includes('AssertionError'))throw Error('Fault not detected: '+label+' '+run.stderr);
 console.log('PASS: in-memory hush fault detected / '+label);
}
