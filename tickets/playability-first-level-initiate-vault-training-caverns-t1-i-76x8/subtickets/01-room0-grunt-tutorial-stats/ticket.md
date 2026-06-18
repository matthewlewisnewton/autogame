# Room-0 grunt tutorial stat overrides (Initiate Vault tier 1)

Initiate Vault tier-1 room-0 wave-0 still spawn-camps new players after the 3s aggro grace: two full-HP grunts (`hp=100`, `attackDamage=10`) converge within melee range and out-damage the starter `iron_sword` (17 dmg). Add quest-local spawn stat overrides and tune room-0 grunts down so the opening fight is survivable without changing global `ENEMY_DEFS.grunt` or later rooms.

## Acceptance Criteria

- `training_caverns` tier 1 room-0 wave-0 grunts still spawn as **two** `grunt` enemies with `towardPassage: true` and `aggroGraceMs: 3000` unchanged.
- Each room-0 entry grunt spawns with **reduced tutorial stats** (target band: `hp` 45–55, `attackDamage` 6–8) via per-spawn overrides — not by editing global `ENEMY_DEFS.grunt`.
- Later Initiate Vault waves/rooms (room 1 skirmishers, room 2 vault pair + Vault Stalker) keep default enemy stats from `ENEMY_DEFS`.
- Deploying Initiate Vault tier 1 leaves both room-0 grunts at least `ENEMY_ATTACK_RANGE` (4) from the player spawn (existing bulkhead placement preserved).
- Existing tests that assert Initiate Vault structure (`tier1_quest_identity.test.js`, `passage_lock_chain.test.js`, `training_caverns_spawn_camp.test.js`, `training_caverns_named_rare.test.js`) still pass after updating any spawn-def expectations.

## Technical Specs

- **`game/server/scriptedEncounters.js`**
  - Extend `ScriptedSpawnDef` with optional numeric `hp` and `attackDamage` fields.
  - When spawning a scripted enemy, pass overrides through to `ctx.spawnEnemy` (e.g. `spawnOpts.hp`, `spawnOpts.attackDamage`) or apply immediately after spawn so `maxHp` matches `hp`.
- **`game/server/progression.js`**
  - In `spawnEnemy()`, honor `opts.hp` (sets both `hp` and `maxHp` after variant/party scaling) and `opts.attackDamage` when provided.
- **`game/server/quests.js`**
  - On `training_caverns` tier 1 `scriptedEncounters.rooms[roomIndex: 0].waves[0].spawns`, add tutorial overrides to both grunt entries (example starting point: `hp: 50`, `attackDamage: 7` — tune within the acceptance band if needed).
- **`game/server/test/tier1_quest_identity.test.js`**
  - Update room-0 spawn expectations if the test asserts bare grunt spawn shape without overrides.

## Verification: code
