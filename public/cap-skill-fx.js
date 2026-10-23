export function createCapSkillFX(THREE){
 const group=new THREE.Group();group.name='キャップは？ / optics';
 const items=new Map(),g=new THREE.TorusGeometry(.20,.018,6,24),bar=new THREE.BoxGeometry(.28,.035,.035);
 const m=new THREE.MeshBasicMaterial({color:'#ef8152',transparent:true,opacity:.9,depthWrite:false});
 const blue=m.clone();blue.color.set('#79e7ee');const fracture=m.clone();fracture.color.set('#ff4b32');
 let disposed=false;
 function mesh(geometry,material){const o=new THREE.Mesh(geometry,material);o.raycast=()=>{};return o;}
 function create(e){
  const root=new THREE.Group();root.name=e.type;const locked=e.type==='cap-lock',material=e.type==='cap-clean'?blue:m;
  for(const side of[-1,1]){const lens=mesh(g,material);lens.position.x=side*(locked?.3:.24);if(locked)lens.scale.setScalar(1.5);root.add(lens);}
  if(locked){
   const halo=mesh(g,fracture);halo.scale.setScalar(3);halo.rotation.z=.4;root.add(halo);
   // Twelve fractures share one draw call and static matrices, never particles.
   const cracks=new THREE.InstancedMesh(bar,fracture,12);cracks.raycast=()=>{};
   for(let i=0;i<12;i++){const a=i*Math.PI/6,o=new THREE.Object3D();o.position.set(Math.cos(a)*.49,Math.sin(a)*.49,.015);o.rotation.z=a+.5;o.scale.set(.7,.85,1);o.updateMatrix();cracks.setMatrixAt(i,o.matrix);}
   cracks.instanceMatrix.needsUpdate=true;root.add(cracks);
  }else root.add(mesh(bar,material));
  group.add(root);items.set(e.id,root);return root;
 }
 function update(events,now,{actors=[],reducedMotion=false}={}){
  if(disposed)return;const seen=new Set();
  for(const e of events){if(!e.type.startsWith('cap-'))continue;const actor=actors.find(a=>a.id===(e.targetId||e.sourceId));if(!actor?.alive)continue;seen.add(e.id);const root=items.get(e.id)||create(e);
   root.position.set(actor.x,(actor.y||0)+2-(actor.crouch||0)*.55,actor.z);root.rotation.y=reducedMotion?0:now*.65;
   root.scale.setScalar(e.type==='cap-lock'&&!reducedMotion?1+.22*Math.max(0,1-(now-e.startedAt)/.3):1);
  }
  for(const[id,o]of items)if(!seen.has(id)){o.removeFromParent();items.delete(id);}
 }
 function reset(){for(const o of items.values())o.removeFromParent();items.clear();}
 return{group,update,reset,dispose(){if(disposed)return;disposed=true;reset();group.removeFromParent();g.dispose();bar.dispose();m.dispose();blue.dispose();fracture.dispose();}};
}
