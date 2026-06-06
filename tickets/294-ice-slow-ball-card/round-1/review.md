## Runtime health

The captured run is healthy. `metrics.json` is present with `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains Vite startup lines, expected 409 auth-conflict noise, and scene initialization logs, with no `pageerror` or `[fatal]` lines from game code. The captured probes show a connected two-player run in `playing` phase with canvas and card hand visible, preserving the foundation requirements for rendering, socket connection, multiplayer presence, and movement.

## Acceptance criteria

### Card is obtainable and castable

Pass. `game/shared/cardDefs.json` registers `ice_ball` / Glacial Orb as a reward spell with charges, and `game/shared/cardStats.json` provides cost, damage, range, slow parameters, and projectile timing. `game/shared/cardEconomy.json` gives it a sell value, and the server reward rotation is generated from reward-acquisition definitions, so the card is reachable through normal victory rewards. The server test suite also asserts `VICTORY_REWARD_ROTATION` contains `ice_ball`.

### Fires an ice-ball projectile

Pass. `game/server/cardEffects.js` handles the `ice_ball` spell by resolving player aim, collecting projectile hits with the configured range, applying cooldown/consumption, and emitting a `cardUsed` payload with `effect: "ice_ball"`, origin, direction, range, hits, and `projectileTravelMs`. This follows the existing instant-authoritative-hit plus client-projectile-visual pattern used by other projectile cards.

### Chance roll applies slow plus modest damage

Pass. On projectile hits, the effect deals the configured 12 damage through `collectProjectileHits`, then rolls `Math.random() < slowChance` per struck enemy and calls `applySlow(enemy, slowDurationMs, slowFactor)` on success. Tests cover successful slow rolls, failed slow rolls that still deal impact damage, and the emitted cast payload.

### Client renders projectile and slow indicator

Pass. `game/client/cardRenderers.js` registers a dedicated `ice_ball` renderer that calls `spawnAttackEffect` with an icy palette and slow travel duration. `game/client/renderer.js` implements the `ice_ball` attack effect as a cyan sphere that travels over `projectileTravelMs`. Existing slow indicators are driven from broadcast `slowedUntil` on enemies and players, so Ice Ball's server-applied slow is visible via the same status indicator system as the ice enemy slow mechanic.

### Server tests for cast, projectile, and chance-to-slow

Pass. `game/server/test/ice_ball_card.test.js` verifies card definition/economy, reward availability, cast payload with projectile metadata and hit damage, success-roll slow application, and failure-roll no-slow behavior. `coverage.log` reports 115 test files and 1765 tests passed.

## Design and regression review

The implementation is consistent with the card-combat design: Glacial Orb is a spell card using Magic Stones, is acquired as loot/reward, and reuses the established shared-card-data pipeline so client and server definitions stay aligned. It does not weaken the base requirements in `game/docs/requirements.md`; the captured run still renders the 3D scene, connects to the backend, shows multiple players, and processes movement.

## Debug scenarios

The new `ice-ball-ready` debug scenario is gated through the existing debug-scenario socket path and registered only in the `DEBUG_SCENARIOS` set. It shortcuts into a QA-ready state by placing Glacial Orb in hand, topping up Magic Stones, and lining up enemies, but the equivalent state is reachable through normal gameplay by earning the reward card, adding it to a deck, entering combat, and casting it at an enemy. It does not bypass server-side card validation or effect handling; tests still emit `useCard` and exercise the authoritative `handleUseCard` path.

## Remaining gaps

None.

VERDICT: PASS
