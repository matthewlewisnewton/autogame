# Server: enemies attacking a taunt minion bypass the windup state machine and hit every tick

## Difficulty: easy

## Goal

The taunt branch in updateEnemies (game/server/simulation.js:2664-2674) calls damageMinion(tauntMinion, enemy.attackDamage) directly whenever in range — no windup, no ENEMY_ATTACK_RECOVERY_MS, no per-attack cooldown. At TICK_RATE=20 that is 20 full-damage hits per second, while the normal minion-target path (simulation.js:2607-2631) goes through windup -> strike -> recovery. A taunting aegis_sentinel melts in under a second, defeating the taunt mechanic. Fix: route taunt targets through the existing windup path (set windupTargetType=minion, windupTargetId, attackState=windup) instead of dealing instant damage. Found in code review 2026-06-09.

## Acceptance Criteria

- Enemies attacking a taunting minion use the same windup/strike/recovery cadence as the normal minion-target path; a test verifies a taunt minion takes at most one strike per enemy attack cycle, not per tick

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
