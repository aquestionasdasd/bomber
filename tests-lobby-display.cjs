// Run the saved lobby functions against DOM controls; no renderer or audio.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(`${__dirname}/public/game.js`,'utf8');
const html=fs.readFileSync(`${__dirname}/public/play.html`,'utf8');
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{value:'hashimoto',textContent:'',disabled:false,replaceChildren(){},append(){}});return elements.get(id);};
const room=(mapId='hirakata',format='standard')=>({code:'MAPTEST2',status:'lobby',hostId:'host',members:[{id:'guest',team:'red'}],settings:{mapId,format}});
const context={$,document:{createElement:()=>({})},normalizeMapId:id=>id==='hirakata'?id:'hashimoto',characterPicker:{sync(){}},netParticipants:new Map(),
  online:{host:false,session:{memberId:'guest'}},onlinePlaying:false,netApplied:new Map(),netInputs:new Map(),netCues:[],
  setVisible(){},startGame(){context.started=true;},showMessage(){}};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function updateRoom(room)'),source.indexOf('async function restoreRoomSession()')),context);
context.incoming=room();vm.runInContext('updateRoom(incoming)',context);
assert.equal($('online-map').value,'hirakata');assert.equal($('online-map').disabled,true);assert.equal($('online-format').value,'standard');assert.match($('online-intro').textContent,/枚方市駅.*13ラウンド/);
context.incoming=room('hashimoto','swift');vm.runInContext('updateRoom(incoming)',context);
assert.equal($('online-map').value,'hashimoto');assert.match($('online-intro').textContent,/橋本駅.*5ラウンド/);
context.online.host=true;context.online.settingsPending=true;$('online-map').value='hirakata';
vm.runInContext('updateRoom(incoming)',context);assert.equal($('online-map').value,'hirakata');assert.equal($('online-start').disabled,true);assert.equal($('online-format').disabled,true);
context.online.settingsPending=false;vm.runInContext('updateRoom(incoming)',context);assert.equal($('online-map').value,'hashimoto');assert.equal($('online-start').disabled,false);assert.equal($('online-format').disabled,false);
context.online.host=false;context.incoming={...room(),status:'playing'};vm.runInContext('updateRoom(incoming)',context);
assert.equal(context.started,true);assert.equal($('online-map').value,'hirakata');assert.equal($('match-format').value,'standard');
assert.match(html,/FRIENDS \/ ONLINE/);assert.doesNotMatch(html,/同じ橋本駅前へ|FRIENDS \/ HASHIMOTO/);
console.log('PASS: saved lobby UI: guest joins, host map/format changes, pending/failure rollback, start selection, neutral invitation (6 groups)');
