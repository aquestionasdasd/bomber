// Original ground ultimates. Only locally cast events may produce damage.
export const ZONE_ABILITIES = Object.freeze({
  ember: Object.freeze({ radius: 6, duration: 4.8, pulses: Object.freeze([1.2, 2.4, 3.6]), damage: 80, sampleWindow: .4 }),
  frost: Object.freeze({ radius: 7, duration: 10, warmup: .8, slowMultiplier: .55 }),
  maxEvents: 20, castDistance: 20, heightTolerance: 2.5,
});
const validType = value => value === 'ember' || value === 'frost';
const validTeam = value => value === 'blue' || value === 'red';
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 64 && !/[\u0000-\u001f\u007f]/.test(value);
const coordinate = value => Number.isFinite(value) && Math.abs(value) <= 1000;
const clock = value => Number.isFinite(value) && value >= 0;
const roundNumber = value => Number.isSafeInteger(value) && value > 0;
const position = actor => actor && coordinate(actor.x) && coordinate(actor.z) && (actor.y === undefined || coordinate(actor.y));
const living = actor => position(actor) && identifier(actor.id) && validTeam(actor.team) && actor.alive === true && Number.isFinite(actor.hp) && actor.hp > 0 && actor.hp <= 1000;
const pointPosition = point => point && coordinate(point.x) && coordinate(point.y) && coordinate(point.z);
const copy = value => ({ ...value });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inside = (event, actor) => distance(event, actor) <= event.radius && Math.abs((actor.y || 0) - event.y) <= ZONE_ABILITIES.heightTolerance;

export function createZoneAbilities() {
  let currentRound = null, currentTime = -Infinity, lastRestoreTime = -Infinity, sequence = 0;
  const active = new Map(), owned = new Map();
  function clear() { active.clear(); owned.clear(); }
  function prune(now) {
    for (const [id, event] of active) if (event.endsAt <= now) { active.delete(id); owned.delete(id); }
  }
  function advance(now, round = currentRound) {
    if (!clock(now) || !roundNumber(round) || currentRound !== null && (round < currentRound || round === currentRound && now < currentTime)) return false;
    if (round !== currentRound) { clear(); currentRound = round; lastRestoreTime = -Infinity; }
    currentTime = now; prune(now); return true;
  }
  function cast(type, actor, point, now, round) {
    if (!validType(type) || !living(actor) || !pointPosition(point) || distance(actor, point) > ZONE_ABILITIES.castDistance || !advance(now, round)) return null;
    const config = ZONE_ABILITIES[type];
    const event = { id: `zone-${type}-${++sequence}`, type, team: actor.team, sourceId: actor.id,
      x: point.x, y: point.y, z: point.z, startedAt: now, endsAt: now + config.duration, radius: config.radius, round };
    while (active.size >= ZONE_ABILITIES.maxEvents) { const id = active.keys().next().value; active.delete(id); owned.delete(id); }
    active.set(event.id, event);
    if (type === 'ember') owned.set(event.id, { nextPulse: 0 });
    return copy(event);
  }
  function update(actors, now, round) {
    if (!advance(now, round)) return [];
    const damage = [], config = ZONE_ABILITIES.ember;
    for (const [id, state] of owned) {
      const event = active.get(id); if (!event) continue;
      let pulse = -1;
      while (state.nextPulse < config.pulses.length && event.startedAt + config.pulses[state.nextPulse] <= now + 1e-8) pulse = state.nextPulse++;
      // A late frame cannot reconstruct former positions or stack missed hits.
      if (pulse < 0 || now - event.startedAt - config.pulses[pulse] >= config.sampleWindow - 1e-8) continue;
      const seen = new Set();
      for (const target of Array.isArray(actors) ? actors : []) {
        if (!living(target) || target.team === event.team || seen.has(target.id) || !inside(event, target)) continue;
        seen.add(target.id);
        damage.push({ targetId: target.id, sourceId: event.sourceId, team: event.team, damage: config.damage });
      }
    }
    return damage;
  }
  const viewTime = now => clock(now) && advance(Math.max(now, currentTime));
  function speedMultiplier(actor, now) {
    if (!living(actor) || !viewTime(now)) return 1;
    for (const event of active.values()) if (event.type === 'frost' && event.team !== actor.team && currentTime >= event.startedAt + ZONE_ABILITIES.frost.warmup && inside(event, actor)) return ZONE_ABILITIES.frost.slowMultiplier;
    return 1;
  }
  function events(now) { return viewTime(now) ? [...active.values()].map(copy) : []; }
  function snapshot() { return { events: [...active.values()].map(copy) }; }
  function validEvent(value, now) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !validType(value.type) || !validTeam(value.team) || !identifier(value.sourceId) || !pointPosition(value) || !roundNumber(value.round) || !clock(value.startedAt) || !clock(value.endsAt) || value.startedAt > now) return false;
    const config = ZONE_ABILITIES[value.type];
    return typeof value.id === 'string' && new RegExp(`^zone-${value.type}-[1-9][0-9]{0,14}$`).test(value.id) && value.radius === config.radius && Math.abs(value.endsAt - value.startedAt - config.duration) < 1e-8;
  }
  function restore(value, now, round) {
    if (!clock(now) || !roundNumber(round) || !value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.events) || value.events.length > ZONE_ABILITIES.maxEvents) return false;
    const next = new Map();
    for (const item of value.events) {
      if (!validEvent(item, now) || next.has(item.id)) return false;
      next.set(item.id, { id: item.id, type: item.type, team: item.team, sourceId: item.sourceId, x: item.x, y: item.y, z: item.z,
        startedAt: item.startedAt, endsAt: item.endsAt, radius: item.radius, round: item.round });
    }
    // Compare only authoritative timestamps to reject stale snapshots. A client
    // drawing ahead of the host must still accept the host's next valid packet.
    if (currentRound !== null && (round < currentRound || round === currentRound && now < lastRestoreTime)) return false;
    currentTime = round === currentRound ? Math.max(currentTime, now) : now; currentRound = round; lastRestoreTime = now;
    clear();
    for (const event of next.values()) {
      sequence = Math.max(sequence, Number(event.id.slice(event.id.lastIndexOf('-') + 1)));
      if (event.round === round && event.endsAt > currentTime) active.set(event.id, event);
    }
    // Restored events never acquire pulse sampling rights.
    return true;
  }
  function reset() { clear(); currentRound = null; currentTime = -Infinity; lastRestoreTime = -Infinity; }
  return { cast, update, speedMultiplier, snapshot, restore, events, reset };
}
