# Senior Review — 266-sec-jwt-require-explicit-dev-auth

**Baseline:** `834157828e5d26e75300f4c9dd164c1f75352ac3`  
**Commits:** `1af83e7d` (fail-closed gate), `e225df5d` (tests), `04b3e10a` (dev script), `ca7c6049` (harness), `c6a8e844` (smoke tests)  
**Changed files:** `game/server/auth.js`, `game/server/test/auth.test.js`, `game/server/package.json`, `harness/steps/game.py`, five Playwright smoke scripts

## Runtime health (blocking)

`round-2/metrics.json` reports **`"ok": false`** with `"failure_kind": "capture_failed"`. There is no `pageerrors` array and no `harness_failure` block. Vite started on :5177; the game server exited during `initAuth()` before any browser capture (`console.log` is absent).

`round-2/server.log` tail:

```
Error: Missing JWT_SECRET environment variable. … or set ALLOW_DEV_AUTH=1 …
    at initAuth (game/server/auth.js:77:8)
```

**Independent verification (current working tree):** A fresh `capture_run()` with the present code succeeds (`metrics.json` `ok: true`, server log shows the expected `[auth] … ALLOW_DEV_AUTH=1` warning). `pnpm -C server run dev` also starts cleanly. The round-2 artifacts therefore do not reflect the wired-up tree — likely a stale capture from before the harness process reloaded `game.py`, or a capture that did not pick up commit `ca7c6049`. Regardless, the harness rule stands: **no captured proof of a running game → fail.**

---

## Acceptance criteria

### Require explicit opt-in (`ALLOW_DEV_AUTH=1`) for the dev-secret fallback

**Met.** `initAuth()` only uses `'dev-secret'` when `process.env.ALLOW_DEV_AUTH === '1'` (and `JWT_SECRET` is unset, `NODE_ENV` is neither `test` nor `production`). A clear `console.warn` precedes the fallback.

```67:75:game/server/auth.js
	// Dev mode — require explicit opt-in to use the insecure dev fallback
	if (process.env.ALLOW_DEV_AUTH === '1') {
		console.warn(
			'[auth] JWT_SECRET not set — using dev fallback secret (ALLOW_DEV_AUTH=1). ' +
			'Do not use this in production. Set JWT_SECRET to a cryptographically random value.'
		);
		JWT_SECRET = 'dev-secret';
		return JWT_SECRET;
	}
```

Priority order is correct: explicit `JWT_SECRET` → `NODE_ENV=test` test secret → production throw → dev opt-in → dev throw.

### Otherwise fail closed (throw) when `JWT_SECRET` is unset

**Met.** Non-test, non-production environments without `JWT_SECRET` and without `ALLOW_DEV_AUTH=1` throw with an actionable message. The staging/public bypass described in the ticket goal is closed. Production path unchanged.

### Test

**Met.** `round-2/coverage.log` shows 40/40 tests passing in the changed-file slice (3 files, all 23 auth tests). The `initAuth() dev fallback` suite covers throw-without-opt-in, success-with-opt-in, production throw, `JWT_SECRET` precedence, and the `NODE_ENV=test` path.

---

## Dev launch path wiring (round-1 gap)

Round-1 failed because no launch path supplied `ALLOW_DEV_AUTH=1`. Round-2 sub-tickets addressed this:

| Launch path | Status |
|---|---|
| `harness/steps/game.py` `start_game()` | `ALLOW_DEV_AUTH: "1"` in server `Popen` env |
| `game/server/package.json` `"dev"` script | `ALLOW_DEV_AUTH=1 nodemon index.js` |
| Five smoke scripts that spawn `node index.js` | `ALLOW_DEV_AUTH: '1'` added alongside `ALLOW_DEBUG_SCENARIOS` |

Other smoke scripts (`test-lobby-browser.mjs`, `test-lock-on.mjs`, etc.) assume an already-running dev server; they are satisfied when `pnpm run dev` is used (server dev script now opts in).

---

## Design & requirements consistency

- **`game/docs/design.md`:** No conflict. Auth hardening is orthogonal to gameplay.
- **`game/docs/requirements.md`:** Requirement #2 (server-client connectivity) is satisfied when launch paths include the opt-in — verified locally via `capture_run` and `pnpm -C server run dev`. The round-2 capture artifacts do not demonstrate this end-to-end.

---

## Code quality

- Implementation is minimal, readable, and mirrors the existing `ALLOW_DEBUG_SCENARIOS` opt-in pattern.
- JSDoc accurately documents the new gate.
- No client-side changes, no new debug scenarios, no dead code.
- Tests properly save/restore `ALLOW_DEV_AUTH` in `beforeEach`/`afterEach`.

---

## Debug scenarios

Not in scope — no `?debugScenario=` shortcuts were added or modified.

---

## Remaining gaps

1. **No runnable capture proof** — `round-2/metrics.json` `ok: false`; server crashed at `auth.js:77`; no screenshots or browser console log. Code and wiring appear correct in the working tree (fresh `capture_run` passes), but the ticket cannot pass without a successful captured run.

### Nits (non-blocking)

- `CONTEXT.md` still documents `pnpm run dev` without mentioning that the server dev script sets `ALLOW_DEV_AUTH=1` (see `nits.md`).
- `harness/tests/unit/test_game_start.py` asserts `PORT` in the server env but not `ALLOW_DEV_AUTH` — a regression test there would lock in commit `ca7c6049`.

---

VERDICT: FAIL
