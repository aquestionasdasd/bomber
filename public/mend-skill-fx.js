import { skillProjectilePosition } from './character-skills.js';
import { MEND_SKILLS } from './abilities.js';

const MAX_EVENTS=20,caches=new WeakMap();
const specs=Object.freeze({
  'mend-seeds':{flight:MEND_SKILLS.seedsFlight,tail:MEND_SKILLS.seedsDuration,radius:MEND_SKILLS.seedsRadius},
  'mend-pollen':{flight:MEND_SKILLS.pollenFlight,tail:MEND_SKILLS.pollenDuration,radius:MEND_SKILLS.pollenRadius},
  'mend-heal':{flight:0,tail:MEND_SKILLS.healVisualDuration,radius:MEND_SKILLS.healRange},
});
const coordinate=value=>Number.isFinite(value)&&Math.abs(value)<=1000;
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=64&&!/[\u0000-\u001f\u007f]/.test(value);
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
function validEvent(event,now){
  if(!event||typeof event!=='object'||Array.isArray(event)||!['type','id','team','sourceId','round','x','y','z','fromX','fromY','fromZ','startedAt','triggerAt','endsAt','flight','radius'].every(key=>Object.hasOwn(event,key))
    ||typeof event.type!=='string'||!Object.hasOwn(specs,event.type)||!identifier(event.id)
    ||!new RegExp(`^skill-${event.type}-[1-9][0-9]{0,14}$`).test(event.id)
    ||!['blue','red'].includes(event.team)||!identifier(event.sourceId)||!Number.isSafeInteger(event.round)||event.round<1
    ||![event.x,event.y,event.z,event.fromX,event.fromY,event.fromZ].every(coordinate)
    ||![event.startedAt,event.triggerAt,event.endsAt].every(value=>Number.isFinite(value)&&value>=0))return false;
  const spec=specs[event.type];
  return event.flight===spec.flight&&event.radius===spec.radius
    &&Math.abs(event.triggerAt-event.startedAt-spec.flight)<1e-7&&Math.abs(event.endsAt-event.triggerAt-spec.tail)<1e-7
    &&(event.type!=='mend-heal'||Object.hasOwn(event,'targetId')&&identifier(event.targetId))&&now>=event.startedAt&&now<event.endsAt;
}
function seed(id){let value=2166136261;for(let i=0;i<id.length;i++)value=Math.imul(value^id.charCodeAt(i),16777619);return (value>>>0)/4294967296;}

function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    const geometries=new Set(),materials=new Set(),transform=new THREE.Object3D();
    const flowerMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.84,metalness:0});flowerMaterial.name='MEND botanical finish / seed, petal and leaves';
    const cloudMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,opacity:1,transparent:false,depthWrite:true});cloudMaterial.name='MEND botanical finish / opaque warm pollen';
    const fadeMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',vertexColors:true,transparent:true,opacity:1,depthWrite:false,depthTest:true,side:THREE.DoubleSide});fadeMaterial.name='MEND botanical finish / gentle translucent cues';fadeMaterial.forceSinglePass=true;
    fadeMaterial.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float mendOpacity;\nvarying float vMendOpacity;').replace('#include <begin_vertex>','#include <begin_vertex>\nvMendOpacity=mendOpacity;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vMendOpacity;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vMendOpacity;');
    };
    fadeMaterial.customProgramCacheKey=()=> 'mend-ordinary-opacity-v1';
    for(const material of [flowerMaterial,cloudMaterial,fadeMaterial])materials.add(material);
    function merged(build){
      const p=[],n=[],c=[];
      const add=(geometry,position,scale,rotation,color)=>{
        transform.position.set(...position);transform.scale.set(...scale);transform.rotation.set(...rotation);transform.updateMatrix();
        const copy=geometry.index?geometry.toNonIndexed():geometry.clone();geometry.dispose();copy.applyMatrix4(transform.matrix);
        const a=copy.attributes.position,b=copy.attributes.normal,rgb=new THREE.Color(color);
        for(let i=0;i<a.count;i++){p.push(a.getX(i),a.getY(i),a.getZ(i));n.push(b.getX(i),b.getY(i),b.getZ(i));c.push(rgb.r,rgb.g,rgb.b);}copy.dispose();
      };
      build(add);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.add(geometry);return geometry;
    }
    const seedGeometry=merged(add=>{
      for(let i=0;i<5;i++){
        const a=i*2.39996,r=i? .044:0,p=[Math.sin(a)*r,.006+(i%2)*.012,Math.cos(a)*r];
        add(new THREE.SphereGeometry(1,12,8),p,[.020,.041,.013],[.3*Math.sin(a),a,.30*Math.cos(a)],i%2?'#59462d':'#403c29');
        add(new THREE.SphereGeometry(1,8,6),[p[0]+.003,p[1]+.006,p[2]+.012],[.003,.026,.002],[.3*Math.sin(a),a,.30*Math.cos(a)],'#d1be8d');
      }
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(new THREE.SphereGeometry(1,10,6),[Math.sin(a)*.065,-.006,Math.cos(a)*.065],[.016,.008,.035],[0,a,.12],'#edc95c');}
    });
    const bloomGeometry=merged(add=>{
      add(new THREE.CylinderGeometry(.014,.018,.15,7),[0,.075,0],[1,1,1],[0,0,0],'#668852');
      for(const side of [-1,1])add(new THREE.SphereGeometry(1,10,6),[side*.034,.063,.004],[.044,.009,.018],[0,side*.35,side*.45],'#8da46a');
      for(let i=0;i<10;i++){const a=i*Math.PI/5;add(new THREE.SphereGeometry(1,12,7),[Math.sin(a)*.057,.157+Math.cos(a*2)*.004,Math.cos(a)*.057],[.023,.009,.043],[0,a,0],i%2?'#e7c35e':'#f0d780');}
      add(new THREE.SphereGeometry(1,16,8),[0,.166,0],[.032,.014,.032],[0,0,0],'#70563a');
      for(let i=0;i<8;i++){const a=i*Math.PI/4;add(new THREE.SphereGeometry(1,6,4),[Math.sin(a)*.020,.179,Math.cos(a)*.020],[.003,.002,.003],[0,0,0],'#c1a465');}
    });
    const cloudGeometry=new THREE.SphereGeometry(1,36,24),color=[];
    const base=new THREE.Color('#c4c280'),warm=new THREE.Color('#9aa970'),p=cloudGeometry.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=clamp(.43+.19*Math.sin(x*9+y*5)+.13*Math.sin(z*13-x*4)+.08*y),rgb=base.clone().lerp(warm,t);color.push(rgb.r,rgb.g,rgb.b);}
    cloudGeometry.setAttribute('color',new THREE.Float32BufferAttribute(color,3));geometries.add(cloudGeometry);
    cache={references:0,geometries,materials,seedGeometry,bloomGeometry,cloudGeometry,flowerMaterial,cloudMaterial,fadeMaterial};caches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return {cache,release(){if(released)return;released=true;if(--cache.references===0){for(const geometry of cache.geometries)geometry.dispose();for(const material of cache.materials)material.dispose();caches.delete(THREE);}}};
}

// Pure presentation: fixed pools, absolute event times and shared immutable
// botanical meshes. Each owner keeps only its own opacity/instance buffers.
export function createMendSkillFX(THREE,camera){
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group();group.name='MEND / seeds, pollen and first aid';group.visible=false;
  const transform=new THREE.Object3D(),color=new THREE.Color(),batches=[],privateGeometries=new Set(),unique=new Map();
  let disposed=false,throwStarted=-Infinity,throwType=null;
  function fadedGeometry(geometry,capacity){
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));
    const opacity=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);opacity.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('mendOpacity',opacity);privateGeometries.add(geometry);return geometry;
  }
  function batch(name,geometry,material,capacity){
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name=`MEND skill / ${name}`;mesh.count=0;mesh.visible=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3);mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.solid=false;mesh.raycast=()=>{};group.add(mesh);
    const pool={mesh,capacity,opacity:geometry.getAttribute('mendOpacity')};batches.push(pool);return pool;
  }
  const projectiles=batch('sculpted striped seed clusters',cache.seedGeometry,cache.flowerMaterial,MAX_EVENTS);
  const blooms=batch('small sunflower ground growth',cache.bloomGeometry,cache.flowerMaterial,MAX_EVENTS*12);
  const cloud=batch('opaque warm pollen spheres',cache.cloudGeometry,cache.cloudMaterial,MAX_EVENTS);
  const rings=batch('seed borders and healing halos',fadedGeometry(new THREE.RingGeometry(.972,1,64),MAX_EVENTS*3),cache.fadeMaterial,MAX_EVENTS*3);
  const petal=new THREE.Shape();petal.moveTo(0,-.5);petal.bezierCurveTo(-.45,-.14,-.48,.28,0,.5);petal.bezierCurveTo(.48,.28,.45,-.14,0,-.5);
  const particleGeometry=new THREE.ShapeGeometry(petal,7);const pp=particleGeometry.attributes.position;for(let i=0;i<pp.count;i++)pp.setZ(i,.13*(1-pp.getY(i)*pp.getY(i)*4));particleGeometry.computeVertexNormals();
  const particles=batch('subtle petal and pollen motes',fadedGeometry(particleGeometry,MAX_EVENTS*24),cache.fadeMaterial,MAX_EVENTS*24);
  const handGroup=new THREE.Group();handGroup.name='MEND / botanical hand cue';camera.add(handGroup);handGroup.visible=false;
  const hand=new THREE.Mesh(cache.seedGeometry,cache.flowerMaterial);hand.name='MEND hand / sculpted seed and petal cluster';hand.raycast=()=>{};hand.userData.solid=false;handGroup.add(hand);
  const write=(pool,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,hex=0xffffff,opacity=1)=>{
    const index=pool.mesh.count;if(index>=pool.capacity)return;
    transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();pool.mesh.setMatrixAt(index,transform.matrix);
    color.setHex(hex);pool.mesh.setColorAt(index,color);if(pool.opacity)pool.opacity.array[index]=clamp(opacity);pool.mesh.count++;
  };
  const clear=()=>{for(const pool of batches){pool.mesh.count=0;pool.mesh.visible=false;}group.visible=false;group.userData.activeEvents=0;};
  function playThrow(type,now){
    if(disposed||!['mend-seeds','mend-pollen','mend-heal'].includes(type)||!Number.isFinite(now)||now<0)return;
    hand.geometry=type==='mend-seeds'?cache.seedGeometry:cache.bloomGeometry;
    hand.position.y=type==='mend-seeds'?0:-.14;
    throwStarted=now;throwType=type;
  }
  function cue(key,now){const type={c:'mend-seeds',q:'mend-pollen',e:'mend-heal'}[typeof key==='string'?key.toLowerCase().replace(/^key/,''):''];if(type)playThrow(type,now);}
  const throwing=now=>!disposed&&Number.isFinite(now)&&now>=throwStarted&&now<throwStarted+.32;
  function reset(){clear();unique.clear();handGroup.visible=false;throwStarted=-Infinity;throwType=null;}
  function update(events,now,{viewer=null,showHand=false,reducedMotion=false}={}){
    if(disposed)return;clear();unique.clear();
    if(Number.isFinite(now)&&now>=0&&Array.isArray(events))for(let i=0;i<Math.min(events.length,80);i++){
      const event=events[i];if(!validEvent(event,now)||unique.has(event.id))continue;unique.set(event.id,event);if(unique.size===MAX_EVENTS)break;
    }
    for(const event of unique.values()){
      const age=now-event.startedAt,after=now-event.triggerAt,phase=seed(event.id)*Math.PI*2;
      if(event.type!=='mend-heal'&&after<0){
        const point=skillProjectilePosition(event,now);if(!point||![point.x,point.y,point.z].every(coordinate))continue;
        write(projectiles,point.x,point.y,point.z,1.5,1.5,1.5,reducedMotion?0:age*5,phase,reducedMotion?0:age*2);continue;
      }
      if(event.type==='mend-seeds'){
        const y=event.y-MEND_SKILLS.seedsGroundOffset+.095,fade=clamp((event.endsAt-now)/.45),growth=reducedMotion?1:clamp(after/.38);
        write(rings,event.x,y,event.z,event.radius,event.radius,1,-Math.PI/2,0,phase,0xc6be67,.36*fade);
        for(let i=0;i<12;i++){
          const angle=phase+i*Math.PI*2/12,radius=event.radius*(i%3===0?.40:.81+.055*Math.sin(i*7)),s=(.72+.18*Math.sin(i*5+phase))*growth*fade;
          write(blooms,event.x+Math.cos(angle)*radius,y,event.z+Math.sin(angle)*radius,s,s,s,0,angle,0);
        }
      }else if(event.type==='mend-pollen'){
        // This fixed radius/centre is also used by authoritative sight checks.
        write(cloud,event.x,event.y,event.z,event.radius,event.radius,event.radius,0,0,0);
        const fade=clamp(after/.15)*clamp((event.endsAt-now)/.35);
        for(let i=0;i<24;i++){
          const a=phase+i*2.39996+(reducedMotion?0:after*.065),height=-.88+1.76*(i+.5)/24,r=Math.sqrt(Math.max(0,1-height*height))*event.radius*(i%3===0?1.025:.985),size=.045+(i%4)*.009;
          write(particles,event.x+Math.cos(a)*r,event.y+height*event.radius,event.z+Math.sin(a)*r,size,size*1.4,size,reducedMotion?0:after*.2,a,i*.31,i%2?0xe9d58d:0xc0d392,.34*fade);
        }
      }else{
        const progress=clamp(age/MEND_SKILLS.healVisualDuration),fade=Math.sin(progress*Math.PI),spread=reducedMotion?.78:.5+progress*.55;
        write(rings,event.x,event.y+.095,event.z,spread,spread,1,-Math.PI/2,0,0,0x8bdab0,.65*fade);
        write(rings,event.x,event.y+.105,event.z,spread*.72,spread*.72,1,-Math.PI/2,0,0,0xc7e6a0,.38*fade);
        // A slender green halo and a few botanical flecks rise behind the ally,
        // without a fullscreen flash or any camera displacement.
        const haloY=event.y+(reducedMotion?.85:.48+progress*.56);
        write(rings,event.x,haloY,event.z,.43,.43,1,0,phase,0,0x9dd9a6,.22*fade);
        for(let i=0;i<8;i++){
          const a=phase+i*Math.PI/4+(reducedMotion?0:progress*.25),r=.45+(i%2)*.13,h=event.y+.15+(reducedMotion?.25:progress*.82)+(i%3)*.07;
          write(particles,event.x+Math.cos(a)*r,h,event.z+Math.sin(a)*r,.045,.075,.045,0,a,.35,0xb7e2a5,.45*fade);
        }
      }
    }
    for(const pool of batches){pool.mesh.visible=pool.mesh.count>0;pool.mesh.instanceMatrix.needsUpdate=true;pool.mesh.instanceColor.needsUpdate=true;if(pool.opacity)pool.opacity.needsUpdate=true;}
    group.visible=unique.size>0;group.userData.activeEvents=unique.size;
    const age=now-throwStarted;handGroup.visible=!!(Number.isFinite(now)&&showHand&&throwType&&age>=0&&age<.24);
    if(handGroup.visible){const t=clamp(age/.24);handGroup.position.set(.23+t*.08,-.30+(reducedMotion?0:Math.sin(t*Math.PI)*.08),-.5-t*.18);handGroup.rotation.set(reducedMotion?0:-.2-t*.65,.2,-.16);hand.scale.setScalar(throwType==='mend-pollen'?1.8:1.5);}
  }
  function dispose(){if(disposed)return;disposed=true;reset();handGroup.removeFromParent();group.removeFromParent();for(const pool of batches)pool.mesh.dispose();for(const geometry of privateGeometries)geometry.dispose();release();}
  reset();return {group,update,cue,playThrow,throwing,reset,dispose};
}
