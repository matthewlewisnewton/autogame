# Vault Wyrm breath applies BURNING and tests

Wire the Vault Wyrm (`dungeon_drake`) minion's channeled cone breath so each
enemy struck takes the reduced direct damage **and** receives the BURNING status
(291) via `applyBurning`. Add focused server tests proving the new damage value
and burn application. Depends on sub-ticket 01 (card stats) and ticket 291
(burning foundation).

## Acceptance Criteria

- When a `dungeon_drake` minion breath tick hits an enemy through
  `applyWyrmBreathTick` / `collectConeHits`, the server calls
  `applyBurning(enemy, burnDurationMs)` for **each** enemy in the cone hit list.
- Burn duration comes from the minion's `burnDurationMs`, populated at spawn
  from `CARD_DEFS.dungeon_drake.burnDurationMs` (2000 ms after sub-ticket 01).
- Direct breath tick damage per hit is **2** at grind 0 (down from 3), matching
  the updated `attackDamage` in shared card stats.
- **`ancient_wyrm` breath is unchanged** — do not apply burning or alter Archive
  Wyrm damage in this sub-ticket (`cardId === 'dungeon_drake'` guard only).
- Re-applying burn on subsequent breath ticks in the same channel **extends**
  `burningUntil` per 291 refresh rules (never shortens an existing longer burn).
- Vitest coverage proves:
  - a single Vault Wyrm breath start tick reduces a fixture enemy from 50 HP to
    **48** (not 47);
  - the same enemy has `isBurning(enemy) === true` immediately after the tick;
  - `enemy.burningUntil` is approximately `Date.now() + 2000`;
  - an enemy outside the breath cone is neither damaged nor burned.
- All existing `ancient_wyrm.test.js` Vault Wyrm cases updated for the new
  damage expectation; full server test suite passes.

## Technical Specs

- **`game/server/progression.js`** — `applyWyrmMinionBreathStats` (~686–699):
  copy `cardDef.burnDurationMs` onto the spawned minion when present (e.g.
  `minion.burnDurationMs = cardDef.burnDurationMs ?? 0`).
- **`game/server/simulation.js`**:
  - In `applyWyrmBreathTick` (~1474–1495), after `collectConeHits` returns
    hits, when `cardId === 'dungeon_drake'` and `config.burnDurationMs > 0`,
    resolve each `hit.enemyId` to the live enemy in `_gameState.enemies` and call
    `applyBurning(enemy, config.burnDurationMs)`.
  - Pass `burnDurationMs: minion.burnDurationMs ?? 0` into the wyrm AI config
    object built in `updateMinions` (~2696–2709) for `dungeon_drake` minions.
- **`game/server/debugScenarios.js`**: update any hard-coded `breathDamage: 3`
  on `dungeon_drake` debug minions (~1775) to **2** and add `burnDurationMs:
  2000` if the scenario minion is meant to mirror production stats.
- **`game/server/test/ancient_wyrm.test.js`**: update the Vault Wyrm breath
  test (~133–173) — expect enemy HP **48**, set fixture `breathDamage: 2`, add
  assertions for `isBurning` / `burningUntil`. Add a dedicated case (same file
  or new `game/server/test/vault_wyrm_burning.test.js`) for cone miss = no burn.
- Import `applyBurning` and `isBurning` from `../index.js` in test files (same
  pattern as `burning_status.test.js`).
- Do **not** change client rendering — enemy flame VFX already reads
  `burningUntil` from the snapshot (291 sub-ticket 03).

## Verification: code
