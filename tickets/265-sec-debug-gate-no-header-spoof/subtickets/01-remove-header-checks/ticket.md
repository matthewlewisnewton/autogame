# 01-remove-header-checks

Remove client-controlled Origin/Host header checks from `isDebugScenarioAllowed()`. The function currently allows debug scenarios if the Origin or Host header looks like localhost — both are trivially spoofable by a remote attacker. Replace the header checks with a peer-address-only gate (plus the existing env-var fast paths).

## Acceptance Criteria

- `isDebugScenarioAllowed()` no longer reads `socket.handshake.headers.origin` or `socket.handshake.headers.host`
- The function still returns `true` when `ALLOW_DEBUG_SCENARIOS=1` (env fast-path unchanged)
- The function still returns `false` when `NODE_ENV=production` (env fast-path unchanged)
- The function returns `true` only when the peer socket address is loopback (`::1`, `127.0.0.1`, or `*.127.0.0.1`)
- All existing tests that set `ALLOW_DEBUG_SCENARIOS=1` continue to pass

## Technical Specs

- **File:** `game/server/index.js` — edit `isDebugScenarioAllowed()` (lines ~543–556)
- Drop the `origin` and `host` variables and the `localOrigin`/`localHost` checks
- Keep `localAddress` (peer socket address) as the sole non-env gate
- Remove the unused `host` variable entirely

## Verification: code
