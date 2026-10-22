// Bundled CC0 samples with procedural fallbacks; buffers are shared and voices release their nodes.
export function createGameAudio(){
  let context=null,active=0,loading=false,sampleSequence=0;const buffers=new Map(),samples=new Map();
  const recordings={
    step:{files:['footstep_concrete_000.ogg','footstep_concrete_001.ogg'],gain:.20,length:.30},
    land:{files:['impactSoft_heavy_000.ogg'],gain:.25,rate:.9,length:.40},
    reload:{files:['impactMetal_light_000.ogg'],gain:.22,rate:1.15,length:.24},
    hit:{files:['impactMetal_medium_000.ogg'],gain:.15,rate:1.2,length:.16},
    explosion:{files:['explosionCrunch_004.ogg'],gain:.48},
    'ember-impact':{files:['explosionCrunch_004.ogg'],gain:.16,rate:1.25,length:.35},
    frost:{files:['forceField_000.ogg'],gain:.14,rate:.8,length:.60},
    smoke:{files:['forceField_000.ogg'],gain:.20,rate:1.05,length:.75},
    updraft:{files:['forceField_003.ogg'],gain:.18,rate:1.35,length:.48},
    dash:{files:['forceField_003.ogg'],gain:.18,rate:1.8,length:.30}
  };
  // New cues use their own lookup, leaving the original footstep variation sequence intact.
  const cues={
    cloth:{file:'rpg-cloth4.ogg',gain:.65,length:.38},
    belt:{file:'rpg-beltHandle1.ogg',gain:.18,length:.28},
    latch:{file:'rpg-metalLatch.ogg',gain:.12,length:.26},
    click:{file:'interface-click_001.ogg',gain:.14,length:.16},
    confirm:{file:'interface-confirmation_002.ogg',gain:.14,length:.54},
    error:{file:'interface-error_003.ogg',gain:.12,length:.35},
    rise:{file:'interface-maximize_005.ogg',gain:.12,length:.53},
    down:{file:'interface-minimize_005.ogg',gain:.15,length:.53},
    pluck:{file:'interface-pluck_002.ogg',gain:.18,length:.17},
    field:{file:'scifi-forceField_001.ogg',gain:.12,length:.95},
    shimmer:{file:'scifi-forceField_004.ogg',gain:.10,length:.65},
    liquid:{file:'scifi-slime_000.ogg',gain:.20,length:.50},
    door:{file:'scifi-doorClose_001.ogg',gain:.10,length:.55},
    heal:{file:'jingle-STEEL00.ogg',gain:.12,length:1.6},
    win:{file:'jingle-STEEL07.ogg',gain:.14,length:1.6},
    loss:{file:'jingle-STEEL16.ogg',gain:.13,length:1.6}
  };
  const profiles={
    classic:{frequency:1750,body:125,length:.15,gain:.28},ghost:{frequency:1250,body:95,length:.13,gain:.23},
    spectre:{frequency:2200,body:145,length:.12,gain:.27},phantom:{frequency:1500,body:105,length:.16,gain:.29},
    vandal:{frequency:2900,body:155,length:.20,gain:.36},knife:{frequency:1200,body:0,length:.13,gain:.15}
  };
  function init(){
    try{context||=new (window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')context.resume()?.catch?.(()=>{});loadSamples();}catch{}
  }
  function loadSamples(){
    // Use the browser's own fetch only. Node smoke tests and unsupported codecs keep synthesis.
    if(loading||!context||typeof window==='undefined'||typeof window.fetch!=='function'||typeof context.decodeAudioData!=='function')return;
    loading=true;
    const files=new Set([...Object.values(recordings).flatMap(recording=>recording.files),...Object.values(cues).map(cue=>cue.file)]);
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
  function collapse(){
    const key='station-collapse';if(buffers.has(key))return buffers.get(key);
    const rate=context.sampleRate,buffer=context.createBuffer(1,Math.ceil(rate*2.8),rate),data=buffer.getChannelData(0);
    const impacts=[.12,.20,.31,.44,.60,.79,1.01,1.24];
    let seed=9271,low=0,mid=0,mean=0;
    const lowRate=1-Math.exp(-2*Math.PI*95/rate),midRate=1-Math.exp(-2*Math.PI*850/rate);
    for(let i=0;i<data.length;i++){
      seed=(Math.imul(seed,1664525)+1013904223)|0;const white=(seed>>>0)/2147483648-1,t=i/rate;
      low+=lowRate*(white-low);mid+=midRate*(white-mid);
      const attack=1-Math.exp(-t/.0035),body=attack*Math.exp(-t/.36);
      // A falling pressure wave leads; small, irregular impacts form the collapse.
      let value=body*(.43*Math.sin(2*Math.PI*(28*t+9.5*(1-Math.exp(-t/.22))))+.70*low);
      value+=attack*Math.exp(-t/.075)*(.14*white+.50*mid);
      for(let j=0;j<impacts.length;j++){
        const age=t-impacts[j];if(age<0||age>.24)continue;
        const envelope=(1-Math.exp(-age/.002))*Math.exp(-age/(.035+j*.004));
        value+=envelope*(1-j*.07)*(.33*(white-mid)+.75*mid+.12*Math.sin(2*Math.PI*(170+j*53)*age));
      }
      if(t>.32)value+=(low*.95+mid*.12)*Math.exp(-(t-.32)/.72)*(1-Math.exp(-(t-.32)/.10));
      data[i]=value;
    }
    // Sparse reflections are baked into the same mono buffer, preserving panning.
    const dry=data.slice(),echoes=[[.46,.19],[.79,.12],[1.13,.075]];
    for(let i=0;i<data.length;i++){
      for(const [delay,gain] of echoes){const offset=i-Math.round(delay*rate);if(offset>=0)data[i]+=dry[offset]*gain;}
      data[i]*=Math.min(1,(data.length-1-i)/(rate*.18));mean+=data[i];
    }
    mean/=data.length;let peak=0;
    for(let i=0;i<data.length;i++){data[i]-=mean;peak=Math.max(peak,Math.abs(data[i]));}
    // Leave headroom for other game cues without extra voices or delay nodes.
    const gain=peak>.0001?.68/peak:1;
    for(let i=0;i<data.length;i++)data[i]*=gain;
    buffers.set(key,buffer);return buffer;
  }
  function play(type,{volume=.45,weapon='classic',pan=0,distance=0,occluded=false}={}){
    if(!context||context.state!=='running'||volume<=0||active>=48)return;
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
    function sample(id,{delay=0,gain=1,rate=1,length=12}={}){
      const spec=cues[id],buffer=spec&&samples.get(spec.file);if(!buffer)return false;
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),amp=context.createGain();
      source.buffer=buffer;const speed=rate,duration=Math.min(buffer.duration/speed,spec.length,length),level=spec.gain*gain;
      source.playbackRate.value=speed;filter.type='lowpass';filter.frequency.value=occluded?1600:10000;filter.Q.value=.65;
      amp.gain.setValueAtTime(level,t+delay);amp.gain.setValueAtTime(level,t+delay+Math.max(0,duration-.025));amp.gain.exponentialRampToValueAtTime(.0001,t+delay+duration);
      source.connect(filter);filter.connect(amp);amp.connect(out);source.start(t+delay,0,duration*speed);
      sources.push({source,end:delay+duration});nodes.push(source,filter,amp);return true;
    }
    if(type==='shot'||type==='enemy'){
      const spec=profiles[weapon]||profiles.classic;
      hiss(spec.length,spec.frequency,spec.gain,weapon==='knife');
      if(spec.body)tone(spec.body,spec.body*.34,.12,spec.gain*.48,'triangle');
      if(weapon==='vandal'||weapon==='classic')hiss(.055,4300,.10,true);
    }else if(type==='step'||type==='land'){
      if(!recording(type)){hiss(type==='land'?.12:.075,660,type==='land'?.16:.10);tone(type==='land'?95:125,45,.065,type==='land'?.10:.045,'triangle');}
    }else if(type==='reload'){
      if(!recording(type)){hiss(.07,2300,.13,true);tone(360,180,.06,.035,'square');}
    }else if(type==='spike'){
      tone(880,880,.065,.095);tone(1320,1320,.055,.045,'sine',.075);
    }else if(type==='plant'||type==='defuse'){
      const mechanical=sample('latch',{gain:type==='plant'?1:.7,rate:type==='plant'?1:.85});
      const signal=sample(type==='plant'?'confirm':'down',{delay:.12});
      if(!mechanical)hiss(.1,1600,.05,false,.1);
      if(!signal)tone(type==='plant'?330:660,type==='plant'?700:330,.25,.12,'triangle');
    }else if(type==='buy'){
      if(!sample('click'))tone(520,520,.06,.04);
      if(!sample('belt',{delay:.04}))hiss(.07,2300,.05,true);
    }else if(type==='skill-throw'){
      if(!sample('cloth'))hiss(.14,2400,.06,true);
      sample('belt',{delay:.035,gain:.5});
    }else if(type==='bottle-pop'){
      if(!sample('liquid'))hiss(.18,1900,.14);
      if(!sample('shimmer',{delay:.025,gain:.8,rate:1.3,length:.35}))hiss(.12,4200,.045,true,.025);
      tone(95,38,.20,.06,'triangle');
    }else if(type==='flash'){
      if(!sample('shimmer',{rate:1.2}))hiss(.28,4300,.08,true);
      if(!sample('pluck',{delay:.045,gain:.6}))tone(1300,2200,.14,.035,'sine',.045);
    }else if(type==='decoy'){
      if(!sample('door',{rate:1.4,length:.3}))hiss(.14,1600,.06);
      if(!sample('rise',{delay:.045,gain:.7}))tone(330,650,.2,.035,'triangle',.045);
    }else if(type==='takeover'){
      if(!sample('door',{gain:1.2,rate:.8}))hiss(.25,900,.08);
      if(!sample('liquid',{delay:.06,gain:.8}))hiss(.25,2400,.06,true,.06);
      if(!sample('field',{delay:.14,gain:.8,rate:.85}))tone(180,90,.65,.06,'triangle',.14);
    }else if(type==='explosion'){
      const imported=recording(type),source=context.createBufferSource(),filter=context.createBiquadFilter();source.buffer=collapse();
      filter.type='lowpass';filter.frequency.value=occluded?1100:3600;filter.Q.value=.65;
      source.connect(filter);
      if(imported){const amp=context.createGain();amp.gain.value=.38;filter.connect(amp);amp.connect(out);nodes.push(amp);}else filter.connect(out);
      source.start(t);
      sources.push({source,end:source.buffer.duration});nodes.push(source,filter);
    }else if(type==='ember-impact'){
      if(!recording(type)){hiss(.20,1900,.15);tone(105,38,.22,.11,'triangle');}
    }else if(type==='frost'){
      if(!recording(type))hiss(.30,4500,.10,true);
      tone(1600,2850,.18,.028,'sine',.035);
    }else if(type==='seed-bloom'){
      if(!sample('pluck')){hiss(.18,2900,.055,true);tone(240,480,.13,.032,'triangle');tone(640,430,.11,.025,'sine',.08);}
      else sample('cloth',{delay:.035,gain:.3,rate:1.2});
    }else if(type==='pollen'){
      if(!sample('field',{gain:.8,rate:1.15,length:.65})){hiss(.4,2100,.10,true);tone(290,580,.28,.033,'sine');}
      else sample('pluck',{delay:.12,gain:.4,rate:.85});
    }else if(type==='flower-heal'||type==='heal'){
      if(!sample('heal',{gain:type==='heal'?1:.8})){tone(523,523,.15,.05,'sine');tone(659,659,.17,.045,'sine',.09);tone(784,1046,.22,.04,'sine',.18);}
      else sample('pluck',{delay:.1,gain:.5,rate:1.25});
    }else if(type==='echo-tag-set'){
      if(!sample('latch',{gain:.65,rate:1.25,length:.16}))hiss(.065,2100,.035,true);
      if(!sample('pluck',{delay:.035,gain:.45,rate:.9,length:.14}))tone(580,440,.12,.026,'triangle',.035);
    }else if(type==='echo-tag-detect'){
      if(!sample('pluck',{gain:.65,rate:1.3,length:.12}))tone(880,880,.10,.036);
      if(!sample('pluck',{delay:.085,gain:.5,rate:1.65,length:.12}))tone(1174,1174,.12,.028,'sine',.085);
    }else if(type==='echo-glint'){
      if(!sample('shimmer',{gain:.8,rate:1.5,length:.30}))hiss(.22,4100,.05,true);
      if(!sample('pluck',{delay:.025,gain:.4,rate:1.55,length:.12}))tone(1568,2200,.13,.025,'sine',.025);
    }else if(type==='echo-kerning'){
      if(!sample('cloth',{gain:.23,rate:1.25,length:.20}))hiss(.17,2200,.045,true);
      if(!sample('rise',{delay:.025,gain:.45,rate:1.3,length:.24}))tone(300,540,.19,.028,'triangle',.025);
    }else if(type==='grass-dust'){
      if(!sample('cloth',{gain:.4,rate:.75,length:.32}))hiss(.28,1400,.07);
      if(!sample('liquid',{delay:.045,gain:.18,rate:.8,length:.20}))tone(135,70,.14,.024,'triangle',.045);
    }else if(type==='grass-roots'){
      if(!sample('liquid',{gain:.55,rate:.72,length:.30}))hiss(.22,950,.048);
      if(!sample('pluck',{delay:.06,gain:.28,rate:.62,length:.12}))hiss(.08,2100,.022,true,.06);
    }else if(type==='grass-turf'){
      if(!sample('cloth',{gain:.25,rate:1.4,length:.17}))hiss(.16,2800,.044,true);
      if(!sample('rise',{delay:.025,gain:.32,rate:1.6,length:.18}))tone(330,560,.16,.022,'triangle',.025);
    }else if(type==='solder-pop'){
      if(!sample('latch',{gain:.55,rate:1.6,length:.12}))hiss(.075,3200,.036,true);
      if(!sample('shimmer',{delay:.018,gain:.6,rate:1.8,length:.20}))tone(1480,720,.16,.024,'triangle',.018);
    }else if(type==='shade-check'){
      if(!sample('click',{gain:.6,rate:1.3,length:.10}))tone(980,820,.07,.025,'triangle');
      if(!sample('shimmer',{delay:.025,gain:.35,rate:1.6,length:.22}))tone(1700,2100,.16,.018,'sine',.025);
    }else if(type==='quick-solder'){
      if(!sample('latch',{gain:.5,rate:1.15,length:.16}))hiss(.10,2700,.034,true);
      if(!sample('cloth',{delay:.045,gain:.18,rate:1.4,length:.22}))hiss(.19,1900,.024,true,.045);
    }else if(type==='frost-stitch'){
      if(!sample('click',{gain:.35,rate:1.5,length:.10}))hiss(.065,3200,.025,true);
      if(!sample('pluck',{delay:.035,gain:.5,rate:1.45,length:.15}))tone(1320,1760,.13,.023,'sine',.035);
    }else if(type==='frost-mist'){
      if(!sample('field',{gain:.45,rate:1.35,length:.45}))hiss(.40,2600,.06,true);
      if(!sample('cloth',{delay:.035,gain:.12,rate:.9,length:.20}))hiss(.16,1500,.022,true,.035);
    }else if(type==='frost-unravel'){
      if(!sample('cloth',{gain:.2,rate:1.4,length:.22}))hiss(.19,2500,.035,true);
      if(!sample('pluck',{delay:.035,gain:.25,rate:1.25,length:.15}))tone(740,1110,.13,.020,'sine',.035);
    }else if(type==='nobi-tag'||type==='nobi-brake'||type==='nobi-tool'||type==='nobi-legend'){
      if(!sample(type==='nobi-tool'?'door':type==='nobi-legend'?'shimmer':'pluck',{gain:.32,rate:type==='nobi-brake'?.65:1.2,length:.25}))tone(400,700,.2,.03,'sine');
    }else if(type==='car-bumper'){
      if(!sample('door',{gain:.28,rate:.65,length:.22}))tone(160,90,.2,.035,'triangle');
    }else if(type==='car-wash'){
      if(!sample('shimmer',{gain:.3,rate:1.4,length:.3}))tone(800,200,.25,.025,'sine');
    }else if(type==='car-gyro'){
      if(!sample('pluck',{gain:.3,rate:.85,length:.2}))tone(240,480,.2,.03,'sine');
    }else if(type==='car-pit'){
      if(!sample('heal',{gain:.4,rate:1.15,length:.4}))tone(400,950,.3,.035,'triangle');
    }else if(type==='cat-bookmark'||type==='cat-return'){
        if(!sample('pluck',{gain:.4,rate:type==='cat-return'?.7:1.4,length:.2}))tone(660,330,.2,.035,'sine');
      }else if(type==='cat-pluck'){
        if(!sample('cloth',{gain:.35,rate:1.3,length:.15}))hiss(.14,1200,.03,true);
      }else if(type==='cat-fetch'){
        if(!sample('pluck',{gain:.4,rate:.9,length:.2}))tone(440,880,.2,.035,'triangle');
      }else if(type==='cat-clock'){
        if(!sample('shimmer',{gain:.5,rate:.6,length:.45}))tone(330,165,.4,.04,'sine');
      }else if(type==='duck-seal'){
      if(!sample('pluck',{gain:.5,rate:.75,length:.16}))tone(880,440,.16,.04,'triangle');
    }else if(type==='duck-shield'){
      if(!sample('shimmer',{gain:.45,rate:.85,length:.3}))tone(330,990,.25,.04,'sine');
    }else if(type==='duck-hush'){
      if(!sample('cloth',{gain:.2,rate:.7,length:.2}))hiss(.18,1500,.025,true);
    }else if(type==='duck-egg'){
      if(!sample('shimmer',{gain:.6,rate:.65,length:.45}))tone(220,880,.4,.04,'sine');
    }else if(type==='duelist-comet'){
      if(!sample('field',{gain:.55,rate:1.5,length:.28}))hiss(.25,3100,.055,true);
      if(!sample('pluck',{delay:.025,gain:.27,rate:1.5,length:.12}))tone(1046,1568,.11,.021,'sine',.025);
    }else if(type==='duelist-lift'){
      if(!sample('rise',{gain:.45,rate:1.6,length:.22}))hiss(.20,3400,.045,true);
      if(!sample('shimmer',{delay:.025,gain:.30,rate:1.5,length:.18}))tone(620,1240,.17,.022,'sine',.025);
    }else if(type==='recon'){
      if(!sample('shimmer',{gain:.8,rate:1.35}))hiss(.25,3800,.07,true);
      tone(660,660,.10,.04,'sine',.08);tone(1320,1320,.10,.035,'sine',.30);
    }else if(type==='veil'){
      if(!sample('field',{rate:.8})){hiss(.6,1300,.13,true);tone(220,65,.45,.04,'triangle');}
      else sample('cloth',{delay:.08,gain:.35,rate:.8});
    }else if(type==='ember-warning'){
      if(!sample('latch',{gain:.6}))hiss(.09,2800,.06,true);
      if(!sample('shimmer',{delay:.10,rate:.8,gain:.8}))hiss(.3,1700,.07,true,.10);
      tone(160,320,.32,.035,'triangle');
    }else if(type==='smoke'){
      if(!recording(type)){hiss(.36,1700,.20,true);tone(240,70,.26,.06,'triangle');}
    }else if(type==='updraft'){
      if(!recording(type)){hiss(.28,3300,.18,true);tone(180,750,.24,.07,'sine');}
    }else if(type==='dash'){
      if(!recording(type)){hiss(.22,4100,.24,true);tone(260,60,.18,.08,'triangle');}
    }else if(type==='dash-armed'){
      tone(300,520,.13,.07,'sine');hiss(.09,2400,.04,true);
    }else if(type==='dash-ready'){
      tone(660,660,.09,.07);tone(990,990,.12,.07,'sine',.09);
    }else if(type==='dash-expired'){
      tone(390,230,.16,.045,'sine');
    }else if(type==='knives'){
      for(let i=0;i<3;i++)tone(780+i*260,1100+i*260,.18,.065,'sine',i*.07);
      hiss(.16,5000,.09,true);
    }else if(type==='hit'){
      if(!recording(type)){tone(570,360,.08,.10);hiss(.04,3200,.045,true);}
    }else if(type==='kill'){
      tone(660,660,.12,.12,'sine');tone(990,1320,.18,.10,'sine',.075);
    }else if(type==='round-win'||type==='round-loss'||type==='match-win'||type==='match-loss'){
      const won=type.endsWith('win'),final=type.startsWith('match');
      if(!sample(won?'win':'loss',{gain:final?1:.7,rate:final?1:1.05,length:final?1.6:.75})){
        tone(won?523:440,won?784:220,.24,.08,'triangle');tone(won?1046:330,won?1046:165,.24,.05,'sine',.14);
      }
      sample(won?'confirm':'error',{delay:.06,gain:final?.65:.4});
    }else{
      tone(420,190,.18,.09,'triangle');tone(700,360,.12,.04,'sine',.04);
    }
    active++;const last=sources.reduce((a,b)=>a.end>b.end?a:b);
    last.source.onended=()=>{for(const node of nodes)node.disconnect();active--;};
  }
  return {init,play};
}
