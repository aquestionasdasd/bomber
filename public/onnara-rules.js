import { ONNARA_SKILLS as S } from './abilities.js';

// The host calls this once per accepted trigger, never per pellet or damage hit.
export function chargeCrownTax(skills, actor, now, ledger) {
  if (!actor?.alive || !ledger || !Number.isSafeInteger(ledger.credits) || ledger.credits < 0) return 0;
  const paid = skills.consumeCrownTax(actor.id, now, ledger.credits);
  ledger.credits -= paid;
  return paid;
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
