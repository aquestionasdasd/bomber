const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const mod=new Module(path.join(__dirname,'mouse-continuity-harness.cjs'),module);mod.filename=path.join(__dirname,'mouse-continuity-harness.cjs');mod.paths=module.paths;mod.mutateGameSource=mutate;mod._compile(prefix+'\n return {harness};\n}\nmodule.exports=main;',mod.filename);
 const {harness}=await mod.exports(),p=harness();let groups=0,failures=[];
 const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-8,`${msg}: ${a} != ${b}`);
 const test=(name,fn)=>{if(!only(name))return;try{fn();groups++;console.log('PASS: '+name);}catch(e){failures.push(name);console.error('FAIL: '+name+' / '+e.message);}};
 function reset(phase='buy'){p.reset();p.run(`locked=false;document.pointerLockElement=null;player.yaw=0;player.pitch=0;resetMouseLook();match.phase=${JSON.stringify(phase)};`);}
 const aim=()=>p.run('[player.yaw,player.pitch]');
 function move(x,y,mx,my,t){p.sandbox.e={clientX:x,clientY:y,movementX:mx,movementY:my,timeStamp:t};p.run('mouseLook({...e,target:canvas})');}
 function render(){p.run('updatePlay(1/144);renderWithDetonation(0)');const pitch=p.run('player.pitch'),yaw=p.run('player.yaw'),d=p.run('camera.getWorldDirection(new THREE.Vector3()).toArray()');near(d[0],-Math.sin(yaw)*Math.cos(pitch),'actual facing X');near(d[1],Math.sin(pitch),'actual facing Y');near(d[2],-Math.cos(yaw)*Math.cos(pitch),'actual facing Z');}
 test('first vertical recenter after verified horizontal motion never changes pitch in buy/live',()=>{
  for(const phase of ['buy','live']){reset(phase);move(400,300,0,0,1000);move(410,300,10,0,1008);const before=aim();move(411,480,1,1,1016);near(aim()[1],before[1],'stationary vertical axis must inherit verified stream');near(aim()[0],before[0]-.0007,'healthy X');move(412,302,1,1,1024);near(aim()[1],before[1]-.0007,'return keeps real motion');render();}
 });
 test('fractional or coalesced small disagreement cannot erase proven relative stream',()=>{
  for(const [delta,rel]of [[1,2],[.5,2],[2,1],[-1,0]]){reset();move(400,300,0,0,2000);move(401,301,1,1,2008);move(401+delta,301+delta,rel,rel,2016);const before=aim();move(402+delta,481+delta,1,1,2024);near(aim()[1],before[1],'quantization followed by recenter');move(403+delta,303+delta,1,1,2032);near(aim()[1],before[1]-.0007,'return after quantization');render();}
 });
 test('idle coordinate reseed preserves channel evidence through recenter and return',()=>{
  reset();move(400,300,0,0,3000);move(401,301,1,1,3008);const before=aim();move(402,480,1,1,3400);near(aim()[1],before[1],'idle first sample remains a baseline');move(403,303,1,1,3408);near(aim()[1],before[1],'return after idle baseline cannot snap');move(404,304,1,1,3416);near(aim()[1],before[1]-.0007,'normal next pixel immediate');render();
 });
 test('repeated independent-axis warps keep real horizontal gain across frame rates and all yaw directions',()=>{
  for(const hz of [20,60,144])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){reset();p.sandbox.yaw=yaw;p.run('player.yaw=yaw');move(400,300,0,0,4000);move(401,301,1,1,4008);let x=401,y=301,t=4008;for(let i=0;i<20;i++){const before=aim();x++;y+=160;t+=8;move(x,y,1,1,t);near(aim()[1],before[1],'warp pitch');x++;y-=158;t+=8;move(x,y,1,1,t);near(aim()[1],before[1]-.0007,'physical return');p.run(`updatePlay(${1/hz})`);}render();}
 });
 test('genuine flick, 1:1 and fractional-coordinate gain, reversals and broken relative fallback remain immediate',()=>{
  for(const scale of [1,.5]){reset();move(400,300,0,0,5000);move(400+scale,300+scale,1,1,5008);move(400+101*scale,300-49*scale,100,-50,5016);near(aim()[0],-101*scale*.0007,'full X gain');near(aim()[1],49*scale*.0007,'full Y gain');render();}
  reset();move(400,300,9000,9000,6000);move(430,280,9000,9000,6008);near(aim()[0],-30*.0007,'broken relative X falls back');near(aim()[1],20*.0007,'broken relative Y falls back');
 });
 test('resize, focus reset, viewport changes and lock transition clear old coordinate evidence',()=>{
  for(const change of ['resetMouseLook()','innerHeight=901','innerWidth=1441']){reset();move(400,300,0,0,7000);move(401,301,1,1,7008);const before=aim();p.run(change);move(650,450,249,149,7016);assert.deepEqual(aim(),before);move(651,451,1,1,7024);near(aim()[1],before[1]-.0007,'new viewport gain');p.run('innerWidth=1440;innerHeight=900');}
  reset();move(400,300,0,0,7500);p.run('locked=true;document.pointerLockElement=canvas');const before=aim();move(0,0,400,400,7508);assert.deepEqual(aim(),before);move(0,0,100,-50,7516);near(aim()[0],before[0]-.07,'locked flick');near(aim()[1],before[1]+.035,'locked pitch');render();
 });
 test('real guest input authority does not overwrite local mouse orientation and touch gain is unchanged',()=>{
  reset('live');p.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:p=>{captured=p}};netHasSnapshot=true;var captured;");move(400,300,0,0,8000);move(430,280,30,-20,8008);p.run('tickOnline(.1)');near(p.run('captured.input.pitch'),.014,'guest sends local pitch');near(p.run('captured.input.yaw'),-.021,'guest sends local yaw');render();p.run('onlinePlaying=false;online=null');
  reset();p.run('look(1.5,-3)');near(aim()[0],-.00105,'touch shared gain X');near(aim()[1],.0021,'touch shared gain Y');
 });
 assert.equal(failures.length,0,'Failed groups: '+failures.join(', '));return{groups};
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
