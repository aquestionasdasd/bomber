const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
async function main(){
  const load=name=>import(pathToFileURL(path.join(__dirname,'public',name)).href);
  const [THREE,{roundDanceState,createVictoryDance},{createAgentModel},{CHARACTER_DEFS},{MatchRules},{createCharacterPreview}]=await Promise.all([
    load('vendor/three.module.js'),load('victory-dance.js'),load('agent-model.js'),load('abilities.js'),load('rules.js'),load('character-preview.js')]);
  const match=new MatchRules();match.startLive();const actor={alive:true,team:'blue'};
  assert.equal(roundDanceState(match,actor).dancing,false);match.endRound('blue','elimination');
  assert.deepEqual(roundDanceState(match,actor),{dancing:true,danceTime:0});
  match.tick(1);assert.equal(roundDanceState(match,actor).danceTime,1);
  assert.equal(roundDanceState(match,{...actor,team:'red'}).dancing,false);
  assert.equal(roundDanceState(match,{...actor,alive:false}).dancing,false);
  const guest=JSON.parse(JSON.stringify(match));assert.deepEqual(roundDanceState(guest,actor),roundDanceState(match,actor));
  match.tick(4);assert.equal(roundDanceState(match,actor).dancing,false);
  console.log('PASS: authoritative win, living allies only, JSON guest progress, next round stop');

  function pose(m){const p=[];m.group.traverse(o=>p.push([o.name,o.visible,...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]));return p;}
  for(const character of Object.keys(CHARACTER_DEFS)){
    const m=createAgentModel(THREE,{character,team:'blue',bot:{id:'test',team:'blue'}});m.group.position.set(12,3,-14);m.group.rotation.y=1.2;
    const normal={alive:true,time:1,character,weapon:'vandal'};m.update(0,normal);const before=pose(m),count=m.meshes.length;
    const root=[...m.group.position.toArray(),...m.group.quaternion.toArray()];
    m.update(0,{...normal,dancing:true,danceTime:.25});const first=pose(m);
    m.update(0,{...normal,dancing:true,danceTime:.8});assert.notDeepEqual(pose(m),first,character+' animates');
    assert.deepEqual([...m.group.position.toArray(),...m.group.quaternion.toArray()],root,'World transform stays fixed');
    assert.equal(m.meshes.length,count);assert.equal(count,52,'Hit surface count remains unchanged');
    m.update(0,normal);assert.deepEqual(pose(m),before,character+' restores exact ordinary pose/equipment');
    m.update(0,{...normal,dancing:true,danceTime:.8});m.update(0,{...normal,alive:false,dancing:true});
    const rig=m.group.children[0];assert.equal(rig.rotation.y,0,'Death overrides dance yaw');
    m.update(0,{...normal,planting:true,dancing:true});assert.equal(rig.position.y,0,'Interaction overrides emote');
    m.dispose();m.dispose();
  }
  console.log('PASS: all 15 actual models move, 52 surfaces/root preserved, exact reset, death and interaction override');

  // Execute the actual shared equipment adapter used by host AI, remote humans,
  // and guest replicas; no new field is added to network serialization.
  const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
  const equipment=source.match(/function agentEquipment\(bot\)\{[^\n]+/)[0];
  const ctx={match:{phase:'post',phaseTime:3,lastRound:{team:'red'}},roundDanceState,reducedMotion:{matches:false},enemyRimFor:()=>true};vm.createContext(ctx);vm.runInContext(equipment,ctx);
  for(const bot of [{alive:true,team:'red',kit:{character:'nope'}},{alive:true,team:'red',remoteId:'guest',netWeapon:'classic'},{alive:true,team:'red',netTarget:{weapon:'vandal'}}])assert.equal(ctx.agentEquipment(bot).dancing,true);
  ctx.reducedMotion.matches=true;assert.equal(ctx.agentEquipment({alive:true,team:'red'}).danceTime,0);
  ctx.match.phase='live';assert.equal(ctx.agentEquipment({alive:true,team:'red'}).dancing,false);
  console.log('PASS: actual host/BOT/guest equipment integration and reduced motion');

  const nodes={'victory-dance':{hidden:true},'victory-dance-canvas':{tagName:'CANVAS'},'victory-dance-label':{textContent:''}};
  const doc={hidden:false,getElementById:id=>nodes[id]};let active=false,appearance,disposed=0,options;
  const ui=createVictoryDance(THREE,{document:doc,previewFactory(t,o){options=o;return{setActive:v=>active=v,setAppearance:(...a)=>appearance=a,dispose:()=>disposed++};}});
  const state={match:{phase:'post',phaseTime:4,lastRound:{team:'blue'}},player:{team:'blue',alive:false},character:'nope',mode:'play',now:10};
  ui.sync(state);assert.equal(active,true);assert.equal(options.dancing,true);assert.deepEqual(appearance,['nope','blue']);
  ui.sync({...state,paused:true});assert.equal(active,false);
  ui.sync({...state,player:{team:'red'}});assert.equal(active,false);
  ui.sync({...state,mode:'pause'});assert.equal(active,false);
  ui.preview('duck',100);ui.sync({...state,mode:'menu',now:110});assert.equal(active,true);assert.equal(appearance[0],'duck');
  ui.sync({...state,mode:'menu',now:5100});assert.equal(active,false);assert.equal(nodes['victory-dance'].hidden,true);
  doc.hidden=true;ui.sync(state);assert.equal(active,false);doc.hidden=false;
  ui.dispose();ui.dispose();assert.equal(disposed,1);ui.sync(state);assert.equal(active,false);
  console.log('PASS: local fullbody celebration, loser/pause/hidden/menu cleanup, bounded preview, disposal');

  let frame,lowMotion=true,lastState;const canvas={getBoundingClientRect:()=>({width:190,height:245}),addEventListener(){},removeEventListener(){}};
  const preview=createCharacterPreview(THREE,{canvas,document:{hidden:false},dancing:true,reducedMotion:()=>lowMotion,
    modelFactory(){const group=new THREE.Group();group.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1)));return{group,update(dt,s){lastState=s;},dispose(){}};},
    rendererFactory:()=>({setClearColor(){},setPixelRatio(){},setSize(){},render(){},dispose(){}}),requestFrame:f=>(frame=f,1),cancelFrame(){frame=null;}});
  preview.setActive(true);frame(0);frame(100);assert.equal(lastState.dancing,true);assert.equal(lastState.danceTime,0);
  lowMotion=false;frame(200);assert.ok(lastState.danceTime>0);preview.setActive(false);assert.equal(frame,null);preview.dispose();
  console.log('PASS: real preview forwards dance, static reduced-motion pose, stops RAF');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
