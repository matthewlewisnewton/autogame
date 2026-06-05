# Lock-on info panel runtime sync

Wire the lock-on info panel to unified Z-targeting: show populated panel content while locked onto a living enemy, refresh HP/stats every frame as combat updates the target, and hide the panel when lock-on clears (unlock, break range, target death, or leaving gameplay).

## Acceptance Criteria

- While `isLockOnActive()` and the locked enemy exists in `gameState.enemies` with `hp > 0`, `#lock-on-info-panel` is visible and shows:
  - Display name from the catalog (not the internal `type` key).
  - Variant name when `enemy.variant` is set.
  - Live `HP current/max` that updates when the target takes damage.
  - Surfaced stat rows from sub-ticket 01 (`attackDamage`, `chaseSpeed`, variant-specific stats, etc.).
  - Type + variant description text from the catalog.
- When lock-on is inactive, the target is dead/removed, or `currentGamePhase !== 'playing'`, the panel is hidden (`hidden` class or equivalent).
- Cycling lock-on to another target updates the panel to the new enemy without requiring unlock/re-lock.
- Lock-on camera release after target death hides the panel (no stale target info).
- Vitest covers DOM sync helper(s): visible + populated model when locked, hidden when unlocked, HP text changes when the same enemy id receives a new `hp` value.
- Harness vitest suite passes; top-level ticket acceptance criteria satisfied.

## Technical Specs

- **`game/client/lock-on-info-panel.js`** — Add `syncLockOnInfoPanel({ panelEl, nameEl, variantEl, hpEl, statsEl, descEl, enemy, catalog })` (or equivalent) that applies a `buildLockOnPanelModel` result to the DOM and toggles visibility.
- **`game/client/renderer.js`** — After `updateLockOn(...)` in the animate/movement path (~L1485), resolve the locked enemy via `getLockedEnemyId()` + `findEnemyById(gameStateRef.enemies, …)` and call the sync helper each frame while playing.
- **`game/client/main.js`** — Pass catalog getter into renderer init (e.g. extend `setGameStateRef` setup or add `setEnemyDisplayCatalogGetter`) so renderer can read the catalog stored from `init`.
- **`game/client/test/lock-on-info-panel.test.js`** — Extend with jsdom tests for `syncLockOnInfoPanel` visibility and HP refresh (mock DOM nodes).
- Optional: export `window.__syncLockOnInfoPanel` for tests mirroring other HUD hooks.
- Do **not** change combat stats, lock-on acquisition logic, or server registries in this sub-ticket.

## Verification: code
