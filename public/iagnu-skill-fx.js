import { skillProjectilePosition } from './character-skills.js';
import { IAGNU_SKILLS } from './abilities.js';

const MAX_EVENTS=20,caches=new WeakMap();
const specs=Object.freeze({
  'echo-tag':{flight:IAGNU_SKILLS.tagFlight,delay:IAGNU_SKILLS.tagFlight+IAGNU_SKILLS.tagArmDelay,tail:IAGNU_SKILLS.tagDuration,radius:IAGNU_SKILLS.tagRadius},
  'echo-glint':{flight:IAGNU_SKILLS.glintFlight,delay:IAGNU_SKILLS.glintFlight,tail:.4,radius:IAGNU_SKILLS.glintRadius},
  'echo-kerning':{flight:0,delay:0,tail:IAGNU_SKILLS.kerningDuration,radius:0},
});
const clamp=value=>Math.max(0,Math.min(1,value));
const coordinate=value=>Number.isFinite(value)&&Math.abs(value)<=1000;
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=64&&!/[\u0000-\u001f\u007f]/.test(value);
function validEvent(event,now){
  if(!event||typeof event!=='object'||Array.isArray(event)||!['type','id','team','sourceId','round','x','y','z','fromX','fromY','fromZ','startedAt','triggerAt','endsAt','flight','radius'].every(key=>Object.hasOwn(event,key))
    ||typeof event.type!=='string'||!Object.hasOwn(specs,event.type)||!identifier(event.id)
    ||!new RegExp(`^skill-${event.type}-[1-9][0-9]{0,14}$`).test(event.id)
    ||!['blue','red'].includes(event.team)||!identifier(event.sourceId)||!Number.isSafeInteger(event.round)||event.round<1
    ||![event.x,event.y,event.z,event.fromX,event.fromY,event.fromZ].every(coordinate)
    ||![event.startedAt,event.triggerAt,event.endsAt].every(value=>Number.isFinite(value)&&value>=0))return false;
  const spec=specs[event.type];
  return event.flight===spec.flight&&event.radius===spec.radius
    &&Math.abs(event.triggerAt-event.startedAt-spec.delay)<1e-7&&Math.abs(event.endsAt-event.triggerAt-spec.tail)<1e-7
    &&now>=event.startedAt&&now<event.endsAt;
}

function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    // Small physical serif letters, with real counters and bevels rather than billboards.
    const i=new THREE.Shape();i.moveTo(-.13,0);i.lineTo(.13,0);i.lineTo(.13,.045);i.lineTo(.045,.065);i.lineTo(.045,.435);i.lineTo(.13,.455);i.lineTo(.13,.5);i.lineTo(-.13,.5);i.lineTo(-.13,.455);i.lineTo(-.045,.435);i.lineTo(-.045,.065);i.lineTo(-.13,.045);i.closePath();
    const a=new THREE.Shape();a.moveTo(-.25,0);a.lineTo(-.075,0);a.lineTo(-.075,.04);a.lineTo(-.12,.055);a.lineTo(-.078,.18);a.lineTo(.075,.18);a.lineTo(.12,.055);a.lineTo(.075,.04);a.lineTo(.075,0);a.lineTo(.25,0);a.lineTo(.25,.04);a.lineTo(.20,.06);a.lineTo(.043,.5);a.lineTo(-.018,.5);a.lineTo(-.195,.06);a.lineTo(-.25,.04);a.closePath();
    const counter=new THREE.Path();counter.moveTo(-.055,.25);counter.lineTo(.003,.42);counter.lineTo(.054,.25);counter.closePath();a.holes.push(counter);
    const letter=shape=>{const geometry=new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:2,steps:1,curveSegments:6});geometry.translate(0,-.10,-.0225);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;};
    const iGeometry=letter(i),aGeometry=letter(a);
    const gold=new THREE.MeshStandardMaterial({color:'#e0c66b',roughness:.3,metalness:.58});gold.name='IAGNU skill / brushed gold serif metal';
    const cue=new THREE.MeshBasicMaterial({color:'#ffffff',vertexColors:true,transparent:true,opacity:1,depthWrite:false,depthTest:true,side:THREE.DoubleSide});cue.name='IAGNU skill / restrained gold lines';cue.forceSinglePass=true;
    cue.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float iagnuOpacity;\nvarying float vIagnuOpacity;').replace('#include <begin_vertex>','#include <begin_vertex>\nvIagnuOpacity=iagnuOpacity;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vIagnuOpacity;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vIagnuOpacity;');
    };
    cue.customProgramCacheKey=()=> 'iagnu-ordinary-opacity-v1';
    cache={references:0,iGeometry,aGeometry,gold,cue};caches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return {cache,release(){if(released)return;released=true;if(--cache.references===0){cache.iGeometry.dispose();cache.aGeometry.dispose();cache.gold.dispose();cache.cue.dispose();caches.delete(THREE);}}};
}

// Presentation only. Detection stays in the authoritative engine; no marker or
// target identity is inferred here. All world instances use normal depth tests.
export function createIagnuSkillFX(THREE,camera){
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group();group.name='IAGNU / gold letter skills';group.visible=false;
  const transform=new THREE.Object3D(),color=new THREE.Color(),batches=[],unique=new Map();
  let disposed=false,throwStarted=-Infinity,throwType=null;
  function batch(name,geometry,material,capacity){
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name=`IAGNU skill / ${name}`;mesh.count=0;mesh.visible=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3);mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.solid=false;mesh.raycast=()=>{};group.add(mesh);
    const pool={mesh,capacity,opacity:geometry.getAttribute('iagnuOpacity')};batches.push(pool);return pool;
  }
  const lettersI=batch('serif I tags',cache.iGeometry,cache.gold,MAX_EVENTS),lettersA=batch('serif A glints',cache.aGeometry,cache.gold,MAX_EVENTS);
  const lineGeometry=new THREE.PlaneGeometry(1,1),opacity=new THREE.InstancedBufferAttribute(new Float32Array(MAX_EVENTS*32),1);opacity.setUsage(THREE.DynamicDrawUsage);lineGeometry.setAttribute('iagnuOpacity',opacity);
  const lines=batch('ground baselines and reflected rays',lineGeometry,cache.cue,MAX_EVENTS*32);
  const handGroup=new THREE.Group();handGroup.name='IAGNU / letter hand cue';handGroup.visible=false;camera.add(handGroup);
  const hand=new THREE.Mesh(cache.iGeometry,cache.gold);hand.name='IAGNU hand / small bevelled gold letter';hand.raycast=()=>{};hand.userData.solid=false;handGroup.add(hand);
  const write=(pool,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,hex=0xffffff,alpha=1)=>{
    const index=pool.mesh.count;if(index>=pool.capacity)return;
    transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();pool.mesh.setMatrixAt(index,transform.matrix);
    color.setHex(hex);pool.mesh.setColorAt(index,color);if(pool.opacity)pool.opacity.array[index]=clamp(alpha);pool.mesh.count++;
  };
  const clear=()=>{for(const pool of batches){pool.mesh.count=0;pool.mesh.visible=false;}group.visible=false;group.userData.activeEvents=0;};
  function playThrow(type,now){
    if(disposed||!['echo-tag','echo-glint'].includes(type)||!Number.isFinite(now)||now<0)return;
    hand.geometry=type==='echo-tag'?cache.iGeometry:cache.aGeometry;throwStarted=now;throwType=type;
  }
  function cue(key,now){const type={c:'echo-tag',q:'echo-glint'}[typeof key==='string'?key.toLowerCase().replace(/^key/,''):''];if(type)playThrow(type,now);}
  const throwing=now=>!disposed&&Number.isFinite(now)&&now>=throwStarted&&now<throwStarted+.32;
  function reset(){clear();unique.clear();handGroup.visible=false;throwStarted=-Infinity;throwType=null;}
  function update(events,now,{viewer=null,showHand=false,reducedMotion=false,actors=null}={}){
    if(disposed)return;clear();unique.clear();
    if(Number.isFinite(now)&&now>=0&&Array.isArray(events))for(let index=0;index<Math.min(events.length,80);index++){
      const event=events[index];if(!validEvent(event,now)||unique.has(event.id))continue;unique.set(event.id,event);if(unique.size===MAX_EVENTS)break;
    }
    let rendered=0;
    for(const event of unique.values()){
      const age=now-event.startedAt,after=now-event.triggerAt;
      if(event.type==='echo-kerning'){
        const source=Array.isArray(actors)?actors.find(actor=>actor?.id===event.sourceId):viewer?.id===event.sourceId?viewer:null;
        if((Array.isArray(actors)||source)&&(!source||source.alive!==true||source.team!==event.team||![source.x,source.y??0,source.z].every(coordinate)))continue;
        const x=source?.x??event.x,y=(source?.y??event.y)+.085,z=source?.z??event.z;
        const fade=clamp(age/.12)*clamp((event.endsAt-now)/.3),yaw=Number.isFinite(source?.yaw)?source.yaw:0;
        for(const side of [-1,1])for(let n=0;n<3;n++){
          const dx=side*(.26+n*.08),dz=.15+n*.21;
          write(lines,x+Math.cos(yaw)*dx+Math.sin(yaw)*dz,y,z-Math.sin(yaw)*dx+Math.cos(yaw)*dz,.22-n*.035,.024,1,-Math.PI/2,0,yaw,0xe3cd82,(.34-n*.06)*fade);
        }
        rendered++;continue;
      }
      if(age<event.flight){
        const point=skillProjectilePosition(event,now);if(!point||![point.x,point.y,point.z].every(coordinate))continue;
        write(event.type==='echo-tag'?lettersI:lettersA,point.x,point.y,point.z,.72,.72,.72,reducedMotion?0:age*3,age*2,reducedMotion?0:age*1.5);rendered++;continue;
      }
      if(event.type==='echo-tag'){
        const armed=after>=0,fade=clamp((event.endsAt-now)/.3),arm=clamp((age-event.flight)/IAGNU_SKILLS.tagArmDelay);
        write(lettersI,event.x,event.y,event.z,.82,.82,.82,0,0,0,armed?0xffffff:0xbeb494);
        const radius=event.radius*(armed?1:.94+.06*arm),alpha=(armed?.25:.11)*fade;
        for(let n=0;n<24;n++){
          const a=n*Math.PI/12,half=Math.PI/24,length=2*radius*Math.sin(half)*.83;
          write(lines,event.x+Math.cos(a)*radius,event.y-IAGNU_SKILLS.tagGroundOffset+.085,event.z+Math.sin(a)*radius,length,.025,1,-Math.PI/2,0,-a-Math.PI/2,0xe4ce79,alpha);
        }
      }else{
        const progress=clamp(after/.4),fade=1-progress,rotation=reducedMotion?0:progress*.12;
        write(lettersA,event.x,event.y,event.z,.82,.82,.82,0,rotation,0);
        for(let n=0;n<8;n++){
          const a=n*Math.PI/4,r=.33+(reducedMotion?0:progress*.25),length=.12+(reducedMotion?0:progress*.16);
          write(lines,event.x+Math.cos(a)*r,event.y+.12+Math.sin(a)*r,event.z+.045,length,.024,1,0,0,a,0xffe4a4,.44*fade);
        }
      }
      rendered++;
    }
    for(const pool of batches){pool.mesh.visible=pool.mesh.count>0;pool.mesh.instanceMatrix.needsUpdate=true;pool.mesh.instanceColor.needsUpdate=true;if(pool.opacity)pool.opacity.needsUpdate=true;}
    group.visible=rendered>0;group.userData.activeEvents=rendered;
    const age=now-throwStarted;handGroup.visible=!!(Number.isFinite(now)&&showHand&&throwType&&age>=0&&age<.24);
    if(handGroup.visible){const t=clamp(age/.24);handGroup.position.set(.21+t*.07,-.33+(reducedMotion?0:Math.sin(t*Math.PI)*.07),-.5-t*.17);handGroup.rotation.set(reducedMotion?0:-.15-t*.5,.25,-.15);hand.scale.setScalar(.45);}
  }
  function dispose(){if(disposed)return;disposed=true;reset();handGroup.removeFromParent();group.removeFromParent();for(const pool of batches)pool.mesh.dispose();lineGeometry.dispose();release();}
  reset();return {group,update,cue,playThrow,throwing,reset,dispose};
}
