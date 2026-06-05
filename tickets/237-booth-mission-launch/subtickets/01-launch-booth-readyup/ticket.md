# Launch Booth: ready-up & start the run

Give the hub "Launch Bay" booth (`launch`) real behavior: interacting with it
readies the local player up — the same path the 2D Ready button uses — so the
server's `checkAllReady` gate launches the run for the whole party once everyone
is ready. Add a `?booth=launch` debug hook that fires the same launch action
without walking to the booth, and keep the existing 2D Ready/launch button
working.

The booth plumbing already exists end-to-end: the `launch` anchor is produced by
`generateHub` (`server/dungeon.js`), the server validates proximity and emits
`boothAction { boothId: 'launch', action: 'launch' }` (`server/socketHandlers/lobbyHandlers.js`),
and the client re-dispatches that as a `booth:action` window CustomEvent
(`client/main.js` + `client/boothPrompt.js`). No booth has attached behavior yet —
this sub-ticket is the first subscriber. **No server changes are required.**

## Acceptance Criteria

- A new client module (`client/launchBooth.js`) exports a helper that decides
  whether a `booth:action` detail is the launch booth (`boothId === 'launch'`)
  and a helper that parses the `?booth=` query param, returning `'launch'` (or
  `null` when absent/different).
- `client/main.js` subscribes to the `booth:action` window event (the
  `BOOTH_ACTION_EVENT` from `boothPrompt.js`); when the detail is the launch
  booth it readies the local player up by setting `isReady = true`, emitting
  `socket.emit('playerReady', true)`, and calling `syncReadyButtonRole()` —
  i.e. it routes through the SAME server ready-up → `checkAllReady` → `startGame`
  path as the Ready button (it does NOT introduce a new socket event).
- On lobby join, when `?booth=launch` is present in the page URL, the client
  fires the same launch ready-up action automatically (the debug hook), so the
  run can be launched without standing in the booth.
- The existing 2D `#ready-btn` Ready button still toggles ready and launches the
  run exactly as before — its handler is unchanged and still present.
- A unit test file (`client/test/launchBooth.test.js`) covers the new helpers:
  launch-action detection (true for `launch`, false for other/missing booth ids)
  and `?booth=` parsing (`'launch'`, a different booth, and absent → `null`).
- `pnpm test` passes (server + client vitest suites), including the new test.

## Technical Specs

- **`game/client/launchBooth.js`** (new): pure, DOM-free, unit-testable helpers.
  - `export const LAUNCH_BOOTH_ID = 'launch';`
  - `export function isLaunchBoothAction(detail)` → `true` when
    `detail && detail.boothId === LAUNCH_BOOTH_ID`, else `false`.
  - `export function getBoothDebugHook(search)` → parse a query string (e.g. via
    `new URLSearchParams(search)`) and return the `booth` param value or `null`.
  - Keep this module free of `window`/`socket` references so it stays testable
    like `boothPrompt.js`.
- **`game/client/main.js`**:
  - Import `isLaunchBoothAction`, `getBoothDebugHook`, `LAUNCH_BOOTH_ID` from
    `./launchBooth.js` (next to the existing `boothPrompt.js` import).
  - Factor the Ready-up body into a small local helper (e.g.
    `launchBoothReadyUp()`) that sets `isReady = true`,
    `socket.emit('playerReady', true)`, and `syncReadyButtonRole()` — mirroring
    the `resume-run-btn` handler around line 4283. Do NOT remove or alter the
    `readyBtn.addEventListener('click', …)` handler (~line 3934).
  - Add `window.addEventListener(BOOTH_ACTION_EVENT, (e) => { if (isLaunchBoothAction(e.detail)) launchBoothReadyUp(); })`.
    Import `BOOTH_ACTION_EVENT` from `./boothPrompt.js`.
  - In the `lobbyJoined` handler (~line 1049), if
    `getBoothDebugHook(window.location.search) === LAUNCH_BOOTH_ID`, trigger the
    same launch action (call `launchBoothReadyUp()` or dispatch
    `dispatchBoothAction({ boothId: 'launch', action: 'launch' })`). Guard so it
    only fires while in the lobby phase.
- **`game/client/test/launchBooth.test.js`** (new): vitest unit tests for
  `isLaunchBoothAction` and `getBoothDebugHook` per the acceptance criteria.
- Do not touch `server/` — the `boothAction`/`launch` anchor plumbing is done.

## Verification: code
