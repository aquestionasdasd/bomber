import { nopeWalkPose } from './nope-walk.js';
import { RENKO_SKILLS, ONNARA_SKILLS, URCHIN_SKILLS, CAP_SKILLS, JAPAN_SKILLS, NOBI_SKILLS, CAR_SKILLS, CAT_SKILLS, DUCK_SKILLS, DUELIST_SKILLS, NOPE_SKILLS, MEND_SKILLS, IAGNU_SKILLS, VEIL_SKILLS, EMBER_SKILLS, FROST_SKILLS } from './abilities.js';
import { WEAPONS } from './rules.js';

// Ordinary skills are separate from ultimates. A restored event owns visuals,
// never hit sampling; only a successful local cast may produce gameplay effects.
export const CHARACTER_SKILLS = Object.freeze({ maxEvents: 20, maxBlinds: 20, maxMarkers: 20, castDistance: 20, decoyDistance: 6,
  heightTolerance: 2.5, flashFacingDot: .2 });
const specs = Object.freeze({
 'renko-dart':Object.freeze({flight:RENKO_SKILLS.dartRange/RENKO_SKILLS.dartSpeed,delay:0,tail:1,radius:0}),
 'renko-drive':Object.freeze({flight:0,delay:0,tail:RENKO_SKILLS.driveDuration,radius:0}),
 'renko-jet':Object.freeze({flight:0,delay:0,tail:RENKO_SKILLS.flightDuration,radius:0}),
 'onnara-jump':Object.freeze({flight:0,delay:0,tail:ONNARA_SKILLS.jumpDuration,radius:0}),
 'onnara-tax':Object.freeze({flight:0,delay:0,tail:ONNARA_SKILLS.taxDuration,radius:0}),
 'onnara-orb':Object.freeze({flight:0,delay:0,tail:ONNARA_SKILLS.orbDuration,radius:0}),
 'onnara-hover':Object.freeze({flight:0,delay:0,tail:ONNARA_SKILLS.hoverDuration,radius:0}),
 'onnara-chain':Object.freeze({flight:0,delay:0,tail:ONNARA_SKILLS.chainDuration,radius:0}),
 'urchin-gloom':Object.freeze({flight:URCHIN_SKILLS.gloomRange/URCHIN_SKILLS.gloomSpeed,delay:URCHIN_SKILLS.gloomDelay,tail:URCHIN_SKILLS.gloomRange/URCHIN_SKILLS.gloomSpeed+.2,radius:URCHIN_SKILLS.gloomRadius}),
 'urchin-lance':Object.freeze({flight:0,delay:URCHIN_SKILLS.lanceDelay,tail:URCHIN_SKILLS.lanceTail,radius:URCHIN_SKILLS.lanceRadius}),
 'urchin-jam':Object.freeze({flight:0,delay:0,tail:URCHIN_SKILLS.jamDuration,radius:0}),
 'urchin-disarm':Object.freeze({flight:0,delay:0,tail:.8,radius:0}),
 'urchin-pearl':Object.freeze({flight:0,delay:0,tail:.8,radius:0}),
 'urchin-trident':Object.freeze({flight:0,delay:0,tail:URCHIN_SKILLS.tridentDuration,radius:0}),
 'cap-lock':Object.freeze({flight:0,delay:0,tail:CAP_SKILLS.lockDuration,radius:0}),
 'cap-clean':Object.freeze({flight:0,delay:0,tail:.8,radius:0}),
 'cap-bank':Object.freeze({flight:0,delay:0,tail:CAP_SKILLS.bounceDuration,radius:0}),
 'cap-magazine':Object.freeze({flight:0,delay:0,tail:CAP_SKILLS.magazineDuration,radius:0}),
 'japan-border':Object.freeze({flight:0,delay:JAPAN_SKILLS.borderArm,tail:JAPAN_SKILLS.borderDuration,radius:JAPAN_SKILLS.borderWidth/2}),
 'japan-levy':Object.freeze({flight:0,delay:0,tail:.8,radius:0}),
 'japan-return':Object.freeze({flight:0,delay:0,tail:JAPAN_SKILLS.returnDuration,radius:0}),
 'japan-muster':Object.freeze({flight:0,delay:0,tail:JAPAN_SKILLS.musterDuration,radius:0}),
 'nobi-bell':Object.freeze({flight:NOBI_SKILLS.throwFlight,delay:NOBI_SKILLS.throwFlight,tail:NOBI_SKILLS.tagDuration,radius:NOBI_SKILLS.areaRadius}),
 'nobi-whisker':Object.freeze({flight:NOBI_SKILLS.throwFlight,delay:NOBI_SKILLS.throwFlight,tail:NOBI_SKILLS.brakeDuration,radius:NOBI_SKILLS.areaRadius}),
 'nobi-toolbox':Object.freeze({flight:NOBI_SKILLS.throwFlight,delay:NOBI_SKILLS.throwFlight,tail:NOBI_SKILLS.toolDuration,radius:NOBI_SKILLS.areaRadius}),
 'nobi-collar':Object.freeze({flight:NOBI_SKILLS.throwFlight,delay:NOBI_SKILLS.throwFlight,tail:NOBI_SKILLS.legendDuration,radius:NOBI_SKILLS.areaRadius}),
 'nobi-tag':Object.freeze({flight:0,delay:0,tail:NOBI_SKILLS.tagDuration,radius:0}),
 'nobi-brake':Object.freeze({flight:0,delay:0,tail:NOBI_SKILLS.brakeDuration,radius:0}),
 'nobi-tool':Object.freeze({flight:0,delay:0,tail:NOBI_SKILLS.toolDuration,radius:0}),
 'nobi-legend':Object.freeze({flight:0,delay:0,tail:NOBI_SKILLS.legendDuration,radius:0}),
 'car-bumper':Object.freeze({flight:0,delay:0,tail:Math.max(2.5,Math.ceil((CAR_SKILLS.bumperRange/CAR_SKILLS.bumperSpeed+CAR_SKILLS.bumperLaunchTime)*10)/10),radius:0}),
 'car-wash':Object.freeze({flight:0,delay:0,tail:.8,radius:0}),
 'car-gyro':Object.freeze({flight:0,delay:0,tail:CAR_SKILLS.gyroDuration,radius:0}),
 'car-pit':Object.freeze({flight:0,delay:0,tail:1,radius:0}),
 'cat-bookmark':Object.freeze({flight:0,delay:0,tail:CAT_SKILLS.bookmarkDuration,radius:0}),
 'cat-return':Object.freeze({flight:0,delay:0,tail:.6,radius:0}),
 'cat-pluck':Object.freeze({flight:0,delay:0,tail:.6,radius:0}),
 'cat-fetch':Object.freeze({flight:0,delay:0,tail:.6,radius:0}),
 'cat-clock':Object.freeze({flight:0,delay:0,tail:CAT_SKILLS.clockDuration,radius:0}),
  'duck-pad':Object.freeze({flight:0,delay:DUCK_SKILLS.padArm,tail:DUCK_SKILLS.padDuration,radius:DUCK_SKILLS.padRadius}),
  'duck-seal':Object.freeze({flight:0,delay:0,tail:DUCK_SKILLS.sealDuration,radius:0}),
  'duck-shield':Object.freeze({flight:0,delay:0,tail:DUCK_SKILLS.shieldDuration,radius:0}),
  'duck-hush':Object.freeze({flight:0,delay:0,tail:DUCK_SKILLS.flightDuration,radius:0}),
  'duck-egg':Object.freeze({flight:0,delay:0,tail:DUCK_SKILLS.eggDuration,radius:0}),
  'duelist-comet': Object.freeze({ flight: DUELIST_SKILLS.cometFlight, delay: DUELIST_SKILLS.cometFlight, tail: DUELIST_SKILLS.cometDuration, radius: DUELIST_SKILLS.cometRadius }),
  'duelist-lift': Object.freeze({ flight: 0, delay: 0, tail: DUELIST_SKILLS.liftVisualDuration, radius: 0 }),
  'nope-bottle': Object.freeze({ flight: NOPE_SKILLS.bottleFlight, delay: NOPE_SKILLS.bottleFuse, tail: .6, radius: NOPE_SKILLS.bottleRadius }),
  'nope-flash': Object.freeze({ flight: NOPE_SKILLS.flashFlight, delay: NOPE_SKILLS.flashFlight, tail: .4, radius: NOPE_SKILLS.flashRadius }),
  'nope-decoy': Object.freeze({ flight: 0, delay: 0, tail: NOPE_SKILLS.decoyDuration, radius: 0 }),
  'mend-seeds': Object.freeze({ flight: MEND_SKILLS.seedsFlight, delay: MEND_SKILLS.seedsFlight, tail: MEND_SKILLS.seedsDuration, radius: MEND_SKILLS.seedsRadius }),
  'mend-pollen': Object.freeze({ flight: MEND_SKILLS.pollenFlight, delay: MEND_SKILLS.pollenFlight, tail: MEND_SKILLS.pollenDuration, radius: MEND_SKILLS.pollenRadius }),
  'mend-heal': Object.freeze({ flight: 0, delay: 0, tail: MEND_SKILLS.healVisualDuration, radius: MEND_SKILLS.healRange }),
  'echo-tag': Object.freeze({ flight: IAGNU_SKILLS.tagFlight, delay: IAGNU_SKILLS.tagFlight + IAGNU_SKILLS.tagArmDelay, tail: IAGNU_SKILLS.tagDuration, radius: IAGNU_SKILLS.tagRadius }),
  'echo-glint': Object.freeze({ flight: IAGNU_SKILLS.glintFlight, delay: IAGNU_SKILLS.glintFlight, tail: .4, radius: IAGNU_SKILLS.glintRadius }),
  'echo-kerning': Object.freeze({ flight: 0, delay: 0, tail: IAGNU_SKILLS.kerningDuration, radius: 0 }),
  'veil-dust': Object.freeze({ flight: 0, delay: VEIL_SKILLS.dustArmDelay, tail: VEIL_SKILLS.dustDuration, radius: VEIL_SKILLS.dustRadius }),
  'veil-roots': Object.freeze({ flight: 0, delay: VEIL_SKILLS.rootsArmDelay, tail: VEIL_SKILLS.rootsDuration, radius: VEIL_SKILLS.rootsWidth / 2 }),
  'veil-turf': Object.freeze({ flight: 0, delay: 0, tail: VEIL_SKILLS.turfDuration, radius: 0 }),
  'ember-solder': Object.freeze({ flight: EMBER_SKILLS.solderFlight, delay: EMBER_SKILLS.solderFlight + EMBER_SKILLS.solderArmDelay, tail: EMBER_SKILLS.solderTail, radius: EMBER_SKILLS.solderRadius }),
  'ember-shade': Object.freeze({ flight: 0, delay: 0, tail: EMBER_SKILLS.shadeDuration, radius: 0 }),
  'ember-service': Object.freeze({ flight: 0, delay: 0, tail: EMBER_SKILLS.serviceDuration, radius: 0 }),
  'frost-stitch': Object.freeze({ flight: FROST_SKILLS.stitchFlight, delay: FROST_SKILLS.stitchFlight + FROST_SKILLS.stitchArmDelay, tail: FROST_SKILLS.stitchDuration, radius: FROST_SKILLS.stitchRadius }),
  'frost-mist': Object.freeze({ flight: FROST_SKILLS.mistFlight, delay: FROST_SKILLS.mistFlight, tail: FROST_SKILLS.mistDuration, radius: FROST_SKILLS.mistRadius }),
  'frost-unravel': Object.freeze({ flight: 0, delay: 0, tail: FROST_SKILLS.unravelDuration, radius: 0 }),
});
const isType = type => typeof type === 'string' && Object.hasOwn(specs, type);
const team = value => value === 'blue' || value === 'red';
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 64 && !/[\u0000-\u001f\u007f]/.test(value);
const coordinate = value => Number.isFinite(value) && Math.abs(value) <= 1000;
const clock = value => Number.isFinite(value) && value >= 0;
const roundNumber = value => Number.isSafeInteger(value) && value > 0;
const position = value => value && coordinate(value.x) && coordinate(value.z) && (value.y === undefined || coordinate(value.y));
const living = value => position(value) && identifier(value.id) && team(value.team) && value.alive === true && Number.isFinite(value.hp) && value.hp > 0 && value.hp <= 1000;
const point = value => position(value) && coordinate(value.y);
const copy = value => ({ ...value, ...(value.link ? {link:[...value.link]} : {}) });
const close = (a, b) => Math.abs(a - b) < 1e-7;
const idSequence = (id, type) => {
  if (typeof id !== 'string' || !new RegExp(`^skill-${type}-[1-9][0-9]{0,14}$`).test(id)) return 0;
  const seq = Number(id.slice(id.lastIndexOf('-') + 1)); return Number.isSafeInteger(seq) ? seq : 0;
};
const eyeY = actor => (actor.y || 0) + 1.7 - Math.max(0, Math.min(1, Number.isFinite(actor.crouch) ? actor.crouch : 0)) * .55;
const feetDistance = (a, b) => Math.hypot(a.x - b.x, (a.y || 0) - (b.y || 0), a.z - b.z);
const serviceWeapon = value => typeof value === 'string' && Object.hasOwn(WEAPONS, value)
  && ['primary', 'secondary'].includes(WEAPONS[value].slot) && WEAPONS[value].mag > 0;
const personal = type => ['renko-drive','renko-jet','onnara-jump','onnara-orb','onnara-hover','onnara-chain','urchin-pearl','urchin-trident','cap-bank','cap-magazine','japan-return','nobi-tool','nobi-legend','car-gyro','cat-bookmark','cat-clock','duck-hush', 'duck-egg', 'echo-kerning', 'veil-turf', 'ember-shade', 'ember-service', 'frost-unravel'].includes(type);
const groundedPersonal = type => type === 'veil-turf' || type === 'frost-unravel';
const nobiArea = type => ['nobi-bell','nobi-whisker','nobi-toolbox','nobi-collar'].includes(type);
const nobiRange = type => type==='nobi-bell'?NOBI_SKILLS.tagRange:type==='nobi-whisker'?NOBI_SKILLS.brakeRange:type==='nobi-toolbox'?NOBI_SKILLS.toolRange:NOBI_SKILLS.legendRange;
const feetSource = type => type.startsWith('onnara-') || type.startsWith('urchin-')&&!['urchin-lance','urchin-gloom'].includes(type) || type.startsWith('cap-') || type.startsWith('japan-') || type.startsWith('nobi-')&&!nobiArea(type) || type.startsWith('car-') || type.startsWith('cat-') || type === 'mend-heal' || type === 'duelist-lift' || personal(type) || type.startsWith('veil-');
const eventFields = ['id', 'type', 'team', 'sourceId', 'round', 'fromX', 'fromY', 'fromZ', 'x', 'y', 'z', 'startedAt', 'flight', 'triggerAt', 'endsAt', 'radius'];
const withinCastRange = (type, actor, target, sourceEyeY = eyeY(actor)) => type==='renko-dart' ? Math.hypot(target.x-actor.x,target.y-sourceEyeY,target.z-actor.z)<=RENKO_SKILLS.dartRange+1e-8 : nobiArea(type) ? Math.hypot(target.x-actor.x,target.z-actor.z)<=nobiRange(type)+1e-8 : type.startsWith('onnara-') ? feetDistance(actor,target)<=(type==='onnara-tax'?ONNARA_SKILLS.taxRange+.002:type==='onnara-orb'?ONNARA_SKILLS.orbRange+.002:1e-8)+1e-8 : type==='urchin-gloom' ? close(Math.hypot(target.x-actor.x,target.y-sourceEyeY,target.z-actor.z),URCHIN_SKILLS.gloomRange) : type==='urchin-lance' ? Math.hypot(target.x-actor.x,target.y-sourceEyeY,target.z-actor.z)<=URCHIN_SKILLS.lanceRange+1e-8 : type.startsWith('urchin-') ? feetDistance(actor,target)<=(type==='urchin-jam'?URCHIN_SKILLS.jamRange:type==='urchin-disarm'?URCHIN_SKILLS.disarmRange:1e-8)+1e-8 : type.startsWith('cap-') ? feetDistance(actor,target)<=(type==='cap-lock'?CAP_SKILLS.lockRange:type==='cap-clean'?CAP_SKILLS.cleanRange:1e-8)+1e-8 : type.startsWith('japan-') ? feetDistance(actor,target)<=(type==='japan-border'?JAPAN_SKILLS.borderRange:type==='japan-levy'?JAPAN_SKILLS.levyRange:1e-8)+1e-8 : type.startsWith('nobi-') ? feetDistance(actor,target)<=(type==='nobi-tag'?NOBI_SKILLS.tagRange:type==='nobi-brake'?NOBI_SKILLS.brakeRange:1e-8)+1e-8 : type.startsWith('car-') ? feetDistance(actor,target)<=(type==='car-bumper'?CAR_SKILLS.bumperRange:type==='car-wash'?CAR_SKILLS.washRange:1e-8)+1e-8 : type.startsWith('cat-') ? feetDistance(actor,target) <= (type==='cat-return'?CAT_SKILLS.returnRange:type==='cat-pluck'?CAT_SKILLS.pluckRange:type==='cat-fetch'?CAT_SKILLS.fetchRange:1e-8)+1e-8 : type === 'duck-pad' || type === 'duck-seal' || type === 'duck-shield' ? Math.hypot(target.x-actor.x,target.y-sourceEyeY,target.z-actor.z) <= (type === 'duck-seal' ? DUCK_SKILLS.sealRange : type === 'duck-pad'?DUCK_SKILLS.padRange:DUCK_SKILLS.shieldRange)+1e-8 : type === 'duelist-comet' ? Math.hypot(target.x - actor.x, target.y - sourceEyeY, target.z - actor.z) <= DUELIST_SKILLS.cometRange + 1e-8
  : type === 'mend-heal' ? feetDistance(actor, target) <= MEND_SKILLS.healRange + 1e-8
  : personal(type) || type === 'duelist-lift' ? feetDistance(actor, target) <= 1e-8
  : type === 'veil-dust' ? Math.hypot(target.x - actor.x, target.z - actor.z) <= 1e-8 && close(target.y, (actor.y || 0) + VEIL_SKILLS.dustCenterOffset)
  : type === 'veil-roots' ? Math.hypot(target.x - actor.x, target.z - actor.z) >= VEIL_SKILLS.rootsMinRange - 1e-8 && Math.hypot(target.x - actor.x, target.z - actor.z) <= VEIL_SKILLS.rootsRange + 1e-8
  : Math.hypot(target.x - actor.x, target.z - actor.z) <= (type === 'nope-bottle' ? NOPE_SKILLS.bottleRange : type === 'nope-decoy' ? CHARACTER_SKILLS.decoyDistance : type === 'echo-tag' ? IAGNU_SKILLS.tagRange : type === 'ember-solder' ? EMBER_SKILLS.solderRange : type === 'frost-stitch' ? FROST_SKILLS.stitchRange : type === 'frost-mist' ? FROST_SKILLS.mistRange : CHARACTER_SKILLS.castDistance) + 1e-8;
const isGloomBlind = value => !!idSequence(value?.eventId, 'urchin-gloom');
const flashDuration = eventId => idSequence(eventId,'urchin-gloom') ? URCHIN_SKILLS.gloomDuration : idSequence(eventId, 'nope-flash') ? NOPE_SKILLS.flashDuration : idSequence(eventId, 'echo-glint') ? IAGNU_SKILLS.glintDuration : 0;
const safeReach = (reachable, source, target) => {
  if (typeof reachable !== 'function') return false;
  try { return reachable(source, target) === true; } catch { return false; }
};
const safeGround = (groundHeight, x, z, referenceY) => {
  if (typeof groundHeight !== 'function') return null;
  try { const y = groundHeight(x, z, referenceY); return coordinate(y) ? y : null; } catch { return null; }
};
const healEligible = (actor, target, reachable) => living(actor) && living(target) && target.team === actor.team && target.hp < 100
  && feetDistance(actor, target) <= MEND_SKILLS.healRange + 1e-8 && (target.id === actor.id || safeReach(reachable, actor, target));

export function selectMendTarget(actor, actors, reachable) {
  if (!living(actor)) return null;
  const seen = new Set(), eligible = [];
  for (const target of [actor, ...(Array.isArray(actors) ? actors : [])]) {
    if (!target || !identifier(target.id) || seen.has(target.id)) continue;
    seen.add(target.id); if (healEligible(actor, target, reachable)) eligible.push(target);
  }
  eligible.sort((a, b) => a.hp - b.hp || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const target = eligible[0]; return target ? { id: target.id, team: target.team, x: target.x, y: target.y || 0, z: target.z, hp: target.hp, alive: true } : null;
}

export function urchinGloomPosition(event,now){
  if(!event||event.type!=='urchin-gloom'||!clock(now)||![event.fromX,event.fromY,event.fromZ,event.x,event.y,event.z,event.triggerAt,event.flight].every(Number.isFinite)||event.flight<=0)return null;
  const t=Math.max(0,Math.min(1,(now-event.triggerAt)/event.flight));
  return {x:event.fromX+(event.x-event.fromX)*t,y:event.fromY+(event.y-event.fromY)*t,z:event.fromZ+(event.z-event.fromZ)*t};
}
export function skillProjectilePosition(event, now) {
  if(event?.type==='urchin-gloom')return urchinGloomPosition(event,now);
  if (!event || !isType(event.type) || !point(event) || !clock(now)) return null;
  if (specs[event.type].flight === 0) return { x: event.x, y: event.y, z: event.z };
  if (![event.fromX, event.fromY, event.fromZ].every(coordinate) || !clock(event.startedAt) || !Number.isFinite(event.flight) || event.flight <= 0) return null;
  const t = Math.max(0, Math.min(1, (now - event.startedAt) / event.flight));
  const arc = event.type === 'duelist-comet' || event.type === 'renko-dart' ? 0 : event.type === 'nope-bottle' || event.type === 'mend-seeds' ? 1.4 : .8;
  return { x: event.fromX + (event.x - event.fromX) * t,
    y: event.fromY + (event.y - event.fromY) * t + 4 * t * (1 - t) * arc,
    z: event.fromZ + (event.z - event.fromZ) * t };
}

export function createCharacterSkills() {
  let currentRound = null, currentTime = -Infinity, lastRestoreTime = -Infinity, sequence = 0;
  const active = new Map(), owned = new Set(), blinds = new Map(), detections = new Map(), decoyOwners = new Set(), decoyReactions = new Map(), borderHistory=new Map(), nearsights=new Map(), waveSamples=new Map();
  function clear() { nearsights.clear();waveSamples.clear();borderHistory.clear(); active.clear(); owned.clear(); blinds.clear(); detections.clear(); decoyOwners.clear(); decoyReactions.clear(); }
  function prune(now) {
    for (const [id, event] of active) if (event.endsAt <= now) { active.delete(id); owned.delete(id); decoyOwners.delete(id); borderHistory.delete(id);waveSamples.delete(id); }
    for (const [id, endsAt] of decoyReactions) if (endsAt <= now) decoyReactions.delete(id);
    for(const collection of [blinds,nearsights])for(const[id,blind]of collection)if(blind.endsAt<=now)collection.delete(id);
    for (const [id, marker] of detections) if (marker.endsAt <= now) detections.delete(id);
  }
  function advance(now, round = currentRound) {
    if (!clock(now) || !roundNumber(round) || currentRound !== null && (round < currentRound || round === currentRound && now < currentTime)) return false;
    if (round !== currentRound) { clear(); currentRound = round; lastRestoreTime = -Infinity; }
    currentTime = now; prune(now); return true;
  }
  function cast(effect, actor, target, now, round) {
    const type = typeof effect === 'string' ? effect : effect?.type;
    // Millimetre wire positions bound the extra camera/chain payload without
    // changing older skills. Self events round both ends identically.
    if(typeof type==='string'&&type.startsWith('onnara-')&&actor&&target){const q=v=>typeof v==='number'?Math.round(v*1000)/1000:v;actor={...actor,x:q(actor.x),y:q(actor.y||0),z:q(actor.z)};target={...target,x:q(target.x),y:q(target.y),z:q(target.z)};}

    if (!isType(type) || !living(actor) || !point(target) || !withinCastRange(type, actor, target) || !coordinate(eyeY(actor)) || !clock(now) || !roundNumber(round)) return null;
    if ((type.startsWith('veil-') || type === 'frost-unravel' || type === 'onnara-jump') && actor.grounded !== true) return null;
    if(['onnara-tax','urchin-jam','urchin-disarm'].includes(type)&&(!identifier(target.targetId)||target.targetId===actor.id))return null;
    if(['cap-lock','cap-clean'].includes(type)&&(!identifier(target.targetId)||type==='cap-lock'&&target.targetId===actor.id))return null;
    if(type==='japan-levy'&&(!identifier(target.targetId)||target.targetId===actor.id))return null;
    if(type==='japan-border'&&(!Number.isFinite(target.yaw)||Math.abs(target.yaw)>Math.PI))return null;
    if(['nobi-tag','nobi-brake'].includes(type)&&(!identifier(target.targetId)||target.targetId===actor.id))return null;
    if(type==='car-bumper'&&(!identifier(target.targetId)||target.targetId===actor.id))return null;
    if(type==='cat-pluck'&&(!identifier(target.targetId)||target.targetId===actor.id))return null;
    if (type === 'duck-seal' && (!identifier(target.targetId) || target.targetId===actor.id)) return null;
    if (type === 'duck-shield' && (!Number.isFinite(target.yaw) || Math.abs(target.yaw)>Math.PI)) return null;
    if(type==='nope-decoy'&&(target.yaw!==undefined||target.walkLength!==undefined)&&(!Number.isFinite(target.yaw)||Math.abs(target.yaw)>Math.PI||!Number.isFinite(target.walkLength)||target.walkLength<0||target.walkLength>NOPE_SKILLS.decoyWalkRange))return null;
    if (type === 'mend-heal' && !identifier(target.targetId)) return null;
    if (type === 'ember-service' && (!serviceWeapon(target.weaponId) || actor.weaponId !== target.weaponId)) return null;
    if(type==='onnara-hover'&&actor.grounded!==false)return null;
    if(type==='onnara-orb'&&(!Number.isFinite(target.yaw)||Math.abs(target.yaw)>Math.PI))return null;
    const spec = specs[type], endsAt = now + spec.delay + spec.tail;
    if (!Number.isFinite(endsAt) || !advance(now, round) || active.size >= CHARACTER_SKILLS.maxEvents || sequence >= 999999999999999) return null;
    if(type==='onnara-tax'&&[...active.values()].some(e=>e.type===type&&e.targetId===target.targetId))return null;
    if (personal(type) && [...active.values()].some(event => event.type === type && event.sourceId === actor.id)) return null;
    const event = { id: `skill-${type}-${++sequence}`, type, team: actor.team, sourceId: actor.id, round,
      fromX: actor.x, fromY: feetSource(type) ? actor.y || 0 : eyeY(actor), fromZ: actor.z, x: target.x, y: target.y, z: target.z,
      startedAt: now, flight: spec.flight, triggerAt: now + spec.delay, endsAt, radius: spec.radius };
    if(['onnara-tax','urchin-jam','urchin-disarm','cap-lock','cap-clean'].includes(type))event.targetId=target.targetId;
    if(type==='nope-decoy'&&target.walkLength!==undefined){event.yaw=target.yaw;event.walkLength=target.walkLength;}
    if(type==='onnara-tax')event.power=ONNARA_SKILLS.taxBudget;
    if(type==='onnara-orb')event.yaw=target.yaw;
    if(type==='japan-border')event.yaw=target.yaw;
    if(type==='japan-levy')event.targetId=target.targetId;
    if(['nobi-tag','nobi-brake'].includes(type))event.targetId=target.targetId;
    if(type==='car-bumper')event.targetId=target.targetId;
    if(type==='cat-pluck')event.targetId=target.targetId;
    if (type === 'duck-seal') event.targetId=target.targetId;
    if (type === 'duck-shield') {event.yaw=target.yaw;event.power=DUCK_SKILLS.shieldHP;}
    if (type === 'duck-egg') event.power=DUCK_SKILLS.eggLives;
    if (type === 'mend-heal') event.targetId = target.targetId;
    if (type === 'ember-service') event.weaponId = target.weaponId;
    if(type.startsWith('renko-')||type.startsWith('onnara-')||type.startsWith('urchin-')||type.startsWith('cap-')||type.startsWith('japan-')||type.startsWith('nobi-')||type.startsWith('car-')||type.startsWith('duck-')||type.startsWith('cat-'))owned.add(event.id);
    active.set(event.id, event); if (type === 'nope-decoy') decoyOwners.add(event.id);
    if (['nope-bottle', 'nope-flash', 'mend-heal', 'echo-tag', 'echo-glint', 'ember-solder'].includes(type)) owned.add(event.id); return copy(event);
  }
  function storeBlind(blind,near=false){
    const collection=near?nearsights:blinds;
    if(collection.has(blind.targetId)&&collection.get(blind.targetId).endsAt>=blind.endsAt)return;
    while(!collection.has(blind.targetId)&&blinds.size+nearsights.size>=CHARACTER_SKILLS.maxBlinds){
      const first=[...blinds.values(),...nearsights.values()].sort((a,b)=>a.endsAt-b.endsAt)[0];
      (isGloomBlind(first)?nearsights:blinds).delete(first.targetId);
    }
    collection.set(blind.targetId,blind);
  }
  function canReach(reachable, event, actor) {
    return safeReach(reachable, event, actor);
  }
  function facesFlash(actor, event) {
    const dx = event.x - actor.x, dy = event.y - eyeY(actor), dz = event.z - actor.z, distance = Math.hypot(dx, dy, dz);
    if (distance > event.radius) return false;
    if (distance < 1e-8) return true;
    const yaw = Number.isFinite(actor.yaw) ? actor.yaw : Number.isFinite(actor.netYaw) ? actor.netYaw : Number.isFinite(actor.group?.rotation?.y) ? actor.group.rotation.y - Math.PI : 0;
    const pitch = Number.isFinite(actor.pitch) ? Math.max(-1.35, Math.min(1.35, actor.pitch)) : 0;
    return (-Math.sin(yaw) * Math.cos(pitch) * dx + Math.sin(pitch) * dy - Math.cos(yaw) * Math.cos(pitch) * dz) / distance > CHARACTER_SKILLS.flashFacingDot;
  }
  // Read-only forecast and actual detonation share the same facing/range/ray.
  function wouldBlind(actor,event,{reachable}={}){
    return living(actor)&&event&&['nope-flash','echo-glint'].includes(event.type)&&facesFlash(actor,event)&&canReach(reachable,event,actor);
  }
  // Only locally owned E events can be broken. Restoring a snapshot never
  // grants authority to consume a decoy or create damage on a guest.
  function consumeDecoy(id, shooterTeam, now, round) {
    if (!team(shooterTeam) || !advance(now, round)) return null;
    const event = active.get(id);
    if (!event || event.type !== 'nope-decoy' || !decoyOwners.has(id) || event.team === shooterTeam) return null;
    active.delete(id); decoyOwners.delete(id); return nopeWalkPose(event,now);
  }
  // The game calls this only after its authoritative, wall-occluded shot has
  // consumed an E decoy or one compact ultimate-wave member. The reaction
  // consumes no ordinary-event slot, even when all twenty slots are occupied.
  function flashDecoy(decoy, shooter, actors, now, round, { reachable } = {}) {
    if (!decoy || decoy.type !== 'nope-decoy' || !identifier(decoy.id) || !identifier(decoy.sourceId)
      || !point(decoy) || !team(decoy.team) || !living(shooter) || decoy.team === shooter.team
      || decoy.round !== round || !clock(decoy.startedAt) || decoy.startedAt > now || !clock(decoy.endsAt) || decoy.endsAt <= now
      || !advance(now, round) || decoyReactions.has(decoy.id) || sequence >= 999999999999999) return [];
    while (decoyReactions.size >= 64) decoyReactions.delete(decoyReactions.keys().next().value);
    decoyReactions.set(decoy.id, decoy.endsAt);
    const event = { ...decoy, id: `skill-nope-flash-${++sequence}`, type: 'nope-flash', y: decoy.y + 1.55, radius: NOPE_SKILLS.flashRadius };
    const effects = [], seen = new Set();
    for (const actor of Array.isArray(actors) ? actors : []) {
      if (!living(actor) || actor.team === event.team || seen.has(actor.id)) continue;
      seen.add(actor.id);
      if (!facesFlash(actor, event) || !canReach(reachable, event, actor)) continue;
      const resisted = [...active.values()].some(other => other.type === 'ember-shade' && other.sourceId === actor.id && other.team === actor.team && now >= other.triggerAt);
      const duration = NOPE_SKILLS.flashDuration * (resisted ? EMBER_SKILLS.shadeFlashScale : 1);
      const blind = { eventId: event.id, targetId: actor.id, sourceId: event.sourceId, team: event.team, round, startedAt: now, endsAt: now + duration };
      if (resisted) blind.resisted = true;
      storeBlind(blind);
      effects.push({ type: 'blind', targetId: actor.id, sourceId: event.sourceId, duration });
    }
    return effects;
  }
  function update(actors, now, round, { reachable, projectileClear } = {}) {
    if (!advance(now, round)) return [];
    const effects = [], list = Array.isArray(actors) ? actors : [];
    for(const[id,b]of nearsights)if(!list.some(a=>living(a)&&a.id===id))nearsights.delete(id);
    // A placed tag remains after its source dies. A personal movement effect
    // ends permanently on death/removal, rather than reviving with the actor.
    // Grounded personal effects end at the first airborne sample, permanently.
    for (const [id, event] of active) if (personal(event.type)
      && !list.some(actor => living(actor) && actor.id === event.sourceId && actor.team === event.team
        && (!groundedPersonal(event.type) || actor.grounded === true)
        && (event.type !== 'ember-service' || actor.weaponId === event.weaponId))) {active.delete(id);owned.delete(id);}
    for(const[id,event]of active)if((event.type.startsWith('renko-')||event.type.startsWith('onnara-')||event.type.startsWith('urchin-')||event.type.startsWith('cap-')||event.type.startsWith('japan-')||event.type.startsWith('nobi-')||event.type.startsWith('car-')||event.type.startsWith('duck-')||event.type.startsWith('cat-'))&&(!list.some(actor=>living(actor)&&actor.id===event.sourceId&&actor.team===event.team)||['onnara-tax','urchin-jam','cap-lock','japan-levy','duck-seal','nobi-tag','nobi-brake'].includes(event.type)&&!list.some(actor=>living(actor)&&actor.id===event.targetId&&actor.team!==event.team))){active.delete(id);owned.delete(id);borderHistory.delete(id);}
    for(const e of active.values())if(e.type==='japan-border'&&owned.has(e.id)&&now>=e.triggerAt){
      let history=borderHistory.get(e.id);if(!history){history=new Map();borderHistory.set(e.id,history);}
      const nx=Math.sin(e.yaw),nz=Math.cos(e.yaw);
      for(const actor of list){if(!living(actor)||actor.team===e.team)continue;
        const dx=actor.x-e.x,dz=actor.z-e.z,side=dx*nx+dz*nz,along=dx*nz-dz*nx;
        const previous=history.get(actor.id);if(Math.abs(side)<1e-6&&previous)continue;history.set(actor.id,{side,x:actor.x,y:actor.y||0,z:actor.z,hit:previous?.hit===true});
        if(!previous||previous.hit||side*previous.side>=0||Math.abs(side-previous.side)<1e-8)continue;
        const t=previous.side/(previous.side-side),x=previous.x+(actor.x-previous.x)*t,z=previous.z+(actor.z-previous.z)*t,y=previous.y+((actor.y||0)-previous.y)*t;
        if(Math.abs((x-e.x)*nz-(z-e.z)*nx)>e.radius||y<e.y-.45||y>e.y+JAPAN_SKILLS.borderHeight||Math.hypot(actor.x-previous.x,actor.z-previous.z)>15)continue;
        if(!canReach(reachable,{...e,x,y:Math.max(e.y,y),z},actor))continue;
        history.get(actor.id).hit=true;effects.push({type:'damage',targetId:actor.id,sourceId:e.sourceId,amount:JAPAN_SKILLS.borderDamage});
      }
    }
    // Renko is a fixed, fast swept projectile. Restored events never own hits.
    for(const id of owned){const e=active.get(id);if(e?.type!=='renko-dart')continue;
      const sample=waveSamples.get(id)||{at:e.startedAt},length=Math.hypot(e.x-e.fromX,e.y-e.fromY,e.z-e.fromZ);
      if(length<1e-8){owned.delete(id);continue;}const dx=(e.x-e.fromX)/length,dy=(e.y-e.fromY)/length,dz=(e.z-e.fromZ)/length;
      const lo=Math.max(0,Math.min(length,(sample.at-e.startedAt)*RENKO_SKILLS.dartSpeed)),hi=Math.max(lo,Math.min(length,(now-e.startedAt)*RENKO_SKILLS.dartSpeed));let hit=null;
      for(const a of list){if(!living(a)||a.team===e.team)continue;const mid=(a.y||0)+.85-(a.crouch||0)*.28,along=(a.x-e.fromX)*dx+(mid-e.fromY)*dy+(a.z-e.fromZ)*dz,t=Math.max(lo,Math.min(hi,along)),p={x:e.fromX+dx*t,y:e.fromY+dy*t,z:e.fromZ+dz*t};
        if(Math.hypot(a.x-p.x,a.z-p.z)>.55||p.y<(a.y||0)-.1||p.y>(a.y||0)+1.75-(a.crouch||0)*.55)continue;
        if(typeof projectileClear!=='function'||!projectileClear({x:e.fromX,y:e.fromY,z:e.fromZ},p))continue;if(!hit||t<hit.t)hit={a,t};}
      if(hit){const horizontal=Math.hypot(dx,dz);if(horizontal>1e-6)effects.push({type:'renko-push',eventId:e.id,targetId:hit.a.id,sourceId:e.sourceId,vx:dx/horizontal*RENKO_SKILLS.launchSpeed,vz:dz/horizontal*RENKO_SKILLS.launchSpeed});owned.delete(id);active.delete(id);}
      else if(hi>=length-1e-8||typeof projectileClear!=='function'||!projectileClear({x:e.fromX,y:e.fromY,z:e.fromZ},{x:e.fromX+dx*hi,y:e.fromY+dy*hi,z:e.fromZ+dz*hi})){owned.delete(id);active.delete(id);}
      if(active.has(id))waveSamples.set(id,{at:now});else waveSamples.delete(id);
    }
    // A host-owned traveling volume hits each actor once. The wall-piercing
    // wave never reads enemy coordinates at cast or acquires authority on restore.
    for(const id of owned){const e=active.get(id);if(e?.type!=='urchin-gloom'||now<e.triggerAt)continue;
      let sample=waveSamples.get(id);if(!sample){sample={at:e.triggerAt,hit:new Set()};waveSamples.set(id,sample);}
      const a=urchinGloomPosition(e,sample.at),b=urchinGloomPosition(e,now),dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len2=dx*dx+dy*dy+dz*dz;
      for(const actor of list){if(!living(actor)||actor.id===e.sourceId||sample.hit.has(actor.id))continue;
        const along=((actor.x-e.fromX)*(e.x-e.fromX)+(eyeY(actor)-e.fromY)*(e.y-e.fromY)+(actor.z-e.fromZ)*(e.z-e.fromZ))/URCHIN_SKILLS.gloomRange;
        if(along<0||along>URCHIN_SKILLS.gloomRange)continue;
        const x=actor.x-a.x,y=eyeY(actor)-a.y,z=actor.z-a.z,t=len2?Math.max(0,Math.min(1,(x*dx+y*dy+z*dz)/len2)):0;
        if(Math.hypot(x-dx*t,y-dy*t,z-dz*t)>e.radius)continue;
        sample.hit.add(actor.id);storeBlind({eventId:e.id,targetId:actor.id,sourceId:e.sourceId,team:e.team,round,startedAt:now,endsAt:now+URCHIN_SKILLS.gloomDuration},true);
        effects.push({type:'nearsight',targetId:actor.id,sourceId:e.sourceId,duration:URCHIN_SKILLS.gloomDuration});
      }
      sample.at=now;if(now>=e.triggerAt+e.flight)owned.delete(id);
    }
    for(const id of waveSamples.keys())if(!active.has(id))waveSamples.delete(id);
    // A locally cast lane resolves once at the advertised time. Restored lanes
    // are visual only, and never gain hit authority or follow an actor.
    for(const id of owned){const e=active.get(id);if(e?.type!=='urchin-lance'||now+1e-8<e.triggerAt)continue;
      owned.delete(id);const dx=e.x-e.fromX,dy=e.y-e.fromY,dz=e.z-e.fromZ,length=Math.hypot(dx,dy,dz);if(length<1e-8)continue;
      const seen=new Set();for(const actor of list){if(!living(actor)||actor.team===e.team||seen.has(actor.id))continue;seen.add(actor.id);
        const ax=actor.x-e.fromX,ay=(actor.y||0)+1.3-Math.max(0,Math.min(1,actor.crouch||0))*.55-e.fromY,az=actor.z-e.fromZ;
        const along=(ax*dx+ay*dy+az*dz)/length;if(along<0||along>length)continue;
        if(Math.hypot(ax-dx*along/length,ay-dy*along/length,az-dz*along/length)>e.radius)continue;
        if(canReach(reachable,{...e,x:e.fromX,y:e.fromY,z:e.fromZ},actor))effects.push({type:'damage',targetId:actor.id,sourceId:e.sourceId,amount:URCHIN_SKILLS.lanceDamage});
      }
    }
    for (const id of owned) {
      const event = active.get(id); if (!event || now + 1e-8 < event.triggerAt) continue;
      if (event.type.startsWith('renko-')||event.type.startsWith('onnara-')||event.type.startsWith('urchin-')||event.type.startsWith('cap-')||event.type.startsWith('japan-')||event.type.startsWith('nobi-')||event.type.startsWith('car-')||event.type.startsWith('duck-')||event.type.startsWith('cat-')) continue;
      if (event.type === 'echo-tag') {
        const seen = new Set(), candidates = [];
        for (const actor of list) {
          if (!living(actor) || actor.team === event.team || seen.has(actor.id)) continue; seen.add(actor.id);
          const distance = Math.hypot(actor.x - event.x, actor.z - event.z);
          if (!wouldTag(actor, event, { reachable })) continue;
          candidates.push({ actor, distance });
        }
        candidates.sort((a, b) => a.distance - b.distance || (a.actor.id < b.actor.id ? -1 : a.actor.id > b.actor.id ? 1 : 0));
        if (!candidates.length) continue;
        const target = candidates[0].actor, marker = { eventId: event.id, team: event.team, round, x: target.x, y: target.y || 0, z: target.z, detectedAt: now, endsAt: now + IAGNU_SKILLS.tagRevealDuration };
        while (detections.size >= CHARACTER_SKILLS.maxMarkers) detections.delete(detections.keys().next().value);
        detections.set(event.id, marker); active.delete(id); owned.delete(id);
        effects.push({ type: 'detect', sourceId: event.sourceId, ...marker }); continue;
      }
      owned.delete(id); const seen = new Set();
      if (event.type === 'mend-heal') {
        const source = list.find(actor => actor?.id === event.sourceId), target = list.find(actor => actor?.id === event.targetId);
        if (source?.team === event.team && target?.team === event.team && healEligible(source, target, (actor, other) => canReach(reachable, { ...event, x: actor.x, y: eyeY(actor), z: actor.z }, other))) {
          effects.push({ type: 'heal', targetId: target.id, sourceId: source.id, amount: MEND_SKILLS.healAmount });
        }
        continue;
      }
      for (const actor of list) {
        if (!living(actor) || seen.has(actor.id)) continue; seen.add(actor.id);
        if (event.type === 'nope-bottle' || event.type === 'ember-solder') {
          const distance = Math.hypot(actor.x - event.x, actor.z - event.z);
          const solder = event.type === 'ember-solder', floor = event.y - (solder ? EMBER_SKILLS.solderGroundOffset : 0);
          if (actor.team === event.team || distance >= event.radius || Math.abs((actor.y || 0) - floor) > CHARACTER_SKILLS.heightTolerance || !canReach(reachable, event, actor)) continue;
          effects.push({ type: 'damage', targetId: actor.id, sourceId: event.sourceId, amount: (solder ? EMBER_SKILLS.solderDamage : NOPE_SKILLS.bottleDamage) * (1 - distance / event.radius) });
        } else if (wouldBlind(actor,event,{reachable})) {
          const resisted = [...active.values()].some(other => other.type === 'ember-shade' && other.sourceId === actor.id && other.team === actor.team && now >= other.triggerAt);
          const duration = flashDuration(event.id) * (resisted ? EMBER_SKILLS.shadeFlashScale : 1);
          const blind = { eventId: event.id, targetId: actor.id, sourceId: event.sourceId, team: event.team, round,
            startedAt: now, endsAt: now + duration };
          if (resisted) blind.resisted = true;
          storeBlind(blind);
          effects.push({ type: 'blind', targetId: actor.id, sourceId: event.sourceId, duration });
        }
      }
    }
    return effects;
  }
  // Reload ownership remains in the game. This only ends its matching visual.
  function cancelService(actorId) {
    if (!identifier(actorId)) return false;
    let removed = false;
    for (const [id, event] of active) if (event.type === 'ember-service' && event.sourceId === actorId) { active.delete(id); removed = true; }
    return removed;
  }
  const viewTime = now => clock(now) && advance(Math.max(now, currentTime));
  function events(now) { return viewTime(now) ? [...active.values()].map(copy) : []; }
  function blindUntil(actorId, now) { return identifier(actorId) && viewTime(now) ? blinds.get(actorId)?.endsAt || 0 : 0; }
  function nearsightUntil(actorId,now){return identifier(actorId)&&viewTime(now)?nearsights.get(actorId)?.endsAt||0:0;}
  function sightRange(actorId,now){return nearsightUntil(actorId,now)>now?URCHIN_SKILLS.gloomSight:Infinity;}
  function markers(observerTeam, now) { return team(observerTeam) && viewTime(now) ? [...detections.values()].filter(marker => marker.team === observerTeam).map(copy) : []; }
  function movementScale(actor, now) {
    if (!viewTime(now)) return 1;
    const alive = living(actor); let scale = 1;
    for (const [id, event] of active) {
      if (event.sourceId !== actor?.id) continue;
      if (groundedPersonal(event.type) && (!alive || actor.team !== event.team || actor.grounded !== true)) { active.delete(id); continue; }
      if (!alive || event.team !== actor.team || currentTime < event.triggerAt) continue;
      if (event.type === 'veil-turf') scale = Math.max(scale, VEIL_SKILLS.turfSpeedScale);
      if (event.type === 'echo-kerning') scale = Math.max(scale, IAGNU_SKILLS.kerningSpeedScale);
    }
    return scale;
  }
  // Apply once after combining all ground slows. This never supplies speed.
  function mitigateSlow(actor, rawSlow, now) {
    const raw = Number.isFinite(rawSlow) && rawSlow >= 0 && rawSlow <= 1 ? rawSlow : 1;
    if (!viewTime(now)) return raw;
    const alive = living(actor); let protectedNow = false;
    for (const [id, event] of active) {
      if (event.type !== 'frost-unravel' || event.sourceId !== actor?.id) continue;
      if (!alive || actor.team !== event.team || actor.grounded !== true) { active.delete(id); continue; }
      if (currentTime >= event.triggerAt) protectedNow = true;
    }
    return protectedNow ? 1 - (1 - raw) * FROST_SKILLS.unravelSlowFraction : raw;
  }
  // The existing event clock is authoritative; no new movement packet field.
  // Ground loss permanently removes the same event, including its slide phase.
  function frostSlideSpeed(actor, now) {
    if (!viewTime(now)) return 0;
    for (const [id,event] of active) {
      if (event.type !== 'frost-unravel' || event.sourceId !== actor?.id) continue;
      if (!living(actor) || actor.team !== event.team || actor.grounded !== true) { active.delete(id); continue; }
      const age=currentTime-event.triggerAt;
      if (age>=0 && age<FROST_SKILLS.slideDuration-1e-8) return FROST_SKILLS.slideStartSpeed+(FROST_SKILLS.slideEndSpeed-FROST_SKILLS.slideStartSpeed)*age/FROST_SKILLS.slideDuration;
    }
    return 0;
  }
  // Forecast and live movement share the nearest supported floor point.
  // This query never advances the event clock or grants effect ownership.
  function wouldRoot(actor, event, { reachable, groundHeight } = {}) {
    if (!living(actor) || actor.grounded !== true || event?.type !== 'veil-roots' || actor.team === event.team
      || ![event.fromX,event.fromY,event.fromZ,event.x,event.y,event.z,event.radius].every(Number.isFinite) || event.radius <= 0) return false;
    const dx = event.x - event.fromX, dz = event.z - event.fromZ, lengthSquared = dx * dx + dz * dz;
    if (lengthSquared <= 0) return false;
    const t = Math.max(0, Math.min(1, ((actor.x - event.fromX) * dx + (actor.z - event.fromZ) * dz) / lengthSquared));
    const x = event.fromX + dx * t, z = event.fromZ + dz * t, referenceY = event.fromY + (event.y - event.fromY) * t;
    if (Math.hypot(actor.x - x, actor.z - z) > event.radius) return false;
    const floor = safeGround(groundHeight, x, z, referenceY);
    if (floor === null || Math.abs(floor - referenceY) > VEIL_SKILLS.rootsHeightTolerance + 1e-8
      || Math.abs((actor.y || 0) - floor) > VEIL_SKILLS.rootsHeightTolerance + 1e-8) return false;
    return canReach(reachable, { ...event, x, y: floor, z }, actor);
  }
  // Read-only forecasts share the live radius, floor and ray predicates.
  function wouldTag(actor,event,{reachable}={}){
    return living(actor)&&event?.type==='echo-tag'&&actor.team!==event.team
      &&Math.hypot(actor.x-event.x,actor.z-event.z)<=event.radius
      &&Math.abs((actor.y||0)-(event.y-IAGNU_SKILLS.tagGroundOffset))<=CHARACTER_SKILLS.heightTolerance
      &&canReach(reachable,event,actor);
  }
  function wouldSeed(actor,event,{reachable}={}){
    return living(actor)&&event?.type==='mend-seeds'&&actor.team!==event.team
      &&Math.hypot(actor.x-event.x,actor.z-event.z)<=event.radius
      &&Math.abs((actor.y||0)-(event.y-MEND_SKILLS.seedsGroundOffset))<=CHARACTER_SKILLS.heightTolerance
      &&canReach(reachable,event,actor);
  }
  // Read-only annulus forecast uses the live supported floor and line of sight.
  function wouldStitch(actor,event,{reachable,groundHeight}={}) {
    if(!living(actor)||actor.team===event?.team)return false;
    if (event?.type === 'frost-stitch' && actor.grounded === true) {
        const dx = actor.x - event.x, dz = actor.z - event.z, distance = Math.hypot(dx, dz);
        if (distance >= FROST_SKILLS.stitchInnerRadius - 1e-8 && distance <= event.radius + 1e-8) {
          const referenceY = event.y - FROST_SKILLS.stitchGroundOffset, radius = (FROST_SKILLS.stitchInnerRadius + event.radius) / 2;
          const x = event.x + dx * radius / distance, z = event.z + dz * radius / distance;
          const projectedFloor = safeGround(groundHeight, x, z, referenceY), actorFloor = safeGround(groundHeight, actor.x, actor.z, referenceY);
          const tolerance = FROST_SKILLS.stitchHeightTolerance + 1e-8;
          if (projectedFloor !== null && actorFloor !== null && Math.abs(projectedFloor - referenceY) <= tolerance
            && Math.abs(actorFloor - referenceY) <= tolerance && Math.abs((actor.y || 0) - actorFloor) <= tolerance
            && Math.abs((actor.y || 0) - projectedFloor) <= tolerance
            && canReach(reachable, { ...event, x, y: projectedFloor, z }, actor)) return true;
        }
      }
    return false;
  }
  function speedScale(actor, now, { reachable, groundHeight } = {}) {
    if (!living(actor) || !viewTime(now)) return 1;
    let scale = 1;
    for (const event of active.values()) {
      if (actor.team === event.team || currentTime < event.triggerAt) continue;
      if (wouldSeed(actor,event,{reachable})) scale = Math.min(scale, MEND_SKILLS.seedsSpeedScale);
      if (wouldStitch(actor,event,{reachable,groundHeight})) scale = Math.min(scale,FROST_SKILLS.stitchSpeedScale);
      if (wouldRoot(actor, event, { reachable, groundHeight })) scale = Math.min(scale, VEIL_SKILLS.rootsSpeedScale);
    }
    return scale;
  }
  function nobiActive(type,id,now,target=false){return events(now).some(e=>e.type===type&&(target?e.targetId:e.sourceId)===id&&now>=e.triggerAt);}
  // Fixed landing fields; query current pose, never a tracked enemy identifier.
  function nobiField(type,id,now,actor,reachable){
    if(!living(actor)||actor.id!==id)return false;
    return events(now).some(e=>e.type===type&&now>=e.triggerAt
      && (['nobi-bell','nobi-whisker'].includes(type)?actor.team!==e.team:actor.team===e.team)
      && Math.hypot(actor.x-e.x,(actor.y||0)-(e.y-.12),actor.z-e.z)<=e.radius+1e-8
      && safeReach(reachable,e,actor));
  }
  function nobiVulnerability(id,now,actor,reachable){return nobiActive('nobi-tag',id,now,true)||nobiField('nobi-bell',id,now,actor,reachable)?NOBI_SKILLS.vulnerability:1;}
  function nobiInterval(id,now,actor,reachable){return nobiActive('nobi-brake',id,now,true)||nobiField('nobi-whisker',id,now,actor,reachable)?NOBI_SKILLS.fireIntervalScale:1;}
  function nobiWork(id,now,actor,reachable){return nobiActive('nobi-tool',id,now)||nobiField('nobi-toolbox',id,now,actor,reachable)?NOBI_SKILLS.toolScale:1;}
  function nobiLegend(id,now,actor,reachable){return nobiActive('nobi-legend',id,now)||nobiField('nobi-collar',id,now,actor,reachable);}
  function snapshot(observerTeam) { return { events: [...active.values()].map(copy), blinds: [...blinds.values(),...nearsights.values()].map(copy),
    markers: [...detections.values()].filter(marker => observerTeam === undefined || marker.team === observerTeam).map(copy) }; }
  function validEvent(value, now, round) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !isType(value.type) || !team(value.team) || !identifier(value.sourceId) || !point(value)
      || ![value.fromX, value.fromY, value.fromZ].every(coordinate) || value.round !== round || !clock(value.startedAt) || value.startedAt > now || !clock(value.triggerAt) || !clock(value.endsAt) || !idSequence(value.id, value.type)) return false;
    if(value.type==='nope-decoy'&&(!Object.keys(value).every(key=>eventFields.includes(key)||['yaw','walkLength'].includes(key))||(value.walkLength!==undefined||value.yaw!==undefined)&&(!Number.isFinite(value.yaw)||Math.abs(value.yaw)>Math.PI||!Number.isFinite(value.walkLength)||value.walkLength<0||value.walkLength>NOPE_SKILLS.decoyWalkRange)))return false;
    const spec = specs[value.type];
    if ((value.type.startsWith('renko-') || value.type.startsWith('onnara-') || value.type.startsWith('urchin-') || value.type.startsWith('cap-') || value.type.startsWith('japan-') || value.type.startsWith('nobi-') || value.type.startsWith('car-') || value.type.startsWith('cat-') || value.type.startsWith('duck-') || value.type.startsWith('duelist-') || value.type.startsWith('veil-') || value.type.startsWith('ember-') || value.type.startsWith('frost-')) && !Object.keys(value).every(key => eventFields.includes(key) || value.type==='onnara-chain'&&key==='link' || value.type==='onnara-tax'&&key==='power' || value.type==='onnara-orb'&&key==='yaw' || value.type==='japan-border'&&key==='yaw' || ['onnara-tax','urchin-jam','urchin-disarm','cap-lock','cap-clean','japan-levy'].includes(value.type)&&key==='targetId' || ['nobi-tag','nobi-brake'].includes(value.type)&&key==='targetId' || value.type==='car-bumper'&&key==='targetId' || value.type==='cat-pluck'&&key==='targetId' || value.type === 'duck-seal' && key === 'targetId' || value.type === 'duck-shield' && ['yaw','power'].includes(key) || value.type === 'duck-egg' && key === 'power' || value.type === 'ember-service' && key === 'weaponId')) return false;
    if (['onnara-tax','urchin-jam','urchin-disarm','cap-lock','cap-clean','japan-levy','nobi-tag','nobi-brake','mend-heal','duck-seal','cat-pluck','car-bumper'].includes(value.type) ? !identifier(value.targetId) : value.targetId !== undefined) return false;
    if (value.type === 'ember-service' ? !serviceWeapon(value.weaponId) : value.weaponId !== undefined) return false;
    if(['onnara-tax','urchin-jam','urchin-disarm','cap-lock','japan-levy','nobi-tag','nobi-brake','duck-seal','cat-pluck','car-bumper'].includes(value.type)&&value.targetId===value.sourceId)return false;
    if(value.type==='onnara-chain'&&value.link!==undefined&&(!Array.isArray(value.link)||value.link.length!==7||!value.link.slice(0,6).every(coordinate)||!clock(value.link[6])||value.link[6]<value.startedAt||value.link[6]>now||Math.hypot(value.link[0]-value.link[3],value.link[1]-value.link[4],value.link[2]-value.link[5])>ONNARA_SKILLS.chainRange+.01))return false;
    if(value.type==='onnara-tax'&&(!Number.isSafeInteger(value.power)||value.power<0||value.power>ONNARA_SKILLS.taxBudget))return false;
    if(value.type==='onnara-orb'&&(!Number.isFinite(value.yaw)||Math.abs(value.yaw)>Math.PI))return false;
    if(value.type==='japan-border'&&(!Number.isFinite(value.yaw)||Math.abs(value.yaw)>Math.PI))return false;
    if(value.type==='duck-shield'&&(!Number.isFinite(value.yaw)||Math.abs(value.yaw)>Math.PI||!Number.isFinite(value.power)||value.power<=0||value.power>DUCK_SKILLS.shieldHP))return false;
    if(value.type==='duck-egg'&&(!Number.isInteger(value.power)||value.power<1||value.power>DUCK_SKILLS.eggLives))return false;
    return value.flight === spec.flight && value.radius === spec.radius && withinCastRange(value.type, { x: value.fromX, y: value.fromY, z: value.fromZ }, value, value.fromY)
      && close(value.triggerAt, value.startedAt + spec.delay) && close(value.endsAt, value.triggerAt + spec.tail);
  }
  function validBlind(value, now, round) {
    return value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).every(key => ['eventId', 'targetId', 'sourceId', 'team', 'round', 'startedAt', 'endsAt', 'resisted'].includes(key))
      && (!Object.hasOwn(value, 'resisted') || value.resisted === true&&!isGloomBlind(value))
      && flashDuration(value.eventId) > 0 && identifier(value.targetId) && identifier(value.sourceId) && team(value.team)
      && (!isGloomBlind(value)||value.targetId!==value.sourceId)
      && value.round === round && clock(value.startedAt) && value.startedAt <= now && clock(value.endsAt)
      && close(value.endsAt, value.startedAt + flashDuration(value.eventId) * (value.resisted === true ? EMBER_SKILLS.shadeFlashScale : 1));
  }
  function validMarker(value, now, round) {
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => ['eventId', 'team', 'round', 'x', 'y', 'z', 'detectedAt', 'endsAt'].includes(key))
      && idSequence(value.eventId, 'echo-tag') && team(value.team) && value.round === round && point(value) && clock(value.detectedAt) && value.detectedAt <= now
      && clock(value.endsAt) && close(value.endsAt, value.detectedAt + IAGNU_SKILLS.tagRevealDuration);
  }
  function restore(value, now, round) {
    if (!clock(now) || !roundNumber(round) || !value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.events) || !Array.isArray(value.blinds)
      || value.events.length > CHARACTER_SKILLS.maxEvents || value.blinds.length > CHARACTER_SKILLS.maxBlinds || value.markers !== undefined && !Array.isArray(value.markers)
      || (value.markers?.length || 0) > CHARACTER_SKILLS.maxMarkers) return false;
    const nextEvents = new Map(), nextBlinds = new Map(), nextMarkers = new Map(); let nextSequence = sequence;
    for (const event of value.events) {
      if (!validEvent(event, now, round) || nextEvents.has(event.id)) return false;
      if ((groundedPersonal(event.type) || (event.type.startsWith('renko-')||event.type.startsWith('onnara-')||event.type.startsWith('urchin-')||event.type.startsWith('cap-')||event.type.startsWith('japan-') || event.type.startsWith('nobi-') || event.type.startsWith('car-') || event.type.startsWith('ember-') || event.type.startsWith('cat-')) && personal(event.type)) && [...nextEvents.values()].some(other => other.type === event.type && other.sourceId === event.sourceId)) return false;
      if(event.type==='onnara-tax'&&[...nextEvents.values()].some(other=>other.type===event.type&&other.targetId===event.targetId))return false;
      const clean = { id: event.id, type: event.type, team: event.team, sourceId: event.sourceId, round, fromX: event.fromX, fromY: event.fromY, fromZ: event.fromZ,
        x: event.x, y: event.y, z: event.z, startedAt: event.startedAt, flight: event.flight, triggerAt: event.triggerAt, endsAt: event.endsAt, radius: event.radius };
      if(event.type==='onnara-chain'&&event.link)clean.link=[...event.link];
      if(event.type==='nope-decoy'&&event.walkLength!==undefined){clean.yaw=event.yaw;clean.walkLength=event.walkLength;}
      if(event.type==='onnara-tax')clean.power=event.power;
      if(event.type==='onnara-orb')clean.yaw=event.yaw;
      if(event.type==='japan-border')clean.yaw=event.yaw;
      if(['onnara-tax','urchin-jam','urchin-disarm','cap-lock','cap-clean','japan-levy','nobi-tag','nobi-brake','car-bumper'].includes(event.type))clean.targetId=event.targetId;
      if(event.type==='cat-pluck')clean.targetId=event.targetId;
      if(event.type==='duck-seal')clean.targetId=event.targetId;
      if(event.type==='duck-shield'){clean.yaw=event.yaw;clean.power=event.power;}
      if(event.type==='duck-egg')clean.power=event.power;
      if (event.type === 'mend-heal') clean.targetId = event.targetId;
      if (event.type === 'ember-service') clean.weaponId = event.weaponId;
      nextEvents.set(clean.id, clean); nextSequence = Math.max(nextSequence, idSequence(clean.id, clean.type));
    }
    for (const blind of value.blinds) {
      const key=JSON.stringify([blind.targetId,isGloomBlind(blind)]);
      if (!validBlind(blind, now, round) || nextBlinds.has(key)) return false;
      const clean = { eventId: blind.eventId, targetId: blind.targetId, sourceId: blind.sourceId, team: blind.team, round, startedAt: blind.startedAt, endsAt: blind.endsAt };
      if (blind.resisted === true) clean.resisted = true;
      nextBlinds.set(key, clean);
      nextSequence = Math.max(nextSequence, idSequence(blind.eventId, 'nope-flash'), idSequence(blind.eventId, 'echo-glint'),idSequence(blind.eventId,'urchin-gloom'));
    }
    for (const marker of value.markers || []) {
      if (!validMarker(marker, now, round) || nextMarkers.has(marker.eventId) || nextEvents.has(marker.eventId)) return false;
      nextMarkers.set(marker.eventId, { eventId: marker.eventId, team: marker.team, round, x: marker.x, y: marker.y, z: marker.z, detectedAt: marker.detectedAt, endsAt: marker.endsAt });
      nextSequence = Math.max(nextSequence, idSequence(marker.eventId, 'echo-tag'));
    }
    // The render clock may lead the host. Compare restore order only with the
    // previous host clock, while retaining monotonic expiry on this client.
    if (currentRound !== null && (round < currentRound || round === currentRound && now < lastRestoreTime)) return false;
    currentTime = round === currentRound ? Math.max(currentTime, now) : now; currentRound = round; lastRestoreTime = now; sequence = nextSequence;
    clear();
    for (const [id, event] of nextEvents) if (event.endsAt > currentTime) active.set(id, event);
    for (const blind of nextBlinds.values()) if (blind.endsAt > currentTime) (isGloomBlind(blind)?nearsights:blinds).set(blind.targetId,blind);
    for (const [id, marker] of nextMarkers) if (marker.endsAt > currentTime) detections.set(id, marker);
    return true;
  }
  function carGyro(actorId,now){return identifier(actorId)&&viewTime(now)&&[...active.values()].some(e=>e.type==='car-gyro'&&e.sourceId===actorId);}
  function disperseSmoke(castId,fieldId,now,round){if(!advance(now,round)||!owned.has(castId)||active.get(castId)?.type!=='car-wash')return false;const e=active.get(fieldId);if(!e||!['duelist-comet','mend-pollen','veil-dust','frost-mist'].includes(e.type))return false;active.delete(fieldId);owned.delete(fieldId);owned.delete(castId);return true;}
  function cancelCarEvent(id){if(!owned.has(id)||!active.get(id)?.type.startsWith('car-'))return false;active.delete(id);owned.delete(id);return true;}
  function catBookmark(actorId,now){if(!identifier(actorId)||!viewTime(now))return null;const e=[...active.values()].find(e=>e.type==='cat-bookmark'&&e.sourceId===actorId);return e?copy(e):null;}
  function returnToCatBookmark(id,actor,now,round){
    if(!advance(now,round)||!owned.has(id))return null;
    const bookmark=active.get(id);if(bookmark?.type!=='cat-bookmark'||bookmark.sourceId!==actor?.id||bookmark.team!==actor?.team)return null;
    active.delete(id);owned.delete(id);
    const event=cast('cat-return',actor,bookmark,now,round);
    if(!event){active.set(id,bookmark);owned.add(id);}return event;
  }
  function cancelCatEvent(id){if(!owned.has(id)||!active.get(id)?.type.startsWith('cat-'))return false;active.delete(id);owned.delete(id);return true;}
  function clockFrozen(now){return !!viewTime(now)&&[...active.values()].some(e=>e.type==='cat-clock');}
  function sealUntil(actorId,now){if(!identifier(actorId)||!viewTime(now))return 0;let until=0;for(const e of active.values())if(e.type==='duck-seal'&&e.targetId===actorId)until=Math.max(until,e.endsAt);return until;}
  function quiet(actorId,now){return identifier(actorId)&&viewTime(now)&&[...active.values()].some(e=>e.type==='duck-hush'&&e.sourceId===actorId&&currentTime<e.startedAt+DUCK_SKILLS.hushDuration);}
  function guardLethal(actorId,now,round){
    if(!identifier(actorId)||!advance(now,round))return false;
    for(const[id,e]of active)if(e.type==='duck-egg'&&e.sourceId===actorId&&owned.has(id)&&e.power>0){if(--e.power===0){active.delete(id);owned.delete(id);}return true;}return false;
  }
  // Analytic thin plane; never a solid collider or visual occluder. Guests query
  // but cannot consume HP on restored events. Nearest shield always wins.
  function interceptShield(origin,aim,maxDistance,damage,now,round,{consume=true}={}){
    if(!point(origin)||!point(aim)||!Number.isFinite(maxDistance)||maxDistance<=0||!Number.isFinite(damage)||damage<=0||!advance(now,round))return null;
    const length=Math.hypot(aim.x,aim.y,aim.z);if(Math.abs(length-1)>1e-6)return null;let best=null;
    for(const e of active.values())if(e.type==='duck-shield'&&e.power>0){
      const nx=Math.sin(e.yaw),nz=Math.cos(e.yaw),denom=aim.x*nx+aim.z*nz;if(Math.abs(denom)<1e-8)continue;
      const distance=((e.x-origin.x)*nx+(e.z-origin.z)*nz)/denom;if(distance<.025||distance>maxDistance)continue;
      const p={x:origin.x+aim.x*distance,y:origin.y+aim.y*distance,z:origin.z+aim.z*distance};
      if(Math.abs((p.x-e.x)*nz-(p.z-e.z)*nx)>DUCK_SKILLS.shieldWidth/2||p.y<e.y||p.y>e.y+DUCK_SKILLS.shieldHeight)continue;
      if(!best||distance<best.distance)best={event:e,distance,point:p};
    }
    if(best&&consume&&owned.has(best.event.id)){best.event.power=Math.max(0,best.event.power-damage);if(!best.event.power){active.delete(best.event.id);owned.delete(best.event.id);}}
    return best?{id:best.event.id,distance:best.distance,point:best.point,power:best.event.power}:null;
  }
  function duckPad(actor,now,{groundHeight}={}){
    if(!living(actor)||actor.grounded!==true)return null;
    for(const e of events(now))if(e.type==='duck-pad'&&now>=e.triggerAt&&Math.hypot(actor.x-e.x,actor.z-e.z)<=e.radius&&Math.abs((actor.y||0)-e.y)<=.12){
      const floor=safeGround(groundHeight,actor.x,actor.z,e.y);if(floor!==null&&Math.abs(floor-e.y)<=.12)return copy(e);
    }return null;
  }
  function resetActor(id){
    for(const[key,e]of active)if(e.sourceId===id&&(personal(e.type)||/^(renko|onnara|urchin|cap|japan|nobi|car|cat|duck)-/.test(e.type))||e.targetId===id&&/^(onnara|urchin|cap|japan|nobi|duck)-/.test(e.type)){active.delete(key);owned.delete(key);borderHistory.delete(key);}
    blinds.delete(id);nearsights.delete(id);
  }
  function reset() { clear(); currentRound = null; currentTime = -Infinity; lastRestoreTime = -Infinity; }
  const hostileDebuff = (e,id,ownTeam) => e.team!==ownTeam&&e.targetId===id&&['onnara-tax','urchin-jam','cap-lock','duck-seal','nobi-tag','nobi-brake'].includes(e.type);
  function hasImpairment(id,ownTeam,now){return [...blinds.values(),...nearsights.values()].some(b=>b.targetId===id&&b.endsAt>now)||events(now).some(e=>hostileDebuff(e,id,ownTeam));}
  function cleanse(id,ownTeam,now){let removed=0;for(const collection of[blinds,nearsights])for(const[k,b]of collection)if(b.targetId===id&&b.endsAt>now){collection.delete(k);removed++;}for(const[k,e]of active)if(hostileDebuff(e,id,ownTeam)){active.delete(k);owned.delete(k);removed++;}return removed;}
  const capState=(type,id,now,target=false)=>events(now).some(e=>e.type===type&&(target?e.targetId:e.sourceId)===id);
  function consumeCrownTax(id,now,credits){
    if(!Number.isSafeInteger(credits)||credits<0)return 0;
    const e=events(now).find(e=>e.type==='onnara-tax'&&e.targetId===id&&owned.has(e.id));
    if(!e)return 0;const stored=active.get(e.id),step=Math.min(ONNARA_SKILLS.taxPerShot,stored.power),paid=Math.min(credits,step);stored.power-=step;return paid;
  }
  const onnaraEvent=(type,id,now)=>events(now).find(e=>e.type===type&&e.sourceId===id)||null;
  return {renkoEvent:(type,id,now)=>events(now).find(e=>e.type===type&&e.sourceId===id)||null,nearsightUntil,sightRange,duckPad,recordConstellation(sourceId,from,to,now){const e=events(now).find(e=>e.type==='onnara-chain'&&e.sourceId===sourceId&&owned.has(e.id));if(!e||!point(from)||!point(to)||Math.hypot(from.x-to.x,from.y-to.y,from.z-to.z)>ONNARA_SKILLS.chainRange+.001)return false;active.get(e.id).link=[from.x,from.y,from.z,to.x,to.y,to.z,now].map(n=>Math.round(n*1000)/1000);active.get(e.id).link[6]=now;return true;},cancelOnnaraEvent(id,sourceId){const e=active.get(id);if(e?.type.startsWith('onnara-')&&e.sourceId===sourceId&&owned.has(id)){active.delete(id);owned.delete(id);return true;}return false;},consumeCrownTax,onnaraTax:(id,now)=>events(now).find(e=>e.type==='onnara-tax'&&e.targetId===id)||null,onnaraEvent,urchinJammed:(id,now)=>capState('urchin-jam',id,now,true),urchinTrident:(id,now)=>capState('urchin-trident',id,now),urchinInterval:(id,now)=>capState('urchin-trident',id,now)?1/URCHIN_SKILLS.tridentFireRate:1,hasImpairment,cleanse,capLocked:(id,now)=>capState('cap-lock',id,now,true),capBank:(id,now)=>capState('cap-bank',id,now),capMagazine:(id,now)=>capState('cap-magazine',id,now),resetActor,japanReturn:(id,now)=>events(now).some(e=>e.type==='japan-return'&&e.sourceId===id)?JAPAN_SKILLS.returnScale:0,nobiVulnerability,nobiInterval,nobiWork,nobiLegend,carGyro,disperseSmoke,cancelCarEvent,catBookmark,returnToCatBookmark,cancelCatEvent,clockFrozen, wouldBlind, wouldRoot,wouldSeed,wouldTag,wouldStitch,sealUntil,quiet,guardLethal,interceptShield,cast, update, events, snapshot, restore, reset, blindUntil, speedScale, markers, movementScale, mitigateSlow, frostSlideSpeed, cancelService, consumeDecoy, flashDecoy };
}
