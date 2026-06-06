# Field Medic energy bead — no self or ally damage

The medic's close-range energy bead must only damage players. Today `fireMedicEnergyBead` routes through `collectPhaseBeamHits`, which samples enemies starting at the ray origin, so the firing medic (and any allied enemies in the corridor) can take bead damage. Fix the hit collection so the bead is player-only and add regression tests.

## Acceptance Criteria

- When a `field_medic` fires its energy bead at a nearby player, **the medic's own HP is unchanged** after `updateEnemies` resolves the shot.
- When a wounded ally enemy (e.g. `grunt`) sits between the medic and the target player along the bead vector, **the ally's HP is unchanged** while the player still takes `attackDamage`.
- The existing bead test still passes: a player within `beadRange` loses HP, `lastBeadAt` updates, and `_pendingMedicBeads` is queued.
- No other `collectPhaseBeamHits` callers (e.g. minion phase beam at ~L2485) change behavior.
- `pnpm test` / vitest passes for `game/server/test/field_medic.test.js` and the full server suite.

## Technical Specs

- `game/server/simulation.js`:
  - Extend `collectPhaseBeamHits(..., options)` with a player-only path for enemy-fired beads — e.g. `options.playersOnly === true` skips the enemy and minion loops, **or** add `excludeEnemyId` (mirror existing `excludeMinionId`) plus start sampling enemies at `i >= 1` so the origin tile cannot self-hit. Prefer the approach that cleanly matches medic support role (player-only bead is simplest).
  - In `fireMedicEnergyBead`, pass the new option(s) so only living players along the narrow corridor are damaged; keep `{ attackerEnemyId: medic.id, hitWidth: 0.5 }` and existing VFX queue push unchanged.
- `game/server/test/field_medic.test.js`:
  - Add a case: medic at `(0,0)`, player at `(5,0)`, record `medic.hp` before/after `updateEnemies()` — expect unchanged.
  - Add a case: medic at `(0,0)`, ally `grunt` at `(2.5,0)` with reduced HP, player at `(5,0)` — expect `grunt.hp` unchanged and `players.p1.hp` reduced by `ENEMY_DEFS.field_medic.attackDamage`.
  - Reuse existing fake-timer setup (`lastBeadAt` primed past `beadCooldownMs`).

## Verification: code
