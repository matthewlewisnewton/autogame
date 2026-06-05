# Senior Review: 254-level2-mechanics-and-reference

## Runtime Health

Captured run is healthy. `metrics.json` reports `"ok": true`, the dev server and Vite proxy reached readiness, `pageerrors` is empty, and `console.log` has no `pageerror` or `[fatal]` entries from game code. The only console/server noise observed is benign capture/runtime output: two 409 resource lines from duplicate auth/register traffic, Three.js deprecation warnings, and Vite websocket `EPIPE` on shutdown.

The screenshots and probes show a clean lobby-to-play flow with two players, initialized scene/canvas, movement, enemy presence, hand HUD, and key-item cooldown HUD. The fallback capture exercised the default Tier-1 quest rather than the new Tier-2 reference scenario, so Tier-2 acceptance was judged from the live implementation and targeted test coverage below.

## Acceptance Criteria Findings

### Tier-1 enemies almost never variants

Satisfied. The implementation maps Tier-1 variant rolls to zero effective roll tier via `resolveVariantRollTier()`, and all enemy creation flows through `spawnEnemy()`, which applies the centralized quest-tier/encounter-tier scaling before calling `applyVariant()`. The changed tests verify deterministic batches produce zero Tier-1 variants, and that spawned Tier-1 open-plaza enemies keep `variant === null`.

### Tier-2 frequently variants

Satisfied. Tier-2 runs use a full roll tier even when room `encounterTier` is 0, which is important for open-plaza/single-room layouts. `spawnCombatEnemies()` passes the spawn room tier into `spawnEnemy()`, and `spawnEnemy()` combines it with the active `run.questTier` or selected quest tier. The targeted tests cover direct variant batches, `spawnEnemy()`, and `spawnEnemies()` on open-plaza, including fixed-seed Tier-2 tagging.

### Tier-2 layout is more deterministic

Satisfied. `arena_trials` Tier 2 declares `layoutMode: 'rigid'`, `getLayoutGenerationOptions()` resolves that mode only for Tier 2, and `generateOpenPlaza()` switches to ordered cover placement plus fixed hazard placement in rigid mode. Tests verify rigid cover/hazards are stable across seeds while default mode still varies.

### Open-plaza Tier-2 fully playable

Satisfied. `arena_trials` Tier 2 is listed as an unlock-gated Tier-2 quest variant, selects the open-plaza profile with rigid mode, uses a tier-specific seed, and spawns enemies through the same cover-aware open-floor spawn path used by normal open-plaza runs. The layout tests cover open-plaza walkability, cover colliders, spawn-clear rules, platforms, hazards, and rigid structural requirements. The arena Tier-2 tests verify enemy count, walkable spawn positions, Tier-2 variant tagging, and Tier-1 victory unlocking the Tier-2 contract.

### Tests for variant-rate-by-tier and rigid layout

Satisfied. `coverage.log` shows the full suite passed: 79 files and 1416 tests. New targeted coverage includes `variant_rate_by_quest_tier.test.js`, open-plaza rigid-mode cases in `dungeon.test.js`, `arena_trials_tier2.test.js`, `quests.test.js`, `debug-scenarios.test.js`, and harness proxy readiness tests.

## Design and Requirements Consistency

The implementation stays within the documented lobby/deploy/dungeon loop: Tier-2 quests are surfaced through the quest board, unlock after clearing Tier 1, and deploy through the same run creation, objective, layout, enemy spawn, movement, and persistence systems as normal gameplay. The captured run confirms the foundation requirements remain intact: 3D scene renders, client connects to the server, players are represented, and movement updates in a running multiplayer session.

## Debug Scenario Review

This ticket adds `?debugScenario=arena-trials-tier-2`. It is properly gated behind the existing debug-scenario socket path: the client only requests it from a localhost URL parameter, and the server rejects debug scenarios in production unless explicitly enabled. Normal gameplay does not call this scenario.

The same end state is reachable normally by clearing `arena_trials` Tier 1, selecting the newly unlocked Tier 2 quest, and readying/deploying. The shortcut sets `selectedQuestId`, `selectedQuestTier`, and the Tier-2 layout before `enterPlayingPhase()`, so `startDungeonRun()` snapshots the correct quest/tier metadata. It does not bypass combat or objective invariants after entry: enemies are spawned through the normal `spawnEnemies()` path, run objective sync is called, and state is broadcast through normal lobby/state update channels.

## Code Quality

The changed code is cohesive and uses existing quest, progression, layout, lobby, and debug-scenario patterns. The harness proxy readiness change is narrowly scoped to harness capture env and keeps normal dev proxy behavior unchanged. I did not find dead/broken code, missing exports, obvious race conditions, or console/page errors attributable to the ticket.

## Remaining gaps

None.

VERDICT: PASS
