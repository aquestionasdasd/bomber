const assert=require('node:assert/strict'),test=require('./tests-bot-habits.cjs');
async function main(){
 const cases=[
  ['single round becomes a habit','repetitions:2','repetitions:1','two independently'],
  ['single opponent becomes a group','enemies:2','enemies:1','repeated views'],
  ['late sightings teach openings','now-roundStartedAt>BOT_HABITS.opening','false','late stale'],
  ['stale sightings teach openings','now-c.seenAt>1','false','late stale'],
  ['history never expires','value-openings[0].round>BOT_HABITS.rounds','false','four-round'],
  ['new-match reset keeps memory','else openings.length=0','else {}','four-round'],
  ['old habit overrides live pressure',"!contacts(defenderTeam,now).length","true",'current sighting'],
  ['remote site counts as entry','distance(c,site)>BOT_HABITS.radius','false','radius and'],
  ['history crosses team boundary','o.team===team&&o.opponent===opponent&&','', 'radius and']
 ];
 for(const [name,from,to,prefix]of cases){let applied=false,detected=false;try{await test({only:n=>n.startsWith(prefix),mutate:s=>{assert.ok(s.includes(from),name);applied=true;return s.replace(from,to);}});}catch(e){if(e.code!=='ERR_ASSERTION')throw e;detected=true;}assert.ok(applied&&detected,name);console.log('PASS detects '+name);}
 return{faults:cases.length,memoryOnly:true};
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
