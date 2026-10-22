// Ground warnings and short, peripheral heat flares. Geometry and buffers are pooled;
// absolute timestamps produce the same appearance for a late-joining client.
export function createZoneFX(THREE) {
  const MAX_EVENTS = 20, group = new THREE.Group();
  // Logical support heights omit the deck's5cm finish and cover's8.5cm cap.
  // Lift only the visual decals; authoritative field heights stay unchanged.
  const SURFACE_LIFT = .095, PREVIEW_LIFT = .10;
  group.name = 'Ground ultimates / EMBER and FROST';
  const transform = new THREE.Object3D(), batches = [], geometries = new Set(), materials = new Set();
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  let disposed = false;
  function batch(name, geometry, capacity, color, opacity) {
    const feathered = Boolean(geometry.getAttribute('fxFeather'));
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    alpha.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('fxOpacity', alpha); geometries.add(geometry);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide,
      depthWrite: false, depthTest: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      vertexColors: Boolean(geometry.getAttribute('color')) });
    material.name = `Zone cue / ${name}`; material.forceSinglePass = true;
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float fxOpacity;\nvarying float vFxOpacity;'
        + (feathered ? '\nattribute float fxFeather;\nvarying float vFxFeather;' : ''))
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFxOpacity=fxOpacity;' + (feathered ? '\nvFxFeather=fxFeather;' : ''));
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFxOpacity;'
        + (feathered ? '\nvarying float vFxFeather;' : ''))
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vFxOpacity;' + (feathered ? '\ndiffuseColor.a *= vFxFeather;' : ''));
    };
    material.customProgramCacheKey = () => feathered ? 'zone-heat-feather-v1' : 'zone-ground-opacity-v1'; materials.add(material);
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.name = `Zone cue / ${name}`; mesh.count = 0; mesh.visible = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    mesh.castShadow = false; mesh.receiveShadow = false; mesh.userData.solid = false;
    mesh.raycast = () => {}; mesh.renderOrder = 2; group.add(mesh);
    const target = { mesh, alpha, capacity }; batches.push(target); return target;
  }
  function snowflake() {
    const positions = [];
    function segment(ax, ay, bx, by, width) {
      const length = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / length * width / 2, ny = (bx - ax) / length * width / 2;
      positions.push(ax + nx, ay + ny, 0, ax - nx, ay - ny, 0, bx + nx, by + ny, 0,
        ax - nx, ay - ny, 0, bx - nx, by - ny, 0, bx + nx, by + ny, 0);
    }
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3, x = Math.cos(angle), y = Math.sin(angle);
      segment(0, 0, x, y, .065);
      for (const sign of [-1, 1]) {
        const branch = angle + sign * .8;
        segment(x * .55, y * .55, x * .55 - Math.cos(branch) * .3, y * .55 - Math.sin(branch) * .3, .045);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals(); return geometry;
  }
  function heatRibbon() {
    const positions = [], feather = [], colors = [], indices = [];
    // Two narrow, bent ribbons read from either side without a solid cylinder.
    const rows = [[0, .16, 0, .03], [.16, .5, 0, .84], [.62, .27, .08, .36], [1, 0, -.045, 0]];
    for (let plane = 0; plane < 2; plane++) {
      const angle = plane * Math.PI / 2, base = positions.length / 3;
      for (const [height, width, bend, alpha] of rows) for (const side of [-1, 0, 1]) {
        const x = bend + side * width;
        positions.push(x * Math.cos(angle), height, x * Math.sin(angle)); feather.push(side === 0 ? alpha : 0);
        const color = new THREE.Color().setRGB(1, .66 - height * .31, .24 - height * .18);
        colors.push(color.r, color.g, color.b);
      }
      for (let row = 0; row < rows.length - 1; row++) {
        for (let strip = 0; strip < 2; strip++) {
          const a = base + row * 3 + strip; indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('fxFeather', new THREE.Float32BufferAttribute(feather, 1));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); return geometry;
  }
  const emberFill = batch('EMBER warning floor', new THREE.CircleGeometry(1, 64), MAX_EVENTS, '#c5572b', .13);
  const emberRings = batch('EMBER boundary and shockwave', new THREE.RingGeometry(.985, 1, 96), MAX_EVENTS * 2 + 1, '#ffba73', .8);
  const emberMarks = batch('EMBER hazard marks', new THREE.PlaneGeometry(1, 1), MAX_EVENTS * 12, '#eaa36f', .64);
  const emberFlares = batch('EMBER pulse heat flares', heatRibbon(), MAX_EVENTS * 12, '#ffffff', .34);
  const frostFill = batch('FROST frozen floor', new THREE.CircleGeometry(1, 64), MAX_EVENTS, '#7dc8de', .12);
  const frostRings = batch('FROST perimeter', new THREE.RingGeometry(.985, 1, 96), MAX_EVENTS * 2 + 1, '#b9f2f4', .67);
  const frostCrystals = batch('FROST snow crystals', snowflake(), MAX_EVENTS * 7, '#c3f1f3', .48);
  function write(target, x, y, z, sx, sz, opacity, angle = 0) {
    const index = target.mesh.count; if (index >= target.capacity) return;
    transform.position.set(x, y, z); transform.rotation.set(-Math.PI / 2, 0, angle); transform.scale.set(sx, sz, 1); transform.updateMatrix();
    target.mesh.setMatrixAt(index, transform.matrix); target.alpha.array[index] = clamp(opacity, 0, 1); target.mesh.count++;
  }
  function writeFlare(x, y, z, width, height, opacity, angle) {
    const index = emberFlares.mesh.count; if (index >= emberFlares.capacity) return;
    transform.position.set(x, y, z); transform.rotation.set(0, angle, 0); transform.scale.set(width, height, width); transform.updateMatrix();
    emberFlares.mesh.setMatrixAt(index, transform.matrix); emberFlares.alpha.array[index] = clamp(opacity, 0, 1); emberFlares.mesh.count++;
  }
  function seed(id) { let hash = 2166136261; for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619); return (hash >>> 0) / 4294967296; }
  function reset() {
    for (const target of batches) { target.mesh.count = 0; target.mesh.visible = false; }
    group.visible = false; group.userData.activeEvents = 0;
  }
  function update(events, now, { reducedMotion = false, preview = null } = {}) {
    if (disposed) return;
    reset(); if (!Number.isFinite(now) || !Array.isArray(events)) return;
    const unique = new Map();
    for (const event of events) {
      if (!event || !['ember', 'frost'].includes(event.type) || typeof event.id !== 'string' || !event.id.length || event.id.length > 64) continue;
      if (![event.x, event.y, event.z, event.startedAt, event.endsAt, event.radius].every(Number.isFinite) || Math.max(Math.abs(event.x), Math.abs(event.y), Math.abs(event.z)) > 1000 || event.startedAt < 0) continue;
      const duration = event.type === 'ember' ? 4.8 : 10, radius = event.type === 'ember' ? 6 : 7, age = now - event.startedAt;
      if (event.radius !== radius || Math.abs(event.endsAt - event.startedAt - duration) > 1e-8 || age < 0 || age >= duration) continue;
      const signature = JSON.stringify([event.startedAt, event.endsAt, event.type, event.x, event.y, event.z, event.radius]), previous = unique.get(event.id);
      if (!previous || signature > previous.signature) unique.set(event.id, { event, age, duration, signature });
    }
    const active = [...unique.values()].sort((a, b) => a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0).slice(0, MAX_EVENTS);
    for (const { event, age, duration } of active) {
      const y = event.y + SURFACE_LIFT, fade = clamp((duration - age) / .5, 0, 1), radius = event.radius, offset = seed(event.id) * Math.PI * 2;
      if (event.type === 'ember') {
        let pulseAge = Infinity;
        for (const at of [1.2, 2.4, 3.6]) if (age >= at) pulseAge = age - at;
        const pulse = pulseAge < .55 ? 1 - pulseAge / .55 : 0;
        const warning = age < 1.2;
        write(emberFill, event.x, y, event.z, radius, radius, fade * (warning ? .32 : .35 + pulse * .65));
        write(emberRings, event.x, y + .005, event.z, radius, radius, fade * (warning ? .85 : .62 + pulse * .38));
        if (warning || pulseAge < .55) {
          const wave = reducedMotion ? radius * .72 : warning ? radius * (.12 + .88 * age / 1.2) : radius * clamp(.12 + pulseAge / .4, .12, 1);
          write(emberRings, event.x, y + .012, event.z, wave, wave, fade * (warning ? .3 : pulse * .85));
        }
        for (let i = 0; i < 12; i++) {
          const angle = offset + i * Math.PI / 6, dist = radius * .79;
          write(emberMarks, event.x + Math.cos(angle) * dist, y + .009, event.z + Math.sin(angle) * dist,
            .045, warning ? .48 : .3 + pulse * .25, fade * (warning ? .58 : .35 + pulse * .5), Math.PI / 2 - angle);
        }
        if (!reducedMotion && pulseAge >= 0 && pulseAge < .48) {
          const life = pulseAge / .48, rise = 1 - Math.pow(1 - clamp(life / .28, 0, 1), 2);
          const heat = Math.pow(Math.sin(Math.PI * life), .7);
          for (let i = 0; i < 12; i++) {
            const variation = (offset * .731 + i * .61803398875) % 1, angle = offset + i * Math.PI / 6;
            const dist = 2.15 + (i % 3) * 1.12, width = (.38 + variation * .24) * (1 - life * .42);
            writeFlare(event.x + Math.cos(angle) * dist, y, event.z + Math.sin(angle) * dist,
              width, (.15 + rise * (2.5 + variation * 1.5)) * (1 - life * .25), fade * heat, angle + variation);
          }
        }
      } else {
        const ready = clamp(age / .8, 0, 1), shimmer = reducedMotion ? 1 : .94 + .06 * Math.sin(age * 2);
        write(frostFill, event.x, y, event.z, radius, radius, fade * (.18 + .7 * ready));
        write(frostRings, event.x, y + .005, event.z, radius, radius, fade * (.4 + .6 * ready));
        const inner = radius * (reducedMotion ? .72 : .55 + .17 * ready);
        write(frostRings, event.x, y + .012, event.z, inner, inner, fade * .3);
        write(frostCrystals, event.x, y + .01, event.z, .72, .72, fade * ready * shimmer, offset);
        for (let i = 0; i < 6; i++) {
          const angle = offset + i * Math.PI / 3, dist = radius * .66;
          write(frostCrystals, event.x + Math.cos(angle) * dist, y + .01, event.z + Math.sin(angle) * dist,
            .38, .38, fade * ready * shimmer * .65, angle);
        }
      }
    }
    const validPreview = preview && ['ember', 'frost'].includes(preview.type)
      && [preview.x, preview.y, preview.z].every(Number.isFinite)
      && Math.max(Math.abs(preview.x), Math.abs(preview.y), Math.abs(preview.z)) <= 1000
      && preview.radius === (preview.type === 'ember' ? 6 : 7);
    if (validPreview) write(preview.type === 'ember' ? emberRings : frostRings,
      preview.x, preview.y + PREVIEW_LIFT, preview.z, preview.radius, preview.radius, .8);
    for (const target of batches) { target.mesh.visible = target.mesh.count > 0; target.mesh.instanceMatrix.needsUpdate = true; target.alpha.needsUpdate = true; }
    group.userData.activeEvents = active.length; group.visible = active.length > 0 || Boolean(validPreview);
  }
  function dispose() {
    if (disposed) return; disposed = true; reset(); group.removeFromParent();
    for (const target of batches) target.mesh.dispose();
    for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose();
  }
  reset(); return { group, update, reset, dispose };
}
