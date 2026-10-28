const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),boundary=fixture.indexOf(' const h=harness();');
if(boundary<0)throw Error('Saved-game harness missing');
const suite=String.raw`
 const h=harness();
 function setup(character){h.reset();h.clearWalls();h.sandbox.character=character;h.run("player.kit=new DuelistKit({character});player.kit.smoke=2;player.kit.updraft=2;player.kit.dash=1;player.kit.ultPoints=7;match.phase='live';player.pitch=-.3;player.hp=40;player.ammo=1;player.reserve=24;");h.sandbox.timers=[];h.sandbox.setTimeout=(fn,ms)=>{h.sandbox.timers.push({fn,ms});return h.sandbox.timers.length;};}
 function displayed(){return h.elements.get('message').children.map(n=>n.textContent);}
 check('all16 characters /64 skills display a complete short cue for2seconds without changing the kit',()=>{
  const ids=h.run('Object.keys(CHARACTER_DEFS)');assert.equal(ids.length,16);let count=0,max=0;
  for(const character of ids){setup(character);const before=copy(h.run('player.kit.snapshot()'));
   for(const key of['c','q','e','x']){h.sandbox.key=key;h.run('showSkillMessage(character,key)');const text=displayed();assert.equal(text.length,2);assert.ok(text[0].startsWith(key.toUpperCase()+' '));assert.ok(text[1].length>3&&text[1].length<=24);assert.ok(text.join('').length<=30);assert.ok(!text.join('').includes('undefined'));assert.equal(h.sandbox.timers.at(-1).ms,2000);max=Math.max(max,text.join('').length);count++;}
   assert.deepEqual(copy(h.run('player.kit.snapshot()')),before);
  }assert.equal(count,64);console.log('64 cues: maximum '+max+' characters including title');
 });
 check('actual accepted ability branches for every character use the short cue',()=>{
  for(const character of h.run('Object.keys(CHARACTER_DEFS)')){setup(character);const key=['onnara','cat'].includes(character)?'c':character==='urchin'?'x':'e';h.sandbox.key=key;const effect=h.run('activateAbility(player,key)');assert.ok(effect,character+' accepted cast');const expected=copy(h.run('getSkillUseMessage(character,key)'));assert.deepEqual(displayed(),[expected.title,character==='duelist'?'0.25秒後、再Eでダッシュ':expected.description],character);assert.equal(h.sandbox.timers.at(-1).ms,2000,character);}
 });
 check('aimed skills keep concise confirm/cancel controls and do not spend until confirmed',()=>{
  for(const [character,key]of[['nobi','x'],['onnara','q'],['urchin','e'],['cap','c'],['japan','c'],['car','c'],['cat','q'],['duck','c']]){setup(character);h.sandbox.key=key;const before=copy(h.run('player.kit.snapshot()'));h.run('useAbility(key)');assert.equal(h.run('duckAim'),key);assert.equal(displayed()[1],'左クリックで確定／右で取消');assert.ok(displayed().join('').length<=30);assert.deepEqual(copy(h.run('player.kit.snapshot()')),before);h.run('useAbility(key)');assert.equal(h.run('duckAim'),null);}
 });
 check('cat return and duelist ready/dash messages match the actual activation stage',()=>{
  setup('cat');h.run("activateAbility(player,'c');player.x=2;activateAbility(player,'c')");assert.equal(displayed()[1],'保存した場所へ帰還');assert.equal(h.run('player.x'),0);
  setup('duelist');h.run("activateAbility(player,'e')");assert.match(displayed()[1],/再E/);h.run("elapsed+=1.1;activateAbility(player,'e')");assert.equal(displayed()[1],'進行方向へダッシュ');
 });
 check('guest prediction uses the same short cue and remote actors cannot overwrite the local message',()=>{
  setup('renko');h.run("onlinePlaying=true;online={host:false,room:{code:'ABCDEFGH'},session:{memberId:'guest',hostId:'host'},send(){}};activateAbility(player,'e',{predict:true})");assert.equal(displayed()[1],'E長押しで最大1秒飛行');assert.equal(h.run('ordinarySkills.events(elapsed).length'),0);
  setup('cap');h.run("showMessage('LOCAL','keep',4);makeBot({x:0,z:-10},0,'red',{id:'remote',team:'red',kit:new DuelistKit({character:'cap'})});bots[0].kit.dash=1;activateAbility(bots[0],'e')");assert.deepEqual(displayed(),['LOCAL','keep']);
 });
 check('failed casts stay brief, preserve resources, and unrelated messages retain their full text',()=>{
  setup('renko');h.run("player.kit.smoke=0;confirmRenkoSkill('c')");assert.ok(displayed().join('').length<=30);assert.equal(h.run('player.kit.smoke'),0);
  const long='試合終了の説明を勝手に切り詰めないための長い文章です。'.repeat(4);h.sandbox.long=long;h.run("showMessage('RESULT',long,6)");assert.equal(displayed()[1],long);assert.equal(h.sandbox.timers.at(-1).ms,6000);
 });
 console.log('PASS: '+groups+' skill message saved-game groups; no audio output');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const compiled=new Module(path.join(__dirname,'skill-message-harness.cjs'),module);compiled.filename=path.join(__dirname,'skill-message-harness.cjs');compiled.paths=module.paths;compiled._compile(fixture.slice(0,boundary)+suite,compiled.filename);
