# 効果音 / 第71巡

public/audio.jsのSAMPLE_CUESはスキル・通知82種を元のCC0素材で構成する。電子interface/forcefield音と非銃系のoscillator/hiss fallbackは使用しない。素材読取失敗時は無音で、遅延キューへ保存しない。銃声と足音/着地の元graphだけは保護する。

- 22追加素材・原文ライセンス3本・manifest・CREDITSを同梱。フリーはCC0/商用可を実資料で確認する。
- 元素材はOGGのbyteを変更しない。実行時mono/peak.85/lowpass/短fade/定位/距離処理を適用する。
- 音のgraphは最大3layers、同時48voice。source単位でなく最長layerが終了した時に全nodeを一度だけ解放。
- initのみfetch/decodeし、playはネットへ行かない。mute/suspended/not-ready/unknownは音を作らない。
- tests-audio.cjsは元70voiceのcold/ready/failed traceを固定SHAで監査し、全82cueの素材割当/合成0/peak/位置/清掃と部分失敗/無音を検証する。
- 音を出さない指示に従いoffline decode/数値検査/mockのみ。聴感確認はしていない。音色の好みや全素材の実スピーカー聴感を確認済みと説明しない。
