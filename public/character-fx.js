import { TEAM_ABILITIES } from './team-abilities.js';

// Ground-only ability cues. All poses derive from event timestamps, so joining
// midway or replaying an authoritative event never restarts its animation.
export function createCharacterFX(THREE) {
  const MAX_EVENTS=20,group=new THREE.Group();group.name='Character abilities / ground cues';group.visible=false;
  const transform=new THREE.Object3D(),batches=[],geometries=new Set(),materials=new Set();
  let disposed=false;
  function batch(name,geometry,capacity,color,opacity){
    const alpha=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);alpha.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('fxOpacity',alpha);geometries.add(geometry);
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,depthTest:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    material.name=`Character cue / ${name}`;material.forceSinglePass=true;
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float fxOpacity;\nvarying float vFxOpacity;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFxOpacity=fxOpacity;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vFxOpacity;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vFxOpacity;');
    };
    material.customProgramCacheKey=()=> 'character-ground-opacity-v1';materials.add(material);
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name=`Character cue / ${name}`;mesh.count=0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
    mesh.userData.solid=false;mesh.raycast=()=>{};mesh.renderOrder=2;group.add(mesh);
    const result={mesh,alpha,capacity};batches.push(result);return result;
  }
  const mend=batch('MEND recovery rings',new THREE.RingGeometry(.994,1,64),MAX_EVENTS*2,'#62cbb8',.62);
  const recon=batch('ECHO scan rings',new THREE.RingGeometry(.995,1,64),MAX_EVENTS,'#a79dcc',.56);
  const motes=batch('MEND recovery flecks',new THREE.PlaneGeometry(1,1),MAX_EVENTS*8,'#b0edda',.62);
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function write(target,x,y,z,sx,sz,opacity,angle=0){
    const index=target.mesh.count;if(index>=target.capacity)return;
    transform.position.set(x,y,z);transform.rotation.set(-Math.PI/2,0,angle);transform.scale.set(sx,sz,1);transform.updateMatrix();
    target.mesh.setMatrixAt(index,transform.matrix);target.alpha.array[index]=clamp(opacity,0,1);target.mesh.count++;
  }
  function seed(id){let hash=2166136261;for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);return (hash>>>0)/4294967296;}
  function reset(){
    for(const item of batches){item.mesh.count=0;item.mesh.visible=false;}
    group.visible=false;group.userData.activeEvents=0;
  }
  function update(events,now,{reducedMotion=false}={}){
    if(disposed)return;
    reset();if(!Number.isFinite(now)||!Array.isArray(events))return;
    const unique=new Map();
    for(const event of events){
      if(!event||!['mend','recon'].includes(event.type)||!(typeof event.id==='string'&&event.id.length>0||Number.isFinite(event.id)))continue;
      if(![event.x,event.y,event.z,event.startedAt,event.endsAt,event.radius].every(Number.isFinite)||event.radius<=0||event.endsAt<=event.startedAt)continue;
      const duration=Math.min(event.type==='mend'?1.5:6,event.endsAt-event.startedAt),age=now-event.startedAt;
      if(age<0||age>=duration)continue;
      const key=`${typeof event.id}:${event.id}`,signature=JSON.stringify([event.startedAt,event.endsAt,event.type,event.x,event.y,event.z,event.radius]);
      const previous=unique.get(key);
      if(!previous||event.startedAt>previous.event.startedAt||event.startedAt===previous.event.startedAt&&signature>previous.signature)unique.set(key,{event,age,duration,signature,key});
    }
    const active=[...unique.values()].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0).slice(0,MAX_EVENTS);
    for(const {event,age,duration,key} of active){
      const y=event.y+.035;
      if(event.type==='mend'){
        const progress=age/duration,fade=Math.pow(1-progress,.7),radius=Math.min(18,event.radius),ease=1-Math.pow(1-progress,2);
        const startRadius=Math.min(.35,radius),outer=reducedMotion?Math.min(radius,2.6):startRadius+(radius-startRadius)*ease;
        write(mend,event.x,y,event.z,outer,outer,fade*(.55+.45*Math.min(1,age/.1)));
        const inner=Math.min(radius,1.4)*(reducedMotion?1:.84+.16*progress);
        write(mend,event.x,y+.006,event.z,inner,inner,fade*.48);
        if(!reducedMotion){
          const offset=seed(key)*Math.PI*2;
          for(let i=0;i<8;i++){
            const angle=offset+i*Math.PI/4+progress*.24,dist=Math.min(radius*.9,Math.min(radius,1.8)*(.45+.5*progress)+(i%2)*.17);
            write(motes,event.x+Math.cos(angle)*dist,y+.008,event.z+Math.sin(angle)*dist,.035,.11,fade*(i%2?.52:.75),angle+.5);
          }
        }
      }else{
        const pulse=Math.min(2,Math.floor(age/2)),pulseAge=age-pulse*2,progress=clamp(pulseAge/2,0,1),radius=Math.min(TEAM_ABILITIES.reconRadius,event.radius);
        const startRadius=Math.min(.35,radius),distance=reducedMotion?radius:startRadius+(radius-startRadius)*progress;
        const fade=Math.pow(1-progress,.65)*(.35+.65*Math.min(1,pulseAge/.16));
        write(recon,event.x,y,event.z,distance,distance,fade);
      }
    }
    for(const item of batches){item.mesh.visible=item.mesh.count>0;item.mesh.instanceMatrix.needsUpdate=true;item.alpha.needsUpdate=true;}
    group.userData.activeEvents=active.length;group.visible=active.length>0;
  }
  function dispose(){
    if(disposed)return;disposed=true;reset();group.removeFromParent();
    for(const item of batches)item.mesh.dispose();
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
  }
  reset();return {group,update,reset,dispose};
}
