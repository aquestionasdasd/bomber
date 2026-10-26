const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// Independent saved-game worlds, real collision/physics, JSON packet boundaries.
// Rendering, browser timers and audio are inert. No sockets or user tabs.
async function main() {
  const started = performance.now();
  let fixture = fs.readFileSync(path.join(__dirname, 'tests-nope-decoy-game.cjs'), 'utf8');
  const cut = fixture.indexOf('  const local = harness();');
  assert.ok(cut > 0);
  fixture = fixture.slice(0, cut);
  if (process.env.TRC_SYNC_FAULT) {
    let game = fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8');
    const replace = (before, after) => { assert.equal(game.split(before).length, 2); game = game.replace(before, after); };
    if (process.env.TRC_SYNC_FAULT === 'height-rewind') replace('if(player.trcLadder||wasClimbing){', 'if(player.trcLadder||wasClimbing||Math.abs(player.y-self.y)>.55){');
    else if (process.env.TRC_SYNC_FAULT === 'repeat-jump') replace('!actor.netTrcJumpActive&&inputFeet>actor.y+.1', 'inputFeet>actor.y+.1');
    else if (process.env.TRC_SYNC_FAULT === 'vertical-velocity') replace("if(!map.traversal||flight||ordinarySkills.onnaraEvent?.('onnara-hover',actor.id,elapsed))actor.vy=", 'actor.vy=');
    else if (process.env.TRC_SYNC_FAULT === 'early-stair-rejection') replace('waitForStep=blocked&&', 'waitForStep=false&&blocked&&');
    else throw Error('unknown fault');
    fixture = fixture.replace('vm.runInContext(source.replace(', `vm.runInContext((${JSON.stringify(game)}).replace(`);
  }
  const mod = new Module(path.join(__dirname, 'trc-sync-fixture.cjs'), module);
  mod.filename = path.join(__dirname, 'trc-sync-fixture.cjs'); mod.paths = Module._nodeModulePaths(__dirname);
  mod._compile(fixture + '\n return {harness,copy};\n}\nmodule.exports=main;', mod.filename);
  const { harness, copy } = await mod.exports();
  const host = harness({ realMap: true }), guest = harness({ realMap: true }), solo = harness({ realMap: true });
  let groups = 0;
  const check = (name, fn) => { if (process.env.TRC_SYNC_GROUP && !name.includes(process.env.TRC_SYNC_GROUP)) return; fn(); groups++; console.log('PASS: ' + name); };
  const near = (a, b, name, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${name}: ${a} != ${b}`);
  const pose = (w, who = 'player') => copy(w.run(`({x:${who}.x,y:${who}.y,z:${who}.z,vy:${who}.vy})`));

  function setup({ arena = 'trc', start = null } = {}) {
    for (const w of [host, guest, solo]) {
      w.sandbox.arena = arena;
      w.reset(); w.run(`selectArena(arena);match.phase='live';mode='play';clearCombatInput();clearBots();
        makeBot({x:45,z:-50},0,'red',{id:'enemy',team:'red',secondary:'classic'});bots[0].rangeTarget=true;
        map.traversal?.restore(map.traversal.snapshot().map(([id,hp])=>[id,hp,true]));
        netClock=0;netSequence=0;netRound=0;netLastSnapshot=0;netHasSnapshot=false;netInputs.clear();netApplied.clear();
        netPositionHistory.clear();netPositionAck=0;netPositionCorrectionX=netPositionCorrectionZ=0;elapsed=10;
        player.trcLadder=null;player.vy=0;player.vx=player.vz=0;`);
    }
    const initial = start || copy(host.run('({...map.teamSpawns.attack[0],y:0})'));
    for (const w of [host, guest, solo]) w.sandbox.initial = initial;
    host.run(`makeBot(initial,1,'blue',{id:'blue-1',team:'blue',secondary:'classic',kit:new DuelistKit({character:'nope'})});
      var remote=bots.at(-1);remote.remoteId='guest';remote.netWeapon='classic';remote.netAmmo=12;remote.netReserve=36;remote.netReload=0;remote.lastNetShot=-10;
      roster=[roster[0],remote.record];Object.assign(remote,initial,{vy:0});var sent=[];onlinePlaying=true;
      online={host:true,session:{memberId:'host'},send:(p,{team}={})=>{if(team==='blue')sent.push(JSON.parse(JSON.stringify(p)))}};
      netParticipants.set('guest','blue-1');tickOnline(.1);`);
    guest.run(`var sent=[];onlinePlaying=true;online={host:false,session:{memberId:'guest',hostId:'host'},room:{code:'TRCSYNCS',settings:{mapId:arena}},send:p=>sent.push(JSON.parse(JSON.stringify(p)))};netParticipants.set('guest','blue-1');`);
    guest.sandbox.packet = copy(host.run('sent.at(-1)')); guest.run("receiveNetPacket('host',packet);player.yaw=0");
    solo.run('Object.assign(player,initial,{yaw:0,vy:0,vx:0,vz:0});onlinePlaying=false');
    return initial;
  }

  function simulate({ hz = 60, delay = .1, relay = false, seconds = 2, keys = ['KeyD'], jumpAt = -1, control = null, arena = 'trc', start = null } = {}) {
    const initial = setup({ arena, start }), dt = 1 / hz;
    for (const w of [guest, solo]) { w.sandbox.held = keys; w.run('for(const k of held)keys.add(k)'); }
    const uplink = [], downlink = []; let hn = 1, gn = 0, pendingUp, pendingDown, corrections = 0, largest = 0, snapsY = 0, hostRises = 0, lastHostY = initial.y;
    let jumped = false, uplinkTime = 0, downlinkTime = 0, lastClientVy = 0, clientLandings = 0;
    const frames = Math.ceil(seconds * hz), trace = [];
    const deliver = (queue, time, w, from, after) => { for (const row of queue) if (!row.used && row.at <= time + 1e-9) { row.used = true; w.sandbox.packet = row.packet; const before = pose(w); w.run(`receiveNetPacket('${from}',packet)`); after?.(before, pose(w)); } };
    for (let frame = 1; frame <= frames; frame++) {
      const time = frame * dt;
      deliver(uplink, time, host, 'guest');
      host.sandbox.dt = dt; host.run('elapsed+=dt;updateRemoteActor(remote,dt);tickOnline(dt)');
      const hp = copy(host.run('sent'));
      for (; hn < hp.length; hn++) { if (relay) pendingDown = hp[hn]; else downlink.push({ at: time + delay, packet: hp[hn] }); }
      if (relay && time >= downlinkTime + .2 - 1e-9 && pendingDown) { downlink.push({ at: time + delay, packet: pendingDown }); pendingDown = null; downlinkTime = time; }
      deliver(downlink, time, guest, 'host', (a, b) => {
        const progress = (b.x - a.x) * (keys.includes('KeyD') ? 1 : keys.includes('KeyA') ? -1 : 0) + (b.z - a.z) * (keys.includes('KeyS') ? 1 : keys.includes('KeyW') ? -1 : 0);
        if (progress < -.001) { corrections++; largest = Math.max(largest, -progress); }
        if (Math.abs(b.y - a.y) > .001) snapsY++;
      });
      for (const w of [guest, solo]) {
        w.sandbox.dt = dt; w.sandbox.testTime = time;
        if (!jumped && jumpAt >= 0 && time >= jumpAt - 1e-9) w.run('jump()');
        if (control) { w.sandbox.control = control; w.run('eval(control)'); }
        w.run('updatePlay(dt);tickOnline(dt)');
      }
      if (jumpAt >= 0 && time >= jumpAt - 1e-9) jumped = true;
      const gp = copy(guest.run('sent'));
      for (; gn < gp.length; gn++) { if (relay) pendingUp = gp[gn]; else uplink.push({ at: time + Math.max(dt, delay), packet: gp[gn] }); }
      if (relay && time >= uplinkTime + .2 - 1e-9 && pendingUp) { uplink.push({ at: time + Math.max(dt, delay), packet: pendingUp }); pendingUp = null; uplinkTime = time; }
      const p = pose(guest), h = pose(host, 'remote');
      if (h.y > lastHostY + .001 && lastHostY === 0) hostRises++; lastHostY = h.y;
      if (lastClientVy < 0 && p.vy === 0) clientLandings++; lastClientVy = p.vy;
      if (frame % Math.max(1, Math.round(hz / 10)) === 0) trace.push({ time, guest: p, host: h });
    }
    const result = { hz, delay, relay, corrections, largest, snapsY, hostRises, clientLandings, guest: pose(guest), host: pose(host, 'remote'), solo: pose(solo) };
    for (const axis of ['x', 'y', 'z']) near(result.guest[axis], result.solo[axis], `prediction ${axis} ${JSON.stringify(result)}`);
    assert.equal(corrections, 0, JSON.stringify({ ...result, trace })); assert.equal(snapsY, 0, 'ordinary motion must not be reset by a delayed height');
    assert.ok(guest.run('netPositionHistory.size<=128')); assert.ok(guest.run('netPositionAck>0'));
    return result;
  }

  const measured = [];
  check('TRC normal jumps retain all newer motion at 20/60/144Hz, delayed direct and coalesced HTTP', () => {
    for (const hz of [20, 60, 144]) for (const delay of [0, .1, .2]) for (const relay of [false, true]) {
      const r = simulate({ hz, delay, relay, seconds: 2.2, jumpAt: 0 });
      assert.equal(r.guest.y, 0); assert.equal(r.host.y, 0); assert.equal(r.hostRises, 1); assert.equal(r.clientLandings, 1); measured.push(r);
    }
  });
  check('both real stairways ascend and descend without snapshot height rewinds', () => {
    const ramps = copy(host.run('map.ramps'));
    for (const ramp of ramps) for (const hz of [20, 60, 144]) for (const relay of [false, true]) for (const ascent of [true, false]) {
      const sign = ramp.direction * (ascent ? 1 : -1), length = ramp.maxZ - ramp.minZ + 1.1;
      const start = { x: (ramp.minX + ramp.maxX) / 2, z: sign > 0 ? ramp.minZ - .55 : ramp.maxZ + .55, y: ascent ? 0 : ramp.height };
      const r = simulate({ hz, delay: .1, relay, start, keys: [sign > 0 ? 'KeyS' : 'KeyW'], seconds: length / 2.8 + .45,
        control: `keys.add('ShiftLeft');if(testTime>${length / 2.8})keys.clear()` });
      near(r.guest.y, ascent ? ramp.height : 0, 'stair landing'); measured.push(r);
    }
  });
  check('dropping from the real B stage is predicted once and lands on its lower floor', () => {
    for (const hz of [20, 60, 144]) for (const relay of [false, true]) {
      const start = { x: 29, y: 1.2, z: -46 };
      const r = simulate({ hz, relay, start, keys: ['KeyS'], seconds: 2 }); assert.equal(r.guest.y, 0); assert.equal(r.host.y, 0); measured.push(r);
    }
  });
  check('jumping beside stairs and onto the B stage retains predicted movement', () => {
    setup();
    const ramps = copy(host.run('map.ramps'));
    for (const hz of [20, 60, 144]) for (const relay of [false, true]) {
      for (const ramp of ramps) {
        const sign = ramp.direction, start = { x: (ramp.minX + ramp.maxX) / 2, z: sign > 0 ? ramp.minZ - .55 : ramp.maxZ + .55, y: 0 };
        measured.push(simulate({ hz, relay, start, keys: [sign > 0 ? 'KeyS' : 'KeyW'], jumpAt: .05, seconds: 1.3 }));
      }
      const r = simulate({ hz, relay, start: { x: 29, y: 0, z: -43 }, keys: ['KeyW'], jumpAt: .1, seconds: 1.1,
        control: "if(testTime>.65)keys.clear()" });
      near(r.guest.y, 1.2, 'jump onto stage'); measured.push(r);
    }
  });
  check('ordinary motion on both station maps still matches standalone movement', () => {
    for (const arena of ['hashimoto', 'hirakata']) measured.push(simulate({ arena, start: { x: 0, y: 0, z: 26 }, relay: true, seconds: 1, jumpAt: 0 }));
  });
  check('one stale or forged airborne height cannot relaunch the host or raise jump height', () => {
    setup(); host.run(`netInputs.set('guest',{seq:1,connection:'forged',round:match.round,input:{x:remote.x,z:remote.z,y:99},actions:[],received:elapsed});var top=0,rises=0,lastY=0;
      for(var i=0;i<120;i++){elapsed+=1/60;netInputs.get('guest').received=elapsed;updateRemoteActor(remote,1/60);if(remote.y>lastY+.001&&lastY===0)rises++;lastY=remote.y;top=Math.max(top,remote.y)};`);
    assert.equal(host.run('rises'), 1); assert.equal(host.run('remote.y'), 0); assert.equal(host.run('remote.vy'), 0);
    assert.ok(host.run('top<=6.552**2/30+1e-6'));
  });
  check('host accepts a second real jump after a grounded input and keeps exact ballistic gravity', () => {
    setup(); host.run(`var sendJump=y=>receiveNetPacket('guest',{type:'input',seq:++netSequence,round:match.round,input:{x:remote.x,z:remote.z,y},actions:[]});sendJump(.4);var first=remote.y;
      elapsed+=1/60;updateRemoteActor(remote,1/60);`);
    near(host.run('remote.vy'), 6.552 - 15 / 60, 'ballistic velocity');
    host.run(`for(var i=0;i<70;i++){elapsed+=1/60;netInputs.get('guest').received=elapsed;updateRemoteActor(remote,1/60)}sendJump(0);elapsed+=1/60;updateRemoteActor(remote,1/60);sendJump(.4);elapsed+=1/60;updateRemoteActor(remote,1/60);`);
    assert.ok(host.run('remote.y>0&&remote.vy>0'));
  });
  check('host collision, ceiling and speed authority survive ordinary predicted height', () => {
    setup();
    host.run(`var oldX=remote.x,oldZ=remote.z;receiveNetPacket('guest',{type:'input',seq:100,round:match.round,input:{x:999,z:999,y:99},actions:[]});elapsed+=1/60;updateRemoteActor(remote,1/60);`);
    assert.ok(host.run('Math.hypot(remote.x-oldX,remote.z-oldZ)<=8.05/60+1e-7'));
    assert.ok(host.run('remote.y<=6.552/60'));
    const duct = { x: -49.8, y: 0, z: -30 };
    setup({ start: duct });
    host.run(`remote.crouch=1;netInputs.set('guest',{seq:1,connection:'ceiling',round:match.round,input:{x:remote.x,z:remote.z,y:99,crouch:1},actions:[],received:elapsed});var top=0;
      for(var i=0;i<90;i++){elapsed+=1/60;netInputs.get('guest').received=elapsed;updateRemoteActor(remote,1/60);top=Math.max(top,remote.y);if(!canStand(remote.x,remote.z,.34,remote.y,actorBodyHeight(remote)))throw Error('ceiling entered')}`);
    assert.ok(host.run('top<.22')); assert.equal(host.run('remote.y'), 0);
    setup(); host.wall({ x: -1, z: 57, width: .2, depth: 5, height: 4 });
    host.run(`Object.assign(remote,{x:-1.6,y:0,z:57,vy:0});netInputs.set('guest',{seq:1,connection:'wall',round:match.round,input:{x:0,z:57,y:99},actions:[],received:elapsed});
      for(var i=0;i<30;i++){elapsed+=1/60;netInputs.get('guest').received=elapsed;netInputs.get('guest').seq++;updateRemoteActor(remote,1/60)}`);
    assert.ok(host.run('remote.x<=-1.44+1e-5')); assert.ok(host.run('remote.netPositionAck.x<=-1.44+1e-5'));
  });
  check('input-reference corrections, old connections, death/revival and next-round reset remain authoritative', () => {
    setup();
    guest.run(`player.x+=1;player.y=.8;player.vy=3;player.yaw=.7;player.pitch=.4;netClock=0;tickOnline(.1);var inputSeq=netSequence;player.x+=.5;`);
    const correction = copy(host.run('sent.at(-1)'));
    correction.seq += 100; correction.positionAcks.guest = { seq: guest.run('inputSeq'), connection: 'legacy', round: correction.rules.round, x: guest.run('player.x') - .5 - .2, z: guest.run('player.z') };
    guest.sandbox.packet = copy(correction); const before = pose(guest);
    guest.run("receiveNetPacket('host',packet)"); near(guest.run('player.x'), before.x - .2, 'retain newer XZ'); near(guest.run('player.y'), .8, 'retain jump'); near(guest.run('player.vy'), 3, 'retain impulse');
    near(guest.run('player.yaw'), .7, 'retain yaw'); near(guest.run('player.pitch'), .4, 'retain pitch');
    correction.seq++; guest.sandbox.packet = copy(correction); const accepted = pose(guest); guest.run("receiveNetPacket('host',packet)"); assert.deepEqual(pose(guest), accepted, 'same position ACK is not applied twice');
    correction.seq++; correction.positionAcks.guest.connection = 'retired'; correction.positionAcks.guest.seq++;
    guest.sandbox.packet = copy(correction); guest.run("receiveNetPacket('host',packet)"); assert.deepEqual(pose(guest), accepted, 'old connection ACK ignored');
    correction.seq++; correction.actors.find(a => a.id === 'blue-1').alive = false;
    guest.sandbox.packet = copy(correction); guest.run("receiveNetPacket('host',packet)"); assert.equal(guest.run('player.alive'), false);
    correction.seq++; Object.assign(correction.actors.find(a => a.id === 'blue-1'), { alive: true, x: 2, y: 0, z: 57 });
    guest.sandbox.packet = copy(correction); guest.run("receiveNetPacket('host',packet)"); assert.equal(guest.run('player.x'), 2); assert.equal(guest.run('player.y'), 0); assert.equal(guest.run('netPositionHistory.size'), 0);
    correction.seq++; correction.rules.round++; correction.rules.phase = 'buy';
    Object.assign(correction.actors.find(a => a.id === 'blue-1'), { x: 3, y: 0, z: 57 });
    guest.sandbox.packet = copy(correction); guest.run("receiveNetPacket('host',packet)"); assert.equal(guest.run('player.x'), 3); assert.equal(guest.run('player.vy'), 0); assert.equal(guest.run('netPositionHistory.size'), 0);
  });
  if (process.env.TRC_SYNC_REPORT) fs.writeFileSync(process.env.TRC_SYNC_REPORT, JSON.stringify({ scenarios: measured.length, measured }, null, 2) + '\n');
  console.log(`PASS: ${groups} TRC reconciliation groups; ${measured.length} independent host/guest profiles; ${(performance.now() - started).toFixed(1)}ms`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
