# キャップは？ / thirteenth character

Reference: bright swept red hair, round brown glasses, smiling face, navy hooded sweatshirt. Original low-poly full body on existing52-hit rig; no photo texture or identity assumption.

Comparison before implementation: duelist fog/lift/dash/knives; NOPE bomb/flash/decoy; MEND slow/fog/heal; IAGNU fixed contact/flash/speed; grass fog/slow/speed; ember bomb/future-flash mitigation/reload; frost ring/fog/slow relief; duck new-skill seal/shield/quiet/lethal guard; cat return/ammo removal/gun fetch/clock pause; car push/smoke removal/movement spread/refill; nobi vulnerability/fire interval/objective acceleration/body-head conversion; Japan border crossing/armor transfer/firearm return/dead-ally muster.

|Key|New effect and operation|Counterplay|
|---|---|---|
|C レンズブレイク|Equip/aim visible hostile40m, left confirm/right cancel.8s additional firearm aim dispersion and primary ADS lock.2x100. BOT firearms are affected too; cadence/ammo/skills unchanged.|Wall/smoke/flash prevents cast; close body fire, wait or cleanse. No blindness or ability seal; existing weapon spread remains.|
|Q クリアテイク|Equip/aim visible ally24m, left confirm/right cancel; self fallback when no ally aimed. Remove current blind and hostile targeted skill debuffs. No HP/armor/ammo change or future immunity.1x100.|Only current effects; standing in fields can reapply slow. Not future flash mitigation, healing or smoke deletion. No cast/stock use without a removable effect.|
|E バンクレンズ|Self6s/22sCD. Gun hits on vertical solid surfaces reflect once,75% damage, total path<=90m. Physical ray/cover/decoys/shields still block. No target seeking.|Predict bounce geometry; second walls stop; never reflects knives/ULT projectiles; no invented enemy position or repeated bounce. Not damage reflection (Japan), moving spread (car) or damage multiplication (nobi).|
|X エンドレスマガジン|7pt9s self. Existing loaded firearm bullets are fired without decrement. Cadence/recoil/spread/aim and reserve unchanged. Does not load an empty gun; normal reload still transfers finite reserve.|Enemy can wait or force reload. No new ammunition, refill, fire-rate buff or head conversion; differs from ember's one finite reload/car ordinary-skill refill.|

Host decides targeting, cleansing, ricochet hit/HP and ammo preservation. Guest predicts ability stock only; uses authoritative events for gun behavior. Twenty event cap rejects before mutation. Strict target IDs/times/coordinates; own death/team/round/menu cleanup. Existing12 models, floors and gun/step sounds unchanged. No UI superiority label.

## 第68巡：測定に基づくCの再設計（公開結果はworkspaceのcycle68-release）

人間指定：BOT対戦を繰り返し、発動・命中だけでなく勝利への貢献を調べ、強い技を基準に底上げする。既存CはBOTにADS機能がなく、対BOTの発動も禁止されていた。初回実地12ラウンド・120 actor appearancesの測定でもCAP Cは0回。これは技の効果とBOT方針の両方の欠陥であり、勝率だけで効果がないと断定したものではない。

採用：Cを「レンズブレイク」に改修。40m照準/視線内1敵、8秒ADS不可を継承し、通常銃弾へ追加の照準拡散0.07を与える。BOTの通常銃射撃は既存の命中モデルに0.55係数を適用する。追加5銃の実弾道・ローカル・遠隔hostの銃弾は同じ拡散補助で処理。ULTナイフ/近接/技のダメージ・速度・弾数は変更しない。狙う/左確定/右取消、2×100、host権威、20event拒否rollback、死亡/次R清掃を維持。煙/壁/視界外へ新たに索敵させない。

既存15人との比較：duelist移動/NOPE爆発閃光囮/MEND回復霧/IAGNU索敵/草と尾野の接地制御/EMBER装填と閃光耐性/🦆能力封印/猫の帰還回収/トミカの自己移動精度/のびの被害倍率と連射間隔/ジャパンの交差・装甲・反射/青ウニの装填/おんならの発砲HP代償は移植しない。CAPは敵の銃の照準を乱す妨害で、盲目・移動速度・射撃間隔・発射許可を変えない。近距離の胴撃ちや8秒の待機、味方CAPの解除で対処できる。Q/E/Xは今回変更せず、弱いままなら別巡で測定/再設計する。

公式参考：VALORANT Breach（https://playvalorant.com/en-us/agents/breach/）の構える/距離指定/射線を開く妨害、Overwatch Baptiste（https://overwatch.blizzard.com/en-gb/heroes/baptiste/）の危機対応支援と壊せる対処手段を確認。数値や能力そのものをコピーせず、「直後の撃ち合いで利点が生じ、対処可能で、結果を測れる」を判断基準にする。Ana公式は検索抜粋取得、本文403のため読了扱いしない。
