# 02 — Crystal Rescue collect-then-ambush-then-extract arc

Rework `crystal_rescue` tier 1 (Prism Salvage) so collecting the **final** prism triggers a scripted ambush at the player's current room, then shifts the objective to an extraction beat ("get back to the entry dock") instead of instant victory on the third pickup.

## Acceptance Criteria

- `crystal_rescue` tier 1 keeps `objectiveType: 'collect_items'` with `itemCount: 3` and per-room **guard waves** authored in `scriptedEncounters` (no bulk `enemyCount` pool).
- Each prism pickup fires a distinct radio line (`onCrystalCollected` beacons for indices 1, 2, and 3).
- Collecting the **third** prism does **not** immediately complete the run; it spawns a one-shot **ambush wave** (authored enemy types/counts) at the collector's room position.
- After the ambush wave is cleared, the objective label/phase changes to extraction; the run completes only when the player reaches the **entry dock** (start room / `room.role === 'start'`) while extraction is active.
- Mid-run and completion dialogue reference the ambush and the return-to-dock beat (at least 3 distinct dialogue payloads across prism picks + extraction).
- Enemy totals remain solo-clearable on a starter deck.
- `cd game && pnpm test:quick` passes, including a new `game/server/test/crystal_rescue_tier1.test.js` that walks collect → ambush spawn → ambush clear → dock arrival → objective complete.

## Technical Specs

- **`game/server/quests.js`** — Extend `crystal_rescue.tiers[1]` with ambush + extraction config (e.g. `finalAmbush: { spawns: [...] }`, `extractionDestination: { roomRole: 'start' }`), refine guard-wave `scriptedEncounters`, and update `dialogueBeacons` / `dialogue` copy.
- **`game/server/objectives.js`** — Extend `collect_items` completion: when `extractionDestination` is set on the quest tier, defer `isComplete` until `run.objective.extractionReached` (or equivalent flag) after ambush cleared; increment `totalEnemies` for ambush spawns.
- **`game/server/scriptedEncounters.js`** — Add `spawnAmbushAtPlayer(run, gameState, spawns, ctx)` (or similar) invoked from crystal-collection hook; track ambush enemy ids on run state.
- **`game/server/progression.js`** — After `onCrystalCollected`, when `collectedItems === totalItems`, trigger final ambush instead of firing `objective_complete`; on player entering start room during extraction phase, set extraction flag and allow completion.
- **`game/server/questDialogue.js`** — Optional `onExtractionStart` / `onExtractionComplete` beacon trigger if needed for the dock-arrival line.
- **`game/server/test/crystal_rescue_tier1.test.js`** — New integration test for the full arc.
- **Do not** change `crystal_rescue` tier 2.

## Verification: code
