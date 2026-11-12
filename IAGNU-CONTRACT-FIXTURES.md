# IAGNU contract fixture maintenance

This repairs the seven original IAGNU groups in `tests-character-skills.cjs`. The preceding ten NOPE and seven MEND group bodies, all 31 later group bodies and all 55 original group names remain unchanged. No gameplay, package, dependency or fixed CI condition changed.

```sh
node tests-character-skills.cjs --through-iagnu
node tests-iagnu-contract-negative.cjs
```

The focused command explicitly runs 24 original groups and reports that later groups were not run. Default execution remains unfiltered: it passes 25 groups including the unchanged mixed ordinary-capacity check, then fails at untouched VEIL dust expiry (`15.2` actual versus old `9.2`). This is a partial suite repair. The whole shared suite and two separate cycle241 failures remain debt; Sites-side legacy fixtures are unchanged.

Default point-target tag and glint throws use the existing 12 m/s launch speed and gravity 4 m/s². Their intermediate positions and launch speed are checked independently of product trajectory helpers at 20/60/144 Hz with the existing `1e-8` numeric tolerance. These launch expectations apply to default point-target casts, not every manually supplied bounded trajectory. The 18 m tag flight is approximately `1.5213690344` seconds, replacing the obsolete fixed `0.55` expectation. Tags arm 0.5 seconds after physical arrival and wait 12 seconds for an eligible entrant. Detection records one fixed location for 2.5 seconds. Glint activates on arrival; its short visual lasts 0.4 seconds and blindness lasts two seconds from the actual sample. Self-only kerning remains four seconds at 1.35 times movement speed, with the separate MEND slow queried after its actual arrival.

All original team, cover, radius, height, liveness, facing, deterministic distance/ID selection, copied marker, source-death, clock, reset, strict atomic JSON and guest-ownership assertions remain. Additional checks reject detection at landing or just before arming and permit detection just before the tag's actual expiry. Snapshot privacy exposes only the viewer team's fixed markers, never a live target reference.

Eight negative cases mutate real source only in memory: early tag detection, friendly detection, cover bypass, wrong sampled marker position, guest tag ownership, changed glint duration, old fixed tag activation and shortened waiting lifetime. Friendly detection requires bypassing two independent team guards. Each fault must produce an assertion failure; syntax, import, timeout or infrastructure errors do not count. Product files are never written.

Private evidence also runs twelve actual `updatePlay` controls: tag detection at 5 m, an untriggered tag's full 12-second wait at 18 m, and glint at 5/18 m, each at 20/60/144 Hz. It checks one stock consumption, no early effect, actual fixed marker/expiry or actual blindness, no HP damage or movement slow, and no enemy-team marker leak. A controlled pose change after detection confirms the marker stays fixed. Renderers, audio and timers are inert; ordinary firing and automatic skill choice are suppressed, and guard roles are fixed. The observed time is frame-quantized. These are simulation steps, not GPU frame-rate measurements, autonomous tactical decisions or ordinary 5v5 strength evidence.
