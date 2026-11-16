# WOMBのAO・間接光とマウス入力

WOMBの4フロア、吹き抜け、両階段にオフラインの照明ベイクを適用。練習のM →「WOMB照明」で同じ位置から従来照明と比較できる。既存3マップの照明・素材は維持する。

## ベイク

- 実際の静的メッシュからBlender 4.2 / CyclesでDIFFUSEのDIRECT+INDIRECT（albedo除外）とAOを計算。256 samples、最大6バウンス。頂点色による疑似AOではない。
- 2048角の照明とAOの2枚。1,431個のUVチャート、約10.2 texel/m、4pxの余白。チャート内だけsigma 1.2pxで間接光のノイズを平滑化し、周辺へ余白を延長。mipmapを無効にして隣接チャートの混入を防ぐ。
- 実天井へ取り付けた110灯をベイクに使用。2Fは暖色、4Fは寒色、階段・1F/3Fは中立寄り。上端の階段踊り場は、存在しない次の踊り場ではなく屋根へ照明を取り付ける。
- 実行時に110個の光源を追加しない。照明板は1つの描画バッチ、静的な床・壁は焼いた光を参照するBasic材質にする。従来の頂点色AOは重ねない。キャラクターと小物は既存の動的照明を保つ。法線・roughness・bumpテクスチャは追加しない。
- 2枚のGPU画像はRGBA8換算約32MiB（mipmapなし）。エンコード倍率は0.25。色調・材質・形状・光源設定の署名を照合し、不一致や読込失敗では従来材質を使う。キャッシュキーは実PNGのSHA-256から生成する。
- 明るい照明で露見した吹き抜けの床縁の重複面を修正。壁に覆われる各区間を引いてから縁を生成し、出入口の区間は残す。当たり判定・通路寸法は不変。

これは静的な拡散光のベイク。移動する人物の影・スキルの色移り・鏡面反射のGIまで焼いたものではない。建物崩壊時は従来材質へ戻す。旧TRCのUV生成・読込処理を共通化したが、TRCの署名・32素材ファイル・チャート数は回帰試験で保持を確認。

再生成（リポジトリ内、PowerShell）：

```powershell
node scripts/export-womb-bake.mjs "$env:TEMP/womb-bake-input.json"
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' --background --factory-startup --python scripts/bake-trc.py -- "$env:TEMP/womb-bake-input.json" public/lightmaps/womb
node tests-womb-lighting.cjs
```

独立したbackground/factory-startupプロセスを使い、作業中のBlenderシーンは触らない。`scripts/bake-trc.py`は入力のstageから出力先メタデータ名を決定する。TRCの従来コマンドも互換。

## Edge向け入力経路

Pointer Lock中に実際のマウスの`pointerrawupdate`を受け取ったら、その経路で角度を即時更新する。通常の`mousemove`は同じ移動を再度加算しない。ブラウザーがrawイベントを送らなければ従来のmousemoveが動き続ける。ロック前後や一時停止の切り替えで選択をリセットし、タッチ・ペン・非主ポインターは切り替えに使わない。

rawパケット自体が合算済みのため`getCoalescedEvents()`を再加算しない。raw経路の大きな合算移動は旧500px制限で捨てない。非有限値の排除、ロック開始時の再センタリング保護、非ロック時の座標飛び対策、感度0.35、`unadjustedMovement:true`の要求とNotSupportedErrorのみのfallbackは保持。

仕様上、pointerrawupdateはフレームに合わせて遅延・合算され得るpointermoveより早い配送を目的とする。ただし物理マウス→画面表示の遅延をゼロにする保証ではない。[W3C Pointer Events](https://www.w3.org/TR/pointerevents3/#the-pointerrawupdate-event)、[Pointer Lock 2.0](https://www.w3.org/TR/pointerlock/)。

`?inputTrace=1`の既存ローカル診断に`mouseEventSource`を追加。送信や永続化はしない。フレーム診断のbakeは読込完了かつ有効な場合だけtrue。入力テストは実game.jsへの合成イベントであり、Edgeの実マウス入力や表示までの遅延を測ったものではない。接続ブラウザーは内蔵ブラウザーのみのため、Edgeでの本人の体感再確認が必要。

## 検証

`tests-womb-lighting.cjs`は実PNGの寸法とハッシュ、UV余白、4階と階段の照明取付面、吹き抜けの重複除去、比較・崩壊・失敗時fallbackを検査する。`tests-mouse-low-latency.cjs`はraw/compat二重処理防止、フレーム前の角度更新、合算flick、旧ブラウザー、入力種別、pause/death/lockを検査。negative版は二重処理・raw無効化・flick破棄を検出する。

既存のmouse-look/continuity/input-trace/raw-inputと各negative、WOMBの15グループ・90回歩行、TRC照明の回帰試験を合わせて実施。実回線10人対戦、Edgeの物理遅延、全スキルの照明演出は未検証。

消音した所有の内蔵ブラウザーでA/Bと階段の表示、照明比較、実キーによるS1の1F→4F連続歩行を確認。Aの静止視点でベイク前後ともフレーム間隔中央値16.7ms・P95 16.8ms。追加の描画落ちはこの条件では見られなかったが、60Hzでの観測でありGPU時間やマウスから表示までの遅延の測定ではない。
