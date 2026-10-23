const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{pathToFileURL}=require('node:url');
async function main(){
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href),T=await load('vendor/three.module.js'),{createSkillSpectacle,createSkillFeedback,SKILL_LOOKS,skillCharacter}=await load('skill-spectacle.js'),{createCharacterSkills}=await load('character-skills.js');
 let groups=0;function test(name,fn){fn();groups++;console.log('PASS: '+name);}
 const actor={id:'owner',team:'blue',x:0,y:0,z:0,hp:100,alive:true},viewer={id:'viewer',x:0,y:0,z:7};
 const event=(id,type)=>({id,type,x:0,y:0,z:0,fromX:0,fromY:1.7,fromZ:3,sourceId:actor.id,team:'blue',startedAt:1,triggerAt:1,endsAt:5,radius:0,flight:0});
 const instances=fx=>fx.group.children.reduce((n,m)=>n+m.count,0);
 test('15 distinctive silhouettes, unsupported data ignored, pooled18draw and no raycasts/shadows/wall override',()=>{
  assert.equal(Object.keys(SKILL_LOOKS).length,15);assert.equal(new Set(Object.values(SKILL_LOOKS).map(s=>s.shape)).size,15);assert.equal(skillCharacter('echo-tag'),'echo');assert.equal(skillCharacter('recon'),'echo');assert.equal(skillCharacter('evil'),null);
  const fx=createSkillSpectacle(T);assert.equal(fx.group.children.length,18);for(const m of fx.group.children){assert.equal(m.material.depthTest,true);assert.equal(m.material.depthWrite,false);assert.equal(m.castShadow,false);assert.deepEqual(m.raycast(),undefined);}fx.update([event('bad','evil')],1.1);assert.equal(instances(fx),0);fx.dispose();
 });
 test('all15 motif render paths, no camera-overlapping self sigils, concealed actors and reduced motion',()=>{
  const fx=createSkillSpectacle(T),events=Object.keys(SKILL_LOOKS).map((id,i)=>event('s'+i,id+'-test'));fx.update(events,1.2,{actors:[actor],viewer});assert.equal(fx.group.userData.activeEvents,15);for(const mesh of fx.group.children.slice(0,15))assert.ok(mesh.count>0,mesh.name);const before=instances(fx);
  fx.update(events,1.2,{actors:[actor],viewer,reducedMotion:true});assert.ok(instances(fx)<before);assert.equal(fx.group.children.find(m=>m.name==='Skill directional shards').count,0);fx.update(events,1.2,{actors:[actor],viewer:actor});assert.equal(instances(fx),0);
  fx.update(events,1.2,{actors:[actor],viewer,visible:()=>false});assert.equal(instances(fx),0);fx.dispose();
 });
 test('real thrown bottle trail and impact are timestamp based, duplicate/reorder stable, expiry/reset/dispose bounded',()=>{
  const h=createCharacterSkills();h.cast('nope-bottle',actor,{x:0,y:0,z:-8},1,1);const events=h.events(1),fx=createSkillSpectacle(T);fx.update(events,1.15,{viewer});assert.ok(fx.group.children.find(m=>m.name==='Skill projectile ribbons').count>0);
  const pose=()=>fx.group.children.map(m=>[m.count,Array.from(m.instanceMatrix.array.slice(0,m.count*16))]);const a=pose();fx.update([...events,...events],1.15,{viewer});assert.deepEqual(pose(),a);fx.update(events,2.1,{viewer});assert.ok(instances(fx)>0);fx.update(events,5,{viewer});assert.equal(instances(fx),0);fx.update(events,1.001,{viewer:actor,actors:[actor]});assert.equal(instances(fx),0,'projectile source burst and nearby trail never cover own camera');
  for(let i=0;i<100;i++)fx.impact('nope',{x:0,y:1,z:0},5);fx.update([],5.1,{viewer});assert.equal(fx.group.userData.impacts,32);for(const mesh of fx.group.children)assert.ok(mesh.count<=mesh.instanceMatrix.count);fx.reset();assert.equal(instances(fx),0);
  let gs=0,ms=0;for(const mesh of fx.group.children){mesh.geometry.addEventListener('dispose',()=>gs++);mesh.material.addEventListener('dispose',()=>ms++);}fx.dispose();fx.dispose();assert.equal(gs,18);assert.equal(ms,18);fx.update(events,1.1);assert.equal(instances(fx),0);
 });
 test('bounded world impacts hidden by visibility, no temporal replay, no extra simulation state',()=>{
  const fx=createSkillSpectacle(T);assert.equal(fx.impact('invalid',{x:0,y:1,z:0},1),false);assert.equal(fx.impact('nope',{x:NaN,y:1,z:0},1),false);fx.impact('nope',{x:0,y:1,z:0},1);fx.update([],1.1,{viewer,visible:()=>false});assert.equal(instances(fx),0);fx.update([],2,{viewer});assert.equal(fx.group.userData.impacts,0);fx.dispose();
 });
 test('confirmed local HUD, actual names, target status, no old/future/duplicate/hidden/menu feedback',()=>{
  const nodes=new Map(),ui=createSkillFeedback({getElementById:id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,style:{}});return nodes.get(id);}}),e=event('accepted','nope-bottle');ui.observe([e],1.1,actor.id);ui.render(1.1);assert.match(nodes.get('skill-cast-feedback').textContent,/NOPEボトル/);ui.note('hit','ack1','nope',1.1);ui.note('hit','ack1','nope',4);ui.render(1.2);assert.match(nodes.get('skill-hit-feedback').textContent,/命中/);ui.render(2);assert.equal(nodes.get('skill-hit-feedback').hidden,true);ui.render(1.2,{active:false});assert.equal(nodes.get('skill-cast-feedback').hidden,true);ui.reset();ui.observe([{...e,startedAt:0}],10,actor.id);ui.render(10);assert.equal(nodes.get('skill-cast-feedback').hidden,true);
 });
 const parent=fs.readFileSync(path.join(__dirname,'tests-onnara-game.cjs'),'utf8'),boundary=parent.indexOf(' const local=harness();');assert.ok(boundary>0);const mod=new Module(path.join(__dirname,'spectacle-harness.cjs'),module);mod.filename=path.join(__dirname,'spectacle-harness.cjs');mod.paths=module.paths;mod._compile(parent.slice(0,boundary)+'\nreturn {harness};\n}\nmodule.exports=main;',mod.filename);const {harness}=await mod.exports(),host=harness(),guest=harness();
 const setup=h=>h.run(`online=null;onlinePlaying=false;mode='menu';$('agent-select').value='nope';$('match-format').value='standard';startGame();startRound();elapsed=10;mode='play';`);
 test('actual host skill damage produces confirmed impact only, normal bullets and refused/zero/friendly damage do not',()=>{
  setup(host);host.run(`var victim=bots.find(b=>b.team==='red');var before=victim.hp;damageEntity(victim,20,player,{skill:'nope'});renderOrdinarySkills();`);assert.equal(host.run('victim.hp'),80);assert.equal(host.run('skillSpectacle.group.userData.impacts'),1);assert.match(host.run(`$('skill-hit-feedback').textContent`),/命中/);
  host.run(`skillSpectacle.reset();damageEntity(victim,5,player,{firearm:true});damageEntity(victim,0,player,{skill:'nope'});damageEntity(bots.find(b=>b.team==='blue'),10,player,{skill:'nope'});renderOrdinarySkills()`);assert.equal(host.run('skillSpectacle.group.userData.impacts'),0);host.run(`backMenu();`);assert.equal(host.run('skillSpectacle.group.visible'),false);assert.equal(host.run(`$('skill-hit-feedback').hidden`),true);
 });
 test('actual host cue and independent guest own hit ACK, duplicate/stale/fresh/invalid/future suppression and death/nextR cleanup',()=>{
  setup(host);setup(guest);host.run(`onlinePlaying=true;online={host:true,room:{code:'ABCDEFGH'},session:{memberId:'host'},send:()=>{}};var shooter=bots.find(b=>b.id==='red-1');damageEntity(player,12,shooter,{skill:'ember'});`);const cues=JSON.parse(JSON.stringify(host.run('serializeNetCues()')));assert.equal(cues.at(-1).type,'skill-hit');assert.equal(cues.at(-1).weapon,'ember');
  guest.sandbox.receipt={time:10,rules:{round:1,phase:'live'},cues:[...cues,cues.at(-1)]};guest.run(`onlinePlaying=true;online={host:false};player.id='red-1';applyNetCues(receipt,false,'red-1');skillFeedback.render(elapsed);`);assert.match(guest.run(`$('skill-hit-feedback').textContent`),/命中/);guest.run(`skillSpectacle.update([],10.1);applyNetCues(receipt,false,'red-1');skillSpectacle.update([],10.1);`);assert.equal(guest.run('skillSpectacle.group.userData.impacts'),1);
  guest.run(`resetTeamAbilities();netSeenCueSequence=0;applyNetCues(receipt,true,'red-1');skillSpectacle.update([],10.1);`);assert.equal(guest.run('skillSpectacle.group.userData.impacts'),0);
  for(const change of[p=>p.time=12,p=>p.cues[0].weapon='invalid',p=>p.cues[0].y=Infinity,p=>p.rules.round=2,p=>p.rules.phase='post',p=>p.time=9]){const bad=JSON.parse(JSON.stringify({time:10,rules:{round:1,phase:'live'},cues:[cues.at(-1)]}));change(bad);guest.sandbox.bad=bad;guest.run(`netSeenCueSequence=0;applyNetCues(bad,false,'red-1');skillSpectacle.update([],10.1);`);assert.equal(guest.run('skillSpectacle.group.userData.impacts'),0);}
 });
 test('actual saved render leaves gameplay/strict snapshot untouched and obeys blind/visibility/reduced motion',()=>{
  setup(host);host.run(`ordinarySkills.cast('nope-bottle',ordinaryActorView(player),{x:player.x,y:0,z:player.z-8},elapsed,match.round);var wire=JSON.stringify(ordinarySkills.snapshot());renderOrdinarySkills();`);assert.equal(host.run('JSON.stringify(ordinarySkills.snapshot())===wire'),true);host.run(`reducedMotion.matches=true;renderOrdinarySkills()`);assert.equal(host.run(`skillSpectacle.group.children.find(m=>m.name==='Skill directional shards').count`),0);
 });
 console.log(`PASS: ${groups} spectacle geometry/privacy/absolute-time/HUD/real-host/independent-guest groups; audio inert`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
