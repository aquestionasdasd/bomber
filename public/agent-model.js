import { createUrchinAvatar } from './urchin-avatar.js';
import { createCapAvatar } from './cap-avatar.js';
import { createJapanAvatar } from './japan-avatar.js';
import { createNobiAvatar } from './nobi-avatar.js';
import { createCarAvatar } from './car-avatar.js';
import { createCatAvatar } from './cat-avatar.js';
import { createDuckAvatar } from './duck-avatar.js';
import { createSunflowerAvatar } from './sunflower-avatar.js';
import { createStarMascotAvatar } from './star-mascot-avatar.js';
import { createSolderAvatar } from './solder-avatar.js';
import { createIagnuAvatar } from './iagnu-avatar.js';
import { createOnoAvatar } from './ono-avatar.js';
import { createEnemyRim } from './enemy-rim.js';
import { createGrassBlockAvatar } from './grass-block-avatar.js';
import { createNopeAvatar } from './nope-avatar.js';

// Small generated surface maps keep cloth and machined metal distinct at close range.
// They are local data, require no image download, and remain deterministic in tests.
export function createEquipmentSurface(THREE, cloth = false) {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = ((x * 19 + y * 43 + x * y * 7) % 23) - 11;
    const value = cloth ? 211 + grain + ((x % 4 < 2) !== (y % 4 < 2) ? 20 : 0) : 226 + grain * .75 + (y % 13 === 0 ? -9 : 0);
    const index = (y * size + x) * 4; data[index] = data[index + 1] = data[index + 2] = value; data[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(cloth ? 4 : 2, cloth ? 6 : 2);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  texture.anisotropy = 4; texture.needsUpdate = true; return texture;
}

// Body finishes belong to agents, not to the shared weapon kit. All live agents
// borrow the same small images; the last owner releases them after its materials.
const agentFinishCaches = new WeakMap();
function acquireAgentFinishes(THREE) {
  let cache = agentFinishCaches.get(THREE);
  if (!cache) {
    const finish = (kind, size) => {
      const data = new Uint8Array(size * size * 4);
      const armorEdge = [[-.151, -.15], [.151, -.15], [.188, .065], [.126, .155], [-.126, .155], [-.188, .065]];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = (x + .5) / size, v = (y + .5) / size;
        const grain = ((x * 19 + y * 43 + x * y * 7) % 17) - 8;
        let value = 242, red = 0, blue = 0;
        if (kind === 'cloth') {
          value = 240 + grain * .28 + ((x % 4 < 2) !== (y % 4 < 2) ? 2 : -2);
          // One lapped seam with individual stitches, rather than a tiled grid.
          const seam = Math.abs(u - .17), stitch = Math.abs((v * 32) % 1 - .5);
          if (seam < .011) value -= 19 * (1 - seam / .011);
          if (Math.abs(seam - .016) < .005 && stitch < .2) value = 250;
          const cuff = Math.abs(v - .19);
          if (cuff < .009 && u > .24 && u < .79) value -= 13 * (1 - cuff / .009);
        } else if (kind === 'armor') {
          value = 247 + grain * .22;
          const px = u - .5, py = v - .5;
          let distance = Infinity;
          for (let i = 0; i < armorEdge.length; i++) {
            const a = armorEdge[i], b = armorEdge[(i + 1) % armorEdge.length], dx = b[0] - a[0], dy = b[1] - a[1];
            const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
            distance = Math.min(distance, Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy));
          }
          if (distance < .008) value -= 19 * (1 - distance / .008);
          if (distance > .008 && distance < .014) value = Math.max(value, 252);
          for (const sx of [-.12, .12]) for (const sy of [-.11, .115]) {
            const radius = Math.hypot(px - sx, py - sy);
            if (radius < .0075) value = radius > .0048 ? 192 : 228;
            if (radius < .0047 && Math.abs(py - sy) < .0018) value = 173;
          }
        } else if (kind === 'glove') {
          value = 239 + grain * .28;
          const seam = Math.abs(u - .14);
          if (seam < .012) value -= 22 * (1 - seam / .012);
          if (Math.abs(seam - .019) < .005 && (v * 27) % 1 < .38) value = 250;
          for (const fold of [.36, .51, .63]) {
            const crease = Math.abs(v - fold - Math.sin(u * Math.PI * 2) * .026);
            if (u > .24 && u < .78 && crease < .010) value -= 20 * (1 - crease / .010);
          }
        } else {
          // A smoked lens with a small reflected strip of sky, not a glowing eye.
          const band = Math.exp(-Math.pow((v - .73 + u * .17) / .022, 2));
          const glow = Math.exp(-Math.pow((u - .29) / .22, 2) - Math.pow((v - .68) / .17, 2));
          value = 125 + v * 23 + band * 59 + glow * 34;
          red = -5; blue = 3;
        }
        const offset = (y * size + x) * 4;
        data[offset] = Math.max(0, Math.min(255, Math.round(value + red)));
        data[offset + 1] = Math.max(0, Math.min(255, Math.round(value)));
        data[offset + 2] = Math.max(0, Math.min(255, Math.round(value + blue))); data[offset + 3] = 255;
      }
      const texture = new THREE.DataTexture(data, size, size);
      texture.name = `Agent finish / ${kind}`; texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      if (kind === 'armor') texture.offset.set(.5, .5);
      if (kind === 'lens') { texture.repeat.set(8.8, 18); texture.offset.set(.5, .5); }
      texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
      return texture;
    };
    cache = { references: 0, cloth: finish('cloth', 128), armor: finish('armor', 256), glove: finish('glove', 128), lens: finish('lens', 128) };
    agentFinishCaches.set(THREE, cache);
  }
  cache.references++;
  let released = false;
  return { ...cache, release() {
    if (released) return; released = true;
    if (--cache.references === 0) {
      for (const texture of [cache.cloth, cache.armor, cache.glove, cache.lens]) texture.dispose();
      agentFinishCaches.delete(THREE);
    }
  } };
}

// Locally built tactical equipment. World agents and camera weapons share this vocabulary.
function createKit(THREE, { firstPerson = false, team = 'blue', bot = null } = {}) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const keep = geometry => (geometries.add(geometry), geometry);
  const mat = (color, roughness = .64, metalness = .12, glow = 0) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness,
      emissive: color, emissiveIntensity: glow, fog: !firstPerson,
      depthTest: true, depthWrite: true, transparent: firstPerson });
    materials.add(material); return material;
  };
  const M = {
    fabric: mat('#53636b', .92, .02), seam: mat('#788b91', .85, .03),
    armor: mat(team === 'red' ? '#a76057' : '#438b91', .60, .16),
    edge: mat('#85959a', .48, .30), dark: mat('#34434b', .77, .10),
    gun: mat('#5d707a', .50, .28), steel: mat('#b4bec0', .33, .53),
    rubber: mat('#2e3b40', .97, .01), glove: mat('#8a806c', .94, .02),
    skin: mat('#c6a58e', .89, .01), glass: mat('#4a8995', .23, .35),
    signal: mat(team === 'red' ? '#e79483' : '#8fd9cb', .40, .26, .48),
    mark: mat('#b7bbae', .80, .04), accent: mat('#bb635b', .49, .30),
  };
  const cloth = createEquipmentSurface(THREE, true), metal = createEquipmentSurface(THREE); textures.add(cloth); textures.add(metal);
  for (const material of [M.fabric, M.seam, M.glove]) {
    material.roughnessMap = cloth; material.bumpMap = cloth; material.bumpScale = .0010;
  }
  for (const material of [M.gun, M.edge, M.steel]) { material.roughnessMap = metal; }
  // A modest light contribution keeps the camera-space model legible without a neon body.
  if (firstPerson) for (const material of materials) material.emissiveIntensity = Math.max(.13, material.emissiveIntensity);
  const sphere = keep(new THREE.SphereGeometry(1, 12, 8));
  const cylinder = keep(new THREE.CylinderGeometry(1, 1, 1, 10));
  const capsule = keep(new THREE.CapsuleGeometry(1, 4, 4, 10));
  const cube = keep(new THREE.BoxGeometry(1, 1, 1));
  const meshes = [];
  function mesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], head = false, hittable = true) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position); object.scale.set(...scale);
    object.castShadow = !firstPerson; object.receiveShadow = !firstPerson;
    if (firstPerson) object.renderOrder = 100;
    if (bot && hittable) { object.userData.bot = bot; object.userData.head = head; meshes.push(object); }
    if (!hittable) object.raycast = () => {};
    parent.add(object); return object;
  }
  const ball = (parent, p, s, material, head = false) => mesh(parent, sphere, material, p, s, head);
  const box = (parent, p, s, material = M.gun, head = false) => mesh(parent, cube, material, p, s, head);
  function tube(parent, p, radius, length, material = M.gun, axis = 'z', head = false) {
    const object = mesh(parent, cylinder, material, p, [radius, length, radius], head);
    if (axis === 'z') object.rotation.x = Math.PI / 2;
    if (axis === 'x') object.rotation.z = Math.PI / 2;
    return object;
  }
  function plate(parent, points, depth, material, head = false, side = false, bevel = .005) {
    const shape = new THREE.Shape();
    for (let i = 0; i < points.length; i++) {
      const [a, b] = points[i]; const x = side ? -a : a;
      if (i) shape.lineTo(x, b); else shape.moveTo(x, b);
    }
    shape.closePath();
    const geometry = keep(new THREE.ExtrudeGeometry(shape, { depth: Math.max(.001, depth - bevel * 2),
      bevelEnabled: bevel > 0, bevelSegments: 2, steps: 1, bevelSize: bevel, bevelThickness: bevel }));
    geometry.translate(0, 0, -depth / 2 + bevel);
    const object = mesh(parent, geometry, material, [0, 0, 0], [1, 1, 1], head);
    if (side) object.rotation.y = Math.PI / 2;
    return object;
  }
  function softBox(parent, p, s, material, bevel = .012, head = false) {
    const [w, h, d] = s, b = Math.min(bevel, w / 4, h / 4, d / 4);
    const points = [[-w / 2 + b, -h / 2], [w / 2 - b, -h / 2], [w / 2, -h / 2 + b],
      [w / 2, h / 2 - b], [w / 2 - b, h / 2], [-w / 2 + b, h / 2], [-w / 2, h / 2 - b], [-w / 2, -h / 2 + b]];
    const object = plate(parent, points, d, material, head, false, Math.min(b * .45, .008));
    object.position.set(...p); return object;
  }
  const up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3();
  function segment(parent, radius, material, head = false) {
    const object = mesh(parent, capsule, material, [0, 0, 0], [radius, .1, radius], head);
    object.userData.radius = radius; return object;
  }
  function placeSegment(object, a, b, radius = object.userData.radius) {
    direction.subVectors(b, a); const length = Math.max(.001, direction.length());
    object.position.copy(a).add(b).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(up, direction.multiplyScalar(1 / length));
    // Broad central sections overlap the joint covers instead of meeting at a point.
    object.scale.set(radius, (length + radius * .8) / 6, radius);
  }
  function batchRigid(parent) {
    // Only direct Mesh children are rigid in this frame. Joint/attachment groups survive intact.
    parent.updateMatrix();
    const batches = new Map();
    for (const object of [...parent.children]) {
      if (!object.isMesh || Array.isArray(object.material) || object.raycast !== THREE.Mesh.prototype.raycast) continue;
      const key = `${object.material.uuid}/${object.userData.head ? 'head' : 'body'}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(object);
    }
    for (const objects of batches.values()) {
      if (objects.length < 2) continue;
      const positions = [], normals = [], uvs = [];
      for (const object of objects) {
        object.updateMatrix();
        const copy = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        copy.applyMatrix4(object.matrix);
        if (!copy.getAttribute('normal')) copy.computeVertexNormals();
        const position = copy.getAttribute('position'), normal = copy.getAttribute('normal'), uv = copy.getAttribute('uv');
        for (let i = 0; i < position.count; i++) {
          positions.push(position.getX(i), position.getY(i), position.getZ(i));
          normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
          uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
        }
        copy.dispose();
      }
      const geometry = keep(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const merged = mesh(parent, geometry, objects[0].material, [0, 0, 0], [1, 1, 1], Boolean(objects[0].userData.head));
      merged.name = `Rigid equipment / ${objects[0].material.color.getHexString()}`;
      for (const object of objects) {
        parent.remove(object);
        const index = meshes.indexOf(object); if (index >= 0) meshes.splice(index, 1);
      }
    }
  }
  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
  }
  return { THREE, M, mesh, box, ball, tube, plate, softBox, segment, placeSegment, batchRigid, keep, meshes,
    geometries, materials, dispose, firstPerson };
}

function buildWeapon(kit, id, parent, detailed = true) {
  const { THREE, M, box, tube, softBox, plate } = kit;
  const group = new THREE.Group(); group.name = `Equipment / ${id}`; parent.add(group);
  const magazine = new THREE.Group(), bolt = new THREE.Group(), slide = new THREE.Group();
  group.add(magazine, bolt, slide);
  const profile = (target, points, width, material, bevel = .003) => plate(target, points, width, material, false, true, bevel);
  const sidearm = id === 'classic' || id === 'ghost', knife = id === 'knife';
  let muzzle = [0, 0, -.55], sightY = .085;
  let rearGrip = [0, -.114, .102], frontGrip = [-.014, -.058, -.24];
  let magazineGrip = [-.035, -.181, -.045];
  function sights(rear, front, height) {
    softBox(group, [0, height - .020, rear], [.041, .016, .032], M.dark, .003);
    const ring = kit.mesh(group, kit.keep(new THREE.TorusGeometry(.0095, .0028, 5, 14)), M.edge, [0, height, rear]);
    box(group, [0, height - .008, front], [.007, .022, .013], M.dark);
    const baseBottom = sidearm ? .033 : .019, baseTop = height - .014;
    softBox(group, [0, (baseBottom + baseTop) / 2, front + .002], [.019, baseTop - baseBottom, .023], M.gun, .003);
    box(group, [0, height + .002, front - .002], [.0035, .004, .009], M.signal);
    return ring;
  }
  if (knife) {
    const blade = plate(group, [[-.026, .06], [-.031, .29], [0, .455], [.029, .29], [.024, .06]], .012, M.steel, false, false, .0015);
    blade.rotation.x = -Math.PI / 2;
    const bevel = plate(group, [[0, .065], [0, .435], [.024, .288], [.019, .065]], .0018, M.edge, false, false, 0);
    bevel.position.z = .007; bevel.rotation.x = -Math.PI / 2;
    softBox(group, [0, 0, -.043], [.098, .02, .025], M.dark, .005);
    tube(group, [0, 0, .074], .024, .19, M.rubber, 'z');
    for (let i = 0; i < 5; i++) tube(group, [0, 0, .002 + i * .033], .0255, .007, M.seam);
    tube(group, [0, 0, .175], .028, .016, M.edge);
    rearGrip = [0, -.012, .073]; frontGrip = [-.19, .015, -.06]; muzzle = [0, 0, -.46];
  } else if (sidearm) {
    const ghost = id === 'ghost'; sightY = .073;
    profile(slide, [[.12, .038], [-.205, .038], [-.235, .017], [-.222, -.026], [.115, -.026]], .071, M.gun, .004);
    softBox(slide, [0, .041, -.045], [.058, .012, .285], M.dark, .003);
    softBox(slide, [.037, -.010, -.115], [.004, .010, .155], M.edge, .001);
    softBox(slide, [.038, .012, -.052], [.004, .026, .075], M.dark, .001);
    softBox(slide, [.040, .012, -.049], [.004, .018, .047], M.steel, .001);
    for (let i = 0; i < (detailed ? 6 : 3); i++) for (const side of [-1, 1]) {
      box(slide, [side * .038, .005, .026 + i * .013], [.003, .035, .004], M.dark);
    }
    softBox(slide, [-.037, -.010, -.115], [.004, .010, .155], M.edge, .001);
    if (detailed) for (let i = 0; i < 3; i++) box(slide, [-.038, .009, -.083 + i * .014], [.002, .004, .006], M.dark);
    profile(group, [[.106, -.025], [-.185, -.025], [-.179, -.049], [.042, -.06], [.099, -.17], [.15, -.155]], .059, M.dark, .004);
    softBox(group, [.031, -.107, .112], [.009, .073, .04], M.rubber, .002);
    softBox(group, [-.031, -.107, .112], [.009, .073, .04], M.rubber, .002);
    box(group, [0, -.094, -.003], [.042, .007, .079], M.edge);
    box(group, [0, -.069, -.044], [.041, .047, .007], M.dark);
    box(group, [0, -.068, .014], [.009, .03, .007], M.steel);
    softBox(magazine, [0, -.124, .122], [.046, .096, .041], M.gun, .003);
    softBox(magazine, [0, -.174, .124], [.065, .014, .061], M.rubber, .003);
    tube(group, [0, .002, -.236], .013, .036, M.steel);
    if (ghost) {
      tube(group, [0, .002, -.327], .023, .177, M.gun);
      tube(group, [0, .002, -.246], .025, .014, M.edge);
      tube(group, [0, .002, -.413], .0238, .008, M.edge);
    }
    sights(.087, -.184, sightY);
    rearGrip = [0, -.12, .112]; frontGrip = [-.036, -.125, .07];
    magazineGrip = [-.032, -.171, .122];
    muzzle = [0, .002, ghost ? -.428 : -.26];
  } else {
    const phantom = id === 'phantom', compact = id === 'spectre';
    const stretch = compact ? .80 : 1;
    profile(group, [[.145, .038], [-.248, .038], [-.272, .015], [-.25, -.042], [-.085, -.055], [.12, -.051], [.16, -.025]], .087, M.gun, .004);
    profile(group, [[-.14, .027], [-.37, .022], [-.398, -.006], [-.36, -.044], [-.14, -.047]], .073, M.gun, .004);
    profile(group, [[.10, -.043], [-.10, -.043], [-.081, -.081], [-.016, -.086], [.058, -.064], [.117, -.060]], .073, M.gun, .003);
    softBox(group, [0, .042, -.047], [.060, .016, .367], M.dark, .003);
    box(group, [0, .053, -.047], [.047, .006, .36], M.edge);
    const vents = detailed ? 6 : 3;
    for (let i = 0; i < vents; i++) {
      const z = -.182 - i * .032;
      softBox(group, [.038, -.006, z], [.004, .018, .017], M.dark, .001);
      softBox(group, [-.038, -.006, z], [.004, .018, .017], M.dark, .001);
    }
    softBox(group, [.046, .012, -.105], [.003, .010, .116], M.edge, .001);
    if (detailed) for (let i = 0; i < 6; i++) box(group, [0, .059, -.23 + i * .045], [.046, .004, .011], M.dark);
    softBox(group, [.045, -.010, .015], [.004, .026, .095], M.dark, .001);
    softBox(bolt, [.048, -.010, .009], [.004, .018, .068], M.steel, .001);
    tube(bolt, [.054, -.006, .064], .007, .018, M.steel, 'x');
    tube(group, [.047, -.027, .107], .009, .005, M.dark, 'x');
    box(group, [.050, -.026, .103], [.003, .003, .014], M.edge).rotation.x = -.38;
    box(group, [.047, -.040, -.1], [.004, .005, .061], M.accent);
    softBox(group, [-.047, -.010, .08], [.012, .015, .046], M.edge, .002);
    // The player's view faces the receiver's left side. Give that broad surface
    // a fitted panel and controls, rather than leaving it as an empty slab.
    profile(group, [[.112, .015], [-.142, .015], [-.16, -.009], [-.084, -.034], [.11, -.032]], .004, M.dark, .001).position.x = -.046;
    softBox(group, [-.049, -.004, -.015], [.004, .010, .070], M.edge, .001);
    tube(group, [-.050, -.025, .093], .010, .004, M.steel, 'x');
    softBox(group, [-.053, -.023, .083], [.005, .005, .026], M.dark, .001).rotation.x = -.35;
    if (detailed) {
      for (const z of [-.119, .107]) tube(group, [-.051, .014, z], .0045, .004, M.steel, 'x');
      for (let i = 0; i < 3; i++) box(group, [-.050, -.023, -.077 + i * .009], [.003, .004, .004], M.accent);
    }
    // The camera model uses a compact stock: a full world-scale butt sits very
    // near the eye and otherwise covers the entire lower ADS view.
    const stockScale = kit.firstPerson ? .50 : 1, stockHeight = kit.firstPerson ? .70 : 1;
    const stockZ = z => .14 + (z - .14) * stockScale;
    profile(group, [[.14, .025], [.208, .032], [.335, .017], [.348, -.07], [.283, -.078], [.212, -.040], [.14, -.026]].map(([z, y]) => [stockZ(z), y * stockHeight]), .061, M.dark, .004);
    softBox(group, [0, .026 * stockHeight, stockZ(.238)], [.068, .026 * stockHeight, .164 * stockScale], M.gun, .005);
    softBox(group, [.033, -.013 * stockHeight, stockZ(.265)], [.006, .036 * stockHeight, .107 * stockScale], M.gun, .004);
    softBox(group, [0, -.029 * stockHeight, stockZ(.347)], [.074, .103 * stockHeight, .017], M.rubber, .004);
    tube(group, [0, 0, .167], .033, .024, M.edge);
    profile(group, [[.12, -.048], [.065, -.052], [.093, -.168], [.146, -.16]], .055, M.rubber, .004);
    if (detailed) for (let i = 0; i < 4; i++) box(group, [.029, -.085 - i * .02, .109 + i * .004], [.004, .005, .039], M.seam);
    box(group, [0, -.105, .016], [.045, .007, .085], M.dark);
    box(group, [0, -.078, -.028], [.045, .056, .007], M.dark);
    box(group, [0, -.070, .032], [.008, .03, .008], M.steel);
    if (phantom || compact) {
      profile(magazine, [[.007, -.052], [-.06, -.052], [-.078, -.214], [-.012, -.22]], .051, M.gun, .004);
      softBox(magazine, [0, -.22, -.044], [.059, .017, .076], M.dark, .003);
      box(magazine, [.027, -.144, -.044], [.004, .088, .014], detailed ? M.edge : M.dark);
    } else {
      profile(magazine, [[.014, -.052], [-.06, -.052], [-.066, -.114], [-.108, -.228], [-.079, -.252], [-.018, -.235], [.009, -.146]], .054, M.gun, .004);
      box(magazine, [.029, -.157, -.043], [.004, .109, .011], M.dark).rotation.x = -.18;
      box(magazine, [.030, -.158, -.064], [.004, .107, .008], detailed ? M.edge : M.dark).rotation.x = -.18;
      softBox(magazine, [0, -.242, -.069], [.061, .016, .077], M.dark, .003);
    }
    tube(group, [0, -.005, -.425], .014, .13, M.edge);
    if (phantom || compact) {
      tube(group, [0, -.005, -.55], compact ? .023 : .026, compact ? .19 : .22, M.gun);
      tube(group, [0, -.005, -.454], .028, .017, M.edge);
      tube(group, [0, -.005, phantom ? -.658 : -.642], .027, .009, M.edge);
    } else {
      tube(group, [0, -.005, -.510], .021, .073, M.dark);
      if (detailed) box(group, [.022, -.005, -.506], [.003, .014, .029], M.edge);
    }
    // A dark recessed bore makes the barrel read as a tube from oblique views.
    const boreZ = phantom ? -.665 : compact ? -.648 : -.548;
    tube(group, [0, -.005, boreZ], phantom || compact ? .013 : .010, .003, M.rubber);
    sights(.07, -.33, sightY);
    group.scale.z = stretch;
    rearGrip[2] *= stretch; frontGrip[2] *= stretch;
    muzzle = [0, -.005, phantom ? -.676 : compact ? -.654 : -.554];
  }
  const muzzleObject = new THREE.Object3D(); muzzleObject.name = 'Muzzle attachment'; muzzleObject.position.set(...muzzle); group.add(muzzleObject);
  return { group, magazine, bolt, slide, muzzle: muzzleObject, muzzlePoint: muzzle, sightY, rearGrip, frontGrip, magazineGrip, sidearm, knife };
}

/** Shared weapon silhouette. The muzzle is a child of group, including its SMG scale. */
export function createWeaponModel(THREE, { id = 'vandal', firstPerson = false, team = 'blue', detailed = true } = {}) {
  const kit = createKit(THREE, { firstPerson, team }), parent = new THREE.Group();
  const weapon = buildWeapon(kit, id, parent, detailed);
  if (firstPerson) for (const node of [weapon.group, weapon.magazine, weapon.bolt, weapon.slide]) kit.batchRigid(node);
  parent.add(weapon.group);
  return { ...weapon, parent, materials: [...kit.materials], geometries: [...kit.geometries],
    dispose() { parent.removeFromParent(); kit.dispose(); } };
}

/** Five floating blades share the existing knife surfaces. The caller owns those
 * geometries; this rig owns only its instance buffers and two brighter finishes. */
export function createKnifeFan(THREE, { weapon, firstPerson = false } = {}) {
  const group = new THREE.Group(); group.name = 'Blade storm / floating knives';
  const instances = [], ownedMaterials = new Map(), transform = new THREE.Object3D();
  const matrix = new THREE.Matrix4(), tint = new THREE.Color('#a2e7e0');
  const slots = Array.from({ length: 5 }, () => new THREE.Vector3());
  const target = new THREE.Vector3();
  for (const surface of weapon.group.children) {
    if (!surface.isMesh || surface.isInstancedMesh) continue;
    surface.updateMatrix();
    let material = surface.material;
    if (material.metalness >= .3) {
      if (!ownedMaterials.has(material)) {
        const finish = material.clone(); finish.name = 'Blade storm / sharpened edge';
        finish.color.lerp(tint, .32); finish.emissive.set('#66cdbf');
        finish.emissiveIntensity = firstPerson ? .32 : .22; finish.roughness = .36;
        ownedMaterials.set(material, finish);
      }
      material = ownedMaterials.get(material);
    }
    const object = new THREE.InstancedMesh(surface.geometry, material, 6);
    object.name = 'Blade storm / shared surface'; object.count = 0;
    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    object.castShadow = !firstPerson; object.receiveShadow = !firstPerson;
    object.frustumCulled = false; object.renderOrder = firstPerson ? 100 : 0;
    object.raycast = () => {}; group.add(object);
    instances.push({ object, surface: surface.matrix.clone() });
  }
  let initialized = false, disposed = false, flight = 0, sequence = null;
  let previousCount = 0, previousActive = false;
  const duration = .18;
  function write(index) {
    transform.updateMatrix();
    for (const item of instances) {
      matrix.multiplyMatrices(transform.matrix, item.surface); item.object.setMatrixAt(index, matrix);
    }
  }
  function update(dt, { active = false, count = 0, shotSequence, time = 0 } = {}) {
    if (disposed) return;
    dt = Math.min(.1, Math.max(0, Number(dt) || 0));
    count = Math.min(5, Math.max(0, Math.floor(Number(count) || 0)));
    const validSequence = Number.isFinite(shotSequence), changed = validSequence && shotSequence > 0 && shotSequence !== sequence;
    // The final miss can deactivate the kit before the next visual update.
    // Keep its outgoing blade visible, including a 1 -> 0 inactive transition.
    const finalShot = !active && count === 0 && previousCount === 1 && changed;
    const thrown = previousActive && (active && (changed || count < previousCount) || finalShot);
    if (thrown) flight = duration;
    else flight = Math.max(0, flight - dt);
    if (!active) { if (count > 0) flight = 0; initialized = false; }
    group.visible = Boolean(active || flight > 0);
    const blend = initialized ? 1 - Math.exp(-dt * 20) : 1;
    const scale = firstPerson ? .42 : .67;
    const floating = active ? count : 0;
    for (let i = 0; i < floating; i++) {
      const offset = i - (count - 1) / 2, x = offset * (firstPerson ? .175 : .205);
      target.set(x, (firstPerson ? .10 : 1.35) - Math.abs(offset) * .035,
        (firstPerson ? -.11 : .38) + Math.abs(offset) * .025);
      slots[i].lerp(target, blend); transform.position.copy(slots[i]);
      transform.position.y += Math.sin(time * 2.4 + i * 1.7) * (firstPerson ? .006 : .012);
      transform.rotation.set(firstPerson ? .12 : -.08, (firstPerson ? 0 : Math.PI) - x * .45, -x * .17);
      transform.scale.setScalar(scale); write(i);
    }
    if (flight > 0) {
      const progress = 1 - flight / duration, forward = firstPerson ? -1 : 1;
      transform.position.set(firstPerson ? .13 : -.22, firstPerson ? .035 : 1.25,
        (firstPerson ? -.18 : .48) + forward * progress * (firstPerson ? 2.8 : 4.2));
      transform.rotation.set(firstPerson ? .05 : -.04, firstPerson ? 0 : Math.PI, progress * .24);
      transform.scale.setScalar(scale * (1 - Math.max(0, progress - .65) * 1.9)); write(floating);
    }
    for (const item of instances) {
      item.object.count = floating + (flight > 0 ? 1 : 0);
      item.object.instanceMatrix.needsUpdate = true;
    }
    group.userData.bladeCount = active ? count : 0;
    group.userData.throwing = flight > 0;
    initialized = active; previousActive = active; previousCount = count;
    sequence = validSequence ? shotSequence : null;
    return thrown;
  }
  function dispose() {
    if (disposed) return; disposed = true; group.removeFromParent();
    for (const item of instances) item.object.dispose();
    for (const material of ownedMaterials.values()) material.dispose();
  }
  group.visible = false;
  return { group, update, dispose, materials: [...ownedMaterials.values()] };
}

/** Model-local animation; callers keep ownership of the root's world transform. */
export function createAgentModel(THREE, { bot = null, team = 'red', variant = 0, character = 'duelist' } = {}) {
  const kit = createKit(THREE, { bot, team }), { M, ball, box, softBox, tube, segment, placeSegment } = kit;
  const finishes = acquireAgentFinishes(THREE);
  M.fabric.map = finishes.cloth; M.glove.map = finishes.glove;
  M.armor.map = finishes.armor; M.armor.roughnessMap = finishes.armor;
  M.armor.bumpMap = finishes.armor; M.armor.bumpScale = .00045;
  M.glass.map = finishes.lens;
  const group = new THREE.Group(); group.name = `Tactical agent / ${team}`;
  const rig = new THREE.Group(), upper = new THREE.Group(); group.add(rig); rig.add(upper);
  const head = new THREE.Group(); head.position.set(0, 1.62, .012); upper.add(head);
  // An oval head and helmet shell retain the established headshot height.
  ball(head, [0, -.012, .015], [.133, .179, .129], M.skin, true);
  const helmet = kit.mesh(head, kit.keep(new THREE.SphereGeometry(.16, 14, 9, 0, Math.PI * 2, 0, Math.PI * .65)), M.armor, [0, .035, -.008], [1, 1.12, 1.02], true);
  softBox(head, [0, .075, .137], [.25, .027, .055], M.armor, .008, true);
  softBox(head, [0, .133, .108], [.044, .025, .014], M.edge, .004, true);
  ball(head, [0, -.069, .035], [.117, .081, .107], M.fabric, true);
  const mask = kit.plate(head, [[-.12, -.007], [-.105, -.073], [-.053, -.122], [.053, -.122], [.105, -.073], [.12, -.007]], .039, M.dark, true);
  mask.position.set(0, -.005, .137);
  for (const x of [-.045, 0, .045]) softBox(head, [x, -.064, .16], [.021, .004, .004], M.edge, .001, true);
  ball(head, [0, .024, .127], [.137, .048, .041], M.dark, true);
  softBox(head, [-.064, .025, .156], [.105, .048, .023], M.glass, .009, true).rotation.y = -.12;
  softBox(head, [.064, .025, .156], [.105, .048, .023], M.glass, .009, true).rotation.y = .12;
  softBox(head, [0, .020, .17], [.018, .034, .015], M.edge, .003, true);
  softBox(head, [-.065, .036, .173], [.055, .004, .003], M.signal, .001, true);
  softBox(head, [.065, .036, .173], [.055, .004, .003], M.signal, .001, true);
  tube(head, [-.151, -.002, -.005], .056, .026, M.dark, 'x', true);
  tube(head, [.151, -.002, -.005], .056, .026, M.dark, 'x', true);
  softBox(head, [-.126, -.07, .087], [.022, .015, .078], M.edge, .004, true).rotation.y = -.45;
  tube(upper, [0, 1.414, 0], .078, .13, M.fabric, 'y');
  tube(upper, [0, 1.405, -.013], .105, .08, M.dark, 'y');
  // A tapered, elliptical torso avoids a box-shaped shoulder/waist silhouette.
  const torsoPoints = [[.151, -.26], [.178, -.19], [.215, .035], [.221, .155], [.188, .235], [.108, .28]];
  kit.mesh(upper, kit.keep(new THREE.LatheGeometry(torsoPoints.map(([r, y]) => new THREE.Vector2(r, y)), 14)), M.fabric, [0, 1.105, 0], [1.12, 1, .76]);
  const chest = kit.plate(upper, [[-.151, -.15], [.151, -.15], [.188, .065], [.126, .155], [-.126, .155], [-.188, .065]], .073, M.armor);
  chest.position.set(0, 1.17, .151);
  const back = kit.plate(upper, [[-.15, -.15], [.15, -.15], [.18, .09], [.112, .145], [-.112, .145], [-.18, .09]], .072, M.armor);
  back.position.set(0, 1.15, -.162);
  for (const side of [-1, 1]) {
    softBox(upper, [side * .155, 1.225, .187], [.039, .25, .025], M.seam, .005).rotation.z = side * -.10;
    softBox(upper, [side * .081, 1.064, .204], [.069, .135, .046], M.dark, .009);
    softBox(upper, [side * .081, 1.112, .231], [.056, .025, .012], M.seam, .003);
    softBox(upper, [side * .201, .936, .025], [.073, .135, .132], M.fabric, .012);
    softBox(upper, [side * .215, .966, .081], [.042, .022, .018], M.seam, .004);
    softBox(upper, [side * .201, 1.13, -.012], [.038, .075, .26], M.dark, .007);
    softBox(upper, [side * .106, 1.345, .117], [.092, .064, .080], M.fabric, .014).rotation.z = side * .16;
  }
  softBox(upper, [.028, 1.24, .196], [.092, .041, .008], M.dark, .003);
  softBox(upper, [.028, 1.241, .203], [.056, .008, .004], M.signal, .001);
  for (const y of [1.16, 1.18]) softBox(upper, [0, y, .193], [.20, .008, .011], M.dark, .002);
  softBox(upper, [0, 1.02, -.18], [.21, .19, .062], M.dark, .012);
  ball(upper, [0, .811, -.01], [.185, .111, .139], M.fabric);
  softBox(upper, [0, .87, 0], [.38, .054, .273], M.rubber, .012);
  softBox(upper, [0, .867, .145], [.071, .046, .016], M.edge, .004);
  // Upper arm, forearm and hand are posed from their actual joints each frame.
  function hand(parent) {
    const root = new THREE.Group(); parent.add(root);
    ball(root, [0, 0, 0], [.043, .044, .063], M.glove);
    softBox(root, [0, .026, -.008], [.063, .025, .061], M.seam, .007);
    for (let i = 0; i < 3; i++) ball(root, [-.025 + i * .025, -.025, .027], [.014, .018, .029], M.glove);
    ball(root, [.039, -.001, .019], [.019, .026, .031], M.glove);
    return root;
  }
  function arm(side) {
    const root = new THREE.Group(); root.name = side < 0 ? 'Right arm' : 'Support arm'; rig.add(root);
    const upperArm = segment(root, .083, M.fabric), forearm = segment(root, .065, M.fabric);
    const elbow = ball(root, [0, 0, 0], [.075, .073, .073], M.dark);
    const shoulder = kit.plate(root, [[-.074, -.072], [.06, -.078], [.098, -.014], [.071, .075], [-.034, .096], [-.088, .044]], .188, M.armor, false, false, .010);
    const guard = softBox(root, [0, 0, 0], [.088, .132, .054], M.armor, .012);
    const palm = hand(root);
    return { root, upperArm, forearm, elbow, shoulder, guard, palm };
  }
  const rightArm = arm(-1), leftArm = arm(1);
  function leg(side) {
    const root = new THREE.Group(); rig.add(root);
    const thigh = segment(root, .101, M.fabric), shin = segment(root, .079, M.fabric);
    const knee = ball(root, [0, 0, 0], [.085, .078, .081], M.dark);
    const plate = kit.plate(root, [[-.043, -.074], [.043, -.074], [.067, -.027], [.060, .044], [.029, .077], [-.038, .077], [-.066, .026]], .051, M.armor, false, false, .006);
    const boot = new THREE.Group(); root.add(boot);
    ball(boot, [0, -.055, .037], [.084, .081, .144], M.rubber);
    softBox(boot, [0, -.104, .033], [.164, .032, .274], M.rubber, .016);
    ball(boot, [0, .009, -.018], [.079, .085, .082], M.fabric);
    for (let i = 0; i < 3; i++) softBox(boot, [0, -.003 + i * .023, .062 - i * .007], [.078, .008, .009], M.seam, .002);
    return { root, thigh, shin, knee, plate, boot, side };
  }
  const leftLeg = leg(-1), rightLeg = leg(1);
  const weaponPivot = new THREE.Group(); weaponPivot.position.set(-.19, 1.355, .345); upper.add(weaponPivot);
  const defaultWeapon = variant % 2 ? 'phantom' : 'vandal';
  let weapon = buildWeapon(kit, defaultWeapon, weaponPivot, false);
  weapon.group.rotation.y = Math.PI;
  const weapons = new Map([[defaultWeapon, weapon]]), ownedMaterials = [...kit.materials];
  let knifeFan = null, ultimate = false, throwClock = 0;
  function selectWeapon(id = defaultWeapon) {
    if (!['classic', 'ghost', 'spectre', 'vandal', 'phantom', 'knife', 'spike'].includes(id)) id = defaultWeapon;
    if (id === 'spike') id = 'knife';
    if (!weapons.has(id)) {
      const next = buildWeapon(kit, id, weaponPivot, false); next.group.rotation.y = Math.PI;
      for (const node of [next.group, next.magazine, next.bolt, next.slide]) kit.batchRigid(node);
      // Raycaster visits invisible children too. Stowed equipment must never
      // enlarge a character's live hit area when its model is cached.
      next.group.traverse(object => { if (object.isMesh) object.raycast = function(ray, hits) {
        let parent = this; while (parent && parent !== group) { if (!parent.visible) return; parent = parent.parent; }
        THREE.Mesh.prototype.raycast.call(this, ray, hits);
      }; });
      weapons.set(id, next);
    }
    weapon = weapons.get(id);
    for (const item of weapons.values()) item.group.visible = item === weapon && !ultimate;
    if (muzzle.parent !== weapon.muzzle) weapon.muzzle.add(muzzle);
  }
  const muzzle = kit.mesh(weapon.muzzle, kit.keep(new THREE.OctahedronGeometry(.046)), M.signal, [0, 0, 0], [.7, .7, 1.7], false, false);
  muzzle.visible = false;
  const ringMaterial = new THREE.MeshBasicMaterial({ color: team === 'red' ? '#d77e78' : '#8dceb9',
    side: THREE.DoubleSide, transparent: true, opacity: .33, depthWrite: false }); kit.materials.add(ringMaterial);
  ownedMaterials.push(ringMaterial);
  const ring = kit.mesh(group, kit.keep(new THREE.RingGeometry(.35, .365, 32)), ringMaterial, [0, .018, 0], [1, 1, 1], false, false); ring.rotation.x = -Math.PI / 2;
  for (const node of [head, upper, weapon.group, weapon.magazine, weapon.bolt, weapon.slide,
    rightArm.palm, leftArm.palm, leftLeg.boot, rightLeg.boot]) kit.batchRigid(node);
  weapon.group.traverse(object => { if (object.isMesh && object !== muzzle) object.raycast = function(ray, hits) {
    let parent = this; while (parent && parent !== group) { if (!parent.visible) return; parent = parent.parent; }
    THREE.Mesh.prototype.raycast.call(this, ray, hits);
  }; });
  // Role equipment is cosmetic: the original body, head and weapon remain the
  // complete hit surface. Static colored parts merge to one draw per attachment.
  const bodyDrawables=[];
  const rememberBody=object=>{if(object===weaponPivot)return;if(object.isMesh)bodyDrawables.push(object);for(const child of object.children)rememberBody(child);};
  rememberBody(rig);
  const enemyRim=createEnemyRim();enemyRim.register(bodyDrawables);
  let sunflowerAvatar=null,starMascotAvatar=null,solderAvatar=null,iagnuAvatar=null,onoAvatar=null,grassBlockAvatar=null,nopeAvatar=null,duckAvatar=null,catAvatar=null,carAvatar=null,nobiAvatar=null,japanAvatar=null,capAvatar=null,urchinAvatar=null;
  const characterGear = new Map();
  let activeCharacter = 'duelist', gearMaterial = null;
  function equipment(parent, id, label, build) {
    const parts = [], transform = new THREE.Object3D();
    const part = (geometry, color, position, rotation = [0, 0, 0]) => {
      transform.position.set(...position); transform.rotation.set(...rotation); transform.scale.set(1, 1, 1); transform.updateMatrix();
      const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      copy.applyMatrix4(transform.matrix); parts.push({ geometry: copy, color: new THREE.Color(color) }); geometry.dispose();
    };
    const block = (p, s, color, bevel = .004, rotation) => {
      const [w, h, d] = s, b = Math.min(bevel, w / 4, h / 4, d / 4), shape = new THREE.Shape();
      const points = [[-w/2+b,-h/2],[w/2-b,-h/2],[w/2,-h/2+b],[w/2,h/2-b],[w/2-b,h/2],[-w/2+b,h/2],[-w/2,h/2-b],[-w/2,-h/2+b]];
      points.forEach(([x,y],i) => i ? shape.lineTo(x,y) : shape.moveTo(x,y)); shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.001,d-b), bevelEnabled:b>0, bevelSize:b/2, bevelThickness:b/2, bevelSegments:1, steps:1 });
      geometry.translate(0,0,-d/2+b/2); part(geometry,color,p,rotation);
    };
    const rod = (a, b, radius, color) => {
      const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
      const geometry = new THREE.CylinderGeometry(radius,radius,delta.length(),8,1);
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
      part(geometry,color,from.add(to).multiplyScalar(.5).toArray());
    };
    const disc = (p, radius, depth, color, rotation = [0,0,Math.PI/2]) => part(new THREE.CylinderGeometry(radius,radius,depth,12,1),color,p,rotation);
    const panel = (p, points, depth, color, bevel = .002) => {
      const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
      const geometry=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.001,depth-bevel),bevelEnabled:bevel>0,bevelSize:bevel/2,bevelThickness:bevel/2,bevelSegments:1,steps:1});
      geometry.translate(0,0,-depth/2+bevel/2);part(geometry,color,p);
    };
    build({block,rod,disc,panel});
    const positions=[],normals=[],uvs=[],colors=[];
    for (const item of parts) {
      const position=item.geometry.getAttribute('position'),normal=item.geometry.getAttribute('normal'),uv=item.geometry.getAttribute('uv');
      for(let i=0;i<position.count;i++){
        positions.push(position.getX(i),position.getY(i),position.getZ(i)); normals.push(normal.getX(i),normal.getY(i),normal.getZ(i));
        uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);colors.push(item.color.r,item.color.g,item.color.b);
      }
      item.geometry.dispose();
    }
    const geometry=kit.keep(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    if(!gearMaterial){
      gearMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.68,metalness:.18,bumpMap:finishes.cloth,bumpScale:.00035});
      gearMaterial.name='Character equipment / shared finish';kit.materials.add(gearMaterial);ownedMaterials.push(gearMaterial);
    }
    const object=new THREE.Mesh(geometry,gearMaterial);object.name=`Character gear / ${id} / ${label}`;
    object.userData.character=id;object.userData.solid=false;object.raycast=()=>{};object.castShadow=true;object.receiveShadow=true;parent.add(object);
    enemyRim.register(object);
    return object;
  }
  function selectCharacter(id) {
    if(id!=='duelist'&&id!=='nope'&&id!=='mend'&&id!=='echo'&&id!=='veil'&&id!=='ember'&&id!=='frost'&&id!=='duck'&&id!=='cat'&&id!=='car'&&id!=='nobi'&&id!=='japan'&&id!=='cap'&&id!=='urchin')id='duelist';
    if(id===activeCharacter&&group.userData.character===id)return;
    if(id!=='duelist'&&id!=='nope'&&id!=='mend'&&id!=='ember'&&id!=='echo'&&id!=='frost'&&id!=='veil'&&id!=='duck'&&id!=='cat'&&id!=='car'&&id!=='nobi'&&id!=='japan'&&id!=='cap'&&id!=='urchin'&&!characterGear.has(id)){
      const pieces=[];
      if(id==='nope')pieces.push(equipment(upper,id,'chest badge',({block})=>{
        block([-.085,1.257,.197],[.067,.058,.012],'#293842',.006);
        block([-.085,1.257,.205],[.050,.042,.004],'#b96e97',.003);
        block([-.099,1.257,.210],[.006,.027,.002],'#f2cedd',.001);
        block([-.071,1.257,.210],[.006,.027,.002],'#f2cedd',.001);
        block([-.085,1.257,.210],[.006,.034,.002],'#f2cedd',.001,[0,0,.77]);
      }));
      if(id==='mend')pieces.push(equipment(upper,id,'medical carrier',({block,rod})=>{
        for(const side of [-1,1]){
          block([side*.148,1.247,.204],[.041,.128,.018],'#dde4df',.004,[0,0,-side*.1]);
          block([side*.148,1.285,.216],[.025,.016,.006],'#83999b',.002);
        }
        block([-.059,1.257,.200],[.058,.059,.014],'#e6ebe4',.005);
        block([-.059,1.257,.210],[.033,.009,.006],'#429b96',.001);
        block([-.059,1.257,.210],[.009,.033,.006],'#429b96',.001);
        block([.239,1.005,.012],[.097,.171,.117],'#d7ded6',.010);
        block([.239,1.064,.079],[.082,.038,.019],'#afc2be',.004);
        block([.239,.985,.074],[.076,.055,.012],'#c7d5d0',.004);
        block([.239,.985,.083],[.035,.010,.004],'#338b86',.001);
        block([.239,.985,.083],[.010,.035,.004],'#338b86',.001);
        for(const x of [.216,.262])block([x,1.037,.085],[.012,.027,.008],'#60797b',.002);
        rod([.208,1.094,.010],[.270,1.094,.010],.006,'#526c72');
        block([0,1.027,-.226],[.142,.146,.035],'#c9d4cd',.007);
        block([0,1.027,-.248],[.028,.098,.008],'#6c9893',.002);
        block([0,1.027,-.254],[.070,.022,.004],'#5caaa1',.001);
      }));
      if(id==='echo'){
        pieces.push(equipment(upper,id,'sensor pack',({block,rod,disc})=>{
          block([.055,1.268,.203],[.072,.083,.019],'#343d59',.006,[0,0,-.08]);
          block([.055,1.271,.217],[.052,.050,.009],'#617ba0',.003,[0,0,-.08]);
          block([.055,1.280,.223],[.034,.003,.003],'#adc6d9',.001,[0,0,-.08]);
          block([.052,1.265,.223],[.024,.003,.003],'#ad9cce',.001,[0,0,-.08]);
          block([.045,1.171,-.221],[.174,.194,.053],'#424660',.007);
          block([.045,1.184,-.253],[.132,.106,.014],'#606984',.004);
          for(const x of [.002,.026,.050])block([x,1.192,-.263],[.010,.058,.005],'#252f44',.001);
          block([.108,1.255,-.240],[.033,.052,.033],'#8f8bb1',.004);
          rod([.108,1.278,-.240],[.108,1.565,-.245],.0045,'#7d8b9d');
          disc([.108,1.566,-.245],.009,.014,'#9a9cbb',[0,0,0]);
          rod([-.035,1.245,-.255],[-.150,1.296,-.136],.006,'#617185');
        }));
        pieces.push(equipment(head,id,'sensor headset',({block,rod,disc})=>{
          for(const side of [-1,1]){
            disc([side*.174,.002,-.006],.042,.025,'#45516b');
            disc([side*.189,.002,-.006],.029,.008,'#8983a9');
            block([side*.190,.014,.012],[.012,.013,.026],'#87a9bc',.003);
          }
          rod([.173,-.017,.015],[.137,-.086,.135],.006,'#586879');
          block([.132,-.088,.146],[.026,.016,.029],'#69799a',.003);
          rod([-.170,.024,-.018],[-.115,.137,-.054],.006,'#68778e');
        }));
      }
      if(id==='veil'){
        pieces.push(equipment(upper,id,'smoke carrier',({block,disc,panel})=>{
          // The divided cowl leaves the team-colored chest plate readable.
          for(const side of [-1,1]){
            const contour=[[-.215,-.05],[-.204,.10],[-.094,.165],[-.055,.103],[-.125,.04],[-.179,-.103]];
            panel([0,1.24,.201],contour.map(([x,y])=>[x*side,y]),.018,'#555b78',.003);
            block([side*.147,1.346,.215],[.069,.011,.007],'#798097',.002,[0,0,-side*.37]);
            block([side*.092,1.350,.218],[.029,.018,.012],'#aa9466',.003);
            // Short, paired canisters sit on the existing utility belt, with
            // separate retaining caps, collar bands and front identifier tabs.
            block([side*.238,1.011,.095],[.063,.154,.022],'#38475c',.005);
            disc([side*.238,1.015,.132],.035,.180,'#4b5370',[0,0,0]);
            disc([side*.238,1.112,.132],.041,.018,'#7f8b96',[0,0,0]);
            disc([side*.238,.918,.132],.038,.014,'#343e52',[0,0,0]);
            disc([side*.238,1.060,.132],.036,.013,'#b19a67',[0,0,0]);
            block([side*.238,1.006,.169],[.018,.043,.005],'#8e97a5',.002);
            block([side*.238,1.010,.173],[.008,.022,.003],'#c5af7b',.001);
          }
          panel([0,1.24,-.208],[[-.205,.095],[-.09,.17],[.09,.17],[.205,.095],[.177,-.11],[.08,-.145],[0,-.105],[-.08,-.145],[-.177,-.11]],.020,'#505771',.003);
          block([0,1.352,-.222],[.095,.026,.009],'#7a8298',.003);
          block([0,1.352,-.229],[.029,.012,.005],'#b19a67',.002);
        }));
        pieces.push(equipment(head,id,'smoked visor',({block,disc,panel})=>{
          panel([0,.025,.181],[[-.13,-.034],[-.143,.002],[-.116,.053],[.115,.053],[.142,.002],[.13,-.034],[.044,-.044],[-.044,-.044]],.016,'#333b53',.002);
          panel([0,.025,.193],[[-.117,-.020],[-.126,.006],[-.103,.033],[.102,.033],[.125,.006],[.116,-.020]],.004,'#4d5979',.001);
          block([-.044,.043,.197],[.078,.004,.002],'#8192aa',.001,[0,0,-.08]);
          block([-.094,.009,.197],[.014,.004,.003],'#bba36d',.001);
          for(const side of [-1,1]){
            block([side*.130,.025,.183],[.013,.036,.020],'#89909d',.003);
            disc([side*.086,-.083,.172],.021,.017,'#4c5670',[Math.PI/2,0,0]);
            disc([side*.086,-.083,.184],.013,.008,'#a89267',[Math.PI/2,0,0]);
          }
        }));
      }
      if(id==='ember'){
        pieces.push(equipment(upper,id,'heat shield and fuel rig',({block,disc,panel,rod})=>{
          // Raised, angular heat shields contrast with VEIL's folded cloth.
          // Their open center keeps the original team chest armor unobscured.
          for(const side of [-1,1]){
            panel([0,1.258,.202],[[-.213,.026],[-.194,.127],[-.083,.174],[-.069,.126],[-.137,.073],[-.166,-.052]].map(([x,y])=>[x*side,y]),.024,'#ae774f',.003);
            block([side*.142,1.390,.219],[.082,.011,.009],'#d1b685',.002,[0,0,-side*.40]);
            block([side*.174,1.306,.221],[.030,.031,.010],'#687680',.003);
          }
          panel([0,1.272,-.214],[[-.197,.061],[-.104,.153],[0,.171],[.104,.153],[.197,.061],[.155,-.070],[-.155,-.070]],.028,'#8e644b',.003);
          block([-.102,1.175,-.235],[.105,.216,.031],'#3b454f',.005);
          disc([-.102,1.177,-.279],.044,.213,'#a46c44',[0,0,0]);
          disc([-.102,1.294,-.279],.050,.019,'#a8a396',[0,0,0]);
          disc([-.102,1.060,-.279],.048,.018,'#4a4d50',[0,0,0]);
          for(const y of[1.116,1.237])disc([-.102,y,-.279],.045,.014,'#5e6060',[0,0,0]);
          block([-.102,1.176,-.326],[.023,.074,.007],'#d2b075',.002);
          rod([-.079,1.306,-.279],[-.163,1.396,-.150],.007,'#667076');
          rod([-.163,1.396,-.150],[-.164,1.412,.021],.007,'#667076');
          rod([-.164,1.412,.021],[-.142,1.365,.154],.007,'#667076');
          block([.090,1.186,-.240],[.096,.155,.042],'#3f4b56',.005);
          for(const y of[1.143,1.176,1.209])block([.090,y,-.266],[.080,.011,.011],'#839093',.002);
          block([.246,1.015,.108],[.073,.135,.058],'#a97850',.007);
          block([.246,1.027,.142],[.049,.067,.009],'#404d59',.003);
          block([.246,1.043,.150],[.016,.014,.006],'#d9b47e',.002);
        }));
        pieces.push(equipment(head,id,'compact heat visor',({block,disc,panel})=>{
          panel([0,.031,.179],[[-.135,-.012],[-.139,.021],[-.109,.052],[.109,.052],[.139,.021],[.135,-.012]],.017,'#835d45',.002);
          panel([0,.026,.192],[[-.117,-.012],[-.122,.012],[-.099,.029],[.099,.029],[.122,.012],[.117,-.012]],.005,'#8f714f',.001);
          block([-.035,.043,.197],[.077,.004,.002],'#d4ba8b',.001,[0,0,-.055]);
          for(const side of[-1,1]){
            block([side*.129,.029,.180],[.013,.029,.021],'#929892',.003);
            block([side*.048,-.064,.174],[.023,.006,.008],'#a1a493',.001);
          }
          disc([-.174,-.003,.001],.032,.019,'#59636b');
          disc([-.187,-.003,.001],.023,.007,'#bd8954');
          block([0,-.051,.174],[.035,.022,.018],'#656e72',.003);
        }));
      }
      if(id==='frost'){
        pieces.push(equipment(upper,id,'insulated coolant carrier',({block,panel,rod})=>{
          // Separate soft collar segments and three cells read as insulation
          // and coolant equipment instead of a second set of body armor.
          for(let i=-2;i<=2;i++){
            const angle=i*.47;block([Math.sin(angle)*.119,1.405,Math.cos(angle)*.121],[.063,.053,.043],'#b8cbc5',.007,[0,angle,0]);
          }
          for(const side of[-1,1]){
            block([side*.075,1.405,-.087],[.106,.051,.041],'#90a9ac',.006,[0,-side*.55,0]);
            panel([0,1.269,.203],[[-.203,.051],[-.176,.120],[-.108,.149],[-.084,.102],[-.126,.039],[-.152,-.065],[-.194,-.040]].map(([x,y])=>[x*side,y]),.021,'#9bb7b6',.004);
            block([side*.151,1.342,.219],[.054,.010,.008],'#c9ddd5',.002,[0,0,-side*.36]);
          }
          block([0,1.180,-.236],[.224,.235,.049],'#485c6b',.008);
          for(const x of[-.070,0,.070]){
            block([x,1.181,-.275],[.055,.171,.038],'#a3c4c0',.006);
            for(const y of[1.091,1.271])block([x,y,-.277],[.057,.018,.043],'#708f97',.003);
            block([x,1.190,-.298],[.020,.078,.005],'#c1ded5',.002);
          }
          for(const y of[1.121,1.242])block([0,y,-.307],[.221,.016,.013],'#536d79',.003);
          rod([.113,1.280,-.251],[.163,1.389,-.126],.006,'#829b9f');
          rod([.163,1.389,-.126],[.139,1.387,.100],.006,'#829b9f');
          block([-.242,1.005,.112],[.069,.143,.066],'#bdd6cd',.008);
          block([-.242,1.010,.151],[.025,.078,.008],'#6a9e9c',.003);
          block([-.242,1.052,.155],[.037,.012,.006],'#d5e4d9',.002);
        }));
        pieces.push(equipment(head,id,'cold weather visor',({block,disc,panel})=>{
          panel([0,.025,.180],[[-.128,-.025],[-.142,.003],[-.114,.046],[.114,.046],[.142,.003],[.128,-.025]],.017,'#718e98',.003);
          panel([0,.026,.193],[[-.114,-.014],[-.123,.005],[-.103,.028],[.103,.028],[.123,.005],[.114,-.014]],.004,'#526f80',.001);
          block([-.035,.042,.197],[.077,.004,.003],'#b8d4d2',.001,[0,0,-.06]);
          for(const side of[-1,1]){
            disc([side*.173,.001,-.011],.040,.022,'#a3bebb');
            disc([side*.187,.001,-.011],.024,.009,'#536d7b');
            block([side*.119,-.066,.136],[.026,.052,.035],'#adcbc4',.005,[0,side*.23,side*-.18]);
          }
          block([0,-.052,.177],[.034,.015,.010],'#8ba7aa',.003);
        }));
      }
      characterGear.set(id,pieces);
    }
    if(id==='mend'&&!sunflowerAvatar){sunflowerAvatar=createSunflowerAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(sunflowerAvatar.group);}
    if(id==='duelist'&&!starMascotAvatar){starMascotAvatar=createStarMascotAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(starMascotAvatar.group);}
    if(id==='ember'&&!solderAvatar){solderAvatar=createSolderAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(solderAvatar.group);}
    if(id==='echo'&&!iagnuAvatar){iagnuAvatar=createIagnuAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(iagnuAvatar.group);}
    if(id==='frost'&&!onoAvatar){onoAvatar=createOnoAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(onoAvatar.group);}
    if(id==='veil'&&!grassBlockAvatar){grassBlockAvatar=createGrassBlockAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(grassBlockAvatar.group);}
    if(id==='nope'&&!nopeAvatar){nopeAvatar=createNopeAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(nopeAvatar.group);}
    if(id==='urchin'&&!urchinAvatar){urchinAvatar=createUrchinAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(urchinAvatar.group);}
    if(id==='cap'&&!capAvatar){capAvatar=createCapAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(capAvatar.group);}
    if(id==='japan'&&!japanAvatar){japanAvatar=createJapanAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(japanAvatar.group);}
    if(id==='nobi'&&!nobiAvatar){nobiAvatar=createNobiAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(nobiAvatar.group);}
    if(id==='car'&&!carAvatar){carAvatar=createCarAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(carAvatar.group);}
    if(id==='cat'&&!catAvatar){catAvatar=createCatAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(catAvatar.group);}
    if(id==='duck'&&!duckAvatar){duckAvatar=createDuckAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team});enemyRim.register(duckAvatar.group);}
    for(const object of bodyDrawables)object.visible=id!=='nope'&&id!=='mend'&&id!=='duelist'&&id!=='ember'&&id!=='echo'&&id!=='frost'&&id!=='veil'&&id!=='duck'&&id!=='cat'&&id!=='car'&&id!=='nobi'&&id!=='japan'&&id!=='cap'&&id!=='urchin';
    sunflowerAvatar?.setVisible(id==='mend');
    starMascotAvatar?.setVisible(id==='duelist');
    solderAvatar?.setVisible(id==='ember');
    iagnuAvatar?.setVisible(id==='echo');
    onoAvatar?.setVisible(id==='frost');
    grassBlockAvatar?.setVisible(id==='veil');
    urchinAvatar?.setVisible(id==='urchin');capAvatar?.setVisible(id==='cap');japanAvatar?.setVisible(id==='japan');nobiAvatar?.setVisible(id==='nobi');carAvatar?.setVisible(id==='car');
    catAvatar?.setVisible(id==='cat');
    duckAvatar?.setVisible(id==='duck');
    nopeAvatar?.setVisible(id==='nope');
    for(const [key,pieces] of characterGear)for(const object of pieces)object.visible=key===id;
    activeCharacter=id;group.userData.character=id;
  }
  // Reuse temporary vectors: the nine animated agents do not allocate per frame.
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), target = new THREE.Vector3();
  const hip = new THREE.Vector3(), ankle = new THREE.Vector3(), kneePoint = new THREE.Vector3();
  let moveBlend = 0, interactBlend = 0, fireKick = 0, flashTimer = 0, wasFiring = false, lastShotSequence = null, deathTime = 0, disposed = false;
  function poseArm(part, side, drop, interaction) {
    const isRight = side < 0;
    a.set(side * .263, 1.325 + drop, .004);
    b.set(isRight ? -.285 : .12, (isRight ? 1.055 : 1.065) + drop, isRight ? -.014 : .255);
    // The same grip attachments drive the weapon and hands, including recoil.
    c.set(...(isRight ? weapon.rearGrip : weapon.frontGrip));
    c.applyMatrix4(weapon.group.matrix).applyMatrix4(weaponPivot.matrix).applyMatrix4(upper.matrix);
    if (ultimate) {
      const flick = Math.sin(Math.min(1, throwClock / .20) * Math.PI);
      b.set(side * .25, 1.09 + drop, .16);
      c.set(side * .235, 1.20 + drop + (isRight ? flick * .055 : 0), .38 + (isRight ? flick * .20 : 0));
    } else if (weapon.knife && !isRight) c.set(.18, 1.13 + drop, .18);
    if (interaction > 0) {
      b.lerp(target.set(side * .20, .95 + drop, .15), interaction);
      c.lerp(target.set(side * .085, .88 + drop, .365), interaction);
    }

    part.shoulder.position.copy(a); part.shoulder.rotation.z = side * -.2;
    placeSegment(part.upperArm, a, b); placeSegment(part.forearm, b, c);
    part.elbow.position.copy(b);
    part.guard.position.copy(b).lerp(c, .62); part.guard.position.z -= .025;
    part.guard.quaternion.copy(part.forearm.quaternion);
    part.palm.position.copy(c); part.palm.rotation.set(-.25 + interaction * .5, isRight ? -.18 : .55, isRight ? -.22 : .7);
    if (ultimate) part.palm.rotation.set(-.3, side * -.35, side * .65);
  }
  function poseLeg(part, stride, lift, drop) {
    hip.set(part.side * .118, .80 + drop, 0);
    ankle.set(part.side * .127, .139 + lift, stride);
    // A two-link knee points forward while the planted sole remains on the floor.
    a.subVectors(ankle, hip); const distance = Math.min(.668, Math.max(.06, a.length())); a.normalize();
    const upperLength = .35, lowerLength = .32;
    const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
    const bend = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
    b.set(0, 0, 1).addScaledVector(a, -a.z).normalize();
    kneePoint.copy(hip).addScaledVector(a, along).addScaledVector(b, bend);
    placeSegment(part.thigh, hip, kneePoint); placeSegment(part.shin, kneePoint, ankle);
    part.knee.position.copy(kneePoint); part.plate.position.copy(kneePoint); part.plate.position.z += .075;
    part.plate.rotation.x = -.10 + Math.max(0, stride) * .3;
    part.boot.position.copy(ankle); part.boot.rotation.x = -stride * .6;
  }
  function update(dt, state = {}) {
    if (disposed) return;
    if(state.enemyRim!==undefined)enemyRim.setEnabled(state.enemyRim);
    if(state.character!==undefined)selectCharacter(state.character);
    dt = Math.min(.1, Math.max(0, Number(dt) || 0));
    const time = Number(state.time) || 0, smooth = 1 - Math.exp(-dt * 10);
    moveBlend += ((state.moving ? 1 : 0) - moveBlend) * smooth;
    const interacting = state.planting || state.defusing;
    interactBlend += ((interacting ? 1 : 0) - interactBlend) * smooth;
    ultimate = Boolean(state.ultimate) && state.alive !== false;
    selectWeapon(ultimate ? 'knife' : state.weapon || defaultWeapon);
    if (ultimate && !knifeFan) {
      knifeFan = createKnifeFan(THREE, { weapon }); upper.add(knifeFan.group);
      ownedMaterials.push(...knifeFan.materials);
    }
    const thrown = knifeFan?.update(dt, { active: ultimate && !interacting, count: state.knives,
      shotSequence: state.shotSequence, time });
    throwClock = thrown ? .20 : Math.max(0, throwClock - dt);
    if (knifeFan) {
      if (!weapon.knife || state.alive === false) knifeFan.group.visible = false;
      else if (knifeFan.group.userData.throwing) { ultimate = true; weapon.group.visible = false; }
    }
    // Short snapshot flash flags can be missed between network frames. A new
    // sequence supplies one local impulse; first sync and round resets do not.
    const hasSequence = Number.isFinite(state.shotSequence) && state.shotSequence >= 0;
    const newShot = hasSequence && lastShotSequence !== null && state.shotSequence > lastShotSequence;
    if (hasSequence) lastShotSequence = state.shotSequence;
    const firing = Boolean(state.firing) && state.alive !== false && !weapon.knife;
    flashTimer = Math.max(0, flashTimer - dt);
    if (state.alive !== false && !weapon.knife && (newShot || firing && !wasFiring)) {
      fireKick = 1; flashTimer = .06;
    }
    if (weapon.knife || state.alive === false) flashTimer = 0;
    wasFiring = firing; fireKick *= Math.exp(-dt * 18);
    const gait = time * 10 + variant * 1.7, cycle = Math.sin(gait);
    const drop = -interactBlend * .19 + Math.cos(gait * 2) * .012 * moveBlend;
    upper.position.y = drop;
    upper.rotation.z = cycle * .016 * moveBlend;
    head.rotation.x = .04 + interactBlend * .27;
    head.rotation.y = Math.sin(time * .6 + variant) * .028 * (1 - moveBlend) * (1 - interactBlend);
    weaponPivot.position.y = (weapon.knife ? 1.20 : 1.355) - interactBlend * .24 + fireKick * .012;
    weaponPivot.position.z = (weapon.knife ? .28 : .345) - interactBlend * .11 - fireKick * .014;
    weaponPivot.rotation.set(interactBlend * .75 - fireKick * .055, 0, -interactBlend * .12);
    upper.updateMatrix(); weaponPivot.updateMatrix(); weapon.group.updateMatrix();
    muzzle.visible = (firing || flashTimer > 0) && state.alive !== false && !weapon.knife;
    muzzle.rotation.z = time * 39;
    poseArm(rightArm, -1, drop, interactBlend); poseArm(leftArm, 1, drop, interactBlend);
    poseLeg(leftLeg, cycle * .18 * moveBlend, Math.max(0, Math.cos(gait)) * .075 * moveBlend, drop);
    poseLeg(rightLeg, -cycle * .18 * moveBlend, Math.max(0, -Math.cos(gait)) * .075 * moveBlend, drop);
    if (state.alive === false) {
      deathTime = Math.min(1, deathTime + dt / .7);
      const fall = deathTime * deathTime * (3 - 2 * deathTime);
      rig.rotation.x = fall * 1.49; rig.rotation.z = fall * (variant % 2 ? -.28 : .28);
      rig.position.y = fall * .03; ring.visible = false; muzzle.visible = false;
      weaponPivot.rotation.z += fall * .9;
    } else { deathTime = 0; rig.rotation.set(0, 0, 0); rig.position.y = 0; ring.visible = true; }
    if(activeCharacter==='mend')sunflowerAvatar.update(interactBlend);
    if(activeCharacter==='duelist')starMascotAvatar.update();
    if(activeCharacter==='ember')solderAvatar.update();
    if(activeCharacter==='echo')iagnuAvatar.update();
    if(activeCharacter==='frost')onoAvatar.update(interactBlend);
    if(activeCharacter==='veil')grassBlockAvatar.update();
    if(activeCharacter==='urchin')urchinAvatar.update();
    if(activeCharacter==='cap')capAvatar.update();
    if(activeCharacter==='japan')japanAvatar.update();
    if(activeCharacter==='nobi')nobiAvatar.update();
    if(activeCharacter==='car')carAvatar.update(dt,state);
    if(activeCharacter==='cat')catAvatar.update();
    if(activeCharacter==='duck')duckAvatar.update();
    if(activeCharacter==='nope')nopeAvatar.update();
  }
  update(0, { alive: true, character });
  function dispose() { if (disposed) return; disposed = true; group.removeFromParent(); enemyRim.dispose(); sunflowerAvatar?.dispose(); starMascotAvatar?.dispose(); solderAvatar?.dispose(); iagnuAvatar?.dispose(); onoAvatar?.dispose(); grassBlockAvatar?.dispose(); nopeAvatar?.dispose(); duckAvatar?.dispose(); catAvatar?.dispose();carAvatar?.dispose();nobiAvatar?.dispose();japanAvatar?.dispose();capAvatar?.dispose();urchinAvatar?.dispose(); knifeFan?.dispose(); kit.dispose(); finishes.release(); }
  return { group, head, meshes: kit.meshes, muzzle, armL: leftArm.root, armR: rightArm.root,
    legL: leftLeg.root, legR: rightLeg.root, ownedMaterials, update, dispose };
}
