# QA: verify a non-default deck loadout applies to the in-run hand/deck

Drive the real game in a headless browser: configure a NON-DEFAULT deck loadout
in the lobby deck editor, start a run, and prove the in-run hand/deck is built
from exactly the chosen loadout. Deliver this as a Playwright smoke script that
asserts the match and captures screenshots + a state snapshot as evidence.

## Acceptance Criteria

- A new Playwright smoke script `game/client/scripts/test-deck-loadout.mjs`
  exists and, run end-to-end against isolated high ports, exits 0 and prints the
  asserted match.
- The script: registers a player, injects the token into
  `localStorage('autogame_token')`, enters a lobby, then configures a
  NON-DEFAULT deck loadout (a `selectedDeck` that differs from the player's
  default deck — e.g. a known 4-card set of owned cards).
- The script readies up and waits for `__AUTOGAME_HARNESS_STATE__().phase ===
  'playing'`, then asserts the in-run hand consists of exactly the cards in the
  configured loadout (the chosen cards are the ones drawn/equipped). With a
  4-card loadout the opening hand (size 4) fully determines this.
- The assertion is real: the script exits NON-ZERO and logs a clear diff if the
  in-run cards do not match the configured loadout (negative path is wired, not
  just a happy-path print).
- The script saves evidence to `game/docs/walkthroughs/deck-loadout/`: at least
  one screenshot showing the in-run card hand, and a JSON snapshot containing
  the configured loadout and the relevant `__AUTOGAME_HARNESS_STATE__()` output.
- Server is launched with `ALLOW_DEBUG_SCENARIOS=1` on an isolated high port and
  the client on an isolated high `--strictPort` with `HARNESS_GAME_PORT`
  matching, so live runs are untouched; all processes the script/run starts are
  cleaned up (no orphaned server or vite).
- Existing server + client tests still pass and the game starts and loads
  cleanly (no new console errors introduced by any instrumentation added).

## Technical Specs

- New file `game/client/scripts/test-deck-loadout.mjs`. Model the harness/login
  plumbing on `game/client/scripts/test-keyitems-capture.mjs` (the `register`
  helper, `loginWithToken` that sets `localStorage('autogame_token')` then
  reloads, and the create/enter-lobby flow).
- Configure the loadout by emitting socket events from page context via the
  game's active socket: `deckRemoveCard` then `deckAddCard` (handlers in
  `server/index.js:2766` and `server/index.js:3368`; both only act while
  `gamePhase === 'lobby'`). `deckAddCard` accepts `{ cardId }` or
  `{ instanceId }`; use owned cards so it is not rejected with `deckError`.
  Build a valid deck of exactly `DECK_MIN_SIZE` (4) specific card ids so the
  opening hand of `OPENING_HAND_SIZE` (4) reveals the whole loadout. Reference
  `client/deck-viewer.js` / `client/deck-loadout.js` for the lobby deck-editor
  state if driving via UI instead of raw socket emits.
- Read the default deck (to ensure "non-default") and confirm the run deck via
  `window.__AUTOGAME_HARNESS_STATE__()` (`client/main.js:3869`); use its `hand`
  array of card ids for the assertion. At run start the server builds
  `player.deck` from `selectedDeck` via `createDrawDeckFromSelectedDeck`
  (`server/progression.js`), shuffles, and draws the opening hand — so the hand
  card ids must be a subset/equal of the configured loadout.
- OPTIONAL, only if a loadout larger than the opening hand is needed: extend
  `window.__AUTOGAME_HARNESS_STATE__` in `client/main.js` to also expose the
  player's in-run draw `deck` (card ids) and `selectedDeck`, and compare the
  full multiset instead of just the hand. Keep this addition minimal and
  behavior-neutral.
- OPTIONAL: register an npm script (e.g. `test:smoke:deck-loadout`) in
  `game/client/package.json` alongside the other smoke scripts.
- Evidence output dir: `game/docs/walkthroughs/deck-loadout/` (PNG screenshot +
  JSON snapshot).

## Verification: code
