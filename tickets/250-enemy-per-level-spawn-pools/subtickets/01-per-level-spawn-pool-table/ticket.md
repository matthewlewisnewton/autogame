# Per-level enemy spawn pool + weight table

Add a per-quest (per-level) enemy spawn pool with spawn weights to the quest
definitions, making at least one enemy type level-exclusive, plus pure helper
functions to read a quest's pool and draw a weighted enemy type. No spawn-logic
wiring yet — that is sub-ticket 02.

## Acceptance Criteria

- Every quest in `QUEST_DEFS` (`training_caverns`, `crystal_rescue`,
  `arena_trials`, `canyon_descent`, `spire_ascent`, `endless_siege`) has an
  `enemyPool` field: a non-empty array of `{ type, weight }` entries where
  `type` is a key of `ENEMY_DEFS` and `weight` is a positive number.
- At least one enemy type is **level-exclusive**: it appears in exactly one
  quest's `enemyPool` (the `spawner` type appears only in `spire_ascent`).
- The common types `grunt` and `skirmisher` each appear in the pools of two or
  more quests (so not every type is exclusive).
- A `getEnemyPool(questId)` helper returns the pool array for a valid quest id
  and falls back to the default quest's pool for an unknown/invalid id.
- A `pickWeightedEnemyType(pool, rng)` helper returns a `type` string drawn in
  proportion to the weights; it is deterministic for a given `rng` and, over
  many seeded draws, selects higher-weighted types more often than
  lower-weighted ones. It tolerates a single-entry pool (always returns that
  type) and never returns a type outside the pool.
- Both helpers are exported from `quests.js`.
- New vitest tests assert: each quest's pool contents (the set of types and
  their weights), the `spawner` level-exclusivity, that `grunt`/`skirmisher`
  are shared across multiple quests, `getEnemyPool` lookup + fallback, and the
  weighted/deterministic behaviour of `pickWeightedEnemyType` (e.g. a fixed
  `mulberry32` seed produces a stable type sequence and a heavily-weighted type
  dominates a large sample).

## Technical Specs

- `game/server/quests.js`:
  - Add an `enemyPool` array to each entry in `QUEST_DEFS`. Use only existing
    `ENEMY_DEFS` types (`grunt`, `skirmisher`, `miniboss`, `spawner`). Suggested
    thematic pools (implementer may tune weights but must honour the exclusivity
    + sharing ACs above):
    - `training_caverns`: `[{type:'grunt',weight:3},{type:'skirmisher',weight:2}]`
    - `crystal_rescue`: `[{type:'skirmisher',weight:3},{type:'grunt',weight:2}]`
    - `arena_trials`: `[{type:'grunt',weight:2},{type:'skirmisher',weight:2},{type:'miniboss',weight:1}]`
    - `canyon_descent`: `[{type:'skirmisher',weight:2},{type:'grunt',weight:2},{type:'miniboss',weight:1}]`
    - `spire_ascent`: `[{type:'grunt',weight:2},{type:'skirmisher',weight:1},{type:'miniboss',weight:1},{type:'spawner',weight:2}]`
    - `endless_siege`: `[{type:'grunt',weight:2},{type:'skirmisher',weight:2}]`
  - Add and export `getEnemyPool(questId)` (uses `getQuest`, falls back to
    `QUEST_DEFS[DEFAULT_QUEST_ID].enemyPool`).
  - Add and export `pickWeightedEnemyType(pool, rng)`: sum weights, draw
    `rng() * total`, walk entries subtracting weight; default `rng` to
    `Math.random` when omitted. Return the entry `type`.
- Add a test file under `game/server/` (e.g. `quests-spawn-pools.test.js`)
  using vitest. Import `mulberry32` from `progression.js` (or define a small
  seeded rng in the test) for deterministic weighted-draw assertions.
- Do NOT touch `spawnCombatEnemies`, `tickSpawns`, or any client code in this
  sub-ticket.

## Verification: code
