import { VEIL_SKILLS, veilRootSegment } from './abilities.js';

const MAX_EVENTS=20,caches=new WeakMap();
const specs=Object.freeze({
  'veil-dust':{delay:VEIL_SKILLS.dustArmDelay,tail:VEIL_SKILLS.dustDuration,radius:VEIL_SKILLS.dustRadius},
  'veil-roots':{delay:VEIL_SKILLS.rootsArmDelay,tail:VEIL_SKILLS.rootsDuration,radius:VEIL_SKILLS.rootsWidth/2},
  'veil-root-seed':{flight:VEIL_SKILLS.rootsThrowFlight,delay:VEIL_SKILLS.rootsThrowFlight+VEIL_SKILLS.rootsArmDelay,tail:VEIL_SKILLS.rootsDuration,radius:VEIL_SKILLS.rootsThrowWidth/2},
  'veil-turf':{delay:0,tail:VEIL_SKILLS.turfDuration,radius:0},
});
const coordinate=value=>Number.isFinite(value)&&Math.abs(value)<=1000;
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=64&&!/[\u0000-\u001f\u007f]/.test(value);
const clamp=value=>Math.max(0,Math.min(1,value));
function validEvent(event,now){
  if(!event||typeof event!=='object'||Array.isArray(event)||!['id','type','team','sourceId','round','x','y','z','fromX','fromY','fromZ','startedAt','triggerAt','endsAt','flight','radius'].every(key=>Object.hasOwn(event,key))
    ||typeof event.type!=='string'||!Object.hasOwn(specs,event.type)||!identifier(event.id)
    ||!new RegExp(`^skill-${event.type}-[1-9][0-9]{0,14}$`).test(event.id)||!identifier(event.sourceId)
    ||!['blue','red'].includes(event.team)||!Number.isSafeInteger(event.round)||event.round<1
    ||![event.x,event.y,event.z,event.fromX,event.fromY,event.fromZ].every(coordinate)
    ||![event.startedAt,event.triggerAt,event.endsAt].every(value=>Number.isFinite(value)&&value>=0))return false;
  const spec=specs[event.type],distance=Math.hypot(event.x-event.fromX,event.z-event.fromZ);
  return event.flight===(spec.flight??0)&&event.radius===spec.radius
    &&Math.abs(event.triggerAt-event.startedAt-spec.delay)<1e-7&&Math.abs(event.endsAt-event.triggerAt-spec.tail)<1e-7
    &&(event.type==='veil-roots'?distance>=VEIL_SKILLS.rootsMinRange-1e-7&&distance<=VEIL_SKILLS.rootsRange+1e-7
      :event.type==='veil-root-seed'?distance<=VEIL_SKILLS.rootsThrowRange+1e-7
      :event.type==='veil-dust'||distance<1e-7&&Math.abs(event.y-event.fromY)<1e-7)
    &&now>=event.startedAt&&now<event.endsAt;
}
function phase(id){let value=2166136261;for(let i=0;i<id.length;i++)value=Math.imul(value^id.charCodeAt(i),16777619);return (value>>>0)/4294967296*Math.PI*2;}
function acquireAssets(THREE){
  let cache=caches.get(THREE);
  if(!cache){
    const dustGeometry=new THREE.SphereGeometry(1,32,20),colors=[],p=dustGeometry.attributes.position,earth=new THREE.Color('#806447'),light=new THREE.Color('#a28b66');
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=clamp(.44+.18*Math.sin(x*9+y*7)+.14*Math.sin(z*11-x*5)+.08*y),color=earth.clone().lerp(light,t);colors.push(color.r,color.g,color.b);}
    dustGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const particleGeometry=new THREE.IcosahedronGeometry(1,0),rootGeometry=new THREE.CylinderGeometry(.55,1,1,7,1,false);
    const dustMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,transparent:false,opacity:1,depthWrite:true,depthTest:true});dustMaterial.name='Grass skills / opaque earthen dust';
    const particleMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95,metalness:0});particleMaterial.name='Grass skills / soil grains and grass flecks';
    const rootMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.92,metalness:0});rootMaterial.name='Grass skills / slender branching roots';
    cache={references:0,dustGeometry,particleGeometry,rootGeometry,dustMaterial,particleMaterial,rootMaterial};caches.set(THREE,cache);
  }
  cache.references++;let released=false;
  return {cache,release(){if(released)return;released=true;if(--cache.references===0){for(const key of ['dustGeometry','particleGeometry','rootGeometry','dustMaterial','particleMaterial','rootMaterial'])cache[key].dispose();caches.delete(THREE);}}};
}

// Terrain decoration only: no collision, actor transform, visibility decision or
// movement multiplier is owned here. Fixed pools share immutable source meshes.
export function createGrassSkillFX(THREE,camera){
  const {cache,release}=acquireAssets(THREE),group=new THREE.Group();group.name='Grass block / soil, roots and turf';group.visible=false;
  const transform=new THREE.Object3D(),color=new THREE.Color(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),batches=[],unique=new Map(),endedTurf=new Map(),rootSurfaces=new Map();
  let disposed=false,throwStarted=-Infinity,throwType=null;
  function batch(name,geometry,material,capacity){
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name=`Grass skill / ${name}`;mesh.count=0;mesh.visible=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3);mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.solid=false;mesh.raycast=()=>{};group.add(mesh);
    const pool={mesh,capacity};batches.push(pool);return pool;
  }
  const clouds=batch('fixed opaque dust spheres',cache.dustGeometry,cache.dustMaterial,MAX_EVENTS);
  const flecks=batch('soil grains and tiny grass blades',cache.particleGeometry,cache.particleMaterial,MAX_EVENTS*40);
  const roots=batch('terrain-following branching roots',cache.rootGeometry,cache.rootMaterial,MAX_EVENTS*Math.ceil(VEIL_SKILLS.rootsRange/.5)*10);
  const handGroup=new THREE.Group();handGroup.name='Grass block / small earth hand cue';handGroup.visible=false;camera.add(handGroup);
  const hand=new THREE.InstancedMesh(cache.particleGeometry,cache.particleMaterial,1);hand.name='Grass hand / earth clod';hand.userData.solid=false;hand.raycast=()=>{};hand.frustumCulled=false;hand.setColorAt(0,new THREE.Color('#7b6541'));handGroup.add(hand);
  const write=(pool,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,hex=0xffffff)=>{
    const index=pool.mesh.count;if(index>=pool.capacity)return;
    transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();pool.mesh.setMatrixAt(index,transform.matrix);color.setHex(hex);pool.mesh.setColorAt(index,color);pool.mesh.count++;
  };
  const clear=()=>{for(const pool of batches){pool.mesh.count=0;pool.mesh.visible=false;}group.visible=false;group.userData.activeEvents=0;};
  function playThrow(type,now){if(disposed||!['veil-dust','veil-roots'].includes(type)||!Number.isFinite(now)||now<0)return;throwType=type;throwStarted=now;}
  function cue(key,now){const type={c:'veil-dust',q:'veil-roots'}[typeof key==='string'?key.toLowerCase().replace(/^key/,''):''];if(type)playThrow(type,now);}
  const throwing=now=>!disposed&&Number.isFinite(now)&&now>=throwStarted&&now<throwStarted+.32;
  function reset(){clear();unique.clear();endedTurf.clear();rootSurfaces.clear();throwStarted=-Infinity;throwType=null;handGroup.visible=false;}
  function update(events,now,{viewer=null,showHand=false,reducedMotion=false,actors=null,groundHeight=null,reachable=null,terrainRevision=null}={}){
    if(disposed)return;clear();unique.clear();
    for(const [id,end]of endedTurf)if(Number.isFinite(now)&&now>=end)endedTurf.delete(id);
    if(Number.isFinite(now)&&now>=0&&Array.isArray(events))for(let index=0;index<Math.min(events.length,80);index++){
      const event=events[index];if(!validEvent(event,now)||unique.has(event.id))continue;unique.set(event.id,event);if(unique.size===MAX_EVENTS)break;
    }
    const floor=(x,z,referenceY)=>{
      if(typeof groundHeight!=='function')return null;
      try{const y=groundHeight(x,z,referenceY);return coordinate(y)&&Math.abs(y-referenceY)<=VEIL_SKILLS.rootsHeightTolerance+1e-7?y:null;}catch{return null;}
    };
    for(const [id]of rootSurfaces)if(!['veil-roots','veil-root-seed'].includes(unique.get(id)?.type))rootSurfaces.delete(id);
    function branch(output,ax,az,bx,bz,referenceA,referenceB,width,hex,allowed){
      const ay=floor(ax,az,referenceA),by=floor(bx,bz,referenceB),mx=(ax+bx)/2,mz=(az+bz)/2,my=floor(mx,mz,(referenceA+referenceB)/2);
      if(ay===null||by===null||my===null||Math.abs(ay-by)>VEIL_SKILLS.rootsHeightTolerance+1e-7||!allowed(ax,ay,az)||!allowed(mx,my,mz)||!allowed(bx,by,bz))return;
      // Split at the sampled midpoint so a small slope follows its support.
      for(const [x1,y1,z1,x2,y2,z2]of [[ax,ay,az,mx,my,mz],[mx,my,mz,bx,by,bz]]){
        direction.set(x2-x1,y2-y1,z2-z1);const length=direction.length();if(length<1e-6)continue;
        transform.quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/length));
        output.push({x:(x1+x2)/2,y:(y1+y2)/2+.085,z:(z1+z2)/2,q:transform.quaternion.toArray(),length,width,hex});
      }
    }
    function rootSurface(event,landing){
      const key=[event.round,event.fromX,event.fromY,event.fromZ,event.x,event.y,event.z,event.radius,terrainRevision].join('|'),cached=rootSurfaces.get(event.id);
      if(cached&&cached.key===key&&cached.groundHeight===groundHeight&&cached.reachable===reachable)return cached;
      const allowed=(x,y,z)=>{if(!landing||typeof reachable!=='function')return true;try{return reachable({...landing,y:landing.y-VEIL_SKILLS.rootsGroundOffset},{x,y,z})===true;}catch{return false;}};
      const surface={key,groundHeight,branches:[],blades:[]},dx=event.x-event.fromX,dz=event.z-event.fromZ,length=Math.hypot(dx,dz),segments=Math.max(1,Math.min(Math.ceil(VEIL_SKILLS.rootsRange/.5),Math.ceil((length-1e-8)/.5))),sideX=dz/length,sideZ=-dx/length;
      const reference=t=>event.fromY+(event.y-event.fromY)*t,point=(t,lateral=0)=>({x:event.fromX+dx*t+sideX*lateral,z:event.fromZ+dz*t+sideZ*lateral}),widthScale=event.radius/1.2;
      for(let index=0;index<segments;index++){
        const t0=index/segments,t1=(index+1)/segments,tc=(t0+t1)/2,a=point(t0),b=point(t1),mid=point(tc),left=point(tc+.12/length,-1.12*widthScale),right=point(tc-.12/length,1.12*widthScale);
        branch(surface.branches,a.x,a.z,b.x,b.z,reference(t0),reference(t1),1,0x6f4f31,allowed);
        for(const [endpoint,side]of [[left,-1],[right,1]]){
          const fork=point(tc,side*.64*widthScale),tip=point(tc-.14/length,side*1.08*widthScale);
          branch(surface.branches,mid.x,mid.z,endpoint.x,endpoint.z,reference(tc),reference(tc),.72,0x876440,allowed);
          branch(surface.branches,fork.x,fork.z,tip.x,tip.z,reference(tc),reference(tc),.48,0x9b7950,allowed);
        }
        const y=floor(mid.x,mid.z,reference(tc));if(y!==null&&allowed(mid.x,y,mid.z))surface.blades.push({x:mid.x,y:y+.12,z:mid.z,index});
      }
      surface.reachable=reachable;rootSurfaces.set(event.id,surface);return surface;
    }
    let rendered=0;
    for(const event of unique.values()){
      const age=now-event.startedAt,after=now-event.triggerAt,p=phase(event.id);if(after<0)continue;
      if(event.type==='veil-dust'){
        write(clouds,event.x,event.y,event.z,event.radius,event.radius,event.radius);
        for(let index=0;index<24;index++){
          const a=p+index*2.39996,r=event.radius*(.86+(index%4)*.045),rise=reducedMotion?.10:((after*.35+index*.11)%.8),s=.018+(index%3)*.008;
          write(flecks,event.x+Math.cos(a)*r,event.y-VEIL_SKILLS.dustCenterOffset+.085+rise,event.z+Math.sin(a)*r,s,s*.7,s,0,a,0,index%2?0x7b6544:0xb49b72);
        }
      }else if(event.type==='veil-roots'||event.type==='veil-root-seed'){
        const fade=clamp((event.endsAt-now)/.3),growth=reducedMotion?1:clamp(after/.18),width=.027*growth*fade;
        if(width<=0)continue;
        const surface=rootSurface(veilRootSegment(event),event.type==='veil-root-seed'?event:null);
        for(const value of surface.branches){
          const index=roots.mesh.count;if(index>=roots.capacity)break;
          transform.position.set(value.x,value.y,value.z);transform.quaternion.fromArray(value.q);transform.scale.set(width*value.width,value.length,width*value.width);transform.updateMatrix();roots.mesh.setMatrixAt(index,transform.matrix);color.setHex(value.hex);roots.mesh.setColorAt(index,color);roots.mesh.count++;
        }
        for(const value of surface.blades)write(flecks,value.x,value.y,value.z,.015,.075*growth*fade,.012,0,p+value.index,.25,value.index%2?0x7d9453:0x627c41);
      }else{
        if(endedTurf.has(event.id))continue;
        const source=Array.isArray(actors)?actors.find(actor=>actor?.id===event.sourceId):viewer?.id===event.sourceId?viewer:null;
        if(!source||source.alive!==true||source.grounded!==true||source.team!==event.team||![source.x,source.y??0,source.z].every(coordinate)){
          if(Array.isArray(actors)||source){endedTurf.set(event.id,event.endsAt);if(endedTurf.size>MAX_EVENTS)endedTurf.delete(endedTurf.keys().next().value);}continue;
        }
        const fade=clamp(age/.10)*clamp((event.endsAt-now)/.2),yaw=Number.isFinite(source.yaw)?source.yaw:0;
        for(let index=0;index<12;index++){
          const side=index%2?1:-1,back=.17+(index%6)*.12,dx=side*(.24+(index%3)*.06),x=source.x+Math.cos(yaw)*dx+Math.sin(yaw)*back,z=source.z-Math.sin(yaw)*dx+Math.cos(yaw)*back;
          const y=floor(x,z,source.y??0);if(y===null)continue;
          write(flecks,x,y+.105,z,.012,.045*fade,.008,0,yaw,reducedMotion?side*.12:side*(.15+age*.12),index%2?0x809d4f:0x648544);
        }
      }
      rendered++;
    }
    for(const pool of batches){pool.mesh.visible=pool.mesh.count>0;pool.mesh.instanceMatrix.needsUpdate=true;pool.mesh.instanceColor.needsUpdate=true;}
    group.visible=batches.some(pool=>pool.mesh.count>0);group.userData.activeEvents=group.visible?rendered:0;
    const age=now-throwStarted;handGroup.visible=!!(Number.isFinite(now)&&showHand&&throwType&&age>=0&&age<.24);
    if(handGroup.visible){const t=clamp(age/.24);handGroup.position.set(.22+t*.035,-.29+(reducedMotion?0:Math.sin(t*Math.PI)*.04),-.48-t*.12);handGroup.rotation.set(reducedMotion?0:-.2-t*.3,.2,-.1);transform.position.set(0,0,0);transform.rotation.set(.2,.3,.1);transform.scale.set(.065,.055,.065);transform.updateMatrix();hand.setMatrixAt(0,transform.matrix);hand.instanceMatrix.needsUpdate=true;}
  }
  function dispose(){if(disposed)return;disposed=true;reset();hand.dispose();handGroup.removeFromParent();group.removeFromParent();for(const pool of batches)pool.mesh.dispose();release();}
  reset();return {group,update,playThrow,cue,throwing,reset,dispose};
}
