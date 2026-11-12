import {URCHIN_LANCE,lancePhase,lanceGround} from './urchin-rift.js';
// Only C uses these bounded pools. Q/E/X remain in the existing crown/wave renderer.
export function createUrchinLanceFX(THREE){
 const group=new THREE.Group();group.name='潮割り / prediction, water strike and ground rift';group.visible=false;
 const geometry=new THREE.BoxGeometry(1,1,1),spikeGeometry=new THREE.ConeGeometry(1,1,5).rotateX(Math.PI/2),material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:false,depthTest:true,depthWrite:true});
 const water=new THREE.InstancedMesh(geometry,material,8192),spikes=new THREE.InstancedMesh(spikeGeometry,material,512);
 water.name='潮の裂け目 / water, foam and contact ripples';spikes.name='潮割り / pressure spines';
 for(const m of[water,spikes]){m.count=0;m.frustumCulled=false;m.raycast=()=>{};m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count*3).fill(1),3);group.add(m);}
 const pose=new THREE.Object3D(),v=new THREE.Vector3(),up=new THREE.Vector3(0,0,1),color=new THREE.Color(),cache=new Map();let disposed=false;
 function reset(){water.count=spikes.count=0;group.visible=false;cache.clear();}
 function update(events,now,{preview=null,pulses=[],groundHeight,reachable,terrainRevision=0,visible=()=>true,reducedMotion=false}={}){
  if(disposed)return;water.count=spikes.count=0;const live=events.filter(e=>e.type==='urchin-lance'&&lancePhase(e,now)!=='expired'),ids=new Set(live.map(e=>e.id));for(const id of cache.keys())if(!ids.has(id))cache.delete(id);
  const shown=p=>visible(p)!==false;
  function draw(a,b,width,height,hex,brightness=1,mesh=water){if(mesh.count>=mesh.instanceMatrix.count||!shown(a)||!shown(b)||!shown({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2}))return;
   v.set(b.x-a.x,b.y-a.y,b.z-a.z);const length=v.length();if(length<1e-7)return;pose.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);pose.quaternion.setFromUnitVectors(up,v.multiplyScalar(1/length));pose.scale.set(width,height,length);pose.updateMatrix();mesh.setMatrixAt(mesh.count,pose.matrix);color.setHex(hex).multiplyScalar(Math.max(0,brightness));mesh.setColorAt(mesh.count++,color);
  }
  function field(e,aiming=false){const phase=aiming?'aiming':lancePhase(e,now);if(phase==='idle'||phase==='expired')return;
   const warning=phase==='telegraph'||aiming,age=Math.max(0,now-e.triggerAt),progress=aiming?.7:Math.max(0,Math.min(1,(now-e.startedAt)/URCHIN_LANCE.telegraph)),fade=warning?1:Math.max(0,1-age/URCHIN_LANCE.residualDuration),dx=e.x-e.fromX,dz=e.z-e.fromZ,len=Math.hypot(dx,dz),nx=len?-dz/len:1,nz=len?dx/len:0;
   let segments=cache.get(e.id);if(aiming||!segments||segments.revision!==terrainRevision||segments.groundHeight!==groundHeight||segments.reachable!==reachable){
    const lines=[],count=Math.max(1,Math.ceil(len/URCHIN_LANCE.segmentLength));for(let i=0;i<count;i++){const t=i/count,u=(i+1)/count,a=lanceGround(e,e.fromX+dx*t,e.fromZ+dz*t,{groundHeight,reachable}),b=lanceGround(e,e.fromX+dx*u,e.fromZ+dz*u,{groundHeight,reachable});if(a&&b&&Math.abs(a.y-b.y)<=URCHIN_LANCE.groundTolerance)lines.push([a,b,i]);}
    segments={lines,revision:terrainRevision,groundHeight,reachable};if(!aiming)cache.set(e.id,segments);
   }
   for(const [a,b,index]of segments.lines){const wave=reducedMotion?0:Math.sin(now*9+index*.6)*.018,base=warning?.035:.04+wave;
    const aa={...a,y:a.y+base},bb={...b,y:b.y+base};
    if(warning){for(const side of[-1,1])draw({...aa,x:aa.x+nx*e.radius*side,z:aa.z+nz*e.radius*side},{...bb,x:bb.x+nx*e.radius*side,z:bb.z+nz*e.radius*side},.035,.02,0x64dfff,.35+.65*progress);draw(aa,bb,aiming?URCHIN_LANCE.width:.025,.012,0x1b5a75,.4+.6*progress);
     if(!aiming&&index%4===0){const gather=reducedMotion?0:1-((now-e.startedAt)*3%1);draw({...aa,x:aa.x+nx*gather*e.radius,z:aa.z+nz*gather*e.radius},{...bb,x:bb.x+nx*gather*e.radius,z:bb.z+nz*gather*e.radius},.035,.035,0xb5faff,progress);}
    }else{draw(aa,bb,URCHIN_LANCE.width,.018+.04*fade,0x247fb9,.2+.8*fade);draw({...aa,y:aa.y+.035},{...bb,y:bb.y+.035},phase==='strike'?.22:.04,.03,0xd8ffff,fade);
     if(index%3===0)for(const side of[-1,1]){const p={...aa,x:aa.x+nx*e.radius*side,y:aa.y+.055,z:aa.z+nz*e.radius*side};draw(p,{...p,x:p.x+.05,z:p.z+.05},.06,.06,0x9ceaff,fade);}
    }
   }
   // The fixed three-dimensional attack volume is also visible before and during its hit.
   if(warning||phase==='strike'){const a={x:e.fromX,y:e.fromY,z:e.fromZ},b={x:e.x,y:e.y,z:e.z};for(const side of[-1,1])draw({...a,x:a.x+nx*e.radius*side,z:a.z+nz*e.radius*side},{...b,x:b.x+nx*e.radius*side,z:b.z+nz*e.radius*side},.025,.025,0x5fdfff,warning?.3+.7*progress:1);
    if(phase==='strike'){draw(a,b,.23,.25,0xffffff);for(let i=1;i<=9;i++){const t=i/10,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};for(const side of[-1,1])draw(p,{x:p.x+nx*side*.7,y:p.y+.6,z:p.z+nz*side*.7},.13,.13,0x9bffff,1,spikes);}}
   }
  }
  for(const e of live)field(e);if(preview)field(preview,true);
  for(const p of pulses){if(!ids.has(p.eventId)||now<p.at||now>=p.endsAt||!shown(p))continue;const age=now-p.at,fade=1-age/URCHIN_LANCE.pulseDuration,radius=.1+age*2;
   for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6;draw({x:p.x+Math.cos(a)*radius,y:p.y+.07,z:p.z+Math.sin(a)*radius},{x:p.x+Math.cos(b)*radius,y:p.y+.07,z:p.z+Math.sin(b)*radius},.045,.035,0xc9ffff,fade);}
   for(let i=0;i<6;i++){const a=i*Math.PI/3,spread=reducedMotion?.15:age*1.4,h=reducedMotion?.2:Math.max(.05,.08+age*2.4-age*age*5);draw({x:p.x+Math.cos(a)*spread,y:p.y+.05,z:p.z+Math.sin(a)*spread},{x:p.x+Math.cos(a)*(spread+.03),y:p.y+h,z:p.z+Math.sin(a)*(spread+.03)},.045,.045,0xf0ffff,fade);}
  }
  for(const m of[water,spikes]){m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;}group.visible=water.count+spikes.count>0;
 }
 return{group,update,reset,dispose(){if(disposed)return;reset();disposed=true;geometry.dispose();spikeGeometry.dispose();material.dispose();group.removeFromParent();}};
}
