# Connect watchdog must survive rapid retry loops

The connect/reconnect watchdog currently clears and recreates its timer on every
non-auth `connect_error` and every `reconnect_attempt`. In a rapid retry loop —
exactly the rapid-sequential-session flake this ticket targets — failures arrive
faster than `CONNECT_WATCHDOG_MS`, so the timer is reset before it ever fires and
the user is stuck in transient "retrying..." / "Reconnecting..." status forever
instead of reaching the persistent "reload to retry" failure surface. Make the
watchdog enforce an absolute deadline per failure episode so it fires after the
original bounded window regardless of retry frequency.

## Acceptance Criteria

- A rapid loop of non-auth `connect_error` and/or `reconnect_attempt` events
  arriving faster than `CONNECT_WATCHDOG_MS` still escalates to the persistent
  `'Connection failed — reload to retry'` / disconnected status (and the
  lobby-browser error) after the original bounded window from when the episode
  began — repeated retry signals must NOT postpone it.
- `startConnectWatchdog()` is idempotent while a timer is already pending: it
  does not clear/reset the existing deadline when called again mid-episode.
- A successful `connect` / `reconnect` still clears the watchdog, and a fresh
  episode (a new drop/connect failure after a clean clear) starts a new
  deadline — recovery and re-arming behavior from sub-tickets 01/02 is preserved.
- The auth-error (`jwt`/`token`/`unauthorized`) path still cancels the watchdog
  and surfaces "Session expired" — it is not affected by this change.
- A new test in `game/client/test/main.test.js` emits repeated non-auth
  `connect_error` and/or `reconnect_attempt` events at intervals shorter than
  `CONNECT_WATCHDOG_MS`, advances fake timers past the original window, and
  asserts the persistent failure surface appears.
- Existing server + client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/client/main.js`:
  - Modify `startConnectWatchdog()` (around line 1597) so that if a watchdog
    timer is already pending it is a no-op (returns early) rather than calling
    `clearConnectWatchdog()` and recreating the timer. This preserves the
    absolute deadline established when the episode began.
  - Keep `clearConnectWatchdog()` (around line 1610) as the single place the
    timer is cancelled (on `connect` line ~800, `reconnect` line ~821, and the
    auth-error branch line ~835), so a clean recovery still re-arms a fresh
    deadline on the next failure.
  - The `disconnect` (line ~810), `reconnect_attempt` (line ~817), and non-auth
    `connect_error` (line ~852) handlers continue to call
    `startConnectWatchdog()`; with the idempotent guard the first call in an
    episode sets the deadline and subsequent calls leave it intact.
  - Update the comments at lines ~815–816 and ~850–851 that currently claim the
    call "clears any prior timer first" / restarts, since that behavior is
    intentionally changing.
- `game/client/test/main.test.js`: add the rapid-retry-loop test described in
  the acceptance criteria using the existing fake-timer / mock-socket harness in
  that file.

## Verification: code
