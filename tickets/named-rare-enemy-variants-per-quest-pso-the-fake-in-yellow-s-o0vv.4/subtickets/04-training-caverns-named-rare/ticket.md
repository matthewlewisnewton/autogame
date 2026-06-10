# Training Caverns tier 1 named rare

Author the `training_caverns` tier 1 quest script with a hand-placed named rare variant (PSO-style hunt target) that spawns only in Initiate Vault and drops a guaranteed unique reward on first kill per run.

## Acceptance Criteria

- `training_caverns` tier 1 defines `script.waves`; bulk combat spawn is bypassed and `defeat_enemies` total equals scripted spawn count.
- Exactly one scripted spawn is a named rare based on a quest-pool type (`grunt` or `skirmisher`) with a distinct authored name (e.g. **Vault Marauder**), elevated `hpMult`/`damageMult`, custom `tint`, and optional `scaleMult`.
- The named rare spawns at an authored position in a deeper vault room (use `enter_room` + `vault_dais` landmark binding or stable room coordinates from the crowded layout seed).
- Killing it grants a configured unique drop (suggest a vault-themed reward card such as `dungeon_drake`, or a new `drop-only` card if needed) on first kill per run only.
- `frost_crossing` and `ember_descent` runs do not spawn this named rare.
- Vitest deploys `training_caverns` tier 1 and asserts scripted spawn, `namedRare` snapshot fields, and first-kill drop.

## Technical Specs

- **`game/server/quests.js`**: Add `script.waves` to `training_caverns.tiers[1]`. Mirror wave-chaining patterns from `quest_script_fixture` tests: `run_start` grunts, `enter_room` wave on `{ landmark: 'vault_dais' }` hosting the named rare plus adds. Inline `variant` on the rare spawn entry per ticket 01 schema.
- **`game/server/test/training_caverns_named_rare.test.js`** (new): Integration test for this quest tier only.
- **`game/server/debugScenarios.js`** (optional): Shortcut scenario placing the player near the named-rare room.

## Verification: code
