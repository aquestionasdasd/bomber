const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true,measure=false}={}){
 const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');assert.ok(cut>0);
 const mod=new Module(__filename,module);mod.filename=__filename;mod.paths=module.paths;mod.mutate=mutate;
 const prefix=fixture.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutate(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 mod._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',__filename);
 const {harness}=await mod.exports(),h=harness(),controls=[];let groups=0;
 const rawRun=h.run;h.run=code=>{try{return rawRun(code);}catch(e){throw new Error('Saved-game fixture: '+e.name+': '+e.message+' in '+code.slice(0,200));}};
 h.run('var originalBlind=ordinarySkills.blindUntil,originalSight=ordinarySkills.sightRange');
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name);};
 function setup({weapon='classic',key='x',mode=0,type='turret',team='red',range=8}={}){
  h.reset();h.clearWalls();h.sandbox.config={weapon,key,mode,type,team,range};
  h.run(`ordinarySkills.blindUntil=originalBlind;ordinarySkills.sightRange=originalSight;player.team=config.team;player.x=60;player.z=60;player.kit=new DuelistKit({character:'ember'});match.phase='live';
   makeBot({x:0,z:0},0,'blue',{id:'worker',team:'blue',primary:config.weapon==='classic'?null:config.weapon,secondary:'classic',kit:new DuelistKit({character:'mend'})});var worker=bots[0];worker.kit.smoke=worker.kit.updraft=worker.kit.dash=worker.kit.ultPoints=0;worker.group.rotation.y=Math.PI;worker.fire=0;worker.think=0;worker.aiWeapon=config.weapon;worker.aiAmmo=WEAPONS[config.weapon].mag;worker.aiReserve=WEAPONS[config.weapon].reserve;worker.aiReload=0;
   updateBots.tactics=createBotTactics({sites:map.sites,navigation,collision:map.collision,attackSpawn:map.teamSpawns.attack[0],defendSpawn:map.teamSpawns.defend[0]});
   updateBots.tactics.update=()=>({siteId:'A',roles:new Map([[worker.id,{role:'guard',goal:{x:0,z:0},siteId:'A'}]])});
   var group=robotArmy.deploy(player,config.key,config.mode,{x:0,y:0,z:-config.range,flight:.01},elapsed,match.round,robotWorld());if(!group)throw Error('Fixture deployment failed');
   robotArmy.update(elapsed+.02,match.round,[player,worker],robotWorld());var unit=robotArmy.units().find(u=>u.type===config.type);if(!unit)throw Error('Fixture robot missing');
   for(const u of robotArmy.units())if(u!==unit)u.endsAt=elapsed+.001;
   Object.assign(unit,{x:0,y:ROBOT_TYPES[config.type].altitude||0,z:-config.range,thinkAt:999,fireAt:999,endsAt:elapsed+20,target:null,memory:null});var robotId=unit.id;
   var frames=0,maxTurn=0,previousYaw=worker.group.rotation.y,shotAt=[],lastSequence=0,startTime=elapsed;
  `);
 }
 function step(seconds,hz=60){h.sandbox.seconds=seconds;h.sandbox.hz=hz;h.run(`for(let t=0;t<seconds-1e-8;t+=1/hz){const dt=Math.min(1/hz,seconds-t);updatePlay(dt);frames++;const turn=Math.atan2(Math.sin(worker.group.rotation.y-previousYaw),Math.cos(worker.group.rotation.y-previousYaw));maxTurn=Math.max(maxTurn,Math.abs(turn)/dt);previousYaw=worker.group.rotation.y;if((worker.shotSequence||0)!==lastSequence){shotAt.push(elapsed-startTime);lastSequence=worker.shotSequence||0;}}`);}
 function state(){return JSON.parse(JSON.stringify(h.run('({hp:unit.hp,maxHp:unit.maxHp,alive:robotArmy.units().some(u=>u.id===robotId),shots:shotAt.length,shotAt,ammo:worker.aiAmmo,frames,maxTurn,target:worker.target?.id||null,robotTarget:worker.robotTarget?.id||null,workerHP:worker.hp,playerHP:player.hp})')));}
 test('X initial, replacement, normal and emergency production cap HP; C/Q/E and factory keep original durability',()=>{
  h.run(`var army=createRobotArmy(),owner={id:'owner',team:'blue',alive:true,x:0,y:0,z:0,yaw:0},clock=0;var world={ground:()=>0,stand:()=>true,clear:()=>true,see:()=>false,path:()=>[],move(){},damage(){},push(){}};
   var tick=(s)=>{for(let n=0;n<Math.ceil(s*60);n++){clock+=1/60;army.update(clock,1,[owner],world);}};
   var allModes=[];for(const key of ['c','q','e','x'])for(const mode of [0,1]){army.reset();var g=army.deploy(owner,key,mode,{x:0,y:0,z:0,flight:.01},clock,1,world);tick(.05);allModes.push({key,mode,units:army.units().map(u=>({type:u.type,hp:u.hp,maxHp:u.maxHp}))});}
  `);
  const T=h.sandbox.ROBOT_TYPES;for(const g of h.run('allModes'))for(const u of g.units){const expected=g.key==='x'&&!T[u.type].factory?Math.min(30,T[u.type].hp):T[u.type].hp;assert.equal(u.hp,expected,g.key+g.mode+u.type);assert.equal(u.maxHp,expected);}
  for(const mode of [0,1]){setup({mode,type:'shield'});h.sandbox.productionMode=mode;h.run(`var army=robotArmy,clock=elapsed,owner=player,world=robotWorld();world.see=()=>false;world.move=()=>{};var g=army.groups()[0];for(const u of army.units())u.endsAt=clock+20;var factory=army.units().find(u=>ROBOT_TYPES[u.type].factory);if(!factory)throw Error('Fixture factory');var killed=army.units().find(u=>u.type==='shield');army.hit(killed.id,1000,'blue',clock,world);for(let i=0;i<150;i++){clock+=1/60;army.update(clock,match.round,[player,worker],world);}var produced=army.units().filter(u=>!ROBOT_TYPES[u.type].factory);`);assert.ok(h.run('produced.length')>0);assert.equal(h.run('produced.every(u=>u.hp<=30&&u.maxHp<=30)'),true);if(mode){h.run(`g.materials=4;var before=g.total;var commanded=army.command(owner.id,'x',{x:0,y:0,z:0},clock,world)`);assert.equal(h.run('commanded'),true);assert.ok(h.run('g.total')>h.run('before'));assert.equal(h.run('army.units().filter(u=>!ROBOT_TYPES[u.type].factory).every(u=>u.hp<=30&&u.maxHp<=30)'),true);}}
 });
 test('real CPU Classic two shots and Vandal one shot destroy X units at20/60/144Hz; finite reaction, ammo and turn',()=>{
  for(const hz of [20,60,144])for(const weapon of ['classic','vandal']){setup({weapon});step(1.4,hz);const r=state();assert.equal(r.alive,false,JSON.stringify({hz,weapon,...r}));assert.equal(r.shots,weapon==='classic'?2:1);assert.equal(r.ammo,h.run('WEAPONS[config.weapon].mag')-r.shots);assert.ok(r.shotAt[0]>=.14);assert.ok(r.maxTurn<=Math.PI*.8+1e-7);assert.equal(r.workerHP,100);assert.equal(r.playerHP,100);controls.push({hz,weapon,...r});}
 });
 test('CPU also destroys regular C/Q/E robots and durable X factories through actual firearm ray hits',()=>{
  for(const spec of [{key:'c',type:'bomb',shots:1},{key:'c',mode:1,type:'flyer',shots:1},{key:'q',type:'shield',shots:5},{key:'e',type:'supervisor',shots:4},{key:'x',type:'assault',shots:8},{key:'x',mode:1,type:'production',shots:9}]){setup({weapon:'vandal',...spec});step(4.5);const r=state();assert.equal(r.alive,false,JSON.stringify({spec,...r}));assert.equal(r.shots,spec.shots);}
 });
 test('wall, low cover, smoke, blindness, nearsight, cone, distance and friendly ownership prevent robot acquisition',()=>{
  for(const reason of ['wall','low-cover','smoke','blind','near','behind','far','friendly']){setup({team:reason==='friendly'?'blue':'red',range:reason==='far'?34:8});
   if(reason==='wall'||reason==='low-cover'){h.wall({z:-5,width:6,height:reason==='wall'?3:1.2});h.run('map.collision=createCollisionIndex(map.colliders)');}
   if(reason==='smoke')h.run("syncSmokes([{id:1,x:0,y:1.5,z:-4,expires:elapsed+5}])");
   if(reason==='blind')h.run('ordinarySkills.blindUntil=()=>100');if(reason==='near')h.run('ordinarySkills.sightRange=()=>5');if(reason==='behind')h.run('worker.group.rotation.y=0;previousYaw=0;player.z=-60');
   step(.7);const r=state();assert.equal(r.shots,0,reason+JSON.stringify(r));assert.equal(r.hp,r.maxHp,reason);assert.equal(r.robotTarget,null,reason);
  }
 });
 test('loss after acquisition stops immediately, hidden movement supplies no contact, reacquisition waits reaction',()=>{
  setup();step(.1);assert.equal(state().robotTarget,h.run('unit.id'));h.run("syncSmokes([{id:1,x:0,y:1.5,z:-4,expires:elapsed+5}])");step(.3);assert.equal(state().shots,0);assert.equal(state().robotTarget,null);assert.equal(h.run('worker.lastSeen'),null);h.run('unit.x=20');step(.3);assert.equal(state().shots,0);h.run('unit.x=0;syncSmokes([]);worker.robotThinkAt=0');step(.1);assert.equal(state().shots,0);step(.8);assert.equal(state().alive,false);
 });
 test('visible player, ongoing work, urgent role and guest/remote authority take precedence over robot shots',()=>{
  setup();h.run('player.x=0;player.z=-5;worker.think=0');step(.8);assert.equal(state().target,'player');assert.equal(state().hp,30);
  for(const rule of ['urgent','defuse','remote','guest']){setup();h.sandbox.rule=rule;h.run(`if(rule==='urgent')updateBots.tactics.update=()=>({siteId:'A',roles:new Map([[worker.id,{role:'guard',urgent:true,goal:{x:0,z:0},siteId:'A'}]])});
   if(rule==='defuse'){match.startingSide='defend';Object.assign(match.spike,{status:'planted',x:0,z:0,y:0,timer:8,site:'A',defuseActor:null,defuseProgress:0,checkpoint:0});updateBots.tactics.update=()=>({siteId:'A',defuserId:worker.id,roles:new Map([[worker.id,{role:'defuse',urgent:true,goal:{x:0,z:0},siteId:'A'}]])});}
   if(rule==='remote')worker.remoteId='guest';if(rule==='guest'){onlinePlaying=true;online={host:false,session:{memberId:'guest'}};}`);step(.7);assert.equal(state().shots,0,rule);assert.equal(state().hp,30,rule);if(rule==='defuse')assert.ok(h.run('match.spike.defuseProgress')>0,'actual urgent defuse progress '+h.run('JSON.stringify({spike:match.spike,side:match.side,role:worker.tacticRole,defusing:worker.defusing,x:worker.x,z:worker.z})'));}
 });
 test('empty CPU magazine reloads normally; reaction and turn are shared and robot target clears on round cleanup',()=>{
  setup();h.run('worker.aiAmmo=0');step(.5);assert.ok(h.run('worker.aiReload')>0);assert.equal(state().shots,0);step(3);assert.equal(state().alive,false);assert.equal(state().shots,2);
  setup();h.run('worker.group.rotation.y=Math.PI-.7;previousYaw=worker.group.rotation.y');step(.2);assert.equal(state().shots,0);assert.ok(state().maxTurn<=Math.PI*.8+1e-7);step(1);assert.equal(state().alive,false);h.run('resetOrdinarySkills()');assert.equal(h.run('worker.robotTarget'),null);
 });
 if(measure)return{groups,controls,updatePlayCallsPerFrame:1,audioOutput:0,limitations:['fixed stationary targets and deterministic aim; ordinary5v5 frequency/win rate unmeasured','actual browser and listening unverified']};
 console.log('PASS: '+groups+' robot counterplay groups; real updatePlay once/frame; audio inert');
}
module.exports=main;if(require.main===module)main({measure:process.argv.includes('--measure')}).then(r=>{if(r)console.log(JSON.stringify(r))}).catch(e=>{console.error(e);process.exitCode=1;});
