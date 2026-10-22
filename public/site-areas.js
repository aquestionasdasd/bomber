// The painted perimeter is the planting area. Candidate positions guide bots;
// a player may plant at any valid point inside the perimeter.
const freezeArea = (polygon, plantPositions) => Object.freeze({
  polygon: Object.freeze(polygon.map(point => Object.freeze(point))),
  plantPositions: Object.freeze(plantPositions.map(point => Object.freeze(point))),
});

export const SITE_AREAS = Object.freeze({
  A: freezeArea([[-46,-28],[-27,-28],[-27,-13],[-46,-13]], [
    {id:'A-cover',label:'大型ケース裏',style:'cover',x:-43,z:-18.6},
    {id:'A-station',label:'駅側のケース脇',style:'deep',x:-32.6,z:-25.2},
    {id:'A-open',label:'コンコース前の開放位置',style:'open',x:-36.5,z:-19.5},
  ]),
  B: freezeArea([[31,-15],[48,-15],[48,1],[31,1]], [
    {id:'B-cover',label:'案内所側のケース裏',style:'cover',x:34,z:-7.6},
    {id:'B-back',label:'ミウィ入口側',style:'deep',x:44.3,z:-11.5},
    {id:'B-open',label:'通りを見渡す開放位置',style:'open',x:42.5,z:-.8},
  ]),
});

const EPSILON = 1e-8;
const finite = value => Number.isFinite(value);

function edgeDistanceSquared(x,z,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/length)):0;
  return (x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2;
}

/** Ground-plane membership, including the boundary. A positive margin insets it. */
export function isInsideSite(site,x,z,{margin=0}={}) {
  if(!site||!finite(x)||!finite(z)||!finite(margin)||margin<0)return false;
  if(site.polygon!==undefined){
    const polygon=site.polygon;
    if(!Array.isArray(polygon)||polygon.length<3||polygon.some(p=>!Array.isArray(p)||!finite(p[0])||!finite(p[1])))return false;
    let inside=false,edgeDistance=Infinity;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[j],b=polygon[i];
      edgeDistance=Math.min(edgeDistance,edgeDistanceSquared(x,z,a,b));
      if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    const distance=Math.sqrt(edgeDistance);
    return (inside||distance<=EPSILON)&&distance+EPSILON>=margin;
  }
  // Keep older controlled maps usable while production sites use polygons.
  return finite(site.x)&&finite(site.z)&&finite(site.radius)&&site.radius>=margin&&
    Math.hypot(x-site.x,z-site.z)<=site.radius-margin+EPSILON;
}

/** Select a stable, ground-clear bot destination without depending on navigation. */
export function getSitePlantPosition(site,fromX,fromZ,{preferredId,collision,clearance=.45}={}) {
  if(!site||!finite(clearance)||clearance<0)return null;
  const originX=finite(fromX)?fromX:finite(site.x)?site.x:0;
  const originZ=finite(fromZ)?fromZ:finite(site.z)?site.z:0;
  const positions=Array.isArray(site.plantPositions)&&site.plantPositions.length?site.plantPositions:
    [{id:`${site.id||'site'}-center`,label:site.name||'設置位置',style:'open',x:site.x,z:site.z}];
  const candidates=positions.filter(point=>point&&isInsideSite(site,point.x,point.z,{margin:clearance})&&
    (!collision||!collision.blocked(point.x,point.z,clearance,0)));
  candidates.sort((a,b)=>Number(b.id===preferredId)-Number(a.id===preferredId)||
    Math.hypot(a.x-originX,a.z-originZ)-Math.hypot(b.x-originX,b.z-originZ));
  return candidates.length?{...candidates[0]}:null;
}
