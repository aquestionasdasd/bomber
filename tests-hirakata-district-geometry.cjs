// Durable geometry audit of the reviewed Blender vertical-edge bevel pass.
// The manifest contains the previous source payloads, not a private workspace
// path or a dependency on retained Git history. No browser or GPU is involved.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gunzipSync}=require('node:zlib');
const {pathToFileURL}=require('node:url');
const baseline=require('./tests-hirakata-district-manifest.json');
const digest=b=>createHash('sha256').update(b).digest('hex');
const EPS=.00006; // Float32 world coordinates, at most 0.06 mm tolerance.
const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const bytesPerComponent={5121:1,5123:2,5125:4,5126:4};
function glb(raw){
 assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
 const n=raw.readUInt32LE(12);assert.equal(raw.readUInt32LE(16),0x4e4f534a);assert.equal(raw.readUInt32LE(24+n),0x004e4942);
 const doc=JSON.parse(raw.subarray(20,20+n)),bin=raw.subarray(28+n);
 function accessor(id){
  const a=doc.accessors[id],view=doc.bufferViews[a.bufferView],size=bytesPerComponent[a.componentType]*components[a.type];
  assert.ok(size);assert.ok(!view.byteStride||view.byteStride===size);assert.equal(a.sparse,undefined);
  const start=(view.byteOffset||0)+(a.byteOffset||0),bytes=bin.subarray(start,start+a.count*size);assert.equal(bytes.length,a.count*size);
  return {componentType:a.componentType,type:a.type,count:a.count,sha256:digest(bytes),bytes};
 }
 return {doc,accessor};
}
function descriptor(data){const {bytes,...meta}=data;return meta;}
function floats(bytes){return Array.from({length:bytes.length/4},(_,i)=>bytes.readFloatLE(i*4));}
function points(data){const a=floats(data.bytes);return Array.from({length:data.count},(_,i)=>a.slice(i*3,i*3+3));}
function indices(data){const width=bytesPerComponent[data.componentType];return Array.from({length:data.count},(_,i)=>width===2?data.bytes.readUInt16LE(i*2):data.bytes.readUInt32LE(i*4));}
function unpack(data){const bytes=gunzipSync(Buffer.from(data.gzipBase64,'base64'));assert.equal(digest(bytes),data.sha256,'manifest payload integrity');return {...data,bytes};}
const pointKey=p=>p.map(x=>Math.round(x*1e5)).join(',');
function triangles(vertices,ix){const out=new Map();for(let i=0;i<ix.length;i+=3){const ps=ix.slice(i,i+3).map(v=>vertices[v]);const key=ps.map(pointKey).sort().join(';');const entry=out.get(key);if(entry)entry.count++;else out.set(key,{count:1,ps});}return out;}
function delta(a,b){const result=[];for(const[key,v]of a){const count=v.count-(b.get(key)?.count||0);if(count>0)result.push({...v,count});}return result;}
function local(p,b){const dx=p[0]-b.center[0],dy=-p[2]-b.center[1],c=Math.cos(b.angle),s=Math.sin(b.angle);return[dx*c+dy*s,-dx*s+dy*c,p[1]-b.center[2]];}
function world(p,b){const c=Math.cos(b.angle),s=Math.sin(b.angle);return[b.center[0]+p[0]*c-p[1]*s,b.center[2]+p[2],-(b.center[1]+p[0]*s+p[1]*c)];}
function onBoxFace(ps,box,beveled){
 const p=ps.map(v=>local(v,box)),[hx,hy,hz]=box.dimensions.map(v=>v/2),b=beveled?box.width:0;
 if(p.some(q=>Math.abs(q[0])>hx+EPS||Math.abs(q[1])>hy+EPS||Math.abs(q[2])>hz+EPS||Math.abs(q[0])+Math.abs(q[1])>hx+hy-b+EPS))return false;
 // Every changed triangle must be coplanar with an original rectangular side
 // or one of the four newly cut vertical planes, never an internal wedge.
 for(const[axis,h]of [[0,hx],[1,hy],[2,hz]])for(const sign of [-1,1])if(p.every(q=>Math.abs(q[axis]-sign*h)<=EPS))return true;
 if(beveled)for(const sx of [-1,1])for(const sy of [-1,1])if(p.every(q=>Math.abs(sx*q[0]+sy*q[1]-(hx+hy-b))<=EPS))return true;
 return false;
}
function expectedCorners(box){const[hx,hy,hz]=box.dimensions.map(v=>v/2),b=box.width;return[-hz,hz].flatMap(z=>[[-hx+b,-hy],[hx-b,-hy],[hx,-hy+b],[hx,hy-b],[hx-b,hy],[-hx+b,hy],[-hx,hy-b],[-hx,-hy+b]].map(([x,y])=>world([x,y,z],box)));}
function pointIndex(ps){const grid=new Map(),cell=p=>p.map(x=>Math.floor(x/.001));for(const p of ps){const k=cell(p).join(',');if(!grid.has(k))grid.set(k,[]);grid.get(k).push(p);}return p=>{const c=cell(p);for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const q of grid.get([c[0]+x,c[1]+y,c[2]+z].join(','))||[])if(Math.hypot(...q.map((v,i)=>v-p[i]))<=EPS)return true;return false;};}
function bounds(ps){return[0,1,2].map(i=>[Math.min(...ps.map(p=>p[i])),Math.max(...ps.map(p=>p[i]))]);}
function verifyChanged(oldPrimitive,newPrimitive,boxes,read,name){
 assert.equal(newPrimitive.mode??4,oldPrimitive.mode);assert.equal(newPrimitive.material,oldPrimitive.material);
 const oldPos=points(unpack(oldPrimitive.attributes.POSITION)),oldIx=indices(unpack(oldPrimitive.indices)),newPos=points(read(newPrimitive.attributes.POSITION)),newIx=indices(read(newPrimitive.indices));
 assert.equal(newIx.length-oldIx.length,boxes.length*16*3,name+' expected one-segment bevel triangle increment');
 assert.ok(newPos.every(p=>p.every(Number.isFinite)));const oldBounds=bounds(oldPos),newBounds=bounds(newPos);
 for(let i=0;i<3;i++)for(let k=0;k<2;k++)assert.ok(Math.abs(newBounds[i][k]-oldBounds[i][k])<=EPS,name+' exterior AABB retained');
 const oldTriangles=triangles(oldPos,oldIx),newTriangles=triangles(newPos,newIx),added=delta(newTriangles,oldTriangles),removed=delta(oldTriangles,newTriangles);
 assert.ok(added.length&&removed.length,name+' actually changed');
 for(const t of removed)assert.ok(boxes.some(b=>onBoxFace(t.ps,b,false)),name+' removed triangle lies on an approved original box: '+JSON.stringify(t.ps));
 for(const t of added)assert.ok(boxes.some(b=>onBoxFace(t.ps,b,true)),name+' added triangle lies on the bounded bevel surface: '+JSON.stringify(t.ps));
 const has=pointIndex(newPos);
 for(const box of boxes)for(const p of expectedCorners(box))assert.ok(has(p),name+' retains all expected top/bottom chamfer corners: '+JSON.stringify(p));
 return {added:added.reduce((n,t)=>n+t.count,0),removed:removed.reduce((n,t)=>n+t.count,0)};
}
async function main(){
 const {HIRAKATA_MODEL_BASE64}=await import(pathToFileURL(path.join(__dirname,'public/assets/hirakata-complete-model.js')).href),raw=Buffer.from(HIRAKATA_MODEL_BASE64,'base64'),{doc,accessor}=glb(raw);
 let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
 check('audited asset and collision layout match the reviewed persistent source contract',()=>{
  assert.equal(digest(raw),baseline.reviewedGlbSha256);assert.equal(raw.length,15247708);
  const layout=fs.readFileSync(path.join(__dirname,'public/hirakata-complete-layout.js'),'utf8').replace(/\r\n/g,'\n');
  assert.equal(digest(Buffer.from(layout)),baseline.layoutSha256,'collision layout remains the prior Git blob, independent of checkout line endings');
 });
 check('all node/material/scene tables and mesh names/order are identical',()=>{
  assert.equal(doc.nodes.length,431);assert.equal(doc.meshes.length,394);assert.equal(doc.materials.length,32);
  assert.deepEqual(doc.nodes,baseline.nodes);assert.deepEqual(doc.materials,baseline.materials);assert.deepEqual(doc.scenes,baseline.scenes);assert.equal(doc.scene??0,baseline.scene);
  assert.deepEqual(doc.meshes.map(m=>m.name),baseline.meshNames);
 });
 check('294 protected meshes keep every attribute and index byte exactly',()=>{
  assert.equal(Object.keys(baseline.protectedMeshes).length,294);
  for(const[name,primitives]of Object.entries(baseline.protectedMeshes)){
   const mesh=doc.meshes.find(m=>m.name===name);assert.equal(mesh.primitives.length,primitives.length,name);
   mesh.primitives.forEach((p,i)=>{const expected=primitives[i];assert.equal(p.material,expected.material);assert.equal(p.mode??4,expected.mode);assert.deepEqual(Object.keys(p.attributes).sort(),Object.keys(expected.attributes).sort());for(const[k,id]of Object.entries(p.attributes))assert.deepEqual(descriptor(accessor(id)),expected.attributes[k],name+' '+k);assert.deepEqual(descriptor(accessor(p.indices)),expected.indices,name+' indices');});
  }
  // High-risk prior fixes are explicitly protected, rather than merely part
  // of a count: terrace furniture and every staircase mesh stay byte-identical.
  const protectedNames=Object.keys(baseline.protectedMeshes);
  for(const material of ['white','steel','ivory','blue'])assert.ok(protectedNames.includes('TSITE_terrace / '+material));
  assert.ok(protectedNames.filter(n=>/Stair/i.test(n)).length>0);
 });
 const boxesByName=new Map();for(const b of baseline.bevelBoxes){const name=b.group+' / '+b.material;if(!boxesByName.has(name))boxesByName.set(name,[]);boxesByName.get(name).push(b);}
 check('only the 1,430 reviewed opaque boxes receive <=2 cm vertical one-segment bevels',()=>{
  assert.equal(baseline.bevelBoxes.length,1430);assert.equal(new Set(baseline.bevelBoxes.map(b=>b.group)).size,25);assert.equal(boxesByName.size,100);
  assert.deepEqual([...boxesByName.keys()].sort(),Object.keys(baseline.changedBaseline).sort());
  for(const b of baseline.bevelBoxes){assert.equal(b.axis,'vertical');assert.equal(b.segments,1);assert.ok(b.dimensions[0]>=.08&&b.dimensions[1]>=.08&&b.dimensions[2]>=.2);assert.ok(b.width>0&&b.width<=.02);assert.ok(Math.abs(b.width-Math.min(.02,Math.min(...b.dimensions.slice(0,2))*.06))<1e-10);assert.ok(!/Stair|Vehicles|North_stationary_buses|TSITE_terrace/i.test(b.group));assert.equal(b.afterTriangles-b.beforeTriangles,16);}
 });
 let added=0,removed=0;
 check('changed triangles stay on each approved box surface and preserve every contact plane',()=>{
  for(const[name,primitives]of Object.entries(baseline.changedBaseline)){
   const mesh=doc.meshes.find(m=>m.name===name);assert.equal(primitives.length,1);assert.equal(mesh.primitives.length,1);
   const result=verifyChanged(primitives[0],mesh.primitives[0],boxesByName.get(name),accessor,name);added+=result.added;removed+=result.removed;
  }
 });
 check('triangle growth is the bounded bevel budget, with no topology or material additions',()=>{
  const triangles=doc.meshes.reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+accessor(p.indices).count/3,0),0);
  assert.equal(triangles,286644);assert.equal(triangles-baseline.beforeTriangles,22880);assert.equal(added-removed,22880);assert.ok((triangles-baseline.beforeTriangles)/baseline.beforeTriangles<=.1);
 });
 check('the surface validator rejects displaced, enlarged, sloped and over-cut samples',()=>{
  const box={center:[0,0,0],dimensions:[2,2,2],angle:0,width:.02};
  assert.equal(onBoxFace([[1,1,.98],[1,-1,.98],[.5,0,1]],box,true),false,'triangle spanning bevel and side is not coplanar');
  assert.equal(onBoxFace([[1.03,1,0],[1.03,-1,0],[1.03,1,.5]],box,true),false,'outward displacement');
  assert.equal(onBoxFace([[1,1,1],[1,-1,1],[.98,1,1]],box,true),false,'uncut original corner');
  assert.equal(onBoxFace([[.97,1,1],[.97,-1,1],[1,1,.97]],box,true),false,'over-cut edge plane');
  assert.equal(onBoxFace([[.98,1,1],[.98,-1,1],[1,1,.98]],box,true),true,'exact vertical bevel plane');
 });
 console.log(JSON.stringify({checks,protectedMeshes:294,changedMeshes:100,boxes:1430,sourceTriangles:286644,addedTriangles:added,removedTriangles:removed,scope:'CPU-only raw GLB comparison against persistent baseline; no browser, GPU, audio or gameplay timing claim.'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
