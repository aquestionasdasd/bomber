const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');if(cut<0)throw Error('Saved game harness missing');
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("player.kit=new DuelistKit({character:'urchin'});player.kit.smoke=2;match.phase='live';makeBot({x:2,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic'});var enemy=bots[0];enemy.remoteId='passive';enemy.hp=100;enemy.armor=0;enemy.reactionUntil=999;enemy.fire=999;soundEnabled=true;volume=.5;audioEvents.length=0;");}
 function mouse(button,g=h){for(const fn of g.listeners.get('game:mousedown')||[])fn({button,preventDefault(){}});}
 const event=()=>h.run("ordinarySkills.events(elapsed).find(e=>e.type==='urchin-lance')");
 const pulses=()=>h.run('ordinarySkills.lancePulses(elapsed).filter(p=>p.kind===0)');
 function step(seconds,hz=60){h.sandbox.seconds=seconds;h.sandbox.hz=hz;h.run('for(let t=0;t<seconds-1e-8;t+=1/hz)updatePlay(Math.min(1/hz,seconds-t))');}
 function cast(){h.run("useAbility('c')");mouse(0);assert.ok(event());}
 check('C aiming follows geometry only; right/equip cancel free; left consumes one and cannot shoot while aiming',()=>{
  setup();h.run("useAbility('c');renderOrdinarySkills()");assert.equal(h.run('duckAim'),'c');assert.equal(event(),undefined);assert.equal(h.run('player.kit.smoke'),2);const a=copy(h.run('urchinLancePreview()'));h.run('enemy.x=0;enemy.z=-4');assert.deepEqual(copy(h.run('urchinLancePreview()')),a);h.run('player.yaw=.5');assert.notEqual(h.run('urchinLancePreview().x'),a.x);h.run('shoot()');assert.equal(h.run('shotSequence'),0);mouse(2);assert.equal(h.run('duckAim'),null);assert.equal(h.run('player.kit.smoke'),2);h.run("useAbility('c');equip('knife',true)");assert.equal(h.run('duckAim'),null);assert.equal(h.run('player.kit.smoke'),2);
  cast();assert.equal(h.run('player.kit.smoke'),1);assert.equal(h.run('shotSequence'),0);assert.equal(h.run('duckAim'),null);const e=copy(event());h.run('player.yaw=1;player.x=3');assert.deepEqual(copy(event()),e);
 });
 check('20/60/144Hz real frames strike once at shared .65 clock and retain rift2.5 seconds',()=>{
  for(const hz of[20,60,144]){setup();h.run('enemy.x=0');cast();const e=event();step(.64,hz);assert.equal(h.run('enemy.hp'),100);step(.01,hz);assert.equal(h.run('enemy.hp'),20);assert.ok(h.run('ordinarySkills.lancePulses(elapsed).some(p=>p.kind===1)'));step(2.49,hz);assert.ok(event());assert.equal(h.run('enemy.hp'),20);step(.011,hz);assert.equal(event(),undefined);assert.equal(pulses().length,0);near(e.endsAt-e.triggerAt,2.5,'residual');}
 });
 check('swept grounded crossing signals immutable world splash once; still/reentry cooldown and zero residual damage',()=>{
  for(const hz of[20,60,144]){setup();cast();step(.66,hz);h.run('enemy.x=-2;updatePlay(1/'+hz+')');assert.equal(pulses().length,1);assert.equal(h.run('enemy.hp'),100);const p=copy(pulses()[0]);assert.ok(Math.abs(p.x-.65)<.001);assert.ok(!('targetId' in p));h.run('enemy.x=0;updatePlay(1/'+hz+')');assert.equal(pulses().length,1);assert.equal(pulses()[0].x,p.x);const count=h.run("audioEvents.filter(e=>e.type==='urchin-rift-splash').length");assert.equal(count,1);step(.1,hz);assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-rift-splash').length"),count);h.run('enemy.x=2;updatePlay(1/'+hz+');enemy.x=-2;updatePlay(1/'+hz+')');assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-rift-splash').length"),count);step(.55,hz);h.run('enemy.x=2;updatePlay(1/'+hz+')');assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-rift-splash').length"),2);assert.equal(h.run('enemy.hp'),100);}
 });
 check('airborne crossing silent; initial occupant no entry double; independent two casts and round cleanup',()=>{
  setup();cast();step(.66);h.run('enemy.y=2;enemy.vy=0;enemy.x=-2;updatePlay(.016)');assert.equal(pulses().length,0);
  setup();h.run('enemy.x=0');cast();step(.66);assert.equal(pulses().length,0);assert.equal(h.run('enemy.hp'),20);h.run('enemy.x=2;updatePlay(.016)');cast();step(.66);h.run('enemy.x=-2;updatePlay(.016)');assert.equal(pulses().length,2);assert.equal(h.run('player.kit.smoke'),0);h.run('match.round++;resetOrdinarySkills();renderOrdinarySkills()');assert.equal(pulses().length,0);assert.equal(h.run('urchinSkillFX.group.children.length'),0);
 });
 check('world audio pressure/hit/splash dedup, distance attenuation, ground occlusion and no exact enemy marker',()=>{
  setup();cast();step(.55);assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-lance-pressure').length"),1);step(.12);h.wall({z:-5,width:8,height:1});h.run('enemy.x=-2;updatePlay(.016)');const sounds=copy(h.run("audioEvents.filter(e=>e.type==='urchin-rift-splash')"));assert.equal(sounds.length,1);assert.equal(sounds[0].options.occluded,true);assert.ok(sounds[0].options.distance>9);h.run('updateOrdinarySkills()');assert.equal(h.run("audioEvents.filter(e=>e.type==='urchin-rift-splash').length"),1);assert.equal(h.run("ordinarySkills.markers('blue',elapsed).length"),0);const heard=h.run("botHearing.listen({id:'listener',alive:true,team:'blue',x:1,y:0,z:-9},elapsed,{occluded:()=>false})");assert.ok(heard);assert.ok(!('targetId' in heard));
 });
 check('strict pulse JSON is visual-only after independent restoration and rejects forged coordinates/time/kind',()=>{
  setup();cast();step(.66);h.run('enemy.x=-2;updatePlay(.016)');const state=copy(h.run('ordinarySkills.snapshot()')),now=h.run('elapsed'),round=h.run('match.round'),g=imported.createCharacterSkills();assert.equal(state.rifts.length,1);assert.ok(g.restore(state,now,round));assert.deepEqual(g.update(copy(h.run('[player,enemy].map(({id,team,x,y,z,hp,alive})=>({id,team,x,y,z,hp,alive,grounded:true}))')),now+.01,round,{reachable:()=>true,lanceGroundHeight:()=>0}),[]);assert.equal(g.lancePulses(now+.01).length,1);for(const edit of[r=>r[2]=99999,r=>r[5]+=9999,r=>r[6]=3,r=>r.push(0)]){const bad=copy(state);edit(bad.rifts[0]);assert.equal(g.restore(bad,now,round),false);}
 });
 console.log('PASS: '+groups+' C rift actual saved-game/full-frame/input/audio/JSON groups; mock audio only');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
const prefix=fixture.slice(0,cut).replace('addEventListener() {}, setAttribute',"addEventListener(type,fn) {const k=this.id+':'+type;if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(fn);}, setAttribute");
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(prefix+suite,__filename);
