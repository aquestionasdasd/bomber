import { ONNARA_SKILLS as S } from './abilities.js';

// The host calls this once per accepted trigger, never per pellet or damage hit.
export function chargeCrownTax(skills, actor, now, ledger) {
  if (!actor?.alive || !ledger || !Number.isSafeInteger(ledger.credits) || ledger.credits < 0) return 0;
  const before = skills.onnaraTax?.(actor.id, now)?.power;
  const paid = skills.consumeCrownTax(actor.id, now, ledger.credits);
  ledger.credits -= paid;
  // Only an owned host event can spend this budget. A restored guest event
  // never changes HP, including when the target has no credits left.
  const after = skills.onnaraTax?.(actor.id, now)?.power;
  if (Number.isFinite(before) && after < before && Number.isFinite(actor.hp) && actor.hp > 0) {
    actor.hp = Math.max(1, actor.hp - S.taxHealthPerShot);
  }
  return paid;
}

export function orbViewYaw(event, now) {
  const age = Number.isFinite(now) && Number.isFinite(event.startedAt) ? now-event.startedAt : 0;
  return event.yaw + Math.PI*2*Math.max(0, Math.min(1, age/(event.flight===S.orbCameraDuration?S.orbCameraDuration:S.orbDuration)));
}

// Actual damage (HP + armor lost), not nominal weapon damage, drives the chain.
export function constellationTarget(victim, owner, actors, reachable) {
  if (!owner?.alive || !victim || victim.team === owner.team) return null;
  const candidates = actors.filter(a => a?.alive && a !== victim && a.id !== victim.id && a.id !== owner.id && a.team !== owner.team)
    .map(actor => ({ actor, d: Math.hypot(actor.x-victim.x, (actor.y||0)-(victim.y||0), actor.z-victim.z) }))
    .filter(({actor,d}) => d <= S.chainRange && reachable(victim, actor) === true)
    .sort((a,b) => a.d-b.d || a.actor.id.localeCompare(b.actor.id));
  return candidates[0]?.actor || null;
}

// A stopped event stays stopped for its remaining lifetime, including a fresh
// same-round snapshot. Keeping IDs here never grants damage or inventory rights.
export function createStarHold() {
  const stopped = new Map(), hops = new Map();
  function stop(event) {if(!event)return false;stopped.set(event.id,event.endsAt);hops.delete(event.id);return true;}
  function begin(actor,event,now,sequence) {
    if(!event||event.endsAt<=now||stopped.has(event.id)||hops.get(event.id)?.moving||!actor?.alive)return false;
    hops.set(event.id,{sequence,moving:true,anchor:null,endsAt:event.endsAt});actor.vy=6.552;return true;
  }
  function sync(actor,event,now) {
    if(!event?.hop||stopped.has(event.id))return;
    const [sequence,at]=event.hop,old=hops.get(event.id);
    if(old?.sequence===sequence)return;
    const vy=Math.max(0,6.552-15*Math.max(0,now-at));
    hops.set(event.id,{sequence,moving:vy>0,anchor:null,endsAt:event.endsAt});actor.vy=vy;
  }
  function finish(actor,event) {
    const h=hops.get(event?.id);if(!h?.moving||actor.vy>0)return false;
    h.moving=false;h.anchor=actor.y;actor.vy=0;return true;
  }
  function apply(actor, event, now, valid) {
    for (const [id,end] of stopped) if (end <= now) stopped.delete(id);
    for (const [id,h] of hops) if (h.endsAt <= now) hops.delete(id);
    if (!event || event.endsAt <= now || stopped.has(event.id)) return false;
    const h=hops.get(event.id);
    if(h?.moving)return false;
    // Keep a completed prediction until the host publishes its apex. Once it
    // arrives, the existing authoritative coordinates replace the prediction.
    if(h&&h.anchor!==null&&event.hop?.[0]===h.sequence&&event.y!==event.hop[2])h.anchor=null;
    const anchor=h?.anchor??event.y,hold={...event,y:anchor};
    if (!actor?.alive || actor.team !== event.team || valid(actor,hold) !== true) {stop(event);return false;}
    actor.y=anchor; actor.vy=0; return true;
  }
  return { apply, begin, sync, finish, stop, moving:id=>hops.get(id)?.moving===true,
    forget(id){hops.delete(id);}, reset(){stopped.clear();hops.clear();}, stopped:(id)=>stopped.has(id) };
}

// This pose and frustum are used by the inset, the main-view overlay and BOTs.
export function orbViewPose(e,now){const moving=e.flight===S.orbCameraDuration;return {x:e.x,y:e.y+(moving?0:1.65),z:e.z,yaw:orbViewYaw(e,now),pitch:moving?Math.asin(Math.max(-1,Math.min(1,e.fromY/S.orbSpeed))):0};}
export function orbSeesActor(e,actor,now,visible){
 const p=orbViewPose(e,now),dx=actor.x-p.x,dy=(actor.y||0)+1.45-(actor.crouch||0)*.55-p.y,dz=actor.z-p.z;
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch),right=dx*c-dz*s,up=dx*s*sp+dy*cp+dz*c*sp,forward=-dx*s*cp+dy*sp-dz*c*cp;
 const tan=Math.tan(65*Math.PI/360);return actor.alive&&forward>.08&&forward<140&&Math.abs(up)<forward*tan&&Math.abs(right)<forward*tan*16/9&&visible({x:p.x,y:p.y-1.45,z:p.z},actor)===true;
}
