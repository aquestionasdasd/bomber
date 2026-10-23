const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');

class Param {
  constructor(){this.value=0;this.events=[];this.timeline=[];}
  setValueAtTime(value,time){this.value=value;this.events.push(value);this.timeline.push(['set',value,time]);}
  exponentialRampToValueAtTime(value,time){this.value=value;this.events.push(value);this.timeline.push(['exponential',value,time]);}
}
class Node {
  constructor(context,type){this.type=type;this.kind=type;this.connections=[];this.disconnects=0;context.nodes.push(this);}
  connect(target){this.connections.push(target);return target;}
  disconnect(){this.disconnects++;this.connections=[];}
}
class Source extends Node {
  constructor(context,type){super(context,type);context.sources.push(this);this.frequency=new Param();this.playbackRate=new Param();}
  start(time,offset,duration){this.started=time;this.offset=offset;this.duration=duration;}
  stop(time){this.stopped=time;}
  end(){const callback=this.onended;this.onended=null;callback?.();}
}
class Context {
  constructor(){this.sampleRate=48000;this.currentTime=4;this.state='running';this.nodes=[];this.sources=[];this.buffers=[];this.destination={};Context.current=this;}
  createGain(){const node=new Node(this,'gain');node.gain=new Param();return node;}
  createStereoPanner(){const node=new Node(this,'panner');node.pan=new Param();return node;}
  createBufferSource(){return new Source(this,'buffer');}
  createOscillator(){return new Source(this,'oscillator');}
  createBiquadFilter(){const node=new Node(this,'filter');node.frequency=new Param();node.Q=new Param();return node;}
  createBuffer(channels,length,rate){const data=new Float32Array(length),buffer={duration:length/rate,length,sampleRate:rate,numberOfChannels:channels,getChannelData:()=>data};this.buffers.push(buffer);return buffer;}
  resume(){this.state='running';}
}
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const newTypes=['buy','skill-throw','bottle-pop','flash','decoy','takeover','seed-bloom','pollen','flower-heal','heal','recon','veil','ember-warning','round-win','round-loss','match-win','match-loss'];
function decodedSample(file){
  const seed=Number.parseInt(sha(file).slice(0,6),16),length=96000;
  const channels=[Float32Array.from({length},(_,i)=>Math.sin((i+seed)*.013)*1.6),Float32Array.from({length},(_,i)=>Math.cos((i+seed)*.017)*.8)];
  return {duration:2,length,sampleRate:48000,numberOfChannels:2,getChannelData:channel=>channels[channel]};
}
function bufferHash(buffer){const data=buffer.getChannelData(0);return sha(Buffer.from(data.buffer,data.byteOffset,data.byteLength));}
function voiceTrace(context,nodeStart,sourceStart){
  const nodes=context.nodes.slice(nodeStart),sources=context.sources.slice(sourceStart),param=value=>value&&({value:value.value,timeline:value.timeline});
  return {nodes:nodes.map(node=>({kind:node.kind,type:node.type,connections:node.connections.map(target=>target===context.destination?'destination':nodes.indexOf(target)),
    gain:param(node.gain),pan:param(node.pan),frequency:param(node.frequency),Q:param(node.Q),playbackRate:param(node.playbackRate)})),
    sources:sources.map(source=>({kind:source.kind,type:source.type,started:source.started,offset:source.offset,duration:source.duration,stopped:source.stopped,
      buffer:source.buffer&&{duration:source.buffer.duration,channels:source.buffer.numberOfChannels,sampleRate:source.buffer.sampleRate,hash:bufferHash(source.buffer)}}))};
}
async function protectedTrace(createGameAudio,mode,interleave=false){
  class TraceContext extends Context{decodeAudioData(bytes){return mode==='failed'?Promise.reject(Error('Unsupported codec')):Promise.resolve(decodedSample(Buffer.from(bytes).toString()));}}
  global.window={AudioContext:mode==='cold'?Context:TraceContext,fetch:async url=>({ok:true,arrayBuffer:async()=>Uint8Array.from(Buffer.from(path.basename(new URL(url).pathname))).buffer})};
  const audio=createGameAudio();audio.init();await settle();const context=Context.current,traces=[];
  const end=()=>{for(const source of context.sources)source.end();};
  const play=(type,options)=>{const nodeStart=context.nodes.length,sourceStart=context.sources.length;audio.play(type,options);traces.push({type,options,trace:voiceTrace(context,nodeStart,sourceStart)});end();};
  const options=[{volume:.61,pan:-.7,distance:11,occluded:false},{volume:.61,pan:.7,distance:11,occluded:true},{volume:.45,pan:0,distance:0,occluded:false}];
  for(const type of ['shot','enemy'])for(const weapon of ['classic','ghost','spectre','phantom','vandal','knife'])for(const option of options)play(type,{...option,weapon});
  for(let i=0;i<newTypes.length;i++){
    // Check each cue independently: an even total number of newly shared
    // recordings could otherwise hide a changed two-footstep variation phase.
    if(interleave){audio.play(typeof interleave==='string'?interleave:newTypes[i]);end();}
    play('step',options[i%3]);play('land',options[(i+1)%3]);
    // These original imported effects intentionally keep the original variation counter.
    for(const type of ['smoke','updraft','dash','frost']){audio.play(type);end();}
  }
  assert.ok(context.nodes.every(node=>node.disconnects===1));return sha(JSON.stringify(traces));
}
async function main(){
 const originalWindow=global.window,originalFetch=global.fetch;let network=0;
 global.fetch=()=>{network++;throw Error('No Node network');};
 try{
  const {createGameAudio,SAMPLE_CUES}=await import(pathToFileURL(path.join(__dirname,'public/audio.js')).href),types=Object.keys(SAMPLE_CUES),files=new Set(Object.values(SAMPLE_CUES).flatMap(l=>l.map(x=>x.file)));
  const manifests=JSON.parse(fs.readFileSync(path.join(__dirname,'public/audio/manifest.json'),'utf8'));
  assert.equal(manifests.filter(e=>e.adopted_cycle===71).length,22);assert.equal(new Set(manifests.map(e=>e.file)).size,manifests.length);
  const signature=(b,file)=>{if(file.endsWith('.mp3'))assert.ok(b.subarray(0,3).toString()==='ID3'||b[0]===255&&(b[1]&224)===224,'MP3 frame/header');else assert.equal(b.subarray(0,4).toString(),'OggS');};
  for(const e of manifests){const b=fs.readFileSync(path.join(__dirname,'public/audio',e.file));assert.equal(sha(b),e.sha256);assert.equal(b.length,e.bytes);signature(b,e.file);}
  for(const file of files)signature(fs.readFileSync(path.join(__dirname,'public/audio',file)),file);
  for(const pack of ['rpg-audio','impact-sounds','music-jingles']){const license=fs.readFileSync(path.join(__dirname,'public/audio/LICENSE-'+pack+'.txt'),'utf8');assert.match(license,/CC0/);assert.match(license,/commercial/i);}
  assert.equal(sha(fs.readFileSync(path.join(__dirname,'public/audio/footstep_concrete_000.ogg'))),'d7267e183067757c92c169de2a379abea592cfca6b39bb2e8feea15221ad79fe');assert.equal(sha(fs.readFileSync(path.join(__dirname,'public/audio/footstep_concrete_001.ogg'))),'507a75eb19b897087855a3be3cf11a12d7fa37d143ad535eeebe0b8031c7325d');
  const adopted=['soundeffect-lab-manifest.json','extra-sources-manifest.json'].flatMap(file=>JSON.parse(fs.readFileSync(path.join(__dirname,'public/audio',file),'utf8')));
  for(const entry of adopted){const bytes=fs.readFileSync(path.join(__dirname,'public/audio',entry.file));assert.equal(sha(bytes),entry.sha256);assert.equal(bytes.length,entry.bytes);}
  assert.ok([...files].every(file=>[...adopted,...manifests].some(entry=>entry.file===file)),'Every active cue has documented provenance');
  assert.deepEqual(SAMPLE_CUES.jump.map(cue=>cue.file),['lab-cloth.ogg']);assert.ok(SAMPLE_CUES.jump[0].length<=.2);
  assert.ok(types.length>=70);assert.ok(![...files].some(f=>f.startsWith('interface-')||f.includes('forceField')||f.includes('doorClose_001')));
  assert.equal(manifests.filter(e=>e.adopted_cycle===102).length,1);assert.equal(SAMPLE_CUES['bus-break'][0].file,'bus-wall-break-user.mp3');assert.equal(SAMPLE_CUES['bus-break'][0].rate,1);
  assert.equal(manifests.filter(e=>e.adopted_cycle===99).length,1);assert.equal(SAMPLE_CUES['vehicle-hit'].length,1);assert.equal(SAMPLE_CUES['vehicle-hit'][0].file,'vehicle-impact-user.mp3');assert.equal(SAMPLE_CUES['vehicle-hit'][0].rate,1);assert.equal(manifests.find(e=>e.adopted_cycle===99).sha256,'ae00f7eee68c22f65d1800f52b545ec73930b30f4253d4b54bc877fa3b21cc01');
  console.log('PASS:22 original CC0 additions plus exact user MP3/SHA and every active sample;no electronic interface/forcefield layers');

  global.window={AudioContext:Context};const cold=createGameAudio();const prior=Context.current;cold.play('kill');assert.equal(Context.current,prior);cold.init();const c=Context.current;
  for(const type of [...types,'unknown','constructor','toString','__proto__'])cold.play(type);assert.equal(c.sources.length,0);assert.equal(c.nodes.length,0,'Not-ready non-gun effects allocate no nodes and never synthesize');
  const baseline={cold:'c5bf5d4937f95253795c9701ae435951585f325a96aa6200599001fa832f7d2b',ready:'490a62624113d54c5c0f06a80605311883576e8b530f83c44a67b0cb5990dc65',failed:'c5bf5d4937f95253795c9701ae435951585f325a96aa6200599001fa832f7d2b'};
  for(const mode of ['cold','ready','failed']){assert.equal(await protectedTrace(createGameAudio,mode),baseline[mode]);assert.equal(await protectedTrace(createGameAudio,mode,true),baseline[mode]);}
  console.log('PASS: exact original70 protected gun/enemy/step/landing voice traces in cold/ready/failed modes');

  let release;const gate=new Promise(r=>release=r),requests=[];
  class Mapped extends Context{decodeAudioData(bytes){return Promise.resolve(decodedSample(Buffer.from(bytes).toString()));}}
  global.window={AudioContext:Mapped,fetch:async(url,options)=>{assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'force-cache');const file=path.basename(new URL(url).pathname);requests.push(file);await gate;return{ok:true,arrayBuffer:async()=>Uint8Array.from(Buffer.from(file)).buffer};}};
  const audio=createGameAudio();audio.init();audio.init();await settle();const ctx=Context.current;
  const expectedFiles=new Set([...files,'footstep_concrete_000.ogg','footstep_concrete_001.ogg','impactSoft_heavy_000.ogg']);assert.equal(requests.length,expectedFiles.size);assert.equal(new Set(requests).size,requests.length);
  for(const type of types)audio.play(type);assert.equal(ctx.sources.length,0);release();await settle();assert.equal(ctx.sources.length,0,'Loading never queues cues for later playback');
  const decodedHashes=new Map(requests.map(file=>{const d=decodedSample(file),mono=new Float32Array(d.length);for(let channel=0;channel<2;channel++){const data=d.getChannelData(channel);for(let i=0;i<mono.length;i++)mono[i]+=data[i]/2;}let peak=0;for(const n of mono)peak=Math.max(peak,Math.abs(n));if(peak>.85)for(let i=0;i<mono.length;i++)mono[i]*=.85/peak;return[sha(Buffer.from(mono.buffer)),file];}));
  let stepIndex=0;
  for(const [type,recipe] of Object.entries(SAMPLE_CUES)){
   const ns=ctx.nodes.length,ss=ctx.sources.length;audio.play(type,{volume:.7,pan:.65,distance:9,occluded:true});const layers=ctx.sources.slice(ss),nodes=ctx.nodes.slice(ns);
   assert.equal(layers.length,recipe.length,type);assert.ok(layers.length>=1&&layers.length<=3);assert.ok(layers.every(x=>x.kind==='buffer'),type+' contains no oscillator');
   assert.deepEqual(layers.map(x=>decodedHashes.get(bufferHash(x.buffer))),recipe.map(x=>x.file));assert.ok(Math.abs(nodes[0].gain.value-.7/(1+9*.11)*.4)<1e-12);assert.equal(nodes.find(x=>x.kind==='panner').pan.value,.65);
   let peakBound=0;
   for(let i=0;i<layers.length;i++){const source=layers[i],spec=recipe[i],filter=source.connections[0],amp=filter.connections[0];assert.equal(filter.frequency.value,1600);assert.equal(source.started,ctx.currentTime+spec.delay);assert.equal(source.playbackRate.value,spec.rate);assert.equal(source.duration,Math.min(2/spec.rate,spec.length)*spec.rate);assert.equal(source.buffer.numberOfChannels,1);assert.ok(source.buffer.getChannelData(0).every(n=>Number.isFinite(n)&&Math.abs(n)<=.850001));peakBound+=.85*amp.gain.events[0];}
   assert.ok(peakBound<=.650001,type+' headroom '+peakBound);
   const longest=layers.reduce((a,b)=>a.started+a.duration/a.playbackRate.value>b.started+b.duration/b.playbackRate.value?a:b);for(const source of layers)if(source!==longest)source.end();assert.ok(nodes.every(n=>n.disconnects===0));longest.end();assert.ok(nodes.every(n=>n.disconnects===1));longest.end();
   const at=ctx.sources.length;audio.play('step');const step=ctx.sources[at];assert.equal(decodedHashes.get(bufferHash(step.buffer)),stepIndex++%2?'footstep_concrete_001.ogg':'footstep_concrete_000.ogg');step.end();
  }
  assert.ok(ctx.nodes.every(n=>n.disconnects===1));const at=ctx.sources.length;for(let i=0;i<60;i++)audio.play('takeover');assert.equal(ctx.sources.length-at,144);const cap=ctx.nodes.length;audio.play('buy');assert.equal(ctx.nodes.length,cap);for(const source of ctx.sources)source.end();audio.play('buy');assert.equal(ctx.sources.length,at+146);for(const source of ctx.sources)source.end();
  const no=ctx.nodes.length;audio.play('kill',{volume:0});ctx.state='suspended';audio.play('kill');assert.equal(ctx.nodes.length,no);assert.equal(requests.length,expectedFiles.size);
  console.log(`PASS:all${types.length} non-gun cues sample-only/<=3 layers;mono peak/gain/position/occlusion/fades;48voices;cleanup/mute;footstep phase unchanged`);

  for(const failure of ['fetch','http','decode','nonfinite','duration','channels']){
   class Failed extends Context{decodeAudioData(){if(failure==='decode')throw Error('codec');const d=decodedSample('bad');if(failure==='nonfinite')d.getChannelData(0)[0]=NaN;if(failure==='duration')d.duration=13;if(failure==='channels')d.numberOfChannels=9;return Promise.resolve(d);}}
   global.window={AudioContext:Failed,fetch:async()=>{if(failure==='fetch')throw Error('offline');return{ok:failure!=='http',arrayBuffer:async()=>new ArrayBuffer(4)};}};const bad=createGameAudio();bad.init();await settle();const cx=Context.current;for(const type of types)bad.play(type);assert.equal(cx.nodes.length,0,failure+' never reverts to beeps/noise');
  }
  // Partial decoding retains only ready layers and never synthesizes a missing layer.
  global.window={AudioContext:Mapped,fetch:async url=>{const f=path.basename(new URL(url).pathname);return{ok:f==='lab-cloth.ogg',arrayBuffer:async()=>Uint8Array.from(Buffer.from(f)).buffer};}};const partial=createGameAudio();partial.init();await settle();const pc=Context.current;partial.play('skill-throw');assert.equal(pc.sources.length,1);assert.equal(pc.sources[0].kind,'buffer');pc.sources[0].end();assert.ok(pc.nodes.every(n=>n.disconnects===1));
  assert.equal(network,0);console.log('PASS:fetch/HTTP/codec/NaN/duration/channel failures silent;partial decode safe;no late replay/no global network');
 }finally{if(originalWindow===undefined)delete global.window;else global.window=originalWindow;if(originalFetch===undefined)delete global.fetch;else global.fetch=originalFetch;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
