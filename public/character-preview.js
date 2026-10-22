import { createAgentModel } from './agent-model.js';
import { CHARACTER_DEFS, normalizeCharacter } from './abilities.js';

// One context and one live model serve both character selectors. Hidden menus
// keep their selected character, but own no animation frame or render work.
export function createCharacterPreview(THREE, {
  canvas, document: doc = canvas?.ownerDocument, rendererFactory,
  modelFactory = createAgentModel,
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = id => globalThis.cancelAnimationFrame(id),
  observeResize, pixelRatio = () => globalThis.devicePixelRatio || 1,
  reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  onError = () => {},
} = {}) {
  let renderer = null, model = null, frameId = null, active = false, disposed = false, failed = false, contextLost = false;
  let character = 'duelist', team = 'blue', previous = null, lastRender = -Infinity, clock = 0;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .05, 30);
  scene.add(new THREE.HemisphereLight('#e6f3ff', '#64716d', 2.5));
  const key = new THREE.DirectionalLight('#fff0d7', 3.2); key.position.set(-3, 5, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#a9e2e7', 2); rim.position.set(3, 3, -3); scene.add(rim);
  const baseGeometry = new THREE.CylinderGeometry(.52, .59, .035, 64);
  const baseMaterial = new THREE.MeshStandardMaterial({ color:'#233c48', roughness:.72, metalness:.2 });
  const base = new THREE.Mesh(baseGeometry, baseMaterial); base.position.y = -.014; scene.add(base);
  const center = new THREE.Vector3(), size = new THREE.Vector3(), bounds = new THREE.Box3();
  let unsubscribeResize = null;
  const canRun = () => active && !doc?.hidden && !disposed && !failed && !contextLost;
  function stop() {
    if (frameId !== null) cancelFrame(frameId);
    frameId = null; previous = null;
  }
  function fitCamera() {
    if (!model) return;
    model.group.updateMatrixWorld(true); bounds.makeEmpty();
    model.group.traverse(object => {
      if (!object.isMesh) return;
      for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return;
      bounds.expandByObject(object);
    });
    bounds.getCenter(center); bounds.getSize(size);
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov * .5));
    const distance = Math.max(size.y / (2 * tangent), size.x / (2 * tangent * camera.aspect)) * 1.12 + size.z * .35;
    // A raised three-quarter view exposes the block's grass top as well as
    // its soil sides; the other completed characters keep their portrait view.
    camera.position.set(center.x, center.y + (character === 'veil' ? distance * .42 : .035), center.z + distance);
    camera.lookAt(center.x, center.y, center.z);
  }
  function resize() {
    if (!renderer || disposed) return;
    const rect = canvas.getBoundingClientRect(), width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
    renderer.setPixelRatio(Math.min(1.5, Math.max(1, Number(pixelRatio()) || 1)));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); fitCamera();
  }
  function buildModel() {
    model?.dispose();
    model = modelFactory(THREE, { team, character, variant:0 });
    model.group.rotation.y = character === 'veil' ? -.56 : -.24; scene.add(model.group);
    model.update(0, { alive:true, character, weapon:'vandal' }); fitCamera();
  }
  function ensureRenderer() {
    if (renderer) return true;
    try {
      renderer = rendererFactory ? rendererFactory(canvas) : new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true, powerPreference:'low-power' });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
      renderer.setClearColor('#0c1822', 0); buildModel(); resize(); return true;
    } catch (error) {
      failed = true; model?.dispose(); model = null; renderer?.dispose(); renderer = null; onError(error); return false;
    }
  }
  function schedule() { if (canRun() && frameId === null) frameId = requestFrame(frame); }
  function frame(now) {
    frameId = null;
    if (!canRun()) return;
    if (now - lastRender >= 1000 / 30 - .5) {
      const dt = previous === null ? 0 : Math.min(.08, Math.max(0, (now - previous) / 1000));
      previous = now; lastRender = now; clock += dt;
      model.group.rotation.y = (character === 'veil' ? -.56 : -.24) + (reducedMotion() ? 0 : Math.sin(clock * .45) * .09);
      model.update(dt, { alive:true, time:reducedMotion() ? 0 : clock, character, weapon:'vandal' });
      renderer.render(scene, camera);
    }
    schedule();
  }
  function setActive(value) {
    if (disposed) return;
    const changed = active !== Boolean(value); active = Boolean(value);
    if (!canRun()) { stop(); return; }
    if (ensureRenderer()) { if (changed || frameId === null) { resize(); lastRender = -Infinity; } schedule(); }
  }
  function setAppearance(value, color = team) {
    const next = normalizeCharacter(value), nextTeam = color === 'red' ? 'red' : 'blue';
    if (disposed || next === character && nextTeam === team) return;
    character = next; team = nextTeam; if (renderer) buildModel(); lastRender = -Infinity; schedule();
  }
  const setCharacter = value => setAppearance(value, team);
  const setTeam = value => setAppearance(character, value);
  function onVisibility() { if (canRun()) setActive(true); else stop(); }
  function onContextLost(event) { event.preventDefault(); contextLost = true; stop(); }
  function onContextRestored() { contextLost = false; lastRender = -Infinity; if (canRun()) { resize(); schedule(); } }
  canvas?.addEventListener?.('webglcontextlost', onContextLost);
  canvas?.addEventListener?.('webglcontextrestored', onContextRestored);
  doc?.addEventListener?.('visibilitychange', onVisibility);
  const view = doc?.defaultView;
  const onResize = () => resize(); view?.addEventListener?.('resize', onResize);
  if (observeResize) unsubscribeResize = observeResize(canvas, resize);
  else if (typeof globalThis.ResizeObserver === 'function') {
    const observer = new globalThis.ResizeObserver(resize); observer.observe(canvas); unsubscribeResize = () => observer.disconnect();
  }
  function dispose() {
    if (disposed) return; disposed = true; active = false; stop();
    doc?.removeEventListener?.('visibilitychange', onVisibility); view?.removeEventListener?.('resize', onResize); unsubscribeResize?.();
    canvas?.removeEventListener?.('webglcontextlost', onContextLost); canvas?.removeEventListener?.('webglcontextrestored', onContextRestored);
    model?.dispose(); model = null; baseGeometry.dispose(); baseMaterial.dispose();
    renderer?.dispose(); renderer?.forceContextLoss?.(); renderer = null;
  }
  return { setCharacter, setTeam, setAppearance, setActive, resize, dispose };
}

export function createCharacterPicker(THREE, { document:doc = globalThis.document, previewFactory = createCharacterPreview } = {}) {
  const get = id => doc?.getElementById?.(id), canvas = get('character-preview-canvas');
  // DOM-only/headless game fixtures do not create a second WebGL renderer.
  if (canvas?.tagName !== 'CANVAS') return { sync(){}, dispose(){} };
  const preview = previewFactory(THREE, { canvas, document:doc, onError() {
    for (const id of ['character-preview-note','online-character-preview-note']) if (get(id)) get(id).textContent = '3D表示を開始できませんでした';
  }});
  let disposed = false, currentHost = null;
  function sync() {
    if (disposed) return;
    const id = normalizeCharacter(get('agent-select')?.value), definition = CHARACTER_DEFS[id];
    for (const prefix of ['character-preview','online-character-preview']) {
      if (get(`${prefix}-name`)) get(`${prefix}-name`).textContent = definition.label;
      if (get(`${prefix}-role`)) get(`${prefix}-role`).textContent = `${definition.role} / ${definition.ultName}`;
    }
    canvas.setAttribute('aria-label', `${definition.label}の3Dモデル`);
    const onlineOpen = get('online-overlay')?.hidden === false;
    const host = onlineOpen && get('online-lobby')?.hidden === false ? get('online-character-preview-stage') :
      !onlineOpen && get('menu')?.hidden === false ? get('character-preview-stage') : null;
    if (!host) { preview.setActive(false); return; }
    if (host !== currentHost) { preview.setActive(false); host.append(canvas); currentHost = host; }
    preview.setAppearance(id, onlineOpen ? get('online-team')?.value : 'blue'); preview.setActive(true);
  }
  const view = doc.defaultView, onPageHide = event => event.persisted ? preview.setActive(false) : dispose();
  get('online-team')?.addEventListener('change', sync);
  view?.addEventListener?.('pagehide', onPageHide); view?.addEventListener?.('pageshow', sync);
  function dispose() {
    if (disposed) return; disposed = true; preview.dispose();
    get('online-team')?.removeEventListener?.('change', sync);
    view?.removeEventListener?.('pagehide', onPageHide); view?.removeEventListener?.('pageshow', sync);
  }
  return { sync, dispose };
}
