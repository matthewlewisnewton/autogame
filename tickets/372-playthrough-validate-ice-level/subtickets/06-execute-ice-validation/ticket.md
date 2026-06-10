# Execute ice-level full validation and land artifacts

Run the end-to-end ice playthrough (auth → hub/deploy → slippery floor → mid-combat → glacial slow → card mechanics → defeat-enemies victory → telepipe-reset) and commit the resulting `game/validation/ice/` tree. Document every bug, glitch, and oddity in `findings.md` — never fake a green run.

## Acceptance Criteria

- Implementer's **first action** is `cd game && pnpm validate:ice`. No `harness/` edits before or instead of this command unless `pnpm install` is required.
- The npm script (not manual copies) produces every artifact under `game/validation/ice/`; do not hand-author PNGs or JSON.
- After the run, `cd game && pnpm validate:ice:check` exits `0`.
- Screenshots present for hub entry, level entry, slippery floor, mid-combat, glacial slow, card burn probe, objective complete, victory, and telepipe before/after (`01-hub.png` … `10-telepipe-after.png` per preset/driver from sub-tickets 01–05).
- `game/validation/ice/run-summary.json` has `"steps": "full"`, `"preset": "ice"`, defeat-enemies `assertions` with expected booleans; `"ok": true` only when all pass.
- `game/validation/ice/probes.json` includes slippery-floor probes (acceleration, drift, direction change, surface transition), glacial-slow probes (`slowedUntil`, HP delta), card-mechanics probes, floor-alignment steps on ice-cavern bands, telepipe pre/post deploy probes, and victory entries.
- `game/validation/ice/findings.md` documents each assertion, console/page errors, slippery-floor behavior, glacial-thrower slow-on-hit, card slow/burn/cleanse/windup results, telepipe vitals/charge reset, floor-alignment deltas, and a **Stage boss gap** entry noting no stage boss on Frost Crossing tier 1 (tickets 283/284 N/A; Rimecast named rare is the signature foe). A documented genuine failure with screenshot evidence is valid — do not fake a pass.
- Full run exits `0` when all assertions pass; exits non-zero when any assertion fails, with `findings.md` explaining the real failure.
- `cd game && pnpm test:quick` still passes (re-run only if deps were installed).
- **Forbidden:** edits outside `game/validation/ice/` unless a blocking harness bug forces a minimal fix (then document in `findings.md`).

## Technical Specs

- **Execute:** `cd game && pnpm validate:ice` — uses `ALLOW_DEV_AUTH=1` + `ALLOW_DEBUG_SCENARIOS=1` via `harness/validate/lib/gameProcess.mjs`; preset `ice` deploys `frost-crossing-tier-1` / `ice-cavern`, exercises slippery-floor physics, Glacial Thrower slow, card mechanics, completes `defeat_enemies` objective, runs telepipe-reset slice.
- **Writable output (only):** `game/validation/ice/**` — screenshots, `run-summary.json`, `probes.json`, `findings.md`, `console.log`, `server.log`.
- Depends on passed sub-tickets **01**, **02**, **03**, **04**, and **05**.

## Verification: code
