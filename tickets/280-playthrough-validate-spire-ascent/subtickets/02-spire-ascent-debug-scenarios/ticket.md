# Spire Ascent debug scenarios for playthrough harness

Register gated debug shortcuts so the Spire Ascent Tier II playthrough can teleport near adds, approach the dormant Summit Warden (`spire_warden`), and finish the boss quickly — following the `training-caverns-*` pattern from ticket 277 sub-ticket 11.

## Acceptance Criteria

- `game/server/debugScenarios.js` adds handlers (gated on `ALLOW_DEBUG_SCENARIOS`) for:
  - **`spire-ascent-near-adds`**: requires `spire_ascent` tier 2 `stage_boss` run; clusters live non-`spire_warden` adds at 1 HP near the player with a deterministic weapon in slot 0 (same ergonomics as `training-caverns-near-adds`).
  - **`spire-ascent-boss-approach`**: requires adds cleared and `encounter.phase === 'dormant'`; places the player just outside `ENCOUNTER_TRIGGER_RADIUS` of the encounter anchor (`spire_summit` landmark via `resolveEncounterAnchor`); sets `player.debugScenario = 'spire-ascent-boss-approach'` and `debugScenarioNudgeAfter` deferral.
  - **`spire-ascent-boss-low-hp`**: clears non-boss enemies, positions player beside dormant `spire_warden` at 1 HP for fast `defeatBoss`.
- `nudgeDebugBossApproachPlayers` also nudges players with `debugScenario === 'spire-ascent-boss-approach'` (same deferral + anchor-based step logic as training caverns).
- `game/server/index.js` allowlists all three new scenario names.
- `game/server/test/debug-scenarios.test.js` covers deploy via existing `spire-ascent-tier-2` test expectations (`spire_warden` boss, `stage_boss` objective) and adds tests for each new scenario (near-adds yields wounded adds; boss-approach stays dormant for 30 ticks; boss-low-hp yields 1-HP `spire_warden`).
- `cd game && pnpm test:quick` passes.
- No `harness/` changes in this sub-ticket.

## Technical Specs

- **`game/server/debugScenarios.js`**: add `resolveSpireSummitAnchor(state)` (landmark `spire_summit`, fallback `firstRoomPosition`); add `liveSpireAscentAdds(state, bossType = 'spire_warden')` filtering all live non-boss enemies; implement the three scenarios; extend `nudgeDebugBossApproachPlayers` scenario-name check.
- **`game/server/index.js`**: append scenario names to both debug-scenario allowlist arrays (near `spire-ascent-tier-2` entries).
- **`game/server/test/debug-scenarios.test.js`**: new `describe('debugScenario — spire-ascent-tier-2 harness shortcuts')` block; import `runGameLoopTick` / `ENCOUNTER_TRIGGER_RADIUS` where needed for dormant survival assertion.
- Boss enemy type confirmed in **`game/server/test/spire_warden.test.js`**: `ENEMY_DEFS.spire_warden.name === 'Summit Warden'`.
- Depends on passed sub-ticket **01** (preset names). Existing `spire-ascent-tier-2` deploy scenario must remain working.

## Verification: code
