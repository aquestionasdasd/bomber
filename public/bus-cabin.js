// Shared visible cabin panels and sight blockers. Glass transmits shots/sight;
// metal, seats and window pillars remain cover. Coordinates are bus-local.
const body=[];
const add=(m,x,y,z,w,h,d)=>body.push(Object.freeze({m,x,y,z,w,h,d}));
add('metal',0,.39,0,2.5,.18,10.6);add('white',0,3.08,0,2.5,.24,10.6);
add('white',0,3.29,-1.6,1.5,.25,3);
add('glass',0,2.25,5.32,2.22,1.22,.035);add('glass',0,2.25,-5.32,2.2,1.05,.035);
add('white',0,1.02,5.26,2.5,1.15,.1);add('white',0,1.02,-5.26,2.5,1.15,.1);
for(const sign of[-1,1]){
 for(let z=-4.95;z<5.2;z+=.46){if(sign===-1&&[3.9,-.8].some(d=>Math.abs(d-z)<.68))continue;
  add('white',sign*1.25,1,z,.09,1.15,.46);add('red',sign*1.3,1.08,z,.06,.34,.46);add('glass',sign*1.265,2.18,z,.035,1.15,.46);}
 for(let z=-4.9;z<5.1;z+=1.38){if(sign===-1&&[3.9,-.8].some(d=>Math.abs(d-z)<.5))continue;add('white',sign*1.29,2.2,z,.06,1.5,.065);}
 add('red',sign*1.27,2.98,0,.08,.19,10.57);
 add('light',sign*.87,.82,5.35,.44,.23,.04);add('red',sign*.92,.88,-5.35,.28,.35,.04);add('black',sign*1.4,2.4,4.6,.18,.42,.16);
 for(const z of[-3.8,-2.1,.1]){add('seat',sign*.75,.88,z,.62,.18,.62);add('seat',sign*.75,1.25,z-.32,.62,.72,.13);}
}
add('black',.64,.9,4.07,.72,.19,.8);add('black',.64,1.26,3.7,.72,.77,.18);add('black',0,1.25,4.95,2.25,.28,.45);
export const BUS_CABIN_PANELS=Object.freeze(body);
// The old opaque full-height door backing covered its own glass. A real frame
// leaves the same visible glass opening, whether closed or swung open.
export const BUS_DOOR_FRAME=Object.freeze([
 {m:'metal',x:0,y:.83,z:0,w:.04,h:.76,d:1.05},
 {m:'metal',x:0,y:2.61,z:0,w:.04,h:.12,d:1.05},
 ...[-1,1].map(s=>({m:'metal',x:0,y:1.9,z:s*.5,w:.04,h:1.3,d:.05})),
]);
function local(v,x,z,yaw){const dx=v.x-x,dz=v.z-z,c=Math.cos(yaw),s=Math.sin(yaw);return{x:dx*c-dz*s,y:v.y||0,z:dx*s+dz*c};}
function crosses(a,b,p){
 let lo=0,hi=1;
 for(const [axis,size]of[['x','w'],['y','h'],['z','d']]){
  const start=a[axis],delta=b[axis]-start,min=p[axis]-p[size]/2,max=p[axis]+p[size]/2;
  if(Math.abs(delta)<1e-9){if(start<min||start>max)return false;}
  else{const u=(min-start)/delta,v=(max-start)/delta;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return false;}
 }
 return hi>1e-5&&lo<1-1e-5;
}
export function busCabinRayClear(a,b,p){
 const start=local(a,p.x,p.z,p.yaw),end=local(b,p.x,p.z,p.yaw);
 // Reject distant rays before visiting panels; includes swung-open doors.
 if(!crosses(start,end,{x:0,y:1.8,z:0,w:4,h:3.6,d:10.9}))return true;
 for(const panel of BUS_CABIN_PANELS)if(panel.m!=='glass'&&crosses(start,end,panel))return false;
 for(const z of[3.9,-.8]){const from=local(start,-1.29,z,p.door?-1.45:0),to=local(end,-1.29,z,p.door?-1.45:0);
  for(const panel of BUS_DOOR_FRAME)if(crosses(from,to,panel))return false;
  if(crosses(from,to,{x:-.035,y:1.08,z:0,w:.03,h:.35,d:.9}))return false;
 }
 return true;
}
