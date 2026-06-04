1. Vitest is not green: `coverage.log` shows 2 failing `guard_block` timing assertions, violating the ticket's full-suite-green acceptance criterion.
   Files: game/server/test/guard_block.test.js, game/server/keyItemEffects.js
   Fix: Make the guard_block cooldown/duration assertions or implementation deterministic enough that the full Vitest suite passes.

2. Cinder Snare DoT damage is not attributed to the trap owner, so delayed DoT kills can miss or misassign enemy card-drop credit via `enemy.lastDamagedBy`.
   Files: game/server/simulation.js, game/server/test/enchantment.test.js
   Fix: Carry `ownerId` into the inferno-pillar tick damage path, pass it as `attackerId` to `collectRadialHits`, and add a test that a Cinder Snare DoT kill sets/uses owner attribution.
