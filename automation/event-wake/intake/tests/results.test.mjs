import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleResult,statusText} from '../lib/results.ts';
const target='https://bd3do-discord-requests.ohuraharah.chatgpt.site/api/results';
const now=Date.now(),id='1565221080652578816',author='1565151198342811728',hash='a'.repeat(64);
const pair=generateKeyPairSync('ed25519');
const publicKey=pair.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex');
const receipt=(change={})=>({version:1,id,contentHash:hash,status:'held',reason:'needs_isolation',sourceCommit:null,sharedCommit:null,deploymentId:null,...change});
function request(value,{timestamp=Math.floor(now/1000),key=pair.privateKey,url=target,raw,headers={}}={}) {
  const body=raw??Buffer.from(JSON.stringify(value));
  const signature=sign(null,Buffer.concat([Buffer.from(`BD3DO_RESULT_V1\n${target}\n${timestamp}\n`),body]),key).toString('hex');
  return new Request(url,{method:'POST',headers:{'Content-Type':'application/json','X-BD3DO-Timestamp':String(timestamp),'X-BD3DO-Signature':signature,...headers},body});
}
function db() {
  const sql=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  sql.prepare('INSERT INTO discord_requests VALUES (?,?,?,?,?,?,?,?,?)').run(id,'961288614959018014','1565148657840427018',author,'ui','接続確認のテストです',hash,now,'pending_review');
  class Statement {constructor(query,args=[]){this.query=query;this.args=args;}bind(...args){return new Statement(this.query,args);}async first(){return sql.prepare(this.query).get(...this.args)??null;}}
  return {sql,prepare:q=>new Statement(q),async batch(statements){sql.exec('BEGIN');try{const result=statements.map(s=>({meta:{changes:sql.prepare(s.query).run(...s.args).changes}}));sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
}
async function withDb(fn){const database=db();try{await fn(database);}finally{database.sql.close();}}
const call=(value,database,options={})=>handleResult(request(value,options),database,publicKey,now);
test('signed terminal receipt changes only pinned existing ticket and is idempotent/immutable',()=>withDb(async database=>{
  const value=receipt();assert.equal((await call(value,database)).status,200);
  assert.equal(database.sql.prepare('SELECT status FROM discord_requests').get().status,'held');
  assert.equal((await call(value,database)).status,200);
  assert.equal((await call(receipt({reason:'needs_review'}),database)).status,409);
  assert.equal(database.sql.prepare('SELECT reason FROM discord_request_results').get().reason,'needs_isolation');
  assert.equal(database.sql.prepare('SELECT description FROM discord_requests').get().description,'接続確認のテストです');
}));
test('forged/wrong-key/stale/tampered/reused-foreign-target receipts cannot write',()=>withDb(async database=>{
  const value=receipt();
  for(const options of [{key:generateKeyPairSync('ed25519').privateKey},{timestamp:Math.floor(now/1000)-301},
    {headers:{'X-BD3DO-Signature':'0'.repeat(128)}},{url:target+'?anything=1'},
    {url:'https://evil.invalid/api/results'}])assert.notEqual((await call(value,database,options)).status,200);
  assert.equal(database.sql.prepare('SELECT count(*) n FROM discord_request_results').get().n,0);
}));
test('only original content hash/id, exact schema and status/proof combinations are accepted',()=>withDb(async database=>{
  for(const value of [receipt({id:'1565221080652578800'}),receipt({contentHash:'b'.repeat(64)}),receipt({extra:'ignored'}),
    receipt({reason:'<script>alert(1)</script>'}),receipt({status:'published',reason:'published'}),
    receipt({sourceCommit:'b'.repeat(40)}),receipt({status:'failed',reason:'no_change'})])assert.notEqual((await call(value,database)).status,200);
  assert.equal(database.sql.prepare('SELECT count(*) n FROM discord_request_results').get().n,0);
}));
test('publication requires both commits and deployment ID; response exposes no private request text',()=>withDb(async database=>{
  const value=receipt({status:'published',reason:'published',sourceCommit:'b'.repeat(40),sharedCommit:'c'.repeat(40),deploymentId:'appgdep_'+'d'.repeat(32)});
  const response=await call(value,database);assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true,id,status:'published'});
  assert.match(await statusText(database,id,author),/GitHubと公開版へ反映/);
  assert.match(await statusText(database,id,author),/hashimoto-protocol-north-exit/);
}));
test('status lookup is author-only, pending/held/test safe guidance; expiration cascades receipts',()=>withDb(async database=>{
  assert.match(await statusText(database,id,author),/確認待ち/);
  assert.equal(await statusText(database,id,'99999999999999999'),'自分の受付番号を確認してください。');
  assert.equal((await call(receipt({status:'test_received',reason:'connection_test'}),database)).status,200);
  assert.match(await statusText(database,id,author),/ゲームは変更していません/);
  database.sql.prepare('DELETE FROM discord_requests WHERE id=?').run(id);
  assert.equal(database.sql.prepare('SELECT count(*) n FROM discord_request_results').get().n,0);
}));
test('body/encoding/size and DB failure are bounded and fail closed',async()=>{
  for(const [options,status] of [[{headers:{'Content-Type':'text/plain'}},415],[{headers:{'Content-Encoding':'gzip'}},415],
    [{raw:Buffer.alloc(4097)},413],[{raw:Buffer.from([255])},400]])assert.equal((await call(receipt(),undefined,options)).status,status);
  assert.equal((await call(receipt(),undefined)).status,503);
  assert.equal((await call(receipt(),{prepare(){throw Error('DO_NOT_ECHO_SECRET');}})).status,503);
});
