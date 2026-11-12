const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-car-game.cjs'),'utf8');
const cut=fixture.indexOf('  const local=harness();');
if(cut<0)throw Error('Saved-game fixture anchor missing');
const suite=String.raw`
 const h=harness();
 function setup(){h.reset();h.clearWalls();h.run("player.kit=new DuelistKit({character:'ember'});player.kit.ultPoints=7;match.phase='live';makeBot({x:0,z:-10},0,'red',{id:'enemy',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];Object.assign(enemy,{x:0,y:0,z:-10,hp:100,armor:50,alive:true,remoteId:'passive'});var castAt=elapsed;");}
 function cast(){return h.run("activateAbility(player,'x',{zonePoint:{x:0,y:0,z:-10}})");}
 function pulse(age){h.sandbox.age=age;h.run('elapsed=castAt+age;updateTeamAbilities()');}
 check('X keeps seven-point cost, three scheduled blasts, six-metre radius and matching80 damage description',()=>{
  setup();h.run('player.kit.ultPoints=6');assert.equal(cast(),undefined);assert.equal(h.run('zoneAbilities.events(elapsed).length'),0);assert.equal(h.run('player.kit.ultPoints'),6);
  h.run('player.kit.ultPoints=7');const effect=copy(cast());assert.deepEqual(effect,{type:'ember',radius:6,duration:4.8,pulses:[1.2,2.4,3.6],damage:80});assert.equal(h.run('player.kit.ultPoints'),0);assert.match(h.run('CHARACTER_DEFS.ember.description'),/80ダメージ×3回/);assert.equal(cast(),undefined);
 });
 check('actual host damage uses ordinary armor; repeated updates do not repeat damage or kill rewards',()=>{
  setup();cast();pulse(1.199);assert.equal(h.run('enemy.hp+enemy.armor'),150);pulse(1.2);near(h.run('enemy.hp+enemy.armor'),70,'first blast80 raw');assert.equal(h.run('enemy.armor'),0);pulse(1.2);near(h.run('enemy.hp'),70,'duplicate update');pulse(2.4);assert.equal(h.run('enemy.hp'),0);assert.equal(h.run('enemy.alive'),false);assert.equal(h.run('totalKills'),1);const points=h.run('player.kit.ultPoints');pulse(2.4);pulse(3.6);assert.equal(h.run('totalKills'),1);assert.equal(h.run('player.kit.ultPoints'),points);
  setup();h.run('enemy.armor=0');cast();pulse(1.2);assert.equal(h.run('enemy.hp'),20);
 });
 check('each of the three real game pulses hits fresh victims for80, while allies and departed targets stay safe',()=>{
  setup();h.run("enemy.armor=0;makeBot({x:0,z:-10},1,player.team,{id:'ally',team:player.team,secondary:'classic',kit:new DuelistKit({character:'nope'})});var ally=bots[1];ally.hp=100;ally.armor=50");cast();
  for(const age of[1.2,2.4,3.6]){h.run('enemy.hp=100;enemy.armor=0;enemy.alive=true');pulse(age);assert.equal(h.run('enemy.hp'),20);assert.equal(h.run('ally.hp+ally.armor'),150);h.run('enemy.z=-25');pulse(age+.05);assert.equal(h.run('enemy.hp'),20);h.run('enemy.z=-10');}
  pulse(4.8);assert.equal(h.run('zoneAbilities.events(elapsed).length'),0);
 });
 check('a restored independent guest draws the field but cannot apply predicted or repeated blast damage',()=>{
  setup();cast();pulse(1.2);h.run("onlinePlaying=true;online={host:true,session:{memberId:'host'},send:p=>{captured=p}};var captured;netClock=0;tickOnline(.1)");const packet=copy(h.run('captured'));
  const guest=harness();guest.reset();guest.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send(){}};netParticipants.set('guest','player')");guest.sandbox.packet=packet;guest.run("receiveNetPacket('host',packet)");const hp=guest.run("bots.find(b=>b.id==='enemy').hp");assert.equal(hp,70);assert.equal(guest.run('zoneAbilities.events(elapsed).length'),1);guest.run("elapsed+=1.2;updateTeamAbilities();updateTeamAbilities();receiveNetPacket('host',packet)");assert.equal(guest.run("bots.find(b=>b.id==='enemy').hp"),hp);
  pulse(2.4);h.run('netClock=0;tickOnline(.1)');guest.sandbox.packet=copy(h.run('captured'));guest.run("receiveNetPacket('host',packet)");assert.equal(guest.run("bots.find(b=>b.id==='enemy').alive"),false);
 });
 check('placed bombardment persists after caster death, but round/menu reset removes it',()=>{
  setup();cast();h.run('player.alive=false;player.hp=0');pulse(1.2);assert.equal(h.run('enemy.hp+enemy.armor'),70);h.run('match.round++;resetZoneAbilities()');pulse(2.4);assert.equal(h.run('enemy.hp'),70);assert.equal(h.run('zoneAbilities.events(elapsed).length'),0);
  setup();cast();h.run('backMenu()');assert.equal(h.run('zoneAbilities.events(elapsed).length'),0);
 });
 console.log('PASS: '+groups+' actual savedgame EMBER bombardment groups; no audio playback');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
`;
const instance=new Module(__filename,module);instance.filename=__filename;instance.paths=module.paths;
instance._compile(fixture.slice(0,cut)+suite,__filename);
