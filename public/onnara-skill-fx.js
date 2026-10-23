import { orbViewYaw } from './onnara-rules.js';

export function createOnnaraSkillFX(T) {
  const group=new T.Group();group.name='おんなら / crowns and constellation';
  const items=new Map(),links=new Map(),geometries=[],materials=[];
  let disposed=false;
  const material=(color,opacity=1)=>{const m=new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false});materials.push(m);return m;};
  const gold=material('#ffd34c',.9),white=material('#fff4c9',.95);
  const colors=Object.fromEntries([['onnara-tax','#ff674a'],['onnara-orb','#63dcff'],['onnara-hover','#fff4c9'],['onnara-chain','#ffd34c']].map(([key,color])=>{const m=new T.LineBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false});materials.push(m);return[key,m];}));
  const gem=new T.OctahedronGeometry(.19),beam=new T.CylinderGeometry(1,1,1,6);geometries.push(gem,beam);
  function wire(build){const p=[];const line=(a,b)=>p.push(...a,...b);
    const circle=(radius,y,vertical=false)=>{for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;line(vertical?[Math.cos(a)*radius,y+Math.sin(a)*radius,0]:[Math.cos(a)*radius,y,Math.sin(a)*radius],vertical?[Math.cos(b)*radius,y+Math.sin(b)*radius,0]:[Math.cos(b)*radius,y,Math.sin(b)*radius]);}};
    const star=(radius,y,vertical=false)=>{const pts=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5,r=i%2?radius*.43:radius;return vertical?[Math.sin(a)*r,y+Math.cos(a)*r,0]:[Math.sin(a)*r,y,Math.cos(a)*r];});for(let i=0;i<10;i++)line(pts[i],pts[(i+1)%10]);};
    build({line,circle,star});const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));geometries.push(g);return g;
  }
  const shapes={
    'onnara-tax':wire(({line,circle})=>{circle(.48,0);circle(.48,-.13);for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+.5)*Math.PI/4,c=(i+1)*Math.PI/4;line([Math.sin(a)*.48,0,Math.cos(a)*.48],[Math.sin(b)*.5,.32,Math.cos(b)*.5]);line([Math.sin(b)*.5,.32,Math.cos(b)*.5],[Math.sin(c)*.48,0,Math.cos(c)*.48]);}}),
    'onnara-orb':wire(({line,circle,star})=>{circle(.5,0);circle(.5,0,true);star(.79,0);line([0,0,-.5],[0,0,-1.05]);line([0,0,-1.05],[-.17,0,-.81]);line([0,0,-1.05],[.17,0,-.81]);}),
    'onnara-hover':wire(({line,circle,star})=>{star(.72,0);circle(.9,0);for(let i=0;i<6;i++){const a=i*Math.PI/3,x=Math.sin(a)*.6,z=Math.cos(a)*.6;line([x,-.3,z],[x,.23,z]);}}),
    'onnara-chain':wire(({line,circle,star})=>{star(.62,.05,true);circle(.8,.05,true);for(const side of[-1,1])for(let i=0;i<4;i++){const x=side*(.82+i*.14),y=.2+i*.13;line([side*.25,-.25,0],[x,y,.1]);line([x,y,.1],[side*.48,-.31,.15]);}})
  };
  const noHit=o=>{o.raycast=()=>{};return o;};
  function makeRoot(e){const root=new T.Group();root.name=e.type+' / visible star sigil';const lines=noHit(new T.LineSegments(shapes[e.type],colors[e.type]));root.add(lines);const core=noHit(new T.Mesh(gem,gold));core.name='star core';root.add(core);root.userData.core=core;group.add(root);return root;}
  function makeLink(e){const root=new T.Group();root.name='星座裁定 / impact tether';const start=new T.Vector3(...e.link.slice(0,3)),end=new T.Vector3(...e.link.slice(3,6)),direction=end.clone().sub(start),length=direction.length();root.position.copy(start).add(end).multiplyScalar(.5);if(length>1e-8)root.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());for(const[r,m]of[[.065,gold],[.022,white]]){const shaft=noHit(new T.Mesh(beam,m));shaft.scale.set(r,length,r);root.add(shaft);}root.userData.at=e.link[6];group.add(root);return root;}
  function update(events,now,{actors=[],reducedMotion=false}={}) {
    if(disposed)return;
    const seen=new Set();
    for(const e of events){if(!shapes[e.type])continue;
      const actor=actors.find(a=>a.id===(e.targetId||e.sourceId));if(e.type!=='onnara-orb'&&!actor?.alive)continue;
      seen.add(e.id);let root=items.get(e.id);if(!root){root=makeRoot(e);items.set(e.id,root);}
      const orb=e.type==='onnara-orb',hover=e.type==='onnara-hover',chain=e.type==='onnara-chain';
      root.position.set(orb?e.x:actor.x,orb?e.y+1.65:(actor.y||0)+(hover?.08:chain?1.22:2.12)-(hover?0:(actor.crouch||0)*.55),orb?e.z:actor.z);
      root.rotation.y=orb?orbViewYaw(e,now):reducedMotion?0:now*(hover?.15:.35);
      const age=now-e.startedAt;root.children[0].scale.setScalar(!reducedMotion&&age>=0&&age<.35?1+.5*(1-age/.35):1);
      if(e.type==='onnara-tax'){
        if(root.userData.power!==undefined&&e.power<root.userData.power)root.userData.sparkAt=now;
        root.userData.power=e.power;
      }
      const bloom=!reducedMotion&&now-(root.userData.sparkAt??-Infinity)<.22?1.35:1;
      root.userData.core.scale.setScalar(bloom);root.userData.core.rotation.y=reducedMotion?0:now;
      // No fresh-join impact replay, wall override, light, particles or hitboxes.
      if(e.link&&now>=e.link[6]&&now-e.link[6]<.45){let l=links.get(e.id);if(!l||l.userData.at!==e.link[6]){if(l)l.removeFromParent();l=makeLink(e);links.set(e.id,l);}}
    }
    for(const[id,l]of links)if(!seen.has(id)||now-l.userData.at>=.45){l.removeFromParent();links.delete(id);}
    for(const[id,o]of items)if(!seen.has(id)){o.removeFromParent();items.delete(id);}
  }
  function reset(){for(const l of links.values())l.removeFromParent();links.clear();for(const o of items.values())o.removeFromParent();items.clear();}
  return{group,update,reset,dispose(){if(disposed)return;disposed=true;reset();group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
