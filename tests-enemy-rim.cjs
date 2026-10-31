const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');

async function main(){
  const started=performance.now(),load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [THREE,{createEnemyRim},{createAgentModel},{DuelistKit,CHARACTER_DEFS}]=await Promise.all([load('vendor/three.module.js'),load('enemy-rim.js'),load('agent-model.js'),load('abilities.js')]);
  const disposals=new Map(),watch=object=>{if(!disposals.has(object)){disposals.set(object,0);object.addEventListener('dispose',()=>disposals.set(object,disposals.get(object)+1));}return object;};
  const compile=material=>{const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader,{});return shader;};
  const geometry=watch(new THREE.BoxGeometry(1,1,1)),texture=watch(new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1));
  const source=watch(new THREE.MeshPhysicalMaterial({color:0x627e91,map:texture,transparent:true,opacity:.4,depthTest:true,depthWrite:false,side:THREE.DoubleSide,alphaTest:.13}));
  source.userData.identity='original-finish';let priorCompile=0,priorDraw=0;
  source.onBeforeCompile=function(shader){priorCompile++;assert.equal(this.userData.identity,'original-finish');shader.uniforms.originalHook={value:3};shader.fragmentShader+='\n// previous shader hook';};
  source.onBeforeRender=function(){priorDraw++;};source.customProgramCacheKey=()=> 'custom-original-program';
  const originalCompile=source.onBeforeCompile,originalBefore=source.onBeforeRender,originalKey=source.customProgramCacheKey,sourceVersion=source.version;
  const enemyMesh=new THREE.Mesh(geometry,source),allyMesh=new THREE.Mesh(geometry,source),secondEnemy=new THREE.Mesh(geometry,source),basic=watch(new THREE.MeshBasicMaterial({color:0xffffff}));
  const arrayMesh=new THREE.Mesh(geometry,[source,basic]),enemy=createEnemyRim(),ally=createEnemyRim(),second=createEnemyRim();
  enemy.register([enemyMesh,arrayMesh]);enemy.register(enemyMesh);ally.register(allyMesh);second.register(secondEnemy);
  assert.equal(enemyMesh.material,source,'Registering an unmarked model never creates a new material');
  enemy.setEnabled(true);const highlight=watch(enemyMesh.material);
  assert.notEqual(highlight,source);assert.equal(allyMesh.material,source,'An ally borrowing the exact same source finish remains unmodified');
  assert.equal(arrayMesh.material[0],highlight);assert.equal(arrayMesh.material[1],basic,'Non-standard materials are untouched');
  assert.equal(source.onBeforeCompile,originalCompile);assert.equal(source.onBeforeRender,originalBefore);assert.equal(source.customProgramCacheKey,originalKey);assert.equal(source.version,sourceVersion);
  assert.equal(highlight.map,texture);assert.notEqual(highlight.color,source.color);assert.equal(highlight.color.getHex(),source.color.getHex());
  for(const property of ['opacity','transparent','depthTest','depthWrite','side','blending','alphaTest','colorWrite','stencilWrite','polygonOffset','forceSinglePass'])assert.equal(highlight[property],source[property],`The rim preserves normal surface ${property}`);
  assert.equal(highlight.onBeforeRender,originalBefore);highlight.onBeforeRender();assert.equal(priorDraw,1,'The existing draw hook still runs');
  assert.equal(highlight.customProgramCacheKey(),'custom-original-program|enemy-rim-v2');assert.equal(source.customProgramCacheKey(),'custom-original-program');
  const shader=compile(highlight);assert.equal(priorCompile,1);assert.equal(shader.uniforms.originalHook.value,3);assert.ok(shader.fragmentShader.includes('// previous shader hook'));
  assert.equal(shader.uniforms.enemyRimStrength.value,1,'The enemy program has a fixed strength instead of a leaking per-draw shared uniform');
  const allyShader=compile(source);assert.equal(allyShader.uniforms.enemyRimStrength,undefined,'The ally shader has no injected enemy uniform or tint');
  assert.ok(shader.vertexShader.indexOf('vEnemyRimNormal = transformedNormal;')>shader.vertexShader.indexOf('#include <defaultnormal_vertex>'));
  assert.ok(shader.vertexShader.indexOf('vEnemyRimViewPosition = -mvPosition.xyz;')>shader.vertexShader.indexOf('#include <project_vertex>'));
  assert.ok(shader.fragmentShader.indexOf('outgoingLight = mix(')<shader.fragmentShader.indexOf('#include <opaque_fragment>'),'Tint affects only the existing opaque surface output');
  assert.match(shader.fragmentShader,/smoothstep\(0\.18, 0\.72, 1\.0 - enemyRimFacing\)/);
  assert.doesNotMatch(shader.fragmentShader,/gl_FragDepth|depthFunc|discard\s*;/,'No depth override or extra reveal pass is introduced');
  // Exercise the actual GLSL constants: front-facing centers stay unchanged,
  // while increasing grazing angles form a continuous edge gradient.
  const match=shader.fragmentShader.match(/smoothstep\(([\d.]+), ([\d.]+), 1\.0 - enemyRimFacing\)/),low=Number(match[1]),high=Number(match[2]);
  const weight=facing=>{const x=Math.max(0,Math.min(1,((1-Math.abs(facing))-low)/(high-low)));return x*x*(3-2*x)*.98;};
  assert.equal(weight(1),0);assert.equal(weight(.85),0);assert.ok(weight(.7)>0&&weight(.7)<weight(.5)&&weight(.5)<weight(.3));assert.equal(weight(0),.98);
  const previousWeight=facing=>{const x=Math.max(0,Math.min(1,((1-Math.abs(facing))-.35)/(.92-.35)));return x*x*(3-2*x)*.85;};
  for(const facing of [.8,.7,.5,.3,.1,0])assert.ok(weight(facing)>previousWeight(facing),'The new rim is wider and stronger across the visible edge band');
  assert.match(shader.fragmentShader,/vec3\(1\.6, 0\.003, 0\.002\)/,'The edge uses a brighter saturated red');
  assert.equal(weight(-.2),weight(.2),'Back-facing double-sided cloth receives the same bounded edge response');
  second.setEnabled(true);assert.equal(secondEnemy.material,highlight,'Two enemies share one highlighted clone for the same source material');
  for(let i=0;i<300;i++){
    enemy.setEnabled(false);assert.equal(enemyMesh.material,source);assert.equal(arrayMesh.material[0],source);assert.equal(allyMesh.material,source);
    enemy.setEnabled(true);assert.equal(enemyMesh.material,highlight);assert.equal(allyMesh.material,source);assert.equal(secondEnemy.material,highlight);
  }
  const lateMesh=new THREE.Mesh(geometry,source);enemy.register(lateMesh);assert.equal(lateMesh.material,highlight,'An avatar created while the effect is on receives the current state');
  enemy.dispose();enemy.dispose();assert.equal(enemyMesh.material,source);assert.equal(lateMesh.material,source);assert.equal(disposals.get(highlight),0,'The second enemy still owns the shared clone');
  second.dispose();second.dispose();assert.equal(secondEnemy.material,source);assert.equal(disposals.get(highlight),1);ally.dispose();ally.dispose();
  for(const object of [source,texture,geometry,basic])assert.equal(disposals.get(object),0,'Rim cleanup never disposes the original finish, image or geometry');
  const fresh=createEnemyRim();fresh.register(enemyMesh);fresh.setEnabled(true);const replacement=watch(enemyMesh.material);assert.notEqual(replacement,highlight,'A released clone cannot be resurrected');fresh.dispose();assert.equal(disposals.get(replacement),1);
  enemy.setEnabled(true);enemy.register(new THREE.Mesh(geometry,source));assert.equal(enemyMesh.material,source,'A disposed controller cannot resume or register more work');
  for(const object of [source,texture,geometry,basic])object.dispose();
  console.log('PASS: shared enemy/ally isolation, 300 toggles, material arrays, old hooks/cache keys, depth/alpha and gradient, last-owner clone cleanup');

  const meshesOf=model=>{const meshes=[];model.group.traverse(object=>{if(object.isMesh)meshes.push(object);});return meshes;};
  const originals=new Map(),clones=new Set(),models=[],roles=['duelist','nope','mend','echo','veil','ember','frost','duck','cat','car','nobi','japan','cap','urchin'];
  const excluded=mesh=>{for(let node=mesh;node;node=node.parent)if(node.name.startsWith('Equipment / ')||node.name.startsWith('Blade storm / '))return true;return mesh.geometry.type==='RingGeometry';};
  const snapshot=model=>new Map(meshesOf(model).map(mesh=>[mesh,{geometry:mesh.geometry,material:mesh.material,raycast:mesh.raycast}]));
  function checkModel(model,baseline,enabled){
    let highlightedVisible=0;
    for(const [mesh,before]of baseline){
      assert.equal(mesh.geometry,before.geometry);assert.equal(mesh.raycast,before.raycast);
      if(!before.material.isMeshStandardMaterial||excluded(mesh))assert.equal(mesh.material,before.material,'Weapons, knife fan and team ring keep their original materials');
      else if(enabled){
        assert.notEqual(mesh.material,before.material);assert.ok(mesh.material.customProgramCacheKey().endsWith('|enemy-rim-v2'));clones.add(watch(mesh.material));
        if(mesh.visible)highlightedVisible++;
      }else assert.equal(mesh.material,before.material,'Disabling restores every original body/avatar material identity');
    }
    if(enabled)assert.ok(highlightedVisible>0,'The selected actual avatar has highlightable visible surfaces');
  }
  for(const character of roles){
    const model=createAgentModel(THREE,{bot:{id:`rim-${character}`},team:'red',character}),reference=createAgentModel(THREE,{bot:{id:`ally-${character}`},team:'blue',character});models.push(model,reference);
    assert.equal(model.meshes.length,52,'Each role starts with the same 52 body/head/default-weapon hit meshes');
    for(const current of [model,reference])for(const weapon of ['vandal','phantom','spectre','classic','ghost','knife'])current.update(0,{weapon,alive:true,enemyRim:false});
    const before=snapshot(model),referenceBefore=snapshot(reference);originals.set(model,before);originals.set(reference,referenceBefore);
    const hitMeshes=[...model.meshes];model.update(0,{enemyRim:true});checkModel(model,before,true);checkModel(reference,referenceBefore,false);
    model.update(0,{alive:true});checkModel(model,before,true,'Snapshots omitting enemyRim keep the current flag');
    for(const pose of [{moving:true},{firing:true,shotSequence:1},{planting:true},{defusing:true},{alive:false},{alive:true}]){
      const state={alive:true,weapon:'vandal',time:1,...pose};model.update(1/60,{...state,enemyRim:true});reference.update(1/60,{...state,enemyRim:false});model.group.updateMatrixWorld(true);reference.group.updateMatrixWorld(true);
      assert.deepEqual(model.meshes,hitMeshes);assert.deepEqual(model.meshes.map(mesh=>mesh.matrixWorld.elements),reference.meshes.map(mesh=>mesh.matrixWorld.elements),'The shader cannot change a head/body/weapon combat pose');
    }
    model.update(0,{enemyRim:false});checkModel(model,before,false);
  }
  const switching=models[0];for(const character of roles)switching.update(0,{character,alive:true,enemyRim:false});
  const switchBefore=snapshot(switching),geometrySet=new Set([...switchBefore.values()].map(item=>item.geometry)),objectCount=meshesOf(switching).length;
  for(let i=0;i<300;i++){
    const enabled=i%2===0;switching.update(1/60,{character:roles[i%roles.length],alive:true,enemyRim:enabled,time:i/60});checkModel(switching,switchBefore,enabled);
    assert.equal(meshesOf(switching).length,objectCount,'Switches and red edges never add shells, outlines or draws');assert.deepEqual(new Set(meshesOf(switching).map(mesh=>mesh.geometry)),geometrySet);
  }
  switching.update(0,{enemyRim:false});checkModel(switching,switchBefore,false);
  for(const model of models){model.dispose();model.dispose();}
  for(const clone of clones)assert.equal(disposals.get(clone),1,'Every highlighted clone is disposed once after the final avatar owner leaves');
  console.log('PASS: all fourteen actual avatars/52 hit meshes/all weapon caches, pose preservation, weapons/ring excluded, 300 role changes without extra geometry');

  const gameSource=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
  function extract(name){
    const begin=gameSource.indexOf(`function ${name}(`);assert.ok(begin>=0,`${name} exists in the game`);let depth=0,quote=null,escaped=false;
    for(let i=gameSource.indexOf('{',begin);i<gameSource.length;i++){
      const c=gameSource[i];if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote=null;continue;}
      if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return gameSource.slice(begin,i+1);
    }
    throw Error(`Unclosed function ${name}`);
  }
  const {roundDanceState}=await load('victory-dance.js');
  // This rim-only fixture has no active slide effect; character labels come
  // from the same real definitions as makeBot, including its first frame.
  const context=vm.createContext({roundDanceState,frostSlideSpeed:()=>0,reducedMotion:{matches:false},THREE,DuelistKit,CHARACTER_DEFS,createAgentModel,characterIds:roles,player:{alive:true,team:'blue'},spectatedBot:null,mode:'play',elapsed:0,match:{attackerTeam:'blue'},map:{spawnYaw:{attack:0,defend:1.93878}},bots:[],botsGroup:new THREE.Group()});
  vm.runInContext([extract('enemyRimFor'),extract('agentEquipment'),extract('makeBot')].join('\n'),context);
  const equipment=(team,extra={})=>{context.testBot={team,...extra};return vm.runInContext('agentEquipment(testBot)',context);};
  assert.equal(equipment('red').enemyRim,true);assert.equal(equipment('blue').enemyRim,false);
  context.player.team='red';assert.equal(equipment('blue').enemyRim,true,'A red guest highlights blue opponents');assert.equal(equipment('red').enemyRim,false);
  context.player.alive=false;context.spectatedBot={team:'blue'};assert.equal(equipment('red').enemyRim,true);assert.equal(equipment('blue').enemyRim,false,'Death spectating uses the watched teammate team');
  context.player.alive=true;assert.equal(equipment('blue').enemyRim,true,'Revival ignores the stale spectator team');context.player.alive=false;context.spectatedBot=null;assert.equal(equipment('blue').enemyRim,true,'A dead player with no target retains its own team');
  context.mode='menu';assert.equal(equipment('blue').enemyRim,false);context.mode='play';assert.equal(equipment('unknown').enemyRim,false);context.player.team='unknown';assert.equal(equipment('red').enemyRim,false);
  context.player={team:'red',alive:true};
  vm.runInContext("makeBot({x:0,z:0},0,'blue',{id:'blue-0',secondary:'classic'})",context);
  const freshBot=context.bots[0],initialMaterials=meshesOf(freshBot.visual).filter(mesh=>mesh.material.isMeshStandardMaterial&&!excluded(mesh)).map(mesh=>mesh.material);
  assert.ok(initialMaterials.length&&initialMaterials.every(material=>material.customProgramCacheKey().endsWith('|enemy-rim-v2')),'The first fresh-snapshot frame already receives the viewer-relative enemy flag');freshBot.visual.dispose();
  const visualCalls=[...gameSource.matchAll(/(?:bot\.)?visual\.update\(([^;\n]+)\)/g)];assert.ok(visualCalls.length>=6);for(const call of visualCalls)assert.ok(call[1].includes('...agentEquipment(bot)'),'Every creation/death/range/remote/buy/AI visual path uses the same relative-team equipment state');
  console.log('PASS: actual game helpers and makeBot first frame, blue/red guest teams, spectating/revival, menu/invalid guards, six visual update paths');
  console.log(JSON.stringify({elapsedMs:Math.round(performance.now()-started),characters:roles.length,controllerToggles:300,roleSwitches:300,highlightClones:clones.size,extraGeometries:0}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
