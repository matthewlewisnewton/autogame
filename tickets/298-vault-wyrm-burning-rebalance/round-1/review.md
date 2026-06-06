# Senior Review: 298-vault-wyrm-burning-rebalance

## Runtime health

PASS. The captured run loaded and played cleanly. `metrics.json` reports `ok: true`, the servers started, `pageerrors` is empty, and `pageerrors.json` is `[]`. `console.log` has no `pageerror` or `[fatal]` lines from game code; the only browser errors are 409 conflict resource responses during auth/lobby setup, which did not prevent lobby, deployment, movement, HUD, or gameplay capture.

The screenshots and probes show the normal lobby-to-run flow working: both players reach the lobby, the run enters `playing`, the scene/canvas and hand HUD are present, movement works, enemies are active, and the dodge cooldown HUD updates. The captured hand also shows Vault Wyrm with the `BURNING BREATH` effect label.

## Acceptance criteria findings

### Vault Wyrm damage is reduced by a modest amount

PASS. `game/shared/cardStats.json` lowers `dungeon_drake.attackDamage` from 3 to 2 while preserving the existing breath range/timing values. The server spawn path uses `applyWyrmMinionBreathStats()`, which resolves base breath damage from `cardDef.breathDamage ?? cardDef.attackDamage ?? 3`, so normal summoned Vault Wyrms inherit the new 2-damage tick at grind 0. The fallback in `updateMinions()` also now defaults base Vault Wyrm breath damage to 2.

### Vault Wyrm hits apply BURNING

PASS. `game/server/progression.js` copies `CARD_DEFS.dungeon_drake.burnDurationMs` onto spawned minions. `game/server/simulation.js` then applies `applyBurning(enemy, config.burnDurationMs)` to each enemy returned by the cone-hit collection when `cardId === 'dungeon_drake'`. The guard keeps this scoped to base Vault Wyrm, not evolved Archive/Ancient Wyrm.

The implementation uses the existing ticket 291 burning foundation, including refresh semantics through `applyBurning()`, so repeated breath ticks extend `burningUntil` without stacking additively or shortening an existing longer burn.

### Card stats and description text reflect burn

PASS. The shared `dungeon_drake` stats add `burnDurationMs: 2000` and `specialEffect: "burning_breath"`. Both server and client build `CARD_DEFS` from the shared JSON sources, and the client card HUD renders `specialEffect` by replacing underscores with spaces, producing the captured `BURNING BREATH` label on the Vault Wyrm cards.

### Server tests cover reduced damage and burn application

PASS. The new `game/server/test/vault_wyrm_burning.test.js` covers cone miss behavior, burn refresh/extension on subsequent breath ticks, and the evolved Wyrm non-burn guard. Existing Wyrm tests were updated to assert 50 HP -> 48 HP, `isBurning(enemy) === true`, and `burningUntil === now + 2000`. The changed `astral_guardian` default-minion assertion was also updated for the new fallback damage.

`coverage.log` shows the full test run passed: 53 test files and 1466 tests. Coverage was collected successfully with thresholds disabled.

## Design and requirements consistency

PASS. The change stays within the existing card-combat model: Vault Wyrm remains a creature/minion summon with channeled breath, but now trades lower direct damage for the already-established BURNING status. It does not alter the lobby/dungeon loop, movement, networking, rendering, or multiplayer foundations listed in `game/docs/design.md` and `game/docs/requirements.md`. The captured smoke run confirms server-client connection, 3D rendering, player representation, and movement synchronization still work.

## Debug scenarios

PASS. The ticket updates an existing `minion-combat` debug scenario's hard-coded Vault Wyrm stats to mirror production damage and burn duration. The scenario remains behind the existing debug-scenario path (`?debugScenario=...` / debug socket event from local debug flow), and normal gameplay can reach the equivalent end state by starting a run with Vault Wyrm in the deck and casting it near enemies. The scenario does not replace the production summon path or weaken server-side card validation for normal play.

## Remaining gaps

None.

VERDICT: PASS
