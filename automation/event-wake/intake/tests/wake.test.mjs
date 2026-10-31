import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {handleWake} from '../lib/wake.ts';
const endpoint = 'https://bd3do-discord-requests.ohuraharah.chatgpt.site/api/wake';
const pair = generateKeyPairSync('ed25519'), now = Date.now(), nonce = 'e'.repeat(64);
const publicKey = pair.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex');
function request({value = {version:1,nonce}, timestamp = Math.floor(now/1000), key = pair.privateKey, url = endpoint, domain = 'BD3DO_WAKE_V1', headers = {}} = {}) {
  const body = JSON.stringify(value), signature = sign(null, Buffer.from(`${domain}\n${endpoint}\n${timestamp}\n${body}`), key).toString('hex');
  return new Request(url, {method:'POST', headers:{'Content-Type':'application/json','X-BD3DO-Timestamp':String(timestamp),'X-BD3DO-Signature':signature,...headers}, body});
}
function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE discord_requests(id TEXT,content_hash TEXT,status TEXT,received_at INTEGER,description TEXT,author_id TEXT)');
  return {sql, prepare(query) {let args = []; return {bind(...values) {args=values;return this;},async all(){return {results:sql.prepare(query).all(...args)};}};}};
}
test('signed empty and queued signals expose only opaque hash, never prose/IDs; reads never write', async () => {
  const db = database();
  try {
    assert.deepEqual(await (await handleWake(request(),db,publicKey,now)).json(),{version:1,nonce,pending:false,fingerprint:null});
    db.sql.prepare('INSERT INTO discord_requests VALUES (?,?,?,?,?,?)').run('1565234029626654701','a'.repeat(64),'queued',now,'PRIVATE_CONTENT','PRIVATE_AUTHOR');
    const r = await handleWake(request(),db,publicKey,now), body = await r.text();
    const signal = JSON.parse(body); assert.equal(signal.pending,true); assert.match(signal.fingerprint,/^[a-f0-9]{64}$/);
    assert.equal(Object.keys(signal).sort().join(','),'fingerprint,nonce,pending,version');
    assert.ok(!/PRIVATE|1565234/.test(body)); assert.equal(db.sql.prepare('SELECT count(*) n FROM discord_requests').get().n,1);
    assert.equal(r.headers.get('Cache-Control'),'no-store');
  } finally {db.sql.close();}
});
test('terminal, expired, foreign statuses never signal work; queue membership changes fingerprint', async () => {
  const db=database();
  try {
    const insert=db.sql.prepare('INSERT INTO discord_requests VALUES (?,?,?,?,?,?)');
    for(const status of ['published','held','failed','test_received','pending_review']) insert.run('1565234029626654701','a'.repeat(64),status,now,'private','private');
    insert.run('1565234029626654702','a'.repeat(64),'queued',now-31*86400000,'private','private');
    assert.equal((await (await handleWake(request(),db,publicKey,now)).json()).pending,false);
    insert.run('1565234029626654703','b'.repeat(64),'queued',now,'private','private');
    const first=(await (await handleWake(request(),db,publicKey,now)).json()).fingerprint;
    insert.run('1565234029626654704','c'.repeat(64),'queued',now,'private','private');
    assert.notEqual((await (await handleWake(request(),db,publicKey,now)).json()).fingerprint,first);
  } finally {db.sql.close();}
});
test('forged, stale, other-target and result-domain signatures cannot read D1', async () => {
  let touched=0; const db={prepare(){touched++;throw Error('private');}};
  for(const options of [{key:generateKeyPairSync('ed25519').privateKey},{timestamp:Math.floor(now/1000)-301},{url:endpoint+'?x=1'},
    {url:'https://evil.invalid/api/wake'},{domain:'BD3DO_RESULT_V1'},{headers:{'X-BD3DO-Signature':'0'.repeat(128)}}]) {
    assert.notEqual((await handleWake(request(options),db,publicKey,now)).status,200);
  }
  assert.equal(touched,0);
});
test('exact schema, bounded body and D1 errors fail closed without data', async () => {
  for(const options of [{value:{version:1,nonce,command:'private'}},{value:{version:1,nonce:'x'}},{value:{version:1,nonce:'a'.repeat(1000)}},
    {headers:{'Content-Encoding':'gzip'}},{headers:{'Content-Type':'text/plain'}}]) assert.notEqual((await handleWake(request(options),undefined,publicKey,now)).status,200);
  const response=await handleWake(request(),{prepare(){throw Error('PRIVATE');}},publicKey,now);
  assert.equal(response.status,503);assert.equal(await response.text(),'{}');
});
