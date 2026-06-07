# 04 — Server tests: card-charge persistence matrix

Add and update automated server tests so both telepipe-resume and new-sortie paths are covered, with regression guards that HP and magic stones persist in both cases.

## Acceptance Criteria

- **`game/server/test/server.test.js`** contains explicit tests for:
  - Telepipe-resume: spend charges → full extract → redeploy → `remainingCharges` unchanged from pre-extract values; `hp`/`magicStones` unchanged.
  - New sortie: spend charges → full extract → abandon → redeploy → all hand cards at full charges; new `run.id`; `hp`/`magicStones` unchanged.
  - Regression: neither path resets `hp` to `MAX_HP` or `magicStones` to `STARTING_MAGIC_STONES` when player had non-default values.
- **`game/server/test/integration.test.js`** `Telepipe extract and redeploy vitals persistence` describe block is updated:
  - `two-player telepipe extract returns to hub and redeploy spawns a fresh dungeon` expects **same** `run.id` on resume redeploy (not a new id).
  - Add or extend an integration case for abandon-then-redeploy producing a **new** `run.id` and reset card charges.
- All tests in `pnpm test:quick` (or `pnpm test` from `game/`) pass.

## Technical Specs

- **`game/server/test/server.test.js`**: add a `describe('card charge persistence — telepipe resume vs new sortie')` block using existing helpers (`resetState`, `addPlayer`, `checkAllReady`, `tryEnterTelepipe`, `PORTAL_PLACEMENT_GRACE_MS`, `abandonSuspendedRun`).
- **`game/server/test/integration.test.js`**: update telepipe redeploy integration expectations; add abandon-path integration test if socket coverage is needed beyond unit tests.
- No production code changes unless tests reveal a gap in 01–03; fix only what is required for tests to pass.

## Verification: code
