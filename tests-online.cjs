const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');
const vm = require('node:vm');

async function main() {
  const { handleRooms } = await import(pathToFileURL(path.join(__dirname, 'server/rooms.js')).href);
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const migrations = fs.readdirSync(path.join(__dirname, 'drizzle')).filter(f => f.endsWith('.sql')).sort();
  assert.ok(migrations.length, 'Generate the checked-in D1 migrations before running online tests');
  for (const file of migrations) db.exec(fs.readFileSync(path.join(__dirname, 'drizzle', file), 'utf8'));
  const prepared = (sql, values = []) => ({
    bind(...next) { return prepared(sql, next); },
    first: async () => db.prepare(sql).get(...values) || null,
    all: async () => ({ results: db.prepare(sql).all(...values) }),
    run: async () => {
      const value = db.prepare(sql).run(...values);
      return { meta: { changes: Number(value.changes), last_row_id: Number(value.lastInsertRowid) } };
    },
    _run() {
      const value = db.prepare(sql).run(...values);
      return { meta: { changes: Number(value.changes), last_row_id: Number(value.lastInsertRowid) } };
    },
  });
  const env = { DB: {
    prepare: sql => prepared(sql),
    async batch(statements) {
      db.exec('BEGIN');
      try { const results = statements.map(s => s._run()); db.exec('COMMIT'); return results; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  } };
  let clock = 1_900_000_000_000, passed = 0;
  const realNow = Date.now;
  Date.now = () => clock;
  async function api(route, { method = 'GET', member, body, headers = {}, raw } = {}) {
    const requestHeaders = { ...headers };
    if (member) { requestHeaders.Authorization = `Bearer ${member.token}`; requestHeaders['X-Member-Id'] = member.memberId; }
    if (body !== undefined || raw !== undefined) requestHeaders['Content-Type'] ??= 'application/json';
    const response = await handleRooms(new Request(`https://hashimoto.test/api/rooms${route}`, {
      method, headers: requestHeaders, ...(body !== undefined ? { body: JSON.stringify(body) } : raw !== undefined ? { body: raw } : {}),
    }), env);
    const value = await response.json();
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, value };
  }
  async function create(name = 'HOST') {
    const result = await api('', { method: 'POST', body: { name, team: 'blue' } });
    assert.equal(result.status, 201, JSON.stringify(result.value));
    return result.value;
  }
  async function join(host, team = 'red', name = 'FRIEND') {
    const result = await api(`/${host.code}/join`, { method: 'POST', body: { name, team } });
    assert.equal(result.status, 201, JSON.stringify(result.value));
    return result.value;
  }
  async function ready(member, team) {
    const result = await api(`/${member.code}/ready`, { method: 'POST', member, body: { ready: true, epoch:JSON.parse(db.prepare('SELECT settings FROM online_rooms WHERE code=?').get(member.code).settings).matchEpoch||0, ...(team ? { team } : {}) } });
    assert.equal(result.status, 200, JSON.stringify(result.value));
    return result.value;
  }
  async function start(host, guest) {
    await ready(host); await ready(guest);
    const result = await api(`/${host.code}/start`, { method: 'POST', member: host, body: { format: 'swift', epoch:JSON.parse(db.prepare('SELECT settings FROM online_rooms WHERE code=?').get(host.code).settings).matchEpoch||0 } });
    assert.equal(result.status, 200, JSON.stringify(result.value)); return result.value;
  }
  async function send(member, to, kind, data) {
    return api(`/${member.code}/messages`, { method: 'POST', member, body: { to, kind, data } });
  }
  async function getMessages(member, after = 0) {
    return api(`/${member.code}/messages?after=${after}`, { member });
  }
  async function test(name, fn) { await fn(); passed++; console.log(`PASS: ${name}`); }

  try {
    await test('TRC can be selected, joined and started as an authoritative ten-seat room',async()=>{
      const created=await api('',{method:'POST',body:{name:'TRC HOST',mapId:'trc',format:'swift'}});
      assert.equal(created.status,201);const host=created.value,guest=await join(host);
      assert.equal(guest.settings.mapId,'trc');assert.equal(guest.settings.maxPlayers,10);
      const playing=await start(host,guest);assert.equal(playing.settings.mapId,'trc');assert.equal(playing.status,'playing');
    });
    await test('lobby map and format are host-owned, persisted before start, and visible to joins/polls/resume',async()=>{
      const created=await api('',{method:'POST',body:{name:'MAP HOST',mapId:'hirakata',format:'standard'}});
      assert.equal(created.status,201);const host=created.value,guest=await join(host);
      assert.equal(guest.settings.mapId,'hirakata');assert.equal(guest.settings.format,'standard');
      const change=(member,body)=>api(`/${host.code}/settings`,{method:'POST',member,body});
      assert.equal((await change(guest,{mapId:'hashimoto',format:'swift'})).status,403);
      assert.equal((await change(null,{mapId:'hashimoto',format:'swift'})).status,401);
      for(const body of [{mapId:'bad',format:'swift'},{mapId:'hashimoto',format:'explore'},{mapId:'hashimoto'},{mapId:null,format:null}])assert.equal((await change(host,body)).status,400);
      assert.equal((await getMessages(guest)).value.room.settings.mapId,'hirakata');
      const saved=await change(host,{mapId:'hashimoto',format:'swift',maxPlayers:999,lobbyRevision:999});
      assert.equal(saved.status,200);assert.equal(saved.value.settings.maxPlayers,10);assert.equal(saved.value.settings.lobbyRevision,1);
      assert.deepEqual((await getMessages(guest)).value.room.settings,saved.value.settings);
      assert.deepEqual((await api(`/${host.code}?resume=1`,{member:guest})).value.settings,saved.value.settings);
      await ready(host);await ready(guest);
      const started=await api(`/${host.code}/start`,{method:'POST',member:host,body:{format:'swift'}});assert.equal(started.status,200);assert.equal(started.value.settings.mapId,'hashimoto');
      assert.equal((await change(host,{mapId:'hirakata',format:'standard'})).status,409);
      assert.equal((await api(`/${host.code}`,{member:guest})).value.settings.mapId,'hashimoto');
      await api(`/${host.code}/leave`,{method:'POST',member:host,body:{}});
      assert.equal((await change(host,{mapId:'hirakata',format:'standard'})).status,401);
      assert.equal((await change(guest,{mapId:'hirakata',format:'standard'})).status,410);
    });
    await test('invalid create choices never allocate rooms and legacy lobby revision upgrades without migration',async()=>{
      const count=()=>db.prepare('SELECT COUNT(*) AS n FROM online_rooms').get().n,before=count();
      for(const body of [{name:'HOST',mapId:'invalid'},{name:'HOST',format:'explore'}])assert.equal((await api('',{method:'POST',body})).status,400);
      assert.equal(count(),before);
      const host=await create();db.prepare('UPDATE online_rooms SET settings=? WHERE code=?').run(JSON.stringify({format:'swift',mapId:'hashimoto',maxPlayers:10}),host.code);
      const saved=await api(`/${host.code}/settings`,{method:'POST',member:host,body:{format:'standard',mapId:'hirakata'}});
      assert.equal(saved.status,200);assert.equal(saved.value.settings.lobbyRevision,1);assert.equal(saved.value.settings.mapId,'hirakata');
      const guest=await join(host);await ready(host);await ready(guest);
      const results=await Promise.all([
        api(`/${host.code}/start`,{method:'POST',member:host,body:{format:'standard',mapId:'hirakata'}}),
        api(`/${host.code}/settings`,{method:'POST',member:host,body:{format:'swift',mapId:'hashimoto'}}),
      ]);
      assert.equal(results[0].status,200);assert.ok([200,409].includes(results[1].status));
      const final=(await api(`/${host.code}`,{member:guest})).value;
      assert.equal(final.status,'playing');assert.equal(final.settings.mapId,'hirakata');assert.equal(final.settings.format,'standard');
    });
    await test('real RoomClient blocks stale lobby polls, pending starts, failed saves, and callbacks after leave',async()=>{
      const {RoomClient}=await import(pathToFileURL(path.join(__dirname,'public/online.js')).href);
      const updates=[],room={code:'MAPTEST2',status:'lobby',settings:{mapId:'hashimoto',format:'swift',lobbyRevision:0}};
      let resolve,reject,requests=0;
      const client=Object.assign(Object.create(RoomClient.prototype),{room,host:true,closed:false,settingsPending:false,onRoom:r=>updates.push(r),api:()=>{requests++;return new Promise((yes,no)=>{resolve=yes;reject=no;});}});
      const pending=client.configure('standard','hirakata');assert.equal(client.settingsPending,true);
      await assert.rejects(client.start('swift','hashimoto'),/保存/);await assert.rejects(client.configure('swift','hashimoto'),/保存/);assert.equal(requests,1);
      resolve({...room,settings:{mapId:'hirakata',format:'standard',lobbyRevision:1}});await pending;
      assert.equal(client.settingsPending,false);client.acceptRoom(room);assert.equal(client.room.settings.mapId,'hirakata');
      const failed=client.configure('swift','hashimoto');reject(Error('offline'));await assert.rejects(failed,/offline/);
      assert.equal(client.settingsPending,false);assert.equal(client.room.settings.mapId,'hirakata');
      client.acceptRoom({...client.room,status:'playing'});client.acceptRoom({...room,settings:{lobbyRevision:99}});assert.equal(client.room.status,'playing');
      client.room=room;const abandoned=client.configure('standard','hirakata'),before=updates.length;client.closed=true;
      resolve({...room,settings:{mapId:'hirakata',lobbyRevision:1}});await abandoned;assert.equal(updates.length,before);assert.equal(client.room.settings.mapId,'hashimoto');
      client.closed=false;client.host=false;await assert.rejects(client.configure('standard','hirakata'),/ホスト/);
    });
    await test('host chooses map at start; invalid/guest maps never mutate room, reconnect retains map',async()=>{
      const host=await create(),guest=await join(host);await ready(host);await ready(guest);
      assert.equal((await api(`/${host.code}/start`,{method:'POST',member:guest,body:{format:'swift',mapId:'hirakata'}})).status,403);
      assert.equal((await api(`/${host.code}/start`,{method:'POST',member:host,body:{format:'swift',mapId:'invalid'}})).status,400);
      assert.equal((await api(`/${host.code}`,{member:host})).value.status,'lobby');
      const started=await api(`/${host.code}/start`,{method:'POST',member:host,body:{format:'swift',mapId:'hirakata'}});assert.equal(started.status,200);assert.equal(started.value.settings.mapId,'hirakata');assert.equal((await api(`/${host.code}`,{member:guest})).value.settings.mapId,'hirakata');
    });
    await test('same ten-player party rematches without replacing credentials, teams, code or settings',async()=>{
      const host=await create('PARTY HOST'),members=[host];for(let i=0;i<9;i++)members.push(await join(host,i<4?'blue':'red','FRIEND '+i));
      for(const m of members)await ready(m);
      const before=(await api(`/${host.code}`,{member:host})).value;
      const hashes=db.prepare('SELECT id,token_hash,team,name FROM online_members WHERE room_code=? ORDER BY id').all(host.code);
      assert.equal((await api(`/${host.code}/start`,{method:'POST',member:host,body:{format:'standard',mapId:'trc'}})).status,200);
      const again=(member,epoch)=>api(`/${host.code}/rematch`,{method:'POST',member,body:{epoch}});
      assert.equal((await again(members[1],0)).status,403);assert.equal((await again({...host,token:'0'.repeat(64)},0)).status,401);
      assert.equal((await again(host,-1)).status,400);assert.equal((await again(host,1)).status,409);
      const [a,b]=await Promise.all([again(host,0),again(host,0)]);assert.equal(a.status,200);assert.equal(b.status,200);
      const lobby=a.value;assert.equal(lobby.status,'lobby');assert.equal(lobby.code,before.code);assert.equal(lobby.hostId,before.hostId);assert.equal(lobby.settings.matchEpoch,1);assert.equal(lobby.settings.mapId,'trc');assert.equal(lobby.settings.format,'standard');
      assert.equal(lobby.members.length,10);assert.equal(lobby.members.filter(m=>m.ready).length,1);assert.equal(lobby.members.find(m=>m.id===host.memberId).ready,true);
      assert.deepEqual(db.prepare('SELECT id,token_hash,team,name FROM online_members WHERE room_code=? ORDER BY id').all(host.code),hashes);
      await ready(members[1]);assert.equal((await again(host,0)).value.members.find(m=>m.id===members[1].memberId).ready,true,'Duplicate rematch must not cancel newly readied member');
      assert.equal((await api(`/${host.code}/start`,{method:'POST',member:host,body:{format:'swift',epoch:1}})).status,409);
      assert.equal((await api(`/${host.code}/ready`,{method:'POST',member:members[1],body:{ready:false,epoch:0}})).status,409);
      assert.equal((await api(`/${host.code}/settings`,{method:'POST',member:host,body:{format:'swift',mapId:'hashimoto',epoch:0}})).status,409);
      for(const m of members)await ready(m);
      const next=await api(`/${host.code}/start`,{method:'POST',member:host,body:{format:'swift',mapId:'hirakata',epoch:1}});assert.equal(next.status,200);assert.equal(next.value.settings.matchEpoch,1);
      assert.equal((await again(host,0)).status,409,'Late previous-match request cannot end the next match');
      assert.equal((await again(host,1)).status,200);assert.equal((await api(`/${host.code}`,{member:members[9]})).value.settings.matchEpoch,2);
      assert.equal((await api(`/${host.code}/leave`,{method:'POST',member:host,body:{}})).status,200);assert.equal((await again(host,2)).status,401);
    });
    await test('match epochs isolate old HTTP and direct packets, stale room responses and pending relay retries',async()=>{
      const host=await create(),guest=await join(host);await start(host,guest);
      assert.equal((await send(host,'team:red','game',{type:'snapshot',seq:99})).status,201);
      const reset=await api(`/${host.code}/rematch`,{method:'POST',member:host,body:{epoch:0}});assert.equal(reset.status,200);
      assert.equal((await getMessages(guest)).value.messages.length,0,'Old packets must not reappear in lobby');
      await start(host,guest);
      assert.equal((await send(host,'team:red','game',{type:'snapshot',seq:999})).status,409);
      assert.equal((await send(guest,'host','game',{type:'input',epoch:0,seq:999})).status,409);
      assert.equal((await send(host,'team:red','game',{type:'snapshot',epoch:1,seq:1})).status,201);
      const packets=(await getMessages(guest)).value.messages;assert.equal(packets.length,1);assert.equal(packets[0].data.seq,1);
      const {RoomClient}=await import(pathToFileURL(path.join(__dirname,'public/online.js')).href);
      const seen=[],updates=[],old={...reset.value,status:'playing',settings:{...reset.value.settings,matchEpoch:0}},client=Object.assign(Object.create(RoomClient.prototype),{room:old,session:host,closed:false,pendingTeamStates:new Map(),onRoom:r=>updates.push(r),onData:(from,data)=>seen.push(data)});
      client.ensureRelay();const state={slot:'red',packet:{type:'snapshot'},identity:client.relayIdentity,pauseEpoch:0};client.relayLatest.set('red',state);client.pendingTeamStates.set('red',state.packet);
      client.acceptRoom(reset.value);assert.equal(client.room.status,'lobby');assert.equal(client.relayCurrent(state),false);assert.equal(client.pendingTeamStates.size,0);
      client.acceptRoom(old);assert.equal(client.room.status,'lobby','Late old playing response cannot restart completed world');
      const next={...reset.value,status:'playing'};client.acceptRoom(next);client.acceptRoom(reset.value);assert.equal(client.room.status,'playing','Late same-epoch lobby response cannot end next match');
      const direct=[];client.host=true;client.peers=new Map([[guest.memberId,{channel:{readyState:'open',bufferedAmount:0,send:s=>direct.push(JSON.parse(s))}}]]);client.scheduleRelay=()=>{};client.send({type:'snapshot',seq:1},{team:'red'});assert.equal(direct[0].epoch,1);
      client.receive(host.memberId,{room:host.code,epoch:0,seq:999});client.receive(host.memberId,{room:host.code,epoch:1,seq:1});assert.equal(seen.length,1);assert.equal(seen[0].seq,1);
      client.closed=true;client.receive(host.memberId,{room:host.code,epoch:1,seq:2});assert.equal(seen.length,1);
    });
    await test('failed rematch transaction retains the party, and lobby host reload resumes without disbanding',async()=>{
      const host=await create(),guest=await join(host);await start(host,guest);
      const original=env.DB.batch;env.DB.batch=async()=>{throw Error('storage offline');};
      const log=console.error;console.error=()=>{};let failure;try{failure=await api(`/${host.code}/rematch`,{method:'POST',member:host,body:{epoch:0}});}finally{env.DB.batch=original;console.error=log;}
      assert.equal(failure.status,503);assert.equal((await api(`/${host.code}`,{member:guest})).value.status,'playing');
      assert.equal((await api(`/${host.code}/rematch`,{method:'POST',member:host,body:{epoch:0}})).status,200);
      const {RoomClient}=await import(pathToFileURL(path.join(__dirname,'public/online.js')).href),oldFetch=global.fetch,oldStorage=global.sessionStorage,values=new Map();
      global.sessionStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
      global.fetch=(url,opts)=>handleRooms(new Request('https://hashimoto.test'+url,opts),env);
      try{RoomClient.saveSession(host);const restored=await RoomClient.resumeSession();assert.equal(restored.session.memberId,host.memberId);assert.equal(restored.session.status,'lobby');assert.equal(restored.session.settings.matchEpoch,1);assert.equal((await api(`/${host.code}`,{member:guest})).value.status,'lobby');}
      finally{global.fetch=oldFetch;global.sessionStorage=oldStorage;}
    });
    await test('room creation issues private hashed credentials and protects every member read', async () => {
      const host = await create('  ホスト  ');
      assert.match(host.code, /^[A-HJ-NP-Z2-9]{8}$/);
      assert.match(host.token, /^[a-f0-9]{64}$/); assert.equal(host.hostId, host.memberId);
      assert.equal(host.members[0].name, 'ホスト'); assert.equal(host.members[0].team, 'blue');
      assert.equal(host.members[0].connected, true); assert.equal(host.status, 'lobby');
      const stored = db.prepare('SELECT token_hash FROM online_members WHERE id = ?').get(host.memberId);
      assert.match(stored.token_hash, /^[a-f0-9]{64}$/); assert.notEqual(stored.token_hash, host.token);
      assert.equal((await api(`/${host.code}`)).status, 401);
      assert.equal((await api(`/${host.code}`, { member: { ...host, token: '0'.repeat(64) } })).status, 401);
      const read = await api(`/${host.code}`, { member: host });
      assert.equal(read.status, 200); assert.ok(!JSON.stringify(read.value).includes(host.token));
      assert.equal((await api(`/${host.code}`, { member: host, headers: { Origin: 'https://other.test' } })).status, 403);
      assert.equal((await api('/AAAAAAAA', { member: host })).status, 404);
    });

    await test('lobby requires both teams, every ready member, and host-only atomic start', async () => {
      const host = await create();
      assert.equal((await api(`/${host.code}/start`, { method: 'POST', member: host, body: { format: 'swift' } })).status, 409);
      const guest = await join(host);
      assert.equal((await send(guest, 'host', 'game', { type: 'input' })).status, 409);
      assert.equal((await api(`/${host.code}/start`, { method: 'POST', member: guest, body: { format: 'swift' } })).status, 403);
      await ready(host);
      assert.equal((await api(`/${host.code}/ready`, { method: 'POST', member: host, body: { ready: true, team: 'red' } })).status, 403);
      assert.equal((await api(`/${host.code}/start`, { method: 'POST', member: host, body: { format: 'swift' } })).status, 409);
      await ready(guest, 'blue');
      assert.equal((await api(`/${host.code}/start`, { method: 'POST', member: host, body: { format: 'swift' } })).status, 409);
      await ready(guest, 'red');
      const starts = await Promise.all([1, 2].map(() => api(`/${host.code}/start`, { method: 'POST', member: host, body: { format: 'standard' } })));
      assert.deepEqual(starts.map(r => r.status).sort(), [200, 409]);
      assert.equal(starts.find(r => r.status === 200).value.settings.format, 'standard');
      assert.equal((await api(`/${host.code}/join`, { method: 'POST', body: { name: 'LATE', team: 'red' } })).status, 409);
      assert.equal((await api(`/${host.code}/ready`, { method: 'POST', member: guest, body: { ready: true, team: 'blue' } })).status, 409);
    });

    await test('WebRTC signalling is private to the addressed current room member', async () => {
      const host = await create(), guest = await join(host), observer = await join(host, 'blue', 'OBSERVER'), foreign = await create('OTHER');
      assert.equal((await send(guest, host.memberId, 'signal', { type: 'offer', sdp: 'example' })).status, 201);
      assert.equal((await getMessages(observer)).value.messages.length, 0);
      assert.equal((await getMessages(guest)).value.messages.length, 0);
      const received = await getMessages(host);
      assert.equal(received.value.messages.length, 1); assert.equal(received.value.messages[0].from, guest.memberId);
      assert.deepEqual(received.value.messages[0].data, { type: 'offer', sdp: 'example' });
      assert.equal((await getMessages(host, received.value.cursor)).value.messages.length, 0);
      assert.equal((await send(host, foreign.memberId, 'signal', { sdp: 'private' })).status, 404);
      assert.equal((await send(guest, 'all', 'signal', { sdp: 'private' })).status, 400);
      assert.equal((await api(`/${foreign.code}`, { member: guest })).status, 401);
    });

    await test('HTTP fallback relays guest controls only to the host and host state to peers', async () => {
      const host = await create(), guest = await join(host), peer = await join(host, 'red', 'PEER');
      await ready(peer); await start(host, guest);
      assert.equal((await send(guest, 'all', 'game', { type: 'state', hp: 999 })).status, 403);
      assert.equal((await send(guest, peer.memberId, 'game', { type: 'shot' })).status, 403);
      assert.equal((await send(guest, 'host', 'game', { session: 'r1', seq: 1, type: 'input', fire: true })).status, 201);
      const ridePacket={type:'input',seq:2,round:1,input:{x:2,y:1.86,z:.31,ride:['player',.2,0]},actions:[]};assert.equal((await send(guest,'host','game',ridePacket)).status,201);
      assert.ok((await getMessages(host)).value.messages.some(m=>JSON.stringify(m.data)===JSON.stringify(ridePacket)),'relative grass support input survives SQLite HTTP relay');
      const hostInbox = await getMessages(host);
      assert.equal(hostInbox.value.messages.length, 2); assert.equal(hostInbox.value.messages[0].data.seq, 1);
      assert.equal((await getMessages(peer)).value.messages.length, 0);
      assert.equal((await send(host, 'all', 'game', { session: 'r1', seq: 7, type: 'state', score: [1, 0] })).status, 201);
      const state = await getMessages(guest);
      assert.equal(state.value.messages.length, 1); assert.equal(state.value.messages[0].from, host.memberId);
      assert.deepEqual(state.value.messages[0].data.score, [1, 0]);
      assert.equal((await getMessages(guest, state.value.cursor)).value.messages.length, 0);
      assert.equal((await send(host, host.memberId, 'game', { type: 'state' })).status, 400);
    });

    await test('five-knife burst remains one bounded guest action through authenticated HTTP and direct channel', async () => {
      const host=await create(),guest=await join(host),peer=await join(host,'red','PEER');await ready(peer);await start(host,guest);
      const payload={type:'input',seq:1,round:1,input:{x:0,y:0,z:0,yaw:0,pitch:0},actions:[{type:'fire',seq:1,round:1,at:10,yaw:0,pitch:0,ultimate:true,burst:true}]};
      assert.equal((await send(guest,'host','game',payload)).status,201);const inbox=(await getMessages(host)).value;assert.equal(inbox.messages.length,1);assert.deepEqual(inbox.messages[0].data,payload);assert.equal((await getMessages(peer)).value.messages.length,0);
      const {RoomClient}=await import(pathToFileURL(path.join(__dirname,'public/online.js')).href),delivered=[];
      const client=Object.assign(Object.create(RoomClient.prototype),{host:false,closed:false,room:{status:'playing'},session:{code:host.code,memberId:guest.memberId,hostId:host.memberId},connectionId:'blade-test',peers:new Map([[host.memberId,{channel:{readyState:'open',bufferedAmount:0,send:value=>delivered.push(JSON.parse(value))}}]]),pendingState:null,pendingTeamStates:new Map(),lastRelay:clock,relayBusy:false});
      client.send(payload);assert.equal(delivered.length,1);assert.equal(delivered[0].actions.length,1);assert.deepEqual(delivered[0].actions,payload.actions);assert.equal(delivered[0].room,host.code);assert.equal(delivered[0].connection,'blade-test');
    });

    await test('Renko Q stop remains one bounded guest action through authenticated HTTP and direct channel', async () => {
      const host=await create(),guest=await join(host),peer=await join(host,'red','PEER');await ready(peer);await start(host,guest);
      const payload={type:'input',seq:1,round:1,input:{x:0,y:0,z:0,yaw:0,pitch:0},actions:[{type:'ability',seq:1,round:1,at:10,key:'q',renkoStop:true}]};
      assert.equal((await send(guest,'host','game',payload)).status,201);const inbox=(await getMessages(host)).value;assert.equal(inbox.messages.length,1);assert.deepEqual(inbox.messages[0].data,payload);assert.equal((await getMessages(peer)).value.messages.length,0);
      const {RoomClient}=await import(pathToFileURL(path.join(__dirname,'public/online.js')).href),delivered=[];
      const client=Object.assign(Object.create(RoomClient.prototype),{host:false,closed:false,room:{status:'playing'},session:{code:host.code,memberId:guest.memberId,hostId:host.memberId},connectionId:'renko-stop-test',peers:new Map([[host.memberId,{channel:{readyState:'open',bufferedAmount:0,send:value=>delivered.push(JSON.parse(value))}}]]),pendingState:null,pendingTeamStates:new Map(),lastRelay:clock,relayBusy:false});
      client.send(payload);assert.equal(delivered.length,1);assert.equal(delivered[0].actions.length,1);assert.deepEqual(delivered[0].actions,payload.actions);assert.equal(delivered[0].room,host.code);assert.equal(delivered[0].connection,'renko-stop-test');
    });

    await test('team snapshots remain private to authenticated membership and preserve relay limits', async () => {
      const host = await create(), red = await join(host), blue = await join(host, 'blue', 'ALLY');
      await ready(blue); await start(host, red);
      const blueState = { type: 'snapshot', seq: 1, ordinarySkills: { markers: [{ team: 'blue', x: 12, z: 4 }] } };
      const redState = { type: 'snapshot', seq: 1, ordinarySkills: { markers: [{ team: 'red', x: -12, z: -4 }] } };
      assert.equal((await send(host, 'team:blue', 'game', blueState)).status, 201);
      assert.equal((await send(host, 'team:red', 'game', redState)).status, 201);
      const blueInbox = (await getMessages(blue)).value, redInbox = (await getMessages(red)).value;
      assert.deepEqual(blueInbox.messages.map(m => m.data), [blueState]);
      assert.deepEqual(redInbox.messages.map(m => m.data), [redState]);
      assert.equal(blueInbox.cursor, redInbox.cursor, 'Skipped enemy-team rows must still advance the bounded cursor');
      assert.deepEqual((await getMessages(host)).value.messages, []);
      for (const team of ['team:blue', 'team:red', 'team:unknown']) assert.equal((await send(red, team, 'game', redState)).status, 403);
      assert.equal((await send(host, 'team:unknown', 'game', blueState)).status, 400);
      assert.equal((await send(host, 'team:blue', 'signal', blueState)).status, 400);
      assert.equal((await send(host, 'team:red', 'game', { type: 'input' })).status, 400);
      const max = { type: 'snapshot', pad: '' }; max.pad = 'x'.repeat(65536 - Buffer.byteLength(JSON.stringify(max)));
      assert.equal((await send(host, 'team:red', 'game', max)).status, 201);
      assert.equal((await send(host, 'team:red', 'game', { ...max, pad: max.pad + 'x' })).status, 413);
      clock += 1001;
      const burst = await Promise.all(Array.from({ length: 13 }, (_, i) => send(host, i % 2 ? 'team:blue' : 'team:red', 'game', { type: 'snapshot', seq: i })));
      assert.equal(burst.filter(r => r.status === 201).length, 12); assert.equal(burst.filter(r => r.status === 429).length, 1, 'Two team streams share the existing twelve-message host budget independently of concurrent completion order');
      assert.equal((await api(`/${host.code}/ready`, { method: 'POST', member: red, body: { ready: true, team: 'blue' } })).status, 409, 'A live guest cannot change the team used by delivery filtering');
    });

    await test('direct team delivery and bounded relay coalescing keep peer failures private', async () => {
      const { RoomClient } = await import(pathToFileURL(path.join(__dirname, 'public/online.js')).href);
      const direct = { blue: [], red: [] }, relayed = [], errors = [], pending = [];
      const channel = team => ({ readyState: 'open', bufferedAmount: 0, send: value => direct[team].push(JSON.parse(value)) });
      const client = Object.assign(Object.create(RoomClient.prototype), {
        host: true, closed: false, room: { status: 'playing', members: [{ id: 'host', team: 'blue', connected: true }, { id: 'ally', team: 'blue', connected: true }, { id: 'enemy', team: 'red', connected: true }] },
        session: { code: 'TEAMTEST', memberId: 'host', hostId: 'host' }, connectionId: 'test-connection',
        peers: new Map([['ally', { channel: channel('blue'), pc: { close() {} } }], ['enemy', { channel: channel('red'), pc: { close() {} } }]]),
        pendingState: null, pendingTeamStates: new Map(), lastRelay: clock, relayBusy: false, pollTimer: null,
        onError: message => errors.push(message), api: async (_action, message) => { relayed.push(message); },
      });
      client.send({ type: 'snapshot', seq: 1, secret: 'BLUE' }, { team: 'blue' });
      client.send({ type: 'snapshot', seq: 1, secret: 'RED' }, { team: 'red' });
      assert.deepEqual(direct.blue.map(p => p.secret), ['BLUE']); assert.deepEqual(direct.red.map(p => p.secret), ['RED']);
      assert.equal(client.pendingTeamStates.size, 0); assert.equal(relayed.length, 0);
      client.send({ type: 'snapshot' }, { team: 'unknown' }); client.send({ type: 'input' }, { team: 'red' });
      client.host = false; client.send({ type: 'snapshot' }, { team: 'blue' }); client.host = true;
      assert.equal(direct.blue.length + direct.red.length, 2, 'Unsupported group and guest group sends must fail before any channel writes');
      // A congested/throwing channel uses only its own team relay. Repeated
      // snapshots overwrite one bounded slot per team, never become broadcast.
      client.peers.get('ally').channel.bufferedAmount = 128000;
      client.peers.get('enemy').channel.send = () => { throw Error('closed peer'); };
      for (let seq = 2; seq < 102; seq++) for (const team of ['blue', 'red']) client.send({ type: 'snapshot', seq, secret: team }, { team });
      assert.equal(client.pendingTeamStates.size, 2); assert.equal(client.pendingState, null);
      let concurrent = 0, peak = 0;
      client.api = async (_action, message) => { relayed.push(message); peak = Math.max(peak, ++concurrent); await new Promise(resolve => pending.push(resolve)); concurrent--; };
      clock += 200; const batch = client.flushRelay();
      assert.equal(relayed.length, 2); assert.equal(peak, 2); assert.ok(client.relayBusy);
      assert.deepEqual(relayed.map(m => [m.to, m.data.seq]), [['team:blue', 101], ['team:red', 101]]);
      for (const team of ['blue', 'red']) client.send({ type: 'snapshot', seq: 102 }, { team });
      await client.flushRelay(); assert.equal(relayed.length, 2, 'An in-flight batch must not create extra requests');
      pending.splice(0).forEach(resolve => resolve()); await batch;
      await client.flushRelay(); assert.equal(relayed.length, 2, 'A completed batch must still obey the shared two-per-200ms gate');
      client.api = async (_action, message) => { relayed.push(message); if (message.to === 'team:blue') throw Error('relay unavailable'); };
      clock += 200; await client.flushRelay(); assert.equal(relayed.length, 4); assert.deepEqual(errors, ['relay unavailable']);
      assert.ok(relayed.every(m => m.to === 'team:blue' || m.to === 'team:red'));
      // Default guest input and host broadcast keep their original routes.
      client.host = false; client.peers.clear(); client.send({ type: 'input', seq: 7 }); clock += 200; await client.flushRelay();
      assert.equal(relayed.at(-1).to, 'host');
      client.host = true; client.send({ type: 'snapshot', seq: 103 }); clock += 200; await client.flushRelay();
      assert.equal(relayed.at(-1).to, 'all');
      client.send({ type: 'snapshot' }, { team: 'blue' }); client.send({ type: 'snapshot' }, { team: 'red' }); client.send({ type: 'snapshot' });
      client.close(false); assert.equal(client.pendingTeamStates.size, 0); assert.equal(client.pendingState, null);
      clock += 1000; await client.flushRelay(); assert.equal(relayed.length, 6, 'Closed clients must never flush stale private snapshots');
    });

    await test('large host snapshots relay intact with bounded envelopes and unchanged guest/signalling limits', async () => {
      const host = await create(), guest = await join(host); await start(host, guest);
      const sized = (bytes, type = 'snapshot') => {
        const data = { type, seq: 17, label: '橋本駅', pad: '' };
        data.pad = 'x'.repeat(bytes - Buffer.byteLength(JSON.stringify(data), 'utf8'));
        assert.equal(Buffer.byteLength(JSON.stringify(data), 'utf8'), bytes);
        return data;
      };
      const busySnapshot = sized(27 * 1024);
      assert.equal((await send(host, 'all', 'game', busySnapshot)).status, 201, 'A legal27KiB ten-player state must not freeze the HTTP fallback');
      const received = await getMessages(guest);
      assert.equal(received.value.messages.length, 1); assert.deepEqual(received.value.messages[0].data, busySnapshot);
      const maximumSnapshot = sized(64 * 1024);
      assert.ok(Buffer.byteLength(JSON.stringify({ to: 'all', kind: 'game', data: maximumSnapshot }), 'utf8') < 72 * 1024, 'The complete envelope must fit the bounded streamed-body cap');
      assert.equal((await send(host, 'all', 'game', maximumSnapshot)).status, 201);
      assert.equal((await send(host, 'all', 'game', sized(64 * 1024 + 1))).status, 413, 'Host snapshots still have a hard byte limit');
      assert.equal((await send(host, 'all', 'game', sized(27 * 1024, 'state'))).status, 413, 'Only authoritative snapshots receive the larger allowance');
      assert.equal((await send(guest, 'host', 'game', busySnapshot)).status, 413, 'A guest cannot use the host snapshot allowance');
      assert.equal((await send(guest, 'host', 'game', sized(24 * 1024, 'input'))).status, 201);
      assert.equal((await send(guest, 'host', 'game', sized(24 * 1024 + 1, 'input'))).status, 413);
      assert.equal((await send(host, guest.memberId, 'signal', sized(32 * 1024, 'signal'))).status, 201);
      assert.equal((await send(host, guest.memberId, 'signal', sized(32 * 1024 + 1, 'signal'))).status, 413);
      assert.equal((await send(guest, 'host', 'signal', sized(32 * 1024 + 1, 'signal'))).status, 413);
    });

    await test('real snapshot serialization relays every bounded effects/gear/intelligence field at capacity', async () => {
      const host = await create(), guest = await join(host); await start(host, guest);
      const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);
      const [{ MatchRules }, { DuelistKit, NOPE_SKILLS, EMBER_SKILLS }, { createTeamAbilities }, { createZoneAbilities }, { createCharacterSkills }, { createNopeDecoys }] = await Promise.all([
        load('rules.js'), load('abilities.js'), load('team-abilities.js'), load('zone-abilities.js'), load('character-skills.js'), load('nope-decoys.js'),
      ]);
      const now = 1000.1234567890123, match = new MatchRules(); match.startLive();
      const roster = Array.from({ length: 10 }, (_, i) => {
        const kit = new DuelistKit(); kit.armReadyAt = now + 1; kit.armExpiresAt = now + 8;
        return { id: i === 0 ? 'player' : i < 5 ? `blue-${i}` : `red-${i - 5}`, team: i < 5 ? 'blue' : 'red',
          name: '𠮷'.repeat(20), memberId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, kit,
          k: 100, d: 100, a: 100, credits: 9000, primary: 'phantom', secondary: 'ghost', armor: 50, survived: true, netFallback: false,
          netPurchases: { primary: { id: 'phantom', price: 2900 }, secondary: { id: 'ghost', price: 500 }, armor: { id: 'heavy', price: 1000 } } };
      });
      const actors = roster.map((record, i) => ({ id: record.id, team: record.team, record, kit: record.kit,
        x: i ? -20.123456789012345 + (i - 1) * 4.3210987654321 : 0,
        z: i ? 5.34567890123456 + (i - 1) * .2345678901234 : 0, y: 0, yaw: 0, vx: 0, vz: 0,
        hp: 100, armor: 50, alive: true, grounded: true, weaponId: 'phantom', ammo: 30, reserve: 90, netWeapon: 'phantom', netAmmo: 30, netReserve: 90, netReload: .7234567890123457,
        serviceReload: { eventId: `skill-ember-service-${999999999999999-i}`, weaponId: 'phantom', endsAt: now + .7234567890123457 },
        remoteId: i ? record.memberId : null, netPurchaseAck: [Number.MAX_SAFE_INTEGER,1,'updraft'], netYaw: 1.2345678901234567, group: { rotation: { y: 0 } },
        netPositionAck: { seq: 100, connection: '10000000-0000-4000-8000-000000000000', round: 1,
          x: -20.123456789012345 + (i - 1) * 4.3210987654321, z: 5.34567890123456 + (i - 1) * .2345678901234 } }));
      const player = actors[0], bots = actors.slice(1), teamAbilities = createTeamAbilities(), zoneAbilities = createZoneAbilities(), ordinarySkills = createCharacterSkills();
      // Deliberately fill each independently bounded store. This is a conservative
      // transport budget, rather than a claim that all caps occur in one live round.
      for (let i = 0; i < 20; i++) teamAbilities.castRecon(actors[5], now, 1);
      teamAbilities.update(actors, now, 1);
      for (let i = 0; i < 20; i++) { const actor = actors[i % 10]; zoneAbilities.cast(i % 2 ? 'ember' : 'frost', actor, { x: actor.x, y: 0, z: actor.z }, now, 1); }
      for (let i = 0; i < 20; i++) ordinarySkills.cast(i % 2 ? 'nope-bottle' : 'nope-flash', player,
        { x: .123456789012345, y: 1.7, z: -5.23456789012345 }, now - .5, 1);
      const blindRecipients = Array.from({ length: 20 }, (_, i) => ({ ...player, id: `ordinary-recipient-${String(i).padStart(2, '0')}`, team: 'red', yaw: 0 }));
      ordinarySkills.update(blindRecipients, now, 1, { reachable: () => true });
      const heldBlinds = ordinarySkills.snapshot().blinds.map(blind => ({ ...blind, resisted: true, endsAt: blind.startedAt + NOPE_SKILLS.flashDuration * EMBER_SKILLS.shadeFlashScale }));
      ordinarySkills.reset();
      const tagOwner = actors[5];
      for (let i = 0; i < 20; i++) assert.ok(ordinarySkills.cast('echo-tag', tagOwner, { x: tagOwner.x, y: .12, z: tagOwner.z }, now - 1.05, 1));
      ordinarySkills.update([tagOwner, { ...player, x: tagOwner.x, z: tagOwner.z }], now, 1, { reachable: () => true });
      assert.equal(ordinarySkills.snapshot().markers.length, 20);
      // Keep all twenty blindness records while replacing the bounded visual
      // store with all grass/EMBER/FROST events, MEND fields and target-bearing heals.
      // Roots use two bounded endpoints, never an unbounded terrain-point array.
      for (let i = 0; i < 20; i++) {
        const type = ['mend-seeds','mend-pollen','veil-dust','veil-roots','veil-turf','ember-solder','ember-shade','ember-service','frost-stitch','frost-mist','frost-unravel','duelist-comet','duelist-lift','duck-seal','duck-shield','duck-hush','duck-egg'][i] || 'mend-heal';
        const target = { x: .123456789012345, y: type === 'mend-pollen' ? 1.7 : type === 'mend-seeds' ? .12 : 0, z: -5.23456789012345 };
        if(type==='veil-dust'||type==='veil-turf')Object.assign(target,{x:player.x,y:type==='veil-dust'?player.y+1.25:player.y,z:player.z});
        if(type==='ember-shade'||type==='ember-service')Object.assign(target,{x:player.x,y:player.y,z:player.z});
        if(type==='ember-service')target.weaponId=player.weaponId;
        if(type==='ember-solder')target.y=.12;
        if(type==='frost-stitch')target.y=.12;
        if(type==='frost-mist')target.y=1.4;
        if(type==='frost-unravel')Object.assign(target,{x:player.x,y:player.y,z:player.z});
        if(type==='duelist-comet')Object.assign(target,{x:player.x,y:player.y+4.7,z:player.z-10});
        if(type==='duck-seal')target.targetId='s'.repeat(64);
        if(type==='duck-shield')target.yaw=1.2345678901234567;
        if(type==='duck-hush'||type==='duck-egg')Object.assign(target,{x:player.x,y:player.y,z:player.z});
        if(type==='duelist-lift')Object.assign(target,{x:player.x,y:player.y,z:player.z});
        if (type === 'mend-heal') target.targetId = `heal-${String(i).padStart(2, '0')}-${'t'.repeat(56)}`;
        assert.ok(ordinarySkills.cast(type, player, target, now, 1));
      }
      assert.equal(ordinarySkills.restore({ ...ordinarySkills.snapshot(), blinds: heldBlinds }, now, 1), true);
      const cues = Array.from({ length: 64 }, (_, i) => { const actor = actors[i % 10]; return { seq: i + 1, round: 1, type: 'shot', weapon: 'phantom', id: actor.id, x: actor.x, y: 0, z: actor.z, time: now }; });
      const smokes = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, x: -10.123456789012345 + i, y: 1.7, z: 10.23456789012345 + i, expires: now + 4.5, kind: 'smoke', radius: 3.6 }));
      const drops = Array.from({ length: 32 }, (_, i) => { const actor = actors[i % 10]; return { id: i + 1, weapon: 'phantom', x: actor.x, z: actor.z, yaw: 1.2345678901234567, ammo: 30, reserve: 90 }; });
      const nopeDecoys=createNopeDecoys();
      assert.equal(nopeDecoys.start(player,Array.from({length:30},(_,i)=>({x:-999.99+i*.01,y:-999.99,z:999.99-i*.01,yaw:3.1415,walkLength:36})),now,1),true);
      const nopeState=nopeDecoys.snapshot();nopeState.id='nope-wave-1-999999999999999';assert.equal(nopeDecoys.restore(nopeState,now,1),true);
      const serializeNopePops=()=>Array.from({length:8},(_,i)=>[Number.MAX_SAFE_INTEGER-7+i,-999.1234567890123,-999.1234567890123,-999.1234567890123,now]);
      const sent = [], sandbox = { map:{id:"hirakata",traffic:{service:{snapshot:()=>[]}}}, fitTrafficSnapshot:(await import(pathToFileURL(path.join(__dirname,"public/traffic-state.js")).href)).fitTrafficSnapshot, player, bots, roster, match, elapsed: now, teamAbilities, zoneAbilities, ordinarySkills, nopeDecoys, serializeNopePops, onlinePlaying: true,
        online: { host: true, send: (packet, options) => sent.push({ packet, team: options?.team }) }, netClock: 0, netSequence: 0, netHostPaused: false,
        inventory: { active: 'phantom', primary: 'phantom', secondary: 'ghost' }, reloading: 1.2345678901234567, shotSequence: 0, lastShot: now,
        serializeNetCues: () => cues, serializeSmokes: () => smokes, serializeDrops: () => drops,
        netApplied: new Map(bots.map(bot => [bot.remoteId, 100])),
        detonationState: { id: 'd'.repeat(96), round: 1, startedAt: now, x: 1.23456789012345, z: 2.34567890123456, seed: 4294967295 },
        takeoverState: { id: 't'.repeat(96), round: 1, startedAt: now, endsAt: now + 12 } };
      const source = fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8');
      const capture = source.slice(source.indexOf('function captureNetActor('), source.indexOf('function applyNetSnapshot('));
      const tick = source.slice(source.indexOf('function tickOnline('), source.indexOf("$('online-open')"));
      assert.ok(capture.length > 500 && tick.length > 500, 'Exercise the saved game serializers');
      vm.createContext(sandbox); vm.runInContext(`${source.slice(source.indexOf('function carMotionActive('),source.indexOf('function beginCarMotion('))}\n${capture}\n${tick}\ntickOnline(.1)`, sandbox);
      assert.deepEqual(sent.map(entry => entry.team), ['blue', 'red'], 'The actual host serializer must make two private team packets');
      assert.equal(sent[0].packet.seq, sent[1].packet.seq, 'A team split is one logical host frame');
      assert.equal(sent[0].packet.ordinarySkills.markers.length, 0); assert.equal(sent[0].packet.teamAbilities.pings.length, 0);
      db.prepare("UPDATE online_rooms SET settings=json_set(settings, '$.matchEpoch', 9999) WHERE code=?").run(host.code);
      const snapshot = JSON.parse(JSON.stringify({ ...sent[1].packet, epoch:9999, room: host.code, connection: '10000000-0000-4000-8000-000000000000' }));
      assert.deepEqual([snapshot.actors.length, snapshot.roster.length, snapshot.cues.length, snapshot.smokes.length, snapshot.drops.length,
        snapshot.teamAbilities.events.length, snapshot.teamAbilities.pings.length, snapshot.zoneAbilities.events.length,
        snapshot.ordinarySkills.events.length, snapshot.ordinarySkills.blinds.length, snapshot.ordinarySkills.markers.length], [10, 10, 64, 20, 32, 20, 50, 20, 20, 20, 20]);
      assert.ok(snapshot.ordinarySkills.markers.every(marker => marker.team === 'red' && !Object.hasOwn(marker, 'targetId')), 'All twenty frozen detections are observer-private and contain no tracking target ID');
      assert.equal(createTeamAbilities().restore(snapshot.teamAbilities, now, 1), true); assert.equal(createZoneAbilities().restore(snapshot.zoneAbilities, now, 1), true);
      const ordinaryReplica = createCharacterSkills();
      assert.equal(ordinaryReplica.restore(snapshot.ordinarySkills, now, 1), true);
      assert.deepEqual(ordinaryReplica.snapshot(), snapshot.ordinarySkills, 'Every airborne mascot comet/lift, FROST ring/mist/ribbon, grass endpoint, EMBER weapon/resisted blind and MEND heal target must survive strict JSON restore');
      assert.deepEqual([...new Set(snapshot.ordinarySkills.events.map(event => event.type))].sort(), ['duck-egg','duck-hush','duck-seal','duck-shield','duelist-comet','duelist-lift','ember-service','ember-shade','ember-solder','frost-mist','frost-stitch','frost-unravel','mend-heal','mend-pollen','mend-seeds','veil-dust','veil-roots','veil-turf']);
      assert.ok(snapshot.ordinarySkills.events.filter(event=>event.type.startsWith('duelist-')).every(event=>Object.keys(event).length===16),'Comet/lift must keep their bounded canonical shape without transmitting impulse or a client-controlled smoke size');
      assert.ok(snapshot.ordinarySkills.events.filter(event=>event.type.startsWith('frost-')).every(event=>Object.keys(event).length===16),'FROST must retain the bounded canonical shape without client-controlled mitigation/ring fields');
      assert.equal(snapshot.ordinarySkills.events.find(event=>event.type==='ember-service').weaponId,'phantom');assert.ok(snapshot.ordinarySkills.blinds.every(blind=>blind.resisted===true),'The bounded budget must carry all twenty explicit resisted flags');
      assert.ok(snapshot.actors.every(actor=>actor.serviceReload?.weaponId==='phantom'&&Object.keys(actor.serviceReload).length===3),'The conservative budget must include all ten canonical service markers independently of visual event expiry');
      const restoredRoots=snapshot.ordinarySkills.events.find(event=>event.type==='veil-roots');
      assert.ok([restoredRoots.fromX,restoredRoots.fromY,restoredRoots.fromZ,restoredRoots.x,restoredRoots.y,restoredRoots.z].every(Number.isFinite));
      assert.equal(Object.values(restoredRoots).some(Array.isArray),false,'A roots field must not add unbounded support-coordinate arrays to the transport');
      assert.ok(snapshot.ordinarySkills.events.filter(event => event.type === 'mend-heal').every(event => event.targetId.length === 64), 'The transport budget must include complete legal heal target IDs');
      const bytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
      assert.equal(snapshot.nopeDecoys.points.length,30);assert.equal(snapshot.nopePops.length,8);
      assert.equal(snapshot.actors.filter(a=>a.purchaseAck).length,0,'Purchase receipts must not consume the full live effect budget');
      const nopeReplica=createNopeDecoys();assert.equal(nopeReplica.restore(snapshot.nopeDecoys,now,1),true);assert.equal(nopeReplica.events(now).length,30);
      assert.ok(bytes > 40 * 1024 && bytes <= 64 * 1024, `The complete conservative snapshot must exceed the former limit and fit the new cap, got ${bytes}B`);
      assert.equal((await send(host, 'team:red', 'game', snapshot)).status, 201);
      const delivered = (await getMessages(guest)).value.messages;
      assert.equal(delivered.length, 1); assert.deepEqual(delivered[0].data, snapshot, 'HTTP fallback must preserve every state/effect/cue/marker/drop without truncation');
      for(const type of ['nobi-bell','nobi-whisker','nobi-toolbox','nobi-collar','duck-pad','duck-seal','duck-shield','cat-pluck','car-bumper','nobi-tag','nobi-brake','japan-levy','japan-border','cap-lock','cap-clean','urchin-lance','urchin-jam','urchin-disarm']){
        clock+=200; // Model the existing relay cadence while testing more roster payloads.
        const worst=JSON.parse(JSON.stringify(snapshot)),pool=createCharacterSkills();
        for(let i=0;i<20;i++)assert.ok(pool.cast(type,player,{x:player.x,y:0,z:player.z-3,targetId:'s'.repeat(64),yaw:1.2345678901234567},now,1));
        worst.ordinarySkills.events=pool.snapshot().events.map((e,i)=>({...e,id:`skill-${type}-${999999999999980+i}`}));
        assert.ok(createCharacterSkills().restore(worst.ordinarySkills,now,1));
        if(type==='car-bumper'){
          const ram=JSON.parse(JSON.stringify(worst));for(const a of ram.actors)a.carMove=['skill-car-bumper-999999999999999',2,now+.987654321,16.970562748,16.970562748,5.87654321];
          const fitRam=(await import(pathToFileURL(path.join(__dirname,'public/traffic-state.js')).href)).fitTrafficSnapshot,bounded=fitRam(ram);assert.ok(bounded);assert.deepEqual(bounded.actors,ram.actors);assert.deepEqual(bounded.ordinarySkills,ram.ordinarySkills);assert.ok(Buffer.byteLength(JSON.stringify(bounded))<=65536);assert.equal((await send(host,'team:red','game',bounded)).status,201);console.log(`CAR10 MOTION CAPACITY: ${Buffer.byteLength(JSON.stringify(bounded))}B /65536B`);clock+=200;
        }
        const size=Buffer.byteLength(JSON.stringify(worst),'utf8');assert.ok(size<=65536,`${type} full snapshot ${size}B`);
        assert.equal((await send(host,'team:red','game',worst)).status,201);console.log(`DUCK SNAPSHOT CAPACITY: ${type} ${size}B / 65536B`);
      }
      const catPacket=JSON.parse(JSON.stringify(snapshot)),catPool=createCharacterSkills();
      for(const type of ['cat-bookmark','cat-return','cat-pluck','cat-fetch','cat-clock']){const target={x:player.x,y:player.y,z:player.z,...(type==='cat-pluck'?{targetId:'s'.repeat(64)}:{})};assert.ok(catPool.cast(type,player,target,now,1));}
      catPacket.ordinarySkills.events=catPool.snapshot().events;assert.ok(createCharacterSkills().restore(catPacket.ordinarySkills,now,1));assert.equal((await send(host,'team:red','game',catPacket)).status,201);
      const carPacket=JSON.parse(JSON.stringify(snapshot)),carPool=createCharacterSkills();
      for(const type of ['car-bumper','car-wash','car-gyro','car-pit'])assert.ok(carPool.cast(type,player,{...player,...(type==='car-bumper'?{targetId:'s'.repeat(64)}:{})},now,1));
      carPacket.ordinarySkills.events=carPool.snapshot().events;assert.ok(createCharacterSkills().restore(carPacket.ordinarySkills,now,1));assert.equal((await send(host,'team:red','game',carPacket)).status,201);
      const nobiPacket=JSON.parse(JSON.stringify(snapshot)),nobiPool=createCharacterSkills();
      for(const type of ['nobi-tag','nobi-brake','nobi-tool','nobi-legend'])assert.ok(nobiPool.cast(type,player,{...player,...(['nobi-tag','nobi-brake'].includes(type)?{targetId:'s'.repeat(64)}:{})},now,1));
      nobiPacket.ordinarySkills.events=nobiPool.snapshot().events;assert.ok(createCharacterSkills().restore(nobiPacket.ordinarySkills,now,1));assert.equal((await send(host,'team:red','game',nobiPacket)).status,201);
      const japanPacket=JSON.parse(JSON.stringify(snapshot)),japanPool=createCharacterSkills();
      for(const type of ['japan-border','japan-levy','japan-return','japan-muster'])assert.ok(japanPool.cast(type,player,{...player,...(type==='japan-levy'?{targetId:'s'.repeat(64)}:{}),...(type==='japan-border'?{yaw:1}: {})},now,1));
      japanPacket.ordinarySkills.events=japanPool.snapshot().events;assert.ok(createCharacterSkills().restore(japanPacket.ordinarySkills,now,1));assert.equal((await send(host,'team:red','game',japanPacket)).status,201);
      clock+=200;
      const capPacket=JSON.parse(JSON.stringify(snapshot)),capPool=createCharacterSkills();
      for(const type of ['cap-lock','cap-clean','cap-bank','cap-magazine'])assert.ok(capPool.cast(type,player,{...player,...(['cap-lock','cap-clean'].includes(type)?{targetId:'s'.repeat(64)}:{})},now,1));
      capPacket.ordinarySkills.events=capPool.snapshot().events;assert.ok(createCharacterSkills().restore(capPacket.ordinarySkills,now,1));assert.equal((await send(host,'team:red','game',capPacket)).status,201);
      clock+=200;
      const urchinPacket=JSON.parse(JSON.stringify(snapshot)),urchinPool=createCharacterSkills();
      for(const type of ['urchin-lance','urchin-jam','urchin-disarm','urchin-pearl','urchin-trident'])assert.ok(urchinPool.cast(type,player,{...player,...(['urchin-jam','urchin-disarm'].includes(type)?{targetId:'s'.repeat(64)}:{})},now,1));
      urchinPacket.ordinarySkills.events=urchinPool.snapshot().events;assert.ok(createCharacterSkills().restore(urchinPacket.ordinarySkills,now,1));assert.equal((await send(host,'team:red','game',urchinPacket)).status,201);
      for(const type of ['onnara-tax','onnara-orb','onnara-hover','onnara-chain']){
        clock+=200;const worst=JSON.parse(JSON.stringify(snapshot)),pool=createCharacterSkills();
        for(let i=0;i<20;i++){const source={...player,id:'o'.repeat(62)+String(i).padStart(2,'0'),y:1.2345678901234567,grounded:false},target={x:source.x,y:source.y,z:source.z,...(type==='onnara-tax'?{targetId:'t'.repeat(62)+String(i).padStart(2,'0')}:{yaw:1.2345678901234567})};assert.ok(pool.cast(type,source,target,now,1));if(type==='onnara-chain')pool.recordConstellation(source.id,{x:123.456,y:7.891,z:-123.456},{x:124.456,y:7.891,z:-123.456},now);}
        worst.ordinarySkills.events=pool.snapshot().events.map((e,i)=>({...e,id:`skill-${type}-${999999999999980+i}`}));
        if(type==='onnara-tax'){const effectsPacket={...worst,cues:worst.cues.map(c=>({...c,type:'skill-heal',weapon:'duelist'}))};const fitSkill=(await import(pathToFileURL(path.join(__dirname,'public/traffic-state.js')).href)).fitTrafficSnapshot;const skillPacket=fitSkill(effectsPacket);assert.ok(skillPacket);assert.deepEqual(skillPacket.actors,effectsPacket.actors);assert.deepEqual(skillPacket.ordinarySkills,effectsPacket.ordinarySkills);assert.deepEqual(skillPacket.cues,effectsPacket.cues.slice(-skillPacket.cues.length));assert.ok(Buffer.byteLength(JSON.stringify(skillPacket))<=65536);assert.equal((await send(host,'team:red','game',skillPacket)).status,201);console.log(`SKILL IMPACT live64cue capacity ${Buffer.byteLength(JSON.stringify(skillPacket))}B /65536B`);worst.rules.phase='post';worst.rules.phaseTime=5;worst.rules.lastRound={team:'blue',reason:'elimination',won:true,reward:3000,round:1,side:'attack',fullCombo:0};const fit=(await import(pathToFileURL(path.join(__dirname,'public/traffic-state.js')).href)).fitTrafficSnapshot;const bounded=fit(worst);assert.ok(bounded);assert.ok(bounded.cues.length<worst.cues.length);assert.deepEqual(bounded.rules,worst.rules);assert.deepEqual(bounded.actors,worst.actors);assert.deepEqual(bounded.ordinarySkills,worst.ordinarySkills);assert.equal(worst.cues.length,64);worst.cues=bounded.cues;}
        assert.ok(createCharacterSkills().restore(worst.ordinarySkills,now,1));const bytes=Buffer.byteLength(JSON.stringify(worst),'utf8');assert.ok(bytes<=65536,`${type} full snapshot ${bytes}B`);assert.equal((await send(host,'team:red','game',worst)).status,201);console.log(`ONNARA SNAPSHOT CAPACITY: ${type} ${bytes}B /65536B`);
      }
      clock+=200;
      const arsenalPacket=JSON.parse(JSON.stringify(snapshot));
      for(const actor of arsenalPacket.actors)Object.assign(actor,{weapon:'forge',primary:'forge',ammo:60,reserve:120});
      for(const record of arsenalPacket.roster)record.primary='forge';
      const arsenalBytes=Buffer.byteLength(JSON.stringify(arsenalPacket));assert.ok(arsenalBytes<=65536);
      assert.equal((await send(host,'team:red','game',arsenalPacket)).status,201);
      console.log(`ARSENAL 10 machine guns with full reserve ${arsenalBytes}B /65536B`);
      clock+=200;const mixedPacket=JSON.parse(JSON.stringify(snapshot)),mixedPool=createCharacterSkills();
      for(let i=0;i<10;i++){const source={...actors[i],x:-81.123456+i*.01,y:10.987654,z:-81.123456+i*.01},target={x:source.x+1,y:source.y,z:source.z,targetId:actors[(i+5)%10].id};assert.ok(mixedPool.cast('onnara-tax',source,target,now,1));assert.ok(mixedPool.cast('onnara-orb',source,{...source,yaw:1.2345678901234567},now,1));}
      mixedPacket.ordinarySkills.events=mixedPool.snapshot().events;assert.ok(createCharacterSkills().restore(mixedPacket.ordinarySkills,now,1));const mixedBytes=Buffer.byteLength(JSON.stringify(mixedPacket),'utf8');assert.ok(mixedBytes<=65536);assert.equal((await send(host,'team:red','game',mixedPacket)).status,201);console.log(`ONNARA LIVE-MAP MIX:20 effects/10 actual roster IDs/negative boundary coordinates ${mixedBytes}B /65536B`);
      console.log(`SNAPSHOT CAPACITY: ${bytes}B / 65536B;20 team events,50 private pings,20 zones,20 ordinary events,20 blinds,20 private tags,20 smoke,32 gear,64 cues,10 actors`);
      const{fitTrafficSnapshot}=await import(pathToFileURL(path.join(__dirname,'public/traffic-state.js')).href);
      const full=JSON.parse(JSON.stringify(snapshot));for(const actor of full.actors)actor.trafficHit=[99999,now+.8,17.123456,16.123456,5.6];
      full.cues.push(...Array.from({length:30},(_,i)=>({...full.cues[0],seq:100+i})));
      const gloomy=JSON.parse(JSON.stringify(full)),gloomPool=createCharacterSkills();
      for(let i=0;i<20;i++)assert.ok(gloomPool.cast('urchin-gloom',{...player,id:'g'.repeat(62)+String(i).padStart(2,'0')},{x:player.x,y:(player.y||0)+1.7,z:player.z-36},now,1));
      gloomy.ordinarySkills.events=gloomPool.snapshot().events.map((e,i)=>({...e,id:`skill-urchin-gloom-${999999999999980+i}`}));
      gloomy.ordinarySkills.blinds=gloomy.ordinarySkills.blinds.map((b,i)=>({...b,eventId:`skill-urchin-gloom-${999999999999980+i}`,startedAt:now,endsAt:now+3}));
      for(const b of gloomy.ordinarySkills.blinds)delete b.resisted;
      assert.ok(createCharacterSkills().restore(gloomy.ordinarySkills,now,1));const gloomFit=fitTrafficSnapshot(gloomy);assert.ok(gloomFit);assert.deepEqual(gloomFit.ordinarySkills,gloomy.ordinarySkills);assert.deepEqual(gloomFit.actors,gloomy.actors);assert.ok(Buffer.byteLength(JSON.stringify(gloomFit))<=65536);clock+=200;assert.equal((await send(host,'team:red','game',gloomFit)).status,201);console.log(`GLOOM20 +NEARSIGHT20 capacity ${Buffer.byteLength(JSON.stringify(gloomFit))}B /65536B; authority retained`);
      const limited=fitTrafficSnapshot(full);assert.ok(limited);assert.ok(limited.cues.length<full.cues.length);assert.deepEqual(limited.actors,full.actors);assert.deepEqual(limited.ordinarySkills,full.ordinarySkills);assert.deepEqual(limited.rules,full.rules);assert.ok(Buffer.byteLength(JSON.stringify(limited))<=65536);clock+=200;assert.equal((await send(host,'team:red','game',limited)).status,201);console.log(`HIRAKATA simultaneous10 launches full wire ${Buffer.byteLength(JSON.stringify(limited))}B /65536B; only old cosmetic cues reduced`);
      const trcFull=JSON.parse(JSON.stringify(full));trcFull.mapId='trc';delete trcFull.busTransit;delete trcFull.busDamage;trcFull.trcDoors=[['D1',180,false],['D2',179,true],['D3',0,true],['D4',180,false],['D5',0,true]];
      for(const [i,drop]of trcFull.drops.entries())drop.y=i%2?-3.2:3.2;trcFull.rules.spike.y=-3.2;
      for(const actor of trcFull.actors)Object.assign(actor,{trcLadder:'L1',crouch:1,hp:1000,armor:500});
      const trcFit=fitTrafficSnapshot(trcFull);assert.ok(trcFit);for(const field of ['trcDoors','actors','rules','roster','ordinarySkills','teamAbilities','zoneAbilities','drops'])assert.deepEqual(trcFit[field],trcFull[field]);
      const trcBytes=Buffer.byteLength(JSON.stringify(trcFit));assert.ok(trcBytes<=65536);clock+=200;assert.equal((await send(host,'team:red','game',trcFit)).status,201);console.log(`TRC10 climbers/doors/boostedactors bounded wire ${trcBytes}B /65536B; authority retained`);
      const driven={...full,busTransit:[[0,0,0,now+25,29.123,-35.789,-1.571,17,[0,1,2]],[1,0,3,now+25,1.234,32.456,1.571,17,[3,4,5]],[2,0,6,now+25,31.456,-36.123,1.571,17,[6,7]],[3,0,8,now+25,3.456,33.123,1.571,17,[8,9]]]};
      for(const actor of driven.actors)Object.assign(actor,{hp:1000,armor:500});
      const busFit=fitTrafficSnapshot(driven);assert.ok(busFit);assert.deepEqual(busFit.busTransit,driven.busTransit);assert.deepEqual(busFit.actors,driven.actors);assert.deepEqual(busFit.ordinarySkills,driven.ordinarySkills);assert.ok(Buffer.byteLength(JSON.stringify(busFit))<=65536);clock+=200;assert.equal((await send(host,'team:red','game',busFit)).status,201);console.log(`BUS4 /10 riders / full skills capacity ${Buffer.byteLength(JSON.stringify(busFit))}B /65536B`);
      const retired={...driven,busTransit:[0,1,2,3].map(i=>[i,0,-1,0,null,null,null,0,[]])};const retiredFit=fitTrafficSnapshot(retired);assert.ok(retiredFit);assert.deepEqual(retiredFit.busTransit,retired.busTransit);assert.deepEqual(retiredFit.actors,retired.actors);assert.deepEqual(retiredFit.rules,retired.rules);clock+=200;assert.equal((await send(host,'team:red','game',retiredFit)).status,201);console.log(`BUS4 RETIRED /10 boosted actors ${Buffer.byteLength(JSON.stringify(retiredFit))}B /65536B`);
      const queued={...driven,busDamage:'ff'.repeat(10)+'03',busTransit:driven.busTransit.map((v,i)=>[i,100,-1,0,v[4],v[5],v[6],0,v[8],now-12.345])};
      const queuedFit=fitTrafficSnapshot(queued);assert.ok(queuedFit);assert.deepEqual(queuedFit.busDamage,queued.busDamage);assert.deepEqual(queuedFit.busTransit,queued.busTransit);assert.deepEqual(queuedFit.actors,queued.actors);assert.deepEqual(queuedFit.ordinarySkills,queued.ordinarySkills);clock+=200;assert.equal((await send(host,'team:red','game',queuedFit)).status,201);console.log(`BUS4 QUEUED /82 destroyed props /10 boosted riders ${Buffer.byteLength(JSON.stringify(queuedFit))}B /65536B; authority retained`);
      const allBays={...queued,busDamage:'ff'.repeat(32)};const allBaysFit=fitTrafficSnapshot(allBays);assert.ok(allBaysFit);assert.equal(allBaysFit.busDamage,allBays.busDamage);assert.deepEqual(allBaysFit.actors,allBays.actors);assert.deepEqual(allBaysFit.busTransit,allBays.busTransit);assert.deepEqual(allBaysFit.ordinarySkills,allBays.ordinarySkills);clock+=200;assert.equal((await send(host,'team:red','game',allBaysFit)).status,201);console.log(`BUS4 queued /max256 demolition bits /10 boosted actors ${Buffer.byteLength(JSON.stringify(allBaysFit))}B /65536B`);
      const impactFull={...allBays,cues:Array.from({length:64},(_,i)=>({seq:99900+i,round:1,type:'bus-break',weapon:'vandal',id:'bus-break:north-1',x:29.123456,y:1.35,z:-33.123456,time:now}))};
      const impactFit=fitTrafficSnapshot(impactFull);assert.ok(impactFit);assert.deepEqual(impactFit.actors,impactFull.actors);assert.deepEqual(impactFit.ordinarySkills,impactFull.ordinarySkills);assert.deepEqual(impactFit.busTransit,impactFull.busTransit);assert.equal(impactFit.busDamage,impactFull.busDamage);assert.ok(impactFit.cues.length>0);assert.deepEqual(impactFit.cues,impactFull.cues.slice(-impactFit.cues.length));assert.ok(Buffer.byteLength(JSON.stringify(impactFit))<=65536);clock+=200;assert.equal((await send(host,'team:red','game',impactFit)).status,201);console.log(`BUS BREAK64 cues /4 queued /all bays /10 actors ${Buffer.byteLength(JSON.stringify(impactFit))}B /65536B; authoritative fields intact`);
      const combatFull={...allBays,cues:Array.from({length:64},(_,i)=>({seq:100000+i,round:1,type:i%2?'kill-5':'gun-hit',weapon:'vandal',id:actors[i%10].id,x:29.123456,y:1.35,z:-33.123456,time:now}))};
      const combatFit=fitTrafficSnapshot(combatFull);assert.ok(combatFit);assert.deepEqual(combatFit.actors,combatFull.actors);assert.deepEqual(combatFit.ordinarySkills,combatFull.ordinarySkills);assert.deepEqual(combatFit.rules,combatFull.rules);assert.deepEqual(combatFit.busTransit,combatFull.busTransit);assert.equal(combatFit.busDamage,combatFull.busDamage);assert.ok(combatFit.cues.length>0);assert.deepEqual(combatFit.cues,combatFull.cues.slice(-combatFit.cues.length));assert.ok(Buffer.byteLength(JSON.stringify(combatFit))<=65536);clock+=200;assert.equal((await send(host,'team:red','game',combatFit)).status,201);console.log(`GUN confirmation64 cues/4queued/all bays/10actors ${Buffer.byteLength(JSON.stringify(combatFit))}B /65536B; authoritative fields intact`);


      // Renko X uses one optional kit boolean. Check ten active X, twenty darts and ten accepted pushes
      // with all previous maximum state against the real SQLite relay.
      const renkoPool=createCharacterSkills();for(let i=0;i<20;i++)assert.ok(renkoPool.cast('renko-dart',{id:'renko'+i,team:i%2?'red':'blue',x:-22.123,y:9.123,z:33.123,hp:100,alive:true},{x:-22.123,y:10.823,z:-6.877},now,1));
      const renkoFull={...allBays,ordinarySkills:{...allBays.ordinarySkills,events:renkoPool.snapshot().events},actors:allBays.actors.map(a=>({...a,kit:{...a.kit,character:'renko',renkoActive:true},carMove:['skill-renko-dart-999999999999999',4,now+.9,24,0,6]}))};
      assert.ok(createCharacterSkills().restore(renkoFull.ordinarySkills,now,1));const renkoFit=fitTrafficSnapshot(renkoFull);assert.ok(renkoFit);assert.deepEqual(renkoFit.actors,renkoFull.actors);assert.deepEqual(renkoFit.ordinarySkills,renkoFull.ordinarySkills);assert.ok(Buffer.byteLength(JSON.stringify(renkoFit))<=65536);clock+=200;assert.equal((await send(host,'team:red','game',renkoFit)).status,201);console.log(`RENKO X10/20 darts/10 pushes/4queued/all bays ${Buffer.byteLength(JSON.stringify(renkoFit))}B /65536B; authority retained`);
      const farPool=createCharacterSkills();for(let i=0;i<20;i++)assert.ok(farPool.cast('renko-dart',{id:'renko'+i,team:i%2?'red':'blue',x:71.123456789,y:9.123456789,z:71.123456789,hp:100,alive:true},{x:-81.987654321,y:10.823456789,z:-81.987654321},now,1));
      const farFull={...renkoFull,ordinarySkills:{...renkoFull.ordinarySkills,events:farPool.snapshot().events.map((e,i)=>({...e,id:`skill-renko-dart-${999999999999980+i}`}))}};
      assert.ok(createCharacterSkills().restore(farFull.ordinarySkills,now,1));const farFit=fitTrafficSnapshot(farFull);assert.ok(farFit);assert.deepEqual(farFit.actors,farFull.actors);assert.deepEqual(farFit.ordinarySkills,farFull.ordinarySkills);assert.ok(Buffer.byteLength(JSON.stringify(farFit))<=65536);clock+=200;assert.equal((await send(host,'team:red','game',farFit)).status,201);console.log(`RENKO20 long-flight/max IDs/10 pushes ${Buffer.byteLength(JSON.stringify(farFit))}B /65536B; authority retained`);
      for(const type of['renko-drive','renko-jet']){const pool=createCharacterSkills();for(let i=0;i<20;i++)assert.ok(pool.cast(type,{id:'renko'+i,team:i%2?'red':'blue',x:-22.123456789,y:9.123456789,z:33.123456789,hp:100,alive:true},{x:-22.123456789,y:9.123456789,z:33.123456789},now,1));const state={...renkoFull,ordinarySkills:{...renkoFull.ordinarySkills,events:pool.snapshot().events.map((e,i)=>({...e,id:`skill-${type}-${999999999999980+i}`}))}};assert.ok(createCharacterSkills().restore(state.ordinarySkills,now,1));const bounded=fitTrafficSnapshot(state);assert.ok(bounded);assert.deepEqual(bounded.actors,state.actors);assert.deepEqual(bounded.ordinarySkills,state.ordinarySkills);assert.ok(Buffer.byteLength(JSON.stringify(bounded))<=65536);clock+=200;assert.equal((await send(host,'team:red','game',bounded)).status,201);console.log(`RENKO20 ${type}/max ID/10 pushes ${Buffer.byteLength(JSON.stringify(bounded))}B /65536B`);}

      const cameraPool=createCharacterSkills();for(let i=0;i<20;i++){const owner={id:'camera'+Math.floor(i/2),team:Math.floor(i/2)%2?'red':'blue',x:-22.123,y:9.123,z:33.123,hp:100,alive:true};assert.ok(cameraPool.cast('onnara-orb',owner,{x:owner.x,y:10.653,z:owner.z-.6,yaw:-2.345678901234567,cameraVelocity:[12/Math.sqrt(3),12/Math.sqrt(3),12/Math.sqrt(3)]},now,1));}
      const cameraFull={...renkoFull,ordinarySkills:{...renkoFull.ordinarySkills,events:cameraPool.snapshot().events.map((e,i)=>({...e,id:`skill-onnara-orb-${999999999999980+i}`,x:-81.123,y:19.123,z:81.123}))}};
      assert.ok(createCharacterSkills().restore(cameraFull.ordinarySkills,now,1));const cameraFit=fitTrafficSnapshot(cameraFull);assert.ok(cameraFit);assert.deepEqual(cameraFit.ordinarySkills,cameraFull.ordinarySkills);assert.deepEqual(cameraFit.actors,cameraFull.actors);clock+=200;assert.equal((await send(host,'team:red','game',cameraFit)).status,201);console.log(`ONNARA20 moving cameras/17fields/maxID/10actors/full bus state ${Buffer.byteLength(JSON.stringify(cameraFit))}B /65536B; authority retained`);

      // Ten crouched actors must still fit with the full bus/effect state.
      for(const actor of actors)actor.crouch=.987654321;
      sent.length=0;sandbox.map={id:'hashimoto'};vm.runInContext('tickOnline(.1)',sandbox);
      assert.equal(sent.length,2);assert.ok(sent.every(s=>s.packet.actors.every(a=>a.crouch===.988)));
      const crouched=fitTrafficSnapshot({...allBays,actors:sent[1].packet.actors.map(a=>({...a,hp:1000,armor:500,trafficHit:[99999,now+.8,17.123456,16.123456,5.6]}))});
      assert.ok(crouched);assert.ok(crouched.actors.every(a=>a.crouch===.988));assert.deepEqual(crouched.ordinarySkills,queued.ordinarySkills);assert.deepEqual(crouched.busTransit,queued.busTransit);
      assert.ok(Buffer.byteLength(JSON.stringify(crouched))<=65536);clock+=200;assert.equal((await send(host,'team:red','game',crouched)).status,201);
      console.log(`CROUCH10 /4queued buses /max256 destroyed /full skills ${Buffer.byteLength(JSON.stringify(crouched))}B /65536B; authoritative posture retained`);

      // Buy-only previous-round reports do not grow a live combat snapshot.
      assert.equal(snapshot.damageReport,undefined);
      const {createRoundDamageTracker}=await load('combat-report.js');
      const reports=createRoundDamageTracker();reports.begin(1,roster);
      for(const victim of roster)for(const killer of [null,...roster])reports.record(1,victim.id,killer?.id,10000000);
      reports.finish(1);sandbox.roundDamage=reports;sandbox.match.phase='buy';sandbox.match.round=2;
      sent.length=0;vm.runInContext('tickOnline(.1)',sandbox);
      assert.equal(sent.length,2);assert.ok(sent.every(s=>s.packet.damageReport[1].length===80));
      for(const {packet}of sent){assert.ok(Buffer.byteLength(JSON.stringify(packet))<=65536);assert.equal(packet.rules.phase,'buy');}
      const buyFull={...crouched,rules:{...crouched.rules,phase:'buy',round:2},damageReport:reports.snapshot('red',2)};
      const buyFit=fitTrafficSnapshot(buyFull);assert.ok(buyFit);assert.deepEqual(buyFit.damageReport,buyFull.damageReport);assert.deepEqual(buyFit.actors,buyFull.actors);assert.deepEqual(buyFit.ordinarySkills,buyFull.ordinarySkills);assert.deepEqual(buyFit.busTransit,buyFull.busTransit);
      assert.ok(createRoundDamageTracker().restore(buyFit.damageReport,roster,2,'red'));
      clock+=200;assert.equal((await send(host,'team:red','game',buyFit)).status,201);
      const damageDelivery=await getMessages(guest);assert.deepEqual(damageDelivery.value.messages.at(-1).data.damageReport,buyFit.damageReport);
      console.log(`DAMAGE REPORT80 /10actors /4queued /full effects buy ${Buffer.byteLength(JSON.stringify(buyFit))}B /65536B; no authority/report removed`);




    });

    await test('competing joins and team changes cannot overfill a ten-person room or five-person team', async () => {
      const host = await create();
      const attempts = await Promise.all(Array.from({ length: 24 }, (_, i) => api(`/${host.code}/join`, { method: 'POST', body: { name: `P${i}`, team: i % 2 ? 'blue' : 'red' } })));
      assert.equal(attempts.filter(r => r.status === 201).length, 9);
      assert.equal(attempts.filter(r => r.status === 409).length, 15);
      const room = (await api(`/${host.code}`, { member: host })).value;
      assert.equal(room.members.length, 10);
      assert.equal(room.members.filter(m => m.team === 'blue').length, 5);
      assert.equal(room.members.filter(m => m.team === 'red').length, 5);
      const guest = attempts.find(r => r.status === 201 && r.value.members.find(m => m.id === r.value.memberId).team === 'red').value;
      assert.equal((await api(`/${host.code}/ready`, { method: 'POST', member: guest, body: { ready: true, team: 'blue' } })).status, 409);
      assert.equal((await api(`/${host.code}/leave`, { method: 'POST', member: guest })).status, 200);
      assert.equal((await api(`/${host.code}`, { member: guest })).status, 401);
      const replacement = await join(host, 'red', 'REPLACEMENT');
      assert.equal(replacement.members.length, 10);
      assert.notEqual(replacement.token, guest.token);
    });

    await test('JSON, message sizes, address fields and burst queues have bounded validation', async () => {
      const host = await create(), guest = await join(host); await start(host, guest);
      assert.equal((await api('', { method: 'POST', raw: '{' })).status, 400);
      assert.equal((await api('', { method: 'POST', raw: '[]' })).status, 400);
      assert.equal((await api('', { method: 'POST', body: { name: ' '.repeat(4) } })).status, 400);
      assert.equal((await api('', { method: 'POST', raw: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415);
      assert.equal((await api('', { method: 'POST', raw: 'x'.repeat(73 * 1024) })).status, 413);
      let chunksRead = 0, cancelled = false;
      const oversizedStream = new ReadableStream({
        pull(controller) { chunksRead++; controller.enqueue(new Uint8Array(32 * 1024)); },
        cancel() { cancelled = true; },
      });
      const streamed = await handleRooms(new Request('https://hashimoto.test/api/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: oversizedStream, duplex: 'half',
      }), env);
      assert.equal(streamed.status, 413); assert.equal(cancelled, true); assert.ok(chunksRead <= 4);
      assert.equal((await send(guest, 'host', 'game', { pad: 'x'.repeat(24 * 1024) })).status, 413);
      assert.equal((await send(guest, 'host', 'signal', { pad: 'x'.repeat(32 * 1024) })).status, 413);
      assert.equal((await send(guest, 'host', 'game', [])).status, 400);
      assert.equal((await send(guest, 'host', 'surprise', {})).status, 400);
      const bursts = await Promise.all(Array.from({ length: 15 }, (_, seq) => send(guest, 'host', 'game', { seq })));
      assert.equal(bursts.filter(r => r.status === 201).length, 12);
      assert.equal(bursts.filter(r => r.status === 429).length, 3);
      clock += 1001;
      assert.equal((await send(guest, 'host', 'game', { seq: 16 })).status, 201);
      assert.equal((await getMessages(guest, '-1')).status, 400);
      assert.equal((await getMessages(guest, '1e3')).status, 400);
      assert.equal((await getMessages(guest, '9007199254740992')).status, 400);
    });

    await test('message cursor pages through concurrent queues without leaking private or skipping later rows', async () => {
      const host = await create(), guest = await join(host), peer = await join(host, 'blue', 'PEER');
      const insert = db.prepare('INSERT INTO online_messages (room_code,sender_id,to_id,kind,data,created_at,expires_at) VALUES (?,?,?,?,?,?,?)');
      for (let i = 0; i < 250; i++) insert.run(host.code, host.memberId, i % 2 ? guest.memberId : peer.memberId, 'signal', JSON.stringify({ i }), clock, clock + 60_000);
      let cursor = 0, received = [];
      for (let page = 0; page < 4; page++) {
        const result = await getMessages(guest, cursor); assert.equal(result.status, 200);
        assert.ok(result.value.messages.length <= 100);
        received.push(...result.value.messages); cursor = result.value.cursor;
      }
      assert.equal(received.length, 125);
      assert.equal(new Set(received.map(m => m.seq)).size, 125);
      assert.ok(received.every(m => m.data.i % 2 === 1));
      clock += 1001;
      assert.equal((await send(host, guest.memberId, 'signal', { i: 999 })).status, 201);
      assert.equal((await getMessages(guest, cursor)).value.messages[0].data.i, 999);
    });

    await test('message TTL removes old signals while periodic host heartbeat keeps the room live', async () => {
      const host = await create(), guest = await join(host);
      await send(host, guest.memberId, 'signal', { old: true });
      for (let i = 0; i < 3; i++) { clock += 20_000; assert.equal((await api(`/${host.code}`, { member: host })).value.status, 'lobby'); }
      clock += 1;
      assert.equal((await getMessages(guest)).value.messages.length, 0);
      const expiredBefore = db.prepare('SELECT COUNT(*) AS n FROM online_messages WHERE expires_at <= ?').get(clock).n;
      await send(host, guest.memberId, 'signal', { fresh: true });
      const expiredAfter = db.prepare('SELECT COUNT(*) AS n FROM online_messages WHERE expires_at <= ?').get(clock).n;
      assert.equal(expiredAfter, Math.max(0, expiredBefore - 100));
      const received = await getMessages(guest); assert.equal(received.value.messages.length, 1); assert.equal(received.value.messages[0].data.fresh, true);
    });

    await test('host timeout or explicit exit closes every participant view and cannot be revived', async () => {
      const host = await create(), guest = await join(host); await start(host, guest);
      clock += 60_000;
      const read = await getMessages(guest); assert.equal(read.status, 200); assert.equal(read.value.room.status, 'closed');
      assert.ok(read.value.room.members.every(m => !m.connected));
      assert.equal((await send(guest, 'host', 'game', { seq: 1 })).status, 410);
      assert.equal((await api(`/${host.code}`, { member: host })).value.status, 'closed');
      assert.equal((await api(`/${host.code}/join`, { method: 'POST', body: { name: 'LATE', team: 'red' } })).status, 410);
      const other = await create(), friend = await join(other);
      assert.deepEqual((await api(`/${other.code}/leave`, { method: 'POST', member: other })).value, { ok: true, closed: true });
      assert.equal((await getMessages(friend)).value.room.status, 'closed');
    });

    await test('guest reload validates the same membership and skips old relay history', async () => {
      const { RoomClient } = await import(pathToFileURL(path.join(__dirname, 'public/online.js')).href);
      const beforeFetch = globalThis.fetch, beforeStorage = globalThis.sessionStorage;
      const values = new Map();
      globalThis.sessionStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
      globalThis.fetch = (url, init) => handleRooms(new Request(new URL(url, 'https://hashimoto.test'), init), env);
      let first, recovered;
      try {
        const host = await create(), guest = await join(host); await start(host, guest);
        const old = await send(host, 'all', 'game', { type: 'snapshot', seq: 99 });
        RoomClient.saveSession(guest);
        clock += 21000; await api(`/${host.code}`, { member: host });
        assert.equal((await api(`/${host.code}`, { member: host })).value.members.find(member => member.id === guest.memberId).connected, false);
        const restored = await RoomClient.resumeSession();
        assert.equal(restored.status, 'guest'); assert.equal(restored.session.memberId, guest.memberId); assert.equal(restored.session.token, guest.token);
        assert.equal(restored.session.resumeCursor, old.value.seq, 'A reloaded guest must start after the stale message backlog');
        assert.equal(restored.session.members.find(member => member.id === guest.memberId).connected, true);
        assert.equal(restored.session.members.length, 2, 'Resume must not insert another participant or seat');
        first = new RoomClient(restored.session); first.close(false);
        assert.equal(RoomClient.savedSession().memberId, guest.memberId, 'Simulated reload must preserve its credentials');
        recovered = new RoomClient((await RoomClient.resumeSession()).session); recovered.close(false);
        assert.notEqual(first.connectionId, recovered.connectionId, 'Input packet numbering must get a new connection incarnation on reload');
        assert.equal(db.prepare('SELECT COUNT(*) AS n FROM online_members WHERE room_code = ?').get(host.code).n, 2);
      } finally {
        first?.close(false); recovered?.close(false); await new Promise(resolve => setTimeout(resolve, 0));
        globalThis.fetch = beforeFetch; if (beforeStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = beforeStorage;
      }
    });

    await test('host reload closes its lost world, while invalid and closed saved sessions are cleared', async () => {
      const { RoomClient } = await import(pathToFileURL(path.join(__dirname, 'public/online.js')).href);
      const beforeFetch = globalThis.fetch, beforeStorage = globalThis.sessionStorage, values = new Map();
      globalThis.sessionStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
      globalThis.fetch = (url, init) => handleRooms(new Request(new URL(url, 'https://hashimoto.test'), init), env);
      try {
        const host = await create(), guest = await join(host); await start(host, guest);
        const delivered = [], hostClient = new RoomClient(host);
        hostClient.room = { ...host, status: 'playing', members: [{ id: host.memberId, connected: true }, { id: guest.memberId, connected: false }] };
        hostClient.peers.set(guest.memberId, { pc: { close() {} }, channel: { readyState: 'open', bufferedAmount: 0, send: packet => delivered.push(JSON.parse(packet)) } });
        hostClient.send({ type: 'snapshot', seq: 1 });
        assert.equal(delivered.length, 1, 'A delayed API heartbeat must not stop an established direct channel');
        hostClient.close(false);
        assert.equal((await RoomClient.resumeSession()).status, 'host-ended');
        assert.equal(RoomClient.savedSession(), null); assert.equal((await getMessages(guest)).value.room.status, 'closed');
        RoomClient.saveSession(guest); assert.equal((await RoomClient.resumeSession()).status, 'closed'); assert.equal(RoomClient.savedSession(), null);
        RoomClient.saveSession({ ...guest, token: '0'.repeat(64) });
        assert.equal((await RoomClient.resumeSession()).status, 'expired'); assert.equal(RoomClient.savedSession(), null);
        values.set('hashimoto-online-session', '{broken'); assert.equal(RoomClient.savedSession(), null);
        const other = await create(), peer = await join(other); RoomClient.saveSession(peer);
        const onlineFetch = globalThis.fetch; globalThis.fetch = async () => { throw Error('offline'); };
        await assert.rejects(RoomClient.resumeSession(), /offline/);
        assert.equal(RoomClient.savedSession().memberId, peer.memberId, 'A temporary outage must not destroy the credentials needed for recovery');
        globalThis.fetch = onlineFetch;
        const client = new RoomClient(peer), leaving = client.close(true);
        assert.equal(RoomClient.savedSession(), null, 'Explicit leave must remove saved credentials immediately');
        await leaving;
        assert.ok(db.prepare('SELECT left_at FROM online_members WHERE id = ?').get(peer.memberId).left_at);
        let staleCallbacks = 0;
        const abandoned = new RoomClient(peer, { onRoom: () => staleCallbacks++ });
        await abandoned.close(true); await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal(staleCallbacks, 0, 'A late failure from an already closed client must not close a newly joined room');
      } finally {
        globalThis.fetch = beforeFetch; if (beforeStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = beforeStorage;
      }
    });

    await test('room expiry cleanup cascades only expired room data and storage failures stay private', async () => {
      const old = await create(), guest = await join(old); await send(old, guest.memberId, 'signal', { private: true });
      db.prepare('UPDATE online_rooms SET expires_at = ? WHERE code = ?').run(clock - 1, old.code);
      const fresh = await create();
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM online_rooms WHERE code = ?').get(old.code).n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM online_members WHERE room_code = ?').get(old.code).n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM online_messages WHERE room_code = ?').get(old.code).n, 0);
      assert.equal((await api(`/${fresh.code}`, { member: fresh })).status, 200);
      const unavailable = await handleRooms(new Request('https://hashimoto.test/api/rooms'), {});
      assert.equal(unavailable.status, 503); assert.equal((await unavailable.json()).error, 'storage_unavailable');
    });
    console.log(`Online room tests passed: ${passed} groups (real SQLite, D1-compatible bindings).`);
  } finally { Date.now = realNow; db.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
