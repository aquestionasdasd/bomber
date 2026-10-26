## 第162巡 / 勝利BGM「Break the dancefloor!!」追加（手動依頼）

所有者提供btdf.wavをbyteそのまま同梱。PCM24 stereo/44.1kHz、約14.403秒、SHA f22110b562f125df2884cebeabade3d03d4ddaed961cfa1fe83d4b3288be386e。sandstormを残してタイトル/一時停止の既存勝利BGM画面を2曲のradioへ。選択曲ID/既存ONOFF/音量をブラウザーに保存し、未指定/不正IDはsandstormへ。設定変更は前音源を停止/解放し、新しい曲を無音で事前読込。次の新しい本人チーム勝利から使い、既に消費した勝利は再生し直さない。読込失敗/古いplay reject/timer、mute/hidden/停止/次R/menuと15秒/非loopの既存契約を保持。アップロード/試聴追加なし、銃/足音/キル音/通信/強さ不変。

既存BGM mock8群/新2曲mock8群/事前読込mock8群/クラブmock6群と実game、提供PCMの有限数値/peak/RMS/SHAを検査する。公開/GitHubと最終検証結果はworkspace cycle162-release/test-reportを正本とする。聴感/新実browser/2端末未確認、全main旧fixture債務を保持して無用反復なし。音再生/ユーザータブ/OS/他アプリ操作なし、自動fps-19はPAUSED維持。

## 第147巡 — 命中音の打撃位置と明瞭さ（手動依頼）

人間「敵に弾が当たった時効果音ほしい」に対応。既存gun-hitは録音先頭120msだけを使い、実PCMの主打撃164.417msを切っていた。既存lab-punch-light1の145msから55msを使い、onjin-latchを同時に短く重ねる。全体90ms、追加遅延なし。2層gain合計.74、デコード上限.85で保守的peak上限.629。素材byte/商用条件/出典は既存manifestを維持し、ダウンロード/合成/試聴なし。

host確定の敵HP/装甲損失だけ本人へ1回、散弾は1標的/カートリッジ、guest予測・壁・デコイ・空振り・味方・実損失0は無音。キル時は既存の自作160BPM/5段階音を使い通常命中音を二重に鳴らさない。これらの権威/seq/round/id/重複清掃/消音処理は変更しない。本人通知は無定位/距離減衰なしを保持。

全113cue中、他112recipe/共同編集全銃声/足音着地graph/交互順/提供素材/BGMは保持。録音mock4、実savedgame命中8と故障3、自作キル7と故障4、銃声定位5を無音で確認。2素材PCMと製品envelopeを使うoffline参照モデルはpeak .09876→.38475、RMS .02540→.09069（master1/mono/48kHz）だが、Chrome実出力/聴感/聞こえやすさの保証ではない。実端末/新実2タブ/人間の聴感は未確認。最終source/公開/GitHubはworkspace cycle147-release/test-reportを正本とする。自動fps-19はPAUSED維持。

## 第137巡 — 勝利BGMの事前読込と再利用

勝利時に初めてAudioを生成しpreload=none、停止時にsrcを外していたため、毎回の読み込み待ちが発生し得た。最初の画面で音量/BGM/SOUND/非表示gateを反映後、preload=auto/loadで再生せず準備する。開始/再開の入力でも準備を再確認。勝利時は同じmediaを先頭から再生し、停止/次R/menuでは一時停止と巻戻しだけ。破棄時と読込/再生エラー時にだけsrcを解放する。失敗したmediaは次の準備で再取得する。

勝利keyの重複/敗北/fresh再参加/消音/音量0/非表示は従来どおり消費し鳴り直さない。待機playをpauseで停止、再利用時は世代番号で古いplay reject/停止timerを無効化。新しい勝利を過去の非同期失敗で消さない。15秒上限、設定画面の試聴なし、提供sandstorm WAVのbyte/設定/音量は維持。銃/足音/キル音/勝利カメラ/通信は変更しない。

700msの仮想ロードmockで勝利前の準備後は結果と同じ時刻にplay開始、5勝しても1media/1loadを検査。これは実Chromeの開始時間や聴感の実測ではなく、ブラウザーのpreload方針/回線による初回読込完了は保証しない。専用準備8群、既存BGM8、実勝利カメラ7、録音mock4、実命中音8を無音で検査する。最終公開/GitHubはworkspace cycle137-release/test-reportを正本とする。

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

## 第129巡（手動依頼） — 制作された5段階キル音

所有者制作のkillsound.wavをbyte変更なしで同梱。160 BPMの1/3/5/7/9拍目（0/.75/1.5/2.25/3秒）をラウンド内の1〜5キルへ割当てる。最初の4音は次音直前で切り、5音目は末尾の余韻まで再生する。速度1/既存mono・短fade・master/SOUND OFF/48voiceを使用。訓練や復活で6キル以上になったら5音目を使う。

hostが実撃破時に本人別/ラウンド別の順番を確定し、既存cueのtypeだけをkill-1〜kill-5へ変えてguest本人へ届ける。銃/ナイフ/スキル/対敵車両の撃破が対象。味方・運転手・デコイ・非致死・拒否予測は進めず、重複/旧R/初回同期/古い/未来の受信・mute/未読込は消費して鳴り直さない。実HP/撃破報酬/フルコンボ/通信field/頻度を変えない。共同版10銃/ナイフ、足音/着地34voice/元8素材、命中音と勝利BGMは保持。

元WAVはPCM24/stereo/44100Hz/7.1562585034秒/1893662B、SHA256 8c42d678fdaed891decec3690146308dd31387331ad7a3072d06b7b9151fc1d0。制作本人の指定素材として記録しCC0とは称さない。素材PCM/区間/offset/音量/48voice/失敗無音をofflineとmockで確認し、実音の試聴はしていない。専用savedgame/独立hostguest JSON/故障検出/既存関連検査、公開とGitHubの最終確定はworkspace cycle129-test-report.json / cycle129-release.json。自動更新fps-19はPAUSEDのまま。

## 第142巡 / 電源オフ開始の「ピピッ」

最新人間指定により、実ルールが解除担当を受け付けた遷移だけで `defuse-start` を発行する。同じ長押し中は一回、中断後の再開/担当交代は再度一回。既存の電源オフ完了音とは分ける。通常の本人/BOT/host remoteと設置解除練習を揃え、無効な操作/予測guest/待機中の二人目は発音しない。

既存同梱 `lab-beep1.ogg` を2層、各90ms/間隔160ms/rate1.35/gain.34で使い、全体250ms。新素材は追加せず全113録音cue。ボンバー地点の定位/距離/遮蔽とSOUND OFF/volume0を尊重。既存64cueのseq/round/id/時刻/座標だけでhostから全近隣プレイヤーへ伝え、開始したguest本人も受信する。初回同期/重複/旧R/古い/未来/不正cueは消費して無音、後から鳴り直さない。postに届いた直近cueも受理。新wire field/HTTP頻度/解除7秒・チェックポイント3.5秒/経済/他の音は変更しない。

専用実savedgame9群（実BOT役割・20/60/144Hz・独立hostguest JSON・再開/拒否/消音/清掃）と3メモリ故障、録音mock4/既存ルール19/SQLite21を検証。実音は再生・試聴しない。最終公開/GitHub値と関連検査の確定結果はworkspace cycle142-release/test-report。新実ブラウザー2タブ/実端末/聴感は未確認。

## 第143巡 / 遠距離・壁越しの銃声

人間報告「近くは聞こえるが、離れた敵や壁の向こうが小さい」に対応。実発砲cueは発行されていたが、足音と同じ距離係数.11、壁gain.40/lowpass1600Hzと65m打切りだった。銃声だけ係数.035、壁gain.70/lowpass3200Hzへ変更し、80～100mで滑らかに消す。30～50mの開けた銃声は従来約2.1～2.4倍、壁越しは約3.7～4.1倍のgain。近距離の自分の音量と共同編集版全10銃の素材/recipe、ナイフ・足音・着地・解除開始や他通知は保持。方角/距離差/壁のこもりを残す。

実savedgame5群で全10銃の遠方受理、壁/左右、実BOT発砲と消費弾一対一、独立hostguest JSONの80m受信/重複/消音/初回/古いcueを確認。専用graph mock5群で全銃の曲線/80～100mの連続減衰、既存録音mock4群で全113cue・足音着地34voice・48voice上限・失敗無音を検査。実音は再生/試聴しない。BOT聴覚、発砲cueの権威/通信field/頻度、強さや地形は変えない。新ブラウザー2タブ/実端末/聴感は未確認。公開/GitHub/最終検査の正本はworkspace cycle143-release/test-report。自動fps-19はPAUSEDを維持。

## 第144巡 / 勝利BGM中のクラブ照明

最新人間指定により、勝利BGMが実際に再生されている間だけカラフルな6本の光線・色の変化・滑らかな明暗を重ねる。既存HTMLAudioの再生位置を読み、独立音声/時計/timer/rendererは追加しない。160BPMの装飾用の脈動で、楽曲の拍を解析した機能ではない。現在の三人称ダンス/勝利カメラ/音源/設定/音量を保持。通常対戦・購入・負け・消音・読込待ち・buffer・seek・一時停止・非表示・次R/menuでは消す。縮小動作は固定色だけにする。pointer-events:noneの装飾レイヤーで操作を妨げない。

新presentation6/実savedgame5、既存BGM8/事前準備8/勝利camera7が成功。20/60/144Hz、実media transportのread-only判定、重複結果・fresh結果のaudible:false・pause/hostpause/次R/menuの清掃を確認。新しい独立guestJSON検証ではなく既存勝利camera7の過去と今回回帰を根拠にする。所有hidden11の音声要素なし専用プレビューで最初OFF/AX0/ariafalse、6光線の実描画・縮小動作で光線0・停止非表示・warnerror0を確認。模擬時計と既存NOPEダンスによる見た目確認で、実BGMのbrowser同時再生/聴感検証ではない。画像cycle144-club-local.png。11閉鎖/8063保持sessionから停止listener0。一時previewは公開sourceから除去。初回非表示10は接続timeoutでhandleなし/UI操作なし、自動cleanup対象・手動閉鎖未確認。

音素材/全113cue/共同版銃声/足音着地/ゲーム物理地形/判定/通信を変更しない。実音試聴/foreground/既存userタブ/OS/他アプリ操作なし。新実2タブ/端末/聴感は未確認。最終正規build/package/共有/公開/GitHubはworkspace cycle144-release/test-reportを正本とする。自動fps-19はPAUSED維持、手動依頼のみ。全main旧fixture債務を保持し無用反復なし。
