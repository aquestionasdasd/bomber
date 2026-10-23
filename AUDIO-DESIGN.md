## 第99巡 / 車両命中へユーザー提供音

人間提供「打撃8.mp3」をbyte変更なしのvehicle-impact-user.mp3として同梱。約1.064秒/48kHz/stereo/27072B、SHA ae00f7eee68c22f65d1800f52b545ec73930b30f4253d4b54bc877fa3b21cc01。ユーザーのゲーム内使用指定に基づく素材で、KenneyのCC0素材と分けてmanifest/CREDITSへ記載しCC0とは称さない。外部素材の取得はしていない。

バスの対人接触とトミカC本体突進の実接触時だけvehicle-hitを一度発行。空振り/発動開始には追加音を出さない。host確定の既存連番cueで本人/周囲へ共有し、被弾者がguest本人でも再生。guestの予測では発行せず、重複/旧R/古い時刻/未来/新規再参加の過去音は消費して再生しない。距離/向き/遮蔽/SOUND OFF/音量0を保持。読込待ち/codec失敗は無音、遅延再生なし。

新音は一層/gain.65/rate1/全長、既存mono/peak.85/48voice上限を使用。既存スキル82cueは維持し現83cue。銃声/enemy/足音/着地の元70voice cold/ready/failed graphと素材byte/順序は既存SHA検査で保持。バス破壊/車体/ダメージ/技能/15人52命中面/HTTP頻度/通信fieldは変更しない。

音源のoffline decode/有限PCM/長さ/peak/RMSと既存録音mock4群、実savedgameバス11群（新receipt2群/命中一回/無音消費/位置）、トミカ19群（新命中/空振り1群）、実SQLite20群PASS。初回のMP3に旧Ogg専用期待を適用したテスト編集と、テストがconst配列へ再代入した失敗を訂正し、製品判定は緩めていない。全mainの再実行なし。

今回browser/tab/server起動なし、音再生/試聴なし。実スピーカーでの音色/音量と実2タブの新効果音は未確認。公開/GitHub/build/packageの最終確定はworkspace cycle99-release.jsonを正本にする。知人PR49/54はhead不変で未統合のまま保全。

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
