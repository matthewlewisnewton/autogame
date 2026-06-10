# 04 — Frost Crossing Tier 1 stage-boss wire-up

Apply the ticket-258 stage-boss encounter framework to `frost_crossing` Tier 1: keep the existing scripted dock / ice-band / Rimecast arc, spawn a dormant Permafrost Warden on `ice_cairn`, and make boss defeat the run victory condition with lobby copy, encounter HUD, and debug-scenario support.

## Acceptance Criteria

- `frost_crossing` Tier 1 uses `objectiveType: 'stage_boss'` with `encounter: { bossType: 'permafrost_warden', landmark: 'ice_cairn', addCount: 0 }`; existing `scriptedEncounters` (dock grunts, ice thrower waves, Rimecast named rare, passage lock) remain authored.
- Deploying Frost Crossing spawns scripted wave enemies as today **plus** one dormant `permafrost_warden` on the `ice_cairn` landmark; `run.encounter.bossEnemyId` is wired; `run.objective.type === 'stage_boss'`.
- Encounter activation follows ticket-258 rules: all non-boss hostiles defeated, player within trigger radius → encounter becomes `active` + `locked`; defeating the boss clears the encounter and completes the run with victory rewards.
- Quest board / contract summary uses frost-specific stage-boss copy (mentions Permafrost Warden), not generic trial-warden strings.
- `boss-encounter-hud.js` resolves **Permafrost Warden** for `frost_crossing` during an active locked encounter.
- Briefing, description, and at least one mid-run dialogue beacon reference the Permafrost Warden / south cairn after the ice-band arc.
- Debug scenario `frost-crossing-boss-approach` deploys a playing `frost_crossing` Tier 1 run with scripted waves cleared and the player repositioned near the dormant boss for encounter QA; existing frost-crossing debug scenarios updated off `defeat_enemies` expectations where needed.
- `game/server/test/frost_crossing_stage_boss.test.js` (new) covers catalog, deploy spawn shape, dormant boss on `ice_cairn`, encounter activation after scripted clears, and boss-kill victory.
- Updated tests in `frost_crossing_named_rare.test.js`, `tier1_quest_identity.test.js`, `frost_crossing_spawn.test.js`, `quests.test.js`, `debug-scenarios.test.js`, and `boss-encounter-hud-wiring.test.js` pass; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Change `frost_crossing.tiers[1]` to `objectiveType: 'stage_boss'` and add `encounter` metadata; update `description`, `briefing`, `client.briefing`, and dialogue beacons (e.g. post-Rimecast line pointing to the cairn warden). Keep `scriptedEncounters`, `rewardCards`, `layoutProfile`, and signature reward fields intact.
- **`game/shared/theme.json`** — Add `defeatPermafrostWarden` (and optional `defeatPermafrostWardenWithSupports`) objective strings.
- **`game/server/quests.js`** (`formatObjectiveSummary`) and **`game/client/questBoard.js`** — Branch `frost_crossing` + `stage_boss` to the new theme strings.
- **`game/client/boss-encounter-hud.js`** — Add `frost_crossing: 'Permafrost Warden'` to `QUEST_STAGE_BOSS_NAMES`.
- **`game/client/test/questBoard.test.js`** and **`game/client/test/boss-encounter-hud-wiring.test.js`** — Assert frost Tier-1 summary and HUD boss name.
- **`game/server/debugScenarios.js`** — Add `frost-crossing-boss-approach` (pattern: `canyon-descent-boss-approach` / `spire-ascent-tier-2` — clear scripted waves, reposition near live boss, optional `tryActivateEncounter`). Update frost-crossing scenarios that gate on `defeat_enemies` to accept `stage_boss`.
- **`game/server/test/frost_crossing_stage_boss.test.js`** (new) — Catalog, deploy, encounter wiring, activation, victory; model on `spire_ascent_tier2.test.js` + scripted-wave helpers from `frost_crossing_named_rare.test.js`.
- **`game/server/test/frost_crossing_named_rare.test.js`** — Replace the `defeat_enemies` victory assertion with stage-boss flow (scripted arc still spawns Rimecast; run completes only after Permafrost Warden defeat).
- **`game/server/test/tier1_quest_identity.test.js`** — Expect `stage_boss` + encounter config for `frost_crossing` tier 1.
- **`game/server/test/quests.test.js`** — Expect frost Tier-1 `objectiveType: 'stage_boss'` and permafrost-specific `objectiveSummary`.
- **`game/server/test/debug-scenarios.test.js`** — Cover `frost-crossing-boss-approach` and updated frost scenario objective types.
- Reuse encounter core from ticket 258; depends on sub-tickets 01, 02, and 03.

## Verification: code
