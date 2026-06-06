# Fix validate:rooms full-run entrypoint and artifact checker

Round-3 remediation for failed sub-ticket 07. The playthrough driver and victory hooks from sub-tickets 01–06 are complete, but `pnpm validate:rooms` still does not invoke `--steps full` (it omits `--steps`, so the driver defaults to `auth` only). This sub-ticket wires the npm script to the full pipeline and adds a small verifier QA can run to prove artifacts came from a `--steps full` run—not a partial `boss-encounter` capture.

## Acceptance Criteria

- `game/package.json` script `validate:rooms` is exactly: `node ../harness/validate/playthrough.mjs --preset rooms --steps full` (both flags required).
- New `harness/validate/verify-rooms-artifacts.mjs` exits `0` only when all of the following hold under repo-root `validation/rooms/`:
  - `run-summary.json` exists with `"steps": "full"` (reject `"boss-encounter"` or any other value).
  - `run-summary.json` contains an `assertions` object with keys `bossSpawned`, `encounterActivated`, `bossDefeated`, `victoryFired`.
  - `run-summary.json` contains a `victory` section (object, may be empty on a failed run).
  - PNG files exist: `06-boss-defeated.png`, `07-victory.png`.
  - `findings.md` exists (non-empty).
  - `probes.json` and `console.log` exist.
- Verifier exits non-zero with a clear stderr message listing each missing or invalid artifact (so a partial boss-encounter tree fails fast).
- `game/package.json` adds `validate:rooms:check` → `node ../harness/validate/verify-rooms-artifacts.mjs`.
- No changes under `game/server/` or `game/client/` in this sub-ticket.
- `cd game && pnpm test:quick` still passes.

## Technical Specs

- `game/package.json`: update `validate:rooms`; add `validate:rooms:check` script.
- `harness/validate/verify-rooms-artifacts.mjs` (new): read `validation/rooms/run-summary.json`, validate fields above, `fs.existsSync` for required PNGs and markdown; `process.exit(1)` on failure.
- Do **not** run `pnpm validate:rooms` in this sub-ticket—the verifier is expected to fail until sub-ticket 09 lands artifacts.
- Depends on passed sub-tickets **01–03** and **06**. Harness victory code in `playthrough.mjs` / `combat.mjs` from the failed 07 iteration may already be in the working tree; do not strip it—only add the entrypoint fix and verifier.

## Verification: code
