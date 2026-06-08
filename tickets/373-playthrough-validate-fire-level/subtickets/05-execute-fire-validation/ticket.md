# Execute fire-level full validation and land artifacts

Run the end-to-end fire playthrough (auth → hub/deploy → ember burn → card mechanics → defeat-enemies victory → telepipe-reset) and commit the resulting `game/validation/fire/` tree. Document every bug, glitch, and oddity in `findings.md` — never fake a green run.

## Acceptance Criteria

- Implementer's **first action** is `cd game && pnpm validate:fire`. No `harness/` edits before or instead of this command unless `pnpm install` is required.
- The npm script (not manual copies) produces every artifact under `game/validation/fire/`; do not hand-author PNGs or JSON.
- After the run, `cd game && pnpm validate:fire:check` exits `0`.
- Screenshots present for hub entry, level entry, mid-combat, ember burn, card probes, objective complete, victory, and telepipe before/after (exact filenames per preset/driver from sub-tickets 01–04).
- `game/validation/fire/run-summary.json` has `"steps": "full"`, `"preset": "fire"`, defeat-enemies `assertions` with expected booleans; `"ok": true` only when all pass.
- `game/validation/fire/probes.json` includes ember-burn probes (`burningUntil`, HP delta across burn ticks), card-mechanics probes, floor-alignment steps, telepipe pre/post deploy probes, and victory entries.
- `game/validation/fire/findings.md` documents each assertion, console/page errors, ember-wraith burn behavior, card slow/burn/cleanse/windup results, telepipe vitals/charge reset, floor-alignment deltas, and a **Stage boss gap** entry noting no stage boss on Ember Descent tier 1 (tickets 283/284 N/A). A documented genuine failure with screenshot evidence is valid — do not fake a pass.
- Full run exits `0` when all assertions pass; exits non-zero when any assertion fails, with `findings.md` explaining the real failure.
- `cd game && pnpm test:quick` still passes (re-run only if deps were installed).
- **Forbidden:** edits outside `game/validation/fire/` unless a blocking harness bug forces a minimal fix (then document in `findings.md`).

## Technical Specs

- **Execute:** `cd game && pnpm validate:fire` — uses `ALLOW_DEV_AUTH=1` + `ALLOW_DEBUG_SCENARIOS=1` via `harness/validate/lib/gameProcess.mjs`; preset `fire` deploys `fire-cavern`, exercises Ember Wraith burn, card mechanics, completes `defeat_enemies` objective, runs telepipe-reset slice.
- **Writable output (only):** `game/validation/fire/**` — screenshots, `run-summary.json`, `probes.json`, `findings.md`, `console.log`, `server.log`.
- Depends on passed sub-tickets **01**, **02**, **03**, and **04**.

## Verification: code
