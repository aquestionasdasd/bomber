import {createCollisionIndex, rampHeight, movementTop} from './collision.js';
import {createTrafficNavigation} from './traffic-navigation.js';
import {BUS_SPEC} from './bus-traffic.js';

// One-metre cells are created on demand. Distinct floors at the same XZ remain
// distinct nodes; only a continuously supported walk can connect their heights.
export function createHirakataNavigation(map,createGroundNavigation) {
  const radius=.42, bounds=map.bounds, solid=map.collision||createCollisionIndex(map.colliders);
  const traffic=map.traffic?.poses?createTrafficNavigation({...map,collision:solid}):null;
  const collision=traffic?.collision||solid, cells=new Map(), segments=new Map(), routes=new Map(),groundEdges=new Map(),heightCache=new Map(),profiles=new Map();
  const finished=[];
  const boundedMisses=new Map();
  const preferredStairs=new Map();
  // Bus motion must not discard the city's static occupancy and route caches.
  // Only routes actually intersecting traffic need the separate detour grid.
  const ground=createGroundNavigation?.({...map,collision:solid});
  let trafficGround=null;
  const left=bounds.minX+.5, top=bounds.minZ+.5;
  const width=Math.floor(bounds.maxX-bounds.minX), depth=Math.floor(bounds.maxZ-bounds.minZ);
  let revision=-1, staticRevision=-1, collapsed=false, nodeCount=0,portals=null,trafficActive=false;
  let barriers=createCollisionIndex((map.colliders||[]).filter(c=>!c.movementRamp));
  const collapse=()=>!!map.world?.userData?.bomberCollapsed;
  const buildGroundPortals=()=>(map.ramps||[]).filter(r=>!r.disabled&&r.base<.001&&r.height>.22).map(r=>{
    const axis=r.axis==='x'?'X':'Z',lo='min'+axis,hi='max'+axis,out={...r,sourceRamp:r};
    const reach=(r[hi]-r[lo])*.22/r.height;
    if(r.direction===-1)out[lo]=r[hi]-reach;else out[hi]=r[lo]+reach;
    return out;
  });
  let groundPortals=buildGroundPortals();
  const distanceToPortal=(p,r)=>Math.hypot(Math.max(0,r.minX-radius-p.x,p.x-r.maxX-radius),Math.max(0,r.minZ-radius-p.z,p.z-r.maxZ-radius));
  function refresh() {
    const next=collision.revision, stat=solid.revision, state=collapse();
    const geometryChanged=stat!==staticRevision||state!==collapsed;
    if(geometryChanged){cells.clear();heightCache.clear();profiles.clear();routes.clear();groundEdges.clear();boundedMisses.clear();preferredStairs.clear();finished.length=0;nodeCount=0;portals=null;groundPortals=state?[]:buildGroundPortals();barriers=createCollisionIndex((map.colliders||[]).filter(c=>!c.movementRamp));staticRevision=stat;collapsed=state;}
    if(next!==revision||geometryChanged){segments.clear();groundEdges.clear();revision=next;}
  }
  const within=(x,z)=>x>=bounds.minX+radius&&x<=bounds.maxX-radius&&z>=bounds.minZ+radius&&z<=bounds.maxZ-radius;
  function heights(x,z) {
    const key=x+','+z;if(heightCache.has(key))return heightCache.get(key);
    if(collapse())return[0];
    const values=map.walkHeights(x,z).filter(Number.isFinite),extra=[];
    // moveEntity steps onto a landing when its .42 m body overlaps an ankle-
    // height edge. Include exactly that support, without inventing a floor.
    for(const c of solid.query(x,z,radius))if(!c.disabled&&solid.overlaps(c,x,z,radius)){
      const h=movementTop(c,x,z);
      if(values.some(y=>h>y&&h<=y+.22+1e-8))extra.push(h);
    }
    const result=[...new Set([...values,...extra])].filter(y=>!solid.blocked(x,z,radius,y,1.7));
    heightCache.set(key,result);if(heightCache.size>65536)heightCache.delete(heightCache.keys().next().value);
    return result;
  }
  function isWalkable(x,z,y=0,dynamic=true) {
    refresh();
    return [x,z,y].every(Number.isFinite)&&within(x,z)&&heights(x,z).some(h=>Math.abs(h-y)<.035)
      &&(!dynamic||!trafficActive||y>=BUS_SPEC.height||!collision.blocked(x,z,radius,y,1.7));
  }
  function support(x,z,wanted) {
    if(!within(x,z))return null;
    let best=null,d=Infinity;
    for(const y of heights(x,z)){
      const delta=Math.abs(y-wanted);if(delta<d){d=delta;best=y;}
    }
    return best;
  }
  function trace(ax,az,bx,bz,ay,by) {
    if(!isWalkable(ax,az,ay,false)||!isWalkable(bx,bz,by,false))return null;
    // Hirakata's ground plane always supplies y=0. A continuous collision test
    // proves that this entire level segment stays on that plane.
    if(ay===0&&by===0&&solid.segmentClear(ax,az,bx,bz,radius,0,1.7)){
      const samples=[ax,az,0,bx,bz,0];samples.ground=true;samples.feet=0;return samples;
    }
    // One rectangular slab containing both centres also contains the entire
    // segment. Only that exact, enabled floor can replace support sampling;
    // separate slabs, holes, polygons and ramps retain the trace below.
    if(ay===by&&ay>0&&solid.query(ax,az,0).some(c=>!c.disabled&&c.kind==='surface'&&!c.polygon&&!c.holes&&!c.movementRamp&&c.height===ay
      &&ax>=c.minX&&ax<=c.maxX&&az>=c.minZ&&az<=c.maxZ&&bx>=c.minX&&bx<=c.maxX&&bz>=c.minZ&&bz<=c.maxZ)
      &&solid.segmentClear(ax,az,bx,bz,radius,ay,1.7)){
      const samples=[ax,az,ay,bx,bz,by];samples.feet=ay;return samples;
    }
    const count=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/.13));
    let y=ay,px=ax,pz=az;const samples=[ax,az,ay];
    for(let i=1;i<=count;i++){
      const f=i/count,x=ax+(bx-ax)*f,z=az+(bz-az)*f,next=support(x,z,y);
      if(next===null)return null;
      if(Math.abs(next-y)>.19&&!(map.ramps||[]).some(r=>{
        if([px,x].some(v=>v<r.minX||v>r.maxX)||[pz,z].some(v=>v<r.minZ||v>r.maxZ))return false;
        return Math.abs(y-rampHeight(r,px,pz))<=.22&&Math.abs(next-rampHeight(r,x,z))<=.22;
      }))return null;
      // The interval is short, but a thin railing must not fall between samples.
      // Along ramps, the continuous movement surface supplies the support height.
      const feet=Math.max(y,next);
      if(!barriers.segmentClear(px,pz,x,z,radius,feet,1.7))return null;
      y=next;px=x;pz=z;samples.push(x,z,y);
    }
    return Math.abs(y-by)<.035?samples:null;
  }
  function clearSegment(ax,az,bx,bz,ay=0,by=ay) {
    refresh();
    if(![ax,az,bx,bz,ay,by].every(Number.isFinite))return false;
    const key=[ax,az,bx,bz,ay,by].join(',');
    if(segments.has(key))return segments.get(key);
    if(!profiles.has(key)){profiles.set(key,trace(ax,az,bx,bz,ay,by));if(profiles.size>32768)profiles.delete(profiles.keys().next().value);}
    const profile=profiles.get(key);let result=!!profile;
    if(result&&trafficActive){
      if(profile.feet!==undefined)result=collision.segmentClear(ax,az,bx,bz,radius,profile.feet,1.7);
      else for(let i=0;i<profile.length;i+=3){if(profile[i+2]>=BUS_SPEC.height)continue;if(collision.blocked(profile[i],profile[i+1],radius,profile[i+2],1.7)){result=false;break;}}
    }
    segments.set(key,result);
    if(segments.size>16384)segments.delete(segments.keys().next().value);
    return result;
  }
  function staticSegment(ax,az,bx,bz,ay=0,by=ay){
    refresh();const key=[ax,az,bx,bz,ay,by].join(',');
    if(!profiles.has(key)){profiles.set(key,trace(ax,az,bx,bz,ay,by));if(profiles.size>32768)profiles.delete(profiles.keys().next().value);}
    return !!profiles.get(key);
  }
  function cell(ix,iz) {
    if(ix<0||iz<0||ix>=width||iz>=depth)return [];
    const key=ix+iz*width;if(cells.has(key))return cells.get(key);
    const x=left+ix,z=top+iz,ys=[...new Set(heights(x,z).filter(Number.isFinite))];
    const nodes=ys.map(y=>({x,z,y,ix,iz,id:`${key}:${y}`}));
    cells.set(key,nodes);nodeCount+=nodes.length;return nodes;
  }
  function nearest(x,z,y=0) {
    refresh();if(![x,z,y].every(Number.isFinite))return null;
    if(isWalkable(x,z,y))return{x,z,y};
    const cx=Math.round(x-left),cz=Math.round(z-top);let best=null,d=Infinity;
    for(let ring=0;ring<=32;ring++){
      for(let dz=-ring;dz<=ring;dz++)for(let dx=-ring;dx<=ring;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dz))!==ring)continue;
        for(const p of cell(cx+dx,cz+dz)){
          const cost=(p.x-x)**2+(p.z-z)**2+16*(p.y-y)**2;
          if(cost<d&&isWalkable(p.x,p.z,p.y)){d=cost;best=p;}
        }
      }
      if(best&&(ring-.75)**2>d)break;
    }
    return best?{x:best.x,z:best.z,y:best.y}:null;
  }
  function connector(p) {
    const cx=Math.round(p.x-left),cz=Math.round(p.z-top),candidates=[];
    for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++)for(const q of cell(cx+dx,cz+dz)){
      const cost=Math.hypot(p.x-q.x,p.z-q.z)+4*Math.abs(p.y-q.y);
      if(cost<=4)candidates.push({p:q,cost});
    }
    candidates.sort((a,b)=>a.cost-b.cost||a.p.id.localeCompare(b.p.id));
    return candidates.find(q=>clearSegment(p.x,p.z,q.p.x,q.p.z,p.y,q.p.y))?.p||null;
  }
  function groundConnections() {
    if(portals)return portals;
    const result=new Map();
    for(const r of groundPortals){
      const cx=(r.minX+r.maxX)/2,cz=(r.minZ+r.maxZ)/2,candidates=[];
      for(let iz=Math.floor(r.minZ-top)-2;iz<=Math.ceil(r.maxZ-top)+2;iz++)for(let ix=Math.floor(r.minX-left)-2;ix<=Math.ceil(r.maxX-left)+2;ix++)for(const p of cell(ix,iz)){
        if(Math.abs(p.y)>.001||!within(p.x,p.z)||solid.blocked(p.x,p.z,radius,0))continue;
        const enters=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].some(([dx,dz])=>cell(ix+dx,iz+dz).some(q=>q.y>.001&&q.y<1&&q.x>=r.minX-1&&q.x<=r.maxX+1&&q.z>=r.minZ-1&&q.z<=r.maxZ+1));
        if(enters)candidates.push(p);
      }
      candidates.sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz));
      // A centre and a separated alternate keep wide stair feet available if
      // traffic covers one side. Every macro edge still uses exact ground nav.
      const first=candidates[0];if(first){result.set(first.id,{...first,portalRamp:r.id});const alternate=candidates.find(p=>Math.hypot(p.x-first.x,p.z-first.z)>=1.4);if(alternate)result.set(alternate.id,{...alternate,portalRamp:r.id});}
    }
    portals=[...result.values()];return portals;
  }
  function groundEdge(p,q) {
    const key=p.id+'>'+q.id;if(groundEdges.has(key))return groundEdges.get(key);
    const points=groundPath(p.x,p.z,q.x,q.z);let previous=p,cost=0;
    const valid=points.length&&Math.hypot(points.at(-1).x-q.x,points.at(-1).z-q.z)<.01&&points.every(point=>{
      const ok=clearSegment(previous.x,previous.z,point.x,point.z,0,0);cost+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;return ok;
    });
    const result=valid?{points:points.map(v=>({...v,y:0})),cost}:null;groundEdges.set(key,result);return result;
  }
  function groundPath(ax,az,bx,bz) {
    const points=ground.path(ax,az,bx,bz);if(!points.length)return points;
    let previous={x:ax,z:az};
    if(points.every(p=>{const ok=clearSegment(previous.x,previous.z,p.x,p.z,0,0);previous=p;return ok;}))return points;
    if(!traffic||!trafficActive)return [];
    trafficGround||=createGroundNavigation({...map,collision});
    return trafficGround.path(ax,az,bx,bz);
  }
  function remember(from,to,points) {
    // Movement consumes its returned waypoints with shift(); retain our own
    // array and points so a bot cannot empty another request's cached route.
    finished.push({from,to,points:points.map(p=>({...p})),revision,validFrom:0});if(finished.length>64)finished.shift();
    return points;
  }
  function reuseFinished(a,b) {
    for(const entry of finished){
      if(Math.hypot(b.x-entry.to.x,b.z-entry.to.z,b.y-entry.to.y)>1.5)continue;
      // Locate progress along the saved polyline, not just near its old start.
      // A bot beyond a corner must receive the remaining suffix, never the
      // consumed corner again. Floor distance is part of this projection.
      let previous=entry.from,index=-1,best=9;
      for(let i=0;i<entry.points.length;i++){
        const p=entry.points[i],dx=p.x-previous.x,dz=p.z-previous.z,dy=p.y-previous.y,length=dx*dx+dz*dz+dy*dy;
        const t=length?Math.max(0,Math.min(1,((a.x-previous.x)*dx+(a.z-previous.z)*dz+(a.y-previous.y)*dy)/length)):0;
        const d=(a.x-previous.x-dx*t)**2+(a.z-previous.z-dz*t)**2+(a.y-previous.y-dy*t)**2;
        if(d<=best){best=d;index=i;}previous=p;
      }
      if(index<0)continue;
      const first=entry.points[index],last=entry.points.at(-1);
      if(!clearSegment(a.x,a.z,first.x,first.z,a.y,first.y)||!clearSegment(last.x,last.z,b.x,b.z,last.y,b.y))continue;
      if(entry.revision!==revision||index<entry.validFrom){
        previous=first;
        const safe=entry.points.slice(index+1).every(p=>{const ok=clearSegment(previous.x,previous.z,p.x,p.z,previous.y,p.y);previous=p;return ok;});
        if(!safe)continue;
        entry.validFrom=entry.revision===revision?Math.min(entry.validFrom,index):index;entry.revision=revision;
      }
      const suffix=entry.points.slice(index).map(p=>({...p}));
      if(Math.hypot(last.x-b.x,last.z-b.z,last.y-b.y)>.001)suffix.push({...b});
      return suffix;
    }
    return null;
  }
  function search(start,finish,upperOnly=false,budget={left:2048}) {
    const key=(upperOnly?'upper:':'')+start.id+'>'+finish.id;
    const edgeClear=upperOnly?staticSegment:clearSegment;
    function reusable(entry) {
      if(entry.revision===revision)return true;
      let previous=entry.start;
      if(!entry.points.every(p=>{const ok=edgeClear(previous.x,previous.z,p.x,p.z,previous.y,p.y);previous=p;return ok;}))return false;
      entry.revision=revision;return true;
    }
    const exact=routes.get(key);if(exact){if(reusable(exact))return exact.points;routes.delete(key);}
    // Pursuit frequently moves its start into the adjacent metre cell. Reuse
    // the nearby supported route after checking the new connector and buses.
    for(const entry of routes.values())if(entry.upperOnly===upperOnly&&Math.hypot(entry.target.x-finish.x,entry.target.z-finish.z,entry.target.y-finish.y)<=3&&Math.hypot(entry.start.x-start.x,entry.start.z-start.z,entry.start.y-start.y)<=3&&reusable(entry)
      &&edgeClear(start.x,start.z,entry.start.x,entry.start.z,start.y,entry.start.y)&&edgeClear(entry.target.x,entry.target.z,finish.x,finish.z,entry.target.y,finish.y))return[entry.start,...entry.points,finish];
    const missKey=start.id+'>'+finish.id;
    if(upperOnly&&boundedMisses.has(missKey))return null;
    const costs=new Map([[start.id,0]]),parents=new Map(),closed=new Set(),open=[];
    let serial=0;
    const descent=upperOnly&&Math.abs(finish.y)<.001?groundPortals.find(r=>distanceToPortal(finish,r)<2)?.sourceRamp:null;
    const stairTop=descent?{x:descent.axis==='x'?(descent.direction===-1?descent.minX:descent.maxX):(descent.minX+descent.maxX)/2,
      z:descent.axis==='x'?(descent.minZ+descent.maxZ)/2:(descent.direction===-1?descent.minZ:descent.maxZ),y:descent.base+descent.height}:null;
    const heuristic=p=>{
      const direct=Math.hypot(p.x-finish.x,p.z-finish.z,p.y-finish.y);
      if(stairTop&&p.y>=stairTop.y-.22)return Math.hypot(p.x-stairTop.x,p.z-stairTop.z,p.y-stairTop.y)+Math.hypot(stairTop.x-finish.x,stairTop.z-finish.z,stairTop.y-finish.y);
      if(upperOnly||!groundPortals.length||(p.y>.22)===(finish.y>.22))return direct;
      const low=p.y<=.22?p:finish,high=p.y<=.22?finish:p;
      // Every supported ground/upper transition crosses a real stair foot.
      // Independent distances to its low rectangle remain a lower bound.
      const via=Math.min(...groundPortals.map(r=>distanceToPortal(low,r)+Math.hypot(distanceToPortal(high,r),Math.max(0,high.y-.22))));
      return Math.max(direct,via);
    };
    const before=(a,b)=>a.score<b.score||a.score===b.score&&a.order<b.order;
    function push(p,cost,pending=null) {
      // A modest goal bias avoids exploring every equivalent tile across the
      // station. Tactical deadline decisions use the measured returned route,
      // not this search priority; every edge still receives exact validation.
      const item={p,cost,score:cost+heuristic(p)*1.2,order:serial++,pending};let i=open.length;open.push(item);
      while(i){const parent=(i-1)>>1;if(!before(item,open[parent]))break;open[i]=open[parent];i=parent;}open[i]=item;
    }
    function pop() {
      const first=open[0],last=open.pop();if(open.length){let i=0;
        while(i*2+1<open.length){let c=i*2+1;if(c+1<open.length&&before(open[c+1],open[c]))c++;
          if(!before(open[c],last))break;open[i]=open[c];i=c;}open[i]=last;}return first;
    }
    push(start,0);
    while(open.length){
      const {p,cost,pending}=pop();
      if(pending){
        if(closed.has(p.id)||cost>=(costs.get(p.id)??Infinity))continue;
        const edge=groundEdge(pending.from,p);if(!edge)continue;const next=pending.cost+edge.cost;
        if(next<(costs.get(p.id)??Infinity)){costs.set(p.id,next);parents.set(p.id,{parent:pending.from,points:edge.points});push(p,next);}
        continue;
      }
      if(closed.has(p.id)||cost!==costs.get(p.id))continue;
      if(p.id===finish.id){const result=[];let at=p;while(at.id!==start.id){const edge=parents.get(at.id);result.push(...(edge.points||[at]).slice().reverse());at=edge.parent;}result.reverse();routes.set(key,{points:result,start,target:finish,finish:finish.id,revision,upperOnly});if(routes.size>128)routes.delete(routes.keys().next().value);return result;}
      closed.add(p.id);
      if(--budget.left<0)return null;
      if(closed.size>512){if(upperOnly){boundedMisses.set(missKey,true);if(boundedMisses.size>256)boundedMisses.delete(boundedMisses.keys().next().value);}return null;}
      if(ground&&!upperOnly&&Math.abs(p.y)<.001){
        for(const q of [...groundConnections(),...(Math.abs(finish.y)<.001?[finish]:[])]){
          if(q.id===p.id||closed.has(q.id)||!isWalkable(q.x,q.z,0))continue;
          const lower=cost+Math.hypot(q.x-p.x,q.z-p.z);if(lower>=(costs.get(q.id)??Infinity))continue;
          // Resolve a long ground route only when its lower bound reaches the
          // front of A*. Far stair entrances no longer stall the first request.
          push(q,lower,{from:p,cost});
        }
      }
      for(const [dx,dz]of [[2,0],[-2,0],[0,2],[0,-2],[2,2],[2,-2],[-2,2],[-2,-2],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])for(const q of cell(p.ix+dx,p.iz+dz)){
        if(upperOnly&&Math.abs(q.y)<.001&&![start,finish].some(v=>Math.abs(v.y)<.001&&Math.hypot(v.x-q.x,v.z-q.z)<=3))continue;
        if(ground&&!upperOnly&&Math.abs(p.y)<.001&&Math.abs(q.y)<.001)continue;
        if(closed.has(q.id)||!edgeClear(p.x,p.z,q.x,q.z,p.y,q.y))continue;
        const next=cost+Math.hypot(q.x-p.x,q.z-p.z,q.y-p.y);
        if(next<(costs.get(q.id)??Infinity)){costs.set(q.id,next);parents.set(q.id,{parent:p});push(q,next);}
      }
    }
    if(upperOnly){boundedMisses.set(missKey,true);if(boundedMisses.size>256)boundedMisses.delete(boundedMisses.keys().next().value);}return null;
  }
  function path(ax,az,bx,bz,ay=0,by=0) {
    refresh();const a=nearest(ax,az,ay),b=nearest(bx,bz,by);if(!a||!b)return [];
    const reused=reuseFinished(a,b);if(reused)return reused;
    if(ground&&Math.abs(a.y)<.001&&Math.abs(b.y)<.001){
      const flat=groundPath(a.x,a.z,b.x,b.z);let previous=a;
      if(flat.length&&flat.every(p=>{const ok=clearSegment(previous.x,previous.z,p.x,p.z,0,0);previous=p;return ok;}))return remember(a,b,flat.map(p=>({...p,y:0})));
    }
    if(clearSegment(a.x,a.z,b.x,b.z,a.y,b.y))return[b];
    const start=connector(a),finish=connector(b);if(!start||!finish)return [];
    if(ground&&start.y>.22&&finish.y>.22){
      // Distinct authored upper districts already have a supported transfer.
      // Try that bounded route before spending a mixed search on the city;
      // retain the mixed search if either validated transfer leg fails.
      // Direct visible routes above still win, but other upper alternatives
      // need not be identical to the previous mixed-search-first choice.
      const hintAt=p=>(map.navigationStairHints||[]).find(h=>p.x>=h.minX&&p.x<=h.maxX&&p.z>=h.minZ&&p.z<=h.maxZ&&p.y>=h.minY&&p.y<=h.maxY);
      const fromHint=hintAt(start),toHint=hintAt(finish);
      if(fromHint&&toHint&&fromHint.rampId!==toHint.rampId){
        const transfer=groundConnections().filter(p=>p.portalRamp===toHint.rampId&&isWalkable(p.x,p.z,0))
          .sort((p,q)=>Math.hypot(p.x-b.x,p.z-b.z)-Math.hypot(q.x-b.x,q.z-b.z))[0];
        if(transfer){
          // Both recursive calls have one ground endpoint, so neither can
          // enter this branch; each keeps its existing 2048-node budget.
          const down=path(a.x,a.z,transfer.x,transfer.z,a.y,0);
          const up=down.length?path(transfer.x,transfer.z,b.x,b.z,0,b.y):[];
          if(down.length&&up.length)return remember(a,b,[...down,...up]);
        }
      }
    }
    let route=null;const budget={left:2048};
    if(ground&&(Math.abs(start.y)<.001)!==(Math.abs(finish.y)<.001)){
      const descending=Math.abs(finish.y)<.001,high=descending?start:finish,low=descending?finish:start;
      const highKey=[Math.floor(high.x/4),Math.floor(high.z/4),Math.round(high.y*2)].join(':');
      const hint=(map.navigationStairHints||[]).find(h=>high.x>=h.minX&&high.x<=h.maxX&&high.z>=h.minZ&&high.z<=h.maxZ&&high.y>=h.minY&&high.y<=h.maxY);
      const preferred=hint?.rampId||preferredStairs.get(highKey);
      const usedRamps=new Set(),candidates=groundConnections().filter(p=>isWalkable(p.x,p.z,0)).sort((p,q)=>
        (q.portalRamp===preferred)-(p.portalRamp===preferred)||
        (Math.hypot(p.x-high.x,p.z-high.z)+.1*Math.hypot(p.x-low.x,p.z-low.z))-(Math.hypot(q.x-high.x,q.z-high.z)+.1*Math.hypot(q.x-low.x,q.z-low.z)));
      // A usable nearby staircase is sufficient; do not search the full city
      // to prove it is globally shortest. The returned length drives deadlines.
      for(const portal of candidates){
        if(budget.left<=0)break;
        if(usedRamps.has(portal.portalRamp))continue;usedRamps.add(portal.portalRamp);
        if(!isWalkable(portal.x,portal.z,0))continue;
        const flat=groundEdge(descending?portal:start,descending?finish:portal);if(!flat)continue;
        let upper;
        if(hint&&hint.rampId===portal.portalRamp&&hint.via?.length){
          const checkpoints=descending?[start,...hint.via,portal]:[portal,...hint.via.slice().reverse(),finish];upper=[];
          for(let i=1;i<checkpoints.length;i++){
            const p=checkpoints[i-1],q=checkpoints[i];
            if(staticSegment(p.x,p.z,q.x,q.z,p.y,q.y)){upper.push(q);continue;}
            const u=connector(p),v=connector(q),part=u&&v?search(u,v,true,budget):null;
            if(!part){upper=null;break;}upper.push(u,...part,q);
          }
        }else upper=descending?search(start,portal,true,budget):search(portal,finish,true,budget);
        if(!upper)continue;
        route=descending?[...upper,...flat.points]:[...flat.points,...upper];preferredStairs.set(highKey,portal.portalRamp);if(preferredStairs.size>256)preferredStairs.delete(preferredStairs.keys().next().value);break;
      }
    }else route=search(start,finish,false,budget);
    if(!route)return [];
    const points=[start,...route,b],result=[];let anchor=a;
    for(let i=0;i<points.length;){
      // Exponential probes keep long, open roads cheap. Every selected shortcut
      // is checked at its own floor; no skipped corner or wall-climbing edge.
      let end=i,stride=1,blocked=points.length;
      if(!clearSegment(anchor.x,anchor.z,points[end].x,points[end].z,anchor.y,points[end].y))return [];
      while(end<points.length-1){const next=Math.min(points.length-1,i+stride);
        if(!clearSegment(anchor.x,anchor.z,points[next].x,points[next].z,anchor.y,points[next].y)){blocked=next;break;}
        end=next;stride*=2;
      }
      let lo=end+1,hi=blocked-1;while(lo<=hi){const mid=(lo+hi)>>1;
        if(clearSegment(anchor.x,anchor.z,points[mid].x,points[mid].z,anchor.y,points[mid].y)){end=mid;lo=mid+1;}else hi=mid-1;
      }
      const p=points[end];result.push({x:p.x,z:p.z,y:p.y});anchor=p;i=end+1;
    }
    return remember(a,b,result);
  }
  return {path,nearest,isWalkable,clearSegment,layered:true,get nodeCount(){return nodeCount;},
    ...(traffic?{updateTraffic(now){traffic.updateTraffic(now);trafficActive=true;},
      trafficStep:(ax,az,bx,bz,y=0)=>y>=BUS_SPEC.height||y+1.7<=0||traffic.trafficStep(ax,az,bx,bz),
      trafficEscape:(x,z,y=0)=>y>=BUS_SPEC.height||y+1.7<=0?null:traffic.trafficEscape(x,z)}:{})};
}
