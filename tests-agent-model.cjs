const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

async function main() {
  const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);
  const [THREE, {createAgentModel, createEquipmentSurface, createWeaponModel}, {createViewmodel}, {createDroppedEquipment}] = await Promise.all([
    load('vendor/three.module.js'), load('agent-model.js'), load('viewmodel.js'), load('dropped-equipment.js'),
  ]);
  const isHeadHit=hit=>hit?.hitZone==='head'||hit?.object.userData.head===true;
  const digest = value => createHash('sha256').update(value).digest('hex');
  function resources(root) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(object => {
      if (!object.isMesh && !object.isLine) return;
      geometries.add(object.geometry);
      for (const material of [].concat(object.material)) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    return {geometries, materials, textures};
  }
  const agentTextures = model => [...resources(model.group).textures].filter(texture => texture.name.startsWith('Agent finish / '));
  function watch(items) {
    const counts = new Map();
    for (const item of items) {counts.set(item, 0); item.addEventListener('dispose', () => counts.set(item, counts.get(item) + 1));}
    return counts;
  }
  function allCounts(counts, expected, label) {for (const count of counts.values()) assert.equal(count, expected, label);}
  function matrixClose(actual,expected,label) {for(let i=0;i<16;i++)assert.ok(Math.abs(actual.elements[i]-expected.elements[i])<1e-10,label);}
  function effectivelyVisible(object) {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    return true;
  }
  function appearanceMeshes(model,character='mend',prefix='Sunflower / ') {
    const meshes=[];
    model.group.traverse(object=>{if(object.isMesh&&object.userData.character===character&&object.name.startsWith(prefix))meshes.push(object);});
    return meshes;
  }
  function appearanceResources(model,character='mend',prefix='Sunflower / ') {
    const geometries=new Set(),materials=new Set(),textures=new Set();
    for(const mesh of appearanceMeshes(model,character,prefix)){
      geometries.add(mesh.geometry);
      for(const material of [].concat(mesh.material)){
        materials.add(material);
        for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
      }
    }
    return {geometries,materials,textures};
  }
  function addGeometry(hash, geometry) {
    hash.update(geometry.type);
    for (const name of Object.keys(geometry.attributes).sort()) {
      const attribute = geometry.attributes[name]; hash.update(name);
      hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    }
    if (geometry.index) hash.update(Buffer.from(geometry.index.array.buffer));
  }
  function avatarGeometrySignature(geometries) {
    const hash=createHash('sha256');for(const geometry of geometries){
      addGeometry(hash,geometry);
      for(const name of Object.keys(geometry.morphAttributes).sort())for(const attribute of geometry.morphAttributes[name]){
        hash.update(name);hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
      }
    }
    return hash.digest('hex');
  }
  // Keep the original rig snapshot, including its old visibility contract,
  // separate from the intentional complete cosmetic replacements.
  const avatarRoot=/^(?:Sunflower avatar|Star mascot avatar|Solder avatar|IAGNU avatar|Ono avatar|Grass block avatar|NOPE avatar)(?: \/|$)/;
  function legacyTraverse(object,visit) {
    if(avatarRoot.test(object.name)||object.isMesh&&object.userData.character)return;
    visit(object);for(const child of object.children)legacyTraverse(child,visit);
  }
  function legacyBody(object) {
    if(!object.isMesh||!object.userData.bot)return false;
    for(let node=object;node;node=node.parent)if(node.name.startsWith('Equipment / '))return false;
    return true;
  }
  const legacyVisible=object=>legacyBody(object)||object.visible;
  // Merged, non-indexed decoration still has distinct connected surfaces.
  // Weld equal coordinates before counting so individual triangles do not
  // masquerade as separate stars.
  function componentBounds(geometry) {
    const position=geometry.getAttribute('position'),points=[],parents=[],welded=new Map(),ids=[];
    const find=id=>{while(parents[id]!==id){parents[id]=parents[parents[id]];id=parents[id];}return id;};
    for(let i=0;i<position.count;i++){
      const point=new THREE.Vector3().fromBufferAttribute(position,i),key=point.toArray().map(value=>Math.round(value*1e6)).join(',');
      if(!welded.has(key)){welded.set(key,points.length);parents.push(points.length);points.push(point);}ids.push(welded.get(key));
    }
    const indices=geometry.index?.array??ids.map((_,i)=>i);
    for(let i=0;i<indices.length;i+=3){const a=find(ids[indices[i]]);for(let k=1;k<3;k++)parents[find(ids[indices[i+k]])]=a;}
    const boxes=new Map();for(let i=0;i<points.length;i++){const root=find(i);if(!boxes.has(root))boxes.set(root,new THREE.Box3());boxes.get(root).expandByPoint(points[i]);}
    return [...boxes.values()];
  }
  // The NOPE mascot hides, but never modifies, the old combat proxies. Preserve
  // every old body/weapon byte and compare its visibility before cosmetic hiding.
  const bot = {id:'fixture'}, agent = createAgentModel(THREE, {bot, team:'red', variant:0,character:'nope'});
  agent.group.updateMatrixWorld(true);
  const geometryHash = createHash('sha256'), flags = [];
  let visibleMeshes = 0, triangles = 0;
  agent.group.traverse(object => {
    if (!object.isMesh||object.userData.character) return;
    addGeometry(geometryHash, object.geometry);
    flags.push([!!object.userData.head, !!object.userData.bot, object.castShadow, object.receiveShadow]);
  });
  legacyTraverse(agent.group,object => {
    if (!object.isMesh||!legacyBody(object)&&!effectivelyVisible(object)) return; visibleMeshes++;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  });
  // Recorded before the finish-only change: all positions, normals, UVs,
  // indices and hit flags must remain byte-for-byte identical.
  assert.equal(geometryHash.digest('hex'), 'a7530b1352a3ee1429863449af2f05d1951dce539ab1edacba2cb1d34d19dd89');
  assert.equal(digest(JSON.stringify(flags)), 'da97aedc229a7ce962ee20f287a70a2ce5ceb9489f91a42b3adfa92f2bb84a85');
  assert.equal(visibleMeshes, 53); assert.equal(triangles, 14318);
  const bounds = new THREE.Box3();
  legacyTraverse(agent.group,object=>{if(object.isMesh)bounds.union(new THREE.Box3().setFromObject(object,true));});
  assert.ok(Math.abs(bounds.min.y - .003) < 1e-7 && Math.abs(bounds.max.y - 1.8343485675775448) < 1e-7);
  const ray = new THREE.Raycaster(new THREE.Vector3(0,1.65,5), new THREE.Vector3(0,0,-1));
  assert.equal(isHeadHit(ray.intersectObject(agent.group, true)[0]), true, 'The real headshot surface remains reachable');
  ray.set(new THREE.Vector3(0,1.17,5), new THREE.Vector3(0,0,-1));
  assert.equal(isHeadHit(ray.intersectObject(agent.group, true)[0]), false, 'The chest remains a body hit');

  const finishes = agentTextures(agent);
  assert.equal(finishes.length, 4);
  const initialFinishes = new Set(finishes), pixels = new Map();
  let baseBytes = 0;
  for (const texture of finishes) {
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace); assert.equal(texture.generateMipmaps, true);
    assert.ok(texture.image.width <= 256 && texture.image.height <= 256);
    baseBytes += texture.image.data.byteLength; pixels.set(texture.name, digest(texture.image.data));
    const values = texture.image.data;
    let minimum = 255, maximum = 0;
    for (let offset = 0; offset < values.length; offset += 4) {
      assert.equal(values[offset + 3], 255, 'Body finish cannot create transparent holes or alter hit silhouettes');
      minimum = Math.min(minimum, values[offset]); maximum = Math.max(maximum, values[offset]);
    }
    assert.ok(maximum - minimum >= 20, 'The finish must contain visible local detail');
    assert.ok(minimum >= 115, 'Finishes stay restrained, without black grime or opaque ink seams');
  }
  assert.equal(baseBytes, 458752);
  const sharedDisposal = watch(finishes), blue = createAgentModel(THREE, {bot:{id:'blue'}, team:'blue', variant:1,character:'nope'});
  const initialNopeShared=new Set();
  for(const model of [agent,blue]){const assets=appearanceResources(model,'nope','NOPE avatar / ');for(const resource of [...assets.geometries,...assets.materials,...assets.textures])initialNopeShared.add(resource);}
  const initialNopeDisposal=watch(initialNopeShared);
  assert.deepEqual(new Set(agentTextures(blue)), initialFinishes, 'Both teams borrow the same images');
  const armorOf = model => [...resources(model.group).materials].find(material => material.map?.name === 'Agent finish / armor');
  assert.equal(armorOf(agent).color.getHexString(), 'a76057'); assert.equal(armorOf(blue).color.getHexString(), '438b91');
  blue.dispose(); blue.dispose(); allCounts(sharedDisposal, 0, 'Disposing one borrower cannot release images used by another');

  const animation = createHash('sha256');
  for (const id of ['vandal','phantom','spectre','classic','ghost','knife']) {
    for (const pose of [{},{moving:true},{planting:true},{defusing:true},{alive:false},{alive:true}]) {
      for (let frame = 0; frame < 12; frame++) {
        agent.update(1/60, {alive:true, weapon:id, time:frame/60, ...pose});
        legacyTraverse(agent.group,object => {object.updateMatrix(); animation.update(JSON.stringify([legacyVisible(object), ...object.matrix.elements]));});
      }
    }
    const weapon = agent.group.getObjectByName(`Equipment / ${id}`);
    for (const texture of resources(weapon).textures) assert.equal(initialFinishes.has(texture), false, 'World weapons cannot acquire body finishes');
  }
  assert.equal(animation.digest('hex'), '1d5c31a9af7e04edbc1ea2f51a3d0d67ec6fb2fca21c461bbb107a8a60235cba', 'Every mesh transform and visibility in the existing six-weapon animation remains unchanged');
  assert.deepEqual(new Set(agentTextures(agent)), initialFinishes, 'Animation and weapon switching cannot allocate body textures');

  const equipmentHashes = {metal:'5caff3b79ed78810193f8c0aa90eb8bbe51aaee844f24624847d0e9a3f41c896', cloth:'85615e9b47c69a29e91cb1640797592ba3b583f8bfb124d9512ee9bbabd294e0'};
  for (const cloth of [false,true]) {
    const texture = createEquipmentSurface(THREE, cloth);
    assert.equal(digest(texture.image.data), equipmentHashes[cloth ? 'cloth' : 'metal'], 'The shared equipment generator remains unchanged'); texture.dispose();
  }
  const weapons = createHash('sha256');
  for (const id of ['vandal','phantom','spectre','classic','ghost','knife']) {
    for (const [firstPerson, detailed] of [[false,false],[false,true],[true,true]]) {
      const weapon = createWeaponModel(THREE, {id, firstPerson, detailed});
      weapon.parent.traverse(object => {
        object.updateMatrix(); weapons.update(JSON.stringify([object.type, ...object.matrix.elements]));
        if (!object.isMesh) return;
        // Weapon snapshots predate the agent finish implementation.
        for (const name of Object.keys(object.geometry.attributes).sort()) {
          const attribute = object.geometry.attributes[name]; weapons.update(name);
          weapons.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
        }
        if (object.geometry.index) weapons.update(Buffer.from(object.geometry.index.array.buffer));
        const m = object.material;
        weapons.update(JSON.stringify([m.color.getHex(),m.emissive?.getHex(),m.roughness,m.metalness,m.opacity,m.transparent,m.depthTest,m.depthWrite,m.bumpScale,
          m.roughnessMap?.image.data ? Array.from(m.roughnessMap.image.data) : null,m.bumpMap?.image.data ? Array.from(m.bumpMap.image.data) : null]));
        assert.equal(m.map?.name?.startsWith('Agent finish / ') || false, false);
      });
      weapon.dispose();
    }
  }
  assert.equal(weapons.digest('hex'), '21fd5daf07a5b0f0f6d1867ea1d345cb297aebf846b49d3d9e48849474929322', 'All six world/first-person weapon geometries and material surfaces remain unchanged');
  const view = createViewmodel(THREE, new THREE.PerspectiveCamera(76,16/9,.05,500));
  assert.equal(agentTextures(view).length, 0, 'First-person gloves and weapons remain independent'); view.dispose();
  for (const weapon of ['vandal','phantom','spectre','classic','ghost']) {
    const drop = createDroppedEquipment(THREE, {weapon});
    assert.equal(agentTextures(drop).length, 0, 'Dropped equipment cannot borrow agent finishes'); drop.dispose();
  }
  allCounts(sharedDisposal, 0, 'Unrelated equipment ownership cannot release the live agent cache');

  const scene = new THREE.Scene(); scene.add(agent.group);
  for (let index = 0; index < 100; index++) {
    const temporary = createAgentModel(THREE, {bot:{id:`temporary-${index}`}, team:index%2 ? 'blue' : 'red', variant:index%5,character:'nope'});
    scene.add(temporary.group); assert.deepEqual(new Set(agentTextures(temporary)), initialFinishes);
    const local = resources(temporary.group), privateResources = [...local.geometries, ...local.materials, ...[...local.textures].filter(texture => !initialFinishes.has(texture))].filter(resource=>!initialNopeShared.has(resource));
    const privateDisposal = watch(privateResources);
    temporary.dispose(); temporary.dispose();
    assert.equal(scene.children.length, 1); allCounts(privateDisposal, 1, 'Each spawn releases its own resources exactly once');
    allCounts(sharedDisposal, 0, 'Repeated spawns cannot release the cache while the original agent lives');
    allCounts(initialNopeDisposal,0,'Repeated NOPE spawns retain the live shared face, suit and bottle resources');
  }
  agent.dispose(); agent.dispose();
  assert.equal(scene.children.length, 0); allCounts(sharedDisposal, 1, 'The last borrower releases all four shared images exactly once');
  allCounts(initialNopeDisposal,1,'The final NOPE owner releases each shared face, suit, PET bottle and artwork resource once');
  const fresh = createAgentModel(THREE, {bot:{id:'fresh'}, team:'red',character:'nope'}), freshTextures = agentTextures(fresh);
  assert.equal(freshTextures.length, 4);
  for (const texture of freshTextures) {
    assert.equal(initialFinishes.has(texture), false, 'A new cache cannot resurrect disposed GPU resources');
    assert.equal(digest(texture.image.data), pixels.get(texture.name), 'Regenerated finishes stay deterministic');
  }
  const freshDisposal = watch(freshTextures); fresh.dispose(); fresh.dispose(); allCounts(freshDisposal, 1, 'A replacement cache has the same ownership contract');
  const roles=['duelist','nope','mend','echo','veil','ember','frost'],roleModels=roles.map(character=>createAgentModel(THREE,{bot:{id:character},team:'blue',variant:0,character}));
  assert.equal(roles.length,7,'The roster has seven distinct visual identities');
  // Only NOPE's exterior changes. Every completed reference avatar stays exact.
  const replacementRoles=new Set(roles);
  const priorGeometry={duelist:'20b5a6396083bd187ac604037a8430a2e737595cb329e5b65ab704acc6858390',mend:'2bab1a2a4773fdb541c265a15a66684fdf13c5d19b872e7f2b22777c1f38d36a',echo:'ec41a827faa8bbc026fc9ed7c1d29311b063d9f3c8437bd1a58f6413c8105211',veil:'087dc0692655041082bf794f8eb54d339a5d0f67c0ae3358bd83570b4caee056',ember:'f492074f01ee251d2d016100c820fbfc1f206fe1a6886e67ef3129c6a741cb52',frost:'a68efe714a73fa20b1ea60edabc9f940bfb3e2cf807df4653dd8824e5ec54bf9'};
  const roleFinishes=new Set(agentTextures(roleModels[0])),roleFinishDisposal=watch(roleFinishes),roleMetrics=[];
  const hitSignature=model=>{
    const hash=createHash('sha256');
    for(const mesh of model.meshes){addGeometry(hash,mesh.geometry);hash.update(JSON.stringify([!!mesh.userData.head,!!mesh.userData.bot]));}
    return hash.digest('hex');
  };
  const hitBaseline=hitSignature(roleModels[0]);
  for(let index=0;index<roles.length;index++){
    const model=roleModels[index],character=roles[index],attachments=[];let draws=0,tris=0;
    assert.equal(model.group.userData.character,character);assert.equal(model.meshes.length,52);assert.equal(hitSignature(model),hitBaseline,'All seven roles retain exactly the same 52 legacy geometry references');
    if(priorGeometry[character]){
      const hash=createHash('sha256');model.group.traverse(object=>{if(!object.isMesh)return;for(const name of Object.keys(object.geometry.attributes).sort()){const a=object.geometry.attributes[name];hash.update(name);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(object.geometry.index)hash.update(Buffer.from(object.geometry.index.array.buffer));});
      assert.equal(hash.digest('hex'),priorGeometry[character],'The other six full models retain every geometry/UV/vertex-color byte');
    }
    if(character==='ember'){
      const hash=createHash('sha256');model.group.traverse(object=>{if(!object.isMesh)return;for(const name of Object.keys(object.geometry.attributes).sort()){if(name==='color')continue;const a=object.geometry.attributes[name];hash.update(name);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(object.geometry.index)hash.update(Buffer.from(object.geometry.index.array.buffer));});
      assert.equal(hash.digest('hex'),'d0900999850d755a992b0738dc72a3e04e0566cd2ba013e088fa1d173baa320e','White goggles do not change any completed worker position, normal, UV or index');
    }
    assert.deepEqual(new Set(agentTextures(model)),roleFinishes,'Role equipment borrows the same four existing body finishes');
    model.group.traverseVisible(object=>{if(!object.isMesh)return;draws++;tris+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;if(object.userData.character)attachments.push(object);});
    if(!replacementRoles.has(character)){
      assert.equal(draws,[53,54,null,55,55,55,55][index]);assert.equal(tris,[14318,14618,null,15466,16114,16118,16626][index]);
    }else{
      assert.ok(draws<=64&&tris<=50000,'The replacement remains within a bounded multi-player rendering budget');
      if(character==='mend'){
        assert.ok(appearanceMeshes(model).length>0,'MEND retains the complete sunflower avatar');assert.equal(draws,45);assert.equal(tris,34932);
      }else if(character==='duelist'){
        assert.ok(appearanceMeshes(model,'duelist','Star mascot / ').length>0,'WIND retains the completed mascot skin');assert.equal(draws,40);assert.equal(tris,28728);
      }else if(character==='ember'){
        assert.ok(appearanceMeshes(model,'ember','Solder avatar / ').length>0,'EMBER retains the completed worker avatar');assert.equal(draws,38);assert.equal(tris,43344);
      }else if(character==='echo'){
        assert.ok(appearanceMeshes(model,'echo','IAGNU avatar / ').length>0,'ECHO retains the completed letter avatar');assert.equal(draws,42);assert.equal(tris,30752);
      }else if(character==='frost'){
        assert.ok(appearanceMeshes(model,'frost','Ono avatar / ').length>0,'FROST retains the complete Ono avatar');assert.equal(draws,39);assert.equal(tris,40592);
      }else if(character==='veil'){
        assert.ok(appearanceMeshes(model,'veil','Grass block avatar / ').length>0,'VEIL uses the complete grass and dirt cube avatar');assert.equal(draws,25);assert.equal(tris,3488);
      }else if(character==='nope'){
        assert.ok(appearanceMeshes(model,'nope','NOPE avatar / ').length>0,'NOPE replaces the body with a curved smile mascot and a modeled bottle');assert.equal(draws,36);assert.equal(tris,24516);
      }
    }
    for(const attachment of attachments){
      assert.equal(attachment.userData.solid,false);if(replacementRoles.has(character)){assert.equal(attachment.userData.bot,model.meshes[0].userData.bot);assert.equal(typeof attachment.userData.head,'boolean');assert.ok(['head','body'].includes(attachment.userData.hitZone));}else{assert.equal(attachment.userData.bot,undefined);assert.equal(attachment.userData.head,undefined);}
      const hits=[];attachment.raycast(new THREE.Raycaster(),hits);if(!replacementRoles.has(character))assert.equal(hits.length,0,'Old optional equipment stays cosmetic');else for(const hit of hits)assert.ok(Number.isFinite(hit.distance)&&hit.object.userData.bot,'Visible replacement surfaces resolve to their actor');
      if(!replacementRoles.has(character)){assert.equal(attachment.material.vertexColors,true);assert.equal(attachment.material.bumpMap.name,'Agent finish / cloth');}
    }
    const armor=armorOf(model);assert.equal(armor.color.getHexString(),'438b91','Character accents cannot recolor the team armor');
    const allColors=new Set();for(const attachment of attachments){const colors=attachment.geometry.getAttribute('color');if(colors)for(let i=0;i<colors.count;i++)allColors.add(new THREE.Color().setRGB(colors.getX(i),colors.getY(i),colors.getZ(i)).getHexString());}
    if(character==='nope')assert.ok(attachments.some(mesh=>mesh.material.color.getHexString()==='fa159f'),'NOPE carries the original vivid pink face and garment accents');
    roleMetrics.push({character,draws,triangles:tris,attachments:attachments.length});
  }
  // The reference-driven avatar changes the full visible body, but never the
  // game's combat surface, rig or team identification.
  const sunflower=roleModels[roles.indexOf('mend')];
  const avatarMeshes=appearanceMeshes(sunflower),avatarResources=appearanceResources(sunflower);
  const avatarGeometryHash=avatarGeometrySignature(avatarResources.geometries);
  assert.equal(avatarGeometryHash,'f21bd96de581431681f13b5e728e6f227231a0b2aae9535555194f161a975d06','The completed sunflower base and interaction-morph geometry remains exact');
  const avatarShared=new Set([...avatarResources.geometries,...avatarResources.materials,...avatarResources.textures]);
  const avatarDisposal=watch(avatarShared),avatarPixels=new Map([...avatarResources.textures].map(texture=>[texture.name,digest(texture.image.data)]));
  assert.deepEqual(Object.fromEntries(avatarPixels),{'Sunflower surface / golden eyes and expression':'1f5b562321e7048de67184deeb4a9006af1bee2a343699919cbca9fdcf188efe','Sunflower surface / woven straw':'610545f7c7e8d26a9fdf43c753b3e585701020b1fe2511ca0e67f6839e0336f1','Sunflower surface / linen':'f527ed2cd512a61b99617503172051d8e3ff41455acefadb22f3d628275d7cc5'},'The existing sunflower surface data remains unchanged');
  const part=(model,token)=>{
    const mesh=appearanceMeshes(model).find(object=>object.name.toLowerCase().includes(token));
    assert.ok(mesh,`The new avatar has a visible, named ${token} part`);return mesh;
  };
  const face=part(sunflower,'face'),eyes=part(sunflower,'gold eyes'),hair=part(sunflower,'long black hair'),hat=part(sunflower,'straw hat');
  const flower=part(sunflower,'sunflower pin'),dress=part(sunflower,'pleated dress');
  part(sunflower,'bare hand');part(sunflower,'flat shoe');part(sunflower,'butterfly necklace');
  const rgb=material=>material.color.getHexString().match(/../g).map(value=>parseInt(value,16));
  assert.ok(rgb(dress.material).every(value=>value>=210),'The new full dress has an actual white fabric finish');
  assert.ok(rgb(hair.material).every(value=>value<70),'The long locks use a black hair finish');
  const eyePixels=eyes.material.map?.image.data;assert.ok(eyePixels,'The modeled face carries its own painted eyes');
  let goldPixels=0;for(let i=0;i<eyePixels.length;i+=4)if(eyePixels[i+3]>200&&eyePixels[i]>150&&eyePixels[i+1]>80&&eyePixels[i]>eyePixels[i+1]*1.2&&eyePixels[i+1]>eyePixels[i+2]*1.5)goldPixels++;
  assert.ok(goldPixels>100,'The irises contain visible golden color rather than an untextured face');
  sunflower.group.updateMatrixWorld(true);
  for(const mesh of [face,eyes,hair,hat,flower])matrixClose(mesh.parent.matrixWorld,sunflower.head.matrixWorld,'The face, long hair and hat follow the animated head frame');
  for(const side of [-1,1]){
    const eyeRay=new THREE.Raycaster(sunflower.head.localToWorld(new THREE.Vector3(side*.056,.014,.8)),new THREE.Vector3(0,0,-1).transformDirection(sunflower.head.matrixWorld)),eyeHits=[];
    for(const mesh of avatarMeshes)if(effectivelyVisible(mesh))THREE.Mesh.prototype.raycast.call(mesh,eyeRay,eyeHits);
    eyeHits.sort((a,b)=>a.distance-b.distance);
    assert.equal(eyeHits[0]?.object,eyes,'Both golden eyes remain in front of the hair and visible from the front');
  }
  for(const mesh of avatarMeshes){
    assert.equal(effectivelyVisible(mesh),true);assert.equal(sunflower.meshes.includes(mesh),false);
    assert.equal(mesh.userData.solid,false);assert.equal(typeof mesh.userData.head,'boolean');assert.ok(mesh.userData.bot);
    for(const attribute of Object.values(mesh.geometry.attributes))for(const value of attribute.array)assert.ok(Number.isFinite(value),'Avatar vertex buffers contain only finite values');
  }
  assert.ok(sunflower.meshes.filter(mesh=>mesh.userData.head).every(mesh=>!effectivelyVisible(mesh)),'The old helmet and mask do not show through the new face');
  sunflower.group.updateMatrixWorld(true);
  const hatBounds=new THREE.Box3().setFromObject(hat,true),hairBounds=new THREE.Box3().setFromObject(hair,true),dressBounds=new THREE.Box3().setFromObject(dress,true);
  assert.ok(hatBounds.getSize(new THREE.Vector3()).x>.5,'The straw brim has an actual wide silhouette');
  assert.ok(hairBounds.getSize(new THREE.Vector3()).y>.4,'Long hair is modeled below the head');
  assert.ok(dressBounds.getSize(new THREE.Vector3()).y>.4,'The dress replaces the visible torso and skirt');
  const outerHatRay=new THREE.Raycaster(new THREE.Vector3(hatBounds.getCenter(new THREE.Vector3()).x+hatBounds.getSize(new THREE.Vector3()).x*.4,hatBounds.max.y+.1,hatBounds.getCenter(new THREE.Vector3()).z),new THREE.Vector3(0,-1,0),0,hatBounds.getSize(new THREE.Vector3()).y+.2);
  const physicalHatHits=[];THREE.Mesh.prototype.raycast.call(hat,outerHatRay,physicalHatHits);
  assert.ok(physicalHatHits.length>0,'The non-hit ray really passes through the physical brim geometry');
  assert.ok(outerHatRay.intersectObject(hat,true).some(isHeadHit),'The visible brim belongs to the visible head');
  assert.ok(outerHatRay.intersectObject(sunflower.group,true).some(isHeadHit),'The expanded head matches the rendered brim');
  ray.set(new THREE.Vector3(0,1.65,5),new THREE.Vector3(0,0,-1));
  assert.equal(isHeadHit(ray.intersectObject(sunflower.group,true)[0]),true,'Hiding the old head visually preserves its real headshot surface');
  ray.set(new THREE.Vector3(0,1.17,5),new THREE.Vector3(0,0,-1));
  assert.equal(isHeadHit(ray.intersectObject(sunflower.group,true)[0]),false,'The new dress preserves the original body hit');
  const redSunflower=createAgentModel(THREE,{bot:{id:'red-sunflower'},team:'red',character:'mend'});
  const visibleRing=model=>{
    let result;model.group.traverseVisible(object=>{if(object.isMesh&&object.geometry.type==='RingGeometry')result=object;});
    assert.ok(result,'A living new avatar retains a visible team ring');return result;
  };
  assert.equal(visibleRing(sunflower).material.color.getHexString(),'8dceb9');assert.equal(visibleRing(redSunflower).material.color.getHexString(),'d77e78');
  const teamRibbon=(model,team)=>{
    const ribbon=part(model,'team waist ribbon');assert.equal(effectivelyVisible(ribbon),true);
    assert.equal(ribbon.material.name,`Sunflower finish / team${team}`);return ribbon.material.color.getHexString();
  };
  assert.notEqual(teamRibbon(sunflower,'Blue'),teamRibbon(redSunflower,'Red'),'The visible dress ribbon also distinguishes teams');
  assert.equal(hitSignature(redSunflower),hitBaseline);
  const redAvatar=appearanceResources(redSunflower);
  for(const resource of [...redAvatar.geometries,...redAvatar.materials,...redAvatar.textures])if(!avatarShared.has(resource)){
    avatarShared.add(resource);avatarDisposal.set(resource,0);resource.addEventListener('dispose',()=>avatarDisposal.set(resource,avatarDisposal.get(resource)+1));
  }
  assert.deepEqual(redAvatar.geometries,avatarResources.geometries,'Both teams reuse the avatar geometry cache');
  assert.deepEqual(redAvatar.textures,avatarResources.textures,'Both teams reuse the avatar image cache');
  assert.ok(avatarResources.textures.size>0&&avatarResources.textures.size<=4);
  let avatarBytes=0;for(const texture of avatarResources.textures){
    assert.ok(texture.isDataTexture&&texture.image.width<=512&&texture.image.height<=512,'Avatar surfaces use bounded, local image data');
    avatarBytes+=texture.image.data.byteLength;
  }
  assert.ok(avatarBytes<=2*1024*1024,'The shared avatar images have a bounded GPU upload size');
  redSunflower.dispose();redSunflower.dispose();allCounts(avatarDisposal,0,'A red avatar cannot release resources still used by a blue avatar');
  const animated=createAgentModel(THREE,{bot:{id:'animated-sunflower'},team:'blue',character:'mend'});
  const animatedReference=createAgentModel(THREE,{bot:{id:'animated-reference'},team:'blue',character:'nope'});
  for(const weapon of ['vandal','phantom','spectre','classic','ghost','knife']){
    animated.update(0,{weapon,alive:true});animatedReference.update(0,{weapon,alive:true});
  }
  const animationResources=resources(animated.group),animationCounts=[animationResources.geometries.size,animationResources.materials.size,animationResources.textures.size];
  let time=0,sequence=0,walkDistance=0,handDistance=0,deathHeight=Infinity,sawMuzzle=false;
  const avatarHat=part(animated,'straw hat'),avatarHand=part(animated,'bare hand'),avatarShoe=part(animated,'flat shoe');
  const initialHat=avatarHat.getWorldPosition(new THREE.Vector3()),initialHand=avatarHand.getWorldPosition(new THREE.Vector3()),initialShoe=avatarShoe.getWorldPosition(new THREE.Vector3());
  for(const [pose,frames]of [[{moving:true},90],[{firing:true},6],[{planting:true},45],[{defusing:true},45],[{alive:false},60],[{alive:true},30]]){
    for(let frame=0;frame<frames;frame++){
      time+=1/60;if(pose.firing&&frame===0)sequence++;
      const state={alive:true,weapon:'vandal',time,shotSequence:sequence,...pose};
      animated.update(1/60,state);animatedReference.update(1/60,state);animated.group.updateMatrixWorld(true);animatedReference.group.updateMatrixWorld(true);
      assert.deepEqual(animated.meshes.map(mesh=>mesh.matrixWorld.elements),animatedReference.meshes.map(mesh=>mesh.matrixWorld.elements),'Walking, firing, plant, power-off, death and revival preserve combat poses');
      matrixClose(avatarHat.parent.matrixWorld,animated.head.matrixWorld,'The hat stays on the head through every animated pose');
      for(const [token,boneName]of [['bare hands','arm'],['flat shoes','leg']])for(const mesh of appearanceMeshes(animated).filter(object=>object.name.includes(token))){
        const side=mesh.parent.name.endsWith('R')?'R':'L',bone=animated[boneName+side],source=bone.children.find(object=>object.isGroup);
        matrixClose(mesh.parent.matrixWorld,source.matrixWorld,'Bare hands and flat shoes retain their actual IK attachments');
      }
      assert.equal(animated.muzzle.visible,animatedReference.muzzle.visible,'The replacement keeps the existing weapon flash behavior');sawMuzzle||=animated.muzzle.visible;
      animated.group.traverseVisible(object=>{for(const value of object.matrixWorld.elements)assert.ok(Number.isFinite(value),'Every animated avatar transform remains finite');});
      if(pose.moving)walkDistance=Math.max(walkDistance,avatarShoe.getWorldPosition(new THREE.Vector3()).distanceTo(initialShoe));
      if(pose.planting||pose.defusing)handDistance=Math.max(handDistance,avatarHand.getWorldPosition(new THREE.Vector3()).distanceTo(initialHand));
      if(pose.alive===false)deathHeight=Math.min(deathHeight,avatarHat.getWorldPosition(new THREE.Vector3()).y);
    }
    const after=resources(animated.group);assert.deepEqual([after.geometries.size,after.materials.size,after.textures.size],animationCounts,'Posing does not allocate replacement meshes, materials or textures');
  }
  assert.ok(walkDistance>.08,'The new flat shoes actually follow the walking legs');
  assert.ok(handDistance>.15,'The new bare hands follow plant/power-off interaction poses');
  assert.equal(sawMuzzle,true,'The firing pose really exercised a visible weapon flash');
  assert.ok(deathHeight<initialHat.y-.6,'The new hat and body fall with the dead rig');
  assert.ok(Math.abs(avatarHat.getWorldPosition(new THREE.Vector3()).y-initialHat.y)<.03,'Revival restores the standing appearance');
  visibleRing(animated);animated.dispose();animated.dispose();animatedReference.dispose();animatedReference.dispose();allCounts(avatarDisposal,0,'Animation borrowers do not dispose the remaining avatar');
  // Real interaction IK brings the knees forward. A whole-avatar bounding box
  // hides this failure, so compare actual front skin and cloth intersections.
  let clothedKneeSamples=0;
  for(const interaction of ['planting','defusing']){
    const model=createAgentModel(THREE,{bot:{id:`skirt-${interaction}`},team:'blue',character:'mend'}),cloth=part(model,'pleated dress');
    for(let frame=0;frame<72;frame++){
      model.update(1/60,{alive:true,weapon:'vandal',time:frame/60,[interaction]:true});model.group.updateMatrixWorld(true);
      if(frame%4!==3&&frame!==71)continue;
      const clothBounds=new THREE.Box3().setFromObject(cloth,true);
      for(const side of ['L','R']){
        const knee=model['leg'+side].children.find(object=>object.isMesh&&object.geometry.type==='SphereGeometry').getWorldPosition(new THREE.Vector3());
        // Bare legs below the hem are intentional. Once a knee is inside the
        // skirt's height band, the front skin must really be behind the fabric.
        if(knee.y<clothBounds.min.y+.02)continue;
        for(const offset of [-.015,0,.015]){
          const coverRay=new THREE.Raycaster(new THREE.Vector3(knee.x,knee.y+offset,2),new THREE.Vector3(0,0,-1)),clothHits=[],skinHits=[];
          THREE.Mesh.prototype.raycast.call(cloth,coverRay,clothHits);
          for(const mesh of appearanceMeshes(model))if(mesh.parent.name===`Sunflower frame / thigh${side}`||mesh.parent.name===`Sunflower frame / shin${side}`)THREE.Mesh.prototype.raycast.call(mesh,coverRay,skinHits);
          clothHits.sort((a,b)=>a.distance-b.distance);skinHits.sort((a,b)=>a.distance-b.distance);
          assert.ok(skinHits.length&&clothHits.length,'The representative knee ray crosses real skin and front cloth');
          assert.ok(clothHits[0].point.z>=skinHits[0].point.z+.002,`${interaction}: ${side} knee stays behind the front dress surface at frame ${frame}`);
          clothedKneeSamples++;
        }
      }
    }
    model.dispose();model.dispose();allCounts(avatarDisposal,0,'Interaction probes retain the live shared avatar');
  }
  assert.ok(clothedKneeSamples>=120,'Both interaction transitions and steady poses exercised both knees');
  assert.equal(avatarGeometrySignature(avatarResources.geometries),avatarGeometryHash,'Per-agent clothing poses do not rewrite shared base or morph vertex buffers');
  const starModel=roleModels[0],starMeshes=model=>appearanceMeshes(model,'duelist','Star mascot / '),starResources=model=>appearanceResources(model,'duelist','Star mascot / ');
  const starPart=(model,token)=>{const mesh=starMeshes(model).find(object=>object.name.includes(token));assert.ok(mesh,`The new mascot has a named ${token} part`);return mesh;};
  const starAssets=starResources(starModel),starGeometryHash=avatarGeometrySignature(starAssets.geometries),starPixels=new Map([...starAssets.textures].map(texture=>[texture.name,digest(texture.image.data)]));
  assert.equal(starGeometryHash,'bc25721fe4196e07e3558477d659240092a703eb76bf8a2615891a91b9cdafce','The final short-ear, corrected-mouth mascot geometry remains unchanged');
  assert.deepEqual(Object.fromEntries(starPixels),{'Star mascot surface / fine felt':'5a1add4086c9677d9f4d23ab9d76a2d09c3d78eff101388129ecb75e6d8c990d'},'The completed mascot surface remains unchanged');
  const starShared=new Set([...starAssets.geometries,...starAssets.materials,...starAssets.textures]),starDisposal=watch(starShared);
  const mascotFace=starPart(starModel,'cream mascot face'),mascotEars=starPart(starModel,'upright ears'),mascotTorso=starPart(starModel,'dark brown torso');
  starPart(starModel,'brown inner ears');starPart(starModel,'outer eyelashes');starPart(starModel,'orange upper lip');starPart(starModel,'orange lower lip');starPart(starModel,'cream mitten hands');starPart(starModel,'rounded mascot feet');
  assert.ok(Math.min(...rgb(mascotFace.material))>150&&Math.max(...rgb(mascotTorso.material))<130,'The full mascot uses a cream face and contrasting dark brown body');
  starModel.group.updateMatrixWorld(true);
  matrixClose(mascotEars.parent.matrixWorld,starModel.head.matrixWorld,'The large ears remain attached to the animated head');
  const earSampleY=mascotEars.geometry.boundingBox.max.y-.05;
  assert.ok(mascotEars.geometry.boundingBox.max.y-mascotEars.geometry.boundingBox.min.y>.25,'The upright ears retain a real raised silhouette');
  for(const mesh of starMeshes(starModel)){
    assert.equal(effectivelyVisible(mesh),true);assert.equal(starModel.meshes.includes(mesh),false);assert.equal(mesh.userData.solid,false);assert.ok(mesh.userData.bot);assert.equal(typeof mesh.userData.head,'boolean');
    for(const attribute of Object.values(mesh.geometry.attributes))for(const value of attribute.array)assert.ok(Number.isFinite(value),'All mascot vertex buffers remain finite');
    const hits=[];mesh.raycast(ray,hits);for(const hit of hits)assert.ok(hit.object.userData.bot&&Number.isFinite(hit.distance),'Visible replacement hits resolve to an actor');
  }
  assert.ok(starModel.meshes.filter(mesh=>mesh.userData.head).every(mesh=>!effectivelyVisible(mesh)),'The old tactical helmet is hidden for WIND');
  const rawStarRay=(model,x,y)=>{
    const probe=new THREE.Raycaster(model.head.localToWorld(new THREE.Vector3(x,y,.8)),new THREE.Vector3(0,0,-1).transformDirection(model.head.matrixWorld)),hits=[];
    for(const mesh of starMeshes(model))if(effectivelyVisible(mesh))THREE.Mesh.prototype.raycast.call(mesh,probe,hits);
    hits.sort((a,b)=>a.distance-b.distance);return {probe,hits};
  };
  let eyeStars=0;
  for(const [side,label]of [[-1,'left'],[1,'right']]){
    const eye=starPart(starModel,`black oval eye ${label}`),highlights=starPart(starModel,`white star highlights ${label}`),components=componentBounds(highlights.geometry);
    assert.equal(components.length,2,`The ${label} eye has exactly two separate white stars`);eyeStars+=components.length;
    assert.ok(rgb(eye.material).every(value=>value<20)&&rgb(highlights.material).every(value=>value>235),'The polished black eyes retain bright white highlights');
    for(const box of components){
      const point=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3());
      assert.ok(Math.sign(point.x)===side&&extent.x>.02&&extent.y>.035,'Both stars have visible area and remain on their own eye');
      assert.equal(rawStarRay(starModel,point.x,point.y).hits[0]?.object,highlights,'Every white star is actually in front of the eye and face');
    }
    assert.ok([eye,highlights].includes(rawStarRay(starModel,side*.122,.009).hits[0]?.object),'Both black oval eyes remain visible from the front');
    const earRay=rawStarRay(starModel,side*.205,earSampleY);
    assert.ok(earRay.hits.length>0&&earRay.hits[0].object.name.includes('ear'),'The non-hit test really crosses visible tall ear geometry');
    assert.ok(earRay.probe.intersectObjects(starMeshes(starModel),true).some(isHeadHit),'The actual visible ear is a head surface');
    assert.ok(earRay.probe.intersectObject(starModel.group,true).some(isHeadHit),'The visible ear extends the head, with no invisible box');
  }
  for(const [height,headshot]of [[1.65,true],[1.17,false]]){
    ray.set(new THREE.Vector3(0,height,5),new THREE.Vector3(0,0,-1));assert.equal(isHeadHit(ray.intersectObject(starModel.group,true)[0]),headshot,'The mascot still uses the unchanged physical head/body hit surface');
  }
  const redStar=createAgentModel(THREE,{bot:{id:'red-star'},team:'red',character:'duelist'}),redStarAssets=starResources(redStar);
  assert.equal(hitSignature(redStar),hitBaseline);assert.deepEqual(redStarAssets.geometries,starAssets.geometries);assert.deepEqual(redStarAssets.textures,starAssets.textures);
  for(const resource of [...redStarAssets.geometries,...redStarAssets.materials,...redStarAssets.textures])if(!starShared.has(resource)){
    starShared.add(resource);starDisposal.set(resource,0);resource.addEventListener('dispose',()=>starDisposal.set(resource,starDisposal.get(resource)+1));
  }
  const starTeam=(model,team)=>{const ribbon=starPart(model,'team ribbon');assert.equal(effectivelyVisible(ribbon),true);assert.equal(ribbon.material.name,`Star mascot finish / team${team}`);return ribbon.material.color.getHexString();};
  assert.notEqual(starTeam(starModel,'Blue'),starTeam(redStar,'Red'));assert.equal(visibleRing(starModel).material.color.getHexString(),'8dceb9');assert.equal(visibleRing(redStar).material.color.getHexString(),'d77e78');
  assert.ok(starAssets.textures.size<=4);let starBytes=0;
  for(const texture of starAssets.textures){assert.ok(texture.isDataTexture&&texture.image.width<=512&&texture.image.height<=512);starBytes+=texture.image.data.byteLength;}
  assert.ok(starBytes<=2*1024*1024);redStar.dispose();redStar.dispose();allCounts(starDisposal,0,'A second team shares rather than prematurely disposing mascot resources');
  const movingStar=createAgentModel(THREE,{bot:{id:'moving-star'},team:'blue',character:'duelist'}),starReference=createAgentModel(THREE,{bot:{id:'star-reference'},team:'blue',character:'nope'});
  for(const model of [movingStar,starReference]){
    for(const weapon of ['vandal','phantom','spectre','classic','ghost','knife'])model.update(0,{weapon,alive:true});
    model.update(0,{alive:true,ultimate:true,knives:5,weapon:'knife',shotSequence:0});model.update(0,{alive:true,weapon:'vandal',shotSequence:0});
  }
  const starAnimationAssets=resources(movingStar.group),starAnimationCounts=[starAnimationAssets.geometries.size,starAnimationAssets.materials.size,starAnimationAssets.textures.size];
  const movingEars=starPart(movingStar,'upright ears'),movingFoot=starPart(movingStar,'rounded mascot feet'),movingHand=starPart(movingStar,'cream mitten hands');
  const startEar=movingEars.getWorldPosition(new THREE.Vector3()),startFoot=movingFoot.getWorldPosition(new THREE.Vector3()),startHand=movingHand.getWorldPosition(new THREE.Vector3());
  let starTime=0,starSequence=0,footTravel=0,handTravel=0,fallenEar=Infinity,starMuzzle=false;
  for(const [pose,frames]of [[{moving:true},90],[{firing:true},6],[{planting:true},45],[{defusing:true},45],[{ultimate:true,weapon:'knife',knives:4},30],[{alive:false},60],[{alive:true},30]]){
    for(let frame=0;frame<frames;frame++){
      starTime+=1/60;if(frame===0&&(pose.firing||pose.ultimate))starSequence++;
      const state={alive:true,weapon:'vandal',time:starTime,shotSequence:starSequence,...pose};
      movingStar.update(1/60,state);starReference.update(1/60,state);movingStar.group.updateMatrixWorld(true);starReference.group.updateMatrixWorld(true);
      assert.deepEqual(movingStar.meshes.map(mesh=>mesh.matrixWorld.elements),starReference.meshes.map(mesh=>mesh.matrixWorld.elements),'The new mascot retains every weapon and combat rig pose, including the knife ultimate');
      matrixClose(movingEars.parent.matrixWorld,movingStar.head.matrixWorld,'The ears follow the head through interaction, firing, death and revival');
      for(const [token,boneName]of [['cream mitten hands','arm'],['rounded mascot feet','leg']])for(const mesh of starMeshes(movingStar).filter(object=>object.name.includes(token))){
        const side=mesh.parent.name.endsWith('R')?'R':'L',source=movingStar[boneName+side].children.find(object=>object.isGroup);matrixClose(mesh.parent.matrixWorld,source.matrixWorld,'Mascot mittens and feet keep the original IK attachments');
      }
      movingStar.group.traverseVisible(object=>{for(const value of object.matrixWorld.elements)assert.ok(Number.isFinite(value));});
      assert.equal(movingStar.muzzle.visible,starReference.muzzle.visible);starMuzzle||=movingStar.muzzle.visible;
      if(pose.moving)footTravel=Math.max(footTravel,movingFoot.getWorldPosition(new THREE.Vector3()).distanceTo(startFoot));
      if(pose.planting||pose.defusing)handTravel=Math.max(handTravel,movingHand.getWorldPosition(new THREE.Vector3()).distanceTo(startHand));
      if(pose.alive===false)fallenEar=Math.min(fallenEar,movingEars.getWorldPosition(new THREE.Vector3()).y);
    }
    const after=resources(movingStar.group);assert.deepEqual([after.geometries.size,after.materials.size,after.textures.size],starAnimationCounts,'Mascot animation and the knife ultimate do not allocate more model resources');
  }
  assert.ok(footTravel>.08&&handTravel>.15&&starMuzzle,'The actual walking, plant/power-off and shot animations were exercised');
  assert.ok(fallenEar<startEar.y-.6&&Math.abs(movingEars.getWorldPosition(new THREE.Vector3()).y-startEar.y)<.03,'Death and revival move the complete mascot rig');
  assert.equal(avatarGeometrySignature(starAssets.geometries),starGeometryHash);movingStar.dispose();movingStar.dispose();starReference.dispose();starReference.dispose();allCounts(starDisposal,0,'The original mascot keeps its shared assets after animated borrowers leave');
  // The lowered interaction head used to put the lower lip 24--28 mm behind
  // the brown torso. Test the actual front silhouette rather than body bounds.
  let mouthSamples=0;
  for(const interaction of ['planting','defusing']){
    const model=createAgentModel(THREE,{bot:{id:`mascot-mouth-${interaction}`},team:'blue',character:'duelist'}),lip=starPart(model,'orange lower lip'),rim=starPart(model,'soft lower lip rim');
    for(let frame=0;frame<90;frame++){
      model.update(1/60,{alive:true,weapon:'vandal',time:frame/60,[interaction]:true});model.group.updateMatrixWorld(true);
      if(frame%5!==4)continue;
      for(const angle of [-Math.PI/6,0,Math.PI/6])for(const offset of [-.025,0,.025]){
        const point=model.head.localToWorld(new THREE.Vector3(offset,-.292,.193)),direction=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle));
        const probe=new THREE.Raycaster(point.clone().addScaledVector(direction,.8),direction.negate()),hits=[];
        for(const mesh of starMeshes(model))if(effectivelyVisible(mesh))THREE.Mesh.prototype.raycast.call(mesh,probe,hits);
        hits.sort((a,b)=>a.distance-b.distance);
        assert.ok(hits[0]?.object===lip||hits[0]?.object===rim,`${interaction}: the lower lip remains visible in front of the torso at frame ${frame}`);mouthSamples++;
      }
    }
    model.dispose();model.dispose();allCounts(starDisposal,0,'The live mascot retains its shared resources after mouth probes');
  }
  assert.equal(mouthSamples,324,'Both interaction transitions and steady poses were viewed from three angles');
  const solderModel=roleModels[roles.indexOf('ember')],solderMeshes=model=>appearanceMeshes(model,'ember','Solder avatar / '),solderResources=model=>appearanceResources(model,'ember','Solder avatar / ');
  const solderPart=(model,token)=>{const mesh=solderMeshes(model).find(object=>object.name.toLowerCase().includes(token));assert.ok(mesh,`The worker has a named ${token} part`);return mesh;};
  const solderAssets=solderResources(solderModel),solderGeometryHash=avatarGeometrySignature(solderAssets.geometries),solderPixels=new Map([...solderAssets.textures].map(texture=>[texture.name,digest(texture.image.data)]));
  const solderShared=new Set([...solderAssets.geometries,...solderAssets.materials,...solderAssets.textures]),solderDisposal=watch(solderShared);
  const workerFace=solderPart(solderModel,'tanned face'),workerHair=solderPart(solderModel,'short black hair'),workerLens=solderPart(solderModel,'safety goggles'),workerShirt=solderPart(solderModel,'blue button work shirt');
  const workerBoard=solderPart(solderModel,'green circuit board'),workerIron=solderPart(solderModel,'soldering iron');
  solderPart(solderModel,'goggle frame');solderPart(solderModel,'copper traces');solderPart(solderModel,'shirt collar');solderPart(solderModel,'rolled blue sleeves');solderPart(solderModel,'soldering iron shaft');
  const meshColor=mesh=>{const colors=mesh.geometry.getAttribute('color'),color=colors?new THREE.Color().setRGB(colors.getX(0),colors.getY(0),colors.getZ(0)).multiply(mesh.material.color):mesh.material.color;return color.getHexString().match(/../g).map(value=>parseInt(value,16));};
  assert.ok(meshColor(workerHair).every(value=>value<90),'The worker has dark short hair');
  const shirtColor=meshColor(workerShirt),boardColor=meshColor(workerBoard);
  assert.ok(shirtColor[2]>shirtColor[0]&&boardColor[1]>boardColor[0]*1.2&&boardColor[1]>boardColor[2],'The blue work shirt and green circuit board have distinct real finishes');
  assert.equal(workerLens.material.transparent,false);assert.equal(workerLens.material.opacity,1);assert.equal(workerLens.material.depthWrite,true);
  assert.ok(meshColor(workerLens).every(value=>value>=250),'The requested white glasses are actually opaque white');
  const whiteFrame=solderPart(solderModel,'goggle frame');
  for(const value of whiteFrame.geometry.getAttribute('color').array)assert.ok(value>.99,'The entire glasses frame and hinges are white');
  const templeMesh=solderPart(solderModel,'goggle elastic strap'),templePositions=templeMesh.geometry.getAttribute('position'),templeColors=templeMesh.geometry.getAttribute('color');let whiteTempleVertices=0;
  for(let i=0;i<templePositions.count;i++)if(Math.abs(templePositions.getX(i))>.135&&templePositions.getZ(i)<.12){
    assert.ok(templeColors.getX(i)>.99&&templeColors.getY(i)>.99&&templeColors.getZ(i)>.99,'Both side temples are white while the separate pupils remain dark');whiteTempleVertices++;
  }
  assert.ok(whiteTempleVertices>100,'The white-temple assertion samples actual 3D side geometry');
  const ironSize=workerIron.geometry.boundingBox.getSize(new THREE.Vector3()),boardSize=workerBoard.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(Math.max(...ironSize.toArray())>.13&&Math.min(...ironSize.toArray())>.005,'The iron is a real three-dimensional tool');
  assert.ok(boardSize.x>.06&&boardSize.y>.08&&boardSize.z>.005,'The circuit board has a visible physical panel');
  solderModel.group.updateMatrixWorld(true);
  for(const part of [workerFace,workerHair,workerLens])matrixClose(part.parent.matrixWorld,solderModel.head.matrixWorld,'The face, hair and goggles follow the original head');
  const workerPupils=solderMeshes(solderModel).find(mesh=>mesh.name.includes('eyes / eyebrows')&&mesh.material.name==='Solder avatar finish / dark');
  assert.ok(workerPupils&&workerPupils!==workerHair,'The eyes are distinguishable from the hair in the actual visible geometry');
  let workerEyeSamples=0;
  for(const side of [-1,1])for(const x of [-.002,0,.002])for(const y of [-.002,0,.002]){
    const probe=new THREE.Raycaster(solderModel.head.localToWorld(new THREE.Vector3(side*.053+x,.017+y,.8)),new THREE.Vector3(0,0,-1).transformDirection(solderModel.head.matrixWorld)),hits=[];
    for(const mesh of solderMeshes(solderModel))THREE.Mesh.prototype.raycast.call(mesh,probe,hits);
    hits.sort((a,b)=>a.distance-b.distance);assert.equal(hits[0]?.object,workerLens,'Both eye areas are covered by the actual safety lens');
    assert.ok(hits.some(hit=>hit.object===workerPupils),'The original pupil geometry survives behind the intentionally opaque white glasses');workerEyeSamples++;
  }
  for(const mesh of solderMeshes(solderModel)){
    assert.equal(effectivelyVisible(mesh),true);assert.equal(solderModel.meshes.includes(mesh),false);assert.equal(mesh.userData.solid,false);assert.equal(typeof mesh.userData.head,'boolean');assert.ok(mesh.userData.bot);
    const hits=[];mesh.raycast(ray,hits);for(const hit of hits)assert.ok(hit.object.userData.bot&&Number.isFinite(hit.distance),'Visible replacement hits resolve to an actor');
    for(const attribute of Object.values(mesh.geometry.attributes))for(const value of attribute.array)assert.ok(Number.isFinite(value),'Worker geometry contains no invalid vertices');
  }
  assert.ok(solderModel.meshes.filter(mesh=>mesh.userData.head).every(mesh=>!effectivelyVisible(mesh)),'The worker fully replaces the old helmet visually');
  solderModel.group.traverseVisible(object=>assert.ok(!object.name.startsWith('Character gear / ember / '),'The obsolete heat-carrier exterior cannot show through the work shirt'));
  for(const [height,headshot]of [[1.65,true],[1.17,false]]){
    ray.set(new THREE.Vector3(0,height,5),new THREE.Vector3(0,0,-1));assert.equal(isHeadHit(ray.intersectObject(solderModel.group,true)[0]),headshot,'The worker preserves the established head/body shots');
  }
  const redSolder=createAgentModel(THREE,{bot:{id:'red-solder'},team:'red',character:'ember'}),redSolderAssets=solderResources(redSolder);
  assert.equal(hitSignature(redSolder),hitBaseline);assert.deepEqual(redSolderAssets.geometries,solderAssets.geometries);assert.deepEqual(redSolderAssets.textures,solderAssets.textures);
  for(const resource of [...redSolderAssets.geometries,...redSolderAssets.materials,...redSolderAssets.textures])if(!solderShared.has(resource)){
    solderShared.add(resource);solderDisposal.set(resource,0);resource.addEventListener('dispose',()=>solderDisposal.set(resource,solderDisposal.get(resource)+1));
  }
  const workerTeam=(model,team)=>{const band=solderPart(model,'team chest band');assert.equal(effectivelyVisible(band),true);assert.ok(band.material.name.toLowerCase().endsWith(team.toLowerCase()));return band.material.color.getHexString();};
  assert.notEqual(workerTeam(solderModel,'Blue'),workerTeam(redSolder,'Red'));assert.equal(visibleRing(solderModel).material.color.getHexString(),'8dceb9');assert.equal(visibleRing(redSolder).material.color.getHexString(),'d77e78');
  assert.ok(solderAssets.textures.size<=4);let solderBytes=0;
  for(const texture of solderAssets.textures){assert.ok(texture.isDataTexture&&texture.image.width<=512&&texture.image.height<=512);solderBytes+=texture.image.data.byteLength;}
  assert.ok(solderBytes<=2*1024*1024);redSolder.dispose();redSolder.dispose();allCounts(solderDisposal,0,'Both teams share worker assets without premature disposal');
  const movingSolder=createAgentModel(THREE,{bot:{id:'moving-solder'},team:'blue',character:'ember'}),solderReference=createAgentModel(THREE,{bot:{id:'solder-reference'},team:'blue',character:'nope'});
  for(const model of [movingSolder,solderReference])for(const weapon of ['vandal','phantom','spectre','classic','ghost','knife'])model.update(0,{weapon,alive:true,shotSequence:0});
  const solderAnimationAssets=resources(movingSolder.group),solderAnimationCounts=[solderAnimationAssets.geometries.size,solderAnimationAssets.materials.size,solderAnimationAssets.textures.size];
  const movingLens=solderPart(movingSolder,'safety goggles'),movingWorkerHand=solderPart(movingSolder,'bare working hands'),movingWorkerShoe=solderPart(movingSolder,'work shoes');
  const initialLens=movingLens.getWorldPosition(new THREE.Vector3()),initialWorkerHand=movingWorkerHand.getWorldPosition(new THREE.Vector3()),initialWorkerShoe=movingWorkerShoe.getWorldPosition(new THREE.Vector3());
  let workerTime=0,workerSequence=0,workerFootTravel=0,workerHandTravel=0,fallenLens=Infinity,workerMuzzle=false;
  for(const [pose,frames]of [[{moving:true},90],[{firing:true},6],[{planting:true},45],[{defusing:true},45],[{alive:false},60],[{alive:true},30]]){
    for(let frame=0;frame<frames;frame++){
      workerTime+=1/60;if(frame===0&&pose.firing)workerSequence++;
      const state={alive:true,weapon:'vandal',time:workerTime,shotSequence:workerSequence,...pose};
      movingSolder.update(1/60,state);solderReference.update(1/60,state);movingSolder.group.updateMatrixWorld(true);solderReference.group.updateMatrixWorld(true);
      assert.deepEqual(movingSolder.meshes.map(mesh=>mesh.matrixWorld.elements),solderReference.meshes.map(mesh=>mesh.matrixWorld.elements),'The worker retains the existing weapon, movement and interaction combat poses');
      matrixClose(movingLens.parent.matrixWorld,movingSolder.head.matrixWorld,'The goggles stay on the animated head');
      for(const [token,boneName]of [['bare working hands','arm'],['work shoes','leg']])for(const mesh of solderMeshes(movingSolder).filter(object=>object.name.includes(token))){
        const side=mesh.parent.name.endsWith('R')?'R':'L',source=movingSolder[boneName+side].children.find(object=>object.isGroup);matrixClose(mesh.parent.matrixWorld,source.matrixWorld,'Worker hands and shoes follow the original IK attachments');
      }
      movingSolder.group.traverseVisible(object=>{for(const value of object.matrixWorld.elements)assert.ok(Number.isFinite(value));});
      assert.equal(movingSolder.muzzle.visible,solderReference.muzzle.visible);workerMuzzle||=movingSolder.muzzle.visible;
      if(pose.moving)workerFootTravel=Math.max(workerFootTravel,movingWorkerShoe.getWorldPosition(new THREE.Vector3()).distanceTo(initialWorkerShoe));
      if(pose.planting||pose.defusing)workerHandTravel=Math.max(workerHandTravel,movingWorkerHand.getWorldPosition(new THREE.Vector3()).distanceTo(initialWorkerHand));
      if(pose.alive===false)fallenLens=Math.min(fallenLens,movingLens.getWorldPosition(new THREE.Vector3()).y);
    }
    const after=resources(movingSolder.group);assert.deepEqual([after.geometries.size,after.materials.size,after.textures.size],solderAnimationCounts,'Worker animation cannot allocate new model resources');
  }
  assert.ok(workerFootTravel>.08&&workerHandTravel>.15&&workerMuzzle,'The real walking, interaction and firing poses were exercised');
  assert.ok(fallenLens<initialLens.y-.6&&Math.abs(movingLens.getWorldPosition(new THREE.Vector3()).y-initialLens.y)<.03,'Death and revival move the complete worker appearance');
  assert.equal(avatarGeometrySignature(solderAssets.geometries),solderGeometryHash);movingSolder.dispose();movingSolder.dispose();solderReference.dispose();solderReference.dispose();allCounts(solderDisposal,0,'The original worker retains shared assets after animated borrowers leave');
  const iagnuModel=roleModels[roles.indexOf('echo')],iagnuMeshes=model=>appearanceMeshes(model,'echo','IAGNU avatar / '),iagnuResources=model=>appearanceResources(model,'echo','IAGNU avatar / ');
  const iagnuPart=(model,token)=>{const mesh=iagnuMeshes(model).find(object=>object.name.includes(token));assert.ok(mesh,`The letter avatar has a named ${token} part`);return mesh;};
  const iagnuAssets=iagnuResources(iagnuModel),iagnuGeometryHash=avatarGeometrySignature(iagnuAssets.geometries);
  const iagnuShared=new Set([...iagnuAssets.geometries,...iagnuAssets.materials,...iagnuAssets.textures]),iagnuDisposal=watch(iagnuShared);
  const letters='IAGNU'.split('').map(letter=>iagnuPart(iagnuModel,`letter ${letter} / gold front and back`)),letterSides=iagnuPart(iagnuModel,'extruded letter sides');
  assert.equal(new Set(letters).size,5,'IAGNU contains five individually modeled glyph caps');
  assert.equal(iagnuAssets.textures.size,0,'The actual letter shapes and holes use geometry rather than an opaque image card');
  iagnuModel.group.updateMatrixWorld(true);
  let precedingRight=-Infinity;
  for(const letter of letters){
    const box=letter.geometry.boundingBox,size=box.getSize(new THREE.Vector3()),color=rgb(letter.material);
    assert.ok(size.y>.75&&size.y<.85&&size.z>=.04&&size.z<.06,'Every tall serif letter has actual front and back depth');
    assert.ok(box.min.x>precedingRight+.003,'The five glyph silhouettes retain a visible gap in I A G N U order');precedingRight=box.max.x;
    assert.ok(letter.material.metalness>.5&&color[1]>=color[0]*.97&&color[1]>color[2]*1.2,'Every letter has the requested yellow-green metallic surface');
    matrixClose(letter.parent.matrixWorld,iagnuModel.head.matrixWorld,'The complete word follows the original animated head');
  }
  assert.ok(letterSides.geometry.boundingBox.max.z-letterSides.geometry.boundingBox.min.z>.045,'Serif edges include real extruded walls and beveled depth');
  const wordMeshes=model=>iagnuMeshes(model).filter(mesh=>mesh.parent.name==='IAGNU avatar frame / head');
  const rawWordRay=(model,x,y,back=false)=>{
    const probe=new THREE.Raycaster(model.head.localToWorld(new THREE.Vector3(x,y,back?-.5:.8)),new THREE.Vector3(0,0,back?1:-1).transformDirection(model.head.matrixWorld)),hits=[];
    for(const mesh of wordMeshes(model))if(effectivelyVisible(mesh))THREE.Mesh.prototype.raycast.call(mesh,probe,hits);
    hits.sort((a,b)=>a.distance-b.distance);return {probe,hits};
  };
  let letterRaySamples=0;
  const strokePoints=[['I',-.35028,.02],['A',-.2121,-.06],['G',-.10668,.02],['N',.09282,.17],['U',.25788,.12]];
  for(const [letter,x,y]of strokePoints){
    const front=rawWordRay(iagnuModel,x,y),back=rawWordRay(iagnuModel,x,y,true),cap=letters['IAGNU'.indexOf(letter)];
    assert.equal(front.hits[0]?.object,cap,`${letter} has an actual visible front stroke`);assert.equal(back.hits[0]?.object,cap,`${letter} has an actual modeled reverse face`);
    const frontPoint=iagnuModel.head.worldToLocal(front.hits[0].point.clone()),backPoint=iagnuModel.head.worldToLocal(back.hits[0].point.clone());
    assert.ok(frontPoint.z-backPoint.z>.04,'Front and back intersections cross a solid three-dimensional glyph');
    assert.ok(front.probe.intersectObjects(iagnuMeshes(iagnuModel),true).some(isHeadHit),'The visible letter stroke registers head damage');letterRaySamples+=2;
  }
  for(const [label,x,y]of [['A counter',-.2121,.10],['G interior',-.03528,.12],['G right opening',.02772,.12],['U interior',.31248,.12],['U top opening',.31248,.39],['I beside stem',-.32172,.02]]){
    assert.equal(rawWordRay(iagnuModel,x,y).hits.length,0,`${label} is free space through all letter geometry, including side walls`);letterRaySamples++;
  }
  for(const [label,x,y,letter]of [['I upper serif',-.32172,.39,'I'],['G crossbar',.01512,.007,'G'],['N diagonal',.13902,.02,'N'],['U rounded bottom',.31164,-.365,'U']]){
    assert.equal(rawWordRay(iagnuModel,x,y).hits[0]?.object,letters['IAGNU'.indexOf(letter)],`${label} contributes real geometry to the recognizable glyph`);letterRaySamples++;
  }
  const outsideHead=rawWordRay(iagnuModel,-.35028,.30);assert.ok(outsideHead.hits.length);assert.ok(outsideHead.probe.intersectObject(iagnuModel.group,true).some(isHeadHit),'The real letter silhouette extends the head surface');
  for(const mesh of iagnuMeshes(iagnuModel)){
    assert.equal(effectivelyVisible(mesh),true);assert.equal(iagnuModel.meshes.includes(mesh),false);assert.equal(mesh.userData.solid,false);assert.equal(typeof mesh.userData.head,'boolean');assert.ok(mesh.userData.bot);
    for(const attribute of Object.values(mesh.geometry.attributes))for(const value of attribute.array)assert.ok(Number.isFinite(value),'Letter and stylized limb buffers remain finite');
  }
  assert.ok(iagnuModel.meshes.filter(mesh=>mesh.userData.head).every(mesh=>!effectivelyVisible(mesh)),'IAGNU replaces the old head visually');
  iagnuModel.group.traverseVisible(object=>assert.ok(!object.name.startsWith('Character gear / echo / '),'No obsolete sensor headset or pack shows through the letters'));
  assert.ok(isHeadHit(rawWordRay(iagnuModel,-.35028,.02).probe.intersectObject(iagnuModel.group,true)[0]),'The visible I stroke is a headshot, not the empty gap at the old helmet centre');
  ray.set(new THREE.Vector3(0,1.17,5),new THREE.Vector3(0,0,-1));assert.equal(isHeadHit(ray.intersectObject(iagnuModel.group,true)[0]),false,'The torso remains a body hit');
  const redIagnu=createAgentModel(THREE,{bot:{id:'red-iagnu'},team:'red',character:'echo'}),redIagnuAssets=iagnuResources(redIagnu);
  assert.equal(hitSignature(redIagnu),hitBaseline);assert.deepEqual(redIagnuAssets.geometries,iagnuAssets.geometries);assert.deepEqual(redIagnuAssets.textures,iagnuAssets.textures);
  for(const resource of [...redIagnuAssets.geometries,...redIagnuAssets.materials,...redIagnuAssets.textures])if(!iagnuShared.has(resource)){
    iagnuShared.add(resource);iagnuDisposal.set(resource,0);resource.addEventListener('dispose',()=>iagnuDisposal.set(resource,iagnuDisposal.get(resource)+1));
  }
  const wordTeam=(model,team)=>{const band=iagnuPart(model,'team waist band');assert.equal(effectivelyVisible(band),true);assert.equal(band.material.name,`IAGNU finish / team ${team}`);return band.material.color.getHexString();};
  assert.notEqual(wordTeam(iagnuModel,'blue'),wordTeam(redIagnu,'red'));assert.equal(visibleRing(iagnuModel).material.color.getHexString(),'8dceb9');assert.equal(visibleRing(redIagnu).material.color.getHexString(),'d77e78');
  redIagnu.dispose();redIagnu.dispose();allCounts(iagnuDisposal,0,'The live letter avatar retains shared geometry and metal materials after a second team leaves');
  const movingIagnu=createAgentModel(THREE,{bot:{id:'moving-iagnu'},team:'blue',character:'echo'}),iagnuReference=createAgentModel(THREE,{bot:{id:'iagnu-reference'},team:'blue',character:'nope'});
  for(const model of [movingIagnu,iagnuReference])for(const weapon of ['vandal','phantom','spectre','classic','ghost','knife'])model.update(0,{weapon,alive:true,shotSequence:0});
  const iagnuAnimationAssets=resources(movingIagnu.group),iagnuAnimationCounts=[iagnuAnimationAssets.geometries.size,iagnuAnimationAssets.materials.size,iagnuAnimationAssets.textures.size];
  const movingLetter=iagnuPart(movingIagnu,'letter I / '),movingWordHand=iagnuPart(movingIagnu,'bronze articulated palms'),movingWordFoot=iagnuPart(movingIagnu,'serif pedestal feet');
  const startWord=movingLetter.getWorldPosition(new THREE.Vector3()),startWordHand=movingWordHand.getWorldPosition(new THREE.Vector3()),startWordFoot=movingWordFoot.getWorldPosition(new THREE.Vector3());
  let wordTime=0,wordSequence=0,wordFootTravel=0,wordHandTravel=0,fallenWord=Infinity,wordMuzzle=false;
  for(const [pose,frames]of [[{moving:true},90],[{firing:true},6],[{planting:true},45],[{defusing:true},45],[{alive:false},60],[{alive:true},30]]){
    for(let frame=0;frame<frames;frame++){
      wordTime+=1/60;if(frame===0&&pose.firing)wordSequence++;
      const state={alive:true,weapon:'vandal',time:wordTime,shotSequence:wordSequence,...pose};movingIagnu.update(1/60,state);iagnuReference.update(1/60,state);movingIagnu.group.updateMatrixWorld(true);iagnuReference.group.updateMatrixWorld(true);
      assert.deepEqual(movingIagnu.meshes.map(mesh=>mesh.matrixWorld.elements),iagnuReference.meshes.map(mesh=>mesh.matrixWorld.elements),'Letter limbs and the word retain the existing combat animation in every pose');
      matrixClose(movingLetter.parent.matrixWorld,movingIagnu.head.matrixWorld,'The word follows firing, walking, interaction, death and revival');
      for(const [token,boneName]of [['bronze articulated palms','arm'],['serif pedestal feet','leg']])for(const mesh of iagnuMeshes(movingIagnu).filter(object=>object.name.includes(token))){
        const side=mesh.parent.name.endsWith('R')?'R':'L',source=movingIagnu[boneName+side].children.find(object=>object.isGroup);matrixClose(mesh.parent.matrixWorld,source.matrixWorld,'Letter hands and feet follow the original IK sources');
      }
      movingIagnu.group.traverseVisible(object=>{for(const value of object.matrixWorld.elements)assert.ok(Number.isFinite(value));});
      assert.equal(movingIagnu.muzzle.visible,iagnuReference.muzzle.visible);wordMuzzle||=movingIagnu.muzzle.visible;
      if(pose.moving)wordFootTravel=Math.max(wordFootTravel,movingWordFoot.getWorldPosition(new THREE.Vector3()).distanceTo(startWordFoot));
      if(pose.planting||pose.defusing)wordHandTravel=Math.max(wordHandTravel,movingWordHand.getWorldPosition(new THREE.Vector3()).distanceTo(startWordHand));
      if(pose.alive===false)fallenWord=Math.min(fallenWord,movingLetter.getWorldPosition(new THREE.Vector3()).y);
    }
    const after=resources(movingIagnu.group);assert.deepEqual([after.geometries.size,after.materials.size,after.textures.size],iagnuAnimationCounts,'Animating the letter skin never allocates extra geometry, materials or textures');
  }
  assert.ok(wordFootTravel>.08&&wordHandTravel>.15&&wordMuzzle,'Actual walking, interaction and gunfire exercised the letter attachments');
  assert.ok(fallenWord<startWord.y-.6&&Math.abs(movingLetter.getWorldPosition(new THREE.Vector3()).y-startWord.y)<.03,'Death and revival move the complete letter avatar');
  assert.equal(avatarGeometrySignature(iagnuAssets.geometries),iagnuGeometryHash);movingIagnu.dispose();movingIagnu.dispose();iagnuReference.dispose();iagnuReference.dispose();allCounts(iagnuDisposal,0,'The original IAGNU owner retains its cache after animated borrowers leave');
  const onoModel=roleModels[roles.indexOf('frost')],onoMeshes=model=>appearanceMeshes(model,'frost','Ono avatar / '),onoResources=model=>appearanceResources(model,'frost','Ono avatar / ');
  const onoPart=(model,token)=>{const mesh=onoMeshes(model).find(object=>object.name.includes(token));assert.ok(mesh,`Ono has a named ${token} part`);return mesh;};
  const onoAssets=onoResources(onoModel),onoGeometryHash=avatarGeometrySignature(onoAssets.geometries),onoPixels=new Map([...onoAssets.textures].map(texture=>[texture.name,digest(texture.image.data)]));
  const onoShared=new Set([...onoAssets.geometries,...onoAssets.materials,...onoAssets.textures]),onoDisposal=watch(onoShared);
  const onoFace=onoPart(onoModel,'rounded doll face'),onoEyes=onoPart(onoModel,'blue eyes'),onoHair=onoPart(onoModel,'long lavender hair'),onoBlouse=onoPart(onoModel,'white short sleeve blouse'),onoSkirt=onoPart(onoModel,'knee-length plaid pleated skirt');
  onoPart(onoModel,'parted lavender fringe');onoPart(onoModel,'white socks');onoPart(onoModel,'dark flat shoes');onoPart(onoModel,'plaid bow ribbon');
  const lavender=rgb(onoHair.material);assert.ok(lavender[0]>lavender[1]&&lavender[2]>lavender[0]&&lavender[0]>140,'The long hair has an actual lavender finish');
  assert.ok(rgb(onoBlouse.material).every(value=>value>210),'The blouse remains white fabric');
  assert.ok(onoHair.geometry.boundingBox.max.y-onoHair.geometry.boundingBox.min.y>.9,'The replacement includes real long hair rather than a recolored helmet');
  const plaid=onoSkirt.material.map;assert.ok(plaid?.isDataTexture&&plaid.image.width>=128&&plaid.image.height>=128,'The skirt has its own real tartan surface');
  const plaidPixel=(x,y)=>Array.from(plaid.image.data.slice((y*plaid.image.width+x)*4,(y*plaid.image.width+x)*4+3));
  for(const [x,y]of [[0,0],[16,0],[43,0],[28,0],[0,16],[0,43],[0,28]]){
    assert.deepEqual(plaidPixel(x,y),plaidPixel(x+64,y));assert.deepEqual(plaidPixel(x,y),plaidPixel(x,y+64),'Tartan repeats across both fabric axes');
  }
  const navy=plaidPixel(0,0),redStripe=plaidPixel(16,0),greenStripe=plaidPixel(43,0),lightStripe=plaidPixel(28,0);
  assert.ok(navy[2]>navy[0]&&redStripe[0]>redStripe[1]*2&&greenStripe[1]>greenStripe[0]*2&&Math.min(...lightStripe)>80,'The check pattern contains navy, red, green and light crossing threads');
  assert.notDeepEqual(plaidPixel(0,16),navy);assert.notDeepEqual(plaidPixel(0,43),navy,'The appearance is a two-dimensional check rather than one set of stripes');
  const bowLobes=componentBounds(onoSkirt.geometry).filter(box=>{const size=box.getSize(new THREE.Vector3());return box.min.y>1.24&&size.x>.08&&size.y>.06;});
  assert.equal(bowLobes.length,2,'The butterfly ribbon has two separate broad modeled lobes');
  assert.ok(bowLobes.some(box=>box.max.x<0)&&bowLobes.some(box=>box.min.x>0));for(const box of bowLobes)assert.ok(box.max.z-box.min.z>.012,'Both bow wings have real convex depth');
  onoModel.group.updateMatrixWorld(true);
  for(const mesh of [onoFace,onoEyes,onoHair])matrixClose(mesh.parent.matrixWorld,onoModel.head.matrixWorld,'The face, painted eyes and long hair follow the animated head');
  const rawOnoRay=(model,x,y)=>{
    const probe=new THREE.Raycaster(model.head.localToWorld(new THREE.Vector3(x,y,.8)),new THREE.Vector3(0,0,-1).transformDirection(model.head.matrixWorld)),hits=[];
    for(const mesh of onoMeshes(model))if(effectivelyVisible(mesh))THREE.Mesh.prototype.raycast.call(mesh,probe,hits);
    hits.sort((a,b)=>a.distance-b.distance);return {probe,hits};
  };
  let onoEyeSamples=0;
  for(const side of [-1,1])for(const x of [-.002,0,.002])for(const y of [-.002,0,.002]){
    assert.equal(rawOnoRay(onoModel,side*.057+x,.014+y).hits[0]?.object,onoEyes,'Both eyes remain in front of the lavender fringe');onoEyeSamples++;
  }
  for(const side of [-1,1]){
    const eyeHit=rawOnoRay(onoModel,side*.073,.015).hits[0],image=onoEyes.material.map.image;
    assert.equal(eyeHit?.object,onoEyes);const px=Math.round(eyeHit.uv.x*(image.width-1)),py=Math.round(eyeHit.uv.y*(image.height-1)),i=(py*image.width+px)*4,c=Array.from(image.data.slice(i,i+4));
    assert.ok(c[3]>200&&c[2]>c[0]*1.3&&c[2]>c[1]*1.1&&c[2]>130,'Each visible iris ray lands on real opaque blue eye pixels');
  }
  let onoCrownSamples=0;
  const crownDirections=[new THREE.Vector3(0,1,0)];
  for(const elevation of [Math.PI/4,Math.PI/3,Math.PI*4/9])for(let bearing=0;bearing<8;bearing++){
    const yaw=bearing*Math.PI/4;crownDirections.push(new THREE.Vector3(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation)));
  }
  for(const direction of crownDirections){
    const center=new THREE.Vector3(0,.015,.012),origin=onoModel.head.localToWorld(center.addScaledVector(direction,.8)),probe=new THREE.Raycaster(origin,direction.clone().negate().transformDirection(onoModel.head.matrixWorld)),hits=[];
    for(const mesh of onoMeshes(onoModel))if(effectivelyVisible(mesh))THREE.Mesh.prototype.raycast.call(mesh,probe,hits);
    hits.sort((a,b)=>a.distance-b.distance);assert.ok(hits[0]&&['Ono finish / hair','Ono finish / hair sheen'].includes(hits[0].object.material.name),'The top scalp is covered by real lavender hair from front/back/side/oblique high views');
    assert.ok(hits.some(hit=>hit.object===onoFace),'The crown test ray really crosses the otherwise exposed head skin');onoCrownSamples++;
  }
  for(const mesh of onoMeshes(onoModel)){
    assert.equal(effectivelyVisible(mesh),true);assert.equal(onoModel.meshes.includes(mesh),false);assert.equal(mesh.userData.solid,false);assert.equal(typeof mesh.userData.head,'boolean');assert.ok(mesh.userData.bot);
    for(const attributes of [Object.values(mesh.geometry.attributes),...Object.values(mesh.geometry.morphAttributes)])for(const attribute of attributes)for(const value of attribute.array)assert.ok(Number.isFinite(value),'Ono base and interaction-morph geometry stays finite');
    const hits=[];mesh.raycast(ray,hits);for(const hit of hits)assert.ok(hit.object.userData.bot&&Number.isFinite(hit.distance),'Visible replacement hits resolve to an actor');
  }
  assert.ok(onoModel.meshes.filter(mesh=>mesh.userData.head).every(mesh=>!effectivelyVisible(mesh)),'Ono fully replaces the old cold-weather helmet visually');
  onoModel.group.traverseVisible(object=>assert.ok(!object.name.startsWith('Character gear / frost / '),'No obsolete visor or coolant carrier shows through the new uniform'));
  for(const [height,headshot]of [[1.65,true],[1.17,false]]){
    ray.set(new THREE.Vector3(0,height,5),new THREE.Vector3(0,0,-1));assert.equal(isHeadHit(ray.intersectObject(onoModel.group,true)[0]),headshot,'Ono preserves the old head/body shot surfaces');
  }
  assert.equal(onoSkirt.geometry.morphAttributes.position.length,1);assert.equal(onoSkirt.geometry.morphAttributes.normal.length,1,'The skirt has a real shared interaction shape');
  const redOno=createAgentModel(THREE,{bot:{id:'red-ono'},team:'red',character:'frost'}),redOnoAssets=onoResources(redOno),redOnoSkirt=onoPart(redOno,'knee-length plaid pleated skirt');
  assert.equal(hitSignature(redOno),hitBaseline);assert.deepEqual(redOnoAssets.geometries,onoAssets.geometries);assert.deepEqual(redOnoAssets.textures,onoAssets.textures);
  assert.notEqual(redOnoSkirt.morphTargetInfluences,onoSkirt.morphTargetInfluences,'Interaction weights belong to each avatar rather than the shared geometry');
  for(let frame=0;frame<30;frame++)redOno.update(1/60,{alive:true,planting:true,time:frame/60});
  assert.ok(redOnoSkirt.morphTargetInfluences[0]>.9);assert.equal(onoSkirt.morphTargetInfluences[0],0,'One planter cannot inflate another player\'s skirt');
  for(const resource of [...redOnoAssets.geometries,...redOnoAssets.materials,...redOnoAssets.textures])if(!onoShared.has(resource)){
    onoShared.add(resource);onoDisposal.set(resource,0);resource.addEventListener('dispose',()=>onoDisposal.set(resource,onoDisposal.get(resource)+1));
  }
  const onoTeam=(model,team)=>{const ribbon=onoPart(model,'team waist ribbon');assert.equal(effectivelyVisible(ribbon),true);assert.equal(ribbon.material.name,`Ono finish / team ${team}`);return ribbon.material.color.getHexString();};
  assert.notEqual(onoTeam(onoModel,'blue'),onoTeam(redOno,'red'));assert.equal(visibleRing(onoModel).material.color.getHexString(),'8dceb9');assert.equal(visibleRing(redOno).material.color.getHexString(),'d77e78');
  assert.ok(onoAssets.textures.size<=4);let onoBytes=0;for(const texture of onoAssets.textures){assert.ok(texture.isDataTexture&&texture.image.width<=512&&texture.image.height<=512);onoBytes+=texture.image.data.byteLength;}assert.ok(onoBytes<=2*1024*1024);
  redOno.dispose();redOno.dispose();allCounts(onoDisposal,0,'Both teams share the same hair, dress and face resources without premature disposal');
  const movingOno=createAgentModel(THREE,{bot:{id:'moving-ono'},team:'blue',character:'frost'}),onoReference=createAgentModel(THREE,{bot:{id:'ono-reference'},team:'blue',character:'nope'});
  for(const model of [movingOno,onoReference])for(const weapon of ['vandal','phantom','spectre','classic','ghost','knife'])model.update(0,{weapon,alive:true,shotSequence:0});
  const onoAnimationAssets=resources(movingOno.group),onoAnimationCounts=[onoAnimationAssets.geometries.size,onoAnimationAssets.materials.size,onoAnimationAssets.textures.size];
  const movingOnoEyes=onoPart(movingOno,'blue eyes'),movingOnoHand=onoPart(movingOno,'bare hands'),movingOnoShoe=onoPart(movingOno,'dark flat shoes');
  const startOnoHead=movingOnoEyes.getWorldPosition(new THREE.Vector3()),startOnoHand=movingOnoHand.getWorldPosition(new THREE.Vector3()),startOnoShoe=movingOnoShoe.getWorldPosition(new THREE.Vector3());
  let onoTime=0,onoSequence=0,onoFootTravel=0,onoHandTravel=0,fallenOno=Infinity,onoMuzzle=false;
  for(const [pose,frames]of [[{moving:true},90],[{firing:true},6],[{planting:true},45],[{defusing:true},45],[{alive:false},60],[{alive:true},30]]){
    for(let frame=0;frame<frames;frame++){
      onoTime+=1/60;if(frame===0&&pose.firing)onoSequence++;
      const state={alive:true,weapon:'vandal',time:onoTime,shotSequence:onoSequence,...pose};movingOno.update(1/60,state);onoReference.update(1/60,state);movingOno.group.updateMatrixWorld(true);onoReference.group.updateMatrixWorld(true);
      assert.deepEqual(movingOno.meshes.map(mesh=>mesh.matrixWorld.elements),onoReference.meshes.map(mesh=>mesh.matrixWorld.elements),'The new dress and hair never change any combat rig or gun pose');
      matrixClose(movingOnoEyes.parent.matrixWorld,movingOno.head.matrixWorld,'The painted eyes remain attached during every pose');
      for(const [token,boneName]of [['bare hands','arm'],['dark flat shoes','leg']])for(const mesh of onoMeshes(movingOno).filter(object=>object.name.includes(token))){
        const side=mesh.parent.name.endsWith('R')?'R':'L',source=movingOno[boneName+side].children.find(object=>object.isGroup);matrixClose(mesh.parent.matrixWorld,source.matrixWorld,'Ono hands and shoes retain the original IK attachments');
      }
      movingOno.group.traverseVisible(object=>{for(const value of object.matrixWorld.elements)assert.ok(Number.isFinite(value));});
      assert.equal(movingOno.muzzle.visible,onoReference.muzzle.visible);onoMuzzle||=movingOno.muzzle.visible;
      if(pose.moving)onoFootTravel=Math.max(onoFootTravel,movingOnoShoe.getWorldPosition(new THREE.Vector3()).distanceTo(startOnoShoe));
      if(pose.planting||pose.defusing)onoHandTravel=Math.max(onoHandTravel,movingOnoHand.getWorldPosition(new THREE.Vector3()).distanceTo(startOnoHand));
      if(pose.alive===false)fallenOno=Math.min(fallenOno,movingOnoEyes.getWorldPosition(new THREE.Vector3()).y);
    }
    const after=resources(movingOno.group);assert.deepEqual([after.geometries.size,after.materials.size,after.textures.size],onoAnimationCounts,'Animation and shared cloth morphs allocate no new model resources');
  }
  assert.ok(onoFootTravel>.08&&onoHandTravel>.15&&onoMuzzle,'Actual walking, interaction and shooting exercised the new outfit');
  assert.ok(fallenOno<startOnoHead.y-.6&&Math.abs(movingOnoEyes.getWorldPosition(new THREE.Vector3()).y-startOnoHead.y)<.03,'Death and revival move the full Ono appearance');
  movingOno.dispose();movingOno.dispose();onoReference.dispose();onoReference.dispose();allCounts(onoDisposal,0,'The standing Ono owner keeps shared resources after animation borrowers leave');
  let onoClothedKneeSamples=0;
  for(const interaction of ['planting','defusing'])for(const timeOffset of [0,.16,.32,.48]){
    const model=createAgentModel(THREE,{bot:{id:`ono-skirt-${interaction}-${timeOffset}`},team:'blue',character:'frost'}),cloth=onoPart(model,'knee-length plaid pleated skirt');
    for(let frame=0;frame<240;frame++){
      model.update(1/60,{alive:true,weapon:'vandal',time:timeOffset+frame/60,moving:frame<60,[interaction]:frame>=60&&frame<150});model.group.updateMatrixWorld(true);
      // Frames 21--23 used to expose the walking right knee by 12.24 mm at
      // +30 degrees. Keep those frames explicit alongside all transitions.
      if(frame%5!==4&&![21,22,23,60,61,62,150,151,152].includes(frame))continue;
      const clothBounds=new THREE.Box3().setFromObject(cloth,true);
      for(const side of ['L','R']){
        const knee=model['leg'+side].children.find(object=>object.isMesh&&object.geometry.type==='SphereGeometry').getWorldPosition(new THREE.Vector3());if(knee.y<clothBounds.min.y+.02)continue;
        for(const offset of [-.015,0,.015])for(const angle of [-Math.PI/6,0,Math.PI/6]){
          const target=knee.clone();target.y+=offset;const direction=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle));
          const probe=new THREE.Raycaster(target.addScaledVector(direction,2),direction.negate()),clothHits=[],legHits=[];
          THREE.Mesh.prototype.raycast.call(cloth,probe,clothHits);
          for(const mesh of onoMeshes(model))if(mesh.parent.name===`Ono avatar frame / thigh${side}`||mesh.parent.name===`Ono avatar frame / shin${side}`)THREE.Mesh.prototype.raycast.call(mesh,probe,legHits);
          clothHits.sort((a,b)=>a.distance-b.distance);legHits.sort((a,b)=>a.distance-b.distance);
          assert.ok(legHits.length&&clothHits.length,'A representative clothed-knee ray crosses real leg and skirt geometry');
          assert.ok(clothHits[0].distance<=legHits[0].distance-.002,`${interaction}: the ${side} knee stays behind the tartan from front and oblique views at frame ${frame}, stride offset ${timeOffset}`);onoClothedKneeSamples++;
        }
      }
    }
    assert.ok(cloth.morphTargetInfluences[0]<.001,'Releasing plant/power-off restores the skirt shape');model.dispose();model.dispose();allCounts(onoDisposal,0,'Knee probes cannot release the remaining shared Ono resources');
  }
  assert.ok(onoClothedKneeSamples>=200,'Four walking phases, both interaction transitions, steady poses and release exercised both knees');
  assert.equal(avatarGeometrySignature(onoAssets.geometries),onoGeometryHash,'Per-avatar skirt posing never mutates the shared base or morph buffers');
  // VEIL becomes an actual textured block and short articulated limbs. Raw
  // geometry rays verify six closed faces without adding bullet hit surfaces.
  const grassModel=roleModels[roles.indexOf('veil')],grassMeshes=model=>appearanceMeshes(model,'veil','Grass block avatar / '),grassResources=model=>appearanceResources(model,'veil','Grass block avatar / ');
  const grassPart=(model,token)=>{const mesh=grassMeshes(model).find(object=>object.name.includes(token));assert.ok(mesh,`The grass avatar contains a named ${token} part`);return mesh;};
  const grassAssets=grassResources(grassModel),grassGeometryHash=avatarGeometrySignature(grassAssets.geometries),grassPixels=new Map([...grassAssets.textures].map(texture=>[texture.name,digest(texture.image.data)]));
  const grassShared=new Set([...grassAssets.geometries,...grassAssets.materials,...grassAssets.textures]),grassDisposal=watch(grassShared),grassCube=grassPart(grassModel,'pebbled dirt cube');
  assert.ok(grassMeshes(grassModel).length>0);grassModel.group.updateMatrixWorld(true);grassCube.geometry.computeBoundingBox();
  const cubeBox=grassCube.geometry.boundingBox,cubeSize=cubeBox.getSize(new THREE.Vector3()),cubeCenter=cubeBox.getCenter(new THREE.Vector3());
  assert.ok(Math.min(...cubeSize.toArray())>.95&&Math.max(...cubeSize.toArray())<1.15&&Math.max(...cubeSize.toArray())/Math.min(...cubeSize.toArray())<1.1,'The main exterior is a real near-equal-sided cube');
  assert.equal(grassAssets.textures.size,1,'One shared pixel atlas supplies every block face and short limb');
  const grassAtlas=[...grassAssets.textures][0];assert.ok(grassAtlas.isDataTexture);assert.equal(grassAtlas.image.width,96);assert.equal(grassAtlas.image.height,64);
  assert.equal(grassAtlas.colorSpace,THREE.SRGBColorSpace);assert.equal(grassAtlas.magFilter,THREE.NearestFilter);assert.equal(grassAtlas.minFilter,THREE.NearestMipmapNearestFilter,'Pixel edges remain crisp while distant views use whole mip levels');
  for(let i=3;i<grassAtlas.image.data.length;i+=4)assert.equal(grassAtlas.image.data[i],255,'The block atlas cannot create transparent gaps');
  let grassCubeSamples=0;
  const cubeRay=(point,outward)=>{
    const direction=outward.clone().transformDirection(grassCube.matrixWorld),origin=grassCube.localToWorld(point.clone().addScaledVector(outward,2)),probe=new THREE.Raycaster(origin,direction.negate()),hits=[];
    THREE.Mesh.prototype.raycast.call(grassCube,probe,hits);hits.sort((a,b)=>a.distance-b.distance);assert.ok(hits.length,'A block-face ray crosses actual closed cube geometry');
    assert.ok(hits[0].face.normal.dot(outward)>.99,'All six cube faces have outward-facing solid normals');grassCubeSamples++;return {probe,hit:hits[0]};
  };
  const hitPixel=hit=>{const image=grassAtlas.image,px=Math.min(image.width-1,Math.max(0,Math.floor(hit.uv.x*image.width))),py=Math.min(image.height-1,Math.max(0,Math.floor(hit.uv.y*image.height))),i=(py*image.width+px)*4;return Array.from(image.data.slice(i,i+3));};
  const green=color=>color[1]>color[0]*1.1&&color[1]>color[2]*1.1,brown=color=>color[0]>color[1]*1.05&&color[1]>color[2];
  let greenTop=0,brownBottom=0,greenFringe=0,brownSides=0;
  for(const x of [-.3,0,.3])for(const z of [-.3,0,.3]){
    greenTop+=green(hitPixel(cubeRay(new THREE.Vector3(cubeCenter.x+x*cubeSize.x,cubeBox.max.y,cubeCenter.z+z*cubeSize.z),new THREE.Vector3(0,1,0)).hit));
    brownBottom+=brown(hitPixel(cubeRay(new THREE.Vector3(cubeCenter.x+x*cubeSize.x,cubeBox.min.y,cubeCenter.z+z*cubeSize.z),new THREE.Vector3(0,-1,0)).hit));
  }
  for(const outward of [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)])for(const offset of [-.3,0,.3])for(const height of [.97,.35]){
    const point=cubeCenter.clone();point.y=cubeBox.min.y+height*cubeSize.y;
    if(outward.x){point.x=outward.x>0?cubeBox.max.x:cubeBox.min.x;point.z+=offset*cubeSize.z;}else{point.z=outward.z>0?cubeBox.max.z:cubeBox.min.z;point.x+=offset*cubeSize.x;}
    const color=hitPixel(cubeRay(point,outward).hit);if(height>.9)greenFringe+=green(color);else brownSides+=brown(color);
  }
  assert.ok(greenTop>=7&&brownBottom>=7&&greenFringe>=8&&brownSides>=10,'Actual top/side/bottom UVs show green grass, a green upper fringe, and brown earth on every side and underneath');
  matrixClose(grassCube.parent.matrixWorld,grassModel.head.parent.matrixWorld,'The cube follows the original animated upper body');
  for(const mesh of grassMeshes(grassModel)){
    assert.equal(effectivelyVisible(mesh),true);assert.equal(mesh.userData.solid,false);assert.ok(mesh.userData.bot);assert.equal(typeof mesh.userData.head,'boolean');assert.equal(grassModel.meshes.includes(mesh),false);
    for(const attribute of Object.values(mesh.geometry.attributes))for(const value of attribute.array)assert.ok(Number.isFinite(value),'Block positions, normals and atlas coordinates remain finite');
    const hits=[];mesh.raycast(ray,hits);for(const hit of hits)assert.ok(hit.object.userData.bot&&Number.isFinite(hit.distance),'Visible replacement hits resolve to an actor');
  }
  const outerBlock=cubeRay(new THREE.Vector3(cubeBox.max.x-.025,cubeBox.max.y-.04,cubeBox.max.z),new THREE.Vector3(0,0,1));
  assert.ok(outerBlock.probe.intersectObject(grassModel.group,true).some(isHeadHit),'The visible upper block corner registers head damage');
  assert.ok(grassModel.meshes.filter(mesh=>mesh.userData.head).every(mesh=>!effectivelyVisible(mesh)),'The old VEIL tactical body and helmet are completely replaced');
  grassModel.group.traverseVisible(object=>assert.ok(!object.name.startsWith('Character gear / veil / '),'The obsolete visor and canisters do not show through the cube'));
  for(const [height,headshot]of [[1.65,true],[1.17,false]]){ray.set(new THREE.Vector3(0,height,5),new THREE.Vector3(0,0,-1));assert.equal(isHeadHit(ray.intersectObject(grassModel.group,true)[0]),headshot,'Grass block retains the original head/body hit surface');}
  const redGrass=createAgentModel(THREE,{bot:{id:'red-grass'},team:'red',character:'veil'}),redGrassAssets=grassResources(redGrass);
  assert.deepEqual(redGrassAssets.geometries,grassAssets.geometries);assert.deepEqual(redGrassAssets.textures,grassAssets.textures);assert.equal(hitSignature(redGrass),hitBaseline);
  for(const resource of [...redGrassAssets.geometries,...redGrassAssets.materials,...redGrassAssets.textures])if(!grassShared.has(resource)){grassShared.add(resource);grassDisposal.set(resource,0);resource.addEventListener('dispose',()=>grassDisposal.set(resource,grassDisposal.get(resource)+1));}
  const grassBand=grassPart(grassModel,'team waist band'),redGrassBand=grassPart(redGrass,'team waist band');assert.notEqual(grassBand.material.color.getHexString(),redGrassBand.material.color.getHexString());
  assert.equal(visibleRing(grassModel).material.color.getHexString(),'8dceb9');assert.equal(visibleRing(redGrass).material.color.getHexString(),'d77e78');
  let grassBytes=0;for(const texture of grassAssets.textures)grassBytes+=texture.image.data.byteLength;assert.equal(grassBytes,96*64*4);redGrass.dispose();redGrass.dispose();allCounts(grassDisposal,0,'The standing block keeps shared resources when another team leaves');
  const nopeModel=roleModels[roles.indexOf('nope')];
  const nopeMeshes=model=>appearanceMeshes(model,'nope','NOPE avatar / '),nopeResources=model=>appearanceResources(model,'nope','NOPE avatar / ');
  const nopePart=(model,token)=>{const mesh=nopeMeshes(model).find(object=>object.name.includes(token));assert.ok(mesh,`The NOPE mascot includes ${token}`);return mesh;};
  const nopeAssets=nopeResources(nopeModel),nopeGeometryHash=avatarGeometrySignature(nopeAssets.geometries),nopePixels=new Map([...nopeAssets.textures].map(texture=>[texture.name,digest(texture.image.data)]));
  const nopeShared=new Set([...nopeAssets.geometries,...nopeAssets.materials,...nopeAssets.textures]),nopeDisposal=watch(nopeShared);
  assert.equal(nopeAssets.geometries.size,25);assert.equal(nopeAssets.materials.size,9);assert.equal(nopeAssets.textures.size,1);
  const nopeArt=[...nopeAssets.textures][0];assert.equal(nopeArt.image.width,512);assert.equal(nopeArt.image.height,512);assert.equal(nopeArt.colorSpace,THREE.SRGBColorSpace);
  for(const token of ['rounded pink face cushion','crossed X eyes','wide curved smile','protruding tongue silhouette','pink tongue crease','charcoal utility suit','pink gripping mittens','rounded charcoal shoes','pink shoe sole edging','belt NOPE bottle / shell','belt NOPE bottle / hardware','belt NOPE bottle / label'])nopePart(nopeModel,token);
  for(const mesh of nopeMeshes(nopeModel)){
    assert.equal(effectivelyVisible(mesh),true);assert.equal(mesh.userData.solid,false);assert.ok(mesh.userData.bot);assert.equal(typeof mesh.userData.head,'boolean');assert.equal(nopeModel.meshes.includes(mesh),false);
    const hits=[];mesh.raycast(ray,hits);for(const hit of hits)assert.ok(hit.object.userData.bot&&Number.isFinite(hit.distance),'Visible replacement hits resolve to an actor');
  }
  assert.ok(nopeModel.meshes.filter(mesh=>mesh.userData.head).every(mesh=>!effectivelyVisible(mesh)),'NOPE fully replaces the old helmet and face');
  nopeModel.group.traverseVisible(object=>assert.ok(!object.name.startsWith('Character gear / nope / '),'The old cosmetic badge cannot show through the mascot'));
  const nopeShell=nopePart(nopeModel,'belt NOPE bottle / shell'),nopeHardware=nopePart(nopeModel,'belt NOPE bottle / hardware');
  assert.equal(nopeShell.material.transparent,true);assert.equal(nopeShell.geometry.attributes.color.itemSize,4,'Transparent PET and opaque dark liquid share vertex alpha in one draw');
  assert.equal(nopePart(nopeModel,'belt NOPE bottle / label').material.map,nopeArt);assert.ok(nopeHardware.geometry.attributes.position.count>100);
  const redNope=createAgentModel(THREE,{bot:{id:'red-nope'},team:'red',character:'nope'}),redNopeAssets=nopeResources(redNope);
  assert.deepEqual(redNopeAssets.geometries,nopeAssets.geometries);assert.deepEqual(redNopeAssets.textures,nopeAssets.textures);assert.equal(hitSignature(redNope),hitBaseline);
  for(const resource of [...redNopeAssets.geometries,...redNopeAssets.materials,...redNopeAssets.textures])if(!nopeShared.has(resource)){nopeShared.add(resource);nopeDisposal.set(resource,0);resource.addEventListener('dispose',()=>nopeDisposal.set(resource,nopeDisposal.get(resource)+1));}
  assert.notEqual(nopePart(nopeModel,'team waist band').material.color.getHexString(),nopePart(redNope,'team waist band').material.color.getHexString());
  assert.equal(visibleRing(nopeModel).material.color.getHexString(),'8dceb9');assert.equal(visibleRing(redNope).material.color.getHexString(),'d77e78');redNope.dispose();allCounts(nopeDisposal,0,'The first NOPE owner retains both team materials');
  let nopeFaceSamples=0;
  const movingNope=createAgentModel(THREE,{bot:{id:'moving-nope'},team:'blue',character:'nope'});
  for(const pose of [{moving:true},{planting:true},{},{defusing:true},{}])for(let frame=0;frame<90;frame++){
    movingNope.update(1/60,{character:'nope',alive:true,weapon:'vandal',time:frame/60,...pose});movingNope.group.updateMatrixWorld(true);
    if(frame%3===0)for(const [x,y]of [[-.104,.096],[.104,.096],[.025,-.205]])for(const angle of [-Math.PI/6,0,Math.PI/6]){
      const front=y<0?.242:-.025+.19*Math.sqrt(1-(x/.317)**2-((y-.02)/.31)**2)+.008;
      const origin=movingNope.head.localToWorld(new THREE.Vector3(x+Math.sin(angle)*2,y,front+Math.cos(angle)*2));
      const direction=new THREE.Vector3(-Math.sin(angle),0,-Math.cos(angle)).transformDirection(movingNope.head.matrixWorld),probe=new THREE.Raycaster(origin,direction),hits=[];
      for(const mesh of nopeMeshes(movingNope))THREE.Mesh.prototype.raycast.call(mesh,probe,hits);hits.sort((a,b)=>a.distance-b.distance);
      assert.ok(hits.length&&hits[0].object.name.includes('crossed X eyes'),'Both raised X eyes and the protruding tongue stay in front of the suit, collar and mittens');nopeFaceSamples++;
    }
    matrixClose(nopePart(movingNope,'rounded pink face cushion').parent.matrixWorld,movingNope.head.matrixWorld,'The expression follows the original head in movement and interactions');
  }
  movingNope.dispose();allCounts(nopeDisposal,0,'Animated NOPE borrowers do not release the standing model assets');
  // Changing role after a snapshot must never move the original skeleton or
  // create new surfaces again on subsequent frames or character round trips.
  for(const id of ['vandal','phantom','spectre','classic','ghost','knife'])for(const pose of [{},{moving:true},{planting:true},{defusing:true},{alive:false},{alive:true}])for(let frame=0;frame<6;frame++){
    const hashes=[],physicalHashes=[];
    for(let index=0;index<roleModels.length;index++){
      const model=roleModels[index];model.update(1/60,{alive:true,weapon:id,time:frame/60,character:roles[index],...pose});
      const hash=createHash('sha256');legacyTraverse(model.group,object=>{object.updateMatrix();hash.update(JSON.stringify([legacyVisible(object),...object.matrix.elements]));});hashes.push(hash.digest('hex'));
      model.group.updateMatrixWorld(true);
      if(roles[index]==='veil'){
        matrixClose(grassPart(model,'pebbled dirt cube').parent.matrixWorld,model.head.parent.matrixWorld,'The block follows the original upper body in every weapon, movement, interaction, death and revival pose');
        for(const [token,bone]of [['block grip hands','arm'],['square dirt feet','leg']])for(const mesh of grassMeshes(model).filter(object=>object.name.includes(token))){const side=mesh.parent.name.endsWith('R')?'R':'L',source=model[bone+side].children.find(object=>object.isGroup);matrixClose(mesh.parent.matrixWorld,source.matrixWorld,'Short square hands and feet stay attached to the original animated IK');}
        for(const mesh of grassMeshes(model))for(const value of mesh.matrixWorld.elements)assert.ok(Number.isFinite(value),'Short articulated block limbs keep finite world poses');
      }
      const physical=createHash('sha256');for(const mesh of model.meshes)physical.update(JSON.stringify(mesh.matrixWorld.elements));physicalHashes.push(physical.digest('hex'));
    }
    assert.equal(new Set(hashes).size,1,'Every replacement retains the same original skeleton, equipment transforms and normalized proxy visibility');
    assert.equal(new Set(physicalHashes).size,1,'The new appearance does not move any existing head/body/weapon hit surface in any pose');
  }
  const switching=roleModels[0];
  for(const character of roles)switching.update(0,{character,alive:true,weapon:'vandal'});
  const cached=resources(switching.group),cachedCounts=[cached.geometries.size,cached.materials.size,cached.textures.size];
  const cachedDisposal=watch([...cached.geometries,...cached.materials,...cached.textures].filter(resource=>!roleFinishes.has(resource)&&!avatarShared.has(resource)&&!starShared.has(resource)&&!solderShared.has(resource)&&!iagnuShared.has(resource)&&!onoShared.has(resource)&&!grassShared.has(resource)&&!nopeShared.has(resource)));
  assert.deepEqual(appearanceResources(switching).geometries,avatarResources.geometries,'A character switch borrows the existing avatar cache');
  assert.deepEqual(starResources(switching).geometries,starAssets.geometries,'The mascot keeps the same cache when the character changes');
  assert.deepEqual(solderResources(switching).geometries,solderAssets.geometries,'The worker borrows the existing avatar cache on a character switch');
  assert.deepEqual(iagnuResources(switching).geometries,iagnuAssets.geometries,'The letter avatar borrows the existing geometry cache on a character switch');
  assert.deepEqual(onoResources(switching).geometries,onoAssets.geometries,'Ono borrows its existing base and morph geometry on a character switch');
  assert.deepEqual(grassResources(switching).geometries,grassAssets.geometries,'Grass block borrows its existing cube and short-limb geometry cache on a character switch');
  assert.deepEqual(nopeResources(switching).geometries,nopeAssets.geometries,'NOPE borrows its existing face, suit and cola bottle on a character switch');
  for(let i=0;i<300;i++){
    const character=roles[i%roles.length];switching.update(1/60,{character,alive:true,time:i/60});
    const after=resources(switching.group);assert.deepEqual([after.geometries.size,after.materials.size,after.textures.size],cachedCounts,'Repeated role changes cannot allocate more resources');
    switching.group.traverse(object=>{if(object.isMesh&&object.userData.character)assert.equal(effectivelyVisible(object),object.userData.character===character);});
    for(const mesh of switching.meshes.filter(object=>object.userData.head))assert.equal(effectivelyVisible(mesh),!replacementRoles.has(character),'Switching away from all six avatars restores the original head visuals');
  }
  switching.update(0,{character:'invalid'});assert.equal(switching.group.userData.character,'duelist');
  switching.update(0,{character:'mend'});switching.update(0,{});assert.equal(switching.group.userData.character,'mend','Snapshots without a character field retain the current appearance');
  assert.equal(avatarGeometrySignature(avatarResources.geometries),avatarGeometryHash,'Three hundred role switches retain the shared avatar vertex data');
  assert.equal(avatarGeometrySignature(starAssets.geometries),starGeometryHash,'Three hundred switches retain the shared mascot vertex data');
  assert.equal(avatarGeometrySignature(solderAssets.geometries),solderGeometryHash,'Three hundred switches retain the worker vertex data');
  assert.equal(avatarGeometrySignature(iagnuAssets.geometries),iagnuGeometryHash,'Three hundred switches retain the letter vertex data');
  assert.equal(avatarGeometrySignature(onoAssets.geometries),onoGeometryHash,'Three hundred switches retain Ono base and morph vertex data');
  assert.equal(avatarGeometrySignature(grassAssets.geometries),grassGeometryHash,'Three hundred switches retain the cube and every pixel atlas coordinate');
  assert.equal(avatarGeometrySignature(nopeAssets.geometries),nopeGeometryHash,'Three hundred switches retain the shared curved face and PET bottle geometry');
  switching.dispose();switching.dispose();allCounts(cachedDisposal,1,'Private cached equipment resources release exactly once');allCounts(roleFinishDisposal,0,'Other live characters still hold the shared textures');allCounts(avatarDisposal,0,'The remaining avatar keeps its shared resources alive after 300 switches');allCounts(starDisposal,1,'The last mascot releases all of its geometry, materials and textures exactly once');
  for(const model of roleModels.slice(1,-1)){model.dispose();model.dispose();allCounts(roleFinishDisposal,0,'Each remaining role keeps the shared texture cache alive');}
  allCounts(avatarDisposal,1,'The last avatar releases every shared geometry, material and texture exactly once');
  allCounts(solderDisposal,1,'The last worker releases every shared geometry, material and texture exactly once');
  allCounts(iagnuDisposal,1,'The last letter avatar releases every shared geometry and metal material exactly once');
  allCounts(grassDisposal,1,'The last grass block releases every shared cube/limb geometry, material and pixel atlas exactly once');
  allCounts(nopeDisposal,1,'The final NOPE owner releases every shared face, suit, bottle and generated artwork resource exactly once');
  allCounts(onoDisposal,0,'The final Ono owner keeps its shared assets until its own disposal');
  roleModels.at(-1).dispose();roleModels.at(-1).dispose();allCounts(roleFinishDisposal,1,'The final role releases the four existing shared textures');allCounts(onoDisposal,1,'The final Ono releases each shared geometry, material and texture exactly once');
  const recreatedAvatar=createAgentModel(THREE,{bot:{id:'recreated-avatar'},team:'blue',character:'mend'}),recreatedResources=appearanceResources(recreatedAvatar);
  for(const resource of [...recreatedResources.geometries,...recreatedResources.materials,...recreatedResources.textures])assert.equal(avatarShared.has(resource),false,'A new avatar cannot reuse disposed GPU resources');
  for(const texture of recreatedResources.textures)assert.equal(digest(texture.image.data),avatarPixels.get(texture.name),'Avatar surfaces regenerate deterministically');
  assert.equal(avatarGeometrySignature(recreatedResources.geometries),avatarGeometryHash,'Recreated base and interaction-morph vertices remain deterministic');
  const recreatedAll=resources(recreatedAvatar.group),recreatedDisposal=watch([...recreatedAll.geometries,...recreatedAll.materials,...recreatedAll.textures]);
  recreatedAvatar.dispose();recreatedAvatar.dispose();allCounts(recreatedDisposal,1,'A fresh avatar and its private body resources all dispose exactly once');
  const recreatedStar=createAgentModel(THREE,{bot:{id:'recreated-star'},team:'blue',character:'duelist'}),recreatedStarAssets=starResources(recreatedStar);
  for(const resource of [...recreatedStarAssets.geometries,...recreatedStarAssets.materials,...recreatedStarAssets.textures])assert.equal(starShared.has(resource),false,'A new mascot cannot resurrect disposed resources');
  assert.equal(avatarGeometrySignature(recreatedStarAssets.geometries),starGeometryHash,'A recreated mascot regenerates every geometry byte deterministically');
  assert.deepEqual(new Map([...recreatedStarAssets.textures].map(texture=>[texture.name,digest(texture.image.data)])),starPixels,'The mascot surface regenerates deterministically');
  const recreatedStarAll=resources(recreatedStar.group),recreatedStarDisposal=watch([...recreatedStarAll.geometries,...recreatedStarAll.materials,...recreatedStarAll.textures]);
  recreatedStar.dispose();recreatedStar.dispose();allCounts(recreatedStarDisposal,1,'Recreated mascot shared and private resources all dispose exactly once');
  const recreatedSolder=createAgentModel(THREE,{bot:{id:'recreated-solder'},team:'blue',character:'ember'}),recreatedSolderAssets=solderResources(recreatedSolder);
  for(const resource of [...recreatedSolderAssets.geometries,...recreatedSolderAssets.materials,...recreatedSolderAssets.textures])assert.equal(solderShared.has(resource),false,'The worker cannot resurrect disposed resources');
  assert.equal(avatarGeometrySignature(recreatedSolderAssets.geometries),solderGeometryHash);assert.deepEqual(new Map([...recreatedSolderAssets.textures].map(texture=>[texture.name,digest(texture.image.data)])),solderPixels,'Worker geometry and images regenerate deterministically');
  const recreatedSolderAll=resources(recreatedSolder.group),recreatedSolderDisposal=watch([...recreatedSolderAll.geometries,...recreatedSolderAll.materials,...recreatedSolderAll.textures]);
  recreatedSolder.dispose();recreatedSolder.dispose();allCounts(recreatedSolderDisposal,1,'Recreated worker shared and private resources all dispose exactly once');
  const recreatedIagnu=createAgentModel(THREE,{bot:{id:'recreated-iagnu'},team:'blue',character:'echo'}),recreatedIagnuAssets=iagnuResources(recreatedIagnu);
  for(const resource of [...recreatedIagnuAssets.geometries,...recreatedIagnuAssets.materials,...recreatedIagnuAssets.textures])assert.equal(iagnuShared.has(resource),false,'IAGNU cannot resurrect disposed GPU resources');
  assert.equal(avatarGeometrySignature(recreatedIagnuAssets.geometries),iagnuGeometryHash,'The outlined letters, serif limbs and bevels regenerate deterministically');
  const recreatedIagnuAll=resources(recreatedIagnu.group),recreatedIagnuDisposal=watch([...recreatedIagnuAll.geometries,...recreatedIagnuAll.materials,...recreatedIagnuAll.textures]);
  recreatedIagnu.dispose();recreatedIagnu.dispose();allCounts(recreatedIagnuDisposal,1,'A recreated letter avatar and its original rig release all resources exactly once');
  const recreatedOno=createAgentModel(THREE,{bot:{id:'recreated-ono'},team:'blue',character:'frost'}),recreatedOnoAssets=onoResources(recreatedOno);
  for(const resource of [...recreatedOnoAssets.geometries,...recreatedOnoAssets.materials,...recreatedOnoAssets.textures])assert.equal(onoShared.has(resource),false,'Ono cannot resurrect disposed GPU resources');
  assert.equal(avatarGeometrySignature(recreatedOnoAssets.geometries),onoGeometryHash,'The new hair, clothes and interaction morph regenerate deterministically');
  assert.deepEqual(new Map([...recreatedOnoAssets.textures].map(texture=>[texture.name,digest(texture.image.data)])),onoPixels,'The blue eyes, cotton and tartan textures regenerate deterministically');
  const recreatedOnoAll=resources(recreatedOno.group),recreatedOnoDisposal=watch([...recreatedOnoAll.geometries,...recreatedOnoAll.materials,...recreatedOnoAll.textures]);
  recreatedOno.dispose();recreatedOno.dispose();allCounts(recreatedOnoDisposal,1,'A recreated Ono avatar and its original rig release all resources exactly once');
  const recreatedGrass=createAgentModel(THREE,{bot:{id:'recreated-grass'},team:'blue',character:'veil'}),recreatedGrassAssets=grassResources(recreatedGrass);
  for(const resource of [...recreatedGrassAssets.geometries,...recreatedGrassAssets.materials,...recreatedGrassAssets.textures])assert.equal(grassShared.has(resource),false,'Grass block cannot resurrect disposed GPU resources');
  assert.equal(avatarGeometrySignature(recreatedGrassAssets.geometries),grassGeometryHash);assert.deepEqual(new Map([...recreatedGrassAssets.textures].map(texture=>[texture.name,digest(texture.image.data)])),grassPixels,'The six block faces regenerate deterministically');
  const recreatedGrassAll=resources(recreatedGrass.group),recreatedGrassDisposal=watch([...recreatedGrassAll.geometries,...recreatedGrassAll.materials,...recreatedGrassAll.textures]);recreatedGrass.dispose();recreatedGrass.dispose();allCounts(recreatedGrassDisposal,1,'A recreated grass block and its private combat rig release all resources exactly once');
  const recreatedNope=createAgentModel(THREE,{bot:{id:'recreated-nope'},team:'blue',character:'nope'}),recreatedNopeAssets=nopeResources(recreatedNope);
  for(const resource of [...recreatedNopeAssets.geometries,...recreatedNopeAssets.materials,...recreatedNopeAssets.textures])assert.equal(nopeShared.has(resource),false,'NOPE cannot resurrect disposed shared resources');
  assert.equal(avatarGeometrySignature(recreatedNopeAssets.geometries),nopeGeometryHash);assert.deepEqual(new Map([...recreatedNopeAssets.textures].map(texture=>[texture.name,digest(texture.image.data)])),nopePixels,'The modeled expression and original label regenerate deterministically');
  const recreatedNopeAll=resources(recreatedNope.group),recreatedNopeDisposal=watch([...recreatedNopeAll.geometries,...recreatedNopeAll.materials,...recreatedNopeAll.textures]);recreatedNope.dispose();recreatedNope.dispose();allCounts(recreatedNopeDisposal,1,'Recreated NOPE shared assets and private combat rig release once');
  console.log('PASS: six unchanged exteriors, curved NOPE face and cola bottle, original 52 geometry references/weapons plus visible hit surfaces, all poses, 300 switches and single-owner resource cleanup');
  console.log(JSON.stringify({nopeFaceSamples,nopeGeometries:nopeAssets.geometries.size,nopeMaterials:nopeShared.size-nopeAssets.geometries.size-nopeAssets.textures.size,nopeTextures:nopeAssets.textures.size,nopeTextureBytes:512*512*4}));
  console.log(JSON.stringify({visibleMeshes, triangles, sharedTextures:4, sharedBaseBytes:baseBytes, sharedMippedKiB:+(baseBytes*4/3/1024).toFixed(1)}));
  console.log(JSON.stringify({roles:roleMetrics,roleSwitches:300,clothedKneeSamples,avatarSharedGeometries:avatarResources.geometries.size,avatarSharedMaterials:avatarResources.materials.size,avatarSharedTextures:avatarResources.textures.size,avatarSharedBaseBytes:avatarBytes,mascotEyeStars:eyeStars,mascotMouthSamples:mouthSamples,mascotSharedGeometries:starAssets.geometries.size,mascotSharedMaterials:starShared.size-starAssets.geometries.size-starAssets.textures.size,mascotSharedTextures:starAssets.textures.size,mascotSharedBaseBytes:starBytes,workerEyeSamples,whiteTempleVertices,workerSharedGeometries:solderAssets.geometries.size,workerSharedMaterials:solderShared.size-solderAssets.geometries.size-solderAssets.textures.size,workerSharedTextures:solderAssets.textures.size,workerSharedBaseBytes:solderBytes,letterRaySamples,letterSharedGeometries:iagnuAssets.geometries.size,letterSharedMaterials:iagnuShared.size-iagnuAssets.geometries.size-iagnuAssets.textures.size,letterSharedTextures:iagnuAssets.textures.size,onoEyeSamples,onoCrownSamples,onoClothedKneeSamples,onoSharedGeometries:onoAssets.geometries.size,onoSharedMaterials:onoShared.size-onoAssets.geometries.size-onoAssets.textures.size,onoSharedTextures:onoAssets.textures.size,onoSharedBaseBytes:onoBytes,grassCubeSamples,grassSharedGeometries:grassAssets.geometries.size,grassSharedMaterials:grassShared.size-grassAssets.geometries.size-grassAssets.textures.size,grassSharedTextures:grassAssets.textures.size,grassSharedBaseBytes:grassBytes}));
}
main().catch(error => {console.error(error); process.exitCode=1;});
