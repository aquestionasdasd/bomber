const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{pathToFileURL}=require('node:url');
async function main({mutate=s=>s,only=()=>true,measure=false,baseline=false,moving=false,preparing=false,gloom=false,longThrow=false,frostGround=false,mutateGame=s=>s}={}){
 const root=__dirname,read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const code=mutate(read('public/bot-team-planner.js')).replace("'./abilities.js'",JSON.stringify(pathToFileURL(path.join(root,'public/abilities.js')).href));
 const {createBotTeamPlanner,BOT_SKILL_CAPABILITIES,BOT_TEAM_SETUPS}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 let groups=0;const test=(name,fn)=>{if(only(name)){fn();groups++;console.log('PASS: '+name);}};
 const actor=(id,character='nobi',team='blue')=>({id,team,character,x:0,y:0,z:0,alive:true,hp:100,ammo:25,scoped:false,ready:true,stock:{c:1,q:0,e:0,x:0},role:'escort'});
 const args=()=>({now:10,allies:[actor('caster'),{...actor('entry','duelist'),x:3}],contacts:{blue:[{id:'target',team:'red',x:0,y:0,z:18,seenAt:10}],red:[]},spike:{status:'carried'},attackerTeam:'blue'});
 const event=s=>({id:'field-1',type:s.action.type,team:s.team,sourceId:s.caster,triggerAt:10.8,endsAt:16.8});
 test('all16 characters and all64 skills have named effect capabilities without changing their stats',()=>{
  assert.equal(Object.keys(BOT_SKILL_CAPABILITIES).length,16);assert.equal(Object.values(BOT_SKILL_CAPABILITIES).flatMap(Object.values).length,64);
  assert.ok(Object.values(BOT_SKILL_CAPABILITIES).every(c=>Object.values(c).every(d=>d.name&&d.effect)));assert.equal(BOT_TEAM_SETUPS.length,8);
 });
 test('setup, authoritative acceptance, real effect readiness and bounded followup form one stable sequence',()=>{
  const p=createBotTeamPlanner(),a=args();let orders=p.update(a),s=p.snapshot().plans[0];assert.equal(orders.get('caster').kind,'setup');assert.equal(orders.get('entry').kind,'wait');
  assert.equal(p.accepted(s.id,{...event(s),sourceId:'other'},10.1),false);assert.equal(p.accepted(s.id,event(s),10.1),true);assert.equal(p.accepted(s.id,event(s),10.1),false);
  orders=p.update({...a,now:10.9,effectState:()=>({alive:true,ready:false,endsAt:16.8})});assert.equal(orders.get('entry')?.kind,'wait','timer alone never declares success');
  orders=p.update({...a,now:11,effectState:()=>({alive:true,ready:true,endsAt:16.8})});assert.equal(orders.get('entry').kind,'follow');
  p.update({...a,now:12.5,effectState:()=>({alive:true,ready:true,endsAt:16.8})});assert.equal(p.snapshot().plans.length,0);assert.equal(p.snapshot().history.at(-1).outcome,'completed');
 });
 test('long throws wait for the accepted arrival but still require a real effect and expire finitely',()=>{
  for(const scenario of['hit','miss','lost','urgent']){
   const p=createBotTeamPlanner(),a=args();p.update(a);const state=p.snapshot().plans[0],accepted={...event(state),triggerAt:13,endsAt:19};assert.equal(p.accepted(state.id,accepted,10.1),true);
   const effectState=()=>({alive:scenario!=='lost',ready:false,endsAt:19});
   const orders=p.update({...a,now:12.9,effectState});
   if(scenario==='lost'){assert.equal(orders.size,0);continue;}
   assert.equal(orders.get('entry')?.kind,'wait','accepted long throw must survive the old2.2s cutoff');assert.equal(accepted.triggerAt,13);assert.ok(p.snapshot().plans[0].until<=13.25,'bounded arrival grace');
   if(scenario==='urgent')a.allies[1].urgent=true;
   const hit=p.update({...a,now:13.05,effectState:()=>({alive:true,ready:scenario==='hit',endsAt:19})});
   assert.equal(hit.get('entry')?.kind,scenario==='hit'?'follow':scenario==='urgent'?undefined:'wait');
   if(scenario==='miss'){p.update({...a,now:13.26,effectState});assert.equal(p.snapshot().plans.length,0,'unhit throw cannot hold a teammate indefinitely');}
  }
 });
 test('no unseen coordinates, enemy stocks, team leakage or caller-owned mutable position enters plans',()=>{
  const p=createBotTeamPlanner(),a=args();a.contacts.blue=[];a.contacts.red=[{id:'secret',x:0,z:18,seenAt:10}];assert.equal(p.update(a).size,0);
  a.now=10.3;a.contacts.blue=args().contacts.blue;a.contacts.blue[0].seenAt=10.3;p.update(a);a.contacts.blue[0].x=999;assert.equal(p.snapshot().plans[0].point.x,0);
  a.contacts.blue[0].x=0; // Isolate stale intel from the separate copied-position check.
  a.now=11.4;p.update(a);assert.equal(p.snapshot().plans.length,0,'stale contact cancels uncast setup');
 });
 test('death, urgent work, reload, blindness, low health, vertical mismatch and human seats cancel coordination',()=>{
  for(const change of[a=>a.alive=false,a=>a.urgent=true,a=>a.busy=true,a=>a.impaired=true,a=>a.hp=30,a=>a.y=4,a=>a.human=true]){
   const p=createBotTeamPlanner(),a=args();p.update(a);change(a.allies[1]);assert.equal(p.update({...a,now:10.1}).size,0);
  }
  for(const role of['plant','defuse','recover']){const p=createBotTeamPlanner(),a=args();a.allies[1].role=role;assert.equal(p.update(a).size,0);}
  const p=createBotTeamPlanner(),a=args();a.allies[1].scoped=true;assert.equal(p.update(a).size,0,'scope hold retains its role');
  assert.equal(createBotTeamPlanner().update({...args(),canSetup:()=>false}).size,0,'unsafe or ineffective casts never reserve allies');
 });
 test('failed casts, lost fields and long flights expire without endless waiting or repeated use',()=>{
  for(const kind of['rejected','lost','flight']){const p=createBotTeamPlanner(),a=args();p.update(a);const s=p.snapshot().plans[0];if(kind!=='rejected')p.accepted(s.id,event(s),10.1);
   const now=kind==='flight'?12.4:11.2;p.update({...a,now,effectState:()=>kind==='flight'?{alive:true,ready:false,endsAt:16.8}:null});assert.equal(p.snapshot().plans.length,0,kind);assert.equal(p.update({...a,now:now+.1}).size,0,'cooldown '+kind);
  }
 });
 test('active followup releases immediately when its actual effect is removed or no longer ready',()=>{
  for(const lost of[null,{alive:false,ready:true,endsAt:16.8},{alive:true,ready:false,endsAt:16.8},{alive:true,ready:true,endsAt:11.1}]){
   const p=createBotTeamPlanner(),a=args();p.update(a);p.accepted(p.snapshot().plans[0].id,event(p.snapshot().plans[0]),10.1);
   assert.equal(p.update({...a,now:11,effectState:()=>({alive:true,ready:true,endsAt:16.8})}).get('entry').kind,'follow');
   assert.equal(p.update({...a,now:11.2,effectState:()=>lost}).size,0,'lost active effect releases every order');
   assert.equal(p.snapshot().history.at(-1).outcome,'effect-lost');
   assert.equal(p.update({...a,now:11.3}).size,0,'normal cooldown still applies');
  }
 });
 test('fresh preparation sightings retarget an uncast setup while missing stale and other contacts cancel it',()=>{
  for(const mode of['fresh','stale','other','missing']){
   const p=createBotTeamPlanner(),a=args();p.update(a);const contact={...a.contacts.blue[0],x:8,seenAt:mode==='stale'?8:10.1};if(mode==='other')contact.id='other-target';
   const orders=p.update({...a,now:10.1,contacts:{blue:mode==='missing'?[]:[contact],red:[]}});
   if(mode==='fresh'){assert.equal(orders.get('caster')?.point.x,8,'uncast setup follows the newly observed point');assert.equal(p.snapshot().plans[0].phase,'prepare');assert.equal(p.snapshot().plans[0].until,11.1,'retargeting never extends preparation');contact.x=999;assert.equal(p.snapshot().plans[0].point.x,8,'preparation copies observations');}
   else {assert.equal(orders.size,0,mode);assert.equal(p.snapshot().history.at(-1).outcome,'setup-unavailable',mode);}
  }
 });
 test('new allied sightings update accepted effect checks without moving the locked cast or leaking hidden poses',()=>{
  for(const mode of['outside','inside','stale','other']){
   const p=createBotTeamPlanner(),a=args();p.update(a);const accepted=event(p.snapshot().plans[0]);p.accepted(p.snapshot().plans[0].id,accepted,10.1);
   const effectState=state=>({alive:true,ready:Math.abs(state.point.x)<5,endsAt:16.8});
   assert.equal(p.update({...a,now:10.8,effectState}).get('entry')?.kind,'follow');
   const contact={...a.contacts.blue[0],x:mode==='inside'?2:8,seenAt:mode==='stale'?8:10.9};if(mode==='other')contact.id='different-target';
   const orders=p.update({...a,now:10.9,contacts:{blue:[contact],red:[]},effectState});
   if(mode==='outside'){assert.equal(orders.size,0,'fresh sighting outside actual effect releases followup');assert.equal(p.snapshot().history.at(-1).outcome,'effect-lost');}
   else {assert.equal(orders.get('entry')?.kind,'follow');assert.equal(p.snapshot().plans[0].point.x,mode==='inside'?2:0);contact.x=999;assert.equal(p.snapshot().plans[0].point.x,mode==='inside'?2:0,'observation is copied');}
   assert.equal(accepted.triggerAt,10.8,'accepted attack timing stays fixed');
  }
 });
 test('entry, postplant and retake objectives are distinct and dropped bomb / reset release all orders',()=>{
  for(const [spike,attack,expected]of[[{status:'carried'},'blue','entry'],[{status:'planted',x:0,z:18},'blue','postplant'],[{status:'planted',x:0,z:18},'red','retake']]){
   const p=createBotTeamPlanner(),a={...args(),spike,attackerTeam:attack};p.update(a);assert.equal(p.snapshot().plans[0].objective,expected);assert.equal(p.update({...a,now:10.1,spike:{status:'dropped'}}).size,0);p.reset();assert.deepEqual(p.snapshot(),{plans:[],history:[]});
  }
 });
 if(only('actual')){
  const template=read('tests-nope-decoy-game.cjs'),cut=template.indexOf('  const local = harness();');assert.ok(cut>0);
  const prefix=template.slice(0,cut).replace('async function main() {','async function main(mutateGame=s=>s) {').replace("source = fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8');","source = mutateGame(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'));"),m=new Module(path.join(root,'team-planner-harness.cjs'),module);m.filename=path.join(root,'team-planner-harness.cjs');m.paths=module.paths;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);
  const {harness}=await m.exports(mutateGame),h=harness();
  h.run(`var teamSamples=[],teamCasts=[],teamDamage=0,actualTeamDamage=damageEntity,actualTeamActivate=activateAbility;
   damageEntity=function(target,amount,source,options){const before=target.hp+target.armor;const result=actualTeamDamage(target,amount,source,options);if(target===player){teamDamage+=Math.max(0,before-target.hp-target.armor);target.hp=100;target.armor=50;}return result;};
   activateAbility=function(actor,key,options){const result=actualTeamActivate(actor,key,options);if(result&&actor.id==='setup')teamCasts.push({at:elapsed,key,type:result.type});return result;};`);
  function setup({character='nobi',key='c',disabled=baseline,distance=18,entryZ=0}={}){
   h.reset();h.clearWalls();Object.assign(h.sandbox,{fixtureCharacter:character,fixtureKey:key,disablePlanner:disabled,fixtureDistance:distance,fixtureEntryZ:entryZ});
   h.run(`match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='other';difficulty='hard';
    Object.assign(player,{team:'red',x:0,y:0,z:fixtureDistance,hp:100,armor:50,alive:true,vx:0,vz:0,vy:0});
    makeBot({x:-3,z:0},0,'blue',{id:'setup',team:'blue',secondary:'classic',armor:50});
    makeBot({x:0,z:fixtureEntryZ},1,'blue',{id:'entry',team:'blue',secondary:'classic',armor:50});var setter=bots[0],entry=bots[1];
    setter.kit=new DuelistKit({character:fixtureCharacter});setter.kit.smoke=fixtureKey==='c'?1:0;setter.kit.updraft=fixtureKey==='q'?1:0;setter.kit.dash=fixtureKey==='e'?1:0;setter.kit.ultPoints=0;entry.kit=null;
    for(const b of bots){Object.assign(b,{aiWeapon:'classic',aiAmmo:12,aiReserve:36,aiReload:0,fire:0,think:0,target:null,reactionUntil:0,nextSkillAt:0});b.group.rotation.y=0;}
    updateBots.tactics=createBotTactics({sites:map.sites,navigation,collision:map.collision});var teamUpdate=updateBots.tactics.update;
    updateBots.tactics.update=function(input){teamUpdate(input);return{siteId:'A',defuserId:null,roles:new Map(bots.map(b=>[b.id,{goal:{x:b.x,y:0,z:24},watch:{x:0,z:18},role:'escort',siteId:'A'}]))};};
    if(disablePlanner)updateBots.tactics.skillPlan=undefined;var rng=3;Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);teamSamples=[];teamCasts=[];teamDamage=0;`);
  }
  function step(seconds,hz=60){Object.assign(h.sandbox,{duration:seconds,hz});h.run(`for(let t=0;t<duration-1e-8;t+=1/hz){var previousYaw=bots.map(b=>b.group.rotation.y);updatePlay(Math.min(1/hz,duration-t));teamSamples.push({at:elapsed,z:entry.z,mode:updateBots.tactics.skillState().plans[0]?.phase||null,effect:ordinarySkills.nobiVulnerability(player.id,elapsed,player,ordinaryReachable),speed:actorSpeedScale(player),maxTurn:Math.max(...bots.map((b,i)=>Math.abs(b.group.rotation.y-previousYaw[i]))),hp:player.hp,damage:teamDamage});}`);}
  const value=code=>JSON.parse(JSON.stringify(h.run(code)));
  function frostGroundControls(){
   const controls=[];
   for(const hz of[20,60,144])for(const scenario of['grounded','pre-land-jump','active-jump','hidden']){
    setup({character:'frost',key:'c',distance:15});
    for(let i=0;i<hz*2&&!h.run('teamCasts.length');i++)step(1/hz,hz);
    const field=value('ordinarySkills.events(elapsed).find(e=>e.sourceId===setter.id)');assert.equal(field?.type,'frost-stitch');
    if(scenario==='pre-land-jump'){
     while(h.run('elapsed')+1/hz<field.triggerAt-1e-8)step(1/hz,hz);
    }else{
     for(let i=0;i<hz*3&&h.run('updateBots.tactics.skillState().plans[0]?.phase')!=='exploit';i++)step(1/hz,hz);
     assert.equal(h.run('actorSpeedScale(player)'),.45,'actual slow before intervention');
     assert.equal(h.run('updateBots.tactics.skillState().plans[0]?.phase'),'exploit');
    }
    const before=value('({at:elapsed,phase:updateBots.tactics.skillState().plans[0]?.phase,speed:actorSpeedScale(player),y:player.y,z:entry.z})');
    if(scenario.includes('jump'))h.run('jump()');
    if(scenario==='hidden')h.wall({z:7,width:30});
    step(1/hz,hz);
    const after=value('({at:elapsed,phase:updateBots.tactics.skillState().plans[0]?.phase||null,speed:actorSpeedScale(player),grounded:actorGrounded(player),y:player.y,vy:player.vy,witness:bots.some(b=>b.alive&&b.team===setter.team&&b.target?.id===player.id&&visibleBetween(b,b.target)),z:entry.z,casts:teamCasts.length,stock:setter.kit.smoke,field:ordinarySkills.events(elapsed).find(e=>e.id===updateBots.tactics.skillState().plans[0]?.eventId)||ordinarySkills.events(elapsed).find(e=>e.sourceId===setter.id),outcome:updateBots.tactics.skillState().history.at(-1)?.outcome,maxTurn:teamSamples.at(-1).maxTurn})');
    const jumping=scenario.includes('jump');assert.equal(after.speed,jumping?1:.45,'real movement effect');assert.equal(after.grounded,!jumping);assert.equal(after.witness,scenario!=='hidden');assert.equal(after.casts,1);assert.equal(after.stock,0);assert.ok(after.field,'accepted field remains');assert.ok(after.maxTurn<=Math.PI*.8/hz+1e-7);
    if(!measure){assert.equal(after.phase,scenario==='grounded'?'exploit':scenario==='pre-land-jump'?'flight':null,'Frost followup needs actual visible grounded target: '+scenario+' at'+hz);if(scenario==='active-jump'||scenario==='hidden')assert.equal(after.outcome,'effect-lost');}
    controls.push({hz,scenario,before,after,field});
   }
   return{controls,frame:'actual updatePlay once/frame;one ordinary jump input and one real frame after intervention',fixture:'visible stationary target15m and fixed escort roles;actual ordinary jump,real field/slow;HP/armor restored after real gun hits',limitations:['controlled comparison;not ordinary5v5 win-rate,damage or personal objective improvement','no browser/device/listening confirmation']};
  }
  if(frostGround)return frostGroundControls();
  function longThrowControls(){
   const controls=[];
   for(const hz of[20,60,144])for(const scenario of['long-c','long-q','short-c','lost-field']){
    const key=scenario==='long-q'?'q':'c',distance=scenario==='short-c'?18:30,entryZ=distance===30?8:0;
    setup({character:'nobi',key,distance,entryZ});
    for(let i=0;i<hz*2&&!h.run('teamCasts.length');i++)step(1/hz,hz);
    const field=value('ordinarySkills.events(elapsed).find(e=>e.sourceId===setter.id)');assert.ok(field,'accepted real field');
    const start=value('({at:elapsed,z:entry.z})');
    if(scenario==='lost-field'){step(.3,hz);h.run('ordinarySkills.reset()');}
    while(h.run('elapsed')<field.triggerAt+.3-1e-8)step(1/hz,hz);
    const result=value('({casts:teamCasts,stock:fixtureKey==="c"?setter.kit.smoke:setter.kit.updraft,z:entry.z,history:updateBots.tactics.skillState().history,samples:teamSamples})');
    // Q changes the actual firing interval rather than the C vulnerability.
    const actualEffect=value('ordinarySkills.nobiInterval(player.id,elapsed,player,ordinaryReachable)');
    const follow=result.samples.find(s=>s.mode==='exploit'),firstEffect=key==='c'?result.samples.find(s=>s.effect===1.35)?.at:null;
    assert.equal(result.casts.length,1);assert.equal(result.stock,0);assert.ok(result.samples.every(s=>s.maxTurn<=Math.PI*.8/hz+1e-7));
    if(scenario!=='short-c')assert.ok(field.triggerAt-field.startedAt>2.2,'real low-gravity flight exceeds old cutoff');
    if(scenario==='lost-field'){assert.equal(actualEffect,1);assert.ok(!follow,'lost field never causes followup');assert.ok(result.history.some(s=>s.outcome==='effect-lost'));}
    else {if(key==='c')assert.ok(firstEffect,'actual C vulnerability');else assert.equal(actualEffect,1.6,'actual Q fire interval effect');if(!measure){assert.ok(follow,'accepted throw must reach actual effect before followup timeout');assert.ok(follow.at+1e-8>=field.triggerAt,'never follow before real arrival');assert.ok(result.z>start.z,'actual armed followup movement');}}
    controls.push({hz,scenario,field,start,casts:result.casts,remainingStock:result.stock,firstEffect,firstFollow:follow?.at??null,z:result.z,actualQEffect:actualEffect,history:result.history,maxTurn:Math.max(...result.samples.map(s=>s.maxTurn))});
   }
   return{controls,frame:'actual updatePlay once/frame',fixture:'two allied bots,visible stationary target18m or30m,fixed escort roles;HP/armor restored after real gun hits',limitations:['controlled comparison;not ordinary5v5 win-rate,damage or personal objective improvement','no browser/device/listening confirmation']};
  }
  if(longThrow)return longThrowControls();
  function gloomControls(){
   const controls=[];
   for(const hz of[20,60,144])for(const scenario of['late-entry','real-hit','hit-moved','cleansed','hidden','other-wave']){
    setup({character:'urchin',key:'e'});
    for(let i=0;i<hz*2&&!h.run('teamCasts.length');i++)step(1/hz,hz);
    const cast=value('teamCasts[0]');assert.equal(cast?.type,'urchin-gloom');
    if(['late-entry','other-wave'].includes(scenario)){
     h.run('player.x=8');
     if(scenario==='other-wave'){
      step(.1,hz);const second=h.run("(()=>{const a=ordinaryActorView(entry),dx=player.x-a.x,dz=player.z-a.z,n=Math.hypot(dx,dz);return ordinarySkills.cast('urchin-gloom',a,{x:a.x+dx/n*36,y:1.7,z:a.z+dz/n*36},elapsed,match.round)})()");assert.ok(second,'second wave has a live source, current clock and full36m endpoint');step(.55,hz);
     }else step(.65,hz);
     h.run('player.x=0');
    }else{
     step(.6,hz);assert.ok(h.run('ordinarySkills.nearsightUntil(player.id,elapsed)>elapsed'),'actual hit before intervention');
     if(scenario==='hit-moved')h.run('player.x=8');
     if(scenario==='cleansed')h.run("ordinarySkills.cleanse(player.id,'red',elapsed)");
     if(scenario==='hidden')h.wall({z:9,width:30});
    }
    const samples=[];
    for(let i=0;i<Math.ceil(hz*.2);i++){
     step(1/hz,hz);
     samples.push(value('({at:elapsed,phase:updateBots.tactics.skillState().plans[0]?.phase||null,near:ordinarySkills.nearsightUntil(player.id,elapsed),seen:setter.lastSeen,witness:bots.some(b=>b.alive&&b.team===setter.team&&b.target?.id===player.id&&visibleBetween(b,b.target)),field:ordinarySkills.events(elapsed).find(e=>e.sourceId===setter.id),blinds:ordinarySkills.snapshot().blinds,z:entry.z,maxTurn:teamSamples.at(-1).maxTurn})'));
    }
    const result=value('({casts:teamCasts,stock:setter.kit.dash,point:updateBots.tactics.skillState().plans[0]?.point||null})');
    assert.equal(result.casts.length,1);assert.equal(result.stock,0);assert.ok(samples.every(s=>s.maxTurn<=Math.PI*.8/hz+1e-7),'normal total turn budget');
    if(scenario==='late-entry')assert.ok(samples.every(s=>s.near===0),'late entrant was never hit');
    if(scenario==='other-wave')assert.ok(samples.some(s=>s.blinds.some(b=>b.sourceId==='entry'&&b.endsAt>s.at)),'different real wave actually hit '+JSON.stringify({hz,cast,samples}));
    if(!measure){
     const expected=['real-hit','hit-moved'].includes(scenario);
     assert.equal(samples.some(s=>s.phase==='exploit'),expected,'actual matching visible wave hit is required: '+scenario+' at'+hz);
     if(expected)assert.ok(samples.every(s=>s.near>s.at&&s.witness),'actual status and current legitimate sighting');
    }
    controls.push({hz,scenario,cast,result,samples});
   }
   console.log('GLOOM_HIT_CONTROLS '+JSON.stringify(controls.map(c=>({hz:c.hz,scenario:c.scenario,exploit:c.samples.some(s=>s.phase==='exploit'),actualNear:c.samples.some(s=>s.near>s.at),casts:c.result.casts.length,stock:c.result.stock}))));return controls;
  }
  if(gloom){const controls=gloomControls();return{groups:1,controls,frame:'actual updatePlay once/frame',fixture:'two allied bots and fixed escort roles;real wave hits,misses,cleanse,wall and another real wave;HP restored after real gun hits',limitations:['controlled scenarios;not ordinary5v5 results','no browser/device/listening confirmation']};}
  if(preparing){
   const controls=[];
   for(const hz of[20,60,144]){
    setup({character:'mend'});step(1/hz,hz);
    const before=value('({at:elapsed,phase:updateBots.tactics.skillState().plans[0]?.phase,point:updateBots.tactics.skillState().plans[0]?.point,casts:teamCasts.length,stock:setter.kit.smoke})');
    assert.equal(before.phase,'prepare');assert.equal(before.casts,0,'movement happens before the cast');
    h.run('player.x=8');step(2.5,hz);
    const after=value('({at:elapsed,seen:setter.lastSeen,casts:teamCasts,stock:setter.kit.smoke,speed:actorSpeedScale(player),z:entry.z,field:ordinarySkills.events(elapsed).find(e=>e.sourceId===setter.id),exploit:teamSamples.some(s=>s.mode==="exploit"),maxTurn:Math.max(...teamSamples.map(s=>s.maxTurn))})');
    assert.equal(after.seen.x,8,'retargeted pose is legitimately seen');assert.equal(after.casts.length,1);assert.equal(after.stock,0);assert.ok(after.maxTurn<=Math.PI*.8/hz+1e-7,'normal total turn budget');
    if(!measure){assert.equal(after.speed,.5,'actual seeds reach the target that moved before casting at'+hz);assert.equal(after.exploit,true,'real effect enables followup at'+hz);assert.ok(after.field.x>4,'cast itself uses the updated observed point');}
    controls.push({hz,before,after});
   }
   console.log('PREPARING_TARGET_CONTROLS '+JSON.stringify(controls));return{groups:1,controls,frame:'actual updatePlay once/frame',fixture:'two allied bots;target stepped sideways8m during preparation before any cast;HP/armor restored after actual hits',limitations:['controlled pose change;not ordinary5v5 match results','no browser/device/listening confirmation']};
  }
  if(moving){
   const controls=[];
   for(const hz of[20,60,144]){
    setup({character:'mend'});step(2,hz);const before=value('({at:elapsed,phase:updateBots.tactics.skillState().plans[0]?.phase,speed:actorSpeedScale(player),z:entry.z,point:updateBots.tactics.skillState().plans[0]?.point})');
    assert.equal(before.phase,'exploit');assert.ok(before.speed<1,'real seed slow before movement');
    h.run('player.x=8');step(1/hz,hz);
    const after=value('({at:elapsed,phase:updateBots.tactics.skillState().plans[0]?.phase||null,speed:actorSpeedScale(player),z:entry.z,point:updateBots.tactics.skillState().plans[0]?.point||null,seen:setter.lastSeen,casts:teamCasts.length,stock:setter.kit.smoke,outcome:updateBots.tactics.skillState().history.at(-1)?.outcome,field:ordinarySkills.events(elapsed).find(e=>e.sourceId===setter.id)})');
    controls.push({hz,frames:1,before,after});assert.equal(after.speed,1,'actual target left the field');assert.equal(after.seen.x,8,'target movement is legitimately seen');
    if(!measure){assert.equal(after.phase,null,'observed target outside actual seed effect releases followup next frame at'+hz);assert.equal(after.outcome,'effect-lost');assert.equal(after.casts,1);assert.equal(after.stock,0);assert.ok(after.field,'real field remains unchanged');}
   }
   console.log('MOVING_TARGET_CONTROLS '+JSON.stringify(controls));return{groups:1,controls,frame:'actual updatePlay once/frame',fixture:'two allied bots, stationary18m target stepped sideways8m after real MEND effect;HP/armor restored after actual hits',limitations:['controlled pose change;not ordinary5v5 match results','no browser/device/listening confirmation']};
  }
  const controls=[];
  for(const hz of[20,60,144]){
   setup();step(2.8,hz);const s=value('({samples:teamSamples,casts:teamCasts,z:entry.z,stocks:{c:setter.kit.smoke,q:setter.kit.updraft},history:updateBots.tactics.skillState().history})');controls.push({hz,...s});
   if(!measure){assert.equal(s.casts.length,1);assert.equal(s.casts[0].type,'nobi-bell');assert.ok(s.samples.some(s=>s.effect===1.35),'real common effect');assert.ok(s.z>2,'actual followup movement');assert.ok(s.samples.filter(s=>s.mode==='flight').every(s=>s.z<.01),'wait for flight');assert.ok(s.samples.every(s=>s.maxTurn<=Math.PI*.8/hz+1e-7),'finite turn');}
  }
  if(measure)return{baseline,frame:'actual updatePlay once/frame',controls,fixture:'two allied bots, fixed visible target18m;real field and Classic damage;target HP100/armor50 restored after each hit, measured real HP+armor loss;fixed escort roles',limitations:['controlled comparison;not ordinary 5v5 win rate','no browser/device/rendering/listening confirmation']};
  groups++;console.log('PASS: actual full-frame Nobi setup -> real1.35 field -> armed followup at20/60/144Hz');
  for(const [character,key,distance]of[['veil','q',18],['mend','c',18],['frost','c',15],['urchin','e',18],['nobi','q',18],['echo','q',15],['nope','q',15]]){
   setup({character,key,distance});step(2.8);const s=value('({casts:teamCasts,samples:teamSamples,z:entry.z,history:updateBots.tactics.skillState().history})');const diagnostic=JSON.stringify({casts:s.casts,z:s.z,history:s.history,modes:[...new Set(s.samples.map(s=>s.mode))]});if(character==='nope'){assert.equal(s.casts.length,0,'unsafe open flash');assert.equal(s.history.length,0,'unsafe flash never reserves a teammate');continue;}assert.equal(s.casts[0]?.key,key,character+diagnostic);assert.ok(s.z>1,character+' actual followup '+diagnostic);assert.ok(s.samples.some(s=>s.mode==='exploit'),character+diagnostic);if(['veil','mend','frost'].includes(character))assert.ok(s.samples.some(s=>s.speed<1),'real slow '+character);
  }groups++;console.log('PASS: actual roots, seeds, frost annulus and gloom adapters share their real effects');
  setup();h.wall({z:9,width:30});step(2.8);assert.equal(h.run('teamCasts.length'),0);assert.equal(h.run('updateBots.tactics.skillState().history.length'),0);assert.equal(h.run('!!entry.lastSeen'),false);groups++;console.log('PASS: wall prevents actual setup and hidden contact while public objective movement remains available');
  setup();step(.4);h.run('setter.alive=false');step(.2);assert.equal(h.run('updateBots.tactics.skillState().plans.length'),0);h.run('spawnRound()');assert.equal(h.run('updateBots.tactics.skillState().history.length'),0);groups++;console.log('PASS: actual caster death and round reset release reservations');
  setup();step(.4);h.run('ordinarySkills.reset()');step(.2);assert.equal(h.run('updateBots.tactics.skillState().plans.length'),0);assert.equal(h.run('updateBots.tactics.skillState().history.at(-1).outcome'),'effect-lost');groups++;console.log('PASS: actual lost pending field releases its follower without refund or recast');
  const activeLossControls=[];for(const hz of[20,60,144]){
   setup();step(2,hz);assert.equal(h.run('updateBots.tactics.skillState().plans[0]?.phase'),'exploit');assert.equal(h.run('ordinarySkills.nobiVulnerability(player.id,elapsed,player,ordinaryReachable)'),1.35);
   const at=h.run('elapsed'),previousZ=h.run('entry.z');
   h.run('ordinarySkills.reset()');step(1/hz,hz);
   assert.equal(h.run('updateBots.tactics.skillState().plans.length'),0,'actual active field loss releases on the next real frame at'+hz);
   assert.equal(h.run('updateBots.tactics.skillState().history.at(-1).outcome'),'effect-lost');
   assert.equal(h.run('ordinarySkills.nobiVulnerability(player.id,elapsed,player,ordinaryReachable)'),1);
   assert.equal(h.run('teamCasts.length'),1);assert.equal(h.run('setter.kit.smoke'),0,'no refund or second cast');
   activeLossControls.push({hz,removedAt:at,releasedAt:h.run('elapsed'),frames:1,previousZ,normalDecisionZ:h.run('entry.z'),beforeEffect:1.35,afterEffect:h.run('ordinarySkills.nobiVulnerability(player.id,elapsed,player,ordinaryReachable)'),casts:h.run('teamCasts.length'),remainingStock:h.run('setter.kit.smoke')});
  }groups++;console.log('PASS: actual active field loss releases followup next frame at20/60/144Hz');console.log('ACTIVE_LOSS_CONTROLS '+JSON.stringify(activeLossControls));
  longThrowControls();groups++;console.log('PASS: actual accepted long and short Nobi throws wait for real effects with finite cancellation at20/60/144Hz');
  frostGroundControls();groups++;console.log('PASS: actual Frost followup checks visible grounding,ordinary jumps and hidden targets across12 controls');
  gloomControls();groups++;console.log('PASS: travelling gloom followup requires this wave hit and current legal sighting across18 actual controls');
  setup();h.run('ordinarySkills.sealUntil=()=>100');step(1.4);assert.equal(h.run('teamCasts.length'),0);assert.equal(h.run('updateBots.tactics.skillState().plans.length'),0);groups++;console.log('PASS: seal prevents actual planner casts');
 }
 console.log(groups+' team planner groups passed');return{groups};
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
