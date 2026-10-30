import { normalizeCharacter, getCharacterSkill, getCharacterUltimate, DUELIST, RENKO_SKILLS } from './abilities.js';

// In-match cues carry one action or effect; full rules stay in the skill details.
const hints = {
  duelist: { c: '煙幕で視界を遮る', q: '上へジャンプ', e: '進行方向へダッシュ', x: '左：1本／右：まとめ投げ' },
  nope: { c: '瓶が爆発し敵にダメージ', q: '顔を見た相手に閃光', e: '撃たれると閃光を放つ囮', x: '30体ずつ、5秒おきに3回' },
  mend: { c: '種の範囲で敵が減速', q: '花粉で視界を遮る', e: '負傷した1人を60回復', x: '近くの味方と自身を75回復' },
  echo: { c: '侵入した敵の位置を通知', q: '反射を見た相手に閃光', e: '4秒、移動速度アップ', x: '周囲を3回索敵' },
  veil: { c: '最大3地点へ同時に7秒の煙幕', q: '侵入音と根で索敵／移動・跳躍を妨害', e: '3秒、地上を速く走る', x: '選んだ地点に12秒の大煙幕' },
  ember: { c: 'はんだ玉が弾けて敵を攻撃', q: '8秒、新しい閃光を軽減', e: '予備弾から素早く装填', x: '指定地点へ3回爆撃' },
  frost: { c: '霜の輪に触れた敵が減速', q: '霧で視界を遮る', e: '滑り込み、減速にも耐える', x: '10秒、範囲内の敵が減速' },
  duck: { c: '乗ると跳べる床を設置', q: '両軍の弾を止める盾を設置', e: 'スペース連打で10秒飛行', x: '8秒、致死攻撃を2回耐える' },
  cat: { c: '場所を保存／再Cで帰還', q: '敵の装填弾を裂いて攻撃', e: '狙った落ちた銃を回収', x: '8秒、試合とボンバーの時計停止' },
  car: { c: '敵を吹き飛ばし5秒スタン', q: '狙った煙幕を1つ除去', e: '4秒、地上の移動射撃が安定', x: '近くの味方と自身のC/Q/E補給' },
  nobi: { c: '範囲内の敵への銃ダメージ増加', q: '範囲内の敵の連射が遅くなる', e: '味方の設置・解除が加速', x: '範囲内の味方の銃撃が頭相当に' },
  japan: { c: '線を越えた敵に大ダメージ', q: '敵の装甲を奪って強化', e: '5秒、受けた銃撃を撃ち手へ返す', x: '倒れた味方全員を10HPで復帰' },
  cap: { c: '投擲で周囲の照準妨害・敵を透過', q: '7子弾に分裂／右で回復A・攻撃B', e: '着弾周囲の味方に6秒の跳弾', x: '着弾周囲の味方に9秒の弾数無消費' },
  urchin: { c: '直線攻撃＋2.5秒の侵入監視', q: '0.45秒後に主武器を弾く', e: '波に触れた相手の遠方視界を奪う', x: '13秒、三方向射撃＋連射アップ' },
  onnara: { c: 'その場から大ジャンプ', q: '反射カメラに映る敵を透視', e: 'Spaceで跳ぶ／再Eで解除', x: '8秒、銃の命中ダメージが連鎖' },
  renko: { c: '壁貫通で吹き飛ばし＋1秒スタン', q: '素手で高速走行／再Qで解除', e: `長押し${RENKO_SKILLS.flightDuration}秒／${RENKO_SKILLS.signatureKills}キルで回復`, x: '敵撃破ごとにC/Q/Eを全回復' },
};

export function getSkillUseMessage(character, key, effectType = '') {
  const id = normalizeCharacter(character), slot = typeof key === 'string' ? key.toLowerCase().replace(/^key/, '') : '';
  const hint = hints[id]?.[slot];
  if (!hint) return null;
  const definition = slot === 'x' ? getCharacterUltimate(id) : getCharacterSkill(id, slot);
  const description = effectType === 'dash-armed' ? `${DUELIST.dashArmDelay}秒後、再Eでダッシュ`
    : effectType === 'cat-return' ? '保存した場所へ帰還' : effectType==='cap-cluster-heal'?'回復の7子弾／自身と味方を回復':effectType==='cap-cluster-damage'?'攻撃の7子弾／命中敵を3秒透過':hint;
  return { title: `${slot.toUpperCase()} ${definition.shortName}`, description };
}
