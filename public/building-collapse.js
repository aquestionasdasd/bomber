// Accepted bomber events remove static architecture. Debris never alters combat
// randomness or collision. Ground/roads and the dynamic buses remain.
export function createBuildingCollapse(T,map){
  const CHUNKS=640,DUST=96,DURATION=6,group=new T.Group();
  group.name='Bomber / shattered architecture';group.visible=false;
  const geometry=new T.BoxGeometry(1,1,1),dustGeometry=new T.IcosahedronGeometry(1,0);
  const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.9,transparent:true});
  const dustMaterial=new T.MeshBasicMaterial({color:'#cdc8bb',transparent:true,opacity:.23,depthWrite:false});
  const chunks=new T.InstancedMesh(geometry,material,CHUNKS),dust=new T.InstancedMesh(dustGeometry,dustMaterial,DUST);
  for(const mesh of[chunks,dust]){mesh.count=0;mesh.frustumCulled=false;mesh.userData.solid=false;mesh.raycast=()=>{};mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(mesh);}
  const world=map.world,entries=[],sources=[],roots=new Set(map.busModels?.models?.values()||[]);
  if(map.destruction?.fx)roots.add(map.destruction.fx);
  const excluded=node=>{for(let p=node;p;p=p.parent)if(roots.has(p))return true;return false;};
  const matrix=new T.Matrix4(),combined=new T.Matrix4(),zero=new T.Matrix4().makeScale(0,0,0),box=new T.Box3(),pos=new T.Vector3(),size=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();
  world?.updateMatrixWorld(true);
  world?.traverse(node=>{
    if(!node.geometry||!node.isMesh||excluded(node))return;
    node.geometry.computeBoundingBox();const bounds=node.geometry.boundingBox;if(!bounds)return;
    const indices=[],matrices=[],count=node.isInstancedMesh?node.count:1;
    for(let i=0;i<count;i++){
      if(node.isInstancedMesh){node.getMatrixAt(i,matrix);combined.multiplyMatrices(node.matrixWorld,matrix);}else combined.copy(node.matrixWorld);
      box.copy(bounds).applyMatrix4(combined);
      // Preserve ground/paving; thin elevated decks and roofs still collapse.
      if(box.isEmpty()||!Number.isFinite(box.max.y)||box.max.y<=.35)continue;
      indices.push(i);matrices.push(node.isInstancedMesh?matrix.clone():null);
      box.getCenter(pos);box.getSize(size);
      const mat=Array.isArray(node.material)?node.material[0]:node.material;
      sources.push({x:pos.x,y:pos.y,z:pos.z,sx:size.x,sy:size.y,sz:size.z,color:mat?.color?.clone()||new T.Color('#b6b8ae')});
    }
    if(indices.length)entries.push({node,indices,matrices,visible:node.visible});
  });
  const original={colliders:[...map.colliders],shapes:[...(map.mapShapes||[])],ramps:[...(map.ramps||[])]},particles=[],clouds=[];
  let active=false,disposed=false,startTime=0;
  function hideArchitecture(){
    if(world)world.userData.bomberCollapsed=true;
    for(const {node,indices}of entries){
      if(node.isInstancedMesh){const hidden=node.userData.bomberBrokenInstances??=new Set();for(const i of indices){node.setMatrixAt(i,zero);hidden.add(i);}node.instanceMatrix.needsUpdate=true;node.boundingBox=null;node.boundingSphere=null;}
      else{node.visible=false;node.userData.bomberHidden=true;}
    }
    map.colliders.length=0;if(map.mapShapes)map.mapShapes.length=0;if(map.ramps)map.ramps.length=0;map.traversal?.reconcile();map.collision.invalidate();
  }
  function start({x=0,z=0,time=0,seed=1}={}){
    if(disposed)return false;
    if(active)reset();active=true;startTime=Number.isFinite(time)?time:0;
    x=Number.isFinite(x)?x:0;z=Number.isFinite(z)?z:0;
    let state=(Number.isFinite(seed)?seed:1)>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    hideArchitecture();particles.length=0;clouds.length=0;
    for(let i=0;sources.length&&i<CHUNKS;i++){
      const s=sources[Math.min(sources.length-1,Math.floor((i+random())*sources.length/CHUNKS))];
      const px=s.x+(random()-.5)*s.sx,py=Math.max(.4,s.y+(random()-.5)*s.sy),pz=s.z+(random()-.5)*s.sz;
      const a=Math.atan2(pz-z,px-x)+(random()-.5)*.8,speed=8+random()*18;
      particles.push({x:px,y:py,z:pz,vx:Math.cos(a)*speed,vz:Math.sin(a)*speed,vy:9+random()*19,
        sx:.2+random()*1.8,sy:.12+random()*.8,sz:.2+random()*1.4,spin:(random()-.5)*9,angle:random()*6.28});
      chunks.setColorAt(i,s.color);
      if(i%6===0&&clouds.length<DUST)clouds.push({x:px,y:Math.min(16,py),z:pz,vx:Math.cos(a)*3,vz:Math.sin(a)*3,size:2+random()*5});
    }
    if(chunks.instanceColor)chunks.instanceColor.needsUpdate=true;
    group.visible=false;group.userData.event={x,z,time:startTime,seed:state};return true;
  }
  function update(time,{reducedMotion=false}={}){
    const t=time-startTime;
    if(!active||disposed||!Number.isFinite(t)||t<0||t>=DURATION){group.visible=false;chunks.count=0;dust.count=0;return;}
    group.visible=true;const fade=Math.max(0,Math.min(1,(DURATION-t)/1.5));material.opacity=fade;dustMaterial.opacity=.23*fade;
    chunks.count=reducedMotion?0:particles.length;
    if(!reducedMotion)for(let i=0;i<particles.length;i++){
      const p=particles[i];pos.set(p.x+p.vx*t,Math.max(.04,p.y+p.vy*t-7.5*t*t),p.z+p.vz*t);
      rotation.setFromEuler(new T.Euler(p.angle+p.spin*t,p.angle+t*2,p.spin*t*.7));scale.set(p.sx*fade,p.sy*fade,p.sz*fade);chunks.setMatrixAt(i,matrix.compose(pos,rotation,scale));
    }
    dust.count=clouds.length;
    for(let i=0;i<clouds.length;i++){
      const p=clouds[i],motion=reducedMotion?.2:1;pos.set(p.x+p.vx*t*motion,p.y+t*2*motion,p.z+p.vz*t*motion);rotation.identity();scale.setScalar(p.size*(.3+t*.5)*fade*(reducedMotion?.5:1));dust.setMatrixAt(i,matrix.compose(pos,rotation,scale));
    }
    chunks.instanceMatrix.needsUpdate=true;dust.instanceMatrix.needsUpdate=true;
  }
  function reset(){
    if(active){
      if(world)world.userData.bomberCollapsed=false;
      for(const {node,indices,matrices,visible}of entries){
        if(node.isInstancedMesh){for(let j=0;j<indices.length;j++)node.setMatrixAt(indices[j],matrices[j]);node.userData.bomberBrokenInstances?.clear();node.instanceMatrix.needsUpdate=true;node.boundingBox=null;node.boundingSphere=null;}
        else{node.visible=visible;delete node.userData.bomberHidden;}
      }
      map.colliders.splice(0,map.colliders.length,...original.colliders);map.mapShapes?.splice(0,map.mapShapes.length,...original.shapes);map.ramps?.splice(0,map.ramps.length,...original.ramps);
      // Reapply the independent bus damage state after restoring static geometry.
      map.destruction?.reconcile();map.traversal?.reconcile();map.collision.invalidate();
    }
    active=false;particles.length=0;clouds.length=0;group.visible=false;chunks.count=0;dust.count=0;delete group.userData.event;
  }
  return{group,start,update,reset,get active(){return active;},get count(){return sources.length;},dispose(){if(disposed)return;reset();disposed=true;group.removeFromParent();chunks.dispose();dust.dispose();geometry.dispose();dustGeometry.dispose();material.dispose();dustMaterial.dispose();group.clear();}};
}
