const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main(){
 const base=fs.readFileSync(path.join(__dirname,'tests-audio.cjs'),'utf8'),cut=base.indexOf('async function main(){');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'gunshot-spatial-harness.cjs'),module);mod.filename=path.join(__dirname,'gunshot-spatial-harness.cjs');mod.paths=module.paths;mod._compile(base.slice(0,cut)+'\nmodule.exports={Context,decodedSample,settle};',mod.filename);const{Context,decodedSample,settle}=mod.exports;
 const old=global.window,{createGameAudio,SAMPLE_CUES}=await import('./public/audio.js');let groups=0;const check=(name,fn)=>{fn();groups++;console.log('PASS: '+name)},near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
 try{
  class Ready extends Context{decodeAudioData(bytes){return Promise.resolve(decodedSample(Buffer.from(bytes).toString()))}}
  global.window={AudioContext:Ready,fetch:async url=>({ok:true,arrayBuffer:async()=>Uint8Array.from(Buffer.from(path.basename(new URL(url).pathname))).buffer})};const audio=createGameAudio();audio.init();await settle();const ctx=Context.current;
  function voice(type,options){const ns=ctx.nodes.length,ss=ctx.sources.length;audio.play(type,options);const nodes=ctx.nodes.slice(ns),sources=ctx.sources.slice(ss);assert.ok(sources.length);const result={gain:nodes[0].gain.value,pan:nodes.find(n=>n.kind==='panner').pan.value,frequency:sources[0].connections[0].frequency.value,files:sources.map(s=>s.buffer),rates:sources.map(s=>s.playbackRate.value),starts:sources.map(s=>s.started),durations:sources.map(s=>s.duration)};sources.forEach(s=>s.end());assert.ok(nodes.every(n=>n.disconnects===1));return result}
  const guns=['classic','ghost','spectre','phantom','vandal','pump','drum','scout','atlas','forge'];
  check('all10 firearms carry at30/50/66/80m and walls retain70percent with3200Hz muffling',()=>{
   for(const type of ['shot','enemy'])for(const weapon of guns)for(const distance of [0,10,30,50,66,80]){const open=voice(type,{weapon,distance,volume:.45,pan:-.6}),wall=voice(type,{weapon,distance,volume:.45,pan:.6,occluded:true});near(open.gain,.45/(1+distance*.035));near(wall.gain/open.gain,.7);assert.equal(wall.frequency,3200);assert.equal(open.frequency,10000);assert.equal(open.pan,-.6);assert.equal(wall.pan,.6);assert.deepEqual(open.rates,SAMPLE_CUES['weapon-'+weapon].map(s=>s.rate));assert.deepEqual(wall.starts,open.starts)}
  });
  check('80to100m fade is continuous and monotonic, never adds a distant constant loudness floor',()=>{
   let previous=Infinity;for(const distance of [79,80,80.01,85,90,95,99,99.9,100,101]){const v=voice('enemy',{weapon:'vandal',distance,volume:1});assert.ok(v.gain<=previous);previous=v.gain;near(v.gain,Math.max(0,Math.min(1,(100-distance)/20))/(1+distance*.035));}assert.equal(previous,0);
  });
  check('nearby/self level and collaborator sample recipe are unchanged; footsteps and knife retain their old curve',()=>{
   for(const weapon of guns){const own=voice('shot',{weapon,volume:.45,distance:0});near(own.gain,.45);assert.equal(own.frequency,10000)}
   for(const type of ['step','land','shot','enemy','plant'])for(const occluded of [false,true]){const v=voice(type,{weapon:'knife',distance:30,volume:.45,occluded});near(v.gain,.45/(1+30*.11)*(occluded?.4:1));assert.equal(v.frequency,occluded?1600:10000)}
  });
  check('actual gain increase is bounded by unchanged near level, with2to4times the distant signal',()=>{
   for(const distance of [30,50]){const open=voice('enemy',{weapon:'vandal',distance,volume:.45}),wall=voice('enemy',{weapon:'vandal',distance,volume:.45,occluded:true}),oldOpen=.45/(1+distance*.11),oldWall=oldOpen*.4;assert.ok(open.gain/oldOpen>2&&open.gain/oldOpen<2.4);assert.ok(wall.gain/oldWall>3.5&&wall.gain/oldWall<4.2);assert.ok(open.gain<.45&&wall.gain<open.gain)}
  });
  check('master zero and suspended context create no voices, no queued playback',()=>{const count=ctx.sources.length;audio.play('enemy',{weapon:'vandal',distance:30,volume:0});ctx.state='suspended';audio.play('enemy',{weapon:'vandal',distance:30});assert.equal(ctx.sources.length,count);ctx.state='running';assert.equal(ctx.sources.length,count)});
  console.log(`PASS: ${groups} recorded gunshot spatial mock groups; no audio output`);
 }finally{if(old===undefined)delete global.window;else global.window=old}
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
