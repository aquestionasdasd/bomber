import { nopeWalkPose } from './nope-walk.js';
import { NOPE_SKILLS } from './abilities.js';

const COUNT = 30, FULL_MASK = 0x3fffffff, MAX_SEQUENCE = 999999999999999;
const fields = ['id', 'team', 'sourceId', 'round', 'startedAt', 'endsAt', 'points', 'shotMask'];
const team = value => value === 'blue' || value === 'red';
const clock = value => Number.isFinite(value) && value >= 0;
const roundNumber = value => Number.isSafeInteger(value) && value > 0;
const coordinate = value => Number.isFinite(value) && Math.abs(value) <= 1000;
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 64 && !/[\u0000-\u001f\u007f]/.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.prototype.toString.call(value) === '[object Object]';
const living = actor => actor && identifier(actor.id) && team(actor.team) && actor.alive === true
  && Number.isFinite(actor.hp) && actor.hp > 0 && actor.hp <= 1000 && coordinate(actor.x) && coordinate(actor.z)
  && (actor.y === undefined || coordinate(actor.y));
const endTime = startedAt => startedAt + NOPE_SKILLS.decoyDuration;
const validEnd = (startedAt, endsAt) => clock(endsAt) && endsAt > startedAt && endsAt === endTime(startedAt)
  && Math.abs(endsAt - startedAt - NOPE_SKILLS.decoyDuration) < 1e-7;
const sequenceOf = (id, round) => {
  if (typeof id !== 'string' || !id.startsWith(`nope-wave-${round}-`)) return 0;
  const suffix = id.slice(`nope-wave-${round}-`.length);
  if (!/^[1-9][0-9]{0,14}$/.test(suffix)) return 0;
  const sequence = Number(suffix); return sequence <= MAX_SEQUENCE ? sequence : 0;
};
const packYaw = yaw => Math.round(((yaw % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 10000) || 0;
const distinct = points => new Set(points.map(point => point.slice(0, 3).join(','))).size === COUNT;
function packPoints(points) {
  if (!Array.isArray(points) || points.length !== COUNT) return null;
  const packed = [];
  for (const point of points) {
    if (!point || ![point.x, point.y, point.z].every(coordinate) || !Number.isFinite(point.yaw)) return null;
    if(point.walkLength!==undefined&&(!Number.isFinite(point.walkLength)||point.walkLength<0||point.walkLength>NOPE_SKILLS.decoyWalkRange))return null;
    packed.push([Math.round(point.x * 100) || 0, Math.round(point.y * 100) || 0, Math.round(point.z * 100) || 0, packYaw(point.yaw),...(point.walkLength===undefined?[]:[Math.round(point.walkLength*100)])]);
  }
  // Two positions which collapse onto the same centimeter must not stack.
  return distinct(packed) ? packed : null;
}
function validPacked(points) {
  return Array.isArray(points) && points.length === COUNT && Object.keys(points).length === COUNT
    && points.every(point => Array.isArray(point) && [4,5].includes(point.length) && Object.keys(point).length === point.length
      && point.every(Number.isSafeInteger) && point.slice(0, 3).every(value => Math.abs(value) <= 100000)
      && Math.abs(point[3]) <= 31416 && (point.length===4||point[4]>=0&&point[4]<=NOPE_SKILLS.decoyWalkRange*100)) && distinct(points);
}
const copyWave = wave => ({ id: wave.id, team: wave.team, sourceId: wave.sourceId, round: wave.round,
  startedAt: wave.startedAt, endsAt: wave.endsAt, points: wave.points.map(point => [...point]), shotMask: wave.shotMask });
const sameWave = (a, b) => fields.filter(key => key !== 'shotMask').every(key => key === 'points'
  ? a.points.every((point, index) => point.length===b.points[index].length&&point.every((value, axis) => value === b.points[index][axis])) : a[key] === b[key]);

// One global ultimate wave, independent of the ordinary twenty-event pool.
// The wire stores centimeters and 1e-4 radians, not render objects or targets.
export function createNopeDecoys() {
  let wave = null, closed = false, owned = false, sequence = 0, seenSequence = 0;
  let currentRound = null, currentTime = -Infinity, lastRestoreTime = -Infinity;
  function clearRound(round, now) {
    wave = null; closed = false; owned = false; seenSequence = 0;
    currentRound = round; currentTime = now; lastRestoreTime = -Infinity;
  }
  function prune() { if (wave && currentTime >= wave.endsAt) closed = true; }
  function eventAt(index) {
    const point = wave.points[index];
    return nopeWalkPose({ id: `${wave.id}-${index + 1}`, type: 'nope-decoy', team: wave.team, sourceId: wave.sourceId, round: wave.round,
      x: point[0] / 100, y: point[1] / 100, z: point[2] / 100, yaw: point[3] / 10000,
      startedAt: wave.startedAt, endsAt: wave.endsAt,...(point.length===5?{walkLength:point[4]/100}:{}) },currentTime);
  }
  function start(sourceActor, points, now, round) {
    if (!living(sourceActor) || !clock(now) || !roundNumber(round) || !validEnd(now, endTime(now))
      || sequence >= MAX_SEQUENCE || currentRound !== null && (round < currentRound || round === currentRound && now < currentTime)) return false;
    const packed = packPoints(points); if (!packed) return false;
    if (round !== currentRound) clearRound(round, now);
    sequence++; seenSequence = sequence; currentTime = now;
    wave = { id: `nope-wave-${round}-${sequence}`, team: sourceActor.team, sourceId: sourceActor.id, round,
      startedAt: now, endsAt: endTime(now), points: packed, shotMask: 0 };
    closed = false; owned = true; return true;
  }
  function events(now) {
    if (!clock(now) || currentRound === null) return [];
    currentTime = Math.max(currentTime, now); prune();
    if (!wave || closed) return [];
    const result = [];
    for (let index = 0; index < COUNT; index++) if (!(wave.shotMask & 1 << index)) result.push(eventAt(index));
    return result;
  }
  function consume(id, shooterTeam, now, round) {
    if (!owned || !wave || closed || !team(shooterTeam) || shooterTeam === wave.team || round !== currentRound
      || !roundNumber(round) || !clock(now) || now < currentTime || now < wave.startedAt || typeof id !== 'string') return null;
    const prefix = `${wave.id}-`, suffix = id.startsWith(prefix) ? id.slice(prefix.length) : '';
    if (!/^(?:[1-9]|[12][0-9]|30)$/.test(suffix)) return null;
    const index = Number(suffix) - 1;
    currentTime = now; prune();
    if (closed || wave.shotMask & 1 << index) return null;
    const removed = eventAt(index); wave.shotMask |= 1 << index; return removed;
  }
  function snapshot() { prune(); return wave && !closed ? copyWave(wave) : null; }
  function restore(value, now, round) {
    if (!clock(now) || !roundNumber(round) || currentRound !== null
      && (round < currentRound || round === currentRound && now < lastRestoreTime)) return false;
    let incomingSequence = 0;
    if (value !== null) {
      if (!record(value) || Object.keys(value).length !== fields.length || !fields.every(key => Object.hasOwn(value, key))
        || !team(value.team) || !identifier(value.sourceId) || value.round !== round || !clock(value.startedAt)
        || value.startedAt > now || !validEnd(value.startedAt, value.endsAt) || !validPacked(value.points)
        || !Number.isSafeInteger(value.shotMask) || value.shotMask < 0 || value.shotMask > FULL_MASK
        || !(incomingSequence = sequenceOf(value.id, round))) return false;
      if (round === currentRound && (incomingSequence < seenSequence
        || incomingSequence === seenSequence && wave && !sameWave(wave, value)
        || incomingSequence > seenSequence && wave && value.startedAt < wave.startedAt)) return false;
    }
    if (round !== currentRound) clearRound(round, now);
    else currentTime = Math.max(currentTime, now);
    lastRestoreTime = now; owned = false;
    if (value === null) { closed = true; return true; }
    if (incomingSequence === seenSequence && wave) {
      // Consumed/cleared copies stay gone even in repeated same-clock packets.
      wave.shotMask |= value.shotMask;
    } else {
      wave = copyWave(value); seenSequence = incomingSequence; closed = false;
    }
    sequence = Math.max(sequence, incomingSequence); prune(); return true;
  }
  function reset() {
    wave = null; closed = false; owned = false; seenSequence = 0;
    currentRound = null; currentTime = -Infinity; lastRestoreTime = -Infinity;
  }
  return { start, events, consume, snapshot, restore, reset };
}
