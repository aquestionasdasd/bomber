const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
async function main(){
 const {createVictoryMusic,bindVictoryMusicSettings}=await import(pathToFileURL(path.join(__dirname,'public/victory-music.js')).href);
 const {VICTORY_TRACKS}=await import(pathToFileURL(path.join(__dirname,'public/victory-music-config.js')).href);
 let groups=0;const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name)};
 const media=[],timers=new Map();let serial=0;
 const options={createAudio(){const a={plays:0,pauses:0,loads:0,currentTime:0,paused:true,ended:false,seeking:false,readyState:4,load(){this.loads++},play(){this.plays++;this.paused=false;return Promise.resolve()},pause(){this.pauses++;this.paused=true},removeAttribute(k){delete this[k]}};media.push(a);return a},schedule(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id},cancel:id=>timers.delete(id)};
 const music=createVictoryMusic({...options,trackId:'break-the-dancefloor'});
 test('saved selection and invalid legacy preference use only bundled tracks without preview',()=>{
  assert.deepEqual(VICTORY_TRACKS.map(t=>[t.id,t.title]),[['bd3do','BD3DO 勝利BGM'],['sandstorm','sandstorm'],['break-the-dancefloor','Break the dancefloor!!']]);
  assert.equal(music.trackId(),'break-the-dancefloor');assert.equal(music.state().title,'Break the dancefloor!!');assert.equal(media.length,0);
  const legacy=createVictoryMusic({...options,trackId:'https://invalid.test/arbitrary.wav'});assert.equal(legacy.trackId(),'bd3do');assert.equal(legacy.selectTrack('not-a-track'),false);assert.equal(media.length,0);legacy.dispose();
 });
 test('new supplied song is prepared silently and plays only for a fresh own victory',()=>{
  music.prepare();const a=media.at(-1);assert.match(a.src,/victory-break-the-dancefloor\.wav$/);assert.equal(a.plays,0);assert.equal(a.preload,'auto');music.result({key:'loss',won:false});assert.equal(a.plays,0);
  assert.equal(music.result({key:'win',won:true}),true);assert.equal(a.plays,1);assert.equal(timers.values().next().value.ms,15000);assert.equal(music.result({key:'win',won:true}),false);assert.equal(music.playback().playing,true);
 });
 const old=media.at(-1),oldTimer=timers.values().next().value.fn,oldError=old.onerror;
 test('switching stops and releases old song but does not replay current win or preview selection',()=>{
  assert.equal(music.selectTrack('sandstorm'),true);assert.equal(old.paused,true);assert.equal(old.src,undefined);assert.equal(timers.size,0);assert.equal(music.playback().playing,false);
  music.prepare();const next=media.at(-1);assert.notEqual(next,old);assert.equal(next.plays,0);assert.equal(music.result({key:'win',won:true}),false);assert.equal(next.plays,0);music.result({key:'next',won:true});assert.equal(next.plays,1);oldTimer();oldError();assert.equal(next.paused,false);assert.equal(music.state().error,'');music.dispose();
 });
 test('selection while muted remains silent and load errors do not revive consumed results',()=>{
  const muted=createVictoryMusic(options);muted.setGate({soundEnabled:false});const count=media.length;muted.selectTrack('break-the-dancefloor');assert.equal(muted.prepare(),false);assert.equal(media.length,count);assert.equal(muted.result({key:'muted',won:true}),false);
  muted.setGate({soundEnabled:true});muted.prepare();let a=media.at(-1);assert.equal(a.plays,0);assert.equal(muted.result({key:'muted',won:true}),false);a.onerror();assert.match(muted.state().error,/再生できません/);muted.prepare();a=media.at(-1);assert.equal(a.plays,0);assert.equal(muted.result({key:'retry',won:true}),true);muted.setGate({hidden:true});assert.equal(a.paused,true);muted.dispose();
 });
 let rejectOld;const race=createVictoryMusic({...options,createAudio(){const a=options.createAudio();if(media.length===raceIndex+1)a.play=function(){this.plays++;this.paused=false;return new Promise((_,reject)=>rejectOld=reject)};return a}}),raceIndex=media.length;
 race.result({key:'old',won:true});const staleTimer=timers.values().next().value.fn;race.selectTrack('break-the-dancefloor');race.result({key:'new',won:true});const current=media.at(-1),pauses=current.pauses;rejectOld(Error('old play denied'));await Promise.resolve();
 test('old rejected play and timer cannot stop a newly selected victory song',()=>{staleTimer();assert.equal(current.pauses,pauses);assert.equal(race.state().error,'');assert.equal(race.playback().playing,true);race.dispose();assert.equal(timers.size,0)});
 test('title and pause selector synchronize native radios and callback without any audition',()=>{
  const elements=new Map(),changes=[];for(const name of ['enabled','volume','value','status','title','settings','open','pause-open','close'])elements.set('victory-music-'+name,{listeners:{},attributes:{},open:false,addEventListener(t,f){this.listeners[t]=f},setAttribute(k,v){this.attributes[k]=v},showModal(){this.open=true},close(){this.open=false;this.listeners.close?.()}});
  const tracks=VICTORY_TRACKS.map(t=>({value:t.id,checked:false,listeners:{},addEventListener(k,f){this.listeners[k]=f}}));const m=createVictoryMusic({...options,trackId:'break-the-dancefloor'}),count=media.length;
  const ui=bindVictoryMusicSettings({document:{getElementById:id=>elements.get(id),querySelectorAll:()=>tracks},music:m,preferences:{enabled:true,volume:.6},onChange:change=>changes.push(change)});
  assert.equal(tracks[2].checked,true);assert.equal(tracks[0].checked,false);assert.equal(tracks[1].checked,false);assert.equal(elements.get('victory-music-title').textContent,'Break the dancefloor!!');
  elements.get('victory-music-open').listeners.click();tracks[1].checked=true;tracks[1].listeners.change();assert.deepEqual(changes,[{trackId:'sandstorm'}]);assert.equal(tracks[2].checked,false);assert.equal(elements.get('victory-music-title').textContent,'sandstorm');ui.close();elements.get('victory-music-pause-open').listeners.click();assert.equal(ui.isOpen(),true);assert.equal(tracks[1].checked,true);assert.equal(media.length,count);ui.close();m.dispose();
 });
 test('actual game initializes from persisted track ID and saves it without media/file data',()=>{
  const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');const init=source.match(/const victoryMusic=createVictoryMusic\([^\n]+/)[0];const sandbox={settings:{victoryMusicTrack:'break-the-dancefloor',victoryMusicTrackVersion:2},createVictoryMusic:args=>createVictoryMusic({...args,...options}),victoryMusicUI:null};vm.createContext(sandbox);vm.runInContext(init,sandbox);assert.equal(vm.runInContext('victoryMusic.state().title',sandbox),'Break the dancefloor!!');assert.equal(vm.runInContext('victoryMusic.trackId()',sandbox),'break-the-dancefloor');vm.runInContext('victoryMusic.dispose()',sandbox);
  assert.match(source,/victoryMusicTrack:victoryMusic\.trackId\(\)/);const html=fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8');assert.equal([...html.matchAll(/name="victory-track"/g)].length,3);assert.match(html,/value="break-the-dancefloor"/);assert.match(html,/Break the dancefloor!!/);assert.doesNotMatch(html,/type="file"|victory-music-file/);
 });
 test('owner supplied new WAV is byte exact PCM24 stereo with its complete 14.403s within existing15s cap',()=>{
  const b=fs.readFileSync(path.join(__dirname,'public/audio/victory-break-the-dancefloor.wav'));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'f22110b562f125df2884cebeabade3d03d4ddaed961cfa1fe83d4b3288be386e');assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');let fmt,size;for(let o=12;o+8<=b.length;){const n=b.readUInt32LE(o+4),tag=b.toString('ascii',o,o+4);if(tag==='fmt ')fmt=[b.readUInt16LE(o+8),b.readUInt16LE(o+10),b.readUInt32LE(o+12),b.readUInt16LE(o+22)];if(tag==='data')size=n;o+=8+n+n%2}assert.deepEqual(fmt,[1,2,44100,24]);assert.equal(size,3811068);assert.ok(size/(44100*6)<15);
 });
 console.log(`PASS: ${groups} three-track victory music groups; all audio transports mocked, no playback`);
}
main().catch(error=>{console.error(error);process.exitCode=1});
