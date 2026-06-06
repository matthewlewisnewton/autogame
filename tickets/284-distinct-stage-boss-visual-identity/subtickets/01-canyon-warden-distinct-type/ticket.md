# 01 — Give Canyon Warden its own enemy type

The Canyon Warden (canyon_descent Tier 2 boss) currently uses `bossType: 'miniboss'`, sharing the generic miniboss visual with any miniboss adds. Create a dedicated `canyon_warden` enemy type so the boss renders with its own color and geometry preset.

## Acceptance Criteria

- `canyon_warden` is registered in `ENEMY_DEFS` (`game/server/simulation.js`) with stats between `miniboss` and `spire_warden` (HP ~350, attack ~20)
- `canyon_warden` has a `name` field displaying as "Canyon Warden" and a `surfacedStats` array
- `canyon_warden` is registered in `ENEMY_GEOMETRY` (`game/client/renderer.js`) with a distinct color (not purple `0x8800cc` — the miniboss color) and cone dimensions
- `canyon_warden` is registered in `ENEMY_ATTACK_VISUAL` (`game/client/renderer.js`) matching the server attack style
- `canyon_warden` is added to `MODEL_REGISTRY` (`game/client/models.js`) mapping to a model path (can reuse `/models/miniboss.glb` for now)
- `canyon_descent` Tier 2 `encounter.bossType` in `quests.js` is changed from `'miniboss'` to `'canyon_warden'`
- Existing tests still pass (especially `quests-spawn-pools.test.js` which checks all quest spawn types exist in `ENEMY_DEFS`, and `canyon_descent_tier2.test.js`)

## Technical Specs

- **`game/server/simulation.js`** — Add `canyon_warden` entry to `ENEMY_DEFS` object (after `spire_warden`, before `spawner`). Use cone attack style, HP=350, attackDamage=20, chaseSpeed=1.0, wanderSpeed=0.5, attackWindupMs=1300, attackRange=5.5. Include `name`, `description`, `surfacedStats`.
- **`game/client/renderer.js`** — Add `canyon_warden` to `ENEMY_GEOMETRY` (cone, radius 0.85, height 1.9, segments 12, color `0xcc8800` — amber/brown distinct from miniboss purple). Add matching entry to `ENEMY_ATTACK_VISUAL` (cone style, coneAngle PI/2, range 5.5).
- **`game/client/models.js`** — Add `canyon_warden: '/models/miniboss.glb'` to `MODEL_REGISTRY`.
- **`game/server/quests.js`** — Change `canyon_descent` Tier 2 `encounter.bossType` from `'miniboss'` to `'canyon_warden'`. Update the enemy pool if it references `miniboss` for the boss (the pool miniboss weight is fine — that's for adds).
- **`game/server/test/quests-spawn-pools.test.js`** — Update expected spawn pools for `canyon_descent` to include `canyon_warden` instead of (or in addition to) `miniboss` in the boss encounter.

## Verification: code
