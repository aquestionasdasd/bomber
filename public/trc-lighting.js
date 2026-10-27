import {TRC_BAKE} from './trc-bake.js';
import {TRC_LIGHTING_CONFIG as config,trcProbeAt} from './trc-lighting-config.js';

// Full-stage UVs preserve all existing triangles and collision. Only the metal
// batches are partitioned for local reflection probes, without cutting surfaces.
export function createTrcLighting(T,world,lights=[]){
 const {size,padding}=config,charts=[],groups=[];
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const metalName=name=>/steel|aluminium|trim|glass|album/.test(name);
 const geometry=data=>{const g=new T.BufferGeometry();for(const k of ['position','normal','uv'])g.setAttribute(k,new T.Float32BufferAttribute(data[k],k==='uv'?2:3));g.computeBoundingSphere();return g;};
 for(const mesh of [...world.children]){
  if(!mesh.isMesh||!mesh.name.startsWith('TRC / ')||!metalName(mesh.name)||mesh.geometry.index)continue;
  const attrs=mesh.geometry.attributes,byProbe=new Map();
  for(let i=0;i<attrs.position.count;i+=3){const center=[0,1,2].map(a=>[i,i+1,i+2].reduce((s,j)=>s+attrs.position.array[j*3+a],0)/3),id=trcProbeAt(...center);
   const data=byProbe.get(id)||{position:[],normal:[],uv:[]};byProbe.set(id,data);
   for(const k of ['position','normal','uv'])for(let j=i*attrs[k].itemSize;j<(i+3)*attrs[k].itemSize;j++)data[k].push(attrs[k].array[j]);
  }
  let first=true;const name=mesh.name,base=mesh.material;
  for(const [id,data]of byProbe){const m=first?mesh:new T.Mesh();if(first)mesh.geometry.dispose();m.geometry=geometry(data);m.material=base;m.name=name+' / probe '+id;m.userData.trcProbe=id;m.castShadow=true;m.receiveShadow=true;if(!first)world.add(m);first=false;}
 }
 const bucket=()=>({position:[],normal:[],uv:[],chart:[]});
 for(const mesh of [...world.children]){
  if(!mesh.isMesh||!mesh.name.startsWith('TRC / ')||mesh.geometry.index||!mesh.geometry.attributes.normal||mesh.material.emissiveIntensity>1)continue;
  const attrs=mesh.geometry.attributes,base=mesh.material,baked=bucket();
  if(metalName(mesh.name)){groups.push({mesh,base,name:mesh.name,probe:mesh.userData.trcProbe||'mid'});continue;}
  for(let i=0;i<attrs.position.count;){
   const vertex=j=>({p:[attrs.position.getX(j),attrs.position.getY(j),attrs.position.getZ(j)],n:[attrs.normal.getX(j),attrs.normal.getY(j),attrs.normal.getZ(j)],uv:[attrs.uv.getX(j),attrs.uv.getY(j)]});
   let vertices=[vertex(i),vertex(i+1),vertex(i+2)],points=vertices,count=3;
   // Three's indexed boxes and our raw quads use different triangle orders.
   // Pair either form for a rectangular chart without reordering any vertices.
   const equal=(a,b)=>a.p.every((v,k)=>Math.abs(v-b.p[k])<1e-6);
   if(i+5<attrs.position.count){const next=[vertex(i+3),vertex(i+4),vertex(i+5)],unique=[...vertices];for(const q of next)if(!unique.some(v=>equal(v,q)))unique.push(q);
    if(unique.length===4&&next.every(q=>dot(vertices[0].n,q.n)>.9999)&&unique.every(q=>Math.abs(dot(sub(q.p,vertices[0].p),vertices[0].n))<1e-5)){vertices.push(...next);points=unique;count=6;}
   }i+=count;
   const edges=[];for(let j=0;j<vertices.length;j+=3)for(let k=0;k<3;k++){const a=vertices[j+k],b=vertices[j+(k+1)%3],existing=edges.find(e=>equal(e.a,a)&&equal(e.b,b)||equal(e.a,b)&&equal(e.b,a));if(existing)existing.count++;else edges.push({a,b,count:1});}
   const boundary=edges.find(e=>e.count===1),origin=boundary.a.p,edge=sub(boundary.b.p,origin),len=Math.hypot(...edge);
   if(len<1e-6)throw Error('Degenerate TRC lightmap edge');
   const u=edge.map(v=>v/len),n=vertices[0].n,v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]],coords=points.map(q=>[dot(sub(q.p,origin),u),dot(sub(q.p,origin),v)]);
   const min=coords[0].map((_,k)=>Math.min(...coords.map(p=>p[k]))),max=coords[0].map((_,k)=>Math.max(...coords.map(p=>p[k])));
   if((max[0]-min[0])*(max[1]-min[1])<1e-8)throw Error('Degenerate TRC lightmap chart');
   const rectangular=points.length===4&&coords.every(p=>p.every((q,k)=>Math.min(Math.abs(q-min[k]),Math.abs(q-max[k]))<1e-5));
   const chart={id:charts.length,origin,u,v,min,max,rectangular};charts.push(chart);
   for(const q of vertices){baked.position.push(...q.p);baked.normal.push(...q.n);baked.uv.push(...q.uv);baked.chart.push({v:q,chart});}
  }
  if(!baked.position.length)continue;
  // Do not retriangulate the original geometry: charts reference the original
  // vertex order; all triangles and normals remain exactly where they were.
  groups.push({mesh,base,data:baked,name:mesh.name,probe:mesh.userData.trcProbe||'mid'});
 }
 let density=config.density;
 function pack(){let x=padding,y=padding,row=0;for(const c of [...charts].sort((a,b)=>(b.max[1]-b.min[1])-(a.max[1]-a.min[1])||a.id-b.id)){
  c.w=Math.max(3,Math.ceil((c.max[0]-c.min[0])*density));c.h=Math.max(3,Math.ceil((c.max[1]-c.min[1])*density));
  if(c.w+2*padding>size)return false;if(x+c.w+padding>size){x=padding;y+=row+2*padding;row=0;}if(y+c.h+padding>size)return false;
  c.x=x;c.y=y;x+=c.w+2*padding;row=Math.max(row,c.h);
 }return true;}
 while(!pack()){density*=.85;if(density<2)throw Error('TRC lightmap atlas overflow');}
 let hash=2166136261;const digest=n=>{const value=Math.round(n*1e5);hash=Math.imul(hash^value,16777619)>>>0;};
 for(const group of groups){if(!group.data){for(const n of group.mesh.geometry.attributes.position.array)digest(n);continue;}const uv=[];for(const {v,chart:c}of group.data.chart){const d=sub(v.p,c.origin);uv.push((c.x+.5+(dot(d,c.u)-c.min[0])/(c.max[0]-c.min[0])*Math.max(0,c.w-1))/size,(c.y+.5+(dot(d,c.v)-c.min[1])/(c.max[1]-c.min[1])*Math.max(0,c.h-1))/size);}
  if(uv.length!==group.mesh.geometry.attributes.position.count*2)throw Error('TRC chart vertex mismatch: '+group.name);
  group.mesh.geometry.setAttribute('uv1',new T.Float32BufferAttribute(uv,2));for(const n of [...group.data.position,...uv])digest(n);delete group.data.chart;
 }
 for(const c of JSON.stringify({config,lights,materials:groups.map(g=>[g.name,g.base.color.toArray()])}))digest(c.charCodeAt(0));
 const signature=hash.toString(16),compatible=signature===TRC_BAKE.hash;let enabled=true,ready=false,error=null,collapsed=false;
 const assets=[];
 const update=()=>{for(const g of groups)g.mesh.material=enabled&&ready&&!collapsed?g.study:g.base;};
 function prepare(light,ao,environments){
  for(const g of groups){const color=g.base.color.clone();if(/wall|tile|floor|cream/.test(g.name))color.lerp(new T.Color('#e0c6a1'),.09);if(/rubber/.test(g.name))color.lerp(new T.Color('#82949a'),.22);
   const metal=metalName(g.name);
   // Thin chamfers are smaller than a lightmap texel. Keep their real normals
   // and dynamic lighting instead of projecting undersampled triangle charts.
   const mat=metal?g.base.clone():new T.MeshBasicMaterial({color,map:g.base.map,lightMap:light,lightMapIntensity:config.diffuseIntensity/(TRC_BAKE.encodingScale||1),aoMap:ao,aoMapIntensity:config.aoIntensity});
   if(metal){mat.envMap=environments[g.probe];mat.envMapIntensity=config.reflectionIntensity;}
   mat.name='TRC / baked lighting';g.study=mat;
  }ready=true;update();
 }
 let promise=Promise.resolve(false);
 if(compatible&&typeof Image!=='undefined'){
  const loader=new T.TextureLoader(),root=new URL('./lightmaps/trc/',import.meta.url);
  const url=name=>new URL(name+'.png?v='+(TRC_BAKE.assetHash||signature),root).href;
  const faces=['px','nx','py','ny','pz','nz'];
  promise=Promise.allSettled([loader.loadAsync(url('lighting')),loader.loadAsync(url('ao')),...config.probes.map(p=>new T.CubeTextureLoader().loadAsync(faces.map(n=>url(p.id+'-'+n))))]).then(results=>{
   assets.push(...results.filter(r=>r.status==='fulfilled').map(r=>r.value));
   const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
   const [light,ao,...probes]=assets;
   light.colorSpace=T.LinearSRGBColorSpace;light.channel=1;light.generateMipmaps=false;light.minFilter=T.LinearFilter;
   ao.colorSpace=T.NoColorSpace;ao.channel=1;ao.generateMipmaps=false;ao.minFilter=T.LinearFilter;
   const environments={};for(let i=0;i<probes.length;i++){probes[i].colorSpace=T.SRGBColorSpace;environments[config.probes[i].id]=probes[i];}
   prepare(light,ao,environments);return true;
  }).catch(e=>{error=String(e.message||e);for(const asset of assets)asset.dispose();return false;});
 }else if(!compatible)error='Bake does not match geometry';
 return {groups,lights,config,charts:charts.length,atlas:charts.map(c=>({x:c.x,y:c.y,w:c.w,h:c.h,rectangular:c.rectangular})),size,density,hash:signature,compatible,promise,get ready(){return ready;},get error(){return error;},get enabled(){return enabled;},setEnabled(value){enabled=!!value;update();},syncCollapse(value){collapsed=!!value;update();}};
}
