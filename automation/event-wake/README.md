# Request arrival wakeup

An AI-free local process reads only an authenticated boolean and opaque queue
fingerprint once per minute. Empty queues never invoke Codex or Ollama. New work
queues a fixed owner-approved instruction to one pinned existing chat through
the official `codex queue` command. No Discord prose or author ID enters the
watcher, shell arguments, public repository or notification prompt.

The read-only `/api/wake` accepts Ed25519 signatures with a separate domain from
result publication, a fixed target, a timestamp and a random challenge. The
separate read-only DPAPI key stays local. The Worker has only its public key.
Unsigned reads cannot expose even the presence of requests. No write capability
is added. Intake now explicitly inserts `queued`, matching the existing pinned
controller's required status; terminal receipts remain unchanged.

The real request is still read through native Sites database tools by the AI.
All existing isolated generation, fixed CI, human specification, joint GitHub /
Sites publication and signed result/readback gates remain in force. This code
does not modify the pinned implementation or publication controller.

Only one watcher may run. Persistent queue fingerprints prevent repeat wakeups,
including after restart. An uncertain enqueue is held for review rather than
repeated. Real in-progress jobs block further wakeups. Failed network reads use
bounded backoff and never wake AI. A powered-off PC cannot receive a local wake.

Configure `event-watch-config.json`, `event-prompt.txt` and the DPAPI key only in
the private sibling `.state` directory. Start with the existing bundled Node:
`node automation/event-wake/watcher.mjs <absolute-private-config-path>`.
`--once` performs one real read and exits. Do not commit private state or keys.
