# Execute sunken-canyon full validation and land artifacts

Run the end-to-end sunken-canyon playthrough (auth → hub/deploy → god-mode boss encounter → victory) and commit the resulting `game/validation/sunken-canyon/` tree. Document pass/fail, floor-alignment surprises, and any genuine bugs in `findings.md` — never fake a green run.

## Acceptance Criteria

- Implementer's **first action** is `cd game && pnpm validate:sunken-canyon`. No `harness/` edits before or instead of this command unless `pnpm install` is required.
- The npm script (not manual copies) produces every artifact under `game/validation/sunken-canyon/`; do not hand-author PNGs or JSON.
- After the run, `cd game && pnpm validate:sunken-canyon:check` exits `0`.
- Screenshots present: `01-hub.png`, `02-level-entry.png`, `03-mid-combat.png`, `04-boss-dormant.png`, `05-boss-active.png`, `06-boss-defeated.png`, `07-victory.png` (auth may also write `01-lobby-browser.png`).
- `game/validation/sunken-canyon/run-summary.json` has `"steps": "full"`, `"preset": "sunken-canyon"`, `victory` section, `assertions` with `bossSpawned`, `encounterActivated`, `bossDefeated`, `victoryFired`; `"ok": true` only when all four are `true`.
- `game/validation/sunken-canyon/probes.json` includes dormant/active encounter probes, victory `afterBoss`/`victory` entries, and `floorAlignment` step probes from sub-ticket 03.
- `game/validation/sunken-canyon/findings.md` documents each assertion, console/page errors, floor-alignment deltas, and visual/gameplay surprises with screenshot filename references. A documented genuine failure with screenshot evidence is valid — do not fake a pass.
- Full run exits `0` when all assertions pass; exits non-zero when any assertion fails, with `findings.md` explaining the real failure.
- `cd game && pnpm test:quick` still passes (re-run only if deps were installed).
- **Forbidden:** edits outside `game/validation/sunken-canyon/` unless a blocking harness bug forces a minimal fix (then document in `findings.md`).

## Technical Specs

- **Execute:** `cd game && pnpm validate:sunken-canyon` — uses `ALLOW_DEV_AUTH=1` + `ALLOW_DEBUG_SCENARIOS=1` via `harness/validate/lib/gameProcess.mjs`; preset `sunken-canyon` deploys `canyon-descent-tier-2`, defeats Canyon Warden (`miniboss`), asserts victory.
- **Writable output (only):** `game/validation/sunken-canyon/**` — screenshots, `run-summary.json`, `probes.json`, `findings.md`, `console.log`.
- Depends on passed sub-tickets **01**, **02**, and **03**.

## Verification: code
