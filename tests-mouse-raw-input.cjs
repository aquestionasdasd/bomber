const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))").replace('return { sandbox, run, seed, wall, clearWalls, reset, elements };','return { sandbox, run, seed, wall, clearWalls, reset, elements, emit:(type,event)=>{for(const listener of listeners.get(type)||[])listener(event)} };');
 const mod=new Module(path.join(__dirname,'mouse-raw-harness.cjs'),module);mod.filename=path.join(__dirname,'mouse-raw-harness.cjs');mod.paths=module.paths;mod.mutateGameSource=mutate;
 mod._compile(prefix+'\n return {harness};\n}\nmodule.exports=main;',mod.filename);const {harness}=await mod.exports();
 const h=harness();let groups=0;const test=async(name,fn)=>{if(!only(name))return;await fn();groups++;console.log('PASS: '+name)};
 const settle=async()=>{for(let i=0;i<6;i++)await Promise.resolve()};
 const copy=x=>JSON.parse(JSON.stringify(x)),near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,label+': '+a+' != '+b);
 function setup(request){h.reset();h.run('document.pointerLockElement=null;locked=false;resetMouseLook();match.phase="buy"');h.sandbox.captureRequest=request;h.run('canvas.requestPointerLock=captureRequest');}
 function move(dx,dy,time){h.sandbox.sample={clientX:394,clientY:773,movementX:dx,movementY:dy,timeStamp:time};h.run('mouseLook({...sample,target:canvas})');}
 await test('desktop requests unadjusted movement and records confirmed raw lock',async()=>{
  const calls=[];setup(options=>{calls.push(copy(options));h.run('document.pointerLockElement=canvas;locked=true');return Promise.resolve()});
  h.run('requestLock()');await settle();assert.deepEqual(calls,[{unadjustedMovement:true}]);assert.equal(h.run('pointerLockInput'),'raw');
 });
 await test('unsupported raw movement falls back once to normal pointer lock',async()=>{
  const calls=[];setup(options=>{calls.push(options===undefined?null:copy(options));if(options)return Promise.reject(Object.assign(Error('raw unavailable'),{name:'NotSupportedError'}));h.run('document.pointerLockElement=canvas;locked=true');return Promise.resolve()});
  h.run('requestLock()');await settle();assert.deepEqual(calls,[{unadjustedMovement:true},null]);assert.equal(h.run('pointerLockInput'),'adjusted');
 });
 await test('synchronous unsupported option and legacy void implementation remain usable',async()=>{
  const calls=[];setup(options=>{calls.push(options===undefined?null:copy(options));if(options)throw Object.assign(Error('raw unavailable'),{name:'NotSupportedError'});h.run('document.pointerLockElement=canvas;locked=true')});
  h.run('requestLock()');await settle();assert.deepEqual(calls,[{unadjustedMovement:true},null]);assert.equal(h.run('pointerLockInput'),'legacy-unconfirmed');
  setup(()=>{h.run('document.pointerLockElement=canvas;locked=true')});h.run('requestLock()');await settle();assert.equal(h.run('pointerLockInput'),'legacy-unconfirmed');
 });
 await test('permission denial and failed fallback do not retry or break unlocked mouse look',async()=>{
  for(const name of ['NotAllowedError','SecurityError','AbortError']){let calls=0;setup(()=>{calls++;return Promise.reject(Object.assign(Error('denied'),{name}))});h.run('requestLock()');await settle();assert.equal(calls,1);assert.equal(h.run('inputActive'),true);assert.equal(h.run('pointerLockInput'),'unlocked');move(0,0,1000);h.sandbox.sample={clientX:395,clientY:772,movementX:1,movementY:-1,timeStamp:1008};h.run('mouseLook({...sample,target:canvas})');near(h.run('player.pitch'),.0007,'unlocked fallback gain');}
  let calls=0;setup(()=>{calls++;return Promise.reject(Object.assign(Error('unsupported'),{name:'NotSupportedError'}))});h.run('requestLock()');await settle();assert.equal(calls,2);assert.equal(h.run('pointerLockInput'),'unlocked');
 });
 await test('pause, menu, death and newer requests cancel stale raw fallback and status',async()=>{
  for(const stop of ['pauseGame()','backMenu()','player.alive=false','clearCombatInput()']){let reject,calls=0;setup(()=>{calls++;return new Promise((a,b)=>{reject=b})});h.run('requestLock()');h.run(stop);reject(Object.assign(Error('late'),{name:'NotSupportedError'}));await settle();assert.equal(calls,1,stop);}
  let reject,calls=0;setup(()=>{calls++;if(calls===1)return new Promise((a,b)=>{reject=b});h.run('document.pointerLockElement=canvas;locked=true');return Promise.resolve()});h.run('requestLock();requestLock()');await settle();reject(Object.assign(Error('old'),{name:'NotSupportedError'}));await settle();assert.equal(calls,2);assert.equal(h.run('pointerLockInput'),'raw');
 });
 await test('coarse touch requests no pointer lock and high rate flicks retain full gain',async()=>{
  let calls=0;setup(()=>{calls++});h.sandbox.navigator.maxTouchPoints=1;h.sandbox.matchMedia=()=>({matches:true});h.run('requestLock()');assert.equal(calls,0);h.sandbox.navigator.maxTouchPoints=0;h.sandbox.matchMedia=()=>({matches:false});
  for(const hz of [125,1000,8000]){setup(()=>{h.run('document.pointerLockElement=canvas;locked=true');return Promise.resolve()});h.run('requestLock()');await settle();move(0,0,1000);let t=1000;for(const [x,y]of [[1,2],[400,-200],[-400,200],[44,381],[-44,-381]]){const before=copy(h.run('[player.yaw,player.pitch]'));t+=1000/hz;move(x,y,t);near(h.run('player.yaw'),before[0]-x*.0007,'fast X');near(h.run('player.pitch'),before[1]-y*.0007,'fast Y');}h.run('updatePlay(1/144);renderWithDetonation(0)');near(h.run('camera.rotation.x'),h.run('player.pitch'),'rendered pitch');}
 });
 await test('real lock/error event handlers preserve acquisition, pause on release and unlock legacy failures',async()=>{
  let reject,calls=0;setup(()=>{calls++;if(calls===1)return new Promise((a,b)=>{reject=b});h.run('document.pointerLockElement=canvas');h.emit('pointerlockchange');return Promise.resolve()});h.run('inputActive=false;requestLock()');h.emit('pointerlockerror');assert.equal(h.run('inputActive'),false,'wait for the Promise result');reject(Object.assign(Error('unsupported'),{name:'NotSupportedError'}));await settle();assert.equal(calls,2);assert.equal(h.run('pointerLockInput'),'adjusted');assert.equal(h.run('locked'),true);move(0,0,1000);move(1,2,1008);const anchor=h.run('mouseAnchor');h.emit('pointerlockerror');assert.equal(h.run('mouseAnchor'),anchor,'late error cannot reset a granted lock');h.run('document.pointerLockElement=null');h.emit('pointerlockchange');assert.equal(h.run('mode'),'pause');assert.equal(h.run('pointerLockInput'),'unlocked');
  setup(()=>{});h.run('inputActive=false;requestLock()');h.emit('pointerlockerror');assert.equal(h.run('pointerLockInput'),'unlocked');assert.equal(h.run('inputActive'),true);
 });
 await test('opt-in diagnostic reports lock backend and stays local; normal trace disabled',async()=>{
  assert.equal(h.run('mouseInputTrace'),null);
  const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
  mod.mutateGameSource=s=>mutate(s).replace("typeof location!=='undefined'&&new URLSearchParams(location.search).has('inputTrace')",'true');mod._compile(prefix+'\n return {harness};\n}\nmodule.exports=main;',mod.filename);const traced=(await mod.exports()).harness();traced.reset();traced.run('pointerLockInput="raw";flushMouseInputTrace()');const report=JSON.parse(traced.elements.get('mouse-input-diagnostics').textContent);assert.equal(report.pointerLockInput,'raw');assert.equal(report.columns.length,18);
  const start=source.indexOf('function flushMouseInputTrace'),end=source.indexOf('function look(',start);assert.doesNotMatch(source.slice(start,end),/fetch\(|localStorage|online\.send|console\./);
 });
 console.log(`PASS: ${groups} raw pointer input saved-game groups; no audio`);return {groups};
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
