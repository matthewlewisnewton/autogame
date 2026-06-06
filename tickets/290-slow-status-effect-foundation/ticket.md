# 290-slow-status-effect-foundation

## Difficulty: hard

## Goal

Add a SLOW status effect (foundation for the ice enemy + ice card). Distinct from the existing FREEZE (frost_nova/glacier_collapse fully stop an enemy) — SLOW temporarily REDUCES movement speed.

Follow the existing timed-status pattern (frozenUntil + isEnemyFrozen in game/server/simulation.js; isPlayerConcealed). Add a slowedUntil timestamp + a slow speed multiplier that applies to BOTH players and enemies while active, with a duration and sensible re-application/refresh rules (re-hit refreshes, does not stack infinitely). Players slowed -> reduced move speed; enemies slowed -> reduced chase speed. Add a client visual indicator that an entity is slowed. Expose helpers (applySlow(entity, durationMs, factor), isSlowed(entity)) for the ice enemy (293) and ice card (294) to call.

ACCEPTANCE: a slowed player/enemy moves at the reduced multiplier for the duration then returns to normal; re-application refreshes; client shows a slowed indicator; server tests for apply/expire/refresh on both players and enemies. SCOPE: game/server/simulation.js (status), game/server, game/client (indicator), game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
