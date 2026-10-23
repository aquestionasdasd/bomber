// Recorded skill/UI/TRC effects from Sound Effect Lab, OtoLogic and On-Jin plus user impacts. Original gunfire/step/landing graph is preserved. See audio/CREDITS.txt.
const layer=(file,gain=.15,length=.35,delay=0,rate=1)=>Object.freeze({file,gain,length,delay,rate});
const cloth=(gain=.18,length=.28,delay=0)=>layer('lab-cloth.ogg',gain,length,delay);
const air=(gain=.18,length=.28,delay=0)=>layer('onjin-dash.ogg',gain,length,delay);
const glass=(gain=.13,length=.3,delay=0)=>layer('lab-ice.ogg',gain,length,delay);
const page=(gain=.15,length=.25,delay=0)=>layer('lab-cloth.ogg',gain,length,delay);
const bell=(gain=.10,length=.45,delay=0)=>layer('oto-cyber21-1.ogg',gain,length,delay);
const soft=(gain=.19,length=.22,delay=0)=>layer('lab-punch-light1.ogg',gain,length,delay);
const wood=(gain=.18,length=.28,delay=0)=>layer('lab-landing1.ogg',gain,length,delay);
const liquid=(gain=.17,length=.4,delay=0)=>layer('lab-liquid.ogg',gain,length,delay);
const pluck=(id,gain=.14,length=.65,delay=0)=>layer((id==='00'?'oto-angel01-1.ogg':id==='07'?'lab-success1.ogg':'lab-cancel2.ogg'),gain,length,delay);
export const SAMPLE_CUES=Object.freeze({
 'vehicle-hit':[layer('vehicle-impact-user.mp3',.65,1.1)],
 'bus-break':[layer('bus-wall-break-user.mp3',.55,5.55)],
 'duct-step':[layer('onjin-latch.ogg',.14,.16,0,.82)],
 'door-open':[layer('onjin-equipment.ogg',.20,.45),layer('onjin-latch.ogg',.12,.18,.22)],
 'door-close':[layer('onjin-equipment.ogg',.18,.35),layer('onjin-latch.ogg',.23,.23,.23)],
 'door-hit':[layer('onjin-latch.ogg',.12,.12,0,1.18)],
 'door-break':[layer('lab-ice.ogg',.22,.48),layer('lab-landing1.ogg',.27,.36,.04)],
 'duck-pad':[cloth(.22,.25),layer('oto-cyber19-1.ogg',.08,.3,.04)],'urchin-lance':[air(.19,.28),glass(.13,.3,.03)],
 jump:[cloth(.20,.16)],'duck-flap':[cloth(.18,.23)],'duck-launch':[air(.18,.3),cloth(.16,.2)],
 reload:[layer('lab-machinegun-magazine-set1.ogg',.22,.52)],hit:[soft(.23,.14)],
 spike:[layer('lab-beep1.ogg',.42,.18),bell(.18,.12)],plant:[bell(.34,.8),layer('onjin-latch.ogg',.25,.30),layer('lab-decision6.ogg',.12,.30,.20)],defuse:[layer('oto-cyber19-1.ogg',.2,.26),cloth(.18,.25,.08)],
 buy:[layer('lab-decision6.ogg',.20,.3),layer('onjin-equipment.ogg',.12,.22,.05)],scan:[page(.15,.18),bell(.07,.3,.06)],
 'skill-throw':[cloth(.26,.25),air(.13,.24,.03)],'bottle-pop':[liquid(.25,.45),layer('lab-ice.ogg',.16,.4,.025),soft(.15,.2)],
 flash:[air(.16,.24),glass(.11,.24,.04)],decoy:[layer('onjin-decoy.ogg',.20,.25),cloth(.17,.3,.04)],takeover:[layer('onjin-field.ogg',.21,.45),air(.20,.4,.07),liquid(.15,.45,.14)],
 explosion:[layer('lab-bomb1.ogg',.48,2.8),wood(.18,.45,.18)],'ember-impact':[layer('lab-bomb1.ogg',.16,.35,0,1.25)],
 frost:[glass(.14,.4),cloth(.1,.35,.04)],smoke:[layer('onjin-smoke.ogg',.20,.75)],updraft:[layer('onjin-dash.ogg',.25,.4),cloth(.14,.25,.04)],dash:[air(.27,.28),cloth(.15,.2,.02)],
 'dash-armed':[layer('onjin-equipment.ogg',.18,.18)],'dash-ready':[bell(.09,.4),page(.12,.18,.04)],'dash-expired':[layer('onjin-latch.ogg',.13,.22)],knives:[layer('onjin-dash.ogg',.2,.3),glass(.12,.25,.07)],kill:[soft(.2,.16),bell(.13,.4,.03)],
 'seed-bloom':[layer('lab-cloth.ogg',.24,.3),wood(.10,.18,.03)],pollen:[cloth(.22,.4),liquid(.12,.28,.06)],'flower-heal':[pluck('00',.14,.75),page(.10,.2,.06)],heal:[pluck('00',.18,1),cloth(.10,.25,.08)],
 'echo-tag-set':[page(.18,.18),layer('lab-decision13.ogg',.12,.16,.04)],'echo-tag-detect':[bell(.09,.25),bell(.065,.25,.09)],'echo-glint':[glass(.13,.24),air(.09,.2,.025)],'echo-kerning':[page(.15,.2),air(.1,.22,.02)],
 'grass-dust':[cloth(.25,.32),wood(.09,.2,.04)],'grass-roots':[layer('onjin-field.ogg',.16,.3),wood(.12,.24,.06)],'grass-turf':[cloth(.19,.24),air(.11,.2,.025)],
 'solder-pop':[layer('onjin-latch.ogg',.10,.12),glass(.09,.18,.02)],'shade-check':[layer('onjin-equipment.ogg',.13,.15),glass(.06,.2,.025)],'quick-solder':[layer('onjin-equipment.ogg',.14,.2),cloth(.12,.22,.04)],
 'frost-stitch':[glass(.13,.22),cloth(.08,.18,.035)],'frost-mist':[cloth(.22,.4),glass(.07,.3,.03)],'frost-unravel':[cloth(.16,.24),page(.09,.18,.03)],
 'duelist-comet':[air(.19,.28),glass(.08,.2,.025)],'duelist-lift':[layer('onjin-dash.ogg',.18,.28),cloth(.13,.22,.025)],
 'duck-seal':[layer('onjin-latch.ogg',.2,.22),soft(.10,.16,.03)],'duck-shield':[wood(.20,.3),air(.12,.25,.04)],'duck-hush':[cloth(.16,.24)],'duck-egg':[layer('onjin-decoy.ogg',.2,.3),glass(.11,.28,.06)],
 'cat-bookmark':[page(.19,.22)],'cat-return':[layer('oto-cyber19-1.ogg',.19,.3),air(.13,.25,.02)],'cat-pluck':[cloth(.19,.2)],'cat-fetch':[layer('onjin-equipment.ogg',.20,.25)],'cat-clock':[page(.17,.28),bell(.09,.5,.06)],
 'car-bumper':[soft(.24,.22),wood(.16,.25,.02)],'car-wash':[liquid(.20,.4),cloth(.1,.24,.025)],'car-gyro':[layer('onjin-equipment.ogg',.17,.2),air(.1,.22)],'car-pit':[layer('lab-decision6.ogg',.13,.25),cloth(.18,.3,.04)],
 'nobi-tag':[bell(.10,.32),soft(.1,.15)],'nobi-brake':[layer('lab-cloth.ogg',.2,.25),soft(.09,.18,.02)],'nobi-tool':[layer('oto-cyber19-1.ogg',.2,.28)],'nobi-legend':[bell(.15,.6),page(.14,.25,.06)],
 'japan-border':[cloth(.25,.4),wood(.13,.26,.05)],'japan-levy':[layer('lab-beep1.ogg',.21,.3)],'japan-return':[air(.21,.3),cloth(.14,.22,.04)],'japan-muster':[layer('lab-cloth.ogg',.24,.4),bell(.13,.55,.07)],
 'cap-lock':[layer('lab-ice.ogg',.17,.32),air(.11,.2,.025)],'cap-clean':[cloth(.24,.3),glass(.08,.22,.04)],'cap-bank':[glass(.17,.25),soft(.12,.2,.025)],'cap-magazine':[layer('onjin-equipment.ogg',.24,.3),cloth(.12,.22,.05)],
 'urchin-jam':[wood(.14,.23),glass(.1,.22,.03)],'urchin-disarm':[layer('onjin-decoy.ogg',.2,.27),glass(.1,.2,.03)],'urchin-pearl':[liquid(.15,.35),glass(.11,.26,.03)],'urchin-trident':[air(.19,.3),glass(.14,.3,.025)],
 'onnara-tax':[layer('lab-beep1.ogg',.20,.3),bell(.08,.3,.03)],'onnara-orb':[air(.2,.35),bell(.1,.5,.04)],'onnara-hover':[cloth(.23,.4),air(.12,.35,.04)],'onnara-chain':[bell(.12,.5),glass(.12,.3,.05)],
 recon:[bell(.12,.5),page(.14,.24,.08)],veil:[cloth(.27,.5),air(.18,.4,.08)],'ember-warning':[layer('onjin-latch.ogg',.17,.2),air(.15,.3,.08)],
 'round-win':[pluck('07',.18,.85)],'round-loss':[pluck('16',.16,.85)],'match-win':[pluck('07',.23,1.6)],'match-loss':[pluck('16',.20,1.6)]
});
export function createGameAudio(){
  let context=null,active=0,loading=false,sampleSequence=0;const buffers=new Map(),samples=new Map();
  const recordings={step:{files:['footstep_concrete_000.ogg','footstep_concrete_001.ogg'],gain:.20,length:.30},land:{files:['impactSoft_heavy_000.ogg'],gain:.25,rate:.9,length:.40}};
  const profiles={
    classic:{frequency:1750,body:125,length:.15,gain:.28},ghost:{frequency:1250,body:95,length:.13,gain:.23},
    spectre:{frequency:2200,body:145,length:.12,gain:.27},phantom:{frequency:1500,body:105,length:.16,gain:.29},
    vandal:{frequency:2900,body:155,length:.20,gain:.36},knife:{frequency:1200,body:0,length:.13,gain:.15}
  };
  function init(){
    try{context||=new (window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')context.resume()?.catch?.(()=>{});loadSamples();}catch{}
  }
  function loadSamples(){
    // Sample effects never queue or synthesize on loading/decode failure.
    if(loading||!context||typeof window==='undefined'||typeof window.fetch!=='function'||typeof context.decodeAudioData!=='function')return;
    loading=true;
    const files=new Set([...Object.values(recordings).flatMap(recording=>recording.files),...Object.values(SAMPLE_CUES).flatMap(layers=>layers.map(layer=>layer.file))]);
    for(const file of files)Promise.resolve().then(()=>window.fetch(new URL(`./audio/${file}`,import.meta.url).href,{cache:'force-cache',credentials:'same-origin'}))
      .then(response=>{if(!response.ok)throw new Error('Sample unavailable');return response.arrayBuffer();})
      .then(bytes=>context.decodeAudioData(bytes)).then(decoded=>{
        if(!decoded?.length||!Number.isFinite(decoded.duration)||decoded.duration>12||decoded.numberOfChannels<1||decoded.numberOfChannels>8)throw new Error('Invalid sample');
        // A mono point source keeps the same left/right location as all synthetic cues.
        const mono=context.createBuffer(1,decoded.length,decoded.sampleRate),data=mono.getChannelData(0);
        for(let channel=0;channel<decoded.numberOfChannels;channel++){
          const source=decoded.getChannelData(channel);
          for(let i=0;i<data.length;i++)data[i]+=source[i]/decoded.numberOfChannels;
        }
        let peak=0;for(const value of data){if(!Number.isFinite(value))throw new Error('Invalid sample');peak=Math.max(peak,Math.abs(value));}
        if(peak>.85)for(let i=0;i<data.length;i++)data[i]*=.85/peak;
        samples.set(file,mono);
      }).catch(()=>{});
  }
  function noise(length){
    if(buffers.has(length))return buffers.get(length);
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*length),context.sampleRate),data=buffer.getChannelData(0);
    let seed=127;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=((seed>>>0)/2147483648-1)*Math.exp(-i/(data.length*.19));}
    buffers.set(length,buffer);return buffer;
  }
  function play(type,{volume=.45,weapon='classic',pan=0,distance=0,occluded=false}={}){
    if(!context||context.state!=='running'||volume<=0||active>=48)return;
    const protectedSound=['shot','enemy','step','land'].includes(type);
    const recipe=Object.hasOwn(SAMPLE_CUES,type)?SAMPLE_CUES[type]:null;
    const layers=protectedSound?null:recipe?.filter(layer=>samples.has(layer.file));
    // Failed or not-yet-decoded samples stay silent: never queue a late cue or emit a beep.
    if(!protectedSound&&!layers?.length)return;
    const t=context.currentTime,out=context.createGain(),nodes=[out],sources=[];
    const attenuation=1/(1+Math.max(0,distance)*.11);
    out.gain.value=volume*attenuation*(occluded?.40:1);
    if(context.createStereoPanner){const panner=context.createStereoPanner();panner.pan.value=Math.max(-1,Math.min(1,pan));out.connect(panner);panner.connect(context.destination);nodes.push(panner);}else out.connect(context.destination);
    function tone(frequency,end,length,gain,wave='sine',delay=0){
      const osc=context.createOscillator(),amp=context.createGain();osc.type=wave;
      osc.frequency.setValueAtTime(frequency,t+delay);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+delay+length);
      amp.gain.setValueAtTime(gain,t+delay);amp.gain.exponentialRampToValueAtTime(.0001,t+delay+length);
      osc.connect(amp);amp.connect(out);osc.start(t+delay);osc.stop(t+delay+length);sources.push({source:osc,end:delay+length});nodes.push(osc,amp);
    }
    function hiss(length,frequency,gain,highpass=false,delay=0){
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),amp=context.createGain();source.buffer=noise(length);
      filter.type=highpass?'highpass':'lowpass';filter.frequency.value=frequency*(occluded?.55:1);filter.Q.value=.65;
      amp.gain.value=gain;source.connect(filter);filter.connect(amp);amp.connect(out);source.start(t+delay);sources.push({source,end:length+delay});nodes.push(source,filter,amp);
    }
    function recording(id){
      const spec=recordings[id],available=spec?.files.map(file=>samples.get(file)).filter(Boolean);if(!available?.length)return false;
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),amp=context.createGain();
      source.buffer=available[sampleSequence++%available.length];const rate=spec.rate||1,length=Math.min(source.buffer.duration/rate,spec.length||12);
      source.playbackRate.value=rate;filter.type='lowpass';filter.frequency.value=occluded?1600:id==='explosion'||id==='ember-impact'?3600:10000;filter.Q.value=.65;
      amp.gain.setValueAtTime(spec.gain,t);amp.gain.setValueAtTime(spec.gain,t+Math.max(0,length-.025));amp.gain.exponentialRampToValueAtTime(.0001,t+length);
      source.connect(filter);filter.connect(amp);amp.connect(out);source.start(t,0,length*rate);
      sources.push({source,end:length});nodes.push(source,filter,amp);return true;
    }
    if(type==='shot'||type==='enemy'){
      const spec=profiles[({pump:'vandal',drum:'vandal',scout:'vandal',atlas:'vandal',forge:'phantom'})[weapon]||weapon]||profiles.classic;
      hiss(spec.length,spec.frequency,spec.gain,weapon==='knife');
      if(spec.body)tone(spec.body,spec.body*.34,.12,spec.gain*.48,'triangle');
      if(weapon==='vandal'||weapon==='classic')hiss(.055,4300,.10,true);
    }else if(type==='step'||type==='land'){
      if(!recording(type)){hiss(type==='land'?.12:.075,660,type==='land'?.16:.10);tone(type==='land'?95:125,45,.065,type==='land'?.10:.045,'triangle');}
    }else{
      for(const layer of layers){
        const source=context.createBufferSource(),filter=context.createBiquadFilter(),amp=context.createGain();source.buffer=samples.get(layer.file);
        const {rate,length,gain,delay}=layer,duration=Math.min(source.buffer.duration/rate,length);
        source.playbackRate.value=rate;filter.type='lowpass';filter.frequency.value=occluded?1600:10000;filter.Q.value=.65;
        amp.gain.setValueAtTime(gain,t+delay);amp.gain.setValueAtTime(gain,t+delay+Math.max(0,duration-.025));amp.gain.exponentialRampToValueAtTime(.0001,t+delay+duration);
        source.connect(filter);filter.connect(amp);amp.connect(out);source.start(t+delay,0,duration*rate);sources.push({source,end:delay+duration});nodes.push(source,filter,amp);
      }
    }
    active++;const last=sources.reduce((a,b)=>a.end>b.end?a:b);let released=false;
    last.source.onended=()=>{if(released)return;released=true;for(const node of nodes)node.disconnect();active--;};
  }
  return {init,play};
}
