# Entry aggro grace and spawn-camp regression test

Even with bulkhead placement, entry grunts still detect the stationary player within `DETECTION_RADIUS` (8) and can land chip damage during the intro dialogue window. Add a short aggro grace on Initiate Vault tier-1 room-0 wave-0 scripted grunts and lock the behavior in with a vitest regression.

## Acceptance Criteria

- Deploying Initiate Vault tier 1 and standing still for 3 seconds leaves the player at **100/100 HP** (use fake timers + repeated `updateEnemies()` ticks, matching existing combat tests).
- After the grace window expires, moving the player toward the entry grunts causes at least one grunt to enter `chasing` or `windup` and eventually reduce player HP below 100 when left in range (combat still works).
- Aggro grace applies only to `training_caverns` tier 1 room-0 wave-0 scripted grunts — not global enemy silence, not other quests, not later waves/rooms.
- `pnpm test:quick` passes with the new test included.

## Technical Specs

- **`game/server/quests.js`**
  - Add `aggroGraceMs: 3000` on `training_caverns` tier 1 `scriptedEncounters.rooms[roomIndex: 0].waves[0]`.
- **`game/server/scriptedEncounters.js`**
  - When spawning a scripted wave, if the wave def includes `aggroGraceMs`, set `enemy.aggroGraceUntil = simNow() + aggroGraceMs` on each spawned enemy (import `simNow` from `simulation.js` or set from a timestamp passed through spawn ctx).
- **`game/server/simulation.js`**
  - In `updateEnemies`, skip acquiring/chasing/attacking players (and starting windup against them) while `enemy.aggroGraceUntil > simNow()`. Grace should not block minion targeting or post-grace combat.
- **`game/server/test/training_caverns_spawn_camp.test.js`** (new)
  - Deploy `training_caverns` tier 1 via the same pattern as `passage_lock_chain.test.js` / `tier1_scripted_arcs.test.js` (`spawnEnemies`, `startDungeonRun`, `rebuildWallColliders`).
  - `vi.useFakeTimers()`: advance 3000 ms with ~20 `updateEnemies()` calls per second; assert `players.p1.hp === 100`.
  - Advance past grace, nudge player toward room-0 grunts, run more ticks; assert HP drops below 100 or a grunt reaches `windup`/`recovering` against the player.

## Verification: code
