## Do Not Arm The Connect Watchdog For Intentional Disconnects

`performLogout()` intentionally disconnects the current socket while returning to the auth overlay, but the generic `disconnect` handler can still arm the reconnect watchdog. The resulting timeout is mostly hidden because the HUD and lobby browser are also hidden, but it can leave stale watchdog state around manual logout/login transitions and is worth cleaning up.

### Acceptance Criteria

- Logging out does not start or leave behind a pending connect watchdog.
- Replacing a socket for account/profile token refresh still gets a fresh watchdog window for the new socket.
- A targeted client test covers manual logout or intentional socket teardown with fake timers.

## Watchdog message implies a reload is required when auto-reconnect may still recover

When the connect watchdog fires it shows "Connection failed — reload to retry", but `reconnection` is configured with `reconnectionAttempts: Infinity`, so socket.io keeps retrying in the background and a later `reconnect` silently clears the error. The wording overstates the need to reload. Consider softening it so the message matches the actual auto-recovery behaviour.

### Acceptance Criteria

- The persistent connection-failure message no longer asserts that reloading is the only way to recover, given background reconnection remains active.
- If a background `reconnect` succeeds, the message is still cleared (existing behaviour preserved).
