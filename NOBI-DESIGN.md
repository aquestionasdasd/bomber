# のび / eleventh character

Literal supplied name. Procedural rounded white face, red nose, black whiskers/mouth, white collar, yellow short sleeves, navy shorts, bare lower legs, white/green socks and cyan shoes. No photo texture/external asset. Same standing rig/52 hit surfaces.

Compared before implementation against all10: duelist fog/lift/dash/knives;NOPE explosive/flash/decoy/takeover;MEND slow/fog/heal;IAGNU fixed reveal/flash/speed;grass fog/slow/speed;ember explosive/flash resistance/reload;frost ring slow/fog/slow mitigation;duck ability seal/bullet shield/silence/lethal endurance;cat self return/mag removal/gun fetch/clock pause;car enemy push/smoke dispel/moving accuracy/kit refill.

|Skill|Original mechanism and operation|Difference/counterplay|
|---|---|---|
|C 鈴の弱点|Equip/aim visible enemy35m,left confirm/right cancel.6s that target takes1.35x firearm damage, nonstacking.2x100.|Not direct damage/explosion/reveal/HP heal/seal. No targeting through wall/smoke/flash. Mark does not reveal hidden enemy position. Source/target death/team/round clears.|
|Q ひげブレーキ|Equip/aim visible enemy40m,left confirm/right cancel.5s target firearm minimum interval1.6x, nonstacking.1x100.|No existing gun cadence effect. Does not remove ammo/weapon/ability, stop movement or affect knives. Host limits both reported and real fire. Visual noise-free HUD indicates condition.|
|E ポケット工具|Free18s CD;6s own plant/power-off progress1.5x. Activate before holdingF.|Objective work acceleration, not reload/clock pause/resource refill/movement. Still stationary, alive, in range, same ownership rules. After expiry normal rate; HUD estimates adjusted.|
|X 逆転えり|7pt8s own landed firearm body/leg hits use head damage; actual head hits unchanged. No autoaim and no bullet through walls.|No existing hit-region conversion. Does not alter spread/recoil/health/armor/knife/ammo/range falloff or enemy position. Misses still miss, walls/smoke/flash remain counters. Distinct from C target vulnerability; they can combine but do not stack same effect.|

All gameplay host authoritative. Guest CQ stock-only prediction;E/X effects start on snapshot.20event full rejects and restores stock/7pt. Strict target IDs/ranges/durations, no extra hidden location tracking. BOT uses only actual visible targets;E only when carrying bomber or close to planted one, X visible fight. Existing10 are unchanged. New cues reuse already licensed assets; no audition.
