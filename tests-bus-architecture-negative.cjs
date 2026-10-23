const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.join(__dirname,'public'),load=f=>import(pathToFileURL(path.join(root,f)).href),T=await load('vendor/three.module.js');global.document={createElement:()=>({getContext:()=>new Proxy({measureText:t=>({width:String(t).length*8})},{get:(o,k)=>o[k]||(()=>{})})})};
 const original=fs.readFileSync(path.join(root,'bus-destruction.js'),'utf8');
 async function probe(text,kind){
  const url='data:text/javascript;base64,'+Buffer.from(text).toString('base64');
  let source=fs.readFileSync(path.join(root,'hirakata-map.js'),'utf8');source=source.replace(/from '(\.\/[^']+)'/g,(_,f)=>'from '+JSON.stringify(f==='./bus-destruction.js'?url:pathToFileURL(path.join(root,f)).href));
  const {createHirakataMap}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),m=createHirakataMap(T,new T.Group()),d=m.destruction;
  if(kind==='strict mask'){assert.equal(d.restore('0'.repeat(66),1),false);return;}
  const p=kind==='ramp support'?{x:-58,z:37,yaw:0}:{x:8,z:9,yaw:0};d.breakAt(p,p,1);
  if(kind==='collision')assert.equal(m.collision.blocked(8,9,.34,0),false);
  if(kind==='ramp support')assert.equal(m.ramps.some(r=>p.x>r.minX&&p.x<r.maxX&&p.z>r.minZ&&p.z<r.maxZ),false);
  if(kind==='visible geometry'){const g=d.groups.find(g=>g.structural&&g.parts.length&&g.parts.every(p=>p.batch.mesh.userData.busBrokenInstances?.has(p.index)));assert.ok(g);const p=g.parts[0],matrix=new T.Matrix4();p.batch.mesh.getMatrixAt(p.index,matrix);assert.equal(matrix.determinant(),0);}
 }
 for(const [kind,anchor,change]of[['collision','!removed.has(c)','true'],['ramp support','!removedRamps.has(r)','true'],['visible geometry','on?p.matrix:zero','p.matrix'],['strict mask','![width,22].includes(mask.length)','false']]){
  assert.ok(original.includes(anchor),kind);await probe(original,kind);await assert.rejects(()=>probe(original.replace(anchor,change),kind),{code:'ERR_ASSERTION'});console.log('PASS detects missing '+kind+' contract');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
