# ECHO QのCPU回帰検査

共有リポジトリの `tests-bot-echo-glint.cjs` を、現在の投擲とゲーム更新に合わせた。製品のCPU判断、技性能、公開ソースとSites v254は変更しない。

旧fixtureは `updateBots` と状態異常だけを個別に進め、固定0.51秒後や開始から0.65秒で閃光を期待していた。現在の低速投擲では、平坦な60Hz制御で14m先の敵へ約1.057秒、20m先へ約1.597秒の飛行を要する。修正後は `updatePlay` を各frame一回だけ実行し、受理された実eventの `triggerAt` まで進める。到達を待つための時計の直接変更や、技の飛行時間の短縮は行わない。

20/60/144Hzで、到達直前は敵も本人も閃光なし、到達後は敵だけに元の2秒間の閃光、終了直前まで効果あり、期限後に解除、在庫一個消費とメニューでの清掃を確認する。他の群では、近すぎる自爆、味方の向きと壁による保護、露出した味方、実際の射程、敵の背向け、壁・煙・古い目撃、失明・host停止・guest・remote・死亡・非live、20event満杯のrollbackと既存再試行を保持する。予測照会は状態を書き換えず、復元した表示eventには命中権威が戻らないことも検査する。

失明による使用拒否のfixtureも、旧時刻へのNOPE閃光の挿入を廃止した。現在の1秒信管で成立する実投擲先を正規の処理で求め、実際に失明してからECHOの使用拒否を確認する。これは検査の前提状態を作る操作であり、NOPEやECHOの製品仕様を変更しない。

8群と、既存の自爆安全無視・顔直下への誤投擲・距離だけの味方判定・敵の露出無視の4つのメモリ内故障検査が成功。Nobi C/Qのfixtureがこのファイルの構成部分を利用するため、関連14群と7故障も再検証した。固定CIの検査や条件は変更しない。

```text
node tests-bot-echo-glint.cjs
node tests-bot-echo-glint-negative.cjs
node tests-bot-nobi-fields.cjs
node tests-bot-nobi-pending.cjs
node tests-bot-nobi-fields-negative.cjs
node tests-bot-nobi-pending-negative.cjs
```

baseline用の9/14/20mの3制御は、9mの初回判断での使用拒否と、14/20mの実受理・到達・2秒閃光を別々に記録する。静止相手と固定役割の平坦なVM検査であり、通常5v5の勝率・与ダメージ・本人の設置解除寄与が改善したという根拠にはしない。実ブラウザー、GPU、端末、実通信、聴感は未検証。共有の旧fixture債務は残り4suiteと第241巡の2件を保持する。Sitesソース側の旧fixtureは変更していない。
