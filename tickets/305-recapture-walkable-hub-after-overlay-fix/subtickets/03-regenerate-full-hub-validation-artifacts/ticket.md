# Regenerate full hub validation artifacts (post-304 walkable capture)

Run the hub playthrough validation end-to-end on current main (includes **304**) and land fresh screenshots plus an honest `findings.md` under `game/validation/hub/`. This supersedes stale pre-304 captures where the 2D lobby menu obscured the walkable ship hub.

## Acceptance Criteria

- **Implementer final action (required for QA):** from repo root:
  `cd game && pnpm validate:hub && pnpm validate:hub:check`
- `game/validation/hub/run-summary.json` has `"preset": "hub"`, `"steps": "full"`, walkable presentation probes under `hubWalk.walkablePresentation`, and `"ok": true` only when all of these pass:
  - `assertions.boothDeductsGold`, `assertions.hatSwapFree`, `assertions.telepipeVitalsPreserved`
  - Walkable presentation gates from sub-tickets **01**–**02** (menu dismissed + canvas active on overview and all three zone captures; ≥2 players with remote squadmate on overview).
- Required PNGs exist after the run:
  - `01-hub-overview.png`, `02-room-operations.png`, `03-room-commerce.png`, `04-room-salon.png`
  - `05-booth-paid.png`, `06-hat-swap.png`
  - `07-telepipe-before.png`, `08-telepipe-after.png`
  - `09-lobby-finder.png`
- Also written: `game/validation/hub/findings.md` (includes **Walkable presentation** observations), `probes.json`, `console.log`, `server.log`.
- `pnpm validate:hub:check` exits `0`.
- If runtime asserts or walkable probes fail, `validate:hub` exits non-zero, screenshots are kept, and `findings.md` records the genuine failure — do not edit gameplay code to fake a pass.
- Depends on sub-tickets **01** and **02**.

## Technical Specs

- Runnable: `game/package.json` scripts `validate:hub` → `harness/validate/playthrough.mjs --preset hub --steps full --out game/validation/hub`; `validate:hub:check` → `harness/validate/verify-hub-artifacts.mjs`.
- Writable output only under `game/validation/hub/**` (PNG screenshots, `run-summary.json`, `findings.md`, `probes.json`, `console.log`, `server.log`).
- No `game/client/` or `game/server/` source edits in this sub-ticket — harness-only recapture after **304**.

## Verification: code
