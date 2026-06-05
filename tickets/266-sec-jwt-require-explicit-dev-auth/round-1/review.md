# Senior Review — 266-sec-jwt-require-explicit-dev-auth

**Baseline:** `834157828e5d26e75300f4c9dd164c1f75352ac3`  
**Commits:** `1af83e7d` (fail-closed gate), `e225df5d` (tests)  
**Changed game files:** `game/server/auth.js`, `game/server/test/auth.test.js`

## Runtime health (blocking)

`round-1/metrics.json` reports **`"ok": false`** with `"failure_kind": "capture_failed"`. There is no `pageerrors` array and no `harness_failure` block — Vite started on :5177, but the game server exited during `initAuth()`.

`round-1/server.log` and the capture diagnosis tail show:

```
Error: Missing JWT_SECRET environment variable. … or set ALLOW_DEV_AUTH=1 …
    at initAuth (game/server/auth.js:77:8)
```

`console.log` is absent (capture never reached the browser phase). Reproduced locally: `node game/server/index.js` without `JWT_SECRET` or `ALLOW_DEV_AUTH=1` crashes; with `ALLOW_DEV_AUTH=1` the server starts normally.

This is the intended fail-closed behavior from the ticket, but **no dev launch path was updated** to supply the new opt-in. The harness (`harness/steps/game.py` line 219) and `game/server/package.json` `"dev"` script both start the server with bare `process.env`, so capture and `pnpm run dev` are broken.

---

## Acceptance criteria

### Require explicit opt-in (`ALLOW_DEV_AUTH=1`) for the dev-secret fallback

**Met in `initAuth()`.** When `JWT_SECRET` is unset and `NODE_ENV` is neither `test` nor `production`, the code only uses `'dev-secret'` if `process.env.ALLOW_DEV_AUTH === '1'`, logging a clear warning. Any other value (unset, `0`, etc.) does not enable the fallback.

```67:82:game/server/auth.js
	// Dev mode — require explicit opt-in to use the insecure dev fallback
	if (process.env.ALLOW_DEV_AUTH === '1') {
		console.warn(
			'[auth] JWT_SECRET not set — using dev fallback secret (ALLOW_DEV_AUTH=1). ' +
			'Do not use this in production. Set JWT_SECRET to a cryptographically random value.'
		);
		JWT_SECRET = 'dev-secret';
		return JWT_SECRET;
	}

	throw new Error(
		'Missing JWT_SECRET environment variable. ' +
		'Set JWT_SECRET to a cryptographically random value, or set ALLOW_DEV_AUTH=1 to explicitly ' +
		'enable the insecure dev fallback secret. ' +
		'Example: JWT_SECRET=$(openssl rand -hex 32) node server/index.js'
	);
```

Priority order is correct: explicit `JWT_SECRET` → `NODE_ENV=test` test secret → production throw → dev opt-in → dev throw.

### Otherwise fail closed (throw) when `JWT_SECRET` is unset

**Met.** Non-test, non-production environments without `JWT_SECRET` and without `ALLOW_DEV_AUTH=1` throw with an actionable message. Production path unchanged (still throws). The staging/public bypass described in the ticket goal is closed.

### Test

**Met for unit coverage.** `round-1/coverage.log` shows 40/40 tests passing in the changed-file slice (3 files, including all 23 auth tests). The `initAuth() dev fallback` suite covers:

- throw in dev without `ALLOW_DEV_AUTH`
- success with `ALLOW_DEV_AUTH=1`
- production throw without secret
- `JWT_SECRET` precedence
- `NODE_ENV=test` path without opt-in

---

## Design & requirements consistency

- **`game/docs/design.md`:** No conflict. Auth hardening is orthogonal to gameplay systems.
- **`game/docs/requirements.md`:** **Regression.** Requirement #2 (server-client connectivity) is not exercisable when the server cannot start. Before this ticket, `pnpm run dev` and harness capture worked without `JWT_SECRET`; after it, they require wiring `ALLOW_DEV_AUTH=1` (or a real secret) into every non-test launch path. That wiring was not done.

---

## Code quality

- Implementation is minimal, readable, and matches existing `ALLOW_DEBUG_SCENARIOS` opt-in patterns elsewhere in the server.
- JSDoc updated accurately.
- No dead code, no client-side changes, no new debug scenarios.
- Error messages are specific and include remediation examples.
- Tests properly save/restore `ALLOW_DEV_AUTH` in `beforeEach`/`afterEach`.

---

## Debug scenarios

Not in scope — this ticket did not add or modify any `?debugScenario=` shortcuts.

---

## Harness note (not `harness_failure`)

Capture classified as `capture_failed`, not infra port-leak (`detected: []`). Vite bound successfully; the server process crashed due to game auth policy. Fixing capture requires adding `ALLOW_DEV_AUTH=1` to the harness server env **or** documenting that operators must set `JWT_SECRET` — the security gate itself is working as designed.

---

## Remaining gaps

1. **Game does not start in capture or default dev workflow** — `metrics.json` `ok: false`; server exits at `auth.js:77`. Harness `start_game`, `pnpm run dev` (`game/server/package.json`), and Playwright smoke scripts that spawn `node index.js` all omit `ALLOW_DEV_AUTH=1`.
2. **No runnable proof** — no screenshots, no browser console capture, no end-to-end verification that login/socket auth still works under the new policy in a live dev session.

### Nits (non-blocking)

- `CONTEXT.md` still documents `pnpm run dev` with no mention of `ALLOW_DEV_AUTH=1` or `JWT_SECRET` (see `nits.md`).

---

VERDICT: FAIL
