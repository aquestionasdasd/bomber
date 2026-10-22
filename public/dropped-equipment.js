import { createWeaponModel } from './agent-model.js';

const WEAPONS = new Set(['classic', 'ghost', 'spectre', 'vandal', 'phantom']);
const pools = new WeakMap();
const CLEARANCE = .018;

// Dropped guns never animate. Bake every attachment into one surface per finish,
// retaining the world model's stock, magazine, sights and original surface maps.
function buildSurfaces(THREE, id) {
  const source = createWeaponModel(THREE, { id, firstPerson: false, detailed: true });
  const geometries = new Set(), materials = new Set(), surfaces = [];
  let haloTexture;
  try {
    source.parent.rotation.z = Math.PI / 2;
    source.parent.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(source.parent);
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    const settle = new THREE.Matrix4().makeTranslation(-center.x, CLEARANCE - bounds.min.y, -center.z);
    const transform = new THREE.Matrix4(), batches = new Map();
    source.parent.traverse(object => {
      if (!object.isMesh) return;
      if (!batches.has(object.material)) batches.set(object.material, []);
      batches.get(object.material).push(object);
    });
    for (const [material, objects] of batches) {
      const positions = [], normals = [], uvs = [];
      for (const object of objects) {
        const copy = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        try {
          transform.multiplyMatrices(settle, object.matrixWorld);
          copy.applyMatrix4(transform);
          if (!copy.getAttribute('normal')) copy.computeVertexNormals();
          const position = copy.getAttribute('position'), normal = copy.getAttribute('normal'), uv = copy.getAttribute('uv');
          for (let i = 0; i < position.count; i++) {
            positions.push(position.getX(i), position.getY(i), position.getZ(i));
            normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
            uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
          }
        } finally { copy.dispose(); }
      }
      const geometry = new THREE.BufferGeometry(); geometries.add(geometry);
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      surfaces.push({ geometry, material, name: `Ground weapon / ${id}`, shadow: true });
    }

    // A quiet floor marker supplies pickup contrast without brightening the gun.
    // It is unlit, has no point light, and requires no image or per-frame update.
    const haloSize = 48, pixels = new Uint8Array(haloSize * haloSize * 4);
    for (let y = 0; y < haloSize; y++) for (let x = 0; x < haloSize; x++) {
      const radius = Math.hypot((x + .5) / haloSize * 2 - 1, (y + .5) / haloSize * 2 - 1);
      const index = (y * haloSize + x) * 4;
      pixels[index] = 143; pixels[index + 1] = 208; pixels[index + 2] = 192;
      pixels[index + 3] = Math.round(Math.max(0, 1 - radius * radius) ** 2 * 90);
    }
    haloTexture = new THREE.DataTexture(pixels, haloSize, haloSize);
    haloTexture.colorSpace = THREE.SRGBColorSpace;
    haloTexture.magFilter = haloTexture.minFilter = THREE.LinearFilter; haloTexture.needsUpdate = true;
    const haloMaterial = new THREE.MeshBasicMaterial({ map: haloTexture, color: '#ffffff', transparent: true,
      opacity: .4, depthWrite: false, toneMapped: false }); materials.add(haloMaterial);
    const haloGeometry = new THREE.PlaneGeometry(size.x + .23, size.z + .23); geometries.add(haloGeometry);
    haloGeometry.rotateX(-Math.PI / 2); haloGeometry.translate(0, .005, 0);
    surfaces.push({ geometry: haloGeometry, material: haloMaterial, name: 'Pickup / soft floor light' });

    const points = [];
    for (let i = 0; i < 48; i++) {
      const angle = i / 48 * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * (size.x / 2 + .075), .008,
        Math.sin(angle) * (size.z / 2 + .075)));
    }
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points); geometries.add(outlineGeometry);
    outlineGeometry.computeBoundingSphere();
    const outlineMaterial = new THREE.LineBasicMaterial({ color: '#8fcbbd', transparent: true,
      opacity: .28, depthWrite: false, toneMapped: false }); materials.add(outlineMaterial);
    surfaces.push({ geometry: outlineGeometry, material: outlineMaterial, name: 'Pickup / floor outline', line: true });

    // Keep only the resource owner. The original high-part-count scene is not rendered.
    const nodes = []; source.parent.traverse(node => nodes.push(node));
    for (const node of nodes) if (node.isGroup) node.clear();
    return { surfaces, references: 0, bounds: { width: size.x, length: size.z, thickness: size.y, clearance: CLEARANCE },
      dispose() {
        for (const geometry of geometries) geometry.dispose();
        for (const material of materials) material.dispose();
        haloTexture.dispose(); source.dispose();
      } };
  } catch (error) {
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    haloTexture?.dispose(); source.dispose(); throw error;
  }
}

/** Ground origin is y=0. Instances of one weapon share immutable GPU resources;
 * dispose is idempotent and the last instance releases that weapon's resources. */
export function createDroppedEquipment(THREE, { weapon = 'vandal', yaw = 0 } = {}) {
  const id = WEAPONS.has(weapon) ? weapon : 'classic';
  let pool = pools.get(THREE);
  if (!pool) { pool = new Map(); pools.set(THREE, pool); }
  if (!pool.has(id)) pool.set(id, buildSurfaces(THREE, id));
  const shared = pool.get(id); shared.references++;
  const group = new THREE.Group(); group.name = `Dropped equipment / ${id}`;
  group.rotation.y = Number.isFinite(yaw) ? yaw : 0;
  group.userData.weapon = id; group.userData.pickup = true;
  group.userData.equipmentBounds = { ...shared.bounds };
  for (const surface of shared.surfaces) {
    const object = surface.line ? new THREE.LineLoop(surface.geometry, surface.material) : new THREE.Mesh(surface.geometry, surface.material);
    object.name = surface.name; object.castShadow = object.receiveShadow = Boolean(surface.shadow);
    object.raycast = () => {}; group.add(object);
  }
  let disposed = false;
  return { group, dispose() {
    if (disposed) return; disposed = true;
    group.removeFromParent(); group.clear();
    if (--shared.references === 0) { pool.delete(id); shared.dispose(); }
  } };
}
