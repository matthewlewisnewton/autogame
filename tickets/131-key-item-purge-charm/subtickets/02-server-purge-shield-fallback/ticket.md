# Purge Charm — 1-hit shield fallback

When the casting player has no active debuffs, `useKeyItem('purge_charm')` instead
grants a one-hit shield (`shieldHitsRemaining: 1`) that fully absorbs the next
incoming damage instance. Wire the absorption into `damagePlayer`.

## Acceptance Criteria

- Using `purge_charm` with NO active debuffs sets `player.shieldHitsRemaining = 1`,
  burns the ~7s cooldown, and emits `keyItemUsed { ok: true, keyItemId, shielded: true, cooldownUntil }`.
- Using `purge_charm` WHEN the player has a debuff does NOT grant a shield (it only
  clears the oldest debuff — behavior from sub-ticket 01 is preserved).
- `damagePlayer` honors `shieldHitsRemaining`: while it is `> 0`, the next damage
  instance is fully absorbed (player HP unchanged) and `shieldHitsRemaining` is
  decremented by 1; absorbing a hit consumes the shield.
- The shield absorbs the FULL hit regardless of damage amount (it is hit-based, not
  HP-based — distinct from the existing `shieldHp` pool).
- A second damage instance after the shield is consumed reduces HP normally.
- Tests in `game/server/test/` cover: no-debuff `purge_charm` → `shieldHitsRemaining === 1`;
  one `damagePlayer` call leaves HP unchanged and `shieldHitsRemaining === 0`; a
  subsequent `damagePlayer` call reduces HP.

## Technical Specs

- `game/server/index.js`: in the `purge_charm` branch of the `useKeyItem` handler
  (added in sub-ticket 01), implement the `else` (no-debuff) path: set
  `player.shieldHitsRemaining = 1`, set `player.keyItemCooldownUntil = now + (def.cooldownMs || 7000)`,
  mark `player.persistenceDirty = true`, and emit `keyItemUsed { ok: true, keyItemId, shielded: true, cooldownUntil }`.
  Optionally initialize `shieldHitsRemaining: 0` on the player object alongside other
  defaults.
- `game/server/simulation.js`: in `damagePlayer` (~line 1488), after the barrier-dome
  and block checks and before the existing `shieldHp` absorption / `player.hp` subtraction,
  add: `if (player.shieldHitsRemaining > 0) { player.shieldHitsRemaining -= 1; return null; }`
  so the entire hit is absorbed and HP is untouched. Default `player.shieldHitsRemaining`
  to `0` when reading if it may be undefined.

## Verification: code
