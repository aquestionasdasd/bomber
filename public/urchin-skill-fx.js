export function createUrchinSkillFX(THREE){
 const group=new THREE.Group();group.name='青ウニ / radial skill crowns';const items=new Map(),g=new THREE.ConeGeometry(.045,.24,5),m=new THREE.MeshBasicMaterial({color:'#a9f1e4',transparent:true,opacity:.9,depthWrite:false});
 const laneG=new THREE.BoxGeometry(1,1,1),warnM=new THREE.MeshBasicMaterial({color:'#18b5a2',transparent:true,opacity:.65,depthWrite:false}),hitM=new THREE.MeshBasicMaterial({color:'#e9fff9',transparent:true,opacity:.9,depthWrite:false}),up=new THREE.Vector3(0,0,1);
 function update(events,now,{actors=[]}={}){const seen=new Set();for(const e of events){if(!e.type.startsWith('urchin-'))continue;
 if(e.type==='urchin-lance'){
  seen.add(e.id);let root=items.get(e.id);if(!root){root=new THREE.Group();root.name='青ウニ / 潮割り fixed lane';for(let i=0;i<3;i++){const line=new THREE.Mesh(laneG,i===2?hitM:warnM);line.raycast=()=>{};root.add(line);}for(let i=0;i<9;i++){const spine=new THREE.Mesh(g,m);spine.raycast=()=>{};spine.rotation.x=Math.PI/2;root.add(spine);}items.set(e.id,root);group.add(root);}
  const direction=new THREE.Vector3(e.x-e.fromX,e.y-e.fromY,e.z-e.fromZ),length=direction.length();root.position.set(e.fromX,e.fromY,e.fromZ);root.quaternion.setFromUnitVectors(up,direction.normalize());
  const fired=now>=e.triggerAt,phase=Math.max(0,Math.min(1,(now-e.startedAt)/(e.triggerAt-e.startedAt)));
  for(let i=0;i<3;i++){const line=root.children[i];line.position.set(i===2?0:(i?1:-1)*e.radius,0,length/2);line.scale.set(i===2?e.radius*2:.045,i===2?.08:.045,length);line.visible=i===2?fired:!fired;}
  for(let i=3;i<12;i++){const spine=root.children[i];spine.position.set(0,0,length*(i-2)/10);spine.scale.setScalar(fired?2.8:phase*.9);}
  continue;
 }
 const actor=actors.find(a=>a.id===(e.targetId||e.sourceId));if(!actor?.alive)continue;seen.add(e.id);let root=items.get(e.id);if(!root){root=new THREE.Group();root.name=e.type;group.add(root);items.set(e.id,root);const count=e.type==='urchin-trident'?3:8;for(let i=0;i<count;i++){const a=i*Math.PI*2/count,spine=new THREE.Mesh(g,m);spine.position.set(Math.cos(a)*.32,0,Math.sin(a)*.32);spine.rotation.z=-Math.PI/2;spine.rotation.y=-a;spine.raycast=()=>{};root.add(spine);}}
 root.position.set(actor.x,(actor.y||0)+2.05-(actor.crouch||0)*.55,actor.z);root.rotation.y=now*.8;
 }for(const[id,o]of items)if(!seen.has(id)){o.removeFromParent();items.delete(id);}}
 function reset(){for(const o of items.values())o.removeFromParent();items.clear();}return{group,update,reset,dispose(){reset();group.removeFromParent();g.dispose();m.dispose();laneG.dispose();warnM.dispose();hitM.dispose();}};
}
