const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const T=await import(pathToFileURL(path.join(__dirname,'public/vendor/three.module.js')).href);
 let source=fs.readFileSync(path.join(__dirname,'public/bus-destruction.js'),'utf8');
 const faults={center:["x:pose.x+u*cs+v*sn","x:(c.minX+c.maxX)/2"],count:['i<96;i++','i<18;i++'],contact:['explode(g,time,contact||points[0])','explode(g,time,null)']};
 if(process.env.BUS_IMPACT_FAULT){const [a,b]=faults[process.env.BUS_IMPACT_FAULT];assert.ok(source.includes(a));source=source.replace(a,b);}
 const {busImpactPoint,createBusDestruction}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 let count=0;const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`),check=(label,fn)=>{fn();count++;console.log('PASS '+label);};
 const wall={minX:-8,maxX:8,minZ:5,maxZ:5.2,height:12},pose={x:6,z:0,yaw:0};
 const position=(mesh,i=0)=>{const m=new T.Matrix4();mesh.getMatrixAt(i,m);assert.ok(m.elements.every(Number.isFinite));return new T.Vector3().setFromMatrixPosition(m);};
 function fixture(n=1){const world=new T.Group(),colliders=[],groups=[];for(let i=0;i<n;i++){const b={...wall,minX:wall.minX+i*40,maxX:wall.maxX+i*40};colliders.push(b);groups.push({id:'wall'+i,structural:true,bounds:[b],colliders:[b],parts:[],nodes:[],shapes:[]});}const d=createBusDestruction(T,world,colliders,[],groups,{invalidate(){}});return{d,colliders};}
 check('thin long wall emits within actual bus contact, never the bay center',()=>{
  const p=busImpactPoint(pose,pose,[wall]);near(p.x,6);near(p.z,5.1);near(p.y,1.35);assert.ok(p.x>4);
  assert.equal(busImpactPoint({x:40,z:40,yaw:0},null,[wall]),null);
 });
 check('rotated, reversed, previous pose and overhead footprints stay inside actual intersection',()=>{
  for(const yaw of[0,Math.PI/4,Math.PI/2,Math.PI]){const b={minX:.9,maxX:1.1,minZ:-.1,maxZ:.1,base:5.2,height:5.5};const p=busImpactPoint({x:0,z:0,yaw},null,[b]);assert.ok(p);assert.ok(p.x>=b.minX-1e-7&&p.x<=b.maxX+1e-7&&p.z>=b.minZ-1e-7&&p.z<=b.maxZ+1e-7);near(p.y,5.23);}
  near(busImpactPoint({x:40,z:40,yaw:0},pose,[wall]).x,6);
  assert.equal(busImpactPoint({x:NaN,z:0,yaw:0},null,[wall]),null);
  const diamond={minX:-2,maxX:2,minZ:-2,maxZ:2,height:3,polygon:[[0,-2],[2,0],[0,2],[-2,0]]},p=busImpactPoint({x:2,z:0,yaw:0},null,[diamond]);assert.ok(Math.abs(p.x)+Math.abs(p.z)<=2+1e-7);
 });
 check('one collision starts96 fragments and24 dust exactly at impact, with three bounded draws',()=>{
  const{d}=fixture();d.breakAt(pose,pose,1);d.update(1);assert.deepEqual(d.fx.children.map(o=>o.count),[96,24,1]);const contact=d.impactPoints()[0];
  for(const mesh of d.fx.children)for(let i=0;i<mesh.count;i++){const p=position(mesh,i);near(p.x,contact.x);near(p.y,contact.y);near(p.z,contact.z);}
  assert.equal(d.fx.children.length,3);d.dispose();
 });
 check('nine impacts cap at768 fragments/192 dust/eight rings and expire completely',()=>{
  const{d}=fixture(9);for(let i=0;i<9;i++){const p={...pose,x:pose.x+i*40};d.breakAt(p,p,2);}d.update(2);assert.deepEqual(d.fx.children.map(o=>o.count),[768,192,8]);
  for(const mesh of d.fx.children)for(let i=0;i<mesh.count;i++)position(mesh,i);d.update(4.61);assert.ok(d.fx.children.every(o=>o.count===0));d.reset();assert.equal(d.impactPoints().length,0);d.dispose();
 });
 check('absolute time produces identical20/60/144Hz paths without combat RNG consumption',()=>{
  const snapshots=[],before=Math.random;for(const hz of[20,60,144]){const{d}=fixture();Math.random=()=>{throw Error('combat RNG used')};try{d.breakAt(pose,pose,1);for(let i=0;i<=hz;i++)d.update(1+i/hz);d.update(2);snapshots.push([...d.fx.children[0].instanceMatrix.array]);}finally{Math.random=before;d.dispose();}}
  assert.deepEqual(snapshots[0],snapshots[1]);assert.deepEqual(snapshots[0],snapshots[2]);
 });
 check('guest existing cue contact and accepted bus pose restore at host impact once',()=>{
  const{d:host}=fixture();host.breakAt(pose,pose,1);const mask=host.snapshot(),contact=host.impactPoints()[0];
  for(const options of[{contacts:[contact]},{impacts:[pose]}]){const{d}=fixture();d.restore(mask,2,{effects:true,...options});d.update(2);const p=position(d.fx.children[0]);near(p.x,contact.x);near(p.z,contact.z);near(p.y,contact.y);d.restore(mask,2.1,{effects:true,...options});d.update(2.1);assert.equal(d.fx.children[0].count,96);d.dispose();}
  const{d}=fixture();d.restore(mask,3);d.update(3);assert.ok(d.fx.children.every(o=>o.count===0));d.reset();assert.equal(d.snapshot(),'');d.dispose();host.dispose();
 });
 console.log('PASS '+count+' contact debris groups; no audio');
})().catch(e=>{console.error(e);process.exitCode=1;});
