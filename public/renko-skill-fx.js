import { RENKO_SKILLS as R } from './abilities.js';

// Twenty pooled effects. A physical pack, twin exhausts and a straight dart;
// no lights, audio, particles allocated per frame, or gameplay ray surfaces.
export function createRenkoSkillFX(T){
 const group=new T.Group();group.name='Renko / dart, drive and jetpack';
 const metal=new T.MeshStandardMaterial({color:'#536b8d',roughness:.65,metalness:.35}),glow=new T.MeshBasicMaterial({color:'#9ee9ff',transparent:true,opacity:.8,depthWrite:false}),gold=new T.MeshBasicMaterial({color:'#ffed72'});
 const box=new T.BoxGeometry(.46,.42,.2),tank=new T.CylinderGeometry(.1,.1,.42,8),flame=new T.ConeGeometry(.12,.65,8),ball=new T.SphereGeometry(.13,8,6),trail=new T.BoxGeometry(.06,.06,1.1);
 const direction=new T.Vector3(),position=new T.Vector3(),look=new T.Vector3();
 const pool=Array.from({length:20},()=>{const root=new T.Group(),pack=new T.Group(),dart=new T.Group(),drive=new T.Group();root.add(pack,dart,drive);group.add(root);root.visible=false;
  const base=new T.Mesh(box,metal);pack.add(base);
  for(const side of[-1,1]){const can=new T.Mesh(tank,metal);can.position.x=side*.24;pack.add(can);const exhaust=new T.Mesh(flame,glow);exhaust.rotation.z=Math.PI;exhaust.position.set(side*.24,-.48,0);pack.add(exhaust);const line=new T.Mesh(trail,glow);line.position.set(side*.32,-.65,0);line.rotation.x=Math.PI/2;drive.add(line);}
  dart.add(new T.Mesh(ball,gold));const tail=new T.Mesh(trail,glow);tail.position.z=.6;dart.add(tail);return{root,pack,dart,drive};});
 function reset(){for(const e of pool)e.root.visible=false;}
 function update(events,now,{actors=[],visible=()=>true}={}){reset();let index=0;
  for(const e of events){if(!e.type.startsWith('renko-')||index===pool.length||now<e.startedAt||now>=e.endsAt)continue;const o=pool[index++];let p;
   if(e.type==='renko-dart'){const d=direction.set(e.x-e.fromX,e.y-e.fromY,e.z-e.fromZ),length=d.length(),t=Math.min(length,Math.max(0,now-e.startedAt)*R.dartSpeed);p=position.set(e.fromX,e.fromY,e.fromZ).addScaledVector(d.normalize(),t);o.root.position.copy(p);o.root.lookAt(look.copy(p).add(d));}
   else{const a=actors.find(a=>a.id===e.sourceId&&a.alive&&a.team===e.team);if(!a)continue;p={x:a.x,y:(a.y||0)+.95,z:a.z};o.root.position.set(p.x,p.y,p.z);o.root.rotation.set(0,(a.yaw??a.netYaw??0)+Math.PI,0);o.pack.position.z=-.23;}
   if(!visible(p,e))continue;o.root.visible=true;o.dart.visible=e.type==='renko-dart';o.pack.visible=e.type==='renko-jet';o.drive.visible=e.type==='renko-drive';
  }
 }
 return{group,update,reset,dispose(){group.removeFromParent();for(const x of[metal,glow,gold,box,tank,flame,ball,trail])x.dispose();}};
}
