const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');

async function main(){
  const started=performance.now();
  const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [{createBotTactics,inVisionCone,createBotHearing},{createNavigation},{createCollisionIndex},{MatchRules,WEAPONS},THREE,areas,{DuelistKit,NOPE_SKILLS,MEND_SKILLS,IAGNU_SKILLS,VEIL_SKILLS,EMBER_SKILLS,FROST_SKILLS},{selectMendTarget}]=await Promise.all([
    load('bot-tactics.js'),load('navigation.js'),load('collision.js'),load('rules.js'),load('vendor/three.module.js'),load('site-areas.js'),load('abilities.js'),load('character-skills.js')]);
  const sites=[{id:'A',x:-22,z:-12,radius:7,plantPositions:[{id:'A-cover',x:-24,z:-11,style:'cover'},{id:'A-open',x:-20,z:-14,style:'open'}]},
    {id:'B',x:22,z:-12,radius:7,plantPositions:[{id:'B-cover',x:24,z:-11,style:'cover'},{id:'B-open',x:20,z:-14,style:'open'}]}];
  const makeMap=(colliders=[])=>({sites,colliders,collision:createCollisionIndex(colliders),bounds:{minX:-42,maxX:42,minZ:-42,maxZ:42},
    teamSpawns:{attack:[{x:0,z:30}],defend:[{x:0,z:-30}]},lanes:[]});
  const makeTactics=map=>createBotTactics({sites:map.sites,navigation:createNavigation(map),collision:map.collision});
  const actor=(id,team,x,z,index=0)=>({id,team,x,z,y:0,vy:0,index,hp:100,alive:true,path:[],pathTime:0,group:new THREE.Group(),muzzle:{visible:false},visual:{update(){}},fire:100});
  const matchState={attackerTeam:'blue',defenderTeam:'red',remaining:100,now:0};

  // No live enemy reference may survive a sighting, and it cannot cross team boundaries.
  const tactics=makeTactics(makeMap()),observer=actor('blue-1','blue',0,0),enemy=actor('red-0','red',1,12);
  assert.equal(inVisionCone(observer,enemy,{yaw:0}),true);
  assert.equal(inVisionCone(observer,{x:0,z:-12},{yaw:0}),false,'A bot must not spot a distant enemy behind its back');
  assert.equal(inVisionCone(observer,{x:0,z:-3},{yaw:0}),false,'A silent close target behind the BOT is not visible');
  assert.equal(inVisionCone(observer,{x:0,z:120},{yaw:0}),true);
  tactics.observe('blue',observer.id,enemy,1);enemy.x=30;enemy.z=30;
  assert.deepEqual(tactics.contacts('blue',2).map(c=>[c.x,c.z]),[[1,12]],'Hidden movement must not update a last-seen position');
  const copied=tactics.contacts('blue',2);copied[0].x=999;
  assert.equal(tactics.contacts('blue',2)[0].x,1,'Callers cannot mutate shared observations');
  assert.equal(tactics.contacts('red',2).length,0,'Sighting information belongs only to the observing team');
  assert.equal(tactics.contacts('blue',5.01).length,0,'Shared sightings must expire after four seconds');
  tactics.observe('blue',observer.id,enemy,6);tactics.reset(2);assert.equal(tactics.contacts('blue',6).length,0,'Round changes must clear intelligence');
  console.log('PASS: forward vision across the map, no silent rear awareness, copied team-only sighting memory and round/TTL expiry');

  // Site decisions use the carrier, known map and sightings, never hidden defender coordinates.
  const carrier=actor('player','blue',0,30),hidden=actor('red-0','red',-20,-12),attackers=[1,2,3,4].map(i=>actor(`blue-${i}`,'blue',i-3,30+i,i));
  const makeAttackPlan=hiddenX=>{const t=makeTactics(makeMap());t.reset(4);return t.update({...matchState,actors:[carrier,...attackers,{...hidden,x:hiddenX}],spike:{status:'carried',carrier:'player'}});};
  const one=makeAttackPlan(-22),two=makeAttackPlan(22);
  assert.equal(one.siteId,two.siteId,'Unseen defender locations must not change the chosen attack site');
  assert.deepEqual([...one.roles.values()].map(r=>r.goal),[...two.roles.values()].map(r=>r.goal),'Unseen movement must not steer escorts');
  assert.equal(new Set(attackers.map(bot=>one.roles.get(bot.id)).map(r=>`${r.goal.x.toFixed(1)},${r.goal.z.toFixed(1)}`)).size,4,'Escorts must have distinct destinations');
  const siteChoices=new Set();for(let round=1;round<=8;round++){const t=makeTactics(makeMap());t.reset(round);siteChoices.add(t.selectSite('blue',carrier,0));}
  assert.equal(siteChoices.size,2,'Symmetric approaches must not choose the same site every round');
  const t=makeTactics(makeMap());t.reset(4);const selected=t.selectSite('blue',carrier,0),current=sites.find(s=>s.id===selected);
  for(let i=0;i<3;i++)t.observe('blue','blue-1',actor(`red-${i}`,'red',current.x+i,current.z),1);
  assert.equal(t.selectSite('blue',carrier,2),selected,'A fresh contact must not flip the plan every think tick');
  for(let i=0;i<3;i++)t.observe('blue','blue-1',actor(`red-${i}`,'red',current.x+i,current.z),7.9);
  assert.notEqual(t.selectSite('blue',carrier,8),selected,'Sustained known pressure should permit a practical rotation');
  const preferred=t.plantPosition(sites[0],{x:-23,z:-11},8);
  assert.equal(t.plantPosition(sites[0],{x:-22,z:-12},8,preferred.id).id,preferred.id,'A carrier must keep a stable planting position while approaching');
  console.log('PASS: no hidden-position site steering, separated escorts, varied attacks, rotation hysteresis and stable planting choices');

  // Straight-line proximity is not a useful role assignment when a route is blocked.
  const unreachable={path(ax,az,bx,bz){return ax===1?[]:[{x:bx,z:bz}];},nearest:(x,z)=>({x,z})};
  const routeTactics=createBotTactics({sites,navigation:unreachable});
  const near=actor('red-0','red',1,0),far=actor('red-1','red',8,0),plant={status:'planted',x:0,z:0,site:'A',timer:9,checkpoint:0,defuseProgress:0};
  let plan=routeTactics.update({...matchState,actors:[near,far],spike:plant});
  assert.equal(plan.defuserId,far.id,'The reachable defender must defuse instead of a closer trapped defender');
  assert.equal(plan.roles.get(far.id).urgent,true,'Travel plus the full seven-second defuse must make a nine-second retake urgent');
  routeTactics.reset();plan=routeTactics.update({...matchState,actors:[far],spike:{...plant,timer:9,checkpoint:3.5}});
  assert.equal(plan.roles.get(far.id).urgent,false,'A completed half-defuse must reduce the required interaction time');
  const human={...carrier,x:0,z:1,team:'red',human:true};routeTactics.reset();
  plan=routeTactics.update({...matchState,actors:[near,far,human],spike:{...plant,defuseActor:'player',defuseProgress:4,checkpoint:3.5}});
  assert.equal(plan.defuserId,'player','An active human defuser must keep the interaction');
  assert.ok([...plan.roles.values()].every(role=>role.role!=='defuse'),'Bots must cover an active human defuser');
  routeTactics.reset();const recoverPlan=routeTactics.update({...matchState,actors:[{...near,team:'blue'},{...far,team:'blue'}],spike:{status:'dropped',x:0,z:0}});
  assert.equal(recoverPlan.recovererId,far.id,'Dropped spike recovery must use reachability too');
  console.log('PASS: reachable recovery/defuse selection, deadline and half-defuse timing, and human defuser ownership');

  const defenders=Array.from({length:4},(_,i)=>actor(`red-${i}`,'red',(i-2)*3,-28,i));
  const defense=makeTactics(makeMap());
  let defensivePlan=defense.update({...matchState,actors:defenders,spike:{status:'carried',carrier:'player'}});
  assert.equal(new Set([...defensivePlan.roles.values()].map(r=>r.siteId)).size,2,'Initial defense must cover both sites');
  for(let i=0;i<2;i++)defense.observe('red','red-0',actor(`blue-${i}`,'blue',-22+i,-5),1);
  defensivePlan=defense.update({...matchState,now:1,actors:defenders,spike:{status:'carried',carrier:'player'}});
  const assignment=[...defensivePlan.roles.values()];
  assert.equal(assignment.filter(r=>r.siteId==='A').length,3,'Shared sightings must pull support toward the threatened site');
  assert.equal(assignment.filter(r=>r.siteId==='B').length,1,'A quiet-site anchor must remain');
  const lone=makeTactics(makeMap());lone.observe('red','player',actor('blue-1','blue',-22,-5),1);
  const lonePlan=lone.update({...matchState,now:1,actors:[defenders[0],{...carrier,team:'red',x:22,z:-12,human:true}],spike:{status:'carried',carrier:'blue-1'}});
  assert.equal(lonePlan.roles.get(defenders[0].id).siteId,'A','A lone bot must reinforce the sighting while a human covers the quiet site');
  console.log('PASS: split-site defense, team-information rotation and retained quiet-site anchor');

  // Exercise the actual game update, not an alternate copy of the combat/objective decisions.
  const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
  const updateSource=source.slice(source.indexOf('function updateBots(dt)'),source.indexOf('function separateBots(dt)'));
  const serviceSource=source.slice(source.indexOf('function actorWeaponId('),source.indexOf('function ordinaryActorView('));
  const verticalSource=source.slice(source.indexOf('function updateActorVertical('),source.indexOf('function updatePlay('));
  assert.ok(updateSource.length>5000);
  function integration({map=makeMap(),player=actor('player','blue',0,0),bots=[],match=new MatchRules(),random=.99,ordinarySkills={interceptShield:()=>null,quiet:()=>false,sealUntil:()=>0,blindUntil:()=>0,events:()=>[],markers:()=>[]}}={}){
    match.startLive();let bulletHits=0,shots=0;const casts=[],traces=[];ordinarySkills={capMagazine:()=>false,urchinJammed:()=>false,urchinTrident:()=>false,interceptShield:()=>null,quiet:()=>false,sealUntil:()=>0,cancelService(){},carGyro:()=>false,speedScale:()=>1,...ordinarySkills};
    const math=Object.create(Math);math.random=typeof random==='function'?random:()=>random;
    const sandbox={applyStarHold:()=>false,crownShot:()=>{},activateCapAbility:()=>null,activateJapanAbility:()=>null,nobiBulletDamage:(_s,_t,d)=>d,THREE,WEAPONS,NOPE_SKILLS,IAGNU_SKILLS,VEIL_SKILLS,EMBER_SKILLS,...areas,createBotTactics,inVisionCone,createBotHearing,map,navigation:createNavigation(map),player,bots,match,elapsed:0,inventory:{active:'classic'},reloading:0,
      levels:{normal:{interval:1.25,aim:.68,speed:2.1}},difficulty:'normal',Math:math,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
      isGuest:()=>false,botHearing:createBotHearing(),ordinarySkills,zoneAbilities:{speedMultiplier:()=>1},actorSpeedScale:()=>1,agentEquipment:()=>({}),selectMendTarget,activePollenFields:()=>[],
      ordinaryActorView:value=>({...value,grounded:sandbox.actorGrounded(value)}),ordinaryGroundHeight:()=>0,rampFloor:()=>null,
      ordinaryReachable:(event,value)=>map.collision.rayClear(event.x,(event.y||0)+.18,event.z,value.x,(value.y||0)+.18,value.z),
      actorGrounded:actor=>actor.alive&&Math.abs(actor.y||0)<1e-8&&Math.abs(actor.vy||0)<1e-8,
      activeOrdinarySmokeFields:()=>ordinarySkills.events(sandbox.elapsed).filter(event=>event.type==='veil-dust'&&sandbox.elapsed>=event.triggerAt),
      allNopeDecoys:()=>ordinarySkills.events(sandbox.elapsed).filter(e=>e.type==='nope-decoy'),raycastNopeDecoy:()=>null,hitNopeDecoy(){},updateRemoteActor(){},sound(){},tracer(from,to){shots++;traces.push({from:from.clone(),to:to.clone()});},separateBots(){},
      mendReachable:(a,b)=>a===b||map.collision.rayClear(a.x,(a.y||0)+1.45,a.z,b.x,(b.y||0)+1.45,b.z),
      activateAbility(actor,key,options){const effect=actor.kit.activate(key,sandbox.elapsed);if(!effect)return;casts.push({actorId:actor.id,key,effect,options});if(effect.type==='mend-heal'){const selected=selectMendTarget(actor,[player,...bots],sandbox.mendReachable),target=[player,...bots].find(value=>value.id===selected?.id);if(target)target.hp=Math.min(100,target.hp+effect.healing);}if(effect.type==='ember-service')sandbox.beginServiceReload(actor,{id:'bot-service-'+casts.length,weaponId:sandbox.actorWeaponId(actor),endsAt:sandbox.elapsed+EMBER_SKILLS.serviceDuration});return effect;},
      damageEntity(target,damage){bulletHits++;target.hp-=damage;if(target.hp<=0){target.alive=false;match.dropSpike(target.id,target.x,target.z);}},
      visibleBetween:(a,b)=>map.collision.rayClear(a.x,(a.y||0)+1.45,a.z,b.x,(b.y||0)+1.45,b.z),
      moveEntity(entity,dx,dz,r){const x=entity.x+dx,z=entity.z+dz;if(!map.collision.blocked(x,entity.z,r,0))entity.x=x;if(!map.collision.blocked(entity.x,z,r,0))entity.z=z;},
      urchinTridentShot:()=>[],direction:new THREE.Vector3(),raycaster:{set(){},intersectObject:()=>[],far:190},environment:new THREE.Group()};
    vm.createContext(sandbox);vm.runInContext(`${serviceSource}\n${verticalSource}\n${updateSource}`,sandbox);
    return {sandbox,casts,traces,step(count=1){for(let i=0;i<count;i++){sandbox.elapsed+=.05;vm.runInContext('updateBots(.05)',sandbox);}},get shots(){return shots;},get hits(){return bulletHits;}};
  }
  const sightMap=makeMap(),watcher=actor('red-0','red',0,10),target=actor('player','blue',0,25);watcher.group.rotation.y=0;
  const sightGame=integration({map:sightMap,player:target,bots:[watcher]});
  sightGame.step();assert.equal(watcher.target,target);assert.equal(sightGame.shots,0,'Acquiring a target must allow a human-scale reaction delay');
  assert.equal(watcher.lastSeen.z,25);
  sightMap.colliders.push({minX:-41,maxX:41,minZ:14,maxZ:15,height:3});target.x=10;target.z=30;
  sightGame.step(20);
  assert.equal(watcher.target,null,'A solid wall must clear the live aim target');
  assert.equal(watcher.lastSeen.x,0,'The game must retain the observed point rather than the hidden actor reference');
  assert.equal(watcher.lastSeen.z,25);
  assert.equal(sightGame.shots,0,'A bot must never fire at remembered or shared positions through cover');
  assert.equal(vm.runInContext('updateBots.tactics.contacts("red",elapsed)[0].x',sightGame.sandbox),0);
  sightGame.step(65);
  assert.equal(vm.runInContext('updateBots.tactics.contacts("red",elapsed).length',sightGame.sandbox),0);

  const retaker=actor('red-0','red',0,0),attacker=actor('player','blue',0,14),retakeMatch=new MatchRules();
  retaker.group.rotation.y=0;retakeMatch.spike={...retakeMatch.spike,status:'planted',carrier:null,x:0,z:7,site:'A',timer:8};
  const retakeGame=integration({player:attacker,bots:[retaker],match:retakeMatch});
  retakeGame.step(40);
  assert.ok(retaker.z>5,'The assigned defender must approach a deadline even while an attacker remains visible');
  assert.ok(retakeMatch.spike.defuseProgress>0,'An urgent defender must begin defusing instead of remaining in a duel');
  retakeGame.step(150);
  assert.equal(retakeMatch.spike.status,'defused','A committed urgent defuse must finish while teammates would cover');
  console.log('PASS: real updateBots reaction delay, hidden-target loss, no memory shots, and visible-threat urgent retake');

  const distracted=actor('red-decoy','red',0,0),hiddenPlayer={...actor('player','blue',0,30),alive:false};
  const decoys=[{id:'skill-nope-decoy-1',type:'nope-decoy',team:'blue',x:5,y:0,z:0},{id:'skill-nope-decoy-2',type:'nope-decoy',team:'blue',x:-5,y:0,z:0}];
  const decoyGame=integration({player:hiddenPlayer,bots:[distracted],ordinarySkills:{interceptShield:()=>null,quiet:()=>false,sealUntil:()=>0,blindUntil:()=>0,events:now=>now<6?decoys:[],markers:()=>[]}});
  decoyGame.step();const firstDeadline=distracted.decoySeen.get(decoys[0].id);
  assert.equal(firstDeadline,1.55);assert.equal(distracted.goal.x,5,'The first visible enemy face may draw an investigation');
  decoyGame.sandbox.elapsed=firstDeadline+.001;decoyGame.step();const secondDeadline=distracted.decoySeen.get(decoys[1].id);
  assert.ok(secondDeadline>firstDeadline);assert.equal(distracted.goal.x,-5,'A distinct unseen face may draw one later investigation');
  decoyGame.sandbox.elapsed=secondDeadline+.001;decoyGame.step();
  assert.equal(distracted.decoySeen.get(decoys[0].id),firstDeadline,'Returning to the first ID must not grant another1.5-second distraction');
  assert.equal(distracted.decoySeen.get(decoys[1].id),secondDeadline);assert.ok(Math.abs(distracted.goal.x-5)>.01&&Math.abs(distracted.goal.x+5)>.01,'After both windows, the bot must return to its objective');
  assert.equal(distracted.target,null);assert.equal(decoyGame.shots,0,'A decoy must never create a real actor sighting or hit');
  assert.equal(vm.runInContext('updateBots.tactics.contacts("red",elapsed).length',decoyGame.sandbox),0);
  decoyGame.sandbox.elapsed=6;decoyGame.step();assert.equal(distracted.decoySeen.size,0,'Expired IDs must leave the per-bot bounded memory');
  console.log('PASS: real updateBots investigates each visible decoy ID once, restores objective movement and releases expired memory');

  const medic=actor('red-medic','red',0,0),patient=actor('red-patient','red',2,0),noEnemy={...actor('player','blue',0,25),alive:false};
  medic.kit=new DuelistKit({character:'mend'});medic.kit.ultPoints=7;patient.hp=40;
  const healingGame=integration({player:noEnemy,bots:[medic,patient]});healingGame.step();
  assert.equal(healingGame.casts[0]?.key,'e','A safe injured ally should receive ordinary E before the seven-point ultimate');
  assert.equal(patient.hp,100);assert.equal(medic.kit.ultPoints,7,'A sufficient60HP ordinary heal must preserve the ultimate points');assert.equal(medic.kit.nextSignatureAt,MEND_SKILLS.signatureCooldown+.05);
  healingGame.step(20);assert.equal(healingGame.casts.filter(cast=>cast.key==='e').length,1,'A cooling-down heal may not be cast every think tick');
  const blockedMedic=actor('red-medic','red',0,0),blockedPatient=actor('red-patient','red',0,3);blockedMedic.kit=new DuelistKit({character:'mend'});blockedPatient.hp=20;
  const blockedHealing=integration({map:makeMap([{minX:-1,maxX:1,minZ:1,maxZ:2,height:3}]),player:noEnemy,bots:[blockedMedic,blockedPatient]});blockedHealing.step();
  assert.equal(blockedHealing.casts.length,0,'An injured ally behind a wall must not consume a BOT heal');assert.equal(blockedMedic.kit.dash,1);
  const seedMedic=actor('red-seeds','red',0,0),seedTarget=actor('player','blue',0,12);seedMedic.kit=new DuelistKit({character:'mend'});seedMedic.kit.smoke=2;
  const seedGame=integration({player:seedTarget,bots:[seedMedic]});seedGame.step();
  assert.equal(seedGame.casts[0]?.effect.type,'mend-seeds');assert.equal(seedMedic.kit.smoke,1,'A seen mid-range enemy must receive one finite seed cast');
  const pollenMedic=actor('red-pollen','red',0,0);pollenMedic.kit=new DuelistKit({character:'mend'});pollenMedic.kit.smoke=0;pollenMedic.kit.dash=0;pollenMedic.kit.updraft=1;pollenMedic.hp=50;
  const pollenGame=integration({player:seedTarget,bots:[pollenMedic]});pollenGame.step();
  assert.equal(pollenGame.casts[0]?.effect.type,'mend-pollen');assert.equal(pollenMedic.kit.updraft,0,'A wounded BOT without seeds or a ready heal may use one defensive pollen cover');
  console.log('PASS: real MEND BOT safe ordinary heal before ultimate,18s cooldown/wall rejection, finite seed attack and defensive pollen choice');

  for(const [key,type]of [['c','veil-dust'],['q','veil-roots'],['e','veil-turf']]){
    const grass=actor(`red-grass-${key}`,'red',0,0),visible=actor('player','blue',0,key==='q'?6:12);
    grass.kit=new DuelistKit({character:'veil'});grass.kit.smoke=key==='c'?1:0;grass.kit.updraft=key==='q'?1:0;grass.kit.dash=key==='e'?1:0;grass.hp=key==='c'?50:100;
    if(key==='e')visible.z=-35;
    const game=integration({player:visible,bots:[grass]});game.step();
    assert.equal(game.casts[0]?.effect.type,type,`The actual grounded BOT decision must use distinct ${key.toUpperCase()} rather than inherited smoke/updraft/dash`);
    assert.equal(grass.kit.ultPoints,0);assert.equal(grass.dashTimer||0,0);
    if(key==='e')assert.equal(grass.kit.nextSignatureAt,VEIL_SKILLS.signatureCooldown+.05);
    const before=game.casts.length;game.step(10);assert.equal(game.casts.length,before,'A BOT cannot repeatedly consume a cooling-down/empty grass slot');
  }
  for(const hiddenX of [-25,25]){
    const grass=actor('red-grass-hidden','red',0,0),hiddenEnemy=actor('player','blue',hiddenX,-12);grass.kit=new DuelistKit({character:'veil'});grass.kit.smoke=2;grass.kit.updraft=1;grass.kit.dash=0;grass.hp=40;
    const game=integration({player:hiddenEnemy,bots:[grass]});game.step();assert.equal(game.casts.length,0,'Unseen enemy positions must not select grass smoke or roots');
  }
  const airborneGrass=actor('red-grass-air','red',0,0);airborneGrass.y=1;airborneGrass.kit=new DuelistKit({character:'veil'});
  const airGame=integration({player:actor('player','blue',0,-35),bots:[airborneGrass]});airGame.step();assert.equal(airGame.casts.length,0,'An airborne BOT cannot activate a ground-only turf escape');
  console.log('PASS: real grass BOT wounded cover, known-enemy roots, grounded turf cooldown, no airborne activation or hidden-position steering');

  const worker=actor('red-worker','red',0,0);worker.record={primary:'vandal',secondary:'classic'};worker.kit=new DuelistKit({character:'ember'});Object.assign(worker,{aiWeapon:'vandal',aiAmmo:3,aiReserve:5,aiReload:0});
  const serviceGame=integration({player:noEnemy,bots:[worker]});serviceGame.step();
  assert.equal(serviceGame.casts[0]?.effect.type,'ember-service','A safe low-magazine worker must choose its own maintenance, not a dash');assert.equal(worker.serviceReload.weaponId,'vandal');assert.equal(worker.kit.nextSignatureAt,EMBER_SKILLS.signatureCooldown+.05);assert.equal(worker.aiAmmo,3);
  serviceGame.step(Math.round(EMBER_SKILLS.serviceDuration/.05)-1);assert.equal(worker.aiAmmo,3,'A BOT service may not complete before the service deadline');serviceGame.step();assert.equal(worker.aiAmmo,8);assert.equal(worker.aiReserve,0,'BOT maintenance must use only its finite reserve');assert.equal(worker.serviceReload,null);
  const castsAfterService=serviceGame.casts.length;serviceGame.step(10);assert.equal(serviceGame.casts.length,castsAfterService,'An empty reserve/cooling service cannot be used repeatedly');
  const urgentWorker=actor('red-worker','red',0,0);urgentWorker.record={primary:'vandal'};urgentWorker.kit=new DuelistKit({character:'ember'});Object.assign(urgentWorker,{aiWeapon:'vandal',aiAmmo:3,aiReserve:5,aiReload:0});
  const urgentMatch=new MatchRules();urgentMatch.spike={...urgentMatch.spike,status:'planted',carrier:null,x:0,z:0,site:'A',timer:8};
  const urgentService=integration({player:noEnemy,bots:[urgentWorker],match:urgentMatch});urgentService.step();assert.equal(urgentService.casts.length,0,'A deadline and actual defuse must take precedence over maintenance');assert.ok(urgentMatch.spike.defuseProgress>0);
  for(const hiddenX of [-25,25]){const worker=actor('red-worker','red',0,0);worker.kit=new DuelistKit({character:'ember'});worker.kit.smoke=2;worker.kit.updraft=1;worker.kit.dash=0;const game=integration({player:actor('player','blue',hiddenX,-12),bots:[worker]});game.step();assert.equal(game.casts.length,0,'Unseen enemy positions cannot drive the solder or shade choices');}
  console.log('PASS: real EMBER BOT low-magazine cover service, finite reserve0.8s/cooldown, urgent defuse priority and no unseen-position solder/shade steering');

  const buySource=source.slice(source.indexOf('function autoBuyBot('),source.indexOf('function setVisible(')),buyContext={DuelistKit};
  vm.createContext(buyContext);vm.runInContext(`${buySource}\nvar frostBuyer={kit:new DuelistKit({character:'frost'}),primary:'vandal',secondary:'ghost',armor:50,credits:1000,team:'red'};autoBuyBot(frostBuyer)`,buyContext);
  assert.equal(buyContext.frostBuyer.kit.smoke,2);assert.equal(buyContext.frostBuyer.kit.updraft,1);assert.equal(buyContext.frostBuyer.credits,700,'Two100-credit rings and one100-credit mist must be bought from real finite credits');assert.equal(buyContext.frostBuyer.primary,'vandal');assert.equal(buyContext.frostBuyer.armor,50);
  for(const [key,type]of [['c','frost-stitch'],['q','frost-mist'],['e','frost-unravel']]){
    const doll=actor(`red-doll-${key}`,'red',0,0),visible=key==='e'?noEnemy:actor('player','blue',0,10);doll.kit=new DuelistKit({character:'frost'});doll.kit.smoke=key==='c'?2:0;doll.kit.updraft=key==='q'?1:0;doll.kit.dash=key==='e'?1:0;doll.hp=key==='q'?50:100;
    const game=integration({player:visible,bots:[doll],ordinarySkills:{interceptShield:()=>null,quiet:()=>false,sealUntil:()=>0,blindUntil:()=>0,events:()=>[],markers:()=>[],speedScale:()=>key==='e'?.55:1}});game.step();
    assert.equal(game.casts[0]?.effect.type,type,`Actual FROST BOT policy must select its distinct${key.toUpperCase()} skill`);assert.equal(doll.dashTimer||0,0);
    if(key==='c')assert.equal(Math.hypot(game.casts[0].options.zonePoint.x-visible.x,game.casts[0].options.zonePoint.z-visible.z),2,'A ring must offset its safe centre from the known target rather than place that enemy inside the hole');
    if(key==='e')assert.equal(doll.kit.nextSignatureAt,FROST_SKILLS.signatureCooldown+.05);
    const before=game.casts.length;game.step(10);assert.equal(game.casts.length,before,'Stock/cooldown must prevent casting every think tick');
  }
  const safeDoll=actor('red-doll-safe','red',0,0);safeDoll.kit=new DuelistKit({character:'frost'});const unSlowed=integration({player:noEnemy,bots:[safeDoll]});unSlowed.step();assert.equal(unSlowed.casts.some(cast=>cast.key==='e'),false,'A normal-speed BOT must preserve mitigation instead of treating E as a travel boost');
  const airDoll=actor('red-doll-air','red',0,0);airDoll.kit=new DuelistKit({character:'frost'});airDoll.y=1;const airDollGame=integration({player:actor('player','blue',0,10),bots:[airDoll],ordinarySkills:{interceptShield:()=>null,quiet:()=>false,sealUntil:()=>0,blindUntil:()=>0,events:()=>[],markers:()=>[],speedScale:()=>.55}});airDollGame.step();assert.equal(airDollGame.casts.length,0,'An airborne BOT may not spend a ground-only mitigation or plan a ground ring');
  console.log('PASS: real FROST economy buys2rings/1mist for300, BOT offset-ring/wounded-mist/actually-slowed ribbon choices, cooldown and normal/air rejection');

  vm.runInContext(`var mascotBuyer={kit:new DuelistKit({character:'duelist'}),primary:'vandal',secondary:'ghost',armor:50,credits:1000,team:'red'};autoBuyBot(mascotBuyer)`,buyContext);
  assert.equal(buyContext.mascotBuyer.kit.smoke,2);assert.equal(buyContext.mascotBuyer.kit.updraft,2);assert.equal(buyContext.mascotBuyer.credits,600,'Actual economy must buy two100-credit comets and two100-credit lifts from finite credits');
  for(const [key,type]of [['c','duelist-comet'],['q','duelist-lift']]){
    const mascot=actor(`red-mascot-${key}`,'red',0,0),visible=actor('player','blue',0,10);mascot.kit=new DuelistKit({character:'duelist'});mascot.kit.smoke=key==='c'?2:0;mascot.kit.updraft=key==='q'?1:0;mascot.hp=50;
    const game=integration({player:visible,bots:[mascot]});game.step();assert.equal(game.casts[0]?.effect.type,type,`The actual BOT policy must choose its distinct${key.toUpperCase()} ability`);
    if(key==='c'){assert.equal(game.casts[0].options.zonePoint.z,6,'Comet cover must be placed on the known approach rather than track an unseen actor');assert.equal(game.casts[0].options.zonePoint.y,1.4);}
    const before=game.casts.length;game.step(10);assert.equal(game.casts.length,before,'The BOT skill decision cooldown/finite stock must prevent repeat casting every frame');
  }
  for(const hiddenX of [-25,25]){
    const mascot=actor('red-mascot-hidden','red',0,0);mascot.kit=new DuelistKit({character:'duelist'});mascot.kit.smoke=2;mascot.kit.updraft=1;mascot.hp=40;
    const game=integration({player:actor('player','blue',hiddenX,-12),bots:[mascot]});game.step();assert.equal(game.casts.length,0,'A real but unobserved enemy may not steer comet cover or trigger lift');
  }
  const lowRoofMascot=actor('red-mascot-roof','red',0,0);lowRoofMascot.kit=new DuelistKit({character:'duelist'});lowRoofMascot.kit.smoke=0;lowRoofMascot.kit.updraft=1;lowRoofMascot.hp=50;
  const roofGame=integration({map:makeMap([{minX:-2,maxX:2,minZ:-2,maxZ:2,base:2.8,height:3.2}]),player:actor('player','blue',0,10),bots:[lowRoofMascot]});roofGame.step();assert.equal(roofGame.casts.length,0,'The BOT must retain lift below a real low ceiling');assert.equal(lowRoofMascot.kit.updraft,1);
  const blindMascot=actor('red-mascot-blind','red',0,0);blindMascot.kit=new DuelistKit({character:'duelist'});blindMascot.kit.smoke=2;blindMascot.hp=50;
  const blindMascotGame=integration({player:actor('player','blue',0,10),bots:[blindMascot],ordinarySkills:{blindUntil:()=>1,events:()=>[],markers:()=>[]}});blindMascotGame.step();assert.equal(blindMascotGame.casts.length,0,'Blind BOTs may not cast a visually targeted comet/lift');
  console.log('PASS: real mascot CQ economy, wounded known-approach comet and visible-threat lift, finite decision cooldown, hidden-target/blind and low-ceiling rejection');

  for(const [random,hitHeight]of [[0,1.62],[.2,1.15]]){
    const elevatedShooter=actor('red-elevated','red',0,0),elevatedTarget=actor('blue-elevated','blue',0,10);
    Object.assign(elevatedShooter,{y:2,vy:0,target:elevatedTarget,think:1,reactionUntil:0,fire:0,aiWeapon:'classic',aiAmmo:12,aiReload:0});elevatedShooter.group.rotation.y=0;Object.assign(elevatedTarget,{y:3,vy:0,rangeTarget:true});
    const game=integration({map:makeMap([{minX:-1,maxX:1,minZ:-1,maxZ:1,height:2},{minX:-1,maxX:1,minZ:9,maxZ:11,height:3}]),player:noEnemy,bots:[elevatedShooter,elevatedTarget],random});game.step();
    assert.equal(game.traces.length,1,'A visible raised actor must really fire before checking tracer coordinates');assert.ok(Math.abs(game.traces[0].from.y-(elevatedShooter.y+1.2))<1e-9,'AI muzzle origins must include shooter height');assert.ok(Math.abs(game.traces[0].to.y-(3+hitHeight))<1e-9,'Both NPC and player targets must include their own raised feet in head/body rays');assert.equal(game.hits,1);
  }
  console.log('PASS: raised BOT head/body shot rays include the actual shooter and NPC target heights');

  // Read real map geometry and ensure tactical plant goals remain physically reachable.
  global.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({measureText:t=>({width:String(t).length*8}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>target[key]||(()=>{})})})};
  const {createMap}=await load('map.js'),arena=createMap(THREE,new THREE.Group(),process.argv.includes('--hirakata')?'hirakata':'hashimoto'),nav=createNavigation(arena);
  const real=createBotTactics({sites:arena.sites,navigation:nav,collision:arena.collision,lanes:arena.lanes});
  for(const side of ['attack','defend'])for(const spawn of arena.teamSpawns[side])for(const site of arena.sites){
    const point=real.plantPosition(site,spawn,0);assert.ok(point,`${side} spawn must have a reachable planting candidate at ${site.id}`);
    assert.equal(areas.isInsideSite(site,point.x,point.z,{margin:.45}),true);
    assert.ok(Number.isFinite(real.routeDistance(spawn,point,0)));
  }
  const arenaActors=[{...actor('player','blue',0,65),alive:false},...arena.teamSpawns.attack.slice(1).map((p,i)=>actor(`blue-${i+1}`,'blue',p.x,p.z,i+1)),...arena.teamSpawns.defend.map((p,i)=>actor(`red-${i}`,'red',p.x,p.z,i))];
  const planStarted=performance.now();
  for(let i=0;i<50;i++)real.update({...matchState,now:i*.7,actors:arenaActors,spike:{status:'carried',carrier:'blue-1'}});
  const planMs=performance.now()-planStarted;
  assert.ok(planMs<2000,`Fifty real-map team plans must stay bounded, took ${planMs.toFixed(0)}ms`);
  console.log(`PASS: all real spawns reach tactical plant candidates; 50 full-team plans ${planMs.toFixed(1)}ms`);
  const rounds=[];
  for(const [seed,startingSide]of [[1,'attack'],[29,'attack'],[61,'defend'],[233,'defend']]){
    let value=seed;const random=()=>((value=(Math.imul(value,1664525)+1013904223)>>>0)/4294967296);
    const rules=new MatchRules({startingSide}),blueSpawn=arena.teamSpawns[startingSide],redSpawn=arena.teamSpawns[startingSide==='attack'?'defend':'attack'];
    const self={...actor('player','blue',blueSpawn[0].x,blueSpawn[0].z),alive:false};
    const roster=[...blueSpawn.slice(1).map((p,i)=>actor(`blue-${i+1}`,'blue',p.x,p.z,i+1)),...redSpawn.map((p,i)=>actor(`red-${i}`,'red',p.x,p.z,i))];
    for(const bot of roster){bot.fire=1.5;bot.record={secondary:'ghost'};bot.group.rotation.y=bot.team===rules.attackerTeam?Math.PI:0;}
    const game=integration({map:arena,player:self,bots:roster,match:rules,random});
    if(startingSide==='attack')rules.dropSpike('player',self.x,self.z);
    let planted=false;
    for(let frame=0;frame<3000&&rules.phase==='live';frame++){
      game.step();planted||=rules.spike.status==='planted';
      rules.tick(.05,{blueAlive:roster.filter(b=>b.team==='blue'&&b.alive).length,redAlive:roster.filter(b=>b.team==='red'&&b.alive).length,playerAlive:false});
      for(const bot of roster)assert.ok(Number.isFinite(bot.x)&&Number.isFinite(bot.z),'Combat navigation must keep finite positions');
    }
    const end=rules.drainEvents().find(event=>event.type==='round-end');
    assert.ok(end,`Real-map seed ${seed} must finish the round`);
    rounds.push({seed,reason:end.reason,planted,seconds:game.sandbox.elapsed});
  }
  assert.ok(rounds.some(result=>result.planted),'Live opponents must not prevent every tested bot team from reaching and planting');
  assert.ok(rounds.every(result=>result.reason!=='timeout'),'Tested bot-controlled carriers must not spend the full round stalled before planting');
  console.log(`PASS: real-map combat rounds ${rounds.map(r=>`${r.seed}:${r.reason}/${r.seconds.toFixed(1)}s${r.planted?' planted':''}`).join('; ')}`);
  console.log(`TOTAL: ${(performance.now()-started).toFixed(0)}ms`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
