import { CHARACTER_DEFS, DUELIST, normalizeCharacter, getCharacterSkill, getSkillState } from './abilities.js';

const KEYS = ['c', 'q', 'e'];
const MOBILE = { c: 'mobile-smoke', q: 'mobile-dash', e: 'mobile-scan' };
const clamp = value => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

// Presentation only: the kit and authoritative purchase/input rules stay in game.js.
export function createCharacterSkillUI({ document: doc = globalThis.document } = {}) {
  const get = id => doc?.getElementById?.(id);
  const text = (id, value) => { const node = get(id); if (node && node.textContent !== String(value)) node.textContent = String(value); };
  const attr = (id, name, value) => get(id)?.setAttribute?.(name, String(value));
  const icon = (id, definition) => { if (definition.icon) attr(id, 'd', definition.icon); };
  const stock = (kit, key) => key === 'c' ? kit.smoke : key === 'q' ? kit.updraft : kit.dash;
  const cost = definition => definition.price > 0 ? `最大${definition.max}回 · SC ${definition.price.toLocaleString()}/回` : `最大${definition.max}回 · 無料`;

  function updateSelection(character) {
    const id = normalizeCharacter(character), definition = CHARACTER_DEFS[id];
    text('agent-description', `${definition.role} · ${definition.description}`);
    text('online-skill-character', definition.label);
    const skills = KEYS.map(key => getCharacterSkill(id, key));
    for (const skill of skills) {
      for (const prefix of ['character-skill', 'online-character-skill', 'mobile-character-skill']) {
        text(`${prefix}-${skill.key}-name`, skill.name);
        text(`${prefix}-${skill.key}-description`, skill.description);
        text(`${prefix}-${skill.key}-meta`, cost(skill));
      }
    }
    text('guide-skill-cq', `C：${skills[0].shortName} / Q：${skills[1].shortName}`);
    text('guide-skill-ex', `E：${skills[2].shortName} / X：キャラ固有ULT`);
    text('mobile-skill-summary', `C：${skills[0].name}、Q：${skills[1].name}、E：${skills[2].name}。X：キャラ固有アルティメット。`);
  }

  function updateHUD(kit, now, { alive = true } = {}) {
    if (!kit) return;
    const character = normalizeCharacter(kit.character), time = Number.isFinite(now) ? now : 0;
    for (const key of KEYS) {
      const definition = getCharacterSkill(character, key), state = getSkillState(kit, key, time);
      let count = `${state.count}/${state.max}`;
      if (key === 'e') {
        count = state.charging ? `${Math.max(0, state.remaining).toFixed(1)}s`
          : state.remaining > 0 ? `${Math.ceil(state.remaining)}s`
            : state.ready ? 'READY' : character === 'duelist' ? `${kit.dashKills || 0}/${DUELIST.signatureKills}` : `${state.count}/${state.max}`;
      }
      text(`ability-${key}-name`, definition.shortName);
      text(`ability-${key}-count`, count);
      icon(`ability-${key}-glyph`, definition);
      const hud = get(`ability-${key}`), mobile = get(MOBILE[key]);
      hud?.classList?.toggle('cooldown', !state.ready);
      hud?.classList?.toggle('armed', !!state.armed);
      hud?.classList?.toggle('charging', !!state.charging);
      hud?.classList?.toggle('ready', !!state.ready && !!state.armed && !state.charging);
      hud?.style?.setProperty?.('--charge', String(clamp(state.progress)));
      attr(`ability-${key}`, 'aria-label', `${key.toUpperCase()} ${definition.name} ${count}`);
      text(`${MOBILE[key]}-name`, definition.shortName);
      attr(MOBILE[key], 'aria-label', `${key.toUpperCase()} ${definition.name} ${count}`);
      if (mobile) mobile.disabled = !alive || !state.ready;
    }
  }

  function updateShop({ kit, credits = 0, phase, alive = true } = {}) {
    if (!kit) return;
    const character = normalizeCharacter(kit.character);
    for (const key of ['c', 'q']) {
      const definition = getCharacterSkill(character, key), count = Math.max(0, stock(kit, key) || 0);
      const prefix = `shop-skill-${key}`, card = get(prefix);
      text(`${prefix}-name`, definition.name);
      text(`${prefix}-key`, `${key.toUpperCase()} / ${definition.shortName}`);
      text(`${prefix}-description`, definition.description);
      text(`${prefix}-count`, `所持 ${count}/${definition.max} · 1回分を購入`);
      text(`${prefix}-price`, `SC ${definition.price.toLocaleString()}`);
      icon(`${prefix}-glyph`, definition);
      attr(prefix, 'data-skill-id', definition.id);
      attr(prefix, 'aria-label', `${key.toUpperCase()} ${definition.name}、所持${count}/${definition.max}、1回分 SC ${definition.price}`);
      if (card) {
        card.disabled = !alive || phase !== 'buy' || count >= definition.max || credits < definition.price;
        card.classList?.toggle('owned', count >= definition.max);
      }
    }
  }

  return { updateSelection, updateHUD, updateShop };
}
