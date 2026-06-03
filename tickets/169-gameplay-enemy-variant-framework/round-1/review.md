# Senior Review: Enemy Variant Framework

## Per-Criterion Findings

### Runtime health and captured run

PASS. The captured run is healthy: `metrics.json` reports `"ok": true`, the probes reached `phase: "playing"` with an initialized canvas and connected socket, and `pageerrors` is empty. `console.log` contains only Vite connection and scene initialization output. `client.log` includes only benign Three.js deprecation warnings and Vite `EPIPE` close noise, which the review instructions explicitly exclude from broken-game failures.

The screenshot manifest lists four fallback smoke screenshots, but no `.png` files are present in `round-1`; the probe data still verifies lobby entry, gameplay, movement, and dodge/cooldown behavior.

### Variant registry and applyVariant seam

FAIL. The registry file exists with a test variant, a named base chance, tier scaling, and an exported `applyVariant(enemy, tier, rng)`. The probability is scaled by a clamped `tier`, and tier 0 leaves `enemy.variant` as `null`.

However, the behavioral seam is incomplete. `VARIANT_DEFS.test` includes an `apply` placeholder and comments say future tickets should extend `VARIANT_DEFS` with real effects without touching the seam, but `applyVariant` never looks up the selected definition or invokes `def.apply`. A future variant can be selected and tagged, but its behavior cannot run through the registry. That misses the framework purpose of introducing affixes that can later modify enemy behavior.

The spawn integration is also too narrow. The normal initial combat spawn loop calls `applyVariant(enemy, roomTierAt(...), rng)`, but the generic `spawnEnemy` helper still creates enemies without a `variant` field and without a tier-aware variant pass. Callers outside `spawnCombatEnemies`, including spawner-created adds via `game/server/simulation.js`, continue to bypass the framework. The sub-ticket technical spec explicitly called out `spawnEnemy` and said spawns without a known room/tier should pass tier 0; this implementation leaves those enemies with an absent field instead.

### Encounter-tier gating

PASS for the initial combat spawn path. `roomTierAt` resolves the containing room's `encounterTier`, clamps unknown/no-room positions to 0, and start/treasure rooms already carry encounter tier 0 from dungeon role assignment. This satisfies the gating behavior for enemies spawned through `spawnCombatEnemies`.

### Public state and client marker

PASS for enemies that actually receive the variant pass. `stateSnapshot()` serializes `_gameState.enemies` whole, so any `variant` field on the enemy reaches the client. The renderer adds a separate magenta octahedron badge for truthy `enemy.variant`, removes it for falsy/undefined variants, and disposes stale marker meshes with other enemy-owned visuals. The path is safe for the common undefined/null case.

### Guaranteed bonus drops

PASS. `recordEnemyCardDrop` adds an extra copy of the normal enemy card for variant enemies, and `spawnMagicStoneDrop` adds a second magic-stone loot entry using the registry's `bonusDrop.magicStone` value. Non-variant enemies still receive the original drop behavior.

### Debug scenarios

PASS. The new `variant-enemy` scenario is gated through the existing debug scenario path: the client only requests it from a localhost `?debugScenario=` URL, and the server rejects scenarios in production unless explicitly enabled. Normal gameplay can reach an equivalent variant-enemy state through combat spawning and `applyVariant`, though probabilistically. The scenario only mutates transient runtime combat state for visual QA and does not bypass persistence or server-side authority for normal players.

### Tests and coverage

PARTIAL. I ran the targeted variant tests successfully:

`pnpm exec vitest run --config vitest.config.js server/test/enemy_variants.test.js server/test/server.test.js -t "variant enemy bonus drops|enemy variant registry|applyVariant"`

Result: 2 files passed, 10 tests passed, 335 skipped. The provided `coverage.log` did not complete; it ends with `[vitest] timed out after 120s — killing process group`, so it is not evidence of a full-suite pass. The missing seam behavior and generic spawn integration are not covered by the added tests.

### Design and foundation requirements

PASS with the exceptions above. The implementation does not conflict with the design document or the foundational requirements for rendering, client/server connectivity, multiplayer visualization, or movement synchronization. The captured smoke run confirms those foundations still load and play.

## Remaining gaps

1. `applyVariant` selects and tags variants but never invokes a selected registry definition's behavior hook, so future affixes cannot modify stats/AI through the registry seam.
2. Variant initialization is not owned by `spawnEnemy`; only the initial combat spawn loop runs `applyVariant`, leaving generic `spawnEnemy` callers and spawner-created adds outside the framework and often without a `variant` field.

VERDICT: FAIL
