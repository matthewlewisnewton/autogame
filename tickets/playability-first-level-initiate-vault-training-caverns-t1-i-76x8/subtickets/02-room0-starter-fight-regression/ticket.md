# Room-0 starter-deck combat regression (Initiate Vault tier 1)

Lock in that a cold-start player with the default starter hand can survive and clear Initiate Vault tier-1 room 0 using real weapon combat — not godmode, not debug scenarios. The test should reproduce the damage race that currently kills players at `defeatedEnemies=0/6` and fail on the pre-fix baseline.

## Acceptance Criteria

- New vitest deploys `training_caverns` tier 1 (fixed layout seed), spawns room-0 wave-0, and gives the player a starter hand containing `iron_sword` with full charges.
- After the 3s aggro grace (`vi.useFakeTimers()` + `updateEnemies()` ticks), the test drives **real** combat via `handleUseCard` (or socket `useCard` in integration style) while stepping enemy AI with `updateEnemies()`.
- Combat script focuses one grunt at a time (move into weapon range, swing, brief retreat/step between wind-ups) — no godmode, no manually zeroing enemy HP.
- When both room-0 grunts are defeated: `players.p1.hp > 0`, `players.p1.dead === false`, and `run.objective.defeatedEnemies >= 2`.
- Room-0 wave clear unlocks the first passage lock (`run.passageLocks[0].locked === false` after wave 0 clear).
- `pnpm test:quick` passes with the new test included; existing `training_caverns_spawn_camp.test.js` grace-window assertions remain valid.

## Technical Specs

- **`game/server/test/training_caverns_room0_starter_fight.test.js`** (new)
  - Follow deploy patterns from `training_caverns_spawn_camp.test.js` and `passage_lock_chain.test.js` (`generateLayout`, `spawnEnemies`, `startDungeonRun`, `rebuildWallColliders`, fake timers for grace).
  - Seed player hand: `[{ id: 'iron_sword', type: 'weapon', charges: 5, remainingCharges: 5, grind: 0 }, …]` matching starter loadout shape.
  - Wire `handleUseCard` callbacks like `spherical_aoe_cards.test.js` (mock socket/lobby, `setCallbacks` from `cardEffects.js`) **or** use the integration harness helpers from `integration.test.js` (`startTestServer`, `connectClient`, `useCard` emit) — prefer the lighter unit path if it exercises the same server combat path.
  - Loop: advance past grace → step player toward nearest grunt → `useCard` iron_sword → run enemy ticks until hit resolves → repeat until both room-0 grunts removed; assert survival and objective/progression state.
  - Use layout seed `1` (same as spawn-camp test) or `questLayoutSeed('training_caverns', 1)` for determinism.
- **`game/server/test/training_caverns_spawn_camp.test.js`** (only if needed)
  - Adjust post-grace HP-drop assertion timing if tutorial grunt damage changes make the existing threshold flaky; keep the “100 HP during grace” assertion intact.

## Verification: code
