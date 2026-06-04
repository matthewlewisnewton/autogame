# Evolution test hooks (debug scenario + harness-state exposure + client test helper)

Add the deterministic test instrumentation needed to drive a card evolution in a
headless playthrough and inspect the result. This is test/QA instrumentation
only — it must NOT change normal gameplay; debug-scenario branches are gated
behind `ALLOW_DEBUG_SCENARIOS=1`, and harness-state fields are inside the
existing `v8 ignore` block.

## Acceptance Criteria

- A new debug scenario named `evolution-ready` is registered in the server's
  `DEBUG_SCENARIOS` set and handled in `debugScenarios.js`. The scenario stays
  in the **lobby** phase (does NOT call `enterPlayingPhase`).
- When invoked in a lobby, the `evolution-ready` scenario gives the player a
  `skeleton_knight` card instance at exactly `+10` grind (the
  `EVOLUTION_GRIND_REQUIRED` threshold) in their inventory, adds that instance
  to their selected deck, and updates `ownedCards`. It also sets the player to
  full HP and full Magic Stones. The scenario returns the standard
  `{ ok: true, scenario: 'evolution-ready' }` shape.
- `window.__AUTOGAME_HARNESS_STATE__()` exposes the player's inventory with
  evolution-relevant fields: add a top-level `inventory` array containing
  `{ instanceId, cardId, grind, isEvolved, evolvedFrom }` for each inventory
  instance (copied from `myInventory`, or `[]` when null). This lets a test
  read grind levels and evolution metadata.
- `window.__AUTOGAME_HARNESS_STATE__()` also exposes the most recent evolution
  result as `lastEvolutionResult` — the `cardEvolutionResult` payload
  (`{ instance, fromCardId, toCardId }`, or `null` if none yet). Capture it in
  the existing `cardEvolutionResult` socket handler into a module-scoped
  variable the harness-state getter reads.
- A new client test helper `window.__evolveCardForTest(instanceId)` is added:
  emits `socket.emit('evolveCard', { instanceId })` and returns a
  `Promise<{ ok, instance?, fromCardId?, toCardId?, reason? }>` resolving on
  `cardEvolutionResult` or `cardEvolutionError` (with a 10s default timeout).
  Model on `window.__requestDebugScenarioForTest`.
- A server unit test in `game/server/test/undead_commander.test.js` (or a new
  `game/server/test/evolution-smoke.test.js`) covers the `evolution-ready`
  scenario: after applying it, the player has a `skeleton_knight` instance at
  `+10` grind in inventory, and calling `evolveCard` on that instance yields
  `undead_commander` with `isEvolved: true`, `grind: 0`, and
  `evolvedFrom: 'skeleton_knight'`.
- Existing server + client test suites pass (`pnpm test`); normal (non-debug)
  runs are unaffected.

## Technical Specs

- `game/server/index.js`: add `'evolution-ready'` to the `DEBUG_SCENARIOS` set
  (alongside `hat-shop-currency`, `hats-unlocked`). No changes needed to the
  socket handler — the `debugScenario` event already dispatches to
  `debugScenarios.js`.
- `game/server/debugScenarios.js`: add the `evolution-ready` branch as a
  lobby-phase scenario (mirroring `hat-shop-currency`). Key steps:
  set `state.gamePhase = 'lobby'`, `player.ready = false`, `player.hp = MAX_HP`,
  `player.magicStones = MAX_MAGIC_STONES`. Create a `skeleton_knight` instance
  via `createCardInstance('skeleton_knight', { grind: 10 })` (import
  `createCardInstance` from `./progression` — it is already imported). Push the
  instance into `player.inventory`, normalize via `normalizePlayerInventory`,
  ensure the instance's `instanceId` is in `player.selectedDeck`, and return
  `{ ok: true, scenario: name }`. Place the branch before the
  `enterPlayingPhase` call (after the `hats-unlocked` branch).
- `game/client/main.js`:
  - Extend `window.__AUTOGAME_HARNESS_STATE__` (~line 3978) with `inventory`
    (map `myInventory` to `{ instanceId, cardId, grind, isEvolved, evolvedFrom }`)
    and `lastEvolutionResult` (read from a new module-scoped variable).
  - Add a module-scoped `let lastEvolutionResult = null;` and capture the
    payload in the existing `cardEvolutionResult` handler (~line 1241):
    `lastEvolutionResult = data;`.
  - Add `window.__evolveCardForTest(instanceId)` (~after `__configureDeckForTest`):
    emits `evolveCard`, listens for `cardEvolutionResult` / `cardEvolutionError`
    via `socket.once`, resolves on either, 10s default timeout clamped to
    [1s, 30s]. Return shape: `{ ok, instance?, fromCardId?, toCardId?, reason? }`.
  - Keep all new fields inside the existing `// v8 ignore` coverage-exclusion
    block.
- `game/server/test/undead_commander.test.js` (or new test file): add a test
  using the existing `startTestServer` / `connectClient` helpers. Emit
  `debugScenario { name: 'evolution-ready' }`, wait for `debugScenarioResult`,
  then read player state to verify the `+10` `skeleton_knight` instance exists.
  Call `evolveCard(player, instanceId)` and assert the transformed instance.

## Verification: code