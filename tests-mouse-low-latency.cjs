const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))").replace('return { sandbox, run, seed, wall, clearWalls, reset, elements };','return {sandbox,run,reset,elements,emit:(type,event)=>{for(const fn of listeners.get(type)||[])fn(event)}};');
 const mod=new Module(path.join(__dirname,'mouse-latency-fixture.cjs'),module);mod.filename=path.join(__dirname,'mouse-latency-fixture.cjs');mod.paths=module.paths;mod.mutateGameSource=mutate;mod._compile(prefix+'\nreturn {harness};}\nmodule.exports=main;',mod.filename);
 const h=(await mod.exports()).harness(),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);let groups=0,time=1000;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);};
 function reset(){h.reset();h.run('mode="play";locked=true;document.pointerLockElement=canvas;resetMouseLook()');}
 function packet(type,dx,dy,extra={}){h.emit(type,{pointerType:'mouse',isPrimary:true,target:h.run('canvas'),clientX:400,clientY:300,movementX:dx,movementY:dy,timeStamp:time+=.125,...extra});}
 test('raw packets rotate before any frame; compatibility mousemove never doubles movement',()=>{
  reset();packet('pointerrawupdate',0,0);packet('mousemove',0,0);
  for(const [x,y]of [[1,2],[400,-200],[-400,200],[44,381],[-44,-381]]){const yaw=h.run('player.yaw'),pitch=h.run('player.pitch');packet('pointerrawupdate',x,y);near(h.run('player.yaw'),yaw-x*.0007);near(h.run('player.pitch'),pitch-y*.0007);near(h.run('camera.rotation.y'),h.run('player.yaw'));packet('mousemove',x,y);near(h.run('player.yaw'),yaw-x*.0007);near(h.run('player.pitch'),pitch-y*.0007);}
  assert.equal(h.run('mouseEventSource'),'pointerrawupdate');
 });
 test('coalesced raw delta is applied once, preserving a large horizontal flick',()=>{
  reset();packet('pointerrawupdate',0,0);packet('pointerrawupdate',1200,1,{getCoalescedEvents(){throw Error('aggregate must not be added twice');}});packet('mousemove',1200,1);near(h.run('player.yaw'),-.84);near(h.run('player.pitch'),-.0007);
  const yaw=h.run('player.yaw');packet('pointerrawupdate',NaN,1);packet('pointerrawupdate',1,Infinity);near(h.run('player.yaw'),yaw);
 });
 test('unsupported raw stream retains mousemove; starting raw delivery does not reset gain',()=>{
  reset();packet('mousemove',0,0);packet('mousemove',10,2);near(h.run('player.yaw'),-.007);assert.equal(h.run('mouseEventSource'),'mousemove');
  packet('pointerrawupdate',5,1);packet('mousemove',5,1);near(h.run('player.yaw'),-.0105);near(h.run('player.pitch'),-.0021);
 });
 test('touch, pen, secondary pointers and unlocked raw events do not steal desktop input',()=>{
  for(const extra of [{pointerType:'touch'},{pointerType:'pen'},{isPrimary:false},{sourceCapabilities:{firesTouchEvents:true}}]){reset();packet('pointerrawupdate',0,0,extra);packet('pointerrawupdate',20,20,extra);assert.equal(h.run('mouseEventSource'),'mousemove');near(h.run('player.yaw'),0);packet('mousemove',0,0);packet('mousemove',1,0);near(h.run('player.yaw'),-.0007);}
  reset();h.run('locked=false;document.pointerLockElement=null');packet('pointerrawupdate',10,10);assert.equal(h.run('mouseEventSource'),'mousemove');
  packet('mousemove',0,0);packet('mousemove',10,0,{clientX:410});near(h.run('player.yaw'),-.007);
 });
 test('pause, death, host pause and lock transitions reset or gate raw updates',()=>{
  for(const stop of ['pauseGame()','player.alive=false','netHostPaused=true']){reset();packet('pointerrawupdate',0,0);packet('pointerrawupdate',3,0);const yaw=h.run('player.yaw');h.run(stop);packet('pointerrawupdate',15,15);packet('mousemove',15,15);near(h.run('player.yaw'),yaw);}
  reset();packet('pointerrawupdate',0,0);packet('pointerrawupdate',1,0);h.run('document.pointerLockElement=null');h.emit('pointerlockchange');assert.equal(h.run('mouseEventSource'),'mousemove');assert.equal(h.run('mode'),'pause');
  h.run('mode="play";document.pointerLockElement=canvas');h.emit('pointerlockchange');packet('mousemove',0,0);packet('mousemove',2,0);near(h.run('player.yaw'),-.0021);
 });
 console.log(`PASS: ${groups} saved-game low-latency input groups (synthetic events, not physical Edge latency)`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
