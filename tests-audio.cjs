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
const iagnuTypes=['echo-tag-set','echo-tag-detect','echo-glint','echo-kerning'];
const grassTypes=['grass-dust','grass-roots','grass-turf'];
const emberTypes=['solder-pop','shade-check','quick-solder'];
const frostTypes=['frost-stitch','frost-mist','frost-unravel'];
const nobiTypes=['nobi-tag','nobi-brake','nobi-tool','nobi-legend'];
const duelistTypes=['duelist-comet','duelist-lift'];
const expectedSamples={
 'nobi-tag':['interface-pluck_002.ogg'],'nobi-brake':['interface-pluck_002.ogg'],'nobi-tool':['scifi-doorClose_001.ogg'],'nobi-legend':['scifi-forceField_004.ogg'],
  plant:['rpg-metalLatch.ogg','interface-confirmation_002.ogg'],defuse:['rpg-metalLatch.ogg','interface-minimize_005.ogg'],
  buy:['interface-click_001.ogg','rpg-beltHandle1.ogg'],'skill-throw':['rpg-cloth4.ogg','rpg-beltHandle1.ogg'],
  'bottle-pop':['scifi-slime_000.ogg','scifi-forceField_004.ogg'],flash:['scifi-forceField_004.ogg','interface-pluck_002.ogg'],
  decoy:['scifi-doorClose_001.ogg','interface-maximize_005.ogg'],takeover:['scifi-doorClose_001.ogg','scifi-slime_000.ogg','scifi-forceField_001.ogg'],
  'seed-bloom':['interface-pluck_002.ogg','rpg-cloth4.ogg'],pollen:['scifi-forceField_001.ogg','interface-pluck_002.ogg'],
  'flower-heal':['jingle-STEEL00.ogg','interface-pluck_002.ogg'],heal:['jingle-STEEL00.ogg','interface-pluck_002.ogg'],
  recon:['scifi-forceField_004.ogg'],veil:['scifi-forceField_001.ogg','rpg-cloth4.ogg'],
  'ember-warning':['rpg-metalLatch.ogg','scifi-forceField_004.ogg'],
  'echo-tag-set':['rpg-metalLatch.ogg','interface-pluck_002.ogg'],'echo-tag-detect':['interface-pluck_002.ogg','interface-pluck_002.ogg'],
  'echo-glint':['scifi-forceField_004.ogg','interface-pluck_002.ogg'],'echo-kerning':['rpg-cloth4.ogg','interface-maximize_005.ogg'],
  'grass-dust':['rpg-cloth4.ogg','scifi-slime_000.ogg'],'grass-roots':['scifi-slime_000.ogg','interface-pluck_002.ogg'],'grass-turf':['rpg-cloth4.ogg','interface-maximize_005.ogg'],
  'solder-pop':['rpg-metalLatch.ogg','scifi-forceField_004.ogg'],'shade-check':['interface-click_001.ogg','scifi-forceField_004.ogg'],'quick-solder':['rpg-metalLatch.ogg','rpg-cloth4.ogg'],
  'frost-stitch':['interface-click_001.ogg','interface-pluck_002.ogg'],'frost-mist':['scifi-forceField_001.ogg','rpg-cloth4.ogg'],'frost-unravel':['rpg-cloth4.ogg','interface-pluck_002.ogg'],
  'duelist-comet':['scifi-forceField_001.ogg','interface-pluck_002.ogg'],'duelist-lift':['interface-maximize_005.ogg','scifi-forceField_004.ogg'],
  'round-win':['jingle-STEEL07.ogg','interface-confirmation_002.ogg'],'round-loss':['jingle-STEEL16.ogg','interface-error_003.ogg'],
  'match-win':['jingle-STEEL07.ogg','interface-confirmation_002.ogg'],'match-loss':['jingle-STEEL16.ogg','interface-error_003.ogg']
};
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
  const originalWindow=global.window,originalFetch=global.fetch;let nodeFetchCalls=0;
  global.fetch=()=>{nodeFetchCalls++;throw new Error('Node tests must not access the network');};global.window={AudioContext:Context};
  try{
    const {createGameAudio}=await import(pathToFileURL(path.join(__dirname,'public/audio.js')).href);
    const audio=createGameAudio();audio.play('explosion');assert.equal(Context.current,undefined,'Audio stays lazy until user initialization');
    audio.init();const context=Context.current;
    audio.play('explosion',{volume:1,pan:.7,distance:12});
    const first=context.sources[0],buffer=first.buffer,data=buffer.getChannelData(0),firstNodes=[...context.nodes];
    assert.equal(context.sources.length,1,'One collapse occupies one buffer source');
    assert.equal(buffer.numberOfChannels,1,'Mono source retains directional placement');
    assert.equal(buffer.duration,2.8);assert.equal(first.started,context.currentTime);
    assert.equal(firstNodes.find(node=>node.kind==='panner').pan.value,.7);
    assert.ok(Math.abs(firstNodes[0].gain.value-1/(1+12*.11))<1e-10,'Existing distance attenuation is retained');
    assert.ok([...data].every(Number.isFinite));
    const peak=data.reduce((max,value)=>Math.max(max,Math.abs(value)),0),mean=data.reduce((sum,value)=>sum+value,0)/data.length;
    assert.ok(peak>.3&&peak<=.680001,'Explosion leaves at least 32% waveform headroom');
    assert.ok(Math.abs(mean)<1e-7,'Pressure wave introduces no DC offset');
    const rms=(start,end)=>Math.sqrt(data.slice(start*buffer.sampleRate,end*buffer.sampleRate).reduce((sum,value)=>sum+value*value,0)/((end-start)*buffer.sampleRate));
    assert.ok(rms(.35,1.2)>.01,'Rubble continues beyond the initial attack');
    assert.ok(rms(1.5,2.5)>.0002,'Late reflections remain audible');
    assert.ok(rms(2.5,2.8)<rms(.35,1.2),'The tail fades away');
    audio.play('explosion',{occluded:true,pan:-.8});
    assert.equal(context.buffers.length,1,'Repeated explosions reuse the synthesized buffer');
    assert.equal(context.sources[1].buffer,buffer);
    assert.equal(context.nodes.filter(node=>node.kind==='filter').at(-1).frequency.value,1100);
    assert.equal(context.nodes.filter(node=>node.kind==='panner').at(-1).pan.value,-.8);
    for(let i=0;i<60;i++)audio.play('explosion');
    assert.equal(context.sources.length,48,'The shared 48-voice cap is preserved');
    for(const source of context.sources)source.end();
    assert.ok(context.nodes.every(node=>node.disconnects===1),'Every completed voice releases all audio nodes exactly once');
    const previous=context.sources.length;audio.play('explosion');assert.equal(context.sources.length,previous+1,'Ended voices free capacity');
    assert.equal(context.buffers.length,1);context.sources.at(-1).end();
    const types=['shot','enemy','step','land','reload','spike','plant','defuse','explosion','smoke','updraft','dash','dash-armed','dash-ready','dash-expired','knives','hit','kill','ember-impact','frost'];
    for(const type of types){audio.play(type);for(const source of context.sources)source.end();}
    for(const weapon of ['classic','ghost','spectre','phantom','vandal','knife']){audio.play('shot',{weapon});for(const source of context.sources)source.end();}
    assert.ok(context.nodes.every(node=>node.disconnects===1),'All20 effects and six equipment profiles retain cleanup');
    const fallbackStart=context.sources.length,fallbackNodeStart=context.nodes.length;
    audio.play('ember-impact',{pan:-.4,distance:3});
    const fallbackImpact=context.sources.slice(fallbackStart);
    assert.equal(fallbackImpact.length,2,'A missing impact sample uses one short hiss and one low thud');
    assert.equal(fallbackImpact[0].buffer.duration,.20);assert.ok(fallbackImpact[1].stopped-context.currentTime<.23);
    assert.equal(context.nodes.slice(fallbackNodeStart).find(node=>node.kind==='panner').pan.value,-.4);
    for(const source of fallbackImpact)source.end();
    const fallbackFrostStart=context.sources.length;audio.play('frost');const fallbackFrost=context.sources.slice(fallbackFrostStart);
    assert.equal(fallbackFrost.length,2);assert.equal(fallbackFrost[0].buffer.duration,.30);
    assert.equal(fallbackFrost[1].type,'sine');assert.deepEqual(fallbackFrost[1].frequency.events,[1600,2850]);
    for(const source of fallbackFrost)source.end();
    assert.ok(context.nodes.every(node=>node.disconnects===1),'Both procedural zone cues clean up their short layers');
    const allocated=context.nodes.length;audio.play('explosion',{volume:0});context.state='suspended';audio.play('explosion');assert.equal(context.nodes.length,allocated);
    console.log(`PASS: mono 2.8s collapse; one cached source; peak ${peak.toFixed(3)}; positional/occluded audio;48 voices; cleanup; all20 effects and six weapon profiles; compact EMBER/FROST fallbacks.`);
    const settle=()=>new Promise(resolve=>setImmediate(resolve));
    let browserFetchCalls=0;
    global.window={AudioContext:Context,fetch:()=>{browserFetchCalls++;throw new Error('No decoder');}};
    createGameAudio().init();await settle();assert.equal(browserFetchCalls,0,'Fetch is guarded when decodeAudioData is unavailable');
    class SampleContext extends Context {
      decodeAudioData(bytes){
        this.decodes=(this.decodes||0)+1;assert.ok(bytes instanceof ArrayBuffer);
        const channels=[new Float32Array(96000).fill(1.6),new Float32Array(96000).fill(.8)];
        return Promise.resolve({duration:2,length:96000,sampleRate:48000,numberOfChannels:2,getChannelData:channel=>channels[channel]});
      }
    }
    const requests=[];let release;const gate=new Promise(resolve=>{release=resolve;});
    global.window={AudioContext:SampleContext,fetch:async(url,options)=>{requests.push({url,options});await gate;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};}};
    const imported=createGameAudio();imported.init();imported.init();const sampled=Context.current;
    await settle();assert.equal(requests.length,24,'Each bundled OGG is requested once, even after repeated init');
    for(const request of requests){
      assert.ok(request.url.includes('/audio/')&&request.url.endsWith('.ogg'));assert.equal(request.options.credentials,'same-origin');
      const filename=path.basename(new URL(request.url).pathname),bytes=fs.readFileSync(path.join(__dirname,'public/audio',filename));
      assert.equal(bytes.subarray(0,4).toString(),'OggS','Every requested sample is bundled as valid Ogg');
    }
    const credits=fs.readFileSync(path.join(__dirname,'public/audio/CREDITS.txt'),'utf8');
    assert.match(credits,/CC0 1\.0/);assert.match(credits,/kenney\.nl\/assets\/impact-sounds/);assert.match(credits,/opengameart\.org\/content\/sci-fi-sounds/);
    imported.play('reload');assert.equal(sampled.sources.length,2,'Synthesis remains immediate while samples load');
    for(const source of sampled.sources)source.end();const fallbackBuffers=sampled.buffers.length;release();await settle();
    assert.equal(sampled.decodes,24);assert.equal(sampled.buffers.length,fallbackBuffers+24,'Decoded samples are cached independently');
    const stepStart=sampled.sources.length;imported.play('step',{pan:.6});imported.play('step');
    const footsteps=sampled.sources.slice(stepStart);assert.equal(footsteps.length,2);assert.notEqual(footsteps[0].buffer,footsteps[1].buffer,'Two concrete footsteps alternate');
    for(const source of footsteps){
      assert.equal(source.buffer.numberOfChannels,1,'Stereo recordings become mono spatial sources');
      assert.ok(source.buffer.getChannelData(0).every(value=>Number.isFinite(value)&&Math.abs(value)<=.850001),'Imported peaks leave headroom');
      assert.equal(source.duration,.30);source.end();
    }
    for(const type of ['land','reload','hit','smoke','updraft','dash']){
      const before=sampled.sources.length;imported.play(type,{occluded:true});
      assert.equal(sampled.sources.length,before+1,`${type} uses exactly one imported source`);
      const source=sampled.sources.at(-1);assert.equal(source.kind,'buffer');assert.ok(source.duration<=.9);assert.ok(source.playbackRate.value>0);
      assert.equal(source.connections[0].frequency.value,1600,'Imported effects retain occlusion filtering');source.end();
    }
    const explosionStart=sampled.sources.length;imported.play('explosion');
    const explosion=sampled.sources.slice(explosionStart);assert.equal(explosion.length,2,'Recorded collapse and procedural low tail share one voice');
    const importedGain=explosion[0].connections[0].connections[0].gain.events[0],tailGain=explosion[1].connections[0].connections[0].gain.value;
    assert.ok(.85*importedGain+.68*tailGain<.7,'Combined collapse retains headroom');for(const source of explosion)source.end();
    const impactStart=sampled.sources.length,impactNodeStart=sampled.nodes.length;
    for(let i=0;i<3;i++)imported.play('ember-impact',{volume:1,pan:.35,distance:5});
    const impacts=sampled.sources.slice(impactStart);assert.equal(impacts.length,3,'Each EMBER pulse adds exactly one short recorded source');
    for(const source of impacts){
      assert.equal(source.buffer,explosion[0].buffer,'EMBER reuses the existing explosion recording without a new asset');
      assert.equal(source.playbackRate.value,1.25);assert.equal(source.duration,.35*1.25);
      const filter=source.connections[0],gain=filter.connections[0].gain.events[0];assert.equal(filter.frequency.value,3600);
      assert.equal(gain,.16);assert.ok(.85*gain<.15&&gain<importedGain/2,'Each strike is much quieter than the station explosion');
      source.end();
    }
    assert.ok(sampled.nodes.slice(impactNodeStart).filter(node=>node.kind==='panner').every(node=>node.pan.value===.35));
    const frostStart=sampled.sources.length;imported.play('frost',{occluded:true,pan:-.6});
    const ice=sampled.sources.slice(frostStart);assert.equal(ice.length,2,'FROST blends the slowed shared sample with one small crystal tone');
    assert.equal(ice[0].kind,'buffer');assert.equal(ice[0].playbackRate.value,.8);assert.equal(ice[0].duration,.60*.8);
    assert.equal(ice[0].connections[0].frequency.value,1600);assert.equal(ice[0].connections[0].connections[0].gain.events[0],.14);
    assert.equal(ice[1].type,'sine');assert.deepEqual(ice[1].frequency.events,[1600,2850]);
    assert.ok(.85*.14+.028<.15,'The combined ice sound retains ample peak headroom');for(const source of ice)source.end();
    for(const type of ['seed-bloom','pollen','flower-heal']){
      const sourceStart=sampled.sources.length,nodeStart=sampled.nodes.length;imported.play(type,{pan:.4,distance:6,occluded:true});
      const layers=sampled.sources.slice(sourceStart),tones=layers.filter(source=>source.kind==='oscillator');
      assert.equal(tones.length,0,`${type} uses its imported flower/seed cue when available`);assert.equal(layers.length,2);
      assert.ok(sampled.nodes.slice(nodeStart).filter(node=>node.kind==='panner').every(node=>node.pan.value===.4));
      assert.ok(layers.length<=3,'Ordinary flower cues remain small bounded voices');
      for(const source of layers)source.end();
      assert.ok(sampled.nodes.slice(nodeStart).every(node=>node.disconnects===1),'Every flower cue node is released once');
    }
    const zoneCap=sampled.sources.length;for(let i=0;i<60;i++)imported.play(i%2?'frost':'ember-impact');
    assert.equal(sampled.sources.length-zoneCap,72,'Mixed one/two-layer zone sounds still obey the48-voice cap');
    for(const source of sampled.sources)source.end();
    assert.ok(sampled.nodes.every(node=>node.disconnects===1),'Recorded zone cue layers release every node once');
    const capped=sampled.sources.length;for(let i=0;i<60;i++)imported.play('explosion');
    assert.equal(sampled.sources.length-capped,96,'Imported layers still respect the 48-voice cap');
    for(const source of sampled.sources)source.end();assert.ok(sampled.nodes.every(node=>node.disconnects===1),'All imported and blended voice nodes release exactly once');
    assert.equal(requests.length,24,'Playing recordings never repeats downloads');
    for(const failure of ['http','decode','fetch','nonfinite']){
      class FailedContext extends SampleContext {decodeAudioData(){if(failure==='nonfinite'){const value=decodedSample('bad');value.getChannelData(0)[0]=NaN;return Promise.resolve(value);}return Promise.reject(new Error('Unsupported codec'));}}
      global.window={AudioContext:FailedContext,fetch:async()=>{if(failure==='fetch')throw Error('Offline');return{ok:failure!=='http',arrayBuffer:async()=>new ArrayBuffer(4)};}};
      const fallback=createGameAudio();fallback.init();await settle();const failed=Context.current;
      fallback.play('reload');assert.equal(failed.sources.length,2,`${failure} failure falls back to synthesis`);
      for(const source of failed.sources)source.end();assert.ok(failed.nodes.every(node=>node.disconnects===1));
      for(const type of ['ember-impact','frost']){
        const before=failed.sources.length;fallback.play(type);assert.equal(failed.sources.length-before,2,`${failure} failure retains the ${type} fallback`);
        for(const source of failed.sources)source.end();assert.ok(failed.nodes.every(node=>node.disconnects===1));
      }
      for(const type of [...newTypes,...iagnuTypes,...grassTypes,...emberTypes,...frostTypes,...duelistTypes,...nobiTypes,'plant','defuse']){
        const sourceStart=failed.sources.length,nodeStart=failed.nodes.length;fallback.play(type,{pan:-.3,distance:7,occluded:true});
        const layers=failed.sources.slice(sourceStart);assert.ok(layers.length>=1&&layers.length<=3,`${failure}/${type} has a bounded procedural fallback`);
        if(type==='flower-heal'||type==='heal')assert.deepEqual(layers.map(source=>source.frequency.events),[[523,523],[659,659],[784,1046]],'The original three healing tones survive total sample failure');
        for(const source of layers)source.end();assert.ok(failed.nodes.slice(nodeStart).every(node=>node.disconnects===1));
      }
    }
    assert.equal(nodeFetchCalls,0,'The Node global fetch is never called');
    console.log('PASS: 24 bundled OGGs; guarded decode/cache; loading/HTTP/codec/network/nonfinite fallbacks; mono peaks; bounded voices and cleanup; no Node network.');

    const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'public/audio/manifest.json'),'utf8'));
    assert.equal(manifest.length,16);const files=new Set();
    for(const entry of manifest){
      assert.deepEqual(Object.keys(entry).sort(),['bytes','file','original','pack','seconds','sha256','source_url']);assert.ok(!files.has(entry.file));files.add(entry.file);
      assert.match(entry.source_url,/^https:\/\/kenney\.nl\/assets\/[a-z-]+$/);assert.match(entry.original,/\.ogg$/);assert.ok(entry.seconds>0&&entry.seconds<12);
      const bytes=fs.readFileSync(path.join(__dirname,'public/audio',entry.file));assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256);assert.equal(bytes.subarray(0,4).toString(),'OggS');
    }
    assert.equal(sha(fs.readFileSync(path.join(__dirname,'public/audio/footstep_concrete_000.ogg'))),'d7267e183067757c92c169de2a379abea592cfca6b39bb2e8feea15221ad79fe');
    assert.equal(sha(fs.readFileSync(path.join(__dirname,'public/audio/footstep_concrete_001.ogg'))),'507a75eb19b897087855a3be3cf11a12d7fa37d143ad535eeebe0b8031c7325d');
    // Captured once from pre-enhancement HEAD e7b9f8a8a665cebaeebdd78c050f1dbdda51ed38.
    // Includes automation times, PCM hashes, filters, gains, routing and source lifetimes.
    const baseline={cold:'c5bf5d4937f95253795c9701ae435951585f325a96aa6200599001fa832f7d2b',
      ready:'490a62624113d54c5c0f06a80605311883576e8b530f83c44a67b0cb5990dc65',
      failed:'c5bf5d4937f95253795c9701ae435951585f325a96aa6200599001fa832f7d2b'};
    for(const mode of ['cold','ready','failed']){
      const plain=await protectedTrace(createGameAudio,mode),interleaved=await protectedTrace(createGameAudio,mode,true);
      assert.equal(plain,baseline[mode],`${mode}: all six shot/enemy profiles, footsteps, landings and output match original HEAD e7b9f8a`);
      assert.equal(interleaved,plain,`${mode}: new cues never change the protected footstep variation phase`);
      for(const type of [...iagnuTypes,...grassTypes,...emberTypes,...frostTypes,...duelistTypes,...nobiTypes])assert.equal(await protectedTrace(createGameAudio,mode,type),plain,`${mode}: ${type} independently preserves original shot/step/land routing, timing and variation`);
    }
    console.log('PASS: 16 source manifests/SHA256; original footstep bytes; HEAD-fixed cold/ready/failed 70-voice traces; each new cue independently preserves protected audio.');

    class MappedContext extends Context{decodeAudioData(bytes){return Promise.resolve(decodedSample(Buffer.from(bytes).toString()));}}
    const mappedRequests=[];global.window={AudioContext:MappedContext,fetch:async url=>{const file=path.basename(new URL(url).pathname);mappedRequests.push(file);return{ok:true,arrayBuffer:async()=>Uint8Array.from(Buffer.from(file)).buffer};}};
    const enhanced=createGameAudio();enhanced.init();await settle();const mapped=Context.current;assert.equal(mappedRequests.length,24);assert.equal(new Set(mappedRequests).size,24);
    const decodedHashes=new Map(mappedRequests.map(file=>{const decoded=decodedSample(file),data=new Float32Array(decoded.length);for(let channel=0;channel<2;channel++){const source=decoded.getChannelData(channel);for(let i=0;i<data.length;i++)data[i]+=source[i]/2;}let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value));if(peak>.85)for(let i=0;i<data.length;i++)data[i]*=.85/peak;return[sha(Buffer.from(data.buffer)),file];}));
    for(const [type,expected] of Object.entries(expectedSamples)){
      const nodeStart=mapped.nodes.length,sourceStart=mapped.sources.length;enhanced.play(type,{volume:.7,pan:.65,distance:9,occluded:true});
      const layers=mapped.sources.slice(sourceStart),recorded=layers.filter(source=>source.kind==='buffer'),actual=recorded.map(source=>decodedHashes.get(bufferHash(source.buffer)));
      assert.deepEqual(actual,expected,`${type} plays the assigned recordings`);assert.ok(layers.length<=3,`${type} has at most three layers`);
      const nodes=mapped.nodes.slice(nodeStart),out=nodes[0];assert.ok(Math.abs(out.gain.value-.7/(1+9*.11)*.4)<1e-12);assert.equal(nodes.find(node=>node.kind==='panner').pan.value,.65);
      let peakBound=0;
      for(const source of layers){
        if(source.kind==='buffer'){
          assert.equal(source.buffer.numberOfChannels,1);assert.ok(source.buffer.getChannelData(0).every(value=>Number.isFinite(value)&&Math.abs(value)<=.850001));
          const filter=source.connections[0],amp=filter.connections[0];assert.equal(filter.frequency.value,1600);assert.ok(source.started>=mapped.currentTime);assert.ok(source.duration>0&&source.playbackRate.value>0);
          assert.ok(source.duration/source.playbackRate.value<=1.600001);peakBound+=.85*amp.gain.events[0];
        }else peakBound+=source.connections[0].gain.events[0];
      }
      assert.ok(peakBound<=.650001,`${type} pre-master peak bound ${peakBound} leaves headroom`);
      if(iagnuTypes.includes(type)){
        assert.equal(layers.length,2,`${type} is exactly two short gold-letter cue layers`);
        assert.ok(peakBound<.23,`${type} remains quieter than gunfire`);
        for(const source of layers)assert.ok(source.duration/source.playbackRate.value<=.300001,`${type} has no lingering or looping source`);
      }
      if(grassTypes.includes(type)){
        assert.equal(layers.length,2,`${type} uses exactly two small earth/grass layers`);assert.ok(peakBound<.30,`${type} leaves generous gunfire headroom`);
        for(const source of layers)assert.ok(source.duration/source.playbackRate.value<=.320001,`${type} has no looping or movement-timed source`);
      }
      if(emberTypes.includes(type)){
        assert.equal(layers.length,2,`${type} uses exactly two quiet metal/service layers`);assert.ok(peakBound<.20,`${type} preserves gunfire headroom`);
        for(const source of layers)assert.ok(source.duration/source.playbackRate.value<=.220001,`${type} has no looping or long machinery tail`);
      }
      if(frostTypes.includes(type)){
        assert.equal(layers.length,2,`${type} uses exactly two quiet fabric/ice layers`);assert.ok(peakBound<.20,`${type} retains gunfire headroom`);
        for(const source of layers)assert.ok(source.duration/source.playbackRate.value<=.450001,`${type} uses a short one-shot without a repeating chime`);
      }
      if(duelistTypes.includes(type)){
        assert.equal(layers.length,2,`${type} uses exactly two quiet sky/star layers`);assert.ok(peakBound<.12,`${type} leaves gunfire headroom`);
        for(const source of layers)assert.ok(source.duration/source.playbackRate.value<=.280001,`${type} has no loop or added movement-timed footstep`);
      }
      const longest=layers.reduce((a,b)=>{const end=source=>source.stopped??source.started+source.duration/source.playbackRate.value;return end(a)>end(b)?a:b;});
      for(const source of layers)if(source!==longest)source.end();assert.ok(nodes.every(node=>node.disconnects===0),'Early layer endings cannot release a still-playing effect');
      longest.end();assert.ok(nodes.every(node=>node.disconnects===1));longest.end();assert.ok(nodes.every(node=>node.disconnects===1));
    }
    const cap=mapped.sources.length;for(let i=0;i<60;i++)enhanced.play('takeover');assert.equal(mapped.sources.length-cap,144,'Three-layer cues share the original 48 logical-voice cap');
    const enhancedCapNodes=mapped.nodes.length;enhanced.play('buy');assert.equal(mapped.nodes.length,enhancedCapNodes);for(const source of mapped.sources)source.end();
    const freed=mapped.sources.length;enhanced.play('buy');assert.equal(mapped.sources.length-freed,2);for(const source of mapped.sources)source.end();assert.ok(mapped.nodes.every(node=>node.disconnects===1));
    const silent=mapped.nodes.length;enhanced.play('takeover',{volume:0});mapped.state='suspended';enhanced.play('takeover');assert.equal(mapped.nodes.length,silent);assert.equal(mappedRequests.length,24);
    assert.equal(nodeFetchCalls,0);console.log('PASS: every enhanced cue uses exact bundled buffers; <=3 layers; headroom/delay/rate/pan/occlusion; longest-layer cleanup; 48 logical voices; mute/suspended no allocations.');
  }finally{if(originalWindow===undefined)delete global.window;else global.window=originalWindow;if(originalFetch===undefined)delete global.fetch;else global.fetch=originalFetch;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
