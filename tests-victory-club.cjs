const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function main(){
 const {createVictoryClub}=await import('./public/victory-club.js'),{createVictoryMusic}=await import('./public/victory-music.js');
 const values=new Map(),element={hidden:false,dataset:{},style:{setProperty:(key,value)=>values.set(key,value)}},club=createVictoryClub({element});let groups=0;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name)};
 test('only eligible actual playback lights up; no audio or layout work in presentation',()=>{
  assert.equal(element.hidden,true);for(const options of [{eligible:true},{playing:true},{eligible:true,playing:true,time:NaN},{eligible:true,playing:true,time:-1}])assert.equal(club.render(options),false);
  assert.equal(club.render({eligible:true,playing:true,time:1}),true);assert.equal(element.hidden,false);assert.equal(club.active,true);assert.equal(values.size,4);
  const source=fs.readFileSync(path.join(__dirname,'public/victory-club.js'),'utf8');assert.doesNotMatch(source,/new Audio|AudioContext|requestAnimationFrame|setInterval|setTimeout|getBoundingClientRect|offsetWidth|createElement/);
 });
 test('media time drives smooth colored pulse and sweeps consistently at20/60/144Hz',()=>{
  let final;
  for(const hz of[20,60,144]){let last=null;for(let i=0;i<=hz;i++){club.render({eligible:true,playing:true,time:i/hz});const v=Number(values.get('--club-pulse'));assert.ok(v>=0&&v<=1);if(last!==null)assert.ok(Math.abs(v-last)<=Math.PI*(160/60)/hz+.001);last=v;}const snapshot=[...values];if(final)assert.deepEqual(snapshot,final);final=snapshot;}
  const atOne=[...values];club.render({eligible:true,playing:true,time:1});assert.deepEqual([...values],atOne,'duplicate frames do not restart the effect');club.render({eligible:true,playing:true,time:5});assert.notDeepEqual([...values],atOne);
 });
 test('reduced motion is a constant tint without moving beams or flashes',()=>{
  club.render({eligible:true,playing:true,time:1,reducedMotion:true});const still=[...values];club.render({eligible:true,playing:true,time:10,reducedMotion:true});assert.deepEqual([...values],still);assert.equal(element.dataset.reduced,'true');
  const css=fs.readFileSync(path.join(__dirname,'public/victory-club.css'),'utf8');assert.match(css,/pointer-events:none/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/data-reduced="true"[^}]+display:none/);assert.doesNotMatch(css,/@keyframes|backdrop-filter|#fff(?:fff)?\b/);
 });
 test('stop, ineligible, invalid clock and disposal hide the overlay without timers',()=>{
  for(const options of[{eligible:false,playing:true},{eligible:true,playing:false},{eligible:true,playing:true,time:Infinity}]){club.render({eligible:true,playing:true});assert.equal(club.render(options),false);assert.equal(element.hidden,true);assert.equal(club.active,false)}
  club.render({eligible:true,playing:true});club.dispose();club.dispose();assert.equal(club.render({eligible:true,playing:true}),false);assert.equal(element.hidden,true);assert.equal(createVictoryClub().render({eligible:true,playing:true}),false);
 });
 test('real music controller reports waiting, playing, buffering, seeking, ended and stopped transport',()=>{
  const media={paused:true,ended:false,seeking:false,readyState:0,currentTime:0,load(){},play(){this.paused=false;return Promise.resolve()},pause(){this.paused=true},removeAttribute(){}};
  const music=createVictoryMusic({createAudio:()=>media,schedule:()=>1,cancel(){}});assert.deepEqual(music.playback(),{playing:false,time:0});music.prepare();assert.equal(music.playback().playing,false);music.result({key:'one',won:true});assert.equal(music.playback().playing,false);
  media.readyState=4;media.currentTime=1.25;assert.deepEqual(music.playback(),{playing:true,time:1.25});for(const key of['paused','ended','seeking']){media[key]=true;assert.equal(music.playback().playing,false);media[key]=false}media.readyState=2;assert.equal(music.playback().playing,false);media.readyState=4;
  music.setGate({soundEnabled:false});assert.deepEqual(music.playback(),{playing:false,time:0});music.dispose();assert.equal(music.playback().playing,false);
 });
 test('markup stays decorative, fixed6beams and below result UI; original BGM configuration retained',()=>{
  const html=fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8');assert.match(html,/id="victory-club"[^>]*aria-hidden="true"[^>]*hidden/);assert.equal((html.match(/class="club-beam"/g)||[]).length,6);
  const config=fs.readFileSync(path.join(__dirname,'public/victory-music-config.js'),'utf8');assert.match(config,/victory-sandstorm\.wav/);assert.doesNotMatch(html,/id="victory-dance(?:-canvas|-preview)?"/);
 });
 console.log(`PASS: ${groups} victory club presentation and actual music transport groups; audio mocked`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
