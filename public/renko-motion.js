import { RENKO_SKILLS as R } from './abilities.js';

// Actor-local integration only. Event identity/expiry comes from the host;
// crouch and movement use the existing input stream, with no extra wire fields.
export function renkoDriveMotion(actor,event,now,dt,{x=0,z=0,crouch=false,grounded=true}={}){
  if(!event||now>=event.endsAt||!actor.alive||actor.team!==event.team){actor.renkoDrive=null;return null;}
  let s=actor.renkoDrive;
  if(!s||s.id!==event.id)s=actor.renkoDrive={id:event.id,crouched:false,slideAt:-Infinity,x:0,z:0};
  const length=Math.hypot(x,z),speed=Math.hypot(actor.vx||0,actor.vz||0);
  if(grounded&&crouch&&!s.crouched&&speed>=6){s.slideAt=now;s.x=actor.vx/speed;s.z=actor.vz/speed;}
  s.crouched=crouch;
  if(!grounded)s.slideAt=-Infinity;
  const age=now-s.slideAt;
  if(age>=0&&age<R.slideDuration){
    if(length>.01){const current=Math.atan2(s.x,s.z),desired=Math.atan2(x,z),delta=Math.atan2(Math.sin(desired-current),Math.cos(desired-current)),angle=current+Math.max(-R.slideTurn*dt,Math.min(R.slideTurn*dt,delta));s.x=Math.sin(angle);s.z=Math.cos(angle);}
    const v=R.slideStart+(R.slideEnd-R.slideStart)*age/R.slideDuration;
    return{x:s.x*v,z:s.z*v,sliding:true};
  }
  const v=crouch?1.8:R.runSpeed;
  return{x:x/Math.max(1,length)*v,z:z/Math.max(1,length)*v,sliding:false};
}

export function renkoFlightVelocity(event,now,{up=false,down=false}={}){
  if(!event||now>=event.endsAt)return null;
  return down?-R.verticalSpeed:up||now-event.startedAt<.25?R.verticalSpeed:0;
}
