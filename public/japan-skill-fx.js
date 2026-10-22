import { JAPAN_SKILLS } from './abilities.js';
export function createJapanSkillFX(THREE){
 const group=new THREE.Group();group.name='しばくでジャパン / border mandate';const items=new Map(),geometries=[],materials=[];
 const geo=g=>(geometries.push(g),g),mat=(color,opacity=.8)=>{const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false});materials.push(m);return m;};
 const red=mat('#ff6752'),gold=mat('#ffe489'),white=mat('#fff4df'),plane=mat('#ffd25c',.10),bar=geo(new THREE.BoxGeometry(1,1,1)),ring=geo(new THREE.TorusGeometry(.42,.025,6,32));
 function mesh(root,g,m,pos,scale){const o=new THREE.Mesh(g,m);o.raycast=()=>{};if(pos)o.position.set(...pos);if(scale)o.scale.set(...scale);root.add(o);return o;}
 function update(events,now,{actors=[]}={}){const seen=new Set();for(const e of events){if(!e.type.startsWith('japan-'))continue;const actor=actors.find(a=>a.id===(e.targetId||e.sourceId));if(e.type!=='japan-border'&&!actor?.alive)continue;
  seen.add(e.id);let root=items.get(e.id);if(!root){root=new THREE.Group();root.name=e.type;items.set(e.id,root);group.add(root);
   if(e.type==='japan-border'){const w=JAPAN_SKILLS.borderWidth,h=JAPAN_SKILLS.borderHeight;for(const side of[-1,1])mesh(root,bar,red,[side*w/2,h/2,0],[.08,h,.08]);for(const y of[.12,h])mesh(root,bar,gold,[0,y,0],[w,.035,.035]);for(let x=-4;x<=4;x++)mesh(root,bar,white,[x,.75,0],[.025,1.5,.025]);mesh(root,bar,plane,[0,h/2,0],[w,h,.015]);}
   else if(e.type==='japan-levy'){mesh(root,ring,gold);for(const side of[-1,1]){const o=mesh(root,bar,white,[side*.2,0,0],[.06,.3,.03]);o.rotation.z=side*.6;}}
   else if(e.type==='japan-return'){for(const side of[-1,1]){const r=mesh(root,ring,red,[0,0,0]);r.rotation.y=side*Math.PI/3;}mesh(root,bar,gold,[0,0,0],[.04,.55,.04]);}
   else{for(let i=0;i<8;i++){const o=mesh(root,bar,white,[Math.cos(i*Math.PI/4)*.4,0,Math.sin(i*Math.PI/4)*.4],[.04,1,.04]);o.rotation.z=.3;}}
  }
  if(e.type==='japan-border'){root.position.set(e.x,e.y,e.z);root.rotation.y=e.yaw;root.scale.y=now<e.triggerAt?.35:1;}
  else{root.position.set(actor.x,(actor.y||0)+1.9-(actor.crouch||0)*.55,actor.z);root.rotation.y=now*1.5;}
 }for(const[id,o]of items)if(!seen.has(id)){o.removeFromParent();items.delete(id);}}
 function reset(){for(const o of items.values())o.removeFromParent();items.clear();}return{group,update,reset,dispose(){reset();group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
