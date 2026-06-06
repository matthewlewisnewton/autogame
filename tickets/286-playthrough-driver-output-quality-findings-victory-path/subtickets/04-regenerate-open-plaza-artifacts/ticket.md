# Regenerate Open Plaza validation artifacts under game/validation/

Run the corrected playthrough driver for the open-plaza preset and commit a complete artifact tree at `game/validation/open-plaza/`. Remove the stale repo-root `validation/open-plaza/` copy so all three validation levels share one layout.

## Acceptance Criteria

- `cd game && pnpm validate:open-plaza` (with the driver's built-in game boot using `ALLOW_DEV_AUTH=1` and `ALLOW_DEBUG_SCENARIOS=1`) produces every artifact under `game/validation/open-plaza/` — not repo-root `validation/open-plaza/`.
- Screenshot set from this run: `01-lobby-browser.png` (or hub), `01-hub.png`, `02-level-entry.png`, `03-mid-combat.png`, `04-boss-dormant.png`, `05-boss-active.png`, `06-boss-defeated.png`, `07-victory.png`.
- `game/validation/open-plaza/run-summary.json` has `"steps": "full"`, `"preset": "open-plaza"`, `presetConfig.bossType: "arena_champion"`, four assertion booleans, and `"ok": true` only when all assertions pass.
- `game/validation/open-plaza/findings.md` header and `bossSpawned (...)` line reference Open Plaza / `arena_champion` (not Rooms / `annex_overseer`).
- `06-boss-defeated.png` and `07-victory.png` are **not** byte-identical; `07-victory.png` corresponds to the Sortie Complete overlay state.
- `cd game && pnpm validate:open-plaza:check` exits `0` on the committed artifacts.
- Repo-root `validation/open-plaza/` is removed (delete the stale tree; do not leave duplicate artifacts at both paths).
- Either all four assertions pass with honest `findings.md` notes, **or** `findings.md` documents the real failure with screenshot evidence — do not fake a pass or hand-edit PNGs/JSON.

## Technical Specs

- **Execute:** `cd game && pnpm validate:open-plaza` — full auth → hub/deploy → boss-encounter → victory pipeline via sub-tickets **01–03** fixes.
- **Writable output (only):** `game/validation/open-plaza/**` — screenshots, `run-summary.json`, `probes.json`, `findings.md`, `console.log`.
- **Delete:** `validation/open-plaza/` at repo root (entire directory).
- **Forbidden:** edits outside `game/validation/open-plaza/**` and the repo-root cleanup unless a blocking harness bug forces a minimal fix in `harness/validate/**` (then document in `findings.md`).
- Depends on passed sub-tickets **01**, **02**, and **03**.

## Verification: code
