const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
async function main(){
  const {createVictoryMusic}=await import(pathToFileURL(path.join(__dirname,'public/victory-music.js')).href);
  let now=0,serial=0;const media=[],timers=new Map();
  function createAudio(){
    let readyAt=Infinity;
    const a={loads:0,plays:0,pauses:0,currentTime:0,starts:[],attempts:[],
      load(){this.loads++;readyAt=this.src?now+700:Infinity;},
      play(){this.plays++;this.attempts.push(now);this.starts.push(Math.max(now,readyAt));return Promise.resolve();},
      pause(){this.pauses++;},removeAttribute(k){delete this[k];}};
    media.push(a);return a;
  }
  const options={createAudio,schedule:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},cancel:id=>timers.delete(id)};
  const m=createVictoryMusic(options);
  assert.equal(typeof m.prepare,'function','Prepare the track before a win rather than loading only at the result');
  assert.equal(m.prepare(),true);const a=media[0];assert.equal(a.preload,'auto');assert.equal(a.loads,1);assert.equal(a.plays,0);assert.equal(timers.size,0);
  m.prepare();assert.equal(media.length,1);assert.equal(a.loads,1);
  now=1000;assert.equal(m.result({key:'1:blue',won:true}),true);assert.deepEqual(a.starts,[1000],'The already-loaded fixture starts on the result, without its 700ms cold-load delay');
  assert.equal(media.length,1);assert.equal(a.loads,1);
  console.log('PASS: pre-win load without playback, idempotent preparation, warm result has no simulated cold-load delay');
  for(let round=2;round<=5;round++){
    a.currentTime=4;m.stop();assert.equal(a.currentTime,0);m.reset();m.prepare();
    now+=1000;m.result({key:`${round}:blue`,won:true});assert.equal(a.starts.at(-1),now);assert.equal(a.currentTime,0);
  }
  assert.equal(media.length,1);assert.equal(a.loads,1);m.stop();
  console.log('PASS: next round, reset and repeated wins retain one loaded track and rewind to the beginning');
  const gates=[{soundEnabled:false},{enabled:false},{masterVolume:0},{musicVolume:0},{hidden:true}];
  for(const [index,gate]of gates.entries()){
    const count=a.plays;m.setGate(gate);assert.equal(m.prepare(),false);assert.equal(m.result({key:`muted:${index}`,won:true}),false);
    m.setGate({soundEnabled:true,enabled:true,masterVolume:.5,musicVolume:.6,hidden:false});m.prepare();assert.equal(m.result({key:`muted:${index}`,won:true}),false);assert.equal(a.plays,count);
  }
  assert.equal(a.loads,1);assert.equal(timers.size,0);
  console.log('PASS: muted/disabled/zero/hidden preparation and consumed results never start or replay audio');
  m.result({key:'error',won:true});a.onerror();assert.match(m.state().error,/再生できませんでした/);assert.equal(a.src,undefined);assert.equal(timers.size,0);
  const failedPlays=a.plays;m.prepare();const retry=media.at(-1);assert.notEqual(retry,a);assert.equal(retry.plays,0);now+=1000;m.result({key:'recovered',won:true});assert.equal(retry.starts[0],now);assert.equal(m.state().error,'');assert.equal(a.plays,failedPlays);
  m.dispose();assert.equal(retry.src,undefined);assert.equal(timers.size,0);assert.equal(m.prepare(),false);
  console.log('PASS: load/decode failure releases failed media, next preparation recovers, disposal releases the cached track');
  // A rejected old play promise must not stop a later win using the same media.
  let rejectOld;const pending=createAudio();pending.play=function(){this.plays++;if(this.plays===1)return new Promise((_,reject)=>rejectOld=reject);return Promise.resolve();};
  const race=createVictoryMusic({...options,createAudio:()=>pending});race.prepare();race.result({key:'old',won:true});const oldTimer=[...timers.values()][0].fn;
  race.stop();race.result({key:'new',won:true});const pauses=pending.pauses;rejectOld(Error('old interrupted request'));await Promise.resolve();oldTimer();assert.equal(pending.pauses,pauses);assert.equal(race.state().error,'');assert.equal(timers.size,1);
  race.setGate({hidden:true});assert.equal(timers.size,0);race.dispose();
  console.log('PASS: stale rejected play and stale timer cannot cancel a newer win; hide cancels pending playback');
  const waiting={plays:0,audibleStarts:0,load(){},play(){this.plays++;return new Promise(resolve=>this.pending=resolve);},pause(){this.pending=null;},removeAttribute(k){delete this[k];},arrive(){if(this.pending){this.audibleStarts++;this.pending();this.pending=null;}}};
  const cold=createVictoryMusic({...options,createAudio:()=>waiting});cold.prepare();cold.result({key:'cold',won:true});cold.setGate({soundEnabled:false});waiting.arrive();assert.equal(waiting.audibleStarts,0);
  cold.setGate({soundEnabled:true});assert.equal(cold.result({key:'cold',won:true}),false);assert.equal(waiting.plays,1);cold.dispose();
  assert.equal(timers.size,0);
  console.log('PASS: cold pending play is cancelled by mute; finishing its simulated load never starts old audio');
  const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
  const sync=source.match(/function syncVictoryMusic\(\)\{[^\n]+\}/)?.[0];assert.ok(sync);
  const calls=[];const context=vm.createContext({victoryMusicEnabled:true,victoryMusicVolume:.6,soundEnabled:true,volume:.45,document:{hidden:false},victoryMusic:{setGate:next=>calls.push(['gate',next]),prepare:()=>calls.push(['prepare'])}});
  vm.runInContext(sync+';syncVictoryMusic();',context);assert.deepEqual(calls.map(c=>c[0]),['gate','prepare']);
  assert.match(source,/function audioInit\(\)\{gameAudio\.init\(\);victoryMusic\.prepare\(\);\}/,'Start/resume gestures also prepare/retry without playing');
  assert.ok(source.indexOf('\nsyncVictoryMusic();')>0&&source.indexOf('\nsyncVictoryMusic();')<source.indexOf('function showRoundResult('),'Menu prepares immediately at initialization');
  console.log('PASS: actual menu settings gate prepares before any round result; start/resume gestures retry preparation');
  // A preparation-only failure must not start or queue playback later.
  const pre=createVictoryMusic(options);pre.prepare();const broken=media.at(-1);broken.onerror();assert.equal(broken.plays,0);pre.setGate({soundEnabled:false});assert.equal(pre.prepare(),false);pre.dispose();
  for(const createAudio of [()=>{throw Error('unavailable');},()=>({load(){throw Error('unavailable');},removeAttribute(){}})]){
    const unavailable=createVictoryMusic({...options,createAudio});assert.equal(unavailable.prepare(),false);assert.equal(unavailable.result({key:'unavailable',won:true}),false);unavailable.dispose();
  }
  assert.equal(timers.size,0);
  console.log('PASS: failed preload and mute never schedule a delayed or preview play');
  console.log('PASS: 8 victory music preparation groups; all media are mocks, no audio playback');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
