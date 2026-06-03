# Make the full server+client test/coverage gate complete within the harness budget

The ticket requires "existing server + client tests pass", but the round-1
coverage run never finished: `coverage.log` ends with
`[vitest] timed out after 120s — killing process group` partway through the
server suite (during `key-items.test.js`). The full `pnpm test` coverage run must
complete cleanly well under the 120s capture budget so the test gate is provably
green.

## Acceptance Criteria

- `pnpm test` (the coverage run: `node scripts/run-vitest.mjs run --coverage
  --config vitest.config.js`) runs to completion in under the 120s harness budget
  and reports all server, client, and client-glb projects passing — no
  timeout/kill, no failing or skipped suites. The captured run log shows the
  final vitest summary (total files/tests passed) rather than a mid-run kill.
- The speed-up comes from running tests more efficiently, NOT from deleting,
  skipping, or weakening coverage. Coverage thresholds in `vitest.config.js`
  (statements/branches/functions/lines = 70) are unchanged and still met.
- No test loses assertions and no flakiness is introduced: the server tests that
  each spin up an ephemeral-port server (`Server listening on port 0`) still pass
  when run together. If parallelism is enabled, confirm no two suites collide on
  a shared port or module-level singleton.
- The new `quest-objective-near-complete` server unit test (added in sub-ticket
  01) and all pre-existing suites continue to pass.

## Technical Specs

- `game/vitest.config.js`: the `server` project currently runs fully serially
  (`fileParallelism: false`, `maxWorkers: 1`), which is the primary cause of the
  slow wall-clock time under coverage instrumentation. The recommended fix is to
  allow controlled file parallelism for the `server` project (e.g. enable
  `fileParallelism` and raise `maxWorkers` to a small bounded number such as
  2–4). Server test files already bind ephemeral port `0`, so parallel files
  should not collide on ports — verify there is no shared module-level singleton
  that breaks under parallel runs before committing the change. The `client-glb`
  project may stay serial.
- `game/scripts/run-vitest.mjs`: the orphan-sweep wrapper is fine as-is; do not
  weaken its cleanup. Only touch it if a config change requires a corresponding
  invocation tweak.
- `game/server/test/key-items.test.js` (1518 lines, where the timeout landed):
  if a specific file is a disproportionate hotspot after parallelism is enabled,
  reduce its per-test server-spawn overhead (reuse setup where safe) WITHOUT
  dropping assertions. Prefer the config-level parallelism fix first; only
  micro-optimize files if the budget is still tight.
- Do NOT split `pnpm test` into multiple harness invocations or move tests out of
  the coverage run — the single `pnpm test` gate must finish clean within budget.

## Verification: code
