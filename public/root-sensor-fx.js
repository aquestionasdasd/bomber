import { ROOT_SENSOR, sensorLive } from './root-sensor.js';

// Ground meshes use normal depth testing. No actor outline, HUD pin or x-ray pass.
export function createRootSensorFX(THREE){
  const group=new THREE.Group();group.name='Root sensor / visible ground branches';group.visible=false;
  const geometry=new THREE.CylinderGeometry(.6,1,1,6),material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,transparent:false,opacity:1,depthTest:true,depthWrite:true});
  const mesh=new THREE.InstancedMesh(geometry,material,2048);mesh.name='Root sensor / bounded opaque roots';mesh.count=0;mesh.frustumCulled=false;mesh.raycast=()=>{};
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(2048*3).fill(1),3);group.add(mesh);
  const transform=new THREE.Object3D(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),color=new THREE.Color(),cache=new Map();
  let disposed=false;
  function reset(){mesh.count=0;group.visible=false;cache.clear();}
  function update(events,tracks,now,{groundHeight,reachable,visible,terrainRevision,reducedMotion=false}={}){
    if(disposed)return;mesh.count=0;group.visible=false;
    const fields=new Map((events||[]).filter(e=>e.type==='veil-sensor'&&now>=e.triggerAt&&now<e.endsAt).slice(0,20).map(e=>[e.id,e]));
    for(const id of cache.keys())if(!fields.has(id))cache.delete(id);
    const ground=(x,z,reference)=>{try{const y=groundHeight?.(x,z,reference);return Number.isFinite(y)&&Math.abs(y-reference)<=ROOT_SENSOR.floorTolerance?y:null;}catch{return null;}};
    const allowed=(e,p)=>{try{return reachable?.({...e,y:e.y-.12},p)===true;}catch{return false;}};
    const seen=p=>{try{return visible?.({...p,y:p.y+.09})===true;}catch{return false;}};
    function draw(a,b,width,hex){
      if(mesh.count>=2048||!seen(a)||!seen(b)||!seen({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2}))return;
      direction.set(b.x-a.x,b.y-a.y,b.z-a.z);const length=direction.length();if(length<1e-7)return;
      transform.position.set((a.x+b.x)/2,(a.y+b.y)/2+.075,(a.z+b.z)/2);transform.quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/length));transform.scale.set(width,length,width);transform.updateMatrix();
      mesh.setMatrixAt(mesh.count,transform.matrix);color.setHex(hex);mesh.setColorAt(mesh.count++,color);
    }
    function surface(e,ax,az,bx,bz){
      const ref=e.y-.12,ay=ground(ax,az,ref),by=ground(bx,bz,ref),mid={x:(ax+bx)/2,y:ref,z:(az+bz)/2};
      if(ay===null||by===null||!allowed(e,{x:ax,y:ay,z:az})||!allowed(e,{x:bx,y:by,z:bz})||!allowed(e,mid))return null;
      return [{x:ax,y:ay,z:az},{x:bx,y:by,z:bz}];
    }
    for(const e of fields.values()){
      if(!sensorLive(e,now))continue;
      let item=cache.get(e.id);
      if(!item||item.revision!==terrainRevision||item.groundHeight!==groundHeight||item.reachable!==reachable){
        const lines=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2,segment=surface(e,e.x+Math.cos(a)*5,e.z+Math.sin(a)*5,e.x+Math.cos(b)*5,e.z+Math.sin(b)*5);if(segment)lines.push(segment);}
        item={lines,revision:terrainRevision,groundHeight,reachable};cache.set(e.id,item);
      }
      for(const [a,b]of item.lines)draw(a,b,.035,0x678b3b);
    }
    for(const r of (tracks||[]).slice(0,ROOT_SENSOR.maxContacts)){
      const e=fields.get(r.eventId);if(!e||now>=r.endsAt)continue;
      const grow=reducedMotion?1:Math.max(0,Math.min(1,(now-r.enteredAt)/.2)),length=Math.hypot(r.x-e.x,r.z-e.z),steps=Math.max(1,Math.ceil(length/.32)),dx=r.x-e.x,dz=r.z-e.z;
      const tx=length>1e-6?-dz/length:1,tz=length>1e-6?dx/length:0,hex=r.active?0x9ac85c:0x85724b;
      let previous={x:e.x,z:e.z};
      for(let i=1;i<=steps;i++){
        const t=i/steps*grow,bend=Math.sin(t*Math.PI*5)*Math.sin(t*Math.PI)*.14;
        const next={x:e.x+dx*t+tx*bend,z:e.z+dz*t+tz*bend},segment=surface(e,previous.x,previous.z,next.x,next.z);if(segment)draw(...segment,.07,hex);
        if(i%3===0){const fork=surface(e,next.x,next.z,next.x+tx*.25,next.z+tz*.25);if(fork)draw(...fork,.04,hex);}previous=next;
      }
      // Small fixed fork marks the last sampled place after leaving the field.
      if(grow===1)for(const sign of[-1,1]){const fork=surface(e,r.x-tx*.22,r.z-tz*.22,r.x+tx*.22+dx*.035*sign,r.z+tz*.22+dz*.035*sign);if(fork)draw(...fork,.055,hex);}
    }
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;group.visible=mesh.count>0;
  }
  return {group,update,reset,dispose(){if(disposed)return;disposed=true;reset();geometry.dispose();material.dispose();group.removeFromParent();}};
}
