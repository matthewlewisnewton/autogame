# Align ice/slippery debug scenarios with production deploy

Remove or rework the `ice-cavern-stage` and `slippery-floor-lab` URL debug scenarios so they no longer bypass the real Frost Crossing quest/deploy flow. Every remaining ice/slippery harness shortcut must reach an end state equivalent to selecting `frost_crossing` tier 1 and deploying normally (quest id/tier, layout from `applyLayoutForQuest`, enemies spawned, dungeon run/objective started).

## Acceptance Criteria

- `ice-cavern-stage` is **removed** from `DEBUG_SCENARIOS` and `debugScenarios.js`, **or** its handler fully delegates through the same path as `frost-crossing-tier-1` (`selectedQuestId = 'frost_crossing'`, `selectedQuestTier = 1`, `applyLayoutForQuest`, `enterPlayingPhase`, `spawnEnemies`, `startDungeonRun`) with no bare `generateLayout(seed, 'ice-cavern')` layout swap.
- `slippery-floor-lab` is **removed** from `DEBUG_SCENARIOS` and `debugScenarios.js`, **or** it uses the real Frost Crossing deploy path above and then places the player on a production `floorSurface: 'slippery'` room from the generated `ice-cavern` layout (not a synthetic `profile: 'slippery-floor-lab'` inline layout).
- No debug scenario handler builds or registers a synthetic `slippery-floor-lab` layout profile for URL `?debugScenario=...` entry.
- `frost-crossing-tier-1` remains registered and unchanged as the canonical Frost Crossing deploy shortcut.
- `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN` in `index.js` stays consistent with whichever scenarios remain (drop removed names; keep `frost-crossing-tier-1`).
- `pnpm test:quick` passes with no regressions.

## Technical Specs

- `game/server/debugScenarios.js`:
  - Delete the `ice-cavern-stage` `else if` branch (lines ~1880–1900) **or** replace it with a call/delegation to the `frost-crossing-tier-1` setup block.
  - Delete the `slippery-floor-lab` early-return block (~1309–1372) **or** replace it with: run the `frost-crossing-tier-1` quest/deploy chain, then locate a slippery room in `state.layout.rooms` (e.g. `band === 'ice'` or `floorSurface === 'slippery'`), set `player.x/z/y` there, and zero `player.vx/vz`.
  - Do not leave dead synthetic layout objects with `profile: 'slippery-floor-lab'` in scenario handlers.
- `game/server/index.js`:
  - Remove `ice-cavern-stage` and/or `slippery-floor-lab` from the `DEBUG_SCENARIOS` set (and from `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN` if present) when those scenarios are deleted.
- Tests: no server tests currently reference these scenario names; update only if any test or socket-drift list asserts their presence. Client `slipperyFloorLabLayout()` in `game/client/test/dungeon.test.js` is a **local render fixture** — keep it; it is not a URL debug scenario.

## Verification: code
