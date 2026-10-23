const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
// Run the saved game with inert rendering/audio. No alternate combat model.
const fixture = fs.readFileSync(path.join(__dirname, 'tests-onnara-game.cjs'), 'utf8');
const boundary = fixture.indexOf(' const local=harness();');
if (boundary < 0) throw Error('Saved-game harness boundary changed');
const suite = `
 const local=harness();
 function setup(){
   local.reset();local.clearWalls();
   local.run(\`difficulty='hard';match.phase='live';match.spike.status='carried';match.spike.carrier='other';
     Object.assign(player,{team:'red',x:0,y:0,z:-30,hp:100,armor:0,alive:true,vx:0,vz:0});
     makeBot({x:0,z:10},0,'blue',{id:'frost-test',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'frost'})});
     var doll=bots[0];doll.kit.smoke=0;doll.kit.updraft=1;doll.kit.dash=0;doll.kit.ultPoints=0;
     Object.assign(doll,{aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:0,reactionUntil:0,think:1,target:player,nextSkillAt:0});doll.group.rotation.y=Math.PI;
     var objective={x:0,z:-4},urgent=false,task='plant';
     updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return {siteId:'A',roles:new Map([[doll.id,{goal:objective,siteId:'A',role:task,urgent}]])}}};
     Math.random=()=>.2;\`);
 }
 const mist=()=>local.run("ordinarySkills.events(elapsed).find(e=>e.type==='frost-mist')");
 check('healthy objective worker covers a nearby work location against a distant visible enemy',()=>{
   setup();local.run('updateBots(.1)');const event=mist();assert.ok(event);assert.equal(local.run('doll.kit.updraft'),0);
   near(event.z,-4,'objective screen');near(event.y,1.4,'actual ground centre');assert.ok(local.run('doll.moving'));
   local.run('player.x=20;player.z=-40');near(mist().z,event.z,'fog never follows a target');near(mist().x,event.x,'fixed X');
 });
 check('fog actually clears live BOT targets and forbids hidden shots after deployment',()=>{
   setup();local.run('updateBots(.1);elapsed+=.51;updateOrdinarySkills();doll.fire=0;updateBots(.1)');
   assert.equal(local.run('doll.target'),null);assert.equal(local.run('doll.aiAmmo'),25);assert.equal(local.run('player.hp'),100);
   local.run('elapsed+=.3;updateOrdinarySkills();updateBots(.1)');assert.equal(local.run('doll.aiAmmo'),25);
 });
 check('urgent approach uses cover at medium range; wounded nearby defensive use remains available',()=>{
   setup();local.run('player.z=-5;urgent=true;updateBots(.1)');assert.ok(mist());assert.ok(local.run('doll.moving'));
   setup();local.run('player.z=-2;objective={x:0,z:10};doll.hp=50;updateBots(.1)');assert.ok(mist());
 });
 check('healthy holds, close duels, reloads and impossible routes preserve the mist',()=>{
   for(const code of ['objective={x:0,z:10}','objective={x:0,z:-25}',"task='hold'", "task='escort'",'player.z=-10','doll.aiReload=1','navigation.nearest=()=>null','navigation.path=()=>[]']){
     setup();local.run(code+';updateBots(.1)');assert.equal(local.run('doll.kit.updraft'),1,code);assert.equal(mist(),undefined,code);
   }
 });
 check('unseen wall/smoke/rear/dead targets and frozen old memory never steer long-range cover',()=>{
   for(const kind of ['wall','smoke','rear','dead','memory']){
     setup();
     if(kind==='wall')local.wall({z:0,width:100});
     if(kind==='smoke')local.run("syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:0,radius:3.6,expires:100}])");
     if(kind==='rear')local.run('doll.group.rotation.y=0');
     if(kind==='dead')local.run('player.alive=false;player.hp=0');
     if(kind==='memory')local.run("player.alive=false;doll.target=null;doll.lastSeen={id:player.id,team:'red',x:0,z:-30,seenAt:elapsed-.2}");
     local.run('updateBots(.1)');assert.equal(local.run('doll.target'),null,kind);assert.equal(local.run('doll.kit.updraft'),1,kind);
   }
 });
 check('air, flash, no stock and policy cooldown do not consume mist',()=>{
   for(const kind of ['air','blind','stock','cooldown']){
     setup();
     if(kind==='air')local.run('doll.y=2;doll.vy=1');
     if(kind==='blind')local.run("ordinarySkills.cast('nope-flash',{id:'flash-source',team:'red',x:0,y:0,z:10,hp:100,alive:true},{x:0,y:1.7,z:8},elapsed,match.round);elapsed+=NOPE_SKILLS.flashFlight+.01;updateOrdinarySkills()");
     if(kind==='stock')local.run('doll.kit.updraft=0');
     if(kind==='cooldown')local.run('doll.nextSkillAt=999');
     local.run('updateBots(.1)');assert.equal(mist(),undefined,kind);
   }
 });
 check('pending allied fog prevents duplicate cover; full event cap rejects and rolls stock back',()=>{
   setup();local.run("ordinarySkills.cast('frost-mist',{id:'ally-fog',team:'blue',x:0,y:0,z:10,hp:100,alive:true},{x:0,y:1.4,z:-4},elapsed,match.round);updateBots(.1)");assert.equal(local.run('doll.kit.updraft'),1);
   setup();local.run("for(let i=0;i<20;i++)ordinarySkills.cast('car-gyro',{id:'filler-'+i,team:'red',x:10,y:0,z:10,hp:100,alive:true},{x:10,y:0,z:10},elapsed,match.round);updateBots(.1)");assert.equal(local.run('doll.kit.updraft'),1);near(local.run('doll.nextSkillAt'),10.5,'bounded retry');assert.equal(local.run('ordinarySkills.events(elapsed).length'),20);
 });
 check('E retains actual slow mitigation and also permits a normal-ground entry',()=>{
   setup();local.run("player.alive=false;doll.kit.updraft=0;doll.kit.dash=1;ordinarySkills.cast('mend-seeds',{id:'seed-enemy',team:'red',x:0,y:0,z:10,hp:100,alive:true},{x:0,y:.12,z:10},elapsed,match.round);elapsed+=1;updateOrdinarySkills();updateBots(.1)");assert.equal(local.run('doll.kit.dash'),0);assert.ok(local.run('actorSpeedScale(doll)>.5'));
   setup();local.run('player.alive=false;doll.kit.updraft=0;doll.kit.dash=1;updateBots(.1)');assert.equal(local.run('doll.kit.dash'),0);assert.ok(local.run('frostSlideSpeed(doll)>7'));
 });
 check('guest never spends BOT stock; round cleanup removes deployed fog',()=>{
   setup();local.run("onlinePlaying=true;online={host:false,session:{memberId:'guest'}};updateBots(.1)");assert.equal(local.run('doll.kit.updraft'),1);
   setup();local.run('updateBots(.1);ordinarySkills.update([],elapsed,match.round+1)');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);
 });
 check('objective fog deployment still permits the actual plant and single-actor defuse to finish',()=>{
   for(const defending of [false,true]){
     setup();local.sandbox.defending=defending;
     local.run(\`doll.x=-28;doll.z=-8;player.x=-28;player.z=-60;objective={x:-28,z:-25};
       task=defending?'defuse':'plant';urgent=defending;
       if(defending){match.startingSide='defend';match.spike={...match.spike,status:'planted',carrier:null,x:-28,z:-25,site:'A',timer:30};}
       else {match.spike.carrier=doll.id;}
       updateBots.tactics.update=()=>({siteId:'A',defuserId:defending?doll.id:null,roles:new Map([[doll.id,{goal:objective,siteId:'A',role:task,urgent}]])});
       updateBots(.1);\`);
     assert.ok(mist(),defending?'defuse smoke':'plant smoke');
     local.run("for(let i=0;i<180&&match.phase==='live';i++){elapsed+=.1;updateOrdinarySkills();updateBots(.1);match.tick(.1,{blueAlive:1,redAlive:1,playerAlive:true});}");
     assert.equal(local.run('match.spike.status'),defending?'defused':'planted',local.run('JSON.stringify({x:doll.x,z:doll.z,task,spike:match.spike,phase:match.phase,defusing:doll.defusing})'));
   }
 });
 console.log('PASS: '+groups+' actual-game FROST cover/perception/mitigation/stock/authority groups; audio inert; '+Math.round(performance.now()-started)+'ms wall / '+Math.round((process.cpuUsage(cpuStarted).user+process.cpuUsage(cpuStarted).system)/1000)+'ms CPU');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
`;
const runner = new Module(path.join(__dirname, 'bot-frost-mist-harness.cjs'), module);
runner.filename = path.join(__dirname, 'bot-frost-mist-harness.cjs');
runner.paths = Module._nodeModulePaths(__dirname);
runner._compile(fixture.slice(0, boundary) + suite, runner.filename);
