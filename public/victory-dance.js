import { createAgentModel } from './agent-model.js';

// Derive presentation from the existing authoritative result; no network state.
export function roundDanceState(match, actor) {
  const dancing = match?.phase === 'post' && match.phaseTime > 0 &&
    Boolean(match.lastRound?.team) && actor?.alive === true && actor.team === match.lastRound.team;
  return { dancing, danceTime:dancing ? Math.max(0, 5 - match.phaseTime) : 0 };
}

export function victorySubject(match, player, actors, watchedId) {
  if (!roundDanceState(match, player).dancing &&
      !(match?.phase === 'post' && match.phaseTime > 0 && match.lastRound?.team === player?.team)) return null;
  if (player.alive) return player;
  const allies = actors.filter(actor => actor.alive && actor.team === player.team);
  return allies.find(actor => actor.id === watchedId) || allies.at(-1) || null;
}

// One scene/camera, and a non-hittable local body only while celebrating. The
// watched teammate uses their existing world model, never a second renderer.
export function createVictoryCamera(THREE, { camera, scene, modelFactory = createAgentModel,
  clearDistance = (origin, direction, distance) => distance } = {}) {
  let subject = null, round = null, progress = 0, disposed = false, localModel = null, localTeam = null;
  const origin = new THREE.Vector3(), outward = new THREE.Vector3(), candidate = new THREE.Vector3();
  const position = new THREE.Vector3(), look = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const entryPosition = new THREE.Vector3(), entryRotation = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  function reset() {
    subject = null; round = null; progress = 0;
    if (localModel) localModel.group.visible = false;
  }
  function update({ match, player, actors = [], watchedId, weapon = 'classic', mode = 'play', dt = 0, reducedMotion = false } = {}) {
    if (disposed) return false;
    const eligible = ['play', 'shop', 'map', 'score', 'pause'].includes(mode) &&
      match?.phase === 'post' && match.phaseTime > 0 && match.lastRound?.team === player?.team;
    if (!eligible) { reset(); return false; }
    const preferred = victorySubject(match, player, actors, watchedId);
    if (!preferred) { reset(); return false; }
    // Keep the last watched survivor stable throughout the round celebration.
    const next = player.alive ? player : subject?.alive && subject.team === player.team && actors.includes(subject) ? subject : preferred;
    const entering = round !== match.round || subject !== next;
    const yaw = next === player ? player.yaw || 0 : (next.group?.rotation.y || 0) - Math.PI;
    const distance = 4.8 * Math.min(1.3, Math.max(1, .8 / camera.aspect));
    origin.set(next.x, (next.y || 0) + 1.05, next.z);
    if (entering) {
      subject = next; round = match.round; progress = 0;
      entryPosition.copy(camera.position); entryRotation.copy(camera.quaternion);
      let best = -1;
      for (const offset of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI, 3 * Math.PI / 4, -3 * Math.PI / 4]) {
        candidate.set(-Math.sin(yaw + offset), .16, -Math.cos(yaw + offset)).normalize();
        const space = clearDistance(origin, candidate, distance);
        if (space > best) { best = space; outward.copy(candidate); }
        if (space >= distance - .02) break;
      }
    }
    progress = reducedMotion ? 1 : Math.min(1, progress + Math.max(0, dt) / .85);
    const blend = progress * progress * (3 - 2 * progress);
    const space = Math.max(0, Math.min(distance, clearDistance(origin, outward, distance)));
    position.copy(origin).addScaledVector(outward, space);
    camera.position.lerpVectors(entryPosition, position, blend);
    // Clip the interpolated path too, so a corner cannot be crossed on entry.
    candidate.subVectors(camera.position, origin);
    const length = candidate.length();
    if (length > .001) {
      candidate.divideScalar(length);
      camera.position.copy(origin).addScaledVector(candidate, Math.min(length, Math.max(0, clearDistance(origin, candidate, length))));
    }
    look.lookAt(camera.position, origin, up); rotation.setFromRotationMatrix(look);
    camera.quaternion.slerpQuaternions(entryRotation, rotation, blend);
    camera.fov = 76 + (60 - 76) * blend; camera.updateProjectionMatrix();
    if (next === player) {
      if (!localModel || localTeam !== player.team) {
        localModel?.dispose(); localTeam = player.team;
        localModel = modelFactory(THREE, { team:player.team, character:player.kit?.character || 'duelist' });
        scene.add(localModel.group);
      }
      localModel.group.position.set(player.x, player.y || 0, player.z);
      localModel.group.rotation.y = (player.yaw || 0) + Math.PI;
      localModel.group.visible = camera.position.distanceTo(origin) > .8;
      localModel.update(dt, { alive:true, character:player.kit?.character || 'duelist', weapon,
        ...roundDanceState(match, player), ...(reducedMotion ? { danceTime:0 } : {}) });
    } else {
      if (localModel) localModel.group.visible = false;
      if (next.group) next.group.visible = camera.position.distanceTo(origin) > .8;
    }
    return true;
  }
  function dispose() { if (disposed) return; reset(); localModel?.dispose(); localModel = null; disposed = true; }
  return { update, reset, dispose, get active(){ return !!subject; }, get subject(){ return subject; }, get localModel(){ return localModel; } };
}
