# Surface a persistent error when a post-connect socket drop never reconnects

After a socket reaches `connect` once, the connect watchdog is cleared and is
never restarted, so a later drop (`disconnect` / `reconnect_attempt` /
persistent non-auth `connect_error`) can sit in transient "Reconnecting..." /
"Connection failed — retrying..." status forever, because reconnection is
configured as infinite. Restart a bounded reconnect watchdog when the socket
drops after a good connection so a stalled reconnect escalates to the same
clear, persistent reload/retry error the fresh-connect path already surfaces.

## Acceptance Criteria

- After a successful `connect`, if the socket later drops and does NOT
  re-establish a connection within a bounded window, the client escalates from
  the transient "Reconnecting..." / "Connection failed — retrying..." status to
  the same persistent, user-visible failure surface used for the initial
  connect timeout (a clear "Connection failed — reload to retry" status AND the
  persistent lobby-browser error prompting reload/retry) — it no longer stays
  in transient status indefinitely.
- The reconnect watchdog is (re)started on a post-connect `disconnect`,
  `reconnect_attempt`, and on a repeated/persistent non-auth `connect_error`,
  and is cleared whenever the socket successfully (re)connects (`connect` /
  `reconnect`), so a connection that recovers in time never shows the
  persistent error.
- A normal reconnect that succeeds within the window clears the watchdog and
  restores the "Connected" status with no persistent error shown.
- The JWT/auth `connect_error` recovery path (clears token, shows the login
  form, "Session expired — please log in again") is preserved and still takes
  precedence: an auth error clears the watchdog and never escalates to the
  generic connection-failed surface.
- Existing server + client tests pass; the game starts and loads cleanly.
- A new client test asserts that, after a `connect` followed by a `disconnect`
  (or `reconnect_attempt`) with no subsequent `connect`/`reconnect`, the
  persistent connection-failed error surfaces once the watchdog window elapses;
  and that firing `connect`/`reconnect` before the window clears the watchdog so
  no persistent error is shown.

## Technical Specs

- `game/client/main.js`:
  - Reuse the existing `connectWatchdogTimer` / `CONNECT_WATCHDOG_MS` /
    `startConnectWatchdog()` / `clearConnectWatchdog()` machinery (around lines
    1429–1605). Do NOT add a second timer variable — restart the same watchdog.
  - In `bindSocketHandlers(s)` (around lines 793–844):
    - In the `s.on('disconnect', ...)` handler (line ~803), after setting the
      "Disconnected" status, call `startConnectWatchdog()` so an unrecoverable
      drop escalates.
    - In the `s.io.on('reconnect_attempt', ...)` handler (line ~809), start/reset
      the watchdog (it is idempotent: `startConnectWatchdog()` clears any prior
      timer first) so a stalled reconnect loop still escalates.
    - Keep `s.on('connect', ...)` (line ~796) and `s.io.on('reconnect', ...)`
      (line ~813) clearing the watchdog as they already do.
    - In the non-auth branch of `s.on('connect_error', ...)` (line ~841), ensure
      the watchdog is running (e.g. `startConnectWatchdog()`); leave the
      `isAuthError` branch exactly as-is — it must still call
      `clearConnectWatchdog()` and win.
  - Confirm the watchdog callback (`startConnectWatchdog`, line ~1587) already
    surfaces both `updateStatus('Connection failed — reload to retry',
    'disconnected')` and `showLobbyBrowserError(...)`; reuse it unchanged so the
    post-connect failure surface matches the initial-connect failure surface.
- `game/client/test/main.test.js`: add a test near the existing
  `connect_error` / `bindSocketHandlers` / watchdog suites that uses
  `window.createSocket` / `window.bindSocketHandlers` /
  `window.__triggerSocketEvent` with fake timers to assert (a) `connect` then
  `disconnect` (or `reconnect_attempt`) with no later `connect`/`reconnect`
  surfaces the persistent error after `CONNECT_WATCHDOG_MS`, and (b) a
  `connect`/`reconnect` before the window clears the watchdog so no persistent
  error appears.

## Verification: code
