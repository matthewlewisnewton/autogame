# Vitest wrapper exits 0 after full and quick runs

`pnpm test` and `pnpm test:quick` currently print a passing summary but the harness observes exit code **137** (SIGKILL). Fix the vitest launcher and/or suite resource limits so both commands return exit code **0** when all tests pass, without regressing sub-ticket 05’s loot_magnet stability.

## Acceptance Criteria

- `cd game && pnpm test:quick` exits **0** (all projects green; no exit 137 after the summary).
- `cd game && pnpm test` exits **0** with coverage enabled (full server + client suite).
- Three consecutive runs of each command above exit **0** (guards against intermittent SIGKILL/OOM).
- `node scripts/run-vitest.mjs` does not propagate a child `signal` to `process.kill(process.pid, signal)` in a way that kills the wrapper after a normal code-0 exit; worker cleanup via `scripts/kill-vitest.sh` must not terminate the parent launcher process.
- No gameplay or card-balance data changes.

## Technical Specs

- **`game/scripts/run-vitest.mjs`**
  - Review `child.on('exit', …)`: when the vitest child is killed with a signal (e.g. SIGKILL from OOM or harness timeout), the parent currently calls `process.kill(process.pid, signal)` — confirm this is not firing after successful runs and adjust so a code-0 child exit always ends with `process.exit(0)` after `cleanupOnce()`.
  - Ensure `cleanupOnce()` / `kill-vitest.sh` only targets orphaned vitest **worker** processes under `game/`, not the `run-vitest.mjs` parent (audit `pgrep -f vitest` matching).
- **`game/scripts/kill-vitest.sh`**
  - Tighten process selection if the parent or unrelated node processes are matched; keep cwd guard on `GAME_DIR`.
- **`game/vitest.config.js`**
  - If exit 137 is memory pressure from coverage + `maxWorkers: 4` parallel server files, lower `maxWorkers` (or disable `fileParallelism`) for the server project when coverage is on, or split coverage thresholds so the suite stays within harness memory limits.
- **Verification commands** (from `game/`): `pnpm test:quick`, then `pnpm test`. Depends on sub-ticket **05** being done first if loot_magnet still fails the full suite.

## Verification: code
