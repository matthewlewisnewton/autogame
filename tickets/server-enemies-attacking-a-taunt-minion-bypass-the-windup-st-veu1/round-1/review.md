# Senior Review: Server — enemies attacking a taunt minion bypass the windup state machine

**Ticket:** `server-enemies-attacking-a-taunt-minion-bypass-the-windup-st-veu1`  
**Baseline:** `8a9e59c3bf7ba80b2160e31fe5a8b18127001842`  
**Commits reviewed:** `8b03a87f` (route taunt through windup), `8a6f7110` (tests + regression)

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `failure_kind` | absent |
| `console.log` pageerror / `[fatal]` | None (only Vite connect, benign 409 on register, scene init) |
| Screenshots / probes | Full-flow smoke capture succeeded; gameplay phase active with enemies present |

The captured run proves the game starts and loads cleanly. No harness infrastructure failure.

## Acceptance criteria

### Enemies attacking a taunting minion use the same windup/strike/recovery cadence as the normal minion-target path

**Met.**

The taunt branch in `updateEnemies()` no longer calls `damageMinion()` directly. When a taunt minion is in range and the enemy is in `attackState` `'idle'` or `'chasing'`, the code now mirrors the normal minion-target path:

- Sets `attackState = 'windup'`
- Sets `windupTargetType = 'minion'` and `windupTargetId`
- Records `windupStartTime` and calls `lockWindupDirection()`

```2931:2941:game/server/simulation.js
			if (dist <= ENEMY_ATTACK_RANGE) {
				// Route through windup state machine — only start windup when
				// not already in a windup/recovery cycle (those phases are
				// handled by the blocks above and will fall through naturally).
				if (enemy.attackState === 'chasing' || enemy.attackState === 'idle') {
					enemy.attackState = 'windup';
					enemy.windupTargetType = 'minion';
					enemy.windupTargetId = tauntMinion.id;
					enemy.windupStartTime = Date.now();
					lockWindupDirection(enemy, tauntMinion);
				}
```

Loop ordering ensures correct behavior:

1. **`recovering`** — handled at the top of the per-enemy loop; enemy does not move or re-attack until `recoverUntil` elapses, then transitions to `'chasing'`.
2. **`windup`** — handled next; when elapsed ≥ `attackWindupMs`, the existing strike block calls `damageMinion()` for `windupTargetType === 'minion'`, then enters `'recovering'` with `ENEMY_ATTACK_RECOVERY_MS`.
3. **Taunt acquisition** — only reached when not mid-windup/recovery (those paths `continue` earlier), so damage cannot fire every tick.

This is structurally identical to the normal nearest-target windup entry at lines 2986–2993, reusing the same strike and recovery machinery at lines 2876–2892.

### A test verifies a taunt minion takes at most one strike per enemy attack cycle, not per tick

**Met.**

`game/server/test/minion_damage.test.js` adds `"taunt minion takes at most one strike per attack cycle (windup + recovery)"`, which:

- Uses fake timers over 10 full attack cycles (`attackWindupMs + ENEMY_ATTACK_RECOVERY_MS`)
- Runs two `updateEnemies()` ticks per cycle (windup start, then strike after windup elapses)
- Asserts exactly one HP-decreasing strike per cycle and final HP `160 - 10 × grunt.attackDamage`

Three existing taunt tests were updated to the two-tick windup pattern (`aegis_sentinel.test.js`, `minion_damage.test.js`, `new_card_pack.test.js`), confirming windup on tick 1 and damage on tick 2.

Harness `coverage.log`: 1201 tests passed (46 files). Independent re-run of the full suite: 3256 tests passed.

## Design & requirements consistency

- **design.md:** Server-side combat simulation change only; no client or card-definition changes. Taunt minions (Aegis Sentinel, Necroframe Knight) now survive long enough to fulfill their intended tanking role — aligned with creature/taunt design intent.
- **requirements.md:** No documented regression. Change is narrowly scoped to enemy attack cadence against taunt targets.

## Code quality

- **Focused diff:** 14 lines changed in `simulation.js`; no dead code or unrelated refactors.
- **State-machine safety:** Guard `attackState === 'chasing' || attackState === 'idle'` prevents restarting windup mid-cycle; windup/recovery blocks short-circuit before the taunt branch on subsequent ticks.
- **Integration:** Taunt priority (`findTauntMinionNear` before normal target selection) preserved; chase fallback for out-of-range taunt targets unchanged.
- **No debug scenarios added** — nothing to gate-check for this ticket.

## Debug scenarios

Not applicable — no new or modified `?debugScenario=` shortcuts in this ticket.

## Remaining gaps

None. The direct-per-tick damage bug is fixed, regression-tested, and the game runs cleanly in capture.

VERDICT: PASS
