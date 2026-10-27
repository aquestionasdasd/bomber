const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{pathToFileURL}=require('node:url');
const root=path.join(__dirname,'public'),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),copy=x=>JSON.parse(JSON.stringify(x));
async function engine(fault=''){
 let source=fs.readFileSync(path.join(root,'character-skills.js'),'utf8');
 if(fault==='range'){const a="type==='renko-dart' ? Math.hypot(target.x-actor.x,target.y-sourceEyeY,target.z-actor.z)>1e-8";assert.ok(source.includes(a));source=source.replace(a,"type==='renko-dart' ? Math.hypot(target.x-actor.x,target.y-sourceEyeY,target.z-actor.z)<=40");}
 if(fault==='lifetime'){const a="return{...specs['renko-dart'],flight,tail:flight+.5}";assert.ok(source.includes(a));source=source.replace(a,"return{...specs['renko-dart'],flight:.5,tail:1}");}
 source=source.replace(/from '(\.\/[^']+)'/g,(_,p)=>"from '"+pathToFileURL(path.join(root,p)).href+"'");return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
async function verifyEngine(fault=''){
 const {createCharacterSkills,skillProjectilePosition}=await engine(fault),a={id:'caster',team:'blue',x:0,y:0,z:0,hp:100,alive:true},enemy={id:'enemy',team:'red',x:0,y:0,z:-200,hp:100,alive:true};
 const pool=createCharacterSkills(),e=pool.cast('renko-dart',a,{x:0,y:1.7,z:-300},10,1);assert.ok(e);near(e.flight,3.75);near(e.endsAt,14.25);near(skillProjectilePosition(e,11).z,-80);
 assert.ok(pool.events(11.5).length,'far projectile survives old one-second lifetime');
 const wire=copy(pool.snapshot()),guest=createCharacterSkills();assert.equal(guest.restore(wire,11.5,1),true);assert.deepEqual(guest.update([a,enemy],12.5,1,{projectileClear:()=>true}),[],'restored data has no hit authority');
 for(const mutate of[e=>e.flight+=1,e=>e.endsAt+=1,e=>e.x=1001,e=>e.damage=0,e=>e.flight=Infinity]){const bad=copy(wire);mutate(bad.events[0]);assert.equal(createCharacterSkills().restore(bad,11.5,1),false);}
 assert.deepEqual(pool.update([a,enemy],11.5,1,{projectileClear:()=>true}),[]);const hits=pool.update([a,enemy],12.5,1,{projectileClear:()=>true});assert.equal(hits.length,1);assert.equal(hits[0].type,'renko-push');assert.equal(hits[0].targetId,'enemy');assert.deepEqual(pool.update([a,enemy],12.6,1,{projectileClear:()=>true}),[]);assert.equal(enemy.hp,100);
 const wall=createCharacterSkills();wall.cast('renko-dart',a,{x:0,y:1.7,z:-300},10,1);assert.deepEqual(wall.update([a,enemy],12.5,1,{projectileClear:(_,b)=>b.z>-100}),[]);assert.equal(wall.events(12.5).length,0,'distant wall consumes projectile');
 const clean=createCharacterSkills();clean.cast('renko-dart',a,{x:0,y:1.7,z:-300},10,1);clean.update([a,enemy],10.1,2);assert.equal(clean.events(10.1).length,0,'next round clears long flight');
}
async function game(){
 const base=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=base.indexOf(' const h=harness();');assert.ok(cut>0);
 const m=new Module(path.join(__dirname,'renko-range-harness.cjs'),module);m.filename=path.join(__dirname,'renko-range-harness.cjs');m.paths=module.paths;m._compile(base.slice(0,cut)+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const {harness}=await m.exports(),h=harness();
 function setup(){h.reset();h.clearWalls();h.run("match.phase='live';match.roundTime=90;player.kit=new DuelistKit({character:'renko'});player.kit.smoke=2;Object.assign(player,{x:0,z:70,yaw:0,pitch:0});makeBot({x:0,z:-70},0,'red',{id:'far',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.remoteId='passive';enemy.hp=100;enemy.armor=50;enemy.fire=999;enemy.reactionUntil=999");}
 function step(seconds,hz=60){h.sandbox.seconds=seconds;h.sandbox.hz=hz;h.run('for(let t=0;t<seconds-1e-8;t+=1/hz)updatePlay(Math.min(1/hz,seconds-t))');}
 for(const bounds of[{minX:-82,maxX:82,minZ:-82,maxZ:82},{minX:-112,maxX:112,minZ:-112,maxZ:112},{minX:-55,maxX:55,minZ:-70,maxZ:70}]){
  setup();h.sandbox.bounds=bounds;h.run('map.bounds=bounds;player.x=0;player.z=0');const e=h.run('renkoDartTarget(player,{yaw:0,pitch:0})');near(e.z,bounds.minZ);assert.ok(Math.hypot(e.x,e.z)>40);
  const diagonal=h.run('renkoDartTarget(player,{yaw:Math.PI/4,pitch:.2})');assert.ok(diagonal.x>=bounds.minX&&diagonal.z>=bounds.minZ);assert.ok(Math.abs(diagonal.x-bounds.minX)<1e-7||Math.abs(diagonal.z-bounds.minZ)<1e-7);
 }
 console.log('PASS: both station bounds/practice/TRC world endpoints and diagonal remain finite beyond40m');
 // Restore each case's full fixture map after the bound-only checks above.
 for(const hz of[20,60,144]){setup();h.run('map.bounds={minX:-82,maxX:82,minZ:-82,maxZ:82};useAbility(\'c\')');assert.equal(h.run('player.kit.smoke'),1);step(1,hz);assert.equal(h.run('enemy.carMotion'),undefined);assert.equal(h.run('ordinarySkills.events(elapsed).filter(e=>e.type===\'renko-dart\').length'),1);step(.85,hz);assert.equal(h.run('enemy.carMotion.phase'),4);assert.equal(h.run('enemy.hp+enemy.armor'),150);assert.equal(h.run('totalKills'),0);assert.equal(h.run('match.credits'),800);}
 console.log('PASS: actual full frames20/60/144Hz cross140m and push with zero damage/rewards');
 setup();h.wall({z:-20,width:8});h.run("map.collision=createCollisionIndex(map.colliders);useAbility('c')");step(2);assert.equal(h.run('enemy.carMotion'),undefined);assert.equal(h.run('ordinarySkills.events(elapsed).length'),0);
 setup();h.run("useAbility('c');enemy.x=6");step(2);assert.equal(h.run('enemy.carMotion'),undefined);
 setup();h.run("enemy.x=60;useAbility('c')");step(2.2);assert.equal(h.run('ordinarySkills.events(elapsed).length'),0,'empty ray disappears at world edge');
 console.log('PASS: distant wall stops, target can dodge, empty ray expires at map edge');
}
(async()=>{await verifyEngine();console.log('PASS: dynamic lifetime/strict JSON/host-only hit/wall/round cleanup');for(const f of['range','lifetime']){await assert.rejects(()=>verifyEngine(f),{code:'ERR_ASSERTION'});console.log('PASS detects memory-only '+f+' fault')}await game()})().catch(e=>{console.error(e);process.exitCode=1});
