# Route client `.once`/`.off` listener names through the shared registry

Several client socket listener helpers in `game/client/main.js` still register
and remove listeners with raw event-name string literals via `socket.once(...)`
and `socket.off(...)`, so those listener names can drift from
`game/shared/events.json`. Replace them with the matching `EVENTS.*` constants.
`EVENTS` is already imported at the top of `main.js`.

## Acceptance Criteria

- All `socket.once(...)` and `socket.off(...)` calls in `game/client/main.js`
  for these events use `EVENTS.*` instead of a raw string literal:
  `debugScenarioResult`, `deckUpdate`, `deckError`, `cardEvolutionResult`,
  `cardEvolutionError`.
- No raw string literal of those five event names remains as a first argument
  to `.once`/`.off` (or `.on`/`.emit`) anywhere in `main.js`.
- The runtime event names are unchanged; the helpers still listen for and clean
  up the same events — only the source of the name moves to the registry
  constant.
- Each replacement uses the registry key with the identical name
  (`EVENTS.debugScenarioResult`, `EVENTS.deckUpdate`, `EVENTS.deckError`,
  `EVENTS.cardEvolutionResult`, `EVENTS.cardEvolutionError`), all of which exist
  in `events.json`.

## Technical Specs

- `game/client/main.js`: update the `.once`/`.off` call sites (around lines
  2019–2028 for `debugScenarioResult`; 2043–2050 for `deckUpdate`/`deckError`;
  2084–2101 for `cardEvolutionResult`/`cardEvolutionError`). Replace each raw
  string first argument with the matching `EVENTS.*` constant.
- The `onResult`/`onUpdate`/`onError` callback references passed as the second
  argument are unchanged — only the event-name argument changes.
- Do not change any other files or the registry.

## Verification: code
