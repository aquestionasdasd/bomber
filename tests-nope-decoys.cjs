const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const started = process.hrtime.bigint(), cpu = process.cpuUsage();
  const moduleURL = pathToFileURL(path.join(__dirname, 'public/nope-decoys.js')).href;
  const { createNopeDecoys } = await import(moduleURL);
  const owner = (extra = {}) => ({ id: 'caster', team: 'blue', x: 0, y: 0, z: 0, hp: 100, alive: true, ...extra });
  const points = () => Array.from({ length: 30 }, (_, index) => ({ x: (index % 6) * 7 + .1234, y: index % 3 ? 0 : 3.2, z: Math.floor(index / 6) * -8, yaw: index * .23 }));
  const json = value => JSON.parse(JSON.stringify(value));
  const eventFields = ['id', 'type', 'team', 'sourceId', 'round', 'x', 'y', 'z', 'yaw', 'startedAt', 'endsAt'].sort();
  let passed = 0;
  const test = (name, run) => { run(); passed++; console.log(`PASS: ${name}`); };

  test('one canonical thirty-point wave has bounded detached meter/radian events and an integer compact wire', () => {
    const engine = createNopeDecoys(), source = owner(), positions = points();
    assert.equal(engine.start(source, positions, 2, 1), true);
    const events = engine.events(2), packet = engine.snapshot();
    assert.equal(events.length, 30); assert.equal(new Set(events.map(event => event.id)).size, 30);
    assert.deepEqual(Object.keys(packet).sort(), ['id', 'team', 'sourceId', 'round', 'startedAt', 'endsAt', 'points', 'shotMask'].sort());
    assert.equal(packet.id, 'nope-wave-1-1'); assert.equal(packet.shotMask, 0); assert.equal(packet.points.length, 30);
    events.forEach((event, index) => {
      assert.deepEqual(Object.keys(event).sort(), eventFields); assert.equal(event.id, `nope-wave-1-1-${index + 1}`);
      assert.equal(event.type, 'nope-decoy'); assert.equal(event.sourceId, source.id); assert.equal(event.team, 'blue'); assert.equal(event.round, 1);
      assert.equal(event.startedAt, 2); assert.equal(event.endsAt, 14);
      assert.ok(Math.abs(event.x - positions[index].x) <= .005); assert.ok(Math.abs(event.y - positions[index].y) <= .005); assert.ok(Math.abs(event.z - positions[index].z) <= .005);
      assert.ok(Math.abs(Math.atan2(Math.sin(event.yaw - positions[index].yaw), Math.cos(event.yaw - positions[index].yaw))) <= .000051);
      assert.ok(packet.points[index].every(Number.isInteger));
    });
    positions[0].x = 900; events[0].x = 900; events.push({}); packet.points[0][0] = 90000; packet.shotMask = 1;
    assert.equal(engine.events(2)[0].x, .12); assert.equal(engine.snapshot().shotMask, 0);
  });

  test('invalid living sources, clocks and rounds never replace an existing wave or consume sequence IDs', () => {
    const engine = createNopeDecoys(); assert.equal(engine.start(owner(), points(), 1, 1), true);
    const before = engine.snapshot();
    for (const source of [null, {}, owner({ id: '' }), owner({ id: 'x'.repeat(65) }), owner({ id: 'bad\nname' }), owner({ team: 'green' }), owner({ alive: false }), owner({ alive: 1 }), owner({ hp: 0 }), owner({ hp: 1000.01 }), owner({ hp: '100' }), owner({ x: NaN }), owner({ y: Infinity }), owner({ z: 1000.01 })]) {
      assert.equal(engine.start(source, points(), 1, 1), false); assert.deepEqual(engine.snapshot(), before);
    }
    for (const now of [NaN, Infinity, -1, '1', .999, Number.MAX_VALUE]) assert.equal(engine.start(owner(), points(), now, 1), false);
    for (const round of [NaN, 0, -1, 1.5, '1']) assert.equal(engine.start(owner(), points(), 1, round), false);
    assert.deepEqual(engine.snapshot(), before); assert.equal(engine.start(owner(), points(), 1, 1), true); assert.equal(engine.snapshot().id, 'nope-wave-1-2');
  });

  test('exactly thirty distinct centimeter positions are required and malformed or collapsed points reject atomically', () => {
    const engine = createNopeDecoys(); engine.start(owner(), points(), 0, 1); const before = engine.snapshot();
    const invalids = [null, {}, [], points().slice(1), [...points(), points()[0]]];
    for (const patch of [{ x: NaN }, { y: Infinity }, { z: -1000.01 }, { yaw: NaN }, { yaw: '0' }, { y: undefined }]) { const data = points(); data[12] = { ...data[12], ...patch }; invalids.push(data); }
    const duplicate = points(); duplicate[29] = { ...duplicate[0], yaw: 1 }; invalids.push(duplicate);
    const collapsed = points(); collapsed[29] = { ...collapsed[0], x: collapsed[0].x + .0001 }; invalids.push(collapsed);
    const sparse = points(); delete sparse[10]; invalids.push(sparse);
    for (const invalid of invalids) { assert.equal(engine.start(owner(), invalid, 0, 1), false); assert.deepEqual(engine.snapshot(), before); }
    const layered = points(); layered[29] = { ...layered[0], y: 3.21 }; assert.equal(engine.start(owner(), layered, 0, 1), true, 'The same XZ on a different floor is a distinct point');
  });

  test('twelve-second expiry is absolute across frame cadences and a view clock cannot rewind it', () => {
    for (const hz of [20, 60, 144]) {
      const engine = createNopeDecoys(); engine.start(owner(), points(), .3, 1);
      for (let frame = 0; frame < 12 * hz; frame++) assert.equal(engine.events(.3 + frame / hz).length, 30);
      assert.equal(engine.events(12.299999).length, 30); assert.deepEqual(engine.events(12.3), []); assert.equal(engine.snapshot(), null);
      assert.deepEqual(engine.events(.3), []); assert.equal(engine.consume('nope-wave-1-1-1', 'red', 12.3, 1), null);
    }
    const engine = createNopeDecoys(); engine.start(owner(), points(), 1, 1); const before = engine.snapshot();
    for (const now of [NaN, Infinity, -1, '2']) { assert.deepEqual(engine.events(now), []); assert.deepEqual(engine.snapshot(), before); }
  });

  test('only an enemy can consume a live owned decoy once, including bit29 and exact expiry', () => {
    const engine = createNopeDecoys(); engine.start(owner(), points(), 0, 1); const events = engine.events(1), first = events[0], last = events[29];
    for (const [id, shooterTeam, now, round] of [[first.id, 'blue', 1, 1], [first.id, 'green', 1, 1], [first.id, null, 1, 1], [first.id, 'red', .999, 1], [first.id, 'red', 1, 2], [first.id, 'red', 1, '1'], ['unknown', 'red', 1, 1], [`${first.id}00`, 'red', 1, 1], ['nope-wave-1-1-01', 'red', 1, 1]]) assert.equal(engine.consume(id, shooterTeam, now, round), null);
    assert.deepEqual(engine.consume(first.id, 'red', 1, 1), first); assert.equal(engine.consume(first.id, 'red', 1, 1), null);
    const removed = engine.consume(last.id, 'red', 1, 1); assert.deepEqual(removed, last); removed.x = 900;
    assert.equal(engine.snapshot().shotMask, 1 + 2 ** 29); assert.equal(engine.events(1).length, 28); assert.ok(engine.events(1).every(event => event.id !== first.id && event.id !== last.id));
    assert.equal(engine.consume(events[1].id, 'red', 12, 1), null); assert.equal(engine.snapshot(), null);
  });

  test('all thirty enemy hits set the full unsigned30-bit mask without extra effects or an ordinary-pool dependency', () => {
    const engine = createNopeDecoys(); engine.start(owner({ team: 'red' }), points(), 0, 1);
    const events = engine.events(0); for (const event of events) { assert.deepEqual(engine.consume(event.id, 'blue', 1, 1), event); assert.equal(engine.consume(event.id, 'blue', 1, 1), null); }
    assert.equal(engine.snapshot().shotMask, 0x3fffffff); assert.deepEqual(engine.events(1), []);
    assert.equal(engine.start(owner(), points(), 1, 1), true); assert.equal(engine.events(1).length, 30); assert.equal(engine.snapshot().shotMask, 0);
  });

  test('a newer same-time X replaces the global wave with unique IDs, fixed pose and no dependence on source death', () => {
    const engine = createNopeDecoys(), source = owner(), positions = points(); engine.start(source, positions, 3, 1);
    const old = engine.snapshot(), oldIds = engine.events(3).map(event => event.id); source.alive = false; source.hp = 0; source.x = 300; source.team = 'red';
    assert.equal(engine.events(3.1).length, 30); assert.equal(engine.events(3.1)[0].sourceId, 'caster'); assert.equal(engine.events(3.1)[0].team, 'blue');
    const replacement = owner({ id: 'second', team: 'red' }); assert.equal(engine.start(replacement, positions, 3.1, 1), true);
    const second = engine.events(3.1); assert.ok(second.every(event => !oldIds.includes(event.id))); assert.equal(second[0].sourceId, 'second');
    assert.equal(engine.start(owner(), positions, 3.1, 1), true); assert.equal(engine.snapshot().id, 'nope-wave-1-3');
    assert.equal(engine.consume(oldIds[0], 'red', 3.1, 1), null); const before = engine.snapshot(); assert.equal(engine.restore(old, 4, 1), false); assert.deepEqual(engine.snapshot(), before);
  });

  test('JSON restoration is detached and guests never own shot consumption or gameplay actions', () => {
    const host = createNopeDecoys(), guest = createNopeDecoys(); host.start(owner(), points(), 0, 1);
    const packet = json(host.snapshot()); assert.equal(guest.restore(packet, 0, 1), true); assert.deepEqual(guest.events(0), host.events(0));
    assert.equal(guest.consume(guest.events(0)[0].id, 'red', 0, 1), null); assert.equal(guest.events(0).length, 30);
    packet.points[0][0] = 90000; packet.sourceId = 'injected'; packet.shotMask = 0x3fffffff;
    assert.equal(guest.events(0)[0].x, .12); assert.equal(guest.events(0)[0].sourceId, 'caster');
  });

  test('same-wave shot masks only accumulate and older or duplicate snapshots cannot revive a hit', () => {
    const host = createNopeDecoys(), guest = createNopeDecoys(); host.start(owner(), points(), 0, 1); const original = json(host.snapshot()), first = host.events(0)[0];
    assert.equal(guest.restore(original, 0, 1), true); host.consume(first.id, 'red', 1, 1); const shot = json(host.snapshot());
    assert.equal(guest.restore(shot, 1, 1), true); assert.equal(guest.events(1).length, 29);
    assert.equal(guest.restore(original, .999999, 1), false); assert.equal(guest.restore(original, 1, 1), true); assert.equal(guest.events(1).length, 29);
    assert.equal(guest.restore(original, 1.1, 1), true); assert.equal(guest.snapshot().shotMask, 1);
    host.consume(host.events(1)[28].id, 'red', 1.1, 1); assert.equal(guest.restore(json(host.snapshot()), 1.1, 1), true); assert.equal(guest.events(1.1).length, 28);
  });

  test('host ordering remains independent of a leading render clock, while expiry and null clears are permanent for that wave', () => {
    const host = createNopeDecoys(), guest = createNopeDecoys(); host.start(owner(), points(), 0, 1); const original = json(host.snapshot());
    assert.equal(guest.restore(original, .1, 1), true); assert.equal(guest.events(5).length, 30); assert.equal(guest.restore(original, .2, 1), true);
    assert.deepEqual(guest.events(12), []); assert.equal(guest.restore(original, .3, 1), true); assert.deepEqual(guest.events(.3), []); assert.equal(guest.snapshot(), null);
    assert.equal(guest.restore(original, .25, 1), false);
    const cleared = createNopeDecoys(); assert.equal(cleared.restore(original, 0, 1), true); assert.equal(cleared.restore(null, .1, 1), true);
    assert.equal(cleared.restore(original, .1, 1), true); assert.deepEqual(cleared.events(.1), []); assert.equal(cleared.snapshot(), null);
    host.start(owner(), points(), 1, 1); assert.equal(cleared.restore(json(host.snapshot()), 1, 1), true); assert.equal(cleared.events(1).length, 30);
    assert.equal(cleared.restore(original, 2, 1), false);
  });

  test('new rounds and resets clear state, preserve unique sequence IDs, and cannot accept old-round packets', () => {
    const engine = createNopeDecoys(); engine.start(owner(), points(), 3, 1); const first = engine.snapshot();
    assert.equal(engine.start(owner(), points(), 0, 2), true); assert.equal(engine.snapshot().id, 'nope-wave-2-2');
    assert.equal(engine.start(owner(), points(), 4, 1), false); assert.equal(engine.restore(first, 4, 1), false);
    engine.reset(); assert.equal(engine.snapshot(), null); assert.deepEqual(engine.events(0), []); assert.equal(engine.start(owner(), points(), 0, 1), true); assert.equal(engine.snapshot().id, 'nope-wave-1-3');
    const guest = createNopeDecoys(); assert.equal(guest.restore(null, 0, 2), true); assert.equal(guest.restore(first, 3, 1), false);
  });

  test('strict JSON rejects malformed fields, masks, IDs, timers, duplicate points and unknown data atomically', () => {
    const host = createNopeDecoys(), guest = createNopeDecoys(); host.start(owner(), points(), 1, 2); const good = json(host.snapshot());
    assert.equal(guest.restore(good, 1, 2), true);
    const invalids = [undefined, [], {}, Object.create(good), { ...good, targetId: 'secret' }, { ...good, points: null }, { ...good, points: good.points.slice(1) }];
    for (const [key, value] of [['id', 'nope-wave-2-0'], ['id', 'nope-wave-02-1'], ['id', 'nope-wave-2-01'], ['id', 'nope-wave-1-1'], ['id', 'nope-wave-2-1000000000000000'], ['sourceId', ''], ['sourceId', 'bad\nname'], ['team', 'green'], ['round', 1], ['round', '2'], ['startedAt', 2], ['startedAt', NaN], ['endsAt', 12], ['endsAt', 13.0001], ['shotMask', -1], ['shotMask', 2 ** 30], ['shotMask', 1.5], ['shotMask', '1']]) invalids.push({ ...good, [key]: value });
    for (const key of Object.keys(good)) { const bad = json(good); delete bad[key]; invalids.push(bad); }
    for (const replacement of [[0, 0, 0], [0, 0, 0, 0, 1], [100001, 0, 0, 0], [0, -100001, 0, 0], [0, 0, Infinity, 0], [0, 0, 0, 31417], [.1, 0, 0, 0], ['1', 0, 0, 0]]) { const bad = json(good); bad.points[1] = replacement; invalids.push(bad); }
    const duplicate = json(good); duplicate.points[1] = [...duplicate.points[0]]; invalids.push(duplicate);
    const extraPointKey = json(good); extraPointKey.points[0].secret = 1; invalids.push(extraPointKey);
    for (const bad of invalids) { const before = guest.snapshot(); assert.equal(guest.restore(bad, 1, 2), false); assert.deepEqual(guest.snapshot(), before); }
    for (const now of [NaN, Infinity, -1, '1']) assert.equal(guest.restore(good, now, 2), false);
    for (const round of [0, 1.2, '2', NaN]) assert.equal(guest.restore(good, 1, round), false);
    assert.equal(guest.restore(good, 1, 2), true);
  });

  test('a known ID cannot silently change immutable identity, position, source, time or yaw even with a newer packet clock', () => {
    const host = createNopeDecoys(), guest = createNopeDecoys(); host.start(owner(), points(), 1, 1); const good = json(host.snapshot()); guest.restore(good, 1, 1);
    for (const patch of [{ sourceId: 'another' }, { team: 'red' }, { startedAt: 1.1, endsAt: 13.1 }]) { const bad = { ...good, ...patch }; assert.equal(guest.restore(bad, 2, 1), false); assert.deepEqual(guest.snapshot(), good); }
    for (const axis of [0, 1, 2, 3]) { const bad = json(good); bad.points[0][axis]++; assert.equal(guest.restore(bad, 2, 1), false); assert.deepEqual(guest.snapshot(), good); }
    const premature = { ...json(good), id: 'nope-wave-1-2', startedAt: .5, endsAt: 12.5 }; assert.equal(guest.restore(premature, 2, 1), false);
  });

  let typicalBytes, maximumBytes;
  test('compact30-point snapshots stay below2200 UTF8 bytes at coordinate, mask, identifier and sequence limits', () => {
    const engine = createNopeDecoys(); engine.start(owner(), points(), 0, 1); typicalBytes = Buffer.byteLength(JSON.stringify(engine.snapshot()));
    const edge = points().map((point, index) => ({ x: -1000 + index * .01, y: 1000 - index * .01, z: -999.99 + index * .01, yaw: index % 2 ? Math.PI : -Math.PI }));
    const huge = createNopeDecoys(), round = Number.MAX_SAFE_INTEGER; assert.equal(huge.start(owner({ id: '界'.repeat(64) }), edge, 1e12, round), true);
    const packet = huge.snapshot(); packet.id = `nope-wave-${round}-999999999999999`; packet.shotMask = 0x3fffffff;
    const guest = createNopeDecoys(); assert.equal(guest.restore(json(packet), 1e12, round), true); maximumBytes = Buffer.byteLength(JSON.stringify(guest.snapshot()));
    assert.ok(typicalBytes <= 2200); assert.ok(maximumBytes <= 2200); assert.deepEqual(guest.events(1e12), []);
    const before = guest.snapshot(); assert.equal(guest.start(owner(), points(), 1e12, round), false, 'Sequence exhaustion never reuses IDs'); assert.deepEqual(guest.snapshot(), before);
    const red = createNopeDecoys(); assert.equal(red.restore(json(packet), 1e12, round), true); assert.equal(red.snapshot().id, packet.id);
  });

  const actual = fs.readFileSync(path.join(__dirname, 'public/nope-decoys.js'), 'utf8');
  async function mutant(before, after) {
    assert.ok(actual.includes(before));
    const code = actual.replace(before, after).replace("'./nope-walk.js'", JSON.stringify(pathToFileURL(path.join(__dirname,'public/nope-walk.js')).href)).replace("from './abilities.js'", `from ${JSON.stringify(pathToFileURL(path.join(__dirname, 'public/abilities.js')).href)}`);
    return (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))).createNopeDecoys;
  }
  const allowFriendly = await mutant('|| shooterTeam === wave.team', '|| false');
  const rewindMask = await mutant('wave.shotMask |= value.shotMask;', 'wave.shotMask = value.shotMask;');
  const truncate = await mutant('index < COUNT; index++', 'index < COUNT - 1; index++');
  test('memory-only negative controls detect friendly activation, snapshot resurrection and a truncated30-body wave', () => {
    const friendly = allowFriendly(); friendly.start(owner(), points(), 0, 1);
    assert.throws(() => assert.equal(friendly.consume(friendly.events(0)[0].id, 'blue', 0, 1), null), { name: 'AssertionError' });
    const host = createNopeDecoys(); host.start(owner(), points(), 0, 1); const before = host.snapshot(); host.consume(host.events(0)[0].id, 'red', 0, 1); const after = host.snapshot();
    const guest = rewindMask(); guest.restore(after, 0, 1); guest.restore(before, 0, 1); assert.throws(() => assert.equal(guest.events(0).length, 29), { name: 'AssertionError' });
    const short = truncate(); short.start(owner(), points(), 0, 1); assert.throws(() => assert.equal(short.events(0).length, 30), { name: 'AssertionError' });
  });
  const usage = process.cpuUsage(cpu);
  console.log(`NOPE decoy tests passed: ${passed} groups; typical ${typicalBytes}B/max ${maximumBytes}B;3 memory-only negative controls; wall ${Number(process.hrtime.bigint() - started) / 1e6}ms/CPU ${(usage.user + usage.system) / 1000}ms.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
