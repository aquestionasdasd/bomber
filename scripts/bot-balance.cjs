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
  survey: options.survey === 'true', out: options.out || path.join(root, '..', 'bot-balance-report.json'),
  sourceSha256: Object.fromEntries(['game.js','abilities.js','character-skills.js'].map(f => [f,createHash('sha256').update(fs.readFileSync(path.join(root,'public',f))).digest('hex')])),
};
if (!config.maps.every(v => ['hashimoto', 'hirakata'].includes(v))) throw Error('Unknown map');
if (!/^[a-z]+$/.test(config.focal) || !/^[cqex]+$/.test(config.ablate)) throw Error('Invalid kit/key');
const body = `
 const config=${JSON.stringify(config)};
 const h=harness({realMap:true}),rows=[];
 const chars=Object.keys(imported.CHARACTER_DEFS);
 h.sandbox.benchConfig=config;
 h.run(\`var bench=null;
 let measuredDepth=0;
 const measureActivate=fn=>function(actor,key,options){
   if(bench&&actor?.id===bench.focalId&&bench.disabled.includes(key))return;
   measuredDepth++;let effect;
   try{effect=fn(actor,key,options);}finally{measuredDepth--;}
   if(effect&&bench&&measuredDepth===0){const stat=bench.actors[actor.id];if(stat)stat.casts[key]=(stat.casts[key]||0)+1;}
   return effect;
 };
 activateAbility=measureActivate(activateAbility);
 activateJapanAbility=measureActivate(activateJapanAbility);
 const measuredDamage=damageEntity;
 damageEntity=function(target,amount,killer,options){
   const hp=target.hp,armor=target.armor||0,alive=target.alive;
   const result=measuredDamage(target,amount,killer,options);
   if(bench&&alive){const actual=Math.max(0,hp-target.hp)+Math.max(0,armor-(target.armor||0)),stat=bench.actors[killer?.id];
     if(stat){stat.damage+=actual;if(!target.alive)stat.kills++;}
   }return result;
 };\`);
 for(const mapId of config.maps)for(const side of ['attack','defend'])for(let seed=config.start;seed<config.start+config.seeds;seed++){
   for(const disabled of config.survey?['']:['',config.ablate]){
     h.sandbox.caseConfig={mapId,side,seed,disabled,survey:config.survey,chars};
     h.run(\`{
       let randomState=caseConfig.seed*7817+37;Math.random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
       online=null;onlinePlaying=false;mode='menu';$('map-select').value=caseConfig.mapId;$('match-format').value='standard';$('starting-side').value=caseConfig.side;$('difficulty').value='hard';startGame();clearBots();resetOrdinarySkills();resetZoneAbilities();elapsed=0;
       player.alive=false;player.hp=0;player.x=map.teamSpawns.attack[0].x;player.z=map.teamSpawns.attack[0].z;
       roster=[];const focalIndex=(caseConfig.seed-1)%5;
       bench={focalId:'blue-'+focalIndex,disabled:caseConfig.disabled,actors:{},plants:0,defuses:0,sightSeconds:0,lockSeconds:0};
       for(const team of ['blue','red'])for(let i=0;i<5;i++){
         const character=caseConfig.survey?caseConfig.chars[((caseConfig.seed-1)*5+i+(team==='red'?7:0))%caseConfig.chars.length]:i===focalIndex?benchConfig.focal:['nope','mend','ember','nobi','duck'][i];
         const record={id:team+'-'+i,team,name:team+'-'+i,k:0,d:0,a:0,credits:3000,primary:'vandal',secondary:'classic',armor:50,survived:false,kit:new DuelistKit({character})};
         record.kit.smoke=getCharacterSkill(character,'c').max;record.kit.updraft=getCharacterSkill(character,'q').max;record.kit.ultPoints=7;
         roster.push(record);const points=map.teamSpawns[team===match.attackerTeam?'attack':'defend'];makeBot(points[i],i,team,record);
         bench.actors[record.id]={character,team,casts:{},damage:0,kills:0};
       }
       match.spike.carrier=match.attackerTeam+'-0';match.startLive();match.drainEvents();
       for(let frame=0;frame<Math.ceil(160/benchConfig.dt)&&match.phase==='live';frame++){
         const dt=benchConfig.dt;elapsed+=dt;for(const bot of bots)bot.kit.tick(elapsed);
         updateTeamAbilities();updateBots(dt);updateTraffic(dt);
         for(const bot of bots)if(bot.alive&&bot.target){bench.sightSeconds+=dt;if(ordinarySkills.capLocked(bot.id,elapsed))bench.lockSeconds+=dt;}
         match.tick(dt,{blueAlive:aliveCount('blue'),redAlive:aliveCount('red'),playerAlive:false,clockPaused:ordinarySkills.clockFrozen(elapsed)});
         for(const e of match.drainEvents()){if(e.type==='planted')bench.plants++;if(e.type==='defused')bench.defuses++;}
       }
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
 fs.writeFileSync(config.out,JSON.stringify({kind:'actual saved-game VM;headless fixed steps;all actors hard/full Vandal/full stock/7pt;not human win-rate proof',config,rows,aggregate,wallMs:Math.round(performance.now()-started),cpuMs:Math.round((process.cpuUsage(cpuStarted).user+process.cpuUsage(cpuStarted).system)/1000)},null,2));
 console.log('REPORT '+config.out+'; '+rows.length+' rounds; '+Math.round(performance.now()-started)+'ms');
}main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const runner = new Module(path.join(root, 'bot-balance-harness.cjs'), module);
runner.filename = path.join(root, 'bot-balance-harness.cjs');
runner.paths = Module._nodeModulePaths(root);
runner._compile(fixture.slice(0, boundary) + body, runner.filename);
