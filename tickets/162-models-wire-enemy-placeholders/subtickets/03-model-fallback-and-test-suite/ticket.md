# Model load fallback coverage and green test suite

Confirm the 161 fallback contract still holds for wired enemy/minion keys and that
the full game test suite passes after registry paths are enabled. Add focused
tests so QA can verify resilience without relying on screenshots.

## Acceptance Criteria

- A unit test proves that when `loadModel` resolves to `null` (missing or broken
  path), `attachRegistryModel` leaves the procedural mesh visible and does not
  throw or remove the host.
- A unit test proves `modelPathFor` returns the seven enemy/minion paths from
  sub-ticket 02 and that `player` remains `null`.
- `createEnemyMesh` / `createMinionMesh` tests still pass: either unchanged
  (procedural geometry assertions on sync return) or updated to assert procedural
  fallback when models are not loaded in jsdom.
- `cd game && pnpm test:quick` (or `pnpm test` if that is the repo default gate)
  completes with no failures.
- No changes to player mesh creation, server code, or loot registry entries.

## Technical Specs

- `game/client/test/models.test.js` (new) — `modelPathFor`, `loadModel` failure
  caching, and/or mocked `loadModel` for `attachRegistryModel` fallback behavior.
  Import from `../models.js` and, if needed, exercise renderer helpers via the
  existing `window.createEnemyMesh` test harness in `main.test.js`.
- `game/client/test/main.test.js` — adjust only tests that break because registry
  paths are non-null (e.g. async model swap, hidden procedural materials).
- `game/client/models.js` / `game/client/renderer.js` — change only if tests
  reveal a real bug; prefer test-only fixes when behavior is already correct.

## Verification: code
