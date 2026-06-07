# Tier-2 rare Field Medic spawn pools

Wire `field_medic` into weighted spawn selection for **some** tier-2 quest runs only, with a low weight so it appears rarely. Tier-1 runs and quests without the extra pool must never spawn it.

## Acceptance Criteria

- `getEnemyPool(questId, tier)` (extended signature; `tier` optional, default tier 1) returns the quest's base `enemyPool` for tier 1.
- For tier 2, the effective pool merges the base pool with an optional quest-level `tier2EnemyPool` array (same `{ type, weight }` shape). Weights add to the draw — a `field_medic` entry with `weight: 1` against grunt weights of 2–3 makes it rare but possible.
- `field_medic` appears in `tier2EnemyPool` on **at least two** tier-2-capable quests (suggested: `training_caverns`, `crystal_rescue`, `canyon_descent`) and is **absent** from at least one other tier-2 quest (suggested: `arena_trials` or `spire_ascent`) to satisfy "some level-2 stages".
- `field_medic` is **not** in any quest's base `enemyPool` (tier-2 exclusive via `tier2EnemyPool`).
- All spawn paths that draw enemy types use the tier-aware pool:
  - `spawnCombatEnemies` in `progression.js` (pass `quest.tier`).
  - `survive` objective pool snapshot and `tickSpawns` in `objectives.js`.
  - Stage-boss encounter add spawns in `objectives.js` `stage_boss.spawnQuestEntities`.
- Seeded tier-2 runs for an eligible quest can produce `field_medic`; tier-1 runs for the same quest never do. Over many seeds on an eligible tier-2 quest, `field_medic` appears at least once but less often than common types.
- Vitest passes.

## Technical Specs

- `game/server/quests.js`:
  - Add optional `tier2EnemyPool` on selected `QUEST_DEFS` entries, each containing `{ type: 'field_medic', weight: 1 }` (weight tunable but must stay clearly "rare").
  - Extend `getEnemyPool(questId, tier = DEFAULT_QUEST_TIER)` to concatenate base + tier-2 extras when `normalizeQuestTier(tier) === 2`.
  - Keep `pickWeightedEnemyType` unchanged.
- `game/server/progression.js`:
  - In `spawnCombatEnemies`, replace `getEnemyPool(quest.id)` with `getEnemyPool(quest.id, quest.tier)`.
- `game/server/objectives.js`:
  - Pass `quest.tier` into `getEnemyPool` for survive snapshot and stage-boss add pool selection.
- `game/server/test/quests-spawn-pools.test.js` (extend) or new `field_medic_spawn.test.js`:
  - Tier-1 vs tier-2 pool contents, exclusivity, weighted appearance on eligible quests, absence on ineligible tier-2 quest.
- `game/server/test/enemy-spawn-pools-wiring.test.js`:
  - Update helpers/call sites if they assume `getEnemyPool(questId)` arity-1 only.
- Do **not** implement medic AI or client visuals in this sub-ticket.

## Verification: code
