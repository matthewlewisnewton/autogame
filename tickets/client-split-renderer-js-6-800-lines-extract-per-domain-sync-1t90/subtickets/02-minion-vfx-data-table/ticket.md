# Replace the nested minion-attribution VFX ladder with a data table

The enemy HP-drop detector in `animate()` attributes tick damage to the nearest
minion and fires a different flash color + VFX per minion type through a deeply
nested `fromThunderbird ? … : (fromStormEagle ? … : …)` ladder (~100 lines)
repeated for the enemy flash, the spawned effect, and the minion flash. Replace
this with a single data table keyed by minion type so the branching collapses to
one lookup, with behavior byte-for-byte identical.

## Acceptance Criteria

- A module-level constant data table (e.g. `MINION_HIT_VFX`) keyed by minion type (`thunderbird`, `storm_eagle`, `ancient_wyrm`, `null_crawler`, `bulkhead_mauler`) exists in `game/client/renderer.js`.
- Each entry carries the data the ladder currently hardcodes: the enemy flash color, the attacking-minion flash color, and a description of the VFX to spawn (enough to reproduce the exact current `spawnChainLightningEffect` / `spawnLightningArc` / `spawnAttackEffect` + `spawnParticleBurst` call for that type).
- The HP-drop block in `animate()` resolves the nearest minion, looks up its type in the table (falling back to the existing default: enemy flash `0xff4444`, `spawnHitSpark`, minion flash `0x88ff88`), and applies flash colors + spawns the VFX from the table instead of the nested ternaries.
- The default case (no attributable minion, or unknown type) still flashes the enemy `0xff4444` and calls `spawnHitSpark({ x: enemy.x, y: renderY, z: enemy.z })`, and only flashes the minion when `nearestMinion && minionsMeshes[nearestMinion.id]` exist.
- For every minion type the emitted effect (function called, origin, direction, and style/options object) and both flash colors and durations match the pre-refactor ladder exactly.
- The `CARD_HIT_GRACE_MS` grace-window guard (skip when a recent `cardUsed` hit covers the drop) is preserved unchanged.
- Existing renderer tests pass.

## Technical Specs

- File: `game/client/renderer.js` only — the enemy HP-drop ladder currently spanning roughly lines 6570–6700 inside `animate()`.
- The table should let the call site stay a short loop: find `nearestMinion`/`nearestMinionDist`, look up `MINION_HIT_VFX[nearestMinion?.type]`, then flash + spawn. Keep direction-vector fallbacks (`{ x: 1, z: 0 }` when `nearestMinion` is null) intact.
- Some of this styling already half-exists in `cardRenderers` styles; you may reference but do not need to import it — keep the table local to `renderer.js` to avoid behavior drift.
- Do not change the enemy reconcile loop structure otherwise; this is a pure swap of the attribution branching. The enemy-loop extraction is a later sub-ticket.

## Verification: code
