// In-memory faults must be caught by the saved-game behavior suite.
const fs=require('node:fs'),cp=require('node:child_process');
const faults=[
 ['no hit damage','damageEntity(victim,CAR_SKILLS.bumperDamage,actor', 'damageEntity(victim,0,actor'],
 ['instant victim displacement','beginCarMotion(victim,{id:m.id,phase:2,', 'victim.x+=m.vx/CAR_SKILLS.bumperSpeed*24;victim.z+=m.vz/CAR_SKILLS.bumperSpeed*24;beginCarMotion(victim,{id:m.id,phase:2,'],
 ['wall traversal','moveEntity(actor,m.vx*step,m.vz*step,actor===player?.34:.4);', 'actor.x+=m.vx*step;actor.z+=m.vz*step;'],
];
const source=fs.readFileSync('public/game.js','utf8');
for(const[label,from,to]of faults){
 if(!source.includes(from))throw Error('Fault anchor changed: '+label);
 const patch=`const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(file,...args){const value=read.call(this,file,...args);return typeof value==='string'&&String(file).replaceAll('\\\\','/').endsWith('/public/game.js')?value.replace(${JSON.stringify(from)},${JSON.stringify(to)}):value;};require('./tests-car-game.cjs');`;
 const run=cp.spawnSync(process.execPath,['-e',patch],{cwd:__dirname,encoding:'utf8',timeout:60000,windowsHide:true});
 if(run.status!==1||!String(run.stderr).includes('AssertionError'))throw Error('Fault not detected: '+label+' '+run.stderr);
 console.log('PASS: in-memory fault detected / '+label);
}
