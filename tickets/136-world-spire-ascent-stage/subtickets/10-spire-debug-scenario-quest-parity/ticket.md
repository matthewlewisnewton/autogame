# Spire Debug Scenario Quest Parity

Fix `spire-ramp-passage` and `spire-summit-combat` so they build the same quest, layout, run objective, and enemy setup as a normal `spire_ascent` deploy — then only reposition the player onto the ramp or summit for QA shortcuts.

## Acceptance Criteria

- For both `spire-ramp-passage` and `spire-summit-combat`, `applyDebugScenario()` sets `state.selectedQuestId = 'spire_ascent'` and calls `applyLayoutForQuest(state, 'spire_ascent')` **before** `enterPlayingPhase()`, so layout seed, profile, and `layout.stage` match the real quest path.
- After `enterPlayingPhase()`, `state.run.questId` is `spire_ascent`, `state.run.objective.type` is `defeat_enemies`, and `state.run.objective.totalEnemies` equals `state.enemies.length` with count `QUEST_DEFS.spire_ascent.enemyCount` (5).
- Enemy placement uses the normal spire spawn path: at least one enemy on the summit treasure tier and enemies spread across multiple combat tiers (not all on tier 1).
- `spire-ramp-passage` does **not** regenerate layout with `generateLayout(..., { stage: 'spire-ascent' })` using the previously selected quest’s seed/profile after play has started.
- `spire-ramp-passage` places the player on the midpoint of the first ramp passage (`state.layout.passages[0]`) after run/enemy setup, with `player.y` from `sampleFloorY()`.
- `spire-summit-combat` places the player at the summit treasure room center after run/enemy setup, with `player.y` from `sampleFloorY()`.
- Both scenarios still emit `questUpdate` (or equivalent client sync) with the spire layout so connected clients see the updated dungeon.
- New or extended tests in `game/server/test/` assert quest/run/enemy parity for both scenario names (lobby remains on default quest before the shortcut).

## Technical Specs

- **Primary file:** `game/server/index.js` — `applyDebugScenario()`.
- **Refactor flow:**
  1. Add a shared pre-play block for `spire-ramp-passage` and `spire-summit-combat` (replace the current `spire-summit-combat`-only `applyLayoutForQuest` at lines ~572–574): `state.selectedQuestId = 'spire_ascent'` then `applyLayoutForQuest(state, 'spire_ascent')`.
  2. Keep the common path: set spawn from `firstRoomPosition()`, call `enterPlayingPhase(lobby)` so `spawnEnemies()` and `startDungeonRun()` run against the spire quest layout.
  3. In the post-play branches (~777–812), **remove** manual `generateLayout(seed, profile, { stage: 'spire-ascent' })` and bounds/collider rebuild from `spire-ramp-passage`; only reposition the player on the first ramp and emit `questUpdate` if layout changed relative to clients.
  4. In `spire-summit-combat`, keep summit reposition logic but drop redundant layout regeneration if `applyLayoutForQuest` already ran pre-play.
- **Tests:** Extend `game/server/test/integration.test.js` (e.g. the existing `Debug scenarios — run objective stays in sync` pattern with `runScenarioCaptureSnapshot`) or add focused cases in `game/server/test/server.test.js` that call `applyDebugScenario` / socket `debugScenario` with lobby `selectedQuestId` still `training_caverns`, then assert `snap.run.questId === 'spire_ascent'`, spire layout `stage`, enemy count 5, and tier-distributed spawns.
- **Do not change:** quest defs, layout generator, or client renderer — only debug-scenario wiring.

## Verification: code
