# Stabilize loot_magnet test under full vitest suite

The `loot at 6m` case in `loot_magnet.test.js` flakes when run with the full server+client suite (especially with coverage): `keyItemUsed` reports `result.pulled === 0` instead of `1` even though the same file passes in isolation. Harden this test (and any sibling cases that share the same pattern) so parallel full-suite runs are deterministic without changing loot-magnet gameplay code.

## Acceptance Criteria

- `cd game && pnpm test` completes without a failure in `server/test/loot_magnet.test.js` (the `6m pull-and-collect` case asserts `result.pulled === 1` and `result.collected === 1`).
- `cd game && node scripts/run-vitest.mjs run --coverage --config vitest.config.js server/test/loot_magnet.test.js` passes when run alongside the rest of the server project (re-run full `pnpm test` to confirm — do not rely on isolation-only runs).
- No edits to `game/server/simulation.js`, `game/server/progression.js`, or loot-magnet effect logic — test and/or vitest scheduling only.
- Other tests in `loot_magnet.test.js` remain green with unchanged behavioral expectations.

## Technical Specs

- **Primary file:** `game/server/test/loot_magnet.test.js`
  - The failing case is `'loot at 6m within attractRadius (8m) is pulled to the player and auto-collected'` (~L52–83): it mutates `testGameState().loot`, emits `useKeyItem` for `loot_magnet`, and awaits `waitForEvent(socket, 'keyItemUsed')`.
  - Investigate full-suite-only races: stale/wrong `keyItemUsed` payload, tick ordering vs. `state.loot` mutation, or shared `testGameState()` visibility under `fileParallelism: true` (see `game/vitest.config.js` server project).
  - Apply the same stabilization pattern used in `game/server/test/smoke_bomb.test.js` (synchronous capture inside a dedicated `socket.once('keyItemUsed', …)` handler with timeout) if event ordering is the culprit; alternatively assert on authoritative server state (`state.loot`, player currency) after a bounded wait instead of trusting only the emit payload when flaky.
- **Optional scheduling fix (only if test-only hardening is insufficient):** `game/vitest.config.js` — e.g. set `fileParallelism: false` for `loot_magnet.test.js` via a vitest 3 per-file pool override, or reduce `maxWorkers` for the server project under coverage so socket/key-item suites do not contend. Prefer test-level fixes first.
- **Out of scope:** `game/scripts/run-vitest.mjs` and post-run exit codes (sub-ticket 06).

## Verification: code
