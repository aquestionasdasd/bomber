const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
async function main(){
  const {createVictoryMusic,bindVictoryMusicSettings}=await import(pathToFileURL(path.join(__dirname,'public/victory-music.js')).href);
  const media=[],timers=new Map(),revoked=[];let sequence=0;
  function fakeAudio(){const a={plays:0,pauses:0,loads:0,play(){this.plays++;return Promise.resolve();},pause(){this.pauses++;},load(){this.loads++;},removeAttribute(name){delete this[name];}};media.push(a);return a;}
  const options={createAudio:fakeAudio,schedule:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms});return id;},cancel:id=>timers.delete(id),urls:{createObjectURL:()=>`blob:test-${++sequence}`,revokeObjectURL:src=>revoked.push(src)}};
  const empty=createVictoryMusic(options);assert.equal(empty.result({key:'1:blue',won:true}),false);assert.equal(media.length,0,'No source creates no media and no fetch');
  empty.selectFile({size:100,type:'audio/mpeg',name:'後から渡す.mp3'});assert.equal(media.length,0,'Selection never auditions or decodes');assert.equal(empty.state().local,true);empty.clearFile();assert.equal(revoked.length,1);assert.equal(empty.state().configured,false);empty.dispose();
  console.log('PASS: unconfigured silence, file selection without playback, clear/revoke');
  const m=createVictoryMusic({...options,config:{src:'/audio/future.mp3',title:'future',maxSeconds:15}});
  m.setGate({masterVolume:.5,musicVolume:.6});assert.ok(m.result({key:'1:blue',won:true}));const first=media.at(-1);assert.equal(first.src,'/audio/future.mp3');assert.equal(first.volume,.3);assert.equal(first.loop,false);assert.equal(timers.values().next().value.ms,15000);
  assert.equal(m.result({key:'1:blue',won:true}),false);assert.equal(first.plays,1,'Duplicate host snapshots never restart the track');
  m.setGate({musicVolume:.2});assert.equal(first.volume,.1);assert.equal(m.result({key:'2:red',won:false}),false);assert.equal(first.pauses,1);assert.equal(timers.size,0,'Loss stops an older track');
  assert.equal(m.result({key:'3:blue',won:true,audible:false}),false);assert.equal(m.result({key:'3:blue',won:true}),false,'Fresh rejoin consumes result silently');
  console.log('PASS: own win only, nonlooping bounded duration, master multiplication, duplicate/fresh suppression');
  for(const gate of [{soundEnabled:false},{enabled:false},{masterVolume:0},{musicVolume:0},{hidden:true}]){
    m.reset();m.setGate({soundEnabled:true,enabled:true,masterVolume:.5,musicVolume:.6,hidden:false});m.result({key:'4:blue',won:true});const active=media.at(-1);m.setGate(gate);assert.equal(active.pauses,1);assert.equal(m.result({key:'5:blue',won:true}),false);m.setGate({soundEnabled:true,enabled:true,masterVolume:.5,musicVolume:.6,hidden:false});assert.equal(m.result({key:'5:blue',won:true}),false,'Unmuting never replays an old result');
  }
  m.reset();m.result({key:'6:blue',won:true});const last=media.at(-1);[...timers.values()][0].fn();assert.equal(last.pauses,1);assert.equal(timers.size,0);
  m.reset();m.result({key:'7:blue',won:true});const failing=media.at(-1);failing.onerror();assert.match(m.state().error,/再生できません/);assert.equal(failing.pauses,1);assert.equal(m.result({key:'7:blue',won:true}),false);
  console.log('PASS: global/BGM mute, zero volumes, hidden tab, immediate stop, timer and decode error cleanup');
  const bad=createVictoryMusic({...options,config:{src:'bad',maxSeconds:99},createAudio:()=>({play(){return Promise.reject(Error('blocked'));},pause(){},load(){},removeAttribute(){}})});bad.result({key:'a',won:true});await Promise.resolve();assert.match(bad.state().error,/再生できません/);assert.equal(timers.size,0);bad.dispose();
  m.selectFile({size:100,type:'audio/ogg',name:'one.ogg'});const old=m.state();assert.equal(m.selectFile({size:100,type:'text/html',name:'bad.html'}),false);assert.equal(m.state().title,old.title);assert.equal(m.selectFile({size:41*1024*1024,type:'audio/ogg',name:'big.ogg'}),false);m.selectFile({size:100,type:'',name:'two.WAV'});m.dispose();m.dispose();assert.equal(m.result({key:'dead',won:true}),false);assert.equal(timers.size,0);
  console.log('PASS: rejected play promise, invalid/oversized selection preserves track, replacement/disposal');
  // Real game result function: both team perspectives and the existing audio gate.
  const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
  const start=source.indexOf('function showRoundResult('),end=source.indexOf('\nfunction handleMatchEvents',start);
  const resultMusic=createVictoryMusic({...options,config:{src:'fixture',maxSeconds:15}});
  const context=vm.createContext({match:{round:1,phase:'post',winner:null},player:{team:'red'},mode:'play',netHostPaused:false,lastRoundAudio:'',victoryMusic:resultMusic,syncVictoryMusic(){},sound(){},$:()=>null});vm.runInContext(source.slice(start,end),context);
  const before=media.length;vm.runInContext("showRoundResult('red','elimination');showRoundResult('red','elimination')",context);assert.equal(media.length,before+1);context.match.round++;vm.runInContext("showRoundResult('blue','elimination')",context);assert.equal(media.length,before+1);context.match.round++;context.netHostPaused=true;vm.runInContext("showRoundResult('red','elimination')",context);assert.equal(media.length,before+1);context.netHostPaused=false;context.match.round++;vm.runInContext("showRoundResult('red','elimination',{audible:false});showRoundResult('red','elimination')",context);assert.equal(media.length,before+1);resultMusic.dispose();
  for(const fn of ['spawnRound','startGame','pauseGame','backMenu','suspendSession']){const begin=source.indexOf(`function ${fn}(`);assert.match(source.slice(begin,begin+150),/victoryMusic\.(?:stop|reset)\(/,`${fn} cleans up`);}
  assert.match(source,/if\(fresh\)\{victoryMusic\.reset\(\)/);assert.match(source,/if\(fresh\|\|netHostPaused\|\|match.phase!=='post'\)victoryMusic.stop\(\)/);
  console.log('PASS: actual game win/loss/red guest/duplicate/rejoin/host pause and lifecycle wiring');
  const elements=new Map(),changes=[];for(const id of ['enabled','volume','value','file','clear','status'])elements.set(`victory-music-${id}`,{listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}});
  const uiMusic=createVictoryMusic(options),ui=bindVictoryMusicSettings({document:{getElementById:id=>elements.get(id)},music:uiMusic,preferences:{enabled:false,volume:.35},onChange:change=>changes.push(change)});
  const el=id=>elements.get(`victory-music-${id}`);assert.equal(el('enabled').checked,false);assert.equal(el('value').textContent,'35%');assert.equal(el('clear').disabled,true);assert.match(el('status').textContent,/未設定/);el('enabled').checked=true;el('enabled').listeners.change();el('volume').value='.25';el('volume').listeners.input();assert.deepEqual(changes,[{enabled:true},{volume:.25}]);el('file').files=[{size:100,type:'audio/mpeg',name:'曲.mp3'}];el('file').listeners.change();assert.match(el('status').textContent,/曲.mp3/);assert.equal(el('clear').disabled,false);el('clear').listeners.click();assert.match(el('status').textContent,/未設定/);ui.render();uiMusic.dispose();
  console.log('PASS: actual settings bindings/defaults/percentage/selection/status/clear; all media mocked, no sound');
  let saved;
  const saveStart=source.indexOf('function saveSettings()'),saveEnd=source.indexOf('\nfor(const id of',saveStart);
  const settingsContext=vm.createContext({sensitivity:.35,volume:.45,victoryMusicEnabled:false,victoryMusicVolume:.25,selectedCharacter:()=> 'nope',localStorage:{setItem(key,value){assert.equal(key,'hashimoto-settings');saved=JSON.parse(value);}}});
  vm.runInContext(source.slice(saveStart,saveEnd)+'\nsaveSettings();',settingsContext);
  assert.deepEqual(saved,{sensitivity:.35,volume:.45,victoryMusicEnabled:false,victoryMusicVolume:.25,lookVersion:2,character:'nope'});
  assert.doesNotMatch(JSON.stringify(saved),/blob:|\.mp3|\.ogg/,'Only preferences persist, never selected file data or local URLs');
  console.log('PASS: actual settings serialization retains sensitivity/character and stores only BGM preferences');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
