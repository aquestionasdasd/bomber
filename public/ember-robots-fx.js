import {ROBOT_TYPES as TYPES,ROBOT_RULES,ROBOT_SKILLS} from './ember-robots-config.js';
// Bounded procedural prefabs, shared geometry/materials and reusable beam pool.
// Every material participates in ordinary world depth; smoke visibility is
// supplied by the same game callback as other non-recon skill effects.
export function createRobotFX(T){
 const group=new T.Group(),hand=new T.Group(),preview=new T.Group();group.name='Ember / robot army';hand.name='Ember / robot preview hand';preview.name='Ember / deployment preview';group.add(preview);
 const cube=new T.BoxGeometry(1,1,1),sphere=new T.SphereGeometry(1,8,6),cone=new T.ConeGeometry(1,1,6),ring=new T.TorusGeometry(1,.08,4,16);
 const mats={metal:new T.MeshStandardMaterial({color:'#677e88',roughness:.65,metalness:.6}),dark:new T.MeshStandardMaterial({color:'#25353d',roughness:.8}),blue:new T.MeshBasicMaterial({color:'#45ccff'}),red:new T.MeshBasicMaterial({color:'#ff5148'}),white:new T.MeshBasicMaterial({color:'#d7fff7'}),yellow:new T.MeshBasicMaterial({color:'#ffca57'}),ghost:new T.MeshBasicMaterial({color:'#6affbf',wireframe:true}),bad:new T.MeshBasicMaterial({color:'#ff6b59',wireframe:true})};
 Object.values(mats).forEach(m=>{m.depthTest=true;m.depthWrite=true;});
 function model(type){const g=new T.Group();g.name='Robot / '+type;const parts={legs:[],arms:[],rotors:[],blades:[]};g.userData.parts=parts;
  const add=(geo,m,p,s)=>{const o=new T.Mesh(geo,m);o.position.set(...p);o.scale.set(...s);o.raycast=()=>{};g.add(o);return o;},box=(p,s,m=mats.metal)=>add(cube,m,p,s);
  const wheels=(n=4)=>{for(let i=0;i<n;i++){const side=i%2?1:-1,z=(Math.floor(i/2)-(n/4-.5))*.35;const leg=box([side*.29,.14,z],[.12,.18,.16],mats.dark);parts.legs.push(leg);}};
  let lamp;
  if(['assault','production'].includes(type)){
   box([0,.8,0],[1.65,1.6,1.35]);box([0,.62,-.7],[1.25,.95,.06],mats.dark);for(let i=0;i<4;i++)box([0,.3+i*.2,-.74],[1.15,.06,.04]);box([0,.12,-.9],[1.25,.1,.7],mats.dark);
   for(const side of[-1,1]){parts.arms.push(box([side*.9,1.3,-.3],[.13,.7,.14],mats.yellow));box([side*.95,1.7,0],[.12,.15,.9]);}wheels(6);lamp=box([0,1.7,-.65],[.8,.09,.09]);
  }else if(type==='supervisor'){
   box([0,1,0],[.65,.65,.4]);box([0,1.5,0],[.42,.33,.38]);for(const side of[-1,1]){parts.legs.push(box([side*.22,.4,0],[.18,.65,.2]));parts.arms.push(box([side*.48,.95,-.15],[.2,.65,.2]));box([side*.48,.75,-.4],[.1,.12,.6],mats.dark);}box([.22,1.85,0],[.035,.45,.035]);lamp=box([0,1.53,-.2],[.31,.08,.04]);
  }else if(type==='shield'){
   box([0,.25,0],[.9,.4,.65]);box([0,.85,-.2],[1.44,1.65,.18]);box([0,1.1,-.31],[.7,.14,.035],mats.dark);wheels(4);lamp=box([0,1.58,-.31],[1.1,.08,.04]);
  }else if(['flyer','guard','repair'].includes(type)){
   box([0,.2,0],[.42,.3,.4]);for(const side of[-1,1]){box([side*.28,.25,0],[.3,.04,.08]);parts.rotors.push(add(ring,mats.dark,[side*.4,.28,0],[.22,.22,.22]));parts.rotors.at(-1).rotation.x=Math.PI/2;}box([0,.05,-.3],[.08,.09,.4],mats.dark);if(type==='repair'){box([0,.39,0],[.22,.05,.06],mats.white);box([0,.39,0],[.06,.05,.22],mats.white);}lamp=box([0,.2,-.22],[.14,.09,.04]);
  }else if(type==='turret'){
   box([0,.2,0],[.65,.35,.6]);const gun=box([0,.65,-.18],[.4,.35,.6]);parts.arms.push(gun);box([0,.68,-.65],[.12,.12,.5],mats.dark);wheels();lamp=box([0,.88,-.2],[.18,.08,.06]);
  }else{
   const scale=type==='dismantler'?1.5:1;box([0,.23*scale,0],[.45*scale,.3*scale,.48*scale]);
   for(let i=0;i<6;i++){const side=i%2?1:-1,z=(Math.floor(i/2)-1)*.2*scale;parts.legs.push(box([side*.3*scale,.14*scale,z],[.25*scale,.09*scale,.08*scale]));}
   if(type==='crab')for(const side of[-1,1]){parts.arms.push(box([side*.3,.22,-.4],[.16,.14,.4]));box([side*.22,.23,-.61],[.13,.12,.1]);}
   if(['dismantler','cutter','fragment'].includes(type)){const blade=add(ring,mats.white,[0,.24*scale,-.38*scale],[.23*scale,.23*scale,.23*scale]);parts.blades.push(blade);}
   if(type==='wire'){box([0,.4,0],[.04,.4,.04]);add(sphere,mats.yellow,[0,.2,0],[.17,.17,.17]);}
   lamp=add(sphere,mats.blue,[0,.42*scale,0],[.1,.075,.1]);
  }
  parts.lamp=lamp;g.traverse(o=>{o.frustumCulled=false;o.raycast=()=>{};});return g;
 }
 const active=new Map(),free=new Map(),seenAudio=new Set(),beams=[],batches=new Map(),centre=new T.Vector3();let handModel=null,aimModel=null,aimKey='',handKey='';
 function batchModels(){
  for(const b of batches.values()){b.count=0;b.visible=false;}
  for(const root of active.values())if(root.visible){root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+'/'+o.material.uuid;let b=batches.get(key);if(!b){b=new T.InstancedMesh(o.geometry,o.material,2048);b.instanceMatrix.setUsage(T.DynamicDrawUsage);b.frustumCulled=false;b.raycast=()=>{};batches.set(key,b);group.add(b);}if(b.count<2048){b.setMatrixAt(b.count++,o.matrixWorld);b.visible=true;}o.visible=false;});}
  for(const b of batches.values())if(b.count)b.instanceMatrix.needsUpdate=true;
 }
 const toolbox=()=>{const g=new T.Group();const a=new T.Mesh(cube,mats.yellow);a.scale.set(.35,.25,.25);g.add(a);const handle=new T.Mesh(ring,mats.dark);handle.scale.set(.09,.07,.07);handle.position.y=.17;g.add(handle);return g;};
 function acquire(id,type){let root=active.get(id);if(root&&root.userData.type!==type){root.visible=false;active.delete(id);(free.get(root.userData.type)||free.set(root.userData.type,[]).get(root.userData.type)).push(root);root=null;}
  if(!root){root=free.get(type)?.pop()||(type==='toolbox'?toolbox():model(type));root.userData.type=type;group.add(root);active.set(id,root);}return root;}
 function beam(a,b,color,width=.04){let mesh=beams.find(o=>!o.visible);if(!mesh){if(beams.length>=128)return;mesh=new T.Mesh(cube,mats[color]||mats.blue);mesh.raycast=()=>{};group.add(mesh);beams.push(mesh);}mesh.material=mats[color]||mats.blue;mesh.visible=true;const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;mesh.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);mesh.scale.set(width,width,Math.hypot(dx,dy,dz));mesh.lookAt(b.x,b.y,b.z);}
 function reset(){group.visible=false;hand.visible=false;preview.visible=false;for(const o of active.values())o.visible=false;beams.forEach(o=>o.visible=false);for(const b of batches.values())b.visible=false;seenAudio.clear();}
 return{group,hand,reset,
  update(army,now,{active:enabled=true,viewer,visible=()=>true,aim=null,sound=()=>{},reducedMotion=false}={}){
   group.visible=enabled;hand.visible=!!(enabled&&aim);preview.visible=!!(enabled&&aim);beams.forEach(o=>o.visible=false);const ids=new Set(),all=army.units(),byId=new Map(all.map(u=>[u.id,u]));
   for(const u of all){if(now>=u.endsAt)continue;const root=acquire(u.id,u.type);ids.add(u.id);const show=visible({...u,y:u.y+.3});root.visible=show;if(!show)continue;
    const mix=u.renderFrom?Math.min(1,Math.max(0,(now-u.receivedAt)/.1)):1,p=u.renderFrom||u;root.position.set(p.x+(u.x-p.x)*mix,p.y+(u.y-p.y)*mix,p.z+(u.z-p.z)*mix);root.rotation.set(u.surfaceX||0,u.yaw||0,u.surfaceZ||0);const parts=root.userData.parts||{};
    if(parts.lamp)parts.lamp.material=(u.warningAt>now||u.command)?mats.yellow:u.type==='bomb'?mats.red:u.team===viewer?.team?mats.blue:mats.red;
    const walk=u.state==='Move'&&!reducedMotion?Math.sin(now*16+u.id)*.3:0;for(let i=0;i<(parts.legs?.length||0);i++)parts.legs[i].rotation.x=walk*(i%2?1:-1);for(const rotor of parts.rotors||[])rotor.rotation.z=now*25;for(const blade of parts.blades||[])blade.rotation.z=now*15;
    centre.set(0,TYPES[u.type].height/2,0).applyEuler(root.rotation);root.position.x-=centre.x;root.position.y+=TYPES[u.type].height/2-centre.y;root.position.z-=centre.z;
    root.scale.set(u.fused?1.25:1,1,u.fused?1.25:1);
    if(u.mount&&byId.has(u.mount))beam({...u,y:u.y+.15},byId.get(u.mount),'yellow',.06);
    if(u.link&&byId.has(u.link)&&u.type==='shield')beam({...u,y:u.y+1.3},{...byId.get(u.link),y:byId.get(u.link).y+1.3},'yellow',.12);
    if(u.command?.type==='laser'&&now>=u.command.at&&now<u.command.end)beam({...u,y:u.y+1},u.command.point,'red',.15);
   }
   for(const g of army.pending(now)){const root=acquire('throw-'+g.id,'toolbox');root.position.set(g.position.x,g.position.y,g.position.z);root.rotation.x=now*3;root.visible=visible(g.position);ids.add('throw-'+g.id);}
   for(const r of army.wrecks()){const root=acquire('wreck-'+r.id,r.type);ids.add('wreck-'+r.id);root.visible=now<r.endsAt&&visible(r);root.position.set(r.x,r.y,r.z);root.rotation.set(.6,0,.8);root.scale.setScalar(.5);}
   for(const [id,o]of active)if(!ids.has(id)){o.visible=false;active.delete(id);(free.get(o.userData.type)||free.set(o.userData.type,[]).get(o.userData.type)).push(o);}
   for(const g of army.groups()){const wires=all.filter(u=>u.gid===g.id&&u.type==='wire');if(wires.length===2&&Math.hypot(wires[0].x-wires[1].x,wires[0].z-wires[1].z)<=ROBOT_RULES.wireLength&&wires.every(u=>visible(u)))beam({...wires[0],y:wires[0].y+.18},{...wires[1],y:wires[1].y+.18},'yellow',.035);}
   const events=army.effects();for(const e of events){if(now-e.at>.5)continue;const show=visible(e);if(show&&['shot','repair','laser'].includes(e.type))beam({...e,y:e.y+.5},{x:e.tx,y:e.ty,z:e.tz},e.type==='repair'?'white':'yellow',e.type==='laser'?.12:.035);
    if(show&&['blast','deploy','destroy','fuse','recycle','cut','wire'].includes(e.type)){const radius=e.type==='blast'?1.8:.4,age=Math.max(0,now-e.at);beam({x:e.x-radius*(1-age),y:e.y+.15,z:e.z},{x:e.x+radius*(1-age),y:e.y+.15,z:e.z},e.type==='blast'?'red':'yellow',.12);}
    if(!seenAudio.has(e.id)&&now-e.at<.18){sound({deploy:'quick-solder',warning:'ember-warning',shot:'echo-tag-set',blast:'solder-pop',destroy:'shade-check',cut:'quick-solder',repair:'nobi-tool',recycle:'quick-solder',wire:'grass-roots',fuse:'quick-solder',command:'quick-solder'}[e.type]||'quick-solder',e);seenAudio.add(e.id);}}
   let spare=0;for(const pool of free.values())for(let i=pool.length-1;i>=0;i--){if(++spare>192){const old=pool.splice(i,1)[0];group.remove(old);}}
   batchModels();const eventIds=new Set(events.map(e=>e.id));for(const id of seenAudio)if(!eventIds.has(id))seenAudio.delete(id);
   if(aim){const key=aim.key+':'+aim.mode;if(handKey!==key){hand.clear();handModel=aim.key==='c'?toolbox():model(ROBOT_SKILLS[aim.key].rosters[aim.mode][0]);handModel.scale.setScalar(aim.key==='x'?.12:.25);hand.add(handModel);handKey=key;}hand.position.set(.35,-.35,-.65);
    if(aimKey!==key){preview.clear();aimModel=model(ROBOT_SKILLS[aim.key].rosters[aim.mode][0]);preview.add(aimModel);aimKey=key;}preview.position.set(aim.point.x,aim.point.y,aim.point.z);preview.rotation.y=aim.yaw;aimModel.traverse(o=>{if(o.isMesh)o.material=aim.valid?mats.ghost:mats.bad;});
   }
  },
  dispose(){reset();for(const b of batches.values())b.dispose();batches.clear();[cube,sphere,cone,ring].forEach(g=>g.dispose());Object.values(mats).forEach(m=>m.dispose());group.clear();hand.clear();active.clear();free.clear();}
 };
}
