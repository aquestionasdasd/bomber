// Optional real-server check. Start the app first, then pass its local URL:
// node tests-relay-integration.cjs http://127.0.0.1:8022
// This creates a temporary room and closes it before exiting. It is not a browser UI test.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const base = new URL(process.argv[2] || process.env.ROOMS_TEST_URL || 'http://127.0.0.1:8022');
  assert.ok(['http:', 'https:'].includes(base.protocol), 'Use the HTTP(S) URL of the running app');
  const nativeFetch = globalThis.fetch;
  const rtcDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'RTCPeerConnection');
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'), saved = new Map();
  const receivedByHost = [], receivedByGuest = [], errors = [];
  const statuses = [], relayPosts = [];
  let host, guest;
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? new URL(input, base) : input;
    if (init?.method === 'POST' && String(url).includes('/messages')) {
      const packet = JSON.parse(init.body);
      if (packet.kind === 'game') relayPosts.push({ to: packet.to, type: packet.data.type, seq: packet.data.seq });
    }
    return nativeFetch(url, init);
  };
  Object.defineProperty(globalThis, 'RTCPeerConnection', { configurable: true, writable: true, value: undefined });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) } });
  const waitFor = async (condition, label, timeout = 15000) => {
    const until = Date.now() + timeout;
    while (!condition()) {
      if (Date.now() >= until) throw Error(`Timed out: ${label}${errors.length ? ` (${errors.join('; ')})` : ''}`);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  };
  try {
    const { RoomClient } = await import(pathToFileURL(path.join(__dirname, 'public/online.js')).href);
    const hostSession = await RoomClient.open('', { name: 'RELAY HOST', team: 'blue' });
    host = new RoomClient(hostSession, { onData: (from, packet) => receivedByHost.push({ from, packet }), onStatus: text => statuses.push(text), onError: message => errors.push(message) });
    const guestSession = await RoomClient.open(`/${hostSession.code}/join`, { name: 'RELAY GUEST', team: 'red' });
    guest = new RoomClient(guestSession, { onData: (from, packet) => receivedByGuest.push({ from, packet }), onStatus: text => statuses.push(text), onError: message => errors.push(message) });
    assert.equal(host.host, true); assert.equal(guest.host, false);
    await host.ready(true, 'blue'); await guest.ready(true, 'red');
    await waitFor(() => host.room.members.length === 2 && host.room.members.every(member => member.ready), 'both ready participants');
    await host.start('swift');
    await waitFor(() => guest.room.status === 'playing', 'guest sees host start');
    assert.equal(host.room.settings.format, 'swift'); assert.equal(guest.room.settings.format, 'swift');
    assert.ok(host.room.members.every(member => member.connected));
    console.log('PASS: real backend room create/join, both-team ready, host start and guest start notification');

    host.send({ type: 'snapshot', seq: 1, rules: { round: 1, phase: 'live' }, actors: [{ id: 'red-0', hp: 100 }] });
    guest.send({ type: 'input', seq: 1, round: 1, input: { x: 3, z: 4 }, actions: [{ seq: 1, type: 'ability', key: 'e' }] });
    await waitFor(() => receivedByGuest.some(item => item.packet.seq === 1) && receivedByHost.some(item => item.packet.seq === 1), 'bidirectional relay packets');
    const snapshot = receivedByGuest.find(item => item.packet.seq === 1), input = receivedByHost.find(item => item.packet.seq === 1);
    assert.equal(snapshot.from, hostSession.memberId); assert.equal(input.from, guestSession.memberId);
    assert.equal(snapshot.packet.rules.phase, 'live'); assert.equal(snapshot.packet.actors[0].hp, 100);
    assert.deepEqual(input.packet.input, { x: 3, z: 4 }); assert.equal(input.packet.actions[0].key, 'e');
    assert.equal(snapshot.packet.room, hostSession.code); assert.equal(input.packet.room, hostSession.code);
    assert.equal(host.peers.size, 0); assert.equal(guest.peers.size, 0);
    assert.ok(statuses.some(text => text.includes('リレー')));
    assert.ok(relayPosts.some(post => post.to === 'all' && post.type === 'snapshot'));
    assert.ok(relayPosts.some(post => post.to === 'host' && post.type === 'input'));
    console.log('PASS: RTC unavailable, real HTTP relay delivers host snapshot and guest input/action to the correct peer');

    host.send({ type: 'snapshot', seq: 2, marker: 'superseded' });
    host.send({ type: 'snapshot', seq: 3, marker: 'latest' });
    await waitFor(() => receivedByGuest.some(item => item.packet.seq === 3), 'latest queued state after relay throttle');
    assert.equal(receivedByGuest.find(item => item.packet.seq === 3).packet.marker, 'latest');
    assert.equal(errors.length, 0, 'The relay must not emit API errors');
    console.log('PASS: throttled relay eventually flushes its latest queued state');

    const oldConnection = guest.connectionId;
    guest.close(false);
    const resumed = await RoomClient.resumeSession();
    assert.equal(resumed.status, 'guest'); assert.equal(resumed.session.memberId, guestSession.memberId);
    assert.ok(resumed.session.resumeCursor > 0);
    guest = new RoomClient(resumed.session, { onData: (from, packet) => receivedByGuest.push({ from, packet }), onError: message => errors.push(message) });
    assert.notEqual(guest.connectionId, oldConnection);
    host.send({ type: 'snapshot', seq: 4, marker: 'after-resume' });
    guest.send({ type: 'input', seq: 1, round: 1, marker: 'after-resume', input: { x: 4, z: 5 }, actions: [] });
    await waitFor(() => receivedByGuest.some(item => item.packet.marker === 'after-resume') && receivedByHost.some(item => item.packet.marker === 'after-resume'), 'bidirectional relay after same-member guest reload');
    assert.equal((await host.api('')).members.length, 2, 'Reload must not add another member');
    assert.equal(errors.length, 0);
    console.log('PASS: same-member guest reload revalidates credentials and resumes both relay directions with a fresh connection');

    await host.api('/leave', {}); host.close(false);
    await waitFor(() => guest.closed && guest.room.status === 'closed', 'host leave closes guest room');
    assert.equal((await guest.api('')).status, 'closed');
    console.log('PASS: host leave closes the room and stops the guest client polling');
    console.log('Real-server HTTP relay integration passed (Node API integration; no browser UI automation).');
  } finally {
    if (host && !host.closed) { try { await host.api('/leave', {}); } catch {} host.close(false); }
    guest?.close(false);
    globalThis.fetch = nativeFetch;
    if (rtcDescriptor) Object.defineProperty(globalThis, 'RTCPeerConnection', rtcDescriptor);
    else delete globalThis.RTCPeerConnection;
    if (storageDescriptor) Object.defineProperty(globalThis, 'sessionStorage', storageDescriptor);
    else delete globalThis.sessionStorage;
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
