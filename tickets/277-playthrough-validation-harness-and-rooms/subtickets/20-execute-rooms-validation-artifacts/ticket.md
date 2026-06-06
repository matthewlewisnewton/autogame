# Execute rooms full validation and land artifacts

Round-8 remediation for failed sub-ticket 18. Sub-ticket **19** moved playthrough output to `game/validation/rooms/` so artifact writes survive `scope_audit` in the long-running harness process. This sub-ticket's **only** deliverable is running `pnpm validate:rooms` and leaving a complete `game/validation/rooms/` tree in the working tree. Do not edit `harness/` — document genuine runtime failures in `game/validation/rooms/findings.md`.

## Acceptance Criteria

- Implementer's **first action** is `cd game && pnpm validate:rooms`. No `harness/` edits before or instead of this command unless `pnpm install` is required for dependencies.
- The npm script (not manual copies) produces every artifact under `game/validation/rooms/`; do not hand-author PNGs or JSON.
- Sub-ticket log shows **no** `scope_audit` reverts under `game/validation/rooms/` on the passing iteration.
- After the run, `cd game && pnpm validate:rooms:check` exits `0`.
- Screenshots under `game/validation/rooms/`: `01-hub.png`, `02-level-entry.png`, `03-mid-combat.png`, `04-boss-dormant.png`, `05-boss-active.png`, `06-boss-defeated.png`, `07-victory.png`.
- `game/validation/rooms/findings.md` documents pass/fail for each assertion (`bossSpawned`, `encounterActivated`, `bossDefeated`, `victoryFired`), console/page errors, and any visual or gameplay surprises with screenshot filename references. A documented genuine bug with screenshot evidence is valid — do not fake a pass.
- `game/validation/rooms/run-summary.json` has `"steps": "full"`, a `victory` section, `assertions` booleans, and `"ok": true` when all four assertion booleans are `true`; on failure, `"ok": false` with `error` set and `findings.md` still present.
- `game/validation/rooms/probes.json` includes `afterBoss` and `victory` probe entries from `runVictoryStep`.
- Full run exits `0` when all assertions pass; exits non-zero when any assertion fails, with `findings.md` explaining the real failure.
- `cd game && pnpm test:quick` still passes (no gameplay edits expected; re-run only if you had to install deps).

## Technical Specs

- **Execute:** `cd game && pnpm validate:rooms` — orchestrates auth → hub/deploy → boss-encounter → `runVictoryStep` → artifact writes under `game/validation/rooms/`.
- **Writable output (only):** `game/validation/rooms/**` — screenshots, `run-summary.json`, `probes.json`, `findings.md`, `console.log`. Artifacts land here via the npm script; no edits elsewhere under `game/`.
- **Forbidden:** `harness/**` and any path outside `game/validation/rooms/`.
- Depends on passed sub-tickets **01–11**, **13**, **08**, **10**, **15**, **17**, and **19**.

## Verification: code
