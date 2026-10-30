import { isLobbedSkill, validThrowFlight } from './skill-throw.js';
import { getCharacterSkill, NOBI_SKILLS, URCHIN_SKILLS, ONNARA_SKILLS, VEIL_SKILLS } from './abilities.js';
import { skillProjectilePosition } from './character-skills.js';
import { CHARACTER_HANDS } from './viewmodel.js';

// Only aimed throws/placements. Targeted disarms, cleansing and body charges
// keep their existing presentation and inputs. Colors identify the held item.
export const PREPARED_SKILL_PROPS=Object.freeze(Object.fromEntries([
 ['cap-lens','#ffbf70','ball'],['cap-cluster-heal','#73ffad','ball'],['cap-cluster-damage','#ff745c','ball'],['cap-bank-grenade','#79e7ee','ball'],['cap-magazine-grenade','#c49aff','ball'],
 ['nobi-bell','#ffe166','bell'],['nobi-whisker','#66d9ff','whisker'],
 ['nobi-toolbox','#ff934a','toolbox'],['nobi-collar','#c09aff','collar'],
 ['onnara-orb','#64ffe0','gem'],['urchin-gloom','#467fff','wave'],
 ['duck-pad','#bcf34d','ball'],['duck-shield','#ffcb49','ball'],
 ['japan-border','#ff6388','ball'],['veil-root-seed','#8acb5a','ball'],
].map(([type,color,shape])=>[type,Object.freeze({color,shape})])));
export function preparedSkillType(character,key){const type=character==='cap'&&key==='x'?'cap-magazine-grenade':character==='nobi'&&key==='x'?'nobi-collar':getCharacterSkill(character,key)?.type;return Object.hasOwn(PREPARED_SKILL_PROPS,type)?type:null;}
const caches=new WeakMap();
export function acquireSkillProps(T){
 let c=caches.get(T);
 if(!c){
  const geometries=new Set(),materials=new Set(),geo=g=>(geometries.add(g),g);
  const sphere=geo(new T.SphereGeometry(.12,16,10)),line=geo(new T.BoxGeometry(.3,.025,.025)),ring=geo(new T.TorusGeometry(1,.018,6,40)),box=geo(new T.BoxGeometry(.35,.25,.25)),gem=geo(new T.OctahedronGeometry(.16)),wave=geo(new T.SphereGeometry(1,20,12)),spine=geo(new T.ConeGeometry(.045,.24,5));
  const palette={};for(const [type,s]of Object.entries(PREPARED_SKILL_PROPS)){palette[type]=new T.MeshBasicMaterial({color:s.color,depthTest:true,depthWrite:true});materials.add(palette[type]);}
  const white=new T.MeshBasicMaterial({color:'#fff4df'}),dark=new T.MeshBasicMaterial({color:'#062b43',transparent:true,opacity:.76,depthWrite:false}),wire=new T.MeshBasicMaterial({color:'#35a5ac',wireframe:true,transparent:true,opacity:.45,depthWrite:false});[white,dark,wire].forEach(m=>materials.add(m));
  c={references:0,geometries,materials,create(type){
   const s=PREPARED_SKILL_PROPS[type];if(!s)return null;
   const root=new T.Group(),m=palette[type];root.name='Skill prop / '+type;root.userData.skillType=type;root.userData.color=s.color;root.userData.shape=s.shape;
   const add=(g,material=m,p=[0,0,0],scale=[1,1,1])=>{const o=new T.Mesh(g,material);o.position.set(...p);o.scale.set(...scale);root.add(o);return o;};
   if(s.shape==='bell'){add(sphere);add(ring,m,[0,-.12,0],[.2,.2,.2]).rotation.x=Math.PI/2;}
   else if(s.shape==='whisker'){for(const side of[-1,1])for(let i=-1;i<=1;i++){const w=add(line,m,[side*.2,i*.07,0]);w.rotation.z=side*i*.2;}}
   else if(s.shape==='toolbox'){add(box);for(const side of[-1,1])add(line,white,[0,.16,0]).rotation.z=side*.8;}
   else if(s.shape==='collar'){for(const side of[-1,1])add(line,m,[side*.13,0,0],[1.5,1,1]).rotation.z=side*.75;}
   else if(s.shape==='gem'){add(gem);add(ring,m,[0,0,0],[.21,.21,.21]);}
   else if(s.shape==='wave'){
    add(wave,dark,[0,0,0],[1,1,.42]);add(wave,wire,[0,0,0],[1.04,1.04,.55]);add(ring,m);
    const spikes=new T.InstancedMesh(spine,m,8),pose=new T.Object3D();spikes.frustumCulled=false;for(let i=0;i<8;i++){const a=i*Math.PI/4;pose.position.set(Math.cos(a),Math.sin(a),0);pose.rotation.z=a-Math.PI/2;pose.scale.setScalar(1.7);pose.updateMatrix();spikes.setMatrixAt(i,pose.matrix);}root.add(spikes);
   }else{add(sphere,m,[0,0,0],[1.25,1.25,1.25]);add(ring,white,[0,0,0],[.16,.16,.16]).rotation.x=Math.PI/2;}
   root.traverse(o=>{o.raycast=()=>{};o.userData.solid=false;if(o.isMesh)o.frustumCulled=false;});return root;
  }};caches.set(T,c);
 }
 c.references++;let done=false;return{create:c.create,dispose(){if(done)return;done=true;if(!--c.references){c.geometries.forEach(g=>g.dispose());c.materials.forEach(m=>m.dispose());caches.delete(T);}}};
}

const coordinate=n=>Number.isFinite(n)&&Math.abs(n)<=1000;
const disposeProp=root=>{root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});root.removeFromParent();};
function validEvent(e,now,round){return e&&Object.hasOwn(PREPARED_SKILL_PROPS,e.type)&&['id','type','team','sourceId','round','fromX','fromY','fromZ','x','y','z','startedAt','triggerAt','endsAt','flight','radius'].every(k=>Object.hasOwn(e,k))&&typeof e.id==='string'&&new RegExp('^skill-'+e.type+'-[1-9][0-9]{0,14}$').test(e.id)&&['blue','red'].includes(e.team)&&typeof e.sourceId==='string'&&e.sourceId.length>0&&e.sourceId.length<=64&&Number.isSafeInteger(e.round)&&e.round===round&&[e.x,e.y,e.z,e.fromX,e.fromY,e.fromZ].every(coordinate)&&[e.startedAt,e.triggerAt,e.endsAt,e.flight,e.radius].every(n=>Number.isFinite(n)&&n>=0)&&e.radius<=30&&e.endsAt>e.startedAt&&now>=e.startedAt&&now<e.endsAt&&(isLobbedSkill(e.type)?validThrowFlight(e):e.type==='urchin-gloom'?e.flight===URCHIN_SKILLS.gloomRange/URCHIN_SKILLS.gloomSpeed:e.type.startsWith('nobi-')?e.flight===NOBI_SKILLS.throwFlight:e.type==='onnara-orb'?e.flight===0||e.flight===ONNARA_SKILLS.orbCameraDuration:e.flight===0);}
export function createPreparedSkillFX(T,camera){
 const assets=acquireSkillProps(T),group=new T.Group(),hand=new T.Group(),props=new Map(),flights=new Map();group.name='Prepared skills / confirmed flying items';hand.name='Prepared skills / holding hand';camera.add(hand);hand.visible=false;
 for(const type of Object.keys(PREPARED_SKILL_PROPS))props.set(type,assets.create(type));
 const glove=new T.MeshBasicMaterial({color:'#ffffff'}),sleeve=new T.MeshBasicMaterial({color:'#53636b'}),skin=new T.SphereGeometry(1,12,8),arm=new T.CapsuleGeometry(.033,.22,4,10);
 const palm=new T.Mesh(skin,glove);palm.scale.set(.062,.027,.065);palm.position.set(0,-.105,.02);hand.add(palm);
 const wrist=new T.Mesh(arm,sleeve);wrist.position.set(.065,-.19,.15);wrist.rotation.set(-.6,0,-.45);hand.add(wrist);
 for(let i=0;i<4;i++){const finger=new T.Mesh(skin,glove);finger.scale.set(.011,.023,.043);finger.position.set(-.043+i*.028,-.082,-.016);hand.add(finger);}
 hand.traverse(o=>{o.raycast=()=>{};o.userData.solid=false;});
 let disposed=false,held=null,releasedAt=-Infinity,origin=null,releaseType=null,sourceId=null,releaseRound=null;
 function prop(type){if(!props.has(type))props.set(type,assets.create(type));return props.get(type);}
 function release(type,now,owner,round){if(!Object.hasOwn(PREPARED_SKILL_PROPS,type)||!Number.isFinite(now))return;releasedAt=now;releaseType=type;sourceId=owner;releaseRound=round;camera.updateWorldMatrix(true,false);origin=hand.localToWorld(new T.Vector3());}
 function throwing(now){return Number.isFinite(now)&&now>=releasedAt&&now<releasedAt+.24;}
 function clearHand(){if(held)held.removeFromParent();held=null;hand.visible=false;}
 function reset(){clearHand();for(const f of flights.values())disposeProp(f);flights.clear();group.visible=false;releasedAt=-Infinity;origin=null;releaseType=null;}
 function update(events,now,{armedType=null,character='duelist',active=false,round=0,reducedMotion=false,visible=()=>true}={}){
  if(disposed)return;
  clearHand();if(active&&Number.isFinite(now)&&Object.hasOwn(PREPARED_SKILL_PROPS,armedType)){
   held=prop(armedType);hand.add(held);held.scale.setScalar(armedType==='urchin-gloom'?.15:1);held.rotation.set(0,0,0);hand.visible=true;hand.position.set(.24,-.17,-.6);hand.rotation.set(-.12,.15,-.12);glove.color.set((CHARACTER_HANDS[character]||CHARACTER_HANDS.duelist)[0]);
  }
  const seen=new Set();if(Number.isFinite(now)&&now>=0)for(const e of(Array.isArray(events)?events:[]).slice(0,20)){
   if(!validEvent(e,now,round)||seen.has(e.id))continue;
   const delayed=e.type==='urchin-gloom',start=delayed?e.triggerAt:e.startedAt,duration=e.flight||.24,age=now-start;if(age<0||age>=duration)continue;seen.add(e.id);
   let o=flights.get(e.id);if(!o){o=assets.create(e.type);flights.set(e.id,o);group.add(o);}const t=Math.min(1,age/duration);
   const movingOrb=e.type==='onnara-orb'&&e.flight===ONNARA_SKILLS.orbCameraDuration;let p=movingOrb?{x:e.x,y:e.y,z:e.z}:e.flight?skillProjectilePosition(e,now):{x:e.fromX+(e.x-e.fromX)*t,y:e.fromY+(e.y+ (e.type==='onnara-orb'?1.65:.12)-e.fromY)*t+Math.sin(t*Math.PI)*.35,z:e.fromZ+(e.z-e.fromZ)*t};
   if(!p||![p.x,p.y,p.z].every(coordinate)){o.visible=false;continue;}
   // Local hand origin blends into the existing authoritative curve; it never
   // changes target, collision, delay or gameplay. Late joins skip this blend.
   if(!movingOrb&&origin&&e.sourceId===sourceId&&e.round===releaseRound&&e.type===releaseType&&Math.abs(e.startedAt-releasedAt)<.001&&age<.08){const w=1-age/.08;p={x:p.x+(origin.x-e.fromX)*w,y:p.y+(origin.y-e.fromY)*w,z:p.z+(origin.z-e.fromZ)*w};}
   o.position.set(p.x,p.y,p.z);o.scale.setScalar(delayed?e.radius:1);if(delayed)o.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(e.x-e.fromX,e.y-e.fromY,e.z-e.fromZ).normalize());else o.rotation.set(0,reducedMotion?0:age*2,0);o.visible=visible(p,e)!==false;
  }
  for(const[id,o]of flights)if(!seen.has(id)){disposeProp(o);flights.delete(id);}group.visible=flights.size>0;group.userData.activeFlights=flights.size;
 }
 function dispose(){if(disposed)return;disposed=true;reset();for(const p of props.values())disposeProp(p);props.clear();hand.removeFromParent();group.removeFromParent();assets.dispose();glove.dispose();sleeve.dispose();skin.dispose();arm.dispose();}
 return{group,hand,release,throwing,update,reset,dispose};
}
