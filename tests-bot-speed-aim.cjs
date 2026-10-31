const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true,measure=false}={}){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const anchor='const hit=Math.random()<chance,head=hit&&Math.random()<(settled?.34:.13);';
 const instrument=s=>{s=mutate(s.replace(/\r\n/g,'\n'));assert.ok(s.includes(anchor));return 'var __aimTrace=[];\n'+s.replace(anchor,'__aimTrace.push({id:bot.id,speed:targetSpeed,settled,chance,at:elapsed});'+anchor)};
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.observe(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 const m=new Module(path.join(__dirname,'speed-aim-harness.cjs'),module);m.filename=path.join(__dirname,'speed-aim-harness.cjs');m.paths=module.paths;m.observe=instrument;
 m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const {harness}=await m.exports(),h=harness();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name)},copy=x=>JSON.parse(JSON.stringify(x));
 function setup({remote=false}={}){h.reset();h.clearWalls();h.sandbox.remote=remote;h.run(`
 difficulty='hard';match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='other';
 Object.assign(player,{team:'red',x:0,y:0,z:20,hp:100,armor:50,alive:true});
 makeBot({x:0,z:0},0,'blue',{id:'speed-shooter',team:'blue',primary:'vandal',secondary:'classic',armor:50});var worker=bots[0];worker.kit=null;
 Object.assign(worker,{aiWeapon:'vandal',aiAmmo:25,aiReserve:75,aiReload:0,fire:999,think:0,target:null,reactionUntil:0,nextSkillAt:999});worker.group.rotation.y=0;
 var goal={x:0,z:0};updateBots.tactics={reset(){},observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal,role:'guard',siteId:'A'}]])}}};
 Math.random=()=>.5;__aimTrace=[];
 if(remote){onlinePlaying=true;online={host:true,session:{memberId:'owner'}};}
 `)}
 function step(dt=1/60){h.sandbox.dt=dt;h.run('updatePlay(dt)')}
 function move(dx,dy=0){Object.assign(h.sandbox,{dx,dy});h.run('player.x+=dx;player.y+=dy;player.vy=0')}
 function fire(dt=1/60){h.run('worker.fire=0;worker.aiAmmo=25;worker.aiReload=0;player.hp=100;player.armor=50;player.alive=true');step(dt);return copy(h.run('__aimTrace.at(-1)'))}
 function trial(speed,hz=60,vertical=false){setup();for(let i=0;i<Math.ceil(hz*.4);i++){move(vertical?0:speed/hz,vertical?speed/hz:0);step(1/hz)}move(vertical?0:speed/hz,vertical?speed/hz:0);return fire(1/hz)}
 test('visible speed continuously reduces actual shot chance through walking running dash and jet at20/60/144Hz',()=>{
  for(const hz of[20,60,144]){const rows=[0,1,2,4,6,12,14.4,16,24].map(speed=>trial(speed,hz));for(let i=1;i<rows.length;i++)assert.ok(rows[i].chance<rows[i-1].chance,JSON.stringify({hz,rows}));assert.ok(rows.at(-1).chance<rows[0].chance*.2);assert.ok(rows.at(-1).chance>0);}
 });
 test('vertical motion is tracked from consecutive visible poses too',()=>{
  const still=trial(0),fly=trial(8,60,true);assert.ok(fly.speed>7);assert.ok(fly.chance<still.chance*.4);assert.equal(fly.settled,false);
 });
 test('stationary precision returns after about0.2seconds and resets after moving at20/60/144Hz',()=>{
  for(const hz of[20,60,144]){setup();for(let i=0;i<hz*.3;i++){move(6/hz);step(1/hz)}
   const t=h.run('elapsed');let settledAt=null;
   for(let i=0;i<=Math.ceil(hz*.25);i++){const row=fire(1/hz),age=row.at-t;if(age<.2-1e-8)assert.equal(row.settled,false,JSON.stringify({hz,age,row}));if(row.settled){settledAt=age;break}}
   assert.ok(settledAt>=.2-1e-8&&settledAt<=.2+1/hz+1e-8,`${hz}: ${settledAt}`);
   move(3/hz);const again=fire(1/hz);assert.equal(again.settled,false);
  }
 });
 test('same random rolls cause less actual damage at higher speed without invulnerability',()=>{
  const rows=[];for(const speed of[0,4,8,16]){let hits=0,loss=0;for(let i=0;i<20;i++){
   setup();for(let j=0;j<24;j++){move(speed/60);step()}
   h.sandbox.roll=(i+.5)/20;h.run('Math.random=()=>roll');move(speed/60);fire();const damage=h.run('150-player.hp-player.armor');if(damage>0)hits++;loss+=damage;
  }rows.push({speed,hits,loss})}
  for(let i=1;i<rows.length;i++)assert.ok(rows[i].hits<rows[i-1].hits,JSON.stringify(rows));assert.ok(rows.at(-1).hits>0);console.log('DAMAGE SAMPLE: '+JSON.stringify(rows));
 });
 test('wall smoke blindness and reacquisition cannot inherit old stationary precision',()=>{
  for(const kind of['wall','smoke','blind']){setup();for(let i=0;i<24;i++)step();assert.equal(fire().settled,true);
   if(kind==='wall')h.wall({z:10,width:40});else if(kind==='smoke')h.run('syncSmokes([{id:1,kind:"smoke",x:0,y:1.4,z:10,radius:3.6,expires:100}])');else h.run('var originalBlind=ordinarySkills.blindUntil;ordinarySkills.blindUntil=()=>100');
   h.run('worker.fire=0;__aimTrace=[]');for(let i=0;i<12;i++)step();assert.equal(h.run('__aimTrace.length'),0,kind);assert.equal(h.run('worker.aimSample'),null);
   if(kind==='wall')h.clearWalls();else if(kind==='smoke')h.run('syncSmokes([])');else h.run('ordinarySkills.blindUntil=originalBlind');
   h.run('worker.think=0;worker.fire=999');step();assert.ok(h.run('elapsed-worker.aimStillSince<.02'));for(let i=0;i<9;i++)step();assert.equal(fire().settled,false);
  }
 });
 test('switching target or stale sample requires fresh stationary observation',()=>{
  setup();for(let i=0;i<24;i++)step();assert.equal(fire().settled,true);
  h.run("worker.aimSample.id='other'");assert.equal(fire().settled,false);
  for(let i=0;i<24;i++)step();h.run('worker.aimSample.at=elapsed-1');assert.equal(fire().settled,false);
 });
 test('host uses accepted remote movement and guest never runs CPU hit decisions',()=>{
  const rows=[];for(const speed of[0,6]){setup();h.run(`player.team='blue';player.z=-20;onlinePlaying=true;online={host:true,room:{code:'SPEED'},session:{memberId:'owner'}};
   makeBot({x:0,z:20},1,'red',{id:'remote-target',team:'red',secondary:'classic'});var remote=bots[1];remote.remoteId='peer';remote.kit=null;
   Object.assign(remote,{hp:100,armor:50,netWeapon:'classic',netAmmo:12});`);
   for(let i=0;i<30;i++){h.sandbox.speed=speed;h.run(`netInputs.set('peer',{input:{x:remote.x+speed/60,y:0,z:20,yaw:0,pitch:0,crouch:0},received:elapsed,round:match.round,seq:elapsed*60,connection:'c',actions:[]})`);step()}
   const row=fire();rows.push(row);if(speed)assert.ok(row.speed>5&&row.speed<=6.01,JSON.stringify(row));
  }assert.ok(rows[1].chance<rows[0].chance*.5,JSON.stringify(rows));
  setup();h.run("onlinePlaying=true;online={host:false,room:{code:'SPEED'},session:{memberId:'peer'}};netHasSnapshot=true;worker.fire=0");for(let i=0;i<30;i++)step();assert.equal(h.run('__aimTrace.length'),0);assert.equal(h.run('player.hp'),100);
 });
 if(measure){const rows=[];for(const hz of[20,60,144])for(const speed of[0,1,2,4,6,12,14.4,16,24])rows.push({hz,requestedSpeed:speed,...trial(speed,hz)});return{gameSHA:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'public/game.js'))).digest('hex'),frame:'actual updatePlay once per frame; no rendered/audio playback',rows};}
 console.log(`PASS: ${groups} actual savedgame speed aim groups`);return groups;
}
module.exports=main;
if(require.main===module){if(process.argv.includes('--negative')){
 (async()=>{const variants=[
 ['old speed threshold',s=>s.replace('chance*=trackingScale;','if(targetSpeed>2.5)chance*=.78;'),'visible speed'],
 ['old0.14second settle',s=>s.replace('elapsed-(bot.aimStillSince??elapsed)>=.2','elapsed-(bot.aimStillSince??elapsed)>=.14'),'stationary precision'],
 ['ignore vertical motion',s=>s.replace('(enemy.y||0)-sample.y','0'),'vertical motion'],
 ['retain precision after motion',s=>s.replace('if(!aligned||targetSpeed>.65)bot.aimStillSince=elapsed;','if(!aligned)bot.aimStillSince=elapsed;'),'stationary precision'],
 ];const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');for(const[name,edit,group]of variants){assert.notEqual(edit(source),source,name);await assert.rejects(()=>main({mutate:edit,only:n=>n.startsWith(group)}),{name:'AssertionError'},name);console.log('DETECTED: '+name)}console.log('PASS: 4 speed aim memory faults');})().catch(e=>{console.error(e);process.exitCode=1});
 }else main({measure:process.argv.includes('--measure')}).then(x=>{if(process.argv.includes('--measure'))console.log(JSON.stringify(x))}).catch(e=>{console.error(e);process.exitCode=1});}
