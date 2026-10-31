import { CAP_SKILLS } from './abilities.js';
// Gameplay tuning lives here. Parent throws use the shared slow, low-gravity lob.
export const CAP_GRENADE=Object.freeze({range:40,radius:6,impactFuse:.22,children:15,
 childRadius:3.2,childDamage:42,parentDamage:60,damageCap:180,
 childHeal:36,parentHeal:75,healCap:180,scatterSpeed:11,scatterMinAngle:.35,
 // childFuse bounds lifetime; airborne expiry fizzles without an effect.
 scatterMaxAngle:1.15,childFuse:8,groundFuse:.18,gravity:15,bounce:.58,
 bodyRadius:.10,revealDuration:3,step:1/120,fxDuration:.38});
export const CAP_THROW_TYPES=Object.freeze(['cap-lens','cap-cluster-heal','cap-cluster-damage','cap-bank-grenade','cap-magazine-grenade']);
export const isCapGrenade=type=>CAP_THROW_TYPES.includes(type);
export const isCapCluster=type=>type==='cap-cluster-heal'||type==='cap-cluster-damage';
export function capGrenadeSpec(type){return {flight:.6,delay:.6+CAP_GRENADE.impactFuse,
 tail:type==='cap-lens'?CAP_SKILLS.lockDuration:type==='cap-bank-grenade'?CAP_SKILLS.bounceDuration:type==='cap-magazine-grenade'?CAP_SKILLS.magazineDuration:CAP_GRENADE.childFuse+CAP_GRENADE.revealDuration,
 radius:CAP_GRENADE.radius};}
export function capEffectDuration(type){return type==='cap-lens'?CAP_SKILLS.lockDuration:type==='cap-bank-grenade'?CAP_SKILLS.bounceDuration:type==='cap-magazine-grenade'?CAP_SKILLS.magazineDuration:0;}
export function createCapFlight(event,sweep){
 const c=CAP_GRENADE;let seed=2166136261;
 for(const ch of event.id)seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
 const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const children=isCapCluster(event.type)?Array.from({length:c.children},(_,index)=>{
  const yaw=(index+random())*Math.PI*2/c.children,angle=c.scatterMinAngle+random()*(c.scatterMaxAngle-c.scatterMinAngle),speed=c.scatterSpeed*(.85+random()*.3);
  return{index,x:event.x,y:event.y+.015,z:event.z,vx:Math.sin(yaw)*Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:Math.cos(yaw)*Math.cos(angle)*speed,deadline:c.childFuse,grounded:false,alive:true};
 }):[];
 let ticks=0;const blasts=[{index:-1,x:event.x,y:event.y,z:event.z,at:event.triggerAt}];
 function advance(now){
  const target=Math.min(Math.ceil(c.childFuse/c.step),Math.floor(Math.max(0,now-event.triggerAt)/c.step+1e-8));
  while(ticks<target){ticks++;const at=ticks*c.step;
   for(const p of children){if(!p.alive)continue;
    if(p.grounded){
     // Destroyed/moved floors must not leave an armed ball suspended in air.
     const support=sweep?.({x:p.x,y:p.y,z:p.z},{x:p.x,y:p.y-.04,z:p.z},c.bodyRadius,event.triggerAt+at);
     if(!support||!Number.isFinite(support.fraction)||!(support.normal?.y>.5)){p.grounded=false;p.deadline=c.childFuse;}
    }
    let dt=p.grounded?0:c.step;if(dt)p.vy-=c.gravity*dt;
    for(let contact=0;contact<4&&dt>1e-8;contact++){
     const a={x:p.x,y:p.y,z:p.z},b={x:a.x+p.vx*dt,y:a.y+p.vy*dt,z:a.z+p.vz*dt},hit=sweep?.(a,b,c.bodyRadius,event.triggerAt+at);
     if(!hit){Object.assign(p,b);break;}
     const f=Math.max(0,Math.min(1,hit.fraction)),n=hit.normal;
     if(!Number.isFinite(hit.fraction)||!n||![n.x,n.y,n.z].every(Number.isFinite)){p.vx=p.vy=p.vz=0;break;}
     p.x=a.x+(b.x-a.x)*f+n.x*.002;p.y=a.y+(b.y-a.y)*f+n.y*.002;p.z=a.z+(b.z-a.z)*f+n.z*.002;
     const dot=p.vx*n.x+p.vy*n.y+p.vz*n.z;
     if(dot<0&&n.y>.5){p.vx=p.vy=p.vz=0;p.grounded=true;p.deadline=at+c.groundFuse;break;}
     if(dot<0){p.vx-=(1+c.bounce)*dot*n.x;p.vy-=(1+c.bounce)*dot*n.y;p.vz-=(1+c.bounce)*dot*n.z;}
     dt*=1-f;
    }
    if(p.grounded&&at+1e-8>=p.deadline){p.alive=false;blasts.push({index:p.index,x:p.x,y:p.y,z:p.z,at:event.triggerAt+at});}
    else if(at+1e-8>=c.childFuse)p.alive=false;
   }
  }
  return {children,blasts:now>=event.triggerAt?blasts:[]};
 }
 return {advance};
}
// The engine owns per-cast hit totals. Restored visual events never own these.
export function capBlastEffects(event,blast,actors,totals,reachable){
 const c=CAP_GRENADE,heal=event.type==='cap-cluster-heal',cluster=isCapCluster(event.type),effects=[];
 const radius=blast.index<0?c.radius:c.childRadius,base=blast.index<0?(heal?c.parentHeal:c.parentDamage):(heal?c.childHeal:c.childDamage);
 for(const a of actors){if(!a?.alive||!['blue','red'].includes(a.team))continue;
  const hostile=a.team!==event.team;if((heal||['cap-bank-grenade','cap-magazine-grenade'].includes(event.type))?hostile:!hostile)continue;
  const distance=Math.hypot(a.x-blast.x,(a.y||0)+.8-blast.y,a.z-blast.z);
  if(distance>=radius||typeof reachable!=='function')continue;
  let reaches=false;try{reaches=reachable({...event,...blast},a)===true;}catch{}if(!reaches)continue;
  let amount=0;
  if(cluster){const used=totals.get(a.id)||0;amount=Math.max(0,Math.min((heal?c.healCap:c.damageCap)-used,base*(1-distance/radius)));if(amount<=0)continue;totals.set(a.id,used+amount);effects.push({type:heal?'heal':'damage',targetId:a.id,sourceId:event.sourceId,amount});}
  if(heal)continue; // Healing has no persistent status or reveal to synchronize.
  const until=blast.at+capEffectDuration(event.type),reveal=hostile?blast.at+c.revealDuration:0;
  event.hits||=[];const prior=event.hits.find(h=>h[0]===a.id);
  if(prior){prior[1]=Math.max(prior[1],until);prior[2]=Math.max(prior[2],reveal);}else if(event.hits.length<10)event.hits.push([a.id,until,reveal]);
 }
 return effects;
}
