// Q alone. Inventory ownership stays in the game's ordinary drop/pickup path.
export const URCHIN_DISARM=Object.freeze({range:32,delay:.45,occlusionGrace:.10,maxStock:1,price:100,damage:0,tail:1.2,warningAt:.30,growthAt:.15,notice:1.2,dropDistance:.75,dropDuration:.30,dropGravity:15,dropUpSpeed:2,pullDistance:2,pullDuration:.25});
export const disarmPrimary=spec=>!!spec&&spec.slot==='primary'&&Number.isFinite(spec.price)&&spec.price>0&&spec.mag>0;
export const disarmState=e=>e?.disarm?.[0]||0;
export function dropFlightDuration(drop){const height=Math.max(0,(drop.motion?.[1]||0)/100-(drop.y||0)),v=(drop.motion?.[4]??URCHIN_DISARM.dropUpSpeed*100)/100,g=URCHIN_DISARM.dropGravity;return Math.max(.04,(v+Math.sqrt(v*v+2*g*height))/g);}
export function dropFlight(drop,now){const m=drop.motion;if(!m)return{x:drop.x,y:drop.y||0,z:drop.z};const duration=dropFlightDuration(drop),seconds=Math.max(0,Math.min(duration,now-m[3]/1000)),t=seconds/duration,horizontal=t*(2-t),gravity=URCHIN_DISARM.dropGravity,vy=((drop.y||0)-m[1]/100+.5*gravity*duration*duration)/duration;return{x:m[0]/100+(drop.x-m[0]/100)*horizontal,y:m[1]/100+vy*seconds-.5*gravity*seconds*seconds,z:m[2]/100+(drop.z-m[2]/100)*horizontal};}
export function validDropMotion(m,drop,now){return Array.isArray(m)&&m.length===5&&m.every(Number.isSafeInteger)&&m.slice(0,3).every(n=>Math.abs(n)<=100000)&&m[3]>=0&&m[3]<=now*1000+2&&m[4]>=0&&m[4]<=URCHIN_DISARM.dropUpSpeed*100&&Math.hypot(m[0]/100-drop.x,m[2]/100-drop.z)<=URCHIN_DISARM.dropDistance+.03&&m[1]/100>=(drop.y||0)-.25&&m[1]/100-(drop.y||0)<=200;}
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
 // No tide-mark is implemented. A future status adapter may return a bounded
 // world-item pull here; it must never transfer ownership into an inventory.
 const tidePull=()=>null;
 return{begin,update,invalidate,instance,tidePull,reset(){casts.clear();instances=new WeakMap();},get size(){return casts.size;}};
}
