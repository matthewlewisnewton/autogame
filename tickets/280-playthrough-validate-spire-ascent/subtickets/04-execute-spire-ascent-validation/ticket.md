# Execute Spire Ascent full validation and land artifacts

Run the end-to-end Spire Ascent Tier II playthrough validation (Summit Warden / `spire_warden`) and commit the resulting artifact tree under `game/validation/spire-ascent/`. Document genuine failures in `findings.md` — do not fake a pass.

## Acceptance Criteria

- Implementer's **first action** is `cd game && pnpm validate:spire-ascent`. No `harness/` edits before or instead of this command unless `pnpm install` is required.
- The npm script (not manual copies) produces every artifact under `game/validation/spire-ascent/`.
- After the run, `cd game && pnpm validate:spire-ascent:check` exits `0`.
- Screenshots present: `01-hub.png`, `02-level-entry.png`, `03-mid-combat.png`, `04-boss-dormant.png`, `05-boss-active.png`, `06-boss-defeated.png`, `07-victory.png`.
- `game/validation/spire-ascent/findings.md` documents pass/fail for each assertion (`bossSpawned`, `encounterActivated`, `bossDefeated`, `victoryFired`), console/page errors, and any broken/ugly/surprising gameplay or visuals with screenshot filename references. A documented genuine bug with screenshot evidence is valid — do not fake a pass.
- `game/validation/spire-ascent/run-summary.json` has `"steps": "full"`, `"preset": "spire-ascent"`, `bossType` / `deployScenario` reflecting `spire_warden` and `spire-ascent-tier-2`, a `victory` section, `assertions` booleans, and `"ok": true` when all four assertion booleans are `true`; on failure, `"ok": false` with `error` set and `findings.md` still present.
- `game/validation/spire-ascent/probes.json` includes dormant/active encounter probes and `afterBoss` / `victory` entries from `runVictoryStep`.
- Full run exits `0` when all assertions pass; exits non-zero when any assertion fails, with `findings.md` explaining the real failure.
- `cd game && pnpm test:quick` still passes (re-run only if deps were installed).

## Technical Specs

- **Execute:** `cd game && pnpm validate:spire-ascent` — orchestrates auth → hub/deploy (`spire-ascent-tier-2`) → god-mode add clear → dormant/active boss encounter → `defeatBoss` / victory polling.
- **Writable output (only):** `game/validation/spire-ascent/**` — screenshots, `run-summary.json`, `probes.json`, `findings.md`, `console.log`. No edits elsewhere under `game/` unless a minimal gated debug hook is unavoidable; document any such change in `findings.md`.
- **Forbidden:** `harness/**` and any path outside `game/validation/spire-ascent/` (except unavoidable minimal `game/server/debugScenarios.js` fixes — prefer filing the issue in findings and fixing in sub-ticket 02).
- Depends on passed sub-tickets **01**, **02**, and **03**.

## Verification: code
