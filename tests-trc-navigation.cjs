const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
async function main(){
 const load=f=>import(pathToFileURL(path.join(__dirname,'public',f)).href);
 const THREE=await load('vendor/three.module.js'),{createTrcMap}=await load('trc-map.js'),{TRC_LADDERS}=await load('trc-layout.js'),{createCollisionIndex}=await load('collision.js');
 global.document={createElement:()=>({width:256,height:256,getContext:()=>new Proxy({measureText:t=>({width:t.length*8}),createLinearGradient:()=>({addColorStop(){}})},{get:(t,k)=>t[k]||(()=>{})})})};
 const source=fs.readFileSync(path.join(__dirname,'public/trc-navigation.js'),'utf8');
 // Introspection exists only in this memory copy; the shipped module stays private.
 const factory=new Function('createCollisionIndex','TRC_LADDERS',source.replace(/^import .*;\r?\n/gm,'').replace('export function','function').replace('return {path,nearest,isWalkable,clearSegment,layered:true,nodeCount:nodes.length};','return {path,nearest,isWalkable,clearSegment,layered:true,nodeCount:nodes.length,probe:{nodes,edges,connector,cache,segments}};')+';return createTrcNavigation;');
 const create=factory(createCollisionIndex,TRC_LADDERS),scene=new THREE.Group(),map=createTrcMap(THREE,scene),nav=create(map);
 let groups=0;function check(name,fn){fn();groups++;console.log('PASS: '+name);}
 const starts=Object.values(map.teamSpawns).flat(),goals=[...map.sites.flatMap(s=>s.plantPositions),...map.landmarks.filter(p=>p.y)];
 function safeRoute(start,goal){const route=nav.path(start.x,start.z,goal.x,goal.z,start.y||0,goal.y||0);assert.ok(route.length,'reachable route');let p=start;for(const q of route){if(q.ladder){assert.ok(TRC_LADDERS.some(l=>l.id===q.ladder));}else assert.ok(nav.clearSegment(p.x,p.z,q.x,q.z,p.y||0,q.y||0),'shortcut must pass actual swept support/collision');p=q;}return route;}
 check('all spawn/site/high-ground routes keep real swept clearance and finite support',()=>{assert.ok(nav.nodeCount>8000);for(const a of starts)for(const b of goals)safeRoute(a,b);});
 check('heap preserves the old A-star cost and insertion-order tie on blocked routes',()=>{
  const {nodes,edges,connector,cache}=nav.probe;let compared=0;
  for(const [a,b]of [[starts[0],goals[0]],[starts[2],goals.at(-1)],[starts[7],goals[1]],[starts[8],goals.at(-2)]]){
   cache.clear();safeRoute(a,b);const start=connector(a),finish=connector(b),actual=cache.get(start+':'+finish);if(!actual)continue;compared++;
   const open=new Set([start]),closed=new Set(),cost=new Map([[start,0]]),parent=new Map();
   while(open.size){let at=-1,best=Infinity;for(const id of open){const p=nodes[id],score=cost.get(id)+Math.hypot(p.x-b.x,p.z-b.z,p.y-(b.y||0));if(score<best){best=score;at=id;}}if(at===finish)break;open.delete(at);closed.add(at);for(const e of edges[at]){if(closed.has(e.id))continue;const c=cost.get(at)+e.cost;if(c<(cost.get(e.id)??Infinity)){cost.set(e.id,c);parent.set(e.id,at);open.add(e.id);}}}
   const expected=[];for(let n=finish;n!==start;n=parent.get(n)){assert.notEqual(n,undefined);expected.push(n);}expected.reverse();assert.deepEqual(actual.map(p=>p.id),expected);
  }assert.ok(compared>=2,'Compare actual searched routes rather than only direct lines');
 });
 check('repeated exact segments reuse support checks and cache stays bounded',()=>{
  const walk=map.walkHeights;let calls=0;map.walkHeights=(...a)=>{calls++;return walk(...a)};
  const a=starts[0],b=starts[1];nav.clearSegment(a.x,a.z,b.x,b.z);calls=0;nav.clearSegment(a.x,a.z,b.x,b.z);assert.equal(calls,0);
  for(let i=0;i<8300;i++)nav.clearSegment(a.x+i/100000,a.z,a.x+i/100000,a.z);assert.ok(nav.probe.segments.size<=8192);map.walkHeights=walk;
 });
 check('collision revision invalidates both blocked and opened segment results',()=>{
  const wall={minX:-.1,maxX:.1,minZ:-3,maxZ:3,height:4},colliders=[wall];
  const fixture={colliders,collision:createCollisionIndex(colliders),bounds:{minX:-8,maxX:8,minZ:-8,maxZ:8},world:{userData:{}},walkHeights:()=>[0],ductAt:()=>false};
  const simple=factory(createCollisionIndex,[])(fixture);assert.equal(simple.clearSegment(-3,0,3,0),false);
  wall.disabled=true;fixture.collision.invalidate();assert.equal(simple.clearSegment(-3,0,3,0),true);
  wall.disabled=false;fixture.collision.invalidate();assert.equal(simple.clearSegment(-3,0,3,0),false);
 });
 check('collapse and restoration cannot reuse old layered support results',()=>{
  const high=goals.find(p=>p.y);assert.ok(high);assert.equal(nav.isWalkable(high.x,high.z,high.y),true);
  map.world.userData.bomberCollapsed=true;assert.equal(nav.isWalkable(high.x,high.z,high.y),false);assert.equal(nav.clearSegment(-10,0,10,0),true);
  map.world.userData.bomberCollapsed=false;assert.equal(nav.isWalkable(high.x,high.z,high.y),true);safeRoute(starts[0],high);
 });
 check('invalid endpoints cannot produce a path or corrupt later searches',()=>{for(const v of [NaN,Infinity,-Infinity])assert.deepEqual(nav.path(v,0,1,1),[]);safeRoute(starts[0],goals[0]);});
 console.log(JSON.stringify({groups,nodes:nav.nodeCount,audioPlayed:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
