const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-car-game.cjs'),'utf8'),cut=fixture.indexOf('  const local=harness();');
if(cut<0)throw Error('Saved-game fixture anchor missing');
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("player.kit=new DuelistKit({character:'onnara'});player.kit.smoke=2;player.kit.updraft=1;player.kit.dash=1;match.phase='live';makeBot({x:0,z:-30},0,'red',{id:'enemy',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.remoteId='passive';enemy.fire=999;enemy.reactionUntil=999");}
 function step(seconds,hz=60,g=h,full=false){g.sandbox.seconds=seconds;g.sandbox.hz=hz;g.run(full?'for(let t=0;t<seconds-1e-8;t+=1/hz){updatePlay(Math.min(1/hz,seconds-t));peak=Math.max(peak,player.y)}':'for(let t=0;t<seconds-1e-8;t+=1/hz){var dt=Math.min(1/hz,seconds-t);elapsed+=dt;updateActorVertical(player,dt);peak=Math.max(peak,player.y)}');}
 check('C launches on keypress with no target; 20/60/144Hz full updatePlay peaks4.8m and lands without extra impulse',()=>{
  for(const hz of[20,60,144]){setup();h.run("var peak=0;useAbility('c')");assert.equal(h.run('duckAim'),null);assert.equal(h.run('player.kit.smoke'),1);assert.equal(h.run('player.vy'),12);h.run("useAbility('c')");assert.equal(h.run('player.kit.smoke'),1);step(1.8,hz,h,true);near(h.run('peak'),4.8,'peak',.006);near(h.run('player.y'),0,'land');assert.equal(h.run('player.vy'),0);assert.equal(h.run("ordinarySkills.events(elapsed).some(e=>e.type==='onnara-tax')"),false);h.run("useAbility('c')");assert.equal(h.run('player.kit.smoke'),0);assert.equal(h.run('player.vy'),12);}
 });
 check('ceiling collision stops ascent; existing gravity resumes instead of passing through roof',()=>{
  setup();h.run("map.colliders.push({minX:-2,maxX:2,minZ:-2,maxZ:2,base:3,height:3.3});map.collision=createCollisionIndex(map.colliders);var peak=0;activateAbility(player,'c')");step(1.8);assert.ok(h.run('peak')<=1.300001);assert.ok(h.run('peak')>1.2);near(h.run('player.y'),0,'ceiling landing');
 });
 check('E can hold the jump height for13s, then ordinary gravity returns; Q and X stay independent',()=>{
  setup();h.run("var peak=0;activateAbility(player,'c')");step(.8);near(h.run('player.y'),4.8,'apex');h.run("activateAbility(player,'e');var heldY=player.y");step(12.9);near(h.run('player.y'),h.run('heldY'),'13s hold');step(.3);assert.ok(h.run('player.y')<h.run('heldY'));assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('enemy.record.credits'),800);
 });
 check('airborne, work, phase, death, seal and full20event queue refuse without inventory or velocity mutation',()=>{
  for(const block of["player.y=1;player.vy=1","player.planting=true","player.defusing=true","player.alive=false;player.hp=0","match.phase='buy'","netHostPaused=true","ordinarySkills.cast('duck-seal',ordinaryActorView(enemy),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round)","for(let i=0;i<20;i++)ordinarySkills.cast('onnara-chain',{...ordinaryActorView(player),id:'source'+i},ordinaryActorView(player),elapsed,match.round)"]){setup();h.run(block);const stock=copy(h.run('player.kit.snapshot()')),vy=h.run('player.vy');assert.equal(h.run("activateAbility(player,'c')"),undefined,block);assert.deepEqual(copy(h.run('player.kit.snapshot()')),stock);assert.equal(h.run('player.vy'),vy);}
 });
 check('new jump uses strict16field self event and rejects forged fields/range/time; restored state never relaunches actor',()=>{
  setup();h.run("activateAbility(player,'c');var event=ordinarySkills.onnaraEvent('onnara-jump',player.id,elapsed)");const e=copy(h.run('event'));assert.equal(Object.keys(e).length,16);const skills=h.sandbox.createCharacterSkills();assert.ok(skills.restore({events:[e],blinds:[],markers:[]},e.startedAt,e.round));
  for(const mutate of[x=>x.power=300,x=>x.targetId='enemy',x=>x.x+=1,x=>x.endsAt+=1]){const bad=copy(e);mutate(bad);assert.equal(skills.restore({events:[bad],blinds:[],markers:[]},e.startedAt,e.round),false);}
  h.run('player.vy=0;updateOrdinarySkills();updateOrdinarySkills()');assert.equal(h.run('player.vy'),0);
 });
 function peers(){const host=harness(),guest=harness();setup(host);guest.reset();host.run("enemy.kit=new DuelistKit({character:'onnara'});enemy.kit.smoke=2;enemy.remoteId='guest';enemy.netWeapon='classic';enemy.netAmmo=12;enemy.netReserve=36;enemy.netReload=0;onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=JSON.parse(JSON.stringify(p))}};netParticipants.set('guest',enemy.id);var captured;netClock=0;tickOnline(.1)");guest.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send(){}};netParticipants.set('guest','enemy')");guest.sandbox.packet=copy(host.run('captured'));guest.run("receiveNetPacket('host',packet)");return{host,guest};}
 function request(p){p.guest.run("useAbility('c')");p.host.sandbox.request={type:'input',seq:1,connection:'jump',round:p.host.run('match.round'),input:{x:0,y:0,z:-30,yaw:0,pitch:0},actions:copy(p.guest.run('netActions'))};p.host.run("receiveNetPacket('guest',request);updateRemoteActor(enemy,.05);elapsed+=.05;updateRemoteActor(enemy,.05);netClock=0;tickOnline(.1)");}
 function ack(p){p.guest.sandbox.packet=copy(p.host.run('captured'));p.guest.run("receiveNetPacket('host',packet)");}
 check('independent host/guest predicts one impulse; authoritative ACK and duplicate snapshot cannot boost it again',()=>{
  const p=peers();request(p);assert.equal(p.guest.run('player.vy'),12);assert.equal(p.host.run('enemy.kit.smoke'),1);assert.ok(p.host.run('enemy.y')>0);assert.ok(p.host.run('enemy.vy')>11);assert.ok(p.host.run("ordinarySkills.onnaraEvent('onnara-jump',enemy.id,elapsed)"),'airborne event survives movementScale');p.guest.run('var peak=0');step(.2,60,p.guest);const vy=p.guest.run('player.vy');ack(p);near(p.guest.run('player.vy'),vy,'ACK keeps newer jump');ack(p);near(p.guest.run('player.vy'),vy,'duplicate no boost');assert.equal(p.guest.run('player.onnaraJumpPending'),null);
 });
 check('host20event refusal rolls back predicted stock and vertical pose on ACK; full outgoing64action queue never launches',()=>{
  const p=peers();p.host.run("for(let i=0;i<20;i++)ordinarySkills.cast('onnara-chain',{...ordinaryActorView(player),id:'source'+i},ordinaryActorView(player),elapsed,match.round)");request(p);assert.equal(p.guest.run('player.vy'),12);assert.equal(p.host.run('enemy.kit.smoke'),2);assert.ok(p.guest.run('player.onnaraJumpPending'),'pending before refusal ACK');ack(p);assert.equal(p.guest.run('player.kit.smoke'),2);assert.equal(p.guest.run('player.y'),0);assert.equal(p.guest.run('player.vy'),0);
  const q=peers();q.guest.run("netActions=Array.from({length:64},(_,i)=>({seq:i+1,type:'reload',round:match.round}));useAbility('c')");assert.equal(q.guest.run('player.vy'),0);assert.equal(q.guest.run('player.kit.smoke'),2);
 });
 check('host jump physics caps spoofed remote height on both regular and TRC movement paths',()=>{
  for(const trc of[false,true]){const g=trc?harness({realMap:true}):h;setup(g);if(trc)g.run("selectArena('trc');Object.assign(enemy,map.teamSpawns.attack[0],{y:0})");g.run("enemy.kit=new DuelistKit({character:'onnara'});enemy.kit.smoke=2;enemy.remoteId='guest';onlinePlaying=true;online={host:true,session:{memberId:'host'}};activateAbility(enemy,'c');netInputs.set('guest',{seq:1,connection:'jump',round:match.round,received:elapsed,actions:[],input:{x:enemy.x,y:999,z:enemy.z,yaw:0,pitch:0}});var maxY=0;for(let i=0;i<90;i++){elapsed+=1/60;netInputs.get('guest').received=elapsed;updateRemoteActor(enemy,1/60);maxY=Math.max(maxY,enemy.y)}");near(g.run('maxY'),4.8,'remote peak',.006);assert.ok(g.run('enemy.y')<1.3);}
 });
 check('gold jump sigil stays at feet; death/team/round/menu remove event and prediction state',()=>{
  setup();h.run("activateAbility(player,'c');var peak=0");step(.2);h.run('updateOrdinarySkills();renderOrdinarySkills()');assert.ok(h.run("onnaraSkillFX.group.children.some(o=>o.name.startsWith('onnara-jump'))"));near(h.run("onnaraSkillFX.group.children.find(o=>o.name.startsWith('onnara-jump')).position.y"),h.run('player.y')+.08,'foot sigil');assert.equal(h.run("onnaraSkillFX.group.children.find(o=>o.name.startsWith('onnara-jump')).children.length"),2);
  for(const cleanup of["player.alive=false;player.hp=0;updateOrdinarySkills()","player.team='red';updateOrdinarySkills()","match.round++;resetOrdinarySkills()","backMenu()"]){setup();h.run("activateAbility(player,'c');player.onnaraJumpPending={seq:1,round:match.round,team:player.team}");h.run(cleanup);assert.equal(h.run("ordinarySkills.onnaraEvent('onnara-jump',player.id,elapsed)"),null);assert.equal(h.run('player.onnaraJumpPending'),null);}
 });
 console.log('PASS: '+groups+' actual savedgame ONNARA jump groups; no audio playback');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
`;
const instance=new Module(__filename,module);instance.filename=__filename;instance.paths=module.paths;instance._compile(fixture.slice(0,cut)+suite,__filename);
