const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {pathToFileURL}=require('node:url');
async function main({mutate=s=>s,only=()=>true}={}){
 const root=__dirname,load=p=>import(pathToFileURL(path.join(root,'public',p)).href);
 const {createBotTactics,draftBotCharacters}=await load('bot-tactics.js'),{CHARACTER_DEFS}=await load('abilities.js');
 const characters=Object.keys(CHARACTER_DEFS),roster=()=>[{id:'player',kit:{character:'ember'}},...Array.from({length:9},(_,i)=>({id:i<4?'blue-'+(i+1):'red-'+(i-4),team:i<4?'blue':'red'}))];
 let groups=0;const rows=[];const check=(name,fn)=>{if(only(name)){fn();groups++;console.log('PASS: '+name);}};
 check('fresh match drafts vary both teams, use all16 characters and avoid duplicates; stable input is reproducible',()=>{
  const seen=new Set(),lineups=new Set();for(let seed=1;seed<=200;seed++){
   const draft=draftBotCharacters(roster(),characters,{seed,exclude:['ember']});assert.equal(draft.size,9);assert.equal(new Set(draft.values()).size,9);assert.ok(![...draft.values()].includes('ember'));
   assert.deepEqual([...draft],[...draftBotCharacters(roster(),characters,{seed,exclude:['ember']})]);for(const c of draft.values())seen.add(c);lineups.add(JSON.stringify([...draft]));
  }assert.equal(lineups.size,200);assert.equal(seen.size,characters.length-1);
  const changed=roster();changed[0].kit.character='duelist';const alternate=new Set();for(let seed=1;seed<=40;seed++)for(const c of draftBotCharacters(changed,characters,{seed,exclude:['duelist']}).values())alternate.add(c);assert.ok(alternate.has('ember'),'all characters remain eligible when the player changes');
 });
 check('human and disconnected-human seats and existing kits are not redrafted',()=>{
  const seats=roster();seats[1].memberId='human';seats[1].kit={character:'nope'};seats[2].memberId='disconnected';seats[2].netFallback=true;seats[3].kit={character:'frost'};
  const before=JSON.stringify(seats),draft=draftBotCharacters(seats,characters,{seed:9});assert.equal(draft.size,6);assert.equal(JSON.stringify(seats),before);assert.ok(!draft.has('player')&&!draft.has(seats[1].id)&&!draft.has(seats[2].id)&&!draft.has(seats[3].id));assert.ok(![...draft.values()].includes('frost'));
 });
 const sites=[{id:'A',x:-20,z:-30},{id:'B',x:20,z:-30}],lanes=[{id:'left',points:[{x:-18,z:12}]},{id:'right',points:[{x:18,z:12}]},{id:'mid',points:[{x:0,z:4}]}];
 const nav={nearest:(x,z,y=0)=>({x,y,z}),path:(ax,az,bx,bz,ay=0,by=0)=>[{x:bx,y:by,z:bz}]};
 const actor=(id,team,x,z)=>({id,team,x,z,y:0,alive:true,index:Number(id.split('-')[1])||0});
 const actors=[...Array.from({length:5},(_,i)=>actor('red-'+i,'red',i-2,55)),...Array.from({length:5},(_,i)=>actor('blue-'+i,'blue',i-2,-55))];
 const args={actors,attackerTeam:'red',defenderTeam:'blue',spike:{status:'carried',carrier:'red-0'},now:10,remaining:95};
 const planner=seed=>{const p=createBotTactics({sites,navigation:nav,lanes,seed});p.reset(1);return p;};
 check('attack routes, formations and defensive holds vary across seeds while a commitment stays fixed',()=>{
  const attacks=new Set(),defense=new Set(),styles=new Set(),main=new Set();for(let seed=1;seed<=40;seed++){
   const p=planner(seed),a=p.update(args),b=planner(seed).update(args);assert.deepEqual([...a.roles],[...b.roles]);
   attacks.add(JSON.stringify([...a.roles].filter(([id])=>id.startsWith('red'))));defense.add(JSON.stringify([...a.roles].filter(([id])=>id.startsWith('blue'))));
   styles.add([...a.roles.values()].filter(r=>r.role==='flank').length);main.add(JSON.stringify(a.roles.get('red-0').goal));
   assert.deepEqual([...a.roles],[...p.update({...args,now:10.1}).roles]);
   if(a.roles.get('red-0').approach)assert.deepEqual(a.roles.get('red-0').goal,p.update({...args,now:12}).roles.get('red-0').goal);
  }assert.ok(attacks.size>=35&&defense.size>=35);assert.equal(styles.size,3);assert.ok(main.size>=3);
 });
 check('lane detours are reachable and bounded, finish once, and yield to late planting; no hidden position steering',()=>{
  for(let seed=1;seed<=30;seed++){
   const p=planner(seed),a=p.update(args),carrier=actors[0],role=a.roles.get(carrier.id);
   if(role.approach){const moved=actors.map(x=>x===carrier?{...x,...role.goal}:x);assert.equal(p.update({...args,actors:moved,now:11}).roles.get(carrier.id).approach,false);}
   assert.equal(planner(seed).update({...args,remaining:20}).roles.get(carrier.id).approach,false);
   const hidden=actors.map(x=>x.team==='blue'?{...x,x:999,z:-999}:x);assert.deepEqual([...planner(seed).update({...args,actors:hidden}).roles].filter(([id])=>id.startsWith('red')),[...a.roles].filter(([id])=>id.startsWith('red')));
   const bad=createBotTactics({sites,navigation:{...nav,path:(ax,az,bx,bz)=>bz===12||az===12?[]:nav.path(ax,az,bx,bz)},lanes:lanes.slice(0,2),seed});
   assert.equal(bad.update(args).roles.get(carrier.id).approach,false,'unreachable alternate lanes are never assigned');
  }
 });
 check('anchor shifts are bounded and optional; planted retakes preserve one defuser and urgent/human ownership',()=>{
  let shifted=0,held=0;for(let seed=1;seed<=20;seed++){
   const p=planner(seed),a=p.update(args),b=p.update({...args,now:27});for(const bot of actors.filter(a=>a.team==='blue')){const before=a.roles.get(bot.id),after=b.roles.get(bot.id);assert.equal(before.siteId,after.siteId);const d=Math.hypot(before.goal.x-after.goal.x,before.goal.z-after.goal.z);assert.ok(d<=11);if(d>.05)shifted++;else held++;}
   const spike={status:'planted',x:0,z:0,site:'A',timer:8,checkpoint:0},plan=p.update({...args,spike,now:28});assert.equal([...plan.roles.values()].filter(r=>r.role==='defuse').length,1);assert.ok(plan.roles.get(plan.defuserId).urgent);
   const human={id:'human',team:'blue',human:true,alive:true,x:0,z:0};const humanPlan=p.update({...args,actors:[...actors,human],spike:{...spike,defuseActor:'human',defuseProgress:2},now:29});assert.equal(humanPlan.defuserId,'human');assert.ok(![...humanPlan.roles.values()].some(r=>r.role==='defuse'));
  }assert.ok(shifted>10&&held>10);
 });
 const template=fs.readFileSync(path.join(root,'tests-nope-decoy-game.cjs'),'utf8'),cut=template.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=template.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')",'module.gameSource');
 const m=new Module(path.join(root,'variety-game-harness.cjs'),module);m.filename=path.join(root,'variety-game-harness.cjs');m.paths=module.paths;m.gameSource=mutate(fs.readFileSync(path.join(root,'public/game.js'),'utf8'));m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);
 const {harness}=await m.exports(),h=harness(),copy=v=>JSON.parse(JSON.stringify(v));
 const start=(h,seed,map='hashimoto')=>{h.sandbox.seed=seed;h.sandbox.arena=map;h.run(`online=null;onlinePlaying=false;mode='menu';$('agent-select').value='ember';$('map-select').value=arena;$('starting-side').value='defend';$('match-format').value='standard';var randomState=seed;Math.random=()=>((randomState=(Math.imul(randomState,1664525)+1013904223)>>>0)/4294967296);startGame();`);};
 const lineup=h=>copy(h.run("bots.map(b=>[b.id,b.kit.character])"));
 check('saved-game new matches redraft enemies/allies; all rounds and side switches keep each kit and selected human',()=>{
  const lineups=new Set();for(let seed=1;seed<=8;seed++){
   start(h,seed);const before=lineup(h);assert.equal(new Set(before.map(p=>p[1])).size,9);assert.ok(!before.some(p=>p[1]==='ember'));assert.equal(h.run('player.kit.character'),'ember');lineups.add(JSON.stringify(before));
   h.run('match.round=2;spawnRound(false)');assert.deepEqual(lineup(h),before);h.run("match.round=13;match.side=match.side==='attack'?'defend':'attack';spawnRound(true)");assert.deepEqual(lineup(h),before);
  }assert.equal(lineups.size,8,'new matches cannot keep the fixed seat draft');
 });
 check('saved host preserves online human seats and reconnect fallback; guest does not independently draft CPU characters',()=>{
  start(h,3);h.run("onlinePlaying=true;online={host:true,send(){},session:{memberId:'host'},room:{code:'TEST',settings:{mapId:'hashimoto',format:'standard'},hostId:'host',members:[{id:'host',team:'blue',name:'HOST'},{id:'friend',team:'red',name:'FRIEND'}]}};mode='menu';startGame()");assert.equal(h.run("roster.find(r=>r.memberId==='friend').botCharacter"),undefined);assert.equal(h.run("bots.find(b=>b.remoteId==='friend').kit.character"),'duelist');
  h.run("var friend=roster.find(r=>r.memberId==='friend');friend.kit=new DuelistKit({character:'renko'});friend.netFallback=true;spawnRound(false)");assert.equal(h.run("bots.find(b=>b.id===friend.id).kit.character"),'renko');
  h.run("online.host=false;online.session.memberId='friend';mode='menu';startGame()");assert.equal(h.run('roster.filter(r=>r.botCharacter).length'),0);assert.equal(h.run('bots.length'),0);
 });
 check('real carrier movement follows the chosen approach instead of overriding it with the plant point',()=>{
  for(const hz of[20,60,144]){start(h,6);h.run("startRound();clearBots();makeBot({x:0,z:0},0,'red',{id:'red-0',team:'red',secondary:'classic',k:0,d:0,a:0});var worker=bots[0];worker.kit=null;Object.assign(player,{x:0,z:-70,hp:100000});match.spike.status='carried';match.spike.carrier=worker.id;var takingApproach=true;updateBots.tactics={observe(){},contacts(){return[]},investigation(){return null},update(){return{siteId:'A',roles:new Map([[worker.id,{role:'plant',siteId:'A',goal:{x:12,z:0},approach:takingApproach} ]])}}};");h.sandbox.dt=1/hz;for(let i=0;i<hz;i++)h.run('updatePlay(dt)');assert.ok(h.run('worker.x>2&&Math.abs(worker.z)<.1'));h.run('takingApproach=false');for(let i=0;i<hz;i++)h.run('updatePlay(dt)');assert.ok(h.run('worker.z<-.5'),'finished route resumes the actual plant approach');}
 });
 if(only('actual maps')){
  const real=harness({realMap:true});for(const map of['hashimoto','hirakata','trc'])for(const seed of[3,27])for(const hz of[20,60,144]){
   start(real,seed,map);real.run("startRound();for(const b of bots){b.kit=null;if(b.team==='blue')b.rangeTarget=true;}player.hp=100000;var initial=bots.filter(b=>b.team==='red').map(b=>({id:b.id,x:b.x,z:b.z}));var mainBot=bots.find(b=>b.team==='red');match.spike.carrier=mainBot.id;match.spike.status='carried';var maxFrameTurn=0,previousYaw=new Map(bots.map(b=>[b.id,b.group.rotation.y]));");
   real.sandbox.dt=1/hz;for(let frame=0;frame<hz*4;frame++)real.run('updatePlay(dt);for(const b of bots){maxFrameTurn=Math.max(maxFrameTurn,Math.abs(b.group.rotation.y-previousYaw.get(b.id)));previousYaw.set(b.id,b.group.rotation.y)}');
   const row=copy(real.run("({phase:match.phase,moves:initial.map(p=>{const b=bots.find(b=>b.id===p.id);return Math.hypot(b.x-p.x,b.z-p.z)}),goals:[...updateBots.tactics.update({actors:[player,...bots],attackerTeam:match.attackerTeam,defenderTeam:match.defenderTeam,spike:match.spike,now:elapsed,remaining:match.phaseTime}).roles].filter(([id])=>id.startsWith('red')),maxFrameTurn})"));assert.equal(row.phase,'live',map);assert.ok(row.moves.every(d=>d>2),map+'/'+seed+'/'+hz+' no attacker left stuck at spawn '+JSON.stringify(row.moves));assert.ok(row.maxFrameTurn<=Math.PI*.8/hz+1e-7);rows.push({map,seed,hz,...row});
  }groups++;console.log('PASS: 18 actual map/seed/20-60-144Hz controls move all attackers beyond spawn with finite turn; one updatePlay per frame');
 }
 if(rows.length)fs.writeFileSync(path.join(root,'../cycle235-map-controls.json'),JSON.stringify({rows,framesPerUpdatePlay:1,audioOutput:0,limitations:['Controlled first4seconds without enemy CPU attacks or player damage; no5v5 win-rate or complete-round assertion','actual browser/devices/listening unverified']},null,2)+'\n');
 console.log(`PASS: ${groups} CPU variety groups; audio mocked without playback`);return groups;
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
