# 01 — Boss encounter UI and Summit Warden visual probes

Ensure the spire-ascent boss-active capture step records ticket **283** encounter HUD probes and ticket **284** distinct-boss visual probes for **Summit Warden** (`spire_warden`), and that findings rendering knows the spire-ascent boss identity. Probe capture helpers already exist from sunken-canyon revalidation — this sub-ticket adds spire-ascent preset metadata and findings expectations only; no full revalidation run.

## Acceptance Criteria

- During the existing boss-active step (`05-boss-active.png`), `runBossEncounterStep` still captures `bossEncounterUi` and `bossVisualIdentity` probes for the `spire-ascent` preset with at least:
  - `bossEncounterUi.hudVisible === true`, non-empty `bossName` (expect **Summit Warden** display text), numeric `hpFillWidthPct`, `encounterLocked === true`, `encounterPhase === 'active'`
  - `bossVisualIdentity.bossType === 'spire_warden'`, `bossEnemyId` matches harness `encounter.bossEnemyId`, `nearestAddType` from live adds (grunt/skirmisher/spawner), `bossDistinctFromAdds === true` (boss type differs and `maxHp` strictly greater than nearest add)
- `harness/validate/presets/spire-ascent.mjs` exports spire-specific metadata mirroring sunken-canyon: `findingsTitle`, `bossSpawnLabel: 'spire_warden (Summit Warden)'`, `layoutProfile: 'spire-ascent'`.
- `harness/validate/lib/findings.mjs` boss UI / visual sections use preset metadata so spire-ascent runs flag missing HUD or indistinguishable boss/add types with Summit Warden wording (not Canyon Warden / annex_overseer).
- `harness/validate/verify-spire-ascent-artifacts.mjs` `checkFindingsBossLabel` accepts `spire_warden` or `Summit Warden` (already present) and rejects wrong-boss labels.
- `cd game && pnpm test:quick` passes.
- Do **not** wire probes into `--steps full` assertions yet (sub-ticket **04**) or run `pnpm validate:spire-ascent`.

## Technical Specs

- **Edit:** `harness/validate/presets/spire-ascent.mjs` — add `findingsTitle`, `bossSpawnLabel`, `layoutProfile`.
- **Edit:** `harness/validate/lib/findings.mjs` — ensure boss encounter UI / visual identity renderers read preset `bossSpawnLabel` / `bossType` for spire-ascent (no sunken-canyon-only hard-coding).
- **Reuse (no change unless broken):** `harness/validate/playthrough.mjs` — `captureBossEncounterUiProbe`, `captureBossVisualIdentityProbe`, `runBossEncounterStep`; DOM ids from `game/client/boss-encounter-hud.js`.
- **Reuse:** `game/client/main.js` harness `__getEnemyRenderScaleForTest` if present from ticket 370.
- **Scope:** `harness/validate/**` only; no gameplay balance changes.

## Verification: code
