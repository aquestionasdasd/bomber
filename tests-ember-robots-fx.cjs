const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
async function main(){
 const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href),[THREE,{createRobotArmy},{createRobotFX}]=await Promise.all([load('vendor/three.module.js'),load('ember-robots.js'),load('ember-robots-fx.js')]);
 const army=createRobotArmy(),fx=createRobotFX(THREE),owners=Array.from({length:3},(_,i)=>({id:'owner'+i,team:i===2?'red':'blue',x:i*50,y:0,z:0,yaw:0,alive:true}));
 const world={ground:()=>0,stand:()=>true,clear:()=>true,see:()=>false,path:(u,p)=>[p],move:()=>{},damage:()=>assert.fail('No target'),stop:(a,b)=>b,push:()=>{}};
 for(let k=0;k<3;k++)for(let i=0;i<8;i++)assert.ok(army.deploy(owners[k],'q',1,{x:k*50+i%4*6,y:0,z:Math.floor(i/4)*7},0,1,world));army.update(0,1,owners,world);
 const samples=[];for(let i=0;i<180;i++){const start=performance.now();fx.update(army,i/60,{viewer:owners[0]});samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);
 const batches=fx.group.children.filter(o=>o.isInstancedMesh&&o.visible);assert.ok(batches.length>0&&batches.length<=16);assert.ok(batches.reduce((n,b)=>n+b.count,0)>96);for(const b of batches){assert.equal(b.material.depthTest,true);assert.equal(b.material.depthWrite,true);assert.ok(b.count<=2048);assert.equal(b.frustumCulled,false);}
 console.log(JSON.stringify({proceduralModelCPU96:{p50ms:samples[90],p95ms:samples[171],maxms:samples[179],batchDrawObjects:batches.length,instances:batches.reduce((n,b)=>n+b.count,0),gpuUnverified:true}}));
 fx.update(army,3,{viewer:owners[0],visible:()=>false});assert.equal(fx.group.children.filter(o=>o.isInstancedMesh&&o.visible).length,0,'Wall/smoke visibility callback hides world models');
 for(const key of['c','q','e','x'])for(const mode of[0,1]){fx.update(army,3,{viewer:owners[0],aim:{key,mode,point:{x:0,y:0,z:0},yaw:0,valid:true}});assert.equal(fx.hand.visible,true);assert.ok(fx.hand.children.length);assert.ok(fx.group.children.find(o=>o.name==='Ember / deployment preview').children.length);}
 fx.reset();assert.equal(fx.group.visible,false);assert.equal(fx.hand.visible,false);assert.equal(fx.group.children.filter(o=>o.isInstancedMesh&&o.visible).length,0);fx.dispose();console.log('PASS: real Three procedural robot prefabs,96 instanced models/depth visibility,8 previews and cleanup; no audio');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
