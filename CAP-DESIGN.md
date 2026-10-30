## 第218巡 / キャップQの15子玉を着地発動へ

所有者指定：Qの回復A/ダメージBの子玉を7→15個、子玉の重力4→15m/s²。実壁/天井は掃引反射し、上向き法線の実床に落ちたら静止して.18秒後だけ効果を発生する。旧1.35秒の空中起爆を廃止し、未着地のまま8秒経過した子玉は効果なしで消す（childFuseは計算/寿命上限）。着地待ち中に床が失われたら落下へ戻り、次の実床で待ち直す。固定120Hz/同じseed/hostとFX共通物理、20event×15子玉の300bodyと最大320burstを有界poolで全数表示。既存の本体60damage/75heal、子42damage/36heal、合計180・距離減衰/装甲/HP100・味方規則/親の投擲・在庫/購入・C/E/X・他15人・音源/地形/銃/wire field/HTTP頻度は保持。表示の旧60上限を既存180へ整合。fps-19はPAUSED。下記旧7子玉/空中ヒューズ/160poolの記述はこの指定で更新する。

## 第216巡 / キャップQの回復・ダメージを3倍

所有者指定：QクラスターのA回復/Bダメージの効果量を各3倍。本体ダメージ20→60、子玉14→42、本体回復25→75、子玉12→36、1投1人の合計上限も60→180raw/180HPへ変更。距離減衰後も各爆発の倍率は3倍、HP上限100・既存装甲・本人/味方回復と敵へのダメージ・半径/7子玉/低重力投擲/反射/ヒューズ/在庫/購入/透過表示・host権威/拒否rollback/通信は維持。CAP_GRENADEの6項目だけを調整し、C/E/X・他15人・地形/モデル/音源は変更しない。fps-19はPAUSED。下記第208巡の旧60上限・旧基礎量はこの指定で更新する。

## 第208巡 / キャップは？全技投擲・回復と攻撃のクラスター

所有者指定：CQEXすべて構えて左クリックで投擲。Qは構え中の右クリックでA回復/Bダメージを切替、再Q/Escで取消。共通の初速12/上向き2/重力4・上下±89.4度・水平40m以内・実壁/床/天井を使い、着弾.22秒後に起爆。Qは7子弾をhost固定seedで放ち、独立の固定120Hz掃引反射・1.35秒または最初の床衝突後.18秒で爆発。親6m/子3.2m、線形距離減衰、1投1人60raw/60HP上限。Aは本人/味方回復、Bは敵へ既存装甲ダメージ。Cは着弾周囲の敵に従来8秒の照準妨害、Eは周囲の本人/味方へ従来6秒の3跳弾75%/90m、Xは周囲の本人/味方へ従来9秒の装填弾無消費。C/B命中敵だけ本人に3秒透過表示。半径/数/威力/散開/ヒューズはcap-grenades.jsの設定、描画は別の有界プール、音は既存recipeを使用。hostだけHP/命中を確定しguestは在庫予測と描画のみ。20event/64action拒否rollback・独立JSON/重複ACK・10人/64KiB/HTTP頻度を保持。CAP-DESIGN.mdが最新正本。地形/モデル/音源/銃/他15人とfps-19 PAUSEDを保持。

最新指定は下記の旧単体指定/自己強化/妨害解除Qを置き換える。既存16人との比較：のびは持続範囲の被害/射撃間隔/作業倍率、MENDは直接回復、NOPEは単一の爆発/閃光/囮。キャップQは回復/攻撃の二モードを一つの在庫から選び、物理的な親と7子弾の爆発を距離減衰・合計上限で制御する。C/E/Xは元の銃に関する効果を着弾時に付与し、他キャラの性能を移植しない。

設定：CAP_GRENADEのparentDamage20/childDamage14、parentHeal25/childHeal12、各合計上限60。scatterSpeed11m毎秒・角度.35〜1.15rad・bounce.58・bodyRadius.1m。無限に再生成せず1eventにつき7子弾、各型の描画は160body/160burst以下。FXモジュールに命中権限を持たせない。音はgameの既存cap recipe割当、素材byte不変。

通信：新5型は従来端点/flightで親の軌道を復元し、event IDから子弾seedを再現する。host命中IDは最大10人の共通辞書と有界hitsで送信。C/E/X期限は親triggerから復元し、Qの最終命中はミリ秒へ切り下げて3秒の表示を延長しない。無効/重複/範囲外辞書とdeadlineをstrict拒否。死亡/team/次R/menuで清掃する。敵移動や途中の地形変更に対しクライアント予測は視覚用で、実HPはhostだけが確定する。

検証：専用engine5/メモリ故障4、実保存game7（操作/HP/地形/TRC地下/独立hostguest/拒否ACK/プール清掃）、元の3跳弾6/故障4、知覚8・戦術14（実地4seed）、SQLite27と新4型20event/10人最大ID/full busの容量を確認。実ブラウザー/端末/聴感/5v5勝率は未確認。旧固定投擲時計のordinary/fullmain fixture債務は別に保持する。

# キャップは？ / thirteenth character

Reference: bright swept red hair, round brown glasses, smiling face, navy hooded sweatshirt. Original low-poly full body on existing52-hit rig; no photo texture or identity assumption.

Comparison before implementation: duelist fog/lift/dash/knives; NOPE bomb/flash/decoy; MEND slow/fog/heal; IAGNU fixed contact/flash/speed; grass fog/slow/speed; ember bomb/future-flash mitigation/reload; frost ring/fog/slow relief; duck new-skill seal/shield/quiet/lethal guard; cat return/ammo removal/gun fetch/clock pause; car push/smoke removal/movement spread/refill; nobi vulnerability/fire interval/objective acceleration/body-head conversion; Japan border crossing/armor transfer/firearm return/dead-ally muster.

|Key|New effect and operation|Counterplay|
|---|---|---|
|C レンズブレイク|Equip/aim visible hostile40m, left confirm/right cancel.8s additional firearm aim dispersion and primary ADS lock.2x100. BOT firearms are affected too; cadence/ammo/skills unchanged.|Wall/smoke/flash prevents cast; close body fire, wait or cleanse. No blindness or ability seal; existing weapon spread remains.|
|Q クリアテイク|Equip/aim visible ally24m, left confirm/right cancel; self fallback when no ally aimed. Remove current blind and hostile targeted skill debuffs. No HP/armor/ammo change or future immunity.1x100.|Only current effects; standing in fields can reapply slow. Not future flash mitigation, healing or smoke deletion. No cast/stock use without a removable effect.|
|E バンクレンズ|Self6s/22sCD. Gun hits on vertical solid surfaces reflect up to3times,75% damage applied once, total path<=90m across all legs (normal-offset budget included). Physical ray/cover/decoys/shields still block. No target seeking.|Predict bounce geometry; fourth walls/floors/ceilings/shields/decoys/actors stop; never reflects knives/ULT projectiles; no invented enemy position. Not damage reflection (Japan), moving spread (car) or damage multiplication (nobi).|
|X エンドレスマガジン|7pt9s self. Existing loaded firearm bullets are fired without decrement. Cadence/recoil/spread/aim and reserve unchanged. Does not load an empty gun; normal reload still transfers finite reserve.|Enemy can wait or force reload. No new ammunition, refill, fire-rate buff or head conversion; differs from ember's one finite reload/car ordinary-skill refill.|

Host decides targeting, cleansing, ricochet hit/HP and ammo preservation. Guest predicts ability stock only; uses authoritative events for gun behavior. Twenty event cap rejects before mutation. Strict target IDs/times/coordinates; own death/team/round/menu cleanup. Existing12 models, floors and gun/step sounds unchanged. No UI superiority label.

## 第68巡：測定に基づくCの再設計（公開結果はworkspaceのcycle68-release）

人間指定：BOT対戦を繰り返し、発動・命中だけでなく勝利への貢献を調べ、強い技を基準に底上げする。既存CはBOTにADS機能がなく、対BOTの発動も禁止されていた。初回実地12ラウンド・120 actor appearancesの測定でもCAP Cは0回。これは技の効果とBOT方針の両方の欠陥であり、勝率だけで効果がないと断定したものではない。

採用：Cを「レンズブレイク」に改修。40m照準/視線内1敵、8秒ADS不可を継承し、通常銃弾へ追加の照準拡散0.07を与える。BOTの通常銃射撃は既存の命中モデルに0.55係数を適用する。追加5銃の実弾道・ローカル・遠隔hostの銃弾は同じ拡散補助で処理。ULTナイフ/近接/技のダメージ・速度・弾数は変更しない。狙う/左確定/右取消、2×100、host権威、20event拒否rollback、死亡/次R清掃を維持。煙/壁/視界外へ新たに索敵させない。

既存15人との比較：duelist移動/NOPE爆発閃光囮/MEND回復霧/IAGNU索敵/草と尾野の接地制御/EMBER装填と閃光耐性/🦆能力封印/猫の帰還回収/トミカの自己移動精度/のびの被害倍率と連射間隔/ジャパンの交差・装甲・反射/青ウニの装填/おんならの発砲HP代償は移植しない。CAPは敵の銃の照準を乱す妨害で、盲目・移動速度・射撃間隔・発射許可を変えない。近距離の胴撃ちや8秒の待機、味方CAPの解除で対処できる。Q/E/Xは今回変更せず、弱いままなら別巡で測定/再設計する。

公式参考：VALORANT Breach（https://playvalorant.com/en-us/agents/breach/）の構える/距離指定/射線を開く妨害、Overwatch Baptiste（https://overwatch.blizzard.com/en-gb/heroes/baptiste/）の危機対応支援と壊せる対処手段を確認。数値や能力そのものをコピーせず、「直後の撃ち合いで利点が生じ、対処可能で、結果を測れる」を判断基準にする。Ana公式は検索抜粋取得、本文403のため読了扱いしない。


## 第179巡 / 最新人間指定：3バウンド

Eの最大反射回数は3回。総経路90mを各反射で引き継ぎ、反射位置の法線biasも予算から引く。75%ダメージは回数にかかわらず一度だけ、最初のactorで停止。床/天井/盾/囮でも停止し、hostだけ実HPを確定する。6秒/22秒CD/銃のみ・非追尾を保持。本人の点線は同じ反射数学で最大3区間、static geometryだけから計算し、どの区間も煙に入れば非表示。20Hz/一つのInstancedMesh・最大128本を保持。

実savedgame6群（3反射命中/4枚目停止/総距離/第三経路の遮断とguest/点線と煙/host remote）、memory故障4、既存CAP8+実game22、SQLite25を検証。初回fixtureの鏡の厚みと法線bias、武器falloff、observer参照、煙radius不正はfixture側を修正し、製品条件は緩めない。公開状態はworkspaceの最新release記録が正本。実browser/新2tab/端末/聴感は未確認。
