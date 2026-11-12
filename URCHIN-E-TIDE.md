## 第212巡 / 青ウニE・深潮の波と共通潮痕

所有者指定：Eと共通潮痕、既存C/Q hookのみ。E構え→左確定/右無料取消、固定位置/方向の.25秒予告→36m/全幅4m/高さ2.5m/72m毎秒の壁貫通波。hostの連続相対sweepで各対象1回、敵近視3秒/味方1秒/本人なし、視界8m、0damage/0slow、18秒CD/free。敵だけ潮痕4秒、動いた経路に.12秒間隔/.8秒寿命の泡、壁/煙/depthと付与元teamの可視条件を守る。潮痕中の実C直接命中は25%slow/.8秒、Q成功の通常残弾dropは最大2m/.25秒の安全な水滑り。C80damage/範囲/残留、Q32m/.45予告/.10遮蔽/instance/通常回収、Xと他15人の技数値を維持。URCHIN-E-TIDE.md参照。fps-19はPAUSED。

変更ファイルと責務

- public/urchin-tide.js（新規）：共通調整値、矩形波の連続相対sweep、最大10人の潮痕/短いCスロウの共通状態と厳格な整数tuple。
- public/urchin-tide-fx.js（新規）：構えの手元水球/吸い込む滴、範囲preview、予告、進行波/白い飛沫、壁接触しぶき、移動泡、Q水滑り。16 wave cells/96 trail samples/80 splash samplesに上限。
- public/character-skills.js：既存E event clock/owned authority/近視を拡張、潮痕APIとsnapshot、Cの既存実命中hookへ短いslow。死亡/cleanse/round/menuで清掃。
- public/game.js：E照準入力/通常射撃停止/CD guard、preview/FX/HUD/8m視界、音の軽い遠方減衰、Q既存adapterの安全な通常world drop引寄せ。
- public/urchin-disarm.js：既存5整数drop motionを保持し、引寄せ時だけ中間着地3整数を付加した8整数motionと.25秒のsettle/pickup guard。
- public/abilities.js、audio.js、skill-messages.js、style.css：Eの調整値参照と短い説明、既存素材のE recipe/遠方lowpass、深海filterと弱い外周波紋。
- tests-urchin-tide*.cjs（6本新規）、tests-urchin-gloom-contract.cjs（既存Eの新指定clock/味方1秒/潮痕cleanupに更新）。AGENTS/DEVELOPMENT-BACKLOGと本書。POLISHはローカル記録のみ。

波・状態・同期

Idle/Aimingは既存duckAim、Telegraph/WaveTravelは既存event.startedAt/triggerAt/flight、Recovery/Cooldownは既存期限/nextSignatureAtで管理。方向/位置は左確定で固定。波の時間区間と前後actor姿勢を同じ座標系へ投影し、横幅/高さと身体の重なりを連続sweepする。壁で止めず、背面/しゃがみも同じ判定。8mを超える瞬間移動は途中を補間しない。1秒frame gapでも消滅前の未処理区間をhostが1回消化する。既存の状態無効/cleanse規則に準拠し、新しい無敵規則は作らない。

近視は既存blindsへ、敵3秒/味方1秒の別recordを使用し、潮痕4秒と独立。画面全体を黒くせず深海色filter、8m境界のfogと実effective sightを併用。8m内の通常戦闘/弾道/移動/武器性能は変えない。近視中の遠方だけ既存定位/遮蔽audioのgainを.82倍・lowpass最大2400Hz、通常時のrecipeと元audioファイルは保持。外周波紋はreduced motionで停止する。

潮痕は共通API tideMarked/tideMarksで取得。1actor1record、再付与で4秒へ更新し付与teamを保持。短いslowは独立終了時刻なので潮痕終了直前のC命中でも.8秒を消化する。snapshotは任意のtide配列、[targetId,sourceTeamBit,markStartedMs,optionalSlowStartedMs]のみ。座標/HP/追加actor field/泡objectは送信しない。ID64文字/10record/過去の安全整数/重複と期限を検査し、失敗は既存stateを保つ。guest restoreは波の権威を持たず、遅いsnapshotで期限を復活させない。

泡は同期済みactor移動と潮痕から各clientで再現。水平速度.6m毎秒以上・微小移動の累積.07m以上で.12秒間隔、.8秒で浮いて消える。静止/期限後は新規生成なし。再付与/teleport/死亡/roundで履歴を清掃し二重生成しない。source teamだけに通常depthTest/fogを持つ水色半透明sphereを描き、既存rootPointVisibleによる壁/煙/近視判定も通す。敵outline、名前/HP、正確なmap pin、索敵用BOT memory/cueを追加しない。波自体も16cellごとの通常可視判定を通す。

C/Q連携

Cは既存の実damage確認済みlanceHitPulseだけが、生存する敵の同team潮痕を調べて.75移動倍率/.8秒を付与。C80damageと装甲計算/範囲、残留水流0damage/侵入cueは不変。残留を踏んだだけではslowを付けない。

Qは既存tidePull hookだけを活性化。成功した通常の主武器drop（元の弾倉/予備弾）を、発動時の使用者位置へ水平最大2m引く。先に通常放出して実床へ着地後、.25秒のwater slideを行う。歩行可能範囲/支持床/全経路swept sphere/壁/traffic/map端を検査し、床高変化>.02m/穴/障害物の手前で停止。新規取得や武器複製はしない。5整数の通常落下と8整数の引寄せを厳格検証、移動中は既存settle guardで拾得不可、完了後は敵味方の通常Fと元の残弾を保持。skin/attachmentは元inventoryに独立fieldがないため新造しない。Qの予告/中断/instanceロックは変更しない。同frameでEが先に到達した潮痕もhostの更新順でQが取得する。

音とエフェクト

Eの水球/滴/予告発光、幅4m・高さ2.5mの進行波/白飛沫、壁の接触しぶき、泡軌跡、Q水滑り泡を実THREE objectで実装。通常depth/壁/煙とteam可視条件を使い、期限/roundでpool/geometry/materialをdispose。既存air/liquid素材を使うEの圧力/発射/控えめなhit/沈み音recipeを追加。hit音はwave単位でまとめ、人数分の音重ねや位置HUDを追加しない。所有者PCでは再生せずmock記録のみ。

調整パラメータ（URCHIN_TIDE）

range36 / width4 / height2.5 / speed72 / telegraph.25 / enemyNear3 / allyNear1 / sight8 / mark4 / cooldown18 / bubbleLife.8 / bubbleInterval.12 / bubbleSpeed.6 / bubbleDistance.07 / teleportDistance8 / maxActors10 / maxBubbles96 / slowScale.75 / slowDuration.8 / pressureAt.1 / glowAt.2 / farAudioScale.82 / farAudioCutoff2400。QのpullDistance2 / pullDuration.25は既存URCHIN_DISARMを再利用。Eはfree/0damage/0slow、投擲技への変換は行わない。

検証結果

専用geometry/authority/status/strict6群、メモリ故障4種、実保存game8群、実THREE FX4群、固定pre-E比較3群。実updatePlayはframeごと1回、20/60/144Hzで敵3秒/味方1秒/本人0、HP/装甲不変、C実damage/slow、Q元17/53弾のdrop/pull/両軍回収を検証。実mouse左/右/CD guard、E/Q同frame、独立host/guest JSON、duplicate/stale packet、1秒gap、wall/smoke/high/side/moving/crouch/teleport/停止/再付与/cleanse/death/roundを確認。

既存Q controller7/game13/fault4/FX3、青ウニ実game20/C10/C残留6/E9/共通6、E strict8/fault3、短文message6、知覚8/戦術14（実地4seed）を確認。最大10潮痕+10slow/20Q/最大ID/32pull武器/10actor/全busと既存状態が65399B/65536B、actor/event/drop/statusは全保持、再現可能cueだけ削減。SQLite27群成功。共有関連suiteと本番build/全public archive exactも公開記録で確認する。

未検証・限界

実browser/WebGL描画、聴感、実2tab/スマホ/別回線/10端末、通常5v5の勝率/追撃/設置解除寄与は未確認。FX検査は実THREE objectとmock renderer/audio、通常scene表示を眼で確認した証拠ではない。手動確認は所有する非表示tabの最初のUIでSOUND OFFを確認後にE予告/波/8m視界/壁煙の泡遮蔽/両軍Q回収を行う。音の実試聴は今回行わない。既存ordinary/fullmainの固定投擲clock fixture債務を保持。X・他15人・C/Qの非combo仕様と既存音recipeは固定pre-E baselineの比較で維持。新しいBOT戦術やX改修は対象外。
