# Sunken-canyon harness preset and driver wiring

Add a `sunken-canyon` playthrough preset and register it in the existing 277 driver so validation can deploy `canyon_descent` Tier 2 (sunken-canyon profile, stage-boss Canyon Warden = `miniboss` per `game/server/quests.js`) via the existing `canyon-descent-tier-2` debug scenario. Wire npm entrypoints; combat-positioning scenarios land in sub-ticket 02.

## Acceptance Criteria

- `harness/validate/presets/sunken-canyon.mjs` exports `{ questId: 'canyon_descent', questTier: 2, bossType: 'miniboss', deployScenario: 'canyon-descent-tier-2', encounterTriggerRadius: 8, … }` with placeholder `nearAddsScenario`, `bossApproachScenario`, and `bossLowHpScenario` names to be filled by sub-ticket 02.
- `harness/validate/playthrough.mjs` registers preset `sunken-canyon` in `PRESET_MODULES` and uses preset-driven deploy assertions instead of hard-coded Training Caverns copy (error messages, lobby create name, post-deploy checks).
- After `--steps hub` with `--preset sunken-canyon`, harness state shows `phase === 'playing'`, `layout.profile === 'sunken-canyon'`, `objective.type === 'stage_boss'`, a live `miniboss` in `enemyHp`, and `encounter.phase === 'dormant'`; screenshots `01-hub.png` and `02-level-entry.png` are written under the configured `--out` dir.
- `game/package.json` adds `"validate:sunken-canyon": "node ../harness/validate/playthrough.mjs --preset sunken-canyon --steps full --out game/validation/sunken-canyon"` (check script added in sub-ticket 03).
- `node harness/validate/playthrough.mjs --preset sunken-canyon --steps auth` exits `0` with JWT auth + lobby browser visible.
- `cd game && pnpm test:quick` still passes. No `game/server/` or `game/client/` gameplay changes in this sub-ticket.

## Technical Specs

- **New:** `harness/validate/presets/sunken-canyon.mjs` — mirror `presets/rooms.mjs` shape; confirm `bossType` and `deployScenario` against `game/server/quests.js` (`canyon_descent` tier 2 `encounter.bossType`) and `game/server/debugScenarios.js` (`canyon-descent-tier-2` handler).
- **Edit:** `harness/validate/playthrough.mjs` — add `sunken-canyon` to `PRESET_MODULES`; generalize `runHubStep` deploy wait/error strings and optional `layout.profile` assertion using `preset.questId` / `preset.bossType` (keep ship-hub lobby flow unchanged).
- **Edit:** `game/package.json` — add `validate:sunken-canyon` script pointing at `--out game/validation/sunken-canyon`.
- **Scope:** `harness/validate/**` and `game/package.json` only.

## Verification: code
