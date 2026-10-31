const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const { createCharacterSkills, skillProjectilePosition, selectMendTarget, CHARACTER_SKILLS } = await import(pathToFileURL(path.join(__dirname, 'public/character-skills.js')).href);
  const { DuelistKit, DUELIST, DUELIST_SKILLS, MEND_SKILLS, IAGNU_SKILLS, VEIL_SKILLS, EMBER_SKILLS, FROST_SKILLS } = await import(pathToFileURL(path.join(__dirname, 'public/abilities.js')).href);
  const actor = (id = 'caster', team = 'blue', x = 0, z = 0, extra = {}) => ({ id, team, x, y: 0, z, hp: 100, alive: true, yaw: 0, ...extra });
  const target = (x = 0, z = -5, y = 0) => ({ x, y, z });
  const json = value => JSON.parse(JSON.stringify(value));
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, message || `${actual} != ${expected}`);
  const allReach = { reachable: () => true };
  let passed = 0;
  function test(name, fn) { fn(); passed++; console.log(`PASS: ${name}`); }

  test('casts use canonical bounded data, unique IDs, strict actors, and separate six-meter decoy range', () => {
    const skills = createCharacterSkills(), owner = actor();
    const bottle = skills.cast({ type: 'nope-bottle', radius: 900 }, owner, target(0, -20), 5, 1);
    assert.ok(bottle); assert.equal(bottle.radius, 8); assert.equal(bottle.flight, .55); assert.equal(bottle.triggerAt, 6); near(bottle.endsAt, 6.6);
    assert.equal(bottle.fromY, 1.7); assert.equal(bottle.round, 1); assert.equal(bottle.sourceId, owner.id);
    assert.equal(skills.cast('nope-bottle', owner, target(0, -40.001), 5, 1), null);
    assert.equal(skills.cast('nope-decoy', owner, target(0, -6.001), 5, 1), null);
    const decoy = skills.cast('nope-decoy', owner, target(0, -6), 5, 1); assert.ok(decoy); assert.notEqual(decoy.id, bottle.id);
    assert.equal(decoy.endsAt, 17); assert.equal(decoy.flight, 0); assert.equal(decoy.radius, 0);
    for (const bad of [{ ...owner, alive: false }, { ...owner, hp: 0 }, { ...owner, hp: 1000.01 }, { ...owner, hp: '100' },
      { ...owner, team: 'enemy' }, { ...owner, id: '' }, { ...owner, id: 'x'.repeat(65) }, { ...owner, x: NaN }, { ...owner, y: Infinity }]) {
      assert.equal(skills.cast('nope-bottle', bad, target(), 5, 1), null);
    }
    for (const bad of [{ x: 0, z: -5 }, { x: '0', y: 0, z: -5 }, target(NaN), target(0, Infinity), target(0, 0, 1001)]) assert.equal(skills.cast('nope-bottle', owner, bad, 5, 1), null);
    for (const type of ['constructor', '__proto__', null, {}, 'smoke']) assert.equal(skills.cast(type, owner, target(), 5, 1), null);
    for (const time of [NaN, Infinity, -1, '5']) assert.equal(skills.cast('nope-bottle', owner, target(), time, 1), null);
    for (const round of [0, 1.5, '1', NaN]) assert.equal(skills.cast('nope-bottle', owner, target(), 5, round), null);
    assert.equal(skills.cast('nope-flash', { ...owner, crouch: 1 }, target(), 5, 1).fromY, 1.15);
  });

  test('the shared analytic projectile curve reaches a fixed endpoint independently of frame cadence', () => {
    for (const [type, flight, arc] of [['nope-bottle', .55, 1.4], ['nope-flash', .45, .8]]) {
      const skills = createCharacterSkills(), owner = actor(), event = skills.cast(type, owner, target(4, -8, 1), 2, 1);
      assert.deepEqual(skillProjectilePosition(event, 1), { x: 0, y: 1.7, z: 0 });
      const middle = skillProjectilePosition(event, 2 + flight / 2); near(middle.x, 2); near(middle.z, -4); near(middle.y, (1.7 + 1) / 2 + arc);
      const arrival = skillProjectilePosition(event, 2 + flight); near(arrival.x, 4); near(arrival.y, 1); near(arrival.z, -8);
      assert.deepEqual(skillProjectilePosition(event, 50), { x: 4, y: 1, z: -8 });
      for (const hz of [20, 60, 144]) {
        for (let n = 0; n < hz; n++) skillProjectilePosition(event, 2 + n / hz);
        assert.deepEqual(skillProjectilePosition(event, 2 + flight / 2), middle);
      }
      owner.x = 30; owner.z = 50; assert.deepEqual(skillProjectilePosition(event, 50), { x: 4, y: 1, z: -8 });
    }
    assert.equal(skillProjectilePosition(null, 1), null); assert.equal(skillProjectilePosition({ type: 'nope-bottle', x: 0, y: 0, z: 0 }, 1), null);
  });

  test('bottle fuse samples once, falls off with distance, respects cover and height, and never damages friends or dead actors', () => {
    const skills = createCharacterSkills(), owner = actor(); skills.cast('nope-bottle', owner, target(0, -5), 0, 1);
    const enemies = [actor('center', 'red', 0, -5), actor('half', 'red', 4, -5), actor('edge', 'red', 8, -5),
      actor('above', 'red', 0, -5, { y: 2.5 }), actor('too-high', 'red', 0, -5, { y: 2.501 }),
      actor('blocked', 'red', 0, -5), actor('dead', 'red', 0, -5, { hp: 0, alive: false }), actor('friend', 'blue', 0, -5)];
    assert.deepEqual(skills.update(enemies, .999999, 1, allReach), []);
    const hits = skills.update([...enemies, enemies[0], owner], 1, 1, { reachable: (event, other) => {
      assert.equal(event.x, 0); assert.equal(event.z, -5); return other.id !== 'blocked';
    } });
    assert.deepEqual(hits.map(hit => hit.targetId), ['center', 'half', 'above']);
    near(hits[0].amount, 90); near(hits[1].amount, 45); near(hits[2].amount, 90);
    for (const hit of hits) { assert.equal(hit.type, 'damage'); assert.equal(hit.sourceId, 'caster'); }
    assert.equal(enemies[0].hp, 100, 'Only the host game damage helper applies armor, kills and HP');
    assert.deepEqual(skills.update(enemies, 1, 1, allReach), []); assert.deepEqual(skills.update(enemies, 1.1, 1, allReach), []);
    assert.equal(skills.events(1.6).length, 0);
    for (const reachable of [undefined, () => false, () => { throw Error('wall query'); }]) {
      const blocked = createCharacterSkills(); blocked.cast('nope-bottle', owner, target(), 0, 1);
      assert.deepEqual(blocked.update([enemies[0]], 1, 1, { reachable }), []);
    }
    const late = createCharacterSkills(); late.cast('nope-bottle', owner, target(), 0, 1); assert.deepEqual(late.update(enemies, 5, 1, allReach), []);
  });

  test('flash needs visible facing eyes but intentionally includes the caster and teammates', () => {
    const skills = createCharacterSkills(), owner = actor(), flash = skills.cast('nope-flash', owner, target(0, -5, 1.7), 0, 1);
    const observers = [owner, actor('enemy', 'red'), actor('friend', 'blue'), actor('away', 'red', 0, 0, { yaw: Math.PI }),
      actor('blocked', 'red'), actor('edge', 'red', 0, 25), actor('too-far', 'red', 0, 25.001),
      actor('dead', 'red', 0, 0, { alive: false, hp: 0 }), actor('side', 'red', 0, 0, { yaw: Math.PI / 2 })];
    assert.deepEqual(skills.update(observers, .449, 1, allReach), []);
    const hits = skills.update(observers, .45, 1, { reachable: (_, other) => other.id !== 'blocked' });
    assert.deepEqual(hits.map(hit => hit.targetId), ['caster', 'enemy', 'friend', 'edge']);
    for (const hit of hits) { assert.equal(hit.type, 'blind'); assert.equal(hit.duration, 2.4); assert.equal(hit.sourceId, 'caster'); assert.equal(skills.blindUntil(hit.targetId, .45), 2.85); }
    assert.deepEqual(skills.update(observers, .46, 1, allReach), []);
    assert.equal(skills.events(flash.endsAt).length, 0); assert.equal(skills.blindUntil('enemy', 1), 2.85, 'Blind state survives the short visual burst');
    assert.equal(skills.blindUntil('enemy', 2.85), 0);
    assert.equal(observers[1].hp, 100);
  });

  test('flash facing derives bot and remote aim, pitch and crouched eye height rather than wall knowledge', () => {
    const skills = createCharacterSkills(), owner = actor(); skills.cast('nope-flash', owner, target(0, -5, 1.15), 0, 1);
    const bot = actor('bot', 'red', 0, 0, { yaw: undefined, group: { rotation: { y: Math.PI } }, crouch: 1 });
    const remote = actor('remote', 'red', 0, 0, { yaw: undefined, netYaw: 0, crouch: 1 });
    const skyward = actor('skyward', 'red', 0, 0, { pitch: 1.35 });
    assert.deepEqual(skills.update([bot, remote, skyward], .45, 1, allReach).map(hit => hit.targetId), ['bot', 'remote']);
    const again = createCharacterSkills(); again.cast('nope-flash', owner, target(0, -5, 1.7), 0, 1);
    assert.deepEqual(again.update([remote], .45, 1), [], 'No LOS callback fails closed');
  });

  test('overlapping flash keeps the later expiry; decoy is stationary and cannot create gameplay hits', () => {
    const skills = createCharacterSkills(), owner = actor(), enemy = actor('enemy', 'red');
    skills.cast('nope-flash', owner, target(0, -5, 1.7), 0, 1); skills.update([enemy], .45, 1, allReach);
    skills.cast('nope-flash', owner, target(0, -5, 1.7), .5, 1); skills.update([enemy], .95, 1, allReach);
    near(skills.blindUntil('enemy', 1), 3.35);
    const decoy = skills.cast('nope-decoy', owner, target(0, -5), 1, 1); owner.x = 10;
    assert.deepEqual(skillProjectilePosition(decoy, 4), { x: 0, y: 0, z: -5 });
    assert.deepEqual(skills.update([enemy], 4, 1, allReach), []); assert.equal(skills.events(12.999999).length, 1);
    assert.equal(skills.events(13).length, 0); assert.equal(skills.blindUntil('enemy', 13), 0);
  });

  test('JSON guests render current events and blindness without ever sampling damage, including repeated snapshots', () => {
    const host = createCharacterSkills(), guest = createCharacterSkills(), owner = actor(), enemy = actor('enemy', 'red', 0, -5);
    host.cast('nope-bottle', owner, target(), 0, 1); host.cast('nope-flash', owner, target(0, -5, 1.7), 0, 1);
    host.update([owner], .45, 1, allReach);
    const packet = json(host.snapshot()); assert.equal(guest.restore(packet, .45, 1), true);
    assert.deepEqual(guest.events(.6), host.events(.6)); assert.equal(guest.blindUntil('caster', .6), 2.85);
    assert.equal(guest.restore(packet, .45, 1), true);
    assert.deepEqual(guest.update([enemy], 1.5, 1, allReach), []);
    assert.equal(host.update([enemy], 1.5, 1, allReach)[0].type, 'damage');
    assert.equal(guest.restore(json(host.snapshot()), 1.5, 1), true); assert.deepEqual(guest.update([enemy], 1.51, 1, allReach), []);
    assert.equal(guest.restore(packet, .45, 1), false, 'An older host clock cannot revive an expired effect');
  });

  test('strict snapshots reject forged geometry, timers, IDs, limits and duplicate records atomically', () => {
    const host = createCharacterSkills(); host.cast('nope-flash', actor(), target(0, -5, 1.7), 0, 1); host.update([actor()], .45, 1, allReach);
    const good = json(host.snapshot()), guest = createCharacterSkills(); assert.equal(guest.restore(good, .45, 1), true);
    const cases = [null, [], {}, { events: [], blinds: null }, { events: Array(21).fill(good.events[0]), blinds: [] }, { events: [], blinds: Array(21).fill(good.blinds[0]) }];
    for (const [key, value] of [['radius', 10], ['flight', .4], ['x', NaN], ['y', '1.7'], ['z', 50], ['fromY', Infinity], ['triggerAt', .5],
      ['endsAt', 30], ['round', 2], ['startedAt', 1], ['id', 'skill-nope-flash-0'], ['sourceId', ''], ['team', 'other'], ['type', 'constructor']]) {
      const mutated = json(good); mutated.events[0][key] = value; cases.push(mutated);
    }
    for (const [key, value] of [['endsAt', 50], ['round', 2], ['targetId', ''], ['startedAt', 1], ['eventId', 'skill-nope-bottle-1']]) {
      const mutated = json(good); mutated.blinds[0][key] = value; cases.push(mutated);
    }
    cases.push({ events: [good.events[0], good.events[0]], blinds: [] }); cases.push({ events: [], blinds: [good.blinds[0], good.blinds[0]] });
    for (const invalid of cases) { const before = guest.snapshot(); assert.equal(guest.restore(invalid, .45, 1), false); assert.deepEqual(guest.snapshot(), before); }
    good.events[0].x = 900; good.blinds[0].targetId = 'injected'; assert.notEqual(guest.snapshot().events[0].x, 900); assert.equal(guest.blindUntil('injected', .45), 0);
  });

  test('host-clock ordering is independent of a leading render clock, while expired markers never revive', () => {
    const host = createCharacterSkills(), guest = createCharacterSkills(); host.cast('nope-decoy', actor(), target(0, -5), 0, 1);
    assert.equal(guest.restore(json(host.snapshot()), .1, 1), true); assert.equal(guest.events(5).length, 1);
    assert.equal(guest.restore(json(host.snapshot()), .2, 1), true, 'New host data is accepted even when rendering is ahead');
    assert.equal(guest.events(12).length, 0); assert.equal(guest.restore(json(host.snapshot()), .3, 1), true); assert.equal(guest.events(12).length, 0);
    assert.equal(guest.restore(json(host.snapshot()), .25, 1), false);
    assert.equal(guest.restore({ events: [], blinds: [] }, 0, 2), true); assert.equal(guest.restore(json(host.snapshot()), 13, 1), false);
    assert.equal(guest.events(0).length, 0);
    host.reset(); const newer = host.cast('nope-flash', actor(), target(0, -5, 1.7), 0, 3); host.update([actor()], .45, 3, allReach);
    assert.equal(guest.restore(json(host.snapshot()), .45, 3), true); assert.equal(guest.blindUntil('caster', 3), 0);
    assert.equal(guest.restore(json(host.snapshot()), .5, 3), true); assert.equal(guest.blindUntil('caster', 3), 0);
    assert.ok(newer.id.endsWith('-2'), 'Reset preserves the host sequence to prevent rejoin ID reuse');
  });

  test('rounds, resets, detached snapshots and fixed caps clean up ownership without unbounded state', () => {
    const skills = createCharacterSkills(), owner = actor();
    for (let n = 0; n < 30; n++) skills.cast('nope-decoy', owner, target(0, -5), 0, 1);
    assert.equal(skills.snapshot().events.length, CHARACTER_SKILLS.maxEvents);
    assert.ok(skills.snapshot().events[0].id.endsWith('-1'), 'Capacity rejects new events instead of silently removing existing gameplay');
    const copied = skills.events(0); copied[0].x = 900; copied.push({}); assert.equal(skills.snapshot().events.length, 20); assert.notEqual(skills.snapshot().events[0].x, 900);
    assert.deepEqual(skills.update([], 0, 2, allReach), []); assert.equal(skills.events(0).length, 0); assert.equal(skills.cast('nope-decoy', owner, target(), 0, 1), null);
    skills.cast('nope-flash', owner, target(0, -5, 1.7), 0, 2);
    const enemies = Array.from({ length: 30 }, (_, n) => actor(`enemy-${n}`, 'red'));
    assert.equal(skills.update(enemies, .45, 2, allReach).length, 30); assert.equal(skills.snapshot().blinds.length, CHARACTER_SKILLS.maxBlinds);
    assert.equal(skills.blindUntil('enemy-0', .45), 0); assert.equal(skills.blindUntil('enemy-29', .45), 2.85);
    skills.reset(); assert.deepEqual(skills.snapshot(), { events: [], blinds: [], markers: [] }); assert.equal(skills.blindUntil('enemy-29', 0), 0);
    const next = skills.cast('nope-bottle', owner, target(), 0, 1); assert.ok(next.id.endsWith('-22'));
    assert.deepEqual(skills.update([actor('new-enemy', 'red', 0, -5)], 1.5, 1, allReach).map(hit => hit.amount), [90]);
  });
  test('MEND selects the lowest injured living ally deterministically within eighteen 3D meters and visible cover', () => {
    const owner = actor(), allies = [actor('b', 'blue', 1, 0, { hp: 20 }), actor('a', 'blue', 2, 0, { hp: 20 }),
      actor('enemy', 'red', 0, 0, { hp: 1 }), actor('dead', 'blue', 0, 0, { hp: 0, alive: false }),
      actor('far', 'blue', 17, 0, { y: 6, hp: 1 }), actor('hidden', 'blue', 0, 0, { hp: 1 }),
      actor('bad', 'blue', 0, 0, { hp: NaN }), actor('infinite', 'blue', 0, 0, { y: Infinity, hp: 1 })];
    const reachable = (_, other) => other.id !== 'hidden';
    const selected = selectMendTarget(owner, [...allies, allies[1]], reachable);
    assert.equal(selected.id, 'a'); selected.hp = 99; selected.x = 900; assert.equal(allies[1].hp, 20); assert.equal(allies[1].x, 2);
    assert.equal(selectMendTarget(owner, [...allies].reverse(), reachable).id, 'a');
    const edge = actor('edge', 'blue', 0, 0, { y: 18, hp: 10 });
    assert.equal(selectMendTarget(owner, [edge], () => true).id, 'edge'); edge.y = 18.0001;
    assert.equal(selectMendTarget(owner, [edge], () => true), null);
    for (const reach of [undefined, () => false, () => { throw Error('occluded'); }]) {
      assert.equal(selectMendTarget(owner, allies, reach), null);
      const self = { ...owner, hp: 40 }; assert.equal(selectMendTarget(self, allies, reach).id, 'caster', 'Self healing requires no wall query');
    }
    for (const bad of [{ ...owner, alive: false }, { ...owner, hp: 0 }, { ...owner, hp: 1000.01 }, { ...owner, x: NaN }, { ...owner, id: '' }]) assert.equal(selectMendTarget(bad, allies, () => true), null);
  });

  test('MEND no-target precheck preserves the free signature, while a valid cast consumes exactly one eighteen-second charge', () => {
    const kit = new DuelistKit({ character: 'mend' }), skills = createCharacterSkills(), owner = actor(), before = kit.snapshot();
    const none = selectMendTarget(owner, [actor('enemy', 'red', 1, 0, { hp: 10 })], () => true);
    if (none) skills.cast(kit.activate('e', 2), owner, { ...none, targetId: none.id }, 2, 1);
    assert.equal(none, null); assert.deepEqual(kit.snapshot(), before); assert.equal(skills.events(2).length, 0);
    const ally = actor('friend', 'blue', 6, 0, { hp: 80, armor: 50 }), selected = selectMendTarget(owner, [ally], () => true);
    const effect = kit.activate('e', 2); assert.equal(effect.type, 'mend-heal'); assert.equal(kit.nextSignatureAt, 20);
    const event = skills.cast(effect, owner, { ...selected, targetId: selected.id }, 2, 1); assert.equal(event.targetId, 'friend'); assert.equal(event.fromY, 0);
    assert.equal(event.endsAt, 2.8); assert.deepEqual(skillProjectilePosition(event, 2.3), { x: 6, y: 0, z: 0 });
    assert.deepEqual(skills.update([owner, ally], 2, 1, allReach), [{ type: 'heal', targetId: 'friend', sourceId: 'caster', amount: 60 }]);
    assert.equal(ally.hp, 80); assert.equal(ally.armor, 50, 'The engine never writes HP or armor');
    assert.deepEqual(skills.update([owner, ally], 2.1, 1, allReach), []); assert.equal(kit.activate('e', 19.999999), null); kit.tick(20); assert.equal(kit.dash, 1);
  });

  test('MEND seeds slow only exposed enemies after arrival, within the exact horizontal and feet-height boundaries', () => {
    const owner = actor(), skills = createCharacterSkills(), event = skills.cast('mend-seeds', owner, target(0, -5, .12), 0, 1);
    assert.equal(event.triggerAt, .65); assert.equal(event.endsAt, 9.65); assert.equal(event.radius, 4.5);
    const center = actor('enemy', 'red', 0, -5), edge = actor('edge', 'red', 4.5, -5, { y: 2.5 }), below = actor('below', 'red', 0, -5, { y: -2.5 });
    assert.equal(skills.speedScale(center, .6499, allReach), 1); assert.equal(skills.speedScale(center, .65, allReach), .5);
    assert.equal(skills.speedScale(edge, .65, allReach), .5); assert.equal(skills.speedScale(below, .65, allReach), .5);
    for (const excluded of [{ ...edge, x: 4.5001 }, { ...edge, y: 2.5001 }, { ...below, y: -2.5001 }, { ...center, team: 'blue' },
      { ...center, alive: false, hp: 0 }, { ...center, x: NaN }]) assert.equal(skills.speedScale(excluded, .65, allReach), 1);
    for (const reachable of [undefined, () => false, () => { throw Error('wall'); }]) assert.equal(skills.speedScale(center, .65, { reachable }), 1);
    skills.cast('mend-seeds', owner, target(0, -5, .12), .65, 1);
    assert.equal(skills.speedScale(center, 1.3, allReach), .5, 'Fields do not multiply into a stronger slow');
    assert.deepEqual(skills.update([owner, center], 1.3, 1, allReach), []); assert.equal(center.hp, 100);
    assert.equal(skills.speedScale(center, 10.3, allReach), 1, 'The final active field expires at its nine-second boundary');
  });

  test('MEND projectiles use shared absolute arcs; pollen supplies a timed fixed sphere and never damage, blindness or slow', () => {
    for (const [type, flight, arc, y] of [['mend-seeds', .65, 1.4, .12], ['mend-pollen', .55, .8, 1.7]]) {
      const skills = createCharacterSkills(), owner = actor(), event = skills.cast(type, owner, target(4, -8, y), 1, 1);
      const middle = skillProjectilePosition(event, 1 + flight / 2); near(middle.x, 2); near(middle.z, -4); near(middle.y, (1.7 + y) / 2 + arc);
      const arrival = skillProjectilePosition(event, 1 + flight); near(arrival.x, 4); near(arrival.y, y); near(arrival.z, -8);
      const enemy = actor('enemy', 'red', 4, -8); assert.deepEqual(skills.update([owner, enemy], 1 + flight, 1, allReach), []);
      if (type === 'mend-pollen') {
        assert.equal(event.radius, 4.2); assert.equal(skills.speedScale(enemy, 2, allReach), 1); assert.equal(skills.blindUntil(enemy.id, 2), 0);
        assert.equal(skills.events(10.549999).length, 1); assert.equal(skills.events(10.55).length, 0);
      }
    }
  });

  test('MEND healing binds one target ID and rechecks both current actors, range and LOS without revive or retargeting', () => {
    const owner = actor(), ally = actor('friend', 'blue', 6, 0, { hp: 30, armor: 17 });
    const execute = (source, recipient, reachable = () => true, extra = []) => {
      const skills = createCharacterSkills(); assert.ok(skills.cast('mend-heal', owner, { ...target(6, 0), targetId: 'friend' }, 0, 1));
      const effects = skills.update([...(source ? [source] : []), ...(recipient ? [recipient] : []), ...extra], .1, 1, { reachable });
      assert.deepEqual(skills.update([owner, ally], .2, 1, allReach), [], 'An unsuccessful heal cannot wait for a later revive or LOS change'); return effects;
    };
    for (const recipient of [null, { ...ally, alive: false, hp: 0 }, { ...ally, hp: 100 }, { ...ally, team: 'red' }, { ...ally, y: 18 }, { ...ally, x: 18.001 }]) {
      assert.deepEqual(execute(owner, recipient, () => true, [actor('different-friend', 'blue', 1, 0, { hp: 1 })]), []);
    }
    for (const source of [null, { ...owner, alive: false, hp: 0 }, { ...owner, team: 'red' }]) assert.deepEqual(execute(source, ally), []);
    for (const reach of [() => false, () => { throw Error('wall'); }, () => 'true']) assert.deepEqual(execute(owner, ally, reach), []);
    const moved = { ...ally, x: 8, y: 3 }, crouchedSource = { ...owner, x: 1, y: 1, crouch: 1 };
    assert.deepEqual(execute(crouchedSource, moved, (event, recipient) => {
      assert.equal(event.sourceId, owner.id); assert.equal(event.targetId, ally.id); assert.equal(event.x, 1); near(event.y, 2.15); assert.equal(recipient, moved); return true;
    }), [{ type: 'heal', targetId: ally.id, sourceId: owner.id, amount: 60 }]);
    const self = { ...owner, hp: 5 }, selfSkills = createCharacterSkills();
    assert.ok(selfSkills.cast('mend-heal', self, { x: 0, y: 0, z: 0, targetId: self.id }, 0, 1));
    assert.deepEqual(selfSkills.update([self], 0, 1), [{ type: 'heal', targetId: self.id, sourceId: self.id, amount: 60 }]);
    for (const bad of [{ ...target(), targetId: '' }, { ...target(), targetId: 'x'.repeat(65) }, target(), { ...target(0, 0, 18.01), targetId: ally.id }]) assert.equal(createCharacterSkills().cast('mend-heal', owner, bad, 0, 1), null);
  });

  test('MEND JSON restores keep movement and visuals but never own healing, reject malformed target IDs atomically, and cannot rewind expiry', () => {
    const host = createCharacterSkills(), guest = createCharacterSkills(), owner = actor(), ally = actor('friend', 'blue', 4, 0, { hp: 10 }), enemy = actor('enemy', 'red', 0, -5);
    host.cast('mend-seeds', owner, target(0, -5, .12), 0, 1); host.cast('mend-pollen', owner, target(0, -5, 1.7), 0, 1);
    host.cast('mend-heal', owner, { x: 4, y: 0, z: 0, targetId: ally.id }, 0, 1); const packet = json(host.snapshot());
    assert.equal(guest.restore(packet, 0, 1), true); assert.deepEqual(guest.update([owner, ally, enemy], .1, 1, allReach), []);
    assert.equal(guest.restore(packet, .1, 1), true); assert.deepEqual(guest.update([owner, ally], .2, 1, allReach), []);
    assert.deepEqual(host.update([owner, ally], .2, 1, allReach).map(x => x.type), ['heal']);
    assert.equal(guest.speedScale(enemy, .65, allReach), .5); assert.equal(guest.events(.65).length, 3);
    const invalids = [];
    for (const [key, value] of [['targetId', ''], ['targetId', 1], ['targetId', 'x'.repeat(65)], ['targetId', 'bad\nname'], ['radius', 13], ['flight', .1], ['endsAt', 2], ['fromY', 20]]) {
      const bad = json(packet); bad.events[2][key] = value; invalids.push(bad);
    }
    const missing = json(packet); delete missing.events[2].targetId; invalids.push(missing);
    const injected = json(packet); injected.events[0].targetId = ally.id; invalids.push(injected);
    for (const bad of invalids) { const before = guest.snapshot(); assert.equal(guest.restore(bad, .65, 1), false); assert.deepEqual(guest.snapshot(), before); }
    assert.equal(guest.restore(packet, .3, 1), true, 'Render ahead does not reject newer host snapshots');
    assert.equal(guest.speedScale(enemy, .3, allReach), .5, 'Host-clock lag cannot rewind an arrived field to its flight phase');
    assert.equal(guest.events(10).length, 0); assert.equal(guest.restore(packet, .4, 1), true); assert.equal(guest.events(10).length, 0); assert.equal(guest.speedScale(enemy, 10, allReach), 1);
    assert.equal(guest.restore(packet, .35, 1), false); assert.equal(guest.restore({ events: [], blinds: [] }, 0, 2), true);
    assert.deepEqual(guest.snapshot(), { events: [], blinds: [], markers: [] }); assert.equal(guest.speedScale(enemy, 0, allReach), 1); assert.equal(guest.restore(packet, 11, 1), false);
  });

  test('mixed MEND and NOPE events retain the twenty-event cap, detached target data and reset ownership', () => {
    const skills = createCharacterSkills(), owner = actor(), types = ['mend-seeds', 'mend-pollen', 'mend-heal', 'nope-bottle', 'nope-flash', 'nope-decoy'];
    for (let n = 0; n < 30; n++) {
      const type = types[n % types.length], point = { x: 0, y: type === 'mend-seeds' ? .12 : 0, z: -5, targetId: 'friend' };
      assert.equal(Boolean(skills.cast(type, owner, point, 0, 1)), n < 20);
    }
    const packet = json(skills.snapshot()); assert.equal(packet.events.length, 20); assert.equal(packet.blinds.length, 0);
    for (const event of packet.events) assert.equal(Object.hasOwn(event, 'targetId'), event.type === 'mend-heal');
    const guest = createCharacterSkills(); assert.equal(guest.restore(packet, 0, 1), true); const copy = guest.events(0); copy[0].x = 900;
    assert.notEqual(guest.snapshot().events[0].x, 900); assert.deepEqual(guest.update([owner, actor('friend', 'blue', 0, -5, { hp: 1 })], .7, 1, allReach), []);
    skills.reset(); assert.deepEqual(skills.snapshot(), { events: [], blinds: [], markers: [] });
    const next = skills.cast('mend-seeds', owner, target(0, -5, .12), 0, 1); assert.ok(next.id.endsWith('-21'));
    assert.equal(MEND_SKILLS.healAmount, 60); assert.equal(MEND_SKILLS.seedsSpeedScale, .5);
  });
  test('IAGNU trajectories, tag arming and self-only movement have canonical constants and safe cast ranges', () => {
    const skills = createCharacterSkills(), owner = actor(), tag = skills.cast({ type: 'echo-tag', radius: 999, duration: 999 }, owner, target(0, -18, .12), 2, 1);
    assert.equal(tag.flight, .55); assert.equal(tag.radius, 4.5); near(tag.triggerAt, 3.05); near(tag.endsAt, 15.05);
    assert.equal(skills.cast('echo-tag', owner, target(0, -18.001, .12), 2, 1), null);
    for (const [type, flight, y] of [['echo-tag', .55, .12], ['echo-glint', .5, 1.6]]) {
      const event = skills.cast(type, owner, target(4, -8, y), 2, 1);
      const mid = skillProjectilePosition(event, 2 + flight / 2); near(mid.x, 2); near(mid.z, -4); near(mid.y, (1.7 + y) / 2 + .8);
      const end = skillProjectilePosition(event, 10); near(end.x, 4); near(end.y, y); near(end.z, -8);
    }
    const glint = skills.events(2).find(event => event.type === 'echo-glint'); assert.equal(glint.triggerAt, 2.5); assert.equal(glint.endsAt, 2.9); assert.equal(glint.radius, 10);
    assert.equal(skills.cast('echo-kerning', owner, target(1, 0), 2, 1), null);
    const kerning = skills.cast('echo-kerning', owner, target(0, 0), 2, 1);
    assert.equal(kerning.fromY, 0); assert.equal(kerning.radius, 0); assert.equal(kerning.flight, 0); assert.equal(kerning.triggerAt, 2); assert.equal(kerning.endsAt, 6);
    assert.deepEqual(skillProjectilePosition(kerning, 4), target(0, 0)); assert.equal(skills.cast('echo-kerning', owner, target(0, 0), 2, 1), null);
    assert.equal(IAGNU_SKILLS.tagRevealDuration, 2.5);
  });
  test('IAGNU tags arm before sampling, wait for an entrant, choose distance then ID and freeze one location after source death', () => {
    const skills = createCharacterSkills(), owner = actor(), tag = skills.cast('echo-tag', owner, target(0, -5, .12), 0, 1);
    const early = actor('early', 'red', 0, -5);
    assert.deepEqual(skills.update([owner, early], 1.049999, 1, allReach), []); assert.equal(skills.events(1.049999).length, 1);
    assert.deepEqual(skills.update([{ ...owner, alive: false, hp: 0 }], 1.05, 1, allReach), []); assert.equal(skills.events(1.05).length, 1);
    const far = actor('0-far', 'red', 2, -5), b = actor('b', 'red', 1, -5), a = actor('a', 'red', -1, -5);
    const effects = skills.update([far, b, a, a], 2, 1, allReach);
    assert.deepEqual(effects, [{ type: 'detect', sourceId: owner.id, eventId: tag.id, team: 'blue', round: 1, x: -1, y: 0, z: -5, detectedAt: 2, endsAt: 4.5 }]);
    assert.equal(skills.events(2).length, 0); assert.deepEqual(skills.markers('red', 2), []); assert.deepEqual(skills.markers(undefined, 2), []);
    a.x = 40; a.y = 8; a.z = 50;
    assert.deepEqual(skills.update([a], 2.1, 1, allReach), []); assert.equal(skills.markers('blue', 2.1)[0].x, -1);
    const marker = skills.markers('blue', 2.1)[0]; assert.equal(Object.hasOwn(marker, 'targetId'), false); assert.equal(Object.hasOwn(marker, 'sourceId'), false);
    marker.x = 900; assert.equal(skills.markers('blue', 2.2)[0].x, -1); assert.deepEqual(skills.markers('blue', 4.5), []);
  });
  test('IAGNU tag detection respects walls, height, radius, liveness and exact expiry rather than hidden enemy knowledge', () => {
    const owner = actor(), cases = [
      [actor('friend', 'blue', 0, -5), true], [actor('far', 'red', 4.501, -5), true],
      [actor('high', 'red', 0, -5, { y: 2.501 }), true], [actor('dead', 'red', 0, -5, { hp: 0, alive: false }), true],
      [actor('wall', 'red', 0, -5), false], [actor('throw', 'red', 0, -5), () => { throw Error('wall'); }],
    ];
    for (const [enemy, reach] of cases) {
      const skills = createCharacterSkills(); skills.cast('echo-tag', owner, target(0, -5, .12), 0, 1);
      assert.deepEqual(skills.update([enemy], 1.05, 1, { reachable: typeof reach === 'function' ? reach : () => reach }), []);
      assert.equal(skills.events(1.05).length, 1);
    }
    const edge = createCharacterSkills(); edge.cast('echo-tag', owner, target(0, -5, .12), 0, 1);
    assert.equal(edge.update([actor('edge', 'red', 4.5, -5, { y: 2.5 })], 1.05, 1, allReach).length, 1);
    const noLOS = createCharacterSkills(); noLOS.cast('echo-tag', owner, target(0, -5, .12), 0, 1); assert.deepEqual(noLOS.update([actor('enemy', 'red', 0, -5)], 1.05, 1), []);
    const late = createCharacterSkills(); late.cast('echo-tag', owner, target(0, -5, .12), 0, 1);
    assert.deepEqual(late.update([actor('enemy', 'red', 0, -5)], 13.05, 1, allReach), []); assert.deepEqual(late.markers('blue', 13.05), []);
  });
  test('IAGNU glint shares facing and cover rules but keeps its own two-second blindness through JSON and duplicate snapshots', () => {
    const host = createCharacterSkills(), guest = createCharacterSkills(), owner = actor(), event = host.cast('echo-glint', owner, target(0, -5, 1.6), 0, 1);
    const observers = [owner, actor('enemy', 'red'), actor('friend', 'blue'), actor('away', 'red', 0, 0, { yaw: Math.PI }), actor('wall', 'red'), actor('far', 'red', 0, 5.01)];
    assert.deepEqual(host.update(observers, .49999, 1, allReach), []);
    const effects = host.update(observers, .5, 1, { reachable: (_, other) => other.id !== 'wall' });
    assert.deepEqual(effects.map(effect => effect.targetId), ['caster', 'enemy', 'friend']);
    for (const effect of effects) { assert.equal(effect.type, 'blind'); assert.equal(effect.duration, 2); near(host.blindUntil(effect.targetId, .5), 2.5); }
    const packet = json(host.snapshot()); assert.equal(guest.restore(packet, .5, 1), true); assert.equal(guest.restore(packet, .5, 1), true);
    assert.deepEqual(guest.update(observers, .6, 1, allReach), []); near(guest.blindUntil('enemy', .6), 2.5);
    assert.equal(guest.events(event.endsAt).length, 0); near(guest.blindUntil('enemy', .9), 2.5); assert.equal(guest.blindUntil('enemy', 2.5), 0);
    const forged = json(packet); forged.blinds[0].endsAt = 2; assert.equal(createCharacterSkills().restore(forged, .5, 1), false);
  });
  test('IAGNU self movement is separate from slows, host-restored only on guests, bounded and permanently removed by source death', () => {
    const host = createCharacterSkills(), guest = createCharacterSkills(), owner = actor(), enemy = actor('slow-owner', 'red');
    host.cast('echo-kerning', owner, target(0, 0), 0, 1); host.cast('mend-seeds', enemy, target(0, 0, .12), 0, 1);
    host.update([owner, enemy], .65, 1, allReach); assert.equal(host.movementScale(owner, .65), 1.35); assert.equal(host.speedScale(owner, .65, allReach), .5);
    near(host.movementScale(owner, .65) * host.speedScale(owner, .65, allReach), .675); assert.equal(host.movementScale(enemy, .65), 1);
    assert.equal(host.movementScale({ ...owner, alive: false, hp: 0 }, .65), 1); assert.equal(host.movementScale({ ...owner, team: 'red' }, .65), 1);
    assert.equal(guest.movementScale(owner, .65), 1, 'No speculative buff exists before a host event arrives');
    assert.equal(guest.restore(json(host.snapshot()), .65, 1), true); assert.equal(guest.movementScale(owner, .65), 1.35);
    guest.update([{ ...owner, alive: false, hp: 0 }, enemy], 1, 1, allReach); assert.equal(guest.movementScale(owner, 1), 1); assert.equal(guest.events(1).some(event => event.type === 'echo-kerning'), false);
    host.update([owner, enemy], 4, 1, allReach); assert.equal(host.movementScale(owner, 4), 1);
    const removed = createCharacterSkills(); removed.cast('echo-kerning', owner, target(0, 0), 0, 1); removed.update([], .1, 1); assert.equal(removed.movementScale(owner, .1), 1);
  });
  test('IAGNU team snapshots expose only frozen friendly markers while public glyphs remain visible and restore never redetects', () => {
    const host = createCharacterSkills(), guest = createCharacterSkills(), blue = actor('blue-source'), red = actor('red-source', 'red', 10, 0);
    host.cast('echo-tag', blue, target(0, -5, .12), 0, 1); host.cast('echo-tag', red, target(10, -5, .12), 0, 1);
    host.cast('echo-glint', blue, target(0, -8, 1.6), 0, 1);
    const before = json(host.snapshot('blue')); assert.equal(before.events.length, 3); assert.equal(guest.restore(before, 0, 1), true);
    const enemies = [actor('red-target', 'red', 0, -5), actor('blue-target', 'blue', 10, -5)];
    assert.deepEqual(guest.update(enemies, 1.05, 1, allReach), []); assert.deepEqual(guest.markers('blue', 1.05), []);
    host.update(enemies, 1.05, 1, allReach); assert.equal(host.snapshot().markers.length, 2);
    assert.deepEqual(host.snapshot('blue').markers.map(marker => marker.team), ['blue']); assert.deepEqual(host.snapshot('red').markers.map(marker => marker.team), ['red']); assert.deepEqual(host.snapshot('invalid').markers, []);
    const packet = json(host.snapshot('blue')); assert.equal(guest.restore(packet, 1.05, 1), true); assert.equal(guest.markers('blue', 1.05)[0].x, 0); assert.deepEqual(guest.markers('red', 1.05), []);
    assert.equal(guest.restore(packet, 1.1, 1), true); assert.deepEqual(guest.update(enemies, 1.2, 1, allReach), []);
    guest.markers('blue', 4); assert.equal(guest.restore(packet, 1.15, 1), true); assert.deepEqual(guest.markers('blue', 4), []);
    assert.equal(guest.restore(packet, 1.1, 1), false); assert.equal(guest.restore({ events: [], blinds: [] }, 0, 2), true); assert.deepEqual(guest.markers('blue', 0), []);
  });
  test('IAGNU strict canonical JSON rejects marker leaks, forged timing, duplicate records and malformed events atomically', () => {
    const host = createCharacterSkills(), owner = actor(); host.cast('echo-tag', owner, target(0, -5, .12), 0, 1);
    host.update([actor('enemy', 'red', 0, -5)], 1.05, 1, allReach); host.cast('echo-kerning', owner, target(0, 0), 1.05, 1);
    const packet = json(host.snapshot()), guest = createCharacterSkills(); assert.equal(guest.restore(packet, 1.05, 1), true);
    const invalids = [{ ...packet, markers: null }, { ...packet, markers: Array(21).fill(packet.markers[0]) }, { ...packet, markers: [packet.markers[0], packet.markers[0]] }];
    for (const [key, value] of [['x', Infinity], ['y', '0'], ['z', 1001], ['round', 2], ['team', 'bad'], ['eventId', 'skill-echo-glint-1'], ['eventId', 'skill-echo-tag-0'],
      ['detectedAt', 2], ['endsAt', 20], ['targetId', 'secret'], ['sourceId', 'secret']]) { const bad = json(packet); bad.markers[0][key] = value; invalids.push(bad); }
    for (const [key, value] of [['x', 1], ['fromY', 1.7], ['radius', 1], ['flight', .1], ['endsAt', 9], ['triggerAt', 2]]) { const bad = json(packet); bad.events[0][key] = value; invalids.push(bad); }
    const same = json(packet); same.events.push({ ...host.cast('echo-tag', owner, target(0, -5, .12), 1.05, 1), id: same.markers[0].eventId }); invalids.push(same);
    for (const bad of invalids) { const before = guest.snapshot(); assert.equal(guest.restore(bad, 1.05, 1), false); assert.deepEqual(guest.snapshot(), before); }
    packet.markers[0].x = 900; assert.equal(guest.markers('blue', 1.05)[0].x, 0);
    const next = guest.cast('echo-glint', owner, target(0, -5, 1.6), 1.05, 1); assert.ok(next.id.endsWith('-3'), 'Marker IDs advance the shared sequence even after the tag has gone');
    guest.reset(); assert.deepEqual(guest.snapshot(), { events: [], blinds: [], markers: [] });
  });
  test('mixed ordinary capacity retains all twenty existing effects, rejects before ownership or IDs advance, and supports stock rollback', () => {
    const skills = createCharacterSkills(), owner = actor(), kit = new DuelistKit({ character: 'echo' });
    for (let n = 0; n < 20; n++) assert.ok(skills.cast('nope-decoy', owner, target(0, -5), 0, 1));
    const before = json(skills.snapshot()); kit.buy('c', () => true); const stock = kit.snapshot(), effect = kit.activate('c', 0);
    assert.equal(skills.cast(effect, owner, target(0, -5, .12), 0, 1), null); kit.restore(stock); assert.deepEqual(kit.snapshot(), stock); assert.deepEqual(skills.snapshot(), before);
    for (const type of ['echo-tag', 'echo-glint', 'echo-kerning', 'nope-bottle', 'mend-seeds']) assert.equal(skills.cast(type, owner, type === 'echo-kerning' ? target(0, 0) : target(), 0, 1), null);
    skills.events(12); const next = skills.cast('echo-tag', owner, target(0, -5, .12), 12, 1); assert.ok(next.id.endsWith('-21'));
    const tags = createCharacterSkills();
    for (let n = 0; n < 20; n++) tags.cast('echo-tag', owner, target(0, -5, .12), 0, 1);
    tags.update([actor('enemy', 'red', 0, -5)], 1.05, 1, allReach); assert.equal(tags.snapshot().markers.length, 20);
    for (let n = 0; n < 20; n++) tags.cast('echo-tag', owner, target(0, -5, .12), 1.05, 1);
    tags.update([actor('enemy', 'red', 0, -5)], 2.1, 1, allReach); assert.equal(tags.snapshot().markers.length, 20); assert.ok(tags.snapshot().markers[0].eventId.endsWith('-21'));
    const maximum = tags.snapshot(); assert.ok(Buffer.byteLength(JSON.stringify(maximum)) < 12000); assert.equal(createCharacterSkills().restore(json(maximum), 2.1, 1), true);
    tags.reset(); const nextTag = tags.cast('echo-tag', owner, target(0, -5, .12), 0, 2); assert.ok(nextTag.id.endsWith('-41'));
  });
  test('VEIL casts all three skills only with explicit live grounding and map dust / exact self turf / bounded roots targets', () => {
    const skills = createCharacterSkills(), owner = actor('grass', 'blue', 3, 4, { y: 3.2, grounded: true });
    const destinations = { 'veil-dust': target(3, 4, 4.45), 'veil-roots': target(3, -3, 3.2), 'veil-turf': target(3, 4, 3.2) };
    for (const type of Object.keys(destinations)) {
      for (const grounded of [undefined, false, 0, 1, 'true', null]) assert.equal(skills.cast(type, { ...owner, grounded }, destinations[type], 2, 1), null);
      assert.equal(skills.cast(type, { ...owner, alive: false, hp: 0 }, destinations[type], 2, 1), null);
    }
    for (const [type, bad] of [['veil-dust', target(1001, 4, 4.45)], ['veil-dust', target(3, 4, NaN)],
      ['veil-turf', target(3, 4, 3.21)], ['veil-roots', target(3, 3.501, 3.2)], ['veil-roots', target(3, -6.001, 3.2)]]) assert.equal(skills.cast(type, owner, bad, 2, 1), null);
    const dust = skills.cast({ type: 'veil-dust', radius: 999 }, owner, destinations['veil-dust'], 2, 1);
    assert.ok(dust.id.endsWith('-1')); assert.equal(dust.fromY, 3.2); assert.equal(dust.flight, 0); assert.equal(dust.radius, 3.5); near(dust.triggerAt, 2.2); near(dust.endsAt, 9.2);
    const roots = skills.cast('veil-roots', owner, destinations['veil-roots'], 2, 1); assert.equal(roots.radius, 1.6); assert.equal(roots.triggerAt, 2.25); assert.equal(roots.endsAt, 10.25); assert.equal(roots.fromY, 3.2);
    const turf = skills.cast('veil-turf', owner, destinations['veil-turf'], 2, 1); assert.equal(turf.triggerAt, 2); assert.equal(turf.endsAt, 5); assert.equal(turf.radius, 0);
    assert.equal(skills.cast('veil-turf', owner, destinations['veil-turf'], 2, 1), null);
    assert.ok(skills.cast('veil-roots', owner, target(3, 3.5, 3.2), 2, 1));
    const maximumRoots = skills.cast('veil-roots', owner, target(3, -6, 3.2), 2, 1);
    assert.ok(maximumRoots); assert.equal(Math.hypot(maximumRoots.x - maximumRoots.fromX, maximumRoots.z - maximumRoots.fromZ), 10, 'The full strengthened ten-meter cast is accepted');
    for (const event of [dust, roots, turf]) {
      for (const now of [0, 2, 2.1, 20]) assert.deepEqual(skillProjectilePosition(event, now), target(event.x, event.z, event.y));
      assert.deepEqual(Object.keys(event).sort(), ['id', 'type', 'team', 'sourceId', 'round', 'fromX', 'fromY', 'fromZ', 'x', 'y', 'z', 'startedAt', 'flight', 'triggerAt', 'endsAt', 'radius'].sort());
    }
    assert.equal(VEIL_SKILLS.rootsHeightTolerance, .45);
  });
  test('VEIL roots use a finite-width nearest-floor capsule after arming, with exact enemy, height and grounding boundaries', () => {
    const skills = createCharacterSkills(), owner = actor('grass', 'blue', 0, 0, { grounded: true });
    skills.cast('veil-roots', owner, target(0, -7), 0, 1);
    const enemy = actor('enemy', 'red', 1.6, -3, { grounded: true }), options = { reachable: () => true, groundHeight: () => 0 };
    assert.equal(skills.speedScale(enemy, .249999, options), 1); assert.equal(skills.speedScale(enemy, .25, options), .45);
    for (const other of [{ ...enemy, x: 1.601 }, { ...enemy, y: .451 }, { ...enemy, grounded: false }, { ...enemy, grounded: undefined }, { ...enemy, team: 'blue' }, { ...enemy, alive: false, hp: 0 }]) assert.equal(skills.speedScale(other, .25, options), 1);
    assert.equal(skills.speedScale({ ...enemy, y: .45 }, .25, options), .45);
    assert.equal(skills.speedScale({ ...enemy, x: 0, z: -8.6 }, .25, options), .45); assert.equal(skills.speedScale({ ...enemy, x: 0, z: -8.601 }, .25, options), 1);
    let sampled = 0;
    assert.equal(skills.speedScale(enemy, .25, { groundHeight: (x, z, referenceY) => { sampled++; near(x, 0); near(z, -3); near(referenceY, 0); return 0; },
      reachable: (source, other) => { assert.equal(other.id, enemy.id); near(source.x, 0); near(source.y, 0); near(source.z, -3); assert.equal(source.type, 'veil-roots'); return true; } }), .45);
    assert.equal(sampled, 1); assert.equal(skills.speedScale(enemy, 8.25, options), 1);
  });
  test('VEIL roots fail closed for absent, malformed or throwing floor and cover queries rather than reaching across floors or walls', () => {
    const owner = actor('grass', 'blue', 0, 0, { y: 3.2, grounded: true }), enemy = actor('enemy', 'red', 0, -3, { y: 3.2, grounded: true });
    const skills = createCharacterSkills(); skills.cast('veil-roots', owner, target(0, -7, 3.2), 0, 1);
    const good = { reachable: () => true, groundHeight: () => 3.2 }; assert.equal(skills.speedScale(enemy, .25, good), .45);
    assert.equal(skills.speedScale({ ...enemy, y: 0 }, .25, good), 1, 'The ground floor below a deck never shares its roots');
    for (const groundHeight of [undefined, null, 0, () => null, () => false, () => '3.2', () => NaN, () => Infinity, () => 1001, () => 0, () => { throw Error('floor query'); }]) {
      assert.equal(skills.speedScale(enemy, .25, { ...good, groundHeight }), 1);
    }
    for (const reachable of [undefined, null, () => false, () => 1, () => { throw Error('wall'); }]) assert.equal(skills.speedScale(enemy, .25, { ...good, reachable }), 1);
    const slope = createCharacterSkills(), low = { ...owner, y: 0 }; slope.cast('veil-roots', low, target(0, -7, 2), 0, 1);
    const mid = { ...enemy, z: -3.5, y: 1 };
    assert.equal(slope.speedScale(mid, .25, { reachable: () => true, groundHeight: (x, z, referenceY) => { near(referenceY, 1); return referenceY; } }), .45);
    assert.equal(slope.speedScale({ ...mid, y: 1.9 }, .25, { reachable: () => true, groundHeight: () => 1.45 }), .45);
    assert.equal(slope.speedScale(mid, .25, { reachable: () => true, groundHeight: () => 1.451 }), 1, 'A discontinuity from the endpoint-interpolated floor fails closed');
  });
  test('VEIL turf ends permanently on the first airborne or invalid source sample, including movement queries before the host update', () => {
    const owner = actor('grass', 'blue', 0, 0, { grounded: true });
    for (const changed of [{ ...owner, grounded: false }, { ...owner, grounded: undefined }, { ...owner, hp: 0, alive: false }, { ...owner, team: 'red' }]) {
      const skills = createCharacterSkills(); skills.cast('veil-turf', owner, target(0, 0), 0, 1);
      assert.equal(skills.movementScale(owner, 0), 1.5); assert.equal(skills.movementScale(changed, .1), 1);
      assert.equal(skills.movementScale(owner, .2), 1); assert.equal(skills.events(.2).length, 0, 'Landing, revival or team correction does not restart the removed cast');
    }
    for (const list of [[], [{ ...owner, grounded: false }], [{ ...owner, hp: 0, alive: false }], [{ ...owner, team: 'red' }]]) {
      const skills = createCharacterSkills(); skills.cast('veil-turf', owner, target(0, 0), 0, 1); assert.deepEqual(skills.update(list, .1, 1), []);
      assert.equal(skills.movementScale(owner, .2), 1); assert.equal(skills.events(.2).length, 0);
    }
    const skills = createCharacterSkills(); skills.cast('veil-turf', owner, target(0, 0), 0, 1);
    assert.equal(skills.movementScale(actor('other', 'blue', 0, 0, { grounded: true }), .1), 1); assert.equal(skills.movementScale(owner, .1), 1.5);
    assert.equal(skills.movementScale(owner, 2.999999), 1.5); assert.equal(skills.movementScale(owner, 3), 1);
  });
  test('VEIL roots and turf combine through separate scales, preserve the strongest minimum across overlapping slow fields and leave allied ground unaffected', () => {
    const skills = createCharacterSkills(), blue = actor('grass-blue', 'blue', 0, 0, { grounded: true }), red = actor('grass-red', 'red', 0, -3, { grounded: true });
    skills.cast('veil-roots', blue, target(0, -7), 0, 1); skills.cast('veil-turf', red, target(0, -3), 0, 1);
    skills.cast('mend-seeds', blue, target(0, -3, .12), 0, 1);
    const options = { reachable: () => true, groundHeight: () => 0 };
    near(skills.speedScale(red, .25, options) * skills.movementScale(red, .25), .675);
    near(skills.speedScale(red, .65, options) * skills.movementScale(red, .65), .675);
    assert.equal(skills.speedScale(blue, .65, options), 1); assert.equal(skills.movementScale(blue, .65), 1);
    assert.deepEqual(skills.update([blue, red], .65, 1, options), [], 'Persistent VEIL fields do not own one-shot hit, heal, blind or marker sampling');
    assert.deepEqual(skills.markers('blue', .65), []); assert.equal(skills.blindUntil(red.id, .65), 0);
  });
  test('VEIL fixed fields outlive their source while grounding and absolute clocks keep turf stable across supported frame cadences', () => {
    for (const hz of [20, 60, 144]) {
      const skills = createCharacterSkills(), owner = actor('grass', 'blue', 0, 0, { y: 3.2, grounded: true });
      skills.cast('veil-dust', owner, target(0, 0, 4.45), 0, 1); skills.cast('veil-roots', owner, target(0, -7, 3.2), 0, 1); skills.cast('veil-turf', owner, target(0, 0, 3.2), 0, 1);
      for (let frame = 0; frame < hz / 2; frame++) { const t = frame / hz; skills.update([owner], t, 1); assert.equal(skills.movementScale(owner, t), 1.5); }
      skills.update([{ ...owner, grounded: false }], .5, 1); skills.update([owner], .6, 1); assert.equal(skills.movementScale(owner, .6), 1);
      skills.update([], 1, 1); assert.deepEqual(skills.events(1).map(event => event.type), ['veil-dust', 'veil-roots']);
      assert.equal(skills.events(7.2).length, 1); assert.equal(skills.events(8.25).length, 0);
    }
  });
  test('VEIL canonical JSON restores visuals and current passive scales without ownership, and rejects forged ranges, self points, times or stock metadata atomically', () => {
    const host = createCharacterSkills(), owner = actor('grass', 'blue', 0, 0, { grounded: true }), enemy = actor('enemy', 'red', 0, -3, { grounded: true });
    host.cast('veil-dust', owner, target(0, 0, 1.25), 0, 1); host.cast('veil-roots', owner, target(0, -7), 0, 1); host.cast('veil-turf', owner, target(0, 0), 0, 1);
    const packet = json(host.snapshot()), guest = createCharacterSkills(); assert.equal(guest.movementScale(owner, .25), 1);
    assert.equal(guest.restore(packet, .25, 1), true); assert.deepEqual(guest.update([owner, enemy], .25, 1, allReach), []);
    assert.equal(guest.speedScale(enemy, .25, { ...allReach, groundHeight: () => 0 }), .45); assert.equal(guest.movementScale(owner, .25), 1.5);
    assert.equal(guest.restore(packet, .25, 1), true); assert.deepEqual(guest.update([owner, enemy], .25, 1, allReach), []);
    const invalids = [];
    for (const index of [0, 1, 2]) for (const [key, value] of [['flight', .1], ['radius', 99], ['triggerAt', 5], ['endsAt', 999], ['fromY', NaN], ['round', 2], ['targetId', 'secret'], ['width', 100], ['speedScale', 100], ['grounded', true]]) {
      const bad = json(packet); bad.events[index][key] = value; invalids.push(bad);
    }
    for (const [index, key, value] of [[0, 'y', 1001], [0, 'x', NaN], [1, 'z', -.499], [1, 'z', -10.001], [2, 'y', .01], [2, 'x', .01]]) { const bad = json(packet); bad.events[index][key] = value; invalids.push(bad); }
    const duplicate = json(packet); duplicate.events.push({ ...duplicate.events[2], id: 'skill-veil-turf-4' }); invalids.push(duplicate);
    for (const bad of invalids) { const before = guest.snapshot(); assert.equal(guest.restore(bad, .25, 1), false); assert.deepEqual(guest.snapshot(), before); }
    guest.events(9); assert.equal(guest.restore(packet, .3, 1), true); assert.equal(guest.events(9).length, 0, 'A leading render clock cannot revive expired fields');
    assert.equal(guest.restore(packet, .29, 1), false); assert.equal(guest.restore({ events: [], blinds: [], markers: [] }, 0, 2), true);
    assert.equal(guest.restore(packet, 9, 1), false); assert.deepEqual(guest.snapshot(), { events: [], blinds: [], markers: [] });
    const detached = host.events(0); detached[0].y = 99; assert.equal(host.events(0)[0].y, 1.25);
  });
  test('VEIL twenty-event cap keeps all existing effects and IDs, and C Q E stock or cooldown can each roll back on any failed cast', () => {
    const skills = createCharacterSkills(), owner = actor('grass', 'blue', 0, 0, { grounded: true });
    for (let i = 0; i < 20; i++) assert.ok(skills.cast('nope-decoy', owner, target(0, -5), 0, 1));
    const retained = json(skills.snapshot());
    for (const [key, destination] of [['c', target(0, 0, 1.25)], ['q', target(0, -7)], ['e', target(0, 0)]]) {
      const kit = new DuelistKit({ character: 'veil' }); kit.buy('c', () => true); kit.buy('q', () => true); const before = kit.snapshot(), effect = kit.activate(key, 0);
      assert.equal(skills.cast(effect, owner, destination, 0, 1), null); kit.restore(before); assert.deepEqual(kit.snapshot(), before); assert.deepEqual(skills.snapshot(), retained);
      const empty = createCharacterSkills(), airborne=empty.cast(effect, { ...owner, grounded: false }, destination, 0, 1); if(key==='q')assert.equal(airborne?.type,'veil-root-seed');else assert.equal(airborne,null); kit.restore(before); assert.deepEqual(kit.snapshot(), before);
    }
    skills.events(12); const next = skills.cast('veil-turf', owner, target(0, 0), 12, 1); assert.ok(next.id.endsWith('-21'));
    assert.equal(createCharacterSkills().restore(retained, 0, 1), true); assert.ok(Buffer.byteLength(JSON.stringify(retained)) < 9000);
  });
  test('EMBER uses canonical bounded solder data and self-only shade and weapon-fixed service without touching any ammo', () => {
    const owner = actor('worker', 'blue', 2, 3, { y: 3.2, weaponId: 'vandal', ammo: 4, reserve: 8 }), skills = createCharacterSkills();
    const solder = skills.cast({ type: 'ember-solder', radius: 999, flight: 0 }, owner, target(2, -15, 3.32), 2, 1);
    assert.ok(solder); near(solder.fromY, 4.9); assert.equal(solder.flight, .45); near(solder.triggerAt, 2.65); near(solder.endsAt, 3); assert.equal(solder.radius, 3.2);
    assert.equal(skills.cast('ember-solder', owner, target(2, -15.001, 3.32), 2, 1), null);
    const shade = skills.cast('ember-shade', owner, target(2, 3, 3.2), 2, 1);
    assert.equal(shade.fromY, 3.2); assert.equal(shade.flight, 0); assert.equal(shade.triggerAt, 2); assert.equal(shade.endsAt, 10); assert.equal(shade.radius, 0);
    assert.equal(skills.cast('ember-shade', owner, target(2, 3, 3.2), 2, 1), null, 'A personal effect cannot stack or refresh itself');
    for (const type of ['ember-shade', 'ember-service']) for (const bad of [target(2.001, 3, 3.2), target(2, 3, 3.201), target(2, 3.001, 3.2)]) {
      assert.equal(createCharacterSkills().cast(type, owner, { ...bad, weaponId: 'vandal' }, 2, 1), null);
    }
    for (const weaponId of ['classic', 'ghost', 'spectre', 'vandal', 'phantom']) {
      const engine = createCharacterSkills(), source = { ...owner, weaponId }, event = engine.cast('ember-service', source, { ...target(2, 3, 3.2), weaponId }, 2, 1);
      assert.ok(event); assert.equal(event.weaponId, weaponId); assert.equal(event.fromY, 3.2); assert.equal(event.radius, 0); assert.equal(event.triggerAt, 2); near(event.endsAt, 2.8);
      assert.deepEqual(skillProjectilePosition(event, 2.5), target(2, 3, 3.2));
      assert.deepEqual(engine.update([source], 2.5, 1, allReach), []); assert.equal(source.ammo, 4); assert.equal(source.reserve, 8);
      assert.equal(engine.cast('ember-service', source, { ...target(2, 3, 3.2), weaponId }, 2.5, 1), null);
    }
    for (const weaponId of [undefined, null, '', 'knife', 'spike', 'VANDAL', 'constructor', {}, 'x'.repeat(500)]) {
      assert.equal(createCharacterSkills().cast('ember-service', { ...owner, weaponId }, { ...target(2, 3, 3.2), weaponId }, 2, 1), null);
    }
    assert.equal(createCharacterSkills().cast('ember-service', owner, { ...target(2, 3, 3.2), weaponId: 'classic' }, 2, 1), null);
    assert.equal(createCharacterSkills().cast('ember-service', { ...owner, weaponId: undefined }, { ...target(2, 3, 3.2), weaponId: 'vandal' }, 2, 1), null);
    assert.deepEqual(Object.keys(solder).sort(), Object.keys(shade).sort()); assert.equal(EMBER_SKILLS.solderGroundOffset, .12);
  });
  test('EMBER solder follows the common arc, warns after arrival, then damages each exposed enemy once with exact floor-height falloff', () => {
    for (const hz of [20, 60, 144]) {
      const engine = createCharacterSkills(), owner = actor('worker'), event = engine.cast('ember-solder', owner, target(0, -5, .12), 0, 1);
      const middle = skillProjectilePosition(event, .225); near(middle.x, 0); near(middle.z, -2.5); near(middle.y, (1.7 + .12) / 2 + .8);
      near(skillProjectilePosition(event, .45).y, .12);
      const enemies = [actor('center', 'red', 0, -5), actor('half', 'red', 1.6, -5), actor('edge', 'red', 3.2, -5),
        actor('up', 'red', 0, -5, { y: 2.5 }), actor('down', 'red', 0, -5, { y: -2.5 }), actor('high', 'red', 0, -5, { y: 2.501 }),
        actor('low', 'red', 0, -5, { y: -2.501 }), actor('blocked', 'red', 0, -5), actor('ally', 'blue', 0, -5),
        actor('dead', 'red', 0, -5, { hp: 0, alive: false })];
      const options = { reachable: (_, other) => other.id !== 'blocked' };
      for (let frame = 0; frame / hz < .65; frame++) assert.deepEqual(engine.update([...enemies, { ...owner, hp: 0, alive: false }], frame / hz, 1, options), []);
      const effects = engine.update([...enemies, enemies[0]], .65, 1, options);
      assert.deepEqual(effects.map(hit => hit.targetId), ['center', 'half', 'up', 'down']);
      for (let index = 0; index < effects.length; index++) { assert.equal(effects[index].type, 'damage'); near(effects[index].amount, index === 1 ? 37.5 : 75); }
      assert.deepEqual(engine.update(enemies, .7, 1, options), []); assert.equal(enemies[0].hp, 100); assert.equal(engine.events(1).length, 0);
    }
    for (const reachable of [undefined, () => false, () => 1, () => { throw Error('wall'); }]) {
      const engine = createCharacterSkills(); engine.cast('ember-solder', actor(), target(0, -5, .12), 0, 1);
      assert.deepEqual(engine.update([actor('enemy', 'red', 0, -5)], .65, 1, { reachable }), []);
    }
    const late = createCharacterSkills(); late.cast('ember-solder', actor(), target(), 0, 1); assert.deepEqual(late.update([actor('enemy', 'red', 0, -5)], 1, 1, allReach), []);
  });
  test('EMBER shade shortens only newly sampled NOPE and IAGNU flashes once, independently of event insertion order or observer team', () => {
    for (const [type, trigger, duration] of [['nope-flash', .45, .36], ['echo-glint', .5, .3]]) for (const reverse of [false, true]) {
      const engine = createCharacterSkills(), owner = actor('thrower'), worker = actor('worker', 'red'), normal = actor('normal', 'red', 1, 0);
      const shade = () => engine.cast('ember-shade', worker, target(0, 0), 0, 1), flash = () => engine.cast(type, owner, target(0, -5, 1.7), 0, 1);
      if (reverse) { flash(); shade(); } else { shade(); flash(); }
      const effects = engine.update([worker, normal, owner], trigger, 1, allReach);
      near(effects.find(effect => effect.targetId === 'worker').duration, duration); near(effects.find(effect => effect.targetId === 'normal').duration, type === 'nope-flash' ? 2.4 : 2);
      const blind = engine.snapshot().blinds.find(value => value.targetId === 'worker'); assert.equal(blind.resisted, true); near(blind.endsAt - blind.startedAt, duration);
      assert.equal(Object.hasOwn(engine.snapshot().blinds.find(value => value.targetId === 'normal'), 'resisted'), false);
      assert.deepEqual(engine.update([worker, normal, owner], trigger + .01, 1, allReach), []);
    }
    for (const options of [{ reachable: () => false }, { reachable: () => { throw Error('cover'); } }]) {
      const engine = createCharacterSkills(), worker = actor('worker'); engine.cast('ember-shade', worker, target(0, 0), 0, 1);
      engine.cast('nope-flash', actor('other'), target(0, -5, 1.7), 0, 1); assert.deepEqual(engine.update([worker], .45, 1, options), []);
    }
    const away = actor('away', 'red', 0, 0, { yaw: Math.PI }), engine = createCharacterSkills(); engine.cast('ember-shade', away, target(0, 0), 0, 1);
    engine.cast('nope-flash', actor(), target(0, -5, 1.7), 0, 1); assert.deepEqual(engine.update([away], .45, 1, allReach), []);
  });
  test('EMBER shade cannot cure a prior flash, reduce one twice, refresh itself, or shorten a longer overlapping blindness', () => {
    const engine = createCharacterSkills(), worker = actor('worker', 'red'), thrower = actor('thrower');
    engine.cast('nope-flash', thrower, target(0, -5, 1.7), 0, 1); engine.update([worker], .45, 1, allReach); near(engine.blindUntil('worker', .45), 2.85);
    engine.cast('ember-shade', worker, target(0, 0), .5, 1); near(engine.blindUntil('worker', .5), 2.85);
    engine.cast('nope-flash', thrower, target(0, -5, 1.7), .5, 1); const effects = engine.update([worker], .95, 1, allReach);
    near(effects[0].duration, .36); near(engine.blindUntil('worker', .95), 2.85); assert.equal(Object.hasOwn(engine.snapshot().blinds[0], 'resisted'), false);
    assert.equal(engine.cast('ember-shade', worker, target(0, 0), 1, 1), null);
    engine.cast('nope-flash', thrower, target(0, -5, 1.7), 8.05, 1); const expired = engine.update([worker], 8.5, 1, allReach);
    near(expired[0].duration, 2.4); assert.equal(Object.hasOwn(engine.snapshot().blinds[0], 'resisted'), false, 'The exact eight-second boundary no longer protects a new flash');
  });
  test('EMBER personal effects end permanently on missing, dead or wrong-team sources and service additionally ends on any weapon mismatch', () => {
    const worker = actor('worker', 'blue', 0, 0, { weaponId: 'vandal' });
    for (const type of ['ember-shade', 'ember-service']) for (const list of [[], [{ ...worker, alive: false, hp: 0 }], [{ ...worker, team: 'red' }], ...(type === 'ember-service' ? [[{ ...worker, weaponId: 'classic' }], [{ ...worker, weaponId: undefined }]] : [])]) {
      const engine = createCharacterSkills(); const event = engine.cast(type, worker, { ...target(0, 0), weaponId: 'vandal' }, 0, 1); assert.ok(event);
      assert.deepEqual(engine.update(list, .1, 1, allReach), []); engine.update([worker], .2, 1, allReach); assert.equal(engine.events(.2).length, 0);
    }
    const engine = createCharacterSkills(), service = engine.cast('ember-service', worker, { ...target(0, 0), weaponId: 'vandal' }, 0, 1);
    engine.cast('ember-shade', worker, target(0, 0), 0, 1); engine.cast('ember-solder', worker, target(0, -5, .12), 0, 1);
    assert.equal(engine.cancelService(null), false); assert.equal(engine.cancelService('other'), false); assert.equal(engine.cancelService(worker.id), true); assert.equal(engine.cancelService(worker.id), false);
    assert.equal(engine.events(.1).some(event => event.id === service.id), false); assert.deepEqual(engine.events(.1).map(event => event.type), ['ember-shade', 'ember-solder']);
    assert.equal(engine.update([], .2, 1, allReach).length, 0); assert.deepEqual(engine.events(.2).map(event => event.type), ['ember-solder']);
  });
  test('EMBER service remains a pure bounded visual over the five game-owned ammo timers and never creates a completion effect at any cadence', () => {
    for (const weaponId of ['classic', 'ghost', 'spectre', 'vandal', 'phantom']) for (const hz of [20, 60, 144]) {
      const worker = actor('worker', 'blue', 0, 0, { weaponId, ammo: 1, reserve: 3, reloading: .8 }), engine = createCharacterSkills();
      engine.cast('ember-service', worker, { ...target(0, 0), weaponId }, 0, 1); engine.cast('ember-shade', worker, target(0, 0), 0, 1);
      for (let frame = 0; frame <= Math.ceil(.9 * hz); frame++) assert.deepEqual(engine.update([worker], frame / hz, 1, allReach), []);
      assert.equal(worker.ammo, 1); assert.equal(worker.reserve, 3); assert.equal(worker.reloading, .8);
      assert.deepEqual(engine.events(1).map(event => event.type), ['ember-shade']); assert.equal(engine.movementScale(worker, 1), 1); assert.equal(engine.speedScale(worker, 1, allReach), 1);
    }
  });
  test('EMBER JSON restores only current canonical visuals and resisted blindness, rejects forged extra fields and weapon data atomically, and never acquires hit ownership', () => {
    const host = createCharacterSkills(), worker = actor('worker', 'blue', 0, 0, { weaponId: 'vandal' }), enemy = actor('enemy', 'red', 0, -5);
    host.cast('ember-solder', worker, target(0, -5, .12), 0, 1); host.cast('ember-shade', worker, target(0, 0), 0, 1);
    host.cast('ember-service', worker, { ...target(0, 0), weaponId: 'vandal' }, 0, 1); host.cast('nope-flash', actor('thrower', 'red'), target(0, -5, 1.7), 0, 1);
    host.update([worker], .45, 1, allReach); const packet = json(host.snapshot()), guest = createCharacterSkills();
    assert.equal(packet.blinds[0].resisted, true); assert.equal(guest.restore(packet, .45, 1), true); assert.deepEqual(guest.snapshot(), packet);
    assert.deepEqual(guest.update([worker, enemy], .65, 1, allReach), []); assert.equal(host.update([worker, enemy], .65, 1, allReach).find(value => value.type === 'damage').amount, 75);
    const invalids = [];
    for (const index of [0, 1, 2]) for (const [key, value] of [['flight', 9], ['radius', 9], ['triggerAt', 9], ['endsAt', 9], ['targetId', 'secret'], ['duration', 99], ['speedScale', 99]]) {
      const bad = json(packet); bad.events[index][key] = value; invalids.push(bad);
    }
    for (const [index, key, value] of [[0, 'z', -18.001], [1, 'x', .001], [2, 'y', .001], [0, 'weaponId', 'vandal'], [1, 'weaponId', 'vandal'], [2, 'weaponId', 'knife'], [2, 'ammo', 999]]) {
      const bad = json(packet); bad.events[index][key] = value; invalids.push(bad);
    }
    for (const index of [1, 2]) { const bad = json(packet); bad.events.push({ ...bad.events[index], id: `skill-${bad.events[index].type}-99` }); invalids.push(bad); }
    for (const weaponId of [null, '', 'VANDAL', 'spike', 'constructor', 7]) { const bad = json(packet); bad.events[2].weaponId = weaponId; invalids.push(bad); }
    const missingWeapon = json(packet); delete missingWeapon.events[2].weaponId; invalids.push(missingWeapon);
    for (const [key, value] of [['resisted', false], ['resisted', 'true'], ['resisted', 1], ['flashScale', .45], ['factor', .45], ['duration', .675], ['extra', true], ['endsAt', 2.85]]) {
      const bad = json(packet); bad.blinds[0][key] = value; invalids.push(bad);
    }
    const noFlag = json(packet); delete noFlag.blinds[0].resisted; invalids.push(noFlag);
    for (const invalid of invalids) { const before = guest.snapshot(); assert.equal(guest.restore(invalid, .65, 1), false); assert.deepEqual(guest.snapshot(), before); }
    assert.equal(guest.restore(packet, .65, 1), true); assert.deepEqual(guest.update([worker, enemy], .7, 1, allReach), []);
    guest.events(9); assert.equal(guest.restore(packet, .7, 1), true); assert.equal(guest.events(9).length, 0); assert.equal(guest.blindUntil(worker.id, 9), 0);
    assert.equal(guest.restore(packet, .69, 1), false); assert.equal(guest.restore({ events: [], blinds: [], markers: [] }, 0, 2), true); assert.equal(guest.restore(packet, .7, 1), false);
  });
  test('EMBER twenty-event rejection preserves existing effects, stock and cooldown on rollback and never advances a rejected sequence', () => {
    const engine = createCharacterSkills(), worker = actor('worker', 'blue', 0, 0, { weaponId: 'vandal' });
    for (let index = 0; index < 20; index++) engine.cast('nope-decoy', worker, target(0, -5), 0, 1);
    const retained = json(engine.snapshot());
    for (const [key, destination] of [['c', target(0, -5, .12)], ['q', target(0, 0)], ['e', { ...target(0, 0), weaponId: 'vandal' }]]) {
      const kit = new DuelistKit({ character: 'ember' }); kit.buy('c', () => true); kit.buy('q', () => true); const before = kit.snapshot(), effect = kit.activate(key, 0);
      assert.equal(engine.cast(effect, worker, destination, 0, 1), null); kit.restore(before); assert.deepEqual(kit.snapshot(), before); assert.deepEqual(engine.snapshot(), retained);
    }
    engine.events(12); const event = engine.cast('ember-service', worker, { ...target(0, 0), weaponId: 'vandal' }, 12, 1); assert.ok(event.id.endsWith('-21'));
    const before = engine.snapshot(); for (const now of [NaN, Infinity, -1, '12', 11]) assert.equal(engine.cast('ember-shade', worker, target(0, 0), now, 1), null);
    assert.deepEqual(engine.snapshot(), before); engine.reset(); assert.equal(engine.cancelService(worker.id), false); assert.deepEqual(engine.snapshot(), { events: [], blinds: [], markers: [] });
  });
  test('FROST uses canonical ranges, eye-sourced throws, a grounded self-only signature and fixed timers without extra wire fields', () => {
    const engine = createCharacterSkills(), owner = actor('doll', 'blue', 2, 3, { y: 3.2, grounded: true });
    const stitch = engine.cast({ type: 'frost-stitch', radius: 999, innerRadius: 0, speedScale: 0 }, owner, target(2, -13, 3.32), 2, 1);
    const mist = engine.cast('frost-mist', owner, target(2, -15, 4.6), 2, 1), unravel = engine.cast('frost-unravel', owner, target(2, 3, 3.2), 2, 1);
    assert.ok(stitch); assert.ok(mist); assert.ok(unravel); near(stitch.fromY, 4.9); near(mist.fromY, 4.9); assert.equal(unravel.fromY, 3.2);
    assert.equal(stitch.flight, .55); near(stitch.triggerAt, 2.8); near(stitch.endsAt, 10.8); assert.equal(stitch.radius, 3.8);
    assert.equal(mist.flight, .5); assert.equal(mist.triggerAt, 2.5); assert.equal(mist.endsAt, 11.5); assert.equal(mist.radius, 3.5);
    assert.equal(unravel.flight, 0); assert.equal(unravel.triggerAt, 2); assert.equal(unravel.endsAt, 7); assert.equal(unravel.radius, 0);
    for (const event of [stitch, mist, unravel]) assert.deepEqual(Object.keys(event).sort(), ['id', 'type', 'team', 'sourceId', 'round', 'fromX', 'fromY', 'fromZ', 'x', 'y', 'z', 'startedAt', 'flight', 'triggerAt', 'endsAt', 'radius'].sort());
    assert.equal(engine.cast('frost-stitch', owner, target(2, -13.001, 3.32), 2, 1), null); assert.equal(engine.cast('frost-mist', owner, target(2, -15.001, 4.6), 2, 1), null);
    for (const grounded of [false, undefined, null, 1, 'true']) assert.equal(createCharacterSkills().cast('frost-unravel', { ...owner, grounded }, target(2, 3, 3.2), 2, 1), null);
    for (const destination of [target(2.001, 3, 3.2), target(2, 3.001, 3.2), target(2, 3, 3.201)]) assert.equal(createCharacterSkills().cast('frost-unravel', owner, destination, 2, 1), null);
    assert.equal(engine.cast('frost-unravel', owner, target(2, 3, 3.2), 2.1, 1), null);
    for (const type of ['frost-stitch', 'frost-mist']) assert.ok(createCharacterSkills().cast(type, { ...owner, grounded: false }, target(2, 0, 3.32), 2, 1), 'Throwing does not require grounding');
  });
  test('FROST throws follow the common .8m arc while passive fields retain their exact timing after the caster dies', () => {
    for (const [type, flight, endpointY, trigger, end] of [['frost-stitch', .55, .12, .8, 8.8], ['frost-mist', .5, 1.4, .5, 9.5]]) {
      const engine = createCharacterSkills(), owner = actor('doll'), event = engine.cast(type, owner, target(0, -6, endpointY), 0, 1);
      near(skillProjectilePosition(event, flight / 2).y, (1.7 + endpointY) / 2 + .8); near(skillProjectilePosition(event, flight / 2).z, -3);
      for (const time of [flight, end]) { const endPoint = skillProjectilePosition(event, time); near(endPoint.x, 0); near(endPoint.z, -6); near(endPoint.y, endpointY); }
      assert.deepEqual(engine.update([{ ...owner, hp: 0, alive: false }], trigger, 1, allReach), []); assert.equal(engine.events(trigger)[0].id, event.id);
      assert.deepEqual(engine.update([actor('enemy', 'red', 2, -6, { grounded: true })], end - .001, 1, allReach), []);
      assert.equal(engine.events(end).length, 0); assert.equal(engine.blindUntil('enemy', end), 0); assert.deepEqual(engine.markers('blue', end), []);
    }
    assert.equal(FROST_SKILLS.stitchGroundOffset, .12); assert.equal(FROST_SKILLS.mistCenterOffset, 1.4);
  });
  test('FROST stitch slows only the supported enemy annulus including both exact edges after arming and before expiry', () => {
    const options = { ...allReach, groundHeight: () => 0 };
    for (const hz of [20, 60, 144]) {
      const engine = createCharacterSkills(); engine.cast('frost-stitch', actor(), target(0, -5, .12), 0, 1);
      const enemy = actor('enemy', 'red', 2, -5, { grounded: true });
      for (let frame = 0; frame / hz < .8 - 1e-8; frame++) assert.equal(engine.speedScale(enemy, frame / hz, options), 1);
      assert.equal(engine.speedScale(enemy, .8, options), .45);
      for (const [radius, expected] of [[0, 1], [.899, 1], [.9, .45], [2.35, .45], [3.8, .45], [3.801, 1]]) assert.equal(engine.speedScale({ ...enemy, x: radius }, .8, options), expected, `r=${radius}`);
      for (const extra of [{ team: 'blue' }, { alive: false, hp: 0 }, { grounded: false }, { grounded: undefined }, { grounded: 1 }]) assert.equal(engine.speedScale({ ...enemy, ...extra }, .8, options), 1);
      assert.equal(engine.speedScale(enemy, 8.799999, options), .45); assert.equal(engine.speedScale(enemy, 8.8, options), 1);
    }
  });
  test('FROST stitch samples both the radial centerline and actor floor, validates height and tests cover from the local floor', () => {
    const engine = createCharacterSkills(), owner = actor(), enemy = actor('enemy', 'red', 2.4, -5, { grounded: true }); engine.cast('frost-stitch', owner, target(0, -5, .12), 0, 1);
    const samples = [], reaches = [], options = { groundHeight: (x, z, ref) => { samples.push([x, z, ref]); return 0; }, reachable: (from, to) => { reaches.push([from, to]); return true; } };
    assert.equal(engine.speedScale(enemy, .8, options), .45); assert.deepEqual(samples, [[2.35, -5, 0], [2.4, -5, 0]]);
    assert.equal(reaches.length, 1); assert.equal(reaches[0][0].x, 2.35); assert.equal(reaches[0][0].y, 0); assert.equal(reaches[0][0].z, -5); assert.equal(reaches[0][1], enemy);
    for (const groundHeight of [undefined, () => null, () => NaN, () => Infinity, () => '0', () => { throw Error('hole'); }, x => x === 2.35 ? null : 0, x => x === 2.4 ? null : 0]) {
      assert.equal(engine.speedScale(enemy, .8, { ...allReach, groundHeight }), 1);
    }
    for (const reachable of [undefined, () => false, () => 1, () => { throw Error('wall'); }]) assert.equal(engine.speedScale(enemy, .8, { groundHeight: () => 0, reachable }), 1);
    const flat = y => ({ ...allReach, groundHeight: () => y });
    assert.equal(engine.speedScale({ ...enemy, y: .45 }, .8, flat(.45)), .45); assert.equal(engine.speedScale({ ...enemy, y: .451 }, .8, flat(.451)), 1);
    assert.equal(engine.speedScale({ ...enemy, y: .45 }, .8, flat(0)), .45); assert.equal(engine.speedScale({ ...enemy, y: .451 }, .8, flat(0)), 1);
    assert.equal(engine.speedScale({ ...enemy, y: .4 }, .8, { ...allReach, groundHeight: x => x === 2.35 ? -.4 : .4 }), 1, 'Supported points on different ledges do not join across .8m');
    const elevated = createCharacterSkills(); elevated.cast('frost-stitch', { ...owner, y: 3.2 }, target(0, -5, 3.32), 0, 1);
    assert.equal(elevated.speedScale({ ...enemy, y: 3.2 }, .8, flat(3.2)), .45); assert.equal(elevated.speedScale(enemy, .8, flat(0)), 1, 'An upstairs ring cannot slow the floor below');
    assert.equal(elevated.speedScale({ ...enemy, y: 3.2 }, .8, flat(0)), 1, 'An airborne pose above lower support is not considered on the upper floor');
  });
  test('FROST mitigation leaves fifteen percent of combined slowdown without changing the separate normal movement scale or actor state', () => {
    const owner = actor('doll', 'blue', 2, -5, { grounded: true }), engine = createCharacterSkills(), before = json(owner);
    engine.cast('frost-unravel', owner, target(2, -5), 0, 1);
    for (const [raw, expected] of [[1, 1], [.55, .9325], [.65, .9475], [.75, .9625], [0, .85]]) near(engine.mitigateSlow(owner, raw, .1), expected);
    assert.equal(engine.movementScale(owner, .1), 1); assert.equal(engine.speedScale(owner, .1, allReach), 1); assert.deepEqual(owner, before);
    for (const invalid of [NaN, Infinity, -Infinity, -.01, 1.01, '0.55', null, undefined, {}]) assert.equal(engine.mitigateSlow(owner, invalid, .1), 1);
    const ally = { ...owner, id: 'other' }; assert.equal(engine.mitigateSlow(ally, .55, .1), .55);
    engine.cast('mend-seeds', actor('gardener', 'red'), target(0, -5, .12), .1, 1);
    engine.cast('frost-stitch', actor('opponent', 'red'), target(0, -5, .12), .1, 1);
    const options = { ...allReach, groundHeight: () => 0 }, raw = Math.min(.55, engine.speedScale(owner, 1, options));
    assert.equal(raw, .45); near(engine.mitigateSlow(owner, raw, 1), .9175, 'The min result is mitigated once, not multiplied or mitigated per-field');
    engine.cast('echo-kerning', owner, target(2, -5), 2, 1); near(engine.mitigateSlow(owner, raw, 2) * engine.movementScale(owner, 2), .9175 * 1.35);
    near(engine.mitigateSlow(owner, .55, 4.999999), .9325); assert.equal(engine.mitigateSlow(owner, .55, 5), .55); assert.equal(engine.movementScale(owner, 5), 1.35);
  });
  test('FROST unravel is permanently cancelled by airborne, dead, absent or wrong-team source samples in queries and authoritative updates', () => {
    const owner = actor('doll', 'blue', 0, 0, { grounded: true });
    for (const hz of [20, 60, 144]) for (const method of ['query', 'update', 'movement']) for (const extra of [{ grounded: false }, { grounded: undefined }, { grounded: 1 }, { alive: false, hp: 0 }, { team: 'red' }]) {
      const engine = createCharacterSkills(), event = engine.cast('frost-unravel', owner, target(0, 0), 0, 1), changed = { ...owner, ...extra }, time = 1 / hz;
      if (method === 'query') assert.equal(engine.mitigateSlow(changed, .55, time), .55);
      else if (method === 'movement') assert.equal(engine.movementScale(changed, time), 1);
      else assert.deepEqual(engine.update([changed], time, 1, allReach), []);
      assert.equal(engine.events(time).some(value => value.id === event.id), false); assert.equal(engine.mitigateSlow(owner, .55, time * 2), .55);
    }
    const absent = createCharacterSkills(); absent.cast('frost-unravel', owner, target(0, 0), 0, 1); absent.update([], .1, 1, allReach); assert.equal(absent.mitigateSlow(owner, .55, .2), .55);
    const invalidRaw = createCharacterSkills(); invalidRaw.cast('frost-unravel', owner, target(0, 0), 0, 1); assert.equal(invalidRaw.mitigateSlow({ ...owner, grounded: false }, NaN, .1), 1); assert.equal(invalidRaw.events(.1).length, 0);
  });
  test('FROST restore accepts only canonical common fields and fixed timers, rejects duplicate signatures atomically and owns no effects', () => {
    const owner = actor('doll', 'blue', 0, 0, { grounded: true }), host = createCharacterSkills();
    host.cast('frost-stitch', owner, target(0, -16, .12), 0, 1); host.cast('frost-mist', owner, target(0, -18, 1.4), 0, 1); host.cast('frost-unravel', owner, target(0, 0), 0, 1);
    const packet = json(host.snapshot()), guest = createCharacterSkills(); assert.equal(guest.restore(packet, 0, 1), true); assert.deepEqual(guest.snapshot(), packet);
    const invalids = [];
    for (const index of [0, 1, 2]) for (const [key, value] of [['radius', 99], ['flight', 9], ['triggerAt', 9], ['endsAt', 99], ['innerRadius', 0], ['slowFraction', 1], ['speedScale', 0], ['grounded', true], ['targetId', 'secret'], ['weaponId', 'vandal'], ['extra', true]]) { const bad = json(packet); bad.events[index][key] = value; invalids.push(bad); }
    for (const [index, key, value] of [[0, 'z', -16.001], [1, 'z', -18.001], [2, 'x', .001], [2, 'y', .001], [2, 'z', .001], [0, 'fromY', NaN], [1, 'round', 2]]) { const bad = json(packet); bad.events[index][key] = value; invalids.push(bad); }
    const duplicate = json(packet); duplicate.events.push({ ...duplicate.events[2], id: 'skill-frost-unravel-99' }); invalids.push(duplicate);
    for (const bad of invalids) { const before = guest.snapshot(); assert.equal(guest.restore(bad, .1, 1), false); assert.deepEqual(guest.snapshot(), before); }
    assert.equal(guest.restore(packet, .1, 1), true); near(guest.mitigateSlow(owner, .55, .1), .9325);
    assert.deepEqual(guest.update([owner, actor('enemy', 'red', 2, -12, { grounded: true })], .8, 1, allReach), []); assert.deepEqual(guest.snapshot().blinds, []); assert.deepEqual(guest.markers('blue', .8), []);
    guest.events(10); assert.equal(guest.restore(packet, .9, 1), true); assert.equal(guest.events(10).length, 0, 'The leading render clock prevents expired effect resurrection');
    assert.equal(guest.restore(packet, .89, 1), false); assert.equal(guest.restore({ events: [], blinds: [], markers: [] }, 0, 2), true); assert.equal(guest.restore(packet, .9, 1), false);
    const detached = host.events(0); detached[0].radius = 999; assert.equal(host.events(0)[0].radius, 3.8);
  });
  test('FROST capacity rejects before consuming an event ID and lets each paid stock or cooldown roll back without evicting anything', () => {
    const engine = createCharacterSkills(), owner = actor('doll', 'blue', 0, 0, { grounded: true });
    for (let index = 0; index < 20; index++) assert.ok(engine.cast('nope-decoy', owner, target(0, -5), 0, 1));
    const retained = json(engine.snapshot());
    for (const [key, destination] of [['c', target(0, -5, .12)], ['q', target(0, -5, 1.4)], ['e', target(0, 0)]]) {
      const kit = new DuelistKit({ character: 'frost' }); kit.buy('c', () => true); kit.buy('q', () => true); const before = kit.snapshot(), effect = kit.activate(key, 0);
      assert.equal(engine.cast(effect, owner, destination, 0, 1), null); kit.restore(before); assert.deepEqual(kit.snapshot(), before); assert.deepEqual(engine.snapshot(), retained);
    }
    engine.events(12); const next = engine.cast('frost-unravel', owner, target(0, 0), 12, 1); assert.ok(next.id.endsWith('-21'));
    const before = engine.snapshot(); for (const invalid of [NaN, Infinity, -1, '12', 11]) assert.equal(engine.cast('frost-mist', owner, target(0, -5, 1.4), invalid, 1), null); assert.deepEqual(engine.snapshot(), before);
    engine.reset(); assert.deepEqual(engine.snapshot(), { events: [], blinds: [], markers: [] }); assert.equal(engine.mitigateSlow(owner, .55, 0), .55);
  });
  test('WIND comet uses a full eighteen-meter sphere around the crouched eye and lift is a fixed self-feet event without a ground gate', () => {
    for (const crouch of [0, .5, 1]) {
      const owner = actor('mascot', 'blue', 2, 3, { y: 3.2, crouch, grounded: false, vy: 2 }), eye = 4.9 - crouch * .55;
      for (const [dx, dy, dz] of [[18, 0, 0], [-18, 0, 0], [0, 18, 0], [0, -18, 0], [0, 0, 18], [0, 0, -18], [10.8, 14.4, 0]]) {
        const engine = createCharacterSkills(), event = engine.cast({ type: 'duelist-comet', radius: 99, flight: 0 }, owner, target(2 + dx, 3 + dz, eye + dy), 5, 1);
        assert.ok(event, `crouch=${crouch} delta=${dx}/${dy}/${dz}`); near(event.fromY, eye); assert.equal(event.flight, .25); near(event.triggerAt, 5.25); near(event.endsAt, 10.25); assert.equal(event.radius, 2.8);
        assert.equal(Object.keys(event).length, 16); assert.equal(Object.hasOwn(event, 'crouch'), false);
        assert.equal(engine.cast('duelist-comet', owner, target(2 + dx * 1.0001, 3 + dz * 1.0001, eye + dy * 1.0001), 5, 1), null);
      }
      assert.equal(createCharacterSkills().cast('duelist-comet', owner, target(20, 3, eye + .1), 5, 1), null, 'A horizontally valid target may exceed the full3D range');
      const engine = createCharacterSkills(), lift = engine.cast('duelist-lift', owner, target(2, 3, 3.2), 5, 1);
      assert.ok(lift); assert.equal(lift.fromY, 3.2); assert.equal(lift.flight, 0); assert.equal(lift.triggerAt, 5); near(lift.endsAt, 5.45); assert.equal(lift.radius, 0); assert.equal(Object.keys(lift).length, 16);
      assert.deepEqual(skillProjectilePosition(lift, 5.2), target(2, 3, 3.2));
      for (const destination of [target(2.001, 3, 3.2), target(2, 3.001, 3.2), target(2, 3, 3.201)]) assert.equal(createCharacterSkills().cast('duelist-lift', owner, destination, 5, 1), null);
    }
    assert.equal(DUELIST_SKILLS.cometRange, 18); assert.equal(DUELIST.updraftVelocity, 7.8);
  });
  test('WIND comet is analytic and strictly linear while all existing arced projectiles retain their trajectories', () => {
    const engine = createCharacterSkills(), owner = actor('mascot', 'blue', 2, 3, { y: 2, crouch: 1 }), event = engine.cast('duelist-comet', owner, target(8, -3, 7), 0, 1);
    assert.ok(event); near(event.fromY, 3.15);
    for (const hz of [20, 60, 144]) for (let frame = 0; frame <= Math.ceil(.25 * hz); frame++) {
      const now = frame / hz, fraction = Math.min(1, now / .25), position = skillProjectilePosition(event, now);
      near(position.x, 2 + 6 * fraction); near(position.y, 3.15 + (7 - 3.15) * fraction); near(position.z, 3 - 6 * fraction);
    }
    const start = skillProjectilePosition(event, 0), end = skillProjectilePosition(event, 3); near(start.y, 3.15); assert.deepEqual(end, target(8, -3, 7));
    const old = createCharacterSkills();
    for (const [type, flight, arc, y] of [['nope-bottle', .55, 1.4, .12], ['mend-seeds', .65, 1.4, .12], ['frost-stitch', .55, .8, .12], ['frost-mist', .5, .8, 1.4], ['ember-solder', .45, .8, .12]]) {
      const projectile = old.cast(type, actor(), target(0, -5, y), 0, 1); near(skillProjectilePosition(projectile, flight / 2).y, (1.7 + y) / 2 + arc);
    }
  });
  test('WIND comet and lift only describe passive visuals, never apply impulse or combat effects, and persist at their cast point after source death', () => {
    for (const hz of [20, 60, 144]) {
      const engine = createCharacterSkills(), owner = actor('mascot', 'blue', 0, 0, { y: 3.2, grounded: false, vy: 1.25, vx: 2, vz: -3, dashTimer: .1, dashVec: { x: 1, z: 0 }, ammo: 5, hp: 75 });
      const before = json(owner), comet = engine.cast('duelist-comet', owner, target(0, -6, 6), 0, 1), lift = engine.cast('duelist-lift', owner, target(0, 0, 3.2), 0, 1);
      assert.ok(comet); assert.ok(lift);
      for (let frame = 0; frame < Math.ceil(.45 * hz); frame++) {
        const now = frame / hz; assert.deepEqual(engine.update([owner, actor('enemy', 'red', 0, -6, { y: 6 })], now, 1, allReach), []);
        assert.deepEqual(owner, before); assert.equal(engine.movementScale(owner, now), 1); assert.equal(engine.speedScale(owner, now, allReach), 1);
      }
      assert.equal(engine.events(.45).some(event => event.type === 'duelist-lift'), false); assert.equal(owner.vy, 1.25);
      assert.deepEqual(engine.update([{ ...owner, x: 20, alive: false, hp: 0 }], .5, 1, allReach), []); assert.equal(engine.events(.5)[0].id, comet.id); assert.equal(engine.events(.5)[0].y, 6);
      assert.equal(engine.blindUntil('enemy', .5), 0); assert.deepEqual(engine.markers('blue', .5), []); assert.equal(engine.events(5.25).length, 0);
      const death = createCharacterSkills(); death.cast('duelist-lift', owner, target(0, 0, 3.2), 0, 1); assert.deepEqual(death.update([], .1, 1, allReach), []); assert.equal(death.events(.449).length, 1); assert.equal(death.events(.45).length, 0);
    }
  });
  test('WIND canonical JSON uses the exact eye origin without adding eye height again, owns no effects and rejects forged schema atomically', () => {
    const host = createCharacterSkills(), owner = actor('mascot', 'blue', 0, 0, { crouch: 1, grounded: false }), eye = 1.15;
    host.cast('duelist-comet', owner, target(0, -18, eye), 0, 1); host.cast('duelist-lift', owner, target(0, 0), 0, 1);
    const packet = json(host.snapshot()), guest = createCharacterSkills(); assert.equal(guest.restore(packet, 0, 1), true); assert.deepEqual(guest.snapshot(), packet);
    assert.deepEqual(guest.update([owner], .1, 1, allReach), []); const invalids = [];
    for (const index of [0, 1]) for (const [key, value] of [['flight', 9], ['radius', 9], ['triggerAt', 9], ['endsAt', 99], ['velocity', 99], ['crouch', 1], ['speedScale', 9], ['targetId', 'hidden'], ['weaponId', 'vandal'], ['extra', true]]) {
      const bad = json(packet); bad.events[index][key] = value; invalids.push(bad);
    }
    for (const [index, key, value] of [[0, 'y', eye + .1], [0, 'z', -18.001], [0, 'fromY', eye + .1], [1, 'x', .001], [1, 'y', .001], [1, 'z', .001], [1, 'round', 2]]) { const bad = json(packet); bad.events[index][key] = value; invalids.push(bad); }
    const duplicate = json(packet); duplicate.events.push({ ...duplicate.events[0] }); invalids.push(duplicate);
    for (const bad of invalids) { const before = guest.snapshot(); assert.equal(guest.restore(bad, .1, 1), false); assert.deepEqual(guest.snapshot(), before); }
    assert.equal(guest.restore(packet, .1, 1), true); assert.deepEqual(guest.update([owner], .3, 1, allReach), []); assert.equal(guest.events(.45).length, 1);
    guest.events(6); assert.equal(guest.restore(packet, .2, 1), true); assert.equal(guest.events(6).length, 0); assert.equal(guest.restore(packet, .19, 1), false);
    assert.equal(guest.restore({ events: [], blinds: [], markers: [] }, 0, 2), true); assert.equal(guest.restore(packet, .3, 1), false);
    const detached = host.events(0); detached[0].y = 999; assert.equal(host.events(0)[0].y, eye);
  });
  test('WIND twenty-event rejection leaves all existing events and sequence intact and allows both stocks to roll back before game-owned impulse', () => {
    const engine = createCharacterSkills(), owner = actor('mascot', 'blue', 0, 0, { vy: -1, grounded: false });
    for (let index = 0; index < 20; index++) assert.ok(engine.cast('duelist-comet', owner, target(0, -5, 4), 0, 1));
    const retained = json(engine.snapshot());
    for (const [key, destination] of [['c', target(0, -5, 4)], ['q', target(0, 0)]]) {
      const kit = new DuelistKit(); kit.buy('c', () => true); kit.buy('q', () => true); const before = kit.snapshot(), effect = kit.activate(key, 0);
      assert.equal(engine.cast(effect, owner, destination, 0, 1), null); kit.restore(before); assert.deepEqual(kit.snapshot(), before); assert.deepEqual(engine.snapshot(), retained); assert.equal(owner.vy, -1);
    }
    engine.events(5.25); const next = engine.cast('duelist-lift', owner, target(0, 0), 5.25, 1); assert.ok(next.id.endsWith('-21'));
    const before = engine.snapshot(); for (const invalid of [NaN, Infinity, -1, '5.25', 5.24]) assert.equal(engine.cast('duelist-comet', owner, target(0, -5, 4), invalid, 1), null); assert.deepEqual(engine.snapshot(), before);
    engine.reset(); assert.deepEqual(engine.snapshot(), { events: [], blinds: [], markers: [] });
  });
  const actualSource = fs.readFileSync(path.join(__dirname, 'public/character-skills.js'), 'utf8');
  async function memoryEngine(before, after) {
    assert.ok(actualSource.includes(before), 'The negative control must change an actual source expression');
    const source = actualSource.replace(before, after).replace(/from '(\.\/[a-z-]+\.js)'/g, (_, file) => `from ${JSON.stringify(pathToFileURL(path.join(__dirname, 'public', file)).href)}`);
    return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  }
  const arcMutant = await memoryEngine("event.type === 'duelist-comet' || event.type === 'renko-dart' ? 0 :", "event.type === 'duelist-comet' ? .8 : event.type === 'renko-dart' ? 0 :");
  const rangeMutant = await memoryEngine('Math.hypot(target.x - actor.x, target.y - sourceEyeY, target.z - actor.z)', 'Math.hypot(target.x - actor.x, target.z - actor.z)');
  const restoreMutant = await memoryEngine('}, value, value.fromY)', '}, value)');
  test('WIND memory-only negative controls detect an accidental arc, horizontal-only range and doubled eye origin during restore', () => {
    const arced = arcMutant.createCharacterSkills(), arcEvent = arced.cast('duelist-comet', actor(), target(0, -6, 5), 0, 1);
    near(arcMutant.skillProjectilePosition(arcEvent, .125).y, (1.7 + 5) / 2 + .8);
    assert.throws(() => near(arcMutant.skillProjectilePosition(arcEvent, .125).y, (1.7 + 5) / 2), { name: 'AssertionError' }, 'An unwanted arc fails the same midpoint assertion as the real helper');
    const horizontal = rangeMutant.createCharacterSkills(); assert.ok(horizontal.cast('duelist-comet', actor(), target(0, 0, 19.701), 0, 1)); assert.equal(createCharacterSkills().cast('duelist-comet', actor(), target(0, 0, 19.701), 0, 1), null);
    const owner = actor('mascot', 'blue', 0, 0, { crouch: 1 }), good = createCharacterSkills(); good.cast('duelist-comet', owner, target(0, -18, 1.15), 0, 1);
    assert.equal(restoreMutant.createCharacterSkills().restore(json(good.snapshot()), 0, 1), false); assert.equal(createCharacterSkills().restore(json(good.snapshot()), 0, 1), true);
  });
  console.log(`Character skill tests passed: ${passed} groups.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
