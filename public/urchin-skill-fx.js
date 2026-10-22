export function createUrchinSkillFX(THREE){
 const group=new THREE.Group();group.name='青ウニ / radial skill crowns';const items=new Map(),g=new THREE.ConeGeometry(.045,.24,5),m=new THREE.MeshBasicMaterial({color:'#a9f1e4',transparent:true,opacity:.9,depthWrite:false});
 function update(events,now,{actors=[]}={}){const seen=new Set();for(const e of events){if(!e.type.startsWith('urchin-'))continue;const actor=actors.find(a=>a.id===(e.targetId||e.sourceId));if(!actor?.alive)continue;seen.add(e.id);let root=items.get(e.id);if(!root){root=new THREE.Group();root.name=e.type;group.add(root);items.set(e.id,root);const count=e.type==='urchin-trident'?3:8;for(let i=0;i<count;i++){const a=i*Math.PI*2/count,spine=new THREE.Mesh(g,m);spine.position.set(Math.cos(a)*.32,0,Math.sin(a)*.32);spine.rotation.z=-Math.PI/2;spine.rotation.y=-a;spine.raycast=()=>{};root.add(spine);}}
 root.position.set(actor.x,(actor.y||0)+2.05-(actor.crouch||0)*.55,actor.z);root.rotation.y=now*.8;
 }for(const[id,o]of items)if(!seen.has(id)){o.removeFromParent();items.delete(id);}}
 function reset(){for(const o of items.values())o.removeFromParent();items.clear();}return{group,update,reset,dispose(){reset();group.removeFromParent();g.dispose();m.dispose();}};
}
