// Host-owned vehicle state. Inputs contain controls, never seats, HP or fuel.
export const BUS_SERVICE=Object.freeze({dwell:12,fuel:25,driverHP:100,maxSpeed:17,reverse:6,capacity:7});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const round=n=>Math.round(n*1000)/1000;
export function busPoint(p,x,z,y=0){return{x:p.x+x*Math.cos(p.yaw)+z*Math.sin(p.yaw),y,z:p.z-x*Math.sin(p.yaw)+z*Math.cos(p.yaw)};}
// Separating-axis test for the complete oriented body, including a waiting gap.
export function busOverlaps(a,b,gap=.7){
 const axes=[[Math.cos(a.yaw),-Math.sin(a.yaw)],[Math.sin(a.yaw),Math.cos(a.yaw)],[Math.cos(b.yaw),-Math.sin(b.yaw)],[Math.sin(b.yaw),Math.cos(b.yaw)]];
 const radius=(p,x,z)=>(1.25+gap/2)*Math.abs(x*Math.cos(p.yaw)-z*Math.sin(p.yaw))+(5.3+gap/2)*Math.abs(x*Math.sin(p.yaw)+z*Math.cos(p.yaw));
 return axes.every(([x,z])=>Math.abs((a.x-b.x)*x+(a.z-b.z)*z)<radius(a,x,z)+radius(b,x,z));
}
export function createBusService(schedule){
 const states=new Map();
 const fresh=id=>({id,hp:100,riders:[],teams:new Map(),owner:null,fuelUntil:0,custom:null,speed:0});
 const state=id=>{if(!states.has(id))states.set(id,fresh(id));return states.get(id);};
 function poses(time){return schedule(time).filter(p=>!states.get(p.id)?.retired).map(p=>{const s=states.get(p.id),auto=Number.isFinite(s?.routeTime),base=auto?schedule(s.routeTime).find(v=>v.id===p.id):p;let custom=s?.custom,speed=s?.custom?s.speed:p.speed;
  if(custom&&s.previous&&time<s.currentAt&&time>=s.previous.at){const f=clamp((time-s.previous.at)/(s.currentAt-s.previous.at),0,1),yaw=s.previous.yaw+Math.atan2(Math.sin(custom.yaw-s.previous.yaw),Math.cos(custom.yaw-s.previous.yaw))*f;custom={x:s.previous.x+(custom.x-s.previous.x)*f,z:s.previous.z+(custom.z-s.previous.z)*f,yaw,dx:Math.sin(yaw),dz:Math.cos(yaw)};speed=s.trailSpeed;}
  return{...base,...(custom||{}),speed,door:auto?base.door:s?.custom?Math.abs(s.speed)<.5:p.door,driverHP:s?.hp??100,owner:s?.owner||null,diverted:!!s?.custom&&!auto,fuel:s?.fuelUntil?Math.max(0,s.fuelUntil-time):0};});}
 function seat(id){for(const s of states.values())if(s.riders.includes(id))return{busId:s.id,driving:s.owner===id,index:s.riders.indexOf(id)};return null;}
 function seatPoint(p,s,id){if(s.owner===id)return busPoint(p,.62,4.15,.46);const i=s.riders.filter(v=>v!==s.owner).indexOf(id);return busPoint(p,i%2? .48:-.48,2.1-Math.floor(i/2)*1.55,.46);}
 function place(actor,time){const occupied=seat(actor.id);if(!occupied){delete actor.busFrameYaw;return false;}const p=poses(time).find(p=>p.id===occupied.busId),s=states.get(p.id),at=seatPoint(p,s,actor.id);
  if(actor.busFrameYaw?.id===p.id){const delta=Math.atan2(Math.sin(p.yaw-actor.busFrameYaw.yaw),Math.cos(p.yaw-actor.busFrameYaw.yaw));if(Number.isFinite(actor.yaw))actor.yaw+=delta;if(Number.isFinite(actor.netYaw))actor.netYaw+=delta;}
  actor.busFrameYaw={id:p.id,yaw:p.yaw};Object.assign(actor,at,{vy:0,vx:0,vz:0,crouch:0,dashTimer:0,trafficLaunch:null,carMotion:null,moving:false});return true;}
 function candidate(actor,time){
  if(!actor?.alive)return null;const occupied=seat(actor.id);if(occupied){const s=states.get(occupied.busId),p=poses(time).find(p=>p.id===s.id);return{...occupied,kind:!s.owner&&s.hp===0&&(!s.fuelUntil||s.fuelUntil>time)?'drive':'exit',available:Math.abs(p.speed)<.5};}
  if(Math.abs(actor.y||0)>.55||Math.abs(actor.vy||0)>.1)return null;
  for(const p of poses(time)){const s=states.get(p.id);if(!p.door||s?.riders.length>=BUS_SERVICE.capacity)continue;const door=busPoint(p,-1.8,3.8);if(Math.hypot(actor.x-door.x,actor.z-door.z)<2.1)return{busId:p.id,kind:'board',available:true};}return null;
 }
 function exit(actor,time,canExit=()=>true){const occupied=seat(actor.id);if(!occupied)return false;const s=states.get(occupied.busId),p=poses(time).find(p=>p.id===s.id);let at=null;
  for(const [x,z]of[[-2.1,3.8],[-2.6,1.7],[2.1,3.8],[-3.2,-3.5],[3.2,-3.5]]){const point=busPoint(p,x,z);if(canExit(point,actor)){at=point;break;}}
  if(!at)return false;s.riders=s.riders.filter(id=>id!==actor.id);s.teams.delete(actor.id);if(s.owner===actor.id){s.owner=null;s.speed=0;}
  delete actor.busFrameYaw;Object.assign(actor,at,{vy:0,vx:0,vz:0});return true;
 }
 function interact(actor,time,canExit){const c=candidate(actor,time);if(!c||!c.available)return false;const s=state(c.busId),p=poses(time).find(p=>p.id===s.id);
  if(c.kind==='exit')return exit(actor,time,canExit);
  if(c.kind==='board'){s.riders.push(actor.id);s.teams.set(actor.id,actor.team);}
  else{if(s.owner||s.hp!==0||s.fuelUntil&&s.fuelUntil<=time)return false;s.custom={x:p.x,z:p.z,yaw:p.yaw,dx:p.dx,dz:p.dz};s.owner=actor.id;s.speed=0;if(!s.fuelUntil)s.fuelUntil=time+BUS_SERVICE.fuel;}
  place(actor,time);return true;
 }
 function damageDriver(busId,shooter,damage,time){const s=states.get(busId);if(!s||s.hp<=0||!s.riders.includes(shooter)||!Number.isFinite(damage)||damage<=0||!Number.isFinite(time))return false;s.hp=Math.max(0,s.hp-damage);if(!s.hp){const p=poses(time).find(p=>p.id===busId);s.custom={x:p.x,z:p.z,yaw:p.yaw,dx:p.dx,dz:p.dz};s.speed=0;delete s.routeTime;}return true;}
 function tick(dt,time,actors,{enabled=true,controls=()=>null,canDrive=()=>true,canExit=()=>true}={}){
  if(!Number.isFinite(time)||time<0)return;const byId=new Map(actors.map(a=>[a.id,a]));dt=clamp(dt,0,.1);
  const occupied=new Map(poses(Math.max(0,time-dt)).map(p=>[p.id,p]));
  const clear=(p,id)=>[...occupied.values()].every(other=>other.id===id||!busOverlaps(p,other));
  for(const s of states.values()){
   for(const id of [...s.riders]){const a=byId.get(id);if(!a||!a.alive||a.team!==s.teams.get(id)||!enabled){if(a)exit(a,time,canExit);s.riders=s.riders.filter(v=>v!==id);s.teams.delete(id);if(s.owner===id){s.owner=null;s.speed=0;}}}
   if(!s.owner)continue;
   if(time>=s.fuelUntil||!enabled){s.speed=0;continue;}
   s.previous={...s.custom,at:time-dt};s.currentAt=time;
   const input=controls(s.owner)||{},throttle=clamp(Number(input.throttle)||0,-1,1),steer=clamp(Number(input.steer)||0,-1,1),brake=input.brake===true;
   const target=brake?0:throttle>0?BUS_SERVICE.maxSpeed:throttle<0?-BUS_SERVICE.reverse:0;
   s.speed+=clamp(target-s.speed,-(brake?35:14)*dt,(brake?35:9)*dt);
   const steps=Math.max(1,Math.ceil(Math.abs(s.speed)*dt/.12)),step=dt/steps;
   for(let i=0;i<steps;i++){const old=s.custom,yaw=old.yaw-steer*1.05*step*clamp(s.speed/8,-1,1),p={x:old.x+Math.sin(yaw)*s.speed*step,z:old.z+Math.cos(yaw)*s.speed*step,yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw)),dx:Math.sin(yaw),dz:Math.cos(yaw)};
    if(!clear(p,s.id)||!canDrive(p,old,{busId:s.id,speed:s.speed,owner:s.owner})){s.speed=0;break;}s.custom=p;occupied.set(s.id,{...p,id:s.id});}
   s.trailSpeed=dt?Math.hypot(s.custom.x-s.previous.x,s.custom.z-s.previous.z)/dt:0;
  }
  // A stopped/stolen bus delays its followers' route clocks. They resume from
  // the last safe point; the wall clock can never teleport them past a queue.
  for(const base of schedule(time)){
   let s=states.get(base.id);if(s?.retired||s?.custom&&!Number.isFinite(s.routeTime))continue;
   let clock=Number.isFinite(s?.routeTime)?s.routeTime:Math.max(0,time-dt),p=occupied.get(base.id),blocked=false;
   const initial={...p,at:time-dt},steps=Math.max(1,Math.ceil(11.2*dt/.12)),step=dt/steps;
   for(let i=0;i<steps;i++){const candidate=schedule(clock+step).find(v=>v.id===base.id);
    if(!clear(candidate,base.id)){blocked=true;break;}clock+=step;p=candidate;occupied.set(base.id,p);}
   if(blocked||Number.isFinite(s?.routeTime)){
    s=state(base.id);s.routeTime=clock;s.previous=initial;s.currentAt=time;s.custom={x:p.x,z:p.z,yaw:p.yaw,dx:p.dx,dz:p.dz};s.speed=blocked?0:p.speed;
    s.trailSpeed=dt?Math.hypot(p.x-initial.x,p.z-initial.z)/dt:0;
   }
  }
  for(const a of actors)place(a,time);
 }
 function snapshot(ids){return [...states.values()].filter(s=>s.hp!==100||s.riders.length||s.custom).map(s=>[schedule(0).findIndex(p=>p.id===s.id),round(s.hp),ids.indexOf(s.owner),s.fuelUntil,...(s.custom?[round(s.custom.x),round(s.custom.z),round(s.custom.yaw)]:[null,null,null]),round(s.speed),s.riders.map(id=>ids.indexOf(id)),...(Number.isFinite(s.routeTime)?[round(s.routeTime)]:[])]);}
 function restore(rows,ids,time){
  if(!Array.isArray(rows)||rows.length>4||ids.length>10)return false;const next=new Map(),seated=new Set(),base=schedule(time);
  for(const v of rows){if(!Array.isArray(v)||![9,10].includes(v.length))return false;const[i,hp,owner,fuel,x,z,yaw,speed,riders,routeTime]=v;const auto=v.length===10;if(auto&&(!Number.isFinite(routeTime)||routeTime<0||routeTime>time+.001||!(hp>0&&hp<=100)||owner!==-1||fuel!==0))return false;
   if(!Number.isInteger(i)||!base[i]||next.has(base[i].id)||!Number.isFinite(hp)||hp<0||hp>100||!Number.isInteger(owner)||owner< -1||owner>=ids.length||!Number.isFinite(fuel)||fuel<0||fuel>time+25.001||!Number.isFinite(speed)||speed< -6.001||speed>17.001||!Array.isArray(riders)||riders.length>7)return false;
   const custom=x!==null;if(custom?(![x,z,yaw].every(Number.isFinite)||Math.abs(x)>82||Math.abs(z)>82||Math.abs(yaw)>Math.PI+.001):z!==null||yaw!==null||speed!==0||fuel!==0)return false;
   if(owner>=0&&(!riders.includes(owner)||hp!==0||!custom||!fuel))return false;
   if(custom&&hp!==0&&!auto||!custom&&fuel!==0||fuel<=time&&speed!==0&&custom&&!auto||auto&&!custom)return false;
   if(auto){const at=schedule(routeTime)[i];if(Math.hypot(at.x-x,at.z-z)>.04||Math.abs(Math.atan2(Math.sin(at.yaw-yaw),Math.cos(at.yaw-yaw)))>.005||speed<0||speed>11.201)return false;}
   // A dead driver without a body pose is the canonical retired-bus marker.
   // Real driver kills always freeze a custom pose until the next round.
   const retired=hp===0&&!custom;if(retired&&(auto||owner!==-1||riders.length))return false;
   const s=fresh(base[i].id);if(retired)s.retired=true;if(auto)s.routeTime=routeTime;s.hp=hp;s.owner=owner>=0?ids[owner]:null;s.fuelUntil=fuel;s.speed=speed;s.custom=custom?{x,z,yaw,dx:Math.sin(yaw),dz:Math.cos(yaw)}:null;
   for(const n of riders){if(!Number.isInteger(n)||n<0||n>=ids.length||seated.has(ids[n]))return false;seated.add(ids[n]);s.riders.push(ids[n]);}next.set(s.id,s);
  }
  states.clear();for(const [id,s]of next)states.set(id,s);return true;
 }
 function reset({preserveHijacked=false}={}){
  // fuelUntil is assigned only when a player actually claims the driver seat;
  // it survives exit, death and fuel exhaustion, unlike the current owner.
  const retired=preserveHijacked?[...states.values()].filter(s=>s.retired||s.fuelUntil>0).map(s=>s.id):[];
  states.clear();for(const id of retired)states.set(id,{...fresh(id),hp:0,retired:true});
 }
 return{poses,seat,place,candidate,interact,exit,tick,damageDriver,snapshot,restore,reset};
}
