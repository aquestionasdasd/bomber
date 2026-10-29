// Read-only wake signal. No request prose, IDs, URLs or author data leave D1.
const KEY = '084e8ef294ede3252ff31e7c0b341979bda5f3028064129b743900e4abb10f92';
const TARGET = 'https://bd3do-discord-requests.ohuraharah.chatgpt.site/api/wake';
const HASH = /^[a-f0-9]{64}$/;
const json = (value: unknown, status = 200) => Response.json(value, {status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
}});
const hex = (value: string) => Uint8Array.from(value.match(/../g) ?? [], x => parseInt(x, 16));
export async function handleWake(request: Request, db: D1Database | undefined, publicKey = KEY, now = Date.now()): Promise<Response> {
  if (request.method !== 'POST') return json({}, 405);
  if (request.url !== TARGET) return json({}, 400);
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json' || request.headers.has('Content-Encoding')) return json({}, 415);
  const length = request.headers.get('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 256)) return json({}, 413);
  const timestamp = request.headers.get('X-BD3DO-Timestamp'), signature = request.headers.get('X-BD3DO-Signature');
  if (!timestamp || !/^\d{10,11}$/.test(timestamp) || Math.abs(now - Number(timestamp) * 1000) > 300000 || !signature || !/^[a-f0-9]{128}$/.test(signature)) return json({}, 401);
  const reader = request.body?.getReader();
  if (!reader) return json({}, 400);
  const timer = setTimeout(() => {void reader.cancel().catch(() => undefined);}, 1800);
  try {
    const chunks: Uint8Array[] = []; let size = 0; const started = Date.now();
    while (true) {
      const part = await reader.read();
      if (Date.now() - started >= 1800) return json({}, 413);
      if (part.done) break;
      size += part.value.length;
      if (size > 256) {await reader.cancel(); return json({}, 413);}
      chunks.push(part.value);
    }
    const raw = new Uint8Array(size); let at = 0;
    for (const chunk of chunks) {raw.set(chunk, at); at += chunk.length;}
    const prefix = new TextEncoder().encode(`BD3DO_WAKE_V1\n${TARGET}\n${timestamp}\n`);
    const signed = new Uint8Array(prefix.length + raw.length); signed.set(prefix); signed.set(raw, prefix.length);
    const key = await crypto.subtle.importKey('raw', hex(publicKey), 'Ed25519', false, ['verify']);
    if (!await crypto.subtle.verify('Ed25519', key, hex(signature), signed)) return json({}, 401);
    let value: unknown;
    try {value = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(raw));} catch {return json({}, 400);}
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'nonce,version' ||
      !('version' in value) || value.version !== 1 || !('nonce' in value) || typeof value.nonce !== 'string' || !HASH.test(value.nonce)) return json({}, 400);
    if (!db) return json({}, 503);
    const result = await db.prepare("SELECT id,content_hash FROM discord_requests WHERE status='queued' AND received_at>=? ORDER BY received_at,id LIMIT 201")
      .bind(now - 30 * 86400000).all<{id: string; content_hash: string}>();
    const rows = result.results;
    if (!Array.isArray(rows) || rows.length > 200 || rows.some(r => !/^[1-9][0-9]{16,19}$/.test(r.id) || !HASH.test(r.content_hash))) return json({}, 503);
    const digest = rows.length ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(rows.map(r => [r.id, r.content_hash])))) : null;
    const fingerprint = digest ? [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('') : null;
    return json({version: 1, nonce: value.nonce, pending: rows.length > 0, fingerprint});
  } catch {return json({}, 503);}
  finally {clearTimeout(timer); reader.releaseLock();}
}
