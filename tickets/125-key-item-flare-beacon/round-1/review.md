# Senior review: #125 Key Item — Flare Beacon

**Ticket:** Signal Flare (`flare_beacon`) — reveal enemies in a large radius for a few seconds.  
**Baseline:** `cae476233565af0ee950af703fa8c58d9c3f937f`  
**Commits:** `8b8bfcd` (server), `e155cd9` (client VFX), `9e7d3bc` (tests)

## Runtime health (capture)

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| `pageerrors` empty, no `failure_kind` | Pass |
| `console.log` — no `pageerror` / `[fatal]` from game code | Pass |

`console.log` shows only Vite connect lines and benign `409 (Conflict)` on an auth/resource request during lobby setup. No harness failure block. Game starts, reaches `playing`, canvas and hand visible in probes.

Capture used **fallback** smoke (lobby → movement), not flare-specific scenarios; runtime proof is “loads cleanly,” not “flare VFX exercised in browser.”

## Acceptance criteria

### Cooldown ~10s

**Met.** `KEY_ITEM_DEFS.flare_beacon` sets `cooldownMs: 10000`. Handler sets `player.keyItemCooldownUntil = now + def.cooldownMs` before emitting `keyItemUsed`. Tests in `flare_beacon.test.js` and `key-items.test.js` assert second use within 10s returns `on_cooldown` with `remainingMs` ≈ 10000.

### Works through walls (intel only)

**Met.** Reveal uses planar distance `Math.hypot(enemy.x - player.x, enemy.z - player.z)` with no line-of-sight or wall checks. Enemies in another room within 25m are marked the same as line-of-sight targets — appropriate for intel-only reveal. No combat or damage bypass.

### Clears marks when enemies die or timer ends

**Met.**

- **Timer:** `simulation.js` tick deletes `enemy.revealedUntil` when `Date.now() >= revealedUntil`. Client `applyRevealHighlight` also treats past/absent timestamps as off and restores `_origEmissive`.
- **Death:** `useKeyItem` skips `hp <= 0`; `removeDeadEnemies()` removes corpses from state so meshes are disposed; highlight cannot persist on removed entities.

### Tests: in-range gets `revealedUntil`; out-of-range does not

**Met.** Dedicated `game/server/test/flare_beacon.test.js` (7 cases) plus flare section in `key-items.test.js` (radius, dead skip, cooldown, boundary at 25m, `stateUpdate` snapshot). Client `applyRevealHighlight` covered by 8 tests in `main.test.js`. Coverage run in `coverage.log`: 1002 tests passed for changed-file scope.

## Integration with design / foundation

- Fits existing key-item pattern: `useKeyItem` handler, `stateSnapshot()` ships full `enemies` array (includes `revealedUntil`), client sync loop applies VFX.
- `game/docs/design.md` has no separate flare spec; behavior matches ticket goal (server marks, client highlights).
- `game/docs/requirements.md` foundation unchanged: 3D scene, websocket play, movement — capture confirms.
- **Note:** Ticket blurb mentions “HUD/minimap”; the codebase has no minimap system. Delivery is amber emissive glow on enemy meshes in the 3D view, which matches subticket scope and the updated item description (“on your HUD”). Not a blocking gap given explicit acceptance criteria and absent minimap feature.

## Code quality

- Focused diff across `progression.js`, `index.js`, `simulation.js`, `renderer.js`, tests.
- Reveal glow runs after windup flash in the enemy loop so active reveal wins for that frame.
- `_origEmissive` stored at mesh creation for correct restore (including spawner non-zero emissive).
- Debug scenario `flare-beacon-ready` added consistently with other key-item QA shortcuts.

## Debug scenario: `flare-beacon-ready`

| Rule | Status |
|------|--------|
| Gated to dev (localhost URL `?debugScenario=`, server `isDebugScenarioAllowed`) | OK |
| Normal path still valid (`equipKeyItem` + `useKeyItem` with equipped id) | OK |
| Does not bypass `useKeyItem` server logic | OK — only pre-equips item and spawns nearby enemies |

## Sub-ticket integration

All three subtickets land coherently: server reveal + cooldown + tick cleanup, client highlight, tests. No dead code or obvious logic bugs found in live tree review.

## Remaining gaps

None blocking. Runtime is healthy; acceptance criteria and tests are satisfied.

## Nits (non-blocking)

See `nits.md` if present — duplicate test suites, no dedicated simulation cleanup test, capture did not exercise flare visually.

VERDICT: PASS
