# Senior Review — 129 Key Item: Ground Anchor

## Runtime health (blocking gate)
`round-1/metrics.json` reports `"ok": true`, an empty `pageerrors` array, and no
`harness_failure` block. The deterministic full-flow capture reached `phase: "playing"`
with two connected players, a live scene/canvas, and key-item cooldown HUD working
(dodge-roll probe shows `keyItemCooldownRemaining: 397` → `0`). `console.log` contains
only benign noise: Vite connect lines, `[initScene]`, and a `409 Conflict` resource load
(the deterministic auth/lobby flow — appears across tickets, not a game-code error). No
`pageerror`/`[fatal]` lines. **Game runs and loads cleanly.**

## Per-criterion findings

**`useKeyItem` sets `anchorUntil` ~1.5s; move speed ×0.7 while active — MET.**
`progression.js` defines `ground_anchor` with `durationMs: 1500`, `speedMultiplier: 0.7`.
The `index.js` handler (around line 3008) sets `player.anchorUntil = now + durationMs`
and `player.anchorSpeedMultiplier = speedMultiplier`, then burns cooldown and broadcasts.
The slow is applied in `simulation.js#applyPlayerMovement`: `if (now < (player.anchorUntil || 0)) playerStep *= (player.anchorSpeedMultiplier || 0.7)`. Unit test confirms a
0.7× step while active and a full step once expired.

**Cooldown ~6s — MET.** `cooldownMs: 6000` in the def; handler sets
`player.keyItemCooldownUntil = now + cooldownMs`. The shared pre-branch guard returns
`on_cooldown` with `remainingMs` on immediate re-use. Definition test asserts `6000`.

**Player cannot be knockbacked during anchor — MET.** New
`simulation.js#applyPlayerKnockback(playerId, dirX, dirZ, strength)` is the canonical
player-displacement entry point and no-ops while `Date.now() < player.anchorUntil`. It
guards null player, non-positive strength, and zero-magnitude direction, normalizes the
direction, and routes through `tryPlayerMove` so wall/bounds collision is respected.

**Hook existing knockback application on players — MET (as far as possible).** There is
no pre-existing player-knockback path in the codebase: `applyKnockback` only displaces
enemies (`hits.map(h => h.enemyId)`), and no card/enemy attack currently displaces a
player. The implementer correctly documented this in `decompose.txt` and provided the
guarded `applyPlayerKnockback` helper as the single canonical entry point that future
player-displacement must use — which bakes in the anchor immunity. This is the honest
reading of the AC; there is nothing existing to hook, and the immunity infrastructure is
in place and correct.

**Tests: knockback ignored during anchor; normal after expiry — MET.**
`server/test/ground_anchor.test.js` (7 tests, all passing) covers: non-anchored player
moves along the direction; no-op while anchored; normal knockback after `anchorUntil`
expires; direction normalization; movement slow active vs. expired; and the definition
values. `key-items.test.js` additions also pass (combined run exit 0).

## Integration / quality
- State init is correct: `anchorUntil`/`anchorSpeedMultiplier` are seeded in both
  `buildPlayerRecord` and `initializePlayerForActiveRun`, mirroring `rally_cry`.
- The handler follows the established sibling pattern (rally_cry, guard_block,
  barrier_dome) exactly — equipped/dead/extracted/cooldown guards, `persistenceDirty`,
  `stateSnapshot()` broadcast.
- No console errors, no dead/broken code, no design.md or requirements.md regression. No
  debug scenarios added.

## Remaining gaps
None blocking. (See `nits.md` for one non-blocking follow-up.)

VERDICT: PASS
