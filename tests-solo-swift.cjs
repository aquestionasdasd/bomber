const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true}={}){
 const root=__dirname,read=f=>fs.readFileSync(path.join(root,f),'utf8');
 let template=read('tests-nope-decoy-game.cjs');
 const storage='localStorage: { getItem: () => null, setItem() {} }';assert.ok(template.includes(storage));
 template=template.replace(storage,"localStorage: (()=>{const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}})()");
 template=template.replace('append(node) { this.children.push(node); node.parentNode = this; }','append(...nodes) { for(const node of nodes){this.children.push(node); node.parentNode = this;} }');
 const cut=template.indexOf('  const local = harness();'),m=new Module(path.join(root,'solo-swift-harness.cjs'),module);assert.ok(cut>0);
 m.filename=path.join(root,'solo-swift-harness.cjs');m.paths=module.paths;m.gameSource=mutate(read('public/game.js'));
 m._compile(template.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.gameSource")+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);
 const {harness}=await m.exports();let groups=0;
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name);},copy=x=>JSON.parse(JSON.stringify(x));
 const setup=({format='solo-swift',side='attack',map='hashimoto',realMap=false}={})=>{const h=harness({realMap});Object.assign(h.sandbox,{testFormat:format,testSide:side,testMap:map});h.run(`mode='menu';$('agent-select').value='nope';$('map-select').value=testMap;$('match-format').value=testFormat;$('starting-side').value=testSide;startGame()`);return h;};
 const roster=h=>copy(h.run('roster.map(r=>({id:r.id,team:r.team,character:r.botCharacter}))'));
 const assertSolo=h=>{assert.equal(h.run('match.format'),'swift');assert.equal(h.run('match.soloSwift'),true);assert.equal(h.run('match.target'),5);assert.equal(h.run('roster.length'),6);assert.equal(h.run("roster.filter(r=>r.team==='blue').length"),1);assert.equal(h.run('bots.length'),5);assert.equal(h.run("bots.every(b=>b.team==='red'&&!b.remoteId)"),true);assert.equal(h.run("aliveCount('blue')"),1);assert.equal(h.run("aliveCount('red')"),5);};
 test('solo roster: real starts on all3 maps and both sides have one player and five distinct enemy CPUs',()=>{
  for(const map of['hashimoto','hirakata','trc'])for(const side of['attack','defend']){
   const h=setup({map,side,realMap:true});assertSolo(h);assert.equal(h.run("map.id||'hashimoto'"),map);assert.equal(h.run('match.side'),side);assert.equal(h.run('difficulty'),'hard');
   assert.equal(new Set(roster(h).slice(1).map(r=>r.character)).size,5);assert.ok(roster(h).slice(1).every(r=>r.character!=='nope'));assert.equal(h.run('bots.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.z))'),true);
   // Existing maps place the bomber on the attack-spawn floor for pickup.
   assert.equal(h.run('match.spike.status'),'dropped');h.sandbox.testCarrier=side==='attack'?'player':'red-0';
   assert.equal(h.run('match.pickupSpike(testCarrier,match.attackerTeam,match.spike.x,match.spike.z,match.spike.y||0)'),true);assert.equal(h.run('match.spike.carrier'),side==='attack'?'player':'red-0');
  }
 });
 test('nine-round Swift control: swap after4, first to5, no allies return and drafted kits persist',()=>{
  for(const side of['attack','defend']){const h=setup({side}),initial=roster(h);for(let round=1;round<=9;round++){
   assertSolo(h);assert.equal(h.run('match.round'),round);assert.deepEqual(roster(h),initial);assert.equal(h.run('match.side'),round<=4?side:round<=8?(side==='attack'?'defend':'attack'):side);
   h.sandbox.testWinner=round===9?'blue':round%2?'blue':'red';h.run("match.startLive();match.events=[];match.endRound(testWinner,'elimination');handleMatchEvents()");assert.equal(h.run('match.winner'),round===9?'blue':null);
   h.run('match.nextRound();handleMatchEvents()');if(round<9)assert.equal(h.run('mode'),'play');
  }assert.equal(h.run('mode'),'result');assert.equal(h.run('match.score.blue'),5);assert.equal(h.run('match.score.red'),4);assert.equal(h.run('careerCoins.balance'),500);}
 });
 test('five actual elimination rounds pay500 win plus normal10 per kill, once; round credits retain3000 and cap9000',()=>{
  const h=setup();for(let round=1;round<=5;round++){
   h.run("match.startLive();match.events=[];for(const enemy of bots)damageEntity(enemy,500,player);updatePlay(.05)");assert.equal(h.run('match.phase'),'post');assert.equal(h.run('match.lastRound.reward'),3000);assert.ok(h.run('match.credits')<=9000);assert.equal(h.run('careerCoins.balance'),round*50);
   h.run('match.nextRound();handleMatchEvents()');
  }assert.equal(h.run('mode'),'result');assert.equal(h.run('totalKills'),25);assert.equal(h.run('careerCoins.balance'),750);assert.match(h.elements.get('result-description').textContent,/1v5 スイフト.*500 489coin/);
  h.run("$('match-format').value='standard';handleMatchEvents();finish(true);careerCoins.progress({kills:25,finished:true,won:true})");assert.equal(h.run('careerCoins.balance'),750);h.run('backMenu()');assert.equal(h.run('careerCoins.balance'),750);
 });
 test('single-player death loses unplanted rounds; a five-round loss and abandonment give no victory reward',()=>{
  const h=setup();for(let round=1;round<=5;round++){h.run('match.startLive();match.events=[];damageEntity(player,500,bots[0]);updatePlay(.05)');assert.equal(h.run('match.phase'),'post');assert.equal(h.run('match.lastRound.team'),'red');h.run('match.nextRound();handleMatchEvents()');}
  assert.equal(h.run('mode'),'result');assert.equal(h.run('careerCoins.balance'),0);assert.doesNotMatch(h.elements.get('result-description').textContent,/勝利報酬/);
  const a=setup();a.run("match.startLive();match.events=[];match.endRound('blue','elimination');handleMatchEvents();backMenu();careerCoins.progress({kills:0,finished:true,won:true})");assert.equal(a.run('careerCoins.balance'),0);
 });
 test('post-plant sole attacker death does not prematurely lose; actual planted timer can win the round',()=>{
  const h=setup();h.run("match.startLive();match.events=[];Object.assign(match.spike,{status:'planted',carrier:null,site:'A',x:map.sites[0].x,z:map.sites[0].z,timer:.08});damageEntity(player,500,bots[0]);updatePlay(.02)");assert.equal(h.run('match.phase'),'live');h.run('updatePlay(.05);updatePlay(.02)');assert.equal(h.run('match.lastRound.team'),'blue');assert.equal(h.run('match.lastRound.reason'),'detonation');assert.equal(h.run('careerCoins.balance'),0);
 });
 test('standard and ordinary Swift keep ten slots and100 win; practice stays solo without rewards; bonus captured at match start',()=>{
  for(const format of['standard','swift','range','explore','plant','defuse']){const h=setup({format}),practice=!['standard','swift'].includes(format);assert.equal(h.run('roster.length'),practice?1:10);assert.equal(h.run('bots.length'),practice?0:9);assert.equal(h.run('!!match.soloSwift'),false);h.run("$('match-format').value='solo-swift';match.phase='match';match.winner='blue';finish(true)");assert.equal(h.run('careerCoins.balance'),practice?0:100,format);}
  const h=setup();h.run("$('match-format').value='standard';match.phase='match';match.winner='blue';finish(true)");assert.equal(h.run('careerCoins.balance'),500);h.run("backMenu();$('match-format').value='swift';startGame();match.phase='match';match.winner='blue';finish(true)");assert.equal(h.run('careerCoins.balance'),600);
 });
 test('online host and guest derive ordinary format from room, preserve10 slots and never receive solo bonus',()=>{
  for(const isHost of[true,false]){const h=setup();h.sandbox.testHost=isHost;h.run(`online={host:testHost,session:{memberId:testHost?'host':'friend',hostId:'host'},room:{code:'SOLO2345',hostId:'host',status:'playing',settings:{format:'swift',mapId:'hashimoto'},members:[{id:'host',name:'HOST',team:'blue',connected:true},{id:'friend',name:'FRIEND',team:'red',connected:true}]},send(){},close(){}};onlinePlaying=true;mode='menu';$('match-format').value='solo-swift';startGame()`);
   assert.equal(h.run('roster.length'),10);assert.equal(h.run('match.format'),'swift');assert.equal(h.run('match.soloSwift'),false);assert.equal(h.run('netParticipants.size'),2);h.run("careerCoins.progress({kills:0});match.phase='match';match.winner=player.team;finish(true)");assert.equal(h.run('careerCoins.balance'),100);
  }
 });
 test('menu exposes 1v5, first-to5, swap4 and500 reward, then restores normal format text',()=>{
  const html=read('public/play.html');assert.match(html,/<option value="solo-swift">1v5 SWIFT \/ 自分1人 vs CPU5体<\/option>/);assert.doesNotMatch(html,/<select id="online-format">[^<]*(?:<option[^>]*>[^<]*<\/option>)*<option value="solo-swift">/);
  const h=setup();h.run('updateFormatSummary()');assert.equal(h.elements.get('mission-format-label').textContent,'BOMBER / 1V5');assert.equal(h.elements.get('mission-tag').textContent,'YOU vs 5 CPUs');const nodes=h.elements.get('format-summary').children;assert.equal(nodes[0].textContent,'1v5 / 5先取');assert.match(nodes[1].textContent,/4R.*500.*5倍/);assert.match(h.elements.get('menu-description').textContent,/味方CPUなし/);
  h.run("$('match-format').value='standard';updateFormatSummary()");assert.equal(h.elements.get('mission-format-label').textContent,'BOMBER / 5V5');assert.equal(h.elements.get('format-summary').children[0].textContent,'13先取');assert.doesNotMatch(h.elements.get('menu-description').textContent,/500/);
 });
 console.log(`PASS: ${groups} actual-game solo Swift groups; inert renderer/audio; no browser or device verification`);return groups;
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
