// Offline actual-game BOT rounds. Reuse the saved-game test's inert DOM/audio
// harness; no copied combat model, browser injection, network or audio device.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(root, 'tests-onnara-game.cjs'), 'utf8');
const boundary = fixture.indexOf(' const local=harness();');
if (boundary < 0) throw Error('Saved-game harness boundary changed; review before measuring.');
const options = Object.fromEntries(process.argv.slice(2).map(v => v.replace(/^--/, '').split('=')));
const config = {
  seeds: Math.max(1, Math.min(30, Number(options.seeds) || 2)),
  start: Math.max(1, Math.min(10000, Number(options.start) || 1)),
  dt: options.dt === '.05' ? .05 : .1,
  maps: (options.maps || 'hashimoto,hirakata').split(','),
  focal: options.focal || 'cap', ablate: options.ablate || 'c',
  weapon: options.weapon || 'vandal', magazine: options.magazine || 'full', reserve: options.reserve || 'full',
  diagnostics: options.diagnostics === 'true',
  frameDriver: 'actual updatePlay; one clock/skill/traffic/car/match update per frame',
  harnessSha256: createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
  survey: options.survey === 'true', out: options.out || path.join(root, '..', 'bot-balance-report.json'),
  sourceSha256: Object.fromEntries(['game.js','abilities.js','character-skills.js','rules.js'].map(f => [f,createHash('sha256').update(fs.readFileSync(path.join(root,'public',f))).digest('hex')])),
};
if (!config.maps.every(v => ['hashimoto', 'hirakata'].includes(v))) throw Error('Unknown map');
if (!/^[a-z]+$/.test(config.focal) || !/^[cqex]+$/.test(config.ablate)) throw Error('Invalid kit/key');
if (!['full','low','empty'].includes(config.magazine) || !['full','short','empty'].includes(config.reserve)) throw Error('Invalid magazine/reserve scenario');
if (!/^[a-z]+$/.test(config.weapon)) throw Error('Invalid weapon');
const body = `
 const config=${JSON.stringify(config)};
 const h=harness({realMap:true}),rows=[];
 const chars=Object.keys(imported.CHARACTER_DEFS);
 if(!chars.includes(config.focal)||!['primary','secondary'].includes(imported.WEAPONS[config.weapon]?.slot))throw Error('Unknown character or firearm');
 h.sandbox.benchConfig=config;
 h.run(\`var bench=null;
 let measuredDepth=0;
 const measureActivate=fn=>function(actor,key,options){
   if(bench&&actor?.id===bench.focalId&&bench.disabled.includes(key))return;
   measuredDepth++;let effect;
   try{effect=fn(actor,key,options);}finally{measuredDepth--;}
   if(effect&&bench&&measuredDepth===0){const stat=bench.actors[actor.id];if(stat){stat.casts[key]=(stat.casts[key]||0)+1;
     if(actor.kit?.character==='renko'&&key==='c'&&stat.restartRefills>0)stat.restartLaterCasts=(stat.restartLaterCasts||0)+1;
     if(actor.kit?.character==='cat'&&key==='x')(stat.clockCasts||=[]).push({at:elapsed,team:actor.team,attackerTeam:match.attackerTeam,status:match.spike.status,roundTime:match.roundTime,bomberTime:match.spike.timer});
   }}
   return effect;
 };
 activateAbility=measureActivate(activateAbility);
 activateJapanAbility=measureActivate(activateJapanAbility);
 // This callback is injected only into the saved-game measurement source,
 // immediately after the real HP assignment. Never credit requested/overflow HP.
 function observeMendHeal(target,source,before){
   const actual=Math.max(0,target.hp-before),owner=bench?.actors[source.id];
   if(owner&&measuredOrdinaryDepth&&actual>0){owner.mendHeals=(owner.mendHeals||0)+1;owner.mendHealing=(owner.mendHealing||0)+actual;const key=target.id===source.id?'mendSelfHealing':'mendAllyHealing';owner[key]=(owner[key]||0)+actual;(owner.mendTargets||={})[target.id]=true;}
 }
 const measuredOrdinaryUpdate=ordinarySkills.update;
 const renkoPushEffects=new Map(),renkoPushWindows=new Map();
 ordinarySkills.update=function(...args){
   const effects=measuredOrdinaryUpdate(...args);
   if(bench)for(const effect of effects)if(effect.type==='renko-push')renkoPushEffects.set(effect.eventId,effect);
   if(bench)for(const effect of effects)if(effect.type==='nearsight'){
     const owner=bench.actors[effect.sourceId],target=bench.actors[effect.targetId];
     if(owner&&target){const key=owner.team===target.team?'gloomFriendlyHits':'gloomEnemyHits';owner[key]=(owner[key]||0)+1;}
   }
   if(bench)for(const effect of effects)if(effect.type==='blind'){
     const owner=bench.actors[effect.sourceId],target=bench.actors[effect.targetId];
     if(owner?.character==='echo'&&target){const key=effect.targetId===effect.sourceId?'glintSelfBlinds':owner.team===target.team?'glintFriendlyBlinds':'glintEnemyBlinds';owner[key]=(owner[key]||0)+1;if(owner.team!==target.team)owner.glintEnemyBlindSeconds=(owner.glintEnemyBlindSeconds||0)+effect.duration;}
   }
   if(bench)for(const effect of effects)if(effect.type==='detect'){
     const owner=bench.actors[effect.sourceId];
     if(owner?.character==='echo'){owner.tagDetections=(owner.tagDetections||0)+1;(owner.tagPoints||=[]).push({x:effect.x,y:effect.y,z:effect.z,at:effect.detectedAt,endsAt:effect.endsAt});}
   }return effects;
 };
 const measuredPads=tickDuckPads;
 tickDuckPads=function(){
   const opportunities=[player,...bots].map(a=>({actor:a,before:a.duckPadAt,pad:ordinarySkills.duckPad(ordinaryActorView(a),elapsed,{groundHeight:ordinaryGroundHeight})}));
   const result=measuredPads();
   if(bench)for(const p of opportunities)if(p.pad&&p.actor.duckPadAt===elapsed&&p.actor.duckPadAt!==p.before){
     const owner=bench.actors[p.pad.sourceId],rider=bench.actors[p.actor.id];
     if(owner){owner.padUses=(owner.padUses||0)+1;const key=p.actor.team===p.pad.team?'padFriendlyUses':'padEnemyUses';owner[key]=(owner[key]||0)+1;}
     if(rider)rider.padLaunches=(rider.padLaunches||0)+1;
   }return result;
 };
 const measuredService=tickServiceReload;
 tickServiceReload=function(actor,dt){
   const marker=actor.serviceReload,before=actor.aiAmmo,result=measuredService(actor,dt);
   if(bench&&marker&&!actor.serviceReload&&actor.aiAmmo>before){const stat=bench.actors[actor.id];if(stat){stat.serviceCompletions++;stat.serviceRounds+=actor.aiAmmo-before;}}
   return result;
 };
 // Separate actual ordinary-skill losses from zone ultimate/gun damage.
 // EMBER's only damaging ordinary event is C; do not count requested overkill.
 let measuredOrdinaryDepth=0;
 const measuredOrdinaryFrame=updateOrdinarySkills;
 updateOrdinarySkills=function(...args){measuredOrdinaryDepth++;try{return measuredOrdinaryFrame(...args);}finally{measuredOrdinaryDepth--;}};
 const measuredPushStart=beginCarMotion;
 beginCarMotion=function(actor,m,...args){
   const result=measuredPushStart(actor,m,...args),effect=renkoPushEffects.get(m.id);
   if(bench&&measuredOrdinaryDepth&&m.phase===4&&actor.carMotion?.id===m.id&&effect?.targetId===actor.id){
     const owner=bench.actors[effect.sourceId];if(owner){owner.dartPushes=(owner.dartPushes||0)+1;renkoPushWindows.set(actor.id,{id:m.id,sourceId:effect.sourceId,at:elapsed});}
   }
   renkoPushEffects.delete(m.id);return result;
 };
 const measuredDamage=damageEntity;
 damageEntity=function(target,amount,killer,options){
   const hp=target.hp,armor=target.armor||0,alive=target.alive;
   const restart=killer?.alive&&killer.kit?.character==='renko'&&renkoUltimateActive(killer)?[killer.kit.smoke,killer.kit.updraft,killer.kit.dash]:null;
   const result=measuredDamage(target,amount,killer,options);
   if(bench&&alive){const actual=Math.max(0,hp-target.hp)+Math.max(0,armor-(target.armor||0)),stat=bench.actors[killer?.id];
     if(stat){stat.damage+=actual;if(options?.skill==='car'&&target.carMotion?.phase===2){stat.ramHits++;stat.ramDamage+=actual;}if(measuredOrdinaryDepth&&killer?.kit?.character==='ember'&&options?.skill==='ember'&&actual>0){stat.solderHits=(stat.solderHits||0)+1;stat.solderDamage=(stat.solderDamage||0)+actual;if(!target.alive)stat.solderKills=(stat.solderKills||0)+1;}if(measuredOrdinaryDepth&&killer?.kit?.character==='nope'&&options?.skill==='nope'&&actual>0){stat.bottleHits=(stat.bottleHits||0)+1;stat.bottleDamage=(stat.bottleDamage||0)+actual;if(!target.alive)stat.bottleKills=(stat.bottleKills||0)+1;}if(!target.alive)stat.kills++;
       if(restart&&!target.alive&&actual>0&&target.team!==killer.team){stat.restartRefills=(stat.restartRefills||0)+1;for(const[i,key]of['smoke','updraft','dash'].entries()){const restored=Math.max(0,killer.kit[key]-restart[i]);stat['restartRestored'+key]=(stat['restartRestored'+key]||0)+restored;}}
       const push=renkoPushWindows.get(target.id);if(options?.firearm&&actual>0&&push?.sourceId===killer.id&&elapsed>=push.at&&elapsed-push.at<=2){stat.dartFollowupDamage=(stat.dartFollowupDamage||0)+actual;if(!target.alive)stat.dartFollowupKills=(stat.dartFollowupKills||0)+1;}
     }
   }return result;
 };
 // Use the browser's complete frame driver. The old partial tick omitted
 // forced car movement and must not be used for balance conclusions.
 let rootStepDt=0,rootStepSeen=new Set();
 const measuredSpeedScale=ordinarySkills.speedScale;
 ordinarySkills.speedScale=function(actor,now,queries){
   const scale=measuredSpeedScale(actor,now,queries);
   if(bench&&rootStepDt>0&&scale<=VEIL_SKILLS.rootsSpeedScale){
     for(const event of ordinarySkills.events(now))if(now>=event.triggerAt&&ordinarySkills.wouldRoot(actor,event,queries)){
       const owner=bench.actors[event.sourceId],key=event.sourceId+'|'+actor.id;
       if(owner&&!rootStepSeen.has(key)){rootStepSeen.add(key);owner.rootSlowSamples=(owner.rootSlowSamples||0)+1;owner.rootSlowSeconds=(owner.rootSlowSeconds||0)+rootStepDt;(owner.rootTargets||={})[actor.id]=true;}
     }
   }
   if(bench&&rootStepDt>0&&scale<=MEND_SKILLS.seedsSpeedScale){
     for(const event of ordinarySkills.events(now))if(now>=event.triggerAt&&ordinarySkills.wouldSeed(actor,event,queries)){
       const owner=bench.actors[event.sourceId],key='seeds|'+event.sourceId+'|'+actor.id;
       if(owner&&!rootStepSeen.has(key)){rootStepSeen.add(key);owner.seedSlowSamples=(owner.seedSlowSamples||0)+1;owner.seedSlowSeconds=(owner.seedSlowSeconds||0)+rootStepDt;(owner.seedTargets||={})[actor.id]=true;}
     }
   }
   if(bench&&rootStepDt>0&&scale<=FROST_SKILLS.stitchSpeedScale){
     for(const event of ordinarySkills.events(now))if(now>=event.triggerAt&&ordinarySkills.wouldStitch(actor,event,queries)){
       const owner=bench.actors[event.sourceId],key='stitch|'+event.sourceId+'|'+actor.id;
       if(owner&&!rootStepSeen.has(key)){rootStepSeen.add(key);owner.stitchSlowSamples=(owner.stitchSlowSamples||0)+1;owner.stitchSlowSeconds=(owner.stitchSlowSeconds||0)+rootStepDt;(owner.stitchTargets||={})[actor.id]=true;}
     }
   }
   return scale;
 };
 function advanceMeasuredRound(dt){rootStepDt=dt;rootStepSeen.clear();try{updatePlay(dt);}finally{rootStepDt=0;}}
 function observeMeasuredMatch(){
   renkoPushEffects.clear();renkoPushWindows.clear();
   const drainEvents=match.drainEvents.bind(match);
   match.drainEvents=function(){const events=drainEvents();for(const e of events){if(e.type==='planted'){bench.plants++;if(bench.actors[e.actorId])bench.actors[e.actorId].plants=(bench.actors[e.actorId].plants||0)+1;}if(e.type==='defused'){bench.defuses++;if(bench.actors[e.actorId])bench.actors[e.actorId].defuses=(bench.actors[e.actorId].defuses||0)+1;}}return events;};
   for(const method of ['interactPlant','interactDefuse']){
     const work=match[method].bind(match),field=method==='interactPlant'?'plantProgress':'defuseProgress';
     match[method]=function(dt,options){const before=this.spike[field],result=work(dt,options),after=this.spike[field],stat=bench.actors[options.actorId];
       if(stat&&after>before){const scale=ordinarySkills.nobiWork(options.actorId,elapsed,[player,...bots].find(a=>a.id===options.actorId),ordinaryReachable)||1,progress=after-before;stat.workProgress=(stat.workProgress||0)+progress;if(scale>1){stat.toolWorkProgress=(stat.toolWorkProgress||0)+progress;stat.toolSavedSeconds=(stat.toolSavedSeconds||0)+progress*(1-1/scale);}}return result;
     };
   }
 }
 const measuredCarMotion=updateCarMotions;
 updateCarMotions=function(dt){
   const before=[player,...bots].map(a=>({actor:a,x:a.x,z:a.z,phase:a.carMotion?.phase,motionId:a.carMotion?.id}));
   const result=measuredCarMotion(dt);
   if(bench){bench.carMotionFrames++;for(const p of before){const stat=bench.actors[p.actor.id];if(stat&&p.phase){const moved=Math.hypot(p.actor.x-p.x,p.actor.z-p.z);if(p.phase===1)stat.ramTravel+=moved;else stat.launchedTravel+=moved;const push=renkoPushWindows.get(p.actor.id),owner=bench.actors[push?.sourceId];if(p.phase===4&&push?.id===p.motionId&&owner)owner.dartPushDistance=(owner.dartPushDistance||0)+moved;}}}
   return result;
 };\`);
 for(const mapId of config.maps)for(const side of ['attack','defend'])for(let seed=config.start;seed<config.start+config.seeds;seed++){
   for(const disabled of config.survey?['']:['',config.ablate]){
     h.sandbox.caseConfig={mapId,side,seed,disabled,survey:config.survey,chars};
     h.run(\`{
       let randomState=caseConfig.seed*7817+37;Math.random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
       online=null;onlinePlaying=false;mode='menu';$('map-select').value=caseConfig.mapId;$('match-format').value='standard';$('starting-side').value=caseConfig.side;$('difficulty').value='hard';startGame();clearBots();resetOrdinarySkills();resetZoneAbilities();elapsed=0;
       player.alive=false;player.hp=0;player.x=map.teamSpawns.attack[0].x;player.z=map.teamSpawns.attack[0].z;
       roster=[];const focalIndex=(caseConfig.seed-1)%5;
       bench={focalId:'blue-'+focalIndex,disabled:caseConfig.disabled,actors:{},plants:0,defuses:0,sightSeconds:0,lockSeconds:0,frames:0,carMotionFrames:0};
       if(benchConfig.diagnostics)bench.frostQ={liveSeconds:0,stockSeconds:0,knownSeconds:0,oldRangeSeconds:0,oldNeedSeconds:0,oldWindowSeconds:0,visibleAdvanceSeconds:0,roleSeconds:{}};
       for(const team of ['blue','red'])for(let i=0;i<5;i++){
         const character=caseConfig.survey?caseConfig.chars[((caseConfig.seed-1)*5+i+(team==='red'?7:0))%caseConfig.chars.length]:i===focalIndex?benchConfig.focal:['nope','mend','ember','nobi','duck'][i];
         const record={id:team+'-'+i,team,name:team+'-'+i,k:0,d:0,a:0,credits:3000,primary:'vandal',secondary:'classic',armor:50,survived:false,kit:new DuelistKit({character})};
         if(record.id===bench.focalId){const spec=WEAPONS[benchConfig.weapon];record.primary=spec.slot==='primary'?benchConfig.weapon:null;record.secondary=spec.slot==='secondary'?benchConfig.weapon:'classic';}
         record.kit.smoke=getCharacterSkill(character,'c').max;record.kit.updraft=getCharacterSkill(character,'q').max;record.kit.ultPoints=7;
         roster.push(record);const points=map.teamSpawns[team===match.attackerTeam?'attack':'defend'];makeBot(points[i],i,team,record);
         bench.actors[record.id]={character,team,casts:{},damage:0,kills:0,plants:0,defuses:0,workProgress:0,toolWorkProgress:0,toolSavedSeconds:0,serviceCompletions:0,serviceRounds:0,ramHits:0,ramDamage:0,ramTravel:0,launchedTravel:0};
         if(record.id===bench.focalId){const actor=bots.at(-1),weaponId=record.primary||record.secondary,spec=WEAPONS[weaponId];Object.assign(actor,{aiWeapon:weaponId,aiAmmo:benchConfig.magazine==='empty'?0:benchConfig.magazine==='low'?Math.max(1,Math.floor(spec.mag*.25)):spec.mag,aiReserve:benchConfig.reserve==='empty'?0:benchConfig.reserve==='short'?Math.max(1,Math.floor(spec.mag*.25)):spec.reserve,aiReload:0});bench.initialFocal={weapon:weaponId,ammo:actor.aiAmmo,reserve:actor.aiReserve};}
       }
       if(benchConfig.diagnostics&&updateBots.tactics&&!updateBots.tactics.benchMeasured){
         const actualPlan=updateBots.tactics.update;updateBots.tactics.update=function(...args){const plan=actualPlan.apply(this,args);if(bench)bench.focalRole=plan?.roles.get(bench.focalId);return plan;};updateBots.tactics.benchMeasured=true;
       }
       match.spike.carrier=match.attackerTeam+'-0';match.startLive();match.drainEvents();
       observeMeasuredMatch();
       for(let frame=0;frame<Math.ceil(160/benchConfig.dt)&&match.phase==='live';frame++){
         const dt=benchConfig.dt;advanceMeasuredRound(dt);bench.frames++;
         if(bench.frostQ){const focal=bots.find(bot=>bot.id===bench.focalId),m=bench.frostQ,role=bench.focalRole;
           if(focal?.alive&&focal.kit.character==='frost'){
             m.liveSeconds+=dt;m.roleSeconds[role?.role||'none']=(m.roleSeconds[role?.role||'none']||0)+dt;
             if(focal.kit.updraft>0){m.stockSeconds+=dt;const known=focal.target||(focal.lastSeen&&elapsed-focal.lastSeen.seenAt<1?focal.lastSeen:null);
               if(known){const d=Math.hypot(focal.x-known.x,focal.z-known.z),oldRange=d>5&&d<20,need=focal.hp<65||role?.urgent;
                 m.knownSeconds+=dt;if(oldRange)m.oldRangeSeconds+=dt;if(need)m.oldNeedSeconds+=dt;if(oldRange&&need)m.oldWindowSeconds+=dt;
                 if(focal.target&&d>12&&d<=FROST_SKILLS.mistRange+10&&role?.goal&&Math.hypot(focal.x-role.goal.x,focal.z-role.goal.z)>5)m.visibleAdvanceSeconds+=dt;
               }
             }
           }
         }
         for(const bot of bots)if(bot.alive&&bot.target){bench.sightSeconds+=dt;if(ordinarySkills.capLocked(bot.id,elapsed))bench.lockSeconds+=dt;}
       }
       if(bench.frames!==bench.carMotionFrames||Math.abs(elapsed-bench.frames*benchConfig.dt)>1e-6)throw Error('Incomplete/duplicate measured frame pipeline');
       bench.result={winner:match.lastRound?.team||null,reason:match.lastRound?.reason||'unfinished',seconds:elapsed,alive:{blue:aliveCount('blue'),red:aliveCount('red')},focalAlive:bots.find(b=>b.id===bench.focalId)?.alive};
     }\`);
     const result=JSON.parse(h.run('JSON.stringify(bench)'));
     rows.push({mapId,side,seed,disabled,...result});
     console.log('ROUND '+rows.length+' '+mapId+' '+side+' seed'+seed+' '+(disabled||'enabled')+' '+result.result.winner+'/'+result.result.reason+' '+result.result.seconds.toFixed(1)+'s');
   }
 }
 const aggregate={};for(const row of rows)for(const [id,a]of Object.entries(row.actors)){
   const key=a.character+':'+(row.disabled||'enabled'),s=aggregate[key]||={appearances:0,wins:0,damage:0,kills:0,casts:{}};
   s.appearances++;s.wins+=row.result.winner===a.team?1:0;s.damage+=a.damage;s.kills+=a.kills;
   for(const[k,v]of Object.entries(a.casts))s.casts[k]=(s.casts[k]||0)+v;
 }
 fs.writeFileSync(config.out,JSON.stringify({kind:'actual saved-game VM;headless fixed steps;all hard/full skill stock/7pt;only blue focal firearm/magazine/reserve varied, others Vandal;not human win-rate proof',config,rows,aggregate,wallMs:Math.round(performance.now()-started),cpuMs:Math.round((process.cpuUsage(cpuStarted).user+process.cpuUsage(cpuStarted).system)/1000)},null,2));
 console.log('REPORT '+config.out+'; '+rows.length+' rounds; '+Math.round(performance.now()-started)+'ms');
}main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const fixturePrefix=fixture.slice(0,boundary).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8').replace(\"if(target.hp>before)skillImpact(target,source,'mend','heal');\",\"if(target.hp>before){skillImpact(target,source,'mend','heal');observeMendHeal(target,source,before);}\")");
module.exports={body,fixturePrefix};
if(require.main===module){
 const runner = new Module(path.join(root, 'bot-balance-harness.cjs'), module);
 runner.filename = path.join(root, 'bot-balance-harness.cjs');
 runner.paths = Module._nodeModulePaths(root);
 runner._compile(fixturePrefix + body, runner.filename);
}
