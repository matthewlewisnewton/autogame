# 291-burning-status-effect-foundation

## Difficulty: hard

## Goal

Add a BURNING (damage-over-time) status effect (foundation for the fire enemy, fireball card, and wurm rebalance). Follow the timed-status pattern (frozenUntil/isEnemyFrozen). Add burningUntil + a periodic tick: while burning, the entity takes damage EVERY tick PLUS a small extra fire-damage amount per tick, for a short duration. Applies to PLAYERS (lit on fire by the fire enemy) and ENEMIES (burned by the fireball card / wurm). Add a burning visual/animation (flames on the entity). Expose helpers applyBurning(entity, durationMs) / isBurning(entity) for 296/297/298.

ACCEPTANCE: a burning entity loses HP every tick (base tick dmg + small extra fire dmg) for the duration then stops; re-application refreshes duration; burning animation shows on players and enemies; godmode players ignore it (consistent with existing damage-immunity); server tests for tick damage + expiry on players and enemies. SCOPE: game/server/simulation.js (status + tick), game/server, game/client (burning animation), game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
