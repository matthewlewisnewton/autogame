# Senior Review: Key Item - Phase Step

## Runtime health

The round-6 capture shows the game starts and loads cleanly. `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains Vite connection noise and 409 resource lines, but no `pageerror` or `[fatal]` entries from game code. The smoke capture reached `playing` with a canvas, card hand, connected socket during the main probe, two players, and enemies in the dungeon.

Coverage also completed successfully: 33 test files and 934 tests passed. The new `phase_step` server suite is included in that run.

## Acceptance criteria

### Cooldown ~12s

Pass. `KEY_ITEM_DEFS.phase_step.cooldownMs` is `12000`, successful use stores `player.keyItemCooldownUntil = now + cooldownMs`, and the new test suite verifies a second use returns `on_cooldown`.

### Requires co-op ally in same run; solo -> fail gracefully

Pass. The server filters candidates to other living, non-extracted players in the lobby/run state and returns `no_ally` without burning cooldown when none exist. The solo failure path is covered by `game/server/test/phase_step.test.js`.

### No swap through walls (both endpoints valid)

Fail. The implementation checks `isInsideDungeon(player.x, player.z)` and `isInsideDungeon(ally.x, ally.z)` before swapping, but that only validates membership in a walkable room/passage AABB. It does not reject endpoints that overlap wall colliders. The existing collision helpers distinguish this with `isEntityPositionBlocked(...)`, and the server already uses that helper for movement-adjacent key-item placement such as `summon_recall`.

Because room wall centers are still inside the room AABB, a caster or ally whose endpoint is wall-overlapped but still inside a room can pass the `phase_step` guard and be swapped. That violates the "no swap through walls / endpoints valid" criterion. The tests cover off-map endpoints, but not wall-blocked endpoints.

### Client target highlight or auto-nearest

Pass. The client computes the nearest living, non-extracted ally within 6m while `phase_step` is equipped, shows a cyan ground ring, and sends `targetPlayerId` from the highlighted ally. If omitted or null, the server falls back to nearest ally selection.

### Tests: two players swap coords; out of range fails

Pass, with one missing negative case noted above. `game/server/test/phase_step.test.js` verifies nearest auto-target swap, explicit target swap, out-of-range failure without cooldown burn, off-map invalid-position failure, solo failure, cooldown behavior, and definition values. The missing coverage is specifically wall-collider endpoint rejection.

## Design and foundation consistency

The feature fits the design direction: it is a multiplayer dungeon utility key item that works through the existing socket-based server authority and state broadcast path. It does not regress the foundation requirements: the game renders, connects via WebSockets, shows multiplayer state, and movement still works in the smoke capture.

The `phase-step-ready` debug scenario is gated through the existing `debugScenario` URL/socket path and localhost/dev-only server checks. It does not fabricate an ally, so the real end state still requires the normal co-op lobby/run flow and a real second player in range.

## Code quality

The server implementation is straightforward and uses existing cooldown and state-update patterns. The main quality issue is the incomplete endpoint validity check: `isInsideDungeon` alone is weaker than the collision validity used elsewhere. Client targeting is visually clear, though it duplicates the `6m` range constant in the renderer.

## Remaining gaps

1. Phase Step can accept wall-overlapped endpoints because it only checks walkable AABBs, not wall colliders. This fails the "no swap through walls / both endpoints valid" acceptance criterion.

VERDICT: FAIL
