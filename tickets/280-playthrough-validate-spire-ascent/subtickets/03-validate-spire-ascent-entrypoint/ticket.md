# validate:spire-ascent npm entrypoint and artifact checker

Wire `pnpm validate:spire-ascent` to run the playthrough driver with the `spire-ascent` preset and add a verifier script so QA can confirm artifacts came from a `--steps full` run under `game/validation/spire-ascent/`.

## Acceptance Criteria

- `game/package.json` adds:
  - `validate:spire-ascent` → `node ../harness/validate/playthrough.mjs --preset spire-ascent --steps full --out game/validation/spire-ascent`
  - `validate:spire-ascent:check` → `node ../harness/validate/verify-spire-ascent-artifacts.mjs`
- New `harness/validate/verify-spire-ascent-artifacts.mjs` exits `0` only when all hold under `game/validation/spire-ascent/`:
  - `run-summary.json` with `"steps": "full"`, `"preset": "spire-ascent"`, `assertions` keys `bossSpawned`, `encounterActivated`, `bossDefeated`, `victoryFired`, and a `victory` object.
  - PNGs: `01-hub.png`, `02-level-entry.png`, `03-mid-combat.png`, `04-boss-dormant.png`, `05-boss-active.png`, `06-boss-defeated.png`, `07-victory.png`.
  - Non-empty `findings.md`, plus `probes.json` and `console.log`.
- Verifier exits non-zero with stderr listing each missing/invalid artifact (expected to fail until sub-ticket 04 executes the full run).
- `cd game && pnpm test:quick` still passes.
- Do **not** run `pnpm validate:spire-ascent` or hand-author artifacts in this sub-ticket.

## Technical Specs

- **`game/package.json`**: add the two npm scripts above (follow `validate:rooms` / `validate:rooms:check` pattern).
- **`harness/validate/verify-spire-ascent-artifacts.mjs`** (new): clone `verify-rooms-artifacts.mjs` with `SPIRE_DIR = game/validation/spire-ascent`; require all seven stage screenshots listed above; assert `run-summary.json` `preset === 'spire-ascent'`.
- No `game/server/` or `game/client/` changes.
- Depends on passed sub-tickets **01** and **02**.

## Verification: code
