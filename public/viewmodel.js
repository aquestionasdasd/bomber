import { createWeaponModel, createEquipmentSurface, createKnifeFan } from './agent-model.js';

// Only the hands change; gun finishes, sleeves, animation and grip stay owned
// by this viewmodel. Palettes follow the existing reference avatars.
export const CHARACTER_HANDS = Object.freeze({
  duelist:['#e1e8e6','#a7bec4'], nope:['#fa159f','#fb68b7'],
  mend:['#d3d8bd','#8fbaa4'], echo:['#b6a16e','#e7d89b'],
  veil:['#557b33','#9b713b'], ember:['#e9c4a0','#be936f'],
  frost:['#eee8e2','#a6cddd'], duck:['#477f28','#f9d25c'],
  cat:['#fff5ec','#e8c4bf'], car:['#e9ece8','#292f33'],
  nobi:['#f0c49b','#dba87d'], japan:['#b99b6e','#e8ca91'],
  cap:['#f1b27a','#d79362'], urchin:['#a9f1e4','#70cabe'],
  onnara:['#ffdbba','#ffe073'],
});

// Camera-space equipment; proportions and finishes match the world agents.
export function createViewmodel(THREE, camera) {
  const group = new THREE.Group(); group.name = 'First-person equipment';
  group.position.set(.275, -.175, -.60); camera.add(group);
  const geometries = new Set(), materials = new Set(), models = new Map();
  const keep = geometry => (geometries.add(geometry), geometry);
  function material(color, roughness = .8, metalness = .04, glow = .17) {
    const result = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: glow,
      roughness, metalness, depthTest: true, depthWrite: true, transparent: true, fog: false });
    materials.add(result); return result;
  }
  const M = {
    sleeve: material('#53636b', .93), seam: material('#788b91', .9),
    glove: material('#8a806c', .94), pad: material('#a79e88', .88),
    skin: material('#c6a58e', .88), black: material('#2e3b40', .94),
    brass: material('#b49d67', .40, .42, .12),
  };
  M.glove.name='Character hands / main';M.pad.name='Character hands / detail';
  let handCharacter=null;
  function setCharacter(id){
    const next=Object.hasOwn(CHARACTER_HANDS,id)?id:'duelist';
    if(next===handCharacter)return;handCharacter=next;
    const colors=CHARACTER_HANDS[next];
    for(const [mat,color]of [[M.glove,colors[0]],[M.pad,colors[1]]]){mat.color.set(color);mat.emissive.set(color);}
    group.userData.handCharacter=next;
  }
  const clothSurface = createEquipmentSurface(THREE, true);
  for (const mat of [M.sleeve, M.seam, M.glove, M.pad]) {
    mat.roughnessMap = clothSurface; mat.bumpMap = clothSurface; mat.bumpScale = .0010;
  }
  const sphereGeometry = keep(new THREE.SphereGeometry(1, 12, 8));
  const capsuleGeometry = keep(new THREE.CapsuleGeometry(1, 3, 4, 10));
  const up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3();
  function mesh(parent, geometry, mat, p = [0, 0, 0], s = [1, 1, 1]) {
    const object = new THREE.Mesh(geometry, mat); object.position.set(...p); object.scale.set(...s);
    object.renderOrder = 100; object.frustumCulled = false; object.raycast = () => {};
    parent.add(object); return object;
  }
  const ball = (parent, p, s, mat) => mesh(parent, sphereGeometry, mat, p, s);
  function bone(parent, radius, mat) {
    const object = mesh(parent, capsuleGeometry, mat); object.userData.radius = radius; return object;
  }
  function placeBone(object, a, b, radius = object.userData.radius) {
    direction.subVectors(b, a); const length = Math.max(.001, direction.length());
    object.position.copy(a).add(b).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(up, direction.multiplyScalar(1 / length));
    object.scale.set(radius, (length + radius * .55) / 5, radius);
  }
  function batchHand(parent) {
    // Fingers and glove panels move together. Normal depth testing permits a
    // single rigid surface per finish instead of sorting every small finger.
    const buckets = new Map();
    for (const object of [...parent.children]) {
      if (!object.isMesh) continue;
      if (!buckets.has(object.material)) buckets.set(object.material, []);
      buckets.get(object.material).push(object);
    }
    for (const [mat, objects] of buckets) {
      if (objects.length < 2) continue;
      const positions = [], normals = [], uvs = [];
      for (const object of objects) {
        object.updateMatrix();
        const copy = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        copy.applyMatrix4(object.matrix);
        const p = copy.getAttribute('position'), n = copy.getAttribute('normal'), uv = copy.getAttribute('uv');
        for (let i = 0; i < p.count; i++) {
          positions.push(p.getX(i), p.getY(i), p.getZ(i)); normals.push(n.getX(i), n.getY(i), n.getZ(i));
          uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
        }
        copy.dispose(); parent.remove(object);
      }
      const geometry = keep(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.computeBoundingSphere(); mesh(parent, geometry, mat);
    }
  }
  const gripRotationInverse = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.12, -.12, -.12)).invert();
  function makeHand(parent, support = false, open = false, weapon = null) {
    const hand = new THREE.Group(); parent.add(hand);
    ball(hand, [0, 0, 0], support ? [.037, .027, .054] : [.032, .046, .030], M.glove);
    ball(hand, support ? [-.009, -.014, .004] : [.016, .005, .001], support ? [.034, .016, .044] : [.019, .034, .025], M.pad);
    // Four separate curved fingers wrap the handguard or pistol grip.
    for (let i = 0; i < 4; i++) {
      const first = bone(hand, .0085, M.glove), second = bone(hand, .008, M.glove);
      let a, b, c;
      if (support) {
        const z = -.030 + i * .019;
        a = new THREE.Vector3(-.027, -.005, z);
        b = new THREE.Vector3(open ? -.014 : .025, .011, z - .002);
        c = new THREE.Vector3(open ? .009 : .028, open ? .014 : .037, z - .003);
      } else {
        const y = -.026 + i * .016;
        a = new THREE.Vector3(.009, y, -.020);
        b = new THREE.Vector3(-.026, y, -.020);
        c = new THREE.Vector3(-.035, y, .009);
        if (i === 3) {
          b.set(-.012, y + .003, -.043); c.set(-.017, y - .004, -.064);
          if (weapon && !weapon.knife) {
            // Keep the wrist/grip fixed. Fit only the index finger inside the
            // guard, beside the trigger, instead of through its lower bar.
            const grip = new THREE.Vector3(...weapon.rearGrip); grip.x += .026;
            const zScale = weapon.group.scale.z;
            b.set(.026, weapon.sidearm ? -.073 : -.074, (weapon.sidearm ? .044 : .055) * zScale).sub(grip).applyQuaternion(gripRotationInverse);
            c.set(.013, weapon.sidearm ? -.070 : -.072, (weapon.sidearm ? .014 : .032) * zScale).sub(grip).applyQuaternion(gripRotationInverse);
          }
        }
      }
      placeBone(first, a, b); placeBone(second, b, c);
    }
    const thumb = bone(hand, .012, M.glove);
    placeBone(thumb, new THREE.Vector3(support ? -.028 : .015, .014, .027), new THREE.Vector3(support ? -.012 : -.016, .033, .022));
    // A small cuff seam joins the glove to the forearm without an exposed wrist gap.
    ball(hand, support ? [-.011, -.015, .043] : [.009, .019, .024], [.031, .019, .024], M.black);
    for (let i = 0; i < 3; i++) ball(hand, support ? [-.020 + i * .018, -.023, -.012] : [.024, -.021 + i * .019, .008], [.008, .008, .014], M.pad);
    batchHand(hand);
    return hand;
  }
  function makeArm(parent, side, support, open, weapon = null) {
    const root = new THREE.Group(); parent.add(root);
    const sleeve = bone(root, .053, M.sleeve), forearm = bone(root, .040, M.sleeve);
    const elbow = ball(root, [0, 0, 0], [.049, .044, .049], M.sleeve);
    const cuff = ball(root, [0, 0, 0], [.039, .023, .040], M.seam);
    const hand = makeHand(root, support, open, weapon);
    return { root, sleeve, forearm, elbow, cuff, hand, side };
  }
  // Reuse each firearm's existing metal image. A very fine machining grain and
  // distinct coated/edge/steel finishes read at arm's length without new draws,
  // geometry or textures. Linear grayscale can serve color, roughness and height.
  const metalPixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const grain = ((x * 19 + y * 43 + x * y * 7) % 23) - 11;
    const brushed = Math.sin(y * 2.41) * 4 + Math.sin(y * .73) * 2;
    const value = Math.round(Math.max(224, Math.min(255, 245 + brushed + grain * .45)));
    const offset = (y * 64 + x) * 4;
    metalPixels[offset] = metalPixels[offset + 1] = metalPixels[offset + 2] = value; metalPixels[offset + 3] = 255;
  }
  function finishFirearm(weapon) {
    for (const mat of weapon.materials) {
      const color = mat.color.getHexString();
      const finish = color === '5d707a' ? ['receiver', '#52636c', .63, .32, .10]
        : color === '85959a' ? ['edge', '#94a1a4', .36, .48, .075]
        : color === 'b4bec0' ? ['steel', '#b4bec0', .26, .62, .06] : null;
      if (!finish) continue;
      const surface = mat.roughnessMap;
      surface.image.data = metalPixels; surface.name = 'First-person finish / machined metal';
      surface.colorSpace = THREE.LinearSRGBColorSpace; surface.needsUpdate = true;
      mat.name = `First-person metal / ${finish[0]}`; mat.color.set(finish[1]); mat.emissive.copy(mat.color);
      mat.roughness = finish[2]; mat.metalness = finish[3]; mat.emissiveIntensity = finish[4];
      mat.map = surface; mat.bumpMap = surface; mat.bumpScale = .00016; mat.needsUpdate = true;
    }
  }
  for (const id of ['pump', 'drum', 'scout', 'atlas', 'forge', 'vandal', 'phantom', 'spectre', 'classic', 'ghost', 'knife']) {
    const parent = new THREE.Group(); parent.name = `Viewmodel / ${id}`; parent.visible = false; group.add(parent);
    const weapon = createWeaponModel(THREE, { id, firstPerson: true, team: 'blue', detailed: true });
    if (!weapon.knife) finishFirearm(weapon);
    parent.add(weapon.parent);
    const right = makeArm(parent, 1, false, false, weapon);
    const left = makeArm(parent, -1, true, id === 'knife');
    const fan = weapon.knife ? createKnifeFan(THREE, { weapon, firstPerson: true }) : null;
    const openRight = weapon.knife ? makeHand(right.root, true, true) : null;
    if (fan) parent.add(fan.group);
    if (openRight) { openRight.scale.x = -1; openRight.visible = false; }
    right.closedHand = right.hand;
    // Camera framing is independent of the world-scale weapon. Keep the grip and
    // both gloves inside the frame, including short pistols with a nearby rear grip.
    const framing = weapon.sidearm ? { scale: .80, x: .265, y: -.165, z: -.52, adsZ: -.46 }
      : weapon.knife ? { scale: .87, x: .235, y: -.19, z: -.49, adsZ: -.49 }
      : id === 'spectre' ? { scale: .88, x: .255, y: -.175, z: -.56, adsZ: -.56 }
      : { scale: .88, x: .275, y: -.175, z: -.60, adsZ: -.60 };
    parent.scale.setScalar(framing.scale);
    const rear = new THREE.Vector3(...weapon.rearGrip), front = new THREE.Vector3(...weapon.frontGrip);
    rear.x += .026;
    if (weapon.sidearm) { front.set(-.028, -.129, .110); }
    else if (!weapon.knife) { front.x = -.027; front.y -= .018; }
    const model = { parent, weapon, right, left, rear, front, framing, fan, openRight, meshes: [] };
    parent.traverse(object => { if (object.isMesh) { object.frustumCulled = false; model.meshes.push(object); } });
    models.set(id, model);
  }
  const muzzle = new THREE.Object3D(); muzzle.name = 'First-person muzzle';
  const flashMaterial = new THREE.MeshBasicMaterial({ color: '#ffe8ae', transparent: true, opacity: .9,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }); materials.add(flashMaterial);
  const flash = mesh(muzzle, keep(new THREE.OctahedronGeometry(.043)), flashMaterial, [0, 0, -.024], [.7, .7, 1.8]);
  flash.visible = false; flash.renderOrder = 118;
  const casings = [];
  const caseGeometry = keep(new THREE.CylinderGeometry(.0042, .0047, .019, 7));
  for (let i = 0; i < 5; i++) {
    const object = mesh(group, caseGeometry, M.brass); object.visible = false; object.renderOrder = 116;
    casings.push({ object, life: 0, velocity: new THREE.Vector3(), spin: 0 });
  }
  // All equipment is in the final transparent render bucket, at full opacity.
  // Start its own depth buffer once per frame: scenery cannot clip the muzzle,
  // while the hands, magazine, sights and receiver correctly occlude each other.
  let depthFrame = -1, depthRenderer = null;
  function prepareEquipmentDepth(renderer) {
    if (depthRenderer !== renderer || depthFrame !== renderer.info.render.frame) {
      renderer.clearDepth(); depthRenderer = renderer; depthFrame = renderer.info.render.frame;
    }
  }
  group.traverse(object => { if (object.isMesh) { object.onBeforeRender = prepareEquipmentDepth; object.renderOrder = 100; } });
  flash.renderOrder = 118;
  let current = '', equipBlend = 0, aimBlend = 0, wasReloading = false, reloadClock = 0;
  let previousKick = 0, boltKick = 0, caseIndex = 0, slash = 0, throwClock = 0, disposed = false;
  const bladeFraming = { scale: .87, x: 0, y: -.235, z: -.60, adsZ: -.60 };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), wrist = new THREE.Vector3();
  const caseOrigin = new THREE.Vector3(), magazineHand = new THREE.Vector3(), chargeHand = new THREE.Vector3();
  function smooth(value) { value = THREE.MathUtils.clamp(value, 0, 1); return value * value * (3 - value * 2); }
  function pulse(progress, start, peak, end) {
    return progress < peak ? smooth((progress - start) / (peak - start)) : 1 - smooth((progress - peak) / (end - peak));
  }
  function magazineOffset(progress) {
    if (progress < .19) return 0;
    if (progress < .42) return -.28 * smooth((progress - .19) / .23);
    // The hidden exchange holds the same depth reached by both visible curves.
    if (progress < .56) return -.28;
    if (progress < .75) return -.28 * (1 - smooth((progress - .56) / .19));
    return 0;
  }
  function reloadHand(target, progress, model) {
    const weapon = model.weapon;
    magazineHand.set(...weapon.magazineGrip).applyEuler(weapon.magazine.rotation).add(weapon.magazine.position).multiply(weapon.group.scale);
    chargeHand.set(weapon.sidearm ? -.043 : -.052, weapon.sidearm ? .044 : .027,
      (weapon.sidearm ? .030 : .060) + pulse(progress, .78, .835, .91) * .041);
    if (progress < .18) target.copy(model.front).lerp(magazineHand, smooth(progress / .18));
    else if (progress < .75) target.copy(magazineHand);
    else if (progress < .81) target.copy(magazineHand).lerp(chargeHand, smooth((progress - .75) / .06));
    else if (progress < .90) target.copy(chargeHand);
    else target.copy(chargeHand).lerp(model.front, smooth((progress - .90) / .10));
  }
  function poseArm(part, target, model, reloadProgress, reloading) {
    const right = part.side > 0;
    a.set(right ? .20 : -.23, -.32, right ? .38 : .31);
    b.set(right ? .107 : -.145, right ? -.203 : -.19, right ? .225 : -.015);
    if (model.weapon.sidearm && !right) b.set(-.12, -.21, .15);
    if (model.weapon.knife && !right) b.set(-.24, -.18, .11);
    if (reloading && !right) { b.y -= Math.sin(reloadProgress * Math.PI) * .085; b.z += .06; }
    placeBone(part.sleeve, a, b);
    part.elbow.position.copy(b);
    c.copy(target); c.z += right ? .022 : .035;
    placeBone(part.forearm, b, c);
    part.cuff.position.copy(c); part.cuff.quaternion.copy(part.forearm.quaternion);
    part.hand.position.copy(target);
    part.hand.rotation.set(right ? -.12 : model.weapon.sidearm ? -.30 : .02,
      right ? -.12 : model.weapon.sidearm ? .4 : -.05,
      right ? -.12 : model.weapon.sidearm ? .25 : -.10);
    if (reloading && !right) {
      const grasp = smooth(reloadProgress / .18) * (1 - smooth((reloadProgress - .75) / .06));
      part.hand.rotation.z -= grasp * .9;
      part.hand.rotation.x += grasp * .12;
    }
  }
  function setWeapon(id, reset = false) {
    const next = models.has(id) ? id : 'classic'; if (next === current && !reset) return;
    if (current) equipBlend = reset ? 0 : 1;
    if (reset) aimBlend = 0;
    if (current) models.get(current).fan?.update(0, { active: false, count: 5 });
    current = next; previousKick = 0; boltKick = 0; slash = 0; throwClock = 0; wasReloading = false; reloadClock = 0;
    for (const [name, model] of models) model.parent.visible = name === current;
    const model = models.get(current); model.weapon.muzzle.add(muzzle); muzzle.position.set(0, 0, 0); flash.visible = false;
    for (const item of casings) { item.life = 0; item.object.visible = false; }
  }
  function eject(model, seed = null) {
    // Spectator-only casing motion must not consume the host's combat RNG.
    const random = seed === null ? Math.random : () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296; };
    const item = casings[caseIndex++ % casings.length];
    model.weapon.bolt.getWorldPosition(caseOrigin); group.worldToLocal(caseOrigin);
    item.object.position.copy(caseOrigin); item.object.position.x += .045;
    item.velocity.set(.43 + random() * .12, .18 + random() * .06, .10);
    item.life = .42; item.spin = (random() + .5) * 13; item.object.visible = true;
  }
  function update(dt, state = {}) {
    if (disposed) return;
    if(state.character!==undefined)setCharacter(state.character);
    dt = Math.min(.1, Math.max(0, Number(dt) || 0));
    const model = models.get(current), weapon = model.weapon, time = Number(state.time) || 0;
    const smoothing = 1 - Math.exp(-dt * 17);
    const thrown = model.fan?.update(dt, { active: Boolean(state.ultimate) && !state.interacting,
      count: state.knives, shotSequence: state.shotSequence, time });
    throwClock = thrown ? .20 : Math.max(0, throwClock - dt);
    const bladeStorm = Boolean(model.fan && (state.ultimate || model.fan.group.userData.throwing));
    const throwFlick = Math.sin(Math.min(1, throwClock / .20) * Math.PI);
    // Also hide the solid equipment while looking through the optical overlay.
    // This guard survives an equip/snapshot arriving between gameplay frames.
    weapon.group.visible = !bladeStorm && !state.scoped;
    if (model.openRight) {
      model.openRight.visible = bladeStorm; model.right.closedHand.visible = !bladeStorm;
      model.right.hand = bladeStorm ? model.openRight : model.right.closedHand;
    }
    const isReloading = Boolean(state.reloading);
    if (!wasReloading && isReloading) reloadClock = 0;
    if (isReloading) reloadClock += dt;
    const duration = Math.max(.1, Number(state.reloadDuration) || 2.5);
    const remaining = typeof state.reloading === 'number' ? state.reloading : Math.max(0, duration - reloadClock);
    const progress = isReloading ? THREE.MathUtils.clamp(1 - remaining / duration, 0, 1) : 0;
    wasReloading = isReloading;
    const cycling = (current === 'scout' || current === 'atlas') && !isReloading && !state.interacting && Number.isFinite(state.cycleProgress) && state.cycleProgress < 1;
    const cycleProgress = cycling ? THREE.MathUtils.clamp(state.cycleProgress, 0, 1) : 0;
    const cycleWave = cycling ? Math.sin(cycleProgress * Math.PI) : 0;
    const cycleGrip = cycling ? smooth(cycleProgress / .2) * (1 - smooth((cycleProgress - .76) / .2)) : 0;
    const cyclePull = cycling ? pulse(cycleProgress, .28, .48, .68) : 0;
    const cycleLift = cycling ? pulse(cycleProgress, .14, .25, .76) : 0;
    const aiming = state.aiming && !cycling && !weapon.knife && !isReloading && !state.interacting;
    aimBlend += ((aiming ? 1 : 0) - aimBlend) * smoothing;
    equipBlend = Math.max(0, equipBlend - dt * 4.6);
    const movement = THREE.MathUtils.clamp(Number(state.moving) || 0, 0, 1);
    const bob = Math.sin(time * 9.5) * .0035 * movement * (1 - aimBlend * .86);
    const sway = Math.sin(time * 4.75) * .0035 * movement * (1 - aimBlend * .88);
    const kick = Math.max(0, Number(state.kick) || 0);
    const shot = kick > previousKick + .003 && !isReloading && !state.interacting;
    if (shot && !bladeStorm) { boltKick = 1; if (weapon.knife) slash = 1; else eject(model, state.spectating ? (Number(state.shotSequence)||0)>>>0 : null); }
    previousKick = kick; boltKick *= Math.exp(-dt * 24); slash = Math.max(0, slash - dt * 5);
    const reloadWave = isReloading ? Math.sin(progress * Math.PI) : 0;
    const framing = bladeStorm ? bladeFraming : model.framing;
    const targetX = THREE.MathUtils.lerp(framing.x, 0, aimBlend) + sway - reloadWave * .018;
    const targetY = THREE.MathUtils.lerp(framing.y, -weapon.sightY * framing.scale, aimBlend) + bob - reloadWave * .057 - cycleWave * .025 - equipBlend * .13 - (state.interacting ? .22 : 0);
    const targetZ = THREE.MathUtils.lerp(framing.z, framing.adsZ, aimBlend) + kick * .72 + equipBlend * .07;
    group.position.x += (targetX - group.position.x) * smoothing;
    group.position.y += (targetY - group.position.y) * smoothing;
    group.position.z += (targetZ - group.position.z) * smoothing;
    group.rotation.set(kick * 1.13 - reloadWave * .17 + cycleWave * .04 + (state.interacting ? .37 : 0) + slash * .15,
      reloadWave * -.13 - cycleWave * .05 - slash * .38,
      (weapon.knife ? -.12 : 0) * (1 - aimBlend) + sway - reloadWave * .34 - cycleWave * .16 + slash * .3);
    if (bladeStorm) group.rotation.set(-throwFlick * .035, 0, sway);
    const magDrop = isReloading ? magazineOffset(progress) : 0;
    weapon.magazine.position.set(0, magDrop, isReloading ? -magDrop * .18 : 0);
    weapon.magazine.rotation.set(isReloading ? -magDrop * .55 : 0, 0, isReloading ? -magDrop * .15 : 0);
    weapon.magazine.visible = !(isReloading && progress > .41 && progress < .56);
    const charge = isReloading ? pulse(progress, .78, .835, .91) : 0;
    weapon.bolt.position.z = boltKick * .027 + charge * .041 + cyclePull * .08;
    weapon.bolt.rotation.z = cycling ? -cycleLift * .75 : 0;
    weapon.slide.position.z = boltKick * .032 + charge * .045;
    wrist.copy(model.rear);
    if (cycling) wrist.lerp(chargeHand.set(.065, .008, .064 + cyclePull * .08).multiply(weapon.group.scale), cycleGrip);
    if (bladeStorm) wrist.set(.235, .005 + throwFlick * .018, .045 - throwFlick * .19);
    poseArm(model.right, wrist, model, progress, isReloading);
    if (cycling) model.right.hand.rotation.z -= cycleLift * .5;
    wrist.copy(model.front);
    if (isReloading) reloadHand(wrist, progress, model);
    else if (state.interacting) wrist.lerp(magazineHand.set(-.15, -.22, -.16), .9);
    if (bladeStorm) wrist.set(-.235, -.012, .045);
    poseArm(model.left, wrist, model, progress, isReloading);
    if (bladeStorm) {
      model.right.hand.rotation.set(-.08, .10, -.40 + throwFlick * .16);
      model.left.hand.rotation.set(-.08, -.10, .40);
    }
    if (weapon.knife || state.interacting || isReloading) flash.visible = false;
    group.updateMatrixWorld(true);

    for (const item of casings) {
      if (item.life <= 0) continue;
      item.life -= dt; item.object.visible = item.life > 0 && group.visible;
      item.object.position.addScaledVector(item.velocity, dt); item.velocity.y -= dt * 1.2;
      item.object.rotation.x += dt * item.spin; item.object.rotation.z += dt * item.spin * .63;
    }
  }
  function dispose() {
    if (disposed) return; disposed = true;
    group.removeFromParent();
    for (const model of models.values()) { model.fan?.dispose(); model.weapon.dispose(); }
    for (const item of casings) item.object.removeFromParent();
    for (const geometry of geometries) geometry.dispose();
    for (const mat of materials) mat.dispose();
    clothSurface.dispose();
  }
  setWeapon('vandal'); group.visible = false;
  return { group, muzzle, flash, setWeapon, setCharacter, update, dispose };
}
