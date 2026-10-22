const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const started = performance.now(), cpuStarted = process.cpuUsage();
  const { DuelistKit, DUELIST, DUELIST_SKILLS, NOPE_SKILLS, MEND_SKILLS, IAGNU_SKILLS, VEIL_SKILLS, EMBER_SKILLS, FROST_SKILLS, signatureCooldown, CHARACTER_DEFS, normalizeCharacter, getCharacterSkill, getSkillState } = await import(pathToFileURL(path.join(__dirname, 'public/abilities.js')).href);
  let passed = 0;
  const test = (name, fn) => { fn(); passed++; console.log(`PASS: ${name}`); };
  test('paid abilities charge only on successful purchase and respect carry limits', () => {
    const kit = new DuelistKit(); let credits = 800, calls = 0;
    const spend = price => { calls++; if (credits < price) return false; credits -= price; return true; };
    assert.equal(kit.buy('smoke', spend), true); assert.equal(kit.buy('c', spend), true);
    assert.equal(kit.buy('c', spend), false); assert.equal(calls, 2);
    assert.equal(kit.buy('updraft', spend), true); assert.equal(kit.buy('q', spend), true); assert.equal(kit.buy('q', spend), false);
    assert.equal(credits, 400); assert.equal(calls, 4); assert.equal(kit.buy('e', spend), false);
    kit.activate('c', 0); assert.equal(kit.buy('c', () => false), false); assert.equal(kit.smoke, 1);
    assert.equal(kit.activate('q', 0).type, 'duelist-lift'); assert.equal(kit.activate('q', 0).type, 'duelist-lift'); assert.equal(kit.activate('q', 0), null);
    assert.equal(kit.activate('c', 0).type, 'duelist-comet'); assert.equal(kit.activate('c', 0), null);
  });
  test('dash requires a fresh arm and quarter second, then one use inside its twelve-second window', () => {
    const kit = new DuelistKit();
    assert.deepEqual(kit.activate('KeyE', 10), { type: 'dash-armed', readyAt: 10.25, expiresAt: 22 });
    assert.equal(kit.dash, 0); assert.equal(kit.activate('e', 10.249999), null);
    assert.deepEqual(kit.activate('e', 10.25), {type:'dash',distance:12,duration:.18}); assert.equal(kit.activate('e', 10.3), null);
    kit.resetRound(); kit.activate('e', 20); kit.tick(32);
    assert.equal(kit.activate('e', 32), null); assert.equal(kit.armExpiresAt, null);
    kit.awardKill(); assert.equal(kit.dash, 1);
    assert.equal(kit.activate('e', 33).type, 'dash-armed'); assert.equal(kit.dashKills, 0);
    assert.equal(kit.activate('e', 33.25).type, 'dash');
  });
  test('signature kills earned while the free charge is unused cannot prepay a later dash', () => {
    const kit = new DuelistKit(); kit.awardKill(); kit.awardKill();
    assert.equal(kit.dash, 1); assert.equal(kit.dashKills, 0);
    kit.activate('e', 0); kit.activate('e', .25); assert.equal(kit.dash, 0); kit.awardKill();
    assert.equal(kit.dash, 1); assert.equal(kit.dashKills, 0);
  });
  test('ultimate needs seven points, consumes them once, and refills even on a last-knife kill', () => {
    const kit = new DuelistKit(); assert.equal(kit.activate('x', 0), null);
    for (let i = 0; i < 6; i++) kit.awardPoint(); assert.equal(kit.activate('x', 0), null);
    kit.awardKill(); assert.equal(kit.ultPoints, 7);
    assert.deepEqual(kit.activate('x', 0), { type: 'knives', count: 5 }); assert.equal(kit.ultPoints, 0);
    assert.equal(kit.activate('x', 0), null);
    for (let i = 0; i < 5; i++) assert.equal(kit.consumeKnife(), true);
    assert.equal(kit.consumeKnife(), false); kit.awardKill();
    assert.equal(kit.knives, 5); assert.equal(kit.ultPoints, 1);
    for (let i = 0; i < 5; i++) kit.consumeKnife(); kit.tick(.1);
    assert.equal(kit.knivesActive, false); kit.awardKill(); assert.equal(kit.knives, 0);
    for (let i = 0; i < 20; i++) kit.awardPoint(); assert.equal(kit.ultPoints, 7);
  });
  test('round reset carries unspent purchases and earned points but halves clear them', () => {
    const kit = new DuelistKit(); kit.buy('c', () => true); kit.buy('q', () => true);
    for (let i = 0; i < 7; i++) kit.awardPoint(); kit.activate('x', 0); kit.awardPoint(); kit.activate('e', 0);
    kit.resetRound();
    assert.equal(kit.smoke, 1); assert.equal(kit.updraft, 1); assert.equal(kit.ultPoints, 1);
    assert.equal(kit.dash, 1); assert.equal(kit.armReadyAt, null); assert.equal(kit.knives, 0); assert.equal(kit.knivesActive, false);
    kit.resetRound({ reset: true });
    assert.equal(kit.smoke, 0); assert.equal(kit.updraft, 0); assert.equal(kit.ultPoints, 0); assert.equal(kit.dash, 1);
  });
  test('snapshot transfer preserves armed timing and rejects invalid remote state', () => {
    const kit = new DuelistKit(); kit.buy('c', () => true); kit.activate('e', 2); kit.awardKill();
    const remote = new DuelistKit(); assert.equal(remote.restore(kit.snapshot()), true);
    assert.deepEqual(remote.snapshot(), kit.snapshot());
    const detached = remote.snapshot(); detached.smoke = 0; assert.equal(remote.smoke, 1);
    assert.equal(remote.activate('e', 2.249), null); assert.equal(remote.activate('e', 2.25).type, 'dash');
    assert.equal(remote.restore(null), false);
    remote.restore({ smoke: 100, updraft: -1, dash: NaN, ultPoints: Infinity, knives: 999, knivesActive: true, armReadyAt: NaN, armExpiresAt: Infinity });
    assert.equal(remote.smoke, 2); assert.equal(remote.updraft, 0); assert.equal(remote.dash, 0);
    assert.equal(remote.ultPoints, 0); assert.equal(remote.knives, DUELIST.knives); assert.equal(remote.armReadyAt, null);
    assert.equal(remote.activate('c', NaN), null); assert.equal(remote.smoke, 2);
  });
  test('NOPE character consumes seven points without granting knives and survives round and snapshot transfer', () => {
    const kit = new DuelistKit({character:'nope'});
    assert.equal(kit.activate('x', 0), null);
    for(let i=0;i<7;i++)kit.awardPoint();
    assert.deepEqual(kit.activate('x', 1), {type:'nope',duration:12});
    assert.equal(kit.ultPoints,0);assert.equal(kit.knivesActive,false);assert.equal(kit.knives,0);assert.equal(kit.activate('x',1),null);
    kit.awardPoint();kit.resetRound();assert.equal(kit.character,'nope');assert.equal(kit.ultPoints,1);
    const remote=new DuelistKit();remote.restore(JSON.parse(JSON.stringify(kit.snapshot())));
    assert.deepEqual(remote.snapshot(),kit.snapshot());remote.resetRound({reset:true});assert.equal(remote.character,'nope');assert.equal(remote.ultPoints,0);
    remote.restore({...kit.snapshot(),character:'unknown'});assert.equal(remote.character,'duelist');
    assert.equal(new DuelistKit({character:'unknown'}).character,'duelist');
  });
  test('exactly seven character definitions and both menu selectors expose the same stable IDs', () => {
    const ids = ['duelist', 'nope', 'mend', 'echo', 'veil', 'ember', 'frost'];
    assert.deepEqual(Object.keys(CHARACTER_DEFS), ids); assert.equal(Object.isFrozen(CHARACTER_DEFS), true);
    for (const id of ids) {
      const definition = CHARACTER_DEFS[id];
      assert.equal(definition.id, id); assert.equal(Object.isFrozen(definition), true);
      for (const key of ['label', 'role', 'ultName', 'ultShortName', 'description', 'ultIcon']) assert.ok(definition[key]?.length > 0);
      assert.equal(definition.ultimatePoints, 7); assert.match(definition.color, /^#[0-9a-f]{6}$/i);
      assert.match(definition.description, /7pt/);
      assert.match(definition.description, id === 'nope' ? /C：瓶グレネード.*Q：顔フラッシュ.*E：.*全身の囮.*X：.*30体/ : id === 'mend' ? /C：足止めの種.*Q：花粉の煙幕.*E：単体60回復/ : id === 'echo' ? /C：.*金文字.*Q：反射閃光.*E：短い移動補助/ : id === 'veil' ? /C：.*土煙.*Q：.*根の帯.*E：.*芝走り/ : id === 'ember' ? /C：.*はんだ玉.*Q：.*遮光眼鏡.*E：.*整備/ : id === 'frost' ? /C：.*円環.*Q：.*ドールミスト.*E：.*減速を軽減/ : /C：.*流れ星の幕.*Q：アンテナリフト.*E：.*ダッシュ/);
      assert.match(definition.ultIcon, /^[MmLlHhVvAaQqCcSsTtZz0-9.,\s-]+$/, 'Only an SVG path is stored in icon metadata');
    }
    const html = fs.readFileSync(path.join(__dirname, 'public/play.html'), 'utf8');
    for (const selectId of ['agent-select', 'online-agent']) {
      const select = html.match(new RegExp(`<select\\b[^>]*id="${selectId}"[^>]*>([\\s\\S]*?)<\\/select>`));
      assert.ok(select, `Missing ${selectId}`);
      assert.deepEqual([...select[1].matchAll(/<option\b[^>]*value="([^"]+)"/g)].map(match => match[1]), ids);
    }
    assert.ok(html.includes(CHARACTER_DEFS.duelist.description), 'The initial character description must match the default WIND choice');
    assert.deepEqual({ label: CHARACTER_DEFS.veil.label, role: CHARACTER_DEFS.veil.role, ultName: CHARACTER_DEFS.veil.ultName, ultShortName: CHARACTER_DEFS.veil.ultShortName },
      { label: '草ブロック', role: '制圧', ultName: 'ブラックアウトドーム', ultShortName: 'ドーム' });
    for (const phrase of ['自身', '半径9m', '12秒', '視界']) assert.ok(CHARACTER_DEFS.veil.description.includes(phrase));
    assert.match(html, /ちぬつてのとのへめほ \/ NOPE \/ 丱凵してね \/ IAGNU \/ 草ブロック \/ はんだごて握り太郎 \/ 尾野の7人/);
    assert.match(html, /草ブロックの[^<]*X「ブラックアウトドーム」[^<]*自身[^<]*半径9m[^<]*12秒[^<]*視界/);
    assert.match(html, /id="ability-x-glyph"/);
    assert.match(html, /はんだごて握り太郎のX「フレアストライク」[^<]*半径6m[^<]*1.2・2.4・3.6秒[^<]*30ダメージ/);
    assert.match(html, /尾野の[^<]*X「クライオフィールド」[^<]*半径7m[^<]*10秒[^<]*0.8秒[^<]*55%/);
  });
  test('character normalization accepts only explicit IDs and never coerces objects or inherited keys', () => {
    for (const id of Object.keys(CHARACTER_DEFS)) assert.equal(normalizeCharacter(id), id);
    const hostile = { toString() { throw Error('Character input must not be coerced'); } };
    for (const value of [null, undefined, false, 0, '', 'unknown', 'MEND', 'constructor', 'toString', '__proto__', ['mend'], hostile]) {
      assert.equal(normalizeCharacter(value), 'duelist');
      assert.equal(new DuelistKit({ character: value }).character, 'duelist');
      const restored = new DuelistKit({ character: 'echo' });
      restored.restore({ character: value }); assert.equal(restored.character, 'duelist');
    }
  });
  test('MEND spends seven points once and returns the bounded healing contract without creating knives', () => {
    const kit = new DuelistKit({ character: 'mend' }); kit.ultPoints = 6;
    const before = kit.snapshot(); assert.equal(kit.activate('x', 1), null); assert.deepEqual(kit.snapshot(), before);
    kit.awardPoint(); assert.deepEqual(kit.activate('KeyX', 2), { type: 'mend', radius: 18, healing: 75 });
    assert.equal(kit.ultPoints, 0); assert.equal(kit.activate('x', 2), null);
    assert.equal(kit.knives, 0); assert.equal(kit.knivesActive, false); assert.equal(kit.consumeKnife(), false);
    kit.awardKill(); assert.equal(kit.ultPoints, 1); assert.equal(kit.knives, 0);
  });
  test('ECHO spends seven points once and describes three fixed-center pulses with brief map-only reveals', () => {
    const kit = new DuelistKit({ character: 'echo' }); kit.ultPoints = 6;
    assert.equal(kit.activate('x', 0), null); assert.equal(kit.ultPoints, 6); kit.awardPoint();
    assert.deepEqual(kit.activate('x', 1), { type: 'recon', radius: 30, duration: 6, pulses: 3, interval: 2, revealDuration: 1.25 });
    assert.equal(kit.ultPoints, 0); assert.equal(kit.activate('x', 1), null);
    assert.equal(kit.knivesActive, false); assert.equal(kit.knives, 0); assert.equal(kit.consumeKnife(), false);
    kit.awardKill(); assert.equal(kit.knives, 0);
  });
  test('VEIL spends exactly seven points once for a nine-meter twelve-second dome without granting knives', () => {
    const kit = new DuelistKit({ character: 'veil' }); kit.ultPoints = 6;
    const before = kit.snapshot(); assert.equal(kit.activate('x', 1), null); assert.deepEqual(kit.snapshot(), before);
    kit.awardPoint(); assert.deepEqual(kit.activate('KeyX', 2), { type: 'veil', radius: 9, duration: 12 });
    assert.equal(kit.ultPoints, 0); assert.equal(kit.activate('x', 2), null);
    assert.equal(kit.knives, 0); assert.equal(kit.knivesActive, false); assert.equal(kit.consumeKnife(), false);
    kit.awardKill(); assert.equal(kit.ultPoints, 1); assert.equal(kit.knives, 0);
    const restored = new DuelistKit(); assert.equal(restored.restore(JSON.parse(JSON.stringify(kit.snapshot()))), true);
    assert.deepEqual(restored.snapshot(), kit.snapshot());
    for (let i = 0; i < 6; i++) restored.awardPoint();
    assert.deepEqual(restored.activate('x', 3), { type: 'veil', radius: 9, duration: 12 });
    assert.equal(restored.ultPoints, 0); assert.equal(restored.knivesActive, false);
  });
  test('EMBER and FROST consume seven points once and expose independent exact zone contracts', () => {
    const definitions = [
      ['ember', { type: 'ember', radius: 6, duration: 4.8, pulses: [1.2, 2.4, 3.6], damage: 30 }],
      ['frost', { type: 'frost', radius: 7, duration: 10, warmup: .8, slowMultiplier: .55 }],
    ];
    for (const [id, expected] of definitions) {
      const kit = new DuelistKit({ character: id }); kit.ultPoints = 6;
      const before = kit.snapshot(); assert.equal(kit.activate('x', 1), null); assert.deepEqual(kit.snapshot(), before);
      kit.awardPoint(); const effect = kit.activate('x', 2); assert.deepEqual(effect, expected);
      assert.equal(kit.ultPoints, 0); assert.equal(kit.activate('x', 2), null);
      assert.equal(kit.knives, 0); assert.equal(kit.knivesActive, false); assert.equal(kit.consumeKnife(), false);
      if (effect.pulses) effect.pulses[0] = 99;
      kit.ultPoints = 7; assert.deepEqual(kit.activate('x', 3), expected, 'Returned contracts cannot mutate subsequent casts');
      const restored = new DuelistKit(); restored.restore(JSON.parse(JSON.stringify(kit.snapshot())));
      assert.deepEqual(restored.snapshot(), kit.snapshot()); assert.equal(restored.character, id);
    }
    assert.equal(CHARACTER_DEFS.ember.role, '攻撃'); assert.equal(CHARACTER_DEFS.ember.color, '#eaa36f');
    assert.equal(CHARACTER_DEFS.frost.role, '守備'); assert.equal(CHARACTER_DEFS.frost.color, '#96dce5');
  });
  test('all seven characters retain purchases, their own signature timing and identity through JSON snapshots and resets', () => {
    for (const id of Object.keys(CHARACTER_DEFS)) {
      const kit = new DuelistKit({ character: id }); kit.buy('smoke', () => true); kit.buy('updraft', () => true);
      kit.ultPoints = 7; kit.activate('e', 10);
      const restored = new DuelistKit(); assert.equal(restored.restore(JSON.parse(JSON.stringify(kit.snapshot()))), true);
      assert.deepEqual(restored.snapshot(), kit.snapshot());
      if (id !== 'duelist') {
        assert.equal(restored.activate('e', 10.9), null);
        const readyAt = id === 'nope' || id === 'veil' ? 25 : 28;
        assert.equal(restored.nextSignatureAt, readyAt); assert.equal(restored.activate('e', readyAt - .001), null);
        assert.equal(restored.activate('e', readyAt).type, id === 'nope' ? 'nope-decoy' : id === 'mend' ? 'mend-heal' : id === 'echo' ? 'echo-kerning' : id === 'veil' ? 'veil-turf' : id === 'ember' ? 'ember-service' : 'frost-unravel'); assert.equal(restored.armReadyAt, null);
      } else { assert.equal(restored.activate('e', 10.249), null); assert.equal(restored.activate('e', 10.25).type, 'dash'); }
      const points = restored.ultPoints; restored.resetRound();
      assert.equal(restored.character, id); assert.equal(restored.smoke, 1); assert.equal(restored.updraft, 1); assert.equal(restored.ultPoints, points);
      restored.resetRound({ reset: true }); assert.equal(restored.character, id); assert.equal(restored.ultPoints, 0);
      assert.equal(restored.smoke, 0); assert.equal(restored.updraft, 0); assert.equal(restored.dash, 1);
    }
  });
  test('non-WIND snapshots cannot borrow WIND knives and still activate their own ultimate', () => {
    for (const [id, effect] of [['nope', 'nope'], ['mend', 'mend'], ['echo', 'recon'], ['veil', 'veil'], ['ember', 'ember'], ['frost', 'frost']]) {
      const restored = new DuelistKit();
      restored.restore({ character: id, ultPoints: 7, knivesActive: true, knives: 5 });
      assert.equal(restored.knivesActive, false); assert.equal(restored.knives, 0); assert.equal(restored.consumeKnife(), false);
      assert.equal(restored.activate('x', 2).type, effect); assert.equal(restored.ultPoints, 0);
      const transfer = new DuelistKit(); transfer.restore(JSON.parse(JSON.stringify(restored.snapshot())));
      assert.deepEqual(transfer.snapshot(), restored.snapshot()); assert.equal(transfer.knivesActive, false);
    }
  });
  test('WIND uses a distinct comet and lift while retaining the exact two-stage dash without spending ultimate points', () => {
    for (const id of ['duelist']) {
      const kit = new DuelistKit({ character: id }); kit.ultPoints = 7;
      kit.buy('c', () => true); kit.buy('q', () => true);
      assert.deepEqual(kit.activate('c', 0), { type: 'duelist-comet', flight: .25, duration: 5, radius: 2.8, range: 18 });
      assert.deepEqual(kit.activate('q', 0), { type: 'duelist-lift', velocity: 7.8, duration: .45 });
      assert.equal(kit.activate('e', 0).type, 'dash-armed'); assert.equal(kit.activate('e', .249), null);
      assert.deepEqual(kit.activate('e', .25), { type: 'dash', distance: 12, duration: .18 }); assert.equal(kit.ultPoints, 7);
      for (const time of [NaN, Infinity, -1]) assert.equal(kit.activate('x', time), null);
      assert.equal(kit.ultPoints, 7); assert.equal(kit.knivesActive, false);
    }
  });
  test('NOPE ordinary metadata is immutable, purchasable by unique ID and uses the existing stock fields', () => {
    const kit = new DuelistKit({ character: 'nope' }); let spent = 0;
    const spend = price => { spent += price; return true; };
    for (const [key, id, type, max, price] of [['c', 'nope-bottle', 'nope-bottle', 2, 100], ['q', 'nope-flash', 'nope-flash', 1, 100], ['e', 'nope-decoy', 'nope-decoy', 1, 0]]) {
      const metadata = getCharacterSkill('nope', `Key${key.toUpperCase()}`);
      assert.equal(Object.isFrozen(metadata), true); assert.equal(metadata.id, id); assert.equal(metadata.type, type);
      assert.equal(metadata.max, max); assert.equal(metadata.price, price); assert.ok(metadata.description); assert.ok(metadata.icon);
      assert.equal(kit.buy(id, spend), key !== 'e');
    }
    assert.equal(spent, 200); assert.equal(kit.smoke, 1); assert.equal(kit.updraft, 1); assert.equal(kit.dash, 1);
    assert.equal(kit.buy('smoke', spend), true); assert.equal(kit.buy('nope-bottle', spend), false); assert.equal(spent, 300);
    for (const bad of ['constructor', '__proto__', 'x', {}, null]) assert.equal(getCharacterSkill('nope', bad), null);
    assert.equal(kit.buy('duelist-smoke', spend), false); assert.equal(kit.buy(null, spend), false);
    assert.deepEqual(kit.activate('c', 5), { type: 'nope-bottle', fuse: 1, flight: .55, radius: 5.5, maxDamage: 90 });
    assert.deepEqual(kit.activate('q', 5), { type: 'nope-flash', flight: .45, radius: 12, duration: 2.4 });
    assert.equal(kit.ultPoints, 0); assert.equal(kit.knivesActive, false);
    assert.equal(NOPE_SKILLS.signatureCooldown, 15);
  });
  test('NOPE immediate decoy recharges by time, never by kills, and survives JSON while round reset restores it', () => {
    const kit = new DuelistKit({ character: 'nope' }); kit.buy('c', () => true); kit.buy('q', () => true);
    assert.deepEqual(kit.activate('e', 5), { type: 'nope-decoy', duration: 12, cooldown: 15 });
    assert.equal(kit.dash, 0); assert.equal(kit.nextSignatureAt, 20); assert.equal(kit.armReadyAt, null);
    kit.awardKill(); kit.awardKill(); assert.equal(kit.dash, 0); assert.equal(kit.dashKills, 0); assert.equal(kit.ultPoints, 2);
    const remote = new DuelistKit(); remote.restore(JSON.parse(JSON.stringify(kit.snapshot())));
    remote.tick(19.999); assert.equal(remote.dash, 0); remote.tick(20); assert.equal(remote.dash, 1); assert.equal(remote.nextSignatureAt, 0);
    assert.equal(remote.activate('e', 20).type, 'nope-decoy'); assert.equal(remote.nextSignatureAt, 35);
    remote.resetRound(); assert.equal(remote.dash, 1); assert.equal(remote.nextSignatureAt, 0);
    assert.equal(remote.smoke, 1); assert.equal(remote.updraft, 1); assert.equal(remote.ultPoints, 2);
    remote.resetRound({ reset: true }); assert.equal(remote.smoke, 0); assert.equal(remote.updraft, 0); assert.equal(remote.ultPoints, 0);
    for (const bad of [NaN, Infinity, -1, '35']) {
      remote.restore({ character: 'nope', dash: 0, nextSignatureAt: bad, armReadyAt: 2, armExpiresAt: 10 });
      assert.equal(remote.nextSignatureAt, 0); assert.equal(remote.armReadyAt, null);
    }
    for (const id of ['mend', 'echo', 'veil', 'ember', 'frost']) {
      const unchanged = new DuelistKit({ character: id }); unchanged.activate('e', 0); unchanged.activate('e', 1);
      unchanged.awardKill(); unchanged.awardKill(); assert.equal(unchanged.dash, 0, 'Only WIND keeps the kill-based signature recharge');
    }
  });
  test('slot UI state exposes real arm delay/window and the NOPE cooldown without changing sensitivity or stock', () => {
    const dash = new DuelistKit(); assert.deepEqual(getSkillState(dash, 'e', 0), { count: 1, max: 1, ready: true, armed: false, charging: false, remaining: 0, progress: 1 });
    dash.activate('e', 10);
    assert.deepEqual(getSkillState(dash, 'e', 10.125), { count: 0, max: 1, ready: false, armed: true, charging: true, remaining: .125, progress: .5 });
    assert.deepEqual(getSkillState(dash, 'e', 10.25), { count: 0, max: 1, ready: true, armed: true, charging: false, remaining: 11.75, progress: 1 });
    assert.equal(getSkillState(dash, 'e', 16.125).progress, .5);
    const nope = new DuelistKit({ character: 'nope' }); nope.activate('e', 10);
    assert.deepEqual(getSkillState(nope, 'e', 17.5), { count: 0, max: 1, ready: false, armed: false, charging: false, remaining: 7.5, progress: .5 });
    nope.tick(25); assert.equal(getSkillState(nope, 'e', 25).ready, true); assert.equal(getSkillState(nope, 'e', 25).remaining, 0);
    assert.equal(getSkillState(nope, 'bogus', 0), null); assert.equal(getSkillState(nope, 'c', 0).max, 2);
  });
  test('MEND purchases distinct seed/pollen stocks and restores a single immediate heal every18 seconds', () => {
    const kit = new DuelistKit({ character: 'mend' }); let spent = 0;
    for (const [key, id, price, max] of [['c', 'mend-seeds', 100, 2], ['q', 'mend-pollen', 100, 1], ['e', 'mend-heal', 0, 1]]) {
      const definition = getCharacterSkill('mend', key); assert.equal(definition.id, id); assert.equal(definition.type, id);
      assert.equal(definition.price, price); assert.equal(definition.max, max); assert.equal(Object.isFrozen(definition), true);
      assert.equal(kit.buy(id, value => { spent += value; return true; }), key !== 'e');
    }
    assert.equal(spent, 200); assert.equal(kit.buy('nope-bottle', () => true), false);
    assert.deepEqual(kit.activate('c', 0), { type: 'mend-seeds', flight: .65, duration: 9, radius: 4.5, speedScale: .5 });
    assert.deepEqual(kit.activate('q', 0), { type: 'mend-pollen', flight: .55, duration: 9, radius: 4.2 });
    assert.deepEqual(kit.activate('e', 5), { type: 'mend-heal', healing: 60, radius: 18, cooldown: 18 });
    assert.equal(kit.nextSignatureAt, 23); assert.equal(kit.dash, 0); assert.equal(kit.armReadyAt, null); assert.equal(kit.armExpiresAt, null);
    kit.awardKill(); kit.awardKill(); assert.equal(kit.dash, 0); assert.equal(kit.dashKills, 0); assert.equal(kit.ultPoints, 2);
    const remote = new DuelistKit(); remote.restore(JSON.parse(JSON.stringify(kit.snapshot()))); assert.deepEqual(remote.snapshot(), kit.snapshot());
    assert.deepEqual(getSkillState(remote, 'e', 14), { count: 0, max: 1, ready: false, armed: false, charging: false, remaining: 9, progress: .5 });
    assert.equal(remote.activate('e', 22.999), null); assert.equal(remote.activate('e', 23).type, 'mend-heal'); assert.equal(remote.nextSignatureAt, 41);
    remote.buy('smoke', () => true); remote.buy('updraft', () => true); remote.resetRound();
    assert.equal(remote.smoke, 1); assert.equal(remote.updraft, 1); assert.equal(remote.ultPoints, 2); assert.equal(remote.nextSignatureAt, 0); assert.equal(remote.dash, 1);
    remote.resetRound({ reset: true }); assert.equal(remote.smoke, 0); assert.equal(remote.updraft, 0); assert.equal(remote.ultPoints, 0);
    for (const invalid of [NaN, Infinity, -1, '40']) { remote.restore({ character: 'mend', dash: 0, nextSignatureAt: invalid, armReadyAt: 2, armExpiresAt: 10 }); assert.equal(remote.nextSignatureAt, 0); assert.equal(remote.armReadyAt, null); }
    assert.equal(MEND_SKILLS.signatureCooldown, 18);
  });
  test('IAGNU has immutable unique paid slots, retains the seven identities, and never sells its free signature', () => {
    const kit = new DuelistKit({ character: 'echo' }); let credits = 300, calls = 0;
    const spend = price => { calls++; if (credits < price) return false; credits -= price; return true; };
    for (const [key, id, max, price] of [['c', 'echo-tag', 2, 100], ['q', 'echo-glint', 1, 100], ['e', 'echo-kerning', 1, 0]]) {
      const skill = getCharacterSkill('echo', key); assert.equal(skill.id, id); assert.equal(skill.type, id);
      assert.equal(skill.max, max); assert.equal(skill.price, price); assert.equal(Object.isFrozen(skill), true); assert.ok(skill.icon && skill.description);
    }
    assert.equal(kit.buy('echo-tag', spend), true); assert.equal(kit.buy('c', spend), true); assert.equal(kit.buy('smoke', spend), false);
    assert.equal(kit.buy('echo-glint', spend), true); assert.equal(kit.buy('q', spend), false);
    assert.equal(kit.buy('echo-kerning', spend), false); assert.equal(kit.buy('nope-flash', spend), false); assert.equal(kit.buy('mend-seeds', spend), false);
    assert.equal(calls, 3); assert.equal(credits, 0); assert.equal(kit.smoke, 2); assert.equal(kit.updraft, 1);
    assert.equal(Object.keys(CHARACTER_DEFS).length, 7); assert.equal(CHARACTER_DEFS.echo.label, 'IAGNU'); assert.equal(Object.isFrozen(IAGNU_SKILLS), true);
    const empty = new DuelistKit({ character: 'echo' }); assert.equal(empty.buy('c', () => false), false); assert.equal(empty.smoke, 0);
  });
  test('IAGNU returns canonical tag, glint and immediate movement effects without spending or mutating its recon ultimate', () => {
    const kit = new DuelistKit({ character: 'echo' }); kit.buy('c', () => true); kit.buy('q', () => true); kit.ultPoints = 7;
    assert.deepEqual(kit.activate('c', 2), { type: 'echo-tag', flight: .55, armDelay: .5, duration: 12, radius: 4.5, range: 18, revealDuration: 2.5 });
    assert.equal(kit.activate('c', 2), null);
    assert.deepEqual(kit.activate('q', 2), { type: 'echo-glint', flight: .5, radius: 10, duration: 2 }); assert.equal(kit.activate('q', 2), null);
    assert.deepEqual(kit.activate('e', 2), { type: 'echo-kerning', duration: 4, speedScale: 1.35, cooldown: 18 });
    assert.equal(kit.armReadyAt, null); assert.equal(kit.armExpiresAt, null); assert.equal(kit.activate('e', 3), null); assert.equal(kit.nextSignatureAt, 20);
    assert.equal(kit.ultPoints, 7); assert.deepEqual(kit.activate('x', 3), { type: 'recon', radius: 30, duration: 6, pulses: 3, interval: 2, revealDuration: 1.25 });
    assert.equal(kit.ultPoints, 0); assert.equal(kit.knivesActive, false); assert.equal(kit.consumeKnife(), false);
  });
  test('IAGNU timed signature survives JSON, rejects borrowed dash arms and refills only by time or round reset', () => {
    const kit = new DuelistKit({ character: 'echo' }); kit.buy('c', () => true); kit.buy('q', () => true); kit.activate('e', 10);
    kit.awardKill(); kit.awardKill(); assert.equal(kit.dash, 0); assert.equal(kit.dashKills, 0);
    const remote = new DuelistKit(); assert.equal(remote.restore(JSON.parse(JSON.stringify(kit.snapshot()))), true); assert.deepEqual(remote.snapshot(), kit.snapshot());
    assert.deepEqual(getSkillState(remote, 'e', 19), { count: 0, max: 1, ready: false, armed: false, charging: false, remaining: 9, progress: .5 });
    remote.tick(27.999); assert.equal(remote.dash, 0); assert.equal(remote.activate('e', 27.999), null);
    remote.tick(28); assert.equal(remote.dash, 1); assert.equal(remote.nextSignatureAt, 0); assert.equal(remote.activate('e', 28).type, 'echo-kerning'); assert.equal(remote.nextSignatureAt, 46);
    remote.resetRound(); assert.equal(remote.dash, 1); assert.equal(remote.nextSignatureAt, 0); assert.equal(remote.smoke, 1); assert.equal(remote.updraft, 1); assert.equal(remote.ultPoints, 2);
    remote.resetRound({ reset: true }); assert.equal(remote.smoke, 0); assert.equal(remote.updraft, 0); assert.equal(remote.ultPoints, 0);
    for (const invalid of [NaN, Infinity, -1, '45']) {
      remote.restore({ character: 'echo', dash: 0, nextSignatureAt: invalid, armReadyAt: 2, armExpiresAt: 10, knives: 5, knivesActive: true });
      assert.equal(remote.nextSignatureAt, 0); assert.equal(remote.armReadyAt, null); assert.equal(remote.knivesActive, false); assert.equal(remote.knives, 0);
    }
    const before = kit.snapshot(); for (const time of [NaN, Infinity, -1, '10']) for (const key of ['c', 'q', 'e']) assert.equal(kit.activate(key, time), null);
    assert.deepEqual(kit.snapshot(), before);
  });
  test('VEIL sells bounded unique soil and roots stocks while the signature is free and all seven identities remain stable', () => {
    const kit = new DuelistKit({ character: 'veil' }); let credits = 300, calls = 0;
    const spend = price => { calls++; if (credits < price) return false; credits -= price; return true; };
    for (const [key, id, max, price] of [['c', 'veil-dust', 2, 100], ['q', 'veil-roots', 1, 100], ['e', 'veil-turf', 1, 0]]) {
      const skill = getCharacterSkill('veil', `Key${key.toUpperCase()}`);
      assert.equal(skill.id, id); assert.equal(skill.type, id); assert.equal(skill.max, max); assert.equal(skill.price, price);
      assert.ok(skill.name && skill.description && skill.icon); assert.equal(Object.isFrozen(skill), true);
    }
    assert.equal(kit.buy('veil-dust', spend), true); assert.equal(kit.buy('smoke', spend), true); assert.equal(kit.buy('c', spend), false);
    assert.equal(kit.buy('veil-roots', spend), true); assert.equal(kit.buy('updraft', spend), false); assert.equal(kit.buy('veil-turf', spend), false);
    for (const id of ['nope-bottle', 'mend-seeds', 'echo-tag', 'veil-veil-dust']) assert.equal(kit.buy(id, spend), false);
    assert.equal(calls, 3); assert.equal(credits, 0); assert.equal(kit.smoke, 2); assert.equal(kit.updraft, 1); assert.equal(kit.dash, 1);
    assert.equal(Object.isFrozen(VEIL_SKILLS), true); assert.equal(Object.keys(CHARACTER_DEFS).length, 7);
    const empty = new DuelistKit({ character: 'veil' }); assert.equal(empty.buy('c', () => false), false); assert.equal(empty.smoke, 0);
  });
  test('VEIL returns canonical self-smoke, narrow roots and immediate ground-speed contracts without touching its original dome', () => {
    const kit = new DuelistKit({ character: 'veil' }); kit.buy('c', () => true); kit.buy('q', () => true); kit.ultPoints = 7;
    assert.deepEqual(kit.activate('c', 2), { type: 'veil-dust', armDelay: .2, duration: 7, radius: 3.5 }); assert.equal(kit.activate('c', 2), null);
    assert.deepEqual(kit.activate('q', 2), { type: 'veil-roots', armDelay: .25, duration: 8, range: 10, width: 3.2, speedScale: .45 }); assert.equal(kit.activate('q', 2), null);
    assert.deepEqual(kit.activate('e', 2), { type: 'veil-turf', duration: 3, speedScale: 1.5, cooldown: 15 }); assert.equal(kit.activate('e', 3), null);
    assert.equal(kit.nextSignatureAt, 17); assert.equal(kit.armReadyAt, null); assert.equal(kit.armExpiresAt, null);
    assert.equal(kit.ultPoints, 7); assert.deepEqual(kit.activate('x', 3), { type: 'veil', radius: 9, duration: 12 });
    assert.equal(kit.ultPoints, 0); assert.equal(kit.knivesActive, false); assert.equal(kit.consumeKnife(), false);
  });
  test('VEIL timed signature survives JSON, ignores kill recharge and borrowed dash arms, and round reset retains purchases', () => {
    const kit = new DuelistKit({ character: 'veil' }); kit.buy('c', () => true); kit.buy('q', () => true); kit.activate('e', 10);
    kit.awardKill(); kit.awardKill(); assert.equal(kit.dash, 0); assert.equal(kit.dashKills, 0);
    const remote = new DuelistKit(); assert.equal(remote.restore(JSON.parse(JSON.stringify(kit.snapshot()))), true); assert.deepEqual(remote.snapshot(), kit.snapshot());
    assert.deepEqual(getSkillState(remote, 'e', 17.5), { count: 0, max: 1, ready: false, armed: false, charging: false, remaining: 7.5, progress: .5 });
    remote.tick(24.999); assert.equal(remote.activate('e', 24.999), null); remote.tick(25); assert.equal(remote.activate('e', 25).type, 'veil-turf');
    assert.equal(remote.nextSignatureAt, 40); remote.resetRound(); assert.equal(remote.dash, 1); assert.equal(remote.nextSignatureAt, 0);
    assert.equal(remote.smoke, 1); assert.equal(remote.updraft, 1); assert.equal(remote.ultPoints, 2);
    remote.resetRound({ reset: true }); assert.equal(remote.smoke, 0); assert.equal(remote.updraft, 0); assert.equal(remote.ultPoints, 0);
    for (const invalid of [NaN, Infinity, -1, '40']) {
      remote.restore({ character: 'veil', dash: 0, nextSignatureAt: invalid, armReadyAt: 2, armExpiresAt: 10, knivesActive: true, knives: 5 });
      assert.equal(remote.nextSignatureAt, 0); assert.equal(remote.armReadyAt, null); assert.equal(remote.knivesActive, false); assert.equal(remote.knives, 0);
    }
    const before = kit.snapshot(); for (const invalid of [NaN, Infinity, -1, '40']) for (const key of ['c', 'q', 'e']) assert.equal(kit.activate(key, invalid), null);
    assert.deepEqual(kit.snapshot(), before);
  });
  test('EMBER sells canonical paid solder and shade stocks and never sells or borrows another kit signature', () => {
    const kit = new DuelistKit({ character: 'ember' }); let credits = 300, calls = 0;
    const spend = price => { calls++; if (credits < price) return false; credits -= price; return true; };
    for (const [key, type, max, price] of [['c', 'ember-solder', 2, 100], ['q', 'ember-shade', 1, 100], ['e', 'ember-service', 1, 0]]) {
      const definition = getCharacterSkill('ember', key); assert.equal(definition.id, type); assert.equal(definition.type, type);
      assert.equal(definition.max, max); assert.equal(definition.price, price); assert.ok(definition.name && definition.description && definition.icon);
      assert.equal(Object.isFrozen(definition), true);
    }
    assert.equal(kit.buy('ember-solder', spend), true); assert.equal(kit.buy('smoke', spend), true); assert.equal(kit.buy('c', spend), false);
    assert.equal(kit.buy('ember-shade', spend), true); assert.equal(kit.buy('q', spend), false); assert.equal(kit.buy('ember-service', spend), false);
    for (const id of ['nope-bottle', 'echo-tag', 'veil-roots', 'ember-ember-solder']) assert.equal(kit.buy(id, spend), false);
    assert.equal(credits, 0); assert.equal(calls, 3); assert.equal(kit.dash, 1); assert.equal(Object.isFrozen(EMBER_SKILLS), true);
    assert.deepEqual(EMBER_SKILLS, { solderRange: 18, solderFlight: .45, solderArmDelay: .2, solderRadius: 3.2, solderDamage: 75,
      solderTail: .35, solderGroundOffset: .12, shadeDuration: 8, shadeFlashScale: .15, serviceDuration: .8, signatureCooldown: 18 });
  });
  test('EMBER emits exact solder, prospective shade and service contracts while keeping its original seven-point three-pulse ultimate', () => {
    const kit = new DuelistKit({ character: 'ember' }); kit.buy('c', () => true); kit.buy('q', () => true); kit.ultPoints = 7;
    assert.deepEqual(kit.activate('c', 2), { type: 'ember-solder', flight: .45, armDelay: .2, radius: 3.2, range: 18, maxDamage: 75 }); assert.equal(kit.activate('c', 2), null);
    assert.deepEqual(kit.activate('q', 2), { type: 'ember-shade', duration: 8, flashScale: .15 }); assert.equal(kit.activate('q', 2), null);
    assert.deepEqual(kit.activate('e', 2), { type: 'ember-service', duration: .8, cooldown: 18 }); assert.equal(kit.activate('e', 3), null);
    assert.equal(kit.nextSignatureAt, 20); assert.equal(kit.armReadyAt, null); assert.equal(kit.armExpiresAt, null); assert.equal(kit.ultPoints, 7);
    assert.deepEqual(kit.activate('x', 3), { type: 'ember', radius: 6, duration: 4.8, pulses: [1.2, 2.4, 3.6], damage: 30 });
    assert.equal(kit.ultPoints, 0); assert.equal(kit.knivesActive, false); assert.equal(kit.consumeKnife(), false);
  });
  test('EMBER service cooldown survives JSON, rejects dash arms and invalid clocks, and refills by time or round rather than kills', () => {
    const kit = new DuelistKit({ character: 'ember' }); kit.buy('c', () => true); kit.buy('q', () => true); kit.activate('e', 10);
    kit.awardKill(); kit.awardKill(); assert.equal(kit.dash, 0); assert.equal(kit.dashKills, 0);
    const remote = new DuelistKit(); remote.restore(JSON.parse(JSON.stringify(kit.snapshot()))); assert.deepEqual(remote.snapshot(), kit.snapshot());
    assert.deepEqual(getSkillState(remote, 'e', 19), { count: 0, max: 1, ready: false, armed: false, charging: false, remaining: 9, progress: .5 });
    assert.equal(remote.activate('e', 27.999), null); assert.equal(remote.activate('e', 28).type, 'ember-service'); assert.equal(remote.nextSignatureAt, 46);
    remote.resetRound(); assert.equal(remote.dash, 1); assert.equal(remote.nextSignatureAt, 0); assert.equal(remote.smoke, 1); assert.equal(remote.updraft, 1); assert.equal(remote.ultPoints, 2);
    remote.resetRound({ reset: true }); assert.equal(remote.smoke, 0); assert.equal(remote.updraft, 0); assert.equal(remote.ultPoints, 0);
    for (const invalid of [NaN, Infinity, -1, '45']) {
      remote.restore({ character: 'ember', dash: 0, nextSignatureAt: invalid, armReadyAt: 2, armExpiresAt: 10, knivesActive: true, knives: 5 });
      assert.equal(remote.nextSignatureAt, 0); assert.equal(remote.armReadyAt, null); assert.equal(remote.knivesActive, false); assert.equal(remote.knives, 0);
    }
    const before = kit.snapshot(); for (const invalid of [NaN, Infinity, -1, '10']) for (const key of ['c', 'q', 'e']) assert.equal(kit.activate(key, invalid), null);
    assert.deepEqual(kit.snapshot(), before); assert.equal(Object.keys(CHARACTER_DEFS).length, 7);
  });
  test('FROST has immutable annular stitch, remote mist and slow-mitigation metadata with exact stocks and prices', () => {
    assert.equal(Object.isFrozen(FROST_SKILLS), true);
    assert.deepEqual(FROST_SKILLS, { stitchRange: 16, stitchFlight: .55, stitchArmDelay: .25, stitchDuration: 8,
      stitchRadius: 3.8, stitchInnerRadius: .9, stitchSpeedScale: .45, stitchGroundOffset: .12, stitchHeightTolerance: .45,
      mistRange: 18, mistFlight: .5, mistDuration: 9, mistRadius: 3.5, mistCenterOffset: 1.4,
      unravelDuration: 5, unravelSlowFraction: .15, signatureCooldown: 18 });
    const kit = new DuelistKit({ character: 'frost' }); let credits = 300, calls = 0;
    const spend = price => { calls++; if (credits < price) return false; credits -= price; return true; };
    for (const [key, name, type, max, price] of [['c', '霜のステッチ', 'frost-stitch', 2, 100], ['q', 'ドールミスト', 'frost-mist', 1, 100], ['e', 'ほどけるリボン', 'frost-unravel', 1, 0]]) {
      const def = getCharacterSkill('frost', key); assert.equal(Object.isFrozen(def), true);
      assert.equal(def.id, type); assert.equal(def.type, type); assert.equal(def.name, name); assert.equal(def.max, max); assert.equal(def.price, price);
      assert.equal(kit.buy(def.id, spend), key !== 'e'); assert.ok(def.description); assert.ok(def.icon);
    }
    assert.equal(kit.buy('smoke', spend), true); assert.equal(credits, 0); assert.equal(calls, 3);
    for (const id of ['frost-stitch', 'frost-mist', 'mend-seeds', 'e']) assert.equal(kit.buy(id, spend), false);
    assert.equal(calls, 3); assert.equal(signatureCooldown('frost'), 18); assert.equal(Object.keys(CHARACTER_DEFS).length, 7);
  });
  test('FROST ordinary casts return canonical mechanics and leave the existing seven-point ultimate unchanged', () => {
    const kit = new DuelistKit({ character: 'frost' }); kit.buy('c', () => true); kit.buy('q', () => true); kit.ultPoints = 7;
    assert.deepEqual(kit.activate('c', 5), { type: 'frost-stitch', flight: .55, armDelay: .25, duration: 8, radius: 3.8, innerRadius: .9, range: 16, speedScale: .45 });
    assert.deepEqual(kit.activate('q', 5), { type: 'frost-mist', flight: .5, duration: 9, radius: 3.5, range: 18 });
    assert.deepEqual(kit.activate('e', 5), { type: 'frost-unravel', duration: 5, slowFraction: .15, cooldown: 18 });
    assert.equal(kit.ultPoints, 7); assert.equal(kit.knivesActive, false); assert.equal(kit.armReadyAt, null); assert.equal(kit.armExpiresAt, null);
    assert.deepEqual(kit.activate('x', 5), { type: 'frost', radius: 7, duration: 10, warmup: .8, slowMultiplier: .55 });
    assert.equal(kit.ultPoints, 0); assert.equal(kit.activate('c', 5), null); assert.equal(kit.activate('q', 5), null);
  });
  test('FROST signature uses exactly18 seconds, survives JSON, ignores kill recharge and rejects inherited dash arms', () => {
    const kit = new DuelistKit({ character: 'frost' }); kit.buy('c', () => true); kit.buy('q', () => true); kit.activate('e', 10);
    kit.awardKill(); kit.awardKill(); assert.equal(kit.dash, 0); assert.equal(kit.dashKills, 0); assert.equal(kit.nextSignatureAt, 28);
    const guest = new DuelistKit(); assert.equal(guest.restore(JSON.parse(JSON.stringify(kit.snapshot()))), true); assert.deepEqual(guest.snapshot(), kit.snapshot());
    assert.deepEqual(getSkillState(guest, 'e', 19), { count: 0, max: 1, ready: false, armed: false, charging: false, remaining: 9, progress: .5 });
    assert.equal(guest.activate('e', 27.999), null); assert.equal(guest.activate('e', 28).type, 'frost-unravel'); assert.equal(guest.nextSignatureAt, 46);
    guest.resetRound(); assert.equal(guest.dash, 1); assert.equal(guest.nextSignatureAt, 0); assert.equal(guest.smoke, 1); assert.equal(guest.updraft, 1); assert.equal(guest.ultPoints, 2);
    guest.resetRound({ reset: true }); assert.equal(guest.smoke, 0); assert.equal(guest.updraft, 0); assert.equal(guest.ultPoints, 0);
    for (const bad of [NaN, Infinity, -1, '45']) {
      guest.restore({ character: 'frost', dash: 0, nextSignatureAt: bad, armReadyAt: 2, armExpiresAt: 10, knives: 5, knivesActive: true });
      assert.equal(guest.nextSignatureAt, 0); assert.equal(guest.armReadyAt, null); assert.equal(guest.armExpiresAt, null); assert.equal(guest.knives, 0); assert.equal(guest.knivesActive, false);
    }
    const before = kit.snapshot(); for (const invalid of [NaN, Infinity, -1, '10']) for (const key of ['c', 'q', 'e']) assert.equal(kit.activate(key, invalid), null);
    assert.deepEqual(kit.snapshot(), before);
  });
  test('WIND unique comet and lift preserve paid legacy aliases, immutable prices and stocks, and never acquire a timed E cooldown', () => {
    assert.equal(Object.isFrozen(DUELIST_SKILLS), true); assert.deepEqual(DUELIST_SKILLS, { cometRange: 18, cometFlight: .25, cometRadius: 2.8, cometDuration: 5, liftVisualDuration: .45 });
    const kit = new DuelistKit(); let credits = 400, calls = 0;
    const spend = value => { calls++; if (credits < value) return false; credits -= value; return true; };
    for (const [key, id, name, max, price] of [['c', 'duelist-comet', '流れ星の幕', 2, 100], ['q', 'duelist-lift', 'アンテナリフト', 2, 100], ['e', 'duelist-dash', 'テイルウィンド', 1, 0]]) {
      const def = getCharacterSkill('duelist', key); assert.equal(Object.isFrozen(def), true); assert.equal(def.id, id); assert.equal(def.name, name); assert.equal(def.max, max); assert.equal(def.price, price);
      assert.equal(kit.buy(id, spend), key !== 'e');
    }
    assert.equal(kit.buy('smoke', spend), true); assert.equal(kit.buy('updraft', spend), true); assert.equal(credits, 0); assert.equal(calls, 4);
    assert.equal(kit.buy('updraft', spend), false); assert.equal(kit.buy('duelist-comet', spend), false); assert.equal(calls, 4);
    assert.equal(signatureCooldown('duelist'), 0); kit.activate('e', 10); assert.equal(kit.dash, 0); kit.awardKill(); assert.equal(kit.dash, 1); assert.equal(kit.nextSignatureAt, 0);
    const transferred = new DuelistKit({ character: 'frost' }); transferred.restore(JSON.parse(JSON.stringify(kit.snapshot()))); assert.deepEqual(transferred.snapshot(), kit.snapshot());
    assert.equal(transferred.activate('e', 11).type, 'dash'); assert.equal(transferred.activate('e', 12).type, 'dash-armed');
    assert.equal(transferred.activate('e', 13).type, 'dash');
    const before = kit.snapshot(); for (const bad of [NaN, Infinity, -1, '10']) for (const key of ['c', 'q', 'e']) assert.equal(kit.activate(key, bad), null); assert.deepEqual(kit.snapshot(), before);
    assert.equal(DUELIST.updraftVelocity, 7.8); assert.equal(DUELIST.dashDistance, 12); assert.equal(DUELIST.dashDuration, .18); assert.equal(Object.keys(CHARACTER_DEFS).length, 7);
  });
  test('all strengthened tuning exports retain the agreed exact mechanics and unchanged ultimate budget', () => {
    assert.deepEqual(DUELIST,{smokeMax:2,smokePrice:100,smokeDuration:5,updraftMax:2,updraftPrice:100,updraftVelocity:7.8,dashArmDelay:.25,dashWindow:12,dashDistance:12,dashDuration:.18,signatureKills:1,ultimatePoints:7,knives:5});
    const expected = [
      [NOPE_SKILLS,{bottleFuse:1,bottleFlight:.55,bottleRadius:5.5,bottleDamage:90,flashFlight:.45,flashRadius:12,flashDuration:2.4,decoyDuration:12,signatureCooldown:15}],
      [MEND_SKILLS,{seedsFlight:.65,seedsRadius:4.5,seedsDuration:9,seedsSpeedScale:.5,seedsGroundOffset:.12,pollenFlight:.55,pollenRadius:4.2,pollenDuration:9,healAmount:60,healRange:18,healVisualDuration:.8,signatureCooldown:18}],
      [IAGNU_SKILLS,{tagFlight:.55,tagArmDelay:.5,tagDuration:12,tagRadius:4.5,tagRange:18,tagRevealDuration:2.5,tagGroundOffset:.12,glintFlight:.5,glintRadius:10,glintDuration:2,glintEyeOffset:1.6,kerningDuration:4,kerningSpeedScale:1.35,signatureCooldown:18}],
      [VEIL_SKILLS,{dustArmDelay:.2,dustRadius:3.5,dustDuration:7,dustCenterOffset:1.25,rootsRange:10,rootsMinRange:.5,rootsWidth:3.2,rootsArmDelay:.25,rootsDuration:8,rootsSpeedScale:.45,rootsHeightTolerance:.45,turfDuration:3,turfSpeedScale:1.5,signatureCooldown:15}],
    ];
    for(const [actual,value]of expected){assert.equal(Object.isFrozen(actual),true);assert.deepEqual(actual,value);}
  });
  test('every character pays100 per C or Q and JSON restores only its own allowed purchase counts', () => {
    for(const id of Object.keys(CHARACTER_DEFS)){
      const kit=new DuelistKit({character:id}),maxQ=id==='duelist'?2:1;let spent=0,calls=0;
      const spend=value=>{assert.equal(value,100);calls++;spent+=value;return true;};
      assert.equal(getCharacterSkill(id,'c').price,100);assert.equal(getCharacterSkill(id,'q').price,100);
      assert.equal(kit.buy('smoke',spend),true);assert.equal(kit.buy('c',spend),true);assert.equal(kit.buy('c',spend),false);
      for(let i=0;i<maxQ;i++)assert.equal(kit.buy(i?'updraft':'q',spend),true);
      assert.equal(kit.buy('q',spend),false);assert.equal(calls,2+maxQ);assert.equal(spent,(2+maxQ)*100);
      const remote=new DuelistKit();remote.restore(JSON.parse(JSON.stringify(kit.snapshot())));assert.deepEqual(remote.snapshot(),kit.snapshot());
      assert.deepEqual(getSkillState(remote,'q',0),{count:maxQ,max:maxQ,ready:true,armed:false,charging:false,remaining:0,progress:1});
      for(let i=0;i<maxQ;i++)assert.ok(remote.activate('q',0));assert.equal(remote.activate('q',0),null);
      assert.equal(getSkillState(remote,'q',0).ready,false);
      remote.restore({character:id,smoke:999,updraft:999,dashKills:999});assert.equal(remote.smoke,2);assert.equal(remote.updraft,maxQ);assert.equal(remote.dashKills,0);
      for(const invalid of [-1,NaN,Infinity,'2']){remote.restore({character:id,smoke:invalid,updraft:invalid});assert.equal(remote.smoke,0);assert.equal(remote.updraft,0);}
      assert.equal(remote.buy('c',()=>false),false);assert.equal(remote.smoke,0,'A rejected payment never grants a charge');
    }
  });
  test('picker and shop descriptions expose the strengthened values without altering ultimate descriptions', () => {
    const tokens={
      duelist:[['18m','5秒','2.8m'],['7.8','2回'],['0.25秒','12秒','12m','1撃破']],
      nope:[['1秒','5.5m','90'],['12m','2.4秒'],['12秒','15秒']],
      mend:[['9秒','4.5m','50%'],['9秒','4.2m'],['18m','60HP','18秒']],
      echo:[['18m','12秒','4.5m','2.5秒'],['10m','2秒'],['4秒','1.35倍','18秒']],
      veil:[['0.2秒','7秒','3.5m'],['10m','3.2m','8秒','45%'],['3秒','1.5倍','15秒']],
      ember:[['18m','3.2m','75'],['8秒','15%'],['0.8秒','18秒']],
      frost:[['16m','8秒','0.9〜3.8m','45%'],['18m','9秒','3.5m'],['5秒','15%','18秒']],
    };
    for(const [id,slots]of Object.entries(tokens))for(let i=0;i<3;i++)for(const token of slots[i])assert.ok(getCharacterSkill(id,['c','q','e'][i]).description.includes(token),`${id} ${i} description includes ${token}`);
  });
  const abilitySource=fs.readFileSync(path.join(__dirname,'public/abilities.js'),'utf8');
  const controls=[
    ['duelist Q restoration',"getCharacterSkill(this.character, 'q').max",'1',module=>{const kit=new module.DuelistKit();kit.restore({character:'duelist',updraft:2});assert.equal(kit.updraft,2);}],
    ['other character Q cap',"getCharacterSkill(this.character, 'q').max",'DUELIST.updraftMax',module=>{const kit=new module.DuelistKit({character:'nope'});kit.restore({character:'nope',updraft:2});assert.equal(kit.updraft,1);}],
    ['one-kill recharge','signatureKills: 1','signatureKills: 2',module=>{const kit=new module.DuelistKit();kit.activate('e',0);kit.activate('e',.25);kit.awardKill();assert.equal(kit.dash,1);}],
    ['100-credit price','smokePrice: 100','smokePrice: 200',module=>{let price;const kit=new module.DuelistKit();kit.buy('c',value=>{price=value;return true;});assert.equal(price,100);}],
  ];
  for(const [name,original,replacement,verify]of controls){
    assert.ok(abilitySource.includes(original));
    const mutant=await import(`data:text/javascript;base64,${Buffer.from(abilitySource.replace(original,replacement)).toString('base64')}`);
    assert.throws(()=>verify(mutant),assert.AssertionError,`${name} negative control must fail`);
  }
  assert.equal(fs.readFileSync(path.join(__dirname,'public/abilities.js'),'utf8'),abilitySource);
  console.log('PASS: four in-memory negative controls reject stock, recharge and pricing regressions');passed++;
  const cpu=process.cpuUsage(cpuStarted);
  console.log(`Ability tests passed: ${passed} groups. wall=${(performance.now()-started).toFixed(3)}ms cpu=${((cpu.user+cpu.system)/1000).toFixed(3)}ms (offline only; no browser/audio)`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
