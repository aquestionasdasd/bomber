// Root contacts are host samples, never enemy outlines or damage events.
export const ROOT_SENSOR = Object.freeze({radius:5,duration:7,linger:1.5,speedScale:.6,jumpHeightScale:.5,
  floorTolerance:.45,airHeight:2.5,maxContacts:10});
const finite=v=>Number.isFinite(v)&&Math.abs(v)<=1000;
const living=a=>a?.alive===true&&a.hp>0&&a.hp<=1000&&typeof a.id==='string'&&a.id.length>0&&a.id.length<=64&&['blue','red'].includes(a.team)&&[a.x,a.y??0,a.z].every(finite);
const safe=(fn,...args)=>{try{return typeof fn==='function'?fn(...args):null;}catch{return null;}};
export const sensorLive=(e,now)=>e?.type==='veil-sensor'&&now>=e.triggerAt&&now<e.triggerAt+ROOT_SENSOR.duration;
export function sensorTouches(actor,event,{reachable,groundHeight}={},attached=false){
  if(!living(actor)||event?.type!=='veil-sensor'||actor.team===event.team
    ||Math.hypot(actor.x-event.x,actor.z-event.z)>ROOT_SENSOR.radius+1e-8)return false;
  const reference=event.y-.12,floor=safe(groundHeight,actor.x,actor.z,reference);
  if(!finite(floor)||Math.abs(floor-reference)>ROOT_SENSOR.floorTolerance+1e-8)return false;
  const height=(actor.y||0)-floor;
  if(actor.grounded!==true&&!attached||height<-.45||height>(attached?ROOT_SENSOR.airHeight:ROOT_SENSOR.floorTolerance)+1e-8)return false;
  // A foot-level wall ray ignores smoke, but never goes through a solid wall.
  return safe(reachable,{...event,y:reference},{...actor,y:floor})===true;
}
export function createRootContacts(){
  const contacts=new Map();
  const expires=r=>r.at+ROOT_SENSOR.linger;
  function prune(events,now){for(const[id,r]of contacts)if(!events.has(r.eventId)||now>=expires(r))contacts.delete(id);}
  function update(events,owned,actors,now,queries){
    prune(events,now);
    const seen=new Set();
    for(const actor of actors){
      if(!living(actor)||seen.has(actor.id))continue;seen.add(actor.id);
      const previous=contacts.get(actor.id);
      const candidates=[...events.values()].filter(e=>owned.has(e.id)&&sensorLive(e,now)&&sensorTouches(actor,e,queries,previous?.active===true&&previous.eventId===e.id));
      candidates.sort((a,b)=>Math.hypot(actor.x-a.x,actor.z-a.z)-Math.hypot(actor.x-b.x,actor.z-b.z)||a.id.localeCompare(b.id));
      const e=candidates[0];
      if(e){
        if(!previous&&contacts.size>=ROOT_SENSOR.maxContacts)continue;
        const floor=safe(queries.groundHeight,actor.x,actor.z,e.y-.12);
        contacts.set(actor.id,{eventId:e.id,targetId:actor.id,team:e.team,x:actor.x,y:floor,z:actor.z,at:now,
          enteredAt:previous?.active&&previous.team===e.team?previous.enteredAt:now,active:true});
      }else if(previous?.active&&owned.has(previous.eventId)){
        previous.active=false;previous.at=Math.min(now,events.get(previous.eventId).triggerAt+ROOT_SENSOR.duration);
      }
    }
    for(const[id,r]of contacts)if(!actors.some(a=>living(a)&&a.id===id&&a.team!==r.team))contacts.delete(id);
  }
  function list(events,now,observerTeam){
    prune(events,now);
    return [...contacts.values()].filter(r=>observerTeam===undefined||r.team===observerTeam)
      .map(r=>({...r,active:r.active&&sensorLive(events.get(r.eventId),now),key:`${r.targetId}:${Math.floor(r.enteredAt*1000+1e-7)}`,endsAt:expires(r)}));
  }
  function affected(actor,event,queries){return sensorTouches(actor,event,queries,contacts.get(actor.id)?.active===true&&contacts.get(actor.id)?.eventId===event.id);}
  // One row per actor bounds network use even when many fields overlap.
  function encode(events,now){const ids=[...events.keys()];return list(events,now).map(r=>[ids.indexOf(r.eventId),r.targetId,
    ...[r.x,r.y,r.z].map(v=>Math.round(v*100)),Math.floor(r.at*1000+1e-7),Math.floor(r.enteredAt*1000+1e-7),r.active?1:0]);}
  function decode(rows,events,now){
    if(rows===undefined)return [];
    if(!Array.isArray(rows)||rows.length>ROOT_SENSOR.maxContacts)return null;
    const list=[...events.values()],seen=new Set(),out=[];
    for(const row of rows){
      if(!Array.isArray(row)||row.length!==8||!Number.isSafeInteger(row[0])||row[0]<0||row[0]>=list.length
        ||typeof row[1]!=='string'||!row[1].length||row[1].length>64||/[\u0000-\u001f\u007f]/.test(row[1])||seen.has(row[1])
        ||!row.slice(2,7).every(Number.isSafeInteger)||!row.slice(2,5).every(v=>Math.abs(v)<=100000)||![0,1].includes(row[7]))return null;
      const e=list[row[0]],at=row[5]/1000,enteredAt=row[6]/1000;
      if(e.type!=='veil-sensor'||row[1]===e.sourceId||enteredAt<0||at<e.triggerAt-.0010001||at>Math.min(now,e.triggerAt+ROOT_SENSOR.duration)+1e-7
        ||enteredAt>at||at+ROOT_SENSOR.linger<=now||row[7]===1&&!sensorLive(e,now)
        ||Math.hypot(row[2]/100-e.x,row[4]/100-e.z)>ROOT_SENSOR.radius+.015||Math.abs(row[3]/100-(e.y-.12))>ROOT_SENSOR.floorTolerance+.015)return null;
      seen.add(row[1]);out.push({eventId:e.id,targetId:row[1],team:e.team,x:row[2]/100,y:row[3]/100,z:row[4]/100,at,enteredAt,active:!!row[7]});
    }return out;
  }
  return {update,prune,list,affected,encode,decode,replace(rows){contacts.clear();for(const r of rows)contacts.set(r.targetId,r);},
    clear(){contacts.clear();},resetActor(id){contacts.delete(id);}};
}
