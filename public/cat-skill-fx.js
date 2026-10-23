export function createCatSkillFX(THREE){
 const group=new THREE.Group();group.name='猫の画像 / skills';const visuals=new Map(),gs=new Set(),ms=new Set();
 const geo=g=>(gs.add(g),g),mat=m=>(ms.add(m),m);
 const white=mat(new THREE.MeshBasicMaterial({color:'#fff5df',transparent:true,opacity:.85,depthWrite:false})),blue=mat(new THREE.MeshBasicMaterial({color:'#8dc9ff',transparent:true,opacity:.8,depthWrite:false}));
 const ring=geo(new THREE.TorusGeometry(.5,.025,6,32)),page=geo(new THREE.BoxGeometry(.24,.4,.03)),line=geo(new THREE.CylinderGeometry(.012,.012,1,6));
 function mesh(g,m){const o=new THREE.Mesh(g,m);o.raycast=()=>{};return o;}
 const pointer=mesh(ring,blue);group.add(pointer);pointer.visible=false;
 function update(events,now,{actors=[],preview=null}={}){
  const ids=new Set();for(const e of events){if(!e.type.startsWith('cat-'))continue;ids.add(e.id);let root=visuals.get(e.id);if(!root){root=new THREE.Group();root.name=e.type;group.add(root);visuals.set(e.id,root);const r=mesh(ring,e.type==='cat-clock'?blue:white);r.rotation.x=Math.PI/2;root.add(r);if(e.type==='cat-bookmark'){const p=mesh(page,white);p.position.y=.32;root.add(p);}if(e.type==='cat-clock')for(const x of[-.14,.14]){const bar=mesh(page,white);bar.position.set(x,1,0);bar.scale.set(.25,1.2,1);root.add(bar);}if(['cat-pluck','cat-fetch','cat-return'].includes(e.type)){const beam=mesh(line,blue);const from=new THREE.Vector3(e.fromX,e.fromY+.9,e.fromZ),to=new THREE.Vector3(e.x,e.y+.2,e.z);beam.position.copy(from.clone().add(to).multiplyScalar(.5));beam.scale.y=from.distanceTo(to);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());root.add(beam);beam.userData.world=true;}if(e.type==='cat-pluck')for(let i=0;i<6;i++){const shard=mesh(page,i%2?blue:white);shard.name='Cat / split whisker';shard.userData.burstAngle=i*Math.PI/3;shard.rotation.z=-shard.userData.burstAngle;root.add(shard);}}
   if(!['cat-pluck','cat-fetch','cat-return'].includes(e.type)){const actor=e.type==='cat-clock'?actors.find(a=>a.id===e.sourceId):null;root.position.set(actor?.x??e.x,(actor?.y??e.y)+.04,actor?.z??e.z);root.rotation.y=now*.6;}
   else{root.children[0].position.set(e.x,e.y+.1,e.z);if(e.type==='cat-pluck'){const phase=Math.max(0,Math.min(1,(now-e.startedAt)/.6));for(const shard of root.children)if(Number.isFinite(shard.userData.burstAngle)){const a=shard.userData.burstAngle,r=.15+phase*.9;shard.position.set(e.x+Math.cos(a)*r,e.y+.1+Math.sin(a)*r,e.z);shard.scale.set(.4*(1-phase),1.4*(1-phase),1);}}}
  }for(const[id,root]of visuals)if(!ids.has(id)){root.removeFromParent();visuals.delete(id);}
  pointer.visible=!!preview&&Number.isFinite(preview.x);if(pointer.visible){pointer.position.set(preview.x,preview.y+.15,preview.z);pointer.rotation.x=preview.type==='e'?-Math.PI/2:0;}
 }
 function reset(){for(const v of visuals.values())v.removeFromParent();visuals.clear();pointer.visible=false;}
 return{group,update,reset,dispose(){reset();group.removeFromParent();for(const g of gs)g.dispose();for(const m of ms)m.dispose();}};
}
