const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{pathToFileURL}=require('node:url');
const root=path.join(__dirname,'public'),fault=process.argv.find(x=>x.startsWith('--fault='))?.slice(8);
const faults={
 hitwall:["if(!Number.isFinite(t))continue;if(!hit||t<hit.t)","if(!Number.isFinite(t))continue;if(!projectileClear?.({x:e.fromX,y:e.fromY,z:e.fromZ},{x:a.x,y:eyeY(a),z:a.z},RENKO_SKILLS.dartRadius))continue;if(!hit||t<hit.t)"],
 transitwall:["else if(hi>=length-1e-8){owned.delete(id);active.delete(id);}","else if(hi>=length-1e-8||!projectileClear?.({x:e.fromX,y:e.fromY,z:e.fromZ},{x:e.fromX+dx*hi,y:e.fromY+dy*hi,z:e.fromZ+dz*hi},RENKO_SKILLS.dartRadius)){owned.delete(id);active.delete(id);}"],
 authority:["for(const id of owned){const e=active.get(id);if(e?.type!=='renko-dart')continue;","for(const id of active.keys()){const e=active.get(id);if(e?.type!=='renko-dart')continue;"],
 radius:['r=RENKO_SKILLS.dartRadius+.42','r=.42']
};
async function main(){
 const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');assert.ok(cut>0);let prefix=fixture.slice(0,cut);
 const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;
 m.loadPublic=file=>{
  file=file.replace(/^\.\//,'');
  if(file!=='character-skills.js'||!fault)return import(pathToFileURL(path.join(root,file)).href);
  let s=fs.readFileSync(path.join(root,file),'utf8');const [a,b]=faults[fault]||[];assert.ok(a&&s.includes(a),'memory fault anchor exists');s=s.replace(a,b);
  if(fault==='hitwall'||fault==='transitwall')s=s.replace('{ reachable, cameraSweep } = {}','{ reachable, projectileClear=()=>false, cameraSweep } = {}');
  s=s.replace(/from '(\.\/[^']+)'/g,(_,rel)=>"from '"+pathToFileURL(path.join(root,rel)).href+"'");return import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
 };
 const anchor="const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);";assert.ok(prefix.includes(anchor));prefix=prefix.replace(anchor,'const load = file => module.loadPublic(file);');
 m._compile(prefix+'\nreturn {harness,createCharacterSkills:imported.createCharacterSkills};\n}\nmodule.exports=main;',__filename);
 const{harness,createCharacterSkills}=await m.exports(),h=harness();let groups=0;const check=(name,fn)=>{fn();groups++;console.log('PASS: '+name)},copy=x=>JSON.parse(JSON.stringify(x));
 function setup(g=h,z=-24){g.reset();g.clearWalls();g.sandbox.enemyZ=z;g.run("match.phase='live';match.roundTime=90;player.kit=new DuelistKit({character:'renko'});player.kit.smoke=2;makeBot({x:0,z:enemyZ},0,'red',{id:'enemy',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.remoteId='passive';enemy.hp=100;enemy.armor=50;enemy.fire=999;enemy.reactionUntil=999");}
 function walls(g=h){for(const z of[-6,-12,-18])g.wall({z,width:12});g.run('map.collision=createCollisionIndex(map.colliders)');}
 function step(t,g=h,hz=60){g.sandbox.duration=t;g.sandbox.hz=hz;g.run('for(let i=0;i<duration-1e-8;i+=1/hz)updatePlay(Math.min(1/hz,duration-i))');}
 check('actual full frames20/60/144Hz pass three walls, sweep one enemy and retain HP armor rewards',()=>{
  for(const hz of[20,60,144]){setup();walls();h.run("var pushCount=0;var originalBegin=beginCarMotion;beginCarMotion=(...a)=>{pushCount++;return originalBegin(...a)};useAbility('c')");step(.1,h,hz);assert.equal(h.run('pushCount'),0);assert.equal(h.run("ordinarySkills.events(elapsed).filter(e=>e.type==='renko-dart').length"),1,'persists after first wall');step(.25,h,hz);assert.equal(h.run('pushCount'),1);assert.equal(h.run('enemy.carMotion.phase'),4);assert.equal(h.run('enemy.hp+enemy.armor'),150);assert.equal(h.run('totalKills'),0);assert.equal(h.run('match.credits'),800);step(.4,h,hz);assert.equal(h.run('pushCount'),1);h.run('beginCarMotion=originalBegin');}
 });
 check('first enemy consumes dart; friendly actor and hidden wall do not consume or change aim',()=>{
  setup();walls();h.run("makeBot({x:0,z:-10},1,'blue',{id:'ally',team:'blue',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});makeBot({x:0,z:-40},2,'red',{id:'far',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});for(const a of bots)a.remoteId='passive';useAbility('c')");step(.6);assert.equal(h.run('enemy.carMotion.phase'),4);assert.equal(h.run('bots[1].carMotion'),undefined);assert.equal(h.run('bots[2].carMotion'),undefined);assert.equal(h.run("ordinarySkills.events(elapsed).some(e=>e.type==='renko-dart')"),false);
 });
 check('dodge, visible .91m contact radius and empty world endpoint are retained behind walls',()=>{
  for(const [x,hit]of[[1.2,true],[1.5,false]]){setup();walls();h.sandbox.offset=x;h.run("enemy.x=offset;useAbility('c')");step(.4);assert.equal(h.run('!!enemy.carMotion'),hit);}
  setup();walls();h.run("useAbility('c');enemy.x=5");step(.4);assert.equal(h.run('enemy.carMotion'),undefined);assert.equal(h.run("ordinarySkills.events(elapsed).filter(e=>e.type==='renko-dart').length"),1);step(.7);assert.equal(h.run('ordinarySkills.events(elapsed).length'),0);
 });
 check('ground and ceiling geometry permit projectile travel while pushed actor still collides with wall',()=>{
  const a={id:'caster',team:'blue',x:0,y:0,z:0,hp:100,alive:true};
  for(const y of[-6,6]){const pool=createCharacterSkills(),target={x:0,y:y+1.7,z:-12},enemy={id:'victim',team:'red',x:0,y,z:-12,hp:100,alive:true};assert.ok(pool.cast('renko-dart',a,target,10,1));assert.equal(pool.update([a,enemy],10.3,1,{reachable:()=>false,projectileClear:()=>false})[0].targetId,'victim');}
  setup(h,-12);h.wall({z:-6,width:12});h.wall({z:-15,width:12});h.run("map.collision=createCollisionIndex(map.colliders);useAbility('c')");step(.8);assert.ok(h.run('enemy.z')>-14.8,'push itself stays on near side of back wall');assert.ok(h.run('enemy.z')<-12);assert.equal(h.run('enemy.hp+enemy.armor'),150);
 });
 check('restored strict16field flight cannot cause hits; malformed data and next round clear normally',()=>{
  const pool=createCharacterSkills(),a={id:'caster',team:'blue',x:0,y:0,z:0,hp:100,alive:true},enemy={id:'victim',team:'red',x:0,y:0,z:-20,hp:100,alive:true};const e=pool.cast('renko-dart',a,{x:0,y:1.7,z:-82},10,1),wire=copy(pool.snapshot());assert.equal(Object.keys(e).length,16);
  const guest=createCharacterSkills();assert.equal(guest.restore(wire,10.1,1),true);assert.deepEqual(guest.update([a,enemy],10.3,1,{projectileClear:()=>false}),[]);
  for(const change of[e=>e.radius=1.3,e=>e.damage=1,e=>e.endsAt+=1,e=>e.flight=.1]){const bad=copy(wire);change(bad.events[0]);assert.equal(createCharacterSkills().restore(bad,10.1,1),false);}
  pool.update([a,enemy],10.1,2);assert.equal(pool.events(10.1).length,0);
 });
 check('independent guest receives only host confirmed push through wall with no HP damage',()=>{
  const host=harness(),guest=harness();setup(host,-12);guest.reset();for(const z of[-4,-8])host.wall({z,width:12});host.run('map.collision=createCollisionIndex(map.colliders)');
  host.run("enemy.remoteId='guest';onlinePlaying=true;online={host:true,room:{code:'ABCDEFGH'},session:{memberId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest',enemy.id);var captured;netClock=0;tickOnline(.1)");guest.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send(){}};netParticipants.set('guest','enemy')");guest.sandbox.packet=copy(host.run('captured'));guest.run("receiveNetPacket('host',packet)");host.run("useAbility('c')");step(.2,host);host.run('netClock=0;tickOnline(.1)');assert.equal(host.run('enemy.carMotion.phase'),4);guest.sandbox.packet=copy(host.run('captured'));guest.run("receiveNetPacket('host',packet)");assert.equal(guest.run('player.carMotion.phase'),4);assert.equal(guest.run('player.hp+player.armor'),150);assert.equal(guest.run('carStunUntil(player)'),guest.run('player.carMotion.endsAt'));
 });
 console.log('PASS: '+groups+' actual savedgame Renko wall piercing/authority groups; audio inert');
}
if(process.argv.includes('--negative')){
 const{spawnSync}=require('node:child_process');for(const f of Object.keys(faults)){const r=spawnSync(process.execPath,[__filename,'--fault='+f],{cwd:__dirname,encoding:'utf8',timeout:180000});assert.equal(r.error,undefined);assert.notEqual(r.status,0,f);assert.match(r.stderr,/AssertionError/,f+' must fail a behavioral assertion');console.log('PASS memory-only fault: '+f);}
}else main().catch(e=>{console.error(e);process.exitCode=1;});
