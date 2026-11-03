// Q alone. Inventory ownership stays in the game's ordinary drop/pickup path.
export const URCHIN_DISARM=Object.freeze({range:32,delay:.45,occlusionGrace:.10,maxStock:1,price:100,damage:0,tail:1.2,bodyRadius:.1,bodyStep:1/120,warningAt:.30,growthAt:.15,notice:1.2,dropDistance:.75,dropDuration:.30,dropGravity:15,dropUpSpeed:2,pullDistance:2,pullDuration:.25});
// Relative swept sphere/capsule contact also covers an actor crossing the arc
// between two frames. Teleports are sampled only at their destination.
export function disarmContact(from,to,actor,previous=actor){
 const jump=Math.hypot(actor.x-previous.x,(actor.y||0)-(previous.y||0),actor.z-previous.z)>8;if(jump)previous=actor;
 const p={x:from.x-previous.x,y:from.y-(previous.y||0),z:from.z-previous.z},d={x:to.x-actor.x-p.x,y:to.y-(actor.y||0)-p.y,z:to.z-actor.z-p.z},low=.34,high=Math.max(low,1.75-Math.max(actor.crouch||0,previous.crouch||0)*.55-.34),r=.34+URCHIN_DISARM.bodyRadius;
 let first=Infinity;
 for(const cap of[-1,0,1]){const y=cap?(cap<0?low:high):0,oy=cap?p.y-y:0,A=d.x*d.x+d.z*d.z+(cap?d.y*d.y:0),B=p.x*d.x+p.z*d.z+(cap?oy*d.y:0),C=p.x*p.x+p.z*p.z+(cap?oy*oy:0)-r*r;
  if(A<1e-12){if(C<=0&&(cap<0?p.y<=low:cap>0?p.y>=high:p.y>=low&&p.y<=high))first=0;continue;}
  const disc=B*B-A*C;if(disc<0)continue;const root=Math.sqrt(disc),enter=Math.max(0,(-B-root)/A),exit=Math.min(1,(-B+root)/A),height=p.y+d.y*enter;
  if(enter>exit+1e-8||cap<0&&height>low+1e-8||cap>0&&height<high-1e-8||!cap&&(height<low-1e-8||height>high+1e-8))continue;first=Math.min(first,enter);
 }return first;
}
export const disarmPrimary=spec=>!!spec&&spec.slot==='primary'&&Number.isFinite(spec.price)&&spec.price>0&&spec.mag>0;
export const disarmState=e=>e?.disarm?.[0]||0;
const landing=d=>d.motion?.length===8?{x:d.motion[5]/100,z:d.motion[6]/100,y:d.motion[7]/100}:d;
function fallDuration(drop){const height=Math.max(0,(drop.motion?.[1]||0)/100-(landing(drop).y||0)),v=(drop.motion?.[4]??URCHIN_DISARM.dropUpSpeed*100)/100,g=URCHIN_DISARM.dropGravity;return Math.max(.04,(v+Math.sqrt(v*v+2*g*height))/g);}
export function dropFlightDuration(drop){return fallDuration(drop)+(drop.motion?.length===8?URCHIN_DISARM.pullDuration:0);}
export function dropFlight(drop,now){const m=drop.motion;if(!m)return{x:drop.x,y:drop.y||0,z:drop.z};const end=landing(drop),duration=fallDuration(drop),age=Math.max(0,now-m[3]/1000),seconds=Math.min(duration,age),t=seconds/duration,horizontal=t*(2-t),gravity=URCHIN_DISARM.dropGravity,vy=((end.y||0)-m[1]/100+.5*gravity*duration*duration)/duration;
 if(m.length===8&&age>duration){const u=Math.min(1,(age-duration)/URCHIN_DISARM.pullDuration);return{x:end.x+(drop.x-end.x)*u,y:end.y+((drop.y||0)-end.y)*u,z:end.z+(drop.z-end.z)*u};}
 return{x:m[0]/100+(end.x-m[0]/100)*horizontal,y:m[1]/100+vy*seconds-.5*gravity*seconds*seconds,z:m[2]/100+(end.z-m[2]/100)*horizontal};}
export function validDropMotion(m,drop,now){if(!Array.isArray(m)||![5,8].includes(m.length)||!m.every(Number.isSafeInteger)||!m.slice(0,3).every(n=>Math.abs(n)<=100000)||m[3]<0||m[3]>now*1000+2||m[4]<0||m[4]>URCHIN_DISARM.dropUpSpeed*100)return false;
 const end=landing({...drop,motion:m});return Math.hypot(m[0]/100-end.x,m[2]/100-end.z)<=URCHIN_DISARM.dropDistance+.03&&m[1]/100>=(end.y||0)-.25&&m[1]/100-(end.y||0)<=200&&(m.length===5||m.slice(5).every(n=>Math.abs(n)<=100000)&&Math.hypot(drop.x-end.x,drop.z-end.z)<=URCHIN_DISARM.pullDistance+.015&&Math.abs((drop.y||0)-end.y)<=.035);}
export function createDisarmLocks(){
 let instances=new WeakMap();const casts=new Map();
 const invalidate=actor=>instances.delete(actor);
 function instance(actor,weapon){let i=instances.get(actor);if(!i||i.weapon!==weapon){i={weapon};instances.set(actor,i);}return i;}
 function begin(event,source,target,weapon){if(!event||casts.has(event.id))return false;casts.set(event.id,{source,target,instance:instance(target,weapon),weapon,blockedSince:null,lastAt:event.startedAt,team:source.team,targetTeam:target.team});return true;}
 function update(events,now,{primary,visible,canDrop,drop,resolve}){
  const active=new Set();for(const e of events){if(e.type!=='urchin-disarm')continue;active.add(e.id);const c=casts.get(e.id);if(!c)continue;
   const {source,target}=c;let fail=!source.alive||!target.alive||source.team!==c.team||target.team!==c.targetTeam||source.team===target.team;
   if(!visible(source,target)){if(c.blockedSince===null)c.blockedSince=now;fail||=now-c.blockedSince+1e-8>=URCHIN_DISARM.occlusionGrace;}else c.blockedSince=null;
   if(now+1e-8>=e.triggerAt){fail||=Math.hypot(target.x-source.x,(target.y||0)-(source.y||0),target.z-source.z)>URCHIN_DISARM.range+1e-8||primary(target)!==c.weapon||instances.get(target)!==c.instance||!canDrop(target,c.weapon);}
   if(fail){resolve(e.id,2,0);casts.delete(e.id);}
   else if(now+1e-8>=e.triggerAt){const item=drop(target,c.weapon,{source,event:e});resolve(e.id,item?1:2,item?.id||0);casts.delete(e.id);}
   c.lastAt=now;
  }for(const id of casts.keys())if(!active.has(id))casts.delete(id);
 }
 // Optional shared tide status hook. This returns a direction only; the game
 // validates the world path and leaves ownership in the normal pickup system.
 const tidePull=(event,target,marked)=>marked?{x:event.fromX,y:event.fromY,z:event.fromZ,distance:URCHIN_DISARM.pullDistance}:null;
 return{begin,update,invalidate,instance,tidePull,reset(){casts.clear();instances=new WeakMap();},get size(){return casts.size;}};
}
