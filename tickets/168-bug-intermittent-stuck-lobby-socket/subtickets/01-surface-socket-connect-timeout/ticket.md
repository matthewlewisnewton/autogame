# Surface a connect timeout / error when the socket never connects

When a fresh Socket.IO connection is created but never reaches `connect`
(e.g. the vite ws-proxy resets with ECONNRESET under rapid sequential
sessions), the player is left silently stuck in the lobby with only a subtle
"Connection failed — retrying..." badge that never escalates. Add a
client-side connection watchdog that surfaces a clear, persistent error to the
user when the socket fails to connect within a timeout, and harden reconnect
handling so a give-up state is also surfaced.

## Acceptance Criteria

- When a socket is created via `createSocket()` and does NOT reach the `connect`
  event within a bounded timeout (e.g. ~10s), the client surfaces a clear,
  user-visible error (distinct from the transient "retrying..." status) telling
  the player the connection failed and offering a way to recover (reload / retry).
- The watchdog timer is started when the socket is (re)created and is cleared on
  a successful `connect`, so a normal connection never triggers the error.
- A repeated/persistent `connect_error` no longer leaves the user with only the
  transient "retrying..." text forever — after the timeout window the surfaced
  error reflects a real failure state, not an indefinite silent retry.
- The socket is created with explicit reconnection options (e.g. an explicit
  `timeout` and `reconnection` settings) rather than relying on undocumented
  defaults, so initial-connect failures deterministically produce a
  `connect_error` the client can act on.
- The existing JWT/auth `connect_error` recovery path (clears token, shows the
  login form, "Session expired — please log in again") is preserved and still
  takes precedence over the generic connect-timeout error.
- Existing server + client tests pass; the game starts and loads cleanly. A new
  client test asserts the watchdog surfaces an error when `connect` never fires
  and is cleared when `connect` arrives in time.

## Technical Specs

- `game/client/main.js`:
  - In `createSocket(token)` (around line 720), pass explicit options to
    `io(...)` — keep `auth: { token }` and add an explicit connection `timeout`
    and `reconnection` config so a stalled initial connect produces a
    `connect_error` instead of hanging silently.
  - Add a module-level watchdog timer (mirror the `heartbeatTimer` pattern).
    Start/reset it whenever a socket is created (in `createSocket` or at the top
    of `bindSocketHandlers`); clear it inside the existing `connect` handler
    (around line 783) and the `s.io.on('reconnect', ...)` handler (around line
    798). When the watchdog fires, call `updateStatus(...)` with a clear failure
    message and surface a persistent, user-visible error (e.g. via the existing
    lobby-browser error region `showLobbyBrowserError(...)` and/or a visible
    status state) prompting the user to reload/retry.
  - In the existing `connect_error` handler (around line 803), keep the
    `isAuthError` branch exactly as-is (it must still win). Only the non-auth
    branch should interact with the watchdog/persistent-error surface.
- `game/client/test/main.test.js`: add a test near the existing
  `connect_error handler` / `bindSocketHandlers` suites (around lines 2653–2906)
  that uses `window.createSocket` / `window.bindSocketHandlers` /
  `window.__triggerSocketEvent` and fake timers to assert: (a) when `connect`
  never fires within the timeout the surfaced error is shown, and (b) firing
  `connect` before the timeout clears the watchdog so no error is shown.

## Verification: code
