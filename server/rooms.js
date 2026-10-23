// D1 stores room membership, WebRTC signalling, and the bounded HTTP fallback.
// The host owns gameplay. No match simulation lives in Worker isolate globals.
const ROOM_TTL = 2 * 60 * 60 * 1000;
const HOST_TIMEOUT = 60_000;
const CONNECTED_TIMEOUT = 20_000;
const MESSAGE_TTL = 60_000;
const MAX_BODY = 72 * 1024;
// Full ten-person snapshots include bounded effects, cues and dropped gear.
// Leave envelope space below MAX_BODY; inputs and signalling keep their caps.
const MAX_HOST_SNAPSHOT = 64 * 1024;
const encoder = new TextEncoder();
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function fail(status, code, message) { throw new ApiError(status, code, message); }
function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
function randomHex(bytes = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), n => n.toString(16).padStart(2, '0')).join('');
}
function randomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), n => CODE_ALPHABET[n & 31]).join('');
}
async function hashToken(token) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
  return Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
}
function statement(db, sql, ...values) { return db.prepare(sql).bind(...values); }
function changed(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }
function rows(result) { return result?.results ?? []; }
function cleanName(value) {
  if (typeof value !== 'string') fail(400, 'invalid_name', '名前を入力してください。');
  const name = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!name || [...name].length > 20) fail(400, 'invalid_name', '名前は1〜20文字で入力してください。');
  return name;
}
function cleanTeam(value, fallback = 'red') {
  if (value === undefined) return fallback;
  if (!['blue', 'red'].includes(value)) fail(400, 'invalid_team', 'チームを選択してください。');
  return value;
}
async function readBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail(415, 'json_required', 'JSON形式で送信してください。');
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_BODY) fail(413, 'body_too_large', '送信データが大きすぎます。');
  // Do not buffer an unbounded chunked body before checking its size.
  const reader = request.body?.getReader(), chunks = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY) { await reader.cancel(); fail(413, 'body_too_large', '送信データが大きすぎます。'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  let value;
  try { value = JSON.parse(new TextDecoder().decode(body)); } catch { fail(400, 'invalid_json', '送信データを読み取れません。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'invalid_json', 'オブジェクト形式で送信してください。');
  return value;
}
function checkOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) fail(403, 'origin_denied', '同じサイトから接続してください。');
}
async function cleanup(db, now) {
  // Fixed work per invocation. Migrations own table creation, never requests.
  await db.batch([
    statement(db, 'DELETE FROM online_messages WHERE seq IN (SELECT seq FROM online_messages WHERE expires_at <= ? ORDER BY expires_at LIMIT 200)', now),
    statement(db, 'DELETE FROM online_members WHERE room_code IN (SELECT code FROM online_rooms WHERE expires_at <= ? ORDER BY expires_at LIMIT 20)', now),
    statement(db, 'DELETE FROM online_rooms WHERE code IN (SELECT code FROM online_rooms WHERE expires_at <= ? ORDER BY expires_at LIMIT 20)', now),
  ]);
}
async function roomByCode(db, code, now) {
  const room = await statement(db, 'SELECT * FROM online_rooms WHERE code = ?', code).first();
  if (!room) fail(404, 'room_not_found', '部屋が見つかりません。');
  if (room.status !== 'closed' && (room.expires_at <= now || room.host_seen_at <= now - HOST_TIMEOUT)) {
    await statement(db, "UPDATE online_rooms SET status = 'closed' WHERE code = ? AND status != 'closed'", code).run();
    room.status = 'closed';
  }
  return room;
}
async function authenticate(request, db, room, now) {
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  const id = request.headers.get('x-member-id');
  if (!token || !id || id.length > 64) fail(401, 'unauthorized', '入室し直してください。');
  const member = await statement(db, 'SELECT * FROM online_members WHERE id = ? AND room_code = ? AND token_hash = ? AND left_at IS NULL', id, room.code, await hashToken(token)).first();
  if (!member) fail(401, 'unauthorized', '入室し直してください。');
  if (member.last_seen < now - 5000 && room.status !== 'closed') {
    const updates = [statement(db, 'UPDATE online_members SET last_seen = ? WHERE id = ? AND last_seen < ? AND left_at IS NULL', now, id, now - 5000)];
    if (id === room.host_id) updates.push(statement(db, "UPDATE online_rooms SET host_seen_at = ? WHERE code = ? AND status != 'closed'", now, room.code));
    await db.batch(updates);
    member.last_seen = now;
    if (id === room.host_id) room.host_seen_at = now;
  }
  return member;
}
async function publicRoom(db, room, now) {
  const members = rows(await statement(db, 'SELECT id, name, team, ready, last_seen FROM online_members WHERE room_code = ? AND left_at IS NULL ORDER BY joined_at, id', room.code).all());
  return { code: room.code, hostId: room.host_id, status: room.status,
    settings: JSON.parse(room.settings),
    members: members.map(m => ({ id: m.id, name: m.name, team: m.team, ready: !!m.ready, connected: room.status !== 'closed' && m.last_seen > now - CONNECTED_TIMEOUT })),
  };
}
function requireOpen(room) { if (room.status === 'closed') fail(410, 'room_closed', 'ホストが退出したため部屋を閉じました。新しい部屋を作ってください。'); }
function lobbySettings(body, defaults = { format: 'swift', mapId: 'hashimoto' }) {
  const format = body.format ?? defaults.format, mapId = body.mapId ?? defaults.mapId;
  if (!['swift', 'standard'].includes(format)) fail(400, 'invalid_format', '試合形式を選択してください。');
  if (!['hashimoto', 'hirakata', 'trc'].includes(mapId)) fail(400, 'invalid_map', 'マップを選択してください。');
  return { format, mapId, maxPlayers: 10 };
}

async function createRoom(request, db, now) {
  const body = await readBody(request);
  const name = cleanName(body.name);
  cleanTeam(body.team, 'blue');
  await cleanup(db, now);
  const token = randomHex(), tokenHash = await hashToken(token), id = crypto.randomUUID();
  const settings = JSON.stringify({ ...lobbySettings(body), lobbyRevision: 0 });
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = randomCode();
    try {
      // batch is transactional in D1: a room can never exist without its host.
      await db.batch([
        statement(db, 'INSERT INTO online_rooms (code, host_id, status, settings, created_at, expires_at, host_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)', code, id, 'lobby', settings, now, now + ROOM_TTL, now),
        statement(db, 'INSERT INTO online_members (id, room_code, token_hash, name, team, ready, joined_at, last_seen, left_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL)', id, code, tokenHash, name, 'blue', now, now),
      ]);
      return json({ ...(await publicRoom(db, { code, host_id: id, status: 'lobby', settings }, now)), memberId: id, token }, 201);
    } catch (error) {
      if (!/unique|constraint/i.test(String(error?.message))) throw error;
    }
  }
  fail(503, 'room_create_failed', '部屋を作れませんでした。もう一度お試しください。');
}
async function joinRoom(request, db, room, now) {
  requireOpen(room);
  if (room.status !== 'lobby') fail(409, 'match_started', 'この部屋は試合中です。');
  const body = await readBody(request), name = cleanName(body.name), team = cleanTeam(body.team);
  const token = randomHex(), id = crypto.randomUUID();
  // The capacity checks and insertion form one statement, including competing joins.
  const result = await statement(db, `INSERT INTO online_members (id, room_code, token_hash, name, team, ready, joined_at, last_seen, left_at)
    SELECT ?, ?, ?, ?, ?, 0, ?, ?, NULL WHERE EXISTS (SELECT 1 FROM online_rooms WHERE code = ? AND status = 'lobby' AND host_seen_at > ? AND expires_at > ?)
    AND (SELECT COUNT(*) FROM online_members WHERE room_code = ? AND left_at IS NULL) < 10
    AND (SELECT COUNT(*) FROM online_members WHERE room_code = ? AND team = ? AND left_at IS NULL) < 5`,
    id, room.code, await hashToken(token), name, team, now, now, room.code, now - HOST_TIMEOUT, now, room.code, room.code, team).run();
  if (!changed(result)) fail(409, 'room_full', '部屋またはチームが満員です。');
  return json({ ...(await publicRoom(db, room, now)), memberId: id, token }, 201);
}
async function setReady(request, db, room, member, now) {
  requireOpen(room);
  if (room.status !== 'lobby') fail(409, 'match_started', '試合中はチームを変更できません。');
  const body = await readBody(request);
  if (typeof body.ready !== 'boolean') fail(400, 'invalid_ready', '準備状態を指定してください。');
  const team = cleanTeam(body.team, member.team);
  if (member.id === room.host_id && team !== 'blue') fail(403, 'host_team_fixed', 'ホストはBLUEチームに固定です。');
  const result = await statement(db, `UPDATE online_members SET ready = ?, team = ? WHERE id = ? AND left_at IS NULL
    AND EXISTS (SELECT 1 FROM online_rooms WHERE code = ? AND status = 'lobby')
    AND (team = ? OR (SELECT COUNT(*) FROM online_members WHERE room_code = ? AND team = ? AND left_at IS NULL) < 5)`,
    body.ready ? 1 : 0, team, member.id, room.code, team, room.code, team).run();
  if (!changed(result)) fail(409, 'team_full', '選択したチームは満員です。');
  return json(await publicRoom(db, room, now));
}
async function configureRoom(request, db, room, member, now) {
  requireOpen(room);
  if (member.id !== room.host_id) fail(403, 'host_only', 'ホストだけがマップと試合形式を選択できます。');
  if (room.status !== 'lobby') fail(409, 'match_started', '試合中はマップと試合形式を変更できません。');
  const body = await readBody(request);
  // Both fields are required: delayed partial requests must not restore old settings.
  if (typeof body.format !== 'string' || typeof body.mapId !== 'string') fail(400, 'invalid_settings', 'マップと試合形式を選択してください。');
  const { format, mapId } = lobbySettings(body);
  const result = await statement(db, `UPDATE online_rooms SET settings = json_set(settings,
    '$.format', ?, '$.mapId', ?, '$.lobbyRevision', COALESCE(json_extract(settings, '$.lobbyRevision'), 0) + 1)
    WHERE code = ? AND status = 'lobby'`, format, mapId, room.code).run();
  if (!changed(result)) fail(409, 'match_started', '試合が開始または終了したため変更できません。');
  return json(await publicRoom(db, await roomByCode(db, room.code, now), now));
}
async function startRoom(request, db, room, member, now) {
  requireOpen(room);
  if (member.id !== room.host_id) fail(403, 'host_only', 'ホストだけが開始できます。');
  const body = await readBody(request);
  if (!['swift', 'standard'].includes(body.format)) fail(400, 'invalid_format', '試合形式を選択してください。');
  const mapId=body.mapId??JSON.parse(room.settings).mapId??'hashimoto';
  if(!['hashimoto','hirakata','trc'].includes(mapId))fail(400,'invalid_map','マップを選択してください。');
  const settings = JSON.stringify({ format: body.format, mapId, maxPlayers: 10 });
  const result = await statement(db, `UPDATE online_rooms SET status = 'playing', settings = ? WHERE code = ? AND status = 'lobby'
    AND (SELECT COUNT(*) FROM online_members WHERE room_code = ? AND left_at IS NULL) >= 2
    AND EXISTS (SELECT 1 FROM online_members WHERE room_code = ? AND team = 'blue' AND left_at IS NULL)
    AND EXISTS (SELECT 1 FROM online_members WHERE room_code = ? AND team = 'red' AND left_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM online_members WHERE room_code = ? AND left_at IS NULL AND (ready = 0 OR last_seen <= ?))`,
    settings, room.code, room.code, room.code, room.code, room.code, now - CONNECTED_TIMEOUT).run();
  if (!changed(result)) fail(409, 'not_ready', '両チームに参加し、全員が準備完了にしてください。');
  room.status = 'playing'; room.settings = settings;
  return json(await publicRoom(db, room, now));
}
async function sendMessage(request, db, room, member, now) {
  requireOpen(room);
  const body = await readBody(request);
  if (!['signal', 'game'].includes(body.kind) || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) fail(400, 'invalid_message', 'メッセージ形式が不正です。');
  const isHost = member.id === room.host_id;
  const data = JSON.stringify(body.data), size = encoder.encode(data).byteLength;
  const limitBytes = body.kind === 'signal' ? 32 * 1024 : isHost && body.data.type === 'snapshot' ? MAX_HOST_SNAPSHOT : 24 * 1024;
  if (size > limitBytes) fail(413, 'message_too_large', '送信データが大きすぎます。');
  const to = body.to === 'host' ? room.host_id : body.to;
  const teamRecipient = typeof to === 'string' && to.startsWith('team:');
  if (teamRecipient) {
    if (!isHost) fail(403, 'host_only', 'ホストだけがチームへ送信できます。');
    if (!['team:blue', 'team:red'].includes(to) || body.kind !== 'game' || body.data.type !== 'snapshot') fail(400, 'invalid_recipient', 'チームへは試合状態だけを送信できます。');
  }
  if (body.kind === 'game') {
    if (room.status !== 'playing') fail(409, 'match_not_started', '試合開始をお待ちください。');
    if (!isHost && to !== room.host_id) fail(403, 'host_only', '操作はホストへ送信してください。');
    if (to === 'all' && !isHost) fail(403, 'host_only', 'ホストだけが全員へ送信できます。');
  } else if (to === 'all') fail(400, 'invalid_recipient', '接続先を一人指定してください。');
  if (to !== 'all' && !teamRecipient) {
    if (typeof to !== 'string' || to.length > 64 || to === member.id) fail(400, 'invalid_recipient', '接続先が不正です。');
    const target = await statement(db, 'SELECT id FROM online_members WHERE id = ? AND room_code = ? AND left_at IS NULL', to, room.code).first();
    if (!target) fail(404, 'recipient_not_found', '接続先が退出しています。');
  }
  // More than the documented 5 Hz fallback is allowed for batching/jitter, but
  // a participant cannot grow the queue without bound or flood its peers.
  const limit = body.kind === 'signal' ? 40 : 12;
  const result = await statement(db, `INSERT INTO online_messages (room_code, sender_id, to_id, kind, data, created_at, expires_at)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM online_rooms WHERE code = ? AND status != 'closed')
    AND (SELECT COUNT(*) FROM online_messages WHERE room_code = ? AND sender_id = ? AND kind = ? AND created_at > ?) < ?`,
    room.code, member.id, to, body.kind, data, now, now + MESSAGE_TTL, room.code, room.code, member.id, body.kind, now - 1000, limit).run();
  if (!changed(result)) fail(429, 'rate_limited', '通信が混み合っています。少し待ってください。');
  // DELETE is indexed and bounded; reads also filter expiry even before cleanup.
  await statement(db, 'DELETE FROM online_messages WHERE seq IN (SELECT seq FROM online_messages WHERE expires_at <= ? ORDER BY expires_at LIMIT 100)', now).run();
  return json({ ok: true, seq: Number(result?.meta?.last_row_id ?? result?.lastRowId ?? 0) }, 201);
}
async function receiveMessages(db, room, member, now, url) {
  const raw = url.searchParams.get('after') ?? '0';
  if (!/^\d{1,16}$/.test(raw) || !Number.isSafeInteger(Number(raw))) fail(400, 'invalid_cursor', '通信の読み取り位置が不正です。');
  const after = Number(raw);
  const pending = rows(await statement(db, 'SELECT seq, sender_id, to_id, kind, data FROM online_messages WHERE room_code = ? AND seq > ? AND expires_at > ? ORDER BY seq LIMIT 100', room.code, after, now).all());
  // Advance only through rows actually fetched. A separate MAX(seq) query would
  // risk skipping a message inserted between the two reads.
  const cursor = pending.length ? pending[pending.length - 1].seq : after;
  const messages = pending.filter(m => m.sender_id !== member.id && (m.to_id === member.id || m.to_id === 'all' || m.to_id === `team:${member.team}`))
    .map(m => ({ seq: m.seq, from: m.sender_id, to: m.to_id, kind: m.kind, data: JSON.parse(m.data) }));
  return json({ messages, cursor, room: await publicRoom(db, room, now) });
}
async function leaveRoom(db, room, member, now) {
  const updates = [statement(db, 'UPDATE online_members SET left_at = ?, ready = 0 WHERE id = ? AND left_at IS NULL', now, member.id)];
  if (member.id === room.host_id) updates.push(statement(db, "UPDATE online_rooms SET status = 'closed' WHERE code = ?", room.code));
  await db.batch(updates);
  return json({ ok: true, closed: member.id === room.host_id });
}

export async function handleRooms(request, env) {
  try {
    if (!env?.DB) fail(503, 'storage_unavailable', 'オンライン機能を準備中です。');
    const url = new URL(request.url), path = url.pathname.replace(/\/$/, '');
    if (!path.startsWith('/api/rooms')) fail(404, 'not_found', '見つかりません。');
    checkOrigin(request);
    const now = Date.now();
    if (path === '/api/rooms') {
      if (request.method !== 'POST') fail(405, 'method_not_allowed', 'この操作には対応していません。');
      return await createRoom(request, env.DB, now);
    }
    const match = path.match(/^\/api\/rooms\/([A-Z2-9]{8})(?:\/(join|ready|settings|start|messages|leave))?$/i);
    if (!match) fail(404, 'not_found', '部屋のURLが不正です。');
    const code = match[1].toUpperCase(), action = match[2], room = await roomByCode(env.DB, code, now);
    if (action === 'join' && request.method === 'POST') return await joinRoom(request, env.DB, room, now);
    const member = await authenticate(request, env.DB, room, now);
    if (!action && request.method === 'GET') {
      const value = await publicRoom(env.DB, room, now);
      if (url.searchParams.get('resume') === '1') value.cursor = (await statement(env.DB, 'SELECT MAX(seq) AS seq FROM online_messages WHERE room_code = ?', room.code).first())?.seq || 0;
      return json(value);
    }
    if (action === 'messages' && request.method === 'GET') return await receiveMessages(env.DB, room, member, now, url);
    if (action === 'ready' && request.method === 'POST') return await setReady(request, env.DB, room, member, now);
    if (action === 'settings' && request.method === 'POST') return await configureRoom(request, env.DB, room, member, now);
    if (action === 'start' && request.method === 'POST') return await startRoom(request, env.DB, room, member, now);
    if (action === 'messages' && request.method === 'POST') return await sendMessage(request, env.DB, room, member, now);
    if (action === 'leave' && request.method === 'POST') return await leaveRoom(env.DB, room, member, now);
    fail(405, 'method_not_allowed', 'この操作には対応していません。');
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.code, message: error.message }, error.status);
    // Database errors must not disclose schema, SQL text, names, or credentials.
    console.error('Online room operation failed', error?.name || 'Error');
    return json({ error: 'online_unavailable', message: '通信を完了できませんでした。もう一度お試しください。' }, 503);
  }
}
