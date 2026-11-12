## 第225巡 / Forgeの銃声を所有者WAVへ

所有者提供gunsound_forge.wavをForgeの本人/敵銃声へbyte変更なしで適用し、先頭から録音全体を速度1倍で一度再生する。Forgeのgain.31/100m距離減衰/壁遮蔽/定位/mono安全正規化/48voice/消音・読込失敗時の無音と遅延再生なしを保持。他の銃声・足音着地/キル/勝利BGM/技音のbyteとrecipe、銃性能・キャラ・地形・通信は変更しない。USER-GUN-AUDIO.md参照。音声再生/試聴なし、fps-19はPAUSED。

提供WAVはRIFF/PCM16 stereo44.1kHz、58093frames（約1.3173秒）、232556bytes。SHA256は9f119632869fe67a411d4d271a7259d407905a70f3a91d5a09cd7dc092271a9c。変換なし。既存のWebAudio mockへ実PCMを渡し、8銃×本人/敵の速度1/先頭offset0/全長/一回/mono正規化と無音時の非再生を確認する。

# 所有者指定の銃声

第221巡はSpectre/Scout/Atlas/Classic v2/Phantom v2を提供WAVへ差し替える。5ファイルは元のbyteを保ち、メタデータのRIFF/PCM16 stereo44.1kHz・フレーム数・SHA/peak/RMSを記録。音程を変えず、先頭から録音全体の長さを本人と敵の銃声で共用する。Classic/Phantomはv2ファイル名にして旧force-cacheを参照しない。旧2ファイルは削除し、Ghost/Vandalとその他4武器のrecipeは維持する。

音声エンジンは変更しない。既存各銃gain、monoへの合成とpeak.85の安全上限、100m距離減衰、壁/水中のlowpass、pan、48voice上限、0音量、読込/codec失敗の無音、遅延再生防止を保持。足音/着地の素材と交互順、キル音、勝利BGM2曲、車両、設置解除、技音はbyteとrecipeを保持。

検証はtests-user-gun-audio.cjsの実PCMをWebAudio mockへ渡す7銃×本人/敵、ファイルhash/フレーム数/全長・速度1・先頭offset・1回再生/mono正規化・終了解放/消音・未読込・失敗時の非再生。tests-audio.cjsで既存素材・全recipe/48voice/定位/足音と着地の交互順を確認し、tests-gunshot-spatial.cjs/tests-enemy-shot-audio.cjsで既存game soundの距離/遮蔽/敵音を確認する。すべて無音の数値/mock検証。実ブラウザー/端末/聴感は未検証、所有者PCで再生・OS音量変更・既存tab操作をしない。
