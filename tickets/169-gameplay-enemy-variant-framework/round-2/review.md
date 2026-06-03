# Review

## Runtime health
- PASS. `metrics.json` is present with `"ok": true`, the browser reached active gameplay with connected players, canvas initialized, and `pageerrors` is empty.
- `console.log` has no `pageerror` or `[fatal]` entries from game code. The Vite connection messages and socket-close `EPIPE` noise in the logs are benign under the ticket instructions.
- The round directory does not contain the referenced PNG files, but the captured probes and logs show the game started and loaded cleanly.

## Acceptance criteria

### Variant framework plumbing is implemented and scoped
- PASS. `game/server/enemyVariants.js` adds a small registry with a single no-op `test` variant, tier-scaled `applyVariant(enemy, tier, rng)`, and registry-driven `getVariantBonusDrop(enemy)`.
- PASS. The implementation is scoped to the requested plumbing. It does not ship real affix behavior beyond the proving no-op/test variant, registry hook, marker, and bonus-drop seam.

### Spawn integration and encounter-tier gating
- PASS. `game/server/progression.js` centralizes variant initialization in `spawnEnemy()`, so direct spawns and spawner adds get `variant: null` by default, while combat spawns pass the run-seeded RNG and `room.encounterTier` through `roomTierAt()`.
- PASS. `spawnCombatEnemies()` rolls variants once per spawned enemy via `spawnEnemy(..., { tier, rng })`; start/treasure/unknown tier locations resolve to tier 0 and therefore do not roll.
- PASS. `game/server/dungeon.js` already assigns `encounterTier` metadata to rooms, and the implementation uses that data without changing dungeon generation behavior.

### Public state and client marker
- PASS. `stateSnapshot()` returns the live enemy list, so the new `variant` field is included in state updates. The captured probes show enemies still serialize and gameplay proceeds normally.
- PASS. `game/client/renderer.js` adds a badge mesh driven purely by `enemy.variant`, updates it each frame, removes it when the field is falsy, and disposes stale marker meshes with removed enemies. This should not interfere with reveal highlights, windup flashes, health bars, hitboxes, or lock-on rings because it uses a separate mesh registry.

### Bonus drops
- PASS. `recordEnemyCardDrop()` adds a registry-driven bonus card copy for variant enemies while leaving non-variant enemies on the existing normal card path.
- PASS. `spawnMagicStoneDrop()` preserves the normal magic-stone drop and adds a separate registry-driven bonus magic-stone entry for variant enemies. Non-variant behavior is covered by tests and remains unchanged.

### Behavior hook
- PASS. `applyVariant()` invokes a variant definition's `apply(enemy)` only when a variant is selected and only when the registry entry provides a function. The shipped `test` variant keeps `apply: null`, so it remains behaviorally no-op.

### Debug scenario checks
- PASS. The new `variant-enemy` debug scenario is gated through the existing debugScenario socket path and local/dev allowance checks; normal gameplay does not enter it.
- PASS. The same end-state is reachable through normal gameplay because combat enemy spawns can roll the registry `test` variant when the room tier and RNG allow it.
- PASS. The scenario only prepares deterministic client-verification state by spawning a variant enemy beside a plain enemy. It does not bypass persistence, net replication, or server-side validation paths used by normal state updates.

### Design and foundation consistency
- PASS. The change is consistent with `game/docs/design.md`: it extends dungeon enemy/loot behavior without changing the lobby, movement, multiplayer, card-combat, or run loop foundations.
- PASS. The captured run preserves the requirements in `game/docs/requirements.md`: Three.js scene renders, clients connect over WebSockets, players are represented in 3D, and movement/state updates continue.

### Validation
- PASS. Focused local verification completed successfully: `pnpm exec vitest run --config vitest.config.js server/test/enemy_variants.test.js server/test/server.test.js --coverage.enabled=false` passed 2 files / 351 tests.
- Visibility note: the provided `coverage.log` shows `server/test/enemy_variants.test.js` passed and the variant-drop/server tests ran, but the overall coverage process was killed after 120s during an unrelated later key-item suite. I do not treat that coverage timeout as a blocking code gap for this ticket because the captured game run is healthy and the focused changed suites pass.

## Remaining gaps

None.

VERDICT: PASS
