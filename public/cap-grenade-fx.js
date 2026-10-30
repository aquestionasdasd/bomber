import { CAP_GRENADE, isCapGrenade, createCapFlight } from './cap-grenades.js';
// Replaceable presentation; no hit authority. All objects and materials are pooled.
export function createCapGrenadeFX(T){
 const group=new T.Group(),geometry=new T.SphereGeometry(1,10,6),pose=new T.Object3D(),flights=new Map();
 group.name='Cap / pooled cluster grenades';
 const colors={'cap-lens':'#ffbf70','cap-cluster-heal':'#73ffad','cap-cluster-damage':'#ff745c','cap-bank-grenade':'#79e7ee','cap-magazine-grenade':'#c49aff'},pools=new Map();
 for(const [type,color]of Object.entries(colors)){
  const solid=new T.MeshBasicMaterial({color,depthTest:true,depthWrite:true}),glow=new T.MeshBasicMaterial({color,transparent:true,opacity:.45,depthTest:true,depthWrite:false});
  const bodies=new T.InstancedMesh(geometry,solid,160),bursts=new T.InstancedMesh(geometry,glow,160);
  for(const mesh of [bodies,bursts]){mesh.count=0;mesh.frustumCulled=false;mesh.raycast=()=>{};group.add(mesh);}
  pools.set(type,{bodies,bursts,solid,glow});
 }
 function reset(){flights.clear();for(const p of pools.values())p.bodies.count=p.bursts.count=0;group.visible=false;}
 const put=(mesh,p,size)=>{if(mesh.count>=160)return;pose.position.set(p.x,p.y,p.z);pose.scale.setScalar(size);pose.updateMatrix();mesh.setMatrixAt(mesh.count++,pose.matrix);};
 function update(events,now,{sweep,visible=()=>true}={}){
  for(const p of pools.values())p.bodies.count=p.bursts.count=0;
  const seen=new Set();
  for(const e of events.slice(0,20)){if(!isCapGrenade(e.type)||now<e.startedAt||now>=e.endsAt)continue;seen.add(e.id);
   const p=pools.get(e.type);
   if(now>=e.startedAt+e.flight&&now<e.triggerAt&&visible(e))put(p.bodies,e,.15);
   if(now<e.triggerAt)continue;
   let flight=flights.get(e.id);if(!flight){flight=createCapFlight(e,sweep);flights.set(e.id,flight);}
   const result=flight.advance(now);
   for(const child of result.children)if(child.alive&&visible(child))put(p.bodies,child,CAP_GRENADE.bodyRadius);
   for(const blast of result.blasts){const age=now-blast.at;if(age<0||age>=CAP_GRENADE.fxDuration||!visible(blast))continue;
    put(p.bursts,blast,(blast.index<0?CAP_GRENADE.radius:CAP_GRENADE.childRadius)*(.12+.88*age/CAP_GRENADE.fxDuration));
   }
  }
  for(const id of flights.keys())if(!seen.has(id))flights.delete(id);
  for(const p of pools.values())for(const m of[p.bodies,p.bursts])m.instanceMatrix.needsUpdate=true;
  group.visible=seen.size>0;
 }
 return{group,update,reset,dispose(){reset();for(const p of pools.values()){p.bodies.dispose();p.bursts.dispose();p.solid.dispose();p.glow.dispose();}geometry.dispose();group.removeFromParent();}};
}
