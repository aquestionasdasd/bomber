import { acquireNopeArtwork, acquireHirakataNopeArtwork } from './nope-props.js';

// World-space, transparent paint layers. No collision, visibility, or damage changes.
export function createStationTakeover(THREE) {
  const group = new THREE.Group(); group.name = 'NOPE / station takeover'; group.visible = false;
  const artwork = acquireNopeArtwork(THREE), texture = artwork.texture;
  const material = new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,roughness:.74,metalness:0,emissive:'#fb078d',emissiveMap:texture,emissiveIntensity:.2,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
  material.forceSinglePass=true;
  const geometry = new THREE.PlaneGeometry(1,1);
  let placements=[];const dummy=new THREE.Object3D();
  function decal(x,y,z,w,h,rx=0,ry=0) { dummy.position.set(x,y,z);dummy.scale.set(w,h,1);dummy.rotation.set(rx,ry,0);dummy.updateMatrix();placements.push(dummy.matrix.clone()); }
  // Front of both station wings, sign, entrance canopy and roof.
  for(const x of [-54,-46,-38,-5,3,9.7]) { decal(x,8.4,-32.28,5.3,5.3); decal(x,2.7,-32.28,3.4,3.4); }
  for(const x of [-26.4,-20.75,-15.1])decal(x,10.18,-32.69,3.6,3.6);
  for(const x of [-49,-40,-31,-8,1,10])decal(x,5.99,-30.6,4,4,-Math.PI/2);
  for(const x of [-54,-41,-28,-15,-2,11])for(const z of [-40,-54])if(x!==-41||z!==-54)decal(x,12.918,z,9,9,-Math.PI/2);
  // Interior concourse side panels remain passable.
  for(const z of [-38,-46,-54]) {decal(-27.89,2.5,z,3.7,3.7,0,Math.PI/2);decal(-13.61,2.5,z,3.7,3.7,0,-Math.PI/2);}
  const paint=new THREE.InstancedMesh(geometry,material,64);paint.name='NOPE / paint decals';paint.renderOrder=10;paint.count=placements.length;placements.forEach((matrix,i)=>paint.setMatrixAt(i,matrix));paint.instanceMatrix.needsUpdate=true;paint.computeBoundingSphere();paint.raycast=()=>{};paint.userData.solid=false;group.add(paint);
  const hashimoto=placements;placements=[];
  // Match the two glazed facades, silver station-name fascia, actual roof
  // and indoor passage walls. No Hashimoto coordinates leak into Hirakata.
  for(const side of [-1,1]){
    for(const x of [-54,-39,-6,10,47,61])decal(x,8.4,side*19.46,6.4,6.4,0,side<0?Math.PI:0);
    for(const x of [-36,-4,28])decal(x,15.5,side*19.50,4,4,0,side<0?Math.PI:0);
    for(const x of [-47,-31,1,17,49])decal(x,13.315,side*10,9,9,-Math.PI/2);
  }
  for(const z of [6,13]){decal(-26.76,2.15,z,3.3,3.3,0,Math.PI/2);decal(-13.24,2.15,z,3.3,3.3,0,-Math.PI/2);}
  const hirakata=placements;let selected='hashimoto',hirakataArtwork=null,state=null,disposed=false;
  paint.count=hashimoto.length;
  function selectMap(id){
    const next=id==='hirakata'?'hirakata':'hashimoto';if(next===selected)return;
    selected=next;const points=next==='hirakata'?hirakata:hashimoto;
    if(next==='hirakata'&&!hirakataArtwork)hirakataArtwork=acquireHirakataNopeArtwork(THREE);
    material.map=material.emissiveMap=next==='hirakata'?hirakataArtwork.texture:texture;material.needsUpdate=true;
    paint.count=points.length;points.forEach((matrix,i)=>paint.setMatrixAt(i,matrix));paint.instanceMatrix.needsUpdate=true;paint.computeBoundingSphere();group.userData.map=next;
  }
  return {group,
    start(data){if(!disposed){selectMap(data.mapId);state={...data};}},
    update(now){const age=state?now-state.startedAt:-1,remaining=state?state.endsAt-now:0;group.visible=!!state&&age>=0&&remaining>0;material.opacity=group.visible?Math.min(1,age/.22,remaining/.7):0;return group.visible;},
    reset(){state=null;group.visible=false;material.opacity=0;},
    dispose(){if(disposed)return;disposed=true;this.reset();paint.dispose();geometry.dispose();material.dispose();artwork.release();hirakataArtwork?.release();group.clear();}
  };
}
