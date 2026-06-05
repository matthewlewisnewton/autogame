# Launch ready-up: idempotent & observable

Harden the Launch Bay ready-up path delivered in sub-ticket 01 so it cannot
double-fire `playerReady(true)` and so the launch action is observable in the
console (a stable log marker + a `launch:ready` window event). Both the physical
booth action and the `?booth=launch` debug hook route through the same hardened
helper. This makes the launch gate provable in a captured run and prevents
redundant ready emits on a repeated booth touch or a `lobbyJoined` reconnect.

## Acceptance Criteria

- `client/launchBooth.js` exports a pure helper `shouldLaunchReadyUp(currentIsReady)`
  that returns `true` only when `currentIsReady` is falsy (i.e. ready-up should
  proceed) and `false` when the player is already ready. It also exports a stable
  event-name constant `LAUNCH_READY_EVENT = 'launch:ready'`.
- `launchBoothReadyUp()` in `client/main.js` is idempotent: it calls
  `shouldLaunchReadyUp(isReady)` first and returns early when already ready, so
  `socket.emit('playerReady', true)` is emitted at most once per ready-up — a
  second booth touch or a repeated `lobbyJoined` (reconnect) does NOT re-emit.
- When `launchBoothReadyUp()` does ready the player up, it logs a stable marker
  `console.log('[launchBooth] ready-up via booth')` and dispatches a
  `LAUNCH_READY_EVENT` window `CustomEvent` (so the launch is observable in
  capture console output / by other modules). No new SOCKET event is introduced —
  it still routes through the existing `playerReady` → `checkAllReady` →
  `startGame` server path.
- The physical booth listener (`BOOTH_ACTION_EVENT` → launch) and the
  `?booth=launch` debug hook in the `lobbyJoined` handler both call the same
  hardened `launchBoothReadyUp()` (no duplicated ready logic).
- The 2D `#ready-btn` Ready button handler is unchanged and still toggles ready /
  launches the run exactly as before (it does NOT go through
  `shouldLaunchReadyUp`, so it can still toggle ready off as well as on).
- `client/test/launchBooth.test.js` is extended to cover `shouldLaunchReadyUp`
  (true when not ready, false when already ready) and asserts
  `LAUNCH_READY_EVENT === 'launch:ready'`. The existing helper tests stay green.
- `pnpm test` passes (server + client vitest suites), including the new cases.

## Technical Specs

- **`game/client/launchBooth.js`**: keep the module pure / DOM-free. Add:
  - `export const LAUNCH_READY_EVENT = 'launch:ready';`
  - `export function shouldLaunchReadyUp(currentIsReady) { return !currentIsReady; }`
  - Do not import `window`/`socket` here.
- **`game/client/main.js`**:
  - Extend the existing import from `./launchBooth.js` (line ~154) to also pull
    in `shouldLaunchReadyUp` and `LAUNCH_READY_EVENT`.
  - Update `launchBoothReadyUp()` (~line 3956) to:
    1. `if (!shouldLaunchReadyUp(isReady)) return;`
    2. set `isReady = true;`, `socket.emit('playerReady', true);`,
       `syncReadyButtonRole();` (unchanged ordering),
    3. then `console.log('[launchBooth] ready-up via booth');` and
       `window.dispatchEvent(new CustomEvent(LAUNCH_READY_EVENT));`.
  - Leave the `BOOTH_ACTION_EVENT` listener (~line 3965) and the `?booth=launch`
    branch in the `lobbyJoined` handler (~line 1057) calling
    `launchBoothReadyUp()` as-is — they now inherit idempotency for free.
  - Do NOT touch the `#ready-btn` click handler (~line 3934) or the
    `#resume-run-btn` handler — only `launchBoothReadyUp()` changes.
  - Do not touch `server/`.
- **`game/client/test/launchBooth.test.js`**: add cases for `shouldLaunchReadyUp`
  and the `LAUNCH_READY_EVENT` constant value; keep the existing
  `isLaunchBoothAction` / `getBoothDebugHook` cases.

## Verification: code
