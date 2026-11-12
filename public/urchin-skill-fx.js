import { createUrchinLanceFX } from './urchin-lance-fx.js';
import { urchinGloomPosition } from './character-skills.js';
export function createUrchinSkillFX(THREE){
 const lanceFX=createUrchinLanceFX(THREE);const group=new THREE.Group();group.name='青ウニ / radial skill crowns';const items=new Map(),g=new THREE.ConeGeometry(.045,.24,5),m=new THREE.MeshBasicMaterial({color:'#a9f1e4',transparent:true,opacity:.9,depthWrite:false});
 const laneG=new THREE.BoxGeometry(1,1,1),warnM=new THREE.MeshBasicMaterial({color:'#18b5a2',transparent:true,opacity:.65,depthWrite:false}),hitM=new THREE.MeshBasicMaterial({color:'#e9fff9',transparent:true,opacity:.9,depthWrite:false}),up=new THREE.Vector3(0,0,1);
 const waveG=new THREE.SphereGeometry(1,20,12),ringG=new THREE.TorusGeometry(1,.045,5,36),darkM=new THREE.MeshBasicMaterial({color:'#062b43',transparent:true,opacity:.76,depthWrite:false}),rimM=new THREE.MeshBasicMaterial({color:'#5ffff0',transparent:true,opacity:.8,depthWrite:false}),wireM=new THREE.MeshBasicMaterial({color:'#35a5ac',wireframe:true,transparent:true,opacity:.45,depthWrite:false}),pose=new THREE.Object3D();
 function update(events,now,options={}){const {actors=[],externalProps=false}=options;lanceFX.update(events,now,options);if(lanceFX.group.visible)group.add(lanceFX.group);else lanceFX.group.removeFromParent();const seen=new Set();for(const e of events){if(!e.type.startsWith('urchin-'))continue;
 if(e.type==='urchin-gloom'){
  seen.add(e.id);let root=items.get(e.id);if(!root){root=new THREE.Group();root.name='青ウニ / 深潮 traveling wave';
   root.add(new THREE.Mesh(waveG,darkM),new THREE.Mesh(waveG,wireM),new THREE.Mesh(ringG,rimM));
   const spines=new THREE.InstancedMesh(g,rimM,8);spines.frustumCulled=false;root.add(spines);
   root.traverse(o=>{o.raycast=()=>{};o.userData.solid=false;});items.set(e.id,root);group.add(root);
  }
  const p=urchinGloomPosition(e,now),direction=new THREE.Vector3(e.x-e.fromX,e.y-e.fromY,e.z-e.fromZ).normalize();
  root.position.set(p.x,p.y,p.z);root.quaternion.setFromUnitVectors(up,direction);root.visible=!externalProps&&now<e.triggerAt+e.flight+.12;
  const arm=THREE.MathUtils.clamp((now-e.startedAt)/(e.triggerAt-e.startedAt),.1,1),pulse=1+Math.sin((now-e.triggerAt)*18)*.035;
  root.children[0].scale.set(e.radius*arm,e.radius*arm,.42);root.children[1].scale.set(e.radius*arm*1.04,e.radius*arm*1.04,.55);
  root.children[2].scale.setScalar(e.radius*arm*pulse);root.children[2].rotation.z=now*.8;
  for(let i=0;i<8;i++){const a=i*Math.PI/4+now*.5;pose.position.set(Math.cos(a)*e.radius*arm,Math.sin(a)*e.radius*arm,0);pose.rotation.set(0,0,a-Math.PI/2);pose.scale.setScalar(1.7);pose.updateMatrix();root.children[3].setMatrixAt(i,pose.matrix);}root.children[3].instanceMatrix.needsUpdate=true;
  continue;
 }
 if(e.type==='urchin-lance')continue;
 const actor=actors.find(a=>a.id===(e.targetId||e.sourceId));if(!actor?.alive)continue;seen.add(e.id);let root=items.get(e.id);if(!root){root=new THREE.Group();root.name=e.type;group.add(root);items.set(e.id,root);const count=e.type==='urchin-trident'?3:8;for(let i=0;i<count;i++){const a=i*Math.PI*2/count,spine=new THREE.Mesh(g,m);spine.position.set(Math.cos(a)*.32,0,Math.sin(a)*.32);spine.rotation.z=-Math.PI/2;spine.rotation.y=-a;spine.raycast=()=>{};root.add(spine);}}
 root.position.set(actor.x,(actor.y||0)+2.05-(actor.crouch||0)*.55,actor.z);root.rotation.y=now*.8;
 }for(const[id,o]of items)if(!seen.has(id)){o.removeFromParent();items.delete(id);}}
 function reset(){lanceFX.reset();lanceFX.group.removeFromParent();for(const o of items.values())o.removeFromParent();items.clear();}return{group,update,reset,dispose(){lanceFX.dispose();reset();group.removeFromParent();g.dispose();m.dispose();laneG.dispose();warnM.dispose();hitM.dispose();waveG.dispose();ringG.dispose();darkM.dispose();rimM.dispose();wireM.dispose();}};
}
