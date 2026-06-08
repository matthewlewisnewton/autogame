# 309-fix-storm-eagle-thunderbird-attack-interval-gate

## Difficulty: medium

## Goal

BUG (found by 303 balance + code confirm). The storm_eagle / thunderbird minion ranged strike has NO attack-interval gate: in game/server/simulation.js (~line 2877) the block calls damageEnemy(nearestEnemy, attackDamage) every tick an enemy is within attackRange — unlike the null_crawler block right below (~2926) which gates with attackIntervalMs (||2000) + lastAttackAt. So storm_eagle/thunderbird deal attackDamage ~20x/sec (every sim tick), far above intended DPS.

FIX (conservative): add an attackIntervalMs gate to the storm_eagle/thunderbird block, mirroring null_crawler — track minion.lastAttackAt and only damage when (now - lastAttackAt >= attackIntervalMs); set lastAttackAt on hit. Add a sensible attackIntervalMs to these minions stats (pick a value that brings their real DPS into the intended band — confirm against the 303 report; do not otherwise change their per-hit damage). For thunderbird, gate the whole chain (one chain per interval). ACCEPTANCE: storm_eagle/thunderbird fire on the interval, not every tick; per-hit damage unchanged; server test asserting the gate. SCOPE: game/server/simulation.js + game/shared/cardStats.json (interval) + test. Keep it minimal/conservative.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
