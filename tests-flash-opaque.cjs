const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),boundary=fixture.indexOf(' const h=harness();');
if(boundary<0)throw Error('Saved-game harness missing');
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("mode='play';match.phase='live';makeBot({x:0,z:-5},0,'red',{id:'flash-caster',team:'red',secondary:'classic'});bots[0].remoteId='passive';player.yaw=0;");}
 function step(g,seconds,hz=60){g.sandbox.seconds=seconds;g.sandbox.hz=hz;g.run('for(let t=0;t<seconds-1e-8;t+=1/hz){updatePlay(Math.min(1/hz,seconds-t));renderOrdinarySkills()}');}
 function screen(g=h){const e=g.elements.get('skill-blind-overlay');return{hidden:e.hidden,opacity:Number(e.style.opacity)};}
 function cast(g,type){g.sandbox.flashType=type;assert.ok(g.run("ordinarySkills.cast(flashType,ordinaryActorView(bots[0]),{x:0,y:1.6,z:-5},elapsed,match.round)"));}
 check('actual NOPE and ECHO flashes fully hide the scene for every blind frame at20/60/144Hz, including the last microsecond',()=>{
   for(const type of['nope-flash','echo-glint'])for(const hz of[20,60,144]){setup();cast(h,type);step(h,1.05,hz);const deadline=h.run('ordinarySkills.blindUntil(player.id,elapsed)');assert.ok(deadline>h.run('elapsed'),type+' actual blind');
     while(h.run('elapsed')+1/hz<deadline){assert.deepEqual(screen(),{hidden:false,opacity:1});step(h,1/hz,hz);}
     h.sandbox.deadline=deadline;h.run('elapsed=deadline-.000001;renderOrdinarySkills()');assert.deepEqual(screen(),{hidden:false,opacity:1});h.run('elapsed=deadline;renderOrdinarySkills()');assert.deepEqual(screen(),{hidden:true,opacity:0});
   }
 });
 check('a shot NOPE decoy uses the same opaque screen with unchanged real blind deadline',()=>{
   setup();assert.ok(h.seed('red',0,-5));h.run('var fake=allNopeDecoys()[0];hitNopeDecoy(fake,player);renderOrdinarySkills()');assert.ok(h.run('ordinarySkills.blindUntil(player.id,elapsed)>elapsed'));assert.deepEqual(screen(),{hidden:false,opacity:1});const deadline=h.run('ordinarySkills.blindUntil(player.id,elapsed)');near(deadline-h.run('elapsed'),h.run('NOPE_SKILLS.flashDuration'),'decoy duration');
 });
 check('independent JSON blind snapshot shows the same opaque screen, rejects invented deadlines and clears at the host deadline',()=>{
   setup();cast(h,'nope-flash');step(h,1.05);const guest=harness();setup(guest);const packet=copy(h.run('({state:ordinarySkills.snapshot(player.team),time:elapsed,round:match.round})'));guest.sandbox.packet=packet;assert.ok(guest.run('elapsed=packet.time;ordinarySkills.restore(packet.state,elapsed,packet.round)'));guest.run('renderOrdinarySkills()');assert.deepEqual(screen(guest),{hidden:false,opacity:1});near(guest.run('ordinarySkills.blindUntil(player.id,elapsed)'),h.run('ordinarySkills.blindUntil(player.id,elapsed)'),'JSON deadline');
   const bad=copy(packet);bad.state.blinds[0].endsAt+=100;guest.sandbox.bad=bad;assert.equal(guest.run('ordinarySkills.restore(bad.state,bad.time,bad.round)'),false);guest.run('elapsed=ordinarySkills.blindUntil(player.id,elapsed);renderOrdinarySkills()');assert.deepEqual(screen(guest),{hidden:true,opacity:0});
 });
 check('pause, menu and reset hide the mask immediately; resume preserves the original deadline',()=>{
   setup();cast(h,'nope-flash');step(h,1.05);const deadline=h.run('ordinarySkills.blindUntil(player.id,elapsed)');for(const mode of['pause','menu']){h.sandbox.nextMode=mode;h.run('mode=nextMode;renderOrdinarySkills()');assert.deepEqual(screen(),{hidden:true,opacity:0});}h.run("mode='play';renderOrdinarySkills()");assert.deepEqual(screen(),{hidden:false,opacity:1});near(h.run('ordinarySkills.blindUntil(player.id,elapsed)'),deadline,'resume deadline');h.run('resetOrdinarySkills()');assert.deepEqual(screen(),{hidden:true,opacity:0});
 });
 check('the full-screen base gradient is opaque and covers every pixel; decorative face alpha cannot reveal the world',()=>{
   const css=fs.readFileSync(path.join(__dirname,'public/style.css'),'utf8'),body=css.match(/#skill-blind-overlay\{([^}]+)\}/)[1];assert.match(body,/position:fixed/);assert.match(body,/inset:0/);const background=body.match(/background:([^;]+)/)[1],colors=background.match(/#[a-f0-9]+/g);assert.equal(colors.length,3);assert.ok(colors.every(c=>c.length===7));assert.ok(!/mix-blend-mode|filter:|mask:/.test(body));assert.match(css,/#skill-blind-overlay svg\{[^}]*opacity:\.16/);
 });
 console.log('FLASH OPAQUE: '+groups+' saved-game groups; actual effects at20/60/144Hz, independent JSON, inert audio; no browser');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
`;
let prefix=fixture.slice(0,boundary);
const fault=process.argv.find(a=>a.startsWith('--fault='))?.slice(8);
if(fault){
 const mutations={alpha94:"overlay.style.opacity=blocked?'.94':'0';",earlyFade:"overlay.style.opacity=blocked?String(Math.min(1,remaining/.35)):'0';"};
 if(!mutations[fault])throw Error('Unknown fixed fault');
 const anchor="source = fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8');";
 if(!prefix.includes(anchor))throw Error('Source fixture anchor missing');
 prefix=prefix.replace(anchor,anchor.slice(0,-1)+'.replace('+JSON.stringify("overlay.style.opacity=blocked?'1':'0';")+','+JSON.stringify(mutations[fault])+');');
}
const compiled=new Module(__filename,module);compiled.filename=__filename;compiled.paths=module.paths;compiled._compile(prefix+suite,__filename);
