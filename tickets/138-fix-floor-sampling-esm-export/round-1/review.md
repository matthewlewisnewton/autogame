# Senior Review — Ticket 138: Fix floorSampling ESM export

**Baseline:** `3510d8e9b7a6e228b44fdcedbdaaa77a2f642b15`  
**Commits:** `7daf20c` (ESM re-export + client import), `97d41af` (vitest regression test)

## Runtime health (capture gate)

**FAIL — no valid harness capture.**

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | **`false`** — `"error": "servers did not start"` |
| `console.log` | **Missing** — no browser console capture |
| `pageerror` / `[fatal]` in capture | N/A (no session) |

The round-1 capture cannot prove a running game. Per harness rules, that alone forces **FAIL**, regardless of code review.

## Harness blockers

`metrics.json` includes a `harness_failure` block. Ports **5173** and **3000** were already held by foreign processes when the harness tried to start its own dev servers:

```json
"port_holders": {
  "5173": [{ "pid": 316852, "cmdline": "node .../vite.js --port 5173 --strictPort" }],
  "3000": [{ "pid": 316829, "cmdline": "node game/server/index.js" }]
}
```

`harness_failure.detected` is empty, but the tails show both stacks were already up:

```
client_log_tail: VITE v8.0.13 ready ... http://localhost:5173/
server_log_tail: Server listening on port 3000
```

**Operator action:** stop stale `vite` / `game/server/index.js` holders on 5173 and 3000, then re-run round-1 capture so `metrics.json` has `"ok": true`, screenshots, and `console.log`.

**Independent probe (reviewer, not harness):** With fresh servers on port 5178, Playwright loading `http://localhost:5178/` (Vite **dev**) still throws:

```
SyntaxError: The requested module '.../game/shared/floorSampling.js' does not provide an export named 'default'
```

That originates from `game/shared/floorSampling.esm.js` line `import mod from './floorSampling.js'`. Vite dev serves the CJS file through the client ESM graph without a synthetic `default` export. Production `vite build` + `vite preview` loads cleanly (no pageerrors in a follow-up probe), but **`pnpm dev` is explicitly required** by the ticket and remains broken.

---

## Acceptance criteria

### 1. Dual consumption — server CJS + client ESM named imports

| Side | Status | Notes |
|------|--------|-------|
| **Server** `require('../shared/floorSampling.js')` | **Pass** | `game/server/dungeon.js` unchanged. `pnpm --filter server test` — 812 tests pass, including `sampleFloorY` cases in `dungeon.test.js`. |
| **Client** `import { sampleFloorY, DEFAULT_FLOOR_Y }` via ESM path | **Partial / Fail** | Import path correctly points at `floorSampling.esm.js`, but the re-export’s **default import of the CJS module fails under Vite dev**. Vitest passes (different resolver), and `vite build` bundles successfully — dev and build are not equivalent here. |

The ticket’s original failure mode (`does not provide an export named 'DEFAULT_FLOOR_Y'`) is swapped for `does not provide an export named 'default'` — the client still does not boot in dev.

### 2. Playwright homepage — no export SyntaxError, auth overlay, playing phase

| Check | Status |
|-------|--------|
| No `Uncaught SyntaxError` / named-export errors | **Fail** (dev) — see probe above |
| Auth overlay visible | **Not verified** (harness capture + dev probe: blank body) |
| Register/login → `phase === 'playing'` | **Not verified** |

### 3. Vitest suites

| Suite | Status |
|-------|--------|
| `pnpm --filter client test` | **Pass** — 421 tests (includes new `shared-floor-sampling.test.js`, 4 cases) |
| `pnpm --filter server test` | **Pass** — 812 tests |

`round-1/coverage.log` shows client coverage run succeeded; thresholds disabled (visibility only).

### 4. `sampleFloorY` behaviour unchanged

**Pass.** CJS source `game/shared/floorSampling.js` is untouched. Server dungeon tests and the new client ESM test assert flat room, sloped bilinear centre (= 2.0), empty layout → `null`, and `DEFAULT_FLOOR_Y === 0.5`.

### 5. Technical approach (ticket spec option 3)

**Implemented as specified** — `floorSampling.esm.js` sibling + single import change in `collision.js`. Approach is sound in principle, but the chosen re-export syntax (`import mod from './floorSampling.js'`) is incompatible with Vite dev’s treatment of the CJS file.

### 6. Regression test file

**Pass.** `game/client/test/shared-floor-sampling.test.js` exists, imports from `floorSampling.esm.js`, covers all four cases from the ticket (flat centre uses `(0,0)` rather than subticket’s `(5,5)` — still inside the room; acceptable).

---

## Design & requirements consistency

- **`game/docs/design.md`:** Floor geometry section references `sampleFloorY()` for sloped floors — unchanged behaviour; no design conflict.
- **`game/docs/requirements.md`:** No direct reference to floor sampling; no regression spotted in foundation docs.

---

## Code quality

- **Scope:** Minimal diff (3 game files + ticket metadata). Server path untouched — good.
- **Dead code:** None introduced.
- **Debug scenarios:** None added or modified — N/A for debug-scenario checklist.
- **Tests vs runtime:** Client vitest gives false confidence for the Vite dev path; the ticket explicitly calls out that code-mode QA missed the original bug for the same reason.

---

## Would this pass if capture had worked?

**No.** Even with ports cleared, a standard `pnpm dev` Playwright session would likely still hit the `default` export `SyntaxError` unless the re-export interop is fixed. Re-capture after fixing `floorSampling.esm.js` (and confirming empty `pageerror` + auth overlay + playing phase).

---

## Remaining gaps

1. **Blocking — Vite dev still broken:** `floorSampling.esm.js` default-imports CJS; Vite dev rejects it. Client cannot load; ticket AC for `pnpm dev` and homepage Playwright are unmet.
2. **Blocking — No harness runtime proof:** Round-1 `metrics.json` `"ok": false`, no `console.log`; infra port leak prevented a clean capture pass/fail signal.

### Nits (non-blocking)

None filed to `nits.md` — no polish items worth a follow-up ticket beyond fixing the blocking interop.

---

VERDICT: FAIL
