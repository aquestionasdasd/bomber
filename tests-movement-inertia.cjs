const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-onnara-game.cjs'),'utf8'),boundary=fixture.indexOf(' const local=harness();');
if(boundary<0)throw Error('Saved game harness boundary missing');
const suite=String.raw`
 const local=harness();
 function setup(){local.reset();local.clearWalls();local.run("clearCombatInput();match.phase='live';mode='play';exploring=false;rangeSession=null;Object.assign(player,{x:0,z:0,y:0,vy:0,vx:0,vz:0,yaw:0,crouch:0});inventory.active='classic';makeBot({x:60,z:60},0,'red',{id:'idle-enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});bots[0].rangeTarget=true;var movementTrail=[]");}
 function frames(count,hz){local.sandbox.frameCount=count;local.sandbox.dtValue=1/hz;local.run('for(let i=0;i<frameCount;i++){updatePlay(dtValue);movementTrail.push({x:player.x,z:player.z,vx:player.vx,vz:player.vz})}');}
 check('actual keyboard run accelerates and release coasts before stopping at30/60/144Hz',()=>{
  for(const hz of[30,60,144]){setup();local.run("keys.add('KeyD')");frames(1,hz);const first=local.run('player.vx');assert.ok(first>0&&first<6.21);frames(hz,hz);near(local.run('player.vx'),6.21,'existing speed');local.run('keys.clear();var releaseX=player.x');frames(1,hz);assert.ok(local.run('player.vx>0&&player.vx<6.21'));assert.ok(local.run('player.x>releaseX'));frames(hz,hz);near(local.run('player.vx'),0,'eventual stop');}
 });
 check('opposite key restores existing accurate-speed threshold sooner and held key reverses',()=>{
  for(const hz of[30,60,144]){setup();local.run('player.vx=6.21');let release=0;while(local.run('player.vx>1.2')&&release<hz){frames(1,hz);release++;}setup();local.run("player.vx=6.21;keys.add('KeyA')");let reverse=0;while(local.run('player.vx>1.2')&&reverse<hz){frames(1,hz);reverse++;}assert.ok(reverse<release,hz+' reverse vs release');assert.ok(reverse/hz<=.08,hz+' counter-strafe responds within80ms');assert.ok(release/hz>=.2,hz+' release keeps a short coast');frames(hz,hz);near(local.run('player.vx'),-6.21,'held opposite');}
 });
 check('diagonal and camera-relative directions retain isotropic acceleration and top speed',()=>{
  for(const yaw of[0,.6,Math.PI/2]){const results=[];for(const diagonal of[false,true]){setup();local.sandbox.aimYaw=yaw;local.run("player.yaw=aimYaw;keys.add('KeyW')");if(diagonal)local.run("keys.add('KeyD')");frames(1,60);results.push(local.run('Math.hypot(player.vx,player.vz)'));frames(60,60);near(local.run('Math.hypot(player.vx,player.vz)'),6.21,'diagonal maximum');}near(results[0],results[1],'isotropic start');}
  for(const hz of[30,60,144]){setup();local.run('touchMove.x=.5');frames(hz,hz);near(local.run('player.vx'),6.21*.5,'half analog input');local.run('touchMove.x=-.5');frames(hz,hz);near(local.run('player.vx'),-6.21*.5,'opposite analog input');}
 });
 check('walk/crouch/ADS/knife keep their previous maximum speeds and wall collision',()=>{
  for(const[kind,speed]of[['walk',3.22],['crouch',1.8],['ads',6.21*.78],['knife',7.245]]){setup();local.run("keys.add('KeyD')");if(kind==='walk')local.run("keys.add('ShiftLeft')");if(kind==='crouch')local.run("keys.add('KeyV')");if(kind==='ads')local.run('aiming=true');if(kind==='knife')local.run("inventory.active='knife'");frames(60,60);near(local.run('Math.hypot(player.vx,player.vz)'),speed,kind);}
  setup();local.wall({x:2,z:0,width:.2,depth:20});local.run("keys.add('KeyD')");frames(90,60);assert.ok(local.run('player.x<1.57'));local.run('keys.clear()');frames(60,60);assert.ok(local.run('player.x<1.57'));
 });
 check('special slide and non-controlled vehicle cleanup keep the old acceleration path',()=>{
  setup();local.run("player.kit=new DuelistKit({character:'frost'});activateAbility(player,'e');keys.add('KeyD')");const slide=local.run('frostSlideSpeed(player)');assert.ok(slide>0);frames(1,60);near(local.run('player.vx'),.75,'slide original45 acceleration');
  setup();local.run("player.carMotion={};player.vx=6.21;mode='pause'");frames(1,60);near(local.run('player.vx'),6.21-75/60,'uncontrolled cleanup');
 });
 check('host and guest execute the same local input integration',()=>{
  const values=[];for(const guest of[false,true]){setup();if(guest)local.run("online={host:false,room:{settings:{mapId:'hashimoto'}},session:{memberId:'peer'}};onlinePlaying=true;netHasSnapshot=true;netLocalId='player'");local.run("keys.add('KeyD')");frames(3,60);values.push(local.run('player.vx'));}near(values[0],values[1],'guest prediction');
 });
 console.log('PASS: '+groups+' actual movement groups; audio inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
let prefix=fixture.slice(0,boundary);
if(process.env.MOVEMENT_FAULT){
 const mutations={release:['current-22*step','current-90*step'],reverse:['(reverse?85:32)','32'],diagonal:['const len=Math.hypot(moveX,moveZ);','const len=Math.max(Math.abs(moveX),Math.abs(moveZ));']};const mutation=mutations[process.env.MOVEMENT_FAULT];if(!mutation)throw Error('Unknown fault');const product=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');if(!product.includes(mutation[0]))throw Error('Mutation anchor missing');prefix=prefix.replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8').replace("+JSON.stringify(mutation[0])+','+JSON.stringify(mutation[1])+")");
}
const compiled=new Module(path.join(__dirname,'movement-inertia-harness.cjs'),module);compiled.filename=path.join(__dirname,'movement-inertia-harness.cjs');compiled.paths=module.paths;compiled._compile(prefix+suite,compiled.filename);
