const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main({mutate=s=>s,only=()=>true,measure=false}={}){
 const template=fs.readFileSync(path.join(__dirname,'tests-bot-cat-work.cjs'),'utf8'),cut=template.indexOf(' if(measureOnly)');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'defuse-tactics-harness.cjs'),module);mod.filename=path.join(__dirname,'defuse-tactics-harness.cjs');mod.paths=module.paths;
 mod._compile(template.slice(0,cut)+'\nreturn {flat,real,setup,step};\n}\nmodule.exports=main;',mod.filename);
 const {flat,real,setup:base,step}=await mod.exports({mutate});let groups=0;const controls=[];
 for(const h of[flat,real])h.run('var defuseTestBlind=ordinarySkills.blindUntil');
 function setup(h=flat,{timer=35,away=0,contact=false,actual=false,mapId='hashimoto',siteId='A'}={}){
  h.run('ordinarySkills.blindUntil=defuseTestBlind');base(h,{timer,roundTime:90,points:0,mapId,siteId});h.sandbox.cfg2={away,contact,actual};
  h.run(`worker.kit=new DuelistKit({character:'mend'});worker.record.kit=worker.kit;worker.kit.smoke=worker.kit.updraft=worker.kit.dash=worker.kit.ultPoints=0;player.x=65;player.z=65;worker.fire=999;worker.think=0;worker.target=null;worker.group.rotation.y=0;worker.z+=cfg2.away;
   if(cfg2.actual&&cfg2.away){var points=[];for(let i=0;i<16;i++){var a=i*Math.PI/8,p=navigation.nearest(point.x+Math.sin(a)*cfg2.away,point.z+Math.cos(a)*cfg2.away,0);if(p&&Math.abs(p.y||0)<.05&&navigation.path(p.x,p.z,point.x,point.z).length)points.push(p);}if(!points.length)throw Error('No reachable real retake');worker.x=points[0].x;worker.z=points[0].z;}
   var starts=[],cancels=[],decisions=[],rawWork=match.interactDefuse.bind(match),rawCancel=match.cancelDefuse.bind(match),prevYaw=worker.group.rotation.y,maxTurn=0,frames=0;
   match.interactDefuse=function(dt,o){const before=match.spike.defuseActor,r=rawWork(dt,o);if(o.actorId===worker.id&&before!==worker.id&&match.spike.defuseActor===worker.id)starts.push(elapsed);return r;};
   match.cancelDefuse=function(id){if(id===worker.id&&match.spike.defuseActor===id)cancels.push({at:elapsed,progress:match.spike.defuseProgress});return rawCancel(id);};
   var rawDecision=updateBots.tactics.defuseDecision.bind(updateBots.tactics);updateBots.tactics.defuseDecision=function(...args){var r=rawDecision(...args);if(args[0]===worker)decisions.push({at:elapsed,...r});return r;};
   if(cfg2.contact)updateBots.tactics.observe(worker.team,'ally',{id:'known',team:player.team,x:point.x+6,y:0,z:point.z-8},elapsed);
   Math.random=()=>.99;`);
 }
 const read=h=>JSON.parse(h.run('JSON.stringify({starts,cancels,progress:match.spike.defuseProgress,checkpoint:match.spike.checkpoint,status:match.spike.status,phase:match.phase,x:worker.x,z:worker.z,px:point.x,pz:point.z,at:elapsed,frames,maxTurn,hp:worker.hp,defusing:worker.defusing,target:worker.target?.id,decisions})'));
 function run(h=flat,seconds=12,hz=60){h.sandbox.testDT=1/hz;for(let i=0;i<Math.ceil(seconds*hz)&&h.run("match.phase==='live'");i++){h.run('prevYaw=worker.group.rotation.y');step(h,1/hz);h.run('frames++;maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(worker.group.rotation.y-prevYaw),Math.cos(worker.group.rotation.y-prevYaw)))/testDT)');}return read(h);}
 const test=(name,fn)=>{if(!only(name))return;fn();groups++;console.log('PASS: '+name);};
 test('actual full frame performs one accepted tap, releases, watches and finishes at20/60/144Hz',()=>{
  for(const hz of[20,60,144]){setup(flat,{contact:true});const r=run(flat,12,hz);assert.equal(r.status,'defused',JSON.stringify({...r,decisions:r.decisions.filter((d,i,a)=>!i||d.phase!==a[i-1].phase)}));assert.equal(r.starts.length,2);assert.equal(r.cancels.length,1);assert.ok(r.cancels[0].progress>=.3&&r.cancels[0].progress<.41);assert.ok(r.starts[1]-r.cancels[0].at>=1.2-1e-8);assert.ok(r.maxTurn<=Math.PI*.8+1e-7);assert.equal(r.hp,100);controls.push({hz,kind:'fake',...r,decisions:undefined});}
 });
 test('quiet or urgent or checkpoint work commits without artificial taps or checkpoint loss',()=>{
  for(const spec of[{timer:35},{timer:9,contact:true},{timer:10,contact:true,checkpoint:3.5}]){setup(flat,spec);if(spec.checkpoint)flat.run('match.spike.checkpoint=3.5;match.spike.defuseProgress=3.5');const r=run(flat,10);assert.equal(r.status,'defused');assert.equal(r.starts.length,1);assert.equal(r.cancels.length,0);if(spec.checkpoint)assert.ok(r.at<3.6);}
 });
 test('approaching defender checks a copied contact and sweeps rather than staring at the bomb',()=>{
  setup(flat,{away:10,contact:true});const start=read(flat);let r=run(flat,.8);assert.ok(r.decisions.some(d=>d.phase==='inspect'));assert.ok(r.decisions.some(d=>d.watch?.x===start.px+6));assert.equal(r.starts.length,0);assert.ok(r.maxTurn<=Math.PI*.8+1e-7);r=run(flat,16);assert.equal(r.status,'defused');assert.ok(r.starts.length<=2);
  setup(flat,{away:16});r=run(flat,2.5);const watches=r.decisions.filter(d=>d.watch).map(d=>Math.atan2(d.watch.x-r.x,d.watch.z-r.z));assert.ok(Math.max(...watches)-Math.min(...watches)>.5);assert.ok(Math.hypot(r.x-r.px,r.z-r.pz)<16,'scan still advances along navigation');
 });
 test('visible distant threat interrupts nonurgent work; deadline suppresses fake and returns to defuse',()=>{
  setup();flat.run('player.x=worker.x;player.z=worker.z+14;worker.group.rotation.y=0;worker.think=0');let r=run(flat,.6);assert.equal(r.target,'player');assert.equal(r.starts.length,0,'visible enemy14m away must be fought rather than ignored');
  flat.run('match.spike.timer=8');r=run(flat,7.5);assert.equal(r.status,'defused');assert.equal(r.starts.length,1);
  setup(flat,{contact:true});run(flat,.4);flat.run('match.spike.timer=8');r=run(flat,7.5);assert.equal(r.status,'defused');assert.ok(r.decisions.at(-1).urgent);
 });
 test('scan acquires a real side enemy through ordinary cone and LOS instead of bomb-only facing',()=>{
  setup(flat,{away:12});flat.run('worker.group.rotation.y=Math.PI;player.x=worker.x+10;player.z=worker.z;worker.think=0');step(flat,1/60);assert.equal(flat.run('worker.target'),null,'initial side enemy is outside ordinary forward vision');
  const r=run(flat,1.5);assert.equal(r.target,'player');assert.equal(r.starts.length,0);assert.ok(r.maxTurn<=Math.PI*.8+1e-7);
 });
 test('new visible danger releases genuine work while preserving its half checkpoint',()=>{
  setup();flat.run('match.spike.checkpoint=3.5;match.spike.defuseProgress=3.5');run(flat,.2);flat.run('player.x=worker.x;player.z=worker.z+14;worker.group.rotation.y=0;worker.think=0');let r=run(flat,.5);assert.equal(r.defusing,false);assert.equal(r.checkpoint,3.5);assert.equal(r.progress,3.5);assert.equal(r.cancels.length,1);
  flat.run('player.x=65;player.z=65;worker.think=0');r=run(flat,4);assert.equal(r.status,'defused');assert.equal(r.starts.length,2);
 });
 test('Nobi conserves the tool during a fake then accelerates the genuine resumed task',()=>{
  setup(flat,{contact:true});flat.run("worker.kit=new DuelistKit({character:'nobi'});worker.record.kit=worker.kit;worker.kit.smoke=worker.kit.updraft=worker.kit.ultPoints=0");run(flat,.6);assert.equal(flat.run('worker.kit.dash'),1);assert.equal(flat.run('worker.kit.nextSignatureAt'),0);const r=run(flat,8);assert.equal(r.status,'defused');assert.equal(flat.run('worker.kit.dash'),0);assert.equal(r.starts.length,2);
 });
 test('a fake uses a real fixed audible origin; hidden movement, stale/team knowledge and impairment do not invent targets',()=>{
  setup();flat.run('worker.lastHeard={x:point.x+6,y:0,z:point.z-7,at:elapsed};player.x=-65;player.z=-65');let r=run(flat,12);assert.equal(r.starts.length,2);assert.ok(r.decisions.some(d=>d.watch?.x===r.px+6));
  for(const reason of['stale','friendly','blind']){setup(flat,{contact:reason==='blind'});flat.sandbox.reason=reason;flat.run(`if(reason==='stale')worker.lastHeard={x:point.x+6,z:point.z-7,at:elapsed-2};if(reason==='friendly')updateBots.tactics.observe(player.team,'enemy',{id:'other',team:worker.team,x:point.x+6,z:point.z-7},elapsed);if(reason==='blind')ordinarySkills.cast('nope-face-flash',ordinaryActorView(player),{x:worker.x,y:0,z:worker.z},elapsed,match.round)`);if(reason==='blind')flat.run('ordinarySkills.blindUntil=()=>100');r=run(flat,10);assert.equal(r.starts.length,1,reason);assert.equal(r.status,'defused');}
 });
 test('human ownership, remote actors, guest, next round and disposal preserve existing authority',()=>{
  setup(flat,{contact:true});flat.run("match.spike.defuseActor='human';match.spike.defuseProgress=1");run(flat,1);assert.equal(flat.run('starts.length'),0);assert.equal(flat.run('match.spike.defuseActor'),'human');
  for(const code of["worker.remoteId='guest'","onlinePlaying=true;online={host:false,session:{memberId:'guest'}}"]){setup(flat,{contact:true});flat.run(code);run(flat,.5);assert.equal(flat.run('starts.length'),0);}
  setup(flat,{contact:true});run(flat,.4);flat.run('updateBots.tactics.reset(match.round+1);match.cancelDefuse(worker.id);starts=[];cancels=[]');run(flat,8);assert.equal(flat.run('starts.length'),1,'round reset clears threat and fake state');
 });
 test('real Hashimoto Hirakata TRC A/B navigation approaches and finishes controlled retakes',()=>{
  for(const mapId of['hashimoto','hirakata','trc'])for(const siteId of['A','B']){setup(real,{mapId,siteId,actual:true,away:12,timer:40});const r=run(real,25,20);assert.equal(r.status,'defused',mapId+'/'+siteId);assert.equal(r.starts.length,1);assert.ok(r.maxTurn<=Math.PI*.8+1e-7);controls.push({mapId,siteId,kind:'real-map',...r,decisions:undefined});}
 });
 if(measure)return {controls,updatePlayCallsPerFrame:1,audioOutput:0,limitations:['controlled scenarios; no ordinary5v5 win-rate claim','actual browser/devices/listening unverified']};
 console.log(`PASS: ${groups} actual full-frame CPU defuse tactics groups; audio output0`);
}
module.exports=main;if(require.main===module)main({measure:process.argv.includes('--measure')}).then(r=>{if(r)console.log(JSON.stringify(r))}).catch(e=>{console.error(e);process.exitCode=1});
