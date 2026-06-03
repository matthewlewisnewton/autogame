# Client unit tests for dodge VFX and cooldown HUD

`triggerDashVFX`, `updateKeyItemCooldownHud`, and `flashKeyItemIndicator` have no coverage under `game/client/test/`, unlike lobby key-item list tests in `main.test.js`. Add focused unit tests so dodge client feedback regressions are caught in CI.

## Acceptance Criteria

- At least one test verifies `updateKeyItemCooldownHud` (or equivalent test hook) sets `#key-item-indicator.cooldown` and countdown text when `cooldownRemainingMs > 0`, and clears the class/text when cooldown is 0.
- At least one test verifies `triggerDashVFX` runs without error when a player mesh exists (squash scale applied), OR verifies dash jump detection in the state-update path calls `triggerDashVFX` when position delta exceeds the threshold in `main.js`.
- New tests live under `game/client/test/` and pass with `pnpm test:quick` from `game/`.
- Existing tests are not regressed.

## Technical Specs

- **New file**: `game/client/test/key-item-dodge.test.js` (preferred) or extend `game/client/test/main.test.js` if DOM harness already fits.
- **Cooldown HUD tests** (`updateKeyItemCooldownHud`, `flashKeyItemIndicator` in `game/client/main.js` ~lines 2316–2345):
  - Create `#key-item-indicator` in `beforeEach` (mirror `main.test.js` DOM setup).
  - Expose minimal test hooks if needed, e.g. `window.__updateKeyItemCooldownHud` / `window.__flashKeyItemIndicator`, following existing patterns like `window.__setKeyItemDefs`.
  - Assert: `updateKeyItemCooldownHud(750)` → element has class `cooldown`, text matches `/^0\.[0-9]+$/` or contains `0.7`; `updateKeyItemCooldownHud(0)` → no `cooldown` class, empty text.
  - Optional: `flashKeyItemIndicator('success')` adds `flash-success` briefly (use `vi.useFakeTimers()`).
- **Dash VFX tests** (`triggerDashVFX` exported from `game/client/renderer.js` ~line 1328):
  - Mock `requestAnimationFrame` (see `renderer-clock.test.js`).
  - Stub minimal THREE mesh/group on `playersMeshes[playerId]` with geometry + material so `triggerDashVFX('p1')` applies squash scale without throwing.
  - Assert mesh scale deviates from `(1,1,1)` immediately after call.
  - **Alternative**: spy on `triggerDashVFX` import in a thin test of the dash-detection block in `main.js` (~lines 988–998) by simulating two consecutive `stateUpdate` payloads with a large position jump; only pursue if renderer mocking is too heavy.
- **Reference constants**: `MOVE_SPEED`, `TICK_RATE` from shared config; dash threshold is `(MOVE_SPEED / TICK_RATE) * 2`.
- Do **not** add server tests — dodge server coverage already exists in `game/server/test/dodge_roll.test.js`.

## Verification: code
