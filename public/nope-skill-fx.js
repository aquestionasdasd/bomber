import { isLobbedSkill, validThrowFlight, throwDelay } from './skill-throw.js';
import { createNopeBottleModel } from './nope-props.js';
import { createNopeFaceModel } from './nope-avatar.js';
import { skillProjectilePosition } from './character-skills.js';
import { NOPE_SKILLS } from './abilities.js';

const types=Object.freeze({
  'nope-bottle':{flight:NOPE_SKILLS.bottleFlight,delay:NOPE_SKILLS.bottleFuse,tail:.6,radius:NOPE_SKILLS.bottleRadius},
  'nope-flash':{flight:NOPE_SKILLS.flashFlight,delay:NOPE_SKILLS.flashFlight,tail:.4,radius:NOPE_SKILLS.flashRadius},
  'nope-decoy':{flight:0,delay:0,tail:NOPE_SKILLS.decoyDuration,radius:0},
});
const coordinate=value=>Number.isFinite(value)&&Math.abs(value)<=1000;
function validEvent(event,now){
  if(!event||typeof event.type!=='string'||!Object.hasOwn(types,event.type)||typeof event.id!=='string'
    ||!new RegExp(`^skill-${event.type}-[1-9][0-9]{0,14}$`).test(event.id)||![event.x,event.y,event.z,event.fromX,event.fromY,event.fromZ].every(coordinate)
    ||![event.startedAt,event.endsAt,event.triggerAt].every(value=>Number.isFinite(value)&&value>=0))return false;
  const spec=types[event.type];return (isLobbedSkill(event.type)?validThrowFlight(event):event.flight===spec.flight)&&event.radius===spec.radius
    &&Math.abs(event.triggerAt-event.startedAt-(isLobbedSkill(event.type)?throwDelay(event,spec.flight,spec.delay):spec.delay))<1e-7&&Math.abs(event.endsAt-event.triggerAt-spec.tail)<1e-7
    &&now>=event.startedAt&&now<event.endsAt;
}

// Presentation only: all world poses come from authoritative event times.
// A local hand cue gives immediate feedback without predicting damage or flash.
export function createNopeSkillFX(THREE, camera) {
  const group = new THREE.Group();group.name='NOPE / bottle, flash and decoy';
  const entries=new Map(),handGroup=new THREE.Group();handGroup.name='NOPE / throwing hand cue';
  camera.add(handGroup);handGroup.visible=false;
  let hand=null,handType=null,throwStarted=-Infinity,disposed=false;
  const ringGeometry=new THREE.RingGeometry(.91,1,48);
  const ringMaterial=new THREE.MeshBasicMaterial({color:'#ff36b1',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false});
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function create(event){
    const container=new THREE.Group(),visual=event.type==='nope-bottle'?createNopeBottleModel(THREE):createNopeFaceModel(THREE);
    container.name=`NOPE skill / ${event.type}`;container.add(visual.group);
    const ring=new THREE.Mesh(ringGeometry,ringMaterial);ring.rotation.x=-Math.PI/2;ring.raycast=()=>{};ring.visible=false;ring.userData.solid=false;container.add(ring);
    visual.group.traverse(object=>{if(object.isMesh){object.raycast=()=>{};object.userData.solid=false;}});
    group.add(container);return {container,visual,ring};
  }
  function remove(id){const entry=entries.get(id);if(!entry)return;entry.visual.dispose();entry.container.removeFromParent();entries.delete(id);}
  function playThrow(type,now){
    if(disposed||!['nope-bottle','nope-flash'].includes(type)||!Number.isFinite(now)||now<0)return;
    if(handType!==type){hand?.dispose();hand=type==='nope-bottle'?createNopeBottleModel(THREE):createNopeFaceModel(THREE);handGroup.add(hand.group);handType=type;}
    throwStarted=now;
  }
  function throwing(now){return Number.isFinite(now)&&now>=throwStarted&&now<throwStarted+.32;}
  function reset(){for(const id of [...entries.keys()])remove(id);handGroup.visible=false;throwStarted=-Infinity;group.visible=false;group.userData.activeEvents=0;}
  function update(events,now,{viewer=null,showHand=false,reducedMotion=false}={}){
    if(disposed)return;
    const valid=new Map();
    for(const event of Array.isArray(events)?events:[]){
      if(!Number.isFinite(now)||now<0||!validEvent(event,now))continue;
      if(!valid.has(event.id))valid.set(event.id,event);if(valid.size===20)break;
    }
    for(const id of entries.keys())if(!valid.has(id))remove(id);
    for(const [id,event]of valid){
      let entry=entries.get(id);if(!entry){entry=create(event);entries.set(id,entry);}
      const {container,visual,ring}=entry,age=now-event.startedAt,after=now-event.triggerAt;
      const point=skillProjectilePosition(event,now);container.position.set(point.x,point.y,point.z);
      visual.group.visible=true;ring.visible=false;
      if(event.type==='nope-bottle'){
        visual.group.scale.setScalar(1.45);visual.group.rotation.set(age<event.flight?age*8:Math.PI*.42,0,.28);
        if(after>=0){visual.group.visible=false;ring.visible=true;ring.position.y=.025;ring.scale.setScalar(clamp(after/.6,0,1)*event.radius);}
      }else if(event.type==='nope-flash'){
        visual.group.scale.setScalar(after>=0?.28+.5*clamp(after/.4,0,1):.28);visual.group.rotation.set(0,age*3,0);
        if(after>=0){ring.visible=true;ring.position.y=-.1;ring.scale.setScalar(.3+after*7);}
      }else{
        visual.group.scale.setScalar(.95);visual.group.position.y=1.4+(reducedMotion?0:Math.sin(age*3)*.045);
        if(viewer&&coordinate(viewer.x)&&coordinate(viewer.z))visual.group.rotation.y=Math.atan2(viewer.x-event.x,viewer.z-event.z);
        ring.visible=true;ring.position.y=.025;ring.scale.setScalar(.62);
      }
    }
    const age=now-throwStarted;handGroup.visible=!!(Number.isFinite(now)&&showHand&&hand&&age>=0&&age<.24);
    if(handGroup.visible){
      const t=clamp(age/.24,0,1);handGroup.position.set(.23+t*.1,-.32+Math.sin(t*Math.PI)*.11,-.52-t*.22);handGroup.rotation.set(-.2-t*.8,.25,-.28);
      hand.group.scale.setScalar(handType==='nope-bottle'?1.1:.4);
    }
    group.visible=entries.size>0;group.userData.activeEvents=entries.size;
  }
  function dispose(){if(disposed)return;disposed=true;reset();hand?.dispose();hand=null;handGroup.removeFromParent();group.removeFromParent();ringGeometry.dispose();ringMaterial.dispose();}
  return {group,update,playThrow,throwing,reset,dispose};
}
