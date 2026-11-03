import { URCHIN_DISARM, disarmState } from './urchin-disarm.js';
// Opaque, ordinary depth-tested meshes; explicit visibility also respects smoke.
export function createDisarmFX(T,camera){
 const group=new T.Group(),hand=new T.Group(),items=new Map();group.name='Urchin Q / weapon thorns';hand.name='Urchin Q / held blue thorn';camera.add(hand);
 const cone=new T.ConeGeometry(.04,.24,5),box=new T.BoxGeometry(1,1,1),ring=new T.TorusGeometry(.20,.018,5,24),blue=new T.MeshBasicMaterial({color:'#75eaff',depthTest:true,depthWrite:true}),white=new T.MeshBasicMaterial({color:'#e6ffff',depthTest:true,depthWrite:true});
 const palm=new T.Mesh(new T.SphereGeometry(.055,8,6),new T.MeshBasicMaterial({color:'#e9eeee'}));palm.position.set(.22,-.30,-.55);hand.add(palm);for(let i=0;i<5;i++){const s=new T.Mesh(cone,blue);s.position.set(.21+(i-2)*.028,-.22,-.56);s.rotation.z=(i-2)*.16;hand.add(s);}hand.visible=false;
 const make=()=>{const o=new T.Group();for(let i=0;i<8;i++)o.add(new T.Mesh(cone,blue));o.add(new T.Mesh(ring,white),new T.Mesh(box,blue));o.traverse(n=>{n.raycast=()=>{};n.userData.solid=false;});group.add(o);return o;};
 function update(events,now,{actors=[],visible=()=>true,aim=null,holding=false,reducedMotion=false}={}){
  hand.visible=holding;const seen=new Set();const all=events.filter(e=>e.type==='urchin-disarm');if(aim)all.push({id:'q-aim',targetId:aim.targetId,sourceId:'',startedAt:now,triggerAt:now+URCHIN_DISARM.delay,disarm:[0,0]});
  for(const e of all){const a=actors.find(a=>a.id===e.targetId);if(!a?.alive)continue;const p={x:a.x,y:(a.y||0)+1.25-(a.crouch||0)*.55,z:a.z};if(!visible(p))continue;
   seen.add(e.id);let o=items.get(e.id);if(!o){o=make();items.set(e.id,o);}o.position.set(p.x,p.y,p.z);o.rotation.y=a.yaw??a.netYaw??0;const age=now-e.startedAt,t=Math.max(0,Math.min(1,age/URCHIN_DISARM.delay)),state=disarmState(e),preview=e.id==='q-aim';
   if(state&&!o.userData.resolvedAt)o.userData.resolvedAt=now;const after=state?Math.max(0,now-o.userData.resolvedAt):0,shift=state===2?after*2:0;
   for(let i=0;i<8;i++){const angle=i*Math.PI/4;o.children[i].position.set(Math.cos(angle)*(.16+shift),Math.sin(angle)*.1,-.28);o.children[i].rotation.z=angle-Math.PI/2;o.children[i].scale.setScalar(preview?.4:state?Math.max(0,1-after*2):.3+t*.8);}
   o.children[8].position.set(0,0,-.3);o.children[8].scale.setScalar(preview?.4:state?Math.max(0,1-after*2):.5+t*.5);
   const s=actors.find(a=>a.id===e.sourceId),thread=o.children[9];thread.visible=!preview&&!state&&!!s&&visible({x:s.x,y:(s.y||0)+1.3,z:s.z});if(thread.visible){const from=new T.Vector3(s.x,(s.y||0)+1.3,s.z),to=new T.Vector3(p.x,p.y,p.z),d=from.sub(to);for(let i=1;i<8;i++)if(!visible({x:p.x+d.x*i/8,y:p.y+d.y*i/8,z:p.z+d.z*i/8})){thread.visible=false;break;}thread.position.copy(d.clone().multiplyScalar(.5));thread.scale.set(.014,.014,d.length());thread.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),d.normalize());}
   if(!reducedMotion&&age>URCHIN_DISARM.growthAt&&!state)o.position.x+=Math.sin(now*70)*.008;
  }for(const[id,o]of items)if(!seen.has(id)){o.removeFromParent();items.delete(id);}group.visible=items.size>0;
 }
 function reset(){for(const o of items.values())o.removeFromParent();items.clear();hand.visible=false;group.visible=false;}
 return{group,hand,update,reset,dispose(){reset();group.removeFromParent();hand.removeFromParent();cone.dispose();box.dispose();ring.dispose();blue.dispose();white.dispose();palm.geometry.dispose();palm.material.dispose();}};
}
