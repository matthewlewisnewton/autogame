# Regenerate ice boss-encounter validation artifacts

Run the retargeted `pnpm validate:ice` full playthrough so Frost Crossing tier 1 reaches an engaged Permafrost Warden fight and captures proof that `#boss-encounter-hud` is visible with the warden name and HP bar. Replace the stale `game/validation/ice/` tree (still on the obsolete `defeat_enemies` preset) with artifacts that match the stage-boss harness from sub-ticket 02 and pass `verify-ice-artifacts.mjs`.

## Acceptance Criteria

- Implementer's **first action** is `cd game && pnpm validate:ice` (run `pnpm install` first only if required). Do not hand-author PNGs or JSON.
- The playthrough drives the debug-scenario boss path: `frost-crossing-boss-approach` → `frost-crossing-encounter-trigger` → `frost-crossing-boss-low-hp`, reaching `encounter.phase === 'active'` and `encounter.locked === true` before the boss-active screenshot.
- `game/validation/ice/06-boss-active.png` exists and is produced during the engaged boss fight (not dormant/cleared-only).
- `game/validation/ice/probes.json` records `bossEncounterUi` with `hudVisible === true`, `bossName === 'Permafrost Warden'`, `encounterPhase === 'active'`, and `encounterLocked === true`; `bossEncounter` probes are non-null in the boss-active step.
- `game/validation/ice/run-summary.json` has `"preset": "ice"`, `"steps": "full"`, `presetConfig.objectiveType === 'stage_boss'`, and assertions `bossSpawned`, `encounterActivated`, `bossDefeated`, `bossEncounterUiVisible`, and `victoryFired` all `true`. Stale keys `layoutDeployed` and `enemiesCleared` are absent.
- All PNGs required by `harness/validate/verify-ice-artifacts.mjs` are present (`01-hub.png` … `12-telepipe-after.png`, including `05-boss-dormant.png`, `06-boss-active.png`, `09-boss-defeated.png`, `10-victory.png`).
- `cd game && pnpm validate:ice:check` exits `0`.
- `cd game && pnpm test:quick` still passes.
- Depends on passed sub-tickets **01**, **02**, and **03**.
- **Scope:** primary output is `game/validation/ice/**`. Edit `harness/validate/**` only if `validate:ice` fails due to a blocking harness bug; keep fixes minimal and re-run the full validation.

## Technical Specs

- **Execute:** `cd game && pnpm validate:ice` — runs `harness/validate/playthrough.mjs --preset ice --steps full --out game/validation/ice` with `ALLOW_DEV_AUTH=1` and `ALLOW_DEBUG_SCENARIOS=1`.
- **Writable output:** `game/validation/ice/**` — screenshots, `run-summary.json`, `probes.json`, `findings.md`, `console.log`, `server.log`.
- **Verify:** `cd game && pnpm validate:ice:check` → `harness/validate/verify-ice-artifacts.mjs` (requires `bossEncounterUiVisible`, `encounterActivated`, renamed boss PNGs; rejects `layoutDeployed` / `enemiesCleared`).
- **Preset reference:** `harness/validate/presets/ice.mjs` — `objectiveType: 'stage_boss'`, `bossApproachScenario`, `encounterTriggerScenario`, `bossLowHpScenario`, `bossActiveScreenshot: '06-boss-active'`.
- **Driver reference:** `harness/validate/playthrough.mjs` — `runBossEncounterStep`, ice `buildAssertions`, `bossEncounterUi` probe capture via `captureBossEncounterUiProbe`.
- **Findings:** update `game/validation/ice/findings.md` to document boss-encounter UI assertions (remove any stale “no stage boss” gap note when probes pass).

## Verification: code
