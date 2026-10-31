import { skillProjectilePosition } from './character-skills.js';
import { acquireSkillProps } from './prepared-skill-fx.js';

export function createNobiSkillFX(T,camera=null){
 const props=acquireSkillProps(T);
 const group=new T.Group();group.name='のび / thrown bell whisker toolbox collar';
 const geometries=[],materials=[],items=new Map();let throwStarted=-Infinity;const handGroup=new T.Group();handGroup.name='Nobi throw hand';handGroup.visible=false;camera?.add(handGroup);
 const geo=g=>(geometries.push(g),g),mat=color=>{const m=new T.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false});materials.push(m);return m;};
 const gold=mat('#ffe166'),blue=mat('#8cccf0'),white=mat('#fff4df');
 const sphere=geo(new T.SphereGeometry(.12,10,8)),line=geo(new T.BoxGeometry(.3,.025,.025)),ring=geo(new T.TorusGeometry(1,.004,4,96)),box=geo(new T.BoxGeometry(.35,.25,.25));
 const mesh=(g,m)=>{const o=new T.Mesh(g,m);o.raycast=()=>{};return o;};
 function make(type,area){
  const root=new T.Group(),symbol=new T.Group();root.name=type;root.add(symbol);
  if(area)symbol.add(props.create(type));
  else if(['nobi-tag','nobi-bell'].includes(type)){symbol.add(mesh(sphere,gold));const r=mesh(ring,gold);r.rotation.x=Math.PI/2;r.scale.setScalar(.2);r.position.y=-.12;symbol.add(r);}
  else if(['nobi-brake','nobi-whisker'].includes(type)){for(const side of[-1,1])for(let i=-1;i<=1;i++){const w=mesh(line,blue);w.position.set(side*.2,i*.07,0);w.rotation.z=side*i*.2;symbol.add(w);}}
  else if(['nobi-tool','nobi-toolbox'].includes(type)){symbol.add(mesh(box,gold));for(const side of[-1,1]){const w=mesh(line,white);w.rotation.z=side*.8;w.position.y=.16;symbol.add(w);}}
  else{for(const side of[-1,1]){const w=mesh(line,white);w.position.x=side*.13;w.rotation.z=side*.75;w.scale.x=1.5;symbol.add(w);}}
  let boundary=null;if(area){boundary=mesh(ring,['nobi-bell','nobi-toolbox'].includes(type)?gold:type==='nobi-whisker'?blue:white);boundary.rotation.x=Math.PI/2;root.add(boundary);}
  return{root,symbol,boundary};
 }
 function update(events,now,{actors=[],showHand=true,reducedMotion=false,externalProps=false}={}){
  const age=now-throwStarted;handGroup.visible=!!camera&&showHand&&age>=0&&age<.24;const t=Math.max(0,Math.min(1,age/.24));if(handGroup.visible){handGroup.position.set(.22,-.3+(reducedMotion?0:Math.sin(t*Math.PI)*.08),-.5-t*.18);handGroup.rotation.set(reducedMotion?0:-t*.65,.2,-.16);}
  const seen=new Set();for(const e of events.slice(0,20)){
   if(!e.type.startsWith('nobi-')||now<e.startedAt||now>=e.endsAt)continue;
   const area=['nobi-bell','nobi-whisker','nobi-toolbox','nobi-collar'].includes(e.type),target=area?null:actors.find(a=>a.id===(e.targetId||e.sourceId));
   if(!area&&!target?.alive)continue;
   const point=area?skillProjectilePosition(e,now):{x:target.x,y:(target.y||0)+(e.type==='nobi-tool'?1:2.02)-(target.crouch||0)*.55,z:target.z};if(!point)continue;
   seen.add(e.id);let item=items.get(e.id);if(!item){item=make(e.type,area);items.set(e.id,item);group.add(item.root);}
   item.root.position.set(point.x,point.y,point.z);item.symbol.rotation.y=now*.8;item.symbol.position.y=area&&now>=e.triggerAt?.45:0;item.symbol.visible=!(externalProps&&area&&now<e.startedAt+e.flight);
   if(item.boundary){item.boundary.visible=now>=e.triggerAt;item.boundary.scale.setScalar(e.radius);}
  }
  for(const[id,item]of items)if(!seen.has(id)){item.root.removeFromParent();items.delete(id);}
 }
 function playThrow(type,now){if(!['nobi-bell','nobi-whisker','nobi-toolbox','nobi-collar'].includes(type)||!Number.isFinite(now))return false;handGroup.clear();handGroup.add(make(type,false).root);throwStarted=now;return true;}
 const throwing=now=>Number.isFinite(now)&&now>=throwStarted&&now<throwStarted+.32;
 function reset(){throwStarted=-Infinity;handGroup.visible=false;handGroup.clear();for(const item of items.values())item.root.removeFromParent();items.clear();}
 let disposed=false;return{group,update,playThrow,throwing,reset,dispose(){if(disposed)return;disposed=true;reset();handGroup.removeFromParent();group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());props.dispose();}};
}
