# Frost Crossing named rare: Frostmaw (glacial_thrower)

Author the `frost_crossing` tier 1 quest script with a hand-placed named rare — **Frostmaw**, a stronger `glacial_thrower` variant — that spawns only on this quest and drops a guaranteed unique reward on first kill per run.

## Acceptance Criteria

- `frost_crossing` tier 1 defines `script.waves`; bulk combat spawn is bypassed (`skipBulkCombatSpawn` true) and `defeat_enemies` total equals scripted spawn count.
- Exactly one scripted spawn is a `glacial_thrower` with inline `variant` naming it **Frostmaw** (distinct tint, `hpMult`/`damageMult` > 1); it spawns at an authored position in the ice field (not at run-start bulk positions).
- That enemy appears in snapshots with `namedRare.name === 'Frostmaw'` and `type === 'glacial_thrower'`.
- Killing Frostmaw grants a configured unique card drop (suggest `permafrost_lance`) to the killer on first kill per run; a second Frostmaw kill in the same run does not duplicate the reward.
- Other quests (including `training_caverns` and `ember_descent`) do not spawn Frostmaw.
- Vitest deploys `frost_crossing` tier 1 with the canonical layout seed and asserts wave spawn + named-rare fields + drop on kill.

## Technical Specs

- **`game/server/quests.js`**: Add `script.waves` to `frost_crossing.tiers[1]`. Use `enter_room` (or `waveCleared`) trigger bound to the ice sheet room; place supporting grunts/skirmishers in earlier `run_start` wave. Frostmaw spawn example shape:
  `{ type: 'glacial_thrower', x, z, variant: { name: 'Frostmaw', hpMult: 1.6, damageMult: 1.3, tint: 0x7dd3fc, scaleMult: 1.15, drop: { cardId: 'permafrost_lance' } } }`.
  Derive `x,z` from `generateLayout(questLayoutSeed('frost_crossing', 1), 'ice-cavern', …)` so positions are stable across runs.
- **`game/server/test/frost_crossing_named_rare.test.js`** (new): Integration test mirroring `quest_script_integration.test.js` patterns for this quest only.
- **`game/server/debugScenarios.js`** (optional): Add a `frost-crossing-frostmaw` shortcut scenario near the named-rare spawn for manual QA.

## Verification: code
