# 01 — Quest-tier variant scaling

Add reusable quest-tier → variant-roll scaling so Tier-1 runs almost never tag enemies with variants and Tier-2 runs frequently do, riding the existing `applyVariant(enemy, tier, rng)` seam without changing variant definitions.

## Acceptance Criteria

- A exported resolver maps quest tier to a 0–1 roll tier (Tier 1 ≈ 0, Tier 2 high — e.g. `1.0` so `BASE_VARIANT_CHANCE` applies fully).
- Combat spawns (`spawnEnemy` / `spawnCombatEnemies` and objective hooks that call `spawnEnemy`) pass the resolved quest-tier roll tier instead of (or in addition to, when both apply) room `encounterTier`; on open-plaza / single-room arenas where `roomTierAt` is always 0, Tier-2 runs still roll variants.
- Tier-1 quest runs produce `variant: null` on enemies across a seeded batch (or a vanishingly small tag rate if Tier 1 uses a tiny epsilon); Tier-2 quest runs produce a materially higher tagged rate on the same seed batch.
- Existing `encounterTier`-based scaling for multi-room Tier-1 dungeons is preserved or explicitly combined so Tier-1 combat rooms do not suddenly spike variants.
- New/extended unit tests in `game/server/test/` cover the resolver and spawn wiring; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/enemyVariants.js`** — Add `resolveVariantRollTier(questTier, encounterTier?)` (or equivalent) with documented constants for Tier 1 vs Tier 2 scale; keep `applyVariant` signature unchanged.
- **`game/server/progression.js`** — In `spawnEnemy` / `spawnCombatEnemies` (and `buildObjectiveSpawnCtx` if survive/objective spawns bypass the main path), read `run.questTier` from `_gameState.run` and pass the resolved roll tier into `applyVariant`.
- **`game/server/test/enemy_variants.test.js`** (extend) and/or **`game/server/test/variant_rate_by_quest_tier.test.js`** (new) — Deterministic `mulberry32` batches comparing tag counts at quest tier 1 vs 2; assert open-plaza spawn positions still get Tier-2 rolls when `roomTierAt` is 0.
- Do **not** add quest catalog entries, layout changes, or client UI in this sub-ticket.

## Verification: code
