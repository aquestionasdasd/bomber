const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.join(__dirname,'public'),T=await import(pathToFileURL(path.join(root,'vendor/three.module.js')).href),original=fs.readFileSync(path.join(root,'building-collapse.js'),'utf8');
 async function probe(source,kind){
  const {createBuildingCollapse}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const world=new T.Group(),mesh=new T.InstancedMesh(new T.BoxGeometry(2,4,2),new T.MeshBasicMaterial(),1),matrix=new T.Matrix4().makeTranslation(0,2,0);mesh.setMatrixAt(0,matrix);world.add(mesh);
  const map={world,colliders:[{height:4}],mapShapes:[{height:4}],ramps:[{height:4}],collision:{invalidate(){}}},fx=createBuildingCollapse(T,map);fx.start({time:10});
  if(kind==='actual collision')assert.equal(map.colliders.length,0);
  if(kind==='visible building'){mesh.getMatrixAt(0,matrix);assert.equal(matrix.determinant(),0);}
  if(kind==='floor support')assert.equal(map.ramps.length,0);
  if(kind==='next round restoration'){fx.reset();assert.equal(map.colliders.length,1);}
  fx.dispose();
 }
 for(const[kind,anchor,change]of[
  ['actual collision','map.colliders.length=0;',''],
  ['visible building','node.setMatrixAt(i,zero);',''],
  ['floor support','if(map.ramps)map.ramps.length=0;',''],
  ['next round restoration','...original.colliders','...[]']
 ]){assert.ok(original.includes(anchor),kind);await probe(original,kind);await assert.rejects(()=>probe(original.replace(anchor,change),kind),{code:'ERR_ASSERTION'});console.log('PASS detects missing '+kind);}
})().catch(e=>{console.error(e);process.exitCode=1;});
