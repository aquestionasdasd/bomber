const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-nope-bottle.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const range='if(dist>0&&dist<=NOPE_SKILLS.bottleRange&&bot.kit.smoke>0)';
 const height='Math.abs(spot.y-landing.y)<=CHARACTER_SKILLS.heightTolerance';
 const guard="if(landing&&distance(landing,spot)<NOPE_SKILLS.bottleRadius&&\n            "+height+"&&\n            ordinaryReachable({type:'nope-bottle',...landing},spot))";
 const variants=[
  ['old seventeen metre limit',s=>s.replace(range,'if(dist>5&&dist<17&&bot.kit.smoke>0)'),'full forty'],
  ['wrong floor',s=>s.replace(height,'true'),'clipped wall'],
  ['ignore clipped blast reachability',s=>s.replace(guard,'if(landing)'),'clipped wall'],
  ['read hidden current location',s=>s.replace('const spot={x:known.x,y:known.y??bot.y??0,z:known.z};','const spot={x:player.x,y:player.y||0,z:player.z};'),'sight loss'],
 ];
 for(const[name,edit,group]of variants){assert.ok(edit(source)!==source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)')}
})().catch(e=>{console.error(e);process.exitCode=1});
