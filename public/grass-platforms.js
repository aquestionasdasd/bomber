// One set of dimensions for the visible cube and its movement-only solid.
// Combat raycasts still use the existing visible character hit surfaces.
export const GRASS_BLOCK_BODY = Object.freeze({x:0,y:1.32,z:-.31,width:1.04,height:1.08,depth:1.02});
export function grassPlatform(actor,yaw=0){
  const b=GRASS_BLOCK_BODY,c=Math.cos(yaw),s=Math.sin(yaw);
  return {id:actor.id,team:actor.team,x:actor.x+b.z*s,z:actor.z+b.z*c,yaw,
    base:(actor.y||0)+b.y-b.height/2-(actor.crouch||0)*.55,
    top:(actor.y||0)+b.y+b.height/2-(actor.crouch||0)*.55,
    halfX:b.width/2,halfZ:b.depth/2};
}
export function grassLocal(p,x,z){const dx=x-p.x,dz=z-p.z,c=Math.cos(p.yaw),s=Math.sin(p.yaw);return {x:dx*c-dz*s,z:dx*s+dz*c};}
export function grassWorld(p,x,z){const c=Math.cos(p.yaw),s=Math.sin(p.yaw);return {x:p.x+x*c+z*s,z:p.z-x*s+z*c};}
export function grassOverlaps(p,x,z,r=.34){const q=grassLocal(p,x,z);return Math.hypot(Math.max(0,Math.abs(q.x)-p.halfX),Math.max(0,Math.abs(q.z)-p.halfZ))<r+1e-7;}
export function grassBlocks(p,x,z,r,feet,height){return feet<p.top-.025&&feet+height>p.base+.001&&grassOverlaps(p,x,z,r);}
export function validGrassRide(value){return Array.isArray(value)&&value.length===3&&typeof value[0]==='string'&&value[0].length>0&&value[0].length<=48&&value.slice(1).every(n=>Number.isFinite(n)&&Math.abs(n)<=1);}
