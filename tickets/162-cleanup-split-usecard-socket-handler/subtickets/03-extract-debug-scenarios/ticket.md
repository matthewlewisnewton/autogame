# Extract applyDebugScenario into a debugScenarios module

`applyDebugScenario(socket, name)` in `game/server/index.js`
(~lines 568–906) is a ~340-line function with a long `name === …` chain that
sets up each debug scenario. Move that scenario setup into a new
`game/server/debugScenarios.js` module so each scenario is an isolated seam.
This is a behavior-preserving refactor only.

## Acceptance Criteria

- A new file `game/server/debugScenarios.js` exists and contains the per-
  scenario setup logic previously inline in `applyDebugScenario`.
- In `game/server/index.js`, `applyDebugScenario` (still called by
  `socket.on('debugScenario')`) is a thin wrapper that delegates to the new
  module; the per-`name` scenario branches no longer live inline in `index.js`.
- The same up-front guards and order are preserved: lobby lookup, unknown-
  scenario check against `DEBUG_SCENARIOS`, player existence, deck validation,
  and the shared player reset (`dead`, `firstMoveAfterSpawn`, `lastMoveTime`,
  `debugScenario`, `pendingSummons.clear()`).
- The return-value contract is unchanged: `{ ok: true, scenario }` on success
  and `{ ok: false, reason }` on every failure path, with identical `reason`
  strings.
- Any symbols the test suite imports from `index.js` remain exported from
  `index.js`; the behavior exercised by `test/debug-scenarios.test.js` and any
  spawn/scenario suites (e.g. `arena_spawn_cover`, `spire_ascent_spawn`,
  `sunken_canyon_spawn`) is unchanged.
- `cd game && pnpm test` passes; the game starts and loads cleanly.

## Technical Specs

- New file: `game/server/debugScenarios.js`.
- Edit: `game/server/index.js` — replace the per-`name` body of
  `applyDebugScenario` with a delegating call into `debugScenarios.js`; keep the
  `socket.on('debugScenario')` registration and the `applyDebugScenario`
  entry point wired in `index.js`.
- Follow the same module-seam / setter-injection pattern as
  `game/server/simulation.js` (no `require('./index')` cycle).
- Helpers the function relies on (`getLobbyForSocket`, `withLobbyContext`,
  `firstRoomPosition`, `normalizePlayerInventory`, `validateDeck`, spawn/enemy
  helpers, the `DEBUG_SCENARIOS` set, constants like `MAX_HP`/
  `MAX_MAGIC_STONES`, etc.) must be supplied via injection or import — do not
  duplicate their logic.
- Do not change scenario semantics, reason strings, or any file other than
  `index.js` and the new `debugScenarios.js`.

## Verification: code
