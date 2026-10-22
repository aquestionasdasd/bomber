import { DUELIST_SKILLS } from './abilities.js';
import { skillProjectilePosition } from './character-skills.js';

const MAX_EVENTS=20,caches=new WeakMap(),fields=['id','type','team','sourceId','round','x','y','z','fromX','fromY','fromZ','startedAt','triggerAt','endsAt','flight','radius'];
const clamp=value=>Math.max(0,Math.min(1,value));
const coordinate=value=>Number.isFinite(value)&&Math.abs(value)<=1000;
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=64&&!/[\u0000-\u001f\u007f]/.test(value);
function validEvent(event,now){
  if(!event||typeof event!=='object'||Array.isArray(event)||!fields.every(key=>Object.hasOwn(event,key))||!Object.keys(event).every(key=>fields.includes(key))
    ||!['duelist-comet','duelist-lift'].includes(event.type)||!identifier(event.id)||!new RegExp(`^skill-${event.type}-[1-9][0-9]{0,14}$`).test(event.id)
    ||!identifier(event.sourceId)||!['red','blue'].includes(event.team)||!Number.isSafeInteger(event.round)||event.round<1
    ||![event.x,event.y,event.z,event.fromX,event.fromY,event.fromZ].every(coordinate)||![event.startedAt,event.triggerAt,event.endsAt].every(value=>Number.isFinite(value)&&value>=0))return false;
  const comet=event.type==='duelist-comet',flight=comet?DUELIST_SKILLS.cometFlight:0,tail=comet?DUELIST_SKILLS.cometDuration:DUELIST_SKILLS.liftVisualDuration;
  return event.flight===flight&&event.radius===(comet?DUELIST_SKILLS.cometRadius:0)
    &&Math.abs(event.triggerAt-event.startedAt-flight)<1e-7&&Math.abs(event.endsAt-event.triggerAt-tail)<1e-7
    &&Math.hypot(event.x-event.fromX,event.y-event.fromY,event.z-event.fromZ)<=(comet?DUELIST_SKILLS.cometRange+1e-7:1e-7)
    &&now>=event.startedAt&&now<event.endsAt;
}
function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    const shape=new THREE.Shape();
    for(let i=0;i<10;i++){const angle=Math.PI/2+i*Math.PI/5,radius=i%2?.073:.17,x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();
    const starGeometry=new THREE.ExtrudeGeometry(shape,{depth:.035,steps:1,bevelEnabled:true,bevelSize:.005,bevelThickness:.004,bevelSegments:1,curveSegments:3});starGeometry.translate(0,0,-.0175);
    const sphereGeometry=new THREE.SphereGeometry(1,32,20),positions=sphereGeometry.attributes.position,colors=[],color=new THREE.Color(),pale=new THREE.Color('#c3deed'),blue=new THREE.Color('#8fb8d1');
    for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),mix=clamp(.30+.13*Math.sin(x*7+y*5)+.10*Math.sin(z*8-x*4));color.copy(pale).lerp(blue,mix);colors.push(color.r,color.g,color.b);}sphereGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const streakGeometry=new THREE.BoxGeometry(1,1,1);
    const star=new THREE.MeshStandardMaterial({color:'#f5e5af',roughness:.35,metalness:.4});star.name='Duelist skill / small bevelled pale gold star';
    const smoke=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,transparent:false,opacity:1,depthWrite:true,depthTest:true});smoke.name='Duelist skill / fixed opaque star blue smoke';
    const streak=new THREE.MeshBasicMaterial({color:'#ffffff',depthWrite:true,depthTest:true});streak.name='Duelist skill / thin blue white comet and lift trails';
    cache={references:0,starGeometry,sphereGeometry,streakGeometry,star,smoke,streak};caches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return{cache,release(){if(released)return;released=true;if(--cache.references===0){for(const key of['starGeometry','sphereGeometry','streakGeometry','star','smoke','streak'])cache[key].dispose();caches.delete(THREE);}}};
}

// Presentation only. A fixed opaque sphere matches the engine's airborne
// vision volume; the lift adds neither an impulse nor any collision surface.
export function createDuelistSkillFX(THREE,camera){
  const{cache,release}=acquireAssets(THREE),group=new THREE.Group();group.name='Duelist / comet veil and antenna lift';group.visible=false;
  const transform=new THREE.Object3D(),color=new THREE.Color(),direction=new THREE.Vector3(),axis=new THREE.Vector3(1,0,0),batches=[],unique=new Map();
  let disposed=false,throwStarted=-Infinity;
  function batch(name,geometry,material,capacity){
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name=`Duelist skill / ${name}`;mesh.count=0;mesh.visible=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3);mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.solid=false;mesh.raycast=()=>{};group.add(mesh);const pool={mesh,capacity};batches.push(pool);return pool;
  }
  const stars=batch('small stars',cache.starGeometry,cache.star,MAX_EVENTS*9),smokes=batch('fixed opaque comet spheres',cache.sphereGeometry,cache.smoke,MAX_EVENTS),streaks=batch('short comet trails and upward particles',cache.streakGeometry,cache.streak,MAX_EVENTS*12);
  const handGroup=new THREE.Group();handGroup.name='Duelist / small star hand cue';handGroup.visible=false;camera.add(handGroup);
  const hand=new THREE.Mesh(cache.starGeometry,cache.star);hand.name='Duelist hand / bevelled star';hand.castShadow=false;hand.receiveShadow=false;hand.userData.solid=false;hand.raycast=()=>{};handGroup.add(hand);
  function write(pool,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,hex=0xffffff){const index=pool.mesh.count;if(index>=pool.capacity)return;transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();pool.mesh.setMatrixAt(index,transform.matrix);color.setHex(hex);pool.mesh.setColorAt(index,color);pool.mesh.count++;}
  function segment(ax,ay,az,bx,by,bz,width,hex){
    direction.set(bx-ax,by-ay,bz-az);const length=direction.length(),index=streaks.mesh.count;if(length<1e-7||index>=streaks.capacity)return;
    transform.position.set((ax+bx)/2,(ay+by)/2,(az+bz)/2);transform.quaternion.setFromUnitVectors(axis,direction.multiplyScalar(1/length));transform.scale.set(length,width,width);transform.updateMatrix();streaks.mesh.setMatrixAt(index,transform.matrix);color.setHex(hex);streaks.mesh.setColorAt(index,color);streaks.mesh.count++;
  }
  function clear(){for(const pool of batches){pool.mesh.count=0;pool.mesh.visible=false;}group.visible=false;group.userData.activeEvents=0;handGroup.visible=false;}
  function playThrow(type,now){if(!disposed&&type==='duelist-comet'&&Number.isFinite(now)&&now>=0)throwStarted=now;}
  function cue(key,now){if(typeof key==='string'&&key.toLowerCase().replace(/^key/,'')==='c')playThrow('duelist-comet',now);}
  const throwing=now=>!disposed&&Number.isFinite(now)&&now>=throwStarted&&now<throwStarted+.32;
  function reset(){clear();unique.clear();throwStarted=-Infinity;}
  function update(events,now,{showHand=false,reducedMotion=false}={}){
    if(disposed)return;clear();unique.clear();
    if(Number.isFinite(now)&&now>=0&&Array.isArray(events))for(let i=0;i<Math.min(events.length,80);i++){const event=events[i];if(!validEvent(event,now)||unique.has(event.id))continue;unique.set(event.id,event);if(unique.size===MAX_EVENTS)break;}
    let rendered=0;
    for(const event of unique.values()){
      const age=now-event.startedAt;
      if(event.type==='duelist-comet'){
        if(age<event.flight){
          const point=skillProjectilePosition(event,now);if(!point||![point.x,point.y,point.z].every(coordinate))continue;
          write(stars,point.x,point.y,point.z,.75,.75,.75,reducedMotion?0:age*3,reducedMotion?0:age*4,0);
          const dx=event.x-event.fromX,dy=event.y-event.fromY,dz=event.z-event.fromZ,length=Math.hypot(dx,dy,dz),travelled=length*clamp(age/event.flight);
          if(length>1e-7&&!reducedMotion)for(let i=0;i<3;i++){
            const head=.07+i*.19,tail=head+.10+i*.025;if(travelled<tail)continue;
            segment(point.x-dx/length*head,point.y-dy/length*head,point.z-dz/length*head,point.x-dx/length*tail,point.y-dy/length*tail,point.z-dz/length*tail,.017-i*.003,i%2?0xd6e9ef:0x9bcfe4);
          }
        }else write(smokes,event.x,event.y,event.z,event.radius,event.radius,event.radius);
      }else{
        const progress=clamp(age/DUELIST_SKILLS.liftVisualDuration),fade=clamp((event.endsAt-now)/.12),rotation=reducedMotion?0:progress*.3;
        write(stars,event.x,event.y+.085,event.z,1.15*fade,1.15*fade,.65*fade,-Math.PI/2,0,rotation);
        for(let i=0;i<8;i++){
          const angle=i*Math.PI/4+(reducedMotion?0:progress*.35),radius=.20+(i%2)*.065,height=(reducedMotion?.27:progress*.85)+.13+(i%3)*.08,x=event.x+Math.cos(angle)*radius,z=event.z+Math.sin(angle)*radius,y=event.y+height,size=(.13+(i%2)*.035)*fade;
          write(stars,x,y,z,size,size,size,0,angle,reducedMotion?0:progress*.5,i%2?0xb3daef:0xffffff);
          if(!reducedMotion)segment(x,y-.08,z,x,y-.16,z,.009*fade,i%2?0xb3daef:0xe0edf5);
        }
      }
      rendered++;
    }
    for(const pool of batches){pool.mesh.visible=pool.mesh.count>0;pool.mesh.instanceMatrix.needsUpdate=true;pool.mesh.instanceColor.needsUpdate=true;}group.visible=batches.some(pool=>pool.mesh.count>0);group.userData.activeEvents=rendered;
    const age=now-throwStarted;handGroup.visible=!!(Number.isFinite(now)&&showHand&&age>=0&&age<.24);
    if(handGroup.visible){const t=clamp(age/.24);handGroup.position.set(.22+t*.04,-.29+(reducedMotion?0:Math.sin(t*Math.PI)*.035),-.48-t*.13);handGroup.rotation.set(reducedMotion?0:-.15-t*.3,.2,-.1);hand.scale.setScalar(.7);}
  }
  function dispose(){if(disposed)return;disposed=true;reset();handGroup.removeFromParent();group.removeFromParent();for(const pool of batches)pool.mesh.dispose();release();}
  reset();return{group,update,reset,dispose,playThrow,cue,throwing};
}
