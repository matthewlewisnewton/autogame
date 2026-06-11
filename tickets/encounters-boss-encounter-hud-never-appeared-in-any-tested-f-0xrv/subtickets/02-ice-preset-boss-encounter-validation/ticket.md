# Ice preset boss-encounter validation pipeline

Retarget the ice playthrough preset from the obsolete `defeat_enemies` flow to the current `stage_boss` Frost Crossing tier 1 run, and wire boss-encounter UI probes into assertions and artifacts. The ice validation driver currently never calls `runBossEncounterStep`, so `bossEncounterUi` is never recorded and findings still claim there is no stage boss.

## Acceptance Criteria

- `harness/validate/presets/ice.mjs` uses `objectiveType: 'stage_boss'`, `bossType: 'permafrost_warden'`, `bossApproachScenario: 'frost-crossing-boss-approach'`, `encounterTriggerScenario: 'frost-crossing-encounter-trigger'`, and `bossLowHpScenario: 'frost-crossing-boss-low-hp'` (drop `lastEnemyScenario` for victory; keep ice-specific scenarios for slippery floor, glacial slow, telepipe, card mechanics).
- `harness/validate/playthrough.mjs` for preset `ice`:
  - Deploy wait expects `objective.type === 'stage_boss'` and a dormant `permafrost_warden`.
  - Full run executes `runBossEncounterStep` (not `runDefeatEnemiesCombatStep`) and records `bossEncounter.probes.bossEncounterUi` during the boss-active capture.
  - Maps `frost-crossing-boss-approach` → `frost-crossing-encounter-trigger` in `encounterTriggerByApproach` when no explicit `encounterTriggerScenario` is set.
  - `buildAssertions` adds `bossEncounterUiVisible` and `encounterActivated` for the ice preset (same criteria as sunken-canyon/spire: HUD visible, non-empty boss name **Permafrost Warden**, `encounterPhase === 'active'`, `encounterLocked === true`).
  - `runVictoryStep` uses `bossLowHpScenario` + `defeatBoss` (stage-boss path), not `lastEnemyScenario`.
- `harness/validate/lib/findings.mjs` renders **Boss encounter UI** / **Boss visual identity** sections for ice runs and removes the stale “no stage boss” gap note when probes are present.
- `harness/validate/verify-ice-artifacts.mjs` requires `bossEncounterUiVisible` and `encounterActivated` assertion keys and the boss-active screenshot(s) produced by the updated step numbering (adjust `REQUIRED_PNGS` to match the new flow while keeping ice-specific PNGs).
- Depends on passed sub-ticket **01** (`frost-crossing-encounter-trigger`, `frost-crossing-boss-low-hp`).
- `cd game && pnpm test:quick` passes (no full `pnpm validate:ice` run required in this sub-ticket).

## Technical Specs

- **`harness/validate/presets/ice.mjs`** — switch objective/boss fields; wire boss-approach, encounter-trigger, and boss-low-hp scenario names; retain `nearAddsScenario`, `slipperyFloorScenario`, `surfaceTransitionScenario`, `glacialSlowScenario`, `telepipeScenario`, and card-mechanics scenario map.
- **`harness/validate/playthrough.mjs`**
  - Extend ice branch in deploy / boss-encounter / victory / `buildAssertions` / `writeFullArtifacts` mirroring `sunken-canyon.mjs` or `spire-ascent.mjs` patterns.
  - Add `'frost-crossing-boss-approach': 'frost-crossing-encounter-trigger'` to `encounterTriggerByApproach`.
  - Merge `bossEncounterUi` and `bossVisualIdentity` into ice `probes.json` output.
- **`harness/validate/lib/findings.mjs`** — ice preset assertion block and boss-encounter sections (reuse `renderBossEncounterUiSection`).
- **`harness/validate/verify-ice-artifacts.mjs`** — update `REQUIRED_ASSERTION_KEYS` and PNG list for the stage-boss capture path.
- **Scope:** `harness/validate/**` only; no gameplay changes.

## Verification: code
