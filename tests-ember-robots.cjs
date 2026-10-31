const assert=require('node:assert/strict');
async function main(){
 const {createRobotArmy}=await import('./public/ember-robots.js'),{ROBOT_TYPES:T,ROBOT_SKILLS:S,ROBOT_RULES:R}=await import('./public/ember-robots-config.js'),{DuelistKit,getCharacterSkill,signatureCooldown}=await import('./public/abilities.js');
 let groups=0;const check=(s,f)=>{f();groups++;console.log('PASS: '+s);};
 function fixture(){const army=createRobotArmy(),owner={id:'owner',alive:true,team:'blue',x:0,y:0,z:0,yaw:0,kit:new DuelistKit({character:'ember'})},enemy={id:'enemy',alive:true,team:'red',x:0,y:0,z:-5,hp:1000},actors=[owner,enemy],damage=[];
  const world={ground:()=>0,stand:()=>true,clear:()=>true,see:()=>true,path:(u,p)=>[p],move:(u,d,t)=>{u.x+=d.x;u.z+=d.z;if(t.altitude)u.y=t.altitude;},damage:(a,n,o)=>{damage.push({id:a.id,n,owner:o.id});a.hp=Math.max(0,a.hp-n);if(!a.hp)a.alive=false;},push:(a,u,d)=>a.z-=d,stop:(a,b,l)=>{const n=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)||1,s=Math.min(1,l/n);return{x:a.x+(b.x-a.x)*s,y:a.y+(b.y-a.y)*s,z:a.z+(b.z-a.z)*s};}};
  let time=0;function tick(seconds,hz=60){for(let i=0;i<seconds*hz-1e-8;i++){time+=Math.min(1/hz,seconds-i/hz);army.update(time,1,actors,world);}}
  function deploy(key,mode=0){return army.deploy(owner,key,mode,{x:0,y:0,z:0,flight:.2},time,1,world);}return{army,owner,enemy,actors,world,damage,tick,deploy,time:()=>time};
 }
 check('existing ember economy only: C2/Q1 at100, E24seconds, X7; all eight valid rosters and atomic invalid capacity',()=>{
  assert.equal(getCharacterSkill('ember','c').max,2);assert.equal(getCharacterSkill('ember','q').price,100);assert.equal(signatureCooldown('ember'),24);
  const kit=new DuelistKit({character:'ember'});kit.smoke=2;kit.updraft=1;kit.ultPoints=7;for(const k of['c','q','e','x'])assert.equal(kit.activate(k,1).type,'ember-robot-'+k);kit.tick(24.99);assert.equal(kit.dash,0);kit.tick(25);assert.equal(kit.dash,1);
  for(const key of['c','q','e','x'])for(const mode of[0,1]){const f=fixture(),g=f.deploy(key,mode);assert.ok(g,key+mode);f.tick(.25);assert.equal(f.army.units().length,S[key].rosters[mode].length);assert.equal(f.army.units().some(u=>u.type==='assault'||u.type==='production'),key==='x');}
  const f=fixture();f.world.stand=()=>false;assert.equal(f.deploy('q'),null);assert.equal(f.army.groups().length,0);
 });
 check('C bomb35, per-cast raw70 and warning; no explosion when shot, encircle once; LOS and last sight',()=>{
  for(const hz of[20,60,144]){const f=fixture();f.deploy('c');f.tick(.25,hz);for(const u of f.army.units()){u.x=0;u.z=-4.7;u.yaw=0;}f.tick(.25,hz);assert.equal(f.enemy.hp,1000);f.tick(.5,hz);assert.ok(f.damage.length);assert.ok(f.damage.reduce((s,e)=>s+e.n,0)<=70);assert.ok(f.army.wrecks().length);}
  const f=fixture();f.deploy('c');f.tick(.25);const u=f.army.units()[0];f.army.hit(u.id,50,'red',f.time(),f.world);assert.equal(f.damage.length,0);assert.ok(f.army.wrecks().some(r=>r.id===u.id));
  f.world.see=()=>false;f.tick(1);assert.equal(f.damage.length,0);assert.ok(f.army.units().every(u=>u.target===null));
 });
 check('capture two crabs nonstack2sec, independent flyer burst limits, no wall fire',()=>{
  const f=fixture();f.deploy('c',1);f.tick(.25);for(const u of f.army.units()){u.x=0;u.z=-4.8;u.yaw=0;}f.tick(.25);assert.equal(f.army.speedScale(f.enemy,f.time()),.6);f.tick(2.2);assert.equal(f.army.speedScale(f.enemy,f.time()),1);f.tick(3);assert.ok(f.army.units().filter(u=>u.type==='flyer').every(u=>u.sets<=2));assert.ok(f.damage.reduce((s,e)=>s+e.n,0)<=72);
  const blocked=fixture();blocked.deploy('c',1);blocked.world.see=()=>false;blocked.tick(6);assert.equal(blocked.damage.length,0);
 });
 check('shield both-team bullet interception, robot destruction and once40 armor; repair excludes player HP',()=>{
  const f=fixture();f.enemy.x=50;f.deploy('q',0);f.deploy('e',0);f.tick(.02);const units=f.army.units(),s=units.find(u=>u.type==='shield'),boss=units.find(u=>u.type==='supervisor'),repair=units.find(u=>u.type==='repair');boss.x=repair.x;boss.z=repair.z;boss.hp=60;f.tick(.5);assert.ok(boss.hp>60);assert.equal(boss.armor,40);boss.armor=10;f.tick(.5);assert.equal(boss.armor,10);assert.equal(f.owner.hp,undefined);
  const o={x:s.x,y:s.y+.8,z:s.z+2},d={x:0,y:0,z:-1};assert.equal(f.army.raycast(o,d,4,'blue').id,s.id);assert.equal(f.army.raycast(o,d,4,'red').id,s.id);f.army.hit(s.id,250,'blue',f.time(),f.world);assert.ok(!f.army.units().some(u=>u.id===s.id));
  const before=f.army.units().length;assert.equal(f.army.command(f.owner.id,'q',{x:0,y:0,z:-5},f.time(),f.world),false);assert.equal(f.army.units().length,before);
 });
 check('Q link and4m bound, turret fusion HP/no duplicates, one command, swept wire30percent cooldown',()=>{
  const f=fixture();f.deploy('q',0);const w=f.world;assert.ok(f.army.command(f.owner.id,'q',{x:0,y:0,z:-20},0,w));const shields=f.army.units().filter(u=>u.type==='shield');assert.equal(shields[0].link,shields[1].id);assert.ok(Math.hypot(shields[0].command.point.x-shields[0].x,shields[0].command.point.z-shields[0].z)<=4);assert.equal(f.army.command(f.owner.id,'q',{x:0,y:0,z:-2},0,w),false);
  const t=fixture();t.deploy('q',1);const turrets=t.army.units().filter(u=>u.type==='turret');turrets[1].x=turrets[0].x+.5;turrets[1].z=turrets[0].z;const hp=turrets.reduce((s,u)=>s+u.hp,0);assert.ok(t.army.command(t.owner.id,'q',{x:0,y:0,z:-4},0,t.world));assert.equal(t.army.units().filter(u=>u.type==='turret').length,1);assert.equal(t.army.units().find(u=>u.type==='turret').hp,hp);
  const wires=t.army.units().filter(u=>u.type==='wire');wires[0].x=-2;wires[0].z=0;wires[1].x=2;wires[1].z=0;t.world.move=()=>{};t.enemy.z=-2;t.tick(.05);t.enemy.z=2;t.tick(.05);assert.equal(t.army.speedScale(t.enemy,t.time()),.7);t.tick(1.1);assert.equal(t.army.speedScale(t.enemy,t.time()),1);
 });
 check('E fixed laser warning/max60, dash45 once per target, dismantler splits3 once; commands never cost stock',()=>{
  for(const hz of[20,60,144]){const f=fixture();f.deploy('e',0);const boss=f.army.units().find(u=>u.type==='supervisor');boss.x=0;boss.z=0;for(const u of f.army.units())if(u!==boss)u.endsAt=0;assert.ok(f.army.command(f.owner.id,'e',{x:0,y:0,z:-12},0,f.world));f.tick(.5,hz);assert.equal(f.damage.length,0);f.tick(1.31,hz);const total=f.damage.reduce((s,e)=>s+e.n,0);assert.ok(total>50&&total<=60.000001,total);}
  const d=fixture();d.deploy('e',1);const boss=d.army.units().find(u=>u.type==='dismantler');assert.ok(d.army.command(d.owner.id,'e',{x:0,y:0,z:-9},0,d.world));d.tick(1.3);assert.ok(d.damage.filter(e=>e.n===45).length<=1);d.army.hit(boss.id,200,'red',d.time(),d.world);assert.equal(d.army.units().filter(u=>u.type==='fragment').length,3);for(const f of d.army.units().filter(u=>u.type==='fragment'))d.army.hit(f.id,100,'red',d.time(),d.world);assert.equal(d.army.units().filter(u=>u.type==='fragment').length,0);
 });
 check('factories initial12/6; resupply max4>=1s, active12; production18, friendly wreck once, emergency<=4/life-3 and no recycling loop',()=>{
  const f=fixture();f.enemy.x=100;f.deploy('x',0);assert.equal(f.army.units().length,13);for(let i=0;i<7;i++){const u=f.army.units().find(u=>u.type!=='assault');if(u)f.army.hit(u.id,1000,'red',f.time(),f.world);f.tick(1.1);}assert.ok(f.army.groups()[0].replaced<=4);assert.ok(f.army.units().length<=13);const factory=f.army.units().find(u=>u.type==='assault');f.army.hit(factory.id,1000,'red',f.time(),f.world);const count=f.army.units().length;f.tick(1);assert.ok(f.army.units().length<=count);
  const p=fixture();p.enemy.x=100;p.deploy('x',1);assert.equal(p.army.units().length,7);p.deploy('c',0);p.tick(.25);for(const u of p.army.units().filter(u=>u.type==='bomb'))p.army.hit(u.id,100,'red',p.time(),p.world);p.tick(.1);const g=p.army.groups().find(g=>g.key==='x');assert.ok(g.materials>0);const old=p.army.units().find(u=>u.type==='production').endsAt;assert.ok(p.army.command(p.owner.id,'x',{x:0,y:0,z:0},p.time(),p.world));assert.equal(p.army.units().find(u=>u.type==='production').endsAt,old-3);assert.equal(p.army.command(p.owner.id,'x',{x:0,y:0,z:0},p.time(),p.world),false);for(let i=0;i<11;i++){for(const u of p.army.units().filter(u=>u.gid===g.id&&!T[u.type].factory&&!['repair'].includes(u.type)))p.army.hit(u.id,1000,'red',p.time(),p.world);p.tick(.6);}assert.ok(g.total<=18);assert.ok(p.army.wrecks().filter(w=>w.gid===g.id).every(w=>!w.recyclable));
 });
 check('owner/team/world limits, <=3 direct attackers; strict atomic JSON restore cannot execute combat and round cleanup',()=>{
  const f=fixture();f.enemy.x=0;f.enemy.z=-3;for(let i=0;i<4;i++)f.deploy('q',1);f.tick(.7);const packet=JSON.parse(JSON.stringify(f.army.snapshot())),guest=createRobotArmy();assert.ok(guest.restore(packet,f.time(),1));const before=guest.units().map(u=>u.hp);guest.update(5,1,f.actors,f.world);assert.deepEqual(guest.units().map(u=>u.hp),before);const bad=structuredClone(packet);bad.u[0][7]=-1;assert.equal(guest.restore(bad,f.time(),1),false);assert.deepEqual(guest.units().map(u=>u.hp),before);const duplicate=structuredClone(packet);duplicate.u.push(duplicate.u[0]);assert.equal(guest.restore(duplicate,f.time(),1),false);f.army.update(5,2,f.actors,f.world);assert.equal(f.army.units().length,0);assert.equal(f.army.wrecks().length,0);assert.equal(f.army.speedScale(f.enemy,5),1);
 });
 check('actual96-unit ceiling: owner32/team64/world96, >limit is atomic; all snapshots and 96-unit timing samples',()=>{
  const f=fixture();f.enemy.x=200;const owners=[f.owner,{...f.owner,id:'second',x:50},{...f.owner,id:'third',team:'red',x:100}];f.actors.push(...owners.slice(1));
  for(let k=0;k<3;k++)for(let i=0;i<8;i++){const p={x:k*50+(i%4)*6,y:0,z:Math.floor(i/4)*7,flight:.2};assert.ok(f.army.deploy(owners[k],'q',1,p,0,1,f.world));}
  assert.equal(f.army.units().length,96);assert.equal(f.army.counts(f.owner.id,'blue').owned,32);assert.equal(f.army.counts(f.owner.id,'blue').allied,64);assert.equal(f.army.deploy(owners[0],'c',0,{x:0,y:0,z:30},0,1,f.world),null);assert.equal(f.army.units().length,96);
  const sample=[];for(let i=0;i<180;i++){const start=performance.now();f.army.update(i/60,1,f.actors,f.world);sample.push(performance.now()-start);}sample.sort((a,b)=>a-b);const packet=JSON.parse(JSON.stringify(f.army.snapshot())),g=createRobotArmy();assert.ok(g.restore(packet,179/60,1));assert.equal(g.units().length,96);console.log(JSON.stringify({simulationOnly96:{p50ms:sample[90],p95ms:sample[171],maxms:sample[179],jsonBytes:Buffer.byteLength(JSON.stringify(packet))}}));
 });
 check('attack reservations: twelve visible turrets cannot directly hit with more than three in one frame',()=>{
  const f=fixture();f.enemy.z=-3;f.world.move=()=>{};for(let i=0;i<6;i++){const p={x:6*i,y:0,z:0};assert.ok(f.army.deploy(f.owner,'q',1,p,0,1,f.world));}for(const u of f.army.units())if(u.type==='turret'){u.x=0;u.yaw=0;u.z=-2;}let maximum=0;
  for(let i=0;i<120;i++){const before=f.damage.length;f.army.update(i/60,1,f.actors,f.world);maximum=Math.max(maximum,f.damage.length-before);}assert.ok(maximum>0&&maximum<=3,maximum);
 });
 console.log('PASS: '+groups+' robot simulation groups');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
