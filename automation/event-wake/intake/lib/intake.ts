import { discordConfig } from "./config.ts";
import { statusText } from './results.ts';

type Config = { applicationId: string; publicKey: string; guildId: string; channelId: string };
type RecordValue = Record<string, unknown>;
type Ticket = { id: string; authorId: string; kind: string; description: string;
  guildId: string; channelId: string };
const MAX_BODY = 16384;
const ID = /^[1-9][0-9]{16,19}$/;
const KINDS = new Set(["bug", "ui", "gameplay", "feature"]);
const record = (v: unknown): v is RecordValue => !!v && typeof v === "object" && !Array.isArray(v);
const validId = (v: unknown): v is string => typeof v === "string" && ID.test(v) && BigInt(v) <= 18446744073709551615n;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: {
  "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
} });
const reply = (content: string) => json({ type: 4, data: {
  content, flags: 64, tts: false, allowed_mentions: { parse: [] },
} });
function hexBytes(hex: string) {
  return Uint8Array.from(hex.match(/../g) ?? [], s => Number.parseInt(s, 16));
}
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let total = 0;
  const chunks: Uint8Array[] = [];
  const deadline = setTimeout(() => { void reader.cancel().catch(() => undefined); }, 1800);
  const started = Date.now();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (Date.now() - started >= 1800) return null;
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { clearTimeout(deadline); reader.releaseLock(); }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}
async function authenticated(request: Request, raw: Uint8Array<ArrayBuffer>, config: Config, now: number) {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature) || !timestamp || !/^[0-9]{10,11}$/.test(timestamp) ||
      Math.abs(now - Number(timestamp) * 1000) > 300000) return false;
  const stamp = new TextEncoder().encode(timestamp);
  const signed = new Uint8Array(stamp.length + raw.length);
  signed.set(stamp); signed.set(raw, stamp.length);
  const key = await crypto.subtle.importKey("raw", hexBytes(config.publicKey), "Ed25519", false, ["verify"]);
  return crypto.subtle.verify("Ed25519", key, hexBytes(signature), signed);
}
function extract(data: RecordValue, config: Config): Ticket | null {
  const member = data.member;
  const command = data.data;
  if (data.type !== 2 || data.guild_id !== config.guildId || data.channel_id !== config.channelId ||
      (data.context !== undefined && data.context !== 0) || data.user !== undefined || !validId(data.id) ||
      !record(member) || member.pending === true || !record(member.user) || member.user.bot === true ||
      !validId(member.user.id) || !record(command) || command.name !== "bd3do-request" || command.type !== 1 ||
      !Array.isArray(command.options) || command.options.length !== 2) return null;
  const options = command.options;
  if (!options.every(o => record(o) && o.type === 3 && ["kind", "description"].includes(String(o.name))) ||
      new Set(options.map(o => o.name)).size !== 2 || command.resolved !== undefined) return null;
  const kind = options.find(o => o.name === "kind")?.value;
  const description = options.find(o => o.name === "description")?.value;
  if (typeof kind !== "string" || !KINDS.has(kind) || typeof description !== "string" ||
      [...description].length > 800 || /[\p{Cc}\p{Cf}]/u.test(description.replace(/[\r\n\t]/g, ""))) return null;
  const text = description.normalize("NFC").trim();
  if ([...text].length < 5) return null;
  return { id: data.id, authorId: member.user.id, kind, description: text,
    guildId: config.guildId, channelId: config.channelId };
}
async function digest(ticket: Ticket) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(ticket)));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Intake never opens links, runs code, contacts GitHub/Sites or authorizes publication.
// The only durable fields come from extract(); continuation tokens are never stored/logged.
export async function handleInteraction(request: Request, db: D1Database | undefined,
  config: Config = discordConfig, now = Date.now()): Promise<Response> {
  if (request.method !== "POST") return json({}, 405);
  if (new URL(request.url).search) return json({}, 400);
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
      request.headers.has("Content-Encoding")) return json({}, 415);
  const size = request.headers.get("Content-Length");
  if (size && (!/^[0-9]+$/.test(size) || Number(size) > MAX_BODY)) return json({}, 413);
  try {
    const raw = await readBody(request);
    if (raw === null) return json({}, 413);
    if (!await authenticated(request, raw, config, now)) return json({}, 401);
    let value: unknown;
    try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); }
    catch { return json({}, 400); }
    if (!record(value) || value.application_id !== config.applicationId) return json({}, 403);
    if (value.type === 1) return json({ type: 1 });
    const ticket = extract(value, config);
    if (!ticket) return reply("指定チャンネルから、5〜800文字の本文で要望を送ってください。");
    if (!db) return json({}, 503);
    const statusId=/^状況 ([1-9][0-9]{16,19})$/.exec(ticket.description)?.[1];
    if(statusId)return reply(await statusText(db,statusId,ticket.authorId));
    const hash = await digest(ticket);
    const existing = await db.prepare("SELECT content_hash FROM discord_requests WHERE id = ?").bind(ticket.id)
      .first<{ content_hash: string }>();
    if (existing) return existing.content_hash === hash ? reply(`受付済みです。受付番号 ${ticket.id}`) :
      reply("同じ受付番号の内容変更は受け付けられません。");
    // The bounded INSERT and both rate limits are checked in one SQLite write statement.
    // D1 batch is transactional; expiration cannot race an unbounded append.
    const results = await db.batch([
      db.prepare("DELETE FROM discord_requests WHERE received_at < ?").bind(now - 30 * 86400000),
      db.prepare(`INSERT INTO discord_requests
        (id, guild_id, channel_id, author_id, kind, description, content_hash, received_at, status)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'queued'
        WHERE (SELECT COUNT(*) FROM discord_requests) < 200
          AND (SELECT COUNT(*) FROM discord_requests WHERE received_at > ?) < 10
          AND NOT EXISTS(SELECT 1 FROM discord_requests WHERE author_id = ? AND received_at > ?)
        ON CONFLICT(id) DO NOTHING`).bind(ticket.id, ticket.guildId, ticket.channelId, ticket.authorId,
        ticket.kind, ticket.description, hash, now, now - 3600000, ticket.authorId, now - 3600000),
    ]);
    if (results[1].meta.changes > 0) return reply(`受け付けました。受付番号 ${ticket.id}。安全条件の確認後に処理します。\n状況確認：同じコマンドのdescriptionに「状況 ${ticket.id}」と入力してください。`);
    const retry = await db.prepare("SELECT content_hash FROM discord_requests WHERE id = ?").bind(ticket.id)
      .first<{ content_hash: string }>();
    if (retry?.content_hash === hash) return reply(`受付済みです。受付番号 ${ticket.id}`);
    return reply("受付上限です。1人1時間1件・全体10件までです。時間をおいて送ってください。");
  } catch {
    // No request body, author, transient token, database contents or stack in logs.
    return json({}, 503);
  }
}
