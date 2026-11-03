const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 let prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const mod=new Module(path.join(__dirname,'victory-camera-harness.cjs'),module);mod.filename=path.join(__dirname,'victory-camera-harness.cjs');mod.paths=module.paths;mod.mutateGameSource=mutate;
 mod._compile(prefix+'\n return {harness};\n}\nmodule.exports=main;',mod.filename);
 const {harness}=await mod.exports(),local=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name);};
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
 function setup(p=local){p.reset();p.clearWalls();p.run(`makeBot({x:6,z:2},0,'blue',{id:'ally-a',team:'blue',name:'ALLY A',primary:'vandal'});makeBot({x:9,z:4},1,'blue',{id:'ally-b',team:'blue',name:'ALLY B',primary:'classic'});makeBot({x:60,z:60},2,'red',{id:'enemy',team:'red',primary:'classic'});for(const b of bots)b.rangeTarget=true;`);}
 function win(p=local,team='blue'){p.sandbox.winTeam=team;p.run(`match.endRound(winTeam,'elimination');handleMatchEvents();`);}
 function settle(p=local){p.run('for(let i=0;i<60;i++){updatePlay(1/60);updateVictoryCamera(1/60);syncDeathUI();}');}
 test('living player has the actual selected full body in the world, smooth pull-out and hidden first-person overlays',()=>{
  setup();local.run("inventory.primary='atlas';inventory.active='atlas';aiming=true;updatePlay(.01)");assert.equal(local.elements.get('sniper-scope').hidden,false);const before=local.run('camera.position.toArray()');win();local.run('updateVictoryCamera(.1)');
  assert.equal(local.run('victoryCamera.subject===player'),true);assert.equal(local.run('victoryCamera.active'),true);
  const first=local.run('camera.position.toArray()');assert.ok(Math.hypot(...first.map((v,i)=>v-before[i]))<1);
  settle();assert.equal(local.run('victoryCamera.localModel.group.visible'),true);
  assert.ok(local.run('camera.position.distanceTo(new THREE.Vector3(player.x,player.y+1.05,player.z))')>4.7);
  assert.equal(local.run('victoryCamera.localModel.group.parent===scene'),true);
  assert.equal(local.run('victoryCamera.localModel.meshes.length'),0,'Presentation body adds no hit surfaces');
  assert.equal(local.run('gun.visible'),false);assert.equal(local.elements.get('crosshair').hidden,true);
  assert.equal(local.elements.get('sniper-scope').hidden,true);near(local.run('camera.fov'),60);
  local.run('aiming=false;gun.visible=true;renderWithDetonation(0)');assert.equal(local.run('gun.visible'),false,'Final renderer must not restore hands');
  local.run('player.alive=false');assert.equal(local.run('bots.length'),3);
 });
 test('dead player pulls out from the last live teammate watched and reveals their existing model',()=>{
  setup();local.run(`player.alive=false;deathView.reset();spectateIndex=1;updatePlay(.01);`);
  assert.equal(local.run('lastSpectatedId'),'ally-b');assert.equal(local.run('spectatedBot.group.visible'),false);
  win();settle();assert.equal(local.run('victoryCamera.subject.id'),'ally-b');assert.equal(local.run('bots[1].group.visible'),true);
  assert.equal(local.run('victoryCamera.localModel?.group.visible||false'),false);
  assert.equal(local.elements.get('death-card').hidden,true);assert.equal(local.elements.get('spectator-hint').hidden,true);
  // A click changes the ordinary spectator index but cannot change the chosen dance subject.
  local.run('spectateIndex=0;updatePlay(.01);updateVictoryCamera(.01)');assert.equal(local.run('victoryCamera.subject.id'),'ally-b');assert.equal(local.run('bots[0].group.visible'),true,'A spectator click must not hide another winning teammate');
 });
 test('last surviving ally fallback, no survivors and a lost round leave the normal camera alone',()=>{
  setup();local.run(`player.alive=false;bots[0].alive=false;lastSpectatedId='missing';deathView.reset();updatePlay(.01)`);win();settle();assert.equal(local.run('victoryCamera.subject.id'),'ally-b');
  setup();local.run('player.alive=false;bots[0].alive=false;bots[1].alive=false;deathView.reset()');win();assert.equal(local.run('match.lastRound.team'),'blue');
  const camera=local.run('camera.position.toArray()');assert.equal(local.run('updateVictoryCamera(1)'),false);assert.deepEqual(local.run('camera.position.toArray()'),camera);
  setup();win(local,'red');assert.equal(local.run('updateVictoryCamera(1)'),false);assert.equal(local.run('victoryCamera.localModel?.group.visible||false'),false);
 });
 test('real indexed wall and ceiling clearance chooses a free angle and keeps interpolated camera rays clear',()=>{
  setup();local.wall({x:0,z:-1,width:8,depth:.3,height:6});local.run('updatePlay(.01)');win();
  for(let i=0;i<60;i++){local.run('updateVictoryCamera(1/60)');assert.equal(local.run('map.collision.rayClear(player.x,player.y+1.05,player.z,camera.position.x,camera.position.y,camera.position.z)'),true);}
  assert.ok(local.run('camera.position.z')>-.7,'Must not clip the wall in front');
  assert.ok(local.run('camera.position.distanceTo(new THREE.Vector3(0,1.05,0))')>4.7);
  local.run('var ceiling={minX:-8,maxX:8,minZ:-8,maxZ:8,base:1.95,height:2.2};map.colliders.push(ceiling);map.collision.invalidate();');
  local.run('for(let i=0;i<10;i++)updateVictoryCamera(.05)');assert.ok(local.run('camera.position.y')<1.95);
 });
 test('next round, menu, new game, match end and pagehide dispose restore presentation only',()=>{
  setup();win();settle();local.run('spawnRound(false)');assert.equal(local.run('victoryCamera.active'),false);assert.equal(local.run('victoryCamera.localModel.group.visible'),false);
  setup();win();settle();local.run('backMenu()');assert.equal(local.run('victoryCamera.active'),false);assert.equal(local.run('victoryCamera.localModel.group.visible'),false);
  setup();win();settle();local.run('finish(true)');assert.equal(local.run('victoryCamera.active'),false);assert.equal(local.run('victoryCamera.localModel.group.visible'),false);
  const disposal=harness();setup(disposal);win(disposal);settle(disposal);disposal.run('victoryCamera.dispose();victoryCamera.dispose()');assert.equal(disposal.run('victoryCamera.localModel'),null);
 });
 test('independent guest JSON and late joining a post round use existing actor/result fields without prediction',()=>{
  const host=harness(),guest=harness();setup(host);setup(guest);win(host);
  host.run("player.alive=false;player.hp=0;roster.splice(1,roster.length-1,...bots.map(b=>b.record));onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>captured=p};var captured;tickOnline(.1)");
  guest.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','player')");
  guest.sandbox.packet=JSON.parse(JSON.stringify(host.run('captured')));
  guest.run("receiveNetPacket('host',packet);deathView.reset();lastSpectatedId='ally-a'");
  guest.run('for(let i=0;i<60;i++)updateVictoryCamera(1/60)');assert.equal(guest.run('victoryCamera.subject.id'),'ally-a');assert.equal(guest.run('bots[0].group.visible'),true);
  guest.run('netHasSnapshot=false;victoryCamera.reset()');assert.equal(guest.run('updateVictoryCamera(1)'),false);
  host.run('victoryCamera.dispose()');guest.run('victoryCamera.dispose()');
 });
 test('inset, canvas, preview button and second renderer removed; reduced-motion camera is static after entry',()=>{
  const html=fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8'),source=fs.readFileSync(path.join(__dirname,'public/victory-dance.js'),'utf8');
  assert.doesNotMatch(html,/id="victory-dance(?:-canvas|-preview)?"/);assert.doesNotMatch(source,/createCharacterPreview|WebGLRenderer|requestAnimationFrame/);
  setup();win();local.run('reducedMotion.matches=true;updateVictoryCamera(.01)');assert.equal(local.run('victoryCamera.active'),true);near(local.run('camera.fov'),60);
  const pos=local.run('camera.position.toArray()');local.run('updateVictoryCamera(.1)');assert.deepEqual(local.run('camera.position.toArray()'),pos);
 });
 console.log(`PASS: ${groups} real saved-game victory camera groups; inert audio/renderer`);
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
