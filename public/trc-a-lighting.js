import {TRC_A_BAKE} from './trc-a-bake.js';

// A deliberately local lighting study. Geometry, collision and other rooms keep
// the same contract. UV charts are deterministic so an obsolete bake is rejected.
export function createTrcAStudy(T,world){
 const size=2048,padding=4,charts=[],groups=[],bounds=[[-45,-19],[0,5.65],[-7.5,42]];
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
 function split(poly,axis,at,sign){
  if(poly.every(v=>(v.p[axis]-at)*sign>=-1e-7))return [poly,[]];
  if(poly.every(v=>(v.p[axis]-at)*sign<=1e-7))return [[],poly];
  const inside=[],outside=[];for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=(a.p[axis]-at)*sign,db=(b.p[axis]-at)*sign;
  if(da>=-1e-7)inside.push(a);if(da<=1e-7)outside.push(a);if((da>1e-7&&db< -1e-7)||(da< -1e-7&&db>1e-7)){
   const f=da/(da-db),v={};for(const k of ['p','n','uv'])v[k]=a[k].map((x,j)=>x+(b[k][j]-x)*f);inside.push(v);outside.push(v);
  }
 }return [inside,outside];}
 function append(bucket,poly,chart=null){if(poly.length<3)return;for(let i=1;i<poly.length-1;i++)for(const v of [poly[0],poly[i],poly[i+1]]){
  bucket.position.push(...v.p);bucket.normal.push(...v.n);bucket.uv.push(...v.uv);if(chart)bucket.chart.push({v,chart});
 }}
 const bucket=()=>({position:[],normal:[],uv:[],chart:[]});
 for(const mesh of [...world.children]){
  if(!mesh.isMesh||!mesh.name.startsWith('TRC / ')||mesh.geometry.index||!mesh.geometry.attributes.normal||mesh.material.emissiveIntensity>1)continue;
  const attrs=mesh.geometry.attributes,base=mesh.material,out=bucket(),baked=bucket();
  for(let i=0;i<attrs.position.count;){
   const vertex=j=>({p:[attrs.position.getX(j),attrs.position.getY(j),attrs.position.getZ(j)],n:[attrs.normal.getX(j),attrs.normal.getY(j),attrs.normal.getZ(j)],uv:[attrs.uv.getX(j),attrs.uv.getY(j)]});
   let poly=[vertex(i),vertex(i+1),vertex(i+2)],count=3;
   if(i+5<attrs.position.count&&poly[0].p.every((v,k)=>Math.abs(v-vertex(i+3).p[k])<1e-6)&&poly[2].p.every((v,k)=>Math.abs(v-vertex(i+4).p[k])<1e-6)&&dot(poly[0].n,vertex(i+5).n)>.9999){poly.push(vertex(i+5));count=6;}i+=count;
   if(bounds.some(([lo,hi],a)=>poly.every(v=>v.p[a]<lo-1e-6)||poly.every(v=>v.p[a]>hi+1e-6))){append(out,poly);continue;}
   for(let a=0;a<3&&poly.length;a++)for(const [at,sign]of [[bounds[a][0],1],[bounds[a][1],-1]]){const parts=split(poly,a,at,sign);append(out,parts[1]);poly=parts[0];}
   if(poly.length<3)continue;
   const origin=poly[0].p,edge=sub(poly[1].p,origin),len=Math.hypot(...edge);if(len<1e-6){append(out,poly);continue;}
   const u=edge.map(v=>v/len),n=poly[0].n,v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]],coords=poly.map(q=>[dot(sub(q.p,origin),u),dot(sub(q.p,origin),v)]);
   const min=coords[0].map((_,k)=>Math.min(...coords.map(p=>p[k]))),max=coords[0].map((_,k)=>Math.max(...coords.map(p=>p[k])));
   if((max[0]-min[0])*(max[1]-min[1])<1e-8){append(out,poly);continue;}
   const chart={id:charts.length,origin,u,v,min,max,rectangular:poly.length===4};charts.push(chart);append(baked,poly,chart);
  }
  if(!baked.position.length)continue;
  const geometry=data=>{const g=new T.BufferGeometry();for(const k of ['position','normal','uv'])g.setAttribute(k,new T.Float32BufferAttribute(data[k],k==='uv'?2:3));g.computeBoundingSphere();return g;};
  mesh.geometry.dispose();mesh.geometry=geometry(out);
  const g=geometry(baked),m=new T.Mesh(g,base);m.name=mesh.name+' / A study';m.castShadow=true;m.receiveShadow=true;world.add(m);
  groups.push({mesh:m,base,data:baked,name:mesh.name});
 }
 let density=20;
 function pack(){let x=padding,y=padding,row=0;for(const c of [...charts].sort((a,b)=>(b.max[1]-b.min[1])-(a.max[1]-a.min[1])||a.id-b.id)){
  c.w=Math.max(1,Math.ceil((c.max[0]-c.min[0])*density));c.h=Math.max(1,Math.ceil((c.max[1]-c.min[1])*density));
  if(c.w+2*padding>size)return false;if(x+c.w+padding>size){x=padding;y+=row+2*padding;row=0;}if(y+c.h+padding>size)return false;
  c.x=x;c.y=y;x+=c.w+2*padding;row=Math.max(row,c.h);
 }return true;}
 while(!pack()){density*=.85;if(density<2)throw Error('TRC lightmap atlas overflow');}
 let hash=2166136261;const digest=n=>{const value=Math.round(n*1e5);hash=Math.imul(hash^value,16777619)>>>0;};
 for(const group of groups){const uv=[];for(const {v,chart:c}of group.data.chart){const d=sub(v.p,c.origin);uv.push((c.x+.5+(dot(d,c.u)-c.min[0])/(c.max[0]-c.min[0])*Math.max(0,c.w-1))/size,(c.y+.5+(dot(d,c.v)-c.min[1])/(c.max[1]-c.min[1])*Math.max(0,c.h-1))/size);}
  group.mesh.geometry.setAttribute('uv1',new T.Float32BufferAttribute(uv,2));for(const n of [...group.data.position,...uv])digest(n);delete group.data.chart;
 }
 const signature=hash.toString(16),compatible=signature===TRC_A_BAKE.hash;let enabled=true,ready=false,error=null,collapsed=false;
 const assets=[];
 const update=()=>{for(const g of groups)g.mesh.material=enabled&&ready&&!collapsed?g.study:g.base;};
 function prepare(light,ao,env){
  for(const g of groups){const color=g.base.color.clone();if(/wall|tile|floor|cream/.test(g.name))color.lerp(new T.Color('#e0c6a1'),.09);
   const metal=/steel|aluminium|trim/.test(g.name);
   // Thin chamfers are smaller than a lightmap texel. Keep their real normals
   // and dynamic lighting instead of projecting undersampled triangle charts.
   const mat=metal?g.base.clone():new T.MeshBasicMaterial({color,map:g.base.map,lightMap:light,lightMapIntensity:2.4/(TRC_A_BAKE.encodingScale||1),aoMap:ao,aoMapIntensity:.18});
   if(metal){mat.envMap=env;mat.envMapIntensity=.18;}
   mat.name='TRC A / baked diffuse';g.study=mat;
  }ready=true;update();
 }
 let promise=Promise.resolve(false);
 if(compatible&&typeof Image!=='undefined'){
  const loader=new T.TextureLoader(),root=new URL('./lightmaps/trc-a/',import.meta.url);
  const url=name=>new URL(name+'.png?v='+(TRC_A_BAKE.assetHash||signature),root).href;
  promise=Promise.all([loader.loadAsync(url('lighting')),loader.loadAsync(url('ao')),new T.CubeTextureLoader().loadAsync(['px','nx','py','ny','pz','nz'].map(url))]).then(([light,ao,env])=>{
   light.colorSpace=T.LinearSRGBColorSpace;light.channel=1;ao.colorSpace=T.NoColorSpace;ao.channel=1;env.colorSpace=T.SRGBColorSpace;assets.push(light,ao,env);prepare(light,ao,env);return true;
  }).catch(e=>{error=String(e.message||e);return false;});
 }else if(!compatible)error='Bake does not match geometry';
 return {groups,charts:charts.length,atlas:charts.map(c=>({x:c.x,y:c.y,w:c.w,h:c.h,rectangular:c.rectangular})),size,density,hash:signature,compatible,promise,get ready(){return ready;},get error(){return error;},get enabled(){return enabled;},setEnabled(value){enabled=!!value;update();},syncCollapse(value){collapsed=!!value;update();}};
}
