# 現行仕様 / 第78巡の人間指定

Cバンパーウェーブは旧3m即時押し出しから、本体の26m/秒突進→接触75ダメージ→最大24m/1秒の連続放物線吹き飛ばしへ更新。35mの見える接地敵を選んで左確定・右取消、実際の進路に入った最初の敵へ1回だけ命中。壁/足場切れで突進が止まり、移動する相手を追尾しない。吹き飛ばしは実際に重力/天井/壁と衝突する。装甲は通常ルール、C2回/100を保持、Q/E/Xは不変。

全15人比較：DUELISTの本人だけの短距離dash、VEIL/IAGNUの歩行加速、FROSTの操作付きslide、DUCKの連打飛行、CATのしおり帰還は敵のHPと軌道を変えない。NOPE/MEND/EMBER/NOBI/JAPAN/CAP/URCHIN/ONNARAの投擲・妨害・反射・資源・連鎖等とも異なり、自身が危険を負って進路でぶつかり、敵の位置を大きく変えて道を開く役割。共有の衝突/重力/命中演出だけを利用。

host-owned6field carMove（eventID,phase,endsAt,vx,vz,vy）を既存actor snapshotで同期。guestの発動前予測は在庫だけ、命中/ダメージは決めない。位相・速度・期限・有限値・IDの検査、重複入力/死亡/次R/退出を実savedgame18群で確認。配達や全10端末の人間対戦を検証済みという意味ではない。

以下は第49巡の初期設計の履歴。旧Cの3m/無ダメージ/即時座標補正は現在の仕様ではない。

# トミカ / tenth character

The supplied name is literal. The white miniature sports car, dark roof/glazing, four black tyres, silver rims and rear wing are recreated procedurally; no photo, logo or third-party model is redistributed. The shared articulated combat rig/52 hit surfaces remain unchanged. A car-bodied mechanical avatar keeps the existing standing/crouching/weapon silhouette and controls.

All four effects were compared against the existing nine: duelist personal dash/lift/fog/knives; NOPE explosive/flash/decoy/takeover; MEND slow/fog/HP healing; IAGNU contact reveal/flash/speed; grass fog/slow/speed; solder damage/flash resistance/reload; frost slow/fog/slow resistance; duck ability seal/bullet shield/silence/lethal survival; cat saved return/magazine removal/ground gun retrieval/countdown pause.

- **C バンパーウェーブ**: equip, aim a visible grounded enemy within35m, confirm/cancel. Push that enemy away up to3m along continuously supported, unoccupied collision-checked floor. No damage, vertical launch, teleport, wall crossing or fall from an edge. Two charges,100 each. The displacement of an opponent is distinct from a self dash and returning to a saved point. Host alone moves the victim; guests apply a new impulse event once.
- **Q ショールームクリア**: equip, aim the first smoke sphere intersected by the sight line within40m, confirm/cancel. Remove exactly that existing fog field, either team's, including the dome ultimate; no damage/flash/reveal and no destruction of other skill types. One charge100. Counterplay: walls, blindness, overlapping fog (one field only), aiming and finite stock. No existing character dispels another field.
- **E タイヤジャイロ**:4s, while grounded only, remove the gun's movement-spread penalty. Recoil, sustained-fire dispersion, normal weapon spread, airborne inaccuracy and movement speed remain. Free18s cooldown. No current character changes movement-related shooting accuracy. Guest effect begins after host acknowledgement.
- **X ピットクルー**:7pt, instantly replenish C/Q stock and ready E of living visible allies within24m and self, only if at least one needs it. Does not give health/ammunition/credits/ULT points, revive anyone, or end active effects. Unlike healing, this restores finite ability resources; unlike saved return it never rewinds world/player state. It can turn a depleted team fight, but walls/range/death, timing and the20-event cap still apply. No reselling of free stock during live combat; future refund logic must distinguish purchased/returned stock.

Host controls all effects, guest predicts only own spent stock. JSON fields and20-event/64KiB caps remain strict. Death/team change/new round/menu/exit clear personal effects. BOTs use only legitimately perceived enemies, remove fog along a held goal sight line, use gyro in combat and X only for depleted visible allies. Dedicated cues reuse licensed samples, never gun/footstep assets; no audition in this background task.

## BOT decision correction / cycle72

The old E decision tested the movement animation flag immediately after clearing it. E is now considered after actual movement, vision/reaction/alignment and firing gates, immediately before a loaded grounded gun shot. C/Q deliberation does not suppress this E decision. No movement, range, damage, spread coefficient or cooldown values changed. Failed casts retain stock and retry no sooner than0.5s. The dedicated real-game gyro test covers this sequencing; paired BOT results and their limits are in SKILL-BALANCE.md.
