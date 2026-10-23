# 効果音 / 第71巡

public/audio.jsのSAMPLE_CUESはスキル・通知82種を元のCC0素材で構成する。電子interface/forcefield音と非銃系のoscillator/hiss fallbackは使用しない。素材読取失敗時は無音で、遅延キューへ保存しない。銃声と足音/着地の元graphだけは保護する。

- 22追加素材・原文ライセンス3本・manifest・CREDITSを同梱。フリーはCC0/商用可を実資料で確認する。
- 元素材はOGGのbyteを変更しない。実行時mono/peak.85/lowpass/短fade/定位/距離処理を適用する。
- 音のgraphは最大3layers、同時48voice。source単位でなく最長layerが終了した時に全nodeを一度だけ解放。
- initのみfetch/decodeし、playはネットへ行かない。mute/suspended/not-ready/unknownは音を作らない。
- tests-audio.cjsは元70voiceのcold/ready/failed traceを固定SHAで監査し、全82cueの素材割当/合成0/peak/位置/清掃と部分失敗/無音を検証する。
- 音を出さない指示に従いoffline decode/数値検査/mockのみ。聴感確認はしていない。音色の好みや全素材の実スピーカー聴感を確認済みと説明しない。

## 第88巡 / ボンバーの聞き取りやすさ
- `plant`は既存CC0のbell .34/0.8秒、bookClose .25/.30秒、coins .12/.30秒(delay .20)の3層。設置確定は通知なので全員へ距離0/pan0/遮蔽なし。`spike`はcoins .42/.18秒+bell .18/.12秒。tickは方向維持・距離×.35・遮蔽減衰なし、従来の残秒別間隔を維持。
- SOUND OFF/master0/失敗decode/未読込を尊重。sample peak.85と全cue最大headroom .65、3layer/48voiceを既存mockで検証。保護gun/enemy/step/landの元70voice cold/ready/failed trace完全一致。新素材/合成音/遅延再生なし。
- 実音出力/試聴は行っていない。数値とmockの確認を聴感評価として説明しない。
