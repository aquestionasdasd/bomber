const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{pathToFileURL}=require('node:url');
async function main({mutate=s=>s,only=()=>true,measure=false}={}){
 const source=mutate(fs.readFileSync(path.join(__dirname,'public/bot-tactics.js'),'utf8')).replace("'./bot-team-planner.js'",JSON.stringify(pathToFileURL(path.join(__dirname,'public/bot-team-planner.js')).href));
 const {createBotTactics}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const sites=[{id:'A',x:-30,z:0},{id:'B',x:30,z:0}],navigation={nearest:(x,z)=>({x,z}),path:(_x,_z,x,z)=>[{x,z}]};
 const actor=(id,team,x=0,z=-25)=>({id,team,x,z,y:0,alive:true,index:Number(id.slice(-1))||0});
 const defenders=Array.from({length:4},(_,i)=>actor('red-'+i,'red',i-2)),attackers=[actor('blue-0','blue'),actor('blue-1','blue')],actors=[...defenders,...attackers];
 const args={actors,attackerTeam:'blue',defenderTeam:'red',spike:{status:'carried',carrier:'blue-0'},remaining:100};
 const fresh=()=>{const p=createBotTactics({sites,navigation,seed:3});p.reset(1);return p;};
 const plan=(p,now=0,extra={})=>p.update({...args,now,...extra});
 const counts=p=>Object.fromEntries(sites.map(s=>[s.id,[...p.roles.values()].filter(r=>r.siteId===s.id&&r.role==='anchor').length]));
 function sample(p,site='A',{ids=['blue-0','blue-1'],time=1,team='red',opponent='blue',repeat=1,spike=args.spike}={}){
  plan(p,0);const at=sites.find(s=>s.id===site);
  for(let i=0;i<repeat;i++){for(const id of ids)p.observe(team,'red-0',actor(id,opponent,at.x,at.z),time+i*.001);plan(p,time+i*.001,{spike});}
 }
 function train(p,sequence=['A','A'],options={}){for(let i=0;i<sequence.length;i++){sample(p,sequence[i],options);p.reset(i+2);}return p;}
 let groups=0,controls=[];const test=(name,fn)=>{if(only(name)){fn();groups++;console.log('PASS: '+name);}};
 test('two independently sighted opening attacks change next defense and retain the quiet anchor',()=>{
  const p=fresh();sample(p);p.reset(2);assert.deepEqual(counts(plan(p)),{A:2,B:2});sample(p);p.reset(3);
  assert.deepEqual(counts(plan(p)),{A:3,B:1});assert.equal(p.contacts('red',0).length,0,'old individual locations never survive reset');
  assert.ok([...plan(p).roles.values()].filter(r=>r.siteId==='A').every(r=>r.watch.x===0),'history must not become an aim target');
  assert.deepEqual(counts(plan(train(fresh()),0,{actors:[...actors,actor('red-4','red')]})),{A:4,B:1},'five CPU defenders retain one quiet anchor');
  assert.deepEqual(counts(plan(train(fresh()),0,{actors:[...defenders.slice(0,2),...attackers]})),{A:1,B:1},'two remaining defenders keep both sites covered');
 });
 test('repeated views of one enemy and split or roaming attackers are insufficient evidence',()=>{
  const one=train(fresh(),['A','A'],{ids:['blue-0'],repeat:100});assert.deepEqual(counts(plan(one)),{A:2,B:2});
  for(const mode of ['split','roam']){const p=fresh();for(let r=1;r<=2;r++){plan(p);for(const s of sites)for(const id of mode==='roam'?['blue-0','blue-1']:['blue-'+(s.id==='A'?0:1)]){p.observe('red','red-0',actor(id,'blue',s.x,0),1);plan(p,1);}p.reset(r+1);}assert.deepEqual(counts(plan(p)),{A:2,B:2},mode);}
 });
 test('late stale future friendly other-team and postplant sightings do not teach an opening',()=>{
  for(const opt of [{time:26},{time:-1},{time:NaN},{team:'blue'},{opponent:'red'},{spike:{status:'planted',x:-30,z:0,timer:30,site:'A'}}]){
   const p=train(fresh(),['A','A'],opt);assert.deepEqual(counts(plan(p)),{A:2,B:2},JSON.stringify(opt));
  }
  const p=fresh();for(let r=1;r<=2;r++){plan(p);for(const id of ['blue-0','blue-1'])p.observe('red','red-0',actor(id,'blue',-30,0),1);plan(p,3);p.reset(r+1);}assert.deepEqual(counts(plan(p)),{A:2,B:2},'expired sample cannot teach');
  const future=fresh();for(let r=1;r<=2;r++){plan(future);for(const id of ['blue-0','blue-1'])future.observe('red','red-0',actor(id,'blue',-30,0),5);plan(future,1);future.reset(r+1);}assert.deepEqual(counts(plan(future)),{A:2,B:2},'future timestamp cannot teach');
 });
 test('current sighting overrides past habits and does not abandon the opposite site',()=>{
  const p=train(fresh());plan(p);for(const id of ['blue-0','blue-1'])p.observe('red','red-0',actor(id,'blue',30,0),1);
  const roles=[...plan(p,1).roles].filter(([id])=>id.startsWith('red')).map(([,role])=>role);assert.equal(roles.filter(r=>r.siteId==='B'&&r.role==='rotate').length,3);assert.equal(roles.filter(r=>r.siteId==='A').length,1);
  const balanced=train(fresh());plan(balanced);for(const [i,site]of sites.entries())balanced.observe('red','red-0',actor('blue-'+i,'blue',site.x,site.z),1);assert.deepEqual(counts(plan(balanced,1)),{A:2,B:2},'balanced current contact suppresses the historical bias');
 });
 test('four-round window forgets an old pattern and new matches or skipped resets clear it',()=>{
  const p=train(fresh());for(let r=4;r<=7;r++)p.reset(r);assert.deepEqual(counts(plan(p)),{A:2,B:2});
  for(const next of [1,3,8]){const q=train(fresh());q.reset(next);assert.deepEqual(counts(plan(q)),{A:2,B:2},'new/repeated/skipped reset '+next);}
 });
 test('only a clear majority adapts and a changed attack pattern can reverse it',()=>{
  const tied=train(fresh(),['A','B']);assert.deepEqual(counts(plan(tied)),{A:2,B:2});
  const reverse=train(fresh(),['A','B','B']);assert.deepEqual(counts(plan(reverse)),{A:1,B:3});
  const equal=train(fresh(),['A','A','B','B']);assert.deepEqual(counts(plan(equal)),{A:2,B:2});
 });
 test('hidden live actor coordinates cannot affect history and active defuse remains authoritative',()=>{
  const p=train(fresh());for(const a of attackers){a.x=30;a.z=0;}assert.deepEqual(counts(plan(p)),{A:3,B:1});
  const planted=plan(p,1,{spike:{status:'planted',x:30,z:0,site:'B',timer:9,checkpoint:0,defuseProgress:0}});
  assert.ok(planted.defuserId);assert.equal(planted.roles.get(planted.defuserId).urgent,true);assert.equal(planted.roles.get(planted.defuserId).goal.x,30);
  for(const a of attackers){a.x=0;a.z=-25;}
 });
 test('radius and opening boundaries use copied sightings and a side switch cannot inherit another team pattern',()=>{
  for(const [offset,time,expected]of [[22,25,3],[22.01,25,2],[22,25.01,2]]){
   const p=fresh();for(let r=1;r<=2;r++){plan(p);for(const id of ['blue-0','blue-1']){const enemy=actor(id,'blue',-30,-offset);p.observe('red','red-0',enemy,time);enemy.x=999;enemy.z=999;}plan(p,time);p.reset(r+1);}assert.equal(counts(plan(p)).A,expected,'boundary '+offset+'/'+time);
  }
  const p=train(fresh()),switched=plan(p,0,{actors:[...actors,actor('blue-2','blue'),actor('blue-3','blue')],attackerTeam:'red',defenderTeam:'blue',spike:{status:'carried',carrier:'red-0'}});
  assert.equal([...switched.roles.values()].filter(r=>r.role==='anchor'&&r.siteId==='A').length,2,'four defenders use normal split after side switch');
 });
 test('a hidden attacker relocation preserves every defensive order and its watch point',()=>{
  const a=train(fresh()),b=train(fresh());const first=plan(a);
  const moved=actors.map(v=>v.team==='blue'?{...v,x:800,z:-900}:v),second=plan(b,0,{actors:moved});
  assert.deepEqual([...first.roles].filter(([id])=>id.startsWith('red')),[...second.roles].filter(([id])=>id.startsWith('red')));
 });
 if(only('actual')){
  const template=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=template.indexOf('  const local = harness();');assert.ok(cut>0);
  const prefix=template.slice(0,cut).replace('async function main() {','async function main(createBotTactics) {').replace("Object.assign(imported, await load('abilities.js'));","Object.assign(imported, await load('abilities.js'));imported.createBotTactics=createBotTactics;");
  const m=new Module(path.join(__dirname,'habits-harness.cjs'),module);m.filename=path.join(__dirname,'habits-harness.cjs');m.paths=module.paths;m._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',m.filename);
  const {harness}=await m.exports(createBotTactics),h=harness();
  for(const hz of [20,60,144])for(const hidden of [false,true]){
   h.run('Math.random=()=>.5');h.reset();h.clearWalls();h.sandbox.hz=hz;
   h.run(`match.side='attack';match.round=1;updateBots.tactics=null;var rows=[];
    function place(){match.phase='live';match.roundTime=90;match.spike.status='carried';match.spike.carrier='player';clearBots();Object.assign(player,{team:'blue',x:-28,z:-20,y:0,alive:true,hp:100,armor:50});
     makeBot({x:-26,z:-20},0,'blue',{id:'blue-1',team:'blue',secondary:'classic'});bots[0].rangeTarget=true;
     for(let i=0;i<4;i++){makeBot({x:-29+i,z:-30},i,'red',{id:'red-'+i,team:'red',secondary:'classic'});const b=bots.at(-1);b.kit=null;b.fire=999;b.group.rotation.y=0;}}
    place();`);
   if(hidden)h.wall({x:-28,z:-25,width:30});
   for(let r=1;r<=2;r++){
    for(let f=0;f<hz*.2;f++)h.run('updatePlay(1/hz)');
    h.run('rows.push({round:match.round,seen:updateBots.tactics.contacts("red",elapsed).map(c=>c.id)});match.round++;spawnRound(false);place();');
   }
   h.clearWalls();h.wall({x:0,z:0,width:200});h.run('Object.assign(player,{x:0,z:60});Object.assign(bots[0],{x:3,z:60});for(const b of bots.filter(b=>b.team==="red")){b.x=(b.index-1.5)*2;b.z=-30;b.group.rotation.y=0;b.think=0;b.target=null;b.lastSeen=null;}var initial=bots.filter(b=>b.team==="red").map(b=>({id:b.id,x:b.x,z:b.z})),maxTurn=0;');
   for(let f=0;f<hz;f++)h.run('var yaws=bots.map(b=>b.group.rotation.y);updatePlay(1/hz);for(let i=0;i<bots.length;i++)maxTurn=Math.max(maxTurn,Math.abs(bots[i].group.rotation.y-yaws[i]));');
   const row=JSON.parse(JSON.stringify(h.run('({rows,round:match.round,maxTurn,known:updateBots.tactics.contacts("red",elapsed),roles:[...updateBots.tactics.update({actors:[player,...bots],attackerTeam:match.attackerTeam,defenderTeam:match.defenderTeam,spike:match.spike,now:elapsed,remaining:match.roundTime}).roles].filter(([id])=>id.startsWith("red")),moves:initial.map(p=>{const b=bots.find(b=>b.id===p.id);return{id:p.id,dx:b.x-p.x,dz:b.z-p.z}})})')));
   assert.equal(row.round,3);assert.equal(row.known.length,0,'no current attackers seen');assert.ok(row.maxTurn<=Math.PI*.8/hz+1e-7,'normal shared turn budget');
   for(const r of row.rows)assert.equal(r.seen.length,hidden?0:2,'training requires real current sightings');
   const count=row.roles.filter(([,r])=>r.siteId==='A').length;if(!measure)assert.equal(count,hidden?2:3,'actual round3 assignment at'+hz+'/'+hidden);
   assert.equal(row.roles.filter(([,r])=>r.siteId==='B').length,4-count);assert.ok(row.moves.every(v=>Math.hypot(v.dx,v.dz)>1),'real defenders follow their assigned movement');
   controls.push({hz,hidden,countA:count,...row});
  }
  groups++;console.log('PASS: actual updatePlay once/frame;two observed or occluded opening rounds then next-round defense at20/60/144Hz');
  if(measure)return{groups,controls,audioOutput:0,fixture:'controlled round transitions and fixed poses;real perception and movement;no firing;not full match outcomes'};
 }
 console.log(`PASS: ${groups} habits groups`);return{groups,controls};
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
