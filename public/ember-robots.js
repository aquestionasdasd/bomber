import {ROBOT_RULES as R,ROBOT_TYPES as T,ROBOT_SKILLS as S,ROBOT_COMMANDS as C} from './ember-robots-config.js';
import {throwPosition} from './skill-throw.js';
const types=Object.keys(T),states=['Deploy','Search','Move','Attack','Support','Command','Destroyed','Expired'];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),pose=a=>({x:a.x,y:a.y||0,z:a.z}),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),q=n=>Math.round(n*100),unq=n=>n/100;
const finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=1000);
function sphereRay(o,d,p,r,max){const x=o.x-p.x,y=o.y-p.y,z=o.z-p.z,b=x*d.x+y*d.y+z*d.z,c=x*x+y*y+z*z-r*r,disc=b*b-c;if(disc<0)return null;const t=-b-Math.sqrt(disc);return t>=0&&t<=max?t:null;}
function boxRay(o,d,u,max){let lo=0,hi=max;const width=u.link?1.1:.72,depth=.22,h=T.shield.height,cy=Math.cos(u.yaw),sy=Math.sin(u.yaw),ox=o.x-u.x,oz=o.z-u.z;
 for(const [v,s,min,mx]of[[ox*cy-oz*sy,d.x*cy-d.z*sy,-width,width],[o.y-u.y,d.y,0,h],[ox*sy+oz*cy,d.x*sy+d.z*cy,-depth,depth]]){if(Math.abs(s)<1e-9){if(v<min||v>mx)return null;}else{const a=(min-v)/s,b=(mx-v)/s;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(hi<lo)return null;}}return lo;}

// Pure host simulation. World callbacks are the game's existing navigation,
// collision, visibility and damage systems. Guests only restore/display it.
export function createRobotArmy(){
 let serial=0,round=0,last=null,guest=false,now=0;const units=new Map(),groups=new Map(),wrecks=new Map(),slows=new Map(),fx=[],reservations=new Map();
 let bins=new Map();
 const cell=(x,z)=>`${Math.floor(x/6)},${Math.floor(z/6)}`;
 function index(){bins=new Map();for(const u of units.values()){const k=cell(u.x,u.z);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(u);}}
 function near(p,r){const out=[];for(let x=Math.floor((p.x-r)/6);x<=Math.floor((p.x+r)/6);x++)for(let z=Math.floor((p.z-r)/6);z<=Math.floor((p.z+r)/6);z++)for(const u of bins.get(`${x},${z}`)||[])if(dist(p,u)<=r)out.push(u);return out;}
 function pulse(type,u,to=null){if(['repair','laser'].includes(type)&&now<(u.nextPulseAt||0))return;if(['repair','laser'].includes(type))u.nextPulseAt=now+.12;fx.push({id:++serial,type,at:now,...pose(u),...(to?{tx:to.x,ty:to.y,tz:to.z}:{})});if(fx.length>24)fx.shift();}
 function counts(owner,team){let owned=0,allied=0,total=units.size;for(const u of units.values()){if(u.owner===owner)owned++;if(u.team===team)allied++;}for(const g of groups.values())if(g.pending){total+=g.roster.length;if(g.owner===owner)owned+=g.roster.length;if(g.team===team)allied+=g.roster.length;}return{owned,allied,total};}
 function capacity(owner,team,n){const c=counts(owner,team);return c.owned+n<=R.ownerLimit&&c.allied+n<=R.teamLimit&&c.total+n<=R.worldLimit;}
 function plan(owner,team,roster,p,w,exclude=[]){const points=[],occupied=[...units.values()].filter(u=>!exclude.includes(u.id));
  for(let i=0;i<roster.length;i++){const t=T[roster[i]],factory=t.factory;let found=null;
   for(let attempt=0;attempt<48;attempt++){const a=i*2.399963+attempt*.785398,rad=attempt===0?(factory?0:.85+Math.floor(i/6)*.75):.8+Math.floor(attempt/8)*.55,x=p.x+Math.cos(a)*rad,z=p.z+Math.sin(a)*rad;
    const y=w.ground(x,z,p.y+.15);if(y===null||!Number.isFinite(y)||Math.abs(y-p.y)>1.4)continue;
    const base={x,y,z},alt=t.altitude||0,target={x,y:y+alt,z};
    if(w.stand(base,t.radius,t.height+alt)&&w.clear({x:p.x,y:p.y+.2,z:p.z},{x,y:y+.2,z})&&(!alt||w.clear({x,y:y+.2,z},target))&&occupied.every(u=>Math.abs(u.y-target.y)>1.8||dist(u,target)>t.radius+T[u.type].radius+.12)&&points.every((a,j)=>Math.abs(a.y-target.y)>1.8||dist(a,target)>t.radius+T[roster[j]].radius+.12)){found=target;break;}
   }if(!found)return null;points.push(found);
  }return points;
 }
 function addUnit(type,g,p,at,life=null){const t=T[type],u={id:++serial,gid:g.id,owner:g.owner,team:g.team,type,...p,spawn:pose(p),yaw:g.yaw,hp:t.hp,maxHp:t.hp,armor:0,state:'Deploy',startedAt:at,endsAt:at+(life??t.life),thinkAt:at,fireAt:at,pathAt:0,path:[],memory:null,target:null,sets:0,burst:0,link:0,mount:0,boostUntil:0,boost:1,command:null,armorGiven:false,hitIds:new Set()};units.set(u.id,u);return u;}
 function roster(g,w,at){const pts=plan(g.owner,g.team,g.roster,g.point,w);if(!pts)return false;g.pending=false;g.startedAt=at;g.endsAt=at+Math.max(...g.roster.map(k=>T[k].life));g.roster.forEach((t,i)=>{const u=addUnit(t,g,pts[i],at,g.key==='e'?10:g.key==='q'?8:null);u.role=i;g.unitIds.push(u.id);});pulse('deploy',g.point);return true;}
 function destroy(u,killed,w){if(!units.has(u.id))return;const g=groups.get(u.gid);units.delete(u.id);u.state=killed?'Destroyed':'Expired';
  for(const v of units.values()){if(v.link===u.id){v.link=0;v.command=null;}if(v.mount===u.id){v.mount=0;v.y=u.y;v.pathAt=0;}}
  if(killed){pulse('destroy',u);if(wrecks.size>=R.wreckLimit)wrecks.delete(wrecks.keys().next().value);const recycled=g?.key==='x'&&g.mode===1;
   wrecks.set(u.id,{id:u.id,gid:u.gid,type:u.type,team:u.team,owner:u.owner,x:u.x,y:u.y,z:u.z,endsAt:now+R.wreckLife,recyclable:!recycled});
   if(g?.key==='x'&&!T[u.type].factory)g.lost.push(u.type);
   if(u.type==='dismantler'&&capacity(u.owner,u.team,3)){const rs=['fragment','fragment','fragment'],pts=plan(u.owner,u.team,rs,u,w);if(pts)rs.forEach((t,i)=>{const v=addUnit(t,g,pts[i],now);v.memory=u.memory?{...u.memory}:null;v.role=i;g.unitIds.push(v.id);});}
  }
 }
 function damage(u,amount,team,w){if(!u||!units.has(u.id)||!Number.isFinite(amount)||amount<=0||u.team===team&&u.type!=='shield')return false;const absorbed=Math.min(u.armor,amount);u.armor-=absorbed;u.hp=Math.max(0,u.hp-(amount-absorbed));if(!u.hp)destroy(u,true,w);return true;}
 function reserve(u,target){const k=`${u.owner}/${target.id}`;let a=reservations.get(k);if(!a){a=[];reservations.set(k,a);}if(a.includes(u.id))return true;if(a.length>=R.attackers)return false;a.push(u.id);return true;}
 function visible(u,a,w){const t=T[u.type];if(!a.alive||a.team===u.team||dist(u,a)>(t.detect||t.range||0)||Math.abs((a.y||0)-u.y)>5)return false;const angle=Math.atan2(u.x-a.x,u.z-a.z),delta=Math.atan2(Math.sin(angle-u.yaw),Math.cos(angle-u.yaw));return Math.abs(delta)<=R.fov/2&&w.see(u,a);}
 function share(u,p,range){for(const v of near(u,range))if(v.owner===u.owner&&v.id!==u.id)v.memory={...p};}
 function destination(u,g,owner){if(u.command?.point)return u.command.point;if(u.memory&&u.memory.until>now){const p={...u.memory},angle=g.yaw+Math.PI+(u.role%4)*Math.PI/2;p.x+=Math.sin(angle)*1.1;p.z+=Math.cos(angle)*1.1;return p;}
  if(g.order){const side=(u.role%3-1)*1.1,back=u.type==='shield'?-1.3:u.type==='repair'?2:0;return{x:g.order.x+Math.cos(g.yaw)*side+Math.sin(g.yaw)*back,y:g.order.y,z:g.order.z-Math.sin(g.yaw)*side+Math.cos(g.yaw)*back};}
  if(['shield','wire','turret'].includes(u.type)){const reach=u.type==='wire'?2.5:u.type==='turret'?1.2:3;return{x:u.spawn.x-Math.sin(g.yaw)*reach,y:u.spawn.y,z:u.spawn.z-Math.cos(g.yaw)*reach};}
  return owner?.alive?{x:owner.x+Math.sin((u.role||0)*2.4)*2,y:owner.y||0,z:owner.z+Math.cos((u.role||0)*2.4)*2}:u.spawn;
 }
 function move(u,p,dt,w){const t=T[u.type];if(!t.speed||u.fused||u.attached)return;
  let target=p;if(u.mount){const mount=units.get(u.mount);if(mount){u.x=mount.x;u.y=mount.y+1.7;u.z=mount.z;u.yaw=mount.yaw;return;}u.mount=0;}
  if(u.type==='supervisor'&&u.ownerPose&&dist(p,u.ownerPose)>12)target=u.ownerPose;
  const amount=t.speed*(u.boostUntil>now?u.boost:1)*dt;
  if(!t.altitude&&!t.climber){if(now>=u.pathAt){u.path=w.path(u,target)||[];u.pathAt=now+R.pathInterval;}while(u.path.length&&dist(u,u.path[0])<.25)u.path.shift();if(u.path.length)target=u.path[0];}
  const d=dist(u,target);if(d<.1)return;const dx=(target.x-u.x)/d*Math.min(d,amount),dz=(target.z-u.z)/d*Math.min(d,amount);
  u.yaw=Math.atan2(-dx,-dz);const old=pose(u);w.move(u,{x:dx,z:dz},t,dt);
  // Bodies do not block players. Avoid persistent robot piles with a bounded
  // local separation, using the same collision callback as locomotion.
  for(const v of near(u,1.2)){if(v.id===u.id||v.mount===u.id||u.mount===v.id||Math.abs(v.y-u.y)>1.4)continue;const n=dist(u,v),min=t.radius+T[v.type].radius+.08;if(n>0&&n<min)w.move(u,{x:(u.x-v.x)/n*Math.min(.06,min-n),z:(u.z-v.z)/n*Math.min(.06,min-n)},t,dt);}
  if(!finite(u)){Object.assign(u,old);u.path=[];}
 }
 function actorDamage(u,a,amount,w){if(!a.alive||a.team===u.team||!w.see(u,a))return false;const owner=w.actors.get(u.owner);if(!owner||owner.team!==u.team)return false;const alive=a.alive;w.damage(a,amount,owner);if(alive&&!a.alive){const g=groups.get(u.gid);if(g?.key==='x')for(const v of units.values())if(v.gid===g.id){v.boost=R.killBoost;v.boostUntil=now+R.killBoostDuration;}}return true;}
 function commandTick(u,dt,w,actors){const c=u.command;if(!c)return false;const g=groups.get(u.gid);
  if(c.type==='link'){u.state='Command';const pair=units.get(u.link);if(!pair){u.command=null;return false;}if(!c.ready){move(u,c.join,dt,w);if(dist(u,c.join)<.18)c.ready=true;return true;}if(pair.command?.ready){move(u,c.point,dt,w);u.yaw=g.yaw;for(const a of actors)if(a.alive&&a.team!==u.team&&dist(u,a)<1.1&&Math.abs((a.y||0)-u.y)<1.7)w.push(a,u,dt*1.5);}return true;}
  if(c.type==='laser'){u.state='Command';if(now<c.at)return true;if(now>=c.end){u.command=null;return false;}const end=w.stop({x:u.x,y:u.y+1,z:u.z},c.point,C.laserRange),dx=end.x-u.x,dz=end.z-u.z,len=Math.hypot(dx,dz)||1;
   for(const a of actors)if(a.alive&&a.team!==u.team){const along=((a.x-u.x)*dx+(a.z-u.z)*dz)/(len*len),side=Math.abs((a.x-u.x)*dz-(a.z-u.z)*dx)/len;if(along>=0&&along<=1&&side<.5&&Math.abs((a.y||0)-u.y)<2&&reserve(u,a)){const spent=c.damage.get(a.id)||0,hit=Math.min(C.laserDamage-spent,C.laserDamage/C.laserDuration*Math.min(dt,now-c.at,c.end-(now-dt)));if(hit>0&&actorDamage(u,a,hit,w))c.damage.set(a.id,spent+hit);}}
   pulse('laser',u,end);return true;
  }
  if(c.type==='dash'){u.state='Command';if(now<c.at)return true;const before=pose(u);move(u,c.point,dt*C.dashSpeed/T[u.type].speed,w);
   for(const a of actors)if(a.alive&&a.team!==u.team&&!u.hitIds.has(a.id)){const dx=u.x-before.x,dz=u.z-before.z,l=dx*dx+dz*dz,t=l?clamp(((a.x-before.x)*dx+(a.z-before.z)*dz)/l,0,1):0;if(Math.hypot(a.x-before.x-dx*t,a.z-before.z-dz*t)<.85&&Math.abs((a.y||0)-u.y)<1.8&&reserve(u,a)&&actorDamage(u,a,C.dashDamage,w))u.hitIds.add(a.id);}
   if(dist(u,c.point)<.2||dist(before,u)<.005||now>c.at+.8){u.command=null;for(const v of units.values())if(v.gid===g.id&&v.type==='cutter'){v.memory={x:u.x+(v.role%2?1:-1)*2,y:u.y,z:u.z,until:now+1.2};}}return true;
  }
  return false;
 }
 function attack(u,a,dt,w){const t=T[u.type],g=groups.get(u.gid);if(!a||!visible(u,a,w)||dist(u,a)>t.range||!reserve(u,a)){u.burst=0;u.warningAt=0;return false;}u.state='Attack';
  if(u.type==='bomb'){if(!u.warningAt){u.warningAt=now+t.warning;pulse('warning',u);}if(now+1e-8<u.warningAt)return true;let hit=false;
   for(const target of w.actors.values())if(target.alive&&target.team!==u.team&&dist(u,target)<=t.blast&&Math.abs((target.y||0)-u.y)<2&&reserve(u,target)){const used=g.damage.get(target.id)||0,amount=Math.min(t.damage,R.groupDamageCap-used);if(amount>0&&actorDamage(u,target,amount,w)){g.damage.set(target.id,used+amount);hit=true;}}
   if(hit&&!g.encircled){g.encircled=true;for(const v of units.values())if(v.gid===g.id&&v.id!==u.id){v.boost=R.encircleScale;v.boostUntil=now+R.encircleDuration;}}
   pulse('blast',u);destroy(u,true,w);return true;
  }
  if(u.type==='crab'){const captured=g.captures.get(a.id);if(captured&&now>=captured)return true;const end=captured??now+R.captureDuration;g.captures.set(a.id,end);u.attached=a.id;u.attachEnd=end;slow(a,R.captureScale,end);share(u,{...pose(a),target:a.id,until:now+R.memory,captured:true},15);return true;}
  if(t.burst){if(u.sets>= (t.sets??Infinity)&&!u.burst)return true;
   if(!u.burst&&now>=u.fireAt){if(!u.warningAt){u.warningAt=now+(t.warning||0);pulse('warning',u);}if(now+1e-8>=u.warningAt){u.burst=t.burst;u.sets++;u.nextBullet=u.warningAt;u.warningAt=0;}}
   while(u.burst>0&&now+1e-8>=u.nextBullet){if(!a.alive||!visible(u,a,w)){u.burst=0;break;}const hit=w.shot?.(u,a,t.damage)||null;if(!hit)actorDamage(u,a,t.damage,w);pulse('shot',u,{x:a.x,y:(a.y||0)+1,z:a.z});u.burst--;u.nextBullet+=.1;if(!u.burst)u.fireAt=u.nextBullet+(t.interval||1)/(u.fused?C.fuseRate:1);}
  }else if(now+1e-8>=u.fireAt){actorDamage(u,a,t.damage,w);pulse('cut',u);u.fireAt=now+(t.interval||1.4);}
  return true;
 }
 function slow(a,scale,end){const prev=slows.get(a.id);slows.set(a.id,{scale:Math.min(prev?.until>now?prev.scale:1,scale),until:Math.max(prev?.until||0,end),team:a.team});}
 function support(u,dt,w){u.state='Support';const candidates=near(u,R.repairRange).filter(v=>v.team===u.team&&v.id!==u.id&&Math.abs(v.y-u.y)<4&&w.clear({x:u.x,y:u.y+.2,z:u.z},{x:v.x,y:v.y+.2,z:v.z}));
  const target=candidates.filter(v=>v.hp<v.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(target){target.hp=Math.min(target.maxHp,target.hp+T.repair.repair*dt);pulse('repair',u,target);}
  const boss=candidates.find(v=>v.type==='supervisor'&&!v.armorGiven);if(boss){boss.armor=R.armorBonus;boss.armorGiven=true;u.link=boss.id;}
  const factory=near(u,R.materialRange).find(v=>v.team===u.team&&v.type==='production');if(factory){const g=groups.get(factory.gid);for(const [id,r]of wrecks)if(r.recyclable&&r.team===u.team&&dist(r,factory)<R.materialRange&&dist(r,u)<R.repairRange&&w.clear({x:u.x,y:u.y+.2,z:u.z},{x:r.x,y:r.y+.1,z:r.z})){g.materials=Math.min(C.productionTotal,g.materials+1);wrecks.delete(id);pulse('recycle',r);}}
 }
 function spawnFactory(g,f,w,emergency=false){if(g.total>= (g.mode?C.productionTotal:Infinity)||!capacity(g.owner,g.team,1))return false;const children=[...units.values()].filter(u=>u.gid===g.id&&!T[u.type].factory);if(children.length>=C.factoryActive)return false;
  let type;if(!g.mode){if(g.replaced>=C.resupplyLimit||!g.lost.length)return false;type=g.lost[0];}else type=!children.some(u=>u.type==='repair')?'repair':children.filter(u=>u.type==='shield').length<2?'shield':g.total%2?'turret':'cutter';
  const points=plan(g.owner,g.team,[type],f,w);if(!points)return false;const u=addUnit(type,g,points[0],now);u.role=g.total++;g.unitIds.push(u.id);if(!g.mode){g.lost.shift();g.replaced++;}if(emergency)g.materials--;pulse('deploy',u);return true;
 }
 function step(dt,w,actors){index();reservations.clear();
  for(const g of groups.values())if(g.pending&&now+1e-8>=g.landsAt){if(!roster(g,w,now)){g.pending=false;g.endsAt=now;} }
  for(const u of [...units.values()]){const g=groups.get(u.gid),owner=w.actors.get(u.owner);if(!g||!owner||owner.team!==u.team||now>=u.endsAt){destroy(u,false,w);continue;}u.ownerPose=owner;
   if(u.attached){const a=w.actors.get(u.attached);if(!a?.alive||now>=u.attachEnd){destroy(u,false,w);continue;}u.x=a.x;u.y=a.y||0;u.z=a.z;slow(a,R.captureScale,u.attachEnd);continue;}
   if(T[u.type].factory){u.state='Support';if(g.order&&u.type==='assault')move(u,g.order,dt,w);if(now>=g.produceAt){if(spawnFactory(g,u,w))g.produceAt=now+(g.mode?C.productionInterval:C.resupplyInterval);else g.produceAt=now+.25;}continue;}
   if(u.mount){const carrier=units.get(u.mount);if(carrier){u.x=carrier.x;u.y=carrier.y+1.7;u.z=carrier.z;u.yaw=carrier.yaw;}else u.mount=0;}
   if(commandTick(u,dt,w,actors))continue;
   if(now>=u.thinkAt){u.thinkAt=now+R.think;u.state='Search';let choices=actors.filter(a=>visible(u,a,w));const focus=g.focus;choices.sort((a,b)=>(focus?(dist(a,focus)<=C.focusRadius?0:1)-(dist(b,focus)<=C.focusRadius?0:1):0)||dist(u,a)-dist(u,b));
    if(u.memory?.captured)choices.sort((a,b)=>(a.id===u.memory.target?-1:0)-(b.id===u.memory.target?-1:0));
    const a=choices[0];u.target=a?.id||null;if(a){u.memory={...pose(a),target:a.id,until:now+R.memory};if(['supervisor','flyer','guard'].includes(u.type))share(u,u.memory,u.type==='supervisor'?12:15);}
    if(u.type==='turret'&&!u.mount&&!u.fused){const shield=near(u,2).find(v=>v.type==='shield'&&v.owner===u.owner&&![...units.values()].some(b=>b.mount===v.id));if(shield)u.mount=shield.id;}
   }
   if(u.type==='repair'){support(u,dt,w);const hurt=near(u,6).find(v=>v.team===u.team&&v.hp<v.maxHp);move(u,hurt||destination(u,g,owner),dt,w);continue;}
   if(u.link&&u.type==='shield'&&!units.has(u.link))u.link=0;
   const target=u.target?w.actors.get(u.target):null;
   if(u.type==='fragment'&&!u.target&&u.memory?.target){const a=w.actors.get(u.memory.target);if(a&&dist(u,a)<T.fragment.range&&w.see(u,a))u.target=a.id;}
   if(!attack(u,target||w.actors.get(u.target),dt,w)){const dest=destination(u,g,owner);u.state=u.command?'Command':'Move';move(u,dest,dt,w);}
   if(u.type==='shield'&&u.link)for(const a of actors)if(a.alive&&a.team!==u.team&&dist(u,a)<1.1&&Math.abs((a.y||0)-u.y)<1.7)w.push(a,u,dt*1.5);
  }
  // Wires use swept player motion, so a fast crossing cannot skip a thin line.
  for(const g of groups.values()){const wires=[...units.values()].filter(u=>u.gid===g.id&&u.type==='wire');if(wires.length===2&&dist(...wires)<=R.wireLength){const [a,b]=wires;for(const p of actors){if(!p.alive||p.team===g.team||Math.abs((p.y||0)-a.y)>.8)continue;const prev=g.previous.get(p.id)||pose(p),dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,0,1):0,nearLine=Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t)<.45;
     const cross=(x,z)=>(x-a.x)*dz-(z-a.z)*dx,along=(x,z)=>((x-a.x)*dx+(z-a.z)*dz)/(l||1),sa=cross(prev.x,prev.z),sb=cross(p.x,p.z),fraction=sa!==sb?sa/(sa-sb):-1,intersection=along(prev.x+(p.x-prev.x)*fraction,prev.z+(p.z-prev.z)*fraction),swept=fraction>=0&&fraction<=1&&intersection>=0&&intersection<=1;
     if((nearLine||swept)&&now>=(g.wireAt.get(p.id)||0)&&w.clear({x:a.x,y:a.y+.15,z:a.z},{x:p.x,y:(p.y||0)+.15,z:p.z})){slow(p,R.wireSlow,now+R.wireDuration);g.wireAt.set(p.id,now+R.wireCooldown);pulse('wire',p);}g.previous.set(p.id,pose(p));}}
  }
  for(const [id,s]of slows)if(now>=s.until||!w.actors.get(id)?.alive||w.actors.get(id).team!==s.team)slows.delete(id);
  for(const [id,r]of wrecks)if(now>=r.endsAt)wrecks.delete(id);
  for(const [id,g]of groups)if(!g.pending&&!g.unitIds.some(id=>units.has(id)))groups.delete(id);
 }
 function commandGroup(owner,key){return[...groups.values()].reverse().find(g=>{if(g.owner!==owner||g.key!==key||g.pending||g.commandUsed)return false;const list=g.unitIds.map(id=>units.get(id)).filter(Boolean);return key==='q'&&!g.mode?list.filter(u=>u.type==='shield').length===2:list.some(u=>key==='q'?u.type==='turret':key==='e'?['supervisor','dismantler'].includes(u.type):T[u.type].factory);})||null;}
 function doCommand(g,p,w){const list=g.unitIds.map(id=>units.get(id)).filter(Boolean);if(g.key==='q'&&!g.mode){const shields=list.filter(u=>u.type==='shield');if(shields.length!==2)return false;shields[0].link=shields[1].id;shields[1].link=shields[0].id;g.yaw=Math.atan2(shields[0].x-p.x,shields[0].z-p.z);const center={x:(shields[0].x+shields[1].x)/2,y:(shields[0].y+shields[1].y)/2,z:(shields[0].z+shields[1].z)/2};for(let i=0;i<2;i++){const u=shields[i],side=i?1:-1,join={x:center.x+Math.cos(g.yaw)*side*.6,y:center.y,z:center.z-Math.sin(g.yaw)*side*.6};u.yaw=g.yaw;const target=w.stop(join,p,C.linkDistance);u.command={type:'link',join,point:target,ready:false};}g.order=p;
  }else if(g.key==='q'){g.focus=p;const turrets=list.filter(u=>u.type==='turret');if(turrets.length===2&&dist(...turrets)<=C.fuseDistance&&!turrets.some(u=>u.mount)){const [a,b]=turrets;a.hp+=b.hp;a.maxHp+=b.maxHp;a.fused=true;a.radius=.6;units.delete(b.id);for(const v of units.values())if(v.mount===b.id)v.mount=0;pulse('fuse',a);}}
  else if(g.key==='e'){const u=list.find(u=>['supervisor','dismantler'].includes(u.type));if(!u)return false;const laser=u.type==='supervisor',end=w.stop({x:u.x,y:u.y+(laser?1:0),z:u.z},p,laser?C.laserRange:C.dashRange);u.command={type:laser?'laser':'dash',point:end,at:now+(laser?C.laserWarning:C.dashWarning),end:now+C.laserWarning+C.laserDuration,damage:new Map()};u.hitIds.clear();pulse('warning',u,end);}
  else if(g.key==='x'){const f=list.find(u=>T[u.type].factory);if(!f)return false;if(!g.mode){g.order=p;g.yaw=Math.atan2(f.x-p.x,f.z-p.z);}else{let made=0;while(made<C.emergencyCount&&g.materials>0&&spawnFactory(g,f,w,true))made++;if(!made)return false;f.endsAt=Math.max(now,f.endsAt-C.emergencyTime);}}
  else return false;g.commandUsed=true;pulse('command',p);return true;
 }
 function reset(){units.clear();groups.clear();wrecks.clear();slows.clear();reservations.clear();bins.clear();fx.length=0;serial=0;round=0;last=null;guest=false;}
 return{
  reset,units:()=>[...units.values()],groups:()=>[...groups.values()],wrecks:()=>[...wrecks.values()],effects:()=>fx.filter(e=>now-e.at<.6),counts,capacity,
  canDeploy(actor,key,mode,p,w){const skill=S[key];return!!(actor?.alive&&skill&&[0,1].includes(mode)&&finite(p)&&capacity(actor.id,actor.team,skill.rosters[mode].length)&&plan(actor.id,actor.team,skill.rosters[mode],p,w));},
  deploy(actor,key,mode,target,at,r,w){if(guest||!this.canDeploy(actor,key,mode,target,w))return null;if(round&&round!==r)reset();round=r;now=at;const g={id:++serial,owner:actor.id,team:actor.team,key,mode,yaw:actor.yaw||0,point:pose(target),roster:[...S[key].rosters[mode]],startedAt:at,endsAt:at+Math.max(...S[key].rosters[mode].map(k=>T[k].life)),unitIds:[],pending:key==='c',landsAt:at+(key==='c'?target.flight||.5:0),from:{x:actor.x,y:(actor.y||0)+1.7,z:actor.z},flight:target.flight||.5,commandUsed:false,materials:0,total:S[key].rosters[mode].length-(key==='x'?1:0),replaced:0,produceAt:at+(mode?C.productionInterval:C.resupplyInterval),lost:[],damage:new Map(),captures:new Map(),wireAt:new Map(),previous:new Map()};groups.set(g.id,g);if(!g.pending&&!roster(g,w,at)){groups.delete(g.id);return null;}return g;},
  commandable:(owner,key)=>commandGroup(owner,key),
  command(owner,key,p,at,w){if(guest||!finite(p))return false;now=at;const g=commandGroup(owner,key);return !!g&&doCommand(g,p,w);},
  update(at,r,actors,world){if(guest)return;if(round&&r!==round){reset();round=r;return;}round=r;if(last===at)return;const dt=last===null?0:clamp(at-last,0,.25);last=at;now=at;const w={...world,actors:new Map(actors.map(a=>[a.id,a]))};step(dt,w,actors);},
  speedScale(actor,at){const s=slows.get(actor.id);return s&&s.until>at&&s.team===actor.team?s.scale:1;},
  hit(id,amount,team,at,w){if(guest)return false;now=at;return damage(units.get(id),amount,team,w);},
  raycast(origin,dir,max,team){let best=null;for(const u of units.values()){if(u.team===team&&u.type!=='shield')continue;const t=T[u.type],n=u.type==='shield'?boxRay(origin,dir,u,best?.distance??max):sphereRay(origin,dir,{x:u.x,y:u.y+t.height*.5,z:u.z},Math.max(t.radius,t.height*.45),best?.distance??max);if(n!==null)best={id:u.id,type:u.type,distance:n,point:{x:origin.x+dir.x*n,y:origin.y+dir.y*n,z:origin.z+dir.z*n}};}return best;},
  pending(at){return[...groups.values()].filter(g=>g.pending).map(g=>({...g,position:throwPosition({type:'ember-solder',fromX:g.from.x,fromY:g.from.y,fromZ:g.from.z,...g.point,flight:Math.max(.001,g.flight),startedAt:g.startedAt},at)}));},
  snapshot(){if(!units.size&&!groups.size&&!wrecks.size)return null;return{v:1,r:round,
   g:[...groups.values()].map(g=>[g.id,g.owner,g.team==='blue'?0:1,'cqex'.indexOf(g.key),g.mode,q(g.startedAt),q(g.endsAt),+g.commandUsed,g.materials,+g.pending,q(g.point.x),q(g.point.y),q(g.point.z),q(g.landsAt),q(g.from?.x||0),q(g.from?.y||0),q(g.from?.z||0)]),
   u:[...units.values()].map(u=>[u.id,u.gid,types.indexOf(u.type),q(u.x),q(u.y),q(u.z),q(u.yaw),q(u.hp),q(u.maxHp),q(u.armor),states.indexOf(u.state),q(u.startedAt),q(u.endsAt),u.link||0,u.mount||0,+!!u.fused,u.command?.type==='laser'?1:u.command?.type==='dash'?2:0,q(u.command?.at||u.warningAt||0),q(u.command?.end||0),q(u.command?.point.x||0),q(u.command?.point.y||0),q(u.command?.point.z||0),q(u.surfaceX||0),q(u.surfaceZ||0)]),
   w:[...wrecks.values()].map(u=>[u.id,types.indexOf(u.type),u.team==='blue'?0:1,q(u.x),q(u.y),q(u.z),q(u.endsAt)]),
   s:[...slows].map(([id,s])=>[id,q(s.scale),q(s.until),s.team==='blue'?0:1]),
   f:fx.filter(e=>now-e.at<.6).slice(-12).map(e=>[e.id,['deploy','destroy','warning','shot','blast','cut','repair','recycle','wire','fuse','command','laser'].indexOf(e.type),q(e.at),q(e.x),q(e.y),q(e.z),q(e.tx??e.x),q(e.ty??e.y),q(e.tz??e.z)])};},
  restore(packet,at,r){if(packet===null||packet===undefined){reset();guest=true;return true;}if(!packet||Object.keys(packet).sort().join()!=='f,g,r,s,u,v,w'||packet.v!==1||packet.r!==r||!Array.isArray(packet.g)||packet.g.length>96||!Array.isArray(packet.u)||packet.u.length>R.worldLimit||!Array.isArray(packet.w)||packet.w.length>R.wreckLimit||!Array.isArray(packet.s)||packet.s.length>10||!Array.isArray(packet.f)||packet.f.length>12)return false;
   const ints=(a,n,skip=[])=>Array.isArray(a)&&a.length===n&&a.every((v,i)=>skip.includes(i)||Number.isSafeInteger(v)&&Math.abs(v)<=1e9),newG=new Map(),newU=new Map(),newW=new Map();
   for(const a of packet.g){if(!ints(a,17,[1])||a[0]<1||newG.has(a[0])||typeof a[1]!=='string'||a[1].length>64||!a[1]||![0,1].includes(a[2])||a[3]<0||a[3]>3||![0,1].includes(a[4])||![0,1].includes(a[7])||![0,1].includes(a[9])||a[8]<0||a[8]>18||a[6]<a[5]||unq(a[5])>at+.2||unq(a[6])>at+24||[10,11,12,14,15,16].some(i=>Math.abs(a[i])>100000))return false;newG.set(a[0],{id:a[0],owner:a[1],team:a[2]?'red':'blue',key:'cqex'[a[3]],mode:a[4],startedAt:unq(a[5]),endsAt:unq(a[6]),commandUsed:!!a[7],materials:a[8],pending:!!a[9],point:{x:unq(a[10]),y:unq(a[11]),z:unq(a[12])},landsAt:unq(a[13]),roster:S['cqex'[a[3]]].rosters[a[4]],flight:Math.max(.001,unq(a[13]-a[5])),from:{x:unq(a[14]),y:unq(a[15]),z:unq(a[16])},unitIds:[]});}
   const cs=new Map(),ts=new Map();for(const a of packet.u){const g=newG.get(a?.[1]),t=T[types[a?.[2]]];if(!ints(a,24)||a[0]<1||newU.has(a[0])||!g||!t||a[7]<=0||a[7]>a[8]||a[8]>70000||a[9]<0||a[9]>4000||!states[a[10]]||a[12]<a[11]||unq(a[12])>at+16||[3,4,5,19,20,21].some(i=>Math.abs(a[i])>100000)||!Number.isInteger(a[15])||a[15]<0||a[15]>1||a[16]<0||a[16]>2)return false;cs.set(g.owner,(cs.get(g.owner)||0)+1);ts.set(g.team,(ts.get(g.team)||0)+1);if(cs.get(g.owner)>R.ownerLimit||ts.get(g.team)>R.teamLimit)return false;const old=units.get(a[0]);newU.set(a[0],{id:a[0],gid:g.id,owner:g.owner,team:g.team,type:types[a[2]],x:unq(a[3]),y:unq(a[4]),z:unq(a[5]),yaw:unq(a[6]),hp:unq(a[7]),maxHp:unq(a[8]),armor:unq(a[9]),state:states[a[10]],startedAt:unq(a[11]),endsAt:unq(a[12]),link:a[13],mount:a[14],fused:!!a[15],warningAt:unq(a[17]),command:a[16]?{type:a[16]===1?'laser':'dash',at:unq(a[17]),end:unq(a[18]),point:{x:unq(a[19]),y:unq(a[20]),z:unq(a[21])}}:null,renderFrom:old?pose(old):null,receivedAt:at,surfaceX:unq(a[22]),surfaceZ:unq(a[23])});g.unitIds.push(a[0]);}
   for(const u of newU.values())if(u.link&&!newU.has(u.link)||u.mount&&!newU.has(u.mount))return false;
   for(const a of packet.w){if(!ints(a,7)||a[0]<1||newW.has(a[0])||!T[types[a[1]]]||![0,1].includes(a[2])||[3,4,5].some(i=>Math.abs(a[i])>100000)||unq(a[6])>at+5.2)return false;newW.set(a[0],{id:a[0],type:types[a[1]],team:a[2]?'red':'blue',x:unq(a[3]),y:unq(a[4]),z:unq(a[5]),endsAt:unq(a[6])});}
   const newS=new Map();for(const a of packet.s){if(!ints(a,4,[0])||typeof a[0]!=='string'||a[0].length>64||newS.has(a[0])||a[1]<60||a[1]>100||unq(a[2])>at+2.2||![0,1].includes(a[3]))return false;newS.set(a[0],{scale:unq(a[1]),until:unq(a[2]),team:a[3]?'red':'blue'});}
   const newF=[];for(const a of packet.f){if(!ints(a,9)||a[1]<0||a[1]>11||unq(a[2])>at+.2||[3,4,5,6,7,8].some(i=>Math.abs(a[i])>100000))return false;newF.push({id:a[0],type:['deploy','destroy','warning','shot','blast','cut','repair','recycle','wire','fuse','command','laser'][a[1]],at:unq(a[2]),x:unq(a[3]),y:unq(a[4]),z:unq(a[5]),tx:unq(a[6]),ty:unq(a[7]),tz:unq(a[8])});}
   units.clear();groups.clear();wrecks.clear();slows.clear();for(const [k,v]of newU)units.set(k,v);for(const [k,v]of newG)groups.set(k,v);for(const [k,v]of newW)wrecks.set(k,v);for(const [k,v]of newS)slows.set(k,v);fx.splice(0,fx.length,...newF);round=r;now=at;guest=true;index();return true;
  },
 };
}
