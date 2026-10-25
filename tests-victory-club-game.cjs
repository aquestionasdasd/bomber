const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main(){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const anchor='  const actualCreateMap = imported.createMap;';assert.ok(base.includes(anchor));
 const prefix=base.slice(0,cut).replace(anchor,anchor+`\n const media=[];const createMusic=imported.createVictoryMusic;imported.createVictoryMusic=options=>createMusic({...options,createAudio:()=>{const m={paused:true,ended:false,seeking:false,readyState:4,currentTime:0,load(){},play(){this.paused=false;return Promise.resolve()},pause(){this.paused=true},removeAttribute(){}};media.push(m);return m;}});`);
 const mod=new Module(path.join(__dirname,'victory-club-game-harness.cjs'),module);mod.filename=path.join(__dirname,'victory-club-game-harness.cjs');mod.paths=module.paths;mod._compile(prefix+'\n return {harness,media};\n}\nmodule.exports=main;',mod.filename);
 const {harness,media}=await mod.exports(),h=harness();let groups=0;const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name)};
 function setup(){h.reset();h.run(`soundEnabled=true;volume=.45;victoryMusicEnabled=true;victoryMusicVolume=.6;syncVictoryMusic();victoryMusic.reset();makeBot({x:60,z:60},0,'red',{id:'enemy',team:'red',primary:'classic'});bots[0].rangeTarget=true;`)}
 function win(team='blue'){h.sandbox.winningTeam=team;h.run('match.endRound(winningTeam,\'elimination\');handleMatchEvents();updateVictoryCamera(.1);updateVictoryClub()')}
 const on=()=>h.run('victoryClub.active');
 test('actual winning result starts existing BGM and club; duplicate result uses the same media clock',()=>{
  setup();win();assert.equal(on(),true);assert.equal(h.elements.get('victory-club').hidden,false);assert.equal(h.run('victoryCamera.active'),true);const m=media.at(-1);m.currentTime=2.5;h.run('updateVictoryClub();showRoundResult(player.team,\'elimination\');updateVictoryClub()');assert.equal(m.currentTime,2.5);assert.equal(on(),true);
 });
 test('loss, live, buy, empty survivor celebration and muted results obey independent result/audio gates',()=>{
  setup();win('red');assert.equal(on(),false);
  for(const phase of ['live','buy']){setup();win();h.sandbox.testPhase=phase;h.run('match.phase=testPhase;updateVictoryClub()');assert.equal(on(),false)}
  setup();h.run('player.alive=false');win();assert.equal(h.run('victoryCamera.active'),false);assert.equal(on(),true,'Music may celebrate the team result without any surviving dancer');
  for(const gate of ['soundEnabled=false','volume=0','victoryMusicEnabled=false','victoryMusicVolume=0']){setup();h.run(gate+';syncVictoryMusic()');win();assert.equal(on(),false)}
 });
 test('pending, buffering and paused audio do not pretend to play; resume uses current transport time',()=>{
  setup();win();const m=media.at(-1);for(const ready of[0,2]){m.readyState=ready;h.run('updateVictoryClub()');assert.equal(on(),false)}m.readyState=4;m.currentTime=3;h.run('updateVictoryClub()');assert.equal(on(),true);m.paused=true;h.run('updateVictoryClub()');assert.equal(on(),false);
 });
 test('pause, host pause, visibility, next round and menu remove lights before the next render',()=>{
  for(const stop of ['pauseGame()','netHostPaused=true','document.hidden=true','spawnRound(false)','backMenu()']){setup();h.run('document.hidden=false;netHostPaused=false');win();assert.equal(on(),true);h.run(stop+';updateVictoryClub()');assert.equal(on(),false)}h.run('document.hidden=false;netHostPaused=false');
 });
 test('fresh-result audible:false gate stays silent/dark and cannot invent playback',()=>{
  setup();win();h.run('victoryMusic.reset();showRoundResult(player.team,\'elimination\',{audible:false});updateVictoryClub()');assert.equal(on(),false);h.run('showRoundResult(player.team,\'elimination\');updateVictoryClub()');assert.equal(on(),false);
 });
 console.log(`PASS: ${groups} actual saved-game victory club groups; inert media and renderer`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
