const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-ember-solder.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const range="if(!cast&&dist>0&&dist<=EMBER_SKILLS.solderRange&&bot.kit.smoke>0)";
 const height='Math.abs(spot.y-(landing.y-EMBER_SKILLS.solderGroundOffset))<=CHARACTER_SKILLS.heightTolerance';
 const guard="if(landing&&distance(landing,spot)<EMBER_SKILLS.solderRadius&&\n            "+height+"&&\n            ordinaryReachable({type:'ember-solder',...landing},spot))";
 const variants=[
  ['old fourteen metre/close exclusion',s=>s.replace(range,"if(!cast&&dist>=3&&dist<=14&&bot.kit.smoke>0)"),'full eighteen'],
  ['wrong-floor cast',s=>s.replace(height,'true'),'clipped wall'],
  ['ignore clipped splash landing',s=>s.replace(guard,'if(landing)'),'clipped wall'],
  ['read hidden current enemy instead of fixed sight memory',s=>s.replace('const spot={x:known.x,y:known.y??bot.y??0,z:known.z};','const spot={x:player.x,y:player.y||0,z:player.z};'),'sight loss'],
 ];
 for(const[name,edit,group]of variants){assert.ok(edit(source)!==source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)')}
})().catch(e=>{console.error(e);process.exitCode=1});
