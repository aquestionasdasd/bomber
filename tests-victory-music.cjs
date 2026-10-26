const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
async function main(){
  const {createVictoryMusic,bindVictoryMusicSettings}=await import(pathToFileURL(path.join(__dirname,'public/victory-music.js')).href);
  const media=[],timers=new Map();let sequence=0;
  function fakeAudio(){const a={plays:0,pauses:0,loads:0,play(){this.plays++;return Promise.resolve();},pause(){this.pauses++;},load(){this.loads++;},removeAttribute(name){delete this[name];}};media.push(a);return a;}
  const options={createAudio:fakeAudio,schedule:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms});return id;},cancel:id=>timers.delete(id)};
  const bundled=createVictoryMusic(options);
  assert.deepEqual(bundled.state(),{configured:true,title:'sandstorm',error:''});
  assert.equal(media.length,0,'Constructing the bundled track neither creates nor plays Audio');
  assert.equal(bundled.selectFile,undefined);assert.equal(bundled.clearFile,undefined);
  bundled.setGate({soundEnabled:false});assert.equal(bundled.result({key:'muted',won:true}),false);assert.equal(media.length,0);
  bundled.setGate({soundEnabled:true});assert.equal(bundled.result({key:'muted',won:true}),false);
  assert.ok(bundled.result({key:'bundled',won:true}));assert.match(media.at(-1).src,/\/audio\/victory-sandstorm\.wav$/);bundled.dispose();
  const empty=createVictoryMusic({...options,config:{src:'',title:''}});assert.equal(empty.result({key:'1:blue',won:true}),false);empty.dispose();
  console.log('PASS: default bundled sandstorm, lazy creation, mute consumes result, upload API removed, missing-source silence');
  const m=createVictoryMusic({...options,config:{src:'/audio/future.mp3',title:'future',maxSeconds:15}});
  m.setGate({masterVolume:.5,musicVolume:.6});assert.ok(m.result({key:'1:blue',won:true}));const first=media.at(-1);assert.equal(first.src,'/audio/future.mp3');assert.equal(first.volume,.3);assert.equal(first.loop,false);assert.equal(timers.values().next().value.ms,15000);
  assert.equal(m.result({key:'1:blue',won:true}),false);assert.equal(first.plays,1,'Duplicate host snapshots never restart the track');
  m.setGate({musicVolume:.2});assert.equal(first.volume,.1);assert.equal(m.result({key:'2:red',won:false}),false);assert.equal(first.pauses,1);assert.equal(timers.size,0,'Loss stops an older track');
  assert.equal(m.result({key:'3:blue',won:true,audible:false}),false);assert.equal(m.result({key:'3:blue',won:true}),false,'Fresh rejoin consumes result silently');
  console.log('PASS: own win only, nonlooping bounded duration, master multiplication, duplicate/fresh suppression');
  for(const gate of [{soundEnabled:false},{enabled:false},{masterVolume:0},{musicVolume:0},{hidden:true}]){
    m.reset();m.setGate({soundEnabled:true,enabled:true,masterVolume:.5,musicVolume:.6,hidden:false});m.result({key:'4:blue',won:true});const active=media.at(-1),beforePause=active.pauses;m.setGate(gate);assert.equal(active.pauses,beforePause+1);assert.equal(m.result({key:'5:blue',won:true}),false);m.setGate({soundEnabled:true,enabled:true,masterVolume:.5,musicVolume:.6,hidden:false});assert.equal(m.result({key:'5:blue',won:true}),false,'Unmuting never replays an old result');
  }
  m.reset();m.result({key:'6:blue',won:true});const last=media.at(-1),beforeTimerPause=last.pauses;[...timers.values()][0].fn();assert.equal(last.pauses,beforeTimerPause+1);assert.equal(timers.size,0);
  m.reset();m.result({key:'7:blue',won:true});const failing=media.at(-1),beforeFailPause=failing.pauses;failing.onerror();assert.match(m.state().error,/再生できませんでした/);assert.equal(failing.pauses,beforeFailPause+1);assert.equal(m.result({key:'7:blue',won:true}),false);
  console.log('PASS: global/BGM mute, zero volumes, hidden tab, immediate stop, timer and decode error cleanup');
  const bad=createVictoryMusic({...options,config:{src:'bad',maxSeconds:99},createAudio:()=>({play(){return Promise.reject(Error('blocked'));},pause(){},load(){},removeAttribute(){}})});bad.result({key:'a',won:true});await Promise.resolve();assert.match(bad.state().error,/再生できませんでした/);assert.equal(timers.size,0);bad.dispose();
  m.dispose();m.dispose();assert.equal(m.result({key:'dead',won:true}),false);assert.equal(timers.size,0);
  console.log('PASS: rejected play promise and idempotent disposal without file/blob resources');
  // Real game result function: both team perspectives and the existing audio gate.
  const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
  const start=source.indexOf('function showRoundResult('),end=source.indexOf('\nfunction handleMatchEvents',start);
  const resultMusic=createVictoryMusic({...options,config:{src:'fixture',maxSeconds:15}});
  const context=vm.createContext({match:{round:1,phase:'post',winner:null},player:{team:'red'},mode:'play',netHostPaused:false,lastRoundAudio:'',victoryMusic:resultMusic,syncVictoryMusic(){},sound(){},$:()=>null});vm.runInContext(source.slice(start,end),context);
  const before=media.length;vm.runInContext("showRoundResult('red','elimination');showRoundResult('red','elimination')",context);assert.equal(media.length,before+1);context.match.round++;vm.runInContext("showRoundResult('blue','elimination')",context);assert.equal(media.length,before+1);context.match.round++;context.netHostPaused=true;vm.runInContext("showRoundResult('red','elimination')",context);assert.equal(media.length,before+1);context.netHostPaused=false;context.match.round++;vm.runInContext("showRoundResult('red','elimination',{audible:false});showRoundResult('red','elimination')",context);assert.equal(media.length,before+1);resultMusic.dispose();
  for(const fn of ['spawnRound','startGame','pauseGame','backMenu','suspendSession']){const begin=source.indexOf(`function ${fn}(`),end=source.indexOf('\nfunction ',begin+1);assert.match(source.slice(begin,end),/victoryMusic\.(?:stop|reset)\(/,`${fn} cleans up`);}
  assert.match(source,/if\(fresh\)\{victoryMusic\.reset\(\)/);assert.match(source,/if\(fresh\|\|netHostPaused\|\|match.phase!=='post'\)victoryMusic.stop\(\)/);
  console.log('PASS: actual game win/loss/red guest/duplicate/rejoin/host pause and lifecycle wiring');
  const elements=new Map(),changes=[];
  for(const id of ['enabled','volume','value','status','title','settings','open','pause-open','close'])elements.set(`victory-music-${id}`,{listeners:{},attributes:{},open:false,addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(k,v){this.attributes[k]=v;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();}});
  const beforeUI=media.length;
  const uiMusic=createVictoryMusic(options),ui=bindVictoryMusicSettings({document:{getElementById:id=>elements.get(id)},music:uiMusic,preferences:{enabled:false,volume:.35},onChange:change=>changes.push(change)});
  const el=id=>elements.get(`victory-music-${id}`);
  assert.equal(el('enabled').checked,false);assert.equal(el('value').textContent,'35%');assert.equal(el('title').textContent,'sandstorm');assert.match(el('status').textContent,/ラウンドに勝利/);
  el('open').listeners.click();assert.equal(ui.isOpen(),true);assert.equal(el('open').attributes['aria-expanded'],'true');
  el('enabled').checked=true;el('enabled').listeners.change();el('volume').value='.25';el('volume').listeners.input();assert.deepEqual(changes,[{enabled:true},{volume:.25}]);
  let stopped=false;el('settings').listeners.keydown({code:'Escape',stopPropagation(){stopped=true;}});assert.equal(stopped,true,'Native Escape never resumes paused game');
  el('close').listeners.click();assert.equal(ui.isOpen(),false);assert.equal(el('open').attributes['aria-expanded'],'false');
  el('pause-open').listeners.click();assert.equal(ui.isOpen(),true);el('settings').listeners.click({target:el('settings')});assert.equal(ui.isOpen(),false);
  el('open').listeners.click();ui.close();ui.render();uiMusic.dispose();assert.equal(media.length,beforeUI,'Opening, selecting preferences and closing never auditions BGM');
  console.log('PASS: title/pause modal bindings, settings/defaults, Escape isolation, backdrop/close/reset and zero preview playback');
  const html=fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8'),moduleSource=fs.readFileSync(path.join(__dirname,'public/victory-music.js'),'utf8');
  assert.doesNotMatch(html,/victory-music-file|victory-music-clear|type="file"/);assert.doesNotMatch(moduleSource,/selectFile|clearFile|createObjectURL|revokeObjectURL/);
  assert.match(html,/<dialog id="victory-music-settings"[^>]+aria-labelledby="victory-music-heading"/);
  assert.equal([...html.matchAll(/name="victory-track"/g)].length,2,'Two selectable bundled tracks');
  assert.ok(html.indexOf('id="victory-music-open"')<html.indexOf('</main>'),'Settings reachable before starting the game');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Unique document IDs');
  const bytes=fs.readFileSync(path.join(__dirname,'public/audio/victory-sandstorm.wav'));
  assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),'2d48acced586a676700caba4935059923828ffa2d2c1801e36208f0747f66aaf');
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
  let format,dataBytes;for(let offset=12;offset+8<=bytes.length;){const size=bytes.readUInt32LE(offset+4),tag=bytes.toString('ascii',offset,offset+4);if(tag==='fmt ')format=[bytes.readUInt16LE(offset+8),bytes.readUInt16LE(offset+10),bytes.readUInt32LE(offset+12),bytes.readUInt16LE(offset+22)];if(tag==='data')dataBytes=size;offset+=8+size+size%2;}
  assert.deepEqual(format,[1,2,44100,24]);assert.equal(dataBytes,1872048);
  console.log('PASS: native labelled dialog, two tracks, no upload UI/API, supplied WAV bytes/PCM24 stereo format exact');
  let saved;
  const saveStart=source.indexOf('function saveSettings()'),saveEnd=source.indexOf('\nfor(const id of',saveStart);
  const settingsContext=vm.createContext({map:{id:"hashimoto"},sensitivity:.35,volume:.45,victoryMusicEnabled:false,victoryMusicVolume:.25,victoryMusic:{trackId:()=> 'break-the-dancefloor'},selectedCharacter:()=> 'nope',localStorage:{setItem(key,value){assert.equal(key,'hashimoto-settings');saved=JSON.parse(value);}}});
  vm.runInContext(source.slice(saveStart,saveEnd)+'\nsaveSettings();',settingsContext);
  assert.deepEqual(saved,{mapId:"hashimoto",sensitivity:.35,volume:.45,victoryMusicEnabled:false,victoryMusicVolume:.25,victoryMusicTrack:'break-the-dancefloor',lookVersion:2,character:'nope'});
  assert.doesNotMatch(JSON.stringify(saved),/blob:|\.mp3|\.ogg/,'Only preferences persist, never selected file data or local URLs');
  console.log('PASS: actual settings serialization retains sensitivity/character and stores only BGM preferences');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
