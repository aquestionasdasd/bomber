const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),run=require('./tests-bot-cat-fetch.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const ray='if(catDropTarget(bot,aim)?.drop!==drop)continue;';
 const variants=[
  ['allow equipment downgrade',s=>s.replace('else if(spec.price<=current.price)continue;',''),'loaded rifle'],
  ['ignore actual visible target',s=>s.replace(ray,''),'occluded first'],
  ['ignore nearer wrong gun intercept',s=>s.replace(ray,'if(!catDropTarget(bot,aim))continue;'),'best usable'],
  ['pick empty gun',s=>s.replace('drop.ammo<=0||',''),'empty drops'],
 ];
 for(const[name,edit,group]of variants){assert.ok(edit(source)!==source,name);await assert.rejects(()=>run({mutate:s=>edit(s.replace(/\r\n/g,'\n')),only:n=>n.startsWith(group)}),{code:'ERR_ASSERTION'});console.log('PASS detects '+name+' (memory only)')}
})().catch(e=>{console.error(e);process.exitCode=1});
