# Wire the Cinder Warden stage-boss encounter into Ember Descent

Add a Tier II `stage_boss` run to the `ember_descent` quest that spawns the
Cinder Warden (from sub-ticket 01) via the encounter framework, with a defeat
objective, supporting adds, briefing, and dialogue — mirroring the
`canyon_descent` / `spire_ascent` Tier II warden encounters.

## Acceptance Criteria
- `game/server/quests.js` defines `ember_descent.tiers[2]` with
  `objectiveType: 'stage_boss'`, `layoutProfile: 'fire-cavern'`,
  `layoutMode: 'rigid'`, `unlockRequires: { questId: 'ember_descent', tier: 1 }`,
  and an `encounter` block `{ bossType: 'cinder_warden', addCount: <n>,
  landmark: <optional> }`. (A `landmark` is optional — fire-cavern is an "open"
  profile; if none is set the boss falls back to the start room per
  `resolveStageBossSpawnPosition`. Do NOT invent a landmark type that the
  fire-cavern layout never places.)
- The Tier II entry has fire-themed `client.name` / `client.briefing` and a
  `dialogue` array with `run_start` and `objective_complete` triggers (optional
  `waveCleared` mid-run line), consistent with the other Tier II wardens.
- `game/shared/theme.json` adds `objectives.defeatCinderWarden` and
  `objectives.defeatCinderWardenWithSupports` ("...and {addCount} supports")
  strings.
- The objective-label resolver in `game/server/quests.js` (the
  `quest.objectiveType === 'stage_boss'` branch with the per-quest `if (questId
  === ...)` cases) returns the Cinder Warden strings for `ember_descent`.
- Deploying `ember_descent` Tier 2 spawns exactly one `cinder_warden` boss plus
  `addCount` adds; defeating the boss clears the encounter and completes the
  `stage_boss` objective (the existing `onStageBossDefeated` path).
- `pnpm test:quick` (from `game/`) passes.

## Technical Specs
- `game/server/quests.js`: add the `tiers[2]` object under `ember_descent`
  (currently tier 1 only), copying the structure of `spire_ascent.tiers[2]` /
  `canyon_descent.tiers[2]`. Add an `ember_descent` case in the `stage_boss`
  objective-label switch (around the `spire_ascent` / `canyon_descent` cases).
- `game/shared/theme.json`: add the two `defeatCinderWarden*` keys next to the
  existing `defeatCanyonWarden*` / `defeatSummitWarden*` keys.
- Add/extend a server test (e.g. `game/server/test/cinder_warden.test.js` or a
  new `ember_descent_stage_boss.test.js`) asserting the encounter config, boss +
  add spawn counts, the objective label string, and boss-defeat → encounter
  cleared. Mirror `game/server/test/canyon_stage_boss_spawn.test.js` and
  `stage_boss_defeat.test.js`.

## Verification: code
