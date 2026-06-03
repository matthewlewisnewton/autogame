# Senior Review — 168-bug-intermittent-stuck-lobby-socket

## Runtime health (gate)

- `round-3/metrics.json`: `"ok": true`, `capturePlanValid: true`, `pageerrors: []`.
  No `harness_failure` block.
- Final probes show `connectionState: "connected"`, `phase: "playing"`,
  `sceneInitialized: true`, both players present, dodge cooldown HUD active —
  the full flow (auth → lobby create/join → ready → gameplay → dodge) completed.
- `round-3/console.log`: no `pageerror` / `[fatal]` lines. The two
  `409 (Conflict)` "Failed to load resource" entries come from the auth
  registration endpoint (`game/server/auth.js:123` → "Username taken") when the
  harness re-registers an already-existing test user; the client falls back to
  login and the scene initializes normally. Pre-existing harness auth-flow
  behaviour, not introduced by this ticket, and the game proceeds to `playing`.

Game starts and loads cleanly. Gate passes.

## Scope of change

`git diff bc09790..HEAD` touches only:
- `game/client/main.js` (+74) — socket connect/reconnect watchdog
- `game/client/test/main.test.js` (+168) — coverage for the watchdog
- three sub-ticket `ticket.md` files (docs)

No server code changed, so the server suite is unaffected. The change is tightly
scoped to the Goal (connection/reconnect resilience + surfacing an error).

## Acceptance criteria

### "Investigate reconnect handling and surface an error/timeout when the socket fails to connect" — MET

The bug was a silently stuck lobby when the socket never connects/reconnects.
The implementation addresses it on three fronts:

1. **Explicit socket config** (`createSocket`): `timeout: CONNECT_WATCHDOG_MS`,
   `reconnection: true`, `reconnectionAttempts: Infinity`, with bounded
   delay/delayMax — replaces reliance on undocumented socket.io defaults so a
   stalled connect deterministically emits `connect_error`.

2. **Connect watchdog** (`startConnectWatchdog`/`clearConnectWatchdog`): a 10s
   absolute deadline armed on socket creation, on post-connect `disconnect`, on
   `reconnect_attempt`, and on non-auth `connect_error`. If neither `connect`
   nor `reconnect` fires in time it escalates from transient "retrying…" to a
   persistent, user-visible failure via both the always-visible status line
   (`updateStatus('Connection failed — reload to retry', 'disconnected')`) and
   the lobby-browser error surface (`showLobbyBrowserError`). The error surface
   is independent of which screen is showing, so it covers both reported hang
   points ("create lobby → room visible" and "ready → UI shown").

3. **Idempotent absolute deadline**: `startConnectWatchdog` is a no-op while a
   timer is pending, so a rapid retry loop (failures arriving faster than 10s)
   cannot perpetually postpone the deadline — directly targeting the reported
   "rapid sequential sessions" flake. Proven by the dedicated test.

Recovery paths are correct: `connect`/`reconnect` clear the watchdog and the
error surface; an auth `connect_error` clears the watchdog first so the
"session expired" message is never overwritten by a generic connect-timeout.

### "Existing server + client tests pass; the game starts and loads cleanly" — MET

- Client suite re-run locally: `Test Files 1 passed`, `Tests 146 passed (146)`,
  including the 5 new watchdog tests (escalation, clear-on-connect,
  re-arm-on-disconnect, clear-on-reconnect, rapid-retry-loop escalation).
- Server: no server files changed; suite unaffected.
- Captured run starts and loads cleanly (see gate above).

## Consistency with design / requirements

Purely additive client-side connection resilience. No gameplay, netcode, or
state-replication semantics changed; nothing in `design.md` / `requirements.md`
is regressed. The capture confirms movement, dodge cooldown, enemies, and HUD
still function.

## Code quality

Clean, well-commented, symmetric arm/clear lifecycle across handlers, reuses the
existing error/status surfaces rather than inventing new UI. No dead code, no
console errors. No debug scenarios were added or changed.

## Remaining gaps

None blocking. (One minor wording nit recorded in `nits.md`.)

VERDICT: PASS
