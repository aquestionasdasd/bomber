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

The mechanically eligible initial scope is capability-free logic in death-view,
range-session and buy-area geometry. Other requests remain held. The AST gate
rejects new imports, I/O and ambient globals, computed/prototype access, new
strings/comments/numeric values, asynchronous execution, loops, changed exports,
and writes to global objects. Existing tests and control files are immutable to
request proposals. Passing the language gate is necessary, not proof of intended
game behavior: separate semantic review and fixed tests remain required.

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
unclear or out-of-scope changes must be held. General changes to gameplay,
communication, audio, assets, character numbers, dependencies, authority, policy
and deployment are outside automatic scope. fps-19 remains paused.

References: GitHub Actions hosted-runner/security documentation and Docker run
documentation. No new paid model provider or cloud account is required for this
validation stage. The model adapter must use a verified existing local endpoint
without tools or file access. No secret may appear in prompts or candidates.
