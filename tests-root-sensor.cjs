const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const fault=process.argv.find(a=>a.startsWith('--fault='))?.slice(8),base=path.join(__dirname,'public');
 const faults={slow:['root-sensor.js','speedScale:.6','speedScale:.9'],jump:['root-sensor.js','jumpHeightScale:.5','jumpHeightScale:1'],wall:['root-sensor.js',"return safe(reachable,{...event,y:reference},{...actor,y:floor})===true;",'return true;'],authority:['character-skills.js','rootContacts.update(active,owned,list,now','rootContacts.update(active,new Set(active.keys()),list,now']};
 const url=f=>pathToFileURL(path.join(base,f)).href;
 let sensorURL=url('root-sensor.js');
 function altered(file,pair){let s=fs.readFileSync(path.join(base,file),'utf8');assert.ok(s.includes(pair[1]),'fault anchor');s=s.replace(pair[1],pair[2]).replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,q,p)=>'from '+q+url(p)+q);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64');}
 if(fault&&fault!=='authority')sensorURL=altered('root-sensor.js',faults[fault]);
 let code=fs.readFileSync(path.join(base,'character-skills.js'),'utf8').replace("'./root-sensor.js'",JSON.stringify(sensorURL)).replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,q,p)=>'from '+q+url(p)+q);
 if(fault==='authority'){const p=faults[fault];assert.ok(code.includes(p[1]));code=code.replace(p[1],p[2]);}
 const {createCharacterSkills}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const actor=(id,team='red',x=0,z=0)=>({id,team,x,y:0,z,hp:100,alive:true,grounded:true}),caster=actor('caster','blue'),query={reachable:()=>true,groundHeight:()=>0};
 const make=()=>{const kit=createCharacterSkills(),e=kit.cast('veil-sensor',caster,{x:0,y:.12,z:0,flight:1},10,1);assert.ok(e);return{kit,e};};
 let count=0;function check(name,fn){fn();count++;console.log('PASS: '+name);}
 const cp=v=>JSON.parse(JSON.stringify(v));
 check('landing starts exact5m circle for7seconds; no arm delay, damage, restraint or friendly slow',()=>{
  const{kit:k,e}=make(),a=actor('a','red',5),friend=actor('friend','blue');assert.equal(e.triggerAt,11);assert.equal(e.endsAt,19.5);assert.equal(e.radius,5);
  assert.equal(k.speedScale(a,10.999,query),1);assert.deepEqual(k.update([caster,a,friend],11,1,query),[]);assert.equal(k.speedScale(a,11,query),.6);assert.equal(k.speedScale(friend,11,query),1);
  a.x=5.001;assert.equal(k.speedScale(a,11,query),1);a.x=0;assert.equal(k.speedScale(a,17.999999,query),.6);assert.equal(k.speedScale(a,18,query),1);assert.equal(k.rootJumpScale(a,18,query),1);assert.equal(a.hp,100);
 });
 check('multiple ground contacts, wall/floor fail closed, smoke-independent query; air cannot enter untouched',()=>{
  const{kit:k}=make(),a=actor('a'),b=actor('b','red',4),air={...actor('air'),grounded:false,y:.8},floor={...actor('floor'),y:3};
  k.update([caster,a,b,air,floor],11,1,query);assert.equal(k.rootTracks('blue',11).length,2);assert.equal(k.rootTracks('red',11).length,0);assert.equal(k.markers('blue',11).length,0);
  assert.equal(k.speedScale(a,11,{...query,reachable:()=>false}),1);assert.equal(k.speedScale(a,11,{...query,groundHeight:()=>3}),1);assert.equal(k.speedScale(air,11,query),1);assert.equal(k.speedScale(a,11,{reachable:()=>{throw Error('ray unavailable');},groundHeight:()=>0}),1);
 });
 check('attached normal jump stays slowed and half-height; exit freezes endpoint1.5seconds and reentry has a fresh notice',()=>{
  const{kit:k}=make(),a=actor('a');k.update([caster,a],11,1,query);assert.equal(k.rootJumpScale(a,11,query),.5);const key=k.rootTracks('blue',11)[0].key;
  a.x=2;a.y=.7;a.grounded=false;k.update([caster,a],11.2,1,query);assert.equal(k.speedScale(a,11.2,query),.6);assert.equal(k.rootTracks('blue',11.2)[0].x,2);
  a.x=6;k.update([caster,a],11.3,1,query);assert.equal(k.speedScale(a,11.3,query),1);assert.equal(k.rootTracks('blue',11.3)[0].x,2);assert.equal(k.rootTracks('blue',11.3)[0].active,false);
  a.x=12;k.update([caster,a],12,1,query);assert.equal(k.rootTracks('blue',12)[0].x,2);assert.equal(k.rootTracks('blue',12.7999).length,1);assert.equal(k.rootTracks('blue',12.8).length,0);
  a.x=1;a.y=0;a.grounded=true;k.update([caster,a],12.8,1,query);assert.notEqual(k.rootTracks('blue',12.8)[0].key,key);a.hp=0;a.alive=false;k.update([caster,a],12.9,1,query);assert.equal(k.rootTracks('blue',12.9).length,0);
 });
 check('strict JSON root samples restore atomically without granting contact authority; stale packets cannot resurrect',()=>{
  const{kit:k}=make(),a=actor('a');k.update([caster,a],11.12345,1,query);const state=cp(k.snapshot()),g=createCharacterSkills();assert.ok(g.restore(state,11.12345,1));assert.equal(g.rootTracks('blue',11.12345).length,1);
  a.x=3;g.update([caster,a],11.2,1,query);assert.equal(g.rootTracks('blue',11.2)[0].x,0,'restored event must not sample hidden target positions');
  for(const mutate of[s=>s.roots[0][0]=999,s=>s.roots[0][1]='caster',s=>s.roots.push(s.roots[0]),s=>s.roots[0][2]=99999,s=>s.roots[0][5]=999999,s=>s.events[0].radius=6,s=>s.events[0].extra=1]){const bad=cp(state);mutate(bad);assert.equal(g.restore(bad,11.3,1),false);assert.equal(g.rootTracks('blue',11.3)[0].x,0);}
  g.events(20);assert.equal(g.restore(state,11.12345,1),true);assert.equal(g.rootTracks('blue',20).length,0);assert.equal(g.speedScale(a,20,query),1);assert.equal(g.restore(state,11,1),false);
 });
 check('20field and10target limits, old packets, target/reset/next-round cleanup',()=>{
  const k=createCharacterSkills();for(let i=0;i<20;i++)assert.ok(k.cast('veil-sensor',caster,{x:0,y:.12,z:0,flight:1},10,1));assert.equal(k.cast('veil-sensor',caster,{x:0,y:.12,z:0,flight:1},10,1),null);
  const actors=Array.from({length:10},(_,i)=>actor('enemy'+i,'red',i/10));k.update([caster,...actors],11,1,query);assert.equal(k.snapshot().roots.length,10);assert.equal(k.rootTracks('blue',11).length,10);k.resetActor('enemy0');assert.equal(k.rootTracks('blue',11).length,9);
  const g=createCharacterSkills(),state=cp(k.snapshot());delete state.roots;assert.ok(g.restore(state,11,1));assert.equal(g.rootTracks('blue',11).length,0);g.update([caster,...actors],11.1,2,query);assert.equal(g.events(11.1).length,0);k.reset();assert.equal(k.events(11).length,0);
 });
 check('legacy band packets and multiplier remain accepted for in-flight compatibility',()=>{
  const k=createCharacterSkills(),e=k.cast('veil-root-seed',caster,{x:0,y:.12,z:-10,flight:1},10,1);assert.ok(e);const a=actor('a','red',0,-10);assert.equal(k.speedScale(a,11.25,query),.45);assert.ok(createCharacterSkills().restore(cp(k.snapshot()),11.25,1));
 });
 console.log('PASS: '+count+' root sensor engine groups');
})().catch(e=>{console.error(e);process.exitCode=1;});
