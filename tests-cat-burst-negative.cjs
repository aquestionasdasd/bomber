const fs=require('node:fs'),cp=require('node:child_process');
const faults=[
 ['no rupture damage',"damageEntity(victim,removed*CAT_SKILLS.pluckDamagePerRound,actor,{skill:'cat'});","if(false)damageEntity(victim,removed*CAT_SKILLS.pluckDamagePerRound,actor,{skill:'cat'});"],
 ['full damage with one round','removed*CAT_SKILLS.pluckDamagePerRound','CAT_SKILLS.pluckAmmo*CAT_SKILLS.pluckDamagePerRound'],
 ['prediction consumes real enemy ammo',"if(!predict&&key==='q'){\n  const victim=target.enemy,removed=", "if(key==='q'){\n  const victim=target.enemy,removed="],
];
const source=fs.readFileSync('public/game.js','utf8').replaceAll('\r\n','\n');
for(const[label,from,to]of faults){
 if(!source.includes(from))throw Error('Fault anchor changed: '+label);
 const patch=`const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(file,...args){const value=read.call(this,file,...args);return typeof value==='string'&&String(file).endsWith(require('node:path').join('public','game.js'))?value.replaceAll('\\r\\n','\\n').replace(${JSON.stringify(from)},${JSON.stringify(to)}):value;};require('./tests-cat-burst.cjs');`;
 const run=cp.spawnSync(process.execPath,['-e',patch],{cwd:__dirname,encoding:'utf8',timeout:90000,windowsHide:true});
 if(run.status!==1||!String(run.stderr).includes('AssertionError'))throw Error('Fault not detected: '+label+' '+run.stderr);
 console.log('PASS: in-memory CAT burst fault detected / '+label);
}
