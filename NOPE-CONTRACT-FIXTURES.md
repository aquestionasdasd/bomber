# NOPE contract fixture maintenance

This repairs the first ten NOPE groups in `tests-character-skills.cjs`. It is a partial repair of that shared suite. The default command still runs all character groups and currently fails later at the untouched MEND seed fixture, which expects the old `0.65` second throw. Gameplay, Sites source, dependencies and fixed controller CI are unchanged.

Run the focused checks:

```sh
node tests-character-skills.cjs --nope
node tests-nope-contract-negative.cjs
```

The first command explicitly reports ten groups and that the remaining character groups were not run. Omitting `--nope` retains the complete default suite. No package or CI command was filtered.

The original NOPE groups now use the existing throw contract: default point-target launches have speed 12 m/s, bottle gravity 4 m/s² and flash gravity 12 m/s². Flash detonates after one second; a bottle waits at least one second and never detonates before landing. Expected flight kinematics and intermediate poses are calculated independently of the product trajectory helpers at 20, 60 and 144 Hz. The flight-speed assertion applies to these default point-target casts, not every manually supplied bounded trajectory.

The checks retain team, floor, cover, facing, pitch, crouch, dead-target, range, damage, decoy, clock ordering, event-cap, reset and snapshot-authority assertions. Blindness lasts 2.4 seconds beyond its actual sample and outlives the short visual. The guest ownership fixture separates pending bottle damage from an earlier flash sample. A flash flight of `0.4` seconds and blindness starting at `1` second are legitimate under the current contract; malformed examples instead exceed the flash fuse, fall below minimum flight, or contradict blind duration. Atomic rejection and unchanged-state assertions remain.

The negative harness injects six faults into real source held in memory: premature bottle detonation, the old flash fuse, incorrect flash gravity, friendly bottle damage, guest damage ownership, and forged visual expiry. Each must fail a real NOPE assertion; import, syntax, timeout and infrastructure failures do not count. Product files are never written.

Private release evidence additionally runs twelve stationary flat-arena controls through actual `updatePlay` once per frame: bottle throws at 5/20 m and flashes at 5/10 m, each at 20/60/144 Hz. They check real stock consumption, no early effect, damage or blindness, visual expiry and blind expiry. Effects are observed on the first simulation frame reaching the event deadline, so observation time is frame-quantized. These inert VM controls do not verify GPU rendering, audio, real network behavior, ordinary 5v5 strength or improved CPU planning.

Remaining debt: this shared suite's later character fixtures and two separate cycle241 failures. Sites-side legacy fixtures are unchanged. This maintenance does not claim that the whole suite passes.
