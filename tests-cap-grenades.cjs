const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const fault=process.argv.find(x=>x.startsWith('--fault='))?.slice(8);
 const load=f=>{let source=require('node:fs').readFileSync(path.join(__dirname,'public',f),'utf8');const pairs={count:['children:7','children:6'],cap:['damageCap:60','damageCap:600'],team:["if((heal||['cap-bank-grenade','cap-magazine-grenade'].includes(event.type))?hostile:!hostile)continue;",'if(false)continue;'],authority:['if(!owned.has(e.id)||now<e.triggerAt)continue;','if(now<e.triggerAt)continue;']};
  if(fault&&((f==='cap-grenades.js'&&fault!=='authority')||(f==='character-skills.js'&&fault==='authority'))){const pair=pairs[fault];assert.ok(pair&&source.includes(pair[0]),'Missing fault anchor');source=source.replace(pair[0],pair[1]).replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,q,p)=>'from '+q+pathToFileURL(path.join(__dirname,'public',p)).href+q);return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}
  return import(pathToFileURL(path.join(__dirname,'public',f)).href);
 },{createCharacterSkills}=await load('character-skills.js'),{CAP_GRENADE:c,createCapFlight,capBlastEffects}=await load('cap-grenades.js');
 const actor=(id,team='red',x=0,z=0)=>({id,team,x,y:0,z,hp:40,alive:true,grounded:true});
 const caster=actor('caster','blue'),enemy=actor('enemy'),friend=actor('friend','blue',.2),e=(type='cap-cluster-damage')=>({id:'skill-'+type+'-1',type,team:'blue',sourceId:'caster',round:1,x:0,y:.12,z:0,fromX:0,fromY:1.7,fromZ:0,flight:1,startedAt:0,triggerAt:1.22,endsAt:8,radius:6});
 const floor=(a,b,r)=>b.y<r?{fraction:Math.max(0,(a.y-r)/(a.y-b.y)),normal:{x:0,y:1,z:0}}:null;
 let groups=0;const check=(s,fn)=>{fn();groups++;console.log('PASS: '+s);};
 check('fixed120Hz children remain deterministic across20/60/144Hz, bounce then individually explode',()=>{
  let baseline;
  for(const hz of[20,60,144]){const f=createCapFlight(e(),floor);let r;for(let t=1.22;t<3;t+=1/hz)r=f.advance(t);r=f.advance(3);assert.equal(r.children.length,7);assert.equal(r.blasts.length,8);assert.ok(r.children.every(p=>!p.alive&&p.y>=.099));const output=JSON.stringify(r);if(baseline)assert.equal(output,baseline);else baseline=output;}
 });
 check('swept wall/ceiling reflection cannot tunnel through thin solid planes',()=>{
  const box=(a,b,r)=>{let hit=null;for(const [axis,sign]of[['x',1],['x',-1],['y',1],['z',1],['z',-1]]){const limit=axis==='y'?1-r:sign*(1-r);if(sign*(b[axis]-limit)<=0)continue;const fraction=(limit-a[axis])/(b[axis]-a[axis]);if(fraction>=0&&fraction<=1&&(!hit||fraction<hit.fraction))hit={fraction,normal:{x:0,y:0,z:0,[axis]:-sign}};}return hit||floor(a,b,r);};
  const f=createCapFlight(e(),box);for(let t=1.22;t<2.8;t+=.01){const r=f.advance(t);assert.ok(r.children.every(p=>Math.abs(p.x)<1.001&&Math.abs(p.z)<1.001&&p.y<=1.001));}
 });
 check('falloff, ally/self policy and per-source cap apply across all8 explosions',()=>{
  for(const type of['cap-cluster-damage','cap-cluster-heal']){const ev=e(type),totals=new Map(),list=[caster,friend,enemy,actor('far','red',5.7)],all=[];
   for(let i=-1;i<7;i++)all.push(...capBlastEffects(ev,{index:i,x:0,y:.8,z:0,at:1.22+i*.01},list,totals,()=>true));
   for(const amount of totals.values())assert.ok(amount<=60+1e-8);
   assert.equal(totals.has('caster'),type.endsWith('heal'));assert.equal(totals.has('friend'),type.endsWith('heal'));assert.equal(totals.has('enemy'),type.endsWith('damage'));if(type.endsWith('damage'))assert.ok(totals.get('enemy')>totals.get('far'));
   assert.equal(capBlastEffects(e(type),{index:-1,x:0,y:0,z:0,at:2},list,new Map(),()=>false).length,0);
  }
 });
 check('real engine delays and commits Cap statuses/reveal once; death/round cleanup and strict JSON restored events never damage',()=>{
  for(const type of['cap-lens','cap-bank-grenade','cap-magazine-grenade','cap-cluster-damage','cap-cluster-heal']){
   const engine=createCharacterSkills(),a=[caster,friend,enemy],event=engine.cast(type,caster,{x:0,y:.12,z:0,flight:1},1,1);assert.ok(event,type);assert.equal(engine.update(a,event.triggerAt-.001,1,{reachable:()=>true,grenadeSweep:floor}).length,0);
   const effects=engine.update(a,event.triggerAt,1,{reachable:()=>true,grenadeSweep:floor});if(type==='cap-lens'){assert.ok(engine.capLocked('enemy',event.triggerAt));assert.ok(engine.capRevealed('caster','enemy',event.triggerAt));assert.equal(engine.capRevealed('friend','enemy',event.triggerAt),false);}
   if(type==='cap-bank-grenade')assert.ok(engine.capBank('friend',event.triggerAt));if(type==='cap-magazine-grenade')assert.ok(engine.capMagazine('friend',event.triggerAt));
   const packet=JSON.parse(JSON.stringify(engine.snapshot('blue'))),guest=createCharacterSkills();assert.ok(guest.restore(packet,event.triggerAt,1),type+' strict restore');assert.equal(guest.update(a,event.triggerAt+.1,1,{reachable:()=>true,grenadeSweep:floor}).length,0);
   if(packet.events[0].hits?.length){const bad=JSON.parse(JSON.stringify(packet));if(Array.isArray(bad.events[0].hits[0]))bad.events[0].hits[0][1]=1e9;else bad.events[0].hits[0]=999;assert.equal(createCharacterSkills().restore(bad,event.triggerAt,1),false);
    for(const change of [p=>p.capTargets.push(p.capTargets[0]),p=>p.events[0].hits.push(p.events[0].hits[0]),p=>p.capTargets[0]='']){const malformed=JSON.parse(JSON.stringify(packet));change(malformed);assert.equal(createCharacterSkills().restore(malformed,event.triggerAt,1),false);}
   }
   engine.resetActor('enemy');assert.equal(engine.capLocked('enemy',event.triggerAt),false);engine.update(a,event.triggerAt+.1,2);assert.equal(engine.events(event.triggerAt+.1).length,0);
  }
 });
 check('20 event capacity is atomic, config is immutable, deep hit copies cannot grant effects',()=>{
  const engine=createCharacterSkills();for(let i=0;i<20;i++)assert.ok(engine.cast('cap-lens',caster,{x:0,y:.12,z:0,flight:1},1,1));assert.equal(engine.cast('cap-lens',caster,{x:0,y:.12,z:0,flight:1},1,1),null);
  engine.update([caster,enemy],2.22,1,{reachable:()=>true,grenadeSweep:floor});const copy=engine.events(2.22);copy[0].hits[0][1]=999;assert.notEqual(engine.events(2.22)[0].hits[0][1],999);assert.ok(Object.isFrozen(c));
 });
 console.log('PASS: '+groups+' Cap physics/authority groups; no audio/browser');
})().catch(e=>{console.error(e);process.exitCode=1;});
