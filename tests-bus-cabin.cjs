const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)));
 const T=await load('vendor/three.module.js'),{createBusModels}=await load('bus-traffic.js'),{busCabinRayClear}=await load('bus-cabin.js'),{busPoint}=await load('bus-service.js');
 global.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
 let groups=0;const check=(label,fn)=>{fn();groups++;console.log('PASS '+label)};
 function fixture(yaw,door){const p={id:'south-1',x:12,z:20,yaw,door,driverHP:0,fuel:0},root=new T.Group(),model=createBusModels(T,root,{poses:()=>[p],stops:()=>[]});model.update(0);root.updateMatrixWorld(true);return{p,root,model};}
 function rayClear(f,a,b){const from=busPoint(f.p,...a),to=busPoint(f.p,...b),origin=new T.Vector3(from.x,from.y,from.z),end=new T.Vector3(to.x,to.y,to.z),ray=new T.Raycaster(origin,end.clone().sub(origin).normalize(),.00001,origin.distanceTo(end)-.00001);
  const hits=ray.intersectObject(f.root,true).filter(h=>!h.object.userData.busGlass&&!h.object.userData.busDriver);return{mesh:hits.length===0,analytic:busCabinRayClear(from,to,f.p)};}
 check('glass transmits sight/rounds in both directions, all rotations and closed/open doors',()=>{
  for(const yaw of[0,.83,-2.2,Math.PI])for(const door of[false,true]){const f=fixture(yaw,door);
   for(const [a,b]of[
    [[7,2.1,2.1],[-.48,2.1,2.1]],[[-7,2.1,2.1],[.48,2.1,2.1]],
    [[7,-1,2.1],[-.48,-1,2.1]],[[.48,9,2.2],[.48,2,2.2]],[[.48,-9,2.2],[.48,-2,2.2]],
    [[-7,3.9,2.2],[0,3.9,2.2]],[[-7,-.8,2.2],[0,-.8,2.2]],
   ])for(const [from,to]of[[a,b],[b,a]]){const result=rayClear(f,from,to);assert.ok(result.mesh,JSON.stringify({yaw,door,from,to,result}));assert.ok(result.analytic,JSON.stringify({yaw,door,from,to,result}));}
   f.model.dispose();}
 });
 check('lower metal, pillars, roof and closed door bottom remain cover in mesh and sight tests',()=>{
  for(const yaw of[0,.83,-2.2]){const f=fixture(yaw,false);for(const [a,b]of[
   [[7,2.1,1],[0,2.1,1]],[[7,2,2.2],[0,2,2.2]],[[0,0,5],[0,0,2]],
   [[-7,3.9,1],[0,3.9,1]],[[0,9,1],[0,2,1]],[[0,-9,1],[0,-2,1]],
  ]){const result=rayClear(f,a,b);assert.equal(result.mesh,false);assert.equal(result.analytic,false);}
  f.model.dispose();}
 });
 check('unrelated rays/above roof remain clear, including parallel and zero-length outside rays',()=>{
  const f=fixture(1.2,true);for(const [a,b]of[[[7,0,2],[8,0,2]],[[0,9,5],[0,-9,5]],[[8,9,2],[8,9,2]]]){const start=busPoint(f.p,...a),end=busPoint(f.p,...b);assert.equal(busCabinRayClear(start,end,f.p),true);}f.model.dispose();
 });
 console.log(`PASS ${groups} shared bus cabin geometry / glass / metal groups; silent`);
})().catch(e=>{console.error(e);process.exitCode=1;});
