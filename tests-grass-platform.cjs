const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8');
const boundary=fixture.indexOf(' const h=harness();');
const fault=process.argv.find(a=>a.startsWith('--fault='))?.slice(8);
const cases={support:['support=Math.max(support,p.top);','support=0;','landing'],carry:['  carryGrassRiders();','  grassFrame=null;','walking'],remote:['const p=grassSupport(actor);if(!p||p.id!==input.ride[0])return input;','const p=grassPlatforms().find(p=>p.id===input.ride[0]);if(!p)return input;','authority']};
if(fault){const [a,b]=cases[fault]||[];if(!a)throw Error('Unknown fault');const read=fs.readFileSync;fs.readFileSync=function(file,...args){let t=read.call(this,file,...args);if(String(file).replaceAll('\\','/').endsWith('/public/game.js')&&typeof t==='string'){if(!t.includes(a))throw Error('Missing fault anchor');t=t.replace(a,b);}return t;};}
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("mode='play';match.phase='live';player.kit=new DuelistKit({character:'nope'});player.x=0;player.z=.31;player.y=0;player.vy=0;player.crouch=0;makeBot({x:0,z:0},0,'red',{id:'grass',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'veil'})});var block=bots[0];block.remoteId='passive';block.netYaw=0;block.group.rotation.y=Math.PI;block.fire=999;block.reactionUntil=999;block.y=0;block.crouch=0;");}
 check('geometry shares visible cube dimensions, rotated footprint and crouch height',()=>{
  setup();near(h.run('grassPlatforms()[0].top'),1.86,'top');near(h.run('grassPlatforms()[0].base'),.78,'base');near(h.run('grassPlatforms()[0].z'),.31,'offset');h.run('block.crouch=1');near(h.run('grassPlatforms()[0].top'),1.31,'crouch');
  h.run('block.netYaw=Math.PI/2');near(h.run('grassPlatforms()[0].x'),.31,'rotated offset');
  assert.equal(h.run('grassHeadClear(player,.31,0,.34,0,1.7)'),false);assert.equal(h.run('grassHeadClear(block,.31,0,.34,0,1.7)'),true);
 });

 check('visible live cube stays level at its collision top through walking crouch and work poses',()=>{
  setup();h.run("var model=createAgentModel(THREE,{bot:{id:'probe'},character:'veil',team:'red'});var cube;model.group.traverse(o=>{if(o.name.includes('pebbled dirt cube'))cube=o});");
  for(const crouch of[0,.5,1])for(const pose of['moving','planting','defusing'])for(const t of[.1,.4,.9]){h.sandbox.pose={character:'veil',alive:true,crouch,[pose]:true,time:t,weapon:'vandal'};h.run('model.update(.05,pose);model.group.updateMatrixWorld(true);var box=new THREE.Box3().setFromObject(cube)');near(h.run('box.max.y'),1.86-crouch*.55,'visible top',1e-6);}
  h.run('model.dispose()');
 });
 check('landing supports real feet at20/60/144Hz; jumping, walking off and underside collision',()=>{
  for(const hz of[20,60,144]){setup();h.run('player.y=3');h.run('for(let i=0;i<'+hz+';i++)updateActorVertical(player,1/'+hz+')');near(h.run('player.y'),1.86,'land');near(h.run('player.vy'),0,'rest');assert.ok(h.run('actorGrounded(player)'));h.run('jump()');near(h.run('player.vy'),6.552,'jump');h.run('updateActorVertical(player,.1)');assert.ok(h.run('player.y')>1.86);}
  setup();h.run('player.y=1.86;moveEntity(player,2,0);updateActorVertical(player,.2)');assert.ok(h.run('player.x')>1);assert.ok(h.run('player.y')<1.86);
  setup();h.run('block.y=2;player.vy=6.552;var highest=0;for(let i=0;i<60;i++){updateActorVertical(player,1/120);highest=Math.max(highest,player.y)}');assert.ok(h.run('highest')<=1.080001,'cube underside');
  setup();h.run('player.x=-2;moveEntity(player,4,0)');assert.ok(h.run('player.x')<-.85,'solid sides');
 });
 check('walking and turning carry through full updatePlay without slipping or rotating rider aim',()=>{
  for(const hz of[20,60,144]){setup();h.run("player.kit=new DuelistKit({character:'veil'});player.z=0;block.kit=new DuelistKit({character:'nope'});block.remoteId='passive';block.x=0;block.z=.31;block.y=1.86;block.vy=0;keys.add('KeyW');var yawBefore=player.yaw;");h.run('for(let i=0;i<'+hz*2+';i++)updatePlay(1/'+hz+')');near(h.run('block.x-player.x'),0,'carry x');near(h.run('block.z-player.z'),.31,'carry z');near(h.run('block.y-player.y'),1.86,'carry y');near(h.run('player.yaw'),h.run('yawBefore'),'aim');}
  setup();h.run("player.kit.character='veil';player.z=0;block.kit.character='nope';block.z=.31;block.y=1.86;block.vy=0;beginGrassFrame();player.y=.2;updateActorVertical(block,.05);carryGrassRiders()");near(h.run('block.y'),2.06,'walking step up');
  setup();h.run("player.kit.character='veil';player.z=0;block.kit.character='nope';block.z=.31;block.y=1.86;block.vy=0;updatePlay(.01);player.yaw=Math.PI/2;updatePlay(.01)");near(h.run('block.x'),.31,'between-frame mouse turn');near(h.run('block.z'),0,'between-frame rotation z');
  setup();h.run('player.y=1.86;player.x=.2;beginGrassFrame();block.netYaw=Math.PI/2;carryGrassRiders()');near(h.run('player.x'),.31,'turned x');near(h.run('player.z'),-.2,'turned z');near(h.run('player.yaw'),0,'rider aim unchanged');
  setup();h.run('player.y=1.86;beginGrassFrame();moveEntity(player,.2,0);block.x+=.3;carryGrassRiders()');near(h.run('player.x'),.5,'own walking added');
 });
 check('carry respects map wall ceiling and detaches on jump death character team round and edge',()=>{
  setup();h.wall({x:1.2,z:.31,width:.1,depth:6,height:6});h.run('player.y=1.86;beginGrassFrame();block.x=2;carryGrassRiders()');assert.ok(h.run('player.x')<.82,'wall');
  setup();h.run('map.colliders.push({minX:-4,maxX:4,minZ:-4,maxZ:4,base:3.7,height:4});map.collision=createCollisionIndex(map.colliders);player.y=1.86;beginGrassFrame();block.y=2;carryGrassRiders()');assert.ok(h.run('player.y')<=2.000001,'ceiling');
  for(const code of["jump()","block.alive=false","block.kit.character='nope'","block.team='blue'","match.round++","moveEntity(player,2,0)"]){setup();h.run('player.y=1.86;beginGrassFrame();'+code+';var beforeX=player.x;block.x+=1;carryGrassRiders()');near(h.run('player.x'),h.run('beforeX'),'detach '+code);}
  setup();h.run('player.y=1.86;block.alive=false;updateActorVertical(player,.1)');assert.ok(h.run('player.y')<1.86);setup();h.run('player.y=1.86;beginGrassFrame();resetOrdinarySkills()');assert.equal(h.run('grassFrame'),null);
 });

 check('stacked grass supports and two riders carry once, crouch lowers top and nearby ledges stay solid',()=>{
  setup();h.run("player.kit.character='veil';player.z=0;block.kit.character='veil';block.x=0;block.z=.31;block.y=1.86;block.vy=0;makeBot({x:0,z:.62},1,'blue',{id:'rider',team:'blue',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});var rider=bots[1];rider.y=3.72;rider.vy=0;beginGrassFrame();player.x=1;carryGrassRiders()");near(h.run('block.x'),1,'middle carry');near(h.run('rider.x'),1,'top carry');near(h.run('rider.y'),3.72,'top height');
  setup();h.run('player.y=1.86;beginGrassFrame();block.crouch=1;updateActorVertical(player,.05);carryGrassRiders()');near(h.run('player.y'),1.31,'lowered support');
  setup();h.run('player.y=1.86;player.x=-.2;makeBot({x:.2,z:.31},1,\'blue\',{id:\'rider2\',team:\'blue\',secondary:\'classic\',kit:new DuelistKit({character:\'nope\'})});var rider=bots[1];rider.y=1.86;rider.vy=0;beginGrassFrame();block.x=1;carryGrassRiders()');near(h.run('player.x'),.8,'first rider');near(h.run('rider.x'),1.2,'second rider');
 });
 check('authority accepts relative movement only on actual support, bounds and stale input stay host-owned',()=>{
  setup();h.run("var input={x:0,z:.31,y:1.86,ride:['grass',0,0]};var converted=grassRemoteInput(player,input)");near(h.run('converted.x'),0,'forged owner rejected');near(h.run('converted.z'),.31,'forged ground rejected');assert.ok(h.run('converted===input'));
  h.run('player.y=1.86;block.x=1;player.x=1;input.x=0;input.z=.31;converted=grassRemoteInput(player,input)');near(h.run('converted.x'),1,'relative current support');near(h.run('converted.z'),.31,'relative current z');
  for(const code of["input.ride=['grass',9,0]","input.ride=['other',0,0]","player.vy=2","block.alive=false"]){setup();h.run("player.y=1.86;var input={x:99,z:99,y:1.86,ride:['grass',0,0]};"+code);assert.ok(h.run('grassRemoteInput(player,input)===input'),code);}
  setup();h.run("block.kit.character='nope';player.kit.character='veil';block.x=0;block.z=.31;block.y=1.86;block.vy=0;block.remoteId='guest';onlinePlaying=true;online={host:true,session:{memberId:'host'},send(){}};netParticipants.set('guest',block.id);var msg={type:'input',seq:1,round:match.round,connection:'g',input:{x:0,z:.31,y:999,ride:['player',0,0],yaw:0,pitch:0},actions:[]};receiveNetPacket('guest',msg);updateRemoteActor(block,.05)");assert.ok(h.run('block.y')<2.2,'cannot spoof altitude');assert.ok(h.run('block.vy')<=6.552,'normal jump only');
 });
 check('independent JSON host guest input preserves relative walking; no actor snapshot field; malformed rejected',()=>{
  const host=harness(),guest=harness();setup(host);setup(guest);
  for(const g of[host,guest])g.run("block.remoteId='guest';player.kit.character='veil';player.x=2;player.z=0;block.kit.character='nope';block.x=2;block.z=.31;block.y=1.86;block.vy=0;");
  host.run("onlinePlaying=true;online={host:true,session:{memberId:'host'},send(){}};netParticipants.set('guest',block.id)");
  const relative=copy(guest.run('grassRideInput(block)'));assert.equal(relative[0],'player');
  host.sandbox.msg={type:'input',seq:1,connection:'g',round:host.run('match.round'),input:{x:0,z:.31,y:1.86,yaw:0,pitch:0,crouch:0,ride:relative},actions:[]};host.run("receiveNetPacket('guest',msg);updateRemoteActor(block,.05)");near(host.run('block.x'),2,'old guest world x not pulled back');near(host.run('block.y'),1.86,'accepted support');
  host.run("msg.seq=2;msg.input.ride=['player',99,0];receiveNetPacket('guest',msg)");assert.equal(host.run("netInputs.get('guest').seq"),1,'malformed rejected');
  host.run("msg.input.ride=['player',.7,0];msg.seq=3;receiveNetPacket('guest',msg);var beforeX=block.x;updateRemoteActor(block,.05)");assert.ok(host.run('block.x-beforeX')<=7*1.15*.05+1e-7,'normal speed cap');
  assert.equal(host.run('captureNetActor(block).grassRide'),undefined);host.run("elapsed+=1;var before=block.x;updateRemoteActor(block,.05)");near(host.run('block.x'),host.run('before'),'stale input');
 });

 check('real guest tick sends ride frame and delayed snapshot world coordinates do not pull an attached rider back',()=>{
  const host=harness(),guest=harness();setup(host);guest.reset();
  host.run("player.kit.character='veil';player.z=0;block.kit.character='nope';block.remoteId='guest';block.x=0;block.z=.31;block.y=1.86;block.vy=0;block.netWeapon='classic';block.netAmmo=12;block.netReserve=36;onlinePlaying=true;var captured;online={host:true,session:{memberId:'host'},send:p=>captured=JSON.parse(JSON.stringify(p))};netParticipants.set('guest',block.id);netClock=0;tickOnline(.1)");
  guest.run("onlinePlaying=true;var captured;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:p=>captured=JSON.parse(JSON.stringify(p))};netParticipants.set('guest','grass')");guest.sandbox.packet=copy(host.run('captured'));guest.run("receiveNetPacket('host',packet);mode='play';netClock=0;tickOnline(.1)");
  const packet=copy(guest.run('captured'));assert.equal(packet.input.ride[0],'player');assert.ok(JSON.stringify(packet).length<2048,'bounded optional input');
  host.run('player.x=2;block.x=2');host.sandbox.packet=packet;host.run("receiveNetPacket('guest',packet);updateRemoteActor(block,.05)");near(host.run('block.x'),2,'actual guest input relative');near(host.run('block.y'),1.86,'actual accepted feet');
 });
 console.log('PASS: '+groups+' actual grass platform groups; audio inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
if(boundary<0)throw Error('Missing harness');
const compiled=new Module(__filename,module);compiled.filename=__filename;compiled.paths=module.paths;
compiled._compile(fixture.slice(0,boundary).replace('fn(); groups++;',`if(${JSON.stringify(cases[fault]?.[2]||'')}&&!label.startsWith(${JSON.stringify(cases[fault]?.[2]||'')}))return;fn(); groups++;`)+suite,__filename);
