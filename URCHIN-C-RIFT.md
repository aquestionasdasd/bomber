## 第210巡 / 青ウニC・潮割りの水流と裂け目

所有者指定：今回はCのみ。Cで構えて敵情報を読まない幅1.3m/最大40mの壁クリップ予測を表示し、左で確定/1個消費、右で無料取消。確定位置と方向を固定し、共通clockの.65秒後に敵へ80rawを一度だけ通常装甲・死亡/撃破処理で与える。その瞬間から地面の裂け目を2.5秒残す。接地した敵の外→内と高速横断を掃引で検知し、接触位置の水しぶき/波紋/減衰・遮蔽付き音を通知する。内部静止と生成時の在中者は連発せず、再侵入は同一人.5秒待ち。空中/別階/壁越しの接触なし。残留ダメージ/輪郭/ミニマップ/名前HP/潮痕やスロウは追加しない。C2個/100coin。URCHIN_LANCEへ数値を集約し、hostだけ接触を更新、guestは最大20件の厳格7整数world pulseを描画する。20event/10人64字ID/全バスは62531B/65536B。Q/E/X、他15人・音源素材/地形/銃/HTTP頻度を保持。URCHIN-C-RIFT.md参照。fps-19はPAUSED。

Cの攻撃は既存の固定3D射線を再利用し、装甲/味方除外/横回避/遮蔽/複数対象/killとcoinは通常処理。Idleはeventなし、Aimingはgeometry-only preview、Telegraph/Strike/Residual/Expiredは同じstartedAt/triggerAt/endsAtから算出。Strikeの短い.2秒表示も残留2.5秒の内数とし、判定と演出に別timerを置かない。構え中のCはshoot入口でも銃を止める。既存の死亡/team切替で本人のCが消える規則を維持する。

地面は固定射線から最大2.5m下の実支持床へ投影し、足元のrayと±.22m床差で壁/別階を除外する。前後とも接地した移動区間を幅1.3mの有限帯へ解析的にclipし、外→外の高速横断も拾う。ジャンプ横断は通知しない。最初のサンプルは在中者の基準だけを保存し、対象ごとの.5秒待ちと内外状態を各cast別に管理する。死亡/別team/次R/menu/期限でhistoryを清掃。攻撃後は監視のみで追加ダメージなし。

C描画は専用の再利用水メッシュ8192/棘512の上限付きプール。水色の予告線/集まる水/白い飛沫/両側の水棘/低い青い裂け目/泡/減量fade/接触の波紋としぶき。地面の実視線・煙・閃光/近視と通常depth test/writeに従い、壁越しのpinや敵輪郭は出さない。C音は既存liquid/air/glass/soft素材を組み合わせた発動・直前圧力・命中・侵入recipeで、通常の距離減衰/左右/遮蔽を使う。侵入音の遮蔽ray終端は地面+.08m。BOTは音がした固定地点を既存land半径15m/壁減衰で聞くのみで、敵参照・現在地・射撃許可は渡さない。音素材byteや他cueは不変。

通信はCeventの16fieldと最大20件のrifts配列（event index/通番/接触cm座標3つ/時刻ms/kind）。在庫の予測と拒否rollbackは既存actionを使用。hostの接触標本をguestが復元しても判定権威は得ず、重複標本の音を再生しない。host確定の公開world FXなので両teamへ送り、敵のIDやHPは含めない。新しいactor fieldやHTTP頻度は追加しない。

調整値：range40,width1.3,telegraph.65,damage80,residualDuration2.5,maxStock2,price100,entryCooldown.5。描画/運用値はstrikeVisual.2,pulseDuration.45,pressureLead.12,groundDrop2.5,groundTolerance.22,segmentLength.5,maxPulses20,maxActors10。命中効果のlanceHitEffectが将来状態異常との連携点。潮痕/25%slow/.8秒は未実装。

検証：専用engine8/故障4、実保存game6（20/60/144Hz）、専用FX4、既存C実game10/契約5/故障4、青ウニ共通6・E契約8/実game9、固定baselineのQEX/他15人と非C音recipe比較2、知覚8/戦術14実地4seed/SQLite27、草Q実game8/短文6。実ブラウザー/WebGL/新2tab/スマホ/聴感/通常5v5寄与は未確認。既存ordinary/fullmain固定投擲clock fixture債務を保持。
