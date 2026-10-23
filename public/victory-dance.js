import { createCharacterPreview } from './character-preview.js';

// The authoritative round result already travels in snapshots. Celebration
// never changes an actor, a hit test, a timer, or the network payload.
export function roundDanceState(match, actor) {
  const dancing = match?.phase === 'post' && match.phaseTime > 0 &&
    Boolean(match.lastRound?.team) && actor?.alive === true && actor.team === match.lastRound.team;
  return { dancing, danceTime:dancing ? Math.max(0, 5 - match.phaseTime) : 0 };
}

export function createVictoryDance(THREE, { document:doc = globalThis.document, previewFactory = createCharacterPreview } = {}) {
  const get = id => doc?.getElementById?.(id), panel = get('victory-dance'), canvas = get('victory-dance-canvas');
  if (canvas?.tagName !== 'CANVAS') return { sync(){}, preview(){}, dispose(){} };
  let failed = false, disposed = false, sample = null;
  const preview = previewFactory(THREE, { canvas, document:doc, dancing:true,
    onError(){ if (panel) panel.hidden = true; failed = true; } });
  function sync({ match, player, mode, character, now = 0, paused = false } = {}) {
    if (disposed) return;
    if (mode !== 'menu' || sample && now >= sample.until) sample = null;
    const won = match?.phase === 'post' && match.phaseTime > 0 && player?.team === match.lastRound?.team;
    const active = !failed && !doc.hidden && !paused && (sample || won && ['play','shop','map','score'].includes(mode));
    panel.hidden = !active;
    if (active) {
      preview.setAppearance(sample?.character || character, player?.team || 'blue');
      get('victory-dance-label').textContent = sample ? '勝利ダンス / プレビュー' : '開米 / VICTORY DANCE';
    }
    preview.setActive(Boolean(active));
  }
  function previewDance(character, now) { if (!disposed) sample = { character, until:now + 5000 }; }
  function dispose() { if (disposed) return; disposed = true; sample = null; panel.hidden = true; preview.dispose(); }
  return { sync, preview:previewDance, dispose };
}
