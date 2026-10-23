## 第102巡 / バス接触地点の大量破片と提供破壊音

人間指定で、破壊区画の中心ではなく、実壁/柱の足跡と向き付きバス車体の交差部分から破片を出す。薄い壁/回転/前後進/屋根高を扱い、229破壊単位/58桁mask/地形・支持・ダメージ・運転性能は保持。1接触18→96片、同時上限96→768片、粉じん6→24/同時48→192、波紋8、描画3draw。破片2.6秒/粉じん2.2秒で消滅し、戦闘乱数を消費しない。復元時は既存のhost接触cueの位置を優先し、無い場合は承認済みバス姿勢との交差を使う。位置情報が失われた旧状態は既存の区画内fallback、途中参加に過去の飛散を再生しない。

添付「岩が真っ二つに割れる.mp3」をbus-wall-break-user.mp3としてbyte変更なしで同梱。137088B/5.548秒/44.1kHz/stereo、SHA d1cce96561699734a68acb931c204d928c44b75bf57bdd804017a21283e4251d。ユーザーの使用指定に基づく素材でCC0とは称さず、manifest/CREDITSへ別記。bus-break一層/gain.55/rate1/全長、同じ車両は750ms以上空け、新たに壊れた時だけ発行。空振り/同じ壁/遅い車/定期便/guest予測では追加音なし。host確定の既存cueで位置を共有、重複/旧R/未来/650ms超/非有限/範囲外/freshは消費して再生しない。SOUND OFF/volume0/素材読取失敗は無音・遅延再生なし。既存の銃声/足音/着地70voice graphと元8素材は保持、現84録音cue。

新contact6/実savedgame独立JSON6/3memory故障、既存破壊7/建築7/実破壊5+建築6/乗車11/queue4/起爆8/録音mock4/SQLite20を確認。20/60/144Hzの絶対時刻/有限行列/768上限、同R重複/次R復元、host位置cue/距離と一度再生を検査。新64破壊cue+4待機バス+全破壊+10人の容量標本も65536B以内で権威fieldを削らない。全mainは反復しない。

hidden198は初手OFFfalse/AX0。枚方練習で乗車/実銃driver撃破/F運転/W+D走行、屋内の接触で飛ぶ破片をcycle102-bus-impact-local.pngへ実撮影、warn/error0。最初に路上で轢かれた試行はrestartから再開し、状態注入はしていない。198閉鎖/8061保持sessionから停止/listener0/NOPEhashimotostandardattacknormal復元、ユーザータブ/OS/他アプリ不操作。再生/試聴なし。実2タブ新破片/音・実端末・聴感・性能FPSの実測は未確認。知人PR54は8ae5826470e4c4f7c271f9b2d224343d8be4dd1aへ更新されたが未merge/未統合、PR49も保全。公開/GitHub最終IDはworkspace cycle102-release.jsonが正本。

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
