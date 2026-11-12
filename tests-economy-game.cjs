const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main(){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const m=new Module(path.join(__dirname,'economy-harness.cjs'),module);m.filename=path.join(__dirname,'economy-harness.cjs');m.paths=module.paths;
 m._compile(base.slice(0,cut)+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);const{harness}=await m.exports();const h=harness();let groups=0;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name)},copy=x=>JSON.parse(JSON.stringify(x));
 function setup(format='standard',side='attack'){
  h.reset();h.sandbox.format=format;h.sandbox.side=side;
  h.run(`mode='menu';$('match-format').value=format;$('starting-side').value=side;startGame();match.startLive();match.drainEvents();
   match.credits=0;for(const r of roster)r.credits=0;for(const b of bots)b.alive=false;player.alive=false;`);
 }
 function finish(team,reason='elimination'){
  Object.assign(h.sandbox,{team,reason});h.run('match.endRound(team,reason,{playerAlive:player.alive});handleMatchEvents()');
  return copy(h.run('roster.map(r=>({id:r.id,team:r.team,credits:r.id===player.id?match.credits:r.credits}))'));
 }
 function next(){h.run(`match.nextRound();match.events=[];match.startLive();match.events=[];match.credits=0;for(const r of roster)r.credits=0;`)}
 test('all ten host seats get standard win and progressive loss income in both match lengths',()=>{
  for(const format of['standard','swift'])for(const winner of['blue','red']){
   setup(format);for(let round=0;round<3;round++){
    const rows=finish(winner);for(const r of rows)assert.equal(r.credits,r.team===winner?3000:1900+round*500,`${format}/${winner}/${round}/${r.id}`);
    if(round<2)next();
   }
  }
 });
 test('a win resets both team loss tiers and event draining cannot mint a second payout',()=>{
  for(const winner of['blue','red']){
   setup();for(let i=0;i<3;i++){finish(winner);next()}
   finish(winner==='blue'?'red':'blue');next();const rows=finish(winner);
   for(const r of rows)assert.equal(r.credits,r.team===winner?3000:1900);
   const before=JSON.stringify(rows);h.run('handleMatchEvents();match.endRound(team,reason);handleMatchEvents()');
   assert.equal(JSON.stringify(copy(h.run('roster.map(r=>({id:r.id,team:r.team,credits:r.id===player.id?match.credits:r.credits}))'))),before);
  }
 });
 test('individual survivors receive only1000 on lost timeout or detonation, including short matches',()=>{
  for(const format of['standard','swift'])for(const side of['attack','defend']){
   setup(format,side);h.run("player.alive=true;bots.find(b=>b.id==='blue-1').alive=true;bots.find(b=>b.id==='red-0').alive=true");
   const winner=h.run('match.defenderTeam'),rows=finish(winner,'timeout');
   for(const r of rows)assert.equal(r.credits,r.team===winner?3000:['player','blue-1','red-0'].includes(r.id)?1000:1900);
   setup(format,side);h.run("player.alive=true;bots.find(b=>b.id==='blue-1').alive=true;bots.find(b=>b.id==='red-0').alive=true");
   const detonationWinner=h.run('match.attackerTeam'),detonationRows=finish(detonationWinner,'detonation');
   for(const r of detonationRows)assert.equal(r.credits,r.team===detonationWinner?3000:['player','blue-1','red-0'].includes(r.id)?1000:1900);
  }
 });
 test('actual planting pays each attacker300 once and no defender, actual enemy kill pays only killer200',()=>{
  for(const format of['standard','swift'])for(const side of['attack','defend']){
   setup(format,side);h.run(`player.alive=true;for(const b of bots)b.alive=true;
    match.spike.status='carried';match.spike.carrier=match.attackerTeam==='blue'?'player':'red-0';
    var args={actorId:match.spike.carrier,team:match.attackerTeam,site:'A',x:map.sites[0].x,z:map.sites[0].z};
    match.interactPlant(4,args);handleMatchEvents();match.interactPlant(4,args);handleMatchEvents();`);
   for(const r of copy(h.run('roster.map(r=>({team:r.team,credits:r.id===player.id?match.credits:r.credits}))')))assert.equal(r.credits,r.team===h.run('match.attackerTeam')?300:0);
   const before=h.run('match.credits');h.run("var victim=bots.find(b=>b.team!==player.team);damageEntity(victim,500,player);damageEntity(victim,500,player)");
   assert.equal(h.run('match.credits')-before,200);assert.equal(h.run('totalKills'),1);
  }
 });
 test('half reset clears both team loss history and preserves800 initial and5000 overtime banks',()=>{
  for(const format of['standard','swift']){
   setup(format);h.run(`match.round=format==='swift'?4:12;match.lossStreak=redLossStreak=7;match.phase='post';match.winner=null;match.nextRound();handleMatchEvents()`);
   assert.equal(h.run('match.credits'),800);assert.equal(h.run('match.lossStreak'),0);assert.equal(h.run('redLossStreak'),0);
   for(const r of copy(h.run('roster.filter(r=>r.id!==player.id).map(r=>({credits:r.credits,primary:r.primary,armor:r.armor}))')))assert.ok(r.credits>=0&&r.credits<=800);
   h.run(`match.round=format==='swift'?8:24;match.phase='post';match.winner=null;match.nextRound();handleMatchEvents()`);assert.equal(h.run('match.credits'),5000);
  }
 });
 test('host payout is clamped to9000, guest restores that authority and duplicate JSON grants nothing',()=>{
  const guest=harness();guest.reset();
  for(const [peer,isHost]of[[h,true],[guest,false]]){peer.sandbox.isHost=isHost;peer.run(`
   online={host:isHost,session:{memberId:isHost?'host':'friend',hostId:'host'},
    room:{code:'COIN2345',hostId:'host',status:'playing',settings:{format:'swift'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},
    sent:[],send(packet){this.sent.push(packet)},close(){}};
   onlinePlaying=true;mode='menu';$('match-format').value='swift';$('starting-side').value='attack';startGame();
   netSequence=0;netLastSnapshot=0;netHasSnapshot=false;netRound=0;netClock=0;netInputs.clear();netApplied.clear();netActions=[];netActionSequence=0;elapsed=10;
   if(isHost){match.startLive();match.events=[];match.credits=8900;for(const r of roster)r.credits=8900;}`)}
  finish('red');h.run('tickOnline(.1)');const packet=copy(h.run('online.sent.at(-1)'));assert.ok(packet);assert.ok(Buffer.byteLength(JSON.stringify(packet))<65536);
  // Local host credits live in MatchRules and its actor; roster.player is
  // intentionally not the local wallet (the scoreboard also reads MatchRules).
  for(const r of packet.roster.filter(r=>r.id!=='player'))assert.equal(r.credits,9000);assert.equal(packet.actors.find(a=>a.id==='player').credits,9000);
  guest.sandbox.incoming=packet;guest.run("receiveNetPacket('host',incoming)");assert.equal(guest.run('match.credits'),9000);
  guest.run("receiveNetPacket('host',incoming)");assert.equal(guest.run('match.credits'),9000);
 });
 console.log(`PASS: ${groups} actual saved-game economy groups; silent independent host/guest JSON`);return groups;
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
