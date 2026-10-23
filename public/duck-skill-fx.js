export function createDuckSkillFX(THREE){
  const group=new THREE.Group();group.name='Duck skill FX';const visuals=new Map(),geometries=new Set(),materials=new Set();
  const geometry=g=>(geometries.add(g),g),material=m=>(materials.add(m),m);
  const plane=geometry(new THREE.PlaneGeometry(3,2.4)),ball=geometry(new THREE.SphereGeometry(1,16,10)),ring=geometry(new THREE.TorusGeometry(.34,.022,6,24));
  const green=material(new THREE.MeshBasicMaterial({color:'#c2e985',transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}));
  const gold=material(new THREE.MeshBasicMaterial({color:'#ffe173',transparent:true,opacity:.85,depthWrite:false}));
  function mesh(parent,g,m,p=[0,0,0],s=[1,1,1]){const o=new THREE.Mesh(g,m);o.position.set(...p);o.scale.set(...s);o.raycast=()=>{};parent.add(o);return o;}
  function build(e){const root=new THREE.Group();root.name=`Duck FX / ${e.type}`;group.add(root);let meter=null;
    if(e.type==='duck-shield'){
      mesh(root,plane,green,[0,1.2,0]);
      for(const side of[-1,1])for(let i=0;i<4;i++){const feather=mesh(root,ball,gold,[side*(.23+i*.28),1.1+i*.11,.025],[.075,.38,.025]);feather.rotation.z=side*-.65;}
      meter=mesh(root,ball,gold,[0,2.42,0],[1.5,.018,.018]);
    }else if(e.type==='duck-egg'){
      const shell=mesh(root,ball,green,[0,1,0],[.48,.98,.43]);shell.material=material(green.clone());shell.material.wireframe=true;
      mesh(root,ring,gold,[0,1,0],[1.5,2.2,1]);
    }else if(e.type==='duck-seal'){
      for(const side of[-1,1]){const f=mesh(root,ball,gold,[0,1.95,0],[.045,.21,.025]);f.rotation.z=side*.65;}
     }else if(e.type==='duck-hush'){
      for(const side of[-1,1]){const wing=mesh(root,ball,gold,[side*.52,1.25,0],[.48,.055,.2]);wing.name='Duck flight wing';wing.userData.side=side;}
    }else for(const side of[-1,1])mesh(root,ring,green,[side*.13,.07,0],[.35,.35,.35]).rotation.x=Math.PI/2;
    return{root,meter,owned:[...root.children].map(o=>o.material).filter(m=>m!==green&&m!==gold)};
  }
  const previewRing=mesh(group,ring,gold);previewRing.visible=false;
  function update(events,now,{actors=[],preview=null}={}){previewRing.visible=!!preview&&Number.isFinite(preview.x);if(previewRing.visible){previewRing.position.set(preview.x,preview.y+(preview.type==='q'?.05:.5),preview.z);previewRing.rotation.x=preview.type==='q'?-Math.PI/2:0;previewRing.scale.setScalar(preview.type==='q'?2:1);}const ids=new Set();for(const e of events){if(!e.type.startsWith('duck-'))continue;ids.add(e.id);let v=visuals.get(e.id);if(!v){v=build(e);visuals.set(e.id,v);}
    const a=actors.find(a=>a.id===(e.type==='duck-seal'?e.targetId:e.sourceId));
    v.root.position.set(e.type==='duck-shield'?e.x:a?.x??e.x,e.type==='duck-shield'?e.y:a?.y??e.y,e.type==='duck-shield'?e.z:a?.z??e.z);v.root.rotation.y=e.yaw||0;
    if(v.meter)v.meter.scale.x=1.5*e.power/180;
    if(e.type==='duck-hush')for(const wing of v.root.children)wing.rotation.z=wing.userData.side*Math.sin((now-e.startedAt)*18)*.65;
  }for(const[id,v]of visuals)if(!ids.has(id)){v.root.removeFromParent();for(const m of v.owned){m.dispose();materials.delete(m);}visuals.delete(id);}}
  function reset(){previewRing.visible=false;for(const v of visuals.values()){v.root.removeFromParent();for(const m of v.owned){m.dispose();materials.delete(m);}}visuals.clear();}
  return{group,update,reset,dispose(){reset();group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
