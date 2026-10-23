import {busCabinRayClear} from './bus-cabin.js';
import {createBusService,BUS_SERVICE,busPoint} from './bus-service.js';
// Deterministic environmental traffic. The host alone calls impacts(); rendering
// uses the same clock on guests. No audio and no actor/room references here.
export const BUS_SPEC=Object.freeze({speed:11.2,width:2.5,length:10.6,height:3.25,damage:150,cooldown:1.25,launchSeconds:.8});
export function ovalRoute(cx,cz,rx,rz,count=80){return Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count;return{x:cx+Math.cos(a)*rx,z:cz+Math.sin(a)*rz};});}
export const HIRAKATA_BUS_ROUTES=Object.freeze([
 {id:'south-1',points:ovalRoute(0,49,49,17),offset:0},
 {id:'south-2',points:ovalRoute(0,49,49,17),offset:125},
 {id:'north-1',points:ovalRoute(29,-49,30,14),offset:30},
 {id:'north-2',points:ovalRoute(29,-49,30,14),offset:118},
]);
export function createTrafficClock(routes=HIRAKATA_BUS_ROUTES){
 const tracks=routes.map(r=>{const points=[r.points[0],...r.points.slice(1).reverse()],segments=points.map((p,i)=>{const q=points[(i+1)%points.length];return{p,q,length:Math.hypot(q.x-p.x,q.z-p.z)};});return{...r,segments,length:segments.reduce((s,v)=>s+v.length,0)};});
 function routePose(r,d){d=(d%r.length+r.length)%r.length;for(let i=0;i<r.segments.length;i++){const s=r.segments[i];if(d<=s.length){const f=d/s.length,prev=r.segments[(i+r.segments.length-1)%r.segments.length],next=r.segments[(i+1)%r.segments.length],sx=(s.q.x-s.p.x)/s.length,sz=(s.q.z-s.p.z)/s.length;let dx=sx+(prev.q.x-prev.p.x)/prev.length*(1-f)+(next.q.x-next.p.x)/next.length*f,dz=sz+(prev.q.z-prev.p.z)/prev.length*(1-f)+(next.q.z-next.p.z)/next.length*f;const length=Math.hypot(dx,dz);dx/=length;dz/=length;return{id:r.id,x:s.p.x+(s.q.x-s.p.x)*f,z:s.p.z+(s.q.z-s.p.z)*f,yaw:Math.atan2(dx,dz),dx,dz};}d-=s.length;}return null;}
 // A stop once per lap; offsets retain each vehicle's initial road position.
 for(const r of tracks){r.stopDistance=r.segments.slice(0,Math.round(r.segments.length*(r.id.startsWith('south')?.25:.75))).reduce((n,s)=>n+s.length,0);r.first=((r.stopDistance-r.offset)%r.length+r.length)%r.length/BUS_SPEC.speed;r.cycle=r.length/BUS_SPEC.speed+BUS_SERVICE.dwell;}
 function schedule(time){return tracks.map(r=>{time=Math.max(0,time);let d,door=false,eta;
  if(time<r.first){d=r.offset+time*BUS_SPEC.speed;eta=r.first-time;}
  else{const phase=(time-r.first)%r.cycle;door=phase<BUS_SERVICE.dwell;d=r.stopDistance+Math.max(0,phase-BUS_SERVICE.dwell)*BUS_SPEC.speed;eta=door?0:r.cycle-phase;}
  return{...routePose(r,d),speed:door?0:BUS_SPEC.speed,door,eta};});}
 const service=createBusService(schedule),poses=time=>service.poses(time);
 function stops(time){return ['south','north'].map(prefix=>{const related=poses(time).filter(p=>p.id.startsWith(prefix)),p=routePose(tracks.find(r=>r.id.startsWith(prefix)),tracks.find(r=>r.id.startsWith(prefix)).stopDistance),available=related.filter(p=>!poses(time).find(v=>v.id===p.id)?.diverted);return{...p,id:prefix,eta:available.length?Math.min(...available.map(p=>p.eta)):null,door:available.some(p=>p.door)};});}
 const cooldown=new Map(),previous=new Map();let last=null,sequence=0;
 function reset(time=null,options){cooldown.clear();previous.clear();last=time;sequence=0;service.reset(options);}
 function impacts(actors,time,{enabled=true}={}){
  if(!Number.isFinite(time)||time<0)return[];
  // A clock correction invalidates swept contacts, never host-owned vehicles.
  if(last!==null&&time<last){cooldown.clear();previous.clear();last=time;sequence=0;return[];}
  const start=last===null?time:Math.max(last,time-.25),dt=time-start,result=[];
  for(const[id,end]of cooldown)if(end<=time)cooldown.delete(id);
  if(enabled){const count=Math.max(1,Math.ceil(dt/.025));
   for(const actor of actors){if(!actor?.alive||cooldown.has(actor.id)||service.seat(actor.id))continue;const old=previous.get(actor.id),prev=old?.alive?old:actor;
    for(let i=0;i<=count;i++){const f=i/count,t=start+dt*f,x=prev.x+(actor.x-prev.x)*f,z=prev.z+(actor.z-prev.z)*f,y=(prev.y||0)+((actor.y||0)-(prev.y||0))*f;if(y>=BUS_SPEC.height||y+1.7<=0)continue;
     const bus=poses(t).find(p=>{if(Math.abs(p.speed)<.5)return false;const dx=x-p.x,dz=z-p.z,side=dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw),along=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw);return Math.abs(side)<=BUS_SPEC.width/2+.34&&Math.abs(along)<=BUS_SPEC.length/2+.34;});
     if(bus){const side=(x-bus.x)*Math.cos(bus.yaw)-(z-bus.z)*Math.sin(bus.yaw),sign=side<0?-1:1;result.push({actorId:actor.id,busId:bus.id,owner:bus.owner,sequence:++sequence,damage:BUS_SPEC.damage,vx:bus.dx*13*Math.sign(bus.speed)+Math.cos(bus.yaw)*sign*5,vz:bus.dz*13*Math.sign(bus.speed)-Math.sin(bus.yaw)*sign*5,vy:5.6,endsAt:time+BUS_SPEC.launchSeconds});cooldown.set(actor.id,time+BUS_SPEC.cooldown);break;}
    }
   }
  }
  previous.clear();for(const a of actors)previous.set(a.id,{x:a.x,y:a.y||0,z:a.z,alive:a.alive});last=time;return result;
 }
 function dangerous(x,z,time,horizon=.65){for(let t=0;t<=horizon;t+=.13)for(const p of poses(time+t)){const dx=x-p.x,dz=z-p.z;if(Math.abs(dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw))<2.05&&Math.abs(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))<6.4)return true;}return false;}
 function rayClear(a,b,time){return poses(time).every(p=>busCabinRayClear(a,b,p));}
 return{poses,impacts,reset,dangerous,rayClear,service,stops};
}

export {createBoardableBusModels as createBusModels} from './bus-models.js';
