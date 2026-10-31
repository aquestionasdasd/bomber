const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const faults=[
 ['range','enemyDistance<=SHOTGUN_TACTICS.fireRange','true', 'CPU conserves shells'],
 ['dash',"if(shotgun&&bot.kit?.character==='duelist'&&enemy", "if(false&&shotgun&&bot.kit?.character==='duelist'&&enemy",'duelist arms then'],
 ['cover','const shotgunIntent=shotgun&&','const shotgunIntent=false&&shotgun&&','CPU selects a real corner']
];
for(const [name,from,to,group] of faults){const code=`require('./tests-shotgun-tactics.cjs')({only:n=>n.startsWith(${JSON.stringify(group)}),mutate:s=>{if(!s.includes(${JSON.stringify(from)}))throw Error('fault anchor absent');return s.replace(${JSON.stringify(from)},${JSON.stringify(to)})}}).then(()=>process.exit(0)).catch(e=>{if(e.code!=='ERR_ASSERTION')throw e;process.exit(23)})`;
 const result=spawnSync(process.execPath,['-e',code],{cwd:__dirname,encoding:'utf8',windowsHide:true,timeout:180000});assert.equal(result.status,23,name+': real assertion must reject the in-memory fault\n'+result.stderr);console.log('PASS: in-memory '+name+' fault rejected by actual saved-game behavior');}
console.log('PASS: 3 in-memory faults; no product file writes or sound playback');
