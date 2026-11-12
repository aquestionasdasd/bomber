# MEND contract fixture maintenance

Subsequent IAGNU maintenance is recorded in `IAGNU-CONTRACT-FIXTURES.md`; the failure below describes the state when the MEND repair completed.

This repairs the seven original MEND groups after the ten NOPE groups in the shared `tests-character-skills.cjs`. Existing selection, healing, team, cover, floor, range, cooldown, non-stacking slow, snapshot authority, clock, reset and twenty-event assertions remain. The default command is unfiltered. No public gameplay, dependency, package or fixed CI condition changed.

```sh
node tests-character-skills.cjs --through-mend
node tests-mend-contract-negative.cjs
```

The focused command explicitly runs ten NOPE plus seven MEND groups and reports that later character groups were not run. At this repair's completion, default execution passed those seventeen groups and then failed at the untouched IAGNU tag fixture: old flight `0.55`, actual `1.5213690343584698`. This is a partial suite repair, not a full-suite pass.

Default point-target MEND seed and pollen throws use the existing 12 m/s launch speed and gravity 4 m/s². Activation follows physical arrival and each field lasts nine seconds. The seed's 5 m fixture arrives at approximately `0.4287402845` seconds rather than its old fixed `0.65`. Flight speed, intermediate positions and expiry are checked independently of product trajectory helpers, including samples at 20/60/144 Hz. Numeric pose checks retain the existing `1e-8` tolerance for floating-point roundoff. These launch expectations apply to default point-target casts, not every manually supplied bounded trajectory.

The seven negative cases mutate real source only in memory: pre-arrival slow, friendly slow, cover bypass, wrong heal amount, guest healing ownership, old constant seed activation and shortened seed lifetime. Friendly slow requires bypassing both independent team guards; removing only one correctly remains harmless. Every fault must reach a real assertion failure. Syntax, import, timeout and infrastructure failures do not count. Product files are never written.

Private evidence additionally checks twelve stationary flat-arena controls using actual `updatePlay` once per frame: seeds at 5/20 m and pollen at 5/20 m, each at 20/60/144 Hz. It checks one actual stock consumption, no early effect, the real movement multiplier or smoke line-of-sight, the full nine-second field and expiry. Renderers, timers and audio are inert; ordinary firing and automatic skill choice are suppressed and guard roles are fixed. The observed frame is the first simulation frame reaching the event deadline. This does not establish autonomous tactical choices, ordinary 5v5 strength, GPU appearance, audio or real network behavior.

The whole shared suite and two separate cycle241 failures remain debt. All 38 later groups retain their original contents and all original group names remain. Sites source legacy fixtures are unchanged.
