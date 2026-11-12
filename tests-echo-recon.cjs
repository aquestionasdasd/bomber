const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-car-game.cjs'),'utf8'),cut=fixture.indexOf('  const local=harness();');
if(cut<0)throw Error('Saved-game fixture anchor missing');
const suite=String.raw`
 const h=harness();
 function setup(g=h){g.reset();g.clearWalls();g.run("teamAbilities.reset();player.kit=new DuelistKit({character:'echo'});player.kit.ultPoints=7;match.phase='live';makeBot({x:300,z:0},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.remoteId='passive';enemy.fire=999;enemy.reactionUntil=999");}
 check('real X activation, kit and visible instructions agree on300m; boundary included and beyond excluded',()=>{
  setup();h.run("makeBot({x:300.001,z:0},1,'red',{id:'outside',team:'red',kit:new DuelistKit({character:'nope'})});makeBot({x:1,z:0},2,'blue',{id:'ally',team:'blue',kit:new DuelistKit({character:'mend'})});makeBot({x:1,z:1},3,'red',{id:'dead',team:'red',kit:new DuelistKit({character:'nope'})});bots[3].alive=false;bots[3].hp=0;var effect=activateAbility(player,'x')");
  assert.equal(h.run('effect.radius'),300);assert.equal(h.run('player.kit.ultPoints'),0);assert.deepEqual(copy(h.run("teamAbilities.markers('blue',elapsed).map(m=>[m.targetId,m.x,m.z])")),[['enemy',300,0]]);
  assert.equal(h.run('teamAbilities.events(elapsed)[0].radius'),300);assert.match(h.run('CHARACTER_DEFS.echo.description'),/半径300m/);assert.equal(h.run('IAGNU_SKILLS.tagRadius'),4.5);assert.equal(h.run('IAGNU_SKILLS.tagRange'),18);
  const html=fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8');assert.equal((html.match(/IAGNU \/ (?:X：)?半径300m・3回索敵/g)||[]).length,2);assert.match(html,/Xは半径300m内を3回索敵/);
 });
 check('real game samples0/2/4s only, retains fixed center and fixed1.25s observations without tracking',()=>{
  setup();h.run("activateAbility(player,'x');enemy.x=250;player.x=100;elapsed=10.5;updateTeamAbilities()");assert.equal(h.run("teamAbilities.markers('blue',elapsed)[0].x"),300);
  h.run('elapsed=11.25;updateTeamAbilities()');assert.equal(h.run("teamAbilities.markers('blue',elapsed).length"),0);
  h.run('elapsed=12;updateTeamAbilities()');assert.equal(h.run("teamAbilities.markers('blue',elapsed)[0].x"),250);h.run('enemy.x=301;elapsed=14;updateTeamAbilities()');assert.equal(h.run("teamAbilities.markers('blue',elapsed).length"),0,'Caster movement cannot drag the300m center');
  h.run('elapsed=16;updateTeamAbilities()');assert.equal(h.run('teamAbilities.events(elapsed).length'),0);
 });
 check('real host packets share only the receiving team pings; independent JSON guest cannot sample or follow enemies',()=>{
  setup();h.run("activateAbility(player,'x');teamAbilities.castRecon(enemy,elapsed,match.round);updateTeamAbilities();onlinePlaying=true;online={host:true,session:{memberId:'host'},send:(packet,options)=>captures[options.team]=JSON.parse(JSON.stringify(packet))};var captures={};netClock=0;tickOnline(.1)");
  const packets=copy(h.run('captures'));for(const team of['blue','red']){assert.ok(packets[team].teamAbilities.pings.length>0);assert.ok(packets[team].teamAbilities.pings.every(p=>p.observerTeam===team));assert.ok(packets[team].teamAbilities.events.every(e=>e.radius===300));}
  const guest=harness();setup(guest);guest.sandbox.received=copy(packets.blue);guest.run("elapsed=received.time;teamAbilities.restore(received.teamAbilities,elapsed,received.round);onlinePlaying=true;online={host:false};enemy.x=40;elapsed+=2;updateTeamAbilities()");assert.equal(guest.run("teamAbilities.markers('blue',elapsed).length"),0,'Guest never creates the second pulse locally');assert.equal(guest.run('enemy.x'),40);
  h.run('onlinePlaying=false;enemy.x=240;elapsed=12;updateTeamAbilities()');guest.sandbox.state=copy(h.run('teamAbilities.snapshot()'));guest.run('teamAbilities.restore(state,12,match.round)');assert.equal(guest.run("teamAbilities.markers('blue',12)[0].x"),240);guest.run('enemy.x=20');assert.equal(guest.run("teamAbilities.markers('blue',12)[0].x"),240);
 });
 check('prediction does not scan; insufficient points, busy, dead and buy phase retain authority guards',()=>{
  setup();h.run("activateAbility(player,'x',{predict:true})");assert.equal(h.run('player.kit.ultPoints'),0);assert.equal(h.run('teamAbilities.events(elapsed).length'),0);
  for(const blocked of['player.kit.ultPoints=6','player.planting=true','player.defusing=true','player.alive=false;player.hp=0',"match.phase='buy'"]){setup();h.run(blocked);const points=h.run('player.kit.ultPoints');h.run("activateAbility(player,'x')");assert.equal(h.run('player.kit.ultPoints'),points);assert.equal(h.run('teamAbilities.events(elapsed).length'),0);}
 });
 console.log('PASS: '+groups+' actual savedgame IAGNU300m recon groups; inert audio only');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
`;
const instance=new Module(__filename,module);instance.filename=__filename;instance.paths=module.paths;instance._compile(fixture.slice(0,cut)+suite,__filename);
