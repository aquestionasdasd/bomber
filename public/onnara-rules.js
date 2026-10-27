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
  const stopped = new Map();
  function apply(actor, event, now, valid) {
    for (const [id,end] of stopped) if (end <= now) stopped.delete(id);
    if (!event || event.endsAt <= now || stopped.has(event.id)) return false;
    if (!actor?.alive || actor.team !== event.team || valid(actor,event) !== true) {
      stopped.set(event.id,event.endsAt); return false;
    }
    actor.y=event.y; actor.vy=0; return true;
  }
  return { apply, reset(){stopped.clear();}, stopped:(id)=>stopped.has(id) };
}

// This pose and frustum are used by the inset, the main-view overlay and BOTs.
export function orbViewPose(e,now){const moving=e.flight===S.orbCameraDuration;return {x:e.x,y:e.y+(moving?0:1.65),z:e.z,yaw:orbViewYaw(e,now),pitch:moving?Math.asin(Math.max(-1,Math.min(1,e.fromY/S.orbSpeed))):0};}
export function orbSeesActor(e,actor,now,visible){
 const p=orbViewPose(e,now),dx=actor.x-p.x,dy=(actor.y||0)+1.45-(actor.crouch||0)*.55-p.y,dz=actor.z-p.z;
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch),right=dx*c-dz*s,up=dx*s*sp+dy*cp+dz*c*sp,forward=-dx*s*cp+dy*sp-dz*c*cp;
 const tan=Math.tan(65*Math.PI/360);return actor.alive&&forward>.08&&forward<140&&Math.abs(up)<forward*tan&&Math.abs(right)<forward*tan*16/9&&visible({x:p.x,y:p.y-1.45,z:p.z},actor)===true;
}
