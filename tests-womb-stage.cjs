const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');

async function main(){
 const fixture=fs.readFileSync(path.join(__dirname,'tests-round-preparation-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');assert.ok(cut>0);
 const mod=new Module(path.join(__dirname,'womb-fixture.cjs'),module);mod.filename=path.join(__dirname,'womb-fixture.cjs');mod.paths=Module._nodeModulePaths(__dirname);
 mod._compile(fixture.slice(0,cut)+'\nreturn {harness,copy};\n}\nmodule.exports=main;',mod.filename);
 const {harness,copy}=await mod.exports(),h=harness({realMap:true});h.reset();h.run("selectArena('womb');");
 const layout=await import('./public/womb-layout.js'),catalog=await import('./public/map.js');
 let passed=0,failed=0,walks=0;const near=(a,b,label,tolerance=.04)=>assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} vs ${b}`);
 function check(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}
 function reset(){h.run(`clearCombatInput();clearBots();resetOrdinarySkills();online=null;onlinePlaying=false;exploring=true;mode='play';match.phase='live';match.roundTime=150;elapsed=10;map.bomberCollapse?.reset();Object.assign(player,{alive:true,hp:100,armor:0,crouch:0,vx:0,vz:0,vy:0,trcLadder:null,trafficLaunch:null,carMotion:null,dashTimer:0});player.kit=new DuelistKit({character:'nope'});`);}
 function walk(points,hz=60,radius=.34){reset();h.sandbox.points=points;h.sandbox.hz=hz;h.sandbox.walkRadius=radius;
  const result=copy(h.run(`(()=>{Object.assign(player,points[0]);let steps=0;for(const p of points.slice(1)){const dist=Math.hypot(p.x-player.x,p.z-player.z),n=Math.ceil(dist/(5.4/hz))+Math.ceil(hz*.6);for(let i=0;i<n;i++){const dx=p.x-player.x,dz=p.z-player.z,d=Math.hypot(dx,dz);if(d<.001)break;const scale=Math.min(1,5.4/hz/d);moveEntity(player,dx*scale,dz*scale,walkRadius);updateActorVertical(player,1/hz,walkRadius);steps++;}if(Math.hypot(player.x-p.x,player.z-p.z)>.045||Math.abs(player.y-p.y)>.06)return {ok:false,wanted:p,actual:{x:player.x,y:player.y,z:player.z},steps};}return {ok:true,steps};})()`));
  assert.ok(result.ok,JSON.stringify(result));walks++;
 }
 check('new catalog entry preserves all existing maps and provides four floors / twelve flights',()=>{
  assert.deepEqual(catalog.MAP_CATALOG.map(m=>m.id),['hashimoto','hirakata','trc','womb']);assert.equal(catalog.normalizeMapId('womb'),'womb');assert.equal(h.run('map.id'),'womb');assert.equal(h.run('map.ramps.length'),12);assert.deepEqual(copy(h.run('map.floors.map(f=>f.y)')),[0,3.6,7.2,10.8]);
 });
 check('all ten spawns and fourteen practice destinations have body clearance and real support',()=>{
  const points=copy(h.run('[...map.teamSpawns.attack,...map.teamSpawns.defend,...map.landmarks]'));
  for(const p of points){h.sandbox.probe=p;assert.ok(h.run('canStand(probe.x,probe.z,.4,probe.y)'),JSON.stringify(p));near(h.run('getZoneFloor(probe.x,probe.z,probe.y+.04)'),p.y,p.name||'spawn');}
 });
 check('each visible tread has smooth movement support and standing headroom at every storey',()=>{
  for(const r of layout.WOMB_STAIRS)for(const f of [.05,.25,.5,.75,.95]){
   const x=(r.minX+r.maxX)/2,z=r.minZ+(r.maxZ-r.minZ)*(r.direction===-1?1-f:f),y=r.base+r.height*f;h.sandbox.probe={x,z,y};
   // The capsule meets a real landing before its centre reaches the edge;
   // account for the same existing .22 m step used by actual movement.
   assert.ok(h.run(`(()=>{let feet=probe.y;for(const c of map.collision.query(probe.x,probe.z,.4)){const top=movementTop(c,probe.x,probe.z);if(!c.disabled&&top<=probe.y+.22&&map.collision.overlaps(c,probe.x,probe.z,.4))feet=Math.max(feet,top);}return canStand(probe.x,probe.z,.4,feet);})()`),JSON.stringify({id:r.id,f,y}));
   const hit=copy(h.run(`(()=>{const ray=new THREE.Raycaster(new THREE.Vector3(probe.x,probe.y+.24,probe.z),new THREE.Vector3(0,-1,0),0,.5);const hit=ray.intersectObject(map.world,true).find(h=>h.object.userData.solid);return hit?{y:hit.point.y}:null;})()`));assert.ok(hit,r.id+' visible floor');assert.ok(hit.y>=y-.005&&hit.y-y<=.19,JSON.stringify({id:r.id,y,hit}));
  }
 });
 check('both complete U stairs: up/down through all six floor connections at 20/60/144Hz',()=>{
  for(const radius of [.34,.4])for(const hz of [20,60,144])for(const core of [1,2])for(const floor of [1,2,3]){const route=layout.wombStairRoute(core,floor);walk(route,hz,radius);walk([...route].reverse(),hz,radius);}
 });
 check('both shafts connect 1F to 4F continuously, including turns at each storey',()=>{
  for(const core of [1,2]){const route=[1,2,3].flatMap(f=>layout.wombStairRoute(core,f));walk(route);walk([...route].reverse());}
 });
 check('approved entry routes and 3F loop can be walked with the BOT radius',()=>{
  for(const floor of layout.WOMB_PLAN)for(const route of floor.routes){const points=route.p.map(p=>layout.wombPoint(...p,layout.WOMB_LEVELS[floor.n-1]));walk(points,60,.4);}
 });
 check('navigation reaches both sites from each side, without teleport edges or wall crossings',()=>{
  const result=copy(h.run(`(()=>{const out=[];for(const side of ['attack','defend'])for(const start of map.teamSpawns[side])for(const site of map.sites){const path=navigation.path(start.x,start.z,site.x,site.z,start.y,site.y);let p=start,clear=path.length>0;for(const q of path){clear&&=navigation.clearSegment(p.x,p.z,q.x,q.z,p.y,q.y);p=q;}out.push({side,start,site:site.id,count:path.length,clear,last:p});}return out;})()`));
  for(const r of result){assert.ok(r.clear,JSON.stringify(r));near(r.last.y,r.site==='A'?3.6:10.8,'site height');}
 });
 check('planting requires the declared floor; both zones have several clear destinations',()=>{
  for(const site of copy(h.run('map.sites'))){h.sandbox.site=site;assert.equal(h.run('isAtSiteHeight(site,site.y)'),true);assert.equal(h.run('isAtSiteHeight(site,0)'),false);for(const p of site.plantPositions){h.sandbox.probe=p;assert.ok(h.run('canStand(probe.x,probe.z,.45,probe.y)'));assert.ok(h.run('isInsideSite(site,probe.x,probe.z,{margin:.45})'));}}
 });
 check('actual movement follows generated 1F-to-4F routes, rather than just graph connectivity',()=>{
  for(const i of [0,1,4]){h.sandbox.spawnIndex=i;const points=copy(h.run('(()=>{const a=map.teamSpawns.attack[spawnIndex],b=map.sites[1];return [a,...navigation.path(a.x,a.z,b.x,b.z,a.y,b.y)];})()'));assert.ok(points.length>2,'nonempty route');walk(points,60,.4);}
 });
 check('round preparation preserves 1F/3F starts, support and raised defender barrier',()=>{
  for(const side of ['attack','defend']){reset();h.sandbox.side=side;
   const result=copy(h.run(`(()=>{exploring=false;match=new MatchRules({startingSide:side});spawnRound(true);syncBuyBarrier();const y=player.y;updateActorVertical(player,1/20,.34);return {y,after:player.y,barrier:buyBarrier.position.y,bomber:match.spike.status,clear:canStand(player.x,player.z,.34,player.y)};})()`));
   near(result.y,side==='attack'?0:7.2,'round spawn');near(result.after,result.y,'floor support');near(result.barrier,result.y,'buy barrier');assert.equal(result.bomber,'dropped');assert.ok(result.clear);
  }
 });
 check('real BOT frames navigate from both 1F stair entries to B on 4F',()=>{
  for(const core of [1,2]){reset();h.sandbox.begin=layout.wombStairRoute(core,1)[0];
   const result=copy(h.run(`(()=>{exploring=false;player.alive=false;Object.assign(match.spike,{status:'carried',carrier:player.id});makeBot(begin,0,'blue',{id:'blue-0',team:'blue',primary:'vandal',secondary:'classic',armor:0,credits:0,kit:new DuelistKit({character:'nope'})});const bot=bots[0],site=map.sites[1];
    // Fix the strategic order so this checks the real follower, turns,
    // replanning, grounding and collision, independent of random A/B choice.
    updateBots.tactics={update:()=>({siteId:'B',roles:new Map([[bot.id,{role:'entry',siteId:'B',goal:site}]])}),contacts:()=>[],investigation:()=>null,reset(){}};
    let i=0;for(;i<1600;i++){elapsed+=.05;updateBots(.05);if(Math.hypot(bot.x-site.x,bot.y-site.y,bot.z-site.z)<.5)break;}updateBots.tactics=null;return {reached:i<1600,x:bot.x,y:bot.y,z:bot.z,seconds:i*.05};})()`));assert.ok(result.reached,JSON.stringify({core,...result}));near(result.y,10.8,'BOT reaches B floor');
  }
 });
 check('practice HUD and four floor plans can render between named areas without stale floor state',()=>{
  reset();for(const y of layout.WOMB_LEVELS){h.sandbox.floorY=y;h.run(`player.y=floorY;updateHUD();drawMinimap($('minimap'));mapDisplayFloor=map.floorIndex(floorY)+1;drawMinimap($('large-minimap'),true);`);assert.match(h.run("$('zone').textContent"),new RegExp('^'+(layout.wombFloorIndex(y)+1)+'F'));}
 });
 check('4F cannot shoot into the atrium; 3F has only its bounded shooting window',()=>{
  const p=layout.wombPoint;h.sandbox.rays=[{a:p(25.7,21.7,12.4),b:p(17,21.8,5.2),clear:false},{a:p(11.9,21.8,8.8),b:p(18.3,21.8,5.2),clear:true},{a:p(11.9,20.1,8.8),b:p(18.3,20.1,5.2),clear:false}];
  for(const ray of copy(h.run('rays'))){h.sandbox.ray=ray;assert.equal(h.run('map.collision.rayClear(ray.a.x,ray.a.y,ray.a.z,ray.b.x,ray.b.y,ray.b.z)'),ray.clear,JSON.stringify(ray));}
  const top=copy(h.run(`(()=>{const ray=new THREE.Raycaster(new THREE.Vector3(0,8,-6),new THREE.Vector3(0,-1,0),0,2);const hit=ray.intersectObject(map.world,true).find(h=>h.object.userData.solid);return hit?hit.point.y:null;})()`));near(top,7.2,'visible top of the atrium baffle');
 });
 check('actual key-driven game frames climb a flight without jumping or losing headroom',()=>{
  reset();const r=layout.WOMB_STAIRS[0];h.sandbox.begin={x:(r.minX+r.maxX)/2,z:r.maxZ+.5,y:0};
  const result=copy(h.run(`(()=>{Object.assign(player,begin,{yaw:0,pitch:0});keys.add('KeyW');for(let i=0;i<30;i++){elapsed+=1/60;updatePlay(1/60);}keys.clear();return {x:player.x,y:player.y,z:player.z,clear:canStand(player.x,player.z,.34,player.y),start:begin};})()`));assert.ok(result.y>.45&&result.z<result.start.z-1,result+'');assert.ok(result.clear);
 });
 check('switching back to TRC / both stations retains the original catalog and floor metadata',()=>{
  for(const id of ['trc','hashimoto','hirakata']){h.sandbox.arenaId=id;h.run('selectArena(arenaId)');assert.equal(h.run("map.id||'hashimoto'"),id);assert.equal(h.run('!!map.floors'),false);}h.run("selectArena('womb')");assert.equal(h.run('map.floors.length'),4);
 });
 console.log(JSON.stringify({passed,failed,walks,audioOutput:0}));if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
