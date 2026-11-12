// Host-only decisions from visible poses, copied contacts and public geometry.
// No enemy roster or live hidden actor is accepted by this planner.
export const SHOTGUN_TACTICS=Object.freeze({think:.55,fireRange:14,contactLife:2.8,smokeLife:2,dashMin:15,dashMax:21,dashRecovery:.18});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),pose=p=>({x:p.x,y:p.y||0,z:p.z});
export function createShotgunTactics({navigation,collision}){
 const cache=new Map();
 const clear=(a,b)=>collision.rayClear(a.x,(a.y||0)+1.45,a.z,b.x,(b.y||0)+1.45,b.z);
 function choose({bot,enemy=null,known=null,role=null,goal=null,smokes=[],now,round}){
  if(!known||now<known.seenAt||now-known.seenAt>SHOTGUN_TACTICS.contactLife)known=null;
  const watch=enemy||known||role?.watch||goal;
  if(!watch||role?.urgent||['plant','recover','defuse'].includes(role?.role)){cache.delete(bot.id);return null;}
  const previous=cache.get(bot.id),key=`${round}:${role?.role}:${enemy?.id||''}:${Math.round((goal?.x||0)/2)}:${Math.round((goal?.z||0)/2)}`;
  if(previous&&previous.key===key&&now>=previous.at&&now-previous.at<SHOTGUN_TACTICS.think&&(!previous.smokeEnd||previous.smokeEnd>now+SHOTGUN_TACTICS.smokeLife))return previous.plan;
  const origin=pose(bot),target=pose(watch),range=enemy?dist(origin,target):Infinity;
  if(enemy&&range<=10){cache.delete(bot.id);return null;}
  const holding=['anchor','hold','cover','guard'].includes(role?.role)&&goal&&dist(bot,goal)<9;
  const center=holding?pose(goal):origin,candidates=[];
  function add(raw,kind,smokeEnd=0){
   const p=navigation.nearest(raw.x,raw.z,origin.y);if(!p||dist(p,raw)>1.2||Math.abs((p.y||0)-origin.y)>.3||dist(p,origin)>9)return;
   if(goal&&dist(p,goal)>dist(origin,goal)+4)return;
   // Only short, genuinely clear ground connections. Never use a path through
   // another floor, traffic barrier or wall to reach an attractive ambush.
   if(!navigation.clearSegment(origin.x,origin.z,p.x,p.z,origin.y,p.y||0))return;
   const hidden=!clear(target,p),peek=hidden&&[[1,0],[-1,0],[0,1],[0,-1]].some(([x,z])=>{
    const q={x:p.x+x*.95,y:p.y||0,z:p.z+z*.95};return navigation.isWalkable(q.x,q.z,q.y)&&navigation.clearSegment(p.x,p.z,q.x,q.z,p.y||0,q.y)&&clear(target,q);
   });
   if(kind==='corner'&&!peek)return;
   if(kind==='approach'&&(!hidden||range-dist(p,target)<1))return;
   if(kind==='smoke'&&!smokes.some(s=>s.expires===smokeEnd&&Math.hypot(p.x-s.x,(p.y||0)+1.45-s.y,p.z-s.z)<s.radius-.25))return;
   const score=dist(origin,p)*.55+(holding?dist(p,center)*.8:dist(p,target)*.6)+(kind==='smoke'?-7:kind==='corner'?-4:0);
   candidates.push({point:pose(p),kind,score,smokeEnd});
  }
  for(const smoke of smokes){
   if(smoke.expires-now<SHOTGUN_TACTICS.smokeLife||dist(origin,smoke)>8||Math.abs(smoke.y-(origin.y+1.45))>smoke.radius-.3)continue;
   if(holding&&dist(smoke,center)>6)continue;
   const dx=target.x-smoke.x,dz=target.z-smoke.z,len=Math.hypot(dx,dz)||1;
   add({x:smoke.x+dx/len*Math.min(1,smoke.radius*.3),z:smoke.z+dz/len*Math.min(1,smoke.radius*.3)},'smoke',smoke.expires);
  }
  for(const radius of [0,2,4])for(let i=0;i<(radius?8:1);i++){
   const a=i*Math.PI/4,p={x:center.x+Math.sin(a)*radius,z:center.z+Math.cos(a)*radius};add(p,holding?'corner':'approach');
  }
  candidates.sort((a,b)=>a.score-b.score);const best=candidates[0];
  const plan=best?{goal:best.point,watch:target,mode:best.kind}:null;
  cache.set(bot.id,{key,at:now,smokeEnd:best?.smokeEnd,plan});if(cache.size>16)cache.delete(cache.keys().next().value);
  return plan;
 }
 return {choose,reset(){cache.clear();}};
}
