# Parameterize validation findings from preset metadata

The shared `renderFindings` path must derive the report title and boss-spawn assertion label from each playthrough preset, not from a stale Rooms-only copy. Add the missing Open Plaza metadata and remove duplicate hard-coded preset copy so every level's `findings.md` names the correct boss.

## Acceptance Criteria

- `harness/validate/presets/open-plaza.mjs` exports `findingsTitle` (e.g. `Open Plaza validation findings`) and `bossSpawnLabel` (e.g. `arena_champion (Arena Champion)` or equivalent display string matching the preset's `bossType`).
- `harness/validate/lib/findings.mjs` uses `run.findingsTitle` / `run.bossSpawnLabel` passed from the loaded preset as the primary source; any `PRESET_FINDINGS` map is removed or reduced to a non-drifting fallback (preset name + `bossType` only when fields are absent).
- Rendering `findings.md` for preset `open-plaza` produces a `# Open Plaza validation findings` (or the preset's `findingsTitle`) header and a `bossSpawned (arena_champion …)` assertion line — not Rooms / `annex_overseer`.
- Existing presets `rooms` and `sunken-canyon` still render their current titles and boss labels unchanged.
- `cd game && pnpm test:quick` still passes.

## Technical Specs

- **Edit:** `harness/validate/presets/open-plaza.mjs` — add `findingsTitle` and `bossSpawnLabel` exports alongside existing quest/boss fields.
- **Edit:** `harness/validate/lib/findings.mjs` — resolve title/label from `run.findingsTitle` / `run.bossSpawnLabel` first; delete or slim the `PRESET_FINDINGS` duplicate table so open-plaza cannot fall back to rooms copy.
- **Verify wiring:** `harness/validate/playthrough.mjs` `writeFullArtifacts` already passes `preset?.findingsTitle` and `preset?.bossSpawnLabel` into `renderFindings`; no behavioral change needed there unless fields are renamed.
- **Optional:** add a small harness unit test (or inline test in an existing harness test file) that calls `renderFindings({ preset: 'open-plaza', findingsTitle: …, bossSpawnLabel: …, … })` and asserts the header and assertion line content.
- **Scope:** `harness/validate/**` only. Do not run a full playthrough or rewrite committed `game/validation/**` artifacts in this sub-ticket.

## Verification: code
