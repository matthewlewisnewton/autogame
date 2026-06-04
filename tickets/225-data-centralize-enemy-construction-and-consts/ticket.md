# 225-data-centralize-enemy-construction-and-consts

## Difficulty: medium

## Goal

(a) spawnEnemy (game/server/progression.js:2456-2486) builds an enemy copying ONLY hp/maxHp; every other stat (chaseSpeed, attackDamage, attackWindupMs, attackStyle...) stays on ENEMY_DEFS and combat re-looks-it-up at runtime as ENEMY_DEFS[enemy.type]||ENEMY_DEFS.grunt (simulation.js:1750) — so an unknown/typo enemy type silently behaves like a grunt. Variants DO write computed fields (shieldHp) onto the entity, so the rule is inconsistent. (b) PROJECTILE_HIT_WIDTH=1.2 is defined in config.js:17 AND redefined in simulation.js:785; other tuning literals are inline.

## Acceptance Criteria

- 1. Either spread the full def onto the entity at construction ({...def,...overrides}) so it is self-describing, OR keep def-lookup but via a single enemyDefFor(enemy) that THROWS on unknown type (no silent grunt). Apply uniformly; audit minion code reusing ENEMY_DEFS.grunt fields (simulation.js:784,1984+). 2. Import PROJECTILE_HIT_WIDTH from config in simulation.js; promote repeated tuning literals to named config consts.

## Verification

CORRECTNESS (silent grunt fallback, const drift) + SIMPLICITY. Medium risk: changes enemy entity shape — audit client serialization + minion reuse.
