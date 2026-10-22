// Original fan-made tuning inspired by the duelist role; not an exact live-game ruleset.
export const CHARACTER_DEFS = Object.freeze({
  duelist: Object.freeze({ id: 'duelist', label: 'ちぬつてのとのへめほ', role: '突入', ultName: 'ブレードストーム', ultShortName: 'ナイフ', ultimatePoints: 7,
    description: 'C：空中に短い流れ星の幕 / Q：アンテナリフトで上昇 / E：2段階のダッシュ。X：ナイフ5本・撃破で補充（7pt）。', color: '#a7e3e7', ultIcon: 'm24 3 5 2-13 17-6 4 1-7L24 3M11 19l5 3M9 23l-4 5M22 7l4 3M4 7l4-3m21 18 4 2' }),
  nope: Object.freeze({ id: 'nope', label: 'NOPE', role: '特殊', ultName: 'ノープ・テイクオーバー', ultShortName: 'ノープ', ultimatePoints: 7,
    description: 'C：瓶グレネード / Q：顔フラッシュ / E：撃たれると閃光を放つ全身の囮。X：駅をロゴ柄にし、街中へ30体の囮を12秒展開（7pt）。', color: '#d7a8f1', ultIcon: 'M7 25V5l22 20V5M7 5l22 20M14 5h7M15 25h7' }),
  mend: Object.freeze({ id: 'mend', label: '丱凵してね', role: '支援', ultName: 'リカバリーウェーブ', ultShortName: '回復', ultimatePoints: 7,
    description: 'C：足止めの種 / Q：花粉の煙幕 / E：単体60回復。X：視線内18mの生存味方と自身を最大75回復（7pt）。', color: '#8fe2b5', ultIcon: 'M13 3h10v7h8v10h-8v7H13v-7H5V10h8Z' }),
  echo: Object.freeze({ id: 'echo', label: 'IAGNU', role: '索敵', ultName: 'リコンパルス', ultShortName: '索敵', ultimatePoints: 7,
    description: 'C：一度だけ侵入を知らせる金文字 / Q：反射閃光 / E：短い移動補助。X：30m内を3回索敵、検知地点を短時間表示（7pt）。', color: '#d3c785', ultIcon: 'M18 3a12 12 0 1 0 12 12M18 8a7 7 0 1 0 7 7M18 15 29 4M23 4h6v6M18 14v2' }),
  veil: Object.freeze({ id: 'veil', label: '草ブロック', role: '制圧', ultName: 'ブラックアウトドーム', ultShortName: 'ドーム', ultimatePoints: 7,
    description: 'C：近距離の土煙 / Q：地表の根の帯 / E：接地中の芝走り。X：自身を中心に半径9mの視界を12秒遮断（7pt）。', color: '#b0abd8', ultIcon: 'M4 24a14 14 0 0 1 28 0M3 24h30M9 24v-8m18 8v-8M18 6V3' }),
  ember: Object.freeze({ id: 'ember', label: 'はんだごて握り太郎', role: '攻撃', ultName: 'フレアストライク', ultShortName: '爆撃', ultimatePoints: 7,
    description: 'C：小さく弾けるはんだ玉 / Q：新しい閃光を軽減する遮光眼鏡 / E：予備弾で素早く整備。X：半径6m・30ダメージ×3回の爆撃（7pt）。', color: '#eaa36f', ultIcon: 'M18 2v5m0 16v5M2 15h5m22 0h5M8 5l4 4m12 12 4 4M28 5l-4 4M12 21l-4 4M18 8l3 5 5 2-5 2-3 5-3-5-5-2 5-2Z' }),
  frost: Object.freeze({ id: 'frost', label: '尾野', role: '守備', ultName: 'クライオフィールド', ultShortName: '足止め', ultimatePoints: 7,
    description: 'C：円環の霜のステッチ / Q：遠くのドールミスト / E：接地中の減速を軽減。X：最大20m先に半径7mの減速場を10秒展開（7pt）。', color: '#96dce5', ultIcon: 'M18 2v26M6 8l24 14M6 22 30 8M14 5l4 4 4-4M14 25l4-4 4 4M6 13l6-1-1-6M30 17l-6 1 1 6M6 17l6 1-1 6M30 13l-6-1 1-6' }),
  duck: Object.freeze({ id:'duck', label:'🦆', role:'防護・封印', ultName:'不屈の卵', ultShortName:'卵', ultimatePoints:7,
    description:'C：狙った敵の新しいスキルを封印 / Q：弾だけを止める羽盾 / E：足音と着地音を消す。X：8秒、致死攻撃を2回までHP1で耐える（7pt）。', color:'#77b34c', ultIcon:'M18 2C9 2 5 16 5 21a13 9 0 0 0 26 0C31 16 27 2 18 2Zm-2 10 5 5-5 4 4 5' }),
  cat: Object.freeze({id:'cat',label:'猫の画像',role:'回収・時制',ultName:'白紙の8秒',ultShortName:'時止め',ultimatePoints:7,description:'C：保存地点へ帰還 / Q：敵の装填弾を5発抜く / E：落ちた銃を遠隔回収。X：8秒、ラウンドとボンバーの時計を止める。行動と電源オフは進む（7pt）。',color:'#eee8dd',ultIcon:'M18 3a12 12 0 1 0 0 24 12 12 0 0 0 0-24ZM14 9v12m8-12v12'}),
  car: Object.freeze({id:'car',label:'トミカ',role:'排除・補給',ultName:'ピットクルー',ultShortName:'補給',ultimatePoints:7,description:'C：敵を床に沿って押し出す / Q：狙った煙を一つ除去 / E：接地中の移動射撃を安定化。X：視線内24mの味方と自身のC/Q/Eを補給（7pt）。',color:'#e9ece8',ultIcon:'M4 23h28V10H4ZM8 14h8v5H8Zm12 0h8v5h-8ZM12 4v4m12-4v4M9 25v4m18-4v4'}),
});
export const normalizeCharacter = value => typeof value === 'string' && Object.hasOwn(CHARACTER_DEFS, value) ? value : 'duelist';
export const DUELIST = Object.freeze({ smokeMax: 2, smokePrice: 100, smokeDuration: 5,
  updraftMax: 2, updraftPrice: 100, updraftVelocity: 7.8,
  dashArmDelay: .25, dashWindow: 12, dashDistance: 12, dashDuration: .18,
  signatureKills: 1, ultimatePoints: 7, knives: 5 });
export const DUELIST_SKILLS = Object.freeze({ cometRange: 18, cometFlight: .25, cometRadius: 2.8, cometDuration: 5, liftVisualDuration: .45 });
export const NOPE_SKILLS = Object.freeze({ bottleFuse: 1, bottleFlight: .55, bottleRadius: 5.5, bottleDamage: 90,
  flashFlight: .45, flashRadius: 12, flashDuration: 2.4, decoyDuration: 12, signatureCooldown: 15 });
export const MEND_SKILLS = Object.freeze({ seedsFlight: .65, seedsRadius: 4.5, seedsDuration: 9, seedsSpeedScale: .5, seedsGroundOffset: .12,
  pollenFlight: .55, pollenRadius: 4.2, pollenDuration: 9, healAmount: 60, healRange: 18, healVisualDuration: .8, signatureCooldown: 18 });
export const IAGNU_SKILLS = Object.freeze({ tagFlight: .55, tagArmDelay: .5, tagDuration: 12, tagRadius: 4.5, tagRange: 18,
  tagRevealDuration: 2.5, tagGroundOffset: .12, glintFlight: .5, glintRadius: 10, glintDuration: 2, glintEyeOffset: 1.6,
  kerningDuration: 4, kerningSpeedScale: 1.35, signatureCooldown: 18 });
export const VEIL_SKILLS = Object.freeze({ dustArmDelay: .2, dustRadius: 3.5, dustDuration: 7, dustCenterOffset: 1.25,
  rootsRange: 10, rootsMinRange: .5, rootsWidth: 3.2, rootsArmDelay: .25, rootsDuration: 8, rootsSpeedScale: .45, rootsHeightTolerance: .45,
  turfDuration: 3, turfSpeedScale: 1.5, signatureCooldown: 15 });
export const EMBER_SKILLS = Object.freeze({ solderRange: 18, solderFlight: .45, solderArmDelay: .2, solderRadius: 3.2,
  solderDamage: 75, solderTail: .35, solderGroundOffset: .12, shadeDuration: 8, shadeFlashScale: .15,
  serviceDuration: .8, signatureCooldown: 18 });
export const FROST_SKILLS = Object.freeze({ stitchRange: 16, stitchFlight: .55, stitchArmDelay: .25, stitchDuration: 8,
  stitchRadius: 3.8, stitchInnerRadius: .9, stitchSpeedScale: .45, stitchGroundOffset: .12, stitchHeightTolerance: .45,
  mistRange: 18, mistFlight: .5, mistDuration: 9, mistRadius: 3.5, mistCenterOffset: 1.4,
  unravelDuration: 5, unravelSlowFraction: .15, signatureCooldown: 18 });
export const CAR_SKILLS=Object.freeze({bumperRange:35,bumperDistance:3,washRange:40,gyroDuration:4,signatureCooldown:18,pitRange:24});
export const CAT_SKILLS=Object.freeze({bookmarkDuration:10,returnRange:24,pluckRange:30,pluckAmmo:5,fetchRange:18,signatureCooldown:18,clockDuration:8});
export const DUCK_SKILLS = Object.freeze({ sealRange:40, sealDuration:4, shieldRange:28, shieldDuration:6, shieldHP:180, shieldWidth:3, shieldHeight:2.4, hushDuration:5, signatureCooldown:20, eggDuration:8, eggLives:2 });
const catSkills={
 c:{name:'白いしおり',shortName:'帰還',description:'接地中に場所を記録。10秒以内にCを再押しで24m以内の記録地点へ戻る。HP・弾は戻らず、着地先が塞がると不発。初回だけ回数消費。',max:2,price:100,type:'cat-bookmark',icon:'M10 3h16v26l-8-6-8 6ZM14 9h8m-8 5h8'},
 q:{name:'ひげの弾抜き',shortName:'弾抜き',description:'Qで構え、30mの視線内敵へ左確定・右取消。敵の現在の銃の装填弾を最大5発抜く。空・装填中・ナイフには無効。',max:1,price:100,type:'cat-pluck',icon:'M8 7h6v18H8Zm14 0h6v18h-6ZM3 16h5m20 0h5M16 12l4 8'},
 e:{name:'ねこの手',shortName:'銃回収',description:'Eで構え、18mの見える落ちた銃へ左確定・右取消。銃を回収し前の同枠装備は足元へ落とす。弾は生成せず、18秒で再使用。',max:1,price:0,type:'cat-fetch',icon:'M7 26V14l5 7V5h5v13V3h5v16l4-8 4 2-4 15Z'},
};
const duckSkills = {
 c:{name:'羽根の封印',shortName:'封印',description:'Cで構え、40m以内の照準の敵へ左クリック確定・右クリック取消。4秒、新規スキル発動だけを封じる。壁と煙越しは不可。',max:2,price:100,type:'duck-seal',icon:'M8 25 28 5M12 9l8 8M9 13l7 7M17 6l8 8M5 27l4-1'},
 q:{name:'浮き羽の盾',shortName:'羽盾',description:'Qで構え、28m以内の床へ左クリック設置・右クリック取消。6秒・180耐久の羽盾。両軍の弾を止め、視線・歩行・近接は通す。',max:1,price:100,type:'duck-shield',icon:'M18 3 5 8v9c0 8 13 12 13 12s13-4 13-12V8ZM18 8v16M10 12l8 4 8-4'},
 e:{name:'忍びガモ',shortName:'消音',description:'5秒、足音と着地音を消す。BOTの聴覚も対象。銃声・移動速度・視認性は変わらない。20秒で再使用。',max:1,price:0,type:'duck-hush',icon:'M5 12h6l7-7v20l-7-7H5ZM24 9l8 12m0-12-8 12'},
};
const baseSkills = {
  c: { name: '流れ星の幕', shortName: '星幕', description: `視線方向の空中${DUELIST_SKILLS.cometRange}m以内へ直線で投げ、到達から${DUELIST_SKILLS.cometDuration}秒、半径${DUELIST_SKILLS.cometRadius}mの星幕で敵味方双方の視界を遮る。`, max: DUELIST.smokeMax, price: DUELIST.smokePrice, type: 'duelist-comet', icon: 'm20 3 3 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1ZM3 25l7-5M2 19l6-3m-2-6 4-1' },
  q: { name: 'アンテナリフト', shortName: '上昇', description: `上向き速度${DUELIST.updraftVelocity}で跳び上がる。${DUELIST.updraftMax}回まで所持でき、空中でも使用可能。横方向の加速や滑空は付かない。`, max: DUELIST.updraftMax, price: DUELIST.updraftPrice, type: 'duelist-lift', icon: 'm10 14 8-9 8 9M18 6v17M7 21l11 6 11-6M5 26l13 3 13-3M9 3 7 0m20 3 2-3' },
  e: { name: 'テイルウィンド', shortName: 'ダッシュ', description: `Eで準備し、${DUELIST.dashArmDelay}秒後から再Eで${DUELIST.dashDistance}m移動。準備開始から${DUELIST.dashWindow}秒以内に使う。`, max: 1, price: 0, type: 'dash', icon: 'm14 5-8 10h12l-6 10L31 10H18l4-5' },
};
const nopeSkills = {
  c: { name: 'NOPEボトル', shortName: '瓶', description: `${NOPE_SKILLS.bottleFuse}秒後に半径${NOPE_SKILLS.bottleRadius}mで爆発。敵へ最大${NOPE_SKILLS.bottleDamage}ダメージ、壁と距離で防げる。`, max: 2, price: DUELIST.smokePrice, type: 'nope-bottle', icon: 'M14 3h8v5l3 5v13H11V13l3-5ZM14 3v5h8M11 16h14M15 19l6 4m0-4-6 4' },
  q: { name: 'NOPEフェイスフラッシュ', shortName: '顔閃光', description: `半径${NOPE_SKILLS.flashRadius}m内で正面から顔が見えると最大${NOPE_SKILLS.flashDuration}秒まぶしくなる。味方と自身にも有効。`, max: 1, price: DUELIST.updraftPrice, type: 'nope-flash', icon: 'M18 2v4M3 15h4m22 0h4M7 4l3 3m16 16 3 3M29 4l-3 3M9 10l5 5m0-5-5 5m13-5 5 5m0-5-5 5M11 21q7 7 14 0' },
  e: { name: 'NOPEボディデコイ', shortName: '全身の囮', description: `${NOPE_SKILLS.decoyDuration}秒の全身の囮。敵が撃つと壊れ、半径${NOPE_SKILLS.flashRadius}m内でこちらを見る敵へ最大${NOPE_SKILLS.flashDuration}秒の閃光。味方の弾は無反応。${NOPE_SKILLS.signatureCooldown}秒で再使用。`, max: 1, price: 0, type: 'nope-decoy', icon: 'M5 8h20v16H5ZM10 12l4 4m0-4-4 4m8-4 4 4m0-4-4 4M10 20q6 4 11 0M28 9q7 7 0 14' },
};
const mendSkills = {
  c: { name: 'ひまわりの足止め種', shortName: '足止め種', description: `着地から${MEND_SKILLS.seedsDuration}秒、半径${MEND_SKILLS.seedsRadius}mの敵の歩く速さを${MEND_SKILLS.seedsSpeedScale*100}%にする。壁で遮られる。`, max: 2, price: DUELIST.smokePrice, type: 'mend-seeds', icon: 'M18 4v25M18 16C5 17 4 6 5 5c10 0 13 5 13 11ZM18 22c0-9 5-12 13-12 0 8-4 12-13 12Z' },
  q: { name: 'ひまわりの花粉ベール', shortName: '花粉煙幕', description: `着弾から${MEND_SKILLS.pollenDuration}秒、半径${MEND_SKILLS.pollenRadius}mの花粉で敵味方双方の視界を遮る。`, max: 1, price: DUELIST.updraftPrice, type: 'mend-pollen', icon: 'M8 24a7 7 0 0 1 0-14 10 10 0 0 1 18 1 7 7 0 0 1 1 14H8M11 14v2m8 1v2m7-6v2M15 22v2' },
  e: { name: 'ひまわりの手当て', shortName: '手当て', description: `視線内${MEND_SKILLS.healRange}mの負傷した味方1人を${MEND_SKILLS.healAmount}HP回復。自身にも使え、${MEND_SKILLS.signatureCooldown}秒で再使用。対象がいない時は回数を使わない。`, max: 1, price: 0, type: 'mend-heal', icon: 'M14 3h8v8h8v8h-8v8h-8v-8H6v-8h8ZM9 29h18' },
};
const iagnuSkills = {
  c: { name: 'セリフタグ', shortName: '警戒文字', description: `最大${IAGNU_SKILLS.tagRange}mへ投げ、着地${IAGNU_SKILLS.tagArmDelay}秒後から${IAGNU_SKILLS.tagDuration}秒、半径${IAGNU_SKILLS.tagRadius}mへ入った見える敵1人の地点だけを${IAGNU_SKILLS.tagRevealDuration}秒知らせる。`, max: 2, price: DUELIST.smokePrice, type: 'echo-tag', icon: 'M11 4h14M18 4v24M11 28h14M7 8H4v16h3m22-16h3v16h-3' },
  q: { name: 'スペキュラー', shortName: '反射閃光', description: `半径${IAGNU_SKILLS.glintRadius}m内で金文字の反射を見た相手を最大${IAGNU_SKILLS.glintDuration}秒まぶしくする。味方と自身にも有効。`, max: 1, price: DUELIST.updraftPrice, type: 'echo-glint', icon: 'm8 28 9-24h3l9 24M12 19h13M4 6l3 3m22-3-3 3M18 1v2' },
  e: { name: 'カーニング', shortName: '移動補助', description: `${IAGNU_SKILLS.kerningDuration}秒間、自身の歩く速さを${IAGNU_SKILLS.kerningSpeedScale}倍にする。${IAGNU_SKILLS.signatureCooldown}秒で再使用できる。`, max: 1, price: 0, type: 'echo-kerning', icon: 'M4 7v20M4 7l11 20V7m6 0v20M21 7l11 20V7M10 3h16m-3-2 3 2-3 2' },
};
const veilSkills = {
  c: { name: '土煙', shortName: '土煙', description: `接地中に発動。${VEIL_SKILLS.dustArmDelay}秒後から${VEIL_SKILLS.dustDuration}秒、自身の発動地点へ半径${VEIL_SKILLS.dustRadius}mの土煙を残し、双方の視界を遮る。`, max: 2, price: DUELIST.smokePrice, type: 'veil-dust', icon: 'M6 25h24M8 21a6 6 0 0 1 1-12 8 8 0 0 1 15 1 6 6 0 0 1 1 11H8M11 27v2m8-3v3m7-2v2' },
  q: { name: '根の帯', shortName: '根の帯', description: `接地中に発動。前方最大${VEIL_SKILLS.rootsRange}m・幅${VEIL_SKILLS.rootsWidth}mの地表へ${VEIL_SKILLS.rootsDuration}秒間の根を伸ばし、接地した敵の歩く速さを${VEIL_SKILLS.rootsSpeedScale*100}%にする。壁と離地で防げる。`, max: 1, price: DUELIST.updraftPrice, type: 'veil-roots', icon: 'M18 4v24M18 11l-7-5m7 10 9-6M18 21l-9-7m9 12 10-6M11 6V3m16 7V6M9 14H5m23 6h4M7 29h22' },
  e: { name: '芝走り', shortName: '芝走り', description: `接地中の自身の歩く速さを${VEIL_SKILLS.turfDuration}秒間${VEIL_SKILLS.turfSpeedScale}倍にする。離地と死亡で終了し、${VEIL_SKILLS.signatureCooldown}秒で再使用できる。`, max: 1, price: 0, type: 'veil-turf', icon: 'M3 25h30M7 25l-2-7 7 7 1-13 5 13 6-10-1 10 8-6-3 6M7 7h10m-7 5h8' },
};
const emberSkills = {
  c: { name: 'はんだ玉', shortName: 'はんだ玉', description: `最大${EMBER_SKILLS.solderRange}mへ投げ、着地${EMBER_SKILLS.solderArmDelay}秒後に一度だけ弾ける。半径${EMBER_SKILLS.solderRadius}mの敵へ最大${EMBER_SKILLS.solderDamage}ダメージ。壁と距離で防げる。`, max: 2, price: DUELIST.smokePrice, type: 'ember-solder', icon: 'M18 3c0 6-7 8-7 14a7 7 0 0 0 14 0c0-6-7-8-7-14ZM4 23l4-2m20 0 4 2M11 29l2-3m10 3-2-3' },
  q: { name: '遮光チェック', shortName: '遮光眼鏡', description: `${EMBER_SKILLS.shadeDuration}秒間、この後に受ける閃光の持続時間を${EMBER_SKILLS.shadeFlashScale*100}%へ軽減する。既に受けた閃光や煙幕には効かない。`, max: 1, price: DUELIST.updraftPrice, type: 'ember-shade', icon: 'M4 10h28v12H4ZM4 15H1m31 0h3M7 13h8v6H7Zm14 0h8v6h-8ZM15 15h6M18 2v4m-9-2 2 3m16-3-2 3' },
  e: { name: 'クイックソルダー', shortName: '銃の整備', description: `現在の銃を既存の予備弾から${EMBER_SKILLS.serviceDuration}秒でリロード。切替・死亡・設置・電源オフで中止し、${EMBER_SKILLS.signatureCooldown}秒で再使用。満弾や予備弾なしでは使わない。`, max: 1, price: 0, type: 'ember-service', icon: 'm5 27 13-13 4 4L9 31ZM18 14l8-8 4 4-8 8M25 5l4-4 6 6-4 4M6 7h9m-3-3 3 3-3 3M3 16h6' },
};
const frostSkills = {
  c: { name: '霜のステッチ', shortName: '霜の環', description: `最大${FROST_SKILLS.stitchRange}mへ投げ、着地${FROST_SKILLS.stitchArmDelay}秒後から${FROST_SKILLS.stitchDuration}秒、半径${FROST_SKILLS.stitchInnerRadius}〜${FROST_SKILLS.stitchRadius}mの円環だけで接地した敵の歩く速さを${FROST_SKILLS.stitchSpeedScale*100}%にする。中央は通常速度。`, max: 2, price: DUELIST.smokePrice, type: 'frost-stitch', icon: 'M18 3a12 12 0 1 0 0 24 12 12 0 0 0 0-24ZM18 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM18 1v4m0 20v4M3 15h4m22 0h4M7 4l3 3m16 16 3 3M29 4l-3 3M10 23l-3 3' },
  q: { name: 'ドールミスト', shortName: '人形の霧', description: `最大${FROST_SKILLS.mistRange}mへ投げ、着地から${FROST_SKILLS.mistDuration}秒、半径${FROST_SKILLS.mistRadius}mの淡い霧で敵味方双方の視界を遮る。`, max: 1, price: DUELIST.updraftPrice, type: 'frost-mist', icon: 'M7 24a7 7 0 0 1 1-14 10 10 0 0 1 18 1 7 7 0 0 1 1 14H7M9 28h18M13 14l5 5 5-5m-5-5v14' },
  e: { name: 'ほどけるリボン', shortName: '減速軽減', description: `接地中に使用。${FROST_SKILLS.unravelDuration}秒間、地表の減速分を${FROST_SKILLS.unravelSlowFraction*100}%にする。通常速度は上がらず、離地・死亡で終了。${FROST_SKILLS.signatureCooldown}秒で再使用。`, max: 1, price: 0, type: 'frost-unravel', icon: 'M18 15C9 1 1 7 7 15c4 4 8 2 11 0Zm0 0C27 1 35 7 29 15c-4 4-8 2-11 0Zm-2 2-5 11 7-3m2-8 5 11 3-6M5 22l-3 5m29-5 3 5' },
};
const carSkills={
 c:{name:'バンパーウェーブ',shortName:'押し出し',description:'Cで構え、35mの見える接地敵へ左確定・右取消。実床に沿って最大3m押し出す。壁・段差・足場の端・他の人で止まり、ダメージはない。',max:2,price:100,type:'car-bumper',icon:'M4 11h18v10H4ZM25 8l8 8-8 8M8 24v3m10-3v3'},
 q:{name:'ショールームクリア',shortName:'煙の除去',description:'Qで構え、40m以内の照準に重なる煙へ左確定・右取消。敵味方どちらの煙も一つだけ除去。壁越しや閃光中は使えない。',max:1,price:100,type:'car-wash',icon:'M5 21a7 7 0 0 1 3-13 9 9 0 0 1 17 2 6 6 0 0 1 3 11M7 28 28 5M5 28h24'},
 e:{name:'タイヤジャイロ',shortName:'移動射撃',description:'4秒、接地中だけ銃の移動による精度低下をなくす。反動・連射拡散・空中精度・速度は通常通り。18秒で再使用。',max:1,price:0,type:'car-gyro',icon:'M18 3a12 12 0 1 0 0 24 12 12 0 0 0 0-24ZM18 8v14M11 15h14M7 25l-3 4m25-4 3 4'}
};
const skillsFor = character => character==='car'?carSkills : character === 'cat' ? catSkills : character === 'duck' ? duckSkills : character === 'nope' ? nopeSkills : character === 'mend' ? mendSkills : character === 'echo' ? iagnuSkills : character === 'veil' ? veilSkills : character === 'ember' ? emberSkills : character === 'frost' ? frostSkills : baseSkills;
export const signatureCooldown = character => character==='car'?CAR_SKILLS.signatureCooldown : character === 'cat' ? CAT_SKILLS.signatureCooldown : character === 'duck' ? DUCK_SKILLS.signatureCooldown : character === 'nope' ? NOPE_SKILLS.signatureCooldown : character === 'mend' ? MEND_SKILLS.signatureCooldown : character === 'echo' ? IAGNU_SKILLS.signatureCooldown : character === 'veil' ? VEIL_SKILLS.signatureCooldown : character === 'ember' ? EMBER_SKILLS.signatureCooldown : character === 'frost' ? FROST_SKILLS.signatureCooldown : 0;
const characterSkills = Object.freeze(Object.fromEntries(Object.keys(CHARACTER_DEFS).map(character => [character,
  Object.freeze(Object.fromEntries(['c', 'q', 'e'].map(key => [key, Object.freeze({ id: `${character}-${skillsFor(character)[key].type.replace(/^(duelist|nope|mend|echo|veil|ember|frost|duck|cat|car)-/, '')}`, key, ...skillsFor(character)[key], ...(character === 'duelist' && key === 'e' ? { description: `${baseSkills.e.description} ${DUELIST.signatureKills}撃破で再使用。` } : {}) })]))),
])));
const skillKey = value => typeof value === 'string' ? value.toLowerCase().replace(/^key/, '') : '';
export function getCharacterSkill(character, key) { const skills = characterSkills[normalizeCharacter(character)], normalized = skillKey(key); return Object.hasOwn(skills, normalized) ? skills[normalized] : null; }
export function getSkillState(kit, key, now = 0) {
  const definition = getCharacterSkill(kit?.character, key); if (!definition) return null;
  const slot = definition.key, stock = slot === 'c' ? kit?.smoke : slot === 'q' ? kit?.updraft : kit?.dash;
  const count = integer(stock, definition.max), clock = Number.isFinite(now) ? now : 0;
  const armed = slot === 'e' && definition.type === 'dash' && Number.isFinite(kit?.armReadyAt) && Number.isFinite(kit?.armExpiresAt) && kit.armExpiresAt > clock;
  const charging = armed && clock < kit.armReadyAt;
  const cooldown = signatureCooldown(kit?.character);
  const remaining = slot !== 'e' ? 0 : armed ? Math.max(0, (charging ? kit.armReadyAt : kit.armExpiresAt) - clock) : cooldown ? Math.max(0, (kit?.nextSignatureAt || 0) - clock) : 0;
  const progress = slot === 'e' && cooldown ? count ? 1 : Math.max(0, Math.min(1, 1 - remaining / cooldown)) : charging ? Math.max(0, 1 - (kit.armReadyAt - clock) / DUELIST.dashArmDelay) : armed ? Math.max(0, Math.min(1, remaining / (DUELIST.dashWindow - DUELIST.dashArmDelay))) : count ? 1 : 0;
  return { count, max: definition.max, ready: count > 0 || armed && !charging, armed, charging, remaining, progress };
}
const integer = (value, max) => Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
export class DuelistKit {
  constructor({ character = 'duelist' } = {}) { this.character = normalizeCharacter(character); this.smoke = 0; this.updraft = 0; this.ultPoints = 0; this.resetRound(); }
  resetRound({ reset = false } = {}) {
    if (reset) { this.smoke = 0; this.updraft = 0; this.ultPoints = 0; }
    this.dash = 1; this.dashKills = 0; this.armReadyAt = null; this.armExpiresAt = null; this.nextSignatureAt = 0;
    this.knives = 0; this.knivesActive = false; return this.snapshot();
  }
  buy(id, spend) {
    if (typeof id !== 'string') return false;
    const name = id.toLowerCase(), c = getCharacterSkill(this.character, 'c'), q = getCharacterSkill(this.character, 'q');
    const definition = ['c', 'smoke', c.id].includes(name) ? c : ['q', 'updraft', q.id].includes(name) ? q : null;
    if (!definition || typeof spend !== 'function') return false;
    const ability = definition.key === 'c' ? 'smoke' : 'updraft', { max, price } = definition;
    if (this[ability] >= max || !spend(price)) return false;
    this[ability]++; return true;
  }
  tick(now) {
    if (!Number.isFinite(now)) return;
    if (signatureCooldown(this.character) && this.dash === 0 && this.nextSignatureAt > 0 && now >= this.nextSignatureAt) { this.dash = 1; this.nextSignatureAt = 0; }
    if (this.armExpiresAt !== null && now >= this.armExpiresAt) { this.armReadyAt = null; this.armExpiresAt = null; }
    // A last-knife kill can refill synchronously after consumeKnife, before tick.
    if (this.knivesActive && this.knives === 0) this.knivesActive = false;
  }
  activate(key, now) {
    if (!Number.isFinite(now) || now < 0) return null;
    this.tick(now);
    switch (String(key).toLowerCase().replace(/^key/, '')) {
      case 'c':
        if (this.smoke <= 0) return null;
        this.smoke--;
        if (this.character === 'car') return {type:'car-bumper'};
        if (this.character === 'cat') return {type:'cat-bookmark'};
        if (this.character === 'duck') return {type:'duck-seal'};
        if (this.character === 'mend') return { type: 'mend-seeds', flight: MEND_SKILLS.seedsFlight, duration: MEND_SKILLS.seedsDuration, radius: MEND_SKILLS.seedsRadius, speedScale: MEND_SKILLS.seedsSpeedScale };
        if (this.character === 'echo') return { type: 'echo-tag', flight: IAGNU_SKILLS.tagFlight, armDelay: IAGNU_SKILLS.tagArmDelay, duration: IAGNU_SKILLS.tagDuration, radius: IAGNU_SKILLS.tagRadius, range: IAGNU_SKILLS.tagRange, revealDuration: IAGNU_SKILLS.tagRevealDuration };
        if (this.character === 'veil') return { type: 'veil-dust', armDelay: VEIL_SKILLS.dustArmDelay, duration: VEIL_SKILLS.dustDuration, radius: VEIL_SKILLS.dustRadius };
        if (this.character === 'ember') return { type: 'ember-solder', flight: EMBER_SKILLS.solderFlight, armDelay: EMBER_SKILLS.solderArmDelay, radius: EMBER_SKILLS.solderRadius, range: EMBER_SKILLS.solderRange, maxDamage: EMBER_SKILLS.solderDamage };
        if (this.character === 'frost') return { type: 'frost-stitch', flight: FROST_SKILLS.stitchFlight, armDelay: FROST_SKILLS.stitchArmDelay, duration: FROST_SKILLS.stitchDuration, radius: FROST_SKILLS.stitchRadius, innerRadius: FROST_SKILLS.stitchInnerRadius, range: FROST_SKILLS.stitchRange, speedScale: FROST_SKILLS.stitchSpeedScale };
        return this.character === 'nope' ? { type: 'nope-bottle', fuse: NOPE_SKILLS.bottleFuse, flight: NOPE_SKILLS.bottleFlight, radius: NOPE_SKILLS.bottleRadius, maxDamage: NOPE_SKILLS.bottleDamage } : { type: 'duelist-comet', flight: DUELIST_SKILLS.cometFlight, duration: DUELIST_SKILLS.cometDuration, radius: DUELIST_SKILLS.cometRadius, range: DUELIST_SKILLS.cometRange };
      case 'q':
        if (this.updraft <= 0) return null;
        this.updraft--;
        if (this.character === 'car') return {type:'car-wash'};
        if (this.character === 'cat') return {type:'cat-pluck'};
        if (this.character === 'duck') return {type:'duck-shield'};
        if (this.character === 'mend') return { type: 'mend-pollen', flight: MEND_SKILLS.pollenFlight, duration: MEND_SKILLS.pollenDuration, radius: MEND_SKILLS.pollenRadius };
        if (this.character === 'echo') return { type: 'echo-glint', flight: IAGNU_SKILLS.glintFlight, radius: IAGNU_SKILLS.glintRadius, duration: IAGNU_SKILLS.glintDuration };
        if (this.character === 'veil') return { type: 'veil-roots', armDelay: VEIL_SKILLS.rootsArmDelay, duration: VEIL_SKILLS.rootsDuration, range: VEIL_SKILLS.rootsRange, width: VEIL_SKILLS.rootsWidth, speedScale: VEIL_SKILLS.rootsSpeedScale };
        if (this.character === 'ember') return { type: 'ember-shade', duration: EMBER_SKILLS.shadeDuration, flashScale: EMBER_SKILLS.shadeFlashScale };
        if (this.character === 'frost') return { type: 'frost-mist', flight: FROST_SKILLS.mistFlight, duration: FROST_SKILLS.mistDuration, radius: FROST_SKILLS.mistRadius, range: FROST_SKILLS.mistRange };
        return this.character === 'nope' ? { type: 'nope-flash', flight: NOPE_SKILLS.flashFlight, radius: NOPE_SKILLS.flashRadius, duration: NOPE_SKILLS.flashDuration } : { type: 'duelist-lift', velocity: DUELIST.updraftVelocity, duration: DUELIST_SKILLS.liftVisualDuration };
      case 'e':
        if (signatureCooldown(this.character)) {
          if (this.dash <= 0) return null;
          this.dash = 0; this.dashKills = 0; this.nextSignatureAt = now + signatureCooldown(this.character);
          if (this.character === 'car') return {type:'car-gyro'};
        if (this.character === 'cat') return {type:'cat-fetch'};
          if (this.character === 'duck') return {type:'duck-hush'};
          if (this.character === 'echo') return { type: 'echo-kerning', duration: IAGNU_SKILLS.kerningDuration, speedScale: IAGNU_SKILLS.kerningSpeedScale, cooldown: IAGNU_SKILLS.signatureCooldown };
          if (this.character === 'veil') return { type: 'veil-turf', duration: VEIL_SKILLS.turfDuration, speedScale: VEIL_SKILLS.turfSpeedScale, cooldown: VEIL_SKILLS.signatureCooldown };
          if (this.character === 'ember') return { type: 'ember-service', duration: EMBER_SKILLS.serviceDuration, cooldown: EMBER_SKILLS.signatureCooldown };
          if (this.character === 'frost') return { type: 'frost-unravel', duration: FROST_SKILLS.unravelDuration, slowFraction: FROST_SKILLS.unravelSlowFraction, cooldown: FROST_SKILLS.signatureCooldown };
          return this.character === 'mend' ? { type: 'mend-heal', healing: MEND_SKILLS.healAmount, radius: MEND_SKILLS.healRange, cooldown: MEND_SKILLS.signatureCooldown } : { type: 'nope-decoy', duration: NOPE_SKILLS.decoyDuration, cooldown: NOPE_SKILLS.signatureCooldown };
        }
        if (this.armExpiresAt !== null) {
          if (now < this.armReadyAt) return null;
          this.armReadyAt = null; this.armExpiresAt = null;
          return { type: 'dash', distance: DUELIST.dashDistance, duration: DUELIST.dashDuration };
        }
        if (this.dash <= 0) return null;
        this.dash--; this.dashKills = 0;
        this.armReadyAt = now + DUELIST.dashArmDelay; this.armExpiresAt = now + DUELIST.dashWindow;
        return { type: 'dash-armed', readyAt: this.armReadyAt, expiresAt: this.armExpiresAt };
      case 'x':
        if (this.knivesActive || this.ultPoints < DUELIST.ultimatePoints) return null;
        if (this.character === 'car') {this.ultPoints-=DUELIST.ultimatePoints;return {type:'car-pit'};}
        if (this.character === 'cat') {this.ultPoints-=DUELIST.ultimatePoints;return {type:'cat-clock'};}
        if (this.character === 'duck') { this.ultPoints -= DUELIST.ultimatePoints; return {type:'duck-egg'}; }
        if (this.character === 'nope') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'nope', duration: 12 }; }
        if (this.character === 'mend') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'mend', radius: 18, healing: 75 }; }
        if (this.character === 'echo') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'recon', radius: 30, duration: 6, pulses: 3, interval: 2, revealDuration: 1.25 }; }
        if (this.character === 'veil') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'veil', radius: 9, duration: 12 }; }
        if (this.character === 'ember') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'ember', radius: 6, duration: 4.8, pulses: [1.2, 2.4, 3.6], damage: 30 }; }
        if (this.character === 'frost') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'frost', radius: 7, duration: 10, warmup: .8, slowMultiplier: .55 }; }
        this.ultPoints -= DUELIST.ultimatePoints; this.knives = DUELIST.knives; this.knivesActive = true;
        return { type: 'knives', count: this.knives };
      default: return null;
    }
  }
  consumeKnife() { if (!this.knivesActive || this.knives <= 0) return false; this.knives--; return true; }
  awardKill() {
    this.awardPoint();
    if (this.character === 'duelist' && this.dash === 0 && ++this.dashKills >= DUELIST.signatureKills) { this.dash = 1; this.dashKills = 0; }
    if (this.knivesActive) this.knives = DUELIST.knives;
  }
  awardPoint() { this.ultPoints = Math.min(DUELIST.ultimatePoints, this.ultPoints + 1); }
  snapshot() { return { character: this.character, smoke: this.smoke, updraft: this.updraft, dash: this.dash, ultPoints: this.ultPoints,
    knives: this.knives, knivesActive: this.knivesActive, armReadyAt: this.armReadyAt, armExpiresAt: this.armExpiresAt, dashKills: this.dashKills, nextSignatureAt: this.nextSignatureAt }; }
  restore(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    this.character = normalizeCharacter(value.character);
    this.smoke = integer(value.smoke, getCharacterSkill(this.character, 'c').max); this.updraft = integer(value.updraft, getCharacterSkill(this.character, 'q').max);
    this.dash = integer(value.dash, 1); this.dashKills = integer(value.dashKills, DUELIST.signatureKills - 1);
    this.ultPoints = integer(value.ultPoints, DUELIST.ultimatePoints); this.knives = integer(value.knives, DUELIST.knives);
    this.knivesActive = this.character === 'duelist' && value.knivesActive === true; if (!this.knivesActive) this.knives = 0;
    const validArm = !signatureCooldown(this.character) && Number.isFinite(value.armReadyAt) && Number.isFinite(value.armExpiresAt) && value.armReadyAt >= 0
      && value.armExpiresAt > value.armReadyAt && value.armExpiresAt - value.armReadyAt <= DUELIST.dashWindow;
    this.armReadyAt = validArm ? value.armReadyAt : null; this.armExpiresAt = validArm ? value.armExpiresAt : null;
    this.nextSignatureAt = signatureCooldown(this.character) && this.dash === 0 && Number.isFinite(value.nextSignatureAt) && value.nextSignatureAt > 0 ? value.nextSignatureAt : 0;
    if (this.character !== 'duelist') this.dashKills = 0;
    return true;
  }
}
