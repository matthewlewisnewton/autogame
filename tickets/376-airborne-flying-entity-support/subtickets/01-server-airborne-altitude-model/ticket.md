# Server airborne altitude + flying model

Add a general, symmetric server-side altitude system: entities gain an optional
`flying` flag and an `altitude` (hover height above the floor). A shared
`resolveEntityY()` helper computes Y for ANY entity — floor-snapped when
grounded, `floorY + altitude` when flying — so it serves flying enemies and
flying minions now and is reusable by a future player fly/hover card. Fliers
must NOT be snapped to the floor.

## Acceptance Criteria
- A general helper (e.g. `resolveEntityY(entity, layout)`) exists in
  `game/server/simulation.js`: returns `resolveFloorY(sampleFloorY(layout, entity.x, entity.z))`
  when the entity is not flying, and that floor height **plus** the entity's
  hover altitude when `entity.flying` is truthy. It takes the entity as an
  argument (not hard-coded to players/enemies) so any entity type can use it.
- A module-level default hover altitude constant exists (e.g.
  `DEFAULT_FLY_ALTITUDE`); an entity with `flying` but no explicit `altitude`
  falls back to it.
- All three existing player Y assignments in `simulation.js` (the two in the
  movement branches and the edge-hazard re-snap) route through the new helper
  instead of calling `resolveFloorY(sampleFloorY(...))` directly. A player with
  `flying`/`altitude` set would hover; with no flag, player Y is unchanged from
  today (grounded behavior is byte-for-byte preserved for non-flying players).
- Each tick, every enemy and every minion has its `.y` set via the helper after
  its movement/AI runs, so grounded ones sit at floor height and flying ones
  hover at `floorY + altitude` and are never re-grounded.
- At least one enemy def (`ember_wraith` in `ENEMY_DEFS`) carries `flying: true`
  and an `altitude` value, so spawned wraiths are airborne (verified via the
  existing `...statFieldsFromDef` spread in `spawnEnemy`).
- The aerial minions `storm_eagle` and `thunderbird` are flagged `flying: true`
  with an `altitude` when created in `cardEffects.js`, so they hover.
- Airborne entities remain targetable: existing enemy targeting / attack-range
  logic (planar X/Z distance) is unchanged and still selects and is selected by
  airborne entities; introducing `.y` does not alter any range/cone math.
- New server tests assert: a flying enemy's `y === floorY + altitude` (and is
  NOT equal to the floor-snapped Y), a grounded enemy's `y === floorY`,
  `resolveEntityY` returns a hovered Y for a plain `{flying, altitude, x, z}`
  object (generality), and flagged `storm_eagle`/`thunderbird` minions hover.
  The full server test suite passes.

## Technical Specs
- `game/server/simulation.js`:
  - Add `DEFAULT_FLY_ALTITUDE` constant and `resolveEntityY(entity, layout)`
    helper using the already-imported `sampleFloorY` / `resolveFloorY`.
  - Replace `player.y = resolveFloorY(sampleFloorY(ctx.layout, ...))` at the
    ~551, ~585, ~599 sites with `player.y = resolveEntityY(player, ctx.layout)`.
  - In the enemy update loop and the minion update loop, after movement, set
    `entity.y = resolveEntityY(entity, _gameState.layout)`.
  - Add `flying: true` + `altitude` to `ENEMY_DEFS.ember_wraith`.
  - Export `resolveEntityY` / `DEFAULT_FLY_ALTITUDE` if needed by tests.
- `game/server/cardEffects.js`: in the `storm_eagle`/`thunderbird` branch
  (~line 1257), set `minion.flying = true` and `minion.altitude = <value>`.
- `game/server/test/`: add a focused test file (e.g. `airborne.test.js`)
  covering the criteria above. Do NOT modify floor-sampling internals.

## Verification: code
