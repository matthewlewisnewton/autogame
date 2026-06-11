# Client: block dungeon input while run-summary overlay is visible

## Description

Even with server-side terminal gating, the client still predicts movement locally and emits `move`/`lootPickup`/`useKeyItem` while `gamePhase === 'playing'`. That lets the player appear to walk over loot behind the Sortie Complete / Signal Lost overlay and can flash key-item cooldown UI on rejected uses. Add a single overlay-aware input lock so no dungeon actions are sent or predicted while the run-summary modal is up.

## Acceptance Criteria

- `isRunSummaryOverlayVisible()` returns true when `#run-summary-overlay` has `display !== 'none'` (use `getComputedStyle`, matching `isGameLobbyMenuDismissKeyBlocked`)
- `canUseGameActions()` returns false while the run-summary overlay is visible (key items, card hotkeys, deck toggle stay blocked; hub booth interact remains available in lobby only)
- Renderer movement prediction and `move` emits are skipped while the overlay is visible (player mesh stops advancing locally)
- Renderer loot walk-over pickup (`tryEmitLootPickup` / proximity loop) does not fire while the overlay is visible
- `showRunSummary` mirrors `failed` onto `gameState.run.status` the same way it already mirrors `victory`, so renderer gates also work for Signal Lost without relying on overlay checks alone
- New client test: after `showRunSummary({ status: 'victory', ... })`, `canUseGameActions()` is false and key-item `onUseKeyItem` does not emit
- New client test (renderer): with overlay visible, simulated movement input does not increment local predicted position or emit `move`

## Technical Specs

- **File:** `game/client/main.js`
  - Extract `isRunSummaryOverlayVisible()` helper; use it in `canUseGameActions()` and export for tests (`window.__isRunSummaryOverlayVisible` if needed)
  - Extend `showRunSummary` to set `gameState.run.status = 'failed'` when `data.status === 'failed'` (parallel to existing victory mirror block)
- **File:** `game/client/renderer.js`
  - Import or receive `isRunSummaryOverlayVisible` (or `isDungeonInputBlocked` combining overlay + `gameStateRef.run.status !== 'playing'`)
  - In the movement tick (`updateMyPlayer` / move emit block ~L2214–L2298), skip prediction and socket emits when blocked
  - In the loot proximity loop (~L7441–L7448), skip `tryEmitLootPickup` when blocked
- **File:** `game/client/test/run-summary-input-lock.test.js` (new) — overlay + `canUseGameActions` + key-item emit guard
- **File:** `game/client/test/renderer-loot.test.js` or new `renderer-run-summary-input.test.js` — movement/loot emit guard with overlay visible

## Verification: code
