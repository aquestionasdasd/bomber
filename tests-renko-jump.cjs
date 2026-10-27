const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8');
const fault=process.argv.find(a=>a.startsWith('--fault='))?.slice(8);
const cases={local:['player.vy=normalJumpVelocity(player);','player.vy=6.552;','Q jump impulse'],remote:['actor.vy=normalJumpVelocity(actor);','actor.vy=6.552;','independent host guest']};
if(fault){const [a,b]=cases[fault]||[];if(!a)throw Error('Unknown fault');const read=fs.readFileSync;fs.readFileSync=function(file,...args){let text=read.call(this,file,...args);if(String(file).replaceAll('\\','/').endsWith('/public/game.js')&&typeof text==='string'){if(!text.includes(a))throw Error('Fault anchor missing');text=text.replace(a,b);}return text;};}
const boundary=fixture.indexOf(' const h=harness();');
const network=fixture.slice(fixture.indexOf(' function peers()'),fixture.indexOf(" check('independent host/guest flight"));
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("player.kit=new DuelistKit({character:'renko'});player.kit.updraft=1;match.phase='live';makeBot({x:60,z:-60},0,'red',{id:'enemy',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.remoteId='passive';enemy.fire=999;enemy.reactionUntil=999");}
 check('Q jump impulse is1.3x at20/60/144Hz; usual gravity and base jumps remain',()=>{
  for(const hz of[20,60,144])for(const active of[false,true]){setup();if(active)h.run("useAbility('q')");h.run('jump()');near(h.run('player.vy'),6.552*(active?1.3:1),'initial impulse');h.run('jump()');near(h.run('player.vy'),6.552*(active?1.3:1),'no extra midair jump');h.sandbox.hz=hz;h.run('var apex=0;for(let i=0;i<Math.ceil(1.5*hz);i++){updatePlay(1/hz);apex=Math.max(apex,player.y)}');near(h.run('apex'),(6.552*(active?1.3:1))**2/30,'ballistic apex',.006);near(h.run('player.y'),0,'landed');near(h.run('player.vy'),0,'no residual boost');}
  for(const char of['nope','duelist','onnara','duck']){setup();h.sandbox.char=char;h.run('player.kit=new DuelistKit({character:char});jump()');near(h.run('player.vy'),6.552,'other character '+char);}
 });
 check('sliding jump keeps boost, ends slide and collides with real ceiling',()=>{
  setup();h.run("keys.add('KeyW');useAbility('q');for(let i=0;i<30;i++)updatePlay(1/60);keys.add('KeyV');updatePlay(.05)");assert.ok(h.run('renkoSliding(player)'));h.run('jump()');near(h.run('player.vy'),8.5176,'slide jump');h.run('updatePlay(.05)');assert.equal(h.run('renkoSliding(player)'),false);
  setup();h.run("map.colliders.push({minX:-5,maxX:5,minZ:-5,maxZ:5,base:2.4,height:2.7});map.collision=createCollisionIndex(map.colliders);useAbility('q');jump();var highest=0;for(let i=0;i<120;i++){updatePlay(1/120);highest=Math.max(highest,player.y)}");assert.ok(h.run('highest')<=.700001,'ceiling stops boosted jump');near(h.run('player.y'),0,'falls back to ground');
 });
 check('expiry team round death and jet do not retain a dash jump or change flight',()=>{
  for(const code of["elapsed+=6","player.team='red'","match.round++","player.kit.character='nope'"]){setup();h.run("useAbility('q');"+code+';jump()');near(h.run('player.vy'),6.552,'inactive drive '+code);}
  setup();h.run("useAbility('q');player.alive=false;jump()");near(h.run('player.vy'),0,'dead');
  setup();h.run("useAbility('q');useAbility('e');player.pitch=.3;updateActorVertical(player,.1);var beforeY=player.y,beforeVy=player.vy;jump()");near(h.run('player.vy'),h.run('beforeVy'),'jet ignores jump');near(h.run('player.y'),h.run('beforeY'),'jet pose unchanged');near(h.run('player.vy'),Math.sin(.3)*16,'jet vertical speed');
  setup();h.run("for(let i=0;i<20;i++)ordinarySkills.cast('onnara-chain',{...ordinaryActorView(player),id:'s'+i},ordinaryActorView(player),elapsed,match.round);useAbility('q');jump()");near(h.run('player.vy'),6.552,'rejected Q');assert.equal(h.run('player.kit.updraft'),1);
 });
`+network+String.raw`
 check('independent host guest Q jumps match without new input fields; expiry uses normal jump',()=>{
  for(const active of[false,true]){const p=peers();if(active){request(p,'q');near(p.guest.run('normalJumpVelocity(player)'),8.5176,'predicted Q');ack(p);}
   p.guest.run('jump();updateActorVertical(player,.05)');const input=copy(p.guest.run('({x:player.x,y:player.y,z:player.z,yaw:player.yaw,pitch:player.pitch,crouch:player.crouch})'));
   p.host.sandbox.next={type:'input',seq:2,connection:'renko',round:p.host.run('match.round'),input,actions:[]};p.host.run("receiveNetPacket('guest',next);updateRemoteActor(enemy,.05)");near(p.host.run('enemy.vy'),6.552*(active?1.3:1)-.75,'host impulse minus gravity');near(p.host.run('enemy.y'),p.guest.run('player.y'),'host and guest jump height');
   if(active){p.host.run("elapsed+=6;enemy.y=0;enemy.vy=0;netInputs.get('guest').received=elapsed;netInputs.get('guest').input.y=0;updateRemoteActor(enemy,.05);netInputs.get('guest').input.y=.3;updateRemoteActor(enemy,.05)");near(p.host.run('enemy.vy'),6.552-.75,'host expiry');}
  }
 });
 check('host computes jump instead of trusting spoofed height and cannot relaunch repeated airborne input',()=>{
  const p=peers();request(p,'q');p.host.run("netInputs.get('guest').input.y=999;var highest=0;for(let i=0;i<40;i++){elapsed+=.05;netInputs.get('guest').received=elapsed;updateRemoteActor(enemy,.05);highest=Math.max(highest,enemy.y)}");assert.ok(p.host.run('highest')<=8.5176**2/30+.001,'no altitude spoof');near(p.host.run('enemy.y'),0,'same old air input cannot launch again');near(p.host.run('enemy.vy'),0,'same old input stays landed');
 });
 console.log('PASS: '+groups+' actual Renko dash jump groups; audio inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
if(boundary<0||!network)throw Error('Harness boundary missing');
const compiled=new Module(__filename,module);compiled.filename=__filename;compiled.paths=module.paths;
compiled._compile(fixture.slice(0,boundary).replace('fn(); groups++;',`if(${JSON.stringify(cases[fault]?.[2]||'')}&&!label.startsWith(${JSON.stringify(cases[fault]?.[2]||'')}))return;fn(); groups++;`)+suite,__filename);
