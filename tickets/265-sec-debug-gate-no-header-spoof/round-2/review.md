# Senior review: 265-sec-debug-gate-no-header-spoof

**Ticket:** Remove spoofable `Origin`/`Host` header checks from `isDebugScenarioAllowed()`; gate debug scenarios on peer socket address and explicit env only.

**Commits since baseline `073a87524b4cee84be7e511200ba0ad002d2c8d2`:**
- `e7d4143` — remove header checks from debug gate
- `805e96d` — add unit tests for header spoof rejection

---

## Runtime health (capture round-2)

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| Servers started | Pass (`http://localhost:5177/`) |
| `pageerrors` | Empty `[]` |
| `failure_kind` | Absent |
| `console.log` | No `pageerror` or `[fatal]` lines; only Vite connect and `[initScene]` logs |

The captured run completed the deterministic full-flow smoke (auth, lobby, ready, movement, dodge). Gameplay probes show connected clients in `playing` phase with canvas, hand HUD, and dodge cooldown — consistent with a healthy session.

---

## Acceptance criteria

### Drop Origin/Host checks; gate on peer address and/or env

**Met.** `isDebugScenarioAllowed()` in `game/server/index.js` now:

1. Returns `true` immediately when `ALLOW_DEBUG_SCENARIOS === '1'` (explicit env override, unchanged).
2. Returns `false` when `NODE_ENV === 'production'` (unchanged).
3. Otherwise allows debug only when `socket.handshake.address` is loopback: `::1`, `127.0.0.1`, or ends with `.127.0.0.1` (IPv4-mapped suffix form).

The function no longer reads `socket.handshake.headers.origin` or `socket.handshake.headers.host`. A repo-wide grep under `game/server` finds no remaining `handshake.headers.origin` / `handshake.headers.host` usage.

The security fix closes the reported attack: a remote peer at `1.2.3.4` (or any non-loopback address) cannot enable debug by sending `Origin: http://localhost` or a localhost-looking `Host` header. Only the TCP peer address (or the explicit env flags) matters.

The `.127.0.0.1` suffix (note leading dot) is slightly stricter than the pre-ticket `endsWith('127.0.0.1')` check, which could false-positive on addresses like `evil127.0.0.1`. That tightening is appropriate for a security gate.

### Test that spoofed Origin/Host headers do NOT enable debug

**Met.** New file `game/server/test/debug-gate.test.js` with six cases:

- Rejects `1.2.3.4` and `203.0.113.50` with localhost-looking `origin`/`host` headers.
- Rejects empty or missing `handshake.address` even with spoofed headers.
- Regression guards: `127.0.0.1` and `::1` still allowed when env shortcuts are cleared.

Tests isolate the address path by unsetting `ALLOW_DEBUG_SCENARIOS` and `NODE_ENV` in `beforeEach`/`afterEach`. Coverage log shows all six tests passing in round-2 capture.

`isDebugScenarioAllowed` is exported from `module.exports` for testability — appropriate minimal surface.

---

## Design and requirements consistency

- **Scope:** Server-side authorization for the `debugScenario` socket handler (`socket.on('debugScenario', …)`). No gameplay or persistence logic changed.
- **`game/docs/design.md`:** No conflict; debug scenarios remain a dev/QA mechanism, not part of the player-facing core loop.
- **`game/docs/requirements.md`:** No references to debug gating; no regression observed.

This ticket did not add or change any `?debugScenario=` scenario definitions. Existing client behavior (`window.location.hostname` check before emitting) is UI-only; the server gate is authoritative and now correct. Remote users loading `?debugScenario=…` against a public host still receive `debugScenarioResult: { ok: false, reason: 'Debug scenarios are disabled' }` from the server.

---

## Code quality

- Focused two-commit change: ~7 lines removed from the gate, dedicated test file, no dead code left behind.
- Full vitest suite: **1780 passed** (round-2 `coverage.log` and local run). Coverage threshold failures are harness visibility only, not test failures.
- No browser console errors in capture.
- `ALLOW_DEBUG_SCENARIOS=1` still bypasses address checks for CI/integration tests — intentional per ticket wording (“and/or explicit env”).

---

## Debug scenario policy (informational)

No new debug scenarios were introduced. Existing scenarios remain behind:

- Server: `isDebugScenarioAllowed(socket)` on every `debugScenario` emit.
- Client: `?debugScenario=` URL param + localhost hostname guard before auto-request.

Normal gameplay (lobby → ready → dungeon) was exercised in capture without using a debug shortcut.

---

## Remaining gaps

None. Runtime proof is clean, acceptance criteria are fully met, and tests cover the spoof vector described in the ticket.

VERDICT: PASS
