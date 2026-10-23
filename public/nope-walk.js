import { NOPE_SKILLS } from './abilities.js';

// Immutable, host-planned straight paths. Rejoins derive the same location from
// the host clock; no target tracking, client movement authority or tick payload.
export function planNopeWalk(origin,yaw,safe){
  let best={yaw,walkLength:0};
  for(const turn of [0,Math.PI/2,-Math.PI/2,Math.PI]){
    const angle=Math.max(-3.1415,Math.min(3.1415,Math.round(Math.atan2(Math.sin(yaw+turn),Math.cos(yaw+turn))*10000)/10000));
    let length=0;
    for(let i=1;i<=NOPE_SKILLS.decoyWalkRange*5;i++){
      const next=i/5,x=origin.x+Math.sin(angle)*next,z=origin.z+Math.cos(angle)*next;
      if(!safe(x,origin.y,z))break;
      length=next;
    }
    if(length>best.walkLength)best={yaw:angle,walkLength:length};
    if(turn===0&&length>=1.2)return best;
  }
  return best;
}
export function nopeWalkPose(event,now){
  if(!Number.isFinite(event.walkLength)||event.walkLength<=0||!Number.isFinite(event.yaw))return {...event};
  const distance=Math.min(event.walkLength,Math.max(0,now-event.startedAt)*NOPE_SKILLS.decoyWalkSpeed);
  return {...event,x:event.x+Math.sin(event.yaw)*distance,z:event.z+Math.cos(event.yaw)*distance,
    walkPhase:distance,walking:distance<event.walkLength&&now>=event.startedAt};
}
