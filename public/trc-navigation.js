import {createCollisionIndex} from './collision.js';
import {TRC_LADDERS} from './trc-layout.js';

// A layered graph: ground, tread tops, gallery floors and crouched ducts can
// occupy the same XZ. Only explicit ladder edges connect disjoint elevations.
export function createTrcNavigation(map){
 const collision=createCollisionIndex(map.colliders.filter(c=>c.kind!=='door'),8),bounds=map.bounds;
 const nodes=[],cells=new Map(),edges=[],cache=new Map(),connectorCells=new Map(),segments=new Map(),step=1,radius=.4;
 let segmentRevision=-1,collapsed=false;
 const key=(x,z)=>`${x},${z}`;
 function support(x,z,wanted=0){
  if(map.world.userData.bomberCollapsed)return 0;
  const options=map.walkHeights(x,z).filter(y=>!collision.blocked(x,z,radius,y,map.ductAt(x,z,y)?1.15:1.7));
  options.sort((a,b)=>Math.abs(a-wanted)-Math.abs(b-wanted));return options[0]??null;
 }
 function isWalkable(x,z,y=0){return Number.isFinite(x)&&Number.isFinite(z)&&Number.isFinite(y)&&x>=bounds.minX+radius&&x<=bounds.maxX-radius&&z>=bounds.minZ+radius&&z<=bounds.maxZ-radius&&(map.world.userData.bomberCollapsed?Math.abs(y)<.19:map.walkHeights(x,z).some(h=>Math.abs(h-y)<.19)&&!collision.blocked(x,z,radius,y,map.ductAt(x,z,y)?1.15:1.7));}
 function clearSegment(ax,az,bx,bz,ay=0,by=ay){
  const revision=map.collision.revision,state=!!map.world.userData.bomberCollapsed;
  if(revision!==segmentRevision||state!==collapsed){segments.clear();segmentRevision=revision;collapsed=state;}
  const k=[ax,az,bx,bz,ay,by].join(',');if(segments.has(k))return segments.get(k);
  const result=traceSegment(ax,az,bx,bz,ay,by);segments.set(k,result);if(segments.size>8192)segments.delete(segments.keys().next().value);return result;
 }
 function traceSegment(ax,az,bx,bz,ay,by){
  const length=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(length/.13));let y=ay;
  if(!isWalkable(ax,az,ay))return false;
  for(let i=1;i<=n;i++){const f=i/n,x=ax+(bx-ax)*f,z=az+(bz-az)*f,next=support(x,z,y);if(next===null||Math.abs(next-y)>.19)return false;y=next;}
  return Math.abs(y-by)<.19;
 }
 for(let z=bounds.minZ+.5;z<bounds.maxZ;z+=step)for(let x=bounds.minX+.5;x<bounds.maxX;x+=step){const ids=[];for(const y of map.walkHeights(x,z)){if(!isWalkable(x,z,y))continue;const id=nodes.length;nodes.push({x,z,y,crouch:!!map.ductAt(x,z,y),id});edges.push([]);ids.push(id);}if(ids.length)cells.set(key(x,z),ids);}
 function connect(a,b,extra={}){const p=nodes[a],q=nodes[b];const cost=Math.hypot(p.x-q.x,p.z-q.z,p.y-q.y)*(p.crouch||q.crouch?3:1)+ (extra.ladder?4:0);edges[a].push({id:b,cost,...extra});edges[b].push({id:a,cost,...extra});}
 for(const p of nodes)for(const [dx,dz]of [[1,0],[0,1],[1,1],[-1,1]])for(const id of cells.get(key(p.x+dx,p.z+dz))||[]){const q=nodes[id];if(Math.abs(q.y-p.y)<=.7&&clearSegment(p.x,p.z,q.x,q.z,p.y,q.y))connect(p.id,id);}
 // Exact endpoints preserve narrow hatches which do not fall on the grid.
 for(const l of TRC_LADDERS){const bottom={x:l.x,z:l.z,y:0},top={...l.exit};const ids=[];for(const p of [bottom,top]){const id=nodes.length;nodes.push({...p,id,crouch:true});edges.push([]);for(const q of nodes.slice(0,id))if(Math.hypot(p.x-q.x,p.z-q.z)<1.8&&Math.abs(p.y-q.y)<.19&&clearSegment(p.x,p.z,q.x,q.z,p.y,q.y))connect(id,q.id);ids.push(id);}connect(ids[0],ids[1],{ladder:l.id});}
 function nearest(x,z,y=0){if(![x,z,y].every(Number.isFinite))return null;if(map.world.userData.bomberCollapsed)return {x:Math.max(bounds.minX+radius,Math.min(bounds.maxX-radius,x)),z:Math.max(bounds.minZ+radius,Math.min(bounds.maxZ-radius,z)),y:0};if(isWalkable(x,z,y))return {x,z,y};let best=null,d=Infinity;for(const p of nodes){const cost=(p.x-x)**2+(p.z-z)**2+16*(p.y-y)**2;if(cost<d){d=cost;best=p;}}return best?{x:best.x,z:best.z,y:best.y}:null;}
 // A connector can only be within 4 m. Include exact ladder endpoints in the
 // same buckets; preserve the old lowest-id tie instead of scanning the map.
 for(const p of nodes){const k=key(Math.floor(p.x/4),Math.floor(p.z/4));if(!connectorCells.has(k))connectorCells.set(k,[]);connectorCells.get(k).push(p);}
 function connector(p){let best=-1,d=Infinity;const cx=Math.floor(p.x/4),cz=Math.floor(p.z/4);for(let z=cz-1;z<=cz+1;z++)for(let x=cx-1;x<=cx+1;x++)for(const q of connectorCells.get(key(x,z))||[]){const c=Math.hypot(p.x-q.x,p.z-q.z)+Math.abs(p.y-q.y)*4;if(c>4||c>d||c===d&&best>=0&&q.id>best)continue;if(clearSegment(p.x,p.z,q.x,q.z,p.y,q.y)){d=c;best=q.id;}}return best;}
 function path(ax,az,bx,bz,ay=0,by=0){
  const a=nearest(ax,az,ay),b=nearest(bx,bz,by);if(!a||!b)return [];
  if(clearSegment(a.x,a.z,b.x,b.z,a.y,b.y))return [{...b,crouch:!!map.ductAt(b.x,b.z,b.y)}];
  const start=connector(a),finish=connector(b);if(start<0||finish<0)return [];
  const ck=start+':'+finish;let route=cache.get(ck);
  if(!route){
   const cost=new Float64Array(nodes.length).fill(Infinity),parent=new Int32Array(nodes.length).fill(-1),via=new Array(nodes.length),order=new Int32Array(nodes.length).fill(-1),closed=new Uint8Array(nodes.length),open=[];let serial=0;cost[start]=0;
   const heuristic=id=>Math.hypot(nodes[id].x-b.x,nodes[id].z-b.z,nodes[id].y-b.y);
   const before=(a,b)=>a.score<b.score||a.score===b.score&&a.order<b.order;
   function push(id){if(order[id]<0)order[id]=serial++;const value={id,cost:cost[id],score:cost[id]+heuristic(id),order:order[id]};let i=open.length;open.push(value);while(i){const p=(i-1)>>1;if(!before(value,open[p]))break;open[i]=open[p];i=p;}open[i]=value;}
   function pop(){const first=open[0],last=open.pop();if(open.length){let i=0;while(i*2+1<open.length){let c=i*2+1;if(c+1<open.length&&before(open[c+1],open[c]))c++;if(!before(open[c],last))break;open[i]=open[c];i=c;}open[i]=last;}return first;}
   push(start);
   while(open.length){const entry=pop(),at=entry.id;if(closed[at]||entry.cost!==cost[at])continue;if(at===finish)break;closed[at]=1;for(const e of edges[at]){if(closed[e.id])continue;const c=cost[at]+e.cost;if(c<cost[e.id]){cost[e.id]=c;parent[e.id]=at;via[e.id]=e.ladder;push(e.id);}}}
   if(!Number.isFinite(cost[finish]))return [];
   route=[];for(let n=finish;n!==start;n=parent[n])route.push({...nodes[n],...(via[n]?{ladder:via[n]}:{})});route.reverse();cache.set(ck,route);if(cache.size>256)cache.delete(cache.keys().next().value);
  }
  // Pull only across verified walkable segments. Exponential lookahead avoids
  // resampling the same long corridor from its start for every 1 m graph node.
  // Never skip a ladder or cross a crouch/standing transition.
  const points=[...route.map(p=>({...p})),b],out=[];let anchor=a;
  for(let i=0;i<points.length;){
   let limit=i;if(!points[i].ladder)while(limit+1<points.length&&!points[limit+1].ladder&&points[limit+1].crouch===points[i].crouch)limit++;
   const clear=id=>clearSegment(anchor.x,anchor.z,points[id].x,points[id].z,anchor.y,points[id].y);
   let j=i,blocked=limit+1,stride=1;
   while(j<limit){const next=Math.min(limit,i+stride);if(!clear(next)){blocked=next;break;}j=next;stride*=2;}
   // Every chosen shortcut is checked; visibility need not be monotonic around
   // a bend. A failed probe only bounds this shortcut, never makes it passable.
   let low=j+1,high=blocked-1;while(low<=high){const mid=(low+high)>>1;if(clear(mid)){j=mid;low=mid+1;}else high=mid-1;}
   out.push(points[j]);anchor=points[j];i=j+1;
  }
  return out;
 }
 return {path,nearest,isWalkable,clearSegment,layered:true,nodeCount:nodes.length};
}
