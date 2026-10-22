import { FROST_SKILLS } from './abilities.js';
import { skillProjectilePosition } from './character-skills.js';

const MAX_EVENTS=20,caches=new WeakMap(),fields=['id','type','team','sourceId','round','x','y','z','fromX','fromY','fromZ','startedAt','triggerAt','endsAt','flight','radius'];
const specs=Object.freeze({
  'frost-stitch':{flight:FROST_SKILLS.stitchFlight,delay:FROST_SKILLS.stitchFlight+FROST_SKILLS.stitchArmDelay,tail:FROST_SKILLS.stitchDuration,radius:FROST_SKILLS.stitchRadius,range:FROST_SKILLS.stitchRange},
  'frost-mist':{flight:FROST_SKILLS.mistFlight,delay:FROST_SKILLS.mistFlight,tail:FROST_SKILLS.mistDuration,radius:FROST_SKILLS.mistRadius,range:FROST_SKILLS.mistRange},
  'frost-unravel':{flight:0,delay:0,tail:FROST_SKILLS.unravelDuration,radius:0,range:0},
});
const clamp=value=>Math.max(0,Math.min(1,value));
const coordinate=value=>Number.isFinite(value)&&Math.abs(value)<=1000;
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=64&&!/[\u0000-\u001f\u007f]/.test(value);
function validEvent(event,now){
  if(!event||typeof event!=='object'||Array.isArray(event)||!fields.every(key=>Object.hasOwn(event,key))||!Object.keys(event).every(key=>fields.includes(key))
    ||typeof event.type!=='string'||!Object.hasOwn(specs,event.type)||!identifier(event.id)||!new RegExp(`^skill-${event.type}-[1-9][0-9]{0,14}$`).test(event.id)
    ||!identifier(event.sourceId)||!['red','blue'].includes(event.team)||!Number.isSafeInteger(event.round)||event.round<1
    ||![event.x,event.y,event.z,event.fromX,event.fromY,event.fromZ].every(coordinate)||![event.startedAt,event.triggerAt,event.endsAt].every(value=>Number.isFinite(value)&&value>=0))return false;
  const spec=specs[event.type],personal=event.type==='frost-unravel';
  return event.flight===spec.flight&&event.radius===spec.radius&&Math.abs(event.triggerAt-event.startedAt-spec.delay)<1e-7&&Math.abs(event.endsAt-event.triggerAt-spec.tail)<1e-7
    &&(personal?Math.hypot(event.x-event.fromX,event.y-event.fromY,event.z-event.fromZ)<1e-7:Math.hypot(event.x-event.fromX,event.z-event.fromZ)<=spec.range+1e-7)
    &&now>=event.startedAt&&now<event.endsAt;
}
function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    const shape=new THREE.Shape();shape.moveTo(-.15,.075);shape.lineTo(-.025,.035);shape.lineTo(.025,.035);shape.lineTo(.15,.075);shape.lineTo(.13,-.075);shape.lineTo(.022,-.025);shape.lineTo(-.022,-.025);shape.lineTo(-.13,-.075);shape.closePath();
    const knotGeometry=new THREE.ExtrudeGeometry(shape,{depth:.035,steps:1,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:1,curveSegments:3});knotGeometry.translate(0,0,-.0175);
    const color=new THREE.Color(),colors=[],p=knotGeometry.attributes.position;
    for(let i=0;i<p.count;i++){const x=Math.floor((p.getX(i)+.2)/.025),y=Math.floor((p.getY(i)+.1)/.025);color.setHex((x+y)%2?0xbfc1de:0x39445e);colors.push(color.r,color.g,color.b);}knotGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const mistGeometry=new THREE.SphereGeometry(1,32,20),mistColors=[],mp=mistGeometry.attributes.position,white=new THREE.Color('#e4e3ef'),lilac=new THREE.Color('#acaac6');
    for(let i=0;i<mp.count;i++){color.copy(white).lerp(lilac,clamp(.27+.15*Math.sin(mp.getX(i)*8+mp.getY(i)*6)+.10*Math.sin(mp.getZ(i)*9-mp.getX(i)*5)));mistColors.push(color.r,color.g,color.b);}mistGeometry.setAttribute('color',new THREE.Float32BufferAttribute(mistColors,3));
    const ribbonGeometry=new THREE.BoxGeometry(1,1,1);
    const cloth=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.86,metalness:0});cloth.name='FROST skill / small navy lilac plaid clasp';
    const ice=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.65,metalness:.08});ice.name='FROST skill / thin pale stitches and unravelled threads';
    const fog=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,transparent:false,opacity:1,depthWrite:true,depthTest:true});fog.name='FROST skill / fixed opaque pale lilac mist';
    cache={references:0,knotGeometry,mistGeometry,ribbonGeometry,cloth,ice,fog};caches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return{cache,release(){if(released)return;released=true;if(--cache.references===0){for(const key of['knotGeometry','mistGeometry','ribbonGeometry','cloth','ice','fog'])cache[key].dispose();caches.delete(THREE);}}};
}

// The ring is disconnected decoration over supported ground, never an ice
// floor or a collider. Smoke and slow authority remain in the game engine.
export function createFrostSkillFX(THREE,camera){
  const{cache,release}=acquireAssets(THREE),group=new THREE.Group();group.name='FROST / stitched ring, doll mist and ribbon';group.visible=false;
  const transform=new THREE.Object3D(),color=new THREE.Color(),direction=new THREE.Vector3(),axis=new THREE.Vector3(1,0,0),batches=[],unique=new Map(),surfaces=new Map(),endedUnravel=new Map();
  let disposed=false,throwStarted=-Infinity,throwType=null;
  function batch(name,geometry,material,capacity){
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name=`FROST skill / ${name}`;mesh.count=0;mesh.visible=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3);mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.solid=false;mesh.raycast=()=>{};group.add(mesh);const pool={mesh,capacity};batches.push(pool);return pool;
  }
  const knots=batch('plaid clasps',cache.knotGeometry,cache.cloth,MAX_EVENTS),mists=batch('fixed opaque mist spheres',cache.mistGeometry,cache.fog,MAX_EVENTS),ribbons=batch('supported inner outer stitches and threads',cache.ribbonGeometry,cache.ice,MAX_EVENTS*72);
  const handGroup=new THREE.Group();handGroup.name='FROST / small plaid hand cue';handGroup.visible=false;camera.add(handGroup);
  const hand=new THREE.Mesh(cache.knotGeometry,cache.cloth);hand.name='FROST hand / plaid clasp';hand.castShadow=false;hand.receiveShadow=false;hand.userData.solid=false;hand.raycast=()=>{};handGroup.add(hand);
  function write(pool,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,hex=0xffffff){const index=pool.mesh.count;if(index>=pool.capacity)return;transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();pool.mesh.setMatrixAt(index,transform.matrix);color.setHex(hex);pool.mesh.setColorAt(index,color);pool.mesh.count++;}
  function clear(){for(const pool of batches){pool.mesh.count=0;pool.mesh.visible=false;}group.visible=false;group.userData.activeEvents=0;handGroup.visible=false;}
  function playThrow(type,now){if(!disposed&&['frost-stitch','frost-mist'].includes(type)&&Number.isFinite(now)&&now>=0){throwStarted=now;throwType=type;}}
  function cue(key,now){const type={c:'frost-stitch',q:'frost-mist'}[typeof key==='string'?key.toLowerCase().replace(/^key/,''):''];if(type)playThrow(type,now);}
  const throwing=now=>!disposed&&Number.isFinite(now)&&now>=throwStarted&&now<throwStarted+.32;
  function reset(){clear();unique.clear();surfaces.clear();endedUnravel.clear();throwStarted=-Infinity;throwType=null;}
  function update(events,now,{viewer=null,showHand=false,reducedMotion=false,actors=null,groundHeight=null,reachable=null}={}){
    if(disposed)return;clear();unique.clear();
    for(const[id,end]of endedUnravel)if(Number.isFinite(now)&&now>=end)endedUnravel.delete(id);
    if(Number.isFinite(now)&&now>=0&&Array.isArray(events))for(let i=0;i<Math.min(events.length,80);i++){const event=events[i];if(!validEvent(event,now)||unique.has(event.id))continue;unique.set(event.id,event);if(unique.size===MAX_EVENTS)break;}
    for(const[id]of surfaces)if(unique.get(id)?.type!=='frost-stitch')surfaces.delete(id);
    const floor=(x,z,referenceY)=>{if(typeof groundHeight!=='function')return null;try{const y=groundHeight(x,z,referenceY);return coordinate(y)&&Math.abs(y-referenceY)<=FROST_SKILLS.stitchHeightTolerance+1e-7?y:null;}catch{return null;}};
    function supportedRing(event){
      const key=[event.round,event.x,event.y,event.z,event.fromX,event.fromY,event.fromZ,event.startedAt,event.triggerAt,event.endsAt,event.radius].join('|'),old=surfaces.get(event.id);
      if(old&&old.key===key&&old.groundHeight===groundHeight&&old.reachable===reachable)return old.parts;
      const parts=[],reference=event.y-FROST_SKILLS.stitchGroundOffset,centerRadius=(event.radius+FROST_SKILLS.stitchInnerRadius)/2;
      function piece(ax,az,bx,bz,hex){
        if(typeof reachable!=='function')return;
        const mx=(ax+bx)/2,mz=(az+bz)/2,dx=mx-event.x,dz=mz-event.z,distance=Math.hypot(dx,dz);if(distance<1e-6)return;
        const px=event.x+dx/distance*centerRadius,pz=event.z+dz/distance*centerRadius,py=floor(px,pz,reference),ay=floor(ax,az,reference),by=floor(bx,bz,reference),my=floor(mx,mz,reference);
        if([py,ay,by,my].some(y=>y===null)||Math.max(py,ay,by,my)-Math.min(py,ay,by,my)>FROST_SKILLS.stitchHeightTolerance+1e-7)return;
        const origin={...event,x:px,y:py,z:pz};try{if(![{x:ax,y:ay,z:az},{x:mx,y:my,z:mz},{x:bx,y:by,z:bz}].every(point=>reachable(origin,point)===true))return;}catch{return;}
        // Two supported halves follow the sampled middle, including short slopes.
        for(const[a,b]of[[{x:ax,y:ay,z:az},{x:mx,y:my,z:mz}],[{x:mx,y:my,z:mz},{x:bx,y:by,z:bz}]]){
          direction.set(b.x-a.x,b.y-a.y,b.z-a.z);const length=direction.length();if(length<1e-6)continue;transform.quaternion.setFromUnitVectors(axis,direction.multiplyScalar(1/length));parts.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2+.085,z:(a.z+b.z)/2,q:transform.quaternion.toArray(),length,hex});
        }
      }
      for(const radius of[FROST_SKILLS.stitchInnerRadius+.04,event.radius-.03])for(let i=0;i<12;i++){
        const a=i*Math.PI/6,half=Math.PI/12*.72;piece(event.x+Math.cos(a-half)*radius,event.z+Math.sin(a-half)*radius,event.x+Math.cos(a+half)*radius,event.z+Math.sin(a+half)*radius,i%2?0xc8d1ee:0xaab5d9);
      }
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3,cx=event.x+Math.cos(a)*centerRadius,cz=event.z+Math.sin(a)*centerRadius;
        for(const side of[-1,1]){const angle=a+side*Math.PI/4,dx=Math.cos(angle)*.12,dz=Math.sin(angle)*.12;piece(cx-dx,cz-dz,cx+dx,cz+dz,0xb4c4df);}
      }
      surfaces.set(event.id,{key,groundHeight,reachable,parts});return parts;
    }
    let rendered=0;
    for(const event of unique.values()){
      const age=now-event.startedAt,after=now-event.triggerAt;
      if(event.type==='frost-unravel'){
        if(endedUnravel.has(event.id))continue;
        const source=Array.isArray(actors)?actors.find(actor=>actor?.id===event.sourceId):viewer?.id===event.sourceId?viewer:null;
        if(!source||source.alive!==true||source.grounded!==true||source.team!==event.team||![source.x,source.y??0,source.z].every(coordinate)){
          if(Array.isArray(actors)||source){endedUnravel.set(event.id,event.endsAt);if(endedUnravel.size>MAX_EVENTS)endedUnravel.delete(endedUnravel.keys().next().value);}continue;
        }
        const progress=clamp(age/FROST_SKILLS.unravelDuration),fade=clamp((event.endsAt-now)/.2),yaw=Number.isFinite(source.yaw)?source.yaw:source.remoteId&&Number.isFinite(source.netYaw)?source.netYaw:Number.isFinite(source.group?.rotation?.y)?source.group.rotation.y-Math.PI:0;
        write(knots,source.x,(source.y??0)+.12,source.z,.55*fade,.55*fade,.55*fade,-Math.PI/2,yaw,0);
        for(let i=0;i<6;i++){const side=i%2?1:-1,a=yaw+side*(.4+i*.12),r=.21+(reducedMotion?.04:progress*.11)+(i%3)*.025;write(ribbons,source.x+Math.cos(a)*r,(source.y??0)+.085,source.z+Math.sin(a)*r,(.11+i*.012)*fade,.009,.018,0,-a,side*.05,i%2?0xc3c8e5:0x616d98);}
        rendered++;continue;
      }
      if(age<event.flight){const point=skillProjectilePosition(event,now);if(!point||![point.x,point.y,point.z].every(coordinate))continue;write(knots,point.x,point.y,point.z,.7,.7,.7,reducedMotion?0:age*2,age*2,0);rendered++;continue;}
      if(event.type==='frost-mist')write(mists,event.x,event.y,event.z,event.radius,event.radius,event.radius);
      else{
        write(knots,event.x,event.y,event.z,.65,.65,.65,-Math.PI/2,0,0);
        const width=(after<0?.009:.018)*clamp((event.endsAt-now)/.2);
        for(const value of supportedRing(event)){
          const index=ribbons.mesh.count;if(index>=ribbons.capacity)break;transform.position.set(value.x,value.y,value.z);transform.quaternion.fromArray(value.q);transform.scale.set(value.length,.009,width);transform.updateMatrix();ribbons.mesh.setMatrixAt(index,transform.matrix);color.setHex(value.hex);ribbons.mesh.setColorAt(index,color);ribbons.mesh.count++;
        }
      }
      rendered++;
    }
    for(const pool of batches){pool.mesh.visible=pool.mesh.count>0;pool.mesh.instanceMatrix.needsUpdate=true;pool.mesh.instanceColor.needsUpdate=true;}group.visible=batches.some(pool=>pool.mesh.count>0);group.userData.activeEvents=rendered;
    const age=now-throwStarted;handGroup.visible=!!(Number.isFinite(now)&&showHand&&throwType&&age>=0&&age<.24);
    if(handGroup.visible){const t=clamp(age/.24);handGroup.position.set(.22+t*.04,-.29+(reducedMotion?0:Math.sin(t*Math.PI)*.035),-.48-t*.13);handGroup.rotation.set(reducedMotion?0:-.15-t*.3,.2,-.1);hand.scale.setScalar(.65);}
  }
  function dispose(){if(disposed)return;disposed=true;reset();handGroup.removeFromParent();group.removeFromParent();for(const pool of batches)pool.mesh.dispose();release();}
  reset();return{group,update,reset,dispose,playThrow,cue,throwing};
}
