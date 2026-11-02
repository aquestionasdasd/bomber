# FROST contract fixture maintenance

The eight original FROST groups now pass. Five bodies are updated for physical throws; the three already-valid mitigation, source-cancellation and capacity bodies remain unchanged. All55 names, prior41 bodies and later6 bodies remain exact. The historical group name mentioning an .8m arc is retained for continuity; its body now verifies the actual ballistic trajectory.

Expected targeted flight is independently solved from12m/s launch speed and gravity4, without importing the product throw-duration or position helpers. Positions are sampled at20/60/144Hz. Stitch retains a .25-second warning after arrival, eight-second field, radius .9–3.8 and .45 speed scale. Mist retains radius3.5 and nine seconds after arrival. The self-only grounded signature retains its five-second effect and .15 residual slowdown fraction. Tests retain exact radial edges, floor and actor support, .45m height limits, cover, team/death/airborne exclusions, single mitigation after combining slows, and source-death persistence of thrown fields.

Independent expected deadlines use the existing1e-8 numeric tolerance. After that comparison, exact boundary checks use the canonical event's timestamp, avoiding a floating-point rounding difference between two mathematically equivalent flight solvers. The expiry/resurrection test advances beyond both independently calculated field ends, rather than assuming ten seconds covers the longer mist flight.

The JSON test retains every forged-field and duplicate-signature rejection, atomic rollback, copied visuals, render-clock and round guard. It additionally verifies a restored stitch query at real arming time. The20-event cap, unchanged ID sequence, paid-stock/cooldown rollback and invalid-clock checks remain.

`node tests-character-skills.cjs --through-frost` explicitly runs a49-group diagnostic prefix. Default package and CI commands are unchanged and unfiltered. The default still fails after49 groups at untouched WIND legacy throw expectations; this is a partial repair, not a passing full suite. Sites-side legacy fixtures are unchanged.

`node tests-frost-contract-negative.cjs` injects nine actual-source memory-only faults: obsolete flight, missing warning, mist lifetime, inner edge, cover, floor height, mitigation factor, airborne cancellation and duplicate signature restore. Every fault must pass prior41 groups and fail a FROST assertion. Syntax, import, type, timeout and infrastructure errors do not count; product files are never written.

This is pure compatibility-engine verification. No new actual-game `updatePlay`, GPU, browser, audio, network feel, CPU tactical improvement, ordinary5v5 strength or personal objective contribution is claimed. No public game code, characters, robots, weapons, economy, maps, models, audio, networking, dependencies, controller policy or fixed CI changed. The public Sites version is retained without build, save or deploy.
