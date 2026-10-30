## 第213巡 / 青ウニX・三叉潮の三叉とADS集中

所有者指定：今回はXのみ。7pt/即時発動/固定13秒/再発動不可、通常1射分の弾薬・射撃sequence・反動・銃声で、腰撃ちの通常ペレット群を中央100%と水平±7度の各65%へ分岐。実hitbox/通常装甲・距離減衰・遮蔽を使い、各方向を独立解決、同じ敵にも実衝突した分だけ入る。ADS対応primaryは中央群だけ/連射1.5倍維持/反動.8、通常scope・reload・移動・武器データ不変。武器変更/リロード/knife中も時計は進み、死亡/roundで即清掃。潮痕は参照だけで追加damage/拘束/消費なし。有界水流FXと残秒/三叉・集中HUD。C/Q/Eと他15人、音源/地形/銃/HTTP頻度を保持。URCHIN-X-TRIDENT.md参照。fps-19はPAUSED。

変更ファイルと責務

- public/urchin-trident.js（新規）：単一のX調整値、primary ADS対応判定、readonlyな中央/左右lane。
- public/game.js：既存fireArsenalへXの一時的なlane修飾。通常銃/arsenal/BOT/remote hostが同じ実raycastを使う。射撃入口の消費/sequence/発射音は1回。既存damageEntityで各laneの通常ペレット群を独立解決し、生存guardで死亡/drop/killを重複させない。hit確認音はvictim/triggerにまとめる。Xだけの64action queue保護、反動.8、ADS modeとHUD/FXを接続。
- public/character-skills.js：既存13秒personal event/strict JSONをそのまま使い、死亡でXだけを削除するendTridentを追加。C/Q/E engine処理は保持。
- public/urchin-trident-fx.js（新規）：512のinstanced短い水流trace、192のinstanced水滴/棘砕き、最大10人の武器water coat/三叉の銃口光。0.35秒の拡大収束、reload滴、ADS中心光、通常depth/fog/壁煙可視判定、期限/死亡/roundでdetach。通常model/skinを置換しない。
- public/abilities.js：X定数参照/説明/7pt。public/audio.js：既存air/liquid/glass素材だけのfocus/warning/end/mark recipeを追加。全既存recipeと素材byteは維持。public/skill-messages.js：2秒の短文。public/play.html/polish.css：残秒と三叉/集中、3秒以下の緩い点滅/reduced motion。
- tests-urchin-trident-game/fx/regression/wire/negative.cjs（5本新規）、tests-urchin-game.cjs（旧4度・2追加rayのX fixtureだけを3群/7度/新poolに更新）。本書/AGENTS/DEVELOPMENT-BACKLOG。POLISHと実行記録はprivateのみ。

射撃と弾薬

既存shoot/remote/BOTが1回だけ残弾/sequence/発射間隔を更新し、通常weaponDamage/shotPatternを使用する。Xがなければ従来分岐のまま。X中は共有ballisticsの通常精度/移動・空中penaltyを各ペレットに適用し、その同じペレット群をworld-upまわりに±7度回転するため上下pitchも拡散も保持。左右だけ完全精度にはしない。最大36ray（PUMP12×3）、DRUM30ray。中心/左右は独立した実衝突で、同一敵にも中央100%/左右65%を適用。各群内のpellet合算は既存shotgun方式。各laneを通常armor/lethal/chain/kill処理へ順に渡す。1回発射の残弾は1射分、銃声/薬莢/反動/sequenceは1回。壁・盾・囮・busは既存ray順。新しい壁貫通性能や射程は付与しない。既存武器に弾丸の飛行simulationはなくhitscanなので、全倍率はその発射中に確定し、終了後の飛翔弾を再計算する処理は不要。

ADS・武器・終了

現在のprimaryをADS対応分類として使い、既存右クリック/モバイルADS/スナイパーscope/cycleを維持。ADSでは中央の通常pellet群だけ、1.5rateは同じ、反動incrementとviewmodel kickを.8倍にする。ピストルは既存ADS非対応で常に三叉、knife/ULT専用刃には効果なし。PUMP/DRUMは通常群を3組、SMG/rifle/forge/secondaryは1ray×3。scout/atlasのscope倍率/操作を変えず、既存shot gateの短縮間隔に合わせる。reload/movement/WEAPONSは不変。Nobi等の既存interval倍率と積算し、X eventが消えればrate/ADS recoil/FX/HUDが外れる。weapon swap/reload/ADS/knife/他スキルで13秒のendsAtを更新しない。死亡はendTridentでX eventだけ即時削除、round/menuは既存resetで清掃。

エフェクト・HUD・音

既存の身体spine auraに、weapon muzzle近傍の薄いwater coatと3本の光を追加。ADSは左右光を消して中央へ収束する。rayの水流は短いsegmentが.09秒で消え、実着弾の水滴は.24秒。潮痕実hitでは小さな細長い棘/滴と使用者hitFlash、通常より明瞭な短い既存素材音を1triggerへまとめる。tideMarkedを読むだけで、mark/HP/移動状態を変更しない。すべて通常depth/fogと既存rootPointVisibleの壁/煙/近視を守る。敵outline/map座標/HUD人数を追加しない。専用HUDは13秒の固定endsAtから残秒と三叉/集中を表示、3秒以下は1秒周期の弱い点滅、mode切替220ms（reduced motionで停止）。focus音は.3秒、mark音は.09秒以上空け、終了予告と終了音はeventごと1回。元の銃声/足音/音源byteは保持。所有者PCでの音再生は0。

同期・性能

hostの既存personal eventが7pt消費/開始/終了を確定。既存fire actionのyaw/pitch/adsとsequenceを使い、一射1action/一回の残弾変更、既存cadence/重複seq拒否を維持。guestはvisualOnlyでHP/命中/在庫/dropを確定しない。射撃中以外もmodeが分かるようX集中時だけinput/actorに任意boolean focus=trueを付加し、hostは生存・primary・ADS封印を検査。個々のray/泡は送信しない。遠隔guestの銃口は受け取ったmode/shotSequence/flashで短い三叉光を再現（snapshot間に落ちた射撃光や上下の正確なimpactは追加送信しない）。late joinで過去の発射を再生しない。

ray計算は最大36/trigger、FX geometryは固定poolで再利用。world poolは2draw、weapon decorationは最大10組の4mesh（最大40draw）、既存body auraは別。frameごとの短いVector3/readonly result配列は発生するが、rayごとの新規geometry/巨大network配列は作らない。10人PUMP/200cartridgeの7200実rayをinert-rendererの保存gameで通し、512trace/192particleの上限を確認。実GPU/スマホのfpsや通常5v5負荷の計測とは区別する。

調整値（URCHIN_TRIDENT）

points7 / duration13 / fireRate1.5 / angle7° / sideDamage.65 / adsRecoil.8 / activation.35 / warning3 / focusSoundGap.3 / hitSoundGap.09 / traceLife.09 / splashLife.24 / maxTraces512 / maxSplashes192 / maxWeapons10。中央倍率1はimmutable lane、reload/move/scope/通常pellet数・射程は元のWEAPONS/既存ray処理から取得。

検証と制約

専用保存game12群：直接X7pt/不足/再使用/封印/作業/death/buy/20event、通常1ammo/sequence/sound、水平±7°と同pitch、中央40/左右26/26、至近3命中92、通常armor/falloff/壁/不在lane、ADS1群/反動.8/1.5rate/戻し、全10銃/PUMP36・DRUM30とADS12/10、knife、20/60/144Hz actual updatePlay1回/frameで9射/0.6秒と13秒終了、reload/swap/death/round、潮痕非消費/追加damageなし/音抑制、remote cadence/full64action、独立host/guest JSON/重複・古いpacket、10人X poolを確認。専用FX4群・固定pre-X比較3群・メモリ故障2種。最大10focus + 潮痕10/slow10/Q20/32pull drops/64字ID/全busのSQLite transportは65529B/65536B、actor/event/drop不削除。通常packet頻度/64KiBを保持。

関連C/Q/E/arsenal/duelist/知覚/戦術/短文を検証。旧sniper-cycleの浮動小数点境界fixtureとcap-gameの投擲前即時lock期待は固定pre-Xソースでも同じ失敗を再現し、条件や製品を緩めず既存債務として記録する。実browser/WebGL/実2tab/端末/聴感/通常5v5効果は未確認。手動確認は所有する非表示tabを最初のUIでSOUND OFF確認後、Vandal連射/ADS、PUMP三叉、scout scope、kill/drop重複、死亡/round終了を確認する。今回browser/tab/server/OS/他アプリ操作は0。
