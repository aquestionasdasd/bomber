const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// Reuse the inert saved-game harness. Movement, vision, collision, stock,
// damage and cooldowns execute the actual game, not a second combat model.
const fixture = fs.readFileSync(path.join(__dirname, 'tests-onnara-game.cjs'), 'utf8');
const boundary = fixture.indexOf(' const local=harness();');
if (boundary < 0) throw Error('Saved-game harness boundary changed');
const suite = `
 const local=harness();
 function setup(){
   local.reset();local.clearWalls();
   local.run(\`difficulty='hard';match.phase='live';match.spike.status='carried';match.spike.carrier='other';
     Object.assign(player,{team:'red',x:0,y:0,z:-22,hp:100,armor:0,alive:true,vx:0,vz:0});
     makeBot({x:0,z:10},0,'blue',{id:'car-test',team:'blue',primary:'vandal',secondary:'classic',armor:50,kit:new DuelistKit({character:'car'})});
     var car=bots[0];car.kit.smoke=0;car.kit.updraft=0;car.kit.ultPoints=0;
     car.aiWeapon='vandal';car.aiAmmo=25;car.aiReserve=75;car.aiReload=0;car.fire=0;car.reactionUntil=0;car.think=1;car.target=player;car.nextSkillAt=999;car.group.rotation.y=Math.PI;
     var objective={x:0,z:-25},urgent=false;
     updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return {siteId:'A',roles:new Map([[car.id,{goal:objective,siteId:'A',role:'advance',urgent}]])}}};
     Math.random=()=>.2;\`);
 }
 check('actual movement then first grounded gun shot uses gyro despite generic C/Q decision timer',()=>{
   setup();local.run('updateBots(.1)');
   assert.ok(local.run('car.z<10&&car.moving'));assert.equal(local.run('ordinarySkills.carGyro(car.id,elapsed)'),true);
   assert.equal(local.run('car.kit.dash'),0);assert.equal(local.run('car.aiAmmo'),24);assert.equal(local.run('player.hp'),60);
 });
 check('same movement without E loses only movement accuracy; no weapon/ammo/speed bonus',()=>{
   setup();local.run('car.kit.dash=0;updateBots(.1)');
   assert.equal(local.run('player.hp'),100);assert.equal(local.run('car.aiAmmo'),24);
   const z=local.run('car.z');setup();local.run('updateBots(.1)');near(local.run('car.z'),z,'same advance distance');
 });
 check('stale moving flag, stationary contact and blocked navigation do not spend E',()=>{
   setup();local.run('player.z=-10;car.moving=true;updateBots(.1)');assert.equal(local.run('car.kit.dash'),1);
   setup();local.run('navigation.nearest=()=>null;car.moving=true;updateBots(.1)');assert.equal(local.run('car.kit.dash'),1);
 });
 check('no visible enemy through wall, smoke, flash or rear cone cannot activate combat E',()=>{
   for(const kind of ['wall','smoke','blind','rear','dead']){
     setup();
     if(kind==='wall')local.wall({z:0,width:100});
     if(kind==='smoke')local.run("syncSmokes([{id:1,kind:'smoke',x:0,y:1.6,z:0,radius:3.6,expires:100}])");
     if(kind==='blind')local.run("ordinarySkills.cast('nope-flash',{id:'flash-source',team:'red',x:0,y:0,z:10,hp:100,alive:true},{x:0,y:1.7,z:8},elapsed,match.round);elapsed+=NOPE_SKILLS.flashFlight+.01;updateOrdinarySkills()");
     if(kind==='rear')local.run('car.group.rotation.y=0');
     if(kind==='dead')local.run('player.alive=false;player.hp=0');
     local.run('updateBots(.1)');assert.equal(local.run('car.target'),null,kind);assert.equal(local.run('car.kit.dash'),1,kind);
   }
 });
 check('airborne, reloading, empty, reaction delay, throw lock and knife never spend gyro on a non-gun shot',()=>{
   for(const code of ['car.y=2;car.vy=1','car.aiReload=1','car.aiAmmo=0','car.reactionUntil=999','car.skillThrowUntil=999',"car.record.primary='knife';car.aiWeapon='knife';car.aiAmmo=0"]){
     setup();local.run(code+';updateBots(.1)');assert.equal(local.run('car.kit.dash'),1,code);
   }
 });
 check('full event cap rejects with rollback and bounded retry; next ready shot succeeds',()=>{
   setup();local.run(\`for(let i=0;i<20;i++)ordinarySkills.cast('car-gyro',{id:'filler-'+i,team:'red',x:10,y:0,z:10,hp:100,alive:true},{x:10,y:0,z:10},elapsed,match.round);updateBots(.1)\`);
   assert.equal(local.run('car.kit.dash'),1);near(local.run('car.nextGyroAt'),10.5,'rejection retry bound');assert.equal(local.run('ordinarySkills.events(elapsed).length'),20);
   local.run('resetOrdinarySkills();car.fire=0;elapsed+=.2;updateBots(.1)');assert.equal(local.run('car.kit.dash'),1);
   local.run('car.fire=0;elapsed+=.31;updateBots(.1)');assert.equal(local.run('car.kit.dash'),0);
 });
 check('no duplicate cast while active; cooldown expiry returns stock, death and next round clear effect',()=>{
   setup();local.run('updateBots(.1);car.fire=0;elapsed+=.3;updateBots(.1)');assert.equal(local.run("ordinarySkills.events(elapsed).filter(e=>e.type==='car-gyro').length"),1);
   local.run('elapsed+=CAR_SKILLS.signatureCooldown;car.kit.tick(elapsed)');assert.equal(local.run('car.kit.dash'),1);
   setup();local.run('updateBots(.1);car.alive=false;car.hp=0;updateOrdinarySkills()');assert.equal(local.run('ordinarySkills.carGyro(car.id,elapsed)'),false);
   setup();local.run('updateBots(.1);ordinarySkills.update([],elapsed,match.round+1)');assert.equal(local.run('ordinarySkills.events(elapsed).length'),0);
 });
 check('guest simulation never decides or spends host BOT stock',()=>{
   setup();local.run("onlinePlaying=true;online={host:false,session:{memberId:'guest'}};updateBots(.1)");assert.equal(local.run('car.kit.dash'),1);assert.equal(local.run('car.aiAmmo'),25);
 });
 console.log('PASS: '+groups+' actual-game gyro decision/accuracy/rejection/perception/authority groups; audio inert');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
`;
const runner = new Module(path.join(__dirname, 'bot-gyro-harness.cjs'), module);
runner.filename = path.join(__dirname, 'bot-gyro-harness.cjs');
runner.paths = Module._nodeModulePaths(__dirname);
runner._compile(fixture.slice(0, boundary) + suite, runner.filename);
