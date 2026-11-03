// Host-only motion. A swept sphere stops at the first solid surface, including
// thin walls; the contact normal comes from the real footprint (and its holes).
export function cameraSweep(collision, bounds, from, to, radius, traffic = null, now = 0) {
  const delta={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z};
  const at=t=>({x:from.x+delta.x*t,y:from.y+delta.y*t,z:from.z+delta.z*t});
  const clear=t=>{const p=at(t);return p.y>=(bounds.minY??0)+radius&&p.x>=bounds.minX+radius&&p.x<=bounds.maxX-radius&&p.z>=bounds.minZ+radius&&p.z<=bounds.maxZ-radius&&collision.rayClear(from.x,from.y,from.z,p.x,p.y,p.z,radius)&&(!traffic||traffic.rayClear(from,p,now));};
  if(clear(1))return null;
  let lo=0,hi=1;for(let i=0;i<20;i++){const m=(lo+hi)/2;if(clear(m))lo=m;else hi=m;}
  const p=at(lo),normals=[];
  const surface=(distance,x,y,z)=>{if(distance<radius+.004&&x*delta.x+y*delta.y+z*delta.z<0)normals.push({distance,x,y,z});};
  surface(p.y-(bounds.minY??0),0,1,0);surface(p.x-bounds.minX,1,0,0);surface(bounds.maxX-p.x,-1,0,0);surface(p.z-bounds.minZ,0,0,1);surface(bounds.maxZ-p.z,0,0,-1);
  for(const c of collision.query(p.x,p.z,radius+.01)){
    if(c.disabled||p.y<(c.base||0)-radius-.004||p.y>c.height+radius+.004)continue;
    if(collision.overlaps(c,p.x,p.z,radius)){
      surface(Math.abs(p.y-c.height),0,1,0);surface(Math.abs(p.y-(c.base||0)),0,-1,0);
    }
    const rings=c.polygon?[c.polygon,...(c.holes||[])]:[[[c.minX,c.minZ],[c.maxX,c.minZ],[c.maxX,c.maxZ],[c.minX,c.maxZ]]];
    if(p.y<(c.base||0)||p.y>c.height)continue;
    for(const ring of rings)for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
      const t=length?Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/length)):0;
      const nx=p.x-a[0]-dx*t,nz=p.z-a[1]-dz*t,d=Math.hypot(nx,nz);
      if(d>1e-8)surface(d,nx/d,0,nz/d);
    }
  }
  // Traffic exposes a ray contract, not its mesh normals. Axis probes recover
  // a finite opposing normal without giving the camera permission to pass it.
  if(!normals.length){
    for(const axis of ['x','y','z']){if(!delta[axis])continue;const q={...p};q[axis]+=Math.sign(delta[axis])*.01;
      if(!collision.rayClear(p.x,p.y,p.z,q.x,q.y,q.z,radius)||traffic&&!traffic.rayClear(p,q,now))normals.push({distance:0,x:0,y:0,z:0,[axis]:-Math.sign(delta[axis])});}
  }
  normals.sort((a,b)=>a.distance-b.distance);
  const length=Math.hypot(delta.x,delta.y,delta.z)||1;
  const normal=normals[0]||{x:-delta.x/length,y:-delta.y/length,z:-delta.z/length};
  return {fraction:lo,normal};
}

export function moveCamera(event, seconds, sweep) {
  // Substeps cap travel at 20cm, with a bounded number of contacts per step.
  let remaining=Math.max(0,Math.min(15,seconds));
  while(remaining>1e-9){let dt=Math.min(1/60,remaining);remaining-=dt;
    for(let bounce=0;bounce<4&&dt>1e-9;bounce++){
      const a={x:event.x,y:event.y,z:event.z},b={x:a.x+event.fromX*dt,y:a.y+event.fromY*dt,z:a.z+event.fromZ*dt};
      const hit=sweep(a,b,event.radius);
      if(!hit){Object.assign(event,b);break;}
      const f=Math.max(0,Math.min(1,hit.fraction)),n=hit.normal;
      event.x=a.x+(b.x-a.x)*f+n.x*.001;event.y=a.y+(b.y-a.y)*f+n.y*.001;event.z=a.z+(b.z-a.z)*f+n.z*.001;
      const dot=event.fromX*n.x+event.fromY*n.y+event.fromZ*n.z;
      event.fromX-=2*dot*n.x;event.fromY-=2*dot*n.y;event.fromZ-=2*dot*n.z;
      event.yaw=Math.atan2(-event.fromX,-event.fromZ);dt*=1-f;
    }
  }
}
