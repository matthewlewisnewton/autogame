# Spire Ascent harness preset and playthrough wiring

Add a `spire-ascent` playthrough preset that targets the **Spire Ascent Tier II** stage-boss run (Summit Warden / `spire_warden`) and register it in the existing `playthrough.mjs` driver from ticket 277. This sub-ticket is harness-only; debug scenarios referenced by the preset land in sub-ticket 02.

## Acceptance Criteria

- New `harness/validate/presets/spire-ascent.mjs` exports `questId: 'spire_ascent'`, `questTier: 2`, `bossType: 'spire_warden'`, `deployScenario: 'spire-ascent-tier-2'`, and placeholder scenario keys `nearAddsScenario`, `bossApproachScenario`, `bossLowHpScenario` matching the names implemented in sub-ticket 02 (`spire-ascent-near-adds`, `spire-ascent-boss-approach`, `spire-ascent-boss-low-hp`).
- Preset includes `addTypes: ['grunt', 'skirmisher', 'miniboss', 'spawner']` so add-combat polling clears all non-boss encounter adds (Spire's pool is wider than Training Caverns).
- `harness/validate/playthrough.mjs` registers the preset in `PRESET_MODULES` and passes `addTypes` through to `defeatAdds` / `liveAdds` (default `['grunt', 'skirmisher']` when omitted so `rooms` preset behavior is unchanged).
- `runHubStep` deploy wait/error messages are preset-aware (no hard-coded "Training Caverns" string); after deploy, harness asserts `objective.type === 'stage_boss'`, `encounter.phase === 'dormant'`, and `enemyHp` contains `spire_warden`.
- `node harness/validate/playthrough.mjs --preset spire-ascent --steps auth` completes with `summary.ok: true` (auth + lobby browser screenshot only).
- `cd game && pnpm test:quick` still passes.
- No `game/server/` or `game/client/` changes in this sub-ticket.

## Technical Specs

- **`harness/validate/presets/spire-ascent.mjs`** (new): mirror `presets/rooms.mjs` shape; set `encounterTriggerRadius: 8`, timeouts aligned with rooms preset, `lobbyName: 'Spire Ascent Validation'`.
- **`harness/validate/playthrough.mjs`**: import preset; thread optional `preset.addTypes` into `liveAdds` / `runBossEncounterStep` → `defeatAdds`; use `preset.lobbyName` for create-lobby input; generalize deploy failure message to include preset quest id/tier.
- **`harness/validate/lib/combat.mjs`**: accept optional `addTypes` on `defeatAdds` (and internal `nonBossEnemies` / `questAdds` helpers) defaulting to grunt+skirmisher.
- Depends on ticket 277 harness (`playthrough.mjs`, `lib/combat.mjs`, `lib/auth.mjs`, etc.). Sub-ticket **02** must land before `--steps hub` / `full` can pass.

## Verification: code
