// Resolve overlapping, axis-aligned faces before uploading geometry. One cell
// has one visible material; later finish/paint replaces the structural surface.
// This removes coplanar overlaps instead of relying on draw order or depth bias.
export function createTrcSurfaces(emit){
 const planes=new Map(),snap=n=>Math.round(n*1e6)/1e6;
 const stats={input:0,output:0,removedArea:0};
 function add(a,b,c,d,key,uv){
  const points=[a,b,c,d],axis=[0,1,2].find(i=>points.every(p=>Math.abs(p[i]-a[i])<1e-7));
  if(axis===undefined){emit(a,b,c,d,key,uv);return;}
  const u=(axis+1)%3,v=(axis+2)%3,us=points.map(p=>snap(p[u])),vs=points.map(p=>snap(p[v]));
  const U=[...new Set(us)],V=[...new Set(vs)];
  if(U.length!==2||V.length!==2){emit(a,b,c,d,key,uv);return;}
  const sign=Math.sign((b[u]-a[u])*(c[v]-b[v])-(b[v]-a[v])*(c[u]-b[u]));
  if(!sign)return;
  const at=snap(a[axis]),id=`${axis}:${at}:${sign}`;
  if(!planes.has(id))planes.set(id,{axis,u,v,at,sign,faces:[]});
  planes.get(id).faces.push({loU:Math.min(...U),hiU:Math.max(...U),loV:Math.min(...V),hiV:Math.max(...V),key});stats.input++;
 }
 function flush(){
  for(const p of planes.values()){
   const {faces,axis,u,v,at,sign}=p,us=[...new Set(faces.flatMap(f=>[f.loU,f.hiU]))].sort((a,b)=>a-b),vs=[...new Set(faces.flatMap(f=>[f.loV,f.hiV]))].sort((a,b)=>a-b);
   const ui=new Map(us.map((x,i)=>[x,i])),vi=new Map(vs.map((x,i)=>[x,i])),width=us.length-1,height=vs.length-1;
   const keys=[...new Set(faces.map(f=>f.key))],ids=new Map(keys.map((k,i)=>[k,i+1])),cells=new Uint16Array(width*height);
   for(const f of faces){stats.removedArea+=(f.hiU-f.loU)*(f.hiV-f.loV);const id=ids.get(f.key);
    for(let y=vi.get(f.loV);y<vi.get(f.hiV);y++)cells.fill(id,y*width+ui.get(f.loU),y*width+ui.get(f.hiU));
   }
   const point=(x,y)=>{const out=[];out[axis]=at;out[u]=x;out[v]=y;return out;};
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const id=cells[y*width+x];if(!id)continue;let X=x+1,Y=y+1;
    while(X<width&&cells[y*width+X]===id)X++;
    outer:while(Y<height){for(let i=x;i<X;i++)if(cells[Y*width+i]!==id)break outer;Y++;}
    for(let j=y;j<Y;j++)cells.fill(0,j*width+x,j*width+X);
    const corners=[point(us[x],vs[y]),point(us[X],vs[y]),point(us[X],vs[Y]),point(us[x],vs[Y])];
    if(sign<0)corners.reverse();
    emit(...corners,keys[id-1],corners.map(q=>[q[u],q[v]]));stats.output++;stats.removedArea-=(us[X]-us[x])*(vs[Y]-vs[y]);
   }
  }
  planes.clear();return {...stats};
 }
 return {add,flush};
}
