# Phase Stalker beam and Legion Marshal skeleton summon VFX

Polish `null_crawler` (Phase Stalker) phase-beam attacks and `undead_commander` (Legion Marshal) multi-skeleton deployment with distinct, accent-themed visuals built from 315 primitives. Phase beam already has `renderPhaseBeam` and a windup telegraph mesh; Legion Marshal already spawns basic summon rings — this pass makes both families immediately recognizable.

## Acceptance Criteria

- `renderPhaseBeam` composes `spawnProjectileTrail` along the beam vector, `spawnParticleBurst` at the beam terminus, and `spawnHitSpark` on each hit (guarded when ctx helpers are absent).
- `null_crawler` summon flourish (per-card override) uses a tight cyan telegraph ring + particle swirl distinct from generic creature summon (builds on sub-ticket 01).
- `game/client/renderer.js` `createNullCrawlerTelegraph` / windup emissive pulse is visually distinct from the resolved beam (e.g. pulsing `spawnTelegraphRing` or brighter emissive during `attackState === 'windup'`).
- `renderUndeadCommander` upgraded: commander summon uses bone-white/purple accent styling; each `summonedMinions` entry gets `spawnMinionSummonInEffect` (or equivalent) with a smaller radius plus `spawnParticleBurst` rising from the ground; skeleton rings use accent color rather than default amber.
- `game/client/test/cardRenderers.test.js` asserts phase-beam primitive calls, undead commander per-skeleton summon count, and accent colors for `null_crawler` / `undead_commander`.
- Renderer HP-drop fallback for `null_crawler` remains compatible (no duplicate beam if `cardUsed` already fired within `CARD_HIT_GRACE_MS`).

## Technical Specs

- `game/client/cardRenderers.js`: enhance `renderPhaseBeam` (~line 319), `renderUndeadCommander` (~line 186); add `null_crawler` summon override in `CARD_RENDERERS`.
- `game/client/renderer.js`: polish null-crawler windup telegraph helpers (~line 4004) and optional windup ring spawn.
- `game/client/test/cardRenderers.test.js`: extend existing Phase Stalker / undead commander tests with primitive and per-skeleton assertions.

## Verification: code
