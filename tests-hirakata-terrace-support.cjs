// The real shipped model and collision layout in silent Node/Three. This does
// not claim physical collision for decorative chairs or live gameplay/FPS QA.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');

async function main(){
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 const [T,{createHirakataMap},{createNavigation}]=await Promise.all([
  load('vendor/three.module.js'),load('hirakata-map.js'),load('navigation.js'),
 ]);
 const ctx=new Proxy({measureText:t=>({width:String(t).length*8})},{get:(o,k)=>o[k]||(()=>{})});
 global.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 const map=createHirakataMap(T,new T.Group()),nav=createNavigation(map);map.world.updateMatrixWorld(true);nav.updateTraffic(0);
 const terrace=map.destruction.groups.find(g=>g.id==='TSITE_terrace');assert.ok(terrace);
 const byMaterial=new Map(terrace.nodes.map(n=>[n.material.name,n]));
 const original={colliders:[...map.colliders],shapes:[...map.mapShapes],ramps:[...map.ramps]};
 const observations=[],failures=[];let groups=0;
 const check=(name,fn)=>{try{fn();groups++;console.log('PASS '+name);}catch(error){failures.push({name,error:error.message});console.error('FAIL '+name+': '+error.message);}};
 const near=(a,b,label,tolerance=.0001)=>assert.ok(Math.abs(a-b)<=tolerance,label+': '+a+' vs '+b);
 const visible=n=>{for(let p=n;p;p=p.parent)if(!p.visible||p.userData.busDebrisHidden||p.userData.bomberHidden)return false;return true;};
 const vertices=mesh=>{assert.ok(mesh);const pos=mesh.geometry.attributes.position,result=[];for(let i=0;i<pos.count;i++)result.push(new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld));return result;};
 const meshVertices=new Map([...byMaterial].map(([name,mesh])=>[name,vertices(mesh)]));
 const supported=(x,z)=>map.walkHeights(x,z).some(y=>Math.abs(y-6.4)<.0001);
 function downward(x,z,from,to,nodes){return new T.Raycaster(new T.Vector3(x,from,z),new T.Vector3(0,-1,0),0,from-to).intersectObjects(nodes,false).filter(h=>visible(h.object));}
 const tableCentres=[{x:16,z:65},{x:16,z:72},{x:14,z:57}];
 function feet({x,z}){return [{x,z},...[-1,1].flatMap(dx=>[-.22,.22].map(sx=>({x:x+dx+sx,z:z+.18}))),...[-.22,.22].map(sx=>({x:x+sx,z:z-.72}))];}
 check('all three actual table/pole and six chair-foot contacts have floor support',()=>{
  const actualFeet=[...meshVertices.get('steel'),...meshVertices.get('white')].filter(p=>p.y>=6.36&&p.y<=6.44);
  assert.ok(actualFeet.length>100,'actual leg and pole vertices must exist');
  for(const p of actualFeet)assert.ok(supported(p.x,p.z),'unsupported actual foot '+JSON.stringify(p));
  const contacts=tableCentres.flatMap(feet);assert.equal(contacts.length,21);
  for(const p of contacts){
   assert.ok(supported(p.x,p.z),'contact has 6.4m floor '+JSON.stringify(p));
   assert.ok(actualFeet.some(v=>Math.hypot(v.x-p.x,v.z-p.z)<.075),'actual foot geometry at '+JSON.stringify(p));
  }
  for(const p of tableCentres){
   const top=downward(p.x+.25,p.z,7.5,7,terrace.nodes).find(h=>h.object.material.name==='white');
   assert.ok(top,'tabletop geometry '+JSON.stringify(p));near(top.point.y,7.18,'supported tabletop');
   const shade=downward(p.x,p.z,9.6,8.8,terrace.nodes).find(h=>h.object.material.name==='ivory');
   assert.ok(shade,'parasol above supported pole '+JSON.stringify(p));near(shade.point.y,9.35,'parasol apex');
  }
  observations.push({kind:'furniture',contactCount:contacts.length,actualFootVertices:actualFeet.length,tableCentres});
 });
 check('every circular paving vertex is on supported floor and nearly flush with its rendered tile',()=>{
  const ring=meshVertices.get('blue');assert.ok(ring.length>500,'all four authored rings retained');
  for(const p of ring){assert.ok(supported(p.x,p.z),'unsupported paving vertex '+JSON.stringify(p));near(p.y,6.416,'paving height');}
  const box=new T.Box3().setFromObject(byMaterial.get('blue'));
  near(box.min.x,11.1,'ring west extent');near(box.max.x,16.9,'ring east extent');near(box.min.z,54.1,'ring north extent');near(box.max.z,59.9,'ring south extent');
  const floorNodes=map.destruction.groups.find(g=>g.id==='South_pedestrian_deck').nodes;
  const floorHits=[];let tileSamples=0;
  for(let i=0;i<ring.length;i+=Math.max(1,Math.floor(ring.length/40))){
   const p=ring[i],hit=downward(p.x,p.z,6.43,6.35,floorNodes)[0];assert.ok(hit,'rendered floor under paving');
   // Narrow tile joints expose the structural slab at6.4m instead of6.412m.
   const gap=p.y-hit.point.y;assert.ok(gap>=-.001&&gap<=.017,'paving floor gap '+gap);
   if(Math.abs(hit.point.y-6.412)<.0001)tileSamples++;
   floorHits.push({x:p.x,z:p.z,floorY:hit.point.y,gap});
  }
  assert.ok(tileSamples>10,'representative samples hit actual6.412m tile faces');
  observations.push({kind:'paving',vertices:ring.length,tileSamples,floorHits});
 });
 check('old stair-void furniture and unsupported ring geometry are gone without adding a false floor',()=>{
  for(const name of ['steel','white','ivory','blue']){
   const old=meshVertices.get(name).filter(p=>p.x>=12&&p.x<=20&&p.z>=84&&p.z<=92);
   assert.equal(old.length,0,'remaining floating '+name+' vertices');
  }
  assert.equal(supported(16,86),false,'old furniture location remains the open stair/ground void');
  assert.equal(supported(15,88),false,'old paving centre remains below the deck');
  observations.push({kind:'oldLocations',tableFloorHeights:map.walkHeights(16,86),ringFloorHeights:map.walkHeights(15,88)});
 });
 check('relocated terrace furniture disappears and returns with its existing destruction group',()=>{
  const bytes=Buffer.alloc(Math.ceil(map.destruction.groups.length/8));bytes[terrace.index>>3]|=1<<(terrace.index&7);const mask=bytes.toString('hex');
  assert.ok(downward(14.25,57,7.5,7,terrace.nodes).length,'table initially visible');
  assert.ok(downward(15.02,57,6.43,6.41,[byMaterial.get('blue')]).length,'ring initially visible');
  assert.equal(map.destruction.restore(mask,2),true);
  try{
   for(const node of terrace.nodes){assert.equal(node.visible,false);assert.equal(node.userData.busDebrisHidden,true);}
   assert.equal(downward(14.25,57,7.5,7,terrace.nodes).length,0);
   assert.equal(downward(15.02,57,6.43,6.41,[byMaterial.get('blue')]).length,0);
   for(const c of terrace.colliders)assert.ok(!map.colliders.includes(c));
   for(const shape of terrace.shapes)assert.ok(!map.mapShapes.includes(shape));
   for(const p of tableCentres.flatMap(feet))assert.ok(supported(p.x,p.z),'independent deck remains');
  }finally{map.destruction.reset();}
  assert.deepEqual(map.colliders,original.colliders);assert.deepEqual(map.mapShapes,original.shapes);assert.deepEqual(map.ramps,original.ramps);
  for(const node of terrace.nodes){assert.equal(node.visible,true);assert.ok(!node.userData.busDebrisHidden);}
  assert.ok(downward(14.25,57,7.5,7,terrace.nodes).length);assert.ok(downward(15.02,57,6.43,6.41,[byMaterial.get('blue')]).length);
  observations.push({kind:'destruction',index:terrace.index,mask});
 });
 check('the existing stair opening and two-way landing route remain supported and clear',()=>{
  const legs=[{x:15,z:91,y:0},{x:15,z:72,y:6.4},{x:8,z:72,y:6.4},{x:15,z:72,y:6.4},{x:15,z:91,y:0}];
  for(let i=1;i<legs.length;i++){
   const a=legs[i-1],b=legs[i];assert.ok(nav.clearSegment(a.x,a.z,b.x,b.z,a.y,b.y),'stair/deck direct route '+i);
   const points=nav.path(a.x,a.z,b.x,b.z,a.y,b.y);assert.ok(points.length,'route '+i);let previous=a;
   for(const p of points){assert.ok(nav.clearSegment(previous.x,previous.z,p.x,p.z,previous.y,p.y),'route edge '+i);previous=p;}
   near(previous.x,b.x,'route x',.025);near(previous.z,b.z,'route z',.025);near(previous.y,b.y,'route height',.025);
  }
  const ramp=map.ramps.find(r=>r.id==='South_pedestrian_deck stair 7');assert.ok(ramp);
  assert.ok(map.walkHeights(15,78.25).some(h=>Math.abs(h-4.7)<.025),'stair floor remains below upper deck');
  assert.ok(!supported(15,78.25),'no replacement slab over the stair shaft');
  observations.push({kind:'stair',legs:legs.length-1});
 });
 const report={created:new Date().toISOString(),groups,failures,observations,audio:false,browser:false,scope:'Real shipped render/collision/navigation/destruction; decorative furniture collision is not added or claimed'};
 if(process.env.TERRACE_REPORT)fs.writeFileSync(process.env.TERRACE_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({groups,failures,audio:false,browser:false}));assert.equal(failures.length,0,'terrace support checks failed');
}
main().catch(error=>{console.error(error);process.exitCode=1});
