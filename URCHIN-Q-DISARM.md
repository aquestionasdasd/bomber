## 第211巡 / 青ウニQ・棘抜きの予告と主武器争奪

所有者指定：今回はQのみ。Qで青い棘を構え、実hit surfaceで狙った可視32m以内の敵の購入主武器1個へ左確定・右無料取消。確定時に1個消費して対象/主武器instanceを固定し、共通clockの.45秒後に通常dropへ移す。壁/煙の視線切れは連続.10秒で失敗し、射程外/死亡/team変更/既に手放したinstanceでも失敗、消費は戻さない。副武器/ナイフへの切替だけでは避けられず、弾倉/予備弾を保持して副武器→ナイフへ持ち替える。主武器は短い衝突検査済み放出後に通常F拾得となり、両軍が同じ残弾で回収可能。0damage/0stun、Q1/100coin。専用opaque depth FX/短い通知/既存素材recipeを使用。C/E/X・他15人・音源byte/地形/銃/HTTP頻度を保持。URCHIN-Q-DISARM.md参照。fps-19はPAUSED。

QのライフサイクルはIdle（構え/eventなし）、Aiming（duckAim=q、青い手元棘と専用照準、銃発射入口も停止）、Casting（通常eventのstartedAt/triggerAt=.45）、Success/Interrupted（厳格な2整数disarm状態）、Recovery（通常装備、短いFX tail1.2）を既存入力とeventへ組み込む。別のtimerや同期ライブラリは作らない。照準は既存THREE raycast/可視hit surfaceを使い、手前の壁/味方で遮断、実visibleBetweenの壁・煙・閃光/近視を守る。毎frame全員の主武器を総検査せず、構え時のrayと発動済み対象だけを見る。

主武器分類はWEAPONSのprimary/価格>0/mag>0を使用する。発動時の実actorと主武器をWeakMapの所有tokenで保持し、通常drop/pickup/購入でtokenを無効化する。装備変更は無効化せず、既に手放して同種類を拾い直した場合も別instanceとして中断する。既存インベントリは種類文字列＋弾倉/予備弾storeで、独立したskin/attachment/custom状態は存在しない。その既存状態だけを移し、未実装の外観状態を新造しない。

hostの更新だけがdropを確定する。既存dropItem/addDrop/serializeDrops/syncDrops/pickupDroppedWeaponを共用し、主武器storeと購入ledgerから所有を除去、装填を取消して所持副武器/なければナイフへ持ち替える。既に非装備なら保存済み残弾を使う。pickupはworld itemを同期的に先に消費してから通常インベントリswapし、同時Fでも1回だけ成功。BOTの拾得でも通常残弾storeを使う。

放出は対象足元+.2mから前方最大.75m、上初速2m/s/重力15。実支持床と歩行可能範囲、段差/壁/traffic/map端を調べ、全放物線を120Hz相当以上のswept sphereで事前確認する。低天井では上初速0、前方が塞がれば垂直落下、成立経路がなければ在庫消費済みの不成立となり武器を動かさない。地下TRCはmap.minY=-3.2を尊重する。終点cm/角度.001radと5整数motion（始点cm×3/開始ms/上初速cm毎秒）を同期し、guestも同じ式で描画。空中では実床へ落ちる。飛行中は重複拾得を防ぎ、着地後に通常F/1.5m、敵味方共通で取得可能。専用の所有者lockや時間消滅なし。既存32drop容量が満杯なら発動前は消費なし、発動後に満杯になれば不成立。Q由来のworld武器を通常容量整理で自動削除しない。

在庫は既存guest予測/host ACK rollbackで、guestは主武器やworld itemの権威を持たない。Qeventだけに購入主武器idとdisarm:[phase,dropId]を加える。phase0待機/1成功/2失敗、成功だけ正のdropId、成功前時刻/不正tuple/副武器idは厳格拒否する。新actor field/HTTP頻度なし。20Q/64字source target/32飛行drop/10actor/全バスは65457B/65536B、再現可能な既存cueだけ削減しactor/event/dropは保持。

描画は専用moduleの青い棘/手元モデル/縮む照準/小マーカー/伸びる棘/細いthread/成功収縮/失敗破砕。opaque depthTest/writeと実視線/煙を使用し、thread途中も可視確認、壁越し輪郭や正確なmap pinは出さない。既存audio素材のair/liquid/glass/metalをQ専用recipeに組み合わせ、ロック/発動/直前警告/成功/失敗を既存距離/左右/遮蔽処理で鳴らす。所有者PCでは一切再生せずmock記録のみ。被弾本人に「主武器を奪われた！」1.2秒と、落下地点が見える場合だけ8方向の小文字indicator。本人camera kickは小さく、reduced motionでは抑制。

調整値はURCHIN_DISARMに集約：range32/delay.45/occlusionGrace.10/maxStock1/price100/damage0/tail1.2/warningAt.30/growthAt.15/notice1.2/dropDistance.75/dropDuration.30（転がり表示）/dropGravity15/dropUpSpeed2/pullDistance2/pullDuration.25。潮痕付与・2m引寄せは未実装で、tidePull adapterは常にnull。通常dropのみで完結する。C/E/X・他キャラの実処理を変更しない。

検証：専用controller7/メモリ故障4、実保存game13（20/60/144Hz）、FX3、固定pre-Q sourceのCEX/他15人/非Q音recipe比較2。既存青ウニ20group/C10/C残留6/E9/共通6、cat13/通常dropの10銃geometryと1198dispose、知覚8/戦術14実地4seed/SQLite27。実browser/WebGL/新2tab/スマホ/聴感/通常5v5の戦績は未確認。手動確認はSOUND OFFからQの手元/照準/0.45秒警告/落下/F回収を両チームで行う。旧ordinary/fullmain固定投擲clock fixture債務は保持。
