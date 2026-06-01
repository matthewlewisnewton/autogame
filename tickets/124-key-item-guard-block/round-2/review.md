# Senior Review: Key Item - Guard Block

## Runtime health

The captured run is healthy. `metrics.json` reports `"ok": true`, no harness failure, and an empty `pageerrors` array. `console.log` contains only Vite connection messages, two 409 resource responses, and scene initialization logs; there are no `pageerror` or `[fatal]` entries from game code. The fallback capture reached the lobby and then active gameplay with two connected players, an initialized scene, a canvas, the card hand visible, and player movement reflected in the probes.

Coverage evidence is also clean: `coverage.log` reports 30 passing test files and 980 passing tests. The listed screenshots from `metrics.json` were not present as image files in the round folder, so this review relies on the recorded probes and logs for visual/runtime evidence.

## Acceptance Criteria

- Cooldown about 3-4 seconds: satisfied. `guard_block` is defined with `cooldownMs: 3500`, and the socket handler stores `player.keyItemCooldownUntil` from that definition. Integration tests cover immediate second-use rejection with `on_cooldown`.
- Blocking flag checked in the damage pipeline for enemy/player damage: satisfied. `useKeyItem` sets `blockingUntil` and `blockingYaw`, and `damagePlayer()` applies the block check before shield absorption while using attacker position from enemy IDs or minion attacker IDs. Enemy windup damage and beam-style player hits route through `damagePlayer()` with attacker context.
- Cannot stack with dodge i-frames in a broken way: satisfied. `damagePlayer()` exits on `invulnerableUntil` before applying block reduction, so dodge i-frames take priority. This priority is documented in the implementation comments and covered by tests.
- Client shield pose/VFX on facing direction: satisfied. The client triggers a cyan shield disc on successful `guard_block` use and keeps it active from `stateSnapshot().players[id].isBlocking`; the disc is offset using the same `atan2(z, x)` facing convention as player rotation.
- Tests for frontal hit reduced, rear hit full, and expiry: satisfied. `game/server/test/guard_block.test.js` and the added `damagePlayer()` tests cover frontal reduction, arc edge behavior, rear/full damage, expiry, shield interaction, cooldown, and invulnerability priority.

## Design and regression check

The implementation is consistent with the action-RPG/key-item design: Guard Block adds a short defensive stance without changing the lobby/dungeon/deck loop, and it does not weaken the baseline rendering, socket connectivity, multiplayer state, or WASD movement requirements. Movement is slowed to 20% while blocking, satisfying the requested slowed/rooted tradeoff without introducing a separate movement mode.

No dead or obviously broken code was found in the changed files. The runtime logs and coverage run do not show console crashes or test failures.

## Debug scenarios

The ticket added `guard-block-ready`. It is gated through the existing debug scenario path: the client only auto-requests it from the `?debugScenario=` URL parameter on local hosts, and the server rejects debug scenarios in production or non-local contexts unless explicitly allowed by `ALLOW_DEBUG_SCENARIOS=1`.

The same end state is reachable normally: a player can equip `guard_block` in the lobby via `equipKeyItem`, deploy into a dungeon, and use `useKeyItem` while off cooldown. The scenario only preps the player with `guard_block`, low HP, and no cooldown; it does not bypass the normal `useKeyItem` handler, damage pipeline, cooldown assignment, state snapshot, persistence dirty marking, or net replication that real play uses.

## Remaining gaps

None.

VERDICT: PASS
