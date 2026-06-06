# Sunken-canyon artifact verification and floor-alignment probes

Generalize validation artifact checks and findings for the sunken-canyon preset, and record floor-alignment probes (player Y vs `sampleFloorY` at key steps) so multi-level canyon geometry issues surface in `probes.json` and `findings.md` without relying on screenshot pixel QA.

## Acceptance Criteria

- `harness/validate/verify-sunken-canyon-artifacts.mjs` validates `game/validation/sunken-canyon/` the same way `verify-rooms-artifacts.mjs` validates rooms: `run-summary.json` with `steps: "full"`, four assertion booleans, `victory` section, PNGs `06-boss-defeated.png` / `07-victory.png`, non-empty `findings.md`, `probes.json`, `console.log`.
- `game/package.json` adds `"validate:sunken-canyon:check": "node ../harness/validate/verify-sunken-canyon-artifacts.mjs"`; the check fails fast with clear stderr when artifacts are missing.
- `harness/validate/lib/findings.mjs` is preset-aware (title/assertion labels reference sunken-canyon / `miniboss` / Canyon Warden copy, not hard-coded Rooms/annex_overseer only).
- `harness/validate/playthrough.mjs` records `floorAlignment` probes at level entry, mid-combat, boss-dormant, and boss-active steps: `{ playerY, floorY, delta, layoutProfile, band }` derived from harness state (client `sampleFloorY` via existing harness bridge or `page.evaluate` import of `/shared/floorSampling.esm.js`); values land in `probes.json` on `--steps full`.
- `findings.md` template includes a **Floor alignment** section that lists each probe step and flags `|delta| > 0.5` as a note (even on otherwise green runs).
- `cd game && pnpm validate:sunken-canyon:check` fails before sub-ticket 04 runs; `cd game && pnpm test:quick` still passes.
- Do **not** run `pnpm validate:sunken-canyon` or populate real screenshots in this sub-ticket.

## Technical Specs

- **New:** `harness/validate/verify-sunken-canyon-artifacts.mjs` — clone `verify-rooms-artifacts.mjs` with `SUNKEN_CANYON_DIR = game/validation/sunken-canyon`.
- **Edit:** `harness/validate/lib/findings.mjs` — accept preset label / boss display name; emit floor-alignment section from probe data passed in `renderFindings`.
- **Edit:** `harness/validate/playthrough.mjs` — add `captureFloorAlignmentProbe(page)` helper; call from hub entry, `onMidCombat`, dormant, and active boss steps; merge into `writeFullArtifacts` probes object.
- **Edit:** `game/package.json` — add `validate:sunken-canyon:check`.
- **Scope:** `harness/validate/**` and `game/package.json` only. Depends on passed sub-tickets **01** and **02**.

## Verification: code
