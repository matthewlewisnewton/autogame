# HUD LV badge displays the real server level

Replace the hardcoded `return 1` in `formatPlayerLevel()` with the player's server-tracked `level` (added in sub-ticket 01) so the vanguard portrait's LV badge reflects actual progression, with a safe fallback to 1 when no level is available.

## Acceptance Criteria

- `formatPlayerLevel(player)` in `game/client/vanguard-hud.js` accepts the local player's state-snapshot object and returns `player.level` when it is a finite number ≥ 1 (floored to an integer); it returns 1 for a missing/null player, a missing `level` field, or a non-finite/sub-1 value.
- The hardcoded `return 1;` body and its "Placeholder level until a player-level stat exists on the server" comment are gone.
- `updateVanguardPortrait()` in `game/client/main.js` passes the local player's snapshot into `formatPlayerLevel(...)` (threaded from `syncVanguardHud(me, …)`, which already has `me` in scope), so the `#player-level` element shows the server level and updates when the level changes in a later snapshot.
- `game/client/test/vanguard-hud.test.js`: the old `returns the placeholder level` test is replaced with tests covering: returns `level` from a player object (e.g. `{ level: 3 }` → 3), floors fractional values, and falls back to 1 for `null` player, `{}`, and `{ level: NaN }`.
- Client tests pass (`pnpm test:quick` from `game/`).

## Technical Specs

Files to change (all under `game/`):

- `game/client/vanguard-hud.js`
  - `formatPlayerLevel(player)`: `const lvl = Number(player?.level); return Number.isFinite(lvl) && lvl >= 1 ? Math.floor(lvl) : 1;` Update the JSDoc to describe the real behavior.
- `game/client/main.js`
  - Change `updateVanguardPortrait()` to take the local player snapshot (`function updateVanguardPortrait(me)`) and use `formatPlayerLevel(me)`; update the call in `syncVanguardHud()` (currently `updateVanguardPortrait()` around line 2061) to `updateVanguardPortrait(me)`. Check for any other call sites of `updateVanguardPortrait` (it is also exported in the test-hooks object around line 1348 — leave that export intact) and pass the current player or leave them falling back to 1 where no snapshot exists.
  - The server snapshot field is `level` on each entry of `gameState.players` (added in sub-ticket 01); `me` in `syncVanguardHud` is already that snapshot for the local player.
- `game/client/test/vanguard-hud.test.js`
  - Replace the `describe('formatPlayerLevel()')` block's placeholder test with the cases listed in Acceptance Criteria.

Notes:
- Do not change `index.html` structure — the existing `#level-indicator` / `#player-level` markup stays; only the value source changes.
- Portrait currently only refreshes during the `playing` phase (`syncVanguardHud` gates on `gamePhase === 'playing'`); that existing behavior is fine and out of scope to change.

## Verification: code
