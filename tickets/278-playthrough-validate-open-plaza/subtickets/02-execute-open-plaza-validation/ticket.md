# Execute the Open-Plaza playthrough and land validation artifacts

Run the full `open-plaza` playthrough end-to-end (auth → hub/deploy →
boss-encounter → victory) against the real game and commit the resulting
artifacts under `validation/open-plaza/`. Assertions must genuinely pass, or
`findings.md` must document the real failure with the captured screenshots — do
NOT fake a pass.

## Acceptance Criteria

- The driver is run with debug auth + scenarios enabled, the `open-plaza` preset,
  full steps, and output dir `validation/open-plaza/`:
  `node harness/validate/playthrough.mjs --preset open-plaza --out validation/open-plaza/ --steps full`
  (with `ALLOW_DEV_AUTH=1` and `ALLOW_DEBUG_SCENARIOS=1`; the game process the
  driver launches must boot with these set).
- `validation/open-plaza/` contains the full screenshot set from a real run:
  `01-lobby-browser.png` (hub), `02-level-entry.png`, `03-mid-combat.png`
  (mid-level), `04-boss-dormant.png`, `05-boss-active.png`,
  `06-boss-defeated.png`, `07-victory.png`.
- `validation/open-plaza/run-summary.json`, `probes.json`, `console.log`, and
  `findings.md` are present and produced by THIS run (not copied from rooms).
- `run-summary.json` reflects an `arena_trials` / `arena_champion` run: the
  `presetConfig.bossType` is `arena_champion` and the `hub.bossTypes` array
  includes `arena_champion`.
- Either: `run-summary.json` `assertions` are all true
  (`bossSpawned`, `encounterActivated`, `bossDefeated`, `victoryFired`) — i.e.
  the boss spawned, the encounter activated (`phase: 'active'`, `locked: true`),
  boss hp reached 0, and victory/objective-complete fired —
  OR: `findings.md` documents the real failure (which assertion failed and why),
  references the captured screenshots, and the artifacts corroborate it. No
  fabricated pass; no hand-edited screenshots or summary.
- `findings.md` includes a short notes section calling out anything
  broken / ugly / surprising observed in the Open-Plaza run (workers cannot file
  beads — everything for operator triage goes here).

## Technical Specs

- Output dir: `validation/open-plaza/` at the repo root (the ticket scope
  explicitly allows `validation/**`). Do NOT write under `game/validation/`.
- The driver (`harness/validate/playthrough.mjs`, depends on sub-ticket 01)
  already writes `run-summary.json`, `probes.json`, `findings.md`, and
  `console.log` for `--steps full` via `writeFullArtifacts`; this sub-ticket
  runs it and commits the output. Screenshots are written by `writeScreenshot`.
- If the run cannot reach victory (e.g. full-HP `arena_champion` defeat exceeds
  `defeatBoss` timeout, or adds are unreachable in the open plaza), capture
  whatever screenshots the run produced, let the driver write its
  `findings.md`/`run-summary.json` with the failing assertions, and augment
  `findings.md` with the concrete failure detail for operator triage. Do not
  add or modify `game/**` gameplay code or debug scenarios to force a pass.
- Scope: `validation/**` (artifacts) only. If a harness defect is discovered
  mid-run, the harness fix belongs in sub-ticket 01's scope
  (`harness/validate/**`), not here.

## Verification: code
