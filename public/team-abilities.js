// Original team ultimates. Only local casts own sampling rights; restored events are visual state.
export const TEAM_ABILITIES = Object.freeze({ mendRadius:18, mendAmount:75, mendDuration:1.5,
  reconRadius:300, reconDuration:6, reconPulses:Object.freeze([0,2,4]), markerDuration:1.25,
  maxEvents:20, maxPings:50 });
const team=value=>value==='blue'||value==='red';
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=64&&!/[\u0000-\u001f\u007f]/.test(value);
const coordinate=value=>Number.isFinite(value)&&Math.abs(value)<=1000;
const clock=value=>Number.isFinite(value)&&value>=0;
const roundNumber=value=>Number.isSafeInteger(value)&&value>0;
const position=actor=>actor&&coordinate(actor.x)&&coordinate(actor.z)&&(actor.y===undefined||coordinate(actor.y));
const living=actor=>position(actor)&&identifier(actor.id)&&team(actor.team)&&actor.alive===true&&Number.isFinite(actor.hp)&&actor.hp>0&&actor.hp<=1000;
const copy=value=>({...value});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const pingKey=ping=>`${ping.eventId}:${ping.pulse}:${ping.targetId}`;

export function targetsMend(actor,actors,canReach){
  if(!living(actor))return [];
  const seen=new Set(),result=[];
  for(const target of [actor,...(Array.isArray(actors)?actors:[])]){
    if(!living(target)||target.team!==actor.team||target.hp>=100||seen.has(target.id)||distance(actor,target)>TEAM_ABILITIES.mendRadius)continue;
    seen.add(target.id);
    if(target!==actor&&(typeof canReach!=='function'||canReach(actor,target)!==true))continue;
    result.push(target);
  }
  return result;
}
export const canMend=(actor,actors,canReach)=>targetsMend(actor,actors,canReach).length>0;

export function createTeamAbilities(){
  let currentRound=null,currentTime=-Infinity,lastRestoreTime=-Infinity,sequence=0;
  const active=new Map(),owned=new Map(),pings=new Map();
  function clear(){active.clear();owned.clear();pings.clear();}
  function prune(now){
    for(const [id,event]of active)if(event.endsAt<=now){active.delete(id);owned.delete(id);}
    for(const [id,ping]of pings)if(ping.endsAt<=now)pings.delete(id);
  }
  function advance(now,round=currentRound){
    if(!clock(now)||!roundNumber(round)||currentRound!==null&&(round<currentRound||round===currentRound&&now<currentTime))return false;
    if(round!==currentRound){clear();currentRound=round;currentTime=now;lastRestoreTime=-Infinity;}else currentTime=now;
    prune(now);return true;
  }
  function insert(event){
    while(active.size>=TEAM_ABILITIES.maxEvents){const id=active.keys().next().value;active.delete(id);owned.delete(id);for(const [key,ping]of pings)if(ping.eventId===id)pings.delete(key);}
    active.set(event.id,event);return copy(event);
  }
  function eventFor(type,actor,now,round){
    const duration=type==='mend'?TEAM_ABILITIES.mendDuration:TEAM_ABILITIES.reconDuration;
    return {id:`team-${type}-${++sequence}`,type,team:actor.team,x:actor.x,y:actor.y||0,z:actor.z,
      startedAt:now,endsAt:now+duration,radius:type==='mend'?TEAM_ABILITIES.mendRadius:TEAM_ABILITIES.reconRadius,round};
  }
  function castMend(actor,actors,now,round,canReach){
    if(!living(actor)||!advance(now,round))return null;
    const targets=targetsMend(actor,actors,canReach);if(!targets.length)return null;
    for(const target of targets)target.hp=Math.min(100,target.hp+TEAM_ABILITIES.mendAmount);
    return insert(eventFor('mend',actor,now,round));
  }
  function castRecon(actor,now,round){
    if(!living(actor)||!advance(now,round))return null;
    const event=eventFor('recon',actor,now,round);insert(event);owned.set(event.id,{nextPulse:0});return copy(event);
  }
  function update(actors,now,round){
    if(!advance(now,round))return [];
    const discoveries=[];
    for(const [id,state]of owned){
      const event=active.get(id);if(!event)continue;
      let pulse=-1;
      while(state.nextPulse<TEAM_ABILITIES.reconPulses.length&&event.startedAt+TEAM_ABILITIES.reconPulses[state.nextPulse]<=now+1e-8)pulse=state.nextPulse++;
      // Missed pulses cannot reconstruct historical positions. Consume them, then
      // sample only the latest pulse while its observation window is still live.
      if(pulse<0||now-event.startedAt-TEAM_ABILITIES.reconPulses[pulse]>=TEAM_ABILITIES.markerDuration)continue;
      const seen=new Set();
      for(const target of Array.isArray(actors)?actors:[]){
        if(!living(target)||target.team===event.team||seen.has(target.id)||distance(event,target)>event.radius)continue;
        seen.add(target.id);
        const ping={eventId:id,pulse,round,observerTeam:event.team,targetId:target.id,x:target.x,z:target.z,seenAt:now,
          endsAt:Math.min(now+TEAM_ABILITIES.markerDuration,event.endsAt)};
        const key=pingKey(ping);if(pings.has(key))continue;
        while(pings.size>=TEAM_ABILITIES.maxPings)pings.delete(pings.keys().next().value);
        pings.set(key,ping);discoveries.push({observerTeam:ping.observerTeam,targetId:ping.targetId,x:ping.x,z:ping.z,seenAt:ping.seenAt});
      }
    }
    return discoveries;
  }
  const viewTime=now=>clock(now)&&advance(Math.max(now,currentTime));
  function events(now){return viewTime(now)?[...active.values()].map(copy):[];}
  function markers(observerTeam,now){
    if(!team(observerTeam)||!viewTime(now))return [];
    const latest=new Map();
    for(const ping of pings.values())if(ping.observerTeam===observerTeam&&(!latest.has(ping.targetId)||latest.get(ping.targetId).seenAt<=ping.seenAt))latest.set(ping.targetId,ping);
    return [...latest.values()].map(copy);
  }
  function snapshot(){return {events:[...active.values()].map(copy),pings:[...pings.values()].map(copy)};}
  function validEvent(value,now){
    if(!value||typeof value!=='object'||Array.isArray(value)||!['mend','recon'].includes(value.type)||!team(value.team)||!position(value)||!roundNumber(value.round)||!clock(value.startedAt)||!clock(value.endsAt)||value.startedAt>now)return false;
    const duration=value.type==='mend'?TEAM_ABILITIES.mendDuration:TEAM_ABILITIES.reconDuration,radius=value.type==='mend'?TEAM_ABILITIES.mendRadius:TEAM_ABILITIES.reconRadius;
    return typeof value.id==='string'&&new RegExp(`^team-${value.type}-[1-9][0-9]{0,14}$`).test(value.id)&&value.radius===radius&&Math.abs(value.endsAt-value.startedAt-duration)<1e-8;
  }
  function restore(value,now,round){
    if(!clock(now)||!roundNumber(round)||!value||typeof value!=='object'||Array.isArray(value)||!Array.isArray(value.events)||!Array.isArray(value.pings)||value.events.length>TEAM_ABILITIES.maxEvents||value.pings.length>TEAM_ABILITIES.maxPings)return false;
    const nextEvents=new Map(),nextPings=new Map();
    for(const item of value.events){
      if(!validEvent(item,now)||nextEvents.has(item.id))return false;
      nextEvents.set(item.id,{id:item.id,type:item.type,team:item.team,x:item.x,y:item.y||0,z:item.z,startedAt:item.startedAt,endsAt:item.endsAt,radius:item.radius,round:item.round});
    }
    for(const item of value.pings){
      if(!item||typeof item!=='object'||Array.isArray(item))return false;
      const event=nextEvents.get(item.eventId),pulse=item.pulse;
      if(!event||event.type!=='recon'||!Number.isInteger(pulse)||pulse<0||pulse>=TEAM_ABILITIES.reconPulses.length||item.round!==event.round||item.observerTeam!==event.team||!identifier(item.targetId)||!coordinate(item.x)||!coordinate(item.z)||!clock(item.seenAt)||item.seenAt>now||item.seenAt<event.startedAt+TEAM_ABILITIES.reconPulses[pulse]-1e-8||item.seenAt>=event.startedAt+TEAM_ABILITIES.reconPulses[pulse]+TEAM_ABILITIES.markerDuration||item.endsAt!==Math.min(item.seenAt+TEAM_ABILITIES.markerDuration,event.endsAt)||Math.hypot(item.x-event.x,item.z-event.z)>event.radius)return false;
      const ping={eventId:item.eventId,pulse,round:item.round,observerTeam:item.observerTeam,targetId:item.targetId,x:item.x,z:item.z,seenAt:item.seenAt,endsAt:item.endsAt},key=pingKey(ping);
      if(nextPings.has(key))return false;nextPings.set(key,ping);
    }
    // Client rendering can be ahead of the newest authoritative packet. Only
    // compare host timestamps with other restores, while keeping expiry monotonic.
    if(currentRound!==null&&(round<currentRound||round===currentRound&&now<lastRestoreTime))return false;
    currentTime=round===currentRound?Math.max(currentTime,now):now;currentRound=round;lastRestoreTime=now;
    clear();
    for(const event of nextEvents.values())if(event.round===round&&event.endsAt>currentTime)active.set(event.id,event);
    for(const [key,ping]of nextPings)if(ping.round===round&&ping.endsAt>currentTime&&active.has(ping.eventId))pings.set(key,ping);
    // Restore never grants host sampling rights, nor applies healing a second time.
    return true;
  }
  function reset(){clear();currentRound=null;currentTime=-Infinity;lastRestoreTime=-Infinity;}
  return {castMend,castRecon,canMend,targetsMend,update,snapshot,restore,reset,markers,events};
}
