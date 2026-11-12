const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
// Reuse the actual saved-game VM with inert audio/rendering; real TRC collision.
const fixture=fs.readFileSync(path.join(__dirname,'tests-trc-game.cjs'),'utf8');
const mod=new Module(__filename,module);mod.filename=__filename;mod.paths=module.paths;
mod._compile(fixture.slice(0,fixture.indexOf('  const local=harness'))+'return {harness,load,copy};\n}\nmodule.exports=main;',__filename);
(async()=>{
 const {harness,load}=await mod.exports(),h=harness({realMap:true});h.reset();h.run("selectArena('trc');match.startLive();clearBots()");
 h.sandbox.tp=(await load('trc-layout.js')).trcPoint;
 const setup=(x=104,z=63,y=-3.2)=>{h.sandbox.at={x,z,y};h.run(`onlinePlaying=false;online=null;resetOrdinarySkills();elapsed=10;mode='play';match.phase='live';keys.clear();Object.assign(player,tp(at.x,at.z,at.y),{vy:0,vx:0,vz:0,crouch:0,yaw:0,pitch:0,alive:true,hp:100,renkoJetHeld:false});player.kit=new DuelistKit({character:'renko'});`);};
 let cases=0;
 for(const hz of [30,60,144])for(const pitch of [-1,0,1])for(const crouch of [0,1]){
  setup();h.sandbox.hz=hz;h.sandbox.pitch=pitch;h.sandbox.crouch=crouch;
  h.run(`player.pitch=pitch;player.crouch=crouch;activateAbility(player,'e');
   for(let i=0;i<.7*hz;i++){elapsed+=1/hz;updateActorVertical(player,1/hz);if(!canStand(player.x,player.z,.34,player.y,actorBodyHeight(player)))throw Error('jet overlaps basement');if(player.y>=0)throw Error('teleport to ground');}
   releaseRenkoJet();for(let i=0;i<2*hz;i++)updateActorVertical(player,1/hz);if(Math.abs(player.y+3.2)>.001)throw Error('landing');
   var beforeZ=player.z;moveEntity(player,0,-.25);if(Math.abs(player.z-beforeZ)<.2)throw Error('stuck after release');`);cases++;
 }
 console.log(`PASS: basement up/level/down, crouch, ceiling/floor contact, release and walking (${cases} cases)`);
 setup();h.run("activateAbility(player,'e');for(let i=0;i<12;i++)updatePlay(1/60)");assert.ok(h.run('player.z')<-9);assert.ok(h.run('player.y')<0);assert.ok(h.run('canStand(player.x,player.z,.34,player.y,actorBodyHeight(player))'));
 console.log('PASS: actual player game loop flies through the basement without teleporting');
 for(const stair of h.run('map.ramps.filter(r=>r.base<0)')){setup();h.sandbox.stair=stair;
  h.run(`Object.assign(player,{x:(stair.minX+stair.maxX)/2,z:stair.direction>0?stair.minZ-.6:stair.maxZ+.6,y:stair.base,yaw:stair.direction>0?Math.PI:0,pitch:.5});activateAbility(player,'e');for(let i=0;i<60;i++){updatePlay(1/60);if(!canStand(player.x,player.z,.34,player.y,actorBodyHeight(player)))throw Error('jet stair collision '+stair.id);}releaseRenkoJet();for(let i=0;i<120;i++)updateActorVertical(player,1/60);if(!canStand(player.x,player.z,.34,player.y,actorBodyHeight(player)))throw Error('stuck after stair jet');`);
 }
 console.log('PASS: both basement stair exits remain clear during jet ascent and after release');
 setup(88,35);h.run("player.pitch=.1;activateAbility(player,'e');for(let i=0;i<20;i++){elapsed+=1/60;updateActorVertical(player,1/60)}");assert.ok(h.run('player.y')<0,'upper stage stairs must not become basement floor');
 console.log('PASS: jet beneath stage does not acquire the upper stair floor');
 setup();h.run(`makeBot(tp(104,63,-3.2),0,'red',{id:'remote',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'renko'})});var jetRemote=bots[0];Object.assign(jetRemote,tp(104,63,-3.2),{remoteId:'guest',netPitch:1});activateAbility(jetRemote,'e');for(let i=0;i<60;i++){elapsed+=1/60;updateActorVertical(jetRemote,1/60);if(!canStand(jetRemote.x,jetRemote.z,.38,jetRemote.y,actorBodyHeight(jetRemote)))throw Error('host overlap');}clearBots();`);
 assert.ok(h.run('jetRemote.y')<0);
 setup();h.run(`onlinePlaying=true;online={host:false,session:{memberId:'guest',hostId:'host'}};activateAbility(player,'e',{predict:true});for(let i=0;i<20;i++){elapsed+=1/60;updateActorVertical(player,1/60)}`);assert.equal(h.run('player.y'),-3.2);
 console.log('PASS: host remote actor and guest predicted basement flight keep the correct layer');
 setup(55,133,0);h.run('activateAbility(player,"e");player.pitch=.5;updateActorVertical(player,.1)');assert.ok(h.run('player.y')>.5);
 console.log('PASS: outdoor upward jet still climbs');
 // Four screenshots: rays cross each former sliver at its walkable height.
 const gaps=[[[70.8,60,1.7],[72.2,60,1.7]],[[15.8,54,4.9],[17.3,54,4.9]],[[7.5,43,4.9],[10.4,43,4.9]],[[51.5,69,3],[52.3,69,3]],[[61.5,69,3],[62.4,69,3]]];
 for(const [a,b]of gaps){h.sandbox.a=a;h.sandbox.b=b;assert.equal(h.run(`(()=>{const a=tp(...globalThis.a),b=tp(...globalThis.b);return map.collision.rayClear(a.x,a.y,a.z,b.x,b.y,b.z);})()`),false,'gap ray '+JSON.stringify(a));}
 console.log('PASS: four reported edge areas block lateral sightlines');
 setup();h.run('renderedRecoil=.03');
 for(const hz of [125,1000,8000]){h.sandbox.inputHz=hz;h.run(`document.pointerLockElement=canvas;locked=true;resetMouseLook();mouseLook({clientX:400,clientY:300,movementX:0,movementY:0,timeStamp:1000});
  for(let i=1;i<=100;i++){mouseLook({clientX:400,clientY:300,movementX:1,movementY:-.5,timeStamp:1000+i*1000/inputHz});if(camera.rotation.y!==player.yaw||camera.rotation.x!==player.pitch+renderedRecoil)throw Error('camera waited for next physics tick');}`);}
 for(const stop of ["mode='pause'","player.alive=false","netHostPaused=true"]){setup();h.run(stop);const before=h.run('camera.rotation.y');h.run('look(80,40)');assert.equal(h.run('camera.rotation.y'),before);}
 console.log('PASS: camera consumes input before a physics frame, retaining recoil and pause/death guards');
 setup(30,91,0);h.run('var realHUD=updateHUD,hudCount=0;updateHUD=()=>{hudCount++;realHUD()};for(let i=0;i<144;i++)updatePlay(1/144)');assert.ok(h.run('hudCount')<=21);h.run('var beforeHUD=hudCount;updateHUD()');assert.equal(h.run('hudCount-beforeHUD'),1);h.run('updateHUD=realHUD');
 console.log('PASS: steady HUD refresh <=21/s at 144Hz; explicit actions still refresh immediately');
 console.log('PASS: TRC refinement groups (audio inert)');
})().catch(e=>{console.error(e);process.exitCode=1});
