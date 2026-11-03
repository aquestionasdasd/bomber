import { skillProjectilePosition } from './character-skills.js';
import { CHARACTER_DEFS, getCharacterSkill } from './abilities.js';

// Character-specific silhouettes. These are presentation only.
export const SKILL_LOOKS=Object.freeze({
 renko:{color:'#91c5ef',shape:'jet-wings'},duelist:{color:'#9df1ff',shape:'comet'},nope:{color:'#ff63c6',shape:'crossed-face'},mend:{color:'#8dffc2',shape:'petal'},echo:{color:'#ffe59c',shape:'bracket'},veil:{color:'#a8ed64',shape:'leaf'},ember:{color:'#ffae50',shape:'bolt'},frost:{color:'#b3edff',shape:'crystal'},duck:{color:'#ffe36b',shape:'feather'},cat:{color:'#ecddff',shape:'hourglass'},car:{color:'#92efff',shape:'chevron'},nobi:{color:'#ffe268',shape:'bell'},japan:{color:'#ff7996',shape:'banner'},cap:{color:'#ff976e',shape:'lens'},urchin:{color:'#71e6e4',shape:'spike'},onnara:{color:'#ffdb59',shape:'crown'}
});
const aliases={recon:'echo',heal:'mend',smoke:'duelist',updraft:'duelist',dash:'duelist',knives:'duelist',nope:'nope',mend:'mend',veil:'veil',ember:'ember',frost:'frost'};
export function skillCharacter(type){const id=String(type||'').split('-')[0];return SKILL_LOOKS[id]?id:aliases[id]||null;}
const finite=p=>p&&[p.x,p.y,p.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1000);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// Local emissive light, not a full-screen bloom pass: bright cores remain
// crisp, soft edges disappear continuously, and ordinary scene depth wins.
// Analytic profiles avoid image downloads, canvas textures and extra lights.
export const SKILL_RADIANCE=Object.freeze({events:60,impacts:32,trailSegments:8,burstLife:.72,near:2.5,far:90,visibilityChecks:768});
export function createSkillSpectacle(T){
 const group=new T.Group();group.name='Skill spectacle / pooled launch, trail and impact';
 const batches=[],geometries=new Set(),materials=new Set(),transform=new T.Object3D(),hits=[];
 let disposed=false,hitSequence=0;
 function batch(name,geometry,capacity,profile='motif'){
  const alpha=new T.InstancedBufferAttribute(new Float32Array(capacity),1);alpha.setUsage(T.DynamicDrawUsage);geometry.setAttribute('spectacleAlpha',alpha);geometries.add(geometry);
  const material=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.88,side:T.DoubleSide,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false});material.forceSinglePass=true;material.name='Skill radiance / '+profile;
  const profiles={
   motif:'float edge=1.0-smoothstep(0.18,0.86,length(vSpectacleUv-0.5)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),edge*0.38);',
   halo:'float r=length(vSpectacleUv-0.5)*2.0; float soft=exp(-r*r*6.0)*(1.0-smoothstep(0.65,1.0,r)); diffuseColor.a*=soft; diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),exp(-r*r*65.0)*0.75);',
   ring:'float r=length(vSpectacleUv-0.5)*2.0; float band=smoothstep(0.76,0.9,r)*(1.0-smoothstep(0.94,1.0,r)); diffuseColor.a*=band; diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),exp(-pow((r-0.925)*70.0,2.0))*0.55);',
   shard:'vec2 p=abs(vSpectacleUv-0.5)*2.0; diffuseColor.a*=pow(1.0-p.x,1.6)*(1.0-smoothstep(0.25,1.0,p.y)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),pow(1.0-p.x,8.0)*0.55);',
   trail:'float edge=sin(vSpectacleUv.x*3.14159265); diffuseColor.a*=edge*edge; diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),pow(edge,12.0)*0.45);'
  };
  material.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float spectacleAlpha; varying float vSpectacleAlpha; varying vec2 vSpectacleUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSpectacleAlpha=spectacleAlpha; vSpectacleUv=uv;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vSpectacleAlpha; varying vec2 vSpectacleUv;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vSpectacleAlpha;\n'+profiles[profile]);};
  material.customProgramCacheKey=()=> 'skill-radiance-v2-'+profile;materials.add(material);
  const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name=name;mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.userData.solid=false;mesh.renderOrder=3;group.add(mesh);
  const b={mesh,alpha,capacity};batches.push(b);return b;
 }
 function polygon(points){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return new T.ShapeGeometry(s);}
 const radial=(arms,outer,inner)=>Array.from({length:arms*2},(_,i)=>{const a=i*Math.PI/arms;return[Math.sin(a)*(i%2?inner:outer),Math.cos(a)*(i%2?inner:outer)];});
 const outlines={
 'jet-wings':[[-.8,.15],[-.6,.65],[-.24,.25],[0,.8],[.24,.25],[.6,.65],[.8,.15],[.3,-.3],[.15,-.7],[0,-.35],[-.15,-.7],[-.3,-.3]],
 comet:[[-.9,-.45],[-.15,.14],[0,.7],[.2,.15],[.8,0],[.2,-.16],[0,-.5],[-.15,-.15]],
 'crossed-face':[[-.65,.6],[-.2,.6],[0,.22],[.2,.6],[.65,.6],[.2,0],[.65,-.6],[.2,-.6],[0,-.22],[-.2,-.6],[-.65,-.6],[-.2,0]],
 petal:radial(5,.68,.28),bracket:[[-.65,.6],[-.2,.6],[-.2,.4],[-.43,.4],[-.43,-.4],[-.2,-.4],[-.2,-.6],[-.65,-.6]],
 leaf:[[0,.75],[.52,.2],[.38,-.32],[0,-.68],[-.4,-.28],[-.36,.22]],
 bolt:[[.05,.8],[-.57,-.02],[-.08,-.02],[-.23,-.8],[.58,.2],[.12,.2]],
 crystal:radial(6,.76,.18),feather:[[0,-.8],[-.4,-.2],[-.32,.4],[.08,.82],[.4,.48],[.35,-.1],[.12,-.5]],
 hourglass:[[-.55,.65],[.55,.65],[.3,.2],[.12,0],[.3,-.2],[.55,-.65],[-.55,-.65],[-.3,-.2],[-.12,0],[-.3,.2]],
 chevron:[[-.7,.12],[0,.68],[.7,.12],[.7,-.28],[0,.22],[-.7,-.28]],
 bell:[[-.65,-.35],[-.42,-.12],[-.36,.37],[-.14,.58],[-.14,.78],[.14,.78],[.14,.58],[.36,.37],[.42,-.12],[.65,-.35],[.2,-.35],[.13,-.58],[-.13,-.58],[-.2,-.35]],
 banner:[[-.55,-.7],[-.55,.7],[.55,.7],[.33,.38],[.55,.1],[-.36,.1],[-.36,-.7]],
 lens:radial(8,.65,.53),spike:radial(9,.78,.22),crown:[[-.7,.48],[-.42,.1],[0,.78],[.42,.1],[.7,.48],[.52,-.5],[-.52,-.5]]
 };
 const glyphs=Object.fromEntries(Object.entries(SKILL_LOOKS).map(([id,s])=>[id,batch('Skill motif / '+s.shape,polygon(outlines[s.shape]),96)]));
 const rings=batch('Skill shock rings',new T.RingGeometry(.76,1,48),192,'ring'),sparks=batch('Skill directional shards',new T.PlaneGeometry(1,1),768,'shard'),trails=batch('Skill projectile ribbons',new T.CylinderGeometry(1,1,1,8,1,true),480,'trail');
 const halos=batch('Skill soft radiance',new T.PlaneGeometry(2,2),256,'halo'),cores=batch('Skill luminous cores',new T.PlaneGeometry(2,2),192,'halo'),arcs=batch('Skill curved filaments',new T.RingGeometry(.76,1,24,1,0,Math.PI*1.35),192,'ring');
 const colors=Object.fromEntries(Object.entries(SKILL_LOOKS).map(([id,s])=>[id,new T.Color(s.color)]));
 const up=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3(),direction=new T.Vector3();
 function write(batch,p,sx,sy,sz,color,opacity,{ground=false,angle=0,viewer=null,end=null}={}){
  if(!finite(p)||opacity<=0||batch.mesh.count>=batch.capacity)return;
  transform.position.set(p.x,p.y,p.z);transform.rotation.set(ground?-Math.PI/2:0,0,angle);
  if(end){a.set(p.x,p.y,p.z);b.set(end.x,end.y,end.z);direction.subVectors(b,a);const length=direction.length();if(length<1e-5)return;transform.position.add(b).multiplyScalar(.5);transform.quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/length));sy=length;}
  else if(viewer&&!ground){transform.lookAt(viewer.x,(viewer.y||0)+1.6,viewer.z);transform.rotateZ(angle);}
  transform.scale.set(sx,sy,sz);transform.updateMatrix();const i=batch.mesh.count++;batch.mesh.setMatrixAt(i,transform.matrix);batch.mesh.setColorAt(i,color);batch.alpha.array[i]=clamp(opacity,0,1);
 }
 function impact(character,point,at,{kind='hit',own=false}={}){
  if(disposed||!SKILL_LOOKS[character]||!finite(point)||!Number.isFinite(at))return false;
  hits.push({id:++hitSequence,character,...point,at,kind,own});if(hits.length>SKILL_RADIANCE.impacts)hits.shift();return true;
 }
 function reset(){hits.length=0;for(const b of batches){b.mesh.count=0;b.mesh.visible=false;}group.visible=false;group.userData.activeEvents=0;group.userData.impacts=0;group.userData.visibilityChecks=0;}
 function update(events,now,{actors=[],viewer=null,visible=()=>true,reducedMotion=false,bursts=[]}={}){
  if(disposed)return;
  for(const b of batches){b.mesh.count=0;b.mesh.visible=false;}group.visible=false;if(!Number.isFinite(now))return;
  const seen=new Set(),list=[];
  for(const e of Array.isArray(events)?events:[]){if(!e||seen.has(e.id)||!finite(e)||!Number.isFinite(e.startedAt)||!Number.isFinite(e.endsAt)||now<e.startedAt||now>=e.endsAt||!skillCharacter(e.type))continue;seen.add(e.id);list.push(e);if(list.length===SKILL_RADIANCE.events)break;}
  let checks=0;const visibilityCache=new Map();
  const viewable=p=>{if(!finite(p)||viewer&&(Math.hypot(viewer.x-p.x,viewer.z-p.z)>=SKILL_RADIANCE.far||Math.hypot(viewer.x-p.x,(viewer.y||0)+1.6-p.y,viewer.z-p.z)<SKILL_RADIANCE.near))return false;const key=p.x+','+p.y+','+p.z;if(visibilityCache.has(key))return visibilityCache.get(key);if(checks>=SKILL_RADIANCE.visibilityChecks)return false;checks++;const result=!!visible(p);visibilityCache.set(key,result);return result;};
  // Wide translucent flares are conservative at a smoke/wall boundary. Test
  // their footprint as well as their centre, rather than expose a hidden edge.
  const areaVisible=(p,r)=>viewable(p)&&[[-1,0],[1,0],[0,-1],[0,1]].every(([x,z])=>viewable({x:p.x+x*r,y:p.y,z:p.z+z*r}));
  function light(p,r,color,alpha){if(areaVisible(p,r))write(halos,p,r,r,1,color,alpha,{viewer});}
  function bloom(id,p,age,duration,radius,ground=false){
   if(!viewable(p))return;const t=clamp(age/duration,0,1),fade=(1-t)**1.2,color=colors[id],ease=1-(1-t)**3,size=reducedMotion?radius*.5:radius*(.12+.88*ease),q={...p,y:p.y+(ground?.10:0)};
   light(q,(.32+radius*.48)*(1+t*.5),color,fade*.48);
   if(areaVisible(p,size)){
    write(rings,p,size,size,1,color,fade*.86,{ground,viewer});
    write(arcs,{...p,y:p.y+.025},size*.77,size*.77,1,color,fade*.65,{ground,viewer,angle:reducedMotion?0:t*.8});
   }
   if(areaVisible(q,.24))write(cores,q,.24*(1-t)+.025,.24*(1-t)+.025,1,color,fade*.85,{viewer});
   write(glyphs[id],{...p,y:p.y+(ground?.45:0)},.3+size*.12,.3+size*.12,1,color,fade*.62,{viewer,angle:reducedMotion?0:t*.24});
   if(!reducedMotion)for(let i=0;i<12;i++){const angle=i*Math.PI/6+.37,r=radius*(.12+.9*ease),q={x:p.x+Math.sin(angle)*r,y:p.y+.12+Math.sin(t*Math.PI)*(.18+(i%3)*.14),z:p.z+Math.cos(angle)*r};if(viewable(q))write(sparks,q,.06*(1-t)+.008,(.22+(i%3)*.1)*(1-t),1,color,fade*.8,{viewer,angle:-angle});}
  }
  for(const e of list){
   const id=skillCharacter(e.type),age=now-e.startedAt,actor=actors.find(a=>a.id===(e.targetId||e.sourceId));
   // Do not put a translucent sigil over a first-person camera, or leak a
   // concealed actor by drawing its head/feet effect through smoke or walls.
   const personal=e.targetId||e.radius===0&&!(e.flight>0),self=personal&&actor?.id===viewer?.id;
   if(age<.55&&!self&&e.sourceId!==viewer?.id&&(personal||e.triggerAt>e.startedAt||Math.hypot(e.x-e.fromX,e.z-e.fromZ)>.1)){const p=personal&&actor?{x:actor.x,y:(actor.y||0)+1.1,z:actor.z}:finite({x:e.fromX,y:e.fromY,z:e.fromZ})?{x:e.fromX,y:e.fromY+.15,z:e.fromZ}:e;bloom(id,p,age,.55,1.35);}
   if(e.flight>0&&age<e.flight&&!reducedMotion){
    const point=skillProjectilePosition(e,now);if(point&&viewable(point)){
     light(point,.32,colors[id],.62);write(cores,point,.085,.085,1,colors[id],1,{viewer});
     write(glyphs[id],point,.18,.18,1,colors[id],.65,{viewer,angle:age*3});
     for(let i=0;i<SKILL_RADIANCE.trailSegments;i++){const t0=Math.max(e.startedAt,now-(i+1)*.024),t1=Math.max(e.startedAt,now-i*.024),from=skillProjectilePosition(e,t0),to=skillProjectilePosition(e,t1),f=1-i/SKILL_RADIANCE.trailSegments;if(from&&to&&viewable(from)&&viewable(to))write(trails,from,.055*f,1,.055*f,colors[id],.72*f*f,{end:to});}
    }
   }
   const trigger=e.triggerAt??e.startedAt,after=now-trigger;
   if(!personal&&after>=0&&after<.65)bloom(id,{x:e.x,y:e.y+.12,z:e.z},after,.65,clamp(e.radius||1.4,1.4,3.8),e.y<1||e.type.includes('seeds')||e.type.includes('solder')||e.type.includes('stitch'));
   // Quiet perimeter glints sustain the field's own silhouette after its
   // opening. No opaque interior, altered radius or enemy tracking is added.
   if(!personal&&e.radius>0&&after>=.65&&!reducedMotion){const radius=Math.min(e.radius,20),fade=clamp((e.endsAt-now)/.5,0,1);for(let i=0;i<6;i++){const angle=i*Math.PI/3+now*.1,p={x:e.x+Math.sin(angle)*radius,y:e.y+.10,z:e.z+Math.cos(angle)*radius};if(viewable(p))write(sparks,p,.03,.14,1,colors[id],fade*(.18+.12*Math.sin(now*2+i)),{viewer,angle:-angle});}}
   // A restrained floating motif keeps persistent skills legible between
   // their large opening and impact, without filling the play space.
   if(age>=.55&&actor?.alive&&personal&&!self){const q={x:actor.x,y:(actor.y||0)+2.15-(actor.crouch||0)*.55,z:actor.z};if(viewable(actor)&&viewable(q))write(glyphs[id],q,.26,.26,1,colors[id],.42,{viewer});}
  }
  // Robot bursts use already-authoritative presentation receipts. No extra
  // events are sent and no AI, damage or sound is generated by this layer.
  for(const e of (Array.isArray(bursts)?bursts:[]).slice(-32)){if(!finite(e)||!Number.isFinite(e.at))continue;const age=now-e.at;if(age<0||age>=.55||!['deploy','blast','destroy','fuse','cut','recycle'].includes(e.type))continue;bloom('ember',e,age,.55,e.type==='blast'?1.8:.7,true);}
  for(let i=hits.length-1;i>=0;i--){const h=hits[i],age=now-h.at;if(age<0||age>SKILL_RADIANCE.burstLife){hits.splice(i,1);continue;}bloom(h.character,h,age,SKILL_RADIANCE.burstLife,h.kind==='heal'?1.15:.95);}
  for(const b of batches){b.mesh.visible=b.mesh.count>0;b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;b.alpha.needsUpdate=true;}
  group.userData.activeEvents=list.length;group.userData.impacts=hits.length;group.userData.visibilityChecks=checks;group.visible=batches.some(b=>b.mesh.count>0);
 }
 function dispose(){if(disposed)return;disposed=true;reset();group.removeFromParent();for(const b of batches)b.mesh.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
 reset();return{group,update,impact,reset,dispose};
}

// Only accepted event/host receipt calls enter this feedback. No cooldown,
// inventory or damage is predicted by this presentation controller.
export function createSkillFeedback(doc){
 const seen=new Set();let cast=null,hit=null;
 function note(kind,key,character,at,label=''){
  if(!SKILL_LOOKS[character]||!Number.isFinite(at)||seen.has(key))return;
  seen.add(key);while(seen.size>128)seen.delete(seen.values().next().value);
  const item={at,character,label};if(kind==='cast')cast=item;else hit={...item,kind};
 }
 function observe(events,now,ownId){for(const e of events){if(e.sourceId!==ownId||now-e.startedAt<0||now-e.startedAt>.2)continue;const character=skillCharacter(e.type);if(!character)continue;const def=['c','q','e','x'].map(k=>getCharacterSkill(character,k)).find(d=>d?.type===e.type);note('cast','cast:'+e.id,character,e.startedAt,def?.name||CHARACTER_DEFS[character]?.ultName||'スキル');if(e.targetId&&e.targetId!==ownId&&['mend-heal','duck-seal','cat-pluck','nobi-tag','nobi-brake','japan-levy','cap-lock','urchin-jam','urchin-disarm','onnara-tax'].includes(e.type))note(e.type==='mend-heal'?'heal':'hit','target:'+e.id,character,e.startedAt);}}
 function render(now,{active=true,reducedMotion=false}={}){
  for(const[k,item,duration]of[['cast',cast,.85],['hit',hit,.65]]){const el=doc?.getElementById?.('skill-'+k+'-feedback');if(!el)continue;const age=item?now-item.at:Infinity,show=active&&age>=0&&age<duration;el.hidden=!show;if(!show)continue;el.style.opacity=String(reducedMotion?1:Math.min(1,(duration-age)/.2));el.style.color=SKILL_LOOKS[item.character].color;el.textContent=k==='cast'?item.label+' 発動':item.kind==='heal'?'✦ 回復':'✦ スキル命中';}
 }
 function reset(){cast=hit=null;seen.clear();render(0,{active:false});}
 return{note,observe,render,reset};
}
