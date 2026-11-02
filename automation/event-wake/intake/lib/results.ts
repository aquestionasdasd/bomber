// Public verification key only. The private key stays Windows-DPAPI protected
// outside the request processor and is never bound to this public Worker.
const PUBLIC_KEY='3c4c39a927c523f8821ebd5ce00618f06d6f2f6268cd7004fd964406d0662dd0';
const TARGET='https://bd3do-discord-requests.ohuraharah.chatgpt.site/api/results';
const GAME='https://hashimoto-protocol-north-exit.ohuraharah.chatgpt.site/';
const ID=/^[1-9][0-9]{16,19}$/;
const HASH=/^[0-9a-f]{64}$/;
const SHA=/^[0-9a-f]{40}$/;
export const resultReasons={
  published:'検証を通過し、GitHubと公開版へ反映しました。',
  connection_test:'接続確認が完了しました。ゲームは変更していません。',
  needs_isolation:'プログラム変更に必要な隔離環境の準備待ちです。',
  needs_review:'内容の確認が必要なため保留しました。',
  protected_spec:'所有者の指定と競合するため保留しました。',
  unsupported:'自動反映の対象範囲を超えるため保留しました。',
  no_change:'同じ内容が既に反映されています。',
  verification_failed:'検証を通過しなかったため公開を停止しました。',
  publication_failed:'公開処理が完了しなかったため停止しました。',
} as const;
type Reason=keyof typeof resultReasons;
export type Receipt={version:1;id:string;contentHash:string;status:'published'|'held'|'failed'|'test_received';
  reason:Reason;sourceCommit:string|null;sharedCommit:string|null;deploymentId:string|null};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hex=(text:string)=>Uint8Array.from(text.match(/../g)??[],b=>parseInt(b,16));
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function validate(value:unknown):value is Receipt {
  if(!record(value)||Object.keys(value).sort().join(',')!=='contentHash,deploymentId,id,reason,sharedCommit,sourceCommit,status,version'||
    value.version!==1||typeof value.id!=='string'||!ID.test(value.id)||BigInt(value.id)>18446744073709551615n||
    typeof value.contentHash!=='string'||!HASH.test(value.contentHash)||typeof value.reason!=='string'||!Object.hasOwn(resultReasons,value.reason))return false;
  if(value.status==='published')return value.reason==='published'&&typeof value.sourceCommit==='string'&&SHA.test(value.sourceCommit)&&
    typeof value.sharedCommit==='string'&&SHA.test(value.sharedCommit)&&typeof value.deploymentId==='string'&&/^appgdep_[0-9a-f]{32}$/.test(value.deploymentId);
  if(value.sourceCommit!==null||value.sharedCommit!==null||value.deploymentId!==null)return false;
  return value.status==='held'?['needs_isolation','needs_review','protected_spec','unsupported','no_change'].includes(value.reason):
    value.status==='failed'?['verification_failed','publication_failed'].includes(value.reason):
    value.status==='test_received'&&value.reason==='connection_test';
}
async function read(request:Request) {
  const reader=request.body?.getReader();if(!reader)return null;
  const chunks:Uint8Array[]=[];let size=0;const start=Date.now();
  const timer=setTimeout(()=>{void reader.cancel().catch(()=>undefined);},1800);
  try {while(true){const part=await reader.read();if(Date.now()-start>=1800)return null;if(part.done)break;
    size+=part.value.length;if(size>4096){await reader.cancel();return null;}chunks.push(part.value);}}
  finally {clearTimeout(timer);reader.releaseLock();}
  const raw=new Uint8Array(size);let at=0;for(const chunk of chunks){raw.set(chunk,at);at+=chunk.length;}return raw;
}
export async function handleResult(request:Request,db:D1Database|undefined,publicKey=PUBLIC_KEY,now=Date.now()):Promise<Response> {
  if(request.method!=='POST')return json({},405);
  if(request.url!==TARGET)return json({},400);
  if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json'||request.headers.has('Content-Encoding'))return json({},415);
  const length=request.headers.get('Content-Length');if(length&&(!/^\d+$/.test(length)||Number(length)>4096))return json({},413);
  try {
    const timestamp=request.headers.get('X-BD3DO-Timestamp'),signature=request.headers.get('X-BD3DO-Signature');
    if(!timestamp||!/^\d{10,11}$/.test(timestamp)||Math.abs(now-Number(timestamp)*1000)>300000||!signature||!/^[0-9a-f]{128}$/.test(signature))return json({},401);
    const raw=await read(request);if(!raw)return json({},413);
    const prefix=new TextEncoder().encode(`BD3DO_RESULT_V1\n${TARGET}\n${timestamp}\n`),signed=new Uint8Array(prefix.length+raw.length);
    signed.set(prefix);signed.set(raw,prefix.length);
    const key=await crypto.subtle.importKey('raw',hex(publicKey),'Ed25519',false,['verify']);
    if(!await crypto.subtle.verify('Ed25519',key,hex(signature),signed))return json({},401);
    let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{return json({},400);}
    if(!validate(value))return json({},400);
    if(!db)return json({},503);
    const ticket=await db.prepare('SELECT content_hash FROM discord_requests WHERE id = ?').bind(value.id).first<{content_hash:string}>();
    if(ticket?.content_hash!==value.contentHash)return json({},409);
    const receiptHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(b=>b.toString(16).padStart(2,'0')).join('');
    await db.batch([
      db.prepare(`INSERT INTO discord_request_results (request_id,content_hash,status,reason,source_commit,shared_commit,deployment_id,receipt_hash,recorded_at)
        SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM discord_requests WHERE id=? AND content_hash=?)
        ON CONFLICT(request_id) DO NOTHING`).bind(value.id,value.contentHash,value.status,value.reason,value.sourceCommit,value.sharedCommit,value.deploymentId,receiptHash,now,value.id,value.contentHash),
      db.prepare(`UPDATE discord_requests SET status=? WHERE id=? AND content_hash=? AND EXISTS(
        SELECT 1 FROM discord_request_results WHERE request_id=? AND receipt_hash=?)`).bind(value.status,value.id,value.contentHash,value.id,receiptHash),
    ]);
    const stored=await db.prepare('SELECT receipt_hash FROM discord_request_results WHERE request_id=?').bind(value.id).first<{receipt_hash:string}>();
    return stored?.receipt_hash===receiptHash?json({ok:true,id:value.id,status:value.status}):json({},409);
  } catch {return json({},503);}
}
export async function statusText(db:D1Database,id:string,authorId:string):Promise<string> {
  const row=await db.prepare(`SELECT r.status,x.reason FROM discord_requests r LEFT JOIN discord_request_results x ON x.request_id=r.id
    WHERE r.id=? AND r.author_id=?`).bind(id,authorId).first<{status:string;reason:string|null}>();
  if(!row)return '自分の受付番号を確認してください。';
  const reason=row.reason&&Object.hasOwn(resultReasons,row.reason)?resultReasons[row.reason as Reason]:'安全条件と内容の確認待ちです。';
  return `受付番号 ${id}：${reason}${row.status==='published'?`\n${GAME}`:''}`;
}
