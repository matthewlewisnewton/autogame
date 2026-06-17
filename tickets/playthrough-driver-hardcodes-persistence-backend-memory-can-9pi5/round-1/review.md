# Senior review — playthrough-driver-hardcodes-persistence-backend-memory-can-9pi5

## Runtime health

Captured run is clean:

- `metrics.json`: `"ok": true`, empty `pageerrors`, no `harness_failure`, no `failure_kind`.
- `console.log`: only benign Vite connect logs, scene init, and booth ready-up — no `pageerror` or `[fatal]` lines.
- Screenshots and probes show a full auth → lobby → deploy → gameplay flow (Initiate Vault, movement, dodge cooldown HUD).

The game starts and loads correctly for this ticket round.

**Note on `server.log`:** the capture harness (`harness/steps/game.py`) started the server on port 3005 with `FileProvider` — it does not go through `gameProcess.mjs` and never hardcoded `PERSISTENCE_BACKEND=memory`. That is the pre-existing screenshot-capture path, not a regression from this ticket. The playthrough driver path is what changed.

## Acceptance criteria

### When `PERSISTENCE_BACKEND` / `DATABASE_URL` / `REDIS_URL` are exported, the playthrough-started server uses them

**Met (harness layer).** The hard-coded override is removed. `buildServerEnv()` spreads `...process.env` and sets `PERSISTENCE_BACKEND: process.env.PERSISTENCE_BACKEND ?? 'memory'`, so caller-exported values reach the server child:

```82:89:harness/validate/lib/gameProcess.mjs
export function buildServerEnv(serverPort) {
	return {
		...process.env,
		PORT: String(serverPort),
		ALLOW_DEBUG_SCENARIOS: '1',
		ALLOW_DEV_AUTH: '1',
		PERSISTENCE_BACKEND: process.env.PERSISTENCE_BACKEND ?? 'memory',
	};
}
```

`startGame()` wires this in:

```139:143:harness/validate/lib/gameProcess.mjs
	const serverChild = launch(process.execPath, ['index.js'], {
		cwd: SERVER_DIR,
		tag: 'server',
		env: buildServerEnv(resolvedServerPort),
	});
```

Unit tests in `harness/validate/lib/gameProcess.test.mjs` confirm:

- `PERSISTENCE_BACKEND=postgres` passes through (not forced to `memory`).
- `DATABASE_URL` and `REDIS_URL` pass through via the env spread.
- `PORT`, `ALLOW_DEBUG_SCENARIOS`, and `ALLOW_DEV_AUTH` remain explicitly set.

Downstream, `game/server/index.js` already selects `PostgresProvider` when `PERSISTENCE_BACKEND === 'postgres'` and `DATABASE_URL` is set, and reads `REDIS_URL` for the Redis client — so env passthrough is sufficient for real-infra playthrough validation.

This round's browser capture did not exercise the Postgres/Redis path (no infra env exported), which is expected for the default smoke preset. Passthrough is verified by the dedicated harness unit tests (7/7 passing).

### When unset, defaults to in-memory provider exactly as today; existing playthrough presets unaffected

**Met.** Before this ticket, `gameProcess.mjs` always forced `PERSISTENCE_BACKEND: 'memory'`. Now, when the parent env omits `PERSISTENCE_BACKEND`, `buildServerEnv` still supplies `'memory'`, preserving the fast/isolated default for presets that do not set the variable. The default smoke capture and full game client flow are unaffected.

### Verification: harness checks (vitest server+client)

**Met for harness scope.** A new `harness` vitest project in `game/vitest.config.js` runs `harness/validate/lib/**/*.test.{js,mjs}`. All seven `buildServerEnv` tests pass. Coverage instrumentation reports 0% on harness files (expected — tests import only the pure helper), but test execution is green.

## Design & foundation consistency

- **Scope:** harness-only (`gameProcess.mjs`, tests, vitest config). No `game/` gameplay, persistence, or client changes.
- **`game/docs/design.md`:** unaffected; no new mechanics or debug scenarios.
- **Foundation:** no regression to server persistence selection logic; the fix unblocks callers who export real-infra env vars into the playthrough driver.

## Code quality

- Clean extraction of `buildServerEnv()` for testability without mocking `child_process`.
- Env construction is minimal and matches the sub-ticket spec (spread parent env, explicit harness overrides, conditional `PERSISTENCE_BACKEND` default).
- No dead code, no debug-scenario changes, no console/page errors in capture.

## Debug scenarios

Not applicable — this ticket did not add or modify any `?debugScenario=` shortcuts.

## Remaining gaps

None. The playthrough driver's persistence-backend override is removed, env passthrough is unit-tested, backward-compatible defaults are preserved, and the captured game run is healthy.

VERDICT: PASS
