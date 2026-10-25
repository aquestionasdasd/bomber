## 第124巡 — 乗っ取り中バスの反復クラクション

運転席を実際に奪ったバスだけ、その車体位置から0.72秒の二音クラクションを即時/以後1.5秒間隔で鳴らす。停車・燃料切れでも運転席にいる間は継続。乗車だけ/中立運転手撃破だけでは鳴らさず、降車/死亡/チーム変更/非live/次R/menu/地図変更で反復を停止。短い再生済み一音の末尾は自然に終了する。

host確定の既存owner姿勢を各clientが読むだけ。guestのF予測は鳴らさず、busTransit/event/HTTP頻度を増やさない。4台それぞれ独立時計、低/高Hz・同snapshot重複でも多重化せず、遅延や再開時の追いつき連打なし。guestのsnapshotによる小さな時計巻戻りでは再鳴動せず、新round/reconnectの確定境界だけ時計を清掃。非表示/host停止は無音。SOUND OFF/音量0/遠距離/読込中失敗もその回を消費し遅延再生しない。既存65m/距離/左右定位/遮蔽/48voiceを使う。

bus-horn.wavは同梱generatorによるプロジェクト独自の185/233Hz基音+倍音PCM、外部録音の転用なし。既存107cue・共同編集10銃/ナイフ・元8素材byte・足音着地34voice/順序・提供MP3は保持。PCM/無音mockで確認し、実音/聴感・実端末・実2タブは未確認。

## 第115巡 — 共同編集版の銃撃音を公開経路へ反映

人間から共同編集者の銃撃音が反映されていないと報告。第103巡で旧「銃声維持」指定に従い、PR54内のPR49から銃声だけ取り込まなかったことが原因。最新の人間指定を優先し、全10銃とナイフの録音recipeを共同編集版と同じ素材/音量/速度/長さで採用する。発射・敵発射の双方へ適用し、既存の距離/左右定位/遮蔽/48voice/清掃/消音を保持する。読込中・失敗は無音で遅延再生や旧合成銃声を重ねない。

足音/着地の元再生graph・交互順・元8素材byteは保持。命中/キル、ユーザー提供車両2MP3、スキル/UI/TRC/ジャンプ、BGMを維持。今回の銃声変更に関して旧保護70voiceの全一致を要件にしない。変更前に採取した足音/着地34voiceのcold/ready/failed固定traceを保護し、全銃本人/敵と不正名fallback/読込失敗/定位/消音/解放を無音mockで検査する。共同素材4本をoffline decode/有限PCM/長さ/peak/RMS/SHAで確認し試聴しない。全員BOT強化や聴感確認ではない。

公開/GitHub/最終試験はworkspace cycle115-release.json と cycle115-test-report.jsonを正本とする。main/知人branchをmerge/forceせず、現行更新を保つ。最新指示は銃声のみを旧保護条件から外し、足音/着地保護と無音検証は継続する。

## 第109巡 — 銃弾の命中・キル確認音

- 人間指定により、実銃弾で敵のHP/装甲が減った本人へ短い打撃の確認音、致死弾には別の打撃＋短いピチカートのキル音を追加。致死弾で通常命中音を二重に鳴らさず、散弾は既存の1標的/1カートリッジ集約後に1回。
- 既存収録素材 lab-punch-light1（効果音ラボ）と jingle-PIZZI07（Kenney CC0）を再利用。機械音生成なし。通常の銃声/敵銃声/足音/着地の保護70voice traceと元8素材、指定車両MP3は保持。
- hostの実ダメージ確定点から発行し、guest予測では鳴らさない。既存cueのseq/round/idを使い本人だけ無定位/距離減衰なしで再生、最後の撃破のpost snapshotも受理。重複/旧R/古い・未来・不正/fresh再参加は無音。消音/volume0/読込中は消費し後で鳴らし直さない。通信fieldとHTTP頻度は追加せず、容量超過時は既存の古いcosmetic cue削減のみ。
- 実savedgame8群/全10銃/独立hostguest JSON/3メモリ故障検出、録音mock4群（全96cue、保護70voice cold/ready/failed exact）、実SQLite21群、既存arsenal12/演出8/フルコンボ7/購入ACK9が成功。専用2素材はoffline decode/有限PCM/長さ/peak/RMS/SHAを確認。64確認cue＋4待機バス＋構造破壊＋10人は63919B/65536、既存最大65522Bを保持。
- 最初のguard fixtureはHP1→HP1で実損失0だったため期待が誤り。HP50→HP1の実損失を持つ標本へ修正し製品判定は変更していない。初回停止logを保持。全main反復なし、旧床ボンバー/4キーfixture債務は未解消。
- 音再生/試聴/ブラウザー/server起動なし。音質の聴感、実2タブ/実端末は未確認。公開・共有の確定SHA/結果はworkspaceのcycle109記録を正本とする。

## 第103巡 / 共同開発音源の統合

PR54内のPR49の録音skill/UIと専用jump/羽ばたき/TRC音を統合。旧gun/step/landの保護graphと8素材、ユーザーの2MP3は維持し、94非銃cueを使用。PR49の銃声・足音差し替え部分は既存の所有者指定に従って採用しない。30同梱素材はmanifest SHA照合とoffline decodeで有限PCM/最大peak.785未満を確認し試聴しない。

[CREDITS](public/audio/CREDITS.txt)の対象を実割当へ訂正。公式条件は[効果音ラボ](https://soundeffect-lab.info/agreement/)、[On-Jin](https://on-jin.com/kiyaku.php)、[OtoLogic](https://otologic.jp/free/license.html)を照合。素材単体の再配布を目的とせず個人制作ゲームへの組込、OtoLogic/On-Jin表記・出典・加工記録を同梱。企業事業へ用途を変えるときはOn-Jinの条件を再確認する。

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
