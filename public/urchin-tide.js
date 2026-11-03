// E tuning and shared status adapter. No actor coordinates are serialized here.
export const URCHIN_TIDE=Object.freeze({range:36,width:4,height:2.5,speed:72,telegraph:.25,
 enemyNear:3,allyNear:1,sight:8,mark:4,cooldown:18,bubbleLife:.8,bubbleInterval:.12,
 bubbleSpeed:.6,bubbleDistance:.07,teleportDistance:8,maxActors:10,maxBubbles:96,
 slowScale:.75,slowDuration:.8,pressureAt:.1,glowAt:.2,farAudioScale:.82,farAudioCutoff:2400});
export function tideBasis(e){const dx=e.x-e.fromX,dy=e.y-e.fromY,dz=e.z-e.fromZ,length=Math.hypot(dx,dy,dz);if(length<1e-8)return null;
 const f={x:dx/length,y:dy/length,z:dz/length},h=Math.hypot(f.x,f.z),r=h>1e-7?{x:-f.z/h,y:0,z:f.x/h}:{x:1,y:0,z:0};
 return{f,r,u:{x:r.y*f.z-r.z*f.y,y:r.z*f.x-r.x*f.z,z:r.x*f.y-r.y*f.x},length};}
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
// Continuous relative sweep against the moving rectangular wave. The actor's
// body overlaps its height; large discontinuities use only the new pose.
export function tideContact(e,a,previous,fromTime,toTime){
 const b=tideBasis(e);if(!b||toTime<e.triggerAt||fromTime>e.triggerAt+e.flight)return null;
 const low=Math.max(fromTime,e.triggerAt),high=Math.min(toTime,e.triggerAt+e.flight),span=toTime-fromTime;
 const prior=previous&&Math.hypot(a.x-previous.x,a.z-previous.z)<=URCHIN_TIDE.teleportDistance?previous:a;
 const at=t=>{const w=span>0?(t-fromTime)/span:1;return{x:prior.x+(a.x-prior.x)*w,y:(prior.y||0)+((a.y||0)-(prior.y||0))*w+(1.7-Math.max(0,Math.min(1,a.crouch||0))*.55)/2,z:prior.z+(a.z-prior.z)*w};};
 const p=at(low),q=at(high),project=(p,t)=>{const v={x:p.x-e.fromX,y:p.y-e.fromY,z:p.z-e.fromZ};return[dot(v,b.f)-(t-e.triggerAt)*URCHIN_TIDE.speed,dot(v,b.r),dot(v,b.u)];};
 const x=project(p,low),y=project(q,high),body=(1.7-Math.max(0,Math.min(1,a.crouch||0))*.55)/2;
 const limits=[.12+.3,URCHIN_TIDE.width/2+.3,URCHIN_TIDE.height/2+Math.abs(b.u.y)*body+.3*Math.hypot(b.u.x,b.u.z)];
 let lo=0,hi=1;for(let i=0;i<3;i++){const d=y[i]-x[i],r=limits[i];if(Math.abs(d)<1e-10){if(Math.abs(x[i])>r)return null;}else{let l=(-r-x[i])/d,h=(r-x[i])/d;if(l>h)[l,h]=[h,l];lo=Math.max(lo,l);hi=Math.min(hi,h);if(lo>hi)return null;}}
 const t=low+(high-low)*Math.max(0,lo),pHit=at(t),v={x:pHit.x-e.fromX,y:pHit.y-e.fromY,z:pHit.z-e.fromZ},along=dot(v,b.f);
 return along>=0&&along<=b.length?t:null;
}
export function createTideStatus(){
 const states=new Map();
 const marked=(id,now,sourceTeam)=>{const s=states.get(id);return !!s&&s.at+URCHIN_TIDE.mark>now&&(sourceTeam===undefined||sourceTeam===s.team);};
 function prune(now,actors){for(const[id,s]of states)if(Math.max(s.at+URCHIN_TIDE.mark,(s.slowAt??-Infinity)+URCHIN_TIDE.slowDuration)<=now||actors&&!actors.some(a=>a.id===id&&a.alive&&a.hp>0&&a.team!==s.team))states.delete(id);}
 function mark(id,team,at){if(!states.has(id)&&states.size>=URCHIN_TIDE.maxActors)return false;const old=states.get(id);states.set(id,{team,at:Math.floor(at*1000+1e-7)/1000,...(old?.slowAt!==undefined?{slowAt:old.slowAt}:{})});return true;}
 function slow(id,now,sourceTeam){if(!marked(id,now,sourceTeam))return false;states.get(id).slowAt=Math.floor(now*1000+1e-7)/1000;return true;}
 function encode(now){prune(now);return [...states].map(([id,s])=>[id,s.team==='blue'?0:1,Math.round(s.at*1000),...(s.slowAt!==undefined&&s.slowAt+URCHIN_TIDE.slowDuration>now?[Math.round(s.slowAt*1000)]:[])]);}
 function decode(rows,now){if(rows===undefined)return[];if(!Array.isArray(rows)||rows.length>URCHIN_TIDE.maxActors)return null;const seen=new Set(),out=[];for(const r of rows){if(!Array.isArray(r)||![3,4].includes(r.length)||typeof r[0]!=='string'||!r[0].length||r[0].length>64||seen.has(r[0])||![0,1].includes(r[1])||!r.slice(2).every(t=>Number.isSafeInteger(t)&&t>=0&&t<=now*1000+1e-6)||r.length===4&&(r[3]<r[2]||r[3]>r[2]+URCHIN_TIDE.mark*1000)||Math.max(r[2]/1000+URCHIN_TIDE.mark,(r[3]??-Infinity)/1000+URCHIN_TIDE.slowDuration)<=now)return null;seen.add(r[0]);out.push([r[0],{team:r[1]===0?'blue':'red',at:r[2]/1000,...(r.length===4?{slowAt:r[3]/1000}:{})}]);}return out;}
 return{mark,marked,slow,prune,encode,decode,list:now=>{prune(now);return[...states].filter(([id])=>marked(id,now)).map(([id,s])=>({id,team:s.team,startedAt:s.at,endsAt:s.at+URCHIN_TIDE.mark}));},
 speed:(id,now)=>((states.get(id)?.slowAt??-Infinity)+URCHIN_TIDE.slowDuration>now?URCHIN_TIDE.slowScale:1),remove:id=>states.delete(id),clear:()=>states.clear(),replace:rows=>{states.clear();for(const[id,s]of rows)states.set(id,s);}};
}
