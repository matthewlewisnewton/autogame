# Entry grunt bulkhead placement (Initiate Vault tier 1)

Initiate Vault tier-1 room-0 wave-0 grunts currently spawn at the room center — the same point as the player deploy — so they overlap the spawn on load. Reposition those two grunts toward the outbound passage bulkhead (matching Kade's "two grunts block the bulkhead" line) using passage-relative offsets so they are out of immediate melee range across layout seeds.

## Acceptance Criteria

- After deploying `training_caverns` tier 1, both room-0 wave-0 grunts spawn at least `ENEMY_ATTACK_RANGE` (4) world units from the player deploy position at run start.
- Neither entry grunt shares the exact `(x, z)` coordinates of the player spawn point.
- Entry grunts remain inside room 0's walkable bounds and still belong to `scriptedWave` room `room:0` wave `0`.
- Existing scripted-encounter sequencing for Initiate Vault (passage locks, wave clears, Vault Stalker room) is unchanged.

## Technical Specs

- **`game/server/scriptedEncounters.js`**
  - Add a helper (e.g. `passageBulkheadOffset(layout, room)`) that finds the outbound passage from the room center (`passage.x1/z1 === room.x/z`) and returns a world offset toward `passage.x2/z2`, capped to stay inside the room (use ~`min(width, depth) / 2 - 1.5` along the passage axis).
  - Extend `resolveSpawnPosition` (or spawn loop in `spawnScriptedWave`) to honor a spawn flag such as `towardPassage: true` on a `ScriptedSpawnDef`; apply a small lateral spread for `spawnIndex > 0` so the two grunts flank the bulkhead.
- **`game/server/quests.js`**
  - On `training_caverns` tier 1 `scriptedEncounters.rooms[roomIndex: 0].waves[0]`, mark both grunt spawns with `towardPassage: true` (split `{ type: 'grunt', count: 2 }` into two entries if needed for lateral spread).
- **`game/server/test/tier1_quest_identity.test.js`**
  - Update the room-0 spawn expectation to reflect `towardPassage` (or per-grunt spawn entries) instead of bare `{ type: 'grunt', count: 2 }`.
- **`game/server/test/training_caverns_named_rare.test.js`** (if deploy helpers assert positions)
  - Ensure room-0 grunt positions are no longer identical to the start-room center.

## Verification: code
