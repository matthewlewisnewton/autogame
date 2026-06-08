# 06 — Execute sunken-canyon revalidation and land artifacts

Run the end-to-end sunken-canyon revalidation playthrough and commit the refreshed `game/validation/sunken-canyon/` tree. Document every bug, glitch, or oddity in `findings.md` with screenshot references — asserts pass **or** findings honestly document failure (do not fake green).

## Acceptance Criteria

- Implementer's **first action** is `cd game && pnpm validate:sunken-canyon`. No manual PNG/JSON authoring.
- The npm script produces every artifact under `game/validation/sunken-canyon/` via `harness/validate/playthrough.mjs --preset sunken-canyon --steps full`.
- After the run, `cd game && pnpm validate:sunken-canyon:check` exits `0`.
- Screenshots present at minimum: `01-hub.png`, `02-level-entry.png`, `03-mid-combat.png`, `04-boss-dormant.png`, `05-boss-active.png`, `06-boss-defeated.png`, `07-victory.png`, plus new-content shots `08`–`12` from sub-tickets **02–04**.
- `game/validation/sunken-canyon/run-summary.json` has `"steps": "full"`, `"preset": "sunken-canyon"`, all eleven assertion booleans (four legacy + seven new), and `"ok": true` only when every assertion is true.
- `game/validation/sunken-canyon/probes.json` includes floorAlignment, boss encounter UI/visual, card exercises, telepipe new-sortie, dormant/active, and victory probes.
- `game/validation/sunken-canyon/findings.md` lists **every** visual, functional, timing, or new-content interaction issue observed; references screenshot paths; documents assertion pass/fail per key. Genuine failures with screenshot evidence are valid — do not fake a pass.
- Full run exits `0` when all assertions pass; exits non-zero when any assertion fails with explained `findings.md`.
- `cd game && pnpm test:quick` still passes.
- **Writable output (only):** `game/validation/sunken-canyon/**` unless a blocking harness bug forces a minimal fix (document in `findings.md`).

## Technical Specs

- **Execute:** `cd game && pnpm validate:sunken-canyon` — `ALLOW_DEV_AUTH=1` + `ALLOW_DEBUG_SCENARIOS=1` via `harness/validate/lib/gameProcess.mjs`; defeats Canyon Warden (`miniboss`) on `canyon_descent` tier 2.
- **Verify:** `cd game && pnpm validate:sunken-canyon:check` → `harness/validate/verify-sunken-canyon-artifacts.mjs`.
- **Output:** `game/validation/sunken-canyon/` — screenshots, `run-summary.json`, `probes.json`, `findings.md`, `console.log`.
- **Depends on:** passed sub-ticket **05**.

## Verification: code
