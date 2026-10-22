// A normal-lit surface effect: no shell, extra draw, depth override or outline
// pass. Only highlighted users borrow a clone; original shared finishes remain
// completely untouched for allies, previews, weapons and other owners.
const highlightedMaterials=new WeakMap();
const PROGRAM_KEY='enemy-rim-v1';

function acquireMaterial(source){
  if(!source?.isMeshStandardMaterial)return null;
  let entry=highlightedMaterials.get(source);
  if(!entry){
    const material=source.clone(),previousCompile=source.onBeforeCompile,previousKey=source.customProgramCacheKey;
    material.onBeforeRender=source.onBeforeRender;
    material.onBeforeCompile=function(shader,renderer){
      previousCompile.call(this,shader,renderer);
      // r160 Standard/Physical use these same chunks, after morph/skinning and
      // before tone mapping. Keep the broad geometric normal free of bump noise.
      shader.uniforms.enemyRimStrength={value:1};
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>','#include <common>\nvarying vec3 vEnemyRimNormal;\nvarying vec3 vEnemyRimViewPosition;')
        .replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvEnemyRimNormal = transformedNormal;')
        .replace('#include <project_vertex>','#include <project_vertex>\nvEnemyRimViewPosition = -mvPosition.xyz;');
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>','#include <common>\nuniform float enemyRimStrength;\nvarying vec3 vEnemyRimNormal;\nvarying vec3 vEnemyRimViewPosition;')
        .replace('#include <opaque_fragment>',`
float enemyRimFacing = clamp(abs(dot(normalize(vEnemyRimNormal), normalize(vEnemyRimViewPosition))), 0.0, 1.0);
float enemyRimEdge = smoothstep(0.35, 0.92, 1.0 - enemyRimFacing) * enemyRimStrength;
outgoingLight = mix(outgoingLight, vec3(1.05, 0.012, 0.006), enemyRimEdge * 0.85);
#include <opaque_fragment>`);
    };
    material.customProgramCacheKey=function(){return `${previousKey.call(source)}|${PROGRAM_KEY}`;};
    entry={material,references:0};highlightedMaterials.set(source,entry);
  }
  entry.references++;let released=false;
  return {material:entry.material,release(){
    if(released)return;released=true;
    if(--entry.references===0){entry.material.dispose();highlightedMaterials.delete(source);}
  }};
}

export function createEnemyRim(){
  const meshes=new Map(),borrowed=new Map();let enabled=false,disposed=false;
  const highlight=source=>{
    if(!source?.isMeshStandardMaterial)return source;
    if(!borrowed.has(source))borrowed.set(source,acquireMaterial(source));
    return borrowed.get(source).material;
  };
  const apply=(mesh,source)=>{mesh.material=enabled?(Array.isArray(source)?source.map(highlight):highlight(source)):source;};
  function register(root){
    if(disposed||!root)return;
    if(Array.isArray(root)){for(const object of root)register(object);return;}
    if(root.isMesh&&!meshes.has(root)){const source=root.material;meshes.set(root,source);apply(root,source);}
    if(!root.isMesh)for(const child of root.children||[])register(child);
  }
  function setEnabled(value){
    if(disposed||enabled===Boolean(value))return;enabled=Boolean(value);
    // Different material IDs guarantee a GPU uniform refresh in Three r160;
    // per-mesh edits to one shared StandardMaterial uniform do not do so.
    for(const [mesh,source]of meshes)apply(mesh,source);
  }
  function dispose(){
    if(disposed)return;disposed=true;
    for(const [mesh,source]of meshes)mesh.material=source;
    for(const lease of borrowed.values())lease.release();meshes.clear();borrowed.clear();
  }
  return {register,setEnabled,dispose};
}
