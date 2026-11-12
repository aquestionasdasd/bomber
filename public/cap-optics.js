import { CAP_SKILLS } from './abilities.js';

// Shared by real shots and the local aiming guide, including instanced walls.
export function capBounceFrame(THREE, incoming, hit, range = CAP_SKILLS.bounceRange) {
  if (!hit?.face || hit.object.userData.bot || !Number.isFinite(hit.distance) || hit.distance < 0 || !Number.isFinite(range) || hit.distance >= range - .1) return null;
  const transform = hit.object.matrixWorld.clone();
  if (hit.object.isInstancedMesh && Number.isInteger(hit.instanceId)) {
    const instance = new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId, instance);transform.multiply(instance);
  }
  const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(transform));
  if (Math.abs(normal.y) > .3) return null;
  const aim = incoming.clone().normalize().reflect(normal).normalize();
  if (aim.dot(normal) < 0) normal.negate();
  return { aim, from: hit.point.clone().addScaledVector(normal, .025), remaining: range - hit.distance - .025 };
}

// A deterministic cone, resolved from the accepted trigger sequence. Guests
// send their unmodified aim; the host applies this once, never a client ray.
export function capShotOffset(sequence, locked = false) {
  if (!locked) return { x: 0, y: 0 };
  const index = Number.isSafeInteger(sequence) && sequence > 0 ? sequence : 1;
  const angle = (index % 1048576) * 2.399963229728653;
  const radius = CAP_SKILLS.lockSpread * .5;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
