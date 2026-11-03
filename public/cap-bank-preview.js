import { CAP_SKILLS } from './abilities.js';
import { capBounceFrame } from './cap-optics.js';

// Static geometry only: aiming must never query or identify concealed players.
export function traceCapBankPreview(THREE, environment, origin, aim, {surfaceVisible = () => true} = {}) {
  environment.updateMatrixWorld(true);
  let hit = new THREE.Raycaster(origin, aim, 0, CAP_SKILLS.bounceRange).intersectObject(environment, true).find(surfaceVisible);
  let direction = aim, remaining = CAP_SKILLS.bounceRange;
  const segments = [];
  for (let bounce = 0; bounce < CAP_SKILLS.bounceCount; bounce++) {
    const frame = capBounceFrame(THREE, direction, hit, remaining);
    if (!frame) break;
    remaining = frame.remaining;
    const next = new THREE.Raycaster(frame.from, frame.aim, .005, remaining).intersectObject(environment, true).find(surfaceVisible);
    segments.push({start: hit.point.clone(), end: next?.point.clone() || frame.from.clone().addScaledVector(frame.aim, remaining)});
    if (!next) break;
    hit = next;direction = frame.aim;
  }
  return segments.length ? {start: segments[0].start, end: segments.at(-1).end, segments, bounces: segments.length} : null;
}

export function createCapBankPreviewFX(THREE) {
  const group = new THREE.Group();group.name = 'バンクレンズ / 反射後の点線';
  const geometry = new THREE.CylinderGeometry(.025, .025, 1, 5);
  const material = new THREE.MeshBasicMaterial({ color: '#8df8ff', transparent: true, opacity: .95, depthWrite: false });
  const dashes = new THREE.InstancedMesh(geometry, material, 128);dashes.raycast = () => {};dashes.frustumCulled = false;
  group.add(dashes);group.visible = false;
  const pose = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);let disposed = false;
  function update(path) {
    if (disposed) return;
    group.visible = !!path;
    if (!path) { dashes.count = 0;return; }
    let count = 0;
    for (const segment of path.segments || [path]) {
      const delta = segment.end.clone().sub(segment.start), length = delta.length();
      if (!Number.isFinite(length) || length < .05) continue;
      delta.normalize();pose.quaternion.setFromUnitVectors(up, delta);
      for (let distance = .06; distance < length && count < 128; distance += .75) {
        const span = Math.min(.38, length - distance);
        pose.position.copy(segment.start).addScaledVector(delta, distance + span / 2);pose.scale.set(1, span, 1);pose.updateMatrix();dashes.setMatrixAt(count++, pose.matrix);
      }
    }
    group.visible = count > 0;
    dashes.count = count;dashes.instanceMatrix.needsUpdate = true;
  }
  return { group, update, reset() { update(null); }, dispose() { if (disposed) return;update(null);disposed = true;group.removeFromParent();geometry.dispose();material.dispose(); } };
}
