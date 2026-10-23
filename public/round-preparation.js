// The same boundary is used by the local mover, authoritative guest mover,
// and visible barrier. Historical small-map fixtures keep circle support.
export function buyAreaContains(area,x,z,margin=0){
  if(!area)return true;
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  if(Number.isFinite(area.minX))return x>=area.minX+margin&&x<=area.maxX-margin&&z>=area.minZ+margin&&z<=area.maxZ-margin;
  return Math.hypot(x-area.x,z-area.z)<=area.radius-margin;
}
export function buyAreaOutline(area){
  if(Number.isFinite(area.minX))return[[area.minX,area.minZ],[area.maxX,area.minZ],[area.maxX,area.maxZ],[area.minX,area.maxZ]];
  return Array.from({length:80},(_,i)=>[area.x+Math.cos(i*Math.PI/40)*area.radius,area.z+Math.sin(i*Math.PI/40)*area.radius]);
}
