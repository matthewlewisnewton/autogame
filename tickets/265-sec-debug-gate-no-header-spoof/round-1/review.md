# Senior review: 265-sec-debug-gate-no-header-spoof

**Ticket:** Remove spoofable `Origin`/`Host` checks from `isDebugScenarioAllowed()`; gate debug scenarios on peer socket address and explicit env only, with tests for header spoofing.

**Commits reviewed:** `e7d4143` (remove header checks), `805e96d` (unit tests). Baseline: `073a87524b4cee84be7e511200ba0ad002d2c8d2`.

**CONTEXT.md:** not present in the ticket folder (review used `ticket.md` and `game/docs/design.md` only).

---

## Runtime health (blocking)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | **`false`** |
| `failure_kind` | `capture_failed` (not `browser_pageerror`) |
| `pageerrors` / `pageerrors.json` | **Empty** — no uncaught browser exceptions |
| `console.log` `pageerror` / `[fatal]` | **None** |
| Dev servers | Server log shows Vite on **5177** and game server on **3004** with two player connects; capture then failed |

The captured browser run did **not** complete successfully. `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`. `console.log` shows HTTP **409** and **502** responses, Vite **socket.io proxy `ECONNREFUSED`** (see `capture_diagnosis.client_log_tail`), and harness timeouts (`joinLobby` / `page.waitForFunction`). `screenshot.log` only reached `01-initial.png` before lobby visibility timed out.

There are **no** game JavaScript page errors (`pageerrors` is `[]`). This is **not** a code defect in the ticket’s changes; it is a **harness/capture infrastructure** failure (client could not maintain a working socket.io path through the Vite proxy during capture). Per review rules, that still forces **`VERDICT: FAIL`** — we have no proof the game loads cleanly in the browser for this round.

### Code merit if capture had succeeded

On static review and unit tests, the implementation **would** meet the ticket’s acceptance criteria (see below). Re-run capture after clearing port/proxy issues; do not churn on `game/` for this failure mode.

## Harness blockers

**Signature:** `capture_failed` — Vite http proxy `ECONNREFUSED` to `/socket.io/`, HTTP 409/502 on static/proxy resources, capture wait timeouts.

**Evidence (client log tail):**
```
[vite] http proxy error: /socket.io/?EIO=4&transport=polling&t=...
AggregateError [ECONNREFUSED]:
    at internalConnectMultiple (node:net:1134:18)
```

**Port holders at diagnosis:** Vite held **5177**; **3004** listed empty in `port_holders` despite earlier `Server listening on port 3004` in `server_log_tail` — consistent with server/process lifecycle or proxy target mismatch during capture, not with a change in `isDebugScenarioAllowed`.

---

## Acceptance criteria

### 1. Drop Origin/Host checks; gate on peer address and/or explicit env only

**Met in code.**

`isDebugScenarioAllowed` in `game/server/index.js` now:

1. Returns `true` when `ALLOW_DEBUG_SCENARIOS === '1'` (unchanged env fast-path).
2. Returns `false` when `NODE_ENV === 'production'` (unchanged).
3. Otherwise returns `true` only when `socket.handshake.address` is loopback: `::1`, `127.0.0.1`, or ends with `.127.0.0.1`.

It **no longer** reads `socket.handshake.headers.origin` or `socket.handshake.headers.host`. A repo-wide grep of `index.js` confirms no remaining debug-gate use of those headers (only unrelated CORS `origin: "*"` on line 76).

The `debugScenario` socket handler still calls `isDebugScenarioAllowed(socket)` before `applyDebugScenario` — server-side gate unchanged in structure.

### 2. Test that spoofed Origin/Host headers do NOT enable debug

**Met.**

New file `game/server/test/debug-gate.test.js` (6 cases):

- Non-loopback address `1.2.3.4` with `origin: http://localhost:5173` and `host: localhost:5173` → `false`.
- Public IP `203.0.113.50` with matching localhost headers → `false`.
- Empty / missing `handshake.address` with spoofed headers → `false`.
- Regression: `127.0.0.1` and `::1` with empty headers → `true`.

Tests unset `ALLOW_DEBUG_SCENARIOS` and `NODE_ENV` in `beforeEach` so the address gate is exercised. Harness `coverage.log`: **6/6 passed** in `debug-gate.test.js`; full harness run **948 tests passed**.

Function is exported on `module.exports` for testability — appropriate for this ticket.

---

## Design and requirements consistency

- **Security goal:** Remote clients can no longer enable debug by spoofing `Origin`/`Host` while connecting from a non-loopback peer address. Aligns with the ticket and does not conflict with `game/docs/design.md` (no debug-gate content there).
- **`game/docs/requirements.md`:** No debug-scenario requirements referenced; no regression identified.
- **Debug scenarios:** This ticket did not add or change any `?debugScenario=` URL shortcut or scenario definitions. Existing debug flows remain behind the same `debugScenario` socket event + `isDebugScenarioAllowed` gate; integration tests continue to use `ALLOW_DEBUG_SCENARIOS=1` where needed.

---

## Code quality

- Change is minimal and focused (6 lines removed from the gate, export added, dedicated test file).
- No dead code left from removed `origin`/`host` variables.
- Minor behavioral tweak: loopback suffix check changed from `endsWith('127.0.0.1')` to `endsWith('.127.0.0.1')`, slightly tightening false positives on odd address strings; loopback regression tests still pass.

---

## Remaining gaps

1. **Blocking — no clean captured run:** `metrics.json` has `"ok": false`. Browser capture did not reach a stable lobby/game state. Fix is harness re-capture (ports/proxy), not game code — see `gaps.md`.

No blocking gaps in the security implementation or unit tests themselves.

---

VERDICT: FAIL
