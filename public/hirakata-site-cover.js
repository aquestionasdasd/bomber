// Gameplay cover added around the south entrance, outside A's planting points.
// The opaque body dimensions are also the map's collision dimensions.
export const HIRAKATA_A_COVER=Object.freeze([
 {id:'A_cover_west',x:-31,z:20.7,w:1.5,d:3.2,h:2.05,style:'cabinet'},
 {id:'A_cover_east',x:-17,z:20.3,w:1.5,d:3.2,h:2.05,style:'cabinet'},
 {id:'A_cover_south_west',x:-27.2,z:25.6,w:3.2,d:1,h:1.4,style:'planter'},
 {id:'A_cover_south_east',x:-20.6,z:25.6,w:2.6,d:1,h:1.4,style:'planter'},
].map(Object.freeze));

export function createHirakataSiteCover(T){
 const geometry=new T.BoxGeometry(1,1,1),groups=new Map();let meshCount=0;
 const material=(color)=>new T.MeshStandardMaterial({color,roughness:.85});
 const cabinet=material('#4d6468'),panel=material('#8faaa9'),stripe=material('#56a69a');
 const concrete=material('#a5a698'),soil=material('#575c42'),green=material('#6f8056');
 for(const spec of HIRAKATA_A_COVER){
  const root=new T.Group();root.name=spec.id;root.position.set(spec.x,0,spec.z);
  function part(name,x,y,z,w,h,d,mat){
   const mesh=new T.Mesh(geometry,mat);mesh.name=spec.id+' / '+name;
   mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;
   mesh.userData={solid:true,hirakataModule:spec.id,preserveGround:false};root.add(mesh);meshCount++;
  }
  part('body',0,spec.h/2,0,spec.w,spec.h,spec.d,spec.style==='cabinet'?cabinet:concrete);
  if(spec.style==='cabinet'){
   // Face details project at most 2mm; the visible body defines the solid wall.
   for(const side of [-1,1]){
    part('door '+side,side*(spec.w/2-.003),1.05,0,.008,1.55,spec.d-.28,panel);
    part('band '+side,side*(spec.w/2-.002),1.78,0,.008,.12,spec.d-.28,stripe);
   }
  }else{
   // Recessed planting bed: greenery never pretends to be tall solid cover.
   part('bed',0,spec.h-.003,0,spec.w-.22,.008,spec.d-.22,soil);
   part('planting',0,spec.h,0,spec.w-.4,.008,spec.d-.4,green);
  }
  groups.set(spec.id,root);
 }
 return {groups,meshCount};
}
