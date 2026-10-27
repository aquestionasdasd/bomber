import fs from 'node:fs';
import * as T from '../public/vendor/three.module.js';
import {createTrcMap} from '../public/trc-map.js';
// Texture paint is irrelevant to an irradiance (albedo excluded) bake.
const ctx=new Proxy({measureText:()=>({width:80})},{get:(o,k)=>o[k]||(()=>{})});
globalThis.document={createElement:()=>({getContext:()=>ctx})};
const map=createTrcMap(T,new T.Scene()),study=map.lightingStudy;
map.world.updateMatrixWorld(true);
const selected=new Set(study.groups.map(g=>g.mesh)),objects=[];
map.world.traverse(m=>{
 if(!m.isMesh||!m.name.startsWith('TRC / ')||!m.visible||m.userData.trcDoor||m.geometry.attributes.position.count===0)return;
 const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrixWorld);
 const color=m.material.color?.toArray()||[.5,.5,.5];
 objects.push({name:m.name,position:Array.from(g.attributes.position.array),uv:g.attributes.uv1?Array.from(g.attributes.uv1.array):null,selected:selected.has(m),color,emission:m.material.emissive?.toArray().map(v=>v*(m.material.emissiveIntensity||0))||[0,0,0]});g.dispose();
});
const data={hash:study.hash,size:study.size,density:study.density,charts:study.charts,atlas:study.atlas,objects};
fs.writeFileSync(process.argv[2]||'trc-a-bake-input.json',JSON.stringify(data));
console.log(JSON.stringify({hash:data.hash,size:data.size,density:data.density,charts:data.charts,objects:objects.length,triangles:objects.reduce((s,o)=>s+o.position.length/9,0)}));
