# Open-Plaza validation preset + optional boss-encounter scenario steps

Add an `open-plaza` playthrough preset for the Arena Trials (arena_trials) Tier‑2
`arena_champion` stage boss, and make the driver's near-adds and boss-approach
scenario steps optional so the existing playthrough driver can run a full
arena_trials playthrough using only the debug scenarios that exist
(`arena-trials-tier-2`, plus the natural clear-adds → walk-into-trigger →
defeat-boss flow). No gameplay code changes — harness only.

## Acceptance Criteria

- A new preset file `harness/validate/presets/open-plaza.mjs` exists and exports
  (default) at least: `questId: 'arena_trials'`, `questTier: 2`,
  `bossType: 'arena_champion'`, `deployScenario: 'arena-trials-tier-2'`, and an
  `encounterTriggerRadius` value matching `ENCOUNTER_TRIGGER_RADIUS` from
  `game/server/encounters.js` (the rooms preset uses 8).
- The preset does NOT set `nearAddsScenario`, `bossApproachScenario`, or
  `bossLowHpScenario` (no such arena scenarios exist; the run relies on the
  deploy's live adds, a natural walk-into-trigger activation, and a real boss
  defeat).
- `harness/validate/playthrough.mjs` registers `open-plaza` in `PRESET_MODULES`
  so `--preset open-plaza` loads the new preset.
- In `runBossEncounterStep`, the `nearAddsScenario` request is skipped when the
  preset does not define it; the step still asserts that the post-deploy /
  post-godmode harness has live adds (so the `03-mid-combat` screenshot is real),
  still runs `defeatAdds`, and still asserts the dormant boss for `04-boss-dormant`.
- In `runBossEncounterStep`, the `bossApproachScenario` request is skipped when
  the preset does not define it; the step proceeds directly to
  `activateEncounter`, which walks the player into the trigger radius.
- The `rooms` preset and its full-run behavior are unchanged: with all three
  scenarios still defined, the driver requests them exactly as before (same call
  order, same assertions).
- `node harness/validate/playthrough.mjs --help` runs without error and the file
  parses (no syntax errors); `pnpm test` server+client suites still pass.

## Technical Specs

- New file: `game`-external — `harness/validate/presets/open-plaza.mjs`. Mirror
  the shape of `harness/validate/presets/rooms.mjs` but omit the missing-arena
  scenario fields. Confirm `ENCOUNTER_TRIGGER_RADIUS` value before hardcoding.
- `harness/validate/playthrough.mjs`:
  - Add `'open-plaza': () => import('./presets/open-plaza.mjs')` to
    `PRESET_MODULES`.
  - In `runBossEncounterStep`, guard `await requestScenario(page, nearAddsScenario)`
    behind `if (nearAddsScenario)`. When absent, read the current harness and
    throw only if there are zero live adds (reuse the existing `liveAdds` check
    so the mid-combat screenshot still represents real adds).
  - Guard `await requestScenario(page, bossApproachScenario)` (and the
    subsequent `assertDormantBoss(approachHarness, ...)`) behind
    `if (bossApproachScenario)`. When absent, go straight to `activateEncounter`.
  - Do not change `runVictoryStep` — `bossLowHpScenario` is already optional
    there (`if (bossLowHpScenario)`).
- Do NOT add or modify any debug scenario in `game/server/debugScenarios.js`,
  `game/server/index.js`, or any other `game/**` file. If a full open-plaza run
  later proves unreliable (e.g. full-HP boss defeat times out), that is an
  operator finding for sub-ticket 02's `findings.md`, not a gameplay change here.

## Verification: code
