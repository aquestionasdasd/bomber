const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const { createZoneAbilities } = await import(pathToFileURL(path.join(__dirname, 'public/zone-abilities.js')).href);
  const actor = (id, team = 'blue', x = 0, z = 0, y = 0) => ({ id, team, x, y, z, hp: 100, armor: 50, alive: true });
  const point = (x = 0, z = 0, y = 0) => ({ x, y, z });
  const wire = value => JSON.parse(JSON.stringify(value));
  let passed = 0;
  const test = (name, fn) => { fn(); passed++; console.log(`PASS: ${name}`); };

  test('zone casts retain fixed ground centers, timing and source identity without mutating actors', () => {
    const zones = createZoneAbilities(), caster = actor('caster', 'blue', 2, 3, 1);
    const ember = zones.cast('ember', caster, point(8, 3, .5), 10, 2);
    assert.match(ember.id, /^zone-ember-[1-9][0-9]*$/);
    assert.deepEqual({ ...ember, id: null }, { id: null, type: 'ember', team: 'blue', sourceId: 'caster', x: 8, y: .5, z: 3, startedAt: 10, endsAt: 14.8, radius: 6, round: 2 });
    const frost = zones.cast('frost', caster, point(2, 5), 10, 2);
    assert.equal(frost.radius, 7); assert.equal(frost.endsAt, 20); assert.notEqual(frost.id, ember.id);
    caster.x = 100; ember.x = 900; frost.radius = 100;
    assert.equal(zones.events(10)[0].x, 8); assert.equal(zones.events(10)[1].radius, 7);
    assert.equal(caster.hp, 100); assert.equal(caster.armor, 50);
    assert.deepEqual(zones.update([caster], 10, 2), [], 'Casting must not add an immediate damage pulse');
  });

  test('EMBER samples exactly three80-damage pulses with enemy/alive/radius/feet-height filtering', () => {
    const zones = createZoneAbilities(), caster = actor('caster'), near = actor('near', 'red', 2), edge = actor('edge', 'red', 6, 0, 2.5);
    const outside = actor('outside', 'red', 6.001), high = actor('high', 'red', 1, 0, 2.501), ally = actor('ally'), dead = { ...actor('dead', 'red'), alive: false }, invalid = { ...actor('invalid', 'red'), x: NaN };
    const targets = [caster, near, edge, outside, high, ally, dead, invalid, near];
    zones.cast('ember', caster, point(), 0, 1);
    assert.deepEqual(zones.update(targets, 1.199, 1), []);
    for (const now of [1.2, 2.4, 3.6]) {
      assert.deepEqual(zones.update(targets, now, 1), [
        { targetId: 'near', sourceId: 'caster', team: 'blue', damage: 80 },
        { targetId: 'edge', sourceId: 'caster', team: 'blue', damage: 80 },
      ]);
      assert.deepEqual(zones.update(targets, now, 1), [], 'A duplicate update cannot repeat a consumed pulse');
    }
    for (const target of targets) { assert.equal(target.hp, 100); assert.equal(target.armor, 50); }
    assert.deepEqual(zones.update(targets, 4.8, 1), []); assert.deepEqual(zones.events(4.8), []);
  });

  test('EMBER uses the fixed cast center and current target position rather than following its caster', () => {
    const zones = createZoneAbilities(), caster = actor('caster'), enemy = actor('enemy', 'red', 1);
    zones.cast('ember', caster, point(), 0, 1); caster.x = 30;
    assert.equal(zones.update([enemy], 1.2, 1).length, 1);
    enemy.x = 8; assert.deepEqual(zones.update([enemy], 2.4, 1), []);
    enemy.x = -5; assert.equal(zones.update([enemy], 3.6, 1)[0].damage, 80);
  });

  test('missed EMBER pulses are consumed without bursts, stale hits or time-reversal replay', () => {
    const zones = createZoneAbilities(), caster = actor('caster'), enemy = actor('enemy', 'red');
    zones.cast('ember', caster, point(), 0, 1);
    assert.deepEqual(zones.update([enemy], 1.601, 1), [], 'A pulse older than the0.4s sampling window cannot damage current positions');
    assert.equal(zones.update([enemy], 3.7, 1).length, 1, 'Skipping two scheduled pulses must yield only the latest viable hit');
    assert.deepEqual(zones.update([enemy], 3.7, 1), []); assert.deepEqual(zones.update([enemy], 2.4, 1), []);
    assert.deepEqual(zones.update([enemy], 20, 1), []); assert.deepEqual(zones.snapshot(), { events: [] });
    const stale = createZoneAbilities(); stale.cast('ember', caster, point(), 0, 1);
    assert.deepEqual(stale.update([enemy], 4.001, 1), [], 'The final missed pulse must not be reissued near effect expiry');
  });

  test('FROST slows only living enemies after0.8s within7m/2.5m, never stacks and expires at10s', () => {
    const zones = createZoneAbilities(), caster = actor('caster'), enemy = actor('enemy', 'red', 7, 0, 2.5);
    zones.cast('frost', caster, point(), 0, 1); zones.cast('frost', caster, point(), 0, 1);
    assert.equal(zones.speedMultiplier(enemy, .799), 1); assert.equal(zones.speedMultiplier(enemy, .8), .55);
    assert.equal(zones.speedMultiplier(caster, 1), 1);
    assert.equal(zones.speedMultiplier({ ...enemy, alive: false }, 1), 1);
    assert.equal(zones.speedMultiplier({ ...enemy, x: 7.001 }, 1), 1);
    assert.equal(zones.speedMultiplier({ ...enemy, y: 2.501 }, 1), 1);
    assert.equal(zones.speedMultiplier({ ...enemy, hp: 0 }, 1), 1);
    assert.equal(zones.speedMultiplier(enemy, 9.999), .55); assert.equal(zones.speedMultiplier(enemy, 10), 1);
    assert.deepEqual(zones.events(10), []);
  });

  test('invalid/dead casts and points beyond20m fail without creating zones', () => {
    const caster = actor('caster');
    for (const [type, source, location, now, round] of [
      ['bad', caster, point(), 0, 1], ['ember', { ...caster, alive: false }, point(), 0, 1],
      ['ember', { ...caster, hp: 0 }, point(), 0, 1], ['ember', { ...caster, id: '' }, point(), 0, 1],
      ['ember', { ...caster, team: 'green' }, point(), 0, 1], ['ember', caster, point(20.001), 0, 1],
      ['frost', caster, point(NaN), 0, 1], ['frost', caster, point(0, 0, Infinity), 0, 1],
      ['frost', caster, point(0, 0, 1001), 0, 1], ['ember', caster, point(), NaN, 1], ['ember', caster, point(), 0, 0],
    ]) {
      const zones = createZoneAbilities(); assert.equal(zones.cast(type, source, location, now, round), null);
      assert.deepEqual(zones.snapshot(), { events: [] });
    }
    assert.ok(createZoneAbilities().cast('ember', caster, point(20), 0, 1), 'The exact20m cast limit is inclusive');
  });

  test('JSON rejoin restores age and FROST movement, but never grants guest damage authority', () => {
    const host = createZoneAbilities(), guest = createZoneAbilities(), caster = actor('caster'), enemy = actor('enemy', 'red');
    host.cast('ember', caster, point(), 10, 1); host.cast('frost', caster, point(), 10, 1);
    assert.equal(host.update([enemy], 11.2, 1).length, 1);
    const packet = wire(host.snapshot()); assert.equal(guest.restore(packet, 11.3, 1), true);
    assert.equal(guest.speedMultiplier(enemy, 11.3), .55); assert.equal(guest.events(11.3)[0].startedAt, 10);
    assert.deepEqual(guest.update([enemy], 12.4, 1), [], 'A snapshot must not own the next scheduled damage pulse');
    assert.equal(guest.restore(packet, 12.4, 1), true); assert.deepEqual(guest.update([enemy], 13.6, 1), []);
    assert.equal(enemy.hp, 100); assert.equal(enemy.armor, 50);
    const expired = createZoneAbilities(); assert.equal(expired.restore(packet, 30, 1), true); assert.deepEqual(expired.snapshot(), { events: [] });
  });

  test('snapshots reject invalid identifiers, sizes, times, teams and radii atomically', () => {
    const host = createZoneAbilities(); host.cast('ember', actor('caster'), point(), 0, 1);
    const clean = wire(host.snapshot()), guest = createZoneAbilities(); assert.equal(guest.restore(clean, .1, 1), true);
    const before = guest.snapshot(), changes = [
      value => value.events[0].x = NaN, value => value.events[0].y = Infinity, value => value.events[0].z = 1001,
      value => value.events[0].radius = 7, value => value.events[0].team = 'green', value => value.events[0].sourceId = '',
      value => value.events[0].type = 'unknown', value => value.events[0].id = 'bad', value => value.events[0].round = -1,
      value => value.events[0].startedAt = 1, value => value.events[0].endsAt = 100,
      value => value.events.push({ ...value.events[0] }), value => value.events = Array(21).fill(value.events[0]),
    ];
    for (const change of changes) { const bad = wire(clean); change(bad); assert.equal(guest.restore(bad, .1, 1), false); assert.deepEqual(guest.snapshot(), before); }
    for (const value of [null, [], {}, false, { events: null }]) assert.equal(guest.restore(value, .1, 1), false);
    assert.equal(guest.restore(clean, Infinity, 1), false); assert.equal(guest.restore(clean, .1, -1), false);
  });

  test('render-ahead guests accept newer host state without accepting backwards host time or reviving expired zones', () => {
    const host = createZoneAbilities(), guest = createZoneAbilities(), caster = actor('caster'), enemy = actor('enemy', 'red');
    host.cast('frost', caster, point(), 10, 1); assert.equal(guest.restore(wire(host.snapshot()), 10, 1), true);
    guest.events(10.3); host.cast('ember', caster, point(1), 10.1, 1); const packet = wire(host.snapshot());
    assert.equal(guest.restore(packet, 10.1, 1), true); assert.equal(guest.events(10.1).length, 2);
    assert.deepEqual(guest.update([enemy], 11.3, 1), []);
    guest.events(21); assert.equal(guest.restore(packet, 10.2, 1), true); assert.deepEqual(guest.events(10.2), []);
    assert.equal(guest.speedMultiplier(enemy, 10.2), 1, 'A delayed snapshot must not resurrect expired movement penalties');
    assert.equal(guest.restore(packet, 10.15, 1), false);
    host.update([], 0, 2); const next = host.cast('frost', caster, point(), 0, 2);
    assert.equal(guest.restore(wire(host.snapshot()), 0, 2), true); assert.deepEqual(guest.events(0).map(event => event.id), [next.id]);
  });

  test('bounded detached events, resets and round changes never retain damage ownership', () => {
    const zones = createZoneAbilities(), caster = actor('caster'), enemy = actor('enemy', 'red');
    const first = zones.cast('ember', caster, point(), 0, 1);
    for (let i = 0; i < 30; i++) zones.cast('frost', caster, point(), 0, 1);
    assert.ok(zones.snapshot().events.length <= 20); assert.deepEqual(zones.update([enemy], 1.2, 1), [], 'Evicted damage events must also lose pulse ownership');
    const detached = zones.snapshot(); detached.events[0].x = 900; assert.equal(zones.events(1.2)[0].x, 0);
    assert.deepEqual(zones.update([enemy], 0, 2), []); assert.deepEqual(zones.snapshot(), { events: [] });
    assert.equal(zones.cast('ember', caster, point(), 2, 1), null);
    zones.reset(); assert.deepEqual(zones.snapshot(), { events: [] });
    assert.notEqual(zones.cast('ember', caster, point(), 0, 1).id, first.id, 'Reset must not reuse an earlier host event identity');
  });
  console.log(`TOTAL: ${passed} zone ability groups passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
