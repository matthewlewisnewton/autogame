# 01 — Riftbound Colossus boss enemy (server def, drops, client visuals)

Add the `riftbound_colossus` enemy type: the hardest stage boss in the catalog, an
ice+fire convergence tyrant whose radial rift shockwave ignites (BURNING) anyone it
hits. Covers the server definition, drop/economy registry entries, and the client
render + windup-telegraph entries, mirroring how `crucible_sovereign` and
`cinder_warden` landed.

## Acceptance Criteria

- `ENEMY_DEFS.riftbound_colossus` exists in `game/server/simulation.js` with:
  - `name: 'Riftbound Colossus'` and a description referencing the ice+fire rift convergence.
  - `hp: 460` — strictly the highest stage-boss HP in `ENEMY_DEFS` (above `glacial_tyrant` 440) but **at most 460**: design.md records that 500 HP could not be defeated inside the 180s `defeatBoss` validation window, so do NOT exceed 460.
  - `attackDamage: 28` — strictly above every other stage boss (current max is `arena_champion` 26).
  - `attackStyle: 'radial'`, `attackRange: 5.5`, `attackWindupMs: 1200`, slow movement (`chaseSpeed` ≈ 1.1, `wanderSpeed` ≈ 0.5).
  - `burnDurationMs: 3000` so its attack applies BURNING on hit (same field/path as `ember_wraith`).
  - `surfacedStats` includes `hp`, `attackDamage`, `attackStyle`, `attackRange`, and `burnDurationMs`.
- `game/server/config.js` has `riftbound_colossus` entries in both the enemy card-drop map (value `'dungeon_drake'`, like other stage bosses) and `ENEMY_MS_DROPS` (value `80` — highest in the table, above `arena_champion`'s 70).
- `game/client/renderer.js` has a `riftbound_colossus` entry in the enemy geometry map (near line 612) with a distinct, largest-in-class silhouette (e.g. `type: 'cone'`, `radius` ≥ 1.4, `height` ≥ 3.0) and an ice/fire two-tone identity (e.g. deep ice-blue `color` with ember-orange `emissive`), plus a windup-telegraph entry (near line 635) with `style: 'radial'`, `range: 5.5`.
- A server test (e.g. `game/server/test/riftbound_colossus.test.js`) asserts: the def exists with the stats above; its HP and attackDamage are strictly greater than every other `objectiveType`-boss def listed in design.md's stage-boss band (`miniboss`, `annex_overseer`, `arena_champion`, `crucible_sovereign`, `spire_warden`, `cinder_warden`, `magma_colossus`, `permafrost_warden`, `glacial_tyrant`); HP ≤ 460; both `config.js` drop entries exist.
- A server test asserts a resolved `riftbound_colossus` radial attack applies BURNING to a hit player (player ends up with `burningUntil` in the future), following the existing `enemy.burnDurationMs > 0 → applyBurning(target, …)` path at `simulation.js` ~line 3045.
- A client test (pattern: `game/client/test/renderer-cinder-warden.test.js`) asserts the geometry and telegraph entries exist with the distinct colors.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/server/simulation.js` — add the def to `ENEMY_DEFS` (after `glacial_tyrant`, ~line 1302). No new attack mechanics: reuse `attackStyle: 'radial'` resolution and the existing `burnDurationMs` rider (see `ember_wraith` for the field, and ~line 3045 for where it is applied on hit). Not flying.
- `game/server/config.js` — add to the card-drop map (~line 67 block) and `ENEMY_MS_DROPS` (~line 85 block).
- `game/client/renderer.js` — add to the enemy geometry config (~line 612 block) and the windup telegraph config (~line 635 block).
- Tests: new `game/server/test/riftbound_colossus.test.js`; new or extended client renderer test under `game/client/test/`. Use existing boss tests (`ember_descent_stage_boss.test.js`, `renderer-cinder-warden.test.js`) as fixtures/patterns.
- Do NOT add the quest definition here — that is sub-ticket 02. The enemy type may be unreferenced by any quest at the end of this sub-ticket; that is expected.

## Verification: code
