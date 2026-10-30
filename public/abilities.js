import { URCHIN_DISARM } from './urchin-disarm.js';
import { URCHIN_LANCE } from './urchin-rift.js';
import { ROOT_SENSOR } from './root-sensor.js';
export const ONNARA_SKILLS=Object.freeze({jumpVelocity:12,jumpDuration:1.6,taxRange:40,taxDuration:8,taxPerShot:30,taxBudget:300,taxHealthPerShot:4,orbRange:40,orbDuration:8,orbCameraDuration:15,orbSpeed:12,orbRadius:.19,hoverDuration:13,signatureCooldown:18,chainDuration:8,chainRange:12,chainScale:.7});
export const URCHIN_SKILLS=Object.freeze({jamRange:40,jamDuration:8,lanceRange:URCHIN_LANCE.range,lanceDelay:URCHIN_LANCE.telegraph,lanceTail:URCHIN_LANCE.residualDuration,lanceRadius:URCHIN_LANCE.width/2,lanceDamage:URCHIN_LANCE.damage,disarmRange:URCHIN_DISARM.range,gloomRange:36,gloomSpeed:24,gloomDelay:.25,gloomRadius:2,gloomDuration:3,gloomSight:8,tridentDuration:13,tridentFireRate:1.5,tridentAngle:Math.PI/45,tridentScale:.65,tridentRange:90,signatureCooldown:18});
export const CAP_SKILLS=Object.freeze({lockRange:40,lockDuration:8,lockSpread:.07,lockAimScale:.55,cleanRange:24,bounceDuration:6,bounceScale:.75,bounceRange:90,bounceCount:3,magazineDuration:9,signatureCooldown:22});
// Original fan-made tuning inspired by the duelist role; not an exact live-game ruleset.
import { TEAM_ABILITIES } from './team-abilities.js';

export const RENKO_SKILLS=Object.freeze({dartSpeed:80,dartRadius:.91,launchSpeed:24,launchDuration:1,launchLift:6,driveDuration:6,driveJumpScale:1.3,runSpeed:14.4,slideStart:19.2,slideEnd:12,slideDuration:1,slideTurn:Math.PI/3,flightDuration:1,flightSpeed:16,verticalSpeed:8,flightHeight:10,signatureCooldown:0,signatureKills:2});
export const CHARACTER_DEFS = Object.freeze({
  duelist: Object.freeze({ id: 'duelist', label: 'ちぬつてのとのへめほ', role: '突入', ultName: 'ブレードストーム', ultShortName: 'ナイフ', ultimatePoints: 7,
    description: 'C：空中に短い流れ星の幕 / Q：アンテナリフトで上昇 / E：2段階のダッシュ。X：ナイフ5本。左クリックで1本、右クリックで残り最大5本を同時に散開投擲。撃破で5本補充（7pt）。', color: '#a7e3e7', ultIcon: 'm24 3 5 2-13 17-6 4 1-7L24 3M11 19l5 3M9 23l-4 5M22 7l4 3M4 7l4-3m21 18 4 2' }),
  nope: Object.freeze({ id: 'nope', label: 'NOPE', role: '特殊', ultName: 'ノープ・テイクオーバー', ultShortName: 'ノープ', ultimatePoints: 7,
    description: 'C：瓶グレネード / Q：顔フラッシュ / E：銃を持って通常移動と同じ速さで歩く囮。撃たれると閃光。X：室内にもロゴを貼り、囮30体を発動時・5秒後・10秒後に生成。各12秒（7pt）。', color: '#d7a8f1', ultIcon: 'M7 25V5l22 20V5M7 5l22 20M14 5h7M15 25h7' }),
  mend: Object.freeze({ id: 'mend', label: '丱凵してね', role: '支援', ultName: 'リカバリーウェーブ', ultShortName: '回復', ultimatePoints: 7,
    description: 'C：足止めの種 / Q：花粉の煙幕 / E：単体60回復。X：視線内18mの生存味方と自身を最大75回復（7pt）。', color: '#8fe2b5', ultIcon: 'M13 3h10v7h8v10h-8v7H13v-7H5V10h8Z' }),
  echo: Object.freeze({ id: 'echo', label: 'IAGNU', role: '索敵', ultName: 'リコンパルス', ultShortName: '索敵', ultimatePoints: 7,
    description: `C：一度だけ侵入を知らせる金文字 / Q：反射閃光 / E：短い移動補助。X：半径${TEAM_ABILITIES.reconRadius}m内を3回索敵、検知地点を短時間表示（7pt）。`, color: '#d3c785', ultIcon: 'M18 3a12 12 0 1 0 12 12M18 8a7 7 0 1 0 7 7M18 15 29 4M23 4h6v6M18 14v2' }),
  veil: Object.freeze({ id: 'veil', label: '草ブロック', role: '制圧', ultName: 'ブラックアウトドーム', ultShortName: 'ドーム', ultimatePoints: 7,
    description: 'C：煙幕3個。マップで最大3地点を選び右クリックで一括設置 / Q：半径5mのルートセンサー。侵入音・根で索敵、移動と跳躍を妨害 / E：接地中の芝走り。X：マップで1地点を選び設置。半径9m・12秒（7pt）。C・Xは高い床を優先し、地面から6m超の屋根は避ける。高さは変更可。', color: '#b0abd8', ultIcon: 'M4 24a14 14 0 0 1 28 0M3 24h30M9 24v-8m18 8v-8M18 6V3' }),
  ember: Object.freeze({ id: 'ember', label: 'はんだごて握り太郎', role: '攻撃', ultName: 'フレアストライク', ultShortName: '爆撃', ultimatePoints: 7,
    description: 'C：小さく弾けるはんだ玉 / Q：新しい閃光を軽減する遮光眼鏡 / E：予備弾で素早く整備。X：半径6m・80ダメージ×3回の爆撃（通常装甲・7pt）。', color: '#eaa36f', ultIcon: 'M18 2v5m0 16v5M2 15h5m22 0h5M8 5l4 4m12 12 4 4M28 5l-4 4M12 21l-4 4M18 8l3 5 5 2-5 2-3 5-3-5-5-2 5-2Z' }),
  frost: Object.freeze({ id: 'frost', label: '尾野', role: '守備', ultName: 'クライオフィールド', ultShortName: '足止め', ultimatePoints: 7,
    description: 'C：円環の霜のステッチ / Q：遠くのドールミスト / E：低い姿勢で滑り込み、減速にも耐える。X：最大20m先に半径7mの減速場を10秒展開（7pt）。', color: '#96dce5', ultIcon: 'M18 2v26M6 8l24 14M6 22 30 8M14 5l4 4 4-4M14 25l4-4 4 4M6 13l6-1-1-6M30 17l-6 1 1 6M6 17l6 1-1 6M30 13l-6-1 1-6' }),
  duck: Object.freeze({ id:'duck', label:'🦆', role:'跳躍・防護', ultName:'不屈の卵', ultShortName:'卵', ultimatePoints:7,
    description:'C：全員が跳べる羽根床を設置 / Q：弾だけを止める羽盾 / E：10秒スペース連打で飛行、最初の5秒は消音。X：8秒、致死攻撃を2回までHP1で耐える（7pt）。', color:'#77b34c', ultIcon:'M18 2C9 2 5 16 5 21a13 9 0 0 0 26 0C31 16 27 2 18 2Zm-2 10 5 5-5 4 4 5' }),
  cat: Object.freeze({id:'cat',label:'猫の画像',role:'回収・時制',ultName:'白紙の8秒',ultShortName:'時止め',ultimatePoints:7,description:'C：保存地点へ帰還 / Q：敵の装填弾を最大5発裂き、1発12・最大60ダメージ / E：落ちた銃を遠隔回収。X：8秒、ラウンドとボンバーの時計を止める。行動と電源オフは進む（7pt）。',color:'#eee8dd',ultIcon:'M18 3a12 12 0 1 0 0 24 12 12 0 0 0 0-24ZM14 9v12m8-12v12'}),
  car: Object.freeze({id:'car',label:'トミカ',role:'排除・補給',ultName:'ピットクルー',ultShortName:'補給',ultimatePoints:7,description:'C：本体突進で75ダメージ＋最大24m吹き飛ばし / Q：狙った煙を一つ除去 / E：接地中の移動射撃を安定化。X：視線内24mの味方と自身のC/Q/Eを補給（7pt）。',color:'#e9ece8',ultIcon:'M4 23h28V10H4ZM8 14h8v5H8Zm12 0h8v5h-8ZM12 4v4m12-4v4M9 25v4m18-4v4'}),
  nobi:Object.freeze({id:'nobi',label:'のび',role:'弱点・工作',ultName:'逆転えり',ultShortName:'逆転',ultimatePoints:7,description:'4技とも構えて左クリックで投擲、右クリックで取消。C35m・Q40m・E/X35m。着地点の半径20mでCは敵の被銃撃1.35倍6秒、Qは敵の射撃間隔1.6倍5秒、Eは味方の作業1.5倍6秒。X：着地から8秒、自身と味方の胴・脚への銃撃も頭相当。壁・煙越し無効、範囲外は通常。X7ポイント。',color:'#f3cb48',ultIcon:'M18 3 3 13l15 15 15-15ZM10 13l8 8 8-8M18 3v11'}),
  japan:Object.freeze({id:'japan',label:'しばくでジャパン',role:'国境・総動員',ultName:'総動員',ultShortName:'総動員',ultimatePoints:7,description:'C：越えた敵へ国境線 / Q：敵の装甲を接収 / E：被銃撃を撃ち手へ返送。X：倒れた味方全員を開始地点へ10HPで呼び戻す（7pt）。',color:'#e8ca91',ultIcon:'M3 15h30M18 2v26M7 4l22 22M29 4 7 26M4 23h28'}),
  cap:Object.freeze({id:'cap',label:'キャップは？',role:'光学・投擲',ultName:'エンドレスマガジン',ultShortName:'無消費',ultimatePoints:7,description:'全技を投擲。C：着弾周囲の照準を妨害 / Q：右クリックで回復A・ダメージBを切替、7子弾に分裂 / E：味方に6秒の跳弾 / X：味方に9秒の弾数無消費（7pt）。命中敵を本人に3秒透過表示。',color:'#e36336',ultIcon:'M5 7h26v16H5ZM12 11c-8 0-8 8 0 8s4-8 12-8 8 8 0 8-4-8-12-8'}),
  urchin:Object.freeze({id:'urchin',label:'青ウニ',role:'棘・弾道',ultName:'三叉潮',ultShortName:'三叉',ultimatePoints:7,description:'C：直線水流と2.5秒の通路監視 / Q：敵の購入主武器を床へ落とす / E：壁を抜ける潮の波で遠くの視界を奪う。X：13秒、銃弾が三方向へ分かれ、連射速度が1.5倍（7pt）。',color:'#a9f1e4',ultIcon:'M18 28V4M18 20 5 7M18 20 31 7M2 11 5 7 9 8M27 8 31 7 34 11M14 8 18 4 22 8'}),
  onnara:Object.freeze({id:'onnara',label:'おんなら',role:'星冠・裁定',ultName:'星座裁定',ultShortName:'連鎖',ultimatePoints:7,description:'C：その場から約4.8mの大ジャンプ / Q：遠方を360度見回す宝玉 / E：空中で13秒静止し単発弾のブレをなくす。X：8秒、銃撃した敵から別の敵1人へ実被害の70%を連鎖（7pt）。',color:'#ffc948',ultIcon:'M18 2 22 11 32 12 24 19 27 29 18 23 9 29 12 19 4 12 14 11Z'}),
  renko:Object.freeze({id:'renko',label:'蓮子',role:'機動・押し出し',ultName:'リスタートラッシュ',ultShortName:'リスタート',ultimatePoints:7,description:'C：即発射の壁貫通・大型吹き飛ばし弾（ダメージなし） / Q：6秒14.4m毎秒走行、ジャンプ力1.3倍、Vで慣性滑走。高速移動中は素手、C使用可 / E：最大1秒、長押し中はマウス方向へジェット飛行。飛行中は素手でCのみ発射可能、終了時に武器へ。使用後に敵2キルでE回復。X中は単発銃のブレなし。X：7ptでラウンド中、敵撃破ごとにC・Q・E全回復（死亡で終了）。',color:'#91c5ef',ultIcon:'M8 27V12L18 3l10 9v15M10 19h16M13 30l5-7 5 7'}),
});
export const getCharacterUltimate = character => { const id=normalizeCharacter(character),def=CHARACTER_DEFS[id]; return {key:'x',name:def.ultName,shortName:def.ultShortName,description:def.description.split('X：')[1]||'',points:def.ultimatePoints,icon:def.ultIcon}; };
export const normalizeCharacter = value => typeof value === 'string' && Object.hasOwn(CHARACTER_DEFS, value) ? value : 'duelist';
export const DUELIST = Object.freeze({ smokeMax: 2, smokePrice: 100, smokeDuration: 5,
  updraftMax: 2, updraftPrice: 100, updraftVelocity: 7.8,
  dashArmDelay: .25, dashWindow: 12, dashDistance: 12, dashDuration: .18,
  signatureKills: 1, ultimatePoints: 7, knives: 5 });
export const DUELIST_SKILLS = Object.freeze({ cometRange: 18, cometFlight: .25, cometRadius: 2.8, cometDuration: 5, liftVisualDuration: .45 });
export const NOPE_SKILLS = Object.freeze({ bottleFuse: 1, bottleFlight: .55, bottleRadius: 8, bottleDamage: 90, bottleRange: 40,
  flashFlight: .45, flashRadius: 30, flashDuration: 2.4, decoyDuration: 12, decoyWaveCount: 3, decoyWaveInterval: 5, signatureCooldown: 15, decoyWalkSpeed: 5.4*1.15, decoyWalkRange: 75 });
export const MEND_SKILLS = Object.freeze({ seedsFlight: .65, seedsRadius: 4.5, seedsDuration: 9, seedsSpeedScale: .5, seedsGroundOffset: .12,
  pollenFlight: .55, pollenRadius: 4.2, pollenDuration: 9, healAmount: 60, healRange: 18, healVisualDuration: .8, signatureCooldown: 18 });
export const IAGNU_SKILLS = Object.freeze({ tagFlight: .55, tagArmDelay: .5, tagDuration: 12, tagRadius: 4.5, tagRange: 18,
  tagRevealDuration: 2.5, tagGroundOffset: .12, glintFlight: .5, glintRadius: 10, glintDuration: 2, glintEyeOffset: 1.6,
  kerningDuration: 4, kerningSpeedScale: 1.35, signatureCooldown: 18 });
export const VEIL_SKILLS = Object.freeze({ dustMax: 3, mapFloorHeight: 6, dustArmDelay: .2, dustRadius: 3.5, dustDuration: 7, dustCenterOffset: 1.25,
  rootsRange: 10, rootsMinRange: .5, rootsWidth: 3.2, rootsThrowRange:20, rootsThrowWidth:6.4, rootsThrowLength:10, rootsThrowFlight:.6, rootsGroundOffset:.12, rootsArmDelay: .25, rootsDuration: 8, rootsSpeedScale: .45, rootsHeightTolerance: .45,
  turfDuration: 3, turfSpeedScale: 1.5, signatureCooldown: 15, decoyWalkSpeed: 3, decoyWalkRange: 36 });
// Shared landing strip for physics, BOT forecasts and the visible roots.
export function veilRootSegment(event){
 if(event?.type!=='veil-root-seed')return event;
 const dx=event.x-event.fromX,dz=event.z-event.fromZ,length=Math.hypot(dx,dz),ux=length>1e-8?dx/length:0,uz=length>1e-8?dz/length:-1,half=VEIL_SKILLS.rootsThrowLength/2,y=event.y-VEIL_SKILLS.rootsGroundOffset;
 return {...event,fromX:event.x-ux*half,fromY:y,fromZ:event.z-uz*half,x:event.x+ux*half,y,z:event.z+uz*half};
}
export const EMBER_SKILLS = Object.freeze({ solderRange: 18, solderFlight: .45, solderArmDelay: .2, solderRadius: 3.2,
  solderDamage: 75, solderTail: .35, solderGroundOffset: .12, shadeDuration: 8, shadeFlashScale: .15,
  serviceDuration: .8, signatureCooldown: 18 });
export const FROST_SKILLS = Object.freeze({ stitchRange: 16, stitchFlight: .55, stitchArmDelay: .25, stitchDuration: 8,
  stitchRadius: 3.8, stitchInnerRadius: .9, stitchSpeedScale: .45, stitchGroundOffset: .12, stitchHeightTolerance: .45,
  mistRange: 18, mistFlight: .5, mistDuration: 9, mistRadius: 3.5, mistCenterOffset: 1.4,
  unravelDuration: 5, unravelSlowFraction: .15, slideDuration: .9, slideStartSpeed: 12, slideEndSpeed: 7, signatureCooldown: 18 });
export const JAPAN_SKILLS=Object.freeze({borderRange:40,borderWidth:10,borderHeight:2.8,borderArm:1,borderDuration:14,borderDamage:1000,levyRange:40,levyAmount:50,levyScale:10,armorCap:500,returnDuration:5,returnScale:6.5,signatureCooldown:20,musterDuration:1,musterHP:10});
export const NOBI_SKILLS=Object.freeze({areaRadius:20,throwFlight:.6,toolRange:35,legendRange:35,tagRange:35,tagDuration:6,vulnerability:1.35,brakeRange:40,brakeDuration:5,fireIntervalScale:1.6,toolDuration:6,toolScale:1.5,signatureCooldown:18,legendDuration:8});
export const CAR_SKILLS=Object.freeze({bumperRange:52.5,bumperDistance:24,bumperSpeed:26,bumperDamage:100,bumperStunTime:5,bumperLaunchTime:1,bumperLift:6,washRange:40,gyroDuration:4,signatureCooldown:18,pitRange:24});
export const CAT_SKILLS=Object.freeze({bookmarkDuration:10,returnRange:24,pluckRange:30,pluckAmmo:5,pluckDamagePerRound:12,fetchRange:18,signatureCooldown:18,clockDuration:8});
export const DUCK_SKILLS = Object.freeze({ sealRange:40, sealDuration:4, padRange:28, padRadius:2, padArm:.25, padDuration:8, padVelocity:11, shieldRange:28, shieldDuration:6, shieldHP:180, shieldWidth:3, shieldHeight:2.4, hushDuration:5, flightDuration:10, flapVelocity:5.8, flapInterval:.18, flightHeight:8, signatureCooldown:20, eggDuration:8, eggLives:2 });
const catSkills={
 c:{name:'白いしおり',shortName:'帰還',description:'接地中に場所を記録。10秒以内にCを再押しで24m以内の記録地点へ戻る。HP・弾は戻らず、着地先が塞がると不発。初回だけ回数消費。',max:2,price:100,type:'cat-bookmark',icon:'M10 3h16v26l-8-6-8 6ZM14 9h8m-8 5h8'},
 q:{name:'ひげの弾裂き',shortName:'弾裂き',description:'Qで構え、30mの視線内敵へ左確定・右取消。現在の銃から最大5発を裂き、実際に抜いた1発につき12ダメージ（最大60・装甲あり）。予備弾は残る。空・装填中・ナイフには無効。',max:1,price:100,type:'cat-pluck',icon:'M8 7h6v18H8Zm14 0h6v18h-6ZM3 16h5m20 0h5M16 12l4 8'},
 e:{name:'ねこの手',shortName:'銃回収',description:'Eで構え、18mの見える落ちた銃へ左確定・右取消。銃を回収し前の同枠装備は足元へ落とす。弾は生成せず、18秒で再使用。',max:1,price:0,type:'cat-fetch',icon:'M7 26V14l5 7V5h5v13V3h5v16l4-8 4 2-4 15Z'},
};
const duckSkills = {
 c:{name:'羽根の跳び床',shortName:'跳び床',description:'Cで構え、28mの見える床へ左確定・右取消。0.25秒後から8秒、半径2mの羽根床に乗ると約4m跳躍。跳躍中の銃弾は照準どおり（ショットガンの散弾は通常幅）。自分・味方・敵が再利用でき、天井で止まる。',max:2,price:100,type:'duck-pad',icon:'M8 25 28 5M12 9l8 8M9 13l7 7M17 6l8 8M5 27l4-1'},
 q:{name:'浮き羽の盾',shortName:'羽盾',description:'Qで構え、28m以内の床へ左クリック設置・右クリック取消。6秒・180耐久の羽盾。両軍の弾を止め、視線・歩行・近接は通す。',max:1,price:100,type:'duck-shield',icon:'M18 3 5 8v9c0 8 13 12 13 12s13-4 13-12V8ZM18 8v16M10 12l8 4 8-4'},
 e:{name:'忍びガモ',shortName:'羽ばたき',description:'10秒、スペースを押すたび空中で羽ばたく。連打で上昇・維持、離すと落下。発動地点から最大8m。飛行中の銃弾は照準どおり（ショットガンの散弾は通常幅）。最初の5秒は足音・着地音なし。銃声は消えない。20秒で再使用。',max:1,price:0,type:'duck-hush',icon:'M18 24V10m-5 5 5-6 5 6M16 19 3 9l3 13 10 5m4-8L33 9l-3 13-10 5'},
};
const baseSkills = {
  c: { name: '流れ星の幕', shortName: '星幕', description: `視線方向の空中${DUELIST_SKILLS.cometRange}m以内へゆっくり山なりに投げ、到達から${DUELIST_SKILLS.cometDuration}秒、半径${DUELIST_SKILLS.cometRadius}mの星幕で敵味方双方の視界を遮る。`, max: DUELIST.smokeMax, price: DUELIST.smokePrice, type: 'duelist-comet', icon: 'm20 3 3 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1ZM3 25l7-5M2 19l6-3m-2-6 4-1' },
  q: { name: 'アンテナリフト', shortName: '上昇', description: `上向き速度${DUELIST.updraftVelocity}で跳び上がる。${DUELIST.updraftMax}回まで所持でき、空中でも使用可能。横方向の加速や滑空は付かない。`, max: DUELIST.updraftMax, price: DUELIST.updraftPrice, type: 'duelist-lift', icon: 'm10 14 8-9 8 9M18 6v17M7 21l11 6 11-6M5 26l13 3 13-3M9 3 7 0m20 3 2-3' },
  e: { name: 'テイルウィンド', shortName: 'ダッシュ', description: `Eで準備し、${DUELIST.dashArmDelay}秒後から再Eで${DUELIST.dashDistance}m移動。準備開始から${DUELIST.dashWindow}秒以内に使う。`, max: 1, price: 0, type: 'dash', icon: 'm14 5-8 10h12l-6 10L31 10H18l4-5' },
};
const nopeSkills = {
  c: { name: 'NOPEボトル', shortName: '瓶', description: `最大${NOPE_SKILLS.bottleRange}mへ投げ、着地時（投げてから最低${NOPE_SKILLS.bottleFuse}秒）に半径${NOPE_SKILLS.bottleRadius}mで爆発。敵へ最大${NOPE_SKILLS.bottleDamage}ダメージ、壁と距離で防げる。`, max: 2, price: DUELIST.smokePrice, type: 'nope-bottle', icon: 'M14 3h8v5l3 5v13H11V13l3-5ZM14 3v5h8M11 16h14M15 19l6 4m0-4-6 4' },
  q: { name: 'NOPEフェイスフラッシュ', shortName: '顔閃光', description: `半径${NOPE_SKILLS.flashRadius}m内で正面から顔が見えると最大${NOPE_SKILLS.flashDuration}秒まぶしくなる。味方と自身にも有効。`, max: 1, price: DUELIST.updraftPrice, type: 'nope-flash', icon: 'M18 2v4M3 15h4m22 0h4M7 4l3 3m16 16 3 3M29 4l-3 3M9 10l5 5m0-5-5 5m13-5 5 5m0-5-5 5M11 21q7 7 14 0' },
  e: { name: 'NOPEボディデコイ', shortName: '全身の囮', description: `ライフルを構え、最大${NOPE_SKILLS.decoyDuration}秒前進する全身の囮。壁や段差の前で止まる。敵が撃つと壊れ、半径${NOPE_SKILLS.flashRadius}m内でこちらを見る敵へ最大${NOPE_SKILLS.flashDuration}秒の閃光。味方の弾は無反応。${NOPE_SKILLS.signatureCooldown}秒で再使用。`, max: 1, price: 0, type: 'nope-decoy', icon: 'M5 8h20v16H5ZM10 12l4 4m0-4-4 4m8-4 4 4m0-4-4 4M10 20q6 4 11 0M28 9q7 7 0 14' },
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
  c: { name: '土煙', shortName: '土煙', description: `最大${VEIL_SKILLS.dustMax}個所持。マップを左クリックで最大${VEIL_SKILLS.dustMax}地点選択→右クリックで同時設置。接地中に発動。${VEIL_SKILLS.dustArmDelay}秒後から${VEIL_SKILLS.dustDuration}秒、半径${VEIL_SKILLS.dustRadius}mの土煙で双方の視界を遮る。高さは地面から${VEIL_SKILLS.mapFloorHeight}m以下の高い床を優先し、屋根は避ける。`, max: VEIL_SKILLS.dustMax, price: DUELIST.smokePrice, type: 'veil-dust', icon: 'M6 25h24M8 21a6 6 0 0 1 1-12 8 8 0 0 1 15 1 6 6 0 0 1 1 11H8M11 27v2m8-3v3m7-2v2' },
  q: { name: 'ルートセンサー', shortName: 'ルートセンサー', description: 'Qで構え、左クリックで最大20m先へ投擲。着地で半径5m・7秒の根を展開。敵の移動速度を40%低下、通常ジャンプ高度を半減。侵入音は味方全員へ。根が足元を追い、脱出後は最後の地点に1.5秒残る。根は見通せる場所だけ見え、敵の輪郭・拘束・ダメージはなし。射撃・スキルは使用可能。右クリックで取消。', max: 1, price: DUELIST.updraftPrice, type: 'veil-sensor', icon: 'M18 4v24M18 11l-7-5m7 10 9-6M18 21l-9-7m9 12 10-6M11 6V3m16 7V6M9 14H5m23 6h4M7 29h22' },
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
  e: { name: 'リボンスライド', shortName: '滑走', description: `接地中に使用。移動入力で${FROST_SKILLS.slideDuration}秒の低姿勢スライド（${FROST_SKILLS.slideStartSpeed}→${FROST_SKILLS.slideEndSpeed}m/秒）。足音あり。${FROST_SKILLS.unravelDuration}秒間は地表の減速分を${FROST_SKILLS.unravelSlowFraction*100}%へ軽減。壁を抜けず、離地・死亡で終了。${FROST_SKILLS.signatureCooldown}秒で再使用。`, max: 1, price: 0, type: 'frost-unravel', icon: 'M18 15C9 1 1 7 7 15c4 4 8 2 11 0Zm0 0C27 1 35 7 29 15c-4 4-8 2-11 0Zm-2 2-5 11 7-3m2-8 5 11 3-6M5 22l-3 5m29-5 3 5' },
};
const carSkills={
 c:{name:'バンパーウェーブ',shortName:'突進',description:'Cで構え、52.5mの見える接地敵へ左確定・右取消。本体が26m/秒で直進し、接触で100ダメージ＋最大24mの放物線吹き飛ばし。命中から5秒スタン（移動・射撃・スキル・設置/解除不可）。壁で停止。相手が避けると外れる。',max:2,price:100,type:'car-bumper',icon:'M4 11h18v10H4ZM25 8l8 8-8 8M8 24v3m10-3v3'},
 q:{name:'ショールームクリア',shortName:'煙の除去',description:'Qで構え、40m以内の照準に重なる煙へ左確定・右取消。敵味方どちらの煙も一つだけ除去。壁越しや閃光中は使えない。',max:1,price:100,type:'car-wash',icon:'M5 21a7 7 0 0 1 3-13 9 9 0 0 1 17 2 6 6 0 0 1 3 11M7 28 28 5M5 28h24'},
 e:{name:'タイヤジャイロ',shortName:'移動射撃',description:'4秒、接地中だけ銃の移動による精度低下をなくす。反動・連射拡散・空中精度・速度は通常通り。18秒で再使用。',max:1,price:0,type:'car-gyro',icon:'M18 3a12 12 0 1 0 0 24 12 12 0 0 0 0-24ZM18 8v14M11 15h14M7 25l-3 4m25-4 3 4'}
};
const urchinSkills={
 c:{name:'潮割り',shortName:'水流と裂け目',description:'Cで構え、照準方向へ左確定・右取消。40mの固定射線を0.65秒予告し、幅1.3mの水流を一斉噴出。線上の敵へ80ダメージ（装甲あり）。地面に2.5秒の裂け目を残し、接地して横切った敵を水しぶきと音で知らせる。横回避と壁で防げる。',max:URCHIN_LANCE.maxStock,price:URCHIN_LANCE.price,type:'urchin-lance',icon:'M6 9h24v18H6ZM11 9V5h14v4M18 13v10'},
 q:{name:'棘抜き',shortName:'銃を落とす',description:'Qで見える32mの敵を狙い左確定・右取消。0.45秒後、確定時の主武器を弾数ごと弾く。遮蔽0.10秒・射程外で回避。切替では回避できず、銃は両軍が拾える。',max:URCHIN_DISARM.maxStock,price:URCHIN_DISARM.price,type:'urchin-disarm',icon:'M4 6h28v8H4ZM14 14v8h8v-8M18 23v7m-5-4 5 4 5-4'},
 e:{name:'深潮のまなざし',shortName:'貫通暗闇',description:'Eで構え、照準方向へ左確定・右取消。0.25秒後に幅4mの潮の波を36m先まで放つ。壁を抜け、触れた敵と味方の8mより遠い視界を3秒奪う。背を向けても命中。横へ避けるか近距離で対処できる。弾・コイン消費なし、18秒で再使用。',max:1,price:0,type:'urchin-gloom',icon:'M3 15q15-18 30 0-15 18-30 0ZM18 10v10M7 26l5-3m12 0 5 3'}
};
const capSkills={
 c:{name:'レンズブレイク',shortName:'照準妨害',description:'Cで構え左クリックで投擲。着弾後.22秒、半径6mの射線が通る敵へ8秒の照準妨害とADS封印。命中敵を本人に3秒透過表示。',max:2,price:100,type:'cap-lens',icon:'M5 10h26v13H5ZM11 16h5m6 0h4M4 28 32 3'},
 q:{name:'クラスターグレネード',shortName:'回復／ダメージ',description:'Qで構え、右クリックでA回復／Bダメージを切替、左で投擲。着弾.22秒後に爆発し7子弾へ分裂。距離減衰・1発1人合計60上限。Aは本人と味方を回復、Bは敵へ通常装甲ダメージと本人へ3秒の敵透過表示。再QかEscで取消。',max:1,price:100,type:'cap-cluster-heal',icon:'M7 6h22v20H7ZM11 16l5 5 10-12'},
 e:{name:'バンクレンズ',shortName:'跳弾',description:'投擲の着弾周囲6mの本人と味方へ6秒、銃弾が縦の壁で最大3回反射し、通常の75%ダメージ。総経路90mまで。照準中央の反射後の経路を本人に点線表示（弾の拡散は別）。4枚目の壁・床・天井・盾・囮で止まり、自動追尾はない。22秒で再使用。',max:1,price:0,type:'cap-bank-grenade',icon:'M4 25 18 11l14 14M4 7h28M18 11v-6'}
};
const japanSkills={
 c:{name:'国境線',shortName:'国境線',description:'Cで構え40m先の床へ左確定・右取消。1秒後から14秒、幅10m・高さ2.8mの線を越えた敵へ一度だけ1000ダメージ。壁越しは無効。',max:2,price:100,type:'japan-border',icon:'M3 25V5m30 20V5M3 15h30M9 9v12m9-12v12m9-12v12'},
 q:{name:'装甲接収',shortName:'装甲接収',description:'Qで構え40mの見える敵へ左確定・右取消。敵の装甲を最大50奪い、その10倍を自身の装甲へ変換。自身は500まで。満装甲・相手の装甲0なら消費しない。',max:1,price:100,type:'japan-levy',icon:'M18 3 5 8v9l13 11 13-11V8ZM8 15h20m-7-5 7 5-7 5'},
 e:{name:'弾丸返送',shortName:'返送',description:'5秒、敵の銃撃で実際に失ったHPと装甲の650%を撃ち手へ返す。元の被害は受ける。ナイフ・スキルは対象外で返送は連鎖しない。20秒で再使用。',max:1,price:0,type:'japan-return',icon:'M4 10h19l-6-6m6 6-6 6M32 22H13l6-6m-6 6 6 6'}
};
const nobiSkills={
 c:{name:'鈴の弱点',shortName:'弱点の鈴',description:'Cで構え左クリックで35m先へ鈴を投げる。着地点から半径20mに6秒、範囲内の敵の被銃撃ダメージ1.35倍。壁・煙越し無効、範囲を出ると解除。右クリックで取消。',max:2,price:100,type:'nobi-bell',icon:'M18 3a8 8 0 0 0-8 8v8l-4 5h24l-4-5v-8a8 8 0 0 0-8-8ZM15 27h6'},
 q:{name:'ひげブレーキ',shortName:'連射抑制',description:'Qで構え左クリックで40m先へひげ玉を投げる。着地点から半径20mに5秒、範囲内の敵の銃の射撃間隔1.6倍。壁・煙越し無効、範囲を出ると解除。右クリックで取消。',max:1,price:100,type:'nobi-whisker',icon:'M3 8l12 4M3 16h12M3 24l12-4M33 8l-12 4M33 16H21M33 24l-12-4'},
 e:{name:'ポケット工具',shortName:'工作加速',description:'Eで構え左クリックで35m先へ工具箱を投げる。着地点から半径20mに6秒、自身と味方の設置・電源オフが1.5倍。壁・煙越し無効、範囲外は通常速度。作業は4キー、18秒で再使用。右クリックで取消。',max:1,price:0,type:'nobi-toolbox',icon:'M8 3v12l5 5v9h10v-9l5-5V3l-6 7h-8ZM12 25h12'}
};
const onnaraSkills={
 c:{name:'星跳び',shortName:'大ジャンプ',description:'接地中にCで即ジャンプ。頭上が開いていれば足元から約4.8m上昇する。空中移動・射撃は通常通りで、Eの13秒空中静止にもつなげられる。天井に当たると上昇停止。空中での追加発動はできない。',max:2,price:100,type:'onnara-jump',icon:'M18 29V6M9 15l9-9 9 9M7 29h22M11 22l7-7 7 7'},
 q:{name:'星見の宝玉',shortName:'反射カメラ',description:'Qで構え左クリックで手元から照準方向へ直進。毎秒12m、壁・床・天井で反射し15秒で消える。2個所持。周回映像に実際に映る敵だけ、本人のメイン画面にも透過表示。壁・煙でカメラの視線は遮られる。',max:2,price:100,type:'onnara-orb',icon:'M18 3a12 12 0 1 0 0 24 12 12 0 0 0 0-24ZM6 15h24M18 3v24'},
 e:{name:'星留め',shortName:'空中静止',description:'空中でE。最大13秒、空中で静止し水平移動と射撃は継続。Spaceで通常ジャンプし、頂点の高さで再び静止。再Eで解除。ジャンプで持続時間は延長しない。静止中の単発弾は照準どおりに飛び、散弾は通常の広がりを保つ。接地・高い床への侵入で終了。18秒で再使用。',max:1,price:0,type:'onnara-hover',icon:'M18 3v18M10 13l8 8 8-8M5 28h26'}
};
const renkoSkills={c:{name:'インパルス弾',shortName:'吹き飛ばし',description:'Cですぐ照準方向へ発射。飛距離制限なし・80m毎秒、直径1.82mの弾が最初の敵を吹き飛ばす。空所にも発射でき、壁・床・天井を貫通し、最初の敵かマップ端で停止。命中から1秒スタンし、移動・射撃・スキル・設置/解除を止める。壁で吹き飛びが止まっても1秒まで継続。追尾/ダメージなし。',max:2,price:200,type:'renko-dart',icon:'M3 18h23M18 9l10 9-10 9M8 11h6M8 25h6'},q:{name:'オーバードライブ',shortName:'高速走行',description:'6秒14.4m毎秒で走行し、ジャンプの初速が1.3倍。走行中にVで1秒の慣性滑走。滑走は曲がりにくく、ジャンプで終了。Vを離して走れば再度滑れる。もう一度Qで走行・滑走を解除。発動中は素手で銃・ナイフ不可、Cは発射できる。終了時に武器を持ち直す。',max:1,price:100,type:'renko-drive',icon:'M4 26h16l10-15M7 18h10M10 10h10'},e:{name:'ジェットパック',shortName:'長押し飛行',description:'E長押し中、最大1秒まで16m毎秒で照準方向へ自動飛行。マウスで上下左右に操縦し、Eを離すと終了。飛行中は素手で銃・ナイフ不可、Cは発射できる。終了時は武器を持ち直す。壁/天井で停止、終了後は落下。使用後に敵2キルで再使用。時間では回復しない。',max:1,price:0,type:'renko-jet',icon:'M12 23V8l6-5 6 5v15M12 25l-4 7M24 25l4 7M18 24v9'}};
const skillsFor = character => character==='renko'?renkoSkills : character==='onnara'?onnaraSkills : character==='urchin'?urchinSkills : character==='cap'?capSkills : character==='japan'?japanSkills : character==='nobi'?nobiSkills : character==='car'?carSkills : character === 'cat' ? catSkills : character === 'duck' ? duckSkills : character === 'nope' ? nopeSkills : character === 'mend' ? mendSkills : character === 'echo' ? iagnuSkills : character === 'veil' ? veilSkills : character === 'ember' ? emberSkills : character === 'frost' ? frostSkills : baseSkills;
export const signatureCooldown = character => character==='renko'?RENKO_SKILLS.signatureCooldown : character==='onnara'?ONNARA_SKILLS.signatureCooldown : character==='urchin'?URCHIN_SKILLS.signatureCooldown : character==='cap'?CAP_SKILLS.signatureCooldown : character==='japan'?JAPAN_SKILLS.signatureCooldown : character==='nobi'?NOBI_SKILLS.signatureCooldown : character==='car'?CAR_SKILLS.signatureCooldown : character === 'cat' ? CAT_SKILLS.signatureCooldown : character === 'duck' ? DUCK_SKILLS.signatureCooldown : character === 'nope' ? NOPE_SKILLS.signatureCooldown : character === 'mend' ? MEND_SKILLS.signatureCooldown : character === 'echo' ? IAGNU_SKILLS.signatureCooldown : character === 'veil' ? VEIL_SKILLS.signatureCooldown : character === 'ember' ? EMBER_SKILLS.signatureCooldown : character === 'frost' ? FROST_SKILLS.signatureCooldown : 0;
const characterSkills = Object.freeze(Object.fromEntries(Object.keys(CHARACTER_DEFS).map(character => [character,
  Object.freeze(Object.fromEntries(['c', 'q', 'e'].map(key => [key, Object.freeze({ id: `${character}-${skillsFor(character)[key].type.replace(/^(duelist|nope|mend|echo|veil|ember|frost|duck|cat|car|nobi|japan|cap|urchin|onnara|renko)-/, '')}`, key, ...skillsFor(character)[key], ...(character === 'duelist' && key === 'e' ? { description: `${baseSkills.e.description} ${DUELIST.signatureKills}撃破で再使用。` } : {}) })]))),
])));
const skillKey = value => typeof value === 'string' ? value.toLowerCase().replace(/^key/, '') : '';
export function getCharacterSkill(character, key) { const skills = characterSkills[normalizeCharacter(character)], normalized = skillKey(key); return Object.hasOwn(skills, normalized) ? skills[normalized] : null; }
export const signatureKillsRequired = character => character === 'renko' ? RENKO_SKILLS.signatureKills : character === 'duelist' ? DUELIST.signatureKills : 0;
export function getSkillState(kit, key, now = 0) {
  const definition = getCharacterSkill(kit?.character, key); if (!definition) return null;
  const slot = definition.key, stock = slot === 'c' ? kit?.smoke : slot === 'q' ? kit?.updraft : kit?.dash;
  const count = integer(stock, definition.max), clock = Number.isFinite(now) ? now : 0;
  const armed = slot === 'e' && definition.type === 'dash' && Number.isFinite(kit?.armReadyAt) && Number.isFinite(kit?.armExpiresAt) && kit.armExpiresAt > clock;
  const charging = armed && clock < kit.armReadyAt;
  const cooldown = signatureCooldown(kit?.character);
  const remaining = slot !== 'e' ? 0 : armed ? Math.max(0, (charging ? kit.armReadyAt : kit.armExpiresAt) - clock) : cooldown ? Math.max(0, (kit?.nextSignatureAt || 0) - clock) : 0;
  const progress = slot === 'e' && kit?.character === 'renko' ? count ? 1 : integer(kit.dashKills, RENKO_SKILLS.signatureKills - 1) / RENKO_SKILLS.signatureKills : slot === 'e' && cooldown ? count ? 1 : Math.max(0, Math.min(1, 1 - remaining / cooldown)) : charging ? Math.max(0, 1 - (kit.armReadyAt - clock) / DUELIST.dashArmDelay) : armed ? Math.max(0, Math.min(1, remaining / (DUELIST.dashWindow - DUELIST.dashArmDelay))) : count ? 1 : 0;
  return { count, max: definition.max, ready: count > 0 || armed && !charging, armed, charging, remaining, progress };
}
const integer = (value, max) => Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
export class DuelistKit {
  constructor({ character = 'duelist' } = {}) { this.character = normalizeCharacter(character); this.smoke = 0; this.updraft = 0; this.ultPoints = 0; this.resetRound(); }
  resetRound({ reset = false } = {}) {
    if (reset) { this.smoke = 0; this.updraft = 0; this.ultPoints = 0; }
    this.dash = 1; this.dashKills = 0; this.armReadyAt = null; this.armExpiresAt = null; this.nextSignatureAt = 0;
    this.knives = 0; this.knivesActive = false; this.renkoActive = false; return this.snapshot();
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
        if(this.character==='renko')return {type:'renko-dart'};
        if(this.character==='onnara')return {type:'onnara-jump',velocity:ONNARA_SKILLS.jumpVelocity};
        if(this.character==='urchin')return {type:'urchin-lance'};
        if(this.character==='cap')return {type:'cap-lens'};
        if(this.character==='japan')return {type:'japan-border'};
        if(this.character==='nobi')return {type:'nobi-bell'};
        if (this.character === 'car') return {type:'car-bumper'};
        if (this.character === 'cat') return {type:'cat-bookmark'};
        if (this.character === 'duck') return {type:'duck-pad'};
        if (this.character === 'mend') return { type: 'mend-seeds', flight: MEND_SKILLS.seedsFlight, duration: MEND_SKILLS.seedsDuration, radius: MEND_SKILLS.seedsRadius, speedScale: MEND_SKILLS.seedsSpeedScale };
        if (this.character === 'echo') return { type: 'echo-tag', flight: IAGNU_SKILLS.tagFlight, armDelay: IAGNU_SKILLS.tagArmDelay, duration: IAGNU_SKILLS.tagDuration, radius: IAGNU_SKILLS.tagRadius, range: IAGNU_SKILLS.tagRange, revealDuration: IAGNU_SKILLS.tagRevealDuration };
        if (this.character === 'veil') return { type: 'veil-dust', armDelay: VEIL_SKILLS.dustArmDelay, duration: VEIL_SKILLS.dustDuration, radius: VEIL_SKILLS.dustRadius };
        if (this.character === 'ember') return { type: 'ember-solder', flight: EMBER_SKILLS.solderFlight, armDelay: EMBER_SKILLS.solderArmDelay, radius: EMBER_SKILLS.solderRadius, range: EMBER_SKILLS.solderRange, maxDamage: EMBER_SKILLS.solderDamage };
        if (this.character === 'frost') return { type: 'frost-stitch', flight: FROST_SKILLS.stitchFlight, armDelay: FROST_SKILLS.stitchArmDelay, duration: FROST_SKILLS.stitchDuration, radius: FROST_SKILLS.stitchRadius, innerRadius: FROST_SKILLS.stitchInnerRadius, range: FROST_SKILLS.stitchRange, speedScale: FROST_SKILLS.stitchSpeedScale };
        return this.character === 'nope' ? { type: 'nope-bottle', fuse: NOPE_SKILLS.bottleFuse, flight: NOPE_SKILLS.bottleFlight, radius: NOPE_SKILLS.bottleRadius, maxDamage: NOPE_SKILLS.bottleDamage } : { type: 'duelist-comet', flight: DUELIST_SKILLS.cometFlight, duration: DUELIST_SKILLS.cometDuration, radius: DUELIST_SKILLS.cometRadius, range: DUELIST_SKILLS.cometRange };
      case 'q':
        if (this.updraft <= 0) return null;
        this.updraft--;
        if(this.character==='renko')return {type:'renko-drive'};
        if(this.character==='onnara')return {type:'onnara-orb'};
        if(this.character==='urchin')return {type:'urchin-disarm'};
        if(this.character==='cap')return {type:'cap-cluster-heal'};
        if(this.character==='japan')return {type:'japan-levy'};
        if(this.character==='nobi')return {type:'nobi-whisker'};
        if (this.character === 'car') return {type:'car-wash'};
        if (this.character === 'cat') return {type:'cat-pluck'};
        if (this.character === 'duck') return {type:'duck-shield'};
        if (this.character === 'mend') return { type: 'mend-pollen', flight: MEND_SKILLS.pollenFlight, duration: MEND_SKILLS.pollenDuration, radius: MEND_SKILLS.pollenRadius };
        if (this.character === 'echo') return { type: 'echo-glint', flight: IAGNU_SKILLS.glintFlight, radius: IAGNU_SKILLS.glintRadius, duration: IAGNU_SKILLS.glintDuration };
        if (this.character === 'veil') return { type: 'veil-sensor', range: VEIL_SKILLS.rootsThrowRange, radius:ROOT_SENSOR.radius, duration:ROOT_SENSOR.duration, speedScale:ROOT_SENSOR.speedScale };
        if (this.character === 'ember') return { type: 'ember-shade', duration: EMBER_SKILLS.shadeDuration, flashScale: EMBER_SKILLS.shadeFlashScale };
        if (this.character === 'frost') return { type: 'frost-mist', flight: FROST_SKILLS.mistFlight, duration: FROST_SKILLS.mistDuration, radius: FROST_SKILLS.mistRadius, range: FROST_SKILLS.mistRange };
        return this.character === 'nope' ? { type: 'nope-flash', flight: NOPE_SKILLS.flashFlight, radius: NOPE_SKILLS.flashRadius, duration: NOPE_SKILLS.flashDuration } : { type: 'duelist-lift', velocity: DUELIST.updraftVelocity, duration: DUELIST_SKILLS.liftVisualDuration };
      case 'e':
        if (this.character === 'renko') {
          if (this.dash <= 0) return null;
          this.dash = 0; this.dashKills = 0; this.nextSignatureAt = 0;
          return { type: 'renko-jet' };
        }
        if (signatureCooldown(this.character)) {
          if (this.dash <= 0) return null;
          this.dash = 0; this.dashKills = 0; this.nextSignatureAt = now + signatureCooldown(this.character);
          if(this.character==='onnara')return {type:'onnara-hover'};
        if(this.character==='urchin')return {type:'urchin-gloom'};
        if(this.character==='cap')return {type:'cap-bank-grenade'};
        if(this.character==='japan')return {type:'japan-return'};
        if(this.character==='nobi')return {type:'nobi-toolbox'};
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
        if(this.character==='renko'){if(this.renkoActive||this.ultPoints<DUELIST.ultimatePoints)return null;this.ultPoints-=DUELIST.ultimatePoints;this.renkoActive=true;return{type:'renko-restart'};}
        if (this.knivesActive || this.ultPoints < DUELIST.ultimatePoints) return null;
        if(this.character==='onnara'){this.ultPoints-=DUELIST.ultimatePoints;return {type:'onnara-chain'};}
        if(this.character==='urchin'){this.ultPoints-=DUELIST.ultimatePoints;return {type:'urchin-trident'};}
        if(this.character==='cap'){this.ultPoints-=DUELIST.ultimatePoints;return {type:'cap-magazine-grenade'};}
        if(this.character==='japan'){this.ultPoints-=DUELIST.ultimatePoints;return {type:'japan-muster'};}
        if(this.character==='nobi'){this.ultPoints-=DUELIST.ultimatePoints;return {type:'nobi-collar'};}
        if (this.character === 'car') {this.ultPoints-=DUELIST.ultimatePoints;return {type:'car-pit'};}
        if (this.character === 'cat') {this.ultPoints-=DUELIST.ultimatePoints;return {type:'cat-clock'};}
        if (this.character === 'duck') { this.ultPoints -= DUELIST.ultimatePoints; return {type:'duck-egg'}; }
        if (this.character === 'nope') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'nope', duration: NOPE_SKILLS.decoyDuration+(NOPE_SKILLS.decoyWaveCount-1)*NOPE_SKILLS.decoyWaveInterval }; }
        if (this.character === 'mend') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'mend', radius: 18, healing: 75 }; }
        if (this.character === 'echo') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'recon', radius: TEAM_ABILITIES.reconRadius, duration: 6, pulses: 3, interval: 2, revealDuration: 1.25 }; }
        if (this.character === 'veil') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'veil', radius: 9, duration: 12 }; }
        if (this.character === 'ember') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'ember', radius: 6, duration: 4.8, pulses: [1.2, 2.4, 3.6], damage: 80 }; }
        if (this.character === 'frost') { this.ultPoints -= DUELIST.ultimatePoints; return { type: 'frost', radius: 7, duration: 10, warmup: .8, slowMultiplier: .55 }; }
        this.ultPoints -= DUELIST.ultimatePoints; this.knives = DUELIST.knives; this.knivesActive = true;
        return { type: 'knives', count: this.knives };
      default: return null;
    }
  }
  consumeKnife(count=1) { if (!Number.isSafeInteger(count) || count<1 || count>DUELIST.knives || !this.knivesActive || this.knives<count) return false; this.knives-=count; return true; }
  awardKill() {
    this.awardPoint();
    if (signatureKillsRequired(this.character) && this.dash === 0 && ++this.dashKills >= signatureKillsRequired(this.character)) { this.dash = 1; this.dashKills = 0; }
    if (this.knivesActive) this.knives = DUELIST.knives;
    if(this.character==='renko'&&this.renkoActive){this.smoke=getCharacterSkill('renko','c').max;this.updraft=getCharacterSkill('renko','q').max;this.dash=1;this.dashKills=0;this.nextSignatureAt=0;return true;}
    return false;
  }
  awardPoint() { this.ultPoints = Math.min(DUELIST.ultimatePoints, this.ultPoints + 1); }
  snapshot() { return { character: this.character, smoke: this.smoke, updraft: this.updraft, dash: this.dash, ultPoints: this.ultPoints,
    knives: this.knives, knivesActive: this.knivesActive, armReadyAt: this.armReadyAt, armExpiresAt: this.armExpiresAt, dashKills: this.dashKills, nextSignatureAt: this.nextSignatureAt, ...(this.character==='renko'&&this.renkoActive?{renkoActive:true}:{}) }; }
  restore(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    this.character = normalizeCharacter(value.character);
    this.renkoActive = this.character === 'renko' && value.renkoActive === true;
    this.smoke = integer(value.smoke, getCharacterSkill(this.character, 'c').max); this.updraft = integer(value.updraft, getCharacterSkill(this.character, 'q').max);
    this.dash = integer(value.dash, 1); this.dashKills = this.dash === 0 ? integer(value.dashKills, Math.max(0, signatureKillsRequired(this.character) - 1)) : 0;
    this.ultPoints = integer(value.ultPoints, DUELIST.ultimatePoints); this.knives = integer(value.knives, DUELIST.knives);
    this.knivesActive = this.character === 'duelist' && value.knivesActive === true; if (!this.knivesActive) this.knives = 0;
    const validArm = this.character === 'duelist' && Number.isFinite(value.armReadyAt) && Number.isFinite(value.armExpiresAt) && value.armReadyAt >= 0
      && value.armExpiresAt > value.armReadyAt && value.armExpiresAt - value.armReadyAt <= DUELIST.dashWindow;
    this.armReadyAt = validArm ? value.armReadyAt : null; this.armExpiresAt = validArm ? value.armExpiresAt : null;
    this.nextSignatureAt = signatureCooldown(this.character) && this.dash === 0 && Number.isFinite(value.nextSignatureAt) && value.nextSignatureAt > 0 ? value.nextSignatureAt : 0;
    return true;
  }
}
