# Isolated validation control

This infrastructure does not deploy the game. Public request handling, tool-less
code generation, remote code execution, and publication remain separate stages.
The owner selected functional changes with isolation on 2026-10-29.

The workflow runs on a new GitHub-hosted Ubuntu VM. Candidate modules and existing
tests execute only inside a non-root, read-only Docker container with network
disabled, all capabilities dropped, no new privileges, and time/memory/process
limits. No host home, Git metadata, Docker socket, token or publication credential
is mounted. A real adversarial probe must pass first. Owned timed-out containers
are removed; only a bounded host-written report is retained for one day. Raw test
stdout and request prose are not uploaded or printed.

The initial three-module pure-logic restriction is superseded by the owner-approved
expanded game delegation below. Mechanical boundaries, separate semantic review
and fixed tests remain required.

The publisher must independently bind the successful workflow run to the exact
trusted control tree and proposal hash, recheck before/after hashes and current
GitHub/Sites heads, and stop on any stale base or failed/missing result. A report's
publicationAuthorized is always false. It is never a self-issued deployment permit.
There is no GitHub write, deployment or model credential in the test container.
No workflow uses pull_request_target, untrusted shell interpolation, repository
script installation, or reusable caches. Actions and the official Node image are
pinned by immutable SHA/digest. Vendored Acorn 8.16.0 is MIT licensed; its source
SHA256 is efb0124a960b34d53f9928c4926bfcfd300bb6a3d7ab64ee949b3a8bed1c7e5f.

This does not guarantee that every semantic defect or platform vulnerability is
impossible. It bounds capabilities and verifies the actual isolation controls;
unclear or out-of-scope changes must be held. Protected infrastructure and media remain outside automatic scope. fps-19 remains paused.

References: GitHub Actions hosted-runner/security documentation and Docker run
documentation. No new paid model provider or cloud account is required for this
validation stage. The model adapter must use a verified existing local endpoint
without tools or file access. No secret may appear in prompts or candidates.


## Expanded game delegation

The owner expanded request scope on 2026-10-29 to game characters, skill/weapon
values, bots, maps, graphics, UI and gameplay features. policy.mjs pins 115
existing JavaScript/CSS/HTML/JSON paths, with at most 8 changed files / 16 edits
per request. No new files, raw media replacements, external downloads, secrets,
network/auth/storage changes, dependencies, tests or release-control edits.

JavaScript imports and complete capability-bearing callables stay fixed. New
computed access is rejected. CSS loading tokens and HTML active blocks and
attributes stay fixed. Whole-source hashes, syntax/resource limits, independent
review context, actual remote isolation and fixed tests remain mandatory. The
old pure-expression validator is retained as a regression test, not the new
game gate. Passing these checks does not prove every browser/semantic property.

Model context is selected from an allowlisted source catalog and bounded
fragments; private receipt IDs/authors are never provided. Insufficient context,
protected code, failed fixed regressions or uncertain semantics cause held
status. The original five core tests and four baseline selftests are unchanged.
