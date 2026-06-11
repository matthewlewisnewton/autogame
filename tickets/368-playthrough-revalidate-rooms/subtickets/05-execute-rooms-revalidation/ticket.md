# 05 — Execute rooms revalidation and land artifacts

Run the end-to-end rooms revalidation playthrough and refresh the `game/validation/rooms/` tree. Document every bug, glitch, or oddity in `findings.md` with screenshot references — asserts pass **or** findings honestly document failure (do not fake green).

## Acceptance Criteria

- Implementer's **first action** is `cd game && pnpm validate:rooms`. No manual PNG/JSON authoring.
- The npm script produces every artifact under `game/validation/rooms/` via `harness/validate/playthrough.mjs --preset rooms --steps full`.
- After the run, `cd game && pnpm validate:rooms:check` exits `0`.
- Screenshots present at minimum: `01-lobby-browser.png`, `01-hub.png`, `02-level-entry.png`, `03-mid-combat.png`, `04-boss-dormant.png`, `05-boss-active.png`, `06-boss-defeated.png`, `07-victory.png`, plus new-content shots `08`–`12` from sub-tickets **02–03**.
- `game/validation/rooms/run-summary.json` has `"steps": "full"`, `"preset": "rooms"`, all eleven assertion booleans (four legacy + seven new), and `"ok": true` only when every assertion is true.
- `game/validation/rooms/probes.json` includes boss encounter UI/visual, card exercises, telepipe new-sortie, dormant/active, and victory probes.
- `game/validation/rooms/findings.md` lists **every** visual, functional, timing, or new-content interaction issue observed; references screenshot paths; documents assertion pass/fail per key. Genuine failures with screenshot evidence are valid — do not fake a pass.
- Full run exits `0` when all assertions pass; exits non-zero when any assertion fails with explained `findings.md`.
- `cd game && pnpm test:quick` still passes.
- **Writable output (only):** `game/validation/rooms/**` unless a blocking harness bug forces a minimal fix in `harness/validate/**` (document in `findings.md`).

## Technical Specs

- **Execute:** `cd game && pnpm validate:rooms` — `ALLOW_DEV_AUTH=1` + `ALLOW_DEBUG_SCENARIOS=1` via `harness/validate/lib/gameProcess.mjs`; defeats Annex Overseer (`annex_overseer`) on `training_caverns` tier 2.
- **Verify:** `cd game && pnpm validate:rooms:check` → `harness/validate/verify-rooms-artifacts.mjs`.
- **Output:** `game/validation/rooms/` — screenshots, `run-summary.json`, `probes.json`, `findings.md`, `console.log`.
- **Depends on:** passed sub-ticket **04**.

## Verification: code
