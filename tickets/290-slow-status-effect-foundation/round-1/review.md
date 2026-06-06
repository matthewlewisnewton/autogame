# Review - 290-slow-status-effect-foundation

## Runtime health
PASS. The captured run in `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only normal Vite and scene initialization output, with no `pageerror` or `[fatal]` lines from game code. The client/server logs show the game started and loaded; the only noisy lines are accepted benign THREE deprecation and Vite socket-close `EPIPE` messages.

Note: `metrics.json` lists four screenshot filenames, but the round folder does not contain PNG files. The probes still show a connected, initialized, playing scene.

## Acceptance criteria findings

### Slow status helpers
PASS. `applySlow(entity, durationMs, factor)` and `isSlowed(entity)` are exported from `game/server/simulation.js` and re-use the existing timed-status style: future `slowedUntil` means active, expiry returns false, and re-application extends to the later expiry rather than stacking windows. Factor clamping to `(0, 1]` with a `0.5` default is sensible for the foundation.

### Slowed player movement
FAIL. The authoritative server tick multiplies `applyPlayerMovement()` by `player.slowFactor` while `isSlowed(player)` is true, and the server tests cover apply, expire, and refresh behavior. However, the local client prediction path in `game/client/renderer.js` still advances the local player with `MOVE_SPEED * TICK_DT` unconditionally. During an active slow, the local player renders at full speed until `game/client/main.js` snaps them back only when idle or when moving drift exceeds `2.5` units. That means a slowed local player does not robustly appear or feel slowed; they rubber-band against the server instead.

### Slowed enemy chase
PASS. Enemy chase speed is multiplied by `enemy.slowFactor` while slowed and still respects existing frenzied multipliers. Frozen enemies continue to skip movement entirely, so FREEZE remains distinct from SLOW. The dedicated server tests cover enemy slow, expiry, refresh, and freeze precedence.

### Client slow indicator
PASS with the player-movement caveat above. The renderer adds distinct cool-blue ground rings for slowed players and enemies, driven by broadcast `slowedUntil`, and cleans up markers on expiry or entity removal. The indicator is applied to local and remote players, plus enemies. Because local prediction can run ahead of the server slowed position, the local player's slow ring can lag behind the visible avatar until reconciliation snaps.

### Snapshot and future caller support
PASS. Player hot snapshots now expose `slowedUntil` and `slowFactor`, and enemies are still broadcast as raw world objects, so future ice enemy/card callers can set the same fields through `applySlow()`.

### Debug scenarios
PASS. This ticket did not add or change any `?debugScenario=NAME` shortcut, so no new debug-scenario invariant was introduced.

### Tests and coverage
PARTIAL. `server/test/slow_status.test.js` passed all 14 slow-specific tests. The captured `coverage.log` records one existing-looking failure in `server/test/debug-scenarios.test.js` for `canyon-descent-tier-2` boss HP (`expected 1, got 300`); that file was not changed by this ticket, so I am not counting it as the slow implementation gap, but it should be triaged separately before relying on the full suite as green.

## Remaining gaps

1. Local client movement prediction ignores SLOW, so a slowed local player still moves at full predicted speed and rubber-bands against the slower server-authoritative position.
   Files: `game/client/renderer.js`, `game/client/main.js`
   Fix: apply the active local player's `slowFactor` in the client movement prediction step whenever `Date.now() < slowedUntil`, and reconcile the slow indicator/avatar position so the local player visibly moves at the reduced multiplier for the full duration.

VERDICT: FAIL
