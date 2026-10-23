import {TRC_DOORS,TRC_LADDERS,trcPoint as P} from './trc-layout.js';

export const TRC_DOOR_HP=180;
export const TRC_CLIMB_SPEED=1.45;
export function createTrcTraversal(map,{doorMeshes=new Map()}={}){
 const doors=TRC_DOORS.map(d=>({...d,hp:TRC_DOOR_HP,open:false,lastUse:-Infinity,collider:map.colliders.find(c=>c.doorId===d.id)}));
 const valid=s=>Array.isArray(s)&&s.length===doors.length&&s.every((v,i)=>Array.isArray(v)&&v.length===3&&v[0]===doors[i].id&&Number.isInteger(v[1])&&v[1]>=0&&v[1]<=TRC_DOOR_HP&&typeof v[2]==='boolean'&&(v[1]>0||v[2]));
 function sync(d){d.collider.disabled=d.open||d.hp<=0;const v=doorMeshes.get(d.id);if(v){v.leaf.visible=d.hp>0;v.leaf.userData.trcBroken=d.hp<=0;}map.collision.invalidate();}
 function distanceToDoor(a,d){const c=d.collider;return Math.hypot(a.x-Math.max(c.minX,Math.min(c.maxX,a.x)),a.z-Math.max(c.minZ,Math.min(c.maxZ,a.z)));}
 function nearby(actor){
  if(!actor?.alive)return null;
  if(actor.trcLadder)return {kind:'ladder',id:actor.trcLadder,label:'はしご · W↑ / S↓ / Spaceで離す'};
  const y=actor.y||0;
  for(const l of TRC_LADDERS){const top=Math.abs(y-l.height)<.4&&Math.hypot(actor.x-l.exit.x,actor.z-l.exit.z)<1.7,bottom=y<.25&&Math.hypot(actor.x-l.x,actor.z-l.z)<1.55;
   if((top||bottom)&&map.collision.rayClear(actor.x,y+.8,actor.z,l.x,(top?l.height:0)+.8,l.z))return {kind:'ladder',id:l.id,label:'F · はしごを'+(top?'降りる':'登る')};}
  const d=doors.filter(d=>d.hp>0&&Math.abs(y-d.y)<.45&&distanceToDoor(actor,d)<2.05).sort((a,b)=>distanceToDoor(actor,a)-distanceToDoor(actor,b))[0];
  if(d){const dx=actor.x-d.x,dz=actor.z-d.z,len=Math.hypot(dx,dz)||1;const x=d.x+dx/len*.25,z=d.z+dz/len*.25;if(map.collision.rayClear(actor.x,y+1,actor.z,x,y+1,z))return {kind:'door',id:d.id,label:'F · '+d.label+'を'+(d.open?'閉める':'開く')};}
  return null;
 }
 function interact(actor,request,now,actors=[]){
  const n=nearby(actor);if(!n||n.id!==request?.id||n.kind!==request?.kind)return null;
  if(n.kind==='ladder'){
   if(actor.trcLadder){actor.trcLadder=null;return 'detach';}
   const l=TRC_LADDERS.find(l=>l.id===n.id),top=actor.y>1;actor.trcLadder=l.id;actor.x=l.x;actor.z=l.z;actor.y=top?l.height:0;actor.vy=0;actor.vx=actor.vz=0;return 'ladder';
  }
  const d=doors.find(d=>d.id===n.id);if(now-d.lastUse<.5)return null;
  if(d.open&&actors.some(a=>a.alive&&(a.y||0)<d.y+2.9&&(a.y||0)+1.7>d.y&&map.collision.overlaps(d.collider,a.x,a.z,.48)))return null;
  d.open=!d.open;d.lastUse=now;sync(d);return d.open?'door-open':'door-close';
 }
 function damage(id,amount){const d=doors.find(d=>d.id===id);if(!d||d.open||d.hp<=0||!Number.isFinite(amount)||amount<=0)return null;d.hp=Math.max(0,d.hp-Math.max(1,Math.round(Math.min(amount,300))));if(!d.hp)d.open=true;sync(d);return d.hp?'door-hit':'door-break';}
 function climb(actor,axis,dt,quiet=false){
  const l=TRC_LADDERS.find(l=>l.id===actor.trcLadder);if(!l||!actor.alive){actor.trcLadder=null;return false;}
  if(!Number.isFinite(axis)||!Number.isFinite(dt)||dt<=0)return true;
  const previous=actor.y,y=Math.max(0,Math.min(l.height,previous+Math.max(-1,Math.min(1,axis))*TRC_CLIMB_SPEED*(quiet?.6:1)*Math.min(dt,.1)));
  if(!map.collision.blocked(l.x,l.z,.34,y,1.15)){actor.x=l.x;actor.z=l.z;actor.y=y;actor.vy=0;actor.crouch=1;actor.vx=actor.vz=0;}
  if(axis>0&&actor.y>=l.height-.001){if(!map.collision.blocked(l.exit.x,l.exit.z,.34,l.height,1.15)){Object.assign(actor,l.exit);actor.trcLadder=null;}}
  else if(axis<0&&actor.y<=.001)actor.trcLadder=null;
  return true;
 }
 function reset(){for(const d of doors){d.hp=TRC_DOOR_HP;d.open=false;d.lastUse=-Infinity;sync(d);}update(10);}
 function restore(s){if(!valid(s))return false;for(let i=0;i<s.length;i++){const d=doors[i];d.hp=s[i][1];d.open=s[i][2];sync(d);}update(10);return true;}
 function update(dt){for(const d of doors){const v=doorMeshes.get(d.id);if(!v)continue;const target=d.open?1:0;v.amount+=Math.max(-dt*4,Math.min(dt*4,target-v.amount));v.leaf.scale.y=Math.max(.025,1-v.amount);v.leaf.position.y=1.45+v.amount*1.45;v.group.updateMatrixWorld(true);}}
 const routes={
  attackA:[P(13,58),P(8.5,58),P(8.5,49),P(5.2,49),P(5.2,34),P(9,34),P(9,30),{...P(10.4,30,3.2),ladder:'L1'},P(11.8,24.5,3.2),P(15,24.5,3.2),P(25,24,3.2)],
  attackB:[P(84,70),P(84,59),P(96,59),P(96,48),P(89,48),P(89,43),P(84,35)],
  defendA:[P(32,12),P(32,22,3.2),P(25,24,3.2)],
  defendB:[P(81,29),P(81,24,1.2),P(84,24,1.2)]
 };
 return {doors,ladders:TRC_LADDERS,routes,nearby,interact,damage,climb,reset,restore,valid,update,snapshot:()=>doors.map(d=>[d.id,d.hp,d.open])};
}
