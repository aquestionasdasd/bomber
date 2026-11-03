// Face-attached confirmation reads the existing authoritative blind clock.
export function createFlashStatusFX(THREE) {
  const group = new THREE.Group(); group.name = 'Flash status / soft yellow face orbs';
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + .5 - size / 2) / (size / 2), (y + .5 - size / 2) / (size / 2));
    const i = (y * size + x) * 4;
    pixels[i] = 255; pixels[i + 1] = 222 + Math.round(30 * Math.max(0, 1 - r)); pixels[i + 2] = 70;
    pixels[i + 3] = Math.round(255 * Math.exp(-r * r * 4.8) * Math.max(0, 1 - r * r));
  }
  const texture = new THREE.DataTexture(pixels, size, size); texture.name = 'Flash status / feathered glow';
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  const slots = Array.from({ length: 10 }, () => Array.from({ length: 3 }, () => {
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, toneMapped: false });
    const sprite = new THREE.Sprite(material); sprite.name = 'Flash status / yellow puff';
    sprite.visible = false; sprite.raycast = () => {}; sprite.userData.solid = false; group.add(sprite); return sprite;
  }));
  const local = new THREE.Vector3(); let disposed = false;
  function reset() { group.visible = false; group.userData.activeActors = 0; for (const slot of slots) for (const sprite of slot) sprite.visible = false; }
  function update(actors, now, { blindUntil = () => 0, viewerId, visible = () => true, reducedMotion = false } = {}) {
    if (disposed) return; reset();
    if (!Array.isArray(actors) || !Number.isFinite(now)) return;
    let count = 0;
    for (const actor of actors) {
      if (count === slots.length) break;
      const head = actor?.visual?.head;
      if (!actor?.alive || actor.id === viewerId || !head || !(blindUntil(actor.id, now) > now)) continue;
      let shown = true; for (let node = head; node; node = node.parent) if (!node.visible) { shown = false; break; }
      if (!shown || !visible(actor)) continue;
      head.updateWorldMatrix(true, false);
      const faceDepth = actor.visual.group.userData.character === 'duck' ? .48 : .32;
      for (let i = 0; i < 3; i++) {
        const sprite = slots[count][i], phase = now * 2.7 + count * 1.9 + i * 2.1;
        const drift = reducedMotion ? 0 : Math.sin(phase) * .025;
        local.set(i === 0 ? 0 : (i === 1 ? -.16 : .16), .025 + (i ? .08 : 0) + drift, faceDepth);
        sprite.position.copy(local).applyMatrix4(head.matrixWorld);
        const scale = (i ? .31 : .58) * (reducedMotion ? 1 : 1 + Math.sin(phase + 1) * .06);
        sprite.scale.set(scale, scale, 1); sprite.material.opacity = i ? .66 : .94; sprite.visible = true;
      }
      count++;
    }
    group.userData.activeActors = count; group.visible = count > 0;
  }
  function dispose() { if (disposed) return; reset(); disposed = true; group.removeFromParent(); for (const slot of slots) for (const sprite of slot) sprite.material.dispose(); texture.dispose(); }
  reset(); return { group, update, reset, dispose };
}
