import { CHARACTER_DEFS, signatureKillsRequired, normalizeCharacter, getCharacterSkill, getCharacterUltimate, getSkillState } from './abilities.js';

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
    const ultimate=getCharacterUltimate(id);
    for(const prefix of ['character-skill','online-character-skill','mobile-character-skill']){
      text(`${prefix}-x-name`,ultimate.name);text(`${prefix}-x-description`,ultimate.description);text(`${prefix}-x-meta`,`${ultimate.points} ULTポイント`);
    }
    text('guide-skill-cq', `C：${skills[0].shortName} / Q：${skills[1].shortName}`);
    text('guide-skill-ex', `E：${skills[2].shortName} / X：${ultimate.name}`);
    text('mobile-skill-summary', `C：${skills[0].name}、Q：${skills[1].name}、E：${skills[2].name}。X：${ultimate.name}。${ultimate.description}`);
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
            : state.ready ? 'READY' : signatureKillsRequired(character) ? `${kit.dashKills || 0}/${signatureKillsRequired(character)}${character === 'renko' ? 'キル' : ''}` : `${state.count}/${state.max}`;
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

  function updateShop({ kit, credits = 0, phase, alive = true, refunds = {}, allowUnknownSales = false } = {}) {
    if (!kit) return;
    const character = normalizeCharacter(kit.character);
    for (const key of ['c', 'q']) {
      const definition = getCharacterSkill(character, key), count = Math.max(0, stock(kit, key) || 0);
      const prefix = `shop-skill-${key}`, card = get(prefix);
      text(`${prefix}-name`, definition.name);
      text(`${prefix}-key`, `${key.toUpperCase()} / ${definition.shortName}`);
      text(`${prefix}-description`, definition.description);
      const refundable=Math.min(count,refunds[key]||0),canBuy=count<definition.max&&credits>=definition.price;
      text(`${prefix}-count`, `${'●'.repeat(Math.min(count,definition.max))}${'○'.repeat(Math.max(0,definition.max-count))}  所持 ${count}/${definition.max}${refundable?` · 売却可 ${refundable}`:''}`);
      text(`${prefix}-price`, `SC ${definition.price.toLocaleString()}`);
      icon(`${prefix}-glyph`, definition);
      attr(prefix, 'data-skill-id', definition.id);
      attr(prefix, 'aria-label', `${key.toUpperCase()} ${definition.name}、所持${count}/${definition.max}、左クリックで1回分購入 SC ${definition.price}、右クリックで当ラウンド購入分を売却`);
      const sell=get(`${prefix}-sell`);
      if(sell){sell.disabled=!alive||phase!=='buy'||count<1||(!refundable&&!allowUnknownSales);sell.textContent='1回分売却';}
      if (card) {
        card.title=definition.description;
        card.disabled = !alive || phase !== 'buy';
        card.classList?.toggle('owned', count >= definition.max);
        card.classList?.toggle('unaffordable',!canBuy&&count<definition.max);
        card.dataset.state=count>=definition.max?'所持数 MAX':canBuy?'左クリックで1回分購入':'コイン不足';
      }
    }
    const e=getCharacterSkill(character,'e'),x=getCharacterUltimate(character);
    text('shop-free-skill',`E · ${e.name}（購入不要）`);
    text('shop-ultimate',`X · ${x.name}（7ポイント）`);
  }

  return { updateSelection, updateHUD, updateShop };
}
