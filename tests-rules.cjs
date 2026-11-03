const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const { MatchRules, RULES, applyArmorDamage, WEAPONS } = await import(pathToFileURL(path.join(__dirname, 'public/rules.js')).href);
  let passed = 0;
  const test = (name, fn) => { fn(); passed++; console.log(`PASS: ${name}`); };
  const live = (options = {}) => { const m = new MatchRules(options); m.startLive(); return m; };
  const finishRound = (m, team, reason = 'elimination', context = { playerAlive: false }) => {
    assert.equal(m.phase, 'buy'); m.startLive();
    assert.equal(m.endRound(team, reason, context), true);
    m.nextRound();
  };
  const plant = (m, dt = 4, actorId = m.spike.carrier) => m.interactPlant(dt, { actorId, team: m.attackerTeam, site: 'A', x: 0, z: -17 });
  const defuse = (m, dt, actorId = 'defender') => m.interactDefuse(dt, { actorId, team: m.defenderTeam });
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);

  test('buy phase lasts 45 seconds initially and cannot spend after barriers drop', () => {
    const m = new MatchRules();
    assert.equal(m.credits, 800); assert.equal(m.round, 1); assert.equal(m.side, 'attack');
    assert.equal(m.purchase(500), true); assert.equal(m.credits, 300);
    assert.equal(m.purchase(400), false); assert.equal(m.purchase(-1), false);
    m.tick(44.99); assert.equal(m.phase, 'buy');
    m.tick(.02); assert.equal(m.phase, 'live'); assert.equal(m.roundTime, 100);
    assert.equal(m.purchase(100), false); assert.equal(m.credits, 300);
  });

  test('standard halves switch after 12 rounds and reset money to 800', () => {
    for (const startingSide of ['attack', 'defend']) {
      const m = new MatchRules({ startingSide });
      for (let i = 0; i < 12; i++) {
        assert.equal(m.side, startingSide);
        finishRound(m, i % 2 ? 'red' : 'blue');
      }
      assert.equal(m.round, 13); assert.equal(m.side, startingSide === 'attack' ? 'defend' : 'attack');
      assert.equal(m.credits, 800); assert.equal(m.phaseTime, 45); assert.equal(m.lossStreak, 0);
      assert.equal(m.spike.carrier, m.side === 'attack' ? 'player' : 'red-0');
    }
  });

  test('standard reaches 13 wins and ends exactly once', () => {
    const m = new MatchRules();
    for (let i = 0; i < 13; i++) finishRound(m, 'blue');
    assert.equal(m.score.blue, 13); assert.equal(m.score.red, 0); assert.equal(m.phase, 'match');
    assert.equal(m.winner, 'blue');
    assert.equal(m.endRound('red', 'elimination'), false);
    m.tick(1000); assert.equal(m.score.red, 0);
  });

  test('12-12 overtime alternates sides, resets 5000 and requires two-round lead', () => {
    const m = new MatchRules();
    for (let i = 0; i < 24; i++) finishRound(m, i % 2 ? 'red' : 'blue');
    assert.deepEqual(m.score, { blue: 12, red: 12 });
    assert.equal(m.round, 25); assert.equal(m.overtime, true); assert.equal(m.credits, 5000);
    const side25 = m.side;
    finishRound(m, 'blue');
    assert.equal(m.phase, 'buy'); assert.equal(m.winner, null); assert.equal(m.credits, 5000);
    assert.notEqual(m.side, side25);
    finishRound(m, 'red'); assert.equal(m.phase, 'buy'); assert.equal(m.side, side25);
    finishRound(m, 'red'); assert.equal(m.phase, 'buy');
    finishRound(m, 'red'); assert.equal(m.phase, 'match'); assert.equal(m.winner, 'red');
    assert.deepEqual(m.score, { blue: 13, red: 15 });
  });

  test('Swiftplay first-to-five has a four-round half and sudden-death ninth round', () => {
    const m = new MatchRules({ format: 'swift', startingSide: 'defend' });
    for (let i = 0; i < 8; i++) {
      assert.equal(m.side, i < 4 ? 'defend' : 'attack');
      finishRound(m, i % 2 ? 'red' : 'blue');
      if (i === 3) { assert.equal(m.credits, 800); assert.equal(m.phaseTime, 45); }
    }
    assert.equal(m.round, 9); assert.deepEqual(m.score, { blue: 4, red: 4 });
    assert.equal(m.credits, 5000, 'Swift sudden death resets the bank to 5000');
    assert.equal(m.drainEvents().filter(e => e.type === 'round-start').at(-1).reset, true, 'Swift sudden death also resets equipment');
    finishRound(m, 'red'); assert.equal(m.phase, 'match'); assert.equal(m.winner, 'red');
  });

  test('short matches use standard win/loss income instead of automatic full-buy grants', () => {
    const m = new MatchRules({ format: 'swift' });
    m.purchase(500); finishRound(m, 'blue'); assert.equal(m.credits, 3300);
    finishRound(m, 'red'); assert.equal(m.credits, 5200);
    m.purchase(5000); finishRound(m, 'red'); assert.equal(m.credits, 2600);
    const loser = new MatchRules({ format: 'swift' });
    finishRound(loser, 'red'); assert.equal(loser.credits, 2700);
  });

  test('a win resets loss income for either match length and repeated endRound cannot pay twice', () => {
    for (const format of ['standard', 'swift']) {
      const m = new MatchRules({ format });
      for (const team of ['red','red','red','blue']) {
        m.credits=0;m.startLive();m.endRound(team,'elimination',{playerAlive:false});
        const expected=team==='blue'?3000:1900+Math.min(m.lossStreak-1,2)*500;
        assert.equal(m.credits,expected);assert.equal(m.endRound(team,'elimination'),false);assert.equal(m.credits,expected);
        if (team==='blue')assert.equal(m.lossStreak,0);
        m.nextRound();
      }
      // Standard continues; short format also reset its half at this point.
      m.credits=0;m.startLive();m.endRound('red','elimination',{playerAlive:false});assert.equal(m.credits,1900);
    }
  });

  test('standard win, loss streak and kill credits obey the 9000 cap', () => {
    const m = new MatchRules();
    finishRound(m, 'red'); assert.equal(m.credits, 2700); assert.equal(m.lossStreak, 1);
    m.purchase(2700); finishRound(m, 'red'); assert.equal(m.credits, 2400);
    m.purchase(2400); finishRound(m, 'red'); assert.equal(m.credits, 2900);
    m.purchase(2900); finishRound(m, 'red'); assert.equal(m.credits, 2900);
    m.purchase(2900); finishRound(m, 'blue'); assert.equal(m.credits, 3000);
    m.startLive(); m.awardKill(); assert.equal(m.credits, 3200);
    m.addCredits(10000); assert.equal(m.credits, RULES.maxCredits); assert.equal(m.credits, 9000);
  });

  test('saving on attack timeout or defense detonation pays reduced 1000', () => {
    for(const format of ['standard','swift']){
      const attack = new MatchRules({format});
      finishRound(attack, 'red', 'timeout', { playerAlive: true });
      assert.equal(attack.credits, 1800);
      const defense = new MatchRules({format, startingSide: 'defend' });
      finishRound(defense, 'red', 'detonation', { playerAlive: true });
      assert.equal(defense.credits, 1800);
    }
  });

  test('timeout and elimination resolve for the correct side', () => {
    for (const startingSide of ['attack', 'defend']) {
      const timeout = live({ startingSide }); timeout.tick(100);
      assert.equal(timeout.lastRound.team, timeout.defenderTeam); assert.equal(timeout.lastRound.reason, 'timeout');
      const eliminated = live({ startingSide });
      eliminated.tick(.01, { blueAlive: 5, redAlive: 0 });
      assert.equal(eliminated.lastRound.team, 'blue');
      assert.equal(eliminated.lastRound.reason, 'elimination');
    }
  });

  test('only the attacking carrier can plant at a site while stationary', () => {
    const m = live();
    assert.equal(m.interactPlant(4, { actorId: 'player', team: 'red', site: 'A', x: 0, z: 0 }), false);
    assert.equal(m.interactPlant(4, { actorId: 'teammate', team: 'blue', site: 'A', x: 0, z: 0 }), false);
    assert.equal(m.interactPlant(4, { actorId: 'player', team: 'blue', site: null, x: 0, z: 0 }), false);
    plant(m, 2); assert.equal(m.spike.plantProgress, 2);
    m.interactPlant(.1, { actorId: 'player', team: 'blue', site: 'A', stationary: false });
    assert.equal(m.spike.plantProgress, 0);
    plant(m, 3.99); assert.equal(m.spike.status, 'carried');
    plant(m, .01); assert.equal(m.spike.status, 'planted'); assert.equal(m.spike.timer, 45);
    assert.equal(m.spike.site, 'A'); assert.equal(m.credits, 1100);
    assert.equal(plant(m, 4), false); assert.equal(m.credits, 1100);
  });

  test('dropped spike cancels planting and requires nearby attacking pickup', () => {
    const m = live(); plant(m, 2);
    assert.equal(m.dropSpike('wrong', 2, 3), false);
    assert.equal(m.dropSpike('player', 2, 3), true);
    assert.equal(m.spike.plantProgress, 0); assert.equal(m.spike.status, 'dropped');
    assert.equal(m.pickupSpike('defender', 'red', 2, 3), false);
    assert.equal(m.pickupSpike('teammate', 'blue', 20, 30), false);
    assert.equal(m.pickupSpike('teammate', 'blue', 2, 3), true);
    assert.equal(m.spike.carrier, 'teammate'); assert.equal(plant(m, 4, 'teammate'), true);
  });

  test('plant replaces round countdown and keeps the round live after attackers die', () => {
    const m = live(); m.roundTime = 5; plant(m);
    m.tick(40, { blueAlive: 0, redAlive: 5 });
    assert.equal(m.phase, 'live'); assert.equal(m.spike.timer, 5);
    m.tick(5, { blueAlive: 0, redAlive: 5 });
    assert.equal(m.phase, 'post'); assert.equal(m.spike.status, 'detonated');
    assert.equal(m.lastRound.team, 'blue'); assert.equal(m.lastRound.reason, 'detonation');
  });

  test('defuse needs seven seconds and preserves only the 3.5-second checkpoint', () => {
    const m = live(); plant(m);
    assert.equal(m.interactDefuse(7, { actorId: 'attacker', team: 'blue' }), false);
    defuse(m, 3); m.cancelDefuse('defender'); assert.equal(m.spike.defuseProgress, 0);
    defuse(m, 3.5); assert.equal(m.spike.checkpoint, 3.5);
    m.cancelDefuse('defender'); assert.equal(m.spike.defuseProgress, 3.5);
    defuse(m, 1, 'other-defender'); m.cancelDefuse('other-defender'); assert.equal(m.spike.defuseProgress, 3.5);
    defuse(m, 3.49); assert.equal(m.phase, 'live');
    assert.equal(defuse(m, .01), true); assert.equal(m.spike.status, 'defused');
    assert.equal(m.lastRound.team, 'red'); assert.equal(m.lastRound.reason, 'defuse');
  });

  test('simultaneous human or BOT defusers keep the first owner and still require seven seconds', () => {
    for (const [startingSide, first, second] of [
      ['defend', 'player', 'blue-1'], ['attack', 'red-0', 'red-1'], ['defend', 'bot-defender', 'player'],
    ]) {
      const m = live({ startingSide }); plant(m); m.drainEvents();
      for (let frame = 1; frame <= 139; frame++) {
        assert.equal(defuse(m, .05, first), false);
        assert.equal(defuse(m, .05, second), false);
        m.cancelDefuse(second);
        assert.equal(m.spike.defuseActor, first, 'A waiting teammate cannot steal or cancel the active owner');
        close(m.spike.defuseProgress, frame * .05);
        assert.equal(m.phase, 'live', 'Two held keys must not double the defuse rate');
      }
      assert.equal(defuse(m, .05, first), true);
      assert.equal(defuse(m, .05, second), false);
      assert.equal(m.spike.status, 'defused');
      assert.equal(m.score[m.defenderTeam], 1);
      assert.equal(m.drainEvents().filter(event => event.type === 'defused').length, 1);
    }
  });

  test('defuse ownership hands over only after cancellation and preserves the saved half', () => {
    const m = live(); plant(m);
    defuse(m, 3, 'human');
    assert.equal(defuse(m, 1, 'bot'), false); close(m.spike.defuseProgress, 3);
    m.cancelDefuse('human'); assert.equal(m.spike.defuseActor, null); close(m.spike.defuseProgress, 0);
    defuse(m, 3.5, 'bot'); close(m.spike.checkpoint, 3.5);
    defuse(m, 1, 'bot'); close(m.spike.defuseProgress, 4.5);
    m.cancelDefuse('human'); close(m.spike.defuseProgress, 4.5);
    m.cancelDefuse('bot'); close(m.spike.defuseProgress, 3.5);
    defuse(m, 2, 'human'); assert.equal(m.spike.defuseActor, 'human'); close(m.spike.defuseProgress, 5.5);
    assert.equal(defuse(m, 1, 'bot'), false); close(m.spike.defuseProgress, 5.5);
    m.cancelDefuse('human');
    assert.equal(defuse(m, 3.5, 'bot'), true); assert.equal(m.spike.status, 'defused');

    for (const options of [{ near: false }, { stationary: false }]) {
      for (const progress of [2, 4]) {
        const released = live(); plant(released); defuse(released, progress, 'first');
        assert.equal(released.interactDefuse(.05, { actorId: 'waiting', team: released.defenderTeam, ...options }), false);
        assert.equal(released.spike.defuseActor, 'first', 'An ineligible waiting actor cannot clear ownership');
        assert.equal(released.interactDefuse(.05, { actorId: 'first', team: released.defenderTeam, ...options }), false);
        assert.equal(released.spike.defuseActor, null);
        close(released.spike.defuseProgress, progress >= 3.5 ? 3.5 : 0);
        defuse(released, .1, 'waiting');
        assert.equal(released.spike.defuseActor, 'waiting');
        close(released.spike.defuseProgress, (progress >= 3.5 ? 3.5 : 0) + .1);
      }
    }
  });

  test('insufficient spike time cannot finish a plant or defuse', () => {
    const m = live(); m.roundTime = 3.99;
    assert.equal(plant(m), false); assert.equal(m.spike.status, 'carried');
    const d = live(); plant(d); d.spike.timer = 6.99;
    assert.equal(defuse(d, 7), false); d.tick(7);
    assert.equal(d.spike.status, 'detonated'); assert.equal(d.lastRound.team, 'blue');
  });

  test('armor absorbs two thirds until depleted and overflow reaches health', () => {
    let damage = applyArmorDamage(100, 50, 40);
    close(damage.hp, 100 - 40 / 3); close(damage.armor, 50 - 80 / 3);
    damage = applyArmorDamage(100, 25, 40); close(damage.hp, 85); close(damage.armor, 0);
    damage = applyArmorDamage(100, 50, 160); assert.equal(damage.hp, 0); assert.equal(damage.armor, 0);
    damage = applyArmorDamage(100, 0, 26); assert.deepEqual(damage, { hp: 74, armor: 0 });
    assert.equal(WEAPONS.vandal.mag, 25); assert.equal(WEAPONS.vandal.head, 160);
  });

  test('phase events drain once and post round advances without duplicate score', () => {
    const m = live(); assert.equal(m.drainEvents()[0].type, 'live'); assert.deepEqual(m.drainEvents(), []);
    m.tick(.01, { redAlive: 0 }); assert.equal(m.score.blue, 1);
    m.tick(4.99); assert.equal(m.phase, 'post');
    m.tick(.02); assert.equal(m.phase, 'buy'); assert.equal(m.round, 2); assert.equal(m.phaseTime, 30);
    assert.equal(m.score.blue, 1);
    assert.deepEqual(m.drainEvents().map(e => e.type), ['round-end', 'round-start']);
  });

  console.log(`${passed} rule tests passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
