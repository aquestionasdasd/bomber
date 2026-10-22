export function createOnnaraSkillFX(T){
 const group=new T.Group();group.name='おんなら / crowns and constellation';const items=new Map(),links=new Map();
 const g=new T.OctahedronGeometry(.09),ring=new T.TorusGeometry(.35,.018,5,18),m=new T.MeshBasicMaterial({color:'#ffce4d',transparent:true,opacity:.85,depthWrite:false}),lm=new T.LineBasicMaterial({color:'#ffdf65',transparent:true,opacity:.9,depthWrite:false});
 function update(events,now,{actors=[]}={}){const seen=new Set();for(const e of events){if(!e.type.startsWith('onnara-'))continue;
  const actor=actors.find(a=>a.id===(e.targetId||e.sourceId));if(e.type!=='onnara-orb'&&!actor?.alive)continue;
  seen.add(e.id);let root=items.get(e.id);if(!root){root=new T.Group();group.add(root);items.set(e.id,root);for(let i=0;i<5;i++){const o=new T.Mesh(g,m),a=i*Math.PI*2/5;o.position.set(Math.sin(a)*.32,0,Math.cos(a)*.32);o.raycast=()=>{};root.add(o);}const r=new T.Mesh(ring,m);r.rotation.x=Math.PI/2;r.raycast=()=>{};root.add(r);}
  root.position.set(e.type==='onnara-orb'?e.x:actor.x,e.type==='onnara-orb'?e.y+1.65:(actor.y||0)+(e.type==='onnara-hover'?.1:2.04)-(actor.crouch||0)*.55,e.type==='onnara-orb'?e.z:actor.z);root.rotation.y=now*.6;
  if(e.link&&now>=e.link[6]&&now-e.link[6]<.22){let l=links.get(e.id);if(!l||l.userData.at!==e.link[6]){if(l){l.removeFromParent();l.geometry.dispose();}l=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(...e.link.slice(0,3)),new T.Vector3(...e.link.slice(3,6))]),lm);l.raycast=()=>{};l.userData.at=e.link[6];group.add(l);links.set(e.id,l);}}
 }for(const[id,l]of links)if(!seen.has(id)||now-l.userData.at>=.22){l.removeFromParent();l.geometry.dispose();links.delete(id);}for(const[id,o]of items)if(!seen.has(id)){o.removeFromParent();items.delete(id);}}
 function reset(){for(const l of links.values()){l.removeFromParent();l.geometry.dispose();}links.clear();for(const o of items.values())o.removeFromParent();items.clear();}
 return{group,update,reset,dispose(){reset();group.removeFromParent();g.dispose();ring.dispose();m.dispose();lm.dispose();}};
}
