# Card-evolution playthrough smoke script (Playwright)

Add a headless-browser smoke script that drives the full card evolution flow —
from lobby through evolve button click to verifying the evolved card replaces
the base form — and captures evidence. Reuses the deterministic hooks added in
sub-ticket 01.

## Acceptance Criteria

- A new Playwright script `game/client/scripts/test-card-evolution.mjs` exists,
  modelled on the sibling smoke scripts (`test-deck-loadout.mjs`,
  `test-quest-completion.mjs`).
- The script launches its OWN isolated server + client on high, non-default ports
  so live runs are untouched: server `PORT=32xx`, vite `--port 52xx --strictPort`
  with `HARNESS_GAME_PORT` matching, server env `ALLOW_DEBUG_SCENARIOS=1` and
  `PERSISTENCE_BACKEND=memory`. It tears down every process it starts on success
  AND failure.
- The script drives the real flow: `POST /api/register`, inject the token into
  `localStorage('autogame_token')`, create a lobby, and wait for lobby UI
  (reuse the patterns already in `test-deck-loadout.mjs`).
- The script invokes
  `window.__requestDebugScenarioForTest('evolution-ready')`, asserts the
  scenario applied (`ok: true`), then reads
  `window.__AUTOGAME_HARNESS_STATE__()` and confirms the inventory contains a
  `skeleton_knight` instance with `grind >= 10`.
- The script triggers evolution via `window.__evolveCardForTest(instanceId)`
  using the `skeleton_knight` instance's ID, and asserts the result:
  `ok: true`, `fromCardId: 'skeleton_knight'`, `toCardId: 'undead_commander'`.
- The script then reads `__AUTOGAME_HARNESS_STATE__()` and verifies the
  post-evolution state: `lastEvolutionResult` is populated, the inventory
  instance now has `cardId: 'undead_commander'`, `isEvolved: true`,
  `evolvedFrom: 'skeleton_knight'`, and `grind: 0` (grind resets after
  evolution).
- The script saves evidence: at least one screenshot (of the deck editor showing
  the evolved card) and a JSON state snapshot (the final
  `__AUTOGAME_HARNESS_STATE__()` plus `lastEvolutionResult`) under
  `game/docs/walkthroughs/card-evolution/`, and prints the saved paths.
- The script exits non-zero on any failure and `0` only when the full
  lobby → evolution-ready → evolve → verify path is confirmed.
- Existing server + client test suites still pass; the game starts and loads
  cleanly via the script's own launch.

## Technical Specs

- New file: `game/client/scripts/test-card-evolution.mjs`. Use `playwright`
  `chromium` headless. Copy the server/client spawn + readiness-wait + login
  helpers from `test-deck-loadout.mjs` (it launches an isolated server with
  `ALLOW_DEBUG_SCENARIOS=1` + `PERSISTENCE_BACKEND=memory` and a vite client on
  a chosen port).
- Depends on sub-ticket 01's hooks: the `evolution-ready` debug scenario, the
  `inventory` and `lastEvolutionResult` fields on `__AUTOGAME_HARNESS_STATE__`,
  and `window.__evolveCardForTest(instanceId)`.
- Use existing in-page helpers only: `window.__requestDebugScenarioForTest(name)`,
  `window.__AUTOGAME_HARNESS_STATE__()`, `window.__evolveCardForTest(instanceId)`,
  and `window.__deckStateForTest()` (for reading inventory before evolution).
- After evolution, the script should also click the deck editor's "Owned Cards"
  panel (or wait for the auto-refresh from `cardEvolutionResult`) and capture a
  screenshot showing the evolved `undead_commander` card with its evolved badge.
- Output dir: `game/docs/walkthroughs/card-evolution/` (create with
  `fs.mkdirSync(..., { recursive: true })`), matching the convention used by
  `test-deck-loadout.mjs`.
- Optionally wire a `test:smoke:card-evolution` script entry in
  `game/package.json` next to the other `test:smoke:*` scripts (only if it fits
  cleanly alongside them).
- This is the only sub-ticket permitted to commit a permanent smoke script; it
  belongs alongside the existing `game/client/scripts/*.mjs` smoke tests.

## Verification: code
