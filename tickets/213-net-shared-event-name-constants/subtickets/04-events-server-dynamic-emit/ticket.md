# Route server dynamic-emit event names through the shared registry

Three server emit paths still hard-code gameplay event names as raw string
literals that feed a dynamic `socket.emit(event, ...)` call, so they bypass the
shared registry and can silently drift. Replace those raw defaults/values with
`EVENTS.*` references. `EVENTS` (`require('../shared/events.json')` /
`require('../../shared/events.json')`) is already imported in all three files.

## Acceptance Criteria

- `game/server/index.js` `emitQuestPayloadToLobby(...)` no longer defaults its
  `event` parameter to the raw string `'questUpdate'`; the default resolves to
  `EVENTS.questUpdate`.
- `game/server/socketHandlers/keyItemHandlers.js` no longer passes
  `phaseMismatch: { event: 'keyItemError', ... }` as a raw string; it uses
  `EVENTS.keyItemError`.
- `game/server/socketHandlers/lobbyHandlers.js` no longer passes
  `phaseMismatch: { event: 'medicError', ... }` as a raw string; it uses
  `EVENTS.medicError`.
- No raw gameplay event-name string literal (`'questUpdate'`, `'keyItemError'`,
  `'medicError'`) remains in these three files outside of imports/comments.
- The wire-level event names emitted are unchanged (`questUpdate`,
  `keyItemError`, `medicError`); behavior is identical — only the source of the
  name moves to the registry constant.

## Technical Specs

- `game/server/index.js` (~line 540): change
  `function emitQuestPayloadToLobby(lobby, { event = 'questUpdate', extraFields = {} } = {})`
  so the default is `EVENTS.questUpdate`.
- `game/server/socketHandlers/keyItemHandlers.js` (~line 14): change
  `phaseMismatch: { event: 'keyItemError', ... }` to
  `phaseMismatch: { event: EVENTS.keyItemError, ... }`.
- `game/server/socketHandlers/lobbyHandlers.js` (~line 227): change
  `phaseMismatch: { event: 'medicError', ... }` to
  `phaseMismatch: { event: EVENTS.medicError, ... }`.
- Do not change any other files or the registry. Confirm `EVENTS.questUpdate`,
  `EVENTS.keyItemError`, and `EVENTS.medicError` keys exist in
  `game/shared/events.json` (they do).

## Verification: code
