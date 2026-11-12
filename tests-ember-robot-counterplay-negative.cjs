const assert=require('node:assert/strict'),run=require('./tests-ember-robot-counterplay.cjs');
async function main(){
 const faults=[
  {name:'robot acquisition removed',only:s=>s.startsWith('real CPU Classic'),from:'if(!enemy&&!decoyTarget&&!trafficEscape&&!interactPlant&&!interactDefuse&&!role?.urgent&&!retake?.urgent&&!bot.serviceReload&&spec.mag>0)',to:'if(false)'},
  {name:'robot sight ignores walls and smoke',only:s=>s.startsWith('wall, low cover'),from:'&&rootPointVisible(bot,{x:u.x,y:u.y+ROBOT_TYPES[u.type].height*.5-.08,z:u.z})',to:''},
  {name:'robot shots steal urgent work priority',only:s=>s.startsWith('visible player'),from:'&&!role?.urgent&&!retake?.urgent',to:''},
 ];
 for(const f of faults){let changed=false,error;try{await run({only:f.only,mutate:s=>{assert.ok(s.includes(f.from),'Fault anchor missing');changed=true;return s.replace(f.from,f.to);}});}catch(e){error=e;}assert.equal(changed,true);assert.ok(error,'Fault went undetected: '+f.name);assert.equal(error.code,'ERR_ASSERTION','Unexpected fault failure: '+error.message);console.log('PASS: detects '+f.name);}
 console.log('PASS: 3 robot counterplay memory faults; disk source unchanged');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
