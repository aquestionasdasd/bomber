import {WOMB_PLAN,WOMB_CORES} from './womb-plan.js';
export {WOMB_PLAN,WOMB_CORES};
export const WOMB_STOREY=3.6;
export const WOMB_LEVELS=[0,3.6,7.2,10.8];
export const WOMB_BOUNDS={minX:-17,maxX:17,minZ:-21,maxZ:21};
export const wombPoint=(x,z,y=0)=>({x:x-17,z:z-21,y});
export const wombRect=([x,z,w,d])=>({minX:x-17,maxX:x+w-17,minZ:z-21,maxZ:z+d-21});
export const wombPolygon=r=>[[r.minX,r.minZ],[r.maxX,r.minZ],[r.maxX,r.maxZ],[r.minX,r.maxZ]];
export const contains=(r,x,z)=>x>=r.minX-1e-8&&x<=r.maxX+1e-8&&z>=r.minZ-1e-8&&z<=r.maxZ+1e-8;

// Exact rectilinear union. Exposed faces only; neighbouring boxes cannot leave
// slits or coplanar interior faces in the architectural shell.
export function wombRegion(rects,cuts=[],complement=false){
 const clean=v=>Math.round(v*1e6)/1e6;
 const all=[WOMB_BOUNDS,...rects,...cuts],xs=[...new Set(all.flatMap(r=>[clean(r.minX),clean(r.maxX)]))].sort((a,b)=>a-b),zs=[...new Set(all.flatMap(r=>[clean(r.minZ),clean(r.maxZ)]))].sort((a,b)=>a-b);
 const cells=[],edges=[],rectangles=[],on=new Set();
 for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++){
  const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;
  let yes=rects.some(r=>contains(r,x,z))&&!cuts.some(r=>contains(r,x,z));if(complement)yes=!yes;
  if(yes){on.add(i+','+j);cells.push({minX:xs[i],maxX:xs[i+1],minZ:zs[j],maxZ:zs[j+1],i,j});}
 }
 for(const r of cells){const{minX:x,maxX:X,minZ:z,maxZ:Z,i,j}=r;
  if(!on.has((i-1)+','+j))edges.push([x,z,x,Z]);
  if(!on.has((i+1)+','+j))edges.push([X,Z,X,z]);
  if(!on.has(i+','+(j-1)))edges.push([X,z,x,z]);
  if(!on.has(i+','+(j+1)))edges.push([x,Z,X,Z]);
 }
 for(let j=0;j<zs.length-1;j++){let start=null;for(let i=0;i<xs.length;i++){
  if(on.has(i+','+j)){if(start===null)start=i;continue;}
  if(start!==null){const r={minX:xs[start],maxX:xs[i],minZ:zs[j],maxZ:zs[j+1]},last=rectangles.find(q=>q.minX===r.minX&&q.maxX===r.maxX&&q.maxZ===r.minZ);if(last)last.maxZ=r.maxZ;else rectangles.push(r);start=null;}
 }}
 // Coalesce collinear boundary fragments before generating walls and trim.
 const lines=new Map();
 for(const e of edges){const vertical=e[0]===e[2],dir=Math.sign(vertical?e[3]-e[1]:e[2]-e[0]),at=vertical?e[0]:e[1],key=[vertical,at,dir].join(':');if(!lines.has(key))lines.set(key,{vertical,dir,at,ranges:[]});lines.get(key).ranges.push([Math.min(vertical?e[1]:e[0],vertical?e[3]:e[2]),Math.max(vertical?e[1]:e[0],vertical?e[3]:e[2])]);}
 const merged=[];
 for(const {vertical,dir,at,ranges}of lines.values()){ranges.sort((a,b)=>a[0]-b[0]);const runs=[];for(const r of ranges){const last=runs.at(-1);if(last&&Math.abs(last[1]-r[0])<1e-6)last[1]=r[1];else runs.push([...r]);}for(const [a,b]of runs){const s=dir>0?a:b,t=dir>0?b:a;merged.push(vertical?[at,s,at,t]:[s,at,t,at]);}}
 return {cells,rectangles,edges:merged};
}

export const WOMB_STAIRS=WOMB_CORES.flatMap(([x,z,w],core)=>[0,1,2].flatMap(floor=>[
 {id:`s${core+1}-${floor+1}a`,core:core+1,from:floor+1,to:floor+2,...wombRect([x,z+1.6,1.95,3.4]),axis:'z',direction:-1,base:WOMB_LEVELS[floor],height:1.8},
 {id:`s${core+1}-${floor+1}b`,core:core+1,from:floor+1,to:floor+2,...wombRect([x+2.45,z+1.6,1.95,3.4]),axis:'z',direction:1,base:WOMB_LEVELS[floor]+1.8,height:1.8}
]));

export function wombFloorIndex(y){return Math.max(0,Math.min(3,Math.floor(((Number.isFinite(y)?y:0)+.18)/WOMB_STOREY)));}

// Centreline of a complete stair traversal, including both real landings.
export function wombStairRoute(core,floor){
 const [x,z]=WOMB_CORES[core-1],base=WOMB_LEVELS[floor-1];
 return [[x+.975,z+6.5,base],[x+.975,z+5,base],[x+.975,z+1.6,base+1.8],
  [x+.975,z+.8,base+1.8],[x+3.425,z+.8,base+1.8],[x+3.425,z+1.6,base+1.8],
  [x+3.425,z+5,base+3.6],[x+3.425,z+6.5,base+3.6]].map(p=>wombPoint(...p));
}
