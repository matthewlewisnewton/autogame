# Client-side adoption of the shared event registry

Replace every magic-string event literal in the **client** `socket.emit(...)` and
`socket.on(...)` call sites with a reference into the shared
`game/shared/events.json` registry created in sub-ticket 01, so both ends of every
event resolve to the same constant.

## Acceptance Criteria

- `game/client/main.js` imports the registry via
  `import EVENTS from '../shared/events.json' with { type: 'json' }` (matching the
  JSON-import style already used in `client/config.js` / `client/cards.js`).
- Every gameplay-event string literal passed as the first argument of
  `socket.emit(...)` / `s.emit(...)` / `socket.on(...)` / `s.on(...)` in
  `game/client/main.js` is replaced by a reference into the registry
  (e.g. `EVENTS.stateUpdate`). This includes the `runComplete` / `runFailed`
  listeners (around `main.js:1411-1412`) that must match the server's dynamic
  emit.
- The Socket.IO lifecycle listeners `connect`, `disconnect`, `connect_error`
  remain raw string literals (they are not game events and are intentionally
  excluded from the registry).
- The other client files that emit events — `game/client/renderer.js`
  (`move`, `lootPickup`, `boothInteract`) and `game/client/characterBooth.js`
  (`unlockHat`) — also import the registry and use registry constants for their
  event-name literals.
- Every event name referenced from the client already exists as a key in
  `game/shared/events.json` (no new names needed; if a client name is missing
  from the registry, add it to `events.json`).
- The game still builds and existing client tests pass
  (`pnpm test` in `game/`); emitted/listened wire names are byte-for-byte
  identical to before.

## Technical Specs

- Client files to update: `game/client/main.js` (primary — ~25 emits + ~40
  `s.on` listeners), `game/client/renderer.js`, `game/client/characterBooth.js`.
- Import style: `import EVENTS from '../shared/events.json' with { type: 'json' }`
  (Vite supports JSON import attributes; mirror `client/config.js` line 5).
- Replace only the first-argument event-name literal at each call site; leave
  payloads and callbacks untouched.
- Depends on sub-ticket 01 (`game/shared/events.json` must already exist). Do NOT
  modify server files or add the drift test here.
- Do NOT modify `game/client/test/**`.

## Verification: code
