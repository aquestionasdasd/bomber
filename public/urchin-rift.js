// Tide cleave tuning. Residual time starts at the single authoritative strike clock.
export const URCHIN_LANCE=Object.freeze({range:40,width:1.3,telegraph:.65,damage:80,residualDuration:2.5,
  strikeVisual:.2,maxStock:2,price:100,entryCooldown:.5,pulseDuration:.45,pressureLead:.12,
  groundDrop:2.5,groundTolerance:.22,segmentLength:.5,maxPulses:20,maxActors:10});
const finite=n=>Number.isFinite(n)&&Math.abs(n)<=1000;
const point=p=>p&&[p.x,p.y??0,p.z].every(finite);
const alive=a=>point(a)&&a.alive===true&&a.hp>0&&typeof a.id==='string'&&a.id.length>0&&a.id.length<=64;
const safe=(fn,...a)=>{try{return typeof fn==='function'?fn(...a):null;}catch{return null;}};
export function lancePhase(e,now){return now<e.startedAt?'idle':now<e.triggerAt?'telegraph':now>=e.endsAt?'expired':now<e.triggerAt+URCHIN_LANCE.strikeVisual?'strike':'residual';}
function lane(e,p){const dx=e.x-e.fromX,dz=e.z-e.fromZ,length=Math.hypot(dx,dz);if(length<.05)return null;return{length,u:((p.x-e.fromX)*dx+(p.z-e.fromZ)*dz)/length,v:((p.x-e.fromX)*-dz+(p.z-e.fromZ)*dx)/length,dx:dx/length,dz:dz/length};}
export function lanceGround(e,x,z,{groundHeight,reachable}={}){
  const l=lane(e,{x,z});if(!l||l.u<-.01||l.u>l.length+.01)return null;
  const t=Math.max(0,Math.min(1,l.u/l.length)),line={x:e.fromX+(e.x-e.fromX)*t,y:e.fromY+(e.y-e.fromY)*t,z:e.fromZ+(e.z-e.fromZ)*t};
  const y=safe(groundHeight,x,z,line.y);if(!finite(y)||line.y-y<-.05||line.y-y>URCHIN_LANCE.groundDrop)return null;
  const at={x,y,z},centerY=safe(groundHeight,line.x,line.z,line.y);
  if(!finite(centerY)||Math.abs(centerY-y)>URCHIN_LANCE.groundTolerance||safe(reachable,{...e,type:'urchin-rift-ground',x:line.x,y:centerY,z:line.z},{...at,alive:true})!==true)return null;
  return at;
}
function touching(e,a,q){const l=lane(e,a);if(!l||l.u<0||l.u>l.length||Math.abs(l.v)>URCHIN_LANCE.width/2+1e-8||a.grounded!==true)return null;const p=lanceGround(e,a.x,a.z,q);return p&&Math.abs((a.y||0)-p.y)<=URCHIN_LANCE.groundTolerance?p:null;}
// Clip the grounded movement interval against a finite strip, including outside-to-outside crossings.
export function lanceCrossing(e,from,to,q){
  if(from.grounded!==true||to.grounded!==true)return null;const a=lane(e,from),b=lane(e,to);if(!a||!b)return null;
  let lo=0,hi=1;for(const [start,end,min,max]of[[a.u,b.u,0,a.length],[a.v,b.v,-URCHIN_LANCE.width/2,URCHIN_LANCE.width/2]]){const d=end-start;if(Math.abs(d)<1e-10){if(start<min||start>max)return null;}else{let x=(min-start)/d,y=(max-start)/d;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return null;}}
  const t=Math.max(0,Math.min(1,lo+1e-7)),p={x:from.x+(to.x-from.x)*t,y:(from.y||0)+((to.y||0)-(from.y||0))*t,z:from.z+(to.z-from.z)*t,grounded:true};return touching(e,p,q);
}
// This is the extension point for future status-dependent hit effects. No tide-mark or slow exists yet.
export function lanceHitEffect(e,a){return{type:'damage',ability:'urchin-lance',eventId:e.id,targetId:a.id,sourceId:e.sourceId,amount:URCHIN_LANCE.damage};}
export function createLanceRifts(){
  const history=new Map(),pulses=[];let serial=0;
  function prune(events,now){for(const[id]of history)if(!events.has(id)||events.get(id).endsAt<=now)history.delete(id);for(let i=pulses.length-1;i>=0;i--)if(!events.has(pulses[i].eventId)||events.get(pulses[i].eventId).endsAt<=now||now-pulses[i].at>=URCHIN_LANCE.pulseDuration)pulses.splice(i,1);}
  function pulse(e,p,now,kind=0){if(!point(p)||now<e.triggerAt||now>=e.endsAt)return;while(pulses.length>=URCHIN_LANCE.maxPulses)pulses.shift();pulses.push({eventId:e.id,serial:++serial,x:p.x,y:p.y,z:p.z,at:now,kind});}
  function update(events,owners,actors,now,q){prune(events,now);for(const e of events.values()){
    if(e.type!=='urchin-lance'||!owners.has(e.id)||now<e.triggerAt||now>=e.endsAt)continue;
    let state=history.get(e.id);const initial=!state;if(!state){state=new Map();history.set(e.id,state);}const seen=new Set();
    for(const a of actors){if(!alive(a)||a.team===e.team||seen.has(a.id)||seen.size>=URCHIN_LANCE.maxActors)continue;seen.add(a.id);
      const previous=state.get(a.id),inside=touching(e,a,q),cross=previous&&!previous.inside?inside||lanceCrossing(e,previous,a,q):null;
      let last=previous?.notifiedAt??-Infinity;
      if(!initial&&previous&&cross&&now-last>=URCHIN_LANCE.entryCooldown){pulse(e,cross,now);last=now;}
      state.set(a.id,{x:a.x,y:a.y||0,z:a.z,grounded:a.grounded===true,inside:!!inside,notifiedAt:last});
    }for(const id of state.keys())if(!seen.has(id))state.delete(id);
  }}
  function list(events,now){prune(events,now);return pulses.map(p=>({...p,key:p.eventId+':'+p.serial,endsAt:Math.min(events.get(p.eventId).endsAt,p.at+URCHIN_LANCE.pulseDuration)}));}
  function encode(events,now){const ids=[...events.keys()];return list(events,now).map(p=>[ids.indexOf(p.eventId),p.serial,Math.round(p.x*100),Math.round(p.y*100),Math.round(p.z*100),Math.floor(p.at*1000+1e-7),p.kind]);}
  function decode(rows,events,now){if(rows===undefined)return[];if(!Array.isArray(rows)||rows.length>URCHIN_LANCE.maxPulses)return null;const out=[],ids=[...events.keys()],seen=new Set();for(const r of rows){
    if(!Array.isArray(r)||r.length!==7||!r.every(Number.isSafeInteger)||r[0]<0||r[0]>=ids.length||r[1]<1||r[1]>2147483647||r.slice(2,5).some(v=>Math.abs(v)>100000)||r[5]<0||![0,1].includes(r[6]))return null;
    const e=events.get(ids[r[0]]),p={eventId:e.id,serial:r[1],x:r[2]/100,y:r[3]/100,z:r[4]/100,at:r[5]/1000,kind:r[6]},l=lane(e,p),key=e.id+':'+p.serial;
    if(e.type!=='urchin-lance'||!l||l.u<-.02||l.u>l.length+.02||Math.abs(l.v)>URCHIN_LANCE.width/2+.02||p.at<e.triggerAt-.001||p.at>now||p.at>=e.endsAt||seen.has(key))return null;
    const lineY=e.fromY+(e.y-e.fromY)*Math.max(0,Math.min(1,l.u/l.length));if(p.y>lineY+.1||p.y<lineY-URCHIN_LANCE.groundDrop-.02)return null;
    seen.add(key);out.push(p);
  }return out;}
  return{update,prune,list,encode,decode,pulse,replace(rows){pulses.splice(0,pulses.length,...rows);history.clear();serial=Math.max(serial,...rows.map(p=>p.serial));},clear(){history.clear();pulses.length=0;},resetActor(id){for(const s of history.values())s.delete(id);}};
}
