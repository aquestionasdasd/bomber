const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');
const fault=process.argv.find(a=>a.startsWith('--fault='))?.slice(8);
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const faults={contact:['grassOverlaps(p,actor.x,actor.z,.41)','true','distant'],assist:['assistGrassJump(actor,verticalDt,radius);','','contact'],authority:['beginNormalJump(actor);actor.netTrcJumpActive=true;','actor.vy=normalJumpVelocity(actor);actor.netTrcJumpActive=true;','JSON']};
if(fault){const[a,b]=faults[fault]||[];if(!a)throw Error('Unknown fault');const read=fs.readFileSync;fs.readFileSync=function(file,...args){let t=read.call(this,file,...args);if(String(file).replaceAll('\\','/').endsWith('/public/game.js')&&typeof t==='string'){if(!t.includes(a))throw Error('Missing anchor');t=t.replace(a,b);}return t;};}
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("delete map.floorBaseAt;keys.clear();mode='play';match.phase='live';player.x=.89;player.z=.31;makeBot({x:0,z:0},0,'red',{id:'grass',team:'red',secondary:'classic',kit:new DuelistKit({character:'veil'})});var block=bots[0];block.remoteId='passive';block.netYaw=0;block.group.rotation.y=Math.PI;block.y=0;block.vy=0;block.crouch=0;player.grassJump=null;");}
 function step(g,seconds,hz){g.sandbox.seconds=seconds;g.sandbox.hz=hz;g.run('for(let t=0;t<seconds-1e-8;t+=1/hz)updatePlay(Math.min(1/hz,seconds-t))');}
 check('contact jump mounts standing and crouched visible cube from each side without movement keys,20/60/144Hz',()=>{
  for(const hz of[20,60,144])for(const crouch of[0,1])for(const side of[0,1,2,3]){setup();h.sandbox.spec={crouch,side};h.run('block.crouch=spec.crouch;var p=grassPlatforms()[0],q=grassWorld(p,spec.side<2?(spec.side?-.89:.89):0,spec.side>=2?(spec.side===2?.88:-.88):0);player.x=q.x;player.z=q.z;jump()');assert.ok(h.run('player.grassJump'));step(h,1.2,hz);near(h.run('player.y'),h.run('grassPlatforms()[0].top'),'mount '+hz+'/'+crouch+'/'+side+' x='+h.run('player.x')+' z='+h.run('player.z')+' owner='+h.run('block.x')+','+h.run('block.z'),.00001);assert.ok(h.run('actorGrounded(player)'));assert.equal(h.run('keys.size'),0);assert.equal(h.run('player.yaw'),0);}
 });
 check('distant jumps retain normal impulse/apex and cannot receive assistance through a wall or from air',()=>{
  for(const hz of[20,60,144]){setup();h.run('player.x=2;jump()');near(h.run('player.vy'),6.552,'ordinary impulse');assert.equal(h.run('player.grassJump'),null);let max=0;for(let i=0;i<hz;i++){h.run('updateActorVertical(player,1/'+hz+')');max=Math.max(max,h.run('player.y'));}assert.ok(max<=6.552**2/30+.000001);}
  setup();h.wall({x:.7,z:.31,width:.05,depth:3,height:4});h.run('jump()');near(h.run('player.vy'),6.552,'wall blocked');assert.equal(h.run('player.grassJump'),null);
  setup();h.run('player.y=.4;player.vy=1;beginNormalJump(player)');assert.equal(h.run('player.grassJump'),null);
 });
 check('real ceiling clips the contact jump and sides remain solid; no jump input cannot auto mount',()=>{
  for(const hz of[20,60,144]){setup();h.run('map.colliders.push({minX:-4,maxX:4,minZ:-4,maxZ:4,base:2.8,height:3});map.collision=createCollisionIndex(map.colliders);jump()');step(h,1.2,hz);near(h.run('player.y'),0,'ceiling fall');assert.ok(h.run('player.x')>.8);}
  setup();h.run('moveEntity(player,-1,0)');assert.ok(h.run('player.x')>.85);step(h,1,60);near(h.run('player.y'),0,'no passive lift');
 });
 check('moving away and owner death/character/team/round/reset clear assistance without a delayed pull',()=>{
  for(const action of["block.alive=false","block.kit.character='nope'","block.team='blue'","player.team='red'","match.round++","resetOrdinarySkills()","player.x=3"]){setup();h.run('jump();'+action+';updateActorVertical(player,.05)');assert.equal(h.run('player.grassJump'),null,action);}
  setup();h.run('jump();var v=player.vy;jump()');near(h.run('player.vy'),h.run('v'),'no double jump');
 });
 check('after mounting, existing walking carry and jump off keep normal height and release assistance',()=>{
  setup();h.run('jump()');step(h,1.2,60);h.run('beginGrassFrame();block.x+=.4;carryGrassRiders()');assert.ok(h.run('player.x')>.7);near(h.run('player.y'),1.86,'carry');h.run('jump()');near(h.run('player.vy'),6.552,'jump off');assert.equal(h.run('player.grassJump'),null);
 });
 check('rotated corner contact and elevated common floor mount without changing the cube geometry',()=>{
  for(const hz of[20,60,144]){setup();h.run('block.netYaw=Math.PI/3;map.floorBaseAt=()=>2;block.y=2;player.y=2;var p=grassPlatforms()[0],q=grassWorld(p,p.halfX+.37/Math.SQRT2,p.halfZ+.37/Math.SQRT2);player.x=q.x;player.z=q.z;jump()');step(h,1.3,hz);near(h.run('player.y'),3.86,'raised rotated corner',.00001);near(h.run('grassPlatforms()[0].top-grassPlatforms()[0].base'),1.08,'same visible height');}
 });
 check('all16 characters mount by normal jump with no skill spend',()=>{
  for(const character of Object.keys(imported.CHARACTER_DEFS)){setup();h.sandbox.character=character;h.run('player.kit=new DuelistKit({character});var stocks=JSON.stringify(player.kit.snapshot());jump()');step(h,1.2,60);near(h.run('player.y'),1.86,character+' mount',.00001);assert.equal(h.run('JSON.stringify(player.kit.snapshot())'),h.run('stocks'),character+' no skill spent');}
 });
 check('JSON host guest independently derive contact jump and mount without a new input/snapshot field',()=>{
  for(const hz of[20,60,144]){const host=harness(),guest=harness();setup(host);setup(guest);
   host.run("player.kit.character='veil';player.x=0;player.z=0;block.kit.character='nope';block.x=.89;block.z=.31;block.remoteId='guest';block.netWeapon='classic';block.netAmmo=12;block.netReserve=36;onlinePlaying=true;online={host:true,session:{memberId:'host'},send(){}};netParticipants.set('guest',block.id)");
   guest.run('jump()');
   for(let i=0;i<Math.ceil(hz*1.2);i++){guest.run('updatePlay(1/'+hz+')');const input=copy(guest.run('({x:player.x,y:player.y,z:player.z,yaw:0,pitch:0,crouch:0})'));host.sandbox.msg={type:'input',seq:i+1,connection:'g',round:host.run('match.round'),input,actions:[]};host.run("receiveNetPacket('guest',msg);elapsed+=1/"+hz+";updateRemoteActor(block,1/"+hz+")");}
   near(host.run('block.y'),1.86,'authoritative mount',.00001);near(guest.run('player.y'),1.86,'predicted mount',.00001);assert.ok(host.run('grassSupport(block)'));assert.equal(host.run('captureNetActor(block).grassJump'),undefined);
  }
 });
 check('forged ride and repeated airborne heights cannot teleport or relaunch after landing; stale stream cannot pull',()=>{
  setup();h.run("block.kit.character='nope';player.kit.character='veil';player.x=0;player.z=0;block.x=2;block.z=.31;block.remoteId='guest';onlinePlaying=true;online={host:true,session:{memberId:'host'},send(){}};netParticipants.set('guest',block.id);var msg={type:'input',seq:1,connection:'g',round:match.round,input:{x:2,z:.31,y:99,ride:['player',0,0],yaw:0,pitch:0},actions:[]};receiveNetPacket('guest',msg);updateRemoteActor(block,.05)");assert.ok(h.run('block.y')<.4);assert.equal(h.run('block.grassJump'),null);
  h.run("for(let i=0;i<40;i++){elapsed+=.05;msg.seq++;receiveNetPacket('guest',msg);updateRemoteActor(block,.05)}");near(h.run('block.y'),0,'no repeated launch');assert.equal(h.run('block.grassJump'),null);
  h.run("block.x=.89;block.y=0;block.vy=0;block.netTrcJumpActive=false;msg.input.x=.89;msg.seq++;receiveNetPacket('guest',msg);updateRemoteActor(block,.05);elapsed+=1;updateRemoteActor(block,1.2)");near(h.run('block.y'),0,'stale fall');assert.equal(h.run('block.grassJump'),null);assert.ok(h.run('block.x')>.8,'no stale inward pull');
 });
 check('ACK snapshots through real tickOnline preserve the predicted jump and authoritative mounting',()=>{
  for(const hz of[20,60,144]){const host=harness(),guest=harness();setup(host);guest.reset();
   host.run("player.kit.character='veil';player.x=0;player.z=0;block.kit.character='nope';block.x=.89;block.z=.31;block.remoteId='guest';block.netWeapon='classic';block.netAmmo=12;block.netReserve=36;onlinePlaying=true;var captured;online={host:true,room:{code:'ABCDEFGH'},session:{memberId:'host'},send:p=>captured=JSON.parse(JSON.stringify(p))};netParticipants.set('guest',block.id);netClock=0;tickOnline(.1)");
   guest.run("onlinePlaying=true;var captured;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:p=>captured=JSON.parse(JSON.stringify(p))};netParticipants.set('guest','grass')");guest.sandbox.packet=copy(host.run('captured'));guest.run("receiveNetPacket('host',packet);mode='play';jump()");
   for(let i=0;i<Math.ceil(hz*1.5);i++){
    guest.run('updatePlay(1/'+hz+');netClock=0;tickOnline(.1)');host.sandbox.packet=copy(guest.run('captured'));host.run("receiveNetPacket('guest',packet);updatePlay(1/"+hz+")");
    if(i%Math.max(1,Math.round(hz/10))===0){host.run('netClock=0;tickOnline(.1)');guest.sandbox.packet=copy(host.run('captured'));guest.run("receiveNetPacket('host',packet)");}
   }
   near(host.run('block.y'),1.86,'ACK host mount',.00001);near(guest.run('player.y'),1.86,'ACK guest mount',.00001);assert.ok(host.run('grassSupport(block)'));
  }
 });
 console.log('PASS: '+groups+' real grass jump groups; audio inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
if(cut<0)throw Error('Missing harness');const instance=new Module(__filename,module);instance.filename=__filename;instance.paths=module.paths;instance._compile(fixture.slice(0,cut).replace('fn(); groups++;',`if(${JSON.stringify(faults[fault]?.[2]||only||'')}&&!label.startsWith(${JSON.stringify(faults[fault]?.[2]||only||'')}))return;fn(); groups++;`)+suite,__filename);
