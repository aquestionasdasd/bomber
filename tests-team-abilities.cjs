const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function main(){
  const {createTeamAbilities,canMend,targetsMend,TEAM_ABILITIES}=await import(pathToFileURL(path.join(__dirname,'public/team-abilities.js')).href);
  const {createCollisionIndex}=await import(pathToFileURL(path.join(__dirname,'public/collision.js')).href);
  const actor=(id,team='blue',x=0,z=0,hp=100)=>({id,team,x,y:0,z,hp,armor:37,alive:true});
  const wire=value=>JSON.parse(JSON.stringify(value));
  let passed=0;
  function test(name,fn){fn();passed++;console.log(`PASS: ${name}`);}
  test('MEND heals only injured living allies/self in18m, caps75/100, and preserves armor/dead/enemies',()=>{
    const kit=createTeamAbilities(),self=actor('self','blue',0,0,1),near=actor('near','blue',17.99,0,20),edge=actor('edge','blue',18,0,50),far=actor('far','blue',18.001,0,20),enemy=actor('enemy','red',1,0,10),dead={...actor('dead','blue',1,0,0),alive:false},full=actor('full'),invalid={...actor('invalid','blue',1,0,20),x:NaN};
    const all=[near,edge,far,enemy,dead,full,invalid,self,self];
    assert.equal(canMend(self,all,()=>true),true);assert.equal(kit.canMend(self,all,()=>true),true);
    assert.deepEqual(targetsMend(self,all,()=>true).map(a=>a.id),['self','near','edge']);
    assert.deepEqual(kit.castMend(self,all,10,1,()=>true),{id:'team-mend-1',type:'mend',team:'blue',x:0,y:0,z:0,startedAt:10,endsAt:11.5,radius:18,round:1});
    assert.equal(self.hp,76);assert.equal(near.hp,95);assert.equal(edge.hp,100);assert.equal(far.hp,20);assert.equal(enemy.hp,10);assert.equal(dead.hp,0);assert.equal(full.hp,100);assert.equal(invalid.hp,20);
    for(const target of [self,...all])assert.equal(target.armor,37);
    assert.equal(kit.events(11.499).length,1);assert.deepEqual(kit.events(11.5),[]);
  });
  test('MEND uses real world occlusion; self bypasses reach and no eligible target produces no cast',()=>{
    const kit=createTeamAbilities(),self=actor('self','blue',-2,0),ally=actor('ally','blue',2,0,10);
    const collision=createCollisionIndex([{minX:-.5,maxX:.5,minZ:-2,maxZ:2,height:3}]);
    const reach=(a,b)=>collision.rayClear(a.x,1.4,a.z,b.x,1.4,b.z);
    assert.equal(reach(self,ally),false);assert.equal(kit.canMend(self,[ally],reach),false);assert.equal(kit.castMend(self,[ally],0,1,reach),null);assert.equal(ally.hp,10);assert.deepEqual(kit.snapshot(),{events:[],pings:[]});
    self.hp=10;assert.equal(kit.canMend(self,[ally],()=>false),true);assert.ok(kit.castMend(self,[ally],0,1,()=>false));assert.equal(self.hp,85);assert.equal(ally.hp,10);
    self.hp=100;assert.equal(kit.canMend(self,[ally]),false,'Other players require the world reach callback');
    assert.equal(kit.castMend({...self,alive:false},[ally],1,1,()=>true),null);
    assert.equal(kit.castMend(self,[ally],NaN,1,()=>true),null);assert.equal(kit.castMend(self,[ally],1,0,()=>true),null);
  });
  test('RECON samples three fixed-center30m pulses, even through walls, without allies/dead/invalid targets',()=>{
    const kit=createTeamAbilities(),self=actor('self'),enemy=actor('enemy','red',30,0),outside=actor('outside','red',30.001,0),ally=actor('ally'),dead={...actor('dead','red',1,0),alive:false},bad={...actor('bad','red'),z:Infinity};
    const event=kit.castRecon(self,10,1),actors=[enemy,outside,ally,dead,bad,enemy];assert.equal(event.type,'recon');assert.equal(event.radius,30);
    const wall=createCollisionIndex([{minX:10,maxX:11,minZ:-2,maxZ:2,height:5}]);assert.equal(wall.rayClear(0,1.4,0,30,1.4,0),false);
    assert.deepEqual(kit.update(actors,10,1),[{observerTeam:'blue',targetId:'enemy',x:30,z:0,seenAt:10}]);
    enemy.x=5;self.x=100;assert.equal(kit.markers('blue',10.5)[0].x,30,'A moving target/caster must not drag the recorded detection or scan center');
    assert.deepEqual(kit.markers('red',10.5),[]);assert.deepEqual(kit.update(actors,10.5,1),[]);
    assert.deepEqual(kit.markers('blue',11.25),[],'Marker lifetime excludes its exact1.25s expiry');
    assert.equal(kit.update(actors,12,1)[0].x,5);assert.equal(kit.update(actors,14,1).length,1);
    assert.deepEqual(kit.update(actors,14,1),[]);assert.deepEqual(kit.update(actors,12,1),[],'Reverse time cannot sample a pulse again');
    assert.deepEqual(kit.update(actors,16,1),[]);assert.deepEqual(kit.events(16),[]);assert.deepEqual(kit.markers('blue',16),[]);
  });
  test('RECON delayed updates consume missed pulses once and cannot resurrect stale or expired observations',()=>{
    const self=actor('self'),enemy=actor('enemy','red',1,0),kit=createTeamAbilities();kit.castRecon(self,0,1);
    assert.deepEqual(kit.update([enemy],1.25,1),[],'A missed pulse whose marker window ended must not become a fresh scan');
    assert.equal(kit.update([enemy],4.1,1).length,1,'Skipping multiple scheduled pulses yields only the latest viable observation');
    assert.deepEqual(kit.update([enemy],4.1,1),[]);assert.deepEqual(kit.update([enemy],2,1),[]);assert.equal(kit.markers('blue',4.5)[0].seenAt,4.1);
    assert.deepEqual(kit.update([enemy],6,1),[]);assert.deepEqual(kit.markers('blue',6),[]);
    const late=createTeamAbilities();late.castRecon(self,0,1);assert.deepEqual(late.update([enemy],20,1),[]);assert.deepEqual(late.snapshot(),{events:[],pings:[]});
  });
  test('round change/reset clears state and retains monotonic cast IDs; old rounds never regain observations',()=>{
    const kit=createTeamAbilities(),self=actor('self'),enemy=actor('enemy','red',1,0);
    const first=kit.castRecon(self,10,2);kit.update([enemy],10,2);assert.equal(kit.markers('blue',10).length,1);
    assert.deepEqual(kit.update([enemy],0,3),[]);assert.deepEqual(kit.snapshot(),{events:[],pings:[]});assert.equal(kit.castRecon(self,12,2),null);
    const next=kit.castRecon(self,0,3);assert.notEqual(next.id,first.id);kit.reset();assert.deepEqual(kit.snapshot(),{events:[],pings:[]});
    assert.notEqual(kit.castRecon(self,0,1).id,next.id);assert.deepEqual(kit.update([enemy],NaN,1),[]);
  });
  test('JSON rejoin restores exact ages/fixed markers without healing or guest autonomous sampling',()=>{
    const host=createTeamAbilities(),self=actor('self','blue',0,0,1),enemy=actor('enemy','red',5,0),actors=[self,enemy];
    host.castMend(self,actors,10,1,()=>true);host.castRecon(self,10,1);host.update(actors,10,1);
    const packet=wire(host.snapshot()),guest=createTeamAbilities();assert.equal(guest.restore(packet,10.75,1),true);assert.equal(self.hp,76,'Restore must never heal the shared input actors');
    assert.equal(guest.markers('blue',10.75)[0].seenAt,10);assert.equal(guest.events(10.75).find(e=>e.type==='mend').endsAt,11.5);
    assert.equal(guest.restore(packet,10.75,1),true);assert.deepEqual(guest.update(actors,12,1),[],'A restored guest cannot sample the next host pulse');assert.equal(self.hp,76);assert.deepEqual(guest.markers('blue',12),[]);
    enemy.x=9;host.update(actors,12,1);const next=wire(host.snapshot());assert.equal(guest.restore(next,12.2,1),true);assert.equal(guest.markers('blue',12.2)[0].x,9);
    assert.equal(guest.restore(packet,10.75,1),false,'An out-of-order snapshot must not roll the clock or marker position back');
    const expired=createTeamAbilities();assert.equal(expired.restore(next,20,1),true);assert.deepEqual(expired.snapshot(),{events:[],pings:[]});
    assert.equal(guest.restore(next,0,2),false,'Future timestamps must be rejected even with a changed round');
    assert.equal(guest.restore(next,20,2),true);assert.deepEqual(guest.snapshot(),{events:[],pings:[]});
    const detached=next.events[0];detached.x=999;assert.equal(host.events(12.2)[0].x,0,'Snapshot records must be detached from the live effect');
  });
  test('strict snapshots reject malformed/oversized/wrong-team/provenance/time/coordinate records atomically',()=>{
    const host=createTeamAbilities(),self=actor('self'),enemy=actor('enemy','red',2,0);host.castRecon(self,0,1);host.update([enemy],0,1);
    const clean=wire(host.snapshot()),guest=createTeamAbilities();assert.equal(guest.restore(clean,.1,1),true);const before=guest.snapshot();
    const mutations=[
      value=>value.events[0].x=NaN,value=>value.events[0].y=Infinity,value=>value.events[0].x=1001,value=>value.events[0].radius=999,
      value=>value.events[0].endsAt=100,value=>value.events[0].startedAt=1,value=>value.events[0].id='bad',value=>value.events[0].team='green',value=>value.events[0].type='heal',
      value=>value.events.push({...value.events[0]}),value=>value.pings[0].observerTeam='red',value=>value.pings[0].round=2,value=>value.pings[0].eventId='missing',
      value=>value.pings[0].targetId='',value=>value.pings[0].x=NaN,value=>value.pings[0].x=31,value=>value.pings[0].seenAt=.5,value=>value.pings[0].endsAt=99,
      value=>value.pings[0].pulse=3,value=>value.pings.push({...value.pings[0]}),value=>value.events=Array(21).fill(value.events[0]),value=>value.pings=Array(51).fill(value.pings[0])
    ];
    for(const change of mutations){const bad=wire(clean);change(bad);assert.equal(guest.restore(bad,.1,1),false);assert.deepEqual(guest.snapshot(),before);}
    for(const value of [null,[],{},false,{events:[],pings:null}])assert.equal(guest.restore(value,.1,1),false);
    assert.equal(guest.restore(clean,Infinity,1),false);assert.equal(guest.restore(clean,.1,-1),false);assert.deepEqual(guest.snapshot(),before);
  });
  test('guest rendering ahead of host accepts ordered snapshots without reviving expired markers or accepting old host time',()=>{
    const host=createTeamAbilities(),guest=createTeamAbilities(),self=actor('self'),enemy=actor('enemy','red',5,0);
    host.castRecon(self,10,1);host.update([enemy],10,1);assert.equal(guest.restore(wire(host.snapshot()),10,1),true);
    guest.events(10.2);self.hp=20;host.castMend(self,[self],10.1,1,()=>true);const packet=wire(host.snapshot());
    assert.equal(guest.restore(packet,10.1,1),true,'A new host packet must not be rejected just because local rendering is100ms ahead');
    assert.deepEqual(guest.events(10.1).map(e=>e.type),['recon','mend'],'The game temporarily adopting the host clock must not blank the active effects');
    assert.equal(guest.markers('blue',10.1).length,1,'Fixed markers must remain readable while the game clock catches up');
    assert.deepEqual(guest.events(10.2).map(e=>e.type),['recon','mend']);assert.deepEqual(guest.update([enemy],10.2,1),[]);
    guest.events(11.4);assert.deepEqual(guest.markers('blue',11.4),[]);
    assert.equal(guest.restore(packet,10.2,1),true,'A newer host timestamp can arrive after predicted marker expiry');
    assert.deepEqual(guest.markers('blue',11.4),[],'Receiving that state must not revive the expired fixed marker');
    const before=guest.snapshot();assert.equal(guest.restore(packet,10.15,1),false);assert.deepEqual(guest.snapshot(),before,'A genuinely older host timestamp is still rejected');
    host.update([],0,2);const next=host.castRecon(self,0,2);assert.equal(guest.restore(wire(host.snapshot()),0,2),true);
    assert.deepEqual(guest.events(0).map(e=>e.id),[next.id],'A new round resets both clocks and removes all previous-round effects');
    assert.deepEqual(guest.markers('blue',0),[]);guest.reset();assert.equal(guest.restore(wire(host.snapshot()),0,2),true);
  });
  test('event/ping memory is bounded, marker views deduplicate targets, and returned data cannot mutate authority',()=>{
    const kit=createTeamAbilities(),self=actor('self'),enemies=Array.from({length:80},(_,i)=>actor('enemy-'+i,'red',i/10,0));
    for(let i=0;i<30;i++)kit.castRecon(self,0,1);
    assert.equal(kit.events(0).length,TEAM_ABILITIES.maxEvents);kit.update(enemies,0,1);assert.equal(kit.snapshot().pings.length,TEAM_ABILITIES.maxPings);
    const markers=kit.markers('blue',0);assert.equal(new Set(markers.map(m=>m.targetId)).size,markers.length);
    const state=kit.snapshot();state.events[0].x=500;state.pings[0].x=500;markers[0].x=500;
    assert.equal(kit.events(0)[0].x,0);assert.ok(kit.markers('blue',0).every(marker=>marker.x<10));
    assert.deepEqual(kit.update(enemies,0,1),[],'Evicting old events/pings must not let a consumed pulse run twice');
    kit.update(enemies,7,1);assert.deepEqual(kit.snapshot(),{events:[],pings:[]});
  });
  console.log(`TOTAL: ${passed} team ability groups passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
