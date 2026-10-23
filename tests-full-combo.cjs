const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const {pathToFileURL}=require('node:url');
async function main(){
 const {createFullComboTracker,fullComboRecord,renderRoundBanner}=await import(pathToFileURL(path.join(__dirname,'public/full-combo.js')).href);
 const actors=Array.from({length:10},(_,i)=>({id:i===0?'player':i<5?`blue-${i}`:`red-${i-5}`,team:i<5?'blue':'red',name:`P${i}`}));let count=0;
 const test=(name,fn)=>{fn();count++;console.log('PASS: '+name)};
 test('five distinct enemy seats, not four, team kills, unknown IDs, repeated revived victim or another round',()=>{
  const t=createFullComboTracker();t.begin(1,actors);for(let i=5;i<9;i++)t.record(1,actors[i],actors[0]);assert.equal(t.winner(1,'blue'),null);
  for(let i=0;i<5;i++)t.record(1,actors[5],actors[0]);t.record(1,actors[1],actors[0]);t.record(1,{id:'unknown',team:'red'},actors[0]);t.record(1,null,actors[0]);t.record(2,actors[9],actors[0]);assert.equal(t.winner(1,'blue'),null);
  t.record(1,actors[9],actors[0]);assert.equal(t.winner(1,'blue'),'player');assert.equal(t.winner(1,'red'),null);t.begin(2,actors);assert.equal(t.winner(2,'blue'),null);
 });
 test('split credit/environment death cannot award; BOT/remote/red winners and reset work',()=>{
  const t=createFullComboTracker();t.begin(1,actors);actors.slice(5).forEach((v,i)=>t.record(1,v,i===4?actors[1]:actors[0]));assert.equal(t.winner(1,'blue'),null);
  t.record(1,actors[9],null);assert.equal(t.winner(1,'blue'),null);t.reset();t.begin(1,actors);actors.slice(0,5).forEach(v=>t.record(1,v,actors[7]));assert.equal(t.winner(1,'red'),'red-2');t.reset();assert.equal(t.winner(1,'red'),null);t.begin(2,actors.slice(0,9));actors.slice(5).forEach(v=>t.record(2,v,actors[0]));assert.equal(t.winner(2,'blue'),null);
 });
 test('only authoritative current post result and valid winning seat qualify, including seat zero and legacy snapshots',()=>{
  const m={round:1,phase:'post',phaseTime:5,lastRound:{round:1,team:'blue',fullCombo:0}};assert.equal(fullComboRecord(JSON.parse(JSON.stringify(m)),actors),actors[0]);for(const key of[-1,10,1.5,'0',null])assert.equal(fullComboRecord({...m,lastRound:{...m.lastRound,fullCombo:key}},actors),null);
  assert.equal(fullComboRecord({...m,phase:'live'},actors),null);assert.equal(fullComboRecord({...m,round:2},actors),null);assert.equal(fullComboRecord({...m,lastRound:{round:1,team:'blue'}},actors),null);assert.equal(fullComboRecord({...m,lastRound:{...m.lastRound,fullCombo:5}},actors),null);
 });
 test('large winning banner, safe name text, normal loss and no repeated-snapshot animation restart',()=>{
  let renders=0;const make=()=>({textContent:'',dataset:{},classList:{toggle(){}},replaceChildren(...nodes){this.children=nodes;renders++}}),banner=make(),doc={createElement:make},match={round:1,phase:'post',phaseTime:5,lastRound:{round:1,team:'blue',fullCombo:0}};
  const r=actors.map(a=>({...a}));r[0].name='<img onerror=bad>';const opts={document:doc,match,roster:r,viewerTeam:'blue',team:'blue',reason:'elimination'};renderRoundBanner(banner,opts);assert.equal(banner.children[0].textContent,'フルコンボ');assert.equal(banner.children[1].textContent,'開米');assert.match(banner.children[2].textContent,/<img onerror=bad>/);renderRoundBanner(banner,opts);assert.equal(renders,1);renderRoundBanner(banner,{...opts,viewerTeam:'red'});assert.equal(banner.children[0].textContent,'閉米');assert.equal(banner.children.length,2);
 });
 // Reuse the real saved-game harness rather than copying its combat logic.
 const parent=fs.readFileSync(path.join(__dirname,'tests-onnara-game.cjs'),'utf8'),boundary=parent.indexOf(' const local=harness();');assert.ok(boundary>0);
 const exported=parent.slice(0,boundary)+'\n return {harness};\n}\nmodule.exports=main;';const mod=new Module(path.join(__dirname,'full-combo-harness.cjs'),module);mod.filename=path.join(__dirname,'full-combo-harness.cjs');mod.paths=module.paths;mod._compile(exported,mod.filename);const {harness}=await mod.exports();const host=harness(),guest=harness();
 const setup=h=>h.run(`online=null;onlinePlaying=false;mode='menu';$('agent-select').value='nope';$('match-format').value='standard';startGame();startRound();elapsed=10;mode='play';`);
 test('actual host damage and round events credit a one-person sweep; next buy packet omits result marker',()=>{
  setup(host);host.run(`for(const e of bots.filter(b=>b.team==='red'))damageEntity(e,1000,player);match.tick(.01,{blueAlive:5,redAlive:0});handleMatchEvents();`);assert.equal(host.run('match.lastRound.fullCombo'),0);assert.equal(host.run(`$('round-banner').children[0].textContent`),'フルコンボ');
  host.run(`var captured;onlinePlaying=true;online={host:true,room:{code:'ABCDEFGH'},session:{memberId:'host'},send:p=>{captured=p}};tickOnline(.1);`);const packet=JSON.parse(JSON.stringify(host.run('captured')));assert.equal(packet.rules.lastRound.fullCombo,0);
  host.run(`match.nextRound();handleMatchEvents();tickOnline(.1)`);assert.equal(host.run(`Object.hasOwn(captured.rules.lastRound,'fullCombo')`),false);assert.equal(host.run('fullComboTracker.winner(match.round,"blue")'),null);
 });
 test('actual split kills and duplicate damage do not invent a sweep; practice is excluded',()=>{
  setup(host);host.run(`const reds=bots.filter(b=>b.team==='red');for(const e of reds.slice(0,4))damageEntity(e,1000,player);damageEntity(reds[4],1000,bots.find(b=>b.team==='blue'));damageEntity(reds[4],1000,player);match.tick(.01,{blueAlive:5,redAlive:0});handleMatchEvents()`);assert.equal(host.run(`Object.hasOwn(match.lastRound,'fullCombo')`),false);
  setup(host);host.run(`fullComboTracker.reset();exploring=true;match.events=[{type:'live'}];handleMatchEvents();for(const e of bots.filter(b=>b.team==='red'))damageEntity(e,1000,player);match.tick(.01,{blueAlive:5,redAlive:0});handleMatchEvents()`);assert.equal(host.run(`Object.hasOwn(match.lastRound,'fullCombo')`),false);
 });
 test('independent JSON guest sees remote red sweep, repeated packets and fresh reconnect; no own prediction',()=>{
  setup(host);setup(guest);host.run(`var finisher=bots.find(b=>b.id==='red-1');for(const e of [player,...bots].filter(b=>b.team==='blue'))damageEntity(e,1000,finisher);match.tick(.01,{blueAlive:0,redAlive:5});handleMatchEvents();netParticipants.set('guest','red-1');var captured;onlinePlaying=true;online={host:true,room:{code:'ABCDEFGH'},session:{memberId:'host'},send:p=>{captured=p}};tickOnline(.1)`);
  guest.run(`onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send:()=>{}};netParticipants.set('guest','red-1')`);guest.sandbox.transfer=JSON.parse(JSON.stringify(host.run('captured')));guest.run(`receiveNetPacket('host',transfer)`);assert.equal(guest.run(`$('round-banner').children[0].textContent`),'フルコンボ');assert.equal(guest.run('player.team'),'red');const signature=guest.run(`$('round-banner').dataset.roundResult`);guest.run(`receiveNetPacket('host',transfer)`);assert.equal(guest.run(`$('round-banner').dataset.roundResult`),signature);guest.run(`netHasSnapshot=false;transfer.seq++;receiveNetPacket('host',transfer)`);assert.equal(guest.run(`$('round-banner').children[0].textContent`),'フルコンボ');assert.equal(guest.run('fullComboTracker.winner(match.round,"red")'),null);
 });
 console.log(`PASS: ${count} full-combo distinct-seat/host/guest/render/cleanup groups; audio inert`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
