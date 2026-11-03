import { isLobbedSkill, validThrowFlight, throwDelay } from './skill-throw.js';
import { skillProjectilePosition } from './character-skills.js';
import { EMBER_SKILLS } from './abilities.js';

const MAX_EVENTS=20,caches=new WeakMap(),weapons=['classic','ghost','spectre','vandal','phantom'];
const specs=Object.freeze({
  'ember-solder':{flight:EMBER_SKILLS.solderFlight,delay:EMBER_SKILLS.solderFlight+EMBER_SKILLS.solderArmDelay,tail:EMBER_SKILLS.solderTail,radius:EMBER_SKILLS.solderRadius},
  'ember-shade':{flight:0,delay:0,tail:EMBER_SKILLS.shadeDuration,radius:0},
  'ember-service':{flight:0,delay:0,tail:EMBER_SKILLS.serviceDuration,radius:0},
});
const fields=['id','type','team','sourceId','round','x','y','z','fromX','fromY','fromZ','startedAt','triggerAt','endsAt','flight','radius'];
const clamp=value=>Math.max(0,Math.min(1,value));
const coordinate=value=>Number.isFinite(value)&&Math.abs(value)<=1000;
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=64&&!/[\u0000-\u001f\u007f]/.test(value);
function validEvent(event,now){
  if(!event||typeof event!=='object'||Array.isArray(event)||!fields.every(key=>Object.hasOwn(event,key))
    ||typeof event.type!=='string'||!Object.hasOwn(specs,event.type)||!identifier(event.id)
    ||!new RegExp(`^skill-${event.type}-[1-9][0-9]{0,14}$`).test(event.id)||!identifier(event.sourceId)
    ||!['blue','red'].includes(event.team)||!Number.isSafeInteger(event.round)||event.round<1
    ||![event.x,event.y,event.z,event.fromX,event.fromY,event.fromZ].every(coordinate)
    ||![event.startedAt,event.triggerAt,event.endsAt].every(value=>Number.isFinite(value)&&value>=0)
    ||!Object.keys(event).every(key=>fields.includes(key)||event.type==='ember-service'&&key==='weaponId'))return false;
  const spec=specs[event.type],personal=event.type!=='ember-solder';
  return (isLobbedSkill(event.type)?validThrowFlight(event):event.flight===spec.flight)&&event.radius===spec.radius
    &&Math.abs(event.triggerAt-event.startedAt-(isLobbedSkill(event.type)?throwDelay(event,spec.flight,spec.delay):spec.delay))<1e-7&&Math.abs(event.endsAt-event.triggerAt-spec.tail)<1e-7
    &&(personal?Math.hypot(event.x-event.fromX,event.y-event.fromY,event.z-event.fromZ)<1e-7:Math.hypot(event.x-event.fromX,event.z-event.fromZ)<=EMBER_SKILLS.solderRange+1e-7)
    &&(event.type==='ember-service'?weapons.includes(event.weaponId):event.weaponId===undefined)
    &&now>=event.startedAt&&now<event.endsAt;
}
function phase(id){let value=2166136261;for(let i=0;i<id.length;i++)value=Math.imul(value^id.charCodeAt(i),16777619);return(value>>>0)/4294967296*Math.PI*2;}
function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    const dropGeometry=new THREE.LatheGeometry([new THREE.Vector2(0,-.07),new THREE.Vector2(.045,-.06),new THREE.Vector2(.066,-.025),new THREE.Vector2(.061,.025),new THREE.Vector2(.036,.065),new THREE.Vector2(.015,.105),new THREE.Vector2(0,.14)],12);
    const chipGeometry=new THREE.IcosahedronGeometry(1,0);
    const metal=new THREE.MeshStandardMaterial({color:'#cbd5d7',roughness:.26,metalness:.78});metal.name='EMBER skill / polished solder bead';
    const copper=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.4,metalness:.55});copper.name='EMBER skill / small cooling copper fragments';
    const glow=new THREE.MeshBasicMaterial({color:'#ffffff',vertexColors:true,transparent:true,opacity:1,depthWrite:false,depthTest:true,side:THREE.DoubleSide});glow.name='EMBER skill / subdued reflection and service lines';glow.forceSinglePass=true;
    glow.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float emberOpacity;\nvarying float vEmberOpacity;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEmberOpacity=emberOpacity;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vEmberOpacity;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vEmberOpacity;');
    };
    glow.customProgramCacheKey=()=> 'ember-ordinary-opacity-v1';
    cache={references:0,dropGeometry,chipGeometry,metal,copper,glow};caches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return{cache,release(){if(released)return;released=true;if(--cache.references===0){for(const key of ['dropGeometry','chipGeometry','metal','copper','glow'])cache[key].dispose();caches.delete(THREE);}}};
}

// Visuals only: no model/weapon transforms, ammunition, flash mitigation or
// damage are changed here. Personal effects follow the current actor snapshot.
export function createEmberSkillFX(THREE,camera){
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group();group.name='EMBER / solder, shade and service';group.visible=false;
  const transform=new THREE.Object3D(),color=new THREE.Color(),unique=new Map(),endedPersonal=new Map(),batches=[],privateGeometries=[];
  let disposed=false,throwStarted=-Infinity;
  function lineGeometry(capacity){const geometry=new THREE.PlaneGeometry(1,1),opacity=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);opacity.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('emberOpacity',opacity);privateGeometries.push(geometry);return geometry;}
  function batch(parent,name,geometry,material,capacity){
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name=`EMBER skill / ${name}`;mesh.count=0;mesh.visible=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3);mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.solid=false;mesh.raycast=()=>{};parent.add(mesh);
    const pool={mesh,capacity,opacity:geometry.getAttribute('emberOpacity')};batches.push(pool);return pool;
  }
  const drops=batch(group,'metal droplets',cache.dropGeometry,cache.metal,MAX_EVENTS);
  const lines=batch(group,'warning rings and equipment glints',lineGeometry(MAX_EVENTS*32),cache.glow,MAX_EVENTS*32);
  const chips=batch(group,'brief copper fragments',cache.chipGeometry,cache.copper,MAX_EVENTS*12);
  const handGroup=new THREE.Group();handGroup.name='EMBER / discreet first person cues';handGroup.visible=false;camera.add(handGroup);
  const handDrop=batch(handGroup,'hand solder bead',cache.dropGeometry,cache.metal,1);
  const handLines=batch(handGroup,'first person shade and service',lineGeometry(8),cache.glow,8);
  function write(pool,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,hex=0xffffff,alpha=1){
    const index=pool.mesh.count;if(index>=pool.capacity)return;
    transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();pool.mesh.setMatrixAt(index,transform.matrix);
    color.setHex(hex);pool.mesh.setColorAt(index,color);if(pool.opacity)pool.opacity.array[index]=clamp(alpha);pool.mesh.count++;
  }
  function clear(){for(const pool of batches){pool.mesh.count=0;pool.mesh.visible=false;}group.visible=false;handGroup.visible=false;group.userData.activeEvents=0;}
  function playThrow(type,now){if(!disposed&&type==='ember-solder'&&Number.isFinite(now)&&now>=0)throwStarted=now;}
  function cue(key,now){if(typeof key==='string'&&key.toLowerCase().replace(/^key/,'')==='c')playThrow('ember-solder',now);}
  const throwing=now=>!disposed&&Number.isFinite(now)&&now>=throwStarted&&now<throwStarted+.32;
  function reset(){clear();unique.clear();endedPersonal.clear();throwStarted=-Infinity;}
  function update(events,now,{viewer=null,showHand=false,reducedMotion=false,actors=null}={}){
    if(disposed)return;clear();unique.clear();
    for(const[id,end]of endedPersonal)if(Number.isFinite(now)&&now>=end)endedPersonal.delete(id);
    if(Number.isFinite(now)&&now>=0&&Array.isArray(events))for(let index=0;index<Math.min(events.length,80);index++){
      const event=events[index];if(!validEvent(event,now)||unique.has(event.id))continue;unique.set(event.id,event);if(unique.size===MAX_EVENTS)break;
    }
    let rendered=0;
    for(const event of unique.values()){
      const age=now-event.startedAt,after=now-event.triggerAt,p=phase(event.id);
      if(event.type==='ember-solder'){
        if(age<event.flight){
          const point=skillProjectilePosition(event,now);if(!point||![point.x,point.y,point.z].every(coordinate))continue;
          write(drops,point.x,point.y,point.z,1,1,1,reducedMotion?0:age*2,age*2,0);
        }else{
          const ground=event.y-EMBER_SKILLS.solderGroundOffset+.085,burst=after>=0,progress=clamp(after/EMBER_SKILLS.solderTail),fade=burst?1-progress:1;
          if(!burst)write(drops,event.x,event.y,event.z,1,.65,1);
          const radius=event.radius*(burst?(reducedMotion?1:.92+.08*progress):1),alpha=(burst?.25:.17)*fade;
          for(let index=0;index<24;index++){
            const a=index*Math.PI/12,length=2*radius*Math.sin(Math.PI/24)*.82;
            write(lines,event.x+Math.cos(a)*radius,ground,event.z+Math.sin(a)*radius,length,.025,1,-Math.PI/2,0,-a-Math.PI/2,burst?0xffc18a:0xeaa36f,alpha);
          }
          if(burst)for(let index=0;index<12;index++){
            const a=p+index*2.39996,r=(.12+(index%4)*.11)*(reducedMotion?1:1+progress*2.5),rise=reducedMotion?.06:Math.sin(progress*Math.PI)*(.12+(index%3)*.06),size=(.012+(index%3)*.005)*(1-progress);
            write(chips,event.x+Math.cos(a)*r,ground+rise,event.z+Math.sin(a)*r,size,size*.55,size,0,a,reducedMotion?0:progress*2,index%2?0xe9b183:0xc6c9c4);
          }
        }
        rendered++;continue;
      }
      if(endedPersonal.has(event.id))continue;
      const source=Array.isArray(actors)?actors.find(actor=>actor?.id===event.sourceId):viewer?.id===event.sourceId?viewer:null;
      if(!source||source.alive!==true||source.team!==event.team||![source.x,source.y??0,source.z].every(coordinate)||(event.type==='ember-service'&&source.weaponId!==event.weaponId)){
        if(Array.isArray(actors)||source){endedPersonal.set(event.id,event.endsAt);if(endedPersonal.size>MAX_EVENTS)endedPersonal.delete(endedPersonal.keys().next().value);}continue;
      }
      const fade=clamp(age/.08)*clamp((event.endsAt-now)/.2),yaw=Number.isFinite(source.yaw)?source.yaw:source.remoteId&&Number.isFinite(source.netYaw)?source.netYaw:Number.isFinite(source.group?.rotation?.y)?source.group.rotation.y-Math.PI:0,crouch=clamp(Number.isFinite(source.crouch)?source.crouch:0),own=showHand&&viewer?.id===source.id;
      if(event.type==='ember-shade'){
        if(own){
          // A brief peripheral check, never a white screen or alteration of glasses.
          const alpha=.16*fade*clamp((.3-age)/.2);
          if(alpha>0)for(const side of[-1,1])write(handLines,side*.23,-.10,-.55,.05,.007,1,0,0,side*.15,0xffe4c0,alpha);
        }else{
          for(const side of[-1,1]){
            const dx=side*.057,x=source.x+Math.cos(yaw)*dx-Math.sin(yaw)*.205,z=source.z-Math.sin(yaw)*dx-Math.cos(yaw)*.205;
            write(lines,x,(source.y??0)+1.62-crouch*.55,z,.067,.009,1,0,yaw,0,0xffe4c0,.20*fade);
          }
        }
      }else{
        const progress=clamp(age/EMBER_SKILLS.serviceDuration),count=3;
        for(let index=0;index<count;index++){
          const side=(index-1)*.035;
          if(own)write(handLines,-.22+side,-.235,-.57,.022,.005+progress*.026,1,0,0,0,0xeaa36f,.25*fade);
          else{
            const x=source.x+Math.cos(yaw)*side-Math.sin(yaw)*.22,z=source.z-Math.sin(yaw)*side-Math.cos(yaw)*.22;
            write(lines,x,(source.y??0)+1.08-crouch*.3,z,.014,.025+progress*.045,1,0,yaw,index===1?Math.PI/4:0,0xeaa36f,.35*fade);
          }
        }
      }
      rendered++;
    }
    const handAge=now-throwStarted;
    if(Number.isFinite(now)&&showHand&&handAge>=0&&handAge<.24){const t=clamp(handAge/.24);write(handDrop,.22+t*.035,-.29+(reducedMotion?0:Math.sin(t*Math.PI)*.035),-.48-t*.12,.8,.8,.8,reducedMotion?0:-t*.4,.2,0);}
    for(const pool of batches){pool.mesh.visible=pool.mesh.count>0;pool.mesh.instanceMatrix.needsUpdate=true;pool.mesh.instanceColor.needsUpdate=true;if(pool.opacity)pool.opacity.needsUpdate=true;}
    group.visible=[drops,lines,chips].some(pool=>pool.mesh.count>0);handGroup.visible=handDrop.mesh.count>0||handLines.mesh.count>0;group.userData.activeEvents=rendered;
  }
  function dispose(){if(disposed)return;disposed=true;reset();handGroup.removeFromParent();group.removeFromParent();for(const pool of batches)pool.mesh.dispose();for(const geometry of privateGeometries)geometry.dispose();release();}
  reset();return{group,update,playThrow,cue,throwing,reset,dispose};
}
