import { skillProjectilePosition } from './character-skills.js';
import { CHARACTER_DEFS, getCharacterSkill } from './abilities.js';

// Fifteen silhouettes, not fifteen recolors. These are presentation only.
export const SKILL_LOOKS=Object.freeze({
 duelist:{color:'#9df1ff',shape:'comet'},nope:{color:'#ff63c6',shape:'crossed-face'},mend:{color:'#8dffc2',shape:'petal'},echo:{color:'#ffe59c',shape:'bracket'},veil:{color:'#a8ed64',shape:'leaf'},ember:{color:'#ffae50',shape:'bolt'},frost:{color:'#b3edff',shape:'crystal'},duck:{color:'#ffe36b',shape:'feather'},cat:{color:'#ecddff',shape:'hourglass'},car:{color:'#92efff',shape:'chevron'},nobi:{color:'#ffe268',shape:'bell'},japan:{color:'#ff7996',shape:'banner'},cap:{color:'#ff976e',shape:'lens'},urchin:{color:'#71e6e4',shape:'spike'},onnara:{color:'#ffdb59',shape:'crown'}
});
const aliases={recon:'echo',heal:'mend',smoke:'duelist',updraft:'duelist',dash:'duelist',knives:'duelist',nope:'nope',mend:'mend',veil:'veil',ember:'ember',frost:'frost'};
export function skillCharacter(type){const id=String(type||'').split('-')[0];return SKILL_LOOKS[id]?id:aliases[id]||null;}
const finite=p=>p&&[p.x,p.y,p.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1000);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function createSkillSpectacle(T){
 const group=new T.Group();group.name='Skill spectacle / pooled launch, trail and impact';
 const batches=[],geometries=new Set(),materials=new Set(),transform=new T.Object3D(),hits=[];
 let disposed=false,hitSequence=0;
 function batch(name,geometry,capacity){
  const alpha=new T.InstancedBufferAttribute(new Float32Array(capacity),1);alpha.setUsage(T.DynamicDrawUsage);geometry.setAttribute('spectacleAlpha',alpha);geometries.add(geometry);
  const material=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.88,side:T.DoubleSide,depthWrite:false,depthTest:true});material.forceSinglePass=true;
  material.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float spectacleAlpha; varying float vSpectacleAlpha;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSpectacleAlpha=spectacleAlpha;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vSpectacleAlpha;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vSpectacleAlpha;');};
  material.customProgramCacheKey=()=> 'skill-spectacle-alpha-v1';materials.add(material);
  const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name=name;mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.userData.solid=false;mesh.renderOrder=3;group.add(mesh);
  const b={mesh,alpha,capacity};batches.push(b);return b;
 }
 function polygon(points){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return new T.ShapeGeometry(s);}
 const radial=(arms,outer,inner)=>Array.from({length:arms*2},(_,i)=>{const a=i*Math.PI/arms;return[Math.sin(a)*(i%2?inner:outer),Math.cos(a)*(i%2?inner:outer)];});
 const outlines={
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
 const rings=batch('Skill shock rings',new T.RingGeometry(.90,1,40),192),sparks=batch('Skill directional shards',new T.PlaneGeometry(1,1),768),trails=batch('Skill projectile ribbons',new T.CylinderGeometry(1,1,1,5),240);
 const colors=Object.fromEntries(Object.entries(SKILL_LOOKS).map(([id,s])=>[id,new T.Color(s.color)]));
 const up=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3(),direction=new T.Vector3();
 function write(batch,p,sx,sy,sz,color,opacity,{ground=false,angle=0,viewer=null,end=null}={}){
  if(!finite(p)||opacity<=0||batch.mesh.count>=batch.capacity)return;
  transform.position.set(p.x,p.y,p.z);transform.rotation.set(ground?-Math.PI/2:0,0,angle);
  if(end){a.set(p.x,p.y,p.z);b.set(end.x,end.y,end.z);direction.subVectors(b,a);const length=direction.length();if(length<1e-5)return;transform.position.add(b).multiplyScalar(.5);transform.quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/length));sy=length;}
  else if(viewer&&!ground){transform.rotation.y=Math.atan2(viewer.x-p.x,viewer.z-p.z);transform.rotateZ(angle);}
  transform.scale.set(sx,sy,sz);transform.updateMatrix();const i=batch.mesh.count++;batch.mesh.setMatrixAt(i,transform.matrix);batch.mesh.setColorAt(i,color);batch.alpha.array[i]=clamp(opacity,0,1);
 }
 function impact(character,point,at,{kind='hit',own=false}={}){
  if(disposed||!SKILL_LOOKS[character]||!finite(point)||!Number.isFinite(at))return false;
  hits.push({id:++hitSequence,character,...point,at,kind,own});if(hits.length>32)hits.shift();return true;
 }
 function reset(){hits.length=0;for(const b of batches){b.mesh.count=0;b.mesh.visible=false;}group.visible=false;group.userData.activeEvents=0;group.userData.impacts=0;}
 function update(events,now,{actors=[],viewer=null,visible=()=>true,reducedMotion=false}={}){
  if(disposed)return;
  for(const b of batches){b.mesh.count=0;b.mesh.visible=false;}group.visible=false;if(!Number.isFinite(now))return;
  const seen=new Set(),list=[];
  for(const e of Array.isArray(events)?events:[]){if(!e||seen.has(e.id)||!finite(e)||!Number.isFinite(e.startedAt)||now<e.startedAt||now>=e.endsAt||!skillCharacter(e.type))continue;seen.add(e.id);list.push(e);if(list.length===60)break;}
  const viewable=p=>finite(p)&&(!viewer||Math.hypot(viewer.x-p.x,viewer.z-p.z)<90&&Math.hypot(viewer.x-p.x,(viewer.y||0)+1.6-p.y,viewer.z-p.z)>=2.5)&&visible(p);
  function bloom(id,p,age,duration,radius,ground=false){
   if(!viewable(p))return;const t=clamp(age/duration,0,1),fade=(1-t)**.7,color=colors[id],size=reducedMotion?radius*.5:radius*(.22+.78*t);
   write(rings,p,size,size,1,color,fade*.7,{ground,viewer});
   write(rings,{...p,y:p.y+.035},size*.67,size*.67,1,color,fade*.32,{ground,viewer,angle:.35});
   write(glyphs[id],{...p,y:p.y+(ground?.55:0)},.44+size*.18,.44+size*.18,1,color,fade,{viewer,angle:reducedMotion?0:t*.35});
   if(!reducedMotion)for(let i=0;i<8;i++){const angle=i*Math.PI/4+(.3*age),r=radius*(.25+.8*t),q={x:p.x+Math.sin(angle)*r,y:p.y+(ground?.15:0)+Math.cos(angle)*r*.4,z:p.z+Math.cos(angle)*r*.45};write(sparks,q,.035*(1-t),.25*(1-t),1,color,fade*.8,{viewer,angle:-angle});}
  }
  for(const e of list){
   const id=skillCharacter(e.type),age=now-e.startedAt,actor=actors.find(a=>a.id===(e.targetId||e.sourceId));
   // Do not put a translucent sigil over a first-person camera, or leak a
   // concealed actor by drawing its head/feet effect through smoke or walls.
   const personal=e.targetId||e.radius===0&&!(e.flight>0),self=personal&&actor?.id===viewer?.id;
   if(age<.55&&!self&&e.sourceId!==viewer?.id){const p=personal&&actor?{x:actor.x,y:(actor.y||0)+1.1,z:actor.z}:finite({x:e.fromX,y:e.fromY,z:e.fromZ})?{x:e.fromX,y:e.fromY+.15,z:e.fromZ}:e;bloom(id,p,age,.55,1.35);}
   if(e.flight>0&&age<e.flight&&!reducedMotion){
    const point=skillProjectilePosition(e,now);if(point&&viewable(point)){
     write(glyphs[id],point,.26,.26,1,colors[id],.9,{viewer,angle:age*3});
     for(let i=0;i<6;i++){const t0=Math.max(e.startedAt,now-(i+1)*.035),t1=Math.max(e.startedAt,now-i*.035),from=skillProjectilePosition(e,t0),to=skillProjectilePosition(e,t1);if(from&&to&&viewable({x:(from.x+to.x)/2,y:(from.y+to.y)/2,z:(from.z+to.z)/2}))write(trails,from,.035*(1-i/7),1,.035*(1-i/7),colors[id],.75*(1-i/7),{end:to});}
    }
   }
   const trigger=e.triggerAt??e.startedAt,after=now-trigger;
   if(e.flight>0&&after>=0&&after<.65)bloom(id,{x:e.x,y:e.y+.12,z:e.z},after,.65,clamp(e.radius||1.4,1.4,3.8),e.y<1||e.type.includes('seeds')||e.type.includes('solder')||e.type.includes('stitch'));
   // A restrained floating motif keeps persistent skills legible between
   // their large opening and impact, without filling the play space.
   if(age>=.55&&actor?.alive&&personal&&!self&&viewable(actor)){const q={x:actor.x,y:(actor.y||0)+2.15-(actor.crouch||0)*.55,z:actor.z};write(glyphs[id],q,.26,.26,1,colors[id],.42,{viewer});}
  }
  for(let i=hits.length-1;i>=0;i--){const h=hits[i],age=now-h.at;if(age<0||age>.65){hits.splice(i,1);continue;}bloom(h.character,h,age,.65,h.kind==='heal'?1.15:.95);}
  for(const b of batches){b.mesh.visible=b.mesh.count>0;b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;b.alpha.needsUpdate=true;}
  group.userData.activeEvents=list.length;group.userData.impacts=hits.length;group.visible=batches.some(b=>b.mesh.count>0);
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
